import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { Tenant, Partner } from './multitenant-store';
import { ProductItem } from './scraper';

export const DB_DIR = (function() {
  let dir = process.env.DATABASE_DIR || path.join(process.cwd(), '.data');
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  } catch (err) {
    const localDir = path.join(process.cwd(), '.data');
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    return localDir;
  }
})();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export interface ChatMessage {
  id?: string;
  tenantId?: string;
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: string;
  status?: number;
  mediaUrl?: string;
  mediaType?: string;
}

export interface FollowUpConfig {
  enabled: boolean;
  delayMinutes: number;
  delayValue?: number;
  unit?: "minutes" | "hours" | "days" | "months";
  message?: string;
}

export interface Config {
  systemPrompt: string;
  productInfo: string;
  products?: ProductItem[];
  keywordReplies?: { keyword: string; reply: string }[];
  enabledFeatures?: string[];
  globalAiEnabled?: boolean;
  storeUrl?: string;
  storeCurrency?: string;
  businessName?: string;
  timezone?: string;
  workingHours?: string;
  botMode?: "orders" | "appointments" | "both";
  maxFollowUps?: number;
  followUps?: FollowUpConfig[];
  anthropicApiKey?: string;
  openRouterApiKey?: string;
  apiKey?: string;
  deepgramApiKey?: string;
  deepgramVoice?: string;
}

export function formatProductsToCatalog(products: ProductItem[], currency: string = "$"): string {
  if (!products || products.length === 0) return "";
  let text = "--- E-COMMERCE CATALOG ---\n\n";
  const grouped: Record<string, ProductItem[]> = {};

  products.forEach(p => {
    const cat = p.category || "General Products";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  });

  for (const [cat, items] of Object.entries(grouped)) {
    text += `\n### CATEGORY: ${cat.toUpperCase()} ###\n`;
    items.forEach(p => {
      let variationsText = "";
      if (p.variations && p.variations.length > 0) {
        variationsText = "\n  Variations:";
        p.variations.forEach(v => {
          variationsText += `\n    - ${v.title}: ${v.price}`;
        });
      }
      text += `- ${p.title} (Base Price/Range: ${p.price})\n  Image: ${p.image || "N/A"}\n  Link: ${p.link || "N/A"}${p.description ? `\n  Description: ${p.description}` : ""}${variationsText}\n\n`;
    });
  }
  return text;
}

export interface Appointment {
  id: string;
  tenantId?: string;
  phone: string;
  name: string;
  service: string;
  date: string;
  time: string;
  status: "booked" | "cancelled";
  notes?: string;
}

export interface Customer {
  phone: string;
  tenantId?: string;
  name: string;
  jid?: string;
  preferences?: string;
  aiEnabled?: boolean;
  followUpLevel?: number;
  leadStatus?: "hot" | "cold" | "none";
  tags?: string[];
  pipelineStage?: "new" | "qualified" | "warm" | "cold" | "completed";
  isOptedOut?: boolean;
  optedOutAt?: string;
  isLead?: boolean;
  pipelineStageSetByUser?: boolean;
  leadCreatedAt?: string;
}

export interface PromotionLog {
  id: string;
  tenantId?: string;
  timestamp: string;
  audience: string;
  message: string;
  successCount: number;
  failureCount: number;
}

export interface Order {
  id: string;
  tenantId?: string;
  phone: string;
  customerName?: string;
  productName: string;
  productImageUrl?: string;
  size?: string;
  color?: string;
  deliveryAddress?: string;
  contactNumber?: string;
  paymentMethod?: string;
  price?: string;
  timestamp: string;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "confirmed";
  recoveryStage?: number;
  notes?: string;
}

export interface ScheduledFollowUp {
  id: string;
  tenantId?: string;
  phone: string;
  sendAt: string; // ISO Timestamp
  context: string;
  status: "pending" | "sent" | "cancelled" | "failed";
  createdAt: string;
}

export interface LeadRevivalProgress {
  phase: 1 | 2;
  introSentAt?: string;
  followUpCount: number;
  nextRunAt?: string;
  status: "pending" | "phase1_done" | "in_followup" | "replied" | "opted_out" | "completed" | "failed";
  lastMessageType?: "text" | "media" | "voice";
}

export interface Phase2Settings {
  enabled: boolean;
  intervalDays: number;
  maxFollowUps: number;
  mode: "text" | "media" | "voice" | "mixed";
  messages: string[];
  mediaBase64?: string;
  mediaMimetype?: string;
  voiceBase64?: string;
  voiceMimetype?: string;
}

export interface RevivalCampaign {
  id: string;
  tenantId?: string;
  name?: string;
  message: string;
  audience: string;
  timeSlotStart: string;
  timeSlotEnd: string;
  delayMinutes: number;
  dailyCap: number;
  status: "active" | "paused" | "completed" | "cancelled";
  targetPhones: string[];
  sentPhones: string[];
  failedPhones: string[];
  repliedPhones?: string[];
  optedOutPhones?: string[];
  sentToday: number;
  lastSentDate: string;
  createdAt: string;
  mediaBase64?: string;
  mimetype?: string;
  fileName?: string;
  voiceBase64?: string;
  voiceMimetype?: string;
  messageType?: "text" | "media" | "voice";
  phase2Settings?: Phase2Settings;
  leadProgress?: Record<string, LeadRevivalProgress>;
  lastSentAt?: string;
  delayMinSeconds?: number;
  delayMaxSeconds?: number;
  batchSize?: number;
  batchBreakMinutes?: number;
  lastBatchSentAt?: string;
}

export interface DbSchema {
  chats: Record<string, ChatMessage[]>;
  config: Config;
  appointments: Appointment[];
  customers: Record<string, Customer>;
  promotions: PromotionLog[];
  orders: Order[];
  scheduledFollowUps: ScheduledFollowUp[];
  revivalCampaigns: RevivalCampaign[];
  tenants?: Tenant[];
  partners?: Partner[];
}

const DEFAULT_CONFIG: Config = {
  systemPrompt: "You are an expert Booking and Sales AI Assistant. Your goal is to consult the user, answer questions, and recommend products or book appointments using your tools.",
  productInfo: "Services offered:\n- Basic Consultation: $50\n- Premium Service: $150\n\nWorking hours: 9 AM to 5 PM, Monday to Friday.",
  keywordReplies: [],
  enabledFeatures: [],
  businessName: "My Business",
  timezone: "UTC",
  workingHours: "9:00 AM - 5:00 PM",
  followUps: [
    { enabled: true, delayMinutes: 60, delayValue: 1, unit: "hours" },
    { enabled: true, delayMinutes: 1440, delayValue: 1, unit: "days" },
    { enabled: true, delayMinutes: 2880, delayValue: 2, unit: "days" },
    { enabled: true, delayMinutes: 4320, delayValue: 3, unit: "days" },
    { enabled: true, delayMinutes: 7200, delayValue: 5, unit: "days" },
    { enabled: true, delayMinutes: 10080, delayValue: 7, unit: "days" },
    { enabled: true, delayMinutes: 14400, delayValue: 10, unit: "days" }
  ]
};

const DEFAULT_TENANT_ID = 'admin';

export class DB {
  // --- CHATS ---
  static async getChats(phoneNumber: string, tenantId?: string | null): Promise<ChatMessage[]> {
    if (!supabase) return [];
    try {
      let query = supabase.from('chat_messages').select('*').eq('phone', phoneNumber);
      if (tenantId && tenantId !== 'admin') {
        query = query.or(`tenant_id.eq.${tenantId},tenant_id.eq.admin`);
      }
      const { data, error } = await query.order('timestamp', { ascending: true });
      if (error || !data) return [];
      return data.map((m: any) => ({
        id: m.message_id || m.id,
        tenantId: m.tenant_id,
        role: m.role,
        content: m.content || '',
        timestamp: m.timestamp || m.created_at,
        status: m.status || 1,
        mediaUrl: m.media_url,
        mediaType: m.media_type
      }));
    } catch (e) {
      console.error('[DB/Supabase] getChats error:', e);
      return [];
    }
  }

  static async getAllChats(tenantId?: string | null): Promise<Record<string, ChatMessage[]>> {
    if (!supabase) return {};
    try {
      let query = supabase.from('chat_messages').select('*');
      if (tenantId && tenantId !== 'admin') {
        query = query.or(`tenant_id.eq.${tenantId},tenant_id.eq.admin`);
      }
      const { data, error } = await query.order('timestamp', { ascending: true });
      if (error || !data) return {};

      const result: Record<string, ChatMessage[]> = {};
      data.forEach((m: any) => {
        if (!result[m.phone]) result[m.phone] = [];
        result[m.phone].push({
          id: m.message_id || m.id,
          tenantId: m.tenant_id,
          role: m.role,
          content: m.content || '',
          timestamp: m.timestamp || m.created_at,
          status: m.status || 1,
          mediaUrl: m.media_url,
          mediaType: m.media_type
        });
      });
      return result;
    } catch (e) {
      console.error('[DB/Supabase] getAllChats error:', e);
      return {};
    }
  }

  static async addChatMessage(phoneNumber: string, message: Omit<ChatMessage, "timestamp"> & { timestamp?: string; tenantId?: string }, tenantId?: string) {
    if (!supabase) return;
    try {
      const resolvedTenantId = tenantId || message.tenantId || DEFAULT_TENANT_ID;
      await supabase.from('chat_messages').insert({
        message_id: message.id || Math.random().toString(36).substring(7),
        tenant_id: resolvedTenantId,
        phone: phoneNumber,
        role: message.role,
        content: message.content,
        status: message.status || 1,
        media_url: message.mediaUrl || null,
        media_type: message.mediaType || null,
        timestamp: message.timestamp || new Date().toISOString()
      });
    } catch (e) {
      console.error('[DB/Supabase] addChatMessage error:', e);
    }
  }

  static async updateMessageStatus(messageId: string, status: number) {
    if (!supabase) return;
    try {
      await supabase.from('chat_messages').update({ status }).eq('message_id', messageId);
    } catch (e) {
      console.error('[DB/Supabase] updateMessageStatus error:', e);
    }
  }

  static async getUnreadMessageIds(phone: string, tenantId?: string | null): Promise<string[]> {
    if (!supabase) return [];
    try {
      let query = supabase.from('chat_messages').select('message_id, status').eq('phone', phone).eq('role', 'user').lt('status', 4);
      if (tenantId && tenantId !== 'admin') query = query.eq('tenant_id', tenantId);
      const { data } = await query;
      return (data || []).map((m: any) => m.message_id).filter(Boolean);
    } catch (e) {
      return [];
    }
  }

  static async markMessagesAsReadInDb(phone: string, messageIds: string[], tenantId?: string | null) {
    if (!supabase || messageIds.length === 0) return;
    try {
      let query = supabase.from('chat_messages').update({ status: 4 }).eq('phone', phone).in('message_id', messageIds);
      if (tenantId && tenantId !== 'admin') query = query.eq('tenant_id', tenantId);
      await query;
    } catch (e) {
      console.error('[DB/Supabase] markMessagesAsReadInDb error:', e);
    }
  }

  // --- CONFIG ---
  static async getConfig(tenantId?: string | null): Promise<Config> {
    if (!supabase) return DEFAULT_CONFIG;
    try {
      const resolvedTenantId = tenantId || DEFAULT_TENANT_ID;
      const { data } = await supabase.from('tenant_configs').select('*').eq('tenant_id', resolvedTenantId).single();
      if (!data) return DEFAULT_CONFIG;

      return {
        systemPrompt: data.system_prompt || DEFAULT_CONFIG.systemPrompt,
        productInfo: data.product_info || DEFAULT_CONFIG.productInfo,
        products: data.products || [],
        keywordReplies: data.keyword_replies || [],
        enabledFeatures: data.enabled_features || [],
        globalAiEnabled: data.global_ai_enabled !== false,
        storeUrl: data.store_url || '',
        storeCurrency: data.store_currency || '$',
        businessName: data.business_name || 'My Business',
        timezone: data.timezone || 'UTC',
        workingHours: data.working_hours || '9:00 AM - 5:00 PM',
        botMode: data.bot_mode || 'both',
        maxFollowUps: data.max_follow_ups || 7,
        followUps: data.follow_ups || DEFAULT_CONFIG.followUps
      };
    } catch (e) {
      return DEFAULT_CONFIG;
    }
  }

  static async updateConfig(newConfig: Partial<Config>, tenantId?: string | null) {
    if (!supabase) return;
    try {
      const resolvedTenantId = tenantId || DEFAULT_TENANT_ID;
      const existing = await DB.getConfig(resolvedTenantId);
      const updated = { ...existing, ...newConfig };

      await supabase.from('tenant_configs').upsert({
        tenant_id: resolvedTenantId,
        system_prompt: updated.systemPrompt,
        product_info: updated.productInfo,
        products: updated.products || [],
        keyword_replies: updated.keywordReplies || [],
        enabled_features: updated.enabledFeatures || [],
        global_ai_enabled: updated.globalAiEnabled !== false,
        store_url: updated.storeUrl,
        store_currency: updated.storeCurrency,
        business_name: updated.businessName,
        timezone: updated.timezone,
        working_hours: updated.workingHours,
        bot_mode: updated.botMode,
        max_follow_ups: updated.maxFollowUps,
        follow_ups: updated.followUps || []
      }, { onConflict: 'tenant_id' });
    } catch (e) {
      console.error('[DB/Supabase] updateConfig error:', e);
    }
  }

  // --- CUSTOMERS ---
  static async getCustomer(phone: string, tenantId?: string | null): Promise<Customer | undefined> {
    if (!supabase) return undefined;
    try {
      let query = supabase.from('customers').select('*').eq('phone', phone);
      if (tenantId && tenantId !== 'admin') {
        query = query.or(`tenant_id.eq.${tenantId},tenant_id.eq.admin`);
      }
      const { data } = await query.limit(1);
      if (!data || data.length === 0) return undefined;
      const c = data[0];
      return {
        phone: c.phone,
        tenantId: c.tenant_id,
        name: c.name || c.phone,
        jid: c.jid,
        preferences: c.preferences,
        aiEnabled: c.ai_enabled !== false,
        followUpLevel: c.follow_up_level || 0,
        leadStatus: c.lead_status || 'none',
        tags: c.tags || [],
        pipelineStage: c.pipeline_stage || 'new',
        isOptedOut: Boolean(c.is_opted_out),
        optedOutAt: c.opted_out_at,
        isLead: Boolean(c.is_lead),
        pipelineStageSetByUser: Boolean(c.pipeline_stage_set_by_user),
        leadCreatedAt: c.lead_created_at
      };
    } catch (e) {
      return undefined;
    }
  }

  static async updateCustomer(phone: string, data: Partial<Customer>, tenantId?: string | null) {
    if (!supabase) return;
    try {
      const resolvedTenantId = tenantId || data.tenantId || DEFAULT_TENANT_ID;
      const existing = await DB.getCustomer(phone, resolvedTenantId);
      const merged = { ...existing, ...data, phone };

      await supabase.from('customers').upsert({
        tenant_id: resolvedTenantId,
        phone: merged.phone,
        name: merged.name || merged.phone,
        jid: merged.jid || '',
        preferences: merged.preferences || '',
        ai_enabled: merged.aiEnabled !== false,
        follow_up_level: merged.followUpLevel || 0,
        lead_status: merged.leadStatus || 'none',
        tags: merged.tags || [],
        pipeline_stage: merged.pipelineStage || 'new',
        is_opted_out: Boolean(merged.isOptedOut),
        opted_out_at: merged.optedOutAt || null,
        is_lead: Boolean(merged.isLead),
        pipeline_stage_set_by_user: Boolean(merged.pipelineStageSetByUser),
        lead_created_at: merged.leadCreatedAt || new Date().toISOString()
      }, { onConflict: 'tenant_id,phone' });
    } catch (e) {
      console.error('[DB/Supabase] updateCustomer error:', e);
    }
  }

  static async getAllCustomers(tenantId?: string | null): Promise<Customer[]> {
    if (!supabase) return [];
    try {
      let query = supabase.from('customers').select('*');
      if (tenantId && tenantId !== 'admin') {
        query = query.or(`tenant_id.eq.${tenantId},tenant_id.eq.admin`);
      }
      const { data } = await query;
      return (data || []).map((c: any) => ({
        phone: c.phone,
        tenantId: c.tenant_id,
        name: c.name || c.phone,
        jid: c.jid,
        preferences: c.preferences,
        aiEnabled: c.ai_enabled !== false,
        followUpLevel: c.follow_up_level || 0,
        leadStatus: c.lead_status || 'none',
        tags: c.tags || [],
        pipelineStage: c.pipeline_stage || 'new',
        isOptedOut: Boolean(c.is_opted_out),
        optedOutAt: c.opted_out_at,
        isLead: Boolean(c.is_lead),
        pipelineStageSetByUser: Boolean(c.pipeline_stage_set_by_user),
        leadCreatedAt: c.lead_created_at
      }));
    } catch (e) {
      return [];
    }
  }

  // --- APPOINTMENTS ---
  static async getAllAppointments(tenantId?: string | null): Promise<Appointment[]> {
    if (!supabase) return [];
    try {
      let query = supabase.from('appointments').select('*');
      if (tenantId && tenantId !== 'admin') query = query.eq('tenant_id', tenantId);
      const { data } = await query;
      return (data || []).map((a: any) => ({
        id: a.id,
        tenantId: a.tenant_id,
        phone: a.phone,
        name: a.name || a.phone,
        service: a.service || 'Discovery Call',
        date: a.date,
        time: a.time,
        status: a.status || 'booked',
        notes: a.notes
      }));
    } catch (e) {
      return [];
    }
  }

  static async getAppointmentsByDate(date: string, tenantId?: string | null): Promise<Appointment[]> {
    const all = await DB.getAllAppointments(tenantId);
    return all.filter(a => a.date === date && a.status === 'booked');
  }

  static async getAppointmentsByPhone(phone: string, tenantId?: string | null): Promise<Appointment[]> {
    const all = await DB.getAllAppointments(tenantId);
    return all.filter(a => a.phone === phone);
  }

  static async bookAppointment(phone: string, name: string, service: string, date: string, time: string, notes?: string, tenantId?: string | null): Promise<boolean> {
    if (!supabase) return false;
    try {
      const resolvedTenantId = tenantId || DEFAULT_TENANT_ID;
      const apptId = "APT-" + Math.random().toString(36).substring(2, 8).toUpperCase();

      await supabase.from('appointments').insert({
        id: apptId,
        tenant_id: resolvedTenantId,
        phone,
        name: name || phone,
        service: service || "Discovery Call / Service",
        date,
        time,
        status: "booked",
        notes
      });

      await DB.updateCustomer(phone, { name: name || phone }, resolvedTenantId);

      const apptTitle = `📅 Appointment: ${service || "Discovery Call"} (${date} @ ${time})`;
      await DB.addOrder(phone, {
        productName: apptTitle,
        contactNumber: phone,
        deliveryAddress: `Scheduled Date: ${date}, Time: ${time}`,
        price: "Service Booking",
        notes: notes || `Appointment booked for ${service || 'Service Call'}. Client scheduled for ${date} at ${time}.`,
        customerName: name || phone
      }, resolvedTenantId);

      return true;
    } catch (e) {
      console.error('[DB/Supabase] bookAppointment error:', e);
      return false;
    }
  }

  static async cancelAppointment(phone: string, date: string, time: string, tenantId?: string | null): Promise<boolean> {
    if (!supabase) return false;
    try {
      let query = supabase.from('appointments').update({ status: 'cancelled' }).eq('phone', phone).eq('date', date).eq('time', time);
      if (tenantId && tenantId !== 'admin') query = query.eq('tenant_id', tenantId);
      await query;

      let orderQuery = supabase.from('orders').update({ status: 'cancelled' }).eq('phone', phone).ilike('product_name', `%${date}%`);
      if (tenantId && tenantId !== 'admin') orderQuery = orderQuery.eq('tenant_id', tenantId);
      await orderQuery;

      return true;
    } catch (e) {
      return false;
    }
  }

  // --- ORDERS ---
  static async getOrders(tenantId?: string | null): Promise<Order[]> {
    if (!supabase) return [];
    try {
      let query = supabase.from('orders').select('*').order('timestamp', { ascending: false });
      if (tenantId && tenantId !== 'admin') query = query.eq('tenant_id', tenantId);
      const { data } = await query;
      return (data || []).map((o: any) => ({
        id: o.id,
        tenantId: o.tenant_id,
        phone: o.phone,
        customerName: o.customer_name || o.phone,
        productName: o.product_name,
        productImageUrl: o.product_image_url,
        size: o.size,
        color: o.color,
        deliveryAddress: o.delivery_address,
        contactNumber: o.contact_number,
        paymentMethod: o.payment_method,
        price: o.price,
        timestamp: o.timestamp || o.created_at,
        status: o.status || 'pending',
        recoveryStage: o.recovery_stage || 0,
        notes: o.notes
      }));
    } catch (e) {
      return [];
    }
  }

  static async addOrder(phone: string, data: { productName: string; productImageUrl?: string; size?: string; color?: string; deliveryAddress?: string; contactNumber?: string; paymentMethod?: string; price?: string; customerName?: string; notes?: string }, tenantId?: string | null): Promise<Order> {
    const resolvedTenantId = tenantId || DEFAULT_TENANT_ID;
    const ordId = "ORD-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    const newOrder: Order = {
      id: ordId,
      tenantId: resolvedTenantId,
      phone,
      customerName: data.customerName || phone,
      productName: data.productName,
      productImageUrl: data.productImageUrl,
      size: data.size,
      color: data.color,
      deliveryAddress: data.deliveryAddress,
      contactNumber: data.contactNumber || phone,
      paymentMethod: data.paymentMethod,
      price: data.price,
      timestamp: new Date().toISOString(),
      status: "pending",
      recoveryStage: 0,
      notes: data.notes
    };

    if (supabase) {
      try {
        await supabase.from('orders').insert({
          id: newOrder.id,
          tenant_id: resolvedTenantId,
          phone,
          customer_name: newOrder.customerName,
          product_name: newOrder.productName,
          product_image_url: newOrder.productImageUrl,
          size: newOrder.size,
          color: newOrder.color,
          delivery_address: newOrder.deliveryAddress,
          contact_number: newOrder.contactNumber,
          payment_method: newOrder.paymentMethod,
          price: newOrder.price,
          status: newOrder.status,
          recovery_stage: 0,
          notes: newOrder.notes,
          timestamp: newOrder.timestamp
        });
      } catch (e) {
        console.error('[DB/Supabase] addOrder error:', e);
      }
    }
    return newOrder;
  }

  static async updateOrder(orderId: string, updates: Partial<Order>, tenantId?: string | null) {
    if (!supabase) return;
    try {
      const payload: any = {};
      if (updates.status) payload.status = updates.status;
      if (updates.recoveryStage !== undefined) payload.recovery_stage = updates.recoveryStage;
      if (updates.notes !== undefined) payload.notes = updates.notes;
      if (updates.customerName) payload.customer_name = updates.customerName;

      let query = supabase.from('orders').update(payload).eq('id', orderId);
      if (tenantId && tenantId !== 'admin') query = query.eq('tenant_id', tenantId);
      await query;
    } catch (e) {
      console.error('[DB/Supabase] updateOrder error:', e);
    }
  }

  static async updateOrderStatus(id: string, status: Order["status"], tenantId?: string | null): Promise<boolean> {
    await DB.updateOrder(id, { status }, tenantId);
    return true;
  }

  // --- SCHEDULED FOLLOW-UPS ---
  static async addScheduledFollowUp(followUp: ScheduledFollowUp, tenantId?: string | null) {
    if (!supabase) return;
    try {
      const resolvedTenantId = tenantId || followUp.tenantId || DEFAULT_TENANT_ID;
      await supabase.from('scheduled_follow_ups').insert({
        id: followUp.id || Math.random().toString(36).substring(2, 8),
        tenant_id: resolvedTenantId,
        phone: followUp.phone,
        send_at: followUp.sendAt,
        context: followUp.context || '',
        status: followUp.status || 'pending',
        created_at: followUp.createdAt || new Date().toISOString()
      });
    } catch (e) {
      console.error('[DB/Supabase] addScheduledFollowUp error:', e);
    }
  }

  static async getPendingFollowUps(tenantId?: string | null): Promise<ScheduledFollowUp[]> {
    if (!supabase) return [];
    try {
      let query = supabase.from('scheduled_follow_ups').select('*').eq('status', 'pending');
      if (tenantId && tenantId !== 'admin') query = query.eq('tenant_id', tenantId);
      const { data } = await query;
      return (data || []).map((f: any) => ({
        id: f.id,
        tenantId: f.tenant_id,
        phone: f.phone,
        sendAt: f.send_at,
        context: f.context,
        status: f.status,
        createdAt: f.created_at
      }));
    } catch (e) {
      return [];
    }
  }

  static async getAllScheduledFollowUps(tenantId?: string | null): Promise<ScheduledFollowUp[]> {
    if (!supabase) return [];
    try {
      let query = supabase.from('scheduled_follow_ups').select('*');
      if (tenantId && tenantId !== 'admin') query = query.eq('tenant_id', tenantId);
      const { data } = await query;
      return (data || []).map((f: any) => ({
        id: f.id,
        tenantId: f.tenant_id,
        phone: f.phone,
        sendAt: f.send_at,
        context: f.context,
        status: f.status,
        createdAt: f.created_at
      }));
    } catch (e) {
      return [];
    }
  }

  static async updateFollowUpStatus(id: string, status: "pending" | "sent" | "cancelled" | "failed", tenantId?: string | null) {
    if (!supabase) return;
    try {
      let query = supabase.from('scheduled_follow_ups').update({ status }).eq('id', id);
      if (tenantId && tenantId !== 'admin') query = query.eq('tenant_id', tenantId);
      await query;
    } catch (e) {
      console.error('[DB/Supabase] updateFollowUpStatus error:', e);
    }
  }

  static async cancelPendingFollowUps(phone: string, tenantId?: string | null) {
    if (!supabase) return;
    try {
      let query = supabase.from('scheduled_follow_ups').update({ status: 'cancelled' }).eq('phone', phone).eq('status', 'pending');
      if (tenantId && tenantId !== 'admin') query = query.eq('tenant_id', tenantId);
      await query;
    } catch (e) {
      console.error('[DB/Supabase] cancelPendingFollowUps error:', e);
    }
  }

  // --- PROMOTIONS ---
  static async getPromotionLogs(tenantId?: string | null): Promise<PromotionLog[]> {
    if (!supabase) return [];
    try {
      let query = supabase.from('promotion_logs').select('*').order('timestamp', { ascending: false });
      if (tenantId && tenantId !== 'admin') query = query.eq('tenant_id', tenantId);
      const { data } = await query;
      return (data || []).map((p: any) => ({
        id: p.id,
        tenantId: p.tenant_id,
        timestamp: p.timestamp,
        audience: p.audience,
        message: p.message,
        successCount: p.success_count,
        failureCount: p.failure_count
      }));
    } catch (e) {
      return [];
    }
  }

  static async addPromotionLog(log: PromotionLog, tenantId?: string | null) {
    if (!supabase) return;
    try {
      const resolvedTenantId = tenantId || log.tenantId || DEFAULT_TENANT_ID;
      await supabase.from('promotion_logs').insert({
        id: log.id || Math.random().toString(36).substring(7),
        tenant_id: resolvedTenantId,
        timestamp: log.timestamp || new Date().toISOString(),
        audience: log.audience,
        message: log.message,
        success_count: log.successCount,
        failure_count: log.failureCount
      });
    } catch (e) {
      console.error('[DB/Supabase] addPromotionLog error:', e);
    }
  }

  // --- REVIVAL CAMPAIGNS ---
  static async getRevivalCampaigns(tenantId?: string | null): Promise<RevivalCampaign[]> {
    if (!supabase) return [];
    try {
      let query = supabase.from('revival_campaigns').select('*').order('created_at', { ascending: false });
      if (tenantId && tenantId !== 'admin') query = query.eq('tenant_id', tenantId);
      const { data } = await query;
      return (data || []).map((c: any) => ({
        id: c.id,
        tenantId: c.tenant_id,
        name: c.name,
        message: c.message,
        audience: c.audience,
        timeSlotStart: c.time_slot_start,
        timeSlotEnd: c.time_slot_end,
        delayMinutes: c.delay_minutes,
        dailyCap: c.daily_cap,
        status: c.status,
        targetPhones: c.target_phones || [],
        sentPhones: c.sent_phones || [],
        failedPhones: c.failed_phones || [],
        repliedPhones: c.replied_phones || [],
        optedOutPhones: c.opted_out_phones || [],
        sentToday: c.sent_today || 0,
        lastSentDate: c.last_sent_date,
        createdAt: c.created_at,
        mediaBase64: c.media_base64,
        mimetype: c.mimetype,
        fileName: c.file_name,
        voiceBase64: c.voice_base64,
        voiceMimetype: c.voice_mimetype,
        messageType: c.message_type,
        phase2Settings: c.phase2_settings,
        leadProgress: c.lead_progress,
        lastSentAt: c.last_sent_at
      }));
    } catch (e) {
      return [];
    }
  }

  static async getActiveCampaign(tenantId?: string | null): Promise<RevivalCampaign | null> {
    const campaigns = await DB.getRevivalCampaigns(tenantId);
    return campaigns.find(c => c.status === 'active') || null;
  }

  static async addRevivalCampaign(campaign: RevivalCampaign, tenantId?: string | null) {
    if (!supabase) return;
    try {
      const resolvedTenantId = tenantId || campaign.tenantId || DEFAULT_TENANT_ID;
      await supabase.from('revival_campaigns').insert({
        id: campaign.id,
        tenant_id: resolvedTenantId,
        name: campaign.name,
        message: campaign.message,
        audience: campaign.audience,
        time_slot_start: campaign.timeSlotStart,
        time_slot_end: campaign.timeSlotEnd,
        delay_minutes: campaign.delayMinutes,
        daily_cap: campaign.dailyCap,
        status: campaign.status,
        target_phones: campaign.targetPhones || [],
        sent_phones: campaign.sentPhones || [],
        failed_phones: campaign.failedPhones || [],
        replied_phones: campaign.repliedPhones || [],
        opted_out_phones: campaign.optedOutPhones || [],
        sent_today: campaign.sentToday || 0,
        last_sent_date: campaign.lastSentDate,
        media_base64: campaign.mediaBase64,
        mimetype: campaign.mimetype,
        file_name: campaign.fileName,
        voice_base64: campaign.voiceBase64,
        voice_mimetype: campaign.voiceMimetype,
        message_type: campaign.messageType,
        phase2_settings: campaign.phase2Settings || {},
        lead_progress: campaign.leadProgress || {},
        created_at: campaign.createdAt || new Date().toISOString()
      });
    } catch (e) {
      console.error('[DB/Supabase] addRevivalCampaign error:', e);
    }
  }

  static async updateRevivalCampaign(id: string, updates: Partial<RevivalCampaign>, tenantId?: string | null) {
    if (!supabase) return;
    try {
      const payload: any = {};
      if (updates.status) payload.status = updates.status;
      if (updates.sentToday !== undefined) payload.sent_today = updates.sentToday;
      if (updates.lastSentDate) payload.last_sent_date = updates.lastSentDate;
      if (updates.sentPhones) payload.sent_phones = updates.sentPhones;
      if (updates.failedPhones) payload.failed_phones = updates.failedPhones;
      if (updates.leadProgress) payload.lead_progress = updates.leadProgress;

      let query = supabase.from('revival_campaigns').update(payload).eq('id', id);
      if (tenantId && tenantId !== 'admin') query = query.eq('tenant_id', tenantId);
      await query;
    } catch (e) {
      console.error('[DB/Supabase] updateRevivalCampaign error:', e);
    }
  }

  // --- TENANTS & PARTNERS ---
  static async getTenants(): Promise<Tenant[]> {
    if (!supabase) return [];
    try {
      const { fetchTenantsFromSupabase } = await import('./supabase');
      const tenants = await fetchTenantsFromSupabase();
      return tenants || [];
    } catch (e) {
      return [];
    }
  }

  static async getTenantByUsername(username: string): Promise<Tenant | null> {
    if (!username) return null;
    const tenants = await DB.getTenants();
    const cleanUsername = username.trim().toLowerCase();
    const normalizedUsername = cleanUsername.replace(/[\s\-_]/g, '');

    return tenants.find(t => {
      const u1 = t.clientUsername?.trim().toLowerCase() || '';
      const u2 = t.email?.trim().toLowerCase() || '';
      const u3 = t.clientNumber?.toString().trim() || '';
      const u5 = t.businessName?.trim().toLowerCase() || '';

      if (u1 === cleanUsername || u2 === cleanUsername || u3 === cleanUsername) return true;
      if (u1.replace(/[\s\-_]/g, '') === normalizedUsername) return true;
      if (u5 && u5.replace(/[\s\-_]/g, '') === normalizedUsername) return true;
      return false;
    }) || null;
  }

  static async getTenantById(id: string): Promise<Tenant | null> {
    if (!id) return null;
    const tenants = await DB.getTenants();
    return tenants.find(t => t.id === id) || null;
  }

  static async saveTenants(tenants: Tenant[]): Promise<boolean> {
    return DB.saveTenantsAsync(tenants);
  }

  static async saveTenantsAsync(tenants: Tenant[]): Promise<boolean> {
    if (!supabase) return false;
    try {
      const { upsertTenantToSupabase } = await import('./supabase');
      const results = await Promise.all(tenants.map(t => upsertTenantToSupabase(t)));
      return results.every(Boolean);
    } catch (err) {
      console.error('[DB/Supabase] saveTenantsAsync error:', err);
      return false;
    }
  }

  static async getPartners(): Promise<Partner[]> {
    if (!supabase) return [];
    try {
      const { data } = await supabase.from('partners').select('*');
      return (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        role: p.role || 'partner',
        accessLevel: p.access_level || 'read_write',
        clientsAssigned: p.clients_assigned || 0,
        permissions: p.permissions || []
      }));
    } catch (e) {
      return [];
    }
  }

  static async savePartners(partners: Partner[]) {
    if (!supabase) return;
    try {
      const payloads = partners.map(p => ({
        id: p.id,
        name: p.name,
        email: p.email,
        role: p.role,
        access_level: p.accessLevel,
        clients_assigned: p.clientsAssigned,
        permissions: p.permissions || []
      }));
      await supabase.from('partners').upsert(payloads);
    } catch (e) {
      console.error('[DB/Supabase] savePartners error:', e);
    }
  }
}
