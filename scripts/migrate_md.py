"""One-time import: catatan/progres.md + catatan/english.md + the Anki/study parts of data/data.json -> PostgreSQL.
Empties the tables first, so it refuses to run on a filled database unless --force is given. Run:  python -I scripts/migrate_md.py
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import db
from publish import table

ROOT = os.path.dirname(HERE)
NOTES = os.path.join(ROOT, "..", "catatan", "arsip")  # the markdown files were archived after the migration
read = lambda p: open(p, encoding="utf-8").read()
date = lambda s: s if re.fullmatch(r"\d{4}-\d\d-\d\d", s) else None


def main():
    md, en = read(os.path.join(NOTES, "progres.md")), read(os.path.join(NOTES, "english.md"))
    old = json.load(open(os.path.join(ROOT, "data", "data.json"), encoding="utf-8"))
    with db.connect() as c:
        if c.execute("select count(*) from sessions").fetchone()[0] and "--force" not in sys.argv:
            sys.exit("Database sudah berisi data. Import ulang menghapus semuanya (termasuk catatan baru). Pakai --force kalau memang itu maunya.")
        c.execute("truncate sessions, mistakes, mastered, meta, en_levels, en_practice, en_mistakes, en_words, anki_days, anki_state, study_days restart identity")
        for d, mode, score, note in table(md, "Riwayat sesi", 4):
            c.execute("insert into sessions (day, mode, score, note) values (%s,%s,%s,%s)", (d, mode, score, note))
        for item, right, wrong, ivl, due in table(md, "Bank kesalahan", 5):
            c.execute("insert into mistakes (item, correct, wrong, interval, due) values (%s,%s,%s,%s,%s)", (item, right, wrong, int(ivl) if ivl.isdigit() else 1, date(due)))
        for item, d in re.findall(r"^- (.+?) \((\d{4}-\d\d-\d\d)\)\s*$", md.split("## Sudah dikuasai", 1)[1].split("\n## ", 1)[0], re.M):
            c.execute("insert into mastered (item, day) values (%s,%s)", (item, d))
        bab = re.search(r"Bab sekarang:\s*(\d+)", md)
        verbs = md.split("## Kata kerja yang sudah dipelajari (paket)", 1)[1].split("\n## ", 1)[0].strip()
        c.execute("insert into meta values ('bab', %s), ('verbs', %s)", (bab[1], verbs))
        for t, cols in (("en_levels", ("day", "skill", "level", "source")), ("en_practice", ("day", "skill", "task", "band", "note")),
                        ("en_mistakes", ("day", "cat", "wrong", "correct")), ("en_words", ("day", "word", "meaning", "example"))):
            heading = {"en_levels": "Levels", "en_practice": "Practice", "en_mistakes": "Mistakes", "en_words": "Words"}[t]
            for row in table(en, heading, len(cols)):
                c.execute(f"insert into {t} ({', '.join(cols)}) values ({', '.join(['%s'] * len(cols))})", row)
        for d, x in old["anki"]["days"].items():
            c.execute("insert into anki_days values (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                      (d, x["reviews"], x["again"], x["hard"], x["kaishiNew"], x["rtkNew"], x["new"], x.get("ankiMin", 0), x.get("dueLeft")))
        a = old["anki"]
        c.execute("insert into anki_state values (1,%s,%s,%s,%s,%s,%s,%s)",
                  (a["today"], a["dueNow"], a["kaishiOpened"], a["kaishiMature"], a["kanjiKnown"], a["kanjiSeen"], a["kanjiList"]))
        for d, m in old["study"]["days"].items():
            c.execute("insert into study_days values (%s,%s)", (d, m))
    print("import klaar")


if __name__ == "__main__":
    main()
