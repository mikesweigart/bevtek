import { AssistantChat } from "./AssistantChat";

export default function AssistantPage() {
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Ask Megan</h1>
        <p className="text-sm text-[color:var(--color-muted)]">
          Your AI beverage expert. Ask anything — she&apos;ll guide you to the
          perfect recommendation.
        </p>
      </div>
      <AssistantChat />
    </div>
  );
}
