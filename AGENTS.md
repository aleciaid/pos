# AGENTS.md

POS System — React 18 + TypeScript + Vite + TailwindCSS, **100% client-side, tanpa backend**. Semua data di IndexedDB (via `idb`).

## Commands

```bash
npm install        # install deps (wajib sebelum apapun)
npm run dev        # dev server, http://localhost:5173
npm run build      # production build → dist/
npm run typecheck  # tsc --noEmit  ← jalankan ini setelah ubah kode
npm run preview    # preview hasil build
```

Tak ada test framework. Setelah mengubah kode, **wajib** jalankan `npm run typecheck`; sebelum menyerahkan hasil, jalankan `npm run build`.

## Routing (`src/App.tsx`)

| Path | Halaman | Guard |
|------|---------|-------|
| `/` | LoginPage | — |
| `/cashier` | CashierPage | butuh `role` |
| `/admin` | AdminPage | butuh `role === 'admin'` |
| `/qris-share` | QrisSharePage | — (dibuka pembeli via link) |

Role disimpan di localStorage (`pos-role`) via store. Tak ada auth server; admin pakai PIN dari settings.

## Arsitektur & Konvensi

- **State global**: Zustand di `src/store/index.ts` (satu store `useStore`). Toast di `src/store/toast.ts`. Akses state fresh di luar React pakai `useStore.getState()` (dipakai di callback async/polling CashierPage).
- **Persistence**: semua lewat `src/db/index.ts` (`productsDB`, `ordersDB`, `settingsDB`, dst — wrapper typed atas idb). Store action async menulis DB lalu refresh state. `settings` adalah singleton dengan key `'main'`.
- **Types**: semua interface di `src/types/index.ts`. Tambah field baru di sini dulu.
- **Format util**: `src/utils/format.ts` (`formatRupiah`, `formatDateTime`, `generateId`, `todayStr`, `generateSku`). `src/utils/qris.ts` untuk payload QRIS (EMVCo dynamic QR).
- **Components**: `src/components/` — `Modal`, `EmptyState`, `ToastContainer`, `Skeleton`.
- **Admin tabs**: `src/pages/admin/*Tab.tsx`, dirender oleh `AdminPage.tsx`.

### Multi Checkout (CashierPage)

Kasir mendukung beberapa order terbuka sekaligus lewat `tickets: Ticket[]` + `activeTicketId` di store.

- `Ticket` (`src/types/index.ts`) = satu keranjang + state pembayaran pending-nya. Action cart lama (`addToCart`, `setCartDiscount`, dst) memodifikasi **active ticket**.
- `activeCart()`, atau di komponen: `tickets.find(t => t.id === activeTicketId)` untuk dapat ticket aktif.
- Status ticket: `'open'` | `'awaiting_qris'`. Ticket `awaiting_qris` punya `qris` (configId, code, total, orderNo pre-reserved, startedAt, duration) dan **terkunci** (item/diskon/pajak/note read-only sampai lunas/expired).
- Polling webhook QRIS berjalan untuk **semua** ticket `awaiting_qris` di background (interval 1s di CashierPage), auto-selesai + potong stok walau bukan tab aktif. `checkoutTicket(ticketId)` idempoten — aman dipanggil dari polling.
- Nomor order pre-reserved saat QRIS dimulai (`startQrisForTicket`), dipakai lagi saat finalisasi agar nomor stabil walau ada order lain di antaranya.
- **Tickets in-memory saja** — hilang saat reload. Order yang sudah dibayar tersimpan di IndexedDB.

## Integrasi Webhook / QRIS

- Proxy dev di `vite.config.ts`; redirect produksi di `netlify.toml`. Keduanya meneruskan `/api/webhook/*` → `webhook.site` dan `/api/notify-webhook` → Netlify function (`netlify/functions/notify-webhook.js`).
- Notifikasi pembayaran QRIS diambil dengan polling `webhook.site` (`checkQrisWebhook`), cocokkan nominal + waktu. Tak ada websocket.
- Logika cocokkan nominal diduplikasi di `CashierPage.tsx` dan `QrisSharePage.tsx` — ubah keduanya jika menyentuh logika ini.

## Deploy

Netlify (`netlify.toml`): `npm install && npm run build`, publish `dist`, functions di `netlify/functions`. Node 20.

## Aturan untuk Agen

- **Jangan commit/push kecuali diminta eksplisit.**
- Ikuti pola yang sudah ada (Zustand action → db wrapper → refresh state). Jangan tambah library baru kalau stdlib/pola existing cukup.
- Perubahan yang menyentuh state cart/checkout: periksa bahwa jalur multi-ticket tetap konsisten (jangan asumsikan satu cart global).
- Git remote: `origin` = `https://github.com/aleciaid/pos`, branch `main`.
