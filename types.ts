
export type Category = '住宿' | '交通' | '門票' | '用餐' | '雜項' | '保險' | '個人消費';

export interface Member {
  id: string;
  name: string;
}

export interface Transaction {
  id: string;
  rowIndex?: number; // 新增：對應 Google Sheet 的行號
  date: string;
  item: string;
  merchant: string;
  category: Category;
  type: '公帳' | '私帳';
  payerId: string;
  currency: string;
  originalAmount: number;
  ntdAmount: number;
  splitWith: string[];
  isSplit: boolean;
  exchangeRate: number;
}

export interface AppState {
  members: Member[];
  transactions: Transaction[];
  exchangeRate: number;
  defaultCurrency: string; // 新增：預設外幣幣別
  currentUser: string;
  sheetUrl?: string;
  theme?: 'comic' | 'fresh'; // 新增：主題設定
}
