import { NextResponse } from "next/server";
// @ts-ignore
import pdf from "pdf-parse";

const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4,6}/g;

function parsePhones(text: string): string[] {
  const rawMatches = text.match(phoneRegex) || [];
  const cleaned = rawMatches.map(num => {
    const digits = num.replace(/[^\d]/g, "");
    if (digits.startsWith("0") && digits.length === 11) {
      return "92" + digits.substring(1);
    }
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
        const data = await pdf(buffer);
        text = data.text || "";
      } catch (e: any) {
        console.error("Failed to parse PDF:", e);
        return NextResponse.json({ success: false, error: `Failed to parse PDF file: ${e.message}` }, { status: 500 });
      }
    } else {
      // Treat as plain text / CSV
      text = buffer.toString("utf-8");
    }

    const phones = parsePhones(text);

    return NextResponse.json({ success: true, phones, count: phones.length });
  } catch (error: any) {
    console.error("Error in parse-leads API:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
