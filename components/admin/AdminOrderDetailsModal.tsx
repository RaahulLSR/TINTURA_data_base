
import React, { useState, useEffect } from 'react';
import { X, Pencil, Trash2, Printer, Save, Loader2, Clock, Paperclip, Box, Image as ImageIcon, FileText, Download, ArrowLeftRight, Upload, BookOpen, Calculator, ClipboardList } from 'lucide-react';
import { Order, Unit, OrderLog, SizeBreakdown, Attachment, OrderStatus, formatOrderNumber, Style, StyleTemplate, ConsumptionType } from '../../types';
import { fetchOrderLogs, updateOrderDetails, deleteOrder, triggerOrderEmail, uploadOrderAttachment, fetchStyleByNumber, fetchStyleTemplate } from '../../services/db';

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
  const [linkedStyle, setLinkedStyle] = useState<Style | null>(null);

  useEffect(() => {
    fetchOrderLogs(order.id).then(setModalLogs);
    const styleRefPart = order.style_number.split(' - ')[0].trim();
    if (styleRefPart) {
        fetchStyleByNumber(styleRefPart).then(setLinkedStyle);
    }
  }, [order.id, order.style_number]);

  const getRowTotal = (row: SizeBreakdown) => (row.s || 0) + (row.m || 0) + (row.l || 0) + (row.xl || 0) + (row.xxl || 0) + (row.xxxl || 0);
  const getTotalQuantity = (bd: SizeBreakdown[]) => bd.reduce((acc, row) => acc + getRowTotal(row), 0);
  const getHeaderLabels = () => useNumericSizes ? ['65', '70', '75', '80', '85', '90'] : ['S', 'M', 'L', 'XL', 'XXL', '3XL'];

  const calculateRequirement = (qty: number, type: ConsumptionType, val: number) => {
    if (!val) return 0;
    return type === 'items_per_pc' ? qty * val : qty / val;
  };

  const getEstimatedRequirements = () => {
    if (!linkedStyle || !order.size_breakdown) return [];
    
    const estimates: Record<string, { name: string, total: number }> = {};
    const sizeKeys = ['s', 'm', 'l', 'xl', 'xxl', 'xxxl'] as const;
    const sizeLabels = getHeaderLabels();

    for (const catName in linkedStyle.tech_pack) {
      for (const fieldName in linkedStyle.tech_pack[catName]) {
        const item = linkedStyle.tech_pack[catName][fieldName];
        let fieldTotal = 0;

        if (item.variants) {
          for (const variant of item.variants) {
            const matchingRows = order.size_breakdown.filter(r => variant.colors.includes(r.color));
            
            if (variant.sizeVariants) {
              for (const sv of variant.sizeVariants) {
                // Find which keys correspond to sv.sizes
                const targetKeys = sizeKeys.filter((_, i) => sv.sizes.includes(sizeLabels[i]));
                const qty = matchingRows.reduce((sum, row) => {
                    return sum + targetKeys.reduce((s, k) => s + (row[k] || 0), 0);
                }, 0);
                const ratioType = sv.consumption_type || variant.consumption_type || item.consumption_type || 'items_per_pc';
                const ratioVal = sv.consumption_val !== undefined ? sv.consumption_val : (variant.consumption_val !== undefined ? variant.consumption_val : (item.consumption_val || 0));
                fieldTotal += calculateRequirement(qty, ratioType, ratioVal);
              }
            } else if (variant.consumption_type) {
              const qty = matchingRows.reduce((sum, row) => sum + getRowTotal(row), 0);
              fieldTotal += calculateRequirement(qty, variant.consumption_type, variant.consumption_val || 0);
            }
          }
        } else if (item.consumption_type) {
          fieldTotal += calculateRequirement(order.quantity, item.consumption_type, item.consumption_val || 0);
        }

        if (fieldTotal > 0) {
          estimates[fieldName] = { name: fieldName, total: Math.ceil(fieldTotal * 100) / 100 };
        }
      }
    }
    return Object.values(estimates);
  };

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
    let reqSheetHtml = '';
    
    const styleRefPart = order.style_number.split(' - ')[0].trim();
    if (styleRefPart) {
        const [style, template] = await Promise.all([ fetchStyleByNumber(styleRefPart), fetchStyleTemplate() ]);
        if (style && template) {
            // Material Estimation Logic for Print
            const estReqs = getEstimatedRequirements();
            if (estReqs.length > 0) {
              reqSheetHtml = `
                <div style="margin-top:40px; page-break-before:always;">
                  <h3 style="background:#4f46e5; color:#fff; padding:15px 25px; font-size:18px; text-transform:uppercase; letter-spacing:3px; border-radius:12px; font-weight:900;">Estimated Material Requirements</h3>
                  <table style="width:100%; border-collapse:collapse; margin-top:20px;">
                    <thead>
                      <tr style="background:#f1f5f9;">
                        <th style="border:1px solid #cbd5e1; padding:12px; text-align:left;">Material Item / Operation</th>
                        <th style="border:1px solid #cbd5e1; padding:12px; text-align:right;">Approximate Quantity Required</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${estReqs.map(r => `
                        <tr>
                          <td style="border:1px solid #cbd5e1; padding:12px; font-weight:bold; color:#1e293b;">${r.name}</td>
                          <td style="border:1px solid #cbd5e1; padding:12px; text-align:right; font-weight:900; color:#4f46e5; font-size:18px;">${r.total}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                  <p style="font-size:10px; color:#64748b; margin-top:10px; font-style:italic;">* Quantities calculated automatically from Style Technical Database consumption ratios.</p>
                </div>
              `;
            }

            techPackHtml = template.config.filter(c => c.name !== "General Info").map(cat => {
                const isPreProd = cat.name.toLowerCase().includes('pre production');
                const variantMetaHtml = isPreProd ? `<div style="background:#f1f5f9; padding:20px; border-radius:8px; margin-bottom:20px; display:grid; grid-template-columns:1fr 1fr; gap:20px; border:1px solid #cbd5e1;"><div><span style="font-size:10px; font-weight:900; color:#64748b; text-transform:uppercase;">Blueprint Colours</span><br/><strong style="font-size:16px;">${style.available_colors?.join(', ') || '---'}</strong></div><div><span style="font-size:10px; font-weight:900; color:#64748b; text-transform:uppercase;">Size Range</span><br/><strong style="font-size:16px;">${style.available_sizes?.join(', ') || '---'}</strong></div></div>` : '';

                const fields = cat.fields.map(f => {
                    const item = style.tech_pack[cat.name]?.[f] || { text: 'N/A', attachments: [] };
                    let contentHtml = '';
                    if (item.variants) {
                      contentHtml = item.variants.map(v => {
                        let sizeHtml = '';
                        if (v.sizeVariants) {
                          sizeHtml = `<div style="margin-top:15px; display:grid; grid-template-columns:1fr; gap:12px;">${v.sizeVariants.map(sv => `
                            <div style="background:#fff; border:1px solid #e2e8f0; border-left:10px solid #2563eb; padding:20px; border-radius:12px;">
                              <div style="margin-bottom:12px; display:flex; flex-wrap:wrap; gap:6px;">
                                ${sv.sizes.map(sz => `<span style="background:#2563eb; color:#fff; display:inline-block; padding:4px 10px; border-radius:6px; font-weight:900; font-size:18px;">SIZE: ${sz}</span>`).join('')}
                              </div>
                              <div style="font-size:20px; font-weight:900; color:#1e293b; line-height:1.3;">${sv.text || '---'}</div>
                              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:15px;">
                                ${sv.attachments.filter(a => a.type === 'image').map(img => `<img src="${img.url}" style="width:100%; border-radius:10px; border:1px solid #eee;" />`).join('')}
                              </div>
                            </div>
                          `).join('')}</div>`;
                        }
                        return `<div style="border:2px solid #e2e8f0; padding:20px; border-radius:15px; margin-top:15px; background:#f8fafc; break-inside:avoid;"><div style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;"><div>${v.colors.map(c => `<span style="background:#1e293b; color:#fff; font-size:10px; font-weight:900; padding:4px 10px; border-radius:5px; text-transform:uppercase; margin-right:5px;">${c}</span>`).join('')}</div> ${!v.sizeVariants && v.consumption_type ? `<div style="font-weight:900; color:#1e293b; border:1px solid #1e293b; padding:4px 10px; border-radius:6px;">${v.consumption_val} ${v.consumption_type === 'items_per_pc' ? 'Items / PC' : 'PCS / Item'}</div>` : ''}</div><div style="font-size:22px; color:#1e293b; font-weight:900; line-height:1.3;">${v.text || '---'}</div><div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:15px;">${v.attachments.filter(a => a.type === 'image').map(img => `<img src="${img.url}" style="width:100%; border-radius:10px; border:1px solid #eee;" />`).join('')}</div>${sizeHtml}</div>`;
                      }).join('');
                    } else {
                      contentHtml = `<div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:25px; border-radius:15px; border:2px solid #e2e8f0;"><div style="font-size:24px; font-weight:900; color:#1e293b; line-height:1.3;">${item.text || '---'}</div> ${item.consumption_type ? `<div style="background:#1e293b; color:#fff; padding:10px 20px; border-radius:8px; font-weight:900; font-size:20px; text-align:center;">${item.consumption_val}<br/><small style="font-size:10px; opacity:0.8; letter-spacing:1px;">${item.consumption_type === 'items_per_pc' ? 'ITEMS / PC' : 'PCS / ITEM'}</small></div>` : ''}</div>`;
                    }
                    return `<div style="margin-bottom:40px; border-bottom:1px solid #e2e8f0; padding-bottom:30px; break-inside:avoid;"><div style="font-size:12px; font-weight:900; color:#64748b; text-transform:uppercase; margin-bottom:12px; letter-spacing:1px; display:flex; align-items:center; gap:8px;"><div style="width:8px; height:8px; background:#4f46e5; border-radius:50%;"></div>${f}</div>${contentHtml}</div>`;
                }).join('');
                return `<div style="margin-top:40px; page-break-before:always;"><h3 style="background:#1e293b; color:#fff; padding:15px 25px; font-size:18px; text-transform:uppercase; letter-spacing:3px; border-radius:12px;">${cat.name}</h3><div style="padding:15px 5px;">${variantMetaHtml}${fields}</div></div>`;
            }).join('');
        }
    }

    const formattedNo = formatOrderNumber(order);
    const headers = order.size_format === 'numeric' ? ['65', '70', '75', '80', '85', '90'] : ['S', 'M', 'L', 'XL', 'XXL', '3XL'];
    const keys = ['s', 'm', 'l', 'xl', 'xxl', 'xxxl'] as const;
    const breakdownRows = (order.size_breakdown || []).map(row => `<tr><td style="text-align:left; font-weight:bold;">${row.color}</td>${keys.map(k => `<td>${(row as any)[k]}</td>`).join('')}<td style="font-weight:bold;">${getRowTotal(row)}</td></tr>`).join('');

    const win = window.open('', 'OrderPrint', 'width=1100,height=850');
    if (win) {
        win.document.write(`<html><head><title>Job Sheet - ${formattedNo}</title><style>body { font-family: sans-serif; padding: 50px; color: #1e293b; } .header { text-align: center; border-bottom: 8px solid #000; padding-bottom: 25px; margin-bottom: 35px; } .brand { font-size: 42px; font-weight: 900; } .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 25px; margin-bottom: 40px; } .box { padding: 20px; border: 3px solid #1e293b; border-radius:12px; } .label { font-size: 11px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing:1px; } .value { font-size: 22px; font-weight: 900; } table { width: 100%; border-collapse: collapse; margin-top: 25px; } th, td { border: 2px solid #1e293b; padding: 15px; text-align: center; } th { background: #f1f5f9; font-weight:900; } .section-title { font-size: 20px; font-weight: 900; border-bottom: 4px solid #1e293b; margin-top: 50px; margin-bottom: 20px; text-transform: uppercase; letter-spacing:2px; }</style></head><body><div class="header"><div class="brand">TINTURA SST</div><div style="font-size:18px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:4px; margin-top:5px;">Manufacturing Execution Document</div></div><div class="grid"><div class="box"><span class="label">Job ID</span><div class="value">${formattedNo}</div></div><div class="box"><span class="label">Technical Reference</span><div class="value">${order.style_number}</div></div><div class="box"><span class="label">Job Volume</span><div class="value">${order.quantity} PCS</div></div></div><div class="section-title">Job Matrix Breakdown</div><table><thead><tr><th style="text-align:left;">Color Group</th>${headers.map(h => `<th>${h}</th>`).join('')}<th>Sum</th></tr></thead><tbody>${breakdownRows}</tbody></table><div class="section-title">Master Production Instructions</div><div style="padding:25px; border:3px solid #1e293b; font-size:24px; font-weight:900; border-radius:16px; background:#f8fafc; line-height:1.3;">${order.description || 'N/A'}</div>${reqSheetHtml}${techPackHtml}<script>window.onload = () => { setTimeout(() => window.print(), 1000); };</script></body></html>`);
        win.document.close();
    }
  };

  const renderDetailCell = (rowIdx: number, sizeKey: keyof SizeBreakdown) => {
    const plannedVal = order.size_breakdown?.[rowIdx]?.[sizeKey] || 0;
    const actualVal = order.completion_breakdown?.[rowIdx]?.[sizeKey] || 0;
    if (order.status !== OrderStatus.COMPLETED || !order.completion_breakdown) return <span className="text-slate-600 font-bold">{plannedVal}</span>;
    return (<div className="flex flex-col items-center p-1 bg-slate-50 rounded border border-indigo-100"><span className={`text-lg font-black ${actualVal !== plannedVal ? 'text-indigo-700' : 'text-slate-900'}`}>{actualVal}</span><span className="text-[9px] text-slate-400 font-bold">Plan: {plannedVal}</span></div>);
  };

  const estimatedReqs = getEstimatedRequirements();

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[95vh] animate-scale-up border border-slate-200">
        <div className="p-6 border-b flex justify-between items-start bg-white"><div><h3 className="text-3xl font-black text-slate-800 tracking-tight">{formatOrderNumber(order)}</h3></div><div className="flex items-center gap-3">{!isEditing && <button onClick={() => setIsEditing(true)} className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-5 py-2.5 rounded-xl text-sm font-black hover:bg-indigo-600 hover:text-white transition-all"><Pencil size={18} /> Modify Order</button>}<button onClick={onClose} className="text-slate-300 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full"><X size={32}/></button></div></div>
        <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50/20">
          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-center gap-3"><BookOpen size={20} className="text-indigo-600"/><div><p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none">Style DB Synchronized</p><p className="text-sm font-bold text-indigo-900 mt-1">This order is linked to the technical database. Requirements are calculated automatically.</p></div></div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6"><div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm"><span className="block text-[10px] text-slate-400 uppercase font-black mb-2">Volume</span><div className="text-2xl font-black text-slate-800">{isEditing ? getTotalQuantity(editFormData.size_breakdown as SizeBreakdown[]) : order.quantity} PCS</div></div><div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm"><span className="block text-[10px] text-slate-400 uppercase font-black mb-2">Delivery</span>{isEditing ? <input type="date" className="w-full border rounded p-2" value={editFormData.target_delivery_date} onChange={e => setEditFormData({...editFormData, target_delivery_date: e.target.value})}/> : <div className="text-lg font-black">{order.target_delivery_date}</div>}</div><div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm"><span className="block text-[10px] text-slate-400 uppercase font-black mb-2"><Box size={10}/> Planned Boxes</span>{isEditing ? <input type="number" className="w-full border rounded p-2" value={editFormData.box_count} onChange={e => setEditFormData({...editFormData, box_count: parseInt(e.target.value) || 0})}/> : <div className="text-lg font-black">{order.box_count}</div>}</div><div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100 shadow-sm"><span className="block text-[10px] text-indigo-400 uppercase font-black mb-2">Unit</span>{isEditing ? <select className="w-full border rounded p-2 bg-white font-bold" value={editFormData.unit_id} onChange={e => setEditFormData({...editFormData, unit_id: parseInt(e.target.value)})}>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select> : <div className="text-lg font-black text-indigo-900">{units.find(u => u.id === order.unit_id)?.name}</div>}</div></div>

          {/* REQUIREMENTS FORECAST SECTION */}
          {estimatedReqs.length > 0 && (
            <div className="bg-white rounded-3xl border border-indigo-100 shadow-sm overflow-hidden animate-fade-in">
              <div className="p-5 bg-indigo-600 text-white flex items-center justify-between">
                <h4 className="font-black uppercase tracking-widest text-sm flex items-center gap-2"><Calculator size={18}/> Estimated Material Requirements</h4>
                <span className="text-[10px] font-bold opacity-80 uppercase tracking-tighter">Auto-calculated from DB</span>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {estimatedReqs.map((req, i) => (
                    <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between group hover:bg-indigo-50 hover:border-indigo-200 transition-colors">
                      <span className="text-xs font-black text-slate-500 uppercase truncate pr-4 group-hover:text-indigo-600">{req.name}</span>
                      <div className="text-right">
                        <span className="text-xl font-black text-slate-800 group-hover:text-indigo-700">{req.total}</span>
                        <span className="text-[8px] block font-black text-slate-400 uppercase tracking-widest">Calculated</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          <div><div className="flex justify-between items-center mb-4"><h4 className="font-black text-slate-700 uppercase tracking-tight text-lg">Product breakdown matrix</h4>{isEditing && <button type="button" onClick={() => setUseNumericSizes(!useNumericSizes)} className="text-[10px] bg-slate-100 px-4 py-2 rounded-xl border border-slate-200 font-black uppercase"><ArrowLeftRight size={14} className="inline mr-2"/> Switch Size Format</button>}</div><div className="border border-slate-200 rounded-3xl overflow-hidden shadow-sm bg-white"><table className="w-full text-center text-sm border-collapse"><thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-widest border-b"><tr><th className="p-4 text-left border-r">Color Variant</th>{getHeaderLabels().map(h => <th key={h} className="p-4 border-r">{h}</th>)}<th className="p-4 bg-slate-100">Sum</th>{isEditing && <th className="p-4 w-12"></th>}</tr></thead><tbody className="divide-y divide-slate-100">{(isEditing ? editFormData.size_breakdown : order.size_breakdown)?.map((row, idx) => (<tr key={idx} className="hover:bg-slate-50/50"><td className="p-4 text-left font-black text-slate-700 border-r">{isEditing ? <input className="w-full border rounded p-1 font-bold" value={row.color} onChange={e => { const bd = [...(editFormData.size_breakdown || [])]; bd[idx].color = e.target.value; setEditFormData({...editFormData, size_breakdown: bd}); }}/> : row.color}</td>{['s','m','l','xl','xxl','xxxl'].map(key => (<td key={key} className="p-4 border-r">{isEditing ? <input type="number" className="w-16 border rounded p-1 text-center font-black" value={(row as any)[key]} onChange={e => { const bd = [...(editFormData.size_breakdown || [])]; (bd[idx] as any)[key] = parseInt(e.target.value) || 0; setEditFormData({...editFormData, size_breakdown: bd}); }}/> : renderDetailCell(idx, key as keyof SizeBreakdown)}</td>))}<td className="p-4 font-black text-slate-900 bg-slate-50/50 tabular-nums">{getRowTotal(row)}</td>{isEditing && <td className="p-4"><button onClick={() => setEditFormData({...editFormData, size_breakdown: (editFormData.size_breakdown || []).filter((_, i) => i !== idx)})} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={20}/></button></td>}</tr>))}</tbody></table>{isEditing && <button onClick={() => setEditFormData({...editFormData, size_breakdown: [...(editFormData.size_breakdown || []), { color: '', s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0 }]})} className="w-full py-4 bg-slate-50 text-indigo-600 text-xs font-black uppercase border-t hover:bg-indigo-50 transition-colors">+ Add Color Variant</button>}</div></div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8"><div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm"><span className="block text-[11px] text-slate-400 uppercase font-black mb-3">Master production notes</span>{isEditing ? <textarea className="w-full border border-slate-200 rounded-2xl p-4 h-48 font-medium" value={editFormData.description} onChange={e => setEditFormData({...editFormData, description: e.target.value})}/> : <p className="text-xl text-slate-800 font-black whitespace-pre-wrap leading-relaxed">{order.description || 'N/A'}</p>}</div><div className="p-6 bg-indigo-50/30 rounded-3xl border border-indigo-100 shadow-inner"><h4 className="font-black text-indigo-400 uppercase text-[10px] flex items-center gap-2 mb-4"><Paperclip size={14}/> Technical documents</h4><div className="space-y-3">{(isEditing ? editFormData.attachments : order.attachments)?.map((att, i) => (<div key={i} className="flex items-center justify-between p-4 bg-white rounded-xl border border-indigo-50 group hover:shadow-md transition-all"><a href={att.url} target="_blank" rel="noreferrer" className="flex items-center gap-4 flex-1">{att.type === 'image' ? <ImageIcon size={20} className="text-indigo-400" /> : <FileText size={20} className="text-indigo-400" />}<span className="text-sm font-black text-slate-700 truncate">{att.name}</span></a>{isEditing && <button onClick={() => setEditFormData({...editFormData, attachments: (editFormData.attachments || []).filter((_, idx) => idx !== i)})} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={20}/></button>}</div>))}{isEditing && <div className="mt-4 border-2 border-dashed border-indigo-100 rounded-2xl p-6 text-center relative hover:bg-white transition-all cursor-pointer"><input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => e.target.files && setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)])}/><Upload size={32} className="mx-auto text-indigo-400"/><p className="text-[10px] font-black text-indigo-600 uppercase mt-2 tracking-widest">Add technical files</p></div>}</div></div></div>
          
          <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col"><h4 className="font-black text-indigo-900 uppercase text-[10px] flex items-center gap-2 mb-6"><Clock size={16}/> Lifecycle status log</h4><div className="space-y-6 max-h-[400px] overflow-y-auto pr-4">{modalLogs.map(log => (<div key={log.id} className="flex gap-4 border-l-4 border-indigo-100 pl-6 pb-2 transition-all hover:border-indigo-400"><div className="font-black text-[10px] text-slate-400 uppercase leading-none pt-1">{new Date(log.created_at).toLocaleDateString()}<br/><span className="text-indigo-400 opacity-60 font-bold">{new Date(log.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div><div className="flex-1 bg-slate-50 p-4 rounded-2xl border border-slate-200"><p className="text-slate-700 font-bold leading-snug">{log.message}</p></div></div>))}</div></div>
        </div>
        <div className="p-6 border-t bg-slate-50 flex justify-between items-center"><button onClick={() => { if(confirm("Permanently delete this order?")) deleteOrder(order.id).then(() => {onRefresh(); onClose();}); }} className="p-3 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"><Trash2 size={24}/></button><div className="flex items-center gap-4"><button onClick={handlePrint} className="px-8 py-3 bg-white text-indigo-600 border-2 border-indigo-600 rounded-xl font-black uppercase text-xs flex items-center gap-2 shadow-sm hover:bg-indigo-50 transition-all"><Printer size={16}/> Print Job Sheet</button><button onClick={onClose} className="px-10 py-3 bg-slate-800 text-white rounded-xl font-black uppercase text-xs hover:bg-slate-700 transition-all">Close</button>{isEditing && <button onClick={handleSave} disabled={isUploading} className="bg-indigo-600 text-white px-10 py-3 rounded-xl font-black uppercase text-xs shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all">{isUploading ? <Loader2 className="animate-spin inline mr-2" size={16}/> : null}{isUploading ? 'Saving...' : 'Save Job'}</button>}</div></div>
      </div>
    </div>
  );
};
