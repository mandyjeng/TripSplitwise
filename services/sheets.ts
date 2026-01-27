
import { Transaction, Member, Category, Ledger } from '../types';

/**
 * 從「主管理表」抓取所有帳本配置
 */
export const fetchManagementConfig = async (url: string): Promise<Ledger[]> => {
  if (!url) return [];
  
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const data = await response.json();

    if (data.error) {
      alert(`GAS 錯誤：${data.error}`);
      return [];
    }

    const rawLedgers = data.ledgers || [];
    return rawLedgers.map((l: any) => {
      // 容錯處理：找尋可能的原始連結欄位名稱
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
    console.error('Fetch management failed:', error);
    return [];
  }
};

const parseLocalDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr).split('T')[0];
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * 從「子帳本」抓取交易紀錄
 */
export const fetchTransactionsFromSheet = async (url: string): Promise<Partial<Transaction>[]> => {
  if (!url) return [];
  try {
    const response = await fetch(url, { cache: 'no-store' });
    const data = await response.json();
    const records = Array.isArray(data) ? data : (data.transactions || []);
    
    return records.map((row: any) => ({
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
    }));
  } catch (error) {
    console.error('Fetch transactions failed:', error);
    return [];
  }
};

export const saveToGoogleSheet = async (url: string, t: Transaction, members: Member[]) => {
  if (!url) return;
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
    '參與成員': t.splitWith.map(id => members.find(m => m.id === id)?.name || id).join(',')
  };
  try {
    await fetch(url, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
  } catch (e) { console.error(e); }
};

export const updateTransactionInSheet = async (url: string, t: Transaction, members: Member[]) => {
  if (!url || !t.rowIndex) return;
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
    '參與成員': t.splitWith.map(id => members.find(m => m.id === id)?.name || id).join(',')
  };
  try {
    await fetch(url, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
  } catch (e) { console.error(e); }
};

export const deleteTransactionFromSheet = async (url: string, rowIndex: number) => {
  if (!url) return;
  try {
    await fetch(url, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ type: 'DELETE_TRANSACTION', rowIndex }) });
  } catch (e) { console.error(e); }
};
