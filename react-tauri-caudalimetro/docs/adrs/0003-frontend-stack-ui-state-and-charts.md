# ADR 0003: Stack de Frontend, Componentes de UI, Estado Global y Librería de Gráficos

* **Estado**: Aceptado
* **Fecha**: 2026-09-02
* **Autor**: Antigravity & Equipo LSE Caudalímetro

## Contexto y Problema
La interfaz de usuario debe listar todos los dispositivos caudalímetros (descubiertos dinámicamente vía mDNS o agregados manualmente), permitir seleccionar uno o múltiples dispositivos, consultar y filtrar por rangos de fecha, y renderizar eficientemente gráficos de volumen de agua a lo largo del tiempo (pudiendo tener miles de muestras de hasta 3+ meses). Se requiere un stack de desarrollo modular, rápido, fuertemente tipado y con excelente experiencia visual.

## Decisiones Evaluadas
1. **Material UI + Chart.js + Redux Toolkit**: Muy robusto pero más pesado y con mayor boilerplate para visualizaciones de series temporales extensas.
2. **Recharts + React Context**: SVG nativo simple, pero sufre de caídas de FPS al renderizar miles de puntos continuos con zoom y pan interactivo.
3. **Tailwind CSS v4 + Shadcn UI + ECharts + Zustand (Elegida)**:
   - **Styling y UI**: Tailwind CSS v4 junto a Lucide React e inspiraciones/componentes de Shadcn UI para una experiencia limpia, moderna y accesible.
   - **Visualización de Datos**: Apache ECharts (vía `echarts` / `echarts-for-react`). Al utilizar renderizado mediante HTML5 Canvas, soporta miles de muestras de series temporales sin degradar la tasa de refresco, e incluye de forma nativa herramientas de Zoom, Pan, DataZoom slider y Tooltips precisos.
   - **Gestión de Estado**: Zustand para administrar de forma reactiva y sin boilerplate la lista de dispositivos, sus estados de conexión, dispositivos seleccionados para comparación y rangos de fechas de filtro.

## Consecuencias
* **Positivas**:
  - Excelente rendimiento gráfico (Canvas de ECharts) incluso cargando 3+ meses de datos de caudal con alta densidad de muestreo.
  - Componentes UI altamente personalizables y livianos.
  - Código desacoplado y fácil de mantener con TypeScript e interfaces claras.
* **Negativas / Desafíos**:
  - ECharts requiere adaptar su objeto de configuración tipo `option` en componentes de React, lo que se resolverá mediante un wrapper tipado reutilizable.
