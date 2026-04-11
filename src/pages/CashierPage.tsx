import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';
import { formatRupiah, generateId, todayStr, formatDateTime } from '../utils/format';
import type { CartItem, Order, OrderItem } from '../types';
import { productsDB } from '../db';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { QRCodeSVG } from 'qrcode.react';
import { generateDynamicQris } from '../utils/qris';

export default function CashierPage() {
    const {
        products, services, paymentMethods, orders, settings,
        cart, cartDiscount, cartDiscountType, cartNote, taxEnabled,
        addToCart, removeFromCart, updateCartQty, updateCartItemDiscount,
        setCartDiscount, setCartDiscountType, setCartNote, setTaxEnabled,
        clearCart, saveOrder, saveSettings,
    } = useStore();
    const role = useStore(s => s.role);
    const voidOrder = useStore(s => s.voidOrder);
    const addToast = useToastStore(s => s.addToast);

    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('all');
    const [mobileTab, setMobileTab] = useState<'products' | 'cart'>('products');
    const [showPayment, setShowPayment] = useState(false);
    const [selectedMethod, setSelectedMethod] = useState('');
    const [cashReceived, setCashReceived] = useState('');
    const [refNo, setRefNo] = useState('');
    const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
    const [detailOrder, setDetailOrder] = useState<Order | null>(null);
    const [showReport, setShowReport] = useState(false);
    const [historySearch, setHistorySearch] = useState('');
    const [historyPage, setHistoryPage] = useState(1);
    const [showQrisPopup, setShowQrisPopup] = useState(false);
    const [qrisCode, setQrisCode] = useState(0);       // 2-digit unique suffix
    const [qrisTimer, setQrisTimer] = useState(60);    // countdown seconds
    const [qrisExpired, setQrisExpired] = useState(false);
    const [qrisOrderRef, setQrisOrderRef] = useState(''); // order ref for polling
    const [qrisPaid, setQrisPaid] = useState(false);   // auto-confirmed via polling
    const [qrisStartTime, setQrisStartTime] = useState(0); // timestamp when QRIS popup opened
    const HISTORY_PER_PAGE = 5;
    const searchRef = useRef<HTMLInputElement>(null);

    // Today's orders
    const todayOrders = useMemo(() => {
        const today = new Date().toDateString();
        return orders.filter(o => new Date(o.createdAt).toDateString() === today).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }, [orders]);

    // Filtered history by search
    const filteredHistory = useMemo(() => {
        if (!historySearch.trim()) return todayOrders;
        const q = historySearch.toLowerCase();
        return todayOrders.filter(o =>
            o.orderNo.toLowerCase().includes(q) ||
            o.payment.methodName.toLowerCase().includes(q) ||
            o.items.some(i => i.name.toLowerCase().includes(q))
        );
    }, [todayOrders, historySearch]);

    // Paginated history
    const historyTotalPages = Math.max(1, Math.ceil(filteredHistory.length / HISTORY_PER_PAGE));
    const paginatedHistory = useMemo(() => {
        const start = (historyPage - 1) * HISTORY_PER_PAGE;
        return filteredHistory.slice(start, start + HISTORY_PER_PAGE);
    }, [filteredHistory, historyPage]);

    // Stats
    const paidToday = useMemo(() => todayOrders.filter(o => o.status === 'paid'), [todayOrders]);
    const voidToday = useMemo(() => todayOrders.filter(o => o.status === 'void'), [todayOrders]);
    const totalPendapatanToday = useMemo(() => paidToday.reduce((s, o) => s + o.grandTotal, 0), [paidToday]);

    // Categories
    const categories = useMemo(() => {
        const cats = new Set<string>();
        products.filter(p => p.isActive).forEach(p => { if (p.category) cats.add(p.category); });
        return ['all', ...Array.from(cats)];
    }, [products]);

    // Filtered products
    const filtered = useMemo(() => {
        let list = products.filter(p => p.isActive);
        if (category !== 'all') list = list.filter(p => p.category === category);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(p =>
                p.name.toLowerCase().includes(q) ||
                (p.sku && p.sku.toLowerCase().includes(q))
            );
        }
        return list;
    }, [products, search, category]);

    // Active services
    const activeServices = useMemo(() => services.filter(s => s.isActive), [services]);
    const activeMethods = useMemo(() => paymentMethods.filter(pm => pm.isActive), [paymentMethods]);

    // Calculations
    const calcLineTotal = (c: CartItem) => {
        let base = c.qty * c.unitPrice;
        if (c.discountValue && c.discountValue > 0) {
            if (c.discountType === 'percent') base -= base * c.discountValue / 100;
            else base -= c.discountValue;
        }
        return Math.max(0, base);
    };

    const subtotal = cart.reduce((sum, c) => sum + calcLineTotal(c), 0);
    const discountTotalCalc = cartDiscountType === 'percent' ? subtotal * cartDiscount / 100 : cartDiscount;
    const afterDiscount = Math.max(0, subtotal - discountTotalCalc);
    const taxAmount = taxEnabled ? afterDiscount * settings.taxPercent / 100 : 0;
    const grandTotal = afterDiscount + taxAmount;

    // Add product to cart
    const addProduct = useCallback((p: typeof products[0]) => {
        if (p.stock <= 0) { addToast('Stok habis!', 'error'); return; }
        const inCart = cart.find(c => c.refId === p.id && c.kind === 'product');
        if (inCart && inCart.qty >= p.stock) { addToast('Stok tidak cukup!', 'error'); return; }
        addToCart({ id: generateId(), kind: 'product', refId: p.id, name: p.name, qty: 1, unitPrice: p.price, stock: p.stock });
        addToast(`${p.name} ditambahkan`);
    }, [cart, addToCart, addToast]);

    // Add service to cart
    const addServiceItem = useCallback((s: typeof services[0]) => {
        addToCart({ id: generateId(), kind: 'service', refId: s.id, name: s.name, qty: 1, unitPrice: s.price, stock: 999 });
        addToast(`${s.name} ditambahkan`);
    }, [addToCart, addToast]);

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
                e.preventDefault();
                searchRef.current?.focus();
            }
            if (e.key === 'Enter' && !e.ctrlKey && document.activeElement === searchRef.current && filtered.length > 0) {
                addProduct(filtered[0]);
            }
            if (e.ctrlKey && e.key === 'Enter' && cart.length > 0) {
                e.preventDefault();
                setShowPayment(true);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [filtered, cart, addProduct]);

    // Check if selected method is QRIS
    const isQrisMethod = (methodId: string) => {
        const m = activeMethods.find(x => x.id === methodId);
        return m ? m.name.toLowerCase().includes('qris') : false;
    };

    // Grand total with QRIS unique code appended
    const qrisTotal = grandTotal + qrisCode;

    // Handle payment method selection — intercept QRIS
    const handleSelectMethod = (methodId: string) => {
        setSelectedMethod(methodId);
        if (isQrisMethod(methodId) && settings.qrisImageData) {
            if (settings.qrisUniqueCodeEnabled !== false) {
                const code = Math.floor(Math.random() * 90) + 10; // 10–99
                setQrisCode(code);
            } else {
                setQrisCode(0);
            }
        } else {
            setQrisCode(0);
        }
    };

    // Send webhook silently
    const sendWebhook = async (order: Order) => {
        const url = settings.webhookUrl?.trim();
        if (!url) return;
        try {
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'new_transaction',
                    order,
                    storeName: settings.storeName,
                    timestamp: new Date().toISOString(),
                }),
                signal: AbortSignal.timeout(8000),
            });
        } catch {
            // silently ignore webhook errors — never block cashier
        }
    };

    // Poll webhook.site to check for payment notification matching qrisTotal
    const checkQrisWebhook = async (expectedAmount: number, hasUniqueCode: boolean, startTime: number): Promise<boolean> => {
        const token = settings.qrisWebhookToken?.trim();
        if (!token) return false;
        try {
            const res = await fetch(
                `/api/webhook/token/${token}/requests?sorting=newest&limit=20&_t=${Date.now()}`,
                { 
                    signal: AbortSignal.timeout(5000),
                    cache: 'no-store',
                    headers: {
                        'Pragma': 'no-cache',
                        'Cache-Control': 'no-cache'
                    }
                }
            );
            if (!res.ok) return false;
            const data = await res.json();
            const requests: any[] = data.data || [];
            
            for (const req of requests) {
                let parsed: any;
                try {
                    parsed = typeof req.content === 'string'
                        ? JSON.parse(req.content)
                        : req.content;
                } catch { continue; }

                const payloadTs = parsed?.timestamp ?? parsed?.body?.timestamp ?? parsed?.[0]?.timestamp;
                const reqCreatedAtStr = (req.created_at || '').replace(' ', 'T') + 'Z';
                
                const receivedAt = (typeof payloadTs === 'number' && payloadTs > 1000000000)
                    ? (payloadTs < 10000000000 ? payloadTs * 1000 : payloadTs) // Handle seconds vs milliseconds
                    : new Date(reqCreatedAtStr).getTime();

                if (isNaN(receivedAt)) continue;

                // 1. Time Validation
                // Allow up to 90 seconds if using unique code. If no unique code, strict 65 seconds max 
                // AND must be essentially after the QRIS popup was opened (allowing 15s clock skew/delay).
                const timeDiff = Date.now() - receivedAt;
                const isRecent = timeDiff <= (hasUniqueCode ? 90_000 : 65_000);
                const isAfterPopup = receivedAt >= (startTime - 15_000); 
                
                if (!isRecent || (!hasUniqueCode && !isAfterPopup)) {
                    continue; // Skip if it doesn't meet the time criteria
                }

                try {
                    // 2. Amount & Payload Validation
                    let isAmountMatch = false;

                    // Extract amount from text notification (e.g., GoPay / Bank Jatim forwarder)
                    const inner = parsed?.body ?? (Array.isArray(parsed) ? parsed[0] : parsed);
                    const text: string = inner?.text ?? inner?.message ?? '';
                    if (text) {
                        const match = text.match(/Rp\.?\s*([\d.,]+)/i);
                        if (match) {
                            const raw = match[1].replace(/(?:\.|,)00$/, '').replace(/[.,]/g, '');
                            const receivedAmount = parseInt(raw, 10);
                            if (receivedAmount === expectedAmount) isAmountMatch = true;
                        }
                    }

                    // Recursive check for explicit numeric amounts anywhere in the JSON
                    if (!isAmountMatch) {
                        const checkAmountMatches = (obj: any): boolean => {
                            if (typeof obj === 'number') return obj === expectedAmount;
                            if (typeof obj === 'string') {
                                const cleanStr = obj.replace(/(?:\.|,)00$/, '').replace(/[^\d]/g, '');
                                if (cleanStr && parseInt(cleanStr, 10) === expectedAmount) return true;
                            }
                            if (Array.isArray(obj)) return obj.some(checkAmountMatches);
                            if (typeof obj === 'object' && obj !== null) {
                                return Object.values(obj).some(val => checkAmountMatches(val));
                            }
                            return false;
                        };
                        if (checkAmountMatches(parsed)) isAmountMatch = true;
                    }

                    // Fallback test-mode check
                    if (!isAmountMatch && (parsed?.received === true || (Array.isArray(parsed) && parsed.some(p => p?.received === true)))) {
                        isAmountMatch = true;
                    }

                    if (isAmountMatch) return true;

                } catch { continue; }
            }
            return false;
        } catch {
            return false;
        }
    };

    // QRIS timer + polling effect
    useEffect(() => {
        if (!showQrisPopup) return;
        // reset on open
        setQrisTimer(60);
        setQrisExpired(false);
        setQrisPaid(false);

        const hasWebhook = !!(settings.qrisWebhookToken?.trim());
        let secondsLeft = 60;
        let autoConfirmed = false;

        const tick = setInterval(async () => {
            secondsLeft -= 1;
            setQrisTimer(secondsLeft);

            // Poll webhook.site every 5 seconds
            if (hasWebhook && !autoConfirmed && secondsLeft > 0 && secondsLeft % 5 === 0) {
                const paid = await checkQrisWebhook(qrisTotal, qrisCode > 0, qrisStartTime);
                if (paid && !autoConfirmed) {
                    autoConfirmed = true;
                    setQrisPaid(true);
                    clearInterval(tick);
                    setTimeout(() => { checkout(); }, 1500);
                }
            }

            if (secondsLeft <= 0 && !autoConfirmed) {
                clearInterval(tick);
                setQrisExpired(true);
            }
        }, 1000);

        return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showQrisPopup]);

    // Checkout
    const checkout = async () => {
        if (!selectedMethod) { addToast('Pilih metode pembayaran!', 'error'); return; }
        const method = activeMethods.find(m => m.id === selectedMethod);
        if (!method) return;

        if (method.type === 'cash') {
            const received = parseFloat(cashReceived) || 0;
            if (received < grandTotal) { addToast('Uang diterima kurang!', 'error'); return; }
        }

        // For QRIS with image: require QRIS popup confirmation
        if (isQrisMethod(method.id) && settings.qrisImageData && !showQrisPopup) {
            const code = qrisCode || (settings.qrisUniqueCodeEnabled !== false ? Math.floor(Math.random() * 90) + 10 : 0);
            setQrisCode(code);
            // Pre-generate order ref for the polling check
            const dateStr = todayStr();
            const seq = (settings.lastOrderSeqByDate[dateStr] || 0) + 1;
            setQrisOrderRef(`POS-${dateStr}-${String(seq).padStart(4, '0')}`);
            setQrisStartTime(Date.now());
            setShowQrisPopup(true);
            return;
        }

        // Check stock
        for (const item of cart) {
            if (item.kind === 'product') {
                const product = products.find(p => p.id === item.refId);
                if (!product || product.stock < item.qty) {
                    addToast(`Stok ${item.name} tidak cukup!`, 'error'); return;
                }
            }
        }

        // Generate order number
        const dateStr = todayStr();
        const currentSeq = settings.lastOrderSeqByDate[dateStr] || 0;
        const nextSeq = currentSeq + 1;
        const orderNo = `POS-${dateStr}-${String(nextSeq).padStart(4, '0')}`;

        const orderItems: OrderItem[] = cart.map(c => ({
            id: generateId(),
            kind: c.kind,
            refId: c.refId,
            name: c.name,
            qty: c.qty,
            unitPrice: c.unitPrice,
            discountType: c.discountType,
            discountValue: c.discountValue,
            lineTotal: calcLineTotal(c),
        }));

        // For QRIS with unique code, use qrisTotal as actual paid amount
        const effectiveTotal = (isQrisMethod(method.id) && settings.qrisImageData && qrisCode > 0)
            ? qrisTotal
            : grandTotal;
        const received = parseFloat(cashReceived) || 0;
        const order: Order = {
            id: generateId(),
            orderNo,
            createdAt: new Date().toISOString(),
            items: orderItems,
            subtotal,
            discountTotal: discountTotalCalc,
            taxTotal: taxAmount,
            grandTotal: effectiveTotal,
            payment: {
                methodId: method.id,
                methodName: method.name,
                type: method.type,
                ...(method.type === 'cash' ? { cashReceived: received, change: received - effectiveTotal } : {}),
                ...(refNo ? { refNo } : {}),
                ...(qrisCode > 0 && isQrisMethod(method.id) ? { refNo: `QRIS-${qrisCode}` } : {}),
            },
            note: cartNote || undefined,
            status: 'paid',
        };

        // Decrement stock for products
        for (const item of cart) {
            if (item.kind === 'product') {
                const product = await productsDB.get(item.refId);
                if (product) {
                    product.stock -= item.qty;
                    product.updatedAt = new Date().toISOString();
                    await productsDB.put(product);
                }
            }
        }

        // Save order & update settings
        await saveOrder(order);
        await saveSettings({ ...settings, lastOrderSeqByDate: { ...settings.lastOrderSeqByDate, [dateStr]: nextSeq } });
        sendWebhook(order); // fire-and-forget

        setReceiptOrder(order);
        setShowPayment(false);
        setShowQrisPopup(false);
        clearCart();
        setCashReceived('');
        setRefNo('');
        setSelectedMethod('');
        setQrisCode(0);
        setQrisTimer(60);
        setQrisExpired(false);
        setQrisPaid(false);
        setQrisStartTime(0);
        setQrisOrderRef('');
        addToast('Transaksi berhasil! ✅');
    };

    // Reusable PDF builder — works for any Order
    const buildReceiptHTML = (order: Order) => {
        const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
        const dt = new Date(order.createdAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const itemRows = order.items.map(item => {
            const discLine = item.discountValue && item.discountValue > 0
                ? `<div style="display:flex;justify-content:space-between;font-size:10px;color:#888;padding-left:8px"><span>Diskon: ${item.discountType === 'percent' ? item.discountValue + '%' : fmt(item.discountValue)}</span><span>-${item.discountType === 'percent' ? fmt(item.unitPrice * item.qty * item.discountValue / 100) : fmt(item.discountValue)}</span></div>`
                : '';
            return `<div style="display:flex;justify-content:space-between;margin:3px 0;font-size:11px"><span>${item.name} x${item.qty}</span><span>${fmt(item.lineTotal)}</span></div>${discLine}`;
        }).join('');
        const discRow = order.discountTotal > 0 ? `<div style="display:flex;justify-content:space-between;font-size:11px;color:#b45309"><span>Diskon</span><span>-${fmt(order.discountTotal)}</span></div>` : '';
        const taxRow = order.taxTotal > 0 ? `<div style="display:flex;justify-content:space-between;font-size:11px"><span>Pajak</span><span>${fmt(order.taxTotal)}</span></div>` : '';
        const changeRow = order.payment.change && order.payment.change > 0 ? `<div style="display:flex;justify-content:space-between;font-size:11px;color:#065f46"><span>Kembalian</span><span>${fmt(order.payment.change)}</span></div>` : '';
        const refRow = order.payment.refNo ? `<div style="display:flex;justify-content:space-between;font-size:10px;color:#666"><span>No. Ref</span><span>${order.payment.refNo}</span></div>` : '';
        const noteRow = order.note ? `<p style="font-size:10px;color:#666;margin-top:6px">Catatan: ${order.note}</p>` : '';
        const addrRow = (settings.storeAddress || '').trim() ? `<p style="font-size:10px;color:#555;margin-top:2px;white-space:pre-line">${settings.storeAddress}</p>` : '';
        return `<div style="font-family:Arial,sans-serif;width:280px;padding:16px;background:#fff;color:#000">
            <div style="text-align:center;border-bottom:1px dashed #ccc;padding-bottom:10px;margin-bottom:10px">
                <p style="font-weight:bold;font-size:15px;margin:0">${settings.storeName || 'POS SYSTEM'}</p>
                ${addrRow}
                <p style="font-size:10px;color:#555;margin:4px 0 0">${dt}</p>
                <p style="font-family:monospace;font-size:11px;margin:2px 0 0">${order.orderNo}</p>
            </div>
            <div style="margin-bottom:10px">${itemRows}</div>
            <div style="border-top:1px dashed #ccc;padding-top:8px">
                <div style="display:flex;justify-content:space-between;font-size:11px"><span>Subtotal</span><span>${fmt(order.subtotal)}</span></div>
                ${discRow}${taxRow}
                <div style="border-top:1px dashed #ccc;margin:6px 0"></div>
                <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:13px"><span>Total</span><span>${fmt(order.grandTotal)}</span></div>
                <div style="display:flex;justify-content:space-between;font-size:10px;color:#666;margin-top:4px"><span>Bayar (${order.payment.methodName})</span><span>${fmt(order.payment.cashReceived || order.grandTotal)}</span></div>
                ${changeRow}${refRow}
            </div>
            ${noteRow}
            <div style="border-top:1px dashed #ccc;margin-top:10px;padding-top:8px;text-align:center">
                <p style="font-size:10px;color:#555">Terima kasih atas kunjungan Anda!</p>
            </div>
        </div>`;
    };

    const downloadReceiptPDF = async (order: Order) => {
        const html = buildReceiptHTML(order);
        const container = document.createElement('div');
        container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1';
        container.innerHTML = html;
        document.body.appendChild(container);
        try {
            const canvas = await html2canvas(container, { scale: 3, backgroundColor: '#ffffff', useCORS: true, logging: false });
            const imgData = canvas.toDataURL('image/png');
            const imgW = 80;
            const imgH = (canvas.height * imgW) / canvas.width;
            const pdf = new jsPDF({ unit: 'mm', format: [imgW, imgH + 10], orientation: 'portrait' });
            pdf.addImage(imgData, 'PNG', 0, 5, imgW, imgH);
            pdf.save(`nota-${order.orderNo}.pdf`);
        } finally {
            document.body.removeChild(container);
        }
    };

    const printReceipt = () => {
        if (!receiptOrder) return;
        const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
        const dt = new Date(receiptOrder.createdAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        const itemRows = receiptOrder.items.map(item => {
            const discLine = item.discountValue && item.discountValue > 0
                ? `<div class="row sm"><span style="padding-left:8px">Diskon: ${item.discountType === 'percent' ? item.discountValue + '%' : fmt(item.discountValue)}</span><span>-${item.discountType === 'percent' ? fmt(item.unitPrice * item.qty * item.discountValue / 100) : fmt(item.discountValue)}</span></div>`
                : '';
            return `<div class="row"><span>${item.name} × ${item.qty}</span><span>${fmt(item.lineTotal)}</span></div>${discLine}`;
        }).join('');

        const discRow = receiptOrder.discountTotal > 0
            ? `<div class="row" style="color:#b45309"><span>Diskon</span><span>-${fmt(receiptOrder.discountTotal)}</span></div>` : '';
        const taxRow = receiptOrder.taxTotal > 0
            ? `<div class="row"><span>Pajak</span><span>${fmt(receiptOrder.taxTotal)}</span></div>` : '';
        const changeRow = receiptOrder.payment.change && receiptOrder.payment.change > 0
            ? `<div class="row" style="color:#065f46"><span>Kembalian</span><span>${fmt(receiptOrder.payment.change)}</span></div>` : '';
        const refRow = receiptOrder.payment.refNo
            ? `<div class="row sm"><span>No. Ref</span><span>${receiptOrder.payment.refNo}</span></div>` : '';
        const noteRow = receiptOrder.note
            ? `<p class="sm" style="margin-top:6px">Catatan: ${receiptOrder.note}</p>` : '';
        const addrRow = (settings.storeAddress || '').trim()
            ? `<p class="sm" style="margin-top:3px;white-space:pre-line">${settings.storeAddress}</p>` : '';

        const html = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"/>
<title>Struk - ${receiptOrder.orderNo}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:12px;color:#000;background:#fff;width:76mm;margin:0 auto;padding:8px}
  .center{text-align:center}
  .bold{font-weight:bold}
  .lg{font-size:16px}
  .sm{font-size:11px;color:#555}
  .dashed{border-top:1px dashed #aaa;margin:8px 0}
  .row{display:flex;justify-content:space-between;align-items:flex-start;margin:3px 0}
  .total-row{display:flex;justify-content:space-between;font-weight:bold;font-size:14px;margin:4px 0}
  @media print{@page{margin:0;size:80mm auto}body{width:76mm}}
</style>
</head>
<body>
  <div class="center" style="margin-bottom:8px">
    <p class="bold lg">${settings.storeName || 'POS SYSTEM'}</p>
    ${addrRow}
    <p class="sm" style="margin-top:4px">${dt}</p>
    <p style="font-family:monospace;font-size:12px;margin-top:2px">${receiptOrder.orderNo}</p>
  </div>
  <div class="dashed"></div>
  <div style="margin:6px 0">${itemRows}</div>
  <div class="dashed"></div>
  <div style="margin:4px 0">
    <div class="row"><span>Subtotal</span><span>${fmt(receiptOrder.subtotal)}</span></div>
    ${discRow}${taxRow}
    <div class="dashed"></div>
    <div class="total-row"><span>Total</span><span>${fmt(receiptOrder.grandTotal)}</span></div>
    <div class="row sm" style="margin-top:4px"><span>Bayar (${receiptOrder.payment.methodName})</span><span>${fmt(receiptOrder.payment.cashReceived || receiptOrder.grandTotal)}</span></div>
    ${changeRow}${refRow}
  </div>
  ${noteRow}
  <div class="dashed"></div>
  <p class="center sm" style="margin-top:6px">Terima kasih atas kunjungan Anda!</p>
</body></html>`;

        const win = window.open('', '_blank', 'width=420,height=600');
        if (!win) return;
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); win.close(); }, 300);
    };

    const downloadPDF = () => receiptOrder && downloadReceiptPDF(receiptOrder);

    return (
        <div className="min-h-screen bg-surface-950">
            <div className="flex flex-col md:flex-row h-[calc(100vh-3.5rem)] pb-16 md:pb-0">
                {/* LEFT: Products */}
                <div className={`flex-1 overflow-auto p-4 space-y-4 ${mobileTab === 'cart' ? 'hidden md:block' : ''}`}>
                    {/* Search */}
                    <div className="relative">
                        <input
                            ref={searchRef}
                            id="search-product"
                            type="text"
                            placeholder='Cari produk (nama/SKU)...  tekan "/" untuk fokus'
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface-800 border border-surface-700 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition text-sm"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">🔍</span>
                    </div>

                    {/* Categories */}
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {categories.map(c => (
                            <button
                                key={c}
                                onClick={() => setCategory(c)}
                                className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition ${category === c ? 'bg-primary-600 text-white' : 'bg-surface-800 text-surface-300 hover:bg-surface-700'}`}
                            >
                                {c === 'all' ? 'Semua' : c}
                            </button>
                        ))}
                    </div>

                    {/* Products Grid */}
                    {filtered.length === 0 && <EmptyState icon="📦" title="Tidak ada produk ditemukan" />}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {filtered.map(p => (
                            <button
                                key={p.id}
                                onClick={() => addProduct(p)}
                                disabled={p.stock <= 0}
                                className={`text-left p-4 rounded-xl border transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]
                  ${p.stock <= 0 ? 'bg-surface-800/50 border-surface-700/50 opacity-50 cursor-not-allowed' : 'bg-surface-800 border-surface-700 hover:border-primary-500/50 hover:shadow-lg hover:shadow-primary-500/5'}`}
                            >
                                <p className="font-medium text-sm truncate">{p.name}</p>
                                {p.sku && <p className="text-xs text-surface-400 mt-0.5">{p.sku}</p>}
                                <p className="text-primary-400 font-semibold mt-2">{formatRupiah(p.price)}</p>
                                <p className={`text-xs mt-1 ${p.stock <= settings.lowStockThreshold ? 'text-amber-400' : 'text-surface-400'}`}>
                                    Stok: {p.stock} {p.unit || ''}
                                </p>
                            </button>
                        ))}
                    </div>

                    {/* Services Section */}
                    {activeServices.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider mb-3 mt-6">Jasa</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                {activeServices.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => addServiceItem(s)}
                                        className="text-left p-4 rounded-xl bg-surface-800 border border-surface-700 hover:border-emerald-500/50 hover:shadow-lg transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        <p className="font-medium text-sm truncate">🔧 {s.name}</p>
                                        <p className="text-emerald-400 font-semibold mt-2">{formatRupiah(s.price)}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Today's history */}
                    <div className="mt-8">
                        {/* Stat Widgets */}
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                                <p className="text-xs text-surface-400 mb-0.5">Berhasil</p>
                                <p className="text-lg font-bold text-emerald-400">{paidToday.length}</p>
                                <p className="text-xs text-surface-500 truncate">{formatRupiah(totalPendapatanToday)}</p>
                            </div>
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                                <p className="text-xs text-surface-400 mb-0.5">Void</p>
                                <p className="text-lg font-bold text-red-400">{voidToday.length}</p>
                                <p className="text-xs text-surface-500">dibatalkan</p>
                            </div>
                            <div className="bg-primary-500/10 border border-primary-500/20 rounded-xl p-3 text-center">
                                <p className="text-xs text-surface-400 mb-0.5">Total</p>
                                <p className="text-lg font-bold text-primary-400">{todayOrders.length}</p>
                                <p className="text-xs text-surface-500">transaksi</p>
                            </div>
                        </div>

                        {/* Header + Laporan */}
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Riwayat Hari Ini</h3>
                            <button
                                onClick={() => setShowReport(true)}
                                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-primary-600/20 text-primary-400 hover:bg-primary-600/30 transition font-medium"
                            >📊 Laporan</button>
                        </div>

                        {/* Search */}
                        <div className="relative mb-3">
                            <input
                                type="text"
                                placeholder="Cari no. order, item, metode..."
                                value={historySearch}
                                onChange={e => { setHistorySearch(e.target.value); setHistoryPage(1); }}
                                className="w-full pl-8 pr-3 py-2 text-xs rounded-lg bg-surface-800 border border-surface-700 focus:border-primary-500 outline-none transition"
                            />
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-500 text-xs">🔍</span>
                            {historySearch && (
                                <button onClick={() => { setHistorySearch(''); setHistoryPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300 transition text-xs">✕</button>
                            )}
                        </div>

                        {/* List */}
                        {filteredHistory.length === 0 ? (
                            <div className="text-center py-6 text-surface-500 text-sm">Tidak ada transaksi ditemukan</div>
                        ) : (
                            <div className="space-y-2">
                                {paginatedHistory.map(o => (
                                    <div key={o.id} className={`p-3 rounded-xl bg-surface-800 border text-sm transition ${o.status === 'void' ? 'opacity-50 border-surface-700' : 'border-surface-700 hover:border-surface-600'}`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1 min-w-0">
                                                <span className="font-mono text-xs text-surface-400">{o.orderNo}</span>
                                                <span className="ml-2 font-semibold">{formatRupiah(o.grandTotal)}</span>
                                                <span className="ml-1.5 text-xs text-surface-500">{o.payment.methodName}</span>
                                                {o.status === 'void'
                                                    ? <span className="ml-1.5 text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-medium">VOID</span>
                                                    : <span className="ml-1.5 text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-medium">LUNAS</span>}
                                            </div>
                                            <div className="flex items-center gap-1 ml-2 shrink-0">
                                                <button title="Lihat Detail" onClick={() => setDetailOrder(o)} className="text-xs px-2 py-1 rounded-lg bg-surface-700 text-surface-300 hover:bg-primary-600/30 hover:text-primary-400 transition">🔍</button>
                                                {o.status === 'paid' && <button title="Download Nota" onClick={() => downloadReceiptPDF(o)} className="text-xs px-2 py-1 rounded-lg bg-surface-700 text-surface-300 hover:bg-red-600/30 hover:text-red-400 transition">📄</button>}
                                                {role === 'admin' && o.status === 'paid' && <button onClick={() => { voidOrder(o.id); addToast('Transaksi di-void'); }} className="text-xs px-2 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">Void</button>}
                                            </div>
                                        </div>
                                        <div className="text-xs text-surface-500 mt-1">{formatDateTime(o.createdAt)} · {o.items.length} item</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Pagination */}
                        {historyTotalPages > 1 && (
                            <div className="flex items-center justify-between mt-3">
                                <span className="text-xs text-surface-500">
                                    {((historyPage - 1) * HISTORY_PER_PAGE) + 1}–{Math.min(historyPage * HISTORY_PER_PAGE, filteredHistory.length)} dari {filteredHistory.length}
                                </span>
                                <div className="flex items-center gap-1">
                                    <button
                                        disabled={historyPage === 1}
                                        onClick={() => setHistoryPage(p => p - 1)}
                                        className="px-2 py-1 rounded-lg bg-surface-700 text-surface-300 disabled:opacity-30 hover:bg-surface-600 transition text-xs"
                                    >← Prev</button>
                                    {Array.from({ length: historyTotalPages }, (_, i) => i + 1).map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setHistoryPage(p)}
                                            className={`w-7 h-7 rounded-lg text-xs font-medium transition ${p === historyPage ? 'bg-primary-600 text-white' : 'bg-surface-700 text-surface-300 hover:bg-surface-600'}`}
                                        >{p}</button>
                                    ))}
                                    <button
                                        disabled={historyPage === historyTotalPages}
                                        onClick={() => setHistoryPage(p => p + 1)}
                                        className="px-2 py-1 rounded-lg bg-surface-700 text-surface-300 disabled:opacity-30 hover:bg-surface-600 transition text-xs"
                                    >Next →</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: Cart */}
                <div className={`w-full md:w-96 lg:w-[420px] bg-surface-900 border-l border-surface-800 flex flex-col ${mobileTab === 'products' ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-4 border-b border-surface-800">
                        <h2 className="font-semibold text-lg">🛒 Keranjang</h2>
                    </div>

                    {/* Cart Items */}
                    <div className="flex-1 overflow-auto p-4 space-y-3">
                        {cart.length === 0 && <EmptyState icon="🛒" title="Keranjang kosong" subtitle="Pilih produk untuk memulai" />}
                        {cart.map(c => (
                            <div key={c.id} className="bg-surface-800 rounded-xl p-3 border border-surface-700">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">{c.kind === 'service' ? '🔧 ' : ''}{c.name}</p>
                                        <p className="text-xs text-surface-400 mt-0.5">{formatRupiah(c.unitPrice)} × {c.qty}</p>
                                    </div>
                                    <button onClick={() => removeFromCart(c.id)} className="text-surface-500 hover:text-red-400 transition ml-2 text-lg">&times;</button>
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <button
                                        onClick={() => updateCartQty(c.id, c.qty - 1)}
                                        className="w-8 h-8 rounded-lg bg-surface-700 hover:bg-surface-600 transition text-lg font-bold flex items-center justify-center"
                                    >−</button>
                                    <span className="w-8 text-center font-medium">{c.qty}</span>
                                    <button
                                        onClick={() => {
                                            if (c.kind === 'product' && c.qty >= c.stock) { addToast('Stok tidak cukup!', 'error'); return; }
                                            updateCartQty(c.id, c.qty + 1);
                                        }}
                                        className="w-8 h-8 rounded-lg bg-surface-700 hover:bg-surface-600 transition text-lg font-bold flex items-center justify-center"
                                    >+</button>
                                    <div className="flex-1" />
                                    <span className="font-semibold text-sm text-primary-400">{formatRupiah(calcLineTotal(c))}</span>
                                </div>
                                {/* Item discount */}
                                <div className="flex items-center gap-2 mt-2">
                                    <select
                                        value={c.discountType || 'amount'}
                                        onChange={e => updateCartItemDiscount(c.id, e.target.value as 'amount' | 'percent', c.discountValue || 0)}
                                        className="bg-surface-700 rounded-lg px-2 py-1 text-xs outline-none border border-surface-600"
                                    >
                                        <option value="amount">Rp</option>
                                        <option value="percent">%</option>
                                    </select>
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder="Diskon"
                                        value={c.discountValue || ''}
                                        onChange={e => updateCartItemDiscount(c.id, c.discountType || 'amount', parseFloat(e.target.value) || 0)}
                                        className="flex-1 bg-surface-700 rounded-lg px-2 py-1 text-xs outline-none border border-surface-600 focus:border-primary-500"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Cart Footer */}
                    {cart.length > 0 && (
                        <div className="p-4 border-t border-surface-800 space-y-3">
                            {/* Transaction discount */}
                            <div className="flex items-center gap-2">
                                <label className="text-xs text-surface-400 whitespace-nowrap">Diskon Transaksi:</label>
                                <select
                                    value={cartDiscountType}
                                    onChange={e => setCartDiscountType(e.target.value as 'amount' | 'percent')}
                                    className="bg-surface-800 rounded-lg px-2 py-1 text-xs outline-none border border-surface-700"
                                >
                                    <option value="amount">Rp</option>
                                    <option value="percent">%</option>
                                </select>
                                <input
                                    type="number"
                                    min="0"
                                    value={cartDiscount || ''}
                                    onChange={e => setCartDiscount(parseFloat(e.target.value) || 0)}
                                    className="flex-1 bg-surface-800 rounded-lg px-2 py-1 text-xs outline-none border border-surface-700 focus:border-primary-500"
                                />
                            </div>

                            {/* Tax toggle */}
                            <div className="flex items-center justify-between">
                                <label className="text-xs text-surface-400">Pajak ({settings.taxPercent}%)</label>
                                <button
                                    onClick={() => setTaxEnabled(!taxEnabled)}
                                    className={`w-10 h-5 rounded-full transition relative ${taxEnabled ? 'bg-primary-500' : 'bg-surface-600'}`}
                                >
                                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${taxEnabled ? 'left-5' : 'left-0.5'}`} />
                                </button>
                            </div>

                            {/* Note */}
                            <input
                                type="text"
                                placeholder="Catatan transaksi (opsional)"
                                value={cartNote}
                                onChange={e => setCartNote(e.target.value)}
                                className="w-full bg-surface-800 rounded-lg px-3 py-2 text-xs outline-none border border-surface-700 focus:border-primary-500"
                            />

                            {/* Summary */}
                            <div className="space-y-1 text-sm">
                                <div className="flex justify-between text-surface-400"><span>Subtotal</span><span>{formatRupiah(subtotal)}</span></div>
                                {discountTotalCalc > 0 && <div className="flex justify-between text-amber-400"><span>Diskon</span><span>−{formatRupiah(discountTotalCalc)}</span></div>}
                                {taxAmount > 0 && <div className="flex justify-between text-surface-400"><span>Pajak</span><span>{formatRupiah(taxAmount)}</span></div>}
                                <div className="flex justify-between font-bold text-lg pt-1 border-t border-surface-700"><span>Total</span><span className="text-primary-400">{formatRupiah(grandTotal)}</span></div>
                            </div>

                            <button
                                id="btn-pay"
                                onClick={() => setShowPayment(true)}
                                className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-lg shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
                            >
                                Bayar {formatRupiah(grandTotal)}
                            </button>
                            <p className="text-center text-xs text-surface-500">Ctrl+Enter untuk bayar</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Payment Modal */}
            <Modal open={showPayment} onClose={() => setShowPayment(false)} title="Pembayaran">
                <div className="space-y-4">
                    <div className="text-center">
                        <p className="text-3xl font-bold text-primary-400">{formatRupiah(grandTotal)}</p>
                        <p className="text-sm text-surface-400 mt-1">Total yang harus dibayar</p>
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-2 block">Metode Pembayaran</label>
                        <div className="grid grid-cols-2 gap-2">
                            {activeMethods.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => handleSelectMethod(m.id)}
                                    className={`py-3 px-4 rounded-xl font-medium text-sm transition border ${selectedMethod === m.id ? 'bg-primary-600 border-primary-500 text-white' : 'bg-surface-700 border-surface-600 hover:border-primary-500/50'}`}
                                >
                                    {m.name.toLowerCase().includes('qris') ? '📱' : m.type === 'cash' ? '💵' : '💳'} {m.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {selectedMethod && (() => {
                        const m = activeMethods.find(x => x.id === selectedMethod);
                        if (!m) return null;
                        if (m.type === 'cash') {
                            const received = parseFloat(cashReceived) || 0;
                            const change = received - grandTotal;
                            return (
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">Uang Diterima</label>
                                        <input
                                            id="input-cash"
                                            autoFocus
                                            type="number"
                                            value={cashReceived}
                                            onChange={e => setCashReceived(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') checkout(); }}
                                            className="w-full py-3 px-4 rounded-xl bg-surface-700 border border-surface-600 focus:border-primary-500 outline-none text-lg font-mono"
                                            placeholder="0"
                                        />
                                    </div>
                                    {received >= grandTotal && (
                                        <div className="text-center py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                            <p className="text-sm text-surface-400">Kembalian</p>
                                            <p className="text-2xl font-bold text-emerald-400">{formatRupiah(change)}</p>
                                        </div>
                                    )}
                                    {/* Quick amount buttons */}
                                    <div className="grid grid-cols-3 gap-2">
                                        {[grandTotal, Math.ceil(grandTotal / 10000) * 10000, Math.ceil(grandTotal / 50000) * 50000, 50000, 100000, 200000].map((v, i) => (
                                            <button key={i} onClick={() => setCashReceived(String(v))} className="py-2 rounded-lg bg-surface-700 hover:bg-surface-600 text-xs font-medium transition">{formatRupiah(v)}</button>
                                        ))}
                                    </div>
                                </div>
                            );
                        }
                        return (
                            <div>
                                <label className="text-sm font-medium mb-1 block">No. Referensi (opsional)</label>
                                <input
                                    type="text"
                                    value={refNo}
                                    onChange={e => setRefNo(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') checkout(); }}
                                    className="w-full py-3 px-4 rounded-xl bg-surface-700 border border-surface-600 focus:border-primary-500 outline-none"
                                    placeholder="Nomor transaksi"
                                />
                            </div>
                        );
                    })()}

                    <button
                        id="btn-checkout"
                        onClick={checkout}
                        disabled={!selectedMethod}
                        className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-lg transition"
                    >
                        {isQrisMethod(selectedMethod) && settings.qrisImageData
                            ? '📱 Tampilkan QRIS'
                            : 'Selesaikan Transaksi'}
                    </button>
                </div>
            </Modal>

            {/* QRIS Payment Popup */}
            <Modal open={showQrisPopup} onClose={() => { if (!qrisPaid) { setShowQrisPopup(false); } }} title="Pembayaran QRIS">
                <div className="space-y-4">
                    {/* Auto-paid success overlay */}
                    {qrisPaid && (
                        <div className="text-center py-6 space-y-3">
                            <div className="w-20 h-20 bg-emerald-500/20 border-2 border-emerald-400 rounded-full flex items-center justify-center mx-auto">
                                <span className="text-4xl">✅</span>
                            </div>
                            <p className="text-xl font-bold text-emerald-400">Pembayaran Dikonfirmasi!</p>
                            <p className="text-sm text-surface-400">Memproses transaksi...</p>
                            <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
                        </div>
                    )}

                    {/* Expired state */}
                    {qrisExpired && !qrisPaid && (
                        <div className="text-center py-6 space-y-4">
                            <div className="w-20 h-20 bg-red-500/20 border-2 border-red-400 rounded-full flex items-center justify-center mx-auto">
                                <span className="text-4xl">⏰</span>
                            </div>
                            <p className="text-xl font-bold text-red-400">QRIS Expired</p>
                            <p className="text-sm text-surface-400">Waktu pembayaran habis. Ulangi untuk mendapatkan kode unik baru.</p>
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button
                                    onClick={() => setShowQrisPopup(false)}
                                    className="py-3 rounded-xl bg-surface-700 hover:bg-surface-600 font-medium transition text-sm"
                                >
                                    Tutup
                                </button>
                                <button
                                    onClick={() => {
                                        setShowQrisPopup(false);
                                        setTimeout(() => {
                                            const code = settings.qrisUniqueCodeEnabled !== false ? Math.floor(Math.random() * 90) + 10 : 0;
                                            setQrisCode(code);
                                            const dateStr = todayStr();
                                            const seq = (settings.lastOrderSeqByDate[dateStr] || 0) + 1;
                                            setQrisOrderRef(`POS-${dateStr}-${String(seq).padStart(4, '0')}`);
                                            setShowQrisPopup(true);
                                        }, 100);
                                    }}
                                    className="py-3 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 font-bold text-white transition text-sm"
                                >
                                    🔄 Ulangi QRIS
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Active payment state */}
                    {!qrisPaid && !qrisExpired && (
                        <>
                            {/* Timer ring + amount block */}
                            <div className="flex items-center gap-4 bg-gradient-to-b from-surface-700 to-surface-800 rounded-2xl p-4 border border-surface-600">
                                <div className="relative flex-shrink-0">
                                    <svg width="72" height="72" className="-rotate-90">
                                        <circle cx="36" cy="36" r="30" fill="none" stroke="#334155" strokeWidth="6" />
                                        <circle
                                            cx="36" cy="36" r="30" fill="none"
                                            stroke={qrisTimer <= 10 ? '#ef4444' : qrisTimer <= 20 ? '#f59e0b' : '#10b981'}
                                            strokeWidth="6"
                                            strokeLinecap="round"
                                            strokeDasharray={`${2 * Math.PI * 30}`}
                                            strokeDashoffset={`${2 * Math.PI * 30 * (1 - qrisTimer / 60)}`}
                                            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
                                        />
                                    </svg>
                                    <span className={`absolute inset-0 flex items-center justify-center text-lg font-black ${qrisTimer <= 10 ? 'text-red-400' : qrisTimer <= 20 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                        {qrisTimer}s
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-surface-400 uppercase tracking-widest font-semibold">Total yang harus dibayar</p>
                                    <p className="text-3xl font-black text-white tracking-tight">{formatRupiah(qrisTotal)}</p>
                                    {qrisCode > 0 && (
                                        <div className="mt-1 inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-0.5">
                                            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                                            <span className="text-xs text-amber-400 font-medium">
                                                Kode unik +{qrisCode}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Polling indicator */}
                            {settings.qrisWebhookToken?.trim() && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse flex-shrink-0" />
                                    <span className="text-xs text-emerald-400">Memantau notifikasi pembayaran otomatis setiap 5 detik...</span>
                                </div>
                            )}

                            {/* QR Image / Generated QR */}
                            {settings.qrisString ? (
                                <div className="bg-white rounded-2xl p-6 flex flex-col items-center justify-center shadow-lg">
                                    <QRCodeSVG value={generateDynamicQris(settings.qrisString, qrisTotal)} size={240} level="M" />
                                    <p className="text-xs text-surface-400 mt-3 font-semibold tracking-wider">SCAN UNTUK BAYAR</p>
                                </div>
                            ) : settings.qrisImageData ? (
                                <div className="bg-white rounded-2xl p-4 flex items-center justify-center shadow-lg">
                                    <img src={settings.qrisImageData} alt="QRIS Code" className="max-h-60 w-auto object-contain" />
                                </div>
                            ) : null}

                            {/* Instructions */}
                            <div className="bg-surface-700/50 rounded-xl p-3 border border-surface-600/50">
                                <p className="text-xs font-semibold text-surface-300 mb-1.5">📋 Petunjuk:</p>
                                <ol className="text-xs text-surface-400 space-y-1 list-decimal list-inside">
                                    <li>Buka aplikasi dompet digital / m-banking</li>
                                    <li>Scan QR Code di atas</li>
                                    <li>Bayar persis <strong className="text-amber-400">{formatRupiah(qrisTotal)}</strong> {settings.qrisUniqueCodeEnabled !== false && `(termasuk kode unik +${qrisCode})`}</li>
                                    <li>Konfirmasi pembayaran</li>
                                </ol>
                            </div>

                            {/* Action buttons */}
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setShowQrisPopup(false)}
                                    className="py-3 rounded-xl bg-surface-700 hover:bg-surface-600 font-medium transition text-sm"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={checkout}
                                    className="py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 font-bold text-white transition text-sm shadow-lg shadow-emerald-500/20"
                                >
                                    ✅ Sudah Dibayar
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </Modal>


            {/* Receipt Modal */}
            <Modal open={!!receiptOrder} onClose={() => setReceiptOrder(null)} title="Struk Transaksi">
                {receiptOrder && (
                    <div className="space-y-4" id="receipt">
                        <div className="text-center border-b border-dashed border-surface-600 pb-4">
                            <h3 className="font-bold text-lg">{settings.storeName || 'POS SYSTEM'}</h3>
                            {settings.storeAddress && (
                                <p className="text-xs text-surface-400 mt-1 whitespace-pre-line">{settings.storeAddress}</p>
                            )}
                            <p className="text-xs text-surface-400 mt-1">{formatDateTime(receiptOrder.createdAt)}</p>
                            <p className="font-mono text-sm mt-1">{receiptOrder.orderNo}</p>
                        </div>
                        <div className="space-y-2">
                            {receiptOrder.items.map(item => (
                                <div key={item.id} className="flex justify-between text-sm">
                                    <div>
                                        <p>{item.name} × {item.qty}</p>
                                        {item.discountValue && item.discountValue > 0 && (
                                            <p className="text-xs text-amber-400 ml-2">Diskon: {item.discountType === 'percent' ? `${item.discountValue}%` : formatRupiah(item.discountValue)}</p>
                                        )}
                                    </div>
                                    <span>{formatRupiah(item.lineTotal)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="border-t border-dashed border-surface-600 pt-3 space-y-1 text-sm">
                            <div className="flex justify-between"><span>Subtotal</span><span>{formatRupiah(receiptOrder.subtotal)}</span></div>
                            {receiptOrder.discountTotal > 0 && <div className="flex justify-between text-amber-400"><span>Diskon</span><span>−{formatRupiah(receiptOrder.discountTotal)}</span></div>}
                            {receiptOrder.taxTotal > 0 && <div className="flex justify-between"><span>Pajak</span><span>{formatRupiah(receiptOrder.taxTotal)}</span></div>}
                            <div className="flex justify-between font-bold text-lg pt-1 border-t border-surface-700"><span>Total</span><span>{formatRupiah(receiptOrder.grandTotal)}</span></div>
                            <div className="flex justify-between text-surface-400"><span>Bayar ({receiptOrder.payment.methodName})</span><span>{formatRupiah(receiptOrder.payment.cashReceived || receiptOrder.grandTotal)}</span></div>
                            {receiptOrder.payment.change !== undefined && receiptOrder.payment.change > 0 && (
                                <div className="flex justify-between text-emerald-400"><span>Kembalian</span><span>{formatRupiah(receiptOrder.payment.change)}</span></div>
                            )}
                            {receiptOrder.payment.refNo && <div className="flex justify-between text-surface-400"><span>Ref</span><span>{receiptOrder.payment.refNo}</span></div>}
                            {receiptOrder.note && <p className="text-xs text-surface-500 mt-2">Catatan: {receiptOrder.note}</p>}
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-2">
                            <button
                                onClick={printReceipt}
                                className="flex flex-col items-center justify-center gap-1 py-3 rounded-xl bg-surface-700 hover:bg-surface-600 font-medium transition text-sm"
                            >
                                <span className="text-xl">🖨️</span>
                                <span>Print</span>
                            </button>
                            <button
                                onClick={downloadPDF}
                                className="flex flex-col items-center justify-center gap-1 py-3 rounded-xl bg-red-600/80 hover:bg-red-500 font-medium transition text-sm"
                            >
                                <span className="text-xl">📄</span>
                                <span>PDF</span>
                            </button>
                            <button
                                onClick={() => setReceiptOrder(null)}
                                className="flex flex-col items-center justify-center gap-1 py-3 rounded-xl bg-primary-600 hover:bg-primary-500 font-medium transition text-sm"
                            >
                                <span className="text-xl">✅</span>
                                <span>Transaksi Baru</span>
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Detail Transaksi Modal */}
            <Modal open={!!detailOrder} onClose={() => setDetailOrder(null)} title="Detail Transaksi">
                {detailOrder && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-mono text-sm text-primary-400">{detailOrder.orderNo}</p>
                                <p className="text-xs text-surface-400 mt-0.5">{formatDateTime(detailOrder.createdAt)}</p>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${detailOrder.status === 'void' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                {detailOrder.status === 'void' ? 'VOID' : 'LUNAS'}
                            </span>
                        </div>
                        <div className="border-t border-dashed border-surface-600 pt-3 space-y-2">
                            <p className="text-xs text-surface-400 uppercase tracking-wider font-semibold mb-2">Item</p>
                            {detailOrder.items.map(item => (
                                <div key={item.id} className="flex justify-between text-sm">
                                    <div>
                                        <p>{item.name} × {item.qty}</p>
                                        {item.discountValue && item.discountValue > 0 && (
                                            <p className="text-xs text-amber-400 ml-2">Diskon: {item.discountType === 'percent' ? `${item.discountValue}%` : formatRupiah(item.discountValue)}</p>
                                        )}
                                    </div>
                                    <span>{formatRupiah(item.lineTotal)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="border-t border-dashed border-surface-600 pt-3 space-y-1 text-sm">
                            <div className="flex justify-between text-surface-400"><span>Subtotal</span><span>{formatRupiah(detailOrder.subtotal)}</span></div>
                            {detailOrder.discountTotal > 0 && <div className="flex justify-between text-amber-400"><span>Diskon</span><span>−{formatRupiah(detailOrder.discountTotal)}</span></div>}
                            {detailOrder.taxTotal > 0 && <div className="flex justify-between text-surface-400"><span>Pajak</span><span>{formatRupiah(detailOrder.taxTotal)}</span></div>}
                            <div className="flex justify-between font-bold text-base pt-1 border-t border-surface-700"><span>Total</span><span className="text-primary-400">{formatRupiah(detailOrder.grandTotal)}</span></div>
                            <div className="flex justify-between text-surface-400"><span>Bayar ({detailOrder.payment.methodName})</span><span>{formatRupiah(detailOrder.payment.cashReceived || detailOrder.grandTotal)}</span></div>
                            {detailOrder.payment.change !== undefined && detailOrder.payment.change > 0 && <div className="flex justify-between text-emerald-400"><span>Kembalian</span><span>{formatRupiah(detailOrder.payment.change)}</span></div>}
                            {detailOrder.payment.refNo && <div className="flex justify-between text-surface-400"><span>No. Ref</span><span>{detailOrder.payment.refNo}</span></div>}
                            {detailOrder.note && <p className="text-xs text-surface-500 mt-1">Catatan: {detailOrder.note}</p>}
                        </div>
                        {detailOrder.status === 'paid' && (
                            <div className="grid grid-cols-2 gap-2 pt-1">
                                <button onClick={() => downloadReceiptPDF(detailOrder)} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600/80 hover:bg-red-500 font-medium transition text-sm">📄 Download Nota</button>
                                <button onClick={() => setDetailOrder(null)} className="py-3 rounded-xl bg-surface-700 hover:bg-surface-600 font-medium transition text-sm">Tutup</button>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Laporan Transaksi Modal */}
            <Modal open={showReport} onClose={() => setShowReport(false)} title="Laporan Transaksi Hari Ini">
                {(() => {
                    const paid = todayOrders.filter(o => o.status === 'paid');
                    const voided = todayOrders.filter(o => o.status === 'void');
                    const totalPendapatan = paid.reduce((s, o) => s + o.grandTotal, 0);
                    const totalDiskon = paid.reduce((s, o) => s + o.discountTotal, 0);
                    const totalPajak = paid.reduce((s, o) => s + o.taxTotal, 0);
                    const byMethod: Record<string, number> = {};
                    paid.forEach(o => { byMethod[o.payment.methodName] = (byMethod[o.payment.methodName] || 0) + o.grandTotal; });
                    return (
                        <div className="space-y-5">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                                    <p className="text-xs text-surface-400 mb-1">Total Pendapatan</p>
                                    <p className="text-lg font-bold text-emerald-400">{formatRupiah(totalPendapatan)}</p>
                                </div>
                                <div className="bg-primary-500/10 border border-primary-500/20 rounded-xl p-4">
                                    <p className="text-xs text-surface-400 mb-1">Transaksi Berhasil</p>
                                    <p className="text-lg font-bold text-primary-400">{paid.length} trx</p>
                                </div>
                                {totalDiskon > 0 && (
                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                                        <p className="text-xs text-surface-400 mb-1">Total Diskon</p>
                                        <p className="text-lg font-bold text-amber-400">{formatRupiah(totalDiskon)}</p>
                                    </div>
                                )}
                                {totalPajak > 0 && (
                                    <div className="bg-surface-700/50 border border-surface-600 rounded-xl p-4">
                                        <p className="text-xs text-surface-400 mb-1">Total Pajak</p>
                                        <p className="text-lg font-bold">{formatRupiah(totalPajak)}</p>
                                    </div>
                                )}
                                {voided.length > 0 && (
                                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                                        <p className="text-xs text-surface-400 mb-1">Transaksi Void</p>
                                        <p className="text-lg font-bold text-red-400">{voided.length} trx</p>
                                    </div>
                                )}
                            </div>
                            <div>
                                <p className="text-xs text-surface-400 uppercase tracking-wider font-semibold mb-2">Pendapatan per Metode Bayar</p>
                                <div className="space-y-2">
                                    {Object.entries(byMethod).map(([method, amount]) => (
                                        <div key={method} className="flex justify-between items-center py-2 px-3 bg-surface-800 rounded-lg text-sm">
                                            <span className="text-surface-300">{method}</span>
                                            <span className="font-semibold text-primary-400">{formatRupiah(amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-surface-400 uppercase tracking-wider font-semibold mb-2">Semua Transaksi</p>
                                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                                    {todayOrders.map(o => (
                                        <div key={o.id} className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${o.status === 'void' ? 'opacity-50 bg-surface-800' : 'bg-surface-800'}`}>
                                            <div>
                                                <span className="font-mono text-surface-400">{o.orderNo}</span>
                                                <span className="ml-2 text-surface-300">{o.payment.methodName}</span>
                                                {o.status === 'void' && <span className="ml-1 text-red-400 font-medium">VOID</span>}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`font-semibold ${o.status === 'void' ? 'text-surface-500 line-through' : 'text-white'}`}>{formatRupiah(o.grandTotal)}</span>
                                                {o.status === 'paid' && (
                                                    <button onClick={() => downloadReceiptPDF(o)} title="Download Nota" className="p-1 rounded hover:bg-surface-700 transition text-surface-400 hover:text-red-400">📄</button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </Modal>

            {/* Bottom Navigation for Mobile */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-900 border-t border-surface-800 flex z-40 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                <button onClick={() => setMobileTab('products')} className={`flex-1 flex flex-col items-center justify-center gap-1 transition ${mobileTab === 'products' ? 'text-primary-400' : 'text-surface-400 hover:text-surface-300'}`}>
                    <span className="text-xl">🛍️</span>
                    <span className="text-[10px] font-medium">Produk</span>
                </button>
                <button onClick={() => setMobileTab('cart')} className={`flex-1 flex flex-col items-center justify-center gap-1 transition relative ${mobileTab === 'cart' ? 'text-primary-400' : 'text-surface-400 hover:text-surface-300'}`}>
                    <span className="text-xl relative">
                        🛒
                        {cart.length > 0 && (
                            <span className="absolute -top-1 -right-2 bg-primary-500 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full font-bold border border-surface-900 shadow-md">
                                {cart.length}
                            </span>
                        )}
                    </span>
                    <span className="text-[10px] font-medium">Keranjang</span>
                </button>
            </div>
        </div>
    );
}
