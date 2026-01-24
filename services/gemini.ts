// src/services/gemini.ts

// 處理文字輸入
export const processAIInput = async (text: string, defaultCurrency: string = 'CHF') => {
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'text',
        text: text,
        defaultCurrency: defaultCurrency,
      }),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error processing text:", error);
    return {}; // 或回傳錯誤訊息讓 UI 處理
  }
};

// 處理圖片輸入
export const processReceiptImage = async (base64Image: string) => {
  try {
    // 移除 base64 的前綴 (例如 data:image/jpeg;base64,) 如果有的話，
    // 但通常 Google SDK 需要純 base64 字串，請確認這裡傳入的是純字串還是帶有前綴的。
    // 如果傳入的是帶前綴的，可以在這裡處理，或者確保後端接收正確格式。
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'image',
        base64Image: cleanBase64,
      }),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error processing image:", error);
    return {};
  }
};