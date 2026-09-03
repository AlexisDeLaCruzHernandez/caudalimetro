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
            .format_if_mount_failed = true,
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

esp_err_t data_stg_get_time_range(time_t *first_time, time_t *last_time)
{
    DIR *dir = opendir(BASE_PATH);
    if(dir == NULL) {
        ESP_LOGE(TAG, "Error al abrir el directorio base");
        return ESP_FAIL;
    }

    struct dirent *entry;
    char oldest_file[64] = "";
    char newest_file[64] = "";

    // Escaneamos los archivos .bin para encontrar el más viejo y el más nuevo por nombre
    while((entry = readdir(dir)) != NULL) {
        if(strcmp(entry->d_name, ".") == 0 || strcmp(entry->d_name, "..") == 0) continue;

        if(strstr(entry->d_name, ".bin") != NULL) {
            if(strlen(oldest_file) == 0 || strcmp(entry->d_name, oldest_file) < 0) {
                strncpy(oldest_file, entry->d_name, sizeof(oldest_file) - 1);
            }
            if(strlen(newest_file) == 0 || strcmp(entry->d_name, newest_file) > 0) {
                strncpy(newest_file, entry->d_name, sizeof(newest_file) - 1);
            }
        }
    }
    closedir(dir);

    // Si no se encontró ningún archivo .bin
    if(strlen(oldest_file) == 0) {
        *first_time = 0;
        *last_time = 0;
        return ESP_ERR_NOT_FOUND;
    }

    // Obtener el primer registro del archivo más antiguo
    char path[128];
    snprintf(path, sizeof(path), "%s/%s", BASE_PATH, oldest_file);
    FILE *f_old = fopen(path, "rb");
    if(f_old == NULL) return ESP_FAIL;

    data_t first_sample;
    if(fread(&first_sample, sizeof(data_t), 1, f_old) == 1) {
        *first_time = (time_t)first_sample.time_info;
    } 
    else {
        fclose(f_old);
        return ESP_FAIL;
    }
    fclose(f_old);

    // Obtener el último registro del archivo más nuevo
    snprintf(path, sizeof(path), "%s/%s", BASE_PATH, newest_file);
    FILE *f_new = fopen(path, "rb");
    if(f_new == NULL) return ESP_FAIL;

    // Nos posicionamos al final del archivo menos el tamaño de una muestra
    fseek(f_new, 0, SEEK_END);
    long file_size = ftell(f_new);
    if(file_size >= (long)sizeof(data_t)) {
        fseek(f_new, -((long)sizeof(data_t)), SEEK_END);
        data_t last_sample;
        if(fread(&last_sample, sizeof(data_t), 1, f_new) == 1) {
            *last_time = (time_t)last_sample.time_info;
        } 
        else {
            fclose(f_new);
            return ESP_FAIL;
        }
    } 
    else {
        fclose(f_new);
        return ESP_FAIL;
    }
    fclose(f_new);

    return ESP_OK;
}

int days_in_month(int year, int month) 
{
    int days[] = {31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
    
    // Verificación de año bisiesto para febrero
    if (month == 2 && ((year % 4 == 0 && year % 100 != 0) || (year % 400 == 0))) {
        return 29;
    }
    return days[month - 1];
}

void data_stg_set_mem(time_t start_time) 
{
    struct tm time_info;
    localtime_r(&start_time, &time_info);
    int current_year = time_info.tm_year + 1900;
    int current_month = time_info.tm_mon + 1;

    for(uint8_t i = 0; i < 24; i++) {
        char file_name[64];
        snprintf(file_name, sizeof(file_name), BASE_PATH "/%04d-%02d.bin", current_year, current_month);

        FILE *f = fopen(file_name, "ab");
        if(!f) {
            perror("Error al crear el archivo");
            return;   
        }

        int days = days_in_month(current_year, current_month);
        int total_records = days * 24 * 4;
        uint32_t first_time = start_time;

        // Generar y escribir los datos del mes
        for (int i = 0; i < total_records; i++) {
            data_t record;
            record.time_info = start_time;
            record.volume = 10 + (uint16_t)(rand() % 21); // Volumen simulado entre 0 y 999

            fwrite(&record, sizeof(data_t), 1, f);
            
            // Avanzar el tiempo en 900 segundos (15 minutos)
            start_time += 900; 
        }
        
        fclose(f);
        
        uint32_t last_time = start_time - 900;
        
        char first_time_str[32];
        char last_time_str[32];
        
        time_t t_first = (time_t)first_time;
        struct tm tm_first;
        localtime_r(&t_first, &tm_first);

        strftime(first_time_str, sizeof(first_time_str), "%Y-%m-%d %H:%M:%S", &tm_first);
        
        time_t t_last = (time_t)last_time;
        struct tm tm_last;
        localtime_r(&t_last, &tm_last);

        strftime(last_time_str, sizeof(last_time_str), "%Y-%m-%d %H:%M:%S", &tm_last);
        
        printf("Generado: %s | Registros: %d | Tamaño: %lu bytes\n", 
        file_name, total_records, (unsigned long)(total_records * sizeof(data_t)));
        printf("  -> Inicio: %s | Fin: %s\n\n", first_time_str, last_time_str);
        
        // Lógica para avanzar de mes y año
        current_month++;
        if (current_month > 12) {
            current_month = 1;
            current_year++;
        }
    }
}

void data_stg_info(const char *path)
{
    uint64_t total_bytes = 0;
    uint64_t free_bytes = 0;

    // Llamada nativa de ESP-IDF para obtener info de FATFS
    esp_err_t err = esp_vfs_fat_info(path, &total_bytes, &free_bytes);
    
    if (err != ESP_OK) {
        ESP_LOGE("MEMORIA", "Error al obtener info de la partición: %s", esp_err_to_name(err));
        return;
    }

    uint64_t used_bytes = total_bytes - free_bytes;

    // Conversión a Megabytes para que sea más fácil de leer
    float total_mb = (float)total_bytes / (1024.0 * 1024.0);
    float free_mb  = (float)free_bytes / (1024.0 * 1024.0);
    float used_mb  = (float)used_bytes / (1024.0 * 1024.0);
    float porcentaje = ((float)used_bytes / (float)total_bytes) * 100.0;

    ESP_LOGI("MEMORIA", "=== Estado de la partición FAT ===");
    ESP_LOGI("MEMORIA", "Espacio Total:   %llu bytes (%.2f MB)", total_bytes, total_mb);
    ESP_LOGI("MEMORIA", "Espacio Ocupado: %llu bytes (%.2f MB)", used_bytes, used_mb);
    ESP_LOGI("MEMORIA", "Espacio Libre:   %llu bytes (%.2f MB)", free_bytes, free_mb);
    ESP_LOGI("MEMORIA", "Uso de memoria:  %.1f%%", porcentaje);
    ESP_LOGI("MEMORIA", "==================================");
}
