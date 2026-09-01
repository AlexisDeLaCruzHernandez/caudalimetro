#ifndef INIT_H
#define INIT_H

#include <stdio.h>
#include <dirent.h>

#include "driver/gpio.h"
#include "esp_wifi.h"
#include "lwip/sockets.h"
#include "lwip/netdb.h"

#define BUFFER_SIZE         256
#define INTERVAL_MIN        0.25
#define INTERVAL_SEC        (INTERVAL_MIN * 60) 

#define CAUDAL_PIN          GPIO_NUM_0
#define DEBOUNCE_TIME_MS    20

#define TCP_PORT            3333

#define WIFI_SSID           "Speedy-Fibra"// "Redmi Note 11"
#define WIFI_PASS           "casa1234"

#define SLEEP_TIME_MS       500
#define SNTP_ERROR_PIN      GPIO_NUM_1
#define MAX_SNTP_SYNC_SEC   (3 * 60 * 60)
#define WIFI_ERROR_PIN      GPIO_NUM_2
#define FLASH_ERROR_PIN     GPIO_NUM_3

typedef struct {
    gpio_num_t led_pin;
    bool error;
} led_state_t;

typedef struct {
    uint32_t first_time; // Timestamp de la primera muestra en flash
    uint32_t last_time;  // Timestamp de la última muestra en flash
} __attribute__((packed)) tcp_range_response_t;

typedef struct {
    uint32_t start_time;
    uint32_t end_time;
} __attribute__((packed)) tcp_request_t;

/**
 * @brief                   Borra todos los archivos del directorio
 * @param[in] path          String con directorio base a borrar
 */
void borrar_todos_los_archivos(const char *path);

/**
 * @brief                   Inicializa el gpio con pull up e interrupción
 * @param[in] isr_handler   Handler de interrupcion
 * @retval ESP_OK           Inicialización correcta del GPIO
 * @retval Other            Ocurrió un error en la inicialización
 */
esp_err_t gpio_caudal_init(gpio_isr_t isr_handler);

void wifi_init_sta(EventGroupHandle_t *wifi_event, esp_event_handler_t handler);

bool recv_all(int sock, void *buffer, size_t length);

bool send_all(int sock, const void *buffer, size_t length);

esp_err_t gpio_error_init(void);

#endif /* INIT_H */
