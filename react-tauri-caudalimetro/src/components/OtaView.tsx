import React, { useState, useEffect } from "react";
import { useDeviceStore } from "../store/useDeviceStore";
import { getDeviceService } from "../services/ServiceProvider";
import {
  Lock,
  KeyRound,
  ArrowLeft,
  UploadCloud,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileCheck,
  RefreshCw,
  // LogOut,
} from "lucide-react";

export const OtaView: React.FC = () => {
  const {
    devices,
    isOtaAuthenticated,
    authenticateOta,
    // logoutOta,
    setActiveView,
  } = useDeviceStore();

  // Estado del Gate de Contraseña
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState(false);

  // Lista de dispositivos online disponibles para flashear
  const onlineDevices = devices.filter((d) => d.is_online);

  // Estado del Formulario OTA
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(
    onlineDevices[0]?.id || ""
  );

  // ARCHIVO PERSISTENTE: Se conserva en memoria para poder flashear múltiples dispositivos
  const [loadedFile, setLoadedFile] = useState<File | null>(null);
  const [loadedBytes, setLoadedBytes] = useState<Uint8Array | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Estado de Flasheo
  const [flashStatus, setFlashStatus] = useState<
    "idle" | "uploading" | "success" | "error"
  >("idle");
  const [statusMessage, setStatusMessage] = useState("");

  // Escuchar eventos nativos de Drag & Drop de Tauri en Windows (.exe)
  useEffect(() => {
    let unlistenFn: (() => void) | undefined;

    const setupTauriDragDrop = async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const { invoke } = await import("@tauri-apps/api/core");
        const currentWin = getCurrentWindow();

        unlistenFn = await currentWin.onDragDropEvent(async (event) => {
          if (event.payload.type === "drop") {
            const paths = event.payload.paths;
            if (paths && paths.length > 0) {
              const filePath = paths[0];
              if (filePath.toLowerCase().endsWith(".bin")) {
                const fileName = filePath.split(/[\\/]/).pop() || "firmware.bin";
                try {
                  const bytes = await invoke<number[]>("read_binary_file", { path: filePath });
                  const uint8 = new Uint8Array(bytes);
                  setLoadedFile(new File([uint8], fileName));
                  setLoadedBytes(uint8);
                  setFlashStatus("idle");
                  setStatusMessage("");
                } catch (err) {
                  console.error("Error leyendo archivo vía Tauri:", err);
                  setStatusMessage("Error al leer el archivo binario arrastrado");
                }
              } else {
                setFlashStatus("error");
                setStatusMessage("Por favor selecciona un archivo con extensión .bin");
              }
            }
          }
        });
      } catch (e) {
        // Ejecución en entorno web estándar
      }
    };

    setupTauriDragDrop();

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, []);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = authenticateOta(passwordInput);
    if (!success) {
      setAuthError(true);
    } else {
      setAuthError(false);
      setPasswordInput("");
    }
  };

  // Procesamiento del archivo binario (.bin) seleccionado o soltado por Drag & Drop
  const processFile = async (file: File) => {
    if (file.name.toLowerCase().endsWith(".bin")) {
      try {
        const buffer = await file.arrayBuffer();
        setLoadedFile(file);
        setLoadedBytes(new Uint8Array(buffer));
        setFlashStatus("idle");
        setStatusMessage("");
      } catch (err) {
        console.error("Error leyendo archivo:", err);
        setFlashStatus("error");
        setStatusMessage("Error al leer el archivo binario del disco");
      }
    } else {
      setFlashStatus("error");
      setStatusMessage("Por favor selecciona un archivo con extensión .bin");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Eventos para Drag & Drop nativo HTML5
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleStartOta = async () => {
    const targetDevice = devices.find((d) => d.id === selectedDeviceId);
    if (!targetDevice) {
      setFlashStatus("error");
      setStatusMessage("Por favor selecciona un dispositivo válido");
      return;
    }
    if (!loadedBytes) {
      setFlashStatus("error");
      setStatusMessage("Por favor selecciona un archivo de firmware (.bin)");
      return;
    }

    try {
      setFlashStatus("uploading");
      setStatusMessage("");

      const service = getDeviceService();
      await service.updateFirmwareOta(targetDevice, loadedBytes);

      setFlashStatus("success");
      setStatusMessage(
        `¡Firmware transmitido con éxito a ${targetDevice.name}! El ESP32 se está reiniciando.`
      );
    } catch (err: any) {
      console.error("Error en reflasheo OTA:", err);
      setFlashStatus("error");
      setStatusMessage(
        typeof err === "string"
          ? err
          : err?.message || "Ocurrió un error al reflashear el dispositivo por OTA"
      );
    }
  };

  // -------------------------------------------------------------
  // 1. GATE DE AUTENTICACIÓN (SI NO HA VALIDADO LA CREDENCIAL)
  // -------------------------------------------------------------
  if (!isOtaAuthenticated) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[var(--bg-main)]">
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl max-w-md w-full p-8 shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-amber-500/20">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-[var(--text-main)]">
              Acceso Restringido - OTA Admin
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Ingresa la credencial de acceso para desbloquear el menú de gestión de firmware OTA.
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                <span>Credencial de Acceso</span>
              </label>
              <input
                type="password"
                placeholder="••••••••••••"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setAuthError(false);
                }}
                className={`w-full px-3 py-2 text-sm bg-[var(--bg-main)] border rounded-xl font-mono text-[var(--text-main)] focus:outline-none transition-all ${
                  authError
                    ? "border-red-500 ring-2 ring-red-500/20"
                    : "border-[var(--border-color)] focus:border-amber-500"
                }`}
              />
            </div>

            {authError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Credencial incorrecta. Acceso denegado.</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveView("dashboard")}
                className="flex-1 py-2.5 px-4 text-xs font-semibold text-[var(--text-muted)] bg-[var(--bg-main)] hover:bg-[var(--border-color)]/30 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver a la Página Principal</span>
              </button>

              <button
                type="submit"
                className="flex-1 py-2.5 px-4 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Validar Credencial</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. FORMULARIO PRINCIPAL DE OTA (VISTA COMPLETA)
  // -------------------------------------------------------------
  const selectedDevice = devices.find((d) => d.id === selectedDeviceId);

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-[var(--bg-main)]">
      <div className="max-w-4xl w-full mx-auto space-y-6">
        {/* Encabezado Superior */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-main)]">
                Gestión y Reflasheo OTA de Firmware
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Actualiza el código ejecutable de tus ESP32 conectados por red de forma centralizada.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveView("dashboard")}
              className="px-4 py-2 text-xs font-semibold text-[var(--text-main)] bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--color-primary)] rounded-xl transition-all flex items-center gap-2 shadow-2xs cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a la Página Principal</span>
            </button>
          </div>
        </div>

        {/* Panel del Formulario OTA */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-6 shadow-xl space-y-6">
          {/* PASO 1: Selección del Dispositivo */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--text-main)] flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-extrabold">
                1
              </span>
              <span>Seleccionar Dispositivo a Actualizar</span>
            </label>

            {onlineDevices.length === 0 ? (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  No hay dispositivos conectados u online en la lista. Asegúrate de tenerlos vinculados en la página principal.
                </span>
              </div>
            ) : (
              <select
                value={selectedDeviceId}
                onChange={(e) => {
                  setSelectedDeviceId(e.target.value);
                  setFlashStatus("idle");
                  setStatusMessage("");
                }}
                className="w-full px-3 py-2.5 text-sm bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl text-[var(--text-main)] font-semibold focus:outline-none focus:border-amber-500 transition-all cursor-pointer"
              >
                {onlineDevices.map((dev) => (
                  <option key={dev.id} value={dev.id}>
                    {dev.name} — {dev.ip}:{dev.port} ({dev.is_manual ? "Manual" : "mDNS"})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* PASO 2: Carga de Archivo Binario (PERSISTENTE Y DRAG & DROP) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--text-main)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-extrabold">
                  2
                </span>
                <span>Cargar Archivo Firmware (.bin)</span>
              </div>

              {loadedFile && (
                <span className="text-[11px] font-semibold text-emerald-500 flex items-center gap-1">
                  <FileCheck className="w-3.5 h-3.5" /> Archivo Retenido en Memoria
                </span>
              )}
            </label>

            {loadedFile ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileCheck className="w-6 h-6 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-[var(--text-main)] truncate">
                      {loadedFile.name}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] font-mono">
                      {(loadedFile.size / 1024).toFixed(1)} KB — Listo para ser transmitido a múltiples dispositivos
                    </p>
                  </div>
                </div>

                <label className="px-3 py-1.5 text-xs font-semibold text-amber-500 hover:bg-amber-500/10 rounded-lg border border-amber-500/30 transition-all cursor-pointer flex items-center gap-1.5 shrink-0">
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Cambiar Archivo</span>
                  <input
                    type="file"
                    accept=".bin"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            ) : (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all relative ${
                  isDragging
                    ? "border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/20 scale-[1.01]"
                    : "border-[var(--border-color)] hover:border-amber-500/50 bg-[var(--bg-main)]/40"
                }`}
              >
                <input
                  type="file"
                  accept=".bin"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <UploadCloud
                  className={`w-9 h-9 mx-auto mb-2 transition-colors ${
                    isDragging ? "text-amber-500" : "text-[var(--text-muted)]"
                  }`}
                />
                <p className="text-xs font-semibold text-[var(--text-main)]">
                  {isDragging
                    ? "¡Suelta el archivo binario aquí!"
                    : "Haz clic para examinar o arrastra el archivo ejecutable de firmware (.bin)"}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                  El archivo permanecerá retenido para que puedas flashear varios ESP32 en secuencia.
                </p>
              </div>
            )}
          </div>

          {/* PASO 3: Estado y Botón de Inicio */}
          <div className="pt-4 border-t border-[var(--border-color)] space-y-4">
            {/* MENSAJE DE ÉXITO O ERROR (ÚNICAMENTE POST-ACCION) */}
            {statusMessage && (flashStatus === "success" || flashStatus === "error") && (
              <div
                className={`p-4 rounded-xl text-xs flex items-center gap-3 ${
                  flashStatus === "success"
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    : "bg-red-500/10 border border-red-500/20 text-red-500"
                }`}
              >
                {flashStatus === "success" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                )}
                <span className="font-semibold leading-relaxed">{statusMessage}</span>
              </div>
            )}

            {/* BOTÓN DE ACCIÓN CON SU PROPIO SPINNER DE ACCIÓN */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={
                  onlineDevices.length === 0 ||
                  !loadedBytes ||
                  !selectedDevice ||
                  flashStatus === "uploading"
                }
                onClick={handleStartOta}
                className="w-full sm:w-auto px-6 py-3 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-40 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {flashStatus === "uploading" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Flasheando en Progreso...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>
                      Actualizar {selectedDevice ? selectedDevice.name : "Dispositivo"}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
