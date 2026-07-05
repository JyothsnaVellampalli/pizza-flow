// src/components/OrderSummary.tsx
import React, { useEffect, useState, useRef } from "react";
import { 
  Calendar, DollarSign, ShoppingBag, TrendingUp, Layers, 
  Circle, RefreshCw, X, Eye, Phone, User, Hash, Clock, Printer,
  ChevronLeft, ChevronRight, Search
} from "lucide-react";
import { getOrders, updateOrderStatus, Order } from "../lib/supabase";

interface OrderSummaryProps {
  allowStatusUpdate?: boolean;
}

export default function OrderSummary({ allowStatusUpdate = true }: OrderSummaryProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<"today" | "month" | "quarter" | "all">("today");
  
  // Modal State for Detailed Bill
  const [selectedOrderForBill, setSelectedOrderForBill] = useState<Order | null>(null);

  // Advanced Filters & Pagination States
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  // Reset page when any filter query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [timeFilter, searchTerm, statusFilter, paymentFilter]);

  // Scroll to the first row/header of the table on pagination page changes
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [currentPage]);

  // Fetch orders
  const loadOrders = async () => {
    setLoading(true);
    try {
      // Fetch all orders without filtering, then perform precise local-time range filtering in memory.
      // This is extremely reliable across different server/timezone/client configurations and works with Mock DB.
      const data = await getOrders();
      setOrders(data);
    } catch (e) {
      console.error("Failed to load summary orders:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  // Filter orders by selected time period, search query, status, and payment mode
  const getFilteredOrders = () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    const startOfQuarter = new Date(now.getFullYear(), quarterStartMonth, 1);

    return orders.filter(o => {
      // 1. Time Filter
      let matchesTime = true;
      const orderDate = new Date(o.created_at);
      if (timeFilter === "today") {
        matchesTime = orderDate >= startOfToday;
      } else if (timeFilter === "month") {
        matchesTime = orderDate >= startOfMonth;
      } else if (timeFilter === "quarter") {
        matchesTime = orderDate >= startOfQuarter;
      }

      if (!matchesTime) return false;

      // 2. Status Filter
      if (statusFilter !== "all" && o.status !== statusFilter) {
        return false;
      }

      // 3. Payment Filter
      if (paymentFilter !== "all" && o.payment_mode.toLowerCase() !== paymentFilter.toLowerCase()) {
        return false;
      }

      // 4. Search Filter
      if (searchTerm.trim() !== "") {
        const query = searchTerm.toLowerCase();
        const normalizedQuery = query.replace(/\s+/g, "");
        const custName = (o.customer_name || "").toLowerCase();
        const custPhone = (o.customer_phone || "").toLowerCase();
        const tableNum = String(o.table_number || "");
        const tableCode = "t" + tableNum;
        const tableText = "table" + tableNum;
        const shortId = o.id.substring(o.id.length - 6).toLowerCase();
        const fullId = o.id.toLowerCase();

        const matchesSearch = 
          custName.includes(query) || 
          custPhone.includes(query) || 
          tableNum.includes(query) || 
          tableCode.includes(normalizedQuery) ||
          tableText.includes(normalizedQuery) ||
          shortId.includes(query) || 
          fullId.includes(query);

        if (!matchesSearch) return false;
      }

      return true;
    });
  };

  const filteredOrders = getFilteredOrders();

  // Pagination slice
  const totalPages = Math.ceil(filteredOrders.length / pageSize);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Compute metrics for the filtered subset
  const totalRevenue = filteredOrders.reduce((sum, o) => sum + Number(o.total_payable), 0);
  const totalOrderCount = filteredOrders.length;
  const avgOrderValue = totalOrderCount > 0 ? totalRevenue / totalOrderCount : 0;

  // Status cycle forward handler
  const handleCycleStatus = async (order: Order, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering details modal if clicking on the badge
    if (!allowStatusUpdate) return;
    
    const statuses: Array<"confirmed" | "preparing" | "ready" | "delivered"> = [
      "confirmed", "preparing", "ready", "delivered"
    ];
    const currentIndex = statuses.indexOf(order.status);
    const nextIndex = (currentIndex + 1) % statuses.length;
    const nextStatus = statuses[nextIndex];

    try {
      await updateOrderStatus(order.id, nextStatus);
      setOrders(prev => 
        prev.map(o => o.id === order.id ? { ...o, status: nextStatus } : o)
      );
      if (selectedOrderForBill?.id === order.id) {
        setSelectedOrderForBill(prev => prev ? { ...prev, status: nextStatus } : null);
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  // Helper to parse order snapshots into structured pizzas (for detailed display)
  const parsePizzasFromOrder = (order: Order) => {
    // If we have a rich cached copy from local storage, use it!
    if ((order as any).rich_items) {
      return (order as any).rich_items;
    }

    const items = order.items || [];
    const pizzasMap: Record<number, {
      index: number;
      base?: { name: string; price: number };
      pizza?: { name: string; price: number };
      toppings: { name: string; price: number; qty: number }[];
    }> = {};

    // Pattern to match Pizza index: " (Pizza #X)" or " [Pizza #X]"
    const pizzaPattern = /\(Pizza #(\d+)\)/i;

    items.forEach(it => {
      let pizzaIndex = 1;
      let cleanedName = it.name;
      
      const match = it.name.match(pizzaPattern);
      if (match) {
        pizzaIndex = parseInt(match[1], 10);
        cleanedName = it.name.replace(/\s*\(Pizza #\d+\)/i, "").trim();
      }

      if (!pizzasMap[pizzaIndex]) {
        pizzasMap[pizzaIndex] = {
          index: pizzaIndex,
          toppings: []
        };
      }

      if (it.category === "base") {
        pizzasMap[pizzaIndex].base = { name: cleanedName, price: it.unit_price_snapshot };
      } else if (it.category === "pizza") {
        pizzasMap[pizzaIndex].pizza = { name: cleanedName, price: it.unit_price_snapshot };
      } else if (it.category === "topping") {
        // Extract quantity if stored as "(x2)" or similar
        let qty = 1;
        const qtyMatch = cleanedName.match(/\(x(\d+)\)/i);
        if (qtyMatch) {
          qty = parseInt(qtyMatch[1], 10);
          cleanedName = cleanedName.replace(/\s*\(x\d+\)/i, "").trim();
        }
        
        // Single unit price snapshot represents the total topping price (topping_price * qty)
        const unitPrice = qty > 0 ? it.unit_price_snapshot / qty : it.unit_price_snapshot;
        pizzasMap[pizzaIndex].toppings.push({
          name: cleanedName,
          price: unitPrice,
          qty
        });
      }
    });

    const parsed = Object.values(pizzasMap).sort((a, b) => a.index - b.index);
    // If no base/pizza was extracted (legacy orders), return default single list
    if (parsed.length === 0 || (!parsed[0].base && !parsed[0].pizza)) {
      const baseName = items.find(i => i.category === "base")?.name || "Thin Crust";
      const basePrice = items.find(i => i.category === "base")?.unit_price_snapshot || 149;
      const pizzaName = items.find(i => i.category === "pizza")?.name || "Margherita Classic";
      const pizzaPrice = items.find(i => i.category === "pizza")?.unit_price_snapshot || 249;
      const toppings = items.filter(i => i.category === "topping").map(t => ({
        name: t.name,
        price: t.unit_price_snapshot,
        qty: 1
      }));

      return [{
        id: "legacy",
        base: { id: "b", name: baseName, price_inr: basePrice },
        pizza: { id: "p", name: pizzaName, price_inr: pizzaPrice },
        toppings: toppings.map(t => ({ item: { id: "t", name: t.name, price_inr: t.price }, qty: t.qty })),
        quantity: order.quantity
      }];
    }

    return parsed.map(p => ({
      id: `p-${p.index}`,
      base: p.base ? { id: "b", name: p.base.name, price_inr: p.base.price } : { id: "b", name: "Thin Crust", price_inr: 149 },
      pizza: p.pizza ? { id: "p", name: p.pizza.name, price_inr: p.pizza.price } : { id: "p", name: "Margherita Classic", price_inr: 249 },
      toppings: p.toppings.map(t => ({ item: { id: "t", name: t.name, price_inr: t.price }, qty: t.qty })),
      quantity: 1 // If flat grouping, each group represents 1 configured pizza combination
    }));
  };

  // Human readable description of pizza configurations
  const getPizzaSummaryText = (order: Order) => {
    const parsed = parsePizzasFromOrder(order);
    if (parsed.length === 0) return "Custom Pizza";
    
    return parsed.map((p: any, idx: number) => {
      const pName = p.pizza?.name || "Margherita Classic";
      const bName = p.base?.name || "Thin Crust";
      const topNames = p.toppings && p.toppings.length > 0
        ? p.toppings.map((t: any) => `${t.item?.name || t.name}${t.qty > 1 ? ` (x${t.qty})` : ""}`).join(", ")
        : "No Toppings";
      return `${p.quantity || 1}x ${pName} (${bName} + ${topNames})`;
    }).join(" | ");
  };

  return (
    <div className="space-y-6 w-full">
      {/* FILTER & QUICK METRICS HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-[#252525] border border-white/10 rounded-2xl p-6 shadow-lg">
        <div>
          <h3 className="text-xl font-serif font-bold text-white tracking-tight flex items-center gap-2">
            <Layers className="text-[#FF6B2B]" size={20} />
            Order Sales Dashboard
          </h3>
          <p className="text-[#9E9E9E] text-xs font-mono mt-1">Live analytics, settlement breakdown, and kitchen states.</p>
        </div>

        {/* TIME RANGE SELECTOR */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono uppercase text-[#9E9E9E] mr-2">Time Period:</span>
          {(["today", "month", "quarter", "all"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setTimeFilter(filter)}
              className={`px-4 py-2 rounded-lg font-bold font-mono text-xs uppercase tracking-wider transition-all cursor-pointer ${
                timeFilter === filter
                  ? "bg-[#FF6B2B] text-white shadow-md shadow-[#FF6B2B]/25"
                  : "bg-[#1A1A1A] border border-white/5 text-[#9E9E9E] hover:text-white hover:border-white/10"
              }`}
            >
              {filter === "today" ? "Today" : filter === "month" ? "This Month" : filter === "quarter" ? "Quarter" : "All Time"}
            </button>
          ))}
          <button
            onClick={loadOrders}
            className="p-2 bg-[#1A1A1A] border border-white/5 rounded-lg text-[#9E9E9E] hover:text-[#FF6B2B] transition-colors cursor-pointer ml-2"
            title="Refresh order logs"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* THREE BENTO METRIC CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Revenue */}
        <div className="bg-[#252525] border border-white/10 p-6 rounded-2xl flex items-center justify-between shadow-lg">
          <div className="space-y-1.5">
            <span className="text-xs font-mono text-[#9E9E9E] uppercase tracking-wider block">Total Revenue</span>
            <span className="text-3xl font-extrabold font-mono text-[#FF6B2B]">
              ₹{totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="bg-[#FF6B2B]/10 p-3 rounded-xl text-[#FF6B2B]">
            <DollarSign size={24} />
          </div>
        </div>

        {/* Card 2: Orders Placed */}
        <div className="bg-[#252525] border border-white/10 p-6 rounded-2xl flex items-center justify-between shadow-lg">
          <div className="space-y-1.5">
            <span className="text-xs font-mono text-[#9E9E9E] uppercase tracking-wider block">Orders Placed</span>
            <span className="text-3xl font-extrabold font-mono text-[#FAFAFA]">{totalOrderCount}</span>
          </div>
          <div className="bg-emerald-500/10 p-3 rounded-xl text-[#4CAF50]">
            <ShoppingBag size={24} />
          </div>
        </div>

        {/* Card 3: Avg Invoice Size */}
        <div className="bg-[#252525] border border-white/10 p-6 rounded-2xl flex items-center justify-between shadow-lg">
          <div className="space-y-1.5">
            <span className="text-xs font-mono text-[#9E9E9E] uppercase tracking-wider block">Avg Ticket Size</span>
            <span className="text-3xl font-extrabold font-mono text-[#FAFAFA]">
              ₹{avgOrderValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="bg-sky-500/10 p-3 rounded-xl text-sky-400">
            <TrendingUp size={24} />
          </div>
        </div>
      </div>

      {/* MATRIX TABLE */}
      <div ref={tableContainerRef} className="bg-[#252525] border border-white/10 rounded-2xl shadow-lg overflow-hidden">
        {/* Dynamic Controls Bar */}
        <div className="bg-[#1F1F1F] px-5 py-4 border-b border-white/5 flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Left search control */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 text-[#9E9E9E] w-4 h-4" />
            <input
              type="text"
              placeholder="Search by customer, phone, table, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 w-full bg-[#151515] border border-white/10 rounded-xl text-xs font-mono text-white placeholder-[#9E9E9E] focus:outline-none focus:border-[#FF6B2B] transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-2.5 text-[#9E9E9E] hover:text-white transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Right dropdown filters */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            <div className="flex items-center gap-1.5 bg-[#151515] border border-white/10 rounded-xl px-3 py-1.5">
              <span className="text-[10px] font-mono uppercase text-[#9E9E9E]">Payment:</span>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="bg-transparent border-none text-xs font-bold font-mono text-white focus:outline-none cursor-pointer pr-1"
              >
                <option value="all" className="bg-[#151515] text-white">All Modes</option>
                <option value="cash" className="bg-[#151515] text-white">Cash</option>
                <option value="card" className="bg-[#151515] text-white">Card</option>
                <option value="upi" className="bg-[#151515] text-white">UPI</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#FF6B2B]"></div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-16 text-center text-[#9E9E9E] space-y-1.5">
            <Layers size={36} className="mx-auto mb-2 text-neutral-600" />
            <p className="font-serif text-lg">No orders found.</p>
            <p className="text-xs font-mono">No matching records found for the active selection & filters.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-[#1A1A1A] text-xs font-mono uppercase tracking-wider text-[#9E9E9E] border-b border-white/5">
                    <th className="px-5 py-4">Time</th>
                    <th className="px-5 py-4">Ref ID</th>
                    <th className="px-5 py-4 text-center">Table</th>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4 hidden lg:table-cell">Phone</th>
                    <th className="px-5 py-4">Pizzas Ordered</th>
                    <th className="px-5 py-4 text-center">Qty</th>
                    <th className="px-5 py-4 text-right">Settled Total</th>
                    <th className="px-5 py-4 text-center">Mode</th>
                    <th className="px-5 py-4 text-center">Kitchen Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {paginatedOrders.map((order) => {
                    const summaryText = getPizzaSummaryText(order);
                    return (
                      <tr 
                        key={order.id} 
                        onClick={() => setSelectedOrderForBill(order)}
                        className="hover:bg-white/3 transition-colors cursor-pointer group"
                      >
                        <td className="px-5 py-4 font-mono text-xs text-[#9E9E9E]">
                          <div className="flex flex-col">
                            <span className="text-white font-medium">
                              {new Date(order.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <span className="text-[10px] opacity-75">
                              {new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 font-mono text-xs font-bold text-[#FF6B2B] group-hover:underline">
                          #{order.id.substring(order.id.length - 6).toUpperCase()}
                        </td>
                        <td className="px-5 py-4 text-center font-mono font-bold text-white">
                          T{order.table_number}
                        </td>
                        <td className="px-5 py-4 font-serif font-medium text-white">
                          {order.customer_name}
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-[#9E9E9E] hidden lg:table-cell">
                          {order.customer_phone}
                        </td>
                        <td className="px-5 py-4 text-xs leading-relaxed max-w-[280px] truncate" title={summaryText}>
                          {summaryText}
                        </td>
                        <td className="px-5 py-4 text-center font-mono text-white font-medium">
                          {order.quantity}
                        </td>
                        <td className="px-5 py-4 text-right font-mono font-bold text-[#FF6B2B]">
                          ₹{Number(order.total_payable).toFixed(2)}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className="bg-[#1A1A1A] border border-white/10 px-2 py-0.5 rounded text-[11px] font-mono text-white">
                            {order.payment_mode}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => handleCycleStatus(order, e)}
                            disabled={!allowStatusUpdate}
                            className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold border cursor-pointer transition-all uppercase tracking-wider ${
                              order.status === "confirmed" 
                                ? "bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20"
                                : order.status === "preparing"
                                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                                  : order.status === "ready"
                                    ? "bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20"
                                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                            }`}
                            title={allowStatusUpdate ? "Click to advance status" : undefined}
                          >
                            {order.status}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="bg-[#1A1A1A] px-5 py-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-xs font-mono text-[#9E9E9E]">
                  Showing <strong className="text-white">{Math.min(filteredOrders.length, (currentPage - 1) * pageSize + 1)}</strong> to{" "}
                  <strong className="text-white">{Math.min(filteredOrders.length, currentPage * pageSize)}</strong> of{" "}
                  <strong className="text-white">{filteredOrders.length}</strong> orders
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="p-1.5 bg-[#252525] border border-white/10 hover:border-white/20 text-[#9E9E9E] hover:text-white rounded-full disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:text-[#9E9E9E] transition-all cursor-pointer"
                    title="Previous Page"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  
                  {/* Dynamic Page Buttons */}
                  {(() => {
                    const pages = [];
                    const maxVisible = 5;
                    let start = Math.max(1, currentPage - 2);
                    let end = Math.min(totalPages, start + maxVisible - 1);
                    if (end - start + 1 < maxVisible) {
                      start = Math.max(1, end - maxVisible + 1);
                    }
                    
                    if (start > 1) {
                      pages.push(
                        <button
                          key={1}
                          onClick={() => setCurrentPage(1)}
                          className={`w-7 h-7 rounded-full font-bold font-mono text-[11px] transition-all cursor-pointer ${
                            currentPage === 1
                              ? "bg-[#FF6B2B] text-white"
                              : "bg-[#252525] border border-white/10 text-[#9E9E9E] hover:text-white"
                          }`}
                        >
                          1
                        </button>
                      );
                      if (start > 2) {
                        pages.push(<span key="dots-start" className="text-neutral-600 font-mono text-xs px-1">...</span>);
                      }
                    }
                    
                    for (let p = start; p <= end; p++) {
                      pages.push(
                        <button
                          key={p}
                          onClick={() => setCurrentPage(p)}
                          className={`w-7 h-7 rounded-full font-bold font-mono text-[11px] transition-all cursor-pointer ${
                            currentPage === p
                              ? "bg-[#FF6B2B] text-white shadow-md shadow-[#FF6B2B]/20"
                              : "bg-[#252525] border border-white/10 text-[#9E9E9E] hover:text-white hover:border-white/20"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    }
                    
                    if (end < totalPages) {
                      if (end < totalPages - 1) {
                        pages.push(<span key="dots-end" className="text-neutral-600 font-mono text-xs px-1">...</span>);
                      }
                      pages.push(
                        <button
                          key={totalPages}
                          onClick={() => setCurrentPage(totalPages)}
                          className={`w-7 h-7 rounded-full font-bold font-mono text-[11px] transition-all cursor-pointer ${
                            currentPage === totalPages
                              ? "bg-[#FF6B2B] text-white"
                              : "bg-[#252525] border border-white/10 text-[#9E9E9E] hover:text-white"
                          }`}
                        >
                          {totalPages}
                        </button>
                      );
                    }
                    return pages;
                  })()}

                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="p-1.5 bg-[#252525] border border-white/10 hover:border-white/20 text-[#9E9E9E] hover:text-white rounded-full disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:text-[#9E9E9E] transition-all cursor-pointer"
                    title="Next Page"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* DETAILED BILL MODAL */}
      {selectedOrderForBill && (() => {
        const o = selectedOrderForBill;
        const parsedPizzas = parsePizzasFromOrder(o);
        
        return (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div id="invoice-print-area" className="bg-[#252525] border border-white/15 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              
              {/* Modal Header */}
              <div className="bg-[#1F1F1F] px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-[#FF6B2B]/10 p-2 rounded-lg text-[#FF6B2B]">
                    <Clock size={18} />
                  </div>
                  <div>
                    <h4 className="text-white font-serif font-bold">Counter Tax Invoice</h4>
                    <p className="text-[#9E9E9E] text-[10px] font-mono uppercase">Ref: #{o.id.toUpperCase()}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedOrderForBill(null)}
                  className="no-print p-1.5 rounded-lg hover:bg-white/5 text-[#9E9E9E] hover:text-white transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6 overflow-y-auto flex-grow text-left">
                {/* Meta details */}
                <div className="grid grid-cols-2 gap-4 border-b border-white/5 pb-4 font-mono text-xs text-[#9E9E9E]">
                  <div>
                    <span className="block text-[10px] uppercase">Staff / Source</span>
                    <span className="text-white font-semibold flex items-center gap-1 mt-0.5">
                      <User size={12} className="text-[#FF6B2B]" /> {o.order_source === "staff" ? "Counter Terminal" : "Self Service"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase">Table Number</span>
                    <span className="text-white font-semibold flex items-center gap-1 mt-0.5">
                      <Hash size={12} className="text-[#FF6B2B]" /> Table {o.table_number}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase">Customer Name</span>
                    <span className="text-white font-semibold flex items-center gap-1 mt-0.5">
                      <User size={12} className="text-[#FF6B2B]" /> {o.customer_name}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase">Customer Phone</span>
                    <span className="text-white font-semibold flex items-center gap-1 mt-0.5">
                      <Phone size={12} className="text-[#FF6B2B]" /> +91 {o.customer_phone}
                    </span>
                  </div>
                </div>

                {/* ITEMISED LIST */}
                <div className="space-y-4">
                  <h5 className="text-white text-xs font-mono uppercase tracking-wider border-b border-white/5 pb-1.5 flex justify-between">
                    <span>Items Ordered</span>
                    <span>Total Pizza Qty: {o.quantity}</span>
                  </h5>

                  <div className="space-y-4">
                    {parsedPizzas.map((p: any, idx: number) => {
                      const pName = p.pizza?.name || "Margherita Classic";
                      const pPrice = p.pizza?.price_inr || p.pizza?.price || 249;
                      const bName = p.base?.name || "Thin Crust";
                      const bPrice = p.base?.price_inr || p.base?.price || 149;
                      const pQty = p.quantity || 1;
                      
                      const toppingsCost = p.toppings 
                        ? p.toppings.reduce((sum: number, t: any) => sum + (t.item?.price_inr || t.price || 0) * t.qty, 0)
                        : 0;
                      const singlePizzaTotal = Number(pPrice) + Number(bPrice) + toppingsCost;
                      const itemisedSubtotal = singlePizzaTotal * pQty;

                      return (
                        <div key={idx} className="bg-[#1E1E1E] border border-white/5 rounded-xl p-4 space-y-2.5">
                          {/* Pizza Header */}
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[#FF6B2B] font-serif font-extrabold text-base block">
                                {pQty} × {pName}
                              </span>
                              <span className="text-xs text-[#9E9E9E] font-mono font-medium block mt-0.5">
                                Base: {bName} (₹{Number(bPrice).toFixed(2)})
                              </span>
                            </div>
                            <span className="text-white font-mono font-bold text-sm">
                              ₹{itemisedSubtotal.toFixed(2)}
                            </span>
                          </div>

                          {/* Toppings Sublist */}
                          {p.toppings && p.toppings.length > 0 && (
                            <div className="border-t border-white/5 pt-2 pl-2 space-y-1">
                              <span className="text-[10px] font-mono uppercase text-[#9E9E9E] block mb-1">Toppings:</span>
                              {p.toppings.map((t: any, tidx: number) => {
                                const tName = t.item?.name || t.name;
                                const tPrice = t.item?.price_inr || t.price || 0;
                                return (
                                  <div key={tidx} className="flex justify-between items-center text-xs text-[#9E9E9E] font-mono">
                                    <span>• {tName} (Qty: {t.qty})</span>
                                    <span>₹{((tPrice) * t.qty).toFixed(2)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* FINANCIAL STATEMENT */}
                <div className="border-t border-white/10 pt-4 space-y-2.5 font-mono text-xs">
                  <div className="flex justify-between text-[#9E9E9E]">
                    <span>Invoice Subtotal:</span>
                    <span className="text-white">₹{Number(o.subtotal).toFixed(2)}</span>
                  </div>

                  {Number(o.discount) > 0 && (
                    <div className="flex justify-between text-[#4CAF50] font-semibold">
                      <span>Bulk Order Discount (10%):</span>
                      <span>−₹{Number(o.discount).toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-[#9E9E9E]">
                    <span>GST (18% Service Tax):</span>
                    <span className="text-white">+₹{Number(o.gst).toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between text-base font-extrabold text-white pt-2.5 border-t border-double border-white/10">
                    <span className="font-serif text-sm">Settled Net Payable:</span>
                    <span className="text-[#FF6B2B] text-lg">₹{Number(o.total_payable).toFixed(2)}</span>
                  </div>
                </div>

                {/* Bottom timestamp and meta */}
                <div className="flex justify-between items-center text-[10px] text-[#9E9E9E] font-mono border-t border-white/5 pt-4">
                  <span>Settlement Mode: <strong className="text-white">{o.payment_mode}</strong></span>
                  <span>Kitchen status: <strong className="text-white uppercase">{o.status}</strong></span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="no-print bg-[#1F1F1F] border-t border-white/10 p-4 flex gap-3 justify-end">
                {allowStatusUpdate && (
                  <button
                    onClick={(e) => {
                      handleCycleStatus(o, e);
                    }}
                    className={`px-4 py-2 rounded-lg font-bold font-mono text-[11px] border cursor-pointer uppercase tracking-wider ${
                      o.status === "confirmed" 
                        ? "bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20"
                        : o.status === "preparing"
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                          : o.status === "ready"
                            ? "bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20"
                            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                    }`}
                  >
                    Cycle Status: {o.status}
                  </button>
                )}
                <button
                  onClick={() => window.print()}
                  className="bg-[#FF6B2B] hover:bg-[#E05A1F] text-white font-bold font-mono text-xs uppercase px-5 py-2.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-md shadow-[#FF6B2B]/15"
                >
                  <Printer size={14} /> Print Invoice
                </button>
                <button
                  onClick={() => setSelectedOrderForBill(null)}
                  className="bg-white/10 hover:bg-white/15 text-white font-bold font-mono text-xs uppercase px-5 py-2.5 rounded-lg transition-colors cursor-pointer"
                >
                  Close Receipt
                </button>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
}
