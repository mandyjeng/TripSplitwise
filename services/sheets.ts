
import { Transaction, Member, Category, Ledger } from '../types';

/**
 * 核心 fetch 工具，處理重試與錯誤包裝
 */
const robustFetch = async (url: string, options: RequestInit = {}, retries = 2): Promise<Response> => {
  try {
    const response = await fetch(url, {
      ...options,
      // 確保遵循重定向，這是 Google Apps Script 的必要條件
      redirect: 'follow',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response;
  } catch (err) {
    if (retries > 0) {
      console.warn(`Fetch 失敗，正在重試... 剩餘次數: ${retries}`, url);
      await new Promise(res => setTimeout(res, 1000));
      return robustFetch(url, options, retries - 1);
    }
    throw err;
  }
};

/**
 * 從「主管理表」抓取所有帳本配置
 */
export const fetchManagementConfig = async (url: string): Promise<Ledger[]> => {
  if (!url) return [];
  
  try {
    const response = await robustFetch(url, { cache: 'no-store' });
    const data = await response.json();

    if (data.error) {
      console.error('GAS Management Error:', data.error);
      return [];
    }

    const rawLedgers = data.ledgers || [];
    return rawLedgers.map((l: any) => {
      const sourceUrl = l['原始excel'] || l['原始Excel'] || l['sourceUrl'] || l['URL'] || '';
      
      return {
        id: String(l['ID'] || l.id),
        name: String(l['名稱'] || l.name || '未命名'),
        url: String(l['GAS_URL'] || l.url || ''),
        sourceUrl: String(sourceUrl).trim(),
        currency: String(l['幣別'] || l.currency || 'TWD'),
        exchangeRate: Number(l['匯率'] || l.exchangeRate) || 1,
        members: l['旅伴'] || l.members ? String(l['旅伴'] || l.members).split(',').map((m: string) => m.trim()) : []
      };
    });
  } catch (error) {
    console.error('[SheetService] fetchManagementConfig failed:', error);
    // 拋出具體錯誤以便 UI 捕捉
    throw new Error('無法連線至雲端管理表，請檢查網路或腳本權限設定。');
  }
};

const parseLocalDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr).split('T')[0];
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * 序列化分帳細節 (Record -> String)
 */
const serializeCustomSplits = (t: Transaction, members: Member[]): string => {
  const splits = t.customSplits;
  if (!splits || Object.keys(splits).length === 0) return '';
  
  return Object.entries(splits)
    .map(([id, ntdVal]) => {
      const name = members?.find(m => m.id === id)?.name || id;
      if (t.currency !== 'TWD' && t.ntdAmount > 0) {
        const oriVal = (ntdVal / t.ntdAmount) * t.originalAmount;
        const formattedOri = oriVal % 1 === 0 ? oriVal : oriVal.toFixed(2);
        return `${name}:${Math.round(ntdVal)}(${formattedOri})`;
      }
      return `${name}:${Math.round(ntdVal)}`;
    })
    .join(';');
};

/**
 * 反序列化分帳細節 (String -> Record)
 */
const deserializeCustomSplits = (splitStr: string, members: Member[]): Record<string, number> => {
  const result: Record<string, number> = {};
  if (!splitStr) return result;

  splitStr.split(';').forEach(pair => {
    const parts = pair.split(':');
    if (parts.length >= 2) {
      const name = parts[0];
      const valPart = parts[1];
      const ntdStr = valPart.split('(')[0];
      const member = members.find(m => m.name === name.trim());
      const id = member ? member.id : name.trim();
      result[id] = parseFloat(ntdStr) || 0;
    }
  });
  return result;
};

/**
 * 從「子帳本」抓取交易紀錄
 */
export const fetchTransactionsFromSheet = async (url: string, members: Member[] = []): Promise<Partial<Transaction>[]> => {
  if (!url) return [];
  try {
    const response = await robustFetch(url, { cache: 'no-store' });
    const data = await response.json();
    const records = Array.isArray(data) ? data : (data.transactions || []);
    
    return records.map((row: any) => {
      const splitDetailStr = row['分帳細節'] || '';
      const customSplits = deserializeCustomSplits(splitDetailStr, members);
      
      return {
        id: `sheet-${row.rowIndex}`,
        rowIndex: row.rowIndex,
        date: parseLocalDate(row['日期']),
        merchant: row['消費店家'] || '',
        item: row['消費細節'] || '',
        category: row['分類'] as Category,
        type: row['帳務類型'] as '公帳' | '私帳',
        payerId: row['付款人'] || '', 
        currency: row['原始幣別'] || '',
        originalAmount: Number(row['原始金額']) || 0,
        ntdAmount: Number(row['台幣金額']) || 0,
        isSplit: row['是否拆帳'] === '是' || row['是否拆帳'] === true,
        splitWith: row['參與成員'] ? String(row['參與成員']).split(',').map(s => s.trim()) : [],
        customSplits: Object.keys(customSplits).length > 0 ? customSplits : undefined,
        exchangeRate: row['匯率'] || 1
      };
    });
  } catch (error) {
    console.error('[SheetService] fetchTransactionsFromSheet failed:', error);
    throw new Error('子帳本資料載入失敗，請確認該行程的 GAS 網址正確且已公開。');
  }
};

/**
 * 向 Google Sheet 發送資料 (使用 POST)
 * GAS doPost 建議使用 no-cors 模式來避免 preflight 複雜性
 */
const sendPostToSheet = async (url: string, payload: any) => {
  if (!url) return;
  try {
    // GAS 接收 JSON 且避免 Preflight 的最佳實踐是 Content-Type: text/plain
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.error('[SheetService] sendPostToSheet failed:', e);
    throw e;
  }
};

export const saveToGoogleSheet = async (url: string, t: Transaction, members: Member[]) => {
  const payload = {
    type: 'ADD_TRANSACTION',
    '日期': t.date,
    '消費店家': t.merchant,
    '消費細節': t.item,
    '分類': t.category,
    '帳務類型': t.type,
    '付款人': members.find(m => m.id === t.payerId)?.name || t.payerId,
    '原始幣別': t.currency,
    '原始金額': t.originalAmount,
    '台幣金額': t.ntdAmount,
    '是否拆帳': t.isSplit ? '是' : '否',
    '參與成員': t.splitWith.map(id => members.find(m => m.id === id)?.name || id).join(','),
    '分帳細節': serializeCustomSplits(t, members)
  };
  await sendPostToSheet(url, payload);
};

export const updateTransactionInSheet = async (url: string, t: Transaction, members: Member[]) => {
  if (!t.rowIndex) return;
  const payload = {
    type: 'UPDATE_TRANSACTION',
    rowIndex: t.rowIndex,
    '日期': t.date,
    '消費店家': t.merchant,
    '消費細節': t.item,
    '分類': t.category,
    '帳務類型': t.type,
    '付款人': members.find(m => m.id === t.payerId)?.name || t.payerId,
    '原始幣別': t.currency,
    '原始金額': t.originalAmount,
    '台幣金額': t.ntdAmount,
    '是否拆帳': t.isSplit ? '是' : '否',
    '參與成員': t.splitWith.map(id => members.find(m => m.id === id)?.name || id).join(','),
    '分帳細節': serializeCustomSplits(t, members)
  };
  await sendPostToSheet(url, payload);
};

export const deleteTransactionFromSheet = async (url: string, rowIndex: number) => {
  await sendPostToSheet(url, { type: 'DELETE_TRANSACTION', rowIndex });
};
