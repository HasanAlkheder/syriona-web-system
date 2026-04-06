// src/components/Logo.jsx
import React from "react";
import logo from "../assets/Syriona Logo - Blue.png";

export default function Logo({ size = 54 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "12px",
        background: "#FFFFFF", // White background to make logo visible
        padding: "6px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
      }}
    >
      <img
        src={logo}
        alt="Syriona Logo"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
      />
    </div>
  );
}
