export interface Partner {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'partner' | 'manager' | 'viewer';
  accessLevel: 'read_write' | 'view_only';
  clientsAssigned: number;
  permissions?: ('edit_setup' | 'view_only' | 'manage_billing')[];
}

export interface ClientTroubleshootStatus {
  webhookConnected: boolean;
  deepgramApiValid: boolean;
  llmApiValid: boolean;
  whatsappSessionActive: boolean;
  serviceBlocked: boolean;
}

export interface Tenant {
  id: string;
  clientNumber: string; // e.g. #1001
  name: string; // Client Person Name
  businessName: string; // Business Name
  phoneNumber: string; // Client Phone Number
  email: string;
  status: 'active' | 'suspended' | 'blocked';
  installationFee: number;
  monthlySubscriptionFee: number;
  currency: 'PKR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'SAR';
  paymentStatus: 'paid' | 'pending' | 'overdue';
  allocatedMinutes: number;
  usedMinutes: number;

  // Login Credentials for Client Portal Access
  clientUsername: string;
  clientPassword: string;

  // Configuration & Setup
  systemPrompt: string;
  knowledgeBase: string; // Business Knowledge Base & FAQs
  productKnowledgeBase: string; // Specific Products / Inventory Knowledge Base
  followupMechanism: string; // Automated follow-up rules & schedule
  llmModel: 'gpt-4o-mini' | 'gpt-4o' | 'claude-3-5-sonnet' | 'gemini-1.5-flash';
  temperature: number;
  deepgramVoice: string;
  
  // API Keys (Kept Secure in Admin Dashboard)
  deepgramApiKey: string;
  openaiApiKey: string;
  omnivoiceApiKey: string;
  omnivoiceNumber: string;

  createdAt: string;

  // Metadata & Diagnostics
  troubleshoot: ClientTroubleshootStatus;
  promotionsSent: number;
  revivalLeadsActive: number;
  conversationalLeadsCount: number;
}

export interface CallLog {
  id: string;
  tenantId: string;
  callerNumber: string;
  callerName: string;
  direction: 'inbound' | 'outbound';
  durationSeconds: number;
  transcriptIn: string;
  transcriptOut: string;
  audioUrlOut?: string;
  costEstimate: number;
  createdAt: string;
  status: 'completed' | 'failed' | 'in-progress';
}

export const DEEPGRAM_VOICES = [
  { id: 'aura-asteria-en', name: 'Asteria (US Female - Natural)', gender: 'Female', language: 'English (US)' },
  { id: 'aura-luna-en', name: 'Luna (US Female - Warm)', gender: 'Female', language: 'English (US)' },
  { id: 'aura-stella-en', name: 'Stella (UK Female - Professional)', gender: 'Female', language: 'English (UK)' },
  { id: 'aura-zeus-en', name: 'Zeus (US Male - Deep & Energetic)', gender: 'Male', language: 'English (US)' },
  { id: 'aura-orion-en', name: 'Orion (US Male - Calm Professional)', gender: 'Male', language: 'English (US)' },
  { id: 'aura-arcas-en', name: 'Arcas (US Male - Conversational)', gender: 'Male', language: 'English (US)' },
];

export const initialPartners: Partner[] = [
  { 
    id: 'p-1', 
    name: 'Hassaan (Super Admin)', 
    email: 'admin@hazelwhat.com', 
    role: 'admin', 
    accessLevel: 'read_write', 
    clientsAssigned: 0, 
    permissions: ['edit_setup', 'manage_billing'] 
  },
];

// Production Clean Slate: Zero default dummy data for clients and logs
export const initialTenants: Tenant[] = [];

export const initialLogs: CallLog[] = [];
