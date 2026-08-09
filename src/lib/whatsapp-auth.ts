import { AuthenticationCreds, AuthenticationState, BufferJSON, initAuthCreds, SignalDataTypeMap } from "@whiskeysockets/baileys";
import { supabase } from "./db";

export const useSupabaseAuthState = async (tenantId: string): Promise<{ state: AuthenticationState, saveCreds: () => Promise<void>, removeCreds: () => Promise<void> }> => {
  const client = supabase;
  if (!client) {
    throw new Error("Supabase is not configured. Cannot use SupabaseAuthState.");
  }

  const writeData = async (data: any, key: string) => {
    try {
      const jsonString = JSON.stringify(data, BufferJSON.replacer);
      await client.from("whatsapp_auth").upsert({
        tenant_id: tenantId,
        key_id: key,
        key_data: JSON.parse(jsonString)
      }, { onConflict: 'tenant_id,key_id' });
    } catch (e) {
      console.error(`[SupabaseAuth] Failed to write data for key ${key}:`, e);
    }
  };

  const readData = async (key: string) => {
    try {
      const { data, error } = await client
        .from("whatsapp_auth")
        .select("key_data")
        .eq("tenant_id", tenantId)
        .eq("key_id", key)
        .single();
        
      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "Results contain 0 rows"
        console.error(`[SupabaseAuth] Error reading key ${key}:`, error);
      }
        
      if (data && data.key_data) {
        // Stringify then parse with reviver to recreate Buffer objects
        const rawJsonStr = JSON.stringify(data.key_data);
        return JSON.parse(rawJsonStr, BufferJSON.reviver);
      }
    } catch (e) {
      console.error(`[SupabaseAuth] Failed to read data for key ${key}:`, e);
    }
    return null;
  };

  const removeData = async (key: string) => {
    try {
      await client.from("whatsapp_auth").delete().eq("tenant_id", tenantId).eq("key_id", key);
    } catch (e) {
      console.error(`[SupabaseAuth] Failed to remove data for key ${key}:`, e);
    }
  };

  const credsData = await readData("creds");
  const creds: AuthenticationCreds = credsData || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data: { [_: string]: SignalDataTypeMap[typeof type] } = {};
          if (ids.length === 0) return data;

          try {
            const keys = ids.map(id => `${type}-${id}`);
            const { data: rows, error } = await client
              .from("whatsapp_auth")
              .select("key_id, key_data")
              .eq("tenant_id", tenantId)
              .in("key_id", keys);

            if (error) {
              console.error(`[SupabaseAuth] Bulk read error for type ${type}:`, error);
              return data;
            }

            const rowMap = new Map<string, any>();
            if (rows) {
              rows.forEach((row: any) => {
                rowMap.set(row.key_id, row.key_data);
              });
            }

            for (const id of ids) {
              const key = `${type}-${id}`;
              const rawVal = rowMap.get(key);
              let value = null;
              if (rawVal) {
                const rawJsonStr = JSON.stringify(rawVal);
                value = JSON.parse(rawJsonStr, BufferJSON.reviver);
              }

              if (type === 'app-state-sync-key' && value) {
                try {
                  const { proto } = await import('@whiskeysockets/baileys');
                  value = proto.Message.AppStateSyncKeyData.fromObject(value);
                } catch (e) {}
              }

              data[id] = value;
            }
          } catch (e) {
            console.error(`[SupabaseAuth] Failed bulk read for keys:`, e);
          }
          return data;
        },
        set: async (data) => {
          const toWrite: { key: string; value: any }[] = [];
          const toDelete: string[] = [];

          for (const category in data) {
            const categoryData = data[category as keyof typeof data];
            if (categoryData) {
              for (const id in categoryData) {
                const value = categoryData[id];
                const key = `${category}-${id}`;
                if (value) {
                  toWrite.push({ key, value });
                } else {
                  toDelete.push(key);
                }
              }
            }
          }

          const tasks: Promise<any>[] = [];

          if (toWrite.length > 0) {
            const rows = toWrite.map(item => {
              const jsonString = JSON.stringify(item.value, BufferJSON.replacer);
              return {
                tenant_id: tenantId,
                key_id: item.key,
                key_data: JSON.parse(jsonString)
              };
            });
            tasks.push((async () => {
              const { error } = await client.from("whatsapp_auth").upsert(rows, { onConflict: 'tenant_id,key_id' });
              if (error) console.error(`[SupabaseAuth] Bulk upsert error for ${toWrite.length} items:`, error);
            })());
          }

          if (toDelete.length > 0) {
            tasks.push((async () => {
              const { error } = await client
                .from("whatsapp_auth")
                .delete()
                .eq("tenant_id", tenantId)
                .in("key_id", toDelete);
              if (error) console.error(`[SupabaseAuth] Bulk delete error for ${toDelete.length} items:`, error);
            })());
          }

          await Promise.allSettled(tasks);
        }
      }
    },
    saveCreds: () => writeData(creds, "creds"),
    removeCreds: async () => {
      try {
        await client.from("whatsapp_auth").delete().eq("tenant_id", tenantId);
      } catch (e) {
        console.error(`[SupabaseAuth] Failed to clear credentials for tenant ${tenantId}`, e);
      }
    }
  };
};
