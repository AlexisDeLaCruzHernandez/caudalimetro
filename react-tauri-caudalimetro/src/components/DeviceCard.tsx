import React from "react";
import { Device } from "../core/types";
import { useDeviceStore } from "../store/useDeviceStore";
import { Wifi, WifiOff, CheckSquare, Square, Tag, Trash2, Link2Off, Plus } from "lucide-react";


interface Props {
  device: Device;
}

export const DeviceCard: React.FC<Props> = ({ device }) => {
  const { selectedDeviceIds, toggleDeviceSelection, removeManualDevice, toggleLinkDevice } =
    useDeviceStore();
  const isSelected = selectedDeviceIds.includes(device.id);
  const isLinked = device.is_linked || device.is_manual;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`¿Deseas eliminar el dispositivo ${device.name}?`)) {
      removeManualDevice(device.id);
    }
  };

  const handleUnlink = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleLinkDevice(device.id, false);
  };

  const handleLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleLinkDevice(device.id, true);
  };

  return (
    <div
      onClick={() => isLinked && toggleDeviceSelection(device.id)}
      className={`p-3 rounded-xl border transition-all select-none flex items-start gap-2.5 relative group ${
        isLinked
          ? isSelected
            ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)] shadow-2xs cursor-pointer"
            : "bg-[var(--bg-card)] border-[var(--border-color)] hover:border-[var(--color-primary)]/50 cursor-pointer"
          : "bg-[var(--bg-main)]/60 border-[var(--border-color)] opacity-85 hover:opacity-100"
      }`}
    >
      {isLinked ? (
        <button className="mt-0.5 text-[var(--color-primary)] cursor-pointer">
          {isSelected ? (
            <CheckSquare className="w-4 h-4 fill-current text-[var(--color-primary)]" />
          ) : (
            <Square className="w-4 h-4 text-[var(--text-muted)]" />
          )}
        </button>
      ) : (
        <div className="mt-0.5 w-4 h-4" />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <h4 className="text-xs font-bold text-[var(--text-main)] truncate">
            {device.name}
          </h4>
          <span
            className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
              device.is_online
                ? "bg-[var(--status-online)]/10 text-[var(--status-online)]"
                : "bg-[var(--status-offline)]/10 text-[var(--status-offline)]"
            }`}
          >
            {device.is_online ? (
              <>
                <Wifi className="w-2.5 h-2.5" /> Online
              </>
            ) : (
              <>
                <WifiOff className="w-2.5 h-2.5" /> Offline
              </>
            )}
          </span>
        </div>

        <p className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">
          {device.ip}:{device.port}
        </p>

        <div className="flex items-center justify-between mt-2 pt-1 border-t border-[var(--border-color)]/40">
          {device.is_manual ? (
            <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] bg-[var(--bg-main)] px-1.5 py-0.5 rounded-xs">
              <Tag className="w-2.5 h-2.5" />
              <span>Manual</span>
            </div>
          ) : (
            <div />
          )}

          {isLinked ? (
            device.is_manual ? (
              <button
                onClick={handleDelete}
                title="Eliminar dispositivo manual"
                className="flex items-center gap-1 text-[10px] font-medium text-red-500 hover:bg-red-500/10 px-1.5 py-0.5 rounded-xs transition-all cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Eliminar</span>
              </button>
            ) : (
              <button
                onClick={handleUnlink}
                title="Desvincular dispositivo"
                className="flex items-center gap-1 text-[10px] font-medium text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 px-1.5 py-0.5 rounded-xs transition-all cursor-pointer"
              >
                <Link2Off className="w-3 h-3" />
                <span>Desvincular</span>
              </button>
            )
          ) : (
            <button
              onClick={handleLink}
              title="Vincular este dispositivo"
              className="flex items-center gap-1 text-[10px] font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] px-2 py-0.5 rounded-md transition-all shadow-2xs cursor-pointer ml-auto"
            >
              <Plus className="w-3 h-3" />
              <span>Vincular</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
