import React from 'react';
import { Transaction, Member, AppState } from '../types';
import AIInput from './AIInput';
import { CATEGORY_ICONS, CATEGORY_COLORS } from '../constants';
import { TrendingUp, Wallet, ShoppingBag, Users, ShieldAlert, ArrowRightLeft } from 'lucide-react';

interface OverviewProps {
  state: AppState;
  onAddTransaction: (t: Partial<Transaction>) => void;
  setIsAIProcessing: (loading: boolean) => void;
}

const Overview: React.FC<OverviewProps> = ({ state, onAddTransaction, setIsAIProcessing }) => {
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
      {/* Summary Cards */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-[#E64A4A] p-3.5 sm:p-5 rounded-[2rem] sm:rounded-[2.5rem] text-white comic-border comic-shadow-sm">
          <div className="flex items-center gap-1.5 mb-2 opacity-90 font-bold">
            <TrendingUp size={16} />
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider">總支出</span>
          </div>
          <div className="text-xl sm:text-2xl font-black leading-none italic">$-{Math.round(totalExpense).toLocaleString()}</div>
        </div>
        <div className="bg-white p-3.5 sm:p-5 rounded-[2rem] sm:rounded-[2.5rem] comic-border comic-shadow-sm text-black">
          <div className="flex items-center gap-1.5 mb-2 text-slate-500 font-bold">
            <ShoppingBag size={16} className="text-[#1FA67A]" />
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider">我的花費</span>
          </div>
          <div className="text-lg sm:text-xl font-black leading-none">NT$ {Math.round(myTotalCost).toLocaleString()}</div>
          <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 mt-1 uppercase">含分擔與個人</p>
        </div>
      </section>

      {/* AI Area */}
      <section>
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <h2 className="text-xl sm:text-2xl font-black text-black flex items-center gap-2">
            <div className="w-2.5 h-8 sm:w-3 sm:h-9 bg-[#F6D32D] comic-border"></div>
            AI 智能記帳
          </h2>
          {/* 新增匯率徽章 */}
          <div className="bg-white comic-border px-2 py-1 rounded-lg text-[10px] sm:text-xs font-black comic-shadow-sm flex items-center gap-1 whitespace-nowrap">
            <ArrowRightLeft size={12} className="text-slate-400" />
            1 {state.defaultCurrency} = {state.exchangeRate}
          </div>
        </div>
        <AIInput 
          onAddTransaction={onAddTransaction} 
          members={state.members} 
          exchangeRate={state.exchangeRate} 
          defaultCurrency={state.defaultCurrency}
          setIsAIProcessing={setIsAIProcessing} 
          currentUserId={state.currentUser}
        />
      </section>

      {/* Settlement Section */}
      <section>
        <h2 className="text-xl sm:text-2xl font-black text-black mb-5 flex items-center gap-2">
          <div className="w-2.5 h-8 sm:w-3 sm:h-9 bg-[#1FA67A] comic-border"></div>
          結算與歸屬
        </h2>
        <div className="bg-white comic-border rounded-[2rem] sm:rounded-[3rem] p-4 sm:p-7 comic-shadow">
          <div className="space-y-6 sm:space-y-9">
            {state.members.map(m => (
              <div key={m.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 sm:gap-5 min-w-0">
                  <div className="w-10 h-10 sm:w-16 sm:h-16 bg-[#F6D32D] comic-border rounded-xl sm:rounded-2xl flex items-center justify-center text-black font-black text-lg sm:text-2xl shrink-0">
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-black text-lg sm:text-2xl text-slate-950 leading-tight mb-0.5 truncate">{m.name}</div>
                    <div className="flex items-center gap-1 text-[10px] sm:text-base font-bold text-slate-500 truncate">
                      <Wallet size={12} className="shrink-0" />
                      <span>NT$ {Math.round(consumptions[m.id]).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`font-black text-xl sm:text-3xl leading-none ${balances[m.id] > 0 ? 'text-[#1FA67A]' : balances[m.id] < 0 ? 'text-[#E64A4A]' : 'text-slate-300'}`}>
                    {balances[m.id] > 0 ? '+' : ''}{Math.round(balances[m.id]).toLocaleString()}
                  </div>
                  <div className="text-[9px] sm:text-sm font-black text-slate-400 uppercase mt-1">結算餘額</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Activity */}
      <section>
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-xl sm:text-2xl font-black text-black flex items-center gap-2">
            <div className="w-2.5 h-8 sm:w-3 sm:h-9 bg-slate-400 comic-border"></div>
            最新動態
          </h2>
          <span className="text-xs sm:text-sm font-bold text-slate-400 italic">僅顯示 3 筆</span>
        </div>
        <div className="space-y-5">
          {recentTransactions.map(t => (
            <div key={t.id} className="bg-white comic-border p-4 sm:p-7 rounded-[2rem] flex flex-col gap-4 sm:gap-6 comic-shadow transition-all relative group overflow-hidden">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className={`w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl border-[3px] border-black flex items-center justify-center shrink-0 mt-0.5 ${CATEGORY_COLORS[t.category].split(' ')[0]}`}>
                  {React.cloneElement(CATEGORY_ICONS[t.category] as React.ReactElement<any>, { size: 20 })}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-base sm:text-lg text-black truncate leading-tight">{t.merchant}</span>
                    </div>
                    <div className="text-[12px] sm:text-sm font-bold text-slate-700 leading-snug whitespace-pre-line line-clamp-2">{t.item}</div>
                  </div>
                </div>

                <div className="text-right shrink-0 ml-1">
                  <div className="text-[10px] font-bold text-slate-500 italic uppercase mb-0.5">
                    {t.originalAmount} {t.currency}
                  </div>
                  <div className="font-black text-lg sm:text-xl text-black leading-none">
                    <span className="text-[12px] mr-0.5 font-bold">NT$</span>
                    {Math.round(t.ntdAmount).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t-2 border-slate-100 flex flex-col gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="flex flex-col gap-2 shrink-0">
                    <div className="flex items-center gap-2 text-[12px] sm:text-base font-black text-black bg-slate-100 px-2.5 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl border-2 border-slate-200">
                      <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-[#F6D32D] comic-border flex items-center justify-center text-black text-[9px] sm:text-[11px] font-black shrink-0">
                        {state.members.find(m => m.id === t.payerId)?.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="whitespace-nowrap">{state.members.find(m => m.id === t.payerId)?.name}</span>
                    </div>
                  </div>

                  <div className="h-7 w-[2px] bg-slate-200 mx-0.5 self-center"></div>
                  
                  <div className="flex flex-wrap gap-1 items-center flex-1 overflow-hidden pt-0.5">
                    <span className="text-[9px] sm:text-sm font-black text-black shrink-0">分給:</span>
                    <div className="flex flex-wrap gap-1">
                      {t.isSplit && t.splitWith.length === state.members.length ? (
                        <span className="text-[9px] sm:text-sm font-black text-black bg-white border-2 border-slate-300 px-1.5 sm:px-3 py-0.5 rounded-md sm:rounded-lg whitespace-nowrap">
                          全部
                        </span>
                      ) : (
                        t.splitWith.map(mid => (
                          <span key={mid} className="text-[9px] sm:text-sm font-black text-black bg-white border-2 border-slate-300 px-1.5 sm:px-3 py-0.5 rounded-md sm:rounded-lg whitespace-nowrap">
                            {state.members.find(m => m.id === mid)?.name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {recentTransactions.length === 0 && (
            <div className="text-center py-20 text-slate-300 font-black italic text-2xl tracking-widest uppercase">No Records</div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Overview;