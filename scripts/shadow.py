"""Collect a YouTube script for the Shadowing page. Runs on this PC. PostgreSQL is the source of truth; data/shadow/*.json is an export.

  python -X utf8 -I scripts/shadow.py <youtube link or id> [--lang ja|en]   collect (default ja) or reuse the saved script, then export
  python -X utf8 -I scripts/shadow.py <link or id> --refresh   collect again even if it is already saved
  python -X utf8 -I scripts/shadow.py export                   rewrite data/shadow/*.json from the database (new PC, restore)

Order: manual captions in the chosen language, then auto captions (marked "auto"). Whisper on the GPU (marked "whisper") runs only
when you add --whisper; without it a video with no captions exits with code 3 and the line NEEDS_WHISPER (the tray app asks you first).
  python -X utf8 -I scripts/shadow.py translate <id> <file.json>   store Indonesian meanings (a JSON list, one text per line)
Whisper needs extra packages (several GB), see whisper_lines(). A script that is already in the database is never fetched
or transcribed again, so Whisper runs once per video. data/shadow/ is gitignored: the scripts belong to other people.
The public site gets an ENCRYPTED copy in data/shadow-enc/ (AES-256-GCM, key from PBKDF2 over a passphrase that lives only in
%LOCALAPPDATA%/NihongoSync/shadow.key, never in the repo). Only someone with the passphrase can read the scripts on the web.
"""
import base64, hashlib, hmac, json, os, re, secrets, sys, tempfile, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)  # -I drops the script folder from sys.path
import db

OUT = os.path.join(HERE, "..", "data", "shadow")
MODELS = {"ja": "kotoba-tech/kotoba-whisper-v2.0-faster", "en": "distil-large-v3"}  # Whisper models, CTranslate2 format


def video_id(s):
    m = re.search(r"(?:v=|youtu\.be/|shorts/|embed/)([\w-]{11})", s) or re.fullmatch(r"([\w-]{11})", s.strip())
    if not m: sys.exit("No video id found in: " + s)
    return m.group(1)


def title_of(vid):
    url = "https://www.youtube.com/oembed?format=json&url=" + urllib.parse.quote(f"https://www.youtube.com/watch?v={vid}")
    try:
        d = json.load(urllib.request.urlopen(url, timeout=15))
        return d.get("title", vid), d.get("author_name", "")
    except Exception:
        return vid, ""


def caption_lines(vid, lang):
    """(kind, lines) from YouTube's captions in this language, or None when there are none."""
    from youtube_transcript_api import YouTubeTranscriptApi
    found = [t for t in YouTubeTranscriptApi().list(vid) if t.language_code.startswith(lang)]
    if not found: return None
    tr = next((t for t in found if not t.is_generated), found[0])
    lines = [(x.start, x.start + x.duration, " ".join(x.text.split())) for x in tr.fetch() if x.text.strip()]
    return ("auto" if tr.is_generated else "manual"), lines


def whisper_lines(vid, lang):
    """(kind, lines) from Whisper on the GPU. Needs: pip install yt-dlp faster-whisper nvidia-cublas-cu12 nvidia-cudnn-cu12
    (about 3 GB in total, plus the model, about 1.5 GB, downloaded on first use). Not installed by default."""
    try:
        import yt_dlp
        from faster_whisper import WhisperModel
    except ImportError:
        sys.exit(f"No {lang} captions, and Whisper is not installed.\n"
                 "Install once (several GB, ask first): python -m pip install yt-dlp faster-whisper nvidia-cublas-cu12 nvidia-cudnn-cu12")
    for pkg in ("nvidia.cublas", "nvidia.cudnn"):  # faster-whisper on Windows finds the CUDA DLLs only through PATH
        try:
            d = os.path.join(list(__import__(pkg, fromlist=["x"]).__path__)[0], "bin")
            os.add_dll_directory(d); os.environ["PATH"] = d + os.pathsep + os.environ["PATH"]  # ctranslate2 loads with plain LoadLibrary
        except (ImportError, OSError): pass
    with tempfile.TemporaryDirectory() as tmp:
        with yt_dlp.YoutubeDL({"format": "bestaudio", "outtmpl": os.path.join(tmp, "a.%(ext)s"), "quiet": True}) as y:
            y.download([f"https://www.youtube.com/watch?v={vid}"])
        audio = os.path.join(tmp, os.listdir(tmp)[0])
        segs, _ = WhisperModel(MODELS[lang], device="cuda", compute_type="float16").transcribe(
            audio, language=lang, beam_size=5, vad_filter=True, condition_on_previous_text=False)
        lines = [(s.start, s.end, " ".join(s.text.split())) for s in segs if s.text.strip()]
    return "whisper", lines


_ROM = None
FIX = ((r"\bwo\b", "o"), (r"\bkonnichiha\b", "konnichiwa"), (r"\bkonbanha\b", "konbanwa"), (r"\bwatakushi\b", "watashi"))


def romaji(text):
    """Hepburn romaji with word spaces and particle readings (wa, o), from cutlet + the UniDic dictionary. Automatic: rare words can be wrong."""
    global _ROM
    if _ROM is None:
        try: import cutlet
        except ImportError: sys.exit("Romaji needs: python -m pip install cutlet fugashi unidic-lite")
        _ROM = cutlet.Cutlet(); _ROM.use_foreign_spelling = False  # keep the sound (poddokyasuto), not the English word
    r = _ROM.romaji(text, capitalize=False)
    for bad, good in FIX:  # the dictionary reads a few common words in the typing style, not the spoken one
        r = re.sub(bad, good, r)
    return r


def save(c, vid, title, author, lang, kind, lines):
    c.execute("insert into shadow_videos (id, title, author, lang, kind) values (%s,%s,%s,%s,%s) "
              "on conflict (id) do update set title=excluded.title, author=excluded.author, lang=excluded.lang, kind=excluded.kind", (vid, title, author, lang, kind))
    c.execute("delete from shadow_lines where video = %s", (vid,))
    c.cursor().executemany("insert into shadow_lines (video, n, s, e, t, r) values (%s,%s,%s,%s,%s,%s)",
                           [(vid, n, round(s, 2), round(e, 2), t, romaji(t) if lang == "ja" else "") for n, (s, e, t) in enumerate(lines)])


KEYFILE = os.path.join(os.environ.get("LOCALAPPDATA", ""), "NihongoSync", "shadow.key")
WEB = os.path.join(HERE, "..", "data", "shadow-enc")
ITER = 600000  # PBKDF2-SHA256 rounds; the page repeats this with the browser's Web Crypto


def web_key():
    """(passphrase, 32-byte key). The passphrase is made once and kept in KEYFILE; the public salt is in data/shadow-enc/meta.json."""
    os.makedirs(os.path.dirname(KEYFILE), exist_ok=True); os.makedirs(WEB, exist_ok=True)
    if not os.path.exists(KEYFILE): open(KEYFILE, "w", encoding="ascii").write(secrets.token_urlsafe(15))
    pw = open(KEYFILE, encoding="ascii").read().strip()
    mp = os.path.join(WEB, "meta.json")
    if os.path.exists(mp): salt = base64.b64decode(json.load(open(mp, encoding="utf-8"))["salt"])
    else:
        salt = secrets.token_bytes(16)
        json.dump({"v": 1, "kdf": "PBKDF2-SHA256", "iter": ITER, "salt": base64.b64encode(salt).decode()}, open(mp, "w", encoding="utf-8"), indent=1)
    return pw, hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, ITER, 32)


def seal(key, obj):
    """AES-GCM. The IV is derived from the content, so unchanged data gives an identical file (no git noise) and an IV is never reused for different data."""
    try: from Crypto.Cipher import AES
    except ImportError: sys.exit("Encryption needs: python -m pip install pycryptodome")
    data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
    iv = hmac.new(key, b"iv:" + data, "sha256").digest()[:12]
    ct, tag = AES.new(key, AES.MODE_GCM, nonce=iv).encrypt_and_digest(data)
    return {"iv": base64.b64encode(iv).decode(), "ct": base64.b64encode(ct + tag).decode()}


def put(name, obj):
    text, path = json.dumps(obj, indent=1), os.path.join(WEB, name)
    if not os.path.exists(path) or open(path, encoding="utf-8").read() != text:
        open(path, "w", encoding="utf-8", newline="\n").write(text)


def export_web(videos, index):
    """Encrypted files for the public site. File names come from an HMAC of the video id, so they do not reveal which videos you practice."""
    pw, key = web_key()
    keep, web_index = {"meta.json", "index.json"}, []
    for obj, entry in zip(videos, index):
        name = hmac.new(pw.encode(), b"name:" + obj["id"].encode(), "sha256").hexdigest()[:20]
        put(name + ".json", seal(key, obj)); keep.add(name + ".json")
        web_index.append({**entry, "file": name})
    put("index.json", seal(key, web_index))
    for f in os.listdir(WEB):
        if f not in keep: os.remove(os.path.join(WEB, f))


def export(c):
    """Write data/shadow/<id>.json for every saved video, plus index.json (newest first)."""
    os.makedirs(OUT, exist_ok=True)
    for vid, n, t in c.execute("select l.video, l.n, l.t from shadow_lines l join shadow_videos v on v.id = l.video where v.lang = 'ja' and l.r = ''").fetchall():
        c.execute("update shadow_lines set r = %s where video = %s and n = %s", (romaji(t), vid, n))  # fills older videos
    index, videos = [], []
    for vid, title, author, lang, kind, added in c.execute("select id, title, author, lang, kind, added::date from shadow_videos order by shadow_videos.added desc").fetchall():
        lines = [{"s": s, "e": e, "t": t, **({"r": r} if r else {}), **({"tr": m} if m else {})} for s, e, t, r, m in c.execute("select s, e, t, r, tr from shadow_lines where video = %s order by n", (vid,))]
        obj = {"id": vid, "title": title, "author": author, "lang": lang, "kind": kind, "lines": lines}
        videos.append(obj)
        json.dump(obj, open(os.path.join(OUT, vid + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        index.append({"id": vid, "title": title, "author": author, "lang": lang, "kind": kind, "n": len(lines), "added": str(added)})
    json.dump(index, open(os.path.join(OUT, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    export_web(videos, index)
    return len(index)


def need_whisper(lang):
    print(f"NEEDS_WHISPER: no {lang} captions. Run again with --whisper to use the GPU.")
    sys.exit(3)


def translate(vid, path):
    """Store one Indonesian meaning per line (a JSON list in line order)."""
    texts = json.load(open(path, encoding="utf-8"))
    with db.connect() as c:
        n = c.execute("select count(*) from shadow_lines where video = %s", (vid,)).fetchone()[0]
        if not n: sys.exit(f"video {vid} is not in the database")
        if len(texts) != n: sys.exit(f"{len(texts)} texts for {n} lines: the counts must match")
        c.cursor().executemany("update shadow_lines set tr = %s where video = %s and n = %s", [(t, vid, i) for i, t in enumerate(texts)])
        print(f"saved {n} meanings for {vid}, exported {export(c)} video(s) to data/shadow/")


def main(a):
    refresh = "--refresh" in a; whisper = "--whisper" in a; a = [x for x in a if x not in ("--refresh", "--whisper")]
    lang = "ja"
    if "--lang" in a:
        i = a.index("--lang"); lang = a[i + 1] if i + 1 < len(a) else ""; a = a[:i] + a[i + 2:]
        if lang not in MODELS: sys.exit("--lang must be ja or en")
    if len(a) == 3 and a[0] == "translate": return translate(a[1], a[2])
    if len(a) != 1: sys.exit(__doc__)
    with db.connect() as c:
        if a[0] != "export":
            vid = video_id(a[0])
            row = c.execute("select kind, (select count(*) from shadow_lines where video = id) from shadow_videos where id = %s", (vid,)).fetchone()
            if row and not refresh:
                print(f"already saved ({row[0]}, {row[1]} lines): no download, no GPU")
            else:
                got = caption_lines(vid, lang) or (whisper_lines(vid, lang) if whisper else need_whisper(lang))
                title, author = title_of(vid)
                save(c, vid, title, author, lang, *got)
                print(f"saved ({lang}) from {got[0]}, {len(got[1])} lines: {title}")
        print(f"exported {export(c)} video(s) to data/shadow/")


if __name__ == "__main__":
    main(sys.argv[1:])
