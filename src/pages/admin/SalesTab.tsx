import { useState, useMemo } from 'react';
import { useStore } from '../../store';
import { formatRupiah, formatDateTime } from '../../utils/format';
import type { Order } from '../../types';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';

export default function SalesTab() {
    const orders = useStore(s => s.orders);
    const [detail, setDetail] = useState<Order | null>(null);
    const [filterMethod, setFilterMethod] = useState('all');
    const [filterKeyword, setFilterKeyword] = useState('');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');

    const filteredOrders = useMemo(() => {
        let list = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        if (filterMethod !== 'all') list = list.filter(o => o.payment.methodName === filterMethod);
        if (filterKeyword.trim()) {
            const q = filterKeyword.toLowerCase();
            list = list.filter(o => o.orderNo.toLowerCase().includes(q));
        }
        if (filterDateFrom) list = list.filter(o => o.createdAt >= filterDateFrom);
        if (filterDateTo) list = list.filter(o => o.createdAt <= filterDateTo + 'T23:59:59');
        return list;
    }, [orders, filterMethod, filterKeyword, filterDateFrom, filterDateTo]);

    const methodNames = useMemo(() => {
        const s = new Set(orders.map(o => o.payment.methodName));
        return Array.from(s);
    }, [orders]);

    // Export CSV
    const exportCsvOrders = () => {
        const headers = ['Order No', 'Tanggal', 'Subtotal', 'Diskon', 'Pajak', 'Total', 'Metode Bayar', 'Status', 'Catatan'];
        const rows = filteredOrders.map(o => [o.orderNo, o.createdAt, o.subtotal, o.discountTotal, o.taxTotal, o.grandTotal, o.payment.methodName, o.status, o.note || '']);
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        downloadFile(csv, 'transaksi.csv', 'text/csv');
    };

    const exportCsvItems = () => {
        const headers = ['Order No', 'Tanggal', 'Item', 'Jenis', 'Qty', 'Harga Satuan', 'Diskon Tipe', 'Diskon Nilai', 'Total Baris'];
        const rows: string[][] = [];
        filteredOrders.forEach(o => {
            o.items.forEach(item => {
                rows.push([o.orderNo, o.createdAt, item.name, item.kind, String(item.qty), String(item.unitPrice), item.discountType || '', String(item.discountValue || 0), String(item.lineTotal)]);
            });
        });
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        downloadFile(csv, 'detail_item.csv', 'text/csv');
    };

    const exportJson = () => {
        downloadFile(JSON.stringify(filteredOrders, null, 2), 'transaksi.json', 'application/json');
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold">Penjualan</h1>
                <div className="flex gap-2 flex-wrap">
                    <button onClick={exportJson} className="px-3 py-2 rounded-xl bg-surface-700 hover:bg-surface-600 text-xs font-medium transition">📥 Export JSON</button>
                    <button onClick={exportCsvOrders} className="px-3 py-2 rounded-xl bg-surface-700 hover:bg-surface-600 text-xs font-medium transition">📥 CSV Transaksi</button>
                    <button onClick={exportCsvItems} className="px-3 py-2 rounded-xl bg-surface-700 hover:bg-surface-600 text-xs font-medium transition">📥 CSV Detail Item</button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <input type="text" placeholder="Cari no. order..." value={filterKeyword} onChange={e => setFilterKeyword(e.target.value)} className="px-3 py-2 rounded-xl bg-surface-800 border border-surface-700 focus:border-primary-500 outline-none text-sm" />
                <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)} className="px-3 py-2 rounded-xl bg-surface-800 border border-surface-700 outline-none text-sm">
                    <option value="all">Semua Metode</option>
                    {methodNames.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="px-3 py-2 rounded-xl bg-surface-800 border border-surface-700 outline-none text-sm" />
                <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="px-3 py-2 rounded-xl bg-surface-800 border border-surface-700 outline-none text-sm" />
            </div>

            {filteredOrders.length === 0 ? (
                <EmptyState icon="📋" title="Belum ada transaksi" />
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-surface-700 text-surface-400 text-left">
                                <th className="py-3 px-3">Tanggal</th>
                                <th className="py-3 px-3">No. Order</th>
                                <th className="py-3 px-3">Item</th>
                                <th className="py-3 px-3 text-right">Total</th>
                                <th className="py-3 px-3">Metode</th>
                                <th className="py-3 px-3">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredOrders.map(o => (
                                <tr key={o.id} onClick={() => setDetail(o)} className="border-b border-surface-800 hover:bg-surface-800/50 cursor-pointer transition">
                                    <td className="py-3 px-3 text-surface-400 text-xs">{formatDateTime(o.createdAt)}</td>
                                    <td className="py-3 px-3 font-mono text-xs">{o.orderNo}</td>
                                    <td className="py-3 px-3 text-surface-400">{o.items.length} item</td>
                                    <td className="py-3 px-3 text-right font-medium">{formatRupiah(o.grandTotal)}</td>
                                    <td className="py-3 px-3 text-surface-400">{o.payment.methodName}</td>
                                    <td className="py-3 px-3">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${o.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                            {o.status === 'paid' ? 'Lunas' : 'Void'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Detail Modal */}
            <Modal open={!!detail} onClose={() => setDetail(null)} title={`Detail ${detail?.orderNo || ''}`} wide>
                {detail && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><span className="text-surface-400">Tanggal:</span> <span className="ml-1">{formatDateTime(detail.createdAt)}</span></div>
                            <div><span className="text-surface-400">Status:</span> <span className={`ml-1 font-medium ${detail.status === 'paid' ? 'text-emerald-400' : 'text-red-400'}`}>{detail.status === 'paid' ? 'Lunas' : 'Void'}</span></div>
                            <div><span className="text-surface-400">Metode:</span> <span className="ml-1">{detail.payment.methodName}</span></div>
                            {detail.payment.refNo && <div><span className="text-surface-400">Ref:</span> <span className="ml-1">{detail.payment.refNo}</span></div>}
                        </div>

                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-surface-700 text-surface-400">
                                    <th className="py-2 text-left">Item</th>
                                    <th className="py-2 text-right">Qty</th>
                                    <th className="py-2 text-right">Harga</th>
                                    <th className="py-2 text-right">Diskon</th>
                                    <th className="py-2 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {detail.items.map(item => (
                                    <tr key={item.id} className="border-b border-surface-800">
                                        <td className="py-2">{item.kind === 'service' ? '🔧 ' : ''}{item.name}</td>
                                        <td className="py-2 text-right">{item.qty}</td>
                                        <td className="py-2 text-right">{formatRupiah(item.unitPrice)}</td>
                                        <td className="py-2 text-right text-amber-400">{item.discountValue ? (item.discountType === 'percent' ? `${item.discountValue}%` : formatRupiah(item.discountValue)) : '-'}</td>
                                        <td className="py-2 text-right font-medium">{formatRupiah(item.lineTotal)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="space-y-1 text-sm border-t border-surface-700 pt-3">
                            <div className="flex justify-between"><span>Subtotal</span><span>{formatRupiah(detail.subtotal)}</span></div>
                            {detail.discountTotal > 0 && <div className="flex justify-between text-amber-400"><span>Diskon</span><span>−{formatRupiah(detail.discountTotal)}</span></div>}
                            {detail.taxTotal > 0 && <div className="flex justify-between"><span>Pajak</span><span>{formatRupiah(detail.taxTotal)}</span></div>}
                            <div className="flex justify-between font-bold text-lg"><span>Grand Total</span><span>{formatRupiah(detail.grandTotal)}</span></div>
                            {detail.payment.cashReceived !== undefined && <div className="flex justify-between text-surface-400"><span>Dibayar</span><span>{formatRupiah(detail.payment.cashReceived)}</span></div>}
                            {detail.payment.change !== undefined && detail.payment.change > 0 && <div className="flex justify-between text-emerald-400"><span>Kembalian</span><span>{formatRupiah(detail.payment.change)}</span></div>}
                            {detail.note && <p className="text-xs text-surface-500 mt-2">Catatan: {detail.note}</p>}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}

function downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
