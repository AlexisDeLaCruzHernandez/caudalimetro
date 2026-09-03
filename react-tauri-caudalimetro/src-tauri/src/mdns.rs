use crate::db::DeviceRecord;
use mdns_sd::{ServiceDaemon, ServiceEvent};
use std::time::Duration;

pub async fn discover_mdns_devices(timeout_secs: u64) -> Vec<DeviceRecord> {
    let mut discovered = Vec::new();
    let service_types = ["_datalogger._tcp.local.", "_caudalimetro._tcp.local."];

    if let Ok(daemon) = ServiceDaemon::new() {
        for service_type in service_types {
            if let Ok(receiver) = daemon.browse(service_type) {
                let start = std::time::Instant::now();
                while start.elapsed() < Duration::from_millis(timeout_secs * 500) {
                    if let Ok(event) = receiver.recv_timeout(Duration::from_millis(150)) {
                        if let ServiceEvent::ServiceResolved(info) = event {
                            let ip_str = info
                                .get_addresses()
                                .iter()
                                .next()
                                .map(|ip| ip.to_string())
                                .unwrap_or_else(|| "127.0.0.1".to_string());

                            let fullname = info.get_fullname().to_string();
                            // Desduplicar tanto por ID como por Dirección IP
                            if !discovered.iter().any(|d: &DeviceRecord| d.id == fullname || d.ip == ip_str) {
                                let device_name = info
                                    .get_hostname()
                                    .trim_end_matches('.')
                                    .to_string();

                                discovered.push(DeviceRecord {
                                    id: fullname,
                                    name: if device_name.is_empty() {
                                        "ESP32 Caudalímetro".to_string()
                                    } else {
                                        device_name
                                    },
                                    ip: ip_str,
                                    port: info.get_port(),
                                    is_online: true,
                                    is_manual: false,
                                    is_linked: false,
                                    last_seen: Some(chrono::Utc::now().to_rfc3339()),
                                });
                            }
                        }
                    }
                }
                let _ = daemon.stop_browse(service_type);
            }
        }
    }

    discovered
}
