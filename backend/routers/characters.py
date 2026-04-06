from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import json

from deps import get_current_user, get_db
from models.character import Character
from models.user import User
from schemas.character import CharacterCreate, CharacterResponse
from services.org_access import require_character_in_org, require_project_in_org

router = APIRouter(prefix="/characters", tags=["characters"])


@router.get("/project/{project_id}", response_model=list[CharacterResponse])
def get_characters(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_project_in_org(db, project_id, user.organization_id)
    characters = db.query(Character).filter(Character.project_id == project_id).all()
    result = []
    for c in characters:
        result.append(
            {
                "id": c.id,
                "name": c.name,
                "gender": c.gender,
                "description": json.loads(c.description) if c.description else [],
            }
        )
    return result


@router.post("/")
def create_characters(
    chars: list[CharacterCreate],
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    saved = 0
    for c in chars:
        require_project_in_org(db, c.project_id, user.organization_id)
        existing = (
            db.query(Character)
            .filter_by(name=c.name, project_id=c.project_id)
            .first()
        )
        if existing:
            existing.gender = c.gender
            existing.description = json.dumps(c.description)
        else:
            new_char = Character(
                project_id=c.project_id,
                name=c.name,
                gender=c.gender,
                description=json.dumps(c.description),
            )
            db.add(new_char)
            saved += 1
    db.commit()
    return {"status": "saved", "count": saved}


@router.patch("/{character_id}")
def update_character(
    character_id: int,
    data: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = require_character_in_org(db, character_id, user.organization_id)
    if data.get("name") is not None:
        row.name = data["name"]
    if data.get("gender") is not None:
        row.gender = data["gender"]
    if "description" in data:
        desc = data["description"]
        row.description = json.dumps(desc if isinstance(desc, list) else [])
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "name": row.name,
        "gender": row.gender,
        "description": json.loads(row.description) if row.description else [],
    }


@router.delete("/{character_id}")
def delete_character(
    character_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = require_character_in_org(db, character_id, user.organization_id)
    db.delete(row)
    db.commit()
    return {"ok": True, "id": character_id}
