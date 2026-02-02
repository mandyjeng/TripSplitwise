
import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, Member, Category, AppState } from '../types';
import { CATEGORIES, CATEGORY_ICONS, CATEGORY_COLORS } from '../constants';
import { Search, Trash2, Calendar, RefreshCw, X, Save, Clock, Loader2, Calculator, Users, Zap, Check, UserCheck, Tag, CreditCard, ChevronDown, Filter, RotateCcw, ChevronUp, User } from 'lucide-react';
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
  const [filterType, setFilterType] = useState<'全部' | '公帳' | '私帳'>('全部');
  const [filterDate, setFilterDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  
  const [isSaving, setIsSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<Transaction | null>(null);
  const [editSplitMode, setEditSplitMode] = useState<'equal' | 'custom'>('equal');
  const [editSplitCurrency, setEditSplitCurrency] = useState<'ORIGINAL' | 'TWD'>('ORIGINAL');
  
  const [manualSplits, setManualSplits] = useState<Record<string, number>>({});
  const [openDropdown, setOpenDropdown] = useState<'payer' | 'category' | 'type' | 'filter-payer' | 'filter-category' | 'filter-type' | null>(null);

  useEffect(() => {
    if (initialEditId) {
      const target = state.transactions.find(t => t.id === initialEditId);
      if (target) {
        setEditingItem(target);
        setEditSplitMode(target.customSplits && Object.keys(target.customSplits).length > 0 ? 'custom' : 'equal');
        setEditSplitCurrency('ORIGINAL');
        
        // 初始化 manualSplits：優先讀取 customOriginalSplits (外幣)
        const m: Record<string, number> = {};
        if (target.customOriginalSplits) {
          Object.assign(m, target.customOriginalSplits);
        } else if (target.customSplits) {
          const r = target.originalAmount / target.ntdAmount;
          Object.entries(target.customSplits).forEach(([id, v]) => {
            if (id && id !== '') m[id] = v * r;
          });
        }
        setManualSplits(m);
      }
      onClearInitialEdit?.();
    }
  }, [initialEditId, state.transactions, onClearInitialEdit]);

  useEffect(() => {
    const handleClickOutside = () => setOpenDropdown(null);
    if (openDropdown) window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [openDropdown]);

  const currentEffectiveRate = useMemo(() => {
    if (!editingItem || !editingItem.originalAmount) return state.exchangeRate;
    return editingItem.ntdAmount / editingItem.originalAmount;
  }, [editingItem?.ntdAmount, editingItem?.originalAmount, state.exchangeRate]);

  const allocatedSum = useMemo(() => {
    if (!editingItem) return { ntd: 0, original: 0 };
    let ntd = 0;
    let original = 0;
    (editingItem.splitWith || []).filter(id => id && id !== '').forEach(id => {
      ntd += editingItem.customSplits?.[id] || 0;
      original += editingItem.customOriginalSplits?.[id] || manualSplits[id] || 0;
    });
    return { ntd, original };
  }, [editingItem?.splitWith, editingItem?.customSplits, editingItem?.customOriginalSplits, manualSplits]);

  const remainingAmount = useMemo(() => {
    if (!editingItem) return 0;
    if (editSplitCurrency === 'TWD') {
      return editingItem.ntdAmount - allocatedSum.ntd;
    } else {
      return editingItem.originalAmount - allocatedSum.original;
    }
  }, [editingItem, allocatedSum, editSplitCurrency]);

  const isSplitBalanced = editSplitMode === 'equal' || Math.abs(remainingAmount) < 0.1;

  const handleTotalNtdChange = (newTotal: number) => {
    setEditingItem(prev => {
      if (!prev || !prev.originalAmount) return prev ? { ...prev, ntdAmount: newTotal } : prev;
      const updates: Partial<Transaction> = { ntdAmount: newTotal };
      
      if (editSplitMode === 'custom') {
        const newRate = newTotal / prev.originalAmount;
        const newNtdSplits: Record<string, number> = {};
        
        // 按照現有的「外幣數值比例」重新分配台幣
        Object.entries(manualSplits).forEach(([id, foreignVal]) => {
          if (id && id !== '' && prev.splitWith?.includes(id)) {
             newNtdSplits[id] = Math.round(foreignVal * newRate);
          }
        });
        updates.customSplits = newNtdSplits;

        // 如果目前是台幣輸入模式，還得同步 manualSplits (這部分比較少見但需處理)
        if (editSplitCurrency === 'TWD') {
          const newManual: Record<string, number> = {};
          Object.assign(newManual, newNtdSplits);
          setManualSplits(newManual);
        }
      }
      return { ...prev, ...updates };
    });
  };

  const handleCustomSplitChange = (memberId: string, val: string) => {
    if (!editingItem) return;
    const inputVal = parseFloat(val) || 0;
    
    setManualSplits(prev => ({ ...prev, [memberId]: inputVal }));

    const newNtdSplits = { ...(editingItem.customSplits || {}) };
    const newOriSplits = { ...(editingItem.customOriginalSplits || {}) };

    if (editSplitCurrency === 'ORIGINAL') {
      newOriSplits[memberId] = inputVal;
      newNtdSplits[memberId] = Math.round(inputVal * currentEffectiveRate);
    } else {
      newNtdSplits[memberId] = inputVal;
      newOriSplits[memberId] = inputVal / currentEffectiveRate;
    }
    
    const effectiveCount = Object.values(newOriSplits).filter(v => v > 0).length;

    setEditingItem({
      ...editingItem,
      customSplits: newNtdSplits,
      customOriginalSplits: newOriSplits,
      type: (effectiveCount === 1 ? '私帳' : '公帳') as any
    });
  };

  const handleSaveEdit = async () => {
    if (!editingItem || isSaving || !isSplitBalanced) return;
    setIsSaving(true);
    try {
      const finalItem = { ...editingItem };
      if (editSplitMode === 'equal') {
        finalItem.customSplits = undefined;
        finalItem.customOriginalSplits = undefined;
        finalItem.splitWith = finalItem.splitWith.filter(id => id && id !== '');
      } else {
        const selectedWithMoney = Object.entries(finalItem.customOriginalSplits || {})
          .filter(([id, val]) => val > 0 && id && id !== '' && finalItem.splitWith?.includes(id))
          .map(([id]) => id);
          
        finalItem.splitWith = selectedWithMoney;
        
        const cleanedNtd: Record<string, number> = {};
        const cleanedOri: Record<string, number> = {};
        selectedWithMoney.forEach(id => { 
          cleanedNtd[id] = finalItem.customSplits![id]; 
          cleanedOri[id] = finalItem.customOriginalSplits![id];
        });
        finalItem.customSplits = cleanedNtd;
        finalItem.customOriginalSplits = cleanedOri;
      }
      
      const newList = state.transactions.map(t => t.id === finalItem.id ? { ...finalItem } : t);
      updateState({ transactions: newList });
      if (state.sheetUrl && finalItem.rowIndex !== undefined) await updateTransactionInSheet(state.sheetUrl, finalItem, state.members);
      setEditingItem(null);
    } catch (error) {
      alert('儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const perPersonInfo = useMemo(() => {
    if (!editingItem || !editingItem.ntdAmount) return { amount: '0', label: 'NT$' };
    const count = (editingItem.splitWith || []).length;
    if (count === 0) return { amount: '0', label: 'NT$' };

    if (editSplitCurrency === 'TWD') {
      return { 
        amount: Math.round(editingItem.ntdAmount / count).toLocaleString(), 
        label: 'NT$' 
      };
    } else {
      const amt = editingItem.originalAmount / count;
      const formatted = amt % 1 === 0 ? amt.toString() : amt.toFixed(2);
      return { 
        amount: formatted, 
        label: `${editingItem.currency}$` 
      };
    }
  }, [editingItem, editSplitCurrency]);

  const CustomSelect = ({ label, icon: Icon, value, options, onSelect, isOpen, onToggle, className = "" }: any) => (
    <div className={`relative ${className}`} onClick={e => e.stopPropagation()}>
      {label && <label className="text-[9px] font-black text-slate-400 mb-1 block uppercase tracking-widest flex items-center gap-1.5"><Icon size={12} /> {label}</label>}
      <button onClick={onToggle} className="w-full bg-white border-2 border-black rounded-xl px-3 py-2 flex items-center justify-between shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all">
        <span className="font-black text-xs truncate mr-1">{options.find((o: any) => o.id === value)?.name || value}</span>
        <ChevronDown size={12} className="text-slate-400 shrink-0" />
      </button>
      {isOpen && (
        <div className="absolute z-[70] left-0 right-0 top-full mt-1 bg-white border-2 border-black rounded-xl p-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-h-48 overflow-y-auto no-scrollbar">
          {options.map((opt: any) => (
            <button key={opt.id} onClick={() => { onSelect(opt.id); onToggle(); }} className={`w-full text-left px-3 py-2 rounded-lg font-black text-xs mb-1 last:mb-0 ${value === opt.id ? 'bg-[#F6D32D]' : 'hover:bg-slate-50'}`}>{opt.name}</button>
          ))}
        </div>
      )}
    </div>
  );

  const resetFilters = () => {
    setFilterCategory('全部');
    setFilterMemberId('全部');
    setFilterType('全部');
    setFilterDate('');
    setSearchQuery('');
  };

  const isFilterActive = filterCategory !== '全部' || filterMemberId !== '全部' || filterType !== '全部' || filterDate !== '' || searchQuery !== '';
  const activeFilterCount = (filterCategory !== '全部' ? 1 : 0) + (filterMemberId !== '全部' ? 1 : 0) + (filterType !== '全部' ? 1 : 0) + (filterDate !== '' ? 1 : 0);

  const filteredTransactions = state.transactions
    .filter(t => filterCategory === '全部' || t.category === filterCategory)
    .filter(t => filterMemberId === '全部' || t.payerId === filterMemberId)
    .filter(t => filterType === '全部' || t.type === filterType)
    .filter(t => filterDate === '' || t.date === filterDate)
    .filter(t => t.item.toLowerCase().includes(searchQuery.toLowerCase()) || t.merchant.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const dates = Array.from(new Set(filteredTransactions.map(t => t.date)));

  return (
    <div className="space-y-6 pb-24">
      <div className="sticky top-0 bg-[#FDFCF8]/95 backdrop-blur-md pt-1 pb-4 z-40 border-b-2 border-dashed border-slate-200">
        <div className="flex gap-2.5 mb-3.5">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input type="text" placeholder="搜尋項目..." className="w-full bg-white comic-border rounded-2xl py-3 pl-11 pr-4 text-base font-bold focus:outline-none" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <button onClick={onSync} disabled={isSyncing} className="bg-[#F6D32D] comic-border w-12 rounded-xl flex items-center justify-center comic-shadow-sm active:translate-y-0.5 transition-all"><RefreshCw size={20} className={isSyncing ? "animate-spin" : ""} /></button>
        </div>

        {/* 2x2 網格篩選面板控制項 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
             <button 
                onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-black font-black text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-0.5 transition-all ${isFilterExpanded || activeFilterCount > 0 ? 'bg-[#F6D32D]' : 'bg-white'}`}
             >
                <Filter size={16} />
                <span>篩選條件</span>
                {activeFilterCount > 0 && (
                  <span className="bg-black text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center">{activeFilterCount}</span>
                )}
                {isFilterExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
             </button>

             {isFilterActive && (
                <button onClick={resetFilters} className="flex items-center gap-1.5 text-slate-400 font-black text-xs hover:text-black transition-colors">
                  <RotateCcw size={14} /> 重設
                </button>
             )}
          </div>

          {/* 展開後的 2x2 網格篩選器 */}
          {isFilterExpanded && (
            <div className="bg-white border-2 border-black rounded-3xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-2 gap-3">
                <CustomSelect 
                  label="付款人"
                  icon={UserCheck}
                  value={filterMemberId}
                  options={[{id: '全部', name: '不限'}, ...state.members.map(m => ({ id: m.id, name: m.name }))]}
                  isOpen={openDropdown === 'filter-payer'}
                  onToggle={() => setOpenDropdown(openDropdown === 'filter-payer' ? null : 'filter-payer')}
                  onSelect={setFilterMemberId}
                />
                <CustomSelect 
                  label="分類"
                  icon={Tag}
                  value={filterCategory}
                  options={[{id: '全部', name: '不限'}, ...CATEGORIES.map(c => ({ id: c, name: c }))]}
                  isOpen={openDropdown === 'filter-category'}
                  onToggle={() => setOpenDropdown(openDropdown === 'filter-category' ? null : 'filter-category')}
                  onSelect={setFilterCategory}
                />
                <CustomSelect 
                  label="帳務類型"
                  icon={CreditCard}
                  value={filterType}
                  options={[{id: '全部', name: '不限'}, {id: '公帳', name: '公帳'}, {id: '私帳', name: '私帳'}]}
                  isOpen={openDropdown === 'filter-type'}
                  onToggle={() => setOpenDropdown(openDropdown === 'filter-type' ? null : 'filter-type')}
                  onSelect={setFilterType}
                />
                <div className="relative">
                  <label className="text-[9px] font-black text-slate-400 mb-1 block uppercase tracking-widest flex items-center gap-1.5"><Calendar size={12} /> 日期</label>
                  <div className="bg-white border-2 border-black rounded-xl px-3 py-2 flex items-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <input 
                      type="date" 
                      className="bg-transparent border-none p-0 text-xs font-black focus:ring-0 w-full" 
                      value={filterDate}
                      onChange={e => setFilterDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => setIsFilterExpanded(false)}
                className="w-full mt-4 py-2 border-t-2 border-dashed border-slate-200 text-slate-400 font-black text-[10px] flex items-center justify-center gap-1"
              >
                收合篩選面板 <ChevronUp size={12} />
              </button>
            </div>
          )}
        </div>
        
        <div className="mt-3 px-1 flex justify-between items-center text-[10px] font-black text-slate-400 italic">
          <span>{filteredTransactions.length} 筆明細結果</span>
        </div>
      </div>

      <div className="space-y-8">
        {dates.length > 0 ? dates.map(date => (
          <div key={date} className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="bg-white border-2 border-black px-3 py-1 rounded-lg text-[10px] font-black">{date}</div>
              <div className="flex-1 h-[1px] bg-slate-200"></div>
            </div>
            <div className="space-y-3">
              {filteredTransactions.filter(t => t.date === date).map(t => {
                const payer = state.members.find(m => m.id === t.payerId);
                const isAllSplit = t.isSplit && t.splitWith.length === state.members.length;
                const splitNames = t.isSplit ? t.splitWith.map(id => state.members.find(m => m.id === id)?.name || id).join(', ') : '';

                return (
                  <div key={t.id} onClick={() => {
                    setEditingItem(t);
                    setEditSplitMode(t.customSplits && Object.keys(t.customSplits).length > 0 ? 'custom' : 'equal');
                    
                    const m: Record<string, number> = {};
                    if (t.customOriginalSplits) {
                       Object.assign(m, t.customOriginalSplits);
                    } else if (t.customSplits) {
                       const r = t.originalAmount / t.ntdAmount;
                       Object.entries(t.customSplits).forEach(([id, v]) => { m[id] = v * r; });
                    }
                    setManualSplits(m);
                  }} className="bg-white border-2 border-black p-4 rounded-2xl flex items-center gap-3 comic-shadow active:translate-y-0.5 transition-all cursor-pointer">
                    <div className={`w-10 h-10 rounded-xl border-2 border-black flex items-center justify-center shrink-0 ${CATEGORY_COLORS[t.category].split(' ')[0]}`}>{React.cloneElement(CATEGORY_ICONS[t.category] as React.ReactElement<any>, { size: 16 })}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-sm truncate flex items-center gap-2">
                        {t.merchant}
                        {t.type === '私帳' && <span className="text-[8px] px-1.5 py-0.5 bg-slate-100 border border-black rounded uppercase">Private</span>}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 truncate mb-1">{t.item}</div>
                      
                      {/* 付款人與參與成員標籤區 */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <div className="flex items-center gap-1 text-[9px] font-black text-blue-500">
                          <User size={10} />
                          <span>{payer?.name || t.payerId}</span>
                        </div>
                        {t.isSplit && t.type === '公帳' && (
                          <div className="flex items-center gap-1 text-[9px] font-black text-slate-400">
                            <Users size={10} />
                            {isAllSplit ? (
                              <span className="bg-slate-100 text-slate-600 px-1 py-0.5 rounded border border-slate-200 text-[7px] leading-none">ALL</span>
                            ) : (
                              <span className="truncate max-w-[120px]">{splitNames}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] font-black text-slate-400 italic">{t.originalAmount} {t.currency}</div>
                      <div className="font-black text-base">NT$ {Math.round(t.ntdAmount).toLocaleString()}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )) : (
          <div className="py-20 text-center space-y-3">
            <div className="w-16 h-16 bg-slate-50 border-2 border-dashed border-slate-200 rounded-full flex items-center justify-center mx-auto">
              <Search size={24} className="text-slate-300" />
            </div>
            <p className="text-slate-400 font-black text-sm">找不到符合條件的明細</p>
            {isFilterActive && <button onClick={resetFilters} className="text-blue-500 font-black text-xs underline">重置所有篩選</button>}
          </div>
        )}
      </div>

      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border-4 border-black rounded-[2.5rem] w-full max-w-md p-6 comic-shadow relative overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black italic flex items-center gap-2"><Clock size={24} className="text-[#F6D32D]" /> 修改明細</h3>
              <button onClick={() => setEditingItem(null)} className="p-1 hover:bg-slate-50 rounded-full"><X size={24} /></button>
            </div>
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar pb-4 px-1">
              <CustomSelect label="付款人" icon={UserCheck} value={editingItem.payerId} options={state.members.map(m => ({ id: m.id, name: m.name }))} isOpen={openDropdown === 'payer'} onToggle={() => setOpenDropdown(openDropdown === 'payer' ? null : 'payer')} onSelect={(id: string) => setEditingItem({...editingItem, payerId: id})} />
              <div className="grid grid-cols-2 gap-3">
                <CustomSelect label="分類" icon={Tag} value={editingItem.category} options={CATEGORIES.map(c => ({ id: c, name: c }))} isOpen={openDropdown === 'category'} onToggle={() => setOpenDropdown(openDropdown === 'category' ? null : 'category')} onSelect={(cat: any) => setEditingItem({...editingItem, category: cat})} />
                <CustomSelect label="帳務類型" icon={CreditCard} value={editingItem.type} options={[{id: '公帳', name: '公帳'}, {id: '私帳', name: '私帳'}]} isOpen={openDropdown === 'type'} onToggle={() => setOpenDropdown(openDropdown === 'type' ? null : 'type')} onSelect={(type: any) => setEditingItem({...editingItem, type})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-2 rounded-xl border-2 border-black"><label className="text-[9px] font-black text-slate-400 mb-0.5 block uppercase">日期</label><input type="date" className="w-full bg-transparent font-black text-xs p-0 border-none focus:ring-0" value={editingItem.date} onChange={e => setEditingItem({...editingItem, date: e.target.value})} /></div>
                <div className="bg-slate-50 p-2 rounded-xl border-2 border-black"><label className="text-[9px] font-black text-slate-400 mb-0.5 block uppercase">店家</label><input className="w-full bg-transparent font-black text-xs p-0 border-none focus:ring-0" value={editingItem.merchant} onChange={e => setEditingItem({...editingItem, merchant: e.target.value})} /></div>
              </div>

              <div className="grid grid-cols-2 gap-3 relative">
                <div className="bg-[#FFFDF0] p-3 rounded-xl border-2 border-[#E64A4A]"><label className="text-[9px] font-black text-[#E64A4A] mb-0.5 block uppercase">台幣金額</label><input type="number" className="w-full bg-transparent border-none focus:ring-0 text-xl font-black p-0" value={editingItem.ntdAmount || ''} onChange={e => handleTotalNtdChange(Number(e.target.value))} /></div>
                <div className="bg-slate-50 p-3 rounded-xl border-2 border-black"><label className="text-[9px] font-black text-slate-400 mb-0.5 block uppercase">外幣 ({editingItem.currency})</label><input type="number" className="w-full bg-transparent border-none focus:ring-0 text-xl font-black p-0" value={editingItem.originalAmount || ''} onChange={e => { const ori = Number(e.target.value); setEditingItem({...editingItem, originalAmount: ori, ntdAmount: Math.round(ori * currentEffectiveRate)}); }} /></div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-black text-white text-[8px] font-black px-2 py-0.5 rounded-full z-10">Rate: 1:{currentEffectiveRate.toFixed(2)}</div>
              </div>

              <div className="bg-slate-100 p-1 rounded-xl flex border-2 border-black">
                <button onClick={() => {
                  setEditSplitMode('equal');
                  const s = editingItem.splitWith || [];
                  setEditingItem({ ...editingItem, type: s.length === 1 ? '私帳' : '公帳' });
                }} className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${editSplitMode === 'equal' ? 'bg-black text-white' : 'text-slate-400'}`}>均分</button>
                <button onClick={() => { 
                  setEditSplitMode('custom'); 
                  if(!editingItem.customSplits) {
                    const sNtd:Record<string,number>={};
                    const sOri:Record<string,number>={};
                    const m:Record<string,number>={};
                    const splitWith = (editingItem.splitWith || state.members.map(m=>m.id)).filter(id => id && id !== '');
                    if (splitWith.length === 0) return;
                    
                    const perNtd = Math.round(editingItem.ntdAmount/splitWith.length);
                    const perOri = editingItem.originalAmount/splitWith.length;

                    splitWith.forEach(id=>{ 
                      if(id) { 
                        sNtd[id]=perNtd; 
                        sOri[id]=perOri;
                        m[id]=perOri; // 預設使用外幣模式
                      } 
                    });
                    setEditingItem({
                      ...editingItem, 
                      customSplits:sNtd, 
                      customOriginalSplits:sOri,
                      splitWith,
                      type: (splitWith.length === 1 ? '私帳' : '公帳') as any
                    });
                    setManualSplits(m);
                    setEditSplitCurrency('ORIGINAL');
                  }
                }} className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${editSplitMode === 'custom' ? 'bg-[#F6D32D] text-black border-2 border-black' : 'text-slate-400'}`}>手動</button>
              </div>

              <div className="bg-slate-50 p-4 rounded-3xl border-2 border-black space-y-3">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex bg-white p-1 rounded-lg border-2 border-black">
                    <button onClick={() => { 
                      setEditSplitCurrency('TWD'); 
                      const nM:Record<string,number>={}; 
                      Object.entries(editingItem.customSplits||{}).forEach(([id,v])=> { if(id && id !== '') nM[id]=v; }); 
                      setManualSplits(nM); 
                    }} className={`px-2 py-1 rounded font-black text-[9px] ${editSplitCurrency === 'TWD' ? 'bg-black text-white' : 'text-slate-400'}`}>台幣</button>
                    <button onClick={() => { 
                      setEditSplitCurrency('ORIGINAL'); 
                      const nM:Record<string,number>={}; 
                      Object.entries(editingItem.customOriginalSplits||{}).forEach(([id,v])=> { if(id && id !== '') nM[id]=v; }); 
                      setManualSplits(nM); 
                    }} className={`px-2 py-1 rounded font-black text-[9px] ${editSplitCurrency === 'ORIGINAL' ? 'bg-[#F6D32D] text-black' : 'text-slate-400'}`}>外幣</button>
                  </div>
                  <div className={`text-[10px] font-black px-2 py-0.5 rounded-full border-2 ${isSplitBalanced ? 'bg-green-100 border-green-500 text-green-600' : 'bg-red-50 text-red-500'}`}>
                    {editSplitMode === 'equal' ? `每人約 ${perPersonInfo.label} ${perPersonInfo.amount}` : (isSplitBalanced ? '已對齊' : `差: ${remainingAmount.toFixed(1)}`)}
                  </div>
                </div>
                
                <div className="space-y-3">
                  {state.members.map(m => {
                    const isSelected = editingItem.splitWith?.includes(m.id);
                    const displayValue = isSelected ? (manualSplits[m.id] !== undefined ? manualSplits[m.id].toFixed(2).replace(/\.00$/, '').replace(/\.([0-9])0$/, '.$1') : '') : '';
                    
                    const ntdVal = editingItem.customSplits?.[m.id] || 0;
                    const oriVal = editingItem.customOriginalSplits?.[m.id] || 0;
                    const refVal = (isSelected && (ntdVal > 0 || oriVal > 0)) ? (editSplitCurrency === 'TWD' ? `≈ ${oriVal.toFixed(2)} ${editingItem.currency}` : `≈ NT$ ${Math.round(ntdVal)}`) : "";

                    return (
                      <div key={m.id} className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <button onClick={() => { 
                             const s = editingItem.splitWith || []; 
                             const newSplitWith = s.includes(m.id) ? s.filter(i=>i!==m.id && i !== '') : [...s, m.id].filter(id => id && id !== '');
                             
                             const newType = (editSplitMode === 'equal' && newSplitWith.length === 1) ? '私帳' :
                                            (editSplitMode === 'equal' && newSplitWith.length > 1) ? '公帳' : editingItem.type;

                             setEditingItem({
                               ...editingItem, 
                               splitWith: newSplitWith,
                               type: newType as any
                             }); 
                          }} className={`flex-1 flex justify-between p-2 rounded-xl border-2 ${isSelected ? 'bg-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-transparent border-slate-100 text-slate-300'}`}>
                            <span className="text-sm font-black">{m.name}</span>
                            {editSplitMode === 'equal' && isSelected && <Check size={16} className="text-[#1FA67A]" />}
                          </button>
                          
                          {editSplitMode === 'custom' && isSelected && (
                            <div className="relative w-28">
                              <input type="number" className="w-full bg-white border-2 border-black rounded-xl px-2 py-2 text-xs font-black" value={displayValue} onChange={e => handleCustomSplitChange(m.id, e.target.value)} />
                              <button onClick={() => handleCustomSplitChange(m.id, ((manualSplits[m.id]||0) + remainingAmount).toString())} className="absolute right-1 top-1/2 -translate-y-1/2 text-[#F6D32D]"><Zap size={12} fill="currentColor" /></button>
                            </div>
                          )}
                        </div>
                        {editSplitMode === 'custom' && refVal && <div className="text-[9px] font-black text-slate-400 text-right pr-2 italic">{refVal}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border-2 border-black">
                <label className="text-[9px] font-black text-slate-400 mb-1 block uppercase">明細內容</label>
                <textarea className="w-full bg-transparent border-none focus:ring-0 text-xs font-bold p-0 min-h-[60px] resize-none" value={editingItem.item} onChange={e => setEditingItem({...editingItem, item: e.target.value})} />
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={() => { if(confirm('刪除？')) onDeleteTransaction(editingItem.id).then(()=>setEditingItem(null)); }} className="p-4 rounded-2xl border-2 border-red-200 text-red-500 flex items-center justify-center"><Trash2 size={24} /></button>
              <button disabled={!isSplitBalanced || isSaving || (editingItem.splitWith?.length || 0) === 0} onClick={handleSaveEdit} className={`flex-1 py-4 rounded-2xl font-black text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 ${isSplitBalanced && (editingItem.splitWith?.length || 0) > 0 ? 'bg-black' : 'bg-slate-200'}`}>{isSaving ? '儲存中...' : '儲存修改'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Details;
