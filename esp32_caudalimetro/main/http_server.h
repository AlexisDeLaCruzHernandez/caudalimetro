#ifndef HTTP_SERVER_H
#define HTTP_SERVER_H

#include "esp_http_server.h"

/**
 * @brief Inicializa el servidor HTTP RESTful en el puerto 80 y registra las rutas /api/v1/range, /api/v1/data, /api/v1/ota
 * @return httpd_handle_t Manejador del servidor HTTP o NULL en caso de error
 */
httpd_handle_t start_webserver(void);

/**
 * @brief Detiene el servidor HTTP
 * @param[in] server Manejador del servidor HTTP a detener
 */
void stop_webserver(httpd_handle_t server);

#endif // HTTP_SERVER_H
