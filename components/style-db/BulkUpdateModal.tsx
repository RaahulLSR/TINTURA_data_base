
import React from 'react';
import { X, RefreshCcw, FilePlus, CheckSquare, Square, Info, Save, Loader2, Plus } from 'lucide-react';
import { Style, StyleTemplate, Attachment, ConsumptionType } from '../../types';
import { ConsumptionInput } from './ConsumptionInput';
import { uploadOrderAttachment } from '../../services/db';

interface BulkUpdateModalProps {
  styles: Style[];
  template: StyleTemplate | null;
  selectedStyleIds: string[];
  bulkUpdateMeta: {
    target: 'global' | 'color' | 'size';
    colorFilter: string[];
    sizeFilter: string[];
    strategy: 'overwrite' | 'append';
  };
  setBulkUpdateMeta: (meta: any) => void;
  bulkFieldValues: Record<string, any>;
  setBulkFieldValues: (vals: any) => void;
  isUploading: boolean;
  setIsUploading: (val: boolean) => void;
  onClose: () => void;
  onExecute: () => void;
}

export const BulkUpdateModal: React.FC<BulkUpdateModalProps> = ({ 
  styles, 
  template, 
  selectedStyleIds, 
  bulkUpdateMeta, 
  setBulkUpdateMeta, 
  bulkFieldValues, 
  setBulkFieldValues, 
  isUploading, 
  setIsUploading, 
  onClose, 
  onExecute 
}) => {
  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl overflow-hidden animate-scale-up border border-slate-200 flex flex-col max-h-[95vh]">
        <div className="p-8 border-b bg-orange-50 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-2xl font-black text-orange-900 uppercase tracking-tight">Bulk Blueprint Synchronizer</h3>
            <p className="text-orange-700 text-xs font-bold uppercase tracking-widest mt-1">Applying changes to {selectedStyleIds.length} styles</p>
          </div>
          <button onClick={onClose} className="text-orange-300 hover:text-orange-600 transition-colors p-2"><X size={32}/></button>
        </div>
        
        <div className="p-8 flex-1 overflow-y-auto space-y-8 bg-slate-50/50">
           <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Sync Mode Granularity</label>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button onClick={() => setBulkUpdateMeta({...bulkUpdateMeta, target: 'global'})} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${bulkUpdateMeta.target === 'global' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}>Apply as Global</button>
                    <button onClick={() => setBulkUpdateMeta({...bulkUpdateMeta, target: 'color'})} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${bulkUpdateMeta.target === 'color' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}>Apply Color-wise</button>
                    <button onClick={() => setBulkUpdateMeta({...bulkUpdateMeta, target: 'size'})} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${bulkUpdateMeta.target === 'size' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}>Apply Size-wise</button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Merge Strategy</label>
                  <div className="flex bg-orange-100/50 p-1 rounded-xl border border-orange-100">
                    <button onClick={() => setBulkUpdateMeta({...bulkUpdateMeta, strategy: 'overwrite'})} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${bulkUpdateMeta.strategy === 'overwrite' ? 'bg-orange-600 text-white shadow-md' : 'text-orange-500 hover:bg-orange-100'}`}>
                      <RefreshCcw size={14}/> Overwrite
                    </button>
                    <button onClick={() => setBulkUpdateMeta({...bulkUpdateMeta, strategy: 'append'})} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${bulkUpdateMeta.strategy === 'append' ? 'bg-indigo-600 text-white shadow-md' : 'text-indigo-500 hover:bg-indigo-50'}`}>
                      <FilePlus size={14}/> Append to existing
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {bulkUpdateMeta.target === 'color' && (
                  <div className="animate-fade-in">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Target Colors</label>
                    <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 rounded-2xl border">
                      {Array.from(new Set(styles.flatMap(s => s.available_colors || []))).filter(Boolean).sort().map(c => (
                        <button key={c} onClick={() => setBulkUpdateMeta((prev: any) => ({ ...prev, colorFilter: prev.colorFilter.includes(c) ? prev.colorFilter.filter((x: any) => x !== c) : [...prev.colorFilter, c] }))} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${bulkUpdateMeta.colorFilter.includes(c) ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>{c}</button>
                      ))}
                    </div>
                  </div>
                )}

                {bulkUpdateMeta.target === 'size' && (
                  <div className="animate-fade-in">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Target Sizes</label>
                    <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 rounded-2xl border">
                      {Array.from(new Set(styles.flatMap(s => s.available_sizes || []))).filter(Boolean).sort().map(s => (
                        <button key={s} onClick={() => setBulkUpdateMeta((prev: any) => ({ ...prev, sizeFilter: prev.sizeFilter.includes(s) ? prev.sizeFilter.filter((x: any) => x !== s) : [...prev.sizeFilter, s] }))} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${bulkUpdateMeta.sizeFilter.includes(s) ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>{s}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-indigo-500 bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                <Info size={16}/>
                <p className="text-[10px] font-bold uppercase tracking-tight">Only styles containing the selected color/size will be affected.</p>
              </div>
           </div>

           {template?.config.map(cat => (
             <div key={cat.name} className="space-y-4">
                <div className="flex items-center gap-3 px-4">
                  <div className="h-px flex-1 bg-slate-200"></div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{cat.name}</span>
                  <div className="h-px flex-1 bg-slate-200"></div>
                </div>
                
                <div className="grid grid-cols-1 gap-6">
                  {cat.fields.map(f => {
                    const fieldKey = `${cat.name}|${f}`;
                    const fieldData = bulkFieldValues[fieldKey];
                    if (!fieldData) return null;

                    return (
                      <div key={f} className={`bg-white rounded-3xl border transition-all duration-300 ${fieldData.isEnabled ? 'border-indigo-500 ring-4 ring-indigo-50 shadow-xl' : 'border-slate-200 opacity-60 grayscale'}`}>
                         <div className="p-6 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                               <button 
                                  onClick={() => setBulkFieldValues((prev: any) => ({ ...prev, [fieldKey]: { ...prev[fieldKey], isEnabled: !prev[fieldKey].isEnabled } }))}
                                  className={`p-2 rounded-xl transition-all ${fieldData.isEnabled ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}
                               >
                                  {fieldData.isEnabled ? <CheckSquare size={24}/> : <Square size={24}/>}
                               </button>
                               <div>
                                  <h5 className="font-black text-slate-800 uppercase tracking-tight">{f}</h5>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase">Toggle to include in sync</p>
                               </div>
                            </div>
                            {fieldData.isEnabled && (
                               <ConsumptionInput 
                                  type={fieldData.consumption_type}
                                  value={fieldData.consumption_val}
                                  onChange={(t, v) => setBulkFieldValues((prev: any) => ({ ...prev, [fieldKey]: { ...prev[fieldKey], consumption_type: t, consumption_val: v } }))}
                                  onClear={() => {
                                    const { consumption_type, consumption_val, ...rest } = fieldData;
                                    setBulkFieldValues((prev: any) => ({ ...prev, [fieldKey]: rest as any }));
                                  }}
                               />
                            )}
                         </div>

                         {fieldData.isEnabled && (
                           <div className="p-6 pt-0 space-y-6 animate-fade-in">
                              <textarea 
                                className="w-full border-2 border-slate-100 rounded-2xl p-4 h-32 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium bg-slate-50/30"
                                placeholder={bulkUpdateMeta.strategy === 'append' ? `Content to append to existing ${f.toLowerCase()}...` : `Overwrite technical instructions for ${f.toLowerCase()}...`}
                                value={fieldData.text}
                                onChange={e => setBulkFieldValues((prev: any) => ({ ...prev, [fieldKey]: { ...prev[fieldKey], text: e.target.value } }))}
                              />
                              <div className="flex items-start gap-4">
                                 <div className="flex-1">
                                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-dashed border-slate-200 rounded-xl text-[10px] font-black text-slate-400 hover:text-indigo-600 hover:border-indigo-400 cursor-pointer transition-all">
                                      <Plus size={14}/> Add Field Attachments
                                      <input 
                                        type="file" multiple className="hidden" 
                                        onChange={async (e) => {
                                          if (!e.target.files) return;
                                          setIsUploading(true);
                                          const newAtts = [];
                                          const files = Array.from(e.target.files) as File[];
                                          for (const file of files) {
                                            const url = await uploadOrderAttachment(file);
                                            if (url) newAtts.push({ name: file.name, url, type: file.type.startsWith('image/') ? 'image' : 'document' });
                                          }
                                          setBulkFieldValues((prev: any) => ({ ...prev, [fieldKey]: { ...prev[fieldKey], attachments: [...prev[fieldKey].attachments, ...newAtts] } }));
                                          setIsUploading(false);
                                        }}
                                      />
                                    </label>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                       {fieldData.attachments.map((a: Attachment, idx: number) => (
                                         <div key={idx} className="flex items-center gap-1.5 bg-indigo-50 px-2 py-1 rounded-lg text-[9px] font-black text-indigo-700 border border-indigo-100">
                                           {a.name} <button onClick={() => setBulkFieldValues((prev: any) => ({ ...prev, [fieldKey]: { ...prev[fieldKey], attachments: prev[fieldKey].attachments.filter((_: any, i: number) => i !== idx) } }))}><X size={10}/></button>
                                         </div>
                                       ))}
                                    </div>
                                 </div>
                              </div>
                           </div>
                         )}
                      </div>
                    );
                  })}
                </div>
             </div>
           ))}
        </div>

        <div className="p-8 border-t bg-white flex justify-between items-center shadow-2xl shrink-0">
          <button type="button" onClick={onClose} className="px-10 py-4 font-black text-slate-400 hover:text-slate-600 uppercase text-xs">Cancel</button>
          <button 
            onClick={onExecute} 
            disabled={isUploading || (bulkUpdateMeta.target === 'color' && bulkUpdateMeta.colorFilter.length === 0) || (bulkUpdateMeta.target === 'size' && bulkUpdateMeta.sizeFilter.length === 0)}
            className="px-12 py-4 bg-orange-600 text-white rounded-2xl font-black shadow-2xl shadow-orange-200 flex items-center gap-3 active:scale-95 disabled:opacity-50 uppercase text-xs"
          >
            {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20}/>} Sync Selected Blueprint Fields
          </button>
        </div>
      </div>
    </div>
  );
};
