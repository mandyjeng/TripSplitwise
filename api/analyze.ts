// api/analyze.ts
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// ⚠️ 注意：建議改用穩定版 SDK: npm install @google/generative-ai
// 如果您原本是用 @google/genai (新版)，請確認 import 對應，
// 但以下代碼我改寫為目前最通用的 @google/generative-ai 寫法，最穩。

export const config = {
  runtime: 'edge', // 建議：使用 Edge Runtime 速度更快，且不會有冷啟動問題
};

// 定義 Schema (使用標準 JSON Schema 格式)
const expenseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    merchant: { type: SchemaType.STRING, description: '消費店家名稱' },
    item: { type: SchemaType.STRING, description: '項目內容，請逐行列出商品。' },
    amount: { type: SchemaType.NUMBER, description: '總金額' },
    currency: { type: SchemaType.STRING, description: '幣別 (CHF, TWD, etc)' },
    category: { type: SchemaType.STRING, description: '分類：住宿、交通、門票、用餐、雜項' },
    date: { type: SchemaType.STRING, description: 'YYYY-MM-DD' },
  },
  required: ['merchant', 'item', 'amount', 'currency', 'category', 'date'],
};

export default async function handler(req: any) {
  // 1. CORS 處理 (支援 Localhost 開發)
  const origin = req.headers.get('origin');
  const allowedOrigins = ['https://mandyjeng.github.io', 'http://localhost:3000', 'http://localhost:4200', 'http://localhost:5173'];
  
  // 如果請求來源在允許清單內，就回傳該來源；否則回傳 GitHub (生產環境保底)
  const allowOrigin = allowedOrigins.includes(origin) ? origin : 'https://mandyjeng.github.io';

  const corsHeaders = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'Method Not Allowed' }), { 
      status: 405, headers: corsHeaders 
    });
  }

  try {
    const { GOOGLE_API_KEY } = process.env;
    if (!GOOGLE_API_KEY) throw new Error("Server Error: Missing API Key");

    // 2. 初始化 (每一次請求重新 new 是安全的，特別是在 Edge Runtime)
    const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
    
    // ⚠️ 關鍵修正：鎖定使用 gemini-1.5-flash (最穩定、免費額度最正常)
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: expenseSchema,
      }
    });

    // 讀取 Request Body (Edge Runtime 寫法)
    const body = await req.json();
    const { type, text, base64Image, defaultCurrency = 'CHF' } = body;

    let result;

    // 3. 執行 AI
    if (type === 'text') {
      const prompt = `
        分析記帳資訊："${text}"。
        目前幣別：${defaultCurrency}。日期：${new Date().toISOString().split('T')[0]}。
        規則：
        1. 數字是金額(amount)，文字是項目(item)。
        2. 若無店家，merchant填寫項目名稱。
      `;
      result = await model.generateContent(prompt);

    } else if (type === 'image') {
      if (!base64Image) throw new Error("No image data");
      
      // 簡單清理 base64
      const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

      const prompt = `
        辨識收據：
        1. Merchant: 店家名稱。
        2. Item: 所有商品名稱。
        3. Amount: 總金額 (數字)。
        4. Currency: 幣別符號。
        5. Date: 交易日期 (YYYY-MM-DD)。
      `;

      result = await model.generateContent([
        { inlineData: { data: cleanBase64, mimeType: "image/jpeg" } },
        { text: prompt }
      ]);
    }

    const responseText = result?.response.text();
    const data = JSON.parse(responseText || '{}');

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("API Error:", error);

    // 錯誤處理
    let status = 500;
    let message = 'Internal Server Error';

    if (error.message?.includes('429')) {
      status = 429;
      message = 'API 額度忙碌中，請稍後再試 (Quota Exceeded)';
    }

    return new Response(JSON.stringify({ error: message, details: error.message }), {
      status: status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}