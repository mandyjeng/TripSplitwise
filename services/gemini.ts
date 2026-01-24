
import { GoogleGenAI, Type } from "@google/genai";

// 初始化 Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const expenseSchema = {
  type: Type.OBJECT,
  properties: {
    merchant: { type: Type.STRING, description: '消費店家名稱（如：Starbucks, Migros, Coop）' },
    item: { type: Type.STRING, description: '項目內容。請務必逐行列出收據上的所有商品品項。如果是手動輸入如「飲料2」，則項目內容為「飲料」。' },
    amount: { type: Type.NUMBER, description: '外幣金額 (原始收據上的總金額)' },
    currency: { type: Type.STRING, description: '幣別，如 CHF, EUR, JPY, TWD' },
    category: { type: Type.STRING, description: '分類：住宿、交通、門票、用餐、雜項、保險' },
    date: { type: Type.STRING, description: '日期，格式 YYYY-MM-DD。請從收據中找出交易日期。' },
  },
  required: ['merchant', 'item', 'amount', 'currency', 'category', 'date'],
};

export const processAIInput = async (text: string, defaultCurrency: string = 'CHF') => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `這是一趟正在進行中的旅行，目前所在地區的主要貨幣是 ${defaultCurrency}。
    請分析以下記帳資訊： "${text}"。
    
    規則：
    1. 如果使用者輸入如「品項+數字」（例如：飲料2、巧克力 7），請將數字判定為 'amount'（金額），文字判定為 'item'（項目內容）。
    2. 幣別優先判定為 ${defaultCurrency}。
    3. 如果沒有明確店家，店家(merchant)可與項目內容相同。
    4. 今天日期是 ${new Date().toISOString().split('T')[0]}。`,
    config: {
      responseMimeType: "application/json",
      responseSchema: expenseSchema,
    },
  });
  return JSON.parse(response.text || '{}');
};

export const processReceiptImage = async (base64Image: string) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
        { text: `請精確辨識這張收據的所有細節：
        1. 找出消費店家(merchant)，例如：MIGROS。
        2. 核心任務：在 'item' (項目內容) 欄位，請『逐行』列出收據上看到的所有商品名稱、數量與單價。
        3. 準確抓取最終付款的總金額(amount)與幣別(currency)。
        4. 辨識收據上的交易日期(date)，格式轉為 YYYY-MM-DD。` }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: expenseSchema,
    },
  });
  return JSON.parse(response.text || '{}');
};
