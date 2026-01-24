
import React, { useState } from 'react';
import { AppState } from '../types';
import { UserPlus, Trash2, ArrowRightLeft, Users, Database, Copy, CheckCircle2, RefreshCw, Coins } from 'lucide-react';
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

  const deleteMember = (id: string) => {
    if (state.members.length <= 1) {
      alert('至少需要保留一位旅伴');
      return;
    }

    const newMembers = state.members.filter(m => m.id !== id);
    const updates: Partial<AppState> = { members: newMembers };

    if (state.currentUser === id) {
      updates.currentUser = newMembers[0].id;
    }

    updateState(updates);
  };

  return (
    <div className="space-y-10 pb-20">
      <section className="bg-white comic-border rounded-[2rem] p-6 comic-shadow">
        <div className="flex items-center gap-2 mb-6">
          <Users size={20} />
          <h2 className="text-lg font-black italic">旅伴設定</h2>
        </div>
        <div className="space-y-6">
          <div className="flex gap-2">
            <input 
              className="flex-1 bg-slate-50 border-2 border-black rounded-xl px-4 py-3 font-bold"
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
              className="bg-black text-white p-3 rounded-xl comic-shadow-sm"
            >
              <UserPlus size={20} />
            </button>
          </div>
          <div className="space-y-3">
            {state.members.map(m => (
              <div key={m.id} className="flex items-center justify-between p-3 bg-slate-50 border-2 border-black rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="h-8 px-2 rounded-full border-2 border-black bg-[#F6D32D] flex items-center justify-center font-black text-[9px] whitespace-nowrap">
                    {m.name}
                  </div>
                  <span className="font-bold text-black">{m.name}</span>
                </div>
                <button onClick={() => deleteMember(m.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#F6D32D] comic-border rounded-[2rem] p-6 comic-shadow">
        <div className="flex items-center gap-2 mb-4">
          <Coins size={20} />
          <h2 className="text-lg font-black italic">幣別與匯率設定</h2>
        </div>
        
        <div className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-black/50 uppercase tracking-widest px-1">預設外幣種類</label>
            <input 
              className="w-full bg-white border-2 border-black rounded-xl px-4 py-3 font-black text-lg uppercase"
              placeholder="例如: CHF, JPY"
              value={state.defaultCurrency}
              onChange={e => updateState({ defaultCurrency: e.target.value.toUpperCase() })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-black/50 uppercase tracking-widest px-1">匯率 (1 {state.defaultCurrency || '外幣'} = ? TWD)</label>
            <div className="flex gap-3">
              <input 
                type="number"
                className="flex-1 bg-white border-2 border-black rounded-xl px-4 py-3 font-black text-2xl"
                value={state.exchangeRate}
                onChange={e => updateState({ exchangeRate: Number(e.target.value) })}
              />
              <button 
                onClick={async () => {
                  if (!state.sheetUrl) return alert('請先設定 URL');
                  setIsSyncing(true);
                  await syncExchangeRateToSheet(state.sheetUrl, state.exchangeRate);
                  setIsSyncing(false);
                  alert(`已同步 ${state.defaultCurrency} 匯率至試算表 Z1`);
                }} 
                className="bg-black text-white px-5 rounded-xl comic-shadow-sm flex items-center justify-center active:translate-y-1 transition-all"
                title="同步匯率到雲端"
              >
                {isSyncing ? <RefreshCw size={24} className="animate-spin" /> : <RefreshCw size={24} />}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white comic-border rounded-[2rem] p-6 comic-shadow">
        <div className="flex items-center gap-2 mb-6">
          <Database size={20} />
          <h2 className="text-lg font-black italic">雲端同步設定</h2>
        </div>
        <div className="space-y-4">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Google Web App URL</label>
          <input 
            className="w-full bg-slate-50 border-2 border-black rounded-xl px-4 py-3 text-[10px] font-mono"
            value={state.sheetUrl || ''}
            onChange={e => updateState({ sheetUrl: e.target.value })}
          />
          <div className="bg-black rounded-2xl p-4 relative">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-widest">GAS 腳本 (支援修改/查詢)</span>
              <button onClick={copyCode} className="text-white">
                {copied ? <CheckCircle2 size={16} className="text-green-500" /> : <Copy size={16} />}
              </button>
            </div>
            <pre className="text-[9px] text-white/60 overflow-x-auto h-32 no-scrollbar font-mono leading-relaxed">
              {gasCode}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Settings;
