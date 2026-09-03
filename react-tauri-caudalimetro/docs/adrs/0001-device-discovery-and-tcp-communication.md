# ADR 0001: Descubrimiento de Dispositivos (mDNS) y Comunicación TCP Binaria en Tauri

* **Estado**: Aceptado
* **Fecha**: 2026-09-02
* **Autor**: Antigravity & Equipo LSE Caudalímetro

## Contexto y Problema
El firmware ESP32 expone un servidor TCP en el puerto 3333 que opera con un protocolo binario (mensajes empaquetados en Big-Endian de `struct` de timestamps y volúmenes). Además, los dispositivos se anuncian en la red local mediante mDNS. 
La aplicación de usuario desarrollada en Tauri + React TS necesita descubrir los dispositivos disponibles en la red local y consultar sus rangos de fechas e historial de mediciones de manera confiable, eficiente y segura.

## Decisiones Evaluadas
1. **Comunicación y mDNS pura en frontend**: No viable por restricciones del sandbox del navegador en Tauri (sin acceso directo a sockets TCP ni mDNS nativo).
2. **Descubrimiento mDNS y cliente TCP exclusivamente en Rust backend**: Muy eficiente y seguro, pero puede complicar las pruebas en entornos donde mDNS esté bloqueado por routers o en entornos de desarrollo local.
3. **Descubrimiento mDNS + Cliente TCP binario en Rust con Fallback a IP/Hostname Manual (Elegida)**: 
   - El backend en Rust (usando `tokio::net::TcpStream` y crates de mDNS como `mdns-sd` o `zeroconf`) gestiona el descubrimiento automático y el parsing del protocolo binario (`!II` para rango, `!IH` para muestras de 6 bytes).
   - Se expone una interfaz a React mediante Tauri Commands.
   - Se incluye soporte explícito para agregar dispositivos manualmente ingresando IP o Hostname temporal (ideal para debugging y redes con mDNS deshabilitado).

## Consecuencias
* **Positivas**:
  - El desempaquetado binario (`data_t` de 6 bytes) ocurre en Rust a alta velocidad sin sobrecargar la memoria JS/React.
  - La interfaz de React interactúa con TypeScript interfaces fuemente tipadas (`Device`, `DateRange`, `Sample`).
  - Flexibilidad total en desarrollo y debugging al permitir conexión directa por IP manual.
* **Negativas / Desafíos**:
  - Requiere mantener los tipos binarios sincronizados en Rust (`byteorder` crate) con la definición del firmware ESP32 (`data_t`).
