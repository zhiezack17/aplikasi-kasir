import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Users, Phone, MapPin, Wallet, History, X } from "lucide-react";
import api, { formatRp, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const EMPTY = { name: "", phone: "", address: "", notes: "" };

export default function Customers() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [payOpen, setPayOpen] = useState(false);
  const [payCust, setPayCust] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [paying, setPaying] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyCust, setHistoryCust] = useState(null);
  const [historyData, setHistoryData] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/customers");
      setItems(data);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const startAdd = () => {
    setForm(EMPTY);
    setEditingId(null);
    setError("");
    setOpen(true);
  };
  const startEdit = (c) => {
    setForm({ name: c.name, phone: c.phone || "", address: c.address || "", notes: c.notes || "" });
    setEditingId(c.id);
    setError("");
    setOpen(true);
  };
  const submit = async () => {
    setError("");
    setSaving(true);
    try {
      if (editingId) await api.put(`/customers/${editingId}`, form);
      else await api.post("/customers", form);
      setOpen(false);
      await load();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setSaving(false);
    }
  };
  const remove = async (c) => {
    if (!window.confirm(`Hapus pelanggan "${c.name}"?`)) return;
    try {
      await api.delete(`/customers/${c.id}`);
      await load();
    } catch (e) {
      alert(formatApiError(e));
    }
  };

  const openPay = (c) => {
    setPayCust(c);
    setPayAmount(String(c.debt));
    setPayMethod("cash");
    setPayOpen(true);
  };
  const submitPay = async () => {
    setPaying(true);
    try {
      await api.post(`/customers/${payCust.id}/pay-debt`, {
        amount: Number(payAmount),
        method: payMethod,
        notes: "",
      });
      setPayOpen(false);
      await load();
    } catch (e) {
      alert(formatApiError(e));
    } finally {
      setPaying(false);
    }
  };

  const openHistory = async (c) => {
    setHistoryCust(c);
    setHistoryData(null);
    setHistoryOpen(true);
    try {
      const { data } = await api.get(`/customers/${c.id}/transactions`);
      setHistoryData(data);
    } catch {
      setHistoryData({ transactions: [], payments: [] });
    }
  };

  const totalDebt = items.reduce((s, c) => s + (c.debt || 0), 0);
  const fmtDate = (s) => {
    try {
      return new Date(s).toLocaleString("id-ID", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
      });
    } catch {
      return s;
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-brand-text">Pelanggan</h1>
          <p className="text-brand-textMuted">
            {items.length} pelanggan · Total hutang outstanding: <span className="font-bold text-brand-primary">{formatRp(totalDebt)}</span>
          </p>
        </div>
        <button
          onClick={startAdd}
          className="h-12 px-5 rounded-xl bg-brand-primary text-white font-semibold flex items-center gap-2 hover:bg-brand-primaryHover transition shadow-button-glow"
          data-testid="add-customer-btn"
        >
          <Plus className="w-5 h-5" />
          Tambah Pelanggan
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-brand-surface rounded-2xl p-12 text-center text-brand-textMuted border border-brand-border">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Belum ada pelanggan</p>
          <p className="text-sm mt-1">Tambah pelanggan untuk mencatat transaksi hutang</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((c) => (
            <div
              key={c.id}
              className="bg-brand-surface rounded-2xl p-5 border border-brand-border hover:shadow-card-subtle transition"
              data-testid={`customer-card-${c.id}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-brand-primary/10 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-brand-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-brand-text truncate">{c.name}</div>
                    {c.phone && (
                      <div className="text-xs text-brand-textMuted flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {c.phone}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => openHistory(c)}
                    className="w-9 h-9 rounded-lg hover:bg-brand-surface2 flex items-center justify-center text-brand-textMuted hover:text-brand-text"
                    title="Riwayat"
                    data-testid={`history-customer-${c.id}`}
                  >
                    <History className="w-4 h-4" />
                  </button>
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => startEdit(c)}
                        className="w-9 h-9 rounded-lg hover:bg-brand-surface2 flex items-center justify-center text-brand-textMuted hover:text-brand-text"
                        data-testid={`edit-customer-${c.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => remove(c)}
                        className="w-9 h-9 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-500"
                        data-testid={`delete-customer-${c.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {c.address && (
                <div className="text-xs text-brand-textMuted flex items-start gap-1 mb-2">
                  <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                  <span className="line-clamp-1">{c.address}</span>
                </div>
              )}
              {c.notes && <div className="text-xs text-brand-textMuted italic mb-3">&ldquo;{c.notes}&rdquo;</div>}

              <div className={`rounded-xl p-3 flex items-center justify-between ${
                c.debt > 0 ? "bg-red-50" : "bg-brand-secondary/10"
              }`}>
                <div>
                  <div className="text-xs uppercase tracking-wider font-bold text-brand-textMuted">Hutang</div>
                  <div className={`text-lg font-bold ${c.debt > 0 ? "text-red-600" : "text-brand-secondary"}`}>
                    {formatRp(c.debt)}
                  </div>
                </div>
                {c.debt > 0 && (
                  <button
                    onClick={() => openPay(c)}
                    className="h-10 px-4 rounded-xl bg-brand-secondary hover:bg-brand-secondaryHover text-white font-semibold flex items-center gap-2 transition"
                    data-testid={`pay-debt-${c.id}`}
                  >
                    <Wallet className="w-4 h-4" />
                    Bayar Hutang
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Customer Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tight">
              {editingId ? "Edit Pelanggan" : "Tambah Pelanggan"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Field label="Nama">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full h-11 px-4 rounded-xl border border-brand-border bg-brand-surface2 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                data-testid="customer-name-input"
              />
            </Field>
            <Field label="No. HP">
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="0812..."
                className="w-full h-11 px-4 rounded-xl border border-brand-border bg-brand-surface2 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                data-testid="customer-phone-input"
              />
            </Field>
            <Field label="Alamat">
              <textarea
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-surface2 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              />
            </Field>
            <Field label="Catatan">
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-surface2 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              />
            </Field>
            {error && <div className="px-4 py-2 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}
          </div>
          <DialogFooter>
            <button onClick={() => setOpen(false)} className="h-11 px-5 rounded-xl bg-brand-surface2 font-semibold">
              Batal
            </button>
            <button
              onClick={submit}
              disabled={saving || !form.name}
              className="h-11 px-6 rounded-xl bg-brand-primary text-white font-semibold disabled:opacity-50 flex items-center gap-2"
              data-testid="save-customer-btn"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingId ? "Simpan" : "Tambah"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay Debt Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tight">Bayar Hutang</DialogTitle>
          </DialogHeader>
          {payCust && (
            <div className="space-y-3 mt-2">
              <div className="bg-brand-surface2 rounded-xl p-3">
                <div className="font-bold text-brand-text">{payCust.name}</div>
                <div className="text-sm text-brand-textMuted">Hutang saat ini: <span className="font-bold text-red-600">{formatRp(payCust.debt)}</span></div>
              </div>
              <Field label="Jumlah Bayar (Rp)">
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-brand-border bg-brand-surface2 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  data-testid="pay-debt-amount-input"
                />
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    onClick={() => setPayAmount(String(payCust.debt))}
                    className="h-10 text-xs rounded-lg bg-brand-surface2 hover:bg-brand-border font-semibold"
                  >
                    Bayar Lunas ({formatRp(payCust.debt)})
                  </button>
                  <button
                    onClick={() => setPayAmount(String(Math.round(payCust.debt / 2)))}
                    className="h-10 text-xs rounded-lg bg-brand-surface2 hover:bg-brand-border font-semibold"
                  >
                    Setengah
                  </button>
                </div>
              </Field>
              <Field label="Metode Pembayaran">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "cash", label: "Tunai" },
                    { id: "transfer", label: "Transfer" },
                    { id: "qris", label: "QRIS" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setPayMethod(m.id)}
                      className={`h-11 rounded-xl font-semibold border-2 ${
                        payMethod === m.id
                          ? "bg-brand-primary text-white border-brand-primary"
                          : "bg-brand-surface text-brand-text border-brand-border"
                      }`}
                      data-testid={`pay-debt-method-${m.id}`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          )}
          <DialogFooter>
            <button onClick={() => setPayOpen(false)} className="h-11 px-5 rounded-xl bg-brand-surface2 font-semibold">
              Batal
            </button>
            <button
              onClick={submitPay}
              disabled={paying || !payAmount || Number(payAmount) <= 0}
              className="h-11 px-6 rounded-xl bg-brand-secondary text-white font-semibold disabled:opacity-50 flex items-center gap-2"
              data-testid="confirm-pay-debt-btn"
            >
              {paying && <Loader2 className="w-4 h-4 animate-spin" />}
              Konfirmasi Bayar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tight">Riwayat: {historyCust?.name}</DialogTitle>
          </DialogHeader>
          {!historyData ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              <div>
                <h3 className="text-xs uppercase tracking-wider font-bold text-brand-textMuted mb-2">
                  Transaksi Hutang ({historyData.transactions.filter((t) => t.payment_method === "debt").length})
                </h3>
                {historyData.transactions.length === 0 ? (
                  <p className="text-sm text-brand-textMuted italic">Belum ada transaksi</p>
                ) : (
                  <div className="space-y-2">
                    {historyData.transactions.map((t) => (
                      <div key={t.id} className="bg-brand-surface2 rounded-xl p-3 text-sm">
                        <div className="flex justify-between mb-1">
                          <span className="font-semibold text-brand-text">{t.order_number}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            t.payment_method === "debt" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                          }`}>
                            {t.payment_method === "debt" ? "HUTANG" : t.payment_method.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-xs text-brand-textMuted">{fmtDate(t.created_at)}</div>
                        <div className="font-bold text-brand-text mt-1">{formatRp(t.total)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-xs uppercase tracking-wider font-bold text-brand-textMuted mb-2">
                  Riwayat Pembayaran ({historyData.payments.length})
                </h3>
                {historyData.payments.length === 0 ? (
                  <p className="text-sm text-brand-textMuted italic">Belum ada pembayaran hutang</p>
                ) : (
                  <div className="space-y-2">
                    {historyData.payments.map((p) => (
                      <div key={p.id} className="bg-brand-secondary/10 rounded-xl p-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-xs text-brand-textMuted">{fmtDate(p.created_at)}</span>
                          <span className="text-xs uppercase font-semibold text-brand-secondary">{p.method}</span>
                        </div>
                        <div className="font-bold text-brand-secondary mt-1">{formatRp(p.amount)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider font-bold text-brand-textMuted block mb-1.5">{label}</label>
      {children}
    </div>
  );
}
