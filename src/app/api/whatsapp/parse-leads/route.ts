import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

// Broad regex: matches 10-15 digit sequences that may include country code, dashes, spaces, dots, parens
// Catches: +923001234567, 03001234567, 0300-1234567, +92 300 123 4567, (0300) 1234567, etc.
const phoneRegex = /(?:\+?\d{1,4}[\s.-]?)?(?:\(?\d{2,5}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,7}/g;

function parsePhones(text: string): string[] {
  const rawMatches = text.match(phoneRegex) || [];
  const cleaned = rawMatches.map(num => {
    const digits = num.replace(/[^\d]/g, "");
    // Pakistani local format: 03xx-xxxxxxx (11 digits starting with 0)
    if (digits.startsWith("0") && digits.length === 11) {
      return "92" + digits.substring(1);
    }
    // Already has country code like 923001234567
    return digits;
  }).filter(digits => digits.length >= 10 && digits.length <= 15);
  return Array.from(new Set(cleaned));
}

export async function POST(req: Request) {
  try {
    const { mediaBase64, mimetype, fileName } = await req.json();
    if (!mediaBase64) {
      return NextResponse.json({ success: false, error: "No file content provided." }, { status: 400 });
    }

    const base64Data = mediaBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    
    let text = "";

    if (mimetype === "application/pdf" || fileName?.endsWith(".pdf")) {
      try {
        const parser = new PDFParse({ data: new Uint8Array(buffer) });
        // getText() with no args extracts text from all pages automatically
        const result = await parser.getText();
        text = (result as any)?.toString() || String(result) || "";
        console.log(`[parse-leads] PDF "${fileName}" extracted ${text.length} chars. First 500:`, text.substring(0, 500));
        await parser.destroy();
      } catch (e: any) {
        console.error("Failed to parse PDF:", e);
        return NextResponse.json({ success: false, error: `Failed to parse PDF file: ${e.message}` }, { status: 500 });
      }
    } else {
      // Treat as plain text / CSV
      text = buffer.toString("utf-8");
    }

    const phones = parsePhones(text);
    console.log(`[parse-leads] "${fileName}" => found ${phones.length} phone numbers. Sample:`, phones.slice(0, 10));

    return NextResponse.json({ success: true, phones, count: phones.length });
  } catch (error: any) {
    console.error("Error in parse-leads API:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

