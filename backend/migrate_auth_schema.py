"""
Align PostgreSQL auth tables with models. Safe to run multiple times.
"""

from sqlalchemy import text
from sqlalchemy.engine import Engine


def _has_column(conn, table: str, column: str) -> bool:
    r = conn.execute(
        text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = :t AND column_name = :c"
        ),
        {"t": table, "c": column},
    )
    return r.scalar() is not None


def _has_table(conn, table: str) -> bool:
    r = conn.execute(
        text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = :t"
        ),
        {"t": table},
    )
    return r.scalar() is not None


def ensure_auth_schema(engine: Engine) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS organizations (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    subscription_plan TEXT NOT NULL DEFAULT 'starter',
                    max_seats INTEGER,
                    created_at TIMESTAMP DEFAULT NOW()
                )
                """
            )
        )

        r = conn.execute(text("SELECT 1 FROM organizations WHERE id = 1"))
        if r.scalar() is None:
            conn.execute(
                text(
                    "INSERT INTO organizations (id, name, subscription_plan) "
                    "VALUES (1, 'Default workspace', 'starter')"
                )
            )
        try:
            conn.execute(
                text(
                    "SELECT setval(pg_get_serial_sequence('organizations','id'), "
                    "(SELECT COALESCE(MAX(id), 1) FROM organizations))"
                )
            )
        except Exception:
            pass

        if not _has_table(conn, "users"):
            conn.execute(
                text(
                    """
                    CREATE TABLE users (
                        id SERIAL PRIMARY KEY,
                        organization_id INTEGER NOT NULL REFERENCES organizations(id),
                        email TEXT UNIQUE NOT NULL,
                        hashed_password TEXT NOT NULL,
                        full_name TEXT,
                        is_active BOOLEAN NOT NULL DEFAULT TRUE,
                        created_at TIMESTAMP DEFAULT NOW()
                    )
                    """
                )
            )
            return

        if not _has_column(conn, "users", "organization_id"):
            conn.execute(
                text(
                    "ALTER TABLE users ADD COLUMN organization_id INTEGER "
                    "REFERENCES organizations(id)"
                )
            )
            conn.execute(
                text("UPDATE users SET organization_id = 1 WHERE organization_id IS NULL")
            )
            conn.execute(
                text("ALTER TABLE users ALTER COLUMN organization_id SET NOT NULL")
            )

        if not _has_column(conn, "users", "hashed_password"):
            conn.execute(text("ALTER TABLE users ADD COLUMN hashed_password TEXT"))
            conn.execute(
                text("UPDATE users SET hashed_password = '$2b$12$placeholder' WHERE hashed_password IS NULL")
            )
            conn.execute(
                text("ALTER TABLE users ALTER COLUMN hashed_password SET NOT NULL")
            )

        if not _has_column(conn, "users", "email"):
            conn.execute(text("ALTER TABLE users ADD COLUMN email TEXT"))
            conn.execute(
                text(
                    "UPDATE users SET email = (id::text || '@migrated.invalid') "
                    "WHERE email IS NULL"
                )
            )
            conn.execute(text("ALTER TABLE users ALTER COLUMN email SET NOT NULL"))
            try:
                conn.execute(
                    text("CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (email)")
                )
            except Exception:
                pass

        if not _has_column(conn, "users", "full_name"):
            conn.execute(text("ALTER TABLE users ADD COLUMN full_name TEXT"))

        if not _has_column(conn, "users", "is_active"):
            conn.execute(
                text(
                    "ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE"
                )
            )

        if not _has_column(conn, "users", "created_at"):
            conn.execute(
                text(
                    "ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT NOW()"
                )
            )


def ensure_project_status_column(engine: Engine) -> None:
    """Add workflow status to projects when the table exists."""
    with engine.begin() as conn:
        if not _has_table(conn, "projects"):
            return
        if not _has_column(conn, "projects", "status"):
            conn.execute(
                text(
                    "ALTER TABLE projects "
                    "ADD COLUMN status TEXT NOT NULL DEFAULT 'not_started'"
                )
            )


def ensure_project_updated_at_column(engine: Engine) -> None:
    """Add updated_at to projects; backfill from created_at."""
    with engine.begin() as conn:
        if not _has_table(conn, "projects"):
            return
        if not _has_column(conn, "projects", "updated_at"):
            conn.execute(
                text("ALTER TABLE projects ADD COLUMN updated_at TIMESTAMP")
            )
            conn.execute(
                text(
                    "UPDATE projects SET updated_at = COALESCE(created_at, NOW()) "
                    "WHERE updated_at IS NULL"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE projects ALTER COLUMN updated_at "
                    "SET DEFAULT NOW()"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE projects ALTER COLUMN updated_at SET NOT NULL"
                )
            )


def ensure_episode_workflow_columns(engine: Engine) -> None:
    """Add status and updated_at to episodes."""
    with engine.begin() as conn:
        if not _has_table(conn, "episodes"):
            return
        if not _has_column(conn, "episodes", "updated_at"):
            conn.execute(text("ALTER TABLE episodes ADD COLUMN updated_at TIMESTAMP"))
            conn.execute(
                text(
                    "UPDATE episodes SET updated_at = COALESCE(created_at, NOW()) "
                    "WHERE updated_at IS NULL"
                )
            )
            conn.execute(
                text("ALTER TABLE episodes ALTER COLUMN updated_at SET DEFAULT NOW()")
            )
            conn.execute(
                text("ALTER TABLE episodes ALTER COLUMN updated_at SET NOT NULL")
            )
        if not _has_column(conn, "episodes", "status"):
            conn.execute(
                text(
                    "ALTER TABLE episodes ADD COLUMN status TEXT "
                    "NOT NULL DEFAULT 'not_started'"
                )
            )


def ensure_project_deleted_at_column(engine: Engine) -> None:
    """Nullable deleted_at for soft-delete (trash)."""
    with engine.begin() as conn:
        if not _has_table(conn, "projects"):
            return
        if not _has_column(conn, "projects", "deleted_at"):
            conn.execute(text("ALTER TABLE projects ADD COLUMN deleted_at TIMESTAMP"))


def ensure_project_assignee_column(engine: Engine) -> None:
    """Optional FK to users for project owner / assignee."""
    with engine.begin() as conn:
        if not _has_table(conn, "projects"):
            return
        if not _has_column(conn, "projects", "assigned_to_user_id"):
            conn.execute(
                text(
                    "ALTER TABLE projects ADD COLUMN assigned_to_user_id INTEGER "
                    "REFERENCES users(id)"
                )
            )


def ensure_episode_assignee_column(engine: Engine) -> None:
    """Optional FK to users for episode assignee."""
    with engine.begin() as conn:
        if not _has_table(conn, "episodes"):
            return
        if not _has_column(conn, "episodes", "assigned_to_user_id"):
            conn.execute(
                text(
                    "ALTER TABLE episodes ADD COLUMN assigned_to_user_id INTEGER "
                    "REFERENCES users(id)"
                )
            )


def ensure_sentence_timing_columns(engine: Engine) -> None:
    """Add subtitle timecode columns to sentences when the table exists."""
    with engine.begin() as conn:
        if not _has_table(conn, "sentences"):
            return
        if not _has_column(conn, "sentences", "start_time"):
            conn.execute(text("ALTER TABLE sentences ADD COLUMN start_time TEXT"))
        if not _has_column(conn, "sentences", "end_time"):
            conn.execute(text("ALTER TABLE sentences ADD COLUMN end_time TEXT"))
