use byteorder::{BigEndian, ReadBytesExt};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DateRange {
    pub first_ts: u32,
    pub last_ts: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Sample {
    pub timestamp: u32,
    pub volume: u16,
    #[serde(default)]
    pub monthly_accumulated: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct EspRangeResponse {
    pub first_time: u32,
    pub last_time: u32,
}

/// Obtener el rango de fechas disponibles en el ESP32 a través de HTTP GET /api/v1/range
pub async fn fetch_date_range(ip: &str, port: u16) -> Result<DateRange, String> {
    let url = format!("http://{}:{}/api/v1/range", ip, port);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Error creando cliente HTTP: {}", e))?;

    let res = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Error conectando con {}: {}", url, e))?;

    if !res.status().is_success() {
        return Err(format!("El ESP32 devolvió un código de error HTTP: {}", res.status()));
    }

    let parsed: EspRangeResponse = res
        .json()
        .await
        .map_err(|e| format!("Error parseando JSON de rango: {}", e))?;

    Ok(DateRange {
        first_ts: parsed.first_time,
        last_ts: parsed.last_time,
    })
}

/// Descargar muestras del ESP32 a través de HTTP GET /api/v1/data?start=X&end=Y
pub async fn download_samples(
    ip: &str,
    port: u16,
    start_ts: u32,
    end_ts: u32,
) -> Result<Vec<Sample>, String> {
    let url = format!(
        "http://{}:{}/api/v1/data?start={}&end={}",
        ip, port, start_ts, end_ts
    );
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Error creando cliente HTTP: {}", e))?;

    let res = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Error al solicitar muestras a {}: {}", url, e))?;

    if !res.status().is_success() {
        return Err(format!("Error en respuesta HTTP: {}", res.status()));
    }

    let raw_bytes = res
        .bytes()
        .await
        .map_err(|e| format!("Error leyendo bytes del stream HTTP: {}", e))?;

    // Desempaquetar trozos binarios de 6 bytes (!IH: u32 BE timestamp + u16 BE volume)
    const SAMPLE_SIZE: usize = 6;
    let total_samples = raw_bytes.len() / SAMPLE_SIZE;
    let mut samples = Vec::with_capacity(total_samples);

    for i in 0..total_samples {
        let offset = i * SAMPLE_SIZE;
        let mut slice = &raw_bytes[offset..offset + SAMPLE_SIZE];
        let timestamp = ReadBytesExt::read_u32::<BigEndian>(&mut slice).map_err(|e| e.to_string())?;
        let volume = ReadBytesExt::read_u16::<BigEndian>(&mut slice).map_err(|e| e.to_string())?;

        samples.push(Sample {
            timestamp,
            volume,
            monthly_accumulated: 0,
        });
    }

    Ok(samples)
}

/// Subir actualización de firmware al ESP32 a través de HTTP POST /api/v1/ota
pub async fn upload_ota_firmware(ip: &str, port: u16, firmware_bytes: Vec<u8>) -> Result<String, String> {
    let url = format!("http://{}:{}/api/v1/ota", ip, port);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("Error creando cliente HTTP: {}", e))?;

    let res = client
        .post(&url)
        .header("Content-Type", "application/octet-stream")
        .body(firmware_bytes)
        .send()
        .await
        .map_err(|e| format!("Error al transmitir firmware OTA a {}: {}", url, e))?;

    if !res.status().is_success() {
        return Err(format!("Error de reflasheo OTA (HTTP {}): {}", res.status(), res.text().await.unwrap_or_default()));
    }

    let body = res.text().await.unwrap_or_default();
    Ok(body)
}
