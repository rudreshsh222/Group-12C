export interface User {
  id: number;
  username: string;
  full_name: string;
  role: string;
}

export interface Category {
  id: number;
  name: string;
  description: string;
  product_count?: number;
}

export interface Supplier {
  id: number;
  name: string;
  phone: string;
  address: string;
  email: string;
  product_count?: number;
  created_at: string;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  category_id: number;
  category_name: string;
  supplier_id: number | null;
  supplier_name: string | null;
  price: number;
  quantity: number;
  reorder_level: number;
  created_at: string;
  updated_at: string;
}

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Sale {
  id: number;
  receipt_number: string;
  customer_name: string;
  payment_method: string;
  total_amount: number;
  sold_by: number;
  sold_by_name: string;
  item_count?: number;
  created_at: string;
  items?: SaleItem[];
}

export interface StockTransaction {
  id: number;
  product_id: number;
  product_name: string;
  sku: string;
  transaction_type: 'PURCHASE' | 'SALE' | 'ADJUSTMENT';
  quantity_change: number;
  previous_quantity: number;
  new_quantity: number;
  reference_note: string;
  created_by_name: string;
  created_at: string;
}

export interface DashboardData {
  stats: {
    totalProducts: number;
    totalStockAvailable: number;
    totalSalesRevenue: number;
    totalSalesCount: number;
    lowStockCount: number;
    outOfStockCount: number;
    inventoryValue: number;
  };
  recentSales: Sale[];
  lowStockProducts: Product[];
  salesChart: Array<{
    date: string;
    label: string;
    revenue: number;
    orders: number;
  }>;
  categoryBreakdown: Array<{
    name: string;
    stock: number;
    value: number;
    productCount: number;
  }>;
}

export interface ReportsData {
  date: string;
  month: string;
  dailySummary: {
    totalRevenue: number;
    totalOrders: number;
    unitsSold: number;
    sales: Sale[];
  };
  monthlySummary: {
    totalRevenue: number;
    totalOrders: number;
    dailyBreakdown: Array<{
      day: string;
      revenue: number;
      orders: number;
    }>;
  };
  overallRevenue: number;
  bestSellingProducts: Array<{
    product_id: number;
    sku: string;
    name: string;
    category_name: string;
    units_sold: number;
    total_revenue: number;
    current_stock: number;
  }>;
  stockReport: Array<Product & { stock_value: number; status: 'In Stock' | 'Low Stock' | 'Out of Stock' }>;
}
