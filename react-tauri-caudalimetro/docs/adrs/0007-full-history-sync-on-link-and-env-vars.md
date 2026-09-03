# ADR 0007: Ingesta de Historial Completo al Vincular y Configuración por Variables de Entorno (.env)

* **Estado**: Aprobado e Implementado
* **Fecha**: 2026-09-03
* **Autor**: Antigravity Assistant & Usuario

---

## 1. Contexto y Problema

### A. Ingesta del Historial del Dispositivo
En la implementación inicial, al vincular un dispositivo caudalímetro ESP32 o consultar datos, la aplicación únicamente solicitaba al microcontrolador el rango activo configurado en el selector de la UI (ej. últimos 7 días). Esto provocaba que si el usuario posteriormente seleccionaba un rango más amplio (ej. "Último 1 año" o "Historial Completo / Max"), la base de datos local SQLite no disponía de los datos históricos antiguos, requiriendo una nueva consulta por red.

### B. Configuración de Compilación y Ejecución
No existían archivos `.env` o `.env.example` en el repositorio para parametrizar valores de build y runtime (como el intervalo de auto-sync, el puerto TCP predeterminado o credenciales opcionales de Supabase Cloud), forzando a cambiar código fuente para ajustar estos parámetros.

---

## 2. Decisiones Tomadas

### A. Ingesta del Historial Completo al Vincular
1. **Consulta del Rango del Hardware**: Al vincular por primera vez un dispositivo (o cuando la BD SQLite local no posea registros históricos), el sistema ejecuta el comando TCP `0x01` (`get_device_range`) para conocer el `first_ts` y `last_ts` reales del almacenamiento del ESP32.
2. **Descarga Incremental e Ingesta Completa**: Se descarga todo el historial desde `first_ts` hasta el tiempo presente `now` y se persiste en SQLite.
3. **Navegación Instantánea Offline**: Al estar todo el historial precargado en SQLite, el usuario puede cambiar instantáneamente a cualquier rango de Grafana (15m, 1h, 30d, 1yr, Max) resolviendo la consulta de forma local sin latencia de red.
4. **Delta Syncs Posteriores**: Las sincronizaciones automáticas periódicas (cada 60s) solo descargan los deltas recientes (`max_local_ts + 1` a `now`).

### B. Parametrización con Variables de Entorno (`.env` y `.env.example`)
Se crearon los archivos `.env` y `.env.example` en la raíz del proyecto React con las siguientes variables documentadas:
- `VITE_SYNC_INTERVAL_SEC`: Intervalo de sincronización automática en segundos (Default: `60`).
- `VITE_APP_ENV`: Modo de entorno (`tauri` | `web` | `mock`).
- `VITE_DEFAULT_ESP32_PORT`: Puerto TCP por defecto (`3333`).
- `VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY`: Credenciales opcionales para la nube en SPA Web.

---

## 3. Consecuencias

### Positivas:
- Cero latencia al conmutar rangos históricos en la UI.
- Autonomía offline total para visualizar el historial guardado.
- Facilidad para personalizar parámetros de compilación (`pnpm build`) mediante `.env`.
- Coherencia en la documentación del repositorio con `.env.example`.
