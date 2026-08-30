#include "init.h"
#include "esp_log.h"

static const char *TAG = "INIT";

void borrar_todos_los_archivos(const char *path) 
{
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

esp_err_t gpio_caudal_init(gpio_isr_t isr_handler)
{
    esp_err_t ret;
    gpio_config_t io_conf = {
        .pin_bit_mask = (1ULL << CAUDAL_PIN),
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = 1,               // Pull up
        .pull_down_en = 0,
        .intr_type = GPIO_INTR_NEGEDGE // Interrupción flanco descendente
    };

    // Configuramos el GPIO
    ret = gpio_config(&io_conf);
    if(ret != ESP_OK) {
        ESP_LOGE(TAG, "Error al configurar el GPIO");
        return ret;
    }

    // Instalamos las interrupciones
    ret = gpio_install_isr_service(0);
    if(ret != ESP_OK) {
        ESP_LOGE(TAG, "Error al instalar las interrupciones");
        return ret;
    }
    
    // Añadimos el handler de interrupción
    ret = gpio_isr_handler_add(CAUDAL_PIN, isr_handler, NULL);
    if(ret != ESP_OK) {
        ESP_LOGE(TAG, "Error al añadir el handler de interrupción");
        return ret;
    }

    return ESP_OK;
}
