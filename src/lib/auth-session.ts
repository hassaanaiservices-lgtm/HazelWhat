import { NextRequest } from "next/server";

export interface SessionUser {
  role: "admin" | "client";
  tenantId: string;
  username?: string;
  name?: string;
  businessName?: string;
  email?: string;
}

function parseCookieValue(value: string | undefined): any | null {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function getSessionFromCookies(request?: NextRequest): Promise<SessionUser | null> {
  try {
    // PRIMARY: Read directly from NextRequest cookies (reliable in all Next.js route handlers)
    if (request?.cookies) {
      const clientCookieVal = request.cookies.get("hazel_client_session")?.value;
      const clientSession = parseCookieValue(clientCookieVal);
      if (clientSession?.role === "client" && clientSession?.tenantId) {
        return clientSession as SessionUser;
      }

      const adminCookieVal = request.cookies.get("hazel_admin_session")?.value;
      const adminSession = parseCookieValue(adminCookieVal);
      if (adminSession?.role === "admin") {
        const queryTenantId = request.nextUrl?.searchParams?.get("tenantId");
        return {
          ...adminSession,
          tenantId: queryTenantId || adminSession.tenantId || "admin"
        } as SessionUser;
      }

      // Old unified cookie fallback
      const oldCookieVal = request.cookies.get("hazel_session")?.value;
      const oldSession = parseCookieValue(oldCookieVal);
      if (oldSession?.tenantId) {
        return oldSession as SessionUser;
      }
    }

    // FALLBACK: Use next/headers cookies() for server components / when no request object
    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();

      const clientCookieVal = cookieStore.get("hazel_client_session")?.value;
      const clientSession = parseCookieValue(clientCookieVal);
      if (clientSession?.role === "client" && clientSession?.tenantId) {
        return clientSession as SessionUser;
      }

      const adminCookieVal = cookieStore.get("hazel_admin_session")?.value;
      const adminSession = parseCookieValue(adminCookieVal);
      if (adminSession?.role === "admin") {
        return {
          ...adminSession,
          tenantId: adminSession.tenantId || "admin"
        } as SessionUser;
      }

      const oldCookieVal = cookieStore.get("hazel_session")?.value;
      const oldSession = parseCookieValue(oldCookieVal);
      if (oldSession?.tenantId) {
        return oldSession as SessionUser;
      }
    } catch (innerErr) {
      // next/headers not available in this context — that's fine
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
