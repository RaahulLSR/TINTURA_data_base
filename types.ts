
export enum UserRole {
  ADMIN = 'ADMIN',
  SUB_UNIT = 'SUB_UNIT',
  QC = 'QC',
  MATERIALS = 'MATERIALS',
  INVENTORY = 'INVENTORY',
  SALES = 'SALES'
}

export interface AppUser {
  id: string | number;
  username: string;
  role: UserRole;
  full_name: string;
}

export enum OrderStatus {
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS', 
  QC = 'QC', 
  QC_APPROVED = 'QC_APPROVED', 
  PACKED = 'PACKED',
  COMPLETED = 'COMPLETED'
}

export enum BarcodeStatus {
  GENERATED = 'GENERATED',
  DETAILS_FILLED = 'DETAILS_FILLED',
  PUSHED_OUT_OF_SUBUNIT = 'PUSHED_OUT_OF_SUBUNIT',
  QC_APPROVED = 'QC_APPROVED',
  COMMITTED_TO_STOCK = 'COMMITTED_TO_STOCK',
  SOLD = 'SOLD'
}

export enum MaterialStatus {
  PENDING = 'PENDING',
  PARTIALLY_APPROVED = 'PARTIALLY_APPROVED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export interface Unit {
  id: number;
  name: string;
  is_main: boolean;
}

export interface SizeBreakdown {
  color: string;
  s: number;
  m: number;
  l: number;
  xl: number;
  xxl: number;
  xxxl: number;
}

export interface Attachment {
  name: string;
  url: string;
  type: 'image' | 'document';
}

export interface Order {
  id: string;
  order_no: string;
  unit_id: number;
  style_number: string;
  quantity: number;
  box_count?: number; 
  actual_box_count?: number; 
  last_barcode_serial?: number; 
  attachments?: Attachment[]; 
  attachment_url?: string; 
  attachment_name?: string; 
  qc_attachment_url?: string; 
  size_breakdown?: SizeBreakdown[]; 
  completion_breakdown?: SizeBreakdown[]; 
  description: string;
  qc_notes?: string; 
  target_delivery_date: string; 
  status: OrderStatus;
  created_at?: string;
  size_format?: 'standard' | 'numeric';
}

// --- Style Database Types ---
export type ConsumptionType = 'items_per_pc' | 'pcs_per_item';

export interface TechPackSizeVariant {
  sizes: string[];
  text: string;
  attachments: Attachment[];
  consumption_type?: ConsumptionType;
  consumption_val?: number;
}

export interface TechPackVariant {
  colors: string[]; // Selected colors for this specific variant instruction
  text: string;
  attachments: Attachment[];
  sizeVariants?: TechPackSizeVariant[]; // support for nested size-specific splits
  consumption_type?: ConsumptionType;
  consumption_val?: number;
}

export interface TechPackItem {
  text: string;
  attachments: Attachment[];
  variants?: TechPackVariant[]; // support for color-specific splits
  consumption_type?: ConsumptionType;
  consumption_val?: number;
}

export interface StyleCategory {
  name: string;
  fields: string[];
}

export interface Style {
  id: string;
  style_number: string;
  category: string;
  packing_type: string;
  pcs_per_box: number;
  style_text: string;
  tech_pack: Record<string, Record<string, TechPackItem>>;
  created_at?: string;
  garment_type?: string;
  demographic?: string;
  available_colors?: string[];
  available_sizes?: string[];
  size_type?: 'letter' | 'number';
}

export interface StyleTemplate {
  id: number;
  config: StyleCategory[];
}
// --- End Style Database Types ---

export interface MaterialRequest {
  id: string;
  order_id: string;
  requested_by_name?: string; 
  material_content: string;
  quantity_requested: number;
  quantity_approved: number;
  unit: string; 
  attachments?: Attachment[]; 
  status: MaterialStatus;
  created_at: string;
}

export interface MaterialApproval {
    id: number;
    request_id: string;
    qty_approved: number;
    created_at: string;
    approved_by_name?: string;
}

export interface OrderLog {
    id: number;
    order_id: string;
    log_type: 'STATUS_CHANGE' | 'MANUAL_UPDATE' | 'CREATION';
    message: string;
    created_at: string;
    created_by_name?: string;
}

export interface StockCommit {
  id: number;
  created_at: string;
  total_items: number;
  note?: string;
}

export interface Barcode {
  id: string;
  barcode_serial: string;
  order_id: string;
  style_number: string;
  size?: string;
  status: BarcodeStatus;
  invoice_id?: string; 
  commit_id?: number; 
}

export interface Invoice {
  id: string;
  invoice_no: string;
  customer_name: string;
  total_amount: number;
  created_at: string;
}

export const getNextOrderStatus = (current: OrderStatus): OrderStatus | null => {
  switch (current) {
    case OrderStatus.ASSIGNED: return OrderStatus.IN_PROGRESS;
    case OrderStatus.IN_PROGRESS: return OrderStatus.QC;
    case OrderStatus.QC: return OrderStatus.QC_APPROVED;
    case OrderStatus.QC_APPROVED: return OrderStatus.COMPLETED; 
    case OrderStatus.PACKED: return OrderStatus.COMPLETED;
    default: return null;
  }
};

export const getNextBarcodeStatus = (current: BarcodeStatus): BarcodeStatus | null => {
  switch (current) {
    case BarcodeStatus.GENERATED: return BarcodeStatus.DETAILS_FILLED;
    case BarcodeStatus.DETAILS_FILLED: return BarcodeStatus.PUSHED_OUT_OF_SUBUNIT;
    case BarcodeStatus.PUSHED_OUT_OF_SUBUNIT: return BarcodeStatus.QC_APPROVED;
    case BarcodeStatus.QC_APPROVED: return BarcodeStatus.COMMITTED_TO_STOCK;
    case BarcodeStatus.COMMITTED_TO_STOCK: return BarcodeStatus.SOLD;
    default: return null;
  }
};

export const formatOrderNumber = (order: Partial<Order>): string => {
  if (!order.order_no) return 'ORD-NEW';
  const numericMatch = order.order_no.match(/ORD-(\d+)/);
  const serial = numericMatch ? numericMatch[1] : order.order_no;
  const stylePart = order.style_number 
    ? order.style_number.split('-')[0].trim() 
    : 'STYLE';
  return `ORD-${stylePart}-${serial}`;
};
