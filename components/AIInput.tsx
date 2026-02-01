
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Send, Check, X, Image as ImageIcon, Sparkles } from 'lucide-react';
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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const ntdInputRef = useRef<HTMLInputElement>(null);
  const hasFocusedInitialRef = useRef(false);

  useEffect(() => {
    setIsAIProcessing(isLoading);
  }, [isLoading, setIsAIProcessing]);

  const dismissKeyboard = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  useEffect(() => {
    if (!pendingRecord) {
      hasFocusedInitialRef.current = false;
      return;
    }
    if (pendingRecord.source === 'image' && !hasFocusedInitialRef.current) {
      const timer = setTimeout(() => {
        ntdInputRef.current?.focus();
        hasFocusedInitialRef.current = true;
      }, 400);
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
        e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const preparePendingRecord = (data: any, source: 'text' | 'image') => {
    const currency = data.currency?.toUpperCase() || defaultCurrency;
    const amount = Number(data.amount) || 0;
    const payerId = currentUserId || members[0]?.id || ''; 
    const sanitizedDate = (data.date || new Date().toISOString()).split('T')[0];
    const ntdAmount = currency === 'TWD' ? amount : Math.round(amount * exchangeRate);

    setPendingRecord({
      source,
      merchant: data.merchant || '未指定店家',
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
    setPendingRecord({ ...pendingRecord, originalAmount: val, ntdAmount: newNtd });
  };

  const toggleSplitMember = (memberId: string) => {
    if (!pendingRecord) return;
    dismissKeyboard();
    const currentSplit = pendingRecord.splitWith || [];
    const newSplit = currentSplit.includes(memberId)
      ? currentSplit.filter(id => id !== memberId)
      : [...currentSplit, memberId];
    
    if (newSplit.length === 0) return;
    const isSplit = newSplit.length > 1;
    setPendingRecord({ 
      ...pendingRecord, 
      splitWith: newSplit,
      isSplit: isSplit,
      type: isSplit ? '公帳' : '私帳',
      category: (isSplit ? (pendingRecord.category === '個人消費' ? '雜項' : pendingRecord.category) : '個人消費') as Category
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
      {/* 品牌 Header - 升級 3D 圖示解決顯示問題 */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-[#FFDADA] border-[3.5px] border-black rounded-2xl flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] shrink-0 transform -rotate-3 overflow-hidden p-1.5">
            {/* 更換為 Microsoft Fluent 3D 圖示，更穩定且視覺效果更好 */}
            <img 
              src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Pig%20Face.png" 
              alt="🐷" 
              className="w-full h-full object-contain drop-shadow-md"
              loading="lazy"
            />
          </div>
          <div>
            <h2 className="text-2xl font-black text-black leading-none tracking-tight mb-1 italic">
              智帳旅行
            </h2>
            <div className="flex items-center gap-1.5">
              <Sparkles size={11} className="text-[#F6D32D] fill-current" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] opacity-80">TripSplit AI</span>
            </div>
          </div>
        </div>
        
        {/* 匯率標籤 */}
        <div className="group relative">
           <div className="absolute inset-0 bg-black rounded-xl translate-x-1 translate-y-1 group-hover:translate-x-0.5 group-hover:translate-y-0.5 transition-all"></div>
           <div className="relative bg-white border-[2.5px] border-black px-4 py-2 rounded-xl text-[11px] font-black flex items-center gap-2">
              <span className="text-blue-500">1 {defaultCurrency}</span>
              <span className="text-slate-300">=</span>
              <span className="text-red-500">{exchangeRate} TWD</span>
           </div>
        </div>
      </div>

      {/* 主卡片區域 */}
      <div className="bg-white border-[3.5px] border-black rounded-[2.5rem] p-5 comic-shadow space-y-3">
        
        {/* 輸入框容器 */}
        <div className="relative">
          <textarea 
            placeholder="Coop 咖啡3 可頌1.9"
            className="w-full h-24 bg-white border-[3.5px] border-black rounded-2xl pl-6 pr-16 py-4 text-lg font-bold shadow-sm focus:outline-none transition-all placeholder:text-slate-200 placeholder:font-bold resize-none"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleTextSubmit();
              }
            }}
          />
          <button 
            onClick={handleTextSubmit}
            disabled={isLoading || !inputText.trim()}
            className="absolute right-3 bottom-4 w-11 h-11 bg-white border-[2.5px] border-slate-100 rounded-full flex items-center justify-center text-[#FFBABA] hover:text-[#FF8585] hover:border-black transition-all disabled:opacity-30 shadow-sm"
          >
            <Send size={20} strokeWidth={3} className="ml-0.5" />
          </button>
        </div>

        {/* 底部功能按鈕組 */}
        <div className="flex justify-center items-center gap-6 pt-0">
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="w-16 h-16 bg-white border-[3.5px] border-black rounded-full flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all hover:bg-slate-50 disabled:opacity-50"
          >
            <ImageIcon size={28} strokeWidth={3} className="text-black" />
          </button>

          <button 
            onClick={() => cameraInputRef.current?.click()}
            disabled={isLoading}
            className="w-16 h-16 bg-[#F6D32D] border-[3.5px] border-black rounded-full flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all hover:bg-yellow-300 disabled:opacity-50"
          >
            <Camera size={28} strokeWidth={3} className="text-black" />
          </button>
        </div>

        <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />
        <input type="file" ref={cameraInputRef} hidden accept="image/*" capture="environment" onChange={handleImageUpload} />
      </div>

      {/* 確認彈窗 */}
      {pendingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border-[3.5px] border-black rounded-[2.5rem] w-full max-w-sm p-7 comic-shadow relative animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-2xl flex items-center gap-3 text-slate-900">
                <Check className="text-green-500" size={28} strokeWidth={4} /> 確認明細
              </h3>
              <button onClick={() => setPendingRecord(null)} className="p-2 bg-slate-50 rounded-full text-slate-400">
                <X size={24} strokeWidth={3} />
              </button>
            </div>
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar pb-2">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="bg-slate-50 p-3 rounded-2xl border-[2.5px] border-black">
                  <label className="text-[10px] font-black text-slate-400 mb-1 block uppercase tracking-widest">日期</label>
                  <input type="date" className="w-full bg-transparent border-none focus:ring-0 text-base font-black p-0" value={pendingRecord.date} onChange={e => setPendingRecord({...pendingRecord, date: e.target.value})} />
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border-[2.5px] border-black">
                  <label className="text-[10px] font-black text-slate-400 mb-1 block uppercase tracking-widest">店家</label>
                  <input className="w-full bg-transparent border-none focus:ring-0 text-base font-black p-0" value={pendingRecord.merchant} onChange={e => setPendingRecord({...pendingRecord, merchant: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="bg-[#FFFDF0] p-3 rounded-2xl border-[2.5px] border-[#E64A4A]">
                  <label className="text-[10px] font-black text-[#E64A4A] mb-1 block uppercase tracking-tighter">台幣金額</label>
                  <input type="number" className="w-full bg-transparent border-none focus:ring-0 text-xl font-black p-0" value={pendingRecord.ntdAmount || ''} onChange={e => setPendingRecord({...pendingRecord, ntdAmount: Number(e.target.value)})} />
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border-[2.5px] border-black">
                  <label className="text-[10px] font-black text-slate-400 mb-1 block uppercase tracking-wider">外幣 ({pendingRecord.currency})</label>
                  <input type="number" className="w-full bg-transparent border-none focus:ring-0 text-xl font-black p-0" value={pendingRecord.originalAmount || ''} onChange={e => handleOriginalAmountChange(Number(e.target.value))} />
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border-[2.5px] border-black">
                <label className="text-[10px] font-black text-slate-400 mb-3 block uppercase tracking-widest">參與成員</label>
                <div className="flex flex-wrap gap-2">
                  {members.map(m => (
                    <button
                      key={m.id}
                      onClick={() => toggleSplitMember(m.id)}
                      className={`py-2 px-4 rounded-xl text-[12px] font-black border-2 transition-all ${
                        pendingRecord.splitWith?.includes(m.id) ? 'bg-[#F6D32D] border-black shadow-sm' : 'bg-white border-slate-100 text-slate-300'
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border-[2.5px] border-black">
                <label className="text-[10px] font-black text-slate-400 mb-2 block uppercase tracking-widest">項目內容</label>
                <textarea className="w-full bg-transparent border-none focus:ring-0 font-bold text-sm leading-snug p-0 resize-none min-h-[100px]" value={pendingRecord.item} onChange={e => setPendingRecord({...pendingRecord, item: e.target.value})} />
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button onClick={() => setPendingRecord(null)} className="flex-1 py-4 border-[2.5px] border-black rounded-2xl font-black text-base active:scale-95 transition-all">取消</button>
              <button onClick={confirmRecord} className="flex-1 py-4 bg-black text-white rounded-2xl font-black text-base shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 transition-all">確認</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIInput;
