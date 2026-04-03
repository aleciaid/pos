/* ── Data Models ─────────────────────────────────────────── */

export interface Product {
    id: string;
    name: string;
    sku?: string;
    category?: string;
    price: number;
    cost?: number;
    stock: number;
    unit?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface Service {
    id: string;
    name: string;
    price: number;
    category?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface PaymentMethod {
    id: string;
    name: string;
    type: 'cash' | 'noncash';
    isActive: boolean;
}

export interface OrderItem {
    id: string;
    kind: 'product' | 'service';
    refId: string;
    name: string;
    qty: number;
    unitPrice: number;
    discountType?: 'amount' | 'percent';
    discountValue?: number;
    lineTotal: number;
}

export interface OrderPayment {
    methodId: string;
    methodName: string;
    type: 'cash' | 'noncash';
    cashReceived?: number;
    change?: number;
    refNo?: string;
}

export interface Order {
    id: string;
    orderNo: string;
    createdAt: string;
    items: OrderItem[];
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    grandTotal: number;
    payment: OrderPayment;
    note?: string;
    status: 'paid' | 'void';
}

export interface StockMovement {
    id: string;
    productId: string;
    delta: number;
    reason: string;
    createdAt: string;
    note?: string;
}

export interface Settings {
    adminPin: string;
    taxEnabledDefault: boolean;
    taxPercent: number;
    lowStockThreshold: number;
    lastOrderSeqByDate: Record<string, number>;
    storeName: string;
    storeAddress: string;
    qrisImageData?: string;      // base64 data-url of QRIS image
    qrisString?: string;         // decoded static QRIS payload
    webhookUrl?: string;          // URL to POST completed transaction (outgoing)
    qrisWebhookToken?: string;    // webhook.site token for receiving payment notifications
    qrisUniqueCodeEnabled?: boolean; // Enable 2-digit unique code
}

/* ── Cart State (in-memory) ──────────────────────────────── */

export interface CartItem {
    id: string;
    kind: 'product' | 'service';
    refId: string;
    name: string;
    qty: number;
    unitPrice: number;
    stock: number; // only relevant for products
    discountType?: 'amount' | 'percent';
    discountValue?: number;
}

export type Role = 'kasir' | 'admin' | null;
