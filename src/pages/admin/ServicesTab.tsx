import { useState } from 'react';
import { useStore } from '../../store';
import { useToastStore } from '../../store/toast';
import { formatRupiah, generateId } from '../../utils/format';
import type { Service } from '../../types';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';

const emptyService = (): Service => ({
    id: generateId(), name: '', price: 0, category: '', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
});

export default function ServicesTab() {
    const services = useStore(s => s.services);
    const saveService = useStore(s => s.saveService);
    const deleteService = useStore(s => s.deleteService);
    const addToast = useToastStore(s => s.addToast);

    const [editing, setEditing] = useState<Service | null>(null);
    const [showForm, setShowForm] = useState(false);

    const openNew = () => { setEditing(emptyService()); setShowForm(true); };
    const openEdit = (s: Service) => { setEditing({ ...s }); setShowForm(true); };

    const save = async () => {
        if (!editing) return;
        if (!editing.name.trim()) { addToast('Nama jasa wajib diisi!', 'error'); return; }
        editing.updatedAt = new Date().toISOString();
        await saveService(editing);
        setShowForm(false);
        setEditing(null);
        addToast('Jasa disimpan ✅');
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Hapus jasa ini?')) return;
        await deleteService(id);
        addToast('Jasa dihapus');
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Jasa</h1>
                <button onClick={openNew} className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-sm font-medium transition">+ Tambah Jasa</button>
            </div>

            {services.length === 0 ? (
                <EmptyState icon="🔧" title="Belum ada jasa" subtitle="Tambahkan jasa pertama" />
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {services.map(s => (
                        <div key={s.id} className="bg-surface-800 border border-surface-700 rounded-xl p-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-medium">{s.name}</p>
                                    {s.category && <p className="text-xs text-surface-400 mt-0.5">{s.category}</p>}
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-surface-600 text-surface-400'}`}>
                                    {s.isActive ? 'Aktif' : 'Nonaktif'}
                                </span>
                            </div>
                            <p className="text-primary-400 font-semibold mt-2">{formatRupiah(s.price)}</p>
                            <div className="flex gap-2 mt-3">
                                <button onClick={() => openEdit(s)} className="px-3 py-1 rounded-lg bg-surface-700 hover:bg-surface-600 text-xs transition">Edit</button>
                                <button onClick={() => handleDelete(s.id)} className="px-3 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs transition">Hapus</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Modal open={showForm} onClose={() => { setShowForm(false); setEditing(null); }} title={editing?.createdAt === editing?.updatedAt ? 'Tambah Jasa' : 'Edit Jasa'}>
                {editing && (
                    <div className="space-y-4">
                        <div><label className="text-sm font-medium mb-1 block">Nama *</label><input type="text" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-surface-700 border border-surface-600 focus:border-primary-500 outline-none text-sm" /></div>
                        <div><label className="text-sm font-medium mb-1 block">Harga *</label><input type="number" value={editing.price || ''} onChange={e => setEditing({ ...editing, price: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-xl bg-surface-700 border border-surface-600 focus:border-primary-500 outline-none text-sm" /></div>
                        <div><label className="text-sm font-medium mb-1 block">Kategori</label><input type="text" value={editing.category || ''} onChange={e => setEditing({ ...editing, category: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-surface-700 border border-surface-600 focus:border-primary-500 outline-none text-sm" /></div>
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
        </div>
    );
}
