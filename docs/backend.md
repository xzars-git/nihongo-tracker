# Backend: how the tracker stores and publishes data

A one-page guide to explain the backend in an interview. It is a personal project with one user, so I describe it honestly, including what it does not do.

## 30-second pitch

"I built a study tracker for my Japanese learning. My data lives in a local PostgreSQL database. A Python script reads the database and the Anki database, builds a JSON file, and pushes it to GitHub. Vercel serves the site as static files. A small Windows tray app runs the sync four times a day and shows whether the database is running."

## The whole system, end to end

Eight parts work together. Only PostgreSQL and the Python scripts are "backend" in the strict sense, but the interviewer may ask about the full flow, so know all of it.

| # | Part | Job |
|---|---|---|
| 1 | **Study chat** (Claude Code + a tutor skill) | The tutor runs drills. After every round it logs the result with `catat.py`. |
| 2 | **Anki** (desktop app) | Flashcards and spaced repetition. Its SQLite file is the source for review numbers. |
| 3 | **PostgreSQL** (local) | The single source of truth for sessions, mistakes, English log, daily Anki numbers and study minutes. |
| 4 | **`publish.py`** | Reads PostgreSQL, a read-only copy of Anki and the study-chat timestamps. Builds JSON, pushes it, makes a backup. |
| 5 | **GitHub + Vercel** | A push to `main` deploys the static site (about one minute). |
| 6 | **The website** | Plain HTML, CSS and JavaScript. It fetches `data.json` and draws the dashboard in Indonesian, English or Japanese. It works offline as a PWA. |
| 7 | **Nihongo Sync** (C# tray app) | The scheduler and watchdog: runs the sync, retries, shows the database status, sends reminders. |
| 8 | **Private notes repo** | Holds the notes, the tutor skill and the SQL backup. Never public. |

### Big picture

```
  ┌────────────────────────── my PC ─────────────────────────────────────────────────────────────┐
  │                                                                                              │
  │  Study chat (tutor)           Anki desktop                                                   │
  │       │ catat.py                  │ writes collection.anki2 (SQLite)                         │
  │       ▼ INSERT/UPDATE             │                                                          │
  │  ┌───────────────┐   upsert   ┌───┴──────────────┐   chat timestamps (only the times,        │
  │  │  PostgreSQL   │◄───────────│    publish.py    │◄── never the text) → study minutes        │
  │  │  (11 tables)  │───SELECT──►│ (one transaction)│                                           │
  │  └───────┬───────┘            └───┬──────────┬───┘                                           │
  │          │ pg_dump                │          │ git commit + push                             │
  │          ▼                        │          ▼                                               │
  │  db-backup.sql ──► private repo   │    tracker repo (public: code + data.json)               │
  │                                   │                                                          │
  │  Nihongo Sync (tray) ─ runs ──────┘  00:00 · 12:00 · 18:00 · 21:00 · button · retry · catch-up│
  └──────────────────────────────────────────────────────────────┬───────────────────────────────┘
                                                                 │ GitHub → Vercel deploy
                                                                 ▼
                                          browser / phone ──► /home ──► fetch data.json ──► dashboard
```

### What happens in one day

1. **Study.** I open the study chat. The tutor runs `catat.py status` and shows the chapter, the mistakes that are due and the last sessions. During the lesson, every finished round is logged: `sesi` (a session), `salah` (a mistake enters the review bank), `review` (a review answer moves the interval 1 → 3 → 7 → 14 days, then "mastered"). I also do Anki on my own.
2. **Sync.** At 00:00, 12:00, 18:00 and 21:00 (or when I press "Sync sekarang") the tray app starts `python -I publish.py`:
   1. Open one database transaction. If PostgreSQL does not answer, stop here with exit code 1 and change nothing.
   2. Copy the Anki database to a temp folder (so a running Anki is never touched) and read it. Upsert the daily numbers into `anki_days` and `anki_state`.
   3. Read the message times of the study chat. Gaps longer than 3 minutes count as "away". Upsert the minutes into `study_days` (a day only grows).
   4. SELECT everything and build `data.json` and `english.json`. A file is rewritten only when its content changed, with one heartbeat per day.
   5. `git add` the two JSON files, commit, push. Vercel deploys in about one minute.
   6. `pg_dump` into the private notes repo, commit, push. If the dump or the push fails, the tray app marks the sync as failed.
3. **Watching.** The tray app checks the database after every sync and shows `Database: aktif` or `MATI`. If a sync fails, it retries twice, 5 minutes apart, and shows a balloon notification. If the PC was off at a slot, it catches up once, one minute after start-up. At 20:00 it asks the database how many sessions are logged today, and reminds me if there are fewer than four.
4. **Reading.** I open `/home`. The browser fetches `data.json` and draws today's missions, the 17-week heatmap, the "behind schedule" alert, the mistake bank and the weekly progress bars. Tapping a day in the heatmap shows that day. If the data is older than 30 hours, a warning banner appears.

### What if something is down?

| Problem | What happens |
|---|---|
| PostgreSQL stopped | Sync stops at step 1, nothing is pushed. Tray icon turns red. "Start database" restarts the service (Windows asks for admin permission). |
| Anki not found or unreadable | The sync uses the last saved Anki numbers from PostgreSQL and prints a warning. |
| `git push` fails (no internet) | The commit stays local. The next sync pushes it, and the tray app retries. |
| PC was off at a slot | One catch-up sync after the next start-up. |
| Vercel is down | The data is safe in GitHub and PostgreSQL. The site returns when Vercel returns. |
| Data file is old | The site shows a stale-data banner after 30 hours. |

## Data model (11 tables)

| Table | What it stores |
|---|---|
| `sessions` | One row per study session: day, mode, score, short note |
| `mistakes`, `mastered` | Spaced-review bank: interval 1 → 3 → 7 → 14 days, then mastered |
| `meta` | Small key/value facts: current chapter, learned verbs |
| `en_levels`, `en_practice`, `en_mistakes`, `en_words` | My English (IELTS) log |
| `anki_days`, `anki_state` | Daily Anki numbers and totals, copied from Anki |
| `study_days` | Minutes studied per day, only ever grows |

Design choices: dates are real `DATE` columns, `item` is the primary key of the mistake bank, and `pos` keeps the original row order.

## Key decisions and trade-offs

1. **Why PostgreSQL, not SQLite?** Honest answer: SQLite is enough for this data size (a few hundred rows). I chose PostgreSQL to practise a real server database: users, connections, transactions, services, backups. It is a learning decision, not a scaling need.
2. **Why a static site, not an API?** Vercel cannot reach a database on my PC. A static JSON file is simple, fast, free and has no attack surface. Trade-off: the site updates only after a sync, not in real time.
3. **Raw SQL with `psycopg`, no ORM.** The schema is small, so plain parameterized SQL is clear and easy to read. Every query uses placeholders (`%s`), so there is no SQL injection risk.
4. **One transaction per sync.** `publish.py` opens one transaction. If any step fails, nothing is saved, so I never publish half-updated data.
5. **Idempotent writes.** Anki and study numbers use `INSERT ... ON CONFLICT DO UPDATE`, so running the sync twice gives the same result.
6. **Secrets stay out of the repo.** The connection URL is in a local file (`%LOCALAPPDATA%\NihongoSync\db.env`). The repo is public, so it contains no password.
7. **Fail loudly.** If the database is down, the sync stops with an error and pushes nothing. The tray app shows a red icon and a "Start database" button.
8. **Backup.** Every sync writes a plain-SQL `pg_dump` file into a private repo. The dump is rewritten only when the content changes.

## How I migrated safely

I moved the data from markdown tables to PostgreSQL without breaking the site:
1. Wrote the schema and a one-time import script.
2. Compared row counts with the old files (43 sessions, 57 mistakes, and so on).
3. Switched `publish.py` to SQL, then compared the new `data.json` with the old one. Sessions, mistakes and study data were identical. Only today's new Anki numbers differed, as expected.
4. Switched the logging command, then the tutor instructions and the tray app.
5. Archived the old markdown files. The import script now refuses to run on a filled database unless `--force` is given.

## Likely interview questions

**Walk me through what happens when you log a session.**
`catat.py sesi ...` opens a connection, inserts one row into `sessions` with a parameterized query, and commits. At the next sync, `publish.py` selects all rows, builds the JSON, and pushes it.

**What happens if two things write at the same time?**
PostgreSQL handles it with transactions and row locks. In practice there is one user and one sync at a time, so conflicts are very unlikely.

**How do you avoid losing data?**
Transactions for consistency, `pg_dump` after every sync into a second repo, and the old markdown files in an archive.

**What would you change to scale it?**
Move PostgreSQL to the cloud (Neon or Supabase), add a small API (FastAPI) with authentication, and let the site read from it. Add a migration tool such as Alembic and tests against a temporary schema.

**What are the weaknesses?**
It is single-user and local. There is no authentication because there is no API. The schema file is applied with `CREATE TABLE IF NOT EXISTS`, so there is no real migration history. Only the pure logic has unit tests, not the database code.

**How did you check that the migration was correct?**
I compared generated output before and after, field by field, and checked row counts against the source.

## Files to know

- `scripts/schema.sql`: all tables.
- `scripts/db.py`: connection, `init`, `check`, `ping`, `today`, `dump`.
- `scripts/catat.py`: the logging commands and `status`.
- `scripts/publish.py`: builds the JSON from SQL and Anki, pushes, backs up.
- `scripts/migrate_md.py`: the one-time import from markdown.
- `app/NihongoSync.cs`: the tray app.

## Useful vocabulary

transaction · idempotent · upsert · parameterized query · primary key · schema · migration · source of truth · single point of failure · trade-off
