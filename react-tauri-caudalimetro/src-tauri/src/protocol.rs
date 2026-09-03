use byteorder::{BigEndian, ReadBytesExt, WriteBytesExt};
use serde::{Deserialize, Serialize};
use std::io;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DateRange {
    pub first_ts: u32,
    pub last_ts: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Sample {
    pub timestamp: u32,
    pub volume: u16,
}

/// Lee exactamente `num_bytes` del stream TCP asíncrono
async fn recv_exact(stream: &mut TcpStream, num_bytes: usize) -> io::Result<Vec<u8>> {
    let mut buffer = vec![0u8; num_bytes];
    let mut read_bytes = 0;
    while read_bytes < num_bytes {
        let n = stream.read(&mut buffer[read_bytes..]).await?;
        if n == 0 {
            if read_bytes == 0 {
                return Err(io::Error::new(
                    io::ErrorKind::UnexpectedEof,
                    "Conexión cerrada por el ESP32",
                ));
            } else {
                break;
            }
        }
        read_bytes += n;
    }
    buffer.truncate(read_bytes);
    Ok(buffer)
}

/// Obtener el rango de fechas disponibles en el ESP32
pub async fn fetch_date_range(ip: &str, port: u16) -> Result<DateRange, String> {
    let addr = format!("{}:{}", ip, port);
    let mut stream = TcpStream::connect(&addr)
        .await
        .map_err(|e| format!("Error al conectar con {}: {}", addr, e))?;

    let header_bytes = recv_exact(&mut stream, 8)
        .await
        .map_err(|e| format!("Error al recibir cabecera de rango: {}", e))?;

    if header_bytes.len() < 8 {
        return Err("Cabecera incompleta recibida del ESP32".to_string());
    }

    let mut cursor = &header_bytes[..];
    let first_ts = ReadBytesExt::read_u32::<BigEndian>(&mut cursor).map_err(|e| e.to_string())?;
    let last_ts = ReadBytesExt::read_u32::<BigEndian>(&mut cursor).map_err(|e| e.to_string())?;

    Ok(DateRange { first_ts, last_ts })
}

/// Descargar muestras del ESP32 para un rango especificado
pub async fn download_samples(
    ip: &str,
    port: u16,
    start_ts: u32,
    end_ts: u32,
) -> Result<Vec<Sample>, String> {
    let addr = format!("{}:{}", ip, port);
    let mut stream = TcpStream::connect(&addr)
        .await
        .map_err(|e| format!("Error al conectar con {}: {}", addr, e))?;

    // El ESP32 siempre envía los 8 bytes de cabecera de rango al conectar; los descartamos
    let header_bytes = recv_exact(&mut stream, 8)
        .await
        .map_err(|e| format!("Error al leer cabecera inicial: {}", e))?;
    if header_bytes.len() < 8 {
        return Err("ESP32 cerró la conexión prematuramente".to_string());
    }

    // Preparar el paquete de solicitud (8 bytes BigEndian: start_ts, end_ts)
    let mut req_buf = Vec::with_capacity(8);
    WriteBytesExt::write_u32::<BigEndian>(&mut req_buf, start_ts).map_err(|e| e.to_string())?;
    WriteBytesExt::write_u32::<BigEndian>(&mut req_buf, end_ts).map_err(|e| e.to_string())?;

    stream
        .write_all(&req_buf)
        .await
        .map_err(|e| format!("Error enviando solicitud al ESP32: {}", e))?;

    // Recibir los datos de las muestras en trozos
    let mut raw_data = Vec::new();
    let mut chunk = [0u8; 1024];

    loop {
        match stream.read(&mut chunk).await {
            Ok(0) => break, // EOF reached
            Ok(n) => {
                raw_data.extend_from_slice(&chunk[..n]);
            }
            Err(e) => {
                return Err(format!("Error leyendo muestras TCP: {}", e));
            }
        }
    }

    // Desempaquetar trozos de 6 bytes (!IH)
    const SAMPLE_SIZE: usize = 6;
    let total_samples = raw_data.len() / SAMPLE_SIZE;
    let mut samples = Vec::with_capacity(total_samples);

    for i in 0..total_samples {
        let offset = i * SAMPLE_SIZE;
        let mut slice = &raw_data[offset..offset + SAMPLE_SIZE];
        let timestamp = ReadBytesExt::read_u32::<BigEndian>(&mut slice).map_err(|e| e.to_string())?;
        let volume = ReadBytesExt::read_u16::<BigEndian>(&mut slice).map_err(|e| e.to_string())?;

        samples.push(Sample { timestamp, volume });
    }

    Ok(samples)
}
