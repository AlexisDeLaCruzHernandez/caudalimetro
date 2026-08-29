#ifndef TIMESTAMP_H
#define TIMESTAMP_H

#include <stdio.h>

#include "esp_sntp.h"

/**
 * @brief               Inicializa el sntp para obtener la hora
 * @return esp_err_t    Siempre retorna ESP_OK
 */
esp_err_t timestamp_init(void);

/**
 * @brief               Calcula los ticks a demorar según el intervalo dado
 * @param[in] delay     Cantidad de segundos a demorar
 * @return TickType_t   Retorna cantidad de ticks a demorar
 */
TickType_t timestamp_delay(uint32_t delay);

#endif /* TIMESTAMP_H */
