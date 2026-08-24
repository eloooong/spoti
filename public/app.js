// app.js
// Runs in the browser. Talks to OUR backend (not Spotify directly) — the
// backend already has the access token and does the real Spotify calls.

let currentRange = "short_term";
let eqInterval = null;

// --- Boot sequence ----------------------------------------------------
init();

async function init() {
  const status = await fetchJSON("/api/status");

  if (!status.logged_in) {
    document.getElementById("login-view").classList.remove("hidden");
    return;
  }

  document.getElementById("dashboard-view").classList.remove("hidden");
  document.getElementById("status-area").textContent = "Connected";
  staggerEntrances();

  wireRangeTabs();
  loadNowPlaying();
  loadLibrarySnapshot();
  loadTopLists(currentRange);
  loadRecentPlaysData();
  loadPlaylists();

  // Refresh "now playing" every 15s so the hero stays current.
  setInterval(loadNowPlaying, 15000);
}

// Gives each panel/hero a staggered fade-up entrance. Uses a CSS animation
// with animation-fill-mode: both, so even if this never ran, everything
// would still render normally (just without the stagger) — never blank.
function staggerEntrances() {
  document.querySelectorAll(".hero, .panel").forEach((el, i) => {
    el.style.animationDelay = `${i * 55}ms`;
  });
}

// --- Skeleton loading placeholders ---------------------------------------
// Shown the instant a section starts fetching, so panels never sit blank
// while waiting on the network — replaced the moment real content renders.
function showListSkeleton(elementId, rows = 6) {
  const list = document.getElementById(elementId);
  if (!list) return;
  list.innerHTML = Array.from({ length: rows })
    .map(
      () => `
    <li class="ranked-item">
      <span class="skeleton skeleton-text" style="width:18px;height:14px;"></span>
      <span class="rank-art skeleton"></span>
      <span class="rank-info">
        <div class="skeleton skeleton-text" style="width:72%;"></div>
        <div class="skeleton skeleton-text" style="width:42%;margin-top:6px;"></div>
      </span>
    </li>`
    )
    .join("");
}

function showChartSkeleton(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const wrap = canvas.parentElement;
  if (wrap.querySelector(".chart-skeleton-overlay")) return;
  const overlay = document.createElement("div");
  overlay.className = "chart-skeleton-overlay skeleton";
  wrap.appendChild(overlay);
}

function hideChartSkeleton(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const overlay = canvas.parentElement.querySelector(".chart-skeleton-overlay");
  if (overlay) overlay.remove();
}

function showPlaylistGridSkeleton(elementId, count = 10) {
  const grid = document.getElementById(elementId);
  if (!grid) return;
  grid.innerHTML = Array.from({ length: count })
    .map(
      () => `
    <div class="playlist-card">
      <div class="skeleton" style="width:100%;aspect-ratio:1/1;border-radius:4px;margin-bottom:10px;"></div>
      <div class="skeleton skeleton-text" style="width:80%;"></div>
      <div class="skeleton skeleton-text" style="width:40%;margin-top:6px;"></div>
    </div>`
    )
    .join("");
}


function wireRangeTabs() {
  document.querySelectorAll(".range-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".range-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentRange = tab.dataset.range;
      loadTopLists(currentRange);
    });
  });
}

// --- Now playing hero ---------------------------------------------------
async function loadNowPlaying() {
  const data = await fetchJSON("/api/now-playing");
  const title = document.getElementById("hero-title");
  const sub = document.getElementById("hero-sub");
  const eyebrow = document.getElementById("hero-eyebrow");
  const art = document.getElementById("hero-art");
  const progressWrap = document.getElementById("progress-wrap");
  const meta = document.getElementById("hero-meta");

  if (!data || !data.item) {
    eyebrow.textContent = "Right now";
    title.textContent = "Nothing's spinning";
    sub.textContent = "Press play on Spotify to see it here.";
    art.classList.remove("visible");
    document.getElementById("hero-ambient").classList.remove("visible");
    progressWrap.classList.add("hidden");
    meta.innerHTML = "";
    setEqActive(false);
    return;
  }

  eyebrow.textContent = data.is_playing ? "Now playing" : "Paused";
  title.textContent = data.item.name;
  sub.textContent = data.item.artists.map((a) => a.name).join(", ");

  const coverUrl = data.item.album?.images?.[0]?.url;
  const ambient = document.getElementById("hero-ambient");
  if (coverUrl) {
    art.src = coverUrl;
    art.alt = `${data.item.album?.name || "Album"} cover art`;
    art.classList.add("visible");
    ambient.style.backgroundImage = `url("${coverUrl}")`;
    ambient.classList.add("visible");
  } else {
    art.classList.remove("visible");
    ambient.classList.remove("visible");
  }

  // Progress bar
  if (typeof data.progress_ms === "number" && data.item.duration_ms) {
    progressWrap.classList.remove("hidden");
    const pct = Math.min(100, (data.progress_ms / data.item.duration_ms) * 100);
    document.getElementById("progress-fill").style.width = `${pct}%`;
    document.getElementById("progress-elapsed").textContent = formatDuration(data.progress_ms);
    document.getElementById("progress-duration").textContent = formatDuration(data.item.duration_ms);
  } else {
    progressWrap.classList.add("hidden");
  }

  // Meta badges: device, shuffle, repeat, volume
  const badges = [];
  if (data.device?.name) {
    badges.push(`<span class="meta-badge">${escapeHTML(data.device.name)}</span>`);
  }
  if (data.shuffle_state) {
    badges.push(`<span class="meta-badge">Shuffle on</span>`);
  }
  if (data.repeat_state && data.repeat_state !== "off") {
    badges.push(`<span class="meta-badge">Repeat ${data.repeat_state === "track" ? "one" : "all"}</span>`);
  }
  if (typeof data.device?.volume_percent === "number") {
    badges.push(`<span class="meta-badge">Vol ${data.device.volume_percent}%</span>`);
  }
  meta.innerHTML = badges.join("");

  setEqActive(data.is_playing);
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function setEqActive(active) {
  const bars = document.querySelectorAll("#hero-eq span");
  clearInterval(eqInterval);

  if (!active) {
    bars.forEach((b) => (b.style.height = "6px"));
    return;
  }

  eqInterval = setInterval(() => {
    bars.forEach((b) => {
      b.style.height = `${5 + Math.random() * 14}px`;
      b.style.transition = "height 0.35s ease";
    });
  }, 350);
}

// --- Top artists / top tracks --------------------------------------------
async function loadTopLists(range) {
  showListSkeleton("top-artists-list");
  showListSkeleton("top-tracks-list");
  showChartSkeleton("top-songs-chart");
  showChartSkeleton("top-artists-chart");

  const [artists, tracks] = await Promise.all([
    fetchJSON(`/api/top-artists?range=${range}`),
    fetchJSON(`/api/top-tracks?range=${range}`),
  ]);

  const artistItems = artists?.items || [];
  const trackItems = tracks?.items || [];

  renderRankedList(
    "top-artists-list",
    artistItems.map((a, i) => ({
      rank: i + 1,
      image: a.images?.[2]?.url || a.images?.[0]?.url,
      name: a.name,
      sub: a.genres?.slice(0, 2).join(", ") || "Artist",
    }))
  );

  renderRankedList(
    "top-tracks-list",
    trackItems.map((t, i) => ({
      rank: i + 1,
      image: t.album?.images?.[2]?.url || t.album?.images?.[0]?.url,
      name: t.name,
      sub: t.artists.map((a) => a.name).join(", "),
    }))
  );

  renderTopSongsChart(trackItems);
  renderTopArtistsChart(artistItems);
}

function renderRankedList(elementId, items) {
  const list = document.getElementById(elementId);
  list.innerHTML = "";

  if (items.length === 0) {
    list.innerHTML = `<li class="rank-sub">Not enough listening history yet for this range.</li>`;
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "ranked-item";
    li.innerHTML = `
      <span class="rank-num">${String(item.rank).padStart(2, "0")}</span>
      <img class="rank-art" src="${item.image || ""}" alt="" loading="lazy" />
      <span class="rank-info">
        <div class="rank-name">${escapeHTML(item.name)}</div>
        <div class="rank-sub">${escapeHTML(item.sub)}</div>
      </span>
    `;
    list.appendChild(li);
  });
}

// --- Top Songs / Top Artists bar charts -----------------------------------
// Spotify's API gives us rank order (1st, 2nd, 3rd...) but never real play
// counts or stream numbers. These charts are honest about that: the bar
// values are just descending placeholders (10, 9, 8...) so the chart shows
// relative ranking, not actual listening volume.
let topSongsChartInstance = null;
let topArtistsChartInstance = null;

function chartLibraryMissing(canvas) {
  if (typeof Chart !== "undefined") return false;
  canvas.parentElement.innerHTML = `<p class="chart-empty">Charts couldn't load — try refreshing the page.</p>`;
  return true;
}

function renderTopSongsChart(trackItems) {
  const canvas = document.getElementById("top-songs-chart");
  if (chartLibraryMissing(canvas)) return;
  hideChartSkeleton("top-songs-chart");
  if (topSongsChartInstance) topSongsChartInstance.destroy();

  if (trackItems.length === 0) {
    canvas.parentElement.innerHTML = `<p class="chart-empty">Not enough listening history yet for this range.</p>`;
    return;
  }

  const top10 = trackItems.slice(0, 10);
  topSongsChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels: top10.map((t) => t.name),
      datasets: [
        {
          data: top10.map((_, i) => top10.length - i),
          backgroundColor: "#1db954",
          borderRadius: 4,
        },
      ],
    },
    options: barChartOptions(),
  });
}

function renderTopArtistsChart(artistItems) {
  const canvas = document.getElementById("top-artists-chart");
  if (chartLibraryMissing(canvas)) return;
  hideChartSkeleton("top-artists-chart");
  if (topArtistsChartInstance) topArtistsChartInstance.destroy();

  if (artistItems.length === 0) {
    canvas.parentElement.innerHTML = `<p class="chart-empty">Not enough listening history yet for this range.</p>`;
    return;
  }

  const top10 = artistItems.slice(0, 10);
  topArtistsChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels: top10.map((a) => a.name),
      datasets: [
        {
          data: top10.map((_, i) => top10.length - i),
          backgroundColor: "#1ed760",
          borderRadius: 4,
        },
      ],
    },
    options: barChartOptions(),
  });
}

function barChartOptions() {
  return {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          // Hide the placeholder number, just show the item name.
          label: (ctx) => ctx.label,
          title: () => "",
        },
      },
    },
    scales: {
      x: { display: false, grid: { display: false } },
      y: {
        ticks: { color: "#ffffff", font: { family: "Inter", size: 11 } },
        grid: { display: false },
      },
    },
  };
}

// --- Listening Clock (hour-of-day) and Weekly Routine (day-of-week) -------
// Both derived from your last ~50 plays' timestamps — Spotify's API has no
// deeper history than that available live.
let listeningClockInstance = null;
let weeklyRoutineInstance = null;

function renderListeningClock(items) {
  const canvas = document.getElementById("listening-clock-chart");
  if (chartLibraryMissing(canvas)) return;
  hideChartSkeleton("listening-clock-chart");
  if (listeningClockInstance) listeningClockInstance.destroy();

  if (items.length === 0) {
    canvas.parentElement.innerHTML = `<p class="chart-empty">Not enough recent plays yet.</p>`;
    return;
  }

  const hourCounts = new Array(24).fill(0);
  items.forEach((entry) => {
    hourCounts[new Date(entry.played_at).getHours()] += 1;
  });

  listeningClockInstance = new Chart(canvas, {
    type: "line",
    data: {
      labels: ["12am", "3am", "6am", "9am", "12pm", "3pm", "6pm", "9pm"],
      datasets: [
        {
          data: [0, 3, 6, 9, 12, 15, 18, 21].map((startHour) =>
            hourCounts.slice(startHour, startHour + 3).reduce((a, b) => a + b, 0)
          ),
          borderColor: "#1ed760",
          backgroundColor: "rgba(30, 215, 96, 0.18)",
          fill: true,
          tension: 0.4,
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#b3b3b3" }, grid: { display: false } },
        y: { ticks: { color: "#b3b3b3", stepSize: 1 }, grid: { color: "#282828" } },
      },
    },
  });
}

function renderWeeklyRoutine(items) {
  const canvas = document.getElementById("weekly-routine-chart");
  if (chartLibraryMissing(canvas)) return;
  hideChartSkeleton("weekly-routine-chart");
  if (weeklyRoutineInstance) weeklyRoutineInstance.destroy();

  if (items.length === 0) {
    canvas.parentElement.innerHTML = `<p class="chart-empty">Not enough recent plays yet.</p>`;
    return;
  }

  const dayCounts = new Array(7).fill(0); // 0 = Sunday
  items.forEach((entry) => {
    dayCounts[new Date(entry.played_at).getDay()] += 1;
  });

  weeklyRoutineInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      datasets: [
        {
          data: dayCounts,
          backgroundColor: "#1db954",
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#b3b3b3" }, grid: { display: false } },
        y: { ticks: { color: "#b3b3b3", stepSize: 1 }, grid: { color: "#282828" } },
      },
    },
  });
}

// --- Recent plays: fetched once, used to derive both Daily Top and
// Top Playlists Listened (neither of which Spotify's API provides
// directly — both are us counting frequency in your last ~50 plays). -----
async function loadRecentPlaysData() {
  showChartSkeleton("daily-top-chart");
  showChartSkeleton("listening-clock-chart");
  showChartSkeleton("weekly-routine-chart");

  const data = await fetchJSON("/api/recent");
  const items = data?.items || [];

  renderDailyTop(items);
  renderTopPlaylistsListened(items);
  renderListeningClock(items);
  renderWeeklyRoutine(items);
}

// --- Daily Top: most-played artist/track per calendar day, as a chart -----
let dailyTopChartInstance = null;

function renderDailyTop(items) {
  const canvas = document.getElementById("daily-top-chart");
  if (chartLibraryMissing(canvas)) return;
  hideChartSkeleton("daily-top-chart");
  if (dailyTopChartInstance) dailyTopChartInstance.destroy();

  if (items.length === 0) {
    canvas.parentElement.innerHTML = `<p class="chart-empty">Not enough recent plays yet to build a daily breakdown.</p>`;
    return;
  }

  // Group plays by local calendar day.
  const dayMap = {};

  items.forEach((entry) => {
    const track = entry.track;
    const playedAt = new Date(entry.played_at);
    const dayKey = `${playedAt.getFullYear()}-${String(playedAt.getMonth() + 1).padStart(2, "0")}-${String(
      playedAt.getDate()
    ).padStart(2, "0")}`;

    if (!dayMap[dayKey]) {
      dayMap[dayKey] = {
        dateObj: new Date(playedAt.getFullYear(), playedAt.getMonth(), playedAt.getDate()),
        artists: {},
        tracks: {},
      };
    }

    const day = dayMap[dayKey];
    const primaryArtist = track.artists[0];

    if (!day.artists[primaryArtist.id]) {
      day.artists[primaryArtist.id] = { name: primaryArtist.name, count: 0 };
    }
    day.artists[primaryArtist.id].count += 1;

    if (!day.tracks[track.id]) {
      day.tracks[track.id] = { name: track.name, count: 0 };
    }
    day.tracks[track.id].count += 1;
  });

  // Chronological order (oldest to newest) reads more naturally as a chart.
  const days = Object.keys(dayMap)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => {
      const day = dayMap[key];
      const topArtist = Object.values(day.artists).sort((a, b) => b.count - a.count)[0];
      const topTrack = Object.values(day.tracks).sort((a, b) => b.count - a.count)[0];
      return { dateObj: day.dateObj, topArtist, topTrack };
    });

  dailyTopChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels: days.map((d) => formatDayLabel(d.dateObj)),
      datasets: [
        {
          label: "Top artist",
          data: days.map((d) => d.topArtist.count),
          backgroundColor: "#1db954",
          borderRadius: 4,
        },
        {
          label: "Top track",
          data: days.map((d) => d.topTrack.count),
          backgroundColor: "#1ed760",
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#b3b3b3", font: { family: "Inter", size: 12 } },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const day = days[ctx.dataIndex];
              const entry = ctx.datasetIndex === 0 ? day.topArtist : day.topTrack;
              return `${ctx.dataset.label}: ${entry.name} (played ${entry.count}×)`;
            },
          },
        },
      },
      scales: {
        x: { ticks: { color: "#b3b3b3" }, grid: { display: false } },
        y: { ticks: { color: "#b3b3b3", stepSize: 1 }, grid: { color: "#282828" } },
      },
    },
  });
}

function formatDayLabel(dateObj) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (dateObj.getTime() === today.getTime()) return "Today";
  if (dateObj.getTime() === yesterday.getTime()) return "Yesterday";
  return dateObj.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// --- Library snapshot ------------------------------------------------------
async function loadLibrarySnapshot() {
  const data = await fetchJSON("/api/library-snapshot");
  if (!data) return;

  setStatNumber("stat-followed-artists", data.followedArtists);
  setStatNumber("stat-saved-tracks", data.savedTracks);
  setStatNumber("stat-saved-albums", data.savedAlbums);
  setStatNumber("stat-playlists", data.playlists);
}

function setStatNumber(elementId, value) {
  const el = document.getElementById(elementId);
  if (!el || typeof value !== "number") {
    if (el) el.textContent = "—";
    return;
  }

  const duration = 700;
  const start = performance.now();

  function tick(now) {
    const progress = Math.min(1, (now - start) / duration);
    // Ease-out cubic — starts fast, settles gently rather than a linear count.
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(value * eased).toLocaleString();
    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

// --- Playlists (view-only grid, no drill-down) -----------------------------
async function loadPlaylists() {
  showPlaylistGridSkeleton("playlist-grid");
  const data = await fetchJSON("/api/playlists");
  const grid = document.getElementById("playlist-grid");
  const items = data?.items || [];

  grid.innerHTML = "";

  if (items.length === 0) {
    grid.innerHTML = `<p class="chart-empty">No playlists found.</p>`;
    return;
  }

  items.forEach((playlist) => {
    const card = document.createElement("div");
    card.className = "playlist-card";
    card.innerHTML = `
      <img src="${playlist.images?.[0]?.url || ""}" alt="" loading="lazy" />
      <div class="playlist-card-name">${escapeHTML(playlist.name)}</div>
      <div class="playlist-card-count">${playlist.tracks?.total ?? 0} tracks</div>
    `;
    grid.appendChild(card);
  });
}

// --- Top Playlists Listened -------------------------------------------
// Spotify doesn't expose "how often you played this playlist" anywhere.
// The closest real signal is the "context" field on recently-played
// entries, which tells us what a track was played FROM (a playlist, an
// album, an artist radio, etc). We count how often each playlist shows up
// as that context within your last ~50 plays, then fetch each playlist's
// name/cover art to display it.
async function renderTopPlaylistsListened(items) {
  const row = document.getElementById("top-playlists-row");
  row.innerHTML = `<p class="chart-empty">Loading…</p>`;

  const counts = {};
  items.forEach((entry) => {
    if (entry.context?.type === "playlist" && entry.context.uri) {
      const id = entry.context.uri.split(":").pop();
      counts[id] = (counts[id] || 0) + 1;
    }
  });

  const topIds = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (topIds.length === 0) {
    row.innerHTML = `<p class="chart-empty">None of your last ~50 plays came from a playlist — try playing something from a playlist on Spotify.</p>`;
    return;
  }

  const playlists = await Promise.all(
    topIds.map(async ([id, count]) => {
      const meta = await fetchJSON(`/api/playlist-meta?id=${encodeURIComponent(id)}`);
      return {
        name: meta?.name || "Unknown playlist",
        image: meta?.images?.[0]?.url,
        count,
      };
    })
  );

  row.innerHTML = "";
  playlists.forEach((playlist) => {
    const card = document.createElement("div");
    card.className = "playlist-card playlist-card-small";
    card.innerHTML = `
      <img src="${playlist.image || ""}" alt="" loading="lazy" />
      <div class="playlist-card-name">${escapeHTML(playlist.name)}</div>
      <div class="playlist-card-count">Played ${playlist.count}×</div>
    `;
    row.appendChild(card);
  });
}

// --- Small utilities --------------------------------------------------
async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function escapeHTML(str = "") {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
