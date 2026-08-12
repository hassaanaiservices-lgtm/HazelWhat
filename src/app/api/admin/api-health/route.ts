import { requireAdminSession } from "@/lib/auth-session";
import { NextRequest, NextResponse } from "next/server";
import { DB } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await requireAdminSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const deepgramKey = process.env.DEEPGRAM_API_KEY || "";
    const openaiKey = process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY || "";

    let deepgramStatus = { ok: true, status: 'ok', message: 'Deepgram API Key is active & operational.' };
    let llmStatus = { ok: true, status: 'ok', message: 'Conversational LLM API Key is active & operational.' };

    // 1. Live Check Deepgram API Key
    if (!deepgramKey || !deepgramKey.trim() || deepgramKey.startsWith("dg_live_")) {
      deepgramStatus = {
        ok: false,
        status: 'missing',
        message: 'No Deepgram API Key configured in backend environment variables.'
      };
    } else {
      try {
        const dgRes = await fetch("https://api.deepgram.com/v1/projects", {
          headers: { "Authorization": `Token ${deepgramKey.trim()}` },
          signal: AbortSignal.timeout(5000)
        });
        if (dgRes.status === 401) {
          deepgramStatus = { ok: false, status: 'invalid_key', message: 'Deepgram API Key is invalid or expired (401 Unauthorized).' };
          await DB.recordApiAlert('Deepgram', 'invalid_key', deepgramStatus.message);
        } else if (dgRes.status === 402) {
          deepgramStatus = { ok: false, status: 'balance_low', message: 'Deepgram balance is 0 or credits expired (402 Insufficient Balance).' };
          await DB.recordApiAlert('Deepgram', 'balance_low', deepgramStatus.message);
        } else if (!dgRes.ok) {
          const text = await dgRes.text();
          deepgramStatus = { ok: false, status: 'error', message: `Deepgram API Error (${dgRes.status}): ${text.substring(0, 80)}` };
        }
      } catch (e: any) {
        deepgramStatus = { ok: false, status: 'error', message: `Deepgram ping failed: ${e.message}` };
      }
    }

    // 2. Live Check LLM API Key
    if (!openaiKey || !openaiKey.trim()) {
      llmStatus = {
        ok: false,
        status: 'missing',
        message: 'No LLM API Key (OPENAI_API_KEY / DEEPSEEK_API_KEY) configured in backend.'
      };
    } else {
      try {
        const isDeepSeek = openaiKey.startsWith("sk-") && !openaiKey.startsWith("sk-proj-");
        const url = isDeepSeek ? "https://api.deepseek.com/models" : "https://api.openai.com/v1/models";
        const llmRes = await fetch(url, {
          headers: { "Authorization": `Bearer ${openaiKey.trim()}` },
          signal: AbortSignal.timeout(5000)
        });
        if (llmRes.status === 401) {
          llmStatus = { ok: false, status: 'invalid_key', message: 'Conversational LLM API Key is invalid or expired (401 Unauthorized).' };
          await DB.recordApiAlert('Conversational LLM', 'invalid_key', llmStatus.message);
        } else if (llmRes.status === 402 || llmRes.status === 429) {
          llmStatus = { ok: false, status: 'quota_exceeded', message: 'LLM API Quota Exceeded / Insufficient Balance (402/429).' };
          await DB.recordApiAlert('Conversational LLM', 'quota_exceeded', llmStatus.message);
        } else if (!llmRes.ok) {
          const text = await llmRes.text();
          llmStatus = { ok: false, status: 'error', message: `LLM API Error (${llmRes.status}): ${text.substring(0, 80)}` };
        }
      } catch (e: any) {
        llmStatus = { ok: false, status: 'error', message: `LLM ping failed: ${e.message}` };
      }
    }

    const alerts = await DB.getApiAlerts();

    let circuits = {};
    try {
      const { getAllCircuitStatuses } = await import("@/lib/ai-handler");
      circuits = getAllCircuitStatuses();
    } catch (e) {}

    return NextResponse.json({
      success: true,
      deepgram: deepgramStatus,
      llm: llmStatus,
      circuits,
      alerts
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
