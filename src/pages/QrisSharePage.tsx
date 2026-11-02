import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { generateDynamicQris } from '../utils/qris';
import { formatRupiah } from '../utils/format';

export default function QrisSharePage() {
    const [searchParams] = useSearchParams();
    const [payload, setPayload] = useState<any>(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [expired, setExpired] = useState(false);
    const [error, setError] = useState('');
    const [checking, setChecking] = useState(false);
    const [paid, setPaid] = useState(false);

    useEffect(() => {
        try {
            const dataParam = searchParams.get('data');
            if (!dataParam) throw new Error('Data tidak ditemukan');
            const decoded = JSON.parse(decodeURIComponent(atob(dataParam)));
            setPayload(decoded);
            
            // Calculate initial time
            const diff = Math.floor((Date.now() - decoded.ts) / 1000);
            const remaining = decoded.d - diff;
            if (remaining <= 0) {
                setExpired(true);
            } else {
                setTimeLeft(remaining);
            }
        } catch (e) {
            setError('Link tidak valid atau rusak');
        }
    }, [searchParams]);

    const checkPayment = async () => {
        if (!payload) return;
        if (!payload.w) {
            alert('Kasir belum mengkonfigurasi integrasi otomatis. Harap tunjukkan bukti transfer ke kasir.');
            return;
        }
        setChecking(true);
        try {
            const res = await fetch(
                `/api/webhook/token/${payload.w}/requests?sorting=newest&limit=20&_t=${Date.now()}`,
                { 
                    signal: AbortSignal.timeout(5000),
                    cache: 'no-store',
                    headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
                }
            );
            if (!res.ok) return;
            const data = await res.json();
            const requests: any[] = data.data || [];
            
            const expectedAmount = payload.t;
            const hasUniqueCode = payload.c > 0;
            const startTime = payload.ts;

            for (const req of requests) {
                let parsed: any;
                try {
                    parsed = typeof req.content === 'string' ? JSON.parse(req.content) : req.content;
                } catch { continue; }

                const payloadTs = parsed?.timestamp ?? parsed?.body?.timestamp ?? parsed?.[0]?.timestamp;
                const reqCreatedAtStr = (req.created_at || '').replace(' ', 'T') + 'Z';
                const receivedAt = (typeof payloadTs === 'number' && payloadTs > 1000000000)
                    ? (payloadTs < 10000000000 ? payloadTs * 1000 : payloadTs)
                    : new Date(reqCreatedAtStr).getTime();

                if (isNaN(receivedAt)) continue;

                const timeDiff = Date.now() - receivedAt;
                const isRecent = timeDiff <= (hasUniqueCode ? 90_000 : 65_000);
                const isAfterPopup = receivedAt >= (startTime - 15_000); 
                
                if (!isRecent || (!hasUniqueCode && !isAfterPopup)) continue;

                let isAmountMatch = false;
                const inner = parsed?.body ?? (Array.isArray(parsed) ? parsed[0] : parsed);
                const text: string = inner?.text ?? inner?.message ?? '';
                if (text) {
                    const match = text.match(/Rp\.?\s*([\d.,]+)/i);
                    if (match) {
                        const raw = match[1].replace(/(?:\.|,)00$/, '').replace(/[.,]/g, '');
                        if (parseInt(raw, 10) === expectedAmount) isAmountMatch = true;
                    }
                }

                if (!isAmountMatch) {
                    const checkAmountMatches = (obj: any): boolean => {
                        if (typeof obj === 'number') return obj === expectedAmount;
                        if (typeof obj === 'string') {
                            const cleanStr = obj.replace(/(?:\.|,)00$/, '').replace(/[^\d]/g, '');
                            if (cleanStr && parseInt(cleanStr, 10) === expectedAmount) return true;
                        }
                        if (Array.isArray(obj)) return obj.some(checkAmountMatches);
                        if (typeof obj === 'object' && obj !== null) return Object.values(obj).some(val => checkAmountMatches(val));
                        return false;
                    };
                    if (checkAmountMatches(parsed)) isAmountMatch = true;
                }

                if (!isAmountMatch && (parsed?.received === true || (Array.isArray(parsed) && parsed.some(p => p?.received === true)))) {
                    isAmountMatch = true;
                }

                if (isAmountMatch) {
                    setPaid(true);
                    return;
                }
            }
            alert('Pembayaran belum diterima. Pastikan nominal transfer persis sesuai tagihan.');
        } catch (e) {
            console.error(e);
            alert('Gagal mengecek pembayaran. Coba lagi.');
        } finally {
            setChecking(false);
        }
    };

    useEffect(() => {
        if (!payload || expired || paid) return;
        
        const tick = setInterval(() => {
            const diff = Math.floor((Date.now() - payload.ts) / 1000);
            const remaining = payload.d - diff;
            if (remaining <= 0) {
                setExpired(true);
                setTimeLeft(0);
                clearInterval(tick);
            } else {
                setTimeLeft(remaining);
            }
        }, 1000);
        return () => clearInterval(tick);
    }, [payload, expired]);

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="bg-surface-800 p-6 rounded-2xl text-center max-w-sm w-full border border-surface-700">
                    <p className="text-red-400 font-medium">{error}</p>
                </div>
            </div>
        );
    }

    if (!payload) return null;

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-surface-950">
            <div className="bg-surface-900 border border-surface-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-6">
                <div className="text-center">
                    <h1 className="font-bold text-lg text-surface-200">{payload.s}</h1>
                    <p className="text-sm text-surface-400">Pembayaran QRIS</p>
                </div>

                {paid ? (
                    <div className="text-center py-6 space-y-4">
                        <div className="w-20 h-20 bg-emerald-500/20 border-2 border-emerald-400 rounded-full flex items-center justify-center mx-auto">
                            <span className="text-4xl">✅</span>
                        </div>
                        <p className="text-xl font-bold text-emerald-400">Pembayaran Dikonfirmasi!</p>
                        <p className="text-sm text-surface-400">Terima kasih atas pembayaran Anda. Transaksi sudah tercatat oleh kasir.</p>
                    </div>
                ) : expired ? (
                    <div className="text-center py-6 space-y-4">
                        <div className="w-20 h-20 bg-red-500/20 border-2 border-red-400 rounded-full flex items-center justify-center mx-auto">
                            <span className="text-4xl">⏰</span>
                        </div>
                        <p className="text-xl font-bold text-red-400">QRIS Expired</p>
                        <p className="text-sm text-surface-400">Waktu pembayaran telah habis. Silakan hubungi kasir.</p>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-4 bg-gradient-to-b from-surface-700 to-surface-800 rounded-2xl p-4 border border-surface-600">
                            <div className="relative flex-shrink-0">
                                <svg width="72" height="72" className="-rotate-90">
                                    <circle cx="36" cy="36" r="30" fill="none" stroke="#334155" strokeWidth="6" />
                                    <circle
                                        cx="36" cy="36" r="30" fill="none"
                                        stroke={timeLeft <= 10 ? '#ef4444' : timeLeft <= 20 ? '#f59e0b' : '#10b981'}
                                        strokeWidth="6"
                                        strokeLinecap="round"
                                        strokeDasharray={`${2 * Math.PI * 30}`}
                                        strokeDashoffset={`${2 * Math.PI * 30 * (1 - Math.max(0, timeLeft) / payload.d)}`}
                                        style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
                                    />
                                </svg>
                                <span className={`absolute inset-0 flex items-center justify-center text-lg font-black ${timeLeft <= 10 ? 'text-red-400' : timeLeft <= 20 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                    {timeLeft}s
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-surface-400 uppercase tracking-widest font-semibold">Total Tagihan</p>
                                <p className="text-3xl font-black text-white tracking-tight">{formatRupiah(payload.t)}</p>
                                {payload.c > 0 && (
                                    <div className="mt-1 inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-0.5">
                                        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                                        <span className="text-xs text-amber-400 font-medium">
                                            Termasuk kode +{payload.c}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {payload.i && payload.i.length > 0 && (
                            <div className="bg-surface-800/50 rounded-xl p-3 max-h-40 overflow-y-auto border border-surface-700/50 custom-scrollbar">
                                {payload.i.map((item: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center text-sm py-1.5 border-b border-surface-700/50 last:border-0">
                                        <div className="flex-1 min-w-0 pr-2">
                                            <p className="text-surface-200 truncate font-medium">{item.n}</p>
                                            <p className="text-xs text-surface-400">{item.q} x {formatRupiah(item.p)}</p>
                                        </div>
                                        <p className="text-white font-semibold">{formatRupiah(item.q * item.p)}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {payload.q ? (
                            <div className="bg-white rounded-2xl p-6 flex flex-col items-center justify-center shadow-lg">
                                <QRCodeSVG value={generateDynamicQris(payload.q, payload.t)} size={240} level="M" />
                                <p className="text-xs text-surface-400 mt-3 font-semibold tracking-wider">SCAN UNTUK BAYAR</p>
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <p className="text-amber-400 font-medium">QRIS tidak tersedia.</p>
                                <p className="text-sm text-surface-400 mt-2">Kasir tidak mengunggah data QRIS yang valid.</p>
                            </div>
                        )}
                        
                        <div className="bg-surface-800 rounded-xl p-3 border border-surface-700 text-center">
                            <p className="text-xs text-surface-400 leading-relaxed">
                                Harap bayar sesuai nominal hingga digit terakhir agar pembayaran otomatis terverifikasi.
                            </p>
                        </div>
                        
                        <button
                            onClick={checkPayment}
                            disabled={checking}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 font-bold text-white transition text-sm shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                        >
                            {checking ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Mengecek...
                                </>
                            ) : (
                                '🔄 Cek Pembayaran'
                            )}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
