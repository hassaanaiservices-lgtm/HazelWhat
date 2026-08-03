'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Bot, 
  QrCode, 
  Smartphone, 
  BookOpen, 
  MessageSquare, 
  Activity, 
  LogOut, 
  Save, 
  Check, 
  RefreshCw, 
  ShieldCheck, 
  AlertCircle, 
  Sparkles, 
  CheckCircle2, 
  ShoppingBag, 
  Plus, 
  Trash2,
  Clock,
  Zap,
  Loader2,
  UserCheck,
  Building
} from 'lucide-react';
import { Tenant } from '@/lib/multitenant-store';

export default function ClientDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'knowledge' | 'chats' | 'quota'>('whatsapp');
  
  // WhatsApp Session State
  const [waStatus, setWaStatus] = useState<any>({ status: 'disconnected' });
  const [waLoading, setWaLoading] = useState(false);
  const [pairingPhone, setPairingPhone] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);

  // Knowledge Base State
  const [systemPrompt, setSystemPrompt] = useState('');
  const [knowledgeBase, setKnowledgeBase] = useState('');
  const [productKnowledge, setProductKnowledge] = useState('');
  const [savingKnowledge, setSavingKnowledge] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Chats state
  const [recentChats, setRecentChats] = useState<any[]>([]);

  // Authenticate session on load
  useEffect(() => {
    async function loadClientSession() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        if (!data.authenticated || !data.tenant) {
          router.push('/login');
          return;
        }
        setTenant(data.tenant);
        setSystemPrompt(data.tenant.systemPrompt || '');
        setKnowledgeBase(data.tenant.knowledgeBase || '');
        setProductKnowledge(data.tenant.productKnowledgeBase || '');
      } catch (err) {
        console.error('Session load error:', err);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }
    loadClientSession();
  }, [router]);

  // Fetch WhatsApp session status
  const fetchWaStatus = async () => {
    try {
      const res = await fetch('/api/whatsapp/session');
      if (res.ok) {
        const data = await res.json();
        if (data.session) {
          setWaStatus(data.session);
        }
      }
    } catch (err) {
      console.error('Error fetching WA status:', err);
    }
  };

  useEffect(() => {
    if (!loading && tenant) {
      fetchWaStatus();
      const interval = setInterval(fetchWaStatus, 4000);
      return () => clearInterval(interval);
    }
  }, [loading, tenant]);

  // Fetch recent chats
  const fetchChats = async () => {
    try {
      const res = await fetch('/api/whatsapp/chats');
      if (res.ok) {
        const data = await res.json();
        if (data.chats) {
          setRecentChats(data.chats);
        }
      }
    } catch (err) {
      console.error('Error fetching chats:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'chats') {
      fetchChats();
    }
  }, [activeTab]);

  // Start / Connect WhatsApp
  const handleStartWhatsApp = async () => {
    setWaLoading(true);
    try {
      await fetch('/api/whatsapp/session', { method: 'POST' });
      await fetchWaStatus();
    } catch (err) {
      console.error('Error starting WA session:', err);
    } finally {
      setWaLoading(false);
    }
  };

  // Request Pairing Code
  const handleRequestPairingCode = async () => {
    if (!pairingPhone) return;
    setPairingLoading(true);
    setPairingCode('');
    try {
      const res = await fetch('/api/whatsapp/pairing-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: pairingPhone })
      });
      const data = await res.json();
      if (data.success && data.pairingCode) {
        setPairingCode(data.pairingCode);
      } else {
        alert(data.error || 'Failed to generate pairing code');
      }
    } catch (err) {
      alert('Error requesting pairing code');
    } finally {
      setPairingLoading(false);
    }
  };

  // Save Knowledge Base Settings
  const handleSaveKnowledge = async () => {
    if (!tenant) return;
    setSavingKnowledge(true);
    setSaveSuccess(false);

    try {
      const updatedTenant = {
        ...tenant,
        systemPrompt,
        knowledgeBase,
        productKnowledgeBase: productKnowledge
      };

      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenants: [updatedTenant] })
      });

      if (res.ok) {
        setTenant(updatedTenant);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert('Failed to update knowledge base');
      }
    } catch (err) {
      alert('Error saving knowledge base');
    } finally {
      setSavingKnowledge(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (err) {
      router.push('/login');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100">
        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
          <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
          <span className="text-sm font-medium text-slate-300">Loading Client Dashboard...</span>
        </div>
      </div>
    );
  }

  if (!tenant) return null;

  const usedMinutesPercent = Math.min(100, Math.round((tenant.usedMinutes / (tenant.allocatedMinutes || 1)) * 100));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      
      {/* Top Navbar */}
      <header className="px-6 py-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Bot className="w-6 h-6 text-slate-950 font-bold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight">{tenant.businessName}</h1>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
                Client Portal
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span>Client #{tenant.clientNumber}</span> • <span>{tenant.name}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Badge */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950 border border-slate-800 text-xs">
            <div className={`w-2 h-2 rounded-full ${
              waStatus.status === 'connected' ? 'bg-emerald-400 animate-pulse' :
              waStatus.status === 'connecting' ? 'bg-amber-400 animate-spin' : 'bg-red-400'
            }`} />
            <span className="capitalize text-slate-300 font-medium">{waStatus.status}</span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-400" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Metric Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">WhatsApp Session</p>
              <h3 className="text-lg font-bold text-white capitalize mt-0.5 flex items-center gap-2">
                {waStatus.status}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Smartphone className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">AI Quota Minutes</p>
              <h3 className="text-lg font-bold text-white mt-0.5">
                {tenant.usedMinutes} / {tenant.allocatedMinutes} <span className="text-xs font-normal text-slate-400">min</span>
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Promotions Broadcast</p>
              <h3 className="text-lg font-bold text-white mt-0.5">{tenant.promotionsSent || 0}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Zap className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">Active Customer Leads</p>
              <h3 className="text-lg font-bold text-white mt-0.5">{tenant.conversationalLeadsCount || 0}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 space-x-1 sm:space-x-4">
          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'whatsapp' 
                ? 'border-emerald-400 text-emerald-400 bg-emerald-500/5' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Connect WhatsApp</span>
          </button>

          <button
            onClick={() => setActiveTab('knowledge')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'knowledge' 
                ? 'border-emerald-400 text-emerald-400 bg-emerald-500/5' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>AI Knowledge & Catalog</span>
          </button>

          <button
            onClick={() => setActiveTab('chats')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'chats' 
                ? 'border-emerald-400 text-emerald-400 bg-emerald-500/5' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Live Conversations</span>
          </button>

          <button
            onClick={() => setActiveTab('quota')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'quota' 
                ? 'border-emerald-400 text-emerald-400 bg-emerald-500/5' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Quota & Plan</span>
          </button>
        </div>

        {/* TAB 1: CONNECT WHATSAPP */}
        {activeTab === 'whatsapp' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-6">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-emerald-400" />
                    WhatsApp Device Linking
                  </h2>
                  <button
                    onClick={fetchWaStatus}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
                    title="Refresh status"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Scan the QR code below using your Business WhatsApp (Linked Devices) to pair your account.
                </p>
              </div>

              {/* QR Code Container */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[280px]">
                {waStatus.status === 'connected' ? (
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                      <CheckCircle2 className="w-8 h-8 animate-bounce" />
                    </div>
                    <h3 className="text-base font-bold text-white">WhatsApp Connected & Active!</h3>
                    <p className="text-xs text-slate-400">
                      Your business number <span className="text-emerald-400 font-semibold">{waStatus.phoneNumber || tenant.phoneNumber}</span> is actively connected to HazelWhat AI.
                    </p>
                  </div>
                ) : waStatus.qrCode ? (
                  <div className="text-center space-y-4">
                    <div className="p-3 bg-white rounded-2xl inline-block shadow-2xl">
                      {/* Render base64 image or QR image */}
                      <img src={waStatus.qrCode} alt="WhatsApp QR Code" className="w-52 h-52 object-contain" />
                    </div>
                    <p className="text-xs text-slate-300 font-medium">
                      Open WhatsApp on phone → Linked Devices → Link a Device → Point camera at screen.
                    </p>
                  </div>
                ) : (
                  <div className="text-center space-y-4">
                    <p className="text-xs text-slate-400">No active QR code generated yet.</p>
                    <button
                      onClick={handleStartWhatsApp}
                      disabled={waLoading}
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
                    >
                      {waLoading ? 'Generating QR Code...' : 'Generate WhatsApp QR Code'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Alternative Pairing Code */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-teal-400" />
                  Pair via Phone Number Code
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Prefer entering an 8-digit pairing code on your phone instead of camera scan?
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Enter WhatsApp Phone Number (with Country Code)
                  </label>
                  <input
                    type="text"
                    value={pairingPhone}
                    onChange={(e) => setPairingPhone(e.target.value)}
                    placeholder="e.g. +923001234567"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl py-3 px-4 text-sm text-slate-100 outline-none"
                  />
                </div>

                <button
                  onClick={handleRequestPairingCode}
                  disabled={pairingLoading || !pairingPhone}
                  className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {pairingLoading ? 'Requesting Code...' : 'Get 8-Digit Pairing Code'}
                </button>

                {pairingCode && (
                  <div className="p-4 bg-slate-950 border border-teal-500/40 rounded-2xl text-center space-y-2">
                    <p className="text-xs text-slate-400">Enter this code on your WhatsApp app:</p>
                    <div className="text-2xl font-mono font-bold tracking-widest text-teal-400">
                      {pairingCode}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AI KNOWLEDGE & CATALOG */}
        {activeTab === 'knowledge' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-emerald-400" />
                  Business FAQs & Bot Persona
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Customize what the AI bot knows about your business, products, prices, and response instructions.
                </p>
              </div>

              <button
                onClick={handleSaveKnowledge}
                disabled={savingKnowledge}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {savingKnowledge ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Saving...</span>
                  </>
                ) : saveSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-slate-950" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 text-slate-950" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>

            {saveSuccess && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-emerald-300 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Knowledge base saved successfully! AI bot updated in real-time.</span>
              </div>
            )}

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  System Prompt (Bot Tone & Identity Rules)
                </label>
                <textarea
                  rows={4}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="e.g. You are a helpful sales assistant for Royal Fashion Store. Be polite, concise, and answer in English/Urdu."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl p-4 text-sm text-slate-100 outline-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Business Knowledge Base & FAQs
                </label>
                <textarea
                  rows={6}
                  value={knowledgeBase}
                  onChange={(e) => setKnowledgeBase(e.target.value)}
                  placeholder="e.g. Store Location: Liberty Market Lahore. Timings: 11 AM - 10 PM. Delivery: Free shipping on orders above Rs 3000. Return policy: 7 days."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl p-4 text-sm text-slate-100 outline-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Product Catalog & Price List
                </label>
                <textarea
                  rows={5}
                  value={productKnowledge}
                  onChange={(e) => setProductKnowledge(e.target.value)}
                  placeholder="e.g. Item 1: Cotton Suit - Rs 4500 (Colors: Black, Blue). Item 2: Linen Shirt - Rs 2800."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl p-4 text-sm text-slate-100 outline-none leading-relaxed"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: LIVE CONVERSATIONS */}
        {activeTab === 'chats' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-emerald-400" />
                  Recent WhatsApp Customer Chats
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  View incoming messages and AI bot automated replies for your business.
                </p>
              </div>

              <button
                onClick={fetchChats}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="divide-y divide-slate-800/80">
              {recentChats.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  No active customer conversations logged yet.
                </div>
              ) : (
                recentChats.map((chat, idx) => (
                  <div key={idx} className="py-4 flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">{chat.name || chat.phone || 'Customer'}</h4>
                      <p className="text-xs text-slate-400 mt-1">{chat.lastMessage || 'No message content'}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 bg-slate-950 px-2 py-1 rounded-md border border-slate-800">
                      {chat.timestamp || 'Recent'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: QUOTA & PLAN */}
        {activeTab === 'quota' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" />
                Subscription Plan & Usage Meter
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Monitor your allocated AI response quota and billing status.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="text-slate-300">Allocated AI Minutes</span>
                <span className="text-emerald-400">{tenant.usedMinutes} / {tenant.allocatedMinutes} Minutes</span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800">
                <div 
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${usedMinutesPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-900">
                <span>Monthly Subscription Fee: <strong className="text-white">{tenant.currency} {tenant.monthlySubscriptionFee}</strong></span>
                <span>Payment Status: <strong className="text-emerald-400 uppercase">{tenant.paymentStatus}</strong></span>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-slate-800/40 text-center text-xs text-slate-400">
        Connected to HazelWhat AI Enterprise Server
      </footer>
    </div>
  );
}
