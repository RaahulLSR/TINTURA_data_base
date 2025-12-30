
import React, { useEffect, useState, useRef } from 'react';
import { fetchStyles, upsertStyle, fetchStyleTemplate, deleteStyle, uploadOrderAttachment, fetchOrders, recordBulkEditHistory, syncAllOrdersWithStyles } from '../services/db';
import { Style, StyleTemplate, Attachment, TechPackItem, ConsumptionType, Order } from '../types';
import { 
  Plus, Search, Grid, Copy, Trash2, Settings, ArrowLeftRight, CheckSquare, Square, FileUp, Table, BookOpen, ChevronRight, Edit3, Printer, X, FileSpreadsheet, History, Calculator, Loader2
} from 'lucide-react';

// Imported modular components
import { StyleFullView } from '../components/style-db/StyleFullView';
import { AuditMatrixModal } from '../components/style-db/AuditMatrixModal';
import { BulkUpdateModal } from '../components/style-db/BulkUpdateModal';
import { BulkImportModal } from '../components/style-db/BulkImportModal';
import { EditorModal } from '../components/style-db/EditorModal';
import { BulkAttributeUpdateModal } from '../components/style-db/BulkAttributeUpdateModal';
import { HistoryModal } from '../components/style-db/HistoryModal';

export const StyleDatabase: React.FC = () => {
  const [styles, setStyles] = useState<Style[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
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
  const [isAuditViewOpen, setIsAuditViewOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{ category?: string, field?: string } | null>(null);
  
  // Sync State
  const [isSyncing, setIsSyncing] = useState(false);

  // Bulk Mode States
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedStyleIds, setSelectedStyleIds] = useState<string[]>([]);
  const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [isBulkAttributeUpdateOpen, setIsBulkAttributeUpdateOpen] = useState(false);
  const [bulkImportData, setBulkImportData] = useState<any[]>([]);
  const bulkFileRef = useRef<HTMLInputElement>(null);

  // Bulk Selection Filters
  const [bulkSelFilter, setBulkSelFilter] = useState({ garment: '', demographic: '', category: '' });
  
  // Revised Bulk Update Form Structure
  const [bulkUpdateMeta, setBulkUpdateMeta] = useState<{
    strategy: 'overwrite' | 'append';
  }>({
    strategy: 'overwrite'
  });

  const [bulkFieldValues, setBulkFieldValues] = useState<Record<string, {
    isEnabled: boolean;
  } & TechPackItem>>({});

  const loadData = async () => {
    const [s, t, o] = await Promise.all([fetchStyles(), fetchStyleTemplate(), fetchOrders()]);
    setStyles(s);
    setTemplate(t);
    setOrders(o);
    const existingGarments = Array.from(new Set([...garmentTypeOptions, ...s.map(style => style.garment_type).filter(Boolean) as string[]]));
    const existingDemos = Array.from(new Set([...demographicOptions, ...s.map(style => style.demographic).filter(Boolean) as string[]]));
    setGarmentTypeOptions(existingGarments);
    setDemographicOptions(existingDemos);
    
    if (t) {
      const initialValues: Record<string, any> = {};
      t.config.forEach(cat => {
        cat.fields.forEach(f => {
          initialValues[`${cat.name}|${f}`] = { isEnabled: false, text: '', attachments: [] };
        });
      });
      setBulkFieldValues(initialValues);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleGlobalSync = async () => {
    if (!confirm("This will recalculate material forecasts for ALL existing orders based on current blueprints in the Style Database. This ensures consistency after tech-pack changes. Continue?")) return;
    
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

  const filteredStyles = styles.filter(s => 
    s.style_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.category.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (s.garment_type && s.garment_type.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSaveStyle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing) return;
    setIsUploading(true);

    // RECORD HISTORY BEFORE SAVE IF EDITING
    if (isEditing.id) {
       const original = styles.find(s => s.id === isEditing.id);
       if (original) {
          await recordBulkEditHistory(`Individual Update: ${original.style_number}`, [original]);
       }
    }

    const payload: Partial<Style> = { ...isEditing };
    if (!payload.id || payload.id === "") delete payload.id;
    const { error } = await upsertStyle(payload);
    setIsUploading(false);
    if (!error) { 
      setIsEditing(null); 
      setEditTarget(null);
      loadData(); 
    } else { 
      alert(error); 
    }
  };

  const handleNewStyle = () => {
    setIsEditing({ 
      id: '', style_number: '', category: 'Casuals', packing_type: 'pouch', pcs_per_box: 0, 
      style_text: '', garment_type: 'T-shirt', demographic: 'Men', 
      available_colors: [''], available_sizes: ['S', 'M', 'L', 'XL', 'XXL', '3XL'], 
      size_type: 'letter', tech_pack: {} 
    });
    setEditTarget(null);
  };

  const handleCopyStyle = (sourceStyle: Style) => {
    const copy = JSON.parse(JSON.stringify(sourceStyle));
    copy.id = ''; 
    copy.style_number = `${sourceStyle.style_number} (Copy)`;
    setIsEditing(copy);
    setEditTarget(null);
  };

  const handleDelete = async (id: string) => { 
    if (confirm("Permanently delete this style?")) { await deleteStyle(id); loadData(); setViewingStyle(null); } 
  };

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

    const filesArr = Array.from(files) as File[];
    for (const file of filesArr) {
      const url = await uploadOrderAttachment(file);
      if (url) target.push({ name: file.name, url, type: file.type.startsWith('image/') ? 'image' : 'document' });
    }
    setIsEditing(updated);
    setIsUploading(false);
  };

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      const splitCSV = (row: string) => {
          const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
          return row.split(regex).map(val => {
              let cleaned = val.trim();
              if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
                  cleaned = cleaned.substring(1, cleaned.length - 1);
              }
              return cleaned;
          });
      };
      const headers = splitCSV(lines[0]).map(h => h.trim());
      const parsedData = lines.slice(1).map(line => {
        const values = splitCSV(line);
        if (values.length < headers.length) return null;
        const entry: any = {};
        headers.forEach((header, i) => entry[header] = values[i]);
        return entry;
      }).filter(Boolean);
      setBulkImportData(parsedData);
      setIsBulkImportModalOpen(true);
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  const handleExecuteBulkImport = async () => {
    setIsUploading(true);
    try {
      for (const row of bulkImportData) {
        const styleNum = row['Style No.'] || row['Style No'] || row['StyleNo'];
        const gType = row['GarmentType'] || row['Garment Type'] || row['Garment'];
        const demo = row['Demographic'] || row['Demo'];
        const cat = row['Category'] || row['Cat'];
        const desc = row['Short description'] || row['Description'] || row['Short Description'];
        const cols = row['Available colours'] || row['Available colors'] || row['Colours'] || row['Colors'];
        const sizes = row['size variants'] || row['Size variants'] || row['Sizes'];
        const fabricValue = row['fabric'] || row['Fabric'];

        const newStyle: Partial<Style> = {
          style_number: styleNum || 'NEW-STYLE',
          garment_type: gType || 'T-shirt',
          demographic: demo || 'Men',
          category: cat || 'Casuals',
          style_text: desc || '',
          available_colors: (cols || '').split(',').map((s: string) => s.trim()).filter(Boolean),
          available_sizes: (sizes || '').split(',').map((s: string) => s.trim()).filter(Boolean),
          packing_type: 'pouch',
          pcs_per_box: 1,
          tech_pack: {},
          size_type: (sizes || '').match(/[a-zA-Z]/) ? 'letter' : 'number'
        };

        if (fabricValue) {
          const fabricNote = `Fabrication: ${fabricValue}`;
          newStyle.style_text = newStyle.style_text ? `${newStyle.style_text}\n${fabricNote}` : fabricNote;
        }
        await upsertStyle(newStyle);
      }
      alert(`Successfully created ${bulkImportData.length} new styles.`);
      setIsBulkImportModalOpen(false);
      setIsBulkMode(false);
      loadData();
    } catch (err) {
      alert("Import failed: " + err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedStyleIds.length === 0) return;
    setIsUploading(true);
    try {
      const selectedStyles = styles.filter(s => selectedStyleIds.includes(s.id));
      const enabledUpdates = (Object.entries(bulkFieldValues) as [string, typeof bulkFieldValues[string]][]).filter(([_, val]) => val.isEnabled);
      
      if (enabledUpdates.length === 0) {
        alert("Please select at least one field to update.");
        setIsUploading(false);
        return;
      }

      // RECORD HISTORY BEFORE BULK UPDATE
      const updatedFieldNames = enabledUpdates.map(([k]) => k.split('|')[1]).join(', ');
      await recordBulkEditHistory(`Bulk Update: ${updatedFieldNames} (${bulkUpdateMeta.strategy})`, selectedStyles);

      for (const style of selectedStyles) {
        const updatedStyle = JSON.parse(JSON.stringify(style));
        const { strategy } = bulkUpdateMeta;

        for (const [key, fieldData] of enabledUpdates) {
          const [category, field] = key.split('|');
          if (!updatedStyle.tech_pack[category]) updatedStyle.tech_pack[category] = {};
          
          const mergeText = (current: string, next: string) => strategy === 'overwrite' ? next : (current ? current + '\n' + next : next);
          const mergeAttachments = (current: Attachment[], next: Attachment[]) => strategy === 'overwrite' ? next : [...(current || []), ...next];

          const bulkItem = { ...fieldData };
          delete (bulkItem as any).isEnabled;

          const currentItem = updatedStyle.tech_pack[category][field] || { text: '', attachments: [] };

          if (!bulkItem.variants) {
            currentItem.text = mergeText(currentItem.text, bulkItem.text);
            currentItem.attachments = mergeAttachments(currentItem.attachments, bulkItem.attachments);
            if (bulkItem.consumption_type) currentItem.consumption_type = bulkItem.consumption_type;
            if (bulkItem.consumption_val !== undefined) currentItem.consumption_val = bulkItem.consumption_val;
            if (strategy === 'overwrite') delete (currentItem as any).variants;
          } else {
            if (strategy === 'overwrite') {
               currentItem.variants = [];
               delete (currentItem as any).text;
               delete (currentItem as any).attachments;
            } else if (!currentItem.variants) {
               currentItem.variants = [];
            }

            bulkItem.variants.forEach(bulkVar => {
              const validColors = bulkVar.colors.filter(c => updatedStyle.available_colors?.includes(c));
              if (validColors.length === 0) return;

              let targetVar = currentItem.variants!.find(v => JSON.stringify(v.colors.sort()) === JSON.stringify(validColors.sort()));
              if (!targetVar) {
                targetVar = { colors: validColors, text: '', attachments: [] };
                currentItem.variants!.push(targetVar);
              }

              if (!bulkVar.sizeVariants) {
                targetVar.text = mergeText(targetVar.text, bulkVar.text);
                targetVar.attachments = mergeAttachments(targetVar.attachments, bulkVar.attachments);
                if (bulkVar.consumption_type) targetVar.consumption_type = bulkVar.consumption_type;
                if (bulkVar.consumption_val !== undefined) targetVar.consumption_val = bulkVar.consumption_val;
                if (strategy === 'overwrite') delete (targetVar as any).sizeVariants;
              } else {
                if (strategy === 'overwrite') {
                  targetVar.sizeVariants = [];
                  delete (targetVar as any).text;
                  delete (targetVar as any).attachments;
                } else if (!targetVar.sizeVariants) {
                  targetVar.sizeVariants = [];
                }

                bulkVar.sizeVariants.forEach(bulkSizeVar => {
                  const validSizes = bulkSizeVar.sizes.filter(s => updatedStyle.available_sizes?.includes(s));
                  if (validSizes.length === 0) return;

                  let targetSizeVar = targetVar!.sizeVariants!.find(sv => JSON.stringify(sv.sizes.sort()) === JSON.stringify(validSizes.sort()));
                  if (!targetSizeVar) {
                    targetSizeVar = { sizes: validSizes, text: '', attachments: [] };
                    targetVar!.sizeVariants!.push(targetSizeVar);
                  }

                  targetSizeVar.text = mergeText(targetSizeVar.text, bulkSizeVar.text);
                  targetSizeVar.attachments = mergeAttachments(targetSizeVar.attachments, bulkSizeVar.attachments);
                  if (bulkSizeVar.consumption_type) targetSizeVar.consumption_type = bulkSizeVar.consumption_type;
                  if (bulkSizeVar.consumption_val !== undefined) targetSizeVar.consumption_val = bulkSizeVar.consumption_val;
                });
              }
            });
          }
          updatedStyle.tech_pack[category][field] = currentItem;
        }
        await upsertStyle(updatedStyle);
      }
      alert("Bulk update completed successfully.");
      setIsBulkUpdateModalOpen(false);
      setIsBulkMode(false);
      setSelectedStyleIds([]);
      loadData();
    } catch (err) {
      alert("Error during bulk update: " + err);
    } finally {
      setIsUploading(false);
    }
  };

  const toggleSelectStyle = (id: string) => {
    setSelectedStyleIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const applyBulkFilterSelection = (isSelecting: boolean) => {
    const matchingIds = styles.filter(s => {
      const matchesGarment = !bulkSelFilter.garment || s.garment_type === bulkSelFilter.garment;
      const matchesDemographic = !bulkSelFilter.demographic || s.demographic === bulkSelFilter.demographic;
      const matchesCategory = !bulkSelFilter.category || s.category === bulkSelFilter.category;
      return matchesGarment && matchesDemographic && matchesCategory;
    }).map(s => s.id);
    if (isSelecting) setSelectedStyleIds(prev => Array.from(new Set([...prev, ...matchingIds])));
    else setSelectedStyleIds(prev => prev.filter(id => !matchingIds.includes(id)));
  };

  const handleMatrixCellClick = (style: Style, catName: string, fieldName?: string) => {
    setIsEditing(style);
    setEditTarget({ category: catName, field: fieldName });
    setIsAuditViewOpen(false);
  };

  const checkCompleteness = (style: Style, cat: string, field: string) => {
    const item = style.tech_pack[cat]?.[field];
    if (!item) return false;
    return !!( (item.text && item.text.trim() !== '') || (item.attachments && item.attachments.length > 0) || (item.variants && item.variants.length > 0) );
  };

  const handlePrint = (style: Style) => {
    const win = window.open('', 'StylePrint', 'width=1000,height=800');
    if (!win || !template) return;

    // Helper to render attachments in a grid for the printout
    const renderAttachmentsHtml = (attachments: Attachment[]) => {
      if (!attachments || attachments.length === 0) return '';
      const images = attachments.filter(a => a.type === 'image');
      const docs = attachments.filter(a => a.type === 'document');
      
      let html = '<div style="margin-top: 15px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">';
      images.forEach(img => {
        html += `
          <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; break-inside: avoid; background: #fff;">
            <img src="${img.url}" style="width: 100%; display: block;"/>
            <div style="padding: 6px; font-size: 8px; font-weight: bold; background: #fff; text-align: center; color: #64748b; border-top: 1px solid #e2e8f0;">${img.name}</div>
          </div>`;
      });
      html += '</div>';
      
      if (docs.length > 0) {
        html += '<div style="margin-top: 8px; font-size: 9px; color: #4f46e5; font-weight: bold; padding-left: 5px;">';
        docs.forEach(doc => {
          html += `<div>• DOCUMENT: ${doc.name}</div>`;
        });
        html += '</div>';
      }
      return html;
    };

    const techPackHtml = template.config.filter(c => c.name !== "General Info").map(cat => {
        const fields = cat.fields.map(f => {
            const item = style.tech_pack[cat.name]?.[f] || { text: 'N/A', attachments: [] };
            let contentHtml = '';
            if (item.variants) {
                contentHtml = item.variants.map(v => {
                    let sizeHtml = '';
                    if (v.sizeVariants) {
                        sizeHtml = `<div style="margin-top:15px; display:grid; grid-template-columns:1fr; gap:12px;">${v.sizeVariants.map(sv => `
                            <div style="background:#fff; border:1px solid #e2e8f0; border-left:10px solid #2563eb; padding:20px; border-radius:12px; break-inside:avoid;">
                                <div style="margin-bottom:12px; display:flex; flex-wrap:wrap; gap:6px;">
                                    ${sv.sizes.map(sz => `<span style="background:#2563eb; color:#fff; display:inline-block; padding:4px 10px; border-radius:6px; font-weight:900; font-size:16px;">SIZE: ${sz}</span>`).join('')}
                                    ${sv.consumption_type ? `<span style="background:#f1f5f9; color:#1e293b; padding:4px 10px; border-radius:6px; font-weight:bold; font-size:12px;">Ratio: ${sv.consumption_val} ${sv.consumption_type === 'items_per_pc' ? 'Items/PC' : 'PCS/Item'}</span>` : ''}
                                </div>
                                <div style="font-size:18px; font-weight:900; color:#1e293b; line-height:1.3;">${sv.text || '---'}</div>
                                ${renderAttachmentsHtml(sv.attachments)}
                            </div>
                        `).join('')}</div>`;
                    }
                    return `
                      <div style="border:2px solid #e2e8f0; padding:20px; border-radius:15px; margin-top:15px; background:#f8fafc; break-inside:avoid;">
                        <div style="margin-bottom:10px; display: flex; justify-content: space-between; align-items: center;">
                          <div>${v.colors.map(c => `<span style="background:#1e293b; color:#fff; font-size:10px; font-weight:900; padding:4px 10px; border-radius:5px; text-transform:uppercase; margin-right:5px;">${c}</span>`).join('')}</div>
                          ${v.consumption_type ? `<div style="font-size: 10px; font-weight: bold; color: #4f46e5;">RATIO: ${v.consumption_val} ${v.consumption_type === 'items_per_pc' ? 'Items/PC' : 'PCS/Item'}</div>` : ''}
                        </div>
                        <div style="font-size:20px; color:#1e293b; font-weight:900; line-height:1.3;">${v.text || '---'}</div>
                        ${renderAttachmentsHtml(v.attachments)}
                        ${sizeHtml}
                      </div>`;
                }).join('');
            } else {
              contentHtml = `
                <div style="break-inside:avoid;">
                  <div style="font-size:24px; font-weight:900; color:#1e293b; background:#f8fafc; padding:25px; border-radius:15px; border:2px solid #e2e8f0; line-height:1.3;">
                    ${item.text || '---'}
                    ${item.consumption_type ? `<div style="margin-top: 10px; font-size: 12px; font-weight: bold; color: #4f46e5; background: #fff; padding: 5px 10px; border-radius: 6px; display: inline-block; border: 1px solid #e2e8f0;">Global Ratio: ${item.consumption_val} ${item.consumption_type === 'items_per_pc' ? 'Items/PC' : 'PCS/Item'}</div>` : ''}
                  </div>
                  ${renderAttachmentsHtml(item.attachments)}
                </div>`;
            }
            return `
                <div style="margin-bottom:30px; border-bottom:1px solid #eee; padding-bottom:15px; break-inside:avoid;">
                    <div style="font-size:11px; font-weight:bold; color:#666; text-transform:uppercase; margin-bottom:6px; letter-spacing: 1px;">${f}</div>
                    ${contentHtml}
                </div>`;
        }).join('');
        return `
            <div style="margin-top:40px; page-break-before:always;">
                <h3 style="background:#1e293b; color:#fff; padding:12px 20px; font-size:14px; text-transform:uppercase; letter-spacing:2px; border-radius: 8px;">${cat.name}</h3>
                <div style="padding:15px;">${fields}</div>
            </div>`;
    }).join('');

    win.document.write(`
      <html>
        <head>
          <title>Tech Pack - ${style.style_number}</title>
          <style>
            body { font-family: 'Segoe UI', system-ui, -apple-system, Arial, sans-serif; padding: 40px; font-size: 14px; color: #333; line-height: 1.4; background: #fff; }
            .header { text-align: center; border-bottom: 5px solid #1e293b; padding-bottom: 25px; margin-bottom: 35px; }
            .brand { font-size: 36px; font-weight: 900; text-transform: uppercase; margin: 0; color: #1e293b; }
            .title { font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 10px 0 0 0; color: #64748b; letter-spacing: 2px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .box { padding: 15px; border: 2px solid #e2e8f0; border-radius: 12px; background: #fcfcfc; }
            .label { font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 900; letter-spacing: 1px; }
            .value { font-size: 16px; font-weight: 900; color: #1e293b; margin-top: 4px; }
            .section-title { font-size: 20px; font-weight: 900; border-bottom: 4px solid #1e293b; padding-bottom: 8px; margin-top: 45px; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px; color: #1e293b; }
            .summary-box { padding: 25px; border: 2px solid #e2e8f0; min-height: 80px; background:#f8fafc; border-radius:15px; font-size:18px; font-weight: bold; color: #475569; line-height: 1.5; white-space: pre-wrap; }
            @media print {
              body { padding: 20px; }
              @page { margin: 1.5cm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="brand">TINTURA SST</div>
            <div class="title">Master Technical Specification Package</div>
          </div>
          
          <div class="grid">
            <div class="box"><span class="label">Style Number</span><div class="value">${style.style_number}</div></div>
            <div class="box"><span class="label">Garment Category</span><div class="value">${style.category}</div></div>
            <div class="box"><span class="label">Style Specification</span><div class="value">${style.garment_type || 'N/A'}</div></div>
            <div class="box"><span class="label">Market Segment</span><div class="value">${style.demographic || 'N/A'}</div></div>
            <div class="box"><span class="label">Packing Specs</span><div class="value">${style.packing_type} (${style.pcs_per_box} pcs)</div></div>
            <div class="box"><span class="label">Issue Date</span><div class="value">${new Date().toLocaleDateString()}</div></div>
          </div>

          <div class="section-title">Color & Size Blueprint</div>
          <div style="display: flex; gap: 20px; margin-bottom: 40px;">
            <div style="flex: 1; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
              <span class="label">Approved Palette</span>
              <div style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px;">
                ${(style.available_colors || []).filter(c => c).map(c => `<span style="background:#f1f5f9; color:#1e293b; font-size:10px; font-weight:bold; padding:4px 10px; border-radius:6px; border: 1px solid #e2e8f0; text-transform: uppercase;">${c}</span>`).join('')}
              </div>
            </div>
            <div style="flex: 1; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
              <span class="label">Size Grid (${style.size_type})</span>
              <div style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px;">
                ${(style.available_sizes || []).map(s => `<span style="background:#4f46e5; color:#fff; font-size:10px; font-weight:bold; padding:4px 10px; border-radius:6px; text-transform: uppercase;">${s}</span>`).join('')}
              </div>
            </div>
          </div>

          <div class="section-title">Global Construction Summary</div>
          <div class="summary-box">
            ${style.style_text || "Standard technical construction procedures apply. No specific summary provided."}
          </div>

          ${techPackHtml}

          <div style="margin-top: 60px; text-align: center; border-top: 1px solid #eee; padding-top: 30px;">
            <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">
              Internal Document Control: Tintura SST Automated Engineering System
            </div>
            <div style="font-size: 8px; color: #cbd5e1; margin-top: 5px;">
              Blueprint ID: ${style.id} | Page 1 of Content
            </div>
          </div>

          <script>window.onload = () => { setTimeout(() => window.print(), 1000); };</script>
        </body>
      </html>`);
    win.document.close();
  };

  const unionColors = Array.from(new Set(styles.flatMap(s => s.available_colors || []))).filter(Boolean).sort();
  const unionSizes = Array.from(new Set(styles.flatMap(s => s.available_sizes || []))).filter(Boolean).sort();

  if (viewingStyle) return <StyleFullView style={viewingStyle} template={template} onBack={() => setViewingStyle(null)} onEdit={() => { setIsEditing(viewingStyle); setViewingStyle(null); }} onPrint={() => handlePrint(viewingStyle)} onDelete={() => handleDelete(viewingStyle.id)} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-4">
        <div><h2 className="text-3xl font-black text-slate-800 flex items-center gap-3"><div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg"><BookOpen size={28}/></div>Style Technical Database</h2><p className="text-slate-500 text-sm mt-1">Master Tech-Packs and Design Blueprint Management</p></div>
        <div className="flex items-center gap-3">
          <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex">
            <button onClick={() => setViewMode('catalog')} className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'catalog' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Grid size={18}/> Catalog</button>
            <button onClick={() => setViewMode('compare')} className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'compare' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><ArrowLeftRight size={18}/> Compare</button>
          </div>
          <div className="h-8 w-px bg-slate-200 mx-2"></div>

          <button 
            onClick={handleGlobalSync} 
            disabled={isSyncing}
            className="p-3 bg-white border border-slate-200 text-slate-500 hover:text-orange-600 rounded-xl transition-all flex items-center gap-2 font-bold text-sm shadow-sm active:scale-95 disabled:opacity-50" 
            title="Recalculate All Forecasts Across Orders"
          >
            {isSyncing ? <Loader2 size={20} className="animate-spin" /> : <Calculator size={20} className="text-orange-500"/>}
            <span>Sync All Forecasts</span>
          </button>

          <button onClick={() => setIsHistoryOpen(true)} className="p-3 bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 rounded-xl transition-all flex items-center gap-2 font-bold text-sm" title="Technical Audit Logs"><History size={20}/> History</button>
          <button onClick={() => setIsBulkAttributeUpdateOpen(true)} className="p-3 bg-white border border-slate-200 text-slate-500 hover:text-green-600 hover:border-green-500 rounded-xl transition-all flex items-center gap-2 font-bold text-sm" title="Sync Specific Values via CSV"><FileSpreadsheet size={20}/> Sync Values (CSV)</button>
          
          <button onClick={() => setIsAuditViewOpen(true)} className="p-3 bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-500 rounded-xl transition-all flex items-center gap-2 font-bold text-sm" title="Data Completeness Matrix"><Table size={20}/> Matrix Audit</button>
          <button onClick={() => { setIsBulkMode(!isBulkMode); setSelectedStyleIds([]); }} className={`p-3 rounded-xl border transition-all flex items-center gap-2 font-bold text-sm ${isBulkMode ? 'bg-orange-600 text-white border-orange-600 shadow-lg' : 'bg-white border-slate-200 text-slate-500 hover:border-orange-500 hover:text-orange-600'}`}><CheckSquare size={20}/> {isBulkMode ? 'Exit Bulk Mode' : 'Bulk Selection'}</button>
          <button onClick={() => setIsConfigOpen(true)} className="p-3 bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 rounded-xl transition-all"><Settings size={20}/></button>
          <button onClick={handleNewStyle} className="bg-indigo-600 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-black hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all active:scale-95"><Plus size={20}/> New Style</button>
        </div>
      </div>

      <div className="relative"><input type="text" placeholder="Search by Style Number, Category, or Garment Type..." className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 outline-none transition-all font-bold shadow-sm bg-white text-black" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/><Search className="absolute left-4 top-4 text-slate-400" size={24}/></div>

      {isBulkMode && (
        <div className="bg-slate-900/5 p-6 rounded-3xl border-2 border-dashed border-indigo-200 animate-fade-in">
           <div className="flex flex-col md:flex-row items-end gap-4">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Garment Type Filter</label><select className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={bulkSelFilter.garment} onChange={e => setBulkSelFilter({...bulkSelFilter, garment: e.target.value})}><option value="">All Garment Types</option>{garmentTypeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
                 <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Demographic Filter</label><select className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={bulkSelFilter.demographic} onChange={e => setBulkSelFilter({...bulkSelFilter, demographic: e.target.value})}><option value="">All Demographics</option>{demographicOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
                 <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Category Filter</label><select className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={bulkSelFilter.category} onChange={e => setBulkSelFilter({...bulkSelFilter, category: e.target.value})}><option value="">All Categories</option><option value="Casuals">Casuals</option><option value="Lite">Lite</option><option value="Sportz">Sportz</option></select></div>
              </div>
              <div className="flex gap-2 shrink-0"><button onClick={() => applyBulkFilterSelection(true)} className="px-5 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center gap-2"><CheckSquare size={16}/> Select All Matching</button><button onClick={() => applyBulkFilterSelection(false)} className="px-5 py-3 bg-white text-slate-500 border border-slate-200 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"><Square size={16}/> Deselect All Matching</button></div>
           </div>
        </div>
      )}

      {viewMode === 'catalog' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fade-in relative pb-24">
          {filteredStyles.map(style => {
            const isSelected = selectedStyleIds.includes(style.id);
            return (
              <div key={style.id} className={`bg-white rounded-2xl border shadow-sm hover:shadow-xl transition-all group overflow-hidden flex flex-col ${isBulkMode && isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200'}`}>
                <div className="p-6 flex-1 cursor-pointer relative" onClick={() => isBulkMode ? toggleSelectStyle(style.id) : setViewingStyle(style)}>
                  {isBulkMode && <div className="absolute top-4 right-4 z-10">{isSelected ? <CheckSquare className="text-indigo-600"/> : <Square className="text-slate-300"/>}</div>}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-2">
                      <div className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">{style.garment_type}</div>
                      <div className="bg-indigo-50 px-3 py-1 rounded-full text-[10px] font-black text-indigo-500 uppercase tracking-widest">{style.demographic}</div>
                    </div>
                    {!isBulkMode && <div className="flex gap-2" onClick={e => e.stopPropagation()}><button onClick={() => handlePrint(style)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"><Printer size={16}/></button><button onClick={() => handleDelete(style.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16}/></button></div>}
                  </div>
                  <div className="flex items-center justify-between group/title"><h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2 group-hover/title:text-indigo-600 transition-colors">{style.style_number}</h3><ChevronRight size={20} className="text-slate-300 group-hover:text-indigo-600 transition-all transform group-hover:translate-x-1" /></div>
                  <p className="text-slate-500 text-xs font-medium line-clamp-2 leading-relaxed mb-4">{style.style_text || 'No description provided.'}</p>
                </div>
                {!isBulkMode && (
                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
                    <button onClick={() => { setIsEditing(style); setEditTarget(null); }} className="flex-1 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 hover:border-indigo-500 hover:text-indigo-600 transition-all flex items-center justify-center gap-2"><Edit3 size={14}/> Edit</button>
                    <button onClick={(() => handleCopyStyle(style))} className="p-2.5 bg-white text-slate-400 border border-slate-200 rounded-xl hover:text-indigo-600 hover:border-indigo-600 transition-all" title="Create Copy"><Copy size={16}/></button>
                    <button onClick={() => { if (compareList.find(s => s.id === style.id)) setCompareList(prev => prev.filter(s => s.id !== style.id)); else { setCompareList(prev => [...prev, style]); setViewMode('compare'); } }} className={`p-2.5 rounded-xl border transition-all ${compareList.find(s => s.id === style.id) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border border-slate-200 hover:border-indigo-500 hover:text-indigo-600'}`}><ArrowLeftRight size={18}/></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isBulkMode && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
           <div className="bg-slate-900 text-white rounded-full px-8 py-4 shadow-2xl flex items-center gap-6 border border-white/10">
              <div className="flex flex-col"><span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Bulk Actions</span><span className="text-xl font-black">{selectedStyleIds.length} Selected</span></div>
              <div className="h-10 w-px bg-white/20"></div>
              <div className="flex items-center gap-3">
                {selectedStyleIds.length > 0 && <button onClick={() => setIsBulkUpdateModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-full font-black text-sm transition-all active:scale-95 shadow-lg flex items-center gap-2"><Edit3 size={18}/> Edit technical fields</button>}
                <button onClick={() => bulkFileRef.current?.click()} className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2.5 rounded-full font-black text-sm transition-all active:scale-95 shadow-lg flex items-center gap-2"><FileUp size={18}/> Create Bulk (CSV)</button>
                <input type="file" ref={bulkFileRef} accept=".csv" className="hidden" onChange={handleCSVImport} />
              </div>
              <button onClick={() => { setSelectedStyleIds([]); setIsBulkMode(false); }} className="text-slate-400 hover:text-white transition-colors ml-2"><X/></button>
           </div>
        </div>
      )}

      {viewMode === 'compare' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-x-auto min-h-[600px] animate-fade-in">{compareList.length === 0 ? (<div className="p-20 text-center text-slate-400"><ArrowLeftRight size={48} className="mx-auto mb-4 opacity-20"/><p className="text-xl font-bold">Desk Empty</p><button onClick={() => setViewMode('catalog')} className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold">Back to Catalog</button></div>) : (<div className="p-8 inline-flex gap-8">{compareList.map(style => (<div key={style.id} className="w-96 shrink-0 bg-slate-50/50 rounded-3xl border border-slate-200 flex flex-col shadow-inner overflow-hidden"><div className="p-6 bg-white border-b border-slate-200 sticky top-0 z-10"><div className="flex justify-between items-start"><h3 className="text-2xl font-black text-slate-800">{style.style_number}</h3><button onClick={() => setCompareList(prev => prev.filter(s => s.id !== style.id))} className="p-1 text-slate-300 hover:text-red-500 transition-colors"><X size={20}/></button></div><div className="mt-4 flex flex-wrap gap-2"><span className="text-[10px] font-black bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full uppercase">{style.category}</span><span className="text-[10px] font-black bg-slate-100 text-slate-700 px-3 py-1 rounded-full uppercase">{style.garment_type}</span></div></div><div className="p-6 space-y-8 overflow-y-auto">{template?.config.filter(c => c.name !== "General Info").map(cat => (<div key={cat.name}><h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest border-b border-indigo-100 pb-2 mb-4">{cat.name}</h4><div className="space-y-6">{cat.fields.map(field => { const item = style.tech_pack[cat.name]?.[field] || { text: '---', attachments: [] }; return (<div key={field}><div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{field}</div>{!item.variants ? (<div className="text-sm font-medium text-slate-700 whitespace-pre-wrap">{item.text}</div>) : (<div className="space-y-4">{item.variants.map((v, vIdx) => (<div key={vIdx} className="bg-white border rounded-xl p-3 shadow-sm"><div className="flex flex-wrap gap-1 mb-2">{v.colors.map(c => <span key={c} className="bg-indigo-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase">{c}</span>)}</div><div className="text-xs text-slate-700">{v.text}</div></div>))}</div>)}</div>); })}</div></div>))}</div></div>))}</div>)}</div>
      )}

      {isEditing && (
        <EditorModal 
          isEditing={isEditing} styles={styles} template={template} 
          setIsEditing={setIsEditing} handleSaveStyle={handleSaveStyle} handleCopyStyle={handleCopyStyle} 
          handleFileUpload={handleFileUpload} editTarget={editTarget}
          garmentTypeOptions={garmentTypeOptions} setGarmentTypeOptions={setGarmentTypeOptions}
          demographicOptions={demographicOptions} setDemographicOptions={setDemographicOptions}
          isUploading={isUploading}
        />
      )}

      {isAuditViewOpen && (
        <AuditMatrixModal 
          styles={styles} template={template} onClose={() => setIsAuditViewOpen(false)} 
          onCellClick={handleMatrixCellClick} checkCompleteness={checkCompleteness} 
        />
      )}

      {isHistoryOpen && (
        <HistoryModal 
          onClose={() => setIsHistoryOpen(false)}
          onUndoSuccess={loadData}
        />
      )}

      {isBulkUpdateModalOpen && (
        <BulkUpdateModal 
          styles={styles} template={template} selectedStyleIds={selectedStyleIds} 
          bulkUpdateMeta={bulkUpdateMeta} setBulkUpdateMeta={setBulkUpdateMeta} 
          bulkFieldValues={bulkFieldValues} setBulkFieldValues={setBulkFieldValues}
          isUploading={isUploading} setIsUploading={setIsUploading}
          onClose={() => setIsBulkUpdateModalOpen(false)} onExecute={handleBulkUpdate}
          unionColors={unionColors}
          unionSizes={unionSizes}
          orders={orders}
        />
      )}

      {isBulkImportModalOpen && (
        <BulkImportModal 
          bulkImportData={bulkImportData} isUploading={isUploading} 
          onClose={() => setIsBulkImportModalOpen(false)} onExecute={handleExecuteBulkImport} 
        />
      )}

      {isBulkAttributeUpdateOpen && (
        <BulkAttributeUpdateModal 
          styles={styles} 
          template={template} 
          onClose={() => setIsBulkAttributeUpdateOpen(false)} 
          onRefresh={loadData}
        />
      )}
    </div>
  );
};
