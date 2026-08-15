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

export const DEFAULT_CONFIG: Config = {
  systemPrompt: "You are a friendly, helpful AI team member. Engage warmly with customers, answer their questions accurately using the knowledge base and catalog, and assist them naturally.",
  productInfo: "",
  keywordReplies: [],
  enabledFeatures: [],
  businessName: "our store",
  timezone: "UTC",
  workingHours: "9:00 AM - 5:00 PM",
  followUps: [
    { enabled: true, delayMinutes: 60, delayValue: 1, unit: "hours", message: "Gentle check-in to see if they have any questions about the products or need help placing their order." },
    { enabled: true, delayMinutes: 1440, delayValue: 1, unit: "days", message: "Helpful nudge asking if they would like to complete their order today or need any recommendations." },
    { enabled: true, delayMinutes: 2880, delayValue: 2, unit: "days", message: "Address potential questions or hesitations, offering to clarify details or customize their order." },
    { enabled: true, delayMinutes: 4320, delayValue: 3, unit: "days", message: "Create gentle urgency by mentioning high demand or limited availability for popular items." },
    { enabled: true, delayMinutes: 7200, delayValue: 5, unit: "days", message: "Share social proof and popular customer favorites to re-ignite interest in placing an order." },
    { enabled: true, delayMinutes: 10080, delayValue: 7, unit: "days", message: "Offer a special perk like complimentary delivery or extra dip/side to encourage completing the order today." },
    { enabled: true, delayMinutes: 14400, delayValue: 10, unit: "days", message: "Final low-pressure check-in letting them know we are always here whenever they are ready to order." }
  ]
};

export const PIZZA_BOX_DEFAULT_SYSTEM_PROMPT = `You are the official WhatsApp ordering assistant for Pizza Box, a fast-food pizza restaurant in Peshawar. Tagline: "Happiness In A Box."

=== BRAND VOICE & TONE ===
- Friendly, fast, upbeat, and conversational. Talk like a real team member taking orders, NOT a robotic menu-reader.
- Keep replies concise (2-4 sentences max per message). WhatsApp customers want quick answers.
- Use 1-2 food emojis max per message (🍕🔥).
- Always quote EXACT prices from the Product Information & Catalog. Never estimate or round.

=== CORE RESPONSIBILITIES ===
1. ANSWERING MENU INQUIRIES: When a customer asks what pizzas/items are available (e.g. "pizza konsa hai", "kya items hain", "pizza khana", "menu deikhao"):
   - Answer directly in text listing 2-4 top popular pizzas/combos with prices.
   - ALWAYS call the send_product_card function to display visual product cards for top items!
2. TAKING ORDERS: When a user wants to order:
   - Immediately call place_order tool with whatever details you have (at least product_name).
   - Ask naturally for remaining details (flavor, size, delivery address, contact number).
3. UPSELLING:
   - Pizza order -> suggest a crust upgrade (Seekh Kabab Crust or Stuffed Cheese Crust) or a dip/drink.
   - Group/family order -> suggest a Box Combo for maximum value.
4. LANGUAGE: Automatically respond in the customer's language (Roman Urdu, Urdu, Pashto, English) with natural local phrasing.`;

export const PIZZA_BOX_DEFAULT_KNOWLEDGE_BASE = `=== PIZZA BOX PESHAWAR MENU & PRICE LIST ===

1. CROWN CRUST PIZZA:
   - Small: Rs. 650
   - Medium: Rs. 1,250
   - Large: Rs. 1,750
   - Flavors: Chicken Tikka, Fajita Delight, Cheese Lover, Spicy Supreme.

2. STUFFED CRUST PIZZA:
   - Small: Rs. 700
   - Medium: Rs. 1,350
   - Large: Rs. 1,850
   - Crust Options: Cheese Stuffed, Seekh Kabab Stuffed.

3. SPECIAL BOX COMBOS:
   - Box Combo 1 (For 1-2 People): 1 Small Pizza + 2 Garlic Breads + 345ml Drink — Rs. 850
   - Box Combo 2 (For 3-4 People): 1 Medium Pizza + 4 Wings + 1.5L Drink — Rs. 1,650
   - Family Box (For 5-6 People): 2 Large Pizzas + 6 Wings + 1.5L Drink + Dips — Rs. 3,200

4. SIDES & DRINKS:
   - Garlic Bread (4 pcs): Rs. 250
   - Chicken Wings (6 pcs): Rs. 450
   - Cold Drink (1.5 Litre): Rs. 220
   - Dips (Garlic Mayo, Chipotle): Rs. 70

=== RESTAURANT INFO ===
- Location: Peshawar, KPK
- Delivery Time: 30-45 Minutes
- Payment Methods: Cash on Delivery (COD), JazzCash, EasyPaisa
- Delivery Charges: Rs. 100 within city limits`;

const DEFAULT_TENANT_ID = 'admin';

export class DB {
  // --- EXPLICIT ADMIN ALL-TENANTS METHODS ---
  static async getAllChatsAdminAllTenants(): Promise<Record<string, ChatMessage[]>> {
    if (!supabase) return {};
    try {
      const { data, error } = await supabase.from('chat_messages').select('*').order('timestamp', { ascending: true });
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
      console.error('[DB/Admin] getAllChatsAdminAllTenants error:', e);
      return {};
    }
  }

  static async getAllCustomersAdminAllTenants(): Promise<Customer[]> {
    if (!supabase) return [];
    try {
      const { data } = await supabase.from('customers').select('*');
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
      console.error('[DB/Admin] getAllCustomersAdminAllTenants error:', e);
      return [];
    }
  }

  static async getOrdersAdminAllTenants(): Promise<Order[]> {
    if (!supabase) return [];
    try {
      const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
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
        timestamp: o.created_at || o.timestamp,
        status: o.status || 'pending',
        recoveryStage: o.recovery_stage || 0,
        notes: o.notes
      }));
    } catch (e) {
      console.error('[DB/Admin] getOrdersAdminAllTenants error:', e);
      return [];
    }
  }

  static async getAllAppointmentsAdminAllTenants(): Promise<Appointment[]> {
    if (!supabase) return [];
    try {
      const { data } = await supabase.from('appointments').select('*');
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
      console.error('[DB/Admin] getAllAppointmentsAdminAllTenants error:', e);
      return [];
    }
  }

  static async getAllScheduledFollowUpsAdminAllTenants(): Promise<ScheduledFollowUp[]> {
    if (!supabase) return [];
    try {
      const { data } = await supabase.from('scheduled_follow_ups').select('*');
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
      console.error('[DB/Admin] getAllScheduledFollowUpsAdminAllTenants error:', e);
      return [];
    }
  }

  // --- CHATS ---
  static async getChats(phoneNumber: string, tenantId?: string | null): Promise<ChatMessage[]> {
    if (!supabase) return [];
    if (!tenantId) {
      console.error('[SECURITY] getChats called without tenantId — refusing to return unfiltered data');
      return [];
    }
    try {
      const { data, error } = await supabase.from('chat_messages').select('*').eq('phone', phoneNumber).eq('tenant_id', tenantId).order('timestamp', { ascending: true });
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
    if (!tenantId) {
      console.error('[SECURITY] getAllChats called without tenantId — refusing to return unfiltered data');
      return {};
    }
    try {
      const { data, error } = await supabase.from('chat_messages').select('*').eq('tenant_id', tenantId).order('timestamp', { ascending: true });
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
    const resolvedTenantId = tenantId || message.tenantId;
    if (!resolvedTenantId) {
      console.error('[SECURITY] addChatMessage called without tenantId — refusing to insert under fallback');
      return;
    }
    try {
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
    if (!tenantId) {
      console.error('[SECURITY] getUnreadMessageIds called without tenantId — refusing query');
      return [];
    }
    try {
      const { data } = await supabase.from('chat_messages').select('message_id, status').eq('phone', phone).eq('tenant_id', tenantId).eq('role', 'user').lt('status', 4);
      return (data || []).map((m: any) => m.message_id).filter(Boolean);
    } catch (e) {
      return [];
    }
  }

  static async markMessagesAsReadInDb(phone: string, messageIds: string[], tenantId?: string | null) {
    if (!supabase || messageIds.length === 0) return;
    if (!tenantId) {
      console.error('[SECURITY] markMessagesAsReadInDb called without tenantId — refusing update');
      return;
    }
    try {
      await supabase.from('chat_messages').update({ status: 4 }).eq('phone', phone).eq('tenant_id', tenantId).in('message_id', messageIds);
    } catch (e) {
      console.error('[DB/Supabase] markMessagesAsReadInDb error:', e);
    }
  }

  // --- CONFIG ---
  static async getConfig(tenantId?: string | null): Promise<Config> {
    if (!supabase) return DEFAULT_CONFIG;
    if (!tenantId) {
      console.error('[SECURITY] getConfig called without tenantId — refusing fallback');
      return DEFAULT_CONFIG;
    }
    try {
      const resolvedTenantId = tenantId;

      const allTenants = await DB.getTenants();
      const tenantRecord = allTenants.find(t => t.id === resolvedTenantId) || null;

      const { data, error: cfgError } = await supabase
        .from('tenant_configs')
        .select('*')
        .eq('tenant_id', resolvedTenantId)
        .single();

      if (cfgError && cfgError.code !== 'PGRST116') {
        console.warn('[DB/Supabase] getConfig query error:', cfgError.message);
      }

      let systemPrompt = 
        (data?.system_prompt && data.system_prompt.trim() !== '') ? data.system_prompt :
        (tenantRecord?.systemPrompt && tenantRecord.systemPrompt.trim() !== '') ? tenantRecord.systemPrompt :
        '';

      let productInfo = 
        (data?.product_info && data.product_info.trim() !== '') ? data.product_info :
        (tenantRecord?.knowledgeBase && tenantRecord.knowledgeBase.trim() !== '') ? tenantRecord.knowledgeBase :
        (tenantRecord?.productKnowledgeBase && tenantRecord.productKnowledgeBase.trim() !== '') ? tenantRecord.productKnowledgeBase :
        '';

      if (resolvedTenantId === 't-1004') {
        if (!systemPrompt || systemPrompt.trim() === '') {
          systemPrompt = PIZZA_BOX_DEFAULT_SYSTEM_PROMPT;
        }
        if (!productInfo || productInfo.trim() === '') {
          productInfo = PIZZA_BOX_DEFAULT_KNOWLEDGE_BASE;
        }
      }

      if (!systemPrompt || systemPrompt.trim() === '') {
        systemPrompt = DEFAULT_CONFIG.systemPrompt;
      }

      const products = (data?.products && data.products.length > 0)
        ? data.products
        : (tenantRecord?.products || []);

      const businessName = data?.business_name || tenantRecord?.businessName || tenantRecord?.name || (resolvedTenantId === 't-1004' ? 'Pizza Box' : 'our store');

      if (!data && tenantRecord && (systemPrompt || productInfo)) {
        await supabase.from('tenant_configs').upsert({
          tenant_id: resolvedTenantId,
          system_prompt: systemPrompt,
          product_info: productInfo,
          products: products,
          business_name: businessName,
          global_ai_enabled: true
        }, { onConflict: 'tenant_id' });
      }

      return {
        systemPrompt,
        productInfo,
        products,
        keywordReplies: data?.keyword_replies || [],
        enabledFeatures: data?.enabled_features || [],
        globalAiEnabled: data?.global_ai_enabled !== false,
        storeUrl: data?.store_url || '',
        storeCurrency: data?.store_currency || (tenantRecord?.currency === 'PKR' ? 'Rs.' : '$'),
        businessName,
        timezone: data?.timezone || 'UTC',
        workingHours: data?.working_hours || '9:00 AM - 5:00 PM',
        botMode: data?.bot_mode || 'both',
        maxFollowUps: data?.max_follow_ups || 7,
        followUps: data?.follow_ups || DEFAULT_CONFIG.followUps
      };
    } catch (e) {
      console.error('[DB/Supabase] getConfig exception:', e);
      return DEFAULT_CONFIG;
    }
  }

  static async updateConfig(newConfig: Partial<Config>, tenantId?: string | null) {
    if (!supabase) return;
    if (!tenantId) {
      console.error('[SECURITY] updateConfig called without tenantId — refusing to update');
      return;
    }
    try {
      const existing = await DB.getConfig(tenantId);
      const updated = { ...existing, ...newConfig };

      await supabase.from('tenant_configs').upsert({
        tenant_id: tenantId,
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
    if (!tenantId) {
      console.error('[SECURITY] getCustomer called without tenantId — refusing to query across tenants');
      return undefined;
    }
    try {
      const { data } = await supabase.from('customers').select('*').eq('phone', phone).eq('tenant_id', tenantId).limit(1);
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
    const resolvedTenantId = tenantId || data.tenantId;
    if (!resolvedTenantId) {
      console.error('[SECURITY] updateCustomer called without tenantId — refusing to update under fallback');
      return;
    }
    try {
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
    if (!tenantId) {
      console.error('[SECURITY] getAllCustomers called without tenantId — refusing to return unfiltered data');
      return [];
    }
    try {
      const { data } = await supabase.from('customers').select('*').eq('tenant_id', tenantId);
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
    if (!tenantId) {
      console.error('[SECURITY] getAllAppointments called without tenantId — refusing query');
      return [];
    }
    try {
      const { data } = await supabase.from('appointments').select('*').eq('tenant_id', tenantId);
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
    if (!tenantId) {
      console.error('[SECURITY] bookAppointment called without tenantId — refusing appointment creation');
      return false;
    }
    try {
      const apptId = "APT-" + Math.random().toString(36).substring(2, 8).toUpperCase();

      await supabase.from('appointments').insert({
        id: apptId,
        tenant_id: tenantId,
        phone,
        name: name || phone,
        service: service || "Discovery Call / Service",
        date,
        time,
        status: "booked",
        notes
      });

      await DB.updateCustomer(phone, { name: name || phone }, tenantId);

      const apptTitle = `📅 Appointment: ${service || "Discovery Call"} (${date} @ ${time})`;
      await DB.addOrder(phone, {
        productName: apptTitle,
        contactNumber: phone,
        deliveryAddress: `Scheduled Date: ${date}, Time: ${time}`,
        price: "Service Booking",
        notes: notes || `Appointment booked for ${service || 'Service Call'}. Client scheduled for ${date} at ${time}.`,
        customerName: name || phone
      }, tenantId);

      return true;
    } catch (e) {
      console.error('[DB/Supabase] bookAppointment error:', e);
      return false;
    }
  }

  static async cancelAppointment(phone: string, date: string, time: string, tenantId?: string | null): Promise<boolean> {
    if (!supabase) return false;
    if (!tenantId) {
      console.error('[SECURITY] cancelAppointment called without tenantId — refusing update');
      return false;
    }
    try {
      await supabase.from('appointments').update({ status: 'cancelled' }).eq('phone', phone).eq('date', date).eq('time', time).eq('tenant_id', tenantId);
      await supabase.from('orders').update({ status: 'cancelled' }).eq('phone', phone).ilike('product_name', `%${date}%`).eq('tenant_id', tenantId);
      return true;
    } catch (e) {
      return false;
    }
  }

  // --- ORDERS ---
  static async getOrders(tenantId?: string | null): Promise<Order[]> {
    if (!supabase) return [];
    if (!tenantId) {
      console.error('[SECURITY] getOrders called without tenantId — refusing query');
      return [];
    }
    try {
      const { data } = await supabase.from('orders').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
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
        timestamp: o.created_at || o.timestamp,
        status: o.status || 'pending',
        recoveryStage: o.recovery_stage || 0,
        notes: o.notes
      }));
    } catch (e) {
      return [];
    }
  }

  static async addOrder(phone: string, data: { productName: string; productImageUrl?: string; size?: string; color?: string; deliveryAddress?: string; contactNumber?: string; paymentMethod?: string; price?: string; customerName?: string; notes?: string }, tenantId?: string | null): Promise<Order | null> {
    if (!tenantId) {
      console.error('[SECURITY] addOrder called without tenantId — refusing order creation');
      return null;
    }
    const ordId = "ORD-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    const newOrder: Order = {
      id: ordId,
      tenantId: tenantId,
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
          tenant_id: tenantId,
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
          notes: newOrder.notes,
          created_at: newOrder.timestamp
        });
      } catch (e) {
        console.error('[DB/Supabase] addOrder error:', e);
      }
    }
    return newOrder;
  }

  static async updateOrder(orderId: string, updates: Partial<Order>, tenantId?: string | null) {
    if (!supabase) return;
    if (!tenantId) {
      console.error('[SECURITY] updateOrder called without tenantId — refusing update');
      return;
    }
    try {
      const payload: any = {};
      if (updates.status) payload.status = updates.status;
      if (updates.notes !== undefined) payload.notes = updates.notes;
      if (updates.customerName) payload.customer_name = updates.customerName;

      await supabase.from('orders').update(payload).eq('id', orderId).eq('tenant_id', tenantId);
    } catch (e) {
      console.error('[DB/Supabase] updateOrder error:', e);
    }
  }

  static async updateOrderStatus(id: string, status: Order["status"], tenantId?: string | null): Promise<boolean> {
    if (!tenantId) return false;
    await DB.updateOrder(id, { status }, tenantId);
    return true;
  }

  // --- SCHEDULED FOLLOW-UPS ---
  static async addScheduledFollowUp(followUp: ScheduledFollowUp, tenantId?: string | null) {
    if (!supabase) return;
    const resolvedTenantId = tenantId || followUp.tenantId;
    if (!resolvedTenantId) {
      console.error('[SECURITY] addScheduledFollowUp called without tenantId — refusing creation');
      return;
    }
    try {
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
    if (!tenantId) {
      console.error('[SECURITY] getPendingFollowUps called without tenantId — refusing query');
      return [];
    }
    try {
      const { data } = await supabase.from('scheduled_follow_ups').select('*').eq('status', 'pending').eq('tenant_id', tenantId);
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
    if (!tenantId) {
      console.error('[SECURITY] getAllScheduledFollowUps called without tenantId — refusing query');
      return [];
    }
    try {
      const { data } = await supabase.from('scheduled_follow_ups').select('*').eq('tenant_id', tenantId);
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
    if (!tenantId) {
      console.error('[SECURITY] updateFollowUpStatus called without tenantId — refusing update');
      return;
    }
    try {
      await supabase.from('scheduled_follow_ups').update({ status }).eq('id', id).eq('tenant_id', tenantId);
    } catch (e) {
      console.error('[DB/Supabase] updateFollowUpStatus error:', e);
    }
  }

  static async cancelPendingFollowUps(phone: string, tenantId?: string | null) {
    if (!supabase) return;
    if (!tenantId) {
      console.error('[SECURITY] cancelPendingFollowUps called without tenantId — refusing update');
      return;
    }
    try {
      await supabase.from('scheduled_follow_ups').update({ status: 'cancelled' }).eq('phone', phone).eq('status', 'pending').eq('tenant_id', tenantId);
    } catch (e) {
      console.error('[DB/Supabase] cancelPendingFollowUps error:', e);
    }
  }

  // --- PROMOTIONS ---
  static async getPromotionLogs(tenantId?: string | null): Promise<PromotionLog[]> {
    if (!supabase) return [];
    if (!tenantId) {
      console.error('[SECURITY] getPromotionLogs called without tenantId — refusing query');
      return [];
    }
    try {
      const { data } = await supabase.from('promotion_logs').select('*').eq('tenant_id', tenantId).order('timestamp', { ascending: false });
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
    const resolvedTenantId = tenantId || log.tenantId;
    if (!resolvedTenantId) {
      console.error('[SECURITY] addPromotionLog called without tenantId — refusing log creation');
      return;
    }
    try {
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
    if (!tenantId) {
      console.error('[SECURITY] getRevivalCampaigns called without tenantId — refusing query');
      return [];
    }
    try {
      const { data } = await supabase.from('revival_campaigns').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
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
    if (!tenantId) return null;
    const campaigns = await DB.getRevivalCampaigns(tenantId);
    return campaigns.find(c => c.status === 'active') || null;
  }

  static async addRevivalCampaign(campaign: RevivalCampaign, tenantId?: string | null) {
    if (!supabase) return;
    const resolvedTenantId = tenantId || campaign.tenantId;
    if (!resolvedTenantId) {
      console.error('[SECURITY] addRevivalCampaign called without tenantId — refusing creation');
      return;
    }
    try {
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
    if (!tenantId) {
      console.error('[SECURITY] updateRevivalCampaign called without tenantId — refusing update');
      return;
    }
    try {
      const payload: any = {};
      if (updates.status) payload.status = updates.status;
      if (updates.sentToday !== undefined) payload.sent_today = updates.sentToday;
      if (updates.lastSentDate) payload.last_sent_date = updates.lastSentDate;
      if (updates.lastSentAt) payload.last_sent_at = updates.lastSentAt;
      if (updates.sentPhones) payload.sent_phones = updates.sentPhones;
      if (updates.failedPhones) payload.failed_phones = updates.failedPhones;
      if (updates.repliedPhones) payload.replied_phones = updates.repliedPhones;
      if (updates.optedOutPhones) payload.opted_out_phones = updates.optedOutPhones;
      if (updates.leadProgress) payload.lead_progress = updates.leadProgress;

      await supabase.from('revival_campaigns').update(payload).eq('id', id).eq('tenant_id', tenantId);
    } catch (e) {
      console.error('[DB/Supabase] updateRevivalCampaign error:', e);
    }
  }

  // --- TENANTS & PARTNERS ---
  static tenantsMemoryStore: Tenant[] = [
    {
      id: 't-1003',
      clientNumber: '1003',
      name: 'Ayan',
      businessName: 'ayan',
      phoneNumber: '03194188820',
      email: 'client@business.com',
      status: 'active',
      installationFee: 0,
      monthlySubscriptionFee: 0,
      currency: 'PKR',
      paymentStatus: 'paid',
      allocatedMinutes: 800,
      usedMinutes: 0,
      clientUsername: 'ayan_247',
      clientPassword: 'client1003',
      systemPrompt: '',
      knowledgeBase: '',
      productKnowledgeBase: '',
      followupMechanism: '',
      llmModel: 'gpt-4o-mini',
      temperature: 0.7,
      deepgramVoice: 'aura-asteria-en',
      deepgramApiKey: '',
      openaiApiKey: '',
      omnivoiceApiKey: '',
      omnivoiceNumber: '+1 (555) 668-1519',
      createdAt: new Date().toISOString(),
      troubleshoot: { webhookConnected: true, deepgramApiValid: true, llmApiValid: true, whatsappSessionActive: true, serviceBlocked: false },
      promotionsSent: 0,
      revivalLeadsActive: 0,
      conversationalLeadsCount: 0,
    },
    {
      id: 't-1004',
      clientNumber: '1004',
      name: 'Pizza Box',
      businessName: 'Pizza Box',
      phoneNumber: '03001234567',
      email: 'pizzabox@business.com',
      status: 'active',
      installationFee: 0,
      monthlySubscriptionFee: 9000,
      currency: 'PKR',
      paymentStatus: 'paid',
      allocatedMinutes: 800,
      usedMinutes: 0,
      clientUsername: 'pizzabox_183343',
      clientPassword: 'client1004',
      systemPrompt: PIZZA_BOX_DEFAULT_SYSTEM_PROMPT,
      knowledgeBase: PIZZA_BOX_DEFAULT_KNOWLEDGE_BASE,
      productKnowledgeBase: PIZZA_BOX_DEFAULT_KNOWLEDGE_BASE,
      followupMechanism: 'Standard follow-up',
      llmModel: 'gpt-4o-mini',
      temperature: 0.7,
      deepgramVoice: 'aura-asteria-en',
      deepgramApiKey: '',
      openaiApiKey: '',
      omnivoiceApiKey: '',
      omnivoiceNumber: '+1 (555) 123-4567',
      createdAt: new Date().toISOString(),
      troubleshoot: { webhookConnected: true, deepgramApiValid: true, llmApiValid: true, whatsappSessionActive: true, serviceBlocked: false },
      promotionsSent: 0,
      revivalLeadsActive: 0,
      conversationalLeadsCount: 0,
    },
    {
      id: 't-1002',
      clientNumber: '1002',
      name: 'Leads',
      businessName: 'Hazeldid Store',
      phoneNumber: '03177598978',
      email: 'client@business.com',
      status: 'active',
      installationFee: 0,
      monthlySubscriptionFee: 0,
      currency: 'PKR',
      paymentStatus: 'paid',
      allocatedMinutes: 800,
      usedMinutes: 0,
      clientUsername: 'hazeldid_346',
      clientPassword: 'client1002',
      systemPrompt: '',
      knowledgeBase: '',
      productKnowledgeBase: '',
      followupMechanism: '',
      llmModel: 'gpt-4o-mini',
      temperature: 0.7,
      deepgramVoice: 'aura-asteria-en',
      deepgramApiKey: '',
      openaiApiKey: '',
      omnivoiceApiKey: '',
      omnivoiceNumber: '+1 (555) 123-4567',
      createdAt: new Date().toISOString(),
      troubleshoot: { webhookConnected: true, deepgramApiValid: true, llmApiValid: true, whatsappSessionActive: true, serviceBlocked: false },
      promotionsSent: 0,
      revivalLeadsActive: 0,
      conversationalLeadsCount: 0,
    },
    {
      id: 't-1001',
      clientNumber: '1001',
      name: 'M Shafiq',
      businessName: 'Trend aura',
      phoneNumber: '0314 3060320',
      email: 'client@business.com',
      status: 'active',
      installationFee: 0,
      monthlySubscriptionFee: 9000,
      currency: 'PKR',
      paymentStatus: 'paid',
      allocatedMinutes: 800,
      usedMinutes: 0,
      clientUsername: 'trend_aura_423',
      clientPassword: 'client1001',
      systemPrompt: '',
      knowledgeBase: '',
      productKnowledgeBase: '',
      followupMechanism: '',
      llmModel: 'gpt-4o-mini',
      temperature: 0.7,
      deepgramVoice: 'aura-asteria-en',
      deepgramApiKey: '',
      openaiApiKey: '',
      omnivoiceApiKey: '',
      omnivoiceNumber: '+1 (555) 987-6543',
      createdAt: new Date().toISOString(),
      troubleshoot: { webhookConnected: true, deepgramApiValid: true, llmApiValid: true, whatsappSessionActive: true, serviceBlocked: false },
      promotionsSent: 0,
      revivalLeadsActive: 0,
      conversationalLeadsCount: 0,
    }
  ];

  static async getTenants(): Promise<Tenant[]> {
    if (supabase) {
      try {
        const { fetchTenantsFromSupabase } = await import('./supabase');
        const fetched = await fetchTenantsFromSupabase();
        if (fetched) {
          DB.tenantsMemoryStore = fetched;
          return fetched;
        }
      } catch (e) {
        console.error('Failed to fetch tenants from Supabase:', e);
      }
    }
    return DB.tenantsMemoryStore;
  }

  static async deleteTenant(tenantId: string): Promise<boolean> {
    if (!tenantId) return false;
    try {
      console.log(`[DB/deleteTenant] Permanently deleting tenant and all associated data for tenantId: ${tenantId}`);

      // 1. Remove from in-memory store
      DB.tenantsMemoryStore = DB.tenantsMemoryStore.filter(t => t.id !== tenantId);

      // 2. Delete from Supabase tables
      if (supabase) {
        await Promise.allSettled([
          supabase.from('tenants').delete().eq('id', tenantId),
          supabase.from('tenant_configs').delete().eq('tenant_id', tenantId),
          supabase.from('chat_messages').delete().eq('tenant_id', tenantId),
          supabase.from('customers').delete().eq('tenant_id', tenantId),
          supabase.from('appointments').delete().eq('tenant_id', tenantId),
          supabase.from('orders').delete().eq('tenant_id', tenantId),
          supabase.from('scheduled_follow_ups').delete().eq('tenant_id', tenantId),
          supabase.from('promotion_logs').delete().eq('tenant_id', tenantId),
          supabase.from('revival_campaigns').delete().eq('tenant_id', tenantId),
          supabase.from('whatsapp_auth').delete().eq('tenant_id', tenantId)
        ]);
      }

      // 3. Disconnect WhatsApp session if active for this tenant
      try {
        const { WhatsAppManager } = await import('./whatsapp');
        if (WhatsAppManager.getActiveTenantId() === tenantId) {
          await WhatsAppManager.softReset();
        }
      } catch (waErr) {
        console.error('[DB/deleteTenant] Error clearing WhatsApp session:', waErr);
      }

      return true;
    } catch (e) {
      console.error('[DB/deleteTenant] Exception:', e);
      return false;
    }
  }

  static async getTenantByUsername(username: string): Promise<Tenant | null> {
    if (!username) return null;
    const tenants = await DB.getTenants();
    const cleanUsername = username.trim().toLowerCase();
    const normalizedUsername = cleanUsername.replace(/[\s\-_]/g, '');

    // 1. Exact or normalized match
    let match = tenants.find(t => {
      const u1 = t.clientUsername?.trim().toLowerCase() || '';
      const u2 = t.email?.trim().toLowerCase() || '';
      const u3 = t.clientNumber?.toString().trim() || '';
      const u4 = `client${t.clientNumber}`.toLowerCase();
      const u5 = t.businessName?.trim().toLowerCase() || '';
      const u6 = t.name?.trim().toLowerCase() || '';
      const u7 = t.id?.trim().toLowerCase() || '';

      if (u1 === cleanUsername || u2 === cleanUsername || u3 === cleanUsername || u4 === cleanUsername || u7 === cleanUsername) return true;
      if (u1 && u1.replace(/[\s\-_]/g, '') === normalizedUsername) return true;
      if (u5 && u5.replace(/[\s\-_]/g, '') === normalizedUsername) return true;
      if (u6 && u6.replace(/[\s\-_]/g, '') === normalizedUsername) return true;
      return false;
    });

    if (match) return match;

    // 2. Partial prefix / fuzzy fallback (e.g. "pizzabox" matching "pizzabox_183343")
    return tenants.find(t => {
      const u1 = (t.clientUsername || '').toLowerCase().replace(/[\s\-_]/g, '');
      const u5 = (t.businessName || '').toLowerCase().replace(/[\s\-_]/g, '');
      const u6 = (t.name || '').toLowerCase().replace(/[\s\-_]/g, '');

      if (normalizedUsername.length >= 3) {
        if (u1 && (u1.startsWith(normalizedUsername) || normalizedUsername.startsWith(u1))) return true;
        if (u5 && (u5.startsWith(normalizedUsername) || normalizedUsername.startsWith(u5))) return true;
        if (u6 && (u6.startsWith(normalizedUsername) || normalizedUsername.startsWith(u6))) return true;
      }
      return false;
    }) || null;
  }

  static async getTenantById(id: string): Promise<Tenant | null> {
    if (!id) return null;
    const tenants = await DB.getTenants();
    const cleanId = id.toString().replace(/^#/, '').trim().toLowerCase();
    return tenants.find(t => 
      t.id === id || 
      t.id?.toLowerCase() === cleanId || 
      t.clientNumber?.toString().replace(/^#/, '').trim().toLowerCase() === cleanId ||
      t.clientUsername?.trim().toLowerCase() === cleanId
    ) || null;
  }

  static async saveTenants(tenants: Tenant[]): Promise<boolean> {
    const res = await DB.saveTenantsAsync(tenants);
    return res.success;
  }

  static async saveTenantsAsync(tenants: Tenant[]): Promise<{
    success: boolean;
    results: { tenantId: string; success: boolean; error?: string }[];
    error?: string;
  }> {
    DB.tenantsMemoryStore = tenants;

    if (!supabase) {
      return {
        success: true,
        results: tenants.map(t => ({ tenantId: t.id, success: true }))
      };
    }

    try {
      const { upsertTenantToSupabase } = await import('./supabase');

      const settledResults = await Promise.allSettled(
        tenants.map(async (t) => {
          const tenantOk = await upsertTenantToSupabase(t);
          if (!tenantOk) {
            throw new Error(`Failed to upsert tenant ${t.id} (${t.name || t.businessName}) to Supabase`);
          }
          try {
            await supabase.from('tenant_configs').upsert({
              tenant_id: t.id,
              system_prompt: t.systemPrompt || '',
              product_info: t.knowledgeBase || t.productKnowledgeBase || '',
              products: t.products || [],
              business_name: t.businessName || t.name || 'My Business'
            }, { onConflict: 'tenant_id' });
          } catch (e: any) {
            console.error(`[DB/Supabase] Sync tenant_configs error for ${t.id}:`, e);
          }
          return t.id;
        })
      );

      const perTenantResults = settledResults.map((res, idx) => {
        const tenantId = tenants[idx].id;
        if (res.status === 'fulfilled') {
          return { tenantId, success: true };
        } else {
          return { tenantId, success: false, error: res.reason?.message || 'Failed to save tenant' };
        }
      });

      const overallSuccess = perTenantResults.every(r => r.success);
      return {
        success: overallSuccess,
        results: perTenantResults
      };
    } catch (err: any) {
      console.error('[DB/Supabase] saveTenantsAsync error:', err);
      return {
        success: false,
        results: tenants.map(t => ({ tenantId: t.id, success: false, error: err.message })),
        error: err.message
      };
    }
  }

  static partnersMemoryStore: Partner[] = [
    { 
      id: 'p-1', 
      name: 'Hassaan (Super Admin)', 
      email: 'admin@hazelwhat.com', 
      role: 'admin', 
      accessLevel: 'read_write', 
      clientsAssigned: 0, 
      permissions: ['edit_setup', 'manage_billing'],
      password: 'admin123'
    },
    {
      id: 'p-2',
      name: 'ayan abubakar',
      email: 'abubaker687526@gmail.com',
      role: 'admin',
      accessLevel: 'read_write',
      clientsAssigned: 0,
      permissions: ['edit_setup', 'manage_billing'],
      password: 'AdminPass123'
    }
  ];

  static async getPartners(): Promise<Partner[]> {
    let supabasePartners: Partner[] = [];
    if (supabase) {
      try {
        const { data } = await supabase.from('partners').select('*');
        if (data && data.length > 0) {
          supabasePartners = data.map((p: any) => ({
            id: p.id,
            name: p.name,
            email: p.email,
            role: p.role || 'admin',
            accessLevel: p.access_level || 'read_write',
            clientsAssigned: p.clients_assigned || 0,
            permissions: p.permissions || [],
            password: p.password || 'AdminPass123'
          }));
        }
      } catch (e) {
        console.error('[DB/Supabase] Failed to fetch partners:', e);
      }
    }
    const map = new Map<string, Partner>();
    DB.partnersMemoryStore.forEach(p => map.set(p.id, p));
    supabasePartners.forEach(p => map.set(p.id, p));
    return Array.from(map.values());
  }

  static async savePartners(partners: Partner[]) {
    const map = new Map<string, Partner>();
    DB.partnersMemoryStore.forEach(p => map.set(p.id, p));
    partners.forEach(p => map.set(p.id, p));
    DB.partnersMemoryStore = Array.from(map.values());

    if (!supabase) return;
    try {
      const payloads = partners.map(p => ({
        id: p.id,
        name: p.name,
        email: p.email,
        role: p.role,
        access_level: p.accessLevel,
        clients_assigned: p.clientsAssigned || 0,
        permissions: p.permissions || [],
        password: p.password || 'AdminPass123'
      }));
      await supabase.from('partners').upsert(payloads);
    } catch (e) {
      console.error('[DB/Supabase] savePartners error:', e);
    }
  }

  // --- API HEALTH ALERTS ---
  static apiAlertsMemory: Array<{ id: string; service: string; type: string; message: string; timestamp: string }> = [];

  static async recordApiAlert(service: 'Deepgram' | 'Conversational LLM' | string, type: 'invalid_key' | 'quota_exceeded' | 'balance_low' | 'error' | string, message: string) {
    const alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      service,
      type,
      message,
      timestamp: new Date().toISOString()
    };
    DB.apiAlertsMemory = [alert, ...DB.apiAlertsMemory].slice(0, 20);
    if (supabase) {
      try {
        await supabase.from('api_health_alerts').insert({
          id: alert.id,
          service: alert.service,
          type: alert.type,
          message: alert.message,
          timestamp: alert.timestamp
        });
      } catch (e) {}
    }
    console.warn(`[API Health Alert Recorded] [${service}] (${type}): ${message}`);
  }

  static async getApiAlerts(): Promise<Array<{ id: string; service: string; type: string; message: string; timestamp: string }>> {
    if (supabase) {
      try {
        const { data } = await supabase.from('api_health_alerts').select('*').order('timestamp', { ascending: false }).limit(20);
        if (data && data.length > 0) {
          return data.map((d: any) => ({
            id: d.id || `alert-${d.timestamp}`,
            service: d.service,
            type: d.type || d.alert_type || 'error',
            message: d.message,
            timestamp: d.timestamp || d.created_at || new Date().toISOString()
          }));
        }
      } catch (e) {}
    }
    return DB.apiAlertsMemory;
  }

  static async hasSavedCredentials(tenantId: string = "default"): Promise<boolean> {
    if (!supabase) return false;
    try {
      const { data } = await supabase
        .from("whatsapp_auth")
        .select("key_id")
        .eq("tenant_id", tenantId)
        .eq("key_id", "creds")
        .limit(1);
      return !!data && data.length > 0;
    } catch (e) {
      return false;
    }
  }

  static async clearAllChatsAndCustomers(tenantId: string): Promise<void> {
    if (!tenantId) return;

    if (supabase) {
      try {
        await supabase.from('chat_messages').delete().eq('tenant_id', tenantId);
      } catch (e) {
        console.error('[DB] Failed to clear chat_messages from Supabase:', e);
      }
      try {
        await supabase.from('customers').delete().eq('tenant_id', tenantId);
      } catch (e) {
        console.error('[DB] Failed to clear customers from Supabase:', e);
      }
      try {
        await supabase.from('orders').delete().eq('tenant_id', tenantId);
      } catch (e) {
        console.error('[DB] Failed to clear orders from Supabase:', e);
      }
    }

    console.log(`[DB] Cleared all chats, customers, and orders for tenant: ${tenantId}`);
  }
}

