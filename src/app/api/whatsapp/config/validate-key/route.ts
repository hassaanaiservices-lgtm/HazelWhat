import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { detectKeyType } from "@/lib/ai-handler";
import { requireTenantSession } from "@/lib/auth-session";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await requireTenantSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { apiKey } = await request.json();

    if (!apiKey || !apiKey.trim()) {
      return NextResponse.json({ success: false, status: "Not Configured", error: "API Key is empty." });
    }

    const key = apiKey.trim();
    const keyType = detectKeyType(key);

    try {
      if (keyType === "anthropic") {
        const anthropic = new Anthropic({ apiKey: key });
        await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1,
          messages: [{ role: "user", content: "test" }]
        });
      } else if (keyType === "openrouter") {
        const anthropic = new Anthropic({
          apiKey: key,
          baseURL: "https://openrouter.ai/api",
          defaultHeaders: {
            "HTTP-Referer": "https://hazeldid.com",
            "X-Title": "HazelWhat"
          }
        });
        await anthropic.messages.create({
          model: "anthropic/claude-haiku-4.5",
          max_tokens: 1,
          messages: [{ role: "user", content: "test" }]
        });
      } else if (keyType === "deepseek") {
        const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${key}`
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [{ role: "user", content: "test" }],
            max_tokens: 1
          })
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`DeepSeek API validation failed: ${errText}`);
        }
      } else {
        return NextResponse.json({ success: false, status: "Invalid", error: "Unsupported key format. Key must start with sk-ant-, sk-or-, or sk-." });
      }

      return NextResponse.json({ success: true, status: "Active" });
    } catch (err: any) {
      console.error("[API Key Validation Error]:", err.message || err);
      const errMsg = err.message || "";
      
      if (
        errMsg.toLowerCase().includes("credit balance") || 
        errMsg.toLowerCase().includes("insufficient") || 
        err.status === 400 && errMsg.toLowerCase().includes("credit")
      ) {
        return NextResponse.json({ success: false, status: "Out of Credits", error: "Credit balance is too low." });
      }

      if (errMsg.toLowerCase().includes("api key") || errMsg.toLowerCase().includes("unauthorized") || err.status === 401) {
        return NextResponse.json({ success: false, status: "Invalid", error: "Invalid API key." });
      }

      return NextResponse.json({ success: false, status: "Error", error: errMsg || "Connection failed." });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, status: "Error", error: err.message }, { status: 500 });
  }
}
