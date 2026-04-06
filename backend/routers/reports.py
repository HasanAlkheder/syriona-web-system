"""Aggregates for Reports & Analytics (real DB data)."""

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Date, cast, func
from sqlalchemy.orm import Session

from deps import get_current_user, get_db
from models.episode import Episode
from models.project import Project
from models.sentence import Sentence
from models.translation import Translation
from models.user import User
from services.org_access import project_ids_for_org

router = APIRouter(prefix="/reports", tags=["reports"])


_ALLOWED_EPISODE_STATUS = {"all", "new", "not_started", "in_progress", "done", "on_hold"}


def _parse_iso_day(value: str | None) -> date | None:
    if not value:
        return None
    raw = value.strip()
    if not raw:
        return None
    try:
        return date.fromisoformat(raw)
    except ValueError:
        return None


def _empty_payload() -> dict:
    return {
        "project_count": 0,
        "episode_count": 0,
        "sentence_count": 0,
        "translation_row_count": 0,
        "dubbed_sentence_count": 0,
        "completion_rate": 0.0,
        "weekly_translations": [],
        "episode_progress": [],
    }


@router.get("/analytics")
def reports_analytics(
    date_range: str = Query("7d"),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    project_id: int | None = Query(None),
    episode_status: str = Query("all"),
    assignee_id: int | None = Query(None),
    source_language: str | None = Query(None),
    target_language: str | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    pids = project_ids_for_org(db, user.organization_id)
    if not pids:
        return _empty_payload()

    projects_q = db.query(Project.id).filter(Project.id.in_(pids))

    if project_id is not None:
        projects_q = projects_q.filter(Project.id == project_id)
    if assignee_id is not None:
        projects_q = projects_q.filter(Project.assigned_to_user_id == assignee_id)
    if source_language:
        projects_q = projects_q.filter(Project.source_language == source_language)
    if target_language:
        projects_q = projects_q.filter(Project.target_language == target_language)

    filtered_pids = [pid for (pid,) in projects_q.all()]
    if not filtered_pids:
        return _empty_payload()

    ep_status = (episode_status or "all").strip().lower()
    if ep_status not in _ALLOWED_EPISODE_STATUS:
        ep_status = "all"

    episodes_base = db.query(Episode.id).filter(Episode.project_id.in_(filtered_pids))
    if ep_status != "all":
        episodes_base = episodes_base.filter(Episode.status == ep_status)
    filtered_eids = [eid for (eid,) in episodes_base.all()]

    project_count = len(filtered_pids)
    episode_count = len(filtered_eids)

    if not filtered_eids:
        payload = _empty_payload()
        payload["project_count"] = project_count
        return payload

    sentence_count = (
        db.query(Sentence)
        .filter(Sentence.episode_id.in_(filtered_eids))
        .count()
    )

    translation_row_count = (
        db.query(Translation)
        .join(Sentence, Translation.sentence_id == Sentence.id)
        .filter(Sentence.episode_id.in_(filtered_eids))
        .count()
    )

    dubbed_sentence_count = (
        db.query(func.count(func.distinct(Translation.sentence_id)))
        .select_from(Translation)
        .join(Sentence, Translation.sentence_id == Sentence.id)
        .filter(Sentence.episode_id.in_(filtered_eids))
        .filter(Translation.translated_text.isnot(None))
        .filter(Translation.translated_text != "")
        .scalar()
        or 0
    )

    completion_rate = (
        round(100.0 * float(dubbed_sentence_count) / float(sentence_count), 1)
        if sentence_count > 0
        else 0.0
    )

    utc_today = datetime.now(timezone.utc).date()
    parsed_start = _parse_iso_day(start_date)
    parsed_end = _parse_iso_day(end_date)

    if parsed_start and parsed_end:
        if parsed_start <= parsed_end:
            start_day, end_day = parsed_start, parsed_end
        else:
            start_day, end_day = parsed_end, parsed_start
    else:
        key = (date_range or "7d").strip().lower()
        days_map = {"7d": 7, "30d": 30, "90d": 90}
        span_days = days_map.get(key, 7)
        end_day = utc_today
        start_day = end_day - timedelta(days=span_days - 1)

    start_naive = datetime.combine(start_day, datetime.min.time())
    end_naive_exclusive = datetime.combine(end_day + timedelta(days=1), datetime.min.time())

    day_rows = (
        db.query(
            cast(Translation.created_at, Date).label("d"),
            func.count(Translation.id).label("cnt"),
        )
        .select_from(Translation)
        .join(Sentence, Translation.sentence_id == Sentence.id)
        .filter(Sentence.episode_id.in_(filtered_eids))
        .filter(Translation.created_at >= start_naive)
        .filter(Translation.created_at < end_naive_exclusive)
        .group_by(cast(Translation.created_at, Date))
        .all()
    )
    count_by_day = {row.d: int(row.cnt) for row in day_rows if row.d is not None}

    weekly_translations = []
    d = start_day
    while d <= end_day:
        span = (end_day - start_day).days + 1
        if span <= 10:
            name = d.strftime("%a")
        elif span <= 40:
            name = d.strftime("%b %d")
        else:
            name = d.strftime("%m/%d")
        weekly_translations.append(
            {
                "name": name,
                "full_date": d.isoformat(),
                "lines": count_by_day.get(d, 0),
            }
        )
        d += timedelta(days=1)

    episode_rows = (
        db.query(Episode)
        .filter(Episode.id.in_(filtered_eids))
        .order_by(Episode.id.desc())
        .limit(18)
        .all()
    )

    episode_progress = []
    for ep in episode_rows:
        total = (
            db.query(func.count(Sentence.id))
            .filter(Sentence.episode_id == ep.id)
            .scalar()
            or 0
        )
        if total == 0:
            continue

        dubbed = (
            db.query(func.count(func.distinct(Translation.sentence_id)))
            .join(Sentence, Translation.sentence_id == Sentence.id)
            .filter(Sentence.episode_id == ep.id)
            .filter(Translation.translated_text.isnot(None))
            .filter(Translation.translated_text != "")
            .scalar()
            or 0
        )

        pct = round(100.0 * float(dubbed) / float(total), 1)
        ep_part = f"Ep {ep.episode_number}" if ep.episode_number is not None else f"#{ep.id}"
        title_short = (ep.title or "")[:22]
        label = f"{ep_part}: {title_short}" if title_short else ep_part
        episode_progress.append(
            {
                "episode_id": ep.id,
                "name": label,
                "progress": pct,
                "lines_total": int(total),
                "lines_dubbed": int(dubbed),
            }
        )

    episode_progress.reverse()

    return {
        "project_count": project_count,
        "episode_count": episode_count,
        "sentence_count": sentence_count,
        "translation_row_count": translation_row_count,
        "dubbed_sentence_count": int(dubbed_sentence_count),
        "completion_rate": completion_rate,
        "weekly_translations": weekly_translations,
        "episode_progress": episode_progress,
    }
