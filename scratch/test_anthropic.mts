import Anthropic from "@anthropic-ai/sdk";

const apiKey = "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";
console.log("Testing Anthropic Key starting with:", apiKey.substring(0, 15));

const anthropic = new Anthropic({ apiKey });

async function test() {
  const models = [
    "claude-3-haiku-20240307",
    "claude-3-5-haiku-latest",
    "claude-3-5-sonnet-20241022",
    "claude-3-5-sonnet-latest"
  ];

  for (const model of models) {
    try {
      console.log(`Testing model: ${model}...`);
      const res = await anthropic.messages.create({
        model,
        max_tokens: 50,
        messages: [{ role: "user", content: "Hi" }]
      });
      console.log(`✅ Model ${model} SUCCESS! Reply:`, res.content[0]);
      return;
    } catch (e: any) {
      console.error(`❌ Model ${model} FAILED:`, e.status, e.message);
    }
  }
}

test();
