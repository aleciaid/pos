import { useRef, useState } from 'react';
import { exportFullBackup, importFullBackup, type FullBackup } from '../../db';
import { useStore } from '../../store';
import { useToastStore } from '../../store/toast';

export default function BackupTab() {
    const loadAll = useStore(s => s.loadAll);
    const addToast = useToastStore(s => s.addToast);
    const fileRef = useRef<HTMLInputElement>(null);
    const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
    const [importing, setImporting] = useState(false);

    const handleExport = async () => {
        try {
            const data = await exportFullBackup();
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pos-backup-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            addToast('Backup berhasil diunduh ✅');
        } catch {
            addToast('Gagal export backup', 'error');
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImporting(true);
        try {
            const text = await file.text();
            const data: FullBackup = JSON.parse(text);
            // Basic schema validation
            if (!data.products && !data.services && !data.orders) {
                throw new Error('Format backup tidak valid');
            }
            await importFullBackup(data, importMode);
            await loadAll();
            addToast(`Backup berhasil diimport (mode: ${importMode}) ✅`);
        } catch (err: any) {
            addToast(err.message || 'Gagal import backup', 'error');
        } finally {
            setImporting(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    return (
        <div className="space-y-6 max-w-xl">
            <h1 className="text-2xl font-bold">Backup & Restore</h1>

            {/* Export */}
            <div className="bg-surface-800 border border-surface-700 rounded-2xl p-6 space-y-4">
                <h2 className="font-semibold text-lg">📤 Export Full Backup</h2>
                <p className="text-sm text-surface-400">Mengekspor semua data: produk, jasa, metode pembayaran, transaksi, pergerakan stok, dan pengaturan dalam format JSON.</p>
                <button onClick={handleExport} className="px-6 py-3 rounded-xl bg-primary-600 hover:bg-primary-500 font-medium transition">Download Backup JSON</button>
            </div>

            {/* Import */}
            <div className="bg-surface-800 border border-surface-700 rounded-2xl p-6 space-y-4">
                <h2 className="font-semibold text-lg">📥 Import Backup</h2>
                <p className="text-sm text-surface-400">Restore data dari file backup JSON. Pilih mode import:</p>

                <div className="flex gap-3">
                    <button
                        onClick={() => setImportMode('merge')}
                        className={`flex-1 py-3 rounded-xl text-sm font-medium transition border ${importMode === 'merge' ? 'bg-primary-600 border-primary-500' : 'bg-surface-700 border-surface-600'}`}
                    >
                        🔄 Merge
                        <p className="text-xs opacity-70 mt-1">Gabungkan dengan data yang ada</p>
                    </button>
                    <button
                        onClick={() => setImportMode('replace')}
                        className={`flex-1 py-3 rounded-xl text-sm font-medium transition border ${importMode === 'replace' ? 'bg-red-600 border-red-500' : 'bg-surface-700 border-surface-600'}`}
                    >
                        ⚠️ Replace
                        <p className="text-xs opacity-70 mt-1">Hapus semua data lama</p>
                    </button>
                </div>

                <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="w-full text-sm" disabled={importing} />
                {importing && <p className="text-sm text-primary-400 animate-pulse">Mengimpor data...</p>}
            </div>
        </div>
    );
}
