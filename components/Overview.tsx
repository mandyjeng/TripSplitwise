
import React from 'react';
import { Transaction, Member, AppState } from '../types';
import AIInput from './AIInput';
import { CATEGORY_ICONS, CATEGORY_COLORS } from '../constants';
import { TrendingUp, Wallet, ShoppingBag, Users, ShieldAlert, ArrowRightLeft, Sparkles } from 'lucide-react';

interface OverviewProps {
  state: AppState;
  onAddTransaction: (t: Partial<Transaction>) => void;
  setIsAIProcessing: (loading: boolean) => void;
  onEditTransaction: (id: string) => void;
}

const Overview: React.FC<OverviewProps> = ({ state, onAddTransaction, setIsAIProcessing, onEditTransaction }) => {
  const totalExpense = state.transactions.reduce((acc, t) => acc + t.ntdAmount, 0);

  const calculateStats = () => {
    const balances: Record<string, number> = {};
    const consumptions: Record<string, number> = {};
    
    state.members.forEach(m => {
      balances[m.id] = 0;
      consumptions[m.id] = 0;
    });

    state.transactions.forEach(t => {
      if (t.isSplit) {
        const splitCount = t.splitWith.length;
        if (splitCount > 0) {
          const perPerson = t.ntdAmount / splitCount;
          balances[t.payerId] += t.ntdAmount;
          t.splitWith.forEach(mid => {
            balances[mid] -= perPerson;
            consumptions[mid] += perPerson;
          });
        }
      } else {
        consumptions[t.payerId] += t.ntdAmount;
      }
    });

    return { balances, consumptions };
  };

  const { balances, consumptions } = calculateStats();
  const myTotalCost = consumptions[state.currentUser] || 0;

  const recentTransactions = [...state.transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  return (
    <div className="space-y-8 pb-10">
      {/* 1. AI 智能記帳 - 提升為頂部主視覺 (Hero Section) */}
      <section className="relative">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-[#F6D32D] shadow-lg">
              <Sparkles size={28} fill="currentColor" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-black leading-none italic tracking-tighter">AI 智能記帳</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Smart AI Assistant</p>
            </div>
          </div>
          <div className="bg-white border-[3px] border-black px-4 py-2 rounded-2xl text-[11px] font-black comic-shadow-sm flex items-center gap-2 group hover:scale-105 transition-transform">
            <ArrowRightLeft size={14} className="text-slate-400 group-hover:rotate-180 transition-transform duration-500" />
            <span className="text-slate-900">1 {state.defaultCurrency} = {state.exchangeRate}</span>
          </div>
        </div>
        
        <div className="bg-[#FFFDF0] border-[4px] border-black border-dashed rounded-[3rem] p-3.5 sm:p-5 comic-shadow">
          <AIInput 
            onAddTransaction={onAddTransaction} 
            members={state.members} 
            exchangeRate={state.exchangeRate} 
            defaultCurrency={state.defaultCurrency}
            setIsAIProcessing={setIsAIProcessing} 
            currentUserId={state.currentUser}
          />
        </div>
      </section>

      {/* 2. 支出概況統計 - 緊隨 AI 區塊 */}
      <section className="grid grid-cols-2 gap-4">
        <div className="bg-[#E64A4A] p-5 rounded-[2.5rem] text-white border-[3px] border-black comic-shadow-sm">
          <div className="flex items-center gap-2 mb-2 opacity-80">
            <TrendingUp size={16} />
            <span className="text-[11px] font-black uppercase tracking-widest">總支出</span>
          </div>
          <div className="text-3xl font-black leading-none italic">$-{Math.round(totalExpense).toLocaleString()}</div>
        </div>
        <div className="bg-white p-5 rounded-[2.5rem] border-[3px] border-black comic-shadow-sm text-black">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingBag size={16} className="text-[#1FA67A]" />
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">我的花費</span>
          </div>
          <div className="text-2xl font-black leading-none">NT$ {Math.round(myTotalCost).toLocaleString()}</div>
          <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-tight">含分擔與個人消費</p>
        </div>
      </section>

      {/* 3. 結算與歸屬 */}
      <section>
        <h2 className="text-2xl font-black text-black mb-6 flex items-center gap-3">
          <div className="w-3 h-10 bg-[#1FA67A] border-[3px] border-black"></div>
          結算與歸屬
        </h2>
        <div className="bg-white border-[3px] border-black rounded-[3rem] p-7 sm:p-9 comic-shadow">
          <div className="space-y-8">
            {state.members.map(m => (
              <div key={m.id} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-5 min-w-0">
                  <div className="w-14 h-14 bg-[#F6D32D] border-[3px] border-black rounded-2xl flex items-center justify-center text-black font-black text-2xl shrink-0 comic-shadow-sm">
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-black text-xl text-slate-950 leading-tight mb-1 truncate">{m.name}</div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 truncate">
                      <Wallet size={14} className="shrink-0" />
                      <span>NT$ {Math.round(consumptions[m.id]).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`font-black text-2xl leading-none ${balances[m.id] > 0 ? 'text-[#1FA67A]' : balances[m.id] < 0 ? 'text-[#E64A4A]' : 'text-slate-300'}`}>
                    {balances[m.id] > 0 ? '+' : ''}{Math.round(balances[m.id]).toLocaleString()}
                  </div>
                  <div className="text-[10px] font-black text-slate-400 uppercase mt-2 tracking-widest">結算餘額</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. 最新動態 */}
      <section>
        <div className="flex justify-between items-end mb-5">
          <h2 className="text-2xl font-black text-black flex items-center gap-3">
            <div className="w-3 h-10 bg-slate-400 border-[3px] border-black"></div>
            最近動態
          </h2>
          <span className="text-[11px] font-bold text-slate-400 italic">Latest 3 records</span>
        </div>
        <div className="space-y-6">
          {recentTransactions.map(t => {
            const displayCurrency = t.currency || state.defaultCurrency;
            const hasOriginalAmount = t.originalAmount > 0;
            const isNotTwd = displayCurrency !== 'TWD';
            const shouldShowOriginal = hasOriginalAmount || isNotTwd;

            return (
              <div 
                key={t.id} 
                onClick={() => onEditTransaction(t.id)}
                className="bg-white border-[3px] border-black p-6 rounded-[2.5rem] flex flex-col gap-6 comic-shadow transition-all relative group overflow-hidden cursor-pointer active:scale-[0.98]"
              >
                <div className="flex items-start gap-5">
                  <div className={`w-14 h-14 rounded-2xl border-[3px] border-black flex items-center justify-center shrink-0 mt-0.5 ${CATEGORY_COLORS[t.category].split(' ')[0]}`}>
                    {React.cloneElement(CATEGORY_ICONS[t.category] as React.ReactElement<any>, { size: 24 })}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-lg text-black truncate leading-tight">{t.merchant}</span>
                      </div>
                      <div className="text-sm font-bold text-slate-700 leading-relaxed whitespace-pre-line line-clamp-2">{t.item}</div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-1">
                    {shouldShowOriginal && (
                      <div className="text-[11px] font-bold text-slate-500 italic uppercase mb-1">
                        {t.originalAmount} {displayCurrency}
                      </div>
                    )}
                    <div className="font-black text-xl text-black leading-none">
                      <span className="text-xs mr-1 font-bold">NT$</span>
                      {Math.round(t.ntdAmount).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t-2 border-slate-100 flex items-center gap-3">
                    <div className="flex items-center gap-2.5 text-xs font-black text-black bg-slate-100 px-3.5 py-2 rounded-xl border-2 border-slate-200">
                      <div className="w-6 h-6 rounded-lg bg-[#F6D32D] border-2 border-black flex items-center justify-center text-black text-[10px] font-black shrink-0">
                        {state.members.find(m => m.id === t.payerId)?.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="whitespace-nowrap">{state.members.find(m => m.id === t.payerId)?.name}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 items-center flex-1 overflow-hidden pt-0.5">
                      <span className="text-[10px] font-black text-slate-300 shrink-0 uppercase tracking-widest">To:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {t.isSplit && t.splitWith.length === state.members.length ? (
                          <span className="text-[10px] font-black text-slate-500 bg-white border-2 border-slate-200 px-2.5 py-1 rounded-lg whitespace-nowrap">全部</span>
                        ) : (
                          t.splitWith.map(mid => (
                            <span key={mid} className="text-[10px] font-black text-slate-500 bg-white border-2 border-slate-200 px-2.5 py-1 rounded-lg whitespace-nowrap">
                              {state.members.find(m => m.id === mid)?.name}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                </div>
              </div>
            );
          })}
          {recentTransactions.length === 0 && (
            <div className="text-center py-20 text-slate-200 font-black italic text-2xl tracking-widest uppercase opacity-30">No Records Found</div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Overview;
