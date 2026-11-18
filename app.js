(async () => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const iso = d => d.toISOString().slice(0, 10);
  const addDays = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  const fmt = s => new Date(s + "T00:00:00Z").toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
  const daysBetween = (a, b) => Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 864e5);

  const D = await (await fetch("data.json", { cache: "no-cache" })).json();
  const P = D.plan, A = D.anki || { days: {} };
  // Anki's day starts at 4am, so a 1am session still counts as yesterday
  const today = iso(new Date(Date.now() - 4 * 36e5 - new Date().getTimezoneOffset() * 6e4));

  const byDay = {};
  for (const s of D.sessions) (byDay[s.date] ||= []).push(s);
  const fullRounds = d => (byDay[d] || []).filter(s => s.kind === "kanji" && s.total >= P.daily.kanjiPerRound);
  // Past days: "Anki beres" ≈ the day's Kaishi quota was opened (remaining reviews aren't recorded per day)
  const status = d => {
    const a = A.days[d] || {}, ss = byDay[d] || [];
    return {
      anki: (a.kaishiNew || 0) >= P.daily.kaishiNew && (d !== A.today || A.dueNow === 0),
      kanji: fullRounds(d).length >= P.daily.kanjiRounds,
      minna: ss.some(s => s.kind === "minna"),
      kaiwa: ss.some(s => s.kind === "kaiwa"),
    };
  };
  const count = d => Object.values(status(d)).filter(Boolean).length;

  $("#updated").textContent = `update terakhir ${new Date(D.generated).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })} · bab ${D.bab ?? "–"}`;

  $("#goals").innerHTML = P.goals.map(g => {
    const n = daysBetween(today, g.date);
    return `<div class="goal"><span class="mono">${esc(g.label)}${g.approx ? " ±" : ""}</span><b>${n >= 0 ? n + " hari" : "lewat"}</b><span class="muted">${esc(g.note)}</span></div>`;
  }).join("");

  // ---------- today ----------
  $("#todayLabel").textContent = fmt(today);
  const st = status(today), a = A.days[today] || {}, rounds = fullRounds(today), ss = byDay[today] || [];
  const avg = r => r.length ? Math.round(r.reduce((x, s) => x + s.ok / s.total, 0) / r.length * 100) : null;
  const card = (key, title, n, p) => `<div class="w ${st[key] ? "done" : ""}"><span class="st">${st[key] ? "BERES" : "BELUM"}</span><h3>${title}</h3><div class="n">${n}</div><p>${p}</p></div>`;
  $("#wajib").innerHTML = [
    card("anki", "Anki", `${a.kaishiNew || 0}/${P.daily.kaishiNew} baru`, `${a.reviews || 0} review · Again ${a.again || 0} · Hard ${a.hard || 0}${A.today === today ? ` · sisa due ${A.dueNow}` : ""}`),
    card("kanji", "Tebak kanji", `${rounds.length}/${P.daily.kanjiRounds} ronde`, rounds.length ? `rata-rata ${avg(rounds)}%` : "belum ada ronde"),
    card("minna", "Minna", `${ss.filter(s => s.kind === "minna").length} sesi`, esc(ss.filter(s => s.kind === "minna").map(s => s.mode).join(" · ") || "belum ada sesi")),
    card("kaiwa", "Kaiwa", `${ss.filter(s => s.kind === "kaiwa").length} sesi`, esc(ss.filter(s => s.kind === "kaiwa").map(s => s.score).join(" · ") || `target ${P.daily.kaiwaTurns}–8 giliran`)),
  ].join("");

  // ---------- consistency ----------
  const first = [D.sessions.map(s => s.date), Object.keys(A.days)].flat().sort()[0] || today;
  let start = addDays(today, -7 * 17);
  if (start < first) start = first;
  start = addDays(start, -((new Date(start + "T00:00:00Z").getUTCDay() + 6) % 7)); // back to Monday
  const cells = [];
  for (let d = start; d <= addDays(today, (7 - (new Date(today + "T00:00:00Z").getUTCDay() || 7)) % 7); d = addDays(d, 1))
    cells.push(d > today ? `<i style="opacity:.25"></i>` : `<i data-n="${count(d)}" class="${d === today ? "today" : ""}" title="${fmt(d)}: ${count(d)}/4"></i>`);
  $("#heat").innerHTML = cells.join("");
  let streak = 0, d = count(today) === 4 ? today : addDays(today, -1);
  while (count(d) === 4) { streak++; d = addDays(d, -1); }
  let active = 0; d = (byDay[today] || A.days[today]) ? today : addDays(today, -1);
  while (byDay[d] || A.days[d]) { active++; d = addDays(d, -1); }
  const totalRounds = D.sessions.filter(s => s.kind === "kanji" && s.total >= 10).length;
  $("#streak").innerHTML = `<span><b>${streak}</b> hari WAJIB 4/4 beruntun</span><span><b>${active}</b> hari belajar beruntun</span><span><b>${totalRounds}</b> ronde tebak kanji total</span>`;

  // ---------- this week ----------
  const wk = P.weeks.findLast(w => w.start <= today) || P.weeks[0];
  $("#weekLabel").textContent = `${fmt(wk.start)} – ${fmt(addDays(wk.start, 6))} · ${wk.minna}`;
  const bar = (label, have, want) => {
    const pct = Math.min(100, Math.round(have / want * 100));
    return `<div class="bar ${have >= want ? "ok" : ""}"><div class="lbl"><span>${label}</span><b>${have} / ${want}</b></div><div class="track"><div class="fill" style="width:${pct}%"></div></div></div>`;
  };
  $("#week").innerHTML = bar("Minna: bab sekarang", D.bab ?? 0, wk.bab) + bar("Kaishi: kata dibuka", A.kaishiOpened ?? 0, wk.kaishi) + bar(`Kanji dipelajari (deck RTK · ${A.kanjiSeen ?? 0} kanji unik sudah ketemu di semua deck)`, A.kanjiKnown ?? 0, wk.kanji);
  $("#weeks").innerHTML = `<table><tr><th>Minggu</th><th>Minna</th><th>Kaishi</th><th>Kanji</th></tr>${P.weeks.map(w =>
    `<tr class="${w === wk ? "cur" : ""}"><td>${fmt(w.start)}</td><td>${esc(w.minna)}</td><td>${w.kaishi}</td><td>${w.kanji}</td></tr>`).join("")}</table>`;

  // ---------- charts (last 14 days) ----------
  const last = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const label = d => fmt(d).split(" ")[0];
  $("#kanjiChart").innerHTML = last.map(d => {
    const r = fullRounds(d), v = avg(r);
    return `<div class="col" title="${fmt(d)}: ${r.length} ronde${v != null ? ", " + v + "%" : ""}">${v != null ? `<b>${v}</b><span class="kj" style="height:${v}%"></span>` : ""}<em>${label(d)}</em></div>`;
  }).join("");
  const maxRev = Math.max(1, ...last.map(d => (A.days[d] || {}).reviews || 0));
  $("#ankiChart").innerHTML = last.map(d => {
    const x = A.days[d] || { reviews: 0, again: 0, hard: 0 }, h = v => (v / maxRev * 100) + "%";
    return `<div class="col" title="${fmt(d)}: ${x.reviews} review, Again ${x.again}, Hard ${x.hard}">${x.reviews ? `<b>${x.reviews}</b>` : ""}<span class="good" style="height:${h(x.reviews - x.again - x.hard)}"></span><span class="hard" style="height:${h(x.hard)}"></span><span class="again" style="height:${h(x.again)}"></span><em>${label(d)}</em></div>`;
  }).join("");

  // ---------- mistakes ----------
  const ms = [...D.mistakes].sort((x, y) => (x.due || "9").localeCompare(y.due || "9"));
  const cls = m => !m.due ? "later" : m.due < today ? "over" : m.due === today ? "due" : "later";
  const over = ms.filter(m => cls(m) === "over").length, due = ms.filter(m => cls(m) === "due").length;
  $("#mistakeSum").textContent = `${ms.length} item · ${over} lewat jatuh tempo · ${due} jatuh tempo hari ini · interval 1 → 3 → 7 → 14 hari`;
  $("#mistakes").innerHTML = ms.map(m => `<details class="m ${cls(m)}"><summary><span>${esc(m.item)}</span><small>${m.due ? fmt(m.due) : "–"} · ${esc(m.interval)} hr</small></summary>
    <p><b>BENAR</b> ${esc(m.right)}</p><p><b>SALAH</b> ${esc(m.wrong)}</p></details>`).join("");

  // ---------- log ----------
  const log = D.sessions.map((s, i) => [s, i]).sort((x, y) => y[0].date.localeCompare(x[0].date) || x[1] - y[1]).slice(0, 25);
  $("#log").innerHTML = log.map(([s]) => `<div class="s"><span class="mono small muted">${fmt(s.date)}</span><span class="k ${s.kind}">${s.kind}</span>
    <div><b>${esc(s.mode)}</b> <span class="sc">${esc(s.score)}</span><p>${esc(s.note)}</p></div></div>`).join("");

  const n3 = P.goals.find(g => g.id === "n3").date;
  window.initFlex?.({
    date: today, st, done: count(today), rounds: rounds.length, avg: avg(rounds), reviews: a.reviews || 0, kaishiNew: a.kaishiNew || 0,
    dateLabel: new Date(today + "T00:00:00Z").toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }),
    kaishiOpened: A.kaishiOpened || 0, kanjiSeen: A.kanjiSeen || 0, kanjiList: A.kanjiList || "", bab: D.bab ?? "–",
    streak, active, totalRounds, mistakes: D.mistakes.length,
    minna: ss.filter(s => s.kind === "minna").map(s => s.mode), kaiwa: ss.filter(s => s.kind === "kaiwa").length,
    daysN3: daysBetween(today, n3), n3Total: daysBetween(P.weeks[0].start, n3), startLabel: fmt(P.weeks[0].start),
    heat: Array.from({ length: 56 }, (_, i) => { const x = addDays(today, i - 55); return x < first ? -1 : count(x); }),
    week: [["Minna bab", D.bab ?? 0, wk.bab], ["Kata Kaishi", A.kaishiOpened ?? 0, wk.kaishi], ["Kanji RTK", A.kanjiKnown ?? 0, wk.kanji]],
  });

  $("#months").innerHTML = P.months.map(m => `<div class="mo"><span class="mono small muted">${new Date(m.month + "-01T00:00:00Z").toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" })}</span><b>${m.kanji} kanji</b><span class="small">${esc(m.text)}</span></div>`).join("");
})();
