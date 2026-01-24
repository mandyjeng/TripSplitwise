
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Send, Loader2, Check, CreditCard, Store, Sparkles, User, Users, Tag } from 'lucide-react';
import { processAIInput, processReceiptImage } from '../services/gemini';
import { Transaction, Category, Member } from '../types';
import { CATEGORIES } from '../constants';

interface AIInputProps {
  onAddTransaction: (t: Partial<Transaction>) => void;
  members: Member[];
  exchangeRate: number;
  defaultCurrency: string;
}

const AIInput: React.FC<AIInputProps> = ({ onAddTransaction, members, exchangeRate, defaultCurrency }) => {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingRecord, setPendingRecord] = useState<(Partial<Transaction> & { source?: 'text' | 'image' }) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ntdInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pendingRecord && pendingRecord.source === 'image') {
      const timer = setTimeout(() => {
        ntdInputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [pendingRecord]);

  const handleTextSubmit = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    try {
      const result = await processAIInput(inputText, defaultCurrency);
      preparePendingRecord(result, 'text');
      setInputText('');
    } catch (error) {
      console.error(error);
      alert('AI 處理失敗');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        const result = await processReceiptImage(base64);
        preparePendingRecord(result, 'image');
      } catch (error) {
        console.error(error);
        alert('AI圖片處理失敗:'+error);
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const preparePendingRecord = (data: any, source: 'text' | 'image') => {
    const currency = data.currency?.toUpperCase() || defaultCurrency || 'CHF';
    const amount = Number(data.amount) || 0;
    const payerId = members[0]?.id || '';
    const sanitizedDate = (data.date || new Date().toISOString()).split('T')[0];
    const ntdAmount = currency === 'TWD' ? amount : Math.round(amount * exchangeRate);

    setPendingRecord({
      source,
      merchant: data.merchant || '未知店家',
      item: data.item || '未命名項目',
      originalAmount: amount,
      currency: currency,
      category: (CATEGORIES.includes(data.category as Category) ? data.category : '雜項') as Category,
      date: sanitizedDate,
      ntdAmount: ntdAmount,
      payerId: payerId,
      isSplit: true,
      splitWith: members.map(m => m.id),
      type: '公帳',
      exchangeRate: exchangeRate
    });
  };

  const handleOriginalAmountChange = (val: number) => {
    if (!pendingRecord) return;
    const isTwd = pendingRecord.currency === 'TWD';
    const newNtd = isTwd ? val : Math.round(val * exchangeRate);
    setPendingRecord({
      ...pendingRecord,
      originalAmount: val,
      ntdAmount: newNtd
    });
  };

  const handleCurrencyChange = (cur: string) => {
    if (!pendingRecord) return;
    const amount = pendingRecord.originalAmount || 0;
    const newNtd = cur === 'TWD' ? amount : Math.round(amount * exchangeRate);
    setPendingRecord({
      ...pendingRecord,
      currency: cur,
      ntdAmount: newNtd
    });
  };

  const toggleSplitMember = (memberId: string) => {
    if (!pendingRecord) return;
    const currentSplit = pendingRecord.splitWith || [];
    const newSplit = currentSplit.includes(memberId)
      ? currentSplit.filter(id => id !== memberId)
      : [...currentSplit, memberId];
    setPendingRecord({ ...pendingRecord, splitWith: newSplit });
  };

  const confirmRecord = () => {
    if (pendingRecord) {
      onAddTransaction(pendingRecord);
      setPendingRecord(null);
    }
  };

  if (pendingRecord) {
    return (
      <div className="bg-white border-2 border-black rounded-[1.5rem] p-5 comic-shadow animate-in zoom-in-95 duration-200">
        <h3 className="font-black text-xl mb-4 flex items-center gap-2 text-slate-900">
          <Check className="text-green-500" size={20} strokeWidth={4} /> 確認消費明細
        </h3>
        
        <div className="space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar pb-2">
          {/* 日期與店家 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <label className="text-[10px] font-black text-slate-400 mb-1 block uppercase tracking-wider">日期</label>
              <input 
                type="date"
                className="w-full bg-transparent border-none focus:ring-0 text-sm font-black text-slate-900"
                value={pendingRecord.date}
                onChange={e => setPendingRecord({...pendingRecord, date: e.target.value})}
              />
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <label className="text-[10px] font-black text-slate-400 mb-1 block uppercase tracking-wider">店家</label>
              <input 
                className="w-full bg-transparent border-none focus:ring-0 text-sm font-black text-slate-900"
                value={pendingRecord.merchant}
                onChange={e => setPendingRecord({...pendingRecord, merchant: e.target.value})}
              />
            </div>
          </div>

          {/* 項目內容 */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <label className="text-[10px] font-black text-slate-400 mb-1 block uppercase tracking-wider">項目內容</label>
            <textarea 
              className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold min-h-[40px] leading-snug text-slate-900"
              value={pendingRecord.item}
              onChange={e => setPendingRecord({...pendingRecord, item: e.target.value})}
            />
          </div>

          {/* 分類與付款人 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <label className="text-[10px] font-black text-slate-400 mb-1 block uppercase tracking-wider">分類</label>
              <select 
                className="w-full bg-transparent border-none focus:ring-0 text-sm font-black appearance-none text-slate-900"
                value={pendingRecord.category}
                onChange={e => setPendingRecord({...pendingRecord, category: e.target.value as Category})}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <label className="text-[10px] font-black text-slate-400 mb-1 block uppercase tracking-wider">付款人</label>
              <select 
                className="w-full bg-transparent border-none focus:ring-0 text-sm font-black appearance-none text-slate-900"
                value={pendingRecord.payerId}
                onChange={e => {
                  const newPayerId = e.target.value;
                  const updates: Partial<Transaction> = { payerId: newPayerId };
                  if (!pendingRecord.isSplit) {
                    updates.splitWith = [newPayerId];
                  }
                  setPendingRecord({...pendingRecord, ...updates});
                }}
              >
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>

          {/* 金額區域 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <label className="text-[10px] font-black text-slate-400 mb-1 block uppercase tracking-wider">外幣金額</label>
              <div className="flex items-center">
                <input 
                  className="text-xs font-black mr-2 text-slate-400 w-10 bg-transparent border-none p-0 focus:ring-0 uppercase"
                  value={pendingRecord.currency}
                  onChange={e => handleCurrencyChange(e.target.value.toUpperCase())}
                />
                <input 
                  type="number"
                  placeholder="0"
                  className="w-full bg-transparent border-none focus:ring-0 text-base font-black text-slate-900"
                  value={pendingRecord.originalAmount || ''}
                  onChange={e => handleOriginalAmountChange(e.target.value ? Number(e.target.value) : 0)}
                />
              </div>
            </div>
            <div className="bg-[#FFFDF0] p-3 rounded-xl border-2 border-black">
              <label className="text-[10px] font-black text-[#E64A4A] mb-1 block uppercase tracking-tighter">台幣金額 (自動/手動)</label>
              <input 
                ref={ntdInputRef}
                type="number"
                placeholder="0"
                className="w-full bg-transparent border-none focus:ring-0 text-base font-black placeholder:text-slate-300 text-slate-900"
                value={pendingRecord.ntdAmount || ''}
                onChange={e => setPendingRecord({...pendingRecord, ntdAmount: e.target.value ? Number(e.target.value) : 0})}
              />
            </div>
          </div>

          {/* 是否拆帳與成員 */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div className="flex justify-between items-center mb-2">
              <div className="flex flex-col">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">是否拆帳</label>
                <span className={`text-[10px] font-black ${pendingRecord.isSplit ? 'text-blue-500' : 'text-pink-500'}`}>
                  (目前類型: {pendingRecord.isSplit ? '公帳' : '私帳'})
                </span>
              </div>
              <input 
                type="checkbox"
                checked={pendingRecord.isSplit}
                onChange={e => {
                  const isSplit = e.target.checked;
                  const updates: Partial<Transaction> = { 
                    isSplit,
                    type: isSplit ? '公帳' : '私帳'
                  };
                  if (!isSplit) {
                    updates.category = '個人消費';
                    updates.splitWith = [pendingRecord.payerId || ''];
                  } else {
                    if (pendingRecord.category === '個人消費') {
                      updates.category = '雜項';
                    }
                    updates.splitWith = members.map(m => m.id);
                  }
                  setPendingRecord({...pendingRecord, ...updates});
                }}
                className="w-5 h-5 border-2 border-black rounded"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {members.map(m => (
                <button
                  key={m.id}
                  disabled={!pendingRecord.isSplit}
                  onClick={() => toggleSplitMember(m.id)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black border-2 border-black transition-all ${
                    !pendingRecord.isSplit ? 'opacity-30' : ''
                  } ${
                    pendingRecord.splitWith?.includes(m.id) 
                      ? 'bg-[#F6D32D] text-black translate-y-[-1px]' 
                      : 'bg-white text-slate-300 border-slate-100'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
            <label className="text-[9px] font-black text-slate-300 mt-2 block uppercase tracking-widest">分攤成員 (對應試算表 splitWith)</label>
          </div>

          <div className="flex gap-3 pt-2">
            <button 
              onClick={() => setPendingRecord(null)}
              className="flex-1 py-3 bg-white border-2 border-slate-200 rounded-xl font-black text-slate-400 text-sm"
            >
              取消
            </button>
            <button 
              onClick={confirmRecord}
              className="flex-[2] py-3 bg-black text-white rounded-xl font-black comic-shadow text-sm"
            >
              送出明細
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-[#F6D32D] border-2 border-black rounded-[1.5rem] p-5 comic-shadow">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} />
          <span className="font-black text-[10px] uppercase tracking-widest">快速文字記帳 ({defaultCurrency})</span>
        </div>
        <div className="relative">
          <input 
            type="text"
            placeholder={`例如：飲料2 (自動辨識品項與金額)`}
            className="w-full bg-white border-2 border-black rounded-xl py-3 pl-5 pr-12 focus:outline-none text-black font-bold text-base"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTextSubmit()}
          />
          <button 
            onClick={handleTextSubmit}
            disabled={isLoading || !inputText}
            className="absolute right-2 top-2 p-1.5 bg-black text-white rounded-lg disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="bg-white border-2 border-black rounded-[1.5rem] py-5 flex flex-col items-center justify-center gap-2 comic-shadow"
        >
          <div className="p-3 bg-[#E64A4A] rounded-xl text-white">
            <Camera size={24} strokeWidth={3} />
          </div>
          <span className="text-sm font-black uppercase tracking-widest">拍收據</span>
        </button>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
        
        <div className="bg-white border-2 border-black rounded-[1.5rem] p-4 flex flex-col items-center justify-center text-center comic-shadow">
          <p className="text-[9px] font-black text-slate-400 leading-tight uppercase">預設幣別: {defaultCurrency}<br/>會自動帶入確認視窗</p>
        </div>
      </div>
    </div>
  );
};

export default AIInput;
