"use client";

import { createContext, useContext } from "react";

/**
 * Lightweight UI translations. Keys are the English text, so any string without
 * a translation simply shows in English. Add entries here to translate more of the app.
 */
type Dict = Record<string, string>;

const ar: Dict = {
  // Top bar & apps
  "Mail": "البريد", "Calendar": "التقويم", "Contacts": "جهات الاتصال", "Notes": "الملاحظات",
  "Search email...": "ابحث في البريد...", "Search calendar...": "ابحث في التقويم...", "Search contacts...": "ابحث في جهات الاتصال...", "Search notes...": "ابحث في الملاحظات...",
  "Settings": "الإعدادات", "Help": "مساعدة", "Language": "اللغة", "Accessibility": "إمكانية الوصول",
  "Arabic and Urdu switch the layout to right-to-left.": "العربية والأردية تقلبان الواجهة من اليمين إلى اليسار.",
  // Mail
  "Compose": "إنشاء", "Inbox": "الوارد", "Starred": "المميزة بنجمة", "Sent": "المرسلة", "Drafts": "المسودات", "Archive": "الأرشيف", "Spam": "البريد العشوائي", "Trash": "المهملات",
  "Send": "إرسال", "Schedule send": "جدولة الإرسال", "Tomorrow morning": "صباح الغد", "This afternoon": "بعد ظهر اليوم", "Monday morning": "صباح الاثنين", "Pick date & time": "اختر التاريخ والوقت", "Cancel": "إلغاء",
  // Help
  "Help & support": "المساعدة والدعم", "We’re here to help you get things done.": "نحن هنا لمساعدتك على إنجاز أعمالك.",
  "Help center": "مركز المساعدة", "Answers to common questions": "إجابات للأسئلة الشائعة",
  "Training": "التدريب", "Short guided lessons": "دروس إرشادية قصيرة",
  "Documentation": "الوثائق", "Full guides for every feature": "أدلة كاملة لكل ميزة",
  "Contact support": "تواصل مع الدعم", "Get help from a person": "احصل على مساعدة من شخص",
  "Keyboard shortcuts": "اختصارات لوحة المفاتيح", "Back to mail": "العودة إلى البريد",
  "How can we help?": "كيف يمكننا مساعدتك؟", "Search our answers or pick a topic below.": "ابحث في إجاباتنا أو اختر موضوعًا أدناه.",
  "Popular questions": "الأسئلة الشائعة", "Show all": "عرض الكل",
  // Settings
  "Changes save automatically": "تُحفظ التغييرات تلقائيًا", "Your preferences": "تفضيلاتك", "Administration": "الإدارة",
  "Profile": "الملف الشخصي", "Signature": "التوقيع", "Language & region": "اللغة والمنطقة", "Appearance": "المظهر", "Appearance & reading": "المظهر والقراءة", "Reading & writing": "القراءة والكتابة", "Notifications": "الإشعارات",
  "Branding & sign-in": "العلامة التجارية وتسجيل الدخول", "Mail servers": "خوادم البريد", "Users": "المستخدمون", "Navigation": "التنقل", "Security": "الأمان", "Control panels": "لوحات التحكم",
  // Accessibility
  "Accessibility tools": "أدوات إمكانية الوصول", "Color adjustment": "ضبط الألوان", "Text size": "حجم النص", "Navigation adjustment": "ضبط التنقل",
  "High contrast": "تباين عالٍ", "Dark contrast": "تباين داكن", "Highlight links": "تمييز الروابط", "Increase text": "تكبير النص", "Decrease text": "تصغير النص", "Reset": "إعادة تعيين",
  "Line height": "ارتفاع السطر", "Text spacing": "تباعد النص", "Big cursor": "مؤشر كبير", "Hide images": "إخفاء الصور", "Screen reader": "قارئ الشاشة", "Reset all settings": "إعادة تعيين كل الإعدادات",
};

const ur: Dict = {
  "Mail": "میل", "Calendar": "کیلنڈر", "Contacts": "رابطے", "Notes": "نوٹس",
  "Search email...": "ای میل تلاش کریں...", "Search calendar...": "کیلنڈر تلاش کریں...", "Search contacts...": "رابطے تلاش کریں...", "Search notes...": "نوٹس تلاش کریں...",
  "Settings": "ترتیبات", "Help": "مدد", "Language": "زبان", "Accessibility": "رسائی",
  "Arabic and Urdu switch the layout to right-to-left.": "عربی اور اردو میں ترتیب دائیں سے بائیں ہو جاتی ہے۔",
  "Compose": "نئی ای میل", "Inbox": "ان باکس", "Starred": "ستارہ والی", "Sent": "بھیجی گئی", "Drafts": "مسودے", "Archive": "آرکائیو", "Spam": "اسپام", "Trash": "ردی",
  "Send": "بھیجیں", "Schedule send": "بھیجنے کا وقت مقرر کریں", "Tomorrow morning": "کل صبح", "This afternoon": "آج سہ پہر", "Monday morning": "پیر کی صبح", "Pick date & time": "تاریخ اور وقت چنیں", "Cancel": "منسوخ",
  "Help & support": "مدد اور معاونت", "We’re here to help you get things done.": "ہم آپ کی مدد کے لیے حاضر ہیں۔",
  "Help center": "مدد مرکز", "Answers to common questions": "عام سوالات کے جوابات",
  "Training": "تربیت", "Short guided lessons": "مختصر رہنما اسباق",
  "Documentation": "دستاویزات", "Full guides for every feature": "ہر فیچر کے لیے مکمل رہنما",
  "Contact support": "سپورٹ سے رابطہ", "Get help from a person": "کسی فرد سے مدد لیں",
  "Keyboard shortcuts": "کی بورڈ شارٹ کٹس", "Back to mail": "میل پر واپس",
  "How can we help?": "ہم کیسے مدد کر سکتے ہیں؟", "Search our answers or pick a topic below.": "جوابات تلاش کریں یا نیچے کوئی موضوع چنیں۔",
  "Popular questions": "مقبول سوالات", "Show all": "سب دکھائیں",
  "Changes save automatically": "تبدیلیاں خود بخود محفوظ ہوتی ہیں", "Your preferences": "آپ کی ترجیحات", "Administration": "انتظامیہ",
  "Profile": "پروفائل", "Signature": "دستخط", "Language & region": "زبان اور علاقہ", "Appearance": "ظاہری شکل", "Appearance & reading": "ظاہری شکل اور پڑھنا", "Reading & writing": "پڑھنا اور لکھنا", "Notifications": "اطلاعات",
  "Branding & sign-in": "برانڈنگ اور سائن ان", "Mail servers": "میل سرورز", "Users": "صارفین", "Navigation": "نیویگیشن", "Security": "سیکیورٹی", "Control panels": "کنٹرول پینلز",
  "Accessibility tools": "رسائی کے ٹولز", "Color adjustment": "رنگ کی ترتیب", "Text size": "متن کا سائز", "Navigation adjustment": "نیویگیشن کی ترتیب",
  "High contrast": "زیادہ کنٹراسٹ", "Dark contrast": "گہرا کنٹراسٹ", "Highlight links": "لنکس نمایاں کریں", "Increase text": "متن بڑا کریں", "Decrease text": "متن چھوٹا کریں", "Reset": "ری سیٹ",
  "Line height": "سطر کی اونچائی", "Text spacing": "متن کا فاصلہ", "Big cursor": "بڑا کرسر", "Hide images": "تصاویر چھپائیں", "Screen reader": "اسکرین ریڈر", "Reset all settings": "تمام ترتیبات ری سیٹ کریں",
};

const DICTS: Record<string, Dict> = { ar, ur };

export function translate(lang: string, text: string): string {
  return DICTS[lang]?.[text] ?? text;
}

const LangContext = createContext("en");
export const LangProvider = LangContext.Provider;

/** Returns a translate function for the current language. */
export function useT() {
  const lang = useContext(LangContext);
  return (text: string) => translate(lang, text);
}
