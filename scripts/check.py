"""Static checks for the site. Exit code 1 on any problem. Run by CI and by the pre-commit hook.

  python -I scripts/check.py

Checks: JSON files parse, quote bank schema, local links in the pages exist, asset versions are stamped,
every translation key exists in all three languages, and every key used in code/HTML is defined.
"""
import glob, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = ("index.html", "about.html", "metode.html")
TAGS = {"jp", "lang", "mind", "habit", "dev"}
problems = []


def read(rel): return open(os.path.join(ROOT, rel), encoding="utf-8").read()
def bad(msg): problems.append(msg)


# 1) JSON
data = {}
for f in sorted(glob.glob(os.path.join(ROOT, "data", "*.json"))) + [os.path.join(ROOT, "manifest.webmanifest"), os.path.join(ROOT, "vercel.json")]:
    try: data[os.path.basename(f)] = json.load(open(f, encoding="utf-8"))
    except Exception as e: bad(f"{os.path.relpath(f, ROOT)}: bukan JSON valid ({e})")

# 2) quote bank
quotes = data.get("quotes.json", [])
seen = set()
for i, q in enumerate(quotes):
    where = f"quotes.json #{i + 1}"
    if not (q.get("q") and q.get("by")): bad(f"{where}: q/by kosong")
    if q.get("tag") not in TAGS: bad(f"{where}: tag '{q.get('tag')}' tidak dikenal")
    if q.get("tag") == "jp" and not (q.get("tr", {}).get("id") and q.get("tr", {}).get("en")): bad(f"{where}: peribahasa tanpa arti id+en")
    if q.get("q") in seen: bad(f"{where}: duplikat")
    seen.add(q.get("q"))

# 3) local links in the pages
for page in PAGES:
    html = read(page)
    for ref in re.findall(r'(?:src|href)="([^"#]+)"', html):
        if re.match(r"(https?:|data:|mailto:)", ref): continue
        if not os.path.exists(os.path.join(ROOT, ref.split("?")[0])): bad(f"{page}: file tidak ada: {ref}")

# 4) stamped asset versions
r = subprocess.run([sys.executable, "-I", os.path.join(ROOT, "scripts", "stamp.py"), "--check"], capture_output=True, text=True)
if r.returncode: bad((r.stderr or r.stdout).strip())

# 5) translations: same keys in id / en / ja, and every used key is defined
src = read("assets/js/i18n.js")
blocks = {m[1]: m[2] for m in re.finditer(r"^    (id|en|ja): \{\n(.*?)^    \},", src, re.S | re.M)}
keys = {lg: set(re.findall(r'"([\w.]+)":', body)) for lg, body in blocks.items()}
if set(keys) != {"id", "en", "ja"}: bad("i18n.js: blok id/en/ja tidak ketemu")
else:
    for lg in ("en", "ja"):
        for k in sorted(keys["id"] - keys[lg]): bad(f"i18n.js: kunci '{k}' ada di id tapi tidak di {lg}")
        for k in sorted(keys[lg] - keys["id"]): bad(f"i18n.js: kunci '{k}' ada di {lg} tapi tidak di id")
    used = set()
    for f in [*PAGES, *[os.path.relpath(p, ROOT) for p in glob.glob(os.path.join(ROOT, "assets", "js", "*.js"))]]:
        if f.endswith("i18n.js"): continue
        used |= set(re.findall(r'\bt\("([\w.]+)"', read(f))) | set(re.findall(r'data-i="([\w.]+)"', read(f)))
    for k in sorted(used - keys["id"]):
        # t("badge." + name) builds the key at runtime: only require that the prefix exists
        if k.endswith(".") and any(x.startswith(k) for x in keys["id"]): continue
        bad(f"kunci terjemahan dipakai tapi tidak didefinisikan: '{k}'")

if problems:
    print("\n".join("x " + p for p in problems)); sys.exit(1)
print(f"check ok: {len(quotes)} quote, {len(keys.get('id', ()))} kunci terjemahan x3 bahasa, {len(PAGES)} halaman")
