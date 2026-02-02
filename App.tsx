
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Transaction, Category, Member, Ledger } from './types';
import { TABS, MASTER_GAS_URL } from './constants';
import Overview from './components/Overview';
import Details from './components/Details';
import Settings from './components/Settings';
import { fetchManagementConfig, fetchTransactionsFromSheet, saveToGoogleSheet, deleteTransactionFromSheet } from './services/sheets';
import { Sparkles, MapPin, AlertCircle } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [initialEditId, setInitialEditId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  
  const [showNav, setShowNav] = useState(true);
  const lastScrollY = useRef(0);

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

  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled Rejection:', event.reason);
      if (String(event.reason).includes('Failed to fetch')) {
        setGlobalError('網路連線失敗，請檢查您的網路環境或 API 網址是否正確。');
      }
    };
    window.addEventListener('unhandledrejection', handleRejection);
    return () => window.removeEventListener('unhandledrejection', handleRejection);
  }, []);

  const syncLedgerData = useCallback(async (ledger: Ledger, isManual: boolean = false) => {
    if (isManual) setIsRefreshing(true);
    else setIsSyncing(true);
    setGlobalError(null);
    
    try {
      let ledgerMembers: Member[] = ledger.members.map(name => ({ id: name, name }));
      if (ledgerMembers.length === 0) {
        ledgerMembers = [{ id: '訪客', name: '訪客' }];
      }

      const records = await fetchTransactionsFromSheet(ledger.url, ledgerMembers);
      
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
    } catch (e: any) {
      console.error(e);
      setGlobalError(e.message || '子帳本資料載入失敗');
    } finally {
      setIsRefreshing(false);
      setIsSyncing(false);
    }
  }, [state.currentUser]);

  const loadManagement = useCallback(async () => {
    setIsSyncing(true);
    setGlobalError(null);
    try {
      const ledgers = await fetchManagementConfig(MASTER_GAS_URL);
      if (ledgers.length > 0) {
        const savedId = localStorage.getItem('last_active_ledger_id');
        const active = ledgers.find(l => l.id === savedId) || ledgers[0];
        updateState({ ledgers });
        await syncLedgerData(active, false);
      }
    } catch (e: any) {
      console.error(e);
      setGlobalError(e.message || '無法取得帳本列表');
    } finally {
      setIsSyncing(false);
    }
  }, [syncLedgerData]);

  useEffect(() => { loadManagement(); }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setShowNav(false);
      } else {
        setShowNav(true);
      }
      lastScrollY.current = currentScrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    localStorage.setItem('trip_split_master_state_v2', JSON.stringify(state));
    if (state.activeLedgerId) {
      localStorage.setItem('last_active_ledger_id', state.activeLedgerId);
    }
  }, [state]);

  const onAddTransaction = async (t: Partial<Transaction>) => {
    const activeLedger = state.ledgers.find(l => l.id === state.activeLedgerId);
    if (!activeLedger) return;

    setIsMutating(true);
    const isSplit = t.isSplit ?? true;
    const payerId = t.payerId || state.currentUser;
    const splitWith = isSplit ? (t.splitWith || state.members.map(m => m.id)) : [payerId];
    const finalType = splitWith.length === 1 ? '私帳' : (t.type || '公帳');

    const newTransaction: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      date: t.date || new Date().toISOString().split('T')[0],
      item: t.item || '未命名項目',
      merchant: t.merchant || '未知店家',
      category: (t.category || '雜項') as Category,
      type: finalType as '公帳' | '私帳',
      payerId: payerId,
      currency: t.currency || state.defaultCurrency || 'JPY',
      originalAmount: t.originalAmount || 0,
      ntdAmount: t.ntdAmount || 0,
      splitWith: splitWith,
      customSplits: t.customSplits,
      customOriginalSplits: t.customOriginalSplits,
      isSplit: isSplit,
      exchangeRate: state.exchangeRate,
    };

    try {
      await saveToGoogleSheet(activeLedger.url, newTransaction, state.members);
      setState(prev => ({
        ...prev,
        transactions: [newTransaction, ...prev.transactions]
      }));
      setActiveTab('overview');
      setShowNav(true);
    } catch (err) {
      alert('雲端同步失敗。');
    } finally {
      setIsMutating(false);
    }
  };

  /**
   * 修正後的刪除函式
   */
  const onDeleteTransaction = async (id: string) => {
    const target = state.transactions.find(t => t.id === id);
    if (!target) {
      console.error('[App] 刪除失敗：找不到該筆交易', id);
      return;
    }
    
    setIsMutating(true);
    try {
      const ledgerUrl = state.sheetUrl || state.ledgers.find(l => l.id === state.activeLedgerId)?.url;
      if (ledgerUrl && typeof target.rowIndex === 'number') {
        await deleteTransactionFromSheet(ledgerUrl, target.rowIndex);
      }
      setState(prev => ({
        ...prev,
        transactions: prev.transactions.filter(t => t.id !== id)
      }));
    } catch (err) {
      console.error('[App] 刪除過程出錯:', err);
      alert('雲端刪除失敗，請確認網路連線。');
    } finally {
      setIsMutating(false);
    }
  };

  const onEditFromOverview = (id: string) => {
    setInitialEditId(id);
    setActiveTab('details');
    setShowNav(true);
  };

  const handleJumpToUserSelection = () => {
    if (isSyncing || isRefreshing || isAIProcessing || isMutating) return;
    setActiveTab('settings');
    setShowNav(true);
    setTimeout(() => {
      const element = document.getElementById('user-selection-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
  };

  const activeLedger = state.ledgers.find(l => l.id === state.activeLedgerId);
  const isGlobalLocked = isSyncing || isAIProcessing || isRefreshing || isMutating;
  
  const getLoadingMessage = () => {
    if (isAIProcessing) return "讓 AI 想一想...";
    if (isRefreshing) return "帳本同步中...";
    if (isMutating) return "資料處理中...";
    return "連線雲端中...";
  };

  return (
    <div className={`max-w-md mx-auto min-h-screen flex flex-col relative overflow-x-hidden theme-${state.theme || 'comic'}`}>
      {isGlobalLocked && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border-[4px] border-black rounded-[2.5rem] p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center gap-5">
            <Sparkles size={48} className="text-[#F6D32D] animate-bounce" />
            <div className="text-center font-black text-xl tracking-tight">{getLoadingMessage()}</div>
          </div>
        </div>
      )}

      {globalError && (
        <div className="mx-6 mt-4 p-4 bg-[#FEF2F2] border-[3px] border-[#E64A4A] rounded-2xl flex items-start gap-3 animate-in slide-in-from-top duration-300">
          <AlertCircle className="text-[#E64A4A] shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="text-sm font-black text-[#E64A4A] leading-tight mb-2">{globalError}</p>
            <button onClick={() => loadManagement()} className="text-xs font-black bg-white border-2 border-black px-4 py-1.5 rounded-lg active:translate-y-0.5 transition-all">重新載入</button>
          </div>
          <button onClick={() => setGlobalError(null)} className="text-[#E64A4A] opacity-50"><X size={18} /></button>
        </div>
      )}

      <header className="px-6 py-8 sticky top-0 z-20">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-slate-900 leading-tight italic tracking-tighter">
              {activeLedger?.name || '載入中...'} 
            </h1>
            <div className="flex items-center gap-2 text-slate-500">
               <MapPin size={12} className="text-blue-500 fill-current opacity-80" />
               <p className="text-xs font-black uppercase tracking-[0.25em] leading-none opacity-80">Adventure Journal</p>
            </div>
          </div>
          
          <button 
            onClick={handleJumpToUserSelection}
            disabled={isGlobalLocked}
            className="group relative"
          >
            <div className="absolute inset-0 bg-black rounded-2xl translate-x-1 translate-y-1 group-active:translate-x-0 group-active:translate-y-0 transition-all"></div>
            <div className="relative h-12 px-6 bg-[#F6D32D] border-[3px] border-black rounded-2xl flex items-center justify-center font-black truncate max-w-[130px] transition-all hover:bg-yellow-300 disabled:opacity-50 text-base">
              {state.currentUser || '...'}
            </div>
          </button>
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
            onSync={() => activeLedger && syncLedgerData(activeLedger, true)} 
            isSyncing={isSyncing || isRefreshing} 
            initialEditId={initialEditId}
            onClearInitialEdit={() => setInitialEditId(null)}
            setIsMutating={setIsMutating}
          />
        )}
        {activeTab === 'settings' && <Settings state={state} updateState={updateState} onReloadManagement={loadManagement} onSwitchLedger={(l) => syncLedgerData(l, false)} />}
      </main>

      <nav className={`fixed bottom-6 left-1/2 -translate-x-1/2 w-[85%] max-w-[320px] bg-white border-[3px] border-black rounded-full p-1.5 flex justify-between items-center z-40 transition-all duration-500 ease-in-out ${
        (isGlobalLocked || !showNav) 
          ? 'translate-y-[200%] opacity-0 scale-90' 
          : 'translate-y-0 opacity-100 scale-100 comic-shadow'
      }`}>
        {TABS.map(tab => (
          <button 
            key={tab.id} 
            onClick={() => {
              setActiveTab(tab.id);
              setShowNav(true);
            }} 
            className={`flex flex-col items-center gap-1.5 transition-all flex-1 py-3 rounded-full ${
              activeTab === tab.id 
                ? 'bg-black text-white' 
                : 'text-slate-300 hover:text-slate-400'
            }`}
          >
            {React.cloneElement(tab.icon as React.ReactElement<any>, { size: 20 })}
            <span className="text-xs font-black uppercase tracking-widest leading-none">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

const X = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);

export default App;
