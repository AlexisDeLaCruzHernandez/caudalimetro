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
    // Sincronización Incremental:
    // 1. Verificar cuál es el timestamp máximo guardado en la BD SQLite para este dispositivo
    let max_local_ts = state
        .get_max_timestamp(&device_id)
        .map_err(|e| e.to_string())?;

    // 2. Determinar el inicio efectivo de la descarga
    let fetch_start_ts = match max_local_ts {
        Some(max_ts) if max_ts >= target_start_ts => max_ts + 1,
        _ => target_start_ts,
    };

    if fetch_start_ts > target_end_ts {
        // Ya se tienen todos los datos sincronizados en SQLite
        return Ok(0);
    }

    // 3. Descargar únicamente el rango faltante desde el ESP32
    let samples = protocol::download_samples(&ip, port, fetch_start_ts, target_end_ts).await?;

    // 4. Guardar las nuevas muestras en SQLite
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
            remove_manual_device,
            get_device_range,
            sync_device_samples,
            get_cached_samples
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


