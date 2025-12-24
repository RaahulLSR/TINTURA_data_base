
import React, { useEffect, useState } from 'react';
import { fetchOrders, fetchUnits, fetchBarcodes, triggerOrderEmail } from '../services/db';
import { Order, Unit, OrderStatus, BarcodeStatus } from '../types';
import { BarChart3, PieChart, PlusCircle } from 'lucide-react';
import { DashboardStats } from '../components/admin/DashboardStats';
import { MasterOrderList } from '../components/admin/MasterOrderList';
import { LaunchOrderModal } from '../components/admin/LaunchOrderModal';
import { AdminOrderDetailsModal } from '../components/admin/AdminOrderDetailsModal';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'reports'>('overview');
  const [orders, setOrders] = useState<Order[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [liveStockCount, setLiveStockCount] = useState(0);
  const [activeOrderCount, setActiveOrderCount] = useState(0);
  const [emailLoading, setEmailLoading] = useState<string | null>(null);
  
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [detailsModal, setDetailsModal] = useState<Order | null>(null);

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

  const handleSendEmail = async (orderId: string) => {
    setEmailLoading(orderId);
    const result = await triggerOrderEmail(orderId, false);
    setEmailLoading(null);
    alert(result.message);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">
          {activeTab === 'overview' ? 'Executive Dashboard' : 'Analytics & Reports'}
        </h2>
        <div className="flex items-center gap-2">
            <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex gap-1">
                <button onClick={() => setActiveTab('overview')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><BarChart3 size={18}/> Overview</button>
                <button onClick={() => setActiveTab('reports')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'reports' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><PieChart size={18}/> Reports</button>
            </div>
            {activeTab === 'overview' && (
                <button onClick={() => setIsLaunchModalOpen(true)} className="bg-indigo-600 text-white px-5 py-3 rounded-xl flex items-center gap-2 hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all active:scale-95">
                  <PlusCircle size={20} /><span>Launch New Order</span>
                </button>
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
            />
        </div>
      ) : (
        <div className="bg-white p-20 rounded-2xl border border-slate-200 text-center text-slate-400 animate-fade-in">
           <PieChart size={48} className="mx-auto mb-4 opacity-20"/>
           <p className="text-lg font-bold">Reporting Suite</p>
           <p className="text-sm">Detailed production analytics and performance KPIs are currently being compiled.</p>
        </div>
      )}

      <LaunchOrderModal 
        isOpen={isLaunchModalOpen} 
        onClose={() => setIsLaunchModalOpen(false)} 
        units={units} 
        onSuccess={loadData} 
      />

      {detailsModal && (
        <AdminOrderDetailsModal 
          order={detailsModal} 
          units={units} 
          onClose={() => setDetailsModal(null)} 
          onRefresh={loadData} 
        />
      )}
    </div>
  );
};
