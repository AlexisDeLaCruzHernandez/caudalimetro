#ifndef SD_CARD_H
#define SD_CARD_H

#include <time.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>
#include <errno.h>

#include "esp_vfs_fat.h"
#include "sdmmc_cmd.h"

#define MOUNT_POINT             "/sdcard"

#define IS_SD_DISCONNECTED()    (errno == EIO || errno == ENODEV || errno == EBADF)

typedef struct {
    struct tm time_info;
    uint32_t volume;
} data_t;

typedef struct {
    const char *base_path;
    sdmmc_host_t host_config_input;
    sdspi_device_config_t slot_config;
    esp_vfs_fat_mount_config_t mount_config;
    sdmmc_card_t *card;
} sd_card_config_t;

/**
 * @brief                           Monta el sistema de archivos FAT de la tarjeta SD
 * @param[in] sd_card_config        Puntero a la estructura de configuración de la SD
 * @retval ESP_OK                   Tarjeta SD detectada y sistema de archivos FAT montado correctamente.
 * @retval ESP_FAIL                 Fallo físico de comunicación SPI, tarjeta no insertada o error de formato FAT.
 */
esp_err_t sd_card_mount(sd_card_config_t *sd_card_config);

/**
 * @brief                           Escribe una medición junto al timestamp en la memoria SD.
 * @param[in] data                  Puntero a la estructura que contiene la información a registrar.
 * @retval ESP_OK                   Escritura completada y confirmada en disco correctamente.
 * @retval ESP_ERR_INVALID_STATE    Fallo físico de E/S o tarjeta desconectada (EIO/ENODEV). Requiere re-montar la SD.
 * @retval ESP_FAIL                 Error al crear la carpeta o al operar el archivo sin fallo de hardware.
 */
esp_err_t sd_card_write_measurement(data_t *data);

/**
 * @brief                           Lee mediciones en determinado rango de fechas
 * @param[in] start_date            Fecha inicial del rango a buscar
 * @param[in] end_date              Fecha final del rango a buscar
 * @retval ESP_OK                   Lectura finalizada con éxito
 * @retval ESP_ERR_INVALID_STATE    Fallo físico de E/S o tarjeta desconectada (EIO/ENODEV). Requiere re-montar la SD.
 * @retval ESP_FAIL                 Error de lectura o corrupción de datos al procesar el archivo.
 * @retval ESP_ERR_INVALID_ARG      Fechas nulas o rango incoherente (start_date > end_date).
 */
esp_err_t sd_card_read_range(struct tm *start_date, struct tm *end_date);

#endif /* SD_CARD_H */
