import { redirect } from "next/navigation";
import { getUser } from "./get-user";

export async function redirectIfAuthenticated() {
  const user = await getUser();

  if (user) {
    redirect("/dashboard");
  }
}
