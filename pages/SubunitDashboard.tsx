
import React, { useEffect, useState } from 'react';
import { fetchOrders, updateOrderStatus, generateBarcodes, fetchMaterialRequests, deleteMaterialRequest, triggerMaterialEmail, fetchOrderLogs, addOrderLog, fetchStyleByNumber, fetchStyleTemplate } from '../services/db';
import { Order, OrderStatus, getNextOrderStatus, SizeBreakdown, MaterialRequest, OrderLog, MaterialStatus, formatOrderNumber } from '../types';
import { StatusBadge, BulkActionToolbar } from '../components/Widgets';
import { ArrowRight, Printer, PackagePlus, Box, AlertTriangle, Eye, CheckCircle2, History, ListTodo, Archive, Clock, Search, Mail, Loader2, Info } from 'lucide-react';

import { OrderDetailsModal } from '../components/subunit/OrderDetailsModal';
import { TimelineModal } from '../components/subunit/TimelineModal';
import { CompletionModal } from '../components/subunit/CompletionModal';
import { BarcodeModal } from '../components/subunit/BarcodeModal';
import { MaterialHistoryModal } from '../components/subunit/MaterialHistoryModal';
import { MaterialRequestModal } from '../components/subunit/MaterialRequestModal';

const CURRENT_UNIT_ID = 2; // Sewing Unit A

export const SubunitDashboard: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [emailLoading, setEmailLoading] = useState<string | null>(null);
  
  const [detailsModal, setDetailsModal] = useState<Order | null>(null);
  const [timelineModal, setTimelineModal] = useState<{orderId: string, orderNo: string} | null>(null);
  const [completionModal, setCompletionModal] = useState<Order | null>(null);
  const [barcodeModal, setBarcodeModal] = useState<{orderId: string, style: string} | null>(null);
  const [materialModal, setMaterialModal] = useState<string | null>(null);
  const [showMaterialHistory, setShowMaterialHistory] = useState(false);

  const [timelineLogs, setTimelineLogs] = useState<OrderLog[]>([]);
  const [statusUpdateText, setStatusUpdateText] = useState("");
  const [completionForm, setCompletionForm] = useState<{ breakdown: SizeBreakdown[], actualBoxCount: number } | null>(null);
  const [materialHistory, setMaterialHistory] = useState<MaterialRequest[]>([]);
  const [isEditingRequest, setIsEditingRequest] = useState<{ id: string, originalData: MaterialRequest } | null>(null);
  
  const [useNumericSizes, setUseNumericSizes] = useState(false);

  const refreshOrders = () => {
    fetchOrders().then(data => {
        const subunitOrders = data.filter(o => o.unit_id === CURRENT_UNIT_ID);
        setOrders(subunitOrders);
    });
  };

  useEffect(() => { refreshOrders(); }, []);

  const displayedOrders = orders.filter(o => {
      const formattedNo = formatOrderNumber(o);
      const matchesTab = activeTab === 'active' ? o.status !== OrderStatus.COMPLETED : o.status === OrderStatus.COMPLETED;
      const matchesSearch = formattedNo.toLowerCase().includes(searchTerm.toLowerCase()) || o.style_number.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesTab && matchesSearch;
  });

  const toggleSelect = (id: string) => {
    setSelectedOrders(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkStatusUpdate = async () => {
    setLoading(true);
    await Promise.all(selectedOrders.map(async (id) => {
      const order = orders.find(o => o.id === id);
      if (order && order.status !== OrderStatus.QC && order.status !== OrderStatus.QC_APPROVED) {
        const next = getNextOrderStatus(order.status);
        if (next) await updateOrderStatus(id, next);
      }
    }));
    setSelectedOrders([]);
    setLoading(false);
    refreshOrders();
  };

  const handleSingleStatusUpdate = async (id: string, currentStatus: OrderStatus) => {
    if (currentStatus === OrderStatus.QC_APPROVED) {
        const order = orders.find(o => o.id === id);
        if (order) {
            setUseNumericSizes(order.size_format === 'numeric');
            const initialBreakdown = order.size_breakdown 
                ? order.size_breakdown.map(r => ({ color: r.color, s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0 }))
                : [{ color: 'Standard', s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0 }];
            setCompletionForm({ breakdown: initialBreakdown, actualBoxCount: order.box_count || 0 });
            setCompletionModal(order);
        }
        return;
    }
    const next = getNextOrderStatus(currentStatus);
    if (next) {
        setLoading(true);
        await updateOrderStatus(id, next);
        setLoading(false);
        refreshOrders();
    }
  };

  const handleSendMaterialEmail = async (orderId: string) => {
    setEmailLoading(orderId);
    const result = await triggerMaterialEmail(orderId);
    setEmailLoading(null);
    alert(result.message);
  };

  const openTimeline = (orderId: string, orderNo: string) => {
      setTimelineModal({ orderId, orderNo });
      setTimelineLogs([]);
      setStatusUpdateText("");
      fetchOrderLogs(orderId).then(setTimelineLogs);
  };

  const submitManualStatusUpdate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!timelineModal || !statusUpdateText.trim()) return;
      await addOrderLog(timelineModal.orderId, 'MANUAL_UPDATE', statusUpdateText);
      const logs = await fetchOrderLogs(timelineModal.orderId);
      setTimelineLogs(logs);
      setStatusUpdateText("");
  };

  const handleCompleteOrder = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!completionModal || !completionForm) return;
      setLoading(true);
      await updateOrderStatus(completionModal.id, OrderStatus.COMPLETED, undefined, { completion_breakdown: completionForm.breakdown, actual_box_count: completionForm.actualBoxCount });
      setCompletionModal(null);
      setCompletionForm(null);
      setLoading(false);
      refreshOrders();
  };

  const handleOpenMaterialHistory = async () => {
      const allRequests = await fetchMaterialRequests();
      const unitOrderIds = orders.map(o => o.id);
      setMaterialHistory(allRequests.filter(req => unitOrderIds.includes(req.order_id)));
      setShowMaterialHistory(true);
  };

  const handleDeleteRequest = async (id: string) => {
      if (!confirm("Are you sure?")) return;
      await deleteMaterialRequest(id);
      handleOpenMaterialHistory();
  };

  const handleEditRequest = (req: MaterialRequest) => {
      setIsEditingRequest({ id: req.id, originalData: req });
      setMaterialModal(req.order_id);
      setShowMaterialHistory(false);
  };

  const handleGenerateAndPrintBarcodes = async (qty: number, size: string) => {
    if (!barcodeModal) return;
    const newBarcodes = await generateBarcodes(barcodeModal.orderId, qty, barcodeModal.style, size);
    setBarcodeModal(null);
    const win = window.open('', 'PrintBarcodes', 'width=1000,height=800');
    if (win) {
        const labelsHtml = newBarcodes.map(b => `<div class="label"><div class="header">TINTURA SST</div><div class="meta"><strong>Style:</strong> ${b.style_number} &nbsp; <strong>Size:</strong> ${b.size}</div><svg class="barcode" jsbarcode-format="CODE128" jsbarcode-value="${b.barcode_serial}" jsbarcode-textmargin="0" jsbarcode-fontoptions="bold" jsbarcode-height="40" jsbarcode-width="2" jsbarcode-displayValue="true" jsbarcode-fontSize="11"></svg></div>`).join('');
        win.document.write(`<html><head><title>Print Labels</title><script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script><style>@page { size: A4; margin: 10mm; } body { margin: 0; font-family: sans-serif; } .grid { display: grid; grid-template-columns: repeat(3, 1fr); grid-auto-rows: 35mm; column-gap: 5mm; row-gap: 2mm; } .label { border: 1px dashed #ddd; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5px; overflow: hidden; text-align: center; background: white; } .header { font-size: 10px; font-weight: bold; text-transform: uppercase; margin: 2px; } .meta { font-size: 10px; margin-bottom: 2px; color: #333; } svg { max-width: 95%; height: auto; display: block; }</style></head><body><div class="grid">${labelsHtml}</div><script>window.onload = function() { JsBarcode(".barcode").init(); setTimeout(() => { window.print(); }, 500); }</script></body></html>`); 
        win.document.close();
    }
  };

  const handlePrintOrderSheet = async (order: Order) => {
      let techPackHtml = '';
      
      // Attempt to find style by number (extracted from reference)
      const styleRefPart = order.style_number.split(' - ')[0].trim();
      if (styleRefPart) {
          const [style, template] = await Promise.all([
              fetchStyleByNumber(styleRefPart),
              fetchStyleTemplate()
          ]);
          
          if (style && template) {
              techPackHtml = template.config.filter(c => c.name !== "General Info").map(cat => {
                  const fields = cat.fields.map(f => {
                      const data = style.tech_pack[cat.name]?.[f] || { text: 'N/A', attachments: [] };
                      const imagesHtml = data.attachments.filter(a => a.type === 'image').map(img => `
                        <div style="border:1px solid #ddd; padding:10px; text-align:center; break-inside:avoid;">
                          <img src="${img.url}" style="max-width:100%; max-height:400px; border-radius:4px;" />
                          <div style="font-size:10px; margin-top:5px; font-weight:bold;">${img.name}</div>
                        </div>
                      `).join('');
                      
                      return `
                        <div style="margin-bottom:20px; border-bottom:1px solid #eee; padding-bottom:10px; break-inside:avoid;">
                          <div style="font-size:11px; font-weight:bold; color:#666; text-transform:uppercase; margin-bottom:4px;">${f}</div>
                          <div style="font-size:14px; font-weight:500;">${data.text || '---'}</div>
                          ${imagesHtml ? `<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">${imagesHtml}</div>` : ''}
                        </div>
                      `;
                  }).join('');
                  
                  return `
                    <div style="margin-top:40px; page-break-before:always;">
                      <h3 style="background:#000; color:#fff; padding:10px; font-size:14px; text-transform:uppercase; letter-spacing:1px;">${cat.name} (Style DB Reference)</h3>
                      <div style="padding:10px;">${fields}</div>
                    </div>
                  `;
              }).join('');
          }
      }

      const headers = order.size_format === 'numeric' ? ['65', '70', '75', '80', '85', '90'] : ['S', 'M', 'L', 'XL', 'XXL', '3XL'];
      const keys = ['s', 'm', 'l', 'xl', 'xxl', 'xxxl'] as const;
      const getRowTotal = (row: SizeBreakdown) => (row.s || 0) + (row.m || 0) + (row.l || 0) + (row.xl || 0) + (row.xxl || 0) + (row.xxxl || 0);
      const breakdownRows = (order.size_breakdown || []).map(row => `<tr><td style="text-align:left; font-weight:bold;">${row.color}</td>${keys.map(k => `<td>${(row as any)[k]}</td>`).join('')}<td style="font-weight:bold;">${getRowTotal(row)}</td></tr>`).join('');
      const formattedNo = formatOrderNumber(order);
      
      let attachmentHtml = '';
      if (order.attachments && order.attachments.length > 0) {
          attachmentHtml = `<div class="section-title">Technical Documents & References</div><div style="display:flex; flex-direction:column; gap:25px;">`;
          order.attachments.forEach(att => {
              if (att.type === 'image') {
                  attachmentHtml += `<div style="border:1px solid #ccc; padding:15px; width:100%; text-align:center;"><img src="${att.url}" style="max-width:100%; max-height:800px; border-radius:8px;" /><div style="font-size:12px; margin-top:10px; font-weight:bold; text-transform:uppercase; color:#666;">REF: ${att.name}</div></div>`;
              } else if (att.url.toLowerCase().endsWith('.pdf')) {
                  attachmentHtml += `<div style="border:2px solid #333; border-radius:8px; overflow:hidden; page-break-before:always;"><div style="background:#333; color:white; padding:10px; font-weight:bold; text-align:center; font-size:14px;">PDF DOCUMENT: ${att.name}</div><iframe src="${att.url}" style="width:100%; height:1000px; border:none;"></iframe></div>`;
              } else {
                  attachmentHtml += `<div style="border:1px dashed #ccc; padding:20px; background:#f9f9f9; text-align:center; border-radius:8px;"><strong>DOCUMENT:</strong> ${att.name}</div>`;
              }
          });
          attachmentHtml += `</div>`;
      }

      const win = window.open('', 'PrintOrderSheet', 'width=1000,height=800');
      if (win) {
          win.document.write(`<html><head><title>Job Sheet - ${formattedNo}</title><style>body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; font-size: 14px; color: #333; } .header { text-align: center; border-bottom: 5px solid #000; padding-bottom: 20px; margin-bottom: 30px; } .brand { font-size: 42px; font-weight: 900; text-transform: uppercase; margin: 0; } .title { font-size: 20px; font-weight: bold; text-transform: uppercase; margin: 10px 0 0 0; color: #444; } .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 30px; } .box { padding: 15px; border: 2px solid #333; border-radius: 6px; } .label { font-size: 11px; text-transform: uppercase; color: #666; font-weight: bold; } .value { font-size: 18px; font-weight: bold; } table { width: 100%; border-collapse: collapse; margin-top: 20px; } th, td { border: 1px solid #333; padding: 12px; text-align: center; } th { background: #f0f0f0; font-weight: 800; text-transform: uppercase; } .section-title { font-size: 18px; font-weight: 900; border-bottom: 3px solid #333; padding-bottom: 5px; margin-top: 40px; margin-bottom: 15px; text-transform: uppercase; }</style></head><body><div class="header"><div class="brand">TINTURA SST</div><div class="title">Manufacturing Job Sheet</div></div><div class="grid"><div class="box"><span class="label">Order Number</span><div class="value">${formattedNo}</div></div><div class="box"><span class="label">Style Reference</span><div class="value">${order.style_number}</div></div><div class="box"><span class="label">Total Quantity</span><div class="value">${order.quantity} PCS</div></div><div class="box"><span class="label">Planned Boxes</span><div class="value">${order.box_count || '---'}</div></div><div class="box"><span class="label">Delivery Deadline</span><div class="value">${order.target_delivery_date}</div></div></div><div class="section-title">Size Matrix Breakdown</div><table><thead><tr><th style="text-align:left;">Color</th>${headers.map(h => `<th>${h}</th>`).join('')}<th>Total</th></tr></thead><tbody>${breakdownRows}</tbody></table><div class="section-title">Production Requirements</div><div style="padding: 20px; border: 2px solid #333; min-height: 80px; background:#fcfcfc; border-radius:6px; font-size:16px;">${order.description || "No specific manufacturing notes provided."}</div>${attachmentHtml}${techPackHtml}<script>window.onload = () => { setTimeout(() => window.print(), 1000); };</script></body></html>`);
          win.document.close();
      }
  };
  
  // Remaining implementation stays the same (Receipt print, Bulk update, etc.)
  // Included below for completeness of the file content
  
  const handlePrintAccessoriesReceipt = (order: Order, reqs: MaterialRequest[]) => {
      const formattedNo = formatOrderNumber(order);
      const win = window.open('', 'OrderReceipt', 'width=1000,height=800');
      if (win) {
          const page1Rows = reqs.map((req, idx) => `<tr><td style="text-align:center;">${idx + 1}</td><td>${req.material_content}</td><td style="text-align:center;">${req.unit || 'Nos'}</td><td style="text-align:right; font-weight:bold;">${req.quantity_requested}</td></tr>`).join('');
          const page2Rows = reqs.map((req, idx) => {
              const balance = req.quantity_requested - req.quantity_approved;
              return `<tr><td style="text-align:center;">${idx + 1}</td><td>${req.material_content}</td><td style="text-align:right;">${req.quantity_requested}</td><td style="text-align:right; font-weight:bold; color:green;">${req.quantity_approved}</td><td style="text-align:right; font-weight:bold; color:${balance > 0 ? 'red' : 'black'};">${balance}</td><td style="text-align:center; font-size:10px; text-transform:uppercase;">${req.status.replace('_', ' ')}</td></tr>`;
          }).join('');
          const headerHTML = `<div class="header"><div class="brand">TINTURA SST</div><div class="title">ACCESSORIES REQUIREMENT RECEIPT</div><div class="meta">ORDER NO: ${formattedNo} &nbsp;|&nbsp; STYLE: ${order.style_number} &nbsp;|&nbsp; DATE: ${new Date().toLocaleDateString()}</div></div>`;
          win.document.write(`<html><head><title>Accessories Receipt - ${formattedNo}</title><style>@media print { .page-break { page-break-before: always; } body { -webkit-print-color-adjust: exact; } } body { font-family: 'Arial', sans-serif; padding: 40px; color: #333; } .header { text-align: center; border-bottom: 3px solid #000; margin-bottom: 25px; padding-bottom: 15px; } .brand { font-size: 24px; font-weight: 900; margin-bottom: 5px; letter-spacing: 1px; } .title { font-size: 20px; font-weight: bold; text-transform: uppercase; margin-bottom: 15px; } .meta { font-size: 16px; font-weight: 800; background: #eee; padding: 10px; border: 1px solid #000; text-align: center; } .page-title { font-size: 14px; font-weight: bold; text-transform: uppercase; margin-bottom: 10px; text-align:left; border-left: 5px solid #000; padding-left: 10px; } table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; } th, td { border: 1px solid #ccc; padding: 8px; } th { background: #f4f4f4; text-transform: uppercase; }</style></head><body>${headerHTML}<div class="page-title">Page 1: Request Sheet</div><table><thead><tr><th width="50">S.No</th><th>Material Description</th><th width="80">Unit</th><th width="100" style="text-align:right">Total Requested</th></tr></thead><tbody>${page1Rows}</tbody></table><div style="text-align:center; font-size:10px; margin-top:20px;">-- Verified By Production --</div><div class="page-break"></div>${headerHTML}<div class="page-title">Page 2: Approval & Balance Sheet</div><table><thead><tr><th width="50">S.No</th><th>Material Description</th><th width="80" style="text-align:right">Req</th><th width="80" style="text-align:right">Approved</th><th width="80" style="text-align:right">Balance</th><th width="100">Status</th></tr></thead><tbody>${page2Rows}</tbody></table><div style="text-align:center; font-size:10px; margin-top:20px;">-- Approved By Materials Dept --</div><script>window.onload = () => { setTimeout(() => window.print(), 500); };</script></body></html>`);
          win.document.close();
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:justify-between xl:items-center gap-4">
        <div>
            <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
              <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200">
                <Box size={28}/> 
              </div>
              Sub-Unit Operations
            </h2>
            <div className="mt-2 flex items-center gap-2">
              <div className="bg-indigo-50 text-indigo-800 text-xs font-bold px-3 py-1 rounded-full border border-indigo-100 uppercase tracking-widest">
                Unit ID: {CURRENT_UNIT_ID}
              </div>
              <div className="bg-slate-100 text-slate-500 text-[10px] font-bold px-3 py-1 rounded-full border border-slate-200 uppercase tracking-widest">
                Sewing Section A
              </div>
            </div>
        </div>
        <div className="flex flex-col md:flex-row gap-3 items-center">
            <div className="relative w-full md:w-80">
                <input type="text" placeholder="Search by Order # or Style..." className="pl-11 pr-4 py-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-full bg-white text-slate-900 shadow-sm transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
            </div>
            <button onClick={handleOpenMaterialHistory} className="bg-white border border-slate-200 text-slate-700 px-5 py-3 rounded-xl flex items-center gap-2 font-bold hover:bg-slate-50 shadow-sm transition-all active:scale-95"><Archive size={20} className="text-indigo-600"/><span>Req History</span></button>
            <div className="bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm flex gap-1">
                <button onClick={() => setActiveTab('active')} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'active' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><ListTodo size={18}/> Active</button>
                <button onClick={() => setActiveTab('history')} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><History size={18}/> Completed</button>
            </div>
        </div>
      </div>
      
      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
        {displayedOrders.length === 0 ? (
            <div className="p-20 text-center">
              <Info size={48} className="mx-auto text-slate-200 mb-4" />
              <p className="text-slate-400 text-lg font-medium">No production orders found in this section.</p>
            </div>
        ) : (
            <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b">
                <tr><th className="p-5 w-12"></th><th className="p-5">Order Reference</th><th className="p-5">Style & Quantity</th><th className="p-5">Production Progress</th><th className="p-5 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {displayedOrders.map(order => {
                const canAdvance = order.status !== OrderStatus.QC && order.status !== OrderStatus.COMPLETED;
                const isReadyToComplete = order.status === OrderStatus.QC_APPROVED;
                const isCompleted = order.status === OrderStatus.COMPLETED;
                const formattedOrderNo = formatOrderNumber(order);
                return (
                    <tr key={order.id} className={`hover:bg-slate-50/80 transition-colors group ${selectedOrders.includes(order.id) ? 'bg-indigo-50/50' : ''} cursor-pointer`} onClick={() => { setUseNumericSizes(order.size_format === 'numeric'); setDetailsModal(order); }}>
                    <td className="p-5" onClick={e => e.stopPropagation()}>
                        {!isCompleted && <input type="checkbox" disabled={!canAdvance || isReadyToComplete} checked={selectedOrders.includes(order.id)} onChange={() => toggleSelect(order.id)} className="w-5 h-5 text-indigo-600 rounded-lg border-slate-300 focus:ring-indigo-500 disabled:opacity-30 cursor-pointer" />}
                    </td>
                    <td className="p-5">
                        <div className="font-black text-xl text-slate-800 group-hover:text-indigo-600 transition-colors">{formattedOrderNo}</div>
                        <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5 mt-1">
                          <Clock size={12}/> Due: {order.target_delivery_date}
                        </div>
                    </td>
                    <td className="p-5">
                        <div className="text-base font-bold text-slate-700">{order.style_number}</div>
                        <div className="text-xs font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md inline-block mt-1 uppercase tracking-tighter">Target: {order.quantity} pcs ({order.box_count || '---'} Boxes)</div>
                    </td>
                    <td className="p-5">
                        <StatusBadge status={order.status} />
                        {order.qc_notes && (
                          <div className="mt-2 p-2 bg-red-50 rounded-lg border border-red-100">
                            <div className="text-[10px] font-black text-red-600 uppercase flex items-center gap-1 mb-0.5"><AlertTriangle size={12}/> QC Feedback</div>
                            <div className="text-xs text-red-700 font-medium line-clamp-1">{order.qc_notes}</div>
                          </div>
                        )}
                    </td>
                    <td className="p-5 text-right flex justify-end gap-3 items-center flex-wrap" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setUseNumericSizes(order.size_format === 'numeric'); setDetailsModal(order); }} className="p-2.5 bg-white hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 shadow-sm transition-all active:scale-90" title="View Detail"><Eye size={20}/></button>
                        <button onClick={() => handleSendMaterialEmail(order.id)} disabled={emailLoading === order.id} className="p-2.5 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-xl border border-orange-200 shadow-sm transition-all active:scale-90" title="Email Req List">{emailLoading === order.id ? <Loader2 size={20} className="animate-spin" /> : <Mail size={20}/>}</button>
                        {!isCompleted && (
                            <>
                                <button onClick={() => openTimeline(order.id, formattedOrderNo)} className="p-2.5 bg-teal-50 hover:bg-teal-100 text-teal-600 rounded-xl border border-teal-200 transition-all active:scale-90" title="Timeline"><Clock size={20}/></button>
                                <button onClick={() => setBarcodeModal({ orderId: order.id, style: order.style_number })} className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition-all active:scale-90" title="Barcodes"><Printer size={20}/></button>
                                <button onClick={() => { setIsEditingRequest(null); setMaterialModal(order.id); }} className="p-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl border border-blue-200 transition-all active:scale-90" title="Requisition"><PackagePlus size={20}/></button>
                                {canAdvance && (
                                    <button onClick={() => handleSingleStatusUpdate(order.id, order.status)} className={`px-5 py-2.5 rounded-xl inline-flex items-center gap-2 shadow-lg font-black text-sm uppercase tracking-wider text-white transition-all active:scale-95 ${isReadyToComplete ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                                        {isReadyToComplete ? <><CheckCircle2 size={18} /><span>Finalize</span></> : <><ArrowRight size={18} /><span>Advance</span></>}
                                    </button>
                                )}
                            </>
                        )}
                    </td>
                    </tr>
                );
                })}
            </tbody>
            </table>
        )}
      </div>

      {activeTab === 'active' && <BulkActionToolbar selectedCount={selectedOrders.length} actions={[{ label: 'Advance Status', onClick: handleBulkStatusUpdate }]} />}

      {detailsModal && (
        <OrderDetailsModal 
          order={detailsModal} 
          useNumericSizes={useNumericSizes} 
          onToggleSizeFormat={() => setUseNumericSizes(!useNumericSizes)} 
          onClose={() => setDetailsModal(null)} 
          onPrint={() => handlePrintOrderSheet(detailsModal)} 
        />
      )}

      {timelineModal && (
        <TimelineModal 
          orderNo={timelineModal.orderNo} 
          logs={timelineLogs} 
          statusUpdateText={statusUpdateText} 
          setStatusUpdateText={setStatusUpdateText} 
          onSubmitLog={submitManualStatusUpdate} 
          onClose={() => setTimelineModal(null)} 
        />
      )}

      {completionModal && completionForm && (
        <CompletionModal 
          order={completionModal} 
          form={completionForm} 
          useNumericSizes={useNumericSizes} 
          onToggleSizeFormat={() => setUseNumericSizes(!useNumericSizes)} 
          onUpdateRow={(idx, field, val) => {
            const updated = [...completionForm.breakdown];
            updated[idx] = { ...updated[idx], [field]: val };
            setCompletionForm({ ...completionForm, breakdown: updated });
          }} 
          onUpdateBoxCount={(count) => setCompletionForm({ ...completionForm, actualBoxCount: count })} 
          onSubmit={handleCompleteOrder} 
          onClose={() => setCompletionModal(null)} 
        />
      )}

      {barcodeModal && (
        <BarcodeModal 
          orderId={barcodeModal.orderId} 
          style={barcodeModal.style} 
          onGenerate={handleGenerateAndPrintBarcodes} 
          onClose={() => setBarcodeModal(null)} 
          sizeOptions={useNumericSizes ? ['65', '70', '75', '80', '85', '90'] : ['S', 'M', 'L', 'XL', 'XXL', '3XL']} 
        />
      )}

      {showMaterialHistory && (
        <MaterialHistoryModal 
          history={materialHistory} 
          orders={orders} 
          onClose={() => setShowMaterialHistory(false)} 
          onAddNew={(orderId) => { setIsEditingRequest(null); setMaterialModal(orderId); setShowMaterialHistory(false); }} 
          onEdit={handleEditRequest} 
          onDelete={handleDeleteRequest} 
          onPrint={handlePrintAccessoriesReceipt} 
        />
      )}

      {materialModal && (
        <MaterialRequestModal 
          orderId={materialModal} 
          orderNo={orders.find(o => o.id === materialModal) ? formatOrderNumber(orders.find(o => o.id === materialModal)!) : ''} 
          orders={orders} 
          onClose={() => setMaterialModal(null)} 
          isEditingRequest={isEditingRequest} 
          useNumericSizes={useNumericSizes} 
          onRefresh={refreshOrders} 
        />
      )}
    </div>
  );
};
