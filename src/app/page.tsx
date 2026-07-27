"use client";

import React, { useEffect, useState, useRef } from "react";
import { MessageCircle, QrCode, Loader2, CheckCircle2, ShieldCheck, Zap, X, Save, MessageSquare, Settings, Plus, Trash2, Search, MoreVertical, Phone, Video, Paperclip, Smile, Mic, CheckCheck, User, Check, Send, StopCircle, Inbox, Bot, Network, BookOpen, Users, AlertCircle, ShoppingCart, Activity, Eye, EyeOff } from "lucide-react";
import EmojiPicker from "emoji-picker-react";

export default function DashboardPage() {
  const [sessionData, setSessionData] = useState<any>(null);
  const [status, setStatus] = useState<"idle" | "creating" | "waiting_qr" | "scanning" | "connected" | "error">("idle");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const [chats, setChats] = useState<Record<string, any[]>>({});
  const [customers, setCustomers] = useState<Record<string, any>>({});
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [config, setConfig] = useState<any>({
    systemPrompt: "",
    productInfo: "",
    keywordReplies: [],
    enabledFeatures: [],
    globalAiEnabled: true 
  });
  
  const AVAILABLE_FEATURES = [
    "24/7 Instant Replies", "Knowledge Base Assistant", "Service Recommendation",
    "Price Inquiry", "Before & After Care Instructions", "Staff Recommendation", 
    "Branch Information", "Multi-language Support", "Lead Collection",
    "Smart Follow-ups", "Human Handoff", "Dashboard Integration",
    "Abandoned Booking Recovery", "FAQ Automation", "Analytics Dashboard"
  ];
  const [savingConfig, setSavingConfig] = useState(false);
  const [anthropicKeyStatus, setAnthropicKeyStatus] = useState<string>("Not Checked");
  const [anthropicKeyError, setAnthropicKeyError] = useState<string>("");
  const [openRouterKeyStatus, setOpenRouterKeyStatus] = useState<string>("Not Checked");
  const [openRouterKeyError, setOpenRouterKeyError] = useState<string>("");
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scrapeCurrency, setScrapeCurrency] = useState("Rs.");
  const [isScraping, setIsScraping] = useState(false);

  const [activeTab, setActiveTab] = useState<"dashboard" | "inbox" | "agents" | "channels" | "promotions" | "orders" | "knowledge" | "contacts" | "analytics" | "settings">("dashboard");
  const [orders, setOrders] = useState<any[]>([]);
  const [orderFilter, setOrderFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all');
  const [leadFilter, setLeadFilter] = useState<'all' | 'hot' | 'cold'>('all');
  const [analytics, setAnalytics] = useState<any>(null);

  const [contactsViewMode, setContactsViewMode] = useState<"list" | "board">("board");
  const [editingTagsPhone, setEditingTagsPhone] = useState<string | null>(null);
  const [newTagInput, setNewTagInput] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const updateCustomerField = async (phone: string, updates: any) => {
    try {
      const res = await fetch("/api/whatsapp/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, ...updates })
      });
      if (res.ok) {
        fetchChats();
      }
    } catch (e) {
      console.error("Failed to update customer:", e);
    }
  };

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [promoMessage, setPromoMessage] = useState("");
  const [promoAudience, setPromoAudience] = useState("all");
  const [promoMediaBase64, setPromoMediaBase64] = useState<string | null>(null);
  const [promoMediaMime, setPromoMediaMime] = useState<string | null>(null);
  const [promoMediaName, setPromoMediaName] = useState<string | null>(null);
  const [sendingPromo, setSendingPromo] = useState(false);
  const [promoHistory, setPromoHistory] = useState<any[]>([]);
  const promoFileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView();
  }, [chats, selectedChat, activeTab]);

  useEffect(() => {
    fetchSession();
    fetchConfig();
    fetchChats();
    fetchPromotions();
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/whatsapp/orders");
      const data = await res.json();
      if (Array.isArray(data)) {
        setOrders(data);
      }
    } catch (e) {
      console.warn("Could not fetch orders (likely dev server reload):", e);
    }
  };

  const fetchSession = async () => {
    try {
      const res = await fetch("/api/whatsapp/session");
      const data = await res.json();
      if (data.success && data.session) {
        setSessionData(data.session);
        if (data.session.status === "connected") {
          setStatus("connected");
        } else if (data.session.qrCode) {
          setQrCode(data.session.qrCode);
          setStatus("scanning");
        }
      }
    } catch (e) {
      console.error("Failed to fetch session:", e);
    }
  };

  const validateKey = async (apiKey: string, type: 'anthropic' | 'openrouter') => {
    const setStatus = type === 'anthropic' ? setAnthropicKeyStatus : setOpenRouterKeyStatus;
    const setError = type === 'anthropic' ? setAnthropicKeyError : setOpenRouterKeyError;

    if (!apiKey || !apiKey.trim()) {
      setStatus("Not Configured");
      setError("");
      return;
    }

    setStatus("checking");
    setError("");

    try {
      const res = await fetch("/api/whatsapp/config/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey })
      });
      const data = await res.json();
      if (data.success) {
        setStatus("Active");
        setError("");
      } else {
        setStatus(data.status || "Error");
        setError(data.error || "Failed to validate key.");
      }
    } catch (e: any) {
      setStatus("Error");
      setError(e.message || "Network error.");
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/whatsapp/config");
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        validateKey(data.config.anthropicApiKey, 'anthropic');
        validateKey(data.config.openRouterApiKey, 'openrouter');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchChats = async () => {
    try {
      const res = await fetch("/api/whatsapp/chats");
      const data = await res.json();
      if (data.success) {
        const mergedChats = { ...data.chats };
        const customersMap: Record<string, any> = {};
        if (data.customers) {
          data.customers.forEach((c: any) => {
            customersMap[c.phone] = c;
            if (!mergedChats[c.phone]) {
              mergedChats[c.phone] = [];
            }
          });
        }
        setChats(mergedChats);
        setCustomers(customersMap);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPromotions = async () => {
    try {
      const res = await fetch("/api/whatsapp/promotions");
      const data = await res.json();
      if (data.success) {
        setPromoHistory(data.promotions);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch("/api/whatsapp/analytics");
      const data = await res.json();
      if (data.success) setAnalytics(data.data);
    } catch (e) {
      console.warn("Failed to fetch analytics:", e);
    }
  };

  useEffect(() => {
    fetchChats();
    fetchConfig();
    fetchPromotions();
    fetchOrders();
    fetchAnalytics();
    let chatInterval = setInterval(fetchChats, 3000);
    return () => clearInterval(chatInterval);
  }, []);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    if (status === "waiting_qr" || status === "scanning") {
      pollInterval = setInterval(async () => {
        try {
          const res = await fetch("/api/whatsapp/session");
          const data = await res.json();
          if (data.success && data.session) {
            setSessionData(data.session);
            const currentStatus = data.session.status;
            
            if (currentStatus === "connected") {
              setStatus("connected");
              clearInterval(pollInterval);
            } else if (currentStatus === "disconnected") {
              setStatus("error");
              setErrorMessage("Connection failed. Please try again.");
              clearInterval(pollInterval);
            } else if (data.session.qrCode) {
              setQrCode(data.session.qrCode);
              setStatus("scanning");
            }
          }
        } catch (e) {
          console.error("Polling error", e);
        }
      }, 2000);
    }

    return () => clearInterval(pollInterval);
  }, [status]);

  const startSession = async () => {
    try {
      setStatus("creating");
      setQrCode(null);
      setErrorMessage("");

      const res = await fetch("/api/whatsapp/session", { method: "POST" });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to start WhatsApp session");
      }

      setStatus("waiting_qr");
    } catch (e: any) {
      setStatus("error");
      setErrorMessage(e.message);
    }
  };

  const disconnectSession = async () => {
    try {
      await fetch("/api/whatsapp/session", { method: "DELETE" });
      setStatus("idle");
      setSessionData(null);
      setQrCode(null);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleChatAi = async (enabled: boolean) => {
    if (!selectedChat) return;
    setCustomers(prev => ({
      ...prev,
      [selectedChat]: { ...prev[selectedChat], aiEnabled: enabled }
    }));
    try {
      await fetch("/api/whatsapp/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: selectedChat, aiEnabled: enabled })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const markChatAsRead = async (phone: string) => {
    try {
      await fetch("/api/whatsapp/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone })
      });
      fetchChats(); // Refresh local chat state
    } catch (e) {
      console.error(e);
    }
  };

  const sendManualMessage = async () => {
    if (!selectedChat || !messageInput.trim()) return;
    
    const content = messageInput.trim();
    setMessageInput("");

    setChats(prev => {
      const chatHistory = prev[selectedChat] || [];
      return {
        ...prev,
        [selectedChat]: [...chatHistory, { role: "assistant", content, timestamp: new Date().toISOString() }]
      };
    });

    try {
      await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: selectedChat, content })
      });
    } catch (e) {
      console.error("Failed to send message", e);
    }
  };

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat) return;

    setChats(prev => {
      const chatHistory = prev[selectedChat] || [];
      return {
        ...prev,
        [selectedChat]: [...chatHistory, { role: "assistant", content: `📎 [Attachment] ${file.name}`, timestamp: new Date().toISOString() }]
      };
    });

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            to: selectedChat, 
            mediaBase64: base64,
            mimetype: file.type,
            fileName: file.name
          })
        });
      } catch (err) {
        console.error("Failed to send file", err);
      }
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startRecording = async () => {
    if (!selectedChat) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          setChats(prev => {
            const chatHistory = prev[selectedChat] || [];
            return {
              ...prev,
              [selectedChat]: [...chatHistory, { role: "assistant", content: `🎤 [Voice Note]`, timestamp: new Date().toISOString() }]
            };
          });
          try {
            await fetch("/api/whatsapp/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                to: selectedChat, 
                mediaBase64: base64,
                mimetype: 'audio/webm',
                isVoiceNote: true
              })
            });
          } catch (err) {
            console.error("Failed to send voice note", err);
          }
        };
        reader.readAsDataURL(audioBlob);
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Microphone access denied or error:", err);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      await fetch("/api/whatsapp/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });
    } catch (e) {
      console.error(e);
    }
    setTimeout(() => setSavingConfig(false), 500);
  };

  const handleScrape = async () => {
    if (!scrapeUrl.trim()) return;
    setIsScraping(true);
    try {
      const res = await fetch("/api/whatsapp/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: scrapeUrl.trim(), currency: scrapeCurrency.trim() })
      });
      const data = await res.json();
      if (data.success && data.catalog) {
        setConfig((prev: any) => ({
          ...prev,
          storeUrl: scrapeUrl.trim(),
          storeCurrency: scrapeCurrency.trim(),
          productInfo: prev.productInfo + "\n\n" + data.catalog
        }));
        setScrapeUrl("");
      } else {
        alert(data.error || "Failed to scrape website");
      }
    } catch (e) {
      console.error(e);
      alert("Error occurred while scraping.");
    }
    setIsScraping(false);
  };

  const handlePromoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPromoMediaBase64(event.target?.result as string);
        setPromoMediaMime(file.type);
        setPromoMediaName(file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePromoMedia = () => {
    setPromoMediaBase64(null);
    setPromoMediaMime(null);
    setPromoMediaName(null);
    if (promoFileInputRef.current) {
      promoFileInputRef.current.value = "";
    }
  };

  const sendPromotion = async () => {
    if (!promoMessage.trim() && !promoMediaBase64) return;
    setSendingPromo(true);
    try {
      const res = await fetch("/api/whatsapp/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: promoMessage, 
          audience: promoAudience,
          mediaBase64: promoMediaBase64,
          mimetype: promoMediaMime,
          fileName: promoMediaName
        })
      });
      const data = await res.json();
      if (data.success) {
        setPromoMessage("");
        removePromoMedia();
        fetchPromotions();
        alert(`Broadcast complete! Success: ${data.log.successCount}, Failed: ${data.log.failureCount}`);
      } else {
        alert(`Failed to send broadcast: ${data.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      console.error(e);
      alert(`Error sending broadcast: ${e.message}`);
    } finally {
      setSendingPromo(false);
    }
  };

  return (
    <div className="h-screen w-full flex bg-[#f5f6f8] font-sans overflow-hidden text-slate-800">
      
      {/* 1. Left Sidebar */}
      <div className="w-[260px] flex-shrink-0 bg-white border-r border-slate-100 flex flex-col py-6 overflow-y-auto z-20 shadow-[4px_0_24px_rgba(0,0,0,0.01)]">
        <div className="px-6 flex items-center gap-3 font-bold text-2xl mb-10 text-slate-900 tracking-tight">
          <div className="bg-slate-900 p-1.5 rounded-lg shadow-sm">
            <Zap className="text-white h-6 w-6" />
          </div>
          HazelWhat
        </div>

        <div className="px-6 mb-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Workspace</div>
        <div className="flex flex-col gap-1 px-4 mb-8">
          <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'dashboard' ? 'bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)] text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Zap className={`h-[18px] w-[18px] ${activeTab === 'dashboard' ? 'text-emerald-500' : 'text-slate-400'}`} /> Dashboard
          </button>
          <button onClick={() => setActiveTab('inbox')} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'inbox' ? 'bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)] text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Inbox className={`h-[18px] w-[18px] ${activeTab === 'inbox' ? 'text-emerald-500' : 'text-slate-400'}`} /> Inbox
          </button>
          <button onClick={() => setActiveTab('orders')} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'orders' ? 'bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)] text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}>
            <ShoppingCart className={`h-[18px] w-[18px] ${activeTab === 'orders' ? 'text-emerald-500' : 'text-slate-400'}`} /> Orders
          </button>
          <button onClick={() => setActiveTab('contacts')} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'contacts' ? 'bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)] text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Users className={`h-[18px] w-[18px] ${activeTab === 'contacts' ? 'text-emerald-500' : 'text-slate-400'}`} /> Contacts
          </button>
        </div>

        <div className="px-6 mb-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Intelligence</div>
        <div className="flex flex-col gap-1 px-4 mb-8">
          <button onClick={() => setActiveTab('agents')} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'agents' ? 'bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)] text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}>
            <BookOpen className={`h-[18px] w-[18px] ${activeTab === 'agents' ? 'text-emerald-500' : 'text-slate-400'}`} /> Knowledge Base
          </button>
          <button onClick={() => setActiveTab('channels')} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'channels' ? 'bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)] text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Network className={`h-[18px] w-[18px] ${activeTab === 'channels' ? 'text-emerald-500' : 'text-slate-400'}`} /> Channels
          </button>
        </div>

        <div className="px-6 mb-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Growth</div>
        <div className="flex flex-col gap-1 px-4 mb-8">
          <button onClick={() => setActiveTab('promotions')} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'promotions' ? 'bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)] text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}>
            <MessageSquare className={`h-[18px] w-[18px] ${activeTab === 'promotions' ? 'text-emerald-500' : 'text-slate-400'}`} /> Promotions
          </button>
          <button onClick={() => setActiveTab('analytics')} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'analytics' ? 'bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)] text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Activity className={`h-[18px] w-[18px] ${activeTab === 'analytics' ? 'text-emerald-500' : 'text-slate-400'}`} /> Analytics
          </button>
        </div>

        <div className="px-6 mb-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Account</div>
        <div className="flex flex-col gap-1 px-4 mb-8">
          <button onClick={() => setActiveTab('settings')} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'settings' ? 'bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)] text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Settings className={`h-[18px] w-[18px] ${activeTab === 'settings' ? 'text-emerald-500' : 'text-slate-400'}`} /> Settings
          </button>
        </div>

        <div className="mt-auto px-6">
          <div className="flex items-center gap-3 pt-6 border-t border-slate-100">
            <div className="h-10 w-10 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-full flex items-center justify-center text-white font-bold shadow-md relative">
              H
              <div className="absolute bottom-0 right-0 h-3 w-3 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[8px]">2</div>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-slate-900 truncate">Hassaan</h4>
              <p className="text-xs text-emerald-500 font-medium">Online</p>
            </div>
          </div>
        </div>
      </div>


      {/* 2. Middle Column (Chat List) */}
      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="p-8 max-w-[1200px] mx-auto w-full h-full overflow-y-auto bg-slate-50/50">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-[22px] font-bold text-slate-900">
              Overview
            </h2>
            <div className="flex items-center gap-4">
              <div className="bg-slate-100/70 p-1 rounded-lg flex items-center text-sm font-semibold">
                <button className="px-4 py-1.5 bg-white text-slate-800 shadow-sm rounded-md">Weekly</button>
                <button className="px-4 py-1.5 text-slate-500 hover:text-slate-700">Monthly</button>
                <button className="px-4 py-1.5 text-slate-500 hover:text-slate-700">Yearly</button>
              </div>
              <button className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 shadow-sm">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h7"/></svg>
                Filter
              </button>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] p-6 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-0">
            <div className="flex-1 md:border-r border-slate-100 md:pr-6">
              <div className="text-slate-500 font-medium text-[13px] mb-2">Total Revenue</div>
              <div className="flex items-end gap-3">
                <div className="text-3xl font-extrabold text-slate-900">$200,45.87</div>
                <div className="bg-emerald-50 text-emerald-600 text-xs font-bold px-2 py-0.5 rounded-full mb-1">+2.5%</div>
              </div>
            </div>
            
            <div className="flex-1 md:border-r border-slate-100 md:px-6">
              <div className="text-slate-500 font-medium text-[13px] mb-2">Active Users</div>
              <div className="flex items-end gap-3">
                <div className="text-3xl font-extrabold text-slate-900">9,528</div>
                <div className="bg-emerald-50 text-emerald-600 text-xs font-bold px-2 py-0.5 rounded-full mb-1">+9.5%</div>
              </div>
            </div>
            
            <div className="flex-1 md:border-r border-slate-100 md:px-6">
              <div className="text-slate-500 font-medium text-[13px] mb-2">Customer Lifetime Value</div>
              <div className="flex items-end gap-3">
                <div className="text-3xl font-extrabold text-slate-900">$849.54</div>
                <div className="bg-red-50 text-red-500 text-xs font-bold px-2 py-0.5 rounded-full mb-1">-1.6%</div>
              </div>
            </div>
            
            <div className="flex-1 md:pl-6">
              <div className="text-slate-500 font-medium text-[13px] mb-2">Customer Acquisition Cost</div>
              <div className="flex items-end gap-3">
                <div className="text-3xl font-extrabold text-slate-900">9,528</div>
                <div className="bg-emerald-50 text-emerald-600 text-xs font-bold px-2 py-0.5 rounded-full mb-1">+3.5%</div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 h-fit">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col justify-between h-[180px]">
                <div>
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-slate-900">Churn Rate</h3>
                    <MoreVertical className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="text-xs font-medium text-slate-500 mt-1">Downgrade to Free plan</div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-2xl font-extrabold text-slate-900">4.26%</div>
                    <div className="text-[11px] font-semibold text-slate-500 mt-1"><span className="text-red-500">-0.31%</span> than last Week</div>
                  </div>
                  <div className="w-24 h-12 flex items-end">
                    <svg viewBox="0 0 100 40" className="w-full h-full stroke-red-500 fill-red-500/10" strokeWidth="2"><path d="M0 30 Q 15 25, 25 35 T 40 10 T 50 25 T 60 15 T 75 35 T 100 30 L 100 40 L 0 40 Z"/></svg>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col justify-between h-[180px]">
                <div>
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-slate-900">User Growth</h3>
                    <MoreVertical className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="text-xs font-medium text-slate-500 mt-1">New signups website + mobile</div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-2xl font-extrabold text-slate-900">3,768</div>
                    <div className="text-[11px] font-semibold text-slate-500 mt-1"><span className="text-emerald-500">+3.85%</span> than last Week</div>
                  </div>
                  <div className="w-24 h-12 flex items-end">
                    <svg viewBox="0 0 100 40" className="w-full h-full stroke-emerald-500 fill-emerald-500/10" strokeWidth="2"><path d="M0 35 Q 15 25, 25 30 T 40 20 T 50 25 T 60 20 T 75 10 T 100 5 L 100 40 L 0 40 Z"/></svg>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] md:col-span-2">
                <div className="flex justify-between items-start mb-6">
                  <h3 className="font-bold text-slate-900">Conversion Funnel</h3>
                  <MoreVertical className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex items-center gap-4 mb-8 text-xs font-semibold text-slate-600 flex-wrap">
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-600"></div> Ad Impression</div>
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Website Session</div>
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-400"></div> App Download</div>
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-200"></div> New Users</div>
                </div>
                
                <div className="flex items-end justify-between h-40 pt-4 gap-2 md:gap-4 pb-2 border-l border-b border-slate-200 px-4 relative ml-4">
                  <div className="absolute left-[-24px] top-0 text-[10px] text-slate-400 h-full flex flex-col justify-between pb-2 font-medium">
                    <span>120</span><span>100</span><span>80</span><span>60</span><span>40</span>
                  </div>
                  {[
                    [20, 20, 20, 15], [30, 25, 20, 15], [25, 20, 20, 20], [30, 20, 25, 10], 
                    [20, 15, 15, 15], [25, 20, 20, 15], [30, 25, 20, 20], [30, 25, 25, 15]
                  ].map((heights, i) => (
                    <div key={i} className="flex-1 flex flex-col justify-end w-4 md:w-8 max-w-[32px] rounded-t-lg overflow-hidden gap-[1px]">
                      <div className="w-full bg-blue-200 rounded-t-sm" style={{height: `${heights[3]}%`}}></div>
                      <div className="w-full bg-blue-400" style={{height: `${heights[2]}%`}}></div>
                      <div className="w-full bg-blue-500" style={{height: `${heights[1]}%`}}></div>
                      <div className="w-full bg-blue-600 rounded-b-sm" style={{height: `${heights[0]}%`}}></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] h-full flex flex-col">
              <div className="flex justify-between items-start mb-6">
                <h3 className="font-bold text-slate-900">Product Performance</h3>
                <MoreVertical className="w-4 h-4 text-slate-400" />
              </div>
              
              <div className="bg-slate-50 p-1 rounded-xl flex items-center text-[11px] md:text-xs font-bold mb-6">
                <button className="flex-1 py-1.5 bg-white text-slate-900 shadow-sm rounded-lg">Daily Sales</button>
                <button className="flex-1 py-1.5 text-slate-500 hover:text-slate-700">Online Sales</button>
                <button className="flex-1 py-1.5 text-slate-500 hover:text-slate-700">New Users</button>
              </div>

              <div className="flex justify-between border-b border-slate-100 pb-6 mb-6">
                <div>
                  <div className="text-xs font-medium text-slate-500 mb-1">Digital Product</div>
                  <div className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    <span className="text-emerald-500 text-sm">↑</span> 790
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500 mb-1">Physical Product</div>
                  <div className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    <span className="text-red-500 text-sm">↓</span> 572
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="text-xs font-medium text-slate-500 mb-1">Average Daily Sales</div>
                  <div className="text-3xl font-extrabold text-slate-900">$2,950</div>
                </div>
                <div className="bg-red-50 text-red-500 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1"><span className="text-sm leading-none">↓</span> 0.52%</div>
              </div>

              <div className="mt-auto h-40 flex items-end justify-between gap-1 md:gap-2 border-b border-l border-slate-200 px-2 pt-2 relative ml-4">
                <div className="absolute left-[-22px] top-0 text-[10px] text-slate-400 h-full flex flex-col justify-between pb-2 font-medium">
                    <span>400</span><span>300</span><span>200</span><span>100</span><span>0</span>
                </div>
                {[30, 80, 45, 65, 40, 40, 35].map((h, i) => (
                  <div key={i} className="flex-1 bg-blue-600 rounded-t-sm" style={{height: `${h}%`}}></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        !analytics ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4 bg-white rounded-3xl border border-slate-100 p-10 max-w-5xl mx-auto my-10">
            <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
            <p className="text-slate-500 font-bold">Loading analytics...</p>
          </div>
        ) : (
        <div className="p-10 max-w-5xl mx-auto w-full h-full overflow-y-auto">
          <h2 className="text-3xl font-extrabold text-slate-900 mb-8 flex items-center gap-3">
            <Activity className="h-8 w-8 text-emerald-500" /> Analytics
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
              <div className="text-slate-400 font-bold text-sm uppercase tracking-wider mb-2">Total Chats</div>
              <div className="text-4xl font-extrabold text-slate-900">{analytics.totalChats}</div>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
              <div className="text-slate-400 font-bold text-sm uppercase tracking-wider mb-2">Total Bookings & Orders</div>
              <div className="text-4xl font-extrabold text-slate-900">{analytics.totalOrders + analytics.totalBookings}</div>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
              <div className="text-slate-400 font-bold text-sm uppercase tracking-wider mb-2">Conversion Rate</div>
              <div className="text-4xl font-extrabold text-emerald-500">{analytics.conversionRate}%</div>
              <div className="text-xs font-bold text-slate-400 mt-2">Orders per unique contact</div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            <h3 className="text-xl font-bold text-slate-900 mb-6">Most Requested Products</h3>
            {analytics.topProducts.length > 0 ? (
              <div className="grid gap-4">
                {analytics.topProducts.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="font-bold text-slate-800">{p.name}</span>
                    <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-bold">{p.count} requests</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-400 font-medium">No product data available yet.</div>
            )}
          </div>
        </div>
        )
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="p-10 max-w-4xl mx-auto w-full h-full overflow-y-auto">
          <h2 className="text-3xl font-extrabold text-slate-900 mb-8 flex items-center gap-3">
            <Settings className="h-8 w-8 text-emerald-500" /> Account Settings
          </h2>
          
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            <div className="grid gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Business Name</label>
                <input 
                  type="text" 
                  value={config.businessName || ''} 
                  onChange={e => setConfig({...config, businessName: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-medium focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  placeholder="e.g. Acme Corp"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Timezone</label>
                <input 
                  type="text" 
                  value={config.timezone || ''} 
                  onChange={e => setConfig({...config, timezone: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-medium focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  placeholder="e.g. UTC, America/New_York"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Working Hours</label>
                <input 
                  type="text" 
                  value={config.workingHours || ''} 
                  onChange={e => setConfig({...config, workingHours: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-medium focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  placeholder="e.g. 9:00 AM - 5:00 PM"
                />
              </div>
            </div>

            {/* API Keys Configuration */}
            <div className="border-t border-slate-100 pt-6 mt-6">
              <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-500" /> API Keys Configuration
              </h3>
              <p className="text-xs text-slate-500 mb-6 font-medium">
                Configure your AI autopilot engine keys. If both are configured, the system will use Anthropic Direct first, and automatically fall back to OpenRouter if Anthropic is out of credits.
              </p>
              
              <div className="grid gap-6">
                {/* Anthropic API Key */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-bold text-slate-700">Anthropic Direct API Key</label>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                      anthropicKeyStatus === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      anthropicKeyStatus === 'Out of Credits' ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse' :
                      anthropicKeyStatus === 'Invalid' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                      anthropicKeyStatus === 'checking' ? 'bg-slate-100 text-slate-500 animate-pulse' :
                      'bg-slate-50 text-slate-500 border border-slate-200'
                    }`}>
                      {anthropicKeyStatus === 'checking' ? 'Checking...' : anthropicKeyStatus}
                    </span>
                  </div>
                  <div className="relative">
                    <input 
                      type={showAnthropicKey ? "text" : "password"} 
                      value={config.anthropicApiKey || ''} 
                      onChange={e => setConfig({...config, anthropicApiKey: e.target.value})}
                      onBlur={() => validateKey(config.anthropicApiKey, 'anthropic')}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-12 py-3 text-slate-900 font-medium focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                      placeholder="sk-ant-..."
                    />
                    <button 
                      type="button"
                      onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      {showAnthropicKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {anthropicKeyError && (
                    <p className="text-xs text-rose-600 font-bold mt-1.5 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" /> {anthropicKeyError}
                    </p>
                  )}
                </div>

                {/* OpenRouter API Key */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-bold text-slate-700">OpenRouter API Key</label>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                      openRouterKeyStatus === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      openRouterKeyStatus === 'Out of Credits' ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse' :
                      openRouterKeyStatus === 'Invalid' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                      openRouterKeyStatus === 'checking' ? 'bg-slate-100 text-slate-500 animate-pulse' :
                      'bg-slate-50 text-slate-500 border border-slate-200'
                    }`}>
                      {openRouterKeyStatus === 'checking' ? 'Checking...' : openRouterKeyStatus}
                    </span>
                  </div>
                  <div className="relative">
                    <input 
                      type={showOpenRouterKey ? "text" : "password"} 
                      value={config.openRouterApiKey || ''} 
                      onChange={e => setConfig({...config, openRouterApiKey: e.target.value})}
                      onBlur={() => validateKey(config.openRouterApiKey, 'openrouter')}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-12 py-3 text-slate-900 font-medium focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                      placeholder="sk-or-..."
                    />
                    <button 
                      type="button"
                      onClick={() => setShowOpenRouterKey(!showOpenRouterKey)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      {showOpenRouterKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {openRouterKeyError && (
                    <p className="text-xs text-rose-600 font-bold mt-1.5 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" /> {openRouterKeyError}
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="mt-8 border-t border-slate-100 pt-6 flex justify-end">
              <button 
                onClick={saveConfig}
                disabled={savingConfig}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-sm flex items-center gap-2"
              >
                {savingConfig ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
      {activeTab === 'inbox' && (
        <div className="w-[360px] flex-shrink-0 bg-white border-r border-slate-100 flex flex-col relative z-10">
          
          {/* Connection Status Banner */}
          {status !== 'connected' && (
            <div className="bg-[#fff9e6] px-4 py-3 border-b border-yellow-200/50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-yellow-600 text-[13px] font-semibold">
                <div className="bg-emerald-500 p-1 rounded-full"><MessageCircle className="h-3 w-3 text-white" /></div> 
                WhatsApp App Disconnected
              </div>
              <button onClick={() => setActiveTab('channels')} className="text-blue-500 text-[13px] font-medium hover:underline">Reconnect</button>
            </div>
          )}

          {/* Search */}
          <div className="p-4 border-b border-slate-50">
            <div className="bg-[#f5f6f8] border border-slate-200/60 rounded-xl flex items-center px-4 py-2.5 gap-3 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
              <Search className="h-4 w-4 text-slate-400" />
              <input type="text" placeholder="Search" className="bg-transparent border-none outline-none text-[15px] w-full placeholder:text-slate-400 text-slate-700 font-medium" />
            </div>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
            {Object.keys(chats).length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                <p className="text-sm font-medium">No chats found.</p>
              </div>
            ) : (
              Object.entries(chats).sort((a, b) => {
                const aLast = a[1][a[1].length - 1];
                const bLast = b[1][b[1].length - 1];
                const aTime = aLast ? new Date(aLast.timestamp).getTime() : 0;
                const bTime = bLast ? new Date(bLast.timestamp).getTime() : 0;
                return bTime - aTime;
              }).map(([phone, messages], i) => {
                const lastMessage = messages[messages.length - 1];
                const formatContactName = (id: string) => {
                  const savedName = customers[id]?.name;
                  if (savedName && savedName !== id) return savedName;
                  if (id.includes('@g.us')) return `Group: ${id.split('@')[0]}`;
                  if (id.includes('@lid')) return `+${id.split('@')[0]} (Linked Device)`;
                  if (id.includes('@')) return `+${id.split('@')[0]}`;
                  return `+${id}`;
                };
                const displayName = formatContactName(phone);
                const isSelected = selectedChat === phone;
                const timeStr = lastMessage ? new Date(lastMessage.timestamp).toLocaleDateString([], { month: '2-digit', day: '2-digit' }) : "";
                
                // Mock ring percentage
                const percents = [40, 12, 20, 80, 100];
                const ringPercent = percents[i % percents.length];

                return (
                  <div 
                    key={phone} 
                    onClick={() => {
                      setSelectedChat(phone);
                      markChatAsRead(phone);
                    }}
                    className={`cursor-pointer px-5 py-4 flex items-start gap-4 transition-all border-b border-slate-50/50 relative ${isSelected ? 'bg-[#f0f2f5] before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-emerald-500' : 'hover:bg-slate-50'}`}
                  >
                    {/* Avatar with ring */}
                    <div className="relative flex-shrink-0 mt-0.5">
                      <div className="h-[46px] w-[46px] rounded-full border-[2.5px] border-emerald-500 p-0.5 relative flex items-center justify-center bg-white">
                        <div className="h-full w-full bg-slate-200 rounded-full flex items-center justify-center overflow-hidden">
                          <User className="text-slate-400 h-6 w-6" />
                        </div>
                      </div>
                      <div className="absolute -bottom-1 -left-1 bg-emerald-500 text-white text-[9px] font-bold px-1.5 rounded-full border-2 border-white shadow-sm">
                        {ringPercent}%
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <h4 className="text-[15px] font-bold text-slate-900 truncate">{displayName}</h4>
                        <span className="text-[12px] font-semibold text-emerald-500">{timeStr}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[14px] text-slate-500 font-medium">
                        {lastMessage?.role === 'assistant' && <CheckCheck className="h-4 w-4 text-slate-400 flex-shrink-0" />}
                        <span className="truncate">{lastMessage?.content}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 3. Main Content View */}
      <div className="flex-1 flex flex-col min-w-0 relative z-0 bg-[#efeae2]" style={activeTab === 'inbox' ? { backgroundImage: "url('https://cdn.pixabay.com/photo/2021/07/25/08/03/pattern-6491187_960_720.png')", backgroundSize: "400px", backgroundBlendMode: "overlay", backgroundColor: "rgba(240, 242, 245, 0.95)" } : { backgroundColor: "#f8f9fa" }}>
        
        {activeTab === 'inbox' && (
          !selectedChat ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
              <div className="h-64 w-64 bg-[url('https://static.whatsapp.net/rsrc.php/v3/y6/r/wa669aeJeom.png')] bg-contain bg-no-repeat bg-center opacity-40 mix-blend-multiply"></div>
              <h2 className="text-3xl font-light text-slate-600">WhatsApp for Web</h2>
              <p className="text-sm">Select a chat to start messaging.</p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="h-[72px] bg-white border-b border-slate-200 px-6 flex items-center justify-between z-10 flex-shrink-0 shadow-sm">
                <div className="flex items-center gap-4 cursor-pointer">
                  <div className="h-12 w-12 rounded-full bg-emerald-500 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
                    <User className="h-7 w-7 text-white/90" />
                  </div>
                  <div className="flex flex-col">
                    <h4 className="font-bold text-slate-900 text-[16px]">
                      {(() => {
                        const savedName = customers[selectedChat]?.name;
                        if (savedName && savedName !== selectedChat) return savedName;
                        if (selectedChat.includes('@g.us')) return `Group: ${selectedChat.split('@')[0]}`;
                        if (selectedChat.includes('@lid')) return `+${selectedChat.split('@')[0]} (Linked Device)`;
                        if (selectedChat.includes('@')) return `+${selectedChat.split('@')[0]}`;
                        return `+${selectedChat}`;
                      })()}
                    </h4>
                    <span className="text-[13px] text-slate-500 font-medium">({selectedChat.split('@')[0]}) | Pakistan</span>
                  </div>
                </div>
                
                {/* Autopilot Toggle */}
                <div className="flex items-center bg-white border border-emerald-500 rounded-full p-1 shadow-sm">
                  {(() => {
                    const isAiEnabled = customers[selectedChat]?.aiEnabled !== undefined ? customers[selectedChat].aiEnabled : (config.globalAiEnabled !== false);
                    return (
                      <>
                        <button 
                          onClick={() => toggleChatAi(true)}
                          className={`${isAiEnabled ? 'bg-emerald-500 text-white' : 'text-emerald-600 hover:bg-emerald-50'} text-[13px] font-bold px-4 py-1.5 rounded-full shadow-sm transition`}
                        >
                          Autopilot
                        </button>
                        <button 
                          onClick={() => toggleChatAi(false)}
                          className={`${!isAiEnabled ? 'bg-emerald-500 text-white' : 'text-emerald-600 hover:bg-emerald-50'} text-[13px] font-bold px-4 py-1.5 rounded-full shadow-sm transition`}
                        >
                          Copilot
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>
              
              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto px-[10%] py-6 flex flex-col space-y-3 z-10 custom-scrollbar">
                
                {chats[selectedChat]?.map((m, i) => {
                  const isSent = m.role === 'assistant';
                  return (
                    <div key={i} className={`flex w-full ${isSent ? 'justify-end' : 'justify-start'}`}>
                      <div className={`relative max-w-[65%] rounded-xl px-3 py-2 text-[15px] font-medium leading-relaxed shadow-sm ${
                        isSent 
                          ? 'bg-[#d9fdd3] text-[#111b21] rounded-tr-sm border border-[#d9fdd3]' 
                          : 'bg-white text-[#111b21] rounded-tl-sm border border-slate-100'
                      }`}>
                        {m.mediaUrl && (
                          <div className="mb-2 rounded-lg overflow-hidden border border-black/5 bg-black/5">
                            {m.mediaType?.startsWith('image/') ? (
                              <img src={m.mediaUrl} alt="Attached Media" className="max-w-full max-h-[300px] object-cover" />
                            ) : m.mediaType?.startsWith('video/') ? (
                              <video src={m.mediaUrl} controls className="max-w-full max-h-[300px] object-cover" />
                            ) : m.mediaType?.startsWith('audio/') ? (
                              <audio src={m.mediaUrl} controls className="max-w-full" />
                            ) : (
                              <a href={m.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 text-emerald-600 hover:bg-emerald-50 transition">
                                <Paperclip className="h-5 w-5" />
                                <span className="font-bold underline text-sm truncate">Document Attachment</span>
                              </a>
                            )}
                          </div>
                        )}
                        {m.content && <span className="pr-14 block whitespace-pre-wrap">{m.content}</span>}
                        <div className="absolute bottom-1 right-2 flex items-center gap-1 text-[11px] text-[#667781] font-semibold">
                          <span>{new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          {isSent && (
                            m.status === 4 ? <CheckCheck className="h-4 w-4 text-[#53bdeb]" /> :
                            m.status === 3 ? <CheckCheck className="h-4 w-4 text-slate-400" /> :
                            <Check className="h-4 w-4 text-slate-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              
              {/* Status warning if disconnected in input area */}
              {status !== 'connected' ? (
                <div className="h-[80px] bg-white border-t border-slate-200 px-6 flex items-center justify-center z-10 flex-shrink-0 shadow-[0_-4px_24px_rgba(0,0,0,0.02)]">
                  <div className="flex flex-col items-center">
                    <p className="text-slate-500 text-sm font-medium mb-2">WhatsApp is disconnected</p>
                    <button onClick={() => setActiveTab('channels')} className="bg-emerald-500 text-white font-bold px-6 py-2 rounded-lg hover:bg-emerald-600 transition flex items-center gap-2">
                      <Zap className="h-4 w-4" /> Reconnect
                    </button>
                  </div>
                </div>
              ) : (
                /* Chat Input Bar */
                <div className="h-[80px] bg-white border-t border-slate-200 px-6 flex items-center gap-4 z-10 flex-shrink-0 relative shadow-[0_-4px_24px_rgba(0,0,0,0.02)]">
                  
                  {showEmojiPicker && (
                    <div className="absolute bottom-[90px] left-6 z-50 shadow-2xl rounded-xl">
                      <EmojiPicker 
                        onEmojiClick={(emojiData) => {
                          setMessageInput(prev => prev + emojiData.emoji);
                        }}
                      />
                    </div>
                  )}

                  <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileAttach} />

                  {isRecording ? (
                    <div className="flex-1 flex items-center gap-4 animate-in fade-in duration-300">
                      <div className="flex items-center gap-2 text-rose-500 font-bold">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                        </span>
                        Recording... {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                      </div>
                      <div className="flex-1"></div>
                      <button onClick={() => {
                        if (mediaRecorderRef.current && isRecording) {
                          mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
                          setIsRecording(false);
                          if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
                        }
                      }} className="text-slate-500 hover:text-slate-700 text-sm font-bold">
                        Cancel
                      </button>
                      <button onClick={stopRecording} className="bg-rose-500 text-white rounded-full p-3 hover:bg-rose-600 transition shadow-md">
                        <Send className="h-5 w-5 ml-0.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-5 text-slate-400">
                        <Smile onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={`h-7 w-7 cursor-pointer transition-colors ${showEmojiPicker ? 'text-emerald-500' : 'hover:text-slate-600'}`} />
                        <Paperclip onClick={() => fileInputRef.current?.click()} className="h-6 w-6 cursor-pointer hover:text-slate-600 transition-colors" />
                      </div>
                      
                      <div className="flex-1">
                        <input 
                          type="text"
                          placeholder="Type a message..."
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              sendManualMessage();
                              setShowEmojiPicker(false);
                            }
                          }}
                          onClick={() => setShowEmojiPicker(false)}
                          onFocus={() => { if (selectedChat) markChatAsRead(selectedChat); }}
                          className="w-full h-12 bg-[#f0f2f5] rounded-full px-6 text-[15px] text-slate-800 focus:outline-none placeholder:text-slate-500 border border-transparent focus:border-slate-300 font-medium transition-all"
                        />
                      </div>
                      
                      {messageInput.trim() ? (
                        <div onClick={() => { sendManualMessage(); setShowEmojiPicker(false); }} className="bg-emerald-500 h-12 w-12 rounded-full flex items-center justify-center cursor-pointer hover:bg-emerald-600 shadow-md transition-colors">
                          <Send className="h-5 w-5 text-white ml-0.5" />
                        </div>
                      ) : (
                        <Mic onClick={startRecording} className="h-7 w-7 text-slate-400 cursor-pointer hover:text-emerald-500 transition-colors" />
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )
        )}

        {/* Channels Tab (QR Connection) */}
        {activeTab === 'channels' && (
          <div className="p-10 max-w-4xl mx-auto w-full h-full overflow-y-auto">
            <h2 className="text-3xl font-extrabold text-slate-900 mb-8">WhatsApp Integration</h2>
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center">
              
              {status === "idle" && (
                <div className="text-center space-y-6 w-full max-w-sm">
                  <div className="mx-auto bg-slate-50 p-6 rounded-full w-max border border-slate-100">
                    <QrCode className="h-16 w-16 text-slate-300" />
                  </div>
                  <button onClick={startSession} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold h-12 rounded-xl transition-all shadow-md">
                    Generate QR Code
                  </button>
                </div>
              )}

              {(status === "creating" || status === "waiting_qr") && (
                <div className="flex flex-col items-center justify-center space-y-6 py-10">
                  <Loader2 className="h-12 w-12 text-emerald-500 animate-spin" />
                  <p className="text-slate-500 font-bold">Initializing Secure Connection...</p>
                </div>
              )}

              {status === "scanning" && qrCode && (
                <div className="flex flex-col items-center">
                  <div className="bg-white p-4 rounded-3xl shadow-lg border border-slate-100 mb-8">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrCode} alt="QR" className="w-64 h-64 rounded-xl object-contain" />
                  </div>
                  <div className="w-full space-y-3 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <p className="text-sm text-slate-600 font-bold">1. Open WhatsApp -&gt; Settings -&gt; Linked Devices</p>
                    <p className="text-sm text-slate-600 font-bold">2. Tap Link a Device &amp; point phone to this screen.</p>
                  </div>
                </div>
              )}

              {status === "connected" && (
                <div className="flex flex-col items-center justify-center text-center space-y-6 py-10 w-full max-w-sm">
                  <div className="bg-emerald-100 p-6 rounded-full shadow-inner">
                    <CheckCircle2 className="h-20 w-20 text-emerald-500" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xl text-slate-900 font-extrabold mb-2">Device Linked Successfully!</p>
                    {sessionData?.phoneNumber && (
                      <p className="text-sm text-slate-500 font-bold">+{sessionData.phoneNumber}</p>
                    )}
                  </div>
                  <button onClick={disconnectSession} className="text-sm font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 w-full py-3 rounded-xl transition-colors mt-4">
                    Disconnect Device
                  </button>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Agents Tab (Config) */}
        {activeTab === 'agents' && (
          <div className="p-10 max-w-4xl mx-auto w-full h-full overflow-y-auto">
            <h2 className="text-3xl font-extrabold text-slate-900 mb-8 flex items-center gap-3">
              <Bot className="h-8 w-8 text-emerald-500" /> Bot Configuration
            </h2>
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-8">
              
              {/* Global Autopilot Toggle */}
              <div className="flex items-center justify-between bg-slate-50 p-6 rounded-2xl border border-slate-200">
                <div>
                  <h3 className="text-[16px] font-bold text-slate-900">Global AI Autopilot</h3>
                  <p className="text-[13px] text-slate-500 font-medium mt-1">When disabled, the AI will stop automatically replying to all incoming messages by default.</p>
                </div>
                <div 
                  onClick={() => setConfig({ ...config, globalAiEnabled: config.globalAiEnabled === false ? true : false })}
                  className={`w-14 h-8 flex items-center rounded-full p-1 cursor-pointer transition-colors shadow-inner ${config.globalAiEnabled !== false ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform ${config.globalAiEnabled !== false ? 'translate-x-6' : 'translate-x-0'}`} />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-900">System Prompt / Persona</label>
                <textarea 
                  value={config.systemPrompt}
                  onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                  className="w-full h-32 p-4 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition font-medium"
                  placeholder="Tell the AI how to act..."
                />
              </div>
              
              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-900">Product Information Knowledge Base</label>
                <textarea 
                  value={config.productInfo}
                  onChange={(e) => setConfig({ ...config, productInfo: e.target.value })}
                  className="w-full h-32 p-4 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition font-medium"
                  placeholder="Paste your pricing, features, and product details here..."
                />
              </div>

              {/* Website Scraper */}
              <div className="bg-[#f8fafc] p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div>
                  <h3 className="text-[15px] font-bold text-slate-900">Universal Website Scraper</h3>
                  <p className="text-[13px] text-slate-500 font-medium mt-1">Paste your store link to automatically extract products, images, and links into the Knowledge Base.</p>
                </div>
                <div className="flex gap-3">
                  <input 
                    type="text" 
                    value={scrapeUrl}
                    onChange={(e) => setScrapeUrl(e.target.value)}
                    placeholder="https://yourstore.com"
                    className="flex-1 px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition"
                  />
                  <input 
                    type="text" 
                    value={scrapeCurrency}
                    onChange={(e) => setScrapeCurrency(e.target.value)}
                    placeholder="Rs."
                    className="w-20 px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition text-center font-bold"
                  />
                  <button 
                    onClick={handleScrape}
                    disabled={isScraping || !scrapeUrl.trim()}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-md transition-all ${isScraping || !scrapeUrl.trim() ? 'bg-slate-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 hover:-translate-y-0.5'}`}
                  >
                    {isScraping ? 'Scraping...' : 'Scrape Store'}
                  </button>
                </div>
              </div>

              <div className="pt-2 pb-6 border-b border-slate-100">
                <button 
                  onClick={saveConfig}
                  disabled={savingConfig}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-14 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
                >
                  {savingConfig ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                  Save Settings & Knowledge Base
                </button>
              </div>

              <div className="pt-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Keyword Auto-Replies</h3>
                    <p className="text-sm text-slate-500 font-medium mt-1">Bypass AI to instantly reply to specific exact keywords.</p>
                  </div>
                  <button 
                    onClick={() => setConfig({
                      ...config, 
                      keywordReplies: [...(config.keywordReplies || []), { keyword: "", reply: "" }]
                    })}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-xl shadow-md transition-transform hover:-translate-y-0.5"
                  >
                    <Plus className="h-4 w-4" /> Add Rule
                  </button>
                </div>
                
                <div className="space-y-4">
                  {(!config.keywordReplies || config.keywordReplies.length === 0) ? (
                    <div className="text-center p-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 font-bold text-sm">
                      No keyword rules added yet.
                    </div>
                  ) : (
                    config.keywordReplies.map((kr: any, idx: number) => (
                      <div key={idx} className="flex gap-4 items-start bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="w-1/3">
                          <input 
                            type="text" 
                            value={kr.keyword}
                            onChange={(e) => {
                              const newReplies = [...(config.keywordReplies || [])];
                              newReplies[idx].keyword = e.target.value;
                              setConfig({ ...config, keywordReplies: newReplies });
                            }}
                            placeholder="Keyword"
                            className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-700"
                          />
                        </div>
                        <div className="flex-1 relative flex gap-3">
                          <input 
                            type="text" 
                            value={kr.reply}
                            onChange={(e) => {
                              const newReplies = [...(config.keywordReplies || [])];
                              newReplies[idx].reply = e.target.value;
                              setConfig({ ...config, keywordReplies: newReplies });
                            }}
                            placeholder="Exact match auto-reply..."
                            className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-slate-700"
                          />
                          <button 
                            onClick={() => {
                              const newReplies = [...(config.keywordReplies || [])];
                              newReplies.splice(idx, 1);
                              setConfig({ ...config, keywordReplies: newReplies });
                            }}
                            className="bg-rose-50 text-rose-500 hover:bg-rose-100 p-3 rounded-xl transition-colors flex-shrink-0"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-8 border-t border-slate-100">
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-slate-900">Feature Modules</h3>
                  <p className="text-sm text-slate-500 font-medium mt-1">One-click activate advanced AI capabilities and dashboard features.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {AVAILABLE_FEATURES.map((feature) => {
                    const isEnabled = config.enabledFeatures?.includes(feature);
                    return (
                      <div 
                        key={feature}
                        onClick={() => {
                          const current = config.enabledFeatures || [];
                          const updated = isEnabled 
                            ? current.filter((f: any) => f !== feature)
                            : [...current, feature];
                          setConfig({ ...config, enabledFeatures: updated });
                        }}
                        className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                          isEnabled ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-emerald-200'
                        }`}
                      >
                        <span className={`text-sm font-bold ${isEnabled ? 'text-emerald-900' : 'text-slate-700'}`}>
                          {feature}
                        </span>
                        <div className={`w-10 h-6 rounded-full p-1 transition-colors ${isEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                          <div className={`w-4 h-4 bg-white rounded-full transition-transform ${isEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4">
                <button 
                  onClick={saveConfig}
                  disabled={savingConfig}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold h-14 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
                >
                  {savingConfig ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                  Save Configuration
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Promotions Tab */}
        {activeTab === 'promotions' && (
          <div className="p-10 max-w-4xl mx-auto w-full h-full overflow-y-auto">
            <h2 className="text-3xl font-extrabold text-slate-900 mb-8 flex items-center gap-3">
              <MessageSquare className="h-8 w-8 text-emerald-500" /> Promotions & Broadcasts
            </h2>
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-8">
              
              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-900">Audience Segment</label>
                <select 
                  value={promoAudience}
                  onChange={(e) => setPromoAudience(e.target.value)}
                  className="w-full p-4 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-700"
                >
                  <option value="all">All Contacts</option>
                  <option value="hot">Hot Leads (Active Conversation)</option>
                  <option value="cold">Cold Leads (Abandoned Bookings)</option>
                </select>
                <p className="text-xs text-slate-500 font-medium mt-1">Select which group of contacts should receive this broadcast.</p>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-900">Media Attachment (Optional)</label>
                <div className="flex items-center gap-4">
                  <input 
                    type="file" 
                    className="hidden" 
                    ref={promoFileInputRef}
                    onChange={handlePromoFileChange}
                    accept="image/*,video/*,audio/*,application/pdf"
                  />
                  <button 
                    onClick={() => promoFileInputRef.current?.click()}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 rounded-xl font-bold flex items-center gap-2 transition"
                  >
                    <Paperclip className="w-5 h-5" />
                    Attach File
                  </button>
                  {promoMediaName && (
                    <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-3 rounded-xl text-sm font-bold">
                      <span className="truncate max-w-[200px]">{promoMediaName}</span>
                      <button onClick={removePromoMedia} className="text-emerald-900 hover:text-red-500 transition">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-900">Broadcast Message {promoMediaBase64 ? '(Optional Caption)' : ''}</label>
                <textarea 
                  value={promoMessage}
                  onChange={(e) => setPromoMessage(e.target.value)}
                  className="w-full h-32 p-4 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition font-medium"
                  placeholder="Enter your promotional message here... (e.g. Flash Sale: 20% off!)"
                />
              </div>

              <div className="pt-4 border-b border-slate-100 pb-8">
                <button 
                  onClick={sendPromotion}
                  disabled={sendingPromo || (!promoMessage.trim() && !promoMediaBase64)}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-emerald-500 text-white font-bold h-14 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
                >
                  {sendingPromo ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  {sendingPromo ? "Sending Broadcast..." : "Send Now"}
                </button>
              </div>

              {/* Abandoned Booking Recovery Section */}
              <div className="pt-4 border-b border-slate-100 pb-8">
                <div className="mb-6 flex justify-between items-end">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Abandoned Booking Recovery</h3>
                    <p className="text-sm text-slate-500 font-medium mt-1">Automatically send sequence messages to clients who stop responding during a booking or conversation.</p>
                  </div>
                  <button 
                    onClick={saveConfig}
                    disabled={savingConfig}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-6 rounded-xl transition-all shadow-sm flex items-center gap-2 text-sm"
                  >
                    {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Settings
                  </button>
                </div>
                
                <div className="space-y-4">
                  {(() => {
                    const defaultFUs = Array.from({length: 5}).map((_, i) => ({
                      enabled: false,
                      delayMinutes: [60, 1440, 2880, 4320, 7200][i],
                      message: ""
                    }));
                    const currentFUs = config.followUps || [];
                    const fullFUs = defaultFUs.map((df, i) => currentFUs[i] || df);

                    return fullFUs.map((fu: any, idx: number) => (
                      <div key={idx} className={`p-5 rounded-2xl border transition-all ${fu.enabled ? 'bg-white border-emerald-200 shadow-sm' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-bold text-slate-800 flex items-center gap-2">
                            <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs text-white ${fu.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>{idx + 1}</span>
                            Follow-up {idx + 1}
                          </h4>
                          
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <label className="text-xs font-bold text-slate-500">Wait (minutes)</label>
                              <input 
                                type="number"
                                value={fu.delayMinutes}
                                onChange={(e) => {
                                  const newFUs = [...fullFUs];
                                  newFUs[idx] = { ...newFUs[idx], delayMinutes: parseInt(e.target.value) || 0 };
                                  setConfig({ ...config, followUps: newFUs });
                                }}
                                className="w-20 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
                              />
                            </div>
                            <div 
                              onClick={() => {
                                const newFUs = [...fullFUs];
                                newFUs[idx] = { ...newFUs[idx], enabled: !fu.enabled };
                                setConfig({ ...config, followUps: newFUs });
                              }}
                              className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${fu.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                            >
                              <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${fu.enabled ? 'translate-x-6' : 'translate-x-0'}`} />
                            </div>
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>


            </div>
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="p-10 max-w-4xl mx-auto w-full h-full overflow-y-auto">
            <h2 className="text-3xl font-extrabold text-slate-900 mb-8 flex items-center gap-3">
              <ShoppingCart className="h-8 w-8 text-emerald-500" /> Incoming Orders
            </h2>
            <div className="flex gap-4 mb-6">
              {['all', 'pending', 'confirmed', 'cancelled'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setOrderFilter(filter as any)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition-colors ${
                    orderFilter === filter 
                      ? 'bg-slate-900 text-white' 
                      : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 min-h-[500px]">
              {orders.filter(o => orderFilter === 'all' || o.status === orderFilter).length === 0 ? (
                <div className="text-center p-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 font-bold">
                  No orders found.
                </div>
              ) : (
                <div className="grid gap-6">
                  {orders.filter(o => orderFilter === 'all' || o.status === orderFilter).reverse().map((order) => (
                    <div key={order.id} className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                      
                      {/* Product Image */}
                      <div className="w-24 h-24 rounded-xl bg-slate-200 shrink-0 overflow-hidden border border-slate-200 flex items-center justify-center text-slate-400">
                        {order.productImageUrl ? (
                          <img src={order.productImageUrl} alt={order.productName} className="w-full h-full object-cover" />
                        ) : (
                          <ShoppingCart className="h-8 w-8 opacity-50" />
                        )}
                      </div>
                      
                      {/* Order Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-sm font-extrabold text-slate-900">{order.id}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            order.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
                            order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            'bg-slate-200 text-slate-700'
                          }`}>
                            {order.status}
                          </span>
                          <span className="text-xs text-slate-500 ml-auto">{new Date(order.timestamp).toLocaleString()}</span>
                        </div>
                        
                        <h3 className="text-lg font-bold text-slate-800 mb-1 truncate">{order.productName}</h3>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-4 text-sm text-slate-600 mt-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold w-16 text-slate-500">Phone:</span>
                            <span className="font-medium text-slate-800">{order.phone}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold w-16 text-slate-500">Price:</span>
                            <span className="font-medium text-slate-800">{order.price || 'N/A'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold w-16 text-slate-500">Size:</span>
                            <span className="font-medium text-slate-800">{order.size || 'N/A'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold w-16 text-slate-500">Color:</span>
                            <span className="font-medium text-slate-800">{order.color || 'N/A'}</span>
                          </div>
                          <div className="flex items-center gap-2 col-span-1 sm:col-span-2">
                            <span className="font-semibold w-16 text-slate-500 shrink-0">Address:</span>
                            <span className="font-medium text-slate-800 truncate">{order.deliveryAddress || 'Pending'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      {order.status === 'pending' && (
                        <div className="flex flex-row sm:flex-col gap-2 shrink-0 w-full sm:w-auto">
                          <button
                            onClick={async () => {
                              await fetch('/api/whatsapp/orders', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: order.id, status: 'confirmed' })
                              });
                              fetchOrders();
                            }}
                            className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm"
                          >
                            Confirm Order
                          </button>
                          <button
                            onClick={async () => {
                              await fetch('/api/whatsapp/orders', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: order.id, status: 'cancelled' })
                              });
                              fetchOrders();
                            }}
                            className="flex-1 sm:flex-none px-4 py-2.5 bg-white border border-red-200 hover:bg-red-50 text-red-600 text-sm font-bold rounded-xl transition-colors shadow-sm"
                          >
                            Cancel Order
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      {/* Contacts / Leads Tab */}
      {activeTab === 'contacts' && (
        <div className="p-8 max-w-[1400px] mx-auto w-full h-full overflow-y-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h2 className="text-[22px] font-bold text-slate-900 flex items-center gap-2">
                <Users className="h-6 w-6 text-emerald-500" /> Pipeline & Lead Management
              </h2>
              <p className="text-sm text-slate-500 mt-1 font-medium">Nurture and manage your WhatsApp leads through the sales pipeline.</p>
            </div>
            
            {/* View Mode & Search */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="bg-slate-100/70 p-1 rounded-xl flex items-center text-sm font-semibold border border-slate-200/50">
                <button 
                  onClick={() => setContactsViewMode("board")}
                  className={`px-4 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${contactsViewMode === 'board' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Activity className="w-4 h-4" /> Board View
                </button>
                <button 
                  onClick={() => setContactsViewMode("list")}
                  className={`px-4 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${contactsViewMode === 'list' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Users className="w-4 h-4" /> List View
                </button>
              </div>
            </div>
          </div>

          {/* Search bar and counts */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6 bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.01)]">
            <div className="bg-[#f5f6f8] border border-slate-200/60 rounded-xl flex items-center px-4 py-2 gap-3 w-full md:max-w-md focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
              <Search className="h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search leads by name or phone..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-sm w-full placeholder:text-slate-400 text-slate-700 font-medium" 
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 self-end md:self-center">
              Total: {Object.keys(customers).length} Contacts
            </div>
          </div>

          {contactsViewMode === 'board' ? (
            /* KANBAN BOARD VIEW */
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start min-h-[600px] pb-10">
              {(() => {
                const stages: { id: "new" | "qualified" | "warm" | "cold" | "completed"; title: string; color: string; bg: string; dot: string }[] = [
                  { id: 'new', title: 'New Leads', color: 'border-blue-500', bg: 'bg-blue-50/40', dot: 'bg-blue-500' },
                  { id: 'qualified', title: 'Qualified', color: 'border-amber-400', bg: 'bg-amber-50/30', dot: 'bg-amber-400' },
                  { id: 'warm', title: 'Warm Leads', color: 'border-purple-500', bg: 'bg-purple-50/30', dot: 'bg-purple-500' },
                  { id: 'cold', title: 'Cold Leads', color: 'border-slate-400', bg: 'bg-slate-50/70', dot: 'bg-slate-400' },
                  { id: 'completed', title: 'Sales Completed', color: 'border-emerald-500', bg: 'bg-emerald-50/30', dot: 'bg-emerald-500' }
                ];

                const getCustomerStage = (c: any): "new" | "qualified" | "warm" | "cold" | "completed" => {
                  if (c.pipelineStage) return c.pipelineStage;
                  if (c.leadStatus === "cold") return "cold";
                  const hasOrder = orders.some((o: any) => o.phone === c.phone && (o.status === "confirmed" || o.status === "delivered"));
                  if (hasOrder) return "completed";
                  if (c.leadStatus === "hot") return "warm";
                  if (c.name && c.name !== c.phone) return "qualified";
                  return "new";
                };

                const filteredCustomers = Object.values(customers).filter(c => {
                  if (!searchQuery) return true;
                  const searchLower = searchQuery.toLowerCase();
                  const nameMatch = c.name?.toLowerCase().includes(searchLower);
                  const phoneMatch = c.phone.includes(searchLower);
                  const tagMatch = c.tags?.some((t: string) => t.toLowerCase().includes(searchLower));
                  return nameMatch || phoneMatch || tagMatch;
                });

                return stages.map(stage => {
                  const stageLeads = filteredCustomers.filter(c => getCustomerStage(c) === stage.id);
                  return (
                    <div key={stage.id} className={`flex flex-col rounded-2xl border border-slate-100 ${stage.bg} p-4 min-h-[500px] max-h-[750px]`}>
                      {/* Column Header */}
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200/50 text-slate-800">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${stage.dot}`}></span>
                          <h3 className="font-bold text-sm">{stage.title}</h3>
                        </div>
                        <span className="bg-white border border-slate-200/60 text-slate-600 text-xs px-2 py-0.5 rounded-full font-bold shadow-sm">
                          {stageLeads.length}
                        </span>
                      </div>

                      {/* Card List Container */}
                      <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                        {stageLeads.length === 0 ? (
                          <div className="text-center py-8 text-xs text-slate-400 font-medium">No leads</div>
                        ) : (
                          stageLeads.map(lead => {
                            const leadName = lead.name && lead.name !== lead.phone ? lead.name : 'Unknown User';
                            const hasAi = lead.aiEnabled !== false;
                            
                            return (
                              <div key={lead.phone} className="bg-white rounded-xl border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02)] p-4 flex flex-col gap-3 hover:shadow-md transition-all">
                                {/* Header */}
                                <div className="flex items-start justify-between min-w-0">
                                  <div className="min-w-0">
                                    <h4 className="font-bold text-sm text-slate-800 truncate" title={leadName}>{leadName}</h4>
                                    <p className="text-[11px] text-slate-400 font-semibold mt-0.5">+{lead.phone}</p>
                                  </div>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${hasAi ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-500'}`}>
                                    {hasAi ? 'Autopilot' : 'Copilot'}
                                  </span>
                                </div>

                                {/* Tags */}
                                <div className="flex flex-wrap gap-1 items-center">
                                  {lead.tags && lead.tags.map((t: string) => (
                                    <span key={t} className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-slate-50 border border-slate-200/80 px-2 py-0.5 rounded-full text-slate-600">
                                      {t}
                                      <button 
                                        onClick={() => {
                                          const nextTags = lead.tags.filter((x: string) => x !== t);
                                          updateCustomerField(lead.phone, { tags: nextTags });
                                        }}
                                        className="text-slate-400 hover:text-red-500 text-[9px] ml-1"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}
                                  
                                  {editingTagsPhone === lead.phone ? (
                                    <div className="flex items-center gap-1.5 mt-1 w-full">
                                      <input 
                                        type="text" 
                                        placeholder="Add tag..."
                                        value={newTagInput}
                                        onChange={(e) => setNewTagInput(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && newTagInput.trim()) {
                                            const nextTags = [...(lead.tags || []), newTagInput.trim()];
                                            updateCustomerField(lead.phone, { tags: nextTags });
                                            setNewTagInput("");
                                            setEditingTagsPhone(null);
                                          }
                                        }}
                                        className="text-[11px] border border-slate-300 rounded px-1.5 py-0.5 w-20 focus:outline-none focus:border-emerald-500 font-medium"
                                        autoFocus
                                      />
                                      <button 
                                        onClick={() => {
                                          if (newTagInput.trim()) {
                                            const nextTags = [...(lead.tags || []), newTagInput.trim()];
                                            updateCustomerField(lead.phone, { tags: nextTags });
                                            setNewTagInput("");
                                          }
                                          setEditingTagsPhone(null);
                                        }}
                                        className="text-[10px] font-bold text-emerald-600"
                                      >
                                        Add
                                      </button>
                                      <button onClick={() => setEditingTagsPhone(null)} className="text-[10px] text-slate-400 font-bold">Cancel</button>
                                    </div>
                                  ) : (
                                    <button 
                                      onClick={() => {
                                        setEditingTagsPhone(lead.phone);
                                        setNewTagInput("");
                                      }}
                                      className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50/50 hover:bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100"
                                    >
                                      + Tag
                                    </button>
                                  )}
                                </div>

                                {/* Actions & Select Stage */}
                                <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-1 gap-2">
                                  <select 
                                    value={stage.id} 
                                    onChange={(e) => updateCustomerField(lead.phone, { pipelineStage: e.target.value })}
                                    className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-slate-600 font-bold w-[100px] outline-none focus:border-emerald-500"
                                  >
                                    <option value="new">New Lead</option>
                                    <option value="qualified">Qualified</option>
                                    <option value="warm">Warm Lead</option>
                                    <option value="cold">Cold Lead</option>
                                    <option value="completed">Completed</option>
                                  </select>

                                  <button 
                                    onClick={() => {
                                      setSelectedChat(lead.phone);
                                      setActiveTab('inbox');
                                    }}
                                    className="text-[11px] font-extrabold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                                  >
                                    <Inbox className="w-3 h-3" /> Chat
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            /* ORIGINAL LIST TABLE VIEW */
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden min-h-[500px]">
              {Object.keys(customers).length === 0 ? (
                <div className="text-center p-12 text-slate-400 font-bold">
                  No contacts found.
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Name / Phone</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Tags</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Pipeline Stage</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(customers)
                      .filter(c => {
                        if (!searchQuery) return true;
                        const searchLower = searchQuery.toLowerCase();
                        const nameMatch = c.name?.toLowerCase().includes(searchLower);
                        const phoneMatch = c.phone.includes(searchLower);
                        const tagMatch = c.tags?.some((t: string) => t.toLowerCase().includes(searchLower));
                        return nameMatch || phoneMatch || tagMatch;
                      })
                      .map((customer) => {
                        const getCustomerStage = (c: any): "new" | "qualified" | "warm" | "cold" | "completed" => {
                          if (c.pipelineStage) return c.pipelineStage;
                          if (c.leadStatus === "cold") return "cold";
                          const hasOrder = orders.some((o: any) => o.phone === c.phone && (o.status === "confirmed" || o.status === "delivered"));
                          if (hasOrder) return "completed";
                          if (c.leadStatus === "hot") return "warm";
                          if (c.name && c.name !== c.phone) return "qualified";
                          return "new";
                        };
                        const stage = getCustomerStage(customer);
                        
                        return (
                          <tr key={customer.phone} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-4">
                                <div className="h-10 w-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-bold">
                                  {customer.name ? customer.name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900">{customer.name || 'Unknown User'}</div>
                                  <div className="text-sm text-slate-500 font-medium">+{customer.phone}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex flex-wrap gap-1 items-center max-w-xs">
                                {customer.tags && customer.tags.map((t: string) => (
                                  <span key={t} className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full text-slate-600">
                                    {t}
                                    <button 
                                      onClick={() => {
                                        const nextTags = customer.tags.filter((x: string) => x !== t);
                                        updateCustomerField(customer.phone, { tags: nextTags });
                                      }}
                                      className="text-slate-400 hover:text-red-500 text-[9px] ml-1"
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                                {editingTagsPhone === customer.phone ? (
                                  <div className="flex items-center gap-1.5">
                                    <input 
                                      type="text" 
                                      placeholder="Tag..."
                                      value={newTagInput}
                                      onChange={(e) => setNewTagInput(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && newTagInput.trim()) {
                                          const nextTags = [...(customer.tags || []), newTagInput.trim()];
                                          updateCustomerField(customer.phone, { tags: nextTags });
                                          setNewTagInput("");
                                          setEditingTagsPhone(null);
                                        }
                                      }}
                                      className="text-[11px] border border-slate-300 rounded px-1.5 py-0.5 w-16 focus:outline-none"
                                      autoFocus
                                    />
                                    <button 
                                      onClick={() => {
                                        if (newTagInput.trim()) {
                                          const nextTags = [...(customer.tags || []), newTagInput.trim()];
                                          updateCustomerField(customer.phone, { tags: nextTags });
                                          setNewTagInput("");
                                        }
                                        setEditingTagsPhone(null);
                                      }}
                                      className="text-[10px] font-bold text-emerald-600"
                                    >
                                      Add
                                    </button>
                                  </div>
                                ) : (
                                  <button 
                                    onClick={() => {
                                      setEditingTagsPhone(customer.phone);
                                      setNewTagInput("");
                                    }}
                                    className="text-[9px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-100"
                                  >
                                    + Add
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-6">
                              <select 
                                value={stage} 
                                onChange={(e) => updateCustomerField(customer.phone, { pipelineStage: e.target.value })}
                                className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-slate-600 font-bold w-[120px] outline-none"
                              >
                                <option value="new">New Lead</option>
                                <option value="qualified">Qualified</option>
                                <option value="warm">Warm Lead</option>
                                <option value="cold">Cold Lead</option>
                                <option value="completed">Completed</option>
                              </select>
                            </td>
                            <td className="py-4 px-6 text-right">
                              <button 
                                onClick={() => {
                                  setSelectedChat(customer.phone);
                                  setActiveTab('inbox');
                                }}
                                className="text-sm font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors"
                              >
                                Message
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
      
      </div>

    </div>
  );
}
