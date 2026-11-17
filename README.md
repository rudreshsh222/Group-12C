# Digital Inventory & Sales Management System

**VTU 3rd Semester Computer Science & Engineering Community Project**

A complete, full-stack web application built to help small retail shops manage products, track real-time inventory levels, record supplier purchases, generate printable sales receipts, and export CSV business reports.

---

## Technology Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide Icons
- **Backend:** Node.js, Express.js (`server.ts`)
- **Database:** SQLite (`better-sqlite3`, persisted in `inventory.db`)

---

## Database Schema (7 Relational Tables)

Created automatically in `src/db/database.ts` with `PRAGMA foreign_keys = ON`:

1. **`Users`** — Stores admin/staff accounts and salted `scrypt` password hashes.
2. **`Categories`** — Stores product categories.
3. **`Suppliers`** — Stores supplier name, phone number, email, and address.
4. **`Products`** — Stores SKU/Product ID, name, price, available quantity, reorder level, and foreign keys to `Categories` and `Suppliers`.
5. **`Sales`** — Stores receipt number, customer name, payment method, total amount, timestamp, and `sold_by` foreign key to `Users`.
6. **`Sale_Items`** — Stores line items for each sale (`sale_id`, `product_id`, `quantity`, `unit_price`, `subtotal`).
7. **`Stock_Transactions`** — Full audit trail of `PURCHASE`, `SALE`, and `ADJUSTMENT` stock movements.

---

## Step-by-Step Installation & Running on a Laptop

### Prerequisites
- Install **Node.js (v20 LTS or newer)** from [https://nodejs.org](https://nodejs.org)

### 1. Install Dependencies
Open a terminal in the project folder and run:
```bash
npm install
```

### 2. Run in Development Mode
Start the backend API server and Vite frontend together on port `3000`:
```bash
npm run dev
```

### 3. Open in Browser
Visit:
```text
http://localhost:3000
```
On the first run, the server automatically creates `inventory.db` and populates sample categories, suppliers, products, and historical sales.

### 4. Production Build (Optional)
```bash
npm run build
npm start
```

---

## Sample Login Credentials

| Role  | Username | Password   |
|-------|----------|------------|
| Admin | `admin`  | `admin123` |
| Staff | `staff`  | `staff123` |
