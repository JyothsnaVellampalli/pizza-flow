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

  // Sales Report States
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Get active month name
  const getMonthName = () => {
    if (orders.length > 0) {
      return new Date(orders[0].created_at).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    }
    return new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  };

  // Hourly Sales Velocity (from minimum active hour to maximum active hour)
  const getHourlyData = () => {
    const hourlyMap: Record<number, number> = {};
    for (let h = 0; h < 24; h++) {
      hourlyMap[h] = 0;
    }

    orders.forEach(o => {
      const date = new Date(o.created_at);
      const hour = date.getHours();
      hourlyMap[hour] = (hourlyMap[hour] || 0) + Number(o.total_payable);
    });

    let minHour = 9;
    let maxHour = 22;
    const activeHours = Object.keys(hourlyMap).map(Number).filter(h => hourlyMap[h] > 0);
    if (activeHours.length > 0) {
      minHour = Math.max(0, Math.min(...activeHours) - 1);
      maxHour = Math.min(23, Math.max(...activeHours) + 1);
    }

    const data: { hour: string; sales: number }[] = [];
    for (let h = minHour; h <= maxHour; h++) {
      data.push({
        hour: `${String(h).padStart(2, "0")}:00`,
        sales: hourlyMap[h]
      });
    }
    return data;
  };

  // Daily Sales trend for the active month
  const getDailyData = () => {
    const now = new Date();
    let targetYear = now.getFullYear();
    let targetMonth = now.getMonth();

    if (orders.length > 0) {
      const orderDates = orders.map(o => new Date(o.created_at));
      const minDate = new Date(Math.min(...orderDates.map(d => d.getTime())));
      targetYear = minDate.getFullYear();
      targetMonth = minDate.getMonth();
    }

    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const dailyMap: Record<number, number> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      dailyMap[d] = 0;
    }

    orders.forEach(o => {
      const date = new Date(o.created_at);
      if (date.getMonth() === targetMonth && date.getFullYear() === targetYear) {
        const d = date.getDate();
        dailyMap[d] = (dailyMap[d] || 0) + Number(o.total_payable);
      }
    });

    const data = [];
    for (let d = 1; d <= daysInMonth; d++) {
      data.push({ day: d, sales: dailyMap[d] });
    }
    return data;
  };

  // PDF Download Trigger
  const downloadReportPdf = async () => {
    const element = document.getElementById("sales-report-pdf-area");
    if (!element) return;
    setIsDownloading(true);
    
    try {
      const canvas = await html2canvas(element, {
        scale: 2, // improve quality
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/png");
      
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }
      
      pdf.save(`SliceMatic-Sales-Report-${filterDate || "All"}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  // Custom SVG renderers
  const drawHourlyChart = (data: { hour: string; sales: number }[]) => {
    const width = 600;
    const height = 220;
    const paddingLeft = 60;
    const paddingRight = 20;
    const paddingTop = 30;
    const paddingBottom = 40;
    
    const maxSales = Math.max(...data.map(d => d.sales), 100);
    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;
    
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto text-neutral-800">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
          const y = paddingTop + chartHeight * (1 - ratio);
          const val = maxSales * ratio;
          return (
            <g key={idx} className="opacity-15">
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#1A1A1A" strokeWidth={0.5} strokeDasharray="3 3" />
              <text x={paddingLeft - 8} y={y + 3} textAnchor="end" className="text-[10px] font-mono fill-neutral-600 font-bold">
                ₹{val.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </text>
            </g>
          );
        })}
        
        {data.map((d, idx) => {
          const barWidth = (chartWidth / data.length) * 0.7;
          const gap = (chartWidth / data.length) * 0.3;
          const x = paddingLeft + idx * (chartWidth / data.length) + gap / 2;
          const barHeight = (d.sales / maxSales) * chartHeight;
          const y = paddingTop + chartHeight - barHeight;
          
          return (
            <g key={idx}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill="#FF6B2B"
                rx={1.5}
              />
              {d.sales > 0 && (
                <text
                  x={x + barWidth / 2}
                  y={y - 5}
                  textAnchor="middle"
                  className="text-[9px] font-mono font-bold fill-neutral-800"
                >
                  ₹{Math.round(d.sales)}
                </text>
              )}
              <text
                x={x + barWidth / 2}
                y={paddingTop + chartHeight + 14}
                textAnchor="middle"
                className="text-[9px] font-mono fill-neutral-500 font-semibold"
              >
                {d.hour}
              </text>
            </g>
          );
        })}
        
        <line
          x1={paddingLeft}
          y1={paddingTop + chartHeight}
          x2={width - paddingRight}
          y2={paddingTop + chartHeight}
          stroke="#1A1A1A"
          strokeWidth={1}
        />
      </svg>
    );
  };

  const drawDailyChart = (data: { day: number; sales: number }[]) => {
    const width = 600;
    const height = 220;
    const paddingLeft = 60;
    const paddingRight = 20;
    const paddingTop = 30;
    const paddingBottom = 40;
    
    const maxSales = Math.max(...data.map(d => d.sales), 100);
    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;
    
    const points = data.map((d, idx) => {
      const x = paddingLeft + (idx / (data.length - 1)) * chartWidth;
      const y = paddingTop + chartHeight - (d.sales / maxSales) * chartHeight;
      return { x, y, day: d.day, sales: d.sales };
    });
    
    const pathData = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPathData = `${pathData} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;
    
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto text-neutral-800">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
          const y = paddingTop + chartHeight * (1 - ratio);
          const val = maxSales * ratio;
          return (
            <g key={idx} className="opacity-15">
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#1A1A1A" strokeWidth={0.5} strokeDasharray="3 3" />
              <text x={paddingLeft - 8} y={y + 3} textAnchor="end" className="text-[10px] font-mono fill-neutral-600 font-bold">
                ₹{val.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </text>
            </g>
          );
        })}
        
        <path
          d={areaPathData}
          fill="url(#orange-grad-report)"
          opacity="0.12"
        />
        
        <path
          d={pathData}
          fill="none"
          stroke="#FF6B2B"
          strokeWidth={1.5}
        />
        
        {points.map((p, idx) => {
          const isSignificant = p.sales > 0;
          return (
            <g key={idx}>
              <circle
                cx={p.x}
                cy={p.y}
                r={isSignificant ? 2.5 : 1}
                fill={isSignificant ? "#FF6B2B" : "#888"}
              />
              {isSignificant && (
                <text
                  x={p.x}
                  y={p.y - 6}
                  textAnchor="middle"
                  className="text-[8px] font-mono font-bold fill-neutral-700"
                >
                  ₹{Math.round(p.sales)}
                </text>
              )}
            </g>
          );
        })}
        
        {points.filter((_, i) => i % 5 === 0 || i === points.length - 1).map((p, idx) => (
          <text
            key={idx}
            x={p.x}
            y={paddingTop + chartHeight + 14}
            textAnchor="middle"
            className="text-[9px] font-mono fill-neutral-500 font-semibold"
          >
            {p.day}
          </text>
        ))}
        
        <line
          x1={paddingLeft}
          y1={paddingTop + chartHeight}
          x2={width - paddingRight}
          y2={paddingTop + chartHeight}
          stroke="#1A1A1A"
          strokeWidth={1}
        />
        
        <defs>
          <linearGradient id="orange-grad-report" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF6B2B" />
            <stop offset="100%" stopColor="#FF6B2B" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    );
  };

  // AI Assistant Chat State

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

        {/* EXECUTIVE SALES REPORT GENERATOR CARD */}
        <div className="bg-[#252525] border border-[#333333] rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 text-left">
            <h3 className="font-serif font-bold text-lg text-[#FAFAFA] flex items-center gap-2">
              <BarChart3 className="text-[#FF6B2B]" size={20} />
              Executive Sales Report Panel
            </h3>
            <p className="text-xs text-[#9E9E9E] font-mono">Generate and download a high-resolution PDF analytics report with hourly sales velocity and daily revenue trends.</p>
          </div>
          <button
            onClick={() => setIsReportOpen(true)}
            className="bg-[#FF6B2B] hover:bg-[#E05A1F] text-white px-6 py-3 rounded-xl font-bold font-serif text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#FF6B2B]/10 cursor-pointer"
          >
            <BarChart3 size={18} />
            Get Sales Report
          </button>
        </div>

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

      {/* EXECUTIVE SALES REPORT MODAL PREVIEW */}
      {isReportOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#1A1A1A] border border-neutral-800 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-150">
            
            {/* Modal Header */}
            <div className="bg-[#111111] px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-[#FF6B2B]/10 p-2 rounded-xl text-[#FF6B2B]">
                  <BarChart3 size={20} />
                </div>
                <div className="text-left">
                  <h4 className="text-white font-serif font-bold text-base">Executive Sales Report Preview</h4>
                  <p className="text-xs text-[#9E9E9E] font-mono uppercase tracking-wider">A4 Printable Format with Vector Distribution Graphs</p>
                </div>
              </div>
              <button 
                onClick={() => setIsReportOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/5 text-[#9E9E9E] hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto flex-grow bg-[#151515] flex flex-col items-center gap-4">
              {orders.length === 0 ? (
                <div className="py-20 text-center text-[#9E9E9E] space-y-2">
                  <BarChart3 size={40} className="mx-auto text-neutral-600 animate-pulse" />
                  <p className="font-serif text-lg text-white">No Sales Data Available</p>
                  <p className="text-xs font-mono">Select a different date or clear your dashboard filters to compile a report.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-[#9E9E9E] font-mono text-center">
                    Scroll down to preview. Below is the exact representation that will be downloaded as an A4 PDF document.
                  </p>
                  
                  {/* The A4 Printable Paper Container */}
                  <div className="overflow-x-auto w-full p-4 flex justify-center bg-[#111] rounded-2xl border border-[#222]">
                    <div 
                      id="sales-report-pdf-area" 
                      className="w-[794px] bg-white text-neutral-900 p-10 flex flex-col justify-between space-y-8 flex-shrink-0"
                      style={{ minHeight: "1050px" }}
                    >
                      {/* Brand Header */}
                      <div className="flex justify-between items-center border-b-2 border-[#FF6B2B] pb-6">
                        <div className="flex items-center gap-3">
                          <div className="bg-[#FF6B2B] p-2 rounded-xl text-white">
                            <Pizza size={26} className="rotate-45" />
                          </div>
                          <div className="text-left">
                            <span className="font-serif font-extrabold text-2xl tracking-tight block text-neutral-900">
                              SliceMatic <span className="text-[#FF6B2B]">Delhi</span>
                            </span>
                            <span className="text-xs font-mono uppercase tracking-widest text-neutral-500 block">
                              Executive Sales Intelligence Report
                            </span>
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          <span className="text-[10px] uppercase tracking-wider text-neutral-400 block">Generated On</span>
                          <span className="text-xs font-bold text-neutral-800">
                            {new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                          </span>
                        </div>
                      </div>

                      {/* Filter Details & Meta */}
                      <div className="flex justify-between items-center bg-neutral-50 border border-neutral-150 px-5 py-3 rounded-xl text-xs font-mono text-neutral-600">
                        <div>
                          <strong className="text-neutral-800">Date Range:</strong> {filterDate || "All Time"}
                        </div>
                        <div>
                          <strong className="text-neutral-800">Outlet location:</strong> New Ashok Nagar, Delhi
                        </div>
                        <div>
                          <strong className="text-neutral-800">Scope:</strong> Delhi Counter Operations
                        </div>
                      </div>

                      {/* KPI Dashboard Metrics Grid */}
                      <div className="grid grid-cols-4 gap-4 text-left">
                        <div className="bg-neutral-50 border border-neutral-200 p-4 rounded-xl">
                          <span className="text-[9px] font-mono text-neutral-400 uppercase tracking-wider block">Gross sales (inr)</span>
                          <span className="text-xl font-black font-mono text-[#FF6B2B] mt-1 block">
                            ₹{todayRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="bg-neutral-50 border border-neutral-200 p-4 rounded-xl">
                          <span className="text-[9px] font-mono text-neutral-400 uppercase tracking-wider block">Counter Orders</span>
                          <span className="text-xl font-black font-mono text-neutral-900 mt-1 block">
                            {todayOrderCount}
                          </span>
                        </div>
                        <div className="bg-neutral-50 border border-neutral-200 p-4 rounded-xl">
                          <span className="text-[9px] font-mono text-neutral-400 uppercase tracking-wider block">Average Ticket</span>
                          <span className="text-xl font-black font-mono text-neutral-900 mt-1 block">
                            ₹{avgOrderValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="bg-neutral-50 border border-neutral-200 p-4 rounded-xl">
                          <span className="text-[9px] font-mono text-neutral-400 uppercase tracking-wider block">Top Selling Item</span>
                          <span className="text-xs font-extrabold font-serif text-neutral-800 mt-1.5 block truncate" title={mostOrderedPizza}>
                            {mostOrderedPizza}
                          </span>
                        </div>
                      </div>

                      {/* GRAPH 1: Hourly Sales Velocity */}
                      <div className="border border-neutral-200 rounded-2xl p-5 text-left">
                        <div className="flex justify-between items-baseline mb-4">
                          <h5 className="font-serif font-bold text-neutral-900 text-sm">Hourly Sales Velocity Profile</h5>
                          <span className="text-[9px] font-mono text-neutral-400 uppercase">Hourly order aggregate peaks</span>
                        </div>
                        <div className="w-full">
                          {drawHourlyChart(getHourlyData())}
                        </div>
                      </div>

                      {/* GRAPH 2: Daily Sales Trend */}
                      <div className="border border-neutral-200 rounded-2xl p-5 text-left">
                        <div className="flex justify-between items-baseline mb-4">
                          <h5 className="font-serif font-bold text-neutral-900 text-sm">Daily Revenue Growth Timeline</h5>
                          <span className="text-[9px] font-mono text-neutral-400 uppercase">{getMonthName()} trend curve</span>
                        </div>
                        <div className="w-full">
                          {drawDailyChart(getDailyData())}
                        </div>
                      </div>

                      {/* Executive Disclaimer & Footer */}
                      <div className="border-t border-neutral-200 pt-5 flex justify-between items-center text-[10px] text-neutral-400 font-mono">
                        <span>SliceMatic Analytical Sales Engine &copy; {new Date().getFullYear()}</span>
                        <span>CONFIDENTIAL &bull; FOR INTERNAL MANAGEMENT ONLY</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer actions */}
            <div className="bg-[#111111] border-t border-neutral-800 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setIsReportOpen(false)}
                className="bg-neutral-800 hover:bg-neutral-700 text-white font-bold font-mono text-xs uppercase px-5 py-3 rounded-xl transition-colors cursor-pointer"
              >
                Close Preview
              </button>
              {orders.length > 0 && (
                <button
                  onClick={downloadReportPdf}
                  disabled={isDownloading}
                  className="bg-[#FF6B2B] hover:bg-[#E05A1F] text-white font-bold font-mono text-xs uppercase px-6 py-3 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-lg shadow-[#FF6B2B]/20 disabled:opacity-50"
                >
                  {isDownloading ? (
                    <>
                      <RefreshCw className="animate-spin" size={14} />
                      Exporting Report...
                    </>
                  ) : (
                    <>
                      <Download size={14} />
                      Download PDF Report
                    </>
                  )}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="bg-[#1F1F1F] border-t border-[#292929] py-4 text-center text-xs text-[#9E9E9E] font-mono mt-12">
        SliceMatic Delhi Portal &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
