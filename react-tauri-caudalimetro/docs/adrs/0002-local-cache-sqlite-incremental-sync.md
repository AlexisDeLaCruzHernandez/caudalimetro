# ADR 0002: Estrategia de Caché Local con SQLite y Sincronización Incremental

* **Estado**: Aceptado
* **Fecha**: 2026-09-02
* **Autor**: Antigravity & Equipo LSE Caudalímetro

## Contexto y Problema
El dispositivo ESP32 almacena hasta 3 o más meses de datos de caudalimetría en su memoria flash (LittleFS). La transferencia de varios meses de datos mediante la conexión TCP local en cada consulta genera un uso innecesario de ancho de banda, consumo de batería/CPU en el ESP32 y latencia en la interfaz de usuario. 
Se requiere una solución de caché persistente local en la aplicación Tauri para almacenar las muestras ya descargadas e implementar una sincronización eficiente.

## Decisiones Evaluadas
1. **IndexedDB / LocalStorage en Frontend**: Fácil implementación pero vulnerable a limpieza de datos del navegador de Tauri, menor rendimiento en consultas por rango de fecha para grandes conjuntos de muestras.
2. **Archivos binarios / JSON locales**: Dificultad para indexar por timestamp y consultar rangos heterogéneos eficientemente.
3. **Base de datos SQLite local con Sincronización Incremental (Elegida)**:
   - Uso de SQLite (vía `tauri-plugin-sql` o `rusqlite` en Rust) integrada en la aplicación de escritorio.
   - Esquema con tabla de dispositivos y tabla de muestras: `samples(device_id, timestamp, volume, PRIMARY KEY(device_id, timestamp))`.
   - **Algoritmo de Sincronización Incremental**:
     1. La aplicación consulta el rango de timestamps disponible en el ESP32 (`first_ts`, `last_ts`).
     2. Consulta en la BD SQLite local el último timestamp guardado para ese `device_id`.
     3. Si `last_local_ts < last_ts`, la aplicación solo solicita al ESP32 el rango de muestras comprendido entre `last_local_ts + 1` y `last_ts`.
     4. Inserta en bloque (batch insert / transacción) las nuevas muestras en SQLite.
     5. Las consultas de visualización en React se responden directamente desde SQLite local de forma casi instantánea.

## Consecuencias
* **Positivas**:
  - Tiempos de respuesta extremadamente rápidos (< 10ms) para renderizar gráficos históricos en React.
  - Minimiza drásticamente el tráfico TCP y la carga de lectura en la Flash del ESP32.
  - Garantiza integridad relacional y deduplicación de muestras gracias a claves primarias compuestas (`device_id`, `timestamp`).
  - Funciona de forma totalmente offline una vez sincronizados los datos.
* **Negativas / Desafíos**:
  - Requiere administrar migraciones de base de datos SQLite en Tauri si el esquema evoluciona en el futuro.
