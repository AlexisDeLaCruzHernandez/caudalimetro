import { IDeviceService } from "./IDeviceService";
import { Device, DateRange, Sample } from "../core/types";

export class MockDeviceService implements IDeviceService {
  private devices: Device[] = [
    {
      id: "mock_esp32_1",
      name: "ESP32 Caudalímetro Tanque Principal",
      ip: "192.168.0.175",
      port: 3333,
      is_online: true,
      is_manual: false,
      last_seen: new Date().toISOString(),
    },
    {
      id: "mock_esp32_2",
      name: "ESP32 Caudalímetro Sector Riego",
      ip: "192.168.0.180",
      port: 3333,
      is_online: true,
      is_manual: false,
      last_seen: new Date().toISOString(),
    },
  ];

  private samplesStore: Map<string, Sample[]> = new Map();

  constructor() {
    this.generateMockSamples("mock_esp32_1", 100);
    this.generateMockSamples("mock_esp32_2", 80);
  }

  private generateMockSamples(deviceId: string, baseVolume: number) {
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysSec = 30 * 24 * 3600;
    const startTime = now - thirtyDaysSec;
    const intervalSec = 3600; // Muestra cada 1 hora

    const samples: Sample[] = [];
    let curTime = startTime;
    let cumVolume = 1000;

    while (curTime <= now) {
      // Simular variación de consumo durante el día
      const hour = new Date(curTime * 1000).getHours();
      const peakFactor = (hour >= 7 && hour <= 10) || (hour >= 18 && hour <= 22) ? 2.5 : 0.8;
      const flow = Math.round((Math.sin(curTime / 10000) * 15 + baseVolume) * peakFactor);

      cumVolume += Math.max(5, flow);
      samples.push({
        timestamp: curTime,
        volume: cumVolume,
      });

      curTime += intervalSec;
    }

    this.samplesStore.set(deviceId, samples);
  }

  async discoverDevices(): Promise<Device[]> {
    await new Promise((res) => setTimeout(res, 500));
    return [...this.devices];
  }

  async addManualDevice(ip: string, port: number = 3333): Promise<Device> {
    await new Promise((res) => setTimeout(res, 300));
    const newDev: Device = {
      id: `manual_${ip}:${port}`,
      name: `ESP32 (${ip})`,
      ip,
      port,
      is_online: true,
      is_manual: true,
      last_seen: new Date().toISOString(),
    };
    this.devices.push(newDev);
    this.generateMockSamples(newDev.id, 90);
    return newDev;
  }

  async removeManualDevice(deviceId: string): Promise<void> {
    await new Promise((res) => setTimeout(res, 200));
    this.devices = this.devices.filter((d) => d.id !== deviceId);
    this.samplesStore.delete(deviceId);
  }

  async toggleLinkDevice(deviceId: string, isLinked: boolean): Promise<void> {
    await new Promise((res) => setTimeout(res, 100));
    const dev = this.devices.find((d) => d.id === deviceId);
    if (dev) {
      dev.is_linked = isLinked;
    }
  }



  async getDeviceRange(device: Device): Promise<DateRange> {
    const samples = this.samplesStore.get(device.id) || [];
    if (samples.length === 0) {
      return { first_ts: 0, last_ts: 0 };
    }
    return {
      first_ts: samples[0].timestamp,
      last_ts: samples[samples.length - 1].timestamp,
    };
  }

  async syncDeviceSamples(
    _device: Device,
    _startTs: number,
    _endTs: number
  ): Promise<number> {
    await new Promise((res) => setTimeout(res, 400));
    return 0; // En Mock ya están generados
  }

  async getCachedSamples(
    deviceId: string,
    startTs: number,
    endTs: number
  ): Promise<Sample[]> {
    await new Promise((res) => setTimeout(res, 200));
    const samples = this.samplesStore.get(deviceId) || [];
    return samples.filter((s) => s.timestamp >= startTs && s.timestamp <= endTs);
  }
}
