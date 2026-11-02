import { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { formatRupiah } from '../../utils/format';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function DashboardTab() {
    const orders = useStore(s => s.orders);
    const [range, setRange] = useState(7);

    const paidOrders = useMemo(() => orders.filter(o => o.status === 'paid'), [orders]);

    // Today stats
    const todayStats = useMemo(() => {
        const today = new Date().toDateString();
        const todayOrders = paidOrders.filter(o => new Date(o.createdAt).toDateString() === today);
        const omzet = todayOrders.reduce((s, o) => s + o.grandTotal, 0);
        return {
            count: todayOrders.length,
            omzet,
            avg: todayOrders.length > 0 ? omzet / todayOrders.length : 0,
        };
    }, [paidOrders]);

    // Daily sales chart data
    const dailyData = useMemo(() => {
        const days: Record<string, number> = {};
        const now = new Date();
        for (let i = range - 1; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const key = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
            days[key] = 0;
        }
        paidOrders.forEach(o => {
            const d = new Date(o.createdAt);
            const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
            if (diff < range) {
                const key = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
                if (days[key] !== undefined) days[key] += o.grandTotal;
            }
        });
        return Object.entries(days).map(([date, total]) => ({ date, total }));
    }, [paidOrders, range]);

    // Top products
    const topProducts = useMemo(() => {
        const map: Record<string, { name: string; qty: number; revenue: number }> = {};
        paidOrders.forEach(o => {
            o.items.forEach(item => {
                if (!map[item.refId]) map[item.refId] = { name: item.name, qty: 0, revenue: 0 };
                map[item.refId].qty += item.qty;
                map[item.refId].revenue += item.lineTotal;
            });
        });
        return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 5);
    }, [paidOrders]);

    // Payment method breakdown
    const paymentBreakdown = useMemo(() => {
        const map: Record<string, number> = {};
        paidOrders.forEach(o => {
            const name = o.payment.methodName;
            map[name] = (map[name] || 0) + o.grandTotal;
        });
        return Object.entries(map).map(([name, value]) => ({ name, value }));
    }, [paidOrders]);

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Dashboard</h1>

            {/* Today Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-primary-600/20 to-primary-800/10 border border-primary-500/20 rounded-2xl p-5">
                    <p className="text-sm text-surface-400">Omzet Hari Ini</p>
                    <p className="text-2xl font-bold text-primary-400 mt-1">{formatRupiah(todayStats.omzet)}</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-800/10 border border-emerald-500/20 rounded-2xl p-5">
                    <p className="text-sm text-surface-400">Jumlah Transaksi</p>
                    <p className="text-2xl font-bold text-emerald-400 mt-1">{todayStats.count}</p>
                </div>
                <div className="bg-gradient-to-br from-amber-600/20 to-amber-800/10 border border-amber-500/20 rounded-2xl p-5">
                    <p className="text-sm text-surface-400">Rata-rata</p>
                    <p className="text-2xl font-bold text-amber-400 mt-1">{formatRupiah(todayStats.avg)}</p>
                </div>
            </div>

            {/* Sales Chart */}
            <div className="bg-surface-800 border border-surface-700 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Grafik Penjualan</h3>
                    <div className="flex gap-2">
                        {[7, 30, 90].map(d => (
                            <button key={d} onClick={() => setRange(d)} className={`px-3 py-1 rounded-lg text-xs font-medium transition ${range === d ? 'bg-primary-600 text-white' : 'bg-surface-700 text-surface-400 hover:bg-surface-600'}`}>
                                {d} Hari
                            </button>
                        ))}
                    </div>
                </div>
                <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={dailyData}>
                        <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }}
                            labelStyle={{ color: '#94a3b8' }}
                            formatter={(value: number) => [formatRupiah(value), 'Penjualan']}
                        />
                        <Bar dataKey="total" fill="#6366f1" radius={[6, 6, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Top Products */}
                <div className="bg-surface-800 border border-surface-700 rounded-2xl p-5">
                    <h3 className="font-semibold mb-4">Top Produk Terjual</h3>
                    {topProducts.length === 0 ? (
                        <p className="text-surface-500 text-sm">Belum ada data</p>
                    ) : (
                        <div className="space-y-3">
                            {topProducts.map((p, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="w-6 h-6 rounded-full bg-primary-600/20 text-primary-400 text-xs flex items-center justify-center font-bold">{i + 1}</span>
                                        <span className="text-sm">{p.name}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-sm font-medium">{p.qty} pcs</span>
                                        <span className="text-xs text-surface-400 ml-2">{formatRupiah(p.revenue)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Payment Methods */}
                <div className="bg-surface-800 border border-surface-700 rounded-2xl p-5">
                    <h3 className="font-semibold mb-4">Metode Pembayaran</h3>
                    {paymentBreakdown.length === 0 ? (
                        <p className="text-surface-500 text-sm">Belum ada data</p>
                    ) : (
                        <div className="flex items-center gap-6">
                            <ResponsiveContainer width={120} height={120}>
                                <PieChart>
                                    <Pie data={paymentBreakdown} dataKey="value" cx="50%" cy="50%" outerRadius={55} innerRadius={35}>
                                        {paymentBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="space-y-2 flex-1">
                                {paymentBreakdown.map((p, i) => (
                                    <div key={i} className="flex items-center gap-2 text-sm">
                                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                        <span className="flex-1">{p.name}</span>
                                        <span className="font-medium">{formatRupiah(p.value)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
