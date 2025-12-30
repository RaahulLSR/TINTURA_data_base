
import React, { useEffect, useState } from 'react';
import { fetchOrders, fetchUnits, fetchBarcodes, triggerOrderEmail, fetchOrderLogs, recordOrderEditHistory, supabase, syncAllOrdersWithStyles } from '../services/db';
import { Order, Unit, OrderStatus, BarcodeStatus, formatOrderNumber, OrderLog } from '../types';
import { BarChart3, PieChart, PlusCircle, ClipboardList, Printer, Loader2, CheckSquare, Square, History, Factory, Calendar, RefreshCcw, X, Calculator } from 'lucide-react';
import { DashboardStats } from '../components/admin/DashboardStats';
import { MasterOrderList } from '../components/admin/MasterOrderList';
import { LaunchOrderModal } from '../components/admin/LaunchOrderModal';
import { AdminOrderDetailsModal } from '../components/admin/AdminOrderDetailsModal';
import { HistoryModal } from '../components/style-db/HistoryModal';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'reports'>('overview');
  const [orders, setOrders] = useState<Order[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [liveStockCount, setLiveStockCount] = useState(0);
  const [activeOrderCount, setActiveOrderCount] = useState(0);
  const [emailLoading, setEmailLoading] = useState<string | null>(null);
  
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [detailsModal, setDetailsModal] = useState<Order | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Sync State
  const [isSyncing, setIsSyncing] = useState(false);

  // Bulk Edit States
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);

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

  const handleGlobalSync = async () => {
    if (!confirm("This will recalculate material forecasts for ALL orders based on current Style DB blueprints. Continue?")) return;
    
    setIsSyncing(true);
    try {
      const result = await syncAllOrdersWithStyles();
      alert(`Master Sync Complete!\n${result.updated} orders were recalculated and updated from the Style Database.`);
      loadData();
    } catch (err: any) {
      alert("Sync failed: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSendEmail = async (orderId: string) => {
    setEmailLoading(orderId);
    const result = await triggerOrderEmail(orderId, false);
    setEmailLoading(null);
    alert(result.message);
  };

  const handleBulkReassign = async () => {
    if (selectedOrderIds.length === 0) return;
    const unitIdStr = prompt(`Enter Unit ID to re-assign ${selectedOrderIds.length} orders to:\n${units.map(u => `${u.id}: ${u.name}`).join('\n')}`);
    if (!unitIdStr) return;
    const unitId = parseInt(unitIdStr);
    if (isNaN(unitId) || !units.find(u => u.id === unitId)) return alert("Invalid Unit ID");

    setBulkProcessing(true);
    try {
      const selectedOrders = orders.filter(o => selectedOrderIds.includes(o.id));
      await recordOrderEditHistory(`Bulk Re-assign: Moved to ${units.find(u => u.id === unitId)?.name}`, selectedOrders);
      
      const { error } = await supabase.from('orders').update({ unit_id: unitId }).in('id', selectedOrderIds);
      if (error) throw error;

      alert(`Successfully re-assigned ${selectedOrderIds.length} orders.`);
      setSelectedOrderIds([]);
      setIsBulkMode(false);
      loadData();
    } catch (err: any) {
      alert("Bulk update failed: " + err.message);
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkUpdateDate = async () => {
    if (selectedOrderIds.length === 0) return;
    const newDate = prompt("Enter new target delivery date (YYYY-MM-DD):");
    if (!newDate) return;

    setBulkProcessing(true);
    try {
      const selectedOrders = orders.filter(o => selectedOrderIds.includes(o.id));
      await recordOrderEditHistory(`Bulk Date Change: set to ${newDate}`, selectedOrders);
      
      const { error } = await supabase.from('orders').update({ target_delivery_date: newDate }).in('id', selectedOrderIds);
      if (error) throw error;

      alert("Dates updated successfully.");
      setSelectedOrderIds([]);
      setIsBulkMode(false);
      loadData();
    } catch (err: any) {
      alert("Bulk update failed: " + err.message);
    } finally {
      setBulkProcessing(false);
    }
  };

  const handlePrintUnitReport = async () => {
    setReportLoading(true);
    try {
      const inProgressOrders = orders.filter(o => o.status === OrderStatus.IN_PROGRESS);
      const assignedOrders = orders.filter(o => o.status === OrderStatus.ASSIGNED);
      const allLogs = await fetchOrderLogs();
      const inProgressOrderIds = inProgressOrders.map(o => o.id);
      const recentLogs = allLogs
        .filter(log => inProgressOrderIds.includes(log.order_id))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

      const groupedLogs: Record<string, OrderLog[]> = {};
      recentLogs.forEach(log => {
        if (!groupedLogs[log.order_id]) groupedLogs[log.order_id] = [];
        groupedLogs[log.order_id].push(log);
      });

      const win = window.open('', 'UnitReport', 'width=1000,height=800');
      if (win) {
        const logSectionsHtml = Object.entries(groupedLogs).map(([orderId, logs]) => {
          const order = inProgressOrders.find(o => o.id === orderId);
          const orderRef = order ? formatOrderNumber(order) : 'UNK';
          return `
            <div style="margin-bottom: 20px; border: 1.5px solid #1e293b; border-radius: 8px; overflow: hidden; page-break-inside: avoid;">
              <div style="background: #1e293b; padding: 10px 15px; font-weight: 900; color: #fff; font-size: 13px; text-transform: uppercase;">Job Ref: ${orderRef}</div>
              <table style="width: 100%; border-collapse: collapse; background: #fff;">
                <tbody style="font-size: 11px;">
                  ${logs.map(log => `<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px; width: 160px; color: #64748b; font-weight: bold; border-right: 1px solid #e2e8f0;">${new Date(log.created_at).toLocaleString()}</td><td style="padding: 10px; color: #1e293b; font-weight: 500;">${log.message}</td></tr>`).join('')}
                </tbody>
              </table>
            </div>`;
        }).join('');

        const assignedRows = assignedOrders.map(order => `
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${formatOrderNumber(order)}</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${order.style_number}</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: bold;">${order.quantity}</td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${order.target_delivery_date}</td>
          </tr>`).join('');

        win.document.write(`
          <html><head><title>Unit Production Report</title><style>body { font-family: sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; background: #fff; } .header { border-bottom: 4px solid #000; padding-bottom: 20px; margin-bottom: 30px; text-align: center; } .brand { font-size: 28px; font-weight: 900; letter-spacing: 1px; } .title { font-size: 16px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-top: 5px; } .section-title { font-size: 14px; font-weight: 900; background: #f1f5f9; padding: 10px 15px; border-left: 6px solid #1e293b; margin: 40px 0 20px 0; text-transform: uppercase; letter-spacing: 1px; } table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; } th { background: #f8fafc; text-align: left; padding: 12px; border: 1px solid #ddd; text-transform: uppercase; font-size: 10px; color: #64748b; } .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #eee; padding-top: 20px; } @media print { body { padding: 20px; } .section-title { -webkit-print-color-adjust: exact; } }</style></head>
          <body>
            <div class="header"><div class="brand">TINTURA SST</div><div class="title">Manufacturing Unit Executive Report</div><div style="font-size: 11px; margin-top: 10px; font-weight: bold; color: #94a3b8;">DISPATCHED: ${new Date().toLocaleString()}</div></div>
            <div class="section-title">Recent Timeline Activity (Last 5 Global Updates)</div>
            ${recentLogs.length === 0 ? '<p style="color: #94a3b8; font-style: italic; text-align: center; padding: 20px;">No recent floor activity logs recorded for in-progress jobs.</p>' : logSectionsHtml}
            <div class="section-title">Queue Status (Assigned & Unstarted Jobs)</div>
            ${assignedOrders.length === 0 ? '<p style="color: #94a3b8; font-style: italic; text-align: center; padding: 20px;">Assigned queue is currently empty.</p>' : `<table><thead><tr><th width="150">Order Ref</th><th>Style Reference</th><th width="100" style="text-align: center;">Batch Vol</th><th width="120" style="text-align: center;">Target Date</th></tr></thead><tbody>${assignedRows}</tbody></table>`}
            <div class="footer">This report is generated automatically by Tintura SST HQ. <br/>For internal manufacturing supervision only.</div>
            <script>window.onload = () => { setTimeout(() => { window.print(); }, 500); };</script>
          </body></html>`);
        win.document.close();
      }
    } catch (err) { alert("Critical: Failed to compile unit report."); } finally { setReportLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">
          {activeTab === 'overview' ? 'Executive Dashboard' : 'Analytics & Reports'}
        </h2>
        <div className="flex items-center gap-3">
            <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex gap-1">
                <button onClick={() => setActiveTab('overview')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><BarChart3 size={18}/> Overview</button>
                <button onClick={() => setActiveTab('reports')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'reports' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><PieChart size={18}/> Reports</button>
            </div>
            {activeTab === 'overview' && (
                <div className="flex gap-2">
                  <button 
                    onClick={handleGlobalSync} 
                    disabled={isSyncing}
                    className="p-3 bg-white border border-slate-200 text-slate-500 hover:text-orange-600 rounded-xl transition-all flex items-center gap-2 font-bold text-xs shadow-sm active:scale-95 disabled:opacity-50" 
                    title="Recalculate All Forecasts"
                  >
                    {isSyncing ? <Loader2 size={18} className="animate-spin" /> : <Calculator size={18} className="text-orange-500"/>}
                    <span>Global Sync</span>
                  </button>
                  <button onClick={() => setIsHistoryOpen(true)} className="p-3 bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 rounded-xl transition-all" title="Distribution History"><History size={20}/></button>
                  <button onClick={() => { setIsBulkMode(!isBulkMode); setSelectedOrderIds([]); }} className={`p-3 border rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${isBulkMode ? 'bg-orange-600 text-white border-orange-600 shadow-lg' : 'bg-white border-slate-200 text-slate-500 hover:text-orange-600'}`}><CheckSquare size={20}/> {isBulkMode ? 'Exit Bulk' : 'Bulk Edit'}</button>
                  <button onClick={handlePrintUnitReport} disabled={reportLoading} className="bg-white border-2 border-indigo-600 text-indigo-600 px-5 py-3 rounded-xl flex items-center gap-2 hover:bg-indigo-50 shadow-md transition-all active:scale-95 disabled:opacity-50">{reportLoading ? <Loader2 size={20} className="animate-spin" /> : <ClipboardList size={20} />}<span>Unit Report</span></button>
                  <button onClick={() => setIsLaunchModalOpen(true)} className="bg-indigo-600 text-white px-5 py-3 rounded-xl flex items-center gap-2 hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all active:scale-95"><PlusCircle size={20} /><span>Launch Order</span></button>
                </div>
            )}
        </div>
      </div>

      {activeTab === 'overview' ? (
        <div className="space-y-6 animate-fade-in">
            <DashboardStats liveStockCount={liveStockCount} activeOrderCount={activeOrderCount} />
            <MasterOrderList 
              orders={orders} 
              units={units} 
              onRefresh={loadData} 
              onViewDetails={setDetailsModal} 
              onSendEmail={handleSendEmail} 
              emailLoading={emailLoading}
              isBulkMode={isBulkMode}
              selectedOrderIds={selectedOrderIds}
              onToggleSelect={(id) => setSelectedOrderIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])}
            />
        </div>
      ) : (
        <div className="bg-white p-20 rounded-2xl border border-slate-200 text-center text-slate-400 animate-fade-in"><PieChart size={48} className="mx-auto mb-4 opacity-20"/><p className="text-lg font-bold">Reporting Suite</p><p className="text-sm">Detailed production analytics and performance KPIs are currently being compiled.</p></div>
      )}

      {isBulkMode && selectedOrderIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div className="bg-slate-900 text-white rounded-full px-8 py-4 shadow-2xl flex items-center gap-6 border border-white/10">
            <div className="flex flex-col"><span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Order Actions</span><span className="text-xl font-black">{selectedOrderIds.length} Selected</span></div>
            <div className="h-10 w-px bg-white/20"></div>
            <div className="flex items-center gap-3">
              <button disabled={bulkProcessing} onClick={handleBulkReassign} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-full font-black text-sm transition-all flex items-center gap-2 shadow-lg"><Factory size={18}/> Re-assign Facility</button>
              <button disabled={bulkProcessing} onClick={handleBulkUpdateDate} className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2.5 rounded-full font-black text-sm transition-all flex items-center gap-2 shadow-lg"><Calendar size={18}/> Update Delivery Date</button>
            </div>
            {bulkProcessing && <Loader2 className="animate-spin text-white" />}
            <button onClick={() => { setSelectedOrderIds([]); setIsBulkMode(false); }} className="text-slate-400 hover:text-white transition-colors ml-2"><X/></button>
          </div>
        </div>
      )}

      <LaunchOrderModal isOpen={isLaunchModalOpen} onClose={() => setIsLaunchModalOpen(false)} units={units} onSuccess={loadData} />
      {detailsModal && <AdminOrderDetailsModal order={detailsModal} units={units} onClose={() => setDetailsModal(null)} onRefresh={loadData} />}
      {isHistoryOpen && <HistoryModal type="order" onClose={() => setIsHistoryOpen(false)} onUndoSuccess={loadData} />}
    </div>
  );
};
