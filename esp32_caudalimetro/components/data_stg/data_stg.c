#include "data_stg.h"
#include "esp_log.h"

static const char *TAG = "DATA_STG";

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

    // Forzamos escritura inmediata
    fsync(fileno(f));
    
    // Cerramos el archivo
    fclose(f);

    ESP_LOGI(TAG, "Archivo (%s) escrito correctamente", file_path);
    return ESP_OK;
}

esp_err_t data_stg_read_range(time_t *start_time, time_t *end_time, data_t *buffer, size_t max_size, size_t *items_read)
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
    size_t count = 0;

    while(!done) {
        char file_path[64];
        // El nombre del archivo viene dado por el año y el mes del timestamp
        snprintf(file_path, sizeof(file_path), BASE_PATH "/%04d-%02d.bin", current_year, current_month);

        // Abrimos el archivo en modo lectura
        FILE *f = fopen(file_path, "rb");
        if(f != NULL) {
            bool file_done = false;

            while(!file_done) {
                // Nos fijamos el espacio disponible en el buffer
                size_t remaining_space = max_size - count;
                // Nos fijamos cuanto se leyó para detectar fin de archivo
                size_t elements_read = fread(&buffer[count], sizeof(data_t), remaining_space, f);
                // Variable para guardar lecturas dentro del rango
                size_t valid_read = 0;
                for(size_t i = 0; i < elements_read; i++) {
                    // Analizamos cada muestra para ver si el dato entra dentro del rango
                    data_t temp = buffer[count + i];
                    time_t time_info = (time_t)temp.time_info;
                    if(time_info >= *start_time && time_info <= *end_time) {
                        // Movemos los datos a la izquierda para sacar datos fuera de rango
                        buffer[count + valid_read] = temp;
                        valid_read++;
                        *start_time = time_info + 1;
                    }
                    else if(time_info >= *end_time) {
                        // Cerramos el archivo
                        fclose(f);
                        // actualizamos tiempo para saber que se terminó la lectura
                        *start_time = *end_time;
                        count += valid_read;
                        *items_read = count;
                        ESP_LOGI(TAG, "Lectura completada, por end_time");
                        return ESP_OK;
                    }
                }
                count += valid_read;
                if(count == max_size) {
                    fclose(f);
                    *items_read = count;
                    ESP_LOGI(TAG, "Buffer lleno");
                    return ESP_OK;
                }
                if(elements_read < remaining_space) {
                    if (ferror(f)) {
                        ESP_LOGE(TAG, "Error de I/O al leer: %s", file_path);
                        fclose(f);
                        *items_read = count;
                        return ESP_FAIL;
                    }
                    file_done = true;
                }
            }
            fclose(f);
        }
        else {
            if (errno == ENOENT) {
                ESP_LOGW(TAG, "Mes no disponible: %s", file_path);
            } else {
                ESP_LOGE(TAG, "Error al abrir: %s", file_path);
                *items_read = count;
                return ESP_FAIL;
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

esp_err_t data_stg_clean_old_months(void) 
{
    DIR *dir = opendir(BASE_PATH);
    if (dir == NULL) {
        ESP_LOGE(TAG, "Error al abrir el directorio base");
        return ESP_FAIL;
    }

    struct dirent *entry;
    int file_count = 0;
    char oldest_file[64] = "";

    // Leemos todos los archivos del directorio
    while ((entry = readdir(dir)) != NULL) {
        // Ignoramos los directorios actuales y padres
        if (strcmp(entry->d_name, ".") == 0 || strcmp(entry->d_name, "..") == 0) continue;

        // Filtramos para contar solo los archivos .bin
        if (strstr(entry->d_name, ".bin") != NULL) {
            file_count++;
            
            // Si oldest_file está vacío o el archivo actual es alfabéticamente menor (más antiguo)
            if (strlen(oldest_file) == 0 || strcmp(entry->d_name, oldest_file) < 0) {
                strncpy(oldest_file, entry->d_name, sizeof(oldest_file));
            }
        }
    }
    closedir(dir);

    // Si tenemos más de 24 meses (archivos), borramos el más antiguo
    if (file_count > 24) {
        char filepath[128];
        snprintf(filepath, sizeof(filepath), "%s/%s", BASE_PATH, oldest_file);
        
        if (remove(filepath) == 0) {
            ESP_LOGI(TAG, "Límite de 24 meses superado. Archivo antiguo eliminado: %s", oldest_file);
        } else {
            ESP_LOGE(TAG, "Error al eliminar el archivo: %s", filepath);
            return ESP_FAIL;
        }
    }
    
    return ESP_OK;
}