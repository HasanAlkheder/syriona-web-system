// src/pages/SettingsPage.jsx
import React, { useState } from "react";

export default function SettingsPage() {
  const [apiUrl, setApiUrl] = useState("http://localhost:8000");

  return (
    <div>
      <h2 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.75rem" }}>
        Settings
      </h2>
      <p style={{ fontSize: "0.9rem", color: "#4b5563", marginBottom: "1.2rem" }}>
        Here you can configure backend connection and developer options.
      </p>

      <div
        style={{
          maxWidth: "480px",
          background: "#ffffff",
          padding: "1rem 1.25rem",
          borderRadius: "0.75rem",
          border: "1px solid #e5e7eb",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        <div>
          <label style={{ fontSize: "0.8rem", color: "#4b5563" }}>Backend API URL</label>
          <input
            type="text"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem 0.6rem",
              borderRadius: "0.5rem",
              border: "1px solid #d1d5db",
              marginTop: "0.25rem",
            }}
          />
        </div>

        <p style={{ fontSize: "0.8rem", color: "#6b7280" }}>
          (Later we can store this in local storage and use it for API requests.)
        </p>
      </div>
    </div>
  );
}
