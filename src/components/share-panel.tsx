"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, Loader2, Trash2, UserPlus, Users, X } from "lucide-react";

type Member = { userId: string; email: string; name: string; role: string };

export default function SharePanel({
  projectId,
  shareToken,
  onClose,
}: {
  projectId: string;
  shareToken: string;
  onClose: () => void;
}) {
  const [token, setToken] = useState(shareToken);
  // Client-only panel (mounted after a click), so reading window on init is
  // safe and avoids a setState-in-effect + SSR hydration mismatch.
  const [origin] = useState(() =>
    typeof window === "undefined" ? "" : window.location.origin
  );
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const res = await fetch(`/api/projects/${projectId}/members`);
    if (res.ok) {
      const data = (await res.json()) as { members: Member[] };
      setMembers(data.members);
    }
  }

  async function createLink() {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/share`, { method: "POST" });
      if (res.ok) {
        const data = (await res.json()) as { shareToken: string };
        setToken(data.shareToken);
      }
    } finally {
      setBusy(false);
    }
  }

  async function revokeLink() {
    setBusy(true);
    try {
      await fetch(`/api/projects/${projectId}/share`, { method: "DELETE" });
      setToken("");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!origin || !token) return;
    try {
      await navigator.clipboard.writeText(`${origin}/share/${token}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard denied */
    }
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = (await res.json()) as { member?: Member; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Invite failed");
      setEmail("");
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(userId: string) {
    await fetch(`/api/projects/${projectId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    void load();
  }

  const labelCls = "mb-1.5 block text-[0.68rem] font-semibold tracking-wide text-ink-soft";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-5 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-vellum p-7 shadow-book nice-scroll"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="display text-xl font-semibold">Share this memoir</h3>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              A read-only link for the finished pages — or invite family to write with you.
            </p>
          </div>
          <button onClick={onClose} className="cursor-pointer rounded-full p-1.5 text-ink-faint transition hover:bg-paper-deep hover:text-ink">
            <X className="size-4" />
          </button>
        </div>

        {/* read-only link */}
        <div className="mt-6">
          <p className={labelCls}>READ-ONLY BOOK LINK</p>
          {token ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-line bg-white/60 px-3.5 py-2.5 text-[0.72rem] text-ink-soft">
                <Link2 className="size-3.5 shrink-0 text-bronze" />
                <span className="truncate">{origin}/share/{token}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={copy}
                  className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-ink py-2 text-[0.72rem] font-semibold text-paper transition hover:bg-bronze-deep"
                >
                  {copied ? <Check className="size-3.5 text-[#c9a15c]" /> : <Copy className="size-3.5" />}
                  {copied ? "Copied" : "Copy link"}
                </button>
                <button
                  onClick={revokeLink}
                  disabled={busy}
                  className="cursor-pointer rounded-full border border-ink/20 px-4 py-2 text-[0.72rem] font-semibold transition hover:border-oxblood hover:text-oxblood disabled:opacity-50"
                >
                  Revoke
                </button>
              </div>
              <p className="text-[0.65rem] text-ink-faint">
                Anyone with the link can read — not edit — the typeset book. Revoke rotates a new link on next creation.
              </p>
            </div>
          ) : (
            <button
              onClick={createLink}
              disabled={busy}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-bronze/40 py-2.5 text-[0.75rem] font-semibold text-bronze-deep transition hover:bg-bronze hover:text-paper disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
              Create a read-only link
            </button>
          )}
        </div>

        {/* collaborators */}
        <div className="mt-7 border-t border-line pt-6">
          <p className={labelCls}>
            <Users className="mr-1.5 inline size-3.5 -translate-y-px text-bronze" />
            PEOPLE WRITING WITH YOU
          </p>
          {members.length > 0 && (
            <ul className="mb-4 space-y-2">
              {members.map((m) => (
                <li key={m.userId} className="flex items-center gap-3 rounded-lg border border-line bg-white/50 px-3.5 py-2.5">
                  <span className="grid size-7 place-items-center rounded-full bg-paper-deep text-[0.65rem] font-bold text-bronze-deep">
                    {(m.name || m.email).slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.78rem] font-medium">{m.name || m.email}</span>
                    <span className="block truncate text-[0.62rem] text-ink-faint">{m.email}</span>
                  </span>
                  <span className="rounded-full bg-paper-deep px-2.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-ink-soft">
                    {m.role}
                  </span>
                  {m.role !== "owner" && (
                    <button
                      onClick={() => remove(m.userId)}
                      className="cursor-pointer rounded-full p-1 text-ink-faint transition hover:text-oxblood"
                      title="Remove"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={invite} className="flex items-start gap-2">
            <input
              type="email"
              required
              className="field flex-1 !py-2"
              placeholder="sister@family.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <select
              className="field w-28 !py-2 text-[0.72rem]"
              value={role}
              onChange={(e) => setRole(e.target.value as "editor" | "viewer")}
            >
              <option value="editor">Can write</option>
              <option value="viewer">Read only</option>
            </select>
            <button
              type="submit"
              disabled={busy}
              className="flex cursor-pointer items-center gap-1.5 rounded-full bg-oxblood px-4 py-2 text-[0.72rem] font-semibold text-paper transition hover:bg-bronze-deep disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
              Invite
            </button>
          </form>
          {error && <p className="mt-2 text-xs text-oxblood">{error}</p>}
          <p className="mt-2.5 text-[0.65rem] leading-relaxed text-ink-faint">
            Writers can answer questions and edit chapters. Everyone signs in with a six-digit email
            code — no passwords.
          </p>
        </div>
      </div>
    </div>
  );
}
