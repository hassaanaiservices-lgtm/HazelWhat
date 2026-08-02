import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

function cleanText(text: string): string {
  return text
    .replace(/[\u2013\u2014\u2212]/g, "-") // Normalize en-dash, em-dash, minus sign to hyphen
    .replace(/[\u00A0\u200B\u200C\u200D]/g, " ") // Normalize non-breaking and zero-width spaces
    .replace(/[\/\\]/g, " "); // Replace slashes with space
}

const phoneRegex = /(?:\+?\d{1,4}[\s.-]?)?(?:\(?\d{2,5}\)?[\s.-]?)?\d{2,5}[\s.-]?\d{2,5}(?:[\s.-]?\d{2,7})?/g;

export function extractPhonesFromText(rawText: string): string[] {
  if (!rawText) return [];
  const text = cleanText(rawText);
  const found = new Set<string>();

  function normalizeAndAdd(candidate: string) {
    let digits = candidate.replace(/[^\d]/g, "");
    if (digits.startsWith("00")) {
      digits = digits.substring(2);
    }
    // Pakistani local format: 03xx-xxxxxxx or 042-xxxxxxx (11 digits starting with 0)
    if (digits.startsWith("0") && digits.length === 11) {
      digits = "92" + digits.substring(1);
    }
    if (digits.length >= 10 && digits.length <= 15) {
      found.add(digits);
    }
  }

  // 1. Pattern matching
  const matches = text.match(phoneRegex) || [];
  for (const m of matches) {
    normalizeAndAdd(m);
  }

  // 2. Line / token based extraction (CSV, TSV, VCF, pasted lines)
  const tokens = text.split(/[\r\n,;\t|]+/);
  for (const token of tokens) {
    normalizeAndAdd(token);
  }

  // Filter out sub-string matches
  const result = Array.from(found);
  return result.filter(
    num => !result.some(other => other !== num && other.includes(num) && other.length > num.length)
  );
}

export async function POST(req: Request) {
  try {
    const { mediaBase64, mimetype, fileName } = await req.json();
    if (!mediaBase64) {
      return NextResponse.json({ success: false, error: "No file content provided." }, { status: 400 });
    }

    const base64Data = mediaBase64.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    let text = "";

    const isPDF = mimetype === "application/pdf" || fileName?.toLowerCase().endsWith(".pdf");

    if (isPDF) {
      try {
        const parser = new PDFParse({ data: new Uint8Array(buffer) });
        const result = await parser.getText();
        text = (result as any)?.text || "";
        if (!text && Array.isArray((result as any)?.pages)) {
          text = (result as any).pages.map((p: any) => p.text || "").join("\n");
        }
        console.log(`[parse-leads] PDF "${fileName}" extracted ${text.length} chars. First 300:`, text.substring(0, 300));
        await parser.destroy();
      } catch (e: any) {
        console.error("Failed to parse PDF:", e);
        return NextResponse.json({ success: false, error: `Failed to parse PDF file: ${e.message}` }, { status: 500 });
      }
    } else {
      // Treat as plain text / CSV / TSV
      text = buffer.toString("utf-8");
    }

    const phones = extractPhonesFromText(text);
    console.log(`[parse-leads] "${fileName}" => found ${phones.length} phone numbers. Sample:`, phones.slice(0, 10));

    return NextResponse.json({ success: true, phones, count: phones.length, rawTextLength: text.length });
  } catch (error: any) {
    console.error("Error in parse-leads API:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


