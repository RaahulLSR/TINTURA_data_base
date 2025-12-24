
import React, { useEffect, useState } from 'react';
import { fetchStyles, upsertStyle, fetchStyleTemplate, updateStyleTemplate, deleteStyle, uploadOrderAttachment } from '../services/db';
import { Style, StyleTemplate, StyleCategory, TechPackItem, Attachment, TechPackVariant, TechPackSizeVariant, ConsumptionType } from '../types';
import { 
  Plus, Search, Grid, Copy, Trash2, Save, Printer, Edit3, X, Image as ImageIcon, FileText, Settings, ArrowLeftRight, Loader2, Download, Layers, BookOpen, Palette, Ruler, ChevronDown, ChevronUp, ChevronRight, Info, ArrowLeft, ExternalLink, Split, Scan, Calculator
} from 'lucide-react';

// --- Sub-components ---

interface ConsumptionInputProps {
  type?: ConsumptionType;
  value?: number;
  onChange: (type: ConsumptionType, val: number) => void;
  onClear: () => void;
}

const ConsumptionInput: React.FC<ConsumptionInputProps> = ({ type, value, onChange, onClear }) => {
  if (!type) {
    return (
      <button 
        type="button" 
        onClick={() => onChange('items_per_pc', 1)}
        className="text-[9px] font-black text-indigo-500 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-all flex items-center gap-1.5"
      >
        <Calculator size={12}/> Set Ratio
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 animate-fade-in">
      <div className="flex bg-slate-200 p-0.5 rounded-lg border border-slate-300">
        <button 
          type="button" 
          onClick={() => onChange('items_per_pc', value || 0)}
          className={`px-2 py-1 rounded-md text-[8px] font-black uppercase transition-all ${type === 'items_per_pc' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
        >
          Items / PC
        </button>
        <button 
          type="button" 
          onClick={() => onChange('pcs_per_item', value || 0)}
          className={`px-2 py-1 rounded-md text-[8px] font-black uppercase transition-all ${type === 'pcs_per_item' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
        >
          PCS / Item
        </button>
      </div>
      <input 
        type="number" 
        step="any"
        className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-xs font-black text-indigo-700 bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
        value={value || ''}
        onChange={e => onChange(type, parseFloat(e.target.value) || 0)}
        placeholder="Value"
      />
      <button type="button" onClick={onClear} className="text-slate-300 hover:text-red-500 transition-colors">
        <X size={14}/>
      </button>
    </div>
  );
};

interface CategoryEditorProps {
  category: StyleCategory;
  isEditing: Style | null;
  setIsEditing: (style: Style | null) => void;
  handleFileUpload: (category: string, field: string, files: FileList | null, variantIndex?: number, sizeIndex?: number) => void;
}

const CategoryEditor: React.FC<CategoryEditorProps> = ({ 
  category, 
  isEditing, 
  setIsEditing, 
  handleFileUpload 
}) => {
  if (!isEditing) return null;
  
  const isPackingReq = category.name.toLowerCase().includes('packing');
  const isPreProduction = category.name.toLowerCase().includes('pre production');
  const availableColors = (isEditing.available_colors || []).filter(c => c.trim() !== '');
  const availableSizes = (isEditing.available_sizes || []).filter(s => s.trim() !== '');

  const handleSplitColor = (fieldName: string) => {
    const updated = { ...isEditing };
    if (!updated.tech_pack[category.name]) updated.tech_pack[category.name] = {};
    const current = updated.tech_pack[category.name][fieldName] || { text: '', attachments: [] };
    
    if (!current.variants) {
      current.variants = [{ colors: [], text: current.text, attachments: current.attachments, consumption_type: current.consumption_type, consumption_val: current.consumption_val }];
    } else {
      current.variants.push({ colors: [], text: '', attachments: [] });
    }
    
    updated.tech_pack[category.name][fieldName] = current;
    setIsEditing(updated);
  };

  const handleAddSizeGroup = (fieldName: string, vIdx: number) => {
    const updated = { ...isEditing };
    const variant = updated.tech_pack[category.name][fieldName].variants![vIdx];
    
    if (!variant.sizeVariants) {
      variant.sizeVariants = [{ sizes: [], text: '', attachments: [], consumption_type: variant.consumption_type, consumption_val: variant.consumption_val }];
    } else {
      variant.sizeVariants.push({ sizes: [], text: '', attachments: [] });
    }
    
    setIsEditing(updated);
  };

  const handleUnsplit = (fieldName: string) => {
    if (!confirm("Merge all variants into one global instruction?")) return;
    const updated = { ...isEditing };
    const current = updated.tech_pack[category.name][fieldName];
    if (current && current.variants) {
      current.text = current.variants[0].text;
      current.attachments = current.variants[0].attachments;
      current.consumption_type = current.variants[0].consumption_type;
      current.consumption_val = current.variants[0].consumption_val;
      delete current.variants;
    }
    setIsEditing(updated);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm mb-6">
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={18} className="text-indigo-600"/>
          <h4 className="font-black text-slate-700 text-xs uppercase tracking-widest">{category.name}</h4>
        </div>
      </div>
      
      <div className="p-6 space-y-8">
        {isPreProduction && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 bg-slate-50/50 rounded-2xl border border-slate-100 shadow-inner mb-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <Palette size={16} className="text-indigo-600"/>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Blueprint Colours</label>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {(isEditing.available_colors || ['']).map((color, idx) => (
                  <div key={idx} className="flex gap-2 group">
                    <input className="flex-1 border-2 border-slate-200 rounded-xl p-3 bg-white text-slate-900 font-bold focus:border-indigo-500 outline-none transition-all text-sm" placeholder="Type colour..." value={color} onChange={e => { const newCols = [...(isEditing.available_colors || [])]; newCols[idx] = e.target.value; setIsEditing({...isEditing, available_colors: newCols}); }} />
                    <button type="button" onClick={() => { const newCols = (isEditing.available_colors || []).filter((_, i) => i !== idx); setIsEditing({...isEditing, available_colors: newCols.length > 0 ? newCols : ['']}); }} className="p-3 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setIsEditing({...isEditing, available_colors: [...(isEditing.available_colors || []), '']})} className="w-full mt-4 py-2.5 border-2 border-dashed border-indigo-200 text-indigo-600 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-white flex items-center justify-center gap-2"><Plus size={14}/> Add Colour Row</button>
            </div>
            <div className="flex flex-col">
              <div className="flex justify-between items-center mb-4"><div className="flex items-center gap-2"><Ruler size={16} className="text-indigo-600"/><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Size variants</label></div><div className="flex bg-slate-200 p-1 rounded-lg"><button type="button" onClick={() => setIsEditing({...isEditing, size_type: 'letter', available_sizes: ['S', 'M', 'L', 'XL', 'XXL', '3XL']})} className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${isEditing.size_type === 'letter' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>ABC</button><button type="button" onClick={() => setIsEditing({...isEditing, size_type: 'number', available_sizes: ['65', '70', '75', '80', '85', '90']})} className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${isEditing.size_type === 'number' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>123</button></div></div>
              <div className="flex-1 flex flex-wrap content-start gap-2 p-3 bg-white rounded-xl border border-slate-200 min-h-[100px]">{isEditing.available_sizes?.map((sz, idx) => (<div key={idx} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-2 shadow-sm">{sz}<button type="button" onClick={() => { const newSizes = isEditing.available_sizes?.filter((_, i) => i !== idx); setIsEditing({...isEditing, available_sizes: newSizes}); }} className="text-white/50 hover:text-white transition-colors"><X size={12}/></button></div>))}</div>
              <button type="button" onClick={() => { const newVal = prompt(`Enter new size:`); if (newVal) setIsEditing({...isEditing, available_sizes: [...(isEditing.available_sizes || []), newVal]}); }} className="w-full mt-4 py-2.5 border-2 border-dashed border-indigo-200 text-indigo-600 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-white flex items-center justify-center gap-2"><Plus size={14}/> Add custom size</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-12">
          {isPackingReq && (
            <>
              <div className="space-y-3"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Type of Packing</label><select className="w-full border-2 border-slate-100 rounded-xl p-4 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer" value={isEditing.packing_type} onChange={e => setIsEditing({...isEditing, packing_type: e.target.value})}><option value="pouch">Pouch</option><option value="cover">Cover</option><option value="box">Box</option></select></div>
              <div className="space-y-3"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">No of pieces / Box</label><input type="number" className="w-full border-2 border-slate-100 rounded-xl p-4 bg-white text-slate-900 font-black focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" value={isEditing.pcs_per_box} onChange={e => setIsEditing({...isEditing, pcs_per_box: parseInt(e.target.value) || 0})}/></div>
            </>
          )}

          {category.fields.map(field => {
            const item = isEditing.tech_pack[category.name]?.[field] || { text: '', attachments: [] };
            const isSplit = !!item.variants;

            return (
              <div key={field} className="space-y-4 col-span-full bg-slate-50/30 p-6 rounded-3xl border border-slate-100">
                <div className="flex justify-between items-center px-1">
                  <div className="flex items-center gap-3">
                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest">{field}</label>
                    {!isSplit && (
                      <ConsumptionInput 
                        type={item.consumption_type} 
                        value={item.consumption_val} 
                        onChange={(t, v) => {
                          const updated = { ...isEditing };
                          if (!updated.tech_pack[category.name]) updated.tech_pack[category.name] = {};
                          updated.tech_pack[category.name][field] = { ...item, consumption_type: t, consumption_val: v };
                          setIsEditing(updated);
                        }}
                        onClear={() => {
                          const updated = { ...isEditing };
                          delete updated.tech_pack[category.name][field].consumption_type;
                          delete updated.tech_pack[category.name][field].consumption_val;
                          setIsEditing(updated);
                        }}
                      />
                    )}
                  </div>
                  {!isSplit ? (
                    <button type="button" onClick={() => handleSplitColor(field)} className="text-[10px] font-black text-indigo-600 bg-white hover:bg-indigo-50 px-4 py-2 rounded-full flex items-center gap-2 border border-indigo-100 transition-all shadow-sm"><Split size={14}/> Split Color-wise</button>
                  ) : (
                    <button type="button" onClick={() => handleUnsplit(field)} className="text-[10px] font-black text-slate-500 bg-white hover:bg-slate-100 px-4 py-2 rounded-full flex items-center gap-2 border border-slate-200 transition-all shadow-sm"><X size={14}/> Merge Global</button>
                  )}
                </div>

                {!isSplit ? (
                  <div className="space-y-3 animate-fade-in">
                    <textarea className="w-full border-2 border-slate-100 rounded-2xl p-5 text-sm font-medium focus:border-indigo-500 outline-none min-h-[100px] bg-white transition-all text-black" value={item.text} placeholder={`Global technical instructions for ${field.toLowerCase()}...`} onChange={e => { const updated = { ...isEditing }; if (!updated.tech_pack[category.name]) updated.tech_pack[category.name] = {}; updated.tech_pack[category.name][field] = { ...item, text: e.target.value }; setIsEditing(updated); }} />
                    <div className="flex flex-wrap gap-2">{item.attachments.map((att, idx) => (<div key={idx} className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-700"> {att.type === 'image' ? <ImageIcon size={14}/> : <FileText size={14}/>} <span className="truncate max-w-[100px]">{att.name}</span><button type="button" onClick={() => { const updated = { ...isEditing }; updated.tech_pack[category.name][field].attachments.splice(idx, 1); setIsEditing(updated); }} className="hover:text-red-500"><X size={14}/></button></div>))} <label className="bg-white border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2"><Plus size={14}/> Add Attachment <input type="file" multiple className="hidden" onChange={e => handleFileUpload(category.name, field, e.target.files)}/></label></div>
                  </div>
                ) : (
                  <div className="space-y-8 animate-fade-in">
                    {item.variants?.map((variant, vIdx) => (
                      <div key={vIdx} className="bg-white border-2 border-indigo-100 rounded-3xl p-6 shadow-sm relative group">
                        <button type="button" onClick={() => { const updated = { ...isEditing }; updated.tech_pack[category.name][field].variants?.splice(vIdx, 1); setIsEditing(updated); }} className="absolute -top-3 -right-3 bg-red-500 text-white p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"><X size={16}/></button>
                        
                        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest">Target Color Group</label>
                              {!variant.sizeVariants && (
                                <ConsumptionInput 
                                  type={variant.consumption_type} 
                                  value={variant.consumption_val} 
                                  onChange={(t, v) => {
                                    const updated = { ...isEditing };
                                    updated.tech_pack[category.name][field].variants![vIdx] = { ...variant, consumption_type: t, consumption_val: v };
                                    setIsEditing(updated);
                                  }}
                                  onClear={() => {
                                    const updated = { ...isEditing };
                                    delete updated.tech_pack[category.name][field].variants![vIdx].consumption_type;
                                    delete updated.tech_pack[category.name][field].variants![vIdx].consumption_val;
                                    setIsEditing(updated);
                                  }}
                                />
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">{availableColors.map(color => { const isSelected = variant.colors.includes(color); return (<button type="button" key={color} onClick={() => { const updated = { ...isEditing }; const v = updated.tech_pack[category.name][field].variants![vIdx]; if (isSelected) v.colors = v.colors.filter(c => c !== color); else v.colors.push(color); setIsEditing(updated); }} className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${isSelected ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>{color}</button>); })} {availableColors.length === 0 && <span className="text-[10px] text-slate-300 italic">No colors defined at top</span>}</div>
                          </div>
                          {!variant.sizeVariants && (
                            <button type="button" onClick={() => handleAddSizeGroup(field, vIdx)} className="text-[10px] font-black text-blue-600 bg-blue-50 px-4 py-2 rounded-full border border-blue-100 flex items-center gap-2 hover:bg-blue-100 transition-all shadow-sm"><Scan size={14}/> Split by Size Group</button>
                          )}
                        </div>

                        {!variant.sizeVariants ? (
                          <div className="space-y-4">
                            <textarea className="w-full border border-slate-100 rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none min-h-[80px] bg-slate-50/50 transition-all text-black" value={variant.text} placeholder="Instructions for these colors..." onChange={e => { const updated = { ...isEditing }; updated.tech_pack[category.name][field].variants![vIdx].text = e.target.value; setIsEditing(updated); }} />
                            <div className="flex flex-wrap gap-2">{variant.attachments.map((att, attIdx) => (<div key={attIdx} className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-lg text-[10px] font-bold text-indigo-700"><span>{att.name}</span><button type="button" onClick={() => { const updated = { ...isEditing }; updated.tech_pack[category.name][field].variants![vIdx].attachments.splice(attIdx, 1); setIsEditing(updated); }} className="hover:text-red-500"><X size={12}/></button></div>))}<label className="bg-white border border-dashed border-slate-200 hover:border-indigo-400 text-slate-400 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all cursor-pointer flex items-center gap-2"><Plus size={12}/> File <input type="file" multiple className="hidden" onChange={e => handleFileUpload(category.name, field, e.target.files, vIdx)}/></label></div>
                          </div>
                        ) : (
                          <div className="space-y-6 border-l-4 border-blue-200 pl-6 py-2 animate-fade-in">
                             <div className="flex justify-between items-center mb-2"><h5 className="text-[11px] font-black text-blue-500 uppercase tracking-widest">Nested Size Groups</h5><button type="button" onClick={() => { if(confirm("Discard all size splits?")) { const updated = { ...isEditing }; delete updated.tech_pack[category.name][field].variants![vIdx].sizeVariants; setIsEditing(updated); } }} className="text-[9px] font-black text-slate-400 uppercase hover:text-red-500 transition-colors">Discard Splits</button></div>
                             
                             {variant.sizeVariants.map((sv, svIdx) => (
                               <div key={svIdx} className="p-5 bg-blue-50/30 rounded-3xl border border-blue-100 space-y-4 relative group/size">
                                 <button type="button" onClick={() => { const updated = { ...isEditing }; updated.tech_pack[category.name][field].variants![vIdx].sizeVariants?.splice(svIdx, 1); setIsEditing(updated); }} className="absolute -top-2 -right-2 bg-white text-red-400 p-1.5 rounded-full shadow border border-red-50 opacity-0 group-hover/size:opacity-100 transition-opacity"><Trash2 size={12}/></button>
                                 
                                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                   <div>
                                     <label className="block text-[9px] font-black text-blue-400 uppercase mb-2 tracking-widest">Apply to Sizes</label>
                                     <div className="flex flex-wrap gap-1.5">
                                       {availableSizes.map(sz => {
                                         const isSzSelected = sv.sizes.includes(sz);
                                         return (
                                           <button
                                             type="button"
                                             key={sz}
                                             onClick={() => {
                                               const updated = { ...isEditing };
                                               const sVar = updated.tech_pack[category.name][field].variants![vIdx].sizeVariants![svIdx];
                                               if (isSzSelected) sVar.sizes = sVar.sizes.filter(s => s !== sz);
                                               else sVar.sizes.push(sz);
                                               setIsEditing(updated);
                                             }}
                                             className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${isSzSelected ? 'bg-blue-600 text-white' : 'bg-white text-blue-300 border border-blue-50 hover:bg-blue-50'}`}
                                           >
                                             {sz}
                                           </button>
                                         );
                                       })}
                                     </div>
                                   </div>
                                   <ConsumptionInput 
                                    type={sv.consumption_type} 
                                    value={sv.consumption_val} 
                                    onChange={(t, v) => {
                                      const updated = { ...isEditing };
                                      updated.tech_pack[category.name][field].variants![vIdx].sizeVariants![svIdx] = { ...sv, consumption_type: t, consumption_val: v };
                                      setIsEditing(updated);
                                    }}
                                    onClear={() => {
                                      const updated = { ...isEditing };
                                      delete updated.tech_pack[category.name][field].variants![vIdx].sizeVariants![svIdx].consumption_type;
                                      delete updated.tech_pack[category.name][field].variants![vIdx].sizeVariants![svIdx].consumption_val;
                                      setIsEditing(updated);
                                    }}
                                  />
                                 </div>

                                 <textarea className="w-full border-2 border-white rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none bg-white min-h-[70px] text-black transition-all" value={sv.text} placeholder={`Specific instructions for the selected sizes...`} onChange={e => { const updated = { ...isEditing }; updated.tech_pack[category.name][field].variants![vIdx].sizeVariants![svIdx].text = e.target.value; setIsEditing(updated); }}/>
                                 
                                 <div className="flex flex-wrap gap-2">
                                    {sv.attachments.map((att, attIdx) => (<div key={attIdx} className="flex items-center gap-2 bg-white border border-blue-50 px-2 py-1 rounded-lg text-[9px] font-bold text-blue-700"><span>{att.name}</span><button type="button" onClick={() => { const updated = { ...isEditing }; updated.tech_pack[category.name][field].variants![vIdx].sizeVariants![svIdx].attachments.splice(attIdx, 1); setIsEditing(updated); }} className="text-red-400"><X size={10}/></button></div>))}
                                    <label className="bg-white border-2 border-dashed border-blue-100 hover:border-blue-400 text-blue-300 px-3 py-1 rounded-xl text-[9px] font-black cursor-pointer flex items-center gap-2"><Plus size={12}/> File <input type="file" multiple className="hidden" onChange={e => handleFileUpload(category.name, field, e.target.files, vIdx, svIdx)}/></label>
                                 </div>
                               </div>
                             ))}
                             
                             <button type="button" onClick={() => handleAddSizeGroup(field, vIdx)} className="w-full py-3 border-2 border-dashed border-blue-100 text-blue-300 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-blue-50 hover:text-blue-500 transition-all">+ Add Nested Size Group</button>
                          </div>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => handleSplitColor(field)} className="w-full py-5 border-4 border-dashed border-slate-100 text-slate-300 text-[11px] font-black uppercase tracking-[0.2em] rounded-3xl hover:border-indigo-200 hover:text-indigo-400 transition-all">+ Add Color Variant Group</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const StyleFullView: React.FC<{ style: Style, template: StyleTemplate | null, onBack: () => void, onPrint: () => void, onEdit: () => void }> = ({ style, template, onBack, onPrint, onEdit }) => {
  return (
    <div className="bg-white min-h-screen animate-fade-in -m-8 p-8">
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 -mx-8 px-8 py-4 flex items-center justify-between mb-8">
        <div className="flex items-center gap-6"><button onClick={onBack} className="p-2.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all flex items-center gap-2 font-bold"><ArrowLeft size={20}/> Catalog</button><div className="h-6 w-px bg-slate-200"></div><div><h1 className="text-2xl font-black text-slate-900 tracking-tight">{style.style_number}</h1><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{style.category} • {style.garment_type} ({style.demographic})</p></div></div>
        <div className="flex items-center gap-3"><button onClick={onEdit} className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-bold transition-all"><Edit3 size={18}/> Edit Blueprint</button><button onClick={onPrint} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-black shadow-lg shadow-indigo-100 transition-all"><Printer size={18}/> Generate Tech-Pack PDF</button></div>
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

const AttachmentGallery: React.FC<{ attachments: Attachment[] }> = ({ attachments }) => {
  const images = attachments.filter(a => a.type === 'image');
  const docs = attachments.filter(a => a.type === 'document');
  return (
    <div className="space-y-3">
      {images.length > 0 && (<div className="grid grid-cols-2 gap-2">{images.map((img, idx) => (<a key={idx} href={img.url} target="_blank" rel="noreferrer" className="relative group/img aspect-video rounded-2xl overflow-hidden border border-slate-200 shadow-sm block bg-slate-100"><img src={img.url} className="w-full h-full object-cover transition-transform group-hover/img:scale-110"/><div className="absolute inset-0 bg-indigo-900/60 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity"><ExternalLink size={24} className="text-white"/></div></a>))}</div>)}
      {docs.length > 0 && (<div className="space-y-2">{docs.map((doc, idx) => (<a key={idx} href={doc.url} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-400 transition-all"><div className="flex items-center gap-2 truncate pr-4"><FileText size={16} className="text-indigo-500"/><span className="text-xs font-bold text-slate-700 truncate">{doc.name}</span></div><Download size={16} className="text-slate-400"/></a>))}</div>)}
    </div>
  );
}

// --- Main Component ---

export const StyleDatabase: React.FC = () => {
  const [styles, setStyles] = useState<Style[]>([]);
  const [template, setTemplate] = useState<StyleTemplate | null>(null);
  const [viewMode, setViewMode] = useState<'catalog' | 'compare'>('catalog');
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState<Style | null>(null);
  const [viewingStyle, setViewingStyle] = useState<Style | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [compareList, setCompareList] = useState<Style[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [garmentTypeOptions, setGarmentTypeOptions] = useState(['Pant', 'Trackpant', 'Shorts', 'T-shirt']);
  const [demographicOptions, setDemographicOptions] = useState(['Men', 'Boys']);

  const loadData = async () => {
    const [s, t] = await Promise.all([fetchStyles(), fetchStyleTemplate()]);
    setStyles(s);
    setTemplate(t);
    const existingGarments = Array.from(new Set([...garmentTypeOptions, ...s.map(style => style.garment_type).filter(Boolean) as string[]]));
    const existingDemos = Array.from(new Set([...demographicOptions, ...s.map(style => style.demographic).filter(Boolean) as string[]]));
    setGarmentTypeOptions(existingGarments);
    setDemographicOptions(existingDemos);
  };

  useEffect(() => { loadData(); }, []);

  const filteredStyles = styles.filter(s => s.style_number.toLowerCase().includes(searchTerm.toLowerCase()) || s.category.toLowerCase().includes(searchTerm.toLowerCase()) || (s.garment_type && s.garment_type.toLowerCase().includes(searchTerm.toLowerCase())));

  const handleSaveStyle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing) return;
    setIsUploading(true);
    const payload: Partial<Style> = { ...isEditing };
    if (!payload.id || payload.id === "") delete payload.id;
    const { error } = await upsertStyle(payload);
    setIsUploading(false);
    if (!error) { setIsEditing(null); loadData(); } else { alert(error); }
  };

  const handleCopyFrom = (sourceStyleId: string) => {
    const source = styles.find(s => s.id === sourceStyleId);
    if (!source || !isEditing) return;
    if (confirm(`Overwrite data from ${source.style_number}?`)) {
      setIsEditing({ ...isEditing, tech_pack: JSON.parse(JSON.stringify(source.tech_pack)), category: source.category, packing_type: source.packing_type, pcs_per_box: source.pcs_per_box, style_text: source.style_text, garment_type: source.garment_type, demographic: source.demographic, available_colors: source.available_colors ? [...source.available_colors] : [], available_sizes: source.available_sizes ? [...source.available_sizes] : [], size_type: source.size_type });
    }
  };

  const handleDelete = async (id: string) => { if (confirm("Permanently delete this style?")) { await deleteStyle(id); loadData(); } };

  const handleFileUpload = async (category: string, field: string, files: FileList | null, vIdx?: number, svIdx?: number) => {
    if (!files || !isEditing) return;
    setIsUploading(true);
    const updated = { ...isEditing };
    if (!updated.tech_pack[category]) updated.tech_pack[category] = {};
    if (!updated.tech_pack[category][field]) updated.tech_pack[category][field] = { text: '', attachments: [] };
    
    let target: Attachment[];
    if (vIdx !== undefined) {
      const variant = updated.tech_pack[category][field].variants![vIdx];
      if (svIdx !== undefined) target = variant.sizeVariants![svIdx].attachments;
      else target = variant.attachments;
    } else {
      target = updated.tech_pack[category][field].attachments;
    }

    for (const file of Array.from(files)) {
      const url = await uploadOrderAttachment(file);
      if (url) target.push({ name: file.name, url, type: file.type.startsWith('image/') ? 'image' : 'document' });
    }
    setIsEditing(updated);
    setIsUploading(false);
  };

  const handlePrint = (style: Style) => {
    const win = window.open('', 'TechPack', 'width=1200,height=900');
    if (!win) return;
    
    const categoriesHtml = template?.config.filter(c => c.name !== "General Info").map(cat => {
      const isPreProd = cat.name.toLowerCase().includes('pre production');
      const variantMetaHtml = isPreProd ? `<div style="background:#f1f5f9; padding:25px; border-radius:12px; margin-bottom:30px; display:grid; grid-template-columns:1fr 1fr; gap:30px; border:2px solid #e2e8f0;"><div><span style="font-size:12px; font-weight:900; color:#64748b; text-transform:uppercase; letter-spacing:1px;">Blueprint Colours</span><br/><strong style="font-size:20px; color:#1e293b;">${style.available_colors?.join(', ') || '---'}</strong></div><div><span style="font-size:12px; font-weight:900; color:#64748b; text-transform:uppercase; letter-spacing:1px;">Size Format</span><br/><strong style="font-size:20px; color:#1e293b;">${style.available_sizes?.join(', ') || '---'} (${style.size_type})</strong></div></div>` : '';

      const fields = cat.fields.map(f => {
        const item = style.tech_pack[cat.name]?.[f] || { text: 'N/A', attachments: [] };
        let contentHtml = '';
        
        if (item.variants) {
          contentHtml = item.variants.map(v => {
            let sizeHtml = '';
            if (v.sizeVariants) {
              sizeHtml = `<div style="margin-top:20px; display:grid; grid-template-columns:1fr; gap:15px;">${v.sizeVariants.map(sv => `
                <div style="background:#fff; border:1px solid #e2e8f0; border-left:8px solid #2563eb; padding:25px; border-radius:15px;">
                  <div style="margin-bottom:15px; display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center;">
                    <div style="display:flex; flex-wrap:wrap; gap:8px;">
                      ${sv.sizes.map(sz => `<span style="background:#2563eb; color:#fff; display:inline-block; padding:6px 14px; border-radius:8px; font-weight:900; font-size:20px;">SIZE: ${sz}</span>`).join('')}
                    </div>
                    ${sv.consumption_type ? `<div style="background:#f1f5f9; color:#2563eb; padding:5px 15px; border-radius:8px; font-weight:900; font-size:18px; border:2px solid #2563eb;">${sv.consumption_val} ${sv.consumption_type === 'items_per_pc' ? 'ITEMS / PC' : 'PCS / ITEM'}</div>` : ''}
                  </div>
                  <div style="font-size:24px; font-weight:900; color:#1e293b; line-height:1.4;">${sv.text || '---'}</div>
                  <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:20px;">
                    ${sv.attachments.filter(a => a.type === 'image').map(img => `<img src="${img.url}" style="width:100%; border-radius:12px; border:2px solid #eee;" />`).join('')}
                  </div>
                </div>
              `).join('')}</div>`;
            }
            return `<div style="border:3px solid #e2e8f0; padding:30px; border-radius:24px; margin-top:30px; background:#f8fafc; break-inside:avoid;">
               <div style="margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;">
                 <div style="display:flex; flex-wrap:wrap; gap:8px;">
                    ${v.colors.map(c => `<span style="background:#1e293b; color:#fff; font-size:11px; font-weight:900; padding:6px 14px; border-radius:8px; text-transform:uppercase; letter-spacing:1px;">${c}</span>`).join('')} 
                    ${v.colors.length === 0 ? '<span style="font-style:italic; font-size:14px; color:#64748b;">Global Variant</span>' : ''}
                 </div>
                 ${!v.sizeVariants && v.consumption_type ? `<div style="background:#fff; color:#1e293b; padding:5px 15px; border-radius:8px; font-weight:900; font-size:18px; border:2px solid #1e293b;">${v.consumption_val} ${v.consumption_type === 'items_per_pc' ? 'ITEMS / PC' : 'PCS / ITEM'}</div>` : ''}
               </div>
               <div style="font-size:28px; color:#1e293b; font-weight:900; line-height:1.3; margin-bottom:15px;">${v.text || '---'}</div>
               <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:20px;">${v.attachments.filter(a => a.type === 'image').map(img => `<img src="${img.url}" style="width:100%; border-radius:16px; border:2px solid #eee;" />`).join('')}</div>
               ${sizeHtml}
            </div>`;
          }).join('');
        } else {
          contentHtml = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; background:#f8fafc; padding:30px; border-radius:24px; border:3px solid #e2e8f0; gap:30px;">
              <div style="font-size:26px; font-weight:900; color:#1e293b; line-height:1.3; flex:1;">${item.text || '---'}</div>
              ${item.consumption_type ? `<div style="background:#1e293b; color:#fff; padding:10px 20px; border-radius:12px; font-weight:900; font-size:22px; white-space:nowrap;">${item.consumption_val} <br/><small style="font-size:12px; opacity:0.8;">${item.consumption_type === 'items_per_pc' ? 'ITEMS / PC' : 'PCS / ITEM'}</small></div>` : ''}
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:25px; margin-top:25px;">${item.attachments.filter(a => a.type === 'image').map(img => `<div style="border:2px solid #eee; padding:15px; border-radius:20px; text-align:center;"><img src="${img.url}" style="max-width:100%; max-height:600px; border-radius:12px;" /></div>`).join('')}</div>
          `;
        }
        
        return `<div style="margin-bottom:50px; border-bottom:2px solid #e2e8f0; padding-bottom:40px; break-inside:avoid;"><div style="font-size:16px; font-weight:900; color:#64748b; text-transform:uppercase; margin-bottom:16px; letter-spacing:3px; display:flex; align-items:center; gap:12px;"><div style="width:10px; height:10px; background:#4f46e5; border-radius:50%;"></div>${f}</div>${contentHtml}</div>`;
      }).join('');
      
      return `<div style="margin-top:70px; page-break-before:always;"><h3 style="background:#1e293b; color:#fff; padding:20px 30px; font-size:22px; text-transform:uppercase; letter-spacing:5px; border-radius:16px; font-weight:900;">${cat.name}</h3><div style="padding:30px 15px;">${variantMetaHtml}${fields}</div></div>`;
    }).join('');

    win.document.write(`<html><head><title>Tech Pack - ${style.style_number}</title><style>body { font-family: 'Inter', -apple-system, sans-serif; padding: 70px; color: #1e293b; line-height: 1.4; } .header { border-bottom: 10px solid #1e293b; padding-bottom: 40px; margin-bottom: 50px; display: flex; justify-content: space-between; align-items: flex-end; } .brand { font-size: 56px; font-weight: 900; letter-spacing: -2px; } .meta { display: grid; grid-template-columns: repeat(5, 1fr); gap: 25px; margin-bottom: 50px; } .box { border: 4px solid #1e293b; padding: 20px; border-radius: 16px; } .label { font-size: 13px; font-weight: 900; color: #64748b; display: block; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 2px; }</style></head><body><div class="header"><div class="brand">TINTURA SST<br/><span style="font-size:24px; color:#64748b; font-weight:800; letter-spacing:3px; text-transform:uppercase;">Technical Manufacturing Blueprint</span></div><div style="text-align:right; font-weight:900; font-size:32px; color:#4f46e5;"># ${style.style_number}</div></div><div class="meta"><div class="box"><span class="label">Style Code</span><strong style="font-size:22px;">${style.style_number}</strong></div><div class="box"><span class="label">Garment</span><strong style="font-size:22px;">${style.garment_type || '---'}</strong></div><div class="box"><span class="label">Demographic</span><strong style="font-size:22px;">${style.demographic || '---'}</strong></div><div class="box"><span class="label">Line</span><strong style="font-size:22px;">${style.category}</strong></div><div class="box"><span class="label">Pcs/Box</span><strong style="font-size:22px;">${style.pcs_per_box}</strong></div></div><div style="background:#f8fafc; border:3px solid #e2e8f0; padding:40px; border-radius:32px; margin-bottom:50px;"><span class="label">Master Technical Summary</span><div style="font-size:28px; font-weight:800; line-height:1.4;">${style.style_text || 'No master technical summary provided.'}</div></div>${categoriesHtml}<script>window.onload = () => { setTimeout(() => window.print(), 1000); };</script></body></html>`);
    win.document.close();
  };

  if (viewingStyle) return <StyleFullView style={viewingStyle} template={template} onBack={() => setViewingStyle(null)} onEdit={() => { setIsEditing(viewingStyle); setViewingStyle(null); }} onPrint={() => handlePrint(viewingStyle)} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-4">
        <div><h2 className="text-3xl font-black text-slate-800 flex items-center gap-3"><div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg"><BookOpen size={28}/></div>Style Technical Database</h2><p className="text-slate-500 text-sm mt-1">Master Tech-Packs and Design Blueprint Management</p></div>
        <div className="flex items-center gap-3"><div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex"><button onClick={() => setViewMode('catalog')} className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'catalog' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Grid size={18}/> Catalog</button><button onClick={() => setViewMode('compare')} className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'compare' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><ArrowLeftRight size={18}/> Compare</button></div><button onClick={() => setIsConfigOpen(true)} className="p-3 bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 rounded-xl transition-all"><Settings size={20}/></button><button onClick={() => setIsEditing({ id: '', style_number: '', category: 'Casuals', packing_type: 'pouch', pcs_per_box: 0, style_text: '', garment_type: 'T-shirt', demographic: 'Men', available_colors: [''], available_sizes: ['S', 'M', 'L', 'XL', 'XXL', '3XL'], size_type: 'letter', tech_pack: {} })} className="bg-indigo-600 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-black hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all active:scale-95"><Plus size={20}/> New Style</button></div>
      </div>
      <div className="relative"><input type="text" placeholder="Search by Style Number, Category, or Garment Type..." className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 outline-none transition-all font-bold shadow-sm bg-white text-black" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/><Search className="absolute left-4 top-4 text-slate-400" size={24}/></div>

      {viewMode === 'catalog' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fade-in">
          {filteredStyles.map(style => (<div key={style.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-300 transition-all group overflow-hidden flex flex-col"><div className="p-6 flex-1 cursor-pointer" onClick={() => setViewingStyle(style)}><div className="flex justify-between items-start mb-4"><div className="flex gap-2"><div className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">{style.garment_type}</div><div className="bg-indigo-50 px-3 py-1 rounded-full text-[10px] font-black text-indigo-500 uppercase tracking-widest">{style.demographic}</div></div><div className="flex gap-2" onClick={e => e.stopPropagation()}><button onClick={() => handlePrint(style)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"><Printer size={16}/></button><button onClick={() => handleDelete(style.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16}/></button></div></div><div className="flex items-center justify-between group/title"><h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2 group-hover/title:text-indigo-600 transition-colors">{style.style_number}</h3><ChevronRight size={20} className="text-slate-300 group-hover:text-indigo-600 transition-all transform group-hover:translate-x-1" /></div><p className="text-slate-500 text-xs font-medium line-clamp-2 leading-relaxed mb-4">{style.style_text || 'No description provided.'}</p></div><div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2"><button onClick={() => setIsEditing(style)} className="flex-1 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 hover:border-indigo-500 hover:text-indigo-600 transition-all flex items-center justify-center gap-2"><Edit3 size={14}/> Edit Tech Pack</button><button onClick={() => { if (compareList.find(s => s.id === style.id)) setCompareList(prev => prev.filter(s => s.id !== style.id)); else { setCompareList(prev => [...prev, style]); setViewMode('compare'); } }} className={`p-2.5 rounded-xl border transition-all ${compareList.find(s => s.id === style.id) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-500 hover:text-indigo-600'}`}><ArrowLeftRight size={18}/></button></div></div>))}
        </div>
      )}

      {viewMode === 'compare' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-x-auto min-h-[600px] animate-fade-in">{compareList.length === 0 ? (<div className="p-20 text-center text-slate-400"><ArrowLeftRight size={48} className="mx-auto mb-4 opacity-20"/><p className="text-xl font-bold">Desk Empty</p><button onClick={() => setViewMode('catalog')} className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold">Back to Catalog</button></div>) : (<div className="p-8 inline-flex gap-8">{compareList.map(style => (<div key={style.id} className="w-96 shrink-0 bg-slate-50/50 rounded-3xl border border-slate-200 flex flex-col shadow-inner overflow-hidden"><div className="p-6 bg-white border-b border-slate-200 sticky top-0 z-10"><div className="flex justify-between items-start"><h3 className="text-2xl font-black text-slate-800">{style.style_number}</h3><button onClick={() => setCompareList(prev => prev.filter(s => s.id !== style.id))} className="p-1 text-slate-300 hover:text-red-500 transition-colors"><X size={20}/></button></div><div className="mt-4 flex flex-wrap gap-2"><span className="text-[10px] font-black bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full uppercase">{style.category}</span><span className="text-[10px] font-black bg-slate-100 text-slate-700 px-3 py-1 rounded-full uppercase">{style.garment_type}</span></div></div><div className="p-6 space-y-8 overflow-y-auto">{template?.config.filter(c => c.name !== "General Info").map(cat => (<div key={cat.name}><h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest border-b border-indigo-100 pb-2 mb-4">{cat.name}</h4><div className="space-y-6">{cat.fields.map(field => { const item = style.tech_pack[cat.name]?.[field] || { text: '---', attachments: [] }; return (<div key={field}><div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{field}</div>{!item.variants ? (<div className="text-sm font-medium text-slate-700 whitespace-pre-wrap">{item.text}</div>) : (<div className="space-y-4">{item.variants.map((v, vIdx) => (<div key={vIdx} className="bg-white border rounded-xl p-3 shadow-sm"><div className="flex flex-wrap gap-1 mb-2">{v.colors.map(c => <span key={c} className="bg-indigo-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase">{c}</span>)}</div><div className="text-xs text-slate-700">{v.text}</div></div>))}</div>)}</div>); })}</div></div>))}</div></div>))}</div>)}</div>
      )}

      {isEditing && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[95vh] overflow-hidden flex flex-col animate-scale-up border border-slate-200">
            <div className="p-8 border-b bg-slate-50 flex justify-between items-center"><div><h3 className="text-3xl font-black text-slate-800 tracking-tight">{isEditing.id ? `Editing Style ${isEditing.style_number}` : 'New Style Blueprint'}</h3><p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Define technical details and variant specific instructions</p></div><button onClick={() => setIsEditing(null)} className="text-slate-300 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-full"><X size={32}/></button></div>
            <form onSubmit={handleSaveStyle} className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-10"><div className="col-span-1"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Style Number</label><input required className="w-full border-2 border-slate-100 rounded-xl p-4 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-all" value={isEditing.style_number} onChange={e => setIsEditing({...isEditing, style_number: e.target.value})}/></div><div className="col-span-1"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Garment Type</label><div className="flex gap-2"><select className="flex-1 border-2 border-slate-100 rounded-xl p-4 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer" value={isEditing.garment_type} onChange={e => setIsEditing({...isEditing, garment_type: e.target.value})}>{garmentTypeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select><button type="button" onClick={() => { const v = prompt("New Garment Type:"); if(v) setGarmentTypeOptions([...garmentTypeOptions, v]); }} className="p-4 bg-white border-2 border-slate-100 rounded-xl text-indigo-600"><Plus size={20}/></button></div></div><div className="col-span-1"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Demographic</label><div className="flex gap-2"><select className="flex-1 border-2 border-slate-100 rounded-xl p-4 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer" value={isEditing.demographic} onChange={e => setIsEditing({...isEditing, demographic: e.target.value})}>{demographicOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select><button type="button" onClick={() => { const v = prompt("New Demographic:"); if(v) setDemographicOptions([...demographicOptions, v]); }} className="p-4 bg-white border-2 border-slate-100 rounded-xl text-indigo-600"><Plus size={20}/></button></div></div><div className="col-span-1"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Category</label><select className="w-full border-2 border-slate-100 rounded-xl p-4 bg-white font-bold focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer" value={isEditing.category} onChange={e => setIsEditing({...isEditing, category: e.target.value})}><option value="Casuals">Casuals</option><option value="Lite">Lite</option><option value="Sportz">Sportz</option></select></div><div className="col-span-1"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Short Description</label><input className="w-full border-2 border-slate-100 rounded-xl p-4 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={isEditing.style_text} onChange={e => setIsEditing({...isEditing, style_text: e.target.value})}/></div></div>
              {template?.config.filter(cat => cat.name !== "General Info").map(cat => (<CategoryEditor key={cat.name} category={cat} isEditing={isEditing} setIsEditing={setIsEditing} handleFileUpload={handleFileUpload} />))}
            </form>
            <div className="p-8 border-t bg-white flex justify-between items-center shadow-2xl"><button type="button" onClick={() => setIsEditing(null)} className="px-10 py-4 font-black text-slate-400 hover:text-slate-600 transition-all uppercase text-xs">Cancel</button><button onClick={handleSaveStyle} disabled={isUploading} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-2xl shadow-indigo-200 flex items-center gap-3 active:scale-95 disabled:opacity-50 uppercase text-xs">{isUploading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20}/>} Commit Style Blueprint</button></div>
          </div>
        </div>
      )}
    </div>
  );
};
