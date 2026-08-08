'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Bot, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  CheckCircle2, 
  Lock, 
  PhoneCall, 
  MessageSquare, 
  Clock, 
  Volume2, 
  ChevronDown, 
  Star, 
  Layers, 
  BarChart3, 
  TrendingUp, 
  Users, 
  Play, 
  X, 
  AlertTriangle, 
  Check, 
  RefreshCw, 
  Globe, 
  ShieldAlert, 
  Cpu, 
  Radio, 
  Flame, 
  Headphones, 
  Send
} from 'lucide-react';

export default function LandingPage() {
  // Modal States
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showSignUpModal, setShowSignUpModal] = useState(false);
  
  // Quick Login Form State in Modal
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Interactive Live Bot Simulator State
  const [simActiveTab, setSimActiveTab] = useState<'chat' | 'voice' | 'catalog'>('chat');
  const [simQuery, setSimQuery] = useState('');
  const [simMessages, setSimMessages] = useState([
    { sender: 'user', text: 'Hi! Are you open right now and what is the delivery fee?' },
    { sender: 'bot', text: 'Hey there! 👋 Yes, HazelWhat AI is online 24/7. We offer FREE nationwide delivery on orders over Rs. 3,000, and standard shipping is Rs. 250 across Pakistan.' }
  ]);
  const [isSimTyping, setIsSimTyping] = useState(false);

  // FAQ Accordion Toggle
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Active Session Check for Header Navbar
  const [sessionUser, setSessionUser] = useState<any>(null);

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setSessionUser(data.user);
          }
        }
      } catch (err) {
        console.log('Session check error:', err);
      }
    }
    checkSession();
  }, []);

  const handleSimSend = (presetText?: string) => {
    const textToSend = presetText || simQuery;
    if (!textToSend.trim()) return;

    const newMsgs = [...simMessages, { sender: 'user', text: textToSend }];
    setSimMessages(newMsgs);
    setSimQuery('');
    setIsSimTyping(true);

    setTimeout(() => {
      let replyText = "Our AI system processes customer requests automatically, answers FAQs from your knowledge base, and sends direct product checkout links!";
      const lower = textToSend.toLowerCase();
      
      if (lower.includes('price') || lower.includes('catalog') || lower.includes('suit') || lower.includes('product')) {
        replyText = "Here are our trending items:\n1. Premium Cotton Suit - Rs. 4,500\n2. Embroidered Lawn Kurti - Rs. 2,800\n\nWould you like me to reserve one for you?";
      } else if (lower.includes('hours') || lower.includes('open') || lower.includes('timing')) {
        replyText = "We are open Monday - Saturday from 11:00 AM to 10:00 PM. However, our HazelWhat WhatsApp AI takes orders 24 hours a day!";
      } else if (lower.includes('voice') || lower.includes('audio') || lower.includes('call')) {
        replyText = "🎙️ [Voice Note Sent 0:14s] - 'Assalamu Alaikum! Thank you for contacting us. We have received your inquiry and our AI voice assistant has updated your booking.'";
      }

      setSimMessages(prev => [...prev, { sender: 'bot', text: replyText }]);
      setIsSimTyping(false);
    }, 1000);
  };

  const handleModalLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUser || !loginPass) {
      setLoginError('Please enter username and password');
      return;
    }
    setLoginLoading(true);
    setLoginError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUser, password: loginPass })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        window.location.href = data.redirectTo || '/client';
      } else {
        setLoginError(data.error || 'Authentication failed. Please check credentials.');
      }
    } catch (err: any) {
      setLoginError('Network error. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07080C] text-slate-100 font-sans selection:bg-purple-500/30 selection:text-purple-300 relative overflow-x-hidden">
      
      {/* Background Subtle Gradient Radial Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-purple-900/20 via-indigo-900/10 to-transparent rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[800px] -right-40 w-[600px] h-[600px] bg-purple-900/10 rounded-full blur-[160px] pointer-events-none" />

      {/* Subtle Grid Pattern Overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* ================= STICKY PILL NAVBAR ================= */}
      <header className="sticky top-5 z-40 max-w-6xl mx-auto px-4">
        <nav className="bg-[#0D0F17]/90 backdrop-blur-xl border border-white/10 rounded-full px-6 py-3 flex items-center justify-between shadow-2xl shadow-black/80">
          
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-xs shadow-md group-hover:scale-105 transition-transform">
              <Bot className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg text-white tracking-tight">HazelWhat</span>
              <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[10px] font-bold">
                Enterprise AI
              </span>
            </div>
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-400">
            <a href="#hero" className="hover:text-white transition-colors">Overview</a>
            <a href="#features" className="hover:text-white transition-colors">AI Features</a>
            <a href="#simulator" className="hover:text-white transition-colors">Live Demo</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {sessionUser ? (
              <Link
                href={sessionUser.role === 'admin' ? '/admin' : '/client'}
                className="px-5 py-2.5 rounded-full bg-white text-slate-950 font-extrabold text-xs hover:bg-slate-200 transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Bot className="w-4 h-4 text-slate-950" />
                <span>Open {sessionUser.role === 'admin' ? 'Super Admin' : sessionUser.businessName || 'Client Portal'} →</span>
              </Link>
            ) : (
              <>
                <button
                  onClick={() => setShowSignInModal(true)}
                  className="px-5 py-2 rounded-full bg-white text-slate-950 hover:bg-slate-200 text-xs font-extrabold transition-all shadow-md cursor-pointer"
                >
                  Client Sign In
                </button>
              </>
            )}
          </div>

        </nav>
      </header>

      {/* ================= HERO SECTION ================= */}
      <section id="hero" className="pt-20 pb-16 px-4 max-w-5xl mx-auto text-center relative z-10">
        
        {/* Pill Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-bold mb-6">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>Autonomous WhatsApp & Voice AI Infrastructure</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.12] mb-6">
          Automate Your Entire <br />
          <span className="bg-gradient-to-r from-purple-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
            WhatsApp Sales Pipeline
          </span>
        </h1>

        {/* Hero Subtitle */}
        <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto font-normal leading-relaxed mb-10">
          Turn midnight inquiries into instant bookings. HazelWhat powers 24/7 autonomous customer chats, natural voice responses, interactive product catalogs, and automated lead revivals.
        </p>

        {/* Hero CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
          <button
            onClick={() => setShowSignInModal(true)}
            className="px-8 py-4 rounded-full bg-white text-slate-950 hover:bg-slate-200 font-extrabold text-xs shadow-xl transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <span>Client Sign In to Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <a
            href="#simulator"
            className="px-8 py-4 rounded-full bg-[#0D0F17] hover:bg-[#131624] border border-white/10 text-slate-300 font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer"
          >
            <span>Try Interactive Simulator</span>
            <Play className="w-4 h-4 text-purple-400" />
          </a>
        </div>

        {/* Metric Grid Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mb-20 text-left">
          <div className="bg-[#0D0F17]/90 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
            <div className="text-2xl sm:text-3xl font-black text-white font-mono">&lt; 3 Sec</div>
            <div className="text-xs text-slate-400 font-medium mt-1">Average Response Latency</div>
          </div>
          <div className="bg-[#0D0F17]/90 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
            <div className="text-2xl sm:text-3xl font-black text-purple-400 font-mono">+340%</div>
            <div className="text-xs text-slate-400 font-medium mt-1">Midnight Order Conversion</div>
          </div>
          <div className="bg-[#0D0F17]/90 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
            <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">100%</div>
            <div className="text-xs text-slate-400 font-medium mt-1">Isolated Tenant Security</div>
          </div>
          <div className="bg-[#0D0F17]/90 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
            <div className="text-2xl sm:text-3xl font-black text-indigo-400 font-mono">24/7</div>
            <div className="text-xs text-slate-400 font-medium mt-1">Voice & Chat Availability</div>
          </div>
        </div>

        {/* HERO INTERFACE PREVIEW */}
        <div className="relative max-w-4xl mx-auto">
          <div className="absolute -inset-1 rounded-3xl bg-purple-600/20 blur-2xl opacity-50" />
          
          <div className="relative bg-[#0B0D14] border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden text-left space-y-6">
            
            {/* Header bar of mockup */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex space-x-1.5">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                </div>
                <span className="text-xs font-mono text-slate-400">hazelwhat.ai // live-engine-instance</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>AI Core Active</span>
              </div>
            </div>

            {/* Dashboard Mockup Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="bg-[#121522] border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Autonomous Engine</div>
                <div className="text-4xl font-black text-white font-mono">99.8%</div>
                <p className="text-xs text-slate-400">Automated query resolution rate across 45,000+ customer chats.</p>
              </div>

              <div className="bg-[#121522] border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Voice Note Agent</div>
                <div className="text-xs text-emerald-400 font-mono bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 flex items-center gap-2">
                  <Volume2 className="w-4 h-4 shrink-0" />
                  <span>Voice Note Generated (0:14s)</span>
                </div>
                <p className="text-xs text-slate-400">Generates natural audio replies in Urdu & English regional accents.</p>
              </div>

              <div className="bg-[#121522] border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lead Revival System</div>
                <div className="text-4xl font-black text-purple-400 font-mono">+42%</div>
                <p className="text-xs text-slate-400">Abandoned cart and stale inquiry recovery rate via timed follow-ups.</p>
              </div>

            </div>

          </div>
        </div>

      </section>

      {/* ================= FEATURE GRID ================= */}
      <section id="features" className="py-20 px-4 max-w-5xl mx-auto text-center">
        
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-4">
          Built for Enterprise Growth
        </h2>
        <p className="text-slate-400 text-xs sm:text-sm max-w-xl mx-auto mb-16">
          Everything your sales team needs to capture leads and close orders 24/7 without manual intervention.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          
          <div className="bg-[#0D0F17] p-8 rounded-3xl border border-white/10 space-y-4 hover:border-purple-500/40 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
              <Bot className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">24/7 Autonomous Sales</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-normal">
              Instant responses to pricing, stock availability, and FAQs. The AI guides customers from initial inquiry to final order confirmation.
            </p>
          </div>

          <div className="bg-[#0D0F17] p-8 rounded-3xl border border-white/10 space-y-4 hover:border-purple-500/40 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <Volume2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Voice Note Intelligence</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-normal">
              Convert text responses into natural, human-sounding voice notes in WhatsApp. Handles customer audio messages effortlessly.
            </p>
          </div>

          <div className="bg-[#0D0F17] p-8 rounded-3xl border border-white/10 space-y-4 hover:border-purple-500/40 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Interactive Product Catalogs</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-normal">
              Scrapes your store website automatically and sends rich product cards with pricing, photos, and direct checkout buttons.
            </p>
          </div>

          <div className="bg-[#0D0F17] p-8 rounded-3xl border border-white/10 space-y-4 hover:border-purple-500/40 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
              <RefreshCw className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Automated Lead Revival</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-normal">
              Automatically follows up with cold prospects and abandoned carts after 24–48 hours to recover lost revenue.
            </p>
          </div>

        </div>

      </section>

      {/* ================= INTERACTIVE DEMO SIMULATOR ================= */}
      <section id="simulator" className="py-20 px-4 max-w-5xl mx-auto text-center">
        
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-bold mb-4">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>Test Drive Live Bot Experience</span>
        </div>

        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
          Try the Interactive AI Simulator
        </h2>
        <p className="text-slate-400 text-xs sm:text-sm max-w-lg mx-auto mb-8">
          Type any inquiry below to test how HazelWhat AI handles customer chats, product catalogs, and voice responses in real time.
        </p>

        {/* Simulator Container */}
        <div className="bg-[#0D0F17] rounded-3xl border border-white/15 shadow-2xl overflow-hidden text-left max-w-3xl mx-auto">
          
          {/* Header Bar */}
          <div className="bg-[#07080C] border-b border-white/10 p-4 px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center font-bold text-xs text-white">
                AI
              </div>
              <div>
                <div className="text-xs font-bold text-white">HazelWhat Autonomous Assistant</div>
                <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Online 24/7
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={() => setSimActiveTab('chat')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${simActiveTab === 'chat' ? 'bg-purple-600 text-white' : 'bg-white/5 text-slate-400'}`}
              >
                Chat Mode
              </button>
              <button 
                onClick={() => setSimActiveTab('voice')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${simActiveTab === 'voice' ? 'bg-purple-600 text-white' : 'bg-white/5 text-slate-400'}`}
              >
                Voice Note
              </button>
            </div>
          </div>

          {/* Chat Body */}
          <div className="p-6 h-[320px] overflow-y-auto space-y-4 bg-[#0B0D14]">
            {simMessages.map((msg, i) => (
              <div 
                key={i} 
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[80%] p-3.5 rounded-2xl text-xs whitespace-pre-line leading-relaxed shadow-sm ${
                    msg.sender === 'user' 
                      ? 'bg-purple-600 text-white rounded-br-none' 
                      : 'bg-[#141724] border border-white/10 text-slate-200 rounded-bl-none'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {isSimTyping && (
              <div className="flex justify-start">
                <div className="bg-[#141724] border border-white/10 p-3 rounded-2xl rounded-bl-none text-xs text-slate-400 flex items-center gap-2">
                  <Bot className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                  <span>HazelWhat AI is thinking...</span>
                </div>
              </div>
            )}
          </div>

          {/* Preset Buttons */}
          <div className="px-6 py-3 bg-[#07080C] border-t border-white/5 flex flex-wrap gap-2 text-[11px]">
            <span className="text-slate-400 font-bold self-center mr-1">Try Preset:</span>
            <button 
              onClick={() => handleSimSend('What are your product prices?')}
              className="px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 transition-colors font-medium border border-white/10 cursor-pointer"
            >
              📦 Ask Prices
            </button>
            <button 
              onClick={() => handleSimSend('Are you open right now?')}
              className="px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 transition-colors font-medium border border-white/10 cursor-pointer"
            >
              ⏰ Opening Hours
            </button>
            <button 
              onClick={() => handleSimSend('Send me a voice note details')}
              className="px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 transition-colors font-medium border border-white/10 cursor-pointer"
            >
              🎙️ Voice Note Demo
            </button>
          </div>

          {/* Input Box */}
          <div className="p-4 bg-[#07080C] border-t border-white/10 flex gap-2">
            <input 
              type="text"
              value={simQuery}
              onChange={e => setSimQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSimSend()}
              placeholder="Type your customer query here..."
              className="flex-1 bg-[#0D0F17] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-purple-500"
            />
            <button 
              onClick={() => handleSimSend()}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

      </section>

      {/* ================= FAQ SECTION ================= */}
      <section id="faq" className="py-20 px-4 max-w-4xl mx-auto text-left">
        <h2 className="text-3xl font-extrabold text-white mb-8 text-center">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {[
            {
              q: "How fast does HazelWhat AI respond to WhatsApp messages?",
              a: "Our average response latency is under 3 seconds. The AI answers customer inquiries, calculates shipping, and displays product catalog cards immediately."
            },
            {
              q: "Can HazelWhat AI send voice notes?",
              a: "Yes! HazelWhat comes with natural voice note synthesis. The AI converts text responses into human-sounding voice notes directly inside WhatsApp chats."
            },
            {
              q: "Is client data kept private and isolated?",
              a: "Absolutely. Every client has an isolated database schema and dedicated configuration. Your customer conversations and knowledge base remain strictly private."
            },
            {
              q: "How do I connect my WhatsApp number?",
              a: "Once logged into your Client Portal, simply click 'Connect WhatsApp' and scan the QR code using your WhatsApp Business mobile app."
            }
          ].map((item, idx) => (
            <div key={idx} className="bg-[#0D0F17] border border-white/10 rounded-2xl overflow-hidden transition-all">
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full p-5 text-left flex justify-between items-center text-sm font-bold text-white hover:text-purple-300 transition-colors cursor-pointer"
              >
                <span>{item.q}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${openFaq === idx ? 'rotate-180 text-purple-400' : 'text-slate-400'}`} />
              </button>
              {openFaq === idx && (
                <div className="px-5 pb-5 text-xs text-slate-400 leading-relaxed border-t border-white/5 pt-3">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="py-12 px-4 border-t border-white/10 relative z-10 bg-[#05060A]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-white font-bold text-xs">
              HW
            </div>
            <span className="font-extrabold text-white text-sm">HazelWhat AI Platform</span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>All Systems Operational (Production Server)</span>
          </div>

          <div className="text-xs text-slate-500">
            © {new Date().getFullYear()} HazelWhat AI Inc. Enterprise Access Only.
          </div>
        </div>
      </footer>

      {/* ================= MODAL: SIGN IN (QUICK ACCESS) ================= */}
      {showSignInModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0D0F17] border border-white/15 rounded-3xl max-w-md w-full p-8 shadow-2xl relative space-y-6 text-left">
            
            <button
              onClick={() => setShowSignInModal(false)}
              className="absolute top-6 right-6 p-2 rounded-full bg-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center mx-auto">
                <Bot className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Client Portal Sign In</h3>
              <p className="text-xs text-slate-400">
                Enter credentials provided by your HazelWhat Super Admin.
              </p>
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleModalLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Username / Client ID
                </label>
                <input
                  type="text"
                  required
                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                  placeholder="e.g. royal_fashion"
                  className="w-full bg-[#07080C] border border-white/10 focus:border-purple-500 rounded-xl p-3 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#07080C] border border-white/10 focus:border-purple-500 rounded-xl p-3 text-xs text-white outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-extrabold text-white transition-all shadow-lg shadow-purple-600/30 cursor-pointer disabled:opacity-50"
              >
                {loginLoading ? 'Authenticating...' : 'Sign In to Client Portal'}
              </button>
            </form>

            <div className="text-center pt-2 border-t border-white/5">
              <Link href="/login?portal=client" className="text-xs text-purple-400 hover:underline">
                Open Dedicated Client Portal Sign In Page →
              </Link>
            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL: SIGN UP (INVITE ONLY NOTICE) ================= */}
      {showSignUpModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0D0F17] border border-white/15 rounded-3xl max-w-md w-full p-8 shadow-2xl relative text-center space-y-6">
            
            <button
              onClick={() => setShowSignUpModal(false)}
              className="absolute top-6 right-6 p-2 rounded-full bg-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-white">Public Registration Frozen</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                HazelWhat is an exclusive enterprise platform. Public self-registration is frozen to maintain dedicated server speeds and strict tenant privacy.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#121524] border border-white/10 text-left space-y-2 text-xs">
              <div className="font-bold text-purple-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>How to Get Access:</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                1. Your account is onboarded directly by our Super Admin team.<br />
                2. Once onboarded, you receive your Client Username & Password.<br />
                3. Use the <strong>Sign In</strong> button to access your portal.
              </p>
            </div>

            <button
              onClick={() => {
                setShowSignUpModal(false);
                setShowSignInModal(true);
              }}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition-all cursor-pointer"
            >
              Already Onboarded? Sign In Here
            </button>

          </div>
        </div>
      )}

    </div>
  );
}
