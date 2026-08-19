import { NextRequest } from "next/server";
import * as jose from "jose";

function getSecretKey() {
  const SESSION_SECRET = process.env.SESSION_SECRET;
  if (!SESSION_SECRET) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CRITICAL RUNTIME ERROR: SESSION_SECRET environment variable is not defined!");
    }
    return new TextEncoder().encode("hazelsecretkey12345678901234567890_fallback");
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
    // PRIMARY: Read directly from NextRequest cookies (reliable in all Next.js route handlers)
    if (request?.cookies) {
      const clientCookieVal = request.cookies.get("hazel_client_session")?.value;
      const clientSession = await verifyJWT(clientCookieVal);
      if (clientSession?.role === "client" && clientSession?.tenantId) {
        return clientSession as SessionUser;
      }

      const adminCookieVal = request.cookies.get("hazel_admin_session")?.value;
      const adminSession = await verifyJWT(adminCookieVal);
      if (adminSession?.role === "admin") {
        const queryTenantId = request.nextUrl?.searchParams?.get("tenantId");
        return {
          ...adminSession,
          tenantId: queryTenantId || adminSession.tenantId || "admin"
        } as SessionUser;
      }
    }

    // FALLBACK: Use next/headers cookies() for server components / when no request object
    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();

      const clientCookieVal = cookieStore.get("hazel_client_session")?.value;
      const clientSession = await verifyJWT(clientCookieVal);
      if (clientSession?.role === "client" && clientSession?.tenantId) {
        return clientSession as SessionUser;
      }

      const adminCookieVal = cookieStore.get("hazel_admin_session")?.value;
      const adminSession = await verifyJWT(adminCookieVal);
      if (adminSession?.role === "admin") {
        return {
          ...adminSession,
          tenantId: adminSession.tenantId || "admin"
        } as SessionUser;
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
