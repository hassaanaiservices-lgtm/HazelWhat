"use client";

import React, { useEffect, useState, useRef } from "react";
import { MessageCircle, QrCode, Loader2, CheckCircle2, ShieldCheck, Zap, X, Save, MessageSquare, Settings, Plus, Trash2, Search, MoreVertical, Phone, Video, Paperclip, Smile, Mic, CheckCheck, User, Check, Send, StopCircle, Inbox, Bot, Network, BookOpen, Users, AlertCircle, ShoppingCart, Activity, Eye, EyeOff, RefreshCw, Pause, Play, Smartphone, Square, Package, Edit3, Upload, ExternalLink, Image as ImageIcon, Tag, Globe, Sparkles, Volume2, VolumeX, BellRing, Bell, LogOut, FileText, Calendar, MapPin, Clock, Receipt } from "lucide-react";
import EmojiPicker from "emoji-picker-react";

export default function DashboardPage() {
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me?portal=client');
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

        // Fetch active tenant config from /api/whatsapp/config
        try {
          const configRes = await fetch('/api/whatsapp/config');
          if (configRes.ok) {
            const configData = await configRes.json();
            if (configData.success && configData.config) {
              setConfig((prev: any) => ({
                ...prev,
                ...configData.config,
                systemPrompt: configData.config.systemPrompt || (data.tenant?.systemPrompt) || prev.systemPrompt,
                productInfo: configData.config.productInfo || (data.tenant?.knowledgeBase) || prev.productInfo,
                products: (configData.config.products && configData.config.products.length > 0) ? configData.config.products : (data.tenant?.products || prev.products || [])
              }));
            }
          }
        } catch (cfgErr) {
          if (data.tenant) {
            setConfig((prev: any) => ({
              ...prev,
              systemPrompt: data.tenant.systemPrompt || prev.systemPrompt,
              productInfo: data.tenant.knowledgeBase || prev.productInfo,
              products: data.tenant.products || prev.products || []
            }));
          }
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
  
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  // Knowledge Base Sub-Tab State ("prompt" | "products" | "kb" | "keywords" | "settings")
  const [kbSubTab, setKbSubTab] = useState<"prompt" | "products" | "kb" | "keywords" | "settings">("prompt");

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

    const formatPrice = (price: any) => {
      if (price === undefined || price === null) return "N/A";
      const str = String(price).trim();
      if (str === "N/A" || str === "Hidden" || str === "0" || str === "0.00" || str === "") return str;
      const hasCurrency = /^[A-Za-z\$\£\€\¥]/i.test(str) || str.includes("PKR") || str.includes("Rs.");
      if (hasCurrency) return str;
      return `${currency} ${str}`;
    };

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
            variationsText += `\n    - ${v.title}: ${formatPrice(v.price)}`;
          });
        }
        const basePrice = formatPrice(p.price);
        text += `- ${p.title} (Base Price/Range: ${basePrice})\n  Image: ${p.image || "N/A"}\n  Link: ${p.link || "N/A"}${p.description ? `\n  Description: ${p.description}` : ""}${variationsText}\n\n`;
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

  const [inboxFilter, setInboxFilter] = useState<"all" | "normal" | "groups" | "revival" | "complaints">("all");
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
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<any | null>(null);
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
  const [orderFilter, setOrderFilter] = useState<'all' | 'orders' | 'appointments' | 'new_order' | 'under_baking' | 'pending' | 'confirmed' | 'delivered' | 'cancelled'>('all');
  const [leadFilter, setLeadFilter] = useState<'all' | 'hot' | 'cold'>('all');
  const [analytics, setAnalytics] = useState<any>(null);

  // Sound Alert for Received Orders
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [newOrderBanner, setNewOrderBanner] = useState<{ id: string; phone?: string; customerName: string; productName: string; amount?: string; time: string } | null>(null);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const isFirstOrderFetchRef = useRef<boolean>(true);
  const lastLoggedStatusRef = useRef<string | null>(null);
  const orderAlarmIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const knownComplaintPhonesRef = useRef<Set<string>>(new Set());
  const isFirstComplaintFetchRef = useRef<boolean>(true);

  const stopOrderAlarm = () => {
    if (orderAlarmIntervalRef.current) {
      clearInterval(orderAlarmIntervalRef.current);
      orderAlarmIntervalRef.current = null;
    }
    setNewOrderBanner(null);
  };

  // Clean up order alarm interval on component unmount
  useEffect(() => {
    return () => {
      if (orderAlarmIntervalRef.current) {
        clearInterval(orderAlarmIntervalRef.current);
        orderAlarmIntervalRef.current = null;
      }
    };
  }, []);

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

  const playComplaintSound = (vol = 0.95) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const now = ctx.currentTime;

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

      // Distinct alert: A4 -> Eb4 (tritone alarm)
      const notes = [
        { freq: 440.00, start: 0.00, duration: 0.25 }, // A4
        { freq: 311.13, start: 0.15, duration: 0.25 }, // Eb4
        { freq: 440.00, start: 0.30, duration: 0.25 }, // A4
        { freq: 311.13, start: 0.45, duration: 0.60 }, // Eb4
      ];

      notes.forEach(({ freq, start, duration }) => {
        const startTime = now + start;

        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "sawtooth";
        osc1.frequency.setValueAtTime(freq, startTime);
        
        gain1.gain.setValueAtTime(0.0001, startTime);
        gain1.gain.linearRampToValueAtTime(0.18, startTime + 0.02);
        gain1.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
        
        osc1.connect(gain1);
        gain1.connect(masterGain);
        osc1.start(startTime);
        osc1.stop(startTime + duration);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(freq, startTime);
        
        gain2.gain.setValueAtTime(0.0001, startTime);
        gain2.gain.exponentialRampToValueAtTime(0.40, startTime + 0.015);
        gain2.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
        
        osc2.connect(gain2);
        gain2.connect(masterGain);
        osc2.start(startTime);
        osc2.stop(startTime + duration);
      });
    } catch (e) {
      console.warn("Could not play complaint sound:", e);
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

  const toggleChatAi = async (enabled: boolean, targetPhone?: string) => {
    const phone = targetPhone || selectedChat;
    if (!phone) return;
    setCustomers(prev => ({
      ...prev,
      [phone]: {
        ...(prev[phone] || { phone }),
        aiEnabled: enabled
      }
    }));
    await updateCustomerField(phone, { aiEnabled: enabled });
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
    fetchAnalytics();
    fetchRevivalCampaigns();

    // Optimized real-time polling interval to keep UI snappy without locking browser thread
    const pollInterval = setInterval(() => {
      fetchOrders();
      fetchSession();
    }, 6000);

    const chatPollInterval = setInterval(() => {
      fetchChats();
    }, 8000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(chatPollInterval);
    };
  }, [savingConfig, savingKB, savingKeywords, savingFollowUps]);


  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/whatsapp/orders");
      if (!res.ok) {
        console.warn("[Client] fetchOrders HTTP error:", res.status);
        return; // Preserve existing orders!
      }
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
            // Play single sweet alert chime for new incoming order
            if (soundEnabled) {
              playSweetOrderSound(0.98);
            }

            // Trigger floating order alert banner
            const customerName = customers[brandNewOrder.phone]?.name || brandNewOrder.phone || "Customer";
            setNewOrderBanner({
              id: brandNewOrder.id,
              phone: brandNewOrder.phone,
              customerName,
              productName: brandNewOrder.productName || "New Order",
              amount: brandNewOrder.price || brandNewOrder.amount || "",
              time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
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
        const currentStatus = data.session.status;
        
        if (currentStatus !== lastLoggedStatusRef.current) {
          lastLoggedStatusRef.current = currentStatus;
          if (currentStatus === "connected") {
            console.log("🟢 [Client] WhatsApp status: CONNECTED SUCCESSFULLY");
          } else if (currentStatus === "disconnected") {
            console.log("🔴 [Client] WhatsApp status: DISCONNECTED");
          } else if (currentStatus === "connecting") {
            console.log("🟡 [Client] WhatsApp status: TRYING TO CONNECT (AWAITING SCAN)");
          } else if (currentStatus === "error") {
            console.log("❌ [Client] WhatsApp status: FAILING TO CONNECT / ERROR");
          } else {
            console.log(`📡 [Client] WhatsApp status: ${currentStatus.toUpperCase()}`);
          }
        }

        if (data.session.status === "connected") {
          setStatus("connected");
        } else if (data.session.qrCode) {
          setQrCode(data.session.qrCode);
          setStatus((prev) => (prev === "connected" ? "connected" : "scanning"));
        } else if (data.session.status === "disconnected" && status === "connected") {
          setStatus("idle");
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
      if (data.success && data.config) {
        setConfig((prev: any) => {
          const activeTag = typeof document !== 'undefined' ? document.activeElement?.tagName : '';
          const activeId = typeof document !== 'undefined' ? (document.activeElement as HTMLElement)?.id : '';
          if (activeTag === 'TEXTAREA' || activeTag === 'INPUT') {
            return {
              ...data.config,
              systemPrompt: activeId === 'systemPromptInput' ? prev.systemPrompt : data.config.systemPrompt,
              productInfo: activeId === 'productInfoInput' ? prev.productInfo : data.config.productInfo
            };
          }
          return data.config;
        });
        validateApiKey(data.config.apiKey || data.config.anthropicApiKey || data.config.openRouterApiKey);
      }
    } catch (e) {
      console.error(e);
    }
  };


  const fetchChats = async () => {
    try {
      const timestamp = new Date().getTime();
      const res = await fetch(`/api/whatsapp/chats?t=${timestamp}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (!res.ok) {
        console.warn("[Client] fetchChats HTTP error:", res.status);
        return; // Preserve existing chats in state! DO NOT clear state on HTTP error.
      }
      const data = await res.json();
      
      if (data.success && data.chats) {
        const mergedChats = { ...data.chats };
        const customersMap: Record<string, any> = {};
        if (data.customers) {
          let newlyDetectedComplaint = false;
          data.customers.forEach((c: any) => {
            customersMap[c.phone] = c;
            if (!mergedChats[c.phone]) {
              mergedChats[c.phone] = [];
            }

            const hasComplaint = (() => {
              try {
                const p = JSON.parse(c.preferences || "{}");
                return p.hasComplaint === true;
              } catch(e) {
                return false;
              }
            })();

            if (hasComplaint) {
              if (!knownComplaintPhonesRef.current.has(c.phone)) {
                knownComplaintPhonesRef.current.add(c.phone);
                newlyDetectedComplaint = true;
              }
            } else {
              knownComplaintPhonesRef.current.delete(c.phone);
            }
          });

          if (isFirstComplaintFetchRef.current) {
            isFirstComplaintFetchRef.current = false;
          } else if (newlyDetectedComplaint) {
            if (soundEnabled) {
              playComplaintSound(0.98);
            }
          }
        }
        
        // Non-destructive update: Only update if mergedChats has data or if current state is empty
        setChats(prev => {
          if (Object.keys(mergedChats).length > 0 || Object.keys(prev).length === 0) {
            return mergedChats;
          }
          return prev;
        });
        setCustomers(prev => {
          if (Object.keys(customersMap).length > 0 || Object.keys(prev).length === 0) {
            return customersMap;
          }
          return prev;
        });
      } else {
         console.warn("[Client] fetchChats returned success: false or invalid chats payload", data);
      }
    } catch (e) {
      console.error("[Client] fetchChats error:", e);
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
    let interval: NodeJS.Timeout;
    if (activeTab === "leads-revival" || activeRevivalCampaign) {
      interval = setInterval(fetchRevivalCampaigns, 5000);
    }
    return () => clearInterval(interval);
  }, [activeTab, activeRevivalCampaign]);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    if (status === "waiting_qr" || status === "scanning" || status === "creating") {
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
            } else if (currentStatus === "failed") {
              setStatus("error");
              setErrorMessage("Connection failed. Please try again.");
              clearInterval(pollInterval);
            } else if (data.session.qrCode) {
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

  // QR countdown timer — WhatsApp QR is valid for ~60 seconds
  useEffect(() => {
    if (status !== "scanning" || !qrGeneratedAt) {
      setQrSecondsLeft(60);
      return;
    }
    const tick = () => {
      const elapsed = Math.floor((Date.now() - qrGeneratedAt) / 1000);
      const left = Math.max(0, 60 - elapsed);
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

      const res = await fetch("/api/whatsapp/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fresh: true }),
      });
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

  const disconnectAndDeleteChats = async () => {
    if (!confirm("Are you sure? This will disconnect your WhatsApp device AND permanently delete ALL chat history, contacts, and orders for this account. This cannot be undone.")) return;
    try {
      // First disconnect session to stop any incoming sync/writes
      await fetch("/api/whatsapp/session", { method: "DELETE" });
      // Then delete all chats & customers
      await fetch("/api/whatsapp/chats", { method: "DELETE" });
      setStatus("idle");
      setSessionData(null);
      setQrCode(null);
      setChats({});
      setCustomers({});
      setOrders([]);
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
        [selectedChat]: [...chatHistory, { id: "agent_temp", role: "assistant", content, timestamp: new Date().toISOString() }]
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
      
      {/* Floating Continuous Loud Order Alert Banner */}
      {newOrderBanner && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-pulse bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white p-4 sm:p-5 rounded-2xl shadow-2xl border-2 border-yellow-300 flex items-center gap-5 max-w-xl w-[92%] sm:w-full">
          <div className="bg-yellow-400 text-slate-900 p-3 rounded-full flex items-center justify-center animate-bounce shadow-lg flex-shrink-0">
            <Volume2 className="h-7 w-7 text-red-700" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="bg-yellow-300 text-red-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">🚨 NEW ORDER RECEIVED!</span>
              <span className="text-rose-100 text-xs font-bold">{newOrderBanner.time}</span>
            </div>
            <h4 className="text-sm sm:text-base font-black text-white truncate mt-1">{newOrderBanner.productName}</h4>
            <p className="text-xs text-rose-100 truncate">Customer: <span className="font-extrabold text-white">{newOrderBanner.customerName}</span> {newOrderBanner.amount && `• ${newOrderBanner.amount}`}</p>
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button 
              onClick={() => {
                stopOrderAlarm();
                if (newOrderBanner.phone) {
                  setSelectedChat(newOrderBanner.phone);
                  setActiveTab('inbox');
                } else {
                  setActiveTab('orders');
                }
              }} 
              className="px-3.5 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-slate-900 text-xs font-black rounded-xl transition-all shadow-lg active:scale-95 cursor-pointer flex items-center gap-1.5 justify-center"
            >
              <MessageSquare className="w-4 h-4" /> Chat & View
            </button>
            <button 
              onClick={stopOrderAlarm} 
              className="px-3.5 py-1 bg-white/20 hover:bg-white/30 text-white text-[11px] font-extrabold rounded-xl transition-all text-center cursor-pointer flex items-center justify-center gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Accept & Stop
            </button>
          </div>
        </div>
      )}

      {/* 1. Left Sidebar - Intercom Editorial Style */}
      <div className="w-[260px] flex-shrink-0 bg-[#f5f1ec] border-r border-[#d3cec6] flex flex-col py-6 overflow-y-auto z-20 custom-scrollbar">
        
        {/* Brand Header */}
        <div className="px-6 mb-6">
          <div className="flex items-center gap-3 font-semibold text-lg text-[#111111] tracking-tight">
            <div className="bg-[#ff5600] p-2 rounded-lg text-white shadow-xs">
              <Zap className="h-5 w-5 fill-white text-white" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="leading-tight font-medium text-base">HazelWhat</span>
              <span className="text-[11px] font-medium text-[#626260] truncate max-w-[170px] bg-white px-2 py-0.5 rounded border border-[#d3cec6] mt-1">
                For: {sessionData?.businessName || config?.businessName || (sessionData?.name && !sessionData.name.includes("Super Admin") ? sessionData.name : "Workspace")}
              </span>
            </div>
          </div>
        </div>

        {/* Workspace Section */}
        <div className="px-6 mb-2 text-[11px] font-semibold text-[#7b7b78] uppercase tracking-wider">Workspace</div>
        <div className="flex flex-col gap-1 px-3 mb-6">
          <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${activeTab === 'dashboard' ? 'bg-[#111111] text-white shadow-xs' : 'text-[#626260] hover:bg-[#ebe7e1] hover:text-[#111111]'}`}>
            <Zap className={`h-4 w-4 ${activeTab === 'dashboard' ? 'text-[#ff5600]' : 'text-[#7b7b78]'}`} /> Dashboard
          </button>
          <button onClick={() => setActiveTab('inbox')} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${activeTab === 'inbox' ? 'bg-[#111111] text-white shadow-xs' : 'text-[#626260] hover:bg-[#ebe7e1] hover:text-[#111111]'}`}>
            <Inbox className={`h-4 w-4 ${activeTab === 'inbox' ? 'text-[#ff5600]' : 'text-[#7b7b78]'}`} /> Inbox
          </button>
          <button onClick={() => setActiveTab('orders')} className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${activeTab === 'orders' ? 'bg-[#111111] text-white shadow-xs' : 'text-[#626260] hover:bg-[#ebe7e1] hover:text-[#111111]'}`}>
            <div className="flex items-center gap-3">
              <ShoppingCart className={`h-4 w-4 ${activeTab === 'orders' ? 'text-[#ff5600]' : 'text-[#7b7b78]'}`} />
              <span>Orders</span>
            </div>
            {orders && orders.filter((o: any) => o.status === 'pending').length > 0 && (
              <span key={orders.filter((o: any) => o.status === 'pending').length} className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#ff5600] px-1.5 text-[10px] font-bold text-white shadow-xs animate-pop-in">
                {orders.filter((o: any) => o.status === 'pending').length}
              </span>
            )}
          </button>
          <button onClick={() => setActiveTab('contacts')} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${activeTab === 'contacts' ? 'bg-[#111111] text-white shadow-xs' : 'text-[#626260] hover:bg-[#ebe7e1] hover:text-[#111111]'}`}>
            <Users className={`h-4 w-4 ${activeTab === 'contacts' ? 'text-[#ff5600]' : 'text-[#7b7b78]'}`} /> Contacts
          </button>
        </div>

        {/* Intelligence Section */}
        <div className="px-6 mb-2 text-[11px] font-semibold text-[#7b7b78] uppercase tracking-wider">Intelligence</div>
        <div className="flex flex-col gap-1 px-3 mb-6">
          <button onClick={() => setActiveTab('agents')} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${activeTab === 'agents' ? 'bg-[#111111] text-white shadow-xs' : 'text-[#626260] hover:bg-[#ebe7e1] hover:text-[#111111]'}`}>
            <BookOpen className={`h-4 w-4 ${activeTab === 'agents' ? 'text-[#ff5600]' : 'text-[#7b7b78]'}`} /> Knowledge Base
          </button>
          <button onClick={() => setActiveTab('channels')} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${activeTab === 'channels' ? 'bg-[#111111] text-white shadow-xs' : 'text-[#626260] hover:bg-[#ebe7e1] hover:text-[#111111]'}`}>
            <Network className={`h-4 w-4 ${activeTab === 'channels' ? 'text-[#ff5600]' : 'text-[#7b7b78]'}`} /> Channels
          </button>
        </div>

        {/* Growth Section */}
        <div className="px-6 mb-2 text-[11px] font-semibold text-[#7b7b78] uppercase tracking-wider">Growth</div>
        <div className="flex flex-col gap-1 px-3 mb-6">
          <button onClick={() => setActiveTab('promotions')} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${activeTab === 'promotions' ? 'bg-[#111111] text-white shadow-xs' : 'text-[#626260] hover:bg-[#ebe7e1] hover:text-[#111111]'}`}>
            <Clock className={`h-4 w-4 ${activeTab === 'promotions' ? 'text-[#ff5600]' : 'text-[#7b7b78]'}`} /> Follow Ups
          </button>
          <button disabled title="Lead Revival is currently disabled" className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all opacity-40 cursor-not-allowed ${activeTab === 'leads-revival' ? 'bg-[#111111] text-white shadow-xs' : 'text-[#626260]'}`}>
            <RefreshCw className={`h-4 w-4 ${activeTab === 'leads-revival' ? 'text-[#ff5600]' : 'text-[#7b7b78]'}`} /> Leads Revival (Disabled)
          </button>
        </div>

        {/* Account Section */}
        <div className="px-6 mb-2 text-[11px] font-semibold text-[#7b7b78] uppercase tracking-wider">Account</div>
        <div className="flex flex-col gap-1 px-3 mb-6">
          <button onClick={() => setActiveTab('settings')} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${activeTab === 'settings' ? 'bg-[#111111] text-white shadow-xs' : 'text-[#626260] hover:bg-[#ebe7e1] hover:text-[#111111]'}`}>
            <Settings className={`h-4 w-4 ${activeTab === 'settings' ? 'text-[#ff5600]' : 'text-[#7b7b78]'}`} /> Settings
          </button>
          <button 
            onClick={async () => {
              try {
                await fetch('/api/auth/logout', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ portal: 'client' })
                });
              } catch (e) {
                console.error("Logout error:", e);
              }
              window.location.href = '/';
            }} 
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer text-rose-700 hover:bg-rose-50/80"
          >
            <LogOut className="h-4 w-4 text-rose-600" /> Sign Out
          </button>
        </div>

        {/* Bottom User Footer */}
        <div className="mt-auto px-5 pt-4 border-t border-[#d3cec6] flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-9 w-9 bg-[#111111] text-white rounded-full flex items-center justify-center font-semibold text-xs shadow-xs relative flex-shrink-0">
              {(sessionData?.businessName || sessionData?.name || 'H')[0]?.toUpperCase()}
              <div className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-emerald-500 rounded-full border-2 border-white"></div>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-semibold text-[#111111] truncate">{sessionData?.businessName || sessionData?.name || 'Hassaan'}</h4>
              <p className="text-[10px] text-[#626260] capitalize font-medium">{sessionData?.role || 'Client Account'}</p>
            </div>
          </div>
          <button 
            onClick={async () => {
              try {
                await fetch('/api/auth/logout', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ portal: 'client' })
                });
              } catch (e) {
                console.error("Logout error:", e);
              }
              window.location.href = '/';
            }} 
            className="p-2 text-[#626260] hover:text-[#111111] hover:bg-[#ebe7e1] rounded-lg transition-colors cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 2. Overview Dashboard Tab - Intercom Editorial Theme */}
      {activeTab === 'dashboard' && (
        <div className="flex-1 h-full overflow-y-auto bg-[#f5f1ec]">
          <div className="p-8 max-w-[1300px] mx-auto w-full space-y-6">
            
            {/* Header with Period Filter */}
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-2xl font-semibold text-[#111111] tracking-tight">Overview</h2>
              <div className="flex items-center gap-4">
                <div className="bg-[#ebe7e1] p-1 rounded-lg flex items-center text-xs font-medium border border-[#d3cec6]">
                  <button 
                    onClick={() => setPeriodFilter('weekly')}
                    className={`px-4 py-1.5 rounded-md transition-all cursor-pointer ${
                      periodFilter === 'weekly' ? 'bg-[#111111] text-white shadow-xs font-medium' : 'text-[#626260] hover:text-[#111111]'
                    }`}
                  >
                    Weekly
                  </button>
                  <button 
                    onClick={() => setPeriodFilter('monthly')}
                    className={`px-4 py-1.5 rounded-md transition-all cursor-pointer ${
                      periodFilter === 'monthly' ? 'bg-[#111111] text-white shadow-xs font-medium' : 'text-[#626260] hover:text-[#111111]'
                    }`}
                  >
                    Monthly
                  </button>
                  <button 
                    onClick={() => setPeriodFilter('yearly')}
                    className={`px-4 py-1.5 rounded-md transition-all cursor-pointer ${
                      periodFilter === 'yearly' ? 'bg-[#111111] text-white shadow-xs font-medium' : 'text-[#626260] hover:text-[#111111]'
                    }`}
                  >
                    Yearly
                  </button>
                </div>
                <button className="flex items-center gap-2 bg-white border border-[#d3cec6] px-4 py-1.5 rounded-lg text-xs font-medium text-[#111111] hover:bg-[#ebe7e1] shadow-xs cursor-pointer">
                  <svg className="w-4 h-4 text-[#ff5600]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h7"/></svg>
                  Filter
                </button>
              </div>
            </div>

            {/* Lead Revival Executive Dashboard Banner Widget - Intercom Inverse Charcoal */}
            <div className="bg-[#111111] p-6 rounded-xl text-white shadow-xs flex flex-col md:flex-row items-center justify-between gap-6 border border-[#313130]">
              <div className="flex items-center gap-4">
                <div className="bg-[#ff5600] p-3.5 rounded-lg text-white shadow-xs">
                  <RefreshCw className={`h-6 w-6 text-white ${activeRevivalCampaign?.status === 'active' ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold tracking-tight text-white">WhatsApp Lead Revival CRM</h3>
                    <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full uppercase ${
                      activeRevivalCampaign?.status === 'active' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse' :
                      activeRevivalCampaign?.status === 'paused' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                      'bg-[#313130] text-[#9c9fa5]'
                    }`}>
                      {activeRevivalCampaign ? `Campaign ${activeRevivalCampaign.status}` : 'Idle'}
                    </span>
                  </div>
                  <p className="text-xs text-[#9c9fa5] font-normal mt-1">
                    2-Phase re-engagement engine for WhatsApp leads with voice notes, media & ban-prevention.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 w-full md:w-auto justify-end">
                <div className="text-right hidden sm:block">
                  <div className="text-[10px] font-medium text-[#9c9fa5] uppercase">Leads Processed</div>
                  <div className="text-xl font-semibold text-white font-mono">
                    {activeRevivalCampaign ? `${activeRevivalCampaign.sentPhones.length} / ${activeRevivalCampaign.targetPhones.length}` : '0 Leads'}
                  </div>
                </div>
                <button
                  disabled
                  title="Lead Revival is currently disabled"
                  className="bg-[#313130] text-[#9c9fa5] font-medium px-4 py-2.5 rounded-lg text-xs flex items-center gap-2 cursor-not-allowed border border-white/10"
                >
                  <RefreshCw className="h-4 w-4 text-[#9c9fa5]" />
                  <span>Manage Lead Revival</span>
                </button>
                <button
                  onClick={async () => {
                    try {
                      await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ portal: 'client' }) });
                      window.location.href = '/login';
                    } catch (e) {
                      window.location.href = '/login';
                    }
                  }}
                  className="bg-[#313130] hover:bg-black text-white font-medium px-4 py-2.5 rounded-lg text-xs transition shadow-xs flex items-center gap-2 cursor-pointer border border-white/10"
                >
                  <LogOut className="h-4 w-4 text-rose-400" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
            
            {/* Top Metric Cards - Floating White Tiles */}
            <div className="dash-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-0">
              <div className="flex-1 md:border-r border-[#ebe7e1] md:pr-6">
                <div className="text-[#7b7b78] font-semibold text-[11px] uppercase tracking-wider mb-2">Total Revenue ({periodFilter})</div>
                <div className="flex items-end gap-3">
                  <div className="text-2xl font-semibold text-[#111111]">
                    {totalRevenue === 0 ? `${currencySymbol}0` : `${currencySymbol}${totalRevenue.toLocaleString()}`}
                  </div>
                  <div className="bg-[#f5f1ec] text-[#111111] border border-[#d3cec6] text-xs font-medium px-2.5 py-0.5 rounded-full mb-0.5">
                    {totalOrdersCount === 0 ? '0 Orders' : `+${totalOrdersCount} Orders`}
                  </div>
                </div>
              </div>
              
              <div className="flex-1 md:border-r border-[#ebe7e1] md:px-6">
                <div className="text-[#7b7b78] font-semibold text-[11px] uppercase tracking-wider mb-2">Active Users / Contacts</div>
                <div className="flex items-end gap-3">
                  <div className="text-2xl font-semibold text-[#111111]">
                    {activeUsersCount.toLocaleString()}
                  </div>
                  <div className="bg-[#f5f1ec] text-[#111111] border border-[#d3cec6] text-xs font-medium px-2.5 py-0.5 rounded-full mb-0.5">
                    {activeUsersCount === 0 ? '0%' : '+100%'}
                  </div>
                </div>
              </div>
              
              <div className="flex-1 md:border-r border-[#ebe7e1] md:px-6">
                <div className="text-[#7b7b78] font-semibold text-[11px] uppercase tracking-wider mb-2">Customer Lifetime Value</div>
                <div className="flex items-end gap-3">
                  <div className="text-2xl font-semibold text-[#111111]">
                    {customerLifetimeValue === 0 ? `${currencySymbol}0.00` : `${currencySymbol}${customerLifetimeValue.toFixed(2)}`}
                  </div>
                  <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-medium px-2.5 py-0.5 rounded-full mb-0.5">
                    {totalOrdersCount > 0 ? 'Active' : 'New Client'}
                  </div>
                </div>
              </div>
              
              <div className="flex-1 md:pl-6">
                <div className="text-[#7b7b78] font-semibold text-[11px] uppercase tracking-wider mb-2">Total Orders Placed</div>
                <div className="flex items-end gap-3">
                  <div className="text-2xl font-semibold text-[#111111]">
                    {totalOrdersCount.toLocaleString()}
                  </div>
                  <div className="bg-[#f5f1ec] text-[#111111] border border-[#d3cec6] text-xs font-medium px-2.5 py-0.5 rounded-full mb-0.5">
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
                      <h3 className="font-semibold text-[#111111] text-sm">Churn Rate</h3>
                      <MoreVertical className="w-4 h-4 text-[#7b7b78]" />
                    </div>
                    <div className="text-xs font-normal text-[#626260] mt-1">Client account retention status</div>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-2xl font-semibold text-[#111111]">0.00%</div>
                      <div className="text-[11px] font-normal text-[#626260] mt-1"><span className="text-emerald-700 font-semibold">0.00%</span> churn rate</div>
                    </div>
                    <div className="w-24 h-12 flex items-end">
                      <svg viewBox="0 0 100 40" className="w-full h-full stroke-emerald-600 fill-emerald-500/10" strokeWidth="2"><path d="M0 35 Q 25 35, 50 35 T 100 35 L 100 40 L 0 40 Z"/></svg>
                    </div>
                  </div>
                </div>

                {/* User Growth */}
                <div className="dash-card p-6 flex flex-col justify-between h-[180px]">
                  <div>
                    <div className="flex justify-between items-start">
                      <h3 className="font-semibold text-[#111111] text-sm">User & Lead Growth</h3>
                      <MoreVertical className="w-4 h-4 text-[#7b7b78]" />
                    </div>
                    <div className="text-xs font-normal text-[#626260] mt-1">Incoming leads & WhatsApp sessions</div>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-2xl font-semibold text-[#111111]">{activeUsersCount}</div>
                      <div className="text-[11px] font-normal text-[#626260] mt-1"><span className="text-[#ff5600] font-semibold">{totalOrdersCount}</span> orders received</div>
                    </div>
                    <div className="w-24 h-12 flex items-end">
                      <svg viewBox="0 0 100 40" className="w-full h-full stroke-[#ff5600] fill-[#ff5600]/10" strokeWidth="2"><path d="M0 35 Q 25 30, 50 25 T 100 15 L 100 40 L 0 40 Z"/></svg>
                    </div>
                  </div>
                </div>

                {/* Conversion Funnel */}
                <div className="dash-card p-6 md:col-span-2">
                  <div className="flex justify-between items-start mb-6">
                    <h3 className="font-semibold text-[#111111] text-sm">Conversion Funnel</h3>
                    <MoreVertical className="w-4 h-4 text-[#7b7b78]" />
                  </div>
                  <div className="flex items-center gap-4 mb-8 text-xs font-medium text-[#626260] flex-wrap">
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#111111]"></div> Total Contacts ({activeUsersCount})</div>
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#ff5600]"></div> Active Chats ({Object.keys(chats).length})</div>
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#65b5ff]"></div> Revival Campaigns ({revivalCampaigns.length})</div>
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#0bdf50]"></div> Orders Placed ({totalOrdersCount})</div>
                  </div>
                  
                  <div className="flex items-end justify-between h-40 pt-4 gap-2 md:gap-4 pb-2 border-l border-b border-[#ebe7e1] px-4 relative ml-4">
                    <div className="absolute left-[-24px] top-0 text-[10px] text-[#7b7b78] h-full flex flex-col justify-between pb-2 font-medium">
                      <span>100</span><span>75</span><span>50</span><span>25</span><span>0</span>
                    </div>
                    {[
                      [activeUsersCount ? 40 : 5, chats ? 30 : 5, revivalCampaigns.length ? 20 : 5, totalOrdersCount ? 30 : 5],
                      [activeUsersCount ? 50 : 5, chats ? 35 : 5, revivalCampaigns.length ? 25 : 5, totalOrdersCount ? 40 : 5],
                      [activeUsersCount ? 60 : 5, chats ? 45 : 5, revivalCampaigns.length ? 30 : 5, totalOrdersCount ? 50 : 5],
                      [activeUsersCount ? 70 : 5, chats ? 55 : 5, revivalCampaigns.length ? 35 : 5, totalOrdersCount ? 60 : 5]
                    ].map((heights, i) => (
                      <div key={i} className="flex-1 flex flex-col justify-end w-6 md:w-12 max-w-[48px] rounded-t overflow-hidden gap-[1px]">
                        <div className="w-full bg-[#0bdf50] rounded-t-sm" style={{height: `${heights[3]}%`}}></div>
                        <div className="w-full bg-[#65b5ff]" style={{height: `${heights[2]}%`}}></div>
                        <div className="w-full bg-[#ff5600]" style={{height: `${heights[1]}%`}}></div>
                        <div className="w-full bg-[#111111] rounded-b-sm" style={{height: `${heights[0]}%`}}></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Product Performance */}
              <div className="dash-card p-6 h-full flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <h3 className="font-semibold text-[#111111] text-sm">Product Sales Performance</h3>
                  <MoreVertical className="w-4 h-4 text-[#7b7b78]" />
                </div>
                
                <div className="bg-[#ebe7e1] p-1 rounded-lg flex items-center text-xs font-medium mb-6 border border-[#d3cec6]">
                  <button className="flex-1 py-1.5 bg-white text-[#111111] shadow-xs rounded font-medium cursor-pointer">Live Orders</button>
                  <button className="flex-1 py-1.5 text-[#626260] hover:text-[#111111] cursor-pointer">Top Items</button>
                </div>

                <div className="flex justify-between border-b border-[#ebe7e1] pb-6 mb-6">
                  <div>
                    <div className="text-xs font-medium text-[#7b7b78] mb-1 truncate max-w-[130px]">{topProd1Name}</div>
                    <div className="text-lg font-semibold text-[#111111] flex items-center gap-2">
                      <span className="text-[#ff5600] text-sm">↑</span> {topProd1Count} orders
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-[#7b7b78] mb-1 truncate max-w-[130px]">{topProd2Name}</div>
                    <div className="text-lg font-semibold text-[#111111] flex items-center gap-2">
                      <span className="text-emerald-600 text-sm">↑</span> {topProd2Count} orders
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="text-xs font-medium text-[#7b7b78] mb-1">Average Daily Sales</div>
                    <div className="text-2xl font-semibold text-[#111111]">
                      {avgDailySales === 0 ? `${currencySymbol}0.00` : `${currencySymbol}${avgDailySales.toFixed(2)}`}
                    </div>
                  </div>
                  <div className="bg-[#f5f1ec] text-[#111111] text-[10px] font-medium px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-[#d3cec6]">
                    <span className="text-xs leading-none text-[#ff5600]">↑</span> Live
                  </div>
                </div>

                <div className="mt-auto h-40 flex items-end justify-between gap-1 md:gap-2 border-b border-l border-[#ebe7e1] px-2 pt-2 relative ml-4">
                  <div className="absolute left-[-22px] top-0 text-[10px] text-[#7b7b78] h-full flex flex-col justify-between pb-2 font-medium">
                      <span>100</span><span>75</span><span>50</span><span>25</span><span>0</span>
                  </div>
                  {totalOrdersCount === 0 ? (
                    [5, 5, 5, 5, 5, 5, 5].map((h, i) => (
                      <div key={i} className="flex-1 bg-[#ebe7e1] rounded-t-sm" style={{height: `${h}%`}}></div>
                    ))
                  ) : (
                    [20, 40, 65, 80, 50, 70, 90].map((h, i) => (
                      <div key={i} className="flex-1 bg-[#111111] hover:bg-[#ff5600] transition-colors rounded-t-sm" style={{height: `${h}%`}}></div>
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
        <div className="flex-1 h-full overflow-y-auto bg-[#f5f1ec]">
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
                <div>
                  <label className="block text-xs font-bold text-purple-700 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-purple-600" /> Kitchen / Manager WhatsApp Alert Number
                  </label>
                  <input 
                    type="text" 
                    value={config.managerPhone || ''} 
                    onChange={e => setConfig({...config, managerPhone: e.target.value})}
                    className="w-full bg-purple-50/50 border border-purple-200 rounded-xl px-4 py-3 text-slate-900 font-semibold focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-sm transition-all"
                    placeholder="e.g. 923001234567 (Receive instant WhatsApp notifications for every new order!)"
                  />
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

      {/* 1. Left Conversation Sidebar - Intercom Editorial Theme */}
      {activeTab === 'inbox' && (
        <div className="w-[360px] flex-shrink-0 bg-white border-r border-[#d3cec6] flex flex-col relative z-10">
          
          {/* Connection Status Banner */}
          {status !== 'connected' && (
            <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-800 text-xs font-medium">
                <div className="bg-[#ff5600] p-1 rounded-full"><MessageCircle className="h-3 w-3 text-white" /></div> 
                WhatsApp Disconnected
              </div>
              <button onClick={() => setActiveTab('channels')} className="text-[#ff5600] text-xs font-semibold hover:underline cursor-pointer">Reconnect</button>
            </div>
          )}

          {/* Global AI Autopilot Auto-Toggle */}
          <div className="p-3 mx-4 mt-4 bg-[#f5f1ec] rounded-xl border border-[#d3cec6] flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative flex items-center justify-center">
                <span className={`w-2.5 h-2.5 rounded-full ${config.globalAiEnabled !== false ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-semibold text-[#111111] truncate">Global AI Autopilot</h4>
                <p className="text-[10px] text-[#626260] font-normal truncate">Auto-save on toggle</p>
              </div>
            </div>
            <button
              onClick={toggleGlobalAiAutopilot}
              disabled={isAutopilotSaving}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 ${
                config.globalAiEnabled !== false
                  ? 'bg-[#ff5600] hover:bg-[#e04c00] text-white'
                  : 'bg-[#ebe7e1] text-[#626260] hover:text-[#111111]'
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
            <div className="bg-[#f5f1ec] border border-[#d3cec6] rounded-lg flex items-center px-3.5 py-2 gap-2.5 focus-within:ring-1 focus-within:ring-[#ff5600] focus-within:border-[#ff5600] transition-all relative">
              <Search className="h-4 w-4 text-[#7b7b78]" />
              <input 
                type="text" 
                placeholder="Search chats..." 
                value={inboxSearch}
                onChange={(e) => setInboxSearch(e.target.value)}
                className="bg-transparent border-none outline-none text-xs w-full placeholder:text-[#9c9fa5] text-[#111111] font-medium pr-6" 
              />
              {inboxSearch && (
                <button 
                  onClick={() => setInboxSearch("")} 
                  className="absolute right-3 text-[#7b7b78] hover:text-[#111111] focus:outline-none cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Inbox Segmentation Tabs */}
          <div className="flex gap-1.5 px-4 pb-3 border-b border-[#d3cec6] mt-1 overflow-x-auto">
            <button 
              onClick={() => setInboxFilter("all")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                inboxFilter === "all" ? "bg-[#111111] text-white shadow-xs" : "bg-[#ebe7e1] text-[#626260] hover:text-[#111111]"
              }`}
            >
              All
            </button>
            <button 
              onClick={() => setInboxFilter("normal")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                inboxFilter === "normal" ? "bg-[#111111] text-white shadow-xs" : "bg-[#ebe7e1] text-[#626260] hover:text-[#111111]"
              }`}
            >
              Conversations
            </button>
            <button 
              onClick={() => setInboxFilter("groups")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                inboxFilter === "groups" ? "bg-[#111111] text-white shadow-xs" : "bg-[#ebe7e1] text-[#626260] hover:text-[#111111]"
              }`}
            >
              Groups
            </button>
             <button 
              onClick={() => setInboxFilter("revival")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                inboxFilter === "revival" ? "bg-[#ff5600] text-white shadow-xs" : "bg-[#ebe7e1] text-[#626260] hover:text-[#111111]"
              }`}
            >
              Leads Revival
            </button>
            <button 
              onClick={() => setInboxFilter("complaints")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                inboxFilter === "complaints" ? "bg-rose-600 text-white shadow-xs" : "bg-rose-50 text-rose-700 border border-rose-200/50 hover:bg-rose-100"
              }`}
            >
              <span>Complaints</span>
              {Object.values(customers).filter(c => {
                try {
                  const p = JSON.parse(c.preferences || "{}");
                  return p.hasComplaint === true;
                } catch(e) {
                  return false;
                }
              }).length > 0 && (
                <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-rose-200 text-rose-800 animate-pulse">
                  {Object.values(customers).filter(c => {
                    try {
                      const p = JSON.parse(c.preferences || "{}");
                      return p.hasComplaint === true;
                    } catch(e) {
                      return false;
                    }
                  }).length}
                </span>
              )}
            </button>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
            {(() => {
              const filteredChats = Object.entries(chats)
                .filter(([phone, messages]) => {
                  if (inboxSearch) {
                    const searchLower = inboxSearch.toLowerCase();
                    const displayName = (customers[phone]?.name || phone).toLowerCase();
                    const matchesName = displayName.includes(searchLower);
                    const matchesPhone = phone.includes(searchLower);
                    const matchesMessage = messages.some(m => m.content?.toLowerCase().includes(searchLower));
                    if (!matchesName && !matchesMessage && !matchesPhone) return false;
                  }

                  const customer = customers[phone];
                  const isRevival = customer?.tags?.includes("revival-sent");
                  const isGroup = phone.includes("@g.us");
                  const hasComplaint = (() => {
                    try {
                      const p = JSON.parse(customer?.preferences || "{}");
                      return p.hasComplaint === true;
                    } catch(e) {
                      return false;
                    }
                  })();

                  if (inboxFilter === "normal" && (isRevival || isGroup)) return false;
                  if (inboxFilter === "groups" && !isGroup) return false;
                  if (inboxFilter === "revival" && !isRevival) return false;
                  if (inboxFilter === "complaints" && !hasComplaint) return false;

                  return true;
                })
                .sort((a, b) => {
                  const aHasComplaint = (() => {
                    try {
                      const p = JSON.parse(customers[a[0]]?.preferences || "{}");
                      return p.hasComplaint === true;
                    } catch(e) {
                      return false;
                    }
                  })();
                  const bHasComplaint = (() => {
                    try {
                      const p = JSON.parse(customers[b[0]]?.preferences || "{}");
                      return p.hasComplaint === true;
                    } catch(e) {
                      return false;
                    }
                  })();

                  if (aHasComplaint && !bHasComplaint) return -1;
                  if (!aHasComplaint && bHasComplaint) return 1;

                  const aLast = a[1][a[1].length - 1];
                  const bLast = b[1][b[1].length - 1];
                  const aTime = aLast ? new Date(aLast.timestamp).getTime() : 0;
                  const bTime = bLast ? new Date(bLast.timestamp).getTime() : 0;
                  return bTime - aTime;
                });

              if (filteredChats.length === 0) {
                return (
                  <div className="h-full flex flex-col items-center justify-center text-[#7b7b78] p-4 text-center">
                    <p className="text-xs font-medium">No chats found.</p>
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
                 const isChatAiEnabled = customers[phone]?.aiEnabled !== undefined ? customers[phone].aiEnabled : (config.globalAiEnabled !== false);
                 const hasComplaint = (() => {
                   try {
                     const p = JSON.parse(customers[phone]?.preferences || "{}");
                     return p.hasComplaint === true;
                   } catch(e) {
                     return false;
                   }
                 })();
                 const timeStr = (() => {
                   if (!lastMessage?.timestamp) return "";
                   const d = new Date(lastMessage.timestamp);
                   return isNaN(d.getTime()) ? "" : d.toLocaleDateString([], { month: '2-digit', day: '2-digit' });
                 })();
                 
                 const percents = [40, 12, 20, 80, 100];
                 const ringPercent = percents[i % percents.length];

                 return (
                   <div 
                     key={phone} 
                     onClick={() => {
                       setSelectedChat(phone);
                       markChatAsRead(phone);
                     }}
                     className={`cursor-pointer px-4 py-3 flex items-start gap-3 transition-all border-b border-[#ebe7e1] relative ${isSelected ? 'bg-[#f5f1ec] before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-[#ff5600]' : 'hover:bg-[#f5f1ec]/60'}`}
                   >
                     <div className="relative flex-shrink-0 mt-0.5">
                       <div className={`h-10 w-10 rounded-full border ${hasComplaint ? 'border-rose-500 bg-rose-50 shadow-[0_0_8px_rgba(244,63,94,0.35)]' : isChatAiEnabled ? 'border-[#ff5600]' : 'border-[#d3cec6]'} p-0.5 relative flex items-center justify-center bg-white shadow-xs`}>
                         <div className={`h-full w-full ${hasComplaint ? 'bg-rose-600' : 'bg-[#111111]'} text-white rounded-full flex items-center justify-center overflow-hidden`}>
                           <User className="h-4 w-4 text-white" />
                         </div>
                         {hasComplaint && (
                           <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                             <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600 border border-white"></span>
                           </span>
                         )}
                       </div>
                       <div className={`absolute -bottom-1 -left-1 bg-[#111111] text-white text-[8px] font-medium px-1.5 rounded-full border border-white`}>
                         {ringPercent}%
                       </div>
                     </div>
                     
                     <div className="flex-1 min-w-0">
                       <div className="flex justify-between items-baseline mb-0.5">
                         <h4 className={`text-xs font-semibold truncate flex items-center gap-1.5 ${hasComplaint ? 'text-rose-700 font-bold' : 'text-[#111111]'}`}>
                           <span>{displayName}</span>
                           {hasComplaint && (
                             <span className="text-[8px] bg-rose-100 text-rose-800 font-bold px-1 rounded-sm border border-rose-200">
                               COMPLAINT
                             </span>
                           )}
                         </h4>
                         <span className="text-[10px] font-medium text-[#7b7b78]">{isMounted ? timeStr : ""}</span>
                       </div>
                       <div className="flex items-center gap-1.5 text-xs text-[#626260] font-normal">
                         {lastMessage?.role === 'assistant' && <CheckCheck className="h-3.5 w-3.5 text-[#ff5600] flex-shrink-0" />}
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

      {/* 3. Main Content View - Intercom Floating White Canvas */}
      {activeTab === 'inbox' && (
        <div className="flex-1 flex flex-col min-w-0 relative z-0 bg-[#f5f1ec]">
          {!selectedChat ? (
            <div className="h-full flex flex-col items-center justify-center text-[#7b7b78] space-y-4">
              <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center border border-[#d3cec6] text-[#111111] text-2xl shadow-xs">
                💬
              </div>
              <h2 className="text-lg font-semibold text-[#111111] tracking-tight">Client Messaging Panel</h2>
              <p className="text-xs text-[#626260] font-normal">Select a contact from the list to start messaging.</p>
            </div>
          ) : (
            <>
               {/* Chat Header */}
               <div className="h-[68px] bg-white border-b border-[#d3cec6] px-6 flex items-center justify-between z-10 flex-shrink-0 shadow-xs">
                 <div className="flex items-center gap-3.5 cursor-pointer">
                   {(() => {
                     const isHeaderAiEnabled = customers[selectedChat]?.aiEnabled !== undefined ? customers[selectedChat].aiEnabled : (config.globalAiEnabled !== false);
                     return (
                       <div className={`h-10 w-10 rounded-full ${isHeaderAiEnabled ? 'bg-[#ff5600]' : 'bg-[#111111]'} flex items-center justify-center overflow-hidden flex-shrink-0 shadow-xs`}>
                         <User className="h-5 w-5 text-white" />
                       </div>
                     );
                   })()}
                   <div className="flex flex-col">
                    <h4 className="font-semibold text-[#111111] text-sm">
                      {(() => {
                        const savedName = customers[selectedChat]?.name;
                        if (savedName && savedName !== selectedChat) return savedName;
                        if (selectedChat.includes('@g.us')) return `Group: ${selectedChat.split('@')[0]}`;
                        if (selectedChat.includes('@lid')) return `+${selectedChat.split('@')[0]} (Linked Device)`;
                        if (selectedChat.includes('@')) return `+${selectedChat.split('@')[0]}`;
                        return `+${selectedChat}`;
                      })()}
                    </h4>
                    <span className="text-[11px] text-[#7b7b78] font-normal">({selectedChat.split('@')[0]}) | Active Contact</span>
                  </div>
                </div>
                
                {/* Autopilot Toggle */}
                <div className="flex items-center bg-[#ebe7e1] border border-[#d3cec6] rounded-lg p-1">
                  {(() => {
                    const isAiEnabled = customers[selectedChat]?.aiEnabled !== undefined ? customers[selectedChat].aiEnabled : (config.globalAiEnabled !== false);
                    return (
                      <>
                        <button 
                          onClick={() => toggleChatAi(true)}
                          className={`${isAiEnabled ? 'bg-[#111111] text-white shadow-xs' : 'text-[#626260] hover:text-[#111111]'} text-xs font-medium px-3.5 py-1 rounded-md transition cursor-pointer`}
                        >
                          Autopilot
                        </button>
                        <button 
                          onClick={() => toggleChatAi(false)}
                          className={`${!isAiEnabled ? 'bg-[#111111] text-white shadow-xs' : 'text-[#626260] hover:text-[#111111]'} text-xs font-medium px-3.5 py-1 rounded-md transition cursor-pointer`}
                        >
                          Copilot
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>
              
              {/* Complaint Summary Box */}
              {(() => {
                const customer = customers[selectedChat];
                let hasComplaint = false;
                let complaintSummary = "";
                try {
                  const p = JSON.parse(customer?.preferences || "{}");
                  hasComplaint = p.hasComplaint === true;
                  complaintSummary = p.complaintSummary || "";
                } catch(e) {}

                if (!hasComplaint) return null;

                return (
                  <div className="bg-rose-50 border-b border-rose-200/60 px-6 py-3.5 flex items-center justify-between z-10 flex-shrink-0 animate-fade-in">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="bg-rose-100 p-2 rounded-lg text-rose-700 flex-shrink-0 mt-0.5">
                        <AlertCircle className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-bold text-rose-800 tracking-wider uppercase mb-0.5">
                          ACTIVE CUSTOMER COMPLAINT SUMMARY
                        </span>
                        <p className="text-xs text-rose-700 font-medium leading-relaxed">
                          "{complaintSummary || "Customer has filed an active complaint."}"
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                      <button 
                        onClick={async () => {
                          let currentPrefs: any = {};
                          try {
                            if (customer?.preferences) {
                              currentPrefs = JSON.parse(customer.preferences);
                            }
                          } catch(e) {}
                          
                          currentPrefs.hasComplaint = false;
                          currentPrefs.complaintSummary = "";
                          
                          await updateCustomerField(selectedChat, { preferences: JSON.stringify(currentPrefs) });
                        }}
                        className="bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold px-3 py-1.5 rounded transition cursor-pointer flex items-center gap-1 shadow-xs"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Resolve & Clear Flag</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

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
                  const isAI = m.id && (m.id.startsWith('ai_') || m.id.startsWith('system_') || m.id === 'ai_temp');

                  return (
                    <div key={i} className={`flex w-full ${isSent ? 'justify-end' : 'justify-start'}`}>
                      <div className={`relative max-w-[65%] rounded-xl px-4 py-2.5 text-xs font-normal leading-relaxed shadow-xs ${
                        isSent 
                          ? 'bg-[#111111] text-white rounded-tr-xs' 
                          : 'bg-white text-[#111111] rounded-tl-xs border border-[#d3cec6]'
                      }`}>
                        {displayMediaUrl && (
                          <div className="mb-2 rounded-lg overflow-hidden border border-[#d3cec6] bg-slate-50 flex items-center justify-center p-1">
                            {isSticker || m.mediaType?.startsWith('image/') || isDataUri || isImageUrl ? (
                              <img src={displayMediaUrl} alt="Media Preview" className="max-w-[260px] max-h-[260px] object-contain rounded border border-[#d3cec6]" />
                            ) : m.mediaType?.startsWith('video/') ? (
                              <video src={displayMediaUrl} controls className="max-w-full max-h-[300px] object-cover rounded" />
                            ) : m.mediaType?.startsWith('audio/') ? (
                              <audio src={displayMediaUrl} controls className="max-w-full rounded-full" />
                            ) : (
                              <a href={displayMediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 text-[#ff5600] hover:bg-[#ebe7e1] transition rounded-lg">
                                <Paperclip className="h-5 w-5" />
                                <span className="font-semibold underline text-xs truncate">Document Attachment</span>
                              </a>
                            )}
                          </div>
                        )}
                        {m.content && !isDataUri && !isImageUrl && (
                          <span className="pr-14 block whitespace-pre-wrap">
                            {isSent && (
                              <span className="inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#ff5600] text-white mr-1.5 align-middle select-none">
                                {isAI ? 'Fin AI' : 'Agent'}
                              </span>
                            )}
                            {m.content}
                          </span>
                        )}
                        <div className={`absolute bottom-1 right-3 flex items-center gap-1 text-[10px] font-medium ${isSent ? 'text-white/70' : 'text-[#7b7b78]'}`}>
                          <span>{isMounted && m.timestamp ? (() => {
                            const d = new Date(m.timestamp);
                            return isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
                          })() : ""}</span>
                          {isSent && (
                            m.status === 4 ? <CheckCheck className="h-3.5 w-3.5 text-[#ff5600]" /> :
                            m.status === 3 ? <CheckCheck className="h-3.5 w-3.5 text-white/70" /> :
                            <Check className="h-3.5 w-3.5 text-white/70" />
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
                <div className="h-[76px] bg-white border-t border-[#d3cec6] px-6 flex items-center justify-center z-10 flex-shrink-0 shadow-xs">
                  <div className="flex flex-col items-center">
                    <p className="text-[#626260] text-xs font-medium mb-2">WhatsApp is disconnected</p>
                    <button onClick={() => setActiveTab('channels')} className="bg-[#ff5600] hover:bg-[#e04c00] text-white font-medium text-xs px-5 py-2 rounded-lg transition shadow-xs flex items-center gap-2 cursor-pointer">
                      <Zap className="h-4 w-4" /> Reconnect
                    </button>
                  </div>
                </div>
              ) : (
                /* Chat Input Bar - Intercom Styling */
                <div className="h-[76px] bg-white border-t border-[#d3cec6] px-6 flex items-center gap-4 z-10 flex-shrink-0 relative shadow-xs">
                  
                  {showEmojiPicker && (
                    <div className="absolute bottom-[86px] left-6 z-50 shadow-xl rounded-2xl">
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
                      <div className="flex items-center gap-2 text-rose-600 font-medium text-xs">
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
                      }} className="text-[#626260] hover:text-[#111111] text-xs font-medium cursor-pointer">
                        Cancel
                      </button>
                      <button onClick={stopRecording} className="bg-rose-600 text-white rounded-lg p-2 hover:bg-rose-700 transition shadow-xs cursor-pointer">
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 text-[#7b7b78]">
                        <Smile onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={`h-5 w-5 cursor-pointer transition-colors ${showEmojiPicker ? 'text-[#ff5600]' : 'hover:text-[#111111]'}`} />
                        <Paperclip onClick={() => fileInputRef.current?.click()} className="h-5 w-5 cursor-pointer hover:text-[#111111] transition-colors" />
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
                          className="w-full bg-[#f5f1ec] border border-[#d3cec6] rounded-lg px-4 py-2 text-xs font-medium text-[#111111] placeholder:text-[#9c9fa5] focus:outline-none focus:ring-1 focus:ring-[#ff5600] focus:border-[#ff5600] transition-all"
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
          <div className="flex-1 h-full overflow-y-auto bg-[#f5f1ec]">
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
                <div className="flex flex-col items-center justify-center space-y-6 py-10 w-full max-w-sm">
                  <Loader2 className="h-10 w-10 text-purple-600 animate-spin" />
                  <p className="text-slate-500 font-bold text-xs">Initializing Secure Connection...</p>
                  <button 
                    onClick={disconnectSession} 
                    className="text-xs font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 px-4 py-2 rounded-xl transition-colors mt-2"
                  >
                    Reset & Generate New QR Code
                  </button>
                </div>
              )}

              {status === "scanning" && qrCode && waConnectMode === "qr" && (
                <div className="flex flex-col items-center w-full max-w-sm">
                  <div className="bg-white p-4 rounded-3xl shadow-lg border border-slate-100 mb-8 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrCode} alt="QR" className="w-64 h-64 rounded-xl object-contain" />
                    {/* Freshness badge */}
                    <div className={`absolute -top-3 -right-3 text-xs font-bold px-2.5 py-1 rounded-full shadow ${
                      qrSecondsLeft > 30 ? 'bg-emerald-500 text-white' :
                      qrSecondsLeft > 10 ? 'bg-amber-400 text-white' :
                                           'bg-rose-500 text-white'
                    }`}>
                      {qrSecondsLeft > 0 ? `${qrSecondsLeft}s` : 'New QR loading...'}
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

              {/* ERROR / DISCONNECTED STATE */}
              {status === "error" && (
                <div className="flex flex-col items-center justify-center text-center space-y-6 py-6 w-full max-w-sm">
                  <div className="bg-rose-50 p-5 rounded-full border border-rose-100 shadow-inner">
                    <AlertCircle className="h-12 w-12 text-rose-500" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-extrabold text-slate-900">WhatsApp Not Connected</h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      {errorMessage || "Connection dropped or session expired. Please generate a new QR code to link your phone."}
                    </p>
                  </div>

                  <div className="w-full space-y-3 pt-2">
                    <button 
                      onClick={() => {
                        setStatus("idle");
                        setWaConnectMode("qr");
                        startSession();
                      }} 
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold h-12 rounded-xl transition-all shadow-md shadow-purple-500/20 text-xs cursor-pointer"
                    >
                      Generate New QR Code
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setStatus("idle");
                        setWaConnectMode('pairing');
                      }}
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
                  <div className="w-full space-y-3 pt-2">
                    <button
                      onClick={disconnectSession}
                      className="text-sm font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 w-full py-3 rounded-xl transition-colors border border-rose-200"
                    >
                      Disconnect Device
                    </button>
                    <button
                      onClick={disconnectAndDeleteChats}
                      className="text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 w-full py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md shadow-rose-500/30"
                    >
                      <Trash2 className="h-4 w-4" />
                      Disconnect + Delete All Chats
                    </button>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Use &quot;Disconnect + Delete All Chats&quot; when switching to a new WhatsApp number — clears all previous chat history, contacts, and orders.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

        {/* Agents Tab - Tabbed Intercom Editorial Style */}
        {activeTab === 'agents' && (
                <div className="flex-1 h-full overflow-y-auto bg-[#f5f1ec]">
                  <div className="p-8 md:p-10 max-w-[1400px] mx-auto w-full space-y-6">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <h2 className="text-2xl font-semibold text-[#111111] flex items-center gap-3 tracking-tight">
                          <Bot className="h-6 w-6 text-[#ff5600]" /> Bot Configuration & Knowledge Base
                        </h2>
                        <p className="text-xs text-[#626260] font-normal mt-1">
                          Manage AI system prompt, food catalog, store FAQs, instant keyword replies, and autopilot settings.
                        </p>
                      </div>
                    </div>

                    {/* Sub-Tab Navigation Bar */}
                    <div className="flex items-center gap-2 p-1.5 bg-white border border-[#d3cec6] rounded-xl shadow-xs overflow-x-auto">
                      <button
                        type="button"
                        onClick={() => setKbSubTab("prompt")}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                          kbSubTab === "prompt"
                            ? "bg-[#111111] text-white shadow-xs"
                            : "text-[#626260] hover:text-[#111111] hover:bg-[#f5f1ec]"
                        }`}
                      >
                        <Sparkles className="w-4 h-4 text-[#ff5600]" />
                        <span>AI System Prompt</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setKbSubTab("products")}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                          kbSubTab === "products"
                            ? "bg-[#111111] text-white shadow-xs"
                            : "text-[#626260] hover:text-[#111111] hover:bg-[#f5f1ec]"
                        }`}
                      >
                        <Package className="w-4 h-4 text-[#ff5600]" />
                        <span>Product Catalog ({(config.products || []).length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setKbSubTab("kb")}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                          kbSubTab === "kb"
                            ? "bg-[#111111] text-white shadow-xs"
                            : "text-[#626260] hover:text-[#111111] hover:bg-[#f5f1ec]"
                        }`}
                      >
                        <BookOpen className="w-4 h-4 text-[#ff5600]" />
                        <span>Business Knowledge Base & FAQs</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setKbSubTab("keywords")}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                          kbSubTab === "keywords"
                            ? "bg-[#111111] text-white shadow-xs"
                            : "text-[#626260] hover:text-[#111111] hover:bg-[#f5f1ec]"
                        }`}
                      >
                        <Zap className="w-4 h-4 text-[#ff5600]" />
                        <span>Keyword Replies ({(config.keywordReplies || []).length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setKbSubTab("settings")}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                          kbSubTab === "settings"
                            ? "bg-[#111111] text-white shadow-xs"
                            : "text-[#626260] hover:text-[#111111] hover:bg-[#f5f1ec]"
                        }`}
                      >
                        <Settings className="w-4 h-4 text-[#ff5600]" />
                        <span>AI Autopilot & Settings</span>
                      </button>
                    </div>

                    {/* SUB-TAB 1: AI SYSTEM PROMPT */}
                    {kbSubTab === "prompt" && (
                      <div className="bg-white p-6 rounded-xl border border-[#d3cec6] shadow-xs space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ebe7e1] pb-4">
                          <div>
                            <h3 className="text-base font-semibold text-[#111111] flex items-center gap-2">
                              <Sparkles className="w-5 h-5 text-[#ff5600]" />
                              <span>AI System Prompt & Voice Persona</span>
                            </h3>
                            <p className="text-xs text-[#626260] font-normal mt-0.5">
                              Define the AI assistant&apos;s personality, rules, Roman Urdu voice tone, and order-taking guidelines.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={saveKnowledgeBase}
                            disabled={savingKB}
                            className={`px-5 py-2.5 rounded-lg font-medium text-xs flex items-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95 ${
                              kbSaveSuccess
                                ? "bg-emerald-600 text-white"
                                : "bg-[#111111] hover:bg-black text-white"
                            }`}
                          >
                            {savingKB ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span>Saving...</span>
                              </>
                            ) : kbSaveSuccess ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                <span>Saved!</span>
                              </>
                            ) : (
                              <>
                                <Save className="h-3.5 w-3.5" />
                                <span>Save System Prompt</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Preset Quick Templates */}
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-[#111111] uppercase tracking-wider">Quick Preset Persona Templates</label>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const foodPrompt = `You are the official food ordering assistant for Atomix Gourmet Kitchen & Food Hub.

=== CRITICAL FOOD ORDERING & CUSTOMER RULES ===
1. ADDRESS PERSISTENCE:
   - Check if customer address is saved. IF SAVED: DO NOT ask for address again! Confirm delivery to saved address.
2. MULTIPLE ITEMS ORDERING:
   - Customers can order multiple food items at once. Calculate item totals and grand total bill, then call place_order tool.
3. NO PAYMENT QUESTIONS:
   - Default to "Cash on Delivery" (COD). Never ask payment options unless requested.
4. ROMAN URDU PERSONA:
   - Speak in natural, friendly Roman Urdu for all order taking and food inquiries!`;
                                setConfig({ ...config, systemPrompt: foodPrompt });
                              }}
                              className="px-3 py-1.5 bg-[#f5f1ec] hover:bg-[#ebe7e1] text-[#111111] border border-[#d3cec6] rounded-lg text-xs font-medium transition cursor-pointer"
                            >
                              🍔 Food & Gourmet Restaurant
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const ecommercePrompt = `You are the sales consultant for our online store. Answer customer questions politely, quote catalog prices, and help customers place orders. Default to Cash on Delivery.`;
                                setConfig({ ...config, systemPrompt: ecommercePrompt });
                              }}
                              className="px-3 py-1.5 bg-[#f5f1ec] hover:bg-[#ebe7e1] text-[#111111] border border-[#d3cec6] rounded-lg text-xs font-medium transition cursor-pointer"
                            >
                              🛍️ E-Commerce Store
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const techPrompt = `You are the senior sales consultant for a top digital software agency. Be professional, direct, polite, and assist clients with custom quotes.`;
                                setConfig({ ...config, systemPrompt: techPrompt });
                              }}
                              className="px-3 py-1.5 bg-[#f5f1ec] hover:bg-[#ebe7e1] text-[#111111] border border-[#d3cec6] rounded-lg text-xs font-medium transition cursor-pointer"
                            >
                              💻 Software & Tech Agency
                            </button>
                          </div>
                        </div>

                        {/* System Prompt Textarea */}
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-[#111111] uppercase tracking-wider">System Prompt Instructions</label>
                          <textarea
                            rows={10}
                            value={config.systemPrompt || ""}
                            onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                            className="w-full p-4 text-xs bg-[#f5f1ec] border border-[#d3cec6] rounded-lg focus:ring-2 focus:ring-[#111111]/20 focus:border-[#111111] outline-none transition font-medium text-[#111111] leading-relaxed placeholder:text-[#9c9fa5]"
                            placeholder="Write system prompt instructions for your AI bot..."
                          />
                        </div>

                        {/* Bot Mode & Store Details */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-[#ebe7e1]">
                          <div>
                            <label className="text-xs font-semibold text-[#111111] uppercase tracking-wider block mb-1">Bot Purpose / Mode</label>
                            <select
                              value={config.botMode || "both"}
                              onChange={(e) => setConfig({ ...config, botMode: e.target.value })}
                              className="w-full p-2.5 text-xs bg-[#f5f1ec] border border-[#d3cec6] rounded-lg font-medium text-[#111111] outline-none"
                            >
                              <option value="orders">Orders & E-Commerce Only</option>
                              <option value="appointments">Appointments & Calls Only</option>
                              <option value="both">Both (Orders & Appointments)</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-[#111111] uppercase tracking-wider block mb-1">Business Name</label>
                            <input
                              type="text"
                              value={config.businessName || ""}
                              onChange={(e) => setConfig({ ...config, businessName: e.target.value })}
                              placeholder="Atomix Food Hub"
                              className="w-full p-2.5 text-xs bg-[#f5f1ec] border border-[#d3cec6] rounded-lg font-medium text-[#111111] outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-[#111111] uppercase tracking-wider block mb-1">Store Currency</label>
                            <input
                              type="text"
                              value={config.storeCurrency || "PKR"}
                              onChange={(e) => setConfig({ ...config, storeCurrency: e.target.value })}
                              placeholder="PKR"
                              className="w-full p-2.5 text-xs bg-[#f5f1ec] border border-[#d3cec6] rounded-lg font-medium text-[#111111] outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SUB-TAB 2: PRODUCT CATALOG */}
                    {kbSubTab === "products" && (
                      <div className="bg-white p-6 rounded-xl border border-[#d3cec6] shadow-xs space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ebe7e1] pb-5">
                          <div>
                            <h3 className="text-base font-semibold text-[#111111] flex items-center gap-2">
                              <Package className="w-5 h-5 text-[#ff5600]" />
                              <span>Product Catalog & Knowledge Base</span>
                              <span className="bg-[#f5f1ec] text-[#111111] border border-[#d3cec6] px-2.5 py-0.5 rounded-full text-xs font-medium">
                                {(config.products || []).length} Products
                              </span>
                            </h3>
                            <p className="text-xs text-[#626260] font-normal mt-1">
                              Auto-scrape store catalog or manually add/edit products, pricing, links, and pictures.
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            {(config.products || []).length > 0 && (
                              <button
                                type="button"
                                onClick={handleClearCatalog}
                                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                                title="Clear all products from catalog"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                <span>Clear Catalog</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setShowRawCatalogText(!showRawCatalogText)}
                              className="px-3.5 py-2 bg-[#f5f1ec] hover:bg-[#ebe7e1] text-[#111111] border border-[#d3cec6] rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                            >
                              {showRawCatalogText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              <span>{showRawCatalogText ? "Hide Raw Text" : "View Raw Text"}</span>
                            </button>
                            <button
                              type="button"
                              onClick={openAddProductModal}
                              className="px-4 py-2 bg-[#111111] hover:bg-black text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                            >
                              <Plus className="w-4 h-4" />
                              <span>+ Add Product</span>
                            </button>
                          </div>
                        </div>

                        {/* Store URL Auto-Scraper */}
                        <div className="bg-[#f5f1ec] p-4 rounded-xl border border-[#d3cec6] space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-semibold text-[#111111]">
                              <Globe className="w-4 h-4 text-[#ff5600]" />
                              <span>Auto-Fetch & Synchronize Store URL</span>
                            </div>
                            <span className="text-[10px] text-[#626260] font-mono">Shopify, WooCommerce & Generic Sites</span>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <input
                              type="url"
                              value={scrapeUrl}
                              onChange={(e) => setScrapeUrl(e.target.value)}
                              placeholder="https://yourstore.com"
                              className="flex-1 min-w-[200px] p-2.5 text-xs bg-white border border-[#d3cec6] rounded-lg font-medium text-[#111111] outline-none"
                            />
                            <input
                              type="text"
                              value={scrapeCurrency}
                              onChange={(e) => setScrapeCurrency(e.target.value)}
                              placeholder="Rs."
                              className="w-20 p-2.5 text-xs bg-white border border-[#d3cec6] rounded-lg font-medium text-[#111111] outline-none text-center"
                            />
                            <button
                              type="button"
                              onClick={handleScrape}
                              disabled={isScraping || !scrapeUrl}
                              className="px-5 py-2.5 bg-[#ff5600] hover:bg-[#e04c00] disabled:bg-[#d3cec6] text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition cursor-pointer shadow-xs"
                            >
                              {isScraping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                              <span>{isScraping ? "Fetching..." : "Auto-Populate Catalog"}</span>
                            </button>
                          </div>
                        </div>

                        {/* Filter & Search Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                          <div className="relative flex-1 min-w-[200px]">
                            <Search className="w-4 h-4 text-[#7b7b78] absolute left-3 top-3" />
                            <input
                              type="text"
                              value={productSearch}
                              onChange={(e) => setProductSearch(e.target.value)}
                              placeholder="Search products..."
                              className="w-full pl-9 pr-4 py-2.5 text-xs bg-[#f5f1ec] border border-[#d3cec6] rounded-lg font-medium text-[#111111] outline-none"
                            />
                          </div>

                          {/* Category Filter Pills */}
                          {(() => {
                            const allCategories = Array.from(
                              new Set(
                                (config.products || [])
                                  .map((p: any) => p.category)
                                  .filter((c: any) => c && typeof c === "string" && c.trim() !== "")
                              )
                            );
                            if (allCategories.length === 0) return null;

                            return (
                              <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto max-w-full">
                                <button
                                  type="button"
                                  onClick={() => setSelectedCategory("all")}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                                    selectedCategory === "all"
                                      ? "bg-[#ff5600] text-white"
                                      : "bg-[#f5f1ec] text-[#626260] border border-[#d3cec6] hover:bg-[#ebe7e1]"
                                  }`}
                                >
                                  All
                                </button>
                                {allCategories.map((cat: any) => (
                                  <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                                      selectedCategory === cat
                                        ? "bg-[#ff5600] text-white"
                                        : "bg-[#f5f1ec] text-[#626260] border border-[#d3cec6] hover:bg-[#ebe7e1]"
                                    }`}
                                  >
                                    {cat}
                                  </button>
                                ))}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Product Grid */}
                        {(() => {
                          let displayProducts = config.products || [];
                          if (selectedCategory !== "all") {
                            displayProducts = displayProducts.filter((p: any) => p.category === selectedCategory);
                          }
                          if (productSearch.trim()) {
                            const q = productSearch.toLowerCase().trim();
                            displayProducts = displayProducts.filter(
                              (p: any) =>
                                (p.title || "").toLowerCase().includes(q) ||
                                (p.category || "").toLowerCase().includes(q) ||
                                (p.description || "").toLowerCase().includes(q)
                            );
                          }

                          if (displayProducts.length === 0) {
                            return (
                              <div className="text-center py-12 bg-[#f5f1ec] rounded-xl border border-dashed border-[#d3cec6]">
                                <Package className="w-10 h-10 text-[#7b7b78] mx-auto mb-2 opacity-50" />
                                <h4 className="text-sm font-semibold text-[#111111]">No products found</h4>
                                <p className="text-xs text-[#626260] mt-1">Try tweaking your search or add a new product using the button above.</p>
                              </div>
                            );
                          }

                          return (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                              {displayProducts.map((p: any, idx: number) => {
                                const hasImg = p.image && p.image !== "N/A";
                                return (
                                  <div key={p.id || idx} className="bg-white border border-[#d3cec6] rounded-xl overflow-hidden shadow-xs hover:border-[#111111] transition-all flex flex-col justify-between">
                                    <div>
                                      <div className="h-40 bg-[#f5f1ec] relative overflow-hidden flex items-center justify-center">
                                        {hasImg ? (
                                          <img src={p.image} alt={p.title} className="w-full h-full object-cover" />
                                        ) : (
                                          <Package className="w-12 h-12 text-[#ff5600] opacity-40" />
                                        )}
                                        {p.category && (
                                          <span className="absolute top-2 left-2 bg-[#111111]/80 backdrop-blur-xs text-white text-[9px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider">
                                            {p.category}
                                          </span>
                                        )}
                                        {p.price && (
                                          <span className="absolute top-2 right-2 bg-[#ff5600] text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow-xs">
                                            {p.price}
                                          </span>
                                        )}
                                      </div>

                                      <div className="p-4 space-y-2">
                                        <h4 className="text-xs font-semibold text-[#111111] line-clamp-1">{p.title}</h4>
                                        {p.description && (
                                          <p className="text-[11px] text-[#626260] line-clamp-2 leading-relaxed">{p.description}</p>
                                        )}
                                        {Array.isArray(p.variations) && p.variations.length > 0 && (
                                          <div className="flex flex-wrap gap-1 pt-1">
                                            {p.variations.map((v: any, vIdx: number) => (
                                              <span key={vIdx} className="text-[9px] bg-[#f5f1ec] text-[#626260] border border-[#d3cec6] px-1.5 py-0.5 rounded">
                                                {v.title}: {v.price}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    <div className="p-3 bg-[#f5f1ec] border-t border-[#ebe7e1] flex items-center justify-between gap-2">
                                      <button
                                        type="button"
                                        onClick={() => openEditProductModal(p)}
                                        className="py-1 px-2.5 bg-white hover:bg-[#ebe7e1] text-[#111111] border border-[#d3cec6] rounded text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                                      >
                                        <Edit3 className="w-3 h-3 text-[#ff5600]" />
                                        <span>Edit</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteProduct(p.id)}
                                        className="py-1 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                                      >
                                        <Trash2 className="w-3 h-3 text-rose-600" />
                                        <span>Delete</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* SUB-TAB 3: BUSINESS KNOWLEDGE BASE & FAQS */}
                    {kbSubTab === "kb" && (
                      <div className="bg-white p-6 rounded-xl border border-[#d3cec6] shadow-xs space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ebe7e1] pb-4">
                          <div>
                            <h3 className="text-base font-semibold text-[#111111] flex items-center gap-2">
                              <BookOpen className="w-5 h-5 text-[#ff5600]" />
                              <span>Business Knowledge Base & FAQs</span>
                            </h3>
                            <p className="text-xs text-[#626260] font-normal mt-0.5">
                              Store rules, delivery charges, return policies, payment options, and FAQs. Indexed by the Hybrid Engine to answer customers with 0 API tokens.
                            </p>
                          </div>
                          <button 
                            type="button"
                            onClick={saveKnowledgeBase}
                            disabled={savingKB}
                            className={`px-5 py-2.5 rounded-lg font-medium text-xs flex items-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95 ${
                              kbSaveSuccess
                                ? "bg-emerald-600 text-white"
                                : "bg-[#111111] hover:bg-black text-white"
                            }`}
                          >
                            {savingKB ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span>Saving...</span>
                              </>
                            ) : kbSaveSuccess ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                <span>Saved!</span>
                              </>
                            ) : (
                              <>
                                <Save className="h-3.5 w-3.5" />
                                <span>Save Knowledge Base</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <label className="text-xs font-semibold text-[#111111] uppercase tracking-wider">Store Information & Common Q&As</label>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[11px] font-medium text-[#7b7b78] mr-1">Quick Templates:</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const snippet = "\n\n[DELIVERY & SHIPPING]\n- Standard Delivery: PKR 150 (Free shipping on orders above PKR 1,000)\n- Guaranteed delivery within 35 to 45 minutes.";
                                  setConfig({ ...config, productInfo: (config.productInfo || "") + snippet });
                                }}
                                className="px-2.5 py-1 bg-[#f5f1ec] hover:bg-[#ebe7e1] text-[#111111] border border-[#d3cec6] rounded-full text-[11px] font-medium transition cursor-pointer"
                              >
                                + Delivery Info
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const snippet = "\n\n[RETURN & REFUND POLICY]\n- Fresh food items can be replaced immediately if missing or damaged.";
                                  setConfig({ ...config, productInfo: (config.productInfo || "") + snippet });
                                }}
                                className="px-2.5 py-1 bg-[#f5f1ec] hover:bg-[#ebe7e1] text-[#111111] border border-[#d3cec6] rounded-full text-[11px] font-medium transition cursor-pointer"
                              >
                                + Return Policy
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const snippet = "\n\n[PAYMENT METHODS]\n- Cash on Delivery (COD)\n- Bank Transfer (Meezan Bank & HBL)\n- JazzCash / EasyPaisa";
                                  setConfig({ ...config, productInfo: (config.productInfo || "") + snippet });
                                }}
                                className="px-2.5 py-1 bg-[#f5f1ec] hover:bg-[#ebe7e1] text-[#111111] border border-[#d3cec6] rounded-full text-[11px] font-medium transition cursor-pointer"
                              >
                                + Payment Methods
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const snippet = "\n\n[BUSINESS HOURS & LOCATION]\n- Operating Hours: 12:00 PM to 2:00 AM (Midnight) Every Day\n- Address: Gulberg III, Lahore, Pakistan";
                                  setConfig({ ...config, productInfo: (config.productInfo || "") + snippet });
                                }}
                                className="px-2.5 py-1 bg-[#f5f1ec] hover:bg-[#ebe7e1] text-[#111111] border border-[#d3cec6] rounded-full text-[11px] font-medium transition cursor-pointer"
                              >
                                + Hours & Location
                              </button>
                            </div>
                          </div>
                          <textarea 
                            id="productInfoInput"
                            rows={12}
                            value={config.productInfo || ""}
                            onChange={(e) => setConfig({ ...config, productInfo: e.target.value })}
                            className="w-full p-4 text-xs bg-[#f5f1ec] border border-[#d3cec6] rounded-lg focus:ring-2 focus:ring-[#111111]/20 focus:border-[#111111] outline-none transition font-medium text-[#111111] leading-relaxed placeholder:text-[#9c9fa5]"
                            placeholder="Write your business FAQs, store policies, delivery details, exchange rules, and general information here..."
                          />
                        </div>
                      </div>
                    )}

                    {/* SUB-TAB 4: KEYWORD AUTO-REPLIES */}
                    {kbSubTab === "keywords" && (
                      <div className="bg-white p-6 rounded-xl border border-[#d3cec6] shadow-xs space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ebe7e1] pb-4">
                          <div>
                            <h3 className="text-base font-semibold text-[#111111] flex items-center gap-2">
                              <Zap className="w-5 h-5 text-[#ff5600]" />
                              <span>Keyword Auto-Replies & Instant Triggers</span>
                            </h3>
                            <p className="text-xs text-[#626260] font-normal mt-0.5">
                              Bypass AI to instantly reply to specific exact keywords with 0 API token cost.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              type="button"
                              onClick={() => setConfig({
                                ...config, 
                                keywordReplies: [...(config.keywordReplies || []), { keyword: "", reply: "" }]
                              })}
                              className="px-4 py-2 bg-[#ff5600] hover:bg-[#e04c00] text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer flex items-center gap-1.5"
                            >
                              <Plus className="h-4 w-4" /> Add Keyword Rule
                            </button>
                            <button 
                              type="button"
                              onClick={saveKeywordRules}
                              disabled={savingKeywords}
                              className={`px-5 py-2 rounded-lg font-medium text-xs flex items-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95 ${
                                keywordsSaveSuccess
                                  ? "bg-emerald-600 text-white"
                                  : "bg-[#111111] hover:bg-black text-white"
                              }`}
                            >
                              {savingKeywords ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  <span>Saving...</span>
                                </>
                              ) : keywordsSaveSuccess ? (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                  <span>Saved!</span>
                                </>
                              ) : (
                                <>
                                  <Save className="h-3.5 w-3.5" />
                                  <span>Save Rules</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          {(!config.keywordReplies || config.keywordReplies.length === 0) ? (
                            <div className="text-center p-8 bg-[#f5f1ec] rounded-xl border border-dashed border-[#d3cec6] text-[#7b7b78] text-xs font-medium">
                              No keyword rules added yet. Click &quot;Add Keyword Rule&quot; to set up instant replies.
                            </div>
                          ) : (
                            config.keywordReplies.map((kr: any, idx: number) => (
                              <div key={idx} className="flex flex-wrap sm:flex-nowrap gap-3 items-start bg-[#f5f1ec] p-3.5 rounded-xl border border-[#d3cec6]">
                                <div className="w-full sm:w-1/3">
                                  <input 
                                    type="text" 
                                    value={kr.keyword}
                                    onChange={(e) => {
                                      const newReplies = [...(config.keywordReplies || [])];
                                      newReplies[idx].keyword = e.target.value;
                                      setConfig({ ...config, keywordReplies: newReplies });
                                    }}
                                    placeholder="Keyword (e.g. menu, timing)"
                                    className="w-full p-2.5 text-xs bg-white border border-[#d3cec6] rounded-lg font-semibold text-[#111111] outline-none"
                                  />
                                </div>
                                <div className="w-full sm:flex-1 flex items-center gap-2">
                                  <input 
                                    type="text" 
                                    value={kr.reply}
                                    onChange={(e) => {
                                      const newReplies = [...(config.keywordReplies || [])];
                                      newReplies[idx].reply = e.target.value;
                                      setConfig({ ...config, keywordReplies: newReplies });
                                    }}
                                    placeholder="Exact match auto-reply message..."
                                    className="w-full p-2.5 text-xs bg-white border border-[#d3cec6] rounded-lg font-medium text-[#111111] outline-none"
                                  />
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      const newReplies = [...(config.keywordReplies || [])];
                                      newReplies.splice(idx, 1);
                                      setConfig({ ...config, keywordReplies: newReplies });
                                    }}
                                    className="bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 p-2.5 rounded-lg transition cursor-pointer shrink-0"
                                    title="Delete rule"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* SUB-TAB 5: AI AUTOPILOT & SETTINGS */}
                    {kbSubTab === "settings" && (
                      <div className="bg-white p-6 rounded-xl border border-[#d3cec6] shadow-xs space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ebe7e1] pb-4">
                          <div>
                            <h3 className="text-base font-semibold text-[#111111] flex items-center gap-2">
                              <Settings className="w-5 h-5 text-[#ff5600]" />
                              <span>AI Autopilot & Feature Controls</span>
                            </h3>
                            <p className="text-xs text-[#626260] font-normal mt-0.5">
                              Configure global autopilot mode, multi-language support, lead collection, and Deepgram voice integration.
                            </p>
                          </div>
                          <button 
                            type="button"
                            onClick={saveConfig}
                            disabled={savingConfig}
                            className="bg-[#111111] hover:bg-black text-white font-medium py-2.5 px-5 rounded-lg transition-all shadow-xs flex items-center gap-2 text-xs cursor-pointer"
                          >
                            {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Save Settings
                          </button>
                        </div>

                        {/* Autopilot Master Switch */}
                        <div className="flex items-center justify-between p-4 bg-[#f5f1ec] rounded-xl border border-[#d3cec6]">
                          <div>
                            <h4 className="text-xs font-semibold text-[#111111]">Global AI Autopilot Response</h4>
                            <p className="text-[11px] text-[#626260]">When enabled, the AI assistant automatically replies to incoming WhatsApp messages.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setConfig({ ...config, globalAiEnabled: !config.globalAiEnabled })}
                            className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                              config.globalAiEnabled !== false
                                ? "bg-emerald-600 text-white"
                                : "bg-rose-600 text-white"
                            }`}
                          >
                            {config.globalAiEnabled !== false ? "Autopilot ON" : "Autopilot OFF"}
                          </button>
                        </div>

                        {/* Enabled Features Checkboxes */}
                        <div className="space-y-3">
                          <label className="text-xs font-semibold text-[#111111] uppercase tracking-wider block">Advanced AI Capability Features</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {[
                              "Multi-language Support",
                              "Lead Collection",
                              "Service Recommendation",
                              "Personalized Consultation",
                              "Price Inquiry",
                              "Human Handoff"
                            ].map((feature) => {
                              const isChecked = (config.enabledFeatures || []).includes(feature);
                              return (
                                <label
                                  key={feature}
                                  className={`p-3 rounded-lg border text-xs font-medium flex items-center gap-2.5 cursor-pointer transition ${
                                    isChecked
                                      ? "bg-[#f5f1ec] border-[#111111] text-[#111111]"
                                      : "bg-white border-[#d3cec6] text-[#626260] hover:bg-[#f5f1ec]"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      const current = config.enabledFeatures || [];
                                      const updated = e.target.checked
                                        ? [...current, feature]
                                        : current.filter((f: string) => f !== feature);
                                      setConfig({ ...config, enabledFeatures: updated });
                                    }}
                                    className="w-4 h-4 accent-[#ff5600] rounded"
                                  />
                                  <span>{feature}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Product Add / Edit Modal */}
                    {showProductModal && (
                      <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
                        <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 border border-[#d3cec6] my-8">
                          <div className="flex items-center justify-between border-b border-[#ebe7e1] pb-3">
                            <h3 className="text-sm font-semibold text-[#111111] flex items-center gap-2">
                              <Package className="w-4 h-4 text-[#ff5600]" />
                              <span>{editingProduct ? "Edit Product Details" : "Add New Product"}</span>
                            </h3>
                            <button
                              type="button"
                              onClick={() => setShowProductModal(false)}
                              className="text-[#7b7b78] hover:text-[#111111] p-1 transition cursor-pointer"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>

                          <div className="space-y-3 text-xs font-medium">
                            <div>
                              <label className="block text-[#111111] font-semibold mb-1">Product Title *</label>
                              <input
                                type="text"
                                value={prodTitle}
                                onChange={(e) => setProdTitle(e.target.value)}
                                placeholder="e.g. Smokey Zinger Burger Supreme"
                                className="w-full p-2.5 bg-[#f5f1ec] border border-[#d3cec6] rounded-lg outline-none text-[#111111] font-semibold"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[#111111] font-semibold mb-1">Price / Base Rate</label>
                                <input
                                  type="text"
                                  value={prodPrice}
                                  onChange={(e) => setProdPrice(e.target.value)}
                                  placeholder="e.g. 750 or PKR 750"
                                  className="w-full p-2.5 bg-[#f5f1ec] border border-[#d3cec6] rounded-lg outline-none text-[#111111]"
                                />
                              </div>
                              <div>
                                <label className="block text-[#111111] font-semibold mb-1">Category</label>
                                <input
                                  type="text"
                                  value={prodCategory}
                                  onChange={(e) => setProdCategory(e.target.value)}
                                  placeholder="e.g. Burgers & Sandwiches"
                                  className="w-full p-2.5 bg-[#f5f1ec] border border-[#d3cec6] rounded-lg outline-none text-[#111111]"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[#111111] font-semibold mb-1">Product Image (URL)</label>
                              <input
                                type="url"
                                value={prodImage}
                                onChange={(e) => setProdImage(e.target.value)}
                                placeholder="https://images.unsplash.com/..."
                                className="w-full p-2.5 bg-[#f5f1ec] border border-[#d3cec6] rounded-lg outline-none text-[#111111]"
                              />
                              {prodImage && (
                                <div className="mt-2 h-20 w-20 rounded-lg overflow-hidden border border-[#d3cec6]">
                                  <img src={prodImage} alt="Preview" className="w-full h-full object-cover" />
                                </div>
                              )}
                            </div>

                            <div>
                              <label className="block text-[#111111] font-semibold mb-1">Product Page Link (Optional)</label>
                              <input
                                type="url"
                                value={prodLink}
                                onChange={(e) => setProdLink(e.target.value)}
                                placeholder="https://atomixfood.com/menu/zinger"
                                className="w-full p-2.5 bg-[#f5f1ec] border border-[#d3cec6] rounded-lg outline-none text-[#111111]"
                              />
                            </div>

                            <div>
                              <label className="block text-[#111111] font-semibold mb-1">Price Variations (Optional)</label>
                              <input
                                type="text"
                                value={prodVariations}
                                onChange={(e) => setProdVariations(e.target.value)}
                                placeholder="Single Patty: 750, Double Patty: 1050"
                                className="w-full p-2.5 bg-[#f5f1ec] border border-[#d3cec6] rounded-lg outline-none text-[#111111]"
                              />
                              <p className="text-[10px] text-[#7b7b78] mt-1">Separate variations with commas in Title: Price format.</p>
                            </div>

                            <div>
                              <label className="block text-[#111111] font-semibold mb-1">Short Description</label>
                              <textarea
                                rows={2}
                                value={prodDesc}
                                onChange={(e) => setProdDesc(e.target.value)}
                                placeholder="Crispy double-fried chicken breast, smoked cheese slice..."
                                className="w-full p-2.5 bg-[#f5f1ec] border border-[#d3cec6] rounded-lg outline-none text-[#111111]"
                              />
                            </div>
                          </div>

                          <div className="pt-3 border-t border-[#ebe7e1] flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setShowProductModal(false)}
                              className="px-4 py-2 bg-[#f5f1ec] hover:bg-[#ebe7e1] text-[#111111] border border-[#d3cec6] rounded-lg text-xs font-semibold transition cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveProductModal}
                              className="px-5 py-2 bg-[#111111] hover:bg-black text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                            >
                              {editingProduct ? "Save Changes" : "Create Product"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              )}
        {activeTab === 'promotions' && (
          <div className="flex-1 h-full overflow-y-auto bg-[#f5f1ec]">
            <div className="p-8 md:p-10 max-w-[1400px] mx-auto w-full space-y-8">
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-3 tracking-tight">
                    <Clock className="h-7 w-7 text-purple-600" /> Follow Ups
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-1">Configure automated follow-up sequence rules & intervals for un-replied leads.</p>
                </div>
                <button 
                  onClick={saveConfig}
                  disabled={savingConfig}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold py-2.5 px-6 rounded-xl transition-all shadow-md shadow-purple-500/20 flex items-center gap-2 text-xs cursor-pointer"
                >
                  {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Settings
                </button>
              </div>

              <div className="dash-card p-8 space-y-6">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Automated Follow-up Sequence Rules</h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">Sends automated follow-up reminders to un-replied leads every N hours or days. Smart AI automatically skips follow-ups if the customer completes the booking or order.</p>
                </div>
                
                <div className="space-y-4 pt-2">
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
                      return val;
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
        )}

        {/* Leads Revival Tab - DashMark Theme */}
        {activeTab === 'leads-revival' && (
          <div className="flex-1 h-full overflow-y-auto bg-[#f5f1ec]">
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

        {/* Orders Tab - Intercom Editorial High Density View */}
        {activeTab === 'orders' && (
          <div className="flex-1 h-full overflow-y-auto bg-[#f5f1ec]">
            <div className="p-4 md:p-6 w-full space-y-6">
              
              {/* Top Header */}
              <div className="flex justify-between items-center flex-wrap gap-4">
                <h2 className="text-2xl font-semibold text-[#111111] tracking-tight flex items-center gap-3">
                  <ShoppingCart className="h-6 w-6 text-[#ff5600]" /> Incoming Orders & Projects
                </h2>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleSound}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                      soundEnabled 
                        ? 'bg-white text-[#111111] border-[#d3cec6] hover:bg-[#ebe7e1]' 
                        : 'bg-[#ebe7e1] text-[#626260] border-[#d3cec6] hover:bg-slate-200'
                    }`}
                  >
                    {soundEnabled ? <Volume2 className="h-4 w-4 text-[#ff5600]" /> : <VolumeX className="h-4 w-4 text-[#7b7b78]" />}
                    <span>{soundEnabled ? 'Order Sound Alert: ON' : 'Order Sound Alert: OFF'}</span>
                  </button>

                  <button
                    onClick={() => playSweetOrderSound(0.95)}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-[#ff5600] text-white hover:bg-[#e04c00] transition-all shadow-xs cursor-pointer"
                    title="Play sample sweet order alert sound"
                  >
                    <BellRing className="h-4 w-4 text-white animate-pulse" />
                    <span>Test Sweet Sound 🔔</span>
                  </button>
                </div>
              </div>

              {/* Filter Pills */}
              <div className="flex gap-2 mb-2 flex-wrap">
                {[
                  { id: 'all', label: 'All Items', activeClass: 'bg-[#111111] text-white shadow-md' },
                  { id: 'new_order', label: '🔵 New Order', activeClass: 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400/40' },
                  { id: 'under_baking', label: '🟠 Under Baking', activeClass: 'bg-amber-500 text-white shadow-md ring-2 ring-amber-400/40' },
                  { id: 'delivered', label: '🟢 Delivered', activeClass: 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400/40' },
                  { id: 'cancelled', label: '🔴 Cancelled', activeClass: 'bg-rose-600 text-white shadow-md ring-2 ring-rose-400/40' }
                ].map(filter => (
                  <button
                    key={filter.id}
                    onClick={() => setOrderFilter(filter.id as any)}
                    className={`px-4 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer ${
                      orderFilter === filter.id 
                        ? filter.activeClass 
                        : 'bg-[#ebe7e1] text-[#626260] hover:text-[#111111] hover:bg-[#e2ddd5]'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              {/* Full-Width Intercom Data Table */}
              <div className="dash-card p-0 overflow-hidden min-h-[500px] bg-white border border-[#d3cec6] rounded-xl shadow-xs">
                {orders.filter(o => {
                  if (orderFilter === 'all') return true;
                  if (orderFilter === 'new_order') return o.status === 'new_order' || o.status === 'new' || o.status === 'new order' || o.status === 'pending';
                  if (orderFilter === 'under_baking') return o.status === 'under_baking' || o.status === 'under baking' || o.status === 'under_booking' || o.status === 'confirmed';
                  if (orderFilter === 'delivered') return o.status === 'delivered' || o.status === 'deliver';
                  return o.status === orderFilter;
                }).length === 0 ? (
                  <div className="text-center p-12 bg-[#f5f1ec] text-[#7b7b78] font-medium text-xs">
                    No orders found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#f5f1ec] border-b border-[#d3cec6] text-[11px] font-semibold text-[#7b7b78] uppercase tracking-wider">
                          <th className="py-3.5 px-4 w-14 text-center">#</th>
                          <th className="py-3.5 px-4">Date</th>
                          <th className="py-3.5 px-4">Customer / Lead</th>
                          <th className="py-3.5 px-4">Type & Product</th>
                          <th className="py-3.5 px-4">Price</th>
                          <th className="py-3.5 px-4">Delivery / Schedule</th>
                          <th className="py-3.5 px-4">Status</th>
                          <th className="py-3.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ebe7e1] text-xs">
                        {orders.filter(o => {
                          if (orderFilter === 'all') return true;
                          if (orderFilter === 'new_order') return o.status === 'new_order' || o.status === 'new' || o.status === 'new order' || o.status === 'pending';
                          if (orderFilter === 'under_baking') return o.status === 'under_baking' || o.status === 'under baking' || o.status === 'under_booking' || o.status === 'confirmed';
                          if (orderFilter === 'delivered') return o.status === 'delivered' || o.status === 'deliver';
                          return o.status === orderFilter;
                        }).map((order, idx) => {
                          const isAppointment = order.productName.includes('Appointment') || order.productName.startsWith('📅');
                          const clientName = customers[order.phone]?.name || order.customerName || order.phone || "Verified Client";
                          const statusLower = order.status?.toLowerCase() || '';

                          return (
                            <tr key={order.id} className="hover:bg-[#f5f1ec]/60 transition-colors">
                              {/* Row Counter Index */}
                              <td className="py-3.5 px-4 align-top text-center">
                                <span className="font-mono text-xs font-semibold text-[#111111] bg-[#ebe7e1] px-2.5 py-1 rounded border border-[#d3cec6] inline-block">
                                  #{idx + 1}
                                </span>
                              </td>

                              {/* Timestamp */}
                              <td className="py-3.5 px-4 align-top">
                                <div className="text-[11px] text-[#111111] font-medium flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-[#7b7b78]" />
                                  {isMounted ? new Date(order.timestamp).toLocaleString([], { month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit', hour12: true }) : ""}
                                </div>
                              </td>

                              {/* Clickable Customer / Lead Cell (Opens Inbox Chat directly) */}
                              <td className="py-3.5 px-4 align-top">
                                <div 
                                  onClick={() => {
                                    setSelectedChat(order.phone);
                                    setActiveTab("inbox");
                                  }}
                                  className="flex items-center gap-2.5 group cursor-pointer w-fit p-1 -m-1 rounded-lg hover:bg-[#ebe7e1]/80 transition-all"
                                  title="Click to open full chat history in Inbox"
                                >
                                  <div className="w-7 h-7 rounded-full bg-[#111111] text-white flex items-center justify-center font-medium text-xs shrink-0 group-hover:bg-[#ff5600] transition-colors">
                                    <User className="w-4 h-4 text-white" />
                                  </div>
                                  <div>
                                    <div className="font-semibold text-[#111111] group-hover:text-[#ff5600] transition-colors flex items-center gap-1.5">
                                      {clientName}
                                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
                                    </div>
                                    <div className="text-[11px] text-[#626260] font-mono">{order.phone}</div>
                                    {(order.deliveryAddress || customers[order.phone]?.address) && (
                                      <div className="text-[10px] text-[#7b7b78] flex items-center gap-1 mt-0.5 max-w-[200px] truncate" title={order.deliveryAddress || customers[order.phone]?.address}>
                                        <MapPin className="w-3 h-3 text-[#ff5600] shrink-0" />
                                        <span className="truncate">{order.deliveryAddress || customers[order.phone]?.address}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Product & Type */}
                              <td className="py-3.5 px-4 align-top">
                                <div className="font-semibold text-[#111111] max-w-[220px] truncate">{order.productName}</div>
                                <span className={`text-[9px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider inline-flex items-center gap-1 mt-1 ${
                                  isAppointment 
                                    ? 'bg-[#ebe7e1] text-[#111111] border border-[#d3cec6]' 
                                    : 'bg-[#f5f1ec] text-[#111111] border border-[#d3cec6]'
                                }`}>
                                  {isAppointment ? <Calendar className="w-2.5 h-2.5 text-[#ff5600]" /> : <ShoppingCart className="w-2.5 h-2.5 text-[#ff5600]" />}
                                  {isAppointment ? 'Appointment' : 'Product Order'}
                                </span>
                              </td>

                              {/* Price */}
                              <td className="py-3.5 px-4 align-top">
                                <span className="font-semibold text-[#ff5600]">
                                  {order.price || (isAppointment ? 'Booking' : 'N/A')}
                                </span>
                                {order.paymentMethod && (
                                  <span className="block text-[10px] text-[#7b7b78] font-normal uppercase mt-0.5">
                                    {order.paymentMethod}
                                  </span>
                                )}
                              </td>

                              {/* Delivery / Schedule */}
                              <td className="py-3.5 px-4 align-top max-w-[180px]">
                                <div className="text-xs text-[#111111] font-medium truncate" title={order.deliveryAddress || 'Pending Details'}>
                                  {order.deliveryAddress || 'Pending Details'}
                                </div>
                                {!isAppointment && (order.size || order.color) && (
                                  <div className="text-[10px] text-[#7b7b78] font-normal mt-0.5">
                                    {order.size ? `Size: ${order.size}` : ''} {order.color ? `Color: ${order.color}` : ''}
                                  </div>
                                )}
                              </td>

                              {/* Interactive High-Contrast Status Dropdown Select */}
                              <td className="py-3.5 px-4 align-top">
                                <select
                                  value={order.status === 'pending' ? 'new_order' : order.status === 'confirmed' ? 'under_baking' : order.status}
                                  onChange={async (e) => {
                                    const newStatus = e.target.value;
                                    stopOrderAlarm();
                                    await fetch('/api/whatsapp/orders', {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ id: order.id, status: newStatus })
                                    });
                                    fetchOrders();
                                  }}
                                  className={`text-xs font-black px-3 py-1.5 rounded-xl border-2 outline-none cursor-pointer transition-all shadow-sm ${
                                    statusLower === 'new_order' || statusLower === 'new' || statusLower === 'new order' || statusLower === 'pending' ? 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-400/30 animate-pulse' :
                                    statusLower === 'under_baking' || statusLower === 'under baking' || statusLower === 'under_booking' || statusLower === 'confirmed' ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-400/30' :
                                    statusLower === 'delivered' || statusLower === 'deliver' ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-400/30' :
                                    statusLower === 'cancelled' ? 'bg-rose-600 text-white border-rose-700 ring-2 ring-rose-400/30' :
                                    'bg-slate-700 text-white border-slate-800'
                                  }`}
                                >
                                  <option value="new_order" className="bg-blue-600 text-white font-extrabold py-1">🔵 New Order</option>
                                  <option value="under_baking" className="bg-amber-600 text-white font-extrabold py-1">🟠 Under Baking</option>
                                  <option value="delivered" className="bg-emerald-600 text-white font-extrabold py-1">🟢 Delivered</option>
                                  <option value="cancelled" className="bg-rose-600 text-white font-extrabold py-1">🔴 Cancelled</option>
                                </select>
                              </td>

                              {/* Action Buttons (Details Button Opens 70% Side Panel Drawer) */}
                              <td className="py-3.5 px-4 align-top text-right space-x-2">
                                <button
                                  onClick={() => setSelectedOrderDetail(order)}
                                  className="px-3 py-1.5 text-xs font-semibold bg-[#111111] hover:bg-black text-white rounded-lg transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5 active:scale-95"
                                  title="View complete order details & AI notes in side drawer"
                                >
                                  <FileText className="w-3.5 h-3.5 text-[#ff5600]" />
                                  <span>Details</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* 70% Screen Width Side Panel Dialog / Drawer (Upgraded Order Details & Product Catalog UI) */}
            {selectedOrderDetail && (
              <div className="fixed inset-0 z-50 flex justify-end">
                {/* Backdrop */}
                <div 
                  className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
                  onClick={() => setSelectedOrderDetail(null)}
                />

                {/* Slide-over Drawer Panel */}
                <div className="relative w-[85vw] md:w-[70vw] max-w-5xl h-full bg-[#f8f6f2] shadow-2xl border-l border-[#d3cec6] z-50 flex flex-col overflow-y-auto animate-in slide-in-from-right duration-200">
                  
                  {/* Drawer Top Header */}
                  <div className="p-5 bg-white border-b border-[#d3cec6] flex items-center justify-between sticky top-0 z-20 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="bg-[#ff5600] text-white p-2.5 rounded-xl shadow-xs">
                        <ShoppingCart className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-[#111111] tracking-tight">Order Details</h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#ebe7e1] text-[#626260] font-mono border border-[#d3cec6]">
                            #{selectedOrderDetail.id}
                          </span>
                        </div>
                        <p className="text-xs text-[#7b7b78] font-medium">
                          Placed {isMounted ? new Date(selectedOrderDetail.timestamp).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Change Status Dropdown in Drawer Header */}
                      <select
                        value={selectedOrderDetail.status === 'pending' ? 'new_order' : selectedOrderDetail.status === 'confirmed' ? 'under_baking' : selectedOrderDetail.status}
                        onChange={async (e) => {
                          const newStatus = e.target.value;
                          stopOrderAlarm();
                          await fetch('/api/whatsapp/orders', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: selectedOrderDetail.id, status: newStatus })
                          });
                          selectedOrderDetail.status = newStatus;
                          fetchOrders();
                        }}
                        className={`text-xs font-black px-3.5 py-2 rounded-xl border-2 outline-none cursor-pointer transition-all shadow-xs ${
                          selectedOrderDetail.status === 'new_order' || selectedOrderDetail.status === 'new' || selectedOrderDetail.status === 'pending' ? 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-400/30 animate-pulse' :
                          selectedOrderDetail.status === 'under_baking' || selectedOrderDetail.status === 'under baking' || selectedOrderDetail.status === 'confirmed' ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-400/30' :
                          selectedOrderDetail.status === 'delivered' || selectedOrderDetail.status === 'deliver' ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-400/30' :
                          selectedOrderDetail.status === 'cancelled' ? 'bg-rose-600 text-white border-rose-700 ring-2 ring-rose-400/30' :
                          'bg-slate-700 text-white border-slate-800'
                        }`}
                      >
                        <option value="new_order" className="bg-blue-600 text-white font-extrabold py-1">🔵 New Order</option>
                        <option value="under_baking" className="bg-amber-600 text-white font-extrabold py-1">🟠 Under Baking</option>
                        <option value="delivered" className="bg-emerald-600 text-white font-extrabold py-1">🟢 Delivered</option>
                        <option value="cancelled" className="bg-rose-600 text-white font-extrabold py-1">🔴 Cancelled</option>
                      </select>

                      <button 
                        onClick={() => setSelectedOrderDetail(null)}
                        className="p-2 text-[#7b7b78] hover:text-[#111111] hover:bg-[#ebe7e1] rounded-xl transition-colors cursor-pointer"
                        title="Close Drawer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Drawer Main Body Container */}
                  <div className="p-6 md:p-8 space-y-6 flex-1">
                    
                    {/* Top Task Info Quick Stats Bar (Image 1 UI Style) */}
                    <div className="bg-white p-5 rounded-2xl border border-[#d3cec6] shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                      
                      {/* Stat 1: Order / Preparing Time */}
                      <div className="flex items-center gap-3 pr-4 border-r-0 md:border-r border-[#ebe7e1]">
                        <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#ff5600] flex items-center justify-center shrink-0 border border-orange-100">
                          <Clock className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-[10px] text-[#7b7b78] uppercase font-bold tracking-wider">Preparing / Order Time</div>
                          <div className="text-sm font-extrabold text-[#111111] font-mono mt-0.5">
                            {isMounted ? new Date(selectedOrderDetail.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just Now"}
                          </div>
                        </div>
                      </div>

                      {/* Stat 2: Delivery Address */}
                      <div className="flex items-center gap-3 pr-4 border-r-0 md:border-r border-[#ebe7e1]">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] text-[#7b7b78] uppercase font-bold tracking-wider">Delivery Destination</div>
                          <div className="text-xs font-semibold text-[#111111] truncate mt-0.5" title={selectedOrderDetail.deliveryAddress || 'Pending Address'}>
                            {selectedOrderDetail.deliveryAddress || 'Pending Address'}
                          </div>
                        </div>
                      </div>

                      {/* Stat 3: Customer & Quick Communication Buttons */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-100">
                            <User className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#111111] truncate">
                              {customers[selectedOrderDetail.phone]?.name || selectedOrderDetail.customerName || "Customer"}
                            </div>
                            <div className="text-[11px] text-[#626260] font-mono">{selectedOrderDetail.phone}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <a 
                            href={`https://wa.me/${selectedOrderDetail.phone.replace(/[^0-9]/g, '')}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="p-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-all shadow-xs flex items-center justify-center cursor-pointer"
                            title="Message on WhatsApp"
                          >
                            <Phone className="w-4 h-4 text-white" />
                          </a>

                          <button
                            onClick={() => {
                              setSelectedChat(selectedOrderDetail.phone);
                              setActiveTab("inbox");
                              setSelectedOrderDetail(null);
                            }}
                            className="p-2.5 bg-[#111111] hover:bg-black text-white rounded-xl transition-all shadow-xs flex items-center justify-center cursor-pointer"
                            title="Open Chat History in Inbox"
                          >
                            <MessageSquare className="w-4 h-4 text-[#ff5600]" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Section Switcher Tabs inside Order Drawer */}
                    {(() => {
                      // Internal drawer sub-tab state helper
                      const matchedCatalogProducts = (config.products || []).filter((p: any) => {
                        const searchLower = (selectedOrderDetail.productName || "").toLowerCase();
                        return p.title && searchLower.includes(p.title.toLowerCase().trim());
                      });

                      return (
                        <div className="space-y-6">
                          
                          {/* Main Order Items & Invoice Breakdown Card (Image 1 UI Layout) */}
                          <div className="bg-white rounded-2xl border border-[#d3cec6] shadow-sm overflow-hidden p-6 md:p-8 space-y-6">
                            
                            <div className="flex items-center justify-between pb-4 border-b border-[#ebe7e1]">
                              <div className="flex items-center gap-2.5">
                                <Package className="w-5 h-5 text-[#ff5600]" />
                                <h4 className="text-sm font-extrabold text-[#111111] uppercase tracking-wider">
                                  Task Info & Itemized Breakdown
                                </h4>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#f5f1ec] text-[#626260] border border-[#d3cec6]">
                                  {matchedCatalogProducts.length > 0 ? `${matchedCatalogProducts.length} Matched from Catalog` : 'Custom WhatsApp Order'}
                                </span>
                              </div>
                            </div>

                            {/* Itemized Order List (Image 1 Layout with Thumbnails, Qty x1/x2, Specs, & Line Price) */}
                            <div className="divide-y divide-[#ebe7e1]">
                              {(() => {
                                // Split multi-item product names if comma/newline separated
                                const rawItems = (selectedOrderDetail.productName || "General Order").split(/,|\n/).map((s: string) => s.trim()).filter(Boolean);
                                
                                return rawItems.map((itemStr: string, idx: number) => {
                                  // Extract quantity if formatted as "2x item" or "item (x2)"
                                  let qty = 1;
                                  let itemName = itemStr;
                                  const qtyMatch = itemStr.match(/^(\d+)\s*x\s*(.+)$/i) || itemStr.match(/^(.+)\s*\(x?(\d+)\)$/i);
                                  if (qtyMatch) {
                                    if (/^\d+$/.test(qtyMatch[1])) {
                                      qty = parseInt(qtyMatch[1]);
                                      itemName = qtyMatch[2].trim();
                                    } else {
                                      itemName = qtyMatch[1].trim();
                                      qty = parseInt(qtyMatch[2]);
                                    }
                                  }

                                  // Match against store product catalog items
                                  const matchedCat = (config.products || []).find((p: any) => 
                                    p.title && (itemName.toLowerCase().includes(p.title.toLowerCase().trim()) || p.title.toLowerCase().trim().includes(itemName.toLowerCase()))
                                  );

                                  const imgUrl = matchedCat?.image || selectedOrderDetail.productImageUrl;
                                  const displayPrice = matchedCat?.price || selectedOrderDetail.price || "COD";

                                  return (
                                    <div key={idx} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4 flex-wrap hover:bg-[#f5f1ec]/40 p-2 rounded-xl transition-all">
                                      
                                      {/* Left: Product Thumbnail & Details */}
                                      <div className="flex items-center gap-4 min-w-[240px] flex-1">
                                        <div className="w-16 h-16 rounded-xl bg-[#f5f1ec] border border-[#d3cec6] overflow-hidden shrink-0 shadow-xs flex items-center justify-center">
                                          {imgUrl ? (
                                            <img src={imgUrl} alt={itemName} className="w-full h-full object-cover" />
                                          ) : (
                                            <Package className="w-8 h-8 text-[#ff5600]/80" />
                                          )}
                                        </div>

                                        <div className="space-y-1 min-w-0">
                                          <h5 className="font-bold text-[#111111] text-sm leading-snug">
                                            {itemName}
                                          </h5>
                                          
                                          {/* Specifications / Notes Pill */}
                                          <div className="flex flex-wrap gap-1.5 items-center">
                                            {selectedOrderDetail.size && (
                                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#ebe7e1] text-[#626260]">
                                                {selectedOrderDetail.size}
                                              </span>
                                            )}
                                            {selectedOrderDetail.color && (
                                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#ebe7e1] text-[#626260]">
                                                Color: {selectedOrderDetail.color}
                                              </span>
                                            )}
                                            {matchedCat?.category && (
                                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                                                {matchedCat.category}
                                              </span>
                                            )}
                                            {selectedOrderDetail.paymentMethod && (
                                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                                {selectedOrderDetail.paymentMethod}
                                              </span>
                                            )}
                                          </div>

                                          {matchedCat?.description && (
                                            <p className="text-[11px] text-[#7b7b78] line-clamp-1 italic">
                                              {matchedCat.description}
                                            </p>
                                          )}
                                        </div>
                                      </div>

                                      {/* Center: Quantity Pill (Image 1 Style "x2") */}
                                      <div className="flex items-center justify-center px-4 py-1.5 bg-[#f5f1ec] border border-[#d3cec6] rounded-xl font-mono text-xs font-black text-[#111111]">
                                        x{qty}
                                      </div>

                                      {/* Right: Line Item Total */}
                                      <div className="text-right font-extrabold text-[#111111] text-sm min-w-[90px]">
                                        {displayPrice}
                                      </div>
                                    </div>
                                  );
                                });
                              })()}
                            </div>

                            {/* Large Total Price & Calculation Summary Card (Image 1 Big Price Style) */}
                            <div className="bg-[#f5f1ec] p-5 rounded-2xl border border-[#d3cec6] space-y-3">
                              <div className="flex justify-between text-xs font-semibold text-[#626260]">
                                <span>Subtotal Order Items</span>
                                <span className="font-bold text-[#111111]">{selectedOrderDetail.price || 'COD'}</span>
                              </div>
                              
                              <div className="flex justify-between text-xs font-semibold text-[#626260]">
                                <span>Delivery / Shipping Charge</span>
                                <span className="font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-md text-[10px] border border-emerald-300">
                                  Free / Included
                                </span>
                              </div>

                              <div className="flex justify-between text-xs font-semibold text-[#626260]">
                                <span>Payment Mode</span>
                                <span className="font-bold text-[#111111]">{selectedOrderDetail.paymentMethod || 'Cash on Delivery (COD)'}</span>
                              </div>

                              <div className="pt-3 border-t border-[#d3cec6] flex justify-between items-center">
                                <div className="space-y-0.5">
                                  <span className="text-xs font-black uppercase tracking-wider text-[#111111] block">
                                    Grand Total Price
                                  </span>
                                  <span className="text-[10px] text-[#7b7b78] font-medium block">Taxes included</span>
                                </div>

                                <div className="text-2xl md:text-3xl font-black text-[#ff5600] tracking-tight font-mono">
                                  {selectedOrderDetail.price || 'COD'}
                                </div>
                              </div>
                            </div>

                            {/* Bottom Primary Action Button (Image 1 Vibrant CTA Style) */}
                            <div className="pt-2">
                              {selectedOrderDetail.status === 'delivered' || selectedOrderDetail.status === 'deliver' ? (
                                <button
                                  disabled
                                  className="w-full py-4 bg-emerald-600 text-white font-extrabold rounded-2xl shadow-md flex items-center justify-center gap-2 cursor-not-allowed opacity-90"
                                >
                                  <Check className="w-5 h-5 text-white" />
                                  <span>Order Delivered & Completed</span>
                                </button>
                              ) : selectedOrderDetail.status === 'under_baking' || selectedOrderDetail.status === 'confirmed' ? (
                                <button
                                  onClick={async () => {
                                    await fetch('/api/whatsapp/orders', {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ id: selectedOrderDetail.id, status: 'delivered' })
                                    });
                                    selectedOrderDetail.status = 'delivered';
                                    fetchOrders();
                                  }}
                                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                                >
                                  <Check className="w-5 h-5 text-white" />
                                  <span>Mark Order as Delivered 🟢</span>
                                </button>
                              ) : (
                                <button
                                  onClick={async () => {
                                    await fetch('/api/whatsapp/orders', {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ id: selectedOrderDetail.id, status: 'under_baking' })
                                    });
                                    selectedOrderDetail.status = 'under_baking';
                                    fetchOrders();
                                  }}
                                  className="w-full py-4 bg-[#ff5600] hover:bg-[#e04c00] text-white font-extrabold text-sm rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                                >
                                  <ShoppingCart className="w-5 h-5 text-white" />
                                  <span>Accept & Start Preparing Order 🟠</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Store Product Catalog Inspector & Quick-Add Section */}
                          <div className="bg-white rounded-2xl border border-[#d3cec6] shadow-sm p-6 space-y-5">
                            <div className="flex items-center justify-between pb-3 border-b border-[#ebe7e1]">
                              <div className="flex items-center gap-2.5">
                                <BookOpen className="w-5 h-5 text-[#ff5600]" />
                                <h4 className="text-xs font-bold text-[#111111] uppercase tracking-wider">
                                  Store Product Catalog ({config.products?.length || 0} Available Items)
                                </h4>
                              </div>
                              <span className="text-[11px] text-[#7b7b78] font-medium">Click any catalog item to append or copy specs</span>
                            </div>

                            {(!config.products || config.products.length === 0) ? (
                              <div className="p-8 text-center bg-[#f5f1ec] rounded-xl border border-dashed border-[#d3cec6] text-xs text-[#7b7b78] space-y-2">
                                <p className="font-semibold">No products found in store catalog.</p>
                                <p className="text-[11px]">Go to <button onClick={() => { setActiveTab('knowledge'); setSelectedOrderDetail(null); }} className="text-[#ff5600] font-bold underline cursor-pointer">Knowledge Base &gt; Products</button> to add your store menu.</p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-1">
                                {config.products.map((prod: any, pIdx: number) => {
                                  const isSelected = (selectedOrderDetail.productName || "").toLowerCase().includes((prod.title || "").toLowerCase());
                                  
                                  return (
                                    <div 
                                      key={prod.id || pIdx} 
                                      className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                                        isSelected 
                                          ? 'bg-orange-50/80 border-[#ff5600] ring-1 ring-[#ff5600]/30 shadow-xs' 
                                          : 'bg-[#f5f1ec] border-[#d3cec6] hover:bg-white hover:border-[#b8b3ab]'
                                      }`}
                                    >
                                      <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <div className="w-12 h-12 rounded-lg bg-white border border-[#d3cec6] overflow-hidden shrink-0 flex items-center justify-center">
                                          {prod.image ? (
                                            <img src={prod.image} alt={prod.title} className="w-full h-full object-cover" />
                                          ) : (
                                            <Package className="w-6 h-6 text-[#ff5600]" />
                                          )}
                                        </div>

                                        <div className="min-w-0">
                                          <div className="text-xs font-bold text-[#111111] truncate">{prod.title}</div>
                                          <div className="text-[11px] font-semibold text-[#ff5600]">{prod.price || 'COD'}</div>
                                          {prod.category && (
                                            <span className="text-[9px] text-[#626260] font-medium block truncate">{prod.category}</span>
                                          )}
                                        </div>
                                      </div>

                                      <button
                                        onClick={async () => {
                                          const newProductName = `${selectedOrderDetail.productName}, ${prod.title}`;
                                          await fetch('/api/whatsapp/orders', {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ id: selectedOrderDetail.id, productName: newProductName })
                                          });
                                          selectedOrderDetail.productName = newProductName;
                                          fetchOrders();
                                        }}
                                        className="px-2.5 py-1.5 bg-[#111111] hover:bg-black text-white text-[10px] font-bold rounded-lg transition-all shrink-0 cursor-pointer active:scale-95 flex items-center gap-1"
                                        title="Append product to this order"
                                      >
                                        <Plus className="w-3 h-3 text-[#ff5600]" /> Add
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* AI Call Summary & Requirements Card */}
                          <div className="bg-white p-6 rounded-2xl border border-[#d3cec6] shadow-sm space-y-4">
                            <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-[#ebe7e1]">
                              <div className="flex items-center gap-2 text-sm font-bold text-[#111111]">
                                <FileText className="w-5 h-5 text-[#ff5600]" />
                                <span>Call Summary & AI Client Requirements</span>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={async () => {
                                    setGeneratingNotesId(selectedOrderDetail.id);
                                    try {
                                      const res = await fetch('/api/whatsapp/orders', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ id: selectedOrderDetail.id, phone: selectedOrderDetail.phone })
                                      });
                                      const data = await res.json();
                                      if (data.notes) {
                                        selectedOrderDetail.notes = data.notes;
                                        fetchOrders();
                                      }
                                    } catch (e) {
                                      console.error(e);
                                    } finally {
                                      setGeneratingNotesId(null);
                                    }
                                  }}
                                  disabled={generatingNotesId === selectedOrderDetail.id}
                                  className="text-xs font-bold text-[#111111] hover:text-black bg-[#f5f1ec] border border-[#d3cec6] hover:border-[#b8b3ab] px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                                >
                                  {generatingNotesId === selectedOrderDetail.id ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ff5600]" /> : <Sparkles className="w-3.5 h-3.5 text-[#ff5600]" />}
                                  <span>{generatingNotesId === selectedOrderDetail.id ? 'Generating AI Notes...' : 'Generate AI Notes'}</span>
                                </button>

                                <button
                                  onClick={() => {
                                    if (editingNotesId === selectedOrderDetail.id) {
                                      setEditingNotesId(null);
                                    } else {
                                      setEditingNotesId(selectedOrderDetail.id);
                                      setNotesInput(selectedOrderDetail.notes || "");
                                    }
                                  }}
                                  className="text-xs font-bold text-[#626260] hover:text-[#111111] bg-[#f5f1ec] border border-[#d3cec6] hover:border-[#b8b3ab] px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-[#7b7b78]" />
                                  <span>{editingNotesId === selectedOrderDetail.id ? 'Cancel' : 'Edit Notes'}</span>
                                </button>
                              </div>
                            </div>

                            {editingNotesId === selectedOrderDetail.id ? (
                              <div className="space-y-3 pt-1">
                                <textarea
                                  value={notesInput}
                                  onChange={(e) => setNotesInput(e.target.value)}
                                  placeholder="Add custom call summary, client requirements, or special instructions..."
                                  className="w-full p-4 text-xs bg-[#f5f1ec] border border-[#d3cec6] rounded-xl focus:ring-2 focus:ring-[#ff5600]/20 outline-none text-[#111111] font-medium min-h-[120px]"
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={async () => {
                                      await fetch('/api/whatsapp/orders', {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ id: selectedOrderDetail.id, notes: notesInput })
                                      });
                                      selectedOrderDetail.notes = notesInput;
                                      setEditingNotesId(null);
                                      fetchOrders();
                                    }}
                                    className="px-4 py-2 bg-[#111111] hover:bg-black text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
                                  >
                                    Save Notes
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-[#111111] font-normal leading-relaxed bg-[#f5f1ec] p-4 rounded-xl border border-[#d3cec6] min-h-[90px]">
                                {selectedOrderDetail.notes ? (
                                  <p className="whitespace-pre-wrap">{selectedOrderDetail.notes}</p>
                                ) : (
                                  <span className="text-[#7b7b78] italic text-xs">No summary notes recorded yet. Click "Generate AI Notes" or "Edit Notes" to record details.</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
        </div>
      )}

      {/* Contacts / Leads Tab - DashMark Theme */}
      {activeTab === 'contacts' && (
        <div className="flex-1 h-full overflow-y-auto bg-[#f5f1ec]">
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
                  const hasOrder = orders.some((o: any) => o.phone === c.phone && (o.status === "confirmed" || o.status === "delivered" || o.status === "completed"));
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
                                  <button 
                                    onClick={() => toggleChatAi(!hasAi, lead.phone)}
                                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition ${hasAi ? 'bg-purple-50 text-purple-700 border border-purple-100' : 'bg-slate-100 text-slate-500'}`}
                                    title="Click to toggle Autopilot / Copilot for this contact"
                                  >
                                    {hasAi ? 'Autopilot' : 'Copilot'}
                                  </button>
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
                          const hasOrder = orders.some((o: any) => o.phone === c.phone && (o.status === "confirmed" || o.status === "delivered" || o.status === "completed"));
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
