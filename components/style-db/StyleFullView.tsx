
import React from 'react';
import { ArrowLeft, Edit3, Printer, Layers, Palette, Ruler, ImageIcon, Calculator } from 'lucide-react';
import { Style, StyleTemplate } from '../../types';
import { AttachmentGallery } from './AttachmentGallery';

interface StyleFullViewProps {
  style: Style;
  template: StyleTemplate | null;
  onBack: () => void;
  onPrint: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const StyleFullView: React.FC<StyleFullViewProps> = ({ style, template, onBack, onPrint, onEdit, onDelete }) => {
  return (
    <div className="bg-white min-h-screen animate-fade-in -m-8 p-8">
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 -mx-8 px-8 py-4 flex items-center justify-between mb-8">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="p-2.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all flex items-center gap-2 font-bold"><ArrowLeft size={20}/> Catalog</button>
          <div className="h-6 w-px bg-slate-200"></div>
          <div><h1 className="text-2xl font-black text-slate-900 tracking-tight">{style.style_number}</h1><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{style.category} • {style.garment_type} ({style.demographic})</p></div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onDelete} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Delete Blueprint"><Trash2 size={22}/></button>
          <button onClick={onEdit} className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-bold transition-all"><Edit3 size={18}/> Edit Blueprint</button>
          <button onClick={onPrint} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-black shadow-lg shadow-indigo-100 transition-all"><Printer size={18}/> Generate Tech-Pack PDF</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2"><Palette size={12}/> Colors</label><div className="flex flex-wrap gap-2 mt-3">{style.available_colors?.filter(c => c).map((c, i) => (<span key={i} className="px-3 py-1 bg-white border border-slate-200 text-xs font-bold rounded-lg text-slate-700 shadow-sm">{c}</span>)) || <span className="text-xs text-slate-300 italic">None</span>}</div></div>
          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2"><Ruler size={12}/> Sizes</label><div className="flex flex-wrap gap-2 mt-3">{style.available_sizes?.map((s, i) => (<span key={i} className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-sm">{s}</span>)) || <span className="text-xs text-slate-300 italic">None</span>}</div><div className="mt-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Type: {style.size_type}</div></div>
          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2"><ImageIcon size={12}/> Packing</label><div className="mt-3"><div className="text-lg font-black text-slate-800 capitalize">{style.packing_type}</div><div className="text-sm font-bold text-slate-500">{style.pcs_per_box} Pcs/Box</div></div></div>
          <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100"><label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Summary</label><p className="mt-2 text-sm font-medium text-slate-700 leading-relaxed italic">{style.style_text || 'No technical notes.'}</p></div>
        </div>

        <div className="space-y-20">
          {template?.config.filter(c => c.name !== "General Info").map((cat, i) => (
            <section key={i} className="animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="flex items-center gap-4 mb-10"><div className="h-px flex-1 bg-slate-100"></div><h2 className="text-sm font-black text-indigo-500 uppercase tracking-[0.4em] flex items-center gap-3"><Layers size={18}/> {cat.name}</h2><div className="h-px flex-1 bg-slate-100"></div></div>
              <div className="grid grid-cols-1 gap-16">
                {cat.fields.map(field => {
                  const data = style.tech_pack[cat.name]?.[field] || { text: 'N/A', attachments: [] };
                  const isSplit = !!data.variants;
                  return (
                    <div key={field} className="space-y-6">
                      <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3">
                        <div className="flex items-center gap-3">
                          <h3 className="font-black text-slate-900 uppercase text-lg tracking-tight">{field}</h3>
                          {isSplit && <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase">Variant Matrix</span>}
                        </div>
                        {!isSplit && data.consumption_type && (
                          <div className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-2">
                             <Calculator size={14}/> {data.consumption_val} {data.consumption_type === 'items_per_pc' ? 'Items / PC' : 'PCS / Item'}
                          </div>
                        )}
                      </div>
                      {!isSplit ? (
                        <div className="space-y-4 max-w-4xl"><div className="text-slate-700 text-xl font-medium leading-relaxed bg-slate-50 p-6 rounded-3xl border border-slate-100 whitespace-pre-wrap">{data.text || <span className="opacity-30 italic">No global notes</span>}</div>{data.attachments.length > 0 && <AttachmentGallery attachments={data.attachments}/>}</div>
                      ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                           {data.variants?.map((v, idx) => (
                             <div key={idx} className="bg-slate-50/50 border-2 border-indigo-100 rounded-[2.5rem] p-8 space-y-6 shadow-sm">
                                <div className="flex items-center justify-between">
                                  <div className="flex flex-wrap gap-2">{v.colors.length > 0 ? v.colors.map(c => (<span key={c} className="bg-indigo-600 text-white text-[11px] font-black px-4 py-1.5 rounded-full uppercase tracking-tighter shadow-md">{c}</span>)) : <span className="text-[11px] font-black text-slate-400 italic bg-white px-4 py-1.5 rounded-full border">Shared Variant</span>}</div>
                                  {!v.sizeVariants && v.consumption_type && (
                                    <div className="px-3 py-1 bg-white border border-indigo-200 text-indigo-700 rounded-lg text-[10px] font-black shadow-sm">
                                      {v.consumption_val} {v.consumption_type === 'items_per_pc' ? 'Items / PC' : 'PCS / Item'}
                                    </div>
                                  )}
                                </div>
                                {!v.sizeVariants ? (
                                  <div className="space-y-4"><div className="text-slate-800 text-xl font-black whitespace-pre-wrap leading-relaxed">{v.text || <span className="opacity-30 italic">No notes</span>}</div>{v.attachments.length > 0 && <AttachmentGallery attachments={v.attachments}/>}</div>
                                ) : (
                                  <div className="space-y-8 pt-6 border-t border-indigo-100">
                                    <h6 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-4">Grouped Size Breakdown</h6>
                                    <div className="grid grid-cols-1 gap-6">
                                       {v.sizeVariants.map((sv, sIdx) => (
                                         <div key={sIdx} className="bg-white p-6 rounded-3xl border border-blue-100 shadow-sm space-y-4">
                                            <div className="flex items-center justify-between">
                                              <div className="flex flex-wrap gap-2">
                                                {sv.sizes.map(sz => (
                                                  <div key={sz} className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center justify-center font-black text-lg shadow-lg shadow-blue-200">{sz}</div>
                                                ))}
                                                {sv.sizes.length === 0 && <span className="text-xs text-slate-300 italic">No sizes selected</span>}
                                              </div>
                                              {sv.consumption_type && (
                                                <div className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-black border border-blue-100">
                                                  {sv.consumption_val} {sv.consumption_type === 'items_per_pc' ? 'Items / PC' : 'PCS / Item'}
                                                </div>
                                              )}
                                            </div>
                                            <div className="text-slate-900 text-2xl font-black leading-tight">{sv.text || <span className="opacity-20 italic font-normal">No instructions</span>}</div>
                                            {sv.attachments.length > 0 && <AttachmentGallery attachments={sv.attachments}/>}
                                         </div>
                                       ))}
                                    </div>
                                  </div>
                                )}
                             </div>
                           ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        
        <div className="pt-20 pb-10 text-center"><div className="inline-flex items-center gap-2 px-6 py-2 bg-slate-100 rounded-full border border-slate-200 mb-4"><Layers size={14} className="text-indigo-600"/><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Blueprint # {style.id.slice(0, 8)}</span></div><p className="text-xs text-slate-400">Tintura Technical Blueprint - Manufacturing Copy</p></div>
      </div>
    </div>
  );
};

import { Trash2 } from 'lucide-react';
