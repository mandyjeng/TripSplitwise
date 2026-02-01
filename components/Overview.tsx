
import React from 'react';
import { Transaction, Member, AppState } from '../types';
import AIInput from './AIInput';
import { CATEGORY_ICONS, CATEGORY_COLORS } from '../constants';
import { TrendingUp, ShoppingBag, Users, ReceiptText, FileSpreadsheet } from 'lucide-react';

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
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  return (
    <div className="space-y-10 pb-16">
      {/* 1. 豬豬 AI 智能記帳區塊 */}
      <section className="mt-2">
        <AIInput 
          onAddTransaction={onAddTransaction} 
          members={state.members} 
          exchangeRate={state.exchangeRate} 
          defaultCurrency={state.defaultCurrency}
          setIsAIProcessing={setIsAIProcessing} 
          currentUserId={state.currentUser}
        />
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

      {/* 3. 最近動態 */}
      <section>
        <div className="flex justify-between items-center mb-4 px-1">
          <h3 className="text-lg font-black text-black flex items-center gap-2 italic">
            <ReceiptText size={18} className="text-blue-500" /> 最近動態
          </h3>
        </div>
        <div className="space-y-3">
          {recentTransactions.map(t => (
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
                {t.currency !== 'TWD' && (
                  <div className="text-[10px] font-bold text-slate-400 italic mb-0.5">
                    {t.originalAmount.toLocaleString()} {t.currency}
                  </div>
                )}
                <div className="font-black text-base text-black italic leading-none">
                  NT$ {Math.round(t.ntdAmount).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Balance Sheet / 結算單 */}
      <section>
        <div className="flex justify-between items-center mb-5 px-1">
          <h2 className="text-xl font-black text-black flex items-center gap-2 italic">
            <FileSpreadsheet size={20} className="text-[#1FA67A]" /> Balance Sheet
          </h2>
          <div className="bg-blue-500 text-white text-[9px] font-black px-2.5 py-1 rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase tracking-widest">
            Ledger
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-6">
          {state.members.map(m => {
            const balance = balances[m.id];
            const isPositive = balance > 0;
            const isZero = Math.abs(balance) < 1;
            const consumption = consumptions[m.id];
            const consumptionPercent = totalExpense > 0 ? (consumption / totalExpense) * 100 : 0;
            const isMe = m.id === state.currentUser;

            const statusTextColor = isPositive ? 'text-[#1FA67A]' : isZero ? 'text-slate-400' : 'text-[#E64A4A]';
            const cardBg = isPositive ? 'bg-[#F4FBF7]' : isZero ? 'bg-white' : 'bg-[#FEF5F5]';
            const statusLabel = isPositive ? 'CREDIT' : isZero ? 'EVEN' : 'DEBT';

            return (
              <div key={m.id} className={`relative border-2 border-black rounded-[2.5rem] p-6 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] overflow-hidden transition-all hover:-translate-y-1 ${cardBg}`}>
                <div className="absolute -top-2 -right-3 text-black/[0.03] font-black text-7xl italic pointer-events-none uppercase tracking-tighter select-none">
                  {statusLabel}
                </div>
                {isMe && (
                  <div className="absolute top-5 right-0 bg-blue-500 text-white text-[9px] font-black px-3 py-1 rounded-l-xl z-20 border-y-2 border-l-2 border-black">
                    YOU
                  </div>
                )}
                <div className="relative z-10 space-y-5">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-[#F6D32D] border-2 border-black rounded-2xl flex items-center justify-center text-black font-black text-2xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] rotate-[-3deg] shrink-0">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-xl text-black truncate mb-2.5">{m.name}</div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-black/5 rounded-full overflow-hidden border border-black/10">
                           <div className="h-full bg-[#1FA67A] rounded-full transition-all duration-1000" style={{ width: `${consumptionPercent}%` }} />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 italic">{Math.round(consumptionPercent)}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white border-2 border-black rounded-2xl p-3.5 flex flex-col items-center justify-center">
                       <span className="text-[9px] font-black text-slate-400 uppercase mb-1.5 italic">結算淨額</span>
                       <div className={`text-xl font-black italic ${statusTextColor}`}>
                          {isPositive ? '+' : ''}{Math.round(balance).toLocaleString()}
                       </div>
                    </div>
                    <div className="bg-slate-50 border-2 border-black rounded-2xl p-3.5 flex flex-col items-center justify-center">
                       <span className="text-[9px] font-black text-slate-400 uppercase mb-1.5 italic">個人消費</span>
                       <div className="text-xl font-black text-black italic">
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
