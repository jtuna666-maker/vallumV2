import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { sessionUser } from "@/lib/auth";
import SignInForm from "@/components/sign-in-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // Only a real signed-in account skips this page — the ambient demo must not
  // block visitors from signing in as themselves.
  const user = await sessionUser();
  if (user) {
    redirect(next && next.startsWith("/") ? next : "/app");
  }
  return <SignInForm />;
}
