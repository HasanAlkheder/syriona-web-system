/* eslint-disable react/prop-types -- shared form control */
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useFlipListboxPlacement } from "../hooks/useFlipListboxPlacement";

/**
 * Custom status dropdown with optional left segment label (e.g. "STATUS" | value + chevron).
 */
export default function WorkflowStatusSelect({
  value,
  options,
  onChange,
  disabled,
  segmentedPrefix,
  badgeStyleForValue,
  ariaLabel = "Status",
  /** Larger trigger (e.g. project episode Kanban cards). */
  comfortable = false,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const { flip: menuFlip, maxHeight: menuMaxHeight } = useFlipListboxPlacement(
    open,
    rootRef,
    options.length,
    260
  );

  const current = useMemo(
    () =>
      options.find((o) => String(o.value) === String(value)) || options[0],
    [options, value]
  );

  const badge = badgeStyleForValue
    ? badgeStyleForValue(current?.value ?? value)
    : {};

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

  const showSeg = Boolean(
    segmentedPrefix && String(segmentedPrefix).trim()
  );

  return (
    <div
      ref={rootRef}
      style={{ position: "relative", minWidth: 0, width: "100%" }}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={
          showSeg
            ? "wf-status-select-trigger wf-status-select-trigger--segmented"
            : "wf-status-select-trigger"
        }
        style={{
          margin: 0,
          width: "100%",
          boxSizing: "border-box",
          cursor: disabled ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          opacity: disabled ? 0.65 : 1,
          ...(showSeg
            ? {
                display: "inline-flex",
                alignItems: "stretch",
                border: "1px solid #E2E8F0",
                borderRadius: "12px",
                overflow: "hidden",
                background: "#FFFFFF",
                padding: 0,
                boxShadow: "0 1px 2px rgba(15, 23, 42, 0.05)",
                outline: "none",
              }
            : {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: comfortable ? "10px" : "8px",
                borderRadius: "999px",
                padding: comfortable
                  ? "8px 24px 8px 14px"
                  : "5px 22px 5px 12px",
                fontSize: comfortable ? "0.84rem" : "0.68rem",
                fontWeight: 700,
                letterSpacing: "0.02em",
                boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
                ...badge,
              }),
        }}
      >
        {showSeg ? (
          <>
            <span className="wf-status-select-prefix">{segmentedPrefix}</span>
            <span
              className="wf-status-select-value"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                flex: 1,
                minWidth: 0,
                padding: "10px 12px 10px 14px",
                ...badge,
              }}
            >
              <span
                style={{
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  lineHeight: 1.2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {current?.label ?? "—"}
              </span>
              <ChevronDown
                size={17}
                style={{
                  color: badge.color || "#475569",
                  flexShrink: 0,
                  opacity: 0.85,
                  transform: open ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s ease",
                }}
                aria-hidden
              />
            </span>
          </>
        ) : (
          <>
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                minWidth: 0,
              }}
            >
              {current?.label ?? "—"}
            </span>
            <ChevronDown
              size={comfortable ? 18 : 16}
              style={{
                flexShrink: 0,
                opacity: 0.8,
                transform: open ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
              }}
              aria-hidden
            />
          </>
        )}
      </button>
      {open && !disabled && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="wf-status-select-menu syriona-light-scroll-y"
          style={{
            position: "absolute",
            ...(menuFlip
              ? { bottom: "calc(100% + 6px)", top: "auto" }
              : { top: "calc(100% + 6px)", bottom: "auto" }),
            left: 0,
            minWidth: "100%",
            zIndex: 280,
            background: "#fff",
            borderRadius: "12px",
            border: "1px solid #E2E8F0",
            boxShadow: "0 14px 36px rgba(15,23,42,0.12)",
            padding: "6px",
            maxHeight: menuMaxHeight,
            overflowY: "auto",
          }}
        >
          {options.map((opt) => {
            const sel = String(opt.value) === String(value);
            const rowBadge = badgeStyleForValue
              ? badgeStyleForValue(opt.value)
              : {};
            return (
              <button
                key={String(opt.value)}
                type="button"
                role="option"
                aria-selected={sel}
                onClick={() => {
                  onChange(String(opt.value));
                  setOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  boxSizing: "border-box",
                  border: "none",
                  borderRadius: "9px",
                  padding: "9px 10px",
                  marginBottom: "2px",
                  textAlign: "left",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  background: sel
                    ? "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)"
                    : rowBadge.background || "transparent",
                  color: sel ? "#3730A3" : rowBadge.color || "#334155",
                  boxShadow: sel ? "inset 0 0 0 1px #C7D2FE" : "none",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
