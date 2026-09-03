import * as XLSX from "xlsx";
import { Device, Sample } from "../core/types";
import { formatDate } from "./date";
import { invoke } from "@tauri-apps/api/core";

export interface ExportDataset {
  device: Device;
  samples: Sample[];
  customSheetName?: string;
}

export interface ExportResult {
  success: boolean;
  cancelled?: boolean;
  filePath?: string;
  message?: string;
}

/**
 * Formatea muestras, calcula el acumulado mensual, desplegando el diálogo nativo de guardado.
 */
export async function exportDatasetsToExcel(
  datasets: ExportDataset[],
  fileNamePrefix: string = "Caudalimetro_Reporte"
): Promise<ExportResult> {
  if (!datasets || datasets.length === 0) {
    return { success: false, message: "No hay datos disponibles para exportar." };
  }

  const workbook = XLSX.utils.book_new();
  let totalRowsCount = 0;

  datasets.forEach((ds, index) => {
    const { device, samples, customSheetName } = ds;

    // 1. Ordenar muestras de forma ascendente por timestamp
    const sortedSamples = [...samples].sort((a, b) => a.timestamp - b.timestamp);

    // 2. Calcular acumulado mensual por dispositivo
    let currentMonthKey = "";
    let runningMonthlyTotal = 0;

    const rows = sortedSamples.map((s) => {
      const date = new Date(s.timestamp * 1000);
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;

      if (monthKey !== currentMonthKey) {
        currentMonthKey = monthKey;
        runningMonthlyTotal = 0; // Reinicio al cambiar de mes
      }

      runningMonthlyTotal += s.volume;

      return {
        "Fecha y Hora": formatDate(s.timestamp, true) + ":00",
        "Timestamp UNIX (s)": s.timestamp,
        "Nombre de Dispositivo": device.name,
        "Hostname / IP": `${device.ip}:${device.port}`,
        "Volumen Intervalo (Litros)": s.volume,
        "Acumulado Mensual (Litros)": runningMonthlyTotal,
      };
    });

    totalRowsCount += rows.length;

    // Nombre limpio de pestaña de Excel
    let rawSheetName = customSheetName || device.name || `Dispositivo_${index + 1}`;
    let cleanSheetName = rawSheetName.replace(/[:\\/?*\[\]]/g, "_").slice(0, 30);
    if (!cleanSheetName) cleanSheetName = `Sheet_${index + 1}`;

    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Ancho automático de columnas
    worksheet["!cols"] = [
      { wch: 22 }, // Fecha y Hora
      { wch: 20 }, // Timestamp UNIX
      { wch: 30 }, // Nombre de Dispositivo
      { wch: 22 }, // Hostname / IP
      { wch: 24 }, // Volumen Intervalo
      { wch: 26 }, // Acumulado Mensual
    ];


    XLSX.utils.book_append_sheet(workbook, worksheet, cleanSheetName);
  });

  if (totalRowsCount === 0) {
    return { success: false, message: "El rango seleccionado no contiene muestras para exportar." };
  }

  // Generar nombre por defecto del archivo
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const timeStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(
    now.getHours()
  )}${pad(now.getMinutes())}`;
  const defaultFileName = `${fileNamePrefix}_${timeStr}.xlsx`;

  // Generar binario del libro Excel
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const byteArray = Array.from(new Uint8Array(excelBuffer));

  // 3. Desplegar explorador de archivos nativo si está en Tauri
  const isTauriEnv =
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  if (isTauriEnv) {
    try {
      const savedPath = await invoke<string | null>("save_excel_file", {
        defaultName: defaultFileName,
        bytes: byteArray,
      });

      if (!savedPath) {
        return { success: false, cancelled: true, message: "Exportación cancelada por el usuario." };
      }

      return {
        success: true,
        filePath: savedPath,
        message: `Reporte Excel guardado exitosamente en: ${savedPath}`,
      };
    } catch (e: any) {
      console.warn("Fallo el diálogo nativo de Tauri, recurriendo a descarga por navegador:", e);
    }
  }

  // Fallback: Descarga estándar en navegador Web
  XLSX.writeFile(workbook, defaultFileName);
  return {
    success: true,
    filePath: defaultFileName,
    message: `Reporte Excel generado y descargado: ${defaultFileName}`,
  };
}
