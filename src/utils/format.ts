const rupiah = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});

export function formatRupiah(n: number): string {
    return rupiah.format(n);
}

export function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

export function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function generateId(): string {
    return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function todayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Generate a unique SKU from a product name/category.
 * Format: <PREFIX><NNN> e.g. "MIN001", "KOP012". Ensures uniqueness
 * against `existing` SKUs (case-insensitive).
 */
export function generateSku(name: string, category: string | undefined, existing: string[]): string {
    const source = (category?.trim() || name.trim() || 'SKU');
    const prefix = source.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3).padEnd(3, 'X');
    const taken = new Set(existing.filter(Boolean).map(s => s!.toUpperCase()));
    let n = 1;
    let sku = `${prefix}${String(n).padStart(3, '0')}`;
    while (taken.has(sku)) {
        n++;
        sku = `${prefix}${String(n).padStart(3, '0')}`;
    }
    return sku;
}
