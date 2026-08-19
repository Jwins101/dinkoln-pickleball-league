// =========================================================
// Bracket generation + rendering helpers
// A "competitor" is: { name: "Display Name", players: ["Alice"] }
//   singles -> players has 1 name, doubles -> players has 2 names
// =========================================================

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nextPowerOfTwo(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Randomly seeds a single-elimination bracket.
 * Byes are given to random competitors when the field isn't a power of 2 —
 * only round 1 can contain a bye; every later round starts empty and fills
 * in as earlier matches (including byes) are decided.
 * Returns a flat array of match objects, each with a stable id like "r1-m2".
 */
export function generateBracket(competitors, format) {
  const shuffled = shuffle(competitors);
  const size = nextPowerOfTwo(shuffled.length);
  const byesNeeded = size - shuffled.length;

  // slot list, null = bye
  const slots = shuffled.slice();
  for (let i = 0; i < byesNeeded; i++) slots.push(null);

  const round1Pairs = [];
  for (let i = 0; i < slots.length; i += 2) {
    round1Pairs.push([slots[i], slots[i + 1]]);
  }

  const totalRounds = Math.log2(size);
  const matches = [];
  let matchCounter = 0;
  let roundSize = round1Pairs.length;

  for (let r = 1; r <= totalRounds; r++) {
    for (let i = 0; i < roundSize; i++) {
      matchCounter++;
      const id = `r${r}-m${matchCounter}`;
      if (r === 1) {
        const [p1, p2] = round1Pairs[i];
        const isBye = p1 === null || p2 === null;
        const byeWinner = p1 === null ? p2 : (p2 === null ? p1 : null);
        matches.push({
          id, round: r, format,
          p1: p1 || null, p2: p2 || null,
          score1: null, score2: null,
          winner: isBye ? byeWinner : null,
          completed: isBye, bye: isBye,
        });
      } else {
        matches.push({
          id, round: r, format,
          p1: null, p2: null, score1: null, score2: null,
          winner: null, completed: false, bye: false,
        });
      }
    }
    roundSize = Math.ceil(roundSize / 2);
  }

  // Propagate any round-1 byes straight through to round 2.
  matches.filter(m => m.round === 1 && m.bye && m.completed)
    .forEach(m => advanceWinner(matches, m));

  return matches;
}

/** After scoring a match, propagate the winner into the next round's slot. */
export function advanceWinner(matches, finishedMatch) {
  const roundMatches = matches.filter(m => m.round === finishedMatch.round)
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  const idxInRound = roundMatches.findIndex(m => m.id === finishedMatch.id);
  const nextRoundMatches = matches.filter(m => m.round === finishedMatch.round + 1)
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  if (nextRoundMatches.length === 0) return null; // that was the final

  const nextMatch = nextRoundMatches[Math.floor(idxInRound / 2)];
  const isFirstFeeder = idxInRound % 2 === 0;
  if (isFirstFeeder) nextMatch.p1 = finishedMatch.winner;
  else nextMatch.p2 = finishedMatch.winner;

  return nextMatch;
}

/**
 * Swap out the competitor in slot 1 or 2 of a match (e.g. someone had to
 * leave and a substitute is stepping in). Only meant for matches that
 * haven't been played yet — for a bye "match," the sole competitor is also
 * the recorded winner, so this updates the winner and cascades the change
 * into whichever next-round slot that bye already advanced into.
 * Mutates `matches` in place and returns { updatedMatch, nextMatch }, where
 * nextMatch is the downstream match that also needed updating, or null.
 */
export function swapPlayer(matches, matchId, slotNum, newCompetitor) {
  const match = matches.find(m => m.id === matchId);
  if (!match) return { updatedMatch: null, nextMatch: null };

  const field = `p${slotNum}`;
  match[field] = newCompetitor;

  let nextMatch = null;
  if (match.bye) {
    match.winner = newCompetitor;
    nextMatch = advanceWinner(matches, match);
  }

  return { updatedMatch: match, nextMatch };
}

export function groupByRound(matches) {
  const rounds = {};
  matches.forEach(m => {
    if (!rounds[m.round]) rounds[m.round] = [];
    rounds[m.round] = rounds[m.round];
    rounds[m.round].push(m);
  });
  return Object.keys(rounds).sort((a, b) => a - b).map(k => rounds[k]);
}

export function roundLabel(roundIndex, totalRounds) {
  const fromEnd = totalRounds - roundIndex;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinals";
  if (fromEnd === 2) return "Quarterfinals";
  return `Round ${roundIndex + 1}`;
}

/** Renders the full bracket as HTML into a container element. */
export function renderBracket(container, matches, { onScore, onSwap } = {}) {
  const rounds = groupByRound(matches.sort((a, b) => a.round - b.round));
  const totalRounds = rounds.length;

  container.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "bracket";

  rounds.forEach((roundMatches, rIdx) => {
    const col = document.createElement("div");
    col.className = "bracket-round";

    const title = document.createElement("div");
    title.className = "bracket-round-title";
    title.textContent = roundLabel(rIdx, totalRounds);
    col.appendChild(title);

    roundMatches.forEach(m => {
      col.appendChild(renderMatchCard(m, { onScore, onSwap }));
    });

    wrap.appendChild(col);
  });

  container.appendChild(wrap);
}

function slotLabel(competitor) {
  if (!competitor) return "TBD";
  return competitor.name;
}

function renderMatchCard(match, { onScore, onSwap } = {}) {
  const card = document.createElement("div");
  card.className = "match";

  const badge = document.createElement("div");
  badge.className = "match-format";
  badge.textContent = match.format;
  card.appendChild(badge);

  // Locked once a real (non-bye) result has been recorded — swap before that.
  const locked = match.completed && !match.bye;

  [1, 2].forEach(n => {
    const competitor = match[`p${n}`];
    const score = match[`score${n}`];
    const row = document.createElement("div");
    let cls = "match-slot";
    if (!competitor) cls += " tbd";
    if (match.winner && competitor && match.winner.name === competitor.name) cls += " winner";
    row.className = cls;
    const nameSpan = document.createElement("span");
    nameSpan.className = "name";
    nameSpan.textContent = slotLabel(competitor);
    const rightSide = document.createElement("span");
    rightSide.style.display = "inline-flex";
    rightSide.style.alignItems = "center";
    rightSide.style.gap = "6px";
    if (onSwap && competitor && !locked) {
      const swapBtn = document.createElement("button");
      swapBtn.type = "button";
      swapBtn.className = "swap-btn";
      swapBtn.title = "Swap player";
      swapBtn.setAttribute("aria-label", "Swap player");
      swapBtn.textContent = "\u270E";
      swapBtn.onclick = (e) => { e.stopPropagation(); onSwap(match, n); };
      rightSide.appendChild(swapBtn);
    }
    const scoreSpan = document.createElement("span");
    scoreSpan.className = "score";
    scoreSpan.textContent = match.bye ? (competitor ? "" : "BYE") : (score === null || score === undefined ? "\u2013" : score);
    rightSide.appendChild(scoreSpan);
    row.appendChild(nameSpan);
    row.appendChild(rightSide);
    card.appendChild(row);
    if (n === 1) {
      const div = document.createElement("div");
      div.className = "match-divider";
      card.appendChild(div);
    }
  });

  if (onScore && match.p1 && match.p2 && !match.completed) {
    const btn = document.createElement("button");
    btn.className = "btn btn-secondary btn-sm";
    btn.style.marginTop = "10px";
    btn.style.width = "100%";
    btn.textContent = "Enter score";
    btn.onclick = () => onScore(match);
    card.appendChild(btn);
  } else if (onScore && match.completed && !match.bye) {
    const btn = document.createElement("button");
    btn.className = "btn btn-ghost btn-sm";
    btn.style.marginTop = "10px";
    btn.style.width = "100%";
    btn.textContent = "Edit score";
    btn.onclick = () => onScore(match);
    card.appendChild(btn);
  }

  return card;
}
