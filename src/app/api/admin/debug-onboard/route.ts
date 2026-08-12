import { requireAdminSession } from "@/lib/auth-session";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabase) {
    return NextResponse.json({ error: "Supabase client not initialized" }, { status: 500 });
  }

  try {
    const nextClientNum = "9999";
    const testTenant = {
      id: `t-${nextClientNum}`,
      clientNumber: nextClientNum,
      name: 'Debug Test Client',
      businessName: 'Debug Business LLC',
      phoneNumber: '+92 300 0000000',
      email: 'debug_client@business.com',
      status: 'active' as const,
      installationFee: 1000,
      monthlySubscriptionFee: 500,
      currency: 'PKR' as const,
      paymentStatus: 'paid' as const,
      allocatedMinutes: 800,
      usedMinutes: 0,
      clientUsername: `debug_user_${Math.floor(100 + Math.random() * 900)}`,
      clientPassword: `HazelPass@${Math.floor(1000 + Math.random() * 9000)}`,
      systemPrompt: 'Debug Prompt',
      knowledgeBase: 'Debug KB',
      productKnowledgeBase: 'Debug PKB',
      products: [],
      followupMechanism: 'Debug follow-up',
      llmModel: 'gpt-4o-mini' as const,
      temperature: 0.7,
      deepgramVoice: 'aura-asteria-en',
      deepgramApiKey: '',
      openaiApiKey: '',
      omnivoiceApiKey: '',
      omnivoiceNumber: '+1 (555) 123-4567',
      createdAt: new Date().toISOString(),
      troubleshoot: {
        webhookConnected: true,
        deepgramApiValid: true,
        llmApiValid: true,
        whatsappSessionActive: true,
        serviceBlocked: false,
      },
      promotionsSent: 0,
      revivalLeadsActive: 0,
      conversationalLeadsCount: 0,
    };

    const { upsertTenantToSupabase } = await import('@/lib/supabase');
    const tenantOk = await upsertTenantToSupabase(testTenant);
    
    // Clean up
    await supabase.from('tenants').delete().eq('id', `t-${nextClientNum}`);

    return NextResponse.json({ 
      success: true, 
      tenantOk,
      message: "Debug tenant onboard upsert completed. Check tenantOk boolean status."
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
