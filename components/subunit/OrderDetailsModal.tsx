
import React, { useState, useEffect } from 'react';
import { Order, OrderStatus, SizeBreakdown, Style, ConsumptionType, Attachment } from '../../types';
import { X, ImageIcon, FileText, Download, Paperclip, Printer, Box, Calculator } from 'lucide-react';
import { fetchStyleByNumber } from '../../services/db';

interface RequirementDetail {
  label: string;
  count: number;
  calc: number;
  text: string;
  attachments: Attachment[];
}

interface DetailedRequirement {
  name: string;
  total: number;
  breakdown: RequirementDetail[];
}

interface OrderDetailsModalProps {
  order: Order;
  useNumericSizes: boolean;
  onToggleSizeFormat: () => void;
  onClose: () => void;
  onPrint: () => void;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  order,
  useNumericSizes,
  onClose,
  onPrint
}) => {
  const [linkedStyle, setLinkedStyle] = useState<Style | null>(null);

  useEffect(() => {
    const styleRefPart = order.style_number.split(' - ')[0].trim();
    if (styleRefPart) {
      fetchStyleByNumber(styleRefPart).then(setLinkedStyle);
    }
  }, [order.style_number]);

  const getHeaderLabels = () => useNumericSizes ? ['65', '70', '75', '80', '85', '90'] : ['S', 'M', 'L', 'XL', 'XXL', '3XL'];
  const getRowTotal = (row: SizeBreakdown) => (row.s || 0) + (row.m || 0) + (row.l || 0) + (row.xl || 0) + (row.xxl || 0) + (row.xxxl || 0);

  const calculateRequirementValue = (qty: number, type: ConsumptionType, val: number) => {
    if (!val) return 0;
    return type === 'items_per_pc' ? qty * val : qty / val;
  };

  const getDetailedRequirements = (): DetailedRequirement[] => {
    if (!linkedStyle || !order.size_breakdown) return [];
    
    const detailedReqs: DetailedRequirement[] = [];
    const sizeKeys = ['s', 'm', 'l', 'xl', 'xxl', 'xxxl'] as const;
    const sizeLabels = getHeaderLabels();

    for (const catName in linkedStyle.tech_pack) {
      for (const fieldName in linkedStyle.tech_pack[catName]) {
        const item = linkedStyle.tech_pack[catName][fieldName];
        const req: DetailedRequirement = { name: fieldName, total: 0, breakdown: [] };

        if (item.variants) {
          for (const variant of item.variants) {
            const matchingRows = order.size_breakdown.filter(r => variant.colors.includes(r.color));
            if (matchingRows.length === 0) continue;

            if (variant.sizeVariants) {
              for (const sv of variant.sizeVariants) {
                const targetKeys = sizeKeys.filter((_, i) => sv.sizes.includes(sizeLabels[i]));
                const qty = matchingRows.reduce((sum, row) => sum + targetKeys.reduce((s, k) => s + (row[k] || 0), 0), 0);
                
                if (qty > 0) {
                  const rType = sv.consumption_type || variant.consumption_type || item.consumption_type || 'items_per_pc';
                  const rVal = sv.consumption_val !== undefined ? sv.consumption_val : (variant.consumption_val !== undefined ? variant.consumption_val : (item.consumption_val || 0));
                  const calc = calculateRequirementValue(qty, rType, rVal);
                  
                  req.breakdown.push({
                    label: `${variant.colors.join('/')} - ${sv.sizes.join('/')}`,
                    count: qty,
                    calc: Math.ceil(calc * 100) / 100,
                    text: sv.text || variant.text || item.text,
                    attachments: sv.attachments.length > 0 ? sv.attachments : (variant.attachments.length > 0 ? variant.attachments : item.attachments)
                  });
                  req.total += calc;
                }
              }
            } else if (variant.consumption_type) {
              const qty = matchingRows.reduce((sum, row) => sum + getRowTotal(row), 0);
              const calc = calculateRequirementValue(qty, variant.consumption_type, variant.consumption_val || 0);
              req.breakdown.push({
                label: `Color: ${variant.colors.join('/')}`,
                count: qty,
                calc: Math.ceil(calc * 100) / 100,
                text: variant.text || item.text,
                attachments: variant.attachments.length > 0 ? variant.attachments : item.attachments
              });
              req.total += calc;
            }
          }
        } else if (item.consumption_type) {
          const calc = calculateRequirementValue(order.quantity, item.consumption_type, item.consumption_val || 0);
          req.breakdown.push({
            label: "Global Requirement",
            count: order.quantity,
            calc: Math.ceil(calc * 100) / 100,
            text: item.text,
            attachments: item.attachments
          });
          req.total = calc;
        }

        if (req.total > 0) {
          req.total = Math.ceil(req.total * 100) / 100;
          detailedReqs.push(req);
        }
      }
    }
    return detailedReqs;
  };

  const renderDetailCell = (rowIdx: number, sizeKey: keyof SizeBreakdown) => {
    const plannedRow = order.size_breakdown?.[rowIdx];
    const actualRow = order.completion_breakdown?.[rowIdx];
    const plannedVal = plannedRow ? (plannedRow[sizeKey] as number) : 0;

    if (order.status !== OrderStatus.COMPLETED || !actualRow) {
      return <span className="text-slate-600 font-medium">{plannedVal}</span>;
    }

    const actualVal = actualRow[sizeKey] as number;
    const isMismatch = actualVal !== plannedVal;

    return (
      <div className="flex flex-col items-center justify-center p-1 bg-slate-50 rounded border border-slate-100">
        <span className={`text-lg font-black ${isMismatch ? 'text-indigo-700' : 'text-slate-900'}`}>
          {actualVal}
        </span>
        <span className="text-[10px] font-bold text-slate-400 border-t border-slate-200 w-full text-center mt-0.5 pt-0.5">
          Plan: {plannedVal}
        </span>
      </div>
    );
  };

  const detailedReqs = getDetailedRequirements();

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden max-h-[95vh] flex flex-col animate-scale-up border border-slate-200">
        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">{order.order_no}</h3>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Production Execution Details</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={28} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 shadow-sm">
              <span className="block text-slate-400 text-[10px] uppercase font-black tracking-widest mb-1">Style Number</span>
              <span className="text-lg font-black text-slate-800">{order.style_number}</span>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 shadow-sm">
              <span className="block text-slate-400 text-[10px] uppercase font-black tracking-widest mb-1">Delivery Date</span>
              <span className="text-lg font-black text-slate-800">{order.target_delivery_date}</span>
            </div>
            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 shadow-sm">
              <span className="block text-indigo-400 text-[10px] uppercase font-black tracking-widest mb-1 flex items-center gap-1"><Box size={12}/> Planned Boxes</span>
              <span className="text-xl font-black text-indigo-800">{order.box_count || '---'}</span>
            </div>
            {order.status === OrderStatus.COMPLETED && (
               <div className="p-4 bg-green-50 rounded-xl border border-green-100 shadow-sm animate-fade-in">
                <span className="block text-green-500 text-[10px] uppercase font-black tracking-widest mb-1 flex items-center gap-1"><Box size={12}/> Actual Packed</span>
                <span className="text-xl font-black text-green-800">{order.actual_box_count}</span>
              </div>
            )}
          </div>

          {/* DETAILED REQUIREMENTS SECTION */}
          {detailedReqs.length > 0 && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 bg-indigo-600 text-white rounded-t-2xl flex items-center justify-between">
                <h4 className="font-black uppercase tracking-[0.1em] text-xs flex items-center gap-2"><Calculator size={16}/> Segmented Material Requirements</h4>
                <span className="text-[10px] font-bold opacity-70">SYNCED FROM MASTER TECH-PACK</span>
              </div>
              <div className="space-y-4">
                {detailedReqs.map((req, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-indigo-100 overflow-hidden shadow-sm">
                    <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center">
                       <span className="font-black text-indigo-900 text-sm">{req.name}</span>
                       <span className="font-black text-indigo-700">Total: {req.total}</span>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {req.breakdown.map((b, idx) => (
                        <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                           <div className="flex justify-between items-center">
                              <span className="text-[9px] font-black text-slate-500 uppercase">{b.label}</span>
                              <span className="text-sm font-black text-indigo-600">{b.calc} Req.</span>
                           </div>
                           <p className="text-xs text-slate-600 font-medium italic">"{b.text || 'No segments notes.'}"</p>
                           {b.attachments.length > 0 && (
                             <div className="flex flex-wrap gap-2 mt-2">
                                {b.attachments.map((att, attIdx) => (
                                  <a key={attIdx} href={att.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-2 py-1 bg-white border rounded text-[9px] font-bold text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all">
                                    {att.type === 'image' ? <ImageIcon size={10}/> : <FileText size={10}/>} {att.name}
                                  </a>
                                ))}
                             </div>
                           )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-black text-slate-700 uppercase tracking-tight text-lg">
                Production Matrix
                {order.status === OrderStatus.COMPLETED && <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full ml-3 border border-indigo-100 uppercase tracking-widest">Actual / Planned</span>}
              </h4>
            </div>
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-md">
              <table className="w-full text-center text-sm border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-widest border-b">
                  <tr>
                    <th className="p-4 text-left border-r">Color Variant</th>
                    {getHeaderLabels().map(h => <th key={h} className="p-4 border-r">{h}</th>)}
                    <th className="p-4 font-black bg-slate-100">Row Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.size_breakdown?.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 text-left font-black text-slate-700 border-r">{row.color}</td>
                      <td className="p-4 border-r">{renderDetailCell(idx, 's')}</td>
                      <td className="p-4 border-r">{renderDetailCell(idx, 'm')}</td>
                      <td className="p-4 border-r">{renderDetailCell(idx, 'l')}</td>
                      <td className="p-4 border-r">{renderDetailCell(idx, 'xl')}</td>
                      <td className="p-4 border-r">{renderDetailCell(idx, 'xxl')}</td>
                      <td className="p-4 border-r">{renderDetailCell(idx, 'xxxl')}</td>
                      <td className="p-4 font-black bg-slate-50/50 text-slate-800 tabular-nums">{getRowTotal(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-6 bg-slate-50/50 rounded-2xl border border-slate-200 shadow-inner">
              <h4 className="font-black text-slate-400 mb-4 uppercase tracking-widest text-[10px]">Production Instructions</h4>
              <p className="text-base text-slate-600 font-medium whitespace-pre-wrap leading-relaxed">{order.description || "No specific instructions provided."}</p>
            </div>
            <div className="p-6 bg-indigo-50/30 rounded-2xl border border-indigo-100 shadow-inner">
              <h4 className="font-black text-indigo-400 mb-4 uppercase tracking-widest text-[10px] flex items-center gap-2">
                <Paperclip size={14}/> Technical Reference Files
              </h4>
              <div className="space-y-3">
                {order.attachments && order.attachments.length > 0 ? (
                  order.attachments.map((att, i) => (
                    <a key={i} href={att.url} target="_blank" rel="noreferrer" className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 hover:shadow-lg transition-all group">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                          {att.type === 'image' ? <ImageIcon size={20} /> : <FileText size={20} />}
                        </div>
                        <span className="text-sm font-bold text-slate-700 truncate max-w-[200px]">{att.name}</span>
                      </div>
                      <Download size={18} className="text-slate-300 group-hover:text-indigo-600 transition-colors" />
                    </a>
                  ))
                ) : (
                  <div className="text-center py-10 text-slate-300">
                    <Paperclip size={32} className="mx-auto opacity-20 mb-2" />
                    <p className="text-[10px] uppercase font-black tracking-widest opacity-60">No documents attached</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 border-t bg-slate-50 text-right flex justify-end gap-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.03)]">
          <button onClick={onPrint} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black hover:bg-indigo-700 shadow-xl shadow-indigo-200 flex items-center gap-2 transition-all active:scale-95 uppercase tracking-widest text-xs">
            <Printer size={18} /> Print Full Job Sheet
          </button>
          <button onClick={onClose} className="bg-slate-800 text-white px-10 py-3 rounded-xl font-black hover:bg-slate-700 transition-all active:scale-95 uppercase tracking-widest text-xs">Close</button>
        </div>
      </div>
    </div>
  );
};
