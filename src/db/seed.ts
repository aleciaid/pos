import type { Product, Service, PaymentMethod } from '../types';
import { generateId } from '../utils/format';

const now = new Date().toISOString();

export const seedProducts: Product[] = [
    { id: generateId(), name: 'Kopi Hitam', sku: 'KH-001', category: 'Minuman', price: 12000, cost: 5000, stock: 100, unit: 'cup', isActive: true, createdAt: now, updatedAt: now },
    { id: generateId(), name: 'Teh Manis', sku: 'TM-001', category: 'Minuman', price: 8000, cost: 3000, stock: 100, unit: 'cup', isActive: true, createdAt: now, updatedAt: now },
    { id: generateId(), name: 'Nasi Goreng', sku: 'NG-001', category: 'Makanan', price: 25000, cost: 12000, stock: 50, unit: 'porsi', isActive: true, createdAt: now, updatedAt: now },
    { id: generateId(), name: 'Mie Goreng', sku: 'MG-001', category: 'Makanan', price: 22000, cost: 10000, stock: 50, unit: 'porsi', isActive: true, createdAt: now, updatedAt: now },
    { id: generateId(), name: 'Roti Bakar', sku: 'RB-001', category: 'Snack', price: 15000, cost: 6000, stock: 30, unit: 'pcs', isActive: true, createdAt: now, updatedAt: now },
];

export const seedServices: Service[] = [
    { id: generateId(), name: 'Biaya Pengiriman', price: 10000, category: 'Pengiriman', isActive: true, createdAt: now, updatedAt: now },
    { id: generateId(), name: 'Jasa Bungkus Kado', price: 5000, category: 'Tambahan', isActive: true, createdAt: now, updatedAt: now },
];

export const seedPaymentMethods: PaymentMethod[] = [
    { id: generateId(), name: 'Cash', type: 'cash', isActive: true },
    { id: generateId(), name: 'QRIS', type: 'noncash', isActive: true },
];
