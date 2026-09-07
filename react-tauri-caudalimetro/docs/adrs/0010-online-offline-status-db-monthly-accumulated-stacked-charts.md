# ADR 0010: Estado Online/Offline Dinámico, Persistencia del Acumulado Mensual y Gráficos Apilados

* **Estado**: Aprobado e Implementado
* **Fecha**: 2026-09-07
* **Autor**: Antigravity Assistant & Usuario

---

## 1. Contexto y Problema
Se identificaron 5 mejoras clave requeridas para la aplicación:
1. **Detección Dinámica de Estado**: Si un intento de conexión TCP/sincronización con un ESP32 falla por timeout o error de red, el dispositivo debe marcarse inmediatamente como **Offline** en la UI y SQLite, y restablecerse a **Online** tras una reconexión exitosa.
2. **Límites de Eje X Coincidentes**: El eje X del gráfico debe forzarse estrictamente al rango temporal seleccionado (`dateRange.startTs` $\rightarrow$ `dateRange.endTs`), asegurando que el marco temporal sea consistente independientemente de si hay datos en los extremos.
3. **Colores de Alto Contraste**: Garantizar máxima diferenciación visual entre series de dispositivos.
4. **Persistencia del Acumulado Mensual**: Almacenar la sumatoria del acumulado por mes directamente en la BD SQLite local.
5. **Doble Gráfico Apilado**: Separar la visualización en 2 gráficos:
   - **Gráfico Superior**: Caudal por intervalo en **Barras (`type: 'bar'`)**.
   - **Gráfico Inferior**: Acumulado mensual en **Líneas (`type: 'line'`)** con **puntos de datos visibles (`showSymbol: true`)** para detectar periodos de inactividad o fallos de envío.

---

## 2. Decisiones Tomadas

### A. Estado Dinámico de Conexión en Backend Rust
- En `src-tauri/src/db.rs`, se creó el método `set_device_online(&self, device_id: &str, is_online: bool)`.
- En `sync_device_samples` (`lib.rs`), ante cualquier falla de lectura TCP con el ESP32, se ejecuta `set_device_online(&device_id, false)` y se actualiza el estado reactivo en React. Al sincronizar con éxito, se ejecuta `set_device_online(&device_id, true)`.

### B. Persistencia del Acumulado Mensual en SQLite
- Se añadió la columna `monthly_accumulated INTEGER NOT NULL DEFAULT 0` a la tabla `samples`.
- En `save_samples_batch`, al guardar lotes de muestras se calcula la sumatoria acumulada agrupada por mes calendario (`YYYY-MM`) y se actualiza en SQLite.

### C. Dos Gráficos Apilados en `FlowChart.tsx` con Eje X Fijo
- En `FlowChart.tsx`, se configuró un diseño ECharts con 2 sub-grids (`grid[0]` y `grid[1]`) vinculados mediante `axisPointer: { link: [{ xAxisIndex: 'all' }] }` y `dataZoom: [{ xAxisIndex: [0, 1] }]`.
- **Eje X**: Fijado explícitamente con `min: dateRange.startTs * 1000` y `max: dateRange.endTs * 1000`.
- **Barras de Intervalo**: Gráfico superior con `barMaxWidth: 14` y esquinas redondeadas.
- **Líneas con Puntos**: Gráfico inferior con `symbol: 'circle'` y `symbolSize: 6` permitiendo ver claramente cada transmisión.

### D. Paleta de 8 Colores de Alto Contraste
- Se definieron 8 colores de alta legibilidad en `src/utils/theme.ts`: `#0284c7` (Azul Océano), `#e11d48` (Carmesí), `#059669` (Esmeralda), `#7c3aed` (Violeta), `#d97706` (Ámbar), `#0891b2` (Cian), `#c026d3` (Fucsia), `#4d7c0f` (Lima).

---

## 3. Consecuencias

### Positivas:
- Retroalimentación en tiempo real del estado de salud y conectividad del hardware ESP32.
- Facilidad para diagnosticar lapsos sin reporte mediante los puntos de datos visibles en la línea acumulada.
- Zoom y puntero de inspección sincronizados a través de ambos gráficos.
- Rendimiento óptimo en renderizado gracias a la persistencia pre-calculada del acumulado mensual en SQLite.
