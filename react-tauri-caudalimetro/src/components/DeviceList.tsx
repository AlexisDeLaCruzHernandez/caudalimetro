import React, { useState } from "react";
import { useDeviceStore } from "../store/useDeviceStore";
import { DeviceCard } from "./DeviceCard";
import { ManualDeviceModal } from "./ManualDeviceModal";
import { Cpu, RefreshCw, Plus, Search, Link, Radio } from "lucide-react";

export const DeviceList: React.FC = () => {
  const { devices, isDiscovering, discoverDevices } = useDeviceStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");

  const filteredDevices = devices.filter(
    (d) =>
      d.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      d.ip.includes(filterQuery)
  );

  const linkedDevices = filteredDevices.filter((d) => d.is_linked || d.is_manual);
  const availableDevices = filteredDevices.filter(
    (d) =>
      !d.is_linked &&
      !d.is_manual &&
      !linkedDevices.some(
        (l) => l.id === d.id || l.ip === d.ip || (l.name === d.name && l.name !== "")
      )
  );


  return (
    <aside className="w-80 bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] flex flex-col shrink-0">
      {/* Header & Acciones */}
      <div className="p-3 border-b border-[var(--border-color)] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[var(--text-main)] font-bold text-xs">
            <Cpu className="w-4 h-4 text-[var(--color-primary)]" />
            <span>Dispositivos</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => discoverDevices()}
              disabled={isDiscovering}
              title="Buscar en red local (mDNS / IP)"
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card)] rounded-md transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isDiscovering ? "animate-spin" : ""}`} />
            </button>

            <button
              onClick={() => setIsModalOpen(true)}
              title="Agregar IP manualmente"
              className="p-1.5 text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-md transition-all cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Buscador de Dispositivos */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Buscar por nombre o IP..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg focus:outline-hidden text-[var(--text-main)] placeholder-[var(--text-muted)]"
          />
        </div>
      </div>

      {/* Secciones de Dispositivos (Vinculados vs Disponibles) */}
      <div className="flex-1 p-3 overflow-y-auto space-y-4">
        {/* Sección 1: Dispositivos Vinculados */}
        <div>
          <div className="flex items-center justify-between mb-2 pb-1 border-b border-[var(--border-color)]/60">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-main)] uppercase tracking-wider">
              <Link className="w-3 h-3 text-[var(--color-primary)]" />
              <span>Vinculados ({linkedDevices.length})</span>
            </div>
          </div>

          {linkedDevices.length === 0 ? (
            <div className="text-center text-xs text-[var(--text-muted)] py-4 px-2 bg-[var(--bg-card)]/50 rounded-xl border border-dashed border-[var(--border-color)]">
              <p>Sin dispositivos vinculados.</p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-1.5 text-[var(--color-primary)] font-semibold text-[11px] hover:underline cursor-pointer"
              >
                + Agregar por IP manual
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {linkedDevices.map((dev) => (
                <DeviceCard key={dev.id} device={dev} />
              ))}
            </div>
          )}
        </div>

        {/* Sección 2: Dispositivos Disponibles para Vincular */}
        <div>
          <div className="flex items-center justify-between mb-2 pb-1 border-b border-[var(--border-color)]/60">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              <Radio className="w-3 h-3 text-emerald-500" />
              <span>Disponibles en Red ({availableDevices.length})</span>
            </div>
          </div>

          {availableDevices.length === 0 ? (
            <div className="text-center text-[11px] text-[var(--text-muted)] py-3 px-2">
              <p>No se encontraron nuevos caudalímetros en la red local.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableDevices.map((dev) => (
                <DeviceCard key={dev.id} device={dev} />
              ))}
            </div>
          )}
        </div>
      </div>

      <ManualDeviceModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </aside>
  );
};
