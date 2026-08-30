#include "timestamp.h"
#include "esp_log.h"

static const char *TAG = "TIMESTAMP";

esp_err_t timestamp_init(void) 
{
    // Se configura polling (esp consulta la hora)
    esp_sntp_setoperatingmode(SNTP_OPMODE_POLL); 

    // Servidor principal
    esp_sntp_setservername(0, "pool.ntp.org"); 

    // Servidor de respaldo
    esp_sntp_setservername(1, "time.windows.com"); 

    // Inicia el SNTP
    esp_sntp_init();

    // Configurar zona horaria Argentina
    setenv("TZ", "ART3", 1); 
    tzset(); 
    
    ESP_LOGI(TAG, "sntp inicializado correctamente");
    return ESP_OK;
}

TickType_t timestamp_delay(uint32_t delay)
{
    time_t current_time;
    
    // Obtenemos la hora actual
    time(&current_time);

    // Calculamos los segundos a demorar
    uint32_t wait_time = delay - (current_time % delay);

    // Retornamos los ticks a demorar
    return pdMS_TO_TICKS(wait_time * 1000);
}
