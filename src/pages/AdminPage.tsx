import { useState } from 'react';
import DashboardTab from './admin/DashboardTab';
import ProductsTab from './admin/ProductsTab';
import ServicesTab from './admin/ServicesTab';
import PaymentMethodsTab from './admin/PaymentMethodsTab';
import SalesTab from './admin/SalesTab';
import BackupTab from './admin/BackupTab';
import SettingsTab from './admin/SettingsTab';

const tabs = [
    { key: 'dashboard', label: '📊 Dashboard' },
    { key: 'products', label: '📦 Produk & Stok' },
    { key: 'services', label: '🔧 Jasa' },
    { key: 'payment', label: '💳 Pembayaran' },
    { key: 'sales', label: '📋 Penjualan' },
    { key: 'backup', label: '💾 Backup' },
    { key: 'settings', label: '⚙️ Settings' },
];

export default function AdminPage() {
    const [activeTab, setActiveTab] = useState('dashboard');

    return (
        <div className="min-h-screen bg-surface-950">
            {/* Tabs */}
            <div className="border-b border-surface-800 bg-surface-900/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex overflow-x-auto scrollbar-hide">
                    {tabs.map(t => (
                        <button
                            key={t.key}
                            onClick={() => setActiveTab(t.key)}
                            className={`whitespace-nowrap px-5 py-3 text-sm font-medium transition border-b-2 ${activeTab === t.key ? 'text-primary-400 border-primary-400' : 'text-surface-400 border-transparent hover:text-white'}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <div className="p-4 md:p-6 max-w-7xl mx-auto">
                {activeTab === 'dashboard' && <DashboardTab />}
                {activeTab === 'products' && <ProductsTab />}
                {activeTab === 'services' && <ServicesTab />}
                {activeTab === 'payment' && <PaymentMethodsTab />}
                {activeTab === 'sales' && <SalesTab />}
                {activeTab === 'backup' && <BackupTab />}
                {activeTab === 'settings' && <SettingsTab />}
            </div>
        </div>
    );
}
