// src/components/Footer.jsx
import React from "react";
import theme from "../styles/theme";

export default function Footer() {
  return (
    <footer
      style={{
        flexShrink: 0,
        width: "100%",
        background: theme.colors.primary,
        color: theme.colors.textLight,
        padding: "12px 20px",
        fontSize: "0.85rem",
        textAlign: "center",
      }}
    >
      © {new Date().getFullYear()} Syriona — All Rights Reserved
    </footer>
  );
}
