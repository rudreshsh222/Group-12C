import { FormEvent, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  PackagePlus,
  PackageX,
  RefreshCw,
  X,
} from 'lucide-react';
import { apiRequest, formatCurrency, formatDateTime } from '../api';
import { Product, StockTransaction } from '../types';

interface InventoryViewProps {
  preselectedProduct: Product | null;
  onClearPreselected: () => void;
  onNotify: (type: 'success' | 'error', text: string) => void;
  onDataChanged: () => void;
}

export function InventoryView({
  preselectedProduct,
  onClearPreselected,
  onNotify,
  onDataChanged,
}: InventoryViewProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'alerts' | 'out' | 'all' | 'history'>('alerts');

  // Restock Modal
  const [restockModalOpen, setRestockModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [restockQty, setRestockQty] = useState('10');
  const [restockNote, setRestockNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function loadInventory() {
    setLoading(true);
    try {
      const [prods, txs] = await Promise.all([
        apiRequest<Product[]>('/api/products'),
        apiRequest<StockTransaction[]>('/api/inventory/transactions'),
      ]);
      setProducts(prods);
      setTransactions(txs);
    } catch (err: unknown) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to load inventory data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInventory();
  }, []);

  useEffect(() => {
    if (preselectedProduct) {
      setSelectedProductId(String(preselectedProduct.id));
      setRestockQty('15');
      setRestockNote(`Restock purchase for ${preselectedProduct.name}`);
      setRestockModalOpen(true);
      onClearPreselected();
    }
  }, [preselectedProduct, onClearPreselected]);

  function openRestockForProduct(product?: Product) {
    if (product) {
      setSelectedProductId(String(product.id));
      setRestockNote(`Purchase order from ${product.supplier_name || 'Supplier'}`);
    } else {
      const firstLow = products.find((p) => p.quantity <= p.reorder_level) || products[0];
      setSelectedProductId(firstLow ? String(firstLow.id) : '');
      setRestockNote('Regular stock purchase');
    }
    setRestockQty('10');
    setRestockModalOpen(true);
  }

  async function handleRestockSubmit(e: FormEvent) {
    e.preventDefault();
    const pid = Number(selectedProductId);
    const qty = Number(restockQty);

    if (!Number.isInteger(pid) || pid <= 0) {
      onNotify('error', 'Please select a product to restock.');
      return;
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      onNotify('error', 'Restock quantity must be a positive whole number.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest<{ message: string; product: Product }>(
        '/api/inventory/restock',
        {
          method: 'POST',
          body: JSON.stringify({
            product_id: pid,
            quantity: qty,
            reference_note: restockNote.trim() || 'Stock purchase',
          }),
        }
      );
      onNotify(
        'success',
        `Added +${qty} units to "${res.product.name}". New stock: ${res.product.quantity}.`
      );
      setRestockModalOpen(false);
      await loadInventory();
      onDataChanged();
    } catch (err: unknown) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to update stock.');
    } finally {
      setSubmitting(false);
    }
  }

  const outOfStockProducts = products.filter((p) => p.quantity === 0);
  const lowStockOnly = products.filter((p) => p.quantity > 0 && p.quantity <= p.reorder_level);
  const alertProducts = products.filter((p) => p.quantity <= p.reorder_level);
  const healthyProducts = products.filter((p) => p.quantity > p.reorder_level);

  const displayedProducts =
    activeTab === 'alerts'
      ? alertProducts
      : activeTab === 'out'
      ? outOfStockProducts
      : products;

  return (
    <div className="space-y-6">
      {/* Stock Health Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Healthy Stock</p>
            <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {healthyProducts.length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Low Stock Alerts</p>
            <p className="text-2xl font-bold text-amber-700 font-mono tabular-nums mt-1">
              {lowStockOnly.length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Out of Stock Products</p>
            <p className="text-2xl font-bold text-red-700 font-mono tabular-nums mt-1">
              {outOfStockProducts.length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
            <PackageX className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('alerts')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'alerts'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Low &amp; Out Alerts ({alertProducts.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('out')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'out'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Out of Stock ({outOfStockProducts.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Stock ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'history'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Stock Transactions ({transactions.length})
          </button>
        </div>

        <button
          type="button"
          onClick={() => openRestockForProduct()}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
        >
          <PackagePlus className="w-4 h-4" />
          Add Purchased Stock
        </button>
      </div>

      {/* Main Content Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : activeTab === 'history' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                  <th className="text-left py-3 px-4">Date &amp; Time</th>
                  <th className="text-left py-3 px-4">Product</th>
                  <th className="text-left py-3 px-4">Type</th>
                  <th className="text-right py-3 px-4">Change</th>
                  <th className="text-right py-3 px-4">Prev → New</th>
                  <th className="text-left py-3 px-4">Reference Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 text-xs font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {formatDateTime(tx.created_at)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{tx.product_name}</div>
                      <div className="text-xs font-mono text-slate-500">{tx.sku}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {tx.transaction_type === 'PURCHASE' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                          Purchase
                        </span>
                      ) : tx.transaction_type === 'SALE' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700">
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          Sale
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700">
                          <RefreshCw className="w-3.5 h-3.5" />
                          Adjustment
                        </span>
                      )}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono tabular-nums font-semibold ${
                        tx.quantity_change > 0 ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {tx.quantity_change > 0 ? `+${tx.quantity_change}` : tx.quantity_change}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {tx.previous_quantity} → <span className="font-semibold text-slate-900">{tx.new_quantity}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {tx.reference_note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : displayedProducts.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-slate-700">
              {activeTab === 'out'
                ? 'Great news — no products are currently out of stock.'
                : 'No low-stock alerts right now.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                  <th className="text-left py-3 px-4">Product</th>
                  <th className="text-left py-3 px-4">Category</th>
                  <th className="text-left py-3 px-4">Supplier</th>
                  <th className="text-right py-3 px-4">Unit Price</th>
                  <th className="text-right py-3 px-4">Available</th>
                  <th className="text-right py-3 px-4">Reorder At</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-right py-3 px-4">Restock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedProducts.map((product) => {
                  const isOut = product.quantity === 0;
                  const isLow = product.quantity > 0 && product.quantity <= product.reorder_level;
                  return (
                    <tr key={product.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{product.name}</div>
                        <div className="text-xs font-mono text-slate-500">{product.sku}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{product.category_name}</td>
                      <td className="py-3 px-4 text-slate-500">
                        {product.supplier_name || 'Unassigned'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                        {formatCurrency(product.price)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {product.quantity}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500">
                        {product.reorder_level}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700">
                            <PackageX className="w-3.5 h-3.5" />
                            Out of Stock
                          </span>
                        ) : isLow ? (
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
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openRestockForProduct(product)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors whitespace-nowrap"
                        >
                          <PackagePlus className="w-3.5 h-3.5" />
                          Add Stock
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

      {/* Purchase / Restock Modal */}
      {restockModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[1px] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="restock-modal-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 id="restock-modal-title" className="text-base font-semibold text-slate-900">
                Add Purchased Stock
              </h3>
              <button
                type="button"
                onClick={() => setRestockModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Select Product *
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  required
                >
                  <option value="">Choose a product</option>
                  {products.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.sku} — {p.name} (Current: {p.quantity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Quantity Purchased (Units to Add) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Purchase / Supplier Reference Note
                </label>
                <input
                  type="text"
                  value={restockNote}
                  onChange={(e) => setRestockNote(e.target.value)}
                  placeholder="e.g. Invoice #PO-412 from supplier"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRestockModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
                >
                  {submitting ? 'Updating...' : 'Confirm Restock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
