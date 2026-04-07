// src/services/gemini.ts

// 這裡定義你在後端使用的模型名稱，方便前端顯示
// const CURRENT_MODEL_NAME = "gemini-1.5-flash-latest"; 

// 讀取環境變數，如果沒設定則預設使用 gemini-flash-latest
const CURRENT_MODEL_NAME = process.env.GEMINI_MODEL || "gemini-flash-latest";

export interface ExpenseData {
  merchant: string;
  item: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
}

// 建立一個自定義錯誤類別，方便傳遞更多資訊
class AIProcessingError extends Error {
  status?: number;
  model: string;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "AIProcessingError";
    this.status = status;
    this.model = CURRENT_MODEL_NAME;
  }
}

// 共用的請求發送器
const sendRequest = async (payload: any): Promise<ExpenseData> => {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  // 嘗試解析 JSON，如果失敗則回傳 null
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    // 根據不同狀態碼給予更白話的解釋
    let errorDetail = data?.message || data?.error || `請求失敗`;
    
    if (response.status === 503) {
      errorDetail = "Google 伺服器忙碌中 (503 Service Unavailable)";
    } else if (response.status === 429) {
      errorDetail = "已達今日 API 使用配額上限 (429 Too Many Requests)";
    } else if (response.status === 404) {
      errorDetail = "找不到指定的 AI 模型 (404 Not Found)";
    }

    // 拋出包含狀態碼的自定義錯誤
    throw new AIProcessingError(errorDetail, response.status);
  }

  return data as ExpenseData;
};

// 處理文字輸入
export const processAIInput = async (text: string, defaultCurrency: string = 'CHF') => {
  try {
    return await sendRequest({
      type: 'text',
      text: text,
      defaultCurrency: defaultCurrency,
    });
  } catch (error: any) {
    // 確保這裡拋出的錯誤都帶有模型資訊
    if (!(error instanceof AIProcessingError)) {
      throw new AIProcessingError(error.message || "文字分析發生未知錯誤");
    }
    throw error;
  }
};

// 處理圖片輸入
export const processReceiptImage = async (base64Image: string) => {
  try {
    const cleanBase64 = base64Image.includes('base64,') 
      ? base64Image.split('base64,')[1] 
      : base64Image;

    return await sendRequest({
      type: 'image',
      base64Image: cleanBase64,
    });
  } catch (error: any) {
    if (!(error instanceof AIProcessingError)) {
      throw new AIProcessingError(error.message || "圖片分析發生未知錯誤");
    }
    throw error;
  }
};