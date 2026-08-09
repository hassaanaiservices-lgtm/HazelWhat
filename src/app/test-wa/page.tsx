'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Terminal,
  Settings,
  RefreshCw,
  Play,
  Square,
  Trash2,
  Send,
  Smartphone,
  QrCode,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Info,
  Clock,
  Layers
} from 'lucide-react';
import Link from 'next/link';

interface LogEntry {
  timestamp: string;
  type: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

export default function WhatsAppDiagnosticPage() {
  const [status, setStatus] = useState<string>('unknown');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrGeneratedAt, setQrGeneratedAt] = useState<number | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastStatusCode, setLastStatusCode] = useState<number | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState<number>(0);
  
  const [qrSecondsLeft, setQrSecondsLeft] = useState<number>(20);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendTo, setSendTo] = useState<string>('');
  const [sendMessageText, setSendMessageText] = useState<string>('');
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);
  
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Add a log entry
  const addLog = (message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { timestamp, type, message }]);
  };

  // Auto-scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Fetch status on mount and poll
  const fetchStatus = async (silent = false) => {
    try {
      const res = await fetch('/api/whatsapp/session');
      const data = await res.json();
      
      if (data.success && data.session) {
        const s = data.session;
        setStatus(s.status || 'disconnected');
        setQrCode(s.qrCode || null);
        setQrGeneratedAt(s.qrGeneratedAt || null);
        setPhoneNumber(s.phoneNumber || '');
        setDisplayName(s.displayName || '');
        setLastError(s.lastError || null);
        setLastStatusCode(s.lastStatusCode || null);
        setReconnectAttempts(s.reconnectAttempts || 0);

        if (!silent) {
          addLog(`Fetched status: ${s.status?.toUpperCase()}`, 'info');
          if (s.lastError) {
            addLog(`Last server error: ${s.lastError} (Code: ${s.lastStatusCode})`, 'warn');
          }
        }
      } else {
        if (!silent) addLog(data.error || 'Failed to fetch status', 'error');
      }
    } catch (e: any) {
      if (!silent) addLog(`Status query error: ${e.message}`, 'error');
    }
  };

  useEffect(() => {
    fetchStatus();
    addLog('Diagnostics Console initialized.', 'success');

    const interval = setInterval(() => {
      fetchStatus(true);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // QR countdown timer
  useEffect(() => {
    if (status !== 'scanning' && status !== 'waiting_qr' || !qrGeneratedAt) {
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

  // Start Session (Generate QR / Connect)
  const handleStartSession = async () => {
    setIsLoading(true);
    addLog('Sending request to start WhatsApp session...', 'info');
    try {
      const res = await fetch('/api/whatsapp/session', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        addLog('Start session initiated. Checking for QR or login...', 'success');
        fetchStatus();
      } else {
        addLog(`Start failed: ${data.error}`, 'error');
      }
    } catch (e: any) {
      addLog(`Request error: ${e.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Disconnect / Clear Auth
  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect, logout, and purge all credentials?')) return;
    setIsLoading(true);
    addLog('Sending request to disconnect and clear credentials...', 'info');
    try {
      const res = await fetch('/api/whatsapp/session', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        addLog('Disconnected successfully. Session reset.', 'success');
        fetchStatus();
      } else {
        addLog(`Disconnect failed: ${data.error}`, 'error');
      }
    } catch (e: any) {
      addLog(`Request error: ${e.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Send Test Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendTo.trim() || !sendMessageText.trim()) return;

    setIsSending(true);
    setSendResult(null);
    addLog(`Attempting to send test message to ${sendTo}...`, 'info');

    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: sendTo.replace(/[^0-9]/g, ''),
          content: sendMessageText
        })
      });
      const data = await res.json();

      if (data.success) {
        addLog(`Message successfully transmitted to ${sendTo}!`, 'success');
        setSendResult({ success: true, message: 'Message sent successfully!' });
        setSendMessageText('');
      } else {
        addLog(`Transmission failed: ${data.error}`, 'error');
        setSendResult({ success: false, message: data.error || 'Failed to send message.' });
      }
    } catch (e: any) {
      addLog(`Send error: ${e.message}`, 'error');
      setSendResult({ success: false, message: e.message });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 p-6 md:p-12 font-sans selection:bg-purple-500/30 selection:text-purple-200">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Link href="/client" className="text-slate-400 hover:text-slate-200 transition">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent tracking-tight">
                WhatsApp Channel Diagnostic & Testing Console
              </h1>
            </div>
            <p className="text-sm text-slate-400 font-medium">
              Diagnostics utility for checking WhatsApp state machine, connection logs, and manual message routing.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => fetchStatus()}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Status & Controls Panel */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Status Panel Card */}
            <div className="bg-[#1e293b] border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                  <Activity className="h-4 w-4 text-purple-400" />
                  <span>Session Live Parameters</span>
                </h3>
                <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-inner ${
                  status === 'connected' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  status === 'connecting' || status === 'scanning' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse' :
                  'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}>
                  {status}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Linked Phone Number</span>
                  <p className="text-sm font-mono font-bold text-slate-200">
                    {phoneNumber ? `+${phoneNumber}` : 'None Linked'}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500">WhatsApp Profile Name</span>
                  <p className="text-sm font-bold text-slate-200">
                    {displayName || 'N/A'}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Consecutive Reconnect Attempts</span>
                  <p className="text-sm font-mono font-bold text-slate-200">
                    {reconnectAttempts}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Last Close Status Code</span>
                  <p className="text-sm font-mono font-bold text-slate-200">
                    {lastStatusCode !== null ? lastStatusCode : 'N/A'}
                  </p>
                </div>
              </div>

              {lastError && (
                <div className="bg-rose-500/5 border border-rose-500/20 p-4 rounded-xl flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-rose-300">Server Disconnect Detail</p>
                    <p className="text-xs font-mono text-rose-400 leading-relaxed break-all">{lastError}</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <button
                  onClick={handleStartSession}
                  disabled={isLoading || status === 'connected'}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white font-extrabold h-12 rounded-2xl transition cursor-pointer text-xs shadow-lg shadow-purple-500/10"
                >
                  <Play className="h-4 w-4" />
                  <span>Start WhatsApp Session</span>
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={isLoading || status === 'disconnected'}
                  className="flex-1 flex items-center justify-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-50 text-rose-400 border border-rose-500/20 font-extrabold h-12 rounded-2xl transition cursor-pointer text-xs"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Force Disconnect & Purge</span>
                </button>
              </div>
            </div>

            {/* Test Send Message Card */}
            <div className="bg-[#1e293b] border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
              <h3 className="text-sm font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                <Send className="h-4 w-4 text-indigo-400" />
                <span>Transmit Test Message</span>
              </h3>

              <form onSubmit={handleSendMessage} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Recipient JID/Phone</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 923001234567"
                      value={sendTo}
                      onChange={(e) => setSendTo(e.target.value)}
                      className="w-full h-11 bg-slate-900 border border-slate-800 rounded-xl px-4 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Message Content</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Type test message text..."
                        value={sendMessageText}
                        onChange={(e) => setSendMessageText(e.target.value)}
                        className="flex-1 h-11 bg-slate-900 border border-slate-800 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                      <button
                        type="submit"
                        disabled={isSending || status !== 'connected' || !sendTo || !sendMessageText}
                        className="h-11 px-5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-extrabold rounded-xl transition cursor-pointer text-xs flex items-center gap-2"
                      >
                        {isSending ? <RefreshCw className="h-4.5 w-4.5 animate-spin" /> : <Send className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </form>

              {status !== 'connected' && (
                <p className="text-[10px] text-amber-400 font-bold flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  <span>Testing transmission is disabled until the session status is CONNECTED.</span>
                </p>
              )}

              {sendResult && (
                <div className={`p-4 rounded-xl flex items-start gap-3 border ${
                  sendResult.success ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/5 border-rose-500/20 text-rose-400'
                }`}>
                  {sendResult.success ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold">{sendResult.success ? 'Success' : 'Error'}</p>
                    <p className="text-xs">{sendResult.message}</p>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Sidebar QR & Console Output */}
          <div className="space-y-8">
            
            {/* QR Scanner Screen */}
            <div className="bg-[#1e293b] border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col items-center justify-center text-center min-h-[350px]">
              {status === 'scanning' && qrCode ? (
                <div className="space-y-6 w-full flex flex-col items-center">
                  <div className="bg-white p-4 rounded-2xl relative inline-block shadow-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrCode} alt="QR Code" className="w-56 h-56 rounded-lg" />
                    
                    {/* Countdown indicator overlay */}
                    <div className={`absolute -top-3 -right-3 text-[10px] font-black px-2 py-1 rounded-full shadow ${
                      qrSecondsLeft > 10 ? 'bg-emerald-500 text-white' :
                      qrSecondsLeft > 5 ? 'bg-amber-500 text-white' :
                      'bg-rose-500 text-white'
                    }`}>
                      {qrSecondsLeft}s left
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="text-sm font-bold text-slate-200">Scan QR Code</h4>
                    <p className="text-[11px] text-slate-400 max-w-[220px] mx-auto leading-relaxed">
                      Scan via WhatsApp on your phone under Settings → Linked Devices → Link a Device.
                    </p>
                  </div>
                </div>
              ) : status === 'connecting' || status === 'waiting_qr' ? (
                <div className="space-y-4">
                  <RefreshCw className="h-10 w-10 text-purple-500 animate-spin mx-auto" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-300">Initializing Socket</h4>
                    <p className="text-[10px] text-slate-500 max-w-[180px]">
                      Awaiting response from Baileys connection handler...
                    </p>
                  </div>
                </div>
              ) : status === 'connected' ? (
                <div className="space-y-4">
                  <div className="mx-auto bg-emerald-500/10 p-5 rounded-full border border-emerald-500/20 w-max shadow-inner">
                    <CheckCircle2 className="h-12 w-12 text-emerald-400" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-extrabold text-slate-200">Session Linked</h4>
                    <p className="text-[10px] text-emerald-400 font-bold">
                      Connection active and listening.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="mx-auto bg-slate-900 p-5 rounded-full border border-slate-800 w-max">
                    <QrCode className="h-10 w-10 text-slate-500" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-300">No Session Active</h4>
                    <p className="text-[10px] text-slate-500 max-w-[180px]">
                      Click &ldquo;Start WhatsApp Session&rdquo; to fetch a QR code.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Simulated Live Console Logs */}
            <div className="bg-[#0b0f19] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 flex flex-col h-[320px]">
              <div className="flex items-center justify-between shrink-0 border-b border-slate-800 pb-3">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                  <Terminal className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Real-time Log Trace</span>
                </h4>
                <button
                  onClick={() => setLogs([])}
                  className="text-[10px] text-slate-500 hover:text-slate-300 hover:underline font-bold transition cursor-pointer"
                >
                  Clear Logs
                </button>
              </div>

              <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-2.5 pr-2 scrollbar-thin">
                {logs.length === 0 ? (
                  <p className="text-slate-600 italic">No logs recorded yet.</p>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="leading-normal flex gap-2">
                      <span className="text-slate-600 shrink-0 select-none">[{log.timestamp}]</span>
                      <span className={`break-all ${
                        log.type === 'success' ? 'text-emerald-400 font-bold' :
                        log.type === 'warn' ? 'text-amber-400' :
                        log.type === 'error' ? 'text-rose-400 font-bold' :
                        'text-slate-300'
                      }`}>
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
