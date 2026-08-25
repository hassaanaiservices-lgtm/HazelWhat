import { AuthenticationState, BufferJSON, useMultiFileAuthState } from "@whiskeysockets/baileys";
import { supabase } from "./db";
import { DB_DIR } from "./db";
import fs from "fs";
import path from "path";

export const useSupabaseAuthState = async (tenantId: string): Promise<{ state: AuthenticationState, saveCreds: () => Promise<void>, removeCreds: () => Promise<void> }> => {
  const client = supabase;
  if (!client) {
    throw new Error("Supabase is not configured. Cannot use SupabaseAuthState.");
  }

  const localDir = path.join(DB_DIR, `.baileys_auth_${tenantId}`);

  // 1. Ensure local directory exists
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }

  // 2. If no local creds exist, sync down from Supabase
  const localCredsFile = path.join(localDir, "creds.json");
  if (!fs.existsSync(localCredsFile)) {
    console.log(`[SupabaseAuth] Local credentials not found for tenant ${tenantId}. Restoring from Supabase...`);
    try {
      const { data: rows, error } = await client
        .from("whatsapp_auth")
        .select("key_id, key_data")
        .eq("tenant_id", tenantId);

      if (!error && rows && rows.length > 0) {
        console.log(`[SupabaseAuth] Found ${rows.length} keys in Supabase. Writing to local disk...`);
        for (const row of rows) {
          const fileName = row.key_id === "creds" ? "creds.json" : `${row.key_id}.json`;
          fs.writeFileSync(
            path.join(localDir, fileName),
            JSON.stringify(row.key_data, BufferJSON.replacer)
          );
        }
      }
    } catch (e) {
      console.error(`[SupabaseAuth] Error restoring credentials from database:`, e);
    }
  }

  // 3. Delegate to Baileys' native useMultiFileAuthState
  const { state, saveCreds: localSaveCreds } = await useMultiFileAuthState(localDir);

  // 4. Wrap saveCreds to update Supabase in the background
  const saveCreds = async () => {
    await localSaveCreds();
    try {
      if (fs.existsSync(localCredsFile)) {
        const credsContent = fs.readFileSync(localCredsFile, "utf8");
        await client.from("whatsapp_auth").upsert({
          tenant_id: tenantId,
          key_id: "creds",
          key_data: JSON.parse(credsContent)
        }, { onConflict: 'tenant_id,key_id' });
      }
    } catch (e) {
      console.error(`[SupabaseAuth] Failed to sync creds to database:`, e);
    }
  };

  // 5. Wrap state.keys.set to sync bulk upserts/deletes in the background
  const localSet = state.keys.set;
  state.keys.set = async (data) => {
    await localSet(data);

    const toWrite: { tenant_id: string; key_id: string; key_data: any }[] = [];
    const toDelete: string[] = [];

    for (const category in data) {
      const categoryData = data[category as keyof typeof data];
      if (categoryData) {
        for (const id in categoryData) {
          const value = categoryData[id];
          const key = `${category}-${id}`;
          if (value) {
            toWrite.push({
              tenant_id: tenantId,
              key_id: key,
              key_data: JSON.parse(JSON.stringify(value, BufferJSON.replacer))
            });
          } else {
            toDelete.push(key);
          }
        }
      }
    }

    // Sync changes to DB synchronously to ensure pre-keys/app-state keys aren't lost on restart
    const tasks: Promise<any>[] = [];
    if (toWrite.length > 0) {
      tasks.push(
        client.from("whatsapp_auth").upsert(toWrite, { onConflict: 'tenant_id,key_id' }).then(({ error }) => {
          if (error) console.error(`[SupabaseAuth] Error syncing keys to database:`, error);
        })
      );
    }

    if (toDelete.length > 0) {
      tasks.push(
        client.from("whatsapp_auth").delete().eq("tenant_id", tenantId).in("key_id", toDelete).then(({ error }) => {
          if (error) console.error(`[SupabaseAuth] Error deleting keys from database:`, error);
        })
      );
    }

    if (tasks.length > 0) {
      await Promise.all(tasks).catch(err => {
        console.error(`[SupabaseAuth] Key sync task error:`, err);
      });
    }
  };

  const removeCreds = async () => {
    try {
      const { WhatsAppSessionRegistry } = await import("./whatsapp-session-registry");
      await WhatsAppSessionRegistry.releaseLease(tenantId).catch(() => {});

      // Clear Supabase
      await client.from("whatsapp_auth").delete().eq("tenant_id", tenantId);
      // Clear local files
      if (fs.existsSync(localDir)) {
        fs.rmSync(localDir, { recursive: true, force: true });
      }
    } catch (e) {
      console.error(`[SupabaseAuth] Failed to clear credentials:`, e);
    }
  };

  return {
    state,
    saveCreds,
    removeCreds
  };
};
