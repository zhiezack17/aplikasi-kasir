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

## Implementation Status (Implemented ✅)

### v1 (2026-01) — MVP
- ✅ JWT auth, admin/kasir seed, idempotent
- ✅ Categories CRUD (admin write) + Products CRUD (admin write)
- ✅ Transactions with 10% tax, stock decrement
- ✅ Daily Report with KPI, 7-day trend, top products
- ✅ Login + POS (search, categories, cart) + Payment dialog (Cash/Transfer/QRIS) + Receipt
- ✅ Products/Categories/History/Reports admin pages
- ✅ Mobile responsive (FAB cart sheet)
- ✅ Role-based sidebar
- ✅ Backend 17/17 tests pass + frontend e2e pass

### v2 (2026-01) — Customer & Debt Management
- ✅ **Removed all demo seed data** (sample categories + products) — starts empty
- ✅ **Customer collection** with name + phone + address + notes + debt (running balance)
- ✅ Customer CRUD endpoints (admin write, all authenticated read) + delete blocked if debt > 0
- ✅ **"Hutang" payment method** added — requires `customer_id`, increments customer.debt
- ✅ **Pay Debt endpoint** `/api/customers/:id/pay-debt` — partial/full, tracked in `debt_payments` collection
- ✅ Customer transaction & payment history endpoint
- ✅ Reports `outstanding_debt` + `customers_with_debt` KPIs
- ✅ Frontend **Pelanggan page** with debt card, Bayar Hutang dialog (Bayar Lunas/Setengah quick buttons), customer history
- ✅ POS payment dialog now 4 methods (Tunai/Transfer/QRIS/Hutang) with customer picker + quick-add
- ✅ History page shows HUTANG badge + customer name
- ✅ Backend 20/20 new tests pass + frontend e2e pass

### v3 (2026-01) — WhatsApp Integration (Fonnte)
- ✅ **Fonnte WhatsApp API** integrated (`whatsapp.py` module with normalize_phone + send_whatsapp helper)
- ✅ **Auto-notifications** on debt transaction created (background task)
- ✅ **Auto-notifications** on debt payment received (background task)
- ✅ **Manual "Kirim Reminder WhatsApp" button** on customer cards (immediate send, sync)
- ✅ **Settings page** (admin only) — store Fonnte token + shop name in MongoDB (no redeploy needed)
- ✅ Test WhatsApp button to verify integration
- ✅ Resilient: missing token / Fonnte errors don't break business transactions (always 400 not 502 for Cloudflare passthrough)
- ✅ Indonesian phone normalization (0812... → 62812...)
- ✅ Default professional Bahasa Indonesia message templates
- ✅ Backend 15/15 new tests pass + frontend e2e pass

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
