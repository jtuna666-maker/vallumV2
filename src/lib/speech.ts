"use client";

import { Capacitor } from "@capacitor/core";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";

/**
 * Unified dictation layer.
 * - Inside the iOS shell (Capacitor) → native SFSpeechRecognizer via plugin.
 * - In any browser → Web Speech API when available.
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

/* ---------------- Web Speech API path ---------------- */

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

function startWeb(cb: DictationCallbacks): DictationHandle | null {
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

/* ---------------- Native (Capacitor) path ---------------- */

async function startNative(cb: DictationCallbacks): Promise<DictationHandle | null> {
  try {
    // Android's on-device popup flow returns matches from start(); we use the
    // streaming path on both platforms for a consistent, silent UX.
    let lastHeard = "";
    let ended = false;

    const finish = async (commit: boolean) => {
      if (ended) return;
      ended = true;
      try {
        await SpeechRecognition.removeAllListeners();
      } catch {
        /* noop */
      }
      if (commit && lastHeard) cb.onCommit(lastHeard);
      cb.onEnd();
    };

    await SpeechRecognition.removeAllListeners();
    await SpeechRecognition.addListener(
      "partialResults",
      (data: { matches: string[] }) => {
        const text = data.matches?.[0]?.trim() ?? "";
        if (!text) return;
        lastHeard = text;
        cb.onPreview?.(text);
      }
    );
    await SpeechRecognition.addListener(
      "listeningState",
      (data: { status: "started" | "stopped" }) => {
        if (data.status === "stopped") void finish(true);
      }
    );

    await SpeechRecognition.start({
      language: "en-US",
      partialResults: true,
      popup: false,
      maxResults: 1,
    });

    return {
      stop: async () => {
        try {
          await SpeechRecognition.stop();
        } catch {
          /* already stopped */
        }
        await finish(true);
      },
    };
  } catch {
    return null;
  }
}

/* ---------------- Public API ---------------- */

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function checkSpeechSupport(): Promise<boolean> {
  if (isNative()) {
    try {
      const { available } = await SpeechRecognition.available();
      return available;
    } catch {
      return false;
    }
  }
  return getWebCtor() !== null;
}

/** Requests permissions natively before starting; resolves null if unavailable/denied. */
export async function startDictation(
  cb: DictationCallbacks
): Promise<DictationHandle | null> {
  if (isNative()) {
    try {
      const { available } = await SpeechRecognition.available();
      if (!available) return null;
      const perms = await SpeechRecognition.requestPermissions();
      if (perms.speechRecognition !== "granted") return null;
      return await startNative(cb);
    } catch {
      return null;
    }
  }
  return startWeb(cb);
}
