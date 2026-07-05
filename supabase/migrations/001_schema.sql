-- supabase/migrations/001_schema.sql

-- Enable uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: menu_items
CREATE TABLE menu_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  category text NOT NULL CHECK (category IN ('base', 'pizza', 'topping')),
  name text NOT NULL,
  price_inr numeric(10,2) NOT NULL CHECK (price_inr > 0),
  description text,
  is_active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

-- Table: orders
CREATE TABLE orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  table_number integer NOT NULL CHECK (table_number BETWEEN 1 AND 20),
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 10),
  unit_price numeric(10,2) NOT NULL,
  subtotal numeric(10,2) NOT NULL,
  discount numeric(10,2) NOT NULL DEFAULT 0,
  gst numeric(10,2) NOT NULL,
  total_payable numeric(10,2) NOT NULL,
  payment_mode text NOT NULL CHECK (payment_mode IN ('Cash', 'Card', 'UPI')),
  order_source text NOT NULL DEFAULT 'staff' CHECK (order_source IN ('staff', 'customer')),
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'preparing', 'ready', 'delivered')),
  staff_id uuid REFERENCES auth.users(id)   -- null when order_source = 'customer' (future)
);

-- Table: order_items
CREATE TABLE order_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES menu_items(id),
  category text NOT NULL,
  name text NOT NULL,
  unit_price_snapshot numeric(10,2) NOT NULL  -- locked at order time; survives price changes
);

-- Enable Row Level Security (RLS)
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for menu_items
CREATE POLICY "Allow anonymous read access to menu_items" 
  ON menu_items FOR SELECT 
  TO anon, authenticated 
  USING (true);

CREATE POLICY "Allow authenticated full access to menu_items" 
  ON menu_items FOR ALL 
  TO authenticated 
  USING (true);

-- RLS Policies for orders
CREATE POLICY "Allow authenticated full access to orders" 
  ON orders FOR ALL 
  TO authenticated 
  USING (true);

-- Note: In the future, to allow customer orders, run:
-- CREATE POLICY "Allow anonymous insert access to orders" ON orders FOR INSERT TO anon WITH CHECK (order_source = 'customer');

-- RLS Policies for order_items
CREATE POLICY "Allow authenticated full access to order_items" 
  ON order_items FOR ALL 
  TO authenticated 
  USING (true);
