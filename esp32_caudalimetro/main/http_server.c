#include "http_server.h"
#include "esp_log.h"
#include "esp_ota_ops.h"
#include "esp_system.h"
#include "lwip/sockets.h"
#include "data_stg.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <sys/param.h>

static const char *TAG = "HTTP_SERVER";

extern TaskHandle_t h_datalogger;

/* Handler para GET /api/v1/range */
static esp_err_t range_handler(httpd_req_t *req)
{
    time_t first_time = 0;
    time_t last_time = 0;
    data_stg_get_time_range(&first_time, &last_time);

    char json_response[128];
    snprintf(json_response, sizeof(json_response),
             "{\"first_time\":%lu,\"last_time\":%lu}",
             (unsigned long)first_time, (unsigned long)last_time);

    httpd_resp_set_type(req, "application/json");
    httpd_resp_send(req, json_response, HTTPD_RESP_USE_STRLEN);
    return ESP_OK;
}

/* Handler para GET /api/v1/data?start=X&end=Y */
static esp_err_t data_handler(httpd_req_t *req)
{
    char query[128];
    time_t start_time = 0;
    time_t end_time = 0;

    if (httpd_req_get_url_query_str(req, query, sizeof(query)) == ESP_OK) {
        char param[32];
        if (httpd_query_key_value(query, "start", param, sizeof(param)) == ESP_OK) {
            start_time = (time_t)strtoul(param, NULL, 10);
        }
        if (httpd_query_key_value(query, "end", param, sizeof(param)) == ESP_OK) {
            end_time = (time_t)strtoul(param, NULL, 10);
        }
    }

    ESP_LOGI(TAG, "GET /api/v1/data - start: %lu, end: %lu", (unsigned long)start_time, (unsigned long)end_time);

    httpd_resp_set_type(req, "application/octet-stream");

    data_t buffer[64];
    size_t items_read = 0;

    while (start_time != end_time) {
        esp_err_t err = data_stg_read_range(&start_time, &end_time, buffer, 64, &items_read);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "Error leyendo muestras de storage");
            break;
        }

        if (items_read > 0) {
            for (size_t i = 0; i < items_read; i++) {
                buffer[i].time_info = htonl(buffer[i].time_info);
                buffer[i].volume = htons(buffer[i].volume);
            }
            if (httpd_resp_send_chunk(req, (const char *)buffer, items_read * sizeof(data_t)) != ESP_OK) {
                ESP_LOGE(TAG, "Error enviando chunk de muestras HTTP");
                break;
            }
        }
    }

    httpd_resp_send_chunk(req, NULL, 0); // Fin de respuesta chunked
    return ESP_OK;
}

/* Handler para POST /api/v1/ota */
static esp_err_t ota_handler(httpd_req_t *req)
{
    ESP_LOGI(TAG, "Iniciando descarga OTA via HTTP POST. Tamaño esperado: %zu bytes", req->content_len);

    const esp_partition_t *update_partition = esp_ota_get_next_update_partition(NULL);
    if (update_partition == NULL) {
        ESP_LOGE(TAG, "No se encontró partición OTA pasiva");
        httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "No passive OTA partition found");
        return ESP_FAIL;
    }

    if (req->content_len > update_partition->size) {
        ESP_LOGE(TAG, "El archivo supera el tamaño de la partición (max: %zu)", update_partition->size);
        httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "Firmware size exceeds partition capacity");
        return ESP_FAIL;
    }

    if (h_datalogger != NULL) {
        vTaskSuspend(h_datalogger);
    }

    esp_ota_handle_t update_handle = 0;
    esp_err_t err = esp_ota_begin(update_partition, OTA_WITH_SEQUENTIAL_WRITES, &update_handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Error en esp_ota_begin: %s", esp_err_to_name(err));
        if (h_datalogger != NULL) vTaskResume(h_datalogger);
        httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "esp_ota_begin failed");
        return ESP_FAIL;
    }

    char ota_buff[1024];
    int received = 0;
    size_t total_received = 0;
    size_t file_size = req->content_len;

    while (total_received < file_size) {
        received = httpd_req_recv(req, ota_buff, MIN(sizeof(ota_buff), file_size - total_received));
        if (received <= 0) {
            if (received == HTTPD_SOCK_ERR_TIMEOUT) {
                continue;
            }
            ESP_LOGE(TAG, "Error de red recibiendo binario OTA");
            esp_ota_abort(update_handle);
            if (h_datalogger != NULL) vTaskResume(h_datalogger);
            httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "Network receive error during OTA");
            return ESP_FAIL;
        }

        err = esp_ota_write(update_handle, (const void *)ota_buff, received);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "Error escribiendo en Flash OTA: %s", esp_err_to_name(err));
            esp_ota_abort(update_handle);
            if (h_datalogger != NULL) vTaskResume(h_datalogger);
            httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "Flash write error");
            return ESP_FAIL;
        }

        total_received += received;
    }

    err = esp_ota_end(update_handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Error en esp_ota_end: %s", esp_err_to_name(err));
        if (h_datalogger != NULL) vTaskResume(h_datalogger);
        httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "esp_ota_end failed");
        return ESP_FAIL;
    }

    err = esp_ota_set_boot_partition(update_partition);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Error estableciendo partición de inicio: %s", esp_err_to_name(err));
        if (h_datalogger != NULL) vTaskResume(h_datalogger);
        httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "esp_ota_set_boot_partition failed");
        return ESP_FAIL;
    }

    ESP_LOGI(TAG, "¡OTA completado con éxito! Reiniciando en 2 segundos...");
    httpd_resp_set_type(req, "application/json");
    httpd_resp_sendstr(req, "{\"status\":\"OTA_OK\"}");

    vTaskDelay(pdMS_TO_TICKS(2000));
    esp_restart();
    return ESP_OK;
}

httpd_handle_t start_webserver(void)
{
    httpd_handle_t server = NULL;
    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.server_port = 80;
    config.ctrl_port = 32768;
    config.max_uri_handlers = 8;
    config.recv_wait_timeout = 30; // 30s timeout para prevenir interrupciones en OTA
    config.send_wait_timeout = 30;

    ESP_LOGI(TAG, "Iniciando Servidor HTTP en puerto %d", config.server_port);
    if (httpd_start(&server, &config) == ESP_OK) {
        httpd_uri_t uri_range = {
            .uri       = "/api/v1/range",
            .method    = HTTP_GET,
            .handler   = range_handler,
            .user_ctx  = NULL
        };
        httpd_register_uri_handler(server, &uri_range);

        httpd_uri_t uri_data = {
            .uri       = "/api/v1/data",
            .method    = HTTP_GET,
            .handler   = data_handler,
            .user_ctx  = NULL
        };
        httpd_register_uri_handler(server, &uri_data);

        httpd_uri_t uri_ota = {
            .uri       = "/api/v1/ota",
            .method    = HTTP_POST,
            .handler   = ota_handler,
            .user_ctx  = NULL
        };
        httpd_register_uri_handler(server, &uri_ota);

        ESP_LOGI(TAG, "Routers HTTP registrados: /api/v1/range, /api/v1/data, /api/v1/ota");
        return server;
    }

    ESP_LOGE(TAG, "Error iniciando servidor HTTP");
    return NULL;
}

void stop_webserver(httpd_handle_t server)
{
    if (server) {
        httpd_stop(server);
    }
}
