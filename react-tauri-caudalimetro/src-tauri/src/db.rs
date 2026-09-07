use crate::protocol::Sample;
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceRecord {
    pub id: String,
    pub name: String,
    pub ip: String,
    pub port: u16,
    pub is_online: bool,
    pub is_manual: bool,
    pub is_linked: bool,
    pub last_seen: Option<String>,
}

pub struct DbState {
    pub conn: Mutex<Connection>,
}

impl DbState {
    pub fn new(db_path: &str) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        let db = DbState {
            conn: Mutex::new(conn),
        };
        db.init()?;
        Ok(db)
    }

    fn init(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "CREATE TABLE IF NOT EXISTS devices (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                ip TEXT NOT NULL,
                port INTEGER NOT NULL,
                is_online INTEGER NOT NULL,
                is_manual INTEGER NOT NULL,
                is_linked INTEGER NOT NULL DEFAULT 0,
                last_seen TEXT
            )",
            [],
        )?;

        // Intentar agregar la columna is_linked si la tabla ya existía de antes sin ella
        let _ = conn.execute(
            "ALTER TABLE devices ADD COLUMN is_linked INTEGER NOT NULL DEFAULT 0",
            [],
        );

        // Limpieza de cualquier registro duplicado legado por IP
        let _ = conn.execute(
            "DELETE FROM devices WHERE rowid NOT IN (
                SELECT MIN(rowid) FROM devices GROUP BY ip
            )",
            [],
        );

        conn.execute(
            "CREATE TABLE IF NOT EXISTS samples (
                device_id TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                volume INTEGER NOT NULL,
                monthly_accumulated INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (device_id, timestamp)
            )",
            [],
        )?;

        // Intentar agregar la columna monthly_accumulated si la tabla existía previamente
        let _ = conn.execute(
            "ALTER TABLE samples ADD COLUMN monthly_accumulated INTEGER NOT NULL DEFAULT 0",
            [],
        );

        Ok(())
    }

    pub fn set_device_online(&self, id: &str, is_online: bool) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE devices SET is_online = ?1 WHERE id = ?2",
            params![if is_online { 1 } else { 0 }, id],
        )?;
        Ok(())
    }

    pub fn upsert_device(&self, device: &DeviceRecord) -> Result<()> {

        let conn = self.conn.lock().unwrap();

        // Buscar si ya existe un registro guardado con el mismo ID, IP o Nombre
        let existing_id: Option<String> = conn
            .query_row(
                "SELECT id FROM devices WHERE id = ?1 OR ip = ?2 OR (name = ?3 AND name != '')",
                params![device.id, device.ip, device.name],
                |row| row.get(0),
            )
            .ok();

        let target_id = existing_id.unwrap_or_else(|| device.id.clone());

        conn.execute(
            "INSERT INTO devices (id, name, ip, port, is_online, is_manual, is_linked, last_seen)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(id) DO UPDATE SET
                ip=excluded.ip,
                port=excluded.port,
                is_online=excluded.is_online,
                is_linked=CASE WHEN excluded.is_linked = 1 THEN 1 ELSE devices.is_linked END,
                last_seen=excluded.last_seen",
            params![
                target_id,
                device.name,
                device.ip,
                device.port,
                if device.is_online { 1 } else { 0 },
                if device.is_manual { 1 } else { 0 },
                if device.is_linked || device.is_manual { 1 } else { 0 },
                device.last_seen
            ],
        )?;
        Ok(())
    }


    pub fn set_device_linked(&self, id: &str, is_linked: bool) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE devices SET is_linked = ?1 WHERE id = ?2",
            params![if is_linked { 1 } else { 0 }, id],
        )?;
        Ok(())
    }

    pub fn update_device_name(&self, id: &str, new_name: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE devices SET name = ?1 WHERE id = ?2",
            params![new_name, id],
        )?;
        Ok(())
    }


    pub fn get_devices(&self) -> Result<Vec<DeviceRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, ip, port, is_online, is_manual, is_linked, last_seen FROM devices",
        )?;
        let device_iter = stmt.query_map([], |row| {
            let is_online_int: i32 = row.get(4)?;
            let is_manual_int: i32 = row.get(5)?;
            let is_linked_int: i32 = row.get(6)?;
            Ok(DeviceRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                ip: row.get(2)?,
                port: row.get(3)?,
                is_online: is_online_int == 1,
                is_manual: is_manual_int == 1,
                is_linked: is_linked_int == 1 || is_manual_int == 1,
                last_seen: row.get(7)?,
            })
        })?;

        let mut devices = Vec::new();
        for dev in device_iter {
            devices.push(dev?);
        }
        Ok(devices)
    }

    pub fn get_max_timestamp(&self, device_id: &str) -> Result<Option<u32>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT MAX(timestamp) FROM samples WHERE device_id = ?1")?;
        let res: Option<u32> = stmt.query_row(params![device_id], |row| row.get(0)).unwrap_or(None);
        Ok(res)
    }

    pub fn get_min_timestamp(&self, device_id: &str) -> Result<Option<u32>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT MIN(timestamp) FROM samples WHERE device_id = ?1")?;
        let res: Option<u32> = stmt.query_row(params![device_id], |row| row.get(0)).unwrap_or(None);
        Ok(res)
    }


    pub fn save_samples_batch(&self, device_id: &str, samples: &[Sample]) -> Result<usize> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;

        let mut count = 0;
        {
            let mut stmt = tx.prepare(
                "INSERT INTO samples (device_id, timestamp, volume) VALUES (?1, ?2, ?3)
                 ON CONFLICT(device_id, timestamp) DO UPDATE SET volume = excluded.volume",
            )?;
            for sample in samples {
                stmt.execute(params![device_id, sample.timestamp, sample.volume])?;
                count += 1;
            }
        }

        // Recalcular acumulado mensual para todas las muestras guardadas del dispositivo
        {
            let mut query_stmt = tx.prepare(
                "SELECT timestamp, volume FROM samples WHERE device_id = ?1 ORDER BY timestamp ASC",
            )?;
            let rows: Vec<(u32, u16)> = query_stmt
                .query_map(params![device_id], |row| Ok((row.get(0)?, row.get(1)?)))?
                .collect::<Result<_, _>>()?;

            let mut update_stmt = tx.prepare(
                "UPDATE samples SET monthly_accumulated = ?1 WHERE device_id = ?2 AND timestamp = ?3",
            )?;

            let mut current_month_key = String::new();
            let mut running_sum: u32 = 0;

            for (ts, vol) in rows {
                let month_key = chrono::DateTime::from_timestamp(ts as i64, 0)
                    .map(|d| d.format("%Y-%m").to_string())
                    .unwrap_or_default();

                if month_key != current_month_key {
                    current_month_key = month_key;
                    running_sum = 0;
                }

                running_sum += vol as u32;
                update_stmt.execute(params![running_sum, device_id, ts])?;
            }
        }

        tx.commit()?;
        Ok(count)
    }

    pub fn get_samples(
        &self,
        device_id: &str,
        start_ts: u32,
        end_ts: u32,
    ) -> Result<Vec<Sample>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT timestamp, volume, monthly_accumulated FROM samples 
             WHERE device_id = ?1 AND timestamp >= ?2 AND timestamp <= ?3 
             ORDER BY timestamp ASC",
        )?;

        let sample_iter = stmt.query_map(params![device_id, start_ts, end_ts], |row| {
            Ok(Sample {
                timestamp: row.get(0)?,
                volume: row.get(1)?,
                monthly_accumulated: row.get(2)?,
            })
        })?;

        let mut samples = Vec::new();
        for s in sample_iter {
            samples.push(s?);
        }
        Ok(samples)
    }


    pub fn recalculate_monthly_accumulated(&self, target_device_id: Option<&str>) -> Result<usize> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;

        let device_ids: Vec<String> = match target_device_id {
            Some(id) if !id.trim().is_empty() => vec![id.to_string()],
            _ => {
                let mut stmt = tx.prepare("SELECT DISTINCT device_id FROM samples")?;
                let rows = stmt.query_map([], |row| row.get(0))?;
                rows.collect::<Result<_, _>>()?
            }
        };

        let mut total_updated = 0;

        for dev_id in device_ids {
            let mut query_stmt = tx.prepare(
                "SELECT timestamp, volume FROM samples WHERE device_id = ?1 ORDER BY timestamp ASC",
            )?;
            let rows: Vec<(u32, u16)> = query_stmt
                .query_map(params![dev_id], |row| Ok((row.get(0)?, row.get(1)?)))?
                .collect::<Result<_, _>>()?;

            let mut update_stmt = tx.prepare(
                "UPDATE samples SET monthly_accumulated = ?1 WHERE device_id = ?2 AND timestamp = ?3",
            )?;

            let mut current_month_key = String::new();
            let mut running_sum: u32 = 0;

            for (ts, vol) in rows {
                let month_key = chrono::DateTime::from_timestamp(ts as i64, 0)
                    .map(|d| d.format("%Y-%m").to_string())
                    .unwrap_or_default();

                if month_key != current_month_key {
                    current_month_key = month_key;
                    running_sum = 0;
                }

                running_sum += vol as u32;
                update_stmt.execute(params![running_sum, dev_id, ts])?;
                total_updated += 1;
            }
        }

        tx.commit()?;
        Ok(total_updated)
    }

    pub fn delete_device(&self, device_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM devices WHERE id = ?1", params![device_id])?;
        conn.execute("DELETE FROM samples WHERE device_id = ?1", params![device_id])?;
        Ok(())
    }
}

