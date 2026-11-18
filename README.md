# 日本語 Tracker

Public log of my Japanese study toward **JLPT N3 (July 2027)**, in Indonesian, English and Japanese.

**Live:** https://arsenius-nihongo.vercel.app

## Features

- **Today:** four daily missions (Anki, kanji quiz, Minna no Nihongo, conversation) checked from real data
- **This week:** progress bars for Minna no Nihongo chapters and Kaishi 1.5k vocabulary, with pace toward the checkpoint
- **Consistency:** activity heatmap and streak
- **Mistake bank:** items due for spaced review (1 → 3 → 7 → 14 days)
- **Session log:** one row per day
- **Flex:** generates a 1080×1920 story image of the day's progress, with a gacha-style console reveal
- **About me** and **Method** pages
- Updates itself every hour; no backend

## How it works

```
catatan/progres.md ─┐
                    ├─► scripts/publish.py ─► data/data.json ─► git push ─► Vercel
Anki collection ────┘        (hourly, Windows Task Scheduler)
```

`publish.py` reads the session log and mistake bank from `progres.md` and a read-only copy of the local Anki database, then writes `data/data.json`. It commits only that file and pushes when the data changed. The site is static and renders everything in the browser from `data.json`.

## Project structure

```
.
├── index.html, about.html, metode.html
├── assets/
│   ├── css/styles.css
│   └── js/
│       ├── i18n.js        # ID / EN / JA strings
│       ├── app.js         # main dashboard
│       ├── flex.js        # story image generator
│       └── info.js        # About + Method pages
├── data/
│   ├── plan.json          # targets and weekly plan (hand-edited)
│   └── data.json          # generated, do not edit
└── scripts/
    ├── publish.py         # build data.json and push
    └── catat.py           # one-line logging during a study session
```

## Logging a session

```bash
python -I scripts/catat.py sesi "tebak kanji" "9/10"
python -I scripts/catat.py salah "<item>" "<correct answer>" "<mistake>"
python -I scripts/catat.py review "<item>" benar
python -I scripts/catat.py bab 16
python -I scripts/catat.py kirim     # build + push now
```

## Development

```bash
python -m http.server 8000           # then open http://localhost:8000
python -I scripts/publish.py --no-push
python -I scripts/publish.py --test  # self-test
python -I scripts/catat.py --test
```

Deployed by Vercel on every push to `main`. `scripts/` is excluded by `.vercelignore`.
