"""One-time DB bootstrap: default organization row for legacy tenant_id=1 projects."""

from sqlalchemy import text
from sqlalchemy.orm import Session

from core.security import hash_password
from models.organization import Organization
from models.user import User

# Local demo account (created if missing). Password is intentionally simple for dev.
DEMO_USER_EMAIL = "demo@syriona.local"
DEMO_USER_PASSWORD = "demo123"


def ensure_default_organization(db: Session) -> None:
    if db.query(Organization).count() > 0:
        return
    db.add(
        Organization(
            id=1,
            name="Default workspace",
            subscription_plan="starter",
            max_seats=None,
        )
    )
    db.commit()
    try:
        db.execute(
            text(
                "SELECT setval(pg_get_serial_sequence('organizations','id'), "
                "(SELECT COALESCE(MAX(id), 1) FROM organizations))"
            )
        )
        db.commit()
    except Exception:
        db.rollback()


def ensure_demo_user(db: Session) -> None:
    """Ensure a fixed demo user exists so Sign in works without registration."""
    if db.query(User).filter(User.email == DEMO_USER_EMAIL).first():
        return
    org = db.query(Organization).filter(Organization.id == 1).first()
    if not org:
        return
    db.add(
        User(
            organization_id=org.id,
            email=DEMO_USER_EMAIL,
            hashed_password=hash_password(DEMO_USER_PASSWORD),
            full_name="Demo user",
            is_active=True,
        )
    )
    db.commit()
