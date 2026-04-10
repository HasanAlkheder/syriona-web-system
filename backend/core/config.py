import os
from dotenv import load_dotenv

load_dotenv()

# PostgreSQL connection. Set on the server (e.g. in .env or the host env) to your production DB.
# Local default matches the previous hardcoded URL so existing setups keep working.
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:Saad1231231.@localhost:1188/syriona",
)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Dialogue translation (dubbing). Override if your key does not have access yet.
OPENAI_TRANSLATION_MODEL = os.getenv("OPENAI_TRANSLATION_MODEL", "gpt-5.4")
# Optional cheaper model for episode/batch jobs only (single-line /retranslate uses OPENAI_TRANSLATION_MODEL).
OPENAI_TRANSLATION_MODEL_BULK = (os.getenv("OPENAI_TRANSLATION_MODEL_BULK") or "").strip()

# Context size vs API cost (each sentence = one chat completion; input tokens dominate).
# Defaults below are tuned for roughly ~$0.005/line on a flagship-class model with your
# current prompt size (empirical: ~$0.0048/line at ~165 lines). Raise all four for stronger
# continuity; lower further only if you need cheaper bulk.
TRANSLATION_PRIOR_EPISODES_CHAR_BUDGET = int(
    os.getenv("TRANSLATION_PRIOR_EPISODES_CHAR_BUDGET", "3200")
)
TRANSLATION_INTRA_EPISODE_MAX_LINES = int(
    os.getenv("TRANSLATION_INTRA_EPISODE_MAX_LINES", "10")
)
TRANSLATION_INTRA_EPISODE_CHAR_BUDGET = int(
    os.getenv("TRANSLATION_INTRA_EPISODE_CHAR_BUDGET", "2200")
)
# How many recent prior rows include "Arabic dub so far" (more = better thread, more tokens).
TRANSLATION_INTRA_ARABIC_HINT_LINES = int(
    os.getenv("TRANSLATION_INTRA_ARABIC_HINT_LINES", "3")
)

# Auth (set SECRET_KEY in production)
SECRET_KEY = os.getenv("SECRET_KEY", "dev-insecure-change-me-use-openssl-rand-hex-32")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))