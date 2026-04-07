// src/services/gemini.ts

// 定義回傳的資料介面 (Optional, 但對 TypeScript 很有幫助)
export interface ExpenseData {
  merchant: string;
  item: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
}

// 共用的請求發送器
const sendRequest = async (payload: any): Promise<ExpenseData> => {
  // 呼叫 Vercel 後端 API
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    // 優先顯示後端回傳的具體錯誤訊息
    const errorMessage = data?.message || data?.error || `請求失敗 (${response.status})`;
    throw new Error(errorMessage);
  }

  return data as ExpenseData;
};

// 處理文字輸入
export const processAIInput = async (text: string, defaultCurrency: string = 'CHF') => {
  try {
    return await sendRequest({
      type: 'text',
      text: text,
      defaultCurrency: defaultCurrency, // 將預設貨幣傳給後端
    });
  } catch (error) {
    console.error("Text analysis failed:", error);
    throw error; // 往上拋給 UI 層處理
  }
};

// 處理圖片輸入
export const processReceiptImage = async (base64Image: string) => {
  try {
    // 前端先做簡單的清理，確保傳輸的資料乾淨
    const cleanBase64 = base64Image.includes('base64,') 
      ? base64Image.split('base64,')[1] 
      : base64Image;

    return await sendRequest({
      type: 'image',
      base64Image: cleanBase64,
    });
  } catch (error) {
    console.error("Image analysis failed:", error);
    throw error; // 往上拋給 UI 層處理
  }
};