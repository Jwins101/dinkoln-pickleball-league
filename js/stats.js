import { db, collection, query, orderBy, onSnapshot } from "./firebase-config.js";
import { qs, escapeHtml } from "./util.js";

const rowsEl = qs("#leaderboard-rows");
const playersQuery = query(collection(db, "players"), orderBy("points", "desc"));

onSnapshot(playersQuery, (snap) => {
  if (snap.empty) {
    rowsEl.innerHTML = `<tr><td colspan="5">No stats yet &mdash; they'll show up after the first event is finalized.</td></tr>`;
    return;
  }
  rowsEl.innerHTML = snap.docs.map((d, i) => {
    const p = d.data();
    const rankClass = i < 3 ? `rank-${i + 1}` : "";
    return `<tr class="${rankClass}">
      <td>${escapeHtml(p.name)}</td>
      <td class="num">${p.points || 0}</td>
      <td class="num">${p.eventsAttended || 0}</td>
      <td class="num">${p.singlesWins || 0}&ndash;${p.singlesLosses || 0}</td>
      <td class="num">${p.doublesWins || 0}&ndash;${p.doublesLosses || 0}</td>
    </tr>`;
  }).join("");
}, (err) => {
  rowsEl.innerHTML = `<tr><td colspan="5">Couldn't load standings: ${escapeHtml(err.message)}</td></tr>`;
});
