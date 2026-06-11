import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Tags } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function Categories() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", icon: "" });
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/categories");
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startAdd = () => {
    setForm({ name: "", icon: "" });
    setEditingId(null);
    setError("");
    setOpen(true);
  };
  const startEdit = (c) => {
    setForm({ name: c.name, icon: c.icon || "" });
    setEditingId(c.id);
    setError("");
    setOpen(true);
  };
  const submit = async () => {
    setError("");
    setSaving(true);
    try {
      if (editingId) await api.put(`/categories/${editingId}`, form);
      else await api.post("/categories", form);
      setOpen(false);
      await load();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setSaving(false);
    }
  };
  const remove = async (c) => {
    if (!window.confirm(`Hapus kategori "${c.name}"?`)) return;
    try {
      await api.delete(`/categories/${c.id}`);
      await load();
    } catch (e) {
      alert(formatApiError(e));
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-brand-text">Kategori</h1>
          <p className="text-brand-textMuted">Atur kategori produk Anda</p>
        </div>
        <button
          onClick={startAdd}
          className="h-12 px-5 rounded-xl bg-brand-primary text-white font-semibold flex items-center gap-2 hover:bg-brand-primaryHover transition shadow-button-glow"
          data-testid="add-category-btn"
        >
          <Plus className="w-5 h-5" />
          Tambah Kategori
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-brand-surface rounded-2xl p-12 text-center text-brand-textMuted border border-brand-border">
          <Tags className="w-12 h-12 mx-auto mb-3 opacity-30" />
          Belum ada kategori
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((c) => (
            <div
              key={c.id}
              className="bg-brand-surface rounded-xl p-4 flex items-center justify-between border border-brand-border hover:shadow-card-subtle transition"
              data-testid={`category-row-${c.id}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-brand-primary/10 flex items-center justify-center">
                  <Tags className="w-5 h-5 text-brand-primary" />
                </div>
                <div>
                  <div className="font-semibold text-brand-text">{c.name}</div>
                  {c.icon && <div className="text-xs text-brand-textMuted">{c.icon}</div>}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => startEdit(c)}
                  className="w-9 h-9 rounded-lg hover:bg-brand-surface2 flex items-center justify-center text-brand-textMuted hover:text-brand-text"
                  data-testid={`edit-category-${c.id}`}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => remove(c)}
                  className="w-9 h-9 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-500"
                  data-testid={`delete-category-${c.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tight">
              {editingId ? "Edit Kategori" : "Tambah Kategori"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs uppercase tracking-wider font-bold text-brand-textMuted block mb-1.5">
                Nama Kategori
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full h-11 px-4 rounded-xl border border-brand-border bg-brand-surface2 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                data-testid="category-name-input"
              />
            </div>
            {error && <div className="px-4 py-2 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}
          </div>
          <DialogFooter>
            <button
              onClick={() => setOpen(false)}
              className="h-11 px-5 rounded-xl bg-brand-surface2 font-semibold"
            >
              Batal
            </button>
            <button
              onClick={submit}
              disabled={saving || !form.name}
              className="h-11 px-6 rounded-xl bg-brand-primary text-white font-semibold disabled:opacity-50 flex items-center gap-2"
              data-testid="save-category-btn"
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
