
import React from 'react';
import { Transaction, Member, AppState } from '../types';
import AIInput from './AIInput';
import { CATEGORY_ICONS, CATEGORY_COLORS } from '../constants';
import { TrendingUp, Wallet, ShoppingBag, Users, ShieldAlert, ArrowRightLeft, Sparkles, ReceiptText, ChevronRight, User } from 'lucide-react';

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
    <div className="space-y-10 pb-16">
      {/* 1. AI 智能記帳 */}
      <section className="relative mt-2">
        <div className="flex items-end justify-between mb-5 px-2">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center text-[#F6D32D] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] rotate-[-2deg]">
              <Sparkles size={28} fill="currentColor" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-black leading-none italic tracking-tighter">AI 智能記帳</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Smart Assistant</p>
            </div>
          </div>
          <div className="bg-white border-2 border-black px-3 py-1.5 rounded-xl text-[11px] font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
             <span className="text-slate-500 whitespace-nowrap">1 {state.defaultCurrency} = {state.exchangeRate} TWD</span>
          </div>
        </div>
        
        <div className="bg-white border-2 border-black rounded-[2.5rem] p-5 comic-shadow">
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

      {/* 2. 支出概況 */}
      <section className="grid grid-cols-2 gap-3">
        <div className="bg-[#E64A4A] p-4 rounded-3xl text-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-1.5 mb-1 opacity-70">
            <TrendingUp size={12} />
            <span className="text-[9px] font-black uppercase tracking-widest">總支出</span>
          </div>
          <div className="text-xl font-black leading-none italic">NT$ {Math.round(totalExpense).toLocaleString()}</div>
        </div>
        <div className="bg-[#F6D32D] p-4 rounded-3xl text-black border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-1.5 mb-1 opacity-70">
            <ShoppingBag size={12} />
            <span className="text-[9px] font-black uppercase tracking-widest">我的花費</span>
          </div>
          <div className="text-xl font-black leading-none italic">NT$ {Math.round(myTotalCost).toLocaleString()}</div>
        </div>
      </section>

      {/* 3. 最近動態 - 新增外幣金額顯示 */}
      <section>
        <div className="flex justify-between items-center mb-4 px-1">
          <h3 className="text-lg font-black text-black flex items-center gap-2 italic">
            <ReceiptText size={18} className="text-blue-500" /> 最近動態
          </h3>
        </div>
        <div className="space-y-3">
          {recentTransactions.map(t => {
            const displayCurrency = t.currency || state.defaultCurrency;
            const isNotTwd = displayCurrency !== 'TWD';
            const hasOriginalAmount = t.originalAmount > 0;

            return (
              <div 
                key={t.id} 
                onClick={() => onEditTransaction(t.id)}
                className="bg-white border-2 border-black p-3.5 rounded-2xl flex items-center gap-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:scale-[0.98] transition-all cursor-pointer"
              >
                <div className={`w-10 h-10 rounded-xl border-2 border-black flex items-center justify-center shrink-0 ${CATEGORY_COLORS[t.category].split(' ')[0]}`}>
                  {React.cloneElement(CATEGORY_ICONS[t.category] as React.ReactElement<any>, { size: 16 })}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-[13px] text-black truncate leading-tight">{t.merchant}</div>
                  <div className="text-[10px] font-bold text-slate-400">{t.date}</div>
                </div>
                <div className="text-right shrink-0">
                  {/* 如果是外幣消費，顯示原始外幣金額 */}
                  {isNotTwd && hasOriginalAmount && (
                    <div className="text-[10px] font-bold text-slate-400 italic uppercase mb-0.5 tracking-tighter">
                      {t.originalAmount.toLocaleString()} {displayCurrency}
                    </div>
                  )}
                  <div className="font-black text-base text-black italic leading-none">
                    NT$ {Math.round(t.ntdAmount).toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. 結算與歸屬 */}
      <section>
        <div className="flex justify-between items-center mb-5 px-1">
          <h2 className="text-xl font-black text-black flex items-center gap-2">
            <Users size={20} className="text-[#1FA67A]" /> 結算與歸屬
          </h2>
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Balance Sheet</span>
        </div>
        
        <div className="grid grid-cols-1 gap-5">
          {state.members.map(m => {
            const balance = balances[m.id];
            const isPositive = balance > 0;
            const isZero = Math.abs(balance) < 1;
            const consumption = consumptions[m.id];
            const consumptionPercent = totalExpense > 0 ? (consumption / totalExpense) * 100 : 0;
            const isMe = m.id === state.currentUser;

            const statusTextColor = isPositive ? 'text-[#1FA67A]' : isZero ? 'text-slate-400' : 'text-[#E64A4A]';
            const cardBg = isPositive ? 'bg-[#F4FBF7]' : isZero ? 'bg-white' : 'bg-[#FEF5F5]';

            return (
              <div key={m.id} className={`relative border-2 border-black rounded-[2rem] p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden transition-transform hover:-translate-y-1 ${cardBg}`}>
                
                <div className="absolute -top-1 -right-2 text-black/[0.02] font-black text-6xl italic pointer-events-none uppercase">
                  {isPositive ? 'Credit' : isZero ? 'Even' : 'Debt'}
                </div>

                {isMe && (
                  <div className="absolute top-4 right-0 bg-blue-500 text-white text-[8px] font-black px-2 py-1 rounded-l-lg shadow-sm italic z-20">
                    YOU
                  </div>
                )}

                <div className="relative z-10 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-[#F6D32D] border-2 border-black rounded-xl flex items-center justify-center text-black font-black text-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rotate-[-3deg] shrink-0">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-lg text-black truncate leading-none mb-2">{m.name}</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-black/5 rounded-full overflow-hidden border border-black/5">
                           <div className="h-full bg-blue-400 rounded-full" style={{ width: `${consumptionPercent}%` }} />
                        </div>
                        <span className="text-[9px] font-black text-slate-400 whitespace-nowrap">{Math.round(consumptionPercent)}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/60 border-2 border-black rounded-xl p-2.5 flex flex-col items-center">
                       <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">應收 / 應付 (NT$)</span>
                       <div className={`text-base sm:text-lg font-black italic tracking-tighter ${statusTextColor}`}>
                          {isPositive ? '+' : ''}{Math.round(balance).toLocaleString()}
                       </div>
                    </div>

                    <div className="bg-slate-50 border-2 border-black rounded-xl p-2.5 flex flex-col items-center">
                       <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">消費額 (NT$)</span>
                       <div className="text-base sm:text-lg font-black text-black italic tracking-tighter">
                          {Math.round(consumption).toLocaleString()}
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default Overview;
