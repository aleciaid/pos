import { useState } from 'react';
import { useStore } from '../../store';
import { useToastStore } from '../../store/toast';
import { formatRupiah, generateId } from '../../utils/format';
import type { Product, StockMovement } from '../../types';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';

const emptyProduct = (): Product => ({
    id: generateId(), name: '', sku: '', category: '', price: 0, cost: 0, stock: 0, unit: 'pcs', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
});

export default function ProductsTab() {
    const products = useStore(s => s.products);
    const settings = useStore(s => s.settings);
    const saveProduct = useStore(s => s.saveProduct);
    const deleteProduct = useStore(s => s.deleteProduct);
    const addStockMovement = useStore(s => s.addStockMovement);
    const addToast = useToastStore(s => s.addToast);

    const [editing, setEditing] = useState<Product | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [stockAdj, setStockAdj] = useState<{ product: Product; delta: string; reason: string; note: string } | null>(null);
    const [search, setSearch] = useState('');
    const [importCsv, setImportCsv] = useState(false);

    const filteredProducts = products.filter(p => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q)) || (p.category && p.category.toLowerCase().includes(q));
    });

    const openNew = () => { setEditing(emptyProduct()); setShowForm(true); };
    const openEdit = (p: Product) => { setEditing({ ...p }); setShowForm(true); };

    const save = async () => {
        if (!editing) return;
        if (!editing.name.trim()) { addToast('Nama produk wajib diisi!', 'error'); return; }
        editing.updatedAt = new Date().toISOString();
        await saveProduct(editing);
        setShowForm(false);
        setEditing(null);
        addToast('Produk disimpan ✅');
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Hapus produk ini?')) return;
        await deleteProduct(id);
        addToast('Produk dihapus');
    };

    const submitStockAdj = async () => {
        if (!stockAdj) return;
        const delta = parseInt(stockAdj.delta) || 0;
        if (delta === 0) { addToast('Delta harus > 0 atau < 0', 'error'); return; }
        const newStock = stockAdj.product.stock + delta;
        if (newStock < 0) { addToast('Stok tidak boleh negatif!', 'error'); return; }
        const sm: StockMovement = {
            id: generateId(),
            productId: stockAdj.product.id,
            delta,
            reason: stockAdj.reason || 'Koreksi',
            createdAt: new Date().toISOString(),
            note: stockAdj.note || undefined,
        };
        await addStockMovement(sm, newStock);
        setStockAdj(null);
        addToast('Stok diperbarui ✅');
    };

    const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const text = ev.target?.result as string;
            const lines = text.split('\n').filter(l => l.trim());
            if (lines.length < 2) { addToast('CSV kosong atau format salah', 'error'); return; }
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            const nameIdx = headers.indexOf('nama');
            const priceIdx = headers.indexOf('harga');
            const stockIdx = headers.indexOf('stok');
            const skuIdx = headers.indexOf('sku');
            const categoryIdx = headers.indexOf('kategori');
            const unitIdx = headers.indexOf('satuan');
            if (nameIdx === -1 || priceIdx === -1) { addToast('CSV harus punya kolom "nama" dan "harga"', 'error'); return; }
            const now = new Date().toISOString();
            let count = 0;
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',').map(c => c.trim());
                if (!cols[nameIdx]) continue;
                const p: Product = {
                    id: generateId(), name: cols[nameIdx], sku: skuIdx >= 0 ? cols[skuIdx] : undefined,
                    category: categoryIdx >= 0 ? cols[categoryIdx] : undefined,
                    price: parseFloat(cols[priceIdx]) || 0, stock: stockIdx >= 0 ? parseInt(cols[stockIdx]) || 0 : 0,
                    unit: unitIdx >= 0 ? cols[unitIdx] : 'pcs', isActive: true, createdAt: now, updatedAt: now,
                };
                await saveProduct(p);
                count++;
            }
            addToast(`${count} produk diimport ✅`);
            setImportCsv(false);
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold">Produk & Stok</h1>
                <div className="flex gap-2">
                    <button onClick={() => setImportCsv(true)} className="px-4 py-2 rounded-xl bg-surface-700 hover:bg-surface-600 text-sm font-medium transition">📄 Import CSV</button>
                    <button onClick={openNew} className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-sm font-medium transition">+ Tambah Produk</button>
                </div>
            </div>

            <input
                type="text"
                placeholder="Cari produk..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full max-w-md px-4 py-2 rounded-xl bg-surface-800 border border-surface-700 focus:border-primary-500 outline-none text-sm"
            />

            {filteredProducts.length === 0 ? (
                <EmptyState icon="📦" title="Belum ada produk" subtitle="Tambahkan produk pertama Anda" />
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-surface-700 text-surface-400 text-left">
                                <th className="py-3 px-3">Nama</th>
                                <th className="py-3 px-3">SKU</th>
                                <th className="py-3 px-3">Kategori</th>
                                <th className="py-3 px-3 text-right">Harga</th>
                                <th className="py-3 px-3 text-right">Stok</th>
                                <th className="py-3 px-3">Status</th>
                                <th className="py-3 px-3">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.map(p => (
                                <tr key={p.id} className="border-b border-surface-800 hover:bg-surface-800/50 transition">
                                    <td className="py-3 px-3 font-medium">{p.name}</td>
                                    <td className="py-3 px-3 text-surface-400 font-mono text-xs">{p.sku || '-'}</td>
                                    <td className="py-3 px-3 text-surface-400">{p.category || '-'}</td>
                                    <td className="py-3 px-3 text-right font-medium">{formatRupiah(p.price)}</td>
                                    <td className={`py-3 px-3 text-right font-medium ${p.stock <= settings.lowStockThreshold ? 'text-amber-400' : ''}`}>
                                        {p.stock} {p.unit || ''}
                                        {p.stock <= settings.lowStockThreshold && <span className="ml-1 text-xs">⚠️</span>}
                                    </td>
                                    <td className="py-3 px-3">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-surface-600 text-surface-400'}`}>
                                            {p.isActive ? 'Aktif' : 'Nonaktif'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-3">
                                        <div className="flex gap-1">
                                            <button onClick={() => openEdit(p)} className="px-2 py-1 rounded-lg bg-surface-700 hover:bg-surface-600 text-xs transition">Edit</button>
                                            <button onClick={() => setStockAdj({ product: p, delta: '', reason: 'Restock', note: '' })} className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-xs transition">Stok</button>
                                            <button onClick={() => handleDelete(p.id)} className="px-2 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs transition">Hapus</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Product Form Modal */}
            <Modal open={showForm} onClose={() => { setShowForm(false); setEditing(null); }} title={editing?.createdAt === editing?.updatedAt ? 'Tambah Produk' : 'Edit Produk'}>
                {editing && (
                    <div className="space-y-4">
                        <div><label className="text-sm font-medium mb-1 block">Nama *</label><input type="text" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-surface-700 border border-surface-600 focus:border-primary-500 outline-none text-sm" /></div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-sm font-medium mb-1 block">SKU</label><input type="text" value={editing.sku || ''} onChange={e => setEditing({ ...editing, sku: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-surface-700 border border-surface-600 focus:border-primary-500 outline-none text-sm" /></div>
                            <div><label className="text-sm font-medium mb-1 block">Kategori</label><input type="text" value={editing.category || ''} onChange={e => setEditing({ ...editing, category: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-surface-700 border border-surface-600 focus:border-primary-500 outline-none text-sm" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-sm font-medium mb-1 block">Harga Jual *</label><input type="number" value={editing.price || ''} onChange={e => setEditing({ ...editing, price: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-xl bg-surface-700 border border-surface-600 focus:border-primary-500 outline-none text-sm" /></div>
                            <div><label className="text-sm font-medium mb-1 block">Harga Modal</label><input type="number" value={editing.cost || ''} onChange={e => setEditing({ ...editing, cost: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-xl bg-surface-700 border border-surface-600 focus:border-primary-500 outline-none text-sm" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-sm font-medium mb-1 block">Stok</label><input type="number" value={editing.stock || ''} onChange={e => setEditing({ ...editing, stock: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-xl bg-surface-700 border border-surface-600 focus:border-primary-500 outline-none text-sm" /></div>
                            <div><label className="text-sm font-medium mb-1 block">Satuan</label><input type="text" value={editing.unit || ''} onChange={e => setEditing({ ...editing, unit: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-surface-700 border border-surface-600 focus:border-primary-500 outline-none text-sm" /></div>
                        </div>
                        <div className="flex items-center gap-3">
                            <label className="text-sm font-medium">Status:</label>
                            <button onClick={() => setEditing({ ...editing, isActive: !editing.isActive })} className={`px-3 py-1 rounded-full text-xs font-medium transition ${editing.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-surface-600 text-surface-400'}`}>
                                {editing.isActive ? 'Aktif' : 'Nonaktif'}
                            </button>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button onClick={() => { setShowForm(false); setEditing(null); }} className="flex-1 py-2 rounded-xl bg-surface-700 hover:bg-surface-600 font-medium transition">Batal</button>
                            <button onClick={save} className="flex-1 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 font-medium transition">Simpan</button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Stock Adjustment Modal */}
            <Modal open={!!stockAdj} onClose={() => setStockAdj(null)} title={`Sesuaikan Stok: ${stockAdj?.product.name || ''}`}>
                {stockAdj && (
                    <div className="space-y-4">
                        <p className="text-sm text-surface-400">Stok saat ini: <span className="font-bold text-white">{stockAdj.product.stock}</span></p>
                        <div><label className="text-sm font-medium mb-1 block">Perubahan (+ atau −)</label><input type="number" value={stockAdj.delta} onChange={e => setStockAdj({ ...stockAdj, delta: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-surface-700 border border-surface-600 focus:border-primary-500 outline-none text-sm" placeholder="+10 atau -5" /></div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Alasan</label>
                            <select value={stockAdj.reason} onChange={e => setStockAdj({ ...stockAdj, reason: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-surface-700 border border-surface-600 outline-none text-sm">
                                <option value="Restock">Restock</option>
                                <option value="Rusak">Rusak</option>
                                <option value="Koreksi">Koreksi</option>
                                <option value="Lainnya">Lainnya</option>
                            </select>
                        </div>
                        <div><label className="text-sm font-medium mb-1 block">Catatan</label><input type="text" value={stockAdj.note} onChange={e => setStockAdj({ ...stockAdj, note: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-surface-700 border border-surface-600 focus:border-primary-500 outline-none text-sm" /></div>
                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setStockAdj(null)} className="flex-1 py-2 rounded-xl bg-surface-700 hover:bg-surface-600 font-medium transition">Batal</button>
                            <button onClick={submitStockAdj} className="flex-1 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 font-medium transition">Simpan</button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* CSV Import Modal */}
            <Modal open={importCsv} onClose={() => setImportCsv(false)} title="Import Produk dari CSV">
                <div className="space-y-4">
                    <p className="text-sm text-surface-400">Format CSV: <code className="bg-surface-700 px-2 py-0.5 rounded text-xs">nama,harga,stok,sku,kategori,satuan</code></p>
                    <input type="file" accept=".csv" onChange={handleCsvImport} className="w-full text-sm" />
                </div>
            </Modal>
        </div>
    );
}
