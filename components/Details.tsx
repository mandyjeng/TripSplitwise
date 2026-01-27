
import React, { useState, useEffect } from 'react';
import { Transaction, Member, Category, AppState } from '../types';
import { CATEGORIES, CATEGORY_ICONS, CATEGORY_COLORS } from '../constants';
import { Search, Trash2, Calendar, RefreshCw, X, Save, Clock, Loader2 } from 'lucide-react';
import { updateTransactionInSheet } from '../services/sheets';

interface DetailsProps {
  state: AppState;
  onDeleteTransaction: (id: string) => Promise<void>;
  updateState: (updates: any) => void;
  onSync: () => void;
  isSyncing: boolean;
  initialEditId?: string | null;
  onClearInitialEdit?: () => void;
}

const Details: React.FC<DetailsProps> = ({ state, onDeleteTransaction, updateState, onSync, isSyncing, initialEditId, onClearInitialEdit }) => {
  const [filterCategory, setFilterCategory] = useState<Category | '全部'>('全部');
  const [filterMemberId, setFilterMemberId] = useState<string | '全部'>('全部');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingItem, setEditingItem] = useState<Transaction | null>(null);

  // 支援從其他分頁跳轉過來直接開啟編輯
  useEffect(() => {
    if (initialEditId) {
      const target = state.transactions.find(t => t.id === initialEditId);
      if (target) {
        setEditingItem(target);
      }
      onClearInitialEdit?.();
    }
  }, [initialEditId, state.transactions, onClearInitialEdit]);

  const handleSaveEdit = async () => {
    if (!editingItem || isSaving || isDeleting) return;
    setIsSaving(true);
    try {
      const newList = state.transactions.map(t => t.id === editingItem.id ? { ...editingItem } : t);
      updateState({ transactions: newList });

      if (state.sheetUrl && editingItem.rowIndex !== undefined) {
        await updateTransactionInSheet(state.sheetUrl, editingItem, state.members);
      }
      setEditingItem(null);
    } catch (error) {
      console.error('Save failed:', error);
      alert('儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (t: Transaction) => {
    if (!confirm(`確定要刪除「${t.merchant}」嗎？`) || isDeleting || isSaving) return;
    setIsDeleting(true);
    try {
      await onDeleteTransaction(t.id);
      setEditingItem(null);
    } catch (error) {
      console.error('Delete failed:', error);
      alert('刪除失敗');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAmountChange = (val: number) => {
    if (!editingItem) return;
    const rate = editingItem.exchangeRate || state.exchangeRate;
    const newNtd = editingItem.currency === 'TWD' ? val : Math.round(val * rate);
    setEditingItem({
      ...editingItem,
      originalAmount: val,
      ntdAmount: newNtd
    });
  };

  const toggleSplitMember = (memberId: string) => {
    if (!editingItem) return;
    const currentSplit = editingItem.splitWith || [];
    const newSplit = currentSplit.includes(memberId)
      ? currentSplit.filter(id => id !== memberId)
      : [...currentSplit, memberId];
    
    if (newSplit.length === 0) return;

    const isSplit = newSplit.length > 1;
    let newCategory = editingItem.category;
    
    if (isSplit && newCategory === '個人消費') {
      newCategory = '雜項';
    } else if (!isSplit) {
      newCategory = '個人消費';
    }

    setEditingItem({ 
      ...editingItem, 
      splitWith: newSplit,
      isSplit: isSplit,
      type: isSplit ? '公帳' : '私帳',
      category: newCategory
    });
  };

  const filteredTransactions = state.transactions
    .filter(t => filterCategory === '全部' || t.category === filterCategory)
    .filter(t => {
      if (filterMemberId === '全部') return true;
      return t.payerId === filterMemberId || (t.isSplit && t.splitWith.includes(filterMemberId));
    })
    .filter(t => 
      t.item.toLowerCase().includes(searchQuery.toLowerCase()) || 
      t.merchant.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const dates = Array.from(new Set(filteredTransactions.map(t => t.date)));

  const isAnyActionRunning = isSaving || isDeleting;

  return (
    <div className="space-y-6 pb-24">
      <div className="sticky top-0 bg-[#FDFCF8]/95 backdrop-blur-md pt-1 pb-4 z-10 border-b-2 border-dashed border-slate-200">
        <div className="flex gap-2.5 mb-3.5">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text"
              placeholder="搜尋店家或項目..."
              className="w-full bg-white comic-border rounded-2xl py-3.5 pl-11 pr-4 text-base font-bold focus:outline-none shadow-sm"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={onSync}
            disabled={isSyncing}
            className="bg-[#F6D32D] comic-border w-13 rounded-2xl flex items-center justify-center comic-shadow-sm active:translate-y-1 transition-all disabled:opacity-50 shrink-0"
          >
            <RefreshCw size={22} className={isSyncing ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {['全部', ...CATEGORIES].map(c => (
              <button 
                key={c}
                onClick={() => setFilterCategory(c as any)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black border-2 whitespace-nowrap transition-all ${
                  filterCategory === c 
                    ? 'bg-black text-white border-black shadow-sm' 
                    : 'bg-white text-black border-black/10 hover:border-black'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="flex flex-nowrap gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <button 
              onClick={() => setFilterMemberId('全部')}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black border-2 transition-all whitespace-nowrap flex-shrink-0 ${
                filterMemberId === '全部' ? 'bg-[#F6D32D] border-black shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-400'
              }`}
            >
              所有人
            </button>
            {state.members.map(m => (
              <button 
                key={m.id}
                onClick={() => setFilterMemberId(m.id)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black border-2 transition-all whitespace-nowrap flex-shrink-0 ${
                  filterMemberId === m.id ? 'bg-[#F6D32D] border-black shadow-sm text-black' : 'bg-slate-50 border-slate-100 text-slate-400'
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {dates.length > 0 ? (
          dates.map(date => (
            <div key={date} className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="bg-white comic-border px-3 py-1.5 rounded-xl comic-shadow-sm flex items-center gap-1.5">
                  <Calendar size={16} strokeWidth={3} className="text-black" />
                  <span className="text-[12px] font-black uppercase tracking-widest whitespace-nowrap text-black">{date}</span>
                </div>
                <div className="flex-1 h-[2px] bg-slate-200 rounded-full"></div>
              </div>
              
              <div className="space-y-5">
                {filteredTransactions.filter(t => t.date === date).map(t => {
                  const displayCurrency = t.currency || state.defaultCurrency;
                  const shouldShowOriginal = t.originalAmount > 0 || displayCurrency !== 'TWD';

                  return (
                    <div 
                      key={t.id} 
                      onClick={() => setEditingItem(t)}
                      className="bg-white comic-border p-3.5 sm:p-6 rounded-[1.75rem] sm:rounded-[2rem] flex flex-col gap-4 comic-shadow hover:translate-x-1 hover:-translate-y-1 transition-all cursor-pointer relative group"
                    >
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className={`w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl border-[3px] border-black flex items-center justify-center shrink-0 mt-0.5 ${CATEGORY_COLORS[t.category].split(' ')[0]}`}>
                          {React.cloneElement(CATEGORY_ICONS[t.category] as React.ReactElement<any>, { size: 20 })}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-base sm:text-lg text-black truncate leading-tight">{t.merchant}</span>
                              {!t.isSplit ? (
                                <span className="shrink-0 bg-pink-100 text-pink-700 text-[9px] font-black px-1.5 py-0.5 rounded-md border-2 border-pink-200">個人</span>
                              ) : (
                                <span className="shrink-0 bg-blue-100 text-blue-700 text-[9px] font-black px-1.5 py-0.5 rounded-md border-2 border-blue-200">{t.splitWith.length}人</span>
                              )}
                            </div>
                            <div className="text-[12px] sm:text-sm font-bold text-slate-700 leading-snug whitespace-pre-line line-clamp-2">{t.item}</div>
                          </div>
                        </div>

                        <div className="text-right shrink-0 ml-1">
                          {shouldShowOriginal && (
                            <div className="text-[10px] font-bold text-slate-500 italic uppercase mb-0.5">
                              {t.originalAmount} {displayCurrency}
                            </div>
                          )}
                          <div className="font-black text-base sm:text-xl text-black leading-none">
                            <span className="text-[11px] mr-0.5 font-bold">NT$</span>
                            {Math.round(t.ntdAmount).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t-2 border-slate-100 flex flex-col gap-3">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="flex items-center gap-1.5 text-[11px] sm:text-base font-black text-black bg-slate-100 px-2.5 py-1.5 rounded-lg border-2 border-slate-200">
                            <div className="w-5 h-5 rounded bg-[#F6D32D] comic-border flex items-center justify-center text-black text-[9px] font-black">
                              {state.members.find(m => m.id === t.payerId)?.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="truncate max-w-[50px] sm:max-w-none">{state.members.find(m => m.id === t.payerId)?.name}</span>
                          </div>
                          <div className="h-4 w-[2px] bg-slate-200 mx-0.5"></div>
                          <div className="flex flex-wrap gap-1 items-center flex-1 overflow-hidden">
                            <span className="text-[10px] sm:text-sm font-black text-black shrink-0">分給:</span>
                            <div className="flex flex-wrap gap-1">
                              {t.isSplit && t.splitWith.length === state.members.length ? (
                                <span className="text-[9px] sm:text-sm font-black text-black bg-white border-2 border-slate-300 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                                  全部
                                </span>
                              ) : (
                                t.splitWith.map(mid => (
                                  <span key={mid} className="text-[9px] sm:text-sm font-black text-black bg-white border-2 border-slate-300 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                                    {state.members.find(m => m.id === mid)?.name}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="py-24 text-center">
            <p className="text-slate-400 font-black italic text-2xl tracking-widest uppercase opacity-50">Empty Records</p>
          </div>
        )}
      </div>

      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white comic-border rounded-[2rem] sm:rounded-[3rem] w-full max-w-sm p-4 sm:p-7 comic-shadow relative overflow-hidden">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg sm:text-2xl font-black italic flex items-center gap-2 text-slate-900">
                <Clock className="text-[#F6D32D]" size={20} strokeWidth={3} /> 修改明細
              </h3>
              <button 
                disabled={isAnyActionRunning}
                onClick={() => setEditingItem(null)} 
                className="p-2.5 bg-slate-50 rounded-full text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-30"
              >
                <X size={22} strokeWidth={3} />
              </button>
            </div>
            
            <div className="space-y-3 max-h-[70vh] overflow-y-auto no-scrollbar pb-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-slate-50 p-2 rounded-xl border-[3px] border-black">
                  <label className="text-[9px] font-black text-slate-400 mb-0.5 block uppercase tracking-wider">日期</label>
                  <input 
                    type="date"
                    disabled={isAnyActionRunning}
                    className="w-full bg-transparent font-black text-[13px] sm:text-base outline-none p-0 text-slate-950 disabled:opacity-50"
                    value={editingItem.date}
                    onChange={e => setEditingItem({...editingItem, date: e.target.value})}
                  />
                </div>
                <div className="bg-slate-50 p-2 rounded-xl border-[3px] border-black">
                  <label className="text-[9px] font-black text-slate-400 mb-0.5 block uppercase tracking-wider">店家</label>
                  <input 
                    disabled={isAnyActionRunning}
                    className="w-full bg-transparent font-black text-[13px] sm:text-base outline-none p-0 text-slate-950 disabled:opacity-50"
                    value={editingItem.merchant}
                    onChange={e => setEditingItem({...editingItem, merchant: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-[#FFFDF0] p-2 rounded-xl border-[3px] border-[#E64A4A]">
                  <label className="text-[9px] font-black text-[#E64A4A] mb-0.5 block uppercase tracking-tighter">台幣金額</label>
                  <input 
                    type="number"
                    disabled={isAnyActionRunning}
                    className="w-full bg-transparent font-black text-base sm:text-xl outline-none p-0 text-slate-950 disabled:opacity-50"
                    value={editingItem.ntdAmount === 0 ? '' : editingItem.ntdAmount}
                    onChange={e => setEditingItem({...editingItem, ntdAmount: e.target.value ? Number(e.target.value) : 0})}
                  />
                </div>
                <div className="bg-slate-50 p-2 rounded-xl border-[3px] border-black">
                  <label className="text-[9px] font-black text-slate-400 mb-0.5 block uppercase tracking-wider">外幣 ({editingItem.currency || state.defaultCurrency})</label>
                  <input 
                    type="number"
                    disabled={isAnyActionRunning}
                    className="w-full bg-transparent font-black text-base sm:text-xl outline-none p-0 text-slate-950 disabled:opacity-50"
                    value={editingItem.originalAmount === 0 ? '' : editingItem.originalAmount}
                    onChange={e => handleAmountChange(e.target.value ? Number(e.target.value) : 0)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-slate-50 p-2 rounded-xl border-[3px] border-black">
                  <label className="text-[9px] font-black text-slate-400 mb-0.5 block uppercase tracking-widest">分類</label>
                  <select 
                    disabled={isAnyActionRunning}
                    className="w-full bg-transparent font-black text-[13px] sm:text-base appearance-none outline-none p-0 text-slate-950 disabled:opacity-50"
                    value={editingItem.category}
                    onChange={e => setEditingItem({...editingItem, category: e.target.value as Category})}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl border-[3px] border-black">
                  <label className="text-[9px] font-black text-slate-400 mb-0.5 block uppercase tracking-widest">付款人</label>
                  <select 
                    disabled={isAnyActionRunning}
                    className="w-full bg-transparent font-black text-[13px] sm:text-base appearance-none outline-none p-0 text-slate-950 disabled:opacity-50"
                    value={editingItem.payerId}
                    onChange={e => setEditingItem({...editingItem, payerId: e.target.value})}
                  >
                    {state.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-[1.25rem] border-[3px] border-black">
                <label className="text-[9px] font-black text-slate-400 mb-2 block uppercase tracking-widest leading-none">參與分帳人員</label>
                <div className="flex flex-nowrap gap-1 overflow-x-auto no-scrollbar pt-1">
                  {state.members.map(m => (
                    <button
                      key={m.id}
                      disabled={isAnyActionRunning}
                      onClick={() => toggleSplitMember(m.id)}
                      className={`flex-1 min-w-0 py-1.5 px-1 rounded-lg text-[10px] font-black border-2 transition-all whitespace-nowrap overflow-hidden text-ellipsis ${
                        editingItem.splitWith?.includes(m.id) 
                          ? 'bg-[#F6D32D] text-black border-black shadow-sm' 
                          : 'bg-white text-slate-300 border-slate-100'
                      } disabled:opacity-50`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-[1.25rem] border-[3px] border-black">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">項目內容 (收據清單)</label>
                  <span className={`text-[8px] font-black px-1 py-0.5 rounded-md border-2 ${editingItem.isSplit ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-pink-100 text-pink-700 border-pink-200'}`}>
                    {editingItem.type}
                  </span>
                </div>
                <textarea 
                  disabled={isAnyActionRunning}
                  className="w-full bg-transparent font-bold text-[13px] sm:text-base min-h-[120px] sm:min-h-[190px] outline-none leading-relaxed p-0 text-slate-950 resize-none whitespace-pre-wrap disabled:opacity-50"
                  placeholder="輸入收據品項詳情..."
                  value={editingItem.item}
                  onChange={e => setEditingItem({...editingItem, item: e.target.value})}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-3">
              <button 
                disabled={isAnyActionRunning}
                onClick={() => handleDelete(editingItem)}
                className={`p-3 rounded-xl active:scale-95 transition-all shadow-sm flex items-center gap-2 border-[3px] ${
                  isDeleting ? 'bg-slate-50 border-slate-200 text-slate-400' : 'bg-white border-red-200 text-red-500'
                }`}
              >
                {isDeleting ? <Loader2 size={22} strokeWidth={3} className="animate-spin" /> : <Trash2 size={22} strokeWidth={3} />}
                {isDeleting && <span className="font-black text-sm">處理中</span>}
              </button>
              <button 
                disabled={isAnyActionRunning}
                onClick={handleSaveEdit}
                className="flex-1 py-3 bg-black text-white rounded-xl font-black comic-shadow-sm flex items-center justify-center gap-2 active:translate-y-1 transition-all disabled:opacity-50 text-base"
              >
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} strokeWidth={3} />}
                {isSaving ? '處理中' : '儲存修改'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Details;
