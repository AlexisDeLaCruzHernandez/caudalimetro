#ifndef DATA_STG_H
#define DATA_STG_H

#include <time.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>
#include <errno.h>
#include <dirent.h>

#include "esp_vfs_fat.h"

#define BASE_PATH           "/flash"
#define PARTITION_LABEL     "storage"        

typedef struct {
    uint32_t time_info;
    uint16_t volume;
} __attribute__((packed)) data_t;

typedef struct {
    const char *base_path;
    const char *partition_label;
    esp_vfs_fat_mount_config_t mount_config;
    wl_handle_t wl_handle;
} data_stg_config_t;

/**
 * @brief                           Monta el sistema de archivos FAT de la tarjeta partición.
 * @retval ESP_OK                   Montaje de sistema de archivos FAT exitoso.
 * @retval Other                    Ocurrió un error al montar el sistema de archivos FAT.
 */
esp_err_t data_stg_mount(void);

/**
 * @brief                           Escribe una medición junto al timestamp en la memoria flash.
 * @param[in] data                  Puntero a la estructura que contiene la información a registrar.
 * @retval ESP_OK                   Escritura completada y confirmada en memoria correctamente.
 * @retval ESP_FAIL                 Error en apertura o escritura del archivo.
 */
esp_err_t data_stg_write_measurement(data_t *data);

/**
 * @brief                           Lee mediciones en determinado rango de fechas.
 * @param[in] start_time            Fecha inicial del rango a buscar.
 * @param[in] end_time              Fecha final del rango a buscar.
 * @param[out] buffer               Puntero al buffer de salida donde se almacenarán las mediciones.
 * @param[in] max_size              Cantidad máxima de elementos que puede almacenar el buffer.
 * @param[in] items_read            Cantidad de elementos almacenados en el buffer.
 * @retval ESP_OK                   Lectura finalizada con éxito.
 * @retval ESP_FAIL                 Error en apertura o lectura del archivo.
 * @retval ESP_ERR_INVALID_ARG      Fechas nulas o rango incoherente (start_date > end_date).
 */
esp_err_t data_stg_read_range(time_t *start_time, time_t *end_time, data_t *buffer, size_t max_size, size_t *items_read);

/**
 * @brief                           Verifica la cantidad de archivos y borra el más antiguo si hay más de 24.
 * @retval ESP_OK                   Verificación (y borrado si aplicaba) exitosa.
 * @retval ESP_FAIL                 Error al abrir el directorio o eliminar el archivo.
 */
esp_err_t data_stg_clean_old_months(void);

#endif /* DATA_STG_H */
