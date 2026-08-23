import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJWT } from "@/lib/auth-session";
import DashboardPage from "./client-dashboard";

export default async function ClientPage() {
  const cookieStore = await cookies();
  const clientCookie = cookieStore.get("hazel_client_session")?.value;
  const session = await verifyJWT(clientCookie);

  if (!session || session.role !== "client") {
    redirect("/login?portal=client");
  }

  return <DashboardPage />;
}
