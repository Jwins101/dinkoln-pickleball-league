import { db, doc, getDoc, collection, query, orderBy, onSnapshot } from "./firebase-config.js";
import { qs, escapeHtml, formatDateLabel, statusLabel } from "./util.js";
import { renderBracket } from "./bracket.js";

const params = new URLSearchParams(location.search);
const eventId = params.get("id");
const header = qs("#event-header");

if (!eventId) {
  header.innerHTML = `<div class="empty-state"><p class="eyebrow">No event selected</p></div>`;
} else {
  init();
}

async function init() {
  const snap = await getDoc(doc(db, "events", eventId));
  if (!snap.exists()) {
    header.innerHTML = `<div class="empty-state"><p class="eyebrow">Event not found</p></div>`;
    return;
  }
  const ev = snap.data();
  header.innerHTML = `
    <span class="status-pill status-${ev.status}">${statusLabel(ev.status)}</span>
    <h1 style="margin-top:10px;">${escapeHtml(ev.name)}</h1>
    <p class="meta">${formatDateLabel(ev.date, ev.time)} &middot; ${formatLabel(ev.format)}</p>
  `;

  // live signup list
  const signupsQuery = query(collection(db, "events", eventId, "signups"), orderBy("timestamp", "asc"));
  onSnapshot(signupsQuery, (s) => {
    const rows = qs("#signup-rows");
    if (s.empty) {
      rows.innerHTML = `<tr><td colspan="3">No one's signed up yet &mdash; be the first!</td></tr>`;
      return;
    }
    rows.innerHTML = s.docs.map(d => {
      const su = d.data();
      return `<tr><td>${escapeHtml(su.name)}</td><td>${escapeHtml(su.format || "")}</td><td>${escapeHtml(su.partnerName || "\u2013")}</td></tr>`;
    }).join("");
  });

  // live bracket, if generated
  if (ev.status !== "upcoming") {
    qs("#bracket-section").style.display = "block";
    const matchesQuery = collection(db, "events", eventId, "matches");
    onSnapshot(matchesQuery, (s) => {
      if (s.empty) return;
      const matches = s.docs.map(d => ({ id: d.id, ...d.data() }));
      renderBracket(qs("#bracket-container"), matches, {});
    });
  }
}

function formatLabel(f) {
  return { singles: "Singles", doubles: "Doubles", both: "Singles & Doubles" }[f] || f;
}
