// Native fetch is global in Node.js 18+

const apiKey = "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";

async function list() {
  try {
    const res = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      }
    });

    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Available Models Data:", JSON.stringify(data, null, 2));
  } catch (e: any) {
    console.error("Failed to fetch models list:", e.message);
  }
}

list();
