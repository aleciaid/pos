import { useState } from 'react';
import { useStore } from '../../store';
import { useToastStore } from '../../store/toast';

export default function SettingsTab() {
    const settings = useStore(s => s.settings);
    const saveSettings = useStore(s => s.saveSettings);
    const addToast = useToastStore(s => s.addToast);

    const [pin, setPin] = useState(settings.adminPin);
    const [taxEnabled, setTaxEnabled] = useState(settings.taxEnabledDefault);
    const [taxPercent, setTaxPercent] = useState(String(settings.taxPercent));
    const [lowStock, setLowStock] = useState(String(settings.lowStockThreshold));
    const [storeName, setStoreName] = useState(settings.storeName || 'POS System');
    const [storeAddress, setStoreAddress] = useState(settings.storeAddress || '');

    const save = async () => {
        if (!pin.trim() || pin.length < 4) { addToast('PIN minimal 4 karakter!', 'error'); return; }
        if (!storeName.trim()) { addToast('Nama toko tidak boleh kosong!', 'error'); return; }
        await saveSettings({
            ...settings,
            adminPin: pin,
            taxEnabledDefault: taxEnabled,
            taxPercent: parseFloat(taxPercent) || 11,
            lowStockThreshold: parseInt(lowStock) || 5,
            storeName: storeName.trim(),
            storeAddress: storeAddress.trim(),
        });
        addToast('Pengaturan disimpan ✅');
    };

    return (
        <div className="space-y-6 max-w-xl">
            <h1 className="text-2xl font-bold">Pengaturan</h1>

            {/* Informasi Toko */}
            <div className="bg-surface-800 border border-surface-700 rounded-2xl p-6 space-y-5">
                <h2 className="font-semibold text-base flex items-center gap-2">🏪 Informasi Toko</h2>

                <div>
                    <label className="text-sm font-medium mb-1 block">Nama Toko</label>
                    <input
                        type="text"
                        value={storeName}
                        onChange={e => setStoreName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-surface-700 border border-surface-600 focus:border-primary-500 outline-none text-sm"
                        placeholder="Contoh: Toko Serba Ada"
                    />
                    <p className="text-xs text-surface-400 mt-1">Tampil di bagian atas struk</p>
                </div>

                <div>
                    <label className="text-sm font-medium mb-1 block">Alamat Toko</label>
                    <textarea
                        value={storeAddress}
                        onChange={e => setStoreAddress(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 rounded-xl bg-surface-700 border border-surface-600 focus:border-primary-500 outline-none text-sm resize-none"
                        placeholder="Contoh: Jl. Merdeka No. 10, Kota..."
                    />
                    <p className="text-xs text-surface-400 mt-1">Tampil di bawah nama toko pada struk</p>
                </div>
            </div>

            {/* Pengaturan Sistem */}
            <div className="bg-surface-800 border border-surface-700 rounded-2xl p-6 space-y-5">
                <h2 className="font-semibold text-base flex items-center gap-2">⚙️ Pengaturan Sistem</h2>

                {/* PIN */}
                <div>
                    <label className="text-sm font-medium mb-1 block">Admin PIN</label>
                    <input
                        type="password"
                        value={pin}
                        onChange={e => setPin(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-surface-700 border border-surface-600 focus:border-primary-500 outline-none text-sm"
                        placeholder="Minimal 4 karakter"
                    />
                </div>

                {/* Tax */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium">Pajak Default Aktif</label>
                        <button
                            onClick={() => setTaxEnabled(!taxEnabled)}
                            className={`w-10 h-5 rounded-full transition relative ${taxEnabled ? 'bg-primary-500' : 'bg-surface-600'}`}
                        >
                            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${taxEnabled ? 'left-5' : 'left-0.5'}`} />
                        </button>
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-1 block">Persentase Pajak (%)</label>
                        <input
                            type="number"
                            value={taxPercent}
                            onChange={e => setTaxPercent(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-surface-700 border border-surface-600 focus:border-primary-500 outline-none text-sm"
                        />
                    </div>
                </div>

                {/* Low stock */}
                <div>
                    <label className="text-sm font-medium mb-1 block">Threshold Stok Menipis</label>
                    <input
                        type="number"
                        value={lowStock}
                        onChange={e => setLowStock(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-surface-700 border border-surface-600 focus:border-primary-500 outline-none text-sm"
                    />
                    <p className="text-xs text-surface-400 mt-1">Produk dengan stok ≤ nilai ini akan ditandai peringatan</p>
                </div>

                <button onClick={save} className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-500 font-medium transition">Simpan Pengaturan</button>
            </div>

            <div className="bg-surface-800 border border-surface-700 rounded-2xl p-6">
                <h3 className="font-semibold mb-2">Tentang Aplikasi</h3>
                <p className="text-sm text-surface-400">POS System v1.0</p>
                <p className="text-sm text-surface-400">Semua data tersimpan di browser lokal (IndexedDB).</p>
                <p className="text-sm text-surface-400">Format mata uang: IDR (Rupiah)</p>
            </div>
        </div>
    );
}
