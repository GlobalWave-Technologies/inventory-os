import { createFileRoute } from "@tanstack/react-router";
import { PasswordTokenScreen } from "@/components/PasswordTokenScreen";

export const Route = createFileRoute("/activate")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  head: () => ({ meta: [{ title: "Activate account — StockLine Inventory" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: ActivatePage,
});

function ActivatePage() {
  const { token } = Route.useSearch();
  return <PasswordTokenScreen token={token} mode="activate" />;
}
