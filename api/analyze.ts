// api/analyze.ts
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// 初始化 Gemini
// 請確保 Vercel 環境變數有設定 GOOGLE_API_KEY
const ai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

// 定義 Schema (完全參照您原本的設定)
const expenseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    merchant: { type: SchemaType.STRING, description: '消費店家名稱（如：Starbucks, Migros, Coop）。若無明確店家則回傳「未指定店家」' },
    item: { type: SchemaType.STRING, description: '品項清單，必須包含品項名稱與對應金額，多個品項請用換行分隔。' },
    amount: { type: SchemaType.NUMBER, description: '總金額' },
    currency: { type: SchemaType.STRING, description: '幣別，如 CHF, EUR, JPY, TWD' },
    category: { type: SchemaType.STRING, description: '分類：住宿、交通、門票、用餐、雜項、保險、個人消費' },
    date: { type: SchemaType.STRING, description: '日期，格式 YYYY-MM-DD。' },
  },
  required: ['merchant', 'item', 'amount', 'currency', 'category', 'date'],
};

// 清洗 AI 回傳的字串 (保留您的邏輯)
const sanitizeResult = (data: any) => {
  if (data && typeof data.item === 'string') {
    // 將字面上的 \n 轉為真正的換行，並移除可能出現的 \r
    data.item = data.item.replace(/\\n/g, '\n').replace(/\\r/g, '');
  }
  return data;
};

// Vercel Serverless Function Handler
export default async function handler(req: any, res: any) {
  // 1. 設定 CORS
  res.setHeader('Access-Control-Allow-Credentials', "true");
  // 建議上線時改為您的 GitHub Pages 網址 'https://mandyjeng.github.io'
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Content-Type');

  // 處理預檢請求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error("Server Error: GOOGLE_API_KEY is missing.");
    }

    const { type, text, base64Image, defaultCurrency = 'CHF' } = req.body;
    let modelParams: any = {};
    const today = new Date().toISOString().split('T')[0];

    // 2. 根據請求類型組裝 Prompt (這裡移植了您原本的 Prompt)
    if (type === 'text') {
      if (!text) throw new Error("缺少文字內容");

      modelParams = {
        model: "gemini-flash-latest",
        contents: [
          {
            role: "user",
            parts: [{
              text: `這是一筆文字記帳資訊： "${text}"。
              當前預設貨幣是 ${defaultCurrency}，今天日期是 ${today}。
              
              請依照以下嚴格規則處理：
              1. 店家 (merchant)：
                - 提取最像店家的名稱（通常是輸入的第一個詞，如 coop, starbucks）。
                - 如果輸入中沒有提到任何像店名的詞，請務必回傳「未指定店家」。
              2. 項目內容 (item)：
                - 請列出所有品項與其後面的金額。
                - 多個品項請務必使用換行分隔。
                - 例如輸入 "Coop 咖啡3 早餐2"，item 應為:
                  咖啡 3
                  早餐 2
              3. 金額 (amount)：
                - 自動將輸入中出現的所有數字相加作為最終總金額。
              4. 幣別 (currency)：優先使用 ${defaultCurrency}。
              5. 分類 (category)：根據內容判斷。`,
            }]
          }
        ]
      };

    } else if (type === 'image') {
      if (!base64Image) throw new Error("缺少圖片資料");

      // 清理 Base64 (後端再做一次保險)
      const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

      modelParams = {
        model: 'gemini-flash-latest', 
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { data: cleanBase64, mimeType: 'image/jpeg' } },
              { text: `請辨識收據圖片並依照以下格式處理項目內容 (item) 欄位：
              
              規則：
              1. 項目內容 (item) 格式：
                 [繁體中文翻譯後的品項清單、數量與單價]
                 ------------------
                 [收據上的原始品項內容、數量與單價]
              2. 確保翻譯位於上半部，分隔線在中間，原文在下半部。
              3. 請直接使用真正的換行字元，不要輸出字面上的 \\n 字串。
              4. 準確辨識總金額(amount)、幣別(currency)、店家(merchant)與日期(date)。` }
            ]
          }
        ]
      };
    } else {
      throw new Error("Invalid request type");
    }

    // 3. 呼叫 Gemini
    const model = ai.getGenerativeModel({
      model: modelParams.model,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: expenseSchema,
      },
    });

    const result = await model.generateContent({
      contents: modelParams.contents
    });
    
    const response = await result.response;
    const responseText = response.text();

    if (!responseText) {
      throw new Error("AI 回傳內容為空");
    }

    // 4. 解析與回傳
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
      parsedData = sanitizeResult(parsedData);
    } catch (e) {
      console.error("JSON Parse Error:", responseText);
      throw new Error("AI 回傳格式錯誤");
    }

    return res.status(200).json(parsedData);

  } catch (error: any) {
    console.error("Backend Error:", error);
    
    // 錯誤處理邏輯 (配額/安全性)
    const isQuotaError = error.status === 429 || error.message?.includes('429');
    if (isQuotaError) {
      return res.status(429).json({ error: 'QUOTA_EXCEEDED', message: 'API 額度已滿，請稍後再試。' });
    }
    
    return res.status(500).json({ 
      error: 'AI_ERROR', 
      message: error.message || '系統發生錯誤' 
    });
  }
}