export default function ExportTab({ characters, dubbingLines }) {
  return (
    <div>
      {/* ===== Title ===== */}
      <h3
        style={{
          fontSize: "1.25rem",
          fontWeight: 700,
          marginBottom: "6px",
          color: "#111827",
        }}
      >
        Export
      </h3>

      <p
        style={{
          color: "#6B7280",
          marginBottom: "26px",
          fontSize: "0.9rem",
        }}
      >
        Choose the format required by the studio or production pipeline.
      </p>

      {/* ===== Export Options ===== */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "22px",
          maxWidth: "900px",
        }}
      >
        <ExportCard
          icon="📄"
          title="Dialogue Sheet"
          format="CSV / Excel"
          description="Editable dialogue sheet for translators, reviewers, and directors."
          hint="Best for linguistic review & QA"
          onExport={() => alert("Export CSV / Excel")}
        />

        <ExportCard
          icon="🎬"
          title="Subtitles"
          format="SRT"
          description="Subtitle format with timing for preview and quality checks."
          hint="Used by editors & preview teams"
          onExport={() => alert("Export SRT")}
        />

        <ExportCard
          icon="🎙️"
          title="Dubbing / TTS"
          format="JSON"
          description="Structured format for dubbing pipelines and TTS engines."
          hint="Used for automation & voice systems"
          onExport={() => alert("Export JSON")}
        />
      </div>
    </div>
  );
}

/* ================= EXPORT CARD ================= */

function ExportCard({
  icon,
  title,
  format,
  description,
  hint,
  onExport,
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderRadius: "16px",
        padding: "18px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxShadow: "0 4px 10px rgba(0,0,0,0.04)",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.transform = "translateY(-2px)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.transform = "translateY(0)")
      }
    >
      {/* Header */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "8px",
          }}
        >
          <span style={{ fontSize: "1.6rem" }}>{icon}</span>

          <div>
            <h4
              style={{
                fontSize: "1rem",
                fontWeight: 600,
                color: "#111827",
                margin: 0,
              }}
            >
              {title}
            </h4>

            <span
              style={{
                fontSize: "0.75rem",
                color: "#2563EB",
                fontWeight: 600,
              }}
            >
              {format}
            </span>
          </div>
        </div>

        <p
          style={{
            fontSize: "0.85rem",
            color: "#374151",
            marginBottom: "10px",
          }}
        >
          {description}
        </p>

        <p
          style={{
            fontSize: "0.75rem",
            color: "#6B7280",
          }}
        >
          {hint}
        </p>
      </div>

      {/* Action */}
      <button
        onClick={onExport}
        style={{
          marginTop: "18px",
          padding: "11px",
          borderRadius: "10px",
          border: "none",
          background: "#2563EB",
          color: "#FFFFFF",
          fontWeight: 600,
          cursor: "pointer",
          fontSize: "0.85rem",
        }}
      >
        Export
      </button>
    </div>
  );
}
