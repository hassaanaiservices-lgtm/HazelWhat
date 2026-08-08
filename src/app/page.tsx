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
  Send,
  ShoppingBag,
  Sliders,
  Share2,
  Video,
  Camera,
  Plus
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
    <div className="min-h-screen bg-[#F8F9FD] text-slate-900 font-sans selection:bg-purple-500/20 selection:text-purple-900 relative overflow-x-hidden">
      
      {/* Background Soft Purple Radial Glow Mesh */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[650px] bg-gradient-to-b from-purple-200/50 via-pink-100/30 to-transparent rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[1200px] -right-40 w-[600px] h-[600px] bg-purple-100/40 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute top-[2400px] -left-40 w-[600px] h-[600px] bg-indigo-100/40 rounded-full blur-[160px] pointer-events-none" />

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* ================= STICKY FLOATING PILL NAVBAR ================= */}
      <header className="sticky top-5 z-40 max-w-6xl mx-auto px-4">
        <nav className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-full px-6 py-3 flex items-center justify-between shadow-lg shadow-slate-200/50">
          
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-md group-hover:scale-105 transition-transform">
              <Bot className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-extrabold text-xl text-slate-900 tracking-tight">HazelWhat<span className="text-purple-600">.AI</span></span>
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-600">
            <a href="#hero" className="hover:text-slate-900 transition-colors">Product</a>
            <a href="#features" className="hover:text-slate-900 transition-colors">Solution</a>
            <a href="#workflow" className="hover:text-slate-900 transition-colors">Resources</a>
            <a href="#simulator" className="hover:text-slate-900 transition-colors">Live Demo</a>
            <a href="#metrics" className="hover:text-slate-900 transition-colors">Pricing</a>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {sessionUser ? (
              <Link
                href={sessionUser.role === 'admin' ? '/admin' : '/client'}
                className="px-5 py-2.5 rounded-full bg-slate-900 hover:bg-black text-xs font-extrabold text-white transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Bot className="w-4 h-4" />
                <span>Open {sessionUser.role === 'admin' ? 'Super Admin' : sessionUser.businessName || 'Client Portal'} →</span>
              </Link>
            ) : (
              <>
                <button
                  onClick={() => setShowSignInModal(true)}
                  className="px-6 py-2.5 rounded-full bg-slate-900 hover:bg-black text-xs font-extrabold text-white transition-all shadow-md cursor-pointer hover:shadow-lg"
                >
                  Client Sign In
                </button>
              </>
            )}
          </div>

        </nav>
      </header>

      {/* ================= HERO SECTION ================= */}
      <section id="hero" className="pt-16 pb-12 px-4 max-w-6xl mx-auto text-center relative z-10">
        
        {/* Main Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 max-w-4xl mx-auto leading-[1.12] mb-6">
          AI That Supercharges Your <br />
          <span className="italic font-serif font-normal bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">Conversions 4x</span>
        </h1>

        {/* Subtitle */}
        <p className="text-slate-600 text-base sm:text-lg max-w-2xl mx-auto font-normal leading-relaxed mb-8">
          Our AI-powered sales assistant helps you capture, qualify, and convert transforming leads into loyal customers across WhatsApp, Voice, and Web.
        </p>

        {/* Primary CTA Pill Button */}
        <div className="flex justify-center mb-16">
          <button
            onClick={() => setShowSignInModal(true)}
            className="px-8 py-3.5 rounded-full bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 hover:opacity-95 text-white font-bold text-sm shadow-xl shadow-purple-500/25 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <span>Client Sign In to Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* HERO IMAGE & FLOATING GLASS WIDGETS */}
        <div className="relative max-w-4xl mx-auto mb-16">
          
          {/* Main Rounded Image Showcase */}
          <div className="relative mx-auto w-full max-w-2xl h-[380px] sm:h-[480px] rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white bg-slate-100">
            <img 
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=1200&auto=format&fit=crop" 
              alt="AI Sales Assistant" 
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent" />
          </div>

          {/* FLOATING WIDGET LEFT: 35% Growth in New Customers */}
          <div className="absolute top-16 left-0 sm:-left-10 bg-white/90 backdrop-blur-xl border border-white/80 p-4 rounded-2xl shadow-xl shadow-purple-500/10 flex items-center gap-3.5 text-left max-w-[200px] animate-bounce-slow">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-sm">
              35%
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-800 leading-snug">Growth in New Customers</div>
              <div className="text-[9px] text-slate-500 font-medium">Automated 24/7</div>
            </div>
          </div>

          {/* FLOATING WIDGET RIGHT: Product Card with Add To Cart */}
          <div className="absolute bottom-12 right-0 sm:-right-10 bg-white/95 backdrop-blur-xl border border-white/80 p-4 rounded-2xl shadow-2xl text-left max-w-[210px]">
            <div className="relative mb-3 rounded-xl overflow-hidden bg-slate-100 h-24">
              <img 
                src="https://images.unsplash.com/photo-1608248597263-0057e43a4524?q=80&w=400&auto=format&fit=crop" 
                alt="Product" 
                className="w-full h-full object-cover"
              />
              <span className="absolute top-2 right-2 bg-white/90 px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-800 flex items-center gap-1 shadow-sm">
                <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> 4.5
              </span>
            </div>
            <div className="text-xs font-bold text-slate-900 mb-2">Radiance Facial Serum</div>
            <button 
              onClick={() => setShowSignInModal(true)}
              className="w-full py-2 bg-slate-900 hover:bg-black text-white text-[11px] font-bold rounded-xl shadow transition-all cursor-pointer text-center"
            >
              Add To Cart
            </button>
          </div>

        </div>

        {/* FLOATING DARK BANNER OVERLAY Across Bottom of Hero */}
        <div className="max-w-4xl mx-auto bg-[#13151D] text-white rounded-3xl p-6 sm:p-8 shadow-2xl grid grid-cols-1 sm:grid-cols-3 gap-6 text-center border border-white/10">
          <div className="space-y-1 sm:border-r border-white/10 sm:pr-4">
            <div className="text-3xl font-extrabold tracking-tight">70%</div>
            <div className="text-xs text-slate-400 font-medium">Less Manual Communication</div>
          </div>
          <div className="space-y-1 sm:border-r border-white/10 sm:px-4">
            <div className="text-3xl font-extrabold tracking-tight">3-6X</div>
            <div className="text-xs text-slate-400 font-medium">Higher Engagement</div>
          </div>
          <div className="space-y-1 sm:pl-4">
            <div className="text-3xl font-extrabold tracking-tight">50%</div>
            <div className="text-xs text-slate-400 font-medium">More Customer Interaction</div>
          </div>
        </div>

      </section>

      {/* ================= FEATURE SECTION 1: MULTI-AGENT & VOICE FEATURE ================= */}
      <section id="features" className="py-20 px-4 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          {/* Left Text Column */}
          <div className="space-y-6 text-left">
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Multi-Agent & <br />Voice AI Feature
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              Collaborate in real time by deploying autonomous WhatsApp & Voice co-hosts to handle inquiries, recommend products, and book appointments 24/7.
            </p>
            <button
              onClick={() => setShowSignInModal(true)}
              className="px-6 py-3 rounded-full bg-slate-900 hover:bg-black text-white text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              Start Hosting
            </button>
          </div>

          {/* Right Visual Card Column */}
          <div className="relative">
            <div className="relative bg-white rounded-[2.5rem] p-6 shadow-xl border border-slate-200/80 flex items-center justify-center">
              <div className="relative w-full h-[320px] rounded-2xl overflow-hidden bg-slate-100">
                <img 
                  src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=800&auto=format&fit=crop" 
                  alt="Feature Visual" 
                  className="w-full h-full object-cover"
                />
                
                {/* Floating Discount Badge */}
                <div className="absolute bottom-6 right-6 bg-white/95 backdrop-blur-md p-3 px-5 rounded-2xl shadow-lg border border-slate-100 text-left">
                  <div className="text-base font-extrabold text-slate-900">30%</div>
                  <div className="text-[10px] text-slate-500 font-medium">Up To Customer</div>
                </div>

                {/* Floating Product Badge Top-Left */}
                <div className="absolute top-6 left-6 bg-white/95 backdrop-blur-md p-3 rounded-2xl shadow-lg flex items-center gap-3 border border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 overflow-hidden">
                    <img src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=200&auto=format&fit=crop" alt="Item" className="w-full h-full object-cover" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold text-slate-900">Body Polish</div>
                    <div className="text-[11px] font-extrabold text-purple-600">$120.00</div>
                  </div>
                </div>

              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ================= 3-CARD FEATURE GRID: REVOLUTIONIZE YOUR SALES WITH AI ================= */}
      <section className="py-20 px-4 max-w-6xl mx-auto text-center">
        
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 mb-4">
          Revolutionize Your Sales With AI
        </h2>
        <p className="text-slate-600 text-sm sm:text-base max-w-xl mx-auto mb-6">
          Our AI-powered sales assistant helps you capture, qualify, and convert transforming leads into loyal customers.
        </p>
        
        <div className="flex justify-center mb-16">
          <button
            onClick={() => setShowSignInModal(true)}
            className="px-6 py-3 rounded-full bg-slate-900 hover:bg-black text-white text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            Try AI Sales Now
          </button>
        </div>

        {/* 3 Light Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          
          {/* Card 1 */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-md hover:shadow-xl transition-all space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
              <Bot className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Automated Conversations</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-normal">
              AI-powered chats that answer questions 24/7, qualify incoming leads, and guide them through catalog checkout seamlessly.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-md hover:shadow-xl transition-all space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center border border-pink-100">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Smart Sales Insights</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-normal">
              AI-driven analytics that help your team understand customer prospects, score lead urgency, and predict revenue outcomes.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-md hover:shadow-xl transition-all space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Multichannel Communication</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-normal">
              Engage customers on their favorite platforms — WhatsApp, Voice notes, and Web — keeping conversations unified across channels.
            </p>
          </div>

        </div>

      </section>

      {/* ================= "HOW IT WORKS" WORKFLOW SECTION ================= */}
      <section id="workflow" className="py-20 px-4 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          
          {/* Left Text */}
          <div className="space-y-6 text-left">
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
              How It Works
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              Our 4-step sales agent workflow moves leads smoothly from initial inquiry to closing the deal.
            </p>
            <button
              onClick={() => setShowSignInModal(true)}
              className="px-6 py-3 rounded-full bg-slate-900 hover:bg-black text-white text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              Start the Overview
            </button>
          </div>

          {/* Right 4 Steps List */}
          <div className="space-y-4 text-left">
            
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                01
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">Customer asks about a product</div>
                <div className="text-xs text-slate-500 mt-0.5">Inbound query received via WhatsApp or Web.</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                02
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">AI answers instantly</div>
                <div className="text-xs text-slate-500 mt-0.5">Autonomous response with catalog cards & natural voice notes.</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                03
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">Lead qualified & score assigned</div>
                <div className="text-xs text-slate-500 mt-0.5">Contextual memory captures intent and alerts your team if needed.</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                04
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">Sale closed</div>
                <div className="text-xs text-slate-500 mt-0.5">Direct product link sent and order confirmed automatically.</div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ================= OMNICHANNEL SECTION: LIVE ON EVERY CHANNEL AT ONCE ================= */}
      <section className="py-20 px-4 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          {/* Left Visual Mockup */}
          <div className="relative">
            <div className="bg-white rounded-[2.5rem] p-6 shadow-xl border border-slate-200/80 space-y-4 text-left">
              
              {/* Product Badge */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 overflow-hidden">
                    <img src="https://images.unsplash.com/photo-1608248597263-0057e43a4524?q=80&w=200&auto=format&fit=crop" alt="Oil" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Facial Oil</div>
                    <div className="text-[10px] text-slate-500">$126.00 USD</div>
                  </div>
                </div>
                <span className="px-3 py-1 bg-purple-600 text-white text-[10px] font-bold rounded-full">Active Reel</span>
              </div>

              {/* Going Live Selector */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-md space-y-3">
                <div className="text-xs font-bold text-slate-800">Going Live On:</div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs font-semibold text-slate-700">
                  <Camera className="w-4 h-4 text-pink-600" />
                  <span>Import Instagram Reel</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs font-semibold text-slate-700">
                  <Video className="w-4 h-4 text-slate-900" />
                  <span>Import TikTok Reel</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs font-semibold text-slate-700">
                  <Plus className="w-4 h-4 text-purple-600" />
                  <span>Import From Your Device</span>
                </div>
              </div>

            </div>
          </div>

          {/* Right Text */}
          <div className="space-y-6 text-left">
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Live on Every <br />Channel at Once
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              Go live once and share your automated message across all major messaging and social platforms without extra effort.
            </p>
            <button
              onClick={() => setShowSignInModal(true)}
              className="px-6 py-3 rounded-full bg-slate-900 hover:bg-black text-white text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              Start Streaming Now
            </button>
          </div>

        </div>
      </section>

      {/* ================= INTERACTIVE DEMO SIMULATOR ================= */}
      <section id="simulator" className="py-20 px-4 max-w-5xl mx-auto text-center">
        
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-100 border border-purple-200 text-purple-700 text-xs font-bold mb-4">
          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
          <span>Test Drive Live Bot Experience</span>
        </div>

        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mb-3">
          Try the Interactive AI Simulator
        </h2>
        <p className="text-slate-600 text-xs sm:text-sm max-w-lg mx-auto mb-8">
          Type any inquiry below to test how HazelWhat AI handles customer chats, product catalogs, and voice responses in real time.
        </p>

        {/* Simulator Container */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl overflow-hidden text-left max-w-3xl mx-auto">
          
          {/* Header Bar */}
          <div className="bg-slate-900 text-white p-4 px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center font-bold text-xs">
                AI
              </div>
              <div>
                <div className="text-xs font-bold">HazelWhat Autonomous Assistant</div>
                <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Online 24/7
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={() => setSimActiveTab('chat')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${simActiveTab === 'chat' ? 'bg-purple-600 text-white' : 'bg-white/10 text-slate-300'}`}
              >
                Chat Mode
              </button>
              <button 
                onClick={() => setSimActiveTab('voice')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${simActiveTab === 'voice' ? 'bg-purple-600 text-white' : 'bg-white/10 text-slate-300'}`}
              >
                Voice Note
              </button>
            </div>
          </div>

          {/* Chat Body */}
          <div className="p-6 h-[320px] overflow-y-auto space-y-4 bg-slate-50">
            {simMessages.map((msg, i) => (
              <div 
                key={i} 
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[80%] p-3.5 rounded-2xl text-xs whitespace-pre-line leading-relaxed shadow-sm ${
                    msg.sender === 'user' 
                      ? 'bg-slate-900 text-white rounded-br-none' 
                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {isSimTyping && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-bl-none text-xs text-slate-500 flex items-center gap-2">
                  <Bot className="w-3.5 h-3.5 text-purple-600 animate-spin" />
                  <span>HazelWhat AI is thinking...</span>
                </div>
              </div>
            )}
          </div>

          {/* Preset Buttons */}
          <div className="px-6 py-3 bg-white border-t border-slate-100 flex flex-wrap gap-2 text-[11px]">
            <span className="text-slate-400 font-bold self-center mr-1">Try Preset:</span>
            <button 
              onClick={() => handleSimSend('What are your product prices?')}
              className="px-3 py-1 rounded-full bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700 transition-colors font-medium border border-slate-200/80 cursor-pointer"
            >
              📦 Ask Prices
            </button>
            <button 
              onClick={() => handleSimSend('Are you open right now?')}
              className="px-3 py-1 rounded-full bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700 transition-colors font-medium border border-slate-200/80 cursor-pointer"
            >
              ⏰ Opening Hours
            </button>
            <button 
              onClick={() => handleSimSend('Send me a voice note details')}
              className="px-3 py-1 rounded-full bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700 transition-colors font-medium border border-slate-200/80 cursor-pointer"
            >
              🎙️ Voice Note Demo
            </button>
          </div>

          {/* Input Box */}
          <div className="p-4 bg-white border-t border-slate-200 flex gap-2">
            <input 
              type="text"
              value={simQuery}
              onChange={e => setSimQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSimSend()}
              placeholder="Type your customer query here..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 outline-none focus:border-purple-500"
            />
            <button 
              onClick={() => handleSimSend()}
              className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

      </section>

      {/* ================= STAT GAUGES SECTION: THE PROOF IN THE NUMBER ================= */}
      <section id="metrics" className="py-20 px-4 max-w-6xl mx-auto text-center">
        
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 mb-3">
          The Proof In The Number
        </h2>
        <p className="text-slate-600 text-sm sm:text-base max-w-xl mx-auto mb-16">
          Our AI sales agent doesn't just promise results, it delivers them. See the metrics for yourself.
        </p>

        {/* 3 Circular Dotted SVG Gauges */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-4xl mx-auto">
          
          {/* Gauge 1: 10,000+ */}
          <div className="flex flex-col items-center space-y-4">
            <div className="relative w-44 h-44 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="#E2E8F0"
                  strokeWidth="6"
                  strokeDasharray="4 4"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="#8B5CF6"
                  strokeWidth="6"
                  strokeDasharray="4 4"
                  strokeDashoffset="60"
                  fill="transparent"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold text-slate-900">10,000+</span>
                <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider mt-0.5">Closed</span>
              </div>
            </div>
            <div className="text-xs font-bold text-slate-600">Leads Closed With AI</div>
          </div>

          {/* Gauge 2: 70% */}
          <div className="flex flex-col items-center space-y-4">
            <div className="relative w-44 h-44 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="#E2E8F0"
                  strokeWidth="6"
                  strokeDasharray="4 4"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="#F97316"
                  strokeWidth="6"
                  strokeDasharray="4 4"
                  strokeDashoffset="80"
                  fill="transparent"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold text-slate-900">70%</span>
                <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider mt-0.5">Faster</span>
              </div>
            </div>
            <div className="text-xs font-bold text-slate-600">Faster Response Time</div>
          </div>

          {/* Gauge 3: 5X */}
          <div className="flex flex-col items-center space-y-4">
            <div className="relative w-44 h-44 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="#E2E8F0"
                  strokeWidth="6"
                  strokeDasharray="4 4"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="#EAB308"
                  strokeWidth="6"
                  strokeDasharray="4 4"
                  strokeDashoffset="90"
                  fill="transparent"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold text-slate-900">5X</span>
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mt-0.5">More</span>
              </div>
            </div>
            <div className="text-xs font-bold text-slate-600">More Conversions</div>
          </div>

        </div>

      </section>

      {/* ================= FAQ SECTION ================= */}
      <section id="faq" className="py-20 px-4 max-w-4xl mx-auto text-left">
        <h2 className="text-3xl font-extrabold text-slate-900 mb-8 text-center">Frequently Asked Questions</h2>
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
            <div key={idx} className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden transition-all shadow-sm">
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full p-5 text-left flex justify-between items-center text-sm font-bold text-slate-900 hover:text-purple-600 transition-colors cursor-pointer"
              >
                <span>{item.q}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${openFaq === idx ? 'rotate-180 text-purple-600' : 'text-slate-400'}`} />
              </button>
              {openFaq === idx && (
                <div className="px-5 pb-5 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ================= DARK FOOTER WITH GIANT TYPOGRAPHY WATERMARK ================= */}
      <footer className="bg-[#0B0D12] text-white pt-20 pb-12 px-6 relative z-10 overflow-hidden">
        <div className="max-w-6xl mx-auto space-y-16">
          
          {/* Top Row */}
          <div className="flex flex-col md:flex-row items-start justify-between gap-8">
            <div className="space-y-3">
              <h3 className="text-2xl font-bold tracking-tight text-white">Smarter Sales Starts with AI</h3>
              <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                Autonomous WhatsApp & Voice Infrastructure powering 24/7 customer engagement for modern businesses.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-12 text-xs">
              <div className="space-y-2">
                <div className="font-bold text-slate-300">Function</div>
                <div className="space-y-1.5 text-slate-500">
                  <div>Sales</div>
                  <div>Voice AI</div>
                  <div>Research</div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="font-bold text-slate-300">Company</div>
                <div className="space-y-1.5 text-slate-500">
                  <div>About Us</div>
                  <div>Product</div>
                  <div>Agents</div>
                </div>
              </div>
            </div>
          </div>

          {/* Copyright Row */}
          <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 gap-4">
            <div>© {new Date().getFullYear()} HazelWhat.AI All Rights Reserved.</div>
            <div className="flex gap-6 text-slate-400">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms Of Use</a>
            </div>
          </div>

          {/* GIANT BOLD WATERMARK FOOTER (Matching Reference Image) */}
          <div className="pt-6 text-center select-none opacity-90">
            <h1 className="text-6xl sm:text-9xl lg:text-[14rem] font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white/90 via-white/40 to-white/5 leading-none uppercase">
              HazelWhat
            </h1>
          </div>

        </div>
      </footer>

      {/* ================= MODAL: SIGN IN (QUICK ACCESS) ================= */}
      {showSignInModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-8 shadow-2xl relative space-y-6 text-left">
            
            <button
              onClick={() => setShowSignInModal(false)}
              className="absolute top-6 right-6 p-2 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mx-auto">
                <Bot className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Client Portal Sign In</h3>
              <p className="text-xs text-slate-500">
                Enter credentials provided by your HazelWhat Super Admin.
              </p>
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleModalLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Username / Client ID
                </label>
                <input
                  type="text"
                  required
                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                  placeholder="e.g. royal_fashion"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-purple-600 rounded-xl p-3 text-xs text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-purple-600 rounded-xl p-3 text-xs text-slate-900 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3.5 rounded-xl bg-slate-900 hover:bg-black text-xs font-extrabold text-white transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {loginLoading ? 'Authenticating...' : 'Sign In to Client Portal'}
              </button>
            </form>

            <div className="text-center pt-2 border-t border-slate-100">
              <Link href="/login?portal=client" className="text-xs text-purple-600 font-semibold hover:underline">
                Open Dedicated Client Portal Sign In Page →
              </Link>
            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL: SIGN UP (INVITE ONLY NOTICE) ================= */}
      {showSignUpModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-8 shadow-2xl relative text-center space-y-6">
            
            <button
              onClick={() => setShowSignUpModal(false)}
              className="absolute top-6 right-6 p-2 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900">Public Registration Frozen</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                HazelWhat is an exclusive enterprise platform. Public self-registration is frozen to maintain dedicated server speeds and strict tenant privacy.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-2 text-xs">
              <div className="font-bold text-purple-700 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>How to Get Access:</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
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
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-xs font-bold text-white transition-all cursor-pointer shadow-md"
            >
              Already Onboarded? Sign In Here
            </button>

          </div>
        </div>
      )}

    </div>
  );
}
