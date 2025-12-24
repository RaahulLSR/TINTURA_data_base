
import React, { useEffect, useState } from 'react';
import { fetchStyles, upsertStyle, fetchStyleTemplate, updateStyleTemplate, deleteStyle, uploadOrderAttachment } from '../services/db';
import { Style, StyleTemplate, StyleCategory, TechPackItem, Attachment } from '../types';
// Added BookOpen to the list of imports from lucide-react
import { 
  Plus, Search, Grid, List, Copy, Trash2, Save, Printer, Edit3, X, Image as ImageIcon, FileText, ChevronRight, ChevronDown, PlusCircle, Settings, ArrowRight, ArrowLeftRight, Loader2, Download, Eye, Layers, Box, BookOpen
} from 'lucide-react';

export const StyleDatabase: React.FC = () => {
  const [styles, setStyles] = useState<Style[]>([]);
  const [template, setTemplate] = useState<StyleTemplate | null>(null);
  const [viewMode, setViewMode] = useState<'catalog' | 'compare'>('catalog');
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState<Style | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [compareList, setCompareList] = useState<Style[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Load Data
  const loadData = async () => {
    const [s, t] = await Promise.all([fetchStyles(), fetchStyleTemplate()]);
    setStyles(s);
    setTemplate(t);
  };

  useEffect(() => { loadData(); }, []);

  // Filter styles
  const filteredStyles = styles.filter(s => 
    s.style_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handlers
  const handleSaveStyle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing) return;
    setIsUploading(true);

    // Filter out empty ID for new styles to let Supabase/Postgres handle UUID generation
    // If ID is empty string, Supabase will try to cast it to UUID and fail with "invalid input syntax for type uuid"
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
        style_text: source.style_text
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

  const handlePrint = (style: Style) => {
    const win = window.open('', 'TechPack', 'width=1000,height=800');
    if (!win) return;
    
    const categoriesHtml = template?.config.map(cat => {
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
        <div style="margin-top:40px;">
          <h3 style="background:#000; color:#fff; padding:10px; font-size:14px; text-transform:uppercase; letter-spacing:1px;">${cat.name}</h3>
          <div style="padding:10px;">${fields}</div>
        </div>
      `;
    }).join('');

    win.document.write(`
      <html><head><title>Tech Pack - ${style.style_number}</title><style>body { font-family: sans-serif; padding: 40px; color: #333; } .header { border-bottom: 5px solid #000; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; } .brand { font-size: 32px; font-weight: 900; } .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; } .box { border: 2px solid #000; padding: 10px; font-size: 13px; } .label { font-size: 10px; font-weight: bold; color: #666; display: block; margin-bottom: 3px; }</style></head>
      <body>
        <div class="header">
          <div class="brand">TINTURA SST<br/><span style="font-size:16px; color:#666;">STYLE TECH-PACK</span></div>
          <div style="text-align:right; font-weight:bold; font-size:18px;"># ${style.style_number}</div>
        </div>
        <div class="meta">
          <div class="box"><span class="label">Category</span><strong>${style.category}</strong></div>
          <div class="box"><span class="label">Packing Type</span><strong>${style.packing_type}</strong></div>
          <div class="box"><span class="label">Pcs/Box</span><strong>${style.pcs_per_box}</strong></div>
        </div>
        ${categoriesHtml}
        <script>window.onload = () => { setTimeout(() => window.print(), 1000); };</script>
      </body></html>
    `);
    win.document.close();
  };

  // UI Components
  const CategoryEditor = ({ category }: { category: StyleCategory }) => {
    if (!isEditing) return null;
    return (
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm mb-6">
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center gap-2">
          <Layers size={18} className="text-indigo-600"/>
          <h4 className="font-black text-slate-700 text-xs uppercase tracking-widest">{category.name}</h4>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
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
                      <button onClick={() => {
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
    );
  };

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
          <button onClick={() => setIsEditing({ id: '', style_number: '', category: 'Casuals', packing_type: 'pouch', pcs_per_box: 0, style_text: '', tech_pack: {} })} className="bg-indigo-600 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-black hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all active:scale-95"><Plus size={20}/> New Style</button>
        </div>
      </div>

      <div className="relative">
        <input 
          type="text" 
          placeholder="Search by Style Number or Category..." 
          className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-bold shadow-sm bg-white text-black"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <Search className="absolute left-4 top-4 text-slate-400" size={24}/>
      </div>

      {viewMode === 'catalog' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fade-in">
          {filteredStyles.map(style => (
            <div key={style.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-300 transition-all group overflow-hidden flex flex-col">
              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-4">
                   <div className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">{style.category}</div>
                   <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onClick={() => handlePrint(style)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Printer size={16}/></button>
                     <button onClick={() => handleDelete(style.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                   </div>
                </div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">{style.style_number}</h3>
                <p className="text-slate-500 text-xs font-medium line-clamp-2 leading-relaxed">{style.style_text || 'No description provided.'}</p>
                
                <div className="mt-6 flex items-center gap-4">
                  <div className="flex -space-x-2">
                     {Object.values(style.tech_pack).flatMap(cat => Object.values(cat)).flatMap(item => item.attachments).slice(0, 4).map((att, i) => (
                       <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-indigo-100 flex items-center justify-center text-indigo-600 overflow-hidden shadow-sm">
                         {att.type === 'image' ? <img src={att.url} className="w-full h-full object-cover"/> : <FileText size={14}/>}
                       </div>
                     ))}
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {Object.values(style.tech_pack).flatMap(cat => Object.values(cat)).flatMap(item => item.attachments).length} Files
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
          ))}
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
                      <div className="mt-4 flex gap-2">
                        <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full uppercase">{style.category}</span>
                        <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-3 py-1 rounded-full uppercase">{style.packing_type}</span>
                      </div>
                   </div>
                   <div className="p-6 space-y-8 overflow-y-auto">
                      {template?.config.map(cat => (
                        <div key={cat.name}>
                          <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest border-b border-indigo-100 pb-2 mb-4">{cat.name}</h4>
                          <div className="space-y-6">
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                 <div className="col-span-1">
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Style Number</label>
                   <input required className="w-full border-2 border-slate-100 rounded-xl p-4 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-all" value={isEditing.style_number} onChange={e => setIsEditing({...isEditing, style_number: e.target.value})}/>
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
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Packing Type</label>
                   <select className="w-full border-2 border-slate-100 rounded-xl p-4 bg-white text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer" value={isEditing.packing_type} onChange={e => setIsEditing({...isEditing, packing_type: e.target.value})}>
                      <option value="pouch">Pouch</option>
                      <option value="cover">Cover</option>
                      <option value="box">Box</option>
                   </select>
                 </div>
                 <div className="col-span-1">
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Pcs / Box</label>
                   <input type="number" className="w-full border-2 border-slate-100 rounded-xl p-4 bg-white text-slate-900 font-black focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" value={isEditing.pcs_per_box} onChange={e => setIsEditing({...isEditing, pcs_per_box: parseInt(e.target.value) || 0})}/>
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

              {template?.config.map(cat => (
                <CategoryEditor key={cat.name} category={cat} />
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
                        const newConfig = [...template.config];
                        newConfig[catIdx].name = e.target.value;
                        setTemplate({ ...template, config: newConfig });
                      }}
                    />
                    <button onClick={() => {
                      const newConfig = template.config.filter((_, i) => i !== catIdx);
                      setTemplate({ ...template, config: newConfig });
                    }} className="text-red-300 hover:text-red-500"><Trash2 size={18}/></button>
                  </div>
                  <div className="space-y-2">
                    {cat.fields.map((field, fieldIdx) => (
                      <div key={fieldIdx} className="flex gap-2">
                        <input 
                          className="flex-1 bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                          value={field}
                          onChange={e => {
                            const newConfig = [...template.config];
                            newConfig[catIdx].fields[fieldIdx] = e.target.value;
                            setTemplate({ ...template, config: newConfig });
                          }}
                        />
                        <button onClick={() => {
                          const newConfig = [...template.config];
                          newConfig[catIdx].fields.splice(fieldIdx, 1);
                          setTemplate({ ...template, config: newConfig });
                        }} className="p-2 text-slate-300 hover:text-red-500"><X size={16}/></button>
                      </div>
                    ))}
                    <button 
                      onClick={() => {
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
