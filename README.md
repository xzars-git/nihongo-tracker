# 日本語 Tracker

Public log of my Japanese study toward **JLPT N2 (December 2027)**, with N3 in July 2027 as a checkpoint, in Indonesian, English and Japanese.

**Live:** https://arsenius-nihongo.vercel.app

## Features

- **Today:** four daily missions (Anki, kanji quiz, Minna no Nihongo, conversation) checked from real data
- **This week:** progress bars for Minna no Nihongo chapters and Kaishi 1.5k vocabulary, with pace toward the checkpoint
- **Toward N2:** vocabulary and kanji against what the exam needs, with a forecast date at the last 7 days' pace
- **Consistency:** activity heatmap and streak
- **Mistake bank:** items due for spaced review (1 → 3 → 7 → 14 days), plus a **weak spots** summary (verb forms, particles, kanji, look-alike words)
- **Achievements:** badges for words, kanji, streaks, chapters, conversations, study hours
- **Session log:** one row per day
- **Flex:** generates a 1080×1920 story image of the day (14 templates incl. weekly recap, study log and badges), with a console-style gacha reveal, optional quote (190-quote bank, filterable by category)
- **English tracker** (`english.html`): CEFR level per skill, practice log, recurring mistakes and new words for the IELTS plan. Written from my own reports to the AI tutor, so it is not live
- **Backend:** a local PostgreSQL database is the single source of truth. See [docs/backend.md](docs/backend.md) for the full flow and the interview notes
- **System design** page (`system.html`): interactive before/after diagram of the whole system, step-by-step flow, component inspector and a security section
- **About me** and **Method** pages
- **Shadowing** page (`shadow.html`): YouTube player with a synced Japanese script, line loop, slow speed, blurred text, Indonesian meanings (`shadow.py translate`) and a public history of logged practice. The tray app has **Buka Shadowing** (a web server on 127.0.0.1 only, so nothing is reachable from the internet) and **Tambah video** (collects captions; Whisper on the GPU runs only after you answer Ya). Scripts are collected on this PC with `scripts/shadow.py <link>` and saved in PostgreSQL (`shadow_videos`, `shadow_lines`); `data/shadow/*.json` is a plain local export and is gitignored (other people's text). The web gets an **encrypted** copy in `data/shadow-enc/` (AES-256-GCM, key from PBKDF2 over a passphrase kept only in `%LOCALAPPDATA%\NihongoSync\shadow.key`, never in the repo); the page decrypts it in the browser after you enter the passphrase once per device, and the tray's sync pushes it. Japanese and English (`--lang ja|en`). Controls: repeat each line 1/2/3/5 times, Auto (play the whole script line by line, marking lines done), Your turn (pauses after each line so you can speak). Japanese lines also get automatic romaji (cutlet + UniDic, optional Romaji button). Practice minutes are logged with `catat.py shadow <video-id> <minutes>` (the page shows the exact command). Videos without captions use Whisper on the GPU, once, if its packages are installed.
- **Talk** page (`talk.html`): a showcase of the separate local app in `../talk/` (AI conversation tutor: Whisper + a local Qwen3.5 9B model + AivisSpeech voice, nothing leaves the PC). The site shows only the explanation and the session/minute totals; the app sends its report to the tracker through `catat.py`.
- **Installable** on a phone (PWA) and readable offline
- Updates itself four times a day (00:00, 12:00, 18:00, 21:00); no backend

## How it works

```
catat.py (CLI) ───► PostgreSQL ─┐
                                ├─► scripts/publish.py ─► data/*.json ─► git push ─► Vercel
Anki collection (read-only) ────┘    (Nihongo Sync tray app: 00:00 · 12:00 · 18:00 · 21:00)
                                          └─► pg_dump + notes ─► private repo
```

`publish.py` reads sessions, the mistake bank and the English log from PostgreSQL, plus a read-only copy of the local Anki database, then writes `data/data.json` and `data/english.json`. It runs in one transaction, commits only those files and pushes when the data changed. The site is static and renders everything in the browser from the JSON. Details: [docs/backend.md](docs/backend.md).

Study time = Anki + the study chat, both measured:

- **Anki:** the time Anki recorded per answer (capped at 60 s per card by Anki itself, so being away between cards adds nothing).
- **Study chat:** `publish.py` reads the *timestamps* of the Claude Code session titled in `data/plan.json` (`study.sessionTitle`), never the conversation text. A gap between two messages counts at most `study.afkSeconds` (180 s); longer means away. Overlapping sessions (resumed or forked chats repeat old messages) are merged so nothing counts twice. Days are cut at 04:00, like Anki.
- Days with no chat data fall back to the minutes logged with `--menit`, or a rough per-row estimate shown with a **±**. `--menit` is also how to add study done outside the chat.
- Claude Code deletes old transcripts after a while, so past days are kept in `data.json` and only ever grow.

## Project structure

```
.
├── index.html, about.html, metode.html, english.html, system.html, shadow.html, talk.html
├── manifest.webmanifest, sw.js      # PWA: install + offline fallback
├── assets/
│   ├── css/styles.css
│   ├── img/                         # app icons
│   └── js/
│       ├── i18n.js                  # ID / EN / JA strings
│       ├── app.js                   # main dashboard
│       ├── flex.js                  # story image generator
│       ├── info.js                  # About + Method pages
│       ├── system.js                # System design page (history diagram, zones, weak spots)
│       ├── sysparts.js              # System page: architecture per part (tracker, Talk, Duet, Shadowing)
│       ├── english.js               # English tracker page
│       └── pwa.js                   # service worker registration
├── docs/
│   └── backend.md                   # system flow + interview notes
├── data/
│   ├── plan.json                    # targets and weekly plan (hand-edited)
│   ├── metode.json                  # text of the Method page, ID / EN / JA (hand-edited)
│   ├── quotes.json                  # quote bank (hand-edited)
│   ├── data.json                    # generated, do not edit
│   └── english.json                 # generated from the database, do not edit
├── app/
│   ├── NihongoSync.cs               # Windows tray app that runs publish.py on schedule
│   └── icon.ico
├── scripts/
│   ├── publish.py                   # build data.json, push, back up notes
│   ├── catat.py                     # one-line logging during a study session (writes to PostgreSQL)
│   ├── db.py                        # connection, init, check, ping, dump
│   ├── schema.sql                   # all tables
│   ├── migrate_md.py                # one-time import from the old markdown notes
│   ├── build-app.ps1                # compile + install the tray app
│   ├── check.py                     # static checks (CI + pre-commit)
│   └── stamp.py                     # cache-busting: ?v=<hash> on assets
├── .githooks/pre-commit             # stamp + check before each commit
└── .github/workflows/check.yml      # the same checks on GitHub
```

## Logging a session

```bash
python -I scripts/catat.py sesi "tebak kanji" "9/10" "short note"   # add --menit N only for study outside the chat
python -I scripts/catat.py salah "<item>" "<correct answer>" "<mistake>"
python -I scripts/catat.py review "<item>" benar
python -I scripts/catat.py bab 16
python -I scripts/catat.py kerja "書く, 読む"   # add learned verbs
python -I scripts/catat.py status    # chapter, due mistakes, last sessions (read by the tutor)
python -I scripts/catat.py kirim     # build + push now
```

English tracker (rows go to PostgreSQL, the date is automatic, `publish.py` builds `data/english.json`):

```bash
python -I scripts/catat.py en level "speaking" "B1" "live test"             # overall|reading|listening|grammar|speaking, A1..C2
python -I scripts/catat.py en latihan "writing" "Task 2 paragraph" "5.5" "note"
python -I scripts/catat.py en salah "tense" "I've been test" "I tested"     # article|preposition|tense|spelling|word|agreement|run-on
python -I scripts/catat.py en kata "gist" "the main idea" "I got the gist."
```

## Nihongo Sync (tray app)

A small Windows tray app (`NihongoSync.exe`, C# WinForms) that runs `publish.py` at 00:00, 12:00, 18:00 and 21:00.

- Between slots it waits on a single timer.
- After boot, it catches up once if a slot was missed.
- A failed sync is retried twice (5 minutes apart); the reason is shown in the window and in a balloon.
- At 20:00 it reminds you if fewer than 4 sessions are logged for the day (it asks the database, so it does not depend on the last sync).
- The window shows `Database: aktif` or `MATI`. A **Start database** button starts the PostgreSQL service (Windows asks for admin permission only then). When the database is down, the sync stops before it changes anything.
- Hovering the tray icon shows the status, the last update and the next run. The icon is yellow when idle, grey while syncing and red after a failed sync.
- Closing the window only hides it to the tray; **Quit** in the tray menu stops it.
- It starts with Windows (Startup folder) and is in the Start Menu as **Nihongo Sync**.

Build and install with the C# compiler that ships with Windows (no SDK needed):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-app.ps1
```

It installs to `%LOCALAPPDATA%\Programs\NihongoSync`. Log: `%LOCALAPPDATA%\NihongoSync\sync.log` (the **Lihat log** button shows it inside the app; the file is trimmed to ~100 KB once it passes 200 KB).

## Backup of the notes

The notes (`catatan/`), the tutor skill and a plain-SQL dump of the database (`catatan/db-backup.sql`) live outside this repo, in a **private** repo (`nihongo-notes`). Each sync writes the dump and pushes them. Only the derived JSON is public. The old markdown notes are archived in `catatan/arsip/`.

## Development

One-time database setup (PostgreSQL 16+ and `pip install "psycopg[binary]"`): create a user and a database, save the connection URL as one line in `%LOCALAPPDATA%\NihongoSync\db.env` (never in the repo), then:

```bash
python -I scripts/db.py init         # create the tables
python -I scripts/db.py check        # row count per table
python -I scripts/db.py dump         # write the SQL backup
```

```bash
git config core.hooksPath .githooks  # once per clone: stamp + check on every commit
python -m http.server 8000           # then open http://localhost:8000
python -I scripts/check.py           # JSON, quote bank, links, translation keys, asset versions
python -I scripts/stamp.py           # refresh ?v=<hash> after editing CSS/JS
python -I scripts/publish.py --no-push
python -I scripts/publish.py --test  # self-test
python -I scripts/catat.py --test
```

`check.py` fails when a translation key exists in one language but not the others, when a quote has a bad category, when a page links to a missing file, or when asset versions are stale.

Deployed by Vercel on every push to `main`. `scripts/` and `app/` are excluded by `.vercelignore`.
