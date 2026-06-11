import { NavLink, useNavigate, Outlet } from "react-router-dom";
import {
  Coffee,
  ShoppingCart,
  Package,
  Tags,
  History,
  BarChart3,
  Users,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

const linkBase =
  "flex items-center gap-3 px-4 py-3 rounded-xl text-brand-textMuted hover:bg-brand-surface2 hover:text-brand-text transition font-medium";
const linkActive = "bg-brand-primary text-white hover:bg-brand-primaryHover hover:text-white shadow-button-glow";

function NavItem({ to, icon: Icon, label, testid, end = false, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) => `${linkBase} ${isActive ? linkActive : ""}`}
      data-testid={testid}
    >
      <Icon className="w-5 h-5" />
      <span>{label}</span>
    </NavLink>
  );
}

function NavMenu({ isAdmin, onItemClick }) {
  return (
    <nav className="flex flex-col gap-1.5 flex-1">
      <NavItem to="/" end icon={ShoppingCart} label="Kasir" testid="nav-pos" onClick={onItemClick} />
      <NavItem to="/history" icon={History} label="Riwayat" testid="nav-history" onClick={onItemClick} />
      <NavItem to="/customers" icon={Users} label="Pelanggan" testid="nav-customers" onClick={onItemClick} />
      {isAdmin && (
        <>
          <NavItem to="/reports" icon={BarChart3} label="Laporan" testid="nav-reports" onClick={onItemClick} />
          <NavItem to="/products" icon={Package} label="Produk" testid="nav-products" onClick={onItemClick} />
          <NavItem to="/categories" icon={Tags} label="Kategori" testid="nav-categories" onClick={onItemClick} />
        </>
      )}
    </nav>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = user?.role === "admin";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const closeDrawer = () => setMobileOpen(false);

  return (
    <div className="min-h-screen bg-brand-bg flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-brand-surface border-r border-brand-border flex-col p-5">
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-10 h-10 rounded-xl bg-brand-primary flex items-center justify-center shadow-button-glow">
            <Coffee className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-brand-text leading-tight">Warung Kopi</div>
            <div className="text-xs text-brand-textMuted">POS System</div>
          </div>
        </div>
        <NavMenu isAdmin={isAdmin} />

        <div className="mt-auto">
          <div className="bg-brand-surface2 rounded-xl p-3 mb-2">
            <div className="text-xs uppercase tracking-wider font-bold text-brand-textMuted">Login sebagai</div>
            <div className="font-semibold text-brand-text">{user?.name}</div>
            <div className="text-xs text-brand-textMuted capitalize">{user?.role}</div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition font-medium"
            data-testid="logout-btn"
          >
            <LogOut className="w-5 h-5" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-brand-surface border-b border-brand-border h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-primary flex items-center justify-center">
            <Coffee className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-brand-text">Warung Kopi POS</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg hover:bg-brand-surface2"
          data-testid="mobile-menu-open"
        >
          <Menu className="w-6 h-6 text-brand-text" />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-brand-text/40"
            onClick={closeDrawer}
            data-testid="mobile-menu-backdrop"
          />
          <div className="absolute left-0 top-0 h-full w-72 bg-brand-surface p-5 flex flex-col shadow-drawer-heavy animate-fade-in-up">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-primary flex items-center justify-center">
                  <Coffee className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-brand-text">Menu</span>
              </div>
              <button
                onClick={closeDrawer}
                className="p-2 rounded-lg hover:bg-brand-surface2"
                data-testid="mobile-menu-close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <NavMenu isAdmin={isAdmin} onItemClick={closeDrawer} />
            <div className="mt-auto">
              <div className="bg-brand-surface2 rounded-xl p-3 mb-2">
                <div className="text-xs uppercase tracking-wider font-bold text-brand-textMuted">Login sebagai</div>
                <div className="font-semibold text-brand-text">{user?.name}</div>
                <div className="text-xs text-brand-textMuted capitalize">{user?.role}</div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition font-medium"
                data-testid="logout-btn-mobile"
              >
                <LogOut className="w-5 h-5" />
                <span>Keluar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 pt-14 md:pt-0">
        <Outlet />
      </main>
    </div>
  );
}
