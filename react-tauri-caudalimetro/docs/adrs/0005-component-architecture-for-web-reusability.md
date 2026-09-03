# ADR 0005: Arquitectura Modular de Componentes, Adaptadores y Sistema Global de Temas para Reutilización en Web (Vite + React)

* **Estado**: Aceptado
* **Fecha**: 2026-09-02 (Actualizado 2026-09-03)
* **Autor**: Antigravity & Equipo LSE Caudalímetro

## Contexto y Problema
Se requiere que la implementación del frontend en React + TypeScript no dependa rígidamente de las APIs específicas de Tauri (`@tauri-apps/api`), de modo que todos los componentes visuales (gráficos de ECharts, tablas de dispositivos, paneles de filtrado) y la lógica de estado (Zustand) puedan ser reutilizados sin modificaciones en una aplicación Web estándar basada en Vite + React. 

Asimismo, es imprescindible **evitar el hardcodeo de colores** en componentes UI y gráficos para permitir la actualización de la identidad visual de forma centralizada y facilitar la incorporación futura de un **Modo Oscuro (Dark Mode)** en una segunda versión del software.

## Decisiones Evaluadas

### 1. Desacoplamiento de Servicios de Datos (Patrón Adaptador)
- **Capa de Interfaces de Dominio (`src/services/` o `src/adapters/`)**:
  Se define una interfaz abstracta TypeScript `IDeviceService`:
  ```typescript
  export interface IDeviceService {
    discoverDevices(): Promise<Device[]>;
    addManualDevice(ipOrHost: string): Promise<Device>;
    getDateRange(deviceId: string): Promise<DateRange>;
    fetchSamples(deviceId: string, startTs: number, endTs: number): Promise<Sample[]>;
  }
  ```
- **Implementaciones Concretas**:
  - `TauriDeviceService`: IPC Tauri e invoca comandos de Rust + SQLite local en la app de escritorio.
  - `SupabaseDeviceService`: Consulta a PostgreSQL en la nube en entornos Web.
  - `MockDeviceService`: Pruebas unitarias y desarrollo de UI offline en navegador.
- **Inyección de Dependencias / Context Provider**:
  Un `ServiceProvider` detecta si se está ejecutando dentro de Tauri (`window.__TAURI_INTERNALS__` o variable de entorno) e inyecta la implementación correspondiente.

### 2. Sistema Global de Temas y Paleta de Colores (Design Tokens & CSS Variables)
- **Definición Centralizada mediante Variables CSS / Tailwind v4**:
  Todos los colores de la aplicación (fondos, bordes, textos, estados de dispositivos, y series de gráficos ECharts) se definen mediante tokens de diseño en CSS (`:root` y `.dark`).
  ```css
  :root {
    --bg-background: #f8fafc;
    --bg-card: #ffffff;
    --text-primary: #0f172a;
    --text-muted: #64748b;
    --color-primary: #0284c7;
    --color-secondary: #0d9488;
    --status-online: #16a34a;
    --status-offline: #dc2626;
    --chart-series-1: #0284c7;
    --chart-series-2: #0d9488;
    --chart-series-3: #8b5cf6;
  }

  .dark {
    --bg-background: #0f172a;
    --bg-card: #1e293b;
    --text-primary: #f8fafc;
    --text-muted: #94a3b8;
    --color-primary: #38bdf8;
    --color-secondary: #2dd4bf;
    /* Colores adaptados para modo oscuro */
  }
  ```
- **Regla Estricta: Prohibición de Colores Hardcodeados**:
  - Queda **estrictamente prohibido** utilizar códigos Hexadecimales (`#3b82f6`) o valores RGB fijos directamente dentro del código JSX o en las opciones de Apache ECharts.
  - En componentes React, se utilizan clases semánticas de Tailwind (`bg-card`, `text-primary`, `border-muted`).
  - En los gráficos de ECharts, se leen dinámicamente las variables CSS mediante helpers de JavaScript (`getComputedStyle(document.documentElement).getPropertyValue('--chart-series-1')`) o temas de ECharts registrados globalmente.

## Consecuencias
* **Positivas**:
  - Reutilización del 100% de los componentes visuales entre la versión Tauri (.exe) y la versión Web (Vite + React SPA).
  - Cambio de paleta gráfica global en segundos modificando un único archivo de variables CSS.
  - Base totalmente preparada para activar Modo Oscuro / Claro en la v2 simplemente agregando la clase `.dark` al elemento raíz.
  - Arquitectura limpia y agnóstica de la capa de visualización y datos.
* **Negativas / Desafíos**:
  - Es necesario asegurar que ECharts responda al cambio dinámico de tema mediante un hook reactivo que actualice sus opciones cuando cambie el tema del sistema.
