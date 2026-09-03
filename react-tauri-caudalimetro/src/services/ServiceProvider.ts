import { IDeviceService } from "./IDeviceService";
import { TauriDeviceService } from "./TauriDeviceService";
import { MockDeviceService } from "./MockDeviceService";
import { SupabaseDeviceService } from "./SupabaseDeviceService";
import { AppEnvironment } from "../core/types";

let currentEnvironment: AppEnvironment = detectEnvironment();
let activeService: IDeviceService = createService(currentEnvironment);

function detectEnvironment(): AppEnvironment {
  // Detectar si se está ejecutando dentro del runtime de Tauri
  if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
    return "tauri";
  }
  if (import.meta.env.VITE_SUPABASE_URL) {
    return "web";
  }
  return "mock";
}

function createService(env: AppEnvironment): IDeviceService {
  switch (env) {
    case "tauri":
      return new TauriDeviceService();
    case "web":
      return new SupabaseDeviceService();
    case "mock":
    default:
      return new MockDeviceService();
  }
}

export function getDeviceService(): IDeviceService {
  return activeService;
}

export function getCurrentEnvironment(): AppEnvironment {
  return currentEnvironment;
}

export function setEnvironmentOverride(env: AppEnvironment): IDeviceService {
  currentEnvironment = env;
  activeService = createService(env);
  return activeService;
}
