"use client";

import { useRouter } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";

export default function UserMenu({ email, name }: { email: string; name: string }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden items-center gap-2 rounded-full border border-line bg-vellum px-3.5 py-1.5 text-[0.72rem] font-medium text-ink-soft sm:flex">
        <UserRound className="size-3.5 text-bronze" />
        {name || email}
      </span>
      <button
        onClick={logout}
        title="Sign out"
        className="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.72rem] font-medium text-ink-faint transition hover:text-oxblood"
      >
        <LogOut className="size-3.5" />
        <span className="hidden sm:inline">Sign out</span>
      </button>
    </div>
  );
}
