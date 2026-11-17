import { FormEvent, useEffect, useState } from 'react';
import {
  Minus,
  Plus,
  Receipt,
  Search,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import { apiRequest, formatCurrency, formatDateTime } from '../api';
import { Product, Sale } from '../types';

interface SalesViewProps {
  onNotify: (type: 'success' | 'error', text: string) => void;
  onDataChanged: () => void;
  onOpenReceipt: (sale: Sale) => void;
  onViewReceiptById: (saleId: number) => void;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export function SalesView({
  onNotify,
  onDataChanged,
  onOpenReceipt,
  onViewReceiptById,
}: SalesViewProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  // New Sale Form State
  const [selectedProductId, setSelectedProductId] = useState('');
  const [entryQuantity, setEntryQuantity] = useState('1');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card'>('Cash');
  const [submitting, setSubmitting] = useState(false);

  // Sales History Search
  const [historySearch, setHistorySearch] = useState('');

  async function loadSalesData() {
    setLoading(true);
    try {
      const [prods, salesList] = await Promise.all([
        apiRequest<Product[]>('/api/products'),
        apiRequest<Sale[]>('/api/sales'),
      ]);
      setProducts(prods);
      setSales(salesList);
      const firstAvailable = prods.find((p) => p.quantity > 0);
      setSelectedProductId((prev) => prev || (firstAvailable ? String(firstAvailable.id) : ''));
    } catch (err: unknown) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to load sales data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSalesData();
  }, []);

  const selectedProduct = products.find((p) => String(p.id) === selectedProductId) || null;

  function getRemainingStock(product: Product): number {
    const inCart = cart.find((c) => c.product.id === product.id)?.quantity ?? 0;
    return Math.max(0, product.quantity - inCart);
  }

  function handleAddToBill() {
    if (!selectedProduct) {
      onNotify('error', 'Please select a product to add to the bill.');
      return;
    }

    const qty = Number(entryQuantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      onNotify('error', 'Please enter a valid quantity (1 or more).');
      return;
    }

    const existingInCart = cart.find((c) => c.product.id === selectedProduct.id)?.quantity ?? 0;
    if (existingInCart + qty > selectedProduct.quantity) {
      onNotify(
        'error',
        `Cannot sell ${existingInCart + qty} units of "${selectedProduct.name}". Only ${selectedProduct.quantity} available in stock.`
      );
      return;
    }

    setCart((prev) => {
      const idx = prev.findIndex((c) => c.product.id === selectedProduct.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          quantity: updated[idx].quantity + qty,
        };
        return updated;
      }
      return [...prev, { product: selectedProduct, quantity: qty }];
    });

    setEntryQuantity('1');
  }

  function updateCartItemQty(productId: number, delta: number) {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id !== productId) return item;
          const nextQty = item.quantity + delta;
          if (nextQty <= 0) return null;
          if (nextQty > item.product.quantity) {
            onNotify(
              'error',
              `Maximum available stock for "${item.product.name}" is ${item.product.quantity}.`
            );
            return item;
          }
          return { ...item, quantity: nextQty };
        })
        .filter((item): item is CartItem => item !== null)
    );
  }

  function removeCartItem(productId: number) {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  }

  const grandTotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const totalUnits = cart.reduce((sum, item) => sum + item.quantity, 0);

  async function handleCompleteSale(e: FormEvent) {
    e.preventDefault();
    if (cart.length === 0) {
      onNotify('error', 'Please add at least one product to the sale bill.');
      return;
    }

    setSubmitting(true);
    try {
      const receipt = await apiRequest<Sale>('/api/sales', {
        method: 'POST',
        body: JSON.stringify({
          customer_name: customerName.trim() || 'Walk-in Customer',
          payment_method: paymentMethod,
          items: cart.map((item) => ({
            product_id: item.product.id,
            quantity: item.quantity,
          })),
        }),
      });

      onNotify(
        'success',
        `Sale ${receipt.receipt_number} completed! Stock automatically updated.`
      );
      setCart([]);
      setCustomerName('');
      setEntryQuantity('1');
      await loadSalesData();
      onDataChanged();
      onOpenReceipt(receipt);
    } catch (err: unknown) {
      onNotify('error', err instanceof Error ? err.message : 'Unable to complete sale.');
    } finally {
      setSubmitting(false);
    }
  }

  const filteredSales = sales.filter((sale) => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return true;
    return (
      sale.receipt_number.toLowerCase().includes(q) ||
      sale.customer_name.toLowerCase().includes(q) ||
      sale.payment_method.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Create New Sale Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Product Selection & Bill Cart */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Create New Sale
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select products and quantities. Inventory is validated and deducted automatically.
            </p>
          </div>

          {/* Product Picker Row */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-7">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Select Product
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              >
                <option value="">Choose a product...</option>
                {products.map((p) => (
                  <option key={p.id} value={String(p.id)} disabled={p.quantity === 0}>
                    {p.sku} — {p.name} ({formatCurrency(p.price)} | Stock: {p.quantity}
                    {p.quantity === 0 ? ' - Out of Stock' : ''})
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Qty
              </label>
              <input
                type="number"
                min="1"
                max={selectedProduct ? Math.max(1, getRemainingStock(selectedProduct)) : undefined}
                step="1"
                value={entryQuantity}
                onChange={(e) => setEntryQuantity(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div className="sm:col-span-3">
              <button
                type="button"
                onClick={handleAddToBill}
                disabled={!selectedProduct || selectedProduct.quantity === 0}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>
          </div>

          {selectedProduct && (
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 py-2 px-3 bg-slate-50 rounded-lg border border-slate-200/80 tabular-nums">
              <span>
                Unit Price: <strong className="font-mono text-slate-900">{formatCurrency(selectedProduct.price)}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Available Stock:{' '}
                <strong
                  className={`font-mono ${
                    getRemainingStock(selectedProduct) === 0 ? 'text-red-700' : 'text-emerald-700'
                  }`}
                >
                  {getRemainingStock(selectedProduct)} units
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Line Estimate:{' '}
                <strong className="font-mono text-slate-900">
                  {formatCurrency(selectedProduct.price * (Number(entryQuantity) || 0))}
                </strong>
              </span>
            </div>
          )}

          {/* Active Bill Items Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            {cart.length === 0 ? (
              <div className="p-8 text-center">
                <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">
                  No items added to the current bill yet
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select a product above and click Add Item to build a customer receipt.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                      <th className="text-left py-2.5 px-3">Product</th>
                      <th className="text-right py-2.5 px-3">Price</th>
                      <th className="text-center py-2.5 px-3">Qty</th>
                      <th className="text-right py-2.5 px-3">Subtotal</th>
                      <th className="text-right py-2.5 px-3">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cart.map((item) => (
                      <tr key={item.product.id}>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-900">{item.product.name}</div>
                          <div className="text-xs font-mono text-slate-500">
                            {item.product.sku} · Max: {item.product.quantity}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                          {formatCurrency(item.product.price)}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="inline-flex items-center justify-center gap-1.5 w-full">
                            <button
                              type="button"
                              onClick={() => updateCartItemQty(item.product.id, -1)}
                              className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center font-mono tabular-nums font-medium text-slate-900">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateCartItemQty(item.product.id, 1)}
                              className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100"
                              aria-label="Increase quantity"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {formatCurrency(item.product.price * item.quantity)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => removeCartItem(item.product.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            aria-label={`Remove ${item.product.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
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

        {/* Right: Checkout Summary Form */}
        <form
          onSubmit={handleCompleteSale}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Checkout &amp; Receipt Details
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Confirm customer and payment method to finalize this sale
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Customer Name
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Walk-in Customer"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['Cash', 'UPI', 'Card'] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors ${
                    paymentMethod === method
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 space-y-2">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Line Items</span>
              <span className="font-mono tabular-nums">{cart.length} products ({totalUnits} units)</span>
            </div>
            <div className="flex justify-between items-baseline pt-2">
              <span className="text-sm font-semibold text-slate-900">Grand Total</span>
              <span className="text-2xl font-bold font-mono tabular-nums text-blue-700">
                {formatCurrency(grandTotal)}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={cart.length === 0 || submitting}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Receipt className="w-4 h-4" />
            {submitting ? 'Processing Sale...' : 'Complete Sale & Generate Receipt'}
          </button>
        </form>
      </div>

      {/* Sales History Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Sales History</h2>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              {filteredSales.length} {filteredSales.length === 1 ? 'record' : 'records'} found
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Search receipt # or customer..."
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((r) => (
              <div key={r} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No matching sales found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                  <th className="text-left py-3 px-4">Receipt Number</th>
                  <th className="text-left py-3 px-4">Customer</th>
                  <th className="text-left py-3 px-4">Payment</th>
                  <th className="text-right py-3 px-4">Units</th>
                  <th className="text-right py-3 px-4">Total Amount</th>
                  <th className="text-left py-3 px-4">Date &amp; Time</th>
                  <th className="text-right py-3 px-4">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-blue-700 whitespace-nowrap">
                      {sale.receipt_number}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {sale.customer_name}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {sale.payment_method}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      {sale.item_count ?? '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                      {formatCurrency(sale.total_amount)}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {formatDateTime(sale.created_at)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onViewReceiptById(sale.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
                      >
                        <Receipt className="w-3.5 h-3.5 text-blue-600" />
                        View Receipt
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
  );
}
