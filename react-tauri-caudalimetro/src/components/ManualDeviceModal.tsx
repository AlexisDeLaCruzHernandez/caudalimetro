import React, { useState } from "react";
import { useDeviceStore } from "../store/useDeviceStore";
import { Plus, X, Server } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ManualDeviceModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [ipInput, setIpInput] = useState("");
  const { addManualDevice } = useDeviceStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ipInput.trim()) return;

    setIsSubmitting(true);
    try {
      await addManualDevice(ipInput.trim());
      setIpInput("");
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-xl w-full max-w-md p-5 text-[var(--text-main)] relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold">Agregar Dispositivo Manual</h3>
            <p className="text-xs text-[var(--text-muted)]">
              Ingresa la IP o Hostname mDNS del caudalímetro ESP32
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
              Dirección IP o Hostname
            </label>
            <input
              type="text"
              placeholder="Ej: 192.168.0.175 o esp32-flow.local"
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[var(--color-primary)] text-[var(--text-main)] placeholder-[var(--text-muted)] opacity-80"
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-main)] rounded-lg transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !ipInput.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 rounded-lg transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              {isSubmitting ? "Agregando..." : "Agregar Dispositivo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
