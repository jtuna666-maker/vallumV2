import { notFound } from "next/navigation";
import { getProjectDetail } from "@/lib/projects";
import Workspace from "@/components/workspace";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getProjectDetail(id);
  if (!detail) notFound();

  // A new key when the chapter set changes (e.g. custom chapter added)
  // remounts the workspace with the refreshed server data.
  return <Workspace key={detail.chapters.map((c) => c.id).join(".")} detail={detail} />;
}
