import { useState } from "react";
import { Persona } from "../models/Persona.js";
import { PERSONA_COLORS, VOICE_OPTIONS, PRESET_PERSONAS } from "../constants.js";

const DESC_MAX = 200;

export default function PersonaBuilder({ persona, agentKey, onSave, onReset, onCancel }) {
  const isB = agentKey === "B";
  const [name, setName]               = useState(persona.name);
  const [description, setDescription] = useState(persona.description);
  const [color, setColor]             = useState(persona.color);
  const [voiceId, setVoiceId]         = useState(persona.voiceId);
  const [stanceHint, setStanceHint]   = useState(persona.stanceHint ?? "");

  function handleSave() {
    onSave(new Persona({
      name:        name.trim() || persona.name,
      description: description.trim() || persona.description,
      color,
      voiceId,
      stanceHint:  stanceHint.trim(),
    }));
  }

  const inputStyle = {
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.16)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
    borderRadius: "var(--r-md)",
    color: "var(--text)",
    padding: "9px 12px",
    width: "100%",
    fontFamily: "var(--font-mono)",
    fontSize: "12px",
    outline: "none",
    transition: "border-color 0.2s var(--ease-out)",
  };

  const labelStyle = {
    fontSize: "9px",
    letterSpacing: "0.38em",
    color: "var(--text-3)",
    textTransform: "uppercase",
    marginBottom: "6px",
    display: "block",
  };

  const preset = PRESET_PERSONAS[agentKey];

  return (
    <div style={{
      background: `${persona.color}18`,
      borderTop: `2px solid ${color}`,
      boxShadow: `inset 0 3px 0 ${color}, inset 0 1px 0 rgba(255,255,255,0.14)`,
      padding: "1.5rem 1.75rem",
      display: "flex",
      flexDirection: "column",
      gap: "14px",
    }}>

      {/* Header */}
      <div style={{
        fontSize: "9px",
        letterSpacing: "0.38em",
        color,
        textTransform: "uppercase",
        textAlign: isB ? "right" : "left",
      }}>
        Edit Persona
      </div>

      {/* Name */}
      <div>
        <span style={labelStyle}>Name</span>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. The Skeptic"
          style={inputStyle}
        />
      </div>

      {/* Description */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
          <span style={{ ...labelStyle, marginBottom: 0 }}>Role &amp; Disposition</span>
          <span style={{
            fontSize: "9px",
            color: description.length > DESC_MAX * 0.9 ? "var(--danger-text)" : "var(--text-3)",
            letterSpacing: "0.04em",
          }}>
            {description.length}/{DESC_MAX}
          </span>
        </div>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value.slice(0, DESC_MAX))}
          placeholder="e.g. CFO at a mid-size tech firm. Risk-averse, numbers-first, allergic to buzzwords."
          rows={3}
          maxLength={DESC_MAX}
        />
      </div>

      {/* Color */}
      <div>
        <span style={labelStyle}>Accent Color</span>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {PERSONA_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              title={c}
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                background: c,
                border: color === c ? `2px solid var(--text)` : "2px solid transparent",
                boxShadow: color === c ? `0 0 8px ${c}` : "none",
                padding: 0,
                flexShrink: 0,
                transition: "box-shadow 0.2s var(--ease-out), border-color 0.2s var(--ease-out)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Voice */}
      <div>
        <span style={labelStyle}>Voice</span>
        <select
          value={voiceId}
          onChange={e => setVoiceId(e.target.value)}
          style={{
            ...inputStyle,
            cursor: "pointer",
            appearance: "none",
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239E9EB6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 12px center",
            paddingRight: "32px",
          }}
        >
          {VOICE_OPTIONS.map(v => (
            <option key={v.id} value={v.id} style={{ background: "#171720" }}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      {/* Stance hint */}
      <div>
        <span style={labelStyle}>
          Stance{" "}
          <span style={{ opacity: 0.45, letterSpacing: "0.1em", textTransform: "none", fontStyle: "italic" }}>
            optional — leave blank to generate from topic
          </span>
        </span>
        <input
          type="text"
          value={stanceHint}
          onChange={e => setStanceHint(e.target.value)}
          placeholder="e.g. Just came out of a board meeting where an AI pilot failed badly"
        />
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
        <button
          onClick={handleSave}
          style={{
            padding: "8px 22px",
            fontSize: "10px",
            letterSpacing: "0.2em",
            background: `${color}33`,
            borderColor: `${color}88`,
            color: "var(--text)",
            fontWeight: "500",
          }}
        >
          Save
        </button>
        <button
          onClick={() => {
            setName(preset.name);
            setDescription(preset.description);
            setColor(preset.color);
            setVoiceId(preset.voiceId);
            setStanceHint("");
            onReset();
          }}
          style={{ padding: "8px 18px", fontSize: "10px", letterSpacing: "0.18em" }}
        >
          Reset to Default
        </button>
        <button
          onClick={onCancel}
          style={{ padding: "8px 14px", fontSize: "10px", letterSpacing: "0.18em", color: "var(--text-3)" }}
        >
          Cancel
        </button>
      </div>

    </div>
  );
}
