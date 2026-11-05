(() => {
  const $ = (id) => document.getElementById(id);
  const STORE = "arunmuzik.jobs.v1";
  const PW = "arunmuzik.pw";
  const POLL_MS = 5000;
  const MAX_WAIT_MS = 10 * 60 * 1000;
  const DONE = ["SUCCESS"];
  const FAILED = ["CREATE_TASK_FAILED", "GENERATE_AUDIO_FAILED", "CALLBACK_EXCEPTION", "SENSITIVE_WORD_ERROR", "FAILED", "ERROR"];
  const LABELS = {
    PENDING: "Queued…", TEXT_SUCCESS: "Writing lyrics done, composing…",
    FIRST_SUCCESS: "First take ready, finishing the second…", SUCCESS: "Ready",
  };
  const IDEAS = [
    "Romantic Hindi acoustic ballad with soft guitar and rain sounds",
    "Energetic EDM festival anthem with a huge drop",
    "Chill lo-fi beats to study to, with vinyl crackle",
    "Tamil folk fusion with nadaswaram and modern drums",
    "Cinematic orchestral trailer music, epic and dark",
    "90s style R&B slow jam about a long-distance love",
  ];

  let mode = "simple";
  let jobs = load();
  const timers = {};

  // ---------- storage ----------
  function load() { try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch { return []; } }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(jobs.slice(0, 50))); } catch {} }
  function getPw() { try { return localStorage.getItem(PW) || ""; } catch { return ""; } }
  function setPw(v) { try { localStorage.setItem(PW, v); } catch {} }

  // ---------- api ----------
  async function api(path, opts = {}) {
    const res = await fetch(`/api/${path}`, {
      ...opts,
      headers: { "Content-Type": "application/json", "x-app-password": getPw(), ...(opts.headers || {}) },
    });
    let data = {};
    try { data = await res.json(); } catch {}
    if (res.status === 401 && data.needPassword) {
      const ok = await askPassword();
      if (ok) return api(path, opts);
    }
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  function askPassword() {
    return new Promise((resolve) => {
      const d = $("pwDialog");
      $("pwInput").value = "";
      d.showModal();
      d.addEventListener("close", function h() {
        d.removeEventListener("close", h);
        const v = $("pwInput").value.trim();
        if (v) { setPw(v); resolve(true); } else resolve(false);
      });
    });
  }

  async function refreshCredits() {
    try {
      const { credits } = await api("credits");
      $("credits").textContent = `Credits: ${credits ?? "—"}`;
    } catch { $("credits").textContent = "Credits: —"; }
  }

  // ---------- UI: form ----------
  document.querySelectorAll(".tab").forEach((t) =>
    t.addEventListener("click", () => {
      mode = t.dataset.mode;
      document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t));
      $("simpleFields").hidden = mode !== "simple";
      $("customFields").hidden = mode !== "custom";
      syncInstrumental();
    })
  );
  const syncInstrumental = () => { $("lyricsField").hidden = mode === "custom" && $("instrumental").checked; };
  $("instrumental").addEventListener("change", syncInstrumental);
  $("desc").addEventListener("input", (e) => ($("descCount").textContent = e.target.value.length));
  $("lyrics").addEventListener("input", (e) => ($("lyricsCount").textContent = e.target.value.length));
  IDEAS.forEach((idea) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.textContent = idea;
    b.onclick = () => { $("desc").value = idea; $("descCount").textContent = idea.length; };
    $("ideas").appendChild(b);
  });

  function showError(msg) { const e = $("error"); e.textContent = msg || ""; e.hidden = !msg; }

  $("form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    showError("");
    const instrumental = $("instrumental").checked;
    const payload = { customMode: mode === "custom", instrumental, model: $("model").value };
    if (mode === "simple") {
      payload.prompt = $("desc").value.trim();
      if (!payload.prompt) return showError("Describe the song you want.");
    } else {
      payload.title = $("title").value.trim();
      payload.style = $("style").value.trim();
      payload.negativeTags = $("neg").value.trim();
      payload.prompt = instrumental ? "" : $("lyrics").value.trim();
      if (!payload.title) return showError("Give your song a title.");
      if (!payload.style) return showError("Describe the style of music.");
      if (!instrumental && !payload.prompt) return showError("Add lyrics or turn on Instrumental.");
    }

    const btn = $("go");
    btn.disabled = true; btn.querySelector(".btn-label").textContent = "Submitting…";
    try {
      const { taskId } = await api("generate", { method: "POST", body: JSON.stringify(payload) });
      const job = {
        taskId, createdAt: Date.now(), status: "PENDING", tracks: [],
        label: payload.title || payload.prompt || payload.style, model: payload.model,
      };
      jobs.unshift(job); save(); render(); poll(taskId);
    } catch (e) {
      showError(e.message);
    } finally {
      btn.disabled = false; btn.querySelector(".btn-label").textContent = "Generate ✨";
    }
  });

  $("clear").addEventListener("click", () => {
    if (!confirm("Clear your song history on this device?")) return;
    Object.values(timers).forEach(clearTimeout);
    jobs = []; save(); render();
  });

  // ---------- polling ----------
  function poll(taskId) {
    clearTimeout(timers[taskId]);
    const tick = async () => {
      const job = jobs.find((j) => j.taskId === taskId);
      if (!job) return;
      try {
        const r = await api(`status?taskId=${encodeURIComponent(taskId)}`);
        job.status = r.status;
        job.error = r.error;
        if (r.tracks?.length) job.tracks = r.tracks;
      } catch (e) {
        job.lastErr = e.message;
      }
      if (!DONE.includes(job.status) && !FAILED.includes(job.status) && Date.now() - job.createdAt > MAX_WAIT_MS) {
        job.status = "TIMEOUT";
      }
      save(); render();
      if (DONE.includes(job.status)) refreshCredits();
      else if (!FAILED.includes(job.status) && job.status !== "TIMEOUT") timers[taskId] = setTimeout(tick, POLL_MS);
    };
    tick();
  }

  // ---------- render ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDur = (s) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "");
  const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "");

  function render() {
    const list = $("list");
    $("empty").hidden = jobs.length > 0;
    list.innerHTML = jobs.map(renderJob).join("");
    list.querySelectorAll("[data-lyrics]").forEach((b) =>
      b.addEventListener("click", () => {
        const el = document.getElementById(b.dataset.lyrics);
        el.hidden = !el.hidden;
      })
    );
  }

  function renderJob(job) {
    const failed = FAILED.includes(job.status) || job.status === "TIMEOUT";
    const done = DONE.includes(job.status);
    const badge = failed ? `<span class="badge err">Failed</span>` : done ? `<span class="badge ok">Ready</span>` : `<span class="badge wait">Generating</span>`;
    const when = new Date(job.createdAt).toLocaleString();
    const playable = (job.tracks || []).filter((t) => safeUrl(t.audioUrl) || safeUrl(t.streamUrl));

    let body = "";
    if (playable.length) {
      body = `<div class="tracks">${playable.map((t, i) => renderTrack(job, t, i)).join("")}</div>`;
    }
    if (!done && !failed) {
      body += `<div style="margin-top:${playable.length ? 12 : 0}px"><div class="progress"><div></div></div>
        <div class="progress-text">${esc(LABELS[job.status] || "Working…")} Usually takes 1–3 minutes.</div></div>`;
    }
    if (failed) {
      body += `<div class="error">${esc(job.status === "TIMEOUT" ? "Timed out waiting for the song. Try again." : job.error || job.status.replace(/_/g, " ").toLowerCase())}</div>`;
    }
    return `<article class="job">
      <div class="job-head"><span class="q" title="${esc(job.label)}">${esc(job.label)} · ${esc(when)}</span>${badge}</div>
      ${body}</article>`;
  }

  function renderTrack(job, t, i) {
    const audio = safeUrl(t.audioUrl) || safeUrl(t.streamUrl);
    const img = safeUrl(t.imageUrl);
    const lid = `ly-${job.taskId}-${i}`;
    const fname = `${(t.title || "song").replace(/[^\w\- ]+/g, "").trim() || "song"}.mp3`;
    return `<div style="min-width:0">
      <div class="track">
        ${img ? `<img class="cover" src="${esc(img)}" alt="" loading="lazy" />` : `<div class="cover"></div>`}
        <div class="tinfo">
          <h4>${esc(t.title || "Untitled")}</h4>
          <div class="tags">${esc([t.tags, fmtDur(t.duration)].filter(Boolean).join(" · "))}</div>
          <audio controls preload="none" src="${esc(audio)}"></audio>
          <div class="tactions">
            ${safeUrl(t.audioUrl) ? `<a href="${esc(t.audioUrl)}" download="${esc(fname)}" target="_blank" rel="noopener">Download</a>` : `<span class="muted">Finalizing download…</span>`}
            ${t.lyrics ? `<button type="button" data-lyrics="${esc(lid)}">Lyrics</button>` : ""}
          </div>
        </div>
      </div>
      ${t.lyrics ? `<div class="lyrics" id="${esc(lid)}" hidden>${esc(t.lyrics)}</div>` : ""}
    </div>`;
  }

  // ---------- boot ----------
  render();
  refreshCredits();
  jobs.filter((j) => !DONE.includes(j.status) && !FAILED.includes(j.status) && j.status !== "TIMEOUT").forEach((j) => poll(j.taskId));
})();
