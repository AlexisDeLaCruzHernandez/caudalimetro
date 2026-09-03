import React, { useState, useRef, useEffect } from "react";
import { useDeviceStore } from "../store/useDeviceStore";
import { Toast, ToastMessage } from "./Toast";
import { FileSpreadsheet, ChevronDown, Download, Layers, Calendar, Database } from "lucide-react";

export const ExportDropdown: React.FC = () => {
  const { exportToExcel, selectedDeviceIds, activeDeviceId, devices } = useDeviceStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const activeDevice = devices.find(
    (d) => d.id === (activeDeviceId || (selectedDeviceIds.length > 0 ? selectedDeviceIds[0] : null))
  );

  // Cerrar popover al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExport = async (mode: "active_full" | "active_range" | "all_range") => {
    setIsOpen(false);
    setIsExporting(true);
    setToast(null);

    try {
      const result = await exportToExcel(mode);
      if (result.success) {
        setToast({
          id: Date.now().toString(),
          type: "success",
          title: "Exportación Exitosa",
          message: result.message || "Archivo Excel guardado con éxito.",
        });
      } else if (!result.cancelled) {
        setToast({
          id: Date.now().toString(),
          type: "error",
          title: "Error al Exportar",
          message: result.message || "No se pudo generar el archivo Excel.",
        });
      }
    } catch (e: any) {
      setToast({
        id: Date.now().toString(),
        type: "error",
        title: "Error Inesperado",
        message: e?.message || e?.toString() || "Error descargando archivo Excel.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative z-20" ref={popoverRef}>
      {/* Botón Principal de Exportar a Excel */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting || selectedDeviceIds.length === 0}
        title="Exportar reporte en formato Excel (.xlsx)"
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 disabled:opacity-50 rounded-lg transition-all shadow-2xs cursor-pointer select-none"
      >
        <FileSpreadsheet className={`w-4 h-4 text-emerald-600 dark:text-emerald-400 ${isExporting ? "animate-bounce" : ""}`} />
        <span>Exportar Excel</span>
        <ChevronDown className={`w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Menú Desplegable con las 3 Opciones */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-xl p-2 text-[var(--text-main)] animate-in fade-in zoom-in-95 duration-100 space-y-1">
          <div className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-color)]/60 mb-1 flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Opciones de Exportación (.xlsx)</span>
          </div>

          {/* Opción 1: Todo el historial del dispositivo seleccionado */}
          <button
            onClick={() => handleExport("active_full")}
            className="w-full flex items-start gap-2.5 p-2 rounded-lg hover:bg-[var(--bg-main)] text-left transition-all cursor-pointer group"
          >
            <Database className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[var(--text-main)] group-hover:text-[var(--color-primary)] truncate">
                1. Historial Completo
              </p>
              <p className="text-[11px] text-[var(--text-muted)] leading-tight mt-0.5 truncate">
                {activeDevice ? activeDevice.name : "Dispositivo seleccionado"} (Toda la BD)
              </p>
            </div>
          </button>

          {/* Opción 2: El rango seleccionado del dispositivo seleccionado */}
          <button
            onClick={() => handleExport("active_range")}
            className="w-full flex items-start gap-2.5 p-2 rounded-lg hover:bg-[var(--bg-main)] text-left transition-all cursor-pointer group"
          >
            <Calendar className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[var(--text-main)] group-hover:text-[var(--color-primary)] truncate">
                2. Rango Seleccionado
              </p>
              <p className="text-[11px] text-[var(--text-muted)] leading-tight mt-0.5 truncate">
                {activeDevice ? activeDevice.name : "Dispositivo seleccionado"} (Ventana activa)
              </p>
            </div>
          </button>

          {/* Opción 3: El rango seleccionado de todos los dispositivos seleccionados */}
          <button
            onClick={() => handleExport("all_range")}
            className="w-full flex items-start gap-2.5 p-2 rounded-lg hover:bg-[var(--bg-main)] text-left transition-all cursor-pointer group"
          >
            <Layers className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[var(--text-main)] group-hover:text-[var(--color-primary)] truncate">
                3. Todos los Dispositivos
              </p>
              <p className="text-[11px] text-[var(--text-muted)] leading-tight mt-0.5 truncate">
                {selectedDeviceIds.length} caudalímetros ({selectedDeviceIds.length} pestañas Excel)
              </p>
            </div>
          </button>
        </div>
      )}

      {/* Componente Toast de Notificación */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};
