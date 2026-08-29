#include <stdio.h>

#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

#include "esp_log.h"

#include "data_stg.h"
#include "timestamp.h"
#include "init.h"

static const char *TAG = "MAIN";

SemaphoreHandle_t liter_count;

void task_datalogger(void *params)
{
    data_t data = {.time_info = 0, .volume = 0};
    uint16_t volume;
    bool sntp = false;

    while(1) {
        vTaskDelay(timestamp_delay(INTERVAL_SEC));

        time(&data.time_info);
        data.volume += uxSemaphoreGetCount(liter_count);
        if(data.time_info > 1000) sntp = true;
        else sntp = false;

        // Verificamos sntp 
        if(data.time_info > 1000) {
            data_stg_write_measurement(&data);
            data.volume = 0;
        }
        else {
            // Indicar el led el error
        }
    }
}

void app_main(void)
{
    data_t data;
    data_t buffer[BUFFER_SIZE];

    ESP_LOGI(TAG, "Montando sistema de archivos FAT");
    ESP_ERROR_CHECK(data_stg_mount());

    ESP_LOGI(TAG, "Inicializando sntp");
    ESP_ERROR_CHECK(timestamp_init());

    liter_count = xSemaphoreCreateCounting(INTERVAL_MAX_LITER * 1.2, 0);

    xTaskCreate(
        task_datalogger,
        "task_datalogger",
        1024,
        NULL,
        1,
        NULL
    );
}
