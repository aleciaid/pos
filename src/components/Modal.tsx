import React from 'react';

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    wide?: boolean;
}

export default function Modal({ open, onClose, title, children, wide }: ModalProps) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                onClick={e => e.stopPropagation()}
                className={`bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl w-full overflow-auto max-h-[90vh] ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
            >
                {title && (
                    <div className="flex items-center justify-between px-6 py-4 border-b border-surface-700">
                        <h2 className="text-lg font-semibold">{title}</h2>
                        <button onClick={onClose} className="text-surface-400 hover:text-white transition text-xl leading-none">&times;</button>
                    </div>
                )}
                <div className="p-6">{children}</div>
            </div>
        </div>
    );
}
