
import React, { useState } from 'react';
import { AppState } from '../types';
import { UserPlus, Trash2, ArrowRightLeft, Users, Database, Copy, CheckCircle2, RefreshCw, Coins, UserCheck } from 'lucide-react';
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
    e.stopPropagation(); // 防止觸發切換使用者
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
    <div className="space-y-10 pb-32 max-w-full overflow-hidden">
      {/* 旅伴設定 & 身份切換 */}
      <section className="bg-white comic-border rounded-[2.5rem] p-6 comic-shadow w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Users size={20} strokeWidth={3} className="shrink-0" />
            <h2 className="text-xl font-black italic">旅伴與身份設定</h2>
          </div>
          <span className="text-[10px] font-black bg-slate-100 px-2 py-1 rounded-lg text-slate-400 uppercase tracking-tighter">點擊切換身份</span>
        </div>
        
        <div className="space-y-6">
          <div className="flex gap-3 w-full">
            <input 
              className="flex-1 bg-slate-50 border-2 border-black rounded-2xl px-5 py-4 font-bold text-base min-w-0"
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
              className="bg-black text-white px-5 rounded-2xl comic-shadow-sm active:translate-y-0.5 transition-all shrink-0 flex items-center justify-center"
            >
              <UserPlus size={22} strokeWidth={3} />
            </button>
          </div>

          <div className="space-y-3">
            {state.members.map(m => (
              <div 
                key={m.id} 
                onClick={() => updateState({ currentUser: m.id })}
                className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer group ${
                  state.currentUser === m.id 
                    ? 'bg-[#F6D32D] border-black shadow-sm translate-y-[-2px]' 
                    : 'bg-white border-slate-100 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 comic-border rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${state.currentUser === m.id ? 'bg-white' : 'bg-[#F6D32D]'}`}>
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-black text-lg truncate leading-none mb-1">{m.name}</span>
                    {state.currentUser === m.id && (
                      <span className="text-[10px] font-black uppercase text-black/50">目前的你</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {state.currentUser === m.id && <UserCheck size={18} className="text-black mr-2" strokeWidth={3} />}
                  <button 
                    onClick={(e) => deleteMember(e, m.id)}
                    className={`p-3 rounded-xl transition-all ${
                      state.currentUser === m.id ? 'text-black/30 hover:text-black hover:bg-black/5' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'
                    }`}
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 幣別與匯率設定 */}
      <section className="bg-[#F6D32D] comic-border rounded-[2.5rem] p-6 comic-shadow w-full">
        <div className="flex items-center gap-2 mb-6">
          <Coins size={20} strokeWidth={3} className="shrink-0" />
          <h2 className="text-xl font-black italic">幣別與匯率設定</h2>
        </div>
        <div className="space-y-5">
          <div className="w-full">
            <label className="text-xs font-black text-black/50 mb-2 block uppercase tracking-widest">預設外幣種類</label>
            <input 
              className="w-full bg-white border-2 border-black rounded-2xl px-5 py-4 font-black text-lg uppercase"
              value={state.defaultCurrency}
              onChange={e => updateState({ defaultCurrency: e.target.value.toUpperCase() })}
            />
          </div>
          
          <div className="w-full">
            <label className="text-xs font-black text-black/50 mb-2 block uppercase tracking-widest">匯率 (1 {state.defaultCurrency} = ? TWD)</label>
            <div className="flex gap-3">
              <input 
                type="number"
                step="0.01"
                className="flex-1 bg-white border-2 border-black rounded-2xl px-5 py-4 font-black text-2xl min-w-0"
                value={state.exchangeRate}
                onChange={e => updateState({ exchangeRate: Number(e.target.value) })}
              />
              <button 
                onClick={handleSyncRate}
                disabled={isSyncing}
                className="bg-black text-white px-5 rounded-2xl comic-shadow-sm active:translate-y-0.5 transition-all flex items-center justify-center shrink-0"
              >
                {isSyncing ? <RefreshCw className="animate-spin" size={24} /> : <ArrowRightLeft size={24} />}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 雲端同步設定 */}
      <section className="bg-white comic-border rounded-[3rem] p-7 comic-shadow w-full">
        <div className="flex items-center gap-3 mb-8">
          <Database size={24} strokeWidth={3} className="shrink-0" />
          <h2 className="text-2xl font-black italic">雲端同步設定</h2>
        </div>

        <div className="space-y-8">
          <div>
            <label className="text-[11px] font-black text-slate-400 mb-2.5 block uppercase tracking-[0.2em]">Google Web App URL</label>
            <input 
              className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-5 py-4 font-bold text-sm text-slate-600 min-w-0"
              placeholder="貼上您的 GAS 部署連結..."
              value={state.sheetUrl}
              onChange={e => updateState({ sheetUrl: e.target.value })}
            />
          </div>

          <div className="bg-slate-950 rounded-[2rem] p-6 relative overflow-hidden group">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                GAS 腳本 (支援修改/查詢)
              </span>
              <button 
                onClick={copyCode}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all"
              >
                {copied ? <CheckCircle2 size={14} className="text-green-400" /> : <Copy size={14} />}
                <span className="text-[10px] font-black">{copied ? 'COPIED' : 'COPY'}</span>
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto overflow-x-auto no-scrollbar rounded-xl bg-black/40 p-4">
              <pre className="text-[10px] text-slate-300 font-mono leading-relaxed whitespace-pre break-all">
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
