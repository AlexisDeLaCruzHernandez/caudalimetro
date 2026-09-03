import { IDeviceService } from "./IDeviceService";
import { Device, DateRange, Sample } from "../core/types";

/**
 * Stub / Implementación para consumo directo de Supabase PostgreSQL en la nube (ADR 0004 & ADR 0005)
 * Permite que la versión Web (Vite + React SPA) consulte mediciones subidas directamente por el ESP32.
 */
export class SupabaseDeviceService implements IDeviceService {
  private supabaseUrl: string;
  private supabaseAnonKey: string;

  constructor(url?: string, key?: string) {
    this.supabaseUrl = url || import.meta.env.VITE_SUPABASE_URL || "";
    this.supabaseAnonKey = key || import.meta.env.VITE_SUPABASE_ANON_KEY || "";
  }

  async discoverDevices(): Promise<Device[]> {
    if (!this.supabaseUrl) return [];
    try {
      const res = await fetch(`${this.supabaseUrl}/rest/v1/devices?select=*`, {
        headers: {
          apikey: this.supabaseAnonKey,
          Authorization: `Bearer ${this.supabaseAnonKey}`,
        },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.map((d: any) => ({
        id: d.id,
        name: d.name,
        ip: d.ip || "cloud",
        port: 443,
        is_online: true,
        last_seen: d.updated_at,
      }));
    } catch {
      return [];
    }
  }

  async addManualDevice(ip: string, port: number = 3333): Promise<Device> {
    return {
      id: `cloud_${ip}`,
      name: `ESP32 (${ip})`,
      ip,
      port,
      is_online: true,
      is_manual: true,
    };
  }

  async removeManualDevice(_deviceId: string): Promise<void> {}

  async toggleLinkDevice(_deviceId: string, _isLinked: boolean): Promise<void> {}

  async renameDevice(_deviceId: string, _newName: string): Promise<void> {}




  async getDeviceRange(_device: Device): Promise<DateRange> {
    return { first_ts: 0, last_ts: 0 };
  }

  async syncDeviceSamples(
    _device: Device,
    _startTs: number,
    _endTs: number
  ): Promise<number> {
    return 0;
  }

  async getCachedSamples(
    deviceId: string,
    startTs: number,
    endTs: number
  ): Promise<Sample[]> {
    if (!this.supabaseUrl) return [];
    try {
      const url = `${this.supabaseUrl}/rest/v1/samples?device_id=eq.${deviceId}&timestamp=gte.${startTs}&timestamp=lte.${endTs}&select=timestamp,volume&order=timestamp.asc`;
      const res = await fetch(url, {
        headers: {
          apikey: this.supabaseAnonKey,
          Authorization: `Bearer ${this.supabaseAnonKey}`,
        },
      });
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }
}
