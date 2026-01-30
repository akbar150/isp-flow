import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import api from "@/lib/api";
import { decodeSettingValue } from "@/lib/settingsValue";

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
  ispName: "EasyLink",
  whatsappTemplate: defaultWhatsAppTemplate,
  emailFromName: "EasyLink",
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
    ispName: "EasyLink",
    whatsappTemplate: defaultWhatsAppTemplate,
    emailFromName: "EasyLink",
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
      const response = await api.get("/settings/public");
      
      if (response.data.success && response.data.settings) {
        const settingsMap: Record<string, string> = {};
        response.data.settings.forEach((s: { key: string; value: unknown }) => {
          if (s.key) {
            settingsMap[s.key] = decodeSettingValue(s.value);
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
