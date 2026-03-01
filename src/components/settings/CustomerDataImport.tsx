import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

const CUSTOMER_DATA = [
  { name: "Archana rani dash", phone: "8801723575374", username: "easy375-archana.vt", status: "active", expiry_date: "2026-03-26", package_name: "FRN-8Mbps", bill: 600, zone: "Vata" },
  { name: "Layek Ahmed", phone: "8801714294574", username: "easy373-layek.isllk", status: "active", expiry_date: "2026-03-25", package_name: "FRN-8Mbps", bill: 600, zone: "Islampur" },
  { name: "Pappu Ahmed Shahin", phone: "8801327044720", username: "easy372-pappu.vt", status: "active", expiry_date: "2026-03-21", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Vata" },
  { name: "Md monsur miah", phone: "8801720627507", username: "easy371-monsur.lkisl", status: "active", expiry_date: "2026-03-20", package_name: "FRN-8Mbps", bill: 600, zone: "Islampur" },
  { name: "Md Faysal Ahmed", phone: "8801312538575", username: "easy370-foysal.lkkg", status: "active", expiry_date: "2026-03-14", package_name: "FRN-8Mbps", bill: 600, zone: "Lakhawara" },
  { name: "Kazi Najim Uddin Suhan", phone: "8801908622474", username: "easy369-suhan.kg", status: "expire", expiry_date: "2026-02-13", package_name: "Expired", bill: 800, zone: "Khagria" },
  { name: "Azizur Rahman", phone: "8801710717522", username: "easy368-azizur.lk", status: "active", expiry_date: "2026-03-06", package_name: "FRN-25Mbps", bill: 700, zone: "Lakhawara" },
  { name: "IMON AHMED", phone: "8801710027715", username: "easy367-imon.lk", status: "active", expiry_date: "2026-04-03", package_name: "FRN-8Mbps", bill: 600, zone: "Islampur" },
  { name: "MST JHUMA BEGUM", phone: "8801304112066", username: "easy366-jhuma.lk", status: "active", expiry_date: "2026-03-08", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Islampur" },
  { name: "MD Roki Ahmod", phone: "8801302381687", username: "easy365-roki.kglk", status: "active", expiry_date: "2026-03-25", package_name: "Sync-70Mbps-1000-Unlimited", bill: 1000, zone: "Lakhawara" },
  { name: "Md Shamim Ahmed", phone: "8801710932466", username: "easy364-shamim.lk", status: "active", expiry_date: "2026-03-11", package_name: "FRN-8Mbps", bill: 600, zone: "Lakhawara" },
  { name: "Md Rofikul Islam Rabbi", phone: "8801718073738", username: "easy363-rabbi.isl", status: "active", expiry_date: "2026-03-11", package_name: "FRN-25Mbps", bill: 700, zone: "Islampur" },
  { name: "Mostaq Ahmed chy", phone: "8801715369127", username: "easy362-mostaq.vat", status: "active", expiry_date: "2026-03-11", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Vata" },
  { name: "Syed Muqtada Hamid", phone: "8801718053318", username: "easy361-hamid.kg", status: "active", expiry_date: "2026-03-07", package_name: "FRN-25Mbps", bill: 700, zone: "Khagria" },
  { name: "Md. Rubel mia", phone: "8801742110131", username: "easy360-rubel.isllk", status: "active", expiry_date: "2026-03-04", package_name: "FRN-25Mbps", bill: 700, zone: "Islampur" },
  { name: "MD Sohag Ahmed", phone: "8801717204546", username: "easy359-sohag.kglk", status: "expire", expiry_date: "2026-02-25", package_name: "Expired", bill: 700, zone: "Khagria" },
  { name: "Jayed Ahmed", phone: "8801648661297", username: "easy358-jayed.kglk", status: "active", expiry_date: "2026-03-25", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Lakhawara" },
  { name: "Md Nanu miah", phone: "8801914968531", username: "easy357-nanu.upkucha", status: "active", expiry_date: "2026-03-20", package_name: "Sync-70Mbps-1000-Unlimited", bill: 1000, zone: "Uforpara" },
  { name: "Md shipu mia", phone: "8801710119861", username: "easy356-shipu", status: "active", expiry_date: "2026-03-15", package_name: "Sync-70Mbps-1000-Unlimited", bill: 1000, zone: "Lalmati" },
  { name: "Md Faruk Hussain bhuyin", phone: "8801777552460", username: "easy355-faruk.kg", status: "active", expiry_date: "2026-03-11", package_name: "FRN-25Mbps", bill: 700, zone: "Khagria" },
  { name: "MD LAYEK AHMED", phone: "8801754659939", username: "easy354-layek.lak", status: "active", expiry_date: "2026-03-07", package_name: "FRN-8Mbps", bill: 600, zone: "Lakhawara" },
  { name: "Ali Akbar", phone: "8801711870633", username: "easyakbar150", status: "expire", expiry_date: "2026-02-06", package_name: "Expired", bill: 700, zone: "Lalmati" },
  { name: "Md Sakhawat Hossen", phone: "8801974536229", username: "easy353-sakhawat.vt", status: "active", expiry_date: "2026-03-10", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Vata" },
  { name: "Musharof Hussain", phone: "8801711275640", username: "easy352-musharof.vt", status: "active", expiry_date: "2026-03-02", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Vata" },
  { name: "Mahir Hussen Rabbi", phone: "8801307876677", username: "easy351-rabbi.kg", status: "active", expiry_date: "2026-03-04", package_name: "Sync-36Mbps-800-Unlimited", bill: 750, zone: "Khagria" },
  { name: "Abid Hasan", phone: "8801602677161", username: "easy350-abid.vtag", status: "active", expiry_date: "2026-03-02", package_name: "FRN-8Mbps", bill: 600, zone: "Vata" },
  { name: "Md Saju mia", phone: "8801753043947", username: "easy349-saju.kglk", status: "active", expiry_date: "2026-03-26", package_name: "FRN-8Mbps", bill: 600, zone: "Lakhawara" },
  { name: "Md Marjan miya", phone: "8801301149386", username: "easy348-marjan.lalkur", status: "expire", expiry_date: "2025-12-18", package_name: "Expired", bill: 600, zone: "Lalmati" },
  { name: "Zamir", phone: "8801747536140", username: "easy347-zamir.isllk", status: "active", expiry_date: "2026-03-21", package_name: "FRN-8Mbps", bill: 600, zone: "Islampur" },
  { name: "MD Jahangir Ali", phone: "8801712341559", username: "easy346-jahangir.upor", status: "active", expiry_date: "2026-03-17", package_name: "FRN-8Mbps", bill: 600, zone: "Uforpara" },
  { name: "Md Arosh Ali", phone: "8801721038912", username: "easy345-arosh.kglk", status: "expire", expiry_date: "2025-11-05", package_name: "Expired", bill: 800, zone: "Khagria" },
  { name: "Tuhin Ahmed", phone: "8801726008307", username: "easy344-tuhin.kglk", status: "active", expiry_date: "2026-03-04", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Khagria" },
  { name: "Aminul Haque", phone: "8801300417132", username: "easy343-aminul.nal", status: "active", expiry_date: "2026-03-02", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Nalia" },
  { name: "Mohammed Ahmed Ali", phone: "8801717508891", username: "easy342-ahmedali.vhata", status: "expire", expiry_date: "2026-01-01", package_name: "Expired", bill: 800, zone: "Vata" },
  { name: "Mohammed Mujammil Ali", phone: "8801709064733", username: "easy341-mujammil.vhata", status: "active", expiry_date: "2026-03-01", package_name: "FRN-8Mbps", bill: 600, zone: "Vata" },
  { name: "Masum Ahmid Khan", phone: "8801760626938", username: "easy340-masum.nl", status: "active", expiry_date: "2026-03-01", package_name: "FRN-8Mbps", bill: 600, zone: "Nalia" },
  { name: "Mehdi hasan minhaz", phone: "8801316907384", username: "easy339-minhaz.vat", status: "expire", expiry_date: "2025-11-25", package_name: "Expired", bill: 800, zone: "Vata" },
  { name: "Md Parbez Ahmed", phone: "8801700940320", username: "easy338-parbez.kg", status: "active", expiry_date: "2026-03-06", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Khagria" },
  { name: "Subeta Begum", phone: "8801761437510", username: "easy337-subeta.isl", status: "active", expiry_date: "2026-03-19", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Islampur" },
  { name: "Md Maynul Islam", phone: "8801708749343", username: "easy336-maynul.kg", status: "active", expiry_date: "2026-03-08", package_name: "Sync-70Mbps-1000-Unlimited", bill: 1000, zone: "Khagria" },
  { name: "Md Forhad Husan Ashik", phone: "8801336550330", username: "easy335-forhad.isl", status: "active", expiry_date: "2026-03-03", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Islampur" },
  { name: "MD Gulzar Ahmed", phone: "8801715991300", username: "easyeasy334-Gulzar.upkus", status: "active", expiry_date: "2026-03-02", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Uforpara" },
  { name: "Badhon Hawlader", phone: "8801704612672", username: "easy333-badhon.kglk", status: "active", expiry_date: "2026-03-02", package_name: "FRN-8Mbps", bill: 600, zone: "Khagria" },
  { name: "Shefa Begum", phone: "8801714769001", username: "easy332-shefa.lalku", status: "expire", expiry_date: "2025-10-01", package_name: "Expired", bill: 600, zone: "Lalmati" },
  { name: "Md Afsar Ahmed", phone: "8801700502700", username: "easy331-afsar.isl", status: "active", expiry_date: "2026-03-05", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Islampur" },
  { name: "Sujon khan Sakib", phone: "8801719767968", username: "easy330-sujon.kgcaru", status: "active", expiry_date: "2026-03-02", package_name: "FRN-8Mbps", bill: 600, zone: "Khagria" },
  { name: "MOHAMMAD MUJAMMIL ALI", phone: "8801712970989", username: "easy329-mujammil.laldus", status: "active", expiry_date: "2026-03-01", package_name: "Sync-70Mbps-1000-Unlimited", bill: 600, zone: "Lalmati" },
  { name: "Sumi Khatun", phone: "8801618471881", username: "easyeasy328-sumi.vt", status: "active", expiry_date: "2026-04-09", package_name: "FRN-8Mbps", bill: 600, zone: "Vata" },
  { name: "Suyeb Ahmed", phone: "8801715272865", username: "easy327-suyeb.vt", status: "expire", expiry_date: "2025-10-18", package_name: "Expired", bill: 600, zone: "Vata" },
  { name: "Md Muhib Hasan Munna", phone: "8801771114593", username: "easy326-muhib.isllk", status: "active", expiry_date: "2026-03-09", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Islampur" },
  { name: "Mahid Ahmod", phone: "8801324820116", username: "easy325-mahid.kg2lk", status: "active", expiry_date: "2026-03-09", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Khagria" },
  { name: "Md Abdus Salam", phone: "8801778474358", username: "easy324-salam.lallos", status: "active", expiry_date: "2026-03-08", package_name: "FRN-8Mbps", bill: 600, zone: "Lalmati" },
  { name: "Md Monir Hossain", phone: "8801773392545", username: "easy323-monir.nalkt", status: "expire", expiry_date: "2025-12-10", package_name: "Expired", bill: 800, zone: "Nalia" },
  { name: "Solayman Miah", phone: "8801753169324", username: "easy322-solayman.kglk", status: "expire", expiry_date: "2025-12-03", package_name: "Expired", bill: 600, zone: "Khagria" },
  { name: "Mst Sheuly Begum", phone: "8801728849677", username: "easy321-sheuly.lalkt", status: "active", expiry_date: "2026-03-21", package_name: "FRN-8Mbps", bill: 600, zone: "Lalmati" },
  { name: "Md Saidur Rahman", phone: "8801763624369", username: "easy320-saidur.vat", status: "expire", expiry_date: "2025-11-30", package_name: "Expired", bill: 600, zone: "Vata" },
  { name: "Md Salek Ahmed", phone: "8801606449725", username: "easy319-salek.vt", status: "active", expiry_date: "2026-03-06", package_name: "FRN-8Mbps", bill: 600, zone: "Vata" },
  { name: "MD JAHANGIR ALOM", phone: "8801326772290", username: "easy318-jalom.lal", status: "expire", expiry_date: "2025-11-18", package_name: "Expired", bill: 2000, zone: "Lalmati" },
  { name: "Badol Mia", phone: "8801318509707", username: "easy317-badol.isl", status: "expire", expiry_date: "2025-09-19", package_name: "Expired", bill: 800, zone: "Islampur" },
  { name: "Md Abul Hussain", phone: "8801912775153", username: "easy316-abul.vt", status: "expire", expiry_date: "2025-12-17", package_name: "Expired", bill: 800, zone: "Vata" },
  { name: "Mst Joba Begum", phone: "8801793173592", username: "easy315-joba.lal", status: "active", expiry_date: "2026-03-17", package_name: "FRN-8Mbps", bill: 600, zone: "Lalmati" },
  { name: "Md Izazul Alam Sumon", phone: "8801611758983", username: "easy314-sumon.nalvt", status: "active", expiry_date: "2026-03-15", package_name: "FRN-8Mbps", bill: 600, zone: "Nalia" },
  { name: "Mina", phone: "8801732071613", username: "easy313-mina.isllk", status: "expire", expiry_date: "2026-01-13", package_name: "Expired", bill: 800, zone: "Islampur" },
  { name: "Md Jahangir Alom", phone: "8801326772290", username: "easy312-jahangir.lal", status: "expire", expiry_date: "2025-09-13", package_name: "Expired", bill: 1000, zone: "Lalmati" },
  { name: "Seema Rani Sorkar", phone: "8801714914040", username: "easy311-seema.vt", status: "active", expiry_date: "2026-03-13", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Vata" },
  { name: "Md Ruhan Ahmod", phone: "8801852578570", username: "easy310-ruhan.kg", status: "active", expiry_date: "2026-03-09", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Khagria" },
  { name: "Razi Uddin Khan", phone: "8801716690101", username: "easy309-razi.vt", status: "active", expiry_date: "2026-03-06", package_name: "Sync-70Mbps-1000-Unlimited", bill: 1000, zone: "Vata" },
  { name: "Md Afjol Hussain", phone: "8801747336248", username: "easy308-afjol.upguwa", status: "active", expiry_date: "2026-03-12", package_name: "FRN-8Mbps", bill: 600, zone: "Uforpara" },
  { name: "Habibur Rahman", phone: "8801790874112", username: "easy307-habibur.vat", status: "active", expiry_date: "2026-03-01", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Vata" },
  { name: "Md Mohobbot Ali", phone: "8801711580429", username: "easy306-mohobbot.kglk", status: "active", expiry_date: "2026-03-01", package_name: "Sync-36Mbps-800-Unlimited", bill: 1200, zone: "Khagria" },
  { name: "MD NASIR UDDIN", phone: "8801734596600", username: "easy305-nasir.upor", status: "active", expiry_date: "2026-03-17", package_name: "FRN-8Mbps", bill: 600, zone: "Uforpara" },
  { name: "Md Abdul Kabir", phone: "8801735549503", username: "easy304-kabir.kg", status: "active", expiry_date: "2026-03-07", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Khagria" },
  { name: "Mahbub Alam", phone: "8801999807524", username: "easy303-mahbub.kg", status: "active", expiry_date: "2026-03-04", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Khagria" },
  { name: "Salek Ahmod", phone: "8801840879461", username: "easy302-salek.isllak", status: "active", expiry_date: "2026-03-01", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Islampur" },
  { name: "Mst Farmila Akter", phone: "8801303623563", username: "easy301-farmila.lal", status: "expire", expiry_date: "2025-07-25", package_name: "Expired", bill: 800, zone: "Lalmati" },
  { name: "MD Raju Ahmed", phone: "8801309336242", username: "easy300-raju.isllk", status: "active", expiry_date: "2026-03-26", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Islampur" },
  { name: "Kakali Baishnab", phone: "8801788875973", username: "easy299-kakali.vt", status: "active", expiry_date: "2026-03-26", package_name: "FRN-8Mbps", bill: 600, zone: "Vata" },
  { name: "Abdul Malek", phone: "8801312454048", username: "easy298-malek.isl", status: "active", expiry_date: "2026-03-01", package_name: "Sync-70Mbps-1000-Unlimited", bill: 1000, zone: "Islampur" },
  { name: "Farjana Islam Riya", phone: "8801732434639", username: "easy297-farjana.isl", status: "active", expiry_date: "2026-02-27", package_name: "FRN-8Mbps", bill: 600, zone: "Islampur" },
  { name: "MD Jahidul Islam", phone: "8801759815613", username: "easy296-jahidul.kg", status: "active", expiry_date: "2026-03-06", package_name: "Sync-70Mbps-1000-Unlimited", bill: 1000, zone: "Khagria" },
  { name: "Israk Ali", phone: "8801785548978", username: "easy295-israk.kg", status: "active", expiry_date: "2026-03-21", package_name: "Sync-36Mbps-800-Unlimited", bill: 600, zone: "Khagria" },
  { name: "Rahim Ahmed", phone: "8801726415708", username: "easy294-rahim.isllk", status: "active", expiry_date: "2026-03-17", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Islampur" },
  { name: "Sabbir Ahmd", phone: "8801784648284", username: "easy293-sabbir.isllk", status: "active", expiry_date: "2026-03-02", package_name: "FRN-8Mbps", bill: 600, zone: "Islampur" },
  { name: "Hafiz MD Al Amin", phone: "8801768626002", username: "easy292-alamin.vat", status: "active", expiry_date: "2026-03-19", package_name: "FRN-8Mbps", bill: 600, zone: "Vata" },
  { name: "Happy Begum", phone: "8801302773695", username: "easy291-happy-lal", status: "expire", expiry_date: "2025-07-11", package_name: "Expired", bill: 600, zone: "Lalmati" },
  { name: "Sujida Akter", phone: "8801313658262", username: "easy290-sunjida.vt", status: "expire", expiry_date: "2025-10-22", package_name: "Expired", bill: 800, zone: "Vata" },
  { name: "MD Sofiqul Islam", phone: "8801679314040", username: "easy289-sofiqul.nal", status: "expire", expiry_date: "2025-10-08", package_name: "Expired", bill: 600, zone: "Nalia" },
  { name: "Md Uzzal", phone: "8801759439320", username: "easy288-uzzal.isl", status: "expire", expiry_date: "2025-08-08", package_name: "Expired", bill: 800, zone: "Islampur" },
  { name: "Rajib Ahmed", phone: "8801711238044", username: "easy287-rajib.vt", status: "expire", expiry_date: "2025-09-10", package_name: "Expired", bill: 600, zone: "Vata" },
  { name: "MD SUYEM AHMED SAMIR", phone: "8801717581710", username: "easy286-samir.vt", status: "active", expiry_date: "2026-03-06", package_name: "FRN-8Mbps", bill: 600, zone: "Vata" },
  { name: "Juned Ahmed", phone: "8801712328094", username: "easy285-juned.vt", status: "active", expiry_date: "2026-03-09", package_name: "FRN-8Mbps", bill: 600, zone: "Vata" },
  { name: "Md Faysal Ahmed", phone: "8801774212341", username: "easy284-faysal.kg", status: "active", expiry_date: "2026-03-02", package_name: "FRN-8Mbps", bill: 600, zone: "Khagria" },
  { name: "Md Adil Ahmad", phone: "8801760221556", username: "easy283-adil.upkor", status: "active", expiry_date: "2026-03-16", package_name: "Sync-70Mbps-1000-Unlimited", bill: 1000, zone: "Guabari" },
  { name: "Mst Hira Mony Akther", phone: "8801718602956", username: "easy282-hiramony.upkor", status: "active", expiry_date: "2026-03-06", package_name: "FRN-8Mbps", bill: 600, zone: "Uforpara" },
  { name: "Mst Lably Begum", phone: "8801795144353", username: "easy281-lably.nalbag", status: "active", expiry_date: "2026-03-06", package_name: "FRN-8Mbps", bill: 600, zone: "Nalia" },
  { name: "Andus subhan ana mia", phone: "8801336263840", username: "easy280-subhan.lalkt", status: "active", expiry_date: "2026-03-07", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Lalmati" },
  { name: "Nures Ali", phone: "8801727091547", username: "easy279-nures.vt", status: "expire", expiry_date: "2025-12-05", package_name: "Expired", bill: 600, zone: "Vata" },
  { name: "Md Mohobboth Ali", phone: "8801711580429", username: "easy278-mohobboth.kg", status: "active", expiry_date: "2026-03-10", package_name: "Sync-70Mbps-1000-Unlimited", bill: 1200, zone: "Khagria" },
  { name: "Satyajit Karmakar", phone: "8801677512505", username: "easy277-satyajit.vt", status: "active", expiry_date: "2026-03-02", package_name: "FRN-8Mbps", bill: 600, zone: "Vata" },
  { name: "Akash Chowdhury", phone: "8801819710939", username: "easy276-akash.vt", status: "active", expiry_date: "2026-03-03", package_name: "FRN-8Mbps", bill: 600, zone: "Vata" },
  { name: "Tahmid Khan Tanim", phone: "8801308376435", username: "easy275-tanim.kg", status: "active", expiry_date: "2026-03-26", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Khagria" },
  { name: "Kulsuma Begum", phone: "8801322297302", username: "easy274-kulsuma.kglk", status: "active", expiry_date: "2026-03-05", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Khagria" },
  { name: "Mannan Hamid Mahi", phone: "8801309635789", username: "easy273-mahi.vt", status: "active", expiry_date: "2026-03-23", package_name: "FRN-8Mbps", bill: 600, zone: "Vata" },
  { name: "MD Jayed Ahmed", phone: "8801719237973", username: "easy272-jayed.vt", status: "active", expiry_date: "2026-03-26", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Vata" },
  { name: "MD Kawed Ahmed", phone: "8801710024227", username: "easy271-kawed.vt", status: "expire", expiry_date: "2025-11-11", package_name: "Expired", bill: 800, zone: "Vata" },
  { name: "Husna begum sumi", phone: "8801719140156", username: "easy270-husna.kgcaru", status: "expire", expiry_date: "2025-08-04", package_name: "Expired", bill: 600, zone: "Khagria" },
  { name: "Abdus salam", phone: "8801729929308", username: "easy269-salam.lk", status: "active", expiry_date: "2026-03-16", package_name: "FRN-8Mbps", bill: 600, zone: "Lakhawara" },
  { name: "MONUWAR HUSSEN MARUF", phone: "8801317375433", username: "easy268-monuwar.ktnl", status: "active", expiry_date: "2026-03-17", package_name: "FRN-8Mbps", bill: 600, zone: "Nalia" },
  { name: "Kholil Miah", phone: "8801648726086", username: "easy267-kholil.kg", status: "active", expiry_date: "2026-03-19", package_name: "Sync-70Mbps-1000-Unlimited", bill: 800, zone: "Khagria" },
  { name: "MD Arif hossain", phone: "8801747098149", username: "easy266-arif.nlkt", status: "active", expiry_date: "2026-03-14", package_name: "Sync-70Mbps-1000-Unlimited", bill: 1000, zone: "Nalia" },
  { name: "Badsha Mia", phone: "8801722421574", username: "easy265-badsha.isl", status: "active", expiry_date: "2026-03-09", package_name: "FRN-8Mbps", bill: 600, zone: "Islampur" },
  { name: "Shahida khatun", phone: "8801764733006", username: "easy264-shahida.lal", status: "active", expiry_date: "2026-03-06", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Lalmati" },
  { name: "MD REZWAN AHMED", phone: "8801717660028", username: "easy262-rezwan.upkor", status: "expire", expiry_date: "2025-06-03", package_name: "Expired", bill: 800, zone: "Uforpara" },
  { name: "Md Harunur Rashid", phone: "8801836960173", username: "easy261-rashid.up", status: "active", expiry_date: "2026-03-02", package_name: "Sync-80Mbps-1200-Unlimited", bill: 1200, zone: "Uforpara" },
  { name: "MD shohid ahmed", phone: "8801715539749", username: "easy260-shohid.lak", status: "expire", expiry_date: "2026-02-27", package_name: "Expired", bill: 600, zone: "Lakhawara" },
  { name: "Promi baraik", phone: "8801320807839", username: "easy259-promi.isl", status: "active", expiry_date: "2026-03-19", package_name: "FRN-8Mbps", bill: 600, zone: "Islampur" },
  { name: "Jewel Ahmed", phone: "8801739653713", username: "easy-juwel.isl", status: "active", expiry_date: "2026-03-18", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Lakhawara" },
  { name: "Robiul Ahmed Riyan", phone: "8801798028767", username: "easy258-riyan.vat", status: "active", expiry_date: "2026-03-24", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Vata" },
  { name: "Chaaya Rani", phone: "8801730247813", username: "easy257-chaaya.isl", status: "expire", expiry_date: "2025-09-17", package_name: "Expired", bill: 600, zone: "Islampur" },
  { name: "Nurul huq khan", phone: "8801710212878", username: "easy256-nurul.isl", status: "active", expiry_date: "2026-03-17", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Islampur" },
  { name: "MD ABDUS SHOHID", phone: "8801748431077", username: "easy255-ab.shohid.vat", status: "active", expiry_date: "2026-03-19", package_name: "Sync-70Mbps-1000-Unlimited", bill: 1000, zone: "Vata" },
  { name: "MD Sukur Mia", phone: "8801711904138", username: "easy254-sukur-vat", status: "active", expiry_date: "2026-03-19", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Vata" },
  { name: "MD sayed Uddin Sadi", phone: "8801725466065", username: "easy253-sayed.vat", status: "active", expiry_date: "2026-03-16", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Vata" },
  { name: "Mohammad Mahin Ahmed", phone: "8801756943548", username: "easy252-mahin.islklu", status: "active", expiry_date: "2026-03-23", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Islampur" },
  { name: "Mirza Jahid Hasan Chunnu", phone: "8801775286056", username: "easy251-jahid.isllk", status: "expire", expiry_date: "2025-09-13", package_name: "Expired", bill: 800, zone: "Islampur" },
  { name: "MD Jinnah", phone: "8801712815553", username: "easy250-jinnah.isl", status: "active", expiry_date: "2026-03-15", package_name: "FRN-8Mbps", bill: 600, zone: "Islampur" },
  { name: "Hasan Mia", phone: "8801722380491", username: "easy249-hasan.nal", status: "expire", expiry_date: "2025-10-17", package_name: "Expired", bill: 600, zone: "Nalia" },
  { name: "Mst Khadija begum", phone: "8801752539732", username: "easy248-khadija.kglak", status: "active", expiry_date: "2026-03-16", package_name: "Sync-70Mbps-1000-Unlimited", bill: 1000, zone: "Lakhawara" },
  { name: "Kamran Ahmed", phone: "8801790593672", username: "easy247-kamran.kaglk", status: "active", expiry_date: "2026-03-11", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Khagria" },
  { name: "Minhaz Ahmed Fahim", phone: "8801724709359", username: "easy246-minhaj.kag", status: "active", expiry_date: "2026-03-17", package_name: "Sync-36Mbps-800-Unlimited", bill: 1000, zone: "Khagria" },
  { name: "Ahil Hussain khan", phone: "8801315465307", username: "easy245-ahil.lakisl", status: "active", expiry_date: "2026-03-10", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Islampur" },
  { name: "Afsa Dairy firm", phone: "8801766717775", username: "easy244-afsadairy.vat", status: "active", expiry_date: "2026-03-08", package_name: "Sync-70Mbps-1000-Unlimited", bill: 1000, zone: "Vata" },
  { name: "Robin Urang", phone: "8801779797244", username: "easy243-robin.ktup", status: "expire", expiry_date: "2025-07-12", package_name: "Expired", bill: 800, zone: "Uforpara" },
  { name: "Mst Rhena Begum", phone: "8801305560674", username: "easy242-rhena.vat", status: "expire", expiry_date: "2026-02-08", package_name: "Expired", bill: 800, zone: "Vata" },
  { name: "MD Ershad Mia", phone: "8801743851078", username: "easy241-ershad.lalvat", status: "active", expiry_date: "2026-03-07", package_name: "FRN-8Mbps", bill: 600, zone: "Lalmati" },
  { name: "Sofikul Islam", phone: "8801711194600", username: "easy240-sofikul.kglakh", status: "active", expiry_date: "2026-03-10", package_name: "FRN-8Mbps", bill: 600, zone: "Khagria" },
  { name: "Abdul Jalil Tafadar", phone: "8801712373975", username: "easy239-tafafar.vata", status: "active", expiry_date: "2026-03-10", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Vata" },
  { name: "Shirina Akter", phone: "8801739124014", username: "easy237-shirina.kag", status: "active", expiry_date: "2026-03-26", package_name: "FRN-8Mbps", bill: 600, zone: "Khagria" },
  { name: "MD Babul Ahmed", phone: "8801754313137", username: "easy236-babul.kglakh", status: "active", expiry_date: "2026-03-06", package_name: "FRN-8Mbps", bill: 600, zone: "Khagria" },
  { name: "Mizanur Rahman Khan Jibon", phone: "8801311622121", username: "easy235-jibon.vat", status: "active", expiry_date: "2026-03-10", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Vata" },
  { name: "Ms Sargina Akter Rina", phone: "8801308594220", username: "easy233-sargina.kglak", status: "active", expiry_date: "2026-03-02", package_name: "FRN-8Mbps", bill: 600, zone: "Khagria" },
  { name: "MD Asraful Islam rahi", phone: "8801648749781", username: "easy232-asraful.khag", status: "expire", expiry_date: "2025-10-24", package_name: "Expired", bill: 1000, zone: "Khagria" },
  { name: "MD Parvez", phone: "8801718791026", username: "easy231-parvej.nl", status: "expire", expiry_date: "2025-11-18", package_name: "Expired", bill: 600, zone: "Nalia" },
  { name: "Delwar Hossain", phone: "8801718602478", username: "easy230-delwar.kglak", status: "active", expiry_date: "2026-03-04", package_name: "Sync-70Mbps-1000-Unlimited", bill: 1000, zone: "Khagria" },
  { name: "Ramim Ahmed", phone: "8801327849895", username: "easy228-ramim.lakh", status: "expire", expiry_date: "2025-12-05", package_name: "Expired", bill: 600, zone: "Lakhawara" },
  { name: "MD Abdul Jaman", phone: "8801742760382", username: "easy227-jaman.lakh", status: "active", expiry_date: "2026-03-02", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Islampur" },
  { name: "MD Eakub", phone: "8801304953493", username: "easy226-eakub.vata", status: "active", expiry_date: "2026-03-04", package_name: "FRN-8Mbps", bill: 600, zone: "Vata" },
  { name: "Husna Akter", phone: "8801630125512", username: "easy225-husna.lakh", status: "expire", expiry_date: "2025-06-22", package_name: "Expired", bill: 600, zone: "Lakhawara" },
  { name: "Nazma Begum", phone: "8801709093840", username: "easy224-nazma.vata", status: "expire", expiry_date: "2025-08-10", package_name: "Expired", bill: 800, zone: "Vata" },
  { name: "Selina Begum", phone: "8801746468102", username: "easy223-selina.isl", status: "active", expiry_date: "2026-03-21", package_name: "FRN-8Mbps", bill: 600, zone: "Islampur" },
  { name: "Sanjoy urang", phone: "8801784484308", username: "easy222-sanjoy.isl", status: "active", expiry_date: "2026-03-23", package_name: "FRN-8Mbps", bill: 600, zone: "Islampur" },
  { name: "Habibir Rahman", phone: "8801326734454", username: "easyhabibur.vata", status: "active", expiry_date: "2026-03-16", package_name: "FRN-8Mbps", bill: 600, zone: "Vata" },
  { name: "Md Tanvir Hussain Chow", phone: "01796927579", username: "easy221-tanvir.vat", status: "active", expiry_date: "2026-03-23", package_name: "FRN-8Mbps", bill: 600, zone: "Vata" },
  { name: "Arif Ahmed", phone: "8801669045428", username: "easy220-arif-lakh", status: "active", expiry_date: "2026-03-22", package_name: "Sync-70Mbps-1000-Unlimited", bill: 1000, zone: "Lakhawara" },
  { name: "Maya Begum", phone: "8801766228225", username: "easy219-maya.vat", status: "active", expiry_date: "2026-03-25", package_name: "FRN-8Mbps", bill: 600, zone: "Lalmati" },
  { name: "MD Sirajul Islam", phone: "8801730963582", username: "easy218-shirajul.lakh", status: "active", expiry_date: "2026-03-21", package_name: "FRN-8Mbps", bill: 600, zone: "Islampur" },
  { name: "MD Hasan Ahmed", phone: "8801309295560", username: "easy217-hasan.lakh", status: "active", expiry_date: "2026-03-16", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Islampur" },
  { name: "Hena Begun", phone: "8801743155242", username: "easy216-hena-lakh", status: "active", expiry_date: "2026-02-27", package_name: "FRN-8Mbps", bill: 600, zone: "Islampur" },
  { name: "Mirza Robik Mia", phone: "8801710463903", username: "easy215-rokib.lakh", status: "active", expiry_date: "2026-03-25", package_name: "FRN-8Mbps", bill: 600, zone: "Lakhawara" },
  { name: "Sajjad Khan", phone: "8801721111307", username: "easysajjad.khan", status: "active", expiry_date: "2026-03-12", package_name: "Sync-70Mbps-1000-Unlimited", bill: 1000, zone: "Lakhawara" },
  { name: "Naziur Rahman Khan", phone: "8801728035842", username: "easyNadim", status: "active", expiry_date: "2026-03-10", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Vata" },
  { name: "Mizanur Rahman", phone: "8801779739845", username: "easy214-mizanur.vhata", status: "expire", expiry_date: "2025-11-25", package_name: "Expired", bill: 1000, zone: "Vata" },
  { name: "Monjur Ahmed", phone: "8801886814308", username: "easy213-monjur.kag", status: "active", expiry_date: "2026-03-11", package_name: "FRN-8Mbps", bill: 600, zone: "Lakhawara" },
  { name: "Nipa munalisa", phone: "8801724250900", username: "easy212-nipa.lakh", status: "active", expiry_date: "2026-03-15", package_name: "FRN-8Mbps", bill: 600, zone: "Lakhawara" },
  { name: "Sadia Akter", phone: "8801738086544", username: "easy211-sadia.isl", status: "active", expiry_date: "2026-03-16", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Islampur" },
  { name: "Ali Akbar", phone: "8801711870633", username: "easy210-ali.lal", status: "active", expiry_date: "2026-03-13", package_name: "Sync-80Mbps-1200-Unlimited", bill: 1200, zone: "Lalmati" },
  { name: "Abdul Jolil", phone: "8801717617487", username: "easy208-jolil.vt", status: "active", expiry_date: "2026-03-03", package_name: "FRN-8Mbps", bill: 750, zone: "Lalmati" },
  { name: "Juwel Ahmed", phone: "8801739653713", username: "easy207-juwel.isl", status: "active", expiry_date: "2026-03-18", package_name: "Sync-70Mbps-1000-Unlimited", bill: 1200, zone: "Islampur" },
  { name: "Babul Ahmed", phone: "8801731179712", username: "easy206-babul.isl", status: "active", expiry_date: "2026-03-10", package_name: "FRN-8Mbps", bill: 600, zone: "Islampur" },
  { name: "Mohammed Rubel Ahmed", phone: "8801745259102", username: "easy205-rubel.vt", status: "active", expiry_date: "2026-03-12", package_name: "Sync-36Mbps-800-Unlimited", bill: 800, zone: "Vata" },
  { name: "MD Shofiqul Islam", phone: "8801719012118", username: "easy204-shofiqul.lakh", status: "active", expiry_date: "2026-03-10", package_name: "FRN-8Mbps", bill: 600, zone: "Lakhawara" },
  { name: "Md Sohel Ahmed", phone: "8801712323612", username: "easy203-sohel.lak", status: "expire", expiry_date: "2025-10-08", package_name: "Expired", bill: 1000, zone: "Lakhawara" },
  { name: "Johirul islam khan jony", phone: "8801764436933", username: "easy202-jony.isl", status: "expire", expiry_date: "2026-01-27", package_name: "Expired", bill: 1000, zone: "Islampur" },
  { name: "MD Amir Mia", phone: "8801759725758", username: "easy201-amir.lal", status: "expire", expiry_date: "2025-10-15", package_name: "Expired", bill: 600, zone: "Lalmati" },
];

export function CustomerDataImport() {
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null);
  const [syncResult, setSyncResult] = useState<{ updated: number; not_found: number; errors: string[]; unmatched: string[] } | null>(null);

  const handleImport = async () => {
    if (!confirm(
      `⚠️ WARNING: This will DELETE all existing customer data and import ${CUSTOMER_DATA.length} customers from the Excel file.\n\nThis action cannot be undone. Continue?`
    )) return;

    setImporting(true);
    setProgress(10);
    setResult(null);

    try {
      setProgress(30);
      
      const { data, error } = await supabase.functions.invoke("import-customers-bulk", {
        body: {
          customers: CUSTOMER_DATA,
          clean_existing: true,
        },
      });

      setProgress(100);

      if (error) {
        toast({ title: "Import failed", description: error.message, variant: "destructive" });
        return;
      }

      setResult(data);
      toast({
        title: "Import Complete",
        description: `Successfully imported ${data.success} of ${CUSTOMER_DATA.length} customers${data.errors?.length ? ` (${data.errors.length} errors)` : ""}`,
      });
    } catch (err) {
      toast({ title: "Import failed", description: String(err), variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleSyncExpiry = async () => {
    if (!confirm(
      `This will sync expiry dates and missing packages for ${CUSTOMER_DATA.length} records by matching PPPoE usernames. No data will be deleted. Continue?`
    )) return;

    setSyncing(true);
    setProgress(10);
    setSyncResult(null);

    try {
      setProgress(30);

      const records = CUSTOMER_DATA.map((c) => ({
        username: c.username,
        expiry_date: c.expiry_date,
        package_name: c.package_name,
        status: c.status,
      }));

      const { data, error } = await supabase.functions.invoke("sync-expiry-dates", {
        body: { records },
      });

      setProgress(100);

      if (error) {
        toast({ title: "Sync failed", description: error.message, variant: "destructive" });
        return;
      }

      setSyncResult(data);
      toast({
        title: "Sync Complete",
        description: `Updated ${data.updated} customers, ${data.not_found} not found${data.errors?.length ? `, ${data.errors.length} errors` : ""}`,
      });
    } catch (err) {
      toast({ title: "Sync failed", description: String(err), variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Safe Sync Section */}
      <div className="p-4 border border-primary/50 rounded-lg bg-primary/5">
        <div className="flex items-start gap-3">
          <RefreshCw className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <p className="font-medium text-primary">Sync Expiry Dates & Packages (Safe)</p>
            <p className="text-sm text-muted-foreground mt-1">
              Matches PPPoE usernames from the Excel data against existing customers. Updates <strong>expiry_date</strong> and <strong>status</strong>. 
              If a customer has no package assigned, it will also assign the matching package. No data is deleted.
            </p>
          </div>
        </div>

        {syncing && (
          <div className="space-y-2 mt-3">
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground">Syncing expiry dates...</p>
          </div>
        )}

        {syncResult && (
          <div className="p-3 border rounded-lg bg-muted/50 space-y-2 mt-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="font-medium">
                {syncResult.updated} updated, {syncResult.not_found} not found
              </span>
            </div>
            {syncResult.unmatched?.length > 0 && (
              <div className="text-sm text-muted-foreground max-h-32 overflow-y-auto">
                <p className="font-medium">Unmatched usernames:</p>
                {syncResult.unmatched.map((u, i) => (
                  <p key={i}>• {u}</p>
                ))}
              </div>
            )}
            {syncResult.errors?.length > 0 && (
              <div className="text-sm text-destructive max-h-32 overflow-y-auto">
                {syncResult.errors.map((e, i) => (
                  <p key={i}>• {e}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <Button
          onClick={handleSyncExpiry}
          disabled={syncing || importing}
          className="mt-3"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          {syncing ? "Syncing..." : "Sync Expiry Dates Only"}
        </Button>
      </div>

      {/* Destructive Import Section */}
      <div className="p-4 border border-destructive/50 rounded-lg bg-destructive/5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
          <div>
            <p className="font-medium text-destructive">One-Time Data Import</p>
            <p className="text-sm text-muted-foreground mt-1">
              This will <strong>delete all existing customers</strong> and related data (invoices, payments, billing records, etc.), 
              then import {CUSTOMER_DATA.length} customers from the Excel file with their expiry dates, packages, and zones.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Default password: <code className="bg-muted px-1 rounded">123456</code> | PPPoE password: <code className="bg-muted px-1 rounded">12345678</code>
            </p>
          </div>
        </div>
      </div>

      {importing && (
        <div className="space-y-2">
          <Progress value={progress} />
          <p className="text-sm text-muted-foreground">Importing customers...</p>
        </div>
      )}

      {result && (
        <div className="p-4 border rounded-lg bg-muted/50 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <span className="font-medium">
              {result.success} / {CUSTOMER_DATA.length} customers imported
            </span>
          </div>
          {result.errors?.length > 0 && (
            <div className="text-sm text-destructive max-h-40 overflow-y-auto">
              {result.errors.map((e, i) => (
                <p key={i}>• {e}</p>
              ))}
            </div>
          )}
        </div>
      )}

      <Button
        onClick={handleImport}
        disabled={importing || syncing}
        variant="destructive"
      >
        <Upload className="h-4 w-4 mr-2" />
        {importing ? "Importing..." : "Import Excel Data & Replace Customers"}
      </Button>
    </div>
  );
}
