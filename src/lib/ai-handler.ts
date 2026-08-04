import Anthropic from "@anthropic-ai/sdk";
import { WhatsAppManager } from "./whatsapp";
import { DB, DB_DIR, formatProductsToCatalog } from "./db";
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
    process.env["DEEPSEEK_API_KEY"],
    getEnvKey("DEEPSEEK_API_KEY"),
    config.apiKey,
    config.anthropicApiKey,
    config.openRouterApiKey,
    process.env["API_KEY"],
    getEnvKey("API_KEY"),
    process.env["OPENAI_API_KEY"],
    getEnvKey("OPENAI_API_KEY"),
    process.env["ANTHROPIC_API_KEY"],
    getEnvKey("ANTHROPIC_API_KEY"),
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

function getDeepgramSettings(config: any): { apiKey: string; voice: string } {
  let apiKey = "";
  let voice = "aura-asteria-en";

  // Priority 1: Check Railway environment variable first
  const envKey = getEnvKey("DEEPGRAM_API_KEY") || process.env.DEEPGRAM_API_KEY || "";
  if (envKey && envKey.trim()) {
    apiKey = envKey.trim();
  }

  // Priority 2: Check tenant records for a valid custom Deepgram key (ignoring mock placeholders like dg_live_...)
  try {
    const tenants = DB.getTenants() || [];
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
    
    // First try nova-2 with detect_language=true & smart_format=true
    let res = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&detect_language=true&smart_format=true&punctuate=true", {
      method: "POST",
      headers: {
        "Authorization": `Token ${apiKey.trim()}`,
        "Content-Type": cleanMime
      },
      body: new Uint8Array(buffer)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Deepgram STT] First attempt error (${res.status}):`, errText);
      // Retry without model restriction and with octet-stream header for maximum format/codec compatibility
      res = await fetch("https://api.deepgram.com/v1/listen?smart_format=true&detect_language=true", {
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

async function generateSpeechWithDeepgram(text: string, apiKey: string, voice = "aura-asteria-en"): Promise<Buffer | null> {
  if (!apiKey || !apiKey.trim() || !text || !text.trim()) return null;
  try {
    const cleanText = text.replace(/[*_~`#]/g, '').trim();
    if (!cleanText) return null;

    console.log(`[Deepgram TTS] Synthesizing speech for: "${cleanText.substring(0, 60)}..." using voice ${voice}`);
    const res = await fetch(`https://api.deepgram.com/v1/speak?model=${encodeURIComponent(voice)}`, {
      method: "POST",
      headers: {
        "Authorization": `Token ${apiKey.trim()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text: cleanText })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Deepgram TTS] API error (${res.status}):`, errText);
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`[Deepgram TTS] Speech synthesis successful: generated ${buffer.length} bytes.`);
    return buffer;
  } catch (err) {
    console.error("[Deepgram TTS] Exception during speech synthesis:", err);
    return null;
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

function convertOpenAiResponseToAnthropic(message: any): any[] {
  const content: any[] = [];
  if (message.content) {
    content.push({ type: "text", text: message.content });
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
    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system: systemPrompt,
      messages: messages as any,
      tools: tools.length > 0 ? tools : undefined,
      temperature: temperature,
    });
    return res;
  } else if (keyType === "openrouter") {
    const models = [
      "anthropic/claude-haiku-4.5",
      "google/gemma-4-31b-it:free",
      "google/gemma-4-26b-a4b-it:free"
    ];
    let lastError: any = null;
    for (const model of models) {
      try {
        console.log(`[callLLM] Attempting OpenRouter model ${model}...`);
        const anthropic = new Anthropic({
          apiKey: trimmed,
          baseURL: "https://openrouter.ai/api",
          defaultHeaders: {
            "HTTP-Referer": "https://hazeldid.com",
            "X-Title": "HazelWhat",
          },
        });
        const res = await anthropic.messages.create({
          model: model,
          max_tokens: 2000,
          system: systemPrompt,
          messages: messages as any,
          tools: tools.length > 0 ? tools : undefined,
          temperature: temperature,
        });
        return res;
      } catch (err: any) {
        console.error(`[callLLM] OpenRouter model ${model} failed:`, err.message || err);
        lastError = err;
      }
    }
    throw lastError || new Error("OpenRouter models failed");
  } else if (keyType === "deepseek") {
    console.log(`[callLLM] Attempting DeepSeek API...`);
    const openAiMessages = convertAnthropicMessagesToOpenAi(messages, systemPrompt);
    const openAiTools = convertAnthropicToolsToOpenAi(tools);

    // Clean openAiMessages: convert content array to string and replace image_url with [Image Attachment]
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
        
        // Timeout after 15 seconds to prevent hanging
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
            max_tokens: 2000,
            temperature: temperature
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Status ${res.status}: ${errText}`);
        }
        break;
      } catch (err: any) {
        console.error(`[callLLM] DeepSeek attempt ${attempt} failed:`, err.message || err);
        lastError = err;
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

export async function handleWhatsAppMessage(msg: any) {
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
    const interactiveResponse = msg.message?.interactiveResponseMessage;
    let content = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || "";
    
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
          
          DB.addChatMessage(from, { role: "user", content: `[Clicked View Product]` });
          DB.addChatMessage(from, { role: "assistant", content: reply });
          return;
        }
        else if (params.id && params.id.startsWith("order_")) {
          const parts = params.id.split("_");
          const productName = parts.slice(2).join("_") || "Product";
          
          console.log(`[AI Handler] Order button clicked for ${productName} by ${from}`);
          
          const reply = `Great choice! To place an order for *${productName}*, I just need a few details:\n\n1. What size/color would you like?\n2. What is your delivery address?\n3. Please provide a contact phone number.\n\nYou can type your answers below!`;
          await WhatsAppManager.sendMessage(from, reply);
          
          DB.addChatMessage(from, { role: "user", content: `[I want to order: ${productName}]` });
          DB.addChatMessage(from, { role: "assistant", content: reply });
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

    const config = DB.getConfig();
    const { apiKey: deepgramApiKey, voice: deepgramVoice } = getDeepgramSettings(config);

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
        content = voiceTranscript;
        console.log(`[AI Handler] Voice transcribed successfully! Content set to: "${content}"`);
      } else if (!content) {
        content = "Hi! I sent a voice note inquiring about your products, pricing, and availability.";
        console.log(`[AI Handler] No STT available — using fallback voice content for AI processing.`);
      }
    }

    const lowerContent = content.toLowerCase().trim();
    const optOutKeywords = ["stop", "unsubscribe", "optout", "opt out", "hatao", "mat bhejo", "cancel", "remove me", "donotdisturb"];
    const isOptOut = optOutKeywords.some(kw => lowerContent === kw || lowerContent.startsWith(kw + " "));

    if (isOptOut) {
      console.log(`[Opt-Out] Customer ${from} requested opt-out with text: "${content}"`);
      const existingCustomer = DB.getCustomer(from);
      const existingTags = existingCustomer?.tags || [];
      const updatedTags = Array.from(new Set([...existingTags.filter(t => t !== "revival-sent"), "opted-out"]));

      DB.updateCustomer(from, {
        isOptedOut: true,
        optedOutAt: new Date().toISOString(),
        aiEnabled: false,
        tags: updatedTags
      });

      // Update active campaign if lead was part of it
      const activeCampaign = DB.getActiveCampaign();
      if (activeCampaign) {
        const optedOutList = Array.from(new Set([...(activeCampaign.optedOutPhones || []), from]));
        const progressMap = activeCampaign.leadProgress || {};
        if (progressMap[from]) {
          progressMap[from].status = "opted_out";
        }
        DB.updateRevivalCampaign(activeCampaign.id, {
          optedOutPhones: optedOutList,
          leadProgress: progressMap
        });
      }

      DB.addChatMessage(from, { role: "user", content });
      await WhatsAppManager.sendMessage(from, "You have been unsubscribed from promotional updates. Reply START to opt back in.");
      DB.addChatMessage(from, { role: "assistant", content: "You have been unsubscribed from promotional updates. Reply START to opt back in." });
      return;
    }

    if (hasAudio) {
      const displayContent = voiceTranscript || content || "Hi! I sent a voice note inquiring about your products, pricing, and availability.";
      const userDisplay = `🎤 [Voice Note]: "${displayContent}"`;
      DB.addChatMessage(from, { 
        role: "user", 
        content: userDisplay,
        mediaUrl: base64Audio ? `data:${audioMime};base64,${base64Audio}` : undefined,
        mediaType: audioMime
      });
    } else {
      DB.addChatMessage(from, { role: "user", content: hasImage ? `[Image] ${content}` : content });
    }
    
    const existingCustomer = DB.getCustomer(from);
    const currentStage = existingCustomer?.pipelineStage || "new";
    
    let updatedTags = existingCustomer?.tags || [];
    let nextStage: "cold" | "new" | "qualified" | "warm" | "completed" | undefined = currentStage === "completed" ? "completed" : currentStage;
    
    // Check if customer was in revival flow
    const activeCampaign = DB.getActiveCampaign();
    if (updatedTags.includes("revival-sent") || (activeCampaign && activeCampaign.targetPhones?.includes(from))) {
      updatedTags = updatedTags.filter(t => t !== "revival-sent");
      if (!updatedTags.includes("revival-replied")) {
        updatedTags.push("revival-replied");
      }
      nextStage = "warm"; // Move revived customer to warm stage in CRM pipeline

      if (activeCampaign) {
        const repliedList = Array.from(new Set([...(activeCampaign.repliedPhones || []), from]));
        const progressMap = activeCampaign.leadProgress || {};
        if (progressMap[from]) {
          progressMap[from].status = "replied";
        }
        DB.updateRevivalCampaign(activeCampaign.id, {
          repliedPhones: repliedList,
          leadProgress: progressMap
        });
      }
    }

    DB.updateCustomer(from, { 
      jid: msg.key.remoteJid,
      followUpLevel: 0,
      leadStatus: "hot",
      pipelineStage: nextStage,
      tags: updatedTags,
      ...(msg.pushName ? { name: msg.pushName } : {})
    });
    const customer = DB.getCustomer(from);

    const globalAiEnabled = config.globalAiEnabled !== false;
    const chatAiEnabled = customer?.aiEnabled;
    const shouldAiRespond = chatAiEnabled !== undefined ? chatAiEnabled : globalAiEnabled;

    if (!shouldAiRespond) {
      console.log(`[AI Handler] AI Autopilot is OFF for ${from}. Ignoring message.`);
      return;
    }

    const matchedKeyword = config.keywordReplies?.find(k => 
      k.keyword.trim() !== "" && lowerContent.includes(k.keyword.toLowerCase())
    );

    if (matchedKeyword) {
      console.log(`[AI Handler] Keyword matched: ${matchedKeyword.keyword}`);
      const sentMsg = await WhatsAppManager.sendMessage(from, matchedKeyword.reply);
      DB.addChatMessage(from, { id: sentMsg?.key?.id, role: "assistant", content: matchedKeyword.reply });
      return;
    }

    console.log("=== AI HANDLER VERSION 6 (Unified callLLM) ===");

    const apiKey = getApiKey(config);

    debugLog(`=== Incoming Message from ${from} ===`);
    debugLog(`Content: "${content}"`);
    debugLog(`Unified Key source: config.apiKey=${config.apiKey ? "yes" : "no"}, process.env.DEEPSEEK_API_KEY=${process.env.DEEPSEEK_API_KEY ? "yes" : "no"}, process.env.API_KEY=${process.env.API_KEY ? "yes" : "no"}`);

    if (!apiKey) {
      console.error("[AI Handler] No API key is configured.");
      const fallback = "I'm currently experiencing a high volume of requests. A human agent will be with you shortly!";
      const sentMsg = await WhatsAppManager.sendMessage(from, fallback);
      DB.addChatMessage(from, { id: sentMsg?.key?.id, role: "assistant", content: fallback });
      
      const diagnostics = `[DIAGNOSTIC - KEY ERROR] The bot could not respond because no API keys were loaded.\n- config.apiKey: ${config.apiKey ? "Present" : "Empty"}\n- process.env.DEEPSEEK_API_KEY: ${process.env.DEEPSEEK_API_KEY ? "Present" : "Empty"}\n- process.env.API_KEY: ${process.env.API_KEY ? "Present" : "Empty"}\n- process.env.OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? "Present" : "Empty"}\n- process.env.ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? "Present" : "Empty"}\n- process.env.OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? "Present" : "Empty"}\n- process.env["Api key"]: ${process.env["Api key"] ? "Present" : "Empty"}`;
      DB.addChatMessage(from, { role: "assistant", content: diagnostics });
      return;
    }

    let aiReply = "I'm sorry, I didn't quite catch that. Could you rephrase?";
    const structuredCatalog = config.products && config.products.length > 0 ? formatProductsToCatalog(config.products, config.storeCurrency || "$") : "";
    const activeProductCatalog = structuredCatalog || config.productInfo || "";
    let fullSystemPrompt = `${config.systemPrompt}\n\nToday's Date: ${new Date().toISOString().split('T')[0]}\n\nProduct Information & Catalog:\n${activeProductCatalog}`;

    const customerTags = existingCustomer?.tags || [];
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
    
    fullSystemPrompt += `\n\nCRITICAL RULES FOR PRODUCT RECOMMENDATIONS:
1. When showing a product to the customer, you must ALWAYS call the send_product_card function with the correct product data.
2. You must NEVER write product images, links, or markdown syntax directly in a text response.
3. If you want to show a product, calling the tool IS the only correct action — do not also describe it in a text message at the same time.
4. BE CONVERSATIONAL. If a user just says "hi", reply with a warm greeting and ask how you can help them. DO NOT immediately blast them with a list of products.
5. If the user sends an image, visually analyze it and suggest the closest matching items from the Product Information using the send_product_card tool.
6. ORDER COLLECTION: When a user expresses intent to order a product, you MUST IMMEDIATELY call the place_order tool with whatever details you have so far (at least the product_name). NEVER wait for all details to call the tool.
   - If you are missing size, color, delivery address, contact number, or payment method, pass them as empty strings or omit them in the tool call.
   - AFTER calling the tool, ask the user for the remaining missing details in your text response.
   - If the user provides more details later, call place_order again to update it.
7. VARIATIONS & PRICING: If a product has multiple variations (like different ages/sizes), do NOT immediately state a generic price. Instead:
    - First, show the product card to the user. You MUST set the price parameter to "Hidden" when calling send_product_card so the price is not shown in the card.
    - Then, ask the customer in your text response: "How old is your child?" or "What size are you looking for?"
    - Once they tell you the size, check the specific Variations for that product and tell them the exact price for that size in text.
    - If they already mentioned the size in their initial request, you can directly show the card and state the exact price for that size.
8. PROACTIVE FOLLOW-UPS: Whenever you tell the user you will follow up or check back later, you MUST call the schedule_followup tool to actually schedule it. Never just say it without calling the tool.
9. CUSTOMER CRM PROFILES: You have access to the update_customer_profile tool. Whenever a user shares their name, or shows strong buying interest (such as asking for catalog, pricing, or stock details), you MUST call update_customer_profile to record their name, add relevant product interest tags, and move them to the appropriate stage ('qualified' when they give basic details, 'warm' when showing purchase intent).
10. VOICE NOTE & AUDIO INSTRUCTIONS: You have full audio & voice note capability. When a user sends a voice note (marked with 🎤 [Voice Note]), the transcript of what they spoke is provided. You MUST ALWAYS answer their question or request directly and naturally! NEVER say "I am not able to listen to voice notes", "I cannot hear audio", or refuse to process voice messages.`;

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

    const history = DB.getChats(from);
    // Filter out system messages and sanitize past assistant refusal messages so LLM never gets primed by past errors!
    let recentHistory = history
      .filter((m: any) => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
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
        description: "Books an appointment for the user. Call checkAvailability first if you haven't.",
        input_schema: {
          type: "object",
          properties: {
            name: { type: "string", description: "User's full name" },
            service: { type: "string", description: "The service they want to book" },
            date: { type: "string", description: "Date of appointment (YYYY-MM-DD)" },
            time: { type: "string", description: "Time of appointment (HH:MM)" }
          },
          required: ["name", "service", "date", "time"]
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
            price: { type: "string" }
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

    try {
      await WhatsAppManager.sendTyping(from);
      console.log(`[AI Handler] Requesting completion using unified callLLM...`);
      let res = await callLLM(apiKey, fullSystemPrompt, recentHistory, tools);

      let textContent = "";
      for (const block of res.content) {
        if (block.type === 'text') {
          textContent += block.text;
        }
      }
      aiReply = textContent || aiReply;

      const toolUses = res.content.filter(block => block.type === 'tool_use');
      
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
            const booked = DB.getAppointmentsByDate(args.date);
            const bookedTimes = booked.map(a => a.time);
            const allHours = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
            const available = allHours.filter(h => !bookedTimes.includes(h));
            toolResult = JSON.stringify({ availableTimes: available });
          } 
          else if (toolCall.name === "bookAppointment") {
            const success = DB.bookAppointment(from, args.name, args.service, args.date, args.time);
            if (success) {
              DB.updateCustomer(from, { pipelineStage: "completed" });
            }
            toolResult = JSON.stringify({ success, message: success ? "Appointment booked successfully." : "Time slot already taken. Please pick another." });
          }
          else if (toolCall.name === "cancelAppointment") {
            const success = DB.cancelAppointment(from, args.date, args.time);
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
                productImageUrl: args.image_url
              };
              DB.addOrder(from, orderData);
              DB.updateCustomer(from, { pipelineStage: "completed" });
              toolResult = JSON.stringify({ success: true, message: "Order placed and saved to database successfully. You may now confirm the final order details to the user." });
            } catch (err: any) {
              console.error("[AI Handler] place_order error:", err);
              toolResult = JSON.stringify({ success: false, message: "Failed to place order: " + err.message });
            }
          }
          else if (toolCall.name === "update_customer_profile") {
            try {
              const customer = DB.getCustomer(from);
              const currentTags = customer?.tags || [];
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

              DB.updateCustomer(from, updates);
              toolResult = JSON.stringify({ success: true, message: "Customer profile updated successfully." });
            } catch (err: any) {
              console.error("[AI Handler] update_customer_profile error:", err);
              toolResult = JSON.stringify({ success: false, message: "Failed to update profile: " + err.message });
            }
          }
          else if (toolCall.name === "schedule_followup") {
            try {
              DB.cancelPendingFollowUps(from);
              DB.addScheduledFollowUp({
                id: Math.random().toString(36).substring(2, 9),
                phone: from,
                sendAt: args.send_at,
                context: args.message_context,
                status: "pending",
                createdAt: new Date().toISOString()
              });
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
        res = await callLLM(apiKey, fullSystemPrompt, recentHistory, tools);

        textContent = "";
        for (const block of res.content) {
          if (block.type === 'text') {
            textContent += block.text;
          }
        }
        aiReply = textContent || aiReply;
      }
      
      debugLog(`SUCCESS: Unified LLM generated reply: "${aiReply.substring(0, 60)}..."`);
    } catch (apiErr: any) {
      const errorDetail = apiErr.message || JSON.stringify(apiErr);
      console.error(`[AI Handler] Unified LLM API ERROR CAUGHT:`, errorDetail);
      debugLog(`FAILURE: Unified LLM API call failed. Error: ${errorDetail}`);
      
      aiReply = "I'm currently experiencing a high volume of requests and having some technical difficulties. A human agent will be with you shortly, or you can try again later!";
      const diagnostics = `[DIAGNOSTIC - API ERROR] Unified LLM call failed.\n- Key Type: ${detectKeyType(apiKey)}\n- Last Error: ${errorDetail}`;
      DB.addChatMessage(from, { role: "assistant", content: diagnostics });
    }

    if (aiReply) {
      aiReply = aiReply.replace(/!\[.*?\]\((https?:\/\/[^\)]+)\)/g, '[MEDIA:$1]');
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
          await WhatsAppManager.sendMedia(from, buffer, mimetype);
          console.log(`[AI Handler] Sent media to ${from}`);
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

      let voiceSent = false;

      // If user sent a voice note AND Deepgram API Key is configured, reply with a voice note!
      if (hasAudio && deepgramApiKey) {
        console.log(`[AI Handler] Synthesizing Deepgram TTS voice note reply for ${from}...`);
        const ttsBuffer = await generateSpeechWithDeepgram(aiReply, deepgramApiKey, deepgramVoice);
        if (ttsBuffer) {
          sentMsg = await WhatsAppManager.sendMedia(from, ttsBuffer, "audio/mp4", "voice_note.mp4", aiReply, true);
          const base64Tts = ttsBuffer.toString("base64");
          DB.addChatMessage(from, {
            id: sentMsg?.key?.id,
            role: "assistant",
            content: aiReply,
            mediaUrl: `data:audio/mp4;base64,${base64Tts}`,
            mediaType: "audio/mp4"
          });
          voiceSent = true;
          console.log(`[AI Handler] Replied to ${from} with Voice Note!`);
        }
      }

      if (!voiceSent) {
        sentMsg = await WhatsAppManager.sendMessage(from, aiReply);
        console.log(`[AI Handler] Replied to ${from}: ${aiReply}`);
        DB.addChatMessage(from, { id: sentMsg?.key?.id, role: "assistant", content: aiReply || "[Media Sent]" });
      }
    }
    
  } catch (error) {
    console.error("[AI Handler] OUTER Error processing message:", error);
  }
}

export async function generateContextualFollowUp(phone: string, followUpPrompt: string): Promise<string> {
  const config = DB.getConfig();
  const apiKey = getApiKey(config);

  if (!apiKey) {
    return followUpPrompt || "Hello! Just checking in.";
  }

  const history = DB.getChats(phone);
  const recentHistory = history.filter((m: any) => m.role === 'user' || m.role === 'assistant').slice(-5).map((m: any) => ({ role: m.role, content: m.content }));

  let systemPrompt = `You are an expert Booking and Sales AI Assistant.\nYour goal is to re-engage the customer based on their recent chat history. Keep it natural, friendly, and concise (1-3 sentences).`;
  
  if (followUpPrompt && followUpPrompt.trim() !== "") {
    systemPrompt += `\n\nWe have a default follow-up message: "${followUpPrompt}".\nDO NOT just repeat this message verbatim. Instead, use it as inspiration and re-write it to directly reference what you and the user were last talking about in the chat history. Make it highly contextual and personalized.`;
  } else {
    systemPrompt += `\n\nInstruction: Look at the chat history. The user hasn't replied in a while. Craft a short, personalized follow-up message to restart the conversation, referencing their last inquiry.`;
  }

  try {
    const res = await callLLM(apiKey, systemPrompt, recentHistory, []);
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

export async function generateScheduledFollowUp(phone: string, contextNote: string): Promise<string> {
  const config = DB.getConfig();
  const apiKey = getApiKey(config);

  if (!apiKey) {
    return `Hi! Following up on what we discussed: ${contextNote}`;
  }

  const history = DB.getChats(phone);
  const recentHistory = history.filter((m: any) => m.role === 'user' || m.role === 'assistant').slice(-5).map((m: any) => ({ role: m.role, content: m.content }));

  let systemPrompt = `You are an expert Booking and Sales AI Assistant. You previously promised the user you would follow up with them later. It is now time to send that follow-up.`;
  systemPrompt += `\n\nContext for this follow-up: ${contextNote}\n\nInstruction: Look at the chat history and the context note above. Craft a natural, friendly, and highly relevant follow-up message fulfilling your promise to the user.`;

  try {
    const res = await callLLM(apiKey, systemPrompt, recentHistory, []);
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
