export class Persona {
  /**
   * @param {object}        config
   * @param {string}        config.name         — Display name
   * @param {string}        config.description  — Role + disposition in free text; shown on card and injected into system prompt
   * @param {string}        config.color        — Hex accent color
   * @param {string}        config.voiceId      — ElevenLabs voice ID
   */
  constructor({ name, description, color, voiceId }) {
    this.name        = name;
    this.description = description;
    this.color       = color;
    this.voiceId     = voiceId;
  }

  /** System prompt injected into every Claude call for this persona. */
  toSystemPrompt() {
    return (
      `You are ${this.name}. ${this.description} ` +
      `Speak like you're texting a colleague mid-meeting — short, punchy, no fluff. ` +
      `2 to 3 sentences max. Use contractions. ` +
      `Occasionally open with a natural spoken filler like "Look,", "Honestly,", "Right,", "See," or "Okay but," ` +
      `to sound human and reactive. No em dashes. No preamble.`
    );
  }

  /** Returns a new Persona with the given fields overridden. Does not mutate this instance. */
  clone(overrides = {}) {
    return new Persona({
      name:        this.name,
      description: this.description,
      color:       this.color,
      voiceId:     this.voiceId,
      ...overrides,
    });
  }

  toJSON() {
    return { name: this.name, description: this.description, color: this.color, voiceId: this.voiceId };
  }

  static fromJSON(data) {
    return new Persona(data);
  }
}
