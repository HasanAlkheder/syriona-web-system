from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from deps import get_current_user, get_db
from models.user import User

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/")
def list_organization_users(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Active users in the same organization (for assign-to pickers)."""
    rows = (
        db.query(User)
        .filter(
            User.organization_id == user.organization_id,
            User.is_active.is_(True),
        )
        .order_by(User.full_name.asc().nulls_last(), User.email.asc())
        .all()
    )
    return [
        {"id": r.id, "email": r.email, "full_name": r.full_name} for r in rows
    ]
