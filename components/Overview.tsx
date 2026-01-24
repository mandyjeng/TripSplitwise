
import React from 'react';
import { Transaction, Member, AppState } from '../types';
import AIInput from './AIInput';
import { CATEGORY_ICONS } from '../constants';
import { TrendingUp, Wallet, ArrowRightLeft, ShoppingBag, User } from 'lucide-react';

interface OverviewProps {
  state: AppState;
  onAddTransaction: (t: Partial<Transaction>) => void;
}

const Overview: React.FC<OverviewProps> = ({ state, onAddTransaction }) => {
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
    <div className="space-y-10 pb-10">
      {/* Summary Cards */}
      <section className="grid grid-cols-2 gap-5">
        <div className="bg-[#E64A4A] p-6 rounded-[2.5rem] text-white comic-border comic-shadow">
          <div className="flex items-center gap-2 mb-2 opacity-90 font-bold">
            <TrendingUp size={18} />
            <span className="text-sm font-black uppercase tracking-wider">總支出</span>
          </div>
          <div className="text-3xl font-black leading-none mt-2">$-{Math.round(totalExpense).toLocaleString()}</div>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] comic-border comic-shadow text-black">
          <div className="flex items-center gap-2 mb-2 text-slate-500 font-bold">
            <ShoppingBag size={18} className="text-[#1FA67A]" />
            <span className="text-sm font-black uppercase tracking-wider">我的花費</span>
          </div>
          <div className="text-2xl font-black leading-none mt-2">NT$ {Math.round(myTotalCost).toLocaleString()}</div>
          <p className="text-xs font-bold text-slate-400 mt-2 uppercase">含分擔與個人</p>
        </div>
      </section>

      {/* AI Area */}
      <section>
        <h2 className="text-2xl font-black text-black mb-6 flex items-center gap-2">
          <div className="w-2.5 h-8 bg-[#F6D32D] comic-border"></div>
          AI 智能記帳
        </h2>
        <AIInput 
          onAddTransaction={onAddTransaction} 
          members={state.members} 
          exchangeRate={state.exchangeRate} 
          defaultCurrency={state.defaultCurrency} 
        />
      </section>

      {/* Settlement Section */}
      <section>
        <h2 className="text-2xl font-black text-black mb-6 flex items-center gap-2">
          <div className="w-2.5 h-8 bg-[#1FA67A] comic-border"></div>
          結算與歸屬
        </h2>
        <div className="bg-white comic-border rounded-[2.5rem] p-6 comic-shadow">
          <div className="space-y-8">
            {state.members.map(m => (
              <div key={m.id} className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-[#F6D32D] comic-border rounded-2xl flex items-center justify-center text-black font-black text-xl">
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-black text-xl text-black leading-tight mb-1">{m.name}</div>
                    <div className="flex items-center gap-1.5 text-sm font-bold text-slate-400">
                      <Wallet size={14} />
                      <span>消費: NT$ {Math.round(consumptions[m.id]).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-black text-2xl leading-none ${balances[m.id] > 0 ? 'text-[#1FA67A]' : balances[m.id] < 0 ? 'text-[#E64A4A]' : 'text-slate-300'}`}>
                    {balances[m.id] > 0 ? '+' : ''}{Math.round(balances[m.id]).toLocaleString()}
                  </div>
                  <div className="text-xs font-black text-slate-300 uppercase mt-1">結算餘額</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Activity - 修正日期排版 */}
      <section>
        <div className="flex justify-between items-end mb-6">
          <h2 className="text-2xl font-black text-black flex items-center gap-2">
            <div className="w-2.5 h-8 bg-slate-400 comic-border"></div>
            最新動態
          </h2>
          <span className="text-sm font-bold text-slate-400 italic">僅 3 筆</span>
        </div>
        <div className="space-y-5">
          {recentTransactions.map(t => (
            <div key={t.id} className="bg-white comic-border p-6 rounded-3xl flex items-center gap-5 hover:bg-slate-50 transition-colors">
              <div className={`w-12 h-12 rounded-2xl comic-border bg-white text-black shrink-0 flex items-center justify-center`}>
                {CATEGORY_ICONS[t.category]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-black text-xl text-black truncate leading-tight">{t.merchant}</div>
                <div className="text-sm font-bold text-slate-500 truncate mt-1">{t.item}</div>
                <div className="text-sm font-black text-slate-400 mt-3 flex items-center gap-2 overflow-hidden">
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 border border-slate-200 shrink-0">{state.members.find(m => m.id === t.payerId)?.name}</span>
                  <span className="italic opacity-60 whitespace-nowrap">{t.date}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-black text-xl text-black">-${Math.round(t.ntdAmount).toLocaleString()}</div>
                <div className="text-xs font-bold text-slate-300 uppercase mt-1">{t.originalAmount} {t.currency}</div>
              </div>
            </div>
          ))}
          {recentTransactions.length === 0 && (
            <div className="text-center py-20 text-slate-300 font-black italic text-2xl tracking-widest">NO RECORDS</div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Overview;
