export default function AgentCard({ agent, agentKey, isActive, phase, stance }) {
  const isB = agentKey === "B";
  const isSpeaking = isActive && phase === "speaking";

  const dot = (
    <div style={{
      width: "5px", height: "5px", borderRadius: "50%",
      background: agent.color,
      opacity: isActive ? 1 : 0.55,
      boxShadow: isActive ? `0 0 7px ${agent.color}` : "none",
      flexShrink: 0,
      transition: "box-shadow 0.4s, opacity 0.4s",
    }} />
  );

  return (
    <div style={{
      background: "var(--surface)",
      border: `1px solid ${isActive ? agent.color + "38" : "var(--border)"}`,
      borderTop: `2px solid ${isActive ? agent.color : agent.color + "55"}`,
      borderRadius: "var(--r-md)",
      padding: "1.125rem 1.25rem",
      transition: "border-color 0.4s, box-shadow 0.4s",
      boxShadow: isActive ? `0 0 40px ${agent.color}0F, 0 1px 0 ${agent.color}18 inset` : "none",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "5px", justifyContent: isB ? "flex-end" : "flex-start" }}>
        {!isB && dot}
        <span style={{
          fontSize: "14px",
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
        color: "var(--text-3)",
        margin: 0,
        textAlign: isB ? "right" : "left",
        lineHeight: 1.5,
        letterSpacing: "0.16em",
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
          margin: "10px 0 0",
          textAlign: isB ? "right" : "left",
          lineHeight: 1.65,
          opacity: 0.65,
        }}>
          {stance}
        </p>
      )}

      {isActive && (
        <div style={{
          display: "flex", alignItems: "center", gap: "6px",
          justifyContent: isB ? "flex-end" : "flex-start",
          marginTop: "12px",
        }}>
          <div style={{
            width: "4px", height: "4px", borderRadius: "50%",
            background: agent.color,
            animation: "pulse 1.4s ease-in-out infinite",
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: "9px",
            color: agent.color,
            letterSpacing: "0.24em",
            opacity: 0.88,
          }}>
            {isSpeaking ? "SPEAKING" : "THINKING"}
          </span>
        </div>
      )}
    </div>
  );
}
