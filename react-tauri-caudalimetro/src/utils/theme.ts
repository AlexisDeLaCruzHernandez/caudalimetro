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
    getCssVar("--chart-series-1", "#0284c7"),
    getCssVar("--chart-series-2", "#0d9488"),
    getCssVar("--chart-series-3", "#8b5cf6"),
    getCssVar("--chart-series-4", "#f59e0b"),
  ];
}
