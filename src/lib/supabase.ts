// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export const isSupabaseConfigured = true;

// --- FALLBACK MOCK DATA ENGINE ---
// This ensures that the application is fully interactive and persistent (via LocalStorage/Memory)
// even when Supabase is not yet configured.

export interface MenuItem {
  id: string;
  code: string;
  category: "base" | "pizza" | "topping";
  name: string;
  price_inr: number;
  description: string;
  is_active: boolean;
  updated_at: string;
}

export interface Order {
  id: string;
  created_at: string;
  table_number: number;
  customer_name: string;
  customer_phone: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  discount: number;
  gst: number;
  total_payable: number;
  payment_mode: "Cash" | "Card" | "UPI";
  order_source: "staff" | "customer";
  status: "confirmed" | "preparing" | "ready" | "delivered";
  staff_id?: string;
  items?: OrderItemSnapshot[];
}

export interface OrderItemSnapshot {
  id: string;
  order_id: string;
  menu_item_id: string;
  category: string;
  name: string;
  unit_price_snapshot: number;
}

// Default menu items to seed the application immediately
const DEFAULT_MENU_ITEMS: MenuItem[] = [
  // Bases
  { id: "b1-uuid", code: "B1", category: "base", name: "Thin Crust", price_inr: 149.00, description: "Crisp and light base", is_active: true, updated_at: new Date().toISOString() },
  { id: "b2-uuid", code: "B2", category: "base", name: "Cheese Burst", price_inr: 199.00, description: "Stuffed with liquid cheese", is_active: true, updated_at: new Date().toISOString() },
  { id: "b3-uuid", code: "B3", category: "base", name: "Pan Base", price_inr: 129.00, description: "Thick, soft and fluffy", is_active: true, updated_at: new Date().toISOString() },
  // Pizzas
  { id: "p1-uuid", code: "P1", category: "pizza", name: "Margherita Classic", price_inr: 249.00, description: "Traditional cheese and tomato sauce", is_active: true, updated_at: new Date().toISOString() },
  { id: "p2-uuid", code: "P2", category: "pizza", name: "Pepperoni Classic", price_inr: 369.00, description: "Loaded with spicy pork pepperoni", is_active: true, updated_at: new Date().toISOString() },
  { id: "p3-uuid", code: "P3", category: "pizza", name: "Kadhai Paneer Pizza", price_inr: 329.00, description: "Topped with spicy kadhai masala paneer cubes", is_active: true, updated_at: new Date().toISOString() },
  { id: "p4-uuid", code: "P4", category: "pizza", name: "Chicken Tikka Feast", price_inr: 389.00, description: "Tandoori chicken tikka, onions and green pepper", is_active: true, updated_at: new Date().toISOString() },
  // Toppings
  { id: "t1-uuid", code: "T1", category: "topping", name: "Extra Mozzarella", price_inr: 69.00, description: "Gooey extra cheese layer", is_active: true, updated_at: new Date().toISOString() },
  { id: "t2-uuid", code: "T2", category: "topping", name: "Button Mushrooms", price_inr: 49.00, description: "Freshly sliced roasted mushrooms", is_active: true, updated_at: new Date().toISOString() },
  { id: "t3-uuid", code: "T3", category: "topping", name: "Spicy Jalapenos", price_inr: 39.00, description: "Zesty pickled jalapeno slices", is_active: true, updated_at: new Date().toISOString() },
  { id: "t4-uuid", code: "T4", category: "topping", name: "Olives & Onions", price_inr: 45.00, description: "Black olives and crunchy red onions", is_active: true, updated_at: new Date().toISOString() }
];

// Browser Local Storage helper
function getLocalDB() {
  if (typeof window === "undefined") {
    return { menu: DEFAULT_MENU_ITEMS, orders: [] as Order[] };
  }
  
  let menu = DEFAULT_MENU_ITEMS;
  let orders: Order[] = [];
  
  try {
    const storedMenu = localStorage.getItem("slice_matic_menu");
    if (storedMenu) {
      menu = JSON.parse(storedMenu);
    } else {
      localStorage.setItem("slice_matic_menu", JSON.stringify(DEFAULT_MENU_ITEMS));
    }
    
    const storedOrders = localStorage.getItem("slice_matic_orders");
    if (storedOrders) {
      orders = JSON.parse(storedOrders);
    }
  } catch (e) {
    console.error("LocalStorage error:", e);
  }
  
  return { menu, orders };
}

function saveLocalDB(menu: MenuItem[], orders: Order[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("slice_matic_menu", JSON.stringify(menu));
    localStorage.setItem("slice_matic_orders", JSON.stringify(orders));
  } catch (e) {
    console.error("Failed to save to local storage:", e);
  }
}

// Database Helpers (Strict production Supabase calls)

export async function getMenuItems(): Promise<MenuItem[]> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured. Please define VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.");
  }
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .order("code");
  
  if (error) {
    console.error("Supabase getMenuItems error:", error);
    throw error;
  }
  return data as MenuItem[];
}

export async function addMenuItem(item: Omit<MenuItem, "id" | "updated_at">): Promise<MenuItem> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }
  const { data, error } = await supabase
    .from("menu_items")
    .insert([item])
    .select();
  
  if (error) {
    console.error("Supabase addMenuItem error:", error);
    throw error;
  }
  if (data && data[0]) {
    return data[0] as MenuItem;
  }
  throw new Error("Failed to insert menu item");
}

export async function updateMenuItem(id: string, updates: Partial<MenuItem>): Promise<MenuItem> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }
  const { data, error } = await supabase
    .from("menu_items")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select();
  
  if (error) {
    console.error("Supabase updateMenuItem error:", error);
    throw error;
  }
  if (data && data[0]) {
    return data[0] as MenuItem;
  }
  throw new Error(`Menu item with ID ${id} not found`);
}

export async function createOrder(
  order: Omit<Order, "id" | "created_at" | "items">, 
  itemsSnapshots: { menu_item_id: string; category: string; name: string; unit_price_snapshot: number }[]
): Promise<Order> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }
  
  // 1. Insert order
  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .insert([{
      table_number: order.table_number,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      quantity: order.quantity,
      unit_price: order.unit_price,
      subtotal: order.subtotal,
      discount: order.discount,
      gst: order.gst,
      total_payable: order.total_payable,
      payment_mode: order.payment_mode,
      order_source: order.order_source,
      status: order.status,
      staff_id: order.staff_id || null
    }])
    .select();

  if (orderError) {
    console.error("Supabase order insert error:", orderError);
    throw orderError;
  }
  
  if (orderData && orderData[0]) {
    const insertedOrder = orderData[0];
    
    // 2. Insert order items
    const itemsToInsert = itemsSnapshots.map(it => ({
      order_id: insertedOrder.id,
      menu_item_id: it.menu_item_id,
      category: it.category,
      name: it.name,
      unit_price_snapshot: it.unit_price_snapshot
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(itemsToInsert);

    if (itemsError) {
      console.error("Supabase order_items insert error:", itemsError);
      throw itemsError;
    }
    
    return {
      ...insertedOrder,
      items: itemsToInsert
    } as Order;
  }
  throw new Error("Failed to insert order");
}

export async function getOrders(filters?: {
  date?: string; // YYYY-MM-DD
  paymentMode?: string;
  status?: string;
}): Promise<Order[]> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }
  
  let query = supabase
    .from("orders")
    .select(`
      *,
      order_items (
        id,
        order_id,
        menu_item_id,
        category,
        name,
        unit_price_snapshot
      )
    `)
    .order("created_at", { ascending: false });

  if (filters) {
    if (filters.date) {
      const startOfDay = `${filters.date}T00:00:00.000Z`;
      const endOfDay = `${filters.date}T23:59:59.999Z`;
      query = query.gte("created_at", startOfDay).lte("created_at", endOfDay);
    }
    if (filters.paymentMode && filters.paymentMode !== "All") {
      query = query.eq("payment_mode", filters.paymentMode);
    }
    if (filters.status && filters.status !== "All") {
      query = query.eq("status", filters.status);
    }
  }

  const { data, error } = await query;
  if (error) {
    console.error("Supabase getOrders error:", error);
    throw error;
  }
  
  return (data || []).map(order => ({
    ...order,
    items: order.order_items
  })) as Order[];
}

export async function updateOrderStatus(orderId: string, status: "confirmed" | "preparing" | "ready" | "delivered"): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }
  
  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId);
  
  if (error) {
    console.error("Supabase updateOrderStatus error:", error);
    throw error;
  }
}

// Bulk seed upsert
export async function bulkUpsertMenuItems(items: Omit<MenuItem, "id" | "updated_at">[]): Promise<{ imported: number, updated: number, skipped: number, report: string[] }> {
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const report: string[] = [];

  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }
  
  for (const item of items) {
    try {
      // Check if exists
      const { data: existing } = await supabase
        .from("menu_items")
        .select("id")
        .eq("code", item.code)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("menu_items")
          .update({
            name: item.name,
            price_inr: item.price_inr,
            description: item.description,
            is_active: item.is_active,
            category: item.category,
            updated_at: new Date().toISOString()
          })
          .eq("id", existing.id);

        if (error) throw error;
        updated++;
        report.push(`Updated ${item.code}: ${item.name}`);
      } else {
        const { error } = await supabase
          .from("menu_items")
          .insert([{
            code: item.code,
            category: item.category,
            name: item.name,
            price_inr: item.price_inr,
            description: item.description,
            is_active: item.is_active
          }]);

        if (error) throw error;
        imported++;
        report.push(`Imported ${item.code}: ${item.name}`);
      }
    } catch (err) {
      skipped++;
      report.push(`Skipped ${item.code || "unknown"}: ${String(err)}`);
    }
  }
  return { imported, updated, skipped, report };
}
