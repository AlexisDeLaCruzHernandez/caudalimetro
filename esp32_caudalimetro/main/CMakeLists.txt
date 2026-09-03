idf_component_register(
    SRCS "init.c" "main.c"
    INCLUDE_DIRS "."
    REQUIRES
        data_stg
        timestamp
        nvs_flash 
        esp_wifi
        mdns
)
