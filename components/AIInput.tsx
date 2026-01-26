
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
  setIsAIProcessing: (loading: boolean) => void;
  currentUserId: string;
}

const AIInput: React.FC<AIInputProps> = ({ onAddTransaction, members, exchangeRate, defaultCurrency, setIsAIProcessing, currentUserId }) => {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingRecord, setPendingRecord] = useState<(Partial<Transaction> & { source?: 'text' | 'image' }) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ntdInputRef = useRef<HTMLInputElement>(null);
  
  // 用於追蹤當前這筆 pendingRecord 是否已經執行過首次聚焦
  const hasFocusedInitialRef = useRef(false);

  // 當內部 isLoading 改變時，回報給全局
  useEffect(() => {
    setIsAIProcessing(isLoading);
  }, [isLoading, setIsAIProcessing]);

  // 輔助函式：主動收起鍵盤，改善點擊選取人員時的 UX
  const dismissKeyboard = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  // 優化聚焦邏輯：僅在「首次」開啟且來源為圖片時觸發
  useEffect(() => {
    if (!pendingRecord) {
      // 關閉視窗或清空時，重置聚焦標記
      hasFocusedInitialRef.current = false;
      return;
    }

    // 只有在還沒聚焦過，且這筆紀錄是從圖片產生的時候才自動彈出鍵盤
    if (pendingRecord.source === 'image' && !hasFocusedInitialRef.current) {
      const timer = setTimeout(() => {
        ntdInputRef.current?.focus();
        hasFocusedInitialRef.current = true;
      }, 400); // 稍微延遲等待 Modal 動畫
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
        alert('AI圖片處理失敗');
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const preparePendingRecord = (data: any, source: 'text' | 'image') => {
    const currency = data.currency?.toUpperCase() || defaultCurrency || 'CHF';
    const amount = Number(data.amount) || 0;
    const payerId = currentUserId || members[0]?.id || ''; 
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

  const toggleSplitMember = (memberId: string) => {
    if (!pendingRecord) return;
    
    // 點擊人員時主動收回鍵盤，方便看清楚名單
    dismissKeyboard();

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
      <div className="flex gap-3 items-center">
        <div className="flex-1 relative">
          <input 
            type="text"
            placeholder="輸入消費內容或語音..."
            className="w-full bg-white comic-border rounded-2xl py-4 pl-5 pr-14 text-lg font-bold shadow-sm focus:outline-none"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTextSubmit()}
          />
          <button 
            onClick={handleTextSubmit}
            disabled={isLoading || !inputText.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 text-black hover:bg-slate-50 rounded-xl transition-all disabled:opacity-30"
          >
            <Send size={24} strokeWidth={3} />
          </button>
        </div>
        
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="bg-black text-white w-14 h-14 rounded-2xl comic-shadow-sm flex items-center justify-center transition-all active:translate-y-1 disabled:opacity-50 shrink-0"
        >
          <Camera size={28} />
        </button>
        <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />
      </div>

      {pendingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white border-[3px] border-black rounded-[2.5rem] sm:rounded-[3rem] w-full max-w-sm p-6 sm:p-8 comic-shadow relative animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-xl sm:text-2xl flex items-center gap-3 text-slate-900 italic">
                <Check className="text-green-500" size={24} strokeWidth={4} /> 確認消費明細
              </h3>
              <button onClick={() => setPendingRecord(null)} className="p-2 bg-slate-50 rounded-full text-slate-400">
                <X size={20} strokeWidth={3} />
              </button>
            </div>
            
            <div className="space-y-3.5 max-h-[60vh] overflow-y-auto no-scrollbar pb-4 pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-2.5 rounded-xl border-[3px] border-black">
                  <label className="text-[10px] font-black text-slate-400 mb-0.5 block uppercase tracking-widest">日期</label>
                  <input type="date" className="w-full bg-transparent border-none focus:ring-0 text-sm sm:text-base font-black text-slate-900 p-0" value={pendingRecord.date} onChange={e => setPendingRecord({...pendingRecord, date: e.target.value})} />
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border-[3px] border-black">
                  <label className="text-[10px] font-black text-slate-400 mb-0.5 block uppercase tracking-widest">店家</label>
                  <input className="w-full bg-transparent border-none focus:ring-0 text-sm sm:text-base font-black text-slate-900 p-0" value={pendingRecord.merchant} onChange={e => setPendingRecord({...pendingRecord, merchant: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#FFFDF0] p-2.5 rounded-xl border-[3px] border-[#E64A4A]">
                  <label className="text-[10px] font-black text-[#E64A4A] mb-0.5 block uppercase tracking-tighter">台幣金額</label>
                  <input 
                    ref={ntdInputRef}
                    type="number"
                    inputMode="numeric"
                    placeholder="0"
                    className="w-full bg-transparent border-none focus:ring-0 text-lg sm:text-xl font-black text-slate-900 p-0"
                    value={pendingRecord.ntdAmount || ''}
                    onChange={e => setPendingRecord({...pendingRecord, ntdAmount: e.target.value ? Number(e.target.value) : 0})}
                  />
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border-[3px] border-black">
                  <label className="text-[10px] font-black text-slate-400 mb-0.5 block uppercase tracking-wider">外幣 ({pendingRecord.currency})</label>
                  <input type="number" inputMode="decimal" placeholder="0" className="w-full bg-transparent border-none focus:ring-0 text-lg sm:text-xl font-black text-slate-900 p-0" value={pendingRecord.originalAmount || ''} onChange={e => handleOriginalAmountChange(e.target.value ? Number(e.target.value) : 0)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-2.5 rounded-xl border-[3px] border-black">
                  <label className="text-[10px] font-black text-slate-400 mb-0.5 block uppercase tracking-widest">分類</label>
                  <select className="w-full bg-transparent border-none focus:ring-0 text-sm sm:text-base font-black text-slate-900 p-0 appearance-none" value={pendingRecord.category} onChange={e => setPendingRecord({...pendingRecord, category: e.target.value as Category})}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border-[3px] border-black">
                  <label className="text-[10px] font-black text-slate-400 mb-0.5 block uppercase tracking-widest">付款人</label>
                  <select className="w-full bg-transparent border-none focus:ring-0 text-sm sm:text-base font-black text-slate-900 p-0 appearance-none" value={pendingRecord.payerId} onChange={e => setPendingRecord({...pendingRecord, payerId: e.target.value})}>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border-[3px] border-black">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">參與分帳人員 <span className="text-[8px] text-blue-500">(類型: {pendingRecord.type})</span></label>
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 accent-blue-500" 
                    checked={pendingRecord.isSplit} 
                    onChange={e => {
                      dismissKeyboard(); // 切換分帳類型時收起鍵盤
                      const isSplit = e.target.checked;
                      setPendingRecord({
                        ...pendingRecord, 
                        isSplit, 
                        type: isSplit ? '公帳' : '私帳',
                        splitWith: isSplit ? members.map(m => m.id) : [pendingRecord.payerId || currentUserId],
                        category: isSplit ? (pendingRecord.category === '個人消費' ? '雜項' : pendingRecord.category) : '個人消費'
                      });
                    }} 
                  />
                </div>
                <div className="flex flex-nowrap gap-1.5 overflow-x-auto no-scrollbar pt-1">
                  {members.map(m => (
                    <button
                      key={m.id}
                      onClick={() => toggleSplitMember(m.id)}
                      className={`flex-1 min-w-0 py-2 px-1 rounded-xl text-[11px] font-black border-2 transition-all whitespace-nowrap overflow-hidden text-ellipsis ${
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
                  className="w-full bg-transparent border-none focus:ring-0 font-bold text-sm sm:text-base leading-relaxed p-0 text-slate-950 resize-none whitespace-pre-wrap min-h-[100px]"
                  value={pendingRecord.item}
                  onChange={e => setPendingRecord({...pendingRecord, item: e.target.value})}
                />
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button onClick={() => setPendingRecord(null)} className="flex-1 py-4 bg-white border-[3px] border-black rounded-2xl font-black text-base active:scale-95 transition-all">
                取消
              </button>
              <button onClick={confirmRecord} className="flex-1 py-4 bg-black text-white rounded-2xl font-black text-base comic-shadow-sm active:translate-y-1 transition-all">
                確認送出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIInput;
