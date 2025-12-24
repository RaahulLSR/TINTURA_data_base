
import React, { useState } from 'react';
import { X, Plus, PlusCircle, ArrowLeftRight, Trash2, Upload, ImageIcon, Send, Loader2 } from 'lucide-react';
import { Unit, SizeBreakdown, Attachment } from '../../types';
import { createOrder, uploadOrderAttachment, triggerOrderEmail } from '../../services/db';

interface LaunchOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  units: Unit[];
  onSuccess: () => void;
}

export const LaunchOrderModal: React.FC<LaunchOrderModalProps> = ({ isOpen, onClose, units, onSuccess }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [useNumericSizes, setUseNumericSizes] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [newOrder, setNewOrder] = useState({ style_number: '', unit_id: 1, target_delivery_date: '', description: '', box_count: 0 });
  const [breakdown, setBreakdown] = useState<SizeBreakdown[]>([{ color: '', s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0 }]);

  if (!isOpen) return null;

  const getRowTotal = (row: SizeBreakdown) => (row.s || 0) + (row.m || 0) + (row.l || 0) + (row.xl || 0) + (row.xxl || 0) + (row.xxxl || 0);
  const getTotalQuantity = (bd: SizeBreakdown[]) => bd.reduce((acc, row) => acc + getRowTotal(row), 0);
  const getHeaderLabels = () => useNumericSizes ? ['65', '70', '75', '80', '85', '90'] : ['S', 'M', 'L', 'XL', 'XXL', '3XL'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const quantity = getTotalQuantity(breakdown);
    if (quantity === 0) return alert("Total quantity cannot be zero");

    setIsUploading(true);
    try {
      const attachments: Attachment[] = [];
      for (const file of selectedFiles) {
        const url = await uploadOrderAttachment(file);
        if (url) attachments.push({ name: file.name, url, type: file.type.startsWith('image/') ? 'image' : 'document' });
      }

      const { data, error } = await createOrder({ ...newOrder, quantity, size_breakdown: breakdown, attachments, size_format: useNumericSizes ? 'numeric' : 'standard' });
      if (data) {
        await triggerOrderEmail(data.id, false);
        onSuccess();
        onClose();
      } else {
        alert(`Error: ${error}`);
      }
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh] animate-scale-up border border-slate-200">
        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
          <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-lg"><Plus size={24}/></div>
            Launch Production Order
          </h3>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={32}/></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Style Reference</label><input required className="w-full border-2 border-slate-100 rounded-xl p-4 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none" value={newOrder.style_number} onChange={e => setNewOrder({...newOrder, style_number: e.target.value})}/></div>
            <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Assign Facility</label><select className="w-full border-2 border-slate-100 rounded-xl p-4 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none" value={newOrder.unit_id} onChange={e => setNewOrder({...newOrder, unit_id: parseInt(e.target.value)})}>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
            <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Planned Box Count</label><input required type="number" min="1" className="w-full border-2 border-slate-100 rounded-xl p-4 bg-white text-slate-900 font-black focus:ring-2 focus:ring-indigo-500 outline-none" value={newOrder.box_count} onChange={e => setNewOrder({...newOrder, box_count: parseInt(e.target.value) || 0})}/></div>
            <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Delivery Due</label><input required type="date" className="w-full border-2 border-slate-100 rounded-xl p-4 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none" value={newOrder.target_delivery_date} onChange={e => setNewOrder({...newOrder, target_delivery_date: e.target.value})}/></div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-4"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Color & Size Matrix</label><button type="button" onClick={() => setUseNumericSizes(!useNumericSizes)} className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-5 py-2 rounded-xl border border-indigo-100 uppercase tracking-widest transition-all"><ArrowLeftRight size={14} className="inline mr-2"/> Format: {useNumericSizes ? '65-90' : 'S-3XL'}</button></div>
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-lg">
              <table className="w-full text-center text-sm border-collapse">
                <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[10px] tracking-widest border-b"><tr><th className="p-4 text-left border-r">Color Variant</th>{getHeaderLabels().map(h => <th key={h} className="p-4 border-r">{h}</th>)}<th className="p-4 bg-slate-100">Row Sum</th><th className="p-4 w-12"></th></tr></thead>
                <tbody className="divide-y divide-slate-100">{breakdown.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3 border-r"><input placeholder="e.g. Navy" className="w-full border-2 border-slate-50 rounded-xl px-4 py-3 bg-white focus:ring-2 focus:ring-indigo-500 font-bold outline-none" value={row.color} onChange={e => { const nb = [...breakdown]; nb[idx].color = e.target.value; setBreakdown(nb); }}/></td>
                    {['s','m','l','xl','xxl','xxxl'].map(sz => (<td key={sz} className="p-3 border-r"><input type="number" className="w-full border-2 border-slate-50 rounded-xl px-2 py-3 text-center bg-white focus:ring-2 focus:ring-indigo-500 font-black outline-none" value={(row as any)[sz] || ''} onChange={e => { const nb = [...breakdown]; (nb[idx] as any)[sz] = parseInt(e.target.value) || 0; setBreakdown(nb); }}/></td>))}
                    <td className="p-3 font-black text-indigo-700 bg-slate-50/50 tabular-nums text-lg">{getRowTotal(row)}</td>
                    <td className="p-3">{breakdown.length > 1 && <button type="button" onClick={() => setBreakdown(breakdown.filter((_, i) => i !== idx))} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={20}/></button>}</td>
                  </tr>))}
                </tbody></table>
              <button type="button" onClick={() => setBreakdown([...breakdown, { color: '', s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0 }])} className="w-full py-5 text-[10px] font-black text-indigo-600 hover:bg-indigo-50 border-t border-slate-100 transition-colors bg-slate-50/20 uppercase tracking-widest flex items-center justify-center gap-2"><PlusCircle size={16}/> Add New Color Variant</button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Production Notes</label><textarea className="w-full border-2 border-slate-100 rounded-3xl p-6 h-48 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={newOrder.description} onChange={e => setNewOrder({...newOrder, description: e.target.value})}></textarea></div>
            <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Technical Attachments</label>
              <div className="border-4 border-dashed border-slate-100 rounded-3xl p-8 bg-slate-50 hover:bg-indigo-50/30 hover:border-indigo-200 relative h-48 flex flex-col items-center justify-center cursor-pointer transition-all">
                <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => e.target.files && setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)])}/>
                <Upload size={48} className="text-slate-300 mb-3" /><p className="text-base font-black text-slate-700 uppercase">Drop Techpacks</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">{selectedFiles.map((f, i) => (<div key={i} className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-black shadow-md"><ImageIcon size={14}/> {f.name} <button type="button" onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))}><X size={14}/></button></div>))}</div>
            </div>
          </div>
          <div className="flex justify-end gap-4 pt-8 border-t">
            <button type="button" onClick={onClose} className="px-10 py-4 font-black text-slate-400 hover:bg-slate-100 rounded-2xl uppercase tracking-widest text-xs">Discard</button>
            <button type="submit" disabled={isUploading} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-2xl shadow-indigo-200 flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest text-xs">
              {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Send size={18}/>} Launch Order
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
