import { create } from 'zustand';
import type { Product, Service, PaymentMethod, Order, Settings, CartItem, Role, StockMovement, Ticket } from '../types';
import { productsDB, servicesDB, paymentMethodsDB, ordersDB, settingsDB, stockMovementsDB, defaultSettings } from '../db';
import { seedProducts, seedServices, seedPaymentMethods } from '../db/seed';
import { generateId } from '../utils/format';

interface AppState {
    /* auth */
    role: Role;
    setRole: (r: Role) => void;

    /* data */
    products: Product[];
    services: Service[];
    paymentMethods: PaymentMethod[];
    orders: Order[];
    stockMovements: StockMovement[];
    settings: Settings;
    loading: boolean;

    /* tickets (multi checkout) */
    tickets: Ticket[];
    activeTicketId: string;

    /* actions - data */
    loadAll: () => Promise<void>;
    saveProduct: (p: Product) => Promise<void>;
    deleteProduct: (id: string) => Promise<void>;
    saveService: (s: Service) => Promise<void>;
    deleteService: (id: string) => Promise<void>;
    savePaymentMethod: (pm: PaymentMethod) => Promise<void>;
    deletePaymentMethod: (id: string) => Promise<void>;
    saveOrder: (o: Order) => Promise<void>;
    saveSettings: (s: Settings) => Promise<void>;
    addStockMovement: (sm: StockMovement, newStock: number) => Promise<void>;
    voidOrder: (id: string) => Promise<void>;

    /* actions - cart (operate on active ticket) */
    addToCart: (item: CartItem) => void;
    removeFromCart: (id: string) => void;
    updateCartQty: (id: string, qty: number) => void;
    updateCartItemDiscount: (id: string, type: 'amount' | 'percent', value: number) => void;
    setCartDiscount: (val: number) => void;
    setCartDiscountType: (t: 'amount' | 'percent') => void;
    setCartNote: (n: string) => void;
    setTaxEnabled: (v: boolean) => void;
    clearCart: () => void;

    /* actions - tickets */
    newTicket: () => string;
    selectTicket: (id: string) => void;
    closeTicket: (id: string) => void;
    setTicketStatus: (id: string, status: Ticket['status'], qris?: Ticket['qris'] | null) => void;
    updateTicketQris: (id: string, qris: Ticket['qris']) => void;
    /* cart state of the active ticket (compat selectors) */
    activeCart: () => Ticket;
}

export const useStore = create<AppState>((set, get) => ({
    role: (localStorage.getItem('pos-role') as Role) || null,
    setRole: (r) => {
        if (r) localStorage.setItem('pos-role', r); else localStorage.removeItem('pos-role');
        set({ role: r });
    },

    products: [],
    services: [],
    paymentMethods: [],
    orders: [],
    stockMovements: [],
    settings: defaultSettings(),
    loading: true,

    tickets: [],
    activeTicketId: '',

    loadAll: async () => {
        set({ loading: true });
        let products = await productsDB.getAll();
        let services = await servicesDB.getAll();
        let paymentMethods = await paymentMethodsDB.getAll();

        // seed on first run
        if (products.length === 0 && services.length === 0 && paymentMethods.length === 0) {
            await productsDB.bulkPut(seedProducts);
            await servicesDB.bulkPut(seedServices);
            await paymentMethodsDB.bulkPut(seedPaymentMethods);
            await settingsDB.put(defaultSettings());
            products = seedProducts;
            services = seedServices;
            paymentMethods = seedPaymentMethods;
        }

        const orders = await ordersDB.getAll();
        const stockMovements = await stockMovementsDB.getAll();
        const settings = await settingsDB.get();

        set({
            products,
            services,
            paymentMethods,
            orders,
            stockMovements,
            settings,
            loading: false,
        });
    },

    saveProduct: async (p) => {
        await productsDB.put(p);
        const products = await productsDB.getAll();
        set({ products });
    },
    deleteProduct: async (id) => {
        await productsDB.delete(id);
        const products = await productsDB.getAll();
        set({ products });
    },
    saveService: async (s) => {
        await servicesDB.put(s);
        const services = await servicesDB.getAll();
        set({ services });
    },
    deleteService: async (id) => {
        await servicesDB.delete(id);
        const services = await servicesDB.getAll();
        set({ services });
    },
    savePaymentMethod: async (pm) => {
        await paymentMethodsDB.put(pm);
        const paymentMethods = await paymentMethodsDB.getAll();
        set({ paymentMethods });
    },
    deletePaymentMethod: async (id) => {
        await paymentMethodsDB.delete(id);
        const paymentMethods = await paymentMethodsDB.getAll();
        set({ paymentMethods });
    },
    saveOrder: async (o) => {
        await ordersDB.put(o);
        // also refresh products for stock changes
        const orders = await ordersDB.getAll();
        const products = await productsDB.getAll();
        set({ orders, products });
    },
    saveSettings: async (s) => {
        await settingsDB.put(s);
        set({ settings: s });
    },
    addStockMovement: async (sm, newStock) => {
        await stockMovementsDB.put(sm);
        const product = await productsDB.get(sm.productId);
        if (product) {
            product.stock = newStock;
            product.updatedAt = new Date().toISOString();
            await productsDB.put(product);
        }
        const products = await productsDB.getAll();
        const stockMovements = await stockMovementsDB.getAll();
        set({ products, stockMovements });
    },
    voidOrder: async (id) => {
        const order = get().orders.find(o => o.id === id);
        if (!order) return;
        const updated: Order = { ...order, status: 'void' };
        // restore stock for product items
        for (const item of order.items) {
            if (item.kind === 'product') {
                const product = await productsDB.get(item.refId);
                if (product) {
                    product.stock += item.qty;
                    product.updatedAt = new Date().toISOString();
                    await productsDB.put(product);
                }
            }
        }
        await ordersDB.put(updated);
        const orders = await ordersDB.getAll();
        const products = await productsDB.getAll();
        set({ orders, products });
    },

    addToCart: (item) => {
        const { tickets, activeTicketId } = get();
        const ticket = tickets.find(t => t.id === activeTicketId);
        if (!ticket) return;
        const cart = [...ticket.cart];
        const existing = cart.find(c => c.refId === item.refId && c.kind === item.kind);
        if (existing) {
            existing.qty += item.qty;
        } else {
            cart.push(item);
        }
        set({ tickets: tickets.map(t => t.id === ticket.id ? { ...t, cart } : t) });
    },
    removeFromCart: (id) => {
        const { tickets } = get();
        set({ tickets: tickets.map(t => t.id === t.id ? { ...t, cart: t.cart.filter(c => c.id !== id) } : t) });
    },
    updateCartQty: (id, qty) => {
        const { tickets } = get();
        set({ tickets: tickets.map(t => ({ ...t, cart: t.cart.map(c => c.id === id ? { ...c, qty: Math.max(1, qty) } : c) })) });
    },
    updateCartItemDiscount: (id, type, value) => {
        const { tickets } = get();
        set({ tickets: tickets.map(t => ({ ...t, cart: t.cart.map(c => c.id === id ? { ...c, discountType: type, discountValue: value } : c) })) });
    },
    setCartDiscount: (val) => patchActive(set, get, t => ({ ...t, cartDiscount: val })),
    setCartDiscountType: (t2) => patchActive(set, get, t => ({ ...t, cartDiscountType: t2 })),
    setCartNote: (n) => patchActive(set, get, t => ({ ...t, cartNote: n })),
    setTaxEnabled: (v) => patchActive(set, get, t => ({ ...t, taxEnabled: v })),
    clearCart: () => patchActive(set, get, t => ({ ...t, cart: [], cartDiscount: 0, cartDiscountType: 'amount', cartNote: '' })),

    newTicket: () => {
        const { tickets } = get();
        const id = generateId();
        const nums = tickets.map(t => parseInt((t.label.match(/\d+$/) || ['0'])[0], 10));
        const nextNum = (nums.length ? Math.max(...nums) : 0) + 1;
        const ticket: Ticket = {
            id,
            label: `Order ${nextNum}`,
            cart: [],
            cartDiscount: 0,
            cartDiscountType: 'amount',
            cartNote: '',
            taxEnabled: get().settings.taxEnabledDefault,
            status: 'open',
            createdAt: new Date().toISOString(),
        };
        set({ tickets: [...tickets, ticket], activeTicketId: id });
        return id;
    },
    selectTicket: (id) => set({ activeTicketId: id }),
    closeTicket: (id) => {
        const { tickets, activeTicketId } = get();
        const next = tickets.filter(t => t.id !== id);
        set({
            tickets: next,
            activeTicketId: activeTicketId === id ? (next[0]?.id || '') : activeTicketId,
        });
    },
    setTicketStatus: (id, status, qris) => {
        set({ tickets: get().tickets.map(t => t.id === id ? { ...t, status, qris: qris === null ? undefined : (qris !== undefined ? qris : t.qris) } : t) });
    },
    updateTicketQris: (id, qris) => {
        set({ tickets: get().tickets.map(t => t.id === id ? { ...t, qris } : t) });
    },
    activeCart: () => {
        const { tickets, activeTicketId } = get();
        return tickets.find(t => t.id === activeTicketId) || tickets[0];
    },
}));

function patchActive(
    set: (partial: Partial<AppState>) => void,
    get: () => AppState,
    patch: (t: Ticket) => Ticket,
) {
    const { tickets, activeTicketId } = get();
    set({ tickets: tickets.map(t => t.id === activeTicketId ? patch(t) : t) });
}
