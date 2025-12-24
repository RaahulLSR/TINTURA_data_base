
import React, { useEffect, useState } from 'react';
import { fetchOrders, fetchUnits, createOrder, fetchBarcodes, uploadOrderAttachment, fetchOrderLogs, updateOrderDetails, triggerOrderEmail, deleteOrder } from '../services/db';
import { Order, Unit, OrderStatus, BarcodeStatus, SizeBreakdown, OrderLog, Attachment, formatOrderNumber } from '../types';
import { StatusBadge } from '../components/Widgets';
import { PlusCircle, RefreshCw, Package, Activity, Trash2, Plus, Eye, X, Upload, FileText, Download, BarChart3, PieChart, Clock, Search, ArrowLeftRight, Paperclip, Send, Loader2, Printer, Image as ImageIcon, Save, Pencil, Box } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'reports'>('overview');
  const [orders, setOrders] = useState<Order[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [liveStockCount, setLiveStockCount] = useState(0);
  const [activeOrderCount, setActiveOrderCount] = useState(0);
  const [emailLoading, setEmailLoading] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailsModal, setDetailsModal] = useState<Order | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Order>>({});
  const [modalLogs, setModalLogs] = useState<OrderLog[]>([]);
  const [useNumericSizes, setUseNumericSizes] = useState(false);

  // New files to upload during edit/create
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const [newOrder, setNewOrder] = useState({
    style_number: '',
    unit_id: 1,
    target_delivery_date: '',
    description: '',
    box_count: 0
  });

  const [breakdown, setBreakdown] = useState<SizeBreakdown[]>([
    { color: '', s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0 }
  ]);

  const loadData = async () => {
    const [fetchedOrders, fetchedUnits, fetchedStock] = await Promise.all([
        fetchOrders(), 
        fetchUnits(),
        fetchBarcodes(BarcodeStatus.COMMITTED_TO_STOCK)
    ]);
    setOrders(fetchedOrders);
    setUnits(fetchedUnits);
    setLiveStockCount(fetchedStock.length);
    setActiveOrderCount(fetchedOrders.filter(o => o.status !== OrderStatus.COMPLETED).length);
  };

  useEffect(() => { loadData(); }, [activeTab]);

  useEffect(() => {
      if (detailsModal) {
          fetchOrderLogs(detailsModal.id).then(setModalLogs);
          setIsEditing(false);
          setEditFormData({ ...detailsModal });
          setUseNumericSizes(detailsModal.size_format === 'numeric');
          setSelectedFiles([]); // Reset new files when switching order
      }
  }, [detailsModal]);

  const handleSendEmail = async (orderId: string, isEdit: boolean = false) => {
    setEmailLoading(orderId);
    const result = await triggerOrderEmail(orderId, isEdit);
    setEmailLoading(null);
    alert(result.message);
  };

  const handleDeleteOrder = async (id: string) => {
    if (confirm("Are you sure you want to delete this order?")) {
      await deleteOrder(id);
      setDetailsModal(null);
      loadData();
    }
  };

  const getDisplayOrders = () => {
      return orders.filter(order => {
          const formattedNo = formatOrderNumber(order);
          const matchesSearch = 
            formattedNo.toLowerCase().includes(searchTerm.toLowerCase()) || 
            order.style_number.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesStatus = statusFilter === 'ALL' || order.status === statusFilter;
          return matchesSearch && matchesStatus;
      });
  };

  const getRowTotal = (row: SizeBreakdown) => (row.s || 0) + (row.m || 0) + (row.l || 0) + (row.xl || 0) + (row.xxl || 0) + (row.xxxl || 0);
  const getTotalQuantity = (bd: SizeBreakdown[] = []) => bd.reduce((acc, row) => acc + getRowTotal(row), 0);
  const getHeaderLabels = () => useNumericSizes ? ['65', '70', '75', '80', '85', '90'] : ['S', 'M', 'L', 'XL', 'XXL', '3XL'];

  const handleAddRow = () => setBreakdown([...breakdown, { color: '', s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0 }]);
  const handleRemoveRow = (index: number) => setBreakdown(breakdown.filter((_, i) => i !== index));
  const updateRow = (index: number, field: keyof SizeBreakdown, value: string | number) => {
    const updated = [...breakdown];
    updated[index] = { ...updated[index], [field]: value };
    setBreakdown(updated);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const quantity = getTotalQuantity(breakdown);
    if (quantity === 0) return alert("Total quantity cannot be zero");

    setIsUploading(true);
    try {
        const attachments: Attachment[] = [];
        if (selectedFiles.length > 0) {
            for (const file of selectedFiles) {
                const url = await uploadOrderAttachment(file);
                if (url) attachments.push({ name: file.name, url: url, type: (file.type.startsWith('image/') || file.name.endsWith('.pdf')) ? (file.type.startsWith('image/') ? 'image' : 'document') : 'document' });
            }
        }

        const { data: createdOrder, error } = await createOrder({
            ...newOrder,
            quantity,
            size_breakdown: breakdown,
            attachments,
            size_format: useNumericSizes ? 'numeric' : 'standard'
        });

        if (createdOrder) {
            await triggerOrderEmail(createdOrder.id, false);
            alert("Order launched successfully!");
            setIsModalOpen(false);
            setNewOrder({ style_number: '', unit_id: 1, target_delivery_date: '', description: '', box_count: 0 });
            setBreakdown([{ color: '', s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0 }]);
            setSelectedFiles([]);
            loadData(); 
        } else {
            alert(`Database Error: ${error || 'Failed to communicate with Supabase.'}`);
        }
    } catch (err: any) {
        console.error("Order Launch UI Error:", err);
        alert(`Failed to launch order: ${err.message || 'Unknown error'}`);
    } finally {
        setIsUploading(false);
    }
  };

  const handleSaveEdit = async () => {
      if (!detailsModal) return;
      setIsUploading(true);
      try {
        // 1. Upload any newly selected files
        const newAttachments: Attachment[] = [];
        if (selectedFiles.length > 0) {
            for (const file of selectedFiles) {
                const url = await uploadOrderAttachment(file);
                if (url) {
                    const type = file.type.startsWith('image/') ? 'image' : 'document';
                    newAttachments.push({ name: file.name, url: url, type: type as 'image' | 'document' });
                }
            }
        }

        // 2. The existing attachments in editFormData already have removals applied (handled in UI)
        const finalAttachments = [
            ...(editFormData.attachments || []),
            ...newAttachments
        ];

        // 3. Calc final qty based on potentially modified matrix
        const finalQty = getTotalQuantity(editFormData.size_breakdown as SizeBreakdown[]);

        const updates: Partial<Order> = { 
            ...editFormData, 
            quantity: finalQty,
            attachments: finalAttachments,
            size_format: useNumericSizes ? 'numeric' : 'standard'
        };

        const result = await updateOrderDetails(detailsModal.id, updates);
        
        if (result.success) {
            await triggerOrderEmail(detailsModal.id, true);
            alert("Order updated and REVISED sheet sent to sub-unit.");
            setIsEditing(false);
            setDetailsModal(null);
            loadData();
        } else {
            alert(`Failed to save: ${result.error}`);
        }
      } catch (err: any) {
          alert(`Error saving changes: ${err.message}`);
      } finally {
          setIsUploading(false);
      }
  };

  const handlePrintOrderSheet = () => {
      const target = isEditing ? editFormData : detailsModal;
      if (!target) return;
      
      const formattedNo = formatOrderNumber(target);
      const breakdownData = target.size_breakdown || [];
      const headers = getHeaderLabels();
      const keys = ['s', 'm', 'l', 'xl', 'xxl', 'xxxl'] as const;

      const breakdownRows = breakdownData.map(row => `<tr><td style="text-align:left; font-weight:bold;">${row.color}</td>${keys.map(k => `<td>${(row as any)[k]}</td>`).join('')}<td style="font-weight:bold;">${getRowTotal(row)}</td></tr>`).join('');

      let attachmentSection = '';
      if (target.attachments && target.attachments.length > 0) {
          const imageAttachments = target.attachments.filter(a => a.type === 'image');
          const docAttachments = target.attachments.filter(a => a.type === 'document' && a.url.toLowerCase().endsWith('.pdf'));

          attachmentSection = `
            <div style="margin-top: 40px; border-top: 2px solid #333; padding-top: 20px;">
                <h3 style="text-transform: uppercase;">Technical Attachments</h3>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px;">
                    ${imageAttachments.map(img => `<div style="border: 1px solid #ddd; padding: 10px; text-align: center;"><img src="${img.url}" style="max-width: 100%; max-height: 500px; border-radius: 4px;" /><br/><span style="font-size: 11px; font-weight: bold; margin-top: 5px; display: block;">IMG: ${img.name}</span></div>`).join('')}
                </div>

                ${docAttachments.map(doc => `
                    <div style="margin-top: 30px; border: 2px solid #333; border-radius: 8px; overflow: hidden; page-break-before: always;">
                        <div style="background: #333; color: white; padding: 10px; font-weight: bold; text-align: center;">PDF DOCUMENT: ${doc.name}</div>
                        <iframe src="${doc.url}" style="width: 100%; height: 1000px;" frameborder="0"></iframe>
                    </div>
                `).join('')}
            </div>`;
      }

      const win = window.open('', 'PrintOrderSheet', 'width=1000,height=800');
      if (win) {
          win.document.write(`
            <html><head><title>Order Sheet - ${formattedNo}</title><style>@media print { body { -webkit-print-color-adjust: exact; } .no-print { display: none; } iframe { border: none; } } body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; } .header { text-align: center; border-bottom: 5px solid #000; padding-bottom: 20px; margin-bottom: 30px; } .brand { font-size: 42px; font-weight: 900; margin: 0; } .title { font-size: 20px; font-weight: bold; color: #666; margin-top: 5px; text-transform: uppercase; } .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-top: 25px; } .box { padding: 12px; border: 2px solid #000; border-radius: 6px; } .label { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #888; display: block; } .value { font-size: 18px; font-weight: 800; } table { width: 100%; border-collapse: collapse; margin-top: 25px; } th, td { border: 1px solid #000; padding: 10px; text-align: center; font-size: 13px; } th { background: #f0f0f0; font-weight: 800; } .section-title { font-size: 16px; font-weight: 900; border-bottom: 3px solid #000; padding-bottom: 4px; margin-top: 40px; margin-bottom: 15px; text-transform: uppercase; } .instructions { padding: 15px; border: 2px solid #000; background: #fafafa; font-size: 14px; line-height: 1.5; }</style></head>
            <body>
                <div class="header">
                    <h1 class="brand">TINTURA SST</h1>
                    <h2 class="title">Manufacturing Job Order</h2>
                </div>
                <div class="grid">
                    <div class="box"><span class="label">Order Number</span><div class="value">${formattedNo}</div></div>
                    <div class="box"><span class="label">Style Number</span><div class="value">${target.style_number}</div></div>
                    <div class="box"><span class="label">Total Quantity</span><div class="value">${target.quantity} PCS</div></div>
                    <div class="box"><span class="label">Delivery Due</span><div class="value">${target.target_delivery_date}</div></div>
                    <div class="box"><span class="label">Planned Boxes</span><div class="value">${target.box_count}</div></div>
                    <div class="box"><span class="label">Production Unit</span><div class="value">${units.find(u => u.id === target.unit_id)?.name || 'HQ'}</div></div>
                </div>
                
                <h3 class="section-title">Size Breakdown Matrix</h3>
                <table><thead><tr><th style="text-align:left;">Color</th>${headers.map(h => `<th>${h}</th>`).join('')}<th>Total</th></tr></thead><tbody>${breakdownRows}</tbody></table>
                
                <h3 class="section-title">Manufacturing Instructions</h3>
                <div class="instructions">${target.description || 'No special notes provided.'}</div>
                
                ${attachmentSection}
                
                <div style="margin-top: 50px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 10px;">
                    Generated on ${new Date().toLocaleString()} | Tintura SST Internal Document
                </div>
                <script>
                    window.onload = () => { 
                        // Small timeout to allow images and iframes to start loading
                        setTimeout(() => { window.print(); }, 1200); 
                    };
                </script>
            </body></html>`);
          win.document.close();
      }
  };

  const renderDetailCell = (order: Order, rowIdx: number, sizeKey: keyof SizeBreakdown) => {
      const plannedRow = order.size_breakdown?.[rowIdx];
      const actualRow = order.completion_breakdown?.[rowIdx];
      const plannedVal = plannedRow ? (plannedRow[sizeKey] as number) : 0;
      if (order.status !== OrderStatus.COMPLETED || !actualRow) return <span className="text-slate-600 font-medium">{plannedVal}</span>;
      const actualVal = actualRow[sizeKey] as number;
      const isMismatch = actualVal !== plannedVal;
      return (
        <div className="flex flex-col items-center justify-center p-1 bg-slate-50 rounded border border-slate-100">
            <span className={`text-lg font-black ${isMismatch ? 'text-indigo-700' : 'text-slate-900'}`}>{actualVal}</span>
            <span className="text-[9px] text-slate-400 border-t border-slate-200 w-full text-center mt-0.5 pt-0.5 font-bold uppercase">Plan: {plannedVal}</span>
        </div>
      );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">{activeTab === 'overview' ? 'Executive Dashboard' : 'Analytics & Reports'}</h2>
        <div className="flex items-center gap-2">
            <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex gap-1">
                <button onClick={() => setActiveTab('overview')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><BarChart3 size={18}/> Overview</button>
                <button onClick={() => setActiveTab('reports')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'reports' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><PieChart size={18}/> Reports</button>
            </div>
            {activeTab === 'overview' && (
                <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 text-white px-5 py-3 rounded-xl flex items-center gap-2 hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all active:scale-95"><PlusCircle size={20} /><span>Launch New Order</span></button>
            )}
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-indigo-300 transition-colors">
                <div><p className="text-xs font-black text-slate-400 uppercase tracking-widest">Live Inventory Stock</p><p className="text-5xl font-black text-slate-800 mt-2">{liveStockCount}</p></div>
                <div className="p-5 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:scale-110 transition-transform"><Package size={40} /></div>
                </div>
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-blue-300 transition-colors">
                <div><p className="text-xs font-black text-slate-400 uppercase tracking-widest">Orders In Progress</p><p className="text-5xl font-black text-slate-800 mt-2">{activeOrderCount}</p></div>
                <div className="p-5 bg-blue-50 text-blue-600 rounded-2xl group-hover:scale-110 transition-transform"><Activity size={40} /></div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden flex flex-col">
                <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
                    <h3 className="font-black text-slate-700 uppercase tracking-tight">Master Production List</h3>
                    <div className="flex gap-2">
                        <div className="relative">
                            <input type="text" placeholder="Search Style or Order #..." className="pl-11 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none w-72" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
                            <Search className="absolute left-4 top-3 text-slate-400" size={18} />
                        </div>
                        <button onClick={loadData} className="p-2.5 bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 rounded-xl transition-all"><RefreshCw size={20}/></button>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b">
                        <tr><th className="p-5">Order Reference</th><th className="p-5">Style Number</th><th className="p-5">Assignee</th><th className="p-5">Volume</th><th className="p-5">Current Status</th><th className="p-5 text-right">Actions</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                    {getDisplayOrders().map((order) => {
                        const unitName = units.find(u => u.id === order.unit_id)?.name || 'HQ';
                        const formattedOrderNo = formatOrderNumber(order);
                        return (
                            <tr key={order.id} className="hover:bg-slate-50/80 cursor-pointer group transition-colors" onClick={() => setDetailsModal(order)}>
                                <td className="p-5 font-black text-slate-800 text-lg group-hover:text-indigo-600 transition-colors">{formattedOrderNo}</td>
                                <td className="p-5 text-slate-600 font-bold">{order.style_number}</td>
                                <td className="p-5 font-medium text-slate-500">{unitName}</td>
                                <td className="p-5 font-black text-slate-700 tabular-nums">{order.quantity}</td>
                                <td className="p-5"><StatusBadge status={order.status} /></td>
                                <td className="p-5 text-right flex justify-end gap-3" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => handleSendEmail(order.id, false)} disabled={emailLoading === order.id} className="p-2 bg-white text-slate-400 hover:text-indigo-600 rounded-xl border border-slate-100 hover:border-indigo-100 transition-all shadow-sm" title="Resend Launch Email">
                                        {emailLoading === order.id ? <Loader2 size={18} className="animate-spin" /> : <Send size={18}/>}
                                    </button>
                                    <button onClick={() => setDetailsModal(order)} className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all shadow-sm"><Eye size={18}/></button>
                                </td>
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
                </div>
            </div>
        </div>
      )}

      {detailsModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh] animate-scale-up border border-slate-200">
                <div className="p-6 border-b flex justify-between items-start bg-white">
                    <div>
                        <h3 className="text-3xl font-black text-slate-800 tracking-tight">{formatOrderNumber(detailsModal)}</h3>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Management Portal • {units.find(u => u.id === detailsModal.unit_id)?.name || 'HQ'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {!isEditing && (
                             <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-100 px-5 py-2.5 rounded-xl text-sm font-black hover:bg-indigo-600 hover:text-white transition-all">
                                <Pencil size={18} /> Modify Order
                            </button>
                        )}
                        <button onClick={() => setDetailsModal(null)} className="text-slate-300 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-full"><X size={32}/></button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                            <span className="block text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">Target Volume</span>
                            {isEditing ? (
                                <div className="text-2xl font-black text-indigo-600 tabular-nums">{getTotalQuantity(editFormData.size_breakdown as SizeBreakdown[])} PCS</div>
                            ) : (
                                <div className="text-2xl font-black text-slate-800 tabular-nums">{detailsModal.quantity} PCS</div>
                            )}
                        </div>
                        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                            <span className="block text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">Delivery Deadline</span>
                            {isEditing ? (
                                <input type="date" className="w-full border-2 border-slate-200 rounded-xl p-2 font-black text-indigo-600 focus:border-indigo-500 outline-none" value={editFormData.target_delivery_date} onChange={e => setEditFormData({...editFormData, target_delivery_date: e.target.value})}/>
                            ) : (
                                <div className="text-lg font-black text-slate-800">{detailsModal.target_delivery_date}</div>
                            )}
                        </div>
                        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                            <span className="block text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2 flex items-center gap-1"><Box size={10}/> Planned Boxes</span>
                            {isEditing ? (
                                <input type="number" className="w-full border-2 border-slate-200 rounded-xl p-2 font-black text-indigo-600 focus:border-indigo-500 outline-none" value={editFormData.box_count} onChange={e => setEditFormData({...editFormData, box_count: parseInt(e.target.value) || 0})}/>
                            ) : (
                                <div className="text-lg font-black text-slate-800 tabular-nums">{detailsModal.box_count} Units</div>
                            )}
                        </div>
                        <div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100 shadow-sm">
                            <span className="block text-[10px] text-indigo-400 uppercase font-black tracking-widest mb-2">Assigned Facility</span>
                            {isEditing ? (
                                <select className="w-full border-2 border-indigo-100 rounded-xl p-2 text-sm bg-white font-black text-indigo-600 focus:border-indigo-500 outline-none" value={editFormData.unit_id} onChange={e => setEditFormData({...editFormData, unit_id: parseInt(e.target.value)})}>
                                    {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            ) : (
                                <div className="text-lg font-black text-indigo-900">{units.find(u => u.id === detailsModal.unit_id)?.name || 'HQ'}</div>
                            )}
                        </div>
                    </div>
                    
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-black text-slate-700 uppercase tracking-tight text-lg">Product Breakdown Matrix</h4>
                            {isEditing && (
                                <button type="button" onClick={() => setUseNumericSizes(!useNumericSizes)} className="text-[10px] bg-slate-100 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-200 flex items-center gap-2 font-black uppercase tracking-widest transition-all"><ArrowLeftRight size={14}/> {useNumericSizes ? 'Letter Sizes' : 'Numeric Sizes'}</button>
                            )}
                        </div>
                        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-lg">
                            <table className="w-full text-center text-sm border-collapse">
                                <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-widest border-b">
                                    <tr><th className="p-4 text-left border-r">Color Variant</th>{getHeaderLabels().map(h => <th key={h} className="p-4 border-r">{h}</th>)}<th className="p-4 bg-slate-100">Row Sum</th>{isEditing && <th className="p-4 w-12"></th>}</tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(isEditing ? editFormData.size_breakdown : detailsModal.size_breakdown)?.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4 text-left font-black text-slate-700 border-r">
                                                {isEditing ? (
                                                    <input className="w-full border-2 border-slate-100 rounded-lg p-2 bg-white font-bold text-indigo-600 focus:border-indigo-400 outline-none" value={row.color} onChange={e => {
                                                        const newBd = [...(editFormData.size_breakdown || [])];
                                                        newBd[idx] = { ...newBd[idx], color: e.target.value };
                                                        setEditFormData({...editFormData, size_breakdown: newBd});
                                                    }}/>
                                                ) : row.color}
                                            </td>
                                            {['s','m','l','xl','xxl','xxxl'].map(key => (
                                                <td key={key} className="p-4 border-r tabular-nums">
                                                    {isEditing ? (
                                                        <input type="number" className="w-16 border-2 border-slate-100 rounded-lg p-2 text-center bg-white text-indigo-600 font-black focus:border-indigo-400 outline-none" value={(row as any)[key]} onChange={e => {
                                                            const newBd = [...(editFormData.size_breakdown || [])];
                                                            newBd[idx] = { ...newBd[idx], [key]: parseInt(e.target.value) || 0 };
                                                            setEditFormData({...editFormData, size_breakdown: newBd});
                                                        }}/>
                                                    ) : (renderDetailCell(detailsModal, idx, key as keyof SizeBreakdown))}
                                                </td>
                                            ))}
                                            <td className="p-4 font-black text-slate-900 bg-slate-50/50 tabular-nums">{getRowTotal(row)}</td>
                                            {isEditing && (
                                                <td className="p-4">
                                                    <button onClick={() => {
                                                        const newBd = (editFormData.size_breakdown || []).filter((_, i) => i !== idx);
                                                        setEditFormData({...editFormData, size_breakdown: newBd});
                                                    }} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={20}/></button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {isEditing && (
                                <button onClick={() => {
                                    const newBd = [...(editFormData.size_breakdown || []), { color: '', s: 0, m: 0, l: 0, xl: 0, xxl: 0, xxxl: 0 }];
                                    setEditFormData({...editFormData, size_breakdown: newBd});
                                }} className="w-full py-5 bg-slate-50 text-indigo-600 text-xs font-black uppercase tracking-widest hover:bg-indigo-50 border-t border-slate-200 transition-colors">+ Add Color Variant</button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div className="p-6 bg-slate-50/50 rounded-2xl border border-slate-200 shadow-inner">
                                <span className="block text-[11px] text-slate-400 uppercase font-black tracking-widest mb-3">Manufacturing Instructions</span>
                                {isEditing ? (<textarea className="w-full border-2 border-slate-200 rounded-2xl p-4 text-sm h-48 bg-white text-indigo-600 font-medium focus:border-indigo-400 outline-none" value={editFormData.description} onChange={e => setEditFormData({...editFormData, description: e.target.value})}/>) : (<p className="text-base text-slate-600 font-medium whitespace-pre-wrap leading-relaxed">{detailsModal.description || "N/A"}</p>)}
                            </div>
                            
                            <div className="p-6 bg-indigo-50/30 rounded-2xl border border-indigo-100 shadow-inner">
                                <h4 className="font-black text-indigo-400 uppercase tracking-widest text-[10px] flex items-center gap-2 mb-4">
                                    <Paperclip size={14}/> Technical Documentation
                                </h4>
                                <div className="space-y-3">
                                    {(isEditing ? editFormData.attachments : detailsModal.attachments)?.map((att, i) => (
                                        <div key={i} className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100 hover:shadow-lg transition-all group">
                                            <a href={att.url} target="_blank" rel="noreferrer" className="flex items-center gap-4 flex-1">
                                                <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                  {att.type === 'image' ? <ImageIcon size={20} /> : <FileText size={20} />}
                                                </div>
                                                <span className="text-sm font-bold text-slate-700 truncate max-w-[200px]">{att.name}</span>
                                            </a>
                                            <div className="flex items-center gap-2">
                                                <a href={att.url} target="_blank" rel="noreferrer" className="p-2 text-slate-300 hover:text-indigo-600 transition-colors" title="Download"><Download size={20}/></a>
                                                {isEditing && (
                                                    <button onClick={() => {
                                                        const remaining = (editFormData.attachments || []).filter((_, idx) => idx !== i);
                                                        setEditFormData({...editFormData, attachments: remaining});
                                                    }} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Remove attachment"><Trash2 size={20}/></button>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {isEditing && (
                                        <div className="mt-6 border-2 border-dashed border-indigo-200 rounded-2xl p-6 bg-white/60 text-center relative hover:bg-indigo-50 hover:border-indigo-400 transition-all cursor-pointer">
                                            <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => { if (e.target.files) setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]); }}/>
                                            <Upload size={32} className="mx-auto text-indigo-400 mb-2" />
                                            <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">Add Supplementary Files</p>
                                            <p className="text-[10px] text-slate-400 mt-1">Techpacks, PDF, Images</p>
                                        </div>
                                    )}

                                    {isEditing && selectedFiles.length > 0 && (
                                        <div className="space-y-2 mt-4">
                                            <p className="text-[10px] font-black text-slate-400 uppercase px-1 tracking-widest">Pending Uploads:</p>
                                            {selectedFiles.map((f, i) => (
                                                <div key={i} className="flex items-center justify-between p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100 text-xs animate-scale-up">
                                                    <span className="truncate flex-1 font-black">{f.name}</span>
                                                    <button onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-white/50 hover:text-white ml-2"><X size={18}/></button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {!(isEditing ? (editFormData.attachments?.length || 0) + selectedFiles.length : detailsModal.attachments?.length) && (
                                        <div className="text-center py-10 text-slate-300 border-2 border-dashed border-slate-100 rounded-2xl bg-white/50">
                                            <Paperclip size={32} className="mx-auto opacity-20 mb-2" />
                                            <p className="text-[10px] uppercase font-black tracking-widest opacity-60">No technical files</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-indigo-50/30 rounded-3xl border border-indigo-100 shadow-inner overflow-hidden flex flex-col">
                            <h4 className="font-black text-indigo-900 uppercase tracking-widest text-[10px] flex items-center gap-2 mb-6"><Clock size={16}/> Production Lifecycle Log</h4>
                            <div className="space-y-6 flex-1 max-h-[400px] overflow-y-auto pr-4 scrollbar-hide">
                                {modalLogs.length === 0 ? <div className="text-slate-300 italic text-sm text-center py-10">No history logged yet.</div> : modalLogs.map(log => (
                                    <div key={log.id} className="flex gap-4 items-start text-sm border-l-4 border-indigo-100 pl-6 relative pb-2 transition-all hover:border-indigo-400">
                                        <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-indigo-600 border-4 border-white shadow-sm" />
                                        <div className="font-black text-[10px] text-slate-400 tabular-nums uppercase leading-none pt-1">
                                            {new Date(log.created_at).toLocaleDateString()}<br/>
                                            <span className="text-indigo-400 opacity-60">{new Date(log.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                        </div>
                                        <div className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                                            <p className="text-slate-700 font-bold leading-snug">{log.message}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="p-6 border-t bg-slate-50 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.03)]">
                    <button onClick={() => handleDeleteOrder(detailsModal.id)} className="p-3 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all" title="Archive/Delete Order"><Trash2 size={24}/></button>
                    <div className="flex items-center gap-4">
                        <button onClick={handlePrintOrderSheet} className="px-8 py-3 bg-white text-indigo-600 border-2 border-indigo-600 rounded-xl font-black hover:bg-indigo-50 shadow-md flex items-center gap-2 transition-all active:scale-95 uppercase tracking-widest text-xs">
                            <Printer size={20} /> Print Full Sheet
                        </button>
                        <button onClick={() => setDetailsModal(null)} className="px-10 py-3 bg-slate-800 text-white rounded-xl font-black hover:bg-slate-700 shadow-xl transition-all active:scale-95 uppercase tracking-widest text-xs">Close</button>
                        {isEditing && (
                            <button onClick={handleSaveEdit} disabled={isUploading} className="bg-indigo-600 text-white px-10 py-3 rounded-xl font-black hover:bg-indigo-700 flex items-center gap-2 shadow-2xl shadow-indigo-200 disabled:opacity-50 transition-all active:scale-95 uppercase tracking-widest text-xs">
                                {isUploading ? <><Loader2 size={20} className="animate-spin" /> Saving Changes...</> : <><Save size={20}/> Save Revised Job</>}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh] animate-scale-up border border-slate-200">
                <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                    <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-lg">
                      <Plus size={24}/>
                    </div>
                    Launch Production Order
                  </h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-slate-300 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={32}/></button>
                </div>
                <form onSubmit={handleCreateOrder} className="flex-1 overflow-y-auto p-8 space-y-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="col-span-1"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Style Reference</label><input required className="w-full border-2 border-slate-100 rounded-xl p-4 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm transition-all" value={newOrder.style_number} onChange={e => setNewOrder({...newOrder, style_number: e.target.value})}/></div>
                        <div className="col-span-1"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Assign Facility</label><select className="w-full border-2 border-slate-100 rounded-xl p-4 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer" value={newOrder.unit_id} onChange={e => setNewOrder({...newOrder, unit_id: parseInt(e.target.value)})}>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
                        <div className="col-span-1"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Planned Box Count</label><input required type="number" min="1" className="w-full border-2 border-slate-100 rounded-xl p-4 bg-white text-slate-900 font-black focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" value={newOrder.box_count} onChange={e => setNewOrder({...newOrder, box_count: parseInt(e.target.value) || 0})}/></div>
                        <div className="col-span-1"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Delivery Due</label><input required type="date" className="w-full border-2 border-slate-100 rounded-xl p-4 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer" value={newOrder.target_delivery_date} onChange={e => setNewOrder({...newOrder, target_delivery_date: e.target.value})}/></div>
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-4"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Color & Size Breakdown Matrix</label><button type="button" onClick={() => setUseNumericSizes(!useNumericSizes)} className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-5 py-2 rounded-xl border border-indigo-100 uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm"><ArrowLeftRight size={14} className="inline mr-2"/> Format: {useNumericSizes ? '65-90' : 'S-3XL'}</button></div>
                        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-lg">
                            <table className="w-full text-center text-sm border-collapse"><thead className="bg-slate-50 text-slate-400 font-black uppercase text-[10px] tracking-widest border-b"><tr><th className="p-4 text-left border-r">Color Variant</th>{getHeaderLabels().map(h => <th key={h} className="p-4 border-r">{h}</th>)}<th className="p-4 bg-slate-100">Row Sum</th><th className="p-4 w-12"></th></tr></thead>
                                <tbody className="divide-y divide-slate-100">{breakdown.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors"><td className="p-3 border-r"><input placeholder="e.g. Navy Blue" className="w-full border-2 border-slate-50 rounded-xl px-4 py-3 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-bold outline-none shadow-inner" value={row.color} onChange={e => updateRow(idx, 'color', e.target.value)}/></td>
                                        {['s','m','l','xl','xxl','xxxl'].map(sz => (<td key={sz} className="p-3 border-r"><input type="number" className="w-full border-2 border-slate-50 rounded-xl px-2 py-3 text-center bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-black outline-none shadow-inner" value={(row as any)[sz] || ''} onChange={e => updateRow(idx, sz as keyof SizeBreakdown, parseInt(e.target.value) || 0)}/></td>))}
                                        <td className="p-3 font-black text-indigo-700 bg-slate-50/50 tabular-nums text-lg">{getRowTotal(row)}</td>
                                        <td className="p-3">{breakdown.length > 1 && <button type="button" onClick={() => handleRemoveRow(idx)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={20}/></button>}</td></tr>))}
                                </tbody></table>
                            <button type="button" onClick={handleAddRow} className="w-full py-5 text-[10px] font-black text-indigo-600 hover:bg-indigo-50 border-t border-slate-100 transition-colors bg-slate-50/20 uppercase tracking-widest flex items-center justify-center gap-2"><Plus size={16}/> Add New Color Variant</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Detailed Production Notes</label><textarea className="w-full border-2 border-slate-100 rounded-3xl p-6 bg-white text-slate-900 h-48 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-inner font-medium leading-relaxed transition-all" placeholder="Enter stitching specifications, labeling notes, or special requirements..." value={newOrder.description} onChange={e => setNewOrder({...newOrder, description: e.target.value})}></textarea></div>
                        <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Technical Attachments & Visuals</label>
                          <div className="border-4 border-dashed border-slate-100 rounded-3xl p-8 bg-slate-50 hover:bg-indigo-50/30 hover:border-indigo-200 relative group transition-all h-48 flex flex-col items-center justify-center cursor-pointer shadow-inner">
                            <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => { if (e.target.files) setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]); }}/>
                            <div className="text-center group-hover:scale-105 transition-transform"><Upload size={48} className="mx-auto text-slate-300 mb-3 group-hover:text-indigo-500 transition-colors"/><p className="text-base font-black text-slate-700 uppercase tracking-tight">Drop Techpacks or Photos</p><p className="text-[10px] text-slate-400 mt-2 uppercase font-black tracking-widest opacity-60">Images & PDF documents supported</p></div>
                          </div>
                            {selectedFiles.length > 0 && (<div className="mt-6 space-y-3 max-h-48 overflow-y-auto pr-2 scrollbar-hide">{selectedFiles.map((f, i) => (<div key={i} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 text-xs shadow-md animate-scale-up hover:border-indigo-300 transition-colors"><div className="flex items-center gap-3 truncate pr-4"><div className="p-2 bg-indigo-50 text-indigo-500 rounded-lg"><ImageIcon size={18}/></div><span className="truncate font-black text-slate-700 uppercase tracking-tighter">{f.name}</span></div><button type="button" onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><X size={20}/></button></div>))}</div>)}
                        </div>
                    </div>
                    <div className="flex justify-end gap-4 pt-8 border-t mt-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.03)]">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-10 py-4 font-black text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-2xl transition-all uppercase tracking-widest text-xs">Discard</button>
                        <button type="submit" disabled={isUploading} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-2xl shadow-indigo-200 flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest text-xs">
                            {isUploading ? <><Loader2 size={20} className="animate-spin" /> Transmitting...</> : <><Send size={18}/> Launch Factory Order</>}</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};
