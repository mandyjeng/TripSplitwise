// api/analyze.ts
import { GoogleGenAI, Type } from "@google/genai";

// 初始化 Gemini (在伺服器端執行，process.env 讀取是安全的)
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// 定義 Schema (原本的定義搬過來)
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

// Vercel Serverless Function Handler
export default async function handler(req, res) {
  // 1. 設定 CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', 'https://mandyjeng.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { type, text, base64Image, defaultCurrency = 'CHF' } = req.body;
    
    let promptConfig = {};
    
    // 根據請求類型組裝不同的 Prompt
    if (type === 'text') {
      promptConfig = {
        model: "gemini-flash-latest",
        contents: `這是一趟正在進行中的旅行，目前所在地區的主要貨幣是 ${defaultCurrency}。
          請分析以下記帳資訊： "${text}"。
          規則：
          1. 如果使用者輸入如「品項+數字」（例如：飲料2、巧克力 7），請將數字判定為 'amount'（金額），文字判定為 'item'（項目內容）。
          2. 幣別優先判定為 ${defaultCurrency}。
          3. 如果沒有明確店家，店家(merchant)可與項目內容相同。
          4. 今天日期是 ${new Date().toISOString().split('T')[0]}。`,
      };
    } else if (type === 'image') {
      promptConfig = {
        model: 'gemini-2.0-flash', 
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
      };
    } else {
      throw new Error("Invalid type");
    }

    // 加入 Schema 設定
    const finalConfig = {
      ...promptConfig,
      config: {
        responseMimeType: "application/json",
        responseSchema: expenseSchema,
      },
    };

    // 呼叫 Google API
    // 注意：舊版 SDK 用法不同，您原本是用 ai.models.generateContent，這裡沿用
    const response = await ai.models.generateContent(finalConfig);
    
    // 回傳結果
    const parsedData = JSON.parse(response.text || '{}');
    return res.status(200).json(parsedData);

  } catch (error) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({ error: 'AI Processing Failed', details: error.message });
  }
}