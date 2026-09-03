# ADR 0006: Eliminación de Dispositivos Manuales, Sincronización Automática 60s y Selector de Rango Estilo Grafana

* **Estado**: Aceptado
* **Fecha**: 2026-09-03
* **Autor**: Antigravity & Equipo LSE Caudalímetro

## Contexto y Problema
Se identificaron 3 necesidades clave para perfeccionar el flujo de trabajo de la aplicación de usuario:
1. **Eliminación de Dispositivos Manuales**: Los dispositivos ingresados manualmente por IP/Hostname que queden fuera de uso deben poder eliminarse de la lista y de la base de datos local SQLite.
2. **Sincronización Automática Periódica**: Mientras la aplicación permanezca abierta, se debe sincronizar automáticamente en segundo plano la información del caudalímetro cada 60 segundos (configurable mediante variable de entorno `VITE_SYNC_INTERVAL_SEC`).
3. **Selector de Rango Estilo Grafana**: La selección de rango de fechas debe ofrecer una interfaz avanzada de 2 columnas inspirada en Grafana: despliegue mediante un botón del rango activo, formulario de fechas personalizadas "Desde / Hasta" y columna scrolleable con 15 opciones rápidas (desde 15 minutos hasta 1 año y máximo).

## Decisiones Evaluadas

### 1. Eliminación de Dispositivos Manuales
- Adición del comando Rust `remove_manual_device` y método `delete_device` en `DbState` que borra el dispositivo y sus muestras asociadas de SQLite.
- Integración en la interfaz `IDeviceService` y botón de borrado en la tarjeta `DeviceCard` visible únicamente en dispositivos manuales.

### 2. Sincronización Automática de 60s
- Configuración de un temporizador de fondo (`setInterval`) en `App.tsx` que ejecuta `syncAndFetchSamples()` cada `VITE_SYNC_INTERVAL_SEC` segundos (por defecto 60000 ms).
- Permite mantener actualizada la gráfica y la caché local sin requerir intervención manual del usuario.

### 3. Selector de Rango Estilo Grafana
- Componente `DateRangePicker.tsx` rediseñado con un botón desplegable en el encabezado.
- **Columna 1**: Formulario personalizado con inputs `datetime-local` ("Desde:" / "Hasta:") y botón "Aplicar Rango".
- **Columna 2**: Lista scrolleable con 15 accesos rápidos: *15 mins, 30 mins, 1 hs, 3 hs, 6 hs, 12 hs, 24 hs, 3 días, 7 días, 14 días, 30 días, 90 días, 6 meses, 1 año y Historial Completo (Max)*.

## Consecuencias
* **Positivas**:
  - Gestión limpia de dispositivos manuales en la interfaz y SQLite.
  - Actualización reactiva y automática en tiempo real de mediciones sin necesidad de refrescar la app.
  - Experiencia de usuario (UX) profesional alineada con estándares de observabilidad como Grafana.
