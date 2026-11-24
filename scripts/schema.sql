-- Tracker data (replaces catatan/progres.md, catatan/english.md and the Anki/study parts of data.json).
-- Apply with:  python -I scripts/db.py init   (safe to run again)

-- Cells are kept exactly as they were written in the markdown tables, so publish.py builds the same data.json.
CREATE TABLE IF NOT EXISTS sessions (
  id    serial PRIMARY KEY,
  day   date NOT NULL,
  mode  text NOT NULL,
  score text NOT NULL DEFAULT '–',
  note  text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS sessions_day ON sessions (day);

CREATE TABLE IF NOT EXISTS mistakes (          -- spaced-review bank: interval 1 -> 3 -> 7 -> 14 days
  pos      serial,                     -- keeps the order the rows were written in
  item     text PRIMARY KEY,
  correct  text NOT NULL,
  wrong    text NOT NULL,
  interval int  NOT NULL DEFAULT 1,
  due      date
);
CREATE TABLE IF NOT EXISTS mastered (pos serial, item text PRIMARY KEY, day date NOT NULL);

CREATE TABLE IF NOT EXISTS meta (key text PRIMARY KEY, value text NOT NULL);   -- bab, verbs

CREATE TABLE IF NOT EXISTS en_levels   (id serial PRIMARY KEY, day date NOT NULL, skill text, level text, source text);
CREATE TABLE IF NOT EXISTS en_practice (id serial PRIMARY KEY, day date NOT NULL, skill text, task text, band text, note text);
CREATE TABLE IF NOT EXISTS en_mistakes (id serial PRIMARY KEY, day date NOT NULL, cat text, wrong text, correct text);
CREATE TABLE IF NOT EXISTS en_words    (id serial PRIMARY KEY, day date NOT NULL, word text, meaning text, example text);

CREATE TABLE IF NOT EXISTS anki_days (          -- one row per study day, upserted from the read-only Anki copy
  day       date PRIMARY KEY,
  reviews   int NOT NULL DEFAULT 0,
  again     int NOT NULL DEFAULT 0,
  hard      int NOT NULL DEFAULT 0,
  kaishi_new int NOT NULL DEFAULT 0,
  rtk_new   int NOT NULL DEFAULT 0,
  new_cards int NOT NULL DEFAULT 0,
  anki_min  int NOT NULL DEFAULT 0,
  minna_rev int NOT NULL DEFAULT 0,               -- reviews in the Minna No Nihongo::Bab decks
  kanji_new int NOT NULL DEFAULT 0,               -- kanji met for the first time that day (any deck)
  due_left  int                                   -- what was left at the day's last sync
);
CREATE TABLE IF NOT EXISTS anki_state (          -- one row (id = 1): totals from the last sync
  id int PRIMARY KEY CHECK (id = 1),
  today date, due_now int, kaishi_opened int, kaishi_mature int, kanji_known int, kanji_seen int, kanji_list text
);

CREATE TABLE IF NOT EXISTS study_days (day date PRIMARY KEY, minutes int NOT NULL);   -- study-chat minutes, only ever grows

-- Shadowing scripts (made by scripts/shadow.py). The DB is the source of truth; data/shadow/*.json is only an export for the page.
CREATE TABLE IF NOT EXISTS shadow_videos (id text PRIMARY KEY, title text NOT NULL, author text NOT NULL DEFAULT '', kind text NOT NULL, lang text NOT NULL DEFAULT 'ja', added timestamptz NOT NULL DEFAULT now());   -- kind: manual | auto | whisper
CREATE TABLE IF NOT EXISTS shadow_lines (video text NOT NULL REFERENCES shadow_videos ON DELETE CASCADE, n int NOT NULL, s real NOT NULL, e real NOT NULL, t text NOT NULL, r text NOT NULL DEFAULT '', tr text NOT NULL DEFAULT '', PRIMARY KEY (video, n));
ALTER TABLE shadow_videos ADD COLUMN IF NOT EXISTS lang text NOT NULL DEFAULT 'ja';   -- ja | en (older databases)
ALTER TABLE shadow_lines ADD COLUMN IF NOT EXISTS r text NOT NULL DEFAULT '';   -- romaji, made by shadow.py for Japanese lines
ALTER TABLE shadow_lines ADD COLUMN IF NOT EXISTS tr text NOT NULL DEFAULT '';   -- Indonesian meaning, imported with: shadow.py translate <id> <file.json>
ALTER TABLE anki_days ADD COLUMN IF NOT EXISTS minna_rev int NOT NULL DEFAULT 0;   -- older databases
ALTER TABLE anki_days ADD COLUMN IF NOT EXISTS kanji_new int NOT NULL DEFAULT 0;
