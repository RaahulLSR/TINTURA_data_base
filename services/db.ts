
import { supabase } from './supabase';
// Export supabase for centralized access in components like AdminDashboard
export { supabase };
// Added formatOrderNumber to the imports from types
import { Order, OrderStatus, MaterialRequest, Barcode, BarcodeStatus, Unit, MaterialStatus, Invoice, SizeBreakdown, AppUser, UserRole, StockCommit, MaterialApproval, OrderLog, Attachment, Style, StyleTemplate, BulkEditHistory, formatOrderNumber, DetailedRequirement, ConsumptionType } from '../types';

const API_BASE = (typeof window !== 'undefined' && (window.location.protocol === 'file:' || window.location.hostname === 'localhost'))
  ? 'https://tintura-mail.vercel.app'
  : '';

// --- Forecast Calculation Core Engine ---
export const calculateOrderForecast = (order: Order, style: Style): DetailedRequirement[] => {
  if (!style || !order.size_breakdown) return [];
  
  const detailedReqs: DetailedRequirement[] = [];
  const sizeKeys = ['s', 'm', 'l', 'xl', 'xxl', 'xxxl'] as const;
  const sizeLabels = order.size_format === 'numeric' ? ['65', '70', '75', '80', '85', '90'] : ['S', 'M', 'L', 'XL', 'XXL', '3XL'];

  const getRowTotal = (row: SizeBreakdown) => (row.s || 0) + (row.m || 0) + (row.l || 0) + (row.xl || 0) + (row.xxl || 0) + (row.xxxl || 0);
  const calculateVal = (qty: number, type: ConsumptionType, val: number) => !val ? 0 : (type === 'items_per_pc' ? qty * val : qty / val);

  for (const catName in style.tech_pack) {
    for (const fieldName in style.tech_pack[catName]) {
      const item = style.tech_pack[catName][fieldName];
      const req: DetailedRequirement = { name: fieldName, total: 0, breakdown: [] };

      if (item.variants) {
        for (const variant of item.variants) {
          const matchingRows = order.size_breakdown.filter(r => variant.colors.includes(r.color));
          if (matchingRows.length === 0) continue;

          if (variant.sizeVariants) {
            for (const sv of variant.sizeVariants) {
              const targetKeys = sizeKeys.filter((_, i) => sv.sizes.includes(sizeLabels[i]));
              const qty = matchingRows.reduce((sum, row) => sum + targetKeys.reduce((s, k) => s + (row[k] || 0), 0), 0);
              
              if (qty > 0) {
                const rType = sv.consumption_type || variant.consumption_type || item.consumption_type || 'items_per_pc';
                const rVal = sv.consumption_val !== undefined ? sv.consumption_val : (variant.consumption_val !== undefined ? variant.consumption_val : (item.consumption_val || 0));
                const calc = calculateVal(qty, rType, rVal);
                
                req.breakdown.push({
                  label: `${variant.colors.join('/')} - ${sv.sizes.join('/')}`,
                  count: qty,
                  calc: Math.ceil(calc * 100) / 100,
                  text: sv.text || variant.text || item.text,
                  attachments: sv.attachments.length > 0 ? sv.attachments : (variant.attachments.length > 0 ? variant.attachments : item.attachments)
                });
                req.total += calc;
              }
            }
          } else if (variant.consumption_type) {
            const qty = matchingRows.reduce((sum, row) => sum + getRowTotal(row), 0);
            const calc = calculateVal(qty, variant.consumption_type, variant.consumption_val || 0);
            req.breakdown.push({
              label: `Color: ${variant.colors.join('/')}`,
              count: qty,
              calc: Math.ceil(calc * 100) / 100,
              text: variant.text || item.text,
              attachments: variant.attachments.length > 0 ? variant.attachments : item.attachments
            });
            req.total += calc;
          }
        }
      } else if (item.consumption_type) {
        const calc = calculateVal(order.quantity, item.consumption_type, item.consumption_val || 0);
        req.breakdown.push({
          label: "Global Requirement",
          count: order.quantity,
          calc: Math.ceil(calc * 100) / 100,
          text: item.text,
          attachments: item.attachments
        });
        req.total = calc;
      }

      if (req.total > 0) {
        req.total = Math.ceil(req.total * 100) / 100;
        detailedReqs.push(req);
      }
    }
  }
  return detailedReqs;
};

// --- Generic History Helpers ---
const recordHistory = async (table: string, description: string, items: any[]): Promise<void> => {
  if (items.length === 0) return;
  const snapshot: Record<string, any> = {};
  items.forEach(item => { snapshot[item.id] = item; });
  const { error } = await supabase.from(table).insert([{
    description,
    affected_count: items.length,
    snapshot
  }]);
  if (error) console.error(`History recording failed for ${table}:`, error.message);
};

const undoHistory = async (historyTable: string, targetTable: string, historyId: string): Promise<{ success: boolean; error?: string }> => {
  const { data: history, error: fetchError } = await supabase.from(historyTable).select('*').eq('id', historyId).single();
  if (fetchError || !history) return { success: false, error: 'History record not found' };

  const snapshot = history.snapshot as Record<string, any>;
  const objects = Object.values(snapshot);

  try {
    // Perform a batch upsert to ensure all records are restored atomically
    const { error: upsertError } = await supabase.from(targetTable).upsert(objects);
    if (upsertError) throw upsertError;

    await supabase.from(historyTable).delete().eq('id', historyId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

// --- Style Database Services ---
export const fetchStyles = async (): Promise<Style[]> => {
  const { data, error } = await supabase.from('styles').select('*').order('style_number', { ascending: true });
  if (error || !data) return [];
  return data as Style[];
};

export const fetchStyleByNumber = async (styleNum: string): Promise<Style | null> => {
    const { data, error } = await supabase.from('styles').select('*').eq('style_number', styleNum).maybeSingle();
    if (error || !data) return null;
    return data as Style;
};

export const upsertStyle = async (style: Partial<Style>): Promise<{ data: Style | null, error: string | null }> => {
  const { data, error } = await supabase.from('styles').upsert([style]).select().single();
  if (error) return { data: null, error: error.message };
  return { data: data as Style, error: null };
};

export const deleteStyle = async (id: string): Promise<void> => {
  await supabase.from('styles').delete().eq('id', id);
};

export const fetchStyleTemplate = async (): Promise<StyleTemplate | null> => {
  const { data, error } = await supabase.from('style_templates').select('*').eq('id', 1).single();
  if (error || !data) return null;
  return data as StyleTemplate;
};

export const updateStyleTemplate = async (config: any[]): Promise<void> => {
  await supabase.from('style_templates').upsert([{ id: 1, config, updated_at: new Date().toISOString() }]);
};

// --- Style History ---
export const recordBulkEditHistory = (desc: string, styles: Style[]) => recordHistory('bulk_edit_history', desc, styles);
export const fetchBulkEditHistory = async () => {
  const { data } = await supabase.from('bulk_edit_history').select('*').order('created_at', { ascending: false }).limit(50);
  return (data || []) as BulkEditHistory[];
};
export const undoBulkEdit = (id: string) => undoHistory('bulk_edit_history', 'styles', id);

// --- Order History ---
export const recordOrderEditHistory = (desc: string, orders: Order[]) => recordHistory('order_edit_history', desc, orders);
export const fetchOrderEditHistory = async () => {
  const { data } = await supabase.from('order_edit_history').select('*').order('created_at', { ascending: false }).limit(50);
  return (data || []) as BulkEditHistory[];
};
export const undoOrderEdit = (id: string) => undoHistory('order_edit_history', 'orders', id);

// --- Order Services ---
export const fetchOrders = async (): Promise<Order[]> => {
  const { data, error } = await supabase.from('orders').select('*').or('deleted.eq.false,deleted.is.null').order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as Order[];
};

export const syncAllOrdersWithStyles = async (): Promise<{ updated: number; total: number }> => {
  const orders = await fetchOrders();
  const styles = await fetchStyles();
  let updatedCount = 0;

  for (const order of orders) {
    const stylePrefix = order.style_number.split(' - ')[0].trim();
    const match = styles.find(s => s.style_number.trim().toLowerCase() === stylePrefix.toLowerCase());

    if (match) {
      const canonicalStyleName = `${match.style_number} - ${match.style_text}`;
      const canonicalSizeFormat = match.size_type === 'number' ? 'numeric' : 'standard';
      const recalculatedForecast = calculateOrderForecast(order, match);

      // Check if data actually needs an update to prevent redundant writes
      const needsUpdate = 
        order.style_number !== canonicalStyleName || 
        order.size_format !== canonicalSizeFormat ||
        JSON.stringify(order.material_forecast) !== JSON.stringify(recalculatedForecast);

      if (needsUpdate) {
        const { error } = await supabase.from('orders').update({
          style_number: canonicalStyleName,
          size_format: canonicalSizeFormat,
          material_forecast: recalculatedForecast
        }).eq('id', order.id);

        if (!error) {
          updatedCount++;
          await addOrderLog(order.id, 'MANUAL_UPDATE', `Master Sync: Material forecasts and style blueprint recalculated from Database.`);
        }
      }
    }
  }

  return { updated: updatedCount, total: orders.length };
};

export const updateOrderDetails = async (orderId: string, updates: Partial<Order>): Promise<{ success: boolean; error: string | null }> => {
    // Record history for single order update
    const { data: original } = await supabase.from('orders').select('*').eq('id', orderId).single();
    if (original) await recordOrderEditHistory(`Individual Update: ${formatOrderNumber(original)}`, [original]);

    const payload: any = {};
    const allowedKeys = ['style_number', 'unit_id', 'quantity', 'description', 'target_delivery_date', 'size_breakdown', 'size_format', 'attachments', 'box_count', 'material_forecast'];
    allowedKeys.forEach(k => { if ((updates as any)[k] !== undefined) payload[k] = (updates as any)[k]; });
    const { error } = await supabase.from('orders').update(payload).eq('id', orderId);
    if (error) return { success: false, error: error.message };
    await addOrderLog(orderId, 'MANUAL_UPDATE', 'Order details revised by Admin.');
    return { success: true, error: null };
};

export const createOrder = async (order: Partial<Order>): Promise<{ data: Order | null, error: string | null }> => {
    const { data: seqValue, error: seqError } = await supabase.rpc('next_order_no');
    if (seqError || !seqValue) return { data: null, error: 'Failed to generate order number' };
    const orderNo = `ORD-${seqValue}`;
    const payload: any = {
        order_no: orderNo,
        unit_id: order.unit_id,
        style_number: order.style_number,
        quantity: order.quantity,
        size_breakdown: order.size_breakdown,
        description: order.description,
        target_delivery_date: order.target_delivery_date,
        status: OrderStatus.ASSIGNED,
        deleted: false
    };
    const optionalKeys: (keyof Order)[] = ['box_count', 'size_format', 'attachments'];
    optionalKeys.forEach(key => { if (order[key] !== undefined) payload[key] = order[key]; });
    const { data, error } = await supabase.from('orders').insert([payload]).select().single();
    if (error) return { data: null, error: error.message };
    if (data) await addOrderLog(data.id, 'CREATION', `Order #${orderNo} Launched.`);
    return { data: data as Order, error: null };
};

export const deleteOrder = async (orderId: string): Promise<void> => {
    await supabase.from('orders').update({ deleted: true }).eq('id', orderId);
};

export const updateOrderStatus = async (orderId: string, status: OrderStatus, notes?: string, completionData?: any, qcAttachmentUrl?: string): Promise<void> => {
   const payload: any = { status, qc_notes: notes };
   if (completionData) {
       payload.completion_breakdown = completionData.completion_breakdown;
       payload.actual_box_count = completionData.actual_box_count;
   }
   if (qcAttachmentUrl) payload.qc_attachment_url = qcAttachmentUrl;
   await supabase.from('orders').update(payload).eq('id', orderId);
   await addOrderLog(orderId, 'STATUS_CHANGE', `Status: ${status}${notes ? ` - ${notes}` : ''}`);
};

// --- Other Services ---
export const triggerOrderEmail = async (orderId: string, isEdit: boolean = false): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await fetch(`${API_BASE}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId, is_edit: isEdit })
    });
    const result = await response.json();
    return { success: response.ok, message: result.message };
  } catch (error) {
    return { success: false, message: 'Network error triggering email.' };
  }
};

export const triggerMaterialEmail = async (orderId: string): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await fetch(`${API_BASE}/api/send-material-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId })
    });
    const result = await response.json();
    return { success: response.ok, message: result.message };
  } catch (error) {
    return { success: false, message: 'Network error triggering material email.' };
  }
};

export const authenticateUser = async (username: string, password: string): Promise<AppUser | null> => {
    const { data, error } = await supabase.from('app_users').select('*').eq('username', username).eq('password', password).single();
    if (error || !data) return null;
    return { id: data.id, username: data.username, role: data.role as UserRole, full_name: data.full_name };
};

export const fetchOrderLogs = async (orderId?: string): Promise<OrderLog[]> => {
    let query = supabase.from('order_logs').select('*').order('created_at', { ascending: false });
    if (orderId) query = query.eq('order_id', orderId);
    const { data, error } = await query;
    if (error || !data) return [];
    return data as OrderLog[];
};

export const addOrderLog = async (orderId: string, type: 'STATUS_CHANGE' | 'MANUAL_UPDATE' | 'CREATION', message: string) => {
    await supabase.from('order_logs').insert([{ order_id: orderId, log_type: type, message: message, created_by_name: 'System' }]);
};

export const fetchUnits = async (): Promise<Unit[]> => {
    const { data, error } = await supabase.from('units').select('*').order('id');
    if (error || !data) return [];
    return data as Unit[];
};

export const fetchMaterialRequests = async (): Promise<MaterialRequest[]> => {
    const { data, error } = await supabase.from('material_requests').select('*').order('created_at', { ascending: false });
    if (error || !data) return [];
    return data as MaterialRequest[];
};

export const createMaterialRequest = async (req: Partial<MaterialRequest>) => {
    await supabase.from('material_requests').insert([{
        order_id: req.order_id,
        material_content: req.material_content,
        quantity_requested: req.quantity_requested,
        unit: req.unit || 'Nos',
        attachments: req.attachments || [], 
        status: MaterialStatus.PENDING
    }]);
};

export const updateMaterialRequest = async (id: string, updates: Partial<MaterialRequest>) => {
    await supabase.from('material_requests').update(updates).eq('id', id);
};

export const deleteMaterialRequest = async (id: string) => {
    await supabase.from('material_requests').delete().eq('id', id);
};

export const fetchMaterialApprovals = async (requestId: string): Promise<MaterialApproval[]> => {
    const { data, error } = await supabase.from('material_approvals').select('*').eq('request_id', requestId).order('created_at', { ascending: true });
    if (error || !data) return [];
    return data as MaterialApproval[];
};

export const approveMaterialRequest = async (id: string, qtyApprovedNow: number, currentTotalApproved: number, newStatus: MaterialStatus) => {
    await supabase.from('material_approvals').insert([{ request_id: id, qty_approved: qtyApprovedNow, approved_by_name: 'Materials Dept' }]);
    await supabase.from('material_requests').update({ quantity_approved: currentTotalApproved + qtyApprovedNow, status: newStatus }).eq('id', id);
};

export const fetchBarcodes = async (statusFilter?: BarcodeStatus): Promise<Barcode[]> => {
    let query = supabase.from('barcodes').select('*');
    if (statusFilter) query = query.eq('status', statusFilter);
    const { data, error } = await query;
    if (error || !data) return [];
    return data as Barcode[];
};

export const fetchBarcodesBySerialList = async (serials: string[]): Promise<Barcode[]> => {
    if (serials.length === 0) return [];
    const { data, error } = await supabase.from('barcodes').select('*').in('barcode_serial', serials);
    if (error || !data) return [];
    return data as Barcode[];
};

export const generateBarcodes = async (orderId: string, count: number, style: string, size: string) => {
    const orderRes = await supabase.from('orders').select('order_no, last_barcode_serial').eq('id', orderId).single();
    if (orderRes.error || !orderRes.data) return [];
    let currentSerial = orderRes.data.last_barcode_serial || 0;
    const newBarcodes = [];
    for (let i = 1; i <= count; i++) {
        currentSerial++;
        newBarcodes.push({
            barcode_serial: `${orderRes.data.order_no};${style};${size};${currentSerial.toString().padStart(5, '0')}`,
            order_id: orderId, style_number: style, size: size, status: BarcodeStatus.GENERATED
        });
    }
    await supabase.from('barcodes').insert(newBarcodes);
    await supabase.from('orders').update({ last_barcode_serial: currentSerial }).eq('id', orderId);
    return newBarcodes as any[];
};

export const commitBarcodesToStock = async (serials: string[]) => {
    const { data: commitData, error: commitError } = await supabase.from('stock_commits').insert([{ total_items: serials.length }]).select().single();
    if (commitError) return;
    await supabase.from('barcodes').update({ status: BarcodeStatus.COMMITTED_TO_STOCK, commit_id: commitData.id }).in('barcode_serial', serials);
};

export const fetchStockCommits = async (): Promise<StockCommit[]> => {
    const { data, error } = await supabase.from('stock_commits').select('*').order('created_at', { ascending: false });
    if (error || !data) return [];
    return data as StockCommit[];
};

export const fetchBarcodesByCommit = async (commitId: number): Promise<Barcode[]> => {
    const { data, error } = await supabase.from('barcodes').select('*').eq('commit_id', commitId);
    if (error || !data) return [];
    return data as Barcode[];
};

export const fetchInvoices = async (): Promise<Invoice[]> => {
    const { data, error } = await supabase.from('invoices').select('*').order('created_at', { ascending: false });
    if (error || !data) return [];
    return data as Invoice[];
};

export const fetchInvoiceItems = async (invoiceId: string): Promise<Barcode[]> => {
    const { data, error } = await supabase.from('barcodes').select('*').eq('invoice_id', invoiceId);
    if (error || !data) return [];
    return data as Barcode[];
}

export const createInvoice = async (customerName: string, barcodeIds: string[], customInvoiceNo?: string): Promise<Invoice> => {
    const invoiceNo = customInvoiceNo || `INV-${Date.now()}`;
    const { data: invData, error: invError } = await supabase.from('invoices').insert([{ invoice_no: invoiceNo, customer_name: customerName, total_amount: barcodeIds.length * 25.00 }]).select().single();
    if (invError) throw invError;
    await supabase.from('barcodes').update({ status: BarcodeStatus.SOLD, invoice_id: invData.id }).in('id', barcodeIds);
    return invData as Invoice;
};

export const uploadOrderAttachment = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const { error } = await supabase.storage.from('order-attachments').upload(fileName, file);
    if (error) return null;
    const { data } = supabase.storage.from('order-attachments').getPublicUrl(fileName);
    return data.publicUrl;
};
