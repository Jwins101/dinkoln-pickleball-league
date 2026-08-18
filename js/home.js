import { db, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs } from "./firebase-config.js";
import { qs, qsa, escapeHtml, formatDateLabel, toast, statusLabel } from "./util.js";

const grid = qs("#event-grid");
let eventsCache = [];

const eventsQuery = query(collection(db, "events"), orderBy("date", "asc"));
onSnapshot(eventsQuery, (snap) => {
  eventsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderEvents(eventsCache);
}, (err) => {
  grid.innerHTML = `<div class="empty-state"><p class="eyebrow">Couldn't load events</p><p>${escapeHtml(err.message)}</p></div>`;
});

function renderEvents(events) {
  if (events.length === 0) {
    grid.innerHTML = `<div class="empty-state"><span class="eyebrow">No events yet</span><p>Check back soon, or ask an admin to schedule one.</p></div>`;
    return;
  }
  grid.innerHTML = "";
  events.forEach(async (ev) => {
    const card = document.createElement("div");
    card.className = "card event-card";
    card.innerHTML = `
      <span class="date-badge">${formatDateLabel(ev.date, ev.time)}</span>
      <h3>${escapeHtml(ev.name)}</h3>
      <p class="meta">Format: ${escapeHtml(formatLabel(ev.format))}</p>
      <div class="footer-row">
        <span class="status-pill status-${ev.status}">${statusLabel(ev.status)}</span>
        <div style="display:flex; gap:8px;">
          <a href="event.html?id=${ev.id}" class="btn btn-ghost btn-sm">Details</a>
          ${ev.status === "upcoming" ? `<button class="btn btn-primary btn-sm" data-signup="${ev.id}">Sign up</button>` : ""}
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  qsa("[data-signup]", grid).forEach(btn => {
    btn.addEventListener("click", () => openSignupModal(btn.dataset.signup));
  });
}

function formatLabel(f) {
  return { singles: "Singles", doubles: "Doubles", both: "Singles & Doubles" }[f] || f;
}

// --- signup modal ---
const modal = qs("#signup-modal");
const form = qs("#signup-form");
let activeEventId = null;

function openSignupModal(eventId) {
  const ev = eventsCache.find(e => e.id === eventId);
  if (!ev) return;
  activeEventId = eventId;
  qs("#modal-event-name").textContent = ev.name;
  qs("#modal-event-meta").textContent = formatDateLabel(ev.date, ev.time);
  const formatField = qs("#format-field");
  const partnerField = qs("#partner-field");
  if (ev.format === "both") {
    formatField.style.display = "block";
  } else {
    formatField.style.display = "none";
  }
  partnerField.style.display = (ev.format === "doubles" || ev.format === "both") ? "block" : "none";
  form.reset();
  modal.style.display = "flex";
}

qs("#close-modal").addEventListener("click", () => modal.style.display = "none");
modal.addEventListener("click", (e) => { if (e.target === modal) modal.style.display = "none"; });

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = qs("#su-name").value.trim();
  if (!name) return;
  const ev = eventsCache.find(e => e.id === activeEventId);
  let format = ev.format;
  if (ev.format === "both") {
    format = qs('input[name="su-format"]:checked').value;
  }
  const partnerName = qs("#su-partner").value.trim();

  const submitBtn = form.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  try {
    const existing = await getDocs(collection(db, "events", activeEventId, "signups"));
    const dupe = existing.docs.find(d => d.data().name.toLowerCase() === name.toLowerCase());
    if (dupe) {
      toast("You're already signed up for this event.", "error");
      submitBtn.disabled = false;
      return;
    }
    await addDoc(collection(db, "events", activeEventId, "signups"), {
      name, format, partnerName: partnerName || null, timestamp: serverTimestamp()
    });
    toast("You're signed up! See you on the court. \uD83C\uDFD3", "success");
    modal.style.display = "none";
  } catch (err) {
    toast(err.message, "error");
  } finally {
    submitBtn.disabled = false;
  }
});

document.addEventListener("change", (e) => {
  if (e.target.matches('.radio-chip input[type="radio"]')) {
    const group = e.target.closest('.radio-group');
    if (group) qsa('.radio-chip', group).forEach(l => l.classList.remove('checked'));
    e.target.closest('.radio-chip')?.classList.add('checked');
  }
});
