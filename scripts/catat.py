"""Catat progres ke catatan/progres.md dengan satu perintah (dipakai sesi belajar / tutor).

  python -I tracker/scripts/catat.py sesi "<mode>" "<skor>" ["catatan"] [--menit N]
      --menit N: OPSIONAL, hanya untuk belajar di luar chat (kertas, buku). Waktu di chat dihitung otomatis dari timestamp chat belajar
      mode berisi "tebak kanji" → kanji · "kaiwa"/"shadowing" → kaiwa · "kaishi" → kosakata · lainnya → Minna
      skor: "8/10", "6 giliran", atau "–"
  python -I tracker/scripts/catat.py salah "<item>" "<jawaban benar>" "<kesalahan>"   (masuk bank, ulang besok)
  python -I tracker/scripts/catat.py review "<item>" benar|salah                    (1 → 3 → 7 → 14 → dikuasai)
  python -I tracker/scripts/catat.py bab <N>
  python -I tracker/scripts/catat.py kirim                                  (update web sekarang; tanpa ini sync 00:00, 12:00, 18:00, 21:00)
"""
import datetime as dt, os, re, subprocess, sys

sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
PROGRES = os.path.join(HERE, "..", "..", "catatan", "progres.md")
STEPS = [1, 3, 7, 14]
TODAY = (dt.datetime.now() - dt.timedelta(hours=4)).date()  # same 4am day boundary as Anki


def cell(x):
    return " ".join(str(x).split()).replace("|", "/") or "–"


def section(md, heading):
    """(start, end) of the body of '## heading'."""
    i = md.index(f"## {heading}")
    j = md.find("\n## ", i + 3)
    return i, (len(md) if j < 0 else j)


def add_row(md, heading, cells):
    i, j = section(md, heading)
    body = md[i:j].rstrip("\n")
    return md[:i] + body + "\n| " + " | ".join(map(cell, cells)) + " |\n" + md[j:]


def rows(md, heading):
    i, j = section(md, heading)
    return [(m.start() + i, m.end() + i, [c.strip() for c in m[1].split("|")])
            for m in re.finditer(r"^\|(.*)\|[ \t]*$", md[i:j], re.M)][2:]


def find(md, item):
    hits = [r for r in rows(md, "Bank kesalahan") if r[2][0] == item]
    if not hits:
        sys.exit(f"item '{item}' tidak ada di Bank kesalahan. Item yang ada:\n- " + "\n- ".join(r[2][0] for r in rows(md, "Bank kesalahan")))
    return hits[0]


def main(a):
    menit = None
    if "--menit" in a:  # optional session length, stored in the score cell as "· N mnt"
        i = a.index("--menit"); menit = a[i + 1]; a = a[:i] + a[i + 2:]
        if not menit.isdigit(): sys.exit("--menit harus angka, misalnya --menit 20")
    md = open(PROGRES, encoding="utf-8").read()
    cmd = a[0] if a else ""
    if cmd == "sesi" and len(a) >= 3:
        skor = f"{a[2]} · {menit} mnt" if menit else a[2]
        md = add_row(md, "Riwayat sesi", [TODAY, a[1], skor, a[3] if len(a) > 3 else ""])
        msg = f"sesi dicatat: {a[1]} · {skor}"
    elif cmd == "salah" and len(a) == 4:
        due = TODAY + dt.timedelta(days=1)
        existing = [r for r in rows(md, "Bank kesalahan") if r[2][0] == a[1]]
        if existing:  # same item again: back to interval 1
            s, e, c = existing[0]
            md = md[:s] + "| " + " | ".join(map(cell, [a[1], a[2], f"{c[2]}; {TODAY:%m-%d}: {a[3]}", 1, due])) + " |" + md[e:]
        else:
            md = add_row(md, "Bank kesalahan", [a[1], a[2], a[3], 1, due])
        msg = f"bank kesalahan: {a[1]} → ulang {due}"
    elif cmd == "review" and len(a) == 3 and a[2] in ("benar", "salah"):
        s, e, c = find(md, a[1])
        ivl = int(c[3]) if c[3].isdigit() else 1
        if a[2] == "salah":
            ivl = 1
        elif ivl >= STEPS[-1]:  # interval 14 answered right → mastered
            md = md[:s] + md[e + 1:]
            i, j = section(md, "Sudah dikuasai")
            body = md[i:j].replace("(kosong)", "").rstrip("\n")
            md = md[:i] + body + f"\n- {cell(a[1])} ({TODAY})\n" + md[j:]
            open(PROGRES, "w", encoding="utf-8").write(md)
            return print(f"dikuasai: {a[1]} 🎉")
        else:
            ivl = next(x for x in STEPS if x > ivl)
        due = TODAY + dt.timedelta(days=ivl)
        md = md[:s] + "| " + " | ".join(map(cell, [c[0], c[1], c[2], ivl, due])) + " |" + md[e:]
        msg = f"review {a[2]}: {a[1]} → interval {ivl} hari, ulang {due}"
    elif cmd == "bab" and len(a) == 2 and a[1].isdigit():
        md, n = re.subn(r"(Bab sekarang:\s*)\d+", rf"\g<1>{a[1]}", md, count=1)
        if not n: sys.exit("baris 'Bab sekarang: N' tidak ketemu di progres.md")
        msg = f"bab sekarang: {a[1]}"
    elif cmd == "kirim":
        return subprocess.run([sys.executable, "-I", os.path.join(HERE, "publish.py")])
    else:
        sys.exit(__doc__)
    open(PROGRES, "w", encoding="utf-8").write(md)
    print(msg)


def selftest():
    md = ("## Riwayat sesi\n\n| T | M | S | C |\n|---|---|---|---|\n| 2026-01-01 | x | 1/2 | y |\n\n"
          "## Bank kesalahan\n\n| Item | Benar | Kesalahan | Interval (hari) | Jatuh tempo |\n|---|---|---|---|---|\n| 見ます | mite | mitte | 7 | 2026-01-01 |\n\n## Sudah dikuasai\n\n(kosong)\n")
    md = add_row(md, "Riwayat sesi", ["2026-01-02", "tebak kanji | ronde", "8/10", ""])
    assert "| 2026-01-02 | tebak kanji / ronde | 8/10 | – |\n\n## Bank" in md, md
    assert [r[2][0] for r in rows(md, "Bank kesalahan")] == ["見ます"]
    print("selftest ok")


if __name__ == "__main__":
    selftest() if sys.argv[1:] == ["--test"] else main(sys.argv[1:])
