# Proyecto: Caudalimetro ESP 32
Se solicito el desarrollo de un sistema IoT en el cual se necesita obtener la informacion de un caudalimetro, almacenarla persistentemente con un registro de al menos 3 meses.
El sistema debe:
- Poder accederse dentro de la red local como objetivo principal, un opcional es la disponibilidad a traves de internet.
- La aplicacion de usuario debe poder listar todos los dispositivos a los que tenga acceso
- La aplicacion de usuario debe poder mostrar informacion de todos los dispositivos que seleccione el usuario

## Decisiones de diseño
- Se utilizara un esp32-c3 o esp32 wroom con esp-idf, particionando la flash en ota0, ota1 (de 1.5 MB cada una) y storage (LittleFS de 650KB)
- Se conectaran utilizando un DNS local del estilo mDNS
- La aplicacion de usuario se implementara en tauri para la compatibilidad futura con interfaces web y la creacion de una aplicacion portable .exe
- Se guardan los datos en la flash del dispositivo (siendo la fuente de verdad), donde cada mes representa un archivo, se guarda en forma binaria el timestamp y el caudal:
```
typedef struct {
    uint32_t time_info;
    uint16_t volume;
} __attribute__((packed)) data_t;
```
- Se genera tcp server para servir la informacion a las aplicaciones de usuario. Se puede consultar:
    - El rango de fechas que se cuenta con data
    - Se puede solicitar la data entre fechas (yyyy-mm-dd)
    - Se puede pedir todo el historial poniendo el tiempo inicial y final del rango de fechas o se pueden pedir informaciones parciales

## Deseable
- Seria ideal guardar una cache local para no tener que consultar todo el registro historico de los 3 o mas meses en cada consulta
- Posibilidad de crear una arquitectura mas robusta con servicios dedicados de capa gratuita (supabase postgresql) y una interfaz web.

## Avances de Diseño App Tauri (React + TS)
- **ADR 0001 (Descubrimiento y TCP)**: Descubrimiento mDNS automático de dispositivos y cliente TCP binario implementados en el backend de Rust (Tauri), exponiendo comandos asíncronos tipeados a React, con soporte adicional de ingreso manual de IP/Hostname para facilitar el debugging y redes con mDNS limitado.
- **ADR 0002 (Caché Local e Incremental Sync)**: Uso de SQLite local en Tauri (`tauri-plugin-sql` / `rusqlite`). Sincronización incremental consultando el timestamp máximo guardado por dispositivo y solicitando únicamente la diferencia al ESP32. Visualización instantánea y mínimo tráfico de red.
- **ADR 0003 (Stack Frontend, UI y Gráficos)**: Uso de Tailwind CSS v4, Lucide React y componentes tipo Shadcn UI para la interfaz, Apache ECharts (`echarts-for-react` en Canvas) para gráficos de series temporales de alto rendimiento con zoom/pan, y Zustand para gestión de estado reactivo global.
- **ADR 0004 (Sincronización Nube Directa ESP32-Supabase)**: Conexión HTTPS REST/WebSockets directa desde el ESP32 hacia Supabase PostgreSQL para acceso remoto vía Internet. La aplicación Tauri de usuario soporta modo dual: conexión TCP/SQLite local en red LAN o consulta remota a la API de Supabase en Internet.
- **ADR 0005 (Arquitectura Modular, Adaptadores y Sistema Global de Temas)**: Desacoplamiento total entre componentes de UI (React + Tailwind v4 + ECharts) y la capa de datos mediante el patrón de Adaptador (`IDeviceService`). Los componentes son 100% agnósticos del entorno y compatibles con Tauri Desktop (vía IPC/SQLite) y Web SPA. Prohibición estricta de colores hardcodeados; paleta definida globalmente mediante variables CSS / tokens de Tailwind v4, dejando la estructura lista para activar Modo Oscuro en la versión 2.
- **ADR 0006 (Eliminación de Dispositivos Manuales, AutoSync 60s y Selector Estilo Grafana)**: Soporte para eliminar dispositivos ingresados manualmente de la UI y SQLite. Sincronización automática de datos en segundo plano cada 60 segundos (configurable por `VITE_SYNC_INTERVAL_SEC`). Rediseño del selector de rango temporal con formato estilo Grafana (desplegable de 2 columnas: fechas personalizadas Desde/Hasta + 15 accesos rápidos scrolleables desde 15m hasta Max).
- **ADR 0007 (Ingesta de Historial Completo en Primera Vinculación y Variables .env para Build)**: Al vincular por primera vez un caudalímetro, la app consulta el rango total de almacenamiento del hardware (`first_ts` y `last_ts`) y realiza la descarga e ingesta de todo el historial en SQLite. Creación de los archivos `.env` y `.env.example` para parametrizar limpiamente las variables de build y ejecución (`VITE_SYNC_INTERVAL_SEC`, `VITE_APP_ENV`, `VITE_DEFAULT_ESP32_PORT`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- **ADR 0008 (Exportación a Excel .xlsx, Diálogo Nativo, Toast y Acumulado Mensual)**: Módulo de exportación a Excel usando `xlsx` (SheetJS) con 3 opciones de generación: 1) Historial completo del activo, 2) Rango seleccionado del activo, 3) Todos los dispositivos seleccionados (pestañas por caudalímetro). Integración del explorador de archivos nativo del SO (`rfd` / Rust File Dialog) para elegir ruta y nombre, sistema de notificaciones flotantes Toast de éxito/error, y columna calculada de `Acumulado Mensual (Litros)` reiniciada al inicio de cada mes calendario (`YYYY-MM`).
- **ADR 0009 (Renombrado Editable de Dispositivos y Columnas en Excel)**: Posibilidad de editar de forma personalizada el nombre visible de cualquier dispositivo en la UI (persistido en SQLite). En las tarjetas de dispositivo (`DeviceCard.tsx`) se muestra el nombre legible y en detalle el hostname e IP:puerto. En los reportes de Excel se incluyen columnas separadas para `Nombre de Dispositivo` y `Hostname / IP`.




