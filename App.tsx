
import React, { useState, useEffect, useCallback } from 'react';
import { AppState, Transaction, Category } from './types';
import { TABS } from './constants';
import Overview from './components/Overview';
import Details from './components/Details';
import Settings from './components/Settings';
import { saveToGoogleSheet, fetchTransactionsFromSheet } from './services/sheets';
// Fix: Import missing RefreshCw icon from lucide-react
import { RefreshCw } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isSyncing, setIsSyncing] = useState(false);
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('trip_split_state');
    if (saved) return JSON.parse(saved);
    return {
      members: [{ id: '1', name: 'mandy' }],
      transactions: [],
      exchangeRate: 35.5,
      defaultCurrency: 'CHF',
      currentUser: '1',
      sheetUrl: 'https://script.google.com/macros/s/AKfycbyJbyRJv0sXY1Dm8mcRcsvmCIxWhcRsdGzwFNF6RjGWNnZHMi0wcpAAjmAshG2OujWdhw/exec'
    };
  });

  const updateState = (updates: Partial<AppState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const syncFromCloud = useCallback(async (silent = false) => {
    if (!state.sheetUrl) return;
    setIsSyncing(true);
    try {
      const cloudRecords = await fetchTransactionsFromSheet(state.sheetUrl);
      if (cloudRecords.length === 0) return;

      // 取得雲端出現的所有姓名
      const namesInCloud = new Set<string>();
      cloudRecords.forEach(r => {
        if (r.payerId) namesInCloud.add(r.payerId);
        if (r.splitWith) r.splitWith.forEach(name => namesInCloud.add(name));
      });

      // 更新成員列表，避免重複並保留 ID
      const updatedMembers = [...state.members];
      namesInCloud.forEach(name => {
        if (!updatedMembers.some(m => m.name === name)) {
          updatedMembers.push({ id: Math.random().toString(36).substr(2, 9), name: name });
        }
      });

      // 格式化交易紀錄中的 ID 對應
      const formattedTransactions = cloudRecords.map(r => {
        const payer = updatedMembers.find(m => m.name === r.payerId);
        const splitIds = r.splitWith?.map(name => updatedMembers.find(m => m.name === name)?.id).filter(Boolean) as string[];
        
        return {
          ...r,
          payerId: payer?.id || updatedMembers[0].id,
          splitWith: splitIds || [],
          exchangeRate: r.exchangeRate || state.exchangeRate
        } as Transaction;
      });

      updateState({ 
        transactions: formattedTransactions, 
        members: updatedMembers 
      });
      
      if (!silent) console.log(`已自動更新 ${formattedTransactions.length} 筆資料`);
    } catch (e) {
      console.error('Auto sync failed:', e);
    } finally {
      setIsSyncing(false);
    }
  }, [state.sheetUrl, state.members, state.exchangeRate]);

  // 初始化自動載入
  useEffect(() => {
    syncFromCloud(true);
  }, []); // 僅在初次掛載執行

  useEffect(() => {
    localStorage.setItem('trip_split_state', JSON.stringify(state));
  }, [state]);

  const onAddTransaction = async (t: Partial<Transaction>) => {
    const isSplit = t.isSplit ?? true;
    const payerId = t.payerId || state.currentUser;
    
    let category = t.category || '雜項';
    if (!isSplit && category === '雜項') {
      category = '個人消費';
    }

    const splitWith = isSplit 
      ? (t.splitWith || state.members.map(m => m.id)) 
      : [payerId];

    const sanitizedDate = (t.date || new Date().toISOString()).split('T')[0];

    const newTransaction: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      date: sanitizedDate,
      item: t.item || '未命名項目',
      merchant: t.merchant || '未知店家',
      category: category as Category,
      type: isSplit ? '公帳' : '私帳', // 根據是否拆帳決定類型
      payerId: payerId,
      currency: t.currency || state.defaultCurrency,
      originalAmount: t.originalAmount || 0,
      ntdAmount: t.ntdAmount || 0,
      splitWith: splitWith,
      isSplit: isSplit,
      exchangeRate: t.exchangeRate || state.exchangeRate,
    };

    updateState({ transactions: [newTransaction, ...state.transactions] });
    if (state.sheetUrl) {
      saveToGoogleSheet(state.sheetUrl, newTransaction, state.members);
    }
    setActiveTab('overview');
  };

  const onDeleteTransaction = (id: string) => {
    updateState({ transactions: state.transactions.filter(t => t.id !== id) });
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <Overview state={state} onAddTransaction={onAddTransaction} />;
      case 'details':
        return (
          <Details 
            state={state} 
            onDeleteTransaction={onDeleteTransaction} 
            updateState={updateState}
            onSync={() => syncFromCloud(false)}
            isSyncing={isSyncing}
          />
        );
      case 'settings':
        return <Settings state={state} updateState={updateState} />;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col relative bg-[#FDFCF8] overflow-x-hidden">
      <header className="px-6 py-6 flex justify-between items-center bg-[#FDFCF8] sticky top-0 z-20">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            TripSplit <span className="bg-[#F6D32D] text-xs px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-black">AI</span>
          </h1>
          <p className="text-slate-400 text-[10px] mt-0.5 font-black uppercase tracking-widest">極簡旅遊記帳</p>
        </div>
        <div className="flex -space-x-2">
          {state.members.slice(0, 4).map((m, i) => (
            <div 
              key={m.id} 
              className="h-9 px-3 rounded-full border-2 border-black bg-[#F6D32D] flex items-center justify-center text-black font-black text-[10px] shadow-sm whitespace-nowrap"
              style={{ zIndex: state.members.length - i }}
            >
              {m.name}
            </div>
          ))}
        </div>
      </header>

      {isSyncing && (
        <div className="absolute top-20 left-0 right-0 z-30 flex justify-center pointer-events-none">
          <div className="bg-black text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-bounce comic-border">
            <RefreshCw size={10} className="animate-spin" />
            同步資料中...
          </div>
        </div>
      )}

      <main className="flex-1 px-6 pb-32">
        {renderContent()}
      </main>

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-white border-2 border-black rounded-3xl p-2 flex justify-between items-center z-40 shadow-xl">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center gap-1 transition-all flex-1 py-2 rounded-2xl ${activeTab === tab.id ? 'bg-black text-white' : 'text-slate-400'}`}
          >
            {React.cloneElement(tab.icon as React.ReactElement<any>, { size: 18 })}
            <span className="text-[9px] font-black uppercase tracking-widest">
              {tab.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
