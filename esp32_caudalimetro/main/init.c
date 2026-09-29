#include "init.h"
#include "esp_eth_phy_lan87xx.h"
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

void eth_init(esp_event_handler_t handler)
{
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    
    esp_netif_config_t cfg = ESP_NETIF_DEFAULT_ETH();
    esp_netif_t *eth_netif = esp_netif_new(&cfg);

    // Configuración MAC específica para ESP32
    eth_mac_config_t mac_config = ETH_MAC_DEFAULT_CONFIG();
    eth_esp32_emac_config_t esp32_emac_config = ETH_ESP32_EMAC_DEFAULT_CONFIG();
    
    // Pines SMI
    esp32_emac_config.smi_gpio.mdc_num = 23;
    esp32_emac_config.smi_gpio.mdio_num = 18;
    
    // NOTA: ETH_ESP32_EMAC_DEFAULT_CONFIG() ya establece por defecto 
    // el reloj RMII (EMAC_CLK_EXT_IN) de manera que se inyecta por el GPIO 0.
    // No hace falta sobreescribirlo aquí.
    
    // Configuración PHY para LAN8720
    eth_phy_config_t phy_config = ETH_PHY_DEFAULT_CONFIG();
    phy_config.phy_addr = ESP_ETH_PHY_ADDR_AUTO;
    
    // ¡CRÍTICO! Al no tener el pin RST conectado al ESP32, se debe omitir con -1
    phy_config.reset_gpio_num = -1;

    esp_eth_mac_t *mac = esp_eth_mac_new_esp32(&esp32_emac_config, &mac_config);
    esp_eth_phy_t *phy = esp_eth_phy_new_lan87xx(&phy_config);
    
    esp_eth_config_t eth_config = ETH_DEFAULT_CONFIG(mac, phy);
    esp_eth_handle_t eth_handle = NULL;
    ESP_ERROR_CHECK(esp_eth_driver_install(&eth_config, &eth_handle));

    // Adjuntar la interfaz Ethernet al stack TCP/IP
    ESP_ERROR_CHECK(esp_netif_attach(eth_netif, esp_eth_new_netif_glue(eth_handle)));

    // Registrar Handlers para eventos de Ethernet e IP
    ESP_ERROR_CHECK(esp_event_handler_register(ETH_EVENT, ESP_EVENT_ANY_ID, handler, NULL));
    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_ETH_GOT_IP, handler, NULL));

    ESP_ERROR_CHECK(esp_eth_start(eth_handle));
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

esp_err_t gpio_error_init(void)
{
    esp_err_t ret;
    gpio_config_t io_conf = {
        .pin_bit_mask = (1ULL << SNTP_ERROR_PIN),
        .mode = GPIO_MODE_OUTPUT,
    };

    // Configuramos el GPIO
    ret = gpio_config(&io_conf);
    if(ret != ESP_OK) {
        ESP_LOGE(TAG, "Error al configurar el GPIO");
        return ret;
    }
    
    io_conf.pin_bit_mask = (1ULL << WIFI_ERROR_PIN);
    ret = gpio_config(&io_conf);
    if(ret != ESP_OK) {
        ESP_LOGE(TAG, "Error al configurar el GPIO");
        return ret;
    }

    io_conf.pin_bit_mask = (1ULL << FLASH_ERROR_PIN);
    ret = gpio_config(&io_conf);
    if(ret != ESP_OK) {
        ESP_LOGE(TAG, "Error al configurar el GPIO");
        return ret;
    }

    return ESP_OK;
}

/**
 * @brief Inicializa el servicio mDNS y anuncia el servidor TCP
 * @param[in] hostname Nombre del dispositivo (ej. "caudalimetro" -> caudalimetro.local)
 * @param[in] instance_name Nombre descriptivo para el descubrimiento en red
 * @retval ESP_OK Inicialización correcta
 */
esp_err_t mdns_server_init(const char *hostname, const char *instance_name)
{
    // Inicializar el demonio mDNS
    esp_err_t err = mdns_init();
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Error al inicializar mDNS: %s", esp_err_to_name(err));
        return err;
    }

    // Configurar el hostname (lo que va antes de .local)
    mdns_hostname_set(hostname);
    
    // Configurar el nombre de la instancia 
    mdns_instance_name_set(instance_name);

    // Anunciar el servicio HTTP de tu datalogger para que la GUI lo descubra automáticamente
    // Formato: instance_name, service_type, proto, port, txt_data, num_items
    mdns_service_add(instance_name, "_http", "_tcp", HTTP_PORT, NULL, 0);

    ESP_LOGI(TAG, "mDNS inicializado. Accesible en: %s.local", hostname);
    
    return ESP_OK;
}

void ota_tcp_recv(int sock, size_t file_size)
{
    ESP_LOGI(TAG, "Iniciando OTA por TCP. Tamaño esperado: %zu bytes", file_size);

    // Encuentra la partición disponible para actualizar
    const esp_partition_t *update_partition = esp_ota_get_next_update_partition(NULL);
    if(update_partition == NULL) {
        ESP_LOGE(TAG, "No se encontró partición OTA pasiva");
        return;
    }

    ESP_LOGI(TAG, "Escribiendo en partición: %s", update_partition->label);

    esp_ota_handle_t update_handle = 0;
    // Inicia el OTA
    esp_err_t err = esp_ota_begin(update_partition, OTA_WITH_SEQUENTIAL_WRITES, &update_handle);
    if(err != ESP_OK) {
        ESP_LOGE(TAG, "Error en esp_ota_begin: %s", esp_err_to_name(err));
        return;
    }

    char ota_buff[1024];
    int rx_bytes;
    size_t total_received = 0;

    // Leemos los datos enviados y los vamos escribiendo hasta que llegue todo el archivo
    while(total_received < file_size) {
        rx_bytes = recv(sock, ota_buff, sizeof(ota_buff), 0);
        if(rx_bytes < 0) {
            ESP_LOGE(TAG, "Error de red durante la descarga OTA");
            break;
        } 
        else if(rx_bytes > 0) {
            err = esp_ota_write(update_handle, (const void *)ota_buff, rx_bytes);
            if(err != ESP_OK) {
                ESP_LOGE(TAG, "Error escribiendo en Flash: %s", esp_err_to_name(err));
                break;
            }
            total_received += rx_bytes;
        }
    }

    // Se verifica el tamaño recibido y selecciona la partición a bootear
    if(total_received == file_size) {
        ESP_LOGI(TAG, "Descarga completa");
        err = esp_ota_end(update_handle);
        if(err == ESP_OK) {
            err = esp_ota_set_boot_partition(update_partition);
            if(err == ESP_OK) {
                ESP_LOGI(TAG, "¡OTA Exitoso! Reiniciando en 2 segundos...");
                // IMPORTANTE: Envía una confirmación al cliente de que todo salió bien
                char success_msg[] = "OTA_OK";
                send_all(sock, success_msg, strlen(success_msg));
                
                vTaskDelay(pdMS_TO_TICKS(2000));
                esp_restart();
            }
        } 
        else {
            ESP_LOGE(TAG, "Error al finalizar OTA: %s", esp_err_to_name(err));
        }
    } 
    else {
        ESP_LOGE(TAG, "Descarga incompleta. Recibidos: %zu / Esperados: %zu", total_received, file_size);
        esp_ota_abort(update_handle);
    }
}
