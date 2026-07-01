import { redirect } from "next/navigation";

// This route predates /wallet/deposit, which is the real, fully wired
// deposit page (auth-guarded, real balance/history, functional Fapshi
// flow). Keeping this as a redirect instead of deleting it so any
// old bookmarks/links to /deposit still land somewhere that works.
export default function LegacyDepositPage() {
  redirect("/wallet/deposit");
}
