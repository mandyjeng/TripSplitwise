// src/services/gemini.ts

// 建立一個共用的請求處理函式，避免重複寫 fetch 邏輯
const sendRequest = async (payload: any) => {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  // 嘗試解析 JSON 回傳值 (不論成功或失敗，後端都應該回傳 JSON)
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    // 這裡優先讀取後端回傳的錯誤細節 (error 或 details 或 message)
    const errorMessage = data?.error || data?.message || data?.details || `API Error: ${response.statusText}`;
    throw new Error(errorMessage);
  }

  return data;
};

// 處理文字輸入
export const processAIInput = async (text: string, defaultCurrency: string = 'CHF') => {
  try {
    return await sendRequest({
      type: 'text',
      text: text,
      defaultCurrency: defaultCurrency,
    });
  } catch (error) {
    console.error("Error processing text:", error);
    // ⚠️ 關鍵修改：將錯誤往上拋，讓 UI (AllInput.tsx) 可以 catch 到並跳 alert
    throw error;
  }
};

// 處理圖片輸入
export const processReceiptImage = async (base64Image: string) => {
  try {
    // 處理 base64 前綴
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

    return await sendRequest({
      type: 'image',
      base64Image: cleanBase64,
    });
  } catch (error) {
    console.error("Error processing image:", error);
    // ⚠️ 關鍵修改：將錯誤往上拋
    throw error;
  }
};