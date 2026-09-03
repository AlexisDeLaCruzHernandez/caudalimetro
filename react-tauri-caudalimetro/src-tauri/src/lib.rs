mod db;
mod mdns;
mod protocol;

use db::{DbState, DeviceRecord};
use protocol::{DateRange, Sample};
use std::sync::Arc;
use tauri::State;

#[tauri::command]
async fn discover_devices(state: State<'_, Arc<DbState>>) -> Result<Vec<DeviceRecord>, String> {
    // 1. Ejecutar búsqueda mDNS de 2 segundos
    let discovered = mdns::discover_mdns_devices(2).await;

    // 2. Guardar dispositivos descubiertos en la BD SQLite
    for dev in &discovered {
        let _ = state.upsert_device(dev);
    }

    // 3. Devolver lista completa de la BD (incluyendo los ingresados manualmente)
    state
        .get_devices()
        .map_err(|e| format!("Error al obtener dispositivos de SQLite: {}", e))
}

#[tauri::command]
async fn add_manual_device(
    ip: String,
    port: u16,
    state: State<'_, Arc<DbState>>,
) -> Result<DeviceRecord, String> {
    let clean_ip = ip.trim().to_string();
    if clean_ip.is_empty() {
        return Err("La dirección IP o Hostname no puede estar vacía".to_string());
    }

    let dev_id = format!("manual_{}:{}", clean_ip, port);
    let record = DeviceRecord {
        id: dev_id.clone(),
        name: format!("ESP32 ({})", clean_ip),
        ip: clean_ip,
        port,
        is_online: true,
        is_manual: true,
        is_linked: true,
        last_seen: Some(chrono::Utc::now().to_rfc3339()),
    };

    state
        .upsert_device(&record)
        .map_err(|e| format!("Error al guardar dispositivo manual: {}", e))?;

    Ok(record)
}

#[tauri::command]
async fn toggle_link_device(
    device_id: String,
    is_linked: bool,
    state: State<'_, Arc<DbState>>,
) -> Result<(), String> {
    state
        .set_device_linked(&device_id, is_linked)
        .map_err(|e| format!("Error actualizando vinculación de dispositivo: {}", e))
}

#[tauri::command]
async fn rename_device(
    device_id: String,
    new_name: String,
    state: State<'_, Arc<DbState>>,
) -> Result<(), String> {
    let clean_name = new_name.trim().to_string();
    if clean_name.is_empty() {
        return Err("El nombre del dispositivo no puede estar vacío".to_string());
    }
    state
        .update_device_name(&device_id, &clean_name)
        .map_err(|e| format!("Error renombrando dispositivo: {}", e))
}

#[tauri::command]
async fn get_device_range(ip: String, port: u16) -> Result<DateRange, String> {
    protocol::fetch_date_range(&ip, port).await
}


#[tauri::command]
async fn sync_device_samples(
    device_id: String,
    ip: String,
    port: u16,
    target_start_ts: u32,
    target_end_ts: u32,
    state: State<'_, Arc<DbState>>,
) -> Result<usize, String> {
    // 1. Consultar cobertura actual en la BD SQLite local
    let min_local_ts = state
        .get_min_timestamp(&device_id)
        .map_err(|e| e.to_string())?;

    let max_local_ts = state
        .get_max_timestamp(&device_id)
        .map_err(|e| e.to_string())?;

    // 2. Determinar el inicio de la descarga.
    // Si la BD local no tiene datos o no ha descargado desde el inicio del hardware (first_ts),
    // consultar el rango del ESP32 para ingestar todo el historial disponible.
    let fetch_start_ts = match (min_local_ts, max_local_ts) {
        (None, _) => {
            // Primera conexión: solicitar rango del hardware ESP32 para traer todo el historial
            match protocol::fetch_date_range(&ip, port).await {
                Ok(range) if range.first_ts > 0 => range.first_ts,
                _ => target_start_ts,
            }
        }
        (Some(min_ts), Some(max_ts)) => {
            // Si el rango objetivo solicita datos más antiguos de los que tenemos en SQLite
            if target_start_ts < min_ts {
                match protocol::fetch_date_range(&ip, port).await {
                    Ok(range) if range.first_ts > 0 && range.first_ts < min_ts => range.first_ts,
                    _ => target_start_ts,
                }
            } else if max_ts >= target_start_ts {
                // Sincronización incremental de deltas nuevos
                max_ts + 1
            } else {
                target_start_ts
            }
        }
        _ => target_start_ts,
    };

    if fetch_start_ts > target_end_ts {
        // Ya se tienen todos los datos sincronizados en SQLite
        return Ok(0);
    }

    // 3. Descargar el rango de muestras desde el ESP32
    let samples = protocol::download_samples(&ip, port, fetch_start_ts, target_end_ts).await?;

    // 4. Guardar las muestras recibidas en la BD SQLite
    let inserted_count = state
        .save_samples_batch(&device_id, &samples)
        .map_err(|e| format!("Error guardando muestras en SQLite: {}", e))?;

    Ok(inserted_count)
}


#[tauri::command]
async fn get_cached_samples(
    device_id: String,
    start_ts: u32,
    end_ts: u32,
    state: State<'_, Arc<DbState>>,
) -> Result<Vec<Sample>, String> {
    state
        .get_samples(&device_id, start_ts, end_ts)
        .map_err(|e| format!("Error consultando muestras en SQLite: {}", e))
}

#[tauri::command]
async fn remove_manual_device(
    device_id: String,
    state: State<'_, Arc<DbState>>,
) -> Result<(), String> {
    state
        .delete_device(&device_id)
        .map_err(|e| format!("Error eliminando dispositivo de SQLite: {}", e))
}

#[tauri::command]
async fn save_excel_file(default_name: String, bytes: Vec<u8>) -> Result<Option<String>, String> {
    let file_handle = rfd::AsyncFileDialog::new()
        .set_file_name(&default_name)
        .add_filter("Libro de Excel", &["xlsx"])
        .save_file()
        .await;

    if let Some(file) = file_handle {
        let path = file.path().to_path_buf();
        tokio::fs::write(&path, bytes)
            .await
            .map_err(|e| format!("Error escribiendo archivo Excel en disco: {}", e))?;
        Ok(Some(path.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_path = "caudalimetro_cache.db";
    let db_state = Arc::new(DbState::new(db_path).expect("Error al inicializar la BD SQLite"));

    tauri::Builder::default()
        .manage(db_state)
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            discover_devices,
            add_manual_device,
            toggle_link_device,
            rename_device,
            remove_manual_device,
            get_device_range,
            sync_device_samples,
            get_cached_samples,
            save_excel_file
        ])

        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}



