#ifndef INIT_H
#define INIT_H

#include <stdio.h>

#include "sd_card.h"

#define PIN_NUM_SCK         4
#define PIN_NUM_MISO        5
#define PIN_NUM_MOSI        6
#define PIN_NUM_CS          7

/**
 * @brief                   Inicializa las configuración y el bus SPI para la SD
 * @param sd_card_config    Estructura con toda la configuración
 * @return                  Retorna ESP_OK ante una inicialización correcta del SPI
 */
esp_err_t init_sd_card(sd_card_config_t *sd_card_config);

#endif /* INIT_H */
