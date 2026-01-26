import React, { useState } from 'react';
import { AppState } from '../types';
import { UserPlus, Trash2, ArrowRightLeft, Users, Database, Copy, CheckCircle2, RefreshCw, Coins, UserCheck, Palette, Layout, Sparkles } from 'lucide-react';
import { syncExchangeRateToSheet } from '../services/sheets';

interface SettingsProps {
  state: AppState;
  updateState: (newState: Partial<AppState>) => void;
}

const Settings: React.FC<SettingsProps> = ({ state, updateState }) => {
  const [newMemberName, setNewMemberName] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const gasCode = `function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var rows = sheet.getDataRange().getValues();
  var data = [];
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    if (row[0] === "" && row[1] === "") continue; 
    data.push({
      rowIndex: i + 1,
      date: row[0], merchant: row[1], item: row[2], category: row[3],
      accountType: row[4], payer: row[5], currency: row[6],
      originalAmount: row[7], ntdAmount: row[8], isSplit: row[9], splitWith: row[10]
    });
  }
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  
  if (data.type === 'UPDATE_RATE') {
    sheet.getRange('Z1').setValue(data.rate);
  } else if (data.type === 'ADD_TRANSACTION') {
    var lastRow = sheet.getLastRow() + 1;
    var ntdValue = data.ntdAmount || ('=H' + lastRow + '*$Z$1');
    sheet.appendRow([data.date, data.merchant, data.item, data.category, data.accountType, data.payer, data.currency, data.originalAmount, ntdValue, data.isSplit, data.splitWith]);
  } else if (data.type === 'UPDATE_TRANSACTION') {
    var row = data.rowIndex;
    var ntdValue = data.ntdAmount || ('=H' + row + '*$Z$1');
    sheet.getRange(row, 1, 1, 11).setValues([[data.date, data.merchant, data.item, data.category, data.accountType, data.payer, data.currency, data.originalAmount, ntdValue, data.isSplit, data.splitWith]]);
  } else if (data.type === 'DELETE_TRANSACTION') {
    sheet.deleteRow(data.rowIndex);
  }
  return ContentService.createTextOutput("Success");
}`;

  const copyCode = () => {
    navigator.clipboard.writeText(gasCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const deleteMember = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); 
    if (state.members.length <= 1) {
      alert('至少需要保留一位旅伴');
      return;
    }
    if (confirm('確定要刪除這位旅伴嗎？')) {
      const newMembers = state.members.filter(m => m.id !== id);
      const updates: Partial<AppState> = { members: newMembers };
      if (state.currentUser === id) {
        updates.currentUser = newMembers[0].id;
      }
      updateState(updates);
    }
  };

  const handleSyncRate = async () => {
    if (!state.sheetUrl) return;
    setIsSyncing(true);
    const success = await syncExchangeRateToSheet(state.sheetUrl, state.exchangeRate);
    setIsSyncing(false);
    if (success) alert('匯率已更新至雲端');
  };

  return (
    <div className="space-y-8 pb-32 max-w-full overflow-hidden">
      {/* 主題切換區塊 */}
      <section className="bg-white comic-border rounded-[2rem] p-4 sm:p-7 comic-shadow w-full">
        <div className="flex items-center gap-2 mb-4">
          <Palette size={18} strokeWidth={3} className="shrink-0" />
          <h2 className="text-lg font-black italic">主題風格切換</h2>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => updateState({ theme: 'comic' })}
            className={`flex-1 py-3 px-1 rounded-xl border-2 font-black transition-all flex flex-col items-center gap-1.5 ${
              state.theme === 'comic' || !state.theme 
                ? 'bg-[#F6D32D] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' 
                : 'bg-slate-50 border-slate-200 text-slate-400'
            }`}
          >
            <Layout size={18} />
            <span className="text-[13px]">經典漫畫</span>
          </button>
          <button 
            onClick={() => updateState({ theme: 'fresh' })}
            className={`flex-1 py-3 px-1 rounded-xl border-2 font-black transition-all flex flex-col items-center gap-1.5 ${
              state.theme === 'fresh' 
                ? 'bg-blue-50 border-blue-500 text-blue-600 shadow-lg' 
                : 'bg-slate-50 border-slate-200 text-slate-400'
            }`}
          >
            <Sparkles size={18} />
            <span className="text-[13px]">清新簡約</span>
          </button>
        </div>
      </section>

      <section className="bg-white comic-border rounded-[2rem] p-4 sm:p-7 comic-shadow w-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users size={18} strokeWidth={3} className="shrink-0" />
            <h2 className="text-lg font-black italic">旅伴與身份設定</h2>
          </div>
          <span className="text-[8px] sm:text-[10px] font-black bg-slate-100 px-1.5 py-0.5 rounded text-slate-400 uppercase">點擊切換</span>
        </div>
        
        <div className="space-y-5">
          <div className="flex gap-2.5 w-full">
            <input 
              className="flex-1 bg-slate-50 border-2 border-black rounded-xl px-3.5 py-3 font-bold text-sm min-w-0"
              placeholder="新增旅伴..."
              value={newMemberName}
              onChange={e => setNewMemberName(e.target.value)}
            />
            <button 
              onClick={() => {
                if (!newMemberName.trim()) return;
                updateState({ members: [...state.members, { id: Math.random().toString(36).substr(2, 9), name: newMemberName.trim() }] });
                setNewMemberName('');
              }}
              className="bg-black text-white px-3.5 rounded-xl comic-shadow-sm active:translate-y-0.5 transition-all shrink-0 flex items-center justify-center"
            >
              <UserPlus size={20} strokeWidth={3} />
            </button>
          </div>

          <div className="space-y-2.5">
            {state.members.map(m => (
              <div 
                key={m.id} 
                onClick={() => updateState({ currentUser: m.id })}
                className={`flex items-center justify-between p-2.5 sm:p-4 rounded-xl border-2 transition-all cursor-pointer group ${
                  state.currentUser === m.id 
                    ? 'bg-[#F6D32D] border-black shadow-sm translate-y-[-1px]' 
                    : 'bg-white border-slate-100 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 comic-border rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${state.currentUser === m.id ? 'bg-white' : 'bg-[#F6D32D]'}`}>
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-black text-sm sm:text-lg truncate leading-none mb-0.5">{m.name}</span>
                    {state.currentUser === m.id && (
                      <span className="text-[8px] sm:text-[10px] font-black uppercase text-black/40 tracking-tighter">目前的你</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {state.currentUser === m.id && <UserCheck size={16} className="text-black mr-1" strokeWidth={3} />}
                  <button 
                    onClick={(e) => deleteMember(e, m.id)}
                    className={`p-2 rounded-lg transition-all ${
                      state.currentUser === m.id ? 'text-black/30 hover:text-black hover:bg-black/5' : 'text-slate-200 hover:text-red-500 hover:bg-red-50'
                    }`}
                  >
                    <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#F6D32D] comic-border rounded-[2rem] p-4 sm:p-7 comic-shadow w-full">
        <div className="flex items-center gap-2 mb-4">
          <Coins size={18} strokeWidth={3} className="shrink-0" />
          <h2 className="text-lg font-black italic">幣別與匯率設定</h2>
        </div>
        <div className="space-y-4">
          <div className="w-full">
            <label className="text-[9px] font-black text-black/40 mb-1.5 block uppercase tracking-widest">預設外幣</label>
            <input 
              className="w-full bg-white border-2 border-black rounded-xl px-4 py-3 font-black text-base uppercase"
              value={state.defaultCurrency}
              onChange={e => updateState({ defaultCurrency: e.target.value.toUpperCase() })}
            />
          </div>
          
          <div className="w-full">
            <label className="text-[9px] font-black text-black/40 mb-1.5 block uppercase tracking-widest">匯率 (1 {state.defaultCurrency} = ? TWD)</label>
            <div className="flex gap-2.5">
              <input 
                type="number"
                step="0.01"
                className="flex-1 bg-white border-2 border-black rounded-xl px-4 py-3 font-black text-lg min-w-0"
                value={state.exchangeRate}
                onChange={e => updateState({ exchangeRate: Number(e.target.value) })}
              />
              <button 
                onClick={handleSyncRate}
                disabled={isSyncing}
                className="bg-black text-white px-3.5 rounded-xl comic-shadow-sm active:translate-y-0.5 transition-all flex items-center justify-center shrink-0"
              >
                {isSyncing ? <RefreshCw className="animate-spin w-5 h-5" /> : <ArrowRightLeft className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white comic-border rounded-[2rem] p-4 sm:p-7 comic-shadow w-full">
        <div className="flex items-center gap-2.5 mb-5">
          <Database size={20} strokeWidth={3} className="shrink-0" />
          <h2 className="text-lg font-black italic">雲端同步設定</h2>
        </div>

        <div className="space-y-6">
          <div>
            <label className="text-[9px] font-black text-slate-400 mb-2 block uppercase tracking-widest">Web App URL</label>
            <input 
              className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3.5 py-3 font-bold text-[11px] text-slate-500 min-w-0"
              placeholder="貼上 GAS 連結..."
              value={state.sheetUrl}
              onChange={e => updateState({ sheetUrl: e.target.value })}
            />
          </div>

          <div className="bg-slate-950 rounded-[1.25rem] p-4 relative overflow-hidden group">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div>
                GAS 腳本
              </span>
              <button 
                onClick={copyCode}
                className="flex items-center gap-1.5 px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded-md transition-all"
              >
                {copied ? <CheckCircle2 size={10} className="text-green-400" /> : <Copy size={10} />}
                <span className="text-[8px] font-black">{copied ? 'COPIED' : 'COPY'}</span>
              </button>
            </div>
            <div className="max-h-32 overflow-y-auto no-scrollbar rounded-lg bg-black/40 p-2.5">
              <pre className="text-[8px] text-slate-400 font-mono leading-relaxed whitespace-pre break-all">
                {gasCode}
              </pre>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Settings;