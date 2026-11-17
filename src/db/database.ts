import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';

/**
 * Digital Inventory & Sales Management System
 * Database Initialization & Seeding Module (SQLite via better-sqlite3)
 *
 * Tables implemented with relational foreign keys:
 * 1. Users
 * 2. Categories
 * 3. Suppliers
 * 4. Products
 * 5. Sales
 * 6. Sale_Items
 * 7. Stock_Transactions
 */

const DB_PATH = path.resolve(process.cwd(), 'inventory.db');
const db = new Database(DB_PATH);

// Enable WAL mode for reliable concurrent reads and strict Foreign Key enforcement
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Hash a plain-text password with a random salt using scrypt
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

/**
 * Verify a plain-text password against a stored "salt:hash" string
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const derivedKey = crypto.scryptSync(password, salt, 64);
  const keyBuffer = Buffer.from(key, 'hex');
  if (derivedKey.length !== keyBuffer.length) return false;
  return crypto.timingSafeEqual(derivedKey, keyBuffer);
}

/**
 * Create all 7 database tables if they do not already exist
 */
export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS Users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS Categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS Suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      email TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS Products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      supplier_id INTEGER,
      price REAL NOT NULL CHECK (price >= 0),
      quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
      reorder_level INTEGER NOT NULL DEFAULT 10 CHECK (reorder_level >= 0),
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (category_id) REFERENCES Categories(id) ON DELETE RESTRICT,
      FOREIGN KEY (supplier_id) REFERENCES Suppliers(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS Sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_number TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL DEFAULT 'Walk-in Customer',
      payment_method TEXT NOT NULL DEFAULT 'Cash',
      total_amount REAL NOT NULL CHECK (total_amount >= 0),
      sold_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (sold_by) REFERENCES Users(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS Sale_Items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price REAL NOT NULL CHECK (unit_price >= 0),
      subtotal REAL NOT NULL CHECK (subtotal >= 0),
      FOREIGN KEY (sale_id) REFERENCES Sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES Products(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS Stock_Transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      transaction_type TEXT NOT NULL CHECK (transaction_type IN ('PURCHASE', 'SALE', 'ADJUSTMENT')),
      quantity_change INTEGER NOT NULL,
      previous_quantity INTEGER NOT NULL,
      new_quantity INTEGER NOT NULL,
      reference_note TEXT DEFAULT '',
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (product_id) REFERENCES Products(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES Users(id) ON DELETE RESTRICT
    );
  `);

  seedInitialData();
}

/**
 * Populate sample data only if the Users table is empty
 */
function seedInitialData(): void {
  const userCount = db.prepare('SELECT COUNT(*) AS count FROM Users').get() as { count: number };
  if (userCount.count > 0) return;

  const seedTransaction = db.transaction(() => {
    // 1. Seed Admin & Staff Users
    const insertUser = db.prepare(
      'INSERT INTO Users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)'
    );
    const adminRes = insertUser.run('admin', hashPassword('admin123'), 'Shop Administrator', 'admin');
    insertUser.run('staff', hashPassword('staff123'), 'Counter Staff', 'staff');
    const adminId = Number(adminRes.lastInsertRowid);

    // 2. Seed Categories
    const insertCategory = db.prepare(
      'INSERT INTO Categories (name, description) VALUES (?, ?)'
    );
    const catElectronics = Number(insertCategory.run('Electronics', 'Cables, chargers, batteries, and small peripherals').lastInsertRowid);
    const catStationery = Number(insertCategory.run('Stationery', 'Notebooks, pens, markers, and office supplies').lastInsertRowid);
    const catGrocery = Number(insertCategory.run('Grocery & Staples', 'Daily essentials, grains, cooking oils, and packaged staples').lastInsertRowid);
    const catBeverages = Number(insertCategory.run('Beverages & Snacks', 'Bottled drinks, tea, coffee, and packaged snacks').lastInsertRowid);
    const catHardware = Number(insertCategory.run('Home & Hardware', 'LED bulbs, extension cords, tapes, and household tools').lastInsertRowid);

    // 3. Seed Suppliers
    const insertSupplier = db.prepare(
      'INSERT INTO Suppliers (name, phone, address, email) VALUES (?, ?, ?, ?)'
    );
    const sup1 = Number(insertSupplier.run(
      'Kaveri Wholesale Distributors',
      '+91 98450 23140',
      '42 Chickpet Main Road, Bengaluru, KA 560053',
      'orders@kaveriwholesale.in'
    ).lastInsertRowid);
    const sup2 = Number(insertSupplier.run(
      'Nandi Electronics & Spares',
      '+91 99012 77410',
      '18 SP Road, Electronic Market, Bengaluru, KA 560002',
      'sales@nandielectronics.in'
    ).lastInsertRowid);
    const sup3 = Number(insertSupplier.run(
      'Vidya Paper & Stationery Mart',
      '+91 94481 56290',
      '75 Avenue Road, Near Mysuru Bank Circle, Bengaluru, KA 560009',
      'supply@vidyamart.in'
    ).lastInsertRowid);
    const sup4 = Number(insertSupplier.run(
      'Malnad Agro & Beverages',
      '+91 97400 88123',
      '109 APMC Yard, Yeshwanthpur, Bengaluru, KA 560022',
      'contact@malnadagro.in'
    ).lastInsertRowid);

    // 4. Seed Products (Includes healthy, low-stock, and out-of-stock examples)
    const insertProduct = db.prepare(`
      INSERT INTO Products (sku, name, category_id, supplier_id, price, quantity, reorder_level)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertTx = db.prepare(`
      INSERT INTO Stock_Transactions
      (product_id, transaction_type, quantity_change, previous_quantity, new_quantity, reference_note, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const productsSeed = [
      { sku: 'PRD-1001', name: 'USB-C Fast Charging Cable (1.5m)', cat: catElectronics, sup: sup2, price: 249, qty: 42, reorder: 10 },
      { sku: 'PRD-1002', name: 'Wireless Optical Mouse', cat: catElectronics, sup: sup2, price: 549, qty: 18, reorder: 8 },
      { sku: 'PRD-1003', name: '65W Dual-Port Wall Adapter', cat: catElectronics, sup: sup2, price: 899, qty: 4, reorder: 8 }, // Low stock
      { sku: 'PRD-1004', name: 'A4 Spiral Notebook (200 Pages)', cat: catStationery, sup: sup3, price: 85, qty: 65, reorder: 15 },
      { sku: 'PRD-1005', name: 'Gel Pen Value Pack (10 Pcs Blue)', cat: catStationery, sup: sup3, price: 120, qty: 34, reorder: 12 },
      { sku: 'PRD-1006', name: 'Whiteboard Marker Set (4 Colors)', cat: catStationery, sup: sup3, price: 140, qty: 0, reorder: 10 }, // Out of stock
      { sku: 'PRD-1007', name: 'Premium Basmati Rice (5 kg)', cat: catGrocery, sup: sup1, price: 520, qty: 24, reorder: 8 },
      { sku: 'PRD-1008', name: 'Cold-Pressed Sunflower Oil (1 L)', cat: catGrocery, sup: sup1, price: 175, qty: 6, reorder: 12 }, // Low stock
      { sku: 'PRD-1009', name: 'Filter Coffee Powder (250 g)', cat: catBeverages, sup: sup4, price: 165, qty: 29, reorder: 10 },
      { sku: 'PRD-1010', name: 'Sparkling Lemon Drink (500 ml)', cat: catBeverages, sup: sup4, price: 40, qty: 54, reorder: 20 },
      { sku: 'PRD-1011', name: '9W Cool Daylight LED Bulb', cat: catHardware, sup: sup2, price: 110, qty: 38, reorder: 12 },
      { sku: 'PRD-1012', name: '4-Socket Surge Extension Board', cat: catHardware, sup: sup2, price: 450, qty: 5, reorder: 8 }, // Low stock
    ];

    const productIds: Record<string, { id: number; price: number }> = {};

    for (const item of productsSeed) {
      const res = insertProduct.run(item.sku, item.name, item.cat, item.sup, item.price, item.qty, item.reorder);
      const pid = Number(res.lastInsertRowid);
      productIds[item.sku] = { id: pid, price: item.price };

      // Record initial opening stock purchase
      if (item.qty > 0) {
        insertTx.run(
          pid,
          'PURCHASE',
          item.qty,
          0,
          item.qty,
          'Opening Inventory Stock',
          adminId,
          formatLocalDaysAgo(14)
        );
      }
    }

    // 5. Seed Historical Sales over the past 10 days (including today) for reports & charts
    const insertSale = db.prepare(`
      INSERT INTO Sales (receipt_number, customer_name, payment_method, total_amount, sold_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertSaleItem = db.prepare(`
      INSERT INTO Sale_Items (sale_id, product_id, quantity, unit_price, subtotal)
      VALUES (?, ?, ?, ?, ?)
    `);

    const historicalSales = [
      {
        receipt: 'INV-2026-0001',
        customer: 'Raghavendra Rao',
        method: 'UPI',
        daysAgo: 9,
        items: [
          { sku: 'PRD-1004', qty: 4 },
          { sku: 'PRD-1005', qty: 2 },
        ],
      },
      {
        receipt: 'INV-2026-0002',
        customer: 'Sneha Kulkarni',
        method: 'Card',
        daysAgo: 7,
        items: [
          { sku: 'PRD-1002', qty: 1 },
          { sku: 'PRD-1001', qty: 2 },
        ],
      },
      {
        receipt: 'INV-2026-0003',
        customer: 'Anand General Store',
        method: 'Cash',
        daysAgo: 5,
        items: [
          { sku: 'PRD-1007', qty: 3 },
          { sku: 'PRD-1008', qty: 4 },
        ],
      },
      {
        receipt: 'INV-2026-0004',
        customer: 'Meenakshi S',
        method: 'UPI',
        daysAgo: 4,
        items: [
          { sku: 'PRD-1009', qty: 2 },
          { sku: 'PRD-1010', qty: 6 },
        ],
      },
      {
        receipt: 'INV-2026-0005',
        customer: 'Karthik Gowda',
        method: 'Card',
        daysAgo: 3,
        items: [
          { sku: 'PRD-1003', qty: 2 },
          { sku: 'PRD-1012', qty: 1 },
        ],
      },
      {
        receipt: 'INV-2026-0006',
        customer: 'Walk-in Customer',
        method: 'Cash',
        daysAgo: 2,
        items: [
          { sku: 'PRD-1011', qty: 5 },
          { sku: 'PRD-1004', qty: 3 },
        ],
      },
      {
        receipt: 'INV-2026-0007',
        customer: 'Priya Sharma',
        method: 'UPI',
        daysAgo: 1,
        items: [
          { sku: 'PRD-1001', qty: 3 },
          { sku: 'PRD-1005', qty: 3 },
          { sku: 'PRD-1010', qty: 4 },
        ],
      },
      {
        receipt: 'INV-2026-0008',
        customer: 'Darshan Patel',
        method: 'UPI',
        daysAgo: 0,
        items: [
          { sku: 'PRD-1002', qty: 2 },
          { sku: 'PRD-1009', qty: 1 },
        ],
      },
      {
        receipt: 'INV-2026-0009',
        customer: 'Lakshmi Narayanan',
        method: 'Cash',
        daysAgo: 0,
        items: [
          { sku: 'PRD-1007', qty: 2 },
          { sku: 'PRD-1004', qty: 5 },
        ],
      },
    ];

    for (const sale of historicalSales) {
      const timestamp = formatLocalDaysAgo(sale.daysAgo);
      let total = 0;
      const lineItems = sale.items.map((item) => {
        const prod = productIds[item.sku];
        const subtotal = prod.price * item.qty;
        total += subtotal;
        return { productId: prod.id, qty: item.qty, price: prod.price, subtotal };
      });

      const saleRes = insertSale.run(sale.receipt, sale.customer, sale.method, total, adminId, timestamp);
      const saleId = Number(saleRes.lastInsertRowid);

      for (const li of lineItems) {
        insertSaleItem.run(saleId, li.productId, li.qty, li.price, li.subtotal);
        const current = db.prepare('SELECT quantity FROM Products WHERE id = ?').get(li.productId) as { quantity: number };
        insertTx.run(
          li.productId,
          'SALE',
          -li.qty,
          current.quantity + li.qty,
          current.quantity,
          `Sale ${sale.receipt}`,
          adminId,
          timestamp
        );
      }
    }
  });

  seedTransaction();
}

function formatLocalDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default db;
