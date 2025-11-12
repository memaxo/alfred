import { createFileRoute } from "@tanstack/react-router";
import { ChatContainer } from "@/components/chat-container";
import { RouteError } from "@/components/route-error";

export const Route = createFileRoute("/ai")({
  component: RouteComponent,
  errorComponent: RouteError,
});

function RouteComponent() {
  return <ChatContainer agent="assistant" />;
}
