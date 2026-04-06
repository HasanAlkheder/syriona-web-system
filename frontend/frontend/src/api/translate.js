const API_BASE = "http://localhost:8000/api"; // FastAPI later

export async function translateSingle(payload) {
  const res = await fetch(`${API_BASE}/translate/single`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Translation failed");
  }

  return res.json();
}

export async function translateBatch(rows) {
  const res = await fetch(`${API_BASE}/translate/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Batch translation failed");
  }

  return res.json();
}
