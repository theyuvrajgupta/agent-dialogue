import { useState, useRef, useEffect } from "react";
import { PRESET_PERSONAS, CLOSING_ARCS, ESCALATION_ARCS, TOPICS, pick } from "./constants.js";
import { synthesizeAndPlay, callAPI, generateProvocation, generateStance, reframeTopic } from "./api.js";
import AgentCard from "./components/AgentCard.jsx";
import PersonaBuilder from "./components/PersonaBuilder.jsx";

export default function AgentDialogue() {
  const [turns, setTurns]   = useState(4);
  const [topic, setTopic]   = useState(() => pick(TOPICS));
  const [messages, setMessages] = useState([]);
  const [running, setRunning]   = useState(false);
  const [speaker, setSpeaker]   = useState(null);
  const [phase, setPhase]       = useState(null);
  const [status, setStatus]     = useState("");
  const [error, setError]       = useState("");
  const [stanceDisplay, setStanceDisplay] = useState({ A: "", B: "" });

  // Persona state — starts from presets, replaceable at any time before running
  const [personaA, setPersonaA] = useState(PRESET_PERSONAS.A);
  const [personaB, setPersonaB] = useState(PRESET_PERSONAS.B);
  const [editingA, setEditingA] = useState(false);
  const [editingB, setEditingB] = useState(false);

  const histRef               = useRef([]);
  const abortRef              = useRef(false);
  const stancesRef            = useRef({ A: "", B: "" });
  const closingArcRef         = useRef("");
  const provocationRef        = useRef("");
  const escalationArcRef      = useRef([]);
  const audioRef              = useRef(null);
  const prefetchControllerRef = useRef(null);
  const bottomRef             = useRef(null);
  const prevMsgCountRef       = useRef(0);

  const voiceEnabled = !!import.meta.env.VITE_ELEVENLABS_API_KEY;
  const TOPIC_MAX = 280;

  // Close editors when dialogue starts
  useEffect(() => {
    if (running) { setEditingA(false); setEditingB(false); }
  }, [running]);

  useEffect(() => {
    const isNew = messages.length !== prevMsgCountRef.current;
    prevMsgCountRef.current = messages.length;
    bottomRef.current?.scrollIntoView({ behavior: isNew ? "smooth" : "instant", block: "end" });
  }, [messages]);

  useEffect(() => {
    return () => {
      abortRef.current = true;
      prefetchControllerRef.current?.abort();
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    };
  }, []);

  async function startDialogue() {
    if (running) return;

    setRunning(true);
    setMessages([]);
    setError("");
    setStatus("Setting the stage...");
    histRef.current = [];
    abortRef.current = false;
    closingArcRef.current   = pick(CLOSING_ARCS);
    escalationArcRef.current = pick(ESCALATION_ARCS);

    // ── Topic reframe (guarded) ──────────────────────────────────────────────
    const PERSONAL_Q = /^\s*(?:[Dd]o you think|[Cc]an|[Ww]ill|[Ss]hould|[Ii]s|[Ww]as|[Hh]as)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/;
    const needsReframe = topic.trim().length < 15 || PERSONAL_Q.test(topic);
    const effectiveTopic = needsReframe ? await reframeTopic(topic).catch(() => topic) : topic;
    if (effectiveTopic !== topic) setTopic(effectiveTopic);

    // ── Parallel setup: provocation + one topic-aware stance per persona ─────
    // stanceHint bypasses generation; empty string falls through to Claude Haiku.
    const [provocation, stanceA, stanceB] = await Promise.all([
      generateProvocation(effectiveTopic),
      generateStance(personaA, effectiveTopic),
      generateStance(personaB, effectiveTopic),
    ]);

    provocationRef.current = provocation;
    const runtimeStances = { A: stanceA, B: stanceB };
    stancesRef.current = runtimeStances;
    setStanceDisplay(runtimeStances);

    const personas = { A: personaA, B: personaB };
    const seq = Array.from({ length: turns }, (_, i) => i % 2 === 0 ? "A" : "B");
    let prefetchPromise = null;

    for (let i = 0; i < seq.length; i++) {
      const k = seq[i];
      if (abortRef.current) { prefetchPromise = null; break; }

      setSpeaker(k);
      setPhase("thinking");
      setStatus(personas[k].name + " is thinking...");

      let text;
      try {
        if (prefetchPromise) {
          text = await prefetchPromise;
          prefetchControllerRef.current = null;
          prefetchPromise = null;
        } else {
          text = (await callAPI({
            persona:        personas[k],
            otherPersona:   personas[k === "A" ? "B" : "A"],
            stance:         stancesRef.current[k],
            topic:          effectiveTopic,
            history:        histRef.current,
            provocation:    provocationRef.current,
            turnIndex:      i,
            totalTurns:     seq.length,
            closingArc:     closingArcRef.current,
            escalationArc:  escalationArcRef.current,
          })).replace(/[*_#~`]/g, "").replace(/—/g, "-").replace(/…/g, "...").replace(/[""]/g, '"').replace(/['']/g, "'").replace(/\s+/g, " ").trim();
        }
      } catch (e) {
        prefetchPromise = null;
        prefetchControllerRef.current = null;
        if (!abortRef.current) setError(e.message);
        break;
      }

      if (abortRef.current) { prefetchPromise = null; break; }

      const displayIndex = histRef.current.length;
      // Store name in history so callAPI can format it without referencing live state
      histRef.current = [...histRef.current, { k, name: personas[k].name, t: text }];
      setMessages(prev => [...prev, { k, t: voiceEnabled ? "" : text }]);

      // Kick off next turn's API call while TTS plays
      const nextI = i + 1;
      if (nextI < seq.length) {
        const nextK = seq[nextI];
        const ctrl = new AbortController();
        prefetchControllerRef.current = ctrl;
        prefetchPromise = callAPI({
          persona:        personas[nextK],
          otherPersona:   personas[nextK === "A" ? "B" : "A"],
          stance:         stancesRef.current[nextK],
          topic:          effectiveTopic,
          history:        histRef.current,
          provocation:    provocationRef.current,
          turnIndex:      nextI,
          totalTurns:     seq.length,
          closingArc:     closingArcRef.current,
          escalationArc:  escalationArcRef.current,
          signal:         ctrl.signal,
        }).then(t => t.replace(/[*_#~`]/g, "").replace(/—/g, "-").replace(/…/g, "...").replace(/[""]/g, '"').replace(/['']/g, "'").replace(/\s+/g, " ").trim());
      }

      setPhase("speaking");
      setStatus(personas[k].name + " is speaking...");
      await synthesizeAndPlay(text, personas[k].voiceId, audioRef, (revealed) => {
        setMessages(prev => prev.map((m, idx) => idx === displayIndex ? { ...m, t: revealed } : m));
      });

      if (abortRef.current) {
        prefetchControllerRef.current?.abort();
        prefetchControllerRef.current = null;
        prefetchPromise = null;
        break;
      }
      await new Promise(r => setTimeout(r, 300));
    }

    prefetchControllerRef.current?.abort();
    prefetchControllerRef.current = null;

    setSpeaker(null);
    setPhase(null);
    setRunning(false);
    setStatus(abortRef.current ? "" : "Dialogue complete.");
  }

  function reset() {
    abortRef.current = true;
    prefetchControllerRef.current?.abort();
    prefetchControllerRef.current = null;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setMessages([]);
    setStatus("");
    setError("");
    setSpeaker(null);
    setPhase(null);
    setRunning(false);
    histRef.current = [];
    provocationRef.current = "";
    closingArcRef.current = "";
    setStanceDisplay({ A: "", B: "" });
  }

  const personas = { A: personaA, B: personaB };

  return (
    <div style={{ fontFamily: "var(--font-mono)", padding: "4rem 2.5rem 7rem", maxWidth: "880px", margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: "3.5rem" }}>
        <div className="fade-up fade-up-1" style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          marginBottom: "2.25rem",
        }}>
          <span style={{ fontSize: "9px", letterSpacing: "0.5em", color: "var(--text-3)", textTransform: "uppercase" }}>
            Agent Dialogue System
          </span>
          {voiceEnabled && (
            <span style={{
              fontSize: "9px", letterSpacing: "0.25em", color: "var(--text-3)",
              padding: "3px 10px",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-sm)",
            }}>
              VOICE
            </span>
          )}
        </div>

        <h1 className="fade-up fade-up-2" style={{
          fontFamily: "var(--font-display)",
          fontWeight: 300,
          fontSize: "clamp(40px, 6.5vw, 64px)",
          color: "var(--text)",
          margin: "0 0 2.75rem",
          lineHeight: 1.02,
          letterSpacing: "-0.03em",
          fontStyle: "italic",
          fontVariationSettings: '"opsz" 72',
          textAlign: "center",
        }}>
          Two minds. One question.
        </h1>

        <div className="fade-up fade-up-3" style={{
          height: "1px",
          background: "linear-gradient(90deg, transparent 0%, #6B5010 20%, #3A3A5C 55%, transparent 100%)",
        }} />
      </div>

      {/* Topic */}
      <div className="fade-up fade-up-4" style={{ marginBottom: "2.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <div style={{ fontSize: "9px", letterSpacing: "0.45em", color: "var(--text-2)", textTransform: "uppercase" }}>
            Topic
          </div>
          <button
            onClick={() => setTopic(pick(TOPICS))}
            disabled={running}
            title="Pick a random topic"
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "4px 10px",
              fontSize: "9px",
              letterSpacing: "0.25em",
              color: "var(--text-2)",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 3 21 3 21 8"/>
              <line x1="4" y1="20" x2="21" y2="3"/>
              <polyline points="21 16 21 21 16 21"/>
              <line x1="15" y1="15" x2="21" y2="21"/>
            </svg>
            SHUFFLE
          </button>
        </div>
        <textarea
          value={topic}
          onChange={e => setTopic(e.target.value.slice(0, TOPIC_MAX))}
          disabled={running}
          rows={2}
          maxLength={TOPIC_MAX}
        />
        <div style={{
          fontSize: "9px",
          color: topic.length > TOPIC_MAX * 0.9 ? "var(--danger-text)" : "var(--text-3)",
          textAlign: "right",
          marginTop: "5px",
          letterSpacing: "0.04em",
          transition: "color 0.2s var(--ease-out)",
        }}>
          {topic.length}/{TOPIC_MAX}
        </div>
      </div>

      {/* Agent panel — unified glassmorphism container */}
      <div className="fade-up fade-up-5" style={{
        display: "grid",
        gridTemplateColumns: "1fr 1px 1fr",
        marginBottom: "2.25rem",
        background: "rgba(255, 255, 255, 0.08)",
        backdropFilter: "blur(20px) saturate(160%)",
        WebkitBackdropFilter: "blur(20px) saturate(160%)",
        border: "1px solid rgba(255, 255, 255, 0.18)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.26), 0 24px 80px rgba(0,0,0,0.5)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
      }}>
        {/* Slot A */}
        {editingA
          ? <PersonaBuilder
              persona={personaA}
              agentKey="A"
              onSave={(p) => { setPersonaA(p); setEditingA(false); }}
              onReset={() => { setPersonaA(PRESET_PERSONAS.A); setEditingA(false); }}
              onCancel={() => setEditingA(false)}
            />
          : <AgentCard
              agent={personaA}
              agentKey="A"
              isActive={speaker === "A"}
              phase={phase}
              stance={stanceDisplay.A}
              onEdit={!running ? () => { setEditingB(false); setEditingA(true); } : null}
            />
        }

        {/* Center divider */}
        <div style={{
          background: "rgba(255, 255, 255, 0.22)",
          boxShadow: speaker ? `0 0 14px 5px ${personas[speaker].color}66` : "none",
          transition: "box-shadow 0.4s var(--ease-out)",
        }} />

        {/* Slot B */}
        {editingB
          ? <PersonaBuilder
              persona={personaB}
              agentKey="B"
              onSave={(p) => { setPersonaB(p); setEditingB(false); }}
              onReset={() => { setPersonaB(PRESET_PERSONAS.B); setEditingB(false); }}
              onCancel={() => setEditingB(false)}
            />
          : <AgentCard
              agent={personaB}
              agentKey="B"
              isActive={speaker === "B"}
              phase={phase}
              stance={stanceDisplay.B}
              onEdit={!running ? () => { setEditingA(false); setEditingB(true); } : null}
            />
        }
      </div>

      {/* Reset personas to defaults */}
      {(personaA.name !== PRESET_PERSONAS.A.name || personaB.name !== PRESET_PERSONAS.B.name) && !running && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem", marginTop: "-1rem" }}>
          <button
            onClick={() => { setPersonaA(PRESET_PERSONAS.A); setPersonaB(PRESET_PERSONAS.B); setEditingA(false); setEditingB(false); }}
            style={{ fontSize: "9px", letterSpacing: "0.22em", color: "var(--text-3)", padding: "4px 10px" }}
          >
            RESET PERSONAS TO DEFAULT
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="fade-up fade-up-6" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: "1.75rem", flexWrap: "wrap", gap: "12px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "9px", color: "var(--text-2)", letterSpacing: "0.42em", textTransform: "uppercase" }}>Turns</span>
          <div style={{
            display: "flex",
            border: "1px solid rgba(255, 255, 255, 0.13)",
            borderRadius: "var(--r-sm)",
            overflow: "hidden",
            background: "rgba(255, 255, 255, 0.06)",
            boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.16)",
          }}>
            {[2, 4, 6, 8].map(n => (
              <button key={n} onClick={() => setTurns(n)} disabled={running} style={{
                padding: "7px 22px",
                fontSize: "12px",
                border: "none",
                backdropFilter: "none",
                WebkitBackdropFilter: "none",
                borderRight: n !== 6 ? "1px solid rgba(255, 255, 255, 0.11)" : "none",
                borderRadius: 0,
                background: turns === n ? "rgba(255, 255, 255, 0.14)" : "transparent",
                boxShadow: turns === n ? "inset 0 1px 0 rgba(255,255,255,0.20)" : "none",
                fontWeight: turns === n ? "600" : "400",
                color: turns === n ? "var(--text)" : "var(--text-2)",
                letterSpacing: "0.04em",
              }}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={startDialogue} disabled={running} style={{
            padding: "10px 40px",
            fontSize: "10px",
            letterSpacing: "0.24em",
            background: running ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.11)",
            borderColor: running ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.26)",
            boxShadow: running
              ? "inset 0 1px 0 rgba(255,255,255,0.08)"
              : "inset 0 1px 0 rgba(255,255,255,0.26), 0 4px 24px rgba(0,0,0,0.32)",
            color: running ? "var(--text-3)" : "var(--text)",
            fontWeight: "500",
          }}>
            {running ? "Running..." : messages.length > 0 ? "Start Again" : "Start Dialogue"}
          </button>
          {(running || messages.length > 0) && (
            <button onClick={reset} style={{ padding: "10px 24px", fontSize: "10px", letterSpacing: "0.18em" }}>
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Chat area divider */}
      <div style={{
        height: "1px",
        background: "linear-gradient(90deg, transparent 0%, rgba(74,144,217,0.45) 22%, rgba(255,255,255,0.16) 50%, rgba(61,170,132,0.45) 78%, transparent 100%)",
        marginBottom: "2.5rem",
      }} />

      {/* Error */}
      {error && (
        <div style={{
          padding: "14px 18px",
          background: "var(--danger-bg)",
          border: "1px solid var(--danger-border)",
          borderRadius: "var(--r-md)",
          fontSize: "12px",
          color: "var(--danger-text)",
          marginBottom: "2rem",
        }}>
          {error}
        </div>
      )}

      {/* Dialogue */}
      <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
        {messages.length === 0 && !running && (
          <div style={{
            textAlign: "center",
            color: "var(--text-2)",
            fontSize: "10px",
            padding: "5.5rem 0",
            letterSpacing: "0.4em",
            textTransform: "uppercase",
            opacity: 0.8,
          }}>
            Live. In real time.
          </div>
        )}
        {messages.map((msg, i) => {
          const agent = personas[msg.k];
          const isB = msg.k === "B";
          const isCurrentlySpeaking = running && phase === "speaking" && i === messages.length - 1;
          const bubbleBg     = isB ? "rgba(61,170,132,0.10)"  : "rgba(74,144,217,0.10)";
          const bubbleBorder = isB ? "rgba(61,170,132,0.28)"  : "rgba(74,144,217,0.28)";
          return (
            <div key={i} className="msg-enter" style={{ display: "flex", justifyContent: isB ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "76%" }}>
                <div style={{
                  fontSize: "9px",
                  color: agent.color,
                  letterSpacing: "0.26em",
                  marginBottom: "9px",
                  textAlign: isB ? "right" : "left",
                  textTransform: "uppercase",
                  opacity: 0.9,
                }}>
                  {agent.name}
                </div>
                <div style={{
                  background: bubbleBg,
                  backdropFilter: "blur(12px) saturate(140%)",
                  WebkitBackdropFilter: "blur(12px) saturate(140%)",
                  border: `1px solid ${bubbleBorder}`,
                  borderLeft:  !isB ? `2px solid ${agent.color}` : `1px solid ${bubbleBorder}`,
                  borderRight:  isB ? `2px solid ${agent.color}` : `1px solid ${bubbleBorder}`,
                  borderRadius: isB ? "12px 2px 12px 12px" : "2px 12px 12px 12px",
                  padding: "18px 22px",
                  fontSize: "13px",
                  lineHeight: "1.92",
                  color: "var(--text)",
                  letterSpacing: "0.01em",
                  boxShadow: isCurrentlySpeaking
                    ? `inset 0 1px 0 rgba(255,255,255,0.12), 0 0 36px 6px ${agent.color}55`
                    : "inset 0 1px 0 rgba(255,255,255,0.12), 0 0 0 0 transparent",
                  transition: "box-shadow 0.5s var(--ease-out)",
                }}>
                  {msg.t || " "}
                  {isCurrentlySpeaking && <span className="cursor">|</span>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Status */}
      {status && (
        <div style={{
          display: "flex", alignItems: "center", gap: "10px",
          fontSize: "9px", color: "var(--text-3)",
          marginTop: "2.25rem",
          letterSpacing: "0.28em",
          textTransform: "uppercase",
        }}>
          {running && (
            <div style={{
              width: "5px", height: "5px", borderRadius: "50%",
              background: speaker ? personas[speaker].color : "var(--text-3)",
              animation: "pulse 1.4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
              flexShrink: 0,
              transition: "background-color 0.4s var(--ease-out)",
            }} />
          )}
          {status}
        </div>
      )}
    </div>
  );
}
