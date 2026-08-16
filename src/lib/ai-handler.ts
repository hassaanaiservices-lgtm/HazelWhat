import Anthropic from "@anthropic-ai/sdk";
import { WhatsAppManager } from "./whatsapp";
import { DB, DB_DIR, formatProductsToCatalog, ChatMessage } from "./db";
import dns from "dns";
import fs from "fs";
import path from "path";

dns.setDefaultResultOrder("ipv4first");

function getEnvKey(keyName: string): string {
  try {
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const parts = line.split("=");
        if (parts[0]?.trim() === keyName) {
          let val = parts.slice(1).join("=").trim();
          // Remove surrounding quotes if present
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1);
          }
          return val;
        }
      }
    }
  } catch (e) {
    console.error("Failed to read key dynamically from .env:", e);
  }
  return "";
}

function getApiKey(config: any): string {
  const keys = [
    // 1. Tenant-specific keys (configured in dashboard)
    config?.apiKey,
    config?.anthropicApiKey,
    config?.openaiApiKey,
    config?.openRouterApiKey,
    config?.deepgramApiKey,

    // 2. Global fallback environment variables
    process.env["DEEPSEEK_API_KEY"],
    getEnvKey("DEEPSEEK_API_KEY"),
    process.env["API_KEY"],
    getEnvKey("API_KEY"),
    process.env["ANTHROPIC_API_KEY"],
    getEnvKey("ANTHROPIC_API_KEY"),
    process.env["OPENAI_API_KEY"],
    getEnvKey("OPENAI_API_KEY"),
    process.env["OPENROUTER_API_KEY"],
    getEnvKey("OPENROUTER_API_KEY"),
    process.env["Api key"],
    getEnvKey("Api key"),
    process.env["Api_key"],
    process.env["api_key"],
    process.env["ApiKey"],
    process.env["apikey"],
    process.env["APIKEY"],
    getEnvKey("Api_key"),
    getEnvKey("api_key")
  ];

  for (const k of keys) {
    if (k && typeof k === "string" && k.trim()) {
      return k.trim();
    }
  }
  return "";
}

async function getDeepgramSettings(config: any): Promise<{ apiKey: string; voice: string }> {
  let apiKey = "";
  let voice = "aura-asteria-en";

  // Priority 1: Check Railway environment variable first
  const envKey = getEnvKey("DEEPGRAM_API_KEY") || process.env.DEEPGRAM_API_KEY || "";
  if (envKey && envKey.trim()) {
    apiKey = envKey.trim();
  }

  // Priority 2: Check tenant records for a valid custom Deepgram key (ignoring mock placeholders like dg_live_...)
  try {
    const tenants = (await DB.getTenants()) || [];
    for (const t of tenants) {
      if (t.deepgramVoice) voice = t.deepgramVoice;
      if (t.deepgramApiKey && t.deepgramApiKey.trim()) {
        const candidate = t.deepgramApiKey.trim();
        // Only override env key if tenant key is a real key (not auto-generated placeholder)
        if (!candidate.startsWith("dg_live_")) {
          apiKey = candidate;
          break;
        }
      }
    }
  } catch (e) {
    console.error("[Deepgram Settings] Error reading tenants:", e);
  }

  // Legacy fallback: config.deepgramApiKey
  if (!apiKey && config.deepgramApiKey && config.deepgramApiKey.trim() && !config.deepgramApiKey.startsWith("dg_live_")) {
    apiKey = config.deepgramApiKey.trim();
  }
  if (config.deepgramVoice) voice = config.deepgramVoice;

  console.log(`[Deepgram Settings] Key found: ${apiKey ? "YES (" + apiKey.substring(0, 8) + "...)" : "NO KEY CONFIGURED"}, Voice: ${voice}`);
  return { apiKey, voice };
}

async function transcribeAudioWithDeepgram(buffer: Buffer, apiKey: string, mimetype = "audio/ogg"): Promise<string> {
  if (!apiKey || !apiKey.trim()) {
    console.warn("[Deepgram STT] Deepgram API key is missing.");
    return "";
  }
  try {
    const cleanMime = (mimetype || "audio/ogg").split(';')[0].trim() || "audio/ogg";
    console.log(`[Deepgram STT] Transcribing ${buffer.length} bytes of audio (${cleanMime})...`);
    
    // Primary attempt: model=nova-2 with detect_language=true & smart_format=true & punctuate=true
    let res = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&detect_language=true&smart_format=true&punctuate=true", {
      method: "POST",
      headers: {
        "Authorization": `Token ${apiKey.trim()}`,
        "Content-Type": cleanMime
      },
      body: new Uint8Array(buffer)
    });

    // Secondary attempt: Fallback with explicit language=ur support or general model
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Deepgram STT] First attempt error (${res.status}):`, errText);
      res = await fetch("https://api.deepgram.com/v1/listen?model=general&language=ur&smart_format=true&punctuate=true", {
        method: "POST",
        headers: {
          "Authorization": `Token ${apiKey.trim()}`,
          "Content-Type": "application/octet-stream"
        },
        body: new Uint8Array(buffer)
      });
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Deepgram STT] API error (${res.status}):`, errText);
      return "";
    }

    const data = await res.json();
    const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
    console.log(`[Deepgram STT] Transcribed text: "${transcript}"`);
    return transcript;
  } catch (err) {
    console.error("[Deepgram STT] Exception during transcription:", err);
    return "";
  }
}


async function transcribeAudioWithOpenAI(buffer: Buffer, apiKey: string, mimetype = "audio/ogg"): Promise<string> {
  if (!apiKey || !apiKey.trim() || !apiKey.startsWith("sk-")) return "";
  try {
    const extension = mimetype.includes("mp4") ? "mp4" : mimetype.includes("mpeg") ? "mp3" : "ogg";
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: mimetype });
    formData.append("file", blob, `voice_note.${extension}`);
    formData.append("model", "whisper-1");

    console.log(`[Whisper STT] Transcribing ${buffer.length} bytes of audio via OpenAI Whisper...`);
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey.trim()}`
      },
      body: formData
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Whisper STT] API error (${res.status}):`, errText);
      return "";
    }

    const data = await res.json();
    const transcript = data?.text || "";
    console.log(`[Whisper STT] Successfully transcribed audio: "${transcript}"`);
    return transcript;
  } catch (err) {
    console.error("[Whisper STT] Exception during transcription:", err);
    return "";
  }
}

export function detectKeyType(key: string): "anthropic" | "openrouter" | "deepseek" | "unknown" {
  if (!key) return "unknown";
  const trimmed = key.trim();
  if (trimmed.startsWith("sk-ant-")) {
    return "anthropic";
  }
  if (trimmed.startsWith("sk-or-")) {
    return "openrouter";
  }
  if (trimmed.startsWith("sk-")) {
    return "deepseek";
  }
  return "unknown";
}

function convertAnthropicMessagesToOpenAi(messages: any[], systemPrompt?: string): any[] {
  const result: any[] = [];
  if (systemPrompt) {
    result.push({ role: "system", content: systemPrompt });
  }

  for (const msg of messages) {
    const role = msg.role;
    let content = msg.content;
    let toolCalls: any[] | undefined = undefined;

    if (Array.isArray(content)) {
      const openAiContent: any[] = [];
      const toolResults: any[] = [];

      for (const block of content) {
        if (block.type === "text") {
          openAiContent.push({ type: "text", text: block.text });
        } else if (block.type === "image") {
          const mimeType = block.source?.media_type || "image/jpeg";
          const base64Data = block.source?.data;
          openAiContent.push({
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64Data}` }
          });
        } else if (block.type === "tool_use") {
          if (!toolCalls) toolCalls = [];
          toolCalls.push({
            id: block.id,
            type: "function",
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input)
            }
          });
        } else if (block.type === "tool_result") {
          toolResults.push({
            role: "tool",
            tool_call_id: block.tool_use_id,
            content: typeof block.content === "string" ? block.content : JSON.stringify(block.content)
          });
        }
      }

      if (role === "assistant") {
        result.push({
          role: "assistant",
          content: openAiContent.length > 0 ? openAiContent.map(c => c.text).join("\n") : null,
          tool_calls: toolCalls
        });
      } else if (role === "user") {
        if (toolResults.length > 0) {
          for (const tr of toolResults) {
            result.push(tr);
          }
        } else {
          result.push({
            role: "user",
            content: openAiContent.length === 1 && openAiContent[0].type === "text" ? openAiContent[0].text : openAiContent
          });
        }
      }
    } else if (typeof content === "string") {
      result.push({ role, content });
    }
  }

  return result;
}

function convertAnthropicToolsToOpenAi(tools: any[]): any[] {
  if (!tools) return [];
  return tools.map(tool => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema
    }
  }));
}

function sanitizeLlmResponseText(text: string): string {
  if (!text || typeof text !== 'string') return "";

  // 1. Remove <think>...</think> blocks completely (DeepSeek reasoning)
  let clean = text.replace(/<think>[\s\S]*?<\/think>/gi, "");

  // 2. Remove incomplete <think> tags (if response was cut off mid-reasoning)
  clean = clean.replace(/<think>[\s\S]*/gi, "");

  // 3. Remove standalone reasoning/internal monologue sentences from DeepSeek
  const reasoningPatterns = [
    /^Let me check.*$/gim,
    /^Actually,? (?:there's|looking|I|the).*$/gim,
    /^Hmm,? (?:but|let|the|I).*$/gim,
    /^Wait[,!\- ]+.*$/gim,
    /^Since there's no.*$/gim,
    /^I (?:don't see|need to|should|will).*(?:message|check|analyze|review|look).*$/gim,
    /^The conversation (?:appears|seems|history).*$/gim,
    /^Looking at (?:the|this).*$/gim,
    /^OK(?:ay)?,? (?:so|let|the|I).*$/gim,
    /^Now,? (?:let me|I'll|the).*$/gim,
    /^First,? (?:let me|I'll|I need).*$/gim,
    /^Based on (?:the system prompt|my instructions|the catalog).*$/gim,
    /^The user (?:is asking|wants|said|seems).*$/gim,
    /^I (?:see|notice) (?:that |the ).*$/gim,
    /^So (?:the user|I should|let me).*$/gim,
  ];

  for (const pattern of reasoningPatterns) {
    clean = clean.replace(pattern, "");
  }

  // 4. Remove any remaining lines that look like internal reasoning (starts with analysis language)
  clean = clean.split('\n').filter(line => {
    const trimmed = line.trim();
    // Keep empty lines (they become paragraph breaks)
    if (!trimmed) return true;
    // Remove lines that are pure reasoning
    if (/^(Alright|OK|Okay|Hmm|Wait|Let me|Actually|Now|First|So|Based on|Looking|I see|I notice|I need|I should|I will|The user|The conversation|Since there)/i.test(trimmed)) {
      // But keep if it contains customer-facing content (emoji, pricing, product names)
      if (/[🍕🔥✨😊👋❤️💰]/.test(trimmed) || /Rs\.?\s?\d/.test(trimmed) || /\d{3,}/.test(trimmed)) return true;
      return false;
    }
    return true;
  }).join('\n');

  clean = clean.replace(/\n{3,}/g, "\n\n").trim();
  return clean;
}

function convertOpenAiResponseToAnthropic(message: any): any[] {
  const content: any[] = [];
  if (message.content) {
    const cleanedText = sanitizeLlmResponseText(message.content);
    if (cleanedText) {
      content.push({ type: "text", text: cleanedText });
    }
  }
  if (message.tool_calls) {
    for (const tc of message.tool_calls) {
      let parsedInput = {};
      try {
        parsedInput = JSON.parse(tc.function.arguments);
      } catch (e) {
        console.error("Failed to parse tool call arguments:", tc.function.arguments);
      }
      content.push({
        type: "tool_use",
        id: tc.id,
        name: tc.function.name,
        input: parsedInput
      });
    }
  }
  return content;
}

export class ProviderError extends Error {
  status?: number;
  provider: string;
  rawError?: any;

  constructor(message: string, status?: number, provider = "unknown", rawError?: any) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
    this.provider = provider;
    this.rawError = rawError;
  }
}

export function isRetryableProviderError(err: unknown): boolean {
  if (!err) return false;

  // 1. Anthropic SDK explicit error classes
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return false;
  }

  if (
    err instanceof Anthropic.RateLimitError ||
    err instanceof Anthropic.InternalServerError ||
    err instanceof Anthropic.APIConnectionError ||
    err instanceof Anthropic.APIConnectionTimeoutError
  ) {
    return true;
  }

  // 2. Status code extraction
  let status: number | undefined = undefined;
  if (err instanceof Anthropic.APIError) {
    status = err.status;
  } else if (err instanceof ProviderError) {
    status = err.status;
  } else if (typeof (err as any)?.status === "number") {
    status = (err as any).status;
  } else if (typeof (err as any)?.statusCode === "number") {
    status = (err as any).statusCode;
  } else if (typeof (err as any)?.response?.status === "number") {
    status = (err as any).response.status;
  }

  if (status === 401 || status === 402 || status === 403) {
    return false;
  }

  // 3. Inspect message content for permanent error indicators
  let messageStr = "";
  if (err instanceof Error) {
    messageStr = err.message;
  } else if (typeof err === "string") {
    messageStr = err;
  } else {
    messageStr = JSON.stringify(err);
  }
  const msg = messageStr.toLowerCase();

  const nonRetryableKeywords = [
    "invalid api key",
    "invalid_api_key",
    "authentication_error",
    "invalid key",
    "incorrect api key",
    "insufficient_quota",
    "insufficient balance",
    "insufficient credits",
    "insufficient credit",
    "quota exceeded",
    "out of credits",
    "credit balance",
    "payment required",
    "billing",
    "account deactivated",
    "disabled account",
    "unauthorized",
    "permission denied"
  ];

  for (const keyword of nonRetryableKeywords) {
    if (msg.includes(keyword)) {
      return false;
    }
  }

  // Explicit retryable status codes: 429, 500, 502, 503, 529
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 529) {
    return true;
  }

  if (
    msg.includes("timeout") ||
    msg.includes("fetch failed") ||
    msg.includes("network error") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("rate limit") ||
    msg.includes("overloaded")
  ) {
    return true;
  }

  // HTTP 4xx client errors (except 429) are generally non-retryable
  // BUT: context-length 400 errors are input errors, not provider failures - don't open circuit
  if (typeof status === "number" && status >= 400 && status < 500 && status !== 429) {
    if (msg.includes("context length") || msg.includes("maximum context") || msg.includes("context window") || msg.includes("too many tokens")) {
      return true; // Retryable - just a prompt that was too long, not a provider issue
    }
    return false;
  }

  return true;
}

export type LLMProviderName = "deepseek" | "anthropic" | "openrouter";

export interface CircuitState {
  provider: LLMProviderName;
  state: "closed" | "open" | "half-open";
  consecutiveFailures: number;
  lastFailureTime: number;
  lastErrorReason: string;
}

export const CIRCUIT_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

const providerCircuits: Record<LLMProviderName, CircuitState> = {
  deepseek: { provider: "deepseek", state: "closed", consecutiveFailures: 0, lastFailureTime: 0, lastErrorReason: "" },
  anthropic: { provider: "anthropic", state: "closed", consecutiveFailures: 0, lastFailureTime: 0, lastErrorReason: "" },
  openrouter: { provider: "openrouter", state: "closed", consecutiveFailures: 0, lastFailureTime: 0, lastErrorReason: "" }
};

export function getCircuitStatus(provider: LLMProviderName): CircuitState {
  const circuit = providerCircuits[provider] || {
    provider,
    state: "closed",
    consecutiveFailures: 0,
    lastFailureTime: 0,
    lastErrorReason: ""
  };

  // Check if open circuit cooldown has expired
  if (circuit.state === "open" && Date.now() - circuit.lastFailureTime >= CIRCUIT_COOLDOWN_MS) {
    circuit.state = "half-open";
    console.log(`[Circuit Breaker] ${provider.toUpperCase()} cooldown (15m) expired. Entering HALF-OPEN state for 1 test request.`);
  }

  return { ...circuit };
}

export function getAllCircuitStatuses(): Record<LLMProviderName, CircuitState> {
  return {
    deepseek: getCircuitStatus("deepseek"),
    anthropic: getCircuitStatus("anthropic"),
    openrouter: getCircuitStatus("openrouter")
  };
}

export function resetAllCircuits(): void {
  for (const provider of ["deepseek", "anthropic", "openrouter"] as LLMProviderName[]) {
    providerCircuits[provider].state = "closed";
    providerCircuits[provider].consecutiveFailures = 0;
    providerCircuits[provider].lastFailureTime = 0;
    providerCircuits[provider].lastErrorReason = "";
  }
  console.log("🔄 [Circuit Breaker] All circuits manually RESET to CLOSED state.");
}

export function isProviderAvailable(provider: LLMProviderName): boolean {
  const status = getCircuitStatus(provider);
  return status.state === "closed" || status.state === "half-open";
}

export function recordProviderSuccess(provider: LLMProviderName): void {
  const circuit = providerCircuits[provider];
  if (!circuit) return;

  if (circuit.state === "open" || circuit.state === "half-open") {
    console.log(`🟢 [PROVIDER RECOVERED] ${provider.toUpperCase()} operations resumed. Circuit CLOSED.`);
    DB.recordApiAlert(`${provider.toUpperCase()} LLM`, "circuit_closed", `${provider.toUpperCase()} provider recovered and circuit closed.`);
  }

  circuit.state = "closed";
  circuit.consecutiveFailures = 0;
  circuit.lastErrorReason = "";
}

export function recordProviderFailure(provider: LLMProviderName, err: unknown): void {
  const circuit = providerCircuits[provider];
  if (!circuit) return;

  const isRetryable = isRetryableProviderError(err);
  const statusStr = (err as any)?.status ? ` (HTTP ${(err as any).status})` : "";
  const msgStr = (err as any)?.message || String(err);
  const reason = `${msgStr}${statusStr}`;

  circuit.consecutiveFailures++;
  circuit.lastErrorReason = reason;

  // Open circuit immediately on non-retryable errors (auth, bad key, zero balance)
  if (!isRetryable) {
    const wasOpen = circuit.state === "open";
    circuit.state = "open";
    circuit.lastFailureTime = Date.now();

    if (!wasOpen) {
      console.error(`🚨 [PROVIDER DOWN] ${provider.toUpperCase()} failed with non-retryable error: ${reason}. Circuit OPENED for 15 minutes.`);
      DB.recordApiAlert(`${provider.toUpperCase()} LLM`, "circuit_open", `Circuit OPENED for 15m due to non-retryable error: ${reason}`);
    }
  } else if (circuit.state === "half-open") {
    // Half-open test attempt failed -> re-open circuit
    circuit.state = "open";
    circuit.lastFailureTime = Date.now();
    console.error(`🚨 [PROVIDER DOWN] ${provider.toUpperCase()} half-open test failed: ${reason}. Circuit RE-OPENED for 15 minutes.`);
  }
}

export async function callLLMWithFallback(
  config: any,
  systemPrompt: string,
  messages: any[],
  tools: any[] = [],
  temperature: number = 0.7
): Promise<{ res: any; provider: string }> {
  const deepseekKey = config?.openaiApiKey || process.env.DEEPSEEK_API_KEY || getEnvKey("DEEPSEEK_API_KEY") || "";
  const anthropicKey = config?.anthropicApiKey || process.env.ANTHROPIC_API_KEY || getEnvKey("ANTHROPIC_API_KEY") || "";

  const deepseekAvailable = deepseekKey && isProviderAvailable("deepseek");
  const anthropicAvailable = anthropicKey && isProviderAvailable("anthropic");

  if (!deepseekAvailable && !anthropicAvailable) {
    const dsStatus = getCircuitStatus("deepseek");
    const antStatus = getCircuitStatus("anthropic");
    const errMsg = `All configured LLM providers are currently unavailable or circuit-open. ` +
      `(DeepSeek: ${dsStatus.state} - "${dsStatus.lastErrorReason || "No key"}", ` +
      `Anthropic: ${antStatus.state} - "${antStatus.lastErrorReason || "No key"})`;
    console.error(`[callLLMWithFallback] ${errMsg}`);
    throw new Error(errMsg);
  }

  if (deepseekAvailable) {
    try {
      console.log("[callLLMWithFallback] Attempting primary LLM (DeepSeek)...");
      const res = await callLLM(deepseekKey, systemPrompt, messages, tools, temperature);
      recordProviderSuccess("deepseek");
      console.log("[callLLMWithFallback] Provider used: deepseek");
      return { res, provider: "deepseek" };
    } catch (err: any) {
      console.error("[callLLMWithFallback] Primary LLM (DeepSeek) failed:", err.message || err);
      recordProviderFailure("deepseek", err);

      if (anthropicAvailable) {
        console.warn("[callLLMWithFallback] Falling back to backup LLM (Anthropic)...");
        try {
          const res = await callLLM(anthropicKey, systemPrompt, messages, tools, temperature);
          recordProviderSuccess("anthropic");
          console.log("[callLLMWithFallback] Provider used: anthropic-fallback");
          return { res, provider: "anthropic-fallback" };
        } catch (anthropicErr: any) {
          console.error("[callLLMWithFallback] Backup LLM (Anthropic) failed:", anthropicErr.message || anthropicErr);
          recordProviderFailure("anthropic", anthropicErr);
          throw anthropicErr;
        }
      }
      throw err;
    }
  } else if (anthropicAvailable) {
    console.log("[callLLMWithFallback] DeepSeek unavailable/circuit-open. Attempting Anthropic...");
    try {
      const res = await callLLM(anthropicKey, systemPrompt, messages, tools, temperature);
      recordProviderSuccess("anthropic");
      console.log("[callLLMWithFallback] Provider used: anthropic");
      return { res, provider: "anthropic" };
    } catch (err: any) {
      console.error("[callLLMWithFallback] Anthropic LLM failed:", err.message || err);
      recordProviderFailure("anthropic", err);
      throw err;
    }
  } else {
    throw new Error("No API keys configured or all providers circuit-open.");
  }
}

async function callLLM(
  apiKey: string,
  systemPrompt: string,
  messages: any[],
  tools: any[],
  temperature = 0.7
): Promise<{ content: any[] }> {
  const trimmed = apiKey.trim();
  const keyType = detectKeyType(trimmed);

  if (keyType === "anthropic") {
    const anthropic = new Anthropic({ apiKey: trimmed });
    const anthropicModels = [
      "claude-sonnet-4-6",
      "claude-3-5-sonnet-20241022",
      "claude-3-haiku-20240307"
    ];
    let lastErr: any = null;
    for (const model of anthropicModels) {
      try {
        console.log(`[callLLM] Attempting Anthropic model ${model}...`);
        const res = await anthropic.messages.create({
          model: model,
          max_tokens: 200,
          system: systemPrompt,
          messages: messages as any,
          tools: tools.length > 0 ? tools : undefined,
          temperature: temperature,
        });
        console.log(`[callLLM] Anthropic model ${model} SUCCESS!`);
        return res;
      } catch (err: any) {
        console.error(`[callLLM] Anthropic model ${model} error:`, err.message || err);
        lastErr = err;
        if (!isRetryableProviderError(err)) {
          console.warn(`[callLLM] Non-retryable Anthropic error (${err.status || err.message}). Stopping model fallback loop.`);
          break;
        }
      }
    }
    
    throw lastErr || new Error("Anthropic API call failed for all models.");
  } else if (keyType === "openrouter") {
    console.log(`[callLLM] Attempting OpenRouter API...`);
    const openAiMessages = convertAnthropicMessagesToOpenAi(messages, systemPrompt);
    const openAiTools = convertAnthropicToolsToOpenAi(tools);

    const cleanedMessages = openAiMessages.map(msg => {
      if (Array.isArray(msg.content)) {
        const textParts = [];
        for (const block of msg.content) {
          if (block.type === "text") {
            textParts.push(block.text);
          } else if (block.type === "image_url") {
            textParts.push("[Image Attachment]");
          }
        }
        return { ...msg, content: textParts.join("\n") || "[Attachment]" };
      }
      return msg;
    });

    const models = [
      "openrouter/auto",
      "deepseek/deepseek-chat",
      "google/gemini-2.0-flash-001",
      "openai/gpt-4o-mini",
      "meta-llama/llama-3.3-70b-instruct"
    ];

    let lastError: any = null;
    let errorDetails: string[] = [];

    for (const model of models) {
      try {
        console.log(`[callLLM] Attempting OpenRouter model ${model}...`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${trimmed}`,
            "HTTP-Referer": "https://hazeldid.com",
            "X-Title": "HazelWhat"
          },
          body: JSON.stringify({
            model: model,
            messages: cleanedMessages,
            tools: openAiTools.length > 0 ? openAiTools : undefined,
            max_tokens: 200,
            temperature: temperature
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const errText = await res.text();
          console.error(`[callLLM] OpenRouter model ${model} HTTP ${res.status}:`, errText);
          const msg = `OpenRouter (${model}) [HTTP ${res.status}]: ${errText}`;
          errorDetails.push(msg);
          lastError = new Error(msg);
          if (res.status === 401 || res.status === 402) {
            console.warn(`[callLLM] OpenRouter Auth/Billing error (${res.status}). Stopping model loop.`);
            break; 
          }
          continue;
        }

        const data = await res.json();
        const assistantMsg = data.choices?.[0]?.message;
        if (!assistantMsg) {
          throw new Error(`OpenRouter model ${model} returned empty choices`);
        }

        const anthropicContent: any[] = [];
        if (assistantMsg.content) {
          anthropicContent.push({ type: "text", text: assistantMsg.content });
        }
        if (assistantMsg.tool_calls) {
          for (const tc of assistantMsg.tool_calls) {
            let input = {};
            try { input = JSON.parse(tc.function.arguments || "{}"); } catch (e) {}
            anthropicContent.push({
              type: "tool_use",
              id: tc.id || `call_${Math.random().toString(36).substr(2, 9)}`,
              name: tc.function.name,
              input
            });
          }
        }

        return {
          id: data.id || `msg_${Math.random().toString(36).substr(2, 9)}`,
          type: "message",
          role: "assistant",
          content: anthropicContent,
          model: model,
          stop_reason: assistantMsg.tool_calls ? "tool_use" : "end_turn",
          usage: { input_tokens: data.usage?.prompt_tokens || 0, output_tokens: data.usage?.completion_tokens || 0 }
        } as any;
      } catch (err: any) {
        console.error(`[callLLM] OpenRouter model ${model} failed:`, err.message || err);
        lastError = err;
      }
    }
    throw lastError || new Error("OpenRouter models failed: " + (errorDetails.join(" | ") || "unknown error"));
  } else if (keyType === "deepseek") {
    console.log(`[callLLM] Attempting DeepSeek API...`);
    const openAiMessages = convertAnthropicMessagesToOpenAi(messages, systemPrompt);
    const openAiTools = convertAnthropicToolsToOpenAi(tools);

    const cleanedMessages = openAiMessages.map(msg => {
      if (Array.isArray(msg.content)) {
        const textParts = [];
        for (const block of msg.content) {
          if (block.type === "text") {
            textParts.push(block.text);
          } else if (block.type === "image_url") {
            textParts.push("[Image Attachment]");
          }
        }
        return {
          ...msg,
          content: textParts.join("\n") || "[Attachment]"
        };
      }
      return msg;
    });

    let attempts = 3;
    let res: Response | null = null;
    let lastError: any = null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        console.log(`[callLLM] DeepSeek API attempt ${attempt} of ${attempts}...`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        res = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${trimmed}`
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: cleanedMessages,
            tools: openAiTools.length > 0 ? openAiTools : undefined,
            max_tokens: 200,
            temperature: temperature
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const errText = await res.text();
          let jsonMsg = errText;
          try {
            const parsed = JSON.parse(errText);
            jsonMsg = parsed?.error?.message || parsed?.message || errText;
          } catch (e) {}
          throw new ProviderError(`DeepSeek API Error (${res.status}): ${jsonMsg}`, res.status, "deepseek", errText);
        }
        break;
      } catch (err: any) {
        console.error(`[callLLM] DeepSeek attempt ${attempt} failed:`, err.message || err);
        lastError = err;
        if (!isRetryableProviderError(err)) {
          console.warn(`[callLLM] Non-retryable DeepSeek error (${err.status || err.message}). Stopping retry loop immediately.`);
          break;
        }
        if (attempt < attempts) {
          const delay = attempt * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    if (!res || !res.ok) {
      throw lastError || new Error("DeepSeek API failed after all retries.");
    }

    const response = res as Response;
    const data = await response.json();
    if (!data.choices || data.choices.length === 0) {
      throw new Error("DeepSeek API returned an empty choices array.");
    }

    const choice = data.choices[0].message;
    const anthropicContent = convertOpenAiResponseToAnthropic(choice);
    return { content: anthropicContent };
  } else {
    throw new Error(`Unsupported API key type. Please provide a valid Anthropic, OpenRouter, or DeepSeek API key.`);
  }
}

function debugLog(msg: string) {
  try {
    const logPath = path.join(DB_DIR, "debug.log");
    if (!fs.existsSync(path.dirname(logPath))) {
      fs.mkdirSync(path.dirname(logPath), { recursive: true });
    }
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) {
    console.error(e);
  }
}

const MAX_DEDUPLICATION_CACHE = 1000;
const globalForDeduplication = global as unknown as {
  processedMessageIds: string[];
};

if (!globalForDeduplication.processedMessageIds) {
  globalForDeduplication.processedMessageIds = [];
}

function isDuplicateMessage(msgId: string): boolean {
  if (!msgId) return false;
  if (globalForDeduplication.processedMessageIds.includes(msgId)) {
    return true;
  }
  globalForDeduplication.processedMessageIds.push(msgId);
  if (globalForDeduplication.processedMessageIds.length > MAX_DEDUPLICATION_CACHE) {
    globalForDeduplication.processedMessageIds.shift();
  }
  return false;
}

interface LockQueue {
  promise: Promise<void>;
  pendingCount: number;
}

const customerLocks = new Map<string, LockQueue>();

interface HybridMatchResult {
  matched: boolean;
  reply?: string;
  source?: "sequential_flow" | "manual_keyword" | "knowledge_base_faq" | "product_catalog";
  image?: string;
  imageCaption?: string;
}

/**
 * Dynamic Hybrid Engine Router
 * Automatically derives keyword rules from Knowledge Base (productInfo/knowledgeBase) & Product Catalog (products).
 * Manages 0-token Sequential Chatbot Flows & instant rule-based responses.
 */
async function processHybridEngine(
  from: string,
  content: string,
  config: any,
  activeTenant: any,
  customer: any,
  tenantId: string
): Promise<HybridMatchResult> {
  const lowerContent = content.toLowerCase().trim();
  const products: any[] = (config.products && config.products.length > 0) ? config.products : (activeTenant?.products || []);
  const currency = activeTenant?.currency || config.storeCurrency || "PKR";

  // 1. LAYER 0: Sequential Chatbot Flow Machine
  const preferencesNote = customer?.preferences || "";
  const flowStateMatch = preferencesNote.match(/\[FLOW_STATE:\s*([A-Z_]+)(?::(.*))?\]/);
  
  if (flowStateMatch) {
    const currentState = flowStateMatch[1];
    const stateDataRaw = flowStateMatch[2] || "";
    let stateData: any = {};
    try { if (stateDataRaw) stateData = JSON.parse(stateDataRaw); } catch(e) {}

    // Global cancellation check for sequential flow
    if (["cancel", "exit", "stop", "menu", "main menu"].includes(lowerContent)) {
      const updatedNotes = preferencesNote.replace(/\[FLOW_STATE:[^\]]+\]/g, "").trim();
      await DB.updateCustomer(from, { preferences: updatedNotes }, tenantId);
      return {
        matched: true,
        reply: "Flow cancelled. How else can I assist you today?",
        source: "sequential_flow"
      };
    }

    if (currentState === "AWAITING_ORDER_SIZE") {
      const input = lowerContent;
      const variations = stateData.variations || [];
      let selectedVariant = null;

      const optionIndex = parseInt(input) - 1;
      if (!isNaN(optionIndex) && optionIndex >= 0 && optionIndex < variations.length) {
        selectedVariant = variations[optionIndex];
      } else {
        selectedVariant = variations.find((v: any) => input.includes(v.title.toLowerCase().trim()));
      }

      if (!selectedVariant) {
        let optionsText = "";
        variations.forEach((v: any, index: number) => {
          optionsText += `\n- *${index + 1}. ${v.title}* - ${currency} ${v.price}`;
        });
        return {
          matched: true,
          reply: `I didn't catch that size. Please reply with one of the numbers or size options:${optionsText}`,
          source: "sequential_flow"
        };
      }

      stateData.selectedSize = selectedVariant.title;
      stateData.price = selectedVariant.price;

      const newNote = preferencesNote.replace(/\[FLOW_STATE:[^\]]+\]/g, "").trim() + ` [FLOW_STATE: AWAITING_ORDER_NAME:${JSON.stringify(stateData)}]`;
      await DB.updateCustomer(from, { preferences: newNote }, tenantId);

      return {
        matched: true,
        reply: `Excellent! *${stateData.productName} (${selectedVariant.title})* selected. Price: ${selectedVariant.price}.\n\nTo place your order, please reply with your Full Name:`,
        source: "sequential_flow"
      };
    }

    if (currentState === "AWAITING_ORDER_NAME") {
      const name = content.trim();
      stateData.name = name;
      const newNote = preferencesNote.replace(/\[FLOW_STATE:[^\]]+\]/g, "").trim() + ` [FLOW_STATE: AWAITING_ORDER_ADDRESS:${JSON.stringify(stateData)}]`;
      await DB.updateCustomer(from, { name, preferences: newNote }, tenantId);
      return {
        matched: true,
        reply: `Thank you, ${name}! Please provide your complete delivery address (House/Street #, City).`,
        source: "sequential_flow"
      };
    }

    if (currentState === "AWAITING_ORDER_ADDRESS") {
      const address = content.trim();
      stateData.address = address;
      const newNote = preferencesNote.replace(/\[FLOW_STATE:[^\]]+\]/g, "").trim() + ` [FLOW_STATE: AWAITING_ORDER_PAYMENT:${JSON.stringify(stateData)}]`;
      await DB.updateCustomer(from, { preferences: newNote }, tenantId);
      return {
        matched: true,
        reply: `Address noted!\n\nHow would you like to pay?\n1. Cash on Delivery (COD)\n2. Online Transfer (JazzCash / EasyPaisa / Bank)\n\nPlease reply with 1 or 2.`,
        source: "sequential_flow"
      };
    }

    if (currentState === "AWAITING_ORDER_PAYMENT") {
      const input = lowerContent;
      let paymentMethod = "Cash on Delivery";
      if (input.includes("2") || input.includes("online") || input.includes("transfer") || input.includes("bank") || input.includes("jazz") || input.includes("easy")) {
        paymentMethod = "Online Transfer";
      }

      const productName = stateData.productName || "Product Order";
      const selectedSize = stateData.selectedSize || "";
      const finalProductName = selectedSize ? `${productName} (${selectedSize})` : productName;
      const customerName = stateData.name || customer?.name || "Customer";
      const deliveryAddress = stateData.address || "As provided";
      const finalPrice = stateData.price || "N/A";
      const productImageUrl = stateData.image || undefined;

      await DB.addOrder(from, {
        productName: finalProductName,
        customerName,
        deliveryAddress,
        paymentMethod,
        price: finalPrice,
        size: selectedSize || undefined,
        productImageUrl
      }, tenantId);

      const cleanedNote = preferencesNote.replace(/\[FLOW_STATE:[^\]]+\]/g, "").trim();
      await DB.updateCustomer(from, { 
        preferences: cleanedNote,
        followUpLevel: 999,
        leadStatus: "cold",
        pipelineStage: "completed"
      }, tenantId);

      return {
        matched: true,
        reply: `🎉 *Order Confirmed!*\n\n📦 *Item:* ${finalProductName}\n👤 *Name:* ${customerName}\n📍 *Address:* ${deliveryAddress}\n💳 *Payment:* ${paymentMethod}\n💰 *Total Price:* ${finalPrice}\n\nOur team will process your order shortly. Thank you!`,
        source: "sequential_flow"
      };
    }
  }

  // Check if user mentions any product in the catalog to start product-specific flow
  if (products.length > 0) {
    let matchedProduct = null;
    for (const prod of products) {
      if (!prod.title) continue;
      const titleLower = prod.title.toLowerCase().trim();
      if (lowerContent.includes(titleLower)) {
        matchedProduct = prod;
        break;
      }
    }

    if (matchedProduct) {
      const isOrderTrigger = ["order", "buy", "chahiye", "place order", "order now", "want"].some(w => lowerContent.includes(w)) || 
                            lowerContent === matchedProduct.title.toLowerCase().trim();

      if (isOrderTrigger) {
        const hasVariations = Array.isArray(matchedProduct.variations) && matchedProduct.variations.length > 0;
        if (hasVariations) {
          const stateData = { 
            productName: matchedProduct.title, 
            image: matchedProduct.image || null,
            variations: matchedProduct.variations 
          };
          const newNote = preferencesNote.replace(/\[FLOW_STATE:[^\]]+\]/g, "").trim() + ` [FLOW_STATE: AWAITING_ORDER_SIZE:${JSON.stringify(stateData)}]`;
          await DB.updateCustomer(from, { preferences: newNote }, tenantId);

          let optionsText = "";
          matchedProduct.variations.forEach((v: any, index: number) => {
            optionsText += `\n- *${index + 1}. ${v.title}* - ${currency} ${v.price}`;
          });

          return {
            matched: true,
            reply: `Yeh hai hamari *${matchedProduct.title}*! 🍕🔥\n\nKonsa size chahiye?${optionsText}\n\nSize batao, phir main aapka order confirm kar deta hoon! 😊`,
            image: matchedProduct.image && matchedProduct.image !== "N/A" ? matchedProduct.image : undefined,
            imageCaption: matchedProduct.title,
            source: "sequential_flow"
          };
        } else {
          const stateData = { 
            productName: matchedProduct.title,
            price: matchedProduct.price || "N/A",
            image: matchedProduct.image || null
          };
          const newNote = preferencesNote.replace(/\[FLOW_STATE:[^\]]+\]/g, "").trim() + ` [FLOW_STATE: AWAITING_ORDER_NAME:${JSON.stringify(stateData)}]`;
          await DB.updateCustomer(from, { preferences: newNote }, tenantId);

          return {
            matched: true,
            reply: `Great choice! You are ordering *${matchedProduct.title}* (${currency} ${matchedProduct.price || "N/A"}).\n\nTo place your order, please reply with your Full Name:`,
            image: matchedProduct.image && matchedProduct.image !== "N/A" ? matchedProduct.image : undefined,
            imageCaption: matchedProduct.title,
            source: "sequential_flow"
          };
        }
      }
    }
  }

  // Check for trigger words to initiate sequential order flow
  if (lowerContent === "order now" || lowerContent === "place order" || lowerContent === "buy now") {
    const stateData = { productName: "Product Inquiry" };
    const newNote = preferencesNote.replace(/\[FLOW_STATE:[^\]]+\]/g, "").trim() + ` [FLOW_STATE: AWAITING_ORDER_NAME:${JSON.stringify(stateData)}]`;
    await DB.updateCustomer(from, { preferences: newNote }, tenantId);
    return {
      matched: true,
      reply: "Great! To place your order, please reply with your Full Name:",
      source: "sequential_flow"
    };
  }

  // 2. SAFETY GUARD: Bypass rule engine for complex inquiries
  const isComplex = lowerContent.length > 130 || 
    (lowerContent.match(/\?/g) || []).length > 1 ||
    ["discount", "bargain", "complaint", "broken", "wrong", "cancel", "return my money", "faulty", "different"].some(w => lowerContent.includes(w));

  if (isComplex) {
    return { matched: false };
  }

  // 3. LAYER 1A: Manual Keyword Rules
  const manualMatch = config.keywordReplies?.find((k: any) => 
    k.keyword.trim() !== "" && lowerContent.includes(k.keyword.toLowerCase())
  );
  if (manualMatch) {
    return {
      matched: true,
      reply: manualMatch.reply,
      source: "manual_keyword"
    };
  }

  // 4. LAYER 1B: Auto-Derived Knowledge Base FAQ Indexer
  const kbText = [
    config.productInfo || "",
    activeTenant?.knowledgeBase || "",
    activeTenant?.productKnowledgeBase || ""
  ].filter(Boolean).join("\n");

  if (kbText) {
    const kbLines = kbText.split("\n");
    const faqEntries: { triggers: string[]; response: string }[] = [];

    kbLines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const headerMatch = trimmed.match(/^[-*#]*\s*(location|address|timing|working hours|opening hours|delivery fee|delivery charges|return policy|refund policy|payment methods|bank account|jazzcash|easypaisa|cod|cash on delivery):\s*(.*)$/i);
      
      if (headerMatch) {
        const key = headerMatch[1].toLowerCase();
        const value = headerMatch[2] || trimmed;
        
        let triggers: string[] = [];
        if (key.includes("location") || key.includes("address")) {
          triggers = ["location", "address", "dukaan kahan", "shop location", "address kya hai", "kahan h", "dukan kahan", "where is your shop"];
        } else if (key.includes("timing") || key.includes("hours") || key.includes("opening")) {
          triggers = ["timing", "time", "working hours", "opening time", "closing time", "kab khulti", "time kya hai", "open hours"];
        } else if (key.includes("delivery")) {
          triggers = ["delivery fee", "delivery charges", "delivery kitni", "delivery kitne", "shipping fee", "delivery rate"];
        } else if (key.includes("return") || key.includes("refund")) {
          triggers = ["return policy", "refund policy", "exchange policy", "wapas", "return kaise"];
        } else if (key.includes("payment") || key.includes("cod") || key.includes("bank") || key.includes("jazz") || key.includes("easy")) {
          triggers = ["payment method", "payment options", "jazzcash", "easypaisa", "bank account", "how to pay", "cod available"];
        }

        if (triggers.length > 0) {
          faqEntries.push({ triggers, response: value });
        }
      }
    });

    for (const faq of faqEntries) {
      if (faq.triggers.some(trig => lowerContent.includes(trig))) {
        return {
          matched: true,
          reply: faq.response,
          source: "knowledge_base_faq"
        };
      }
    }
  }

  // 5. LAYER 1C: Auto-Derived Product Catalog Indexer
  if (products.length > 0) {
    for (const prod of products) {
      if (!prod.title) continue;
      const titleLower = prod.title.toLowerCase().trim();
      
      // Match if user asks price or details for exact product
      const isProductMatch = lowerContent.includes(titleLower);
      const isPriceQuery = ["price", "rate", "kitne ka", "kitne ki", "cost", "details", "kitna"].some(w => lowerContent.includes(w));

      if (isProductMatch && (isPriceQuery || lowerContent === titleLower)) {
        let reply = `📦 *${prod.title}*\n💵 *Price:* ${currency} ${prod.price}`;
        if (prod.description) reply += `\n📝 ${prod.description}`;
        if (prod.link) reply += `\n🔗 *View Product:* ${prod.link}`;
        
        return {
          matched: true,
          reply,
          source: "product_catalog"
        };
      }
    }
  }

  return { matched: false };
}

export async function handleWhatsAppMessage(msg: any, inputTenantId?: string) {
  try {
    const remoteJid = msg?.key?.remoteJid;
    if (!remoteJid || remoteJid === "status@broadcast" || remoteJid.endsWith("@g.us") || remoteJid.endsWith("@newsletter")) {
      return;
    }
    const msgId = msg?.key?.id;
    if (msgId && isDuplicateMessage(msgId)) {
      console.log(`[AI Handler] Duplicate message ignored: ${msgId}`);
      debugLog(`Duplicate message ignored: ${msgId}`);
      return;
    }
    
    let from = msg.key.remoteJid;
    if (from?.includes("@lid")) {
      if (msg.key.remoteJidAlt) {
        from = msg.key.remoteJidAlt;
      } else {
        return; // Ignore ghost messages without real phone number
      }
    }
    from = from?.replace("@s.whatsapp.net", "");
    if (!from) return;

    // Acquire lock/queue for this customer phone number
    let queue = customerLocks.get(from);
    if (!queue) {
      queue = {
        promise: Promise.resolve(),
        pendingCount: 0
      };
      customerLocks.set(from, queue);
    }

    queue.pendingCount++;
    const previousPromise = queue.promise;
    let resolveLock: () => void;
    const currentPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    queue.promise = currentPromise;

    try {
      await previousPromise;
      await processWhatsAppMessage(msg, from, inputTenantId);
    } finally {
      resolveLock!();
      const currentQueue = customerLocks.get(from);
      if (currentQueue) {
        currentQueue.pendingCount--;
        if (currentQueue.pendingCount <= 0) {
          customerLocks.delete(from);
        }
      }
    }
  } catch (error) {
    console.error("[AI Handler] handleWhatsAppMessage outer error:", error);
  }
}

async function processWhatsAppMessage(msg: any, from: string, inputTenantId?: string) {
  try {
    const interactiveResponse = msg.message?.interactiveResponseMessage;
    let content = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || "";
    
    // Resolve Tenant ID early!
    let resolvedTenantId = inputTenantId || WhatsAppManager.getActiveTenantId() || undefined;
    if (!resolvedTenantId) {
      resolvedTenantId = (await WhatsAppManager.resolveActiveTenantFromSocket()) || undefined;
    }
    if (!resolvedTenantId && from) {
      const cust = await DB.getCustomer(from);
      if (cust?.tenantId && cust.tenantId !== 'admin') {
        resolvedTenantId = cust.tenantId;
      }
    }
    if (!resolvedTenantId) {
      console.error(`[AI Handler] Failed to resolve active tenant ID for message from ${from}. Dropping message.`);
      return;
    }

    if (interactiveResponse?.nativeFlowResponseMessage?.name === "quick_reply") {
      try {
        const params = JSON.parse(interactiveResponse.nativeFlowResponseMessage.paramsJson || "{}");
        if (params.id && params.id.startsWith("view_")) {
          const parts = params.id.split("_");
          const encodedLink = parts.slice(2).join("_");
          const link = encodedLink ? Buffer.from(encodedLink, 'base64').toString('utf-8') : "https://cutecoodle.com";
          
          console.log(`[AI Handler] View Product button clicked for ${link} by ${from}`);
          const reply = `Here is the direct link to view this product on our website: \n${link}`;
          await WhatsAppManager.sendMessage(from, reply);
          
          await DB.addChatMessage(from, { role: "user", content: `[Clicked View Product]` }, resolvedTenantId);
          await DB.addChatMessage(from, { role: "assistant", content: reply }, resolvedTenantId);
          return;
        }
        else if (params.id && params.id.startsWith("order_")) {
          const parts = params.id.split("_");
          const productName = parts.slice(2).join("_") || "Product";
          
          console.log(`[AI Handler] Order button clicked for ${productName} by ${from}`);
          
          const reply = `Great choice! To place an order for *${productName}*, I just need a few details:\n\n1. What size/color would you like?\n2. What is your delivery address?\n3. Please provide a contact phone number.\n\nYou can type your answers below!`;
          await WhatsAppManager.sendMessage(from, reply);
          
          await DB.addChatMessage(from, { role: "user", content: `[I want to order: ${productName}]` }, resolvedTenantId);
          await DB.addChatMessage(from, { role: "assistant", content: reply }, resolvedTenantId);
          return; 
        }
      } catch (e) {
        console.error("[AI Handler] Error parsing interactive response:", e);
      }
    }
    
    const hasImage = !!msg.message?.imageMessage;
    const hasAudio = !!msg.message?.audioMessage;
    
    if (!from || (!content && !hasImage && !hasAudio)) return;

    console.log(`[AI Handler] Received message from ${from}: ${content} (HasImage: ${hasImage}, HasAudio: ${hasAudio})`);

    let base64Image: string | null = null;
    let base64Audio: string | null = null;
    let audioBuffer: Buffer | null = null;
    let audioMime = "audio/ogg";

    if (hasImage) {
      console.log(`[AI Handler] Downloading incoming media for vision analysis...`);
      const buffer = await WhatsAppManager.downloadMedia(msg);
      if (buffer) {
        base64Image = buffer.toString('base64');
      }
    }

    if (hasAudio) {
      audioMime = msg.message?.audioMessage?.mimetype || "audio/ogg";
      console.log(`[AI Handler] Downloading incoming voice note / audio message (${audioMime})...`);
      audioBuffer = await WhatsAppManager.downloadMedia(msg);
      if (audioBuffer) {
        base64Audio = audioBuffer.toString('base64');
      }
    }

    const config = await DB.getConfig(resolvedTenantId);
    const { apiKey: deepgramApiKey } = await getDeepgramSettings(config);

    let voiceTranscript = "";
    if (hasAudio && audioBuffer) {
      console.log(`[AI Handler] Voice note detected. Audio buffer size: ${audioBuffer.length} bytes. Deepgram key configured: ${!!deepgramApiKey}`);
      
      // Step 1: Try Deepgram STT if key is configured
      if (deepgramApiKey) {
        voiceTranscript = await transcribeAudioWithDeepgram(audioBuffer, deepgramApiKey, audioMime);
        console.log(`[AI Handler] Deepgram STT result: "${voiceTranscript || "(empty)"}"`);
      }
      
      // Step 2: Try OpenAI Whisper if Deepgram failed — only with actual OpenAI keys
      if (!voiceTranscript) {
        const openaiKey = getEnvKey("OPENAI_API_KEY") || process.env.OPENAI_API_KEY || "";
        if (openaiKey && openaiKey.trim()) {
          voiceTranscript = await transcribeAudioWithOpenAI(audioBuffer, openaiKey.trim(), audioMime);
          console.log(`[AI Handler] OpenAI Whisper STT result: "${voiceTranscript || "(empty)"}"`);
        } else {
          console.log(`[AI Handler] No OpenAI key found for Whisper fallback. No Deepgram key either: ${!deepgramApiKey}`);
        }
      }
      
      if (voiceTranscript) {
        content = `[Customer Voice Note Transcribed]: "${voiceTranscript}"`;
        console.log(`[AI Handler] Voice transcribed successfully! Content set to: "${content}"`);
      } else if (!content) {
        content = "[Customer sent a Voice Note]: (The audio was unclear or silent. Politely ask the customer to resend their audio or specify what they need.)";
        console.log(`[AI Handler] STT yielded empty transcript — using polite clarification instruction for AI.`);
      }
    }

    const lowerContent = content.toLowerCase().trim();
    const optOutKeywords = ["stop", "unsubscribe", "optout", "opt out", "hatao", "mat bhejo", "cancel", "remove me", "donotdisturb"];
    const isOptOut = optOutKeywords.some(kw => lowerContent === kw || lowerContent.startsWith(kw + " "));

    if (isOptOut) {
      console.log(`[Opt-Out] Customer ${from} requested opt-out with text: "${content}"`);
      const existingCustomer = await DB.getCustomer(from, resolvedTenantId);
      const existingTags = existingCustomer?.tags || [];
      const updatedTags = Array.from(new Set([...existingTags.filter(t => t !== "revival-sent"), "opted-out"]));

      await DB.updateCustomer(from, {
        isOptedOut: true,
        optedOutAt: new Date().toISOString(),
        aiEnabled: false,
        tags: updatedTags
      }, resolvedTenantId);

      // Update active campaign if lead was part of it
      const activeCampaign = await DB.getActiveCampaign(resolvedTenantId);
      if (activeCampaign) {
        const optedOutList = Array.from(new Set([...(activeCampaign.optedOutPhones || []), from]));
        const progressMap = activeCampaign.leadProgress || {};
        if (progressMap[from]) {
          progressMap[from].status = "opted_out";
        }
        await DB.updateRevivalCampaign(activeCampaign.id, {
          optedOutPhones: optedOutList,
          leadProgress: progressMap
        }, resolvedTenantId);
      }

      await DB.addChatMessage(from, { role: "user", content }, resolvedTenantId);
      await WhatsAppManager.sendMessage(from, "You have been unsubscribed from promotional updates. Reply START to opt back in.");
      await DB.addChatMessage(from, { role: "assistant", content: "You have been unsubscribed from promotional updates. Reply START to opt back in." }, resolvedTenantId);
      return;
    }

    if (hasAudio) {
      const displayContent = voiceTranscript || content || "Hi! I sent a voice note inquiring about your products, pricing, and availability.";
      const userDisplay = `🎤 [Voice Note]: "${displayContent}"`;
      await DB.addChatMessage(from, { 
        role: "user", 
        content: userDisplay,
        mediaUrl: base64Audio ? `data:${audioMime};base64,${base64Audio}` : undefined,
        mediaType: audioMime
      }, resolvedTenantId);
    } else {
      await DB.addChatMessage(from, { 
        role: "user", 
        content: hasImage ? `[Image] ${content}` : content,
        mediaUrl: base64Image ? `data:image/jpeg;base64,${base64Image}` : undefined,
        mediaType: hasImage ? "image/jpeg" : undefined
      }, resolvedTenantId);
    }
    
    const existingCustomer = await DB.getCustomer(from, resolvedTenantId);
    const currentStage = existingCustomer?.pipelineStage || "new";
    
    let updatedTags = existingCustomer?.tags || [];
    let nextStage: "cold" | "new" | "qualified" | "warm" | "completed" | undefined = 
      (currentStage === "completed" || existingCustomer?.leadStatus === "cold") ? "warm" : currentStage;
    
    const activeCampaign = await DB.getActiveCampaign(resolvedTenantId);
    if (updatedTags.includes("revival-sent") || (activeCampaign && activeCampaign.targetPhones?.includes(from))) {
      updatedTags = updatedTags.filter(t => t !== "revival-sent");
      if (!updatedTags.includes("revival-replied")) {
        updatedTags.push("revival-replied");
      }
      nextStage = "warm";

      if (activeCampaign) {
        const repliedList = Array.from(new Set([...(activeCampaign.repliedPhones || []), from]));
        const progressMap = activeCampaign.leadProgress || {};
        if (progressMap[from]) {
          progressMap[from].status = "replied";
        }
        await DB.updateRevivalCampaign(activeCampaign.id, {
          repliedPhones: repliedList,
          leadProgress: progressMap
        }, resolvedTenantId);
      }
    }

    await DB.updateCustomer(from, { 
      isLead: true,
      leadCreatedAt: existingCustomer?.leadCreatedAt || new Date().toISOString(),
      followUpLevel: 0,
      leadStatus: "hot",
      isOptedOut: false,
      tags: updatedTags,
      ...(msg.pushName ? { name: msg.pushName } : {})
    }, resolvedTenantId);
    const customer = await DB.getCustomer(from, resolvedTenantId);

    const globalAiEnabled = config.globalAiEnabled !== false;
    const chatAiEnabled = customer?.aiEnabled;
    const shouldAiRespond = chatAiEnabled !== undefined ? chatAiEnabled : globalAiEnabled;

    if (!shouldAiRespond) {
      console.log(`[AI Handler] AI Autopilot is OFF for ${from}. Ignoring message.`);
      return;
    }


    const activeTenant = await DB.getTenantById(resolvedTenantId);

    // Execute Dynamic Hybrid Engine (Sequential Flow + KB/Catalog Indexer + Keyword Matcher)
    const hybridResult = await processHybridEngine(from, content, config, activeTenant, customer, resolvedTenantId);

    if (hybridResult.matched && hybridResult.reply) {
      console.log(`[AI Handler] Hybrid Engine matched via [${hybridResult.source}]. 0 Tokens used!`);
      if (hybridResult.image) {
        try {
          await WhatsAppManager.sendImageUrl(from, hybridResult.image, hybridResult.imageCaption || "");
        } catch (imgErr) {
          console.error("[AI Handler] Failed to send hybrid result image:", imgErr);
        }
      }
      const sentMsg = await WhatsAppManager.sendMessage(from, hybridResult.reply);
      await DB.addChatMessage(from, { id: sentMsg?.key?.id, role: "assistant", content: hybridResult.reply }, resolvedTenantId);
      return;
    }

    console.log(`=== AI HANDLER (Tenant: ${resolvedTenantId}) ===`);

    const apiKey = getApiKey(config);

    debugLog(`=== Incoming Message from ${from} (Tenant: ${resolvedTenantId}) ===`);
    debugLog(`Content: "${content}"`);

    if (!apiKey) {
      console.error("[AI Handler] No API key is configured.");
      const fallback = "I'm currently experiencing a high volume of requests. A human agent will be with you shortly!";
      const sentMsg = await WhatsAppManager.sendMessage(from, fallback);
      await DB.addChatMessage(from, { id: sentMsg?.key?.id, role: "assistant", content: fallback }, resolvedTenantId);
      return;
    }

    let aiReply = "I'm sorry, I didn't quite catch that. Could you rephrase?";
    
    if (!activeTenant) {
      console.error(`[AI Handler] No tenant record found for resolvedTenantId: ${resolvedTenantId}. Dropping message.`);
      return;
    }
    
    const activeSystemPrompt = config.systemPrompt || activeTenant?.systemPrompt || "";
    const activeKnowledgeBase = config.productInfo || activeTenant?.knowledgeBase || "";
    const activeProductKB = activeTenant?.productKnowledgeBase?.trim() || "";
    const activeProducts = (config.products && config.products.length > 0) ? config.products : (activeTenant?.products || []);
    const activeCurrency = activeTenant?.currency || config.storeCurrency || "PKR";
    const activeBusinessName = activeTenant?.businessName || activeTenant?.name || config.businessName || "our store";

    const structuredCatalog = activeProducts.length > 0 ? formatProductsToCatalog(activeProducts, activeCurrency) : "";
    const activeProductCatalog = [structuredCatalog, activeKnowledgeBase, activeProductKB].filter(Boolean).join("\n\n");
    let fullSystemPrompt = `${activeSystemPrompt}\n\nToday's Date: ${new Date().toISOString().split('T')[0]}\n\nProduct Information & Catalog:\n${activeProductCatalog}`;

    const customerTags = customer?.tags || [];
    const hasRevivalTag = customerTags.includes("revival-sent") || customerTags.includes("revival-replied");
    if (hasRevivalTag) {
      fullSystemPrompt += `\n\n=== DEAD LEAD REVIVAL PIPELINE FUNNEL STRATEGY ===
This customer is a revived dead lead who recently responded to our re-engagement outreach campaign.
Follow this funnel strategy to turn them from a dead lead into a paying customer:
1. RE-INTRODUCTION: Re-introduce our business/brand warmly, acknowledging that they were previously in contact, and maintain a friendly, warm tone.
2. DISCOUNT/INCENTIVE: Offer them a special revival discount, exclusive promo code, or limited-time deal to incentivize them to buy right now.
3. CONVERSATION OVER PITCHING: Do not immediately push a hard sell. Build rapport, ask if their needs have changed, or check if they need help with their previous inquiry.
4. ACTIVE NURTURING: Offer a direct purchase link, guide them to place an order, or answer questions about product options.
5. PROACTIVE FOLLOW-UPS: If they go quiet, schedule a follow-up message using your schedule_followup tool in 1-2 days to check in on the offer.
Keep their history in mind and treat them like a valued returning customer.`;
    }
    
    const botPurposeMode = config.botMode || "both";
    fullSystemPrompt += `\n\n=== BOT MODE: ${botPurposeMode.toUpperCase()} (ORDERS & APPOINTMENTS SUPPORTED) ===\n`;

    fullSystemPrompt += `\n\n=== CRITICAL RULES FOR ORDERS & APPOINTMENT BOOKINGS ===
1. When showing a product to the customer, you must ALWAYS call the send_product_card function with the correct product data.
2. You must NEVER write product images, links, or image URLs in the text message! Always use send_product_card tool instead.
3. If a product has SIZE VARIATIONS (Small, Medium, Large) with different prices, you MUST:
   a. First call send_product_card with price set to "Hidden" (to show the card without a price)
   b. Then ask the customer: "Konsa size chahiye? Small / Medium / Large?" and tell them each size's price.
   c. After the customer picks a size, confirm the exact price from the catalog.
4. BE CONVERSATIONAL AND NATURAL. You are a real team member for ${activeBusinessName}, not a robotic template machine.
   - If a user just says "hi" or "AOA", reply with a SHORT warm greeting and ask how you can help. Do NOT immediately dump the full menu.
   - If a user says "kia haal hai" or asks how you are, reply naturally like a human (e.g. "Main theek hoon, shukriya! Aap batao kaise madad karun?") — do NOT ignore the casual question.
   - Keep replies SHORT (2-4 sentences). This is WhatsApp, not an email.
5. NO REPEATING GREETINGS: Look at the recent chat history provided! If you have ALREADY greeted this customer, DO NOT say Walaikum Assalam again. Just answer their latest question directly.
6. ORDER COLLECTION: When a customer wants to order something, follow these steps:
   a. Confirm the product name and size/variation (ask if not specified)
   b. Ask for delivery address
   c. Ask for contact number
   d. Ask for payment method (COD, JazzCash, EasyPaisa)
   e. Call the place_order tool with ALL collected details
   f. Confirm the order to the customer with a summary
7. APPOINTMENTS & CALL BOOKINGS: When a customer wants to book a call, meeting, or appointment:
   a. Ask what service/call type they need (e.g., Discovery Call, Consultation)
   b. Call checkAvailability tool to get available time slots for their desired date
   c. Present available slots and let them choose
   d. Call bookAppointment tool with the confirmed details
   e. Confirm the booking with date, time, and service name
8. CATALOG ACCURACY: ONLY quote prices and products from the Product Information & Catalog provided above. NEVER invent products, prices, or services that are not in the catalog.
9. PROACTIVE FOLLOW-UPS: If you promise to check back or follow up with the customer later, you MUST call schedule_followup tool with the appropriate time.
10. CRM PROFILE UPDATES: When a customer tells you their name, shows strong buying interest, or reaches a milestone in the conversation, call update_customer_profile to save their info and update their pipeline stage.
11. VOICE NOTES: When you receive a voice note (marked with 🎤 [Voice Note] followed by the transcription), respond directly to what they said. Treat the transcription as if the customer typed it.
12. 4-LANGUAGE SUPPORT: Automatically detect the user's language and ALWAYS respond in the SAME language:
   - Roman Urdu: "AOA! Shukriya contact karne ka."
   - Urdu: "السلام علیکم! شکریہ"
   - Pashto: "سلام! مننه"
   - English: "Hello! Thanks for reaching out."
   Keep vocabulary natural and local. Never mix languages awkwardly.`;

    if (config.enabledFeatures && config.enabledFeatures.length > 0) {
      fullSystemPrompt += "\n\n=== ADVANCED FEATURES ENABLED ===\n";
      
      if (config.enabledFeatures.includes("Multi-language Support")) {
        fullSystemPrompt += "- MULTI-LANGUAGE SUPPORT: Detect the user's language automatically and reply in their exact language.\n";
      }
      if (config.enabledFeatures.includes("Lead Collection")) {
        fullSystemPrompt += "- LEAD COLLECTION: Ask the user for their full name and email address before proceeding with bookings or deep consultations.\n";
      }
      if (config.enabledFeatures.includes("Service Recommendation")) {
        fullSystemPrompt += "- SERVICE RECOMMENDATION: Ask the user questions about their current situation/problem, then recommend the best service from the Product Information.\n";
      }
      if (config.enabledFeatures.includes("Personalized Consultation")) {
        fullSystemPrompt += "- PERSONALIZED CONSULTATION: Act as a personal consultant. Ask clarifying questions to provide tailored advice.\n";
      }
      if (config.enabledFeatures.includes("Price Inquiry")) {
        fullSystemPrompt += "- PRICE INQUIRY: If the user asks about prices, clearly state the price from the Product Information and ask if they'd like to book.\n";
      }
      if (config.enabledFeatures.includes("Google Review Requests")) {
        fullSystemPrompt += "- GOOGLE REVIEW REQUESTS: If the user gives positive feedback or thanks you, politely ask them to leave a 5-star Google review.\n";
      }
      if (config.enabledFeatures.includes("Human Handoff")) {
        fullSystemPrompt += "- HUMAN HANDOFF: If you do not know the answer to a question, tell the user you are transferring them to a human agent, and do NOT try to guess.\n";
      }
    }

    const history = await DB.getChats(from, resolvedTenantId);
    // Filter out system messages and sanitize past assistant refusal messages so LLM never gets primed by past errors!
    let recentHistory = history
      .filter((m: any) => m.role === 'user' || m.role === 'assistant')
      .slice(-20)
      .map((m: any) => {
        let textContent = m.content || "";
        if (m.role === 'assistant' && (
          textContent.includes("not able to listen to voice notes") || 
          textContent.includes("cannot listen to voice notes") ||
          textContent.includes("listen to them on my end") ||
          textContent.includes("unable to listen")
        )) {
          textContent = "Hello! I am glad to assist you. How can I help you find the perfect outfit or answer questions about our collection?";
        }
        return { role: m.role, content: textContent };
      });

    // Attach base64 image to the latest user message
    console.log(`[AI Handler Debug] Resolved Tenant: ${resolvedTenantId}`);
    console.log(`[AI Handler Debug] Active Tenant ID: ${activeTenant?.id}`);
    console.log(`[AI Handler Debug] System Prompt: ${fullSystemPrompt.substring(0, 200)}...`);
    console.log(`[AI Handler Debug] History Count: ${recentHistory.length}`);

    if (base64Image) {
      const lastUserMsg = recentHistory[recentHistory.length - 1];
      if (lastUserMsg && lastUserMsg.role === 'user') {
        lastUserMsg.content = [
          { type: "text", text: lastUserMsg.content },
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Image } }
        ] as any;
      }
    }

    const tools: Anthropic.Tool[] = [
      {
        name: "checkAvailability",
        description: "Checks available appointment time slots for a given date. Available hours are 9 AM to 5 PM, on the hour.",
        input_schema: {
          type: "object",
          properties: {
            date: { type: "string", description: "The date to check availability for (YYYY-MM-DD)" }
          },
          required: ["date"]
        }
      },
      {
        name: "bookAppointment",
        description: "Books an appointment, discovery call, meeting, or service for the user. Call this whenever the user confirms or wants to book a call or appointment.",
        input_schema: {
          type: "object",
          properties: {
            name: { type: "string", description: "User's full name (or pushName/phone if name not provided)" },
            service: { type: "string", description: "The service or call name (e.g. 'Discovery Call', 'Consultation')" },
            date: { type: "string", description: "Date of appointment (e.g., 'YYYY-MM-DD' or 'Kal (6 August)')" },
            time: { type: "string", description: "Time of appointment (e.g., '11:00 AM')" },
            notes: { type: "string", description: "A 1-2 sentence summary of what the client wants to discuss during the call/appointment." }
          },
          required: ["service", "date", "time"]
        }
      },
      {
        name: "cancelAppointment",
        description: "Cancels an existing appointment for the user.",
        input_schema: {
          type: "object",
          properties: {
            date: { type: "string", description: "Date of appointment (YYYY-MM-DD)" },
            time: { type: "string", description: "Time of appointment (HH:MM)" }
          },
          required: ["date", "time"]
        }
      },
      {
        name: "send_product_card",
        description: "Sends a beautiful interactive product card to the user. Use this ALWAYS when recommending or showing a product.",
        input_schema: {
          type: "object",
          properties: {
            product_name: { type: "string", description: "Product name" },
            price: { type: "string", description: "Product price with currency symbol. If you need to hide the price to ask for size first (due to variations), pass exactly 'Hidden'." },
            image_url: { type: "string", description: "Direct URL to product image" },
            product_page_url: { type: "string", description: "Direct URL to product page" },
            description: { type: "string", description: "A short, engaging description of the product" }
          },
          required: ["product_name", "price", "image_url", "product_page_url", "description"]
        }
      },
      {
        name: "place_order",
        description: "Finalizes and places an order for the user after all details (size, color, delivery address, contact number, payment method) have been collected.",
        input_schema: {
          type: "object",
          properties: {
            product_name: { type: "string", description: "The name of the product" },
            size: { type: "string" },
            color: { type: "string" },
            address: { type: "string" },
            contact_number: { type: "string" },
            payment_method: { type: "string", description: "e.g. Cash on Delivery, Bank Transfer" },
            price: { type: "string" },
            notes: { type: "string", description: "Special instructions, customizations, size adjustments, or notes requested by the client." }
          },
          required: ["product_name"]
        }
      },
      {
        name: "schedule_followup",
        description: "Schedules a follow-up message to be sent to the user at a specific future time. Use this when you promise to check back later or follow up.",
        input_schema: {
          type: "object",
          properties: {
            send_at: { type: "string", description: "An ISO 8601 timestamp for when to send the follow-up. Calculate this strictly based on the current Date provided in the system prompt." },
            message_context: { type: "string", description: "A short note explaining why we are following up and what to say (e.g., 'Check if they liked the red dress')." }
          },
          required: ["send_at", "message_context"]
        }
      },
      {
        name: "update_customer_profile",
        description: "Updates the customer's CRM profile, including their tags, custom name, and pipeline stage based on the conversation context.",
        input_schema: {
          type: "object",
          properties: {
            name: { type: "string", description: "The customer's verified name (if they provided it in chat)" },
            tagsToAdd: { type: "array", items: { type: "string" }, description: "List of new tags/preferences to add to this customer (e.g. ['interested-in-mehrunisa', 'needs-urgently'])" },
            tagsToRemove: { type: "array", items: { type: "string" }, description: "List of tags to remove from this customer" },
            stage: { type: "string", enum: ["new", "qualified", "warm", "cold", "completed"], description: "The funnel pipeline stage to move the customer to. Use 'qualified' when they give basic details, and 'warm' when they show strong interest or request pricing/availability." }
          }
        }
      }
    ];

    let usedProvider = "unknown";
    try {
      await WhatsAppManager.sendTyping(from);
      console.log(`[AI Handler] Requesting completion using unified callLLMWithFallback...`);
      const fallbackResult = await callLLMWithFallback(config, fullSystemPrompt, recentHistory, tools);
      usedProvider = fallbackResult.provider;
      let res = fallbackResult.res;

      let textContent = "";
      for (const block of res.content) {
        if (block.type === 'text') {
          textContent += block.text;
        }
      }
      aiReply = textContent || aiReply;

      const toolUses = res.content.filter((block: any) => block.type === 'tool_use');
      
      if (toolUses.length > 0) {
        console.log("[AI Handler] AI requested tool calls:", JSON.stringify(toolUses));
        
        // Push the assistant's message to the history
        recentHistory.push({
          role: "assistant",
          content: res.content
        } as any);
        
        const toolResults = [];

        for (const _toolCall of toolUses) {
          const toolCall = _toolCall as any;
          const args = toolCall.input;
          let toolResult = "";

          if (toolCall.name === "checkAvailability") {
            const booked = await DB.getAppointmentsByDate(args.date, resolvedTenantId);
            const bookedTimes = booked.map(a => a.time);
            const allHours = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
            const available = allHours.filter(h => !bookedTimes.includes(h));
            toolResult = JSON.stringify({ availableTimes: available });
          } 
          else if (toolCall.name === "bookAppointment") {
            const userName = args.name || customer?.name || from;
            const success = await DB.bookAppointment(from, userName, args.service, args.date, args.time, args.notes, resolvedTenantId);
            await DB.updateCustomer(from, { pipelineStage: "completed", name: userName }, resolvedTenantId);
            toolResult = JSON.stringify({ success: true, message: "Appointment/Call booked successfully and recorded in dashboard." });
          }
          else if (toolCall.name === "cancelAppointment") {
            const success = await DB.cancelAppointment(from, args.date, args.time, resolvedTenantId);
            toolResult = JSON.stringify({ success, message: success ? "Appointment cancelled successfully." : "No such appointment found to cancel." });
          }
          else if (toolCall.name === "send_product_card") {
            try {
              await WhatsAppManager.sendProductCard(from, {
                title: args.product_name,
                price: args.price,
                image: args.image_url,
                link: args.product_page_url,
                description: args.description
              });
              toolResult = JSON.stringify({ success: true, message: "Product card sent successfully! Do not type out any further description of the product." });
            } catch (err) {
              console.error("[AI Handler] sendProductCard error:", err);
              toolResult = JSON.stringify({ success: false, message: "Failed to send product card." });
            }
          }
          else if (toolCall.name === "place_order") {
            try {
              const orderData = {
                productName: args.product_name,
                size: args.size,
                color: args.color,
                deliveryAddress: args.address,
                contactNumber: args.contact_number,
                paymentMethod: args.payment_method,
                price: args.price,
                productImageUrl: args.image_url,
                customerName: customer?.name || from,
                notes: args.notes
              };
              await DB.addOrder(from, orderData, resolvedTenantId);
              await DB.updateCustomer(from, { followUpLevel: 999, leadStatus: "cold", pipelineStage: "completed" }, resolvedTenantId);
              toolResult = JSON.stringify({ success: true, message: "Order placed and saved to database successfully. You may now confirm the final order details to the user." });
            } catch (err: any) {
              console.error("[AI Handler] place_order error:", err);
              toolResult = JSON.stringify({ success: false, message: "Failed to place order: " + err.message });
            }
          }
          else if (toolCall.name === "update_customer_profile") {
            try {
              const customerRec = await DB.getCustomer(from, resolvedTenantId);
              const currentTags = customerRec?.tags || [];
              let newTags = [...currentTags];

              if (args.tagsToAdd && Array.isArray(args.tagsToAdd)) {
                args.tagsToAdd.forEach((t: string) => {
                  const cleanTag = t.trim();
                  if (cleanTag && !newTags.includes(cleanTag)) {
                    newTags.push(cleanTag);
                  }
                });
              }

              if (args.tagsToRemove && Array.isArray(args.tagsToRemove)) {
                newTags = newTags.filter(t => !args.tagsToRemove.includes(t));
              }

              const updates: any = { tags: newTags };
              if (args.name) updates.name = args.name;
              if (args.stage) updates.pipelineStage = args.stage;

              await DB.updateCustomer(from, updates, resolvedTenantId);
              toolResult = JSON.stringify({ success: true, message: "Customer profile updated successfully." });
            } catch (err: any) {
              console.error("[AI Handler] update_customer_profile error:", err);
              toolResult = JSON.stringify({ success: false, message: "Failed to update profile: " + err.message });
            }
          }
          else if (toolCall.name === "schedule_followup") {
            try {
              await DB.cancelPendingFollowUps(from, resolvedTenantId);
              await DB.addScheduledFollowUp({
                id: Math.random().toString(36).substring(2, 9),
                phone: from,
                sendAt: args.send_at,
                context: args.message_context,
                status: "pending",
                createdAt: new Date().toISOString()
              }, resolvedTenantId);
              toolResult = JSON.stringify({ success: true, message: "Follow-up scheduled successfully in the database." });
            } catch (err: any) {
              console.error("[AI Handler] schedule_followup error:", err);
              toolResult = JSON.stringify({ success: false, message: "Failed to schedule follow-up." });
            }
          }

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolCall.id,
            content: toolResult
          });
        }

        recentHistory.push({
          role: "user",
          content: toolResults
        } as any);

        console.log("[AI Handler] Sending tool results back to AI...");
        const fallbackResult2 = await callLLMWithFallback(config, fullSystemPrompt, recentHistory, tools);
        usedProvider = fallbackResult2.provider;
        res = fallbackResult2.res;

        textContent = "";
        for (const block of res.content) {
          if (block.type === 'text') {
            textContent += block.text;
          }
        }
        aiReply = textContent || aiReply;
      }
      
      debugLog(`SUCCESS: Unified LLM generated reply: "${aiReply.substring(0, 60)}..."`);
      console.log(`[AI Handler] Unified LLM generated reply successfully. Provider used: ${usedProvider}`);
    } catch (apiErr: any) {
      const errorDetail = apiErr.message || JSON.stringify(apiErr);
      console.error(`[AI Handler] Unified LLM API ERROR CAUGHT:`, errorDetail);
      debugLog(`FAILURE: Unified LLM API call failed. Error: ${errorDetail}`);
      
      const isQuota = errorDetail.toLowerCase().includes("quota") || errorDetail.toLowerCase().includes("balance") || errorDetail.includes("402") || errorDetail.toLowerCase().includes("insufficient");
      const isAuth = errorDetail.includes("401") || errorDetail.toLowerCase().includes("unauthorized") || errorDetail.toLowerCase().includes("invalid api key");
      
      const alertType = isQuota ? 'quota_exceeded' : isAuth ? 'invalid_key' : 'error';
      const alertMsg = isQuota ? 'Conversational LLM Quota Exceeded / Out of Balance.' : isAuth ? 'Conversational LLM API Key is Invalid or Unauthorized.' : `LLM API Error: ${errorDetail}`;
      await DB.recordApiAlert('Conversational LLM', alertType, alertMsg);

      aiReply = "I'm currently experiencing a high volume of requests and having some technical difficulties. A human agent will be with you shortly, or you can try again later!";
      const diagnostics = `[DIAGNOSTIC - API ERROR] Unified LLM call failed.\n- Provider: ${usedProvider}\n- Last Error: ${errorDetail}`;
      await DB.addChatMessage(from, { role: "assistant", content: diagnostics }, resolvedTenantId);
    }

    if (aiReply) {
      aiReply = sanitizeLlmResponseText(aiReply);
      aiReply = aiReply.replace(/!\[.*?\]\((https?:\/\/[^\)]+)\)/g, '[MEDIA:$1]');
    }

    if (!aiReply || !aiReply.trim()) {
      aiReply = `AOA! ${activeBusinessName} mein khush amdeed! 😊 Main aapki kya madad kar sakta hoon?`;
    }

    const mediaRegex = /\[MEDIA:(.+?)\]/g;
    let match;
    const extractedMedia = [];
    while ((match = mediaRegex.exec(aiReply)) !== null) {
      extractedMedia.push(match[1]);
    }
    
    aiReply = aiReply.replace(mediaRegex, '').trim();

    for (const mediaUrl of extractedMedia) {
      try {
        console.log(`[AI Handler] Intercepted media URL: ${mediaUrl}`);
        const res = await fetch(mediaUrl, { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          const mimetype = res.headers.get('content-type') || 'image/jpeg';
          const sentMsgObj = await WhatsAppManager.sendMedia(from, buffer, mimetype);
          console.log(`[AI Handler] Sent media to ${from}`);

          const base64Media = buffer.toString('base64');
          await DB.addChatMessage(from, {
            id: "ai_" + (sentMsgObj?.key?.id || ""),
            role: "assistant",
            content: mimetype.startsWith('image/') ? `[Image]` : `📎 [Attachment]`,
            mediaUrl: `data:${mimetype};base64,${base64Media}`,
            mediaType: mimetype
          }, resolvedTenantId);
        }
      } catch (e) {
        console.error(`[AI Handler] Failed to send media ${mediaUrl}:`, e);
      }
    }

    let sentMsg = null;
    if (aiReply.length > 0) {
      const lowerReply = aiReply.toLowerCase();
      if (
        lowerReply.includes("not able to receive the audio") ||
        lowerReply.includes("unable to receive the audio") ||
        lowerReply.includes("not able to listen") ||
        lowerReply.includes("cannot listen to voice") ||
        lowerReply.includes("unable to listen to voice") ||
        lowerReply.includes("cannot receive the audio") ||
        lowerReply.includes("cannot receive audio")
      ) {
        console.warn("[AI Handler] Intercepted voice note refusal message from AI. Replacing with helpful greeting.");
        aiReply = "Hello! Thank you for your voice note. I am glad to assist you! How can I help you with our product catalog, pricing, or placing an order today?";
      }

      sentMsg = await WhatsAppManager.sendMessage(from, aiReply);
      console.log(`[AI Handler] Replied to ${from}: ${aiReply}`);
      await DB.addChatMessage(from, { id: "ai_" + (sentMsg?.key?.id || ""), role: "assistant", content: aiReply || "[Media Sent]" }, resolvedTenantId);
    }
    
  } catch (error) {
    console.error("[AI Handler] processWhatsAppMessage error:", error);
  }
}

export async function shouldSendFollowUp(phone: string, followUpPrompt?: string, tenantId?: string): Promise<{ shouldFollowUp: boolean; reason: string }> {
  const config = await DB.getConfig(tenantId);

  const history = await DB.getChats(phone, tenantId);
  const customer = await DB.getCustomer(phone, tenantId);
  const orders = (await DB.getOrders(tenantId)).filter((o: any) => o.phone === phone);

  if (customer?.isOptedOut) {
    return { shouldFollowUp: false, reason: "Customer explicitly opted out." };
  }

  const userMessages = history.filter((m: any) => m.role === 'user');
  const lastUserMsgTime = userMessages.length > 0 ? new Date(userMessages[userMessages.length - 1].timestamp).getTime() : 0;

  const completedOrder = orders
    .filter((o: any) => o.status === "completed" || o.status === "confirmed" || o.status === "paid")
    .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

  if (completedOrder) {
    const orderTime = new Date(completedOrder.timestamp).getTime();
    if (lastUserMsgTime <= orderTime) {
      return { shouldFollowUp: false, reason: `Deal completed: Customer confirmed order #${completedOrder.id}` };
    }
  }

  const recentHistory = history
    .filter((m: any) => m.role === 'user' || m.role === 'assistant')
    .slice(-8)
    .map((m: any) => ({ role: m.role, content: m.content }));

  if (recentHistory.length === 0) {
    return { shouldFollowUp: false, reason: "No chat history available for customer." };
  }

  const systemPrompt = `You are an AI Sales & Booking Intelligence Controller evaluating WhatsApp conversation state.
Determine whether an automated follow-up message SHOULD be sent to this customer, or if the deal/booking/inquiry is CLOSED due to an order placement or explicit refusal.

Rule to SKIP follow-up (return shouldFollowUp: false):
1. The user placed an order or completed payment for a product/service.
2. The user explicitly stated they are NOT interested, asked to stop messaging, or refused/declined.

Rule to SEND follow-up (return shouldFollowUp: true):
1. The user expressed interest, asked a question, inquired about products/services, or asked to book/re-book a call/appointment, and has gone quiet without placing an order or explicitly declining.
2. The conversation was left pending mid-way without a finalized order or clear refusal.

Respond STRICTLY with JSON only in this exact format:
{"shouldFollowUp": boolean, "reason": "brief 1-sentence explanation"}`;

  try {
    const { res } = await callLLMWithFallback(config, systemPrompt, recentHistory, []);
    let textContent = "";
    for (const block of res.content) {
      if (block.type === 'text') textContent += block.text;
    }
    const cleanJson = textContent.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanJson);
    return {
      shouldFollowUp: parsed.shouldFollowUp ?? true,
      reason: parsed.reason || "Evaluated by AI"
    };
  } catch (err: any) {
    console.error("[AI Handler] Error evaluating shouldSendFollowUp:", err?.message || err);
    return { shouldFollowUp: true, reason: "Fallback on AI evaluation error" };
  }
}

export async function generateContextualFollowUp(phone: string, followUpPrompt?: string, tenantId?: string): Promise<string> {
  const config = await DB.getConfig(tenantId);

  const history = await DB.getChats(phone, tenantId);
  const recentHistory = history.filter((m: any) => m.role === 'user' || m.role === 'assistant').slice(-6).map((m: any) => ({ role: m.role, content: m.content }));

  let systemPrompt = `You are an expert Booking and Sales AI Assistant for ${config.businessName || 'our business'}.\nYour goal is to politely re-engage the customer based on their recent chat history. Keep it natural, friendly, and concise (1-3 sentences).`;
  
  if (followUpPrompt && followUpPrompt.trim() !== "") {
    systemPrompt += `\n\nAdditional direction: "${followUpPrompt}". Use this as inspiration and re-write it to directly reference what you and the user were last talking about in the chat history. Make it highly contextual and personalized.`;
  } else {
    systemPrompt += `\n\nInstruction: Look at the chat history. Reference what the user was asking about or inquiring to book/buy, and craft a short, warm, personalized follow-up message to restart the conversation.`;
  }

  try {
    const { res } = await callLLMWithFallback(config, systemPrompt, recentHistory, []);
    let textContent = "";
    for (const block of res.content) {
      if (block.type === 'text') {
        textContent += block.text;
      }
    }
    return textContent || "Hi there! Just following up to see if you needed any more help?";
  } catch (error: any) {
    console.error(`[AI Handler] Error generating contextual follow-up:`, error.message || error);
    return "Hi there! Just checking in to see if you need any more help?";
  }
}

export async function generateScheduledFollowUp(phone: string, contextNote: string, tenantId?: string): Promise<string> {
  const config = await DB.getConfig(tenantId);

  const history = await DB.getChats(phone, tenantId);
  const recentHistory = history.filter((m: any) => m.role === 'user' || m.role === 'assistant').slice(-5).map((m: any) => ({ role: m.role, content: m.content }));

  let systemPrompt = `You are an expert Booking and Sales AI Assistant. You previously promised the user you would follow up with them later. It is now time to send that follow-up.`;
  systemPrompt += `\n\nContext for this follow-up: ${contextNote}\n\nInstruction: Look at the chat history and the context note above. Craft a natural, friendly, and highly relevant follow-up message fulfilling your promise to the user.`;

  try {
    const { res } = await callLLMWithFallback(config, systemPrompt, recentHistory, []);
    let textContent = "";
    for (const block of res.content) {
      if (block.type === 'text') {
        textContent += block.text;
      }
    }
    return textContent || `Hi! Following up on what we discussed: ${contextNote}`;
  } catch (error: any) {
    console.error(`[AI Handler] Error generating scheduled follow-up:`, error.message || error);
    return `Hi! Following up on what we discussed: ${contextNote}`;
  }
}
