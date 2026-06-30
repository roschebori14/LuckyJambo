import { redirect } from "next/navigation";
import { getUser } from "./get-user";

export async function requireAuth() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
