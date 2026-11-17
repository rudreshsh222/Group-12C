import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  IndianRupee,
  Package,
  PackageX,
  Receipt,
  RefreshCw,
} from 'lucide-react';
import { apiRequest, formatCurrency, formatDateTime } from '../api';
import { DashboardData, Product, Sale } from '../types';

interface DashboardViewProps {
  onNavigate: (tab: 'products' | 'inventory' | 'sales' | 'reports') => void;
  onViewReceipt: (saleId: number) => void;
  onQuickRestock: (product: Product) => void;
  refreshSignal: number;
}

export function DashboardView({
  onNavigate,
  onViewReceipt,
  onQuickRestock,
  refreshSignal,
}: DashboardViewProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hoveredDayIndex, setHoveredDayIndex] = useState<number | null>(null);

  async function loadDashboard() {
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest<DashboardData>('/api/dashboard');
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, [refreshSignal]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-white border border-slate-200 rounded-xl p-5 animate-pulse">
              <div className="h-4 w-28 bg-slate-100 rounded" />
              <div className="h-8 w-20 bg-slate-100 rounded mt-4" />
            </div>
          ))}
        </div>
        <div className="h-80 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-red-200 rounded-xl p-6 text-center">
        <p className="text-sm font-medium text-red-700">{error}</p>
        <button
          type="button"
          onClick={loadDashboard}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { stats, recentSales, lowStockProducts, salesChart, categoryBreakdown } = data;
  const maxChartRevenue = Math.max(...salesChart.map((d) => d.revenue), 100);
  const maxCategoryValue = Math.max(...categoryBreakdown.map((c) => c.value), 1);
  const alertTotal = stats.lowStockCount + stats.outOfStockCount;

  return (
    <div className="space-y-6">
      {/* 4 Primary KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Total Products</span>
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Package className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {stats.totalProducts}
            </div>
            <button
              type="button"
              onClick={() => onNavigate('products')}
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              Manage catalog <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Total Stock Available</span>
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Boxes className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {stats.totalStockAvailable.toLocaleString('en-IN')} <span className="text-sm font-sans font-normal text-slate-500">units</span>
            </div>
            <p className="mt-1.5 text-xs text-slate-500 font-mono tabular-nums">
              Valuation: {formatCurrency(stats.inventoryValue)}
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Total Sales</span>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <IndianRupee className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {formatCurrency(stats.totalSalesRevenue)}
            </div>
            <button
              type="button"
              onClick={() => onNavigate('sales')}
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 tabular-nums"
            >
              {stats.totalSalesCount} completed orders <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Low Stock Products</span>
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                alertTotal > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
              }`}
            >
              <AlertTriangle className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {alertTotal}
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-600">
              <span className="text-amber-700 font-medium tabular-nums">
                {stats.lowStockCount} low
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-red-700 font-medium tabular-nums">
                {stats.outOfStockCount} out of stock
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sales Overview Chart + Category Stock Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Sales Overview (Last 14 Days)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Daily revenue and order count across recent store transactions
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Full Reports
            </button>
          </div>

          <div className="relative">
            {/* Hover tooltip */}
            {hoveredDayIndex !== null && salesChart[hoveredDayIndex] && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs inline-flex items-center gap-3 tabular-nums">
                <span className="font-medium">{salesChart[hoveredDayIndex].label}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono font-semibold">
                  {formatCurrency(salesChart[hoveredDayIndex].revenue)}
                </span>
                <span aria-hidden="true">·</span>
                <span>{salesChart[hoveredDayIndex].orders} orders</span>
              </div>
            )}

            <div className="h-56 flex items-end gap-2 pt-4 pb-2 border-b border-slate-200">
              {salesChart.map((day, idx) => {
                const heightPct = Math.max(
                  day.revenue > 0 ? Math.round((day.revenue / maxChartRevenue) * 100) : 3,
                  3
                );
                const isHovered = hoveredDayIndex === idx;
                return (
                  <div
                    key={day.date}
                    onMouseEnter={() => setHoveredDayIndex(idx)}
                    onMouseLeave={() => setHoveredDayIndex(null)}
                    className="flex-1 h-full flex flex-col justify-end items-center group cursor-pointer"
                  >
                    <div className="w-full flex-1 flex items-end justify-center px-0.5">
                      <div
                        style={{ height: `${heightPct}%` }}
                        className={`w-full max-w-[34px] rounded-t-md transition-colors duration-150 ${
                          day.revenue === 0
                            ? 'bg-slate-100 group-hover:bg-slate-200'
                            : isHovered
                            ? 'bg-blue-700'
                            : 'bg-blue-600'
                        }`}
                        title={`${day.label}: ${formatCurrency(day.revenue)} (${day.orders} orders)`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              {salesChart.map((day, idx) => (
                <div
                  key={day.date}
                  className={`flex-1 text-center text-[11px] font-mono tabular-nums truncate ${
                    idx % 2 === 0 || idx === salesChart.length - 1
                      ? 'text-slate-500'
                      : 'text-transparent hidden sm:block'
                  }`}
                >
                  {day.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Category Stock Valuation Breakdown */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Stock by Category
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Inventory units and retail value per category
            </p>

            <div className="mt-5 space-y-4">
              {categoryBreakdown.map((cat) => {
                const widthPct = Math.round((cat.value / maxCategoryValue) * 100);
                return (
                  <div key={cat.name}>
                    <div className="flex items-baseline justify-between text-xs mb-1.5">
                      <span className="font-medium text-slate-800 truncate pr-2">
                        {cat.name}
                      </span>
                      <span className="font-mono tabular-nums text-slate-600 shrink-0">
                        {cat.stock} units · {formatCurrency(cat.value)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-200"
                        style={{ width: `${Math.max(widthPct, cat.stock > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('inventory')}
            className="mt-6 w-full py-2 px-4 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
          >
            Open Inventory &amp; Restock
          </button>
        </div>
      </div>

      {/* Bottom Split: Low Stock Alert Table + Recent Sales Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Low Stock & Out-of-Stock Alerts */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Low &amp; Out-of-Stock Alerts
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Products at or below their minimum reorder level
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap shrink-0"
            >
              View all
            </button>
          </div>

          {lowStockProducts.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              All products are sufficiently stocked above their reorder levels.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                    <th className="text-left py-2.5 px-4">Product</th>
                    <th className="text-right py-2.5 px-4">Stock</th>
                    <th className="text-left py-2.5 px-4">Status</th>
                    <th className="text-right py-2.5 px-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lowStockProducts.slice(0, 6).map((item) => {
                    const isOut = item.quantity === 0;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-4">
                          <div className="font-medium text-slate-900 truncate max-w-[190px]">
                            {item.name}
                          </div>
                          <div className="text-xs font-mono text-slate-500">
                            {item.sku} · {item.category_name}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-800">
                          {item.quantity} / {item.reorder_level}
                        </td>
                        <td className="py-2.5 px-4">
                          {isOut ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
                              <PackageX className="w-3.5 h-3.5" />
                              Out of Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Low Stock
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => onQuickRestock(item)}
                            className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors whitespace-nowrap"
                          >
                            Restock
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Sales */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Recent Sales
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Latest completed customer bills and receipts
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('sales')}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap shrink-0"
            >
              New Sale
            </button>
          </div>

          {recentSales.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No sales recorded yet. Create your first sale from the Sales &amp; Billing tab.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                    <th className="text-left py-2.5 px-4">Receipt &amp; Customer</th>
                    <th className="text-right py-2.5 px-4">Items</th>
                    <th className="text-right py-2.5 px-4">Total</th>
                    <th className="text-right py-2.5 px-4">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentSales.map((sale: Sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-900">{sale.customer_name}</div>
                        <div className="text-xs font-mono text-slate-500 tabular-nums">
                          {sale.receipt_number} · {formatDateTime(sale.created_at)}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                        {sale.item_count ?? '-'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {formatCurrency(sale.total_amount)}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => onViewReceipt(sale.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
