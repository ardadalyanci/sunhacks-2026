"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { polishLine } from "@/lib/places";
import Mascot from "./Mascot";
import { MASCOT } from "./brand";

// Minimal typing for the Web Speech API (not in TypeScript's DOM lib).
type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void; // stops without delivering a pending result
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** The most natural English voice the browser has: Chrome's Google voice, then a Microsoft "Natural" one. */
function bestVoice(): SpeechSynthesisVoice | undefined {
  const english = window.speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith("en"));
  return (
    english.find((v) => /google us english/i.test(v.name)) ??
    english.find((v) => /natural/i.test(v.name) && /en-us/i.test(v.lang)) ??
    english.find((v) => /en-us/i.test(v.lang)) ??
    english[0]
  );
}

// Each speak() call is a run. A run cut short by a newer one (or by leaving the day) must not report that it
// ended, or it would stop the newer run's talking animation.
let speechRun = 0;

/** Stops whatever Sol is saying, and keeps the stopped run from reporting back. */
export function stopSpeaking() {
  speechRun++;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

/**
 * Says `text` one sentence at a time (Chrome's voices can stop partway through one long utterance) and calls
 * `onDone` when the last sentence ends or speech is not available. A run cut short by a newer one stays quiet.
 */
export function speak(text: string, onDone?: () => void) {
  if (!("speechSynthesis" in window)) return onDone?.();
  const synth = window.speechSynthesis;
  synth.cancel();
  const mine = ++speechRun;
  const done = () => {
    if (mine === speechRun) onDone?.();
  };
  const voice = bestVoice();
  const sentences = (text.match(/[^.?!]+[.?!]*/g) ?? [text]).map((s) => s.trim()).filter(Boolean);
  sentences.forEach((sentence, index) => {
    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.lang = "en-US";
    utterance.rate = 1.03;
    if (voice) utterance.voice = voice;
    if (index === sentences.length - 1) {
      utterance.onend = done;
      utterance.onerror = done;
    }
    synth.speak(utterance);
  });
  if (!sentences.length) done();
}

type Props = {
  briefing: string;
  onCommand: (text: string) => Promise<string>; // returns what to say back
  onListeningChange?: (listening: boolean) => void;
  onSpeakingChange?: (speaking: boolean) => void;
};

/** "Hear my day" reads the briefing; the mic or the text box asks Sol, and his answer shows as a chat bubble. */
export default function VoiceBar({ briefing, onCommand, onListeningChange, onSpeakingChange }: Props) {
  const [listening, setListeningState] = useState(false);
  const [working, setWorking] = useState(false);
  const [heard, setHeard] = useState("");
  const [reply, setReply] = useState("");
  const [typed, setTyped] = useState("");
  const recognition = useRef<Recognition | null>(null);

  const alive = useRef(false); // false once the bar is gone: an answer that lands later is not said
  const talking = useRef<((speaking: boolean) => void) | null>(null); // set while Sol speaks, to reset on leave

  // Leaving the day (another day, another page, or the hidden page React keeps) stops Sol mid-sentence and drops
  // a question still being heard, so the old day's answer never plays over the new one. The chat clears too:
  // coming back to Today after adding an event on Events, an old answer ("I could not find that") would sit
  // under a day it no longer describes, and Sol's note already says what the add changed.
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      recognition.current?.abort();
      stopSpeaking();
      talking.current?.(false);
      talking.current = null;
      setHeard("");
      setReply("");
    };
  }, []);

  function setListening(value: boolean) {
    setListeningState(value);
    onListeningChange?.(value);
  }

  function say(text: string) {
    if (!alive.current) return;
    const line = polishLine(text);
    setReply(line);
    talking.current = onSpeakingChange ?? null;
    onSpeakingChange?.(true);
    speak(line, () => {
      talking.current = null;
      onSpeakingChange?.(false);
    });
  }

  async function handle(text: string) {
    setHeard(text);
    setReply("");
    setWorking(true);
    try {
      say(await onCommand(text));
    } catch {
      say("I couldn't do that right now. Try again in a moment.");
    } finally {
      setWorking(false);
    }
  }

  function listen() {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setReply("Voice needs Chrome or Edge. Type your question instead.");
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
      setReply(event.error === "not-allowed" ? `Allow the microphone to talk to ${MASCOT}.` : "I didn't catch that. Try again.");
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
            setHeard("");
            say(briefing);
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
          {listening ? "Listening… tap to stop" : `Ask ${MASCOT}`}
        </button>
      </div>

      <form onSubmit={submit} className="mt-3 flex gap-2">
        <label className="sr-only" htmlFor="command">
          Ask {MASCOT}, like “when should I leave?”
        </label>
        <input
          id="command"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Or type: when should I leave?"
          className="min-w-0 flex-1 rounded-full border-2 border-ink/20 bg-cloud px-4 py-2 focus:border-ink"
        />
        <button
          type="submit"
          disabled={working}
          className="rounded-full border-2 border-ink px-4 py-2 font-bold hover:bg-ink/10 disabled:opacity-50"
        >
          {working ? "…" : "Send"}
        </button>
      </form>

      {/* The question and Sol's answer, as a two-line chat. */}
      <div aria-live="polite" className="mt-3 space-y-2">
        {heard && (
          <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2 text-cloud">
            <span className="sr-only">You asked: </span>
            {heard}
          </p>
        )}
        {(reply || working) && (
          <div className="flex items-end gap-2">
            <Mascot size={28} label="" className="shrink-0" />
            <p className="w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-sun-soft px-4 py-2 font-bold">
              <span className="sr-only">{MASCOT}: </span>
              {reply || "…"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
