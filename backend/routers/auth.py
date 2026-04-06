from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.security import create_access_token, hash_password, verify_password
from deps import get_current_user, get_db
from models.organization import Organization
from models.user import User
from schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    MeUpdateRequest,
    RegisterRequest,
    SetupRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/bootstrap-status")
def bootstrap_status(db: Session = Depends(get_db)):
    return {"needs_setup": db.query(User).count() == 0}


@router.post("/setup")
def setup_first_admin(body: SetupRequest, db: Session = Depends(get_db)):
    if db.query(User).count() > 0:
        raise HTTPException(status_code=400, detail="Setup already completed")
    org = db.query(Organization).filter(Organization.id == 1).first()
    if not org:
        raise HTTPException(
            status_code=503,
            detail="Default organization is not ready. Restart the API server once.",
        )
    email = body.email.lower().strip()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already in use")
    user = User(
        organization_id=org.id,
        email=email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name.strip(),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user_id=user.id, organization_id=user.organization_id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _user_public(user, org.name),
    }


@router.post("/register")
def register_company(body: RegisterRequest, db: Session = Depends(get_db)):
    email = body.email.lower().strip()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    org = Organization(
        name=body.organization_name.strip(),
        subscription_plan="starter",
        max_seats=None,
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    user = User(
        organization_id=org.id,
        email=email,
        hashed_password=hash_password(body.password),
        full_name=(body.full_name or "").strip() or None,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user_id=user.id, organization_id=user.organization_id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _user_public(user, org.name),
    }


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    email = body.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account disabled")
    org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    org_name = org.name if org else ""
    token = create_access_token(user_id=user.id, organization_id=user.organization_id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _user_public(user, org_name),
    }


def _user_public(user: User, organization_name: str) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "organization_id": user.organization_id,
        "organization_name": organization_name,
    }


def _usage_snapshot(org: Organization | None) -> dict:
    """Demo quotas by plan until billing / GPU metering is wired."""
    plan = (org.subscription_plan or "starter").strip().lower() if org else "starter"
    tiers = {
        "starter": (60, 1_500),
        "pro": (400, 50_000),
        "enterprise": (None, None),
    }
    gpu_min, credits = tiers.get(plan, tiers["starter"])
    return {
        "gpu_minutes_remaining": gpu_min,
        "translation_credits": credits,
    }


@router.get("/me")
def me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org = (
        db.query(Organization)
        .filter(Organization.id == current_user.organization_id)
        .first()
    )
    user_payload = _user_public(current_user, org.name if org else "")
    if getattr(current_user, "created_at", None) is not None:
        user_payload["created_at"] = (
            current_user.created_at.isoformat()
            if hasattr(current_user.created_at, "isoformat")
            else str(current_user.created_at)
        )

    org_payload = None
    if org:
        org_payload = {
            "id": org.id,
            "name": org.name,
            "subscription_plan": org.subscription_plan,
            "max_seats": org.max_seats,
        }
        if getattr(org, "created_at", None) is not None:
            org_payload["created_at"] = (
                org.created_at.isoformat()
                if hasattr(org.created_at, "isoformat")
                else str(org.created_at)
            )

    return {
        "user": user_payload,
        "organization": org_payload,
        "usage": _usage_snapshot(org),
    }


@router.patch("/me")
def update_me(
    body: MeUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.full_name = body.full_name.strip()
    db.commit()
    db.refresh(current_user)
    org = (
        db.query(Organization)
        .filter(Organization.id == current_user.organization_id)
        .first()
    )
    return {"user": _user_public(current_user, org.name if org else "")}


@router.post("/change-password")
def change_password(
    body: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.hashed_password = hash_password(body.new_password)
    db.commit()
    return {"ok": True}
