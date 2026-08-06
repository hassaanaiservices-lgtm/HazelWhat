import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('[Migration] Error: Missing SUPABASE_URL or SUPABASE_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  const dbPath = path.join(process.cwd(), '.data', 'db.json');
  if (!fs.existsSync(dbPath)) {
    console.log('[Migration] No db.json found at .data/db.json. Nothing to migrate.');
    return;
  }

  console.log('[Migration] Starting migration from db.json to Supabase PostgreSQL...');
  const fileContent = fs.readFileSync(dbPath, 'utf-8');
  const dbData = JSON.parse(fileContent);

  const defaultTenantId = 'admin';

  // 1. Migrate Tenants
  if (Array.isArray(dbData.tenants) && dbData.tenants.length > 0) {
    console.log(`[Migration] Migrating ${dbData.tenants.length} tenant(s)...`);
    const tenantPayloads = dbData.tenants.map((t: any) => ({
      id: t.id,
      client_number: t.clientNumber || '1000',
      name: t.name || '',
      business_name: t.businessName || '',
      phone_number: t.phoneNumber || '',
      email: t.email || '',
      status: t.status || 'active',
      installation_fee: Number(t.installationFee) || 0,
      monthly_subscription_fee: Number(t.monthlySubscriptionFee) || 0,
      currency: t.currency || 'PKR',
      payment_status: t.paymentStatus || 'paid',
      allocated_minutes: Number(t.allocatedMinutes) || 100,
      used_minutes: Number(t.usedMinutes) || 0,
      client_username: t.clientUsername || '',
      client_password: t.clientPassword || '',
      system_prompt: t.systemPrompt || '',
      knowledge_base: t.knowledgeBase || '',
      product_knowledge_base: t.productKnowledgeBase || '',
      products: t.products || [],
      followup_mechanism: t.followupMechanism || '',
      llm_model: t.llmModel || 'gpt-4o-mini',
      temperature: Number(t.temperature) || 0.7,
      deepgram_voice: t.deepgramVoice || 'aura-asteria-en',
      deepgram_api_key: t.deepgramApiKey || '',
      openai_api_key: t.openaiApiKey || '',
      omnivoice_api_key: t.omnivoiceApiKey || '',
      omnivoice_number: t.omnivoiceNumber || '',
      troubleshoot: t.troubleshoot || {},
      promotions_sent: t.promotionsSent || 0,
      revival_leads_active: t.revivalLeadsActive || 0,
      conversational_leads_count: t.conversationalLeadsCount || 0,
      created_at: t.createdAt || new Date().toISOString()
    }));

    const { error: tenantErr } = await supabase.from('tenants').upsert(tenantPayloads);
    if (tenantErr) console.warn('[Migration] Error migrating tenants:', tenantErr.message);
    else console.log('[Migration] Tenants migrated successfully.');
  }

  // 2. Migrate Partners
  if (Array.isArray(dbData.partners) && dbData.partners.length > 0) {
    console.log(`[Migration] Migrating ${dbData.partners.length} partner(s)...`);
    const partnerPayloads = dbData.partners.map((p: any) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      role: p.role || 'partner',
      access_level: p.accessLevel || 'read_write',
      clients_assigned: p.clientsAssigned || 0,
      permissions: p.permissions || []
    }));
    const { error: partnerErr } = await supabase.from('partners').upsert(partnerPayloads);
    if (partnerErr) console.warn('[Migration] Error migrating partners:', partnerErr.message);
    else console.log('[Migration] Partners migrated successfully.');
  }

  // 3. Migrate Config
  if (dbData.config) {
    console.log('[Migration] Migrating Config...');
    const configPayload = {
      tenant_id: defaultTenantId,
      system_prompt: dbData.config.systemPrompt || '',
      product_info: dbData.config.productInfo || '',
      products: dbData.config.products || [],
      keyword_replies: dbData.config.keywordReplies || [],
      enabled_features: dbData.config.enabledFeatures || [],
      global_ai_enabled: dbData.config.globalAiEnabled !== false,
      store_url: dbData.config.storeUrl || '',
      store_currency: dbData.config.storeCurrency || '$',
      business_name: dbData.config.businessName || 'My Business',
      timezone: dbData.config.timezone || 'UTC',
      working_hours: dbData.config.workingHours || '9:00 AM - 5:00 PM',
      bot_mode: dbData.config.botMode || 'both',
      max_follow_ups: dbData.config.maxFollowUps || 7,
      follow_ups: dbData.config.followUps || []
    };
    const { error: cfgErr } = await supabase.from('tenant_configs').upsert(configPayload, { onConflict: 'tenant_id' });
    if (cfgErr) console.warn('[Migration] Error migrating config:', cfgErr.message);
    else console.log('[Migration] Tenant config migrated successfully.');
  }

  // 4. Migrate Customers
  if (dbData.customers && Object.keys(dbData.customers).length > 0) {
    const custArray = Object.values(dbData.customers);
    console.log(`[Migration] Migrating ${custArray.length} customer(s)...`);
    const custPayloads = custArray.map((c: any) => ({
      tenant_id: c.tenantId || defaultTenantId,
      phone: c.phone,
      name: c.name || c.phone,
      jid: c.jid || '',
      preferences: c.preferences || '',
      ai_enabled: c.aiEnabled !== false,
      follow_up_level: c.followUpLevel || 0,
      lead_status: c.leadStatus || 'none',
      tags: c.tags || [],
      pipeline_stage: c.pipelineStage || 'new',
      is_opted_out: Boolean(c.isOptedOut),
      opted_out_at: c.optedOutAt || null,
      is_lead: Boolean(c.isLead),
      pipeline_stage_set_by_user: Boolean(c.pipelineStageSetByUser),
      lead_created_at: c.leadCreatedAt || new Date().toISOString()
    }));
    const { error: custErr } = await supabase.from('customers').upsert(custPayloads, { onConflict: 'tenant_id,phone' });
    if (custErr) console.warn('[Migration] Error migrating customers:', custErr.message);
    else console.log('[Migration] Customers migrated successfully.');
  }

  // 5. Migrate Chat Messages
  if (dbData.chats && Object.keys(dbData.chats).length > 0) {
    let msgCount = 0;
    const msgPayloads: any[] = [];
    for (const [phone, messages] of Object.entries(dbData.chats)) {
      if (Array.isArray(messages)) {
        messages.forEach((m: any) => {
          msgCount++;
          msgPayloads.push({
            tenant_id: m.tenantId || defaultTenantId,
            phone,
            role: m.role || 'user',
            content: m.content || '',
            status: m.status || 1,
            media_url: m.mediaUrl || null,
            media_type: m.mediaType || null,
            timestamp: m.timestamp || new Date().toISOString()
          });
        });
      }
    }
    console.log(`[Migration] Migrating ${msgCount} chat message(s)...`);
    if (msgPayloads.length > 0) {
      const BATCH_SIZE = 500;
      for (let i = 0; i < msgPayloads.length; i += BATCH_SIZE) {
        const batch = msgPayloads.slice(i, i + BATCH_SIZE);
        const { error: msgErr } = await supabase.from('chat_messages').insert(batch);
        if (msgErr) console.warn(`[Migration] Batch error migrating chat messages (${i}):`, msgErr.message);
      }
      console.log('[Migration] Chat messages migrated successfully.');
    }
  }

  // 6. Migrate Appointments
  if (Array.isArray(dbData.appointments) && dbData.appointments.length > 0) {
    console.log(`[Migration] Migrating ${dbData.appointments.length} appointment(s)...`);
    const apptPayloads = dbData.appointments.map((a: any) => ({
      id: a.id || "APT-" + Math.random().toString(36).substring(2, 8).toUpperCase(),
      tenant_id: a.tenantId || defaultTenantId,
      phone: a.phone,
      name: a.name || a.phone,
      service: a.service || 'Discovery Call',
      date: a.date,
      time: a.time,
      status: a.status || 'booked',
      notes: a.notes || ''
    }));
    const { error: apptErr } = await supabase.from('appointments').upsert(apptPayloads);
    if (apptErr) console.warn('[Migration] Error migrating appointments:', apptErr.message);
    else console.log('[Migration] Appointments migrated successfully.');
  }

  // 7. Migrate Orders
  if (Array.isArray(dbData.orders) && dbData.orders.length > 0) {
    console.log(`[Migration] Migrating ${dbData.orders.length} order(s)...`);
    const orderPayloads = dbData.orders.map((o: any) => ({
      id: o.id || "ORD-" + Math.random().toString(36).substring(2, 8).toUpperCase(),
      tenant_id: o.tenantId || defaultTenantId,
      phone: o.phone,
      customer_name: o.customerName || o.phone,
      product_name: o.productName,
      product_image_url: o.productImageUrl || null,
      size: o.size || null,
      color: o.color || null,
      delivery_address: o.deliveryAddress || null,
      contact_number: o.contactNumber || o.phone,
      payment_method: o.paymentMethod || null,
      price: o.price || null,
      status: o.status || 'pending',
      recovery_stage: o.recoveryStage || 0,
      notes: o.notes || null,
      timestamp: o.timestamp || new Date().toISOString()
    }));
    const { error: orderErr } = await supabase.from('orders').upsert(orderPayloads);
    if (orderErr) console.warn('[Migration] Error migrating orders:', orderErr.message);
    else console.log('[Migration] Orders migrated successfully.');
  }

  // 8. Migrate Scheduled Follow Ups
  if (Array.isArray(dbData.scheduledFollowUps) && dbData.scheduledFollowUps.length > 0) {
    console.log(`[Migration] Migrating ${dbData.scheduledFollowUps.length} scheduled follow up(s)...`);
    const fuPayloads = dbData.scheduledFollowUps.map((f: any) => ({
      id: f.id || Math.random().toString(36).substring(2, 8),
      tenant_id: f.tenantId || defaultTenantId,
      phone: f.phone,
      send_at: f.sendAt,
      context: f.context || '',
      status: f.status || 'pending',
      created_at: f.createdAt || new Date().toISOString()
    }));
    const { error: fuErr } = await supabase.from('scheduled_follow_ups').upsert(fuPayloads);
    if (fuErr) console.warn('[Migration] Error migrating scheduled follow-ups:', fuErr.message);
    else console.log('[Migration] Scheduled follow-ups migrated successfully.');
  }

  // 9. Migrate Revival Campaigns
  if (Array.isArray(dbData.revivalCampaigns) && dbData.revivalCampaigns.length > 0) {
    console.log(`[Migration] Migrating ${dbData.revivalCampaigns.length} revival campaign(s)...`);
    const campPayloads = dbData.revivalCampaigns.map((c: any) => ({
      id: c.id,
      tenant_id: c.tenantId || defaultTenantId,
      name: c.name || '',
      message: c.message || '',
      audience: c.audience || 'all',
      time_slot_start: c.timeSlotStart || '09:00',
      time_slot_end: c.timeSlotEnd || '21:00',
      delay_minutes: c.delayMinutes || 5,
      daily_cap: c.dailyCap || 80,
      status: c.status || 'active',
      target_phones: c.targetPhones || [],
      sent_phones: c.sentPhones || [],
      failed_phones: c.failedPhones || [],
      replied_phones: c.repliedPhones || [],
      opted_out_phones: c.optedOutPhones || [],
      sent_today: c.sentToday || 0,
      last_sent_date: c.lastSentDate || '',
      media_base64: c.mediaBase64 || null,
      mimetype: c.mimetype || null,
      file_name: c.fileName || null,
      voice_base64: c.voiceBase64 || null,
      voice_mimetype: c.voiceMimetype || null,
      message_type: c.messageType || 'text',
      phase2_settings: c.phase2Settings || {},
      lead_progress: c.leadProgress || {},
      last_sent_at: c.lastSentAt || null,
      created_at: c.createdAt || new Date().toISOString()
    }));
    const { error: campErr } = await supabase.from('revival_campaigns').upsert(campPayloads);
    if (campErr) console.warn('[Migration] Error migrating revival campaigns:', campErr.message);
    else console.log('[Migration] Revival campaigns migrated successfully.');
  }

  // 10. Migrate Promotion Logs
  if (Array.isArray(dbData.promotions) && dbData.promotions.length > 0) {
    console.log(`[Migration] Migrating ${dbData.promotions.length} promotion log(s)...`);
    const promoPayloads = dbData.promotions.map((p: any) => ({
      id: p.id || Math.random().toString(36).substring(7),
      tenant_id: p.tenantId || defaultTenantId,
      timestamp: p.timestamp || new Date().toISOString(),
      audience: p.audience || 'all',
      message: p.message || '',
      success_count: p.successCount || 0,
      failure_count: p.failureCount || 0
    }));
    const { error: promoErr } = await supabase.from('promotion_logs').upsert(promoPayloads);
    if (promoErr) console.warn('[Migration] Error migrating promotion logs:', promoErr.message);
    else console.log('[Migration] Promotion logs migrated successfully.');
  }

  console.log('[Migration] Full migration to Supabase PostgreSQL completed successfully!');
}

migrate().catch(err => {
  console.error('[Migration] Migration failed:', err);
  process.exit(1);
});
