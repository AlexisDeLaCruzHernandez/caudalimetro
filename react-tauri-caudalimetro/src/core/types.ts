export interface Device {
  id: string;
  name: string;
  ip: string;
  port: number;
  is_online: boolean;
  is_manual?: boolean;
  is_linked?: boolean;
  last_seen?: string;
}


export interface DateRange {
  first_ts: number;
  last_ts: number;
}

export interface Sample {
  timestamp: number;
  volume: number;
}

export interface SyncStatus {
  deviceId: string;
  isSyncing: boolean;
  insertedCount?: number;
  error?: string;
}

export type AppEnvironment = "tauri" | "web" | "mock";
