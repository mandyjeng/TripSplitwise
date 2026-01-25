// api/analyze.ts
import { GoogleGenAI, Type } from "@google/genai";

// 初始化 Gemini (在伺服器端執行，process.env 讀取是安全的)
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

// 定義 Schema
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
export default async function handler(req: any, res: any) {
  // 1. 設定 CORS (包含 OPTIONS 預檢請求的處理)
  res.setHeader('Access-Control-Allow-Credentials', "true");
  // 注意：若要允許帶有認證(Credentials)的請求，Origin 不能為 '*'，必須指定確切網域
  res.setHeader('Access-Control-Allow-Origin', 'https://mandyjeng.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // 處理瀏覽器的預檢請求 (Preflight Request)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 只允許 POST 方法
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    // 2. 檢查 API Key
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error("Server Error: GOOGLE_API_KEY is missing in environment variables.");
    }

    const { type, text, base64Image, defaultCurrency = 'CHF' } = req.body;
    
    let modelParams: any = {};
    
    // 3. 根據請求類型組裝 Prompt
    if (type === 'text') {
      if (!text) throw new Error("缺少文字內容");

      modelParams = {
        model: "gemini-1.5-flash",
        contents: `這是一趟正在進行中的旅行，目前所在地區的主要貨幣是 ${defaultCurrency}。
          請分析以下記帳資訊： "${text}"。
          規則：
          1. 如果使用者輸入如「品項+數字」（例如：飲料2、巧克力 7），請將數字判定為 'amount'（金額），文字判定為 'item'（項目內容）。
          2. 幣別優先判定為 ${defaultCurrency}。
          3. 如果沒有明確店家，店家(merchant)可與項目內容相同。
          4. 今天日期是 ${new Date().toISOString().split('T')[0]}。`,
      };
    } else if (type === 'image') {
      if (!base64Image) throw new Error("缺少圖片資料");

      // 清理 Base64 字串 (移除 data:image/jpeg;base64, 前綴，以免 SDK 報錯)
      const cleanBase64 = base64Image.includes('base64,') 
        ? base64Image.split('base64,')[1] 
        : base64Image;

      modelParams = {
        model: 'gemini-1.5-flash', 
        contents: {
          parts: [
            { inlineData: { data: cleanBase64, mimeType: 'image/jpeg' } },
            { text: `請精確辨識這張收據的所有細節：
              1. 找出消費店家(merchant)，例如：MIGROS。
              2. 核心任務：在 'item' (項目內容) 欄位，請『逐行』列出收據上看到的所有商品名稱、數量與單價。
              3. 準確抓取最終付款的總金額(amount)與幣別(currency)。
              4. 辨識收據上的交易日期(date)，格式轉為 YYYY-MM-DD。` }
          ]
        },
      };
    } else {
      throw new Error("Invalid request type: must be 'text' or 'image'");
    }

    // 4. 加入 Schema 設定並呼叫 API
    const finalConfig = {
      ...modelParams,
      config: {
        responseMimeType: "application/json",
        responseSchema: expenseSchema,
      },
    };

    const response = await ai.models.generateContent(finalConfig);
    
    // 5. 確保回應內容存在並解析 JSON
    // 注意：新版 SDK 有時 response.text 是一個方法，有時是屬性，這裡做安全存取
    const responseText = typeof response.text === 'function' ? response.text() : response.text;

    if (!responseText) {
      throw new Error("AI 回傳內容為空 (可能被安全性篩選器攔截)");
    }

    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch (e) {
      console.error("JSON Parse Error. Raw text:", responseText);
      throw new Error("AI 回傳格式錯誤，無法解析為 JSON");
    }

    // 回傳成功結果
    return res.status(200).json(parsedData);

  } catch (error: any) {
   console.error("Gemini API Error:", error);

    // 1. 專門捕捉 429 (配額額滿) 錯誤
    // Google SDK 的錯誤物件結構比較深，有時候 status 在 response 裡，有時候在外面
    const isQuotaError = error.status === 429 || 
                         error.response?.status === 429 || 
                         error.message?.includes('429') ||
                         error.message?.includes('Quota exceeded');

    if (isQuotaError) {
      return res.status(429).json({ 
        error: 'QUOTA_EXCEEDED', 
        message: '⚠️ API 免費額度已滿或請求過快。請休息約 1 分鐘後再試。' 
      });
    }

    // 2. 捕捉安全性篩選錯誤 (常見於收據包含敏感關鍵字)
    if (error.message?.includes('SAFETY') || error.message?.includes('blocked')) {
      return res.status(400).json({
        error: 'SAFETY_BLOCK',
        message: '⚠️ 內容被 AI 安全性篩選器攔截，無法處理。'
      });
    }

    // 3. 其他未知錯誤
    // 為了版面整潔，我們只回傳 error.message 的重點，或給通用訊息
    return res.status(500).json({ 
      error: 'AI_PROCESSING_ERROR', 
      message: error.message || '系統發生未知錯誤，請稍後再試。' 
    });
  
  }
}