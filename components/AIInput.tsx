
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Camera, Send, Check, X, Image as ImageIcon, Sparkles, Zap, Users, Calculator, ArrowRightLeft, UserCheck, Tag, CreditCard, ChevronDown, Loader2 } from 'lucide-react';
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
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');
  const [customSplitCurrency, setCustomSplitCurrency] = useState<'ORIGINAL' | 'TWD'>('ORIGINAL');
  
  const [openDropdown, setOpenDropdown] = useState<'payer' | 'category' | 'type' | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsAIProcessing(isLoading);
  }, [isLoading, setIsAIProcessing]);

  useEffect(() => {
    const handleClickOutside = () => setOpenDropdown(null);
    if (openDropdown) window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [openDropdown]);

  const handleTextSubmit = async () => {
    if (!inputText.trim() || isLoading) return;
    setIsLoading(true);
    try {
      const result = await processAIInput(inputText, defaultCurrency);
      preparePendingRecord(result, 'text');
      setInputText('');
    } catch (error) {
      console.error(error);
      alert('AI 處理失敗，請檢查網路連線或 API Key');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleTextSubmit();
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
      customSplits: {},
      type: members.length === 1 ? '私帳' : '公帳',
      exchangeRate: exchangeRate
    });
    setSplitMode('equal');
    setCustomSplitCurrency('ORIGINAL');
  };

  const currentEffectiveRate = useMemo(() => {
    if (!pendingRecord || !pendingRecord.originalAmount) return exchangeRate;
    return (pendingRecord.ntdAmount || 0) / pendingRecord.originalAmount;
  }, [pendingRecord?.ntdAmount, pendingRecord?.originalAmount, exchangeRate]);

  const totalAllocatedNTD = useMemo(() => {
    if (!pendingRecord?.customSplits) return 0;
    return Object.values(pendingRecord.customSplits).reduce((sum, val) => sum + val, 0);
  }, [pendingRecord?.customSplits]);

  const remainingAmount = useMemo(() => {
    if (!pendingRecord) return 0;
    if (customSplitCurrency === 'TWD') {
      return (pendingRecord.ntdAmount || 0) - totalAllocatedNTD;
    } else {
      const totalAllocatedOriginal = totalAllocatedNTD / currentEffectiveRate;
      return (pendingRecord.originalAmount || 0) - totalAllocatedOriginal;
    }
  }, [pendingRecord, totalAllocatedNTD, customSplitCurrency, currentEffectiveRate]);

  const isSplitBalanced = splitMode === 'equal' || Math.abs(remainingAmount) < 0.5;

  const toggleSplitMember = (memberId: string) => {
    if (!pendingRecord) return;
    const currentSplit = pendingRecord.splitWith || [];
    const newSplit = currentSplit.includes(memberId)
      ? currentSplit.filter(id => id !== memberId)
      : [...currentSplit, memberId];
    
    if (newSplit.length === 0) return;
    const newType = newSplit.length === 1 ? '私帳' : '公帳';
    setPendingRecord({ ...pendingRecord, splitWith: newSplit, type: newType as any });
  };

  const handleCustomSplitChange = (memberId: string, val: string) => {
    if (!pendingRecord) return;
    const inputVal = parseFloat(val) || 0;
    const ntdValue = customSplitCurrency === 'TWD' ? inputVal : Math.round(inputVal * currentEffectiveRate);
    const newCustomSplits = { ...pendingRecord.customSplits, [memberId]: ntdValue };
    const activeCount = Object.values(newCustomSplits).filter(v => v > 0).length;
    const newType = activeCount === 1 ? '私帳' : '公帳';

    setPendingRecord({
      ...pendingRecord,
      customSplits: newCustomSplits,
      type: newType as any
    });
  };

  const fillRemaining = (memberId: string) => {
    if (!pendingRecord) return;
    const currentNtd = pendingRecord.customSplits?.[memberId] || 0;
    const remainingNtd = customSplitCurrency === 'TWD' ? remainingAmount : remainingAmount * currentEffectiveRate;
    handleCustomSplitChange(memberId, ((currentNtd + remainingNtd) / (customSplitCurrency === 'TWD' ? 1 : currentEffectiveRate)).toString());
  };

  const confirmRecord = () => {
    if (pendingRecord) {
      const finalRecord = { ...pendingRecord };
      if (splitMode === 'custom') {
        const activeIds = Object.entries(finalRecord.customSplits || {})
          .filter(([_, val]) => val > 0)
          .map(([id]) => id);
        if (activeIds.length === 0) {
          alert('請至少指定一人的分帳金額');
          return;
        }
        finalRecord.splitWith = activeIds;
      } else {
        finalRecord.customSplits = undefined;
      }
      onAddTransaction(finalRecord);
      setPendingRecord(null);
    }
  };

  const CustomSelect = ({ label, icon: Icon, value, options, onSelect, isOpen, onToggle }: any) => (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <label className="text-[10px] font-black text-slate-400 mb-1 block uppercase tracking-widest flex items-center gap-2"><Icon size={14} /> {label}</label>
      <button 
        onClick={onToggle}
        className="w-full bg-white border-[2.5px] border-black rounded-xl px-4 py-2.5 flex items-center justify-between shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all"
      >
        <span className="font-black text-sm">{options.find((o: any) => o.id === value)?.name || value}</span>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute z-[60] left-0 right-0 top-full mt-2 bg-white border-[3.5px] border-black rounded-2xl p-2 comic-shadow animate-in fade-in zoom-in-95 duration-100 max-h-60 overflow-y-auto no-scrollbar">
          {options.map((opt: any) => (
            <button
              key={opt.id}
              onClick={() => { onSelect(opt.id); onToggle(); }}
              className={`w-full text-left px-4 py-2.5 rounded-xl font-black text-sm mb-1 last:mb-0 transition-colors ${value === opt.id ? 'bg-[#F6D32D] text-black' : 'hover:bg-slate-50 text-slate-600'}`}
            >
              {opt.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const hasContent = inputText.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-[#FFDADA] border-[3.5px] border-black rounded-2xl flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] shrink-0 transform -rotate-3 overflow-hidden p-1.5">
            <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Pig%20Face.png" alt="🐷" className="w-full h-full object-contain" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-black leading-none italic mb-1">智帳旅行</h2>
            <div className="flex items-center gap-1.5"><Sparkles size={11} className="text-[#F6D32D] fill-current" /><span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">TripSplit AI</span></div>
          </div>
        </div>
        <div className="bg-white border-[2.5px] border-black px-4 py-2 rounded-xl text-[11px] font-black flex items-center gap-2">
          <span className="text-blue-500">1 {defaultCurrency}</span><span className="text-slate-300">=</span><span className="text-red-500">{exchangeRate} TWD</span>
        </div>
      </div>

      <div className="bg-white border-[3.5px] border-black rounded-[2.5rem] p-5 comic-shadow space-y-3">
        <div className="relative group">
          <textarea 
            placeholder="例如：Coop 咖啡3 可頌1.9" 
            className="w-full h-24 bg-white border-[3.5px] border-black rounded-2xl pl-6 pr-14 py-4 text-lg font-bold focus:outline-none resize-none transition-all placeholder:text-slate-300" 
            value={inputText} 
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button 
            onClick={handleTextSubmit}
            disabled={!hasContent || isLoading}
            className={`absolute right-3 top-3 w-11 h-11 rounded-xl flex items-center justify-center transition-all z-10 ${
              hasContent 
                ? 'bg-black text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] active:scale-95' 
                : 'bg-slate-100 text-slate-300 cursor-not-allowed opacity-50'
            }`}
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} className={hasContent ? 'animate-in zoom-in' : ''} />}
          </button>
          {!hasContent && (
            <div className="absolute left-6 bottom-3 text-[9px] font-black text-slate-300 pointer-events-none uppercase tracking-widest italic animate-pulse">
              請在此輸入內容
            </div>
          )}
        </div>
        <div className="flex justify-center items-center gap-6 pt-0">
          <button onClick={() => fileInputRef.current?.click()} className="w-16 h-16 bg-white border-[3.5px] border-black rounded-full flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all hover:bg-slate-50"><ImageIcon size={28} strokeWidth={3} /></button>
          <button onClick={() => cameraInputRef.current?.click()} className="w-16 h-16 bg-[#F6D32D] border-[3.5px] border-black rounded-full flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all hover:bg-yellow-400"><Camera size={28} strokeWidth={3} /></button>
        </div>
        <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />
        <input type="file" ref={cameraInputRef} hidden accept="image/*" capture="environment" onChange={handleImageUpload} />
      </div>

      {pendingRecord && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-5 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border-t-[4px] sm:border-[4px] border-black rounded-t-[3rem] sm:rounded-[3rem] w-full max-w-sm p-6 sm:p-8 comic-shadow relative animate-in slide-in-from-bottom">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-2xl flex items-center gap-3 italic"><Check className="text-green-500" size={28} strokeWidth={4} /> 確認帳務</h3>
              <button onClick={() => setPendingRecord(null)} className="p-2 bg-slate-50 rounded-full text-slate-400"><X size={24} strokeWidth={3} /></button>
            </div>
            
            <div className="space-y-4 max-h-[70vh] overflow-y-auto no-scrollbar pb-6 px-1">
              <div className="space-y-3">
                <CustomSelect 
                  label="付款人" icon={UserCheck} value={pendingRecord.payerId} 
                  options={members.map(m => ({ id: m.id, name: m.name }))}
                  isOpen={openDropdown === 'payer'} 
                  onToggle={() => setOpenDropdown(openDropdown === 'payer' ? null : 'payer')}
                  onSelect={(id: string) => setPendingRecord({...pendingRecord, payerId: id})}
                />
                
                <div className="grid grid-cols-2 gap-3">
                  <CustomSelect 
                    label="分類" icon={Tag} value={pendingRecord.category} 
                    options={CATEGORIES.map(c => ({ id: c, name: c }))}
                    isOpen={openDropdown === 'category'} 
                    onToggle={() => setOpenDropdown(openDropdown === 'category' ? null : 'category')}
                    onSelect={(cat: Category) => setPendingRecord({...pendingRecord, category: cat})}
                  />
                  <CustomSelect 
                    label="帳務類型" icon={CreditCard} value={pendingRecord.type} 
                    options={[{id: '公帳', name: '公帳'}, {id: '私帳', name: '私帳'}]}
                    isOpen={openDropdown === 'type'} 
                    onToggle={() => setOpenDropdown(openDropdown === 'type' ? null : 'type')}
                    onSelect={(type: any) => setPendingRecord({...pendingRecord, type})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="bg-slate-50 p-3 rounded-2xl border-[2.5px] border-black"><label className="text-[10px] font-black text-slate-400 mb-1 block uppercase tracking-widest">日期</label><input type="date" className="w-full bg-transparent border-none focus:ring-0 text-base font-black p-0" value={pendingRecord.date} onChange={e => setPendingRecord({...pendingRecord, date: e.target.value})} /></div>
                <div className="bg-slate-50 p-3 rounded-2xl border-[2.5px] border-black">
                  <label className="text-[10px] font-black text-slate-400 mb-1 block uppercase tracking-widest">店家</label>
                  <input 
                    className="w-full bg-transparent border-none focus:ring-0 text-base font-black p-0" 
                    value={pendingRecord.merchant} 
                    onFocus={e => e.target.select()}
                    onChange={e => setPendingRecord({...pendingRecord, merchant: e.target.value})} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 relative">
                <div className="bg-[#FFFDF0] p-3 rounded-2xl border-[2.5px] border-[#E64A4A]"><label className="text-[10px] font-black text-[#E64A4A] mb-1 block uppercase tracking-widest">總計台幣</label><input type="number" className="w-full bg-transparent border-none focus:ring-0 text-2xl font-black p-0" value={pendingRecord.ntdAmount || ''} onChange={e => setPendingRecord({...pendingRecord, ntdAmount: Number(e.target.value)})} /></div>
                <div className="bg-slate-50 p-3 rounded-2xl border-[2.5px] border-black"><label className="text-[10px] font-black text-slate-400 mb-1 block uppercase tracking-wider">外幣 ({pendingRecord.currency})</label><input type="number" className="w-full bg-transparent border-none focus:ring-0 text-2xl font-black p-0" value={pendingRecord.originalAmount || ''} onChange={e => { const ori = Number(e.target.value); setPendingRecord({...pendingRecord, originalAmount: ori, ntdAmount: Math.round(ori * exchangeRate)}); }} /></div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-black text-white text-[9px] font-black px-2 py-0.5 rounded-full border border-white z-10">Rate: 1:{currentEffectiveRate.toFixed(2)}</div>
              </div>

              <div className="space-y-2">
                <div className="bg-slate-50 p-1.5 rounded-2xl border-[2.5px] border-black flex">
                  <button onClick={() => setSplitMode('equal')} className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${splitMode === 'equal' ? 'bg-black text-white' : 'text-slate-400'}`}><Users size={14} /> 均分模式</button>
                  <button onClick={() => { setSplitMode('custom'); setCustomSplitCurrency('ORIGINAL'); }} className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${splitMode === 'custom' ? 'bg-[#F6D32D] text-black border-2 border-black' : 'text-slate-400'}`}><Calculator size={14} /> 手動指定</button>
                </div>
                {splitMode === 'custom' && (
                  <div className="flex gap-2 animate-in fade-in slide-in-from-top-1">
                    <button onClick={() => setCustomSplitCurrency('TWD')} className={`flex-1 py-1.5 rounded-lg border-2 font-black text-[10px] ${customSplitCurrency === 'TWD' ? 'bg-black text-white border-black' : 'bg-white text-slate-400 border-slate-100'}`}>台幣輸入</button>
                    <button onClick={() => setCustomSplitCurrency('ORIGINAL')} className={`flex-1 py-1.5 rounded-lg border-2 font-black text-[10px] ${customSplitCurrency === 'ORIGINAL' ? 'bg-[#F6D32D] text-black border-black' : 'bg-white text-slate-400 border-slate-100'}`}>以外幣輸入 ({pendingRecord.currency})</button>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 p-4 rounded-3xl border-[2.5px] border-black space-y-3">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{splitMode === 'equal' ? '參與成員' : `輸入 ${customSplitCurrency === 'TWD' ? '台幣' : '外幣'}`}</label>
                  {splitMode === 'custom' && (
                    <div className={`text-[10px] font-black px-2 py-0.5 rounded-full border-2 ${isSplitBalanced ? 'bg-green-100 border-green-500 text-green-600' : 'bg-red-50 border-red-200 text-red-500'}`}>
                      {isSplitBalanced ? '金額對齊' : `差額: ${remainingAmount.toFixed(remainingAmount % 1 === 0 ? 0 : 2)}`}
                    </div>
                  )}
                </div>
                <div className="space-y-2.5">
                  {members.map(m => {
                    const isSelected = pendingRecord.splitWith?.includes(m.id);
                    const ntdVal = pendingRecord.customSplits?.[m.id] || 0;
                    const displayValue = customSplitCurrency === 'TWD' ? (ntdVal || '') : (ntdVal > 0 ? (ntdVal / currentEffectiveRate).toFixed(2).replace(/\.00$/, '') : '');
                    const referenceValue = (splitMode === 'custom' && isSelected && ntdVal > 0) ? (customSplitCurrency === 'TWD' ? `≈ ${(ntdVal / currentEffectiveRate).toFixed(2)} ${pendingRecord.currency}` : `≈ NT$ ${Math.round(ntdVal)}`) : "";

                    return (
                      <div key={m.id} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <button onClick={() => toggleSplitMember(m.id)} className={`flex-1 flex items-center justify-between p-2.5 rounded-xl border-2 transition-all ${isSelected ? 'bg-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-transparent border-slate-200 text-slate-300 opacity-60'}`}><span className="text-sm font-black">{m.name}</span>{splitMode === 'equal' && isSelected && <Check size={16} strokeWidth={4} className="text-green-500" />}</button>
                          {splitMode === 'custom' && isSelected && (
                            <div className="relative w-32">
                              <input type="number" placeholder="0" className="w-full bg-white border-2 border-black rounded-xl px-3 py-2.5 text-sm font-black outline-none" value={displayValue} onChange={e => handleCustomSplitChange(m.id, e.target.value)} />
                              <button onClick={() => fillRemaining(m.id)} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#F6D32D]"><Zap size={14} fill="currentColor" strokeWidth={3} /></button>
                            </div>
                          )}
                        </div>
                        {referenceValue && <div className="text-[10px] font-black text-slate-400 text-right pr-2 italic">{referenceValue}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border-[2.5px] border-black">
                <label className="text-[10px] font-black text-slate-400 mb-2 block uppercase tracking-widest">項目內容</label>
                <textarea 
                  className="w-full bg-transparent border-none focus:ring-0 font-bold text-sm leading-snug p-0 resize-none min-h-[80px]" 
                  value={pendingRecord.item} 
                  onFocus={e => e.target.select()}
                  onChange={e => setPendingRecord({...pendingRecord, item: e.target.value})} 
                />
              </div>
            </div>
            <div className="flex gap-4 pt-2">
              <button onClick={() => setPendingRecord(null)} className="flex-1 py-4 border-[2.5px] border-black rounded-2xl font-black text-base active:scale-95 transition-all">取消</button>
              <button onClick={confirmRecord} disabled={!isSplitBalanced} className={`flex-1 py-4 rounded-2xl font-black text-base shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 transition-all ${isSplitBalanced ? 'bg-black text-white' : 'bg-slate-200 text-slate-400'}`}>確認</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIInput;
