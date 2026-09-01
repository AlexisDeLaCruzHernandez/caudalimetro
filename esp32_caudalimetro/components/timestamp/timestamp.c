#include "timestamp.h"
#include "esp_log.h"

static const char *TAG = "TIMESTAMP";
static time_t last_sync_time = 0; // Guarda la marca de tiempo de la última sincronización

// Callback invocado automáticamente por ESP-IDF cuando SNTP obtiene la hora
static void time_sync_notification_cb(struct timeval *tv)
{
    time(&last_sync_time);
    ESP_LOGI(TAG, "Hora sincronizada exitosamente");
}

esp_err_t timestamp_init(void) 
{
    // Se configura polling (esp consulta la hora)
    esp_sntp_setoperatingmode(SNTP_OPMODE_POLL); 

    // Servidor principal
    esp_sntp_setservername(0, "pool.ntp.org"); 

    // Servidor de respaldo
    esp_sntp_setservername(1, "time.windows.com"); 

    // Registrar callback de notificación antes de inicializar
    sntp_set_time_sync_notification_cb(time_sync_notification_cb);

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

bool sntp_is_sync_valid(uint32_t max_age_sec)
{
    if (last_sync_time == 0) {
        return false; // Nunca ha sincronizado desde que arrancó el sistema
    }

    time_t current_time;
    time(&current_time);

    // Evalúa si la última sincronización fue dentro del margen permitido
    return ((current_time - last_sync_time) <= max_age_sec);
}
