import React from "react";
import { useDeviceStore } from "../store/useDeviceStore";
import { Droplet, Sun, Moon } from "lucide-react";


export const Header: React.FC = () => {
  const {
    setActiveView,
    activeView,
    isOtaAuthenticated,
    isDarkMode,
    toggleDarkMode,
  } = useDeviceStore();

  return (
    <header className="h-14 bg-[var(--bg-card)] border-b border-[var(--border-color)] px-4 flex items-center justify-between shrink-0 shadow-2xs">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setActiveView("ota")}
          title="Acceder a Gestión OTA (Protegido)"
          className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-xs transition-all cursor-pointer ${
            activeView === "ota"
              ? "bg-amber-500 text-white ring-2 ring-amber-500/40"
              : "bg-[var(--color-primary)] text-white hover:opacity-90"
          }`}
        >
          <Droplet className="w-5 h-5 fill-current" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight text-[var(--text-main)]">
              LSE Caudalímetro IoT
            </h1>
            {activeView === "ota" && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                OTA {isOtaAuthenticated ? "Admin" : "Bloqueado"}
              </span>
            )}
          </div>
          <p className="text-[11px] font-medium text-[var(--text-muted)] -mt-0.5">
            Monitoreo & Sincronización
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Botón de Alternancia de Tema (Modo Claro / Modo Oscuro) */}
        <button
          onClick={toggleDarkMode}
          title={isDarkMode ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-main)] hover:bg-[var(--border-color)] transition-all cursor-pointer"
        >
          {isDarkMode ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700" />
          )}
        </button>
      </div>
    </header>
  );
};
