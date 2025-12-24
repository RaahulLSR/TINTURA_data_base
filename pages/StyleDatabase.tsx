
import React, { useEffect, useState } from 'react';
import { fetchStyles, upsertStyle, fetchStyleTemplate, updateStyleTemplate, deleteStyle, uploadOrderAttachment } from '../services/db';
import { Style, StyleTemplate, StyleCategory, TechPackItem, Attachment } from '../types';
// Added ChevronRight to the imports from lucide-react
import { 
  Plus, Search, Grid, Copy, Trash2, Save, Printer, Edit3, X, Image as ImageIcon, FileText, Settings, ArrowLeftRight, Loader2, Download, Layers, BookOpen, Palette, Ruler, ChevronDown, ChevronUp, ChevronRight, Info, ArrowLeft, ExternalLink
} from 'lucide-react';

// --- Sub-components moved outside to prevent focus loss ---

interface CategoryEditorProps {
  category: StyleCategory;
  isEditing: Style | null;
  setIsEditing: (style: Style | null) => void;
  handleFileUpload: (category: string, field: string, files: FileList | null) => void;
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

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm mb-6">
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={18} className="text-indigo-600"/>
          <h4 className="font-black text-slate-700 text-xs uppercase tracking-widest">{category.name}</h4>
        </div>
      </div>
      
      <div className="p-6 space-y-8">
        {/* INJECT BLUEPRINT COLOURS & SIZES IF PRE-PRODUCTION */}
        {isPreProduction && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 bg-slate-50/50 rounded-2xl border border-slate-100 shadow-inner mb-4">
            {/* Colours Input: 1-Column Table */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <Palette size={16} className="text-indigo-600"/>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Blueprint Colours</label>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-hide">
                {(isEditing.available_colors || ['']).map((color, idx) => (
                  <div key={idx} className="flex gap-2 group">
                    <input 
                      className="flex-1 border-2 border-slate-200 rounded-xl p-3 bg-white text-slate-900 font-bold focus:border-indigo-500 outline-none transition-all text-sm"
                      placeholder="Type colour..."
                      value={color}
                      onChange={e => {
                        const newCols = [...(isEditing.available_colors || [])];
                        newCols[idx] = e.target.value;
                        setIsEditing({...isEditing, available_colors: newCols});
                      }}
                    />
                    <button type="button" onClick={() => {
                      const newCols = (isEditing.available_colors || []).filter((_, i) => i !== idx);
                      setIsEditing({...isEditing, available_colors: newCols.length > 0 ? newCols : ['']});
                    }} className="p-3 text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 size={16}/>
                    </button>
                  </div>
                ))}
              </div>
              <button 
                type="button" 
                onClick={() => setIsEditing({...isEditing, available_colors: [...(isEditing.available_colors || []), '']})} 
                className="w-full mt-4 py-2.5 border-2 border-dashed border-indigo-200 text-indigo-600 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-white hover:border-indigo-300 transition-all flex items-center justify-center gap-2"
              >
                <Plus size={14}/> Add Colour Row
              </button>
            </div>

            {/* Sizes Input: Toggle Type + Badge Management */}
            <div className="flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <Ruler size={16} className="text-indigo-600"/>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Size variants</label>
                </div>
                <div className="flex bg-slate-200 p-1 rounded-lg">
                  <button 
                    type="button" 
                    onClick={() => setIsEditing({...isEditing, size_type: 'letter', available_sizes: ['S', 'M', 'L', 'XL', 'XXL', 'XXXL']})} 
                    className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${isEditing.size_type === 'letter' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                  >
                    ABC
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setIsEditing({...isEditing, size_type: 'number', available_sizes: ['65', '70', '75', '80', '85', '90']})} 
                    className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${isEditing.size_type === 'number' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                  >
                    123
                  </button>
                </div>
              </div>
              
              <div className="flex-1 flex flex-wrap content-start gap-2 p-3 bg-white rounded-xl border border-slate-200 min-h-[100px]">
                {isEditing.available_sizes?.map((sz, idx) => (
                  <div key={idx} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-2 shadow-sm">
                    {sz}
                    <button type="button" onClick={() => {
                      const newSizes = isEditing.available_sizes?.filter((_, i) => i !== idx);
                      setIsEditing({...isEditing, available_sizes: newSizes});
                    }} className="text-white/50 hover:text-white transition-colors">
                      <X size={12}/>
                    </button>
                  </div>
                ))}
              </div>
              
              <button 
                type="button" 
                onClick={() => {
                  const newVal = prompt(`Enter new ${isEditing.size_type === 'letter' ? 'Letter' : 'Number'} size:`);
                  if (newVal) setIsEditing({...isEditing, available_sizes: [...(isEditing.available_sizes || []), newVal]});
                }} 
                className="w-full mt-4 py-2.5 border-2 border-dashed border-indigo-200 text-indigo-600 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-white hover:border-indigo-300 transition-all flex items-center justify-center gap-2"
              >
                <Plus size={14}/> Add custom size
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Inject Packing Type and Pcs/Box if this is the Packing category */}
          {isPackingReq && (
            <>
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Type of Packing</label>
                <select 
                  className="w-full border-2 border-slate-100 rounded-xl p-4 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer" 
                  value={isEditing.packing_type} 
                  onChange={e => setIsEditing({...isEditing, packing_type: e.target.value})}
                >
                  <option value="pouch">Pouch</option>
                  <option value="cover">Cover</option>
                  <option value="box">Box</option>
                </select>
              </div>
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">No of pieces / Box</label>
                <input 
                  type="number" 
                  className="w-full border-2 border-slate-100 rounded-xl p-4 bg-white text-slate-900 font-black focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" 
                  value={isEditing.pcs_per_box} 
                  onChange={e => setIsEditing({...isEditing, pcs_per_box: parseInt(e.target.value) || 0})}
                />
              </div>
            </>
          )}

          {category.fields.map(field => {
            const data = isEditing.tech_pack[category.name]?.[field] || { text: '', attachments: [] };
            return (
              <div key={field} className="space-y-3">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{field}</label>
                <div className="relative group">
                  <textarea 
                    className="w-full border-2 border-slate-100 rounded-xl p-4 text-sm font-medium focus:border-indigo-500 outline-none min-h-[100px] bg-slate-50/50 focus:bg-white transition-all text-black"
                    value={data.text}
                    placeholder={`Enter ${field.toLowerCase()} details...`}
                    onChange={e => {
                      const updated = { ...isEditing };
                      if (!updated.tech_pack[category.name]) updated.tech_pack[category.name] = {};
                      updated.tech_pack[category.name][field] = { ...data, text: e.target.value };
                      setIsEditing(updated);
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.attachments.map((att, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-700">
                      {att.type === 'image' ? <ImageIcon size={14}/> : <FileText size={14}/>}
                      <span className="truncate max-w-[100px]">{att.name}</span>
                      <button type="button" onClick={() => {
                        const updated = { ...isEditing };
                        updated.tech_pack[category.name][field].attachments.splice(idx, 1);
                        setIsEditing(updated);
                      }} className="hover:text-red-500"><X size={14}/></button>
                    </div>
                  ))}
                  <label className="bg-white border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2">
                    <Plus size={14}/> Add File
                    <input type="file" multiple className="hidden" onChange={e => handleFileUpload(category.name, field, e.target.files)}/>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// --- Full View Component ---

const StyleFullView: React.FC<{ style: Style, template: StyleTemplate | null, onBack: () => void, onPrint: () => void, onEdit: () => void }> = ({ style, template, onBack, onPrint, onEdit }) => {
  return (
    <div className="bg-white min-h-screen animate-fade-in -m-8 p-8">
      {/* Top Floating Navigation */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 -mx-8 px-8 py-4 flex items-center justify-between mb-8">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="p-2.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all flex items-center gap-2 font-bold">
            <ArrowLeft size={20}/> Catalog
          </button>
          <div className="h-6 w-px bg-slate-200"></div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{style.style_number}</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{style.category} • {style.garment_type} ({style.demographic})</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onEdit} className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-bold transition-all"><Edit3 size={18}/> Edit Blueprint</button>
          <button onClick={onPrint} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-black shadow-lg shadow-indigo-100 transition-all"><Printer size={18}/> Generate Tech-Pack PDF</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-12">
        {/* Meta Info Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2"><Palette size={12}/> Variant Colors</label>
            <div className="flex flex-wrap gap-2 mt-3">
               {style.available_colors?.filter(c => c).map((c, i) => (
                 <span key={i} className="px-3 py-1 bg-white border border-slate-200 text-xs font-bold rounded-lg text-slate-700 shadow-sm">{c}</span>
               )) || <span className="text-xs text-slate-300 italic">No colors defined</span>}
            </div>
          </div>
          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2"><Ruler size={12}/> Variant Sizes</label>
            <div className="flex flex-wrap gap-2 mt-3">
               {style.available_sizes?.map((s, i) => (
                 <span key={i} className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-sm">{s}</span>
               )) || <span className="text-xs text-slate-300 italic">No sizes defined</span>}
            </div>
            <div className="mt-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Type: {style.size_type}</div>
          </div>
          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2"><ImageIcon size={12}/> Packaging Specs</label>
            <div className="mt-3">
               <div className="text-lg font-black text-slate-800 capitalize">{style.packing_type}</div>
               <div className="text-sm font-bold text-slate-500">{style.pcs_per_box} Pieces per container</div>
            </div>
          </div>
          <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100">
            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Brief Description</label>
            <p className="mt-2 text-sm font-medium text-slate-700 leading-relaxed italic">{style.style_text || 'No technical notes provided for this style.'}</p>
          </div>
        </div>

        {/* Dynamic Technical Sections */}
        <div className="space-y-16">
          {template?.config.filter(c => c.name !== "General Info").map((cat, i) => (
            <section key={i} className="animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="flex items-center gap-4 mb-8">
                 <div className="h-px flex-1 bg-slate-100"></div>
                 <h2 className="text-sm font-black text-indigo-500 uppercase tracking-[0.3em] flex items-center gap-3">
                   <Layers size={16}/> {cat.name}
                 </h2>
                 <div className="h-px flex-1 bg-slate-100"></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-16">
                {cat.fields.map(field => {
                  const data = style.tech_pack[cat.name]?.[field] || { text: 'N/A', attachments: [] };
                  const images = data.attachments.filter(a => a.type === 'image');
                  const docs = data.attachments.filter(a => a.type === 'document');

                  return (
                    <div key={field} className="space-y-4 group">
                      <div className="flex justify-between items-end border-b border-slate-100 pb-2 group-hover:border-indigo-200 transition-colors">
                        <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">{field}</h3>
                        <span className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-400 transition-colors">{data.attachments.length} Assets</span>
                      </div>
                      
                      <div className="text-slate-600 text-sm font-medium leading-relaxed bg-slate-50/50 p-4 rounded-2xl border border-slate-50 min-h-[60px] whitespace-pre-wrap">
                        {data.text || <span className="opacity-30 italic">No notes provided</span>}
                      </div>

                      {/* Attachment Grid */}
                      {data.attachments.length > 0 && (
                        <div className="space-y-3">
                          {/* Image Gallery */}
                          {images.length > 0 && (
                            <div className="grid grid-cols-2 gap-2">
                               {images.map((img, idx) => (
                                 <a key={idx} href={img.url} target="_blank" rel="noreferrer" className="relative group/img aspect-square rounded-2xl overflow-hidden border border-slate-200 shadow-sm block bg-slate-100">
                                   <img src={img.url} className="w-full h-full object-cover transition-transform group-hover/img:scale-110"/>
                                   <div className="absolute inset-0 bg-indigo-900/60 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                                      <ExternalLink size={24} className="text-white"/>
                                   </div>
                                 </a>
                               ))}
                            </div>
                          )}
                          
                          {/* Document List */}
                          {docs.length > 0 && (
                            <div className="space-y-2">
                               {docs.map((doc, idx) => (
                                 <a key={idx} href={doc.url} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-400 hover:shadow-md transition-all">
                                   <div className="flex items-center gap-3 truncate pr-4">
                                     <FileText size={16} className="text-indigo-500"/>
                                     <span className="text-xs font-bold text-slate-700 truncate">{doc.name}</span>
                                   </div>
                                   <Download size={14} className="text-slate-400"/>
                                 </a>
                               ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        
        {/* Final Branding / Footer */}
        <div className="pt-20 pb-10 text-center">
           <div className="inline-flex items-center gap-2 px-6 py-2 bg-slate-100 rounded-full border border-slate-200 mb-4">
              <Layers size={14} className="text-indigo-600"/>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tintura Technical Blueprint # {style.id.slice(0, 8)}</span>
           </div>
           <p className="text-xs text-slate-400">Strictly Internal - For Manufacturing Use Only</p>
        </div>
      </div>
    </div>
  );
};

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

  // Dynamic Options
  const [garmentTypeOptions, setGarmentTypeOptions] = useState(['Pant', 'Trackpant', 'Shorts', 'T-shirt']);
  const [demographicOptions, setDemographicOptions] = useState(['Men', 'Boys']);

  // Load Data
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

  // Filter styles
  const filteredStyles = styles.filter(s => 
    s.style_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.garment_type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handlers
  const handleSaveStyle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing) return;
    setIsUploading(true);

    const payload: Partial<Style> = { ...isEditing };
    if (!payload.id || payload.id === "") {
      delete payload.id;
    }

    const { error } = await upsertStyle(payload);
    setIsUploading(false);
    if (!error) {
      setIsEditing(null);
      loadData();
    } else {
      alert(error);
    }
  };

  const handleCopyFrom = (sourceStyleId: string) => {
    const source = styles.find(s => s.id === sourceStyleId);
    if (!source || !isEditing) return;
    if (confirm(`Overwrite data in ${isEditing.style_number} with data from ${source.style_number}?`)) {
      setIsEditing({
        ...isEditing,
        tech_pack: { ...source.tech_pack },
        category: source.category,
        packing_type: source.packing_type,
        pcs_per_box: source.pcs_per_box,
        style_text: source.style_text,
        garment_type: source.garment_type,
        demographic: source.demographic,
        available_colors: source.available_colors ? [...source.available_colors] : [],
        available_sizes: source.available_sizes ? [...source.available_sizes] : [],
        size_type: source.size_type
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Permanently delete this style?")) {
      await deleteStyle(id);
      loadData();
    }
  };

  const handleFileUpload = async (category: string, field: string, files: FileList | null) => {
    if (!files || !isEditing) return;
    setIsUploading(true);
    const updated = { ...isEditing };
    if (!updated.tech_pack[category]) updated.tech_pack[category] = {};
    if (!updated.tech_pack[category][field]) updated.tech_pack[category][field] = { text: '', attachments: [] };
    
    for (const file of Array.from(files)) {
      const url = await uploadOrderAttachment(file);
      if (url) {
        updated.tech_pack[category][field].attachments.push({
          name: file.name,
          url,
          type: file.type.startsWith('image/') ? 'image' : 'document'
        });
      }
    }
    setIsEditing(updated);
    setIsUploading(false);
  };

  const handleAddNewGarmentType = () => {
    const newVal = prompt("Enter new Garment Type:");
    if (newVal && !garmentTypeOptions.includes(newVal)) {
      setGarmentTypeOptions([...garmentTypeOptions, newVal]);
      if (isEditing) setIsEditing({ ...isEditing, garment_type: newVal });
    } else if (newVal) {
      if (isEditing) setIsEditing({ ...isEditing, garment_type: newVal });
    }
  };

  const handleAddNewDemographic = () => {
    const newVal = prompt("Enter new Demographic (e.g. Men, Boys, Girls):");
    if (newVal && !demographicOptions.includes(newVal)) {
      setDemographicOptions([...demographicOptions, newVal]);
      if (isEditing) setIsEditing({ ...isEditing, demographic: newVal });
    } else if (newVal) {
      if (isEditing) setIsEditing({ ...isEditing, demographic: newVal });
    }
  };

  const handlePrint = (style: Style) => {
    const win = window.open('', 'TechPack', 'width=1000,height=800');
    if (!win) return;
    
    const categoriesHtml = template?.config.filter(c => c.name !== "General Info").map(cat => {
      const isPreProd = cat.name.toLowerCase().includes('pre production');
      
      const variantMetaHtml = isPreProd ? `
        <div style="background:#f9f9f9; border:1px solid #eee; padding:15px; border-radius:4px; margin-bottom:20px; display:grid; grid-template-columns:1fr 1fr; gap:20px;">
           <div><span style="font-size:10px; font-weight:bold; color:#888; text-transform:uppercase;">Blueprint Colours</span><br/><strong>${style.available_colors?.join(', ') || '---'}</strong></div>
           <div><span style="font-size:10px; font-weight:bold; color:#888; text-transform:uppercase;">Size Breakdown</span><br/><strong>${style.available_sizes?.join(', ') || '---'} (${style.size_type})</strong></div>
        </div>
      ` : '';

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
      
      const extraMetaHtml = cat.name.toLowerCase().includes('packing') ? `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px; border-bottom:2px solid #000; padding-bottom:15px;">
           <div><span style="font-size:10px; font-weight:bold; color:#666; display:block;">Packing Type</span><strong>${style.packing_type}</strong></div>
           <div><span style="font-size:10px; font-weight:bold; color:#666; display:block;">Pcs/Box</span><strong>${style.pcs_per_box}</strong></div>
        </div>
      ` : '';

      return `
        <div style="margin-top:40px;">
          <h3 style="background:#000; color:#fff; padding:10px; font-size:14px; text-transform:uppercase; letter-spacing:1px;">${cat.name}</h3>
          <div style="padding:10px;">
            ${variantMetaHtml}
            ${extraMetaHtml}
            ${fields}
          </div>
        </div>
      `;
    }).join('');

    win.document.write(`
      <html><head><title>Tech Pack - ${style.style_number}</title><style>body { font-family: sans-serif; padding: 40px; color: #333; } .header { border-bottom: 5px solid #000; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; } .brand { font-size: 32px; font-weight: 900; } .meta { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr 1fr; gap: 20px; margin-bottom: 30px; } .box { border: 2px solid #000; padding: 10px; font-size: 13px; } .label { font-size: 10px; font-weight: bold; color: #666; display: block; margin-bottom: 3px; }</style></head>
      <body>
        <div class="header">
          <div class="brand">TINTURA SST<br/><span style="font-size:16px; color:#666;">STYLE TECH-PACK</span></div>
          <div style="text-align:right; font-weight:bold; font-size:18px;"># ${style.style_number}</div>
        </div>
        <div class="meta">
          <div class="box"><span class="label">Style Number</span><strong>${style.style_number}</strong></div>
          <div class="box"><span class="label">Garment Type</span><strong>${style.garment_type || '---'}</strong></div>
          <div class="box"><span class="label">Demographic</span><strong>${style.demographic || '---'}</strong></div>
          <div class="box"><span class="label">Category</span><strong>${style.category}</strong></div>
          <div class="box"><span class="label">Description</span><strong>${style.style_text || '---'}</strong></div>
        </div>
        ${categoriesHtml}
        <script>window.onload = () => { setTimeout(() => window.print(), 1000); };</script>
      </body></html>
    `);
    win.document.close();
  };

  // If viewing a style in full page, render the special view
  if (viewingStyle) {
    return (
      <StyleFullView 
        style={viewingStyle} 
        template={template} 
        onBack={() => setViewingStyle(null)}
        onEdit={() => { setIsEditing(viewingStyle); setViewingStyle(null); }}
        onPrint={() => handlePrint(viewingStyle)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg">
              <BookOpen size={28}/>
            </div>
            Style Technical Database
          </h2>
          <p className="text-slate-500 text-sm mt-1">Master Tech-Packs and Design Blueprint Management</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex">
            <button onClick={() => setViewMode('catalog')} className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'catalog' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Grid size={18}/> Catalog</button>
            <button onClick={() => setViewMode('compare')} className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'compare' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><ArrowLeftRight size={18}/> Compare</button>
          </div>
          <button onClick={() => setIsConfigOpen(true)} className="p-3 bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 rounded-xl transition-all"><Settings size={20}/></button>
          <button onClick={() => setIsEditing({ id: '', style_number: '', category: 'Casuals', packing_type: 'pouch', pcs_per_box: 0, style_text: '', garment_type: 'T-shirt', demographic: 'Men', available_colors: [''], available_sizes: ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'], size_type: 'letter', tech_pack: {} })} className="bg-indigo-600 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-black hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all active:scale-95"><Plus size={20}/> New Style</button>
        </div>
      </div>

      <div className="relative">
        <input 
          type="text" 
          placeholder="Search by Style Number, Category, or Garment Type..." 
          className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold shadow-sm bg-white text-black"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <Search className="absolute left-4 top-4 text-slate-400" size={24}/>
      </div>

      {viewMode === 'catalog' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fade-in">
          {filteredStyles.map(style => {
            return (
              <div 
                key={style.id} 
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-300 transition-all group overflow-hidden flex flex-col"
              >
                <div 
                  className="p-6 flex-1 cursor-pointer"
                  onClick={() => setViewingStyle(style)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-2">
                      <div className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">{style.garment_type}</div>
                      <div className="bg-indigo-50 px-3 py-1 rounded-full text-[10px] font-black text-indigo-500 uppercase tracking-widest">{style.demographic}</div>
                    </div>
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      <button onClick={() => handlePrint(style)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"><Printer size={16}/></button>
                      <button onClick={() => handleDelete(style.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16}/></button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between group/title">
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2 group-hover/title:text-indigo-600 transition-colors">{style.style_number}</h3>
                    <ChevronRight size={20} className="text-slate-300 group-hover:text-indigo-600 transition-all transform group-hover:translate-x-1" />
                  </div>
                  <p className="text-slate-500 text-xs font-medium line-clamp-2 leading-relaxed mb-4">{style.style_text || 'No description provided.'}</p>
                  
                  <div className="mt-4 flex items-center gap-4">
                    <div className="flex -space-x-2">
                      {Object.values(style.tech_pack).flatMap(cat => Object.values(cat)).flatMap(item => item.attachments).slice(0, 4).map((att, i) => (
                        <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-indigo-100 flex items-center justify-center text-indigo-600 overflow-hidden shadow-sm">
                          {att.type === 'image' ? <img src={att.url} className="w-full h-full object-cover"/> : <FileText size={14}/>}
                        </div>
                      ))}
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {Object.values(style.tech_pack).flatMap(cat => Object.values(cat)).flatMap(item => item.attachments).length} Technical Assets
                    </span>
                  </div>
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
                  <button 
                    onClick={() => setIsEditing(style)}
                    className="flex-1 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 hover:border-indigo-500 hover:text-indigo-600 transition-all flex items-center justify-center gap-2"
                  >
                    <Edit3 size={14}/> Edit Tech Pack
                  </button>
                  <button 
                    onClick={() => {
                      if (compareList.find(s => s.id === style.id)) {
                        setCompareList(prev => prev.filter(s => s.id !== style.id));
                      } else {
                        setCompareList(prev => [...prev, style]);
                        setViewMode('compare');
                      }
                    }}
                    className={`p-2.5 rounded-xl border transition-all ${compareList.find(s => s.id === style.id) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-500 hover:text-indigo-600'}`}
                  >
                    <ArrowLeftRight size={18}/>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'compare' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-x-auto min-h-[600px] animate-fade-in">
          {compareList.length === 0 ? (
            <div className="p-20 text-center text-slate-400">
               <ArrowLeftRight size={48} className="mx-auto mb-4 opacity-20"/>
               <p className="text-xl font-bold">Comparison Desk Empty</p>
               <p className="text-sm mt-2">Select styles from the catalog to compare them side-by-side.</p>
               <button onClick={() => setViewMode('catalog')} className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold">Back to Catalog</button>
            </div>
          ) : (
            <div className="p-8 inline-flex gap-8">
              {compareList.map(style => (
                <div key={style.id} className="w-96 shrink-0 bg-slate-50/50 rounded-3xl border border-slate-200 flex flex-col shadow-inner overflow-hidden">
                   <div className="p-6 bg-white border-b border-slate-200 sticky top-0 z-10">
                      <div className="flex justify-between items-start">
                         <h3 className="text-2xl font-black text-slate-800">{style.style_number}</h3>
                         <button onClick={() => setCompareList(prev => prev.filter(s => s.id !== style.id))} className="p-1 text-slate-300 hover:text-red-500 transition-colors"><X size={20}/></button>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full uppercase">{style.category}</span>
                        <span className="text-[10px] font-black bg-slate-100 text-slate-700 px-3 py-1 rounded-full uppercase">{style.garment_type}</span>
                        <span className="text-[10px] font-black bg-slate-100 text-slate-700 px-3 py-1 rounded-full uppercase">{style.demographic}</span>
                      </div>
                   </div>
                   <div className="p-6 space-y-8 overflow-y-auto">
                      <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                        <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Variants</div>
                        <div className="text-xs font-bold text-slate-700 mb-1">Colors: {style.available_colors?.join(', ') || '---'}</div>
                        <div className="text-xs font-bold text-slate-700">Sizes: {style.available_sizes?.join(', ') || '---'}</div>
                      </div>

                      <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Style Text / Description</div>
                        <div className="text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">{style.style_text || '---'}</div>
                      </div>

                      {template?.config.filter(c => c.name !== "General Info").map(cat => (
                        <div key={cat.name}>
                          <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest border-b border-indigo-100 pb-2 mb-4">{cat.name}</h4>
                          <div className="space-y-6">
                            {cat.name.toLowerCase().includes('packing') && (
                                <div className="grid grid-cols-2 gap-4 bg-slate-100 p-3 rounded-lg border border-slate-200 mb-4">
                                   <div>
                                     <div className="text-[9px] font-black text-slate-400 uppercase">Packing</div>
                                     <div className="text-xs font-bold text-slate-800 uppercase">{style.packing_type}</div>
                                   </div>
                                   <div>
                                     <div className="text-[9px] font-black text-slate-400 uppercase">Pcs/Box</div>
                                     <div className="text-xs font-bold text-slate-800">{style.pcs_per_box}</div>
                                   </div>
                                </div>
                            )}
                            {cat.fields.map(field => {
                              const data = style.tech_pack[cat.name]?.[field] || { text: '---', attachments: [] };
                              return (
                                <div key={field}>
                                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{field}</div>
                                   <div className="text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">{data.text}</div>
                                   <div className="mt-2 flex flex-wrap gap-2">
                                     {data.attachments.map((att, i) => (
                                       <a key={i} href={att.url} target="_blank" rel="noreferrer" className="w-12 h-12 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:border-indigo-500 hover:text-indigo-600 transition-all overflow-hidden shadow-sm">
                                         {att.type === 'image' ? <img src={att.url} className="w-full h-full object-cover"/> : <FileText size={18}/>}
                                       </a>
                                     ))}
                                   </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                   </div>
                   <div className="p-4 border-t border-slate-200 bg-white">
                      <button onClick={() => handlePrint(style)} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">
                        <Printer size={18}/> Print Tech-Pack
                      </button>
                   </div>
                </div>
              ))}
              <button 
                onClick={() => setViewMode('catalog')}
                className="w-24 shrink-0 rounded-3xl border-4 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300 hover:border-indigo-300 hover:text-indigo-400 transition-all gap-2"
              >
                <Plus size={32}/>
                <span className="text-[10px] font-black uppercase tracking-widest">Add More</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Editor Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[95vh] overflow-hidden flex flex-col animate-scale-up border border-slate-200">
            <div className="p-8 border-b bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-3xl font-black text-slate-800 tracking-tight">{isEditing.id ? `Editing Style ${isEditing.style_number}` : 'New Style Blueprint'}</h3>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Populate technical details and visual documentation</p>
              </div>
              <button onClick={() => setIsEditing(null)} className="text-slate-300 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-full"><X size={32}/></button>
            </div>
            
            <form onSubmit={handleSaveStyle} className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
              {/* Header Grid: Identity */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-10">
                 <div className="col-span-1">
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Style Number</label>
                   <input required className="w-full border-2 border-slate-100 rounded-xl p-4 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-all" value={isEditing.style_number} onChange={e => setIsEditing({...isEditing, style_number: e.target.value})}/>
                 </div>
                 
                 <div className="col-span-1">
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Garment Type</label>
                   <div className="flex gap-2">
                     <select className="flex-1 border-2 border-slate-100 rounded-xl p-4 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer" value={isEditing.garment_type} onChange={e => setIsEditing({...isEditing, garment_type: e.target.value})}>
                        {garmentTypeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                     </select>
                     <button type="button" onClick={handleAddNewGarmentType} className="p-4 bg-white border-2 border-slate-100 rounded-xl text-indigo-600 hover:border-indigo-500 transition-all"><Plus size={20}/></button>
                   </div>
                 </div>

                 <div className="col-span-1">
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Demographic</label>
                   <div className="flex gap-2">
                     <select className="flex-1 border-2 border-slate-100 rounded-xl p-4 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer" value={isEditing.demographic} onChange={e => setIsEditing({...isEditing, demographic: e.target.value})}>
                        {demographicOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                     </select>
                     <button type="button" onClick={handleAddNewDemographic} className="p-4 bg-white border-2 border-slate-100 rounded-xl text-indigo-600 hover:border-indigo-500 transition-all"><Plus size={20}/></button>
                   </div>
                 </div>

                 <div className="col-span-1">
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Category</label>
                   <select className="w-full border-2 border-slate-100 rounded-xl p-4 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer" value={isEditing.category} onChange={e => setIsEditing({...isEditing, category: e.target.value})}>
                      <option value="Casuals">Casuals</option>
                      <option value="Lite">Lite</option>
                      <option value="Sportz">Sportz</option>
                   </select>
                 </div>
                 <div className="col-span-1">
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Short Description</label>
                   <input className="w-full border-2 border-slate-100 rounded-xl p-4 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-all" value={isEditing.style_text} onChange={e => setIsEditing({...isEditing, style_text: e.target.value})} placeholder="e.g. Poly-cotton blend"/>
                 </div>
              </div>

              <div className="mb-10 p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Copy className="text-indigo-600"/>
                  <div>
                    <h5 className="font-black text-indigo-900 text-sm uppercase tracking-tight">Clone Existing Data</h5>
                    <p className="text-indigo-400 text-xs font-bold uppercase tracking-widest mt-0.5">Quickly replicate Tech-Pack fields from another style</p>
                  </div>
                </div>
                <select 
                  className="bg-white border-2 border-indigo-200 rounded-xl px-4 py-2.5 text-xs font-black text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm"
                  onChange={e => e.target.value && handleCopyFrom(e.target.value)}
                  value=""
                >
                  <option value="">-- Pick Style to Copy From --</option>
                  {styles.filter(s => s.id !== isEditing.id).map(s => (
                    <option key={s.id} value={s.id}>{s.style_number}</option>
                  ))}
                </select>
              </div>

              {/* Technical breakdown sections (Loop includes Colors/Sizes inside Pre-Prod) */}
              {template?.config.filter(cat => cat.name !== "General Info").map(cat => (
                <CategoryEditor 
                  key={cat.name} 
                  category={cat} 
                  isEditing={isEditing} 
                  setIsEditing={setIsEditing} 
                  handleFileUpload={handleFileUpload} 
                />
              ))}

            </form>

            <div className="p-8 border-t bg-white flex justify-between items-center shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)]">
               <button type="button" onClick={() => setIsEditing(null)} className="px-10 py-4 font-black text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-2xl transition-all uppercase tracking-widest text-xs">Cancel</button>
               <button 
                 onClick={handleSaveStyle} 
                 disabled={isUploading}
                 className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-2xl shadow-indigo-200 flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest text-xs"
               >
                 {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20}/>}
                 Commit Style Blueprint
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Schema Config Modal */}
      {isConfigOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-up border border-slate-200">
            <div className="p-8 border-b bg-slate-50 flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">Default Format Configuration</h3>
              <button onClick={() => setIsConfigOpen(false)} className="text-slate-300 hover:text-slate-600 p-2"><X size={32}/></button>
            </div>
            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              {template?.config.map((cat, catIdx) => (
                <div key={catIdx} className="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                  <div className="flex justify-between items-center">
                    <input 
                      className="bg-transparent font-black text-indigo-700 uppercase tracking-widest outline-none border-b-2 border-transparent focus:border-indigo-400 pb-1"
                      value={cat.name}
                      onChange={e => {
                        if (!template) return;
                        const newConfig = [...template.config];
                        newConfig[catIdx].name = e.target.value;
                        setTemplate({ ...template, config: newConfig });
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    {cat.fields.map((field, fieldIdx) => (
                      <div key={fieldIdx} className="flex gap-2">
                        <input 
                          className="flex-1 bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                          value={field}
                          onChange={e => {
                            if (!template) return;
                            const newConfig = [...template.config];
                            newConfig[catIdx].fields[fieldIdx] = e.target.value;
                            setTemplate({ ...template, config: newConfig });
                          }}
                        />
                      </div>
                    ))}
                    <button 
                      onClick={() => {
                        if (!template) return;
                        const newConfig = [...template.config];
                        newConfig[catIdx].fields.push("New Detail");
                        setTemplate({ ...template, config: newConfig });
                      }}
                      className="w-full py-2 bg-white border border-dashed border-slate-300 text-indigo-500 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 rounded-lg transition-colors mt-2"
                    >
                      + Add New Detail Field
                    </button>
                  </div>
                </div>
              ))}
              <button 
                onClick={() => {
                  const newConfig = [...(template?.config || []), { name: "New Category", fields: ["Example Field"] }];
                  setTemplate({ ...template!, config: newConfig });
                }}
                className="w-full py-4 border-4 border-dashed border-slate-200 text-slate-400 font-black uppercase tracking-widest hover:border-indigo-300 hover:text-indigo-500 rounded-2xl transition-all"
              >
                + Add New Major Category
              </button>
            </div>
            <div className="p-8 border-t bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setIsConfigOpen(false)} className="px-6 py-3 font-bold text-slate-500">Cancel</button>
              <button onClick={() => template && updateStyleTemplate(template.config).then(() => setIsConfigOpen(false))} className="bg-indigo-600 text-white px-10 py-3 rounded-xl font-black shadow-xl shadow-indigo-200">Save Default Format</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
