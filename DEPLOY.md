# Putting Kanto on a real URL (free demo/staging deploy)

This gets you a public link like `https://kanto-xxxx.onrender.com` that
anyone can open on any device — no VPN, no "run it on my machine" required.
It uses [Render](https://render.com)'s free web service tier: no credit
card, real HTTPS, auto-redeploys whenever you push to GitHub.

**Read this first — what this is and isn't:**

- Payments are still fully sandboxed. GCash/PayMaya/bank/card charges on
  this URL are fake, exactly like they are today — no real money moves.
  See "Going live for real" below for what that would actually take.
- The free tier's disk is *ephemeral*: it goes to sleep after ~15 minutes
  with no visitors, and local files (including the SQLite database) are
  wiped on every sleep/wake or redeploy. To keep the demo from ever
  looking broken, the app now **re-seeds its own demo data automatically**
  on startup if the database is empty (see the `AUTO_SEED_DEMO_DATA` note
  below) — but that also means anything a visitor creates themselves (a
  new account, listing, booking, message) disappears whenever the
  instance restarts. Fine for a demo; not fine for a real launch.
- The first visit after the instance has been asleep takes 30-60 seconds
  to wake up. Everyone will see this, not just you.
- There's no ID verification, moderation, or terms of service yet, and
  once this is public, anyone with the link can sign up and create
  listings/accounts on it. Don't post the link somewhere very public until
  you're ready for that.

## Step 1 — Push the code to GitHub

You'll need your own GitHub account for this — I can't create the repo or
authenticate as you, so these are commands to run yourself.

1. Go to [github.com/new](https://github.com/new) and create a new empty
   repository (e.g. `kanto`) — **don't** check "Add a README", so it stays
   empty and ready for a fresh push.
2. Open a terminal in your `kanto` project folder
   (`C:\Users\jjbal\Projects\kanto`) and run:

   ```
   git init
   git add .
   git commit -m "Kanto - initial deploy"
   git branch -M main
   git remote add origin https://github.com/<your-username>/kanto.git
   git push -u origin main
   ```

   Replace `<your-username>` with your actual GitHub username. If your
   terminal asks you to sign in, use your own GitHub login — that part has
   to be you.

## Step 2 — Deploy on Render (free)

1. Go to [render.com](https://render.com) and sign up (GitHub sign-in is
   the quickest way in) — the free tier needs no credit card.
2. Click **New +**. This repo includes a `render.yaml`, so Render should
   offer **New Blueprint Instance** — pick that and it pre-fills
   everything below. If that option doesn't show up, choose **New + → Web
   Service** instead and set these by hand:
   - Connect your GitHub account, then pick the `kanto` repo
   - Environment: **Node**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: **Free**
   - Add an environment variable: `NODE_VERSION` = `22.22.2`
3. Click **Create Web Service** (or **Apply**, for a Blueprint). The first
   deploy takes a minute or two.
4. Once the dashboard says **Live**, your URL is right there at the top —
   something like `https://kanto-xxxx.onrender.com`. Open it.

## Step 3 — Try it

- Demo host: `host@demo.app` / `Demo1234!`
- Demo guest: `guest@demo.app` / `Demo1234!`
- Or just sign up fresh, right on the live site.

## Good to know afterward

- Every push to `main` on GitHub auto-redeploys the live site — no need to
  touch Render again after this.
- `AUTO_SEED_DEMO_DATA` defaults to on. When you're further along and want
  a deploy that *doesn't* silently repopulate demo listings on a fresh
  disk, set that environment variable to `false` in the Render dashboard.
- The Node version is pinned to `22.22.2` (via `render.yaml` /
  `NODE_VERSION`) to exactly match what this has been tested against —
  `node:sqlite` still needs the `--experimental-sqlite` flag on this line,
  which the `npm start` script already includes.

## Going live for real (not covered by this guide)

This deploy makes the app *reachable*, not ready to handle real guests and
real money. That's a bigger step with real decisions attached, not
something to click through by accident:

- **Real payments** — a real GCash/PayMaya/bank integration instead of the
  sandbox charge, which means signing up with an actual payment
  processor/aggregator.
- **Holding renters' money in escrow** before paying hosts out (what this
  app already does logically) is a regulated activity in the Philippines
  — the BSP oversees payment system operators. Worth a conversation with a
  lawyer or accountant before real money flows through this, not
  something I can advise you on directly.
- **Persistent, non-ephemeral storage** so real accounts/listings/bookings
  don't vanish on a restart — either a paid Render plan with a persistent
  disk, or moving to a hosted database.
- **ID verification, moderation, terms of service, and a privacy policy**
  — none of that exists yet.

Say the word whenever you want to tackle that list — happy to work through
it piece by piece, the same way we've built everything else.
