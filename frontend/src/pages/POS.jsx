import { useEffect, useState, useMemo } from "react";
import { Plus, Minus, Trash2, Search, ShoppingCart, Loader2, CheckCircle2, X, Receipt } from "lucide-react";
import api, { formatRp, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const TAX_RATE = 0.10;

export default function POS() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCat, setActiveCat] = useState("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]); // {product_id, product_name, price, quantity, image_url}
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([api.get("/products"), api.get("/categories")]);
      setProducts(p.data.filter((x) => x.active !== false));
      setCategories(c.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (activeCat !== "all" && p.category_id !== activeCat) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [products, activeCat, search]);

  const addToCart = (product) => {
    if (product.stock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((i) =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          product_name: product.name,
          price: product.price,
          quantity: 1,
          image_url: product.image_url,
          stock: product.stock,
        },
      ];
    });
  };

  const updateQty = (productId, delta) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.product_id !== productId) return i;
          const next = i.quantity + delta;
          if (next <= 0) return null;
          if (next > i.stock) return i;
          return { ...i, quantity: next };
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((i) => i.product_id !== productId));
  };

  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.quantity, 0), [cart]);
  const tax = useMemo(() => Math.round(subtotal * TAX_RATE), [subtotal]);
  const total = subtotal + tax;

  const openPayment = () => {
    if (cart.length === 0) return;
    setPaymentMethod("cash");
    setCashReceived("");
    setPayOpen(true);
    setMobileCartOpen(false);
  };

  const submitPayment = async () => {
    setSubmitting(true);
    try {
      const items = cart.map((i) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        price: i.price,
        quantity: i.quantity,
        subtotal: i.price * i.quantity,
      }));
      const body = { items, payment_method: paymentMethod, notes: "" };
      if (paymentMethod === "cash") {
        body.cash_received = Number(cashReceived || 0);
      }
      const { data } = await api.post("/transactions", body);
      setReceipt(data);
      setCart([]);
      setPayOpen(false);
      await loadData(); // refresh stock
    } catch (e) {
      alert(formatApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden">
      {/* Products section */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-brand-border bg-brand-surface">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-brand-text" data-testid="pos-title">
                Kasir
              </h1>
              <p className="text-sm text-brand-textMuted">Pilih produk untuk ditambahkan ke pesanan</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-brand-textMuted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari produk..."
              className="w-full h-12 pl-12 pr-4 rounded-xl border border-brand-border bg-brand-surface2 text-brand-text focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition"
              data-testid="pos-search-input"
            />
          </div>

          {/* Categories pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setActiveCat("all")}
              className={`shrink-0 px-5 h-10 rounded-full text-sm font-semibold transition ${
                activeCat === "all"
                  ? "bg-brand-primary text-white shadow-button-glow"
                  : "bg-brand-surface text-brand-textMuted border border-brand-border hover:border-brand-primary"
              }`}
              data-testid="category-all"
            >
              Semua
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={`shrink-0 px-5 h-10 rounded-full text-sm font-semibold transition ${
                  activeCat === c.id
                    ? "bg-brand-primary text-white shadow-button-glow"
                    : "bg-brand-surface text-brand-textMuted border border-brand-border hover:border-brand-primary"
                }`}
                data-testid={`category-${c.id}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Products grid */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-32 md:pb-6">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-brand-textMuted">Tidak ada produk ditemukan</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  disabled={p.stock <= 0}
                  onClick={() => addToCart(p)}
                  className="group text-left bg-brand-surface rounded-2xl overflow-hidden border border-brand-border hover:border-brand-primary hover:shadow-card-subtle transition disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid={`product-${p.id}`}
                >
                  <div className="aspect-square bg-brand-surface2 overflow-hidden">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-brand-textMuted">
                        <ShoppingCart className="w-10 h-10" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="font-semibold text-brand-text text-sm line-clamp-1">{p.name}</div>
                    <div className="text-xs text-brand-textMuted mb-2">
                      Stok: <span className={p.stock <= 5 ? "text-brand-warning font-semibold" : ""}>{p.stock}</span>
                    </div>
                    <div className="font-bold text-brand-primary">{formatRp(p.price)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart sidebar - Desktop */}
      <aside className="hidden md:flex w-[400px] bg-brand-surface border-l border-brand-border flex-col">
        <CartPanel
          cart={cart}
          updateQty={updateQty}
          removeFromCart={removeFromCart}
          subtotal={subtotal}
          tax={tax}
          total={total}
          openPayment={openPayment}
          cashierName={user?.name}
        />
      </aside>

      {/* Mobile FAB */}
      {cart.length > 0 && (
        <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
          <SheetTrigger asChild>
            <button
              className="md:hidden fixed bottom-4 left-4 right-4 z-30 h-14 rounded-2xl bg-brand-primary text-white font-bold shadow-button-glow flex items-center justify-between px-5"
              data-testid="mobile-cart-fab"
            >
              <span className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                {cart.reduce((s, i) => s + i.quantity, 0)} item
              </span>
              <span>{formatRp(total)}</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[88vh] p-0 rounded-t-3xl">
            <SheetHeader className="sr-only">
              <SheetTitle>Keranjang</SheetTitle>
            </SheetHeader>
            <CartPanel
              cart={cart}
              updateQty={updateQty}
              removeFromCart={removeFromCart}
              subtotal={subtotal}
              tax={tax}
              total={total}
              openPayment={openPayment}
              cashierName={user?.name}
              isMobile
            />
          </SheetContent>
        </Sheet>
      )}

      {/* Payment Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-2xl font-bold tracking-tight text-brand-text">Pembayaran</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 pt-2">
            <div className="bg-brand-surface2 rounded-xl p-4 mb-4">
              <div className="flex justify-between text-sm text-brand-textMuted mb-1">
                <span>Subtotal</span>
                <span>{formatRp(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-brand-textMuted mb-2">
                <span>Pajak (10%)</span>
                <span>{formatRp(tax)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg text-brand-text border-t border-brand-border pt-2">
                <span>Total</span>
                <span>{formatRp(total)}</span>
              </div>
            </div>

            <div className="text-xs uppercase tracking-wider font-bold text-brand-textMuted mb-2">Metode Pembayaran</div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { id: "cash", label: "Tunai" },
                { id: "transfer", label: "Transfer" },
                { id: "qris", label: "QRIS" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id)}
                  className={`h-14 rounded-xl font-semibold border-2 transition ${
                    paymentMethod === m.id
                      ? "bg-brand-primary text-white border-brand-primary shadow-button-glow"
                      : "bg-brand-surface text-brand-text border-brand-border hover:border-brand-primary"
                  }`}
                  data-testid={`pay-${m.id}-btn`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {paymentMethod === "cash" && (
              <div className="mb-4">
                <label className="text-xs uppercase tracking-wider font-bold text-brand-textMuted block mb-2">
                  Uang Diterima
                </label>
                <input
                  type="number"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder={String(total)}
                  className="w-full h-12 px-4 rounded-xl border border-brand-border bg-brand-surface2 focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                  data-testid="cash-received-input"
                />
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {[total, 50000, 100000, 200000].map((amt, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCashReceived(String(amt))}
                      className="h-10 text-xs rounded-lg bg-brand-surface2 hover:bg-brand-border font-semibold"
                    >
                      {formatRp(amt)}
                    </button>
                  ))}
                </div>
                {Number(cashReceived) >= total && (
                  <div className="mt-2 text-sm text-brand-secondary font-semibold">
                    Kembalian: {formatRp(Number(cashReceived) - total)}
                  </div>
                )}
              </div>
            )}

            {paymentMethod === "qris" && (
              <div className="bg-brand-surface2 rounded-xl p-4 flex flex-col items-center mb-4">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=QRIS-${total}&bgcolor=FFFFFF`}
                  alt="QRIS"
                  className="w-48 h-48 rounded-lg"
                />
                <p className="text-sm text-brand-textMuted mt-3 text-center">Scan QR code untuk membayar</p>
              </div>
            )}

            {paymentMethod === "transfer" && (
              <div className="bg-brand-surface2 rounded-xl p-4 mb-4 text-sm">
                <div className="text-brand-textMuted mb-1">Bank Transfer</div>
                <div className="font-bold text-brand-text">BCA 1234-5678-9012</div>
                <div className="text-brand-text">a/n Warung Kopi</div>
                <div className="mt-2 text-xs text-brand-textMuted">Konfirmasi pembayaran sebelum menyelesaikan.</div>
              </div>
            )}
          </div>
          <DialogFooter className="px-6 pb-6">
            <button
              onClick={submitPayment}
              disabled={submitting || (paymentMethod === "cash" && Number(cashReceived) < total)}
              className="w-full h-14 rounded-xl bg-brand-primary hover:bg-brand-primaryHover text-white font-bold transition shadow-button-glow disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              data-testid="confirm-payment-btn"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? "Memproses..." : `Bayar ${formatRp(total)}`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl">
          <div className="px-6 pt-6 pb-4 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-brand-secondary/10 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-10 h-10 text-brand-secondary" />
            </div>
            <DialogTitle className="text-2xl font-bold tracking-tight text-brand-text">
              Pembayaran Berhasil
            </DialogTitle>
            <p className="text-sm text-brand-textMuted mt-1" data-testid="receipt-order-number">
              {receipt?.order_number}
            </p>
          </div>

          {receipt && (
            <div className="px-6 pb-4">
              <div className="border-t border-dashed border-brand-border pt-4 space-y-2 text-sm">
                {receipt.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="text-brand-text">
                      {it.product_name} × {it.quantity}
                    </span>
                    <span className="text-brand-text font-medium">{formatRp(it.subtotal)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed border-brand-border mt-4 pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-brand-textMuted">
                  <span>Subtotal</span>
                  <span>{formatRp(receipt.subtotal)}</span>
                </div>
                <div className="flex justify-between text-brand-textMuted">
                  <span>Pajak</span>
                  <span>{formatRp(receipt.tax)}</span>
                </div>
                <div className="flex justify-between font-bold text-brand-text text-base">
                  <span>Total</span>
                  <span>{formatRp(receipt.total)}</span>
                </div>
                <div className="flex justify-between text-brand-textMuted pt-2 border-t border-dashed border-brand-border">
                  <span>Metode</span>
                  <span className="uppercase font-semibold">{receipt.payment_method}</span>
                </div>
                {receipt.cash_received != null && (
                  <>
                    <div className="flex justify-between text-brand-textMuted">
                      <span>Tunai diterima</span>
                      <span>{formatRp(receipt.cash_received)}</span>
                    </div>
                    <div className="flex justify-between text-brand-secondary font-semibold">
                      <span>Kembalian</span>
                      <span>{formatRp(receipt.change || 0)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="px-6 pb-6">
            <button
              onClick={() => setReceipt(null)}
              className="w-full h-12 rounded-xl bg-brand-primary text-white font-semibold hover:bg-brand-primaryHover transition"
              data-testid="receipt-close-btn"
            >
              Pesanan Baru
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CartPanel({ cart, updateQty, removeFromCart, subtotal, tax, total, openPayment, cashierName, isMobile }) {
  return (
    <div className="flex flex-col h-full">
      <div className={`p-6 border-b border-brand-border ${isMobile ? "pt-8" : ""}`}>
        <div className="flex items-center gap-2 mb-1">
          <Receipt className="w-5 h-5 text-brand-primary" />
          <h2 className="text-xl font-bold tracking-tight text-brand-text">Pesanan</h2>
        </div>
        <p className="text-xs text-brand-textMuted">Kasir: {cashierName}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4" data-testid="cart-items">
        {cart.length === 0 ? (
          <div className="text-center py-12 text-brand-textMuted">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Keranjang kosong</p>
            <p className="text-xs mt-1">Pilih produk untuk memulai pesanan</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cart.map((item) => (
              <div
                key={item.product_id}
                className="bg-brand-surface2 rounded-xl p-3 flex gap-3 items-center"
                data-testid={`cart-item-${item.product_id}`}
              >
                <div className="w-14 h-14 rounded-lg bg-brand-surface overflow-hidden shrink-0">
                  {item.image_url && (
                    <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-brand-text text-sm truncate">{item.product_name}</div>
                  <div className="text-xs text-brand-textMuted">{formatRp(item.price)}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      onClick={() => updateQty(item.product_id, -1)}
                      className="w-7 h-7 rounded-lg bg-brand-surface border border-brand-border flex items-center justify-center hover:border-brand-primary"
                      data-testid={`qty-minus-${item.product_id}`}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-semibold text-brand-text min-w-[24px] text-center text-sm">{item.quantity}</span>
                    <button
                      onClick={() => updateQty(item.product_id, 1)}
                      className="w-7 h-7 rounded-lg bg-brand-surface border border-brand-border flex items-center justify-center hover:border-brand-primary"
                      data-testid={`qty-plus-${item.product_id}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-brand-text text-sm">{formatRp(item.price * item.quantity)}</div>
                  <button
                    onClick={() => removeFromCart(item.product_id)}
                    className="text-red-500 hover:text-red-700 mt-1"
                    data-testid={`remove-${item.product_id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-brand-border p-6 bg-brand-surface">
        <div className="space-y-1.5 mb-4 text-sm">
          <div className="flex justify-between text-brand-textMuted">
            <span>Subtotal</span>
            <span data-testid="cart-subtotal">{formatRp(subtotal)}</span>
          </div>
          <div className="flex justify-between text-brand-textMuted">
            <span>Pajak (10%)</span>
            <span>{formatRp(tax)}</span>
          </div>
          <div className="flex justify-between font-bold text-brand-text text-lg pt-2 border-t border-brand-border">
            <span>Total</span>
            <span data-testid="cart-total">{formatRp(total)}</span>
          </div>
        </div>
        <button
          onClick={openPayment}
          disabled={cart.length === 0}
          className="w-full h-14 rounded-xl bg-brand-primary hover:bg-brand-primaryHover text-white font-bold transition shadow-button-glow disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="checkout-btn"
        >
          Bayar Sekarang
        </button>
      </div>
    </div>
  );
}
