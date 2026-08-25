"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { THEMES } from "@/lib/templates";

export default function NewProjectForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [dedication, setDedication] = useState("");
  const [theme, setTheme] = useState<string>("parchment");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !authorName.trim()) {
      setError("Give the book a title and tell us whose story it is.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), authorName: authorName.trim(), dedication: dedication.trim(), theme }),
      });
      if (!res.ok) throw new Error("Failed to create memoir");
      const data = (await res.json()) as { project: { id: string } };
      router.push(`/app/project/${data.project.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div>
        <label className="mb-1.5 block text-[0.68rem] font-semibold tracking-wide text-ink-soft">
          WORKING TITLE
        </label>
        <input
          className="field"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="The Way It Was"
          maxLength={200}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[0.68rem] font-semibold tracking-wide text-ink-soft">
          WHOSE STORY IS THIS?
        </label>
        <input
          className="field"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder="Eleanor Whitfield"
          maxLength={120}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[0.68rem] font-semibold tracking-wide text-ink-soft">
          DEDICATION <span className="font-normal text-ink-faint">(optional)</span>
        </label>
        <input
          className="field"
          value={dedication}
          onChange={(e) => setDedication(e.target.value)}
          placeholder="For the ones who come after"
          maxLength={400}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[0.68rem] font-semibold tracking-wide text-ink-soft">
          EDITION
        </label>
        <div className="flex gap-2.5">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              className={`flex flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                theme === t.id
                  ? "border-bronze bg-bronze/10 text-bronze-deep"
                  : "border-line bg-white/50 text-ink-soft hover:border-bronze/50"
              }`}
            >
              <span
                className="size-4 rounded-full border border-ink/20"
                style={{ background: t.swatch }}
              />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-oxblood">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="group flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-ink py-3 text-sm font-semibold text-paper transition hover:bg-bronze-deep disabled:opacity-60"
      >
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Binding your chapters…
          </>
        ) : (
          <>
            Create the memoir
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </button>
      <p className="text-center text-[0.68rem] text-ink-faint">
        Free forever · twelve chapters appear instantly
      </p>
    </form>
  );
}
