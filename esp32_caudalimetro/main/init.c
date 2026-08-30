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

void wifi_init_sta(EventGroupHandle_t *wifi_event, esp_event_handler_t handler)
{
    *wifi_event = xEventGroupCreate(); // Crea el event group 
    ESP_ERROR_CHECK(esp_netif_init()); // Inicializa la pila de red TCP/IP
    ESP_ERROR_CHECK(esp_event_loop_create_default()); // Crea loop de eventos para distribuirlos 
    esp_netif_create_default_wifi_sta(); // Crea la interfaz de red para el modo STA

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT(); // Obtiene la configuración por defecto para inicializar el Wi-Fi
    ESP_ERROR_CHECK(esp_wifi_init(&cfg)); // Inicializa el Wi-Fi

    // Registra el Handler para eventos relacionados a la conexión Wi-Fi
    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, handler, NULL));
    // Registra el Handler para eventos relacionados con la dirección IP
    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, handler, NULL));

    wifi_config_t wifi_config = { // Configuración de la red Wi-Fi
        .sta = {
            .ssid = WIFI_SSID,
            .password = WIFI_PASS,
        },
    };

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA)); // Indica el modo STA
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config)); // Carga la configuración de la red
    ESP_ERROR_CHECK(esp_wifi_start()); // Inicia el controlador de Wi-Fi, provoca WIFI_EVENT_STA_START
}

void gpio_caudal_init(gpio_isr_t isr_handler)
{
    gpio_config_t io_conf = {
        .pin_bit_mask = (1ULL << CAUDAL_PIN),
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = 1,               // Activamos pull-up interno
        .pull_down_en = 0,
        .intr_type = GPIO_INTR_NEGEDGE // ¡CLAVE! Solo interrumpe al bajar el flanco
    };
    gpio_config(&io_conf);

    // 4. Instalamos el servicio global de interrupciones
    // El parámetro (0) indica que no estamos pasando flags especiales de asignación
    gpio_install_isr_service(0);
    
    // 5. Enganchamos nuestra ISR específica al pin del botón
    gpio_isr_handler_add(CAUDAL_PIN, isr_handler, NULL);
}
