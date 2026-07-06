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
  table_id?: number;
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

export interface Table {
  table_id: number;
  table_name: string;
  is_occupied: boolean;
  table_code?: string;
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

function mapDbItemToMenuItem(it: any): MenuItem {
  return {
    id: String(it.item_id),
    code: it.code,
    category: it.category === "toppings" ? "topping" : it.category,
    name: it.name,
    price_inr: Number(it.cost),
    description: it.description || "",
    is_active: it.is_active,
    updated_at: it.updated_at
  };
}

export async function getMenuItems(): Promise<MenuItem[]> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured. Please define VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.");
  }
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .order("code");
  
  if (error) {
    console.error("Supabase getMenuItems error:", error);
    throw error;
  }

  if (!data || data.length === 0) {
    console.log("No menu items found in public.items, auto-seeding default menu...");
    try {
      await bulkUpsertMenuItems(DEFAULT_MENU_ITEMS);
      const { data: refetched, error: refetchError } = await supabase
        .from("items")
        .select("*")
        .order("code");
      if (!refetchError && refetched) {
        return refetched.map(mapDbItemToMenuItem);
      }
    } catch (e) {
      console.error("Failed to auto-seed items:", e);
    }
  }

  return (data || []).map(mapDbItemToMenuItem);
}

export async function addMenuItem(item: Omit<MenuItem, "id" | "updated_at">): Promise<MenuItem> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }
  const dbItem = {
    name: item.name,
    category: item.category === "topping" ? "toppings" : item.category,
    code: item.code,
    cost: item.price_inr,
    is_active: item.is_active,
    description: item.description
  };
  const { data, error } = await supabase
    .from("items")
    .insert([dbItem])
    .select();
  
  if (error) {
    console.error("Supabase addMenuItem error:", error);
    throw error;
  }
  if (data && data[0]) {
    return mapDbItemToMenuItem(data[0]);
  }
  throw new Error("Failed to insert menu item");
}

export async function updateMenuItem(id: string, updates: Partial<MenuItem>): Promise<MenuItem> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }
  const dbUpdates: any = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.category !== undefined) dbUpdates.category = updates.category === "topping" ? "toppings" : updates.category;
  if (updates.code !== undefined) dbUpdates.code = updates.code;
  if (updates.price_inr !== undefined) dbUpdates.cost = updates.price_inr;
  if (updates.is_active !== undefined) dbUpdates.is_active = updates.is_active;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  dbUpdates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("items")
    .update(dbUpdates)
    .eq("item_id", parseInt(id, 10))
    .select();
  
  if (error) {
    console.error("Supabase updateMenuItem error:", error);
    throw error;
  }
  if (data && data[0]) {
    return mapDbItemToMenuItem(data[0]);
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
  
  // 1. Find or Create Customer
  let customerId: number | null = null;
  if (order.customer_name) {
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("customer_id")
      .eq("phone", order.customer_phone)
      .maybeSingle();

    if (existingCustomer) {
      customerId = existingCustomer.customer_id;
    } else {
      const { data: newCustomer, error: custError } = await supabase
        .from("customers")
        .insert([{
          name: order.customer_name,
          phone: order.customer_phone,
          email: order.customer_name.replace(/\s+/g, "").toLowerCase() + "@example.com"
        }])
        .select();
      if (!custError && newCustomer && newCustomer[0]) {
        customerId = newCustomer[0].customer_id;
      }
    }
  }

  // 2. Find or Create Table
  let tableId: number | null = null;
  const tableName = `Table ${order.table_number}`;
  const { data: existingTable } = await supabase
    .from("tables")
    .select("table_id")
    .eq("table_name", tableName)
    .maybeSingle();

  if (existingTable) {
    tableId = existingTable.table_id;
  } else {
    const { data: newTable, error: tableError } = await supabase
      .from("tables")
      .insert([{
        table_name: tableName,
        is_occupied: true
      }])
      .select();
    if (!tableError && newTable && newTable[0]) {
      tableId = newTable[0].table_id;
    }
  }

  // 3. Resolve Staff Session or Staff ID
  let finalStaffId = order.staff_id || null;
  if (!finalStaffId && order.order_source === "staff") {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        finalStaffId = user.id;
      }
    } catch (e) {
      console.error("Failed to fetch user session in createOrder:", e);
    }
  }

  // 4. Insert Order
  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .insert([{
      customer_id: customerId,
      table_id: tableId,
      staff_id: finalStaffId,
      total_amount: order.total_payable,
      discount_amount: order.discount || 0
    }])
    .select();

  if (orderError) {
    console.error("Supabase order insert error:", orderError);
    throw orderError;
  }
  
  if (orderData && orderData[0]) {
    const insertedOrder = orderData[0];
    
    // 5. Fetch code/id map of existing items to resolve items correctly
    const { data: dbItems } = await supabase
      .from("items")
      .select("item_id, name, code");

    const nameToIdMap: Record<string, number> = {};
    const idToIdMap: Record<string, number> = {};
    if (dbItems) {
      dbItems.forEach(it => {
        nameToIdMap[it.name.toLowerCase()] = it.item_id;
        idToIdMap[String(it.item_id)] = it.item_id;
        idToIdMap[it.code] = it.item_id;
      });
    }

    // 6. Serialize and store metadata in the first order line's special_instructions
    const metadata = {
      payment_mode: order.payment_mode,
      order_source: order.order_source,
      subtotal: order.subtotal,
      discount: order.discount,
      gst: order.gst,
      quantity: order.quantity,
      unit_price: order.unit_price
    };

    const linesToInsert = itemsSnapshots.map((it, idx) => {
      let itemId = idToIdMap[it.menu_item_id] || nameToIdMap[it.name.toLowerCase()];
      if (!itemId) {
        itemId = Object.values(idToIdMap)[0] || 1;
      }
      return {
        order_id: insertedOrder.order_id,
        item_id: itemId,
        quantity: 1,
        price_at_sale: it.unit_price_snapshot,
        special_instructions: idx === 0 ? JSON.stringify(metadata) : null
      };
    });

    const { error: linesError } = await supabase
      .from("order_lines")
      .insert(linesToInsert);

    if (linesError) {
      console.error("Supabase order_lines insert error:", linesError);
      throw linesError;
    }

    // 7. Insert initial kitchen status
    await supabase
      .from("kitchen_status")
      .insert([{
        order_id: insertedOrder.order_id,
        status: "preparing"
      }]);

    // Make table status unoccupied after payment is done (order placed)
    if (tableId) {
      await supabase
        .from("tables")
        .update({ is_occupied: false })
        .eq("table_id", tableId);
    }
    
    const mappedItems = linesToInsert.map((line, idx) => ({
      id: `line-${insertedOrder.order_id}-${idx}`,
      order_id: String(insertedOrder.order_id),
      menu_item_id: String(line.item_id),
      category: itemsSnapshots[idx].category,
      name: itemsSnapshots[idx].name,
      unit_price_snapshot: line.price_at_sale
    }));

    return {
      id: String(insertedOrder.order_id),
      created_at: insertedOrder.created_at,
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
      status: "preparing",
      staff_id: finalStaffId || undefined,
      items: mappedItems
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
      order_id,
      table_id,
      total_amount,
      discount_amount,
      created_at,
      updated_at,
      staff_id,
      customers (
        name,
        phone,
        email
      ),
      tables (
        table_name
      ),
      order_lines (
        order_line_id,
        item_id,
        quantity,
        price_at_sale,
        special_instructions,
        items (
          item_id,
          code,
          category,
          name
        )
      ),
      kitchen_status (
        kitchen_status_id,
        status,
        status_changed_at
      )
    `)
    .order("created_at", { ascending: false });

  if (filters && filters.date) {
    const startOfDay = `${filters.date}T00:00:00.000Z`;
    const endOfDay = `${filters.date}T23:59:59.999Z`;
    query = query.gte("created_at", startOfDay).lte("created_at", endOfDay);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Supabase getOrders error:", error);
    throw error;
  }
  
  const mappedOrders = (data || []).map(o => {
    // Determine status from kitchen_status history
    let status: "confirmed" | "preparing" | "ready" | "delivered" = "confirmed";
    if (o.kitchen_status && o.kitchen_status.length > 0) {
      const sortedStatus = [...o.kitchen_status].sort((a, b) => 
        new Date(b.status_changed_at).getTime() - new Date(a.status_changed_at).getTime()
      );
      const latest = sortedStatus[0].status;
      if (latest === "preparing") status = "preparing";
      else if (latest === "serving") status = "ready";
      else if (latest === "served") status = "delivered";
    }

    // Default or parsed metadata values
    let payment_mode: "Cash" | "Card" | "UPI" = "UPI";
    let order_source: "staff" | "customer" = "customer";
    let subtotal = Number(o.total_amount);
    let discount = (o as any).discount_amount !== null && (o as any).discount_amount !== undefined ? Number((o as any).discount_amount) : 0;
    let gst = 0;
    let quantity = 0;
    let unit_price = Number(o.total_amount);

    let totalQty = 0;
    if (o.order_lines) {
      o.order_lines.forEach((line: any) => {
        totalQty += Number(line.quantity || 1);
      });
    }

    const firstLine = o.order_lines?.[0];
    if (firstLine && firstLine.special_instructions) {
      try {
        const meta = JSON.parse(firstLine.special_instructions);
        if (meta && typeof meta === "object") {
          payment_mode = meta.payment_mode || payment_mode;
          order_source = meta.order_source || order_source;
          subtotal = meta.subtotal !== undefined ? meta.subtotal : subtotal;
          if ((o as any).discount_amount === null || (o as any).discount_amount === undefined) {
            discount = meta.discount !== undefined ? meta.discount : discount;
          }
          gst = meta.gst !== undefined ? meta.gst : gst;
          quantity = meta.quantity !== undefined ? meta.quantity : quantity;
          unit_price = meta.unit_price !== undefined ? meta.unit_price : unit_price;
        }
      } catch (e) {
        // Fallback or old format
      }
    }
    if (quantity === 0) quantity = totalQty || 1;

    const items = (o.order_lines || []).map((line: any) => {
      const dbItem = line.items || {};
      return {
        id: String(line.order_line_id),
        order_id: String(o.order_id),
        menu_item_id: String(line.item_id),
        category: dbItem.category === "toppings" ? "topping" : (dbItem.category || "pizza"),
        name: dbItem.name || "Menu Item",
        unit_price_snapshot: Number(line.price_at_sale)
      };
    });

    let table_number = 7;
    const rawTables: any = o.tables;
    const tableObj = Array.isArray(rawTables) ? rawTables[0] : rawTables;
    if (tableObj?.table_name) {
      const match = tableObj.table_name.match(/\d+/);
      if (match) {
        table_number = parseInt(match[0], 10);
      }
    }

    const rawCustomers: any = o.customers;
    const customerObj = Array.isArray(rawCustomers) ? rawCustomers[0] : rawCustomers;

    return {
      id: String(o.order_id),
      created_at: o.created_at,
      table_number,
      table_id: o.table_id || undefined,
      customer_name: customerObj?.name || "Customer",
      customer_phone: customerObj?.phone || "",
      quantity,
      unit_price,
      subtotal,
      discount,
      gst,
      total_payable: Number(o.total_amount),
      payment_mode,
      order_source,
      status,
      staff_id: o.staff_id || undefined,
      items
    } as Order;
  });

  // Client-side filtering if needed
  return mappedOrders.filter(o => {
    if (filters) {
      if (filters.paymentMode && filters.paymentMode !== "All" && o.payment_mode !== filters.paymentMode) {
        return false;
      }
      if (filters.status && filters.status !== "All" && o.status !== filters.status) {
        return false;
      }
    }
    return true;
  });
}

export async function updateOrderStatus(orderId: string, status: "confirmed" | "preparing" | "ready" | "delivered"): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }
  
  let dbStatus: "preparing" | "serving" | "served" | null = null;
  if (status === "preparing") dbStatus = "preparing";
  else if (status === "ready") dbStatus = "serving";
  else if (status === "delivered") dbStatus = "served";
  
  if (dbStatus) {
    const { error } = await supabase
      .from("kitchen_status")
      .insert([{
        order_id: parseInt(orderId, 10),
        status: dbStatus
      }]);
    
    if (error) {
      console.error("Supabase updateOrderStatus error:", error);
      throw error;
    }

    // Also update table occupancy based on order status (unoccupy table when order is delivered/served)
    try {
      const { data: orderData } = await supabase
        .from("orders")
        .select("table_id")
        .eq("order_id", parseInt(orderId, 10))
        .maybeSingle();

      if (orderData?.table_id) {
        const isOccupied = status !== "delivered";
        await supabase
          .from("tables")
          .update({ is_occupied: isOccupied })
          .eq("table_id", orderData.table_id);
      }
    } catch (tblErr) {
      console.error("Failed to sync table status in updateOrderStatus:", tblErr);
    }
  }
}

export async function getTables(): Promise<Table[]> {
  if (!isSupabaseConfigured || !supabase) {
    return Array.from({ length: 20 }, (_, i) => ({
      table_id: i + 1,
      table_name: `Table ${i + 1}`,
      table_code: `T${i + 1}`,
      is_occupied: false
    }));
  }

  const { data, error } = await supabase
    .from("tables")
    .select("*")
    .order("table_id");

  if (error) {
    console.error("Error fetching tables:", error);
    throw error;
  }

  if (!data || data.length === 0) {
    console.log("No tables found, auto-seeding Table 1 to 20...");
    const tablesToInsert = Array.from({ length: 20 }, (_, i) => ({
      table_name: `Table ${i + 1}`,
      table_code: `T${i + 1}`,
      is_occupied: false
    }));

    const { data: seeded, error: seedError } = await supabase
      .from("tables")
      .insert(tablesToInsert)
      .select();

    if (!seedError && seeded) {
      return seeded;
    }
  }

  return data || [];
}

export async function getUnoccupiedTables(): Promise<Table[]> {
  if (!isSupabaseConfigured || !supabase) {
    return Array.from({ length: 20 }, (_, i) => ({
      table_id: i + 1,
      table_name: `Table ${i + 1}`,
      table_code: `T${i + 1}`,
      is_occupied: false
    }));
  }

  // Pre-seed tables if they don't exist
  const { data: countCheck, error: countErr } = await supabase
    .from("tables")
    .select("table_id");
    
  if (!countCheck || countCheck.length === 0 || countErr) {
    await getTables();
  }

  const { data, error } = await supabase
    .from("tables")
    .select("*")
    .eq("is_occupied", false)
    .order("table_id");

  if (error) {
    console.error("Error fetching unoccupied tables:", error);
    throw error;
  }

  return data || [];
}

export async function updateTableOccupiedStatus(tableNumber: number, isOccupied: boolean): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;

  const tableName = `Table ${tableNumber}`;
  
  const { data: existingTable } = await supabase
    .from("tables")
    .select("table_id")
    .eq("table_name", tableName)
    .maybeSingle();

  if (existingTable) {
    await supabase
      .from("tables")
      .update({ is_occupied: isOccupied })
      .eq("table_id", existingTable.table_id);
  } else {
    await supabase
      .from("tables")
      .insert([{
        table_name: tableName,
        table_code: `T${tableNumber}`,
        is_occupied: isOccupied
      }]);
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
        .from("items")
        .select("item_id")
        .eq("code", item.code)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("items")
          .update({
            name: item.name,
            cost: item.price_inr,
            description: item.description,
            is_active: item.is_active,
            category: item.category === "topping" ? "toppings" : item.category,
            updated_at: new Date().toISOString()
          })
          .eq("item_id", existing.item_id);

        if (error) throw error;
        updated++;
        report.push(`Updated ${item.code}: ${item.name}`);
      } else {
        const { error } = await supabase
          .from("items")
          .insert([{
            code: item.code,
            category: item.category === "topping" ? "toppings" : item.category,
            name: item.name,
            cost: item.price_inr,
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
