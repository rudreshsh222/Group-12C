import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import db, { initializeDatabase, verifyPassword } from './src/db/database.ts';

dotenv.config();

// Initialize SQLite tables and seed initial sample data
initializeDatabase();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const TOKEN_SECRET = process.env.SESSION_SECRET || 'vtu-inventory-dev-secret-key-2026';

app.use(express.json());

// Extended Express Request carrying authenticated user info
interface AuthUser {
  id: number;
  username: string;
  full_name: string;
  role: string;
}

interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

/**
 * Create a signed HMAC-SHA256 bearer token for stateless session authentication
 */
function signToken(payload: AuthUser): string {
  const data = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + 1000 * 60 * 60 * 24 })
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(data)
    .digest('base64url');
  return `${data}.${signature}`;
}

function verifyToken(token: string): AuthUser | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(data)
    .digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    return {
      id: parsed.id,
      username: parsed.username,
      full_name: parsed.full_name,
      role: parsed.role,
    };
  } catch {
    return null;
  }
}

/**
 * Middleware to protect API routes
 */
function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }
  const user = verifyToken(token);
  if (!user) {
    res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
    return;
  }
  req.user = user;
  next();
}

/**
 * Helper: format local YYYY-MM-DD HH:MM:SS timestamp
 */
function getLocalTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function getLocalDateString(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ============================================================================
// 1. AUTHENTICATION ROUTES
// ============================================================================

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body ?? {};

  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Username and password are required.' });
    return;
  }

  const userRow = db
    .prepare('SELECT id, username, password_hash, full_name, role FROM Users WHERE username = ?')
    .get(username.trim()) as
    | { id: number; username: string; password_hash: string; full_name: string; role: string }
    | undefined;

  if (!userRow || !verifyPassword(password, userRow.password_hash)) {
    res.status(401).json({ error: 'Invalid username or password.' });
    return;
  }

  const user: AuthUser = {
    id: userRow.id,
    username: userRow.username,
    full_name: userRow.full_name,
    role: userRow.role,
  };

  const token = signToken(user);
  res.json({ token, user });
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

app.post('/api/auth/logout', (_req: Request, res: Response) => {
  res.json({ message: 'Logged out successfully.' });
});

// ============================================================================
// 2. DASHBOARD SUMMARY ROUTE
// ============================================================================

app.get('/api/dashboard', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const productStats = db
    .prepare(`
      SELECT
        COUNT(*) AS totalProducts,
        COALESCE(SUM(quantity), 0) AS totalStockAvailable,
        COALESCE(SUM(price * quantity), 0) AS inventoryValue,
        SUM(CASE WHEN quantity > 0 AND quantity <= reorder_level THEN 1 ELSE 0 END) AS lowStockCount,
        SUM(CASE WHEN quantity = 0 THEN 1 ELSE 0 END) AS outOfStockCount
      FROM Products
    `)
    .get() as {
      totalProducts: number;
      totalStockAvailable: number;
      inventoryValue: number;
      lowStockCount: number;
      outOfStockCount: number;
    };

  const salesStats = db
    .prepare(`
      SELECT
        COUNT(*) AS totalSalesCount,
        COALESCE(SUM(total_amount), 0) AS totalSalesRevenue
      FROM Sales
    `)
    .get() as { totalSalesCount: number; totalSalesRevenue: number };

  const recentSales = db
    .prepare(`
      SELECT
        s.*,
        u.full_name AS sold_by_name,
        (SELECT COALESCE(SUM(si.quantity), 0) FROM Sale_Items si WHERE si.sale_id = s.id) AS item_count
      FROM Sales s
      JOIN Users u ON u.id = s.sold_by
      ORDER BY s.created_at DESC, s.id DESC
      LIMIT 6
    `)
    .all();

  const lowStockProducts = db
    .prepare(`
      SELECT p.*, c.name AS category_name, sup.name AS supplier_name
      FROM Products p
      JOIN Categories c ON c.id = p.category_id
      LEFT JOIN Suppliers sup ON sup.id = p.supplier_id
      WHERE p.quantity <= p.reorder_level
      ORDER BY p.quantity ASC, p.name ASC
    `)
    .all();

  // Build 14-day sales chart timeline
  const salesByDayRaw = db
    .prepare(`
      SELECT
        substr(created_at, 1, 10) AS date,
        COALESCE(SUM(total_amount), 0) AS revenue,
        COUNT(*) AS orders
      FROM Sales
      WHERE substr(created_at, 1, 10) >= date('now', 'localtime', '-13 days')
      GROUP BY substr(created_at, 1, 10)
    `)
    .all() as Array<{ date: string; revenue: number; orders: number }>;

  const salesMap = new Map(salesByDayRaw.map((row) => [row.date, row]));
  const salesChart: Array<{ date: string; label: string; revenue: number; orders: number }> = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const pad = (n: number) => String(n).padStart(2, '0');
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    const entry = salesMap.get(iso);
    salesChart.push({
      date: iso,
      label,
      revenue: entry ? entry.revenue : 0,
      orders: entry ? entry.orders : 0,
    });
  }

  const categoryBreakdown = db
    .prepare(`
      SELECT
        c.name,
        COALESCE(SUM(p.quantity), 0) AS stock,
        COALESCE(SUM(p.price * p.quantity), 0) AS value,
        COUNT(p.id) AS productCount
      FROM Categories c
      LEFT JOIN Products p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY value DESC
    `)
    .all();

  res.json({
    stats: {
      totalProducts: productStats.totalProducts || 0,
      totalStockAvailable: productStats.totalStockAvailable || 0,
      inventoryValue: productStats.inventoryValue || 0,
      lowStockCount: productStats.lowStockCount || 0,
      outOfStockCount: productStats.outOfStockCount || 0,
      totalSalesCount: salesStats.totalSalesCount || 0,
      totalSalesRevenue: salesStats.totalSalesRevenue || 0,
    },
    recentSales,
    lowStockProducts,
    salesChart,
    categoryBreakdown,
  });
});

// ============================================================================
// 3. CATEGORY ROUTES
// ============================================================================

app.get('/api/categories', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const categories = db
    .prepare(`
      SELECT c.*, COUNT(p.id) AS product_count
      FROM Categories c
      LEFT JOIN Products p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name ASC
    `)
    .all();
  res.json(categories);
});

app.post('/api/categories', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { name, description } = req.body ?? {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Category name is required.' });
    return;
  }

  try {
    const result = db
      .prepare('INSERT INTO Categories (name, description) VALUES (?, ?)')
      .run(name.trim(), (description ?? '').toString().trim());
    const created = db
      .prepare('SELECT * FROM Categories WHERE id = ?')
      .get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      res.status(409).json({ error: 'A category with this name already exists.' });
      return;
    }
    res.status(500).json({ error: 'Failed to create category.' });
  }
});

// ============================================================================
// 4. PRODUCT MANAGEMENT ROUTES
// ============================================================================

app.get('/api/products', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId.trim() : '';
  const stockStatus = typeof req.query.stockStatus === 'string' ? req.query.stockStatus.trim() : '';

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (search) {
    conditions.push('(p.name LIKE ? OR p.sku LIKE ? OR c.name LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  if (categoryId && categoryId !== 'all') {
    conditions.push('p.category_id = ?');
    params.push(Number(categoryId));
  }

  if (stockStatus === 'out') {
    conditions.push('p.quantity = 0');
  } else if (stockStatus === 'low') {
    conditions.push('p.quantity > 0 AND p.quantity <= p.reorder_level');
  } else if (stockStatus === 'in') {
    conditions.push('p.quantity > p.reorder_level');
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const products = db
    .prepare(`
      SELECT
        p.*,
        c.name AS category_name,
        s.name AS supplier_name
      FROM Products p
      JOIN Categories c ON c.id = p.category_id
      LEFT JOIN Suppliers s ON s.id = p.supplier_id
      ${whereClause}
      ORDER BY p.id DESC
    `)
    .all(...params);

  res.json(products);
});

app.post('/api/products', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { sku, name, category_id, supplier_id, price, quantity, reorder_level } = req.body ?? {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Product name is required.' });
    return;
  }

  const parsedCategory = Number(category_id);
  const parsedPrice = Number(price);
  const parsedQty = Number(quantity ?? 0);
  const parsedReorder = Number(reorder_level ?? 10);
  const parsedSupplier = supplier_id ? Number(supplier_id) : null;

  if (!Number.isInteger(parsedCategory) || parsedCategory <= 0) {
    res.status(400).json({ error: 'Please select a valid category.' });
    return;
  }
  if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
    res.status(400).json({ error: 'Price must be a valid non-negative number.' });
    return;
  }
  if (!Number.isInteger(parsedQty) || parsedQty < 0) {
    res.status(400).json({ error: 'Quantity must be a whole number (0 or greater).' });
    return;
  }
  if (!Number.isInteger(parsedReorder) || parsedReorder < 0) {
    res.status(400).json({ error: 'Reorder level must be a whole number (0 or greater).' });
    return;
  }

  const finalSku =
    sku && typeof sku === 'string' && sku.trim()
      ? sku.trim().toUpperCase()
      : `PRD-${Math.floor(1000 + Math.random() * 9000)}`;

  try {
    const createTx = db.transaction(() => {
      const now = getLocalTimestamp();
      const result = db
        .prepare(`
          INSERT INTO Products (sku, name, category_id, supplier_id, price, quantity, reorder_level, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(finalSku, name.trim(), parsedCategory, parsedSupplier, parsedPrice, parsedQty, parsedReorder, now, now);

      const newProductId = Number(result.lastInsertRowid);

      if (parsedQty > 0) {
        db.prepare(`
          INSERT INTO Stock_Transactions
          (product_id, transaction_type, quantity_change, previous_quantity, new_quantity, reference_note, created_by, created_at)
          VALUES (?, 'PURCHASE', ?, 0, ?, 'Initial stock added on product creation', ?, ?)
        `).run(newProductId, parsedQty, parsedQty, req.user!.id, now);
      }

      return db
        .prepare(`
          SELECT p.*, c.name AS category_name, s.name AS supplier_name
          FROM Products p
          JOIN Categories c ON c.id = p.category_id
          LEFT JOIN Suppliers s ON s.id = p.supplier_id
          WHERE p.id = ?
        `)
        .get(newProductId);
    });

    const created = createTx();
    res.status(201).json(created);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      res.status(409).json({ error: `Product ID / SKU "${finalSku}" already exists.` });
      return;
    }
    res.status(500).json({ error: 'Failed to add product.' });
  }
});

app.put('/api/products/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const productId = Number(req.params.id);
  const { sku, name, category_id, supplier_id, price, quantity, reorder_level } = req.body ?? {};

  if (!Number.isInteger(productId) || productId <= 0) {
    res.status(400).json({ error: 'Invalid product ID.' });
    return;
  }

  const existing = db.prepare('SELECT * FROM Products WHERE id = ?').get(productId) as
    | { id: number; quantity: number; sku: string }
    | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Product name is required.' });
    return;
  }

  const parsedCategory = Number(category_id);
  const parsedPrice = Number(price);
  const parsedQty = Number(quantity);
  const parsedReorder = Number(reorder_level ?? 10);
  const parsedSupplier = supplier_id ? Number(supplier_id) : null;
  const finalSku = sku && typeof sku === 'string' && sku.trim() ? sku.trim().toUpperCase() : existing.sku;

  if (!Number.isInteger(parsedCategory) || parsedCategory <= 0) {
    res.status(400).json({ error: 'Please select a valid category.' });
    return;
  }
  if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
    res.status(400).json({ error: 'Price must be a valid non-negative number.' });
    return;
  }
  if (!Number.isInteger(parsedQty) || parsedQty < 0) {
    res.status(400).json({ error: 'Quantity must be a whole number (0 or greater).' });
    return;
  }
  if (!Number.isInteger(parsedReorder) || parsedReorder < 0) {
    res.status(400).json({ error: 'Reorder level must be a whole number (0 or greater).' });
    return;
  }

  try {
    const updateTx = db.transaction(() => {
      const now = getLocalTimestamp();
      db.prepare(`
        UPDATE Products
        SET sku = ?, name = ?, category_id = ?, supplier_id = ?, price = ?, quantity = ?, reorder_level = ?, updated_at = ?
        WHERE id = ?
      `).run(finalSku, name.trim(), parsedCategory, parsedSupplier, parsedPrice, parsedQty, parsedReorder, now, productId);

      // Log an ADJUSTMENT entry if stock quantity was edited manually
      const delta = parsedQty - existing.quantity;
      if (delta !== 0) {
        db.prepare(`
          INSERT INTO Stock_Transactions
          (product_id, transaction_type, quantity_change, previous_quantity, new_quantity, reference_note, created_by, created_at)
          VALUES (?, 'ADJUSTMENT', ?, ?, ?, 'Manual stock edit via Product Management', ?, ?)
        `).run(productId, delta, existing.quantity, parsedQty, req.user!.id, now);
      }

      return db
        .prepare(`
          SELECT p.*, c.name AS category_name, s.name AS supplier_name
          FROM Products p
          JOIN Categories c ON c.id = p.category_id
          LEFT JOIN Suppliers s ON s.id = p.supplier_id
          WHERE p.id = ?
        `)
        .get(productId);
    });

    const updated = updateTx();
    res.json(updated);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      res.status(409).json({ error: `Product ID / SKU "${finalSku}" is already used by another product.` });
      return;
    }
    res.status(500).json({ error: 'Failed to update product.' });
  }
});

app.delete('/api/products/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const productId = Number(req.params.id);
  if (!Number.isInteger(productId) || productId <= 0) {
    res.status(400).json({ error: 'Invalid product ID.' });
    return;
  }

  const saleUsage = db
    .prepare('SELECT COUNT(*) AS count FROM Sale_Items WHERE product_id = ?')
    .get(productId) as { count: number };

  if (saleUsage.count > 0) {
    res.status(409).json({
      error: 'Cannot delete this product because it appears in existing sales receipts. You can set its stock to 0 instead.',
    });
    return;
  }

  const result = db.prepare('DELETE FROM Products WHERE id = ?').run(productId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  res.json({ message: 'Product deleted successfully.' });
});

// ============================================================================
// 5. INVENTORY & RESTOCK ROUTES
// ============================================================================

app.get('/api/inventory/transactions', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const transactions = db
    .prepare(`
      SELECT
        st.*,
        p.name AS product_name,
        p.sku AS sku,
        u.full_name AS created_by_name
      FROM Stock_Transactions st
      JOIN Products p ON p.id = st.product_id
      JOIN Users u ON u.id = st.created_by
      ORDER BY st.created_at DESC, st.id DESC
      LIMIT 100
    `)
    .all();
  res.json(transactions);
});

app.post('/api/inventory/restock', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { product_id, quantity, reference_note } = req.body ?? {};
  const parsedProductId = Number(product_id);
  const parsedQty = Number(quantity);

  if (!Number.isInteger(parsedProductId) || parsedProductId <= 0) {
    res.status(400).json({ error: 'Please select a valid product.' });
    return;
  }
  if (!Number.isInteger(parsedQty) || parsedQty <= 0) {
    res.status(400).json({ error: 'Restock quantity must be a positive whole number.' });
    return;
  }

  try {
    const restockTx = db.transaction(() => {
      const product = db
        .prepare('SELECT id, name, quantity FROM Products WHERE id = ?')
        .get(parsedProductId) as { id: number; name: string; quantity: number } | undefined;

      if (!product) {
        throw new Error('NOT_FOUND');
      }

      const previousQty = product.quantity;
      const newQty = previousQty + parsedQty;
      const now = getLocalTimestamp();

      db.prepare('UPDATE Products SET quantity = ?, updated_at = ? WHERE id = ?').run(
        newQty,
        now,
        parsedProductId
      );

      db.prepare(`
        INSERT INTO Stock_Transactions
        (product_id, transaction_type, quantity_change, previous_quantity, new_quantity, reference_note, created_by, created_at)
        VALUES (?, 'PURCHASE', ?, ?, ?, ?, ?, ?)
      `).run(
        parsedProductId,
        parsedQty,
        previousQty,
        newQty,
        (reference_note ?? 'Stock purchase / restock').toString().trim() || 'Stock purchase / restock',
        req.user!.id,
        now
      );

      return db
        .prepare(`
          SELECT p.*, c.name AS category_name, s.name AS supplier_name
          FROM Products p
          JOIN Categories c ON c.id = p.category_id
          LEFT JOIN Suppliers s ON s.id = p.supplier_id
          WHERE p.id = ?
        `)
        .get(parsedProductId);
    });

    const updatedProduct = restockTx();
    res.json({
      message: 'Stock updated successfully.',
      product: updatedProduct,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'NOT_FOUND') {
      res.status(404).json({ error: 'Selected product was not found.' });
      return;
    }
    res.status(500).json({ error: 'Failed to restock product.' });
  }
});

// ============================================================================
// 6. SALES & BILLING ROUTES
// ============================================================================

app.get('/api/sales', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const sales = db
    .prepare(`
      SELECT
        s.*,
        u.full_name AS sold_by_name,
        (SELECT COALESCE(SUM(si.quantity), 0) FROM Sale_Items si WHERE si.sale_id = s.id) AS item_count
      FROM Sales s
      JOIN Users u ON u.id = s.sold_by
      ORDER BY s.created_at DESC, s.id DESC
    `)
    .all();
  res.json(sales);
});

app.get('/api/sales/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const saleId = Number(req.params.id);
  if (!Number.isInteger(saleId) || saleId <= 0) {
    res.status(400).json({ error: 'Invalid sale ID.' });
    return;
  }

  const sale = db
    .prepare(`
      SELECT s.*, u.full_name AS sold_by_name
      FROM Sales s
      JOIN Users u ON u.id = s.sold_by
      WHERE s.id = ?
    `)
    .get(saleId) as Record<string, unknown> | undefined;

  if (!sale) {
    res.status(404).json({ error: 'Sale receipt not found.' });
    return;
  }

  const items = db
    .prepare(`
      SELECT
        si.*,
        p.name AS product_name,
        p.sku AS sku
      FROM Sale_Items si
      JOIN Products p ON p.id = si.product_id
      WHERE si.sale_id = ?
      ORDER BY si.id ASC
    `)
    .all(saleId);

  res.json({ ...sale, items });
});

app.post('/api/sales', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { customer_name, payment_method, items } = req.body ?? {};

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Please add at least one product to the sale.' });
    return;
  }

  const cleanCustomer =
    typeof customer_name === 'string' && customer_name.trim()
      ? customer_name.trim()
      : 'Walk-in Customer';
  const allowedMethods = ['Cash', 'UPI', 'Card'];
  const cleanMethod = allowedMethods.includes(payment_method) ? payment_method : 'Cash';

  // Aggregate duplicate product rows if sent twice
  const mergedItemsMap = new Map<number, number>();
  for (const raw of items) {
    const pid = Number(raw?.product_id);
    const qty = Number(raw?.quantity);
    if (!Number.isInteger(pid) || pid <= 0 || !Number.isInteger(qty) || qty <= 0) {
      res.status(400).json({ error: 'Every sale item must have a valid product and quantity greater than 0.' });
      return;
    }
    mergedItemsMap.set(pid, (mergedItemsMap.get(pid) ?? 0) + qty);
  }

  try {
    const createSaleTx = db.transaction(() => {
      const now = getLocalTimestamp();
      let grandTotal = 0;

      const validatedItems: Array<{
        product_id: number;
        name: string;
        unit_price: number;
        quantity: number;
        previous_qty: number;
        new_qty: number;
        subtotal: number;
      }> = [];

      for (const [productId, requestedQty] of mergedItemsMap.entries()) {
        const product = db
          .prepare('SELECT id, name, price, quantity FROM Products WHERE id = ?')
          .get(productId) as { id: number; name: string; price: number; quantity: number } | undefined;

        if (!product) {
          throw new Error(`Product #${productId} no longer exists.`);
        }

        // Prevent selling more than available stock
        if (requestedQty > product.quantity) {
          throw new Error(
            `Insufficient stock for "${product.name}". Available: ${product.quantity}, Requested: ${requestedQty}.`
          );
        }

        const subtotal = Number((product.price * requestedQty).toFixed(2));
        grandTotal = Number((grandTotal + subtotal).toFixed(2));
        validatedItems.push({
          product_id: product.id,
          name: product.name,
          unit_price: product.price,
          quantity: requestedQty,
          previous_qty: product.quantity,
          new_qty: product.quantity - requestedQty,
          subtotal,
        });
      }

      // Generate unique human-readable receipt number
      const countRow = db.prepare('SELECT COUNT(*) AS count FROM Sales').get() as { count: number };
      const seq = String(countRow.count + 1).padStart(4, '0');
      const receiptNumber = `INV-${new Date().getFullYear()}-${seq}-${Math.floor(10 + Math.random() * 89)}`;

      const saleResult = db
        .prepare(`
          INSERT INTO Sales (receipt_number, customer_name, payment_method, total_amount, sold_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .run(receiptNumber, cleanCustomer, cleanMethod, grandTotal, req.user!.id, now);

      const saleId = Number(saleResult.lastInsertRowid);

      const insertSaleItem = db.prepare(`
        INSERT INTO Sale_Items (sale_id, product_id, quantity, unit_price, subtotal)
        VALUES (?, ?, ?, ?, ?)
      `);
      const updateStock = db.prepare(
        'UPDATE Products SET quantity = ?, updated_at = ? WHERE id = ?'
      );
      const insertStockTx = db.prepare(`
        INSERT INTO Stock_Transactions
        (product_id, transaction_type, quantity_change, previous_quantity, new_quantity, reference_note, created_by, created_at)
        VALUES (?, 'SALE', ?, ?, ?, ?, ?, ?)
      `);

      for (const item of validatedItems) {
        insertSaleItem.run(saleId, item.product_id, item.quantity, item.unit_price, item.subtotal);
        updateStock.run(item.new_qty, now, item.product_id);
        insertStockTx.run(
          item.product_id,
          -item.quantity,
          item.previous_qty,
          item.new_qty,
          `Sale ${receiptNumber}`,
          req.user!.id,
          now
        );
      }

      const saleHeader = db
        .prepare(`
          SELECT s.*, u.full_name AS sold_by_name
          FROM Sales s
          JOIN Users u ON u.id = s.sold_by
          WHERE s.id = ?
        `)
        .get(saleId) as Record<string, unknown>;

      const saleItems = db
        .prepare(`
          SELECT si.*, p.name AS product_name, p.sku AS sku
          FROM Sale_Items si
          JOIN Products p ON p.id = si.product_id
          WHERE si.sale_id = ?
        `)
        .all(saleId);

      return { ...saleHeader, items: saleItems };
    });

    const receipt = createSaleTx();
    res.status(201).json(receipt);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to complete sale.';
    res.status(400).json({ error: message });
  }
});

// ============================================================================
// 7. SUPPLIER MANAGEMENT ROUTES
// ============================================================================

app.get('/api/suppliers', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const suppliers = db
    .prepare(`
      SELECT s.*, COUNT(p.id) AS product_count
      FROM Suppliers s
      LEFT JOIN Products p ON p.supplier_id = s.id
      GROUP BY s.id
      ORDER BY s.id DESC
    `)
    .all();
  res.json(suppliers);
});

app.post('/api/suppliers', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { name, phone, address, email } = req.body ?? {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Supplier name is required.' });
    return;
  }
  if (!phone || typeof phone !== 'string' || phone.trim().length < 7) {
    res.status(400).json({ error: 'Valid supplier phone number is required.' });
    return;
  }
  if (!address || typeof address !== 'string' || !address.trim()) {
    res.status(400).json({ error: 'Supplier address is required.' });
    return;
  }

  const result = db
    .prepare('INSERT INTO Suppliers (name, phone, address, email, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(
      name.trim(),
      phone.trim(),
      address.trim(),
      (email ?? '').toString().trim(),
      getLocalTimestamp()
    );

  const created = db
    .prepare('SELECT *, 0 AS product_count FROM Suppliers WHERE id = ?')
    .get(result.lastInsertRowid);
  res.status(201).json(created);
});

app.put('/api/suppliers/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const supplierId = Number(req.params.id);
  const { name, phone, address, email } = req.body ?? {};

  if (!Number.isInteger(supplierId) || supplierId <= 0) {
    res.status(400).json({ error: 'Invalid supplier ID.' });
    return;
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Supplier name is required.' });
    return;
  }
  if (!phone || typeof phone !== 'string' || phone.trim().length < 7) {
    res.status(400).json({ error: 'Valid supplier phone number is required.' });
    return;
  }
  if (!address || typeof address !== 'string' || !address.trim()) {
    res.status(400).json({ error: 'Supplier address is required.' });
    return;
  }

  const result = db
    .prepare('UPDATE Suppliers SET name = ?, phone = ?, address = ?, email = ? WHERE id = ?')
    .run(name.trim(), phone.trim(), address.trim(), (email ?? '').toString().trim(), supplierId);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Supplier not found.' });
    return;
  }

  const updated = db
    .prepare(`
      SELECT s.*, COUNT(p.id) AS product_count
      FROM Suppliers s
      LEFT JOIN Products p ON p.supplier_id = s.id
      WHERE s.id = ?
      GROUP BY s.id
    `)
    .get(supplierId);
  res.json(updated);
});

app.delete('/api/suppliers/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const supplierId = Number(req.params.id);
  if (!Number.isInteger(supplierId) || supplierId <= 0) {
    res.status(400).json({ error: 'Invalid supplier ID.' });
    return;
  }

  const result = db.prepare('DELETE FROM Suppliers WHERE id = ?').run(supplierId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Supplier not found.' });
    return;
  }
  res.json({ message: 'Supplier deleted successfully.' });
});

// ============================================================================
// 8. REPORTS & CSV EXPORT ROUTES
// ============================================================================

function buildReportsPayload(dateParam: string, monthParam: string) {
  // Daily sales report
  const dailySales = db
    .prepare(`
      SELECT
        s.*,
        u.full_name AS sold_by_name,
        (SELECT COALESCE(SUM(si.quantity), 0) FROM Sale_Items si WHERE si.sale_id = s.id) AS item_count
      FROM Sales s
      JOIN Users u ON u.id = s.sold_by
      WHERE substr(s.created_at, 1, 10) = ?
      ORDER BY s.created_at DESC
    `)
    .all(dateParam) as Array<{ total_amount: number; item_count: number }>;

  const dailySummary = {
    totalRevenue: dailySales.reduce((sum, s) => sum + s.total_amount, 0),
    totalOrders: dailySales.length,
    unitsSold: dailySales.reduce((sum, s) => sum + (s.item_count || 0), 0),
    sales: dailySales,
  };

  // Monthly sales report
  const monthlyStats = db
    .prepare(`
      SELECT
        COALESCE(SUM(total_amount), 0) AS totalRevenue,
        COUNT(*) AS totalOrders
      FROM Sales
      WHERE substr(created_at, 1, 7) = ?
    `)
    .get(monthParam) as { totalRevenue: number; totalOrders: number };

  const monthlyBreakdown = db
    .prepare(`
      SELECT
        substr(created_at, 1, 10) AS day,
        COALESCE(SUM(total_amount), 0) AS revenue,
        COUNT(*) AS orders
      FROM Sales
      WHERE substr(created_at, 1, 7) = ?
      GROUP BY substr(created_at, 1, 10)
      ORDER BY day ASC
    `)
    .all(monthParam);

  // Overall total revenue
  const overallRow = db
    .prepare('SELECT COALESCE(SUM(total_amount), 0) AS total FROM Sales')
    .get() as { total: number };

  // Best-selling products
  const bestSellingProducts = db
    .prepare(`
      SELECT
        p.id AS product_id,
        p.sku,
        p.name,
        c.name AS category_name,
        COALESCE(SUM(si.quantity), 0) AS units_sold,
        COALESCE(SUM(si.subtotal), 0) AS total_revenue,
        p.quantity AS current_stock
      FROM Products p
      JOIN Categories c ON c.id = p.category_id
      LEFT JOIN Sale_Items si ON si.product_id = p.id
      GROUP BY p.id
      HAVING units_sold > 0
      ORDER BY units_sold DESC, total_revenue DESC
    `)
    .all();

  // Full Stock Report
  const stockRaw = db
    .prepare(`
      SELECT
        p.*,
        c.name AS category_name,
        s.name AS supplier_name
      FROM Products p
      JOIN Categories c ON c.id = p.category_id
      LEFT JOIN Suppliers s ON s.id = p.supplier_id
      ORDER BY p.quantity ASC, p.name ASC
    `)
    .all() as Array<{
      id: number;
      sku: string;
      name: string;
      category_name: string;
      supplier_name: string | null;
      price: number;
      quantity: number;
      reorder_level: number;
    }>;

  const stockReport = stockRaw.map((p) => ({
    ...p,
    stock_value: Number((p.price * p.quantity).toFixed(2)),
    status: p.quantity === 0 ? 'Out of Stock' : p.quantity <= p.reorder_level ? 'Low Stock' : 'In Stock',
  }));

  return {
    date: dateParam,
    month: monthParam,
    dailySummary,
    monthlySummary: {
      totalRevenue: monthlyStats.totalRevenue || 0,
      totalOrders: monthlyStats.totalOrders || 0,
      dailyBreakdown: monthlyBreakdown,
    },
    overallRevenue: overallRow.total || 0,
    bestSellingProducts,
    stockReport,
  };
}

app.get('/api/reports', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const today = getLocalDateString();
  const dateParam =
    typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
      ? req.query.date
      : today;
  const monthParam =
    typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month)
      ? req.query.month
      : today.slice(0, 7);

  res.json(buildReportsPayload(dateParam, monthParam));
});

function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ].join('\n');
}

app.get('/api/reports/export', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const today = getLocalDateString();
  const type = typeof req.query.type === 'string' ? req.query.type : 'stock';
  const dateParam =
    typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
      ? req.query.date
      : today;
  const monthParam =
    typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month)
      ? req.query.month
      : today.slice(0, 7);

  const report = buildReportsPayload(dateParam, monthParam);
  let csv = '';
  let filename = 'report.csv';

  if (type === 'daily') {
    filename = `daily-sales-report-${dateParam}.csv`;
    csv = toCsv(
      ['Receipt Number', 'Customer', 'Payment Method', 'Items', 'Total Amount (INR)', 'Sold By', 'Date & Time'],
      (report.dailySummary.sales as Array<Record<string, unknown>>).map((s) => [
        s.receipt_number,
        s.customer_name,
        s.payment_method,
        s.item_count,
        s.total_amount,
        s.sold_by_name,
        s.created_at,
      ])
    );
  } else if (type === 'monthly') {
    filename = `monthly-sales-report-${monthParam}.csv`;
    csv = toCsv(
      ['Date', 'Total Orders', 'Total Revenue (INR)'],
      (report.monthlySummary.dailyBreakdown as Array<Record<string, unknown>>).map((d) => [
        d.day,
        d.orders,
        d.revenue,
      ])
    );
  } else if (type === 'bestsellers') {
    filename = `best-selling-products-${today}.csv`;
    csv = toCsv(
      ['Product ID', 'Product Name', 'Category', 'Units Sold', 'Total Revenue (INR)', 'Current Stock'],
      (report.bestSellingProducts as Array<Record<string, unknown>>).map((b) => [
        b.sku,
        b.name,
        b.category_name,
        b.units_sold,
        b.total_revenue,
        b.current_stock,
      ])
    );
  } else {
    filename = `stock-report-${today}.csv`;
    csv = toCsv(
      ['Product ID', 'Product Name', 'Category', 'Supplier', 'Unit Price (INR)', 'Available Qty', 'Reorder Level', 'Stock Value (INR)', 'Status'],
      report.stockReport.map((p) => [
        p.sku,
        p.name,
        p.category_name,
        p.supplier_name || 'Unassigned',
        p.price,
        p.quantity,
        p.reorder_level,
        p.stock_value,
        p.status,
      ])
    );
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

// ============================================================================
// 9. VITE FRONTEND & PRODUCTION STATIC SERVING
// ============================================================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Digital Inventory & Sales Management System running on http://localhost:${PORT}`);
  });
}

startServer();
