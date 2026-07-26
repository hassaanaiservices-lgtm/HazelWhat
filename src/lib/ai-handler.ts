import Anthropic from "@anthropic-ai/sdk";
import { WhatsAppManager } from "./whatsapp";
import { DB } from "./db";
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

function debugLog(msg: string) {
  try {
    const logPath = path.join(process.cwd(), ".data", "debug.log");
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
    
    if (!from || (!content && !hasImage)) return;

    console.log(`[AI Handler] Received message from ${from}: ${content} (HasImage: ${hasImage})`);

    let base64Image = null;
    if (hasImage) {
      console.log(`[AI Handler] Downloading incoming media for vision analysis...`);
      const buffer = await WhatsAppManager.downloadMedia(msg);
      if (buffer) {
        base64Image = buffer.toString('base64');
      }
    }

    DB.addChatMessage(from, { role: "user", content: hasImage ? `[Image] ${content}` : content });
    
    DB.updateCustomer(from, { 
      followUpLevel: 0,
      leadStatus: "hot",
      ...(msg.pushName ? { name: msg.pushName } : {})
    });
    DB.cancelPendingFollowUps(from);

    const config = DB.getConfig();
    const customer = DB.getCustomer(from);

    const globalAiEnabled = config.globalAiEnabled !== false;
    const chatAiEnabled = customer?.aiEnabled;
    const shouldAiRespond = chatAiEnabled !== undefined ? chatAiEnabled : globalAiEnabled;

    if (!shouldAiRespond) {
      console.log(`[AI Handler] AI Autopilot is OFF for ${from}. Ignoring message.`);
      return;
    }

    const lowerContent = content.toLowerCase();
    const matchedKeyword = config.keywordReplies?.find(k => 
      k.keyword.trim() !== "" && lowerContent.includes(k.keyword.toLowerCase())
    );

    if (matchedKeyword) {
      console.log(`[AI Handler] Keyword matched: ${matchedKeyword.keyword}`);
      const sentMsg = await WhatsAppManager.sendMessage(from, matchedKeyword.reply);
      DB.addChatMessage(from, { id: sentMsg?.key?.id, role: "assistant", content: matchedKeyword.reply });
      return;
    }

    console.log("=== AI HANDLER VERSION 6 (Anthropic SDK) ===");

    const anthropicKey = (config.anthropicApiKey || getEnvKey("ANTHROPIC_API_KEY") || process.env.ANTHROPIC_API_KEY || "").trim();
    const openRouterKey = (config.openRouterApiKey || getEnvKey("OPENROUTER_API_KEY") || process.env.OPENROUTER_API_KEY || "").trim();

    debugLog(`=== Incoming Message from ${from} ===`);
    debugLog(`Content: "${content}"`);
    debugLog(`Anthropic Key source: config=${config.anthropicApiKey ? "yes" : "no"}, env=${getEnvKey("ANTHROPIC_API_KEY") ? "yes" : "no"}, process=${process.env.ANTHROPIC_API_KEY ? "yes" : "no"}`);
    debugLog(`OpenRouter Key source: config=${config.openRouterApiKey ? "yes" : "no"}, env=${getEnvKey("OPENROUTER_API_KEY") ? "yes" : "no"}, process=${process.env.OPENROUTER_API_KEY ? "yes" : "no"}`);

    const attempts: { type: "anthropic" | "openrouter" | "openrouter-free"; key: string; model: string }[] = [];
    if (anthropicKey) {
      attempts.push({ type: "anthropic", key: anthropicKey, model: "claude-haiku-4-5-20251001" });
    }
    if (openRouterKey) {
      attempts.push({ type: "openrouter", key: openRouterKey, model: "anthropic/claude-haiku-4.5" });
      attempts.push({ type: "openrouter-free", key: openRouterKey, model: "google/gemma-4-31b-it:free" });
      attempts.push({ type: "openrouter-free", key: openRouterKey, model: "google/gemma-4-26b-a4b-it:free" });
    }

    if (attempts.length === 0) {
      console.error("[AI Handler] Neither ANTHROPIC_API_KEY nor OPENROUTER_API_KEY is configured.");
      const fallback = "I'm currently experiencing a high volume of requests. A human agent will be with you shortly!";
      const sentMsg = await WhatsAppManager.sendMessage(from, fallback);
      DB.addChatMessage(from, { id: sentMsg?.key?.id, role: "assistant", content: fallback });
      return;
    }

    let aiReply = "I'm sorry, I didn't quite catch that. Could you rephrase?";
    let fullSystemPrompt = `${config.systemPrompt}\n\nToday's Date: ${new Date().toISOString().split('T')[0]}\n\nProduct Information:\n${config.productInfo}`;
    
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
8. PROACTIVE FOLLOW-UPS: Whenever you tell the user you will follow up or check back later, you MUST call the schedule_followup tool to actually schedule it. Never just say it without calling the tool.`;

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
    // Filter out system messages, Anthropic only wants user and assistant
    let recentHistory = history.filter((m: any) => m.role === 'user' || m.role === 'assistant').slice(-10).map((m: any) => ({ role: m.role, content: m.content }));

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
      }
    ];

    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i];
      const isOpenRouter = attempt.type.startsWith("openrouter");
      
      console.log(`[AI Handler] Attempting connection via ${attempt.type.toUpperCase()} using model ${attempt.model}...`);
      
      const anthropic = new Anthropic({ 
        apiKey: attempt.key,
        ...(isOpenRouter ? { 
          baseURL: "https://openrouter.ai/api",
          defaultHeaders: {
            "HTTP-Referer": "https://hazeldid.com", 
            "X-Title": "HazelWhat"
          }
        } : {})
      });
      const modelName = attempt.model;

      try {
        await WhatsAppManager.sendTyping(from);
        console.log(`[AI Handler] Requesting completion from ${attempt.type.toUpperCase()}...`);
        let res = await anthropic.messages.create({
          model: modelName,
          max_tokens: 2000,
          system: fullSystemPrompt,
          messages: recentHistory as any,
          tools: tools,
          temperature: 0.7,
        });

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
                toolResult = JSON.stringify({ success: true, message: "Order placed and saved to database successfully. You may now confirm the final order details to the user." });
              } catch (err: any) {
                console.error("[AI Handler] place_order error:", err);
                toolResult = JSON.stringify({ success: false, message: "Failed to place order: " + err.message });
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
          res = await anthropic.messages.create({
            model: modelName,
            max_tokens: 2000,
            system: fullSystemPrompt,
            messages: recentHistory as any,
            tools: tools,
            temperature: 0.7,
          });

          textContent = "";
          for (const block of res.content) {
            if (block.type === 'text') {
              textContent += block.text;
            }
          }
          aiReply = textContent || aiReply;
        }
        
        debugLog(`SUCCESS: ${attempt.type.toUpperCase()} with model ${attempt.model} generated reply: "${aiReply.substring(0, 60)}..."`);
        break; // break the loop, we successfully generated response!
      } catch (apiErr: any) {
        const errorDetail = apiErr.message || JSON.stringify(apiErr);
        console.error(`[AI Handler] API ERROR CAUGHT for ${attempt.type.toUpperCase()}:`, errorDetail);
        debugLog(`FAILURE: ${attempt.type.toUpperCase()} with model ${attempt.model} failed. Error: ${errorDetail}`);
        
        if (i === attempts.length - 1) {
          aiReply = "I'm currently experiencing a high volume of requests and having some technical difficulties. A human agent will be with you shortly, or you can try again later!";
        } else {
          console.log("[AI Handler] Switching to fallback API client...");
        }
      }
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
      sentMsg = await WhatsAppManager.sendMessage(from, aiReply);
      console.log(`[AI Handler] Replied to ${from}: ${aiReply}`);
    }

    DB.addChatMessage(from, { id: sentMsg?.key?.id, role: "assistant", content: aiReply || "[Media Sent]" });
    
  } catch (error) {
    console.error("[AI Handler] OUTER Error processing message:", error);
  }
}

export async function generateContextualFollowUp(phone: string, followUpPrompt: string): Promise<string> {
  const config = DB.getConfig();
  const anthropicKey = (config.anthropicApiKey || getEnvKey("ANTHROPIC_API_KEY") || process.env.ANTHROPIC_API_KEY || "").trim();
  const openRouterKey = (config.openRouterApiKey || getEnvKey("OPENROUTER_API_KEY") || process.env.OPENROUTER_API_KEY || "").trim();

  const attempts: { type: "anthropic" | "openrouter"; key: string }[] = [];
  if (anthropicKey) {
    attempts.push({ type: "anthropic", key: anthropicKey });
  }
  if (openRouterKey) {
    attempts.push({ type: "openrouter", key: openRouterKey });
  }

  if (attempts.length === 0) {
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

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    const isOpenRouter = attempt.type === "openrouter";
    const anthropic = new Anthropic({ 
      apiKey: attempt.key,
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
      const res = await anthropic.messages.create({
        model: modelName,
        max_tokens: 1000,
        system: systemPrompt,
        messages: recentHistory as any,
        temperature: 0.7,
      });

      let textContent = "";
      for (const block of res.content) {
        if (block.type === 'text') {
          textContent += block.text;
        }
      }
      return textContent || "Hi there! Just following up to see if you needed any more help?";
    } catch (error: any) {
      console.error(`[AI Handler] Error generating contextual follow-up using ${attempt.type.toUpperCase()}:`, error.message || error);
      if (i === attempts.length - 1) {
        return "Hi there! Just checking in to see if you need any more help?";
      }
    }
  }
  return "Hi there! Just checking in to see if you need any more help?";
}

export async function generateScheduledFollowUp(phone: string, contextNote: string): Promise<string> {
  const config = DB.getConfig();
  const anthropicKey = (config.anthropicApiKey || getEnvKey("ANTHROPIC_API_KEY") || process.env.ANTHROPIC_API_KEY || "").trim();
  const openRouterKey = (config.openRouterApiKey || getEnvKey("OPENROUTER_API_KEY") || process.env.OPENROUTER_API_KEY || "").trim();

  const attempts: { type: "anthropic" | "openrouter"; key: string }[] = [];
  if (anthropicKey) {
    attempts.push({ type: "anthropic", key: anthropicKey });
  }
  if (openRouterKey) {
    attempts.push({ type: "openrouter", key: openRouterKey });
  }

  if (attempts.length === 0) {
    return `Hi! Following up on what we discussed: ${contextNote}`;
  }

  const history = DB.getChats(phone);
  const recentHistory = history.filter((m: any) => m.role === 'user' || m.role === 'assistant').slice(-5).map((m: any) => ({ role: m.role, content: m.content }));

  let systemPrompt = `You are an expert Booking and Sales AI Assistant. You previously promised the user you would follow up with them later. It is now time to send that follow-up.`;
  systemPrompt += `\n\nContext for this follow-up: ${contextNote}\n\nInstruction: Look at the chat history and the context note above. Craft a natural, friendly, and highly relevant follow-up message fulfilling your promise to the user.`;

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    const isOpenRouter = attempt.type === "openrouter";
    const anthropic = new Anthropic({ 
      apiKey: attempt.key,
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
      const res = await anthropic.messages.create({
        model: modelName,
        max_tokens: 1000,
        system: systemPrompt,
        messages: recentHistory as any,
        temperature: 0.7,
      });

      let textContent = "";
      for (const block of res.content) {
        if (block.type === 'text') {
          textContent += block.text;
        }
      }
      return textContent || `Hi! Following up on what we discussed: ${contextNote}`;
    } catch (error: any) {
      console.error(`[AI Handler] Error generating scheduled follow-up using ${attempt.type.toUpperCase()}:`, error.message || error);
      if (i === attempts.length - 1) {
        return `Hi! Following up on what we discussed: ${contextNote}`;
      }
    }
  }
  return `Hi! Following up on what we discussed: ${contextNote}`;
}
