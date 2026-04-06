/* eslint-disable react/prop-types -- internal form control */
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { PROJECT_CATEGORY_OPTIONS } from "../constants/projectCategories";

const optionBtn = {
  width: "100%",
  border: "none",
  background: "transparent",
  borderRadius: "9px",
  padding: "9px 10px",
  textAlign: "left",
  fontSize: "0.82rem",
  color: "#334155",
  cursor: "pointer",
  fontFamily: "inherit",
  fontWeight: 600,
};

const optionBtnActive = {
  background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
  color: "#3730A3",
  boxShadow: "inset 0 0 0 1px #C7D2FE",
};

/**
 * Custom category picker aligned with AssigneeSelect (chevron, floating list).
 */
export default function ProjectCategorySelect({
  id,
  label = "Category",
  value,
  onChange,
  disabled,
  selectStyle,
  hideLabel = false,
  options = PROJECT_CATEGORY_OPTIONS,
  placeholder = "Select category",
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const sid = id || "project-category-select";
  const trimmed = String(value ?? "").trim();
  const hasValue = Boolean(trimmed);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    function onEsc(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    window.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      window.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const currentLabel = hasValue ? trimmed : placeholder;

  return (
    <div
      ref={rootRef}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        minWidth: 0,
      }}
    >
      {!hideLabel && label ? (
        <label
          htmlFor={sid}
          style={{
            fontSize: "0.68rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "#64748B",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </label>
      ) : null}
      <div style={{ position: "relative", minWidth: 0 }}>
        <button
          id={sid}
          type="button"
          aria-expanded={open}
          aria-haspopup="listbox"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          title={hasValue ? trimmed : placeholder}
          style={{
            margin: 0,
            border: "1px solid #E2E8F0",
            borderRadius: "10px",
            outline: "none",
            padding: "8px 10px",
            fontSize: "0.84rem",
            fontWeight: 600,
            cursor: disabled ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            lineHeight: 1.2,
            background: "#FFFFFF",
            color: hasValue ? "#1e293b" : "#94A3B8",
            minWidth: "110px",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            textAlign: "left",
            ...selectStyle,
          }}
          aria-label={hideLabel ? label || "Category" : undefined}
        >
          <span
            style={{
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {currentLabel}
          </span>
          <ChevronDown
            size={16}
            style={{
              color: "#64748B",
              flexShrink: 0,
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
            }}
            aria-hidden
          />
        </button>
        {open && !disabled && (
          <div
            role="listbox"
            aria-label={label || "Category"}
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              right: 0,
              zIndex: 250,
              background: "#fff",
              borderRadius: "12px",
              border: "1px solid #E2E8F0",
              boxShadow: "0 14px 36px rgba(15,23,42,0.12)",
              padding: "6px",
              maxHeight: "min(280px, 50vh)",
              overflowY: "auto",
            }}
          >
            <button
              type="button"
              role="option"
              aria-selected={!hasValue}
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              style={{
                ...optionBtn,
                ...(!hasValue ? optionBtnActive : {}),
              }}
            >
              {placeholder}
            </button>
            {options.map((name) => {
              const isActive = trimmed === name;
              return (
                <button
                  key={name}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => {
                    onChange(name);
                    setOpen(false);
                  }}
                  style={{
                    ...optionBtn,
                    ...(isActive ? optionBtnActive : {}),
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
