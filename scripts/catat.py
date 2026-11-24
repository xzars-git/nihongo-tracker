"""Catat progres ke database PostgreSQL dengan satu perintah (dipakai sesi belajar / tutor).

  python -I tracker/scripts/catat.py sesi "<mode>" "<skor>" ["catatan"] [--menit N]
      --menit N: OPSIONAL, hanya untuk belajar di luar chat (kertas, buku). Waktu di chat dihitung otomatis dari timestamp chat belajar
      mode berisi "tebak kanji" → kanji · "kaiwa"/"shadowing" → kaiwa · "kaishi" → kosakata · lainnya → Minna
      skor: "8/10", "6 giliran", atau "–"
  python -I tracker/scripts/catat.py salah "<item>" "<jawaban benar>" "<kesalahan>"   (masuk bank, ulang besok)
  python -I tracker/scripts/catat.py review "<item>" benar|salah                    (1 → 3 → 7 → 14 → dikuasai)
  python -I tracker/scripts/catat.py bab <N>
  python -I tracker/scripts/catat.py kerja "<kata kerja baru>, <lagi>"              (tambah ke daftar kata kerja yang sudah dipelajari)
  python -I tracker/scripts/catat.py status                                 (ringkasan: bab, review jatuh tempo, sesi terakhir; dibaca tutor di awal sesi)
  python -I tracker/scripts/catat.py kirim                                  (update web sekarang; tanpa ini sync 00:00, 12:00, 18:00, 21:00)

English tracker (tanggal otomatis):
  python -I tracker/scripts/catat.py en level   "<skill>" "<A1..C2>" "<sumber>"          skill: overall|reading|listening|grammar|speaking
  python -I tracker/scripts/catat.py en latihan "<skill>" "<soal>" "<band>" "<catatan>"  band: perkiraan, mis. "5.5", atau "–"
  python -I tracker/scripts/catat.py en salah   "<jenis>" "<salah>" "<benar>"            jenis: article|preposition|tense|spelling|word|agreement|run-on
  python -I tracker/scripts/catat.py en kata    "<kata>" "<arti>" "<contoh>"
"""
import datetime as dt, os, subprocess, sys

sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)  # -I drops the script folder from sys.path
import db

EN = {"level": ("en_levels", ("skill", "level", "source")), "latihan": ("en_practice", ("skill", "task", "band", "note")),
      "salah": ("en_mistakes", ("cat", "wrong", "correct")), "kata": ("en_words", ("word", "meaning", "example"))}
STEPS = [1, 3, 7, 14]
TODAY = (dt.datetime.now() - dt.timedelta(hours=4)).date()  # same 4am day boundary as Anki


def cell(x):
    return " ".join(str(x).split()) or "–"


def next_interval(ivl, ok):
    """Review interval after an answer: wrong → 1, right → next step, right at 14 → None (mastered)."""
    if not ok: return 1
    return next((x for x in STEPS if x > ivl), None)


def main(a):
    cmd = a[0] if a else ""
    if cmd == "kirim":
        return subprocess.run([sys.executable, "-I", os.path.join(HERE, "publish.py")])
    if cmd == "en":
        table, cols = EN.get(a[1] if len(a) > 1 else "", (None, ()))
        if not table or len(a) != len(cols) + 2: sys.exit(__doc__)
        with db.connect() as c:
            c.execute(f"insert into {table} (day, {', '.join(cols)}) values (%s, {', '.join(['%s'] * len(cols))})", (TODAY, *map(cell, a[2:])))
        return print(f"english {a[1]} dicatat: {a[2]}")
    menit = None
    if "--menit" in a:  # optional session length, stored in the score cell as "· N mnt"
        i = a.index("--menit"); menit = a[i + 1]; a = a[:i] + a[i + 2:]
        if not menit.isdigit(): sys.exit("--menit harus angka, misalnya --menit 20")
    with db.connect() as c:
        if cmd == "sesi" and len(a) >= 3:
            skor = f"{a[2]} · {menit} mnt" if menit else a[2]
            c.execute("insert into sessions (day, mode, score, note) values (%s,%s,%s,%s)", (TODAY, cell(a[1]), cell(skor), cell(a[3]) if len(a) > 3 else "–"))
            print(f"sesi dicatat: {a[1]} · {skor}")
        elif cmd == "salah" and len(a) == 4:
            due = TODAY + dt.timedelta(days=1)
            old = c.execute("select wrong from mistakes where item = %s", (a[1],)).fetchone()
            if old:  # same item again: back to interval 1
                c.execute("update mistakes set correct=%s, wrong=%s, interval=1, due=%s where item=%s", (cell(a[2]), f"{old[0]}; {TODAY:%m-%d}: {cell(a[3])}", due, a[1]))
            else:
                c.execute("insert into mistakes (item, correct, wrong, interval, due) values (%s,%s,%s,1,%s)", (cell(a[1]), cell(a[2]), cell(a[3]), due))
            print(f"bank kesalahan: {a[1]} → ulang {due}")
        elif cmd == "review" and len(a) == 3 and a[2] in ("benar", "salah"):
            row = c.execute("select interval from mistakes where item = %s", (a[1],)).fetchone()
            if not row:
                items = [r[0] for r in c.execute("select item from mistakes order by pos")]
                sys.exit(f"item '{a[1]}' tidak ada di Bank kesalahan. Item yang ada:\n- " + "\n- ".join(items))
            ivl = next_interval(row[0], a[2] == "benar")
            if ivl is None:  # interval 14 answered right → mastered
                c.execute("delete from mistakes where item = %s", (a[1],))
                c.execute("insert into mastered (item, day) values (%s,%s) on conflict (item) do nothing", (a[1], TODAY))
                return print(f"dikuasai: {a[1]} 🎉")
            due = TODAY + dt.timedelta(days=ivl)
            c.execute("update mistakes set interval=%s, due=%s where item=%s", (ivl, due, a[1]))
            print(f"review {a[2]}: {a[1]} → interval {ivl} hari, ulang {due}")
        elif cmd == "bab" and len(a) == 2 and a[1].isdigit():
            c.execute("insert into meta values ('bab', %s) on conflict (key) do update set value = excluded.value", (a[1],))
            print(f"bab sekarang: {a[1]}")
        elif cmd == "kerja" and len(a) == 2:
            c.execute("insert into meta values ('verbs', %s) on conflict (key) do update set value = meta.value || ', ' || excluded.value", (cell(a[1]),))
            print(f"kata kerja ditambah: {a[1]}")
        elif cmd == "status" and len(a) == 1:
            status(c)
        else:
            sys.exit(__doc__)


def status(c):
    bab = c.execute("select value from meta where key = 'bab'").fetchone()
    print(f"Hari ini: {TODAY} · bab sekarang: {bab[0] if bab else '–'}")
    due = c.execute("select item, correct, wrong, interval, due from mistakes where due <= %s order by due, pos", (TODAY,)).fetchall()
    total = c.execute("select count(*) from mistakes").fetchone()[0]
    print(f"\nBank kesalahan: {total} item, {len(due)} jatuh tempo")
    for item, right, wrong, ivl, d in due: print(f"- {item} | benar: {right} | salah: {wrong} | interval {ivl} | {d}")
    print("\nSesi terakhir:")
    for d, mode, score, note in c.execute("select day, mode, score, note from sessions order by id desc limit 8"): print(f"- {d} · {mode} · {score}" + (f" · {note[:80]}" if note != "–" else ""))
    verbs = c.execute("select value from meta where key = 'verbs'").fetchone()
    if verbs: print(f"\nKata kerja yang sudah dipelajari: {verbs[0]}")


def selftest():
    assert [next_interval(i, True) for i in (1, 3, 7, 14)] == [3, 7, 14, None]
    assert next_interval(14, False) == 1 and next_interval(3, False) == 1
    assert cell("  a\n b ") == "a b" and cell("") == "–"
    print("selftest ok")


if __name__ == "__main__":
    selftest() if sys.argv[1:] == ["--test"] else main(sys.argv[1:])
