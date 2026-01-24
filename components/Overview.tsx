
import React from 'react';
import { Transaction, Member, AppState } from '../types';
import AIInput from './AIInput';
import { CATEGORY_ICONS } from '../constants';
import { TrendingUp, Wallet, ArrowRightLeft, ShoppingBag } from 'lucide-react';

interface OverviewProps {
  state: AppState;
  onAddTransaction: (t: Partial<Transaction>) => void;
}

const Overview: React.FC<OverviewProps> = ({ state, onAddTransaction }) => {
  // 計算總計數據
  const totalExpense = state.transactions.reduce((acc, t) => acc + t.ntdAmount, 0);

  /**
   * 核心統計邏輯
   */
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

  // 調整為僅顯示 3 筆最新動態
  const recentTransactions = [...state.transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  return (
    <div className="space-y-10 pb-10">
      {/* Summary Cards */}
      <section className="grid grid-cols-2 gap-4">
        <div className="bg-[#E64A4A] p-5 rounded-[2rem] text-white comic-border comic-shadow">
          <div className="flex items-center gap-2 mb-2 opacity-90 font-bold">
            <TrendingUp size={16} />
            <span className="text-sm font-black uppercase">整趟支出</span>
          </div>
          <div className="text-2xl font-black">$-{Math.round(totalExpense).toLocaleString()}</div>
        </div>
        <div className="bg-white p-5 rounded-[2rem] comic-border comic-shadow text-black">
          <div className="flex items-center gap-2 mb-2 text-slate-500 font-bold">
            <ShoppingBag size={16} className="text-[#1FA67A]" />
            <span className="text-sm font-black uppercase">我的花費</span>
          </div>
          <div className="text-2xl font-black">NT$ {Math.round(myTotalCost).toLocaleString()}</div>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase">含分擔與個人</p>
        </div>
      </section>

      {/* AI Area */}
      <section>
        <h2 className="text-xl font-black text-black mb-5 flex items-center gap-2">
          <div className="w-2 h-6 bg-[#F6D32D] comic-border"></div>
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
        <h2 className="text-xl font-black text-black mb-5 flex items-center gap-2">
          <div className="w-2 h-6 bg-[#1FA67A] comic-border"></div>
          結算與歸屬
        </h2>
        <div className="bg-white comic-border rounded-[2.5rem] p-6 comic-shadow">
          <div className="space-y-6">
            {state.members.map(m => (
              <div key={m.id} className="flex items-center justify-between border-b-2 border-slate-50 pb-5 last:border-0 last:pb-0">
                <div className="flex items-center gap-4">
                  <div className="h-12 px-4 bg-[#F6D32D] comic-border rounded-full flex items-center justify-center text-black font-black text-xs whitespace-nowrap">
                    {m.name}
                  </div>
                  <div>
                    <div className="font-black text-lg text-black">{m.name}</div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                      <Wallet size={12} />
                      <span>總消費: NT$ {Math.round(consumptions[m.id]).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-black text-xl ${balances[m.id] > 0 ? 'text-[#1FA67A]' : balances[m.id] < 0 ? 'text-[#E64A4A]' : 'text-slate-300'}`}>
                    {balances[m.id] > 0 ? '+' : ''}{Math.round(balances[m.id]).toLocaleString()}
                  </div>
                  <div className="text-xs font-black text-slate-300 uppercase tracking-tighter">結算餘額</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Activity */}
      <section>
        <div className="flex justify-between items-end mb-5">
          <h2 className="text-xl font-black text-black flex items-center gap-2">
            <div className="w-2 h-6 bg-slate-400 comic-border"></div>
            最新動態
          </h2>
          <span className="text-xs font-bold text-slate-400 italic">僅顯示 3 筆</span>
        </div>
        <div className="space-y-4">
          {recentTransactions.map(t => (
            <div key={t.id} className="bg-white comic-border p-5 rounded-2xl flex items-center gap-4 hover:bg-slate-50 transition-colors">
              <div className={`p-3 rounded-xl comic-border bg-white text-black shrink-0`}>
                {CATEGORY_ICONS[t.category]}
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="font-black text-lg text-black truncate leading-none">{t.merchant}</div>
                <div className="text-sm font-bold text-slate-500 truncate mt-1">{t.item}</div>
                <div className="text-xs font-bold text-slate-400 mt-2 flex items-center flex-wrap gap-2">
                  <span className="whitespace-nowrap">{t.date}</span>
                  <span className="text-slate-200">•</span>
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 whitespace-nowrap">{state.members.find(m => m.id === t.payerId)?.name} 付款</span>
                  {!t.isSplit && <span className="bg-pink-100 text-pink-600 px-2 py-0.5 rounded whitespace-nowrap">個人</span>}
                </div>
              </div>
              <div className="text-right shrink-0 border-l border-slate-100 pl-3">
                <div className="font-black text-lg text-black">-${Math.round(t.ntdAmount).toLocaleString()}</div>
                <div className="text-xs font-bold text-slate-300 uppercase tracking-tighter">{t.originalAmount} {t.currency}</div>
              </div>
            </div>
          ))}
          {recentTransactions.length === 0 && (
            <div className="text-center py-20 text-slate-300 font-black italic text-2xl">ZZZ... 尚無紀錄</div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Overview;
