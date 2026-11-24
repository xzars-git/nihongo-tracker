"""PostgreSQL connection for the tracker scripts. The connection URL lives in %LOCALAPPDATA%\\NihongoSync\\db.env (never in the repo).

  python -I scripts/db.py init     create the tables (safe to repeat)
  python -I scripts/db.py check    test the connection and count rows
  python -I scripts/db.py ping     exit 0 when the database answers (used by the tray app)
  python -I scripts/db.py dump [file]  write a plain-SQL backup (default catatan/db-backup.sql in the notes repo)
  python -I scripts/db.py status   print server version, row counts, due reviews, backup and web-data times (tray window)
  python -I scripts/db.py today   print how many sessions are logged today (day starts at 4am; used by the 20:00 reminder)
"""
import glob, os, subprocess, sys
from urllib.parse import urlparse, unquote

HERE = os.path.dirname(os.path.abspath(__file__))
ENV = os.path.join(os.environ.get("LOCALAPPDATA", ""), "NihongoSync", "db.env")


def connect():
    import psycopg
    try: url = open(ENV, encoding="ascii").read().strip()
    except OSError: sys.exit(f"db.env tidak ada: {ENV}")
    try: return psycopg.connect(url, connect_timeout=5)
    except psycopg.OperationalError as e: sys.exit(f"Database tidak bisa dihubungi (service PostgreSQL mati?): {str(e).strip()[:200]}")


def init():
    with connect() as c: c.execute(open(os.path.join(HERE, "schema.sql"), encoding="utf-8").read())
    print("schema siap")


def check():
    with connect() as c:
        for (t,) in c.execute("select table_name from information_schema.tables where table_schema='public' order by 1").fetchall():
            print(f"{t:12} {c.execute(f'select count(*) from {t}').fetchone()[0]}")


RESTRICT = b"\\restrict "  # a backslash command: \restrict <key>


def dump(path=None):
    """Plain-SQL backup with pg_dump. The file is rewritten only when the content changed, so the notes repo gets no empty commits."""
    path = path or os.path.join(HERE, "..", "..", "catatan", "db-backup.sql")
    exe = sorted(glob.glob(os.path.join(os.environ.get("ProgramFiles", r"C:/Program Files"), "PostgreSQL", "*", "bin", "pg_dump.exe")))
    if not exe: sys.exit("pg_dump tidak ditemukan (PostgreSQL belum terpasang?)")
    u = urlparse(open(ENV, encoding="ascii").read().strip())
    env = {**os.environ, "PGPASSWORD": unquote(u.password or "")}  # the password stays out of the command line
    r = subprocess.run([exe[-1], "-h", u.hostname, "-p", str(u.port or 5432), "-U", unquote(u.username), "--no-owner", "--no-privileges", u.path.lstrip("/")],
                       env=env, capture_output=True, creationflags=0x08000000)  # no console window
    if r.returncode: sys.exit("pg_dump gagal: " + r.stderr.decode("utf-8", "replace").strip()[:200])
    # pg_dump 17+ writes a random "\restrict <key>" line each run: drop it, or the file would change on every sync
    out = b"".join(l for l in r.stdout.splitlines(keepends=True) if not l.startswith((RESTRICT, RESTRICT.replace(b"restrict", b"unrestrict"))))
    old = open(path, "rb").read() if os.path.exists(path) else b""
    if old != out: open(path, "wb").write(out); print("db-backup.sql updated")


def ping():
    with connect() as c: c.execute("select 1")
    print("ok")


def today():
    with connect() as c: print(c.execute("select count(*) from sessions where day = (now() - interval '4 hours')::date").fetchone()[0])


def _age(path):
    """'dd MMM HH:mm' of a file's last change, or 'belum ada'."""
    import datetime as dt
    return dt.datetime.fromtimestamp(os.path.getmtime(path)).strftime("%d %b %H:%M") if os.path.exists(path) else "belum ada"


def status():
    """Lines for the tray window: server version, row counts, due reviews, backup and web-data times."""
    with connect() as c:
        ver = c.execute("show server_version").fetchone()[0]
        n_s, n_m, due = c.execute("select (select count(*) from sessions), (select count(*) from mistakes), (select count(*) from mistakes where due <= current_date)").fetchone()
    print(f"Server: PostgreSQL {ver}")
    print(f"Data: {n_s} sesi, {n_m} bank ({due} jatuh tempo)")
    print(f"Backup: {_age(os.path.join(HERE, '..', '..', 'catatan', 'db-backup.sql'))}, data web: {_age(os.path.join(HERE, '..', 'data', 'data.json'))}")


if __name__ == "__main__":
    {"init": init, "check": check, "ping": ping, "today": today, "status": status, "dump": lambda: dump(*sys.argv[2:3])}.get(sys.argv[1] if len(sys.argv) > 1 else "", lambda: sys.exit(__doc__))()
