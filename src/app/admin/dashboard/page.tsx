// src/app/admin/dashboard/page.tsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { 
  BarChart3, Calendar, DollarSign, ShoppingBag, Sparkles, 
  TrendingUp, Users, ArrowRight, Pizza, Layers, Circle, RefreshCw, Send, HelpCircle,
  X, Download, ChevronDown, ChevronUp
} from "lucide-react";
import { getOrders, updateOrderStatus, Order } from "../../../lib/supabase";
import OrderSummary from "../../../components/OrderSummary";

export default function AdminDashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterDate, setFilterDate] = useState(() => {
    const today = new Date();
    // Format YYYY-MM-DD in local time
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [filterPayment, setFilterPayment] = useState<string>("All");
  const [filterStatus, setFilterStatus] = useState<string>("All");

  // AI Assistant Chat State
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiMessages, setAiMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: "Namaste Rajan! Ask me any analytical question about SliceMatic's orders, popular pizzas, payment metrics, or peak times." }
  ]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Fetch orders from Supabase/Fallback
  const loadOrders = async () => {
    setLoading(true);
    try {
      // Pass the filter parameters directly to the database layer
      const data = await getOrders({
        date: filterDate,
        paymentMode: filterPayment,
        status: filterStatus
      });
      setOrders(data);
    } catch (e) {
      console.error("Failed to load dashboard orders:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [filterDate, filterPayment, filterStatus]);

  // Status Cycle Forward Handler
  const handleCycleStatus = async (order: Order) => {
    const statuses: Array<"confirmed" | "preparing" | "ready" | "delivered"> = [
      "confirmed", "preparing", "ready", "delivered"
    ];
    const currentIndex = statuses.indexOf(order.status);
    const nextIndex = (currentIndex + 1) % statuses.length;
    const nextStatus = statuses[nextIndex];

    try {
      await updateOrderStatus(order.id, nextStatus);
      // Optimistic state update to avoid full reload flicker
      setOrders(prev => 
        prev.map(o => o.id === order.id ? { ...o, status: nextStatus } : o)
      );
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  // --- STATS COMPUTATIONS (DYNAMIC) ---
  const todayRevenue = orders.reduce((sum, o) => sum + Number(o.total_payable), 0);
  const todayOrderCount = orders.length;
  const avgOrderValue = todayOrderCount > 0 ? todayRevenue / todayOrderCount : 0;

  // Most ordered pizza computation
  const getMostOrderedPizza = () => {
    if (orders.length === 0) return "No Orders";
    const counts: Record<string, number> = {};
    orders.forEach(o => {
      const pizzaName = o.items?.find(it => it.category === "pizza")?.name || "Pepperoni Classic";
      counts[pizzaName] = (counts[pizzaName] || 0) + o.quantity;
    });
    
    let maxPizza = "No Orders";
    let maxCount = 0;
    Object.entries(counts).forEach(([name, count]) => {
      if (count > maxCount) {
        maxCount = count;
        maxPizza = name;
      }
    });
    return maxPizza === "No Orders" ? "Classic Margherita" : maxPizza;
  };

  const mostOrderedPizza = getMostOrderedPizza();

  // --- AI ASSISTANT STATISTICS COMPILATION ---
  // Compiles structured summary numbers to ground the model correctly (anti-AI-slop)
  const compileAggregates = () => {
    const pizzaCounts: Record<string, { qty: number; revenue: number }> = {};
    const toppingCounts: Record<string, { qty: number }> = {};
    const baseCounts: Record<string, { qty: number }> = {};
    const paymentCounts: Record<string, { count: number; revenue: number }> = {};
    const hourCounts: Record<number, number> = {};
    let totalDiscount = 0;

    const orders_list = orders.map(o => {
      const orderItems = o.items || [];
      return {
        id: o.id,
        created_at: o.created_at,
        time: new Date(o.created_at).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' }),
        customer_name: o.customer_name || "Unknown",
        customer_phone: o.customer_phone || "",
        table_number: o.table_number,
        quantity: o.quantity,
        unit_price: Number(o.unit_price),
        subtotal: Number(o.subtotal),
        discount: Number(o.discount),
        gst: Number(o.gst),
        total_payable: Number(o.total_payable),
        payment_mode: o.payment_mode,
        order_source: o.order_source,
        status: o.status,
        items: orderItems.map(it => ({
          name: it.name,
          category: it.category,
          price: Number(it.unit_price_snapshot)
        }))
      };
    });

    orders.forEach(o => {
      // Pizza
      const pizza = o.items?.find(it => it.category === "pizza")?.name || "Pepperoni Classic";
      if (!pizzaCounts[pizza]) pizzaCounts[pizza] = { qty: 0, revenue: 0 };
      pizzaCounts[pizza].qty += o.quantity;
      pizzaCounts[pizza].revenue += Number(o.total_payable);

      // Toppings & Bases
      o.items?.forEach(it => {
        if (it.category === "topping") {
          if (!toppingCounts[it.name]) toppingCounts[it.name] = { qty: 0 };
          toppingCounts[it.name].qty += o.quantity;
        } else if (it.category === "base") {
          if (!baseCounts[it.name]) baseCounts[it.name] = { qty: 0 };
          baseCounts[it.name].qty += o.quantity;
        }
      });

      // Payment
      if (!paymentCounts[o.payment_mode]) paymentCounts[o.payment_mode] = { count: 0, revenue: 0 };
      paymentCounts[o.payment_mode].count++;
      paymentCounts[o.payment_mode].revenue += Number(o.total_payable);

      // Hourly peak analysis
      const date = new Date(o.created_at);
      const hour = date.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + o.quantity;

      // Discount
      totalDiscount += Number(o.discount);
    });

    return {
      date_filtered: filterDate,
      total_orders: orders.length,
      total_revenue_inr: todayRevenue,
      average_order_value_inr: avgOrderValue,
      total_discount_given_inr: totalDiscount,
      pizza_popularity: pizzaCounts,
      topping_popularity: toppingCounts,
      base_popularity: baseCounts,
      payment_distribution: paymentCounts,
      hourly_order_volume_pizzas: hourCounts,
      orders_list: orders_list
    };
  };

  const handleSendAiMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = aiQuery.trim();
    if (!query) return;

    setAiQuery("");
    // Capture the history before updating state
    const historyToSend = [...aiMessages];
    setAiMessages(prev => [...prev, { role: "user", content: query }]);
    setIsAiLoading(true);

    const stats = compileAggregates();

    try {
      const response = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: query,
          statistics: stats,
          history: historyToSend
        })
      });

      if (!response.ok) {
        throw new Error(`API error ${response.status}`);
      }

      const data = await response.json();
      setAiMessages(prev => [...prev, { role: "assistant", content: data.text }]);
    } catch (err) {
      console.error("AI Insights API failed:", err);
      // Fallback: Show statistics directly
      const fallbackContent = `⚠️ AI Insights Assistant is currently unavailable. Displaying raw aggregates to answer your question:
- Total Sales Date: ${filterDate}
- Captured Revenue: ₹${todayRevenue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
- Average Invoice Size: ₹${avgOrderValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
- Most Selected Sauce: ${mostOrderedPizza}
- Active Orders Listed: ${todayOrderCount}`;
      
      setAiMessages(prev => [...prev, { role: "assistant", content: fallbackContent }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-[#FAFAFA] flex flex-col">
      {/* NAVIGATION BAR */}
      <nav className="bg-[#252525] border-b border-[#333333] px-6 py-4 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="bg-[#FF6B2B] p-2 rounded-xl text-white">
            <Pizza size={22} className="rotate-45" />
          </div>
          <div>
            <span className="font-serif font-extrabold text-xl tracking-tight block text-white">
              SliceMatic <span className="text-[#FF6B2B]">Admin</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm font-mono">
          <Link to="/staff/order" className="text-[#9E9E9E] hover:text-[#FF6B2B] transition-colors">
            ← Staff Terminals
          </Link>
          <span className="text-neutral-700">|</span>
          <Link to="/admin/menu" className="text-[#9E9E9E] hover:text-[#FF6B2B] transition-colors">
            Manage Menu Matrix
          </Link>
        </div>
      </nav>

      {/* CORE LAYOUT */}
      <main className="flex-grow p-4 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        
        {/* TITLE & QUICK REFRESH */}
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold tracking-tight">SliceMatic Analytics</h1>
            <p className="text-[#9E9E9E] text-sm mt-1">Real-time counter sales, customer sources, and kitchen statuses.</p>
          </div>
          <button
            onClick={loadOrders}
            className="p-2.5 rounded-xl border border-[#333333] hover:bg-[#252525] text-[#FAFAFA] hover:text-[#FF6B2B] transition-all"
            title="Refresh statistics"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        {/* SUMMARY CARDS SECTION */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Card 1: Today's Revenue */}
          <div className="bg-[#252525] border border-[#333333] p-5 rounded-2xl flex items-center justify-between shadow-lg">
            <div className="space-y-1">
              <span className="text-xs font-mono text-[#9E9E9E] uppercase tracking-wider block">Today's Revenue</span>
              <span className="text-2xl font-bold font-mono text-[#FF6B2B]">
                ₹{todayRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="bg-[#FF6B2B]/10 p-3 rounded-xl text-[#FF6B2B]">
              <DollarSign size={24} />
            </div>
          </div>

          {/* Card 2: Orders Today */}
          <div className="bg-[#252525] border border-[#333333] p-5 rounded-2xl flex items-center justify-between shadow-lg">
            <div className="space-y-1">
              <span className="text-xs font-mono text-[#9E9E9E] uppercase tracking-wider block">Orders Placed</span>
              <span className="text-2xl font-bold font-mono text-[#FAFAFA]">{todayOrderCount}</span>
            </div>
            <div className="bg-[#4CAF50]/10 p-3 rounded-xl text-[#4CAF50]">
              <ShoppingBag size={24} />
            </div>
          </div>

          {/* Card 3: Average Order Value */}
          <div className="bg-[#252525] border border-[#333333] p-5 rounded-2xl flex items-center justify-between shadow-lg">
            <div className="space-y-1">
              <span className="text-xs font-mono text-[#9E9E9E] uppercase tracking-wider block">Avg Ticket Value</span>
              <span className="text-2xl font-bold font-mono text-[#FAFAFA]">
                ₹{avgOrderValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="bg-sky-500/10 p-3 rounded-xl text-sky-400">
              <TrendingUp size={24} />
            </div>
          </div>

          {/* Card 4: Most Ordered Pizza */}
          <div className="bg-[#252525] border border-[#333333] p-5 rounded-2xl flex items-center justify-between shadow-lg">
            <div className="space-y-1 max-w-[70%]">
              <span className="text-xs font-mono text-[#9E9E9E] uppercase tracking-wider block">Top Selling Pizza</span>
              <span className="text-sm font-bold font-serif text-[#FAFAFA] block truncate" title={mostOrderedPizza}>
                {mostOrderedPizza}
              </span>
            </div>
            <div className="bg-[#FF6B2B]/10 p-3 rounded-xl text-[#FF6B2B]">
              <Pizza size={24} />
            </div>
          </div>
        </div>

        {/* RECENT ORDER SUMMARY WITH PERIOD FILTERS AND DETAILED BILL MODALS */}
        <OrderSummary allowStatusUpdate={true} />

        {/* COLLAPSIBLE AI INSIGHTS ASSISTANT PANEL */}
        <div className="bg-[#252525] border border-[#333333] rounded-2xl shadow-xl overflow-hidden">
          
          {/* Header toggle */}
          <button
            onClick={() => setIsAiOpen(!isAiOpen)}
            className="w-full bg-[#1F1F1F] px-6 py-4 flex items-center justify-between text-left focus:outline-none hover:bg-neutral-800/20 transition-all border-b border-[#333333]"
          >
            <div className="flex items-center gap-3">
              <div className="bg-[#FF6B2B] p-2 rounded-xl text-white">
                <Sparkles size={18} className="animate-pulse" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-[#FAFAFA] text-lg">AI Analytics Insights Assistant</h3>
              </div>
            </div>
            <div className="text-[#FF6B2B] p-1.5 rounded-lg hover:bg-white/5 transition-colors">
              {isAiOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </button>

          {isAiOpen && (
            <div className="p-6 space-y-6">
              
              {/* Message scroll log */}
              <div className="bg-[#1A1A1A] rounded-2xl p-4 h-[300px] overflow-y-auto border border-[#333333] flex flex-col gap-4">
                {aiMessages.map((msg, index) => (
                  <div 
                    key={index} 
                    className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                      msg.role === "assistant" 
                        ? "bg-[#252525] border border-[#333333] text-[#FAFAFA] self-start" 
                        : "bg-[#FF6B2B] text-white font-medium self-end"
                    }`}
                  >
                    <div className="text-xs font-mono text-[#9E9E9E] mb-1">
                      {msg.role === "assistant" ? "🤖 SliceMatic Bot" : "👤 Rajan (Admin)"}
                    </div>
                    {msg.content}
                  </div>
                ))}

                {isAiLoading && (
                  <div className="bg-[#252525] border border-[#333] text-[#FAFAFA] rounded-2xl p-4 self-start flex items-center gap-2">
                    <RefreshCw className="animate-spin text-[#FF6B2B]" size={16} />
                    <span className="text-xs font-mono">Formulating retail aggregates...</span>
                  </div>
                )}
              </div>

              {/* Chat Input form */}
              <form onSubmit={handleSendAiMessage} className="flex gap-3">
                <input
                  type="text"
                  required
                  placeholder="e.g. Which pizza sold the most today? OR What are our top cash vs card distributions?"
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  className="flex-grow bg-[#1A1A1A] border border-[#333333] text-[#FAFAFA] text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-[#FF6B2B] transition-colors"
                />
                <button
                  type="submit"
                  disabled={isAiLoading}
                  className="bg-[#FF6B2B] hover:bg-[#E05A1F] text-white p-3.5 rounded-xl font-bold transition-all flex items-center justify-center cursor-pointer shadow-lg shadow-[#FF6B2B]/20"
                >
                  <Send size={18} />
                </button>
              </form>

              {/* Sample helpful questions prompt list */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[#9E9E9E] font-mono uppercase tracking-wider flex items-center gap-1">
                  <HelpCircle size={14} /> Quick Queries:
                </span>
                {[
                  "Which pizza is our bestseller today?",
                  "What is today's average order value?",
                  "Which payment mode is most preferred?",
                  "Give me a summary of total sales."
                ].map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAiQuery(q)}
                    className="bg-[#1A1A1A] border border-[#333333] text-[#9E9E9E] hover:text-[#FAFAFA] hover:border-[#FF6B2B] px-3 py-1.5 rounded-lg transition-colors font-mono"
                  >
                    {q}
                  </button>
                ))}
              </div>

            </div>
          )}

        </div>

      </main>

      {/* FOOTER */}
      <footer className="bg-[#1F1F1F] border-t border-[#292929] py-4 text-center text-xs text-[#9E9E9E] font-mono mt-12">
        SliceMatic Delhi Portal &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
