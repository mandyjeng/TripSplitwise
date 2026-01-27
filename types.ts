
export type Category = '住宿' | '交通' | '門票' | '用餐' | '雜項' | '保險' | '個人消費';

export interface Member {
  id: string;
  name: string;
}

export interface Ledger {
  id: string;
  name: string;
  url: string;
  sourceUrl?: string; // 新增：指向 Google Sheet 原始文件的連結
  currency: string;
  exchangeRate: number;
  members: string[];
}

export interface Transaction {
  id: string;
  rowIndex?: number;
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
  activeLedgerId: string;
  ledgers: Ledger[];
  members: Member[];
  transactions: Transaction[];
  exchangeRate: number;
  defaultCurrency: string;
  currentUser: string;
  theme?: 'comic' | 'fresh';
  /* sheetUrl tracks the Google Sheet Web App URL for the active ledger */
  sheetUrl?: string;
}
