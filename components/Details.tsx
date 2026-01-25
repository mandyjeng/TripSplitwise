
import React, { useState } from 'react';
import { Transaction, Member, Category } from '../types';
import { CATEGORIES, CATEGORY_ICONS, CATEGORY_COLORS } from '../constants';
import { Search, Trash2, Calendar, RefreshCw, X, Save, Clock, Loader2 } from 'lucide-react';
import { updateTransactionInSheet, deleteTransactionFromSheet } from '../services/sheets';

interface DetailsProps {
  state: {
    transactions: Transaction[];
    members: Member[];
    sheetUrl?: string;
    exchangeRate: number;
    currentUser: string;
  };
  onDeleteTransaction: (id: string) => void;
  updateState: (updates: any) => void;
  onSync: () => void;
  isSyncing: boolean;
}

const Details: React.FC<DetailsProps> = ({ state, onDeleteTransaction, updateState, onSync, isSyncing }) => {
  const [filterCategory, setFilterCategory] = useState<Category | '全部'>('全部');
  const [filterMemberId, setFilterMemberId] = useState<string | '全部'>('全部');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<Transaction | null>(null);

  const handleSaveEdit = async () => {
    if (!editingItem || isSaving) return;
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
    if (!confirm(`確定要刪除「${t.merchant}」嗎？`)) return;
    onDeleteTransaction(t.id);
    if (state.sheetUrl && t.rowIndex !== undefined) {
      await deleteTransactionFromSheet(state.sheetUrl, t.rowIndex);
    }
    setEditingItem(null);
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
    if (!editingItem || !editingItem.isSplit) return;
    const currentSplit = editingItem.splitWith || [];
    const newSplit = currentSplit.includes(memberId)
      ? currentSplit.filter(id => id !== memberId)
      : [...currentSplit, memberId];
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

  return (
    <div className="space-y-8 pb-24">
      <div className="sticky top-0 bg-[#FDFCF8]/95 backdrop-blur-md pt-2 pb-4 z-10 border-b-2 border-dashed border-slate-200">
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
            <input 
              type="text"
              placeholder="搜尋店家或項目..."
              className="w-full bg-white comic-border rounded-[1.5rem] py-4 pl-12 pr-4 text-lg font-bold focus:outline-none shadow-sm"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={onSync}
            disabled={isSyncing}
            className="bg-[#F6D32D] comic-border w-14 rounded-[1.5rem] flex items-center justify-center comic-shadow-sm active:translate-y-1 transition-all disabled:opacity-50 shrink-0"
          >
            <RefreshCw size={24} className={isSyncing ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {['全部', ...CATEGORIES].map(c => (
              <button 
                key={c}
                onClick={() => setFilterCategory(c as any)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-black border-2 whitespace-nowrap transition-all ${
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
              className={`px-3 py-1.5 rounded-lg text-[12px] font-black border-2 transition-all whitespace-nowrap flex-shrink-0 ${
                filterMemberId === '全部' ? 'bg-[#F6D32D] border-black shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-400'
              }`}
            >
              所有人
            </button>
            {state.members.map(m => (
              <button 
                key={m.id}
                onClick={() => setFilterMemberId(m.id)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-black border-2 transition-all whitespace-nowrap flex-shrink-0 ${
                  filterMemberId === m.id ? 'bg-[#F6D32D] border-black shadow-sm text-black' : 'bg-slate-50 border-slate-100 text-slate-400'
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-10">
        {dates.length > 0 ? (
          dates.map(date => (
            <div key={date} className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="bg-white comic-border px-4 py-1.5 rounded-xl comic-shadow-sm flex items-center gap-2">
                  <Calendar size={18} strokeWidth={3} className="text-black" />
                  <span className="text-sm font-black uppercase tracking-widest whitespace-nowrap text-black">{date}</span>
                </div>
                <div className="flex-1 h-[2px] bg-slate-300 rounded-full"></div>
              </div>
              
              <div className="space-y-6">
                {filteredTransactions.filter(t => t.date === date).map(t => (
                  <div 
                    key={t.id} 
                    onClick={() => setEditingItem(t)}
                    className="bg-white comic-border p-4 sm:p-6 rounded-[2rem] flex flex-col gap-5 comic-shadow hover:translate-x-1 hover:-translate-y-1 transition-all cursor-pointer relative group"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border-[3px] border-black flex items-center justify-center shrink-0 mt-0.5 ${CATEGORY_COLORS[t.category].split(' ')[0]}`}>
                        {React.cloneElement(CATEGORY_ICONS[t.category] as React.ReactElement<any>, { size: 24 })}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-lg text-black truncate leading-tight">{t.merchant}</span>
                            {!t.isSplit ? (
                              <span className="shrink-0 bg-pink-100 text-pink-700 text-[10px] font-black px-1.5 py-0.5 rounded-md border-2 border-pink-200">個人</span>
                            ) : (
                              <span className="shrink-0 bg-blue-100 text-blue-700 text-[10px] font-black px-1.5 py-0.5 rounded-md border-2 border-blue-200">{t.splitWith.length}人</span>
                            )}
                          </div>
                          <div className="text-sm sm:text-base font-bold text-slate-700 truncate leading-snug">{t.item}</div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 ml-1">
                        <div className="text-[11px] font-bold text-slate-500 italic uppercase mb-0.5">
                          {t.originalAmount} {t.currency}
                        </div>
                        <div className="font-black text-lg sm:text-xl text-black leading-none">
                          <span className="text-[12px] mr-0.5 font-bold">NT$</span>
                          {Math.round(t.ntdAmount).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t-2 border-slate-100 flex flex-col gap-4">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="flex items-center gap-2 text-[13px] sm:text-base font-black text-black bg-slate-100 px-3 py-1.5 rounded-xl border-2 border-slate-200">
                          <div className="w-6 h-6 rounded-lg bg-[#F6D32D] comic-border flex items-center justify-center text-black text-[10px] font-black">
                            {state.members.find(m => m.id === t.payerId)?.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="truncate max-w-[60px] sm:max-w-none">{state.members.find(m => m.id === t.payerId)?.name}</span>
                        </div>
                        <div className="h-5 w-[2px] bg-slate-200 mx-0.5"></div>
                        <div className="flex flex-wrap gap-1.5 items-center flex-1 overflow-hidden">
                          <span className="text-[11px] sm:text-sm font-black text-black shrink-0">分給:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {t.isSplit && t.splitWith.length === state.members.length ? (
                              <span className="text-[10px] sm:text-sm font-black text-black bg-white border-2 border-slate-300 px-2 py-0.5 rounded-lg whitespace-nowrap">
                                全部
                              </span>
                            ) : (
                              t.splitWith.map(mid => (
                                <span key={mid} className="text-[10px] sm:text-sm font-black text-black bg-white border-2 border-slate-300 px-2 py-0.5 rounded-lg whitespace-nowrap">
                                  {state.members.find(m => m.id === mid)?.name}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="bg-white comic-border rounded-[2.5rem] sm:rounded-[3rem] w-full max-w-sm p-5 sm:p-7 comic-shadow relative overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl sm:text-2xl font-black italic flex items-center gap-2 text-slate-900">
                <Clock className="text-[#F6D32D]" size={24} strokeWidth={3} /> 修改明細
              </h3>
              <button onClick={() => setEditingItem(null)} className="p-3 bg-slate-50 rounded-full text-slate-500 hover:bg-slate-100 transition-colors">
                <X size={24} strokeWidth={3} />
              </button>
            </div>
            
            <div className="space-y-3.5 max-h-[68vh] overflow-y-auto no-scrollbar pb-4">
              {/* 基本資訊：日期與店家 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-2.5 rounded-xl border-[3px] border-black">
                  <label className="text-[10px] font-black text-slate-400 mb-0.5 block uppercase tracking-wider">日期</label>
                  <input 
                    type="date"
                    className="w-full bg-transparent font-black text-sm sm:text-base outline-none p-0 text-slate-950"
                    value={editingItem.date}
                    onChange={e => setEditingItem({...editingItem, date: e.target.value})}
                  />
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border-[3px] border-black">
                  <label className="text-[10px] font-black text-slate-400 mb-0.5 block uppercase tracking-wider">店家</label>
                  <input 
                    className="w-full bg-transparent font-black text-sm sm:text-base outline-none p-0 text-slate-950"
                    value={editingItem.merchant}
                    onChange={e => setEditingItem({...editingItem, merchant: e.target.value})}
                  />
                </div>
              </div>

              {/* 金額區塊 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#FFFDF0] p-2.5 rounded-xl border-[3px] border-[#E64A4A]">
                  <label className="text-[10px] font-black text-[#E64A4A] mb-0.5 block uppercase tracking-tighter">台幣金額</label>
                  <input 
                    type="number"
                    className="w-full bg-transparent font-black text-lg sm:text-xl outline-none p-0 text-slate-950"
                    value={editingItem.ntdAmount === 0 ? '' : editingItem.ntdAmount}
                    onChange={e => setEditingItem({...editingItem, ntdAmount: e.target.value ? Number(e.target.value) : 0})}
                  />
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border-[3px] border-black">
                  <label className="text-[10px] font-black text-slate-400 mb-0.5 block uppercase tracking-wider">外幣 ({editingItem.currency})</label>
                  <input 
                    type="number"
                    className="w-full bg-transparent font-black text-lg sm:text-xl outline-none p-0 text-slate-950"
                    value={editingItem.originalAmount === 0 ? '' : editingItem.originalAmount}
                    onChange={e => handleAmountChange(e.target.value ? Number(e.target.value) : 0)}
                  />
                </div>
              </div>

              {/* 分類與付款人 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-2.5 rounded-xl border-[3px] border-black">
                  <label className="text-[10px] font-black text-slate-400 mb-0.5 block uppercase tracking-widest">分類</label>
                  <select 
                    className="w-full bg-transparent font-black text-sm sm:text-base appearance-none outline-none p-0 text-slate-950"
                    value={editingItem.category}
                    onChange={e => setEditingItem({...editingItem, category: e.target.value as Category})}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border-[3px] border-black">
                  <label className="text-[10px] font-black text-slate-400 mb-0.5 block uppercase tracking-widest">付款人</label>
                  <select 
                    className="w-full bg-transparent font-black text-sm sm:text-base appearance-none outline-none p-0 text-slate-950"
                    value={editingItem.payerId}
                    onChange={e => setEditingItem({...editingItem, payerId: e.target.value})}
                  >
                    {state.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>

              {/* 參與分帳人員：優化排版縮小區塊並單行橫向分佈 */}
              <div className="bg-slate-50 p-3 rounded-2xl border-[3px] border-black">
                <label className="text-[10px] font-black text-slate-400 mb-2 block uppercase tracking-widest leading-none">參與分帳人員</label>
                <div className="flex flex-nowrap gap-1 overflow-x-auto no-scrollbar pt-1">
                  {state.members.map(m => (
                    <button
                      key={m.id}
                      disabled={!editingItem.isSplit}
                      onClick={() => toggleSplitMember(m.id)}
                      className={`flex-1 min-w-0 py-1.5 px-1 rounded-lg text-[11px] font-black border-2 transition-all whitespace-nowrap overflow-hidden text-ellipsis ${
                        !editingItem.isSplit ? 'opacity-30' : ''
                      } ${
                        editingItem.splitWith?.includes(m.id) 
                          ? 'bg-[#F6D32D] text-black border-black shadow-sm' 
                          : 'bg-white text-slate-300 border-slate-100'
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 項目內容：置於最下方，區塊極大化方便閱讀 */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border-[3px] border-black">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">項目內容 (收據清單)</label>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border-2 ${editingItem.isSplit ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-pink-100 text-pink-700 border-pink-200'}`}>
                    {editingItem.type}
                  </span>
                </div>
                <textarea 
                  className="w-full bg-transparent font-bold text-sm sm:text-base min-h-[150px] sm:min-h-[190px] outline-none leading-relaxed p-0 text-slate-950 resize-none"
                  placeholder="輸入收據品項詳情..."
                  value={editingItem.item}
                  onChange={e => setEditingItem({...editingItem, item: e.target.value})}
                />
              </div>
            </div>

            <div className="flex gap-4 mt-4">
              <button 
                disabled={isSaving}
                onClick={() => handleDelete(editingItem)}
                className="p-3.5 bg-white border-[3px] border-red-200 text-red-500 rounded-2xl active:scale-95 transition-all shadow-sm"
              >
                <Trash2 size={24} strokeWidth={3} />
              </button>
              <button 
                disabled={isSaving}
                onClick={handleSaveEdit}
                className="flex-1 py-3.5 bg-black text-white rounded-2xl font-black comic-shadow-sm flex items-center justify-center gap-2 active:translate-y-1 transition-all disabled:opacity-50 text-base sm:text-lg"
              >
                {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} strokeWidth={3} />}
                {isSaving ? '儲存中' : '儲存修改'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Details;
