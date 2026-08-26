# SpotiStats — Your Spotify Stats Dashboard

A small web app that shows your Spotify top artists, top tracks, recently
played songs, and what's playing right now.

```
spotify-stats/
├── client/            the frontend (React + Vite + Tailwind + Kokonut UI)
│   ├── src/
│   │   ├── App.tsx          page shell: login view / dashboard
│   │   ├── components/      dashboard panels & charts
│   │   │   └── kokonutui/   Kokonut UI components (animated backgrounds,
│   │   │                    shimmer text, glass/spotlight cards, buttons)
│   │   └── lib/api.ts       typed wrappers for the backend endpoints
│   └── dist/                built frontend (generated, served by Express)
└── server/            the backend (Node.js + Express)
    ├── server.js        handles login + talks to Spotify's API
    ├── package.json
    └── .env.example     template for your secret keys
```

## How it works, in plain terms

1. You click "Connect Spotify" → sent to Spotify's own login page.
2. You approve access → Spotify sends you back with a temporary code.
3. Our server trades that code for an **access token** (like a key that
   proves you're logged in).
4. The server uses that key to ask Spotify for your top tracks, top
   artists, and recent plays, and sends them to the webpage to display.

Your Spotify password never touches our code — only Spotify's own login
page sees it.

---

## Part 1: Get your Spotify API credentials

1. Go to https://developer.spotify.com/dashboard and log in with your
   normal Spotify account.
2. Click **Create app**. Fill in any name/description you like.
3. For **Redirect URI**, enter exactly:
   ```
   http://127.0.0.1:8888/callback
   ```
   (You can add more redirect URIs later once you deploy — see Part 3.)
4. Check the box agreeing to Spotify's terms, then **Save**.
5. On the app's page, click **Settings** to find your **Client ID** and
   **Client Secret** (click "View client secret" to reveal it).

## Part 2: Run it on your own computer first

You'll need [Node.js](https://nodejs.org) installed (version 20 or newer).

The project has two halves: the **server** (`server/`) and the **React
frontend** (`client/`). For everyday development you run both; to just use
the app, build the frontend once and let Express serve it.

### Quick start (use the app)

```bash
cd client
npm install
npm run build      # builds the frontend into client/dist

cd ../server
npm install
cp .env.example .env
```

Now open `.env` in a text editor and paste in your real values:

```
SPOTIFY_CLIENT_ID=paste_your_client_id_here
SPOTIFY_CLIENT_SECRET=paste_your_client_secret_here
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8888/callback
STATE_SECRET=any_random_string_you_want
GROQ_API_KEY=only_needed_for_the_AI_features
PORT=8888
```

Start the server:

```bash
npm start
```

Open your browser to **http://127.0.0.1:8888**, click **Connect Spotify**,
log in, and you should land back on your dashboard with your stats.

> The AI features (Taste Profile, Recap, Chat) only appear if
> `GROQ_API_KEY` is set — get a free key at https://console.groq.com.

### Development mode (hot reload)

While working on the frontend, run both processes:

```bash
# terminal 1 — backend on :8888
cd server && npm start

# terminal 2 — Vite dev server on :5173, with hot reload
cd client && npm run dev
```

Then open **http://localhost:5173**. The dev server proxies `/api`,
`/login`, `/callback`, and `/logout` to the backend automatically.

> If you see "Nothing's spinning" and empty lists, that's normal if you
> haven't played anything on Spotify recently, or if it's a brand-new
> account with little history yet.

### Running locally over HTTPS (fixes Spotify login in Brave)

Some browsers — Brave in particular — are stricter about `http://127.0.0.1`
redirect URIs than Spotify itself is, and can show a `redirect_uri: Unsafe`
error even though the app and Spotify dashboard are both configured
correctly. Your deployed Render site doesn't hit this because it already
runs over `https://`. To make your local copy behave the same way:

1. **Install [mkcert](https://github.com/FiloSottile/mkcert)** (a tool that
   creates locally-trusted HTTPS certificates — no real domain needed):
   - **Windows**: `choco install mkcert` (via [Chocolatey](https://chocolatey.org)),
     or download the `.exe` directly from mkcert's
     [releases page](https://github.com/FiloSottile/mkcert/releases)
   - **Mac**: `brew install mkcert`
   - **Linux**: see mkcert's README for your distro

2. **Install the local trust certificate once** (creates a certificate
   authority your browser will trust):
   ```bash
   mkcert -install
   ```

3. **Generate a certificate for 127.0.0.1**, run from inside your `server`
   folder:
   ```bash
   cd server
   mkdir certs
   cd certs
   mkcert 127.0.0.1
   cd ..
   ```
   This creates `server/certs/127.0.0.1.pem` and
   `server/certs/127.0.0.1-key.pem`. The server automatically detects and
   uses these — no code changes needed.

4. **Update your `.env`** so the redirect URI uses `https`:
   ```
   SPOTIFY_REDIRECT_URI=https://127.0.0.1:8888/callback
   ```

5. **Add the same URL to your Spotify dashboard** → your app → Settings →
   Redirect URIs (you can keep the old `http://` one too, it doesn't hurt):
   ```
   https://127.0.0.1:8888/callback
   ```

6. **Restart the server** (`npm start`). The startup log will now say
   `https://127.0.0.1:8888` instead of `http://`.

7. Visit `https://127.0.0.1:8888` in your browser. Since this is a
   locally-generated certificate, the first visit may still show a security
   warning in some browsers — that's expected and safe to proceed past
   (mkcert's certificate is trusted by your system, but some browsers show
   a one-time notice regardless).

If you'd rather skip this, plain `http://127.0.0.1:8888` still works fine
in Chrome, Firefox, and Edge — this is specifically a Brave quirk.

## Part 3: Deploy it so it's live on the internet

**Recommended: Render**, not Netlify. Here's why that matters: Netlify runs
backends as serverless functions — stateless and isolated per request, with
no shared memory between calls. This app stores your Spotify login token in
a plain in-memory variable on the server, so it needs a server that stays
running continuously. Render (and similar services like Railway) do exactly
that — no code changes needed. Netlify would require rewriting how login
tokens are stored (e.g. into a database), which isn't worth the complexity
for a personal testing project.

### Steps to deploy on Render

1. **Push this project to GitHub**, if it isn't already there:
   ```bash
   cd spotify-stats
   git init
   git add .
   git commit -m "Initial commit"
   ```
   Then create a new repository on https://github.com/new and follow its
   instructions to push your local commit there.

2. **Sign up / log in** at https://render.com (you can sign in with GitHub).

3. Click **New +** (top right) → **Web Service**.

4. **Connect your GitHub repo** — Render will ask for permission to see your
   repositories, then pick the one you just pushed.

5. Fill in the settings:
   - **Name**: anything, e.g. `spotify-stats`
   - **Root Directory**: leave blank (the repo root)
   - **Runtime**: Node
   - **Build Command**:
     ```
     cd client && npm install && npm run build && cd ../server && npm install
     ```
   - **Start Command**: `npm start --prefix server` (or set Root Directory
     to `server` and use `npm start`, with the client built via a custom
     build command as above)
   - **Instance Type**: Free

6. Scroll to **Environment Variables** and add these (same values as your
   local `.env`, except the redirect URI — see step 7):
   ```
   SPOTIFY_CLIENT_ID=your_client_id
   SPOTIFY_CLIENT_SECRET=your_client_secret
   SPOTIFY_REDIRECT_URI=https://your-app-name.onrender.com/callback
   STATE_SECRET=any_random_string
   ```
   You won't know your exact `.onrender.com` URL until after the first
   deploy — it's fine to guess the name for now and fix it in step 8 if it's
   different.

7. Click **Create Web Service**. Render will build and start your app —
   this takes a few minutes on the first deploy. Watch the logs; you're
   looking for a line like `Server running: http://...`.

8. Once deployed, Render shows your live URL at the top of the dashboard
   (something like `https://spotify-stats-xyz1.onrender.com`). Copy it, then:
   - Go back to **Environment Variables** on Render and make sure
     `SPOTIFY_REDIRECT_URI` is exactly `https://your-real-url.onrender.com/callback`
   - Go to https://developer.spotify.com/dashboard → your app → **Settings**
     → **Redirect URIs** → add that same URL as a new entry → **Save**
   - Back on Render, trigger a redeploy so it picks up any environment
     variable change (Render usually does this automatically after saving
     env vars, but you can also click **Manual Deploy → Deploy latest commit**)

9. Visit your `.onrender.com` URL, click **Connect Spotify**, and test it
   the same way you did locally.

### Notes on Render's free tier
- Free web services "spin down" after ~15 minutes of no traffic. The next
  visit after that will take ~30–50 seconds to wake back up — normal, not
  a bug.
- Any time you push a new commit to GitHub, Render automatically redeploys.

## Notes & limitations

- **Multi-user support**: each visitor gets their own session (via a secure
  cookie), tied to their own Spotify login — so multiple people can use the
  same deployed site and each sees their own stats. Sessions are still
  stored in the server's memory, not a database. That means: if the server
  restarts (including Render's free tier "spinning down" after ~15 minutes
  of no traffic), everyone's sessions are cleared and they'll need to log
  in again. Fine for testing with a few people; a real production app with
  many users would use a database instead.
- **Spotify's own user limit**: since your app is in Spotify's Development
  Mode, Spotify caps it at 5 authorized users total. Each person needs to
  be manually added in your Spotify Developer Dashboard (your app →
  Settings → User Management) before they can log in — otherwise Spotify
  blocks them at the login screen, regardless of anything in this app's code.
- Spotify's "top tracks/artists" reflects your listening over the last
  ~4 weeks, ~6 months, or all-time — there's no way to get a live count
  of "total minutes ever listened" from the API. For that kind of deep
  historical stat, you'd request your full data export from Spotify's
  privacy settings instead (a separate, static dataset).
- Free hosting tiers (Render, Railway) may "sleep" your app after
  inactivity — the first load after a while might take ~30 seconds to
  wake up, and (per above) clears everyone's sessions when it does.

## Ideas for extending this later

- Add a light/dark mode toggle
- Cache recently played tracks over time to build your own history
  (Spotify only gives you the last 50 plays at any moment)

## Features added: visualizations, mood, and cover art

- **Cover art**: the "now playing" hero shows the album artwork, with a
  small equalizer badge that animates while a track is actively playing.
- **Your Sound**: a bar chart of your most common genres, built from your
  top artists' genre tags.
- **Your Mood**: a rough mood breakdown (Energetic, Chill, Melancholic,
  Upbeat, etc.) inferred from those same genre tags via keyword matching
  in `public/mood-map.js`.

  **Why "inferred" and not real data**: Spotify deprecated its Audio
  Features endpoint (which used to expose real energy/valence/danceability
  scores per track) for all new apps in November 2024. Since this app is
  new, it can't access that endpoint, so mood here is a genre-based
  approximation rather than Spotify's own measurement. If you want to
  adjust the mood categories or keywords, they're easy to edit directly in
  `public/mood-map.js`.
- **Popularity bars**: each track/artist in your top lists now shows a
  thin bar reflecting Spotify's 0–100 popularity score for that item.

## Not included: daily/weekly/all-time listening minutes

Spotify's API has never exposed a "total minutes listened" stat, live or
historical — it only gives "recently played" (last ~50 tracks) and top
tracks/artists by rough time buckets. Getting real daily/weekly/all-time
minutes would require either:
- A custom tracker that polls what you're playing over time and logs it
  yourself (only counts from when you start running it, no backfill), or
- Requesting your full Extended Streaming History export from Spotify's
  privacy settings (a static file with exact past listening data, but it
  can take days to weeks to arrive).

Let me know if you'd like either of these built later.
