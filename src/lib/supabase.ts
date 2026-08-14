import { createClient } from '@supabase/supabase-js';
import { Tenant, CallLog } from './multitenant-store';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export function handleSupabaseError(context: string, error: any) {
  if (!error) return;
  if (error.code === 'PGRST205' || (error.message && (error.message.includes('schema cache') || error.message.includes('Could not find the table')))) {
    console.warn(`[Supabase Setup Notice] ${context}: Table missing in Supabase. Please run full SQL schema in Supabase SQL Editor!`);
  } else {
    console.error(`[Supabase Error] ${context}:`, error.message || error);
  }
}

/**
 * SQL DDL Schema Reference for Supabase Setup:
 * 
 * CREATE TABLE IF NOT EXISTS tenants (
 *   id TEXT PRIMARY KEY,
 *   client_number TEXT,
 *   name TEXT,
 *   business_name TEXT,
 *   phone_number TEXT,
 *   email TEXT,
 *   status TEXT DEFAULT 'active',
 *   installation_fee NUMERIC DEFAULT 0,
 *   monthly_subscription_fee NUMERIC DEFAULT 0,
 *   currency TEXT DEFAULT 'PKR',
 *   payment_status TEXT DEFAULT 'paid',
 *   allocated_minutes NUMERIC DEFAULT 100,
 *   used_minutes NUMERIC DEFAULT 0,
 *   client_username TEXT UNIQUE,
 *   client_password TEXT,
 *   system_prompt TEXT,
 *   knowledge_base TEXT,
 *   product_knowledge_base TEXT,
 *   products JSONB,
 *   followup_mechanism TEXT,
 *   llm_model TEXT DEFAULT 'gpt-4o-mini',
 *   temperature NUMERIC DEFAULT 0.7,
 *   deepgram_voice TEXT DEFAULT 'aura-asteria-en',
 *   deepgram_api_key TEXT,
 *   openai_api_key TEXT,
 *   omnivoice_api_key TEXT,
 *   omnivoice_number TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   troubleshoot JSONB,
 *   promotions_sent INT DEFAULT 0,
 *   revival_leads_active INT DEFAULT 0,
 *   conversational_leads_count INT DEFAULT 0
 * );
 * 
 * CREATE TABLE IF NOT EXISTS call_logs (
 *   id TEXT PRIMARY KEY,
 *   tenant_id TEXT REFERENCES tenants(id),
 *   caller_number TEXT,
 *   caller_name TEXT,
 *   direction TEXT,
 *   duration_seconds INT,
 *   transcript_in TEXT,
 *   transcript_out TEXT,
 *   audio_url_out TEXT,
 *   cost_estimate NUMERIC,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   status TEXT
 * );
 */

export async function fetchTenantsFromSupabase(): Promise<Tenant[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from('tenants').select('*');
    if (error) {
      console.warn('[Supabase] Error fetching tenants:', error.message);
      return null;
    }
    if (!data) return null;

    return data.map((t: any) => ({
      id: t.id,
      clientNumber: t.client_number || '1000',
      name: t.name || '',
      businessName: t.business_name || '',
      phoneNumber: t.phone_number || '',
      email: t.email || '',
      status: t.status || 'active',
      installationFee: Number(t.installation_fee) || 0,
      monthlySubscriptionFee: Number(t.monthly_subscription_fee) || 0,
      currency: t.currency || 'PKR',
      paymentStatus: t.payment_status || 'paid',
      allocatedMinutes: Number(t.allocated_minutes) || 100,
      usedMinutes: Number(t.used_minutes) || 0,
      clientUsername: t.client_username || '',
      clientPassword: t.client_password || '',
      systemPrompt: t.system_prompt || '',
      knowledgeBase: t.knowledge_base || '',
      productKnowledgeBase: t.product_knowledge_base || '',
      products: t.products || [],
      followupMechanism: t.followup_mechanism || '',
      llmModel: t.llm_model || 'gpt-4o-mini',
      temperature: Number(t.temperature) || 0.7,
      deepgramVoice: t.deepgram_voice || 'aura-asteria-en',
      deepgramApiKey: t.deepgram_api_key || '',
      openaiApiKey: t.openai_api_key || '',
      omnivoiceApiKey: t.omnivoice_api_key || '',
      omnivoiceNumber: t.omnivoice_number || '',
      createdAt: t.created_at || new Date().toISOString(),
      troubleshoot: t.troubleshoot || {
        webhookConnected: true,
        deepgramApiValid: true,
        llmApiValid: true,
        whatsappSessionActive: true,
        serviceBlocked: false,
      },
      promotionsSent: t.promotions_sent || 0,
      revivalLeadsActive: t.revival_leads_active || 0,
      conversationalLeadsCount: t.conversational_leads_count || 0,
    }));
  } catch (err) {
    console.error('[Supabase] Fetch error:', err);
    return null;
  }
}

export async function upsertTenantToSupabase(tenant: Tenant): Promise<boolean> {
  if (!supabase) return false;
  try {
    const payload = {
      id: tenant.id,
      client_number: tenant.clientNumber,
      name: tenant.name,
      business_name: tenant.businessName,
      phone_number: tenant.phoneNumber,
      email: tenant.email,
      status: tenant.status,
      installation_fee: tenant.installationFee,
      monthly_subscription_fee: tenant.monthlySubscriptionFee,
      currency: tenant.currency,
      payment_status: tenant.paymentStatus,
      allocated_minutes: tenant.allocatedMinutes,
      used_minutes: tenant.usedMinutes,
      client_username: (tenant.clientUsername && tenant.clientUsername.trim()) ? tenant.clientUsername.trim() : null,
      client_password: (tenant.clientPassword && tenant.clientPassword.trim()) ? tenant.clientPassword.trim() : null,
      system_prompt: tenant.systemPrompt,
      knowledge_base: tenant.knowledgeBase,
      product_knowledge_base: tenant.productKnowledgeBase,
      products: tenant.products || [],
      followup_mechanism: tenant.followupMechanism,
      llm_model: tenant.llmModel,
      temperature: tenant.temperature,
      deepgram_voice: tenant.deepgramVoice,
      deepgram_api_key: tenant.deepgramApiKey,
      openai_api_key: tenant.openaiApiKey,
      omnivoice_api_key: tenant.omnivoiceApiKey,
      omnivoice_number: tenant.omnivoiceNumber,
      troubleshoot: tenant.troubleshoot,
      promotions_sent: tenant.promotionsSent,
      revival_leads_active: tenant.revivalLeadsActive,
      conversational_leads_count: tenant.conversationalLeadsCount,
    };

    const { error } = await supabase.from('tenants').upsert(payload);
    if (error) {
      console.warn('[Supabase] Error upserting tenant:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] Upsert error:', err);
    return false;
  }
}

export async function migrateOrphanedRecordsToClientTenant(targetTenantId: string = 't-1004') {
  if (!supabase) return;
  try {
    const { error: chatErr } = await supabase
      .from('chat_messages')
      .update({ tenant_id: targetTenantId })
      .in('tenant_id', ['admin', 'default']);
    if (!chatErr) {
      console.log(`[Supabase Migration] Migrated orphaned chat_messages to ${targetTenantId}`);
    }

    const { error: custErr } = await supabase
      .from('customers')
      .update({ tenant_id: targetTenantId })
      .in('tenant_id', ['admin', 'default']);
    if (!custErr) {
      console.log(`[Supabase Migration] Migrated orphaned customers to ${targetTenantId}`);
    }
  } catch (e) {
    console.error("[Supabase Migration] Error migrating orphaned records:", e);
  }
}
