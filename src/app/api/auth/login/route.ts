import { NextRequest, NextResponse } from "next/server";
import { DB } from "@/lib/db";
import { signJWT } from "@/lib/auth-session";
import bcrypt from "bcryptjs";

export const dynamic = 'force-dynamic';

const getCookieOptsAndMaxAge = (remember: boolean) => {
  const maxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24;
  return {
    opts: {
      httpOnly: true,
      path: "/",
      maxAge,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
    },
    maxAge
  };
};

export async function POST(request: NextRequest) {
  try {
    const { username, password, remember } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ success: false, error: "Username and password are required" }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase();
    const rememberMe = remember !== false;

    // 1. Check Super Admin Login (using SUPER_ADMIN_PASSWORD env)
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
    if (!superAdminPassword) {
      throw new Error("CRITICAL RUNTIME ERROR: SUPER_ADMIN_PASSWORD environment variable is not defined!");
    }

    const isSuperAdminUser = (cleanUsername === "admin@hazelwhat.com" || cleanUsername === "admin");
    const superAdminPassHash = bcrypt.hashSync(superAdminPassword, 10);
    const isSuperAdminPass = bcrypt.compareSync(password.trim(), superAdminPassHash);

    if (isSuperAdminUser && isSuperAdminPass) {
      const sessionData = {
        role: "admin",
        tenantId: "admin",
        username: "Super Admin",
        name: "Hassaan (Super Admin)",
        email: "admin@hazelwhat.com",
        accessLevel: "read_write",
      };

      const { opts, maxAge } = getCookieOptsAndMaxAge(rememberMe);
      const jwtToken = await signJWT(sessionData, maxAge);
      const res = NextResponse.json({ success: true, user: sessionData, redirectTo: "/admin" });
      res.cookies.set("hazel_admin_session", jwtToken, opts);
      return res;
    }

    // 1b. Check Registered Team Admins from Store/Database
    try {
      const partners = await DB.getPartners();
      const adminMatch = partners.find((p) => {
        const e = p.email?.trim().toLowerCase() || "";
        const n = p.name?.trim().toLowerCase() || "";
        const prefix = e.split("@")[0];
        return e === cleanUsername || n === cleanUsername || prefix === cleanUsername;
      });

      if (adminMatch) {
        const storedPass = (adminMatch.password || "").trim();
        const inputPass = password.trim();
        
        let passMatches = false;
        const isBcrypt = storedPass.startsWith("$2a$") || storedPass.startsWith("$2b$") || storedPass.startsWith("$2y$");

        if (isBcrypt) {
          passMatches = bcrypt.compareSync(inputPass, storedPass);
        } else {
          // Legacy plaintext fallback
          passMatches = inputPass === storedPass || inputPass.toLowerCase() === storedPass.toLowerCase();
          if (passMatches) {
            // Lazy migration: hash immediately and update DB
            const hashed = bcrypt.hashSync(inputPass, 10);
            adminMatch.password = hashed;
            try {
              await DB.savePartners([adminMatch]);
              console.log(`[Auth Migration] Migrated plaintext password for partner: ${adminMatch.email}`);
            } catch (err) {
              console.error("[Auth Migration] Partner password migration failed:", err);
            }
          }
        }

        if (passMatches) {
          const sessionData = {
            role: "admin",
            tenantId: "admin",
            username: adminMatch.name || adminMatch.email,
            name: adminMatch.name,
            email: adminMatch.email,
            accessLevel: adminMatch.accessLevel || "read_write",
          };

          const { opts, maxAge } = getCookieOptsAndMaxAge(rememberMe);
          const jwtToken = await signJWT(sessionData, maxAge);
          const res = NextResponse.json({ success: true, user: sessionData, redirectTo: "/admin" });
          res.cookies.set("hazel_admin_session", jwtToken, opts);
          return res;
        }
      }
    } catch (err) {
      console.error("[Login API] Admin partner check error:", err);
    }

    // 2. Check Client/Tenant Login against Supabase
    const tenant = await DB.getTenantByUsername(username);

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // Flexible & Robust Password Validation for Client Portal
    const inputPassword = password.trim();
    const storedPass = (tenant.clientPassword || "").trim();

    let passMatches = false;
    const isBcrypt = storedPass.startsWith("$2a$") || storedPass.startsWith("$2b$") || storedPass.startsWith("$2y$");

    if (isBcrypt) {
      passMatches = bcrypt.compareSync(inputPassword, storedPass);
    } else {
      // Legacy plaintext fallback
      passMatches = !!storedPass && (inputPassword === storedPass || inputPassword.toLowerCase() === storedPass.toLowerCase());
      if (passMatches) {
        // Lazy migration: hash immediately and update DB
        const hashed = bcrypt.hashSync(inputPassword, 10);
        tenant.clientPassword = hashed;
        try {
          await DB.saveTenants([tenant]);
          console.log(`[Auth Migration] Migrated plaintext password for tenant: ${tenant.clientUsername}`);
        } catch (err) {
          console.error("[Auth Migration] Tenant password migration failed:", err);
        }
      }
    }

    if (!passMatches) {
      return NextResponse.json(
        { success: false, error: "Invalid username or password" },
        { status: 401 }
      );
    }

    if (tenant.status === "draft") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your client account is currently in Draft mode. Please wait for Super Admin to launch your setup live.",
        },
        { status: 403 }
      );
    }

    if (tenant.status === "suspended" || tenant.status === "blocked") {
      return NextResponse.json(
        {
          success: false,
          error: "Your client account is currently suspended. Please contact HazelWhat Support.",
        },
        { status: 403 }
      );
    }

    const sessionData = {
      role: "client",
      tenantId: tenant.id,
      username: tenant.clientUsername || tenant.email,
      name: tenant.name,
      businessName: tenant.businessName,
      email: tenant.email,
    };

    const { opts, maxAge } = getCookieOptsAndMaxAge(rememberMe);
    const jwtToken = await signJWT(sessionData, maxAge);
    const res = NextResponse.json({ success: true, user: sessionData, redirectTo: "/client" });
    res.cookies.set("hazel_client_session", jwtToken, opts);
    return res;

  } catch (err: any) {
    console.error("[Login API] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Authentication failed" },
      { status: 500 }
    );
  }
}
