
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Send, Loader2, Check, Sparkles, Coins, X, Clock } from 'lucide-react';
import { processAIInput, processReceiptImage } from '../services/gemini';
import { Transaction, Category, Member } from '../types';
import { CATEGORIES } from '../constants';

interface AIInputProps {
  onAddTransaction: (t: Partial<Transaction>) => void;
  members: Member[];
  exchangeRate: number;
  defaultCurrency: string;
  setIsAIProcessing: (loading: boolean) => void; // 新增：傳遞控制函式
}

const AIInput: React.FC<AIInputProps> = ({ onAddTransaction, members, exchangeRate, defaultCurrency, setIsAIProcessing }) => {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingRecord, setPendingRecord] = useState<(Partial<Transaction> & { source?: 'text' | 'image' }) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ntdInputRef = useRef<HTMLInputElement>(null);

  // 當內部 isLoading 改變時，回報給全局
  useEffect(() => {
    setIsAIProcessing(isLoading);
  }, [isLoading, setIsAIProcessing]);

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
    
    if (newSplit.length === 0) return;

    const isSplit = newSplit.length > 1;
    let newCategory = pendingRecord.category;
    
    if (isSplit && newCategory === '個人消費') {
      newCategory = '雜項';
    } else if (!isSplit) {
      newCategory = '個人消費';
    }

    setPendingRecord({ 
      ...pendingRecord, 
      splitWith: newSplit,
      isSplit: isSplit,
      type: isSplit ? '公帳' : '私帳',
      category: newCategory as Category
    });
  };

  const confirmRecord = () => {
    if (pendingRecord) {
      onAddTransaction(pendingRecord);
      setPendingRecord(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 確認明細全螢幕彈窗 */}
      {pendingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white border-[3px] border-black rounded-[2.5rem] sm:rounded-[3rem] w-full max-w-sm p-6 sm:p-8 comic-shadow relative animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-xl sm:text-2xl flex items-center gap-3 text-slate-900 italic">
                <Check className="text-green-500" size={24} strokeWidth={4} /> 確認消費明細
              </h3>
              <button 
                onClick={() => setPendingRecord(null)} 
                className="p-2 bg-slate-50 rounded-full text-slate-400"
              >
                <X size={20} strokeWidth={3} />
              </button>
            </div>
            
            <div className="space-y-3.5 max-h-[60vh] overflow-y-auto no-scrollbar pb-4 pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-2.5 rounded-xl border-[3px] border-black">
                  <label className="text-[10px] font-black text-slate-400 mb-0.5 block uppercase tracking-widest">日期</label>
                  <input 
                    type="date"
                    className="w-full bg-transparent border-none focus:ring-0 text-sm sm:text-base font-black text-slate-900 p-0"
                    value={pendingRecord.date}
                    onChange={e => setPendingRecord({...pendingRecord, date: e.target.value})}
                  />
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border-[3px] border-black">
                  <label className="text-[10px] font-black text-slate-400 mb-0.5 block uppercase tracking-widest">店家</label>
                  <input 
                    className="w-full bg-transparent border-none focus:ring-0 text-sm sm:text-base font-black text-slate-900 p-0"
                    value={pendingRecord.merchant}
                    onChange={e => setPendingRecord({...pendingRecord, merchant: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#FFFDF0] p-2.5 rounded-xl border-[3px] border-[#E64A4A]">
                  <label className="text-[10px] font-black text-[#E64A4A] mb-0.5 block uppercase tracking-tighter">台幣金額</label>
                  <input 
                    ref={ntdInputRef}
                    type="number"
                    placeholder="0"
                    className="w-full bg-transparent border-none focus:ring-0 text-lg sm:text-xl font-black text-slate-900 p-0"
                    value={pendingRecord.ntdAmount || ''}
                    onChange={e => setPendingRecord({...pendingRecord, ntdAmount: e.target.value ? Number(e.target.value) : 0})}
                  />
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border-[3px] border-black">
                  <label className="text-[10px] font-black text-slate-400 mb-0.5 block uppercase tracking-widest">外幣金額</label>
                  <div className="flex items-center">
                    <input 
                      className="text-[10px] sm:text-sm font-black mr-1 text-slate-400 w-10 bg-transparent border-none p-0 focus:ring-0 uppercase"
                      value={pendingRecord.currency}
                      onChange={e => handleCurrencyChange(e.target.value.toUpperCase())}
                    />
                    <input 
                      type="number"
                      placeholder="0"
                      className="w-full bg-transparent border-none focus:ring-0 text-lg sm:text-xl font-black text-slate-900 p-0"
                      value={pendingRecord.originalAmount || ''}
                      onChange={e => handleOriginalAmountChange(e.target.value ? Number(e.target.value) : 0)}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-2.5 rounded-xl border-[3px] border-black">
                  <label className="text-[10px] font-black text-slate-400 mb-0.5 block uppercase tracking-widest">分類</label>
                  <select 
                    className="w-full bg-transparent border-none focus:ring-0 text-sm sm:text-base font-black appearance-none text-slate-900 p-0"
                    value={pendingRecord.category}
                    onChange={e => setPendingRecord({...pendingRecord, category: e.target.value as Category})}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border-[3px] border-black">
                  <label className="text-[10px] font-black text-slate-400 mb-0.5 block uppercase tracking-widest">付款人</label>
                  <select 
                    className="w-full bg-transparent border-none focus:ring-0 text-sm sm:text-base font-black appearance-none text-slate-900 p-0"
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

              <div className="bg-slate-50 p-3 rounded-2xl border-[3px] border-black">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex flex-col">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">參與分帳人員</label>
                    <span className={`text-[8px] font-black mt-1 ${pendingRecord.isSplit ? 'text-blue-500' : 'text-pink-500'}`}>
                      (類型: {pendingRecord.isSplit ? '公帳' : '私帳'})
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
                    className="w-5 h-5 border-[2px] border-black rounded-lg"
                  />
                </div>
                <div className="flex flex-nowrap gap-1 overflow-x-auto no-scrollbar pt-1">
                  {members.map(m => (
                    <button
                      key={m.id}
                      onClick={() => toggleSplitMember(m.id)}
                      className={`flex-1 min-w-0 py-1.5 px-1 rounded-lg text-[11px] font-black border-2 transition-all whitespace-nowrap overflow-hidden text-ellipsis ${
                        pendingRecord.splitWith?.includes(m.id) 
                          ? 'bg-[#F6D32D] text-black border-black shadow-sm' 
                          : 'bg-white text-slate-300 border-slate-100'
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border-[3px] border-black">
                <label className="text-[10px] font-black text-slate-400 mb-2 block uppercase tracking-widest">項目內容 (收據清單)</label>
                <textarea 
                  className="w-full bg-transparent border-none focus:ring-0 text-sm sm:text-base font-bold min-h-[140px] leading-relaxed text-slate-900 p-0 resize-none whitespace-pre-wrap"
                  placeholder="收據詳細品項..."
                  value={pendingRecord.item}
                  onChange={e => setPendingRecord({...pendingRecord, item: e.target.value})}
                />
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button 
                onClick={() => setPendingRecord(null)}
                className="flex-1 py-4 bg-white border-[3px] border-slate-200 rounded-2xl font-black text-slate-400 text-base active:scale-95 transition-all"
              >
                取消
              </button>
              <button 
                onClick={confirmRecord}
                className="flex-[2] py-4 bg-black text-white rounded-2xl font-black comic-shadow-sm text-base active:translate-y-1 transition-all"
              >
                確認送出
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 快速輸入與上傳按鈕 */}
      <div className="bg-[#F6D32D] border-[3px] border-black rounded-[2rem] p-4 sm:p-6 comic-shadow">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={16} className="text-black" />
          <span className="font-black text-[12px] sm:text-[13px] uppercase tracking-[0.15em] text-black/80">快速文字記帳 ({defaultCurrency})</span>
        </div>
        <div className="relative">
          <input 
            type="text"
            placeholder={`例如：咖啡 5`}
            className="w-full bg-white border-[3px] border-black rounded-2xl py-4 sm:py-5 pl-5 sm:pl-6 pr-14 sm:pr-16 focus:outline-none text-black font-black text-base sm:text-lg placeholder:text-slate-300"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTextSubmit()}
          />
          <button 
            onClick={handleTextSubmit}
            disabled={isLoading || !inputText}
            className="absolute right-2 top-2 bottom-2 px-3 bg-black text-white rounded-xl disabled:opacity-50 active:scale-95 transition-all"
          >
            {isLoading ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} strokeWidth={3} />}
          </button>
        </div>
      </div>

      <div className="w-full">
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="w-full bg-white border-[3px] border-black rounded-[2.5rem] py-4 sm:py-6 px-4 sm:px-8 flex items-center justify-between comic-shadow hover:-translate-y-1 transition-all group overflow-hidden"
        >
          <div className="flex items-center gap-4 sm:gap-6 min-w-0">
            <div className="p-3 sm:p-4 bg-[#E64A4A] rounded-2xl text-white comic-border shadow-sm group-active:scale-95 transition-transform shrink-0">
              <Camera className="w-7 h-7 sm:w-8 sm:h-8" strokeWidth={3} />
            </div>
            <div className="text-left truncate">
              <span className="block text-lg sm:text-xl font-black text-black leading-tight mb-0.5 truncate">上傳收據讓AI幫你</span>
              <span className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest block truncate">自動辨識品項與金額</span>
            </div>
          </div>

          <div className="flex items-center pl-4 sm:pl-8 border-l-2 border-slate-100 h-10 sm:h-14 shrink-0">
            <div className="flex flex-col items-center gap-1">
              <Coins className="text-[#F6D32D] w-5 h-5 sm:w-6 sm:h-6" strokeWidth={3.5} />
              <span className="text-[11px] sm:text-[13px] font-black text-black tracking-wider uppercase leading-none">{defaultCurrency}</span>
            </div>
          </div>
        </button>
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
      </div>
    </div>
  );
};

export default AIInput;
