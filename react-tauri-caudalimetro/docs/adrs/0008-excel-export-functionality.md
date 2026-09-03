# ADR 0008: Exportación a Excel (.xlsx), Diálogo Nativo del SO, Notificaciones Toast y Acumulado Mensual

* **Estado**: Aprobado e Implementado
* **Fecha**: 2026-09-03
* **Autor**: Antigravity Assistant & Usuario

---

## 1. Contexto y Problema
Los usuarios necesitaban exportar las mediciones de caudal a formato Excel (`.xlsx`), eligiendo la ubicación exacta donde guardar el archivo en su sistema operativo, recibiendo notificaciones claras de éxito o error, y contando con una columna extra que calcule la suma acumulada mensual de caudal por dispositivo.

---

## 2. Decisiones Tomadas

### A. Explorador de Archivos Nativo del SO (`rfd`)
- Se integró la crate de Rust `rfd` (Rust File Dialog, v0.14) en el backend de Tauri.
- Al hacer clic en exportar, la aplicación despliega la ventana nativa *"Guardar como..."* del explorador de archivos de Windows/OS, permitiendo al usuario seleccionar cualquier carpeta de su disco rígido y renombrar el archivo a su gusto.

### B. Sistema de Notificaciones Toast (`Toast.tsx`)
- Se creó el componente flotante `Toast.tsx` con soporte para mensajes contextuales:
  - **Éxito (Verde)**: Muestra el mensaje confirmando la ruta donde se guardó el archivo `.xlsx`.
  - **Error (Rojo)**: Muestra detalles del fallo si ocurrió algún problema de permisos o de red.

### C. Columna Calculada de Acumulado Mensual (`Acumulado Mensual (Litros)`)
- En las hojas de cálculo generadas se añadieron las columnas:
  1. `Volumen Intervalo (Litros)`: Volumen registrado en la muestra actual.
  2. `Acumulado Mensual (Litros)`: Suma acumulada de volumen desde el inicio del mes calendario (`YYYY-MM`).
- **Comportamiento del Acumulado**:
  - Al ingresar a un nuevo mes calendario (ej: de Septiembre `2026-09` a Octubre `2026-10`), el acumulado se reinicia automáticamente a cero y comienza a acumular las muestras de ese nuevo mes.

---

## 3. Consecuencias

### Positivas:
- Experiencia de usuario completa de nivel escritorio (diálogo nativo + notificaciones Toast).
- Cálculo automático de totales mensuales directamente en el reporte exportado.
- Soporte de 3 opciones de cobertura (Historial Completo, Rango Activo, Múltiples Dispositivos en pestañas).
