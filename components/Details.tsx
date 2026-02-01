
import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, Member, Category, AppState } from '../types';
import { CATEGORIES, CATEGORY_ICONS, CATEGORY_COLORS } from '../constants';
import { Search, Trash2, Calendar, RefreshCw, X, Save, Clock, Loader2, Calculator, Users, Zap, Check } from 'lucide-react';
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
  const [editSplitMode, setEditSplitMode] = useState<'equal' | 'custom'>('equal');
  const [editSplitCurrency, setEditSplitCurrency] = useState<'TWD' | 'ORIGINAL'>('TWD');

  useEffect(() => {
    if (initialEditId) {
      const target = state.transactions.find(t => t.id === initialEditId);
      if (target) {
        setEditingItem(target);
        setEditSplitMode(target.customSplits && Object.keys(target.customSplits).length > 0 ? 'custom' : 'equal');
      }
      onClearInitialEdit?.();
    }
  }, [initialEditId, state.transactions, onClearInitialEdit]);

  useEffect(() => {
    if (editingItem && !initialEditId) {
       setEditSplitMode(editingItem.customSplits && Object.keys(editingItem.customSplits).length > 0 ? 'custom' : 'equal');
    }
  }, [editingItem?.id]);

  const currentEffectiveRate = useMemo(() => {
    if (!editingItem || !editingItem.originalAmount) return state.exchangeRate;
    return (editingItem.ntdAmount || 0) / editingItem.originalAmount;
  }, [editingItem?.ntdAmount, editingItem?.originalAmount, state.exchangeRate]);

  const totalAllocatedNTD = useMemo(() => {
    if (!editingItem?.customSplits) return 0;
    return Object.values(editingItem.customSplits).reduce((sum, val) => sum + val, 0);
  }, [editingItem?.customSplits]);

  const remainingAmount = useMemo(() => {
    if (!editingItem) return 0;
    if (editSplitCurrency === 'TWD') {
      return (editingItem.ntdAmount || 0) - totalAllocatedNTD;
    } else {
      const totalAllocatedOriginal = totalAllocatedNTD / currentEffectiveRate;
      return (editingItem.originalAmount || 0) - totalAllocatedOriginal;
    }
  }, [editingItem, totalAllocatedNTD, editSplitCurrency, currentEffectiveRate]);

  const isSplitBalanced = editSplitMode === 'equal' || Math.abs(remainingAmount) < 0.5;

  const handleSaveEdit = async () => {
    if (!editingItem || isSaving || isDeleting || !isSplitBalanced) return;
    setIsSaving(true);
    try {
      const finalItem = { ...editingItem };
      if (editSplitMode === 'equal') {
        finalItem.customSplits = undefined;
      } else {
        finalItem.splitWith = Object.entries(finalItem.customSplits || {})
          .filter(([_, val]) => val > 0)
          .map(([id]) => id);
      }

      const newList = state.transactions.map(t => t.id === finalItem.id ? { ...finalItem } : t);
      updateState({ transactions: newList });

      if (state.sheetUrl && finalItem.rowIndex !== undefined) {
        await updateTransactionInSheet(state.sheetUrl, finalItem, state.members);
      }
      setEditingItem(null);
    } catch (error) {
      console.error('Save failed:', error);
      alert('儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCustomSplitChange = (memberId: string, val: string) => {
    if (!editingItem) return;
    const inputVal = parseFloat(val) || 0;
    
    // 內部狀態永遠存台幣
    const ntdValue = editSplitCurrency === 'TWD' 
      ? inputVal 
      : Math.round(inputVal * currentEffectiveRate);

    setEditingItem({
      ...editingItem,
      customSplits: { ...(editingItem.customSplits || {}), [memberId]: ntdValue }
    });
  };

  const fillRemaining = (memberId: string) => {
    if (!editingItem) return;
    const currentNtd = editingItem.customSplits?.[memberId] || 0;
    const remainingNtd = editSplitCurrency === 'TWD' 
      ? remainingAmount 
      : remainingAmount * currentEffectiveRate;
    
    handleCustomSplitChange(memberId, ((currentNtd + remainingNtd) / (editSplitCurrency === 'TWD' ? 1 : currentEffectiveRate)).toString());
  };

  const toggleSplitMember = (memberId: string) => {
    if (!editingItem) return;
    const currentSplit = editingItem.splitWith || [];
    const newSplit = currentSplit.includes(memberId)
      ? currentSplit.filter(id => id !== memberId)
      : [...currentSplit, memberId];
    
    if (newSplit.length === 0) return;
    setEditingItem({ ...editingItem, splitWith: newSplit });
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
      {/* 搜尋與過濾 UI 保持不變 ... */}
      <div className="sticky top-0 bg-[#FDFCF8]/95 backdrop-blur-md pt-1 pb-4 z-10 border-b-2 border-dashed border-slate-200">
        <div className="flex gap-2.5 mb-3.5">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input type="text" placeholder="搜尋店家或項目..." className="w-full bg-white comic-border rounded-2xl py-3.5 pl-11 pr-4 text-base font-bold focus:outline-none shadow-sm" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <button onClick={onSync} disabled={isSyncing} className="bg-[#F6D32D] comic-border w-13 rounded-2xl flex items-center justify-center comic-shadow-sm active:translate-y-1 transition-all disabled:opacity-50 shrink-0"><RefreshCw size={22} className={isSyncing ? "animate-spin" : ""} /></button>
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">{['全部', ...CATEGORIES].map(c => (<button key={c} onClick={() => setFilterCategory(c as any)} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black border-2 ${filterCategory === c ? 'bg-black text-white border-black shadow-sm' : 'bg-white border-black/10'}`}>{c}</button>))}</div>
          <div className="flex flex-nowrap gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <button onClick={() => setFilterMemberId('全部')} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black border-2 whitespace-nowrap ${filterMemberId === '全部' ? 'bg-[#F6D32D] border-black shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>所有人</button>
            {state.members.map(m => (<button key={m.id} onClick={() => setFilterMemberId(m.id)} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black border-2 whitespace-nowrap ${filterMemberId === m.id ? 'bg-[#F6D32D] border-black shadow-sm text-black' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>{m.name}</button>))}
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {dates.map(date => (
          <div key={date} className="space-y-4">
            <div className="flex items-center gap-2.5"><div className="bg-white comic-border px-3 py-1.5 rounded-xl flex items-center gap-1.5"><Calendar size={16} strokeWidth={3} /><span className="text-[12px] font-black uppercase tracking-widest">{date}</span></div><div className="flex-1 h-[2px] bg-slate-200"></div></div>
            <div className="space-y-5">
              {filteredTransactions.filter(t => t.date === date).map(t => (
                <div key={t.id} onClick={() => setEditingItem(t)} className="bg-white comic-border p-5 rounded-[2rem] flex flex-col gap-4 comic-shadow active:translate-y-1 transition-all cursor-pointer">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl border-[3px] border-black flex items-center justify-center shrink-0 ${CATEGORY_COLORS[t.category].split(' ')[0]}`}>{React.cloneElement(CATEGORY_ICONS[t.category] as React.ReactElement<any>, { size: 18 })}</div>
                    <div className="flex-1 min-w-0"><div className="font-black text-lg text-black truncate mb-0.5">{t.merchant}</div><div className="text-xs font-bold text-slate-500 line-clamp-1">{t.item}</div></div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-slate-400 italic mb-0.5">{t.originalAmount} {t.currency}</div>
                      <div className="font-black text-lg">NT$ {Math.round(t.ntdAmount).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border-[4px] border-black rounded-[2.5rem] sm:rounded-[3rem] w-full max-w-md p-6 sm:p-8 comic-shadow relative overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black italic flex items-center gap-2"><Clock className="text-[#F6D32D]" size={24} /> 修改明細</h3>
              <button disabled={isAnyActionRunning} onClick={() => setEditingItem(null)} className="p-2 bg-slate-50 rounded-full"><X size={24} strokeWidth={3} /></button>
            </div>
            
            <div className="space-y-4 max-h-[65vh] overflow-y-auto no-scrollbar pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-2.5 rounded-xl border-2 border-black"><label className="text-[9px] font-black text-slate-400 mb-0.5 block uppercase">日期</label><input type="date" className="w-full bg-transparent font-black text-sm p-0" value={editingItem.date} onChange={e => setEditingItem({...editingItem, date: e.target.value})} /></div>
                <div className="bg-slate-50 p-2.5 rounded-xl border-2 border-black"><label className="text-[9px] font-black text-slate-400 mb-0.5 block uppercase">店家</label><input className="w-full bg-transparent font-black text-sm p-0" value={editingItem.merchant} onChange={e => setEditingItem({...editingItem, merchant: e.target.value})} /></div>
              </div>

              <div className="grid grid-cols-2 gap-3 relative">
                <div className="bg-[#FFFDF0] p-2.5 rounded-xl border-2 border-[#E64A4A]"><label className="text-[9px] font-black text-[#E64A4A] mb-0.5 block uppercase">台幣金額</label><input type="number" className="w-full bg-transparent font-black text-xl p-0" value={editingItem.ntdAmount || ''} onChange={e => setEditingItem({...editingItem, ntdAmount: Number(e.target.value)})} /></div>
                <div className="bg-slate-50 p-2.5 rounded-xl border-2 border-black"><label className="text-[9px] font-black text-slate-400 mb-0.5 block uppercase">外幣 ({editingItem.currency})</label><input type="number" className="w-full bg-transparent font-black text-xl p-0" value={editingItem.originalAmount || ''} onChange={e => { const ori = Number(e.target.value); setEditingItem({...editingItem, originalAmount: ori, ntdAmount: Math.round(ori * state.exchangeRate)}); }} /></div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-black text-white text-[8px] font-black px-2 py-0.5 rounded-full z-10">Rate: 1:{currentEffectiveRate.toFixed(2)}</div>
              </div>

              <div className="bg-slate-100 p-1.5 rounded-2xl flex border-2 border-black">
                <button onClick={() => setEditSplitMode('equal')} className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${editSplitMode === 'equal' ? 'bg-black text-white' : 'text-slate-400'}`}><Users size={14} /> 均分</button>
                <button onClick={() => setEditSplitMode('custom')} className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${editSplitMode === 'custom' ? 'bg-[#F6D32D] text-black border-2 border-black' : 'text-slate-400'}`}><Calculator size={14} /> 手動</button>
              </div>

              {editSplitMode === 'custom' && (
                <div className="flex gap-2">
                  <button onClick={() => setEditSplitCurrency('TWD')} className={`flex-1 py-1 rounded-lg border-2 font-black text-[9px] ${editSplitCurrency === 'TWD' ? 'bg-black text-white border-black' : 'bg-white text-slate-400 border-slate-100'}`}>台幣輸入</button>
                  <button onClick={() => setEditSplitCurrency('ORIGINAL')} className={`flex-1 py-1 rounded-lg border-2 font-black text-[9px] ${editSplitCurrency === 'ORIGINAL' ? 'bg-[#F6D32D] text-black border-black' : 'bg-white text-slate-400 border-slate-100'}`}>外幣輸入</button>
                </div>
              )}

              <div className="bg-slate-50 p-4 rounded-3xl border-2 border-black space-y-3">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">分帳人員</label>
                  {editSplitMode === 'custom' && (
                    <div className={`text-[10px] font-black px-2 py-0.5 rounded-full border-2 ${isSplitBalanced ? 'bg-green-100 border-green-500 text-green-600' : 'bg-red-50 border-red-200 text-red-500'}`}>
                       {isSplitBalanced ? '金額對齊' : `差額: ${remainingAmount.toFixed(remainingAmount % 1 === 0 ? 0 : 2)}`}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  {state.members.map(m => {
                    const isSelected = editingItem.splitWith?.includes(m.id);
                    const ntdVal = editingItem.customSplits?.[m.id] || 0;
                    
                    const displayValue = editSplitCurrency === 'TWD' 
                      ? (ntdVal || '') 
                      : (ntdVal > 0 ? (ntdVal / currentEffectiveRate).toFixed(2).replace(/\.00$/, '') : '');

                    const refVal = (editSplitMode === 'custom' && isSelected && ntdVal > 0)
                      ? (editSplitCurrency === 'TWD' ? `≈ ${(ntdVal/currentEffectiveRate).toFixed(2)} ${editingItem.currency}` : `≈ NT$ ${Math.round(ntdVal)}`)
                      : "";

                    return (
                      <div key={m.id} className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <button onClick={() => toggleSplitMember(m.id)} className={`flex-1 flex justify-between p-2 rounded-xl border-2 transition-all ${isSelected ? 'bg-white border-black' : 'bg-transparent border-slate-100 text-slate-300'}`}><span className="text-sm font-black">{m.name}</span>{editSplitMode === 'equal' && isSelected && <Check size={14} strokeWidth={4} className="text-green-500" />}</button>
                          {editSplitMode === 'custom' && isSelected && (
                            <div className="relative w-28">
                              <input type="number" placeholder="0" className="w-full bg-white border-2 border-black rounded-xl px-2 py-2 text-xs font-black" value={displayValue} onChange={e => handleCustomSplitChange(m.id, e.target.value)} />
                              <button onClick={() => fillRemaining(m.id)} className="absolute right-1 top-1/2 -translate-y-1/2 text-[#F6D32D]"><Zap size={12} fill="currentColor" /></button>
                            </div>
                          )}
                        </div>
                        {refVal && <div className="text-[9px] font-black text-slate-300 text-right pr-2 italic">{refVal}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border-2 border-black"><label className="text-[10px] font-black text-slate-400 mb-2 block uppercase">項目內容</label><textarea className="w-full bg-transparent border-none focus:ring-0 font-bold text-sm leading-relaxed p-0 resize-none min-h-[100px]" value={editingItem.item} onChange={e => setEditingItem({...editingItem, item: e.target.value})} /></div>
            </div>

            <div className="flex gap-3 mt-4">
              <button disabled={isAnyActionRunning} onClick={() => onDeleteTransaction(editingItem.id)} className="p-4 bg-white border-2 border-red-200 text-red-500 rounded-2xl active:scale-95 transition-all"><Trash2 size={24} /></button>
              <button disabled={isAnyActionRunning || !isSplitBalanced} onClick={handleSaveEdit} className={`flex-1 py-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-all ${isSplitBalanced ? 'bg-black text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1' : 'bg-slate-200 text-slate-400'}`}>{isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />} 儲存修改</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Details;
