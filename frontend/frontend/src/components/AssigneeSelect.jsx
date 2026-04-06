/** Dropdown of organization members for project / episode assignment. */
/* eslint-disable react/prop-types -- internal form control */
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export function memberLabel(u) {
  if (!u) return "—";
  const n = String(u.full_name ?? "").trim();
  if (n) return n;
  const e = String(u.email ?? "").trim();
  if (e) return e;
  return `User ${u.id}`;
}

function compactMemberLabel(u) {
  const full = memberLabel(u);
  if (full.length <= 22) return full;
  return `${full.slice(0, 21)}…`;
}

export default function AssigneeSelect({
  id,
  label = "Assign to",
  value,
  members,
  onChange,
  disabled,
  style,
  selectStyle,
  hideLabel = false,
  /** Left segment inside trigger, e.g. "Assign" (project toolbar). */
  segmentedPrefix,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const sid = id || "assignee-select";
  const selected = useMemo(
    () =>
      (members || []).find((m) => Number(m.id) === Number(value)) || null,
    [members, value]
  );

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

  const currentLabel = selected ? compactMemberLabel(selected) : "Unassigned";
  const seg = segmentedPrefix != null && String(segmentedPrefix).trim() !== "";

  return (
    <div
      ref={rootRef}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        minWidth: 0,
        ...style,
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
          title={selected ? memberLabel(selected) : "Unassigned"}
          className={
            seg ? "assignee-select-trigger assignee-select--segmented" : "assignee-select-trigger"
          }
          style={{
            margin: 0,
            border: "1px solid #E2E8F0",
            borderRadius: seg ? "12px" : "10px",
            outline: "none",
            padding: seg ? 0 : "8px 10px",
            fontSize: "0.84rem",
            fontWeight: 600,
            cursor: disabled ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            lineHeight: 1.2,
            background: "#FFFFFF",
            color: "#1e293b",
            minWidth: seg ? "180px" : "110px",
            width: "100%",
            display: "flex",
            alignItems: seg ? "stretch" : "center",
            justifyContent: "space-between",
            gap: seg ? 0 : "8px",
            textAlign: "left",
            overflow: "hidden",
            boxShadow: seg ? "0 1px 2px rgba(15, 23, 42, 0.05)" : undefined,
            ...selectStyle,
          }}
          aria-label={hideLabel ? label || "Assign to" : undefined}
        >
          {seg ? (
            <span className="assignee-select-prefix">{segmentedPrefix}</span>
          ) : null}
          <span
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
              padding: seg ? "10px 12px 10px 14px" : 0,
            }}
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
          </span>
        </button>
        {open && !disabled && (
          <div
            role="listbox"
            aria-label={`${label || "Assignee"} options`}
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
              maxHeight: "220px",
              overflowY: "auto",
            }}
          >
            <button
              type="button"
              role="option"
              aria-selected={selected == null}
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              style={{
                ...optionBtn,
                ...(selected == null ? optionBtnActive : {}),
              }}
            >
              Unassigned
            </button>
            {(members || []).map((m) => {
              const isActive = Number(m.id) === Number(value);
              return (
                <button
                  key={m.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  title={memberLabel(m)}
                  onClick={() => {
                    onChange(Number(m.id));
                    setOpen(false);
                  }}
                  style={{
                    ...optionBtn,
                    ...(isActive ? optionBtnActive : {}),
                  }}
                >
                  {compactMemberLabel(m)}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

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
