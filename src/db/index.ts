import { openDB, type IDBPDatabase } from 'idb';
import type { Product, Service, PaymentMethod, Order, StockMovement, Settings } from '../types';

const DB_NAME = 'pos-db';
const DB_VERSION = 1;

export type StoreName = 'products' | 'services' | 'paymentMethods' | 'orders' | 'stockMovements' | 'settings';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains('products')) db.createObjectStore('products', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('services')) db.createObjectStore('services', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('paymentMethods')) db.createObjectStore('paymentMethods', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('orders')) db.createObjectStore('orders', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('stockMovements')) db.createObjectStore('stockMovements', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'id' });
            },
        });
    }
    return dbPromise;
}

/* ── Generic helpers ────────────────────────────────────── */

export async function dbGetAll<T>(store: StoreName): Promise<T[]> {
    const db = await getDB();
    return db.getAll(store) as Promise<T[]>;
}

export async function dbGet<T>(store: StoreName, key: string): Promise<T | undefined> {
    const db = await getDB();
    return db.get(store, key) as Promise<T | undefined>;
}

export async function dbPut<T>(store: StoreName, value: T): Promise<void> {
    const db = await getDB();
    await db.put(store, value as any);
}

export async function dbBulkPut<T>(store: StoreName, values: T[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(store, 'readwrite');
    for (const v of values) {
        tx.store.put(v as any);
    }
    await tx.done;
}

export async function dbDelete(store: StoreName, key: string): Promise<void> {
    const db = await getDB();
    await db.delete(store, key);
}

export async function dbClear(store: StoreName): Promise<void> {
    const db = await getDB();
    await db.clear(store);
}

/* ── Typed wrappers ─────────────────────────────────────── */

export const productsDB = {
    getAll: () => dbGetAll<Product>('products'),
    get: (id: string) => dbGet<Product>('products', id),
    put: (p: Product) => dbPut('products', p),
    bulkPut: (ps: Product[]) => dbBulkPut('products', ps),
    delete: (id: string) => dbDelete('products', id),
};

export const servicesDB = {
    getAll: () => dbGetAll<Service>('services'),
    get: (id: string) => dbGet<Service>('services', id),
    put: (s: Service) => dbPut('services', s),
    bulkPut: (ss: Service[]) => dbBulkPut('services', ss),
    delete: (id: string) => dbDelete('services', id),
};

export const paymentMethodsDB = {
    getAll: () => dbGetAll<PaymentMethod>('paymentMethods'),
    get: (id: string) => dbGet<PaymentMethod>('paymentMethods', id),
    put: (pm: PaymentMethod) => dbPut('paymentMethods', pm),
    bulkPut: (pms: PaymentMethod[]) => dbBulkPut('paymentMethods', pms),
    delete: (id: string) => dbDelete('paymentMethods', id),
};

export const ordersDB = {
    getAll: () => dbGetAll<Order>('orders'),
    get: (id: string) => dbGet<Order>('orders', id),
    put: (o: Order) => dbPut('orders', o),
    delete: (id: string) => dbDelete('orders', id),
};

export const stockMovementsDB = {
    getAll: () => dbGetAll<StockMovement>('stockMovements'),
    put: (sm: StockMovement) => dbPut('stockMovements', sm),
    bulkPut: (sms: StockMovement[]) => dbBulkPut('stockMovements', sms),
};

// Settings is a singleton with id = 'main'
export const settingsDB = {
    get: async (): Promise<Settings> => {
        const s = await dbGet<Settings & { id: string }>('settings', 'main');
        if (s) {
            const { ...rest } = s as any;
            return rest as Settings;
        }
        return defaultSettings();
    },
    put: async (s: Settings): Promise<void> => {
        await dbPut('settings', { id: 'main', ...s });
    },
};

export function defaultSettings(): Settings {
    return {
        adminPin: '1234',
        taxEnabledDefault: false,
        taxPercent: 11,
        lowStockThreshold: 5,
        lastOrderSeqByDate: {},
        storeName: 'POS System',
        storeAddress: '',
        qrisImageData: '',
        webhookUrl: '',
        qrisWebhookToken: '',
        qrisUniqueCodeEnabled: true,
    };
}

/* ── Export / Import full backup ────────────────────────── */
export interface FullBackup {
    products: Product[];
    services: Service[];
    paymentMethods: PaymentMethod[];
    orders: Order[];
    stockMovements: StockMovement[];
    settings: Settings;
    exportedAt: string;
}

export async function exportFullBackup(): Promise<FullBackup> {
    return {
        products: await productsDB.getAll(),
        services: await servicesDB.getAll(),
        paymentMethods: await paymentMethodsDB.getAll(),
        orders: await ordersDB.getAll(),
        stockMovements: await stockMovementsDB.getAll(),
        settings: await settingsDB.get(),
        exportedAt: new Date().toISOString(),
    };
}

export async function importFullBackup(data: FullBackup, mode: 'merge' | 'replace'): Promise<void> {
    if (mode === 'replace') {
        await dbClear('products');
        await dbClear('services');
        await dbClear('paymentMethods');
        await dbClear('orders');
        await dbClear('stockMovements');
        await dbClear('settings');
    }
    if (data.products?.length) await dbBulkPut('products', data.products);
    if (data.services?.length) await dbBulkPut('services', data.services);
    if (data.paymentMethods?.length) await dbBulkPut('paymentMethods', data.paymentMethods);
    if (data.orders?.length) await dbBulkPut('orders', data.orders);
    if (data.stockMovements?.length) await dbBulkPut('stockMovements', data.stockMovements);
    if (data.settings) await settingsDB.put(data.settings);
}
