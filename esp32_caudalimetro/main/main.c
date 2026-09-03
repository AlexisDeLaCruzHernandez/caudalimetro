#include <stdio.h>

#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/queue.h"

#include "esp_log.h"
#include "nvs_flash.h"

#include "data_stg.h"
#include "timestamp.h"
#include "init.h"

static const char *TAG = "MAIN";

SemaphoreHandle_t caudal_switch;
QueueHandle_t liter_count;
QueueHandle_t led_error;
EventGroupHandle_t wifi_event_group;
const int WIFI_CONNECTED_BIT = BIT0;

static void wifi_event_handler(void* arg, esp_event_base_t event_base, int32_t event_id, void* event_data) 
{
    led_state_t led_wifi = {.led_pin = WIFI_ERROR_PIN, .error = true};
    // Se ejecuta al inicializar el modo STA y quiere conectarse 
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
    } 
    
    // Se ejecuta si se perdió la conexión, se intenta conectar nuevamente e indica la desconexión
    else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        ESP_LOGI(TAG, "Desconectado del Wi-Fi. Reconectando...");
        xEventGroupClearBits(wifi_event_group, WIFI_CONNECTED_BIT);
        led_wifi.error = true;
        xQueueSendToBack(led_error, &led_wifi, portMAX_DELAY);
        esp_wifi_connect();
    } 
    
    // Se ejecutá cuando se obtuvo una dirección IP, muestra la ip e indica la conexión
    else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t* event = (ip_event_got_ip_t*) event_data;
        ESP_LOGI(TAG, "IP obtenida: " IPSTR, IP2STR(&event->ip_info.ip));
        xEventGroupSetBits(wifi_event_group, WIFI_CONNECTED_BIT);
        led_wifi.error = false;
        xQueueSendToBack(led_error, &led_wifi, portMAX_DELAY);
    }
}

static void IRAM_ATTR gpio_isr_handler(void *arg)
{
    BaseType_t xHigherPriorityTaskWoken = pdFALSE;
    gpio_intr_disable(CAUDAL_PIN);
    xSemaphoreGiveFromISR(caudal_switch, &xHigherPriorityTaskWoken);
    portYIELD_FROM_ISR(xHigherPriorityTaskWoken);
}


void task_led_error(void *params)
{
    led_state_t leds[3] = {
        {.led_pin = SNTP_ERROR_PIN, .error = true},
        {.led_pin = WIFI_ERROR_PIN, .error = true},
        {.led_pin = FLASH_ERROR_PIN, .error = true},
    };
    led_state_t led_info;
    bool toggle = false;
    
    while(1) {
        toggle = !toggle;
        
        if(xQueueReceive(led_error, &led_info, 0) == pdTRUE) {
            if(led_info.led_pin == SNTP_ERROR_PIN) leds[0].error = led_info.error;
            else if(led_info.led_pin == WIFI_ERROR_PIN) leds[1].error = led_info.error;
            else leds[2].error = led_info.error;
        }
        
        for(uint8_t i = 0; i < 3; i++) {
            if(leds[i].error) {
                gpio_set_level(leds[i].led_pin, toggle);
            }
            else {
                gpio_set_level(leds[i].led_pin, 0);
            }
        }
        
        vTaskDelay(pdMS_TO_TICKS(SLEEP_TIME_MS));
    }
}


void task_caudal(void *params)
{
    uint16_t volume = 0;
    
    while(1) {
        xSemaphoreTake(caudal_switch, portMAX_DELAY);
        vTaskDelay(pdMS_TO_TICKS(DEBOUNCE_TIME_MS));
        if(gpio_get_level(CAUDAL_PIN) == 0) {
            if(xQueuePeek(liter_count, &volume, 0) == pdFALSE) volume = 0;
            volume++;
            ESP_LOGI(TAG, "Litro contado");
            xQueueOverwrite(liter_count, &volume);
        }
        gpio_intr_enable(CAUDAL_PIN);
    }
}

void task_datalogger(void *params)
{
    data_t data = {.time_info = 0, .volume = 0};
    time_t time_info;
    uint16_t volume = 0;
    int current_month = -1;
    struct tm time_tm;
    led_state_t led_flash, led_sntp;
    led_flash.led_pin = FLASH_ERROR_PIN;
    led_sntp.led_pin = SNTP_ERROR_PIN;

    while(1) {
        vTaskDelay(timestamp_delay(INTERVAL_SEC));

        time(&time_info);
        localtime_r(&time_info, &time_tm);

        data.time_info = (uint32_t)time_info;
        if(xQueueReceive(liter_count, &volume, 0) == pdFALSE) volume = 0;
        data.volume += volume;

        // Verificamos sntp sincronizado
        if (sntp_is_sync_valid(MAX_SNTP_SYNC_SEC)) {
            led_sntp.error = false;
            if(data_stg_write_measurement(&data) == ESP_OK) {
                ESP_LOGI(TAG, "A guardar: [%04d/%02d/%02d] %02d:%02d:%02d  %d",
                    time_tm.tm_year + 1900, time_tm.tm_mon + 1, time_tm.tm_mday, time_tm.tm_hour, 
                    time_tm.tm_min, time_tm.tm_sec, data.volume
                );
                data.volume = 0;
                led_flash.error = false;
            }
            else {
                ESP_LOGE(TAG, "Error guardando muestra");
                led_flash.error = true;
            }
            xQueueSendToBack(led_error, &led_flash, portMAX_DELAY);

            if(time_tm.tm_mon != current_month) {
                // Función que verifica si hay que borrar archivos
                if(data_stg_clean_old_months() == ESP_OK) current_month = time_tm.tm_mon;
            }
        }
        else {
            led_sntp.error = true;
        }
        xQueueSendToBack(led_error, &led_sntp, portMAX_DELAY);
    }
}

void task_tcp_server(void *params)
{
    struct sockaddr_in dest_addr;

    dest_addr.sin_addr.s_addr = htonl(INADDR_ANY);
    dest_addr.sin_family = AF_INET;
    dest_addr.sin_port = htons(TCP_PORT);

    int listen_sock = socket(AF_INET, SOCK_STREAM, IPPROTO_IP);
    if(listen_sock < 0) {
        ESP_LOGE(TAG, "Error creando el socket");
        vTaskDelete(NULL);
        return;
    }

    int opt = 1;
    setsockopt(listen_sock, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

    if(bind(listen_sock, (struct sockaddr *)&dest_addr, sizeof(dest_addr)) < 0) {
        ESP_LOGE(TAG, "Error al hacer bind");
        close(listen_sock);
        vTaskDelete(NULL);
        return;
    }

    if(listen(listen_sock, 1) < 0) {
        ESP_LOGE(TAG, "Error al hacer listen");
        close(listen_sock);
        vTaskDelete(NULL);
        return;
    }

    ESP_LOGI(TAG, "Servidor TCP escuchando en el puerto %d", TCP_PORT);

    while (1) {
        struct sockaddr_storage source_addr;
        socklen_t addr_len = sizeof(source_addr);
        
        // El servidor se bloquea aquí esperando una conexión de la PC
        int sock = accept(listen_sock, (struct sockaddr *)&source_addr, &addr_len);
        if (sock < 0) {
            ESP_LOGE(TAG, "Error al aceptar conexión");
            continue;
        }

        // Añadimos timeout de 5 segundos para la recepción
        struct timeval timeout;
        timeout.tv_sec = 5;
        timeout.tv_usec = 0;
        setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout));

        // Obtener la primera y última fecha guardadas en la memoria Flash
        time_t first_time = 0;
        time_t last_time = 0;
        data_stg_get_time_range(&first_time, &last_time);

        tcp_range_response_t range_info = {
            .first_time = htonl((uint32_t)first_time),
            .last_time  = htonl((uint32_t)last_time)
        };

        // Enviar la información del rango disponible al cliente al conectar
        if(!send_all(sock, &range_info, sizeof(range_info))) {
            ESP_LOGE(TAG, "Error al enviar el rango de fechas al cliente");
            shutdown(sock, SHUT_RDWR);
            close(sock);
            continue;
        }

        // Recibir la estructura de solicitud (start_time y end_time)
        tcp_request_t request;
        if(!recv_all(sock, &request, sizeof(request))) {
            ESP_LOGE(TAG, "No se pudo recibir tcp_request_t");
            shutdown(sock, SHUT_RDWR);
            close(sock);
            continue;
        }

        time_t start_time = (time_t)ntohl(request.start_time);
        time_t end_time = (time_t)ntohl(request.end_time);
        
        char first_time_str[32];
        char last_time_str[32];

        struct tm tm_start;
        localtime_r(&start_time, &tm_start);
        strftime(first_time_str, sizeof(first_time_str), "%Y-%m-%d %H:%M:%S", &tm_start);

        struct tm tm_end;
        localtime_r(&end_time, &tm_end);
        strftime(last_time_str, sizeof(last_time_str), "%Y-%m-%d %H:%M:%S", &tm_end);

        printf("Request -> Inicio: %s | Fin: %s\n\n", first_time_str, last_time_str);

        data_t buffer[BUFFER_SIZE];
        size_t items_read;
        while(start_time != end_time) {
            esp_err_t err = data_stg_read_range(&start_time, &end_time, buffer, BUFFER_SIZE, &items_read);
            if(err != ESP_OK) {
                ESP_LOGE(TAG, "Error leyendo datos");
                break;
            }
            if(items_read > 0) {
                for(size_t i = 0; i < items_read; i++) {
                    buffer[i].time_info = htonl(buffer[i].time_info);
                    buffer[i].volume = htons(buffer[i].volume);
                }
                if(!send_all(sock, buffer, items_read * sizeof(data_t))) {
                    ESP_LOGE(TAG, "Error enviando datos");
                    break;
                }
            }
        }
        // Cerramos el socket de esta sesión y volvemos a escuchar
        shutdown(sock, SHUT_WR);
        close(sock);
    }
}

void app_main(void)
{
    led_state_t led;
    liter_count = xQueueCreate(1, sizeof(uint16_t));
    caudal_switch = xSemaphoreCreateBinary();
    led_error = xQueueCreate(6, sizeof(led_state_t));

    ESP_LOGI(TAG, "Inicializando leds de error");
    ESP_ERROR_CHECK(gpio_error_init());
    xTaskCreate(task_led_error, "task_led_error", 1024 * 2, NULL, 1, NULL);

    ESP_LOGI(TAG, "Inicializando nvs flash");
    ESP_ERROR_CHECK(nvs_flash_init());

    ESP_LOGI(TAG, "Montando sistema de archivos FAT");
    ESP_ERROR_CHECK(data_stg_mount());
    led.led_pin = FLASH_ERROR_PIN;
    led.error = false;
    xQueueSendToBack(led_error, &led, portMAX_DELAY);
    

    ESP_LOGI(TAG, "Inicializando Wi-Fi");
    wifi_init_sta(&wifi_event_group, wifi_event_handler);

    ESP_LOGI(TAG, "Inicializando mDNS");
    ESP_ERROR_CHECK(mdns_server_init(MDNS_HOSTNAME, MDNS_INSTANCE_NAME));
    
    ESP_LOGI(TAG, "Inicializando sntp");
    ESP_ERROR_CHECK(timestamp_init());
    
    ESP_LOGI(TAG, "Inicializando gpio caudalimetro");
    ESP_ERROR_CHECK(gpio_caudal_init(gpio_isr_handler));

    data_stg_info(BASE_PATH);
    
    xTaskCreate(task_caudal, "task_caudal", 1024 * 4, NULL, 1, NULL);
    xTaskCreate(task_datalogger, "task_datalogger", 1024 * 4, NULL, 1, NULL);
    xTaskCreate(task_tcp_server, "task_tcp_server", 1024 * 4, NULL, 1, NULL);
}
