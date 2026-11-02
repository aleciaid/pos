import { useToastStore } from '../store/toast';

export default function ToastContainer() {
    const toasts = useToastStore(s => s.toasts);
    const removeToast = useToastStore(s => s.removeToast);
    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
            {toasts.map(t => (
                <div
                    key={t.id}
                    onClick={() => removeToast(t.id)}
                    className={`px-4 py-3 rounded-xl shadow-2xl text-sm font-medium cursor-pointer transition-all animate-slide-in backdrop-blur-lg border
            ${t.type === 'success' ? 'bg-emerald-500/90 border-emerald-400/30 text-white' : ''}
            ${t.type === 'error' ? 'bg-red-500/90 border-red-400/30 text-white' : ''}
            ${t.type === 'info' ? 'bg-blue-500/90 border-blue-400/30 text-white' : ''}
          `}
                >
                    {t.message}
                </div>
            ))}
        </div>
    );
}
