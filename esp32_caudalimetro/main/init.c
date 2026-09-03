#include "init.h"
#include "esp_log.h"

static const char *TAG = "INIT";

void borrar_todos_los_archivos(const char *path) 
{
    DIR *dir = opendir(path);
    if (dir == NULL) return;

    struct dirent *entry;
    char filepath[300];

    ESP_LOGI(TAG, "--- Eliminando todos los archivos ---");
    while ((entry = readdir(dir)) != NULL) {
        if (strcmp(entry->d_name, ".") == 0 || strcmp(entry->d_name, "..") == 0) continue;
        snprintf(filepath, sizeof(filepath), "%s/%s", path, entry->d_name);
        remove(filepath);
    }
    closedir(dir);
}

esp_err_t gpio_caudal_init(gpio_isr_t isr_handler)
{
    esp_err_t ret;
    gpio_config_t io_conf = {
        .pin_bit_mask = (1ULL << CAUDAL_PIN),
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = 1,               // Pull up
        .pull_down_en = 0,
        .intr_type = GPIO_INTR_NEGEDGE // Interrupción flanco descendente
    };

    // Configuramos el GPIO
    ret = gpio_config(&io_conf);
    if(ret != ESP_OK) {
        ESP_LOGE(TAG, "Error al configurar el GPIO");
        return ret;
    }

    // Instalamos las interrupciones
    ret = gpio_install_isr_service(0);
    if(ret != ESP_OK) {
        ESP_LOGE(TAG, "Error al instalar las interrupciones");
        return ret;
    }
    
    // Añadimos el handler de interrupción
    ret = gpio_isr_handler_add(CAUDAL_PIN, isr_handler, NULL);
    if(ret != ESP_OK) {
        ESP_LOGE(TAG, "Error al añadir el handler de interrupción");
        return ret;
    }

    return ESP_OK;
}

void wifi_init_sta(EventGroupHandle_t *wifi_event, esp_event_handler_t handler)
{
    *wifi_event = xEventGroupCreate(); // Crea el event group 
    ESP_ERROR_CHECK(esp_netif_init()); // Inicializa la pila de red TCP/IP
    ESP_ERROR_CHECK(esp_event_loop_create_default()); // Crea loop de eventos para distribuirlos 
    esp_netif_create_default_wifi_sta(); // Crea la interfaz de red para el modo STA

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT(); // Obtiene la configuración por defecto para inicializar el Wi-Fi
    ESP_ERROR_CHECK(esp_wifi_init(&cfg)); // Inicializa el Wi-Fi

    // Registra el Handler para eventos relacionados a la conexión Wi-Fi
    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, handler, NULL));
    // Registra el Handler para eventos relacionados con la dirección IP
    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, handler, NULL));

    wifi_config_t wifi_config = { // Configuración de la red Wi-Fi
        .sta = {
            .ssid = WIFI_SSID,
            .password = WIFI_PASS,
        },
    };

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA)); // Indica el modo STA
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config)); // Carga la configuración de la red
    ESP_ERROR_CHECK(esp_wifi_start()); // Inicia el controlador de Wi-Fi, provoca WIFI_EVENT_STA_START
}

bool recv_all(int sock, void *buffer, size_t length) 
{ 
    uint8_t *ptr = (uint8_t *)buffer; 
    size_t received = 0; 
    while(received < length) { 
        int ret = recv(sock, ptr + received, length - received, 0); 
        if(ret == 0) { 
            // El cliente cerró la conexión antes de completar el mensaje 
            ESP_LOGW(TAG, "Cliente cerró la conexión durante recv()"); 
            return false; 
        } 
        if(ret < 0) { 
            if(errno == EINTR) { 
                // La llamada fue interrumpida; simplemente reintentar 
                continue; 
            } 
            ESP_LOGE(TAG, "recv() fallo: errno=%d (%s)", errno, strerror(errno)); 
            return false; 
        } 
        received += (size_t)ret; 
    } 
    return true; 
}

bool send_all(int sock, const void *buffer, size_t length) 
{ 
    const uint8_t *ptr = (const uint8_t *)buffer; 
    size_t sent = 0; 
    while(sent < length) { 
        int ret = send(sock, ptr + sent, length - sent, 0); 
        if(ret < 0) { 
            if(errno == EINTR) { 
                continue; 
            } 
            ESP_LOGE(TAG, "send() fallo: errno=%d (%s)", errno, strerror(errno)); 
            return false; 
        } 
        if(ret == 0) { 
            ESP_LOGE(TAG, "send() devolvio 0"); 
            return false; 
        } 
        sent += (size_t)ret; 
    } 
    return true; 
}

esp_err_t gpio_error_init(void)
{
    esp_err_t ret;
    gpio_config_t io_conf = {
        .pin_bit_mask = (1ULL << SNTP_ERROR_PIN),
        .mode = GPIO_MODE_OUTPUT,
    };

    // Configuramos el GPIO
    ret = gpio_config(&io_conf);
    if(ret != ESP_OK) {
        ESP_LOGE(TAG, "Error al configurar el GPIO");
        return ret;
    }
    
    io_conf.pin_bit_mask = (1ULL << WIFI_ERROR_PIN);
    ret = gpio_config(&io_conf);
    if(ret != ESP_OK) {
        ESP_LOGE(TAG, "Error al configurar el GPIO");
        return ret;
    }

    io_conf.pin_bit_mask = (1ULL << FLASH_ERROR_PIN);
    ret = gpio_config(&io_conf);
    if(ret != ESP_OK) {
        ESP_LOGE(TAG, "Error al configurar el GPIO");
        return ret;
    }

    return ESP_OK;
}

/**
 * @brief Inicializa el servicio mDNS y anuncia el servidor TCP
 * @param[in] hostname Nombre del dispositivo (ej. "caudalimetro" -> caudalimetro.local)
 * @param[in] instance_name Nombre descriptivo para el descubrimiento en red
 * @retval ESP_OK Inicialización correcta
 */
esp_err_t mdns_server_init(const char *hostname, const char *instance_name)
{
    // Inicializar el demonio mDNS
    esp_err_t err = mdns_init();
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Error al inicializar mDNS: %s", esp_err_to_name(err));
        return err;
    }

    // Configurar el hostname (lo que va antes de .local)
    mdns_hostname_set(hostname);
    
    // Configurar el nombre de la instancia 
    mdns_instance_name_set(instance_name);

    // Anunciar el servicio TCP de tu datalogger para que la GUI lo descubra automáticamente
    // Formato: instance_name, service_type, proto, port, txt_data, num_items
    mdns_service_add(instance_name, "_datalogger", "_tcp", 3333, NULL, 0);

    ESP_LOGI(TAG, "mDNS inicializado. Accesible en: %s.local", hostname);
    
    return ESP_OK;
}