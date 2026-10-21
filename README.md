<p align="center">
  <img src="docs/assets/spotistats-banner.svg" alt="SpotiStats" width="100%" />
</p>

<p align="center">
  <strong>Your listening, in focus.</strong><br />
  A personal Spotify dashboard for the songs, artists, and habits that make your sound.
</p>

<p align="center">
  <a href="https://spoti-neon.vercel.app/"><strong>Open SpotiStats ↗</strong></a> ·
  <a href="#features">Features</a> ·
  <a href="#getting-started">Getting started</a> ·
  <a href="#configuration">Configuration</a> ·
  <a href="#deployment">Deployment</a>
</p>

SpotiStats turns your Spotify listening data into a personal dashboard. Explore your favorite artists and tracks, see when you listen, and discover the release decades behind your current rotation. Built with React, TypeScript, and Kokonut UI, with Spotify authentication handled by Express.

**Live site:** [spoti-neon.vercel.app](https://spoti-neon.vercel.app/). Spotify data access follows the app's Development Mode restrictions; a public website does not make Spotify API access available to every visitor. See [Spotify access](#spotify-access).

## Preview

![SpotiStats landing page with Tasteprint S branding, Connect Spotify button, sample top tracks, and a listening heatmap](docs/assets/sign-in.png)

*The production sign-in page. Its preview uses labeled sample data; your dashboard loads data from your connected Spotify account.*

## Features

| Area | What you can explore |
| --- | --- |
| **Favorites** | Top artists and tracks across Spotify's short-term, medium-term, and long-term ranges. |
| **Listening patterns** | A day-and-hour heatmap and playlist activity based on your latest 50 plays. |
| **Daily Top** | A line chart showing daily play counts for each day's leading artist and track, with details on hover or selection. |
| **Your Sound** | Interactive bubbles showing genre counts, with an artist-mix fallback when Spotify omits genre tags. |
| **Your Music Eras** | A donut chart grouping top tracks by album release decade, with leading decades and oldest/newest release years. |
| **Current playback** | Album artwork, track details, playback progress, and device name, refreshed every 15 seconds. |
| **Library** | Counts of followed artists, liked songs, saved albums, and playlists, plus a playlist carousel. |
| **Optional AI insights** | A taste profile, recent-listening recap, and chat about your stats, powered by Groq. |
| **Interface** | Responsive layouts, keyboard controls, reduced-motion support, spotlight cards, animated beams, and an interactive dot background. |

## Technology

| Layer | Stack |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS, Kokonut UI, Motion, Recharts |
| Backend | Node.js, Express, Axios |
| Integrations | Spotify Web API; optional Groq API |
| Hosting | Vercel static frontend and Express serverless function |
| Sessions | Encrypted cookies on Vercel; in-memory storage locally; optional PostgreSQL |

## Spotify access

The hosted app uses Spotify's Development Mode. Access to personal stats depends on the Spotify app's allowlist and API availability.

> [!IMPORTANT]
> Spotify requires the **owner of a Development Mode app to have an active Premium subscription**. Additional users must be added to the app's allowlist. A user may be able to sign in while API requests still return `403`. See [Spotify's quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes) for current requirements.

To run your own instance, create a Spotify developer app and use your own credentials as described below.

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) **22.12 or newer** and npm.
- A Spotify developer app with its Client ID and Client Secret.
- Optional: a Groq API key for AI features and PostgreSQL for persistent sessions.

### 1. Clone and install

```bash
git clone https://github.com/eloooong/spoti.git
cd spoti
npm ci --prefix server
npm ci --prefix client
```

### 2. Configure your Spotify app

Open the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard), select your app, and register this redirect URI:

```text
http://127.0.0.1:8888/callback
```

Use the exact same value in your environment file. Spotify accepts HTTP for explicit loopback addresses such as `127.0.0.1`; see the [redirect URI requirements](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri).

### 3. Create the environment file

Copy [`server/.env.example`](server/.env.example) to `server/.env`:

```bash
cp server/.env.example server/.env
```

On PowerShell, use `Copy-Item server/.env.example server/.env` instead. Set your credentials:

```dotenv
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8888/callback
PORT=8888
```

`server/.env` is excluded from Git. Keep credentials on the server.

### 4. Build and run

```bash
npm run build
npm start --prefix server
```

Open [http://127.0.0.1:8888](http://127.0.0.1:8888) and select **Connect Spotify**. Express serves the compiled frontend and handles authentication and API requests.

## Development

Run the backend and Vite in separate terminals, from the repository root:

```bash
# Terminal 1
npm start --prefix server
```

```bash
# Terminal 2
npm run dev --prefix client -- --host 127.0.0.1
```

Use [http://127.0.0.1:5173](http://127.0.0.1:5173) for hot reload. Vite proxies `/api`, `/login`, `/callback`, and `/logout` to the backend. OAuth returns to port `8888`; after signing in, return to port `5173` to continue development. Use `127.0.0.1` consistently so both ports share the session cookie.

```bash
# Type-check and build
npm run build --prefix client

# Lint the frontend
npm run lint --prefix client

# Run frontend data tests and backend authentication tests
npm test --prefix client
npm test --prefix server
```

The tests cover genre-to-artist fallback, release-decade calculations, encrypted-cookie validation, and login/session refresh across simulated serverless cold starts. Backend tests use mocked Spotify responses.

## Configuration

The server loads `server/.env` when started with the commands above.

| Variable | Required | Purpose |
| --- | --- | --- |
| `SPOTIFY_CLIENT_ID` | Yes | Client ID from your Spotify developer app. |
| `SPOTIFY_CLIENT_SECRET` | Yes | Client Secret used by the server to exchange and refresh tokens. |
| `SPOTIFY_REDIRECT_URI` | Yes | Callback URL; must exactly match a registered redirect URI. |
| `STATE_SECRET` | On Vercel | Long random secret used to encrypt OAuth state and cookie-based sessions. Keep it stable between deployments. |
| `PORT` | No | Backend port. Defaults to `8888`. |
| `GROQ_API_KEY` | No | Enables the AI profile, recap, and chat. Leave blank to keep them hidden. |
| `GROQ_MODEL` | No | Overrides the model used for Groq chat completions. |
| `DATABASE_URL` | No | PostgreSQL connection string for persistent sessions. |
| `ALLOWED_ORIGIN` | No | Allowed browser origin for CORS. Set this to your deployed site's origin. |

### Sessions and AI

Each visitor receives a separate session cookie. With PostgreSQL configured, Spotify access and refresh tokens are stored on the backend and the server creates its sessions table during startup. Local development without a database uses in-memory sessions, which are cleared on restart. On Vercel without PostgreSQL, tokens are stored in an encrypted, authenticated, Secure, HttpOnly cookie using `STATE_SECRET`, so independent function instances can read the session. Logging out clears that browser’s cookies; use PostgreSQL when server-side session revocation is required.

The application requests read scopes for listening data and your library. It does not request Spotify permissions to change playlists or control playback. Spotify credentials belong in server environment variables, never in frontend code or committed files.

AI features are optional. When enabled, listening summaries and chat messages are sent to Groq to generate responses. Profiles and recaps are cached in process memory for up to 24 hours; chat context is cached for up to one hour. These caches are temporary and are not shared across Vercel function instances.

## Deployment

### Vercel

The live deployment is [spoti-neon.vercel.app](https://spoti-neon.vercel.app/). The Vercel project uses the repository root and Node.js 22.x. [`vercel.json`](vercel.json) installs both packages, builds `client/dist`, and routes `/api/*`, `/login`, `/callback`, and `/logout` to [`api/index.js`](api/index.js).

To deploy your own instance:

1. Import your repository into Vercel with the repository root as the project directory. The committed configuration supplies the build and routing settings.
2. Set `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`, and `STATE_SECRET` in the production environment. Add `DATABASE_URL` or Groq variables only when needed.
3. Register your exact HTTPS callback in the Spotify Developer Dashboard and use the same value for `SPOTIFY_REDIRECT_URI`.
4. Deploy, then verify that `/api/status` returns JSON and **Connect Spotify** returns to your deployed dashboard.

This project's production callback is:

```text
https://spoti-neon.vercel.app/callback
```

Use your own domain when deploying a fork. Keep the local loopback callback registered for local development. Environment-variable changes require a new deployment; changing `STATE_SECRET` invalidates existing encrypted sessions.

### Node.js service

Deploy as a **Node.js web service** that runs Express, using the repository root as the working directory.

| Setting | Value |
| --- | --- |
| Build command | `npm ci --prefix client && npm run build --prefix client && npm ci --prefix server` |
| Start command | `npm start --prefix server` |
| Required environment | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI` |
| Persistent sessions | Set `DATABASE_URL` to a reachable PostgreSQL instance. |
| Browser origin | Set `ALLOWED_ORIGIN` to the site's HTTPS origin. |

Register `https://your-domain.example/callback` in Spotify's settings and set `SPOTIFY_REDIRECT_URI` to that exact URL. Configure HTTPS at your host or reverse proxy. Rebuild after frontend changes; `client/dist` is generated and excluded from Git.

<details>
<summary>Optional local HTTPS</summary>

The backend automatically enables HTTPS when `server/certs/127.0.0.1.pem` and `server/certs/127.0.0.1-key.pem` both exist. Generate a locally trusted certificate with [mkcert](https://github.com/FiloSottile/mkcert), then update both the environment variable and registered Spotify redirect to `https://127.0.0.1:8888/callback`.

Certificate files are excluded from Git. The Vite proxy currently targets HTTP; use the compiled frontend when running the backend with local HTTPS.

</details>

## Data boundaries

- Recent-play charts describe the **latest 50 plays**, rather than a complete listening history.
- Daily Top compares each day's most-played artist and track; the leading names may change from day to day. Its lines do not track one fixed artist or song across the whole period.
- Top-item rankings use Spotify's time ranges rather than exact custom date intervals.
- Your Sound uses artist genre tags when Spotify provides them. If those tags are missing, it shows artist appearances across your top tracks, with each collaboration counted once per credited artist. This is an artist mix, not a play-count or inferred-genre chart.
- Your Music Eras groups top tracks by the album release year supplied by Spotify. Reissues may use a newer album edition’s date rather than the original song’s year. Missing or invalid dates are excluded and coverage is shown; decade counts describe top tracks, not play counts.
- Continuous history tracking, lifetime listening minutes, and Extended Streaming History import are not currently implemented.
- API availability and permissions depend on Spotify's platform rules. Access restrictions and expired sessions are surfaced in the dashboard.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Spotify reports a redirect mismatch | Match `SPOTIFY_REDIRECT_URI` to an entry in the Spotify dashboard exactly, including protocol, domain, port, and path. Use the production callback on Vercel and the loopback callback locally. |
| Sign-in works but stats are unavailable | Check the app owner's Premium status, the user's allowlist access, and Spotify API errors. |
| The deployed page stays on the loading screen | Check `/api/status`. It should return JSON such as `{"logged_in":false}` for a signed-out visitor. Deploy from the repository root so API routing and the React build are included. |
| Genres are missing | Your Sound automatically shows an artist mix when top tracks are available. Spotify metadata coverage varies. |
| AI panels are hidden | Set `GROQ_API_KEY` on the backend to enable them, then restart or redeploy. |

## Project structure

```text
spoti/
├── api/index.js            Vercel entry point for Express
├── client/                 React frontend and Vite configuration
│   ├── src/components/     Dashboard, charts, and Kokonut UI components
│   ├── src/lib/            Typed API helpers and shared data state
│   └── public/brand/       Approved Tasteprint S logo assets
├── server/                 Express, Spotify OAuth, sessions, and Groq endpoints
│   └── tests/              Cookie and serverless authentication tests
├── public/                 Original frontend; fallback when client/dist is absent
├── design/logo-concepts/   Logo source artwork, iterations, and review notes
├── docs/assets/            README visuals
└── vercel.json             Production build and API routing
```

## Credits

- [Kokonut UI](https://kokonutui.com/) for the interactive interface components.
- [Spotify Web API](https://developer.spotify.com/documentation/web-api) for listening data.
- [Groq](https://groq.com/) for optional AI responses.
- [Manrope](https://github.com/googlefonts/manrope) for the outlined logo lettering; [SIL Open Font License](design/logo-concepts/Manrope-OFL.txt).

SpotiStats is an independent project and is not affiliated with or endorsed by Spotify.
