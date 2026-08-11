import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { DB } from "@/lib/db";

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/debug-llm
 * Tests what API keys are visible to Railway and executes a live test call.
 */
export async function GET(req: NextRequest) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY || "";
  const deepseekKey = process.env.DEEPSEEK_API_KEY || "";
  const openrouterKey = process.env.OPENROUTER_API_KEY || "";

  const config = await DB.getConfig('t-1004');

  const report: any = {
    env_keys_present: {
      ANTHROPIC_API_KEY: anthropicKey ? `Present (starts with ${anthropicKey.substring(0, 10)}...)` : "MISSING",
      DEEPSEEK_API_KEY: deepseekKey ? `Present (starts with ${deepseekKey.substring(0, 10)}...)` : "MISSING",
      OPENROUTER_API_KEY: openrouterKey ? `Present (starts with ${openrouterKey.substring(0, 10)}...)` : "MISSING",
    },
    config_system_prompt: config.systemPrompt ? config.systemPrompt.substring(0, 50) + "..." : "EMPTY",
    test_result: null
  };

  const keyToTest = anthropicKey || deepseekKey || openrouterKey;
  if (!keyToTest) {
    report.test_result = "❌ NO API KEY IS CONFIGURED ON RAILWAY";
    return NextResponse.json(report);
  }

  if (deepseekKey) {
    try {
      console.log(`[debug-llm] Trying DeepSeek...`);
      const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${deepseekKey.trim()}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{ role: "user", content: "Say hello" }],
          max_tokens: 50
        })
      });
      const data = await res.json();
      report.test_result = {
        status: res.ok ? "SUCCESS" : "ERROR",
        status_code: res.status,
        response: data
      };
      return NextResponse.json(report);
    } catch (e: any) {
      report.test_result = {
        status: "ERROR",
        error_message: e.message
      };
      return NextResponse.json(report);
    }
  }

  if (anthropicKey) {
    try {
      const anthropic = new Anthropic({ apiKey: anthropicKey.trim() });
      const anthropicModels = [
        "claude-sonnet-4-6",
        "claude-haiku-4-5-20251001",
        "claude-sonnet-4-5-20250929",
        "claude-opus-4-6",
        "claude-3-5-sonnet-20241022",
        "claude-3-haiku-20240307"
      ];
      let lastError: any = null;
      for (const model of anthropicModels) {
        try {
          console.log(`[debug-llm] Trying ${model}...`);
          const res = await anthropic.messages.create({
            model: model,
            max_tokens: 50,
            messages: [{ role: "user", content: "Say hello" }]
          });
          report.test_result = {
            status: "SUCCESS",
            model_used: model,
            response: res.content[0]
          };
          return NextResponse.json(report);
        } catch (e: any) {
          lastError = e;
        }
      }
      throw lastError;
    } catch (err: any) {
      report.test_result = {
        status: "ERROR",
        error_message: err.message,
        status_code: err.status || err.statusCode,
        error_body: err.error || err
      };
    }
  }

  return NextResponse.json(report);
}
