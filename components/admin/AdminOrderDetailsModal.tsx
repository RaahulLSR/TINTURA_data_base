
import React, { useState, useEffect } from 'react';
import { X, Pencil, Trash2, Printer, Save, Loader2, Clock, Paperclip, Box, Image as ImageIcon, FileText, Download, ArrowLeftRight, Upload, BookOpen } from 'lucide-react';
import { Order, Unit, OrderLog, SizeBreakdown, Attachment, OrderStatus, formatOrderNumber, Style, StyleTemplate } from '../../types';
import { fetchOrderLogs, updateOrderDetails, deleteOrder, triggerOrderEmail, uploadOrderAttachment, fetchStyleById, fetchStyleTemplate } from '../../services/db';

interface AdminOrderDetailsModalProps {
  order: Order;
  units: Unit[];
  onClose: () => void;
  onRefresh: () => void;
}

export const AdminOrderDetailsModal: React.FC<AdminOrderDetailsModalProps> = ({ order, units, onClose, onRefresh }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Order>>({ ...order });
  const [modalLogs, setModalLogs] = useState<OrderLog[]>([]);
  const [useNumericSizes, setUseNumericSizes] = useState(order.size_format === 'numeric');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  useEffect(() => {
    fetchOrderLogs(order.id).then(setModalLogs);
  }, [order.id]);

  const getRowTotal = (row: SizeBreakdown) => (row.s || 0) + (row.m || 0) + (row.l || 0) + (row.xl || 0) + (row.xxl || 0) + (row.xxxl || 0);
  const getTotalQuantity = (bd: SizeBreakdown[]) => bd.reduce((acc, row) => acc + getRowTotal(row), 0);
  const getHeaderLabels = () => useNumericSizes ? ['65', '70', '75', '80', '85', '90'] : ['S', 'M', 'L', 'XL', 'XXL', '3XL'];

  const handleSave = async () => {
    setIsUploading(true);
    try {
      const newAttachments: Attachment[] = [];
      for (const file of selectedFiles) {
        const url = await uploadOrderAttachment(file);
        if (url) newAttachments.push({ name: file.name, url, type: file.type.startsWith('image/') ? 'image' : 'document' });
      }
      const finalAttachments = [...(editFormData.attachments || []), ...newAttachments];
      const finalQty = getTotalQuantity(editFormData.size_breakdown as SizeBreakdown[]);
      const result = await updateOrderDetails(order.id, { ...editFormData, quantity: finalQty, attachments: finalAttachments, size_format: useNumericSizes ? 'numeric' : 'standard' });
      if (result.success) {
        await triggerOrderEmail(order.id, true);
        onRefresh();
        onClose();
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handlePrint = async () => {
    let techPackHtml = '';
    
    if (order.style_id) {
        const [style, template] = await Promise.all([
            fetchStyleById(order.style_id),
            fetchStyleTemplate()
        ]);
        
        if (style && template) {
            techPackHtml = template.config.filter(c => c.name !== "General Info").map(cat => {
                const isPreProd = cat.name.toLowerCase().includes('pre production');
                const variantMetaHtml = isPreProd ? `
                    <div style="background:#f9f9f9; border:1px solid #eee; padding:15px; border-radius:4px; margin-bottom:20px; display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                       <div><span style="font-size:10px; font-weight:bold; color:#888; text-transform:uppercase;">Blueprint Colours</span><br/><strong>${style.available_colors?.join(', ') || '---'}</strong></div>
                       <div><span style="font-size:10px; font-weight:bold; color:#888; text-transform:uppercase;">Size Breakdown</span><br/><strong>${style.available_sizes?.join(', ') || '---'} (${style.size_type})</strong></div>
                    </div>
                ` : '';

                const fields = cat.fields.map(f => {
                    const data = style.tech_pack[cat.name]?.[f] || { text: 'N/A', attachments: [] };
                    const imagesHtml = data.attachments.filter(a => a.type === 'image').map(img => `
                        <div style="border:1px solid #ddd; padding:10px; text-align:center; break-inside:avoid;">
                            <img src="${img.url}" style="max-width:100%; max-height:400px; border-radius:4px;" />
                            <div style="font-size:10px; margin-top:5px; font-weight:bold;">${img.name}</div>
                        </div>
                    `).join('');
                    return `<div style="margin-bottom:20px; border-bottom:1px solid #eee; padding-bottom:10px; break-inside:avoid;"><div style="font-size:11px; font-weight:bold; color:#666; text-transform:uppercase; margin-bottom:4px;">${f}</div><div style="font-size:14px; font-weight:500;">${data.text || '---'}</div>${imagesHtml ? `<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">${imagesHtml}</div>` : ''}</div>`;
                }).join('');

                return `<div style="margin-top:40px; page-break-before:always;"><h3 style="background:#000; color:#fff; padding:10px; font-size:14px; text-transform:uppercase; letter-spacing:1px;">${cat.name} (Style DB)</h3><div style="padding:10px;">${variantMetaHtml}${fields}</div></div>`;
            }).join('');
        }
    }

    const formattedNo = formatOrderNumber(order);
    const headers = order.size_format === 'numeric' ? ['65', '70', '75', '80', '85', '90'] : ['S', 'M', 'L', 'XL', 'XXL', '3XL'];
    const keys = ['s', 'm', 'l', 'xl', 'xxl', 'xxxl'] as const;
    const breakdownRows = (order.size_breakdown || []).map(row => `<tr><td style="text-align:left; font-weight:bold;">${row.color}</td>${keys.map(k => `<td>${(row as any)[k]}</td>`).join('')}<td style="font-weight:bold;">${getRowTotal(row)}</td></tr>`).join('');

    const win = window.open('', 'OrderPrint', 'width=1000,height=800');
    if (win) {
        win.document.write(`<html><head><title>Job Sheet - ${formattedNo}</title><style>body { font-family: sans-serif; padding: 40px; color: #333; } .header { text-align: center; border-bottom: 5px solid #000; padding-bottom: 20px; margin-bottom: 30px; } .brand { font-size: 32px; font-weight: 900; } .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 30px; } .box { padding: 15px; border: 2px solid #333; } .label { font-size: 10px; font-weight: bold; color: #666; text-transform: uppercase; } .value { font-size: 18px; font-weight: bold; } table { width: 100%; border-collapse: collapse; margin-top: 20px; } th, td { border: 1px solid #333; padding: 12px; text-align: center; } th { background: #f0f0f0; } .section-title { font-size: 18px; font-weight: 900; border-bottom: 3px solid #333; margin-top: 40px; margin-bottom: 15px; text-transform: uppercase; }</style></head><body><div class="header"><div class="brand">TINTURA SST</div><div>Manufacturing Job Sheet</div></div><div class="grid"><div class="box"><span class="label">Order</span><div class="value">${formattedNo}</div></div><div class="box"><span class="label">Style</span><div class="value">${order.style_number}</div></div><div class="box"><span class="label">Qty</span><div class="value">${order.quantity} PCS</div></div></div><div class="section-title">Size Matrix</div><table><thead><tr><th style="text-align:left;">Color</th>${headers.map(h => `<th>${h}</th>`).join('')}<th>Total</th></tr></thead><tbody>${breakdownRows}</tbody></table><div class="section-title">Production Notes</div><div style="padding:15px; border:2px solid #333;">${order.description || 'N/A'}</div>${techPackHtml}<script>window.onload = () => { setTimeout(() => window.print(), 1000); };</script></body></html>`);
        win.document.close();
    }
  };

  const renderDetailCell = (rowIdx: number, sizeKey: keyof SizeBreakdown) => {
    const plannedVal = order.size_breakdown?.[rowIdx]?.[sizeKey] || 0;
    const actualVal = order.completion_breakdown?.[rowIdx]?.[sizeKey] || 0;
    if (order.status !== OrderStatus.COMPLETED || !order.completion_breakdown) return <span className="text-slate-600">{plannedVal}</span>;
    return (
      <div className="flex flex-col items-center p-1 bg-slate-50 rounded border">
        <span className={`text-lg font-black ${actualVal !== plannedVal ? 'text-indigo-700' : ''}`}>{actualVal}</span>
        <span className="text-[9px] text-slate-400 font-bold">Plan: {plannedVal}</span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh] animate-scale-up border border-slate-200">
        <div className="p-6 border-b flex justify-between items-start bg-white">
          <div><h3 className="text-3xl font-black text-slate-800 tracking-tight">{formatOrderNumber(order)}</h3></div>
          <div className="flex items-center gap-3">
            {!isEditing && <button onClick={() => setIsEditing(true)} className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-5 py-2.5 rounded-xl text-sm font-black hover:bg-indigo-600 hover:text-white transition-all"><Pencil size={18} /> Modify Order</button>}
            <button onClick={onClose} className="text-slate-300 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full"><X size={32}/></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          
          {/* Linked Style Indicator */}
          {order.style_id && (
            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-center gap-3">
                <BookOpen size={20} className="text-indigo-600"/>
                <div>
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none">Linked Style DB Asset</p>
                  <p className="text-sm font-bold text-indigo-900 mt-1">This order is connected to the Technical Blueprint. Printing will include the master Tech Pack.</p>
                </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="p-5 bg-slate-50 rounded-2xl border">
              <span className="block text-[10px] text-slate-400 uppercase font-black mb-2">Volume</span>
              <div className="text-2xl font-black text-slate-800">{isEditing ? getTotalQuantity(editFormData.size_breakdown as SizeBreakdown[]) : order.quantity} PCS</div>
            </div>
            <div className="p-5 bg-slate-50 rounded-2xl border">
              <span className="block text-[10px] text-slate-400 uppercase font-black mb-2">Delivery</span>
              {isEditing ? <input type="date" className="w-full border rounded p-2" value={editFormData.target_delivery_date} onChange={e => setEditFormData({...editFormData, target_delivery_date: e.target.value})}/> : <div className="text-lg font-black">{order.target_delivery_date}</div>}
            </div>
            <div className="p-5 bg-slate-50 rounded-2xl border"><span className="block text-[10px] text-slate-400 uppercase font-black mb-2"><Box size={10}/> Planned Boxes</span>{isEditing ? <input type="number" className="w-full border rounded p-2" value={editFormData.box_count} onChange={e => setEditFormData({...editFormData, box_count: parseInt(e.target.value) || 0})}/> : <div className="text-lg font-black">{order.box_count}</div>}</div>
            <div className="p-5 bg-indigo-50 rounded-2xl border"><span className="block text-[10px] text-indigo-400 uppercase font-black mb-2">Unit</span>{isEditing ? <select className="w-full border rounded p-2 bg-white" value={editFormData.unit_id} onChange={e => setEditFormData({...editFormData, unit_id: parseInt(e.target.value)})}>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select> : <div className="text-lg font-black text-indigo-900">{units.find(u => u.id === order.unit_id)?.name}</div>}</div>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-4"><h4 className="font-black text-slate-700 uppercase tracking-tight text-lg">Product Breakdown Matrix</h4>{isEditing && <button type="button" onClick={() => setUseNumericSizes(!useNumericSizes)} className="text-[10px] bg-slate-100 px-4 py-2 rounded-xl border font-black uppercase"><ArrowLeftRight size={14} className="inline mr-2"/> Format Toggle</button>}</div>
            <div className="border rounded-2xl overflow-hidden shadow-lg"><table className="w-full text-center text-sm border-collapse"><thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-widest border-b"><tr><th className="p-4 text-left border-r">Color Variant</th>{getHeaderLabels().map(h => <th key={h} className="p-4 border-r">{h}</th>)}<th className="p-4 bg-slate-100">Sum</th>{isEditing && <th className="p-4 w-12"></th>}</tr></thead><tbody className="divide-y divide-slate-100">
              {(isEditing ? editFormData.size_breakdown : order.size_breakdown)?.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="p-4 text-left font-black text-slate-700 border-r">{isEditing ? <input className="w-full border rounded p-1" value={row.color} onChange={e => { const bd = [...(editFormData.size_breakdown || [])]; bd[idx].color = e.target.value; setEditFormData({...editFormData, size_breakdown: bd}); }}/> : row.color}</td>
                  {['s','m','l','xl','xxl','xxxl'].map(key => (<td key={key} className="p-4 border-r">{isEditing ? <input type="number" className="w-16 border rounded p-1 text-center" value={(row as any)[key]} onChange={e => { const bd = [...(editFormData.size_breakdown || [])]; (bd[idx] as any)[key] = parseInt(e.target.value) || 0; setEditFormData({...editFormData, size_breakdown: bd}); }}/> : renderDetailCell(idx, key as keyof SizeBreakdown)}</td>))}
                  <td className="p-4 font-black text-slate-900 bg-slate-50/50">{getRowTotal(row)}</td>
                  {isEditing && <td className="p-4"><button onClick={() => setEditFormData({...editFormData, size_breakdown: (editFormData.size_breakdown || []).filter((_, i) => i !== idx)})} className="text-red-400 hover:text-red-600"><Trash2 size={20}/></button></td>}
                </tr>))}
            </tbody></table>{isEditing && <button onClick={() => setEditFormData({...editFormData, size_breakdown: [...(editFormData.size_breakdown || []), { color: '', s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0 }]})} className="w-full py-4 bg-slate-50 text-indigo-600 text-xs font-black uppercase border-t">+ Add Variant</button>}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-6 bg-slate-50/50 rounded-2xl border shadow-inner">
              <span className="block text-[11px] text-slate-400 uppercase font-black mb-3">Instructions</span>
              {isEditing ? <textarea className="w-full border rounded-2xl p-4 h-48" value={editFormData.description} onChange={e => setEditFormData({...editFormData, description: e.target.value})}/> : <p className="text-base text-slate-600 whitespace-pre-wrap">{order.description}</p>}
            </div>
            <div className="p-6 bg-indigo-50/30 rounded-2xl border shadow-inner">
              <h4 className="font-black text-indigo-400 uppercase text-[10px] flex items-center gap-2 mb-4"><Paperclip size={14}/> Documentation</h4>
              <div className="space-y-3">
                {(isEditing ? editFormData.attachments : order.attachments)?.map((att, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-white rounded-xl border group">
                    <a href={att.url} target="_blank" rel="noreferrer" className="flex items-center gap-4 flex-1">{att.type === 'image' ? <ImageIcon size={20} /> : <FileText size={20} />}<span className="text-sm font-bold truncate">{att.name}</span></a>
                    {isEditing && <button onClick={() => setEditFormData({...editFormData, attachments: (editFormData.attachments || []).filter((_, idx) => idx !== i)})} className="text-slate-300 hover:text-red-500"><Trash2 size={20}/></button>}
                  </div>
                ))}
                {isEditing && <div className="mt-4 border-2 border-dashed rounded-2xl p-6 text-center relative hover:bg-white transition-all cursor-pointer"><input type="file" multiple className="absolute inset-0 opacity-0" onChange={e => e.target.files && setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)])}/><Upload size={32} className="mx-auto text-indigo-400"/><p className="text-xs font-black text-indigo-600 uppercase">Add Files</p></div>}
              </div>
            </div>
          </div>

          <div className="p-6 bg-indigo-50/30 rounded-3xl border shadow-inner flex flex-col">
            <h4 className="font-black text-indigo-900 uppercase text-[10px] flex items-center gap-2 mb-6"><Clock size={16}/> Lifecycle Log</h4>
            <div className="space-y-6 max-h-[400px] overflow-y-auto pr-4">
              {modalLogs.map(log => (<div key={log.id} className="flex gap-4 border-l-4 border-indigo-100 pl-6 pb-2 transition-all hover:border-indigo-400"><div className="font-black text-[10px] text-slate-400 uppercase leading-none pt-1">{new Date(log.created_at).toLocaleDateString()}<br/><span className="text-indigo-400 opacity-60">{new Date(log.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div><div className="flex-1 bg-white p-4 rounded-2xl shadow-sm border"><p className="text-slate-700 font-bold leading-snug">{log.message}</p></div></div>))}
            </div>
          </div>
        </div>
        <div className="p-6 border-t bg-slate-50 flex justify-between items-center">
          <button onClick={() => { if(confirm("Delete?")) deleteOrder(order.id).then(() => {onRefresh(); onClose();}); }} className="p-3 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"><Trash2 size={24}/></button>
          <div className="flex items-center gap-4">
            <button onClick={handlePrint} className="px-8 py-3 bg-white text-indigo-600 border-2 border-indigo-600 rounded-xl font-black uppercase text-xs flex items-center gap-2">
              <Printer size={16}/> Print Job Sheet
            </button>
            <button onClick={onClose} className="px-10 py-3 bg-slate-800 text-white rounded-xl font-black uppercase text-xs">Close</button>
            {isEditing && <button onClick={handleSave} disabled={isUploading} className="bg-indigo-600 text-white px-10 py-3 rounded-xl font-black uppercase text-xs">{isUploading ? 'Saving...' : 'Save Job'}</button>}
          </div>
        </div>
      </div>
    </div>
  );
};
