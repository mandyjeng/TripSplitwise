// api/analyze.ts
import { GoogleGenAI, Type } from "@google/genai";

// 初始化 Gemini (在伺服器端執行，process.env 讀取是安全的)
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

// 定義 Schema
const expenseSchema = {
  type: Type.OBJECT,
  properties: {
    merchant: { type: Type.STRING, description: '消費店家名稱（如：Starbucks, Migros, Coop）' },
    item: { type: Type.STRING, description: '項目內容清單。' },
    amount: { type: Type.NUMBER, description: '總金額' },
    currency: { type: Type.STRING, description: '幣別，如 CHF, EUR, JPY, TWD' },
    category: { type: Type.STRING, description: '分類：住宿、交通、門票、用餐、雜項、保險' },
    date: { type: Type.STRING, description: '日期，格式 YYYY-MM-DD。' },
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
        model: "gemini-flash-latest",
       contents: `這是一筆文字記帳資訊： "${text}"。
                  當前預設貨幣是 ${defaultCurrency}，今天日期是 ${new Date().toISOString().split('T')[0]}。
                  
                  請依照以下規則處理：
                  1. 項目內容 (item)：
                    - 請直接提取使用者輸入的品項名稱（原文顯示，不需翻譯）。
                    - 多個品項請使用換行分隔。
                    - 不要添加 "------------------" 分隔線。
                  2. 店家 (merchant)：提取最像店家的名稱（如 coop, starbucks），若無則與品項名稱相同。
                  3. 金額 (amount)：
                    - 如果輸入中包含多個數字（如：咖啡3 三明治3），請自動將所有數字相加（3+3=6）。
                    - 輸出最終的加總數值。
                  4. 幣別 (currency)：優先使用 ${defaultCurrency}。`,
      };
    } else if (type === 'image') {
      if (!base64Image) throw new Error("缺少圖片資料");

      // 清理 Base64 字串 (移除 data:image/jpeg;base64, 前綴，以免 SDK 報錯)
      const cleanBase64 = base64Image.includes('base64,') 
        ? base64Image.split('base64,')[1] 
        : base64Image;

      modelParams = {
        model: 'gemini-flash-latest', 
        contents: {
          parts: [
            { inlineData: { data: cleanBase64, mimeType: 'image/jpeg' } },
            { text: `請辨識收據圖片並依照以下格式處理項目內容 (item) 欄位：
        
            規則：
            1. 項目內容 (item) 格式：
              [繁體中文翻譯後的品項清單]
              ------------------
              [收據上的原始品項內容、數量與單價]
            2. 確保翻譯位於上半部，分隔線在中間，原文在下半部。
            3. 準確辨識總金額(amount)、幣別(currency)、店家(merchant)與日期(date)。` }
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