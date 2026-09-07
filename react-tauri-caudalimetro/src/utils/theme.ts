/**
 * Helper para obtener valores de variables CSS globales definidas en index.css
 * Evita el hardcodeo de códigos de color Hexadecimales.
 */
export function getCssVar(varName: string, defaultValue: string = "#000000"): string {
  if (typeof window === "undefined") return defaultValue;
  const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return val || defaultValue;
}

/**
 * Devuelve la paleta de colores de series para gráficos según el tema activo
 */
export function getChartPalette(): string[] {
  return [
    getCssVar("--chart-series-1", "#0284c7"), // Azul Océano
    getCssVar("--chart-series-2", "#e11d48"), // Rosa Carmesí / Rojo
    getCssVar("--chart-series-3", "#d97706"), // Ámbar Dorado
    getCssVar("--chart-series-4", "#059669"), // Verde Esmeralda
    getCssVar("--chart-series-5", "#7c3aed"), // Violeta Intenso
    getCssVar("--chart-series-6", "#0891b2"), // Cian Turquesa
    getCssVar("--chart-series-7", "#c026d3"), // Fucsia Mágico
    getCssVar("--chart-series-8", "#4d7c0f"), // Verde Lima
  ];
}
