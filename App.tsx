
import React, { useState, useEffect, useCallback } from 'react';
import { AppState, Transaction, Category, Member, Ledger } from './types';
import { TABS, MASTER_GAS_URL } from './constants';
import Overview from './components/Overview';
import Details from './components/Details';
import Settings from './components/Settings';
import { fetchManagementConfig, fetchTransactionsFromSheet, saveToGoogleSheet, deleteTransactionFromSheet } from './services/sheets';
import { Sparkles } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [initialEditId, setInitialEditId] = useState<string | null>(null);
  
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('trip_split_master_state_v2');
    if (saved) return JSON.parse(saved);
    return {
      activeLedgerId: '',
      ledgers: [],
      members: [], 
      transactions: [],
      exchangeRate: 1,
      defaultCurrency: 'TWD',
      currentUser: '',
      theme: 'comic'
    };
  });

  const updateState = (updates: Partial<AppState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const syncLedgerData = useCallback(async (ledger: Ledger) => {
    setIsSyncing(true);
    try {
      const records = await fetchTransactionsFromSheet(ledger.url);
      let ledgerMembers: Member[] = ledger.members.map(name => ({ id: name, name }));
      if (ledgerMembers.length === 0) {
        ledgerMembers = [{ id: '訪客', name: '訪客' }];
      }

      const ledgerCurrency = ledger.currency || 'JPY';
      const sanitizedRecords = records.map(r => {
        let finalCurrency = r.currency || ledgerCurrency;
        if (r.originalAmount === 0 && r.ntdAmount > 0 && finalCurrency === 'TWD' && ledgerCurrency !== 'TWD') {
          finalCurrency = ledgerCurrency;
        }
        return { ...r, currency: finalCurrency };
      });

      let nextCurrentUser = state.currentUser;
      const isUserStillValid = ledgerMembers.some(m => m.id === state.currentUser);
      if (!isUserStillValid || !state.currentUser) {
        nextCurrentUser = ledgerMembers[0].id;
      }

      updateState({
        transactions: sanitizedRecords as Transaction[],
        members: ledgerMembers,
        exchangeRate: ledger.exchangeRate || 1,
        defaultCurrency: ledgerCurrency,
        activeLedgerId: ledger.id,
        currentUser: nextCurrentUser,
        sheetUrl: ledger.url
      });
    } catch (e) {
      console.error(e);
      alert('子帳本資料載入失敗');
    } finally {
      setIsSyncing(false);
    }
  }, [state.currentUser]);

  const loadManagement = useCallback(async () => {
    setIsSyncing(true);
    try {
      const ledgers = await fetchManagementConfig(MASTER_GAS_URL);
      if (ledgers.length > 0) {
        const savedId = localStorage.getItem('last_active_ledger_id');
        const active = ledgers.find(l => l.id === savedId) || ledgers[0];
        updateState({ ledgers });
        await syncLedgerData(active);
      }
    } catch (e) {
      console.error(e);
      alert('無法取得帳本列表');
    } finally {
      setIsSyncing(false);
    }
  }, [syncLedgerData]);

  useEffect(() => { loadManagement(); }, []);

  useEffect(() => {
    localStorage.setItem('trip_split_master_state_v2', JSON.stringify(state));
    if (state.activeLedgerId) {
      localStorage.setItem('last_active_ledger_id', state.activeLedgerId);
    }
  }, [state]);

  const onAddTransaction = async (t: Partial<Transaction>) => {
    const activeLedger = state.ledgers.find(l => l.id === state.activeLedgerId);
    if (!activeLedger) return;

    const isSplit = t.isSplit ?? true;
    const payerId = t.payerId || state.currentUser;
    const splitWith = isSplit ? (t.splitWith || state.members.map(m => m.id)) : [payerId];

    const newTransaction: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      date: t.date || new Date().toISOString().split('T')[0],
      item: t.item || '未命名項目',
      merchant: t.merchant || '未知店家',
      category: (t.category || '雜項') as Category,
      type: isSplit ? '公帳' : '私帳',
      payerId: payerId,
      currency: t.currency || state.defaultCurrency || 'JPY',
      originalAmount: t.originalAmount || 0,
      ntdAmount: t.ntdAmount || 0,
      splitWith: splitWith,
      isSplit: isSplit,
      exchangeRate: state.exchangeRate,
    };

    updateState({ transactions: [newTransaction, ...state.transactions] });
    saveToGoogleSheet(activeLedger.url, newTransaction, state.members);
    setActiveTab('overview');
  };

  const onDeleteTransaction = async (id: string) => {
    const t = state.transactions.find(item => item.id === id);
    if (!t) return;

    updateState({ transactions: state.transactions.filter(item => item.id !== id) });
    
    if (state.sheetUrl && t.rowIndex !== undefined) {
      await deleteTransactionFromSheet(state.sheetUrl, t.rowIndex);
    }

    setActiveTab('details');
  };

  const onEditFromOverview = (id: string) => {
    setInitialEditId(id);
    setActiveTab('details');
  };

  const activeLedger = state.ledgers.find(l => l.id === state.activeLedgerId);
  const isGlobalLocked = isSyncing || isAIProcessing;

  return (
    <div className={`max-w-md mx-auto min-h-screen flex flex-col relative overflow-x-hidden theme-${state.theme || 'comic'}`}>
      {isGlobalLocked && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white border-[4px] border-black rounded-[2.5rem] p-8 comic-shadow flex flex-col items-center gap-5">
            <Sparkles size={48} className="text-[#F6D32D] animate-pulse" />
            <div className="text-center font-black">圖片資料辨識AI辨識中...</div>
          </div>
        </div>
      )}

      <header className="px-6 py-8 sticky top-0 z-20">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-slate-900 flex items-center gap-2">
              {activeLedger?.name || '載入中...'} <span className="bg-[#F6D32D] text-sm px-3 py-1.5 rounded-full border-2 border-black font-black italic">Go!</span>
            </h1>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest leading-none">
               TripSplit AI 記帳助手
            </p>
          </div>
          <div className="h-11 px-5 bg-[#F6D32D] border-[3px] border-black rounded-2xl flex items-center justify-center font-black comic-shadow-sm truncate max-w-[120px]">
            {state.currentUser || '...'}
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 pb-32">
        {activeTab === 'overview' && (
          <Overview 
            state={state} 
            onAddTransaction={onAddTransaction} 
            setIsAIProcessing={setIsAIProcessing} 
            onEditTransaction={onEditFromOverview}
          />
        )}
        {activeTab === 'details' && (
          <Details 
            state={state} 
            onDeleteTransaction={onDeleteTransaction} 
            updateState={updateState} 
            onSync={() => activeLedger && syncLedgerData(activeLedger)} 
            isSyncing={isSyncing} 
            initialEditId={initialEditId}
            onClearInitialEdit={() => setInitialEditId(null)}
          />
        )}
        {activeTab === 'settings' && <Settings state={state} updateState={updateState} onReloadManagement={loadManagement} onSwitchLedger={syncLedgerData} />}
      </main>

      <nav className={`fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-sm bg-white border-[3px] border-black rounded-[2.5rem] p-2 flex justify-between items-center z-40 shadow-2xl transition-all duration-300 ${isGlobalLocked ? 'translate-y-[200%] opacity-0' : 'translate-y-0 opacity-100'}`}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center gap-1.5 transition-all flex-1 py-4 rounded-[2rem] ${activeTab === tab.id ? 'bg-black text-white' : 'text-slate-300'}`}>
            {React.cloneElement(tab.icon as React.ReactElement<any>, { size: 24 })}
            <span className="text-xs font-black uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
