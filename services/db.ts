
import { supabase } from './supabase';
import { Order, OrderStatus, MaterialRequest, Barcode, BarcodeStatus, Unit, MaterialStatus, Invoice, SizeBreakdown, AppUser, UserRole, StockCommit, MaterialApproval, OrderLog, Attachment, Style, StyleTemplate } from '../types';

const API_BASE = (typeof window !== 'undefined' && (window.location.protocol === 'file:' || window.location.hostname === 'localhost'))
  ? 'https://tintura-mail.vercel.app'
  : '';

// --- Style Database Services ---
export const fetchStyles = async (): Promise<Style[]> => {
  const { data, error } = await supabase.from('styles').select('*').order('style_number', { ascending: true });
  if (error || !data) return [];
  return data as Style[];
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
// --- End Style Database Services ---

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

export const fetchOrders = async (): Promise<Order[]> => {
  const { data, error } = await supabase.from('orders').select('*').or('deleted.eq.false,deleted.is.null').order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as Order[];
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

export const updateOrderDetails = async (orderId: string, updates: Partial<Order>): Promise<{ success: boolean; error: string | null }> => {
    const payload: any = {};
    const allowedKeys = ['style_number', 'unit_id', 'quantity', 'description', 'target_delivery_date', 'size_breakdown', 'size_format', 'attachments', 'box_count'];
    allowedKeys.forEach(k => { if ((updates as any)[k] !== undefined) payload[k] = (updates as any)[k]; });
    const { error } = await supabase.from('orders').update(payload).eq('id', orderId);
    if (error) return { success: false, error: error.message };
    await addOrderLog(orderId, 'MANUAL_UPDATE', 'Order details revised by Admin.');
    return { success: true, error: null };
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
    const { data, error } = query;
    const { data: data_res, error: error_res } = await query;
    if (error_res || !data_res) return [];
    return data_res as Barcode[];
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
