from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import Base, SessionLocal, engine
from bootstrap import ensure_default_organization, ensure_demo_user
from migrate_auth_schema import (
    ensure_auth_schema,
    ensure_episode_assignee_column,
    ensure_episode_workflow_columns,
    ensure_project_assignee_column,
    ensure_project_deleted_at_column,
    ensure_project_status_column,
    ensure_project_updated_at_column,
    ensure_sentence_timing_columns,
)
from models.organization import Organization
from models.user import User

# Import modules so every model registers on Base before create_all (FK order).
import models.character  # noqa: F401
import models.episode  # noqa: F401
import models.project  # noqa: F401
import models.sentence  # noqa: F401
import models.translation  # noqa: F401
import models.translation_job  # noqa: F401
from routers import (
    auth,
    sentences,
    translation,
    characters,
    episodes,
    projects,
    upload,
    dashboard,
    reports,
    users,
)

app = FastAPI()


@app.on_event("startup")
def ensure_schema_and_default_org():
    ensure_auth_schema(engine)
    ensure_project_status_column(engine)
    ensure_project_updated_at_column(engine)
    ensure_project_deleted_at_column(engine)
    ensure_episode_workflow_columns(engine)
    ensure_project_assignee_column(engine)
    ensure_episode_assignee_column(engine)
    ensure_sentence_timing_columns(engine)
    # Create application tables in FK order (e.g. episodes before translation_jobs).
    Base.metadata.create_all(bind=engine, checkfirst=True)
    db = SessionLocal()
    try:
        ensure_default_organization(db)
        ensure_demo_user(db)
    finally:
        db.close()


# ================= CORS =================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================= ROUTES =================


@app.get("/")
def root():
    return {"message": "Syriona backend running"}


app.include_router(auth.router)
app.include_router(sentences.router)
app.include_router(translation.router)
app.include_router(characters.router)
app.include_router(episodes.router)
app.include_router(projects.router)
app.include_router(upload.router)
app.include_router(dashboard.router)
app.include_router(reports.router)
app.include_router(users.router)
