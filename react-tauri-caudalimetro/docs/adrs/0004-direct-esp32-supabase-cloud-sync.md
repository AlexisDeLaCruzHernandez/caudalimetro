# ADR 0004: Sincronización Nube Directa del ESP32 a Supabase PostgreSQL

* **Estado**: Aceptado
* **Fecha**: 2026-09-02
* **Autor**: Antigravity & Equipo LSE Caudalímetro

## Contexto y Problema
Se requiere disponibilizar opcionalmente la información del caudalímetro a través de Internet para acceso en la web u otros clientes remotos. Existen dos enfoques principales: usar la aplicación de escritorio Tauri como intermediario (gateway) o conectar directamente el dispositivo ESP32 a servicios en la nube.

## Decisiones Evaluadas
1. **App de Escritorio como Gateway de Sincronización**: La app Tauri lee por TCP local del ESP32 y sube a Supabase. Depende de que una computadora con la app abierta esté encendida en la red local.
2. **Conexión Directa ESP32 -> Supabase via HTTPS REST / WebSockets (Elegida)**:
   - El ESP32 se conecta directamente a la API REST de Supabase (`POST /rest/v1/samples`) o WebSocket/MQTT utilizando cliente HTTPS de `esp-idf` (`esp_http_client`).
   - La aplicación de usuario (Tauri Desktop o Web SPA) puede consultar los datos directamente desde Supabase PostgreSQL cuando se encuentra fuera de la red local o cuando el usuario prefiera el modo nube.
   - En red local, la app Tauri mantiene su comunicación directa por TCP (puerto 3333) y caché local SQLite descrita en ADR 0001 y ADR 0002.

## Consecuencias
* **Positivas**:
  - Desacoplamiento total: No se requiere que la aplicación de escritorio Tauri permanezca encendida para que la nube reciba datos.
  - La aplicación Tauri (o una web SPA) puede actuar en modo "Local" (vía mDNS/TCP/SQLite) o en modo "Remoto" (vía cliente JS de Supabase).
* **Negativas / Desafíos**:
  - El firmware ESP32 debe manejar conexión WiFi con salida a Internet, TLS/SSL (certificados) y reconexión automática frente a caídas del servicio web.
