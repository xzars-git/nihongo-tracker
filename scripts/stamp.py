"""Cache-busting without a build step: rewrite every ?v=... on local assets in the HTML pages to a hash of the file's content.

  python -I scripts/stamp.py           rewrite the pages in place
  python -I scripts/stamp.py --check   exit 1 if any page is out of date (used by CI)
Runs automatically from the pre-commit hook (.githooks/pre-commit).
"""
import hashlib, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = ("index.html", "about.html", "metode.html")
REF = re.compile(r'((?:src|href)=")(assets/[^"?]+)\?v=[0-9a-zA-Z]+(")')


def digest(rel):
    data = open(os.path.join(ROOT, rel), "rb").read().replace(b"\r\n", b"\n")  # same hash on Windows (CRLF) and Linux (LF)
    return hashlib.sha1(data).hexdigest()[:8]


def stamp(html):
    # a missing file is left alone here; check.py reports it
    return REF.sub(lambda m: f"{m[1]}{m[2]}?v={digest(m[2])}{m[3]}" if os.path.exists(os.path.join(ROOT, m[2])) else m[0], html)


if __name__ == "__main__":
    stale = []
    for page in PAGES:
        path = os.path.join(ROOT, page)
        old = open(path, encoding="utf-8", newline="").read()
        new = stamp(old)
        if new != old:
            stale.append(page)
            if "--check" not in sys.argv: open(path, "w", encoding="utf-8", newline="").write(new)
    if "--check" in sys.argv:
        if stale: sys.exit("versi aset usang di: " + ", ".join(stale) + " (jalankan: python -I scripts/stamp.py)")
        print("stamp ok")
    else:
        print("di-stamp: " + (", ".join(stale) or "tidak ada perubahan"))
