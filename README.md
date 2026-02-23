# 🛒 POS System — Point of Sale

Aplikasi Point of Sale (POS) modern, cepat, dan offline-friendly.  
Semua data tersimpan **100% lokal di browser** (IndexedDB) — **tidak ada backend**.

![Tech Stack](https://img.shields.io/badge/React-18-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Vite](https://img.shields.io/badge/Vite-6-purple) ![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-cyan)

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Jalankan dev server
npm run dev

# 3. Buka di browser
# http://localhost:5173
```

Pada first run, aplikasi otomatis membuat **seed data** berisi:
- 5 produk contoh (Kopi Hitam, Teh Manis, dll.)
- 2 jasa contoh (Biaya Pengiriman, Jasa Bungkus Kado)
- 2 metode pembayaran (Cash, QRIS)

---

## 🔐 Login

Tidak ada backend auth. Cukup pilih role:

| Role | Akses | PIN |
|------|-------|-----|
| **Kasir** | Halaman Kasir (transaksi) | Tidak perlu |
| **Admin** | Kasir + Dashboard + Kelola data | Default: `1234` |

> PIN admin bisa diganti di **Admin → Settings**.

---

## 📱 Halaman Kasir (`/cashier`)

### Alur Transaksi

1. **Cari produk** — ketik di search bar atau klik produk dari grid
2. **Atur keranjang** — tambah/kurang qty, beri diskon per item
3. **Tambah jasa** (opsional) — scroll ke bawah, klik jasa yang tersedia
4. **Diskon transaksi** (opsional) — isi di panel kanan bawah (Rp atau %)
5. **Toggle pajak** (opsional) — aktifkan jika perlu
6. **Klik "Bayar"** — pilih metode pembayaran
   - **Cash**: masukkan uang diterima → lihat kembalian
   - **Non-cash**: masukkan no. referensi (opsional)
7. **Klik "Selesaikan Transaksi"** → struk muncul
8. **Print** atau **Transaksi Baru**

### Keyboard Shortcuts

| Shortcut | Aksi |
|----------|------|
| `/` | Fokus ke search produk |
| `Enter` | Tambah produk pertama dari hasil pencarian |
| `Ctrl + Enter` | Buka dialog pembayaran |

---

## ⚙️ Halaman Admin (`/admin`)

### Tab-tab:

| Tab | Fungsi |
|-----|--------|
| **📊 Dashboard** | Omzet hari ini, jumlah transaksi, rata-rata, grafik penjualan, top produk, breakdown metode bayar |
| **📦 Produk & Stok** | CRUD produk, sesuaikan stok (restock/rusak/koreksi), import CSV, warning stok menipis |
| **🔧 Jasa** | CRUD jasa (nama, harga, kategori, aktif/nonaktif) |
| **💳 Pembayaran** | CRUD metode pembayaran (cash/non-cash) |
| **📋 Penjualan** | List transaksi + filter + detail + export |
| **💾 Backup** | Export/Import full backup JSON |
| **⚙️ Settings** | PIN admin, pajak default, threshold stok |

---

## 📤 Export Data

### 1. Export Laporan Penjualan
Buka **Admin → Penjualan**, lalu klik salah satu:

| Tombol | Format | Isi |
|--------|--------|-----|
| **Export JSON** | `.json` | Semua data transaksi (filtered) |
| **CSV Transaksi** | `.csv` | 1 baris per order: no order, tanggal, total, metode, status |
| **CSV Detail Item** | `.csv` | 1 baris per item: order, item, qty, harga, diskon, total baris |

> **Tip:** Gunakan filter tanggal/metode/keyword sebelum export untuk mendapatkan data yang spesifik.

### 2. Export Full Backup
Buka **Admin → Backup**, klik **"Download Backup JSON"**.

File backup berisi **semua data**:
- `products` — daftar produk
- `services` — daftar jasa
- `paymentMethods` — metode pembayaran
- `orders` — semua transaksi
- `stockMovements` — riwayat perubahan stok
- `settings` — pengaturan aplikasi

---

## 📥 Import Data

### 1. Import Produk dari CSV
Buka **Admin → Produk & Stok → Import CSV**.

Format CSV:
```csv
nama,harga,stok,sku,kategori,satuan
Kopi Latte,18000,50,KL-001,Minuman,cup
Croissant,25000,20,CR-001,Snack,pcs
```

Kolom wajib: `nama`, `harga`. Kolom lainnya opsional.

### 2. Import Full Backup
Buka **Admin → Backup**, pilih mode, lalu upload file `.json`:

| Mode | Perilaku |
|------|----------|
| **🔄 Merge** (default) | Data baru ditambahkan/ditimpa berdasarkan ID. Data lama yang tidak ada di backup tetap ada. **Aman.** |
| **⚠️ Replace** | Semua data lama **dihapus**, diganti dengan backup. Gunakan hati-hati! |

---

## 📁 Struktur Folder

```
src/
├── App.tsx              # Root component + router
├── main.tsx             # Entry point
├── index.css            # Global styles + Tailwind
├── types/
│   └── index.ts         # TypeScript interfaces
├── db/
│   ├── index.ts         # IndexedDB layer (idb)
│   └── seed.ts          # Seed data
├── store/
│   ├── index.ts         # Zustand store (semua state & actions)
│   └── toast.ts         # Toast notification store
├── utils/
│   └── format.ts        # Rupiah formatter, date utils, ID generator
├── components/
│   ├── Modal.tsx         # Reusable modal dialog
│   ├── ToastContainer.tsx
│   ├── EmptyState.tsx
│   └── Skeleton.tsx
└── pages/
    ├── LoginPage.tsx
    ├── CashierPage.tsx
    ├── AdminPage.tsx
    └── admin/
        ├── DashboardTab.tsx
        ├── ProductsTab.tsx
        ├── ServicesTab.tsx
        ├── PaymentMethodsTab.tsx
        ├── SalesTab.tsx
        ├── BackupTab.tsx
        └── SettingsTab.tsx
```

---

## 🛠 Tech Stack

| Tech | Purpose |
|------|---------|
| **React 18** | UI library |
| **TypeScript 5** | Type safety |
| **Vite 6** | Build tool & dev server |
| **TailwindCSS 3** | Utility-first CSS |
| **React Router 6** | Client routing |
| **Zustand** | State management |
| **idb** | IndexedDB wrapper |
| **Recharts** | Charts (dashboard) |

---

## 💡 Tips

- **Data aman** — Semua data di browser lokal. Backup rutin via Admin → Backup.
- **Mobile-friendly** — Cukup buka di browser HP, layout otomatis responsif.
- **Offline** — Setelah load pertama, app bisa dipakai tanpa internet.
- **Pindah device?** — Export backup di device lama → Import di device baru.

---

## 📄 License

MIT
