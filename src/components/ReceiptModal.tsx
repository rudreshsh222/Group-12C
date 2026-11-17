import { Printer, Receipt, X } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../api';
import { Sale } from '../types';

interface ReceiptModalProps {
  sale: Sale | null;
  onClose: () => void;
}

export function ReceiptModal({ sale, onClose }: ReceiptModalProps) {
  if (!sale) return null;

  const items = sale.items || [];
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-[1px] p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-lg max-w-lg w-full overflow-hidden my-auto">
        {/* Modal Action Header (hidden during print) */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200 no-print">
          <div className="flex items-center gap-2.5">
            <Receipt className="w-5 h-5 text-blue-600" />
            <h3
              id="receipt-modal-title"
              className="text-base font-semibold text-slate-900"
            >
              Sales Receipt
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Receipt
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200/60 transition-colors"
              aria-label="Close receipt"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div id="printable-receipt" className="p-6 sm:p-8 bg-white text-slate-900">
          <div className="text-center pb-5 border-b border-dashed border-slate-300">
            <h4 className="text-lg font-bold tracking-tight text-slate-900">
              Digital Inventory &amp; Sales Store
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              Retail Counter &amp; Stock Management · Bengaluru, KA
            </p>
            <p className="text-xs font-mono text-slate-600 mt-2">
              Receipt No: <span className="font-semibold text-slate-900">{sale.receipt_number}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-y-2 gap-x-4 py-4 text-xs border-b border-dashed border-slate-300">
            <div>
              <span className="text-slate-500">Customer:</span>{' '}
              <span className="font-medium text-slate-900">{sale.customer_name}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500">Payment:</span>{' '}
              <span className="font-medium text-slate-900">{sale.payment_method}</span>
            </div>
            <div>
              <span className="text-slate-500">Cashier:</span>{' '}
              <span className="font-medium text-slate-900">{sale.sold_by_name}</span>
            </div>
            <div className="text-right tabular-nums">
              <span className="text-slate-500">Date:</span>{' '}
              <span className="font-medium text-slate-900">{formatDateTime(sale.created_at)}</span>
            </div>
          </div>

          <div className="py-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-medium">
                  <th className="text-left pb-2">Item</th>
                  <th className="text-right pb-2">Qty</th>
                  <th className="text-right pb-2">Price</th>
                  <th className="text-right pb-2">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2.5 pr-2">
                      <div className="font-medium text-slate-900">{item.product_name}</div>
                      <div className="font-mono text-[11px] text-slate-500">{item.sku}</div>
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-slate-700">
                      {item.quantity}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-slate-700">
                      {formatCurrency(item.unit_price)}
                    </td>
                    <td className="py-2.5 text-right font-mono tabular-nums font-medium text-slate-900">
                      {formatCurrency(item.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-4 border-t border-dashed border-slate-300 space-y-1.5">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Total Items ({items.length} products, {totalUnits} units)</span>
              <span className="font-mono tabular-nums">{formatCurrency(sale.total_amount)}</span>
            </div>
            <div className="flex justify-between items-baseline pt-2 border-t border-slate-200">
              <span className="text-sm font-bold text-slate-900">Grand Total</span>
              <span className="text-lg font-bold font-mono tabular-nums text-blue-700">
                {formatCurrency(sale.total_amount)}
              </span>
            </div>
          </div>

          <p className="text-center text-[11px] text-slate-500 mt-6 pt-4 border-t border-slate-100">
            Thank you for shopping with us. Inventory automatically updated.
          </p>
        </div>
      </div>
    </div>
  );
}
