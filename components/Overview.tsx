
import React from 'react';
import { Transaction, Member, AppState } from '../types';
import AIInput from './AIInput';
import { CATEGORY_ICONS, CATEGORY_COLORS, DEFAULT_CATEGORY_ICON, DEFAULT_CATEGORY_COLOR } from '../constants';
import { TrendingUp, ShoppingBag, Users, ReceiptText, FileSpreadsheet, User } from 'lucide-react';

interface OverviewProps {
  state: AppState;
  onAddTransaction: (t: Partial<Transaction>) => void;
  setIsAIProcessing: (loading: boolean) => void;
  onEditTransaction: (id: string) => void;
}

const Overview: React.FC<OverviewProps> = ({ state, onAddTransaction, setIsAIProcessing, onEditTransaction }) => {
  const totalExpense = state.transactions.reduce((acc, t) => acc + t.ntdAmount, 0);

  const calculateStats = () => {
    const prepaid: Record<string, number> = {};
    const publicPayable: Record<string, number> = {};
    const privateSpending: Record<string, number> = {};
    const balances: Record<string, number> = {};
    
    state.members.forEach(m => {
      prepaid[m.id] = 0;
      publicPayable[m.id] = 0;
      privateSpending[m.id] = 0;
      balances[m.id] = 0;
    });

    state.transactions.forEach(t => {
      if (t.isSplit) {
        // 公帳：付款人墊付
        prepaid[t.payerId] += t.ntdAmount;
        
        if (t.customSplits && Object.keys(t.customSplits).length > 0) {
          Object.entries(t.customSplits as Record<string, number>).forEach(([mid, amount]) => {
            publicPayable[mid] += amount as number;
          });
        } else {
          const splitCount = t.splitWith.length;
          if (splitCount > 0) {
            const perPerson = t.ntdAmount / splitCount;
            t.splitWith.forEach(mid => {
              publicPayable[mid] += perPerson;
            });
          }
        }
      } else {
        // 私帳：付款人自己的消費
        privateSpending[t.payerId] += t.ntdAmount;
      }
    });

    state.members.forEach(m => {
      balances[m.id] = prepaid[m.id] - publicPayable[m.id];
    });

    return { prepaid, publicPayable, privateSpending, balances };
  };

  const { prepaid, publicPayable, privateSpending, balances } = calculateStats();
  const myTotalCost = (publicPayable[state.currentUser] || 0) + (privateSpending[state.currentUser] || 0);

  // 計算目前登入者的各分類支出
  const calculateCategoryStats = () => {
    const stats: Record<string, number> = {};
    state.transactions.forEach(t => {
      let myShare = 0;
      if (t.isSplit) {
        if (t.customSplits && t.customSplits[state.currentUser] !== undefined) {
          myShare = t.customSplits[state.currentUser] as number;
        } else if (t.splitWith.includes(state.currentUser)) {
          myShare = t.ntdAmount / t.splitWith.length;
        }
      } else if (t.payerId === state.currentUser) {
        myShare = t.ntdAmount;
      }

      if (myShare > 0) {
        stats[t.category] = (stats[t.category] || 0) + myShare;
      }
    });
    return Object.entries(stats).sort((a, b) => b[1] - a[1]);
  };

  const myCategoryStats = calculateCategoryStats();

  const recentTransactions = [...state.transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  return (
    <div className="space-y-10 pb-16">
      <section className="mt-2">
        <AIInput 
          onAddTransaction={onAddTransaction} 
          members={state.members} 
          categories={state.categories}
          exchangeRate={state.exchangeRate} 
          defaultCurrency={state.defaultCurrency}
          setIsAIProcessing={setIsAIProcessing} 
          currentUserId={state.currentUser}
        />
      </section>

      <section className="grid grid-cols-2 gap-4">
        <div className="bg-[#E64A4A] p-5 rounded-3xl text-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-1.5 mb-2 opacity-80">
            <TrendingUp size={14} />
            <span className="text-[11px] font-black uppercase tracking-widest">總支出</span>
          </div>
          <div className="text-2xl font-black leading-none italic">NT$ {Math.round(totalExpense).toLocaleString()}</div>
        </div>
        <div className="bg-[#F6D32D] p-5 rounded-3xl text-black border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-1.5 mb-2 opacity-80">
            <ShoppingBag size={14} />
            <span className="text-[11px] font-black uppercase tracking-widest">我的花費</span>
          </div>
          <div className="text-2xl font-black leading-none italic">NT$ {Math.round(myTotalCost).toLocaleString()}</div>
        </div>
      </section>

      <section>
        <div className="flex justify-between items-center mb-5 px-1">
          <h3 className="text-xl font-black text-black flex items-center gap-2 italic">
            <ReceiptText size={20} className="text-blue-500" /> 最近動態
          </h3>
        </div>
        <div className="space-y-4">
          {recentTransactions.map(t => {
            const payer = state.members.find(m => m.id === t.payerId);
            const isAllSplit = t.isSplit && t.splitWith.length === state.members.length;
            const splitNames = t.isSplit ? t.splitWith.map(id => state.members.find(m => m.id === id)?.name || id).join(', ') : '';

            return (
              <div 
                key={t.id} 
                onClick={() => onEditTransaction(t.id)}
                className="bg-white border-2 border-black p-5 rounded-2xl flex items-center gap-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:scale-[0.98] transition-all cursor-pointer"
              >
                <div className={`w-11 h-11 rounded-xl border-2 border-black flex items-center justify-center shrink-0 ${(CATEGORY_COLORS[t.category] || DEFAULT_CATEGORY_COLOR).split(' ')[0]}`}>
                  {React.cloneElement((CATEGORY_ICONS[t.category] || DEFAULT_CATEGORY_ICON) as React.ReactElement<any>, { size: 18 })}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-sm text-black truncate flex items-center gap-2 mb-0.5">
                    {t.merchant}
                    {t.type === '私帳' && <span className="text-[10px] px-2 py-0.5 bg-slate-100 border border-black rounded uppercase tracking-tighter">Private</span>}
                  </div>
                  <div className="text-xs font-bold text-slate-400 truncate mb-2">{t.item}</div>
                  
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <div className="flex items-center gap-1 text-[11px] font-black text-blue-500">
                      <User size={11} />
                      <span>{payer?.name || t.payerId}</span>
                    </div>
                    {t.isSplit && t.type === '公帳' && (
                      <div className="flex items-center gap-1 text-[11px] font-black text-slate-400">
                        <Users size={11} />
                        {isAllSplit ? (
                          <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 text-[9px] leading-none uppercase">ALL</span>
                        ) : (
                          <span className="truncate max-w-[120px]">{splitNames}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-slate-400 italic mb-1">
                    {t.originalAmount.toLocaleString()} {t.currency}
                  </div>
                  <div className="font-black text-lg text-black italic leading-none">
                    NT$ {Math.round(t.ntdAmount).toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex justify-between items-center mb-6 px-1">
          <h2 className="text-2xl font-black text-black flex items-center gap-2 italic">
            <FileSpreadsheet size={24} className="text-[#1FA67A]" /> Balance Sheet
          </h2>
          <div className="bg-blue-500 text-white text-xs font-black px-3 py-1.5 rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase tracking-widest">
            Settlement
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-8">
          {state.members.map(m => {
            const balance = balances[m.id];
            const isPositive = balance > 0;
            const isZero = Math.abs(balance) < 1;
            const myPrepaid = prepaid[m.id] || 0;
            const myPublicPayable = publicPayable[m.id] || 0;
            const myPrivateSpending = privateSpending[m.id] || 0;
            const totalMyCost = myPublicPayable + myPrivateSpending;
            const consumptionPercent = totalExpense > 0 ? (totalMyCost / totalExpense) * 100 : 0;
            const isMe = m.id === state.currentUser;

            const statusTextColor = isPositive ? 'text-[#1FA67A]' : isZero ? 'text-slate-400' : 'text-[#E64A4A]';
            const cardBg = isPositive ? 'bg-[#F4FBF7]' : isZero ? 'bg-white' : 'bg-[#FEF5F5]';
            const statusLabel = isPositive ? 'CREDIT' : isZero ? 'EVEN' : 'DEBT';

            return (
              <div key={m.id} className={`relative border-2 border-black rounded-[2.5rem] p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden transition-all hover:-translate-y-1 ${cardBg}`}>
                <div className="absolute -top-3 -right-4 text-black/[0.04] font-black text-8xl italic pointer-events-none uppercase tracking-tighter select-none">
                  {statusLabel}
                </div>
                {isMe && (
                  <div className="absolute top-6 right-0 bg-blue-500 text-white text-xs font-black px-4 py-1.5 rounded-l-2xl z-20 border-y-2 border-l-2 border-black">
                    YOU
                  </div>
                )}
                <div className="relative z-10 space-y-6">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-[#F6D32D] border-2 border-black rounded-2xl flex items-center justify-center text-black font-black text-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rotate-[-3deg] shrink-0">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-xl text-black truncate mb-2">{m.name}</div>
                      <div className="flex items-center gap-4">
                        <div className="flex-1 h-2 bg-black/5 rounded-full overflow-hidden border border-black/10">
                           <div className="h-full bg-[#1FA67A] rounded-full transition-all duration-1000" style={{ width: `${consumptionPercent}%` }} />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 italic shrink-0">{Math.round(consumptionPercent)}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center bg-white/60 border-2 border-black/10 rounded-xl px-4 py-3">
                      <span className="text-xs font-black text-slate-500 italic">公帳應付</span>
                      <span className="text-sm font-black text-black">NT$ {Math.round(myPublicPayable).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center bg-white/60 border-2 border-black/10 rounded-xl px-4 py-3">
                      <span className="text-xs font-black text-slate-500 italic">已墊付</span>
                      <span className="text-sm font-black text-[#1FA67A]">NT$ {Math.round(myPrepaid).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center bg-white/60 border-2 border-black/10 rounded-xl px-4 py-3">
                      <span className="text-xs font-black text-slate-500 italic">私帳消費</span>
                      <span className="text-sm font-black text-slate-600">NT$ {Math.round(myPrivateSpending).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t-2 border-black/5 flex justify-between items-center">
                    <span className="text-sm font-black text-black italic">結算淨額</span>
                    <div className={`text-2xl font-black italic ${statusTextColor}`}>
                      {isPositive ? '+' : ''}{Math.round(balance).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 新增：目前登入者的分類支出統計 */}
      <section className="bg-white border-[3px] border-black rounded-[2.5rem] p-7 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center border-2 border-black">
            <TrendingUp size={20} />
          </div>
          <h3 className="text-xl font-black italic text-black">我的分類支出統計</h3>
        </div>

        <div className="space-y-4">
          {myCategoryStats.length > 0 ? (
            myCategoryStats.map(([cat, amount]) => (
              <div key={cat} className="flex items-center justify-between p-4 bg-slate-50 border-2 border-black rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center ${(CATEGORY_COLORS[cat] || DEFAULT_CATEGORY_COLOR).split(' ')[0]}`}>
                    {React.cloneElement((CATEGORY_ICONS[cat] || DEFAULT_CATEGORY_ICON) as React.ReactElement<any>, { size: 18 })}
                  </div>
                  <span className="font-black text-sm text-black">{cat}</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black italic text-black">NT$ {Math.round(amount).toLocaleString()}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                    佔比 {Math.round((amount / myTotalCost) * 100)}%
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-slate-400 font-bold italic">
              目前尚無任何消費記錄
            </div>
          )}
        </div>
        
        <div className="mt-6 pt-6 border-t-2 border-dashed border-slate-200 flex justify-between items-center">
          <span className="text-sm font-black text-slate-500 italic">我的總花費合計</span>
          <span className="text-2xl font-black italic text-blue-600">NT$ {Math.round(myTotalCost).toLocaleString()}</span>
        </div>
      </section>
    </div>
  );
};

export default Overview;
