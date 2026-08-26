#include <stdio.h>

#include "sd_card.h"
#include "init.h"

static const char *TAG = "MAIN";

void app_main(void)
{
    data_t data;
    sd_card_config_t sd_card_config;
    ESP_ERROR_CHECK(init_sd_card(&sd_card_config));

    while(sd_card_mount(&sd_card_config) != ESP_OK) {
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
    
    data.volume = 0;
    data.time_info.tm_year = 126;
    data.time_info.tm_mon = 7;
    data.time_info.tm_mday = 20;
    data.time_info.tm_hour = 0;
    data.time_info.tm_min = 0;
    data.time_info.tm_sec = 0;
    /*
    for(uint32_t i = 0; i < 1000; i++) {
        sd_card_write_measurement(&data);
        data.volume += 10;
        data.time_info.tm_min += 15;
        if(data.time_info.tm_min == 60) {
            data.time_info.tm_min = 0;
            data.time_info.tm_hour++;
            if(data.time_info.tm_hour == 24) {
                data.time_info.tm_hour = 0;
                data.time_info.tm_mday++;
            }
        }
    }
    */

    struct tm start_date = {
        .tm_hour = 0,
        .tm_min = 0,
        .tm_sec = 0,
        .tm_mday = 20,
        .tm_mon = 7,
        .tm_year = 126,
    };
    struct tm end_date = {
        .tm_hour = 9,
        .tm_min = 45,
        .tm_sec = 0,
        .tm_mday = 30,
        .tm_mon = 7,
        .tm_year = 126,
    };

    sdmmc_card_print_info(stdout, sd_card_config.card);

    ESP_LOGI(TAG, "Comienzo lectura");
    sd_card_read_range(&start_date, &end_date);

    esp_vfs_fat_sdcard_unmount(sd_card_config.base_path, sd_card_config.card);
    ESP_LOGI(TAG, "SD desmontada");

    spi_bus_free(sd_card_config.host_config_input.slot);

    while(1) {
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}
