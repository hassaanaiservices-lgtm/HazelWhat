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
      
      {/* Background Subtle Gradient Glow Orbs (Matching Dark Aesthetic) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-purple-900/20 via-indigo-900/10 to-transparent rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[800px] -right-40 w-[600px] h-[600px] bg-emerald-900/15 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute top-[1800px] -left-40 w-[600px] h-[600px] bg-purple-900/15 rounded-full blur-[160px] pointer-events-none" />

      {/* Grid Pattern Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px]" 
      />

      {/* ================= STICKY PILL NAVBAR ================= */}
      <header className="sticky top-4 z-40 max-w-7xl mx-auto px-4">
        <nav className="bg-[#0D0F17]/80 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-3.5 flex items-center justify-between shadow-2xl shadow-black/80">
          
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-500 to-purple-400 p-[1px] shadow-lg shadow-purple-600/30">
              <div className="w-full h-full bg-[#0D0F17] rounded-[11px] flex items-center justify-center">
                <Bot className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
              </div>
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
            <a href="#pain-points" className="hover:text-white transition-colors">Pain Points</a>
            <a href="#solutions" className="hover:text-white transition-colors">AI Features</a>
            <a href="#case-studies" className="hover:text-white transition-colors">Case Studies</a>
            <a href="#simulator" className="hover:text-white transition-colors">Live Demo</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {sessionUser ? (
              <Link
                href={sessionUser.role === 'admin' ? '/admin' : '/client'}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-xs font-black text-slate-950 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer animate-pulse"
              >
                <Bot className="w-4 h-4 text-slate-950" />
                <span>Open {sessionUser.role === 'admin' ? 'Super Admin' : sessionUser.businessName || 'Client Portal'} →</span>
              </Link>
            ) : (
              <>
                {/* Sign In Button */}
                <button
                  onClick={() => setShowSignInModal(true)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 transition-all cursor-pointer hover:border-purple-500/40"
                >
                  Sign In
                </button>

                {/* Sign Up Button (FROZEN / INVITE ONLY) */}
                <button
                  onClick={() => setShowSignUpModal(true)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-extrabold text-white transition-all cursor-pointer shadow-lg shadow-purple-600/30 flex items-center gap-1.5"
                >
                  <span>Sign Up</span>
                  <Lock className="w-3 h-3 text-purple-200" />
                </button>
              </>
            )}
          </div>

        </nav>
      </header>

      {/* ================= SEQUENCE 1: HERO SECTION ================= */}
      <section id="hero" className="pt-20 pb-16 px-4 max-w-7xl mx-auto text-center relative z-10">
        
        {/* Pill Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-bold mb-6 animate-pulse">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>Next-Generation WhatsApp & Voice AI Agent</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white max-w-5xl mx-auto leading-[1.1] mb-6">
          Autonomous WhatsApp Sales & Voice Infrastructure for <span className="bg-gradient-to-r from-purple-400 via-indigo-300 to-emerald-400 bg-clip-text text-transparent">Modern Enterprise</span>
        </h1>

        {/* Hero Subtitle */}
        <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto font-normal leading-relaxed mb-10">
          Turn midnight inquiries into instant bookings. HazelWhat powers 24/7 autonomous customer chats, natural voice note responses, formatted catalog cards, and automated lead revivals.
        </p>

        {/* Hero CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
          <button
            onClick={() => setShowSignInModal(true)}
            className="px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:brightness-110 text-white font-extrabold text-sm shadow-xl shadow-purple-600/30 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <span>Client Sign In to Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <a
            href="#simulator"
            className="px-8 py-4 rounded-2xl bg-[#0D0F17] hover:bg-[#131624] border border-white/10 text-slate-300 font-extrabold text-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <span>Try Interactive Simulator</span>
            <Play className="w-4 h-4 text-purple-400" />
          </a>
        </div>

        {/* Trust Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mb-20 text-left">
          <div className="bg-[#0D0F17]/80 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
            <div className="text-2xl sm:text-3xl font-black text-white font-mono">&lt; 3 Sec</div>
            <div className="text-xs text-slate-400 font-medium mt-1">Average Response Latency</div>
          </div>
          <div className="bg-[#0D0F17]/80 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
            <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">+340%</div>
            <div className="text-xs text-slate-400 font-medium mt-1">Midnight Order Conversion</div>
          </div>
          <div className="bg-[#0D0F17]/80 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
            <div className="text-2xl sm:text-3xl font-black text-purple-400 font-mono">100%</div>
            <div className="text-xs text-slate-400 font-medium mt-1">Isolated Tenant Security</div>
          </div>
          <div className="bg-[#0D0F17]/80 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
            <div className="text-2xl sm:text-3xl font-black text-indigo-400 font-mono">24/7</div>
            <div className="text-xs text-slate-400 font-medium mt-1">Voice & Chat Availability</div>
          </div>
        </div>

        {/* HERO FEATURED MOCKUP CARD (Matching Reference Image Dark Glow Aesthetic) */}
        <div className="relative max-w-5xl mx-auto">
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-purple-600/30 via-indigo-500/20 to-emerald-500/30 blur-2xl opacity-50" />
          
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
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>AI Core Active</span>
              </div>
            </div>

            {/* Dashboard Mockup Layout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Card 1: Active Stats */}
              <div className="bg-[#121522] border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live WhatsApp Engine</div>
                <div className="text-4xl font-black text-white font-mono">99.8%</div>
                <p className="text-xs text-slate-400">Automated query resolution rate across 45,000+ customer chats.</p>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-purple-500 to-emerald-400 w-[94%]" />
                </div>
              </div>

              {/* Card 2: Voice AI Player */}
              <div className="bg-[#121522] border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Deepgram Voice AI</span>
                  <Volume2 className="w-4 h-4 text-purple-400" />
                </div>
                <div className="flex items-center gap-3 bg-[#0B0D14] p-3 rounded-xl border border-white/5">
                  <div className="w-8 h-8 rounded-full bg-purple-600/20 text-purple-400 flex items-center justify-center">
                    <Play className="w-4 h-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between text-[11px] font-mono text-slate-400">
                      <span>Audio Voice Reply</span>
                      <span>0:14</span>
                    </div>
                    <div className="flex gap-1 items-end h-4">
                      {[40, 70, 30, 90, 50, 80, 100, 60, 40, 70, 30, 90, 50, 80, 60, 30].map((h, i) => (
                        <div key={i} className="flex-1 bg-purple-500/70 rounded-full" style={{ height: `${h}%` }} />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-400">Generates natural human-like voice responses in Urdu and English.</p>
              </div>

              {/* Card 3: Formatted Product Card */}
              <div className="bg-[#121522] border border-white/10 rounded-2xl p-5 space-y-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Visual Product Card</div>
                <div className="bg-[#0B0D14] p-3 rounded-xl border border-white/5 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-purple-900/40 border border-purple-500/30 flex items-center justify-center font-extrabold text-xs text-purple-300">
                    CATALOG
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Royal Cotton Suit</div>
                    <div className="text-xs font-mono text-emerald-400">PKR 4,500</div>
                    <div className="text-[10px] text-slate-400">In Stock • Immediate Dispatch</div>
                  </div>
                </div>
                <div className="text-[11px] text-purple-300 font-semibold bg-purple-500/10 p-2 rounded-lg text-center">
                  Direct Checkout Link Sent to WhatsApp
                </div>
              </div>

            </div>

          </div>
        </div>

      </section>

      {/* ================= SEQUENCE 2: BUSINESS PAIN POINTS ================= */}
      <section id="pain-points" className="py-20 px-4 max-w-7xl mx-auto relative z-10 border-t border-white/5">
        
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold mb-4">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>The High Cost of Manual Operations</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4">
            Why 67% of WhatsApp Sales Leads Are Lost Forever
          </h2>
          <p className="text-slate-400 text-sm sm:text-base">
            Relying on manual human sales agents for WhatsApp customer conversations creates critical revenue bottlenecks.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Pain Point 1 */}
          <div className="bg-[#0D0F17] border border-white/10 hover:border-rose-500/40 rounded-3xl p-6 transition-all hover:-translate-y-1 space-y-4 group">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Midnight Response Gap</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              45% of online shopping inquiries arrive between 8 PM and 2 AM. When customers wait hours for a reply, they buy from competitors within minutes.
            </p>
          </div>

          {/* Pain Point 2 */}
          <div className="bg-[#0D0F17] border border-white/10 hover:border-amber-500/40 rounded-3xl p-6 transition-all hover:-translate-y-1 space-y-4 group">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Headphones className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Voice Note Burnout</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Modern buyers prefer sending 60-second voice notes instead of typing text. Human agents waste hours listening, typing responses, and making mistakes.
            </p>
          </div>

          {/* Pain Point 3 */}
          <div className="bg-[#0D0F17] border border-white/10 hover:border-purple-500/40 rounded-3xl p-6 transition-all hover:-translate-y-1 space-y-4 group">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <RefreshCw className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Forgotten Follow-Ups</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              70% of prospective leads stop replying after receiving a price quote. Human reps forget to follow up after 24-48 hours, abandoning warm pipeline deals.
            </p>
          </div>

          {/* Pain Point 4 */}
          <div className="bg-[#0D0F17] border border-white/10 hover:border-indigo-500/40 rounded-3xl p-6 transition-all hover:-translate-y-1 space-y-4 group">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Messy Catalog Sharing</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Manually finding product photos, sizes, and pricing details in phone galleries wastes valuable agent time and leads to order entry errors.
            </p>
          </div>

        </div>

      </section>

      {/* ================= SEQUENCE 3: PRODUCT SOLUTIONS ================= */}
      <section id="solutions" className="py-20 px-4 max-w-7xl mx-auto relative z-10 border-t border-white/5">
        
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-4">
            <Zap className="w-3.5 h-3.5" />
            <span>Built for High Conversions</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4">
            The HazelWhat AI Automation Engine
          </h2>
          <p className="text-slate-400 text-sm sm:text-base">
            Everything your business needs to turn WhatsApp into an autonomous sales machine.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Solution 1 */}
          <div className="bg-[#0D0F17] border border-white/10 rounded-3xl p-8 space-y-5 hover:border-purple-500/50 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-purple-600/20 text-purple-400 flex items-center justify-center">
              <Bot className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">24/7 AI Booking Agent</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Trained on your exact business knowledge base, FAQs, policies, and pricing. Answers queries in natural conversational tones without hallucinating.
            </p>
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Multi-turn contextual memory</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Instant booking & order creation</span>
              </li>
            </ul>
          </div>

          {/* Solution 2 */}
          <div className="bg-[#0D0F17] border border-white/10 rounded-3xl p-8 space-y-5 hover:border-indigo-500/50 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <Volume2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">Natural Voice AI Engine</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Powered by Deepgram voice synthesis. Transcribes incoming customer audio messages and responds with natural, human-sounding voice notes.
            </p>
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Supports Urdu & English voices</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Sub-second audio synthesis</span>
              </li>
            </ul>
          </div>

          {/* Solution 3 */}
          <div className="bg-[#0D0F17] border border-white/10 rounded-3xl p-8 space-y-5 hover:border-emerald-500/50 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">Automated Follow-ups</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Configurable sequence rules (1 hour, 1 day, 3 days...). Automatically sends non-spammy reminders to un-replied leads until they convert.
            </p>
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Auto-skips if customer orders</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Dynamic AI message variation</span>
              </li>
            </ul>
          </div>

        </div>

      </section>

      {/* ================= SEQUENCE 4: CASE STUDIES ================= */}
      <section id="case-studies" className="py-20 px-4 max-w-7xl mx-auto relative z-10 border-t border-white/5">
        
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold mb-4">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Proven Enterprise Impact</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4">
            Real Revenue Growth for Real Businesses
          </h2>
          <p className="text-slate-400 text-sm sm:text-base">
            See how leading brands transformed their WhatsApp conversions with HazelWhat.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Case Study 1 */}
          <div className="bg-[#0D0F17] border border-white/10 rounded-3xl p-8 space-y-6 relative overflow-hidden">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-purple-400 uppercase tracking-wider font-mono">Retail Apparel</span>
              <div className="flex text-amber-400 text-xs">★★★★★</div>
            </div>
            <h3 className="text-xl font-bold text-white">Royal Fashion & Fabrics</h3>
            <blockquote className="text-xs text-slate-300 italic leading-relaxed">
              "Before HazelWhat, we lost over 50 inquiries every night after 10 PM. Now, HazelWhat AI handles overnight catalog queries and completes payments automatically. Our sales jumped 340% in 60 days."
            </blockquote>
            <div className="pt-4 border-t border-white/10 flex justify-between items-center text-xs font-mono">
              <span className="text-slate-400">Midnight Revenue</span>
              <span className="text-emerald-400 font-bold">+340% Growth</span>
            </div>
          </div>

          {/* Case Study 2 */}
          <div className="bg-[#0D0F17] border border-white/10 rounded-3xl p-8 space-y-6 relative overflow-hidden">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider font-mono">Auto Services</span>
              <div className="flex text-amber-400 text-xs">★★★★★</div>
            </div>
            <h3 className="text-xl font-bold text-white">AutoCare Premier Services</h3>
            <blockquote className="text-xs text-slate-300 italic leading-relaxed">
              "Customer voice note follow-ups changed everything. The automated sequence sends audio reminders to un-replied leads after 24 hours. We recovered 142 abandoned bookings last month alone."
            </blockquote>
            <div className="pt-4 border-t border-white/10 flex justify-between items-center text-xs font-mono">
              <span className="text-slate-400">Leads Recovered</span>
              <span className="text-indigo-400 font-bold">142 Deals / Mo</span>
            </div>
          </div>

          {/* Case Study 3 */}
          <div className="bg-[#0D0F17] border border-white/10 rounded-3xl p-8 space-y-6 relative overflow-hidden">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono">E-Commerce</span>
              <div className="flex text-amber-400 text-xs">★★★★★</div>
            </div>
            <h3 className="text-xl font-bold text-white">NextGen Tech Store</h3>
            <blockquote className="text-xs text-slate-300 italic leading-relaxed">
              "Response time dropped from 45 minutes to 2.1 seconds. HazelWhat answers spec questions, sends product catalog cards, and routes high-value orders instantly."
            </blockquote>
            <div className="pt-4 border-t border-white/10 flex justify-between items-center text-xs font-mono">
              <span className="text-slate-400">Support Cost Saved</span>
              <span className="text-purple-400 font-bold">82% Reduction</span>
            </div>
          </div>

        </div>

      </section>

      {/* ================= SEQUENCE 5: INTERACTIVE LIVE SIMULATOR ================= */}
      <section id="simulator" className="py-20 px-4 max-w-7xl mx-auto relative z-10 border-t border-white/5">
        
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-4">
            <Radio className="w-3.5 h-3.5" />
            <span>Test the Engine Live</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4">
            Experience HazelWhat WhatsApp AI Live
          </h2>
          <p className="text-slate-400 text-sm sm:text-base">
            Type any sample question below to watch how the HazelWhat AI agent responds in real-time.
          </p>
        </div>

        <div className="max-w-3xl mx-auto bg-[#0D0F17] border border-white/15 rounded-3xl overflow-hidden shadow-2xl">
          
          {/* Chat Simulator Header */}
          <div className="bg-[#121522] p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span>HazelWhat Store AI</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="text-[11px] text-slate-400">Online • Typically replies instantly</div>
              </div>
            </div>

            <div className="flex gap-2">
              {['What are your store hours?', 'Send product prices', 'Voice note sample 🎙️'].map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSimSend(chip)}
                  className="hidden sm:block text-[11px] font-semibold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Messages Body */}
          <div className="p-6 space-y-4 min-h-[300px] max-h-[420px] overflow-y-auto bg-[#08090E]">
            {simMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl p-4 text-xs leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-purple-600 text-white rounded-br-none shadow-md'
                    : 'bg-[#141724] border border-white/10 text-slate-200 rounded-bl-none shadow-md'
                }`}>
                  <div className="whitespace-pre-line">{msg.text}</div>
                </div>
              </div>
            ))}

            {isSimTyping && (
              <div className="flex justify-start">
                <div className="bg-[#141724] border border-white/10 text-slate-400 rounded-2xl px-4 py-3 text-xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" />
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce [animation-delay:0.4s]" />
                  <span className="text-[11px] font-mono ml-1">HazelWhat AI is generating response...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Box */}
          <div className="p-4 bg-[#121522] border-t border-white/10 flex items-center gap-3">
            <input
              type="text"
              value={simQuery}
              onChange={(e) => setSimQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSimSend()}
              placeholder="Type a sample customer question (e.g. Do you deliver to Lahore?)..."
              className="flex-1 bg-[#08090E] border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500"
            />
            <button
              onClick={() => handleSimSend()}
              className="bg-purple-600 hover:bg-purple-500 text-white p-3 rounded-xl transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

        </div>

      </section>

      {/* ================= SEQUENCE 6: PRICING TIERS ================= */}
      <section id="pricing" className="py-20 px-4 max-w-7xl mx-auto relative z-10 border-t border-white/5">
        
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold mb-4">
            <Layers className="w-3.5 h-3.5" />
            <span>Transparent Investment</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4">
            Enterprise Automation Plans
          </h2>
          <p className="text-slate-400 text-sm sm:text-base">
            Select the scale that matches your business customer volume.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Plan 1 */}
          <div className="bg-[#0D0F17] border border-white/10 rounded-3xl p-8 space-y-6 flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Starter Automation</h3>
              <p className="text-xs text-slate-400 mt-1">Ideal for boutique stores & new brands.</p>
              <div className="my-6">
                <span className="text-3xl font-black text-white font-mono">PKR 15,000</span>
                <span className="text-xs text-slate-400 font-normal"> / month</span>
              </div>
              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> 1 WhatsApp Business Line</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> 24/7 AI Knowledge Base Agent</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> 800 AI Chat Minutes / Mo</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Automated Sequence Follow-ups</li>
              </ul>
            </div>
            <button
              onClick={() => setShowSignInModal(true)}
              className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white transition-all cursor-pointer mt-6"
            >
              Sign In to Access
            </button>
          </div>

          {/* Plan 2 (Highlighted) */}
          <div className="bg-[#121524] border-2 border-purple-500 rounded-3xl p-8 space-y-6 flex flex-col justify-between shadow-2xl shadow-purple-600/20 relative">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-md">
              Most Popular
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Growth Suite</h3>
              <p className="text-xs text-slate-400 mt-1">For scaling e-commerce & active service businesses.</p>
              <div className="my-6">
                <span className="text-3xl font-black text-white font-mono">PKR 35,000</span>
                <span className="text-xs text-slate-400 font-normal"> / month</span>
              </div>
              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Deepgram Voice AI Enabled</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Formatted Visual Product Catalog</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> 2,500 AI Chat & Voice Minutes</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Automated Leads Revival Engine</li>
              </ul>
            </div>
            <button
              onClick={() => setShowSignInModal(true)}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-extrabold text-white transition-all cursor-pointer shadow-lg shadow-purple-600/30 mt-6"
            >
              Sign In to Client Portal
            </button>
          </div>

          {/* Plan 3 */}
          <div className="bg-[#0D0F17] border border-white/10 rounded-3xl p-8 space-y-6 flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Custom Enterprise</h3>
              <p className="text-xs text-slate-400 mt-1">High volume multi-channel organizations.</p>
              <div className="my-6">
                <span className="text-3xl font-black text-white font-mono">Custom</span>
              </div>
              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Dedicated Enterprise Infrastructure</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Custom LLM Prompt & API Fine-tuning</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Unlimited Quota Minutes</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> 24/7 Priority SLA Manager</li>
              </ul>
            </div>
            <button
              onClick={() => setShowSignUpModal(true)}
              className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 transition-all cursor-pointer mt-6"
            >
              Contact Sales
            </button>
          </div>

        </div>

      </section>

      {/* ================= SEQUENCE 7: FAQ ACCORDION ================= */}
      <section id="faq" className="py-20 px-4 max-w-4xl mx-auto relative z-10 border-t border-white/5">
        
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-slate-400 text-sm">
            Everything you need to know about HazelWhat client onboarding and platform features.
          </p>
        </div>

        <div className="space-y-4">
          {[
            {
              q: "How do onboarded clients sign in to HazelWhat?",
              a: "When your business is onboarded by the HazelWhat Super Admin team, you receive unique client login credentials (Username & Password). Click the 'Sign In' button at the top of this landing page or visit /login to enter your Client Portal."
            },
            {
              q: "Why is the Sign Up option frozen / invite-only?",
              a: "HazelWhat operates as an exclusive, managed enterprise AI platform. Accounts are set up and verified directly by agency admins to ensure dedicated API provisioning and 100% data privacy."
            },
            {
              q: "How does HazelWhat connect to our WhatsApp Business number?",
              a: "You can link your WhatsApp Business phone number in under 30 seconds by scanning a QR code inside your Client Portal or entering an 8-digit device pairing code on your phone."
            },
            {
              q: "Can the AI voice assistant speak in Urdu and local dialects?",
              a: "Yes! HazelWhat uses Deepgram voice synthesis, supporting clear, natural Urdu and English voice note generation."
            },
            {
              q: "How does the AI know about our products and prices?",
              a: "Inside your Client Portal, you can enter your exact business FAQs, product catalog items, prices, and response guidelines. The AI syncs in real-time."
            }
          ].map((item, idx) => (
            <div 
              key={idx}
              className="bg-[#0D0F17] border border-white/10 rounded-2xl overflow-hidden transition-all"
            >
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
          <div className="bg-[#0D0F17] border border-white/15 rounded-3xl max-w-md w-full p-8 shadow-2xl relative space-y-6">
            
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
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-extrabold text-white transition-all shadow-lg shadow-purple-600/30 cursor-pointer disabled:opacity-50"
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

      {/* ================= MODAL: SIGN UP (FROZEN / INVITE ONLY NOTICE) ================= */}
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
                HazelWhat is an exclusive, invite-only enterprise platform. Public self-registration is frozen to maintain dedicated server speeds and strict tenant privacy.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#121524] border border-white/10 text-left space-y-2 text-xs">
              <div className="font-bold text-purple-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>How to Get Access:</span>
              </div>
              <p className="text-slate-300">
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
