import { requireAdminSession } from "@/lib/auth-session";
import { NextRequest, NextResponse } from "next/server";
import { DB } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tenants = await DB.getTenants();
    const partners = await DB.getPartners();
    return NextResponse.json({ success: true, tenants, partners });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (Array.isArray(body.tenants)) {
      const incomingTenants = body.tenants;

      // 1. Sanitize & Normalize clientUsername for every tenant in array
      const seenUsernames = new Map<string, string>(); // username -> tenantId

      for (let i = 0; i < incomingTenants.length; i++) {
        const t = incomingTenants[i];
        if (typeof t.clientUsername === 'string') {
          const trimmed = t.clientUsername.trim();
          if (trimmed === '') {
            t.clientUsername = null; // Convert empty string to null
          } else {
            t.clientUsername = trimmed;
          }
        } else if (!t.clientUsername) {
          t.clientUsername = null;
        }

        // 2. Intra-batch uniqueness validation
        if (t.clientUsername) {
          const lowerUser = t.clientUsername.toLowerCase();
          if (seenUsernames.has(lowerUser)) {
            return NextResponse.json({
              success: false,
              error: `Validation Error: Duplicate username "${t.clientUsername}" found in save request (Tenant index ${i}: ${t.name || t.id}).`
            }, { status: 400 });
          }
          seenUsernames.set(lowerUser, t.id);
        }
      }

      // 3. Database-wide uniqueness validation against existing tenants
      const existingTenants = await DB.getTenants();
      for (const t of incomingTenants) {
        if (t.clientUsername) {
          const lowerUser = t.clientUsername.toLowerCase();
          const collision = existingTenants.find(
            ext => ext.id !== t.id && ext.clientUsername?.trim().toLowerCase() === lowerUser
          );
          if (collision) {
            return NextResponse.json({
              success: false,
              error: `Validation Error: Username "${t.clientUsername}" is already assigned to tenant "${collision.name || collision.businessName || collision.id}".`
            }, { status: 400 });
          }
        }
      }

      // 4. Perform save with per-tenant tracking
      const saveResult = await DB.saveTenantsAsync(incomingTenants);
      if (!saveResult.success) {
        const failedTenants = saveResult.results.filter(r => !r.success);
        return NextResponse.json({
          success: false,
          error: `Failed to save ${failedTenants.length} tenant(s): ${failedTenants.map(f => `${f.tenantId} (${f.error || 'error'})`).join(', ')}`,
          saveResults: saveResult.results
        }, { status: 400 });
      }
    }

    if (Array.isArray(body.partners)) {
      await DB.savePartners(body.partners);
    }

    return NextResponse.json({ 
      success: true, 
      tenants: await DB.getTenants(), 
      partners: await DB.getPartners() 
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { tenantId } = body;
    if (!tenantId) {
      return NextResponse.json({ success: false, error: "Missing tenantId" }, { status: 400 });
    }
    await DB.deleteTenant(tenantId);
    return NextResponse.json({ 
      success: true, 
      tenants: await DB.getTenants(), 
      partners: await DB.getPartners() 
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
