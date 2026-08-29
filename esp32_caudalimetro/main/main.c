#include <stdio.h>

#include "esp_log.h"

#include "data_stg.h"
#include "init.h"

#include <dirent.h>

static const char *TAG = "MAIN";

void borrar_todos_los_archivos(const char *path) {
    DIR *dir = opendir(path);
    if (dir == NULL) return;

    struct dirent *entry;
    char filepath[300];

    ESP_LOGI(TAG, "--- Eliminando todos los archivos ---");
    while ((entry = readdir(dir)) != NULL) {
        if (strcmp(entry->d_name, ".") == 0 || strcmp(entry->d_name, "..") == 0) continue;
        snprintf(filepath, sizeof(filepath), "%s/%s", path, entry->d_name);
        remove(filepath);
    }
    closedir(dir);
}

void app_main(void)
{
    data_t data;
    data_t buffer[BUFFER_SIZE];

    ESP_LOGI(TAG, "Montando sistema de archivos FAT");
    ESP_ERROR_CHECK(data_stg_mount());

    // borrar_todos_los_archivos(BASE_PATH);

    data.volume = 10;
    struct tm initial_time = {
        .tm_year = 2026 - 1900,
        .tm_mon = 10 - 1,
        .tm_mday = 1,
        .tm_hour = 0,
        .tm_min = 0,
        .tm_sec = 0,
    };
    data.time_info = (uint32_t)mktime(&initial_time);

    uint32_t time_interval = 30 * 24 * 60 * 60; // 30 días del mes

    ESP_LOGI(TAG, "Escribiendo datos");

    time_t time_sec = (time_t)data.time_info;
    struct tm time;
    localtime_r(&time_sec, &time);
    ESP_LOGI(TAG, "Fecha inicial: [%04d/%02d/%02d %02d:%02d:%02d]", 
        time.tm_year + 1900, time.tm_mon + 1, time.tm_mday, 
        time.tm_hour, time.tm_min, time.tm_sec
    );

    for(uint32_t i = 0; i < time_interval / INTERVAL_SEC; i++) {
        // data_stg_write_measurement(&data);
        data.time_info += INTERVAL_SEC;
    }

    time_sec = (time_t)data.time_info;
    localtime_r(&time_sec, &time);
    ESP_LOGI(TAG, "Fecha final: [%04d/%02d/%02d %02d:%02d:%02d]", 
        time.tm_year + 1900, time.tm_mon + 1, time.tm_mday, 
        time.tm_hour, time.tm_min, time.tm_sec
    );

    time_t start_time = mktime(&initial_time);
    time_t end_time = time_sec -= INTERVAL_SEC;

    ESP_LOGI(TAG, "Leyendo datos");
    size_t items_read = 0, total_read = 0;
    while(start_time != end_time) {
        data_stg_read_range(&start_time, &end_time, buffer, BUFFER_SIZE, &items_read);
        ESP_LOGI(TAG, "Leidos: %d", items_read);
        if(total_read == 0) {
            time_sec = (time_t)buffer[0].time_info;
            localtime_r(&time_sec, &time);
            ESP_LOGI(TAG, "Primer leido: [%04d/%02d/%02d %02d:%02d:%02d] %d", 
                time.tm_year + 1900, time.tm_mon + 1, time.tm_mday, 
                time.tm_hour, time.tm_min, time.tm_sec, buffer[0].volume
            );
        }
        total_read += items_read;
    }
    ESP_LOGI(TAG, "Leidos totales: %d", total_read);
    time_sec = (time_t)buffer[items_read - 1].time_info;
    localtime_r(&time_sec, &time);
    ESP_LOGI(TAG, "Ultimo leido: [%04d/%02d/%02d %02d:%02d:%02d] %d", 
        time.tm_year + 1900, time.tm_mon + 1, time.tm_mday, 
        time.tm_hour, time.tm_min, time.tm_sec, buffer[items_read - 1].volume
    );

    while(1) {
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}
