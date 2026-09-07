# ADR 0011: Calendario Híbrido, Corrección de Layout sin Overflow, Gráficos Offline y Comando Debug

* **Estado**: Aprobado e Implementado
* **Fecha**: 2026-09-07
* **Autor**: Antigravity Assistant & Usuario

---

## 1. Contexto y Problema
Se requirió resolver 5 puntos específicos de experiencia de usuario, interfaz y depuración:
1. **Selector por Calendario**: Permitir seleccionar fechas mediante un widget visual de calendario sin perder el formato estricto `YYYY/MM/DD HH:mm`.
2. **Overflow del Slider**: El control deslizante `dataZoom` en `FlowChart.tsx` quedaba recortado por debajo del contenedor.
3. **Alineación de Títulos**: Los nombres de los ejes Y en los dos sub-gráficos apilados requerían estar alineados limpiamente a la izquierda.
4. **Visualización de Historial Offline**: Si un dispositivo está Offline o falla la sincronización TCP, el gráfico debe poder consultar y renderizar inmediatamente las muestras guardadas en la BD SQLite local.
5. **Comando de Debug para Recalcular Acumulados**: Disponer de una función backend/frontend para recalcular el acumulado mensual (`monthly_accumulated`) en SQLite bajo demanda.

---

## 2. Decisiones Tomadas

### A. Widget Híbrido de Calendario (`DateRangePicker.tsx`)
- Se incluyó un botón con ícono de calendario `<input type="datetime-local">` junto al campo de texto.
- Al pulsar el calendario, se despliega el widget visual del sistema operativo; la fecha/hora seleccionada se traduce automáticamente al formato estricto `YYYY/MM/DD HH:mm`.

### B. Corrección de Dimensiones del Gráfico (`FlowChart.tsx`)
- Sub-grid 0 (Barras de Intervalo): `top: '35px'`, `height: '36%'`.
- Sub-grid 1 (Líneas de Acumulado): `top: '48%'`, `height: '36%'`.
- DataZoom Slider: `bottom: '8px'`, `height: 18`.
- Títulos de Ejes Y: `nameLocation: 'end'`, `nameGap: 10`, `nameTextStyle: { align: 'left' }`.

### C. Renderizado Inmediato de Historial SQLite (`useDeviceStore.ts`)
- En `syncAndFetchSamples()`, la primera instrucción es `await get().loadSamples()`.
- Esto garantiza que las muestras pre-existentes en SQLite se carguen y grafiquen inmediatamente, aun cuando el dispositivo se encuentre Offline o la red no responda.

### D. Comando y Botón Debug de Recálculo (`db.rs` / `lib.rs` / `FlowChart.tsx`)
- Se agregó el método `recalculate_monthly_accumulated(target_device_id)` en Rust que actualiza `monthly_accumulated` en la BD.
- Se incorporó el botón **"Recalcular DB"** en la barra superior del gráfico con icono `Wrench` y alerta Toast al finalizar.

---

## 3. Consecuencias

### Positivas:
- Selección fácil de fechas mediante el calendario visual y máxima consistencia en `YYYY/MM/DD HH:mm`.
- Layout de gráficos impecable sin scrollbars ni elementos desbordados.
- Gráficos 100% operativos en modo Offline utilizando los datos locales de SQLite.
- Herramienta de depuración para garantizar la integridad del acumulado mensual en la base de datos.
