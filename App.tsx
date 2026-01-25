
import React, { useState, useEffect, useCallback } from 'react';
import { AppState, Transaction, Category } from './types';
import { TABS } from './constants';
import Overview from './components/Overview';
import Details from './components/Details';
import Settings from './components/Settings';
import { saveToGoogleSheet, fetchTransactionsFromSheet } from './services/sheets';
import { RefreshCw, Sparkles, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [isInputActive, setIsInputActive] = useState(false); // 新增：追蹤輸入框是否被選取（鍵盤是否可能彈出）
  
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

  // 自動偵測輸入狀態以隱藏導覽列
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        setIsInputActive(true);
      }
    };
    const handleFocusOut = () => {
      setIsInputActive(false);
    };

    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);
    return () => {
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  const syncFromCloud = useCallback(async (silent = false) => {
    if (!state.sheetUrl) return;
    setIsSyncing(true);
    try {
      const cloudRecords = await fetchTransactionsFromSheet(state.sheetUrl);
      if (cloudRecords.length === 0) return;

      const namesInCloud = new Set<string>();
      cloudRecords.forEach(r => {
        if (r.payerId) namesInCloud.add(r.payerId);
        if (r.splitWith) r.splitWith.forEach(name => namesInCloud.add(name));
      });

      const updatedMembers = [...state.members];
      namesInCloud.forEach(name => {
        if (!updatedMembers.some(m => m.name === name)) {
          updatedMembers.push({ id: Math.random().toString(36).substr(2, 9), name: name });
        }
      });

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

  useEffect(() => {
    syncFromCloud(true);
  }, []);

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
      type: isSplit ? '公帳' : '私帳',
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
        return <Overview state={state} onAddTransaction={onAddTransaction} setIsAIProcessing={setIsAIProcessing} />;
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

  const currentUserObj = state.members.find(m => m.id === state.currentUser);
  const isGlobalLocked = isSyncing || isAIProcessing;

  // 導覽列隱藏邏輯：AI 處理中、雲端同步中、或使用者正在輸入時隱藏
  const shouldHideNav = isGlobalLocked || isInputActive;

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col relative bg-[#FDFCF8] overflow-x-hidden">
      {isGlobalLocked && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white border-[4px] border-black rounded-[2.5rem] p-8 comic-shadow flex flex-col items-center gap-5 scale-110">
            <div className="relative">
              <Sparkles size={48} className="text-[#F6D32D] animate-pulse" />
              <Loader2 size={24} className="absolute -bottom-1 -right-1 text-black animate-spin" />
            </div>
            <div className="flex flex-col items-center">
              <span className="font-black text-xl italic tracking-widest text-black">AI THINKING...</span>
              <span className="text-[10px] font-black text-slate-400 uppercase mt-1 tracking-widest">請稍候，正在為您整理帳目</span>
            </div>
          </div>
        </div>
      )}

      <header className="px-4 sm:px-6 py-8 bg-[#FDFCF8] sticky top-0 z-20">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-slate-900 flex items-center gap-2">
              TripSplit <span className="bg-[#F6D32D] text-sm px-3 py-1.5 rounded-full font-black border-2 border-black">AI</span>
            </h1>
            <p className="text-slate-400 text-sm font-black uppercase tracking-widest leading-none">極簡旅遊記帳</p>
            {isSyncing && (
              <div className="inline-flex mt-3 bg-black text-white px-3 py-1 rounded-full text-[10px] font-black uppercase items-center gap-2 animate-pulse border-2 border-black">
                <RefreshCw size={10} className="animate-spin" />
                雲端同步中
              </div>
            )}
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <div className="h-11 px-5 bg-[#F6D32D] border-[3px] border-black rounded-2xl flex items-center justify-center font-black text-base comic-shadow-sm whitespace-nowrap">
              {currentUserObj?.name}
            </div>
          </div>
        </div>
      </header>

      <main className={`flex-1 px-4 sm:px-6 pb-32 transition-opacity duration-300 ${isGlobalLocked ? 'opacity-50' : 'opacity-100'}`}>
        {renderContent()}
      </main>

      {/* 底部導覽列優化：增加 translate-y 隱藏動畫，且在 input 啟動時完全消失 */}
      <nav className={`fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-sm bg-white border-[3px] border-black rounded-[2.5rem] p-2 flex justify-between items-center z-40 shadow-2xl transition-all duration-300 transform ${
        shouldHideNav 
          ? 'translate-y-[200%] opacity-0 pointer-events-none' 
          : 'translate-y-0 opacity-100'
      }`}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center gap-1.5 transition-all flex-1 py-4 rounded-[2rem] ${activeTab === tab.id ? 'bg-black text-white shadow-lg' : 'text-slate-300'}`}
          >
            {React.cloneElement(tab.icon as React.ReactElement<any>, { size: 24 })}
            <span className="text-xs font-black uppercase tracking-widest">
              {tab.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
