import { createFileRoute } from "@tanstack/react-router";
import { PasswordTokenScreen } from "@/components/PasswordTokenScreen";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  head: () => ({ meta: [{ title: "Reset password — StockLine Inventory" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  return <PasswordTokenScreen token={token} mode="reset" />;
}
