import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { useToastStore } from '../store/toast';

export default function LoginPage() {
    const setRole = useStore(s => s.setRole);
    const settings = useStore(s => s.settings);
    const navigate = useNavigate();
    const addToast = useToastStore(s => s.addToast);
    const [showPin, setShowPin] = useState(false);
    const [pin, setPin] = useState('');

    const loginKasir = () => {
        setRole('kasir');
        addToast('Masuk sebagai Kasir');
        navigate('/cashier');
    };

    const loginAdmin = () => setShowPin(true);

    const submitPin = () => {
        if (pin === settings.adminPin) {
            setRole('admin');
            addToast('Masuk sebagai Admin');
            navigate('/admin');
        } else {
            addToast('PIN salah!', 'error');
        }
        setPin('');
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-surface-950 via-surface-900 to-primary-950">
            <div className="w-full max-w-md">
                {/* Logo / Title */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-500/25 mb-4">
                        <span className="text-3xl">🛒</span>
                    </div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-surface-300 bg-clip-text text-transparent">POS System</h1>
                    <p className="text-surface-400 mt-2">Pilih role untuk masuk</p>
                </div>

                {/* Role Buttons */}
                {!showPin && (
                    <div className="space-y-4">
                        <button
                            id="btn-kasir"
                            onClick={loginKasir}
                            className="w-full py-5 px-6 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white font-semibold text-lg shadow-lg shadow-primary-500/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-4"
                        >
                            <span className="text-3xl">🧑‍💼</span>
                            <div className="text-left">
                                <div>Kasir</div>
                                <div className="text-sm font-normal text-primary-100 opacity-80">Akses transaksi & penjualan</div>
                            </div>
                        </button>
                        <button
                            id="btn-admin"
                            onClick={loginAdmin}
                            className="w-full py-5 px-6 rounded-2xl bg-surface-800 hover:bg-surface-700 border border-surface-700 hover:border-surface-600 text-white font-semibold text-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-4"
                        >
                            <span className="text-3xl">⚙️</span>
                            <div className="text-left">
                                <div>Admin</div>
                                <div className="text-sm font-normal text-surface-400">Kelola produk, laporan, pengaturan</div>
                            </div>
                        </button>
                    </div>
                )}

                {/* PIN Entry */}
                {showPin && (
                    <div className="bg-surface-800/80 backdrop-blur-xl border border-surface-700 rounded-2xl p-6 space-y-4">
                        <h2 className="text-lg font-semibold text-center">Masukkan PIN Admin</h2>
                        <input
                            id="input-pin"
                            type="password"
                            maxLength={8}
                            autoFocus
                            value={pin}
                            onChange={e => setPin(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && submitPin()}
                            className="w-full text-center text-2xl tracking-[0.5em] py-3 rounded-xl bg-surface-900 border border-surface-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition"
                            placeholder="••••"
                        />
                        <div className="flex gap-3">
                            <button onClick={() => { setShowPin(false); setPin(''); }} className="flex-1 py-3 rounded-xl bg-surface-700 hover:bg-surface-600 transition font-medium">Batal</button>
                            <button id="btn-submit-pin" onClick={submitPin} className="flex-1 py-3 rounded-xl bg-primary-600 hover:bg-primary-500 transition font-medium">Masuk</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
