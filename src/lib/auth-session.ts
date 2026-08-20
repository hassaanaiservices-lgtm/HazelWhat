import { NextRequest } from "next/server";
import * as jose from "jose";

function getSecretKey() {
  const SESSION_SECRET = process.env.SESSION_SECRET;
  if (!SESSION_SECRET) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CRITICAL RUNTIME ERROR: SESSION_SECRET environment variable is not defined!");
    }
    return new TextEncoder().encode("hazelwhat_secret_key_default_2026_jwt");
  }
  return new TextEncoder().encode(SESSION_SECRET);
}

export interface SessionUser {
  role: "admin" | "client";
  tenantId: string;
  username?: string;
  name?: string;
  businessName?: string;
  email?: string;
}

export async function signJWT(payload: any, maxAge: number): Promise<string> {
  const secretKey = getSecretKey();
  return await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAge)
    .sign(secretKey);
}

export async function verifyJWT(token: string | undefined): Promise<any | null> {
  if (!token) return null;
  try {
    const secretKey = getSecretKey();
    const { payload } = await jose.jwtVerify(token, secretKey);
    return payload;
  } catch (err) {
    return null;
  }
}

export async function getSessionFromCookies(request?: NextRequest): Promise<SessionUser | null> {
  try {
    const pathname = request?.nextUrl?.pathname || "";
    const portal = request?.nextUrl?.searchParams?.get("portal");
    const isClientContext = pathname.startsWith("/client") || pathname.startsWith("/api/whatsapp") || portal === "client";

    // PRIMARY: Read directly from NextRequest cookies
    if (request?.cookies) {
      const clientCookieVal = request.cookies.get("hazel_client_session")?.value;
      const clientSession = await verifyJWT(clientCookieVal);

      const adminCookieVal = request.cookies.get("hazel_admin_session")?.value;
      const adminSession = await verifyJWT(adminCookieVal);

      // In client context, prioritize valid client session
      if (isClientContext && clientSession?.role === "client" && clientSession?.tenantId) {
        return clientSession as SessionUser;
      }

      // If client session exists and no admin session, return clientSession
      if (clientSession?.role === "client" && clientSession?.tenantId && !adminSession) {
        return clientSession as SessionUser;
      }

      // If admin session exists
      if (adminSession?.role === "admin") {
        const queryTenantId = request.nextUrl?.searchParams?.get("tenantId");
        let targetTenantId = queryTenantId || adminSession.tenantId;

        // If admin is in client context and targetTenantId is "admin" or missing, fallback to client cookie tenant or default active tenant
        if (isClientContext && (!targetTenantId || targetTenantId === "admin")) {
          if (clientSession?.tenantId) {
            targetTenantId = clientSession.tenantId;
          }
        }

        return {
          ...adminSession,
          tenantId: targetTenantId || "admin"
        } as SessionUser;
      }

      // Fallback: if not client context but clientSession exists
      if (clientSession?.role === "client" && clientSession?.tenantId) {
        return clientSession as SessionUser;
      }
    }

    // FALLBACK: Use next/headers cookies() for server components
    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();

      const clientCookieVal = cookieStore.get("hazel_client_session")?.value;
      const clientSession = await verifyJWT(clientCookieVal);
      const adminCookieVal = cookieStore.get("hazel_admin_session")?.value;
      const adminSession = await verifyJWT(adminCookieVal);

      if (isClientContext && clientSession?.role === "client" && clientSession?.tenantId) {
        return clientSession as SessionUser;
      }

      if (clientSession?.role === "client" && clientSession?.tenantId && !adminSession) {
        return clientSession as SessionUser;
      }

      if (adminSession?.role === "admin") {
        return {
          ...adminSession,
          tenantId: adminSession.tenantId || "admin"
        } as SessionUser;
      }

      if (clientSession?.role === "client" && clientSession?.tenantId) {
        return clientSession as SessionUser;
      }
    } catch (innerErr) {
      // next/headers not available
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

export async function requireAdminSession(request: NextRequest): Promise<SessionUser | null> {
  const session = await getSessionFromCookies(request);
  if (session && session.role === "admin") {
    return session;
  }
  return null;
}

export async function requireTenantSession(request: NextRequest): Promise<SessionUser | null> {
  const session = await getSessionFromCookies(request);
  if (session && (session.role === "admin" || session.role === "client") && session.tenantId) {
    return session;
  }
  return null;
}
