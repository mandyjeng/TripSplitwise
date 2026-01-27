
import React from 'react';
import { AppState, Ledger } from '../types';
import { Cloud, UserCheck, Palette, RefreshCw, Sparkles, Database, ChevronRight, ExternalLink, Map } from 'lucide-react';

interface SettingsProps {
  state: AppState;
  updateState: (newState: Partial<AppState>) => void;
  onReloadManagement: () => void;
  onSwitchLedger: (ledger: Ledger) => void;
}

const Settings: React.FC<SettingsProps> = ({ state, updateState, onReloadManagement, onSwitchLedger }) => {
  const activeLedger = state.ledgers.find(l => l.id === state.activeLedgerId);

  // 渲染帳本圖示：如果名稱是數字開頭（通常是年份），則顯示地圖圖示
  const renderLedgerIcon = (name: string, isActive: boolean) => {
    const firstChar = name.charAt(0);
    const isNumeric = /^\d$/.test(firstChar);

    return (
      <div className={`w-12 h-12 border-2 border-black rounded-xl flex items-center justify-center font-black text-xl transition-colors ${isActive ? 'bg-white text-black' : 'bg-slate-200 text-slate-400'}`}>
        {isNumeric ? <Map size={24} /> : firstChar}
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-32">
      {/* 帳本切換中心 */}
      <section className="bg-white comic-border rounded-[2.5rem] p-6 sm:p-8 comic-shadow">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center">
              <Cloud size={24} />
            </div>
            <h2 className="text-xl font-black italic">行程帳本切換</h2>
          </div>
          <button 
            onClick={onReloadManagement}
            className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 active:rotate-180 transition-all duration-500"
          >
            <RefreshCw size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center px-1 mb-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">可切換的行程</label>
            <span className="text-[10px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">共 {state.ledgers.length} 個</span>
          </div>
          
          {state.ledgers.length > 0 ? (
            state.ledgers.map(l => (
              <div key={l.id} className="flex items-center gap-1">
                {/* 左側：主切換按鈕 */}
                <button 
                  onClick={() => onSwitchLedger(l)}
                  className={`flex-1 flex items-center justify-between p-4 rounded-2xl border-[3px] transition-all ${
                    state.activeLedgerId === l.id 
                      ? 'bg-[#F6D32D] border-black shadow-sm' 
                      : 'bg-slate-50 border-slate-100 hover:border-black/20'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {renderLedgerIcon(l.name, state.activeLedgerId === l.id)}
                    <div className="text-left">
                      <div className={`font-black text-base ${state.activeLedgerId === l.id ? 'text-black' : 'text-slate-500'}`}>{l.name}</div>
                      <div className={`text-[10px] font-bold uppercase tracking-tight opacity-60 ${state.activeLedgerId === l.id ? 'text-black' : 'text-slate-400'}`}>
                        {l.currency} @ {l.exchangeRate}
                      </div>
                    </div>
                  </div>
                  {state.activeLedgerId === l.id && (
                    <Sparkles size={18} className="text-black animate-pulse" />
                  )}
                </button>

                {/* 右側：簡約圖示連結 (移除外框，僅保留圖示) */}
                {l.sourceUrl && (
                  <a 
                    href={l.sourceUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    title="開啟原始試算表"
                    className="p-3 text-slate-300 hover:text-blue-500 transition-colors flex items-center justify-center"
                  >
                    <ExternalLink size={20} />
                  </a>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
              <Database size={32} className="mx-auto text-slate-200 mb-3" />
              <p className="text-slate-400 font-black text-sm">
                目前沒有任何帳本<br/>
                <button onClick={onReloadManagement} className="mt-2 text-blue-500 underline">立即同步雲端</button>
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 使用者切換 */}
      <section className="bg-white comic-border rounded-[2.5rem] p-6 sm:p-8 comic-shadow">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
            <UserCheck size={20} />
          </div>
          <h2 className="text-lg font-black italic">目前登入身份</h2>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {state.members.map(m => (
            <button 
              key={m.id}
              onClick={() => updateState({ currentUser: m.id })}
              className={`px-6 py-3.5 rounded-2xl font-black text-sm border-[3px] transition-all ${
                state.currentUser === m.id 
                  ? 'bg-black text-white border-black shadow-sm' 
                  : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-300'
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
      </section>

      {/* 介面風格 */}
      <section className="bg-white comic-border rounded-[2.5rem] p-6 sm:p-8 comic-shadow">
        <div className="flex items-center gap-3 mb-6">
          <Palette size={20} />
          <h2 className="text-lg font-black italic">視覺風格切換</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => updateState({ theme: 'comic' })} 
            className={`py-4 rounded-2xl border-[3px] font-black text-sm transition-all ${state.theme === 'comic' ? 'bg-[#F6D32D] border-black shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-300'}`}
          >
            經典漫畫
          </button>
          <button 
            onClick={() => updateState({ theme: 'fresh' })} 
            className={`py-4 rounded-2xl border-[3px] font-black text-sm transition-all ${state.theme === 'fresh' ? 'bg-blue-50 border-blue-500 text-blue-600 shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-300'}`}
          >
            清新簡約
          </button>
        </div>
      </section>
    </div>
  );
};

export default Settings;
