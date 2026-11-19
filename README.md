# 日本語 Tracker

Public log of my Japanese study toward **JLPT N3 (July 2027)**, in Indonesian, English and Japanese.

**Live:** https://arsenius-nihongo.vercel.app

## Features

- **Today:** four daily missions (Anki, kanji quiz, Minna no Nihongo, conversation) checked from real data
- **This week:** progress bars for Minna no Nihongo chapters and Kaishi 1.5k vocabulary, with pace toward the checkpoint
- **Toward N3:** vocabulary and kanji against what the exam needs, with a forecast date at the last 7 days' pace
- **Consistency:** activity heatmap and streak
- **Mistake bank:** items due for spaced review (1 → 3 → 7 → 14 days), plus a **weak spots** summary (verb forms, particles, kanji, look-alike words)
- **Achievements:** badges for words, kanji, streaks, chapters, conversations, study hours
- **Session log:** one row per day
- **Flex:** generates a 1080×1920 story image of the day (14 templates incl. weekly recap, study log and badges), with a console-style gacha reveal, optional quote (190-quote bank, filterable by category)
- **About me** and **Method** pages
- **Installable** on a phone (PWA) and readable offline
- Updates itself four times a day (00:00, 12:00, 18:00, 21:00); no backend

## How it works

```
catatan/progres.md ─┐
                    ├─► scripts/publish.py ─► data/data.json ─► git push ─► Vercel
Anki collection ────┘    (Nihongo Sync tray app: 00:00 · 12:00 · 18:00 · 21:00)
                                  └─► backup of notes ─► private repo
```

`publish.py` reads the session log and mistake bank from `progres.md` and a read-only copy of the local Anki database, then writes `data/data.json`. It commits only that file and pushes when the data changed. The site is static and renders everything in the browser from `data.json`.

Study time = Anki + the study chat, both measured:

- **Anki:** the time Anki recorded per answer (capped at 60 s per card by Anki itself, so being away between cards adds nothing).
- **Study chat:** `publish.py` reads the *timestamps* of the Claude Code session titled in `data/plan.json` (`study.sessionTitle`), never the conversation text. A gap between two messages counts at most `study.afkSeconds` (180 s); longer means away. Overlapping sessions (resumed or forked chats repeat old messages) are merged so nothing counts twice. Days are cut at 04:00, like Anki.
- Days with no chat data fall back to the minutes logged with `--menit`, or a rough per-row estimate shown with a **±**. `--menit` is also how to add study done outside the chat.
- Claude Code deletes old transcripts after a while, so past days are kept in `data.json` and only ever grow.

## Project structure

```
.
├── index.html, about.html, metode.html
├── manifest.webmanifest, sw.js      # PWA: install + offline fallback
├── assets/
│   ├── css/styles.css
│   ├── img/                         # app icons
│   └── js/
│       ├── i18n.js                  # ID / EN / JA strings
│       ├── app.js                   # main dashboard
│       ├── flex.js                  # story image generator
│       ├── info.js                  # About + Method pages
│       └── pwa.js                   # service worker registration
├── data/
│   ├── plan.json                    # targets and weekly plan (hand-edited)
│   ├── metode.json                  # text of the Method page, ID / EN / JA (hand-edited)
│   ├── quotes.json                  # quote bank (hand-edited)
│   └── data.json                    # generated, do not edit
├── app/
│   ├── NihongoSync.cs               # Windows tray app that runs publish.py on schedule
│   └── icon.ico
├── scripts/
│   ├── publish.py                   # build data.json, push, back up notes
│   ├── catat.py                     # one-line logging during a study session
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
python -I scripts/catat.py kirim     # build + push now
```

## Nihongo Sync (tray app)

A small Windows tray app (`NihongoSync.exe`, C# WinForms) that runs `publish.py` at 00:00, 12:00, 18:00 and 21:00.

- Between slots it waits on a single timer.
- After boot, it catches up once if a slot was missed.
- A failed sync is retried twice (5 minutes apart); the reason is shown in the window and in a balloon.
- At 20:00 it reminds you if fewer than 4 sessions are logged for the day (it reads `progres.md` directly, so it does not depend on the last sync).
- Hovering the tray icon shows the status, the last update and the next run. The icon is yellow when idle, grey while syncing and red after a failed sync.
- Closing the window only hides it to the tray; **Quit** in the tray menu stops it.
- It starts with Windows (Startup folder) and is in the Start Menu as **Nihongo Sync**.

Build and install with the C# compiler that ships with Windows (no SDK needed):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-app.ps1
```

It installs to `%LOCALAPPDATA%\Programs\NihongoSync`. Log: `%LOCALAPPDATA%\NihongoSync\sync.log` (the **Lihat log** button shows it inside the app; the file is trimmed to ~100 KB once it passes 200 KB).

## Backup of the notes

The raw notes (`catatan/`) and the tutor skill live outside this repo, in a **private** repo (`nihongo-notes`). Each sync commits and pushes them. Only the derived `data.json` is public.

## Development

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
