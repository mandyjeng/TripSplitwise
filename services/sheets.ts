
import { Transaction, Member, Category } from '../types';

/**
 * 解析日期字串，確保不因時區導致日期減一天
 */
const parseLocalDate = (dateStr: string): string => {
  if (!dateStr) return '';
  
  // 如果字串包含 T (ISO 格式)，利用 Date 物件轉為本地時間
  if (dateStr.includes('T')) {
    const d = new Date(dateStr);
    // 檢查是否為無效日期
    if (isNaN(d.getTime())) return dateStr.split('T')[0];
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // 如果已經是 YYYY-MM-DD 格式則直接回傳
  return dateStr.split(' ')[0];
};

/**
 * 從 Google Sheet 抓取所有紀錄 (支援傳回 rowIndex)
 */
export const fetchTransactionsFromSheet = async (url: string): Promise<Partial<Transaction>[]> => {
  if (!url) return [];
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    return data.map((row: any) => ({
      id: `sheet-${row.rowIndex}`,
      rowIndex: row.rowIndex,
      // 使用改進後的解析函數，修正 1 天的時間差
      date: parseLocalDate(row.date),
      merchant: row.merchant || '',
      item: row.item || '',
      category: row.category as Category,
      type: row.accountType as '公帳' | '私帳',
      payerId: row.payer || '', 
      currency: row.currency || '',
      originalAmount: Number(row.originalAmount) || 0,
      ntdAmount: Number(row.ntdAmount) || 0,
      isSplit: row.isSplit === '是',
      splitWith: row.splitWith ? row.splitWith.split(', ') : [],
      exchangeRate: row.originalAmount > 0 ? (row.ntdAmount / row.originalAmount) : undefined
    }));
  } catch (error) {
    console.error('Failed to fetch data:', error);
    return [];
  }
};

/**
 * 將交易紀錄傳送到 Google Sheet (新增)
 */
export const saveToGoogleSheet = async (url: string, transaction: Transaction, members: Member[]) => {
  if (!url) return;
  const payload = createPayload('ADD_TRANSACTION', transaction, members);
  try {
    await fetch(url, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
  } catch (e) { console.error(e); }
};

/**
 * 更新 Google Sheet 中的特定列 (修改)
 */
export const updateTransactionInSheet = async (url: string, transaction: Transaction, members: Member[]) => {
  if (!url || !transaction.rowIndex) return;
  const payload = createPayload('UPDATE_TRANSACTION', transaction, members);
  try {
    await fetch(url, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
  } catch (e) { console.error(e); }
};

/**
 * 從 Google Sheet 刪除特定列 (刪除)
 */
export const deleteTransactionFromSheet = async (url: string, rowIndex: number) => {
  if (!url || !rowIndex) return;
  try {
    await fetch(url, { 
      method: 'POST', 
      mode: 'no-cors', 
      body: JSON.stringify({ type: 'DELETE_TRANSACTION', rowIndex }) 
    });
  } catch (e) { console.error(e); }
};

const createPayload = (type: string, t: Transaction, members: Member[]) => {
  const payerName = members.find(m => m.id === t.payerId)?.name || t.payerId;
  
  const splitNames = t.splitWith
    .map(id => members.find(m => m.id === id)?.name || id)
    .join(', ');

  return {
    type,
    rowIndex: t.rowIndex,
    date: String(t.date).split('T')[0],
    merchant: t.merchant,
    item: t.item,
    category: t.category,
    accountType: t.type,
    payer: payerName,
    currency: t.currency,
    originalAmount: t.originalAmount,
    ntdAmount: t.ntdAmount,
    isSplit: t.isSplit ? '是' : '否',
    splitWith: splitNames,
    exchangeRate: t.exchangeRate
  };
};

export const syncExchangeRateToSheet = async (url: string, rate: number) => {
  if (!url) return;
  try {
    await fetch(url, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ type: 'UPDATE_RATE', rate }) });
    return true;
  } catch (e) { return false; }
};
