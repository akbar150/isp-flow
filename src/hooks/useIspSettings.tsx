import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface IspSettings {
  ispName: string;
  whatsappTemplate: string;
  emailFromName: string;
  emailFromAddress: string;
  emailSubjectReminder: string;
  emailTemplateReminder: string;
  smsTemplate: string;
  smsTemplateEn: string;
  loading: boolean;
  refetch: () => Promise<void>;
}

const defaultWhatsAppTemplate = `🔔 *পেমেন্ট রিমাইন্ডার / Payment Reminder*

প্রিয় *{CustomerName}*,

📋 *অ্যাকাউন্ট তথ্য / Account Details:*
━━━━━━━━━━━━━━━━
👤 PPPoE Username: \`{PPPoEUsername}\`
🆔 Customer ID: \`{CustomerID}\`
📦 Package: *{PackageName}*
📅 মেয়াদ উত্তীর্ণ / Expires: *{ExpiryDate}*
💰 বকেয়া / Due Amount: *৳{Amount}*
━━━━━━━━━━━━━━━━

⚠️ সংযোগ বিচ্ছিন্ন এড়াতে অনুগ্রহ করে পেমেন্ট করুন।
Please pay to avoid disconnection.

ধন্যবাদ / Thank you
*{ISPName}* 🌐`;

const defaultEmailTemplate = `প্রিয় {CustomerName},

আপনার ইন্টারনেট প্যাকেজ "{PackageName}" এর মেয়াদ {ExpiryDate} তারিখে শেষ হবে।

অ্যাকাউন্ট তথ্য:
• PPPoE Username: {PPPoEUsername}
• Customer ID: {CustomerID}
• বকেয়া পরিমাণ: ৳{Amount}

সংযোগ বিচ্ছিন্ন এড়াতে অনুগ্রহ করে পেমেন্ট করুন।

{ISPName} বেছে নেওয়ার জন্য ধন্যবাদ।`;

const defaultSmsTemplate = `প্রিয় {CustomerName}, আপনার ইন্টারনেট প্যাকেজ {PackageName} এর মেয়াদ {ExpiryDate} তারিখে শেষ হবে। বকেয়া: ৳{Amount}। সংযোগ বিচ্ছিন্ন এড়াতে পেমেন্ট করুন। - {ISPName}`;

const IspSettingsContext = createContext<IspSettings>({
  ispName: "Smart ISP",
  whatsappTemplate: defaultWhatsAppTemplate,
  emailFromName: "Smart ISP",
  emailFromAddress: "",
  emailSubjectReminder: "পেমেন্ট রিমাইন্ডার / Payment Reminder - {ISPName}",
  emailTemplateReminder: defaultEmailTemplate,
  smsTemplate: defaultSmsTemplate,
  smsTemplateEn: "",
  loading: true,
  refetch: async () => {},
});

export function IspSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<IspSettings>({
    ispName: "Smart ISP",
    whatsappTemplate: defaultWhatsAppTemplate,
    emailFromName: "Smart ISP",
    emailFromAddress: "",
    emailSubjectReminder: "পেমেন্ট রিমাইন্ডার / Payment Reminder - {ISPName}",
    emailTemplateReminder: defaultEmailTemplate,
    smsTemplate: defaultSmsTemplate,
    smsTemplateEn: "",
    loading: true,
    refetch: async () => {},
  });

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
            // Handle both JSON-wrapped strings and plain values
            const rawVal = s.value;
            if (typeof rawVal === "string") {
              // Remove surrounding quotes if present (JSON.stringify artifact)
              settingsMap[s.key] = rawVal.replace(/^"|"$/g, "");
            } else if (typeof rawVal === "object" && rawVal !== null) {
              // It's already JSON, stringify for template vars
              settingsMap[s.key] = JSON.stringify(rawVal);
            } else {
              settingsMap[s.key] = String(rawVal);
            }
          }
        });
        
        setSettings((prev) => ({
          ...prev,
          ispName: settingsMap.isp_name || prev.ispName,
          whatsappTemplate: settingsMap.whatsapp_template || prev.whatsappTemplate,
          emailFromName: settingsMap.email_from_name || prev.emailFromName,
          emailFromAddress: settingsMap.email_from_address || "",
          emailSubjectReminder: settingsMap.email_subject_reminder || prev.emailSubjectReminder,
          emailTemplateReminder: settingsMap.email_template_reminder || prev.emailTemplateReminder,
          smsTemplate: settingsMap.sms_template || prev.smsTemplate,
          smsTemplateEn: settingsMap.sms_template_en || "",
          loading: false,
        }));
      } else {
        setSettings((prev) => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error("Error fetching ISP settings:", error);
      setSettings((prev) => ({ ...prev, loading: false }));
    }
  };

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

  // Provide refetch function in context
  const contextValue: IspSettings = {
    ...settings,
    refetch: fetchSettings,
  };

  return (
    <IspSettingsContext.Provider value={contextValue}>
      {children}
    </IspSettingsContext.Provider>
  );
}

export function useIspSettings() {
  return useContext(IspSettingsContext);
}
