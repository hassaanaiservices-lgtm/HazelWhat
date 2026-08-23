import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJWT } from "@/lib/auth-session";
import VoiceSaaSApp from "./admin-client";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("hazel_admin_session")?.value;
  const session = await verifyJWT(adminCookie);

  if (!session || session.role !== "admin") {
    redirect("/login?portal=admin");
  }

  return <VoiceSaaSApp />;
}
