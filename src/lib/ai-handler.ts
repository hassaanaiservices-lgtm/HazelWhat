import OpenAI from "openai";
import { WhatsAppManager } from "./whatsapp";
import { DB } from "./db";
import dns from "dns";

dns.setDefaultResultOrder("ipv4first");

export async function handleWhatsAppMessage(msg: any) {
  try {
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
          
          // Trigger order collection flow instead of just saying "received"
          const reply = `Great choice! To place an order for *${productName}*, I just need a few details:\n\n1. What size/color would you like?\n2. What is your delivery address?\n3. Please provide a contact phone number.\n\nYou can type your answers below!`;
          await WhatsAppManager.sendMessage(from, reply);
          
          // Save interaction to DB so it shows up in chat history and AI context
          DB.addChatMessage(from, { role: "user", content: `[I want to order: ${productName}]` });
          DB.addChatMessage(from, { role: "assistant", content: reply });
          return; // Let the AI pick up from here on the next message
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

    // Save user message to DB
    DB.addChatMessage(from, { role: "user", content: hasImage ? `[Image] ${content}` : content });
    
    // Reset System B follow-up level on user response, update name, and set as Hot Lead
    DB.updateCustomer(from, { 
      followUpLevel: 0,
      leadStatus: "hot",
      ...(msg.pushName ? { name: msg.pushName } : {})
    });
    // Cancel any pending System A proactive follow-ups
    DB.cancelPendingFollowUps(from);

    const config = DB.getConfig();
    const customer = DB.getCustomer(from);

    const globalAiEnabled = config.globalAiEnabled !== false; // Default true
    const chatAiEnabled = customer?.aiEnabled;
    const shouldAiRespond = chatAiEnabled !== undefined ? chatAiEnabled : globalAiEnabled;

    if (!shouldAiRespond) {
      console.log(`[AI Handler] AI Autopilot is OFF for ${from}. Ignoring message.`);
      return;
    }

    // Check for static keyword matches
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

    console.log("=== AI HANDLER VERSION 5 ===");

    const rawApiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    const apiKey = rawApiKey ? rawApiKey.trim() : undefined;
    
    if (!apiKey) {
      console.error("[AI Handler] OPENAI_API_KEY / OPENROUTER_API_KEY is not set.");
      const fallback = "Hello! I am your AI Sales Assistant. Unfortunately, my brain (API key) is not configured yet. Please check back later!";
      const sentMsg = await WhatsAppManager.sendMessage(from, fallback);
      DB.addChatMessage(from, { id: sentMsg?.key?.id, role: "assistant", content: fallback });
      return;
    }

    const isOpenRouter = apiKey.startsWith("sk-or-");
    
    console.log(`[AI Handler] API Key Check -> Starts with sk-or-: ${isOpenRouter}`);
    console.log(`[AI Handler] API Key length: ${apiKey.length}`);

    let aiReply = "I'm sorry, I didn't quite catch that. Could you rephrase?";

    try {
      const openai = new OpenAI({
        apiKey,
        baseURL: isOpenRouter ? "https://openrouter.ai/api/v1" : "https://api.openai.com/v1",
        defaultHeaders: isOpenRouter ? {
          "HTTP-Referer": "https://hazeldid.com",
          "X-Title": "HazelWhat SaaSBot",
        } : undefined,
        maxRetries: 4,
        timeout: 20000,
      });
      
      console.log(`[AI Handler] OpenAI Client Initialized. BaseURL: ${openai.baseURL}`);

      let fullSystemPrompt = `${config.systemPrompt}\n\nToday's Date: ${new Date().toISOString().split('T')[0]}\n\nProduct Information:\n${config.productInfo}`;
      
      fullSystemPrompt += `\n\nCRITICAL RULES FOR PRODUCT RECOMMENDATIONS:
1. When showing a product to the customer, you must ALWAYS call the send_product_card function with the correct product data.
2. You must NEVER write product images, links, or markdown syntax directly in a text response.
3. If you want to show a product, calling the tool IS the only correct action — do not also describe it in a text message at the same time.
4. BE CONVERSATIONAL. If a user just says "hi", reply with a warm greeting and ask how you can help them. DO NOT immediately blast them with a list of products.
5. If the user sends an image, visually analyze it and suggest the closest matching items from the Product Information using the send_product_card tool.
6. ORDER COLLECTION: When a user expresses intent to order a product, you MUST IMMEDIATELY call the \`place_order\` tool with whatever details you have so far (at least the product_name). NEVER wait for all details to call the tool.
   - If you are missing size, color, delivery address, contact number, or payment method, pass them as empty strings or omit them in the tool call.
   - AFTER calling the tool, ask the user for the remaining missing details in your text response.
   - If the user provides more details later, call \`place_order\` again to update it.
7. VARIATIONS & PRICING: If a product has multiple variations (like different ages/sizes), do NOT immediately state a generic price. Instead:
    - First, show the product card to the user. You MUST set the \`price\` parameter to "Hidden" when calling send_product_card so the price is not shown in the card.
    - Then, ask the customer in your text response: "How old is your child?" or "What size are you looking for?"
    - Once they tell you the size, check the specific Variations for that product and tell them the exact price for that size in text.
    - If they already mentioned the size in their initial request, you can directly show the card and state the exact price for that size.
8. PROACTIVE FOLLOW-UPS: Whenever you tell the user you will follow up or check back later, you MUST call the \`schedule_followup\` tool to actually schedule it. Never just say it without calling the tool.`;

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
      let recentHistory = history.slice(-10).map((m: any) => ({ role: m.role, content: m.content }));

      // Attach base64 image to the latest user message for OpenAI Vision
      if (base64Image) {
        const lastUserMsg = recentHistory[recentHistory.length - 1];
        if (lastUserMsg && lastUserMsg.role === 'user') {
          lastUserMsg.content = [
            { type: "text", text: lastUserMsg.content },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
          ] as any;
        }
      }

      const messages = [
        { role: "system", content: fullSystemPrompt },
        ...recentHistory
      ] as any;

      const tools = [
        {
          type: "function",
          function: {
            name: "checkAvailability",
            description: "Checks available appointment time slots for a given date. Available hours are 9 AM to 5 PM, on the hour.",
            parameters: {
              type: "object",
              properties: {
                date: { type: "string", description: "The date to check availability for (YYYY-MM-DD)" }
              },
              required: ["date"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "bookAppointment",
            description: "Books an appointment for the user. Call checkAvailability first if you haven't.",
            parameters: {
              type: "object",
              properties: {
                name: { type: "string", description: "User's full name" },
                service: { type: "string", description: "The service they want to book" },
                date: { type: "string", description: "Date of appointment (YYYY-MM-DD)" },
                time: { type: "string", description: "Time of appointment (HH:MM)" }
              },
              required: ["name", "service", "date", "time"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "cancelAppointment",
            description: "Cancels an existing appointment for the user.",
            parameters: {
              type: "object",
              properties: {
                date: { type: "string", description: "Date of appointment (YYYY-MM-DD)" },
                time: { type: "string", description: "Time of appointment (HH:MM)" }
              },
              required: ["date", "time"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "send_product_card",
            description: "Sends a beautiful interactive product card to the user. Use this ALWAYS when recommending or showing a product.",
            parameters: {
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
          }
        },
        {
          type: "function",
          function: {
            name: "place_order",
            description: "Finalizes and places an order for the user after all details (size, color, delivery address, contact number, payment method) have been collected.",
            parameters: {
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
          }
        },
        {
          type: "function",
          function: {
            name: "schedule_followup",
            description: "Schedules a follow-up message to be sent to the user at a specific future time. Use this when you promise to check back later or follow up.",
            parameters: {
              type: "object",
              properties: {
                send_at: { type: "string", description: "An ISO 8601 timestamp for when to send the follow-up. Calculate this strictly based on the current Date provided in the system prompt." },
                message_context: { type: "string", description: "A short note explaining why we are following up and what to say (e.g., 'Check if they liked the red dress')." }
              },
              required: ["send_at", "message_context"]
            }
          }
        }
      ] as any;

      // Send typing indicator to WhatsApp while we wait for AI
      await WhatsAppManager.sendTyping(from);

      console.log("[AI Handler] Requesting completion from AI...");
      let res = await openai.chat.completions.create({
        model: isOpenRouter ? "openai/gpt-4o-mini" : "gpt-4o-mini",
        messages,
        temperature: 0.7,
        tools,
        tool_choice: "auto",
      });
      
      let message = res.choices[0].message;

      // Handle tool calls
      if (message.tool_calls) {
        console.log("[AI Handler] AI requested tool calls:", JSON.stringify(message.tool_calls));
        messages.push(message);
        
        for (const _toolCall of message.tool_calls) {
          const toolCall = _toolCall as any;
          const args = JSON.parse(toolCall.function.arguments);
          let toolResult = "";

          if (toolCall.function.name === "checkAvailability") {
            const booked = DB.getAppointmentsByDate(args.date);
            const bookedTimes = booked.map(a => a.time);
            const allHours = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
            const available = allHours.filter(h => !bookedTimes.includes(h));
            toolResult = JSON.stringify({ availableTimes: available });
          } 
          else if (toolCall.function.name === "bookAppointment") {
            const success = DB.bookAppointment(from, args.name, args.service, args.date, args.time);
            toolResult = JSON.stringify({ success, message: success ? "Appointment booked successfully." : "Time slot already taken. Please pick another." });
          }
          else if (toolCall.function.name === "cancelAppointment") {
            const success = DB.cancelAppointment(from, args.date, args.time);
            toolResult = JSON.stringify({ success, message: success ? "Appointment cancelled successfully." : "No such appointment found to cancel." });
          }
          else if (toolCall.function.name === "send_product_card") {
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
          else if (toolCall.function.name === "place_order") {
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
          else if (toolCall.function.name === "schedule_followup") {
            try {
              // Cancel any old ones to prevent duplicates/stacking
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

          messages.push({
            role: "tool",
            content: toolResult,
            tool_call_id: toolCall.id,
          });
        }

        console.log("[AI Handler] Sending tool results back to AI...");
        res = await openai.chat.completions.create({
          model: isOpenRouter ? "openai/gpt-4o-mini" : "gpt-4o-mini",
          messages,
          temperature: 0.7,
          tools,
        });
        message = res.choices[0].message;
      }

      console.log("[AI Handler] Final AI Completion received.");
      aiReply = message.content || aiReply;
      
    } catch (apiErr: any) {
      console.error("[AI Handler] INNER API ERROR CAUGHT:", apiErr);
      const errMsg = apiErr?.error?.message || apiErr?.message || apiErr.toString();
      aiReply = `Oops! My AI brain encountered an error: *${errMsg}* \n\nPlease check the logs.`;
    }

    // --- Auto-Convert Markdown Images ---
    // If AI outputs ![alt](url), convert it to [MEDIA:url] so our interceptor catches it
    if (aiReply) {
      aiReply = aiReply.replace(/!\[.*?\]\((https?:\/\/[^\)]+)\)/g, '[MEDIA:$1]');
    }

    // --- Media Interceptor ---
    const mediaRegex = /\[MEDIA:(.+?)\]/g;
    let match;
    const extractedMedia = [];
    while ((match = mediaRegex.exec(aiReply)) !== null) {
      extractedMedia.push(match[1]);
    }
    
    // Clean the reply text by removing the tags
    aiReply = aiReply.replace(mediaRegex, '').trim();

    // Send any extracted media first
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

    // Send the remaining text reply via WhatsApp (if any text is left)
    let sentMsg = null;
    if (aiReply.length > 0) {
      sentMsg = await WhatsAppManager.sendMessage(from, aiReply);
      console.log(`[AI Handler] Replied to ${from}: ${aiReply}`);
    }

    // Save assistant message to DB
    DB.addChatMessage(from, { id: sentMsg?.key?.id, role: "assistant", content: aiReply || "[Media Sent]" });
    
  } catch (error) {
    console.error("[AI Handler] OUTER Error processing message:", error);
  }
}

export async function generateContextualFollowUp(phone: string, followUpPrompt: string): Promise<string> {
  const config = DB.getConfig();
  const rawApiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  const apiKey = rawApiKey ? rawApiKey.trim() : undefined;
  
  if (!apiKey) {
    return followUpPrompt || "Hello! Just checking in.";
  }

  const isOpenRouter = apiKey.startsWith("sk-or-");
  const openai = new OpenAI({
    apiKey,
    baseURL: isOpenRouter ? "https://openrouter.ai/api/v1" : "https://api.openai.com/v1",
    defaultHeaders: isOpenRouter ? {
      "HTTP-Referer": "https://hazeldid.com",
      "X-Title": "HazelWhat SaaSBot",
    } : undefined,
    maxRetries: 2,
    timeout: 15000,
  });

  const history = DB.getChats(phone);
  const recentHistory = history.slice(-5).map(m => ({ role: m.role, content: m.content }));

  let systemPrompt = `You are an expert Booking and Sales AI Assistant.\nYour goal is to re-engage the customer based on their recent chat history. Keep it natural, friendly, and concise (1-3 sentences).`;
  
  if (followUpPrompt && followUpPrompt.trim() !== "") {
    systemPrompt += `\n\nSpecific Instruction for this follow-up: ${followUpPrompt}`;
  } else {
    systemPrompt += `\n\nInstruction: Look at the chat history. The user hasn't replied in a while. Craft a short, personalized follow-up message to restart the conversation.`;
  }

  const messages = [
    { role: "system", content: systemPrompt },
    ...recentHistory
  ] as any;

  try {
    const rawApiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    const apiKey = rawApiKey ? rawApiKey.trim() : "";
    const isOpenRouter = apiKey.startsWith("sk-or-");
    
    if (!apiKey) return "Hi there! Just following up to see if you needed any more help?";

    const openai = new OpenAI({
      apiKey,
      baseURL: isOpenRouter ? "https://openrouter.ai/api/v1" : "https://api.openai.com/v1",
      defaultHeaders: isOpenRouter ? {
        "HTTP-Referer": "https://hazeldid.com",
        "X-Title": "HazelWhat SaaSBot",
      } : undefined,
    });

    const res = await openai.chat.completions.create({
      model: isOpenRouter ? "openai/gpt-4o-mini" : "gpt-4o-mini",
      messages,
      temperature: 0.7,
    });

    return res.choices[0].message?.content || "Hi there! Just following up to see if you needed any more help?";
  } catch (error) {
    console.error("[AI Handler] Error generating contextual follow-up:", error);
    return "Hi there! Just checking in to see if you need any more help?";
  }
}

export async function generateScheduledFollowUp(phone: string, contextNote: string): Promise<string> {
  const config = DB.getConfig();
  const history = DB.getChats(phone);
  const recentHistory = history.slice(-5).map(m => ({ role: m.role, content: m.content }));

  let systemPrompt = `You are an expert Booking and Sales AI Assistant. You previously promised the user you would follow up with them later. It is now time to send that follow-up.`;
  
  systemPrompt += `\n\nContext for this follow-up: ${contextNote}\n\nInstruction: Look at the chat history and the context note above. Craft a natural, friendly, and highly relevant follow-up message fulfilling your promise to the user.`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...recentHistory
  ] as any;

  try {
    const rawApiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    const apiKey = rawApiKey ? rawApiKey.trim() : "";
    const isOpenRouter = apiKey.startsWith("sk-or-");
    
    if (!apiKey) return `Hi! Following up on what we discussed: ${contextNote}`;

    const openai = new OpenAI({
      apiKey,
      baseURL: isOpenRouter ? "https://openrouter.ai/api/v1" : "https://api.openai.com/v1",
      defaultHeaders: isOpenRouter ? {
        "HTTP-Referer": "https://hazeldid.com",
        "X-Title": "HazelWhat SaaSBot",
      } : undefined,
    });

    const res = await openai.chat.completions.create({
      model: isOpenRouter ? "openai/gpt-4o-mini" : "gpt-4o-mini",
      messages,
      temperature: 0.7,
    });

    return res.choices[0].message?.content || `Hi! Following up on what we discussed: ${contextNote}`;
  } catch (error) {
    console.error("[AI Handler] Error generating scheduled follow-up:", error);
    return `Hi! Following up on what we discussed: ${contextNote}`;
  }
}
