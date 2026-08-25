"use client";

/**
 * Dictation layer backed by the browser Web Speech API.
 *
 * Callback semantics:
 * - onPreview(text): live interim transcript of the CURRENT utterance.
 *   Replaceable — re-render it over the session's base text, never append.
 * - onCommit(text): finalized text. Safe to append permanently.
 * - onEnd(): the session ended (silence, explicit stop, or error).
 */
export type DictationCallbacks = {
  onPreview?: (text: string) => void;
  onCommit: (text: string) => void;
  onEnd: () => void;
};

export type DictationHandle = {
  stop: () => Promise<void>;
};

type WebRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult:
    | ((e: {
        resultIndex: number;
        results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getWebCtor(): (new () => WebRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    | (new () => WebRecognition)
    | null;
}

export async function checkSpeechSupport(): Promise<boolean> {
  return getWebCtor() !== null;
}

export async function startDictation(cb: DictationCallbacks): Promise<DictationHandle | null> {
  const Ctor = getWebCtor();
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = false;
  rec.lang = "en-US";

  let ended = false;
  const finish = () => {
    if (ended) return;
    ended = true;
    cb.onEnd();
  };

  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) cb.onCommit(res[0].transcript.trim());
    }
  };
  rec.onend = finish;
  rec.onerror = finish;

  try {
    rec.start();
  } catch {
    return null;
  }

  return {
    stop: async () => {
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
      finish();
    },
  };
}