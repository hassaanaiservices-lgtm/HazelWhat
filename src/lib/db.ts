import fs from 'fs';
import path from 'path';

export const DB_DIR = (function() {
  let dir = process.env.DATABASE_DIR || path.join(process.cwd(), '.data');
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // Test write permissions
    const testFile = path.join(dir, '.write_test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    return dir;
  } catch (err) {
    console.error(`[DB] Directory ${dir} is not writable. Falling back to local .data. Error:`, err);
    const localDir = path.join(process.cwd(), '.data');
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    return localDir;
  }
})();

const DB_PATH = path.join(DB_DIR, 'db.json');

export interface ChatMessage {
  id?: string;
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
  message: string;
}

export interface Config {
  systemPrompt: string;
  productInfo: string;
  keywordReplies?: { keyword: string; reply: string }[];
  enabledFeatures?: string[];
  globalAiEnabled?: boolean;
  storeUrl?: string;
  storeCurrency?: string;
  businessName?: string;
  timezone?: string;
  workingHours?: string;
  followUps?: FollowUpConfig[];
  anthropicApiKey?: string;
  openRouterApiKey?: string;
  apiKey?: string;
}

export interface Appointment {
  id: string;
  phone: string;
  name: string;
  service: string;
  date: string;
  time: string;
  status: "booked" | "cancelled";
}

export interface Customer {
  phone: string;
  name: string;
  jid?: string;
  preferences?: string;
  aiEnabled?: boolean;
  followUpLevel?: number;
  leadStatus?: "hot" | "cold" | "none";
  tags?: string[];
  pipelineStage?: "new" | "qualified" | "warm" | "cold" | "completed";
}

export interface PromotionLog {
  id: string;
  timestamp: string;
  audience: string;
  message: string;
  successCount: number;
  failureCount: number;
}

export interface Order {
  id: string;
  phone: string;
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
}

export interface ScheduledFollowUp {
  id: string;
  phone: string;
  sendAt: string; // ISO Timestamp
  context: string;
  status: "pending" | "sent" | "cancelled" | "failed";
  createdAt: string;
}

export interface RevivalCampaign {
  id: string;
  message: string;
  audience: string;
  timeSlotStart: string;
  timeSlotEnd: string;
  delayMinSeconds: number;
  delayMaxSeconds: number;
  batchSize: number;
  batchBreakMinutes: number;
  dailyCap: number;
  status: "active" | "paused" | "completed" | "cancelled";
  targetPhones: string[];
  sentPhones: string[];
  failedPhones: string[];
  sentToday: number;
  lastSentDate: string;
  createdAt: string;
  mediaBase64?: string;
  mimetype?: string;
  fileName?: string;
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
    { enabled: false, delayMinutes: 60, message: "Hi! Just checking if you have any questions?" },
    { enabled: false, delayMinutes: 1440, message: "Are you still interested in our products?" },
    { enabled: false, delayMinutes: 2880, message: "Let us know if you need any help deciding." },
    { enabled: false, delayMinutes: 4320, message: "We haven't heard from you in a while!" },
    { enabled: false, delayMinutes: 7200, message: "This is our last follow up. Reply to talk again!" }
  ]
};

function initDb(): DbSchema {
  if (!fs.existsSync(path.dirname(DB_PATH))) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  }
  
  if (!fs.existsSync(DB_PATH)) {
    const defaultDb: DbSchema = { chats: {}, config: DEFAULT_CONFIG, appointments: [], customers: {}, promotions: [], orders: [], scheduledFollowUps: [], revivalCampaigns: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultDb, null, 2));
    return defaultDb;
  }

  try {
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    return {
      chats: parsed.chats || {},
      config: parsed.config || DEFAULT_CONFIG,
      appointments: parsed.appointments || [],
      customers: parsed.customers || {},
      promotions: parsed.promotions || [],
      orders: parsed.orders || [],
      scheduledFollowUps: parsed.scheduledFollowUps || [],
      revivalCampaigns: parsed.revivalCampaigns || []
    };
  } catch (e) {
    console.error("DB Corrupted, resetting to default");
    return { chats: {}, config: DEFAULT_CONFIG, appointments: [], customers: {}, promotions: [], orders: [], scheduledFollowUps: [], revivalCampaigns: [] };
  }
}

function saveDb(data: DbSchema) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

export class DB {
  static getChats(phoneNumber: string): ChatMessage[] {
    const db = initDb();
    return db.chats[phoneNumber] || [];
  }

  static getAllChats(): Record<string, ChatMessage[]> {
    return initDb().chats;
  }

  static addChatMessage(phoneNumber: string, message: Omit<ChatMessage, "timestamp"> & { timestamp?: string }) {
    const db = initDb();
    if (!db.chats[phoneNumber]) {
      db.chats[phoneNumber] = [];
    }
    db.chats[phoneNumber].push({ 
      ...message, 
      timestamp: message.timestamp || new Date().toISOString() 
    });
    saveDb(db);
  }

  static getConfig(): Config {
    return initDb().config;
  }

  static updateConfig(newConfig: Partial<Config>) {
    const db = initDb();
    db.config = { ...db.config, ...newConfig };
    saveDb(db);
  }

  static updateMessageStatus(messageId: string, status: number) {
    const db = initDb();
    let updated = false;
    for (const phone in db.chats) {
      for (const msg of db.chats[phone]) {
        if (msg.id === messageId) {
          if ((msg.status || 0) < status) {
            msg.status = status;
            updated = true;
          }
        }
      }
    }
    if (updated) saveDb(db);
  }

  static getUnreadMessageIds(phone: string): string[] {
    const db = initDb();
    const chats = db.chats[phone] || [];
    return chats.filter(m => m.role === "user" && (m.status || 0) < 4).map(m => m.id as string).filter(Boolean);
  }

  static markMessagesAsReadInDb(phone: string, messageIds: string[]) {
    const db = initDb();
    let updated = false;
    const chats = db.chats[phone] || [];
    for (const msg of chats) {
      if (messageIds.includes(msg.id as string) && (msg.status || 0) < 4) {
        msg.status = 4;
        updated = true;
      }
    }
    if (updated) saveDb(db);
  }

  // Appointment & Customer Methods
  static getCustomer(phone: string): Customer | undefined {
    return initDb().customers[phone];
  }

  static updateCustomer(phone: string, data: Partial<Customer>) {
    const db = initDb();
    db.customers[phone] = { ...db.customers[phone], ...data, phone };
    saveDb(db);
  }

  static getAppointmentsByDate(date: string): Appointment[] {
    return initDb().appointments.filter(a => a.date === date && a.status === 'booked');
  }

  static getAppointmentsByPhone(phone: string): Appointment[] {
    return initDb().appointments.filter(a => a.phone === phone);
  }

  static bookAppointment(phone: string, name: string, service: string, date: string, time: string): boolean {
    const db = initDb();
    const existing = db.appointments.find(a => a.date === date && a.time === time && a.status === 'booked');
    if (existing) return false; // Time slot taken
    
    db.appointments.push({
      id: Math.random().toString(36).substring(7),
      phone,
      name,
      service,
      date,
      time,
      status: "booked"
    });
    
    if (!db.customers[phone]) {
      db.customers[phone] = { phone, name };
    }
    saveDb(db);
    return true;
  }

  static cancelAppointment(phone: string, date: string, time: string): boolean {
    const db = initDb();
    const appt = db.appointments.find(a => a.phone === phone && a.date === date && a.time === time && a.status === 'booked');
    if (appt) {
      appt.status = "cancelled";
      saveDb(db);
      return true;
    }
    return false;
  }

  static getPromotionLogs(): PromotionLog[] {
    return initDb().promotions;
  }

  static addPromotionLog(log: PromotionLog) {
    const db = initDb();
    db.promotions.push(log);
    saveDb(db);
  }

  static getAllAppointments(): Appointment[] {
    return initDb().appointments;
  }

  static getAllCustomers(): Customer[] {
    return Object.values(initDb().customers);
  }

  // Orders Methods
  static getOrders(): Order[] {
    return initDb().orders || [];
  }

  static addOrder(phone: string, data: { productName: string; productImageUrl?: string; size?: string; color?: string; deliveryAddress?: string; contactNumber?: string; paymentMethod?: string; price?: string }): Order {
    const db = initDb();
    if (!db.orders) db.orders = [];

    // Check if there is an existing pending order for this phone and product
    const existingOrder = db.orders.find(o => o.phone === phone && o.productName === data.productName && o.status === "pending");
    if (existingOrder) {
      if (data.size) existingOrder.size = data.size;
      if (data.color) existingOrder.color = data.color;
      if (data.deliveryAddress) existingOrder.deliveryAddress = data.deliveryAddress;
      if (data.contactNumber) existingOrder.contactNumber = data.contactNumber;
      if (data.paymentMethod) existingOrder.paymentMethod = data.paymentMethod;
      if (data.price) existingOrder.price = data.price;
      if (data.productImageUrl) existingOrder.productImageUrl = data.productImageUrl;
      
      existingOrder.timestamp = new Date().toISOString(); // Update timestamp so it jumps to top
      existingOrder.recoveryStage = 0; // Reset recovery stage since customer interacted
      saveDb(db);
      return existingOrder;
    }

    const newOrder: Order = {
      id: "ORD-" + Math.random().toString(36).substring(2, 8).toUpperCase(),
      phone,
      productName: data.productName,
      productImageUrl: data.productImageUrl,
      size: data.size,
      color: data.color,
      deliveryAddress: data.deliveryAddress,
      contactNumber: data.contactNumber,
      paymentMethod: data.paymentMethod,
      price: data.price,
      timestamp: new Date().toISOString(),
      status: "pending",
      recoveryStage: 0
    };
    db.orders.push(newOrder);
    
    if (!db.customers[phone]) {
      db.customers[phone] = { phone, name: phone };
    }
    saveDb(db);
    return newOrder;
  }

  static updateOrder(orderId: string, updates: Partial<Order>) {
    const db = initDb();
    const idx = db.orders.findIndex(o => o.id === orderId);
    if (idx !== -1) {
      db.orders[idx] = { ...db.orders[idx], ...updates };
      saveDb(db);
    }
  }

  // --- Scheduled Follow-up Methods ---
  static addScheduledFollowUp(followUp: ScheduledFollowUp) {
    const db = initDb();
    db.scheduledFollowUps.push(followUp);
    saveDb(db);
  }

  static getPendingFollowUps(): ScheduledFollowUp[] {
    const db = initDb();
    return db.scheduledFollowUps.filter(f => f.status === "pending");
  }

  static getAllScheduledFollowUps(): ScheduledFollowUp[] {
    const db = initDb();
    return db.scheduledFollowUps || [];
  }

  static updateFollowUpStatus(id: string, status: "pending" | "sent" | "cancelled" | "failed") {
    const db = initDb();
    const idx = db.scheduledFollowUps.findIndex(f => f.id === id);
    if (idx !== -1) {
      db.scheduledFollowUps[idx].status = status;
      saveDb(db);
    }
  }

  static cancelPendingFollowUps(phone: string) {
    const db = initDb();
    let updated = false;
    db.scheduledFollowUps.forEach(f => {
      if (f.phone === phone && f.status === "pending") {
        f.status = "cancelled";
        updated = true;
      }
    });
    if (updated) {
      saveDb(db);
    }
  }

  static updateOrderStatus(id: string, status: Order["status"]): boolean {
    const db = initDb();
    if (!db.orders) return false;
    const order = db.orders.find(o => o.id === id);
    if (order) {
      order.status = status;
      saveDb(db);
      return true;
    }
    return false;
  }

  // --- Revival Campaign Methods ---
  static getRevivalCampaigns(): RevivalCampaign[] {
    return initDb().revivalCampaigns || [];
  }

  static getActiveCampaign(): RevivalCampaign | null {
    const db = initDb();
    return (db.revivalCampaigns || []).find(c => c.status === "active") || null;
  }

  static addRevivalCampaign(campaign: RevivalCampaign) {
    const db = initDb();
    if (!db.revivalCampaigns) db.revivalCampaigns = [];
    db.revivalCampaigns.push(campaign);
    saveDb(db);
  }

  static updateRevivalCampaign(id: string, updates: Partial<RevivalCampaign>) {
    const db = initDb();
    const idx = (db.revivalCampaigns || []).findIndex(c => c.id === id);
    if (idx !== -1) {
      db.revivalCampaigns[idx] = { ...db.revivalCampaigns[idx], ...updates };
      saveDb(db);
    }
  }
}
