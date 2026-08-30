#ifndef INIT_H
#define INIT_H

#include <stdio.h>
#include <dirent.h>

#include "esp_wifi.h"
#include "driver/gpio.h"

#define BUFFER_SIZE         256
#define INTERVAL_MIN        15
#define INTERVAL_SEC        (INTERVAL_MIN * 60) 

#define INTERVAL_MAX_LITER  ((5000 / 60) * INTERVAL_MIN)
#define CAUDAL_PIN          GPIO_NUM_0 
#define DEBOUNCE_TIME       20      // 20 ms 

#define WIFI_SSID           "Speedy-Fibra"
#define WIFI_PASS           "casa1234"

void borrar_todos_los_archivos(const char *path);

void wifi_init_sta(EventGroupHandle_t *wifi_event, esp_event_handler_t handler);

void gpio_caudal_init(gpio_isr_t isr_handler);

#endif /* INIT_H */
