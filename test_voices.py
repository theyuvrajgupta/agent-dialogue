"""
Quick voice test — synthesizes one line per agent and saves to .mp3.
Run from the agent-dialogue directory with the venv active.

Usage:
  source ../pyenv/bin/activate
  python test_voices.py

Requires ELEVENLABS_API_KEY env var (or hardcode key below for quick testing).
"""

import os
import sys

try:
    from elevenlabs.client import ElevenLabs
    from elevenlabs import save
except ImportError:
    sys.exit("elevenlabs package not installed. Run: pip install elevenlabs")

API_KEY = os.environ.get("ELEVENLABS_API_KEY")
if not API_KEY:
    sys.exit("Set ELEVENLABS_API_KEY in your environment before running.")

VOICES = {
    "The Operator": {
        "voice_id": "Xb7hH8MSUJpSbSDYk0k2",  # Alice
        "text": "Look, I've seen three generations of 'transformative tech' — this isn't different.",
        "output": "operator_test.mp3",
    },
    "The Futurist": {
        "voice_id": "IKne3meq5aSn9XLyUdCD",  # Charlie
        "text": "Okay but — every time you waited, someone else moved first. That's the pattern.",
        "output": "futurist_test.mp3",
    },
}

client = ElevenLabs(api_key=API_KEY)

for name, cfg in VOICES.items():
    print(f"Synthesizing {name}...", end=" ", flush=True)
    audio = client.text_to_speech.convert(
        voice_id=cfg["voice_id"],
        text=cfg["text"],
        model_id="eleven_turbo_v2",
        voice_settings={"stability": 0.5, "similarity_boost": 0.75},
    )
    save(audio, cfg["output"])
    print(f"saved → {cfg['output']}")

print("\nDone. Open the .mp3 files to hear each agent's voice.")
