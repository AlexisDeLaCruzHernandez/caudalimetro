import { invoke } from "@tauri-apps/api/core";
import { IDeviceService } from "./IDeviceService";
import { Device, DateRange, Sample } from "../core/types";

export class TauriDeviceService implements IDeviceService {
  async discoverDevices(): Promise<Device[]> {
    return await invoke<Device[]>("discover_devices");
  }

  async addManualDevice(ip: string, port: number = 3333): Promise<Device> {
    return await invoke<Device>("add_manual_device", { ip, port });
  }

  async removeManualDevice(deviceId: string): Promise<void> {
    await invoke("remove_manual_device", { deviceId });
  }

  async toggleLinkDevice(deviceId: string, isLinked: boolean): Promise<void> {
    await invoke("toggle_link_device", { deviceId, isLinked });
  }

  async renameDevice(deviceId: string, newName: string): Promise<void> {
    await invoke("rename_device", { deviceId, newName });
  }




  async getDeviceRange(device: Device): Promise<DateRange> {
    return await invoke<DateRange>("get_device_range", {
      ip: device.ip,
      port: device.port,
    });
  }

  async syncDeviceSamples(
    device: Device,
    targetStartTs: number,
    targetEndTs: number
  ): Promise<number> {
    return await invoke<number>("sync_device_samples", {
      deviceId: device.id,
      ip: device.ip,
      port: device.port,
      targetStartTs,
      targetEndTs,
    });
  }

  async getCachedSamples(
    deviceId: string,
    startTs: number,
    endTs: number
  ): Promise<Sample[]> {
    return await invoke<Sample[]>("get_cached_samples", {
      deviceId,
      startTs,
      endTs,
    });
  }
}
