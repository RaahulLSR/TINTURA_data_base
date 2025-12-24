
import React from 'react';
import { OrderLog } from '../../types';
import { X, Clock, ListTodo, MessageSquare, Send } from 'lucide-react';

interface TimelineModalProps {
  orderNo: string;
  logs: OrderLog[];
  statusUpdateText: string;
  setStatusUpdateText: (val: string) => void;
  onSubmitLog: (e: React.FormEvent) => void;
  onClose: () => void;
}

export const TimelineModal: React.FC<TimelineModalProps> = ({
  orderNo,
  logs,
  statusUpdateText,
  setStatusUpdateText,
  onSubmitLog,
  onClose
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up flex flex-col max-h-[90vh]">
        <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <Clock size={18} /> Order Timeline: {orderNo}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {logs.length === 0 ? (
            <div className="text-center text-slate-400 text-sm">No activity logs found.</div>
          ) : (
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
              {logs.map((log) => (
                <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-100 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 text-slate-500">
                    {log.log_type === 'STATUS_CHANGE' ? <ListTodo size={16} /> : <MessageSquare size={16} />}
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl border shadow-sm">
                    <div className="flex items-center justify-between space-x-2 mb-1">
                      <div className="font-bold text-slate-900 text-sm">{log.log_type.replace(/_/g, ' ')}</div>
                      <time className="font-mono text-xs text-slate-400">{new Date(log.created_at).toLocaleString()}</time>
                    </div>
                    <div className="text-slate-600 text-sm">{log.message}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-4 bg-white border-t">
          <form onSubmit={onSubmitLog} className="flex gap-2">
            <input
              type="text"
              className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none bg-white text-slate-900"
              placeholder="Type a progress update..."
              value={statusUpdateText}
              onChange={e => setStatusUpdateText(e.target.value)}
            />
            <button type="submit" disabled={!statusUpdateText.trim()} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
