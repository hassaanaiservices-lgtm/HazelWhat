"use client";

import React, { useEffect, useState, useRef } from "react";
import { MessageCircle, QrCode, Loader2, CheckCircle2, ShieldCheck, Zap, X, Save, MessageSquare, Settings, Plus, Trash2, Search, MoreVertical, Phone, Video, Paperclip, Smile, Mic, CheckCheck, User, Check, Send, StopCircle, Inbox, Bot, Network, BookOpen, Users, AlertCircle, ShoppingCart, Activity, Eye, EyeOff, RefreshCw, Pause, Play, Smartphone, Square, Package, Edit3, Upload, ExternalLink, Image as ImageIcon, Tag, Globe, Sparkles, Volume2, VolumeX, BellRing, Bell, LogOut, FileText, Calendar, MapPin, Clock } from "lucide-react";
import EmojiPicker from "emoji-picker-react";

export default function DashboardPage() {
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          window.location.href = '/login';
          return;
        }
        const data = await res.json();
        if (!data.authenticated || !data.user) {
          window.location.href = '/login';
          return;
        }
        setSessionData(data.user);
        if (data.tenant) {
          setConfig((prev: any) => ({
            ...prev,
            systemPrompt: data.tenant.systemPrompt || prev.systemPrompt,
            productInfo: data.tenant.knowledgeBase || prev.productInfo,
            products: data.tenant.products || prev.products || []
          }));
        }
      } catch (err) {
        window.location.href = '/login';
      }
    }
    checkAuth();
  }, []);

  const [sessionData, setSessionData] = useState<any>(null);
  const [status, setStatus] = useState<"idle" | "creating" | "waiting_qr" | "scanning" | "connected" | "error">("idle");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrGeneratedAt, setQrGeneratedAt] = useState<number | null>(null);
  const [qrSecondsLeft, setQrSecondsLeft] = useState<number>(20);
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
  
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingKB, setSavingKB] = useState(false);
  const [kbSaveSuccess, setKbSaveSuccess] = useState(false);
  const [savingKeywords, setSavingKeywords] = useState(false);
  const [keywordsSaveSuccess, setKeywordsSaveSuccess] = useState(false);
  const [savingFollowUps, setSavingFollowUps] = useState(false);
  const [followUpsSaveSuccess, setFollowUpsSaveSuccess] = useState(false);
  const [isAutopilotSaving, setIsAutopilotSaving] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<string>("Not Checked");
  const [apiKeyError, setApiKeyError] = useState<string>("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scrapeCurrency, setScrapeCurrency] = useState("Rs.");
  const [isScraping, setIsScraping] = useState(false);

  // Product Catalog Management State
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
  const prodFileInputRef = useRef<HTMLInputElement>(null);

  const resetProductForm = () => {
    setProdTitle("");
    setProdPrice("");
    setProdImage("");
    setProdLink("");
    setProdCategory("");
    setProdDesc("");
    setProdVariations("");
    setEditingProduct(null);
  };

  const openAddProductModal = () => {
    resetProductForm();
    setShowProductModal(true);
  };

  const openEditProductModal = (prod: any) => {
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

  const formatProductsText = (products: any[], currency: string = "$") => {
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

  const saveProductsAndConfig = (updatedProducts: any[], customProductInfo?: string) => {
    const formattedCatalog = formatProductsText(updatedProducts, scrapeCurrency || "$");
    const updatedCatalogInfo = customProductInfo !== undefined 
      ? customProductInfo 
      : (updatedProducts.length === 0 ? "" : (formattedCatalog || config.productInfo));

    const updatedConfig = {
      ...config,
      products: updatedProducts,
      productInfo: updatedCatalogInfo
    };
    setConfig(updatedConfig);
    fetch("/api/whatsapp/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedConfig)
    }).catch(console.error);
  };

  const handleClearCatalog = () => {
    if (!confirm("Are you sure you want to clear the entire product catalog? This will remove all loaded products and reset the catalog knowledge base.")) {
      return;
    }
    setScrapeUrl("");
    saveProductsAndConfig([], "");
  };

  const handleSaveProductModal = () => {
    if (!prodTitle.trim()) {
      alert("Product Title is required");
      return;
    }
    const currentList = config.products || [];
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
      price: prodPrice.trim() || `${scrapeCurrency}0.00`,
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

    saveProductsAndConfig(updated);
    setShowProductModal(false);
    resetProductForm();
  };

  const handleDeleteProduct = (productId: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    const updated = (config.products || []).filter((p: any) => p.id !== productId);
    saveProductsAndConfig(updated);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setProdImage(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const [activeTab, setActiveTabRaw] = useState<"dashboard" | "inbox" | "agents" | "channels" | "promotions" | "orders" | "knowledge" | "contacts" | "analytics" | "settings" | "leads-revival">("dashboard");

  const setActiveTab = (tab: "dashboard" | "inbox" | "agents" | "channels" | "promotions" | "orders" | "knowledge" | "contacts" | "analytics" | "settings" | "leads-revival") => {
    setActiveTabRaw(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Sync tab from URL query on initial load & popstate (browser back/forward)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const syncTabFromUrl = () => {
        const params = new URLSearchParams(window.location.search);
        const urlTab = params.get('tab');
        const validTabs = ["dashboard", "inbox", "agents", "channels", "promotions", "orders", "knowledge", "contacts", "analytics", "settings", "leads-revival"];
        if (urlTab && validTabs.includes(urlTab)) {
          setActiveTabRaw(urlTab as any);
        }
      };

      syncTabFromUrl();
      window.addEventListener('popstate', syncTabFromUrl);
      return () => window.removeEventListener('popstate', syncTabFromUrl);
    }
  }, []);

  const [inboxFilter, setInboxFilter] = useState<"all" | "normal" | "groups" | "revival">("all");
  const [inboxSearch, setInboxSearch] = useState<string>("");
  const [revivalCampaigns, setRevivalCampaigns] = useState<any[]>([]);
  const [activeRevivalCampaign, setActiveRevivalCampaign] = useState<any | null>(null);
  const [creatingCampaign, setCreatingCampaign] = useState(false);

  // Campaign Form State
  const [revivalMessage, setRevivalMessage] = useState("Hi {Name}! We noticed you had an inquiry with us regarding {Product}. We'd love to help you get started — do you have any questions?");
  const [revivalAudience, setRevivalAudience] = useState("all");
  const [revivalTimeStart, setRevivalTimeStart] = useState("09:00");
  const [revivalTimeEnd, setRevivalTimeEnd] = useState("21:00");
  const [revivalDelayMinutes, setRevivalDelayMinutes] = useState(5);
  const [targetDuration, setTargetDuration] = useState(1);
  const [targetDurationUnit, setTargetDurationUnit] = useState<"Days" | "Hours">("Days");
  const [isFileUploaded, setIsFileUploaded] = useState(false);
  const [revivalDailyCap, setRevivalDailyCap] = useState(80);
  const [revivalMediaBase64, setRevivalMediaBase64] = useState<string | null>(null);
  const [revivalMediaMime, setRevivalMediaMime] = useState<string | null>(null);
  const [revivalMediaName, setRevivalMediaName] = useState<string | null>(null);

  // Voice Note & Phase 2 Drip state
  const [revivalMessageType, setRevivalMessageType] = useState<"text" | "media" | "voice">("text");
  const [revivalVoiceBase64, setRevivalVoiceBase64] = useState<string | null>(null);
  const [revivalVoiceMimetype, setRevivalVoiceMimetype] = useState<string | null>(null);
  const [revivalVoiceName, setRevivalVoiceName] = useState<string | null>(null);
  const [revivalVoicePreviewUrl, setRevivalVoicePreviewUrl] = useState<string | null>(null);

  // Live mic recording states for Revival Phase 1 & Phase 2
  const [isRevivalRecording, setIsRevivalRecording] = useState(false);
  const [revivalRecordTimer, setRevivalRecordTimer] = useState(0);
  const revivalRecorderRef = useRef<MediaRecorder | null>(null);
  const revivalTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [p2Enabled, setP2Enabled] = useState(true);
  const [p2IntervalDays, setP2IntervalDays] = useState(3);
  const [p2MaxFollowUps, setP2MaxFollowUps] = useState(3);
  const [p2Mode, setP2Mode] = useState<"text" | "media" | "voice">("text");
  const [p2Message1, setP2Message1] = useState("Hey {Name}! Just checking in to see if you had a chance to review our previous message?");
  const [p2Message2, setP2Message2] = useState("Hi {Name}, we've got a quick update regarding your request. Would love to help out!");
  const [p2Message3, setP2Message3] = useState("Final check-in! Let us know if you're still interested or if we should stop sending updates.");
  
  const [p2MediaBase64, setP2MediaBase64] = useState<string | null>(null);
  const [p2MediaMimetype, setP2MediaMimetype] = useState<string | null>(null);
  const [p2MediaName, setP2MediaName] = useState<string | null>(null);
  const [p2VoiceBase64, setP2VoiceBase64] = useState<string | null>(null);
  const [p2VoiceMimetype, setP2VoiceMimetype] = useState<string | null>(null);
  const [p2VoiceName, setP2VoiceName] = useState<string | null>(null);
  const [p2VoicePreviewUrl, setP2VoicePreviewUrl] = useState<string | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesInput, setNotesInput] = useState<string>("");
  const [generatingNotesId, setGeneratingNotesId] = useState<string | null>(null);

  const [isP2Recording, setIsP2Recording] = useState(false);
  const [p2RecordTimer, setP2RecordTimer] = useState(0);
  const p2RecorderRef = useRef<MediaRecorder | null>(null);
  const p2TimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const voiceFileInputRef = useRef<HTMLInputElement>(null);
  const p2FileInputRef = useRef<HTMLInputElement>(null);
  const p2VoiceFileInputRef = useRef<HTMLInputElement>(null);

  // Overview Period Timeframe Filter state (Weekly / Monthly / Yearly)
  const [periodFilter, setPeriodFilter] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');

  // Phone Number Pairing states
  const [waConnectMode, setWaConnectMode] = useState<'qr' | 'pairing'>('qr');
  const [waPairingPhone, setWaPairingPhone] = useState('');
  const [waPairingCode, setWaPairingCode] = useState<string | null>(null);
  const [isGeneratingPairingCode, setIsGeneratingPairingCode] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);

  // Custom states and parsing helpers for target phone lists
  const [customPhonesInput, setCustomPhonesInput] = useState("");
  const [customPhones, setCustomPhones] = useState<string[]>([]);
  const customPhonesFileInputRef = useRef<HTMLInputElement>(null);

  const parsePhones = (rawText: string) => {
    if (!rawText) return [];
    const text = rawText
      .replace(/[\u2013\u2014\u2212]/g, "-")
      .replace(/[\u00A0\u200B\u200C\u200D]/g, " ")
      .replace(/[\/\\]/g, " ");

    const found = new Set<string>();

    const normalizeAndAdd = (candidate: string) => {
      let digits = candidate.replace(/[^\d]/g, "");
      if (digits.startsWith("00")) {
        digits = digits.substring(2);
      }
      if (digits.startsWith("0") && digits.length === 11) {
        digits = "92" + digits.substring(1);
      }
      if (digits.length >= 10 && digits.length <= 15) {
        found.add(digits);
      }
    };

    const matches = text.match(/(?:\+?\d{1,4}[\s.-]?)?(?:\(?\d{2,5}\)?[\s.-]?)?\d{2,5}[\s.-]?\d{2,5}(?:[\s.-]?\d{2,7})?/g) || [];
    for (const m of matches) {
      normalizeAndAdd(m);
    }

    const tokens = text.split(/[\r\n,;\t|]+/);
    for (const token of tokens) {
      normalizeAndAdd(token);
    }

    const result = Array.from(found);
    return result.filter(
      num => !result.some(other => other !== num && other.includes(num) && other.length > num.length)
    );
  };

  const getActiveHours = (start = revivalTimeStart, end = revivalTimeEnd) => {
    const startH = parseInt(start.split(":")[0]) || 9;
    const endH = parseInt(end.split(":")[0]) || 21;
    return Math.max(1, endH - startH);
  };

  const handleDelayChange = (newDelayMins: number, customCount = customPhones.length, start = revivalTimeStart, end = revivalTimeEnd) => {
    setRevivalDelayMinutes(newDelayMins);
    if (customCount === 0) return;
    const activeHrs = getActiveHours(start, end);
    if (targetDurationUnit === "Days") {
      const days = (customCount * newDelayMins) / (activeHrs * 60);
      setTargetDuration(Math.round(days * 10) / 10);
    } else {
      const hours = (customCount * newDelayMins) / 60;
      setTargetDuration(Math.round(hours * 10) / 10);
    }
  };

  const handleTargetDurationChange = (newDuration: number, customCount = customPhones.length, start = revivalTimeStart, end = revivalTimeEnd) => {
    setTargetDuration(newDuration);
    if (customCount === 0) return;
    const activeHrs = getActiveHours(start, end);
    if (targetDurationUnit === "Days") {
      const delay = (newDuration * activeHrs * 60) / customCount;
      setRevivalDelayMinutes(Math.round(delay * 10) / 10);
    } else {
      const delay = (newDuration * 60) / customCount;
      setRevivalDelayMinutes(Math.round(delay * 10) / 10);
    }
  };

  const handleTargetDurationUnitChange = (newUnit: "Days" | "Hours", currentDuration = targetDuration, start = revivalTimeStart, end = revivalTimeEnd) => {
    setTargetDurationUnit(newUnit);
    const activeHrs = getActiveHours(start, end);
    if (newUnit === "Days") {
      const days = currentDuration / activeHrs;
      setTargetDuration(Math.round(days * 10) / 10);
    } else {
      const hours = currentDuration * activeHrs;
      setTargetDuration(Math.round(hours * 10) / 10);
    }
  };

  const handleTimeStartChange = (val: string) => {
    setRevivalTimeStart(val);
    if (isFileUploaded && customPhones.length > 0) {
      const activeHrs = getActiveHours(val, revivalTimeEnd);
      if (targetDurationUnit === "Days") {
        const days = (customPhones.length * revivalDelayMinutes) / (activeHrs * 60);
        setTargetDuration(Math.round(days * 10) / 10);
      }
    }
  };

  const handleTimeEndChange = (val: string) => {
    setRevivalTimeEnd(val);
    if (isFileUploaded && customPhones.length > 0) {
      const activeHrs = getActiveHours(revivalTimeStart, val);
      if (targetDurationUnit === "Days") {
        const days = (customPhones.length * revivalDelayMinutes) / (activeHrs * 60);
        setTargetDuration(Math.round(days * 10) / 10);
      }
    }
  };

  const handleCustomPhonesChange = (val: string) => {
    setCustomPhonesInput(val);
    const parsed = parsePhones(val);
    setCustomPhones(parsed);
    if (parsed.length > 0 && isFileUploaded) {
      const activeHrs = getActiveHours();
      if (targetDurationUnit === "Days") {
        const days = (parsed.length * revivalDelayMinutes) / (activeHrs * 60);
        setTargetDuration(Math.round(days * 10) / 10);
      } else {
        const hours = (parsed.length * revivalDelayMinutes) / 60;
        setTargetDuration(Math.round(hours * 10) / 10);
      }
    }
  };

  const handleCustomPhonesFileUploaded = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const setPhones = (phones: string[]) => {
      setCustomPhones(phones);
      setCustomPhonesInput(phones.join("\n"));
      setRevivalAudience("custom");
      setIsFileUploaded(true);

      const activeHrs = getActiveHours();
      const defaultDelay = 5;
      setRevivalDelayMinutes(defaultDelay);
      const days = (phones.length * defaultDelay) / (activeHrs * 60);
      if (days < 1) {
        setTargetDurationUnit("Hours");
        setTargetDuration(Math.round(((phones.length * defaultDelay) / 60) * 10) / 10);
      } else {
        setTargetDurationUnit("Days");
        setTargetDuration(Math.round(days * 10) / 10);
      }
    };

    const isPDF = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (isPDF) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        try {
          const res = await fetch("/api/whatsapp/parse-leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mediaBase64: base64, mimetype: file.type || "application/pdf", fileName: file.name })
          });
          const data = await res.json();
          if (data.success && data.count >= 1) {
            setPhones(data.phones);
            alert(`✅ Loaded ${data.count} phone numbers from "${file.name}"`);
          } else if (data.error) {
            alert(`❌ Failed to parse PDF file: ${data.error}`);
          } else {
            alert(`No valid phone numbers found in "${file.name}". Please ensure the file contains valid 10 to 15 digit phone numbers.`);
          }
        } catch (err: any) {
          alert(`Failed to upload/parse PDF: ${err.message}`);
        }
      };
      reader.readAsDataURL(file);
    } else {
      // Plain text / CSV / TSV parsing
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const phones = parsePhones(text);
        if (phones.length >= 1) {
          setPhones(phones);
          alert(`✅ Loaded ${phones.length} phone numbers from "${file.name}"`);
        } else {
          alert(`No valid phone numbers found in "${file.name}".`);
        }
      };
      reader.readAsText(file);
    }
  };

  const [orders, setOrders] = useState<any[]>([]);
  const [orderFilter, setOrderFilter] = useState<'all' | 'orders' | 'appointments' | 'pending' | 'confirmed' | 'cancelled'>('all');
  const [leadFilter, setLeadFilter] = useState<'all' | 'hot' | 'cold'>('all');
  const [analytics, setAnalytics] = useState<any>(null);

  // Sound Alert for Received Orders
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [newOrderBanner, setNewOrderBanner] = useState<{ id: string; customerName: string; productName: string; amount?: string; time: string } | null>(null);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const isFirstOrderFetchRef = useRef<boolean>(true);

  useEffect(() => {
    const storedSound = localStorage.getItem("hazel_order_sound_enabled");
    if (storedSound !== null) {
      setSoundEnabled(storedSound === "true");
    }
  }, []);

  // Unlock Web Audio API on user interaction to handle browser autoplay policies
  useEffect(() => {
    const unlockAudio = () => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          if (ctx.state === "suspended") {
            ctx.resume();
          }
        }
      } catch (e) {}
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
    window.addEventListener("click", unlockAudio);
    window.addEventListener("keydown", unlockAudio);
    return () => {
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  const toggleSound = () => {
    const nextState = !soundEnabled;
    setSoundEnabled(nextState);
    localStorage.setItem("hazel_order_sound_enabled", String(nextState));
    if (nextState) {
      playSweetOrderSound(0.95);
    }
  };

  const playSweetOrderSound = (vol = 0.95) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const now = ctx.currentTime;

      // Dynamics Compressor to boost loudness without clipping
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-10, now);
      compressor.knee.setValueAtTime(40, now);
      compressor.ratio.setValueAtTime(12, now);
      compressor.attack.setValueAtTime(0, now);
      compressor.release.setValueAtTime(0.25, now);
      compressor.connect(ctx.destination);

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(vol, now);
      masterGain.connect(compressor);

      // Loud, bright & sweet notification chime arpeggio: C5 -> E5 -> G5 -> B5 -> E6
      const notes = [
        { freq: 523.25, start: 0.00, duration: 0.45 }, // C5
        { freq: 659.25, start: 0.08, duration: 0.45 }, // E5
        { freq: 783.99, start: 0.16, duration: 0.50 }, // G5
        { freq: 987.77, start: 0.24, duration: 0.60 }, // B5
        { freq: 1318.51, start: 0.34, duration: 0.90 },// E6 sparkling finish
      ];

      notes.forEach(({ freq, start, duration }) => {
        const startTime = now + start;

        // Core warm sine wave
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(freq, startTime);
        
        gain1.gain.setValueAtTime(0.0001, startTime);
        gain1.gain.exponentialRampToValueAtTime(0.65, startTime + 0.015);
        gain1.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
        
        osc1.connect(gain1);
        gain1.connect(masterGain);
        osc1.start(startTime);
        osc1.stop(startTime + duration);

        // Bright crystal triangle overtone for projection & loudness
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "triangle";
        osc2.frequency.setValueAtTime(freq * 2, startTime);
        
        gain2.gain.setValueAtTime(0.0001, startTime);
        gain2.gain.exponentialRampToValueAtTime(0.22, startTime + 0.01);
        gain2.gain.exponentialRampToValueAtTime(0.0001, startTime + (duration * 0.7));
        
        osc2.connect(gain2);
        gain2.connect(masterGain);
        osc2.start(startTime);
        osc2.stop(startTime + duration);
      });
    } catch (e) {
      console.warn("Could not play sweet order sound:", e);
    }
  };

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

  const isContactActiveLead = (c: any): boolean => {
    if (!c || !c.phone) return false;
    if (c.isLead === true) return true;
    if (c.isLead === false) return false;

    // Check if chat history has at least one user message
    const userChat = chats[c.phone];
    if (Array.isArray(userChat) && userChat.some((m: any) => m.role === 'user')) return true;

    // Check if customer has orders or bookings
    const hasOrder = Array.isArray(orders) && orders.some((o: any) => o.phone === c.phone);
    if (hasOrder) return true;

    // Check if explicitly set stage by user or has revival/lead tags
    if (c.pipelineStageSetByUser && c.pipelineStage) return true;
    if (c.tags && Array.isArray(c.tags) && c.tags.some((t: string) => t.includes('lead') || t.includes('revival') || t.includes('booked') || t.includes('replied'))) return true;

    return false;
  };

  const getSelectedLeadsCount = (aud = revivalAudience) => {
    if (aud === "custom") {
      return customPhones.length;
    }
    const customerList = Object.values(customers);
    const activeLeadList = customerList.filter(c => isContactActiveLead(c));
    if (aud === "all") {
      return activeLeadList.length;
    } else if (aud === "cold") {
      return activeLeadList.filter(c => c.leadStatus === "cold" || c.pipelineStage === "cold").length;
    } else if (aud === "hot") {
      return activeLeadList.filter(c => c.leadStatus === "hot" || c.pipelineStage === "warm").length;
    } else if (aud === "new") {
      return activeLeadList.filter(c => !c.pipelineStage || c.pipelineStage === "new").length;
    }
    return 0;
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
  const revivalFileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  const handleChatScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    // If distance from bottom > 120px, user is reading older history
    const isUp = scrollHeight - scrollTop - clientHeight > 120;
    setUserScrolledUp(isUp);
  };

  useEffect(() => {
    // When changing selected chat, reset scroll state and scroll to bottom
    setUserScrolledUp(false);
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' as any });
  }, [selectedChat]);

  useEffect(() => {
    // Only auto-scroll to bottom on chat updates if user is not reading history
    if (!userScrolledUp) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chats]);

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

        if (isFirstOrderFetchRef.current) {
          // First fetch: store existing order IDs without alerting
          const initialIds = new Set<string>();
          data.forEach((o: any) => {
            if (o.id) initialIds.add(String(o.id));
          });
          knownOrderIdsRef.current = initialIds;
          isFirstOrderFetchRef.current = false;
        } else {
          // Subsequent fetch: check for brand new incoming orders
          let brandNewOrder: any = null;
          data.forEach((o: any) => {
            const orderId = String(o.id);
            if (orderId && !knownOrderIdsRef.current.has(orderId)) {
              knownOrderIdsRef.current.add(orderId);
              brandNewOrder = o;
            }
          });

          if (brandNewOrder) {
            // Play sweet sound alert if enabled
            if (soundEnabled) {
              playSweetOrderSound(0.95);
            }

            // Trigger floating order alert banner
            const customerName = customers[brandNewOrder.phone]?.name || brandNewOrder.phone || "Customer";
            setNewOrderBanner({
              id: brandNewOrder.id,
              customerName,
              productName: brandNewOrder.productName || "New Order",
              amount: brandNewOrder.price || brandNewOrder.amount || "",
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
          }
        }
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

  const validateApiKey = async (apiKey: string) => {
    if (!apiKey || !apiKey.trim()) {
      setApiKeyStatus("Not Configured");
      setApiKeyError("");
      return;
    }

    setApiKeyStatus("checking");
    setApiKeyError("");

    try {
      const res = await fetch("/api/whatsapp/config/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey })
      });
      const data = await res.json();
      if (data.success) {
        setApiKeyStatus("Active");
        setApiKeyError("");
      } else {
        setApiKeyStatus(data.status || "Error");
        setApiKeyError(data.error || "Failed to validate key.");
      }
    } catch (e: any) {
      setApiKeyStatus("Error");
      setApiKeyError(e.message || "Network error.");
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/whatsapp/config");
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        // Validate the unified API key
        validateApiKey(data.config.apiKey || data.config.anthropicApiKey || data.config.openRouterApiKey);
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

  const fetchRevivalCampaigns = async () => {
    try {
      const res = await fetch("/api/whatsapp/leads-revival");
      const data = await res.json();
      if (data.success) {
        setRevivalCampaigns(data.campaigns || []);
        setActiveRevivalCampaign(data.activeCampaign || null);
      }
    } catch (e) {
      console.warn("Failed to fetch revival campaigns:", e);
    }
  };

  useEffect(() => {
    fetchChats();
    fetchConfig();
    fetchPromotions();
    fetchOrders();
    fetchAnalytics();
    fetchRevivalCampaigns();
    let pollInterval = setInterval(() => {
      fetchChats();
      fetchOrders();
    }, 3000);
    return () => clearInterval(pollInterval);
  }, [soundEnabled]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeTab === "leads-revival" || activeRevivalCampaign) {
      interval = setInterval(fetchRevivalCampaigns, 5000);
    }
    return () => clearInterval(interval);
  }, [activeTab, activeRevivalCampaign]);

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
              // Only update if it's a genuinely new QR (different timestamp)
              if (data.session.qrGeneratedAt && data.session.qrGeneratedAt !== qrGeneratedAt) {
                setQrCode(data.session.qrCode);
                setQrGeneratedAt(data.session.qrGeneratedAt);
              } else if (!qrCode) {
                setQrCode(data.session.qrCode);
                setQrGeneratedAt(data.session.qrGeneratedAt || Date.now());
              }
              setStatus("scanning");
            }
          }
        } catch (e) {
          console.error("Polling error", e);
        }
      }, 750);
    } else if (status === "connected") {
      pollInterval = setInterval(async () => {
        try {
          const res = await fetch("/api/whatsapp/session");
          const data = await res.json();
          if (data.success && data.session) {
            setSessionData(data.session);
            if (data.session.status === "disconnected") {
              setStatus("idle");
            }
          }
        } catch (e) {
          console.warn("Session health check error", e);
        }
      }, 10000);
    }

    return () => clearInterval(pollInterval);
  }, [status]);

  // QR countdown timer
  useEffect(() => {
    if (status !== "scanning" || !qrGeneratedAt) {
      setQrSecondsLeft(20);
      return;
    }
    const tick = () => {
      const elapsed = Math.floor((Date.now() - qrGeneratedAt) / 1000);
      const left = Math.max(0, 20 - elapsed);
      setQrSecondsLeft(left);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [status, qrGeneratedAt]);

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

  const toggleGlobalAiAutopilot = async () => {
    const nextState = config.globalAiEnabled === false ? true : false;
    setConfig((prev: any) => ({ ...prev, globalAiEnabled: nextState }));
    setIsAutopilotSaving(true);
    try {
      await fetch("/api/whatsapp/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ globalAiEnabled: nextState })
      });
    } catch (e) {
      console.error("Error auto-saving Global AI Autopilot:", e);
    } finally {
      setIsAutopilotSaving(false);
    }
  };

  const saveKnowledgeBase = async () => {
    setSavingKB(true);
    setKbSaveSuccess(false);
    try {
      await fetch("/api/whatsapp/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: config.systemPrompt,
          productInfo: config.productInfo,
          products: config.products
        })
      });
      setKbSaveSuccess(true);
      setTimeout(() => setKbSaveSuccess(false), 3000);
    } catch (e) {
      console.error("Error saving Knowledge Base:", e);
    } finally {
      setSavingKB(false);
    }
  };

  const saveKeywordRules = async () => {
    setSavingKeywords(true);
    setKeywordsSaveSuccess(false);
    try {
      await fetch("/api/whatsapp/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywordReplies: config.keywordReplies
        })
      });
      setKeywordsSaveSuccess(true);
      setTimeout(() => setKeywordsSaveSuccess(false), 3000);
    } catch (e) {
      console.error("Error saving Keyword Rules:", e);
    } finally {
      setSavingKeywords(false);
    }
  };

  const saveFollowUpSettings = async () => {
    setSavingFollowUps(true);
    setFollowUpsSaveSuccess(false);
    try {
      await fetch("/api/whatsapp/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          followUps: config.followUps,
          maxFollowUps: config.maxFollowUps
        })
      });
      setFollowUpsSaveSuccess(true);
      setTimeout(() => setFollowUpsSaveSuccess(false), 3000);
    } catch (e) {
      console.error("Error saving Follow-up settings:", e);
    } finally {
      setSavingFollowUps(false);
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

    const existingCount = (config.products || []).length;
    if (existingCount > 0) {
      const confirmReplace = confirm(
        `Auto-populating from a new website will replace your existing product catalog (${existingCount} products). Do you want to proceed?`
      );
      if (!confirmReplace) return;
    }

    setIsScraping(true);
    try {
      const res = await fetch("/api/whatsapp/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: scrapeUrl.trim(), currency: scrapeCurrency.trim() })
      });
      const data = await res.json();
      if (data.success) {
        const scrapedItems: any[] = data.items || [];
        const formattedCatalog = formatProductsText(scrapedItems, scrapeCurrency.trim());

        const updatedConfig = {
          ...config,
          storeUrl: scrapeUrl.trim(),
          storeCurrency: scrapeCurrency.trim(),
          products: scrapedItems,
          productInfo: formattedCatalog || data.catalog || ""
        };

        setConfig(updatedConfig);
        setScrapeUrl("");

        await fetch("/api/whatsapp/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedConfig)
        });
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

  const handleRevivalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setRevivalMediaBase64(event.target?.result as string);
        setRevivalMediaMime(file.type);
        setRevivalMediaName(file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeRevivalMedia = () => {
    setRevivalMediaBase64(null);
    setRevivalMediaMime(null);
    setRevivalMediaName(null);
    if (revivalFileInputRef.current) {
      revivalFileInputRef.current.value = "";
    }
  };

  const startRevivalRecording = async (target: "p1" | "p2") => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || "audio/webm";
        const blob = new Blob(chunks, { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        const reader = new FileReader();

        reader.onloadend = () => {
          const base64 = reader.result as string;
          if (target === "p1") {
            setRevivalVoiceBase64(base64);
            setRevivalVoiceMimetype(mimeType);
            setRevivalVoiceName(`Live Voice Note (${revivalRecordTimer}s)`);
            setRevivalVoicePreviewUrl(blobUrl);
            setRevivalMessageType("voice");
            setIsRevivalRecording(false);
          } else {
            setP2VoiceBase64(base64);
            setP2VoiceMimetype(mimeType);
            setP2VoiceName(`Live Voice Note (${p2RecordTimer}s)`);
            setP2VoicePreviewUrl(blobUrl);
            setP2Mode("voice");
            setIsP2Recording(false);
          }
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      if (target === "p1") {
        revivalRecorderRef.current = mediaRecorder;
        setIsRevivalRecording(true);
        setRevivalRecordTimer(0);
        if (revivalTimerRef.current) clearInterval(revivalTimerRef.current);
        revivalTimerRef.current = setInterval(() => {
          setRevivalRecordTimer((prev) => prev + 1);
        }, 1000);
      } else {
        p2RecorderRef.current = mediaRecorder;
        setIsP2Recording(true);
        setP2RecordTimer(0);
        if (p2TimerRef.current) clearInterval(p2TimerRef.current);
        p2TimerRef.current = setInterval(() => {
          setP2RecordTimer((prev) => prev + 1);
        }, 1000);
      }

      mediaRecorder.start();
    } catch (err) {
      console.error("Microphone access error:", err);
      alert("Could not access microphone. Please ensure microphone permissions are granted.");
    }
  };

  const stopRevivalRecording = (target: "p1" | "p2") => {
    if (target === "p1") {
      if (revivalRecorderRef.current && isRevivalRecording) {
        revivalRecorderRef.current.stop();
      }
      if (revivalTimerRef.current) clearInterval(revivalTimerRef.current);
    } else {
      if (p2RecorderRef.current && isP2Recording) {
        p2RecorderRef.current.stop();
      }
      if (p2TimerRef.current) clearInterval(p2TimerRef.current);
    }
  };

  const handleRevivalVoiceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setRevivalVoiceBase64(event.target?.result as string);
        setRevivalVoiceMimetype(file.type || "audio/mp4");
        setRevivalVoiceName(file.name);
        setRevivalMessageType("voice");
      };
      reader.readAsDataURL(file);
    }
  };

  const removeRevivalVoice = () => {
    setRevivalVoiceBase64(null);
    setRevivalVoiceMimetype(null);
    setRevivalVoiceName(null);
    if (revivalVoicePreviewUrl) {
      URL.revokeObjectURL(revivalVoicePreviewUrl);
      setRevivalVoicePreviewUrl(null);
    }
    if (voiceFileInputRef.current) {
      voiceFileInputRef.current.value = "";
    }
  };

  const handleP2FileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setP2MediaBase64(event.target?.result as string);
        setP2MediaMimetype(file.type);
        setP2MediaName(file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeP2Media = () => {
    setP2MediaBase64(null);
    setP2MediaMimetype(null);
    setP2MediaName(null);
    if (p2FileInputRef.current) p2FileInputRef.current.value = "";
  };

  const handleP2VoiceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setP2VoiceBase64(event.target?.result as string);
        setP2VoiceMimetype(file.type || "audio/mp4");
        setP2VoiceName(file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeP2Voice = () => {
    setP2VoiceBase64(null);
    setP2VoiceMimetype(null);
    setP2VoiceName(null);
    if (p2VoicePreviewUrl) {
      URL.revokeObjectURL(p2VoicePreviewUrl);
      setP2VoicePreviewUrl(null);
    }
    if (p2VoiceFileInputRef.current) p2VoiceFileInputRef.current.value = "";
  };

  const launchRevivalCampaign = async () => {
    if (status !== "connected") {
      alert("⚠️ WhatsApp is NOT connected!\n\nPlease pair/connect your WhatsApp account first from the dashboard before launching a campaign.");
      setActiveTab("settings");
      return;
    }
    if (!revivalMessage.trim() && !revivalMediaBase64 && !revivalVoiceBase64) return;
    setCreatingCampaign(true);
    try {
      const res = await fetch("/api/whatsapp/leads-revival", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Campaign ${new Date().toLocaleDateString()}`,
          message: revivalMessage,
          audience: revivalAudience,
          customPhones: revivalAudience === "custom" ? customPhones : undefined,
          timeSlotStart: revivalTimeStart,
          timeSlotEnd: revivalTimeEnd,
          delayMinutes: revivalDelayMinutes,
          dailyCap: revivalDailyCap,
          mediaBase64: revivalMediaBase64,
          mimetype: revivalMediaMime,
          fileName: revivalMediaName,
          voiceBase64: revivalVoiceBase64,
          voiceMimetype: revivalVoiceMimetype,
          messageType: revivalMessageType,
          phase2Settings: {
            enabled: p2Enabled,
            intervalDays: p2IntervalDays,
            maxFollowUps: p2MaxFollowUps,
            mode: p2Mode,
            messages: [p2Message1, p2Message2, p2Message3].filter(Boolean),
            mediaBase64: p2MediaBase64 || revivalMediaBase64 || undefined,
            mediaMimetype: p2MediaMimetype || revivalMediaMime || undefined,
            voiceBase64: p2VoiceBase64 || revivalVoiceBase64 || undefined,
            voiceMimetype: p2VoiceMimetype || revivalVoiceMimetype || undefined
          }
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRevivalMessage("");
        setCustomPhonesInput("");
        setCustomPhones([]);
        setIsFileUploaded(false);
        removeRevivalMedia();
        removeRevivalVoice();
        removeP2Media();
        removeP2Voice();
        fetchRevivalCampaigns();
      } else {
        alert(data.error || "Failed to launch revival campaign.");
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setCreatingCampaign(false);
    }
  };

  const controlRevivalCampaign = async (action: "pause" | "resume" | "cancel") => {
    try {
      if (action === "cancel") {
        const res = await fetch("/api/whatsapp/leads-revival", { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          fetchRevivalCampaigns();
        } else {
          alert(data.error || "Failed to cancel campaign.");
        }
      } else {
        const res = await fetch("/api/whatsapp/leads-revival", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const data = await res.json();
        if (data.success) {
          fetchRevivalCampaigns();
        } else {
          alert(data.error || `Failed to ${action} campaign.`);
        }
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const sendPromotion = async () => {
    if (status !== "connected") {
      alert("⚠️ WhatsApp is NOT connected!\n\nPlease pair/connect your WhatsApp device first from the dashboard before sending a broadcast.");
      setActiveTab("settings");
      return;
    }
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

  // Dynamic Overview metrics computed from real tenant orders & customer data
  const tenantCurrency = sessionData?.currency || "PKR";
  const currencySymbol = tenantCurrency === "USD" ? "$" : "Rs. ";

  const totalRevenue = orders.reduce((sum: number, o: any) => {
    const rawPrice = o.price || o.amount || 0;
    const numeric = typeof rawPrice === "number" ? rawPrice : (parseFloat(String(rawPrice).replace(/[^\d.]/g, '')) || 0);
    return sum + numeric;
  }, 0);

  const activeUsersCount = Math.max(Object.keys(customers).length, Object.keys(chats).length);
  const totalOrdersCount = orders.length;
  const customerLifetimeValue = activeUsersCount > 0 ? (totalRevenue / activeUsersCount) : 0;
  const avgDailySales = totalRevenue > 0 ? (totalRevenue / 30) : 0;

  // Breakdown of top products ordered
  const productSalesMap: Record<string, number> = {};
  orders.forEach((o: any) => {
    const prod = o.productName || o.product || "General Sales";
    productSalesMap[prod] = (productSalesMap[prod] || 0) + 1;
  });
  const sortedProductSales = Object.entries(productSalesMap).sort((a, b) => b[1] - a[1]);
  const topProd1Name = sortedProductSales[0] ? sortedProductSales[0][0] : "Digital Product";
  const topProd1Count = sortedProductSales[0] ? sortedProductSales[0][1] : 0;
  const topProd2Name = sortedProductSales[1] ? sortedProductSales[1][0] : "Physical Product";
  const topProd2Count = sortedProductSales[1] ? sortedProductSales[1][1] : 0;

  return (
    <div className="h-screen w-full flex bg-[#f5f6f8] font-sans overflow-hidden text-slate-800 relative">
      
      {/* Floating Sweet Sound Order Alert Banner */}
      {newOrderBanner && (
        <div className="fixed top-5 right-5 z-50 animate-bounce bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white p-4 rounded-2xl shadow-2xl border border-purple-300/40 flex items-center gap-4 max-w-md">
          <div className="bg-white/20 p-3 rounded-xl flex items-center justify-center animate-pulse">
            <Volume2 className="h-6 w-6 text-yellow-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="bg-yellow-400 text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">🔔 New Order</span>
              <span className="text-purple-200 text-xs">{newOrderBanner.time}</span>
            </div>
            <h4 className="text-sm font-extrabold text-white truncate mt-1">{newOrderBanner.productName}</h4>
            <p className="text-xs text-purple-100 truncate">Customer: <span className="font-bold text-white">{newOrderBanner.customerName}</span> {newOrderBanner.amount && `• ${newOrderBanner.amount}`}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <button 
              onClick={() => {
                setActiveTab('orders');
                setNewOrderBanner(null);
              }} 
              className="px-3.5 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-slate-900 text-xs font-extrabold rounded-lg transition-all shadow-md active:scale-95 cursor-pointer"
            >
              View Order
            </button>
            <button 
              onClick={() => setNewOrderBanner(null)} 
              className="p-1 hover:bg-white/10 rounded text-purple-200 hover:text-white transition-all text-center cursor-pointer"
            >
              <X className="h-4 w-4 mx-auto" />
            </button>
          </div>
        </div>
      )}

      {/* 1. Left Sidebar - HazelWhat Brand with DashMark Purple Theme */}
      <div className="w-[260px] flex-shrink-0 bg-white border-r border-slate-200/80 flex flex-col py-6 overflow-y-auto z-20 shadow-[4px_0_24px_rgba(124,58,237,0.03)] custom-scrollbar">
        
        {/* Brand Header */}
        <div className="px-6 mb-6">
          <div className="flex items-center gap-3 font-extrabold text-xl text-slate-900 tracking-tight">
            <div className="bg-gradient-to-tr from-purple-600 via-purple-500 to-indigo-500 p-2 rounded-xl text-white shadow-md shadow-purple-500/20">
              <Zap className="h-5 w-5 fill-white text-white" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="leading-tight">HazelWhat</span>
              <span className="text-[11px] font-extrabold text-purple-700 truncate max-w-[170px] bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200/80 mt-1">
                For: {sessionData?.businessName || config?.businessName || (sessionData?.name && !sessionData.name.includes("Super Admin") ? sessionData.name : "Workspace")}
              </span>
            </div>
          </div>
        </div>

        {/* Workspace Section */}
        <div className="px-6 mb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Workspace</div>
        <div className="flex flex-col gap-1 px-4 mb-6">
          <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'dashboard' ? 'bg-purple-50/80 text-purple-700 font-extrabold shadow-sm border-r-2 border-purple-600' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
            <Zap className={`h-4 w-4 ${activeTab === 'dashboard' ? 'text-purple-600' : 'text-slate-400'}`} /> Dashboard
          </button>
          <button onClick={() => setActiveTab('inbox')} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'inbox' ? 'bg-purple-50/80 text-purple-700 font-extrabold shadow-sm border-r-2 border-purple-600' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
            <Inbox className={`h-4 w-4 ${activeTab === 'inbox' ? 'text-purple-600' : 'text-slate-400'}`} /> Inbox
          </button>
          <button onClick={() => setActiveTab('orders')} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'orders' ? 'bg-purple-50/80 text-purple-700 font-extrabold shadow-sm border-r-2 border-purple-600' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
            <ShoppingCart className={`h-4 w-4 ${activeTab === 'orders' ? 'text-purple-600' : 'text-slate-400'}`} /> Orders
          </button>
          <button onClick={() => setActiveTab('contacts')} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'contacts' ? 'bg-purple-50/80 text-purple-700 font-extrabold shadow-sm border-r-2 border-purple-600' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
            <Users className={`h-4 w-4 ${activeTab === 'contacts' ? 'text-purple-600' : 'text-slate-400'}`} /> Contacts
          </button>
        </div>

        {/* Intelligence Section */}
        <div className="px-6 mb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Intelligence</div>
        <div className="flex flex-col gap-1 px-4 mb-6">
          <button onClick={() => setActiveTab('agents')} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'agents' ? 'bg-purple-50/80 text-purple-700 font-extrabold shadow-sm border-r-2 border-purple-600' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
            <BookOpen className={`h-4 w-4 ${activeTab === 'agents' ? 'text-purple-600' : 'text-slate-400'}`} /> Knowledge Base
          </button>
          <button onClick={() => setActiveTab('channels')} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'channels' ? 'bg-purple-50/80 text-purple-700 font-extrabold shadow-sm border-r-2 border-purple-600' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
            <Network className={`h-4 w-4 ${activeTab === 'channels' ? 'text-purple-600' : 'text-slate-400'}`} /> Channels
          </button>
        </div>

        {/* Growth Section */}
        <div className="px-6 mb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Growth</div>
        <div className="flex flex-col gap-1 px-4 mb-6">
          <button onClick={() => setActiveTab('promotions')} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'promotions' ? 'bg-purple-50/80 text-purple-700 font-extrabold shadow-sm border-r-2 border-purple-600' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
            <MessageSquare className={`h-4 w-4 ${activeTab === 'promotions' ? 'text-purple-600' : 'text-slate-400'}`} /> Promotions
          </button>
          <button onClick={() => setActiveTab('leads-revival')} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'leads-revival' ? 'bg-purple-50/80 text-purple-700 font-extrabold shadow-sm border-r-2 border-purple-600' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
            <RefreshCw className={`h-4 w-4 ${activeTab === 'leads-revival' ? 'text-purple-600' : 'text-slate-400'}`} /> Leads Revival
          </button>
        </div>

        {/* Account Section */}
        <div className="px-6 mb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Account</div>
        <div className="flex flex-col gap-1 px-4 mb-6">
          <button onClick={() => setActiveTab('settings')} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === 'settings' ? 'bg-purple-50/80 text-purple-700 font-extrabold shadow-sm border-r-2 border-purple-600' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
            <Settings className={`h-4 w-4 ${activeTab === 'settings' ? 'text-purple-600' : 'text-slate-400'}`} /> Settings
          </button>
        </div>


        {/* Bottom User Footer */}
        <div className="mt-auto px-5 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-gradient-to-tr from-purple-600 to-indigo-500 rounded-full flex items-center justify-center text-white font-extrabold text-xs shadow-md relative">
              {(sessionData?.businessName || sessionData?.name || 'H')[0]?.toUpperCase()}
              <div className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center text-[7px]"></div>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-extrabold text-slate-900 truncate">{sessionData?.businessName || sessionData?.name || 'Hassaan'}</h4>
              <p className="text-[10px] text-purple-600 font-semibold">Client Account</p>
            </div>
          </div>
        </div>
      </div>


      {/* 2. Overview Dashboard Tab - HazelWhat Data in DashMark Purple Theme */}
      {activeTab === 'dashboard' && (
        <div className="flex-1 h-full overflow-y-auto bg-[#f8f9fc]">
          <div className="p-8 max-w-[1300px] mx-auto w-full space-y-6">
            
            {/* Header with Period Filter */}
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Overview</h2>
              <div className="flex items-center gap-4">
                <div className="bg-slate-100/80 p-1 rounded-xl flex items-center text-xs font-bold border border-slate-200/60">
                  <button 
                    onClick={() => setPeriodFilter('weekly')}
                    className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
                      periodFilter === 'weekly' ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20 font-extrabold' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Weekly
                  </button>
                  <button 
                    onClick={() => setPeriodFilter('monthly')}
                    className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
                      periodFilter === 'monthly' ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20 font-extrabold' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Monthly
                  </button>
                  <button 
                    onClick={() => setPeriodFilter('yearly')}
                    className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
                      periodFilter === 'yearly' ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20 font-extrabold' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Yearly
                  </button>
                </div>
                <button className="flex items-center gap-2 bg-white border border-slate-200/80 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm cursor-pointer">
                  <svg className="w-4 h-4 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h7"/></svg>
                  Filter
                </button>
              </div>
            </div>

            {/* Lead Revival Executive Dashboard Banner Widget */}
            <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 p-6 rounded-3xl text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 border border-purple-500/20">
              <div className="flex items-center gap-4">
                <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10">
                  <RefreshCw className={`h-8 w-8 text-purple-400 ${activeRevivalCampaign?.status === 'active' ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black tracking-tight">WhatsApp Lead Revival CRM</h3>
                    <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase ${
                      activeRevivalCampaign?.status === 'active' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse' :
                      activeRevivalCampaign?.status === 'paused' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                      'bg-white/10 text-purple-200'
                    }`}>
                      {activeRevivalCampaign ? `Campaign ${activeRevivalCampaign.status}` : 'Idle'}
                    </span>
                  </div>
                  <p className="text-xs text-purple-200/80 font-medium mt-1">
                    2-Phase re-engagement engine for WhatsApp leads with voice notes, media & ban-prevention.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 w-full md:w-auto justify-end">
                <div className="text-right hidden sm:block">
                  <div className="text-[10px] font-bold text-purple-300 uppercase">Leads Processed</div>
                  <div className="text-xl font-black text-white">
                    {activeRevivalCampaign ? `${activeRevivalCampaign.sentPhones.length} / ${activeRevivalCampaign.targetPhones.length}` : '0 Leads'}
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('leads-revival')}
                  className="bg-white hover:bg-purple-50 text-purple-900 font-extrabold px-5 py-3 rounded-2xl text-xs transition shadow-lg flex items-center gap-2 cursor-pointer border border-white/30"
                >
                  <RefreshCw className="h-4 w-4 text-purple-600" />
                  <span>Manage Lead Revival</span>
                </button>
                <button
                  onClick={async () => {
                    try {
                      await fetch('/api/auth/logout', { method: 'POST' });
                      window.location.href = '/login';
                    } catch (e) {
                      window.location.href = '/login';
                    }
                  }}
                  className="bg-purple-950/40 hover:bg-purple-900/60 text-white font-extrabold px-4 py-3 rounded-2xl text-xs transition shadow-md flex items-center gap-2 cursor-pointer border border-purple-400/30"
                >
                  <LogOut className="h-4 w-4 text-rose-400" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
            
            {/* Top Metric Cards */}
            <div className="dash-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-0">
              <div className="flex-1 md:border-r border-slate-100 md:pr-6">
                <div className="text-slate-400 font-bold text-[11px] uppercase tracking-wider mb-2">Total Revenue ({periodFilter})</div>
                <div className="flex items-end gap-3">
                  <div className="text-2xl font-extrabold text-slate-900">
                    {totalRevenue === 0 ? `${currencySymbol}0` : `${currencySymbol}${totalRevenue.toLocaleString()}`}
                  </div>
                  <div className="bg-purple-50 text-purple-700 border border-purple-200/60 text-xs font-extrabold px-2.5 py-0.5 rounded-full mb-0.5">
                    {totalOrdersCount === 0 ? '0 Orders' : `+${totalOrdersCount} Orders`}
                  </div>
                </div>
              </div>
              
              <div className="flex-1 md:border-r border-slate-100 md:px-6">
                <div className="text-slate-400 font-bold text-[11px] uppercase tracking-wider mb-2">Active Users / Contacts</div>
                <div className="flex items-end gap-3">
                  <div className="text-2xl font-extrabold text-slate-900">
                    {activeUsersCount.toLocaleString()}
                  </div>
                  <div className="bg-purple-50 text-purple-700 border border-purple-200/60 text-xs font-extrabold px-2.5 py-0.5 rounded-full mb-0.5">
                    {activeUsersCount === 0 ? '0%' : '+100%'}
                  </div>
                </div>
              </div>
              
              <div className="flex-1 md:border-r border-slate-100 md:px-6">
                <div className="text-slate-400 font-bold text-[11px] uppercase tracking-wider mb-2">Customer Lifetime Value</div>
                <div className="flex items-end gap-3">
                  <div className="text-2xl font-extrabold text-slate-900">
                    {customerLifetimeValue === 0 ? `${currencySymbol}0.00` : `${currencySymbol}${customerLifetimeValue.toFixed(2)}`}
                  </div>
                  <div className="bg-emerald-50 text-emerald-600 border border-emerald-200/60 text-xs font-extrabold px-2.5 py-0.5 rounded-full mb-0.5">
                    {totalOrdersCount > 0 ? 'Active' : 'New Client'}
                  </div>
                </div>
              </div>
              
              <div className="flex-1 md:pl-6">
                <div className="text-slate-400 font-bold text-[11px] uppercase tracking-wider mb-2">Total Orders Placed</div>
                <div className="flex items-end gap-3">
                  <div className="text-2xl font-extrabold text-slate-900">
                    {totalOrdersCount.toLocaleString()}
                  </div>
                  <div className="bg-purple-50 text-purple-700 border border-purple-200/60 text-xs font-extrabold px-2.5 py-0.5 rounded-full mb-0.5">
                    Live Updates
                  </div>
                </div>
              </div>
            </div>
            
            {/* Middle Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 h-fit">
                
                {/* Churn Rate */}
                <div className="dash-card p-6 flex flex-col justify-between h-[180px]">
                  <div>
                    <div className="flex justify-between items-start">
                      <h3 className="font-extrabold text-slate-900 text-sm">Churn Rate</h3>
                      <MoreVertical className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="text-xs font-semibold text-slate-400 mt-1">Client account retention status</div>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-2xl font-extrabold text-slate-900">0.00%</div>
                      <div className="text-[11px] font-bold text-slate-500 mt-1"><span className="text-emerald-500 font-extrabold">0.00%</span> churn rate</div>
                    </div>
                    <div className="w-24 h-12 flex items-end">
                      <svg viewBox="0 0 100 40" className="w-full h-full stroke-emerald-500 fill-emerald-500/10" strokeWidth="2"><path d="M0 35 Q 25 35, 50 35 T 100 35 L 100 40 L 0 40 Z"/></svg>
                    </div>
                  </div>
                </div>

                {/* User Growth */}
                <div className="dash-card p-6 flex flex-col justify-between h-[180px]">
                  <div>
                    <div className="flex justify-between items-start">
                      <h3 className="font-extrabold text-slate-900 text-sm">User & Lead Growth</h3>
                      <MoreVertical className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="text-xs font-semibold text-slate-400 mt-1">Incoming leads & WhatsApp sessions</div>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-2xl font-extrabold text-slate-900">{activeUsersCount}</div>
                      <div className="text-[11px] font-bold text-slate-500 mt-1"><span className="text-purple-600 font-extrabold">{totalOrdersCount}</span> orders received</div>
                    </div>
                    <div className="w-24 h-12 flex items-end">
                      <svg viewBox="0 0 100 40" className="w-full h-full stroke-purple-600 fill-purple-500/10" strokeWidth="2"><path d="M0 35 Q 25 30, 50 25 T 100 15 L 100 40 L 0 40 Z"/></svg>
                    </div>
                  </div>
                </div>

                {/* Conversion Funnel */}
                <div className="dash-card p-6 md:col-span-2">
                  <div className="flex justify-between items-start mb-6">
                    <h3 className="font-extrabold text-slate-900 text-sm">Conversion Funnel</h3>
                    <MoreVertical className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex items-center gap-4 mb-8 text-xs font-bold text-slate-600 flex-wrap">
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-purple-700"></div> Total Contacts ({activeUsersCount})</div>
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-purple-500"></div> Active Chats ({Object.keys(chats).length})</div>
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-indigo-400"></div> Revival Campaigns ({revivalCampaigns.length})</div>
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div> Orders Placed ({totalOrdersCount})</div>
                  </div>
                  
                  <div className="flex items-end justify-between h-40 pt-4 gap-2 md:gap-4 pb-2 border-l border-b border-slate-200/80 px-4 relative ml-4">
                    <div className="absolute left-[-24px] top-0 text-[10px] text-slate-400 h-full flex flex-col justify-between pb-2 font-semibold">
                      <span>100</span><span>75</span><span>50</span><span>25</span><span>0</span>
                    </div>
                    {[
                      [activeUsersCount ? 40 : 5, chats ? 30 : 5, revivalCampaigns.length ? 20 : 5, totalOrdersCount ? 30 : 5],
                      [activeUsersCount ? 50 : 5, chats ? 35 : 5, revivalCampaigns.length ? 25 : 5, totalOrdersCount ? 40 : 5],
                      [activeUsersCount ? 60 : 5, chats ? 45 : 5, revivalCampaigns.length ? 30 : 5, totalOrdersCount ? 50 : 5],
                      [activeUsersCount ? 70 : 5, chats ? 55 : 5, revivalCampaigns.length ? 35 : 5, totalOrdersCount ? 60 : 5]
                    ].map((heights, i) => (
                      <div key={i} className="flex-1 flex flex-col justify-end w-6 md:w-12 max-w-[48px] rounded-t-lg overflow-hidden gap-[1px]">
                        <div className="w-full bg-purple-200 rounded-t-sm" style={{height: `${heights[3]}%`}}></div>
                        <div className="w-full bg-indigo-400" style={{height: `${heights[2]}%`}}></div>
                        <div className="w-full bg-purple-500" style={{height: `${heights[1]}%`}}></div>
                        <div className="w-full bg-purple-700 rounded-b-sm" style={{height: `${heights[0]}%`}}></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Product Performance */}
              <div className="dash-card p-6 h-full flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <h3 className="font-extrabold text-slate-900 text-sm">Product Sales Performance</h3>
                  <MoreVertical className="w-4 h-4 text-slate-400" />
                </div>
                
                <div className="bg-slate-100/80 p-1 rounded-xl flex items-center text-xs font-bold mb-6 border border-slate-200/60">
                  <button className="flex-1 py-1.5 bg-white text-purple-700 shadow-sm rounded-lg font-extrabold cursor-pointer">Live Orders</button>
                  <button className="flex-1 py-1.5 text-slate-500 hover:text-slate-700 cursor-pointer">Top Items</button>
                </div>

                <div className="flex justify-between border-b border-slate-100 pb-6 mb-6">
                  <div>
                    <div className="text-xs font-semibold text-slate-400 mb-1 truncate max-w-[130px]">{topProd1Name}</div>
                    <div className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                      <span className="text-purple-600 text-sm">↑</span> {topProd1Count} orders
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-400 mb-1 truncate max-w-[130px]">{topProd2Name}</div>
                    <div className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                      <span className="text-emerald-500 text-sm">↑</span> {topProd2Count} orders
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="text-xs font-semibold text-slate-400 mb-1">Average Daily Sales</div>
                    <div className="text-2xl font-extrabold text-slate-900">
                      {avgDailySales === 0 ? `${currencySymbol}0.00` : `${currencySymbol}${avgDailySales.toFixed(2)}`}
                    </div>
                  </div>
                  <div className="bg-purple-50 text-purple-700 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 border border-purple-200/60">
                    <span className="text-xs leading-none">↑</span> Live
                  </div>
                </div>

                <div className="mt-auto h-40 flex items-end justify-between gap-1 md:gap-2 border-b border-l border-slate-200/80 px-2 pt-2 relative ml-4">
                  <div className="absolute left-[-22px] top-0 text-[10px] text-slate-400 h-full flex flex-col justify-between pb-2 font-semibold">
                      <span>100</span><span>75</span><span>50</span><span>25</span><span>0</span>
                  </div>
                  {totalOrdersCount === 0 ? (
                    [5, 5, 5, 5, 5, 5, 5].map((h, i) => (
                      <div key={i} className="flex-1 bg-purple-200/60 rounded-t-md" style={{height: `${h}%`}}></div>
                    ))
                  ) : (
                    [20, 40, 65, 80, 50, 70, 90].map((h, i) => (
                      <div key={i} className="flex-1 bg-purple-600 rounded-t-md hover:bg-purple-700 transition-colors" style={{height: `${h}%`}}></div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}





      {/* Settings Tab - DashMark Theme */}
      {activeTab === 'settings' && (
        <div className="flex-1 h-full overflow-y-auto bg-[#f8f9fc]">
          <div className="p-10 max-w-4xl mx-auto w-full space-y-8">
            <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-3 tracking-tight">
              <Settings className="h-7 w-7 text-purple-600" /> Account Settings
            </h2>
            
            <div className="dash-card p-8 space-y-6">
              <div className="grid gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">Business Name</label>
                  <input 
                    type="text" 
                    value={config.businessName || ''} 
                    onChange={e => setConfig({...config, businessName: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-3 text-slate-900 font-semibold focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-sm transition-all"
                    placeholder="e.g. DashMark Corp"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">Timezone</label>
                  <input 
                    type="text" 
                    value={config.timezone || ''} 
                    onChange={e => setConfig({...config, timezone: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-3 text-slate-900 font-semibold focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-sm transition-all"
                    placeholder="e.g. UTC, America/New_York"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">Working Hours</label>
                  <input 
                    type="text" 
                    value={config.workingHours || ''} 
                    onChange={e => setConfig({...config, workingHours: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-3 text-slate-900 font-semibold focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-sm transition-all"
                    placeholder="e.g. 9:00 AM - 5:00 PM"
                  />
                </div>
              </div>

            {/* API Key Configuration */}
            <div className="border-t border-slate-100 pt-6 mt-6">
              <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-500" /> API Key Configuration
              </h3>
              <p className="text-xs text-slate-500 mb-6 font-medium">
                Configure your AI autopilot engine key. The system auto-detects the provider based on the key prefix (Anthropic: sk-ant-..., OpenRouter: sk-or-..., DeepSeek: sk-...).
              </p>
              
              <div className="grid gap-6">
                {/* Unified API Key */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-bold text-slate-700">AI API Key</label>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                      apiKeyStatus === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      apiKeyStatus === 'Out of Credits' ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse' :
                      apiKeyStatus === 'Invalid' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                      apiKeyStatus === 'checking' ? 'bg-slate-100 text-slate-500 animate-pulse' :
                      'bg-slate-50 text-slate-500 border border-slate-200'
                    }`}>
                      {apiKeyStatus === 'checking' ? 'Checking...' : apiKeyStatus}
                    </span>
                  </div>
                  <div className="relative">
                    <input 
                      type={showApiKey ? "text" : "password"} 
                      value={config.apiKey || ''} 
                      onChange={e => setConfig({...config, apiKey: e.target.value})}
                      onBlur={() => validateApiKey(config.apiKey)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-12 py-3 text-slate-900 font-medium focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                      placeholder="sk-ant-..., sk-or-..., or sk-..."
                    />
                    <button 
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      {showApiKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {apiKeyError && (
                    <p className="text-xs text-rose-600 font-bold mt-1.5 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" /> {apiKeyError}
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="mt-8 border-t border-slate-100 pt-6 flex justify-end">
              <button 
                onClick={saveConfig}
                disabled={savingConfig}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold py-3 px-8 rounded-xl transition-all shadow-md shadow-purple-500/20 flex items-center gap-2 cursor-pointer"
              >
                {savingConfig ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Save Settings
              </button>
            </div>
          </div>
        </div>
      </div>
      )}
      {activeTab === 'inbox' && (
        <div className="w-[360px] flex-shrink-0 bg-white border-r border-slate-200/80 flex flex-col relative z-10">
          
          {/* Connection Status Banner */}
          {status !== 'connected' && (
            <div className="bg-amber-50/80 px-4 py-3 border-b border-amber-200/60 flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-700 text-xs font-bold">
                <div className="bg-purple-600 p-1 rounded-full"><MessageCircle className="h-3 w-3 text-white" /></div> 
                WhatsApp Disconnected
              </div>
              <button onClick={() => setActiveTab('channels')} className="text-purple-600 text-xs font-extrabold hover:underline">Reconnect</button>
            </div>
          )}

          {/* Global AI Autopilot Auto-Toggle */}
          <div className="p-3.5 mx-4 mt-4 bg-gradient-to-r from-purple-50/90 via-indigo-50/70 to-purple-50/90 rounded-2xl border border-purple-200/70 flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative flex items-center justify-center">
                <span className={`w-3 h-3 rounded-full ${config.globalAiEnabled !== false ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-extrabold text-slate-900 truncate">Global AI Autopilot</h4>
                <p className="text-[10px] text-slate-500 font-semibold truncate">Auto-save on toggle</p>
              </div>
            </div>
            <button
              onClick={toggleGlobalAiAutopilot}
              disabled={isAutopilotSaving}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 ${
                config.globalAiEnabled !== false
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-purple-500/20 hover:from-purple-700 hover:to-indigo-700'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
              title={config.globalAiEnabled !== false ? "Click to Disable Global AI Autopilot" : "Click to Enable Global AI Autopilot"}
            >
              {isAutopilotSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5 fill-current" />
              )}
              <span>{config.globalAiEnabled !== false ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          {/* Search */}
          <div className="p-4 pb-2">
            <div className="bg-slate-100/70 border border-slate-200/60 rounded-xl flex items-center px-4 py-2.5 gap-3 focus-within:ring-2 focus-within:ring-purple-500/20 focus-within:border-purple-500 transition-all relative">
              <Search className="h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search chats" 
                value={inboxSearch}
                onChange={(e) => setInboxSearch(e.target.value)}
                className="bg-transparent border-none outline-none text-xs w-full placeholder:text-slate-400 text-slate-700 font-semibold pr-6" 
              />
              {inboxSearch && (
                <button 
                  onClick={() => setInboxSearch("")} 
                  className="absolute right-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Inbox Segmentation Tabs */}
          <div className="flex gap-1.5 px-4 pb-3 border-b border-slate-100 mt-1">
            <button 
              onClick={() => setInboxFilter("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-extrabold transition-all cursor-pointer ${
                inboxFilter === "all" ? "bg-slate-900 text-white shadow-sm" : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/60"
              }`}
            >
              All
            </button>
            <button 
              onClick={() => setInboxFilter("normal")}
              className={`px-3 py-1.5 rounded-full text-xs font-extrabold transition-all cursor-pointer ${
                inboxFilter === "normal" ? "bg-purple-600 text-white shadow-sm shadow-purple-500/20" : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/60"
              }`}
            >
              Conversations
            </button>
            <button 
              onClick={() => setInboxFilter("groups")}
              className={`px-3 py-1.5 rounded-full text-xs font-extrabold transition-all cursor-pointer ${
                inboxFilter === "groups" ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20" : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/60"
              }`}
            >
              Groups
            </button>
            <button 
              onClick={() => setInboxFilter("revival")}
              className={`px-3 py-1.5 rounded-full text-xs font-extrabold transition-all cursor-pointer ${
                inboxFilter === "revival" ? "bg-pink-600 text-white shadow-sm shadow-pink-500/20" : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/60"
              }`}
            >
              Leads Revival
            </button>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
            {(() => {
              const filteredChats = Object.entries(chats)
                .filter(([phone, messages]) => {
                  // 1. Search filter
                  if (inboxSearch) {
                    const searchLower = inboxSearch.toLowerCase();
                    const displayName = (customers[phone]?.name || phone).toLowerCase();
                    const matchesName = displayName.includes(searchLower);
                    const matchesMessage = messages.some(m => m.content?.toLowerCase().includes(searchLower));
                    if (!matchesName && !matchesMessage) return false;
                  }

                  // 2. Inbox segment filter
                  const customer = customers[phone];
                  const isRevival = customer?.tags?.includes("revival-sent");
                  const isGroup = phone.includes("@g.us");
                  if (inboxFilter === "normal" && (isRevival || isGroup)) return false;
                  if (inboxFilter === "groups" && !isGroup) return false;
                  if (inboxFilter === "revival" && !isRevival) return false;

                  return true;
                })
                .sort((a, b) => {
                  const aLast = a[1][a[1].length - 1];
                  const bLast = b[1][b[1].length - 1];
                  const aTime = aLast ? new Date(aLast.timestamp).getTime() : 0;
                  const bTime = bLast ? new Date(bLast.timestamp).getTime() : 0;
                  return bTime - aTime;
                });

              if (filteredChats.length === 0) {
                return (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                    <p className="text-xs font-bold">No chats found.</p>
                  </div>
                );
              }

              return filteredChats.map(([phone, messages], i) => {
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
                    className={`cursor-pointer px-5 py-4 flex items-start gap-3.5 transition-all border-b border-slate-100/60 relative ${isSelected ? 'bg-purple-50/70 before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-purple-600' : 'hover:bg-slate-50'}`}
                  >
                    {/* Avatar with ring */}
                    <div className="relative flex-shrink-0 mt-0.5">
                      <div className="h-[44px] w-[44px] rounded-full border-2 border-purple-500 p-0.5 relative flex items-center justify-center bg-white shadow-sm">
                        <div className="h-full w-full bg-slate-100 rounded-full flex items-center justify-center overflow-hidden">
                          <User className="text-purple-400 h-5 w-5" />
                        </div>
                      </div>
                      <div className="absolute -bottom-1 -left-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[9px] font-extrabold px-1.5 rounded-full border-2 border-white shadow-sm">
                        {ringPercent}%
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <h4 className="text-xs font-bold text-slate-900 truncate">{displayName}</h4>
                        <span className="text-[11px] font-bold text-purple-600">{timeStr}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                        {lastMessage?.role === 'assistant' && <CheckCheck className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />}
                        <span className="truncate">{lastMessage?.content}</span>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* 3. Main Content View */}
      {activeTab === 'inbox' && (
        <div className="flex-1 flex flex-col min-w-0 relative z-0 bg-[#f8f9fc]">
          {!selectedChat ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
              <div className="h-20 w-20 bg-purple-50 rounded-full flex items-center justify-center border border-purple-100 text-purple-600 text-3xl shadow-sm">
                💬
              </div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">Client Messaging Panel</h2>
              <p className="text-xs text-slate-400 font-medium">Select a contact from the list to start messaging.</p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="h-[72px] bg-white border-b border-slate-200/80 px-6 flex items-center justify-between z-10 flex-shrink-0 shadow-sm">
                <div className="flex items-center gap-3.5 cursor-pointer">
                  <div className="h-11 w-11 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-md shadow-purple-500/20">
                    <User className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex flex-col">
                    <h4 className="font-extrabold text-slate-900 text-sm">
                      {(() => {
                        const savedName = customers[selectedChat]?.name;
                        if (savedName && savedName !== selectedChat) return savedName;
                        if (selectedChat.includes('@g.us')) return `Group: ${selectedChat.split('@')[0]}`;
                        if (selectedChat.includes('@lid')) return `+${selectedChat.split('@')[0]} (Linked Device)`;
                        if (selectedChat.includes('@')) return `+${selectedChat.split('@')[0]}`;
                        return `+${selectedChat}`;
                      })()}
                    </h4>
                    <span className="text-[11px] text-slate-400 font-semibold">({selectedChat.split('@')[0]}) | Active Contact</span>
                  </div>
                </div>
                
                {/* Autopilot Toggle */}
                <div className="flex items-center bg-slate-100/80 border border-slate-200/80 rounded-full p-1 shadow-sm">
                  {(() => {
                    const isAiEnabled = customers[selectedChat]?.aiEnabled !== undefined ? customers[selectedChat].aiEnabled : (config.globalAiEnabled !== false);
                    return (
                      <>
                        <button 
                          onClick={() => toggleChatAi(true)}
                          className={`${isAiEnabled ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20' : 'text-slate-600 hover:text-slate-900'} text-xs font-bold px-4 py-1.5 rounded-full transition cursor-pointer`}
                        >
                          Autopilot
                        </button>
                        <button 
                          onClick={() => toggleChatAi(false)}
                          className={`${!isAiEnabled ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20' : 'text-slate-600 hover:text-slate-900'} text-xs font-bold px-4 py-1.5 rounded-full transition cursor-pointer`}
                        >
                          Copilot
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>
              
              {/* Chat Messages */}
              <div 
                ref={chatContainerRef}
                onScroll={handleChatScroll}
                className="flex-1 overflow-y-auto px-[8%] py-6 flex flex-col space-y-3 z-10 custom-scrollbar"
              >
                
                {chats[selectedChat]?.map((m, i) => {
                  const isSent = m.role === 'assistant';
                  const isDataUri = m.content?.startsWith('data:image/');
                  const isImageUrl = m.content?.match(/^https?:\/\/.*\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i);
                  const displayMediaUrl = m.mediaUrl || (isDataUri ? m.content : isImageUrl ? m.content : null);
                  const isSticker = m.content?.includes('[Sticker]') || m.mediaType === 'image/webp';

                  return (
                    <div key={i} className={`flex w-full ${isSent ? 'justify-end' : 'justify-start'}`}>
                      <div className={`relative max-w-[65%] rounded-2xl px-4 py-2.5 text-xs font-semibold leading-relaxed shadow-sm ${
                        isSent 
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-tr-xs shadow-md shadow-purple-500/10' 
                          : 'bg-white text-slate-900 rounded-tl-xs border border-slate-200/70'
                      }`}>
                        {displayMediaUrl && (
                          <div className="mb-2 rounded-xl overflow-hidden border border-black/5 bg-black/5 flex items-center justify-center p-1">
                            {isSticker || m.mediaType?.startsWith('image/') || isDataUri || isImageUrl ? (
                              <img src={displayMediaUrl} alt="Media Preview" className="max-w-[260px] max-h-[260px] object-contain rounded-lg shadow-sm" />
                            ) : m.mediaType?.startsWith('video/') ? (
                              <video src={displayMediaUrl} controls className="max-w-full max-h-[300px] object-cover" />
                            ) : m.mediaType?.startsWith('audio/') ? (
                              <audio src={displayMediaUrl} controls className="max-w-full" />
                            ) : (
                              <a href={displayMediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 text-purple-600 hover:bg-purple-50 transition">
                                <Paperclip className="h-5 w-5" />
                                <span className="font-bold underline text-xs truncate">Document Attachment</span>
                              </a>
                            )}
                          </div>
                        )}
                        {m.content && !isDataUri && !isImageUrl && (
                          <span className="pr-14 block whitespace-pre-wrap">{m.content}</span>
                        )}
                        <div className={`absolute bottom-1 right-3 flex items-center gap-1 text-[10px] font-bold ${isSent ? 'text-purple-200' : 'text-slate-400'}`}>
                          <span>{new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          {isSent && (
                            m.status === 4 ? <CheckCheck className="h-3.5 w-3.5 text-white" /> :
                            m.status === 3 ? <CheckCheck className="h-3.5 w-3.5 text-purple-200" /> :
                            <Check className="h-3.5 w-3.5 text-purple-200" />
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
                <div className="h-[80px] bg-white border-t border-slate-200/80 px-6 flex items-center justify-center z-10 flex-shrink-0 shadow-sm">
                  <div className="flex flex-col items-center">
                    <p className="text-slate-500 text-xs font-semibold mb-2">WhatsApp is disconnected</p>
                    <button onClick={() => setActiveTab('channels')} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-extrabold text-xs px-5 py-2 rounded-xl transition shadow-md shadow-purple-500/20 flex items-center gap-2 cursor-pointer">
                      <Zap className="h-4 w-4" /> Reconnect
                    </button>
                  </div>
                </div>
              ) : (
                /* Chat Input Bar */
                <div className="h-[80px] bg-white border-t border-slate-200/80 px-6 flex items-center gap-4 z-10 flex-shrink-0 relative shadow-sm">
                  
                  {showEmojiPicker && (
                    <div className="absolute bottom-[90px] left-6 z-50 shadow-2xl rounded-2xl">
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
                      <div className="flex items-center gap-2 text-rose-500 font-bold text-xs">
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
                      }} className="text-slate-500 hover:text-slate-700 text-xs font-bold cursor-pointer">
                        Cancel
                      </button>
                      <button onClick={stopRecording} className="bg-rose-500 text-white rounded-full p-2.5 hover:bg-rose-600 transition shadow-md cursor-pointer">
                        <Send className="h-4 w-4 ml-0.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-4 text-slate-400">
                        <Smile onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={`h-6 w-6 cursor-pointer transition-colors ${showEmojiPicker ? 'text-purple-600' : 'hover:text-slate-600'}`} />
                        <Paperclip onClick={() => fileInputRef.current?.click()} className="h-5 w-5 cursor-pointer hover:text-slate-600 transition-colors" />
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
                          className="w-full h-11 bg-slate-100/80 rounded-full px-5 text-xs text-slate-800 focus:outline-none placeholder:text-slate-400 border border-transparent focus:border-purple-500/50 font-semibold transition-all"
                        />
                      </div>
                      
                      {messageInput.trim() ? (
                        <div onClick={() => { sendManualMessage(); setShowEmojiPicker(false); }} className="bg-gradient-to-r from-purple-600 to-indigo-600 h-10 w-10 rounded-full flex items-center justify-center cursor-pointer hover:from-purple-700 hover:to-indigo-700 shadow-md shadow-purple-500/25 transition-all">
                          <Send className="h-4 w-4 text-white ml-0.5" />
                        </div>
                      ) : (
                        <Mic onClick={startRecording} className="h-6 w-6 text-slate-400 cursor-pointer hover:text-purple-600 transition-colors" />
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )
        }
        </div>
      )}

        {/* Channels Tab (QR Connection) */}
        {activeTab === 'channels' && (
          <div className="flex-1 h-full overflow-y-auto bg-[#f8f9fc]">
            <div className="p-10 max-w-4xl mx-auto w-full space-y-8">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">WhatsApp Integration</h2>
            <div className="dash-card p-8 flex flex-col items-center">
              
              {status === "idle" && waConnectMode === "qr" && (
                <div className="text-center space-y-6 w-full max-w-sm">
                  <div className="mx-auto bg-purple-50 p-6 rounded-full w-max border border-purple-100">
                    <QrCode className="h-14 w-14 text-purple-400" />
                  </div>
                  <button onClick={startSession} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold h-12 rounded-xl transition-all shadow-md shadow-purple-500/20 text-xs cursor-pointer">
                    Generate QR Code
                  </button>

                  <div className="w-full pt-4 text-center border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setWaConnectMode('pairing')}
                      className="text-xs font-extrabold text-purple-600 hover:text-purple-700 hover:underline flex items-center justify-center gap-2 mx-auto transition cursor-pointer"
                    >
                      <Smartphone className="h-4 w-4" />
                      <span>Link with phone number instead</span>
                    </button>
                  </div>
                </div>
              )}

              {(status === "creating" || status === "waiting_qr") && (
                <div className="flex flex-col items-center justify-center space-y-6 py-10">
                  <Loader2 className="h-10 w-10 text-purple-600 animate-spin" />
                  <p className="text-slate-500 font-bold text-xs">Initializing Secure Connection...</p>
                </div>
              )}

              {status === "scanning" && qrCode && waConnectMode === "qr" && (
                <div className="flex flex-col items-center w-full max-w-sm">
                  <div className="bg-white p-4 rounded-3xl shadow-lg border border-slate-100 mb-8 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrCode} alt="QR" className="w-64 h-64 rounded-xl object-contain" />
                    {/* Freshness badge */}
                    <div className={`absolute -top-3 -right-3 text-xs font-bold px-2.5 py-1 rounded-full shadow ${
                      qrSecondsLeft > 10 ? 'bg-emerald-500 text-white' :
                      qrSecondsLeft > 5  ? 'bg-amber-400 text-white' :
                                           'bg-rose-500 text-white'
                    }`}>
                      {qrSecondsLeft > 0 ? `${qrSecondsLeft}s` : 'Refreshing...'}
                    </div>
                  </div>
                  <div className="w-full space-y-3 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <p className="text-sm text-slate-600 font-bold">1. Open WhatsApp -&gt; Settings -&gt; Linked Devices</p>
                    <p className="text-sm text-slate-600 font-bold">2. Tap Link a Device &amp; point phone to this screen.</p>
                    <p className="text-xs text-slate-400 font-medium mt-2">⚠️ Scan while the timer is green or amber — the QR auto-refreshes every 20 seconds.</p>
                  </div>

                  {/* LINK WITH PHONE NUMBER INSTEAD BUTTON */}
                  <div className="w-full pt-6 text-center border-t border-slate-100 mt-6">
                    <button
                      type="button"
                      onClick={() => setWaConnectMode('pairing')}
                      className="text-xs font-extrabold text-purple-600 hover:text-purple-700 hover:underline flex items-center justify-center gap-2 mx-auto transition cursor-pointer"
                    >
                      <Smartphone className="h-4 w-4" />
                      <span>Link with phone number instead</span>
                    </button>
                  </div>
                </div>
              )}

              {/* LINK WITH PHONE NUMBER INSTEAD VIEW */}
              {waConnectMode === "pairing" && status !== "connected" && (
                <div className="w-full max-w-sm space-y-5 animate-in fade-in zoom-in duration-300">
                  <div className="text-center space-y-1">
                    <h3 className="text-lg font-bold text-slate-900">Link with Phone Number</h3>
                    <p className="text-xs text-slate-500">Enter your full phone number with country code to receive an 8-digit pairing code.</p>
                  </div>

                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!waPairingPhone.trim()) return;
                      setIsGeneratingPairingCode(true);
                      setPairingError(null);
                      setWaPairingCode(null);
                      try {
                        const res = await fetch("/api/whatsapp/pairing-code", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
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
                    }} 
                    className="space-y-4"
                  >
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 uppercase mb-1 block">Phone Number</label>
                      <input
                        type="text"
                        required
                        placeholder="923001234567"
                        value={waPairingPhone}
                        onChange={e => setWaPairingPhone(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">Include country code without '+' or spaces (e.g. 923001234567)</p>
                    </div>

                    <button
                      type="submit"
                      disabled={isGeneratingPairingCode || !waPairingPhone.trim()}
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white font-extrabold rounded-xl h-11 text-xs shadow-md shadow-purple-500/20 cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isGeneratingPairingCode ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Generating Code...</span>
                        </>
                      ) : (
                        <span>Get Pairing Code</span>
                      )}
                    </button>

                    {pairingError && (
                      <p className="text-xs font-semibold text-rose-600 text-center">{pairingError}</p>
                    )}

                    {waPairingCode && (
                      <div className="bg-purple-50 p-4 rounded-2xl border border-purple-200 text-center space-y-2">
                        <p className="text-xs font-bold text-purple-900">Your Official WhatsApp Pairing Code:</p>
                        <p className="text-2xl font-mono font-black text-purple-900 tracking-widest bg-white py-2 px-4 rounded-xl border border-purple-300 inline-block shadow-sm">
                          {waPairingCode}
                        </p>
                        <p className="text-[10px] text-purple-700">Open WhatsApp → Linked Devices → Link with phone number instead</p>
                      </div>
                    )}
                  </form>

                  {/* SCAN QR CODE INSTEAD BUTTON */}
                  <div className="w-full pt-4 text-center border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setWaConnectMode('qr')}
                      className="text-xs font-bold text-slate-600 hover:text-slate-900 hover:underline flex items-center justify-center gap-2 mx-auto transition cursor-pointer"
                    >
                      <QrCode className="h-4 w-4 text-purple-600" />
                      <span>Scan QR code instead</span>
                    </button>
                  </div>
                </div>
              )}

              {status === "connected" && (
                <div className="flex flex-col items-center justify-center text-center space-y-6 py-10 w-full max-w-sm">
                  <div className="bg-purple-100 p-6 rounded-full shadow-inner">
                    <CheckCircle2 className="h-20 w-20 text-purple-600" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xl text-slate-900 font-extrabold mb-2">Device Linked Successfully!</p>
                    {sessionData?.phoneNumber && (
                      <p className="text-sm text-purple-700 font-bold">+{sessionData.phoneNumber}</p>
                    )}
                  </div>
                  <button onClick={disconnectSession} className="text-sm font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 w-full py-3 rounded-xl transition-colors mt-4">
                    Disconnect Device
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

        {/* Agents Tab - DashMark Theme */}
        {activeTab === 'agents' && (
          <div className="flex-1 h-full overflow-y-auto bg-[#f8f9fc]">
            <div className="p-8 md:p-10 max-w-[1400px] mx-auto w-full space-y-8">
            <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-3 tracking-tight">
              <Bot className="h-7 w-7 text-purple-600" /> Bot Configuration & Knowledge Base
            </h2>
            <div className="dash-card p-8 space-y-8">
              


              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">System Prompt / Persona</label>
                <textarea 
                  value={config.systemPrompt}
                  onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                  className="w-full h-32 p-4 text-xs bg-slate-50 border border-slate-200/80 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition font-semibold text-slate-800"
                  placeholder="Tell the AI how to act..."
                />
              </div>
              
              {/* Website Auto-Scraper & Product Catalog Module */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                      <Package className="w-5 h-5 text-purple-600" />
                      <span>Product Catalog & Knowledge Base</span>
                      <span className="bg-purple-100 text-purple-700 px-2.5 py-0.5 rounded-full text-xs font-bold">
                        {(config.products || []).length} Products
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      Auto-scrape store catalog or manually add/edit products, pricing, links, and pictures.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {(config.products || []).length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearCatalog}
                        className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/80 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                        title="Clear all products from catalog"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>Clear Catalog</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowRawCatalogText(!showRawCatalogText)}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      {showRawCatalogText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showRawCatalogText ? "Hide Raw Text" : "View Raw Text"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={openAddProductModal}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-purple-500/20 transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Add Product</span>
                    </button>
                  </div>
                </div>

                {/* Auto-Scraper Bar */}
                <div className="bg-purple-50/50 p-5 rounded-2xl border border-purple-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-purple-600" /> Auto-Fetch & Synchronize Store URL
                    </span>
                    <span className="text-[11px] text-purple-600 font-bold">Shopify, WooCommerce & Generic Sites</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="url"
                      value={scrapeUrl}
                      onChange={(e) => setScrapeUrl(e.target.value)}
                      placeholder="https://yourstore.com"
                      className="flex-1 px-4 py-2.5 text-xs bg-white border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-semibold text-slate-900"
                    />
                    <input
                      type="text"
                      value={scrapeCurrency}
                      onChange={(e) => setScrapeCurrency(e.target.value)}
                      placeholder="Rs."
                      className="w-20 px-3 py-2.5 text-xs bg-white border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-center font-bold text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={handleScrape}
                      disabled={isScraping || !scrapeUrl.trim()}
                      className={`px-5 py-2.5 rounded-xl text-xs font-extrabold text-white shadow-md flex items-center justify-center gap-2 transition cursor-pointer ${
                        isScraping || !scrapeUrl.trim()
                          ? "bg-slate-300 cursor-not-allowed"
                          : "bg-purple-600 hover:bg-purple-700 shadow-purple-600/20"
                      }`}
                    >
                      {isScraping ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Scraping Store...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Auto-Populate Catalog</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Filter & Search */}
                <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Search products..."
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div className="flex gap-1.5 overflow-x-auto w-full sm:w-auto pb-1">
                    {(() => {
                      const prods = config.products || [];
                      const categories = ["all", ...Array.from(new Set(prods.map((p: any) => p.category).filter(Boolean)))];
                      return categories.map((cat: any) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition shrink-0 ${
                            selectedCategory === cat
                              ? "bg-purple-600 text-white shadow-sm"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                          }`}
                        >
                          {cat}
                        </button>
                      ));
                    })()}
                  </div>
                </div>

                {/* Product Grid */}
                {(() => {
                  const prods: any[] = config.products || [];
                  const filtered = prods.filter((p) => {
                    const matchesSearch =
                      !productSearch ||
                      p.title?.toLowerCase().includes(productSearch.toLowerCase()) ||
                      p.description?.toLowerCase().includes(productSearch.toLowerCase());
                    const matchesCat = selectedCategory === "all" || p.category === selectedCategory;
                    return matchesSearch && matchesCat;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-12 px-4 bg-slate-50/80 rounded-2xl border-2 border-dashed border-slate-200">
                        <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <h4 className="text-sm font-bold text-slate-700">No Products in Catalog</h4>
                        <p className="text-xs text-slate-400 font-medium mt-1 max-w-sm mx-auto">
                          Paste your website URL above and click "Auto-Populate Catalog" or click "+ Add Product" to create catalog items manually.
                        </p>
                        <button
                          type="button"
                          onClick={openAddProductModal}
                          className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition"
                        >
                          <Plus className="w-4 h-4" /> Add First Product
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filtered.map((prod) => (
                        <div
                          key={prod.id}
                          className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col group"
                        >
                          <div className="h-44 bg-slate-100 relative overflow-hidden flex items-center justify-center">
                            {prod.image ? (
                              <img
                                src={prod.image}
                                alt={prod.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                onError={(e) => {
                                  (e.target as any).onerror = null;
                                  (e.target as any).src = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500";
                                }}
                              />
                            ) : (
                              <div className="text-center p-4">
                                <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                                <span className="text-[11px] font-bold text-slate-400">No Picture Attached</span>
                              </div>
                            )}
                            {prod.category && (
                              <span className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-extrabold px-2.5 py-1 rounded-lg uppercase">
                                {prod.category}
                              </span>
                            )}
                            <span className="absolute top-2 right-2 bg-purple-600 text-white text-xs font-extrabold px-2.5 py-1 rounded-lg shadow-sm">
                              {prod.price}
                            </span>
                          </div>

                          <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                            <div>
                              <h4 className="font-extrabold text-xs text-slate-900 line-clamp-1">{prod.title}</h4>
                              {prod.description && (
                                <p className="text-[11px] text-slate-500 font-medium line-clamp-2 mt-1">{prod.description}</p>
                              )}
                              {prod.variations && prod.variations.length > 0 && (
                                <div className="mt-2 text-[10px] text-purple-700 font-bold bg-purple-50 border border-purple-100 p-1.5 rounded-lg">
                                  Variations: {prod.variations.map((v: any) => `${v.title} (${v.price})`).join(", ")}
                                </div>
                              )}
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                              {prod.link ? (
                                <a
                                  href={prod.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 truncate"
                                >
                                  <ExternalLink className="w-3 h-3 shrink-0" />
                                  <span className="truncate">View Link</span>
                                </a>
                              ) : (
                                <span className="text-[11px] text-slate-400 font-medium">No Link</span>
                              )}

                              <div className="flex gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => openEditProductModal(prod)}
                                  className="p-1.5 bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-purple-700 rounded-lg transition"
                                  title="Edit Product"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteProduct(prod.id)}
                                  className="p-1.5 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 rounded-lg transition"
                                  title="Delete Product"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Raw Text Fallback */}
                {showRawCatalogText && (
                  <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Raw AI System Prompt Catalog Text</label>
                    <textarea
                      value={config.productInfo}
                      onChange={(e) => setConfig({ ...config, productInfo: e.target.value })}
                      rows={6}
                      className="w-full p-4 text-xs bg-slate-900 text-emerald-400 font-mono rounded-2xl border border-slate-800 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Product Add / Edit Modal */}
              {showProductModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                  <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-8">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                        <Package className="w-5 h-5 text-purple-600" />
                        <span>{editingProduct ? "Edit Product Details" : "Add New Product"}</span>
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
                          placeholder="e.g. Heroic Kids Outfit"
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 font-bold"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-700 font-bold mb-1">Base Price / Range</label>
                          <input
                            type="text"
                            value={prodPrice}
                            onChange={(e) => setProdPrice(e.target.value)}
                            placeholder="e.g. Rs. 3,500 or $25"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-700 font-bold mb-1">Category</label>
                          <input
                            type="text"
                            value={prodCategory}
                            onChange={(e) => setProdCategory(e.target.value)}
                            placeholder="e.g. Kids Festive Wear"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-900"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Product Image (URL or File Upload)</label>
                        <div className="flex gap-2">
                          <input
                            type="url"
                            value={prodImage}
                            onChange={(e) => setProdImage(e.target.value)}
                            placeholder="https://yourstore.com/images/heroic.jpg"
                            className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-900"
                          />
                          <input
                            type="file"
                            ref={prodFileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleImageFileChange}
                          />
                          <button
                            type="button"
                            onClick={() => prodFileInputRef.current?.click()}
                            className="px-3.5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold flex items-center gap-1.5 transition shrink-0"
                          >
                            <Upload className="w-4 h-4" />
                            <span>Upload</span>
                          </button>
                        </div>
                        {prodImage && (
                          <div className="mt-2 h-20 w-20 rounded-xl overflow-hidden border border-slate-200">
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
                          placeholder="https://cutecoodle.com/products/heroic"
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Price Variations (Optional)</label>
                        <input
                          type="text"
                          value={prodVariations}
                          onChange={(e) => setProdVariations(e.target.value)}
                          placeholder="e.g. 1-2 Yrs: Rs. 3500, 3-4 Yrs: Rs. 3800, 5-6 Yrs: Rs. 4200"
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-slate-900"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Separate variations with commas in Title: Price format.</p>
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Short Description</label>
                        <textarea
                          rows={2}
                          value={prodDesc}
                          onChange={(e) => setProdDesc(e.target.value)}
                          placeholder="A charming little outfit for your little hero - perfect for special occasions!"
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
                        onClick={handleSaveProductModal}
                        className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-purple-600/20 transition cursor-pointer"
                      >
                        {editingProduct ? "Save Changes" : "Create Product"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 pb-6 border-b border-slate-100 flex items-center justify-between flex-wrap gap-4 bg-slate-50/70 p-5 rounded-2xl border border-slate-200/60">
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900">Knowledge Base & Catalog</h4>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">Save System Prompt persona and Product Catalog updates independently.</p>
                </div>
                <button 
                  onClick={saveKnowledgeBase}
                  disabled={savingKB}
                  className={`px-6 py-3 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-purple-500/20 active:scale-95 ${
                    kbSaveSuccess
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                  }`}
                >
                  {savingKB ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving Knowledge Base...</span>
                    </>
                  ) : kbSaveSuccess ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 animate-bounce text-yellow-300" />
                      <span>Knowledge Base Saved!</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>Save Knowledge Base</span>
                    </>
                  )}
                </button>
              </div>

              <div className="pt-4">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Keyword Auto-Replies</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">Bypass AI to instantly reply to specific exact keywords.</p>
                  </div>
                  <button 
                    onClick={() => setConfig({
                      ...config, 
                      keywordReplies: [...(config.keywordReplies || []), { keyword: "", reply: "" }]
                    })}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-extrabold rounded-xl shadow-md shadow-purple-500/20 transition-transform hover:-translate-y-0.5 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" /> Add Rule
                  </button>
                </div>
                
                <div className="space-y-4">
                  {(!config.keywordReplies || config.keywordReplies.length === 0) ? (
                    <div className="text-center p-8 bg-slate-50/80 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 font-bold text-xs">
                      No keyword rules added yet.
                    </div>
                  ) : (
                    config.keywordReplies.map((kr: any, idx: number) => (
                      <div key={idx} className="flex gap-4 items-start bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
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
                            className="w-full p-3 text-xs bg-slate-50 border border-slate-200/80 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold text-slate-700"
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
                            className="w-full p-3 text-xs bg-slate-50 border border-slate-200/80 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-semibold text-slate-700"
                          />
                          <button 
                            onClick={() => {
                              const newReplies = [...(config.keywordReplies || [])];
                              newReplies.splice(idx, 1);
                              setConfig({ ...config, keywordReplies: newReplies });
                            }}
                            className="bg-rose-50 text-rose-500 hover:bg-rose-100 p-3 rounded-xl transition-colors flex-shrink-0 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between flex-wrap gap-4 bg-slate-50/70 p-5 rounded-2xl border border-slate-200/60">
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900">Keyword Auto-Replies</h4>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">Save exact keyword match trigger rules independently.</p>
                </div>
                <button 
                  onClick={saveKeywordRules}
                  disabled={savingKeywords}
                  className={`px-6 py-3 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-purple-500/20 active:scale-95 ${
                    keywordsSaveSuccess
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                  }`}
                >
                  {savingKeywords ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving Keyword Rules...</span>
                    </>
                  ) : keywordsSaveSuccess ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 animate-bounce text-yellow-300" />
                      <span>Keyword Rules Saved!</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>Save Keyword Rules</span>
                    </>
                  )}
                </button>
              </div>

              {/* Follow-Up Automation & Sequences Section */}
              <div className="pt-6 border-t border-slate-100 space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-purple-600" />
                      <span>Follow-Up Automation & Sequences</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      Configure automated check-ins for leads who go quiet. Set interval gaps (hours & days) and maximum follow-up count.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200/80">
                      <label className="text-xs font-extrabold text-slate-700">Max Follow-ups:</label>
                      <select
                        value={config.maxFollowUps || config.followUps?.length || 7}
                        onChange={(e) => {
                          const count = parseInt(e.target.value) || 7;
                          setConfig({ ...config, maxFollowUps: count });
                        }}
                        className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none cursor-pointer"
                      >
                        {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                          <option key={num} value={num}>{num} {num === 1 ? 'Time' : 'Times'}</option>
                        ))}
                      </select>
                    </div>

                    <button 
                      onClick={saveFollowUpSettings}
                      disabled={savingFollowUps}
                      className={`px-6 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-purple-500/20 active:scale-95 ${
                        followUpsSaveSuccess
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                      }`}
                    >
                      {savingFollowUps ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Saving Follow-ups...</span>
                        </>
                      ) : followUpsSaveSuccess ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 animate-bounce text-yellow-300" />
                          <span>Follow-ups Saved!</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          <span>Save Follow-up Settings</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {(() => {
                    const defaultFUs = [
                      { enabled: true, delayMinutes: 60, delayValue: 1, unit: 'hours' as const, message: '' },
                      { enabled: true, delayMinutes: 1440, delayValue: 1, unit: 'days' as const, message: '' },
                      { enabled: true, delayMinutes: 2880, delayValue: 2, unit: 'days' as const, message: '' },
                      { enabled: true, delayMinutes: 4320, delayValue: 3, unit: 'days' as const, message: '' },
                      { enabled: true, delayMinutes: 7200, delayValue: 5, unit: 'days' as const, message: '' },
                      { enabled: true, delayMinutes: 10080, delayValue: 7, unit: 'days' as const, message: '' },
                      { enabled: true, delayMinutes: 14400, delayValue: 10, unit: 'days' as const, message: '' },
                    ];
                    const currentFUs = config.followUps || [];
                    const maxCount = config.maxFollowUps || currentFUs.length || 7;
                    const fullFUs = defaultFUs.slice(0, maxCount).map((df, i) => ({ ...df, ...(currentFUs[i] || {}) }));

                    const computeMinutes = (val: number, unit: string) => {
                      if (unit === 'hours') return val * 60;
                      if (unit === 'days') return val * 1440;
                      if (unit === 'months') return val * 43200;
                      return val; // minutes
                    };

                    const getValAndUnit = (fu: any, df: any) => {
                      if (fu.unit && fu.delayValue !== undefined) {
                        return { unit: fu.unit, val: fu.delayValue };
                      }
                      const mins = fu.delayMinutes || df.delayMinutes;
                      if (mins >= 43200 && mins % 43200 === 0) return { unit: 'months', val: mins / 43200 };
                      if (mins >= 1440 && mins % 1440 === 0) return { unit: 'days', val: mins / 1440 };
                      if (mins >= 60 && mins % 60 === 0) return { unit: 'hours', val: mins / 60 };
                      return { unit: 'minutes', val: mins };
                    };

                    return fullFUs.map((fu: any, idx: number) => {
                      const { unit: currentUnit, val: currentValue } = getValAndUnit(fu, defaultFUs[idx]);

                      return (
                        <div key={idx} className={`p-5 rounded-2xl border transition-all ${fu.enabled ? 'bg-white border-purple-200 shadow-sm' : 'bg-slate-50/80 border-slate-200/80'}`}>
                          <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
                            <h4 className="font-bold text-slate-800 flex items-center gap-2 text-xs">
                              <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs text-white ${fu.enabled ? 'bg-purple-600' : 'bg-slate-300'}`}>{idx + 1}</span>
                              Follow-up #{idx + 1}
                            </h4>
                            
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <label className="text-xs font-bold text-slate-500">Wait Gap:</label>
                                <input 
                                  type="number"
                                  min="1"
                                  value={currentValue}
                                  onChange={(e) => {
                                    const val = Math.max(1, parseInt(e.target.value) || 1);
                                    const newMinutes = computeMinutes(val, currentUnit);
                                    const newFUs = [...(config.followUps || defaultFUs)];
                                    newFUs[idx] = { ...newFUs[idx], delayValue: val, unit: currentUnit, delayMinutes: newMinutes };
                                    setConfig({ ...config, followUps: newFUs });
                                  }}
                                  className="w-16 px-3 py-1.5 text-xs bg-white border border-slate-200/80 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold"
                                />
                                <select
                                  value={currentUnit}
                                  onChange={(e) => {
                                    const unit = e.target.value as any;
                                    const newMinutes = computeMinutes(currentValue, unit);
                                    const newFUs = [...(config.followUps || defaultFUs)];
                                    newFUs[idx] = { ...newFUs[idx], delayValue: currentValue, unit, delayMinutes: newMinutes };
                                    setConfig({ ...config, followUps: newFUs });
                                  }}
                                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-200/80 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold text-slate-700 cursor-pointer"
                                >
                                  <option value="minutes">Minutes</option>
                                  <option value="hours">Hours</option>
                                  <option value="days">Days</option>
                                  <option value="months">Months</option>
                                </select>
                              </div>
                              <div 
                                onClick={() => {
                                  const newFUs = [...(config.followUps || defaultFUs)];
                                  newFUs[idx] = { ...newFUs[idx], enabled: !fu.enabled };
                                  setConfig({ ...config, followUps: newFUs });
                                }}
                                className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${fu.enabled ? 'bg-purple-600' : 'bg-slate-300'}`}
                              >
                                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${fu.enabled ? 'translate-x-6' : 'translate-x-0'}`} />
                              </div>
                            </div>
                          </div>

                          {fu.enabled && (
                            <div className="mt-3 border-t border-slate-100 pt-3 space-y-2">
                              <input
                                type="text"
                                value={fu.message || ""}
                                onChange={(e) => {
                                  const newFUs = [...(config.followUps || defaultFUs)];
                                  newFUs[idx] = { ...newFUs[idx], message: e.target.value };
                                  setConfig({ ...config, followUps: newFUs });
                                }}
                                placeholder={`Optional custom instruction/template for Follow-up #${idx + 1}...`}
                                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200/80 rounded-xl focus:ring-2 focus:ring-purple-500/20 outline-none font-medium text-slate-800"
                              />
                              <div className="flex items-center gap-2 text-xs font-semibold text-purple-700 bg-purple-50/70 p-2.5 rounded-xl border border-purple-100/80">
                                <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0" />
                                <span>AI dynamically generates personalized follow-up messages based on recent chat context. Automatically pauses if lead places an order or opts out.</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

        {/* Promotions Tab - DashMark Theme */}
        {activeTab === 'promotions' && (
          <div className="flex-1 h-full overflow-y-auto bg-[#f8f9fc]">
            <div className="p-8 md:p-10 max-w-[1400px] mx-auto w-full space-y-8">
            <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-3 tracking-tight">
              <MessageSquare className="h-7 w-7 text-purple-600" /> Promotions & Broadcasts
            </h2>
            <div className="dash-card p-8 space-y-8">
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Audience Segment</label>
                <select 
                  value={promoAudience}
                  onChange={(e) => setPromoAudience(e.target.value)}
                  className="w-full p-4 text-xs bg-slate-50 border border-slate-200/80 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold text-slate-700"
                >
                  <option value="all">All Contacts</option>
                  <option value="hot">Warm & Hot Leads (Active Inquiries)</option>
                  <option value="cold">Cold Leads (Inactive / Abandoned)</option>
                </select>
                <p className="text-xs text-slate-500 font-medium mt-1">Select which group of contacts should receive this broadcast.</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Media Attachment (Optional)</label>
                <div className="flex items-center gap-4">
                  <input 
                    type="file" 
                    className="hidden" 
                    ref={promoFileInputRef}
                    onChange={handlePromoFileChange}
                  />
                  <button 
                    onClick={() => promoFileInputRef.current?.click()}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 rounded-xl font-bold flex items-center gap-2 transition"
                  >
                    <Paperclip className="w-5 h-5" />
                    Attach File
                  </button>
                  {promoMediaName && (
                    <div className="flex items-center gap-2 bg-purple-50 text-purple-700 px-4 py-3 rounded-xl text-xs font-extrabold border border-purple-200/60">
                      <span className="truncate max-w-[200px]">{promoMediaName}</span>
                      <button onClick={removePromoMedia} className="text-purple-900 hover:text-rose-500 transition cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Broadcast Message {promoMediaBase64 ? '(Optional Caption)' : ''}</label>
                <textarea 
                  value={promoMessage}
                  onChange={(e) => setPromoMessage(e.target.value)}
                  className="w-full h-32 p-4 text-xs bg-slate-50 border border-slate-200/80 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition font-semibold text-slate-800"
                  placeholder="Enter your promotional message here... (e.g. Flash Sale: 20% off!)"
                />
              </div>

              <div className="pt-4 border-b border-slate-100 pb-8">
                <button 
                  onClick={sendPromotion}
                  disabled={sendingPromo || (!promoMessage.trim() && !promoMediaBase64)}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white font-extrabold h-13 rounded-xl shadow-md shadow-purple-500/20 transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
                >
                  {sendingPromo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {sendingPromo ? "Sending Broadcast..." : "Send Now"}
                </button>
              </div>

              {/* Abandoned Booking Recovery Section */}
              <div className="pt-4 border-b border-slate-100 pb-8">
                <div className="mb-6 flex justify-between items-end">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Abandoned Booking Recovery</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">Automatically send sequence messages to clients who stop responding during a booking or conversation.</p>
                  </div>
                  <button 
                    onClick={saveConfig}
                    disabled={savingConfig}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold py-2 px-6 rounded-xl transition-all shadow-md shadow-purple-500/20 flex items-center gap-2 text-xs cursor-pointer"
                  >
                    {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Settings
                  </button>
                </div>
                
                <div className="space-y-4">
                  {(() => {
                    const defaultFUs = [
                      { enabled: true, delayMinutes: 60, delayValue: 1, unit: 'hours' as const },
                      { enabled: true, delayMinutes: 1440, delayValue: 1, unit: 'days' as const },
                      { enabled: true, delayMinutes: 2880, delayValue: 2, unit: 'days' as const },
                      { enabled: true, delayMinutes: 4320, delayValue: 3, unit: 'days' as const },
                      { enabled: true, delayMinutes: 7200, delayValue: 5, unit: 'days' as const },
                      { enabled: true, delayMinutes: 10080, delayValue: 7, unit: 'days' as const },
                      { enabled: true, delayMinutes: 14400, delayValue: 10, unit: 'days' as const },
                    ];
                    const currentFUs = config.followUps || [];
                    const fullFUs = defaultFUs.map((df, i) => ({ ...df, ...(currentFUs[i] || {}) }));

                    const computeMinutes = (val: number, unit: string) => {
                      if (unit === 'hours') return val * 60;
                      if (unit === 'days') return val * 1440;
                      if (unit === 'months') return val * 43200;
                      return val; // minutes
                    };

                    const getValAndUnit = (fu: any, df: any) => {
                      if (fu.unit && fu.delayValue !== undefined) {
                        return { unit: fu.unit, val: fu.delayValue };
                      }
                      const mins = fu.delayMinutes || df.delayMinutes;
                      if (mins >= 43200 && mins % 43200 === 0) return { unit: 'months', val: mins / 43200 };
                      if (mins >= 1440 && mins % 1440 === 0) return { unit: 'days', val: mins / 1440 };
                      if (mins >= 60 && mins % 60 === 0) return { unit: 'hours', val: mins / 60 };
                      return { unit: 'minutes', val: mins };
                    };

                    return fullFUs.map((fu: any, idx: number) => {
                      const { unit: currentUnit, val: currentValue } = getValAndUnit(fu, defaultFUs[idx]);

                      return (
                        <div key={idx} className={`p-5 rounded-2xl border transition-all ${fu.enabled ? 'bg-white border-purple-200 shadow-sm' : 'bg-slate-50/80 border-slate-200/80'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-bold text-slate-800 flex items-center gap-2 text-xs">
                              <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs text-white ${fu.enabled ? 'bg-purple-600' : 'bg-slate-300'}`}>{idx + 1}</span>
                              Follow-up {idx + 1}
                            </h4>
                            
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <label className="text-xs font-bold text-slate-500">Wait</label>
                                <input 
                                  type="number"
                                  min="1"
                                  value={currentValue}
                                  onChange={(e) => {
                                    const val = Math.max(1, parseInt(e.target.value) || 1);
                                    const newMinutes = computeMinutes(val, currentUnit);
                                    const newFUs = [...fullFUs];
                                    newFUs[idx] = { ...newFUs[idx], delayValue: val, unit: currentUnit, delayMinutes: newMinutes };
                                    setConfig({ ...config, followUps: newFUs });
                                  }}
                                  className="w-16 px-3 py-1.5 text-xs bg-white border border-slate-200/80 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold"
                                />
                                <select
                                  value={currentUnit}
                                  onChange={(e) => {
                                    const unit = e.target.value;
                                    const newMinutes = computeMinutes(currentValue, unit);
                                    const newFUs = [...fullFUs];
                                    newFUs[idx] = { ...newFUs[idx], delayValue: currentValue, unit, delayMinutes: newMinutes };
                                    setConfig({ ...config, followUps: newFUs });
                                  }}
                                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-200/80 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold text-slate-700 cursor-pointer"
                                >
                                  <option value="minutes">Minutes</option>
                                  <option value="hours">Hours</option>
                                  <option value="days">Days</option>
                                  <option value="months">Months</option>
                                </select>
                              </div>
                              <div 
                                onClick={() => {
                                  const newFUs = [...fullFUs];
                                  newFUs[idx] = { ...newFUs[idx], enabled: !fu.enabled };
                                  setConfig({ ...config, followUps: newFUs });
                                }}
                                className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${fu.enabled ? 'bg-purple-600' : 'bg-slate-300'}`}
                              >
                                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${fu.enabled ? 'translate-x-6' : 'translate-x-0'}`} />
                              </div>
                            </div>
                          </div>

                          {fu.enabled && (
                            <div className="mt-3 border-t border-slate-100 pt-3">
                              <div className="flex items-center gap-2 text-xs font-semibold text-purple-700 bg-purple-50/70 p-3 rounded-xl border border-purple-100/80">
                                <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0" />
                                <span>AI dynamically generates context-aware follow-up messages based on recent chat history. Smart intelligence automatically skips follow-ups if the deal or booking is already completed.</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>


            </div>
          </div>
        </div>
      )}

        {/* Leads Revival Tab - DashMark Theme */}
        {activeTab === 'leads-revival' && (
          <div className="flex-1 h-full overflow-y-auto bg-[#f8f9fc]">
            <div className="p-8 md:p-10 max-w-[1400px] mx-auto w-full space-y-8">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-3 tracking-tight">
                <RefreshCw className={`h-7 w-7 text-purple-600 ${activeRevivalCampaign?.status === 'active' ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} /> Leads Revival
              </h2>
              {activeRevivalCampaign && (
                <div className={`px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${
                  activeRevivalCampaign.status === 'active' ? 'bg-purple-50 text-purple-700 border border-purple-200 animate-pulse' :
                  activeRevivalCampaign.status === 'paused' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  <span className={`h-2 w-2 rounded-full ${
                    activeRevivalCampaign.status === 'active' ? 'bg-purple-600' :
                    activeRevivalCampaign.status === 'paused' ? 'bg-amber-500' :
                    'bg-slate-400'
                  }`} />
                  Campaign {activeRevivalCampaign.status}
                </div>
              )}
            </div>

            {activeRevivalCampaign ? (
              /* Active Campaign Status Dashboard */
              <div className="space-y-8">
                <div className="dash-card p-8 space-y-6">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-6">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900">Campaign Details: {activeRevivalCampaign.id}</h3>
                      <p className="text-xs text-slate-400 font-bold mt-1">Created on {new Date(activeRevivalCampaign.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-3">
                      {activeRevivalCampaign.status === "active" ? (
                        <button
                          onClick={() => controlRevivalCampaign("pause")}
                          className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-5 rounded-xl transition text-xs flex items-center gap-2 cursor-pointer shadow-sm"
                        >
                          <Pause className="w-4 h-4" /> Pause Campaign
                        </button>
                      ) : activeRevivalCampaign.status === "paused" ? (
                        <button
                          onClick={() => controlRevivalCampaign("resume")}
                          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-2 px-5 rounded-xl transition text-xs flex items-center gap-2 cursor-pointer shadow-md shadow-purple-500/20"
                        >
                          <Play className="w-4 h-4" /> Resume Campaign
                        </button>
                      ) : null}
                      <button
                        onClick={() => controlRevivalCampaign("cancel")}
                        className="bg-rose-500 hover:bg-rose-600 text-white font-bold py-2 px-5 rounded-xl transition text-xs flex items-center gap-2 cursor-pointer shadow-sm"
                      >
                        <StopCircle className="w-4 h-4" /> Cancel Campaign
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                    <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/60">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Audience</div>
                      <div className="text-sm font-extrabold text-slate-800 capitalize">{activeRevivalCampaign.audience} Leads</div>
                    </div>
                    <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/60">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sent Today</div>
                      <div className="text-sm font-extrabold text-slate-800">{activeRevivalCampaign.sentToday} / {activeRevivalCampaign.dailyCap}</div>
                    </div>
                    <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/60">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Failed</div>
                      <div className="text-sm font-extrabold text-rose-600">{activeRevivalCampaign.failedPhones.length}</div>
                    </div>
                    <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/60">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Schedule Slot</div>
                      <div className="text-sm font-extrabold text-slate-800">{activeRevivalCampaign.timeSlotStart} - {activeRevivalCampaign.timeSlotEnd}</div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-4">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                      <span>Campaign Progress</span>
                      <span>
                        {activeRevivalCampaign.sentPhones.length + activeRevivalCampaign.failedPhones.length} / {activeRevivalCampaign.targetPhones.length} Leads
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 h-full transition-all duration-500" 
                        style={{ width: `${Math.round(((activeRevivalCampaign.sentPhones.length + activeRevivalCampaign.failedPhones.length) / activeRevivalCampaign.targetPhones.length) * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-slate-400 font-semibold">
                      <span>{Math.round(((activeRevivalCampaign.sentPhones.length + activeRevivalCampaign.failedPhones.length) / activeRevivalCampaign.targetPhones.length) * 100)}% Complete</span>
                      {activeRevivalCampaign.lastBatchSentAt && (
                        <span>Last batch sent: {new Date(activeRevivalCampaign.lastBatchSentAt).toLocaleTimeString()}</span>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50/80 p-6 rounded-2xl border border-slate-200/60 space-y-2">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Revival Message Content</h4>
                    <p className="text-xs text-slate-700 font-medium whitespace-pre-wrap">{activeRevivalCampaign.message}</p>
                    {activeRevivalCampaign.fileName && (
                      <div className="flex items-center gap-2 mt-3 bg-purple-50 border border-purple-100 text-purple-800 px-3 py-2 rounded-xl text-xs font-bold w-fit">
                        <span>Attached file: {activeRevivalCampaign.fileName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Campaign Delivery Log */}
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                  <h3 className="text-lg font-bold text-slate-900">Campaign Delivery Log</h3>
                  <div className="max-h-60 overflow-y-auto border border-slate-50 rounded-2xl divide-y divide-slate-50">
                    {activeRevivalCampaign.targetPhones.map((phone: string) => {
                      const isSent = activeRevivalCampaign.sentPhones.includes(phone);
                      const isFailed = activeRevivalCampaign.failedPhones.includes(phone);
                      let statusText = "Pending";
                      let colorClass = "bg-slate-100 text-slate-500";
                      if (isSent) {
                        statusText = "Sent";
                        colorClass = "bg-emerald-50 text-emerald-700 border border-emerald-200";
                      } else if (isFailed) {
                        statusText = "Failed";
                        colorClass = "bg-red-50 text-red-700 border border-red-200";
                      }
                      
                      const customerName = customers[phone]?.name;

                      return (
                        <div key={phone} className="flex justify-between items-center p-4 text-sm">
                          <div className="font-semibold text-slate-700">
                            {customerName ? `${customerName} (${phone})` : `+${phone}`}
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${colorClass}`}>
                            {statusText}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* Campaign Creator Form */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column (8 cols): Campaign Content & Sequence */}
                <div className="lg:col-span-8 space-y-6">
                  
                  {/* Phase 1 Introductory Message & Format */}
                  <div className="dash-card p-8 space-y-5 border border-purple-100/80 bg-white">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Phase 1 Introductory Reachout Message</h3>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">Initial message sent to target leads (e.g. Welcome back Ahmad!).</p>
                      </div>

                      {/* Format selector */}
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setRevivalMessageType("text")}
                          className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${revivalMessageType === "text" ? "bg-purple-600 text-white shadow-sm font-extrabold" : "text-slate-600 hover:text-slate-900"}`}
                        >
                          Text Only
                        </button>
                        <button
                          type="button"
                          onClick={() => setRevivalMessageType("media")}
                          className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${revivalMessageType === "media" ? "bg-purple-600 text-white shadow-sm font-extrabold" : "text-slate-600 hover:text-slate-900"}`}
                        >
                          Media / PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => setRevivalMessageType("voice")}
                          className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${revivalMessageType === "voice" ? "bg-purple-600 text-white shadow-sm font-extrabold" : "text-slate-600 hover:text-slate-900"}`}
                        >
                          🎤 Voice Note
                        </button>
                      </div>
                    </div>

                    <textarea 
                      value={revivalMessage}
                      onChange={(e) => setRevivalMessage(e.target.value)}
                      className="w-full h-28 p-4 text-xs bg-slate-50 border border-slate-200/80 rounded-2xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition font-semibold text-slate-800 leading-relaxed"
                      placeholder="Draft your revival introductory message... (Use {Name}, {Product} for personalization)"
                    />

                    {/* Phase 1 Media Selector */}
                    {revivalMessageType === "media" && (
                      <div className="p-4 bg-purple-50/60 rounded-xl border border-purple-100 space-y-3">
                        <label className="text-xs font-bold text-slate-700 block uppercase tracking-wider">Document / PDF / Image File</label>
                        <div className="flex items-center gap-4 flex-wrap">
                          <input 
                            type="file" 
                            className="hidden" 
                            ref={revivalFileInputRef}
                            onChange={handleRevivalFileChange}
                          />
                          <button 
                            type="button"
                            onClick={() => revivalFileInputRef.current?.click()}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-sm"
                          >
                            <Paperclip className="w-4 h-4" />
                            {revivalMediaName ? "Change File" : "Attach File"}
                          </button>
                          {revivalMediaName && (
                            <div className="flex items-center gap-2 bg-white text-purple-700 px-3.5 py-2 rounded-xl text-xs font-extrabold border border-purple-200 shadow-sm">
                              <span className="truncate max-w-[220px]">📎 {revivalMediaName}</span>
                              <button type="button" onClick={removeRevivalMedia} className="text-purple-900 hover:text-rose-500 transition cursor-pointer">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Phase 1 Voice Note Recorder & Player */}
                    {revivalMessageType === "voice" && (
                      <div className="p-5 bg-gradient-to-r from-purple-50 to-indigo-50/60 rounded-2xl border border-purple-200/80 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-extrabold text-purple-900 uppercase tracking-wider flex items-center gap-2">
                              <Mic className="w-4 h-4 text-purple-600" /> Phase 1 Voice Note Recording
                            </h4>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Record a live voice note from your mic or upload an audio file.</p>
                          </div>
                          {isRevivalRecording && (
                            <span className="flex items-center gap-2 text-xs font-black text-rose-600 animate-pulse bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
                              <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                              Recording... {String(Math.floor(revivalRecordTimer / 60)).padStart(2, "0")}:{String(revivalRecordTimer % 60).padStart(2, "0")}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">
                          {!isRevivalRecording ? (
                            <button
                              type="button"
                              onClick={() => startRevivalRecording("p1")}
                              className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition cursor-pointer shadow-md shadow-rose-500/20"
                            >
                              <Mic className="w-4 h-4" />
                              {revivalVoiceName ? "Re-Record Voice Note" : "Record Voice Note Now"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => stopRevivalRecording("p1")}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition cursor-pointer shadow-md shadow-emerald-500/20 animate-pulse"
                            >
                              <Square className="w-4 h-4 fill-white" />
                              Stop & Attach Recording
                            </button>
                          )}

                          <input 
                            type="file" 
                            className="hidden" 
                            ref={voiceFileInputRef}
                            accept="audio/*,.mp3,.wav,.ogg,.m4a"
                            onChange={handleRevivalVoiceChange}
                          />
                          <button 
                            type="button"
                            onClick={() => voiceFileInputRef.current?.click()}
                            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-sm"
                          >
                            <Paperclip className="w-4 h-4 text-slate-500" />
                            Upload Audio File Instead
                          </button>
                        </div>

                        {revivalVoiceName && (
                          <div className="space-y-3 pt-3 border-t border-purple-200/60">
                            <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-purple-200 shadow-sm">
                              <span className="text-xs font-extrabold text-purple-900 truncate max-w-[320px]">
                                🎤 {revivalVoiceName}
                              </span>
                              <button 
                                type="button" 
                                onClick={removeRevivalVoice} 
                                className="text-rose-600 hover:text-rose-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
                              >
                                <X className="w-4 h-4" /> Delete
                              </button>
                            </div>
                            {revivalVoicePreviewUrl && (
                              <div className="bg-white p-2.5 rounded-xl border border-purple-100 shadow-inner">
                                <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wider mb-1">Audio Playback Preview:</p>
                                <audio controls src={revivalVoicePreviewUrl} className="w-full h-9 rounded-lg" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Phase 2 Automated Follow-up Cycle Settings */}
                  <div className="bg-gradient-to-br from-slate-50 to-purple-50/40 p-6 rounded-2xl border border-purple-100 space-y-6">
                    <div className="flex items-center justify-between border-b border-purple-100 pb-4">
                      <div>
                        <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-2 uppercase tracking-wider">
                          <Zap className="w-4 h-4 text-purple-600" /> Phase 2 Automated Follow-Up Cycle
                        </h3>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">Sends automated follow-up reminders to un-replied leads every N days.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={p2Enabled}
                          onChange={(e) => setP2Enabled(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    </div>

                    {p2Enabled && (
                      <div className="space-y-5 animate-in fade-in duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">Follow-up Interval (Days)</label>
                            <input
                              type="number"
                              min={1}
                              max={60}
                              value={p2IntervalDays}
                              onChange={(e) => setP2IntervalDays(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-full px-3 py-2 text-xs bg-white border border-slate-200/80 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">Max Reminders</label>
                            <input
                              type="number"
                              min={1}
                              max={5}
                              value={p2MaxFollowUps}
                              onChange={(e) => setP2MaxFollowUps(Math.max(1, Math.min(5, parseInt(e.target.value) || 1)))}
                              className="w-full px-3 py-2 text-xs bg-white border border-slate-200/80 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 block mb-1">Follow-up Format</label>
                            <select
                              value={p2Mode}
                              onChange={(e) => setP2Mode(e.target.value as any)}
                              className="w-full px-3 py-2 text-xs bg-white border border-slate-200/80 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold text-slate-700"
                            >
                              <option value="text">Text Only</option>
                              <option value="media">Media / PDF Attachment</option>
                              <option value="voice">Voice Note (PTT)</option>
                            </select>
                          </div>
                        </div>

                        {/* Phase 2 Voice Note Live Recorder & Player */}
                        {p2Mode === "voice" && (
                          <div className="p-5 bg-gradient-to-r from-purple-50 to-indigo-50/60 rounded-2xl border border-purple-200/80 space-y-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="text-xs font-extrabold text-purple-900 uppercase tracking-wider flex items-center gap-2">
                                  <Mic className="w-4 h-4 text-purple-600" /> Phase 2 Follow-up Voice Note
                                </h4>
                                <p className="text-[11px] text-slate-500 font-medium mt-0.5">Record a live voice note for follow-up reminders or upload an audio file.</p>
                              </div>
                              {isP2Recording && (
                                <span className="flex items-center gap-2 text-xs font-black text-rose-600 animate-pulse bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
                                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                                  Recording... {String(Math.floor(p2RecordTimer / 60)).padStart(2, "0")}:{String(p2RecordTimer % 60).padStart(2, "0")}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 flex-wrap">
                              {!isP2Recording ? (
                                <button
                                  type="button"
                                  onClick={() => startRevivalRecording("p2")}
                                  className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition cursor-pointer shadow-md shadow-rose-500/20"
                                >
                                  <Mic className="w-4 h-4" />
                                  {p2VoiceName ? "Re-Record Follow-up Voice" : "Record Follow-up Voice Note"}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => stopRevivalRecording("p2")}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition cursor-pointer shadow-md shadow-emerald-500/20 animate-pulse"
                                >
                                  <Square className="w-4 h-4 fill-white" />
                                  Stop & Attach Recording
                                </button>
                              )}

                              <input 
                                type="file" 
                                className="hidden" 
                                ref={p2VoiceFileInputRef}
                                accept="audio/*,.mp3,.wav,.ogg,.m4a"
                                onChange={handleP2VoiceChange}
                              />
                              <button 
                                type="button"
                                onClick={() => p2VoiceFileInputRef.current?.click()}
                                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-sm"
                              >
                                <Paperclip className="w-4 h-4 text-slate-500" />
                                Upload Audio File Instead
                              </button>
                            </div>

                            {p2VoiceName && (
                              <div className="space-y-3 pt-3 border-t border-purple-200/60">
                                <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-purple-200 shadow-sm">
                                  <span className="text-xs font-extrabold text-purple-900 truncate max-w-[320px]">
                                    🎤 {p2VoiceName}
                                  </span>
                                  <button 
                                    type="button" 
                                    onClick={removeP2Voice} 
                                    className="text-rose-600 hover:text-rose-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
                                  >
                                    <X className="w-4 h-4" /> Delete
                                  </button>
                                </div>
                                {p2VoicePreviewUrl && (
                                  <div className="bg-white p-2.5 rounded-xl border border-purple-100 shadow-inner">
                                    <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wider mb-1">Follow-up Audio Playback Preview:</p>
                                    <audio controls src={p2VoicePreviewUrl} className="w-full h-9 rounded-lg" />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Phase 2 Media Attachment Selector */}
                        {p2Mode === "media" && (
                          <div className="p-4 bg-white rounded-xl border border-purple-200 space-y-3">
                            <label className="text-xs font-bold text-slate-700 block uppercase tracking-wider">Follow-up Document / PDF / Image File</label>
                            <div className="flex items-center gap-4 flex-wrap">
                              <input 
                                type="file" 
                                className="hidden" 
                                ref={p2FileInputRef}
                                onChange={handleP2FileChange}
                              />
                              <button 
                                type="button"
                                onClick={() => p2FileInputRef.current?.click()}
                                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-sm"
                              >
                                <Paperclip className="w-4 h-4" />
                                {p2MediaName ? "Change File" : "Attach Follow-up File"}
                              </button>
                              {p2MediaName && (
                                <div className="flex items-center gap-2 bg-purple-50 text-purple-700 px-3.5 py-2 rounded-xl text-xs font-extrabold border border-purple-200">
                                  <span className="truncate max-w-[220px]">📎 {p2MediaName}</span>
                                  <button type="button" onClick={removeP2Media} className="text-purple-900 hover:text-rose-500 transition cursor-pointer">
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="space-y-3">
                          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">Follow-up Message Sequences</label>
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={p2Message1}
                              onChange={(e) => setP2Message1(e.target.value)}
                              placeholder="Follow-up #1 text template..."
                              className="w-full px-3 py-2.5 text-xs bg-white border border-slate-200/80 rounded-xl font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                            />
                            {p2MaxFollowUps >= 2 && (
                              <input
                                type="text"
                                value={p2Message2}
                                onChange={(e) => setP2Message2(e.target.value)}
                                placeholder="Follow-up #2 text template..."
                                className="w-full px-3 py-2.5 text-xs bg-white border border-slate-200/80 rounded-xl font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                              />
                            )}
                            {p2MaxFollowUps >= 3 && (
                              <input
                                type="text"
                                value={p2Message3}
                                onChange={(e) => setP2Message3(e.target.value)}
                                placeholder="Follow-up #3 text template..."
                                className="w-full px-3 py-2.5 text-xs bg-white border border-slate-200/80 rounded-xl font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-50/80 p-6 rounded-2xl border border-slate-200/60 space-y-6">
                    <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-2 uppercase tracking-wider">
                      <ShieldCheck className="w-4 h-4 text-purple-600" /> Safety Settings (Anti-Ban Limits)
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">Time Slot Start</label>
                        <input 
                          type="time" 
                          value={revivalTimeStart}
                          onChange={(e) => handleTimeStartChange(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200/80 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">Time Slot End</label>
                        <input 
                          type="time" 
                          value={revivalTimeEnd}
                          onChange={(e) => handleTimeEndChange(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200/80 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">Delay per Reachout (Minutes)</label>
                        <input 
                          type="number" 
                          min={0.1} 
                          max={1440}
                          step={0.1}
                          value={revivalDelayMinutes}
                          onChange={(e) => handleDelayChange(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200/80 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">Daily Cap</label>
                        <input 
                          type="number" 
                          min={1} 
                          max={1000}
                          value={revivalDailyCap}
                          onChange={(e) => setRevivalDailyCap(Math.max(1, Math.min(1000, parseInt(e.target.value) || 1)))}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200/80 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold"
                        />
                      </div>
                    </div>

                    {revivalAudience === "custom" && isFileUploaded && customPhones.length > 0 && (
                      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200/60">
                        <div className="col-span-2">
                          <label className="text-xs font-bold text-slate-500 block mb-1">Target Campaign Duration</label>
                          <input 
                            type="number" 
                            min={0.1} 
                            step={0.1}
                            value={targetDuration}
                            onChange={(e) => handleTargetDurationChange(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-200/80 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-500 block mb-1">Unit</label>
                          <select 
                            value={targetDurationUnit}
                            onChange={(e) => handleTargetDurationUnitChange(e.target.value as "Days" | "Hours")}
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-200/80 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold text-slate-700"
                          >
                            <option value="Days">Days</option>
                            <option value="Hours">Hours</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={launchRevivalCampaign}
                    disabled={creatingCampaign || (!revivalMessage.trim() && !revivalMediaBase64 && !revivalVoiceBase64) || getSelectedLeadsCount() === 0}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white font-extrabold h-13 rounded-xl shadow-md shadow-purple-500/20 transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
                  >
                    {creatingCampaign ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {creatingCampaign ? "Launching Campaign..." : "Launch Campaign"}
                  </button>
                </div>

                {/* Right Column (4 cols): Target Audience, Estimator & Launch Action */}
                <div className="lg:col-span-4 space-y-6">
                  {/* Audience Segment & Leads File Import Card */}
                  <div className="dash-card p-6 space-y-5 border border-purple-100/80 bg-white">
                    <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                      <Users className="w-4 h-4 text-purple-600" /> Target Leads & Data Source
                    </h3>

                    {/* Prominent Attach Target Leads File Button */}
                    <div className="p-4 bg-purple-50/60 border border-purple-100/80 rounded-2xl space-y-3">
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">Import Target Leads File</label>
                      <input
                        type="file"
                        ref={customPhonesFileInputRef}
                        className="hidden"
                        accept=".txt,.csv,.pdf"
                        onChange={(e) => {
                          setRevivalAudience("custom");
                          handleCustomPhonesFileUploaded(e);
                        }}
                      />
                      <button 
                        type="button" 
                        onClick={() => customPhonesFileInputRef.current?.click()} 
                        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-3 px-4 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-purple-500/20"
                      >
                        <Paperclip className="w-4 h-4" />
                        {isFileUploaded ? `Leads Attached (${customPhones.length})` : "Attach Target Leads File (.pdf, .csv, .txt)"}
                      </button>
                      
                      {isFileUploaded && (
                        <div className="flex items-center justify-between text-xs text-purple-800 font-extrabold bg-white p-3 rounded-xl border border-purple-200 shadow-sm">
                          <span>Parsed {customPhones.length} valid target leads</span>
                          <button 
                            type="button" 
                            onClick={() => {
                              setCustomPhones([]);
                              setCustomPhonesInput("");
                              setIsFileUploaded(false);
                              setRevivalAudience("all");
                            }}
                            className="text-rose-600 hover:text-rose-700 font-bold ml-2 cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Or Select Saved Audience Segment</label>
                      <select 
                        value={revivalAudience}
                        onChange={(e) => setRevivalAudience(e.target.value)}
                        className="w-full p-3.5 text-xs bg-slate-50 border border-slate-200/80 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold text-slate-700"
                      >
                        <option value="all">All Contacts (Count: {getSelectedLeadsCount("all")})</option>
                        <option value="cold">Cold Leads (Inactive / Abandoned) (Count: {getSelectedLeadsCount("cold")})</option>
                        <option value="hot">Warm & Hot Leads (Active Inquiries) (Count: {getSelectedLeadsCount("hot")})</option>
                        <option value="new">New Leads (No pipeline stage) (Count: {getSelectedLeadsCount("new")})</option>
                        <option value="custom">Custom Phone List (Count: {getSelectedLeadsCount("custom")})</option>
                      </select>
                    </div>

                    {revivalAudience === "custom" && !isFileUploaded && (
                      <div className="space-y-3 pt-2 border-t border-purple-100">
                        <label className="text-[11px] font-bold text-slate-700 block uppercase tracking-wider">Paste Custom Phone Numbers</label>
                        <textarea
                          value={customPhonesInput}
                          onChange={(e) => handleCustomPhonesChange(e.target.value)}
                          placeholder="Paste numbers here...&#10;+923228487873&#10;03011660641"
                          className="w-full h-28 p-3 text-xs bg-slate-50 border border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition font-semibold text-slate-800"
                        />
                        <div className="text-xs text-slate-500 font-semibold">
                          Parsed valid numbers: <strong className="text-purple-600 font-bold">{customPhones.length}</strong>
                        </div>
                      </div>
                    )}

                    <button 
                      onClick={launchRevivalCampaign}
                      disabled={creatingCampaign || (!revivalMessage.trim() && !revivalMediaBase64 && !revivalVoiceBase64) || getSelectedLeadsCount() === 0}
                      className="w-full mt-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white font-extrabold h-13 rounded-xl shadow-md shadow-purple-500/20 transition-all flex items-center justify-center gap-2 text-xs cursor-pointer"
                    >
                      {creatingCampaign ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {creatingCampaign ? "Launching Campaign..." : "Launch Campaign"}
                    </button>
                  </div>

                  {/* AI Calculator & Settings Summary Card */}
                  {revivalAudience === "custom" && isFileUploaded && customPhones.length > 0 && (() => {
                    const targetLeads = customPhones.length;
                    const delayMins = revivalDelayMinutes;
                    const activeHours = getActiveHours();

                    const msgsPerHour = 60 / delayMins;
                    const maxDailyByTime = activeHours * msgsPerHour;
                    const actualDailySend = Math.min(revivalDailyCap, Math.round(maxDailyByTime * 10) / 10);
                    
                    const totalHoursEst = (targetLeads * delayMins) / 60;
                    const daysEst = actualDailySend > 0 ? Math.ceil(targetLeads / actualDailySend) : 0;

                    return (
                      <div className="bg-gradient-to-br from-purple-900 via-indigo-900 to-slate-900 text-white p-6 rounded-3xl shadow-xl space-y-5 border border-purple-500/20">
                        <h3 className="text-xs font-extrabold flex items-center gap-2 border-b border-white/10 pb-3 tracking-tight uppercase">
                          <Eye className="w-4 h-4 text-purple-400" /> AI Campaign Estimator
                        </h3>
                        
                        <div className="space-y-4">
                          <div>
                            <div className="text-[10px] text-purple-200 font-bold uppercase tracking-wider">Target Leads Selected</div>
                            <div className="text-2xl font-extrabold text-white">{targetLeads}</div>
                          </div>
                          
                          <div>
                            <div className="text-[10px] text-purple-200 font-bold uppercase tracking-wider">Daily Send Speed (Estimated)</div>
                            <div className="text-sm font-bold text-white">{actualDailySend} leads / day</div>
                            <div className="text-[10px] text-purple-300 font-semibold mt-0.5">
                              Limits: {revivalDailyCap} cap, {activeHours} hrs/day slot
                            </div>
                          </div>

                          <div className="pt-2 border-t border-white/10">
                            <div className="text-[10px] text-purple-200 font-bold uppercase tracking-wider">Estimated Completion</div>
                            <div className="text-lg font-extrabold text-white flex items-center gap-2 mt-1">
                              <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                              {targetLeads === 0 ? "No leads selected" : daysEst <= 1 ? `${Math.round(totalHoursEst * 10) / 10} Hours` : `${daysEst} Days`}
                            </div>
                          </div>
                        </div>

                        <div className="bg-slate-800/50 p-3 rounded-xl text-[11px] text-slate-300 font-medium leading-relaxed">
                          🛡️ <strong>Safety Autopilot:</strong> Messages are sent individually with a gap of {revivalDelayMinutes} minutes. No batch limits are used, providing a steady, natural pacing pattern.
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Campaign Logs / History List */}
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm mt-8 space-y-6">
              <h3 className="text-lg font-bold text-slate-900">Campaign History</h3>
              <div className="overflow-x-auto">
                <table className="w-left text-left border-collapse w-full">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <th className="pb-4">Campaign ID</th>
                      <th className="pb-4">Date</th>
                      <th className="pb-4">Audience</th>
                      <th className="pb-4">Status</th>
                      <th className="pb-4 text-right">Progress</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm">
                    {revivalCampaigns.filter(c => c.id !== activeRevivalCampaign?.id).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400 font-medium">No campaign history found.</td>
                      </tr>
                    ) : (
                      revivalCampaigns.filter(c => c.id !== activeRevivalCampaign?.id).reverse().map(c => {
                        const reached = c.sentPhones.length + c.failedPhones.length;
                        const total = c.targetPhones.length;
                        let statusColor = "text-slate-500 bg-slate-50";
                        if (c.status === "completed") statusColor = "text-emerald-700 bg-emerald-50";
                        else if (c.status === "cancelled") statusColor = "text-red-700 bg-red-50";

                        return (
                          <tr key={c.id}>
                            <td className="py-4 font-bold text-slate-900">{c.id}</td>
                            <td className="py-4 font-semibold text-slate-500">{new Date(c.createdAt).toLocaleDateString()}</td>
                            <td className="py-4 font-semibold text-slate-500 capitalize">{c.audience}</td>
                            <td className="py-4">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${statusColor}`}>
                                {c.status}
                              </span>
                            </td>
                            <td className="py-4 text-right font-bold text-slate-700">{reached} / {total}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

        {/* Orders Tab - DashMark Theme */}
        {activeTab === 'orders' && (
          <div className="flex-1 h-full overflow-y-auto bg-[#f8f9fc]">
            <div className="p-8 md:p-10 max-w-[1400px] mx-auto w-full space-y-8">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                <ShoppingCart className="h-7 w-7 text-purple-600" /> Incoming Orders & Projects
              </h2>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleSound}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer border shadow-sm ${
                    soundEnabled 
                      ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' 
                      : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {soundEnabled ? <Volume2 className="h-4 w-4 text-purple-600" /> : <VolumeX className="h-4 w-4 text-slate-400" />}
                  <span>{soundEnabled ? 'Order Sound Alert: ON' : 'Order Sound Alert: OFF'}</span>
                </button>

                <button
                  onClick={() => playSweetOrderSound(0.95)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 transition-all shadow-md shadow-purple-500/20 active:scale-95 cursor-pointer"
                  title="Play sample sweet order alert sound"
                >
                  <BellRing className="h-4 w-4 text-yellow-300 animate-pulse" />
                  <span>Test Sweet Sound 🔔</span>
                </button>
              </div>
            </div>
            <div className="flex gap-2 mb-2 flex-wrap">
              {[
                { id: 'all', label: 'All Items' },
                { id: 'orders', label: '🛒 Orders' },
                { id: 'appointments', label: '📅 Appointments' },
                { id: 'pending', label: 'Pending' },
                { id: 'confirmed', label: 'Confirmed' },
                { id: 'cancelled', label: 'Cancelled' }
              ].map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setOrderFilter(filter.id as any)}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    orderFilter === filter.id 
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20' 
                      : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <div className="dash-card p-8 min-h-[500px]">
              {orders.filter(o => {
                if (orderFilter === 'all') return true;
                if (orderFilter === 'orders') return !o.productName.includes('Appointment') && !o.productName.startsWith('📅');
                if (orderFilter === 'appointments') return o.productName.includes('Appointment') || o.productName.startsWith('📅');
                return o.status === orderFilter;
              }).length === 0 ? (
                <div className="text-center p-12 bg-slate-50/80 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 font-bold text-xs">
                  No orders or appointments found.
                </div>
              ) : (
                <div className="grid gap-4">
                  {orders.filter(o => {
                    if (orderFilter === 'all') return true;
                    if (orderFilter === 'orders') return !o.productName.includes('Appointment') && !o.productName.startsWith('📅');
                    if (orderFilter === 'appointments') return o.productName.includes('Appointment') || o.productName.startsWith('📅');
                    return o.status === orderFilter;
                  }).reverse().map((order) => {
                    const isAppointment = order.productName.includes('Appointment') || order.productName.startsWith('📅');
                    const clientName = customers[order.phone]?.name || order.customerName || order.phone || "Verified Client";
                    const isEditingThis = editingNotesId === order.id;

                    return (
                      <div key={order.id} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col gap-5">
                        
                        {/* Top Header Row: ID, Category Badge, Status Badge, Timestamp */}
                        <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-100">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="text-xs font-black text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg font-mono tracking-tight">{order.id}</span>
                            
                            <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 ${
                              isAppointment 
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80' 
                                : 'bg-purple-50 text-purple-700 border border-purple-200/80'
                            }`}>
                              {isAppointment ? <Calendar className="w-3 h-3 text-indigo-600" /> : <ShoppingCart className="w-3 h-3 text-purple-600" />}
                              {isAppointment ? '📅 APPOINTMENT / CALL' : '🛒 PRODUCT ORDER'}
                            </span>

                            <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 ${
                              order.status === 'pending' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                              order.status === 'confirmed' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                              order.status === 'cancelled' ? 'bg-rose-50 text-rose-800 border border-rose-200' :
                              'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                order.status === 'pending' ? 'bg-amber-500 animate-pulse' :
                                order.status === 'confirmed' ? 'bg-emerald-500' :
                                order.status === 'cancelled' ? 'bg-rose-500' : 'bg-slate-400'
                              }`} />
                              {order.status}
                            </span>
                          </div>

                          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {new Date(order.timestamp).toLocaleString()}
                          </span>
                        </div>

                        {/* Client Info & Service/Product Name */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-100">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0">
                                <User className="w-4 h-4" />
                              </div>
                              <span className="text-sm font-black text-slate-900">{clientName}</span>
                              <a 
                                href={`https://wa.me/${order.phone.replace(/[^0-9]/g, '')}`} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <MessageCircle className="w-3 h-3" /> WhatsApp
                              </a>
                            </div>
                            <h3 className="text-xs font-bold text-purple-950 pl-9 truncate">{order.productName}</h3>
                          </div>

                          <div className="flex items-center gap-6 text-xs font-semibold text-slate-600 pl-9 md:pl-0">
                            <div>
                              <span className="text-slate-400 block text-[10px] uppercase font-bold">Phone Number</span>
                              <span className="font-extrabold text-slate-800">{order.phone}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px] uppercase font-bold">{isAppointment ? 'Business / Booking' : 'Price'}</span>
                              <span className="font-extrabold text-purple-700">{order.price || (isAppointment ? 'Service Booking' : 'N/A')}</span>
                            </div>
                          </div>
                        </div>

                        {/* Specifications / Schedule / Address grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-600">
                          <div className="flex items-start gap-2 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                            {isAppointment ? <Calendar className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" /> : <MapPin className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />}
                            <div>
                              <span className="font-bold text-slate-400 block text-[10px] uppercase">{isAppointment ? 'Schedule / Date & Time' : 'Delivery Address'}</span>
                              <span className="font-semibold text-slate-800">{order.deliveryAddress || 'Pending Details'}</span>
                            </div>
                          </div>

                          {!isAppointment && (
                            <div className="flex items-center gap-4 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                              <div>
                                <span className="font-bold text-slate-400 block text-[10px] uppercase">Size</span>
                                <span className="font-extrabold text-slate-800">{order.size || 'N/A'}</span>
                              </div>
                              <div>
                                <span className="font-bold text-slate-400 block text-[10px] uppercase">Color</span>
                                <span className="font-extrabold text-slate-800">{order.color || 'N/A'}</span>
                              </div>
                              <div>
                                <span className="font-bold text-slate-400 block text-[10px] uppercase">Payment</span>
                                <span className="font-extrabold text-slate-800">{order.paymentMethod || 'COD'}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* NOTES & CALL SUMMARY SECTION */}
                        <div className="bg-gradient-to-r from-purple-50/70 via-indigo-50/40 to-slate-50/70 p-4 rounded-xl border border-purple-100/80 space-y-2">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2 text-xs font-extrabold text-purple-900">
                              <FileText className="w-4 h-4 text-purple-600" />
                              <span>Call Summary & Client Notes</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={async () => {
                                  setGeneratingNotesId(order.id);
                                  try {
                                    const res = await fetch('/api/whatsapp/orders', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ id: order.id, phone: order.phone })
                                    });
                                    const data = await res.json();
                                    if (data.notes) {
                                      order.notes = data.notes;
                                      fetchOrders();
                                    }
                                  } catch (e) {
                                    console.error(e);
                                  } finally {
                                    setGeneratingNotesId(null);
                                  }
                                }}
                                disabled={generatingNotesId === order.id}
                                className="text-[11px] font-bold text-purple-700 hover:text-purple-900 bg-white border border-purple-200 hover:border-purple-300 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                              >
                                {generatingNotesId === order.id ? <Loader2 className="w-3 h-3 animate-spin text-purple-600" /> : <Sparkles className="w-3 h-3 text-purple-600" />}
                                <span>{generatingNotesId === order.id ? 'Generating AI Notes...' : 'Generate AI Notes'}</span>
                              </button>

                              <button
                                onClick={() => {
                                  if (isEditingThis) {
                                    setEditingNotesId(null);
                                  } else {
                                    setEditingNotesId(order.id);
                                    setNotesInput(order.notes || "");
                                  }
                                }}
                                className="text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                              >
                                <Edit3 className="w-3 h-3 text-slate-500" />
                                <span>{isEditingThis ? 'Cancel' : 'Edit'}</span>
                              </button>
                            </div>
                          </div>

                          {isEditingThis ? (
                            <div className="space-y-2 pt-1">
                              <textarea
                                value={notesInput}
                                onChange={(e) => setNotesInput(e.target.value)}
                                placeholder="Add custom call summary, client requirements, or special instructions..."
                                className="w-full p-2.5 text-xs bg-white border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500/20 outline-none text-slate-800 font-medium min-h-[70px]"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={async () => {
                                    await fetch('/api/whatsapp/orders', {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ id: order.id, notes: notesInput })
                                    });
                                    setEditingNotesId(null);
                                    fetchOrders();
                                  }}
                                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                >
                                  Save Notes
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-700 font-medium leading-relaxed bg-white/80 p-3 rounded-lg border border-purple-100/60">
                              {order.notes ? (
                                <p className="whitespace-pre-wrap">{order.notes}</p>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">No summary notes recorded yet. Click "Generate AI Notes" or "Edit" to record details.</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Bottom Actions Row */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-3">
                          <button
                            onClick={() => {
                              setSelectedChat(order.phone);
                              setActiveTab("inbox");
                            }}
                            className="text-xs font-extrabold text-purple-700 hover:text-purple-900 flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <MessageSquare className="w-4 h-4 text-purple-600" />
                            <span>Open Chat History</span>
                          </button>

                          <div className="flex items-center gap-2">
                            {order.status === 'pending' && (
                              <>
                                <button
                                  onClick={async () => {
                                    await fetch('/api/whatsapp/orders', {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ id: order.id, status: 'confirmed' })
                                    });
                                    fetchOrders();
                                  }}
                                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-extrabold rounded-xl transition-all shadow-md shadow-purple-500/20 cursor-pointer active:scale-95"
                                >
                                  Confirm
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
                                  className="px-4 py-2 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-extrabold rounded-xl transition-colors cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
            </div>
          </div>
        </div>
      )}
      {/* Contacts / Leads Tab - DashMark Theme */}
      {activeTab === 'contacts' && (
        <div className="flex-1 h-full overflow-y-auto bg-[#f8f9fc]">
          <div className="p-8 max-w-[1400px] mx-auto w-full space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-3 tracking-tight">
                <Users className="h-7 w-7 text-purple-600" /> Pipeline & Lead Management
              </h2>
              <p className="text-xs text-slate-500 mt-1 font-medium">Nurture and manage your WhatsApp leads through the sales pipeline.</p>
            </div>
            
            {/* View Mode & Search */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="bg-slate-100/70 p-1 rounded-xl flex items-center text-xs font-bold border border-slate-200/50">
                <button 
                  onClick={() => setContactsViewMode("board")}
                  className={`px-4 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${contactsViewMode === 'board' ? 'bg-white text-purple-700 shadow-sm font-extrabold' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Activity className="w-4 h-4" /> Board View
                </button>
                <button 
                  onClick={() => setContactsViewMode("list")}
                  className={`px-4 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${contactsViewMode === 'list' ? 'bg-white text-purple-700 shadow-sm font-extrabold' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Users className="w-4 h-4" /> List View
                </button>
              </div>
            </div>
          </div>

          {/* Search bar and counts */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6 dash-card p-4">
            <div className="bg-slate-100/70 border border-slate-200/60 rounded-xl flex items-center px-4 py-2 gap-3 w-full md:max-w-md focus-within:ring-2 focus-within:ring-purple-500/20 focus-within:border-purple-500 transition-all">
              <Search className="h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search leads by name or phone..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-xs w-full placeholder:text-slate-400 text-slate-700 font-semibold" 
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 self-end md:self-center">
              Total: {Object.values(customers).filter(c => isContactActiveLead(c)).length} Active Leads
            </div>
          </div>

          {contactsViewMode === 'board' ? (
            /* KANBAN BOARD VIEW */
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start min-h-[600px] pb-10">
              {(() => {
                const stages: { id: "new" | "qualified" | "warm" | "cold" | "completed"; title: string; color: string; bg: string; dot: string }[] = [
                  { id: 'new', title: 'New Leads', color: 'border-indigo-500', bg: 'bg-indigo-50/30', dot: 'bg-indigo-500' },
                  { id: 'qualified', title: 'Qualified', color: 'border-amber-400', bg: 'bg-amber-50/30', dot: 'bg-amber-400' },
                  { id: 'warm', title: 'Warm Leads', color: 'border-purple-500', bg: 'bg-purple-50/40', dot: 'bg-purple-600' },
                  { id: 'cold', title: 'Cold Leads', color: 'border-slate-400', bg: 'bg-slate-50/70', dot: 'bg-slate-400' },
                  { id: 'completed', title: 'Completed', color: 'border-emerald-500', bg: 'bg-emerald-50/30', dot: 'bg-emerald-500' }
                ];

                const getCustomerStage = (c: any): "new" | "qualified" | "warm" | "cold" | "completed" => {
                  if (c.pipelineStage) return c.pipelineStage;
                  if (c.leadStatus === "cold") return "cold";
                  const hasOrder = orders.some((o: any) => o.phone === c.phone && (o.status === "confirmed" || o.status === "delivered"));
                  if (hasOrder) return "completed";
                  const hasAppt = orders.some((o: any) => o.phone === c.phone && (o.productName?.includes('Appointment') || o.productName?.includes('Call')));
                  if (hasAppt) return "qualified";
                  if (c.leadStatus === "hot") return "warm";
                  const userChat = chats[c.phone];
                  if (Array.isArray(userChat) && userChat.length > 2) return "warm";
                  return "new";
                };

                const activeLeads = Object.values(customers).filter(c => isContactActiveLead(c));

                const filteredCustomers = activeLeads.filter(c => {
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
                    <div key={stage.id} className={`flex flex-col rounded-2xl border border-slate-200/80 ${stage.bg} p-4 min-h-[500px] max-h-[750px]`}>
                      {/* Column Header */}
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200/50 text-slate-800">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${stage.dot}`}></span>
                          <h3 className="font-extrabold text-xs">{stage.title}</h3>
                        </div>
                        <span className="bg-white border border-slate-200/60 text-slate-600 text-xs px-2 py-0.5 rounded-full font-extrabold shadow-sm">
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
                              <div key={lead.phone} className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-all">
                                {/* Header */}
                                <div className="flex items-start justify-between min-w-0">
                                  <div className="min-w-0">
                                    <h4 className="font-extrabold text-xs text-slate-800 truncate" title={leadName}>{leadName}</h4>
                                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">+{lead.phone}</p>
                                  </div>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${hasAi ? 'bg-purple-50 text-purple-700 border border-purple-100' : 'bg-slate-100 text-slate-500'}`}>
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
                                        className="text-slate-400 hover:text-rose-500 text-[9px] ml-1 cursor-pointer"
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
                                        className="text-[11px] border border-slate-300 rounded px-1.5 py-0.5 w-20 focus:outline-none focus:border-purple-500 font-semibold"
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
                                        className="text-[10px] font-bold text-purple-600"
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
                                      className="inline-flex items-center gap-0.5 text-[9px] font-bold text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded-full border border-purple-100 cursor-pointer"
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
                                    className="text-[11px] bg-slate-50 border border-slate-200/80 rounded-lg p-1.5 text-slate-700 font-bold w-[100px] outline-none focus:border-purple-500"
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
                                    className="text-[11px] font-extrabold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200/60 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
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
            <div className="dash-card overflow-hidden min-h-[500px]">
              {Object.values(customers).filter(c => isContactActiveLead(c)).length === 0 ? (
                <div className="text-center p-12 text-slate-400 font-bold text-xs">
                  No active leads found.
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100">
                      <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Name / Phone</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Tags</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Pipeline Stage</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(customers)
                      .filter(c => isContactActiveLead(c))
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
                          const hasAppt = orders.some((o: any) => o.phone === c.phone && (o.productName?.includes('Appointment') || o.productName?.includes('Call')));
                          if (hasAppt) return "qualified";
                          if (c.leadStatus === "hot") return "warm";
                          const userChat = chats[c.phone];
                          if (Array.isArray(userChat) && userChat.length > 2) return "warm";
                          return "new";
                        };
                        const stage = getCustomerStage(customer);
                        
                        return (
                          <tr key={customer.phone} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-4">
                                <div className="h-9 w-9 bg-purple-50 text-purple-700 border border-purple-200 rounded-full flex items-center justify-center font-bold text-xs shadow-sm">
                                  {customer.name ? customer.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                                </div>
                                <div>
                                  <div className="font-extrabold text-xs text-slate-900">{customer.name || 'Unknown User'}</div>
                                  <div className="text-[11px] text-slate-400 font-semibold">+{customer.phone}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex flex-wrap gap-1 items-center max-w-xs">
                                {customer.tags && customer.tags.map((t: string) => (
                                  <span key={t} className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-slate-50 border border-slate-200/80 px-2 py-0.5 rounded-full text-slate-600">
                                    {t}
                                    <button 
                                      onClick={() => {
                                        const nextTags = customer.tags.filter((x: string) => x !== t);
                                        updateCustomerField(customer.phone, { tags: nextTags });
                                      }}
                                      className="text-slate-400 hover:text-rose-500 text-[9px] ml-1 cursor-pointer"
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
                                      className="text-[11px] border border-slate-300 rounded px-1.5 py-0.5 w-16 focus:outline-none focus:border-purple-500"
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
                                      className="text-[10px] font-bold text-purple-600"
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
                                    className="text-[9px] font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded-full border border-purple-100 cursor-pointer"
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
                                className="text-xs bg-slate-50 border border-slate-200/80 rounded-lg p-1.5 text-slate-700 font-bold w-[120px] outline-none focus:border-purple-500"
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
                                className="text-xs font-extrabold text-purple-700 hover:bg-purple-50 px-3 py-1.5 rounded-lg transition-colors border border-purple-200/60 cursor-pointer"
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
        </div>
      )}

    </div>
  );
}
