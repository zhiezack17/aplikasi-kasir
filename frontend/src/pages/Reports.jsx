import { useEffect, useState } from "react";
import { Loader2, TrendingUp, Receipt, Banknote, CreditCard, QrCode, Trophy, Wallet } from "lucide-react";
import api, { formatRp } from "@/lib/api";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function Reports() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/reports/daily", { params: { date } });
        setData(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [date]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-brand-text">Laporan Penjualan</h1>
          <p className="text-brand-textMuted">Pantau performa harian cafe Anda</p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-11 px-4 rounded-xl border border-brand-border bg-brand-surface focus:border-brand-primary focus:outline-none"
          data-testid="reports-date-filter"
        />
      </div>

      {loading || !data ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <KPI icon={TrendingUp} label="Total Pendapatan" value={formatRp(data.total_revenue)} color="bg-brand-primary" />
            <KPI icon={Receipt} label="Total Pesanan" value={data.total_orders} color="bg-brand-secondary" />
            <KPI icon={Banknote} label="Tunai" value={formatRp(data.by_payment.cash || 0)} color="bg-green-600" />
            <KPI icon={QrCode} label="QRIS + Transfer" value={formatRp((data.by_payment.qris || 0) + (data.by_payment.transfer || 0))} color="bg-blue-600" />
          </div>

          {/* Debt KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <KPI
              icon={Wallet}
              label="Total Hutang Outstanding"
              value={formatRp(data.outstanding_debt || 0)}
              color="bg-red-600"
              testid="kpi-outstanding-debt"
            />
            <KPI
              icon={Wallet}
              label="Pelanggan dengan Hutang"
              value={data.customers_with_debt || 0}
              color="bg-orange-500"
              testid="kpi-customers-with-debt"
            />
          </div>

          {/* Trend chart */}
          <div className="bg-brand-surface rounded-2xl border border-brand-border p-4 md:p-6 shadow-card-subtle" data-testid="reports-trend-chart">
            <h2 className="text-lg font-bold text-brand-text mb-1">Tren 7 Hari Terakhir</h2>
            <p className="text-sm text-brand-textMuted mb-4">Pendapatan harian</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.trend} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EAE6DF" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
                    fontSize={12}
                    stroke="#7A726E"
                  />
                  <YAxis
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    fontSize={12}
                    stroke="#7A726E"
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #EAE6DF" }}
                    formatter={(v) => formatRp(v)}
                    labelFormatter={(d) => new Date(d).toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "long" })}
                  />
                  <Bar dataKey="revenue" fill="#D47963" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Products */}
          <div className="bg-brand-surface rounded-2xl border border-brand-border p-4 md:p-6 shadow-card-subtle">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-brand-warning" />
              <h2 className="text-lg font-bold text-brand-text">Produk Terlaris Hari Ini</h2>
            </div>
            {data.top_products.length === 0 ? (
              <p className="text-brand-textMuted text-sm py-6 text-center">Belum ada penjualan hari ini</p>
            ) : (
              <div className="space-y-2">
                {data.top_products.map((p, idx) => (
                  <div key={p.product_id} className="flex items-center gap-3 p-3 rounded-xl bg-brand-surface2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm ${
                      idx === 0 ? "bg-brand-warning" : idx === 1 ? "bg-brand-secondary" : "bg-brand-textMuted"
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-brand-text truncate">{p.name}</div>
                      <div className="text-xs text-brand-textMuted">{p.quantity} terjual</div>
                    </div>
                    <div className="font-bold text-brand-primary">{formatRp(p.revenue)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KPI({ icon: Icon, label, value, color, testid }) {
  return (
    <div className="bg-brand-surface rounded-2xl border border-brand-border p-4 md:p-5 shadow-card-subtle" data-testid={testid}>
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="text-xs uppercase tracking-wider font-bold text-brand-textMuted mb-1">{label}</div>
      <div className="text-xl md:text-2xl font-bold text-brand-text">{value}</div>
    </div>
  );
}
