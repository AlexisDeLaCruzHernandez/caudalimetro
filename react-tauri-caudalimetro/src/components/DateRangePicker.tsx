import React, { useState, useRef, useEffect } from "react";
import { useDeviceStore } from "../store/useDeviceStore";
import { formatDate } from "../utils/date";
import { Calendar, ChevronDown, Clock, Check, Play } from "lucide-react";

interface PresetOption {
  label: string;
  getSeconds: () => number;
}

const PRESET_OPTIONS: PresetOption[] = [
  { label: "Últimos 15 mins", getSeconds: () => 15 * 60 },
  { label: "Últimos 30 mins", getSeconds: () => 30 * 60 },
  { label: "Última 1 hora", getSeconds: () => 3600 },
  { label: "Últimas 3 horas", getSeconds: () => 3 * 3600 },
  { label: "Últimas 6 horas", getSeconds: () => 6 * 3600 },
  { label: "Últimas 12 horas", getSeconds: () => 12 * 3600 },
  { label: "Últimas 24 horas", getSeconds: () => 24 * 3600 },
  { label: "Últimos 3 días", getSeconds: () => 3 * 24 * 3600 },
  { label: "Últimos 7 días", getSeconds: () => 7 * 24 * 3600 },
  { label: "Últimos 14 días", getSeconds: () => 14 * 24 * 3600 },
  { label: "Últimos 30 días", getSeconds: () => 30 * 24 * 3600 },
  { label: "Últimos 90 días", getSeconds: () => 90 * 24 * 3600 },
  { label: "Últimos 6 meses", getSeconds: () => 180 * 24 * 3600 },
  { label: "Último 1 año", getSeconds: () => 365 * 24 * 3600 },
  { label: "Historial Completo (Max)", getSeconds: () => 5 * 365 * 24 * 3600 },
];

export const DateRangePicker: React.FC = () => {
  const { dateRange, setDateRange, selectedPresetLabel } = useDeviceStore();
  const [isOpen, setIsOpen] = useState(false);

  const popoverRef = useRef<HTMLDivElement>(null);

  const parseFormattedDate = (str: string): number | null => {
    // Reemplaza slashes por guiones para que el Date constructor lo entienda de forma confiable
    const normalized = str.trim().replace(/\//g, "-");
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return null;
    return Math.floor(d.getTime() / 1000);
  };

  const [fromInput, setFromInput] = useState(() => formatDate(dateRange.startTs, true));
  const [toInput, setToInput] = useState(() => formatDate(dateRange.endTs, true));

  // Actualizar inputs si cambia dateRange desde fuera
  useEffect(() => {
    setFromInput(formatDate(dateRange.startTs, true));
    setToInput(formatDate(dateRange.endTs, true));
  }, [dateRange]);

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

  const handleSelectPreset = (preset: PresetOption) => {
    const now = Math.floor(Date.now() / 1000);
    const secs = preset.getSeconds();
    const startTs = now - secs;
    setDateRange(startTs, now, preset.label);
    setIsOpen(false);
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const startTs = parseFormattedDate(fromInput);
    const endTs = parseFormattedDate(toInput);

    if (startTs === null || endTs === null) {
      alert("Formato de fecha inválido. Utilice el formato YYYY/MM/DD HH:mm (ej: 2026/09/03 14:30)");
      return;
    }

    if (startTs >= endTs) {
      alert("La fecha 'Desde' debe ser anterior a la fecha 'Hasta'.");
      return;
    }

    setDateRange(startTs, endTs, "Personalizado");
    setIsOpen(false);
  };


  // Formateador Grafana para el botón principal con formato estricto YYYY/MM/DD HH:mm
  const formattedDisplayRange = () => {
    const fromDate = formatDate(dateRange.startTs, true);
    const toDate = formatDate(dateRange.endTs, true);
    return `${selectedPresetLabel} (${fromDate} → ${toDate})`;
  };

  return (
    <div className="relative z-30" ref={popoverRef}>
      {/* Botón Estilo Grafana de Visualización Activa */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3.5 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--color-primary)] rounded-xl text-xs font-semibold text-[var(--text-main)] shadow-2xs transition-all cursor-pointer select-none"
      >
        <Calendar className="w-4 h-4 text-[var(--color-primary)]" />
        <span>{formattedDisplayRange()}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Menú Desplegable de 2 Columnas (Estilo Grafana) */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-full max-w-2xl bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-[var(--text-main)] animate-in fade-in zoom-in-95 duration-100">
          
          {/* Columna 1: Rango Personalizado */}
          <div className="flex flex-col justify-between border-b md:border-b-0 md:border-r border-[var(--border-color)] pb-4 md:pb-0 md:pr-4 space-y-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-main)] mb-3 pb-1 border-b border-[var(--border-color)]">
                <Clock className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                <span>Rango Personalizado (YYYY/MM/DD HH:mm)</span>
              </div>

              <form onSubmit={handleApplyCustom} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                    Desde:
                  </label>
                  <input
                    type="text"
                    placeholder="YYYY/MM/DD HH:mm"
                    value={fromInput}
                    onChange={(e) => setFromInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[var(--color-primary)] text-[var(--text-main)] font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                    Hasta:
                  </label>
                  <input
                    type="text"
                    placeholder="YYYY/MM/DD HH:mm"
                    value={toInput}
                    onChange={(e) => setToInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[var(--color-primary)] text-[var(--text-main)] font-mono"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-lg transition-all shadow-2xs cursor-pointer mt-2"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Aplicar Rango
                </button>
              </form>
            </div>
          </div>

          {/* Columna 2: Opciones Rápidas Scrolleables */}
          <div className="flex flex-col space-y-2">
            <div className="text-xs font-bold text-[var(--text-main)] mb-1 pb-1 border-b border-[var(--border-color)]">
              Opciones Rápidas
            </div>

            <div className="max-h-60 overflow-y-auto pr-1 space-y-1 custom-scrollbar">
              {PRESET_OPTIONS.map((preset) => {
                const isSelected = selectedPresetLabel === preset.label;
                return (
                  <button
                    key={preset.label}
                    onClick={() => handleSelectPreset(preset)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium rounded-lg text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[var(--color-primary)]/15 text-[var(--color-primary)] font-bold"
                        : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-main)]"
                    }`}
                  >
                    <span>{preset.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[var(--color-primary)]" />}
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
