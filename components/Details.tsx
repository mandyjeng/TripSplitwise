
import React, { useState } from 'react';
import { Transaction, Member, Category } from '../types';
import { CATEGORIES, CATEGORY_ICONS, CATEGORY_COLORS } from '../constants';
import { Search, Trash2, Calendar, RefreshCw, X, Save, Users, User, Clock, Loader2, ShieldAlert } from 'lucide-react';
import { updateTransactionInSheet, deleteTransactionFromSheet } from '../services/sheets';

interface DetailsProps {
  state: {
    transactions: Transaction[];
    members: Member[];
    sheetUrl?: string;
    exchangeRate: number;
  };
  onDeleteTransaction: (id: string) => void;
  updateState: (updates: any) => void;
  onSync: () => void;
  isSyncing: boolean;
}

const Details: React.FC<DetailsProps> = ({ state, onDeleteTransaction, updateState, onSync, isSyncing }) => {
  const [filterCategory, setFilterCategory] = useState<Category | '全部'>('全部');
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
      alert('儲存失敗，請檢查網路連線');
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

  const filteredTransactions = state.transactions
    .filter(t => filterCategory === '全部' || t.category === filterCategory)
    .filter(t => 
      t.item.toLowerCase().includes(searchQuery.toLowerCase()) || 
      t.merchant.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const dates = Array.from(new Set(filteredTransactions.map(t => t.date)));

  return (
    <div className="space-y-6 pb-24">
      <div className="sticky top-0 bg-[#FDFCF8]/90 backdrop-blur-md pt-2 pb-4 z-10 border-b-2 border-dashed border-slate-100">
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input 
              type="text"
              placeholder="搜尋店家或項目..."
              className="w-full bg-white comic-border rounded-2xl py-3 pl-12 pr-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#F6D32D]/50 transition-all"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={onSync}
            disabled={isSyncing}
            className="bg-[#F6D32D] comic-border w-12 rounded-2xl flex items-center justify-center comic-shadow-sm active:translate-y-0.5 transition-all disabled:opacity-50"
          >
            <RefreshCw size={20} className={isSyncing ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          {['全部', ...CATEGORIES].map(c => (
            <button 
              key={c}
              onClick={() => setFilterCategory(c as any)}
              className={`px-4 py-1.5 rounded-xl text-[11px] font-black comic-border whitespace-nowrap transition-all ${
                filterCategory === c ? 'bg-black text-white' : 'bg-white text-black hover:bg-slate-50'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-10">
        {dates.length > 0 ? (
          dates.map(date => (
            <div key={date} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="bg-white comic-border px-3 py-1 rounded-lg comic-shadow-sm flex items-center gap-2">
                  <Calendar size={14} strokeWidth={3} />
                  <span className="text-[11px] font-black uppercase tracking-widest">{date}</span>
                </div>
                <div className="flex-1 h-[2px] bg-slate-100"></div>
              </div>
              
              <div className="space-y-4">
                {filteredTransactions.filter(t => t.date === date).map(t => (
                  <div 
                    key={t.id} 
                    onClick={() => setEditingItem(t)}
                    className="bg-white comic-border p-4 rounded-3xl flex items-center gap-4 comic-shadow hover:translate-x-1 hover:-translate-y-1 transition-all cursor-pointer group"
                  >
                    <div className={`w-12 h-12 rounded-2xl border-2 border-black flex items-center justify-center shrink-0 ${CATEGORY_COLORS[t.category].split(' ')[0]}`}>
                      {CATEGORY_ICONS[t.category]}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-black text-slate-900 truncate">{t.merchant}</span>
                        {!t.isSplit ? (
                          <span className="shrink-0 bg-pink-100 text-pink-600 text-[8px] font-black px-1.5 py-0.5 rounded border border-pink-200 uppercase tracking-tighter flex items-center gap-0.5">
                            <ShieldAlert size={8} strokeWidth={3} /> 私帳
                          </span>
                        ) : (
                          <span className="shrink-0 bg-blue-50 text-blue-600 text-[8px] font-black px-1.5 py-0.5 rounded border border-blue-100 uppercase tracking-tighter flex items-center gap-0.5">
                            <Users size={8} strokeWidth={3} /> 公帳 {t.splitWith.length}人
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-bold text-slate-400 truncate mb-2 leading-snug">{t.item}</div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-5 px-2 bg-[#F6D32D] border border-black rounded-md flex items-center justify-center text-black font-black text-[9px]">
                          {state.members.find(m => m.id === t.payerId)?.name || '未知'}
                        </div>
                        <span className="text-[9px] font-bold text-slate-300 uppercase">付款</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 border-l-2 border-slate-50 pl-4">
                      <div className="font-black text-lg text-black leading-tight">
                        <span className="text-[10px] mr-1">NT$</span>
                        {t.ntdAmount.toLocaleString()}
                      </div>
                      <div className="text-[9px] font-bold text-slate-300 italic">
                        {t.originalAmount} {t.currency}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="py-24 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
              <Search size={32} />
            </div>
            <p className="text-slate-300 font-black italic">尚無符合條件的明細</p>
          </div>
        )}
      </div>

      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white comic-border rounded-[2.5rem] w-full max-w-sm p-8 comic-shadow relative overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black italic flex items-center gap-2">
                <Clock className="text-[#F6D32D]" /> 修改明細
              </h3>
              <button onClick={() => setEditingItem(null)} className="p-2 bg-slate-50 rounded-full">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 no-scrollbar">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-2xl border-2 border-black">
                  <label className="text-[10px] font-black text-slate-400 mb-1 block uppercase">日期</label>
                  <input 
                    type="date"
                    className="w-full bg-transparent font-black text-sm outline-none"
                    value={editingItem.date}
                    onChange={e => setEditingItem({...editingItem, date: e.target.value})}
                  />
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border-2 border-black">
                  <label className="text-[10px] font-black text-slate-400 mb-1 block uppercase">店家</label>
                  <input 
                    className="w-full bg-transparent font-black text-sm outline-none"
                    value={editingItem.merchant}
                    onChange={e => setEditingItem({...editingItem, merchant: e.target.value})}
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border-2 border-black">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase">帳目類型</label>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${editingItem.isSplit ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}>
                    {editingItem.type}
                  </span>
                </div>
                <label className="text-[10px] font-black text-slate-400 mb-1 block uppercase">項目內容</label>
                <textarea 
                  className="w-full bg-transparent font-bold text-sm min-h-[60px] outline-none"
                  value={editingItem.item}
                  onChange={e => setEditingItem({...editingItem, item: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#FFFDF0] p-3 rounded-2xl border-2 border-[#E64A4A]">
                  <label className="text-[10px] font-black text-[#E64A4A] mb-1 block uppercase tracking-tighter">台幣金額</label>
                  <input 
                    type="number"
                    placeholder="0"
                    className="w-full bg-transparent font-black text-lg outline-none"
                    value={editingItem.ntdAmount === 0 ? '' : editingItem.ntdAmount}
                    onChange={e => setEditingItem({...editingItem, ntdAmount: e.target.value ? Number(e.target.value) : 0})}
                  />
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border-2 border-black">
                  <label className="text-[10px] font-black text-slate-400 mb-1 block uppercase">外幣 ({editingItem.currency})</label>
                  <input 
                    type="number"
                    placeholder="0"
                    className="w-full bg-transparent font-black text-lg outline-none"
                    value={editingItem.originalAmount === 0 ? '' : editingItem.originalAmount}
                    onChange={e => handleAmountChange(e.target.value ? Number(e.target.value) : 0)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-2xl border-2 border-black">
                  <label className="text-[10px] font-black text-slate-400 mb-1 block uppercase">分類</label>
                  <select 
                    className="w-full bg-transparent font-black text-sm appearance-none outline-none"
                    value={editingItem.category}
                    onChange={e => setEditingItem({...editingItem, category: e.target.value as Category})}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border-2 border-black">
                  <label className="text-[10px] font-black text-slate-400 mb-1 block uppercase">付款人</label>
                  <select 
                    className="w-full bg-transparent font-black text-sm appearance-none outline-none"
                    value={editingItem.payerId}
                    onChange={e => setEditingItem({...editingItem, payerId: e.target.value})}
                  >
                    {state.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button 
                disabled={isSaving}
                onClick={() => handleDelete(editingItem)}
                className="p-4 bg-white border-2 border-red-200 text-red-500 rounded-2xl hover:bg-red-50 transition-all disabled:opacity-50"
              >
                <Trash2 size={20} />
              </button>
              <button 
                disabled={isSaving}
                onClick={handleSaveEdit}
                className="flex-1 py-4 bg-black text-white rounded-2xl font-black comic-shadow-sm flex items-center justify-center gap-2 active:translate-y-1 transition-all disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={18} />}
                {isSaving ? '儲存中...' : '儲存修改'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Details;
