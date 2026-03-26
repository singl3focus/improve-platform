import { redirect } from "next/navigation";
import { TopicWorkspaceView } from "@features/topics/components/topic-workspace-view";

interface TopicsPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

function getTopicId(value: string | string[] | undefined): string | null {
  if (typeof value === "string") {
    const topicId = value.trim();
    return topicId.length > 0 ? topicId : null;
  }

  if (Array.isArray(value) && value.length > 0) {
    const topicId = value[0]?.trim() ?? "";
    return topicId.length > 0 ? topicId : null;
  }

  return null;
}

export default function TopicsPage({ searchParams }: TopicsPageProps) {
  const topicId = getTopicId(searchParams?.topicId);

  if (!topicId) {
    redirect("/roadmap");
  }

  return <TopicWorkspaceView />;
}
