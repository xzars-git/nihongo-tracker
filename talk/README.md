# Talk (prototype)

A local-only Japanese conversation tutor with two modes:

- **Percakapan:** click, speak (Japanese, Indonesian or English), click again; Yuki answers in simple Japanese with her voice, plus corrections, furigana, romaji, the Indonesian meaning and two example replies.
- **Duet (dialogue shadowing):** an 8-line role-play script for your chapter. Yuki says her lines, you say yours, and the app scores each line by sound and marks missed words. Three levels (full text, hints, no text) and role swap.

It is a separate app from the tracker: it only READS the tracker (chapter, known verbs, mistakes due) and, when you press
"Kirim ke tracker", WRITES one session (and in Percakapan the mistakes you ticked) through the tracker's own `catat.py`.

Start: double-click `start-talk.cmd` (or the desktop shortcut). Needs Ollama running with the model `qwen3.5:9b` (or set `TALK_MODEL`).

```
mic (click) -> /api/stt (Whisper on the GPU: kotoba-whisper for Japanese, whisper-small finds the language and writes id/en)
            -> /api/chat_stream (Qwen3.5 9B via Ollama, streamed) -> /api/tts (AivisSpeech, sentence by sentence)
            -> /api/correct, /api/meaning, /api/reading (furigana + romaji, no LLM), /api/suggest (example replies)
finish -> /api/report (summary + mistakes you can untick) -> /api/send -> tracker (sesi "kaiwa AI (Talk)" + bank kesalahan)
duet   -> /api/duet/new (script) -> /api/stt?lang=ja -> /api/duet/score -> /api/duet/send (sesi "shadowing duet (Talk)")
```

- Local only: listens on 127.0.0.1, rejects other Host/Origin values, no account and no paid API. Voice never leaves the PC.
- `reports/` holds the saved reports and `duets/` the generated dialogues (personal, both kept out of git).
- The model is small, so corrections, example replies and scripts can be wrong; that is why the report is reviewed before it is sent.
- The Duet score checks whether the right words were said (compared as kana), not accent or pitch.
- Voice: AivisSpeech engine 1.0.0 in `aivis/` (started by `server.py` on 127.0.0.1:10101, voice まお); VOICEVOX in `voicevox/` is the fallback (credit: VOICEVOX:春日部つむぎ). Credit the voice's licence if you ever publish the audio.
- Self-check of the furigana helper: `python -X utf8 -I server.py --selftest`.
