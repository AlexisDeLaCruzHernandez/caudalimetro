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

bool recv_all(int sock, void *buffer, size_t length) 
{ 
    uint8_t *ptr = (uint8_t *)buffer; 
    size_t received = 0; 
    while(received < length) { 
        int ret = recv(sock, ptr + received, length - received, 0); 
        if(ret == 0) { 
            // El cliente cerró la conexión antes de completar el mensaje 
            ESP_LOGW(TAG, "Cliente cerró la conexión durante recv()"); 
            return false; 
        } 
        if(ret < 0) { 
            if(errno == EINTR) { 
                // La llamada fue interrumpida; simplemente reintentar 
                continue; 
            } 
            ESP_LOGE(TAG, "recv() fallo: errno=%d (%s)", errno, strerror(errno)); 
            return false; 
        } 
        received += (size_t)ret; 
    } 
    return true; 
}

bool send_all(int sock, const void *buffer, size_t length) 
{ 
    const uint8_t *ptr = (const uint8_t *)buffer; 
    size_t sent = 0; 
    while(sent < length) { 
        int ret = send(sock, ptr + sent, length - sent, 0); 
        if(ret < 0) { 
            if(errno == EINTR) { 
                continue; 
            } 
            ESP_LOGE(TAG, "send() fallo: errno=%d (%s)", errno, strerror(errno)); 
            return false; 
        } 
        if(ret == 0) { 
            ESP_LOGE(TAG, "send() devolvio 0"); 
            return false; 
        } 
        sent += (size_t)ret; 
    } 
    return true; 
}
