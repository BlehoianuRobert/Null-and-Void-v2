/**
 * Canonical form for Wi‑Fi style MACs so DB, caregiver UI, ESP JSON, and MQTT worker agree.
 * Accepts e.g. 98:a3:16:7e:57:c0, 98-A3-16-7E-57-C0, 98A3167E57C0 → 98:A3:16:7E:57:C0
 */
export function normalizeDeviceSerial(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;

  const compact = trimmed.replace(/[:-]/g, "").toUpperCase();
  if (/^[0-9A-F]{12}$/.test(compact)) {
    return compact.match(/.{2}/g)!.join(":");
  }

  const withColons = trimmed.replace(/-/g, ":").trim();
  const parts = withColons.split(":").map((p) => p.trim().toUpperCase());
  if (parts.length === 6 && parts.every((p) => /^[0-9A-F]{2}$/.test(p))) {
    return parts.join(":");
  }

  return trimmed;
}
