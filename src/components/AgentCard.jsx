export default function AgentCard({ agent, agentKey, isActive, phase, stance }) {
  const isB = agentKey === "B";
  const isSpeaking = isActive && phase === "speaking";

  const dot = (
    <div style={{
      width: "5px", height: "5px", borderRadius: "50%",
      background: agent.color,
      opacity: isActive ? 1 : 0.45,
      boxShadow: isActive ? `0 0 8px 2px ${agent.color}88` : "none",
      flexShrink: 0,
      transition: "box-shadow 0.36s var(--ease-out), opacity 0.36s var(--ease-out)",
    }} />
  );

  return (
    <div style={{
      background: isActive ? `${agent.color}0F` : "var(--surface)",
      borderTop: `2px solid ${isActive ? agent.color : agent.color + "55"}`,
      padding: "1.25rem 1.5rem",
      transition: "background-color 0.36s var(--ease-out), border-top-color 0.36s var(--ease-out)",
    }}>

      <div style={{
        display: "flex", alignItems: "center", gap: "7px",
        marginBottom: "5px",
        justifyContent: isB ? "flex-end" : "flex-start",
      }}>
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
        color: "var(--text-2)",
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
          opacity: 0.62,
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
            animation: "pulse 1.4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
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
