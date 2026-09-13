idf_component_register(
    SRCS "main.c" "init.c" "http_server.c"
    INCLUDE_DIRS "."
    REQUIRES
        data_stg
        timestamp
        nvs_flash 
        esp_wifi
        app_update
        mdns
        esp_http_server
)
