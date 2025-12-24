
import React, { useState } from 'react';
import { Search, RefreshCw, Eye, Send, Loader2 } from 'lucide-react';
import { Order, Unit, formatOrderNumber } from '../../types';
import { StatusBadge } from '../Widgets';

interface MasterOrderListProps {
  orders: Order[];
  units: Unit[];
  onRefresh: () => void;
  onViewDetails: (order: Order) => void;
  onSendEmail: (orderId: string) => void;
  emailLoading: string | null;
}

export const MasterOrderList: React.FC<MasterOrderListProps> = ({ 
  orders, units, onRefresh, onViewDetails, onSendEmail, emailLoading 
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOrders = orders.filter(order => {
    const formattedNo = formatOrderNumber(order);
    return formattedNo.toLowerCase().includes(searchTerm.toLowerCase()) || 
           order.style_number.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden flex flex-col animate-fade-in">
      <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
        <h3 className="font-black text-slate-700 uppercase tracking-tight">Master Production List</h3>
        <div className="flex gap-2">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search Style or Order #..." 
              className="pl-11 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none w-72" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-4 top-3 text-slate-400" size={18} />
          </div>
          <button onClick={onRefresh} className="p-2.5 bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 rounded-xl transition-all">
            <RefreshCw size={20}/>
          </button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b">
            <tr>
              <th className="p-5">Order Reference</th>
              <th className="p-5">Style Number</th>
              <th className="p-5">Assignee</th>
              <th className="p-5">Volume</th>
              <th className="p-5">Current Status</th>
              <th className="p-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredOrders.map((order) => {
              const unitName = units.find(u => u.id === order.unit_id)?.name || 'HQ';
              const formattedOrderNo = formatOrderNumber(order);
              return (
                <tr key={order.id} className="hover:bg-slate-50/80 cursor-pointer group transition-colors" onClick={() => onViewDetails(order)}>
                  <td className="p-5 font-black text-slate-800 text-lg group-hover:text-indigo-600 transition-colors">{formattedOrderNo}</td>
                  <td className="p-5 text-slate-600 font-bold">{order.style_number}</td>
                  <td className="p-5 font-medium text-slate-500">{unitName}</td>
                  <td className="p-5 font-black text-slate-700 tabular-nums">{order.quantity}</td>
                  <td className="p-5"><StatusBadge status={order.status} /></td>
                  <td className="p-5 text-right flex justify-end gap-3" onClick={e => e.stopPropagation()}>
                    <button onClick={() => onSendEmail(order.id)} disabled={emailLoading === order.id} className="p-2 bg-white text-slate-400 hover:text-indigo-600 rounded-xl border border-slate-100 hover:border-indigo-100 transition-all shadow-sm">
                      {emailLoading === order.id ? <Loader2 size={18} className="animate-spin" /> : <Send size={18}/>}
                    </button>
                    <button onClick={() => onViewDetails(order)} className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all shadow-sm">
                      <Eye size={18}/>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredOrders.length === 0 && <div className="p-20 text-center text-slate-400">No matching orders found.</div>}
      </div>
    </div>
  );
};
