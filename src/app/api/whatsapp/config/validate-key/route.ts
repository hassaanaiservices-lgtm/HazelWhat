import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json();

    if (!apiKey || !apiKey.trim()) {
      return NextResponse.json({ success: false, status: "Not Configured", error: "API Key is empty." });
    }

    const key = apiKey.trim();
    const isOpenRouter = key.startsWith("sk-or-");
    
    const anthropic = new Anthropic({
      apiKey: key,
      ...(isOpenRouter ? {
        baseURL: "https://openrouter.ai/api",
        defaultHeaders: {
          "HTTP-Referer": "https://hazeldid.com",
          "X-Title": "HazelWhat"
        }
      } : {})
    });

    const modelName = isOpenRouter ? "anthropic/claude-haiku-4.5" : "claude-haiku-4-5-20251001";

    try {
      await anthropic.messages.create({
        model: modelName,
        max_tokens: 1,
        messages: [{ role: "user", content: "test" }]
      });

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
