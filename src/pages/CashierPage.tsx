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
    const searchRef = useRef<HTMLInputElement>(null);

    // Today's orders
    const todayOrders = useMemo(() => {
        const today = new Date().toDateString();
        return orders.filter(o => new Date(o.createdAt).toDateString() === today).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }, [orders]);

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

    // Checkout
    const checkout = async () => {
        if (!selectedMethod) { addToast('Pilih metode pembayaran!', 'error'); return; }
        const method = activeMethods.find(m => m.id === selectedMethod);
        if (!method) return;

        if (method.type === 'cash') {
            const received = parseFloat(cashReceived) || 0;
            if (received < grandTotal) { addToast('Uang diterima kurang!', 'error'); return; }
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

        const received = parseFloat(cashReceived) || 0;
        const order: Order = {
            id: generateId(),
            orderNo,
            createdAt: new Date().toISOString(),
            items: orderItems,
            subtotal,
            discountTotal: discountTotalCalc,
            taxTotal: taxAmount,
            grandTotal,
            payment: {
                methodId: method.id,
                methodName: method.name,
                type: method.type,
                ...(method.type === 'cash' ? { cashReceived: received, change: received - grandTotal } : {}),
                ...(refNo ? { refNo } : {}),
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

        setReceiptOrder(order);
        setShowPayment(false);
        clearCart();
        setCashReceived('');
        setRefNo('');
        setSelectedMethod('');
        addToast('Transaksi berhasil! ✅');
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

    const downloadPDF = async () => {
        if (!receiptOrder) return;
        const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
        const dt = new Date(receiptOrder.createdAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        // Build receipt HTML — same as print but rendered off-screen
        const itemRows = receiptOrder.items.map(item => {
            const discLine = item.discountValue && item.discountValue > 0
                ? `<div style="display:flex;justify-content:space-between;font-size:10px;color:#888;padding-left:8px">
                    <span>Diskon: ${item.discountType === 'percent' ? item.discountValue + '%' : fmt(item.discountValue)}</span>
                    <span>-${item.discountType === 'percent' ? fmt(item.unitPrice * item.qty * item.discountValue / 100) : fmt(item.discountValue)}</span>
                  </div>`
                : '';
            return `<div style="display:flex;justify-content:space-between;margin:3px 0;font-size:11px">
                      <span>${item.name} x${item.qty}</span>
                      <span>${fmt(item.lineTotal)}</span>
                    </div>${discLine}`;
        }).join('');

        const discRow = receiptOrder.discountTotal > 0
            ? `<div style="display:flex;justify-content:space-between;font-size:11px;color:#b45309"><span>Diskon</span><span>-${fmt(receiptOrder.discountTotal)}</span></div>` : '';
        const taxRow = receiptOrder.taxTotal > 0
            ? `<div style="display:flex;justify-content:space-between;font-size:11px"><span>Pajak</span><span>${fmt(receiptOrder.taxTotal)}</span></div>` : '';
        const changeRow = receiptOrder.payment.change && receiptOrder.payment.change > 0
            ? `<div style="display:flex;justify-content:space-between;font-size:11px;color:#065f46"><span>Kembalian</span><span>${fmt(receiptOrder.payment.change)}</span></div>` : '';
        const refRow = receiptOrder.payment.refNo
            ? `<div style="display:flex;justify-content:space-between;font-size:10px;color:#666"><span>No. Ref</span><span>${receiptOrder.payment.refNo}</span></div>` : '';
        const noteRow = receiptOrder.note
            ? `<p style="font-size:10px;color:#666;margin-top:6px">Catatan: ${receiptOrder.note}</p>` : '';
        const addrRow = (settings.storeAddress || '').trim()
            ? `<p style="font-size:10px;color:#555;margin-top:2px;white-space:pre-line">${settings.storeAddress}</p>` : '';

        const html = `
            <div style="font-family:Arial,sans-serif;width:280px;padding:16px;background:#fff;color:#000">
                <div style="text-align:center;border-bottom:1px dashed #ccc;padding-bottom:10px;margin-bottom:10px">
                    <p style="font-weight:bold;font-size:15px;margin:0">${settings.storeName || 'POS SYSTEM'}</p>
                    ${addrRow}
                    <p style="font-size:10px;color:#555;margin:4px 0 0">${dt}</p>
                    <p style="font-family:monospace;font-size:11px;margin:2px 0 0">${receiptOrder.orderNo}</p>
                </div>
                <div style="margin-bottom:10px">${itemRows}</div>
                <div style="border-top:1px dashed #ccc;padding-top:8px">
                    <div style="display:flex;justify-content:space-between;font-size:11px"><span>Subtotal</span><span>${fmt(receiptOrder.subtotal)}</span></div>
                    ${discRow}${taxRow}
                    <div style="border-top:1px dashed #ccc;margin:6px 0"></div>
                    <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:13px"><span>Total</span><span>${fmt(receiptOrder.grandTotal)}</span></div>
                    <div style="display:flex;justify-content:space-between;font-size:10px;color:#666;margin-top:4px">
                        <span>Bayar (${receiptOrder.payment.methodName})</span>
                        <span>${fmt(receiptOrder.payment.cashReceived || receiptOrder.grandTotal)}</span>
                    </div>
                    ${changeRow}${refRow}
                </div>
                ${noteRow}
                <div style="border-top:1px dashed #ccc;margin-top:10px;padding-top:8px;text-align:center">
                    <p style="font-size:10px;color:#555">Terima kasih atas kunjungan Anda!</p>
                </div>
            </div>`;

        // Mount hidden container
        const container = document.createElement('div');
        container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1';
        container.innerHTML = html;
        document.body.appendChild(container);

        try {
            const canvas = await html2canvas(container, {
                scale: 3,
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
            });

            const imgData = canvas.toDataURL('image/png');
            const imgW = 80; // mm — thermal receipt width
            const imgH = (canvas.height * imgW) / canvas.width;

            const pdf = new jsPDF({ unit: 'mm', format: [imgW, imgH + 10], orientation: 'portrait' });
            pdf.addImage(imgData, 'PNG', 0, 5, imgW, imgH);
            pdf.save(`invoice-${receiptOrder.orderNo}.pdf`);
        } finally {
            document.body.removeChild(container);
        }
    };

    return (
        <div className="min-h-screen bg-surface-950">
            {/* Mobile Tabs */}
            <div className="md:hidden flex border-b border-surface-800">
                <button onClick={() => setMobileTab('products')} className={`flex-1 py-3 text-center font-medium transition ${mobileTab === 'products' ? 'text-primary-400 border-b-2 border-primary-400' : 'text-surface-400'}`}>
                    🛍️ Produk
                </button>
                <button onClick={() => setMobileTab('cart')} className={`flex-1 py-3 text-center font-medium transition ${mobileTab === 'cart' ? 'text-primary-400 border-b-2 border-primary-400' : 'text-surface-400'}`}>
                    🛒 Keranjang {cart.length > 0 && <span className="ml-1 bg-primary-500 text-white text-xs px-2 py-0.5 rounded-full">{cart.length}</span>}
                </button>
            </div>

            <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)] md:h-screen">
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
                    {todayOrders.length > 0 && (
                        <div className="mt-8">
                            <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider mb-3">Riwayat Hari Ini ({todayOrders.length})</h3>
                            <div className="space-y-2">
                                {todayOrders.slice(0, 10).map(o => (
                                    <div key={o.id} className={`flex items-center justify-between p-3 rounded-xl bg-surface-800 border border-surface-700 text-sm ${o.status === 'void' ? 'opacity-50' : ''}`}>
                                        <div>
                                            <span className="font-mono text-xs text-surface-400">{o.orderNo}</span>
                                            <span className="ml-2">{formatRupiah(o.grandTotal)}</span>
                                            <span className="ml-2 text-xs text-surface-500">{o.payment.methodName}</span>
                                            {o.status === 'void' && <span className="ml-2 text-xs text-red-400 font-medium">VOID</span>}
                                        </div>
                                        {role === 'admin' && o.status === 'paid' && (
                                            <button
                                                onClick={() => { voidOrder(o.id); addToast('Transaksi di-void'); }}
                                                className="text-xs px-3 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
                                            >
                                                Void
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
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
                                    onClick={() => setSelectedMethod(m.id)}
                                    className={`py-3 px-4 rounded-xl font-medium text-sm transition border ${selectedMethod === m.id ? 'bg-primary-600 border-primary-500 text-white' : 'bg-surface-700 border-surface-600 hover:border-primary-500/50'}`}
                                >
                                    {m.type === 'cash' ? '💵' : '💳'} {m.name}
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
                        Selesaikan Transaksi
                    </button>
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
        </div>
    );
}
