#include <stdio.h>

#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/queue.h"

#include "esp_log.h"

#include "data_stg.h"
#include "timestamp.h"
#include "init.h"

static const char *TAG = "MAIN";

SemaphoreHandle_t caudal_switch;
QueueHandle_t liter_count;

static void IRAM_ATTR gpio_isr_handler(void *arg)
{
    BaseType_t xHigherPriorityTaskWoken = pdFALSE;
    gpio_intr_disable(CAUDAL_PIN);
    xSemaphoreGiveFromISR(caudal_switch, &xHigherPriorityTaskWoken);
    portYIELD_FROM_ISR(xHigherPriorityTaskWoken);
}

void task_caudal(void *params)
{
    uint16_t volume = 0;
    while(1) {
        xSemaphoreTake(caudal_switch, portMAX_DELAY);
        vTaskDelay(pdMS_TO_TICKS(DEBOUNCE_TIME_MS));
        if(gpio_get_level(CAUDAL_PIN) == 0) {
            if(xQueuePeek(liter_count, &volume, 0) == pdFALSE) volume = 0;
            volume++;
            ESP_LOGI(TAG, "Litro contado");
            xQueueOverwrite(liter_count, &volume);
        }
        gpio_intr_enable(CAUDAL_PIN);
    }
}

void task_datalogger(void *params)
{
    data_t data = {.time_info = 0, .volume = 0};
    time_t time_info;
    uint16_t volume = 0;

    while(1) {
        vTaskDelay(timestamp_delay(INTERVAL_SEC));

        time(&time_info);
        data.time_info = (uint32_t)time_info;
        if(xQueueReceive(liter_count, &volume, 0) == pdFALSE) volume = 0;
        data.volume += volume;

        // Verificamos sntp sincronizado
        if(sntp_get_sync_status() == SNTP_SYNC_STATUS_COMPLETED) {
            data_stg_write_measurement(&data);
            data.volume = 0;
            // Indicar en led correcto
        }
        else {
            // Indicar en led el error
        }
    }
}

void app_main(void)
{
    ESP_LOGI(TAG, "Montando sistema de archivos FAT");
    ESP_ERROR_CHECK(data_stg_mount());

    ESP_LOGI(TAG, "Inicializando sntp");
    ESP_ERROR_CHECK(timestamp_init());

    ESP_LOGI(TAG, "Inicializando gpio caudalimetro");
    ESP_ERROR_CHECK(gpio_caudal_init(gpio_isr_handler));

    liter_count = xQueueCreate(1, sizeof(uint16_t));

    xTaskCreate(task_caudal, "task_caudal", 1024, NULL, 1, NULL);
    xTaskCreate(task_datalogger, "task_datalogger", 1024, NULL, 1, NULL);
}
