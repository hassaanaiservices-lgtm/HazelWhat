import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL || process.env.DB_URL;
  
  if (!dbUrl) {
    return NextResponse.json({ 
      success: false, 
      error: "DATABASE_URL environment variable is missing on Railway.",
      available_keys: Object.keys(process.env).filter(k => k.toLowerCase().includes("db") || k.toLowerCase().includes("database") || k.toLowerCase().includes("url") || k.toLowerCase().includes("key"))
    }, { status: 500 });
  }

  // Sanitize connection string if it has direct query params
  const client = new Client({
    connectionString: dbUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    
    // Run ALTER TABLE query
    console.log("[Migration] Running ALTER TABLE orders...");
    const res = await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS recovery_stage INT DEFAULT 0;");
    
    await client.end();
    
    return NextResponse.json({
      success: true,
      message: "Database migration executed successfully! Column 'recovery_stage' added to table 'orders'.",
      result: res
    });
  } catch (err: any) {
    try {
      await client.end();
    } catch (e) {}
    console.error("[Migration] Error running query:", err);
    return NextResponse.json({
      success: false,
      error: err.message || "Failed to execute database migration query."
    }, { status: 500 });
  }
}
