import { FormEvent, useEffect, useState } from 'react';
import {
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { apiRequest } from '../api';
import { Supplier } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface SuppliersViewProps {
  onNotify: (type: 'success' | 'error', text: string) => void;
  onDataChanged: () => void;
}

interface SupplierFormState {
  name: string;
  phone: string;
  email: string;
  address: string;
}

const emptySupplierForm: SupplierFormState = {
  name: '',
  phone: '',
  email: '',
  address: '',
};

export function SuppliersView({ onNotify, onDataChanged }: SuppliersViewProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierFormState>(emptySupplierForm);
  const [submitting, setSubmitting] = useState(false);

  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadSuppliers() {
    setLoading(true);
    try {
      const data = await apiRequest<Supplier[]>('/api/suppliers');
      setSuppliers(data);
    } catch (err: unknown) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to load suppliers.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSuppliers();
  }, []);

  function openAddModal() {
    setEditingSupplier(null);
    setForm(emptySupplierForm);
    setModalOpen(true);
  }

  function openEditModal(supplier: Supplier) {
    setEditingSupplier(supplier);
    setForm({
      name: supplier.name,
      phone: supplier.phone,
      email: supplier.email || '',
      address: supplier.address,
    });
    setModalOpen(true);
  }

  async function handleSaveSupplier(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      onNotify('error', 'Supplier name is required.');
      return;
    }
    if (form.phone.trim().length < 7) {
      onNotify('error', 'Please enter a valid phone number.');
      return;
    }
    if (!form.address.trim()) {
      onNotify('error', 'Supplier address is required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
      };

      if (editingSupplier) {
        await apiRequest(`/api/suppliers/${editingSupplier.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        onNotify('success', `Updated supplier "${payload.name}".`);
      } else {
        await apiRequest('/api/suppliers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onNotify('success', `Added supplier "${payload.name}".`);
      }

      setModalOpen(false);
      await loadSuppliers();
      onDataChanged();
    } catch (err: unknown) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to save supplier.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!supplierToDelete) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/suppliers/${supplierToDelete.id}`, {
        method: 'DELETE',
      });
      onNotify('success', `Deleted supplier "${supplierToDelete.name}".`);
      setSupplierToDelete(null);
      await loadSuppliers();
      onDataChanged();
    } catch (err: unknown) {
      onNotify('error', err instanceof Error ? err.message : 'Failed to delete supplier.');
    } finally {
      setDeleting(false);
    }
  }

  const filteredSuppliers = suppliers.filter((s) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      s.phone.toLowerCase().includes(q) ||
      s.address.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search supplier name, phone, or city..."
            className="w-full pl-9 pr-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
          />
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Supplier
        </button>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Supplier Directory</h2>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              {filteredSuppliers.length} {filteredSuppliers.length === 1 ? 'supplier' : 'suppliers'} registered
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((row) => (
              <div key={row} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-slate-700">No suppliers found.</p>
            <button
              type="button"
              onClick={openAddModal}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Supplier
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
                  <th className="text-left py-3 px-4">Supplier Name</th>
                  <th className="text-left py-3 px-4">Phone Number</th>
                  <th className="text-left py-3 px-4">Address</th>
                  <th className="text-right py-3 px-4">Linked Products</th>
                  <th className="text-right py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-900">{supplier.name}</div>
                      {supplier.email && (
                        <div className="text-xs text-slate-500">{supplier.email}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-700 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {supplier.phone}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-xs">
                      <span className="inline-flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span>{supplier.address}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                      {supplier.product_count ?? 0}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(supplier)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setSupplierToDelete(supplier)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-white border border-slate-200 rounded-md hover:bg-red-50 hover:border-red-200"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Supplier Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[1px] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="supplier-modal-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 id="supplier-modal-title" className="text-base font-semibold text-slate-900">
                {editingSupplier ? 'Edit Supplier Details' : 'Add New Supplier'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Supplier Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Kaveri Wholesale Distributors"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="e.g. +91 98450 23140"
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="orders@supplier.com"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Address *
                </label>
                <textarea
                  rows={3}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Shop/Warehouse street address, city, PIN code"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 resize-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
                >
                  {submitting
                    ? 'Saving...'
                    : editingSupplier
                    ? 'Save Changes'
                    : 'Add Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog before deleting supplier */}
      <ConfirmModal
        isOpen={Boolean(supplierToDelete)}
        title="Delete Supplier"
        message={`Are you sure you want to delete "${supplierToDelete?.name}"? Products linked to this supplier will remain in the catalog as unassigned.`}
        confirmLabel="Delete Supplier"
        isLoading={deleting}
        onCancel={() => setSupplierToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
