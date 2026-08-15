import Anthropic from "@anthropic-ai/sdk";

const apiKey = "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";
const anthropic = new Anthropic({ apiKey });

async function testAll() {
  const models = [
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-haiku-20240307",
    "claude-3-5-sonnet-20240620",
    "claude-3-opus-20240229",
    "claude-3-sonnet-20240229",
    "claude-3-5-sonnet-latest",
    "claude-3-5-haiku-latest"
  ];

  console.log("Starting model sweep...");

  for (const model of models) {
    try {
      console.log(`Trying ${model}...`);
      const res = await anthropic.messages.create({
        model: model,
        max_tokens: 10,
        messages: [{ role: "user", content: "hi" }]
      });
      console.log(`\n🎉 WORKING MODEL FOUND: "${model}"`);
      console.log("Response:", res.content[0]);
      return;
    } catch (e: any) {
      console.log(`❌ ${model} failed: ${e.status} - ${e.message}`);
    }
  }
  console.log("\n❌ ALL MODELS FAILED. Check API Key validity.");
}

testAll();
