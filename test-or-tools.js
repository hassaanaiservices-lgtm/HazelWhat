const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");

// Load .env manually
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  const match = content.match(/OPENROUTER_API_KEY=(.+)/);
  if (match) {
    process.env.OPENROUTER_API_KEY = match[1].trim();
  }
}

const apiKey = process.env.OPENROUTER_API_KEY;

const anthropic = new Anthropic({
  apiKey,
  baseURL: "https://openrouter.ai/api",
  defaultHeaders: {
    "HTTP-Referer": "https://hazeldid.com",
    "X-Title": "HazelWhat"
  }
});

const tools = [
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
  }
];

const freeModels = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "inclusionai/ling-3.0-flash:free",
  "poolside/laguna-s-2.1:free",
  "poolside/laguna-xs-2.1:free",
  "cohere/north-mini-code:free",
  "openai/gpt-oss-20b:free"
];

async function test() {
  for (const model of freeModels) {
    try {
      console.log(`Trying free model: ${model} with tools...`);
      const res = await anthropic.messages.create({
        model: model,
        max_tokens: 100,
        messages: [{ role: "user", content: "Hi" }],
        tools: tools,
        temperature: 0.7,
      });
      console.log(`SUCCESS for ${model}! Response:`, JSON.stringify(res.content));
      break;
    } catch (err) {
      console.error(`FAILED for ${model}:`, err.message || err);
    }
  }
}

test();
