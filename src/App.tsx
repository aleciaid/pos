import { useEffect, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useStore } from './store';
import ToastContainer from './components/ToastContainer';
import LoginPage from './pages/LoginPage';
import CashierPage from './pages/CashierPage';
import AdminPage from './pages/AdminPage';

function AppLayout() {
    const role = useStore(s => s.role);
    const setRole = useStore(s => s.setRole);
    const loading = useStore(s => s.loading);
    const loadAll = useStore(s => s.loadAll);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    const logout = () => {
        setRole(null);
        navigate('/');
    };

    const [isFullscreen, setIsFullscreen] = useState(false);
    const toggleFullscreen = useCallback(async () => {
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
                try { await (screen.orientation as any).lock('landscape'); } catch { /* not supported on desktop */ }
            } else {
                await document.exitFullscreen();
                try { (screen.orientation as any).unlock(); } catch { /* ignore */ }
            }
        } catch (err) { console.warn('Fullscreen:', err); }
    }, []);
    useEffect(() => {
        const h = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', h);
        return () => document.removeEventListener('fullscreenchange', h);
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface-950">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-surface-400">Memuat data...</p>
                </div>
            </div>
        );
    }

    const showNav = role && location.pathname !== '/';

    return (
        <div className="min-h-screen bg-surface-950 text-white">
            {showNav && (
                <nav className="h-14 bg-surface-900/80 backdrop-blur-md border-b border-surface-800 flex items-center justify-between px-2 sm:px-4 sticky top-0 z-20">
                    <div className="flex items-center gap-1 sm:gap-3">
                        <span className="text-base sm:text-lg font-bold bg-gradient-to-r from-primary-400 to-primary-300 bg-clip-text text-transparent mr-1 sm:mr-0">POS</span>
                        {role === 'admin' && (
                            <button onClick={() => navigate('/cashier')} className={`px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition ${location.pathname === '/cashier' ? 'bg-primary-600 text-white' : 'text-surface-400 hover:text-white'}`}>
                                Kasir
                            </button>
                        )}
                        {role === 'admin' && (
                            <button onClick={() => navigate('/admin')} className={`px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition ${location.pathname === '/admin' ? 'bg-primary-600 text-white' : 'text-surface-400 hover:text-white'}`}>
                                Admin
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="hidden md:inline-block text-xs text-surface-400 bg-surface-800 px-3 py-1 rounded-full">
                            {role === 'admin' ? '⚙️ Admin' : '🧑‍💼 Kasir'}
                        </span>
                        <button
                            onClick={toggleFullscreen}
                            title={isFullscreen ? 'Keluar Fullscreen (F11)' : 'Fullscreen Landscape (F11)'}
                            className="px-2 sm:px-3 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-700 text-[11px] sm:text-xs font-medium transition text-surface-300 hover:text-white"
                        >
                            {isFullscreen ? <span className="sm:hidden">⊡</span> : <span className="sm:hidden">⛶</span>}
                            <span className="hidden sm:inline">{isFullscreen ? '⊡ Exit' : '⛶ Fullscreen'}</span>
                        </button>
                        <button onClick={logout} className="px-2 sm:px-3 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-700 text-[11px] sm:text-xs font-medium transition text-surface-300 hover:text-white">
                            <span className="sm:hidden">🚪</span>
                            <span className="hidden sm:inline">Logout</span>
                        </button>
                    </div>
                </nav>
            )}

            <Routes>
                <Route path="/" element={<LoginPage />} />
                <Route path="/cashier" element={role ? <CashierPage /> : <Navigate to="/" />} />
                <Route path="/admin" element={role === 'admin' ? <AdminPage /> : <Navigate to="/" />} />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>

            <ToastContainer />
        </div>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <AppLayout />
        </BrowserRouter>
    );
}
