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
  CheckCircle2,
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
  Bot,
  UserCheck2,
  ArrowLeft,
  QrCode,
  Smartphone,
  Calendar,
  RefreshCw,
  Rocket,
  FileEdit,
  Database,
  Layers,
  Percent
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
  const [activeTab, setActiveTabRaw] = useState<'dashboard' | 'clients' | 'admins' | 'settings' | 'logs' | 'observability'>('dashboard');

  const setActiveTab = (tab: 'dashboard' | 'clients' | 'admins' | 'settings' | 'logs' | 'observability') => {
    setActiveTabRaw(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Sub-tab State
  const [clientSubTab, setClientSubTab] = useState<'setup' | 'directory'>('directory');

  // Real-time System & Request Logger State
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [isFetchingLogs, setIsFetchingLogs] = useState(false);
  const [selectedLogEntry, setSelectedLogEntry] = useState<any | null>(null);
  const [logTypeFilter, setLogTypeFilter] = useState('all');
  const [logLevelFilter, setLogLevelFilter] = useState('all');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logAutoRefresh, setLogAutoRefresh] = useState(true);

  // Observability & Error Center States
  const [obsMetrics, setObsMetrics] = useState<any>(null);
  const [obsGroups, setObsGroups] = useState<any[]>([]);
  const [obsTotalGroups, setObsTotalGroups] = useState(0);
  const [isFetchingObsMetrics, setIsFetchingObsMetrics] = useState(false);
  const [isFetchingObsGroups, setIsFetchingObsGroups] = useState(false);

  // Filtering & Pagination
  const [obsPage, setObsPage] = useState(1);
  const [obsLimit] = useState(25);
  const [obsStatusFilter, setObsStatusFilter] = useState('');
  const [obsSeverityFilter, setObsSeverityFilter] = useState('');
  const [obsServiceFilter, setObsServiceFilter] = useState('');
  const [obsSearchQuery, setObsSearchQuery] = useState('');
  const [obsTimeframe, setObsTimeframe] = useState<'24h' | '7d' | '30d'>('7d');
  const [obsAutoRefresh, setObsAutoRefresh] = useState(true);

  // Error Investigation Drawer/Modal
  const [selectedErrorGroup, setSelectedErrorGroup] = useState<any | null>(null);
  const [errorGroupDetail, setErrorGroupDetail] = useState<any | null>(null);
  const [isFetchingGroupDetail, setIsFetchingGroupDetail] = useState(false);
  const [drawerTenantFilter, setDrawerTenantFilter] = useState('');
  const [obsUpdatingStatusId, setObsUpdatingStatusId] = useState<string | null>(null);

  // Health Check & Circuit Breakers State
  const [isFetchingApiHealth, setIsFetchingApiHealth] = useState(false);
  const [isResettingCircuits, setIsResettingCircuits] = useState(false);

  const getObsDateRange = () => {
    const toDate = new Date();
    const fromDate = new Date();
    if (obsTimeframe === '24h') {
      fromDate.setHours(fromDate.getHours() - 24);
    } else if (obsTimeframe === '7d') {
      fromDate.setDate(fromDate.getDate() - 7);
    } else {
      fromDate.setDate(fromDate.getDate() - 30);
    }
    return {
      from: fromDate.toISOString(),
      to: toDate.toISOString()
    };
  };

  const fetchObsMetrics = async () => {
    setIsFetchingObsMetrics(true);
    try {
      const { from, to } = getObsDateRange();
      const res = await fetch(`/api/admin/observability/metrics?from=${from}&to=${to}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setObsMetrics(data);
        }
      }
    } catch (e) {
      console.error("Failed to fetch observability metrics:", e);
    } finally {
      setIsFetchingObsMetrics(false);
    }
  };

  const fetchObsGroups = async () => {
    setIsFetchingObsGroups(true);
    try {
      const { from, to } = getObsDateRange();
      let url = `/api/admin/observability/errors?page=${obsPage}&limit=${obsLimit}&from=${from}&to=${to}`;
      if (obsStatusFilter) url += `&status=${obsStatusFilter}`;
      if (obsSeverityFilter) url += `&severity=${obsSeverityFilter}`;
      if (obsServiceFilter) url += `&service=${obsServiceFilter}`;
      if (obsSearchQuery) url += `&search=${encodeURIComponent(obsSearchQuery)}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setObsGroups(data.groups || []);
          setObsTotalGroups(data.total || 0);
        }
      }
    } catch (e) {
      console.error("Failed to fetch error groups:", e);
    } finally {
      setIsFetchingObsGroups(false);
    }
  };



  const resetCircuitBreakers = async () => {
    setIsResettingCircuits(true);
    try {
      const res = await fetch('/api/admin/api-health', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          fetchApiHealth();
        }
      }
    } catch (e) {
      console.error("Failed to reset circuit breakers:", e);
    } finally {
      setIsResettingCircuits(false);
    }
  };

  const fetchErrorGroupDetail = async (groupId: string, tenantId = '') => {
    setIsFetchingGroupDetail(true);
    try {
      let url = `/api/admin/observability/errors/${groupId}?occLimit=50`;
      if (tenantId) url += `&tenantId=${tenantId}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setErrorGroupDetail(data);
        }
      }
    } catch (e) {
      console.error("Failed to fetch error group detail:", e);
    } finally {
      setIsFetchingGroupDetail(false);
    }
  };

  const updateErrorGroupStatus = async (groupId: string, newStatus: string) => {
    setObsUpdatingStatusId(groupId);
    try {
      const res = await fetch('/api/admin/observability/errors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, status: newStatus, resolvedBy: 'admin' })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setObsGroups((prev: any[]) => prev.map(g => g.id === groupId ? { ...g, status: newStatus } : g));
          if (selectedErrorGroup && selectedErrorGroup.id === groupId) {
            setSelectedErrorGroup((prev: any) => prev ? { ...prev, status: newStatus } : null);
          }
          fetchObsMetrics();
        }
      }
    } catch (e) {
      console.error("Failed to update error group status:", e);
    } finally {
      setObsUpdatingStatusId(null);
    }
  };

  const fetchSystemLogs = async () => {
    setIsFetchingLogs(true);
    try {
      const res = await fetch(`/api/admin/logs?type=${logTypeFilter}&level=${logLevelFilter}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.logs)) {
          setSystemLogs(data.logs);
        }
      }
    } catch (e) {
      console.error("Failed to fetch system logs:", e);
    } finally {
      setIsFetchingLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'logs' || (activeTab === 'clients' && clientSubTab === 'setup')) {
      fetchSystemLogs();
      if (logAutoRefresh) {
        const interval = setInterval(fetchSystemLogs, 4000);
        return () => clearInterval(interval);
      }
    }
  }, [activeTab, clientSubTab, logTypeFilter, logLevelFilter, logAutoRefresh]);

  useEffect(() => {
    if (activeTab === 'observability') {
      fetchObsMetrics();
      fetchObsGroups();
      fetchApiHealth();
    }
  }, [activeTab, obsPage, obsStatusFilter, obsSeverityFilter, obsServiceFilter, obsTimeframe]);

  useEffect(() => {
    if (activeTab === 'observability' && obsAutoRefresh) {
      const timer = setInterval(() => {
        fetchObsMetrics();
        fetchObsGroups();
        fetchApiHealth();
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [activeTab, obsAutoRefresh, obsPage, obsStatusFilter, obsSeverityFilter, obsServiceFilter, obsTimeframe]);

  useEffect(() => {
    if (activeTab === 'observability') {
      const delayDebounce = setTimeout(() => {
        setObsPage(1);
        fetchObsGroups();
      }, 400);
      return () => clearTimeout(delayDebounce);
    }
  }, [obsSearchQuery]);

  const handleAdminLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ portal: 'admin' }) });
    } catch (e) {}
    window.location.href = '/login?portal=admin';
  };

  // Sync tab from URL query on initial load & popstate (browser back/forward)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const syncTabFromUrl = () => {
        const params = new URLSearchParams(window.location.search);
        const urlTab = params.get('tab');
        const validTabs = ['dashboard', 'clients', 'admins', 'settings', 'logs', 'observability'];
        if (urlTab && validTabs.includes(urlTab)) {
          setActiveTabRaw(urlTab as any);
        }
      };

      syncTabFromUrl();
      window.addEventListener('popstate', syncTabFromUrl);
      return () => window.removeEventListener('popstate', syncTabFromUrl);
    }
  }, []);

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

  // Delete Tenant Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingTenantId, setDeletingTenantId] = useState<string | null>(null);
  const [deletingTenantName, setDeletingTenantName] = useState<string>('');
  const [isDeletingTenant, setIsDeletingTenant] = useState(false);

  const handleDeleteTenant = (tenantId: string, businessName: string) => {
    setDeletingTenantId(tenantId);
    setDeletingTenantName(businessName);
    setShowDeleteModal(true);
  };

  const confirmDeleteTenant = async () => {
    if (!deletingTenantId) return;
    setIsDeletingTenant(true);
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: deletingTenantId })
      });
      const data = await res.json();
      if (data.success) {
        const newTenants = tenants.filter(t => t.id !== deletingTenantId);
        setTenants(newTenants);
        localStorage.setItem('hazel_admin_tenants', JSON.stringify(newTenants));
        if (selectedTenantId === deletingTenantId) {
          setSelectedTenantId(newTenants[0]?.id || '');
          setClientSubTab('directory');
        }
      }
    } catch (err) {
      console.error("Failed to delete tenant:", err);
    } finally {
      setIsDeletingTenant(false);
      setShowDeleteModal(false);
      setDeletingTenantId(null);
    }
  };

  // Show/Hide API keys & credentials toggles
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [showClientCredentials, setShowClientCredentials] = useState(false);
  const [copiedCredsNotice, setCopiedCredsNotice] = useState<string | null>(null);

  const copyClientCredentials = (type: 'username' | 'password' | 'all' | 'link') => {
    let textToCopy = '';
    const loginUrl = typeof window !== 'undefined' ? `${window.location.origin}/login` : 'https://hazelwhat-production.up.railway.app/login';
    if (type === 'username') textToCopy = selectedTenant.clientUsername || '';
    else if (type === 'password') textToCopy = selectedTenant.clientPassword || '';
    else if (type === 'link') textToCopy = loginUrl;
    else {
      textToCopy = `🔐 Client Portal Login Details\nPortal Link: ${loginUrl}\nEmail / Login ID: ${selectedTenant.email || ''}\nUsername: ${selectedTenant.clientUsername || ''}\nPassword: ${selectedTenant.clientPassword || ''}`;
    }
    navigator.clipboard.writeText(textToCopy);
    setCopiedCredsNotice(type === 'username' ? 'Username copied!' : type === 'password' ? 'Password copied!' : type === 'link' ? 'Login Link copied!' : 'All Login Credentials & Link Copied!');
    setTimeout(() => setCopiedCredsNotice(null), 2500);
  };

  // Dirty State (Edit Tracker)
  const [isDirty, setIsDirty] = useState(false);

  // Auto Web Scraper State
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeSuccessMsg, setScrapeSuccessMsg] = useState<string | null>(null);

  // Save Animation State
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Go Live Toast Notification State
  const [showGoLiveToast, setShowGoLiveToast] = useState(false);

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
    status: 'draft' as 'active' | 'draft',
  });

  // Team Admin Modal State
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [newAdminForm, setNewAdminForm] = useState({
    name: '',
    email: '',
    role: 'admin' as 'admin' | 'manager' | 'viewer',
    accessLevel: 'read_write' as 'read_write' | 'view_only',
    password: '',
  });

  // New Admin Success Modal State
  const [showAdminSuccessModal, setShowAdminSuccessModal] = useState(false);
  const [createdAdminInfo, setCreatedAdminInfo] = useState<Partner | null>(null);

  // Save Success Pop-up Modal State
  const [showSaveSuccessModal, setShowSaveSuccessModal] = useState(false);

  // API Health & Balance Alert State
  const [apiHealth, setApiHealth] = useState<any>(null);

  const fetchApiHealth = async () => {
    setIsFetchingApiHealth(true);
    try {
      const res = await fetch('/api/admin/api-health');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setApiHealth(data);
        }
      }
    } catch (e) {
      console.error('Failed to fetch API health:', e);
    } finally {
      setIsFetchingApiHealth(false);
    }
  };

  // Local Backup State & Recovery Handlers
  const [hasLocalBackup, setHasLocalBackup] = useState(false);
  const [backupCount, setBackupCount] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('hazel_admin_tenants');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > tenants.length) {
            setHasLocalBackup(true);
            setBackupCount(parsed.length);
          } else {
            setHasLocalBackup(false);
          }
        }
      } catch (e) {}
    }
  }, [tenants]);

  const handleRestoreBackup = () => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('hazel_admin_tenants');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTenants(parsed);
          setSelectedTenantId(parsed[0].id || '');
          setIsDirty(true);
          alert(`Restored ${parsed.length} tenants from browser local backup. Please review and click "Save Client Setup" at the bottom to save them permanently to the database.`);
        }
      }
    } catch (e: any) {
      alert("Failed to restore backup: " + e.message);
    }
  };

  const handleLoadSeedDefaults = async () => {
    if (!confirm("This will load/overwrite the default templates for Trend Aura, Pizza Box, and other testing clients in the database. Proceed?")) return;
    try {
      const res = await fetch('/api/admin/seed-db', { method: 'POST' });
      const data = await res.json();
      if (data.message) {
        alert("Database seeded successfully! Reloading page to update...");
        window.location.reload();
      } else {
        alert("Failed to seed database: " + JSON.stringify(data));
      }
    } catch (e: any) {
      alert("Error seeding database: " + e.message);
    }
  };

  const selectedTenant = tenants.find(t => t.id === selectedTenantId) || tenants[0] || defaultFallbackTenant;

  const fetchTenants = async () => {
    try {
      const res = await fetch('/api/admin/tenants');
      if (res.status === 401) {
        window.location.href = '/login?portal=admin';
        return;
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.tenants) && data.tenants.length > 0) {
        setTenants(data.tenants);
        if (Array.isArray(data.partners) && data.partners.length > 0) {
          setPartners(data.partners);
        }
        if (!selectedTenantId) {
          setSelectedTenantId(data.tenants[0].id);
        }
        // Update local storage to keep client cache in sync with server
        try {
          localStorage.setItem('hazel_admin_tenants', JSON.stringify(data.tenants));
          if (data.partners) localStorage.setItem('hazel_admin_partners', JSON.stringify(data.partners));
        } catch (err) {}
      } else {
        // Unauthorized or invalid data format -> redirect to login
        window.location.href = '/login?portal=admin';
      }
    } catch (e) {
      console.error('Failed to fetch tenants:', e);
      window.location.href = '/login?portal=admin';
    }
  };

  useEffect(() => {
    fetchTenants();
    fetchApiHealth();
  }, []);

  const persistTenants = async (newTenants: Tenant[], newPartners?: Partner[]) => {
    setTenants(newTenants);
    try {
      localStorage.setItem('hazel_admin_tenants', JSON.stringify(newTenants));
      if (newPartners) {
        setPartners(newPartners);
        localStorage.setItem('hazel_admin_partners', JSON.stringify(newPartners));
      }
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenants: newTenants, partners: newPartners || partners })
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        const errMsg = data.error || 'Failed to persist tenant changes to database.';
        console.error('Persist tenants error:', errMsg);
        alert(`⚠️ Tenant Save Error: ${errMsg}`);
      }
    } catch (e: any) {
      console.error('Failed to persist tenants:', e);
      alert(`⚠️ Network Error persisting tenants: ${e.message}`);
    }
  };

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

  // Strict Validation: Check if required setup fields and fees are completely filled
  const isSetupFormComplete = Boolean(
    selectedTenant.systemPrompt?.trim() &&
    selectedTenant.knowledgeBase?.trim() &&
    selectedTenant.productKnowledgeBase?.trim() &&
    selectedTenant.followupMechanism?.trim() &&
    selectedTenant.clientUsername?.trim() &&
    selectedTenant.clientPassword?.trim() &&
    selectedTenant.installationFee >= 0 &&
    selectedTenant.monthlySubscriptionFee >= 0
  );

  // Enable Save button whenever edits are made (isDirty)
  const canSave = isDirty;

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
      status: newClientForm.status || 'draft',
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
      deepgramApiKey: '',
      openaiApiKey: '',
      omnivoiceApiKey: '',
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

    const newTenantsList = [created, ...tenants];
    persistTenants(newTenantsList);
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
      status: 'draft',
    });
  };

  const handleAddTeamAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    const assignedPassword = newAdminForm.password.trim() || `AdminPass@${Math.floor(1000 + Math.random() * 9000)}`;
    const createdAdmin: Partner = {
      id: `p-${Date.now()}`,
      name: newAdminForm.name.trim(),
      email: newAdminForm.email.trim(),
      role: newAdminForm.role,
      accessLevel: newAdminForm.accessLevel,
      clientsAssigned: 0,
      permissions: newAdminForm.accessLevel === 'read_write' ? ['edit_setup', 'manage_billing'] : ['view_only'],
      password: assignedPassword,
    };
    const newPartnersList = [...partners, createdAdmin];
    persistTenants(tenants, newPartnersList);
    setShowAddAdminModal(false);
    setCreatedAdminInfo(createdAdmin);
    setShowAdminSuccessModal(true);
    setNewAdminForm({ name: '', email: '', role: 'admin', accessLevel: 'read_write', password: '' });
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
    const updated = tenants.map(t => {
      if (t.id === tenantId) {
        const nextStatus: Tenant['status'] = t.status === 'active' ? 'suspended' : 'active';
        return { 
          ...t, 
          status: nextStatus,
          troubleshoot: { ...t.troubleshoot, serviceBlocked: nextStatus === 'suspended' } 
        };
      }
      return t;
    });
    persistTenants(updated);
  };

  const handlePublishTenantLive = (tenantId: string) => {
    const updated = tenants.map(t => {
      if (t.id === tenantId) {
        return { 
          ...t, 
          status: 'active' as const,
          troubleshoot: { ...t.troubleshoot, serviceBlocked: false } 
        };
      }
      return t;
    });
    persistTenants(updated);
    setShowGoLiveToast(true);
    setTimeout(() => setShowGoLiveToast(false), 4000);
  };

  const handleUpdateTenantConfig = (updated: Partial<Tenant>) => {
    setTenants(tenants.map(t => t.id === selectedTenant.id ? { ...t, ...updated } : t));
    setIsDirty(true);
  };

  const handleSaveClientSetup = async () => {
    if (!canSave) return;
    
    setIsSavingConfig(true);
    try {
      await persistTenants(tenants);
    } catch (e) {
      console.error('Failed to save client setup:', e);
    } finally {
      setIsSavingConfig(false);
      setIsDirty(false);
      setShowSaveSuccessModal(true);
    }
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
      productKnowledgeBase: newCatalogText || ""
    });
  };

  const handleClearAdminCatalog = () => {
    if (!confirm("Are you sure you want to clear the entire product catalog for this client?")) return;
    handleUpdateTenantConfig({
      products: [],
      productKnowledgeBase: ""
    });
  };

  const handleAutoScrapeWebsite = async () => {
    if (!websiteUrl.trim()) return;

    const existingCount = (selectedTenant.products || []).length;
    if (existingCount > 0) {
      const confirmReplace = confirm(
        `Auto-populating from a new website will replace the existing product catalog (${existingCount} products) for this client. Do you want to proceed?`
      );
      if (!confirmReplace) return;
    }

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
        const formattedCatalog = formatTenantProductsText(scrapedItems, selectedTenant.currency || "PKR");

        const cleanUrl = websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
        const scrapedPrompt = selectedTenant.systemPrompt || `You are the lead AI Sales & Support Agent for ${cleanUrl}. Your goal is to represent the business, book meetings, answer pricing/services queries, and deliver clear responses based on official company policy. Always maintain a professional and welcoming tone.`;
        const scrapedKB = selectedTenant.knowledgeBase || `=== AUTO-SCRAPED WEBSITE CONTENT FROM ${cleanUrl} ===\n\nCompany Overview:\n${cleanUrl} is a premier provider of automated solutions and client management services.`;

        handleUpdateTenantConfig({
          systemPrompt: scrapedPrompt,
          knowledgeBase: scrapedKB,
          products: scrapedItems,
          productKnowledgeBase: formattedCatalog || data.catalog || "",
        });

        setScrapeSuccessMsg(`Successfully scraped & auto-populated ${scrapedItems.length} products with pictures & links from ${websiteUrl}!`);
      } else {
        alert(data.error || "Failed to scrape website");
      }
    } catch (e) {
      console.error(e);
      alert("Error occurred while scraping.");
    }
    setIsScraping(false);
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

            {/* TAB 4: SYSTEM LOGGER */}
            <button
              onClick={() => setActiveTab('logs')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Activity className="w-5 h-5" />
                <span>System Logger</span>
              </div>
              <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-emerald-400/20 text-emerald-600 dark:text-emerald-300 border border-emerald-400/30 uppercase tracking-wider animate-pulse">
                LIVE
              </span>
            </button>

            {/* TAB 5: OBSERVABILITY & ERROR CENTER */}
            <button
              onClick={() => setActiveTab('observability')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'observability'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center space-x-3">
                <ShieldAlert className="w-5 h-5" />
                <span>Observability Center</span>
              </div>
              <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-purple-100 text-purple-700 border border-purple-200 uppercase tracking-wider">
                NEW
              </span>
            </button>

          </nav>
        </div>

        {/* Bottom Sidebar Controls */}
        <div className="space-y-1.5 pt-6 border-t border-slate-100">
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span>Setting</span>
          </button>
          <button 
            onClick={handleAdminLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-all cursor-pointer"
          >
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
          
          {/* API Health & Balance Alert Banner */}
          {apiHealth && (apiHealth.deepgram?.ok === false || apiHealth.llm?.ok === false || (apiHealth.alerts && apiHealth.alerts.length > 0)) && (
            <div className="bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 text-white p-5 rounded-3xl shadow-xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-md">
                    <ShieldAlert className="w-6 h-6 text-white animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base tracking-tight">API Key Error / Low Balance Alert</h3>
                    <p className="text-xs text-rose-100 font-medium">Backend shared API keys require attention to keep WhatsApp AI services running.</p>
                  </div>
                </div>
                <button 
                  onClick={fetchApiHealth}
                  className="px-3.5 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer backdrop-blur-md"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Re-check API Health
                </button>
              </div>

              <div className="space-y-2 pt-2 border-t border-white/20 text-xs font-semibold">
                {apiHealth.deepgram?.ok === false && (
                  <div className="flex items-center gap-2 bg-black/25 px-3 py-2 rounded-xl">
                    <span className="font-extrabold text-amber-300">🎙 Deepgram Voice Engine:</span>
                    <span>{apiHealth.deepgram?.message}</span>
                  </div>
                )}
                {apiHealth.llm?.ok === false && (
                  <div className="flex items-center gap-2 bg-black/25 px-3 py-2 rounded-xl">
                    <span className="font-extrabold text-amber-300">🤖 Conversational LLM:</span>
                    <span>{apiHealth.llm?.message}</span>
                  </div>
                )}
                {apiHealth.alerts && apiHealth.alerts.slice(0, 3).map((a: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between bg-black/15 px-3 py-1.5 rounded-lg text-[11px]">
                    <span>[{a.service}] {a.message}</span>
                    <span className="opacity-80 font-mono text-[10px]">{new Date(a.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

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

              {hasLocalBackup && (
                <button
                  onClick={handleRestoreBackup}
                  className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 shadow-md shadow-amber-600/20 transition-all cursor-pointer animate-pulse"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Restore Browser Backup ({backupCount})</span>
                </button>
              )}

              <button
                onClick={handleLoadSeedDefaults}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-2 border border-slate-300 transition-all cursor-pointer"
              >
                <Bot className="w-4 h-4" />
                <span>Load Seed Defaults</span>
              </button>

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
                                  <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                                    t.status === 'active' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                    t.status === 'draft' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                                    'bg-rose-100 text-rose-800 border border-rose-200'
                                  }`}>
                                    {t.status === 'draft' ? '📝 DRAFT' : t.status === 'active' ? '🟢 ACTIVE' : `🔴 ${t.status?.toUpperCase()}`}
                                  </span>
                                </td>
                                <td className="p-4">
                                  <div className="flex items-center space-x-2">
                                    {t.status === 'draft' && (
                                      <button
                                        onClick={() => handlePublishTenantLive(t.id)}
                                        title="Publish Live with 1-Click"
                                        className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black transition shadow-md shadow-emerald-600/20 flex items-center space-x-1 cursor-pointer animate-pulse"
                                      >
                                        <Rocket className="w-3.5 h-3.5" />
                                        <span>Go Live</span>
                                      </button>
                                    )}
                                    <button
                                      onClick={() => {
                                        setSelectedTenantId(t.id);
                                        setClientSubTab('setup');
                                      }}
                                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold transition shadow-sm cursor-pointer flex items-center space-x-1"
                                    >
                                      <FileEdit className="w-3.5 h-3.5" />
                                      <span>Manage Setup</span>
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
                                    <button
                                      onClick={() => handleDeleteTenant(t.id, t.name || t.businessName)}
                                      title="Delete Account Permanently"
                                      className="p-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 transition cursor-pointer"
                                    >
                                      <Trash2 className="w-4 h-4" />
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
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                            selectedTenant.status === 'active' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                            selectedTenant.status === 'draft' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                            'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}>
                            {selectedTenant.status === 'draft' ? '📝 DRAFT' : selectedTenant.status === 'active' ? '🟢 ACTIVE' : `🔴 ${selectedTenant.status?.toUpperCase()}`}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-slate-500 mt-1">
                          Business: <span className="font-bold text-slate-800">{selectedTenant.businessName}</span> • Phone: <span className="font-mono text-slate-900">{selectedTenant.phoneNumber}</span> • Assigned: <span className="font-mono text-purple-600">{selectedTenant.omnivoiceNumber || 'N/A'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      {/* 1-CLICK GO LIVE BUTTON */}
                      {selectedTenant.status === 'draft' && (
                        <button
                          onClick={() => handlePublishTenantLive(selectedTenant.id)}
                          className="px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center space-x-2 cursor-pointer animate-pulse"
                        >
                          <Rocket className="w-4 h-4" />
                          <span>1-Click Onboard & Go Live</span>
                        </button>
                      )}

                      {/* Status Selector Dropdown */}
                      <select
                        value={selectedTenant.status || 'draft'}
                        onChange={e => handleUpdateTenantConfig({ status: e.target.value as any })}
                        className="px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                      >
                        <option value="draft">📝 Draft Mode</option>
                        <option value="active">🟢 Live Active</option>
                        <option value="suspended">🔴 Suspended</option>
                      </select>

                      <button
                        onClick={() => handleDeleteTenant(selectedTenant.id, selectedTenant.name || selectedTenant.businessName)}
                        className="px-4 py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center space-x-2 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete Account</span>
                      </button>
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

                  {/* 🔐 CLIENT PORTAL LOGIN CREDENTIALS CARD */}
                  <div className="bg-gradient-to-r from-purple-50/80 via-indigo-50/60 to-purple-50/80 p-6 rounded-3xl border border-purple-200/80 shadow-sm space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                          <Lock className="w-5 h-5 text-purple-600" />
                          <span>Client Portal Access Credentials</span>
                        </h3>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          Generated login username and password for client portal dashboard access.
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await persistTenants(tenants);
                            setCopiedCredsNotice("Credentials Saved to Database Successfully!");
                            setTimeout(() => setCopiedCredsNotice(null), 3000);
                          }}
                          className="text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-md active:scale-95 transition"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Save Credentials</span>
                        </button>

                        <button
                          onClick={() => setShowClientCredentials(!showClientCredentials)}
                          className="text-xs font-bold text-purple-700 bg-white border border-purple-200 px-3 py-1.5 rounded-xl hover:bg-purple-50 flex items-center space-x-1 cursor-pointer transition shadow-sm"
                        >
                          {showClientCredentials ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          <span>{showClientCredentials ? 'Hide Password' : 'Show Password'}</span>
                        </button>

                        <button
                          onClick={() => copyClientCredentials('all')}
                          className="text-xs font-extrabold text-white bg-gradient-to-r from-purple-600 to-indigo-600 px-3.5 py-1.5 rounded-xl hover:from-purple-700 hover:to-indigo-700 flex items-center space-x-1.5 cursor-pointer shadow-md shadow-purple-500/20 active:scale-95 transition"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Both Credentials</span>
                        </button>
                      </div>
                    </div>

                    {copiedCredsNotice && (
                      <div className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl text-center shadow-md animate-bounce">
                        ✅ {copiedCredsNotice}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Username Field */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold text-slate-700 uppercase">Client Username</label>
                          <button 
                            onClick={() => copyClientCredentials('username')} 
                            className="text-[11px] font-bold text-purple-600 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Copy className="w-3 h-3" /> Copy
                          </button>
                        </div>
                        <input
                          type="text"
                          value={selectedTenant.clientUsername || ''}
                          onChange={e => handleUpdateTenantConfig({ clientUsername: e.target.value })}
                          onBlur={() => persistTenants(tenants)}
                          className="w-full p-3.5 bg-white border border-purple-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
                        />
                      </div>

                      {/* Password Field */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold text-slate-700 uppercase">Client Password</label>
                          <button 
                            onClick={() => copyClientCredentials('password')} 
                            className="text-[11px] font-bold text-purple-600 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Copy className="w-3 h-3" /> Copy
                          </button>
                        </div>
                        <input
                          type={showClientCredentials ? 'text' : 'password'}
                          value={selectedTenant.clientPassword || ''}
                          onChange={e => handleUpdateTenantConfig({ clientPassword: e.target.value })}
                          onBlur={() => persistTenants(tenants)}
                          className="w-full p-3.5 bg-white border border-purple-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
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
                            {(selectedTenant.products || []).length > 0 && (
                              <button
                                type="button"
                                onClick={handleClearAdminCatalog}
                                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                                title="Clear all products from catalog"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-600" /> Clear Catalog
                              </button>
                            )}
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

                  {/* ⚡ REAL-TIME SYSTEM & REQUEST OBSERVABILITY LOGGER FOR THIS CLIENT */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
                    {/* Logger Header */}
                    <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 tracking-tight">
                          <Activity className="w-5 h-5 text-purple-600 animate-pulse" />
                          <span>Live System Observability & Activity Logger</span>
                          <span className="px-2.5 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-black rounded-full uppercase font-mono">
                            Client #{selectedTenant.clientNumber}
                          </span>
                        </h2>
                        <p className="text-xs text-slate-500 font-medium mt-1">
                          Real-time live monitoring of incoming WhatsApp messages, AI turn outputs, STT voice transcripts, orders, and system health alerts for <span className="font-bold text-slate-800">{selectedTenant.name}</span>.
                        </p>
                      </div>

                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => setLogAutoRefresh(!logAutoRefresh)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 border cursor-pointer ${
                            logAutoRefresh
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${logAutoRefresh ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`} />
                          <span>{logAutoRefresh ? 'Live Auto-Polling (4s)' : 'Polling Paused'}</span>
                        </button>

                        <button
                          onClick={fetchSystemLogs}
                          disabled={isFetchingLogs}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 shadow-sm transition cursor-pointer"
                        >
                          <RefreshCw className={`w-4 h-4 ${isFetchingLogs ? 'animate-spin' : ''}`} />
                          <span>Refresh Now</span>
                        </button>
                      </div>
                    </div>

                    {/* 3-Column Grid: Main Logs (2 Cols) + Side Error Panel (1 Col) */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                      {/* Left 2 Columns: Live System Stream & Filters */}
                      <div className="lg:col-span-2 space-y-4">
                        {/* Filters Bar */}
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
                            {/* Search Query */}
                            <div className="relative flex-1 min-w-[160px]">
                              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                placeholder="Search phone, text, tool..."
                                value={logSearchQuery}
                                onChange={e => setLogSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                              />
                            </div>

                            {/* Filter by Log Type */}
                            <select
                              value={logTypeFilter}
                              onChange={e => setLogTypeFilter(e.target.value)}
                              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                            >
                              <option value="all">⚡ All Log Types</option>
                              <option value="WHATSAPP_MESSAGE">💬 WhatsApp Messages</option>
                              <option value="TOOL_EXECUTION">🛠 Tool Executions</option>
                              <option value="STT_TRANSCRIPTION">🎙 Voice STT</option>
                              <option value="ORDER_CREATED">📦 Orders</option>
                              <option value="API_ALERT">🚨 API Health Alerts</option>
                            </select>

                            {/* Filter by Severity */}
                            <select
                              value={logLevelFilter}
                              onChange={e => setLogLevelFilter(e.target.value)}
                              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                            >
                              <option value="all">🎯 All Severities</option>
                              <option value="info">ℹ️ Info</option>
                              <option value="success">✅ Success</option>
                              <option value="warn">⚠️ Warning</option>
                              <option value="error">❌ Error</option>
                            </select>
                          </div>
                        </div>

                        {/* Log Stream List */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
                          {systemLogs.length === 0 ? (
                            <div className="p-10 text-center space-y-3">
                              <Activity className="w-10 h-10 text-slate-300 mx-auto animate-pulse" />
                              <h4 className="text-sm font-bold text-slate-700">No Activity Logs Found</h4>
                              <p className="text-xs text-slate-400">Incoming WhatsApp customer turns and system events for this client will appear here in real-time.</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-slate-100">
                              {systemLogs
                                .filter(l => 
                                  !logSearchQuery || 
                                  l.summary?.toLowerCase().includes(logSearchQuery.toLowerCase()) || 
                                  l.phone?.includes(logSearchQuery) ||
                                  l.query?.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
                                  l.response?.toLowerCase().includes(logSearchQuery.toLowerCase())
                                )
                                .map((log) => {
                                  const isError = log.level === 'error';
                                  const isWarn = log.level === 'warn';
                                  const isSuccess = log.level === 'success';

                                  return (
                                    <div
                                      key={`client-setup-log-${log.id}`}
                                      onClick={() => setSelectedLogEntry(log)}
                                      className="p-3.5 hover:bg-slate-50/80 transition-colors cursor-pointer space-y-1.5 group"
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center space-x-2">
                                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                            log.type === 'WHATSAPP_MESSAGE' ? 'bg-purple-100 text-purple-800' :
                                            log.type === 'TOOL_EXECUTION' ? 'bg-indigo-100 text-indigo-800' :
                                            log.type === 'ORDER_CREATED' ? 'bg-emerald-100 text-emerald-800' :
                                            log.type === 'STT_TRANSCRIPTION' ? 'bg-cyan-100 text-cyan-800' :
                                            'bg-rose-100 text-rose-800'
                                          }`}>
                                            {log.type.replace('_', ' ')}
                                          </span>

                                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                            isError ? 'bg-rose-600 text-white' :
                                            isWarn ? 'bg-amber-500 text-white' :
                                            isSuccess ? 'bg-emerald-600 text-white' :
                                            'bg-slate-200 text-slate-700'
                                          }`}>
                                            {log.level}
                                          </span>

                                          {log.phone && (
                                            <span className="text-xs font-mono font-semibold text-slate-600">
                                              {log.phone}
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-400">
                                          <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                                          <span className="text-purple-600 font-bold group-hover:underline">Inspect →</span>
                                        </div>
                                      </div>

                                      <p className="text-xs font-semibold text-slate-800">
                                        {log.summary}
                                      </p>

                                      {log.query && (
                                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/60 text-[11px] font-mono text-slate-700">
                                          <span className="font-bold text-slate-400 uppercase text-[9px] block">User Input:</span>
                                          {log.query}
                                        </div>
                                      )}

                                      {log.response && (
                                        <div className="bg-purple-50/50 p-2 rounded-lg border border-purple-100 text-[11px] font-mono text-slate-800">
                                          <span className="font-bold text-purple-500 uppercase text-[9px] block">AI Output:</span>
                                          {log.response}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Column: LIVE ERROR & ALERT SIDEBAR DRAWER */}
                      <div className="space-y-4">
                        <div className="bg-slate-50/70 p-4 rounded-2xl border border-rose-200/80 space-y-3">
                          <div className="flex items-center justify-between pb-2 border-b border-rose-100">
                            <div className="flex items-center space-x-2">
                              <AlertCircle className="w-4 h-4 text-rose-600 animate-bounce" />
                              <h3 className="text-xs font-bold text-slate-900">Recent Errors & System Alerts</h3>
                            </div>
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-700 font-extrabold text-[9px] rounded-full uppercase font-mono">
                              {systemLogs.filter(l => l.level === 'error' || l.level === 'warn').length} Issues
                            </span>
                          </div>

                          <p className="text-[10px] text-slate-500 font-medium leading-tight">
                            Live alerts showing runtime failures, API rate limits, or missing tool payload details for this client setup.
                          </p>

                          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                            {systemLogs.filter(l => l.level === 'error' || l.level === 'warn').length === 0 ? (
                              <div className="p-5 text-center bg-emerald-50/60 rounded-xl border border-emerald-200/80 space-y-1">
                                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                                <div className="text-xs font-bold text-emerald-900">0 Active Client Errors</div>
                                <div className="text-[10px] text-emerald-700">Client AI agent operating smoothly.</div>
                              </div>
                            ) : (
                              systemLogs
                                .filter(l => l.level === 'error' || l.level === 'warn')
                                .map((errLog) => (
                                  <div
                                    key={`setup-side-err-${errLog.id}`}
                                    onClick={() => setSelectedLogEntry(errLog)}
                                    className="p-3 bg-rose-50/80 hover:bg-rose-100/80 border border-rose-200 rounded-xl transition cursor-pointer space-y-1 group"
                                  >
                                    <div className="flex items-center justify-between text-[9px] font-mono font-bold">
                                      <span className="text-rose-700 uppercase bg-rose-200/80 px-1.5 py-0.5 rounded">
                                        {errLog.level} • {errLog.type.replace('_', ' ')}
                                      </span>
                                      <span className="text-slate-500">{new Date(errLog.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                    <div className="text-xs font-bold text-slate-900 group-hover:text-rose-700 line-clamp-2">
                                      {errLog.summary}
                                    </div>
                                    {errLog.phone && (
                                      <div className="text-[10px] text-slate-500 font-mono">
                                        +{errLog.phone}
                                      </div>
                                    )}
                                  </div>
                                ))
                            )}
                          </div>
                        </div>
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
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => {
                                  const updated: Partner[] = partners.map(item => {
                                    if (item.id === p.id) {
                                      const nextAccess: 'read_write' | 'view_only' = item.accessLevel === 'read_write' ? 'view_only' : 'read_write';
                                      return { ...item, accessLevel: nextAccess };
                                    }
                                    return item;
                                  });
                                  persistTenants(tenants, updated);
                                }}
                                className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
                              >
                                Toggle Access
                              </button>

                              <button
                                onClick={() => {
                                  const loginUrl = typeof window !== 'undefined' ? `${window.location.origin}/login?portal=admin` : 'https://hazelwhat-production.up.railway.app/login?portal=admin';
                                  const credsText = `🔐 HazelWhat Admin Team Member Login\nPortal Link: ${loginUrl}\nEmail/Username: ${p.email}\nPassword: ${p.password || 'AdminPass123'}\nAccess Level: ${p.accessLevel === 'read_write' ? 'Full Read/Write' : 'View Only'}`;
                                  navigator.clipboard.writeText(credsText);
                                  setCopiedCredsNotice(`Login Credentials for ${p.name} copied!`);
                                  setTimeout(() => setCopiedCredsNotice(null), 3000);
                                }}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1"
                              >
                                <span>Copy Pass</span>
                              </button>

                              {p.email !== 'admin@hazelwhat.com' && (
                                <button
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to remove admin access for ${p.name}?`)) {
                                      const updated = partners.filter(item => item.id !== p.id);
                                      persistTenants(tenants, updated);
                                    }
                                  }}
                                  className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title="Remove Admin Member"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ================= TAB 4: SYSTEM SETTINGS ================= */}
          {activeTab === 'settings' && (
            <div className="space-y-8 animate-in fade-in">
              <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 tracking-tight">
                    <Settings className="w-6 h-6 text-purple-600" />
                    <span>Admin System & Platform Settings</span>
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Manage global platform defaults, backend service connections, and administrative security.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/80 space-y-3">
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <Key className="w-4 h-4 text-purple-600" />
                      <span>Shared Backend API Keys</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      All client portals share central backend environment API keys (`DEEPGRAM_API_KEY`, `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`).
                    </p>
                    <div className="pt-2">
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg inline-flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5" /> Backend Environment Keys Active
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/80 space-y-3">
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-purple-600" />
                      <span>Database & Supabase Status</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Supabase Cloud Database connected for multi-tenant isolation, chat persistence, and order tracking.
                    </p>
                    <div className="pt-2">
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-lg inline-flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-purple-600" /> Supabase Realtime Sync OK
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold">HazelWhat Multi-Tenant AI Platform v1.2</span>
                  <button
                    onClick={handleAdminLogout}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Log Out of Admin Console</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 5: SYSTEM & REQUEST LOGGER ================= */}
          {activeTab === 'logs' && (
            <div className="space-y-6 animate-in fade-in">
              {/* Header Bar */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 tracking-tight">
                    <Activity className="w-6 h-6 text-purple-600 animate-pulse" />
                    <span>Live System & Request Observability Logger</span>
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Real-time monitoring of all incoming WhatsApp customer messages, AI turns, STT audio transcripts, tool calls, and API health alerts.
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  {/* Auto-Refresh Toggle */}
                  <button
                    onClick={() => setLogAutoRefresh(!logAutoRefresh)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 border cursor-pointer ${
                      logAutoRefresh
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${logAutoRefresh ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`} />
                    <span>{logAutoRefresh ? 'Live Auto-Polling (4s)' : 'Polling Paused'}</span>
                  </button>

                  <button
                    onClick={fetchSystemLogs}
                    disabled={isFetchingLogs}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 shadow-sm transition cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${isFetchingLogs ? 'animate-spin' : ''}`} />
                    <span>Refresh Now</span>
                  </button>
                </div>
              </div>

              {/* 3-Column Grid: Main Logs (2 Cols) + Side Error Panel (1 Col) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left 2 Columns: Live System Stream & Filters */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Filters Bar */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                      {/* Search Query */}
                      <div className="relative flex-1 min-w-[180px]">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Search phone, text, tool..."
                          value={logSearchQuery}
                          onChange={e => setLogSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      {/* Filter by Log Type */}
                      <select
                        value={logTypeFilter}
                        onChange={e => setLogTypeFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                      >
                        <option value="all">⚡ All Log Types</option>
                        <option value="WHATSAPP_MESSAGE">💬 WhatsApp Messages</option>
                        <option value="TOOL_EXECUTION">🛠 Tool Executions</option>
                        <option value="STT_TRANSCRIPTION">🎙 Voice STT</option>
                        <option value="ORDER_CREATED">📦 Orders</option>
                        <option value="API_ALERT">🚨 API Health Alerts</option>
                      </select>

                      {/* Filter by Severity */}
                      <select
                        value={logLevelFilter}
                        onChange={e => setLogLevelFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                      >
                        <option value="all">🎯 All Severities</option>
                        <option value="info">ℹ️ Info</option>
                        <option value="success">✅ Success</option>
                        <option value="warn">⚠️ Warning</option>
                        <option value="error">❌ Error</option>
                      </select>
                    </div>
                  </div>

                  {/* Log Stream List */}
                  <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                    {systemLogs.length === 0 ? (
                      <div className="p-12 text-center space-y-3">
                        <Activity className="w-12 h-12 text-slate-300 mx-auto animate-pulse" />
                        <h4 className="text-base font-bold text-slate-700">No System Logs Found</h4>
                        <p className="text-xs text-slate-400">Incoming WhatsApp messages, AI turn executions, and API health alerts will appear here in real-time.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {systemLogs
                          .filter(l => 
                            !logSearchQuery || 
                            l.summary?.toLowerCase().includes(logSearchQuery.toLowerCase()) || 
                            l.phone?.includes(logSearchQuery) ||
                            l.query?.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
                            l.response?.toLowerCase().includes(logSearchQuery.toLowerCase())
                          )
                          .map((log) => {
                            const isError = log.level === 'error';
                            const isWarn = log.level === 'warn';
                            const isSuccess = log.level === 'success';

                            return (
                              <div
                                key={log.id}
                                onClick={() => setSelectedLogEntry(log)}
                                className="p-4 hover:bg-slate-50/80 transition-colors cursor-pointer space-y-2 group"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center space-x-2.5">
                                    {/* Type Badge */}
                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                      log.type === 'WHATSAPP_MESSAGE' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                                      log.type === 'TOOL_EXECUTION' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                                      log.type === 'ORDER_CREATED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                      log.type === 'STT_TRANSCRIPTION' ? 'bg-cyan-100 text-cyan-800 border border-cyan-200' :
                                      'bg-rose-100 text-rose-800 border border-rose-200'
                                    }`}>
                                      {log.type.replace('_', ' ')}
                                    </span>

                                    {/* Level Badge */}
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                      isError ? 'bg-rose-600 text-white' :
                                      isWarn ? 'bg-amber-500 text-white' :
                                      isSuccess ? 'bg-emerald-600 text-white' :
                                      'bg-slate-200 text-slate-700'
                                    }`}>
                                      {log.level}
                                    </span>

                                    {/* Business Name & Phone */}
                                    <span className="text-xs font-bold text-slate-900">
                                      {log.businessName || 'System'}
                                    </span>

                                    {log.phone && (
                                      <span className="text-xs font-mono font-semibold text-slate-500">
                                        • {log.phone}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-400">
                                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                                    <span className="text-purple-600 font-bold group-hover:underline">Inspect Details →</span>
                                  </div>
                                </div>

                                <p className="text-xs font-semibold text-slate-800">
                                  {log.summary}
                                </p>

                                {log.query && (
                                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 text-xs font-mono text-slate-700">
                                    <span className="font-bold text-slate-400 uppercase text-[10px] block mb-0.5">User Input:</span>
                                    {log.query}
                                  </div>
                                )}

                                {log.response && (
                                  <div className="bg-purple-50/50 p-2.5 rounded-xl border border-purple-100 text-xs font-mono text-slate-800">
                                    <span className="font-bold text-purple-500 uppercase text-[10px] block mb-0.5">AI Agent Output:</span>
                                    {log.response}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: LIVE ERROR & ALERT SIDEBAR DRAWER */}
                <div className="space-y-4">
                  <div className="bg-white p-5 rounded-3xl border border-rose-200/80 shadow-sm space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-rose-100">
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="w-5 h-5 text-rose-600 animate-bounce" />
                        <h3 className="text-sm font-bold text-slate-900">Recent Errors & System Alerts</h3>
                      </div>
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-700 font-extrabold text-[10px] rounded-full uppercase font-mono">
                        {systemLogs.filter(l => l.level === 'error' || l.level === 'warn').length} Issues
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                      Instant side screen highlighting runtime errors, API rate limits, tool execution failures, or system alerts by exact minute & timestamp.
                    </p>

                    <div className="space-y-2.5 max-h-[550px] overflow-y-auto pr-1">
                      {systemLogs.filter(l => l.level === 'error' || l.level === 'warn').length === 0 ? (
                        <div className="p-6 text-center bg-emerald-50/60 rounded-2xl border border-emerald-200/80 space-y-1">
                          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                          <div className="text-xs font-bold text-emerald-900">0 Active System Errors</div>
                          <div className="text-[10px] text-emerald-700">All system components and client WhatsApp agents are operating smoothly.</div>
                        </div>
                      ) : (
                        systemLogs
                          .filter(l => l.level === 'error' || l.level === 'warn')
                          .map((errLog) => (
                            <div
                              key={`admin-side-err-${errLog.id}`}
                              onClick={() => setSelectedLogEntry(errLog)}
                              className="p-3.5 bg-rose-50/80 hover:bg-rose-100/80 border border-rose-200 rounded-2xl transition cursor-pointer space-y-1.5 group"
                            >
                              <div className="flex items-center justify-between text-[10px] font-mono font-bold">
                                <span className="text-rose-700 uppercase bg-rose-200/80 px-1.5 py-0.5 rounded">
                                  {errLog.level} • {errLog.type.replace('_', ' ')}
                                </span>
                                <span className="text-slate-500">{new Date(errLog.timestamp).toLocaleTimeString()}</span>
                              </div>
                              <div className="text-xs font-bold text-slate-900 group-hover:text-rose-700 line-clamp-2">
                                {errLog.summary}
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                                <span>{errLog.businessName || 'System'}</span>
                                {errLog.phone && <span>+{errLog.phone}</span>}
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </div>

              </div>

              {/* Log Detail Inspector Modal */}
              {selectedLogEntry && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <span className="text-[10px] font-mono font-bold text-purple-600 uppercase">Log Entry Payload Inspector</span>
                        <h3 className="text-base font-bold text-slate-900">{selectedLogEntry.summary}</h3>
                      </div>
                      <button
                        onClick={() => setSelectedLogEntry(null)}
                        className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                      <div className="grid grid-cols-2 gap-3 text-xs font-mono bg-slate-50 p-3 rounded-2xl border border-slate-200">
                        <div>
                          <span className="text-slate-400 font-bold block text-[10px]">TIMESTAMP</span>
                          <span className="text-slate-900 font-bold">{new Date(selectedLogEntry.timestamp).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold block text-[10px]">EVENT TYPE</span>
                          <span className="text-purple-600 font-bold">{selectedLogEntry.type}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold block text-[10px]">CLIENT / TENANT</span>
                          <span className="text-slate-900 font-bold">{selectedLogEntry.businessName} ({selectedLogEntry.tenantId || 'global'})</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold block text-[10px]">CUSTOMER PHONE</span>
                          <span className="text-slate-900 font-bold">{selectedLogEntry.phone || 'N/A'}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">Raw JSON Payload & Traces</span>
                        <pre className="bg-slate-950 text-emerald-400 p-4 rounded-2xl text-[11px] font-mono overflow-x-auto max-h-72 border border-slate-800 leading-relaxed">
                          {JSON.stringify(selectedLogEntry.details || selectedLogEntry, null, 2)}
                        </pre>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={() => setSelectedLogEntry(null)}
                        className="px-5 py-2.5 bg-purple-600 text-white font-bold rounded-xl text-xs shadow-md shadow-purple-600/20 cursor-pointer"
                      >
                        Close Inspector
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 6: CENTRAL OBSERVABILITY & ERROR CENTER ================= */}
          {activeTab === 'observability' && (
            <div className="space-y-8 animate-in fade-in">
              {/* Header Banner */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 tracking-tight">
                    <ShieldAlert className="w-6 h-6 text-purple-600" />
                    <span>Observability Operations Dashboard</span>
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Centralized console for system errors, trace investigation, multi-tenant billing auditing, and circuit breaker status.
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  {/* Time Range Selector */}
                  <div className="bg-slate-100 p-1 rounded-xl flex items-center space-x-1 border border-slate-200/80">
                    {(['24h', '7d', '30d'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => { setObsTimeframe(t); setObsPage(1); }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          obsTimeframe === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {t === '24h' ? '24 Hours' : t === '7d' ? '7 Days' : '30 Days'}
                      </button>
                    ))}
                  </div>

                  {/* Auto-Refresh Toggle */}
                  <button
                    onClick={() => setObsAutoRefresh(!obsAutoRefresh)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 border cursor-pointer ${
                      obsAutoRefresh
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${obsAutoRefresh ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`} />
                    <span>{obsAutoRefresh ? 'Auto-Polling (5s)' : 'Polling Paused'}</span>
                  </button>

                  <button
                    onClick={() => { fetchObsMetrics(); fetchObsGroups(); }}
                    disabled={isFetchingObsMetrics || isFetchingObsGroups}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 shadow-sm transition cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${isFetchingObsMetrics || isFetchingObsGroups ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* 4 Metric Cards Grid (Real database counters) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Card 1: Total Recorded Errors */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 px-2 py-0.5 bg-rose-50 rounded-full">
                      Errors (Real Data)
                    </span>
                    <ShieldAlert className="w-5 h-5 text-rose-600" />
                  </div>
                  <div className="mt-6">
                    <p className="text-xs font-semibold text-slate-400">Total Recorded Errors</p>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
                      {obsMetrics?.metrics?.totalErrors ?? 0}
                    </h2>
                  </div>
                </div>

                {/* Card 2: Unresolved Error Groups */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 px-2 py-0.5 bg-amber-50 rounded-full">
                      Unresolved Groups
                    </span>
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="mt-6">
                    <p className="text-xs font-semibold text-slate-400">Active Unresolved Issues</p>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
                      {obsMetrics?.metrics?.unresolvedErrors ?? 0}
                    </h2>
                  </div>
                </div>

                {/* Card 3: Total LLM Calls */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 px-2 py-0.5 bg-purple-50 rounded-full">
                      LLM Calls
                    </span>
                    <Bot className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="mt-6">
                    <p className="text-xs font-semibold text-slate-400">Total LLM Invocations</p>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
                      {obsMetrics?.metrics?.totalLlmCalls ?? 0}
                    </h2>
                  </div>
                </div>

                {/* Card 4: Total LLM Cost */}
                <div className="bg-purple-600 text-white rounded-3xl p-6 shadow-xl shadow-purple-600/20 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 text-purple-100 px-2 py-0.5 rounded-full">
                      LLM Ledger
                    </span>
                    <DollarSign className="w-5 h-5 text-purple-200" />
                  </div>
                  <div className="mt-6">
                    <p className="text-xs font-medium text-purple-100">Estimated LLM Cost</p>
                    <h2 className="text-2xl font-bold tracking-tight mt-1">
                      ${(obsMetrics?.metrics?.totalLlmCost ?? 0).toFixed(4)}
                    </h2>
                  </div>
                </div>
              </div>

              {/* Scale & Reliability Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Active Sessions */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 px-2 py-0.5 bg-teal-50 rounded-full">
                      WhatsApp Sessions
                    </span>
                    <Smartphone className="w-5 h-5 text-teal-600" />
                  </div>
                  <div className="mt-6">
                    <p className="text-xs font-semibold text-slate-400">Active Tenant Sessions</p>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
                      {obsMetrics?.metrics?.activeSessionsCount ?? 0} <span className="text-xs text-slate-400 font-semibold">/ {obsMetrics?.metrics?.whatsappSessions?.length ?? 0}</span>
                    </h2>
                  </div>
                </div>

                {/* Queue Length */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 px-2 py-0.5 bg-indigo-50 rounded-full">
                      Worker Queue Length
                    </span>
                    <Layers className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="mt-6">
                    <p className="text-xs font-semibold text-slate-400">Queue Jobs (BullMQ + Mem)</p>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
                      {obsMetrics?.metrics?.queueLength ?? 0} <span className="text-xs text-slate-400 font-semibold">{obsMetrics?.metrics?.queueMetrics?.isRedisConnected ? '(Redis)' : '(In-Memory)'}</span>
                    </h2>
                  </div>
                </div>

                {/* Rate Limiting */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 px-2 py-0.5 bg-amber-50 rounded-full">
                      Rate Limits
                    </span>
                    <Percent className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="mt-6">
                    <p className="text-xs font-semibold text-slate-400">Quota Alerts (last min)</p>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
                      {obsMetrics?.metrics?.rateLimitWarningsPerMin ?? 0} <span className="text-xs text-slate-400 font-semibold">dropped</span>
                    </h2>
                  </div>
                </div>

                {/* DB Connection Health */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 px-2 py-0.5 bg-sky-50 rounded-full">
                      DB Pool Health
                    </span>
                    <Database className="w-5 h-5 text-sky-600" />
                  </div>
                  <div className="mt-6">
                    <p className="text-xs font-semibold text-slate-400">Connection Pool Status</p>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-1 capitalize">
                      {obsMetrics?.metrics?.dbConnectionPoolHealth ?? 'healthy'}
                    </h2>
                  </div>
                </div>
              </div>

              {/* API Health & Circuits Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Circuit Breakers */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 lg:col-span-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-purple-600" />
                      <span>AI Engine Circuit Breaker Status</span>
                    </h3>
                    <button
                      onClick={resetCircuitBreakers}
                      disabled={isResettingCircuits}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-600 hover:text-rose-700 border border-rose-200 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer flex items-center gap-1"
                    >
                      {isResettingCircuits ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Resetting...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3 h-3" />
                          <span>Reset All Circuits</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {apiHealth?.circuits && Object.keys(apiHealth.circuits).length > 0 ? (
                      Object.entries(apiHealth.circuits).map(([provider, circ]: [string, any]) => {
                        const status = circ.status || 'CLOSED';
                        const failures = circ.failures || 0;
                        const lastFailure = circ.lastFailure;
                        return (
                          <div key={provider} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                            <div>
                              <div className="font-bold text-xs text-slate-900 capitalize">{provider} API Circuit</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">Failures: {failures} / 5</div>
                              {lastFailure && (
                                <div className="text-[9px] text-rose-500 font-mono mt-1">
                                  Last: {new Date(lastFailure).toLocaleTimeString()}
                                </div>
                              )}
                            </div>
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                              status === 'OPEN' ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse' :
                              status === 'HALF-OPEN' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                              'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}>
                              {status}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="col-span-2 text-xs text-slate-400 p-4 text-center">
                        No circuit breakers active. Normal operations.
                      </div>
                    )}
                  </div>
                </div>

                {/* API Endpoint Health Status (Deepgram & LLM keys) */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-purple-600" />
                    <span>External Provider Pings</span>
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-600">Deepgram Voice:</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                        apiHealth?.deepgram?.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {apiHealth?.deepgram?.ok ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-600">LLM Provider API:</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                        apiHealth?.llm?.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {apiHealth?.llm?.ok ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Unavailable / Not-Implemented Metrics (Truthfulness Requirement) */}
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200/80 space-y-4">
                <div className="flex items-center space-x-2 text-slate-500">
                  <Clock className="w-5 h-5 text-slate-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider">Unavailable Metrics & Future Instrumentation</h3>
                </div>
                <p className="text-[11px] text-slate-400 max-w-2xl leading-relaxed">
                  The following system-wide telemetry parameters are NOT recorded in the Supabase operational database schema to prevent database load and concurrency bottlenecks. These are marked as <span className="font-bold text-rose-600">Unavailable (Not Implemented)</span>:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {obsMetrics?.notImplemented ? (
                    Object.entries(obsMetrics.notImplemented).map(([metric, explanation]: [string, any]) => (
                      <div key={metric} className="p-3 bg-white rounded-xl border border-slate-200 text-left">
                        <div className="font-mono text-[10px] font-black text-rose-600 uppercase">{metric.replace(/([A-Z])/g, ' $1')}</div>
                        <div className="text-[10px] text-slate-400 font-semibold mt-0.5">UNAVAILABLE (LOG DRAIN ONLY)</div>
                        <div className="text-[10px] text-slate-400 mt-1">{explanation}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-[11px] text-slate-400">Loading instrumentation mappings...</div>
                  )}
                </div>
              </div>

              {/* Main Workspace split: LLM Cost Ledger (Left) + Tenant Error Counts (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* LLM Pricing / usage Ledger breakdown */}
                <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-purple-600" />
                    <span>LLM Model Billing Ledger</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Aggregated token count and estimated cost per model, loaded from transactional logs.
                  </p>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-semibold">
                      <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="p-3">Model</th>
                          <th className="p-3 text-right">Calls</th>
                          <th className="p-3 text-right">Input Tokens</th>
                          <th className="p-3 text-right">Output Tokens</th>
                          <th className="p-3 text-right">Est. Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {obsMetrics?.metrics?.callsByModel && Object.keys(obsMetrics.metrics.callsByModel).length > 0 ? (
                          Object.entries(obsMetrics.metrics.callsByModel).map(([model, count]: [string, any]) => {
                            return (
                              <tr key={model}>
                                <td className="p-3 font-mono text-[11px] text-slate-900">
                                  {model}
                                </td>
                                <td className="p-3 text-right font-mono">{count}</td>
                                <td className="p-3 text-right text-slate-400 font-mono">-</td>
                                <td className="p-3 text-right text-slate-400 font-mono">-</td>
                                <td className="p-3 text-right font-mono text-purple-600 font-bold">
                                  -
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-slate-400">
                              No LLM usage records for selected timeframe.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Tenant Error Distributions */}
                <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-600" />
                    <span>Tenant Health Distribution</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Overview of error and LLM calling distributions across active platform tenants.
                  </p>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-semibold">
                      <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="p-3">Tenant ID / Name</th>
                          <th className="p-3 text-right">Errors</th>
                          <th className="p-3 text-right">LLM Calls</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {tenants.map((t) => {
                          const errorsCount = obsMetrics?.metrics?.errorsByTenant?.[t.id] ?? 0;
                          const llmCount = obsMetrics?.metrics?.llmUsageByTenant?.[t.id]?.calls ?? 0;
                          return (
                            <tr key={t.id} className="hover:bg-slate-50/50">
                              <td className="p-3">
                                <div className="font-bold text-slate-900">{t.businessName || t.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono font-medium">{t.id}</div>
                              </td>
                              <td className="p-3 text-right">
                                <span className={`font-mono px-2 py-0.5 rounded-lg ${errorsCount > 0 ? 'bg-rose-50 text-rose-600 font-bold' : 'text-slate-400'}`}>
                                  {errorsCount}
                                </span>
                              </td>
                              <td className="p-3 text-right font-mono text-slate-900">{llmCount}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* ================= ERROR CENTER & LIFE CYCLE MANAGEMENT ================= */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Application Error Center</h3>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">Investigate, track, and resolve unique error fingerprints in production.</p>
                  </div>
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-black rounded-lg">
                    {obsTotalGroups} Error Groups Detected
                  </span>
                </div>

                {/* Filters Row */}
                <div className="p-4 border-b border-slate-100 bg-slate-50/20 flex flex-wrap items-center gap-3">
                  {/* Search input */}
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search fingerprint, error code, operation..."
                      value={obsSearchQuery}
                      onChange={(e) => setObsSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    />
                  </div>

                  {/* Severity Filter */}
                  <select
                    value={obsSeverityFilter}
                    onChange={(e) => { setObsSeverityFilter(e.target.value); setObsPage(1); }}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
                  >
                    <option value="">🎯 All Severities</option>
                    <option value="critical">🔴 Critical</option>
                    <option value="high">🟠 High</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="low">🔵 Low</option>
                  </select>

                  {/* Status Filter */}
                  <select
                    value={obsStatusFilter}
                    onChange={(e) => { setObsStatusFilter(e.target.value); setObsPage(1); }}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
                  >
                    <option value="">Status: All Lifecycle</option>
                    <option value="NEW">🆕 NEW</option>
                    <option value="ACKNOWLEDGED">👀 ACKNOWLEDGED</option>
                    <option value="INVESTIGATING">🔍 INVESTIGATING</option>
                    <option value="RESOLVED">✅ RESOLVED</option>
                    <option value="IGNORED">🔕 IGNORED</option>
                  </select>

                  {/* Service Filter */}
                  <select
                    value={obsServiceFilter}
                    onChange={(e) => { setObsServiceFilter(e.target.value); setObsPage(1); }}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
                  >
                    <option value="">Service: All Services</option>
                    <option value="whatsapp-worker">whatsapp-worker</option>
                    <option value="ai-service">ai-service</option>
                    <option value="billing-service">billing-service</option>
                    <option value="admin-portal">admin-portal</option>
                  </select>
                </div>

                {/* Error Groups List Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-4">Error Details</th>
                        <th className="p-4">Service / Operation</th>
                        <th className="p-4">Severity</th>
                        <th className="p-4 text-right">Occurrences</th>
                        <th className="p-4 text-right">Clients Affected</th>
                        <th className="p-4">Lifecycle Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {isFetchingObsGroups ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400">
                            <Loader2 className="w-6 h-6 animate-spin text-purple-600 mx-auto" />
                            <span className="text-xs font-bold block mt-2">Fetching error groups...</span>
                          </td>
                        </tr>
                      ) : obsGroups.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-12 text-center text-slate-400">
                            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-pulse" />
                            <h4 className="text-sm font-bold text-slate-900 mt-2">Zero matching errors found</h4>
                            <p className="text-xs text-slate-400 mt-1">Platform is running with 100% operational health for current filters.</p>
                          </td>
                        </tr>
                      ) : (
                        obsGroups.map((g) => {
                          const isCritical = g.severity === 'critical';
                          const isHigh = g.severity === 'high';
                          const isMedium = g.severity === 'medium';
                          return (
                            <tr key={g.id} className="hover:bg-slate-50/50 transition">
                              <td className="p-4 max-w-sm">
                                <div className="font-bold text-slate-900 line-clamp-1">{g.title}</div>
                                <div className="text-[10px] text-slate-400 font-mono mt-1 flex items-center gap-1.5">
                                  <span>Fingerprint:</span>
                                  <span className="bg-slate-100 px-1 py-0.5 rounded text-slate-600 font-semibold">{g.fingerprint.substring(0, 16)}...</span>
                                </div>
                              </td>
                              <td className="p-4 font-mono text-[11px]">
                                <div className="text-slate-900 font-bold">{g.service}</div>
                                <div className="text-slate-400">{g.operation || 'N/A'}</div>
                              </td>
                              <td className="p-4">
                                <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wide border ${
                                  isCritical ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                  isHigh ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                  isMedium ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                  'bg-blue-50 text-blue-700 border-blue-200'
                                }`}>
                                  {g.severity}
                                </span>
                              </td>
                              <td className="p-4 text-right font-mono font-bold text-slate-950">
                                {g.occurrenceCount}
                              </td>
                              <td className="p-4 text-right font-mono font-bold text-purple-600">
                                {g.affectedTenantCount}
                              </td>
                              <td className="p-4">
                                <select
                                  value={g.status}
                                  disabled={obsUpdatingStatusId === g.id}
                                  onChange={(e) => updateErrorGroupStatus(g.id, e.target.value)}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer border focus:outline-none ${
                                    g.status === 'RESOLVED' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                                    g.status === 'IGNORED' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                                    g.status === 'INVESTIGATING' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                                    g.status === 'ACKNOWLEDGED' ? 'bg-purple-50 text-purple-800 border-purple-200' :
                                    'bg-rose-50 text-rose-800 border-rose-200 animate-pulse'
                                  }`}
                                >
                                  <option value="NEW">🆕 NEW</option>
                                  <option value="ACKNOWLEDGED">👀 ACKNOWLEDGED</option>
                                  <option value="INVESTIGATING">🔍 INVESTIGATING</option>
                                  <option value="RESOLVED">✅ RESOLVED</option>
                                  <option value="IGNORED">🔕 IGNORED</option>
                                </select>
                              </td>
                              <td className="p-4 text-right">
                                <button
                                  onClick={() => {
                                    setSelectedErrorGroup(g);
                                    setErrorGroupDetail(null);
                                    setDrawerTenantFilter('');
                                    fetchErrorGroupDetail(g.id);
                                  }}
                                  className="px-3.5 py-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 text-[10px] font-bold rounded-xl transition cursor-pointer"
                                >
                                  Investigate
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {obsTotalGroups > obsLimit && (
                  <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <span className="text-xs text-slate-400 font-semibold">
                      Showing {(obsPage - 1) * obsLimit + 1} to {Math.min(obsPage * obsLimit, obsTotalGroups)} of {obsTotalGroups} groups
                    </span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setObsPage(p => Math.max(1, p - 1))}
                        disabled={obsPage === 1}
                        className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                      >
                        Previous
                      </button>
                      <span className="text-xs font-extrabold text-slate-900 font-mono">Page {obsPage}</span>
                      <button
                        onClick={() => setObsPage(p => p + 1)}
                        disabled={obsPage * obsLimit >= obsTotalGroups}
                        className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ================= ONE-CLICK ERROR GROUP INVESTIGATION DRAWER / MODAL ================= */}
              {selectedErrorGroup && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-end">
                  <div className="bg-white w-full max-w-4xl h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                    {/* Header */}
                    <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-mono font-black text-rose-600 uppercase bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          {selectedErrorGroup.severity} • {selectedErrorGroup.status}
                        </span>
                        <h3 className="text-lg font-bold text-slate-900 mt-1">{selectedErrorGroup.title}</h3>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">Fingerprint: {selectedErrorGroup.fingerprint}</p>
                      </div>
                      <button
                        onClick={() => { setSelectedErrorGroup(null); setErrorGroupDetail(null); }}
                        className="p-2 hover:bg-slate-200 rounded-xl text-slate-500 transition cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      {isFetchingGroupDetail ? (
                        <div className="py-20 text-center">
                          <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto" />
                          <p className="text-xs font-bold text-slate-500 mt-3">Re-constructing error trace details from the DB...</p>
                        </div>
                      ) : errorGroupDetail ? (
                        <>
                          {/* Overview Stats */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                            <div>
                              <span className="text-[10px] text-slate-400 font-black block uppercase">First Seen</span>
                              <span className="text-xs text-slate-900 font-bold font-mono">{new Date(errorGroupDetail.group.firstSeenAt).toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-black block uppercase">Last Seen</span>
                              <span className="text-xs text-slate-900 font-bold font-mono">{new Date(errorGroupDetail.group.lastSeenAt).toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-black block uppercase">Total Occurrences</span>
                              <span className="text-xs text-slate-900 font-bold font-mono">{errorGroupDetail.group.occurrenceCount} times</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-black block uppercase">Affected Clients</span>
                              <span className="text-xs text-slate-900 font-bold font-mono">{errorGroupDetail.group.affectedTenantCount} clients</span>
                            </div>
                          </div>

                          {/* Quick Lifecycle Action Bar */}
                          <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 flex flex-wrap items-center justify-between gap-3">
                            <span className="text-xs text-purple-800 font-bold">Update group status in real-time:</span>
                            <div className="flex items-center space-x-2">
                              {['NEW', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'IGNORED'].map((st) => (
                                <button
                                  key={st}
                                  onClick={() => updateErrorGroupStatus(errorGroupDetail.group.id, st)}
                                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wide border cursor-pointer transition ${
                                    errorGroupDetail.group.status === st
                                      ? 'bg-purple-600 text-white shadow-md'
                                      : 'bg-white text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  {st}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Tenant Specific Filter */}
                          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h4 className="text-sm font-extrabold text-slate-900">Occurrences & Request Traces</h4>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-400 font-bold uppercase">Filter by Client:</span>
                              <select
                                value={drawerTenantFilter}
                                onChange={(e) => {
                                  setDrawerTenantFilter(e.target.value);
                                  fetchErrorGroupDetail(errorGroupDetail.group.id, e.target.value);
                                }}
                                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 cursor-pointer"
                              >
                                <option value="">Show All Clients</option>
                                {errorGroupDetail.distinctTenants.map((tid: string) => {
                                  const name = tenants.find(t => t.id === tid)?.businessName || tid;
                                  return (
                                    <option key={tid} value={tid}>{name}</option>
                                  );
                                })}
                              </select>
                            </div>
                          </div>

                          {/* Occurrences list */}
                          <div className="space-y-4">
                            {errorGroupDetail.occurrences.length === 0 ? (
                              <div className="text-center p-6 text-slate-400 text-xs font-semibold">
                                No occurrences matched your filter criteria.
                              </div>
                            ) : (
                              errorGroupDetail.occurrences.map((occ: any, oIdx: number) => {
                                // Find any matching LLM call logs for this request ID
                                const relatedLlm = errorGroupDetail.relatedLLMUsage.filter((u: any) => u.requestId === occ.requestId);
                                return (
                                  <div key={occ.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-mono text-[10px] font-bold">#{oIdx + 1}</span>
                                        <span className="text-xs font-bold text-slate-900">{tenants.find(t => t.id === occ.tenantId)?.businessName || occ.tenantId}</span>
                                      </div>
                                      <span className="text-[10px] text-slate-400 font-mono">{new Date(occ.createdAt).toLocaleString()}</span>
                                    </div>

                                    {/* Identifiers */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white p-2.5 rounded-xl border border-slate-200/60 font-mono text-[10px] text-slate-600">
                                      <div><span className="text-slate-400 font-bold block text-[9px]">REQUEST ID</span>{occ.requestId}</div>
                                      <div><span className="text-slate-400 font-bold block text-[9px]">TRACE ID</span>{occ.traceId}</div>
                                      <div><span className="text-slate-400 font-bold block text-[9px]">CORRELATION ID</span>{occ.correlationId}</div>
                                    </div>

                                    {/* Normalized Message */}
                                    <div>
                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Normalized Error Message</span>
                                      <div className="bg-white p-3 rounded-xl border border-slate-200/60 text-xs text-slate-800 font-medium">
                                        {occ.normalizedMessage}
                                      </div>
                                    </div>

                                    {/* Stack Trace */}
                                    {occ.stackTrace && (
                                      <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Sanitized Stack Trace</span>
                                        <pre className="bg-slate-950 text-rose-400 p-3.5 rounded-xl text-[10px] font-mono overflow-x-auto max-h-40 border border-slate-900 leading-normal">
                                          {occ.stackTrace}
                                        </pre>
                                      </div>
                                    )}

                                    {/* Related LLM calls (Trace Timeline) */}
                                    {relatedLlm.length > 0 && (
                                      <div className="pt-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Request Execution Timeline (LLM calls)</span>
                                        <div className="space-y-2">
                                          {relatedLlm.map((llm: any, lIdx: number) => (
                                            <div key={llm.id} className="bg-white p-3 rounded-xl border border-purple-100 flex items-center justify-between text-[11px]">
                                              <div className="flex items-center space-x-2">
                                                <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-mono font-bold text-[10px]">
                                                  {lIdx}
                                                </span>
                                                <span className="font-bold text-slate-800 capitalize">{llm.provider}</span>
                                                <span className="font-mono text-slate-500 font-medium">({llm.model})</span>
                                              </div>
                                              <div className="flex items-center space-x-3 font-mono font-medium text-slate-500">
                                                <span>Tokens: {llm.inputTokens} In / {llm.outputTokens} Out</span>
                                                <span className="text-purple-600 font-bold">${llm.estimatedCost.toFixed(4)}</span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="py-20 text-center text-slate-400">
                          Failed to load details. Click Investigate again.
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end">
                      <button
                        onClick={() => { setSelectedErrorGroup(null); setErrorGroupDetail(null); }}
                        className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow"
                      >
                        Done Investigating
                      </button>
                    </div>
                  </div>
                </div>
              )}
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

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase mb-1.5 block">Initial Onboarding Mode</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewClientForm({ ...newClientForm, status: 'draft' })}
                    className={`p-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-2 ${
                      newClientForm.status === 'draft' ? 'bg-amber-50 text-amber-900 border-amber-300 shadow-sm ring-2 ring-amber-500/20' : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    <span>📝 Save as Draft</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewClientForm({ ...newClientForm, status: 'active' })}
                    className={`p-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-2 ${
                      newClientForm.status === 'active' ? 'bg-emerald-50 text-emerald-900 border-emerald-300 shadow-sm ring-2 ring-emerald-500/20' : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    <span>🟢 Publish Active</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 font-medium mt-1">
                  Draft mode allows setting up prompts & knowledge base before launching live with 1 click.
                </p>
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
                <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Initial Password</label>
                <input
                  type="text"
                  placeholder="e.g. AdminPass123 (or auto-generated)"
                  value={newAdminForm.password}
                  onChange={e => setNewAdminForm({ ...newAdminForm, password: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900"
                />
                <p className="text-[10px] text-slate-400 mt-1">Leave blank to auto-generate a secure random password.</p>
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

      {/* ================= MODAL: ADMIN CREATED & CREDENTIALS ================= */}
      {showAdminSuccessModal && createdAdminInfo && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl text-center space-y-6">
            <div className="w-14 h-14 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mx-auto">
              <UserCheck2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">New Admin Account Ready! 🎉</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                {createdAdminInfo.name} has been added to Team Admins with {createdAdminInfo.accessLevel === 'read_write' ? 'Full Read/Write' : 'View Only'} permissions.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400 font-bold uppercase">Admin Name:</span>
                <span className="text-xs font-bold text-slate-900">{createdAdminInfo.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400 font-bold uppercase">Email / Login ID:</span>
                <span className="text-xs font-mono font-bold text-slate-900">{createdAdminInfo.email}</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-200 pt-2">
                <span className="text-xs text-slate-400 font-bold uppercase">Assigned Password:</span>
                <span className="text-xs font-mono font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                  {createdAdminInfo.password}
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-200 pt-2">
                <span className="text-xs text-slate-400 font-bold uppercase">Admin Login Portal:</span>
                <span className="text-[11px] font-mono text-slate-600">/login?portal=admin</span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  const loginUrl = typeof window !== 'undefined' ? `${window.location.origin}/login?portal=admin` : 'https://hazelwhat-production.up.railway.app/login?portal=admin';
                  const text = `🔐 HazelWhat Admin Team Access Details\nPortal Link: ${loginUrl}\nEmail/Username: ${createdAdminInfo.email}\nPassword: ${createdAdminInfo.password}\nAccess Level: ${createdAdminInfo.accessLevel === 'read_write' ? 'Full Read/Write' : 'View Only'}`;
                  navigator.clipboard.writeText(text);
                  setCopiedCredsNotice('Admin Credentials & Invite Link Copied!');
                  setTimeout(() => setCopiedCredsNotice(null), 3000);
                }}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20 cursor-pointer flex items-center justify-center space-x-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Copy All Admin Credentials & Invite Link</span>
              </button>

              <button
                onClick={() => setShowAdminSuccessModal(false)}
                className="w-full py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
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
              {selectedTenant.email && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400 font-bold uppercase">Email / Login ID:</span>
                  <span className="text-xs font-mono font-bold text-slate-900">{selectedTenant.email}</span>
                </div>
              )}
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

      {/* ================= TOAST: GO LIVE SUCCESS ================= */}
      {showGoLiveToast && (
        <div className="fixed bottom-6 right-6 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-4 rounded-2xl shadow-2xl z-50 flex items-center space-x-3 animate-in fade-in slide-in-from-bottom-4">
          <Rocket className="w-6 h-6 text-emerald-200 animate-bounce" />
          <div>
            <h4 className="font-extrabold text-sm tracking-tight">Client Published Live! 🚀</h4>
            <p className="text-xs text-emerald-100 font-medium">Status switched to Active. Client portal & WhatsApp AI bot are now live.</p>
          </div>
        </div>
      )}

      {/* ================= MODAL: DELETE CLIENT CONFIRMATION ================= */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl text-center space-y-6">
            <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Delete Client Account?</h3>
              <p className="text-xs text-slate-500 font-medium mt-2 leading-relaxed">
                Are you sure you want to permanently delete <span className="font-bold text-slate-900">"{deletingTenantName}"</span>?
                <br /><br />
                <span className="text-rose-600 font-bold">⚠️ Warning:</span> This will permanently wipe all database chat history, customer lists, configs, orders, appointments, and disconnect their active WhatsApp session. This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeletingTenant}
                className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteTenant}
                disabled={isDeletingTenant}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 transition cursor-pointer flex items-center justify-center space-x-2"
              >
                {isDeletingTenant ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Permanently Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
