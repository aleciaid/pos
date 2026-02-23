import { useEffect } from 'react';
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
                <nav className="h-14 bg-surface-900/80 backdrop-blur-md border-b border-surface-800 flex items-center justify-between px-4 sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <span className="text-lg font-bold bg-gradient-to-r from-primary-400 to-primary-300 bg-clip-text text-transparent">POS</span>
                        {role === 'admin' && (
                            <button onClick={() => navigate('/cashier')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${location.pathname === '/cashier' ? 'bg-primary-600 text-white' : 'text-surface-400 hover:text-white'}`}>
                                Kasir
                            </button>
                        )}
                        {role === 'admin' && (
                            <button onClick={() => navigate('/admin')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${location.pathname === '/admin' ? 'bg-primary-600 text-white' : 'text-surface-400 hover:text-white'}`}>
                                Admin
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-surface-400 bg-surface-800 px-3 py-1 rounded-full">
                            {role === 'admin' ? '⚙️ Admin' : '🧑‍💼 Kasir'}
                        </span>
                        <button onClick={logout} className="px-3 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-700 text-xs font-medium transition text-surface-300 hover:text-white">
                            Logout
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
