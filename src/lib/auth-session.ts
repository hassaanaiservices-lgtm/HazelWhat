import { cookies } from "next/headers";
import { NextRequest } from "next/server";

export interface SessionUser {
  role: "admin" | "client";
  tenantId: string;
  username?: string;
  name?: string;
  businessName?: string;
  email?: string;
}

export async function getSessionFromCookies(request?: NextRequest): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();

    // 1. Check client session first
    const clientCookie = cookieStore.get("hazel_client_session");
    if (clientCookie && clientCookie.value) {
      const session = JSON.parse(clientCookie.value);
      if (session.role === "client" && session.tenantId) {
        return session;
      }
    }

    // 2. Check admin session
    const adminCookie = cookieStore.get("hazel_admin_session");
    if (adminCookie && adminCookie.value) {
      const session = JSON.parse(adminCookie.value);
      if (session.role === "admin") {
        const queryTenantId = request?.nextUrl?.searchParams?.get("tenantId");
        return {
          ...session,
          tenantId: queryTenantId || session.tenantId || "admin"
        };
      }
    }

    // 3. Fallback check for old unified session cookie
    const oldCookie = cookieStore.get("hazel_session");
    if (oldCookie && oldCookie.value) {
      const session = JSON.parse(oldCookie.value);
      if (session.tenantId) {
        return session;
      }
    }
  } catch (e) {
    console.error("[Session Helper] Error reading session cookie:", e);
  }
  return null;
}

export async function getTenantIdFromRequest(request?: NextRequest): Promise<string | undefined> {
  const session = await getSessionFromCookies(request);
  return session?.tenantId;
}
