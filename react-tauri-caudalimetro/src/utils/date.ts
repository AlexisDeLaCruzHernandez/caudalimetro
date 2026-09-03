/**
 * Formatea timestamps y fechas al formato estricto YYYY/MM/DD o YYYY/MM/DD HH:mm (Requerimiento 2)
 */
export function formatDate(
  val: number | string | Date | undefined | null,
  includeTime: boolean = true
): string {
  if (val === undefined || val === null || val === "") return "";

  let d: Date;
  if (typeof val === "number") {
    // Si el timestamp es en segundos (UNIX timestamp del ESP32), convertir a ms
    d = new Date(val < 1e11 ? val * 1000 : val);
  } else if (val instanceof Date) {
    d = val;
  } else {
    d = new Date(val);
  }

  if (isNaN(d.getTime())) return "";

  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());

  if (!includeTime) {
    return `${year}/${month}/${day}`;
  }

  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}/${month}/${day} ${hours}:${minutes}`;
}
