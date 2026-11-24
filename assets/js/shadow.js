// Shadowing page (shadow.html): YouTube player + synced script, line loop, speed, blur text, recording.
// Scripts come from data/shadow/*.json, made on this PC by scripts/shadow.py (not published: gitignored).
(() => {
  const L = o => o[LANG] ?? o.id;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  const UI = {
    title: { id: "Shadowing", en: "Shadowing", ja: "シャドーイング" },
    lead: {
      id: "Dengarkan satu kalimat, lalu ucapkan bersamaan atau tepat setelahnya. Ulangi satu baris sampai lancar, lalu rekam suaramu dan bandingkan.",
      en: "Listen to one sentence, then say it along with the voice or right after it. Loop one line until it is smooth, then record yourself and compare.",
      ja: "一文を聞いて、同時かすぐ後に声に出します。一行をなめらかになるまで繰り返し、録音して聞き比べます。",
    },
    empty: {
      id: "Belum ada naskah shadowing. Riwayat latihannya ada di bawah.",
      en: "No shadowing scripts yet. The practice history is below.",
      ja: "シャドーイングのスクリプトはまだありません。練習履歴は下にあります。",
    },
    lock: { id: "Naskah dienkripsi (hak cipta). Masukkan kata sandi pemilik untuk membukanya.", en: "The scripts are encrypted (copyright). Enter the owner's passphrase to unlock them.", ja: "スクリプトは暗号化されています（著作権）。所有者のパスフレーズを入力してください。" },
    unlock: { id: "Buka", en: "Unlock", ja: "開く" },
    wrong: { id: "Kata sandi salah.", en: "Wrong passphrase.", ja: "パスフレーズが違います。" },
    pass: { id: "Kata sandi", en: "Passphrase", ja: "パスフレーズ" },
    autoCap: { id: "teks otomatis YouTube, mungkin ada salah", en: "YouTube auto captions, may contain mistakes", ja: "YouTube自動字幕（誤りあり）" },
    whisperCap: { id: "dibuat Whisper, mungkin ada salah", en: "made by Whisper, may contain mistakes", ja: "Whisper生成（誤りあり）" },
    loop: { id: "Ulang baris", en: "Loop line", ja: "行リピート" },
    prev: { id: "◀ Baris", en: "◀ Line", ja: "◀ 行" },
    next: { id: "Baris ▶", en: "Line ▶", ja: "行 ▶" },
    time: { id: "Waktu latihan", en: "Practice time", ja: "練習時間" },
    keys: { id: "Tombol: Spasi putar/jeda · ←/→ baris · L ulang", en: "Keys: Space play/pause · ←/→ line · L loop", ja: "キー：Space 再生/停止 · ←/→ 行 · L リピート" },
    speed: { id: "Kecepatan", en: "Speed", ja: "速度" },
    log: { id: "Catat latihan ke tracker", en: "Log this practice to the tracker", ja: "この練習をトラッカーに記録" },
    copied: { id: "Disalin. Tempel di terminal.", en: "Copied. Paste it in a terminal.", ja: "コピーしました。ターミナルに貼り付けてください。" },
    meaning: { id: "Arti", en: "Meaning", ja: "意味" },
    romaji: { id: "Romaji", en: "Romaji", ja: "ローマ字" },
    romajiNote: { id: "Romaji dibuat otomatis, kata yang jarang bisa salah.", en: "Romaji is automatic; rare words can be wrong.", ja: "ローマ字は自動生成です。まれな語は誤りがあります。" },
    auto: { id: "Otomatis", en: "Auto", ja: "自動" },
    gap: { id: "Giliranmu", en: "Your turn", ja: "あなたの番" },
    reps: { id: "Ulangi tiap baris", en: "Repeats per line", ja: "各行の繰り返し" },
    done: { id: "Tandai selesai", en: "Mark as done", ja: "完了にする" },
    all: { id: "Semua", en: "All", ja: "すべて" },
    hist: { id: "Riwayat shadowing", en: "Shadowing history", ja: "シャドーイング履歴" },
    histNone: { id: "Belum ada latihan shadowing yang dicatat.", en: "No shadowing practice logged yet.", ja: "シャドーイングの記録はまだありません。" },
    histSum: { id: "{n} sesi · {m} menit tercatat", en: "{n} sessions · {m} minutes logged", ja: "{n}回 · 記録 {m}分" },
    none: { id: "Belum ada video untuk bahasa ini.", en: "No videos for this language yet.", ja: "この言語の動画はまだありません。" },
    lines: { id: "baris", en: "lines", ja: "行" },
    exp: { id: "Ekspor progres", en: "Export progress", ja: "進捗を書き出す" },
    imp: { id: "Impor progres", en: "Import progress", ja: "進捗を読み込む" },
    impBad: { id: "File progres tidak cocok dengan video yang ada.", en: "This progress file does not match any video here.", ja: "この進捗ファイルに合う動画がありません。" },
  };

  const S = { key: null, idx: [], romaji: false, langF: "all", reps: 1, auto: false, gap: false, play: 0, wait: false, guard: 0, timer: 0, done: new Set(), vid: null, data: null, cur: 0, loop: false, meaning: true, rate: 1, secs: 0, player: null, };

  const fmt = n => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;

  function shell() {
    document.title = `${L(UI.title)} · Arsenius`;
    $("#page").innerHTML = `
      <h1>${esc(L(UI.title))}</h1>
      <p class="sh-lead">${esc(L(UI.lead))}</p>
      <div id="shPick" class="sh-pick"></div>
      <div id="shBody" hidden>
        <div class="sh-vid"><div id="shPlayer"></div></div>
        <div class="sh-bar" id="shBar"></div>
        <p class="mono sh-meta" id="shMeta"></p>
        <button type="button" class="sh-logbtn mono" id="shLog"></button>
        <button type="button" class="sh-logbtn mono" id="shExp">⬇ ${esc(L(UI.exp))}</button>
        <button type="button" class="sh-logbtn mono" id="shImp">⬆ ${esc(L(UI.imp))}</button>
        <input type="file" id="shImpFile" accept=".json,application/json" hidden>
        <ol class="sh-list" id="shList"></ol>
        <p class="mono sh-keys">${esc(L(UI.keys))}</p>
        <p class="mono sh-keys">${esc(L(UI.romajiNote))}</p>
      </div>
      <section class="sh-hist" id="shHist"></section>`;
  }

  function bar() {
    const b = (id, label, on) => `<button type="button" id="${id}" ${on === undefined ? "" : `aria-pressed="${on}"`}>${esc(label)}</button>`;
    $("#shBar").innerHTML =
      b("shPrev", L(UI.prev)) + b("shNext", L(UI.next)) + b("shLoop", L(UI.loop), S.loop) + b("shAuto", L(UI.auto), S.auto) + b("shGap", L(UI.gap), S.gap) + (S.data?.lines.some(l => l.r) ? b("shRomaji", L(UI.romaji), S.romaji) : "") + (S.data?.lines.some(l => l.tr) ? b("shMeaning", L(UI.meaning), S.meaning) : "") +
      `<span class="sh-rates" role="group" aria-label="${esc(L(UI.reps))}" title="${esc(L(UI.reps))}">${[1, 2, 3, 5].map(r => `<button type="button" data-reps="${r}" aria-pressed="${S.reps === r}">${r}×</button>`).join("")}</span>` +
      `<span class="sh-rates" role="group" aria-label="${esc(L(UI.speed))}">${[0.5, 0.75, 1].map(r => `<button type="button" data-rate="${r}" aria-pressed="${S.rate === r}">${r}x</button>`).join("")}</span>`;
    $("#shPrev").onclick = () => go(S.cur - 1);
    $("#shNext").onclick = () => go(S.cur + 1);
    $("#shLoop").onclick = () => { S.loop = !S.loop; if (S.loop) S.auto = false; pref(); bar(); };
    $("#shAuto").onclick = () => { S.auto = !S.auto; S.play = 0; if (S.auto) { S.loop = false; go(S.cur, true); } else { clearTimeout(S.timer); S.wait = false; } pref(); bar(); };
    $("#shGap").onclick = () => { S.gap = !S.gap; pref(); bar(); };
    document.querySelectorAll("[data-reps]").forEach(x => x.onclick = () => { S.reps = +x.dataset.reps; S.play = 0; pref(); bar(); });
    if ($("#shMeaning")) $("#shMeaning").onclick = () => { S.meaning = !S.meaning; pref(); $("#shList").classList.toggle("meaning", S.meaning); bar(); };
    if ($("#shRomaji")) $("#shRomaji").onclick = () => { S.romaji = !S.romaji; pref(); $("#shList").classList.toggle("romaji", S.romaji); bar(); };
    document.querySelectorAll("[data-rate]").forEach(x => x.onclick = () => { S.rate = +x.dataset.rate; store.set("shadow.rate", S.rate); S.player?.setPlaybackRate(S.rate); bar(); });
  }

  function list() {
    const rows = S.data.lines.map((l, i) => ({ l, i }));
    $("#shList").classList.toggle("romaji", S.romaji); $("#shList").classList.toggle("meaning", S.meaning);
    $("#shList").innerHTML = rows.map(({ l, i }) =>
      `<li data-i="${i}" class="${i === S.cur ? "on" : ""}"><button type="button" class="sh-dn" data-d="${i}" aria-pressed="${S.done.has(i)}" title="${esc(L(UI.done))}" aria-label="${esc(L(UI.done))}"></button><button type="button" class="sh-ln"><span class="mono sh-ts">${fmt(l.s)}</span><span class="sh-tx"><span class="sh-t" lang="${S.data.lang || "ja"}">${esc(l.t)}</span>${l.r ? `<span class="sh-r">${esc(l.r)}</span>` : ""}${l.tr ? `<span class="sh-m">${esc(l.tr)}</span>` : ""}</span></button></li>`).join("");
    $("#shList").querySelectorAll(".sh-ln").forEach(b => b.onclick = () => go(+b.parentNode.dataset.i, true));
    $("#shList").querySelectorAll(".sh-dn").forEach(b => b.onclick = () => { const i = +b.dataset.d; S.done.has(i) ? S.done.delete(i) : S.done.add(i); saveDone(); b.setAttribute("aria-pressed", S.done.has(i)); $("#shMeta").textContent = meta(); });
  }

  function mark() {
    document.querySelectorAll("#shList li").forEach(li => li.classList.toggle("on", +li.dataset.i === S.cur));
    const on = $("#shList li.on"); if (on) { const r = on.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) on.scrollIntoView({ block: "center", behavior: "smooth" }); }
  }

  function go(i, play) {
    const n = S.data.lines.length;
    S.cur = Math.max(0, Math.min(n - 1, i)); S.play = 0; clearTimeout(S.timer); S.wait = false; S.guard = Date.now() + 500;
    S.player?.seekTo(S.data.lines[S.cur].s, true);
    if (play) S.player?.playVideo();
    mark();
  }

  const pref = () => store.set("shadow.pref", { reps: S.reps, auto: S.auto, gap: S.gap, romaji: S.romaji, meaning: S.meaning });
  const saveDone = () => store.set("shadow.done." + S.vid, [...S.done]);
  const seek = t => { S.guard = Date.now() + 500; S.player.seekTo(t, true); };

  // Auto mode: play a line `reps` times (pausing for your turn when "gap" is on), mark it done, then go to the next line.
  function endPlay() {
    const p = S.player, ls = S.data.lines, l = ls[S.cur], again = ++S.play < S.reps;
    const step = () => {
      S.wait = false;
      if (again) seek(l.s);
      else {
        S.play = 0; S.done.add(S.cur); saveDone();
        document.querySelector(`.sh-dn[data-d="${S.cur}"]`)?.setAttribute("aria-pressed", "true");
        if (S.cur + 1 >= ls.length) { p.pauseVideo(); return; }
        S.cur++; mark(); seek(ls[S.cur].s);
      }
      p.playVideo();
    };
    if (S.gap) { p.pauseVideo(); S.wait = true; S.timer = setTimeout(step, (l.e - l.s) * 1000 / S.rate + 700); } else step();
  }

  function tick() {
    const p = S.player; if (!p?.getCurrentTime) return;
    if (S.wait) { S.secs += 0.1; return; }  // your turn to speak counts as practice
    const t = p.getCurrentTime(), ls = S.data.lines, playing = p.getPlayerState() === 1;
    const over = playing && Date.now() > S.guard && t >= ls[S.cur].e + 0.2;
    if (playing) { S.secs += 0.1; $("#shMeta").textContent = meta(); logBtn(); }
    if (S.loop) { if (over) seek(ls[S.cur].s); }
    else if (S.auto) { if (over) endPlay(); }
    else {
      let k = S.cur; while (k + 1 < ls.length && ls[k + 1].s <= t) k++; while (k > 0 && ls[k].s > t) k--;
      if (k !== S.cur && playing) { S.cur = k; mark(); }
    }
  }

  const logMin = () => Math.max(1, Math.round(S.secs / 60));
  const logCmd = () => `python -X utf8 -I tracker/scripts/catat.py shadow ${S.vid} ${logMin()}`;
  const logBtn = () => { $("#shLog").textContent = `📋 ${L(UI.log)}: ${logMin()} min`; };

  const meta = () => `${S.data.title} · ${S.done.size}/${S.data.lines.length} ✔${S.data.kind === "auto" ? " · ⚠ " + L(UI.autoCap) : S.data.kind === "whisper" ? " · ⚠ " + L(UI.whisperCap) : ""} · ${L(UI.time)} ${fmt(S.secs)}`;

  // Resume file: done lines + current line of one video, to continue on another device or browser.
  function exportProgress() {
    const p = { app: "shadowing", v: 1, vid: S.vid, title: S.data.title, n: S.data.lines.length, done: [...S.done].sort((a, b) => a - b), cur: S.cur, at: new Date().toISOString() };
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([JSON.stringify(p)], { type: "application/json" })), download: `shadowing-${S.vid}-${p.done.length}of${p.n}.json` });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function importProgress(f) {
    let p; try { p = JSON.parse(await f.text()); } catch {}
    if (p?.app !== "shadowing" || !S.idx.some(v => v.id === p.vid)) return alert(L(UI.impBad));
    if (p.vid !== S.vid) { await open(p.vid); pick(); }
    const n = S.data.lines.length, ok = i => Number.isInteger(i) && i >= 0 && i < n;
    (p.done || []).filter(ok).forEach(i => S.done.add(i)); saveDone(); list();  // merge: never drops lines done here
    if (ok(p.cur)) { S.cur = p.cur; mark(); S.player?.seekTo?.(S.data.lines[S.cur].s, true); }
    $("#shMeta").textContent = meta();
  }

  function loadYT() {
    return new Promise(ok => {
      if (window.YT?.Player) return ok();
      window.onYouTubeIframeAPIReady = ok;
      const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; document.head.append(s);
    });
  }

  // Local copy first (plain, gitignored). On the public site the scripts come encrypted from data/shadow-enc/ and are opened with the owner's passphrase.
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function deriveKey(pass, meta) {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64(meta.salt), iterations: meta.iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  }
  const dec = async f => JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(f.iv) }, S.key, b64(f.ct))));
  const getJSON = async url => (await fetch(url, { cache: "no-store" })).json();

  async function load(id) {
    if (!S.key) return getJSON(`data/shadow/${id}.json`);
    return dec(await getJSON(`data/shadow-enc/${S.idx.find(v => v.id === id).file}.json`));
  }

  async function unlock() {
    let meta;
    try { const r = await fetch("data/shadow-enc/meta.json", { cache: "no-store" }); if (!r.ok) return; meta = await r.json(); } catch { return; }
    const tryPass = async pass => {
      try { S.key = await deriveKey(pass, meta); S.idx = await dec(await getJSON("data/shadow-enc/index.json")); store.set("shadow.pass", pass); return true; }
      catch { S.key = null; S.idx = []; return false; }
    };
    const saved = store.get("shadow.pass", "");
    if (saved && await tryPass(saved)) return;
    await new Promise(done => {
      $("#shPick").innerHTML = `<form class="sh-lock"><label>${esc(L(UI.lock))}</label><div><input type="password" autocomplete="current-password" aria-label="${esc(L(UI.pass))}" placeholder="${esc(L(UI.pass))}"><button type="submit">${esc(L(UI.unlock))}</button></div><p class="sh-err" role="alert"></p></form>`;
      const f = $("#shPick form");
      f.onsubmit = async e => { e.preventDefault(); if (await tryPass(f.querySelector("input").value.trim())) done(); else f.querySelector(".sh-err").textContent = L(UI.wrong); };
    });
  }

  async function open(id) {
    S.vid = id; S.data = await load(id);
    S.done = new Set(store.get("shadow.done." + id, [])); S.cur = 0; S.secs = 0; S.play = 0;
    $("#shBody").hidden = false; bar(); list(); $("#shMeta").textContent = meta(); logBtn();
    $("#shLog").onclick = () => navigator.clipboard?.writeText(logCmd()).then(() => { $("#shLog").textContent = "✔ " + L(UI.copied); setTimeout(logBtn, 2500); }, () => prompt(L(UI.log), logCmd()));
    await loadYT();
    if (S.player) { S.player.loadVideoById(id); return; }
    S.player = new YT.Player("shPlayer", { videoId: id, playerVars: { playsinline: 1, rel: 0, hl: "ja" }, events: { onReady: () => S.player.setPlaybackRate(S.rate) } });
  }

  document.addEventListener("keydown", e => {
    if (!S.data || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); go(S.cur - 1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); go(S.cur + 1); }
    else if (e.key.toLowerCase() === "l") { S.loop = !S.loop; bar(); }
    else if (e.key === " " && e.target.tagName !== "BUTTON") { e.preventDefault(); S.player?.getPlayerState() === 1 ? S.player.pauseVideo() : S.player?.playVideo(); }
  });

  function pick() {
    const langs = [["all", L(UI.all)], ["ja", "日本語"], ["en", "English"]];
    const vids = S.idx.filter(v => S.langF === "all" || (v.lang || "ja") === S.langF);
    $("#shPick").innerHTML =
      `<div class="sh-langs" role="group">${langs.map(([k, n]) => `<button type="button" data-pl="${k}" aria-pressed="${S.langF === k}">${esc(n)}</button>`).join("")}</div>` +
      (vids.length ? vids.map(v => `<button type="button" data-id="${esc(v.id)}" aria-pressed="${v.id === S.vid}"><b>${esc(v.title)}</b><small class="mono">${(v.lang || "ja").toUpperCase()} · ${esc(v.author)} · ${v.n} ${esc(L(UI.lines))}${v.kind !== "manual" ? " · " + v.kind : ""}</small></button>`).join("") : `<p class="sh-empty">${esc(L(UI.none))}</p>`);
    $("#shPick").querySelectorAll("[data-pl]").forEach(b => b.onclick = () => { S.langF = b.dataset.pl; store.set("shadow.lang", S.langF); pick(); });
    $("#shPick").querySelectorAll("[data-id]").forEach(b => b.onclick = () => open(b.dataset.id).then(pick));
    return vids;
  }

  async function history() {
    let ss = [];
    try { ss = (await (await fetch("data/data.json", { cache: "no-store" })).json()).sessions.filter(x => x.shadowing); } catch {}
    const mins = ss.reduce((a, x) => a + (x.min || 0), 0);
    $("#shHist").innerHTML = `<h2>${esc(L(UI.hist))}</h2>` + (ss.length
      ? `<p class="mono sh-meta">${esc(L(UI.histSum).replace("{n}", ss.length).replace("{m}", mins))}</p><ul>${ss.slice(-10).reverse().map(x => `<li><span class="mono">${esc(x.date)}</span> · ${x.min ? x.min + " min" : "–"}${x.note && x.note !== "–" ? " · " + esc(x.note) : ""}</li>`).join("")}</ul>`
      : `<p class="sh-empty">${esc(L(UI.histNone))}</p>`);
  }

  (async () => {
    shell(); history();
    $("#shExp").onclick = exportProgress;
    $("#shImp").onclick = () => $("#shImpFile").click();
    $("#shImpFile").onchange = e => { const f = e.target.files[0]; e.target.value = ""; if (f) importProgress(f); }; S.rate = store.get("shadow.rate", 1); Object.assign(S, store.get("shadow.pref", {})); S.langF = store.get("shadow.lang", "all");
    try { S.idx = await getJSON("data/shadow/index.json"); } catch { S.idx = []; }
    if (!Array.isArray(S.idx) || !S.idx.length) await unlock();
    if (!Array.isArray(S.idx) || !S.idx.length) { $("#shPick").innerHTML = `<p class="sh-empty">${esc(L(UI.empty))}</p>`; return; }
    const first = pick()[0];
    if (first) await open(first.id).then(pick);
    setInterval(tick, 100);
  })();
})();
