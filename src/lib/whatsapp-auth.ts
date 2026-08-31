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

  // 2. If no local creds exist, sync down from Supabase using paginated fetch
  const localCredsFile = path.join(localDir, "creds.json");
  if (!fs.existsSync(localCredsFile)) {
    console.log(`[SupabaseAuth] Local credentials not found for tenant ${tenantId}. Restoring from Supabase...`);
    try {
      // STEP 1: Always fetch 'creds' row specifically first (it's the only critical row)
      const { data: credsRows } = await client
        .from("whatsapp_auth")
        .select("key_id, key_data")
        .eq("tenant_id", tenantId)
        .eq("key_id", "creds")
        .limit(1);

      const hasCreds = credsRows && credsRows.length > 0;

      if (hasCreds) {
        // Wipe local dir first
        fs.rmSync(localDir, { recursive: true, force: true });
        fs.mkdirSync(localDir, { recursive: true });

        // Write creds.json immediately (this is all Baileys needs to authenticate)
        fs.writeFileSync(
          path.join(localDir, "creds.json"),
          JSON.stringify(credsRows[0].key_data, BufferJSON.replacer)
        );
        console.log(`[SupabaseAuth] Wrote creds.json for tenant ${tenantId}.`);

        // STEP 2: Paginate remaining keys in chunks of 1000 (PostgREST server hard-cap is 1000/request)
        let page = 0;
        const pageSize = 1000;
        let totalWritten = 1; // already wrote creds
        while (true) {
          const from = page * pageSize;
          const to = from + pageSize - 1;
          const { data: pageRows, error: pageErr } = await client
            .from("whatsapp_auth")
            .select("key_id, key_data")
            .eq("tenant_id", tenantId)
            .neq("key_id", "creds") // skip creds, already written
            .range(from, to);

          if (pageErr || !pageRows || pageRows.length === 0) break;

          for (const row of pageRows) {
            // key_ids like 'app-state-sync-key-AAAAAAs/' contain slashes — Baileys
            // uses these as subdirectory names. Must create the parent dir first.
            const fileName = `${row.key_id}.json`;
            const filePath = path.join(localDir, fileName);
            const fileDir = path.dirname(filePath);
            if (!fs.existsSync(fileDir)) {
              fs.mkdirSync(fileDir, { recursive: true });
            }
            fs.writeFileSync(
              filePath,
              JSON.stringify(row.key_data, BufferJSON.replacer)
            );
          }
          totalWritten += pageRows.length;
          if (pageRows.length < pageSize) break; // last page
          page++;
        }
        console.log(`[SupabaseAuth] Restored ${totalWritten} total keys for tenant ${tenantId}.`);
      } else {
        // Only delete keys if they exist but 'creds' is definitely missing
        const { data: anyKeys } = await client
          .from("whatsapp_auth")
          .select("key_id")
          .eq("tenant_id", tenantId)
          .limit(1);
        
        if (anyKeys && anyKeys.length > 0) {
          console.log(`[SupabaseAuth] Keys exist in Supabase but 'creds' is definitely missing. Cleaning up database to start fresh.`);
          await client.from("whatsapp_auth").delete().eq("tenant_id", tenantId);
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
      // Optimize by directly using in-memory state.creds to avoid disk read races
      await client.from("whatsapp_auth").upsert({
        tenant_id: tenantId,
        key_id: "creds",
        key_data: JSON.parse(JSON.stringify(state.creds, BufferJSON.replacer))
      }, { onConflict: 'tenant_id,key_id' });
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
    const tasks: PromiseLike<any>[] = [];
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
