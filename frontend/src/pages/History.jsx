import { useEffect, useState } from "react";
import { Receipt, Loader2, Eye } from "lucide-react";
import api, { formatRp } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function History() {
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [detail, setDetail] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/transactions", { params: date ? { date } : {} });
      setTxs(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const totalAll = txs.reduce((s, t) => s + (t.total || 0), 0);
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
          <h1 className="text-3xl font-bold tracking-tight text-brand-text">Riwayat Transaksi</h1>
          <p className="text-brand-textMuted">{txs.length} transaksi · Total {formatRp(totalAll)}</p>
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-11 px-4 rounded-xl border border-brand-border bg-brand-surface focus:border-brand-primary focus:outline-none"
            data-testid="history-date-filter"
          />
          {date && (
            <button
              onClick={() => setDate("")}
              className="h-11 px-4 rounded-xl bg-brand-surface2 font-semibold text-brand-text"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      ) : txs.length === 0 ? (
        <div className="bg-brand-surface rounded-2xl p-12 text-center text-brand-textMuted border border-brand-border">
          <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
          Belum ada transaksi
        </div>
      ) : (
        <div className="bg-brand-surface rounded-2xl shadow-card-subtle border border-brand-border overflow-hidden">
          {txs.map((t) => (
            <button
              key={t.id}
              onClick={() => setDetail(t)}
              className="w-full text-left grid grid-cols-12 px-4 md:px-6 py-4 border-b border-brand-border last:border-0 items-center hover:bg-brand-surface2 transition"
              data-testid={`tx-row-${t.id}`}
            >
              <div className="col-span-12 md:col-span-3">
                <div className="font-semibold text-brand-text">{t.order_number}</div>
                <div className="text-xs text-brand-textMuted">{fmtDate(t.created_at)}</div>
              </div>
              <div className="col-span-6 md:col-span-3 text-sm text-brand-textMuted">
                {t.items.length} item · {t.cashier_name}
              </div>
              <div className="col-span-3 md:col-span-2 text-xs uppercase font-semibold">
                <span className={`px-2.5 py-1 rounded-full ${
                  t.payment_method === "cash" ? "bg-green-100 text-green-700" :
                  t.payment_method === "qris" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                }`}>{t.payment_method}</span>
              </div>
              <div className="col-span-3 md:col-span-3 text-right font-bold text-brand-text">{formatRp(t.total)}</div>
              <div className="hidden md:flex col-span-1 justify-end">
                <Eye className="w-4 h-4 text-brand-textMuted" />
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Detail Transaksi</DialogTitle>
          </DialogHeader>
          {detail && (
            <div>
              <div className="text-sm text-brand-textMuted mb-3">
                <div>{detail.order_number}</div>
                <div>{fmtDate(detail.created_at)} · {detail.cashier_name}</div>
              </div>
              <div className="border-t border-dashed border-brand-border pt-3 space-y-2 text-sm">
                {detail.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{it.product_name} × {it.quantity}</span>
                    <span className="font-semibold">{formatRp(it.subtotal)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed border-brand-border mt-3 pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-brand-textMuted">
                  <span>Subtotal</span><span>{formatRp(detail.subtotal)}</span>
                </div>
                <div className="flex justify-between text-brand-textMuted">
                  <span>Pajak</span><span>{formatRp(detail.tax)}</span>
                </div>
                <div className="flex justify-between font-bold text-base text-brand-text">
                  <span>Total</span><span>{formatRp(detail.total)}</span>
                </div>
                <div className="flex justify-between text-brand-textMuted pt-2 border-t border-dashed border-brand-border mt-2">
                  <span>Pembayaran</span><span className="uppercase font-semibold">{detail.payment_method}</span>
                </div>
                {detail.cash_received != null && (
                  <>
                    <div className="flex justify-between text-brand-textMuted">
                      <span>Diterima</span><span>{formatRp(detail.cash_received)}</span>
                    </div>
                    <div className="flex justify-between text-brand-secondary font-semibold">
                      <span>Kembalian</span><span>{formatRp(detail.change || 0)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
