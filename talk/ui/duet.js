// Duet: dialogue shadowing, like the role-play duets on Japanese learning videos. Yuki says her line (local voice), you say yours,
// Whisper writes what you said and the server compares it with the script by sound. Uses talk.js's microphone (window.Talk).
(() => {
  const T = window.Talk, $ = s => document.querySelector(s), esc = T.esc;
  // run: bumped on every start/stop; async work (voice, scoring) started in an older run is dropped, so double clicks and
  // stop/switch mid-way never mix two runs. busy: a recording is being scored. loading: a dialogue is being opened.
  const D = { dlg: null, me: "B", idx: 0, res: {}, busy: false, loading: false, run: 0, total: { t0: 0, lines: 0, sum: 0 } };
  const hint = t => { $("#dHint").textContent = t; };
  const mineNow = () => D.dlg && D.dlg.lines[D.idx] && D.dlg.lines[D.idx].who === D.me && $("#dEnd").hidden;

  // ---------------------------------------------------------------- tabs: Percakapan (talk.js) and Duet share the page and the microphone
  function tab(duet) {
    $("#tabTalk").setAttribute("aria-selected", String(!duet)); $("#tabDuet").setAttribute("aria-selected", String(duet));
    $("#duet").hidden = !duet;
    for (const s of ["#setup", "#session", "#report"]) $(s).classList.toggle("tabhide", duet);
    if (duet) {
      if (T.S.recording) T.toggle();  // a Percakapan recording still goes to Percakapan
      T.S.btn = $("#dMic"); T.S.hintEl = $("#dHint"); T.S.onAudio = onAudio;
    } else { stop(); T.S.btn = T.S.hintEl = T.S.onAudio = null; }
  }
  $("#tabTalk").onclick = () => tab(false);
  $("#tabDuet").onclick = () => tab(true);

  // ---------------------------------------------------------------- setup
  async function init() {
    const sc = await T.api("/api/duet_scenes");
    $("#dScene").innerHTML = Object.entries(sc).map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join("");
    await loadSaved();
  }
  async function loadSaved() {
    const list = await T.api("/api/duets").catch(() => []);
    $("#dSavedRow").hidden = !list.length;
    $("#dSaved").innerHTML = list.map(d => `<option value="${esc(d.id)}">${esc(d.title)} · ${esc(d.id.slice(0, 10))}</option>`).join("");
  }
  $("#dNew").onclick = async () => {
    $("#dNew").disabled = true; $("#dProblem").textContent = ""; $("#dNew").textContent = "Membuat dialog...";
    try { await begin(await T.api("/api/duet/new", { scene: $("#dScene").value })); loadSaved(); }
    catch (e) { $("#dProblem").textContent = "Gagal membuat dialog: " + e.message; }
    finally { $("#dNew").disabled = false; $("#dNew").textContent = "Buat dialog baru"; }
  };
  $("#dUse").onclick = async () => {
    if ($("#dUse").disabled) return;
    $("#dUse").disabled = true;
    try { await begin(await T.api("/api/duet/load", { id: $("#dSaved").value })); }
    catch (e) { $("#dProblem").textContent = "Gagal membuka dialog: " + e.message; }
    finally { $("#dUse").disabled = false; }
  };

  async function begin(dlg) {
    if (D.loading) return;  // double click on Ulangi / Tukar peran / Pakai
    D.loading = true;
    try {
      try { if (!T.S.stream) await T.initMic(); }
      catch { $("#dProblem").textContent = "Mikrofon tidak bisa dipakai. Izinkan akses mikrofon di browser, lalu coba lagi."; return; }
    } finally { D.loading = false; }
    stop();
    D.dlg = dlg; D.me = $("#dRole").value; D.idx = 0; D.res = {};
    D.total.t0 ||= Date.now();
    $("#dSetup").hidden = true; $("#dPlay").hidden = false; $("#dEnd").hidden = true;
    $("#dTitle").textContent = dlg.title + (D.me === "A" ? " (kamu: A)" : " (kamu: B)");
    step();
  }
  function stop() {
    if (T.S.recording) T.toggle();  // first: its result belongs to the run that is ending, and is dropped below
    D.run++; D.busy = false; T.stopClip();
  }
  $("#dStop").onclick = () => { stop(); $("#dPlay").hidden = true; $("#dSetup").hidden = false; };

  // ---------------------------------------------------------------- the script
  function lineHTML(l, i) {
    const mine = l.who === D.me, done = i < D.idx || !$("#dEnd").hidden, lv = $("#dLevel").value;
    const full = `<div class="ja" lang="ja">${T.rubyHTML(l.ruby)}</div><div class="rom">${esc(l.romaji)}</div>`;
    const text = !mine || done || lv === "full" ? full : lv === "hint" ? `<div class="ja dhint" lang="ja">${esc(l.hint)}</div>` : "";
    const r = D.res[i];
    const res = r ? `<div class="dres"><b>${r.score}%</b>${r.best > r.score ? ` (terbaik ${r.best}%)` : ""} · ${r.words.map(w => `<span class="${w.ok ? "ok" : "miss"}">${esc(w.w)}</span>`).join("")}
      <div class="said">Terdengar: <span lang="ja">${esc(r.said)}</span></div></div>` : "";
    return `<div class="msg ${mine ? "user" : "tutor"}${i === D.idx && $("#dEnd").hidden ? " cur" : ""}"><div class="who">${mine ? "Kamu" : "Yuki"} · ${l.who}</div>${text}<div class="id">${esc(l.id)}</div>${res}</div>`;
  }
  function render() {
    $("#dLines").innerHTML = D.dlg.lines.slice(0, D.idx + 1).map(lineHTML).join("");
    $("#dMine").hidden = !mineNow();
    $("#dNext").textContent = D.res[D.idx] ? "Lanjut →" : "Lewati →";
    $("#dLines").lastElementChild?.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  async function step() {
    const run = D.run, l = D.dlg.lines[D.idx];
    if (!l) return end();
    render();
    if (l.who === D.me) { hint("Giliranmu. 🔊 untuk dengar contoh, lalu klik untuk bicara (atau Spasi)."); return; }
    hint("Yuki bicara...");
    await T.playClip(l.ja);
    if (run !== D.run) return;  // stopped or restarted meanwhile
    await new Promise(r => setTimeout(r, 300));
    if (run !== D.run) return;
    D.idx++; step();
  }

  // ---------------------------------------------------------------- your line: record, transcribe (Japanese only), score
  function mic() {
    if (!mineNow() || D.busy || D.loading) return;
    T.toggle();  // talk.js stops any 🔊 clip when recording starts
  }
  $("#dMic").onclick = mic;
  $("#dListen").onclick = () => { if (mineNow() && !T.S.recording && !D.busy) T.playClip(D.dlg.lines[D.idx].ja); };  // a second click restarts, never doubles
  $("#dNext").onclick = () => { if (!mineNow() || T.S.recording || D.busy) return; T.stopClip(); D.idx++; step(); };
  async function onAudio(blob) {
    const run = D.run, i = D.idx, l = D.dlg.lines[i];
    D.busy = true; hint("Memeriksa ucapanmu...");
    try {
      const r = await fetch("/api/stt?lang=ja", { method: "POST", headers: { "Content-Type": "audio/wav" }, body: blob });
      const j = await r.json(); if (!r.ok) throw new Error(j.error);
      if (run !== D.run) return;  // stopped or switched while Whisper was working
      if (!j.text) { hint("Tidak ada suara yang jelas. Coba lagi."); return; }
      const sc = await T.api("/api/duet/score", { target: l.ja, said: j.text });
      if (run !== D.run) return;
      D.res[i] = { ...sc, said: j.text, best: Math.max(sc.score, D.res[i]?.best || 0) };
      render();
      hint(sc.score >= 90 ? "Bagus! Klik Lanjut, atau ulangi untuk skor lebih tinggi." : "Kata merah belum terdengar. Dengar contoh (🔊), lalu coba lagi.");
    } catch (e) { if (run === D.run) hint("Gagal: " + e.message); }
    finally { if (run === D.run) D.busy = false; }
  }

  // ---------------------------------------------------------------- end of a run, and sending the whole Duet session to the tracker
  function end() {
    const mine = Object.values(D.res), avg = mine.length ? Math.round(mine.reduce((a, r) => a + r.best, 0) / mine.length) : 0;
    D.total.lines += mine.length; D.total.sum += mine.reduce((a, r) => a + r.best, 0);
    $("#dEnd").hidden = false; $("#dMine").hidden = true; render(); hint("");
    const tot = D.total, minutes = Math.max(1, Math.round((Date.now() - tot.t0) / 60000)), tavg = tot.lines ? Math.round(tot.sum / tot.lines) : 0;
    $("#dEnd").innerHTML = `
      <h2 style="margin-top:0">Selesai!</h2>
      <p>Dialog ini: <b>${mine.length ? avg + "%" : "–"}</b> rata-rata dari ${mine.length} kalimatmu.</p>
      <p class="hint mono">Sesi Duet sejauh ini: ${tot.lines} kalimat · rata-rata ${tavg}% · ±${minutes} menit.</p>
      <div class="row">
        <button type="button" id="dAgain">Ulangi dialog ini</button>
        <button type="button" id="dSwap" class="primary">Tukar peran</button>
        <button type="button" id="dBack">Dialog lain</button>
      </div>
      <div class="row"><button type="button" id="dSend" ${tot.lines ? "" : "disabled"}>Kirim sesi Duet ke tracker</button><span id="dSendMsg" class="hint"></span></div>`;
    $("#dAgain").onclick = () => begin(D.dlg);
    $("#dSwap").onclick = () => { $("#dRole").value = D.me === "A" ? "B" : "A"; begin(D.dlg); };
    $("#dBack").onclick = () => { $("#dPlay").hidden = true; $("#dSetup").hidden = false; };
    $("#dSend").onclick = async () => {
      $("#dSend").disabled = true;
      try {
        const out = await T.api("/api/duet/send", { minutes, lines: tot.lines, avg: tavg, note: D.dlg.title });
        $("#dSendMsg").textContent = out.ok ? "Terkirim ke tracker." : "Gagal: " + out.error;
        if (out.ok) D.total = { t0: 0, lines: 0, sum: 0 }; else $("#dSend").disabled = false;
      } catch (e) { $("#dSendMsg").textContent = "Gagal: " + e.message; $("#dSend").disabled = false; }
    };
  }

  $("#dLevel").onchange = () => D.dlg && render();
  $("#dFuri").onchange = e => $("#dLines").classList.toggle("nofuri", !e.target.checked);
  $("#dRom").onchange = e => $("#dLines").classList.toggle("norom", !e.target.checked);
  window.Duet = { space: mic };
  init().catch(() => {});
})();
