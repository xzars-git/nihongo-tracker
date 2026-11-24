(async () => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const iso = d => d.toISOString().slice(0, 10);
  const addDays = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  const loc = t("locale");
  const fmt = s => new Date(s + "T00:00:00Z").toLocaleDateString(loc, { day: "numeric", month: "short", timeZone: "UTC" });
  const daysBetween = (a, b) => Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 864e5);
  const banner = (msg, cls = "") => $("#banner").insertAdjacentHTML("beforeend", `<p class="banner ${cls}">${esc(msg)}</p>`);

  let D;
  try { D = await (await fetch("data/data.json", { cache: "no-cache" })).json(); }
  catch { banner(t("banner.fail"), "bad"); return; }
  const P = D.plan, A = D.anki || { days: {} };
  // Anki's day starts at 4am, so a 1am session still counts as yesterday
  const today = iso(new Date(Date.now() - 4 * 36e5 - new Date().getTimezoneOffset() * 6e4));
  const ageH = (Date.now() - new Date(D.generated)) / 36e5;
  if (ageH > 30) banner(t("banner.stale", { n: Math.floor(ageH / 24) }));

  const byDay = {};
  for (const s of D.sessions) (byDay[s.date] ||= []).push(s);
  const fullRounds = d => (byDay[d] || []).filter(s => s.kind === "kanji" && s.total >= P.daily.kanjiPerRound);
  const isRest = d => (P.restDays || []).includes(new Date(d + "T00:00:00Z").getUTCDay());
  const status = d => {
    const a = A.days[d] || {}, ss = byDay[d] || [];
    return {
      // dueLeft = reviews left at that day's last sync; old days without it fall back to the Kaishi quota
      anki: (a.kaishiNew || 0) >= P.daily.kaishiNew && (a.dueLeft === undefined ? d !== A.today : a.dueLeft === 0),
      kanji: fullRounds(d).length >= P.daily.kanjiRounds,
      minna: ss.some(s => s.kind === "minna"),
      kaiwa: ss.some(s => s.kind === "kaiwa" && (s.shadowing || (s.turns ?? 0) >= P.daily.kaiwaTurns)),
    };
  };
  const count = d => Object.values(status(d)).filter(Boolean).length;
  const complete = d => isRest(d) ? status(d).anki : count(d) === 4;
  // a day counts as "studied" on any real activity, even when no mission is fully done
  const rawMin = d => ((A.days[d] || {}).ankiMin || 0) + ((D.study?.days || {})[d] || 0);
  const studied = d => count(d) > 0 || ((A.days[d] || {}).reviews || 0) > 0 || rawMin(d) > 0 || (byDay[d] || []).length > 0;
  const level = d => Math.max(count(d), studied(d) ? 1 : 0);
  const hmShort = m => t("fx.hm", { h: Math.floor(m / 60), m: m % 60 });

  const n3 = P.goals.find(g => g.id === "n3");
  const monthYear = s => new Date(s + "T00:00:00Z").toLocaleDateString(loc, { month: "long", year: "numeric", timeZone: "UTC" }).toUpperCase();
  $("#n3a").textContent = t("goal.n3"); $("#n3b").textContent = t("journey");
  $("#updated").textContent = t("updated", { t: new Date(D.generated).toLocaleString(loc, { dateStyle: "medium", timeStyle: "short" }), b: D.bab ?? "–" });
  $("#n3left").textContent = t("n3.left", { n: daysBetween(today, n3.date) });

  // ---------- today ----------
  const st = status(today), a = A.days[today] || {}, rounds = fullRounds(today), ss = byDay[today] || [];
  $("#todayLabel").textContent = fmt(today) + (isRest(today) ? t("restday") : "");
  const avg = r => r.length ? Math.round(r.reduce((x, s) => x + s.ok / s.total, 0) / r.length * 100) : null;
  // wax seal for a finished mission: a lumpy blob with a drip, an embossed ring and 済 ("done"), built from fixed maths so it never changes between loads
  const seal = (() => {
    const pts = Array.from({ length: 28 }, (_, i) => {
      const a = i / 28 * 2 * Math.PI, r = 27 + 1.6 * Math.sin(3 * a + 1) + 1.2 * Math.sin(5 * a + 2) + 9 * Math.exp(-((a - 2.1) ** 2) / 0.08);
      return [32 + r * Math.cos(a), 30 + r * Math.sin(a)];
    });
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], f = n => n.toFixed(1);
    let d = `M${pts[0].map(f)}`;
    pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length], m = mid(p, q); d += `Q${p.map(f)} ${m.map(f)}`; });
    return `<svg viewBox="0 0 64 66" aria-hidden="true"><path d="${d}Z" transform="translate(2 3)" fill="#000" opacity=".35"/><path d="${d}Z" fill="#C8102E" stroke="#8f0a20" stroke-width="2"/>
      <circle cx="32" cy="30" r="17" fill="#b30d28" stroke="#8f0a20" stroke-width="2"/><path d="M19 22a15 15 0 0 1 11-8" fill="none" stroke="#ff7a85" stroke-width="2" stroke-linecap="round" opacity=".6"/>
      <text x="32" y="38.5" text-anchor="middle" font-family="'Noto Sans JP',sans-serif" font-weight="900" font-size="21" fill="#ff8d96" opacity=".55" transform="translate(.8 .8)">済</text>
      <text x="32" y="38.5" text-anchor="middle" font-family="'Noto Sans JP',sans-serif" font-weight="900" font-size="21" fill="#7d0819">済</text></svg>`;
  })();
  const card = (key, n, p) => `<div class="w ${st[key] ? "done" : ""}">${st[key] ? `<span class="st seal" role="img" aria-label="${t("st.done")}">${seal}</span>` : `<span class="st">${t(isRest(today) && key !== "anki" ? "st.rest" : "st.todo")}</span>`}<h3>${t("w." + key)}</h3><div class="n">${n}</div><p>${p}</p></div>`;
  const minnaS = ss.filter(s => s.kind === "minna"), kaiwaS = ss.filter(s => s.kind === "kaiwa");
  $("#wajib").innerHTML = [
    card("anki", t("anki.n", { a: a.kaishiNew || 0, b: P.daily.kaishiNew }), A.today === today ? t("anki.left", { d: A.dueNow }) : ""),
    card("kanji", t("kanji.n", { a: rounds.length, b: P.daily.kanjiRounds }), rounds.length ? t("kanji.avg", { v: avg(rounds) }) : t("kanji.none")),
    card("minna", t("minna.n", { n: minnaS.length }), esc(minnaS.map(s => s.mode.replace(/\s*\([^)]*\)/g, "").replace(/^Minna\s*/i, "")).join(" · ") || t("minna.none"))),
    // turns when logged as turns, otherwise the number of sessions (a shadowing session has no turns); "–" scores are noise
    card("kaiwa", kaiwaS.some(s => s.turns) ? t("kaiwa.n", { n: kaiwaS.reduce((x, s) => x + (s.turns || 0), 0) }) : kaiwaS.length ? t("minna.n", { n: kaiwaS.length }) : t("kaiwa.n", { n: 0 }),
      esc([...kaiwaS.filter(s => s.shadowing).map(() => t("kaiwa.shadow")).slice(0, 1), ...kaiwaS.map(s => s.score).filter(x => x && x !== "–")].join(" · ") || t("kaiwa.target", { a: P.daily.kaiwaTurns }))),
  ].join("");

  // ---------- this week + pace ----------
  const wk = P.weeks.findLast(w => w.start <= today) || P.weeks[0];
  const cek = P.goals.find(g => g.id === "cek").date, toCek = Math.max(1, daysBetween(today, cek));
  const last7 = Array.from({ length: 7 }, (_, i) => A.days[addDays(today, -i)] || {});
  const rate = k => last7.reduce((x, d) => x + (d[k] || 0), 0) / 7;
  $("#weekLabel").textContent = `${fmt(wk.start)} – ${fmt(addDays(wk.start, 6))} · ${tx(wk, "minna")}`;
  const bar = (label, have, want, sub) => {
    const pct = Math.min(100, Math.round(have / want * 100));
    return `<div class="bar ${have >= want ? "ok" : ""}"><div class="lbl"><span>${label}</span><b>${have} / ${want}</b></div><div class="track"><div class="fill" style="width:${pct}%"></div></div><p class="mono small muted">${sub}</p></div>`;
  };
  const pace = (have, goal, perDay, unit) => have + perDay * toCek >= goal
    ? `<span class="on">${t("pace.ok", { d: fmt(cek) })}</span>`
    : `<span class="late">${t("pace.need", { n: Math.ceil(Math.max(0, goal - have) / toCek), u: t(unit) })}</span>`;
  const end = P.weeks[P.weeks.length - 1], babLeft = Math.max(0, end.bab - (D.bab ?? 0));
  $("#week").innerHTML =
    bar(t("bar.minna"), D.bab ?? 0, wk.bab, t("bar.minna.left", { n: babLeft, d: fmt(cek) })) +
    bar(t("bar.kaishi"), A.kaishiOpened ?? 0, wk.kaishi, pace(A.kaishiOpened ?? 0, end.kaishi, rate("kaishiNew"), "unit.word"));

  // ---------- alerts: behind this week's target → what the remaining days must look like (red from 1.5x the normal daily pace) ----------
  const daysLeft = Math.max(1, Array.from({ length: 7 }, (_, i) => addDays(wk.start, i)).filter(d => d >= today && !isRest(d)).length);
  const prev = P.weeks[P.weeks.indexOf(wk) - 1] || wk;
  const behind = (have, goal, norm, key) => {
    const gap = goal - have, r = gap / daysLeft;
    if (gap > 0 && r > norm) banner(t(key, { gap, goal, d: daysLeft, n: Math.ceil(r), norm: Math.round(norm) }), r >= norm * 1.5 ? "bad" : "");
  };
  behind(A.kaishiOpened ?? 0, wk.kaishi, P.daily.kaishiNew, "alert.kaishi");
  behind(D.bab ?? 0, wk.bab, (wk.bab - prev.bab) / 6, "alert.minna");

  // ---------- toward N3: what the exam needs vs what is learned, and when the current pace gets there ----------
  const NEED = { vocab: 3700, kanji: 650 };
  const fmtY = s => new Date(s + "T00:00:00Z").toLocaleDateString(loc, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const words = A.kaishiOpened ?? 0, perDay = rate("kaishiNew");
  const done = perDay > 0 ? addDays(today, Math.ceil(Math.max(0, NEED.vocab - words) / perDay)) : null;
  const vocabSub = [t("n3.vocab.need", { n: NEED.vocab }), done ? t("n3.fc", { d: fmtY(done) }) + (done > n3.date ? t("n3.fc.late", { n: daysBetween(n3.date, done) }) : "") : t("n3.fc.none")].join(" · ");
  $("#n3bars").innerHTML = bar(t("n3.vocab"), words, NEED.vocab, vocabSub) + bar(t("n3.kanji"), A.kanjiSeen ?? 0, NEED.kanji, t("n3.kanji.sub", { t: wk.kanji }));

  // ---------- consistency ----------
  const first = D.sessions.map(s => s.date).sort()[0] || today;
  let start = addDays(today, -7 * 17);
  if (start < first) start = first;
  start = addDays(start, -((new Date(start + "T00:00:00Z").getUTCDay() + 6) % 7)); // back to Monday
  const cells = [];
  for (let d = start; d <= addDays(today, (7 - (new Date(today + "T00:00:00Z").getUTCDay() || 7)) % 7); d = addDays(d, 1))
    cells.push(d > today || d < first ? `<i style="opacity:.25"></i>`
      : `<i data-n="${level(d)}" class="${d === today ? "today" : ""}" title="${t("heat.title", { d: fmt(d), n: count(d) })}${studied(d) ? t("heat.study", { r: (A.days[d] || {}).reviews || 0, m: hmShort(rawMin(d)) }) : ""}${isRest(d) ? t("heat.rest") : ""}"></i>`);
  $("#heat").innerHTML = cells.join("");
  $("#heat").scrollLeft = $("#heat").scrollWidth;
  const run = ok => { let n = 0, d = ok(today) ? today : addDays(today, -1); while (d >= first && ok(d)) { n++; d = addDays(d, -1); } return n; };
  const streak = run(complete), active = run(studied);
  const totalRounds = D.sessions.filter(s => s.kind === "kanji" && s.total >= P.daily.kanjiPerRound).length;

  // ---------- charts (last 14 days, from the first session) ----------
  const last = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)).filter(d => d >= first);
  const label = d => new Date(d + "T00:00:00Z").getUTCDate();
  $("#kanjiChart").innerHTML = last.map(d => {
    const r = fullRounds(d), v = avg(r);
    return `<div class="col" title="${t("chart.kanji", { d: fmt(d), n: r.length })}${v != null ? ", " + v + "%" : ""}">${v != null ? `<b>${v}</b><span class="kj" style="height:${v}%"></span>` : ""}<em>${label(d)}</em></div>`;
  }).join("");
  const maxRev = Math.max(1, ...last.map(d => (A.days[d] || {}).reviews || 0));
  $("#ankiChart").innerHTML = last.map(d => {
    const x = A.days[d] || { reviews: 0, again: 0, hard: 0 }, h = v => (v / maxRev * 100) + "%";
    return `<div class="col" title="${t("chart.anki", { d: fmt(d), r: x.reviews, a: x.again, h: x.hard })}">${x.reviews ? `<b>${x.reviews}</b>` : ""}<span class="good" style="height:${h(x.reviews - x.again - x.hard)}"></span><span class="hard" style="height:${h(x.hard)}"></span><span class="again" style="height:${h(x.again)}"></span><em>${label(d)}</em></div>`;
  }).join("");
  // title tooltips don't work on touch: show the same text in a toast on tap
  document.addEventListener("click", e => {
    const el = e.target.closest("#heat [title], .chart [title]");
    if (!el) return;
    const tip = $("#tip"); tip.textContent = el.title; tip.hidden = false;
    clearTimeout(tip.timer); tip.timer = setTimeout(() => tip.hidden = true, 2500);
  });

  // ---------- mistakes ----------
  const ms = [...D.mistakes].sort((x, y) => (x.due || "9").localeCompare(y.due || "9"));
  const cls = m => m.due && m.due <= today ? "due" : "later";
  $("#mistakeSum").textContent = t("m.sum", { n: ms.length, d: ms.filter(m => cls(m) === "due").length });
  const byCat = {};
  for (const m of D.mistakes) byCat[m.cat || "lain"] = (byCat[m.cat || "lain"] || 0) + 1;
  $("#weak").innerHTML = Object.keys(byCat).length ? `<span class="mono muted small">${t("h.weak")}:</span>` + Object.entries(byCat).sort((x, y) => y[1] - x[1]).map(([k, n]) => `<span class="wc">${t("cat." + k)} <b>${n}</b></span>`).join("") : "";
  // compact chips; tapping one shows its right/wrong answer in a single panel below
  const chip = m => `<button type="button" class="mc ${cls(m)}" data-i="${D.mistakes.indexOf(m)}">${esc(m.item)}</button>`;
  const due = ms.filter(m => cls(m) === "due"), later = ms.filter(m => cls(m) !== "due");
  $("#mistakes").innerHTML = `<div class="mcs">${[...due, ...later].map(chip).join("")}</div>
    <div class="mdet" id="mdet" hidden></div>`;
  $("#mistakes").addEventListener("click", e => {
    const b = e.target.closest(".mc"); if (!b) return;
    const m = D.mistakes[b.dataset.i], box = $("#mdet"), again = b.getAttribute("aria-pressed") === "true";
    $("#mistakes").querySelectorAll(".mc").forEach(x => x.setAttribute("aria-pressed", !again && x === b));
    if (again) { box.hidden = true; return; }  // tapping the open chip closes it
    box.hidden = false; b.after(box);
    box.innerHTML = `<b>${esc(m.item)}</b> <small class="mono muted">${m.due ? fmt(m.due) : "–"} · ${esc(m.interval)} ${t("d")}</small>
      <p><b class="mono">${t("m.right")}</b> ${esc(m.right)}</p><p><b class="mono">${t("m.wrong")}</b> ${esc(m.wrong)}</p>`;
  });

  // ---------- log ----------
  // one collapsed row per day (summary chips); sessions and notes only when opened
  $("#logNote").textContent = t("log.note");
  const short = m => m.replace(/\s*\([^)]*\)/g, "").trim();  // drop "(話す/今/…)" word lists
  $("#log").innerHTML = Object.keys(byDay).sort().reverse().slice(0, 14).map((d, i) => {
    const ss = byDay[d], kinds = [...new Set(ss.map(s => s.kind))];
    const chips = kinds.map(k => {
      const ks = ss.filter(s => s.kind === k), v = k === "kanji" ? avg(fullRounds(d)) : null;
      return `<span class="k ${k}">${t("kind." + k)} ×${ks.length}${v != null ? " · " + v + "%" : ""}</span>`;
    }).join("");
    return `<details class="day"><summary><span class="mono">${fmt(d)}</span><span class="chips">${chips}</span></summary>
      ${ss.map(s => `<div class="s"><span class="k ${s.kind}"></span><div><b>${esc(short(s.mode))}</b> <span class="sc">${esc(s.score)}</span>${s.note ? `<p>${esc(s.note)}</p>` : ""}</div></div>`).join("")}</details>`;
  }).join("");
  $("#log").addEventListener("click", e => e.target.closest(".s")?.classList.toggle("full"));  // notes: 1 line until tapped


  // study time = Anki (measured) + the study chat (measured, AFK-aware). Days without chat data fall back to logged or estimated minutes per row (shown with ±)
  const EST = { kanji: 12, minna: 20, kaiwa: 15, kosakata: 10, bonus: 15 };  // per logged row (rows are often parts of one sitting)
  const chat = d => (D.study?.days || {})[d];
  const mins = d => ((A.days[d] || {}).ankiMin || 0) + (chat(d) ?? (byDay[d] || []).reduce((x, s) => x + (s.min ?? EST[s.kind] ?? 15), 0));
  const est = d => chat(d) === undefined && (byDay[d] || []).some(s => s.min == null);
  const learned = [...new Set(ss.map(s => short(s.mode)))];
  if (a.new) learned.unshift(t("fx.ankiNew", { n: a.new }));

  // ---------- badges ----------
  const allDays = []; for (let x = first; x <= today; x = addDays(x, 1)) allDays.push(x);
  const allMin = allDays.reduce((n, x) => n + mins(x), 0);
  let longest = 0, runLen = 0;
  for (const x of allDays) { runLen = studied(x) ? runLen + 1 : 0; longest = Math.max(longest, runLen); }
  const stat = { words: A.kaishiOpened ?? 0, kanji: A.kanjiSeen ?? 0, streak: longest, bab: D.bab ?? 0, kaiwa: D.sessions.filter(s => s.kind === "kaiwa").length, hours: Math.floor(allMin / 60), rounds: totalRounds };
  const LADDER = { words: [100, 500, 1000, 1500], kanji: [100, 300, 500, 650], streak: [3, 7, 14, 30], bab: [20, 25, 35, 50], kaiwa: [5, 10, 25, 50], hours: [10, 25, 50, 100], rounds: [10, 25, 50, 100] };
  const badges = Object.entries(LADDER).flatMap(([k, ns]) => ns.map(n => ({ k, n, label: t("badge." + k, { n }), on: stat[k] >= n, have: stat[k] })));
  const got = badges.filter(b => b.on), nextB = badges.filter(b => !b.on).sort((x, y) => y.have / y.n - x.have / x.n)[0];
  $("#badges").innerHTML = `<summary class="mono">🏅 ${t("h.badges")} · ${t("badge.sum", { a: got.length, b: badges.length })}</summary>
    <div class="bgs">${badges.map(b => `<span class="bg ${b.on ? "on" : ""}" title="${b.have} / ${b.n}">${esc(b.label)}</span>`).join("")}</div>`;

  // ---------- weekly recap (for Flex) ----------
  const wkDays = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).filter(x => x >= first);
  const wkRounds = wkDays.flatMap(fullRounds);
  const recap = {
    min: wkDays.reduce((n, x) => n + mins(x), 0), est: wkDays.some(est), days: wkDays.filter(studied).length, of: wkDays.length,
    kaishi: wkDays.reduce((n, x) => n + ((A.days[x] || {}).kaishiNew || 0), 0), reviews: wkDays.reduce((n, x) => n + ((A.days[x] || {}).reviews || 0), 0),
    rounds: wkRounds.length, avg: avg(wkRounds),
  };

  const hm = m => t("fx.hm", { h: Math.floor(m / 60), m: m % 60 });

  // ---------- summary strip: the answer to "how am I doing" before any detail ----------
  const todayMin = mins(today), todo = (isRest(today) ? ["anki"] : ["anki", "kanji", "minna", "kaiwa"]).filter(k => !st[k]), allN = isRest(today) ? 1 : 4;
  $("#sumHours").textContent = (est(today) && todayMin ? "±" : "") + hm(todayMin);
  $("#sumHoursSub").textContent = chat(today) !== undefined ? t("sum.hours.sub", { a: a.ankiMin || 0, c: chat(today) }) : t("sum.hours.est", { a: a.ankiMin || 0 });
  $("#sumMissions").textContent = `${allN - todo.length} / ${allN}`;
  $("#sumMissionsSub").textContent = todo.length ? t("sum.left", { l: todo.map(k => t("w." + k)).join(", ") }) : t("sum.alldone");
  $("#sumStreak").textContent = active;
  $("#sumWeek").textContent = (recap.est ? "±" : "") + hm(recap.min);
  $("#sumWeekSub").textContent = t("sum.week.sub", { d: recap.days, n: recap.of });
  // appreciation: partial days still count, say so
  const yest = addDays(today, -1), pr = d => ({ r: (A.days[d] || {}).reviews || 0, m: hm(mins(d)) });
  $("#praise").textContent = studied(today) ? (todo.length ? t("praise.today", pr(today)) : "")
    : studied(yest) && yest >= first && !complete(yest) ? t("praise.yest", pr(yest)) : t("praise.none");

  let quotes = [];
  try { quotes = await (await fetch("data/quotes.json")).json(); } catch { /* Flex works without quotes */ }

  window.initFlex?.({
    quotes, recap, badges: { got: got.map(b => b.label), total: badges.length, next: nextB ? { label: nextB.label, have: nextB.have, need: nextB.n } : null },
    min: mins(today), minEst: est(today), learned, hoursSub: $("#sumHoursSub").textContent,
    week7: Array.from({ length: 7 }, (_, i) => { const x = addDays(today, i - 6); return [x, x < first ? 0 : mins(x)]; }),
    totalMin: allMin,
    date: today, st, done: count(today), rounds: rounds.length, avg: avg(rounds), reviews: a.reviews || 0, kaishiNew: a.kaishiNew || 0,
    dateLabel: new Date(today + "T00:00:00Z").toLocaleDateString(loc, { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }),
    kaishiOpened: A.kaishiOpened || 0, kanjiSeen: A.kanjiSeen || 0, kanjiList: A.kanjiList || "", bab: D.bab ?? "–",
    streak, active, totalRounds, mistakes: D.mistakes.length,
    minna: minnaS.map(s => s.mode), kaiwa: kaiwaS.length, n3Month: monthYear(n3.date),
    daysN3: daysBetween(today, n3.date), n3Total: daysBetween(P.weeks[0].start, n3.date), startLabel: fmt(P.weeks[0].start),
    heat: Array.from({ length: 56 }, (_, i) => { const x = addDays(today, i - 55); return x < first ? -1 : level(x); }),
    week: [[t("fx.wMinna"), D.bab ?? 0, wk.bab], [t("fx.wKaishi"), A.kaishiOpened ?? 0, wk.kaishi]],
  });
})();
