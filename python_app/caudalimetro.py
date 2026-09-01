import socket
import struct
from datetime import datetime, time, timezone, timedelta
import matplotlib.pyplot as plt
import matplotlib.dates as mdates

# Configuración del servidor ESP32
ESP_IP = "192.168.1.41"  # Reemplazar con la IP asignada a tu ESP32
ESP_PORT = 3333
# Zona horaria de Argentina (UTC -3)
ARG_TZ = timezone(timedelta(hours=-3))

def parse_date(date_str):
    """Convierte un string con formato 'YYYY/MM/DD' a un objeto date."""
    try:
        return datetime.strptime(date_str, "%Y/%m/%d").date()
    except ValueError:
        return None

def recv_exact(sock, num_bytes):
    """Lee exactamente 'num_bytes' del socket para evitar lecturas incompletas."""
    buffer = bytearray()
    while len(buffer) < num_bytes:
        packet = sock.recv(num_bytes - len(buffer))
        if not packet:
            break
        buffer.extend(packet)
    return bytes(buffer)

def obtener_rango_fechas():
    """FASE 1: Se conecta al ESP32 solo para obtener el rango disponible y cierra la conexión."""
    print(f"Conectando al ESP32 en {ESP_IP}:{ESP_PORT} para obtener rango disponible...")
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    
    try:
        sock.connect((ESP_IP, ESP_PORT))
        print("¡Conexión establecida (Fase 1: Lectura de Rango)!")

        # Recibir los 8 bytes iniciales (tcp_range_response_t)
        range_data = recv_exact(sock, 8)
        if len(range_data) < 8:
            print("Error: El ESP32 no envió la cabecera de rango.")
            return None, None

        first_ts, last_ts = struct.unpack("!II", range_data)
        return first_ts, last_ts

    except Exception as e:
        print(f"Error de comunicación en Fase 1: {e}")
        return None, None
    finally:
        sock.close()
        print("Conexión de Fase 1 cerrada.")

def descargar_datos(start_ts_req, end_ts_req):
    """FASE 2: Se reconecta al ESP32, envía la solicitud y descarga las muestras."""
    print(f"\nReconectando al ESP32 en {ESP_IP}:{ESP_PORT} para solicitar datos...")
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    
    try:
        sock.connect((ESP_IP, ESP_PORT))
        print("¡Conexión reestablecida (Fase 2: Solicitud de Datos)!")

        # El ESP32 siempre envía la cabecera de rango al conectar; la leemos y descartamos.
        discard_header = recv_exact(sock, 8)
        if len(discard_header) < 8:
            print("Error: El ESP32 cerró la conexión al reconectar.")
            return None

        # Enviar la estructura tcp_request_t (8 bytes) al ESP32
        request_pkt = struct.pack("!II", start_ts_req, end_ts_req)
        sock.sendall(request_pkt)

        # Recibir las muestras devueltas por el ESP32
        DATA_T_SIZE = 6
        raw_samples = bytearray()

        print("Descargando muestras de datos...")
        while True:
            chunk = sock.recv(1024)
            if not chunk:
                break
            raw_samples.extend(chunk)

        print(f"Descarga finalizada. Total de bytes recibidos: {len(raw_samples)}")
        return raw_samples

    except Exception as e:
        print(f"Error de comunicación en Fase 2: {e}")
        return None
    finally:
        sock.close()
        print("Conexión de Fase 2 cerrada.")

def main():
    # 1. Obtener rango inicial de fechas (Fase 1)
    first_ts, last_ts = obtener_rango_fechas()
    if first_ts is None or last_ts is None:
        return

    if first_ts == 0 and last_ts == 0:
        print("El ESP32 indicó que no tiene datos guardados en memoria.")
        return

    first_date = datetime.fromtimestamp(first_ts, tz=ARG_TZ).date()
    last_date = datetime.fromtimestamp(last_ts, tz=ARG_TZ).date()

    print("\n" + "=" * 60)
    print(f"RANGO DISPONIBLE EN MEMORIA: {first_date.strftime('%Y/%m/%d')} -> {last_date.strftime('%Y/%m/%d')}")
    print("=" * 60 + "\n")

    # 2. Solicitar y validar fechas al usuario (sin límite de tiempo)
    while True:
        start_str = input("Ingrese Fecha Inicial (YYYY/MM/DD): ").strip()
        start_date_val = parse_date(start_str)

        end_str = input("Ingrese Fecha Final   (YYYY/MM/DD): ").strip()
        end_date_val = parse_date(end_str)

        if not start_date_val or not end_date_val:
            print(" Formato inválido. Use el formato YYYY/MM/DD (ej: 2026/08/02).\n")
            continue

        if start_date_val > end_date_val:
            print(" La fecha inicial no puede ser posterior a la fecha final.\n")
            continue

        if start_date_val < first_date or end_date_val > last_date:
            print(f" Las fechas deben estar dentro del rango almacenado ({first_date.strftime('%Y/%m/%d')} a {last_date.strftime('%Y/%m/%d')}).\n")
            continue

        break

    start_dt = datetime.combine(start_date_val, time(0, 0, 0)).replace(tzinfo=ARG_TZ)
    end_dt = datetime.combine(end_date_val, time(23, 59, 59)).replace(tzinfo=ARG_TZ)

    start_ts_req = int(start_dt.timestamp())
    end_ts_req = int(end_dt.timestamp())

    print(f"\nSolicitud a enviar al ESP32:")
    print(f"  Desde: {start_dt}")
    print(f"  Hasta: {end_dt}")

    # 4. Descargar las muestras (Fase 2)
    raw_samples = descargar_datos(start_ts_req, end_ts_req)
    if raw_samples is None:
        return

    # 5. Desempaquetar el buffer de muestras
    DATA_T_SIZE = 6
    times = []
    volumes = []

    total_samples = len(raw_samples) // DATA_T_SIZE
    for i in range(total_samples):
        offset = i * DATA_T_SIZE
        sample_bytes = raw_samples[offset : offset + DATA_T_SIZE]
        
        t_info, vol = struct.unpack("!IH", sample_bytes)
        
        # En el bucle de desempaquetado, usa ARG_TZ
        times.append(datetime.fromtimestamp(t_info))#, tz=ARG_TZ))
        volumes.append(vol)

    print(f"Muestras procesadas: {len(times)}")

    if not times:
        print("No se recibieron datos para el rango seleccionado.")
        return

    # 6. Graficar con Matplotlib
    print("Generando gráfico...")
    plt.figure(figsize=(12, 6))
    plt.plot(times, volumes, linestyle='-', color='tab:blue', label='Volumen')

    plt.gca().xaxis.set_major_formatter(mdates.DateFormatter('%Y/%m/%d %H:%M'))
    plt.gcf().autofmt_xdate()

    plt.title(f"Mediciones de Caudal ({start_date_val.strftime('%Y/%m/%d')} - {end_date_val.strftime('%Y/%m/%d')})")
    plt.xlabel("Fecha / Hora (UTC)")
    plt.ylabel("Volumen (Litros)")
    plt.grid(True, linestyle='--', alpha=0.5)
    plt.legend()
    plt.tight_layout()
    plt.show()

if __name__ == "__main__":
    main()
