import { useEffect, useState } from "react";
import { Loader2, MessageCircle, Save, Send, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import api, { formatApiError } from "@/lib/api";

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [shopName, setShopName] = useState("");
  const [token, setToken] = useState("");
  const [tokenMasked, setTokenMasked] = useState("");
  const [tokenSet, setTokenSet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null); // {type, text}

  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/settings");
      setShopName(data.shop_name || "");
      setTokenMasked(data.fonnte_token_masked || "");
      setTokenSet(!!data.fonnte_token_set);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setMsg(null);
    setSaving(true);
    try {
      const body = { shop_name: shopName };
      if (token) body.fonnte_token = token;
      await api.put("/settings", body);
      setMsg({ type: "success", text: "Pengaturan tersimpan" });
      setToken("");
      await load();
    } catch (e) {
      setMsg({ type: "error", text: formatApiError(e) });
    } finally {
      setSaving(false);
    }
  };

  const testSend = async () => {
    if (!testPhone) return;
    setMsg(null);
    setTesting(true);
    try {
      await api.post("/settings/test-whatsapp", { phone: testPhone });
      setMsg({ type: "success", text: `Pesan test berhasil dikirim ke ${testPhone} 🎉` });
    } catch (e) {
      setMsg({ type: "error", text: formatApiError(e) });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-brand-text">Pengaturan</h1>
        <p className="text-brand-textMuted">Kelola integrasi WhatsApp & info toko</p>
      </div>

      {/* Toast */}
      {msg && (
        <div
          className={`mb-4 px-4 py-3 rounded-xl border flex items-start gap-2 text-sm ${
            msg.type === "success"
              ? "bg-brand-secondary/10 border-brand-secondary/30 text-brand-secondary"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
          data-testid={`settings-${msg.type}`}
        >
          {msg.type === "success" ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <AlertCircle className="w-4 h-4 mt-0.5" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Shop Name */}
      <Section title="Info Toko" desc="Nama toko yang muncul di pesan WhatsApp">
        <Field label="Nama Toko">
          <input
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="Warung Kopi"
            className="w-full h-11 px-4 rounded-xl border border-brand-border bg-brand-surface2 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            data-testid="shop-name-input"
          />
        </Field>
      </Section>

      {/* Fonnte */}
      <Section
        title="Integrasi WhatsApp (Fonnte)"
        desc="Kirim notifikasi otomatis ke pelanggan saat hutang dicatat, pembayaran diterima, atau reminder manual"
        icon={MessageCircle}
      >
        <div className="bg-brand-surface2 rounded-xl p-4 mb-4 text-sm">
          <p className="font-semibold text-brand-text mb-2">📋 Cara dapatkan Token Fonnte:</p>
          <ol className="list-decimal pl-5 space-y-1 text-brand-textMuted">
            <li>Daftar gratis di <a href="https://fonnte.com" target="_blank" rel="noreferrer" className="text-brand-primary font-semibold hover:underline inline-flex items-center gap-1">fonnte.com <ExternalLink className="w-3 h-3" /></a></li>
            <li>Buka menu <span className="font-semibold">Devices</span> → <span className="font-semibold">Add Device</span></li>
            <li>Scan QR code dengan WhatsApp ponsel Anda</li>
            <li>Klik tombol <span className="font-semibold">&quot;Token&quot;</span> → copy</li>
            <li>Paste di kolom di bawah → Simpan</li>
          </ol>
        </div>

        <Field label="Status">
          <div className="flex items-center gap-2 px-4 h-11 rounded-xl bg-brand-surface2 border border-brand-border">
            {tokenSet ? (
              <>
                <div className="w-2 h-2 rounded-full bg-brand-secondary" />
                <span className="text-sm font-semibold text-brand-secondary">Aktif</span>
                <span className="text-xs text-brand-textMuted ml-2">Token: {tokenMasked}</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-brand-warning" />
                <span className="text-sm font-semibold text-brand-warning">Belum dikonfigurasi</span>
              </>
            )}
          </div>
        </Field>

        <Field label={tokenSet ? "Ganti Token (kosongkan jika tidak ingin diubah)" : "Token API Fonnte"}>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={tokenSet ? "•••••••• (tidak diubah)" : "Paste token Fonnte di sini"}
            className="w-full h-11 px-4 rounded-xl border border-brand-border bg-brand-surface2 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 font-mono text-sm"
            data-testid="fonnte-token-input"
          />
        </Field>

        <button
          onClick={save}
          disabled={saving}
          className="h-11 px-6 rounded-xl bg-brand-primary text-white font-semibold flex items-center gap-2 disabled:opacity-50 transition shadow-button-glow"
          data-testid="save-settings-btn"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Simpan Pengaturan
        </button>
      </Section>

      {/* Test WA */}
      {tokenSet && (
        <Section title="Test Kirim WhatsApp" desc="Kirim pesan test ke nomor HP Anda untuk memastikan integrasi bekerja">
          <Field label="No. HP Tujuan">
            <input
              type="tel"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="0812..."
              className="w-full h-11 px-4 rounded-xl border border-brand-border bg-brand-surface2 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              data-testid="test-phone-input"
            />
          </Field>
          <button
            onClick={testSend}
            disabled={testing || !testPhone}
            className="h-11 px-6 rounded-xl bg-brand-secondary text-white font-semibold flex items-center gap-2 disabled:opacity-50 transition"
            data-testid="test-whatsapp-btn"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Kirim Test
          </button>
        </Section>
      )}

      {/* Info notifications */}
      <Section title="Notifikasi Otomatis Aktif" desc="Pesan WhatsApp dikirim otomatis untuk event berikut">
        <ul className="space-y-2 text-sm">
          {[
            "Transaksi hutang baru tercatat (otomatis)",
            "Pembayaran hutang diterima (otomatis, sebagian/lunas)",
            "Reminder hutang manual (lewat tombol di kartu pelanggan)",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-brand-secondary mt-0.5 shrink-0" />
              <span className="text-brand-text">{item}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, desc, children, icon: Icon }) {
  return (
    <div className="bg-brand-surface rounded-2xl border border-brand-border p-5 md:p-6 mb-4 shadow-card-subtle">
      <div className="flex items-start gap-3 mb-4">
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-brand-primary" />
          </div>
        )}
        <div>
          <h2 className="text-lg font-bold text-brand-text">{title}</h2>
          <p className="text-sm text-brand-textMuted">{desc}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
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
