from openai import OpenAI
from sqlalchemy import func
from sqlalchemy.orm import Session
import json
from typing import Any, Optional, Tuple

from core.config import (
    OPENAI_API_KEY,
    OPENAI_TRANSLATION_MODEL,
    OPENAI_TRANSLATION_MODEL_BULK,
    TRANSLATION_INTRA_ARABIC_HINT_LINES,
    TRANSLATION_INTRA_EPISODE_CHAR_BUDGET,
    TRANSLATION_INTRA_EPISODE_MAX_LINES,
    TRANSLATION_PRIOR_EPISODES_CHAR_BUDGET,
)
from models.character import Character
from models.episode import Episode
from models.project import Project
from models.sentence import Sentence
from models.translation import Translation

client = OpenAI(api_key=OPENAI_API_KEY)

# Prompt size guards (approx. characters). Tunable via env in core.config.
PRIOR_EPISODE_MIN_BLOCK = 200


def _load_episode_project_context(
    db: Session, episode_id: Optional[int]
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Returns (series_abstract, project_target_language, project_source_language)."""
    if not episode_id:
        return None, None, None
    ep = db.query(Episode).filter(Episode.id == episode_id).first()
    if not ep:
        return None, None, None
    proj = db.query(Project).filter(Project.id == ep.project_id).first()
    if not proj:
        return None, None, None
    abstract = (proj.description or "").strip() or None
    pt = (proj.target_language or "").strip() or None
    src = (proj.source_language or "").strip() or None
    return abstract, pt, src


def _target_is_syrian_colloquial(target_language: str) -> bool:
    t = (target_language or "").lower()
    return "syrian" in t or "شامي" in (target_language or "") or "سوري" in (target_language or "")


def _dialect_instructions(target_language: str) -> str:
    if _target_is_syrian_colloquial(target_language):
        return """
TARGET VARIETY (non-negotiable):
- Output must be colloquial Syrian Arabic (عامية شامية — Damascus / Syrian Levantine), as used in contemporary Syrian dubbing of TV series.
- Do NOT use Palestinian, Jordanian, Lebanese, Egyptian, Gulf, or Modern Standard Arabic (فصحى) unless the source line is already MSA/news/formal and the scene clearly requires it.
- Avoid telltale non-Syrian choices when a Syrian form exists (e.g. prefer Syrian-typical particles, pronouns, and 2nd-person forms; do not default to Cairo or Beirut phrasing).
- Keep vocabulary and syntax consistent with Syrian Levantine for the entire line.
- Spoken rhythm: short, punchy clauses when the source is abrupt; natural pauses and particles (شو، ليك، يعني، بقى، هلق، طيب) where they help performance — not as filler every line.
- Re-use the same Arabic wording for recurring names, nicknames, and relationship terms already established in "Arabic dub so far" or earlier-episode context.
"""
    return f"""
TARGET VARIETY:
- Natural spoken {target_language}, consistent with how that locale dubs TV dialogue — not literal word-for-word calques from the source.
"""


def _source_language_hints(source_language_hint: str) -> str:
    """Extra guidance for frequent source languages (reduces calques and missed implicature)."""
    s = (source_language_hint or "").strip().lower()
    if "turkish" in s or "türk" in s:
        return """
SOURCE LANGUAGE — TURKISH (when the line is Turkish):
- Turkish often drops the subject; recover **who did what** from the recent-dialogue block and scene logic, then express it clearly in Arabic without sounding like a grammar drill.
- Tag questions and particles (*değil mi*, *ya*, *hani*, *işte*, *yani*) → natural Syrian equivalents (*مو؟*, *مش هيك؟*, *صح؟*, *يعني*, *بقى*…) matching the emotion, not literal glosses.
- *-dığında/-ince* (when/since) time clauses: natural Syrian time order and connectors (لما، من يوم ما، وقت ما…) — avoid stiff calques.
- Do **not** mirror Turkish SOV word order in Arabic; reshape into how a Syrian actor would say the line aloud.
- If a line looks like a typo for a common expression (e.g. *yüzünde* vs *yüzünden*), prefer the **meaning that fits the thread** over a nonsensical literal reading.
"""
    return ""


def _speaker_meta(db: Session, s: Sentence) -> Tuple[str, str]:
    name = ((s.character_name or "").strip() or "?")
    gender = ((s.gender or "").strip() or "?")
    if s.character_id:
        ch = db.query(Character).filter(Character.id == s.character_id).first()
        if ch:
            if name == "?" and (ch.name or "").strip():
                name = (ch.name or "").strip()
            if gender == "?" and (ch.gender or "").strip():
                gender = (ch.gender or "").strip()
    return name, gender


def _ordered_episodes_for_project(db: Session, project_id: int) -> list:
    eps = (
        db.query(Episode)
        .filter(Episode.project_id == project_id)
        .order_by(Episode.id)
        .all()
    )

    def sort_key(e: Episode) -> tuple:
        en = e.episode_number
        if en is not None:
            return (0, en, e.id)
        return (1, e.id, e.id)

    return sorted(eps, key=sort_key)


def _prior_episodes_in_series(db: Session, current: Episode) -> list:
    if not current.project_id:
        return []
    ordered = _ordered_episodes_for_project(db, current.project_id)
    idx = next((i for i, e in enumerate(ordered) if e.id == current.id), None)
    if idx is None:
        return []
    return ordered[:idx]


def _format_episode_source_excerpt(
    db: Session, sents: list, char_budget: int
) -> str:
    if not sents:
        return "(no dialogue lines stored for this episode yet)\n"
    lines_full: list[str] = []
    for s in sents:
        nm, gen = _speaker_meta(db, s)
        lines_full.append(f"{nm} ({gen}): {(s.source_text or '').strip()}")
    blob = "\n".join(lines_full)
    if len(blob) <= char_budget:
        return blob + "\n"
    head_n = 2
    head = "\n".join(lines_full[:head_n])
    tail_budget = max(120, char_budget - len(head) - 80)
    tail_lines: list[str] = []
    acc = 0
    for line in reversed(lines_full[head_n:]):
        if acc + len(line) + 1 > tail_budget:
            break
        tail_lines.append(line)
        acc += len(line) + 1
    tail_lines.reverse()
    tail = "\n".join(tail_lines)
    return f"{head}\n(… middle of episode omitted …)\n{tail}\n"


def _build_prior_episodes_excerpt(
    db: Session,
    prior_episodes: list,
    *,
    budget: int,
) -> Optional[str]:
    """Compact source-side recap of earlier episodes (same project), before current."""
    if not prior_episodes:
        return None
    n = len(prior_episodes)
    per_cap = max(
        PRIOR_EPISODE_MIN_BLOCK,
        min(1800, budget // max(1, n)),
    )
    blocks: list[str] = []
    remaining = budget
    for ep in prior_episodes:
        cap = min(per_cap, remaining - 40)
        if cap < PRIOR_EPISODE_MIN_BLOCK:
            break
        num = ep.episode_number
        num_s = str(num) if num is not None else "?"
        header = f"—— Episode #{num_s}: {ep.title} ——\n"
        sents = (
            db.query(Sentence)
            .filter(Sentence.episode_id == ep.id)
            .order_by(Sentence.id)
            .all()
        )
        body = _format_episode_source_excerpt(db, sents, cap - len(header))
        block = header + body
        blocks.append(block)
        remaining -= len(block)
    if not blocks:
        return None
    intro = (
        "The following is SOURCE dialogue from earlier episodes in this series "
        "(same project). Use it for continuity: relationships, running gags, facts, "
        "tone, and how characters address each other. Do NOT copy these lines into "
        "your output; translate ONLY the current source line below.\n\n"
    )
    return intro + "\n".join(blocks)


def _build_intra_episode_recent_excerpt(
    db: Session,
    sentence: Sentence,
    *,
    max_lines: int,
    max_chars: int,
) -> Optional[str]:
    """Recent lines in the current episode before this sentence (chronological)."""
    if not sentence.episode_id:
        return None
    rows = (
        db.query(Sentence)
        .filter(
            Sentence.episode_id == sentence.episode_id,
            Sentence.id < sentence.id,
        )
        .order_by(Sentence.id.desc())
        .limit(max_lines)
        .all()
    )
    if not rows:
        return None
    rows_chrono = list(reversed(rows))
    chunks: list[str] = []
    for i, s in enumerate(rows_chrono):
        nm, gen = _speaker_meta(db, s)
        chunk = f"- {nm} ({gen}): {(s.source_text or '').strip()}"
        # Include target-language tail so the model continues the same thread (not isolated lines).
        lines_with_ar_hint = max(0, TRANSLATION_INTRA_ARABIC_HINT_LINES)
        if lines_with_ar_hint and i >= len(rows_chrono) - lines_with_ar_hint:
            tr = (
                db.query(Translation)
                .filter(Translation.sentence_id == s.id)
                .order_by(Translation.version.desc())
                .first()
            )
            if tr and (tr.translated_text or "").strip():
                ar = (tr.translated_text or "").strip()
                if len(ar) > 120:
                    ar = ar[:117].rstrip() + "…"
                chunk += f"\n  (Arabic dub so far: {ar})"
        chunks.append(chunk)
    blob = "\n".join(chunks)
    if len(blob) <= max_chars:
        return blob
    while len(blob) > max_chars and len(chunks) > 1:
        chunks.pop(0)
        chunks.insert(0, "(…earlier lines in this episode omitted…)")
        blob = "\n".join(chunks)
    if len(blob) > max_chars:
        return blob[: max_chars - 1].rstrip() + "…"
    return blob


def _format_series_progression_section(
    excerpt: Optional[str],
    *,
    source_language_hint: str,
) -> str:
    if not excerpt:
        return f"""
SERIES PROGRESSION — EARLIER EPISODES:
(No earlier episode dialogue is bundled for this line — this may be Episode 1 or data is missing. Rely on the series synopsis and the current-episode excerpt.)
"""
    return f"""
SERIES PROGRESSION — EARLIER EPISODES (source {source_language_hint} dialogue only — background for continuity; translate only the current line below):
{excerpt}
"""


def _format_intra_episode_section(
    excerpt: Optional[str],
    *,
    source_language_hint: str,
) -> str:
    if not excerpt:
        return f"""
CURRENT EPISODE — LINES SO FAR BEFORE THIS ONE ({source_language_hint}):
(This is the first line of this episode in export order — there is no prior line in this episode.)
"""
    return f"""
CURRENT EPISODE — RECENT DIALOGUE BEFORE THIS LINE (same episode; read in order; newest at bottom):
{excerpt}
"""


# ================= SINGLE TRANSLATION =================

def translate_text(
    text: str,
    target_language: str,
    character_name: str,
    gender: str,
    traits: list,
    *,
    series_abstract: Optional[str] = None,
    source_language_hint: str = "Turkish",
    series_progression_excerpt: Optional[str] = None,
    intra_episode_excerpt: Optional[str] = None,
    model: Optional[str] = None,
):
    traits_text = ", ".join(traits) if traits else "neutral"

    abstract_block = (
        series_abstract.strip()
        if series_abstract and series_abstract.strip()
        else ""
    )
    if abstract_block:
        abstract_section = f"""
SERIES / PROJECT CONTEXT (synopsis — use for tone, relationships, setting, and register; do NOT copy phrases verbatim into the translation unless they fit the line):
\"\"\"
{abstract_block}
\"\"\"
"""
    else:
        abstract_section = """
SERIES / PROJECT CONTEXT:
(No synopsis was provided — infer tone only from the line and character profile.)
"""

    series_section = _format_series_progression_section(
        series_progression_excerpt,
        source_language_hint=source_language_hint,
    )
    intra_section = _format_intra_episode_section(
        intra_episode_excerpt,
        source_language_hint=source_language_hint,
    )

    src_lang_extra = _source_language_hints(source_language_hint)
    dialect_block = _dialect_instructions(target_language)

    # Long stable prefix first (synopsis + prior-episodes excerpt + static rules) so providers can
    # apply prompt caching across consecutive lines in the same episode.
    prompt_stable = f"""
You translate TV/film dialogue from {source_language_hint} into {target_language} for **dubbing a serialized drama**. The show is one continuous story: episode order and series-wide memory matter.

{abstract_section}
{series_section}
{dialect_block}
{src_lang_extra}
Meaning and performance (critical):
- Translate **what the line does in the scene** (accuse, beg, joke, dodge, threaten, comfort), not a dictionary gloss. Preserve **illocutionary force**: a harsh insult stays harsh (within broadcast register); sarcasm stays sarcastic.
- Idioms and figurative language: find a **Syrian-spoken equivalent** or natural paraphrase; do not explain or over-literalize.
- If the source is elliptical ("That!", "Never mind"), resolve it from **the prior turn** so the Arabic sounds complete to a listener who only hears the dub.

Consecutive lines are one thread (critical):
- Script lines follow each other in time: each line is the **next beat** in the same scene or exchange. Do not translate as if this were a standalone sentence on a flashcard.
- Use the whole "RECENT DIALOGUE" block in the section below (source order, newest at bottom) to keep **topic, pronouns, implied subjects, and emotional arc** consistent. A question answers the prior line; a follow-up refers to what was just said.
- When "Arabic dub so far" appears on earlier rows, **match that wording and tone** for the same thread (same scene, same argument, same joke) so the dub sounds like one conversation.

Series and episode continuity (critical):
- When "SERIES PROGRESSION — EARLIER EPISODES" is present, treat it as established canon for this project: ongoing relationships, prior conflicts, nicknames, facts, and speech habits. Do not contradict that material unless the current line clearly retcons it.
- The "CURRENT EPISODE — RECENT DIALOGUE" block is the immediate conversational thread: maintain natural turn-taking, pronouns, and emotional carry-over from those lines.
- The line at the **bottom** of the recent-dialogue list is the utterance spoken **immediately before** the source line you must translate; use it first for who is being answered.

Register and profanity (broadcast dubbing — critical):
- Target text must be suitable for **general-audience TV dubbing**: natural, emotional, and colloquial, but **do not escalate** mild or moderate source wording into harsh obscenities, slurs, or sexual/vulgar expletives.
- If the source uses ordinary words for "bad / terrible / awful / mess" (e.g. Turkish *berbat*, *kötü*), render the **same strength** in Arabic (e.g. سيء، فظيع، تعبان، وضع مو حلو) — **not** crude equivalents like scatological insults unless the source itself uses that level of vulgarity.
- Use strong language only when the source line **clearly** contains equivalent strong or taboo language; otherwise keep intensity without gratuitous profanity.

Dialogue coherence / addressee rules (critical):
- If the current line is a reply, reprimand, or direct address to the **last speaker in the recent-dialogue list**, Arabic 2nd-person pronouns, imperatives ("say…"), and predicates about "you" must agree with **that person's gender** (the addressee), not with the current speaker's gender.
- Example: Speaker A (male) speaks; Speaker B (female) replies addressing A → use Arabic 2nd-person forms matching a **male** addressee (e.g. أنت، قُل، سيء), not feminine إنتي، قولي، سيئة merely because B is female.
- If the line clearly addresses someone else or a group, follow that; in multi-party scenes use both the recent dialogue and earlier-episode context to pick the salient addressee.

Performance rules (general):
- Match personality: aggressive → sharp, direct; shy → softer, hesitant; etc.
- Avoid flat, textbook-neutral Arabic; the line must sound like performed dialogue.
- Dubbing length: keep the translation **roughly speakable in the same beat** as the source (not a long essay); if the source is one short burst, prefer one tight Arabic burst unless the language needs a few more words for clarity.
- Output ONE line only: the translated dialogue. No labels, no quotes around the whole utterance, no explanations, no JSON.

BAD (too neutral / flat): generic "مرحبا كيفك؟" when the character is angry or cold.
BAD (wrong addressee agreement): feminine إنتي/قولي when the interlocutor just established in the prior turn is male.
BAD (series amnesia): wording that ignores a bond, feud, or fact clearly shown in earlier-episode excerpts when this line depends on it.
BAD (disconnected thread): translation that ignores the immediately preceding line or contradicts the Arabic dub already shown for recent turns.
BAD (profanity creep): harsh vulgar Arabic for mild source complaints or insults.
GOOD: tone matches the profile and the Syrian (or requested) variety; 2nd person matches the addressee; dub feels continuous with prior episodes and prior lines; register fits broadcast dubbing.
""".strip()

    prompt_variable = f"""
=== CURRENT LINE (this section changes every request) ===
{intra_section}
CURRENT TURN (translate only this utterance into the target language):
Character profile (the person speaking this line, not necessarily the person being spoken to):
- Name: {character_name}
- Gender: {gender}
- Personality / traits: {traits_text}

Performance — agreement for this speaker:
- For the current speaker's own 1st-person narration ("I…"), verb/adjective agreement follows **this character's** gender: {gender}.

Source line ({source_language_hint}):
{text}
""".strip()

    prompt = f"{prompt_stable}\n\n{prompt_variable}"
    llm_model = (model or "").strip() or OPENAI_TRANSLATION_MODEL

    system = (
        "You are an expert TV and film dialogue translator for serialized dubbing. "
        "You use series-level and in-episode context when provided; consecutive lines are one ongoing conversation. "
        "You follow the requested Arabic variety exactly. "
        "You preserve scene force (emotion, sarcasm, stakes) in natural spoken phrasing, not literal calques. "
        "You keep broadcast-appropriate register: do not add harsh obscenities the source does not justify. "
        "You respond with only the translated line, nothing else."
    )

    response = client.chat.completions.create(
        model=llm_model,
        temperature=0.27,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
    )

    return response.choices[0].message.content.strip(), prompt


def translate_and_save_sentence(
    db: Session,
    sentence: Sentence,
    target_language: str = "Syrian Arabic",
    episode_context_cache: Optional[dict[int, Any]] = None,
    series_excerpt_cache: Optional[dict[int, str]] = None,
    *,
    prefer_bulk_model: bool = False,
) -> str:
    """
    Translate one sentence with character context and append a Translation row.
    Uses project synopsis (description) and languages when the sentence is linked to an episode.
    Optional episode_context_cache maps episode_id -> loaded context to avoid repeated DB reads in batch jobs.
    Optional series_excerpt_cache maps current episode_id -> pre-built "prior episodes" excerpt for that episode,
    reused for every line in the same episode (batch jobs).
    If prefer_bulk_model is True and OPENAI_TRANSLATION_MODEL_BULK is set, that model is used (episode jobs);
    single-line UI retranslate should leave prefer_bulk_model False.
    """
    character = None
    traits: list = []

    if sentence.character_id:
        character = (
            db.query(Character)
            .filter(Character.id == sentence.character_id)
            .first()
        )

        if character and character.description:
            try:
                traits = json.loads(character.description)
            except Exception:
                traits = []

    eid = sentence.episode_id
    if episode_context_cache is not None:
        if eid not in episode_context_cache:
            episode_context_cache[eid] = _load_episode_project_context(db, eid)
        abstract, pt, src_hint = episode_context_cache[eid]
    else:
        abstract, pt, src_hint = _load_episode_project_context(db, eid)

    effective_target = (pt or target_language or "Syrian Arabic").strip() or "Syrian Arabic"
    source_language_hint = (src_hint or "Turkish").strip() or "Turkish"

    ep_row: Optional[Episode] = None
    if eid:
        ep_row = db.query(Episode).filter(Episode.id == eid).first()

    prior_eps = _prior_episodes_in_series(db, ep_row) if ep_row else []
    series_progression_excerpt: Optional[str] = None
    if prior_eps and ep_row:
        if series_excerpt_cache is not None and ep_row.id in series_excerpt_cache:
            series_progression_excerpt = series_excerpt_cache[ep_row.id]
        else:
            series_progression_excerpt = _build_prior_episodes_excerpt(
                db,
                prior_eps,
                budget=TRANSLATION_PRIOR_EPISODES_CHAR_BUDGET,
            )
            if (
                series_excerpt_cache is not None
                and series_progression_excerpt is not None
            ):
                series_excerpt_cache[ep_row.id] = series_progression_excerpt
    intra_episode_excerpt = _build_intra_episode_recent_excerpt(
        db,
        sentence,
        max_lines=TRANSLATION_INTRA_EPISODE_MAX_LINES,
        max_chars=TRANSLATION_INTRA_EPISODE_CHAR_BUDGET,
    )

    llm_model = OPENAI_TRANSLATION_MODEL
    if prefer_bulk_model and OPENAI_TRANSLATION_MODEL_BULK:
        llm_model = OPENAI_TRANSLATION_MODEL_BULK

    translated, _ = translate_text(
        sentence.source_text,
        effective_target,
        character.name if character else "unknown",
        character.gender if character else "unknown",
        traits,
        series_abstract=abstract,
        source_language_hint=source_language_hint,
        series_progression_excerpt=series_progression_excerpt,
        intra_episode_excerpt=intra_episode_excerpt,
        model=llm_model,
    )

    save_translation(
        db,
        sentence.id,
        translated,
        target_language=effective_target,
        model_name=llm_model,
    )
    return translated


def translate_free_text(text: str, source_language: str, target_language: str) -> str:
    """
    Ad-hoc translation (no DB sentence). Used by the single-sentence lab UI.
    """
    if not OPENAI_API_KEY or not str(OPENAI_API_KEY).strip():
        raise ValueError("OPENAI_API_KEY is not configured on the server")

    prompt = f"""Translate the following text from {source_language} into {target_language}.
Preserve meaning, tone, and register (formal vs. colloquial) as appropriate for the target locale.
For dialogue, keep general-audience TV dubbing register: do not escalate mild wording into harsh obscenities unless the source clearly uses that level.
Output ONLY the translation. Do not add quotation marks around the whole text, labels, or explanations.

Source text:
{text}"""

    response = client.chat.completions.create(
        model=OPENAI_TRANSLATION_MODEL,
        temperature=0.28,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an expert translator. "
                    "You avoid gratuitous profanity when the source does not warrant it. "
                    "You respond with only the translated text, nothing else."
                ),
            },
            {"role": "user", "content": prompt},
        ],
    )

    return (response.choices[0].message.content or "").strip()


def gloss_source_for_review(
    text: str,
    source_language: str = "Turkish",
    gloss_language: str = "Modern Standard Arabic",
) -> str:
    """
    Direct translation of one source line into Modern Standard Arabic (فصحى) for
    comprehension while reviewing—not colloquial Syrian dubbing text.
    Output only the Arabic sentence(s), no explanations.
    """
    if not OPENAI_API_KEY or not str(OPENAI_API_KEY).strip():
        raise ValueError("OPENAI_API_KEY is not configured on the server")

    src = (source_language or "Turkish").strip() or "Turkish"

    prompt = f"""Translate this single dialogue line from {src} into Modern Standard Arabic (العربية الفصحى — MSA).

Output rules (strict):
- Output ONLY the Arabic translation. Nothing else: no English, no notes, no "translation:", no quotes around the whole string.
- Use formal MSA grammar and vocabulary suitable for understanding the meaning of the line.
- Do NOT use Levantine/Syrian colloquial (عامية), Egyptian, or Gulf dialect. This is for reading comprehension only, not for dubbing performance.
- Keep the same speaker attitude (angry, soft, etc.) but express it in MSA.

Line:
{text}"""

    response = client.chat.completions.create(
        model=OPENAI_TRANSLATION_MODEL,
        temperature=0.22,
        messages=[
            {
                "role": "system",
                "content": (
                    "You translate TV dialogue into Modern Standard Arabic only. "
                    "You output a single Arabic rendering of the line—no commentary, no other languages."
                ),
            },
            {"role": "user", "content": prompt},
        ],
    )

    return (response.choices[0].message.content or "").strip()


# ================= SAVE TRANSLATION =================

def save_translation(
    db,
    sentence_id,
    text,
    *,
    target_language: str = "Syrian Arabic",
    model_name: Optional[str] = None,
):

    last_version = (
        db.query(func.max(Translation.version))
        .filter(Translation.sentence_id == sentence_id)
        .scalar()
    )

    new_version = (last_version or 0) + 1

    translation = Translation(
        sentence_id=sentence_id,
        translated_text=text,
        version=new_version,
        model_name=model_name or OPENAI_TRANSLATION_MODEL,
        target_language=target_language or "Syrian Arabic",
    )

    db.add(translation)

    return translation 


# ================= BATCH (OPTIMIZED) =================

def call_llm_batch(db, sentences):

    results = []
    episode_context_cache: dict[int, Any] = {}
    series_excerpt_cache: dict[int, str] = {}

    for s in sentences:
        translated = translate_and_save_sentence(
            db,
            s,
            "Syrian Arabic",
            episode_context_cache=episode_context_cache,
            series_excerpt_cache=series_excerpt_cache,
            prefer_bulk_model=True,
        )
        results.append(translated)

    db.commit()

    return results
