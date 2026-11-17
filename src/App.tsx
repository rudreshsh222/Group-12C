import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PackageCheck,
  Plus,
  ShoppingCart,
  Truck,
  X,
} from 'lucide-react';
import { apiRequest, clearStoredAuth, getStoredToken } from './api';
import { DashboardView } from './components/DashboardView';
import { InventoryView } from './components/InventoryView';
import { LoginPage } from './components/LoginPage';
import { ProductsView } from './components/ProductsView';
import { ReceiptModal } from './components/ReceiptModal';
import { ReportsView } from './components/ReportsView';
import { SalesView } from './components/SalesView';
import { SuppliersView } from './components/SuppliersView';
import { ToastContainer, ToastMessage } from './components/Toast';
import { DashboardData, Product, Sale, User } from './types';

type NavTab = 'dashboard' | 'products' | 'inventory' | 'sales' | 'suppliers' | 'reports';

const NAV_ITEMS: Array<{ id: NavTab; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'inventory', label: 'Inventory & Stock', icon: Boxes },
  { id: 'sales', label: 'Sales & Billing', icon: ShoppingCart },
  { id: 'suppliers', label: 'Suppliers', icon: Truck },
  { id: 'reports', label: 'Reports & Export', icon: BarChart3 },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [lowStockAlertCount, setLowStockAlertCount] = useState(0);

  // Shared modal states
  const [activeReceipt, setActiveReceipt] = useState<Sale | null>(null);
  const [restockTargetProduct, setRestockTargetProduct] = useState<Product | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  const addToast = useCallback((type: 'success' | 'error', text: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const triggerDataRefresh = useCallback(() => {
    setRefreshSignal((prev) => prev + 1);
  }, []);

  // Verify existing session token on initial mount
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setAuthChecking(false);
      return;
    }

    apiRequest<{ user: User }>('/api/auth/me')
      .then((res) => setUser(res.user))
      .catch(() => {
        clearStoredAuth();
        setUser(null);
      })
      .finally(() => setAuthChecking(false));
  }, []);

  // Listen for 401 unauthorized events from API helper
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      addToast('error', 'Your session expired. Please sign in again.');
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [addToast]);

  // Keep sidebar low-stock notification count synchronized
  useEffect(() => {
    if (!user) return;
    apiRequest<DashboardData>('/api/dashboard')
      .then((res) => {
        setLowStockAlertCount(res.stats.lowStockCount + res.stats.outOfStockCount);
      })
      .catch(() => {});
  }, [user, refreshSignal]);

  async function handleLogout() {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // Clear local session regardless of network errors
    } finally {
      clearStoredAuth();
      setUser(null);
      setActiveTab('dashboard');
    }
  }

  async function handleViewReceiptById(saleId: number) {
    try {
      const fullReceipt = await apiRequest<Sale>(`/api/sales/${saleId}`);
      setActiveReceipt(fullReceipt);
    } catch (err: unknown) {
      addToast('error', err instanceof Error ? err.message : 'Unable to load receipt.');
    }
  }

  function handleQuickRestock(product: Product) {
    setRestockTargetProduct(product);
    setActiveTab('inventory');
  }

  function handleNavigate(tab: NavTab) {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  }

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm font-medium text-slate-500">Loading workspace...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <LoginPage
          onLoginSuccess={(loggedInUser) => {
            setUser(loggedInUser);
            addToast('success', `Welcome back, ${loggedInUser.full_name}.`);
          }}
        />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  const currentNav = NAV_ITEMS.find((item) => item.id === activeTab) || NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Left Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[264px] bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-150 lg:static lg:translate-x-0 no-print ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Brand Logo */}
          <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                <PackageCheck className="w-4.5 h-4.5" />
              </div>
              <span className="text-sm font-bold text-slate-900 tracking-tight truncate">
                StockFlow Admin
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 text-slate-500 hover:text-slate-800 rounded-md"
              aria-label="Close navigation menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-blue-600' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.id === 'inventory' && lowStockAlertCount > 0 && (
                    <span
                      className="text-xs font-mono font-semibold text-amber-700 tabular-nums shrink-0"
                      title={`${lowStockAlertCount} low or out-of-stock products`}
                    >
                      {lowStockAlertCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Profile & Logout Footer */}
        <div className="p-4 border-t border-slate-200 space-y-3">
          <div className="flex items-center gap-3">
            {!avatarError ? (
              <img
                src="/src/assets/images/avatar_shop_admin_1794923332070.jpg"
                alt={user.full_name}
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-semibold text-xs flex items-center justify-center shrink-0">
                {user.full_name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-900 truncate">
                {user.full_name}
              </div>
              <div className="text-xs text-slate-500 truncate capitalize">
                {user.username} · {user.role}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-20 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline">Inventory System</span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">/</span>
              <h1 className="text-base sm:text-lg font-semibold text-slate-900 truncate">
                {currentNav.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {lowStockAlertCount > 0 && activeTab !== 'inventory' && (
              <button
                type="button"
                onClick={() => handleNavigate('inventory')}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors whitespace-nowrap shrink-0"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                {lowStockAlertCount} Stock Alerts
              </button>
            )}

            {activeTab !== 'sales' && (
              <button
                type="button"
                onClick={() => handleNavigate('sales')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                New Sale
              </button>
            )}
          </div>
        </header>

        {/* Active View Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              onNavigate={(tab) => handleNavigate(tab)}
              onViewReceipt={handleViewReceiptById}
              onQuickRestock={handleQuickRestock}
              refreshSignal={refreshSignal}
            />
          )}

          {activeTab === 'products' && (
            <ProductsView
              onNotify={addToast}
              onDataChanged={triggerDataRefresh}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryView
              preselectedProduct={restockTargetProduct}
              onClearPreselected={() => setRestockTargetProduct(null)}
              onNotify={addToast}
              onDataChanged={triggerDataRefresh}
            />
          )}

          {activeTab === 'sales' && (
            <SalesView
              onNotify={addToast}
              onDataChanged={triggerDataRefresh}
              onOpenReceipt={(sale) => setActiveReceipt(sale)}
              onViewReceiptById={handleViewReceiptById}
            />
          )}

          {activeTab === 'suppliers' && (
            <SuppliersView
              onNotify={addToast}
              onDataChanged={triggerDataRefresh}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              onNotify={addToast}
              onViewReceipt={handleViewReceiptById}
            />
          )}
        </main>
      </div>

      {/* Printable Sales Receipt Modal */}
      <ReceiptModal sale={activeReceipt} onClose={() => setActiveReceipt(null)} />

      {/* Global Notification Toasts */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
