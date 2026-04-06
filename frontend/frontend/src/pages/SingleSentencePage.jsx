import { useState, useCallback, useRef, useEffect } from "react";
import {
  ArrowLeftRight,
  Languages,
  Sparkles,
  Copy,
  Clipboard,
  Eraser,
  Check,
  AlertCircle,
  ChevronDown,
} from "lucide-react";

import { apiFetch } from "../api/client";

const LANG_OPTIONS = [
  "Turkish",
  "English",
  "Arabic (MSA)",
  "Syrian Arabic",
];

function isRtlTarget(lang) {
  return /arabic|syrian|msa/i.test(String(lang || ""));
}

export default function SingleSentencePage() {
  const [sourceLang, setSourceLang] = useState("Turkish");
  const [targetLang, setTargetLang] = useState("Syrian Arabic");
  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const [rotating, setRotating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [modelHint, setModelHint] = useState("");
  const [copied, setCopied] = useState(false);
  const [sourceCopied, setSourceCopied] = useState(false);

  const swapLanguages = useCallback(() => {
    setRotating(true);
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setResult("");
    setError(null);
    setModelHint("");
    setCopied(false);
    setTimeout(() => setRotating(false), 380);
  }, [sourceLang, targetLang]);

  const translate = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);
    setResult("");
    setModelHint("");
    setCopied(false);

    try {
      const res = await apiFetch(`/translate/free`, {
        method: "POST",
        body: JSON.stringify({
          text: trimmed,
          source_language: sourceLang,
          target_language: targetLang,
        }),
      });

      let payload = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }

      if (!res.ok) {
        const msg =
          payload?.detail != null
            ? typeof payload.detail === "string"
              ? payload.detail
              : JSON.stringify(payload.detail)
            : `Request failed (${res.status})`;
        throw new Error(msg);
      }

      const out = payload?.translation ?? "";
      setResult(out);
      setModelHint(
        payload?.model
          ? `Model: ${payload.model}`
          : ""
      );
    } catch (e) {
      setError(e?.message || "Translation failed");
    } finally {
      setLoading(false);
    }
  }, [text, sourceLang, targetLang, loading]);

  const copyResult = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [result]);

  const copySource = useCallback(async () => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      setSourceCopied(true);
      window.setTimeout(() => setSourceCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }, [text]);

  const pasteIntoSource = useCallback(async () => {
    if (loading) return;
    try {
      const clip = await navigator.clipboard.readText();
      if (!clip) return;
      setText((prev) => (prev ? `${prev}\n${clip}` : clip));
      setError(null);
    } catch {
      /* clipboard permission might be blocked */
    }
  }, [loading]);

  const clearAll = useCallback(() => {
    if (loading) return;
    setText("");
    setResult("");
    setError(null);
    setModelHint("");
    setCopied(false);
    setSourceCopied(false);
  }, [loading]);

  const outRtl = isRtlTarget(targetLang);

  return (
    <div className="single-sentence-page" style={page}>
      <style>{`
        @keyframes langMenuIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={shell}>
        <div style={hero}>
          <div style={heroIcon}>
            <Sparkles size={24} color="#4338CA" strokeWidth={2} />
          </div>
          <div>
            <h1 style={heroTitle}>Single sentence translation</h1>
            <p style={heroSub}>
              Try a line in any supported pair. Text is sent to{" "}
              <strong>GPT</strong> on your server and is{" "}
              <strong>not</strong> saved to a project or episode.
            </p>
          </div>
        </div>

        {error && (
          <div style={errorBanner}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <div style={langBar}>
          <LangPicker
            value={sourceLang}
            onChange={(v) => {
              setSourceLang(v);
              setError(null);
            }}
            label="From"
          />

          <button
            type="button"
            style={{
              ...swapBtn,
              transform: rotating ? "rotate(180deg)" : "rotate(0deg)",
            }}
            onClick={swapLanguages}
            title="Swap languages"
          >
            <ArrowLeftRight size={18} />
          </button>

          <LangPicker
            value={targetLang}
            onChange={(v) => {
              setTargetLang(v);
              setError(null);
            }}
            label="To"
          />
        </div>

        <div style={panels}>
          <div style={panelIn}>
            <div style={panelHead}>
              <div style={panelHeadLeft}>
                <span style={panelBadge}>Source</span>
                <span style={panelMeta}>{sourceLang}</span>
              </div>
              <div style={panelHeadRight}>
                {text.trim() ? (
                  <button
                    type="button"
                    onClick={copySource}
                    style={ghostBtn}
                    title="Copy source"
                  >
                    {sourceCopied ? (
                      <Check size={16} color="#059669" />
                    ) : (
                      <Copy size={16} />
                    )}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={pasteIntoSource}
                  style={ghostBtn}
                  title="Paste"
                >
                  <Clipboard size={16} />
                </button>
              </div>
            </div>
            <textarea
              placeholder="Type or paste text to translate…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  translate();
                }
              }}
              style={textareaIn}
              disabled={loading}
              spellCheck
            />
            <div style={footer}>
              <span style={charCount}>
                {text.length.toLocaleString()} characters
                <span style={kbdHint}> · Ctrl+Enter to translate</span>
              </span>
              <div style={footerActions}>
                <button
                  type="button"
                  style={{ ...secondaryBtn, opacity: loading ? 0.6 : 1 }}
                  disabled={loading}
                  onClick={clearAll}
                >
                  <Eraser size={15} />
                  Clear
                </button>
                <button
                  type="button"
                  style={{
                    ...primaryBtn,
                    opacity: !text.trim() || loading ? 0.55 : 1,
                  }}
                  disabled={!text.trim() || loading}
                  onClick={translate}
                >
                  {loading ? "Translating…" : "Translate"}
                </button>
              </div>
            </div>
          </div>

          <div style={panelOut}>
            <div style={panelHead}>
              <div style={panelHeadLeft}>
                <span
                  style={{
                    ...panelBadge,
                    background: "#D1FAE5",
                    color: "#047857",
                  }}
                >
                  Result
                </span>
                <span style={panelMeta}>{targetLang}</span>
              </div>
              <div style={panelHeadRight}>
                {modelHint ? (
                  <span style={modelTag}>{modelHint}</span>
                ) : null}
                {result ? (
                  <button
                    type="button"
                    onClick={copyResult}
                    style={ghostBtn}
                    title="Copy"
                  >
                    {copied ? (
                      <Check size={16} color="#059669" />
                    ) : (
                      <Copy size={16} />
                    )}
                  </button>
                ) : null}
              </div>
            </div>
            <div
              dir={outRtl ? "rtl" : "ltr"}
              style={{
                ...outBody,
                textAlign: outRtl ? "right" : "left",
              }}
            >
              {loading ? (
                <span style={placeholder}>Calling the model…</span>
              ) : result ? (
                <p style={outText}>{result}</p>
              ) : (
                <span style={placeholder}>
                  Translation will appear here after you click Translate.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LangPicker({ value, onChange, label }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e) {
      if (!rootRef.current?.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onEsc(e) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open]);

  return (
    <div ref={rootRef} style={selectShell}>
      <span style={selectLabel}>{label}</span>
      <div style={pickerAnchor}>
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen((o) => !o)}
          style={{
            ...pickerTrigger,
            ...(open ? pickerTriggerOpen : {}),
          }}
        >
          <Languages size={16} style={{ color: "#64748B", flexShrink: 0 }} />
          <span style={pickerValue}>{value}</span>
          <ChevronDown
            size={18}
            style={{
              color: "#64748B",
              flexShrink: 0,
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
            }}
            aria-hidden
          />
        </button>
        {open && (
          <div role="listbox" style={pickerMenu} aria-label={`${label} language`}>
            {LANG_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                role="option"
                aria-selected={opt === value}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className="lang-picker-option"
                style={{
                  ...pickerOption,
                  ...(opt === value ? pickerOptionActive : {}),
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const page = {
  minHeight: "100%",
  padding: "28px 20px 48px",
  boxSizing: "border-box",
  background: "linear-gradient(180deg, #EEF2FF 0%, #F4F7FA 45%, #F8FAFC 100%)",
};

const shell = {
  maxWidth: "min(1120px, 100%)",
  margin: "0 auto",
};

const hero = {
  display: "flex",
  gap: "16px",
  alignItems: "flex-start",
  marginBottom: "22px",
  padding: "20px 22px",
  borderRadius: "18px",
  background:
    "linear-gradient(120deg, #EEF2FF 0%, #FAF5FF 50%, #F0FDFA 100%)",
  border: "1px solid #E2E8F0",
  boxShadow: "0 4px 20px rgba(15,23,42,0.06)",
};

const heroIcon = {
  width: "48px",
  height: "48px",
  borderRadius: "14px",
  background: "#E0E7FF",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const heroTitle = {
  margin: 0,
  fontSize: "1.5rem",
  fontWeight: 800,
  letterSpacing: "-0.02em",
  color: "#0F172A",
};

const heroSub = {
  margin: "8px 0 0",
  fontSize: "0.9rem",
  color: "#64748B",
  lineHeight: 1.55,
  maxWidth: "640px",
};

const errorBanner = {
  display: "flex",
  alignItems: "flex-start",
  gap: "10px",
  padding: "12px 14px",
  borderRadius: "12px",
  background: "#FEF2F2",
  border: "1px solid #FECACA",
  color: "#991B1B",
  fontSize: "0.88rem",
  marginBottom: "18px",
  lineHeight: 1.45,
};

const langBar = {
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-end",
  flexWrap: "wrap",
  gap: "16px 20px",
  background: "linear-gradient(180deg, #E0E7FF 0%, #DBEAFE 100%)",
  padding: "18px 24px",
  borderRadius: "18px",
  marginBottom: "24px",
  border: "1px solid #C7D2FE",
  boxShadow: "0 4px 16px rgba(67, 56, 202, 0.1)",
  position: "relative",
  zIndex: 4,
  overflow: "visible",
};

const selectShell = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const selectLabel = {
  fontSize: "0.7rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#4338CA",
  paddingLeft: "4px",
};

const pickerAnchor = {
  position: "relative",
  minWidth: "220px",
  width: "100%",
};

const pickerTrigger = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  width: "100%",
  boxSizing: "border-box",
  background: "#FFFFFF",
  padding: "12px 16px",
  borderRadius: "14px",
  border: "1px solid #E2E8F0",
  boxShadow: "0 4px 14px rgba(15,23,42,0.06)",
  fontSize: "0.95rem",
  fontWeight: 600,
  color: "#0F172A",
  cursor: "pointer",
  fontFamily: "inherit",
  textAlign: "left",
  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
};

const pickerTriggerOpen = {
  borderColor: "#A5B4FC",
  boxShadow: "0 0 0 3px rgba(129, 140, 248, 0.22), 0 4px 14px rgba(15,23,42,0.06)",
};

const pickerValue = {
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const pickerMenu = {
  position: "absolute",
  top: "calc(100% + 8px)",
  left: 0,
  right: 0,
  zIndex: 200,
  background: "#FFFFFF",
  borderRadius: "14px",
  border: "1px solid #E2E8F0",
  boxShadow:
    "0 18px 48px rgba(15,23,42,0.14), 0 0 0 1px rgba(99,102,241,0.06)",
  padding: "6px",
  animation: "langMenuIn 0.18s ease-out",
};

const pickerOption = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 14px",
  border: "none",
  borderRadius: "10px",
  background: "transparent",
  fontSize: "0.92rem",
  fontWeight: 600,
  color: "#334155",
  cursor: "pointer",
  fontFamily: "inherit",
  textAlign: "left",
  transition: "background 0.12s ease, color 0.12s ease",
};

const pickerOptionActive = {
  background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
  color: "#3730A3",
  boxShadow: "inset 0 0 0 1px #C7D2FE",
};

const swapBtn = {
  background: "linear-gradient(135deg, #4F46E5 0%, #2563EB 100%)",
  border: "none",
  borderRadius: "50%",
  width: "50px",
  height: "50px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "#ffffff",
  transition: "transform 0.35s ease",
  boxShadow: "0 10px 28px rgba(37, 99, 235, 0.4)",
  flexShrink: 0,
  alignSelf: "center",
  marginBottom: "2px",
  fontFamily: "inherit",
};

const panels = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
  gap: "22px",
};

const panelIn = {
  background: "#FFFFFF",
  borderRadius: "18px",
  border: "1px solid #E2E8F0",
  boxShadow: "0 8px 28px rgba(15,23,42,0.07)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  minHeight: "340px",
};

const panelOut = {
  background: "#FFFFFF",
  borderRadius: "18px",
  border: "1px solid #E2E8F0",
  boxShadow: "0 8px 28px rgba(15,23,42,0.07)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  minHeight: "340px",
};

const panelHead = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "14px 18px",
  borderBottom: "1px solid #F1F5F9",
  background: "#FAFBFC",
};

const panelHeadLeft = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
};

const panelHeadRight = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const panelBadge = {
  fontSize: "0.72rem",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  padding: "5px 10px",
  borderRadius: "8px",
  background: "#EEF2FF",
  color: "#4338CA",
};

const panelMeta = {
  fontSize: "0.85rem",
  fontWeight: 600,
  color: "#64748B",
};

const modelTag = {
  fontSize: "0.72rem",
  fontWeight: 600,
  color: "#64748B",
};

const textareaIn = {
  flex: 1,
  border: "none",
  padding: "20px 22px",
  fontSize: "1rem",
  lineHeight: 1.6,
  resize: "none",
  outline: "none",
  background: "#FFFFFF",
  color: "#0F172A",
  fontFamily: "inherit",
  minHeight: "220px",
};

const outBody = {
  flex: 1,
  padding: "20px 22px",
  overflowY: "auto",
  minHeight: "220px",
  background: "linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)",
};

const outText = {
  margin: 0,
  fontSize: "1.05rem",
  lineHeight: 1.75,
  color: "#0F172A",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const placeholder = {
  color: "#94A3B8",
  fontSize: "0.95rem",
  lineHeight: 1.55,
};

const footer = {
  borderTop: "1px solid #EEF2F6",
  padding: "14px 18px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
  background: "#F8FAFC",
};

const footerActions = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
};

const charCount = {
  fontSize: "0.82rem",
  color: "#64748B",
  fontWeight: 500,
};

const kbdHint = {
  color: "#94A3B8",
  fontWeight: 500,
};

const primaryBtn = {
  background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
  color: "#ffffff",
  border: "none",
  padding: "11px 24px",
  borderRadius: "12px",
  fontWeight: 700,
  fontSize: "0.92rem",
  cursor: "pointer",
  fontFamily: "inherit",
  boxShadow: "0 6px 18px rgba(37, 99, 235, 0.35)",
};

const secondaryBtn = {
  border: "1px solid #CBD5E1",
  background: "#FFFFFF",
  color: "#475569",
  padding: "10px 14px",
  borderRadius: "11px",
  fontWeight: 700,
  fontSize: "0.86rem",
  cursor: "pointer",
  fontFamily: "inherit",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};

const ghostBtn = {
  border: "1px solid #E2E8F0",
  background: "#FFFFFF",
  borderRadius: "10px",
  padding: "8px 10px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#475569",
  fontFamily: "inherit",
};
