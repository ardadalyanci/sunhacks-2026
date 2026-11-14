"use client";

import { useRef, useState, type FormEvent } from "react";
import type { CommandResult } from "@/lib/types";
import { PRODUCT } from "./brand";

// Minimal typing for the Web Speech API (not in TypeScript's DOM lib).
type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function speak(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 1.02;
  window.speechSynthesis.speak(utterance);
}

type Props = {
  briefing: string;
  onCommand: (transcript: string) => Promise<CommandResult>;
  onListeningChange?: (listening: boolean) => void;
};

/** "Hear my day" reads the briefing; the mic or the text box sends a command. */
export default function VoiceBar({ briefing, onCommand, onListeningChange }: Props) {
  const [listening, setListeningState] = useState(false);

  function setListening(value: boolean) {
    setListeningState(value);
    onListeningChange?.(value);
  }
  const [heard, setHeard] = useState("");
  const [reply, setReply] = useState("");
  const [typed, setTyped] = useState("");
  const recognition = useRef<Recognition | null>(null);

  async function handle(transcript: string) {
    setHeard(transcript);
    const result = await onCommand(transcript);
    setReply(result.say);
    speak(result.say);
  }

  function listen() {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setReply("Voice input needs Chrome or Edge. Type your question instead.");
      return;
    }
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const r = new Ctor();
    r.lang = "en-US";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (event) => void handle(event.results[0][0].transcript);
    r.onerror = (event) =>
      setReply(event.error === "not-allowed" ? `Allow the microphone to talk to ${PRODUCT}.` : "I did not catch that. Try again.");
    r.onend = () => setListening(false);
    recognition.current = r;
    setListening(true);
    r.start();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!typed.trim()) return;
    void handle(typed.trim());
    setTyped("");
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setReply(briefing);
            speak(briefing);
          }}
          className="rounded-full bg-ink px-5 py-3 font-bold text-cloud hover:bg-ink/90"
        >
          Hear my day
        </button>
        <button
          type="button"
          onClick={listen}
          aria-pressed={listening}
          className={`rounded-full border-2 px-5 py-3 font-bold ${
            listening ? "border-dusk bg-dusk text-cloud" : "border-ink hover:bg-ink/10"
          }`}
        >
          {listening ? "Listening… tap to stop" : `Ask ${PRODUCT}`}
        </button>
      </div>

      <form onSubmit={submit} className="mt-3 flex gap-2">
        <label className="sr-only" htmlFor="command">
          Type a question or command
        </label>
        <input
          id="command"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Or type: add the robotics meeting"
          className="min-w-0 flex-1 rounded-full border-2 border-ink/20 bg-cloud px-4 py-2 focus:border-ink"
        />
        <button type="submit" className="rounded-full border-2 border-ink px-4 py-2 font-bold hover:bg-ink/10">
          Send
        </button>
      </form>

      <div aria-live="polite" className="mt-3 space-y-1">
        {heard && <p className="text-ink-soft">You said: {heard}</p>}
        {reply && <p className="font-bold">{reply}</p>}
      </div>
    </div>
  );
}
