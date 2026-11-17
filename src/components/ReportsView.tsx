import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  Download,
  IndianRupee,
  PackageX,
  Receipt,
  TrendingUp,
} from 'lucide-react';
import {
  apiRequest,
  downloadCsvReport,
  formatCurrency,
  formatDateTime,
} from '../api';
import { ReportsData } from '../types';

interface ReportsViewProps {
  onNotify: (type: 'success' | 'error', text: string) => void;
  onViewReceipt: (saleId: number) => void;
}

function getTodayDateString(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function ReportsView({ onNotify, onViewReceipt }: ReportsViewProps) {
  const today = getTodayDateString();
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));
  const [activeReport, setActiveReport] = useState<
    'daily' | 'monthly' | 'bestsellers' | 'stock'
  >('daily');
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  async function loadReports() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        date: selectedDate,
        month: selectedMonth,
      });
      const res = await apiRequest<ReportsData>(`/api/reports?${params.toString()}`);
      setData(res);
    } catch (err: unknown) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to load reports.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, [selectedDate, selectedMonth]);

  async function handleDownloadCsv(type: 'daily' | 'monthly' | 'bestsellers' | 'stock') {
    setDownloading(true);
    try {
      await downloadCsvReport(type, { date: selectedDate, month: selectedMonth });
      onNotify('success', 'CSV report downloaded.');
    } catch (err: unknown) {
      onNotify('error', err instanceof Error ? err.message : 'CSV export failed.');
    } finally {
      setDownloading(false);
    }
  }

  const totalStockValuation =
    data?.stockReport.reduce((sum, item) => sum + item.stock_value, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Top Revenue & Report Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Revenue (All-Time)</span>
            <IndianRupee className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-2">
            {formatCurrency(data?.overallRevenue ?? 0)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Daily Sales ({selectedDate})
            </span>
            <Calendar className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-2">
            {formatCurrency(data?.dailySummary.totalRevenue ?? 0)}
          </div>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {data?.dailySummary.totalOrders ?? 0} orders · {data?.dailySummary.unitsSold ?? 0} units
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Monthly Sales ({selectedMonth})
            </span>
            <BarChart3 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-2">
            {formatCurrency(data?.monthlySummary.totalRevenue ?? 0)}
          </div>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {data?.monthlySummary.totalOrders ?? 0} completed sales
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Current Stock Valuation</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-2">
            {formatCurrency(totalStockValuation)}
          </div>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            Across {data?.stockReport.length ?? 0} catalog products
          </p>
        </div>
      </div>

      {/* Report Tabs, Date/Month Controls & CSV Export */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
          {(
            [
              { id: 'daily', label: 'Daily Sales Report' },
              { id: 'monthly', label: 'Monthly Sales Report' },
              { id: 'bestsellers', label: 'Best-Selling Products' },
              { id: 'stock', label: 'Stock Report' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveReport(tab.id)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeReport === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {activeReport === 'daily' && (
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
              Date:
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </label>
          )}
          {activeReport === 'monthly' && (
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
              Month:
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </label>
          )}

          <button
            type="button"
            disabled={downloading || loading}
            onClick={() => handleDownloadCsv(activeReport)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            {downloading ? 'Exporting...' : 'Download CSV'}
          </button>
        </div>
      </div>

      {/* Report Body */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading || !data ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : activeReport === 'daily' ? (
          <>
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Daily Sales Report — {data.date}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Itemized receipts generated on selected date
                </p>
              </div>
              <span className="text-sm font-mono font-bold text-blue-700 tabular-nums">
                Total: {formatCurrency(data.dailySummary.totalRevenue)}
              </span>
            </div>

            {data.dailySummary.sales.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No sales were recorded on {data.date}. Try selecting another date.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                      <th className="text-left py-3 px-4">Receipt #</th>
                      <th className="text-left py-3 px-4">Customer</th>
                      <th className="text-left py-3 px-4">Payment</th>
                      <th className="text-right py-3 px-4">Units</th>
                      <th className="text-right py-3 px-4">Amount</th>
                      <th className="text-left py-3 px-4">Time</th>
                      <th className="text-right py-3 px-4">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.dailySummary.sales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-blue-700">
                          {sale.receipt_number}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {sale.customer_name}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{sale.payment_method}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                          {sale.item_count}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {formatCurrency(sale.total_amount)}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono tabular-nums text-slate-500">
                          {formatDateTime(sale.created_at)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => onViewReceipt(sale.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
                          >
                            <Receipt className="w-3.5 h-3.5 text-blue-600" />
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : activeReport === 'monthly' ? (
          <>
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Monthly Sales Report — {data.month}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Day-by-day revenue aggregation for the selected month
                </p>
              </div>
              <span className="text-sm font-mono font-bold text-blue-700 tabular-nums">
                Month Total: {formatCurrency(data.monthlySummary.totalRevenue)}
              </span>
            </div>

            {data.monthlySummary.dailyBreakdown.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No sales recorded for {data.month}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                      <th className="text-left py-3 px-4">Date</th>
                      <th className="text-right py-3 px-4">Orders</th>
                      <th className="text-right py-3 px-4">Daily Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.monthlySummary.dailyBreakdown.map((row) => (
                      <tr key={row.day} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-mono text-xs text-slate-800">
                          {row.day}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                          {row.orders}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {formatCurrency(row.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : activeReport === 'bestsellers' ? (
          <>
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">
                Best-Selling Products
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Ranked by total units sold across all completed sales
              </p>
            </div>

            {data.bestSellingProducts.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No product sales recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                      <th className="text-left py-3 px-4">Rank</th>
                      <th className="text-left py-3 px-4">Product ID</th>
                      <th className="text-left py-3 px-4">Product Name</th>
                      <th className="text-left py-3 px-4">Category</th>
                      <th className="text-right py-3 px-4">Units Sold</th>
                      <th className="text-right py-3 px-4">Revenue Generated</th>
                      <th className="text-right py-3 px-4">Remaining Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.bestSellingProducts.map((item, idx) => (
                      <tr key={item.product_id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-mono text-xs font-bold text-blue-700">
                          #{idx + 1}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-600">
                          {item.sku}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">{item.name}</td>
                        <td className="py-3 px-4 text-slate-600">{item.category_name}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {item.units_sold}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700">
                          {formatCurrency(item.total_revenue)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                          {item.current_stock}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Complete Stock &amp; Valuation Report
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sorted by lowest available stock to highlight priority restocks
                </p>
              </div>
              <span className="text-sm font-mono font-bold text-blue-700 tabular-nums">
                Total Value: {formatCurrency(totalStockValuation)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                    <th className="text-left py-3 px-4">Product ID</th>
                    <th className="text-left py-3 px-4">Product Name</th>
                    <th className="text-left py-3 px-4">Category</th>
                    <th className="text-right py-3 px-4">Unit Price</th>
                    <th className="text-right py-3 px-4">Available Qty</th>
                    <th className="text-right py-3 px-4">Stock Value</th>
                    <th className="text-left py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.stockReport.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono text-xs text-slate-600">
                        {item.sku}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">{item.name}</td>
                      <td className="py-3 px-4 text-slate-600">{item.category_name}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                        {formatCurrency(item.price)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {item.quantity}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {formatCurrency(item.stock_value)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.status === 'Out of Stock' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700">
                            <PackageX className="w-3.5 h-3.5" />
                            Out of Stock
                          </span>
                        ) : item.status === 'Low Stock' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            In Stock
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
