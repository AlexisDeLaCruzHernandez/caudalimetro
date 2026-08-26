#include "sd_card.h"
#include "esp_log.h"

static const char *TAG = "SD_CARD";


esp_err_t sd_card_mount(sd_card_config_t *sd_card_config)
{
    esp_err_t ret = esp_vfs_fat_sdspi_mount(
        sd_card_config->base_path,
        &sd_card_config->host_config_input,
        &sd_card_config->slot_config,
        &sd_card_config->mount_config,
        &sd_card_config->card
    );
    if(ret == ESP_OK) ESP_LOGI(TAG, "Tarjeta SD montada correctamente");
    return ret;
}

esp_err_t sd_card_write_measurement(data_t *data) 
{
    char folder_path[32];
    char file_path[64];

    struct tm time_info;
    localtime_r(&data->time_info, &time_info);

    int year = time_info.tm_year + 1900;
    int month = time_info.tm_mon + 1;

    // El archivo se guarda en una carpeta según el año indicado en el timestamp
    snprintf(folder_path, sizeof(folder_path), MOUNT_POINT "/%04d", year); 
    // El nombre del archivo viene dado por el año y el mes del timestamp
    snprintf(file_path, sizeof(file_path), "%s/%04d-%02d.csv", folder_path, year, month);

    // Trata de crear la carpeta o si está creada continua el código
    if(mkdir(folder_path, 0777) != 0 && errno != EEXIST) {
        ESP_LOGE(TAG, "Error al crear la carpeta %s: %s", folder_path, strerror(errno));
        return IS_SD_DISCONNECTED() ? ESP_ERR_INVALID_STATE : ESP_FAIL;
    }

    // Se fija si el archivo ya está creado o es la primer apertura
    bool new_file = access(file_path, F_OK) != 0;

    // Abre el archivo en modo append
    FILE *f = fopen(file_path, "a");
    if (f == NULL) {
        ESP_LOGE(TAG, "Error al abrir el archivo (escritura) %s: %s", file_path, strerror(errno));
        return IS_SD_DISCONNECTED() ? ESP_ERR_INVALID_STATE : ESP_FAIL;
    }

    // Si es la primer apertura del archivo escribimos la cabecera
    if(new_file) {
        if(fprintf(f, "Fecha [d/m/a]|Hora [h:m:s]|Caudal [L]\n") < 0) {
            ESP_LOGE(TAG, "Error al escribir cabecera: %s", strerror(errno));
            esp_err_t ret = IS_SD_DISCONNECTED() ? ESP_ERR_INVALID_STATE : ESP_FAIL;
            fclose(f);
            return ret;
        }
        ESP_LOGI(TAG, "Archivo nuevo creado");
    }

    char date[16];
    char time[16];
    // Armamos los strings con la fecha y la hora a guardar
    strftime(date, sizeof(date), "%d/%m/%Y", &time_info);
    strftime(time, sizeof(time), "%H:%M:%S", &time_info);

    // Escribimos el dato en la SD
    if(fprintf(f, "%s|%s|%ld\n", date, time, data->volume) < 0) {
        ESP_LOGE(TAG, "Error al escribir registro: %s", strerror(errno));
        esp_err_t ret = IS_SD_DISCONNECTED() ? ESP_ERR_INVALID_STATE : ESP_FAIL;
        fclose(f);
        return ret;
    }
    // Cerramos el archivo
    if(fclose(f) != 0) {
        ESP_LOGE(TAG, "Error al cerrar el archivo %s: %s", file_path, strerror(errno));
        return IS_SD_DISCONNECTED() ? ESP_ERR_INVALID_STATE : ESP_FAIL;
    }

    ESP_LOGI(TAG, "Archivo escrito");
    return ESP_OK;
}

esp_err_t sd_card_read_range(time_t *start_time, time_t *end_time, data_t *buffer, size_t max_size, size_t *items_read)
{
    // Convertimos las fechas a struct tm para una obtener años y meses
    struct tm start_date, end_date;
    localtime_r(start_time, &start_date);
    localtime_r(end_time, &end_date);

    // Nos fijamos el rango indicado en los parametros
    if(*start_time == -1 || *end_time == -1 || *start_time > *end_time) {
        ESP_LOGE(TAG, "Rango de fechas inválido");
        return ESP_ERR_INVALID_ARG;
    }

    // Guardamos el año y el mes final e inicial para abrir los archivos
    int current_year = start_date.tm_year + 1900;
    int current_month = start_date.tm_mon + 1;
    int end_year = end_date.tm_year + 1900;
    int end_month = end_date.tm_mon + 1;

    bool done = false;
    char line[128];
    size_t count = 0;

    ESP_LOGI(TAG, "Iniciando lectura");
    
    while(!done) {
        char file_path[64];
        // Armamos el nombre del archivo que debemos abrir (fecha inicial)
        snprintf(file_path, sizeof(file_path), MOUNT_POINT "/%04d/%04d-%02d.csv", current_year, current_year, current_month);

        // Abrimos el archivo en modo lectura
        FILE *f = fopen(file_path, "r");
        if(f != NULL) {
            ESP_LOGI(TAG, "Leyendo %s", file_path);

            // Leemos el archivo hasta el final
            while(fgets(line, sizeof(line), f) != NULL) {
                int day, month, year, hour, minute, second;
                uint32_t volume;

                // Separamos el string leido en sus diferentes componentes
                if(sscanf(line, "%d/%d/%d|%d:%d:%d|%lu", &day, &month, &year, &hour, &minute, &second, &volume) == 7) {
                    // Armamos la estructura con la fecha y hora leidas
                    struct tm line_date = {
                        .tm_mday = day,
                        .tm_mon = month - 1,
                        .tm_year = year - 1900,
                        .tm_hour = hour,
                        .tm_min = minute,
                        .tm_sec = second,
                    };
                    // Convertimos a time_t para comparar
                    time_t line_time = mktime(&line_date);

                    // Si está dentro del rango lo enviamos 
                    if(line_time >= *start_time && line_time <= *end_time) {
                        // Almacenamos el dato en el buffer
                        buffer[count].time_info = line_time;
                        buffer[count].volume = volume;
                        count++;

                        // Actualizamos el tiempo de comienzo
                        *start_time = line_time;

                        // Verificamos llenado del buffer
                        if(count == max_size) {
                            fclose(f);
                            *items_read = count;
                            ESP_LOGI(TAG, "Buffer lleno");
                            return ESP_OK;
                        }
                    }
                    // En caso de superar el tiempo de finalización quiere decir que completamos la lectura
                    else if(line_time > *end_time) {
                        // Cerramos el archivo
                        fclose(f);
                        // actualizamos tiempo para saber que se terminó la lectura
                        *start_time = *end_time;
                        *items_read = count;
                        ESP_LOGI(TAG, "Lectura completada");
                        return ESP_OK;
                    }
                }
            }
            if(ferror(f)) {
                ESP_LOGE(TAG, "Error durante la lectura de %s: %s", file_path, strerror(errno));
                esp_err_t ret = IS_SD_DISCONNECTED() ? ESP_ERR_INVALID_STATE : ESP_FAIL;
                fclose(f);
                *items_read = count;
                return ret;
            }
            // Cerramos el archivo al terminar de leer
            fclose(f);
        }
        else {
            if(errno == ENOENT) {
                ESP_LOGW(TAG, "No hay información de dicho mes");
            }
            else {
                ESP_LOGE(TAG, "Error al abrir el archivo (lectura) %s: %s", file_path, strerror(errno));
                *items_read = count;
                return IS_SD_DISCONNECTED() ? ESP_ERR_INVALID_STATE : ESP_FAIL;
            }
        }

        // En caso de que la fecha actual sea la final se terminó la lectura
        if(current_year == end_year && current_month == end_month) {
            done = true;
        }
        // Caso contrario pasamos al siguiente mes/año
        else {
            current_month++;
            if(current_month > 12) {
                current_month = 1;
                current_year++;
            }
        }
    }

    // actualizamos tiempo para saber que se terminó la lectura
    *start_time = *end_time;
    *items_read = count;
    ESP_LOGI(TAG, "Lectura completada, fin de archivos");
    return ESP_OK;
}
