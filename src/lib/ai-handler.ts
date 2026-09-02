import Anthropic from "@anthropic-ai/sdk";
import { WhatsAppManager } from "./whatsapp";
import { DB, DB_DIR, formatProductsToCatalog, ChatMessage } from "./db";
import { ProductItem } from "./scraper";
import { enqueueWhatsAppMessageJob, registerQueueWorker, CONCURRENCY_LIMIT, getQueueLength, WhatsAppJobPayload } from "./queue-manager";
import Redis from "ioredis";
import { getRedisClient } from "./redis";
import crypto from "crypto";
import { logLLMUsage, logAppError } from "./observability-store";
import { getCurrentTraceContext } from "./trace-context";
import { acquireLLMConcurrencySlot, truncateContextWindow, recordTenantLLMCost } from "./llm-cost-concurrency";
import dns from "dns";
import fs from "fs";
import path from "path";

dns.setDefaultResultOrder("ipv4first");

export function filterRelevantProducts(products: ProductItem[], userQuery: string): ProductItem[] {
  if (!products || products.length <= 15) return products || [];

  const query = (userQuery || "").toLowerCase();
  const isMenuQuery = ["menu", "catalog", "rate list", "items", "list"].some(w => query.includes(w));
  if (isMenuQuery) {
    return products;
  }

  const stopWords = new Set(["the", "a", "an", "is", "are", "and", "or", "in", "on", "at", "to", "for", "of", "with", "me", "i", "you", "we", "can", "please", "show", "price", "how", "much", "what", "kia", "ka", "ki", "kya", "hai", "mujhe", "chahiye", "batao", "bataen"]);
  const terms = query
    .replace(/[^\w\s]/gi, " ")
    .split(/\s+/)
    .filter(t => t.length > 2 && !stopWords.has(t));

  if (terms.length === 0) {
    return products.slice(0, 15);
  }

  const scored = products.map(p => {
    let score = 0;
    const itemAny = p as any;
    const name = (itemAny.name || p.title || "").toLowerCase();
    const category = (p.category || "").toLowerCase();
    const desc = (p.description || "").toLowerCase();
    const tags = Array.isArray(itemAny.tags) ? itemAny.tags.join(" ").toLowerCase() : "";

    for (const term of terms) {
      if (name.includes(term)) score += 10;
      if (category.includes(term)) score += 6;
      if (tags.includes(term)) score += 4;
      if (desc.includes(term)) score += 2;
    }
    return { product: p, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const matched = scored.filter(s => s.score > 0).map(s => s.product);

  if (matched.length > 0) {
    return matched.slice(0, 15);
  }

  return products.slice(0, 15);
}

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
    // 1. Tenant-specific keys - PRIMARY source for client-level isolation
    config?.apiKey,
    config?.openRouterApiKey,
    config?.openaiApiKey,
    config?.anthropicApiKey,
    config?.deepgramApiKey,

    // 2. Global environment variables (from Railway) - Fallback source
    process.env["DEEPSEEK_API_KEY"],
    getEnvKey("DEEPSEEK_API_KEY"),
    process.env["OPENROUTER_API_KEY"],
    getEnvKey("OPENROUTER_API_KEY"),
    process.env["OPENAI_API_KEY"],
    getEnvKey("OPENAI_API_KEY"),
    process.env["ANTHROPIC_API_KEY"],
    getEnvKey("ANTHROPIC_API_KEY"),
    process.env["API_KEY"],
    getEnvKey("API_KEY")
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
    throw new Error("Deepgram API key is missing.");
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
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
      body: new Uint8Array(buffer),
      signal: controller.signal
    });

    // Secondary attempt: Fallback with explicit language=ur support or general model
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Deepgram STT] First attempt error (${res.status}):`, errText);
      
      const fallbackController = new AbortController();
      const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 10000);
      try {
        res = await fetch("https://api.deepgram.com/v1/listen?model=general&language=ur&smart_format=true&punctuate=true", {
          method: "POST",
          headers: {
            "Authorization": `Token ${apiKey.trim()}`,
            "Content-Type": "application/octet-stream"
          },
          body: new Uint8Array(buffer),
          signal: fallbackController.signal
        });
      } finally {
        clearTimeout(fallbackTimeoutId);
      }
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Deepgram API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
    console.log(`[Deepgram STT] Transcribed text: "${transcript}"`);
    return transcript;
  } catch (err: any) {
    console.error("[Deepgram STT] Exception during transcription:", err.message || err);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}


async function transcribeAudioWithOpenAI(buffer: Buffer, apiKey: string, mimetype = "audio/ogg"): Promise<string> {
  if (!apiKey || !apiKey.trim() || (!apiKey.startsWith("sk-") && !apiKey.startsWith("sk-proj-"))) {
    throw new Error("OpenAI API key is missing or invalid.");
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
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
      body: formData,
      signal: controller.signal
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const transcript = data?.text || "";
    console.log(`[Whisper STT] Successfully transcribed audio: "${transcript}"`);
    return transcript;
  } catch (err: any) {
    console.error("[Whisper STT] Exception during transcription:", err.message || err);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function transcribeAudioWithGemini(buffer: Buffer, apiKey: string, mimetype = "audio/ogg"): Promise<string> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("Gemini API key is missing.");
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  try {
    const cleanMime = (mimetype || "audio/ogg").split(';')[0].trim() || "audio/ogg";
    const base64Audio = buffer.toString("base64");
    
    console.log(`[Gemini STT] Transcribing ${buffer.length} bytes of audio via Gemini 3.6 Flash...`);
    let res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey.trim()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: cleanMime,
                  data: base64Audio
                }
              },
              {
                text: "Transcribe this voice note audio accurately. The spoken language may be Pashto, Urdu, Roman Urdu, or English. This may contain a Pakistani home address — extract house/flat/street numbers carefully; digits are often spoken digit-by-digit (e.g. 'one-two-three' or 'teen-do-ek') or as compound numbers. Write down numbers as clean digits (e.g. House #123, Street #5) where applicable. Return ONLY the transcribed text. Do not add any introduction, explanations, or quotes. If the audio is silent or completely unintelligible, return an empty string."
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 500
        }
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Gemini STT] First attempt (gemini-3.6-flash) error (${res.status}):`, errText);
      const fallbackController = new AbortController();
      const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 10000);
      try {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey.trim()}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType: cleanMime,
                      data: base64Audio
                    }
                  },
                  {
                    text: "Transcribe this voice note audio accurately. The spoken language may be Pashto, Urdu, Roman Urdu, or English. This may contain a Pakistani home address — extract house/flat/street numbers carefully; digits are often spoken digit-by-digit (e.g. 'one-two-three' or 'teen-do-ek') or as compound numbers. Write down numbers as clean digits (e.g. House #123, Street #5) where applicable. Return ONLY the transcribed text. Do not add any introduction, explanations, or quotes. If the audio is silent or completely unintelligible, return an empty string."
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 500
            }
          }),
          signal: fallbackController.signal
        });
      } finally {
        clearTimeout(fallbackTimeoutId);
      }
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const transcript = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    console.log(`[Gemini STT] Successfully transcribed audio: "${transcript}"`);
    return transcript;
  } catch (err: any) {
    console.error("[Gemini STT] Exception during transcription:", err.message || err);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function transcribeAudioWithGroq(buffer: Buffer, apiKey: string, mimetype = "audio/ogg"): Promise<string> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("Groq API key is missing.");
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const cleanMime = (mimetype || "audio/ogg").split(';')[0].trim() || "audio/ogg";
    const extension = cleanMime.includes("mp4") ? "mp4" : cleanMime.includes("mpeg") ? "mp3" : "ogg";
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: cleanMime });
    formData.append("file", blob, `voice_note.${extension}`);
    formData.append("model", "whisper-large-v3-turbo");

    console.log(`[Groq STT] Transcribing ${buffer.length} bytes of audio via Groq Whisper...`);
    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey.trim()}`
      },
      body: formData,
      signal: controller.signal
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const transcript = data?.text || "";
    console.log(`[Groq STT] Successfully transcribed audio: "${transcript}"`);
    return transcript;
  } catch (err: any) {
    console.error("[Groq STT] Exception during transcription:", err.message || err);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function transcribeAudio(buffer: Buffer, mimetype = "audio/ogg", config?: any, tenantId?: string): Promise<string> {
  if (!buffer || buffer.length === 0) return "";

  const errors: Record<string, string> = {};

  // 1. Gather keys
  const geminiKey = getEnvKey("GEMINI_API_KEY") || process.env.GEMINI_API_KEY || getEnvKey("GOOGLE_API_KEY") || process.env.GOOGLE_API_KEY || config?.geminiApiKey || "";
  const openaiKey = getEnvKey("OPENAI_API_KEY") || process.env.OPENAI_API_KEY || config?.openaiApiKey || "";
  const groqKey = getEnvKey("GROQ_API_KEY") || process.env.GROQ_API_KEY || config?.groqApiKey || "";
  const { apiKey: deepgramKey } = await getDeepgramSettings(config || {});
  
  const generalKey = getEnvKey("API_KEY") || process.env.API_KEY || config?.apiKey || "";

  // 2. Try Deepgram STT if Deepgram key available (Highly accurate for WhatsApp OGG Opus)
  if (deepgramKey) {
    try {
      const transcript = await transcribeAudioWithDeepgram(buffer, deepgramKey, mimetype);
      if (transcript && transcript.trim()) return transcript.trim();
      errors["Deepgram"] = "Empty transcript returned";
    } catch (err: any) {
      errors["Deepgram"] = err.message || String(err);
    }
  } else {
    errors["Deepgram"] = "No API key configured";
  }

  // 3. Try Groq Whisper STT if Groq key available
  const effectiveGroqKey = groqKey || (generalKey.startsWith("gsk_") ? generalKey : "");
  if (effectiveGroqKey) {
    try {
      const transcript = await transcribeAudioWithGroq(buffer, effectiveGroqKey, mimetype);
      if (transcript && transcript.trim()) return transcript.trim();
      errors["Groq"] = "Empty transcript returned";
    } catch (err: any) {
      errors["Groq"] = err.message || String(err);
    }
  } else {
    errors["Groq"] = "No API key configured";
  }

  // 4. Try OpenAI Whisper STT if OpenAI key available
  const effectiveOpenAIKey = openaiKey || ((generalKey.startsWith("sk-") || generalKey.startsWith("sk-proj-")) && !generalKey.startsWith("sk-ant-") && !generalKey.startsWith("sk-or-") ? generalKey : "");
  if (effectiveOpenAIKey) {
    try {
      const transcript = await transcribeAudioWithOpenAI(buffer, effectiveOpenAIKey, mimetype);
      if (transcript && transcript.trim()) return transcript.trim();
      errors["OpenAI"] = "Empty transcript returned";
    } catch (err: any) {
      errors["OpenAI"] = err.message || String(err);
    }
  } else {
    errors["OpenAI"] = "No API key configured";
  }

  // 5. Try Gemini Flash STT if Gemini key available (Fallback: limited OGG Opus decoding)
  const effectiveGeminiKey = geminiKey || (generalKey.startsWith("AIza") ? generalKey : "");
  if (effectiveGeminiKey) {
    try {
      const transcript = await transcribeAudioWithGemini(buffer, effectiveGeminiKey, mimetype);
      if (transcript && transcript.trim()) return transcript.trim();
      errors["Gemini"] = "Empty transcript returned";
    } catch (err: any) {
      errors["Gemini"] = err.message || String(err);
    }
  } else {
    errors["Gemini"] = "No API key configured";
  }

  console.warn("[STT Engine] All transcription attempts failed or returned empty. Error details:", errors);

  // Instrument logAppError for STT failures to capture exactly why transcription failed
  await logAppError({
    service: 'stt-pipeline',
    operation: 'transcribe',
    error: new Error(`STTAllProvidersFailed: All speech-to-text providers failed to transcribe audio. Details: ${JSON.stringify(errors)}`),
    tenantId,
    severity: 'medium',
    metadata: { errors, mimetype, bufferSize: buffer.length }
  }).catch(() => {});

  return "";
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
    "permission denied",
    "resource has been exhausted",
    "resource_exhausted",
    "quota_exhausted",
    "check quota"
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

export const CIRCUIT_COOLDOWN_MS = 30 * 1000; // 30 seconds cooldown for quick recovery

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
    console.log(`[Circuit Breaker] ${provider.toUpperCase()} cooldown (30s) expired. Entering HALF-OPEN state for 1 test request.`);
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
      console.error(`🚨 [PROVIDER DOWN] ${provider.toUpperCase()} failed with non-retryable error: ${reason}. Circuit OPENED for 30 seconds.`);
      DB.recordApiAlert(`${provider.toUpperCase()} LLM`, "circuit_open", `Circuit OPENED for 30s due to non-retryable error: ${reason}`);
    }
  } else if (circuit.state === "half-open") {
    // Half-open test attempt failed -> re-open circuit
    circuit.state = "open";
    circuit.lastFailureTime = Date.now();
    console.error(`🚨 [PROVIDER DOWN] ${provider.toUpperCase()} half-open test failed: ${reason}. Circuit RE-OPENED for 30 seconds.`);
  }
}

export async function callLLMWithFallback(
  config: any,
  systemPrompt: string,
  messages: any[],
  tools: any[] = [],
  temperature: number = 0.7
): Promise<{ res: LLMCallResult; provider: string }> {
  const safeMessages = truncateContextWindow(messages);
  const tenantId = config?.tenantId || config?.id || "default_tenant";

  const slot = await acquireLLMConcurrencySlot(tenantId, "llm_fallback", config?.dailyBudgetUsd);
  if (!slot.acquired) {
    if (slot.reason === "budget_exceeded") {
      const err: any = new Error(`LLM daily budget limit exceeded for tenant: ${tenantId}`);
      err.isNonRetryable = true;
      throw err;
    }
    throw new Error(`LLM concurrency limit reached (${slot.reason}), retrying job...`);
  }

  try {
    const candidateKeys: { key: string; name: string }[] = [];
    
    if (config?.apiKey) candidateKeys.push({ key: config.apiKey, name: "tenant_primary" });
    if (config?.openRouterApiKey) candidateKeys.push({ key: config.openRouterApiKey, name: "tenant_openrouter" });
    if (config?.anthropicApiKey) candidateKeys.push({ key: config.anthropicApiKey, name: "tenant_anthropic" });
    
    const sysDeepSeek = process.env.DEEPSEEK_API_KEY || getEnvKey("DEEPSEEK_API_KEY");
    if (sysDeepSeek) candidateKeys.push({ key: sysDeepSeek, name: "system_deepseek" });
    
    const sysOpenRouter = process.env.OPENROUTER_API_KEY;
    if (sysOpenRouter) candidateKeys.push({ key: sysOpenRouter, name: "system_openrouter" });
    
    const sysAnthropic = process.env.ANTHROPIC_API_KEY;
    if (sysAnthropic) candidateKeys.push({ key: sysAnthropic, name: "system_anthropic" });

    // Deduplicate candidate keys
    const uniqueCandidates: { key: string; name: string }[] = [];
    const seenKeys = new Set<string>();
    for (const c of candidateKeys) {
      const trimmed = c.key.trim();
      if (trimmed && !seenKeys.has(trimmed)) {
        seenKeys.add(trimmed);
        uniqueCandidates.push({ key: trimmed, name: c.name });
      }
    }

    if (uniqueCandidates.length === 0) {
      throw new Error("No LLM API keys configured in environment or tenant settings.");
    }

    let lastError: any = null;
    for (const cand of uniqueCandidates) {
      try {
        const keyType = detectKeyType(cand.key);
        console.log(`[AI Handler] Attempting LLM call with key ${cand.name} (${keyType})...`);
        const res = await callLLM(cand.key, systemPrompt, safeMessages, tools, temperature);
        return { res, provider: keyType };
      } catch (err: any) {
        console.error(`[AI Handler] Key ${cand.name} failed:`, err.message || err);
        lastError = err;
        // Keep looping to try the next key
      }
    }
    throw lastError || new Error("All LLM providers and fallbacks failed.");
  } finally {
    await slot.release();
  }
}

export interface LLMCallResult {
  content: any[];
  // Usage data for financial ledger
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  resolvedModel: string;   // exact model string that billed
  resolvedProvider: string; // 'anthropic' | 'deepseek' | 'openrouter'
  latencyMs: number;
}

async function callLLM(
  apiKey: string,
  systemPrompt: string,
  messages: any[],
  tools: any[],
  temperature = 0.7
): Promise<LLMCallResult> {
  const trimmed = apiKey.trim();
  const keyType = detectKeyType(trimmed);
  const callStart = Date.now();

  if (keyType === "anthropic") {
    const anthropic = new Anthropic({ apiKey: trimmed });
    const anthropicModels = [
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-haiku-20240307"
    ];
    let lastErr: any = null;
    for (const model of anthropicModels) {
      try {
        console.log(`[callLLM] Attempting Anthropic model ${model}...`);
        const res = await anthropic.messages.create({
          model: model,
          max_tokens: 400,
          system: systemPrompt,
          messages: messages as any,
          tools: tools.length > 0 ? tools : undefined,
          temperature: temperature,
        }, {
          timeout: 15000
        });
        console.log(`[callLLM] Anthropic model ${model} SUCCESS!`);
        const latencyMs = Date.now() - callStart;
        return {
          content: (res as any).content,
          inputTokens: res.usage?.input_tokens || 0,
          outputTokens: res.usage?.output_tokens || 0,
          cachedTokens: (res.usage as any)?.cache_read_input_tokens || 0,
          resolvedModel: model,
          resolvedProvider: 'anthropic',
          latencyMs,
        };
      } catch (err: any) {
        console.error(`[callLLM] Anthropic model ${model} error:`, err.message || err);
        lastErr = err;
        const errStr = (err?.message || String(err)).toLowerCase();
        if (errStr.includes("not_found") || errStr.includes("model") || err?.status === 404) {
          console.warn(`[callLLM] Model ${model} not found/supported. Trying next model...`);
          continue;
        }
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

    const hasImage = messages.some(msg => 
      Array.isArray(msg.content) && msg.content.some((block: any) => block.type === "image")
    );

    const isVisionModel = (modelName: string) => {
      const lower = modelName.toLowerCase();
      return lower.includes("gemini") || lower.includes("gpt-4") || lower.includes("gpt-4o") || lower.includes("claude");
    };

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

    const models = hasImage ? [
      "google/gemini-2.0-flash-001",
      "openai/gpt-4o-mini",
      "openrouter/auto"
    ] : [
      "deepseek/deepseek-chat",
      "google/gemini-2.0-flash-001",
      "openai/gpt-4o-mini",
      "meta-llama/llama-3.3-70b-instruct",
      "openrouter/auto"
    ];

    let lastError: any = null;
    let errorDetails: string[] = [];

    for (const model of models) {
      try {
        console.log(`[callLLM] Attempting OpenRouter model ${model} (hasImage: ${hasImage})...`);
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
            messages: isVisionModel(model) ? openAiMessages : cleanedMessages,
            tools: openAiTools.length > 0 ? openAiTools : undefined,
            max_tokens: 400,
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

        const latencyMs = Date.now() - callStart;
        return {
          content: anthropicContent,
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
          cachedTokens: 0,
          resolvedModel: model,
          resolvedProvider: 'openrouter',
          latencyMs,
        };
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

    let attempts = 2;
    let res: Response | null = null;
    let lastError: any = null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        console.log(`[callLLM] DeepSeek API attempt ${attempt} of ${attempts}...`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        res = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${trimmed}`
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: cleanedMessages,
            tools: openAiTools.length > 0 ? openAiTools : undefined,
            max_tokens: 400,
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
    const latencyMs = Date.now() - callStart;
    return {
      content: anthropicContent,
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
      cachedTokens: data.usage?.prompt_cache_hit_tokens || 0,
      resolvedModel: 'deepseek-chat',
      resolvedProvider: 'deepseek',
      latencyMs,
    };
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

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export class RedisLockManager {
  static getClient(): Redis | null {
    const client = getRedisClient();
    if (client && (client.status === "ready" || client.status === "connect")) {
      return client;
    }
    return null;
  }

  static async acquire(key: string, token: string, ttlMs: number): Promise<{ success: boolean; redisFailed: boolean }> {
    const client = this.getClient();
    if (!client) return { success: false, redisFailed: true };

    try {
      const result = await client.set(key, token, "PX", ttlMs, "NX");
      return { success: result === "OK", redisFailed: false };
    } catch (err) {
      console.warn(`[RedisLockManager] Failed to acquire lock in Redis for key ${key}:`, err);
      return { success: false, redisFailed: true };
    }
  }

  static async release(key: string, token: string): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;

    try {
      const result = await client.eval(RELEASE_SCRIPT, 1, key, token);
      return result === 1;
    } catch (err) {
      console.warn(`[RedisLockManager] Failed to release lock in Redis for key ${key}:`, err);
      return false;
    }
  }
}

export class DistributedLock {
  private static inMemoryLocks = new Map<string, { promise: Promise<void>; pendingCount: number }>();

  static async acquire(tenantId: string, customerId: string, ttlMs = 30000): Promise<{ release: () => Promise<void> }> {
    const lockKey = `lock:${tenantId}:${customerId}`;
    const token = crypto.randomUUID();
    const redisClient = RedisLockManager.getClient();

    if (redisClient) {
      const startTime = Date.now();
      let attempt = 0;
      let redisFailed = false;
      while (Date.now() - startTime < ttlMs) {
        const result = await RedisLockManager.acquire(lockKey, token, ttlMs);
        if (result.success) {
          let released = false;
          return {
            release: async () => {
              if (released) return;
              released = true;
              await RedisLockManager.release(lockKey, token);
            }
          };
        }
        if (result.redisFailed) {
          redisFailed = true;
          break;
        }
        attempt++;
        const baseDelay = Math.min(1000, Math.pow(2, attempt) * 25);
        const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1);
        const delay = Math.max(10, Math.round(baseDelay + jitter));
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      if (redisFailed) {
        console.warn(`[DistributedLock] Redis lock acquisition failed due to Redis outage. Falling back to in-memory lock for ${lockKey}.`);
      } else {
        throw new Error(`Lock acquisition timed out for key ${lockKey}`);
      }
    }

    const memKey = `${tenantId}:${customerId}`;
    let queue = this.inMemoryLocks.get(memKey);
    if (!queue) {
      queue = { promise: Promise.resolve(), pendingCount: 0 };
      this.inMemoryLocks.set(memKey, queue);
    }
    queue.pendingCount++;
    const previousPromise = queue.promise;
    
    let resolveLock: () => void;
    const currentPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    queue.promise = currentPromise;

    await previousPromise;

    let released = false;
    return {
      release: async () => {
        if (released) return;
        released = true;
        resolveLock();
        const currentQueue = this.inMemoryLocks.get(memKey);
        if (currentQueue) {
          currentQueue.pendingCount--;
          if (currentQueue.pendingCount <= 0) {
            this.inMemoryLocks.delete(memKey);
          }
        }
      }
    };
  }
}

export class IngressRateLimiter {
  private static inMemoryBuckets = new Map<string, { tokens: number; lastRefill: number }>();

  static async isAllowed(tenantId: string, limitPerMin = 60): Promise<boolean> {
    const redisClient = RedisLockManager.getClient();
    const key = `ratelimit:${tenantId}`;

    if (redisClient) {
      try {
        const now = Date.now();
        const refillRate = limitPerMin / 60000;
        const maxTokens = limitPerMin;

        const luaScript = `
          local key = KEYS[1]
          local limit = tonumber(ARGV[1])
          local now = tonumber(ARGV[2])
          local refill_rate = tonumber(ARGV[3])

          local data = redis.call("HMGET", key, "tokens", "last_refill")
          local tokens = tonumber(data[1])
          local last_refill = tonumber(data[2])

          if not tokens then
            tokens = limit
            last_refill = now
          else
            local elapsed = now - last_refill
            tokens = math.min(limit, tokens + elapsed * refill_rate)
            last_refill = now
          end

          if tokens >= 1 then
            tokens = tokens - 1
            redis.call("HMSET", key, "tokens", tokens, "last_refill", last_refill)
            redis.call("PEXPIRE", key, 60000)
            return 1
          else
            redis.call("HMSET", key, "tokens", tokens, "last_refill", last_refill)
            redis.call("PEXPIRE", key, 60000)
            return 0
          end
        `;

        const allowed = await redisClient.eval(luaScript, 1, key, maxTokens, now, refillRate);
        return allowed === 1;
      } catch (err) {
        console.warn(`[IngressRateLimiter] Redis rate limiter failed, falling back to in-memory:`, err);
      }
    }

    const now = Date.now();
    const refillRate = limitPerMin / 60000;
    const maxTokens = limitPerMin;

    let bucket = this.inMemoryBuckets.get(tenantId);
    if (!bucket) {
      bucket = { tokens: maxTokens, lastRefill: now };
      this.inMemoryBuckets.set(tenantId, bucket);
    } else {
      const elapsed = now - bucket.lastRefill;
      bucket.tokens = Math.min(maxTokens, bucket.tokens + elapsed * refillRate);
      bucket.lastRefill = now;
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }
    return false;
  }
}

interface HybridMatchResult {
  matched: boolean;
  reply?: string;
  source?: "sequential_flow" | "manual_keyword" | "knowledge_base_faq" | "product_catalog";
  image?: string;
  images?: string[];
  imageCaption?: string;
}

function isKeywordMatch(query: string, target: string): boolean {
  const cleanQuery = query.toLowerCase().trim();
  const cleanTarget = target.toLowerCase().trim();
  
  if (cleanQuery.includes(cleanTarget) || cleanTarget.includes(cleanQuery)) {
    return true;
  }
  
  const queryWords = cleanQuery.split(/[\s,.-]+/);
  const targetWords = cleanTarget.split(/[\s,.-]+/);
  
  for (const qw of queryWords) {
    if (qw.length < 3) continue;
    const qwStem = qw.endsWith('s') ? qw.slice(0, -1) : qw;
    
    for (const tw of targetWords) {
      if (tw.length < 3) continue;
      const twStem = tw.endsWith('s') ? tw.slice(0, -1) : tw;
      
      if (qwStem === twStem || qwStem.includes(twStem) || twStem.includes(qwStem)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Dynamic Hybrid Engine Router
 * Automatically derives keyword rules from Knowledge Base (productInfo/knowledgeBase) & Product Catalog (products).
 * Manages 0-token Sequential Chatbot Flows & instant rule-based responses.
 */
export async function processHybridEngine(
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

  // Clean up any stale [FLOW_STATE: ...] tags from customer preferences if present
  const preferencesNote = customer?.preferences || "";
  if (preferencesNote.includes("[FLOW_STATE:")) {
    const cleanedNote = preferencesNote.replace(/\[FLOW_STATE:[^\]]+\]/g, "").trim();
    await DB.updateCustomer(from, { preferences: cleanedNote }, tenantId);
  }

  // 1. FAST-PATH: Category & Instant Catalog / Menu Generator with Multi-Image Album Burst (0 Tokens)
  if (products.length > 0) {
    const isMenuRequest = ["menu", "show menu", "send menu", "deikhao menu", "dikhao menu", "menu bhajo", "menu do", "menu bhej do", "catalog", "rate list", "list", "card", "website", "products", "services", "deals", "deal", "special deal", "deal dikhao", "deals dikhao", "kya khane ko hai", "khane ko kya hai", "kya kya hai"].some(w => lowerContent === w || lowerContent.includes(w));
    
    const isValidImage = (img: any): boolean => {
      return img && typeof img === 'string' && 
             (img.startsWith('http://') || img.startsWith('https://') || img.startsWith('data:image/'));
    };

    // FAST-PATH: If they ask for the menu, search for products named "Menu" / "menu." or in the "Menu" category (which represent the board images).
    if (isMenuRequest) {
      const menuBoardProducts = products.filter(p => 
        (p.title && /^menu\.?$/i.test(p.title.trim())) || 
        (p.category && /^menu\.?$/i.test(p.category.trim()))
      );

      if (menuBoardProducts.length > 0) {
        const albumImages: string[] = [];
        menuBoardProducts.forEach(p => {
          if (isValidImage(p.image)) {
            if (!albumImages.includes(p.image.trim())) albumImages.push(p.image.trim());
          }
          if (isValidImage(p.imageUrl)) {
            if (!albumImages.includes(p.imageUrl.trim())) albumImages.push(p.imageUrl.trim());
          }
          if (p.images && Array.isArray(p.images)) {
            p.images.forEach((img: string) => {
              if (isValidImage(img) && !albumImages.includes(img.trim())) {
                albumImages.push(img.trim());
              }
            });
          }
          if (p.imageUrls && Array.isArray(p.imageUrls)) {
            p.imageUrls.forEach((img: string) => {
              if (isValidImage(img) && !albumImages.includes(img.trim())) {
                albumImages.push(img.trim());
              }
            });
          }
        });

        if (albumImages.length > 0) {
          const businessName = activeTenant?.businessName || config.businessName || "Pizza Box";
          console.log(`[AI Handler] Menu board fast-path: returning ${albumImages.length} images.`);
          return {
            matched: true,
            reply: `Yeh raha *${businessName}* ka menu! 🍕📋 Aur kuch order karna chahenge?`,
            images: albumImages,
            source: "product_catalog"
          };
        }
      }
    }

    // Synonym mappings to standard categories for Pizza Box & general stores
    const categorySynonyms: Record<string, string[]> = {
      "Starters": ["wings", "wing", "hot wings", "flaming wings", "chicken wings", "fries", "nuggets", "cheese sticks", "chunks", "starters", "platter", "spin roll"],
      "Beverages": ["drink", "drinks", "bottle", "bottles", "coke", "pepsi", "sprite", "7up", "fanta", "dew", "cola", "water", "beverage", "soft drink", "botol"],
      "Burgers & Sandwiches": ["burger", "burgers", "sandwich", "sandwiches", "zinger", "patty"],
      "Pasta": ["pasta", "pastas", "alfredo", "macaroni"],
      "Salad & Dessert": ["dessert", "desserts", "sweet", "sweets", "cake", "lava cake", "salad"],
      "Legends Pizza": ["legends pizza", "pizza", "pizzas"],
      "Ultimates Pizza": ["ultimates pizza", "pizza", "pizzas"],
      "Signature Pizza": ["signature pizza", "pizza", "pizzas"]
    };

    const matchedCategories = new Set<string>();
    for (const [catName, synonyms] of Object.entries(categorySynonyms)) {
      for (const syn of synonyms) {
        const regex = new RegExp(`\\b${syn}\\b`, 'i');
        if (regex.test(lowerContent)) {
          matchedCategories.add(catName);
          break;
        }
      }
    }

    // Bypassing rule engine for complex multiple-category questions to let LLM formulate natural responses
    if (matchedCategories.size > 1) {
      console.log(`[AI Handler] Bypassing Hybrid Engine: user query spans multiple categories (${Array.from(matchedCategories).join(', ')}).`);
      return { matched: false };
    }

    let matchedProducts: any[] = [];
    if (matchedCategories.size > 0) {
      const activeCats = Array.from(matchedCategories).map(c => c.toLowerCase().trim());
      matchedProducts = products.filter(p => {
        if (!p.category) return false;
        const pCatLower = p.category.toLowerCase().trim();
        const isCatMatch = activeCats.includes(pCatLower);
        if (!isCatMatch) return false;

        const cleanTitle = p.title ? p.title.toLowerCase().trim() : "";
        const queryWords = lowerContent.split(/[\s,.-]+/);
        const titleWords = cleanTitle.split(/[\s,.-]+/);
        
        // Exact title match or query contains word stem
        const titleMatch = titleWords.some((tw: string) => {
          if (tw.length < 3) return false;
          const twStem = tw.endsWith('s') ? tw.slice(0, -1) : tw;
          return queryWords.some((qw: string) => {
            if (qw.length < 3) return false;
            const qwStem = qw.endsWith('s') ? qw.slice(0, -1) : qw;
            return qwStem === twStem;
          });
        });

        let specificMatch = false;
        if (cleanTitle.includes("soft drink") && ["coke", "sprite", "7up", "pepsi", "fanta", "dew", "drink", "bottle", "botol"].some(w => lowerContent.includes(w))) {
          specificMatch = true;
        }
        if (cleanTitle.includes("water") && ["water", "paani", "pani"].some(w => lowerContent.includes(w))) {
          specificMatch = true;
        }
        
        return titleMatch || specificMatch || lowerContent.includes(cleanTitle) || cleanTitle.includes(lowerContent);
      });
    } else {
      matchedProducts = products.filter(p => {
        if (!p.title) return false;
        const cleanTitle = p.title.toLowerCase().trim();
        if (/^menu\.?$/i.test(cleanTitle) || (p.category && /^menu\.?$/i.test(p.category.trim()))) return false;

        const queryWords = lowerContent.split(/[\s,.-]+/);
        const titleWords = cleanTitle.split(/[\s,.-]+/);
        
        const titleMatch = titleWords.some((tw: string) => {
          if (tw.length < 3) return false;
          const twStem = tw.endsWith('s') ? tw.slice(0, -1) : tw;
          return queryWords.some((qw: string) => {
            if (qw.length < 3) return false;
            const qwStem = qw.endsWith('s') ? qw.slice(0, -1) : qw;
            return qwStem === twStem;
          });
        });

        return titleMatch || lowerContent.includes(cleanTitle) || cleanTitle.includes(lowerContent);
      });
    }

    // A. Specific Item Request matched
    if (matchedProducts.length > 0 && !isMenuRequest) {
      const uniqueMatched = matchedProducts.filter((v, i, a) => a.findIndex(t => t.title === v.title) === i);
      
      let replyText = `📜 *${activeTenant?.businessName || config.businessName || "Pizza Box"} Menu* 🍕🍔\n\n`;
      const albumImages: string[] = [];
      
      uniqueMatched.forEach(p => {
        const cleanPrice = p.price ? p.price.replace(new RegExp(currency, 'gi'), '').trim() : "";
        const priceDisplay = cleanPrice && cleanPrice !== "0" && cleanPrice !== "N/A" ? `${currency} ${cleanPrice}` : "N/A";
        replyText += `• *${p.title}* — ${priceDisplay}\n`;
        
        if (isValidImage(p.image)) {
          if (!albumImages.includes(p.image.trim())) albumImages.push(p.image.trim());
        }
        if (isValidImage(p.imageUrl)) {
          if (!albumImages.includes(p.imageUrl.trim())) albumImages.push(p.imageUrl.trim());
        }
        if (p.images && Array.isArray(p.images)) {
          p.images.forEach((img: string) => {
            if (isValidImage(img) && !albumImages.includes(img.trim())) {
              albumImages.push(img.trim());
            }
          });
        }
      });
      
      replyText += `\nKaunsa order karna hai aur kitne pieces/quantity?`;
      
      return {
        matched: true,
        reply: replyText,
        images: albumImages.length > 0 ? albumImages.slice(0, 15) : undefined,
        source: "product_catalog"
      };
    }

    // B. Full Menu/Catalog Request matched
    if (isMenuRequest) {
      const displayProducts = products.filter(p => {
        if (!p.title) return false;
        const titleLower = p.title.toLowerCase().trim();
        if (["menu", "menu.", "pizza menu", "website", "link", "card"].includes(titleLower)) return false;
        if (p.category && /^menu\.?$/i.test(p.category.trim())) return false;
        return true;
      });

      let menuText = `📜 *${activeTenant?.businessName || config.businessName || "Pizza Box"} Menu* 🍕🍔\n\n`;
      const grouped: Record<string, any[]> = {};
      
      displayProducts.forEach(p => {
        const cat = p.category || "Menu Items";
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(p);
      });
      
      const albumImages: string[] = [];
      let itemCount = 0;
      for (const [cat, items] of Object.entries(grouped)) {
        menuText += `*${cat.toUpperCase()}*\n`;
        items.forEach(p => {
          itemCount++;
          const cleanPrice = p.price ? p.price.replace(new RegExp(currency, 'gi'), '').trim() : "";
          const priceDisplay = cleanPrice && cleanPrice !== "0" && cleanPrice !== "N/A" ? `${currency} ${cleanPrice}` : "";
          menuText += `• *${p.title}*${priceDisplay ? ` — ${priceDisplay}` : ""}\n`;
          
          if (isValidImage(p.image)) {
            if (!albumImages.includes(p.image.trim())) albumImages.push(p.image.trim());
          }
          if (isValidImage(p.imageUrl)) {
            if (!albumImages.includes(p.imageUrl.trim())) albumImages.push(p.imageUrl.trim());
          }
        });
        menuText += `\n`;
      }
      
      if (itemCount > 0) {
        menuText += `Order karne ke liye item ka naam aur quantity bata dein! 😊`;
        return {
          matched: true,
          reply: menuText,
          images: albumImages.length > 0 ? albumImages.slice(0, 15) : undefined,
          source: "product_catalog"
        };
      }
    }
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

  // Pure LLM / RAG Agent handles product inquiries, order conversation, sizes, address collection, & tool calling (`place_order`)!
  return { matched: false };
}

export async function handleWhatsAppMessage(msg: any, inputTenantId?: string) {
  try {
    const remoteJid = msg?.key?.remoteJid;
    console.log(`[AI Handler] ▶ Incoming message event. remoteJid=${remoteJid} tenantId=${inputTenantId || 'unset'}`);
    if (!remoteJid || remoteJid === "status@broadcast" || remoteJid.endsWith("@g.us") || remoteJid.endsWith("@newsletter")) {
      console.log(`[AI Handler] Skipping non-user message (${remoteJid})`);
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
        // Prefer the alt JID if available (contains the real phone number)
        from = msg.key.remoteJidAlt;
        console.log(`[AI Handler] @lid JID resolved via remoteJidAlt: ${from}`);
      } else {
        // Extract the numeric ID from the @lid JID itself as a stable identifier
        from = from.replace("@lid", "");
        console.log(`[AI Handler] @lid JID has no alt — using numeric lid ID as customer key: ${from}`);
      }
    }
    from = from?.replace("@s.whatsapp.net", "");
    if (!from) return;

    const tenantId = inputTenantId || await WhatsAppManager.resolveTenantForPhone(from);
    console.log(`[AI Handler] Resolved tenantId=${tenantId} from=${from}`);

    // 1. System Backpressure Check
    const queueLength = await getQueueLength();
    if (queueLength >= 1000) {
      console.warn(`[AI Handler] System Backpressure Exceeded (Queue Length: ${queueLength}). Dropping message from ${from}.`);
      
      await logAppError({
        service: 'queue-manager',
        operation: 'enqueue',
        error: new Error('QueueBackpressureExceeded: Worker queue is full (>1000 jobs)'),
        tenantId,
        severity: 'critical'
      });

      await DB.recordApiAlert('System Backpressure', 'circuit_open', `Backpressure limit exceeded (Queue length: ${queueLength}). Message dropped.`);

      try {
        await WhatsAppManager.sendMessage(from, "AOA! HazelWhat AI is currently experiencing very high demand. 🤖 Please wait a moment and send your message again. Thank you!", tenantId);
      } catch (e) {
        console.error("[AI Handler] Failed to send backpressure warning message:", e);
      }
      return;
    }

    // 2. Tenant Ingress Rate Limiting Check
    const config = await DB.getConfig(tenantId);
    const limit = (config as any)?.rateLimitPerMinute || 60;
    const allowed = await IngressRateLimiter.isAllowed(tenantId, limit);
    if (!allowed) {
      console.warn(`[AI Handler] Ingress Rate Limit Exceeded for tenant ${tenantId} (Limit: ${limit}/min). Dropping message from ${from}.`);
      
      await logAppError({
        service: 'ingest-api',
        operation: 'receive',
        error: new Error(`RateLimitExceeded: Ingress rate limit of ${limit}/min exceeded for tenant ${tenantId}`),
        tenantId,
        severity: 'medium'
      });

      await DB.recordApiAlert('Ingress Rate Limit', 'quota_exceeded', `Rate limit of ${limit}/min exceeded for tenant ${tenantId}. Message dropped.`);
      return;
    }

    // Enqueue message into high-throughput BullMQ / Worker Queue Pool (Concurrency: 20)
    await enqueueWhatsAppMessageJob(msg, tenantId, from);
  } catch (error) {
    console.error("[AI Handler] handleWhatsAppMessage outer error:", error);
  }
}

async function processWhatsAppWorkerJob(payload: WhatsAppJobPayload) {
  const { msg, tenantId, customerId } = payload;

  let lockHandle: { release: () => Promise<void> } | undefined;

  try {
    // Call the correct inline DistributedLock.acquire(tenantId, customerId, ttlMs)
    lockHandle = await DistributedLock.acquire(tenantId, customerId, 30000);
    
    const processPromise = processWhatsAppMessage(msg, customerId, tenantId);
    const timeoutPromise = new Promise<void>((_, reject) => 
      setTimeout(() => reject(new Error("Message processing timed out (35s)")), 35000)
    );
    await Promise.race([processPromise, timeoutPromise]);
  } catch (error: any) {
    console.error(`[AI Handler] Processing failure for customer ${customerId} under tenant ${tenantId}:`, error.message || error);
    // Rethrow to let the queue manager know the job failed and should be retried or sent to DLQ
    throw error;
  } finally {
    if (lockHandle) {
      await lockHandle.release().catch((releaseErr: any) => {
        console.warn(`[AI Handler] Failed to release lock for customer ${customerId}:`, releaseErr.message || releaseErr);
      });
    }
  }
}

// Register high-throughput worker pool (Concurrency: 20)
registerQueueWorker(processWhatsAppWorkerJob);

async function processWhatsAppMessage(msg: any, from: string, inputTenantId?: string) {
  let resolvedTenantId: string | undefined = inputTenantId || undefined;
  try {
    const interactiveResponse = msg.message?.interactiveResponseMessage;
    let content = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || "";
    
    // Resolve Tenant ID early!
    resolvedTenantId = inputTenantId || WhatsAppManager.getActiveTenantId() || undefined;
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
      console.log(`[AI Handler] Voice note detected. Audio buffer size: ${audioBuffer.length} bytes. Mime: ${audioMime}`);
      voiceTranscript = await transcribeAudio(audioBuffer, audioMime, config, resolvedTenantId);
      
      if (voiceTranscript) {
        // Run regex digit extraction for address validation (STT Safeguard)
        const digits = voiceTranscript.match(/\b(?:\d+|#\s*\d+|house\s*#?\s*\d+|street\s*#?\s*\d+|flat\s*#?\s*\d+)\b/gi) || [];
        const isAddressRelated = /(address|house|makan|flat|street|gali|block|sector|town|colony|phase|road|scheme|iqbal|gulberg|dha|bahria|pechs)/i.test(voiceTranscript);

        if (isAddressRelated) {
          if (digits.length > 0) {
            content = `[Customer Voice Note Transcribed - Extracted Digits: ${digits.join(', ')}]: "${voiceTranscript}"\n(System Note: Digit sequence detected in address voice note. Explicitly confirm back: "House #${(digits[0] || '').replace(/[^0-9]/g, '')}, [Area] — sahi hai?" Let customer verify or correct via text!)`;
          } else {
            content = `[Customer Voice Note Transcribed - NO CLEAR HOUSE DIGITS DETECTED]: "${voiceTranscript}"\n(System Note: This voice note mentions location/area but NO clear House # / Flat # digits were found. Explicitly request the customer to type their House/Flat number as a TYPED TEXT reply!)`;
          }
        } else {
          content = `[Customer Voice Note Transcribed]: "${voiceTranscript}"`;
        }
        console.log(`[AI Handler] Voice transcribed successfully! Content set to: "${content}"`);
      } else if (!content) {
        content = "[Customer sent a Voice Note]: (The audio was unclear or silent. Politely ask the customer to resend their audio or specify what they need.)";
        console.log(`[AI Handler] STT yielded empty transcript — using polite clarification instruction for AI.`);
      }
    }
    const lowerContent = (content || "").toLowerCase().trim();

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
    
    let existingCustomer = await DB.getCustomer(from, resolvedTenantId);

    // Heuristic Auto-Complaint Detection (word-boundary aware, false-positive resistant)
    // Strong complaint signals — these alone are sufficient
    const strongComplaintSignals = [
      "complain", "complaint", "shikayat", "fraud", "scam", "refund", "wapas karo",
      "defective", "defect", "khraab tha", "kharab tha", "kharaab tha",
      "naqis tha", "bekar tha", "ganda tha", "messed", "replacement chahiye",
      "broken", "tuta hua", "toota hua", "missing tha", "nahi mila tha",
    ];
    // Weaker signals — only count if paired with another weak signal or strong signal
    const weakComplaintSignals = [
      "kharab", "khraab", "kharaab", "naqis", "bekar", "galat", "wrong",
      "late", "delay", "tuta", "toota", "thanda", "rude", "ganda",
    ];
    // Order exclusion terms — presence of these reduces complaint likelihood
    const orderPositiveTerms = [
      "order karna", "chahiye", "deliver", "menu", "price", "rate", "available",
      "kitna", "kya hai", "batao", "show", "bohat acha", "shukriya", "thank",
    ];

    const hasOrderPositiveContext = orderPositiveTerms.some(t => lowerContent.includes(t));
    const strongSignalMatch = strongComplaintSignals.some(w => lowerContent.includes(w));
    
    // Count weak signals using word-boundary check
    const contentWords = lowerContent.split(/\s+/);
    const weakSignalCount = weakComplaintSignals.filter(w => {
      if (w.includes(" ")) return lowerContent.includes(w);
      return contentWords.some((word: string) => word === w || word === w + "!" || word === w + "." || word === w + ",");
    }).length;

    // Decision: strong signal always fires; weak signals need 2+ AND no order context
    const isHeuristicComplaint = strongSignalMatch || (weakSignalCount >= 2 && !hasOrderPositiveContext);

    if (isHeuristicComplaint) {
      let currentPrefs: any = {};
      try {
        if (existingCustomer?.preferences) {
          currentPrefs = JSON.parse(existingCustomer.preferences);
        }
      } catch (e) {
        if (existingCustomer?.preferences) {
          currentPrefs = { notes: existingCustomer.preferences };
        }
      }
      
      if (!currentPrefs.hasComplaint) {
        currentPrefs.hasComplaint = true;
        currentPrefs.complaintSummary = content.substring(0, 100) + (content.length > 100 ? "..." : "");
        await DB.updateCustomer(from, { preferences: JSON.stringify(currentPrefs) }, resolvedTenantId);
        // Refresh customer reference
        existingCustomer = await DB.getCustomer(from, resolvedTenantId);
      }
    }

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
      if (hybridResult.images && hybridResult.images.length > 0) {
        try {
          console.log(`[AI Handler] Sending Category Album Burst (${hybridResult.images.length} images)...`);
          await WhatsAppManager.sendMediaAlbumBurst(from, hybridResult.images, hybridResult.reply, resolvedTenantId);
          await DB.addChatMessage(from, { role: "assistant", content: hybridResult.reply }, resolvedTenantId);
          return;
        } catch (imgErr) {
          console.error("[AI Handler] Failed to send hybrid result album images:", imgErr);
        }
      } else if (hybridResult.image) {
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
    const activeProducts = (config.products && config.products.length > 0) ? config.products : (activeTenant?.products || []);
    const activeCurrency = activeTenant?.currency || config.storeCurrency || "PKR";
    const activeBusinessName = activeTenant?.businessName || activeTenant?.name || config.businessName || "our store";

    // 1. Fast Keyword & Greeting Guardrail (Zero-Cost Local Fast Path)
    const cleanGreetingContent = lowerContent.replace(/[^\w\s]/gi, "").trim();

    if (config.keywordReplies && Array.isArray(config.keywordReplies)) {
      for (const kr of config.keywordReplies) {
        if (kr.keyword && lowerContent.includes(kr.keyword.toLowerCase())) {
          console.log(`[AI Handler Guardrail] Fast-path keyword match for "${kr.keyword}". Replying without LLM call.`);
          const sentMsg = await WhatsAppManager.sendMessage(from, kr.reply);
          await DB.addChatMessage(from, { id: sentMsg?.key?.id, role: "assistant", content: kr.reply }, resolvedTenantId);
          return;
        }
      }
    }

    const existingChats = await DB.getChats(from, resolvedTenantId);
    const simpleGreetings = new Set(["hi", "hello", "hey", "aoa", "assalam o alaikum", "assalamu alaikum", "slam", "salam"]);

    const tenantChats = existingChats.filter((m: any) => m.role === 'user' || m.role === 'assistant');
    const lastTenantWelcome = tenantChats.findIndex((m: any) => m.role === 'assistant' && m.content?.includes(`Welcome to ${activeBusinessName}`));

    // Temporal Reset Guard: If the last message was more than 4 hours ago, treat this as a fresh session
    const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
    const lastMsg = tenantChats[tenantChats.length - 1];
    let isTemporalReset = false;
    if (lastMsg) {
      const lastMsgTime = new Date(lastMsg.timestamp || (lastMsg as any).created_at || Date.now()).getTime();
      if (Date.now() - lastMsgTime > FOUR_HOURS_MS) {
        isTemporalReset = true;
      }
    }

    // It's a new session if: no previous chat with this tenant, OR last message was a greeting with nothing after, OR total messages very few, OR a long time has passed since last interaction.
    const isNewSession = tenantChats.length <= 1 || (lastTenantWelcome < 0 && tenantChats.length <= 2) || isTemporalReset;

    if (isNewSession && simpleGreetings.has(cleanGreetingContent)) {
      const fastGreeting = `Walaikum Assalam! Welcome to ${activeBusinessName}. How can I assist you today?`;
      console.log(`[AI Handler Guardrail] Fast-path greeting reply for "${cleanGreetingContent}". Replying without LLM call.`);
      const sentMsg = await WhatsAppManager.sendMessage(from, fastGreeting);
      await DB.addChatMessage(from, { id: sentMsg?.key?.id, role: "assistant", content: fastGreeting }, resolvedTenantId);
      return;
    }

    // 2. Smart Product Catalog Slicing (RAG Light - Token Optimization)
    const filteredProducts = filterRelevantProducts(activeProducts, content);
    const structuredCatalog = filteredProducts.length > 0 ? formatProductsToCatalog(filteredProducts, activeCurrency) : "";
    const activeProductCatalog = structuredCatalog.replace(/data:image\/[a-zA-Z0-9+\/=;-]+;base64,[A-Za-z0-9+\/=]+/g, "[Image]");
    const catalogNote = activeProducts.length > filteredProducts.length ? `\n(Showing top ${filteredProducts.length} relevant items out of ${activeProducts.length} total catalog products.)` : "";
    const customerAny = customer as any;
    let savedCustomerAddress = customerAny?.address || customerAny?.deliveryAddress || "";
    let savedContactNumber = "";
    let savedServicePreference = "";
    let savedProductPreference = "";
    let savedAppointmentDate = "";
    let savedAppointmentTime = "";
    let savedNotes = "";

    if (customer?.preferences) {
      try {
        const parsedPrefs = JSON.parse(customer.preferences);
        if (parsedPrefs.deliveryAddress) savedCustomerAddress = parsedPrefs.deliveryAddress;
        if (parsedPrefs.contactNumber) savedContactNumber = parsedPrefs.contactNumber;
        if (parsedPrefs.servicePreference) savedServicePreference = parsedPrefs.servicePreference;
        if (parsedPrefs.productPreference) savedProductPreference = parsedPrefs.productPreference;
        if (parsedPrefs.appointmentDate) savedAppointmentDate = parsedPrefs.appointmentDate;
        if (parsedPrefs.appointmentTime) savedAppointmentTime = parsedPrefs.appointmentTime;
        if (parsedPrefs.notes) savedNotes = parsedPrefs.notes;
      } catch (e) {
        if (!savedCustomerAddress && customer.preferences.length > 5 && !customer.preferences.includes("{")) {
          savedCustomerAddress = customer.preferences;
        }
      }
    }

    // 3. DeepSeek Prompt Cache Prefix Assembly (Static Top, Dynamic Bottom)
    const botPurposeMode = config.botMode || "both";
    let fullSystemPrompt = `${activeSystemPrompt}\n\n=== BOT MODE: ${botPurposeMode.toUpperCase()} (ORDERS & APPOINTMENTS SUPPORTED) ===\n`;

    // Append FAQs and Business Knowledge Base (Product Info) to prompt context!
    if (config.productInfo && config.productInfo.trim() !== '') {
      fullSystemPrompt += `\n\n=== BUSINESS KNOWLEDGE BASE & FAQS (Use this to answer customer questions) ===\n${config.productInfo}\n=======================================================\n`;
    }

    fullSystemPrompt += `\n=== CUSTOMER SAVED PROFILE DATA (Variables extracted from conversation) ===\n`;
    fullSystemPrompt += `- Name: ${customer?.name || "None"}\n`;
    fullSystemPrompt += `- Phone / JID: ${from}\n`;
    fullSystemPrompt += `- Delivery Address: ${savedCustomerAddress || "None"}\n`;
    fullSystemPrompt += `- Secondary Contact Number: ${savedContactNumber || "None"}\n`;
    fullSystemPrompt += `- Service Preference: ${savedServicePreference || "None"}\n`;
    fullSystemPrompt += `- Product Preference: ${savedProductPreference || "None"}\n`;
    fullSystemPrompt += `- Preferred Appointment Date: ${savedAppointmentDate || "None"}\n`;
    fullSystemPrompt += `- Preferred Appointment Time: ${savedAppointmentTime || "None"}\n`;
    if (savedNotes) fullSystemPrompt += `- Saved Notes/Preferences: ${savedNotes}\n`;
    fullSystemPrompt += `===================================\n`;

    fullSystemPrompt += `\n=== CRITICAL RULES FOR ORDERS & APPOINTMENT BOOKINGS ===
1. ADDRESS PERSISTENCE & SAVED ADDRESS RULE:
   - Check if "Delivery Address" in CUSTOMER SAVED PROFILE DATA is provided (${savedCustomerAddress ? `"${savedCustomerAddress}"` : "None"}).
   - IF A SAVED ADDRESS IS PRESENT: DO NOT ASK FOR THE DELIVERY ADDRESS AGAIN!
   - Instead, confirm: "Hum aapka order is pehle se saved address par deliver kar rahe hain: ${savedCustomerAddress}. (Agar address change karna ho to humein bata dein!)"
   - ONLY ask for a delivery address if NO saved address exists or if the customer explicitly says they want to deliver to a new/different address.

2. MULTIPLE FOOD ITEMS IN SINGLE ORDER:
   - Customers can order multiple items and quantities at once (e.g. "Mujhe 2 Zinger Burgers, 1 Medium Pepperoni Pizza, aur 2 Mint Margaritas chahiye").
   - You MUST support multi-item orders in a single transaction.
   - Calculate total cost per item (Quantity x Unit Price).
   - Calculate Grand Total Bill (Sum of all items).
   - Call place_order tool with:
     * productName: Combine all items ordered with quantities & sizes (e.g. "2x Smokey Zinger Burger Supreme, 1x Gourmet Pepperoni Feast Pizza (Medium), 2x Chilled Mint Margarita")
     * price: Total calculated bill (e.g. "3680")
     * deliveryAddress: The saved address ("${savedCustomerAddress || ""}") or user's provided address.

3. Call the send_product_card function ONLY ONCE when FIRST recommending or introducing a product to the customer.
4. NEVER call send_product_card again if you have ALREADY shown the product card in recent chat history, or if the customer is already in the process of placing an order. Just ask for their order details directly in text!
5. You must NEVER write raw image links or URLs in the text message!
6. If a product has SIZE VARIATIONS (Small, Medium, Large) with different prices:
   a. First call send_product_card with price set to "Hidden"
   b. Ask the customer: "Konsa size chahiye? Small / Medium / Large?" and state prices.
   c. Confirm the exact price from the catalog after choice.
7. BE CONVERSATIONAL AND NATURAL. You are a real team member for ${activeBusinessName}, not a robotic template machine.
   - Keep replies SHORT (2-4 sentences max per message).
8. NO REPEATING GREETINGS: If you have ALREADY greeted this customer, DO NOT say Walaikum Assalam again. Answer their latest question directly.
9. INSTANT ORDER COLLECTION FLOW (ZERO-DELAY MODE):
    a. Determine items, quantities, and sizes directly from the user's message.
    b. Check saved address variable "${savedCustomerAddress || ""}" OR address mentioned in the message:
       - IF address is provided in the message OR saved in profile: Do NOT ask for address confirmation. IMMEDIATELY call place_order tool in your VERY FIRST response!
       - IF address is missing completely: Simply ask for delivery address in 1 short sentence. As soon as address is received, call place_order tool.
    c. DO NOT ASK FOR PAYMENT METHOD! Always default to "Cash on Delivery" (COD).
    d. Do NOT ask for phone number (we already have it from WhatsApp).
    e. MANDATORY RULE: NEVER confirm an order in text alone without calling place_order tool! You MUST execute the place_order tool call whenever an order is confirmed.

9_2. APPOINTMENT BOOKING FLOW (FOR SERVICES & SALON BOOKINGS):
    a. Determine the service the customer wants to book.
    b. Check availability for date/time slot (using checkAvailability tool).
    c. Ask for customer's full name if missing.
    d. MANDATORY RULE: NEVER confirm an appointment in text alone without calling the bookAppointment tool!

9_3. PROACTIVE COMPLAINT LOGGING:
    - If customer expresses ANY negative experience, late delivery, cold food, bad behavior, wrong item, or dissatisfaction, YOU MUST IMMEDIATELY call update_customer_profile with has_complaint=true and complaint_summary.

10. CATALOG ACCURACY & INSTANT ORDER EXECUTION:
    - Quote items/prices from catalog. When a clear intent to buy is detected with an address or existing profile, execute place_order tool immediately!
11. PROACTIVE FOLLOW-UPS: If you promise to check back or follow up with the customer later, you MUST call schedule_followup tool with the appropriate time.
12. CRM PROFILE UPDATES (INCREMENTAL VARIABLE-SAVING FLOW):
    - As soon as the customer mentions any of their details (name, contact number, delivery address, preferred service/product, or requested appointment date/time), you MUST call the update_customer_profile tool immediately to persist these variables in the database.
    - If the customer expresses dissatisfaction, complains about an order/delivery/service, or registers an issue, you MUST call the update_customer_profile tool immediately with has_complaint set to true and a brief 1-2 sentence complaint_summary summarizing the issue.
    - Do NOT wait until the end of the conversation or booking to call this tool. Use it to record details step-by-step as they are disclosed in chat.
13. VOICE NOTES: When you receive a voice note (marked with 🎤 [Voice Note] followed by the transcription), respond directly to what they said. Treat the transcription as if the customer typed it.
14. ROMAN URDU PERSONA & LANGUAGE SUPPORT:
   - Always respond in natural, polite Roman Urdu for all bookings, orders, and inquiries!
   - Example: "Aapka order note kar liya hai! 🍕🍔 Total bill PKR 900 hai. Delivery address (House #, Street, Area) bata dein:"
   - Example for Salon: "Aapki appointment book kar di hai! 📅 Parso 4 PM par, Old Airport branch. Sahi hai?"
   - Keep vocabulary local, friendly, and natural.
15. MENU & CATALOG DISPLAY RULE:
   - When a customer asks for the menu, catalog, or available items (e.g. "menu", "menu bhajo", "show menu", "rate list"):
   - YOU MUST PRINT THE ITEMS AND THEIR PRICES IN YOUR TEXT RESPONSE formatted neatly with category headers!
   - NEVER say "Menu bhej rahe hain" without actually writing out the items and prices in the message.
16. HOUSE NUMBER & STT ADDRESS ACCURACY GUARANTEE:
   - DON'T RELY ON VOICE STT ALONE FOR DIGITS: House numbers & digits are a known weak spot for speech recognition.
   - EXPLICITLY CONFIRM EXTRACTED DIGITS: After transcribing or reading an address, pull out any digit sequences and explicitly confirm back:
     Example: "Aapka address note kar liya hai: *House #123, Model Town*. Yeh sahi hai? (Galti ho to text mein sahi House # write kar dein!)"
   - REQUEST HOUSE NUMBER SEPARATELY AS TYPED TEXT IF AMBIGUOUS/MISSING:
     If the area/street was spoken in voice note but the House/Flat # is missing or ambiguous, ask for the House/Flat # as a TYPED text reply (typed digits are 100% accurate).
     Example: "Area samajh aa gaya hai! Khas taur par House # / Flat # please *text message* mein write karke bhej dein taake delivery mein galti na ho."
   - ALWAYS SHOW FULL TRANSCRIBED ADDRESS BACK BEFORE PLACING ORDER:
     Before executing place_order or finalizing the transaction, ALWAYS display the full transcribed address back to the customer:
     Example: "Confirming delivery to: 📍 *[Full Transcribed Address]*\nReply 'yes' to confirm or send correct address."
17. CART MODIFICATION & ITEM REMOVAL RULE:
   - When a customer asks to remove, cancel, or modify an item from their order (e.g. "soft drink hata dein", "cancel drink", "remove fries"):
   - DO NOT print the menu or catalog again!
   - Immediately calculate the updated item list without the removed item, recalculate the new Total Bill, and call place_order tool with the UPDATED items and price.
   - Confirm the removed item and updated bill back to the customer in 1-2 friendly sentences!`;

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
      if (config.enabledFeatures.includes("Human Handoff")) {
        fullSystemPrompt += "- HUMAN HANDOFF: If you do not know the answer to a question, tell the user you are transferring them to a human agent, and do NOT try to guess.\n";
      }
    }
    fullSystemPrompt += "\n\n=== RESPONSE FORMAT & TOKEN OPTIMIZATION ===\n- Keep answers EXTREMELY short and direct (1-2 sentences max, under 30 words).\n- Do not repeat previous conversation context, greeting, or output unnecessary filler text.\n- When asked for products/prices, list items concisely without fluff.\n";

    // Dynamic tail content to preserve prompt cache hits
    fullSystemPrompt += `\n\nProduct Information & Relevant Catalog:${catalogNote}\n${activeProductCatalog}`;
    fullSystemPrompt += `\n\nToday's Date: ${new Date().toISOString().split('T')[0]}`;

    const customerTags = customer?.tags || [];
    const hasRevivalTag = customerTags.includes("revival-sent") || customerTags.includes("revival-replied");
    if (hasRevivalTag) {
      fullSystemPrompt += `\n\n=== DEAD LEAD REVIVAL PIPELINE FUNNEL STRATEGY ===
This customer is a revived dead lead who recently responded to our re-engagement outreach campaign. Treat them as a returning customer and offer a special discount.`;
    }

    // Session Isolation Guard: Only use messages from the CURRENT session.
    // A new session starts if there is a temporal gap of > 4 hours OR after the latest "Welcome to" greeting.
    // This prevents old orders or cross-tenant chat history from contaminating fresh chats.
    const allFilteredChats = existingChats.filter((m: any) => m.role === 'user' || m.role === 'assistant');
    let sessionStartIndex = 0;

    if (isTemporalReset) {
      sessionStartIndex = allFilteredChats.length; // start fresh
    } else {
      for (let i = allFilteredChats.length - 1; i >= 0; i--) {
        const m = allFilteredChats[i];
        if (m.role === 'assistant' && m.content?.includes(`Welcome to ${activeBusinessName}`)) {
          sessionStartIndex = i;
          break;
        }
      }
    }
    const sessionChats = allFilteredChats.slice(sessionStartIndex);

    // Filter out system messages and sanitize past assistant refusal messages so LLM never gets primed by past errors!
    let recentHistory = sessionChats
      .slice(-8)
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
            product_page_url: { type: "string", description: "Direct URL to product page. Omit this field if there is no URL or link in the catalog for this product." },
            description: { type: "string", description: "A short, engaging description of the product" }
          },
          required: ["product_name", "price", "image_url", "description"]
        }
      },
      {
        name: "place_order",
        description: "Finalizes and places an order for the user after all details (size, color, delivery address, contact number, payment method) have been collected.",
        input_schema: {
          type: "object",
          properties: {
            product_name: { type: "string", description: "The name of the product" },
            quantity: { type: "integer", description: "The quantity/number of items ordered. If the user specifies a quantity (e.g. 4 sandwiches), pass it here." },
            size: { type: "string" },
            color: { type: "string" },
            address: { type: "string" },
            contact_number: { type: "string" },
            payment_method: { type: "string", description: "e.g. Cash on Delivery, Bank Transfer" },
            price: { type: "string", description: "Single-item price (the base price of one unit). The system will automatically calculate the total price based on quantity." },
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
        description: "Updates the customer's CRM profile, including their tags, custom name, pipeline stage, and custom preferences/variables based on the conversation context.",
        input_schema: {
          type: "object",
          properties: {
            name: { type: "string", description: "The customer's verified name (if they provided it in chat)" },
            tagsToAdd: { type: "array", items: { type: "string" }, description: "List of new tags/preferences to add to this customer" },
            tagsToRemove: { type: "array", items: { type: "string" }, description: "List of tags to remove from this customer" },
            stage: { type: "string", enum: ["new", "qualified", "warm", "cold", "completed"], description: "The funnel pipeline stage to move the customer to. Use 'qualified' when they give basic details, and 'warm' when they show strong interest or request pricing/availability." },
            contact_number: { type: "string", description: "The customer's secondary contact/phone number (if provided in chat)" },
            delivery_address: { type: "string", description: "The customer's delivery/shipping address (if provided in chat)" },
            service_preference: { type: "string", description: "The customer's preferred service for appointment/salon (if provided in chat)" },
            product_preference: { type: "string", description: "The customer's preferred product/item name (if provided in chat)" },
            appointment_date: { type: "string", description: "The customer's requested appointment date (YYYY-MM-DD) (if provided in chat)" },
            appointment_time: { type: "string", description: "The customer's requested appointment time (e.g. '4 PM') (if provided in chat)" },
            has_complaint: { type: "boolean", description: "Set to true if the customer is expressing a complaint, dissatisfaction, or reporting an issue with an order/service." },
            complaint_summary: { type: "string", description: "A brief, 1-2 sentence summary of what the customer is complaining about (e.g., 'Received broken product', 'Order delivery is delayed')." },
            notes: { type: "string", description: "Any general notes, custom sizes, requirements or user preferences" }
          }
        }
      }
    ];

    let usedProvider = "unknown";
    // Per-request LLM call counter for idempotent financial ledger
    const traceCtx = getCurrentTraceContext();
    const observabilityRequestId = traceCtx?.requestId || `req_wa_${Date.now()}`;
    let llmCallIndex = 0;
    try {
      await WhatsAppManager.sendTyping(from);
      console.log(`[AI Handler] Requesting completion using unified callLLMWithFallback...`);
      const fallbackResult = await callLLMWithFallback(config, fullSystemPrompt, recentHistory, tools);
      usedProvider = fallbackResult.provider;
      const llmMeta0 = fallbackResult.res;
      let res = fallbackResult.res;

      // Financial ledger: LLM call #0 (initial turn)
      logLLMUsage({
        tenantId: resolvedTenantId,
        provider: llmMeta0.resolvedProvider,
        model: llmMeta0.resolvedModel,
        inputTokens: llmMeta0.inputTokens,
        outputTokens: llmMeta0.outputTokens,
        cachedTokens: llmMeta0.cachedTokens,
        latencyMs: llmMeta0.latencyMs,
        status: 'success',
        purpose: 'whatsapp_chat',
        llmCallIndex: llmCallIndex,
        customRequestId: observabilityRequestId,
      }).catch(e => console.error('[Observability] logLLMUsage call#0 failed:', e));

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
              const matchedProd = activeProducts.find((p: any) => p.title && p.title.toLowerCase().trim() === args.product_name.toLowerCase().trim());
              const prodImages = matchedProd?.images || (args.image_urls || undefined);
              await WhatsAppManager.sendProductCard(from, {
                title: args.product_name,
                price: args.price,
                image: args.image_url,
                images: prodImages,
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
              // --- ORDER GUARDRAIL VALIDATION ---
              const rawProduct = (args.product_name || "").trim();
              const isInvalidProduct = !rawProduct || rawProduct.length > 80 || rawProduct.toLowerCase().includes("confirm karne") || rawProduct.toLowerCase().includes("bata dein");
              
              if (isInvalidProduct) {
                console.warn(`[AI Handler Guardrail] Blocked place_order tool call due to invalid product name: "${rawProduct}"`);
                toolResult = JSON.stringify({ 
                  success: false, 
                  message: "Order Guardrail Validation Failed: Invalid product name. Please specify an actual product from our menu." 
                });
                toolResults.push({ type: "tool_result", tool_use_id: toolCall.id, content: toolResult });
                continue;
              }

              const qty = Math.max(1, parseInt(args.quantity) || 1);
              let finalPrice = args.price || "";
              
              const numericPrice = parseFloat(finalPrice.replace(/[^\d.]/g, ""));
              if (!isNaN(numericPrice)) {
                const total = numericPrice * qty;
                let cur: string = activeCurrency;
                if (finalPrice.includes("PKR")) {
                  cur = "PKR";
                } else if (finalPrice.includes("Rs.")) {
                  cur = "Rs.";
                } else if (finalPrice.includes("$")) {
                  cur = "$";
                }
                
                if (cur === "$") {
                  finalPrice = `$${total}`;
                } else {
                  finalPrice = `${cur} ${total}`;
                }
              } else {
                const hasCurrency = /^[A-Za-z\$\£\€\¥]/i.test(finalPrice) || finalPrice.includes("PKR") || finalPrice.includes("Rs.");
                if (!hasCurrency && finalPrice.trim() !== "") {
                  finalPrice = `${activeCurrency} ${finalPrice}`;
                }
              }

              // Address check fallback to customer saved address
              let deliveryAddr = (args.address || "").trim();
              if (!deliveryAddr || deliveryAddr.length < 5 || deliveryAddr.toLowerCase().includes("provided in chat") || deliveryAddr.toLowerCase().includes("note kar liya")) {
                deliveryAddr = savedCustomerAddress || deliveryAddr;
              }

              const orderData = {
                productName: qty > 1 ? `${qty}x ${args.product_name}` : args.product_name,
                size: args.size,
                color: args.color,
                deliveryAddress: deliveryAddr || "Address to be confirmed in chat",
                contactNumber: args.contact_number || from,
                paymentMethod: args.payment_method || "Cash on Delivery",
                price: finalPrice || "COD",
                productImageUrl: args.image_url,
                customerName: customer?.name || from,
                notes: args.notes
              };
              await DB.addOrder(from, orderData, resolvedTenantId);
              await DB.updateCustomer(from, { followUpLevel: 999, leadStatus: "cold", pipelineStage: "completed" }, resolvedTenantId);

              // Instant WhatsApp Alert Notification to Kitchen / Manager Phone!
              try {
                const activeTenantConfig: any = await DB.getConfig(resolvedTenantId);
                const managerPhone = activeTenantConfig?.managerPhone || activeTenantConfig?.notificationPhone;
                if (managerPhone) {
                  const cleanManagerPhone = String(managerPhone).replace(/[^0-9]/g, '');
                  if (cleanManagerPhone) {
                    const alertMsg = `🚨 *NEW WHATSAPP ORDER RECEIVED!*\n\n📦 *Order*: ${orderData.productName}\n💰 *Price*: ${orderData.price}\n📍 *Address*: ${orderData.deliveryAddress || 'N/A'}\n👤 *Customer*: ${orderData.customerName} (+${from})\n💳 *Payment*: ${orderData.paymentMethod || 'COD'}\n⏰ *Time*: ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}\n\n*Please dispatch / prepare food immediately!*`;
                    const { WhatsAppManager } = await import("./whatsapp");
                    WhatsAppManager.sendMessage(cleanManagerPhone, alertMsg).catch(err => console.error("[Order Alert] Failed to send to manager:", err));
                  }
                }
              } catch (alertErr) {
                console.error("[Order Alert Error]:", alertErr);
              }

              toolResult = JSON.stringify({ success: true, message: `Order placed and saved to database successfully. Quantity: ${qty}. Total Price: ${finalPrice}. You may now confirm the final order details to the user.` });
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

              // Read current preferences JSON
              let currentPrefs: any = {};
              try {
                if (customerRec?.preferences) {
                  currentPrefs = JSON.parse(customerRec.preferences);
                }
              } catch (e) {
                // Fallback if preferences was plain text
                if (customerRec?.preferences) {
                  currentPrefs = { notes: customerRec.preferences };
                }
              }

              // Update preferences fields
              if (args.contact_number !== undefined) currentPrefs.contactNumber = args.contact_number;
              if (args.delivery_address !== undefined) currentPrefs.deliveryAddress = args.delivery_address;
              if (args.service_preference !== undefined) currentPrefs.servicePreference = args.service_preference;
              if (args.product_preference !== undefined) currentPrefs.productPreference = args.product_preference;
              if (args.appointment_date !== undefined) currentPrefs.appointmentDate = args.appointment_date;
              if (args.appointment_time !== undefined) currentPrefs.appointmentTime = args.appointment_time;
              if (args.has_complaint !== undefined) currentPrefs.hasComplaint = args.has_complaint;
              if (args.complaint_summary !== undefined) currentPrefs.complaintSummary = args.complaint_summary;
              if (args.notes !== undefined) currentPrefs.notes = args.notes;

              const updates: any = { 
                tags: newTags,
                preferences: JSON.stringify(currentPrefs)
              };
              if (args.name) updates.name = args.name;
              if (args.stage) updates.pipelineStage = args.stage;

              await DB.updateCustomer(from, updates, resolvedTenantId);
              toolResult = JSON.stringify({ success: true, message: "Customer profile and variables updated successfully." });
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

        console.log("[AI Handler] Sending tool results back to AI with compact system prompt...");
        const compactToolSystemPrompt = `You are a concise sales assistant for ${activeBusinessName}. Complete the action and provide a brief confirmation message (1-2 sentences max). Do not repeat catalog or rules.`;
        llmCallIndex++; // Index 1: tool-loop follow-up call
        const fallbackResult2 = await callLLMWithFallback(config, compactToolSystemPrompt, recentHistory, tools);
        usedProvider = fallbackResult2.provider;
        const llmMeta1 = fallbackResult2.res;
        res = fallbackResult2.res;

        // Financial ledger: LLM call #1 (tool-loop follow-up)
        logLLMUsage({
          tenantId: resolvedTenantId,
          provider: llmMeta1.resolvedProvider,
          model: llmMeta1.resolvedModel,
          inputTokens: llmMeta1.inputTokens,
          outputTokens: llmMeta1.outputTokens,
          cachedTokens: llmMeta1.cachedTokens,
          latencyMs: llmMeta1.latencyMs,
          status: 'success',
          purpose: 'whatsapp_chat',
          llmCallIndex: llmCallIndex,
          customRequestId: observabilityRequestId,
        }).catch(e => console.error('[Observability] logLLMUsage call#1 failed:', e));

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

      // FAIL-SAFE ORDER INTERCEPTOR:
      // If AI reply confirms order placement (e.g. "Your order has been placed", "order confirmed", "delivering to")
      // BUT no order was recorded in DB for this phone in the last 15 minutes, AUTO-SAVE IT IMMEDIATELY!
      try {
        const lowerAiReply = (aiReply || "").toLowerCase();
        const isQuestionOrPrompt = lowerAiReply.includes("?") || 
          lowerAiReply.includes("bata dein") || 
          lowerAiReply.includes("bataaein") || 
          lowerAiReply.includes("karne ke liye") || 
          lowerAiReply.includes("bhej dein") ||
          lowerAiReply.includes("provide") ||
          lowerAiReply.includes("detail");

        const isOrderConfirmationReply = !isQuestionOrPrompt && (
          lowerAiReply.includes("order has been placed") ||
          lowerAiReply.includes("order is placed") ||
          lowerAiReply.includes("order confirm ho gaya") ||
          lowerAiReply.includes("order confirm kar diya") ||
          lowerAiReply.includes("order note kar liya") ||
          (lowerAiReply.includes("order confirmed") && !lowerAiReply.includes("confirming"))
        );

        if (isOrderConfirmationReply) {
          const existingOrders = await DB.getOrders(resolvedTenantId);
          const thirtyMinutesAgo = new Date(Date.now() - 1800 * 1000).toISOString();
          const recentOrder = existingOrders.find(o => o.phone === from && (o.timestamp || (o as any).createdAt) >= thirtyMinutesAgo);
          
          if (!recentOrder) {
            console.warn(`[AI Handler Safeguard] Order confirmation detected in AI reply for ${from}, but no DB order record found! Auto-saving order to DB...`);
            
            // Auto-extract item name from AI reply
            let extractedProduct = "WhatsApp Order";
            const productMatch = aiReply.match(/(?:🍗|🍔|🍕|🥟|🍣|🧃|📦|Order:?)\s*([^\n—–\-•,]+)/i) || 
                                 aiReply.match(/(?:placed|confirmed|for)\!?\s*([^\n—–\-•,]+)/i);
            if (productMatch && productMatch[1]) {
              const candidate = productMatch[1].trim();
              if (candidate.length < 50 && !candidate.toLowerCase().includes("confirm") && !candidate.toLowerCase().includes("contact")) {
                extractedProduct = candidate;
              }
            }

            // Auto-extract price from AI reply
            let extractedPrice = "COD";
            const priceMatch = aiReply.match(/(?:PKR|Rs\.?|\$)\s*\d+(?:,\d+)?/i) || aiReply.match(/\d+\s*(?:PKR|Rs\.?)/i);
            if (priceMatch) {
              extractedPrice = priceMatch[0].trim();
            }

            // Auto-extract delivery address from AI reply
            let extractedAddress = "Address provided in chat";
            const addressMatch = aiReply.match(/(?:delivering to|address:?|location:?)\s*([^\n.!\n]+)/i);
            if (addressMatch && addressMatch[1]) {
              extractedAddress = addressMatch[1].trim();
            }

            await DB.addOrder(from, {
              productName: extractedProduct,
              price: extractedPrice,
              deliveryAddress: extractedAddress,
              paymentMethod: "Cash on Delivery",
              customerName: customer?.name || from,
              notes: "Auto-captured by Fail-Safe Interceptor"
            }, resolvedTenantId);

            await DB.updateCustomer(from, { followUpLevel: 999, leadStatus: "cold", pipelineStage: "completed" }, resolvedTenantId);
            console.log(`[AI Handler Safeguard] Successfully auto-saved fallback order for ${from}!`);
          }
        }
      } catch (safeguardErr) {
        console.error("[AI Handler Safeguard Error]:", safeguardErr);
      }

      // FAIL-SAFE APPOINTMENT INTERCEPTOR:
      // If AI reply confirms appointment booking (e.g. "appointment book", "confirm the appointment", "appointment ho gayi")
      // BUT no appointment was recorded in DB for this phone in the last 15 minutes, AUTO-SAVE IT IMMEDIATELY!
      try {
        const lowerAiReply = (aiReply || "").toLowerCase();
        const isAppointmentConfirmationReply = 
          lowerAiReply.includes("appointment confirm") ||
          lowerAiReply.includes("appointment book") ||
          lowerAiReply.includes("confirm the appointment") ||
          lowerAiReply.includes("appointment ho gayi") ||
          lowerAiReply.includes("book kar di") ||
          lowerAiReply.includes("booking ho gayi") ||
          lowerAiReply.includes("appointment set kar") ||
          lowerAiReply.includes("appointment note kar");

        if (isAppointmentConfirmationReply) {
          const existingAppts = await DB.getAppointmentsByPhone(from, resolvedTenantId);
          const fifteenMinutesAgo = new Date(Date.now() - 900 * 1000).toISOString();
          const recentAppt = existingAppts.find(a => (a.createdAt || "") >= fifteenMinutesAgo);

          if (!recentAppt) {
            console.warn(`[AI Handler Safeguard] Appointment confirmation detected in AI reply for ${from}, but no DB appointment record found! Auto-saving appointment to DB...`);

            // Auto-extract service
            let extractedService = "Service Booking";
            const serviceKeywords = ["hair coloring", "haircut", "makeup", "nails", "henna", "massage", "balayage", "highlights", "pedicure", "manicure"];
            const textToSearch = (aiReply + " " + recentHistory.map((h: any) => h.content || "").join(" ")).toLowerCase();
            for (const kw of serviceKeywords) {
              if (textToSearch.includes(kw)) {
                extractedService = kw.charAt(0).toUpperCase() + kw.slice(1);
                break;
              }
            }

            // Auto-extract time
            let extractedTime = "12:00 PM";
            const timeMatch = aiReply.match(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)\b/) ||
                              recentHistory.map((h: any) => typeof h.content === 'string' ? h.content : '').join(" ").match(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)\b/);
            if (timeMatch) {
              extractedTime = timeMatch[0].toUpperCase();
            }

            // Auto-extract date
            let extractedDate = new Date(Date.now() + 86400000).toISOString().split('T')[0]; // Default to tomorrow
            const dateRegex = /\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/i;
            const dateMatch = aiReply.match(dateRegex) ||
                              recentHistory.map((h: any) => typeof h.content === 'string' ? h.content : '').join(" ").match(dateRegex);
            if (dateMatch) {
              try {
                const year = new Date().getFullYear();
                const parsedDate = new Date(`${dateMatch[0]} ${year}`);
                if (!isNaN(parsedDate.getTime())) {
                  extractedDate = parsedDate.toISOString().split('T')[0];
                }
              } catch (e) {}
            } else if (textToSearch.includes("parso")) {
              const d = new Date();
              d.setDate(d.getDate() + 2);
              extractedDate = d.toISOString().split('T')[0];
            } else if (textToSearch.includes("kal") || textToSearch.includes("tomorrow")) {
              const d = new Date();
              d.setDate(d.getDate() + 1);
              extractedDate = d.toISOString().split('T')[0];
            } else if (textToSearch.includes("today") || textToSearch.includes("aaj")) {
              extractedDate = new Date().toISOString().split('T')[0];
            }

            const userName = customer?.name || from;
            const success = await DB.bookAppointment(
              from,
              userName,
              extractedService,
              extractedDate,
              extractedTime,
              "Auto-captured by Fail-Safe Appointment Interceptor",
              resolvedTenantId
            );
            
            if (success) {
              await DB.updateCustomer(from, { pipelineStage: "completed", name: userName }, resolvedTenantId);
              console.log(`[AI Handler Safeguard] Successfully auto-saved fallback appointment for ${from}!`);
            }
          }
        }
      } catch (apptSafeguardErr) {
        console.error("[AI Handler Safeguard Appointment Error]:", apptSafeguardErr);
      }

      sentMsg = await WhatsAppManager.sendMessage(from, aiReply);
      console.log(`[AI Handler] Replied to ${from}: ${aiReply}`);
      await DB.addChatMessage(from, { id: "ai_" + (sentMsg?.key?.id || ""), role: "assistant", content: aiReply || "[Media Sent]" }, resolvedTenantId);
    }
    
  } catch (error: any) {
    console.error("[AI Handler] processWhatsAppMessage error:", error);
    await logAppError({
      service: 'ai-handler',
      operation: 'process-message',
      error: error instanceof Error ? error : new Error(String(error)),
      tenantId: resolvedTenantId,
      severity: 'high',
      metadata: { customerPhone: from, messageId: msg?.key?.id }
    }).catch(() => {});
    throw error;
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
    .filter((o: any) => o.status === "completed" || o.status === "confirmed" || o.status === "paid" || o.status === "delivered")
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
