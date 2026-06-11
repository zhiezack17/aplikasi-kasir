# Warung Kopi POS — Product Requirements Document

## Original Problem Statement
User (Bahasa Indonesia): "coba buat aplikasi kasir yang bisa di gunakan di komputer dan handphone"
→ Build a cashier/POS application usable on both desktop and mobile.

## User Choices
- **Jenis usaha**: Restoran/Cafe
- **Fitur**: Semua (manajemen produk, transaksi, riwayat, laporan, kategori)
- **Auth**: Login sederhana username/password (admin & kasir)
- **Pembayaran**: Tunai + Transfer/QRIS (tanpa payment gateway)
- **Desain**: Bebas, sesuai rekomendasi

## Tech Stack & Architecture
- **Backend**: FastAPI + Motor (async MongoDB) + JWT (PyJWT) + bcrypt
- **Frontend**: React 19 + React Router 7 + Tailwind CSS + shadcn/ui + Recharts + Lucide icons
- **Database**: MongoDB (collections: users, categories, products, transactions)
- **Auth**: JWT in httpOnly cookie + Bearer token fallback in localStorage
- **Design**: Earthy cafe palette (#D47963 primary, #F7F5F0 bg) + Manrope font + 2xl rounded cards

## User Personas
1. **Admin (admin/admin123)** — Manages menu (produk, kategori), sees all transactions, daily sales report.
2. **Kasir (kasir/kasir123)** — Operates POS, completes orders, sees own transaction history.

## Core Requirements (Static)
- Responsive UI: desktop split-screen (sidebar + product grid + cart panel); mobile (top bar + grid + FAB cart sheet).
- IDR currency formatting (`Rp 1.000.000`).
- Tax 10% (PPN) applied on subtotal.
- Order numbering: `ORDYYYYMMDD-NNNN`.
- Role-based access: admin sees Laporan/Produk/Kategori menus; kasir does not.
- Stock auto-decrements on transaction.

## Implementation Status (Implemented ✅ — 2026-01)

### Backend (`/app/backend/server.py`)
- ✅ JWT auth (`/api/auth/login`, `/auth/logout`, `/auth/me`) — bcrypt + 24h token
- ✅ Seeded users (admin + kasir, idempotent)
- ✅ Seeded 4 categories (Kopi, Non-Kopi, Pastry, Makanan) & 10 products on first run
- ✅ Categories CRUD with admin-only write + delete protection (when in use)
- ✅ Products CRUD with admin-only write
- ✅ Transactions: server-side total recompute, stock decrement, change calculation for cash
- ✅ Daily Report: revenue, orders, payment breakdown, top 5 products, 7-day trend
- ✅ Role-based filtering (cashier sees only own transactions)

### Frontend
- ✅ Login page (split-screen + demo credentials hints)
- ✅ POS page: search, category pills, product grid, cart sidebar (desktop) / FAB+sheet (mobile)
- ✅ Payment dialog: Cash (quick-amount buttons + change), Transfer (bank info), QRIS (auto QR)
- ✅ Receipt dialog post-payment
- ✅ Product management (admin) — table + image preview + dialog form
- ✅ Category management (admin)
- ✅ Transaction history with date filter + detail dialog
- ✅ Reports page with KPI cards + 7-day bar chart + top products
- ✅ Role-based sidebar; mobile drawer; logout

### Testing
- ✅ Backend pytest: 17/17 pass (`/app/backend/tests/test_pos_backend.py`)
- ✅ Frontend Playwright: all critical flows pass (login, POS, payment, role visibility, history, reports)

## Backlog / Future Enhancements
### P1
- [ ] Print/Save receipt as PDF or thermal printer support
- [ ] Stock alert notifications (when stock ≤ 5)
- [ ] Discount / promo code on transactions
- [ ] Multiple shop/branch support

### P2
- [ ] Customer database & loyalty points
- [ ] Real payment gateway integration (Midtrans/Stripe)
- [ ] Export reports to Excel/PDF
- [ ] Dark mode
- [ ] DialogDescription for a11y (minor)
- [ ] Replace native date pickers with shadcn Calendar (visual consistency)

## Next Action Items
- Awaiting user feedback for feature priorities
- Optional: enable Save to GitHub for user to deploy on own infra (mentioned in earlier conversation)
