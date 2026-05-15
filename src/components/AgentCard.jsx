export default function AgentCard({ agent, agentKey, isActive, phase, stance }) {
  const isB = agentKey === "B";
  const isSpeaking = isActive && phase === "speaking";

  const dot = (
    <div style={{
      width: "6px", height: "6px", borderRadius: "50%",
      background: agent.color,
      opacity: isActive ? 1 : 0.35,
      boxShadow: isActive ? `0 0 10px 3px ${agent.color}99` : "none",
      flexShrink: 0,
      transition: "box-shadow 0.4s var(--ease-out), opacity 0.4s var(--ease-out)",
    }} />
  );

  return (
    <div style={{
      background: isActive ? `${agent.color}2A` : "rgba(255, 255, 255, 0.05)",
      borderTop: `2px solid ${isActive ? agent.color : agent.color + "55"}`,
      boxShadow: isActive
        ? `inset 0 3px 0 ${agent.color}, inset 0 0 80px ${agent.color}22, inset 0 1px 0 rgba(255,255,255,0.20)`
        : "inset 0 1px 0 rgba(255,255,255,0.14)",
      padding: "1.5rem 1.75rem",
      transition: [
        "background-color 0.4s var(--ease-out)",
        "border-top-color 0.4s var(--ease-out)",
        "box-shadow 0.4s var(--ease-out)",
      ].join(", "),
    }}>

      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        marginBottom: "6px",
        justifyContent: isB ? "flex-end" : "flex-start",
      }}>
        {!isB && dot}
        <span style={{
          fontSize: "15px",
          fontFamily: "var(--font-display)",
          fontStyle: "italic",
          fontWeight: 400,
          color: agent.color,
          letterSpacing: "0.01em",
          fontVariationSettings: '"opsz" 36',
        }}>
          {agent.name}
        </span>
        {isB && dot}
      </div>

      <p style={{
        fontSize: "9px",
        color: "var(--text-2)",
        margin: 0,
        textAlign: isB ? "right" : "left",
        lineHeight: 1.5,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
      }}>
        {agent.role}
      </p>

      {stance && (
        <p style={{
          fontSize: "11px",
          fontFamily: "var(--font-display)",
          fontStyle: "italic",
          fontVariationSettings: '"opsz" 20',
          color: agent.color,
          margin: "12px 0 0",
          textAlign: isB ? "right" : "left",
          lineHeight: 1.7,
          opacity: 0.7,
        }}>
          {stance}
        </p>
      )}

      {isActive && (
        <div style={{
          display: "flex", alignItems: "center", gap: "7px",
          justifyContent: isB ? "flex-end" : "flex-start",
          marginTop: "14px",
        }}>
          <div style={{
            width: "4px", height: "4px", borderRadius: "50%",
            background: agent.color,
            animation: "pulse 1.4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: "9px",
            color: agent.color,
            letterSpacing: "0.26em",
            opacity: 0.9,
            textTransform: "uppercase",
          }}>
            {isSpeaking ? "Speaking" : "Thinking"}
          </span>
        </div>
      )}
    </div>
  );
}
