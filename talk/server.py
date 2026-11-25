"""Talk: a local-only Japanese conversation tutor (prototype).

  python -X utf8 -I server.py --open     starts the server and opens http://127.0.0.1:8770 (start-talk.cmd does this)

Pipeline per turn: browser records while you hold the button -> /api/stt (Whisper on the GPU) -> /api/chat (local LLM through Ollama)
-> the browser reads the reply aloud. Nothing leaves this PC. The server listens on 127.0.0.1 only and rejects other Host/Origin values.
At the end, /api/report writes a report; /api/send puts the session and the mistakes you approved into the tracker through its own catat.py."""
import atexit, glob, io, json, os, re, socket, subprocess, sys, threading, time, urllib.error, urllib.parse, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)  # -I drops the script folder from sys.path
import context

PORT = 8770
OLLAMA = "http://127.0.0.1:11434"
MODEL = os.environ.get("TALK_MODEL", "qwen3.5:9b")  # beat qwen2.5:7b on Japanese suggestions, corrections and meanings (2026-11-24 test)
STT_MODEL = "kotoba-tech/kotoba-whisper-v2.0-faster"
UI = os.path.join(HERE, "ui")
REPORTS = os.path.join(HERE, "reports")
CATAT = os.path.join(context.TRACKER, "scripts", "catat.py")
TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8"}
MAX_AUDIO, MAX_JSON = 20_000_000, 1_000_000
# Local Japanese voice engines, preferred first. Both speak the same HTTP API, run on the CPU and listen on 127.0.0.1 only.
# AivisSpeech sounds more human; VOICEVOX is the fallback (credit for its voice: "VOICEVOX:春日部つむぎ").
ENGINES = [{"name": "AivisSpeech", "dir": "aivis", "port": 10101, "speaker": None},
           {"name": "VOICEVOX", "dir": "voicevox", "port": 50021, "speaker": 8}]
_voice = {"engine": None, "proc": None, "speaker": None, "label": ""}

STT_OTHER = "small"  # multilingual Whisper (about 0.5 GB of VRAM): finds the language and writes Indonesian or English
_stt, _small, _stt_lock, _gpu_lock = None, None, threading.Lock(), threading.Lock()


def stt_model(small=False):
    """Whisper is loaded on first use (about 1.5 GB of VRAM) and then stays loaded."""
    global _stt, _small
    with _stt_lock:
        if _stt is None:
            for pkg in ("nvidia.cublas", "nvidia.cudnn"):  # the CUDA DLLs come from pip packages; ctranslate2 finds them through PATH
                try:
                    d = os.path.join(list(__import__(pkg, fromlist=["x"]).__path__)[0], "bin")
                    os.add_dll_directory(d); os.environ["PATH"] = d + os.pathsep + os.environ["PATH"]
                except (ImportError, OSError): pass
            from faster_whisper import WhisperModel
            _stt = WhisperModel(STT_MODEL, device="cuda", compute_type="float16")
            _small = WhisperModel(STT_OTHER, device="cuda", compute_type="float16")
        return _small if small else _stt


def transcribe(data, lang=None):
    """(text, language). The learner may speak Japanese, Indonesian or English; only these three are considered unless lang is given."""
    from faster_whisper import decode_audio
    with _gpu_lock:
        audio = decode_audio(io.BytesIO(data))
        if not lang:  # a learner's Japanese can sound "foreign" to the detector, so Indonesian/English must be a clear win
            probs = dict(stt_model(small=True).detect_language(audio, vad_filter=True)[2])
            p = {"id": probs.get("id", 0) + probs.get("ms", 0), "en": probs.get("en", 0)}  # Malay and Indonesian sound alike
            other = max(p, key=p.get)
            lang = other if p[other] >= 0.75 and probs.get("ja", 0) < 0.1 else "ja"

        def run(l):
            hint = "漢字" if l == "ja" else None  # nudges 漢字 over 感じ; a longer sentence here made Whisper stop mid-sentence (tested)
            segs, _ = stt_model(small=l != "ja").transcribe(audio, language=l, beam_size=1, vad_filter=True, condition_on_previous_text=False, initial_prompt=hint)
            return "".join(s.text for s in segs).strip()
        text = run(lang)
        if lang != "ja" and repetitive(text): lang, text = "ja", run("ja")  # "It's a good thing. It's a good thing..." = Whisper guessing, not speech
        return text, lang


def repetitive(text):
    """True for Whisper's typical hallucination: the same few words again and again (a 3-word phrase 3+ times)."""
    from collections import Counter
    w = re.findall(r"[\w']+", text.lower())
    return max(Counter(zip(w, w[1:], w[2:])).values(), default=0) >= 3


def ollama(path, body=None, timeout=180):
    if path == "/api/chat": body["think"] = False  # thinking models (qwen3.5, gemma4) would add seconds of hidden reasoning per reply
    req = urllib.request.Request(OLLAMA + path, json.dumps(body).encode() if body is not None else None, {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def chat_json(messages, temp=0.5):
    """One LLM call that must return a JSON object. Falls back to the raw text when the model breaks the format."""
    res = ollama("/api/chat", {"model": MODEL, "messages": messages, "stream": False, "format": "json", "keep_alive": "30m",
                               "options": {"temperature": temp, "num_ctx": 8192}})
    raw = res["message"]["content"]
    try: return json.loads(raw)
    except ValueError: return {"reply": raw, "meaning_id": "", "corrections": [], "new_words": []}


def port_open(port):
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.3): return True
    except OSError: return False


def find_engine():
    """The first installed engine (a run.exe under talk/aivis or talk/voicevox)."""
    for e in ENGINES:
        exes = glob.glob(os.path.join(HERE, e["dir"], "**", "run.exe"), recursive=True)
        if exes: return e, exes[0]
    return None, None


def vv_up():
    e, _ = find_engine()
    _voice["engine"] = e
    return bool(e) and port_open(e["port"])


def tie_to_me(proc):
    """Put a child process in a Windows job that is killed when this server dies, however it dies.
    atexit alone is not enough: closing the console window kills Python without running atexit, and the engine stayed running."""
    if os.name != "nt": return
    import ctypes
    from ctypes import wintypes as w
    class Basic(ctypes.Structure):
        _fields_ = [("a", ctypes.c_int64), ("b", ctypes.c_int64), ("LimitFlags", w.DWORD), ("c", ctypes.c_size_t), ("d", ctypes.c_size_t),
                    ("e", w.DWORD), ("f", ctypes.c_size_t), ("g", w.DWORD), ("h", w.DWORD)]
    class Extended(ctypes.Structure):
        _fields_ = [("Basic", Basic), ("Io", ctypes.c_uint64 * 6), ("i", ctypes.c_size_t), ("j", ctypes.c_size_t), ("k", ctypes.c_size_t), ("l", ctypes.c_size_t)]
    k32 = ctypes.WinDLL("kernel32", use_last_error=True)
    k32.CreateJobObjectW.restype = w.HANDLE
    k32.SetInformationJobObject.argtypes = [w.HANDLE, ctypes.c_int, ctypes.c_void_p, w.DWORD]
    k32.AssignProcessToJobObject.argtypes = [w.HANDLE, w.HANDLE]
    if "job" not in _voice:
        job, info = k32.CreateJobObjectW(None, None), Extended()
        info.Basic.LimitFlags = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        if not job or not k32.SetInformationJobObject(job, 9, ctypes.byref(info), ctypes.sizeof(info)): return  # 9 = extended limits
        _voice["job"] = job  # never closed: the OS closes it when this process ends, and that kills the job
    k32.AssignProcessToJobObject(_voice["job"], int(proc._handle))


def vv_start():
    """Start the preferred voice engine if it is installed and not running yet. It stops with this server."""
    e, exe = find_engine()
    if not e or port_open(e["port"]): return
    _voice["proc"] = subprocess.Popen([exe, "--host", "127.0.0.1", "--port", str(e["port"])], cwd=os.path.dirname(exe),
                                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=0x08000000)
    tie_to_me(_voice["proc"])
    atexit.register(lambda: _voice["proc"] and _voice["proc"].poll() is None and _voice["proc"].kill())


def voice():
    """(base url, speaker id) of the running engine. For AivisSpeech the speaker comes from talk/voice.json {"speaker": name, "style": name} or the first voice."""
    e = _voice["engine"] or find_engine()[0]
    base = f"http://127.0.0.1:{e['port']}"
    if _voice["speaker"] is None:
        speaker, label = e["speaker"], e["name"]
        if speaker is None:
            speakers = json.loads(urllib.request.urlopen(base + "/speakers", timeout=20).read())
            want = {}
            try: want = json.load(open(os.path.join(HERE, "voice.json"), encoding="utf-8"))
            except (OSError, ValueError): pass
            sp = next((x for x in speakers if x["name"] == want.get("speaker")), speakers[0])
            st = next((x for x in sp["styles"] if x["name"] == want.get("style")), sp["styles"][0])
            speaker, label = st["id"], f"{e['name']} · {sp['name']} ({st['name']})"
        _voice["speaker"], _voice["label"] = speaker, label
    return base, _voice["speaker"]


def tts(text):
    """Japanese speech as WAV bytes from the local voice engine."""
    text = clean(text, 300)
    base, speaker = voice()
    q = urllib.request.Request(f"{base}/audio_query?speaker={speaker}&text={urllib.parse.quote(text)}", b"", method="POST")
    query = json.loads(urllib.request.urlopen(q, timeout=60).read())
    query["speedScale"] = 0.95  # slightly slower than normal, for a learner
    q2 = urllib.request.Request(f"{base}/synthesis?speaker={speaker}", json.dumps(query).encode(), {"Content-Type": "application/json"}, method="POST")
    return urllib.request.urlopen(q2, timeout=120).read()


SENTENCE_END = re.compile(r"[。？！?!\n]")


LATIN_FIX = {"computer": "コンピューター", "pc": "パソコン", "ok": "オーケー", "tonight": "今夜", "weekend": "週末", "work": "仕事", "app": "アプリ"}


def no_latin(text):
    """The small model sometimes leaks an English word into the Japanese. Swap the common ones for Japanese and drop the rest, so the voice never spells letters."""
    text = re.sub(r"(?<![A-Za-z])IT(?![A-Za-z])", "アイティー", re.sub(r"(?<![A-Za-z])AI(?![A-Za-z])", "エーアイ", text))  # uppercase only: "it" is English
    text = re.sub(r"[A-Za-z]+", lambda m: LATIN_FIX.get(m.group(0).lower(), ""), text)
    text = re.sub(r"\s{2,}", " ", re.sub(r"[（(「『][\s、,]*[）)」』]", "", text)).strip()  # brackets left empty by a dropped word
    text = re.sub(r"(?<=[^\x00-\x7f])\s+(?=[^\x00-\x7f])", "", text)  # Japanese has no spaces between words
    return text if len(re.findall("[぀-ヿ]", text)) >= 2 else ""  # no kana at all = a Chinese sentence from the model, not Japanese


def stream_reply(messages, emit):
    """Ask the model for the reply as plain text and call emit() with each finished sentence, so speech can start before the reply is complete."""
    spoken = []
    for attempt in range(2):  # the filter can drop a whole reply (e.g. all English): then ask once more, firmly
        if attempt: messages = messages + [{"role": "system", "content": "Your last reply was not in Japanese. Reply again, in simple Japanese only."}]
        body = {"model": MODEL, "messages": messages, "stream": True, "think": False, "keep_alive": "30m", "options": {"temperature": 0.6, "num_ctx": 8192, "num_predict": 140}}
        req = urllib.request.Request(OLLAMA + "/api/chat", json.dumps(body).encode(), {"Content-Type": "application/json"})
        buf = ""
        with urllib.request.urlopen(req, timeout=120) as r:
            for line in r:
                buf += json.loads(line).get("message", {}).get("content", "")
                while True:
                    m = SENTENCE_END.search(buf)
                    if not m: break
                    sent, buf = no_latin(buf[:m.end()]), buf[m.end():]
                    if sent: spoken.append(sent); emit({"t": "sentence", "text": sent})
        last = no_latin(buf)
        if last: spoken.append(last); emit({"t": "sentence", "text": last})
        if spoken: break
    emit({"t": "done", "text": "".join(spoken)})


def meaning(text):
    out = chat_json([{"role": "system", "content": context.meaning_prompt()}, {"role": "user", "content": clean(text, 300)}], temp=0.2)
    return {"meaning_id": clean(out.get("meaning_id", ""), 400),
            "new_words": [{"ja": clean(w.get("ja", ""), 40), "id": clean(w.get("id", ""), 80)} for w in (out.get("new_words") or [])[:2] if isinstance(w, dict) and w.get("ja")]}


def clean(x, n=200):
    """Text that goes into the tracker: one line, no control characters, limited length."""
    return " ".join(re.sub(r"[\x00-\x1f\x7f]", " ", str(x)).split())[:n]


def correct(text):
    """One strict check of the learner's sentence. Returns a list with zero or one correction."""
    out = chat_json([{"role": "system", "content": context.correct_prompt()}, {"role": "user", "content": clean(text, 300)}], temp=0.1)
    if out.get("has_error") and out.get("better") and out.get("said"):
        return [{"said": clean(out["said"]), "better": clean(out["better"]), "why_id": clean(out.get("why_id", ""), 200)}]
    return []


def to_japanese(text):
    """How to say an Indonesian or English sentence in simple Japanese, so the learner can try it next time."""
    ja = ""
    for temp in (0, 0.6):  # a second try when English letters leak into the Japanese
        out = chat_json([{"role": "system", "content": context.to_japanese_prompt()}, {"role": "user", "content": clean(text, 300)}], temp=temp)
        ja = clean(out.get("ja", ""), 200)
        if ja and not re.search("[A-Za-z]", ja) and re.search("[぀-ヿ]", ja): break
    else: ja = ""
    return {"ja": ja, "romaji": romaji(ja) if ja else ""}


def suggest(history):
    """Two example replies (the "script") for the learner's next turn, each with furigana and romaji."""
    talk = "\n".join(("Yuki: " if m.get("role") == "assistant" else "Learner: ") + clean(m.get("text", ""), 300)
                     for m in history[-8:] if m.get("role") in ("user", "assistant") and not m.get("hidden"))
    replies = []
    for temp in (0.4, 0.7):  # ask once more if the model gave fewer than 2 usable replies
        out = chat_json([{"role": "system", "content": context.suggest_prompt(context.load())}, {"role": "user", "content": talk}], temp=temp)
        replies = [{"ja": ja, "id": clean(r.get("id", ""), 200)} for r in (out.get("replies") or [])[:2] if isinstance(r, dict)
                   for ja in [no_latin(clean(r.get("ja", ""), 200))] if ja]  # "IT" becomes アイティー instead of losing the reply
        if len(replies) == 2: break
    return {"replies": [{**r, **reading(r["ja"])} for r in replies]}


DUETS = os.path.join(HERE, "duets")  # saved dialogues (local only, git-ignored)
DUET_ID = re.compile(r"^\d{4}-\d{2}-\d{2}_\d{6}$")


def tokens(text):
    """(surface, hiragana, is_particle) per word, punctuation left out. Used for the hint line and for scoring."""
    global _tagger
    if _tagger is None:
        import fugashi
        _tagger = fugashi.Tagger()
    hira = lambda k: "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in k)
    out = []
    for w in _tagger(text):
        if w.feature.pos1 in ("補助記号", "空白"): continue
        k = {"私": "わたし"}.get(w.surface) or getattr(w.feature, "kana", None) or w.surface
        out.append((w.surface, hira(k), w.feature.pos1 in ("助詞", "助動詞")))
    return out


def duet_hint(text):
    """The shape of the sentence: particles in full, other words as their first kana plus blanks (は＿＿＿＿＿ を ＿＿＿＿)."""
    return " ".join(k if p or len(k) <= 1 else k[0] + "＿" * (len(k) - 1) for _, k, p in tokens(text))


def duet_new(scene):
    """A fresh 8-line dialogue for the learner's chapter, with readings and hints, saved under duets/."""
    ctx, lines, title = context.load(), [], ""
    for temp in (0.5, 0.8):
        out = chat_json([{"role": "system", "content": context.duet_prompt(ctx, scene)}, {"role": "user", "content": "Write the dialogue."}], temp=temp)
        title = clean(out.get("title_id", ""), 80)
        no_cjk = lambda s: re.sub(r"\s{2,}", " ", KANJI.sub(" ", clean(s, 200))).strip()  # the model sometimes leaks Chinese into the Indonesian
        lines = []
        for t in (out.get("turns") or [])[:6]:  # pairs keep the roles fixed: Yuki is always A, the learner always B
            if not isinstance(t, dict): continue
            a, b = no_latin(clean(t.get("yuki", ""), 120)), no_latin(clean(t.get("me", ""), 120))
            if a and b: lines += [{"who": "A", "ja": a, "id": no_cjk(t.get("yuki_id", ""))}, {"who": "B", "ja": b, "id": no_cjk(t.get("me_id", ""))}]
        if len(lines) >= 4: break
    if len(lines) < 4: raise ValueError("model gave no usable dialogue, try again")
    for l in lines: l.update(hint=duet_hint(l["ja"]), **reading(l["ja"]))
    did = time.strftime("%Y-%m-%d_%H%M%S")
    dlg = {"id": did, "title": title or context.DUET_SCENES.get(scene, ("Dialog",))[0], "scene": scene, "lines": lines}
    os.makedirs(DUETS, exist_ok=True)
    json.dump(dlg, open(os.path.join(DUETS, did + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return dlg


def duet_list():
    files = sorted(glob.glob(os.path.join(DUETS, "*.json")), reverse=True)[:50]
    out = []
    for f in files:
        try: d = json.load(open(f, encoding="utf-8")); out.append({"id": d["id"], "title": d["title"], "lines": len(d["lines"])})
        except (OSError, ValueError, KeyError): pass
    return out


def duet_load(did):
    if not DUET_ID.match(str(did)): raise ValueError("bad id")
    return json.load(open(os.path.join(DUETS, did + ".json"), encoding="utf-8"))


def duet_score(target, said):
    """How much of the target line was said, compared by sound (hiragana), and which words were missed. 100 = every sound matched."""
    import difflib
    tw, s = tokens(target), "".join(k for _, k, _ in tokens(said))
    t = "".join(k for _, k, _ in tw)
    if not t: return {"score": 0, "words": []}
    sm = difflib.SequenceMatcher(None, t, s, autojunk=False)
    hit = [False] * len(t)
    for a, _, n in sm.get_matching_blocks():
        for i in range(a, a + n): hit[i] = True
    words, pos = [], 0
    for surf, k, _ in tw:
        got = sum(hit[pos:pos + len(k)]); pos += len(k)
        words.append({"w": surf, "ok": got >= max(1, round(len(k) * 0.6))})
    return {"score": round(sm.ratio() * 100), "words": words}


def duet_send(body):
    """The duet practice into the tracker as one session, through catat.py."""
    minutes, n, avg = int(body.get("minutes", 0)), int(body.get("lines", 0)), int(body.get("avg", 0))
    if minutes < 1 or n < 1: return {"ok": False, "error": "minutes and lines must be at least 1"}
    r = subprocess.run([sys.executable, "-X", "utf8", "-I", CATAT, "sesi", "shadowing duet (Talk)", f"{avg}% · {n} baris",
                        clean(body.get("note", "-"), 160) or "-", "--menit", str(minutes)], capture_output=True, text=True, encoding="utf-8", timeout=60)
    return {"ok": True, "done": [(r.stdout or "").strip()]} if not r.returncode else {"ok": False, "error": (r.stdout + r.stderr).strip()[-300:]}


def romaji(text):
    """Full-sentence Hepburn romaji from the Shadowing tool (cutlet), more reliable than the LLM's."""
    sys.path.insert(0, os.path.join(context.TRACKER, "scripts"))
    import shadow
    return re.sub(r"\b([Nn])ippon\b", r"\1ihon", shadow.romaji(text))  # 日本 is usually said にほん


KANJI = re.compile(r"[一-鿿々]")
_tagger = None


def reading(text):
    """Furigana as [surface, hiragana-or-""] pieces (only over the kanji part of a word, not its okurigana) plus full romaji."""
    global _tagger
    if _tagger is None:
        import fugashi
        _tagger = fugashi.Tagger()  # UniDic (unidic-lite), same dictionary cutlet uses
    text = clean(text, 600)
    hira = lambda k: "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in k)
    segs = []
    for w in _tagger(text):
        s, k = w.surface, getattr(w.feature, "kana", None)
        if w.white_space: segs.append([w.white_space, ""])
        if not k or not KANJI.search(s): segs.append([s, ""]); continue
        r, pre, suf = {"私": "わたし"}.get(s, hira(k)), 0, 0  # UniDic reads 私 as the formal わたくし
        while pre < min(len(s), len(r)) and s[pre] == r[pre]: pre += 1
        while suf < min(len(s), len(r)) - pre and s[-1 - suf] == r[-1 - suf]: suf += 1
        if pre: segs.append([s[:pre], ""])
        segs.append([s[pre:len(s) - suf], r[pre:len(r) - suf]])
        if suf: segs.append([s[len(s) - suf:], ""])
    return {"ruby": segs, "romaji": romaji(text) if text else ""}


if __name__ == "__main__" and "--selftest" in sys.argv:
    r = reading("昨日、食べました。漢字は難しいですね。")
    assert ["食", "た"] in r["ruby"] and ["べ", ""] in r["ruby"] and ["漢字", "かんじ"] in r["ruby"] and ["難", "むずか"] in r["ruby"], r
    assert r["romaji"].startswith("kinou"), r["romaji"]
    print("reading ok:", r["romaji"]); sys.exit()


def status():
    up = vv_up()
    out = {"ollama": False, "model": False, "tts": up, "voice": "", "context": context.load(),
           "llm": MODEL, "stt": f"{STT_MODEL.split('/')[-1].replace('-faster', '')} (Jepang) + whisper-{STT_OTHER} (Indonesia/Inggris)"}
    if up:
        try: voice(); out["voice"] = _voice["label"]
        except Exception: out["voice"] = _voice["engine"]["name"] if _voice["engine"] else ""
    try:
        tags = ollama("/api/tags", timeout=3)
        out["ollama"] = True
        m = next((m for m in tags.get("models", []) if m["name"] == MODEL), None)
        out["model"] = bool(m)
        if m:  # e.g. "qwen3.5:9b · 9.7B · Q4_K_M · 6.6 GB"
            d = m.get("details", {})
            out["llm"] = " · ".join(x for x in (MODEL, d.get("parameter_size", ""), d.get("quantization_level", ""), f"{m.get('size', 0) / 1e9:.1f} GB") if x)
    except Exception: pass
    return out


def report(turns, seconds):
    mistakes, seen = [], set()
    for t in turns:
        for c in t.get("corrections") or []:
            better = clean(c.get("better", ""))
            if better and better not in seen:
                seen.add(better)
                mistakes.append({"item": better, "correct": better, "wrong": clean(c.get("said", "")), "why": clean(c.get("why_id", ""))})
    words = {}
    for t in turns:
        for w in t.get("new_words") or []:
            if w.get("ja"): words[clean(w["ja"], 40)] = clean(w.get("id", ""), 80)
    lines = [f"{'Murid' if t['role'] == 'user' else 'Tutor'}: {clean(t['text'], 300)}" for t in turns]
    try: review = chat_json([{"role": "system", "content": context.report_prompt()}, {"role": "user", "content": "\n".join(lines)[:12000]}])
    except Exception as e: review = {"summary_id": f"(ringkasan otomatis gagal: {e})"}
    user_turns = sum(1 for t in turns if t["role"] == "user")
    rep = {"when": time.strftime("%Y-%m-%d %H:%M"), "minutes": max(1, round(seconds / 60)), "turns": user_turns,
           "mistakes": mistakes[:20], "words": [{"ja": k, "id": v} for k, v in list(words.items())[:20]], "review": review,
           "transcript": lines}
    os.makedirs(REPORTS, exist_ok=True)
    json.dump(rep, open(os.path.join(REPORTS, time.strftime("%Y-%m-%d_%H%M%S") + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return rep


def send(body):
    """Into the tracker, through its own catat.py (no SQL here). Only what the learner ticked is sent."""
    run = lambda *a: subprocess.run([sys.executable, "-X", "utf8", "-I", CATAT, *a], capture_output=True, text=True, encoding="utf-8", timeout=60)
    minutes, turns = int(body.get("minutes", 0)), int(body.get("turns", 0))
    if minutes < 1 or turns < 1: return {"ok": False, "error": "minutes and turns must be at least 1"}
    done = []
    r = run("sesi", "kaiwa AI (Talk)", f"{turns} giliran", clean(body.get("note", "-")) or "-", "--menit", str(minutes))
    if r.returncode: return {"ok": False, "error": (r.stdout + r.stderr).strip()[-300:]}
    done.append((r.stdout or "").strip())
    for m in (body.get("mistakes") or [])[:20]:
        item, correct, wrong = clean(m.get("item", ""), 120), clean(m.get("correct", ""), 120), clean(m.get("wrong", ""), 160)
        if not item: continue
        r = run("salah", item, correct or item, wrong or "-")
        done.append((r.stdout or r.stderr).strip())
    return {"ok": True, "done": done}


class Handler(BaseHTTPRequestHandler):
    server_version = "Talk"

    def log_message(self, *a): pass

    def _ok_origin(self):
        host = (self.headers.get("Host") or "").lower()
        if host not in (f"127.0.0.1:{PORT}", f"localhost:{PORT}"): return False
        origin = self.headers.get("Origin")
        return origin is None or origin in (f"http://127.0.0.1:{PORT}", f"http://localhost:{PORT}")

    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        data = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(code); self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store"); self.send_header("X-Content-Type-Options", "nosniff"); self.end_headers(); self.wfile.write(data)

    def do_GET(self):
        if not self._ok_origin(): return self._send(403, {"error": "forbidden"})
        path = self.path.split("?")[0]
        if path == "/api/status": return self._send(200, status())
        if path == "/api/scenarios": return self._send(200, {k: v[0] for k, v in context.SCENARIOS.items()})
        if path == "/api/duet_scenes": return self._send(200, {k: v[0] for k, v in context.DUET_SCENES.items()})
        if path == "/api/duets": return self._send(200, duet_list())
        name = "index.html" if path == "/" else os.path.basename(path)  # basename: nothing outside ui/ can be asked for
        f = os.path.join(UI, name)
        if os.path.splitext(name)[1] in TYPES and os.path.isfile(f):
            return self._send(200, open(f, "rb").read(), TYPES[os.path.splitext(name)[1]])
        self._send(404, {"error": "not found"})

    def do_POST(self):
        if not self._ok_origin(): return self._send(403, {"error": "forbidden"})
        n = int(self.headers.get("Content-Length") or 0)
        path = self.path.split("?")[0]
        limit = MAX_AUDIO if path == "/api/stt" else MAX_JSON
        if n <= 0 or n > limit: return self._send(413, {"error": "bad size"})
        raw = self.rfile.read(n)
        try:
            if path == "/api/stt":  # ?lang=ja|id|en: the learner picked the language (no detection); without it, detection
                want = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query).get("lang", [""])[0]
                t0 = time.time(); text, lang = transcribe(raw, want if want in ("ja", "id", "en") else None)
                return self._send(200, {"text": text, "lang": lang, "seconds": round(time.time() - t0, 2)})
            body = json.loads(raw)
            if self.path == "/api/chat_stream":
                ctx = context.load()
                msgs = [{"role": "system", "content": context.chat_prompt(ctx, body.get("scenario", "free"))}]
                msgs += [{"role": m["role"], "content": m["text"]} for m in body.get("history", [])[-40:] if m.get("role") in ("user", "assistant")]
                for hint in (context.asked_hint(body.get("history", [])), context.topic_hint(body.get("history", []), body.get("scenario", "free"))):
                    if hint: msgs.append({"role": "system", "content": hint})
                self.send_response(200); self.send_header("Content-Type", "application/x-ndjson; charset=utf-8"); self.send_header("Cache-Control", "no-store")
                self.send_header("Connection", "close"); self.end_headers()
                def emit(o): self.wfile.write((json.dumps(o, ensure_ascii=False) + "\n").encode("utf-8")); self.wfile.flush()
                try: stream_reply(msgs, emit)
                except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError): pass  # the page stopped listening (barge-in)
                except Exception as e: emit({"t": "error", "text": str(e)[:200]})
                return
            if self.path == "/api/meaning":
                return self._send(200, meaning(body.get("text", "")))
            if self.path == "/api/chat":
                ctx = context.load()
                msgs = [{"role": "system", "content": context.system_prompt(ctx, body.get("scenario", "free"))}]
                msgs += [{"role": m["role"], "content": m["text"]} for m in body.get("history", [])[-40:] if m.get("role") in ("user", "assistant")]
                t0 = time.time(); out = chat_json(msgs); out["seconds"] = round(time.time() - t0, 2)
                return self._send(200, out)
            if self.path == "/api/reading": return self._send(200, reading(body.get("text", "")))
            if self.path == "/api/suggest": return self._send(200, suggest(body.get("history", [])[-12:]))
            if self.path == "/api/correct":
                t0 = time.time()
                if body.get("lang", "ja") != "ja": return self._send(200, {"corrections": [], "japanese": to_japanese(body.get("text", "")), "seconds": round(time.time() - t0, 2)})
                return self._send(200, {"corrections": correct(body.get("text", "")), "seconds": round(time.time() - t0, 2)})
            if self.path == "/api/tts":
                return self._send(200, tts(body.get("text", "")), "audio/wav")
            if self.path == "/api/report": return self._send(200, report(body.get("turns", []), float(body.get("seconds", 0))))
            if self.path == "/api/send": return self._send(200, send(body))
            if self.path == "/api/duet/new": return self._send(200, duet_new(body.get("scene", "cafe")))
            if self.path == "/api/duet/load": return self._send(200, duet_load(body.get("id", "")))
            if self.path == "/api/duet/score": return self._send(200, duet_score(clean(body.get("target", ""), 300), clean(body.get("said", ""), 300)))
            if self.path == "/api/duet/send": return self._send(200, duet_send(body))
            self._send(404, {"error": "not found"})
        except urllib.error.URLError as e: self._send(502, {"error": f"Ollama tidak menjawab: {e.reason}"})
        except Exception as e: self._send(500, {"error": str(e)[:300]})


if __name__ == "__main__":
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    threading.Thread(target=vv_start, daemon=True).start()
    threading.Thread(target=stt_model, daemon=True).start()  # warm up Whisper while the page loads
    def warm_llm():  # load the language model into the GPU now, so the first reply is not a 40-second wait
        try: ollama("/api/chat", {"model": MODEL, "messages": [{"role": "user", "content": "hi"}], "stream": False, "keep_alive": "30m", "options": {"num_predict": 1}}, timeout=300)
        except Exception: pass
    threading.Thread(target=warm_llm, daemon=True).start()
    print(f"Talk on http://127.0.0.1:{PORT} (local only). Ctrl+C to stop.")
    if "--open" in sys.argv: threading.Timer(1.0, __import__("webbrowser").open, [f"http://127.0.0.1:{PORT}"]).start()
    try: srv.serve_forever()
    except KeyboardInterrupt: pass
