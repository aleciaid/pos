import { useState } from 'react';
import { useStore } from '../../store';
import { useToastStore } from '../../store/toast';
import { generateId } from '../../utils/format';
import type { PaymentMethod } from '../../types';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';

export default function PaymentMethodsTab() {
    const paymentMethods = useStore(s => s.paymentMethods);
    const savePaymentMethod = useStore(s => s.savePaymentMethod);
    const deletePaymentMethod = useStore(s => s.deletePaymentMethod);
    const addToast = useToastStore(s => s.addToast);

    const [editing, setEditing] = useState<PaymentMethod | null>(null);
    const [showForm, setShowForm] = useState(false);

    const openNew = () => { setEditing({ id: generateId(), name: '', type: 'cash', isActive: true }); setShowForm(true); };
    const openEdit = (pm: PaymentMethod) => { setEditing({ ...pm }); setShowForm(true); };

    const save = async () => {
        if (!editing) return;
        if (!editing.name.trim()) { addToast('Nama metode wajib diisi!', 'error'); return; }
        await savePaymentMethod(editing);
        setShowForm(false);
        setEditing(null);
        addToast('Metode pembayaran disimpan ✅');
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Hapus metode ini?')) return;
        await deletePaymentMethod(id);
        addToast('Metode dihapus');
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Metode Pembayaran</h1>
                <button onClick={openNew} className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-sm font-medium transition">+ Tambah Metode</button>
            </div>

            {paymentMethods.length === 0 ? (
                <EmptyState icon="💳" title="Belum ada metode pembayaran" />
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {paymentMethods.map(pm => (
                        <div key={pm.id} className="bg-surface-800 border border-surface-700 rounded-xl p-4 flex items-center justify-between">
                            <div>
                                <p className="font-medium">{pm.type === 'cash' ? '💵' : '💳'} {pm.name}</p>
                                <p className="text-xs text-surface-400 mt-0.5">Tipe: {pm.type === 'cash' ? 'Tunai' : 'Non-tunai'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pm.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-surface-600 text-surface-400'}`}>
                                    {pm.isActive ? 'Aktif' : 'Nonaktif'}
                                </span>
                                <button onClick={() => openEdit(pm)} className="px-2 py-1 rounded-lg bg-surface-700 hover:bg-surface-600 text-xs transition">Edit</button>
                                <button onClick={() => handleDelete(pm.id)} className="px-2 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs transition">Hapus</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Modal open={showForm} onClose={() => { setShowForm(false); setEditing(null); }} title="Metode Pembayaran">
                {editing && (
                    <div className="space-y-4">
                        <div><label className="text-sm font-medium mb-1 block">Nama *</label><input type="text" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-surface-700 border border-surface-600 focus:border-primary-500 outline-none text-sm" /></div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Tipe</label>
                            <div className="flex gap-3">
                                <button onClick={() => setEditing({ ...editing, type: 'cash' })} className={`flex-1 py-2 rounded-xl text-sm font-medium transition border ${editing.type === 'cash' ? 'bg-primary-600 border-primary-500' : 'bg-surface-700 border-surface-600'}`}>💵 Tunai</button>
                                <button onClick={() => setEditing({ ...editing, type: 'noncash' })} className={`flex-1 py-2 rounded-xl text-sm font-medium transition border ${editing.type === 'noncash' ? 'bg-primary-600 border-primary-500' : 'bg-surface-700 border-surface-600'}`}>💳 Non-tunai</button>
                            </div>
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
        </div>
    );
}
