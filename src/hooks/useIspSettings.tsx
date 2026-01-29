import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface IspSettings {
  ispName: string;
  whatsappTemplate: string;
  loading: boolean;
}

const IspSettingsContext = createContext<IspSettings>({
  ispName: "Smart ISP",
  whatsappTemplate: "",
  loading: true,
});

export function IspSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<IspSettings>({
    ispName: "Smart ISP",
    whatsappTemplate: "",
    loading: true,
  });

  useEffect(() => {
    fetchSettings();

    // Subscribe to changes
    const channel = supabase
      .channel("system_settings_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_settings" },
        () => {
          fetchSettings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchSettings = async () => {
    try {
      // Try authenticated fetch first, fall back to public view
      let data;
      const authRes = await supabase.from("system_settings").select("key, value");
      
      if (authRes.error) {
        // Fallback to public view for unauthenticated users
        const publicRes = await supabase.from("system_settings_public").select("key, value");
        data = publicRes.data;
      } else {
        data = authRes.data;
      }

      if (data) {
        const settingsMap: Record<string, string> = {};
        data.forEach((s: { key: string | null; value: unknown }) => {
          if (s.key) {
            settingsMap[s.key] = typeof s.value === "string" 
              ? s.value.replace(/^"|"$/g, "") 
              : JSON.stringify(s.value).replace(/^"|"$/g, "");
          }
        });
        
        setSettings({
          ispName: settingsMap.isp_name || "Smart ISP",
          whatsappTemplate: settingsMap.whatsapp_template || "",
          loading: false,
        });
      } else {
        setSettings((prev) => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error("Error fetching ISP settings:", error);
      setSettings((prev) => ({ ...prev, loading: false }));
    }
  };

  return (
    <IspSettingsContext.Provider value={settings}>
      {children}
    </IspSettingsContext.Provider>
  );
}

export function useIspSettings() {
  return useContext(IspSettingsContext);
}
