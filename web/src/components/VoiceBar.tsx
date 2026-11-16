"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CHIPS } from "@/lib/chips";
import { polishLine } from "@/lib/places";
import Mascot from "./Mascot";
import { MASCOT } from "./brand";
import type { ChatTurn } from "./useDay";

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
  onCommand: (text: string, history: ChatTurn[]) => Promise<string>; // returns what to say back
  onListeningChange?: (listening: boolean) => void;
  onSpeakingChange?: (speaking: boolean) => void;
};

const MAX_TURNS = 20; // what the chat keeps on screen; the last 8 go to Sol as context

/**
 * "Hear my day" reads the briefing; the mic, the text box or a ready-made question asks Sol. The chat keeps the
 * conversation for this day, and Sol gets the last few turns, so "and after that?" makes sense.
 */
export default function VoiceBar({ briefing, onCommand, onListeningChange, onSpeakingChange }: Props) {
  const [listening, setListeningState] = useState(false);
  const [working, setWorking] = useState(false);
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [typed, setTyped] = useState("");
  const [speaking, setSpeaking] = useState(false); // shows "Stop talking" while Sol reads aloud
  const recognition = useRef<Recognition | null>(null);
  const chat = useRef<HTMLDivElement | null>(null);
  const history = useRef<ChatTurn[]>([]); // the same turns, readable inside an answer that lands later

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
      history.current = [];
      setMessages([]);
    };
  }, []);

  // The newest message stays in view.
  useEffect(() => {
    const box = chat.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [messages, working]);

  function add(turn: ChatTurn) {
    history.current = [...history.current, turn].slice(-MAX_TURNS);
    setMessages(history.current);
  }

  function setListening(value: boolean) {
    setListeningState(value);
    onListeningChange?.(value);
  }

  /**
   * Puts Sol's line in the chat, and reads it aloud only when `aloud`: after a question asked out loud (the mic)
   * and for "Hear my day". A typed question or a chip gets a quiet answer.
   */
  function say(text: string, aloud: boolean) {
    if (!alive.current) return;
    const line = polishLine(text);
    add({ from: "sol", text: line });
    if (!aloud) return;
    talking.current = onSpeakingChange ?? null;
    onSpeakingChange?.(true);
    setSpeaking(true);
    speak(line, () => {
      talking.current = null;
      onSpeakingChange?.(false);
      if (alive.current) setSpeaking(false);
    });
  }

  async function handle(text: string, aloud = false) {
    if (working) return;
    if (!aloud) stopTalking(); // typing while Sol reads the last answer: he stops
    const before = history.current;
    add({ from: "you", text });
    setWorking(true);
    try {
      say(await onCommand(text, before), aloud);
    } catch {
      say("I couldn't do that right now. Try again in a moment.", aloud);
    } finally {
      setWorking(false);
    }
  }

  function listen() {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      add({ from: "sol", text: "Voice needs Chrome or Edge. Type your question instead." });
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
    r.onresult = (event) => void handle(event.results[0][0].transcript, true);
    r.onerror = (event) =>
      add({ from: "sol", text: event.error === "not-allowed" ? `Allow the microphone to talk to ${MASCOT}.` : "I didn't catch that. Try again." });
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

  function stopTalking() {
    stopSpeaking();
    talking.current?.(false);
    talking.current = null;
    setSpeaking(false);
  }

  function clear() {
    stopTalking();
    history.current = [];
    setMessages([]);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => say(briefing, true)}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 font-bold text-cloud hover:bg-ink/90"
        >
          <SpeakerIcon />
          Hear my day
        </button>
        {speaking && (
          <button
            type="button"
            onClick={stopTalking}
            className="inline-flex items-center gap-2 rounded-full border-2 border-ink/20 px-4 py-2.5 font-bold hover:border-ink"
          >
            <StopIcon />
            Stop talking
          </button>
        )}
      </div>

      <section aria-label={`Chat with ${MASCOT}`} className="mt-4 overflow-hidden rounded-3xl bg-cloud ring-1 ring-ink/10">
        <header className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Mascot size={30} label="" className="shrink-0" />
            <div className="min-w-0">
              <p className="font-display text-lg font-bold leading-tight">Ask {MASCOT}</p>
              <p className="truncate text-xs text-ink-soft">From your plan and Canvas</p>
            </div>
          </div>
          {messages.length > 0 && (
            <button type="button" onClick={clear} className="shrink-0 rounded-full px-3 py-1.5 text-sm font-bold text-ink-soft hover:bg-ink/5 hover:text-ink">
              Clear
            </button>
          )}
        </header>

        {/* The conversation for this day: the student's questions on the right, Sol's answers on the left. */}
        <div ref={chat} aria-live="polite" className="max-h-96 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
          {messages.length === 0 && !working && (
            <p className="text-[15px] leading-relaxed text-ink-soft">
              Ask about your classes, what’s due, your free time or how to get somewhere. Or tap a question below.
            </p>
          )}
          {messages.map((m, i) =>
            m.from === "you" ? (
              <p key={i} className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-sm bg-ink px-4 py-2.5 text-[15px] leading-relaxed text-cloud">
                <span className="sr-only">You: </span>
                {m.text}
              </p>
            ) : (
              <div key={i} className="flex items-start gap-2.5">
                {/* One avatar per run of Sol's messages. */}
                <span className="mt-0.5 w-7 shrink-0">{messages[i - 1]?.from !== "sol" && <Mascot size={28} label="" />}</span>
                <p className="w-fit max-w-[85%] rounded-2xl rounded-tl-sm bg-sun-soft/70 px-4 py-2.5 text-[15px] leading-relaxed ring-1 ring-sun/30">
                  <span className="sr-only">{MASCOT}: </span>
                  {m.text}
                </p>
              </div>
            ),
          )}
          {working && (
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 w-7 shrink-0">{messages.at(-1)?.from !== "sol" && <Mascot size={28} label="" />}</span>
              <p className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-sun-soft/70 px-4 py-3.5 ring-1 ring-sun/30">
                <span className="sr-only">{MASCOT} is thinking</span>
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-ink/50 motion-safe:animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-ink/10 px-4 pt-3 pb-4">
          {/* Ready-made questions: answered by code, so they work even when the AI is out. */}
          {/* One row that scrolls sideways on a phone, so the questions don't push the chat off screen. */}
          <div
            className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
            role="group"
            aria-label={`Quick questions for ${MASCOT}`}
          >
            {CHIPS.map((c) => (
              <button
                key={c.text}
                type="button"
                disabled={working}
                onClick={() => void handle(c.text)}
                className="min-h-9 shrink-0 whitespace-nowrap rounded-full border border-ink/15 bg-sky/40 px-3 py-1 text-sm font-bold text-ink hover:border-ink/40 hover:bg-sky disabled:opacity-50"
              >
                {c.text}
              </button>
            ))}
          </div>

          <form
            onSubmit={submit}
            className="mt-3 flex items-center gap-1 rounded-full border-2 border-ink/15 bg-cloud py-1 pr-1 pl-4 focus-within:border-ink"
          >
            <label className="sr-only" htmlFor="command">
              Ask {MASCOT} anything about your day
            </label>
            <input
              id="command"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={listening ? "Listening…" : "Ask about your day"}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent py-1.5 outline-none placeholder:text-ink-soft/70"
            />
            <button
              type="button"
              onClick={listen}
              aria-pressed={listening}
              aria-label={listening ? "Stop listening" : `Ask ${MASCOT} out loud`}
              title={listening ? "Stop listening" : "Speak"}
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                listening ? "bg-dusk text-cloud motion-safe:animate-pulse" : "text-ink hover:bg-ink/10"
              }`}
            >
              <MicIcon />
            </button>
            <button
              type="submit"
              disabled={working || !typed.trim()}
              aria-label="Send"
              title="Send"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-cloud hover:bg-ink/90 disabled:bg-ink/25"
            >
              <SendIcon />
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

const icon = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

function MicIcon() {
  return (
    <svg {...icon}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg {...icon}>
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg {...icon}>
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg {...icon}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}
