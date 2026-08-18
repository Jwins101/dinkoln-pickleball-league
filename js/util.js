// Shared small helpers used across pages.

export function qs(sel, root = document) { return root.querySelector(sel); }
export function qsa(sel, root = document) { return [...root.querySelectorAll(sel)]; }

export function escapeHtml(str = "") {
  return str.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

export function formatDateLabel(dateStr, timeStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const dateLabel = dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return timeStr ? `${dateLabel} \u00B7 ${formatTimeLabel(timeStr)}` : dateLabel;
}

export function formatTimeLabel(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

let toastTimer;
export function toast(message, type = "") {
  let el = document.getElementById("__toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "__toast";
    document.body.appendChild(el);
  }
  el.className = `toast ${type}`.trim();
  el.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 3200);
}

export function slugify(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function statusLabel(status) {
  return { upcoming: "Upcoming", "in-progress": "In Progress", completed: "Completed" }[status] || status;
}
