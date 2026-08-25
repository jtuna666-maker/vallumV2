"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Circle,
  CircleDot,
  CheckCircle2,
  Cloud,
  CloudUpload,
  ImagePlus,
  Loader2,
  Mic,
  MicOff,
  Plus,
  Printer,
  Sparkles,
  Trash2,
  Users,
  Wand2,
} from "lucide-react";
import type { ChapterWithQuestions, ProjectDetail } from "@/lib/projects";
import { countWords, formatCompact } from "@/lib/words";
import { HARDCOVER_PAGE_GOAL } from "@/lib/templates";
import {
  checkSpeechSupport,
  startDictation,
  type DictationHandle,
} from "@/lib/speech";
import { hapticConfirm, hapticTap } from "@/lib/native";
import SharePanel from "@/components/share-panel";

type Status = "unwritten" | "drafting" | "complete";
type SaveState = "idle" | "saving" | "saved";

/* ---------- progress ring ---------- */
function Ring({ pct, size = 44 }: { pct: number; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={4} className="text-ink/10" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (c * Math.min(pct, 100)) / 100}
        className="text-bronze transition-all duration-700"
      />
    </svg>
  );
}

const STATUS_META: Record<Status, { label: string; icon: typeof Circle; cls: string }> = {
  unwritten: { label: "Not started", icon: Circle, cls: "text-ink-faint" },
  drafting: { label: "Drafting", icon: CircleDot, cls: "text-bronze" },
  complete: { label: "Complete", icon: CheckCircle2, cls: "text-moss" },
};

export default function Workspace({ detail }: { detail: ProjectDetail }) {
  const router = useRouter();
  const { project } = detail;

  /* ordered chapters (local state so in-era reordering is optimistic) + era grouping */
  const [ordered, setOrdered] = useState<ChapterWithQuestions[]>(() =>
    [...detail.chapters].sort((a, b) => a.orderIndex - b.orderIndex)
  );
  const eras = useMemo(() => {
    const map = new Map<string, ChapterWithQuestions[]>();
    for (const ch of ordered) {
      const list = map.get(ch.era) ?? [];
      list.push(ch);
      map.set(ch.era, list);
    }
    return [...map.entries()];
  }, [ordered]);

  /* local editable state */
  const [activeId, setActiveId] = useState(ordered[0]?.id ?? "");
  const [contents, setContents] = useState<Record<string, string>>(
    () => Object.fromEntries(ordered.map((c) => [c.id, c.content]))
  );
  const [statuses, setStatuses] = useState<Record<string, Status>>(
    () => Object.fromEntries(ordered.map((c) => [c.id, c.status as Status]))
  );
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const c of ordered) for (const q of c.questions) out[q.id] = q.answer;
    return out;
  });
  const [photos, setPhotos] = useState<Record<string, { url: string; caption: string }>>(() =>
    Object.fromEntries(
      ordered.map((c) => [c.id, { url: c.imageUrl, caption: c.imageCaption }])
    )
  );
  const [polishing, setPolishing] = useState(false);
  const [extraQs, setExtraQs] = useState<Record<string, { id: string; text: string }[]>>({});
  const [askingMore, setAskingMore] = useState(false);
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [listeningFor, setListeningFor] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const answersRef = useRef(answers);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const dictationRef = useRef<DictationHandle | null>(null);

  // Keep a live handle on the latest answers for dictation callbacks without
  // restructuring the closures. (Refs must be mutated in an effect, not render.)
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const active = ordered.find((c) => c.id === activeId) ?? ordered[0];

  /** template questions + any follow-ups generated this session */
  const questionsFor = useCallback(
    (c: ChapterWithQuestions) => [...c.questions, ...(extraQs[c.id] ?? [])],
    [extraQs]
  );

  /* progress */
  const totalQ = useMemo(
    () => ordered.reduce((s, c) => s + questionsFor(c).length, 0),
    [ordered, questionsFor]
  );
  const answeredQ = useMemo(
    () =>
      ordered.reduce(
        (s, c) =>
          s + questionsFor(c).filter((q) => (answers[q.id] ?? "").trim().length > 0).length,
        0
      ),
    [ordered, questionsFor, answers]
  );
  const completeCount = useMemo(
    () => ordered.filter((c) => statuses[c.id] === "complete").length,
    [ordered, statuses]
  );
  const wordTotal = useMemo(() => {
    let w = 0;
    for (const c of ordered) w += countWords(contents[c.id] ?? "");
    for (const a of Object.values(answers)) w += countWords(a);
    return w;
  }, [ordered, contents, answers]);

  /* ---------- saving ---------- */
  const patch = useCallback(async (url: string, body: Record<string, unknown>) => {
    setSaveState("saving");
    try {
      await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setSaveState("saved");
    } catch {
      setSaveState("idle");
    }
  }, []);

  const debounced = useCallback(
    (key: string, fn: () => void, ms = 800) => {
      setSaveState("saving");
      clearTimeout(timersRef.current[key]);
      timersRef.current[key] = setTimeout(fn, ms);
    },
    []
  );

  function setAnswer(qId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
    debounced(`q:${qId}`, () => void patch(`/api/questions/${qId}`, { answer: value }));
  }

  function setContent(cId: string, value: string) {
    setContents((prev) => ({ ...prev, [cId]: value }));
    if (statuses[cId] === "unwritten" && value.trim().length > 0) {
      setStatus(cId, "drafting");
    }
    debounced(`c:${cId}`, () => void patch(`/api/chapters/${cId}`, { content: value }));
  }

  function setStatus(cId: string, status: Status) {
    setStatuses((prev) => ({ ...prev, [cId]: status }));
    void patch(`/api/chapters/${cId}`, { status });
    if (status === "complete") void hapticConfirm();
  }

  function moveChapter(cId: string, dir: -1 | 1) {
    const idx = ordered.findIndex((c) => c.id === cId);
    if (idx < 0) return;
    const era = ordered[idx].era;
    let otherIdx = -1;
    for (let i = idx + dir; i >= 0 && i < ordered.length; i += dir) {
      if (ordered[i].era === era) {
        otherIdx = i;
        break;
      }
      break; // eras are contiguous — don't cross an era boundary
    }
    if (otherIdx < 0) return;

    const a = ordered[idx];
    const b = ordered[otherIdx];
    const next = ordered.map((c) =>
      c.id === a.id
        ? { ...c, orderIndex: b.orderIndex }
        : c.id === b.id
          ? { ...c, orderIndex: a.orderIndex }
          : c
    );
    next.sort((x, y) => x.orderIndex - y.orderIndex);
    setOrdered(next);
    void hapticTap();

    void fetch("/api/chapters/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        a: { id: a.id, orderIndex: b.orderIndex },
        b: { id: b.id, orderIndex: a.orderIndex },
      }),
    }).then(() => router.refresh());
  }

  function setPhoto(cId: string, url: string, caption: string) {
    setPhotos((prev) => ({ ...prev, [cId]: { url, caption } }));
    debounced(`photo:${cId}`, () =>
      void patch(`/api/chapters/${cId}`, {
        imageUrl: url.trim(),
        imageCaption: caption.trim(),
      })
    );
  }

  async function askAnother() {
    if (askingMore) return;
    setAskingMore(true);
    try {
      const res = await fetch(`/api/chapters/${active.id}/questions`, { method: "POST" });
      if (res.ok) {
        const data = (await res.json()) as { question: { id: string; text: string } };
        setExtraQs((prev) => ({
          ...prev,
          [active.id]: [...(prev[active.id] ?? []), { id: data.question.id, text: data.question.text }],
        }));
        setAnswers((prev) => ({ ...prev, [data.question.id]: "" }));
        void hapticTap();
      }
    } finally {
      setAskingMore(false);
    }
  }

  async function polishChapter() {
    const text = (contents[active.id] ?? "").trim();
    if (!text || polishing) return;
    setPolishing(true);
    try {
      const res = await fetch("/api/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const data = (await res.json()) as { polished?: string };
        if (data.polished && data.polished !== text) {
          setContent(active.id, data.polished);
          void hapticConfirm();
        }
      }
    } finally {
      setPolishing(false);
    }
  }

  function compileFromAnswers(ch: ChapterWithQuestions) {
    const parts = questionsFor(ch)
      .map((q) => (answers[q.id] ?? "").trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const current = (contents[ch.id] ?? "").trim();
    const compiled = current
      ? `${current}\n\n${parts.join("\n\n")}`
      : parts.join("\n\n");
    setContent(ch.id, compiled);
  }

  function saveTitle(next: string) {
    const clean = next.trim();
    if (!clean || clean === project.title) {
      setTitle(project.title);
      return;
    }
    debounced("title", () => void patch(`/api/projects/${project.id}`, { title: clean }), 500);
  }

  async function deleteProject() {
    setDeleting(true);
    await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    router.push("/app");
    router.refresh();
  }

  /* ---------- voice (native SFSpeechRecognizer in the iOS shell, Web Speech API in browsers) ---------- */
  async function toggleMic(qId: string) {
    const wasListeningToThis = listeningFor === qId;

    // stop any active session first (its onEnd fires synchronously)
    if (dictationRef.current) {
      const active = dictationRef.current;
      dictationRef.current = null;
      await active.stop();
      void hapticTap();
    }
    if (wasListeningToThis) return;

    let base = answersRef.current[qId] ?? "";
    const join = (b: string, t: string) => {
      const clean = t.trim();
      if (!clean) return b;
      return b ? `${b.replace(/\s+$/, "")} ${clean}` : clean;
    };

    const handle = await startDictation({
      onPreview: (text) => setAnswer(qId, join(base, text)),
      onCommit: (text) => {
        base = join(base, text);
        setAnswer(qId, base);
      },
      onEnd: () => setListeningFor((cur) => (cur === qId ? null : cur)),
    });
    if (!handle) return;

    dictationRef.current = handle;
    setListeningFor(qId);
    void hapticTap();
  }

  useEffect(() => {
    void checkSpeechSupport().then(setSpeechSupported);
    return () => {
      if (dictationRef.current) {
        const active = dictationRef.current;
        dictationRef.current = null;
        void active.stop();
      }
      // Clearing ALL pending save timers on unmount intentionally reads the
      // latest map — none exist at mount time, so a mount-time copy would be empty.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const timers = timersRef.current;
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  const activeContent = contents[active.id] ?? "";
  const meta = STATUS_META[statuses[active.id] ?? "unwritten"];

  return (
    <div className="grain flex min-h-screen bg-paper">
      {/* ================= Sidebar ================= */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-80 flex-col border-r border-line bg-vellum lg:flex">
        <div className="border-b border-line px-6 pb-5 pt-6">
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 text-[0.7rem] font-semibold text-ink-faint transition hover:text-ink"
          >
            <ArrowLeft className="size-3.5" /> Back to shelf
          </Link>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={(e) => saveTitle(e.target.value)}
            className="display mt-3 w-full bg-transparent text-2xl font-semibold leading-tight outline-none transition focus:text-bronze-deep"
            aria-label="Memoir title"
          />
          <p className="mt-0.5 text-xs italic text-ink-faint">as told by {project.authorName}</p>

          <div className="mt-5 flex items-center gap-4 rounded-xl border border-line bg-paper p-3.5">
            <div className="relative">
              <Ring pct={totalQ ? (answeredQ / totalQ) * 100 : 0} />
              <span className="absolute inset-0 grid place-items-center text-[0.6rem] font-bold text-bronze-deep">
                {totalQ ? Math.round((answeredQ / totalQ) * 100) : 0}%
              </span>
            </div>
            <div className="text-[0.7rem] leading-relaxed text-ink-soft">
              <p>
                <strong className="text-ink">{answeredQ}</strong> of {totalQ} prompts answered
              </p>
              <p>
                <strong className="text-ink">{formatCompact(wordTotal)}</strong> words remembered
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-lg bg-ink px-3.5 py-2.5 text-paper">
            <span className="flex items-center gap-2 text-[0.68rem] font-medium text-paper/80">
              <BookOpen className="size-3.5 text-[#c9a15c]" />
              Hardcover goal
            </span>
            <span className="text-[0.68rem] font-semibold text-[#c9a15c]">
              {completeCount} / {HARDCOVER_PAGE_GOAL} chapters
            </span>
          </div>
        </div>

        <nav className="nice-scroll flex-1 overflow-y-auto px-4 py-4">
          {eras.map(([era, chs]) => (
            <div key={era} className="mb-5">
              <p className="smallcaps mb-2 px-2 text-[0.6rem] font-bold text-ink-faint">{era}</p>
              <ul className="space-y-0.5">
                {chs.map((ch) => {
                  const st = STATUS_META[statuses[ch.id] ?? "unwritten"];
                  const isActive = ch.id === active.id;
                  const Icon = st.icon;
                  return (
                    <li key={ch.id}>
                      <button
                        onClick={() => setActiveId(ch.id)}
                        className={`group flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
                          isActive
                            ? "bg-bronze/12 shadow-[inset_0_0_0_1px_rgb(154_98_36/0.3)]"
                            : "hover:bg-paper-deep/60"
                        }`}
                      >
                        <Icon className={`mt-0.5 size-3.5 shrink-0 ${st.cls}`} strokeWidth={2.2} />
                        <span>
                          <span
                            className={`display block text-[0.92rem] leading-snug ${
                              isActive ? "font-semibold text-bronze-deep" : "font-medium"
                            }`}
                          >
                            {ch.title}
                          </span>
                          <span className="block text-[0.62rem] text-ink-faint">
                            {countWords(contents[ch.id] ?? "")} words
                          </span>
                        </span>
                        {isActive && (
                          <ChevronRight className="ml-auto mt-1 size-3.5 text-bronze group-hover:hidden" />
                        )}
                        <span className="ml-auto mt-0.5 hidden flex-col group-hover:flex">
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              moveChapter(ch.id, -1);
                            }}
                            className="cursor-pointer rounded p-0.5 text-ink-faint transition hover:bg-bronze/15 hover:text-bronze-deep"
                            title="Move earlier in this era"
                          >
                            <ChevronUp className="size-3.5" />
                          </span>
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              moveChapter(ch.id, 1);
                            }}
                            className="cursor-pointer rounded p-0.5 text-ink-faint transition hover:bg-bronze/15 hover:text-bronze-deep"
                            title="Move later in this era"
                          >
                            <ChevronDown className="size-3.5" />
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <button
            onClick={() => setShowAddChapter(true)}
            className="mt-1 flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-dashed border-line px-3 py-2.5 text-left text-[0.78rem] font-medium text-ink-faint transition hover:border-bronze/50 hover:text-bronze-deep"
          >
            <Plus className="size-4" /> Add your own chapter
          </button>
        </nav>

        <div className="border-t border-line p-4">
          <Link
            href={`/app/project/${project.id}/preview`}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-ink py-2.5 text-[0.78rem] font-semibold text-paper transition hover:bg-bronze-deep"
          >
            <Printer className="size-3.5" /> Preview &amp; print the book
          </Link>
          <button
            onClick={() => setShowShare(true)}
            className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-line bg-paper py-2.5 text-[0.78rem] font-semibold text-ink-soft transition hover:border-bronze hover:text-bronze-deep"
          >
            <Users className="size-3.5" /> Share &amp; invite
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 py-1 text-[0.68rem] font-medium text-ink-faint transition hover:text-oxblood"
          >
            <Trash2 className="size-3" /> Delete this memoir
          </button>
        </div>
      </aside>

      {/* ================= Main ================= */}
      <main className="flex-1 lg:pl-80">
        {/* top bar */}
        <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line/70 bg-paper/85 px-5 backdrop-blur-md lg:px-10">
          <div className="flex items-center gap-3">
            <Link href="/app" className="flex items-center gap-2 lg:hidden">
              <span className="grid size-7 place-items-center rounded-md bg-ink text-paper">
                <BookOpen className="size-3.5" />
              </span>
            </Link>
            <span className="smallcaps text-[0.62rem] font-bold text-bronze-deep">{active.era}</span>
            <span className="hidden text-[0.7rem] text-ink-faint sm:inline">
              Chapter {ordered.indexOf(active) + 1} of {ordered.length}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[0.7rem] font-medium text-ink-faint">
              {saveState === "saving" ? (
                <>
                  <CloudUpload className="size-3.5 animate-pulse text-bronze" /> Saving…
                </>
              ) : saveState === "saved" ? (
                <>
                  <Cloud className="size-3.5 text-moss" /> All saved
                </>
              ) : (
                <>
                  <Check className="size-3.5 text-moss" /> Up to date
                </>
              )}
            </span>
            <Link
              href={`/app/project/${project.id}/preview`}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3.5 py-1.5 text-[0.72rem] font-semibold transition hover:border-bronze hover:text-bronze-deep lg:hidden"
            >
              <Printer className="size-3" /> Book
            </Link>
          </div>
        </div>

        {/* mobile chapter picker */}
        <div className="border-b border-line bg-vellum px-5 py-3 lg:hidden">
          <select
            value={active.id}
            onChange={(e) => setActiveId(e.target.value)}
            className="field text-sm font-medium"
          >
            {eras.map(([era, chs]) => (
              <optgroup key={era} label={era}>
                {chs.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="mx-auto max-w-3xl px-5 py-10 lg:px-10 lg:py-14">
          {/* chapter header */}
          <header>
            <p className="smallcaps text-[0.68rem] font-bold text-bronze-deep">
              {active.era} · Chapter {ordered.indexOf(active) + 1}
            </p>
            <h1 className="display mt-2 text-4xl font-medium tracking-tight md:text-5xl">
              {active.title}
            </h1>
            <p className="display mt-2 text-lg italic text-ink-soft">{active.subtitle}</p>

            <div className="mt-6 inline-flex items-center rounded-full border border-line bg-vellum p-1">
              {(Object.keys(STATUS_META) as Status[]).map((s) => {
                const m = STATUS_META[s];
                const isOn = (statuses[active.id] ?? "unwritten") === s;
                const Icon = m.icon;
                return (
                  <button
                    key={s}
                    onClick={() => setStatus(active.id, s)}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[0.7rem] font-semibold transition ${
                      isOn ? "bg-ink text-paper shadow" : "text-ink-soft hover:text-ink"
                    }`}
                  >
                    <Icon className="size-3.5" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </header>

          {/* interview prompts */}
          <section className="mt-12">
            <div className="flex items-center gap-3">
              <h2 className="display text-2xl font-semibold">The interview</h2>
              <span className="h-px flex-1 bg-line" />
              <Sparkles className="size-4 text-bronze" />
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Answer out loud or type — a few honest sentences each is plenty. Everything saves
              itself, and your answers feed the manuscript below.
            </p>

            <div className="mt-7 space-y-5">
              {questionsFor(active).map((q, qi) => {
                const value = answers[q.id] ?? "";
                const isListening = listeningFor === q.id;
                const done = value.trim().length > 0;
                return (
                  <div
                    key={q.id}
                    className={`rounded-2xl border bg-vellum p-6 shadow-lift transition ${
                      isListening ? "border-oxblood/50" : "border-line"
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <span className="display mt-0.5 text-xl font-medium text-bronze/70">
                        {String(qi + 1).padStart(2, "0")}
                      </span>
                      <p className="display flex-1 text-[1.05rem] font-medium leading-snug">
                        {q.text}
                      </p>
                      {done && <Check className="mt-1 size-4 shrink-0 text-moss" />}
                    </div>
                    <textarea
                      value={value}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                      rows={Math.min(8, Math.max(3, Math.ceil(value.length / 90)))}
                      placeholder={
                        isListening
                          ? "Listening — just talk. Your words appear here…"
                          : "Speak or type your answer… rambling welcome."
                      }
                      className="field prose-book mt-4 !text-[0.98rem] !leading-relaxed"
                    />
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[0.68rem] font-medium text-ink-faint">
                        {countWords(value)} words
                        {isListening && (
                          <span className="ml-2 text-oxblood">● recording</span>
                        )}
                      </span>
                      {speechSupported && (
                        <button
                          onClick={() => toggleMic(q.id)}
                          className={`flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-[0.72rem] font-semibold transition ${
                            isListening
                              ? "mic-live bg-oxblood text-paper"
                              : "bg-paper-deep text-ink-soft hover:bg-bronze hover:text-paper"
                          }`}
                        >
                          {isListening ? (
                            <>
                              <MicOff className="size-3.5" /> Stop
                            </>
                          ) : (
                            <>
                              <Mic className="size-3.5" /> Speak your answer
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              <button
                onClick={askAnother}
                disabled={askingMore}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-bronze/40 py-4 text-[0.78rem] font-semibold text-bronze-deep transition hover:border-bronze hover:bg-bronze/5 disabled:opacity-60"
              >
                {askingMore ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {askingMore ? "Thinking of a good one…" : "Ask me another question"}
              </button>
            </div>
          </section>

          {/* photograph */}
          <section className="mt-14">
            <div className="flex items-center gap-3">
              <h2 className="display text-2xl font-semibold">A photograph</h2>
              <span className="h-px flex-1 bg-line" />
              <ImagePlus className="size-4 text-bronze" />
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Optional — one image per chapter, typeset into your printed book beneath the chapter
              title.
            </p>
            <div className="mt-5 rounded-2xl border border-line bg-vellum p-6 shadow-lift">
              <div className="grid items-start gap-5 sm:grid-cols-[132px_1fr]">
                <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-lg border border-dashed border-line bg-paper-deep/50 text-ink-faint">
                  {photos[active.id]?.url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={photos[active.id].url}
                      alt={photos[active.id].caption || "Chapter photograph"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImagePlus className="size-6" strokeWidth={1.4} />
                  )}
                </div>
                <div className="space-y-3">
                  <input
                    className="field"
                    placeholder="Photo URL (https://…)"
                    value={photos[active.id]?.url ?? ""}
                    onChange={(e) =>
                      setPhoto(active.id, e.target.value, photos[active.id]?.caption ?? "")
                    }
                  />
                  <input
                    className="field"
                    placeholder="Caption — “Dad's truck, the summer it caught fire.”"
                    value={photos[active.id]?.caption ?? ""}
                    maxLength={300}
                    onChange={(e) =>
                      setPhoto(active.id, photos[active.id]?.url ?? "", e.target.value)
                    }
                  />
                  <p className="text-[0.68rem] text-ink-faint">
                    Leave empty for a text-only chapter. Saves automatically.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* manuscript */}
          <section className="mt-14">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="display text-2xl font-semibold">The manuscript</h2>
              <span className="h-px flex-1 bg-line" />
              <button
                onClick={() => compileFromAnswers(active)}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-bronze/40 px-4 py-2 text-[0.72rem] font-semibold text-bronze-deep transition hover:bg-bronze hover:text-paper"
              >
                <Sparkles className="size-3.5" /> Gather my answers into the chapter
              </button>
              <button
                onClick={polishChapter}
                disabled={polishing || !(contents[active.id] ?? "").trim()}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-ink/20 px-4 py-2 text-[0.72rem] font-semibold text-ink-soft transition hover:border-bronze hover:text-bronze-deep disabled:cursor-not-allowed disabled:opacity-50"
              >
                {polishing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Wand2 className="size-3.5" />
                )}
                {polishing ? "Polishing…" : "Polish my prose"}
              </button>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              This is the chapter exactly as it will appear in your printed book. Shape it freely —
              it&apos;s yours.
            </p>
            <div className="shadow-book relative mt-6 rounded-2xl border border-line bg-vellum p-8 md:p-12">
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-bronze/40 to-transparent" />
              <textarea
                value={activeContent}
                onChange={(e) => setContent(active.id, e.target.value)}
                rows={Math.min(28, Math.max(10, activeContent.split("\n").length + 4))}
                placeholder="The page is warm and waiting. Gather your answers above, or begin directly…"
                className="manuscript-area prose-book"
              />
              <div className="mt-4 flex items-center justify-between border-t border-line/70 pt-3 text-[0.68rem] font-medium text-ink-faint">
                <span className="flex items-center gap-1.5">
                  {meta.label === "Complete" && <CheckCircle2 className="size-3.5 text-moss" />}
                  {countWords(activeContent)} words on this page
                </span>
                <span className="italic">Saves as you write</span>
              </div>
            </div>

            {/* next chapter */}
            {ordered.indexOf(active) < ordered.length - 1 && (
              <button
                onClick={() => {
                  const next = ordered[ordered.indexOf(active) + 1];
                  setActiveId(next.id);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="group mt-8 flex w-full cursor-pointer items-center justify-between rounded-xl border border-line bg-vellum px-6 py-5 text-left shadow-lift transition hover:border-bronze/50"
              >
                <span>
                  <span className="smallcaps text-[0.6rem] font-bold text-ink-faint">
                    Up next · {ordered[ordered.indexOf(active) + 1].era}
                  </span>
                  <span className="display mt-1 block text-xl font-semibold">
                    {ordered[ordered.indexOf(active) + 1].title}
                  </span>
                </span>
                <span className="grid size-10 place-items-center rounded-full bg-ink text-paper transition group-hover:bg-bronze-deep">
                  <ChevronRight className="size-4.5" />
                </span>
              </button>
            )}
          </section>
        </div>
      </main>

      {/* delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-5 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-line bg-vellum p-7 shadow-book">
            <h3 className="display text-xl font-semibold">Burn this memoir?</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">
              &ldquo;{title}&rdquo; and every answer inside it will be permanently deleted. Stories
              this good deserve better — but it&apos;s your call.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 cursor-pointer rounded-full border border-ink/20 py-2.5 text-sm font-semibold transition hover:border-bronze"
              >
                Keep it
              </button>
              <button
                onClick={deleteProject}
                disabled={deleting}
                className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-oxblood py-2.5 text-sm font-semibold text-paper transition hover:bg-bronze-deep disabled:opacity-60"
              >
                {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showShare && (
        <SharePanel
          projectId={project.id}
          shareToken={project.shareToken}
          onClose={() => setShowShare(false)}
        />
      )}

      {showAddChapter && (
        <AddChapterModal
          projectId={project.id}
          eras={eras.map(([era]) => era)}
          onClose={() => setShowAddChapter(false)}
          onCreated={() => {
            setShowAddChapter(false);
            void hapticConfirm();
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/* ================= Add chapter modal ================= */
function AddChapterModal({
  projectId,
  eras,
  onClose,
  onCreated,
}: {
  projectId: string;
  eras: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [era, setEra] = useState(eras[0] ?? "Roots");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Give the chapter a title.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          era,
          title: title.trim(),
          subtitle: subtitle.trim(),
          question: question.trim(),
        }),
      });
      if (!res.ok) throw new Error();
      onCreated();
    } catch {
      setError("Couldn't add the chapter. Please try again.");
      setBusy(false);
    }
  }

  const labelCls = "mb-1.5 block text-[0.68rem] font-semibold tracking-wide text-ink-soft";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-5 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-line bg-vellum p-7 shadow-book"
      >
        <h3 className="display text-xl font-semibold">Add your own chapter</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
          Some memories don&apos;t fit the twelve. Place it in an era, name it, and seed it with
          one question if you like.
        </p>
        <div className="mt-5 space-y-4">
          <div>
            <label className={labelCls}>ERA</label>
            <select className="field" value={era} onChange={(e) => setEra(e.target.value)}>
              {eras.map((er) => (
                <option key={er} value={er}>
                  {er}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>CHAPTER TITLE</label>
            <input
              className="field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="The Year at the Lake"
              maxLength={200}
            />
          </div>
          <div>
            <label className={labelCls}>
              SUBTITLE <span className="font-normal text-ink-faint">(optional)</span>
            </label>
            <input
              className="field"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="What everyone remembers differently"
              maxLength={200}
            />
          </div>
          <div>
            <label className={labelCls}>
              FIRST QUESTION <span className="font-normal text-ink-faint">(optional)</span>
            </label>
            <textarea
              className="field"
              rows={2}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What really happened that August?"
              maxLength={400}
            />
          </div>
          {error && <p className="text-xs text-oxblood">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 cursor-pointer rounded-full border border-ink/20 py-2.5 text-sm font-semibold transition hover:border-bronze"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-ink py-2.5 text-sm font-semibold text-paper transition hover:bg-bronze-deep disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Add chapter
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
