import { useState, useEffect } from "react";
import { apiFetch } from "../api/client";
import AssigneeSelect from "../components/AssigneeSelect";

export default function CreateProjectPage({ onDone }) {
  const [projectName, setProjectName] = useState("");
  const [seriesAbstract, setSeriesAbstract] = useState("");
  const [category, setCategory] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("Turkish");
  const [targetLanguage, setTargetLanguage] = useState("Syrian Arabic");

  const [loading, setLoading] = useState(false);
  const [orgMembers, setOrgMembers] = useState([]);
  const [assigneeId, setAssigneeId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/users/");
        const data = res.ok ? await res.json() : [];
        if (!cancelled) setOrgMembers(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setOrgMembers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate() {
    if (!projectName.trim() || loading) return;

    setLoading(true);

    try {
      const res = await apiFetch("/projects/", {
        method: "POST",
        body: JSON.stringify({
          name: projectName,
          category: category,
          source_language: sourceLanguage,
          target_language: targetLanguage,
          description: seriesAbstract,
          assigned_to_user_id: assigneeId,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create project");
      }

      const data = await res.json();

      console.log("Saved project:", data);

      // Reset form
      setProjectName("");
      setSeriesAbstract("");
      setCategory("");
      setSourceLanguage("Turkish");
      setTargetLanguage("Syrian Arabic");
      setAssigneeId(null);

      // If parent handles refresh/navigation
      if (onDone) {
        onDone(data);
      } else {
        // Fallback: force refresh (important)
        window.location.reload();
      }

    } catch (error) {
      console.error("Error creating project:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2
        style={{
          fontSize: "1.5rem",
          fontWeight: 600,
          color: "#111827",
          marginBottom: "20px",
        }}
      >
        Create New Project
      </h2>

      <div
        style={{
          maxWidth: "520px",
          background: "#ffffff",
          padding: "24px",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
        }}
      >
        <label style={labelStyle}>Series Name</label>
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          style={inputStyle}
        />

        <label style={labelStyle}>Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={inputStyle}
        >
          <option value="">Select category</option>
          <option value="Drama">Drama</option>
          <option value="Action">Action</option>
          <option value="Romance">Romance</option>
          <option value="Comedy">Comedy</option>
          <option value="Historical">Historical</option>
          <option value="Crime">Crime</option>
        </select>

        <div style={{ marginTop: "14px" }}>
          <AssigneeSelect
            id="create-page-assignee"
            label="Assign to (optional)"
            value={assigneeId}
            members={orgMembers}
            onChange={setAssigneeId}
            selectStyle={{ ...inputStyle, marginTop: 0 }}
          />
        </div>

        <label style={labelStyle}>Source Language</label>
        <select
          value={sourceLanguage}
          onChange={(e) => setSourceLanguage(e.target.value)}
          style={inputStyle}
        >
          <option>Turkish</option>
          <option>English</option>
          <option>Arabic</option>
        </select>

        <label style={labelStyle}>Target Language</label>
        <select
          value={targetLanguage}
          onChange={(e) => setTargetLanguage(e.target.value)}
          style={inputStyle}
        >
          <option>Syrian Arabic</option>
          <option>Arabic</option>
          <option>English</option>
        </select>

        <label style={labelStyle}>Abstract (optional)</label>
        <p style={hintStyle}>
          Short synopsis of the series or film — used as context when GPT translates
          dialogue (tone, setting, relationships).
        </p>
        <textarea
          value={seriesAbstract}
          onChange={(e) => setSeriesAbstract(e.target.value)}
          rows={4}
          placeholder="e.g. Family drama set in Istanbul; two brothers feud over the business…"
          style={{
            ...inputStyle,
            resize: "vertical",
          }}
        />

        <button
          onClick={handleCreate}
          disabled={!projectName.trim() || loading}
          style={{
            marginTop: "20px",
            padding: "12px 20px",
            borderRadius: "10px",
            border: "none",
            background:
              projectName.trim() && !loading ? "#2563EB" : "#9CA3AF",
            color: "#ffffff",
            fontWeight: 600,
            cursor:
              projectName.trim() && !loading
                ? "pointer"
                : "not-allowed",
          }}
        >
          {loading ? "Creating..." : "Create Project"}
        </button>
      </div>
    </div>
  );
}

/* styles unchanged */

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  marginTop: "14px",
  fontSize: "0.9rem",
  fontWeight: 500,
  color: "#374151",
};

const hintStyle = {
  margin: "0 0 8px 0",
  fontSize: "0.8rem",
  lineHeight: 1.45,
  color: "#6B7280",
};

const inputStyle = {
  width: "100%",
  padding: "10px 16px",
  paddingRight: "20px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  fontSize: "0.9rem",
  outline: "none",
  boxSizing: "border-box",
};