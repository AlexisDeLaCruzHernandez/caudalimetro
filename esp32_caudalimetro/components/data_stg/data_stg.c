#include "data_stg.h"
#include "esp_log.h"

static const char *TAG = "DATA_STG";

static inline void advance_to_next_month(data_stg_reader_t *reader) {
    reader->current_month++;
    if (reader->current_month > 12) {
        reader->current_month = 1;
        reader->current_year++;
    }
    reader->data_read = 0;
}

esp_err_t data_stg_mount(void) 
{
    data_stg_config_t data_stg_config = {
        .base_path = BASE_PATH,
        .partition_label = PARTITION_LABEL,
        .mount_config = {
            .max_files = 1,
            .format_if_mount_failed = false,
            .allocation_unit_size = CONFIG_WL_SECTOR_SIZE,
        }
    };

    esp_err_t ret = esp_vfs_fat_spiflash_mount_rw_wl(
        data_stg_config.base_path, 
        data_stg_config.partition_label, 
        &data_stg_config.mount_config, 
        &data_stg_config.wl_handle
    );
    if(ret == ESP_OK) ESP_LOGI(TAG, "Montaje de sistema de archivos FAT exitoso");
    else ESP_LOGE(TAG, "Error al montar el sistema de archivos FAT");
    
    return ret;
}

esp_err_t data_stg_write_measurement(data_t *data) 
{
    char file_path[64];
    struct tm time_info;
    time_t time = data->time_info;
    localtime_r(&time, &time_info);

    int year = time_info.tm_year + 1900;
    int month = time_info.tm_mon + 1;

    // El nombre del archivo viene dado por el año y el mes del timestamp
    snprintf(file_path, sizeof(file_path), BASE_PATH "/%04d-%02d.bin", year, month);

    // Abre el archivo en modo append binario
    FILE *f = fopen(file_path, "ab");
    if(f == NULL) {
        ESP_LOGE(TAG, "Error al abrir el archivo: %s", file_path);
        return ESP_FAIL;
    }

    // Escribimos el registro en flash
    if(fwrite(data, sizeof(data_t), 1, f) != 1) {
        ESP_LOGE(TAG, "Error al escribir en el archivo: %s", file_path);
        fclose(f);
        return ESP_FAIL;
    }

    // Cerramos el archivo
    fclose(f);

    // ESP_LOGI(TAG, "Archivo (%s) escrito correctamente", file_path);
    return ESP_OK;
}

esp_err_t data_stg_reader_init(data_stg_reader_t *reader, time_t start_time, time_t end_time)
{
    if (start_time > end_time) return ESP_ERR_INVALID_ARG;

    struct tm start_date;
    struct tm end_date;

    localtime_r(&start_time, &start_date);
    localtime_r(&end_time, &end_date);

    reader->data_read = 0;

    reader->current_year = start_date.tm_year + 1900;
    reader->current_month = start_date.tm_mon + 1;

    reader->end_year = end_date.tm_year + 1900;
    reader->end_month = end_date.tm_mon + 1;

    reader->start_time = start_time;
    reader->end_time = end_time;

    reader->initialized = true;
    reader->finished = false;

    return ESP_OK;
}

esp_err_t data_stg_read_range(data_stg_reader_t *reader, data_t *buffer, size_t max_size, size_t *items_read)
{
    if(!reader->initialized) return ESP_ERR_INVALID_ARG;
    *items_read = 0;

    while(!reader->finished) {
        char file_path[64];
        // El nombre del archivo viene dado por el año y el mes del timestamp
        snprintf(file_path, sizeof(file_path), BASE_PATH "/%04d-%02d.bin", reader->current_year, reader->current_month);

        // Abrimos el archivo en modo lectura
        FILE *f = fopen(file_path, "rb");
        if(f == NULL) {
            // Verificamos error o si no existe el archivo
            if(errno == ENOENT) {
                ESP_LOGW(TAG, "Mes no disponible: %s", file_path);
            } 
            else {
                ESP_LOGE(TAG, "Error al abrir: %s", file_path);
                return ESP_FAIL;
            }

            // Verificamos fin de lectura
            if (reader->current_year == reader->end_year && reader->current_month == reader->end_month) {
                reader->finished = true;
                return ESP_OK;
            }

            // Pasa al siguiente mes
            advance_to_next_month(reader);
            continue;
        }
        // Armamos el offset con los datos leidos
        long offset = (long)(reader->data_read * sizeof(data_t));
        if(fseek(f, offset, SEEK_SET) != 0) {
            ESP_LOGE(TAG, "Error al posicionarse en %s", file_path);
            fclose(f);
            return ESP_FAIL;
        }
        // Leemos los datos
        size_t elements_read =fread(buffer, sizeof(data_t), max_size, f);
        if(elements_read == 0) {
            // Verificamos error
            if(ferror(f)) {
                ESP_LOGE(TAG, "Error al leer: %s", file_path);
                fclose(f);
                return ESP_FAIL;
            }
            fclose(f);

            // Verificamos fin de lectura
            if (reader->current_year == reader->end_year && reader->current_month == reader->end_month) {
                reader->finished = true;
                ESP_LOGI(TAG, "Lectura completada, fin de archivos");
                return ESP_OK;
            }

            // Pasa al siguiente mes
            advance_to_next_month(reader);
            continue;
        }
        // Ahora iteramos los elementos leidos para ver su validez
        size_t valid_read = 0;
        for(size_t i = 0; i < elements_read; i++) {
            time_t time_info = (time_t)buffer[i].time_info;
            // Si el tiempo es menor se descarte
            if(time_info < reader->start_time) {
                continue;
            }
            // Si se pasó del tiempo quiere decir que terminó
            if(time_info > reader->end_time) {
                reader->finished = true;
                break;
            }
            // Si no cumple las otras dos el dato es valido, movemos los datos del buffer
            buffer[valid_read] = buffer[i];
            valid_read++;
        }
        // Actualizamos la cantidad de elementos leidos del archivo
        reader->data_read += elements_read;

        // Indicamos cuantos datos leimos
        *items_read = valid_read;

        fclose(f);
        // Verificamos fin de archivo
        if(reader->finished) {
            ESP_LOGI(TAG, "Lectura completada, fin de rango");
            return ESP_OK;
        }
        // Verificamos buffer lleno
        if(valid_read == max_size) {
            ESP_LOGI(TAG, "Buffer lleno");
            return ESP_OK;
        }
        // Si se leyeron menos datos que los solicitados indica fin de archivo
        if(elements_read < max_size) {
            if (reader->current_year == reader->end_year && reader->current_month == reader->end_month) {
                reader->finished = true;
                ESP_LOGI(TAG, "Lectura completada, fin de archivos");
                return ESP_OK;
            }

            advance_to_next_month(reader);
        }
    }
    return ESP_OK;
}
