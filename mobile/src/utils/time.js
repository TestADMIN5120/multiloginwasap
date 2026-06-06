export function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function formatRelative(iso) {
  if (!iso) return '';
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diff = now - t;
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return formatTime(iso);
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

