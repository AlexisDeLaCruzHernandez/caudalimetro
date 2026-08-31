#ifndef INIT_H
#define INIT_H

#include <stdio.h>
#include <dirent.h>

#include "driver/gpio.h"
#include "lwip/sockets.h"
#include "lwip/netdb.h"

#define BUFFER_SIZE         256
#define INTERVAL_MIN        15
#define INTERVAL_SEC        (INTERVAL_MIN * 60) 

#define CAUDAL_PIN          GPIO_NUM_0
#define DEBOUNCE_TIME_MS    20

#define TCP_PORT            3333

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

bool recv_all(int sock, void *buffer, size_t length);

bool send_all(int sock, const void *buffer, size_t length);

#endif /* INIT_H */
