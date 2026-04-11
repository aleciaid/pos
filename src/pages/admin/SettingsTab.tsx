import { useState, useRef, useEffect } from 'react';
import jsQR from 'jsqr';
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
    const [webhookUrl, setWebhookUrl] = useState(settings.webhookUrl || '');
    const [qrisWebhookToken, setQrisWebhookToken] = useState(settings.qrisWebhookToken || '');
    const [qrisPreview, setQrisPreview] = useState(settings.qrisImageData || '');
    const [qrisString, setQrisString] = useState(settings.qrisString || '');
    const [testingWebhook, setTestingWebhook] = useState(false);
    const [generatingWebhook, setGeneratingWebhook] = useState(false);
    const [copied, setCopied] = useState(false);
    const [qrisUniqueCodeEnabled, setQrisUniqueCodeEnabled] = useState(settings.qrisUniqueCodeEnabled ?? true);
    const [webhookLogs, setWebhookLogs] = useState<any>(null);
    const [fetchingLogs, setFetchingLogs] = useState(false);
    const [copiedLogId, setCopiedLogId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleQrisUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            addToast('File harus berupa gambar!', 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            addToast('Ukuran gambar max 5MB!', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            setQrisPreview(result);
            
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const code = jsQR(imageData.data, imageData.width, imageData.height);
                    if (code && code.data) {
                        setQrisString(code.data);
                        addToast('Gambar QRIS dimuat dan data Payload berhasil dibaca ✅');
                    } else {
                        setQrisString('');
                        addToast('Peringatan: Gagal membaca data teks dari gambar QRIS!', 'error');
                    }
                }
            };
            img.src = result;
        };
        reader.readAsDataURL(file);
    };

    const removeQris = () => {
        setQrisPreview('');
        setQrisString('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        addToast('Gambar QRIS dihapus');
    };

    const fetchWebhookLogs = async () => {
        if (!qrisWebhookToken) return;
        setFetchingLogs(true);
        try {
            const res = await fetch(`/api/webhook/token/${qrisWebhookToken}/requests?sorting=newest&limit=3&_t=${Date.now()}`, {
                signal: AbortSignal.timeout(5000),
                cache: 'no-store',
                headers: {
                    'Pragma': 'no-cache',
                    'Cache-Control': 'no-cache'
                }
            });
            if (res.ok) {
                const data = await res.json();
                setWebhookLogs(data.data || []);
            }
        } catch {
            addToast('Gagal memuat log webhook otomatis', 'error');
        } finally {
            setFetchingLogs(false);
        }
    };

    useEffect(() => {
        if (qrisWebhookToken) {
            fetchWebhookLogs();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [qrisWebhookToken]);

    // Generate a unique webhook.site receiver URL
    const generateWebhookUrl = async () => {
        setGeneratingWebhook(true);
        try {
            const res = await fetch('/api/webhook/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ default_status: 200, default_content: '{"received":true}', default_content_type: 'application/json' }),
                signal: AbortSignal.timeout(10000),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const token = data.uuid;
            if (!token) throw new Error('Token tidak diterima');
            setQrisWebhookToken(token);
            // auto-save immediately
            await saveSettings({ ...settings, qrisWebhookToken: token });
            addToast('URL webhook QRIS berhasil dibuat! ✅', 'success');
        } catch (err: any) {
            addToast(`Gagal membuat webhook: ${err.message}`, 'error');
        } finally {
            setGeneratingWebhook(false);
        }
    };

    const copyWebhookUrl = () => {
        const url = `https://webhook.site/${qrisWebhookToken}`;
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const copyLogData = (logId: string, content: any) => {
        const textToCopy = typeof content === 'object' ? JSON.stringify(content, null, 2) : content || '';
        navigator.clipboard.writeText(textToCopy).then(() => {
            setCopiedLogId(logId);
            setTimeout(() => setCopiedLogId(null), 2000);
        });
    };

    const resetWebhookToken = async () => {
        if (!confirm('Reset akan membuat URL baru. URL lama tidak bisa digunakan lagi. Lanjutkan?')) return;
        setQrisWebhookToken('');
        await saveSettings({ ...settings, qrisWebhookToken: '' });
        addToast('Token webhook direset');
    };

    const testWebhook = async () => {
        if (!webhookUrl.trim()) {
            addToast('Masukkan URL webhook terlebih dahulu!', 'error');
            return;
        }
        setTestingWebhook(true);
        try {
            const testPayload = {
                type: 'test',
                message: 'Tes koneksi webhook dari POS System',
                timestamp: new Date().toISOString(),
                storeName: storeName,
            };
            const res = await fetch(webhookUrl.trim(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testPayload),
                signal: AbortSignal.timeout(10000),
            });
            if (res.ok) {
                addToast('Webhook berhasil terkirim! ✅');
            } else {
                addToast(`Webhook gagal: HTTP ${res.status}`, 'error');
            }
        } catch (err: any) {
            addToast(`Webhook error: ${err.message || 'Gagal mengirim'}`, 'error');
        } finally {
            setTestingWebhook(false);
        }
    };

    const save = async () => {
        if (!pin.trim() || pin.length < 4) { addToast('PIN minimal 4 karakter!', 'error'); return; }
        if (!storeName.trim()) { addToast('Nama toko tidak boleh kosong!', 'error'); return; }
        if (webhookUrl.trim() && !webhookUrl.trim().startsWith('http')) {
            addToast('URL webhook harus diawali http:// atau https://', 'error');
            return;
        }
        await saveSettings({
            ...settings,
            adminPin: pin,
            taxEnabledDefault: taxEnabled,
            taxPercent: parseFloat(taxPercent) || 11,
            lowStockThreshold: parseInt(lowStock) || 5,
            storeName: storeName.trim(),
            storeAddress: storeAddress.trim(),
            qrisImageData: qrisPreview,
            qrisString: qrisString,
            webhookUrl: webhookUrl.trim(),
            qrisWebhookToken: qrisWebhookToken,
            qrisUniqueCodeEnabled: qrisUniqueCodeEnabled,
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

            {/* QRIS Upload */}
            <div className="bg-surface-800 border border-surface-700 rounded-2xl p-6 space-y-5">
                <h2 className="font-semibold text-base flex items-center gap-2">
                    <span className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center text-sm">📱</span>
                    QRIS Pembayaran
                </h2>
                <div className="flex items-center justify-between mb-4 border-b border-surface-700 pb-4">
                    <div>
                        <p className="text-sm font-medium">Gunakan Kode Unik pada Nominal</p>
                        <p className="text-xs text-surface-400 mt-1">
                            Jika aktif, nominal otomatis ditambahkan 2 digit acak (Cth: 3.012). 
                            Jika nonaktif, sistem mengecek nominal pembayaran persis sama dengan total (berisiko bila ada 2 pelanggan membayar nominal samaan).
                        </p>
                    </div>
                    <button
                        onClick={() => setQrisUniqueCodeEnabled(!qrisUniqueCodeEnabled)}
                        className={`w-10 h-5 rounded-full transition relative shrink-0 ${qrisUniqueCodeEnabled ? 'bg-primary-500' : 'bg-surface-600'}`}
                    >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${qrisUniqueCodeEnabled ? 'left-5' : 'left-0.5'}`} />
                    </button>
                </div>
                <p className="text-xs text-surface-400 -mt-2">
                    Upload gambar QR Code QRIS Anda (wajib untuk mencatat payload asli).
                </p>

                {qrisPreview ? (
                    <div className="space-y-3">
                        <div className="relative bg-white rounded-xl p-4 flex items-center justify-center">
                            <img
                                src={qrisPreview}
                                alt="QRIS Code"
                                className="max-h-64 w-auto object-contain rounded-lg"
                            />
                            <button
                                onClick={removeQris}
                                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500 hover:bg-red-400 text-white flex items-center justify-center text-sm font-bold transition shadow-lg"
                                title="Hapus gambar QRIS"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-emerald-400">
                            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                            QRIS aktif — akan ditampilkan di halaman kasir saat pembayaran QRIS
                        </div>
                        {qrisString && (
                            <div className="text-xs text-surface-400 bg-surface-900 p-2 rounded-lg break-all font-mono">
                                <strong>Payload:</strong> {qrisString}
                            </div>
                        )}
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-2 rounded-xl bg-surface-700 hover:bg-surface-600 text-sm font-medium transition border border-surface-600"
                        >
                            📁 Ganti Gambar QRIS
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-8 rounded-xl border-2 border-dashed border-surface-600 hover:border-primary-500 bg-surface-700/30 hover:bg-surface-700/50 transition-all group"
                    >
                        <div className="text-center space-y-2">
                            <div className="text-4xl opacity-50 group-hover:opacity-80 transition">📱</div>
                            <p className="text-sm font-medium text-surface-300 group-hover:text-white transition">Klik untuk upload gambar QRIS</p>
                            <p className="text-xs text-surface-500">PNG, JPG, JPEG — Maksimal 5MB</p>
                        </div>
                    </button>
                )}

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleQrisUpload}
                    className="hidden"
                />

                <div className="bg-surface-700/50 rounded-xl p-3 border border-surface-600/50">
                    <p className="text-xs text-surface-400 leading-relaxed">
                        💡 <strong className="text-surface-300">Cara kerja:</strong> Saat kasir memilih metode QRIS, 
                        akan muncul popup berisi gambar QRIS ini beserta nominal yang harus dibayar + kode unik 2 digit di belakangnya. 
                        Contoh: total Rp3.000 → transfer <strong className="text-primary-400">Rp3.012</strong> (12 = kode unik).
                    </p>
                </div>
            </div>

            {/* Webhook URL */}
            <div className="bg-surface-800 border border-surface-700 rounded-2xl p-6 space-y-5">
                <h2 className="font-semibold text-base flex items-center gap-2">
                    <span className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center text-sm">🔗</span>
                    Webhook Notifikasi
                </h2>
                <p className="text-xs text-surface-400 -mt-2">
                    Masukkan URL webhook untuk menerima data transaksi secara otomatis setiap ada transaksi baru.
                </p>

                <div>
                    <label className="text-sm font-medium mb-1 block">Webhook URL</label>
                    <input
                        type="url"
                        value={webhookUrl}
                        onChange={e => setWebhookUrl(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-surface-700 border border-surface-600 focus:border-primary-500 outline-none text-sm font-mono"
                        placeholder="https://example.com/webhook"
                    />
                    <p className="text-xs text-surface-400 mt-1">Data transaksi akan dikirim via POST request dalam format JSON</p>
                </div>

                <button
                    onClick={testWebhook}
                    disabled={testingWebhook || !webhookUrl.trim()}
                    className="w-full py-2.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/30 hover:border-cyan-500/50 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {testingWebhook ? (
                        <>
                            <span className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                            Mengirim tes...
                        </>
                    ) : (
                        <>🧪 Tes Webhook</>
                    )}
                </button>

                <div className="bg-surface-700/50 rounded-xl p-3 border border-surface-600/50">
                    <p className="text-xs text-surface-400 leading-relaxed mb-2">
                        📋 <strong className="text-surface-300">Format data yang dikirim:</strong>
                    </p>
                    <pre className="text-xs text-surface-400 bg-surface-800 rounded-lg p-3 overflow-x-auto font-mono leading-relaxed">
{`{
  "type": "new_transaction",
  "order": {
    "orderNo": "POS-20260403-0001",
    "createdAt": "2026-04-03T...",
    "grandTotal": 30012,
    "payment": { "methodName": "QRIS", ... },
    "items": [ ... ]
  },
  "storeName": "Nama Toko"
}`}
                    </pre>
                </div>
            </div>

            {/* QRIS Payment Webhook Receiver */}
            <div className="bg-surface-800 border border-surface-700 rounded-2xl p-6 space-y-5">
                <h2 className="font-semibold text-base flex items-center gap-2">
                    <span className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg flex items-center justify-center text-sm">✅</span>
                    Webhook Verifikasi Pembayaran QRIS
                </h2>
                <p className="text-xs text-surface-400 -mt-2">
                    Generate URL otomatis untuk menerima notifikasi pembayaran dari aplikasi forwarder di HP kasir.
                    App akan cocokkan nominal + kode unik secara real-time.
                </p>

                {/* Status indicator */}
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${qrisWebhookToken ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-surface-700/50 border-surface-600/50'}`}>
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${qrisWebhookToken ? 'bg-emerald-400 animate-pulse' : 'bg-surface-500'}`} />
                    <span className={`text-xs font-medium flex-1 ${qrisWebhookToken ? 'text-emerald-400' : 'text-surface-400'}`}>
                        {qrisWebhookToken
                            ? 'Aktif — menunggu notifikasi pembayaran masuk setiap 5 detik'
                            : 'Belum diaktifkan — klik "Generate URL" untuk memulai'}
                    </span>
                </div>

                {/* Generated URL display */}
                {qrisWebhookToken ? (
                    <div className="space-y-3">
                        <label className="text-sm font-medium block">URL Penerimaan Notifikasi (auto-generated)</label>
                        <div className="flex gap-2">
                            <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-surface-900 border border-surface-600 rounded-xl overflow-hidden">
                                <span className="text-xs text-emerald-400 font-mono truncate">
                                    https://webhook.site/{qrisWebhookToken}
                                </span>
                            </div>
                            <button
                                onClick={copyWebhookUrl}
                                className={`px-3 py-2 rounded-xl text-xs font-medium transition flex-shrink-0 ${copied ? 'bg-emerald-600 text-white' : 'bg-surface-700 hover:bg-surface-600 text-surface-300'}`}
                            >
                                {copied ? '✅ Disalin!' : '📋 Copy'}
                            </button>
                        </div>
                        <button
                            onClick={resetWebhookToken}
                            className="w-full py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-medium transition"
                        >
                            🔄 Reset & Buat URL Baru
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={generateWebhookUrl}
                        disabled={generatingWebhook}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 disabled:opacity-50 text-white font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                    >
                        {generatingWebhook ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Membuat URL...
                            </>
                        ) : (
                            <>✨ Generate URL Webhook QRIS</>
                        )}
                    </button>
                )}

                {/* Setup guide */}
                <div className="space-y-3">
                    <div className="bg-surface-700/50 rounded-xl p-3 border border-surface-600/50">
                        <p className="text-xs font-semibold text-surface-300 mb-2">📱 Cara setup notifikasi forwarder:</p>
                        <ol className="text-xs text-surface-400 space-y-1.5 list-decimal list-inside">
                            <li>Install aplikasi <strong className="text-surface-300">Notification to Webhook</strong> (Android) di HP kasir</li>
                            <li>Tambahkan GoPay Merchant / DANA Merchant ke daftar app yang dipantau</li>
                            <li>Set Webhook URL ke <strong className="text-emerald-400">URL yang digenerate di atas</strong></li>
                            <li>Method: <code className="bg-surface-800 px-1 rounded">POST</code>, Format: JSON</li>
                        </ol>
                    </div>

                    <div className="bg-surface-700/50 rounded-xl p-3 border border-surface-600/50">
                        <p className="text-xs text-surface-400 mb-2">📥 <strong className="text-surface-300">Format notifikasi yang diterima & diparse:</strong></p>
                        <pre className="text-xs text-surface-400 bg-surface-800 rounded-lg p-3 overflow-x-auto font-mono leading-relaxed">
{`{
  "packageName": "com.gojek.gopaymerchant",
  "appName": "GoPay Merchant",
  "title": "Pembayaran diterima",
  "text": "Pembayaran QRIS Rp 52 di sans-group telah diterima.",
  "timestamp": 1775219145564
}`}
                        </pre>
                        <p className="text-xs text-emerald-400 mt-2">
                            ↳ App mengekstrak nominal dari field <code className="bg-surface-800 px-1 rounded">text</code> dan
                            mencocokkan dengan total bayar.
                        </p>
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                        <p className="text-xs text-amber-400 leading-relaxed">
                            ⏱️ <strong>Timer 1 menit:</strong> Setelah kode unik tampil, app polling setiap 5 detik.
                            Jika dalam 60 detik tidak ada notifikasi cocok → QRIS expired, harus diulang dengan kode baru.
                        </p>
                    </div>
                </div>

                {/* Webhook Logs Viewer */}
                {qrisWebhookToken && (
                    <div className="pt-4 border-t border-surface-700/50 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-surface-300">Log Terbaru Webhook</h3>
                            <button 
                                onClick={fetchWebhookLogs}
                                disabled={fetchingLogs}
                                className="text-xs bg-surface-700 hover:bg-surface-600 px-3 py-1.5 rounded-lg flex items-center gap-2 transition disabled:opacity-50"
                            >
                                {fetchingLogs ? 'Mengecek...' : '↻ Refresh'}
                            </button>
                        </div>
                        
                        {!webhookLogs ? (
                            <p className="text-xs text-surface-500 text-center py-4">Memuat log...</p>
                        ) : webhookLogs.length === 0 ? (
                            <div className="bg-surface-700/30 rounded-xl p-4 text-center">
                                <p className="text-xs text-surface-400">Belum ada request yang masuk ke URL ini.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {webhookLogs.map((log: any) => (
                                    <div key={log.uuid} className="bg-surface-900 border border-surface-600 rounded-xl p-3 relative">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">
                                                    {log.method}
                                                </span>
                                                <span className="text-[10px] text-surface-500">
                                                    {new Date(log.created_at).toLocaleString('id-ID')}
                                                </span>
                                            </div>
                                            <button 
                                                onClick={() => copyLogData(log.uuid, log.content)}
                                                className={`text-[10px] px-2 py-1 rounded transition flex-shrink-0 ${copiedLogId === log.uuid ? 'bg-emerald-600/20 text-emerald-400' : 'bg-surface-700 hover:bg-surface-600 text-surface-300'}`}
                                            >
                                                {copiedLogId === log.uuid ? '✅ Disalin' : '📋 Copy Data'}
                                            </button>
                                        </div>
                                        <pre className="text-[10px] text-surface-400 overflow-x-auto whitespace-pre-wrap word-break bg-surface-800 p-2 rounded max-h-40 overflow-y-auto">
                                            {typeof log.content === 'object' ? JSON.stringify(log.content, null, 2) : log.content || '(Payload Kosong)'}
                                        </pre>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
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
