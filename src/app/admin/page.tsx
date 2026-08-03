'use client';

import { useState, useEffect } from 'react';
import { 
  Users, 
  PhoneCall, 
  Mic, 
  Settings, 
  ShieldAlert, 
  Activity, 
  PlusCircle, 
  Play, 
  Search, 
  TrendingUp, 
  Clock, 
  Zap,
  Volume2,
  CheckCircle,
  Copy,
  DollarSign,
  Lock,
  Unlock,
  BookOpen,
  UserPlus,
  BarChart3,
  FileText,
  AlertTriangle,
  Radio,
  Sliders,
  Sparkles,
  Key,
  Wrench,
  Phone,
  Building,
  PackageCheck,
  Repeat,
  Save,
  UserCheck,
  Check,
  Globe,
  Download,
  Loader2,
  AlertCircle,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Eye,
  EyeOff,
  Package,
  Edit3,
  Upload,
  ExternalLink,
  Image as ImageIcon,
  Tag,
  Trash2,
  X,
  Plus,
  Bell,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingBag,
  User,
  UserCheck2,
  ArrowLeft,
  QrCode,
  Smartphone,
  Calendar
} from 'lucide-react';
import { 
  initialTenants, 
  initialLogs, 
  initialPartners, 
  DEEPGRAM_VOICES, 
  Tenant, 
  CallLog, 
  Partner 
} from '@/lib/multitenant-store';

const CURRENCY_SYMBOLS: Record<string, string> = {
  PKR: 'Rs ',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'AED ',
  SAR: 'SAR ',
};

const defaultFallbackTenant: Tenant = {
  id: 't-none',
  clientNumber: '1000',
  name: 'No Client Selected',
  businessName: 'No Business',
  phoneNumber: '+92 300 0000000',
  email: 'info@client.com',
  status: 'active',
  installationFee: 0,
  monthlySubscriptionFee: 0,
  currency: 'PKR',
  paymentStatus: 'paid',
  allocatedMinutes: 0,
  usedMinutes: 0,
  clientUsername: 'client_user',
  clientPassword: 'Password123',
  systemPrompt: 'You are an AI customer service assistant. Be polite and helpful.',
  knowledgeBase: 'Business knowledge base details and FAQs.',
  productKnowledgeBase: 'Product and services catalog.',
  followupMechanism: 'Send follow-up WhatsApp voice note.',
  llmModel: 'gpt-4o-mini',
  temperature: 0.7,
  deepgramVoice: 'aura-asteria-en',
  deepgramApiKey: '',
  openaiApiKey: '',
  omnivoiceApiKey: '',
  omnivoiceNumber: '',
  createdAt: new Date().toISOString(),
  troubleshoot: {
    webhookConnected: false,
    deepgramApiValid: false,
    llmApiValid: false,
    whatsappSessionActive: false,
    serviceBlocked: false,
  },
  promotionsSent: 0,
  revivalLeadsActive: 0,
  conversationalLeadsCount: 0,
};

export default function VoiceSaaSApp() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clients' | 'admins'>('dashboard');
  const [clientSubTab, setClientSubTab] = useState<'setup' | 'directory'>('directory');
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants);
  const [partners, setPartners] = useState<Partner[]>(initialPartners);
  const [callLogs, setCallLogs] = useState<CallLog[]>(initialLogs);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('t-101');
  const [searchTerm, setSearchTerm] = useState('');

  // Interactive Period Timeframe Filter
  const [timeframe, setTimeframe] = useState<'weekly' | 'monthly' | 'yearly'>('yearly');

  // WhatsApp Connect & Pairing Code Modal State
  const [showWhatsAppConnectModal, setShowWhatsAppConnectModal] = useState(false);
  const [waConnectMode, setWaConnectMode] = useState<'qr' | 'pairing'>('qr');
  const [waPairingPhone, setWaPairingPhone] = useState('');
  const [waPairingCode, setWaPairingCode] = useState<string | null>(null);
  const [isGeneratingPairingCode, setIsGeneratingPairingCode] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);

  // Show/Hide API keys toggle
  const [showApiKeys, setShowApiKeys] = useState(false);

  // Dirty State (Edit Tracker)
  const [isDirty, setIsDirty] = useState(false);

  // Auto Web Scraper State
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeSuccessMsg, setScrapeSuccessMsg] = useState<string | null>(null);

  // Save Animation State
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // New Client Modal State
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    name: '',
    phoneNumber: '',
    businessName: '',
    email: '',
    websiteUrl: '',
    installationFee: 50000,
    monthlySubscriptionFee: 15000,
    currency: 'PKR' as 'PKR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'SAR',
  });

  // Team Admin Modal State
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [newAdminForm, setNewAdminForm] = useState({
    name: '',
    email: '',
    role: 'admin' as 'admin' | 'manager' | 'viewer',
    accessLevel: 'read_write' as 'read_write' | 'view_only',
  });

  // Save Success Pop-up Modal State
  const [showSaveSuccessModal, setShowSaveSuccessModal] = useState(false);

  const selectedTenant = tenants.find(t => t.id === selectedTenantId) || tenants[0] || defaultFallbackTenant;

  // Reset dirty flag whenever tenant selection changes
  useEffect(() => {
    setIsDirty(false);
  }, [selectedTenantId]);

  // Financial Metrics dynamically calculated in PKR & USD
  const rawPKR_MRR = tenants
    .filter(t => t.status === 'active' && (t.currency === 'PKR' || !t.currency))
    .reduce((acc, t) => acc + t.monthlySubscriptionFee, 0);

  const rawPKR_Installation = tenants
    .filter(t => t.currency === 'PKR' || !t.currency)
    .reduce((acc, t) => acc + t.installationFee, 0);

  // Multipliers based on interactive period timeframe selection
  const timeframeMultiplier = timeframe === 'weekly' ? 0.25 : timeframe === 'monthly' ? 1 : 12;
  const totalPKR_MRR = Math.round(rawPKR_MRR * timeframeMultiplier);
  const totalPKR_Installation = Math.round(rawPKR_Installation);

  const totalAllocatedMins = tenants.reduce((acc, t) => acc + t.allocatedMinutes, 0);
  const totalUsedMins = tenants.reduce((acc, t) => acc + t.usedMinutes, 0);
  const totalRawApiCost = (totalUsedMins * 0.011).toFixed(2);

  // Strict Validation: Check if all setup fields, API keys, and fees are completely filled
  const isSetupFormComplete = Boolean(
    selectedTenant.systemPrompt?.trim() &&
    selectedTenant.knowledgeBase?.trim() &&
    selectedTenant.productKnowledgeBase?.trim() &&
    selectedTenant.followupMechanism?.trim() &&
    selectedTenant.deepgramApiKey?.trim() &&
    selectedTenant.openaiApiKey?.trim() &&
    selectedTenant.omnivoiceApiKey?.trim() &&
    selectedTenant.clientUsername?.trim() &&
    selectedTenant.clientPassword?.trim() &&
    selectedTenant.installationFee >= 0 &&
    selectedTenant.monthlySubscriptionFee >= 0
  );

  // Enable Save button ONLY if there are unsaved edits (isDirty) AND form is fully valid
  const canSave = isDirty && isSetupFormComplete;

  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    const nextClientNum = (1000 + tenants.length + 1).toString();
    const cleanBusinessSlug = (newClientForm.businessName || 'client').toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    const created: Tenant = {
      id: `t-${nextClientNum}`,
      clientNumber: nextClientNum,
      name: newClientForm.name || 'New Client',
      businessName: newClientForm.businessName || 'Business Name LLC',
      phoneNumber: newClientForm.phoneNumber || '+92 300 0000000',
      email: newClientForm.email || 'client@business.com',
      status: 'active',
      installationFee: Number(newClientForm.installationFee),
      monthlySubscriptionFee: Number(newClientForm.monthlySubscriptionFee),
      currency: newClientForm.currency || 'PKR',
      paymentStatus: 'paid',
      allocatedMinutes: 800,
      usedMinutes: 0,

      // Generated Login Credentials for Client Portal
      clientUsername: `${cleanBusinessSlug}_${Math.floor(100 + Math.random() * 900)}`,
      clientPassword: `HazelPass@${Math.floor(1000 + Math.random() * 9000)}`,

      // Default Setup
      systemPrompt: `You are an AI customer service assistant for ${newClientForm.businessName || 'our business'}. Be polite and helpful.`,
      knowledgeBase: `${newClientForm.businessName} - Official business details, FAQs, operating hours, and customer policies.`,
      productKnowledgeBase: `1. ${newClientForm.businessName} Standard Package - ${CURRENCY_SYMBOLS[newClientForm.currency]}${newClientForm.monthlySubscriptionFee}/mo\n2. ${newClientForm.businessName} Enterprise Suite - ${CURRENCY_SYMBOLS[newClientForm.currency]}${newClientForm.installationFee} setup`,
      followupMechanism: 'Send follow-up WhatsApp voice message 2 hours after call if tour/meeting is not scheduled.',
      llmModel: 'gpt-4o-mini',
      temperature: 0.7,
      deepgramVoice: 'aura-asteria-en',

      // API Keys
      deepgramApiKey: `dg_live_${Math.random().toString(36).substring(2, 14)}`,
      openaiApiKey: `sk-proj-${Math.random().toString(36).substring(2, 16)}`,
      omnivoiceApiKey: `ov_live_${Math.random().toString(36).substring(2, 12)}`,
      omnivoiceNumber: `+1 (555) ${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`,

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

    setTenants([created, ...tenants]);
    setShowAddTenant(false);
    setSelectedTenantId(created.id);
    setActiveTab('clients');
    setClientSubTab('setup');
    setIsDirty(true);
    setNewClientForm({
      name: '',
      phoneNumber: '',
      businessName: '',
      email: '',
      websiteUrl: '',
      installationFee: 50000,
      monthlySubscriptionFee: 15000,
      currency: 'PKR',
    });
  };

  const handleAddTeamAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    const createdAdmin: Partner = {
      id: `p-${partners.length + 1}`,
      name: newAdminForm.name,
      email: newAdminForm.email,
      role: newAdminForm.role,
      accessLevel: newAdminForm.accessLevel,
      clientsAssigned: 0,
      permissions: newAdminForm.accessLevel === 'read_write' ? ['edit_setup', 'manage_billing'] : ['view_only'],
    };
    setPartners([...partners, createdAdmin]);
    setShowAddAdminModal(false);
    setNewAdminForm({ name: '', email: '', role: 'admin', accessLevel: 'read_write' });
  };

  const handleGeneratePairingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waPairingPhone.trim()) return;
    setIsGeneratingPairingCode(true);
    setPairingError(null);
    setWaPairingCode(null);
    try {
      const res = await fetch('/api/whatsapp/pairing-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: waPairingPhone }),
      });
      const data = await res.json();
      if (data.success && data.pairingCode) {
        setWaPairingCode(data.pairingCode);
      } else {
        setPairingError(data.error || "Could not generate pairing code");
      }
    } catch (err: any) {
      setPairingError(err.message || "Failed to generate pairing code");
    } finally {
      setIsGeneratingPairingCode(false);
    }
  };

  const toggleTenantStatus = (tenantId: string) => {
    setTenants(tenants.map(t => {
      if (t.id === tenantId) {
        const nextStatus = t.status === 'active' ? 'suspended' : 'active';
        return { 
          ...t, 
          status: nextStatus,
          troubleshoot: { ...t.troubleshoot, serviceBlocked: nextStatus === 'suspended' } 
        };
      }
      return t;
    }));
  };

  const handleUpdateTenantConfig = (updated: Partial<Tenant>) => {
    setTenants(tenants.map(t => t.id === selectedTenant.id ? { ...t, ...updated } : t));
    setIsDirty(true);
  };

  const handleSaveClientSetup = () => {
    if (!canSave) return;
    
    setIsSavingConfig(true);
    setTimeout(() => {
      setIsSavingConfig(false);
      setIsDirty(false);
      setShowSaveSuccessModal(true);
    }, 800);
  };

  // Product Catalog State in Admin Panel
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [prodTitle, setProdTitle] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodImage, setProdImage] = useState("");
  const [prodLink, setProdLink] = useState("");
  const [prodCategory, setProdCategory] = useState("");
  const [prodDesc, setProdDesc] = useState("");
  const [prodVariations, setProdVariations] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showRawCatalogText, setShowRawCatalogText] = useState(false);
  const prodFileInputRef = useState<HTMLInputElement | null>(null);

  const resetAdminProductForm = () => {
    setProdTitle("");
    setProdPrice("");
    setProdImage("");
    setProdLink("");
    setProdCategory("");
    setProdDesc("");
    setProdVariations("");
    setEditingProduct(null);
  };

  const openAdminAddProductModal = () => {
    resetAdminProductForm();
    setShowProductModal(true);
  };

  const openAdminEditProductModal = (prod: any) => {
    setEditingProduct(prod);
    setProdTitle(prod.title || "");
    setProdPrice(prod.price || "");
    setProdImage(prod.image || "");
    setProdLink(prod.link || "");
    setProdCategory(prod.category || "");
    setProdDesc(prod.description || "");
    setProdVariations(
      prod.variations && Array.isArray(prod.variations)
        ? prod.variations.map((v: any) => `${v.title}: ${v.price}`).join(", ")
        : ""
    );
    setShowProductModal(true);
  };

  const formatTenantProductsText = (products: any[], currency: string = "$") => {
    if (!products || products.length === 0) return "";
    let text = "--- E-COMMERCE CATALOG ---\n\n";
    const grouped: Record<string, any[]> = {};
    products.forEach((p) => {
      const cat = p.category || "General Products";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    });

    for (const [cat, items] of Object.entries(grouped)) {
      text += `\n### CATEGORY: ${cat.toUpperCase()} ###\n`;
      items.forEach((p) => {
        let variationsText = "";
        if (p.variations && p.variations.length > 0) {
          variationsText = "\n  Variations:";
          p.variations.forEach((v: any) => {
            variationsText += `\n    - ${v.title}: ${v.price}`;
          });
        }
        text += `- ${p.title} (Base Price/Range: ${p.price})\n  Image: ${p.image || "N/A"}\n  Link: ${p.link || "N/A"}${p.description ? `\n  Description: ${p.description}` : ""}${variationsText}\n\n`;
      });
    }
    return text;
  };

  const handleSaveAdminProductModal = () => {
    if (!prodTitle.trim()) {
      alert("Product Title is required");
      return;
    }
    const currentList = selectedTenant.products || [];
    let updated: any[];

    const parsedVariations = prodVariations.trim()
      ? prodVariations.split(",").map((v) => {
          const parts = v.split(":");
          return { title: parts[0]?.trim() || "Option", price: parts[1]?.trim() || prodPrice };
        })
      : undefined;

    const newProdItem = {
      id: editingProduct ? editingProduct.id : `custom-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      title: prodTitle.trim(),
      price: prodPrice.trim() || `${selectedTenant.currency || 'PKR'} 0`,
      image: prodImage.trim(),
      link: prodLink.trim(),
      category: prodCategory.trim() || "General Products",
      description: prodDesc.trim(),
      variations: parsedVariations
    };

    if (editingProduct) {
      updated = currentList.map((p: any) => (p.id === editingProduct.id ? newProdItem : p));
    } else {
      updated = [...currentList, newProdItem];
    }

    const newCatalogText = formatTenantProductsText(updated, selectedTenant.currency || "PKR");
    handleUpdateTenantConfig({
      products: updated,
      productKnowledgeBase: newCatalogText || selectedTenant.productKnowledgeBase
    });

    setShowProductModal(false);
    resetAdminProductForm();
  };

  const handleDeleteAdminProduct = (productId: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    const updated = (selectedTenant.products || []).filter((p: any) => p.id !== productId);
    const newCatalogText = formatTenantProductsText(updated, selectedTenant.currency || "PKR");
    handleUpdateTenantConfig({
      products: updated,
      productKnowledgeBase: newCatalogText || selectedTenant.productKnowledgeBase
    });
  };

  const handleAutoScrapeWebsite = async () => {
    if (!websiteUrl.trim()) return;
    setIsScraping(true);
    setScrapeSuccessMsg(null);

    try {
      const res = await fetch("/api/whatsapp/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: websiteUrl.trim(), currency: selectedTenant.currency || "PKR" })
      });
      const data = await res.json();
      if (data.success) {
        const scrapedItems: any[] = data.items || [];
        const existingItems: any[] = selectedTenant.products || [];

        const mergedItems = [...existingItems];
        scrapedItems.forEach((item) => {
          const idx = mergedItems.findIndex((e) => e.title.toLowerCase().trim() === item.title.toLowerCase().trim());
          if (idx === -1) {
            mergedItems.push(item);
          } else {
            if (!mergedItems[idx].image && item.image) mergedItems[idx].image = item.image;
            if (!mergedItems[idx].link && item.link) mergedItems[idx].link = item.link;
            mergedItems[idx].price = item.price;
          }
        });

        const formattedCatalog = formatTenantProductsText(mergedItems, selectedTenant.currency || "PKR");

        const cleanUrl = websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
        const scrapedPrompt = selectedTenant.systemPrompt || `You are the lead AI Sales & Support Agent for ${cleanUrl}. Your goal is to represent the business, book meetings, answer pricing/services queries, and deliver clear responses based on official company policy. Always maintain a professional and welcoming tone.`;
        const scrapedKB = selectedTenant.knowledgeBase || `=== AUTO-SCRAPED WEBSITE CONTENT FROM ${cleanUrl} ===\n\nCompany Overview:\n${cleanUrl} is a premier provider of automated solutions and client management services.`;

        handleUpdateTenantConfig({
          systemPrompt: scrapedPrompt,
          knowledgeBase: scrapedKB,
          products: mergedItems,
          productKnowledgeBase: formattedCatalog || data.catalog || selectedTenant.productKnowledgeBase,
        });

        setScrapeSuccessMsg(`Successfully scraped & auto-populated ${mergedItems.length} products with pictures & links from ${websiteUrl}!`);
      } else {
        alert(data.error || "Failed to scrape website");
      }
    } catch (e: any) {
      console.error(e);
      alert("Error occurred while scraping.");
    } finally {
      setIsScraping(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-slate-900 font-sans flex">
      
      {/* ================= LEFT SIDEBAR ================= */}
      <aside className="w-64 bg-white border-r border-slate-200 shrink-0 flex flex-col justify-between p-6">
        <div className="space-y-8">
          
          {/* Logo Section */}
          <div className="flex items-center space-x-3 px-2">
            <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center shadow-md shadow-purple-600/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">HazelWhat</span>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-2">
            {/* TAB 1: DASHBOARD */}
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
              <span>Dashboard</span>
            </button>

            {/* TAB 2: CLIENTS */}
            <button
              onClick={() => {
                setActiveTab('clients');
                setClientSubTab('directory');
              }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'clients'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Users className="w-5 h-5" />
              <span>Clients</span>
            </button>

            {/* TAB 3: TEAM ADMINS */}
            <button
              onClick={() => setActiveTab('admins')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'admins'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
              <span>Team Admins</span>
            </button>
          </nav>
        </div>

        {/* Bottom Sidebar Controls */}
        <div className="space-y-1.5 pt-6 border-t border-slate-100">
          <button className="w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all cursor-pointer">
            <Settings className="w-5 h-5" />
            <span>Setting</span>
          </button>
          <button className="w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all cursor-pointer">
            <LogOut className="w-5 h-5" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* ================= RIGHT MAIN AREA ================= */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* Top Header Bar */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-40">
          <div className="relative w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
            />
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowAddAdminModal(true)}
              className="px-4 py-2 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 text-xs font-bold rounded-xl flex items-center space-x-2 transition cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-purple-600" />
              <span>Add Team Admin</span>
            </button>

            <button className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition cursor-pointer">
              <Globe className="w-4 h-4" />
            </button>
            <button className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition relative cursor-pointer">
              <Bell className="w-4 h-4" />
              <span className="w-2 h-2 rounded-full bg-purple-600 absolute top-2.5 right-2.5 ring-2 ring-white" />
            </button>
            <div className="flex items-center space-x-3 pl-2 border-l border-slate-200">
              <img
                src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80"
                alt="Olivia Avatar"
                className="w-10 h-10 rounded-full object-cover border border-slate-200"
              />
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="p-8 space-y-8 max-w-7xl mx-auto w-full">
          
          {/* Greeting Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Hey Admin</h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">here's what's happening with your store today</p>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Interactive Period Timeframe Selector (Weekly, Monthly, Yearly) */}
              <div className="bg-white p-1 rounded-xl border border-slate-200 flex items-center space-x-1 shadow-sm">
                <button
                  onClick={() => setTimeframe('weekly')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                    timeframe === 'weekly' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => setTimeframe('monthly')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                    timeframe === 'monthly' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setTimeframe('yearly')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                    timeframe === 'yearly' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Yearly
                </button>
              </div>

              <button
                onClick={() => setShowAddTenant(true)}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 shadow-md shadow-purple-600/20 transition-all cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Onboard New Client</span>
              </button>
            </div>
          </div>

          {/* ================= TAB 1: EXECUTIVE DASHBOARD ================= */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              
              {/* 4 Metric Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Card 1: Recurring Revenue */}
                <div className="bg-purple-600 text-white rounded-3xl p-6 shadow-xl shadow-purple-600/20 flex flex-col justify-between relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <ShoppingBag className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-white/20 rounded-full">
                      {timeframe}
                    </span>
                  </div>
                  <div className="mt-6">
                    <p className="text-xs font-medium text-purple-100">
                      {timeframe === 'weekly' ? 'Weekly Recurring' : timeframe === 'monthly' ? 'Monthly Recurring (MRR)' : 'Yearly Recurring'}
                    </p>
                    <div className="flex items-baseline justify-between mt-2">
                      <h2 className="text-2xl font-bold tracking-tight">
                        Rs {totalPKR_MRR.toLocaleString()}
                      </h2>
                      <span className="px-2.5 py-1 bg-emerald-400/20 backdrop-blur-sm text-emerald-300 rounded-full text-xs font-semibold flex items-center space-x-1">
                        <ArrowUpRight className="w-3 h-3" />
                        <span>0%</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 2: Total Installation Fees */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                      Total
                    </span>
                  </div>
                  <div className="mt-6">
                    <p className="text-xs font-semibold text-slate-400">Total Setup Fees</p>
                    <div className="flex items-baseline justify-between mt-2">
                      <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                        Rs {totalPKR_Installation.toLocaleString()}
                      </h2>
                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-semibold flex items-center space-x-1">
                        <ArrowUpRight className="w-3 h-3" />
                        <span>0%</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 3: Total Clients */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                      <Users className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-6">
                    <p className="text-xs font-semibold text-slate-400">Active Clients</p>
                    <div className="flex items-baseline justify-between mt-2">
                      <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{tenants.length} Clients</h2>
                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-semibold flex items-center space-x-1">
                        <ArrowUpRight className="w-3 h-3" />
                        <span>100%</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 4: Voice Minutes Pool */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                      <Volume2 className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-6">
                    <p className="text-xs font-semibold text-slate-400">Voice Minutes Used</p>
                    <div className="flex items-baseline justify-between mt-2">
                      <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{totalUsedMins.toFixed(0)} / {totalAllocatedMins} m</h2>
                      <span className="px-2.5 py-1 bg-purple-50 text-purple-600 rounded-full text-xs font-semibold">
                        ${totalRawApiCost} cost
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Team Admins Overview Bar */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                    <ShieldCheck className="w-5 h-5 text-purple-600" />
                    <span>Team Admins & Access Roles</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab('admins')}
                    className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center space-x-1 cursor-pointer"
                  >
                    <span>Manage Admins →</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {partners.map(p => (
                    <div key={p.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                          {p.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{p.name}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{p.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          p.accessLevel === 'read_write' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {p.accessLevel === 'read_write' ? 'Full Read / Write' : 'View Only'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Middle Section: Sales Report Graph & Traffic Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Left 8 Cols: Sales Report Chart Card */}
                <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Analytics & Sales Report</h3>
                      <p className="text-xs text-slate-400 font-medium">Filtered by: <span className="font-bold capitalize text-purple-600">{timeframe} View</span></p>
                    </div>
                    <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 shadow-md shadow-purple-600/20 transition cursor-pointer">
                      <Download className="w-3.5 h-3.5" />
                      <span>Export to PDF</span>
                    </button>
                  </div>

                  {/* SVG Smooth Curved Area Graph */}
                  <div className="relative w-full h-64 my-2">
                    <div className="absolute left-[44%] top-[12%] -translate-x-1/2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-lg text-xs font-bold text-slate-900 z-10">
                      Rs {totalPKR_MRR.toLocaleString()}
                    </div>

                    <svg viewBox="0 0 800 200" className="w-full h-full overflow-visible">
                      <defs>
                        <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      <path
                        d="M 50 150 Q 120 145 180 120 T 310 40 T 400 130 T 520 80 T 650 145 T 780 150 L 780 180 L 50 180 Z"
                        fill="url(#purpleGradient)"
                      />

                      <path
                        d="M 50 150 Q 120 145 180 120 T 310 40 T 400 130 T 520 80 T 650 145 T 780 150"
                        fill="none"
                        stroke="#7c3aed"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                      />

                      <line
                        x1="352"
                        y1="40"
                        x2="352"
                        y2="180"
                        stroke="#94a3b8"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />

                      <circle
                        cx="352"
                        cy="40"
                        r="6"
                        fill="#7c3aed"
                        stroke="#ffffff"
                        strokeWidth="3"
                        className="shadow"
                      />
                    </svg>

                    <div className="flex justify-between text-[11px] font-medium text-slate-400 pt-2 px-2">
                      <span>Jan</span>
                      <span>Feb</span>
                      <span>Mar</span>
                      <span>Apr</span>
                      <span>May</span>
                      <span>Jun</span>
                      <span>Jul</span>
                      <span>Aug</span>
                      <span>Sep</span>
                      <span>Oct</span>
                      <span>Nov</span>
                      <span>Dec</span>
                    </div>
                  </div>
                </div>

                {/* Right 4 Cols: Traffic & Source Breakdown */}
                <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-6">Traffic Sources</h3>
                    
                    <div className="space-y-6">
                      <div>
                        <div className="flex justify-between text-xs font-semibold mb-2">
                          <span className="text-slate-500">Direct Inbound</span>
                          <span className="text-slate-900">0</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                          <div className="bg-purple-600 h-full rounded-full" style={{ width: '0%' }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-semibold mb-2">
                          <span className="text-slate-500">Referral Leads</span>
                          <span className="text-slate-900">0</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                          <div className="bg-purple-300 h-full rounded-full" style={{ width: '0%' }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-semibold mb-2">
                          <span className="text-slate-500">WhatsApp Broadcasts</span>
                          <span className="text-slate-900">0</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                          <div className="bg-purple-200 h-full rounded-full" style={{ width: '0%' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ================= TAB 2: CLIENTS SECTION ================= */}
          {activeTab === 'clients' && (
            <div className="space-y-8">
              
              {/* DIRECTORY VIEW (PRIMARY DEFAULT WHEN CLICKING CLIENTS) */}
              {clientSubTab === 'directory' && (
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Client Directory & Account Identifiers</h3>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Select any client below to manage setup, API keys, and business details.</p>
                    </div>
                    <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">Showing {tenants.length} clients</span>
                  </div>

                  {tenants.length === 0 ? (
                    <div className="p-12 text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
                        <Users className="w-8 h-8" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-900">No Clients Onboarded Yet</h4>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                          Get started by onboarding your first client to configure AI voice prompts, API keys, and subscription billing.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowAddTenant(true)}
                        className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20 transition cursor-pointer"
                      >
                        + Onboard First Client
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                          <tr>
                            <th className="p-4">Client #</th>
                            <th className="p-4">Client Contact</th>
                            <th className="p-4">Business Name</th>
                            <th className="p-4">Portal Login User</th>
                            <th className="p-4">Setup / Monthly Package</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {tenants
                            .filter(t => 
                              t.clientNumber.includes(searchTerm) ||
                              t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              t.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              t.phoneNumber.includes(searchTerm)
                            )
                            .map(t => (
                              <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="p-4 font-mono font-bold text-purple-600">#{t.clientNumber}</td>
                                <td className="p-4">
                                  <div className="font-bold text-slate-900 text-sm">{t.name}</div>
                                  <div className="text-slate-500 text-xs flex items-center space-x-1 mt-0.5 font-mono">
                                    <Phone className="w-3 h-3 text-purple-600" />
                                    <span>{t.phoneNumber}</span>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <div className="font-bold text-slate-800">{t.businessName}</div>
                                  <div className="text-slate-400 text-[11px]">{t.email}</div>
                                </td>
                                <td className="p-4 font-mono font-semibold text-slate-900">
                                  {t.clientUsername}
                                </td>
                                <td className="p-4 font-mono">
                                  <span className="font-bold text-slate-900">
                                    {CURRENCY_SYMBOLS[t.currency || 'PKR']}{t.installationFee.toLocaleString()}
                                  </span> / <span className="font-bold text-purple-600">
                                    {CURRENCY_SYMBOLS[t.currency || 'PKR']}{t.monthlySubscriptionFee.toLocaleString()}/mo
                                  </span>
                                </td>
                                <td className="p-4">
                                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    t.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                  }`}>
                                    {t.status}
                                  </span>
                                </td>
                                <td className="p-4">
                                  <div className="flex items-center space-x-2">
                                    <button
                                      onClick={() => {
                                        setSelectedTenantId(t.id);
                                        setClientSubTab('setup');
                                      }}
                                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold transition shadow-sm cursor-pointer"
                                    >
                                      Manage Setup
                                    </button>
                                    <button
                                      onClick={() => toggleTenantStatus(t.id)}
                                      title={t.status === 'active' ? 'Suspend Service' : 'Activate Service'}
                                      className={`p-2 rounded-xl border transition cursor-pointer ${
                                        t.status === 'active' 
                                          ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100' 
                                          : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                                      }`}
                                    >
                                      {t.status === 'active' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* CLIENT SETUP VIEW (ACCESSED VIA MANAGE SETUP BUTTON) */}
              {clientSubTab === 'setup' && (
                <div className="space-y-6">
                  
                  {/* Top Action & Navigation Bar */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setClientSubTab('directory')}
                      className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl flex items-center space-x-2 transition shadow-sm cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back to Client Directory</span>
                    </button>

                    {tenants.length > 0 && (
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-400 uppercase">Selected Client:</span>
                        <select
                          value={selectedTenantId}
                          onChange={e => setSelectedTenantId(e.target.value)}
                          className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                        >
                          {tenants.map(t => (
                            <option key={t.id} value={t.id}>
                              #{t.clientNumber} - {t.name} ({t.businessName})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Sleek Client Header Banner */}
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-11 h-11 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-base shadow-md shadow-purple-600/20">
                        #{selectedTenant.clientNumber}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h2 className="text-lg font-bold text-slate-900">
                            Client #{selectedTenant.clientNumber}: {selectedTenant.name}
                          </h2>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            selectedTenant.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {selectedTenant.status}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-slate-500 mt-1">
                          Business: <span className="font-bold text-slate-800">{selectedTenant.businessName}</span> • Phone: <span className="font-mono text-slate-900">{selectedTenant.phoneNumber}</span> • Assigned: <span className="font-mono text-purple-600">{selectedTenant.omnivoiceNumber || 'N/A'}</span>
                        </p>
                      </div>
                    </div>

                    {/* SMART DYNAMIC SAVE BUTTON */}
                    <div className="relative group">
                      <button
                        onClick={handleSaveClientSetup}
                        disabled={!canSave || isSavingConfig}
                        className={`px-6 py-3 text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center space-x-2 ${
                          canSave
                            ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/40 cursor-pointer'
                            : 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed border border-slate-300'
                        }`}
                      >
                        {isSavingConfig ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            <span>Saving Setup...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            <span>Save Client Setup</span>
                          </>
                        )}
                      </button>
                      {!canSave && (
                        <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-72 bg-slate-900 text-white text-[11px] rounded-xl p-3 shadow-xl z-50">
                          <p className="font-bold text-amber-400 flex items-center space-x-1">
                            <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                            <span>Save Disabled</span>
                          </p>
                          <p className="mt-1 text-slate-300">
                            {!isDirty 
                              ? 'No edits detected. Make changes to enable Save.' 
                              : 'All setup fields, fees, and API keys must be provided.'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 💵 FINANCIAL BILLING & PACKAGE SELECTION CARD */}
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
                    <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                      <DollarSign className="w-5 h-5 text-purple-600" />
                      <span>Client Billing, Installation Fee & Monthly Package Setup</span>
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Installation Fee */}
                      <div>
                        <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">
                          Installation Fee (One-Time Setup)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-purple-600 font-mono">
                            {CURRENCY_SYMBOLS[selectedTenant.currency || 'PKR']}
                          </span>
                          <input
                            type="number"
                            value={selectedTenant.installationFee}
                            onChange={e => handleUpdateTenantConfig({ installationFee: Number(e.target.value) })}
                            className="w-full pl-14 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                          />
                        </div>
                      </div>

                      {/* Monthly Subscription Package Fee */}
                      <div>
                        <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">
                          Monthly Subscription Package Fee
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-purple-600 font-mono">
                            {CURRENCY_SYMBOLS[selectedTenant.currency || 'PKR']}
                          </span>
                          <input
                            type="number"
                            value={selectedTenant.monthlySubscriptionFee}
                            onChange={e => handleUpdateTenantConfig({ monthlySubscriptionFee: Number(e.target.value) })}
                            className="w-full pl-14 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                          />
                        </div>
                      </div>

                      {/* Currency Selector */}
                      <div>
                        <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">
                          Billing Currency
                        </label>
                        <select
                          value={selectedTenant.currency || 'PKR'}
                          onChange={e => handleUpdateTenantConfig({ currency: e.target.value as any })}
                          className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                        >
                          <option value="PKR">🇵🇰 PKR - Pakistani Rupee (Rs)</option>
                          <option value="USD">🇺🇸 USD - US Dollar ($)</option>
                          <option value="EUR">🇪🇺 EUR - Euro (€)</option>
                          <option value="GBP">🇬🇧 GBP - British Pound (£)</option>
                          <option value="AED">🇦🇪 AED - UAE Dirham</option>
                          <option value="SAR">🇸🇦 SAR - Saudi Riyal</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 🔑 API KEYS & INTEGRATIONS EDITABLE CARD */}
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                        <Key className="w-5 h-5 text-purple-600" />
                        <span>API Keys & Telephony Credentials</span>
                      </h3>
                      <button
                        onClick={() => setShowApiKeys(!showApiKeys)}
                        className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center space-x-1 cursor-pointer"
                      >
                        {showApiKeys ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        <span>{showApiKeys ? 'Hide Keys' : 'Show Keys'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Deepgram API Key */}
                      <div>
                        <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">
                          Deepgram API Key (Pay-As-You-Go Voice Engine)
                        </label>
                        <input
                          type={showApiKeys ? 'text' : 'password'}
                          value={selectedTenant.deepgramApiKey}
                          onChange={e => handleUpdateTenantConfig({ deepgramApiKey: e.target.value })}
                          placeholder="dg_live_..."
                          className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      {/* OpenAI API Key */}
                      <div>
                        <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">
                          OpenAI API Key (Conversational LLM)
                        </label>
                        <input
                          type={showApiKeys ? 'text' : 'password'}
                          value={selectedTenant.openaiApiKey}
                          onChange={e => handleUpdateTenantConfig({ openaiApiKey: e.target.value })}
                          placeholder="sk-proj-..."
                          className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      {/* OmniVoice API Key */}
                      <div>
                        <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">
                          OmniVoice API Key (Telephony Webhook)
                        </label>
                        <input
                          type={showApiKeys ? 'text' : 'password'}
                          value={selectedTenant.omnivoiceApiKey}
                          onChange={e => handleUpdateTenantConfig({ omnivoiceApiKey: e.target.value })}
                          placeholder="ov_live_..."
                          className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      {/* OmniVoice Assigned Phone Number */}
                      <div>
                        <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">
                          OmniVoice Assigned Virtual Phone Number
                        </label>
                        <input
                          type="text"
                          value={selectedTenant.omnivoiceNumber}
                          onChange={e => handleUpdateTenantConfig({ omnivoiceNumber: e.target.value })}
                          placeholder="+1 (555) 000-0000"
                          className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Website Auto-Scraper Module */}
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                    <h3 className="text-base font-bold text-slate-900 mb-2 flex items-center space-x-2">
                      <Globe className="w-5 h-5 text-purple-600" />
                      <span>Website Auto-Scraper & Context Generator</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mb-4">
                      Enter client website URL to automatically extract business details, FAQs, catalog, and generate tailored system instructions.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="url"
                        placeholder="https://clientbusiness.com"
                        value={websiteUrl}
                        onChange={e => setWebsiteUrl(e.target.value)}
                        className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <button
                        onClick={handleAutoScrapeWebsite}
                        disabled={isScraping || !websiteUrl.trim()}
                        className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition shadow-md shadow-purple-600/20 cursor-pointer"
                      >
                        {isScraping ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Scraping Website...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>Auto-Populate Setup</span>
                          </>
                        )}
                      </button>
                    </div>

                    {scrapeSuccessMsg && (
                      <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{scrapeSuccessMsg}</span>
                      </div>
                    )}
                  </div>

                  {/* System Prompt & Knowledge Base Forms */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* System Prompt */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
                      <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                        <Sliders className="w-5 h-5 text-purple-600" />
                        <span>AI Assistant System Prompt</span>
                      </h3>
                      
                      <div>
                        <label className="text-xs font-bold text-slate-600 uppercase mb-2 block">System Persona & Guardrails</label>
                        <textarea
                          rows={6}
                          value={selectedTenant.systemPrompt}
                          onChange={e => handleUpdateTenantConfig({ systemPrompt: e.target.value })}
                          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-600 uppercase mb-2 block">WhatsApp Follow-up Action</label>
                        <input
                          type="text"
                          value={selectedTenant.followupMechanism}
                          onChange={e => handleUpdateTenantConfig({ followupMechanism: e.target.value })}
                          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>

                    {/* Knowledge Base & Catalog */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
                      <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                        <BookOpen className="w-5 h-5 text-purple-600" />
                        <span>Knowledge Base & Product Catalog</span>
                      </h3>
                      
                      <div>
                        <label className="text-xs font-bold text-slate-600 uppercase mb-2 block">Business FAQs & Operating Policies</label>
                        <textarea
                          rows={4}
                          value={selectedTenant.knowledgeBase}
                          onChange={e => handleUpdateTenantConfig({ knowledgeBase: e.target.value })}
                          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      <div className="space-y-4 pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-600 uppercase flex items-center gap-2">
                            <Package className="w-4 h-4 text-purple-600" />
                            <span>Products Catalog ({ (selectedTenant.products || []).length })</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setShowRawCatalogText(!showRawCatalogText)}
                              className="text-[11px] font-bold text-slate-500 hover:text-slate-800 underline"
                            >
                              {showRawCatalogText ? "Hide Raw" : "View Raw Text"}
                            </button>
                            <button
                              type="button"
                              onClick={openAdminAddProductModal}
                              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition"
                            >
                              <Plus className="w-3.5 h-3.5" /> + Add Item
                            </button>
                          </div>
                        </div>

                        {/* Visual Cards */}
                        {(() => {
                          const prods: any[] = selectedTenant.products || [];
                          if (prods.length === 0) {
                            return (
                              <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400 font-medium">
                                No product cards added yet. Click "Auto-Populate Setup" or "+ Add Item" above!
                              </div>
                            );
                          }
                          return (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                              {prods.map((prod) => (
                                <div key={prod.id} className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex gap-3 relative group">
                                  <div className="w-16 h-16 bg-slate-200 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                                    {prod.image ? (
                                      <img src={prod.image} alt={prod.title} className="w-full h-full object-cover" />
                                    ) : (
                                      <ImageIcon className="w-5 h-5 text-slate-400" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h5 className="text-xs font-bold text-slate-900 truncate">{prod.title}</h5>
                                    <p className="text-[11px] text-purple-700 font-extrabold mt-0.5">{prod.price}</p>
                                    {prod.link && (
                                      <a href={prod.link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-600 hover:underline flex items-center gap-0.5 truncate mt-1">
                                        <ExternalLink className="w-2.5 h-2.5 shrink-0" /> <span className="truncate">{prod.link}</span>
                                      </a>
                                    )}
                                  </div>
                                  <div className="flex flex-col justify-between items-end">
                                    <button
                                      type="button"
                                      onClick={() => openAdminEditProductModal(prod)}
                                      className="p-1 text-slate-500 hover:text-purple-700 transition"
                                      title="Edit Item"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteAdminProduct(prod.id)}
                                      className="p-1 text-slate-500 hover:text-rose-600 transition"
                                      title="Delete Item"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}

                        {showRawCatalogText && (
                          <textarea
                            rows={3}
                            value={selectedTenant.productKnowledgeBase}
                            onChange={e => handleUpdateTenantConfig({ productKnowledgeBase: e.target.value })}
                            className="w-full p-4 bg-slate-900 text-emerald-400 font-mono rounded-xl text-xs focus:outline-none"
                          />
                        )}
                      </div>
                    </div>

                  </div>

                </div>
              )}

              {/* Admin Product Add / Edit Modal */}
              {showProductModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                  <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-8">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                        <Package className="w-5 h-5 text-purple-600" />
                        <span>{editingProduct ? "Edit Tenant Product" : "Add Product to Tenant Catalog"}</span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowProductModal(false)}
                        className="text-slate-400 hover:text-slate-600 p-1 transition"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-4 text-xs font-semibold">
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Product Title *</label>
                        <input
                          type="text"
                          value={prodTitle}
                          onChange={(e) => setProdTitle(e.target.value)}
                          placeholder="e.g. Heroic Suit"
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 font-bold"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-700 font-bold mb-1">Price / Range</label>
                          <input
                            type="text"
                            value={prodPrice}
                            onChange={(e) => setProdPrice(e.target.value)}
                            placeholder="e.g. PKR 3,500"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-700 font-bold mb-1">Category</label>
                          <input
                            type="text"
                            value={prodCategory}
                            onChange={(e) => setProdCategory(e.target.value)}
                            placeholder="e.g. Outfits"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-900"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Product Image URL</label>
                        <input
                          type="url"
                          value={prodImage}
                          onChange={(e) => setProdImage(e.target.value)}
                          placeholder="https://yourstore.com/images/heroic.jpg"
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-900"
                        />
                        {prodImage && (
                          <div className="mt-2 h-16 w-16 rounded-lg overflow-hidden border border-slate-200">
                            <img src={prodImage} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Product Page Link (URL)</label>
                        <input
                          type="url"
                          value={prodLink}
                          onChange={(e) => setProdLink(e.target.value)}
                          placeholder="https://yourstore.com/products/heroic"
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Price Variations (Optional)</label>
                        <input
                          type="text"
                          value={prodVariations}
                          onChange={(e) => setProdVariations(e.target.value)}
                          placeholder="e.g. Small: Rs. 3500, Medium: Rs. 3800"
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-900"
                        />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setShowProductModal(false)}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveAdminProductModal}
                        className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-purple-600/20 transition cursor-pointer"
                      >
                        {editingProduct ? "Save Changes" : "Add Product"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ================= TAB 3: TEAM ADMINS SECTION ================= */}
          {activeTab === 'admins' && (
            <div className="space-y-8">
              
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                    <ShieldCheck className="w-6 h-6 text-purple-600" />
                    <span>Team Admins & Access Control</span>
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Manage agency team members, grant View-Only or Read/Write edit permissions, and assign admin roles.
                  </p>
                </div>

                <button
                  onClick={() => setShowAddAdminModal(true)}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-md shadow-purple-600/20 transition cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ Add New Admin</span>
                </button>
              </div>

              {/* Admin Directory Table */}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h3 className="text-base font-bold text-slate-900">REGISTERED TEAM MEMBERS & ROLES</h3>
                  <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">
                    {partners.length} Admin Members
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-4">Admin Member</th>
                        <th className="p-4">Email Contact</th>
                        <th className="p-4">Assigned Role</th>
                        <th className="p-4">Access Level</th>
                        <th className="p-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {partners.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                                {p.name.charAt(0)}
                              </div>
                              <span className="font-bold text-slate-900 text-sm">{p.name}</span>
                            </div>
                          </td>
                          <td className="p-4 font-mono font-medium text-slate-600">
                            {p.email}
                          </td>
                          <td className="p-4">
                            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800">
                              {p.role}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              p.accessLevel === 'read_write' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {p.accessLevel === 'read_write' ? '🟢 Full Read / Write' : '🔵 View Only'}
                            </span>
                          </td>
                          <td className="p-4">
                            <button
                              onClick={() => {
                                setPartners(partners.map(item => {
                                  if (item.id === p.id) {
                                    const nextAccess = item.accessLevel === 'read_write' ? 'view_only' : 'read_write';
                                    return { ...item, accessLevel: nextAccess };
                                  }
                                  return item;
                                }));
                              }}
                              className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
                            >
                              Toggle Access
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </main>
      </div>

      {/* ================= MODAL: WHATSAPP CONNECT & PAIRING CODE ================= */}
      {showWhatsAppConnectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                <Phone className="w-5 h-5 text-emerald-600" />
                <span>Link WhatsApp Account</span>
              </h3>
              <button
                onClick={() => setShowWhatsAppConnectModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Mode Switcher: QR Code vs Phone Number Pairing */}
            <div className="flex bg-slate-100 p-1.5 rounded-2xl">
              <button
                onClick={() => setWaConnectMode('qr')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center space-x-1 ${
                  waConnectMode === 'qr' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>Scan QR Code</span>
              </button>
              <button
                onClick={() => setWaConnectMode('pairing')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center space-x-1 ${
                  waConnectMode === 'pairing' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Link with Phone #</span>
              </button>
            </div>

            {/* Mode 1: QR Code Mode */}
            {waConnectMode === 'qr' && (
              <div className="text-center space-y-4 py-4">
                <div className="w-48 h-48 mx-auto bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center p-4">
                  <div className="text-center space-y-2">
                    <QrCode className="w-16 h-16 text-purple-600 mx-auto animate-pulse" />
                    <p className="text-xs font-bold text-slate-700">Scan via WhatsApp Mobile App</p>
                    <p className="text-[10px] text-slate-400">Linked Devices → Link a Device</p>
                  </div>
                </div>
              </div>
            )}

            {/* Mode 2: Phone Number Pairing Code Mode */}
            {waConnectMode === 'pairing' && (
              <form onSubmit={handleGeneratePairingCode} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">
                    WhatsApp Phone Number (with Country Code)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="923001234567"
                    value={waPairingPhone}
                    onChange={e => setWaPairingPhone(e.target.value)}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Enter number without '+' or spaces (e.g. 923001234567)</p>
                </div>

                <button
                  type="submit"
                  disabled={isGeneratingPairingCode || !waPairingPhone.trim()}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {isGeneratingPairingCode ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating Code...</span>
                    </>
                  ) : (
                    <span>Request Pairing Code</span>
                  )}
                </button>

                {pairingError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{pairingError}</span>
                  </div>
                )}

                {waPairingCode && (
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 text-center space-y-2">
                    <p className="text-xs font-bold text-emerald-800">Your Official WhatsApp Pairing Code:</p>
                    <p className="text-2xl font-mono font-black text-emerald-900 tracking-widest bg-white py-2 px-4 rounded-xl border border-emerald-300 inline-block shadow-sm">
                      {waPairingCode}
                    </p>
                    <p className="text-[11px] text-emerald-700">Open WhatsApp → Linked Devices → Link with phone number instead</p>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL: ONBOARD NEW CLIENT ================= */}
      {showAddTenant && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl space-y-6">
            <h3 className="text-xl font-bold text-slate-900">Onboard New Client</h3>
            <form onSubmit={handleAddClient} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Contact Name</label>
                <input
                  type="text"
                  required
                  value={newClientForm.name}
                  onChange={e => setNewClientForm({ ...newClientForm, name: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Business Name</label>
                <input
                  type="text"
                  required
                  value={newClientForm.businessName}
                  onChange={e => setNewClientForm({ ...newClientForm, businessName: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Phone Number</label>
                <input
                  type="text"
                  required
                  value={newClientForm.phoneNumber}
                  onChange={e => setNewClientForm({ ...newClientForm, phoneNumber: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Installation Fee</label>
                  <input
                    type="number"
                    required
                    value={newClientForm.installationFee}
                    onChange={e => setNewClientForm({ ...newClientForm, installationFee: Number(e.target.value) })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Monthly Fee</label>
                  <input
                    type="number"
                    required
                    value={newClientForm.monthlySubscriptionFee}
                    onChange={e => setNewClientForm({ ...newClientForm, monthlySubscriptionFee: Number(e.target.value) })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Billing Currency</label>
                <select
                  value={newClientForm.currency}
                  onChange={e => setNewClientForm({ ...newClientForm, currency: e.target.value as any })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                >
                  <option value="PKR">🇵🇰 PKR - Pakistani Rupee (Rs)</option>
                  <option value="USD">🇺🇸 USD - US Dollar ($)</option>
                  <option value="EUR">🇪🇺 EUR - Euro (€)</option>
                  <option value="GBP">🇬🇧 GBP - British Pound (£)</option>
                  <option value="AED">🇦🇪 AED - UAE Dirham</option>
                  <option value="SAR">🇸🇦 SAR - Saudi Riyal</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddTenant(false)}
                  className="px-5 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-purple-600 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20 cursor-pointer"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD TEAM ADMIN ================= */}
      {showAddAdminModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl space-y-6">
            <h3 className="text-xl font-bold text-slate-900">Add Team Admin / Member</h3>
            <form onSubmit={handleAddTeamAdmin} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Full Name</label>
                <input
                  type="text"
                  required
                  value={newAdminForm.name}
                  onChange={e => setNewAdminForm({ ...newAdminForm, name: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Email Address</label>
                <input
                  type="email"
                  required
                  value={newAdminForm.email}
                  onChange={e => setNewAdminForm({ ...newAdminForm, email: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Admin Role</label>
                <select
                  value={newAdminForm.role}
                  onChange={e => setNewAdminForm({ ...newAdminForm, role: e.target.value as any })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                >
                  <option value="admin">Super Admin</option>
                  <option value="manager">Agency Manager</option>
                  <option value="viewer">Portal Viewer</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Access Permissions Level</label>
                <select
                  value={newAdminForm.accessLevel}
                  onChange={e => setNewAdminForm({ ...newAdminForm, accessLevel: e.target.value as any })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                >
                  <option value="read_write">🟢 Full Read / Write (Edit setups & API keys)</option>
                  <option value="view_only">🔵 View Only (Read-only dashboard stats)</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddAdminModal(false)}
                  className="px-5 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-purple-600 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20 cursor-pointer"
                >
                  Add Admin Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: SAVE SUCCESS & CLIENT CREDENTIALS ================= */}
      {showSaveSuccessModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl text-center space-y-6">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Setup & Pricing Saved</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Client credentials, installation fee, monthly package, currency, and API keys have been updated.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400 font-bold uppercase">Username:</span>
                <span className="text-xs font-mono font-bold text-slate-900">{selectedTenant.clientUsername}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400 font-bold uppercase">Password:</span>
                <span className="text-xs font-mono font-bold text-purple-600">{selectedTenant.clientPassword}</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-200 pt-2">
                <span className="text-xs text-slate-400 font-bold uppercase">Monthly Package:</span>
                <span className="text-xs font-mono font-bold text-slate-900">
                  {CURRENCY_SYMBOLS[selectedTenant.currency || 'PKR']}{selectedTenant.monthlySubscriptionFee.toLocaleString()}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowSaveSuccessModal(false)}
              className="w-full py-3 bg-purple-600 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20 cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
