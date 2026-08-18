import {
  db, auth, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, writeBatch, increment,
  signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "./firebase-config.js";
import { qs, qsa, escapeHtml, formatDateLabel, toast, slugify, statusLabel } from "./util.js";
import { generateBracket, advanceWinner, renderBracket } from "./bracket.js";

// ---------------------------------------------------------
// AUTH
// ---------------------------------------------------------
const loginShell = qs("#login-shell");
const adminApp = qs("#admin-app");

qs("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = qs("#login-email").value.trim();
  const password = qs("#login-password").value;
  const btn = e.target.querySelector("button");
  btn.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    toast(friendlyAuthError(err), "error");
  } finally {
    btn.disabled = false;
  }
});

qs("#logout-btn").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginShell.style.display = "none";
    adminApp.style.display = "block";
    startEventsListener();
  } else {
    loginShell.style.display = "flex";
    adminApp.style.display = "none";
  }
});

function friendlyAuthError(err) {
  if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
    return "Incorrect email or password.";
  }
  return err.message;
}

// ---------------------------------------------------------
// STATE
// ---------------------------------------------------------
let eventsCache = [];
let selectedEventId = null;
let signupsCache = [];
let matchesCache = [];
let unsubSignups = null;
let unsubMatches = null;
let chosenBracketFormat = null;
let activeMatch = null;

// ---------------------------------------------------------
// EVENTS: list + create/edit + delete
// ---------------------------------------------------------
function startEventsListener() {
  const eventsQuery = query(collection(db, "events"), orderBy("date", "desc"));
  onSnapshot(eventsQuery, (snap) => {
    eventsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderEventNav();
    if (selectedEventId) renderEventDetail(selectedEventId);
  });
}

function renderEventNav() {
  const nav = qs("#event-nav");
  if (eventsCache.length === 0) {
    nav.innerHTML = `<p class="helper-text">No events yet.</p>`;
    return;
  }
  nav.innerHTML = eventsCache.map(ev => `
    <button data-select="${ev.id}" class="${ev.id === selectedEventId ? "active" : ""}">
      ${escapeHtml(ev.name)}<br>
      <span style="font-family:var(--font-mono); font-size:0.68rem; opacity:0.75;">${formatDateLabel(ev.date, ev.time)}</span>
    </button>
  `).join("");
  qsa("[data-select]", nav).forEach(btn => {
    btn.addEventListener("click", () => selectEvent(btn.dataset.select));
  });
}

function selectEvent(id) {
  selectedEventId = id;
  renderEventNav();
  renderEventDetail(id);
}

qs("#new-event-btn").addEventListener("click", () => openEventModal());

function openEventModal(event = null) {
  qs("#event-modal-title").textContent = event ? "Edit event" : "New event";
  qs("#ev-id").value = event ? event.id : "";
  qs("#ev-name").value = event ? event.name : "";
  qs("#ev-date").value = event ? event.date : "";
  qs("#ev-time").value = event ? event.time : "";
  qs("#ev-format").value = event ? event.format : "singles";
  showModal("event-modal");
}

qs("#event-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = qs("#ev-id").value;
  const payload = {
    name: qs("#ev-name").value.trim(),
    date: qs("#ev-date").value,
    time: qs("#ev-time").value,
    format: qs("#ev-format").value,
  };
  try {
    if (id) {
      await updateDoc(doc(db, "events", id), payload);
      toast("Event updated.", "success");
    } else {
      payload.status = "upcoming";
      payload.bracketGenerated = false;
      payload.statsSnapshotted = false;
      payload.createdAt = serverTimestamp();
      const ref = await addDoc(collection(db, "events"), payload);
      selectedEventId = ref.id;
      toast("Event created.", "success");
    }
    hideModal("event-modal");
  } catch (err) {
    toast(err.message, "error");
  }
});

async function deleteEvent(id) {
  if (!confirm("Delete this event and all of its signups, bracket, and match data? This can't be undone.")) return;
  try {
    await deleteSubcollection(id, "signups");
    await deleteSubcollection(id, "matches");
    await deleteDoc(doc(db, "events", id));
    if (selectedEventId === id) {
      selectedEventId = null;
      qs("#admin-main").innerHTML = `<div class="empty-state"><p class="eyebrow">No event selected</p></div>`;
    }
    toast("Event deleted.", "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

async function deleteSubcollection(eventId, name) {
  const snap = await getDocs(collection(db, "events", eventId, name));
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

// ---------------------------------------------------------
// EVENT DETAIL VIEW
// ---------------------------------------------------------
function renderEventDetail(id) {
  const ev = eventsCache.find(e => e.id === id);
  if (!ev) return;
  chosenBracketFormat = chosenBracketFormat || (ev.format === "both" ? null : ev.format);

  const main = qs("#admin-main");
  main.innerHTML = `
    <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap;">
      <div>
        <span class="status-pill status-${ev.status}">${statusLabel(ev.status)}</span>
        <h2 style="margin-top:10px;">${escapeHtml(ev.name)}</h2>
        <p class="meta">${formatDateLabel(ev.date, ev.time)} &middot; ${formatLabel(ev.format)}</p>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-ghost btn-sm" id="edit-event-btn">Edit</button>
        <button class="btn btn-danger btn-sm" id="delete-event-btn">Delete</button>
      </div>
    </div>

    <div class="bracket-rule"><span>Attendees</span></div>
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <p class="meta" style="margin:0;" id="signup-count">Loading&hellip;</p>
        <button class="btn btn-secondary btn-sm" id="add-attendee-btn">+ Add attendee</button>
      </div>
      <table>
        <thead><tr><th>Name</th><th>Format</th><th>Partner</th><th></th></tr></thead>
        <tbody id="admin-signup-rows"><tr><td colspan="4">Loading&hellip;</td></tr></tbody>
      </table>
    </div>

    <div class="bracket-rule"><span>Bracket &amp; scores</span></div>
    <div class="card" id="bracket-card"></div>

    <div class="bracket-rule"><span>Finalize</span></div>
    <div class="card" id="finalize-card"></div>
  `;

  qs("#edit-event-btn").addEventListener("click", () => openEventModal(ev));
  qs("#delete-event-btn").addEventListener("click", () => deleteEvent(ev.id));
  qs("#add-attendee-btn").addEventListener("click", () => openAddAttendeeModal(ev));

  listenSignups(ev);
  listenMatches(ev);
  renderFinalizeCard(ev);
}

function formatLabel(f) {
  return { singles: "Singles", doubles: "Doubles", both: "Singles & Doubles" }[f] || f;
}

// ---------------------------------------------------------
// SIGNUPS (attendee list — manual add/remove)
// ---------------------------------------------------------
function listenSignups(ev) {
  if (unsubSignups) unsubSignups();
  unsubSignups = onSnapshot(collection(db, "events", ev.id, "signups"), (snap) => {
    signupsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderSignupRows(ev);
  });
}

function renderSignupRows(ev) {
  const rows = qs("#admin-signup-rows");
  const count = qs("#signup-count");
  if (!rows) return;
  count.textContent = `${signupsCache.length} signed up`;
  if (signupsCache.length === 0) {
    rows.innerHTML = `<tr><td colspan="4">No attendees yet.</td></tr>`;
    return;
  }
  rows.innerHTML = signupsCache.map(su => `
    <tr>
      <td>${escapeHtml(su.name)}</td>
      <td><span class="tag">${escapeHtml(su.format || "")}</span></td>
      <td>${escapeHtml(su.partnerName || "\u2013")}</td>
      <td><button class="btn btn-danger btn-sm" data-remove="${su.id}">Remove</button></td>
    </tr>
  `).join("");
  qsa("[data-remove]", rows).forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Remove this attendee from the event?")) return;
      await deleteDoc(doc(db, "events", ev.id, "signups", btn.dataset.remove));
    });
  });
}

function openAddAttendeeModal(ev) {
  qs("#add-attendee-form").reset();
  qs("#aa-format-field").style.display = ev.format === "both" ? "block" : "none";
  showModal("add-attendee-modal");
  qs("#add-attendee-form").onsubmit = async (e) => {
    e.preventDefault();
    const name = qs("#aa-name").value.trim();
    if (!name) return;
    const format = ev.format === "both" ? qs('input[name="aa-format"]:checked').value : ev.format;
    const partnerName = qs("#aa-partner").value.trim();
    try {
      await addDoc(collection(db, "events", ev.id, "signups"), {
        name, format, partnerName: partnerName || null, timestamp: serverTimestamp(), addedByAdmin: true
      });
      hideModal("add-attendee-modal");
      toast("Attendee added.", "success");
    } catch (err) {
      toast(err.message, "error");
    }
  };
}

// ---------------------------------------------------------
// BRACKET GENERATION + SCORING
// ---------------------------------------------------------
function listenMatches(ev) {
  if (unsubMatches) unsubMatches();
  unsubMatches = onSnapshot(collection(db, "events", ev.id, "matches"), (snap) => {
    matchesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderBracketCard(ev);
  });
}

function renderBracketCard(ev) {
  const card = qs("#bracket-card");
  if (!card) return;

  const controlsHtml = `
    ${ev.format === "both" ? `
      <div class="field">
        <label>Which format are you bracketing right now?</label>
        <div class="radio-group" id="bracket-format-choice">
          <label class="radio-chip ${chosenBracketFormat === "singles" ? "checked" : ""}"><input type="radio" name="bf" value="singles" ${chosenBracketFormat === "singles" ? "checked" : ""}> Singles</label>
          <label class="radio-chip ${chosenBracketFormat === "doubles" ? "checked" : ""}"><input type="radio" name="bf" value="doubles" ${chosenBracketFormat === "doubles" ? "checked" : ""}> Doubles</label>
        </div>
      </div>
    ` : ""}
    <button class="btn btn-secondary" id="generate-bracket-btn">${matchesCache.length ? "Regenerate bracket (random)" : "Generate bracket (random)"}</button>
    <p class="helper-text" style="margin-top:10px;">Draws randomly from everyone currently signed up for this format. ${matchesCache.length ? "Regenerating will erase current matches and scores." : ""}</p>
  `;

  card.innerHTML = controlsHtml + `<div id="bracket-render-target" style="margin-top:16px;"></div>`;

  if (ev.format === "both") {
    qsa('input[name="bf"]', card).forEach(inp => inp.addEventListener("change", () => {
      chosenBracketFormat = inp.value;
      renderBracketCard(ev);
    }));
  }

  qs("#generate-bracket-btn").addEventListener("click", () => generateBracketForEvent(ev));

  const target = qs("#bracket-render-target");
  if (matchesCache.length) {
    renderBracket(target, matchesCache, { onScore: (m) => openScoreModal(ev, m) });
  } else {
    target.innerHTML = `<p class="helper-text">No bracket yet.</p>`;
  }
}

async function generateBracketForEvent(ev) {
  const format = ev.format === "both" ? chosenBracketFormat : ev.format;
  if (!format) { toast("Choose singles or doubles first.", "error"); return; }
  if (matchesCache.length && !confirm("This wipes the current bracket and all scores. Continue?")) return;

  const relevant = signupsCache.filter(su => su.format === format);
  let competitors = [];

  if (format === "singles") {
    competitors = relevant.map(su => ({ name: su.name, players: [su.name] }));
  } else {
    const { teams, leftover } = formDoublesTeams(relevant);
    competitors = teams;
    if (leftover.length) {
      toast(`Couldn't pair: ${leftover.map(p => p.name).join(", ")}. Left out of the bracket.`, "error");
    }
  }

  if (competitors.length < 2) {
    toast("Need at least 2 players (or teams) to generate a bracket.", "error");
    return;
  }

  const matches = generateBracket(competitors, format);

  try {
    await deleteSubcollection(ev.id, "matches");
    const batch = writeBatch(db);
    matches.forEach(m => batch.set(doc(db, "events", ev.id, "matches", m.id), m));
    batch.set(doc(db, "events", ev.id), { status: "in-progress", bracketGenerated: true, bracketFormat: format }, { merge: true });
    await batch.commit();
    toast("Bracket generated!", "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

function formDoublesTeams(signups) {
  const used = new Set();
  const byName = new Map(signups.map(s => [s.name.toLowerCase(), s]));
  const teams = [];

  // pair explicit partners first
  signups.forEach(su => {
    if (used.has(su.name.toLowerCase())) return;
    if (su.partnerName) {
      const partner = byName.get(su.partnerName.trim().toLowerCase());
      if (partner && !used.has(partner.name.toLowerCase()) && partner.name.toLowerCase() !== su.name.toLowerCase()) {
        teams.push({ name: `${su.name} & ${partner.name}`, players: [su.name, partner.name] });
        used.add(su.name.toLowerCase());
        used.add(partner.name.toLowerCase());
      }
    }
  });

  // randomly pair whoever's left
  const remaining = signups.filter(s => !used.has(s.name.toLowerCase()));
  const shuffled = remaining.slice().sort(() => Math.random() - 0.5);
  const leftover = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    if (shuffled[i + 1]) {
      teams.push({ name: `${shuffled[i].name} & ${shuffled[i + 1].name}`, players: [shuffled[i].name, shuffled[i + 1].name] });
    } else {
      leftover.push(shuffled[i]);
    }
  }

  return { teams, leftover };
}

function openScoreModal(ev, match) {
  activeMatch = { ev, match };
  qs("#score-p1-label").textContent = match.p1?.name || "Player 1";
  qs("#score-p2-label").textContent = match.p2?.name || "Player 2";
  qs("#score-p1").value = match.score1 ?? "";
  qs("#score-p2").value = match.score2 ?? "";
  qs("#score-tie-note").style.display = "none";
  qs("#force-winner-field").style.display = "none";
  qs("#force-winner-group").innerHTML = `
    <label class="radio-chip"><input type="radio" name="force-winner" value="1"> ${escapeHtml(match.p1?.name || "")}</label>
    <label class="radio-chip"><input type="radio" name="force-winner" value="2"> ${escapeHtml(match.p2?.name || "")}</label>
  `;
  showModal("score-modal");
}

qs("#score-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!activeMatch) return;
  const { ev, match } = activeMatch;
  const score1 = Number(qs("#score-p1").value);
  const score2 = Number(qs("#score-p2").value);

  let winner = null;
  if (score1 > score2) winner = match.p1;
  else if (score2 > score1) winner = match.p2;
  else {
    const forced = qs('input[name="force-winner"]:checked');
    if (!forced) {
      qs("#score-tie-note").style.display = "block";
      qs("#force-winner-field").style.display = "block";
      return;
    }
    winner = forced.value === "1" ? match.p1 : match.p2;
  }

  try {
    const updatedMatch = { ...match, score1, score2, winner, completed: true };
    await updateDoc(doc(db, "events", ev.id, "matches", match.id), { score1, score2, winner, completed: true });

    const workingSet = matchesCache.map(m => m.id === match.id ? updatedMatch : m);
    const nextMatch = advanceWinner(workingSet, updatedMatch);
    if (nextMatch) {
      await updateDoc(doc(db, "events", ev.id, "matches", nextMatch.id), { p1: nextMatch.p1, p2: nextMatch.p2 });
    }

    hideModal("score-modal");
    toast("Score saved.", "success");
  } catch (err) {
    toast(err.message, "error");
  }
});

// ---------------------------------------------------------
// FINALIZE: snapshot stats into /players
// ---------------------------------------------------------
function renderFinalizeCard(ev) {
  const card = qs("#finalize-card");
  if (!card) return;
  if (ev.statsSnapshotted) {
    card.innerHTML = `<p class="meta">&#9989; Stats already snapshotted for this event. Standings have been updated.</p>`;
    return;
  }
  card.innerHTML = `
    <p class="meta">This tallies wins/losses and points for everyone currently on the attendee list, based on completed matches, and adds it to the season standings. Do this once, after the event wraps.</p>
    <button class="btn btn-primary" id="finalize-btn">Snapshot stats &amp; mark completed</button>
  `;
  qs("#finalize-btn").addEventListener("click", () => finalizeEvent(ev));
}

async function finalizeEvent(ev) {
  if (!confirm("Snapshot stats for this event? This updates the league standings and can only be done once.")) return;
  try {
    const stats = {}; // name -> { wins, losses, format }
    const touch = (name, field) => {
      const key = name.toLowerCase();
      if (!stats[key]) stats[key] = { name, singlesWins: 0, singlesLosses: 0, doublesWins: 0, doublesLosses: 0 };
      stats[key][field]++;
    };

    matchesCache.filter(m => m.completed && !m.bye && m.winner).forEach(m => {
      const loser = m.winner.name === m.p1?.name ? m.p2 : m.p1;
      (m.winner.players || []).forEach(p => touch(p, m.format === "doubles" ? "doublesWins" : "singlesWins"));
      if (loser) (loser.players || []).forEach(p => touch(p, m.format === "doubles" ? "doublesLosses" : "singlesLosses"));
    });

    // everyone on the attendee list gets participation credit, win/loss credit layered on top
    signupsCache.forEach(su => {
      const key = su.name.toLowerCase();
      if (!stats[key]) stats[key] = { name: su.name, singlesWins: 0, singlesLosses: 0, doublesWins: 0, doublesLosses: 0 };
    });

    const batch = writeBatch(db);
    Object.values(stats).forEach(s => {
      const wins = s.singlesWins + s.doublesWins;
      const points = wins * 3 + 1; // 3 pts/win + 1 pt for showing up
      const playerRef = doc(db, "players", slugify(s.name));
      batch.set(playerRef, {
        name: s.name,
        points: increment(points),
        eventsAttended: increment(1),
        singlesWins: increment(s.singlesWins),
        singlesLosses: increment(s.singlesLosses),
        doublesWins: increment(s.doublesWins),
        doublesLosses: increment(s.doublesLosses),
      }, { merge: true });
    });
    batch.set(doc(db, "events", ev.id), { statsSnapshotted: true, status: "completed" }, { merge: true });
    await batch.commit();

    toast("Standings updated!", "success");
  } catch (err) {
    toast(err.message, "error");
  }
}

// ---------------------------------------------------------
// MODAL HELPERS
// ---------------------------------------------------------
function showModal(id) { qs(`#${id}`).style.display = "flex"; }
function hideModal(id) { qs(`#${id}`).style.display = "none"; }

qsa("[data-close-modal]").forEach(btn => {
  btn.addEventListener("click", () => hideModal(btn.dataset.closeModal));
});
qsa(".modal-backdrop").forEach(backdrop => {
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) backdrop.style.display = "none"; });
});
// delegated so it also covers radio chips that get added dynamically later
document.addEventListener("change", (e) => {
  if (e.target.matches('.radio-chip input[type="radio"]')) {
    const group = e.target.closest('.radio-group');
    if (group) qsa('.radio-chip', group).forEach(l => l.classList.remove('checked'));
    e.target.closest('.radio-chip')?.classList.add('checked');
  }
});
