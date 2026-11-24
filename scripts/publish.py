"""Build data.json from the PostgreSQL tracker database + the local Anki collection, then commit and push.

Run at the end of every study session:  python -I tracker/scripts/publish.py
Also runs at 00:00, 12:00, 18:00 and 21:00 from the Nihongo Sync tray app (scripts/nihongo-sync.ps1).
Options: --no-push (build only)
"""
import datetime as dt, glob, json, os, re, shutil, sqlite3, subprocess, sys, tempfile

if sys.stdout is None:  # pythonw (Task Scheduler) has no console
    sys.stdout = sys.stderr = open(os.path.join(tempfile.gettempdir(), "nihongo-publish.log"), "a", encoding="utf-8")
    print(f"--- {dt.datetime.now():%Y-%m-%d %H:%M}")
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # tracker/
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # -I drops the script folder from sys.path
import db
OUT = os.path.join(ROOT, "data", "data.json")
def find_anki():
    # the profile name changes (e.g. after logging in to AnkiWeb): use the most recently written collection
    base = os.path.join(os.environ.get("APPDATA", ""), "Anki2")
    found = glob.glob(os.path.join(base, "*", "collection.anki2"))
    return max(found, key=os.path.getmtime) if found else os.path.join(base, "User 1", "collection.anki2")
ANKI = find_anki()
KANJI = re.compile(r"[一-鿿]")
FRAC = re.compile(r"(\d+)\s*/\s*(\d+)")
TURNS = re.compile(r"(\d+)\s*giliran")
MINS = re.compile(r"(\d+)\s*mnt")  # session length, logged with catat.py --menit
NOTE_MAX = 160  # notes are published in a public repo: keep them short
TS = re.compile(r'"timestamp"\s*:\s*"([^"]+)"')


def table(md, heading, cols):
    """Rows of the first markdown table under '## heading'; malformed rows are skipped with a warning."""
    part = md.split(f"## {heading}", 1)[1].split("\n## ", 1)[0]
    rows = [l.strip().strip("|").split("|") for l in part.splitlines() if l.strip().startswith("|")][2:]
    out = []
    for r in rows:
        r = [c.strip() for c in r]
        if len(r) < cols - 1 or len(r) > cols:
            print(f"! baris {heading} dilewati ({len(r)} kolom): {'|'.join(r)[:60]}"); continue
        out.append((r + [""])[:cols])
    return out


def kind(mode):
    m = mode.lower()
    if "tebak kanji" in m: return "kanji"
    if "jikoshoukai" in m: return "bonus"
    if "kaiwa" in m or "shadowing" in m: return "kaiwa"
    if "kaishi" in m: return "kosakata"
    return "minna"  # grammar/verb-form drills all come from Minna chapters


def sessions(rows):
    out = []
    for date, mode, score, note in rows:
        f, t = FRAC.search(score), TURNS.search(score)
        out.append({"date": date, "kind": kind(mode), "mode": mode, "score": score,
                    "ok": int(f[1]) if f else None, "total": int(f[2]) if f else None,
                    "turns": int(t[1]) if t else None, "min": int(MINS.search(score)[1]) if MINS.search(score) else None, "shadowing": "shadowing" in mode.lower(),
                    "note": note if len(note) <= NOTE_MAX else note[:NOTE_MAX - 1] + "…"})
    return out


WEAK = [  # first match wins; keys are translated in i18n.js (cat.*)
    ("kanji", re.compile(r"^kanji", re.I)),
    ("partikel", re.compile(r"partikel|pakai [でにがを]|harus [でにがをは]|は hilang", re.I)),
    ("bentuk", re.compile(r"gol|bentuk|っ|て形|ない|tetap bunyi|kitte|mitte", re.I)),
    ("mirip", re.compile(r"\bvs\b|tertukar|dikira", re.I)),
]


def weak_kind(item, wrong, right=""):
    if WEAK[0][1].search(item): return "kanji"
    text = f"{item} {wrong} {right}"
    return next((k for k, rx in WEAK[1:] if rx.search(text)), "lain")


def mistakes(rows):
    out = [dict(zip(("item", "right", "wrong", "interval", "due"), r)) for r in rows]
    for m in out: m["cat"] = weak_kind(m["item"], m["wrong"], m["right"])
    return out


def anki(old):
    if not os.path.exists(ANKI):
        print("! Anki collection tidak ketemu, pakai data Anki lama"); return old
    tmp = tempfile.mkdtemp()
    try:
        for ext in ("", "-wal"):  # copy so a running Anki is never touched
            if os.path.exists(ANKI + ext): shutil.copy(ANKI + ext, os.path.join(tmp, "c" + ext))
        c = sqlite3.connect(os.path.join(tmp, "c"))
        decks = dict(c.execute("select id, name from decks"))
        kaishi = next(i for i, n in decks.items() if n == "Kaishi 1.5k")
        rtk = {i for i, n in decks.items() if n.startswith("All in one Kanji")}
        minna = {i for i, n in decks.items() if n.lower().startswith("minna no nihongo")}  # Bab decks count as Minna activity
        crt = c.execute("select crt from col").fetchone()[0]
        today = (dt.datetime.now() - dt.timedelta(hours=4)).date()  # Anki's day starts at 4am
        days, seen, seen_rtk, seen_kanji = {}, set(), set(), set()
        for rid, ease, typ, cid, nid, did, ms, flds in c.execute(
                "select r.id, r.ease, r.type, r.cid, k.nid, k.did, r.time, n.flds from revlog r join cards k on k.id=r.cid join notes n on n.id=k.nid order by r.id"):
            d = (dt.datetime.fromtimestamp(rid / 1000) - dt.timedelta(hours=4)).date().isoformat()
            x = days.setdefault(d, dict.fromkeys(ANKI_DAY[:9], 0))
            x["ankiMs"] = x.get("ankiMs", 0) + ms  # Anki caps each answer at 60s
            x["reviews"] += 1; x["again"] += ease == 1; x["hard"] += ease == 2  # sched v2/v3: ease 2 = Hard
            if cid not in seen:
                seen.add(cid); x["new"] += 1; x["kaishiNew"] += did == kaishi
                for ch in KANJI.findall(flds.split("\x1f")[0]):  # kanji met for the first time on this day, any deck
                    if ch not in seen_kanji: seen_kanji.add(ch); x["kanjiNew"] += 1
            x["minnaRev"] += did in minna
            if did in rtk and nid not in seen_rtk:  # RTK has 2 cards per kanji: count notes
                seen_rtk.add(nid); x["rtkNew"] += 1
        studied = c.execute("select n.id, n.flds, k.did, k.ivl from cards k join notes n on n.id=k.nid where k.type>0").fetchall()
        kanji = {ch for _, flds, _, _ in studied for ch in KANJI.findall(flds.split("\x1f")[0])}
        due_day = (today - dt.date.fromtimestamp(crt)).days  # review/day-learning cards store due as day number
        due_now = c.execute("select count(*) from cards where queue in (2,3) and due<=?", (due_day,)).fetchone()[0]
        due_now += c.execute("select count(*) from cards where queue=1 and due<=?", (int(dt.datetime.now().timestamp()) + 1200,)).fetchone()[0]
        # remember what was left at each day's last run, so past days can be judged "Anki beres" too
        for d, x in (old or {}).get("days", {}).items():
            if "dueLeft" in x and d in days: days[d]["dueLeft"] = x["dueLeft"]
        days.setdefault(today.isoformat(), dict.fromkeys(ANKI_DAY[:9], 0))["dueLeft"] = due_now
        for x in days.values(): x["ankiMin"] = round(x.pop("ankiMs", 0) / 6e4)
        return {"days": days, "today": today.isoformat(), "dueNow": due_now,
                "kaishiOpened": len({n for n, _, d, _ in studied if d == kaishi}),
                "kaishiMature": len({n for n, _, d, ivl in studied if d == kaishi and ivl >= 21}),
                "kanjiKnown": len({n for n, _, d, _ in studied if d in rtk}),
                "kanjiSeen": len(kanji), "kanjiList": "".join(sorted(kanji))}
    except Exception as e:  # a half-copied database must not kill the whole run
        print(f"! Anki gagal dibaca ({e}), pakai data Anki lama"); return old
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


EN_TABLES = {"levels": ("en_levels", ("skill", "level", "source")), "practice": ("en_practice", ("skill", "task", "band", "note")),
             "mistakes": ("en_mistakes", ("cat", "wrong", "correct")), "words": ("en_words", ("word", "meaning", "example"))}


def english(c):
    """data/english.json from the database (my own reports, so not live)."""
    out = os.path.join(ROOT, "data", "english.json")
    key = {"correct": "right"}  # the page and the old json call the column "right"
    new = json.dumps({k: [dict(zip(("date", *(key.get(x, x) for x in cols)), r)) for r in c.execute(f"select day::text, {', '.join(cols)} from {t} order by id").fetchall()]
                      for k, (t, cols) in EN_TABLES.items()}, ensure_ascii=False, indent=1)
    if os.path.exists(out) and open(out, encoding="utf-8").read() == new: return
    open(out, "w", encoding="utf-8").write(new)
    print("english.json updated")


def transcripts(title):
    """Message times of every Claude Code session whose title contains `title` (the dedicated study chat).
    Only timestamps are read, never the conversation text. None when the transcript folder does not exist."""
    base = os.path.join(os.path.expanduser("~"), ".claude", "projects", re.sub(r"[^A-Za-z0-9]", "-", os.path.dirname(ROOT)))
    if not os.path.isdir(base): return None
    out = []
    for name in os.listdir(base):
        if not name.endswith(".jsonl"): continue
        times, hit = [], False
        with open(os.path.join(base, name), encoding="utf-8", errors="ignore") as f:
            for line in f:
                if not hit and '"customTitle"' in line and title in line.lower(): hit = True
                m = TS.search(line)
                if m: times.append(m[1])
        if hit: out.append(times)
    return out


def study_minutes(sessions, cap=180):
    """Active minutes per day (day starts at 4am) from the message times of the study chat.
    A gap between two messages counts at most `cap` seconds: longer means away from the keyboard.
    Sessions that overlap (a resumed or forked chat repeats old messages) are merged, so nothing counts twice."""
    ivs = []
    for times in sessions:
        ts = sorted(dt.datetime.fromisoformat(t.replace("Z", "+00:00")).astimezone() for t in times)
        ivs += [(a, a + dt.timedelta(seconds=min((b - a).total_seconds(), cap))) for a, b in zip(ts, ts[1:])]
    secs, cur = {}, None
    def flush(c):
        day = (c[0] - dt.timedelta(hours=4)).date().isoformat()
        secs[day] = secs.get(day, 0) + (c[1] - c[0]).total_seconds()
    for a, b in sorted(ivs):
        if cur and a <= cur[1]: cur = (cur[0], max(cur[1], b))
        else:
            if cur: flush(cur)
            cur = (a, b)
    if cur: flush(cur)
    return {d: round(s / 60) for d, s in secs.items() if s >= 30}


def study(plan, old, c):
    """{"days": {date: minutes}}. Old values are kept (Claude Code deletes old transcripts after a while); a day only ever grows."""
    cfg = plan.get("study", {})
    days = dict((old or {}).get("days", {}))
    title = cfg.get("sessionTitle", "").lower()
    if title:
        sessions = transcripts(title)
        if sessions is None: print("! transkrip chat tidak ketemu, pakai waktu belajar lama")
        else:
            for d, m in study_minutes(sessions, cfg.get("afkSeconds", 180)).items(): days[d] = max(days.get(d, 0), m)
    for d, m in days.items():
        c.execute("insert into study_days values (%s,%s) on conflict (day) do update set minutes = greatest(study_days.minutes, excluded.minutes)", (d, m))
    return {"days": dict(sorted(days.items())), "afkSeconds": cfg.get("afkSeconds", 180)}


ANKI_DAY = ("reviews", "again", "hard", "kaishiNew", "rtkNew", "new", "ankiMin", "minnaRev", "kanjiNew", "dueLeft")


def load_anki(c):
    """Anki numbers from the last sync, in the same shape anki() returns (None before the first sync)."""
    st = c.execute("select today::text, due_now, kaishi_opened, kaishi_mature, kanji_known, kanji_seen, kanji_list from anki_state").fetchone()
    if not st: return None
    days = {}
    for d, *v in c.execute("select day::text, reviews, again, hard, kaishi_new, rtk_new, new_cards, anki_min, minna_rev, kanji_new, due_left from anki_days order by day"):
        days[d] = {k: x for k, x in zip(ANKI_DAY, v) if x is not None}
    return {"days": days, "today": st[0], "dueNow": st[1], "kaishiOpened": st[2], "kaishiMature": st[3], "kanjiKnown": st[4], "kanjiSeen": st[5], "kanjiList": st[6]}


def save_anki(c, a):
    for d, x in a["days"].items():
        c.execute("""insert into anki_days (day, reviews, again, hard, kaishi_new, rtk_new, new_cards, anki_min, minna_rev, kanji_new, due_left) values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                     on conflict (day) do update set reviews=excluded.reviews, again=excluded.again, hard=excluded.hard, kaishi_new=excluded.kaishi_new,
                     rtk_new=excluded.rtk_new, new_cards=excluded.new_cards, anki_min=excluded.anki_min, minna_rev=excluded.minna_rev, kanji_new=excluded.kanji_new, due_left=coalesce(excluded.due_left, anki_days.due_left)""",
                  (d, *(x.get(k, 0) for k in ANKI_DAY[:9]), x.get("dueLeft")))
    c.execute("""insert into anki_state values (1,%s,%s,%s,%s,%s,%s,%s) on conflict (id) do update set today=excluded.today, due_now=excluded.due_now,
                 kaishi_opened=excluded.kaishi_opened, kaishi_mature=excluded.kaishi_mature, kanji_known=excluded.kanji_known, kanji_seen=excluded.kanji_seen, kanji_list=excluded.kanji_list""",
              (a["today"], a["dueNow"], a["kaishiOpened"], a["kaishiMature"], a["kanjiKnown"], a["kanjiSeen"], a["kanjiList"]))


def build(c):
    try: old = json.load(open(OUT, encoding="utf-8"))
    except (OSError, ValueError): old = {}
    plan = json.load(open(os.path.join(ROOT, "data", "plan.json"), encoding="utf-8"))
    bab = c.execute("select value from meta where key = 'bab'").fetchone()
    old_anki = load_anki(c)
    new_anki = anki(old_anki)
    if new_anki and new_anki is not old_anki: save_anki(c, new_anki)
    data = {
        "generated": dt.datetime.now().isoformat(timespec="minutes"),
        "bab": int(bab[0]) if bab else None,
        "sessions": sessions(c.execute("select day::text, mode, score, note from sessions order by id").fetchall()),
        "mistakes": mistakes(c.execute("select item, correct, wrong, interval::text, coalesce(due::text, '') from mistakes order by pos").fetchall()),
        "anki": new_anki,
        "plan": plan,
        "study": study(plan, {"days": dict(c.execute("select day::text, minutes from study_days order by day").fetchall())}, c),
    }
    # Unchanged data is not rewritten, except once a day as a heartbeat (the page warns when data is >30h old).
    if {**old, "generated": data["generated"]} == data and old.get("generated", "")[:10] == data["generated"][:10]:
        print("data tidak berubah"); return
    open(OUT, "w", encoding="utf-8").write(json.dumps(data, ensure_ascii=False, indent=1))
    a = data["anki"] or {}
    print(f"data.json: {len(data['sessions'])} sesi, {len(data['mistakes'])} item bank kesalahan, "
          f"bab {data['bab']}, Kaishi {a.get('kaishiOpened')}, kanji RTK {a.get('kanjiKnown')}, due {a.get('dueNow')}")


def push():
    git = lambda *a: subprocess.run(["git", "-C", ROOT, *a], capture_output=True, text=True)
    git("add", *[p for p in ("data/data.json", "data/english.json", "data/shadow-enc") if os.path.exists(os.path.join(ROOT, p))])  # only data: code changes are committed by hand
    if git("diff", "--cached", "--quiet").returncode:
        git("commit", "--no-verify", "-m", f"progres {dt.date.today().isoformat()}")  # the sync must never be blocked by the code-check hook
    if "ahead" not in git("status", "-sb").stdout.splitlines()[0]:  # also retries an earlier failed push
        print("tidak ada yang perlu di-push"); return
    r = git("push", "-q")
    print("push gagal:\n" + r.stderr if r.returncode else "di-push, Vercel deploy ±1 menit")


def backup():
    """Back up the notes (catatan/, tutor skill) to the private notes repo, if one is set up next to tracker/."""
    top = os.path.dirname(ROOT)
    if not os.path.isdir(os.path.join(top, ".git")): return
    git = lambda *a: subprocess.run(["git", "-C", top, *a], capture_output=True, text=True)
    db.dump()  # SQL backup of the tracker database into catatan/ (private repo only, never into tracker/)
    git("add", "catatan", ".claude/skills", "PROMPT-SESI.md")
    if git("diff", "--cached", "--quiet").returncode:
        git("commit", "--no-verify", "-m", f"notes {dt.date.today().isoformat()}")
    if "ahead" in git("status", "-sb").stdout.splitlines()[0]:
        r = git("push", "-q")
        print("backup catatan gagal:\n" + r.stderr if r.returncode else "backup catatan di-push")


def selftest():
    assert [weak_kind(i, w) for i, w in (("Kanji Kaishi kurang hafal", "x"), ("Partikel: 好き", "x"), ("ない gol 1", "x"), ("貸す vs 借りる", "x"), ("知ります", "wakarimasen"))] == \
        ["kanji", "partikel", "bentuk", "mirip", "lain"]
    assert [kind(m) for m in ("tebak kanji ronde 1", "kaiwa kantor", "skrip shadowing", "jikoshoukai", "materi kata kecil Kaishi", "bab 15: ～ています")] == \
        ["kanji", "kaiwa", "kaiwa", "bonus", "kosakata", "minna"]
    md = "## Riwayat sesi\n| T | M | S | C |\n|---|---|---|---|\n| 2026-11-17 | kaiwa | 6 giliran · 20 mnt | ok |\n| rusak | a | b | c | d | e |\n\n## Lain\n"
    s = sessions(table(md, "Riwayat sesi", 4))
    assert len(s) == 1 and s[0]["turns"] == 6 and s[0]["min"] == 20 and s[0]["kind"] == "kaiwa", s
    # two sessions that repeat the same messages (a fork) must not double the time; an 18-minute gap counts only the cap
    msgs = ["2026-01-01T12:00:00Z", "2026-01-01T12:00:40Z", "2026-01-01T12:18:40Z", "2026-01-01T12:19:25Z"]
    assert study_minutes([msgs, msgs[:2]], 180) == {"2026-01-01": 4}, study_minutes([msgs, msgs[:2]], 180)  # 40 + 180 + 45 s = 265 s = 4.4 min
    assert table("## Words\n| D | W | M | E |\n|---|---|---|---|\n| 2026-01-01 | gist | main idea | x |\n", "Words", 4) == [["2026-01-01", "gist", "main idea", "x"]]
    print("selftest ok")


if __name__ == "__main__":
    if "--test" in sys.argv: selftest(); sys.exit()
    with db.connect() as c:  # one transaction: nothing is saved when a step fails
        build(c)
        english(c)
    if "--no-push" not in sys.argv:
        push()
        try: backup()
        except Exception as e: print(f"! backup catatan dilewati ({e})")
