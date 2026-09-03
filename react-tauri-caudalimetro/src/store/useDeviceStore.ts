import { create } from "zustand";
import { Device, DateRange, Sample, AppEnvironment } from "../core/types";
import {
  getDeviceService,
  getCurrentEnvironment,
  setEnvironmentOverride,
} from "../services/ServiceProvider";

interface DeviceState {
  devices: Device[];
  selectedDeviceIds: string[];
  activeDeviceId: string | null;
  dateRange: { startTs: number; endTs: number };
  deviceRanges: Record<string, DateRange>;
  samplesByDevice: Record<string, Sample[]>;
  isDiscovering: boolean;
  isSyncing: boolean;
  environment: AppEnvironment;
  isDarkMode: boolean;
  error: string | null;

  // Acciones
  discoverDevices: () => Promise<void>;
  addManualDevice: (ip: string) => Promise<void>;
  removeManualDevice: (deviceId: string) => Promise<void>;
  toggleDeviceSelection: (deviceId: string) => void;

  toggleLinkDevice: (deviceId: string, isLinked: boolean) => Promise<void>;
  selectSingleDevice: (deviceId: string) => void;
  selectedPresetLabel: string;
  setSelectedPresetLabel: (label: string) => void;
  setDateRange: (startTs: number, endTs: number, presetLabel?: string) => void;
  loadSamples: () => Promise<void>;
  syncAndFetchSamples: () => Promise<void>;
  toggleDarkMode: () => void;
  switchEnvironment: (env: AppEnvironment) => Promise<void>;
}

const sevenDaysSec = 7 * 24 * 3600;
const nowSec = Math.floor(Date.now() / 1000);

const PRESET_SECONDS_MAP: Record<string, number> = {
  "Últimos 15 mins": 15 * 60,
  "Últimos 30 mins": 30 * 60,
  "Última 1 hora": 3600,
  "Últimas 3 horas": 3 * 3600,
  "Últimas 6 horas": 6 * 3600,
  "Últimas 12 horas": 12 * 3600,
  "Últimas 24 horas": 24 * 3600,
  "Últimos 3 días": 3 * 24 * 3600,
  "Últimos 7 días": 7 * 24 * 3600,
  "Últimos 14 días": 14 * 24 * 3600,
  "Últimos 30 días": 30 * 24 * 3600,
  "Últimos 90 días": 90 * 24 * 3600,
  "Últimos 6 meses": 180 * 24 * 3600,
  "Último 1 año": 365 * 24 * 3600,
  "Historial Completo (Max)": 5 * 365 * 24 * 3600,
};

export const useDeviceStore = create<DeviceState>((set, get) => ({
  devices: [],
  selectedDeviceIds: [],
  activeDeviceId: null,
  dateRange: {
    startTs: nowSec - sevenDaysSec,
    endTs: nowSec,
  },
  selectedPresetLabel: "Últimos 7 días",
  deviceRanges: {},
  samplesByDevice: {},
  isDiscovering: false,
  isSyncing: false,
  environment: getCurrentEnvironment(),
  isDarkMode: false,
  error: null,

  setSelectedPresetLabel: (label: string) => {
    set({ selectedPresetLabel: label });
  },

  discoverDevices: async () => {
    set({ isDiscovering: true, error: null });
    try {
      const service = getDeviceService();
      const list = await service.discoverDevices();
      set({ devices: list, isDiscovering: false });

      // Seleccionar automáticamente los vinculados
      const linked = list.filter((d) => d.is_linked || d.is_manual);
      if (linked.length > 0 && get().selectedDeviceIds.length === 0) {
        set({ selectedDeviceIds: linked.map((d) => d.id), activeDeviceId: linked[0].id });
        get().loadSamples();
      }
    } catch (e: any) {
      set({ isDiscovering: false, error: e?.toString() || "Error descubriendo dispositivos" });
    }
  },

  addManualDevice: async (ip: string) => {
    set({ error: null });
    try {
      const service = getDeviceService();
      const newDev = await service.addManualDevice(ip);
      const updatedList = [...get().devices.filter((d) => d.id !== newDev.id), newDev];
      set({ devices: updatedList });
      get().toggleDeviceSelection(newDev.id);
    } catch (e: any) {
      set({ error: e?.toString() || "Error agregando dispositivo manual" });
    }
  },

  removeManualDevice: async (deviceId: string) => {
    set({ error: null });
    try {
      const service = getDeviceService();
      await service.removeManualDevice(deviceId);
      const updatedList = get().devices.filter((d) => d.id !== deviceId);
      const updatedSelected = get().selectedDeviceIds.filter((id) => id !== deviceId);
      set({
        devices: updatedList,
        selectedDeviceIds: updatedSelected,
        activeDeviceId: updatedSelected.length > 0 ? updatedSelected[0] : null,
      });
      get().loadSamples();
    } catch (e: any) {
      set({ error: e?.toString() || "Error eliminando dispositivo manual" });
    }
  },

  toggleLinkDevice: async (deviceId: string, isLinked: boolean) => {
    set({ error: null });
    try {
      const service = getDeviceService();
      await service.toggleLinkDevice(deviceId, isLinked);
      const updatedList = get().devices.map((d) =>
        d.id === deviceId ? { ...d, is_linked: isLinked } : d
      );
      set({ devices: updatedList });

      if (isLinked) {
        if (!get().selectedDeviceIds.includes(deviceId)) {
          get().toggleDeviceSelection(deviceId);
        }
      } else {
        const updatedSelected = get().selectedDeviceIds.filter((id) => id !== deviceId);
        set({
          selectedDeviceIds: updatedSelected,
          activeDeviceId: updatedSelected.length > 0 ? updatedSelected[0] : null,
        });
        get().loadSamples();
      }
    } catch (e: any) {
      set({ error: e?.toString() || "Error al cambiar estado de vinculación" });
    }
  },

  toggleDeviceSelection: (deviceId: string) => {
    const current = get().selectedDeviceIds;
    const exists = current.includes(deviceId);
    const updated = exists
      ? current.filter((id) => id !== deviceId)
      : [...current, deviceId];

    set({
      selectedDeviceIds: updated,
      activeDeviceId: updated.length > 0 ? updated[0] : null,
    });
    get().loadSamples();
  },

  selectSingleDevice: (deviceId: string) => {
    set({
      selectedDeviceIds: [deviceId],
      activeDeviceId: deviceId,
    });
    get().loadSamples();
  },

  setDateRange: (startTs: number, endTs: number, presetLabel?: string) => {
    set({
      dateRange: { startTs, endTs },
      selectedPresetLabel: presetLabel || get().selectedPresetLabel,
    });
    get().syncAndFetchSamples();
  },

  loadSamples: async () => {
    const { selectedDeviceIds, dateRange } = get();
    if (selectedDeviceIds.length === 0) return;

    const service = getDeviceService();
    const newSamplesMap: Record<string, Sample[]> = { ...get().samplesByDevice };

    for (const devId of selectedDeviceIds) {
      try {
        const samples = await service.getCachedSamples(
          devId,
          dateRange.startTs,
          dateRange.endTs
        );
        newSamplesMap[devId] = samples;
      } catch (e: any) {
        console.error(`Error cargando muestras para ${devId}:`, e);
      }
    }

    set({ samplesByDevice: newSamplesMap });
  },

  syncAndFetchSamples: async () => {
    const { selectedDeviceIds, devices, dateRange, selectedPresetLabel } = get();
    if (selectedDeviceIds.length === 0) return;

    set({ isSyncing: true, error: null });
    const service = getDeviceService();

    // 1. Refrescar la ventana de tiempo si un preset relativo está activo o si el 'Hasta' es futuro/actual
    let currentStart = dateRange.startTs;
    let currentEnd = dateRange.endTs;
    const now = Math.floor(Date.now() / 1000);

    if (selectedPresetLabel && PRESET_SECONDS_MAP[selectedPresetLabel]) {
      const durationSecs = PRESET_SECONDS_MAP[selectedPresetLabel];
      currentEnd = now;
      currentStart = now - durationSecs;
      set({ dateRange: { startTs: currentStart, endTs: currentEnd } });
    } else if (currentEnd >= now - 120) {
      currentEnd = Math.max(currentEnd, now);
      set({ dateRange: { startTs: currentStart, endTs: currentEnd } });
    }

    // 2. Ejecutar la descarga incremental para cada dispositivo seleccionado
    for (const devId of selectedDeviceIds) {
      const dev = devices.find((d) => d.id === devId);
      if (!dev) continue;

      try {
        await service.syncDeviceSamples(dev, currentStart, currentEnd);
      } catch (e: any) {
        console.warn(`Sincronización incremental omitida para ${dev.name}:`, e);
      }
    }

    set({ isSyncing: false });
    // 3. Forzar recarga de datos en la tienda y refresco reactivo de la gráfica
    await get().loadSamples();
  },


  toggleDarkMode: () => {
    const nextDark = !get().isDarkMode;
    set({ isDarkMode: nextDark });

    if (typeof document !== "undefined") {
      if (nextDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  },

  switchEnvironment: async (env: AppEnvironment) => {
    setEnvironmentOverride(env);
    set({ environment: env, devices: [], selectedDeviceIds: [], samplesByDevice: {} });
    await get().discoverDevices();
  },
}));
