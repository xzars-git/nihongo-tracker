"""Build data.json from catatan/progres.md + the local Anki collection, then commit and push.

Run at the end of every study session:  python -I tracker/publish.py
Options: --no-push (build only)
"""
import datetime as dt, json, os, re, shutil, sqlite3, subprocess, sys, tempfile

sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
PROGRES = os.path.join(HERE, "..", "catatan", "progres.md")
ANKI = os.path.join(os.environ.get("APPDATA", ""), "Anki2", "User 1", "collection.anki2")
KANJI = re.compile(r"[一-鿿]")
FRAC = re.compile(r"(\d+)\s*/\s*(\d+)")


def table(md, heading):
    """Rows (list of cells) of the first markdown table under '## heading'."""
    part = md.split(f"## {heading}", 1)[1].split("\n## ", 1)[0]
    rows = [l.strip().strip("|").split("|") for l in part.splitlines() if l.strip().startswith("|")]
    return [[c.strip() for c in r] for r in rows[2:]]  # skip header + separator


def kind(mode):
    m = mode.lower()
    if "tebak kanji" in m: return "kanji"
    if "kaiwa" in m or "jikoshoukai" in m: return "kaiwa"
    return "minna"


def sessions(md):
    out = []
    for date, mode, score, note in table(md, "Riwayat sesi"):
        f = FRAC.search(score)
        out.append({"date": date, "kind": kind(mode), "mode": mode, "score": score,
                    "ok": int(f[1]) if f else None, "total": int(f[2]) if f else None, "note": note})
    return out


def mistakes(md):
    out = []
    for r in table(md, "Bank kesalahan"):
        item, right, wrong, ivl, due = (r + [""] * 5)[:5]
        out.append({"item": item, "right": right, "wrong": wrong, "interval": ivl, "due": due})
    return out


def anki():
    if not os.path.exists(ANKI):
        print("! Anki collection tidak ketemu, statistik Anki dilewati"); return None
    tmp = tempfile.mkdtemp()
    try:
        for ext in ("", "-wal"):  # copy so a running Anki is never touched
            if os.path.exists(ANKI + ext): shutil.copy(ANKI + ext, os.path.join(tmp, "c" + ext))
        c = sqlite3.connect(os.path.join(tmp, "c"))
        decks = dict(c.execute("select id, name from decks"))
        kaishi = next(i for i, n in decks.items() if n == "Kaishi 1.5k")
        crt = c.execute("select crt from col").fetchone()[0]
        today = (dt.datetime.now() - dt.timedelta(hours=4)).date()  # Anki's day starts at 4am
        days, seen = {}, set()
        for rid, ease, cid, did in c.execute("select r.id, r.ease, r.cid, k.did from revlog r join cards k on k.id=r.cid order by r.id"):
            d = (dt.datetime.fromtimestamp(rid / 1000) - dt.timedelta(hours=4)).date().isoformat()
            x = days.setdefault(d, {"reviews": 0, "again": 0, "hard": 0, "kaishiNew": 0, "new": 0})
            x["reviews"] += 1; x["again"] += ease == 1; x["hard"] += ease == 2
            if cid not in seen:
                seen.add(cid); x["new"] += 1; x["kaishiNew"] += did == kaishi
        studied = c.execute("select n.flds, k.did from cards k join notes n on n.id=k.nid where k.type>0").fetchall()
        kanji = {ch for flds, _ in studied for ch in KANJI.findall(flds.split("\x1f")[0])}
        rtk = {i for i, n in decks.items() if n.startswith("All in one Kanji")}
        rtk_known = sum(d in rtk for _, d in studied)
        kaishi_open = len({f for f, d in studied if d == kaishi})
        due_day = (today - dt.date.fromtimestamp(crt)).days  # review cards store due as day number
        due_now = c.execute("select count(*) from cards where queue=2 and due<=?", (due_day,)).fetchone()[0]
        due_now += c.execute("select count(*) from cards where queue in (1,3) and due<=?", (int(dt.datetime.now().timestamp()) + 1200,)).fetchone()[0]
        return {"days": days, "kaishiOpened": kaishi_open, "kanjiKnown": rtk_known, "kanjiSeen": len(kanji), "dueNow": due_now, "today": today.isoformat()}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def build():
    md = open(PROGRES, encoding="utf-8").read()
    bab = re.search(r"Bab sekarang:\s*(\d+)", md)
    data = {
        "generated": dt.datetime.now().isoformat(timespec="minutes"),
        "bab": int(bab[1]) if bab else None,
        "sessions": sessions(md),
        "mistakes": mistakes(md),
        "anki": anki(),
        "plan": json.load(open(os.path.join(HERE, "plan.json"), encoding="utf-8")),
    }
    open(os.path.join(HERE, "data.json"), "w", encoding="utf-8").write(json.dumps(data, ensure_ascii=False, indent=1))
    a = data["anki"] or {}
    print(f"data.json: {len(data['sessions'])} sesi, {len(data['mistakes'])} item bank kesalahan, "
          f"bab {data['bab']}, Kaishi {a.get('kaishiOpened')}, kanji {a.get('kanjiKnown')}, due {a.get('dueNow')}")


def push():
    git = lambda *a: subprocess.run(["git", "-C", HERE, *a], capture_output=True, text=True)
    git("add", "-A")
    if git("diff", "--cached", "--quiet").returncode == 0:
        print("tidak ada perubahan"); return
    git("commit", "-m", f"progres {dt.date.today().isoformat()}")
    r = git("push", "-q")
    print("push gagal:\n" + r.stderr if r.returncode else "di-push, Vercel deploy ±1 menit")


if __name__ == "__main__":
    build()
    if "--no-push" not in sys.argv: push()
