const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function rand(n) {
  let s = "";
  for (let i = 0; i < n; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)];
  return s;
}

// Format: FFEX-LITE-XXXX-XXXX-XXXX or FFEX-PRO-XXXX-XXXX-XXXX
export function generateLicenseKey(tier = "lite") {
  const prefix = tier === "pro" ? "FFEX-PRO" : "FFEX-LITE";
  return `${prefix}-${rand(4)}-${rand(4)}-${rand(4)}`;
}

export function normalizeKey(k) {
  if (!k) return null;
  const s = String(k).trim().toUpperCase();
  return s || null;
}
