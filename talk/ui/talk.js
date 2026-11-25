// Talk page. Hands-free conversation: the page listens, detects when you start and stop speaking, sends the clip to Whisper, streams the
// tutor's reply and speaks it sentence by sentence. You can interrupt the tutor by speaking. All requests go to this PC (127.0.0.1) only.
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const S = {
    tts: false, history: [], t0: 0, timer: 0, scenario: "free", report: null, aborter: null,
    // audio in
    stream: null, ctx: null, proc: null, pre: [], seg: [], recording: false, segStart: 0, sttBusy: false,
    // audio out
    q: [], playing: false, current: null, turnId: 0, streaming: false,
  };
  const FRAME = 2048, BAD_TEXT = /ご視聴ありがとう|チャンネル登録|^[\s、。…]*$/;

  async function api(path, body) {
    const r = await fetch(path, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    return j;
  }
  const hint = t => { (S.hintEl || $("#hint")).textContent = t; };
  const micBtn = () => S.btn || $("#talk");  // Duet borrows the microphone with its own button, hint line and audio handler

  // ---------------------------------------------------------------- setup
  function chips(st) {
    const c = st?.context || {}, chip = (t, cls) => `<span class="chip ${cls || ""}">${esc(t)}</span>`;
    $("#chips").innerHTML = st ? [
      chip(st.ollama ? "LLM: aktif" : "LLM: Ollama mati", st.ollama ? "ok" : "bad"),
      chip(st.model ? "Model: " + st.llm : "Model belum diunduh: " + st.llm, st.model ? "ok" : "bad"),
      chip("Suara→teks: " + st.stt, "ok"),
      chip(c.ok ? "Tracker: terhubung" : "Tracker: tidak terbaca", c.ok ? "ok" : "bad"),
      chip(st.tts ? "Suara: " + (st.voice || "lokal") : "Suara sedang menyala...", st.tts ? "ok" : ""),
      c.ok ? chip("Bab " + (c.bab || "?")) : "", c.ok ? chip(c.due.length + " item untuk diulang") : "",
    ].join("") : chip("Server tidak menjawab", "bad");
  }
  async function init() {
    const sc = await api("/api/scenarios");
    $("#scenario").innerHTML = Object.entries(sc).map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join("");
    const refresh = async () => {
      const st = await api("/api/status").catch(() => null);
      S.tts = !!(st && st.tts); chips(st);
      const ready = st && st.ollama && st.model;
      $("#start").disabled = !ready;
      $("#problem").textContent = ready ? "" : "Ollama atau modelnya belum siap. Jalankan Ollama dan unduh modelnya dulu.";
      return st;
    };
    const st = await refresh();
    if (st && !st.tts) { const iv = setInterval(async () => { const s2 = await refresh(); if (s2?.tts) clearInterval(iv); }, 3000); }  // VOICEVOX takes a while to start
  }

  // ---------------------------------------------------------------- speech out: a queue of sentences, played one after another
  function stopSpeaking() {
    S.turnId++; S.q = []; S.playing = false;
    if (S.current) { S.current.pause(); S.current = null; }
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  }
  function speak(text) {
    if (!$("#speak").checked) return;
    const id = S.turnId;
    if (S.tts) {
      const clip = fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) })
        .then(r => { if (!r.ok) throw new Error("tts"); return r.blob(); }).then(b => URL.createObjectURL(b)).catch(() => null);  // starts now, plays in order
      S.q.push({ clip, text, id }); if (!S.playing) playNext();
    } else if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(text); u.lang = "ja-JP"; u.rate = 0.9;
      const v = speechSynthesis.getVoices().find(x => x.lang.toLowerCase().startsWith("ja")); if (v) u.voice = v;
      speechSynthesis.speak(u);
    }
  }
  async function playNext() {
    const item = S.q.shift();
    if (!item) { S.playing = false; S.current = null; return; }
    S.playing = true;
    const url = await item.clip;
    if (item.id !== S.turnId) return;  // the learner interrupted while this was loading
    if (!url) return playNext();
    const a = new Audio(url); S.current = a;
    a.onended = () => { URL.revokeObjectURL(url); if (item.id === S.turnId) playNext(); };
    a.onerror = () => { if (item.id === S.turnId) playNext(); };
    a.play().catch(() => playNext());
  }
  // one clip at a time for 🔊 buttons and Duet: a new call cancels the one still loading or playing, so double clicks never overlap.
  // Resolves when the clip ends, fails or is cancelled.
  const clip = { id: 0, audio: null };
  function stopClip() { clip.id++; if (clip.audio) clip.audio.pause(); clip.audio = null; }
  async function playClip(text) {
    stopClip(); const id = clip.id;
    try {
      const r = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const blob = r.ok ? await r.blob() : null;
      if (!blob || id !== clip.id) return;
      const url = URL.createObjectURL(blob), a = new Audio(url); clip.audio = a;
      await new Promise(res => { a.onended = a.onerror = a.onpause = res; a.play().catch(res); });
      URL.revokeObjectURL(url);
    } catch { /* no voice: the text is still on screen */ }
  }
  const tutorSpeaking = () => S.playing || (S.tts === false && "speechSynthesis" in window && speechSynthesis.speaking);

  // furigana over the kanji of el (server-side dictionary, no LLM), and the full-sentence romaji after it unless noRomaji
  const rubyHTML = segs => segs.map(([s, r]) => r ? `<ruby>${esc(s)}<rt>${esc(r)}</rt></ruby>` : esc(s)).join("");
  function addReading(el, text, noRomaji) {
    if (!text) return Promise.resolve();
    return api("/api/reading", { text }).then(x => {
      el.innerHTML = rubyHTML(x.ruby);
      if (!noRomaji && x.romaji) el.insertAdjacentHTML("afterend", `<div class="rom">${esc(x.romaji)}</div>`);
    }).catch(() => {});
  }

  // example replies ("script") for the learner, shown right under the tutor's bubble; 🔊 plays one in the tutor's voice
  function showHints(afterEl) {
    api("/api/suggest", { history: S.history.map(m => ({ role: m.role, text: m.text, hidden: m.hidden })) }).then(s => {
      if (!s.replies?.length) return;
      const box = document.createElement("div"); box.className = "hintbox";
      box.innerHTML = `<div class="hl">Contoh jawaban, coba ucapkan salah satu:</div>` + s.replies.map((r, i) =>
        `<div class="sug"><button type="button" class="play" data-i="${i}" title="Dengar">🔊</button><div><div class="ja" lang="ja">${rubyHTML(r.ruby)}</div><div class="rom">${esc(r.romaji)}</div><div class="id">${esc(r.id)}</div></div></div>`).join("");
      box.querySelectorAll(".play").forEach(btn => btn.onclick = () => { if (!S.recording) { stopSpeaking(); playClip(s.replies[btn.dataset.i].ja); } });
      afterEl.insertAdjacentElement("afterend", box);
      if (!S.recording) box.scrollIntoView({ block: "end", behavior: "smooth" });
    }).catch(() => {});
  }

  // ---------------------------------------------------------------- the tutor's turn: streamed text, spoken sentence by sentence
  function bubble(role, html) {
    const d = document.createElement("div"); d.className = "msg " + role; d.innerHTML = html;
    $("#chat").append(d); d.scrollIntoView({ block: "end", behavior: "smooth" }); return d;
  }
  async function tutorTurn() {
    S.aborter = new AbortController(); S.streaming = true; const ctl = S.aborter, id = ++S.turnId;
    hint("Tutor sedang menjawab...");
    const b = bubble("tutor", `<div class="ja" lang="ja"></div>`), ja = b.querySelector(".ja");
    let full = "";
    try {
      const r = await fetch("/api/chat_stream", { method: "POST", headers: { "Content-Type": "application/json" }, signal: ctl.signal,
        body: JSON.stringify({ scenario: S.scenario, history: S.history.map(m => ({ role: m.role, text: m.text })) }) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const reader = r.body.getReader(), dec = new TextDecoder(); let buf = "";
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl; while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1); if (!line) continue;
          const ev = JSON.parse(line);
          if (ev.t === "sentence") { ja.textContent += ev.text; b.scrollIntoView({ block: "end" }); if (id === S.turnId) speak(ev.text); }
          else if (ev.t === "done") full = ev.text;
          else if (ev.t === "error") throw new Error(ev.text);
        }
      }
    } catch (e) {
      if (e.name === "AbortError") { if (full || ja.textContent) S.history.push({ role: "assistant", text: ja.textContent }); return; }  // interrupted: keep what was said
      hint("Gagal: " + e.message); return;
    } finally { S.streaming = false; }
    S.history.push({ role: "assistant", text: full || ja.textContent });
    hint("Giliranmu. Klik tombol (atau Spasi) untuk bicara, klik lagi untuk kirim.");
    // furigana, romaji, meaning and new words arrive a moment later, while the voice is already speaking
    const said = full || ja.textContent; addReading(ja, said);
    if ($("#showHint").checked) showHints(b);
    api("/api/meaning", { text: full }).then(m => {
      const t = S.history.find(x => x.text === full && x.role === "assistant"); if (t) Object.assign(t, m);
      if ($("#showMeaning").checked && m.meaning_id) b.insertAdjacentHTML("beforeend", `<div class="id">${esc(m.meaning_id)}</div>`);
      if (m.new_words?.length) b.insertAdjacentHTML("beforeend", `<div class="words">Kata baru: ${m.new_words.map(w => esc(w.ja) + " = " + esc(w.id)).join(" · ")}</div>`);
    }).catch(() => {});
  }

  async function start() {
    if ($("#start").disabled) return;  // a double click must not start two sessions
    $("#start").disabled = true;
    try {
      S.scenario = $("#scenario").value;
      for (let i = 0; i < 50 && !S.tts; i++) { $("#problem").textContent = "Menyalakan suara tutor..."; await new Promise(r => setTimeout(r, 500)); }  // the voice engine needs a few seconds
      $("#problem").textContent = "";
      try { if (!S.stream) await initMic(); } catch { $("#problem").textContent = "Mikrofon tidak bisa dipakai. Izinkan akses mikrofon di browser, lalu coba lagi."; return; }
    } finally { $("#start").disabled = false; }
    $("#setup").hidden = true; $("#session").hidden = false;
    S.history = [{ role: "user", text: "(start)", hidden: true }];
    S.t0 = Date.now();
    S.timer = setInterval(() => { const s = Math.floor((Date.now() - S.t0) / 1000); $("#timer").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }, 1000);
    await tutorTurn();
  }

  // ---------------------------------------------------------------- microphone: raw samples, simple voice detection, WAV for Whisper
  async function initMic() {
    S.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    S.ctx = new AudioContext();
    const src = S.ctx.createMediaStreamSource(S.stream);
    S.proc = S.ctx.createScriptProcessor(FRAME, 1, 1);  // deprecated but simple and works everywhere; it writes no output (silent)
    S.proc.onaudioprocess = e => onFrame(new Float32Array(e.inputBuffer.getChannelData(0)));
    src.connect(S.proc); S.proc.connect(S.ctx.destination);
  }
  function onFrame(f) {
    if (!S.recording) { S.pre.push(f); if (S.pre.length > 7) S.pre.shift(); return; }  // about 0.3 s kept so the first syllable is not cut
    S.seg.push(f);
    if (performance.now() - S.segStart > 60000) endSegment();  // safety cap: one turn is at most a minute
  }
  function beginSegment() {
    if (S.recording) return;
    if (tutorSpeaking() || S.streaming) { stopSpeaking(); S.aborter?.abort(); }  // the learner talks over the tutor: stop it
    stopClip();  // and never record a 🔊 example playing in the background
    S.recording = true; S.seg = S.pre.slice(); S.pre = []; S.segStart = performance.now();
    micBtn().classList.add("rec"); micBtn().textContent = "Klik untuk kirim"; hint("Merekam... klik lagi kalau sudah selesai.");
  }
  function endSegment() {
    if (!S.recording) return;
    S.recording = false; micBtn().classList.remove("rec"); micBtn().textContent = "Klik untuk bicara";
    const frames = S.seg; S.seg = [];
    if (frames.length * FRAME / S.ctx.sampleRate < 0.5) { hint("Terlalu pendek, coba lagi."); return; }
    (S.onAudio || sendAudio)(wav(frames, S.ctx.sampleRate));
  }
  function wav(frames, rate) {
    const n = frames.length * FRAME, all = new Float32Array(n); frames.forEach((f, i) => all.set(f, i * FRAME));
    const ratio = rate / 16000, len = Math.floor(n / ratio), pcm = new Int16Array(len);
    for (let i = 0; i < len; i++) { let a = 0, c = 0; for (let j = Math.floor(i * ratio); j < Math.floor((i + 1) * ratio) && j < n; j++) { a += all[j]; c++; } pcm[i] = Math.max(-1, Math.min(1, c ? a / c : 0)) * 0x7fff; }
    const buf = new ArrayBuffer(44 + len * 2), v = new DataView(buf), w = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
    w(0, "RIFF"); v.setUint32(4, 36 + len * 2, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, len * 2, true);
    new Int16Array(buf, 44).set(pcm); return new Blob([buf], { type: "audio/wav" });
  }
  async function sendAudio(blob) {
    S.sttBusy = true; hint("Mendengarkan...");
    try {
      const r = await fetch("/api/stt?lang=" + document.querySelector("[name=lang]:checked").value, { method: "POST", headers: { "Content-Type": "audio/wav" }, body: blob });
      const j = await r.json(); if (!r.ok) throw new Error(j.error);
      if (!j.text || BAD_TEXT.test(j.text)) { hint("Tidak ada suara yang jelas. Coba lagi."); S.sttBusy = false; return; }
      const ja = j.lang === "ja", me = { role: "user", text: j.text, lang: j.lang, corrections: [] };
      S.history.push(me);
      const b = bubble("user", ja ? `<div class="ja" lang="ja">${esc(j.text)}</div>` : `<div class="ja">${esc(j.text)}</div>`);
      if (ja) addReading(b.querySelector(".ja"), j.text);
      api("/api/correct", { text: j.text, lang: j.lang }).then(c => {  // checked in the background while the tutor answers
        me.corrections = c.corrections || [];
        me.corrections.forEach(x => {
          b.insertAdjacentHTML("beforeend", `<div class="fix"><b>Koreksi:</b> ${esc(x.said)} → <b lang="ja">${esc(x.better)}</b><br>${esc(x.why_id)}</div>`);
          addReading(b.lastElementChild.querySelector("b[lang]"), x.better, true);
        });
        if (c.japanese && c.japanese.ja) {
          b.insertAdjacentHTML("beforeend", `<div class="fix"><b>Bahasa Jepangnya (saran AI, bisa salah):</b> <span lang="ja">${esc(c.japanese.ja)}</span><div class="rom">${esc(c.japanese.romaji)}</div></div>`);
          addReading(b.lastElementChild.querySelector("span[lang]"), c.japanese.ja, true);
        }
      }).catch(() => {});
      S.sttBusy = false; await tutorTurn();
    } catch (e) { hint("Gagal: " + e.message); S.sttBusy = false; }
  }

  // ---------------------------------------------------------------- report
  async function finish() {
    const turns = S.history.filter(m => !m.hidden);
    if (!turns.some(m => m.role === "user")) { hint("Belum ada percakapan untuk dilaporkan."); return; }
    clearInterval(S.timer); stopSpeaking(); stopClip(); S.aborter?.abort(); S.stream?.getTracks().forEach(t => t.stop()); S.ctx?.close();
    S.stream = S.ctx = null; S.recording = false;  // so Duet (or a new session) opens the microphone again
    const seconds = (Date.now() - S.t0) / 1000;
    $("#session").hidden = true; $("#report").hidden = false; $("#report").innerHTML = "<p>Membuat report...</p>";
    try { S.report = await api("/api/report", { turns, seconds }); renderReport(); }
    catch (e) { $("#report").innerHTML = `<p class="problem">Gagal membuat report: ${esc(e.message)}</p>`; }
  }
  const list = a => (a && a.length ? `<ul class="plain">${a.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "<p class=\"sub\">-</p>");
  function renderReport() {
    const r = S.report, v = r.review || {};
    $("#report").innerHTML = `
      <h2>Report sesi</h2>
      <p class="mono">${esc(r.when)} · ${r.minutes} menit · ${r.turns} giliran</p>
      <p>${esc(v.summary_id || "")}</p>
      <h3>Yang sudah bagus</h3>${list(v.strengths_id)}
      <h3>Perlu diperbaiki</h3>${list(v.improve_id)}
      <p><b>Saran berikutnya:</b> ${esc(v.next_id || "-")}</p>
      <h3>Kesalahan yang akan masuk bank pengulangan</h3>
      <p class="sub">Model lokal bisa salah mengoreksi. Centang hanya yang benar.</p>
      ${r.mistakes.length ? r.mistakes.map((m, i) => `<label class="mistake"><input type="checkbox" data-m="${i}" checked><span><span lang="ja">${esc(m.wrong)} → <b>${esc(m.correct)}</b></span><small>${esc(m.why)}</small></span></label>`).join("") : "<p class=\"sub\">Tidak ada koreksi di sesi ini.</p>"}
      <label for="note">Catatan untuk tracker</label>
      <input type="text" id="note" value="${esc((v.summary_id || "").slice(0, 120))}">
      <div class="row"><button id="send" class="primary" type="button">Kirim ke tracker</button><button id="again" type="button">Sesi baru tanpa mengirim</button></div>
      <p id="sendmsg" class="problem" role="status"></p>`;
    $("#again").onclick = () => location.reload();
    $("#send").onclick = async () => {
      const picked = [...document.querySelectorAll("[data-m]")].filter(x => x.checked).map(x => r.mistakes[+x.dataset.m]);
      $("#send").disabled = true;
      try {
        const out = await api("/api/send", { minutes: r.minutes, turns: r.turns, note: $("#note").value, mistakes: picked });
        $("#sendmsg").style.color = out.ok ? "var(--lime)" : "var(--r)";
        $("#sendmsg").textContent = out.ok ? `Terkirim: 1 sesi dan ${picked.length} kesalahan masuk tracker.` : "Gagal: " + out.error;
        if (!out.ok) $("#send").disabled = false;
      } catch (e) { $("#sendmsg").textContent = "Gagal: " + e.message; $("#send").disabled = false; }
    };
  }

  // ---------------------------------------------------------------- wiring
  $("#showFuri").onchange = e => $("#chat").classList.toggle("nofuri", !e.target.checked);
  $("#showRom").onchange = e => $("#chat").classList.toggle("norom", !e.target.checked);
  $("#showHint").onchange = e => $("#chat").classList.toggle("nohint", !e.target.checked);
  $("#start").onclick = start;
  $("#finish").onclick = finish;
  const toggle = () => { if (S.recording) endSegment(); else if (!S.sttBusy) beginSegment(); };  // click once to talk, click again to send
  $("#talk").onclick = toggle;
  document.addEventListener("keydown", e => {
    if (e.code !== "Space" || e.repeat || /INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName)) return;
    if (!$("#duet").hidden && window.Duet) { e.preventDefault(); window.Duet.space(); }
    else if (!$("#session").hidden) { e.preventDefault(); toggle(); }
  });
  window.Talk = { api, esc, rubyHTML, S, initMic, toggle, playClip, stopClip };  // shared with duet.js
  init().catch(e => { $("#problem").textContent = "Server tidak menjawab: " + e.message; });
})();
