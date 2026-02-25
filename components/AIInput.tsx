
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
  
  const [manualSplits, setManualSplits] = useState<Record<string, number>>({});
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
    const ntdAmount = currency === 'TWD' ? amount : Math.round(amount * exchangeRate);

    setPendingRecord({
      source,
      merchant: data.merchant || '未指定店家',
      item: data.item || '未命名項目',
      originalAmount: amount,
      currency: currency,
      category: (CATEGORIES.includes(data.category as Category) ? data.category : '用餐') as Category,
      date: (data.date || new Date().toISOString()).split('T')[0],
      ntdAmount: ntdAmount,
      payerId: currentUserId || members[0]?.id || '',
      isSplit: true,
      splitWith: members.map(m => m.id).filter(Boolean),
      customSplits: {},
      type: members.length === 1 ? '私帳' : '公帳',
      exchangeRate: exchangeRate
    });
    setSplitMode('equal');
    setCustomSplitCurrency('ORIGINAL');
    setManualSplits({});
  };

  const currentEffectiveRate = useMemo(() => {
    if (!pendingRecord || !pendingRecord.originalAmount) return exchangeRate;
    return pendingRecord.ntdAmount / pendingRecord.originalAmount;
  }, [pendingRecord?.ntdAmount, pendingRecord?.originalAmount, exchangeRate]);

  const allocatedSum = useMemo(() => {
    if (!pendingRecord) return { ntd: 0, original: 0 };
    let ntd = 0;
    let original = 0;
    (pendingRecord.splitWith || []).filter(id => id && id.trim() !== '').forEach(id => {
      const ntdVal = pendingRecord.customSplits?.[id] || 0;
      ntd += ntdVal;
      original += manualSplits[id] || 0;
    });
    return { ntd, original };
  }, [pendingRecord?.splitWith, pendingRecord?.customSplits, manualSplits]);

  const remainingAmount = useMemo(() => {
    if (!pendingRecord) return 0;
    if (customSplitCurrency === 'TWD') {
      return pendingRecord.ntdAmount - allocatedSum.ntd;
    } else {
      return pendingRecord.originalAmount - allocatedSum.original;
    }
  }, [pendingRecord, allocatedSum, customSplitCurrency]);

  const isSplitBalanced = splitMode === 'equal' || Math.abs(remainingAmount) < 0.1;

  const handleTotalNtdChange = (newTotal: number) => {
    setPendingRecord(prev => {
      if (!prev || !prev.originalAmount) return prev ? { ...prev, ntdAmount: newTotal } : prev;
      const updates: Partial<Transaction> = { ntdAmount: newTotal };
      if (splitMode === 'custom') {
        const newRate = newTotal / prev.originalAmount;
        const newSplits: Record<string, number> = {};
        if (customSplitCurrency === 'ORIGINAL') {
          Object.entries(manualSplits).forEach(([id, foreignVal]) => {
            if (id && prev.splitWith?.includes(id)) {
               newSplits[id] = Math.round((foreignVal as number) * newRate);
            }
          });
        } else {
          const ratio = newTotal / (prev.ntdAmount || 1);
          const newManual: Record<string, number> = {};
          Object.entries(manualSplits).forEach(([id, oldNtd]) => {
            if (id && prev.splitWith?.includes(id)) {
              const scaled = (oldNtd as number) * ratio;
              newManual[id] = scaled;
              newSplits[id] = Math.round(scaled);
            }
          });
          setManualSplits(newManual);
        }
        updates.customSplits = newSplits;
      }
      return { ...prev, ...updates };
    });
  };

  const handleCustomSplitChange = (memberId: string, val: string) => {
    if (!pendingRecord) return;
    const inputVal = parseFloat(val) || 0;
    setManualSplits(prev => ({ ...prev, [memberId]: inputVal }));
    const ntdValue = customSplitCurrency === 'TWD' ? inputVal : Math.round(inputVal * currentEffectiveRate);
    const newCustomSplits = { ...pendingRecord.customSplits, [memberId]: ntdValue };
    
    const effectiveCount = Object.values(newCustomSplits).filter(v => (v as number) > 0).length;
    
    setPendingRecord({
      ...pendingRecord,
      customSplits: newCustomSplits,
      type: (effectiveCount === 1 ? '私帳' : '公帳') as any
    });
  };

  const switchToCustomMode = () => {
    if (!pendingRecord) return;
    setSplitMode('custom');
    setCustomSplitCurrency('ORIGINAL');
    const splitWith = pendingRecord.splitWith || [];
    if (splitWith.length === 0) return;
    const perPersonNtd = Math.round(pendingRecord.ntdAmount / splitWith.length);
    const initSplits: Record<string, number> = {};
    const initManual: Record<string, number> = {};
    splitWith.forEach(id => { 
      initSplits[id] = perPersonNtd;
      initManual[id] = perPersonNtd / currentEffectiveRate;
    });
    setPendingRecord({ 
      ...pendingRecord, 
      customSplits: initSplits,
      type: (splitWith.length === 1 ? '私帳' : '公帳') as any
    });
    setManualSplits(initManual);
  };

  const CustomSelect = ({ label, icon: Icon, value, options, onSelect, isOpen, onToggle }: any) => (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <label className="text-[9px] font-black text-slate-400 mb-1 block uppercase tracking-widest flex items-center gap-1.5"><Icon size={12} /> {label}</label>
      <button onClick={onToggle} className="w-full bg-white border-2 border-black rounded-xl px-4 py-2 flex items-center justify-between shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all">
        <span className="font-black text-sm">{options.find((o: any) => o.id === value)?.name || value}</span>
        <ChevronDown size={14} className="text-slate-400" />
      </button>
      {isOpen && (
        <div className="absolute z-[70] left-0 right-0 top-full mt-2 bg-white border-2 border-black rounded-xl p-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-h-48 overflow-y-auto no-scrollbar">
          {options.map((opt: any) => (
            <button key={opt.id} onClick={() => { onSelect(opt.id); onToggle(); }} className={`w-full text-left px-3 py-2 rounded-lg font-black text-xs mb-1 last:mb-0 ${value === opt.id ? 'bg-[#F6D32D]' : 'hover:bg-slate-50'}`}>{opt.name}</button>
          ))}
        </div>
      )}
    </div>
  );

  const perPersonInfo = useMemo(() => {
    if (!pendingRecord) return { amount: '0', label: 'NT$' };
    const count = (pendingRecord.splitWith || []).length;
    if (count === 0) return { amount: '0', label: 'NT$' };

    if (customSplitCurrency === 'TWD') {
      return { 
        amount: Math.round(pendingRecord.ntdAmount / count).toLocaleString(), 
        label: 'NT$' 
      };
    } else {
      const amt = pendingRecord.originalAmount / count;
      const formatted = amt % 1 === 0 ? amt.toString() : amt.toFixed(2);
      return { 
        amount: formatted, 
        label: `${pendingRecord.currency}$` 
      };
    }
  }, [pendingRecord, customSplitCurrency]);

  return (
    <div className="space-y-4">
      <div className="bg-white border-2 border-black rounded-[2rem] p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="relative">
          <textarea className="w-full bg-slate-50 border-2 border-black rounded-2xl p-4 pr-12 text-sm font-bold min-h-[100px] focus:outline-none focus:ring-0 resize-none" placeholder="輸入消費內容..." value={inputText} onChange={e => setInputText(e.target.value)} disabled={isLoading} />
          <button onClick={handleTextSubmit} disabled={!inputText.trim() || isLoading} className="absolute right-3 bottom-3 p-2 bg-black text-white rounded-xl active:scale-95 transition-all disabled:opacity-30">
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-white border-2 border-black py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all"><ImageIcon size={16} /> 選擇相片</button>
          <button onClick={() => cameraInputRef.current?.click()} className="flex-1 bg-[#F6D32D] border-2 border-black py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all"><Camera size={16} /> 拍照識別</button>
        </div>
        <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />
        <input type="file" ref={cameraInputRef} hidden accept="image/*" capture="environment" onChange={handleImageUpload} />
      </div>

      {pendingRecord && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border-t-4 sm:border-4 border-black rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-md p-6 comic-shadow relative animate-in slide-in-from-bottom overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black italic flex items-center gap-2"><Sparkles className="text-[#F6D32D]" size={24} /> 確認帳務</h3>
              <button onClick={() => setPendingRecord(null)} className="p-1 hover:bg-slate-100 rounded-full"><X size={24} /></button>
            </div>

            <div className="space-y-4 max-h-[65vh] overflow-y-auto no-scrollbar pb-6 px-1">
              <CustomSelect label="付款人" icon={UserCheck} value={pendingRecord.payerId} options={members.map(m => ({ id: m.id, name: m.name }))} isOpen={openDropdown === 'payer'} onToggle={() => setOpenDropdown(openDropdown === 'payer' ? null : 'payer')} onSelect={(id: string) => setPendingRecord({...pendingRecord, payerId: id})} />
              <div className="grid grid-cols-2 gap-3">
                <CustomSelect label="分類" icon={Tag} value={pendingRecord.category} options={CATEGORIES.map(c => ({ id: c, name: c }))} isOpen={openDropdown === 'category'} onToggle={() => setOpenDropdown(openDropdown === 'category' ? null : 'category')} onSelect={(cat: any) => setPendingRecord({...pendingRecord, category: cat})} />
                <CustomSelect label="帳務類型" icon={CreditCard} value={pendingRecord.type} options={[{id: '公帳', name: '公帳'}, {id: '私帳', name: '私帳'}]} isOpen={openDropdown === 'type'} onToggle={() => setOpenDropdown(openDropdown === 'type' ? null : 'type')} onSelect={(type: any) => setPendingRecord({...pendingRecord, type})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-2 rounded-xl border-2 border-black"><label className="text-[9px] font-black text-slate-400 mb-0.5 block uppercase">日期</label><input type="date" className="w-full bg-transparent font-black text-xs p-0 border-none focus:ring-0" value={pendingRecord.date} onChange={e => setPendingRecord({...pendingRecord, date: e.target.value})} /></div>
                <div className="bg-slate-50 p-2 rounded-xl border-2 border-black"><label className="text-[9px] font-black text-slate-400 mb-0.5 block uppercase">店家</label><input className="w-full bg-transparent font-black text-xs p-0 border-none focus:ring-0" value={pendingRecord.merchant} onChange={e => setPendingRecord({...pendingRecord, merchant: e.target.value})} /></div>
              </div>

              <div className="grid grid-cols-2 gap-3 relative">
                <div className="bg-[#FFFDF0] p-3 rounded-xl border-2 border-[#E64A4A]"><label className="text-[9px] font-black text-[#E64A4A] mb-0.5 block uppercase">台幣金額</label><input type="number" className="w-full bg-transparent border-none focus:ring-0 text-xl font-black p-0" value={pendingRecord.ntdAmount || ''} onChange={e => handleTotalNtdChange(Number(e.target.value))} /></div>
                <div className="bg-slate-50 p-3 rounded-xl border-2 border-black"><label className="text-[9px] font-black text-slate-400 mb-0.5 block uppercase">外幣 ({pendingRecord.currency})</label><input type="number" className="w-full bg-transparent border-none focus:ring-0 text-xl font-black p-0" value={pendingRecord.originalAmount || ''} onChange={e => { const ori = Number(e.target.value); setPendingRecord({...pendingRecord, originalAmount: ori, ntdAmount: Math.round(ori * currentEffectiveRate)}); }} /></div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-black text-white text-[8px] font-black px-2 py-0.5 rounded-full z-10">Rate: 1:{currentEffectiveRate.toFixed(2)}</div>
              </div>

              <div className="bg-slate-100 p-1 rounded-xl flex border-2 border-black">
                <button onClick={() => {
                  setSplitMode('equal');
                  const s = pendingRecord.splitWith || [];
                  setPendingRecord({ ...pendingRecord, type: s.length === 1 ? '私帳' : '公帳' });
                }} className={`flex-1 py-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2 ${splitMode === 'equal' ? 'bg-black text-white shadow-sm' : 'text-slate-400'}`}><Users size={14} /> 均分</button>
                <button onClick={switchToCustomMode} className={`flex-1 py-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2 ${splitMode === 'custom' ? 'bg-[#F6D32D] text-black border-2 border-black' : 'text-slate-400'}`}><Calculator size={14} /> 手動</button>
              </div>

              <div className="bg-slate-50 p-4 rounded-3xl border-2 border-black space-y-3">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex bg-white p-1 rounded-lg border-2 border-black">
                    <button onClick={() => {
                      setCustomSplitCurrency('TWD');
                      const newManual: Record<string, number> = {};
                      Object.entries(pendingRecord.customSplits || {}).forEach(([id, ntd]) => {
                        newManual[id] = (ntd as number);
                      });
                      setManualSplits(newManual);
                    }} className={`px-2 py-1 rounded font-black text-[9px] ${customSplitCurrency === 'TWD' ? 'bg-black text-white' : 'text-slate-400'}`}>台幣輸入</button>
                    <button onClick={() => {
                      setCustomSplitCurrency('ORIGINAL');
                      const newManual: Record<string, number> = {};
                      Object.entries(pendingRecord.customSplits || {}).forEach(([id, ntd]) => {
                        newManual[id] = (ntd as number) / currentEffectiveRate;
                      });
                      setManualSplits(newManual);
                    }} className={`px-2 py-1 rounded font-black text-[9px] ${customSplitCurrency === 'ORIGINAL' ? 'bg-[#F6D32D] text-black' : 'text-slate-400'}`}>外幣輸入</button>
                  </div>
                  <div className={`text-[10px] font-black px-2 py-0.5 rounded-full border-2 ${isSplitBalanced ? 'bg-green-100 border-green-500 text-green-600' : 'bg-red-50 border-red-200 text-red-500'}`}>
                    {splitMode === 'equal' ? `每人約 ${perPersonInfo.label} ${perPersonInfo.amount}` : (isSplitBalanced ? '金額對齊' : `差額: ${remainingAmount.toFixed(1)}`)}
                  </div>
                </div>
                
                <div className="space-y-3">
                  {members.map(m => {
                    const isSelected = pendingRecord.splitWith?.includes(m.id);
                    const displayValue = isSelected ? (manualSplits[m.id] !== undefined ? (manualSplits[m.id] as number).toFixed(2).replace(/\.00$/, '').replace(/\.([0-9])0$/, '.$1') : '') : '';
                    const ntdVal = (pendingRecord.customSplits?.[m.id] as number) || 0;
                    const refLabel = (isSelected && ntdVal > 0) ? (customSplitCurrency === 'TWD' ? `≈ ${(ntdVal / currentEffectiveRate).toFixed(2)} ${pendingRecord.currency}` : `≈ NT$ ${Math.round(ntdVal)}`) : "";

                    return (
                      <div key={m.id} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <button onClick={() => { 
                            const s = pendingRecord.splitWith || []; 
                            const newSplitWith = s.includes(m.id) ? s.filter(i=>i!==m.id && i !== '') : [...s, m.id].filter(id => id && id !== '');
                            
                            const newType = (splitMode === 'equal' && newSplitWith.length === 1) ? '私帳' : 
                                           (splitMode === 'equal' && newSplitWith.length > 1) ? '公帳' : pendingRecord.type;

                            setPendingRecord({
                              ...pendingRecord, 
                              splitWith: newSplitWith,
                              type: newType as any
                            }); 
                          }} className={`flex-1 flex justify-between p-2.5 rounded-xl border-2 ${isSelected ? 'bg-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-transparent border-slate-100 text-slate-300'}`}>
                            <span className="text-sm font-black">{m.name}</span>
                            {splitMode === 'equal' && isSelected && <Check size={16} className="text-[#1FA67A]" />}
                          </button>
                          
                          {splitMode === 'custom' && isSelected && (
                            <div className="relative w-32">
                              <input type="number" className="w-full bg-white border-2 border-black rounded-xl px-3 py-2 text-sm font-black outline-none" value={displayValue} onChange={e => handleCustomSplitChange(m.id, e.target.value)} />
                              <button onClick={() => handleCustomSplitChange(m.id, ((manualSplits[m.id]||0) + remainingAmount).toString())} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#F6D32D]"><Zap size={14} fill="currentColor" /></button>
                            </div>
                          )}
                        </div>
                        {splitMode === 'custom' && refLabel && <div className="text-[9px] font-black text-slate-400 text-right pr-2 italic">{refLabel}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border-2 border-black">
                <label className="text-[9px] font-black text-slate-400 mb-1 block uppercase">明細內容</label>
                <textarea className="w-full bg-transparent border-none focus:ring-0 text-xs font-bold p-0 min-h-[60px] resize-none" value={pendingRecord.item} onChange={e => setPendingRecord({...pendingRecord, item: e.target.value})} />
              </div>
            </div>

            <button onClick={() => {
              const final = { ...pendingRecord };
              if (splitMode === 'custom') {
                const selectedWithMoney = Object.entries(final.customSplits || {})
                  .filter(([id, v]) => (v as number) > 0 && id && id !== '' && final.splitWith?.includes(id))
                  .map(([id]) => id);
                final.splitWith = selectedWithMoney;
                const cleanedSplits: Record<string, number> = {};
                selectedWithMoney.forEach(id => { cleanedSplits[id] = final.customSplits![id] as number; });
                final.customSplits = cleanedSplits;
              } else {
                final.splitWith = final.splitWith?.filter(id => id && id !== '');
                final.customSplits = undefined;
              }
              onAddTransaction(final);
              setPendingRecord(null);
            }} disabled={!isSplitBalanced || (pendingRecord.splitWith?.length || 0) === 0} className={`w-full py-4 rounded-2xl font-black text-base shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 transition-all ${isSplitBalanced && (pendingRecord.splitWith?.length || 0) > 0 ? 'bg-black text-white' : 'bg-slate-200 text-slate-400'}`}>確認加入帳本</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIInput;
