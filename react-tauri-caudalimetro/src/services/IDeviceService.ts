import { Device, DateRange, Sample } from "../core/types";

export interface IDeviceService {
  /** Descubre dispositivos en la red local o remota */
  discoverDevices(): Promise<Device[]>;

  /** Añade un dispositivo manualmente por IP o Hostname */
  addManualDevice(ip: string, port?: number): Promise<Device>;

  /** Elimina un dispositivo agregado manualmente */
  removeManualDevice(deviceId: string): Promise<void>;


  /** Vincula o desvincula un dispositivo */
  toggleLinkDevice(deviceId: string, isLinked: boolean): Promise<void>;

  /** Renombra el nombre legible del dispositivo */
  renameDevice(deviceId: string, newName: string): Promise<void>;

  /** Consulta el rango de fechas de mediciones disponibles en un dispositivo */


  getDeviceRange(device: Device): Promise<DateRange>;

  /** Sincroniza muestras de forma incremental desde el dispositivo hacia el almacenamiento */
  syncDeviceSamples(
    device: Device,
    startTs: number,
    endTs: number
  ): Promise<number>;

  /** Obtiene muestras almacenadas en el rango indicado */
  getCachedSamples(
    deviceId: string,
    startTs: number,
    endTs: number
  ): Promise<Sample[]>;
}
