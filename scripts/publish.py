"""Build data.json from catatan/progres.md + the local Anki collection, then commit and push.

Run at the end of every study session:  python -I tracker/publish.py
Also runs hourly via Windows Task Scheduler ("Nihongo tracker sync").
Options: --no-push (build only)
"""
import datetime as dt, json, os, re, shutil, sqlite3, subprocess, sys, tempfile

if sys.stdout is None:  # pythonw (Task Scheduler) has no console
    sys.stdout = sys.stderr = open(os.path.join(tempfile.gettempdir(), "nihongo-publish.log"), "a", encoding="utf-8")
    print(f"--- {dt.datetime.now():%Y-%m-%d %H:%M}")
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # tracker/
OUT = os.path.join(ROOT, "data", "data.json")
PROGRES = os.path.join(ROOT, "..", "catatan", "progres.md")
ANKI = os.path.join(os.environ.get("APPDATA", ""), "Anki2", "User 1", "collection.anki2")
KANJI = re.compile(r"[一-鿿]")
FRAC = re.compile(r"(\d+)\s*/\s*(\d+)")
TURNS = re.compile(r"(\d+)\s*giliran")
NOTE_MAX = 160  # notes are published in a public repo: keep them short


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


def sessions(md):
    out = []
    for date, mode, score, note in table(md, "Riwayat sesi", 4):
        f, t = FRAC.search(score), TURNS.search(score)
        out.append({"date": date, "kind": kind(mode), "mode": mode, "score": score,
                    "ok": int(f[1]) if f else None, "total": int(f[2]) if f else None,
                    "turns": int(t[1]) if t else None, "shadowing": "shadowing" in mode.lower(),
                    "note": note if len(note) <= NOTE_MAX else note[:NOTE_MAX - 1] + "…"})
    return out


def mistakes(md):
    return [dict(zip(("item", "right", "wrong", "interval", "due"), r)) for r in table(md, "Bank kesalahan", 5)]


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
        crt = c.execute("select crt from col").fetchone()[0]
        today = (dt.datetime.now() - dt.timedelta(hours=4)).date()  # Anki's day starts at 4am
        days, seen, seen_rtk = {}, set(), set()
        for rid, ease, typ, cid, nid, did in c.execute(
                "select r.id, r.ease, r.type, r.cid, k.nid, k.did from revlog r join cards k on k.id=r.cid order by r.id"):
            d = (dt.datetime.fromtimestamp(rid / 1000) - dt.timedelta(hours=4)).date().isoformat()
            x = days.setdefault(d, {"reviews": 0, "again": 0, "hard": 0, "kaishiNew": 0, "rtkNew": 0, "new": 0})
            x["reviews"] += 1; x["again"] += ease == 1; x["hard"] += ease == 2  # sched v2/v3: ease 2 = Hard
            if cid not in seen:
                seen.add(cid); x["new"] += 1; x["kaishiNew"] += did == kaishi
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
        days.setdefault(today.isoformat(), {"reviews": 0, "again": 0, "hard": 0, "kaishiNew": 0, "rtkNew": 0, "new": 0})["dueLeft"] = due_now
        return {"days": days, "today": today.isoformat(), "dueNow": due_now,
                "kaishiOpened": len({n for n, _, d, _ in studied if d == kaishi}),
                "kaishiMature": len({n for n, _, d, ivl in studied if d == kaishi and ivl >= 21}),
                "kanjiKnown": len({n for n, _, d, _ in studied if d in rtk}),
                "kanjiSeen": len(kanji), "kanjiList": "".join(sorted(kanji))}
    except Exception as e:  # a half-copied database must not kill the whole run
        print(f"! Anki gagal dibaca ({e}), pakai data Anki lama"); return old
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def build():
    try: old = json.load(open(OUT, encoding="utf-8"))
    except (OSError, ValueError): old = {}
    md = open(PROGRES, encoding="utf-8").read()
    bab = re.search(r"Bab sekarang:\s*(\d+)", md)
    data = {
        "generated": dt.datetime.now().isoformat(timespec="minutes"),
        "bab": int(bab[1]) if bab else None,
        "sessions": sessions(md),
        "mistakes": mistakes(md),
        "anki": anki(old.get("anki")),
        "plan": json.load(open(os.path.join(ROOT, "data", "plan.json"), encoding="utf-8")),
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
    git("add", "data/data.json")  # only data: code changes are committed by hand
    if git("diff", "--cached", "--quiet").returncode:
        git("commit", "-m", f"progres {dt.date.today().isoformat()}")
    if "ahead" not in git("status", "-sb").stdout.splitlines()[0]:  # also retries an earlier failed push
        print("tidak ada yang perlu di-push"); return
    r = git("push", "-q")
    print("push gagal:\n" + r.stderr if r.returncode else "di-push, Vercel deploy ±1 menit")


def selftest():
    assert [kind(m) for m in ("tebak kanji ronde 1", "kaiwa kantor", "skrip shadowing", "jikoshoukai", "materi kata kecil Kaishi", "bab 15: ～ています")] == \
        ["kanji", "kaiwa", "kaiwa", "bonus", "kosakata", "minna"]
    md = "## Riwayat sesi\n| T | M | S | C |\n|---|---|---|---|\n| 2026-11-17 | kaiwa | 6 giliran | ok |\n| rusak | a | b | c | d | e |\n\n## Lain\n"
    s = sessions(md)
    assert len(s) == 1 and s[0]["turns"] == 6 and s[0]["kind"] == "kaiwa", s
    print("selftest ok")


if __name__ == "__main__":
    if "--test" in sys.argv: selftest(); sys.exit()
    build()
    if "--no-push" not in sys.argv: push()
