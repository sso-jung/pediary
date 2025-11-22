// src/lib/dateUtils.js
export function getLocalDateKey(isoString) {
  const d = new Date(isoString);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  // 🔹 로컬 타임존 기준 YYYY-MM-DD
  return `${yyyy}-${mm}-${dd}`;
}
