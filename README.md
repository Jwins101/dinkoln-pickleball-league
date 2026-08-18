# The Dinkoln Pickleball League 🥒🏓

An internal site for scheduling pickleball events, taking sign-ups, drawing
random brackets, logging scores, and keeping season standings — built as a
static site (plain HTML/CSS/JS) with a free Firebase backend, so it can be
hosted for free on GitHub Pages.

## What it does

- **Public site** (`index.html`, `event.html`, `stats.html`) — no login
  needed. Anyone can see upcoming events, sign up for singles or doubles,
  and check the live bracket and standings.
- **Admin console** (`admin.html`) — password-protected. Create events,
  manage the attendee list (add/remove people by hand), randomly generate a
  single-elimination bracket for singles or doubles, log match scores and
  force a winner, and snapshot stats to the season standings when an event
  wraps.

Because GitHub Pages only serves static files, all the shared data (events,
sign-ups, brackets, scores, standings) lives in **Firebase Firestore**,
which has a generous free tier and needs no server of your own.

---

## Step 1 — Create your Firebase project (~5 minutes)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and click **Add project**. Name it something like `dinkoln-pickleball`. You can skip Google Analytics.
2. Once created, click the **web icon (`</>`)** on the project overview page to register a web app. Name it anything (e.g. "Dinkoln site"). You don't need Firebase Hosting — just registering the app.
3. Firebase will show you a `firebaseConfig` object that looks like this:

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "dinkoln-pickleball.firebaseapp.com",
     projectId: "dinkoln-pickleball",
     storageBucket: "dinkoln-pickleball.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   };
   ```

   Copy this whole object.

4. Open **`js/firebase-config.js`** in this project and paste your values in over the placeholder `firebaseConfig` object near the top.

## Step 2 — Turn on Firestore (your database)

1. In the Firebase console sidebar, go to **Build → Firestore Database → Create database**.
2. Choose **Start in production mode** (we'll paste in real rules next), pick a region close to you, and create it.
3. Go to the **Rules** tab and replace the contents with everything in **`firestore.rules`** from this project. Click **Publish**.

This locks it down so only a logged-in admin can create events, edit the
bracket, or touch the standings — while anyone can view and sign up.

## Step 3 — Turn on admin login

1. In the Firebase console, go to **Build → Authentication → Get started**.
2. Enable the **Email/Password** sign-in provider.
3. Go to the **Users** tab → **Add user**, and create an account for
   yourself (and any co-commissioners) with an email and password. This is
   what you'll use to log into `admin.html`.

That's the whole backend. No billing info required — this all runs on
Firebase's free Spark plan for a league-sized amount of data.

## Step 4 — Put it on GitHub Pages

1. Create a new GitHub repo (e.g. `dinkoln-pickleball-league`) and push
   everything in this folder to it.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to "Deploy from a
   branch," pick your default branch (`main`) and the `/ (root)` folder,
   then **Save**.
4. GitHub will give you a URL like
   `https://yourusername.github.io/dinkoln-pickleball-league/` — that's your
   live site. It can take a minute or two to go live after the first push.

Share the homepage link with the league. Share `admin.html` (or just tell
people to click "Admin" in the nav) with whoever's running the show.

---

## Running an event, step by step

1. **Create the event** — Admin → *New event*. Pick a name, date/time, and
   format (singles, doubles, or "both," which lets each player choose when
   they sign up).
2. **Let people sign up** — they visit the homepage and sign up with their
   name (and format/partner, if applicable). You can watch the attendee
   list fill in live from the Admin tab.
3. **Day-of clean-up** — before you draw the bracket, use *+ Add attendee*
   for walk-ups and the *Remove* button for no-shows, so the bracket only
   includes people who actually showed up.
4. **Generate the bracket** — if the event is "both," choose whether you're
   bracketing singles or doubles right now (you can generate one, run it,
   then generate the other later — regenerating only replaces the current
   bracket, not your attendee list). Click *Generate bracket* — it randomly
   seeds a single-elimination draw and hands out byes automatically if the
   field isn't a power of two.
5. **Log scores** — click *Enter score* on any match with two players in
   it. The higher score is declared the winner automatically; on a tie,
   you'll be asked to pick the winner directly (handy for a forfeit or a
   game you're just calling by hand). Winners automatically advance to the
   next round.
6. **Finalize** — once you're done for the day, click *Snapshot stats &
   mark completed*. This adds a win/loss for every completed match, gives
   everyone on the attendee list credit for attending, and folds it all
   into the `/players` collection that powers the public **Standings**
   page. It can only be run once per event.

### How points work

Out of the box: **3 points per match win, +1 point just for showing up** to
an event. Want a different scoring formula? It's one spot to change —
look for the `points = wins * 3 + 1` line in `js/admin.js` inside
`finalizeEvent()`.

---

## Project structure

```
index.html         Public homepage — event list + sign-up modal
event.html          Single event page — attendee list + live bracket
stats.html          Public standings / leaderboard
admin.html           Commissioner console (login-gated)
css/styles.css      All styling
js/firebase-config.js   Your Firebase keys + SDK imports (edit this first!)
js/util.js           Small shared helpers
js/bracket.js         Bracket generation + rendering logic
js/home.js            Homepage logic
js/event.js           Event detail page logic
js/stats.js           Standings page logic
js/admin.js            Admin console logic (the big one)
assets/logo.svg      League logo — Abe, paddle in hand
firestore.rules      Paste into Firebase Console → Firestore → Rules
```

No build step, no npm install — it's all plain HTML/CSS/JS loading Firebase
straight from Google's CDN, so editing and redeploying is just "change a
file, `git push`."

## Customizing

- **Colors/fonts** live as CSS variables at the top of `css/styles.css`.
- **Scoring formula** — see `finalizeEvent()` in `js/admin.js`.
- **Logo** — `assets/logo.svg` is hand-coded and easy to tweak (colors,
  paddle angle, etc.) in any text or vector editor.
