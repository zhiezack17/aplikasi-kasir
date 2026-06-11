import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Package, X } from "lucide-react";
import api, { formatRp, formatApiError } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const EMPTY = { name: "", description: "", price: "", stock: 0, category_id: "", image_url: "", active: true };

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filterCat, setFilterCat] = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([api.get("/products"), api.get("/categories")]);
      setProducts(p.data);
      setCategories(c.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startAdd = () => {
    setForm({ ...EMPTY, category_id: categories[0]?.id || "" });
    setEditingId(null);
    setError("");
    setOpen(true);
  };

  const startEdit = (p) => {
    setForm({
      name: p.name,
      description: p.description || "",
      price: p.price,
      stock: p.stock,
      category_id: p.category_id,
      image_url: p.image_url || "",
      active: p.active !== false,
    });
    setEditingId(p.id);
    setError("");
    setOpen(true);
  };

  const submit = async () => {
    setError("");
    setSaving(true);
    try {
      const body = {
        ...form,
        price: Number(form.price),
        stock: Number(form.stock),
      };
      if (editingId) await api.put(`/products/${editingId}`, body);
      else await api.post("/products", body);
      setOpen(false);
      await load();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Hapus produk "${p.name}"?`)) return;
    try {
      await api.delete(`/products/${p.id}`);
      await load();
    } catch (e) {
      alert(formatApiError(e));
    }
  };

  const filtered = filterCat === "all" ? products : products.filter((p) => p.category_id === filterCat);
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-brand-text">Produk</h1>
          <p className="text-brand-textMuted">Kelola menu cafe Anda</p>
        </div>
        <button
          onClick={startAdd}
          className="h-12 px-5 rounded-xl bg-brand-primary text-white font-semibold flex items-center gap-2 hover:bg-brand-primaryHover transition shadow-button-glow"
          data-testid="add-product-btn"
        >
          <Plus className="w-5 h-5" />
          Tambah Produk
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-2">
        <button
          onClick={() => setFilterCat("all")}
          className={`shrink-0 px-4 h-9 rounded-full text-sm font-semibold transition ${
            filterCat === "all" ? "bg-brand-primary text-white" : "bg-brand-surface border border-brand-border text-brand-textMuted"
          }`}
        >
          Semua
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setFilterCat(c.id)}
            className={`shrink-0 px-4 h-9 rounded-full text-sm font-semibold transition ${
              filterCat === c.id ? "bg-brand-primary text-white" : "bg-brand-surface border border-brand-border text-brand-textMuted"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      ) : (
        <div className="bg-brand-surface rounded-2xl shadow-card-subtle border border-brand-border overflow-hidden">
          <div className="hidden md:grid grid-cols-12 px-6 py-3 border-b border-brand-border bg-brand-surface2 text-xs uppercase tracking-wider font-bold text-brand-textMuted">
            <div className="col-span-5">Produk</div>
            <div className="col-span-2">Kategori</div>
            <div className="col-span-2">Harga</div>
            <div className="col-span-2">Stok</div>
            <div className="col-span-1 text-right">Aksi</div>
          </div>
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-brand-textMuted">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              Belum ada produk
            </div>
          ) : (
            filtered.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-1 md:grid-cols-12 px-4 md:px-6 py-4 border-b border-brand-border last:border-0 items-center gap-3"
                data-testid={`product-row-${p.id}`}
              >
                <div className="md:col-span-5 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-brand-surface2 shrink-0">
                    {p.image_url && <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-brand-text truncate">{p.name}</div>
                    <div className="text-xs text-brand-textMuted truncate">{p.description}</div>
                  </div>
                </div>
                <div className="md:col-span-2 text-sm text-brand-textMuted">{catMap[p.category_id] || "-"}</div>
                <div className="md:col-span-2 font-semibold text-brand-text">{formatRp(p.price)}</div>
                <div className="md:col-span-2">
                  <span className={`font-medium ${p.stock <= 5 ? "text-brand-warning" : "text-brand-text"}`}>{p.stock}</span>
                </div>
                <div className="md:col-span-1 flex gap-1 justify-end">
                  <button
                    onClick={() => startEdit(p)}
                    className="w-9 h-9 rounded-lg hover:bg-brand-surface2 flex items-center justify-center text-brand-textMuted hover:text-brand-text"
                    data-testid={`edit-product-${p.id}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => remove(p)}
                    className="w-9 h-9 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-500"
                    data-testid={`delete-product-${p.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tight">
              {editingId ? "Edit Produk" : "Tambah Produk"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <Field label="Nama">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full h-11 px-4 rounded-xl border border-brand-border bg-brand-surface2 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                data-testid="product-name-input"
              />
            </Field>
            <Field label="Deskripsi">
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full h-11 px-4 rounded-xl border border-brand-border bg-brand-surface2 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Harga (Rp)">
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl border border-brand-border bg-brand-surface2 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  data-testid="product-price-input"
                />
              </Field>
              <Field label="Stok">
                <input
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl border border-brand-border bg-brand-surface2 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  data-testid="product-stock-input"
                />
              </Field>
            </div>
            <Field label="Kategori">
              <select
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                className="w-full h-11 px-4 rounded-xl border border-brand-border bg-brand-surface2 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                data-testid="product-category-select"
              >
                <option value="">Pilih kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="URL Gambar">
              <input
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                placeholder="https://..."
                className="w-full h-11 px-4 rounded-xl border border-brand-border bg-brand-surface2 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              />
            </Field>
            {form.image_url && (
              <img src={form.image_url} alt="" className="w-full h-32 object-cover rounded-xl" />
            )}
            {error && <div className="px-4 py-2 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}
          </div>
          <DialogFooter className="mt-4">
            <button
              onClick={() => setOpen(false)}
              className="h-11 px-5 rounded-xl bg-brand-surface2 hover:bg-brand-border font-semibold text-brand-text"
            >
              Batal
            </button>
            <button
              onClick={submit}
              disabled={saving || !form.name || !form.price || !form.category_id}
              className="h-11 px-6 rounded-xl bg-brand-primary hover:bg-brand-primaryHover text-white font-semibold disabled:opacity-50 flex items-center gap-2"
              data-testid="save-product-btn"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingId ? "Simpan" : "Tambah"}
            </button>
          </DialogFooter>
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
