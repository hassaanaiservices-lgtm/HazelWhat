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
      });
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
          await Promise.all(
            ids.map(async id => {
              let value = await readData(`${type}-${id}`);
              
              if (type === 'app-state-sync-key' && value) {
                 // Dynamic import of proto to handle reconstruction
                 try {
                   const { proto } = await import('@whiskeysockets/baileys');
                   value = proto.Message.AppStateSyncKeyData.fromObject(value);
                 } catch (e) {}
              }

              data[id] = value;
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks: Promise<void>[] = [];
          for (const category in data) {
            const categoryData = data[category as keyof typeof data];
            if (categoryData) {
              for (const id in categoryData) {
                const value = categoryData[id];
                const key = `${category}-${id}`;
                if (value) {
                  tasks.push(writeData(value, key));
                } else {
                  tasks.push(removeData(key));
                }
              }
            }
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
