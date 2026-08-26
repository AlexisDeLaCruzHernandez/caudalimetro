#include "init.h"
#include "esp_log.h"

static const char *TAG = "INIT";

esp_err_t init_sd_card(sd_card_config_t *sd_card_config) 
{
    sd_card_config->base_path = MOUNT_POINT;

    sd_card_config->host_config_input = (sdmmc_host_t)SDSPI_HOST_DEFAULT();

    sd_card_config->slot_config = (sdspi_device_config_t)SDSPI_DEVICE_CONFIG_DEFAULT();
    sd_card_config->slot_config.gpio_cs = PIN_NUM_CS;
    sd_card_config->slot_config.host_id = sd_card_config->host_config_input.slot;

    sd_card_config->mount_config.format_if_mount_failed = false;
    sd_card_config->mount_config.max_files = 1;
    sd_card_config->mount_config.allocation_unit_size = 16 * 1024;

    spi_bus_config_t bus_config = {
        .mosi_io_num = PIN_NUM_MOSI,
        .miso_io_num = PIN_NUM_MISO,
        .sclk_io_num = PIN_NUM_SCK,
        .quadwp_io_num = -1,
        .quadhd_io_num = -1,
        .max_transfer_sz = 4 * 1024,
    };

    esp_err_t ret = spi_bus_initialize(sd_card_config->host_config_input.slot, &bus_config, SDSPI_DEFAULT_DMA);
    if(ret == ESP_OK) ESP_LOGI(TAG, "sd_card_config y bus spi inicializados");
    return ret;
}