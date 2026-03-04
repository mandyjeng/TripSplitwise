
export type Category = string;

export interface Member {
  id: string;
  name: string;
}

export interface Ledger {
  id: string;
  name: string;
  url: string;
  sourceUrl?: string;
  currency: string;
  exchangeRate: number;
  members: string[];
  isVisible?: boolean;
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
  customSplits?: Record<string, number>; // 台幣分帳金額
  customOriginalSplits?: Record<string, number>; // 新增：原始幣別分帳金額 (確保外幣不被改掉)
  isSplit: boolean;
  exchangeRate: number;
}

export interface AppState {
  activeLedgerId: string;
  ledgers: Ledger[];
  members: Member[];
  categories: Category[];
  transactions: Transaction[];
  exchangeRate: number;
  defaultCurrency: string;
  currentUser: string;
  theme?: 'comic' | 'fresh';
  sheetUrl?: string;
}
