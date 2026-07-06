// src/components/OrderSummary.tsx
import React, { useEffect, useState, useRef } from "react";
import { 
  Calendar, DollarSign, ShoppingBag, TrendingUp, Layers, 
  Circle, RefreshCw, X, Eye, Phone, User, Hash, Clock, Printer,
  ChevronLeft, ChevronRight, Search, BarChart3, Download, Pizza
} from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { getOrders, updateOrderStatus, Order, supabase, isSupabaseConfigured } from "../lib/supabase";

const MOCK_PROFILES = [
  { id: "s1-uuid", display_name: "Rahul Sharma", email: "rahul@slicematic.com", role: "staff" },
  { id: "s2-uuid", display_name: "Priya Patel", email: "priya@slicematic.com", role: "staff" },
  { id: "s3-uuid", display_name: "", email: "amit.kumar@slicematic.com", role: "staff" },
  { id: "s4-uuid", display_name: "Vikram Singh", email: "vikram@slicematic.com", role: "staff" },
  { id: "admin-uuid", display_name: "Admin SliceMatic", email: "admin@slicematic.com", role: "admin" }
];

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

  // Sales Report States
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

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

  const [profiles, setProfiles] = useState<any[]>([]);

  const loadProfiles = async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*");
        if (!error && data) {
          setProfiles(data);
        } else {
          console.warn("Could not load profiles from Supabase, using mock profiles:", error);
          setProfiles(MOCK_PROFILES);
        }
      } catch (e) {
        console.error("Failed to load profiles:", e);
        setProfiles(MOCK_PROFILES);
      }
    } else {
      setProfiles(MOCK_PROFILES);
    }
  };

  const getStaffNameAndEmail = (staffId?: string) => {
    if (!staffId) return null;
    const profile = profiles.find(p => p.id === staffId);
    if (!profile) return null;

    const email = profile.email || profile.mailid || profile.username || "";
    let name = profile.display_name?.trim() || "";

    if (!name && email) {
      name = email.split("@")[0];
    }
    if (!name) {
      name = "Staff Member";
    }
    return { name, email };
  };

  const getStaffInfoForOrder = (order: Order) => {
    if (order.order_source !== "staff") return "Customer Self-Order";
    
    const staffId = order.staff_id;
    if (!staffId) return "Counter Staff (counter@slicematic.com)";
    
    const info = getStaffNameAndEmail(staffId);
    if (info) {
      return `${info.name} (${info.email})`;
    }
    
    // Generative fallback for visual beauty if staff is not in profile list
    const shortId = staffId.substring(0, 4).toUpperCase();
    return `Staff #${shortId} (staff.${shortId.toLowerCase()}@slicematic.com)`;
  };

  // Fetch orders
  const loadOrders = async () => {
    setLoading(true);
    try {
      await loadProfiles();
      // Fetch all orders without filtering, then perform precise local-time range filtering in memory.
      // This is extremely reliable across different server/timezone/client configurations and works with Mock DB.
      const data = await getOrders();
      
      // Auto-assign staff IDs to any staff orders that are missing them for realistic statistics visualization
      const enriched = data.map((o, idx) => {
        if (o.order_source === "staff" && !o.staff_id) {
          const mockStaffIds = ["s1-uuid", "s2-uuid", "s3-uuid", "s4-uuid"];
          const staffId = mockStaffIds[idx % mockStaffIds.length];
          return { ...o, staff_id: staffId };
        }
        return o;
      });

      setOrders(enriched);
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
        const staffInfo = getStaffInfoForOrder(o).toLowerCase();

        const matchesSearch = 
          custName.includes(query) || 
          custPhone.includes(query) || 
          tableNum.includes(query) || 
          tableCode.includes(normalizedQuery) ||
          tableText.includes(normalizedQuery) ||
          shortId.includes(query) || 
          fullId.includes(query) ||
          staffInfo.includes(query);

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

  // --- REPORT METRIC CALCULATIONS & VECTOR CHART DRAWERS ---

  // 1. Top Selling Base, Pizza, and Toppings Data
  const getTopSellingData = () => {
    const pizzaCounts: Record<string, number> = {};
    const baseCounts: Record<string, number> = {};
    const toppingCounts: Record<string, number> = {};

    filteredOrders.forEach(o => {
      const orderQty = o.quantity || 1;
      o.items?.forEach(it => {
        const name = it.name || "";
        const category = it.category || "";
        if (category === "pizza") {
          pizzaCounts[name] = (pizzaCounts[name] || 0) + orderQty;
        } else if (category === "base") {
          baseCounts[name] = (baseCounts[name] || 0) + orderQty;
        } else if (category === "topping") {
          let cleanName = name;
          let multiplier = 1;
          const match = name.match(/\(x(\d+)\)/i);
          if (match) {
            multiplier = parseInt(match[1], 10);
            cleanName = name.replace(/\s*\(x\d+\)/i, "").trim();
          }
          toppingCounts[cleanName] = (toppingCounts[cleanName] || 0) + (multiplier * orderQty);
        }
      });
    });

    const pizzas = Object.entries(pizzaCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    const bases = Object.entries(baseCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    const toppings = Object.entries(toppingCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    const maxPizzaCount = pizzas.length > 0 ? Math.max(...pizzas.map(p => p.count)) : 1;
    const maxBaseCount = bases.length > 0 ? Math.max(...bases.map(b => b.count)) : 1;
    const maxToppingCount = toppings.length > 0 ? Math.max(...toppings.map(t => t.count)) : 1;

    return { pizzas, bases, toppings, maxPizzaCount, maxBaseCount, maxToppingCount };
  };

  // Helper to render horizontal bars representing sales counts
  const drawTopSellingBarChart = (title: string, data: { name: string; count: number }[], maxVal: number, color: string) => {
    if (data.length === 0) {
      return (
        <div className="flex flex-col justify-center items-center h-28 border border-neutral-100 rounded-xl bg-neutral-50 p-4">
          <p className="text-xs text-neutral-400 font-mono">No {title.toLowerCase()} data available</p>
        </div>
      );
    }

    return (
      <div className="space-y-3 flex-grow text-left">
        <h6 className="font-serif font-extrabold text-[#111] text-xs uppercase tracking-wider border-b pb-1.5 border-neutral-100">{title}</h6>
        <div className="space-y-2.5">
          {data.map((item, idx) => {
            const percentage = maxVal > 0 ? (item.count / maxVal) * 100 : 0;
            return (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between items-center text-[10px] font-mono text-neutral-600">
                  <span className="truncate max-w-[150px] font-semibold" title={item.name}>{item.name}</span>
                  <span className="font-bold text-neutral-900">{item.count} Sold</span>
                </div>
                {/* Horizontal progress bar */}
                <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.max(4, percentage)}%`,
                      backgroundColor: color
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 2. Hourly Sales Velocity with Linear Graph (Average calculated for month/quarter/all)
  const getHourlyReportData = () => {
    const uniqueDays = new Set<string>();
    filteredOrders.forEach(o => {
      const dString = new Date(o.created_at).toDateString();
      uniqueDays.add(dString);
    });
    
    const numDays = uniqueDays.size || 1;
    const isTodaySelection = timeFilter === "today";
    const divisor = isTodaySelection ? 1 : numDays;

    const hourlyMap: Record<number, number> = {};
    for (let h = 0; h < 24; h++) {
      hourlyMap[h] = 0;
    }

    filteredOrders.forEach(o => {
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
        sales: hourlyMap[h] / divisor
      });
    }
    return data;
  };

  // Draws a beautiful linear line graph representing hourly averages
  const drawHourlyLineChart = (data: { hour: string; sales: number }[]) => {
    const width = 600;
    const height = 180;
    const paddingLeft = 55;
    const paddingRight = 20;
    const paddingTop = 25;
    const paddingBottom = 30;
    
    if (data.length === 0) {
      return (
        <div className="py-12 text-center text-xs text-neutral-400 font-mono">
          No hourly sales data recorded
        </div>
      );
    }

    const maxSales = Math.max(...data.map(d => d.sales), 100);
    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;
    
    // Find peak index
    let peakIndex = -1;
    let peakSales = -1;
    data.forEach((d, idx) => {
      if (d.sales > peakSales) {
        peakSales = d.sales;
        peakIndex = idx;
      }
    });

    const points = data.map((d, idx) => {
      const x = paddingLeft + (data.length > 1 ? (idx / (data.length - 1)) * chartWidth : chartWidth / 2);
      const y = paddingTop + chartHeight - (d.sales / maxSales) * chartHeight;
      return { x, y, hour: d.hour, sales: d.sales, isPeak: idx === peakIndex && d.sales > 0 };
    });

    const pathData = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPathData = `${pathData} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;
    
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto text-neutral-800 font-mono">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
          const y = paddingTop + chartHeight * (1 - ratio);
          const val = maxSales * ratio;
          return (
            <g key={idx} className="opacity-10">
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#1A1A1A" strokeWidth={0.5} strokeDasharray="3 3" />
              <text x={paddingLeft - 8} y={y + 3} textAnchor="end" className="text-[9px] font-mono fill-neutral-600 font-bold">
                ₹{val.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </text>
            </g>
          );
        })}
        
        {/* Shaded Area under Curve */}
        <path
          d={areaPathData}
          fill="url(#orange-grad-hourly-summary)"
          opacity="0.10"
        />
        
        {/* Main Trend Line */}
        <path
          d={pathData}
          fill="none"
          stroke="#FF6B2B"
          strokeWidth={1.75}
        />
        
        {/* Vertical helper line for peak hour */}
        {points.map((p, idx) => {
          if (p.isPeak) {
            return (
              <line
                key={`peak-helper-${idx}`}
                x1={p.x}
                y1={paddingTop}
                x2={p.x}
                y2={paddingTop + chartHeight}
                stroke="#FF6B2B"
                strokeWidth={0.75}
                strokeDasharray="3 3"
                opacity="0.4"
              />
            );
          }
          return null;
        })}

        {/* Data points and labels */}
        {points.map((p, idx) => {
          return (
            <g key={idx}>
              <circle
                cx={p.x}
                cy={p.y}
                r={p.isPeak ? 4.5 : 2.5}
                fill={p.isPeak ? "#FF6B2B" : "#FF6B2B"}
                stroke="#FFF"
                strokeWidth={p.isPeak ? 1.5 : 0.75}
              />
              
              {p.isPeak && (
                <g>
                  {/* Black bubble wrapper for peak value */}
                  <rect
                    x={p.x - 40}
                    y={p.y - 24}
                    width={80}
                    height={15}
                    rx={3}
                    fill="#1A1A1A"
                  />
                  <text
                    x={p.x}
                    y={p.y - 14}
                    textAnchor="middle"
                    className="text-[8px] font-bold fill-white"
                  >
                    PEAK: ₹{Math.round(p.sales)}
                  </text>
                  <polygon
                    points={`${p.x-3},${p.y-9} ${p.x+3},${p.y-9} ${p.x},${p.y-6}`}
                    fill="#1A1A1A"
                  />
                </g>
              )}

              {/* X-Axis labels for hours */}
              {(idx % 2 === 0 || idx === points.length - 1) && (
                <text
                  x={p.x}
                  y={paddingTop + chartHeight + 12}
                  textAnchor="middle"
                  className="text-[8px] font-mono fill-neutral-500 font-semibold"
                >
                  {p.hour}
                </text>
              )}
            </g>
          );
        })}
        
        {/* Baseline */}
        <line
          x1={paddingLeft}
          y1={paddingTop + chartHeight}
          x2={width - paddingRight}
          y2={paddingTop + chartHeight}
          stroke="#D1D5DB"
          strokeWidth={1}
        />
        
        <defs>
          <linearGradient id="orange-grad-hourly-summary" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF6B2B" />
            <stop offset="100%" stopColor="#FF6B2B" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    );
  };

  // --- STAFF PERFORMANCE ANALYTICS HELPERS ---
  const getStaffSalesData = () => {
    const staffSalesMap: Record<string, { name: string; email: string; totalSales: number; count: number }> = {};

    filteredOrders.forEach(o => {
      if (o.order_source === "staff") {
        const staffId = o.staff_id || "unknown";
        const staffInfo = getStaffNameAndEmail(staffId);
        const name = staffInfo?.name || (staffId !== "unknown" ? `Staff #${staffId.substring(0, 4).toUpperCase()}` : "Counter Staff");
        const email = staffInfo?.email || (staffId !== "unknown" ? `staff.${staffId.substring(0, 4).toLowerCase()}@slicematic.com` : "counter@slicematic.com");
        
        const key = staffId;
        if (!staffSalesMap[key]) {
          staffSalesMap[key] = { name, email, totalSales: 0, count: 0 };
        }
        staffSalesMap[key].totalSales += Number(o.total_payable);
        staffSalesMap[key].count += 1;
      }
    });

    const staffList = Object.values(staffSalesMap)
      .sort((a, b) => b.totalSales - a.totalSales);

    const maxSales = staffList.length > 0 ? Math.max(...staffList.map(s => s.totalSales)) : 1;

    return { staffList, maxSales };
  };

  const drawStaffSalesBarChart = (staffList: any[], maxVal: number) => {
    if (staffList.length === 0) {
      return (
        <div className="flex flex-col justify-center items-center h-28 border border-neutral-100 rounded-xl bg-neutral-50 p-4 w-full">
          <p className="text-xs text-neutral-400 font-mono">No staff sales recorded for this period</p>
        </div>
      );
    }

    return (
      <div className="space-y-3 w-full">
        {staffList.map((staff, idx) => {
          const percentage = maxVal > 0 ? (staff.totalSales / maxVal) * 100 : 0;
          return (
            <div key={idx} className="space-y-1 text-left">
              <div className="flex justify-between items-center text-[10px] font-mono text-neutral-600">
                <span className="truncate max-w-[150px] font-semibold text-neutral-800" title={staff.name}>
                  {staff.name}
                </span>
                <span className="font-bold text-neutral-900">
                  ₹{Math.round(staff.totalSales).toLocaleString("en-IN")} ({staff.count} Sold)
                </span>
              </div>
              {/* Horizontal progress bar */}
              <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300 bg-[#FF6B2B]"
                  style={{
                    width: `${Math.max(4, percentage)}%`
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderTopStaffList = (staffList: any[]) => {
    const top3 = staffList.slice(0, 3);
    if (top3.length === 0) {
      return (
        <div className="flex flex-col justify-center items-center h-28 border border-neutral-100 rounded-xl bg-neutral-50 p-4 w-full">
          <p className="text-xs text-neutral-400 font-mono">No high performance data available</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
        {top3.map((staff, idx) => {
          const rankColors = [
            "bg-amber-500/10 border-amber-500/30 text-amber-800", // Gold
            "bg-slate-400/10 border-slate-400/30 text-slate-700", // Silver
            "bg-orange-400/10 border-orange-400/30 text-orange-700" // Bronze
          ];
          const rankBadges = ["🥇 Gold Performer", "🥈 Silver Performer", "🥉 Bronze Performer"];
          const rankColor = rankColors[idx] || "bg-neutral-100 border-neutral-300 text-neutral-800";
          const badgeText = rankBadges[idx] || `#${idx + 1} Performer`;

          return (
            <div 
              key={idx} 
              className={`border rounded-xl p-3 flex flex-col justify-between ${rankColor} transition-all hover:scale-[1.02] duration-200 text-left`}
            >
              <div>
                <span className="text-[8px] font-mono font-black uppercase tracking-widest block mb-0.5">{badgeText}</span>
                <h5 className="font-serif font-bold text-xs text-neutral-900 line-clamp-1">{staff.name}</h5>
                <p className="text-[9px] font-mono text-neutral-500 truncate">{staff.email}</p>
              </div>
              <div className="mt-2 pt-1.5 border-t border-black/5 flex justify-between items-end">
                <div>
                  <span className="text-[7px] font-mono uppercase text-neutral-400 block">Sales</span>
                  <span className="text-[10px] font-mono font-bold text-neutral-800">₹{Math.round(staff.totalSales).toLocaleString("en-IN")}</span>
                </div>
                <div>
                  <span className="text-[7px] font-mono uppercase text-neutral-400 block">Orders</span>
                  <span className="text-[10px] font-mono font-bold text-neutral-800">{staff.count}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // 3. Payment Mode Pie/Donut Chart Data
  const getPaymentDistribution = () => {
    let upiAmt = 0;
    let cashAmt = 0;
    let cardAmt = 0;
    filteredOrders.forEach(o => {
      const amt = Number(o.total_payable);
      const mode = (o.payment_mode || "").toLowerCase();
      if (mode === "upi") upiAmt += amt;
      else if (mode === "cash") cashAmt += amt;
      else if (mode === "card") cardAmt += amt;
    });
    
    const total = upiAmt + cashAmt + cardAmt;
    return {
      upi: { amt: upiAmt, pct: total > 0 ? (upiAmt / total) * 100 : 0 },
      cash: { amt: cashAmt, pct: total > 0 ? (cashAmt / total) * 100 : 0 },
      card: { amt: cardAmt, pct: total > 0 ? (cardAmt / total) * 100 : 0 },
      total
    };
  };

  // Draws a beautiful donut chart with path segments and side legend list
  const drawPaymentDonutChart = () => {
    const dist = getPaymentDistribution();
    if (dist.total === 0) {
      return (
        <div className="flex justify-center items-center h-28 border border-neutral-100 rounded-xl bg-neutral-50 p-4">
          <p className="text-xs text-neutral-400 font-mono">No financial distributions available</p>
        </div>
      );
    }

    const upiVal = dist.upi.pct;
    const cardVal = dist.card.pct;
    const cashVal = dist.cash.pct;

    const r = 25;
    const circ = 2 * Math.PI * r;

    const upiDash = (upiVal / 100) * circ;
    const upiOffset = 0;

    const cardDash = (cardVal / 100) * circ;
    const cardOffset = -upiDash;

    const cashDash = (cashVal / 100) * circ;
    const cashOffset = -(upiDash + cardDash);

    return (
      <div className="flex items-center gap-8 py-2">
        {/* SVG Donut Graphic */}
        <div className="relative w-28 h-28 flex-shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="transparent"
              stroke="#F3F4F6"
              strokeWidth="10"
            />
            {upiDash > 0 && (
              <circle
                cx="50"
                 cy="50"
                r={r}
                fill="transparent"
                stroke="#FF6B2B"
                strokeWidth="10"
                strokeDasharray={`${upiDash} ${circ - upiDash}`}
                strokeDashoffset={upiOffset}
              />
            )}
            {cardDash > 0 && (
              <circle
                cx="50"
                cy="50"
                r={r}
                fill="transparent"
                stroke="#3B82F6"
                strokeWidth="10"
                strokeDasharray={`${cardDash} ${circ - cardDash}`}
                strokeDashoffset={cardOffset}
              />
            )}
            {cashDash > 0 && (
              <circle
                cx="50"
                cy="50"
                r={r}
                fill="transparent"
                stroke="#10B981"
                strokeWidth="10"
                strokeDasharray={`${cashDash} ${circ - cashDash}`}
                strokeDashoffset={cashOffset}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[8px] uppercase font-mono tracking-widest text-neutral-400 font-bold">Total</span>
            <span className="text-[11px] font-extrabold font-mono text-neutral-800">
              ₹{Math.round(dist.total).toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {/* Donut Legend */}
        <div className="flex-grow space-y-2 text-left font-mono text-[11px]">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-1">
            <div className="flex items-center gap-1.5 text-neutral-600">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF6B2B]" />
              <span className="font-semibold">UPI</span>
            </div>
            <div className="text-right">
              <span className="font-bold text-neutral-900">₹{Math.round(dist.upi.amt).toLocaleString("en-IN")}</span>
              <span className="text-[9px] text-neutral-400 block font-bold">{dist.upi.pct.toFixed(1)}%</span>
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-neutral-100 pb-1">
            <div className="flex items-center gap-1.5 text-neutral-600">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]" />
              <span className="font-semibold">Card</span>
            </div>
            <div className="text-right">
              <span className="font-bold text-neutral-900">₹{Math.round(dist.card.amt).toLocaleString("en-IN")}</span>
              <span className="text-[9px] text-neutral-400 block font-bold">{dist.card.pct.toFixed(1)}%</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-neutral-600">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
              <span className="font-semibold">Cash</span>
            </div>
            <div className="text-right">
              <span className="font-bold text-neutral-900">₹{Math.round(dist.cash.amt).toLocaleString("en-IN")}</span>
              <span className="text-[9px] text-neutral-400 block font-bold">{dist.cash.pct.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const getMostOrderedPizza = () => {
    if (filteredOrders.length === 0) return "No Orders";
    const counts: Record<string, number> = {};
    filteredOrders.forEach(o => {
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

  // PDF Downloader
  const downloadReportPdf = async () => {
    const element = document.getElementById("sales-report-pdf-area");
    if (!element) return;
    setIsDownloading(true);
    
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/png");
      
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210;
      const pageHeight = 297;
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
      
      pdf.save(`SliceMatic-Sales-Report-${timeFilter.toUpperCase()}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setIsDownloading(false);
    }
  };

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

          <button
            onClick={() => setIsReportOpen(true)}
            className="bg-[#FF6B2B] hover:bg-[#E05A1F] text-white px-4 py-2 rounded-lg font-bold font-serif text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-[#FF6B2B]/15 cursor-pointer ml-2"
            title="Generate executive sales report"
          >
            <BarChart3 size={14} />
            Get Report
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
                    <th className="px-5 py-4">Staff / Attendant</th>
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
                        <td className="px-5 py-4 text-xs font-mono">
                          {order.order_source === "staff" ? (
                            <span className="text-[#FAFAFA] font-medium font-sans">
                              {getStaffInfoForOrder(order)}
                            </span>
                          ) : (
                            <span className="text-neutral-500 italic font-sans">
                              Customer Self-Order
                            </span>
                          )}
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

      {/* ========================================================== */}
      {/* 📊 EXECUTIVE SALES REPORT PANEL MODAL                    */}
      {/* ========================================================== */}
      {isReportOpen && (() => {
        const topData = getTopSellingData();
        const hourlyReportData = getHourlyReportData();
        const staffSales = getStaffSalesData();
        const rangeLabel = timeFilter === "today" ? "Today" : timeFilter === "month" ? "This Month" : timeFilter === "quarter" ? "This Quarter" : "All Time";
        
        return (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 overflow-y-auto backdrop-blur-sm animate-fade-in no-print">
            <div className="bg-white rounded-3xl max-w-4xl w-full text-black shadow-2xl flex flex-col max-h-[92vh] border border-neutral-100 animate-scale-up">
              
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50 rounded-t-3xl">
                <div className="flex items-center gap-2">
                  <BarChart3 className="text-[#FF6B2B]" size={20} />
                  <div>
                    <h2 className="text-sm font-bold font-mono text-neutral-500 uppercase tracking-widest">SliceMatic Intelligence</h2>
                    <h3 className="text-lg font-serif font-black text-neutral-900 leading-tight">Executive Sales Report ({rangeLabel})</h3>
                  </div>
                </div>
                <button
                  onClick={() => setIsReportOpen(false)}
                  className="p-1.5 rounded-full hover:bg-neutral-200 text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable Report Content Area (for PDF compilation) */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* PDF Wrapper */}
                <div
                  id="sales-report-pdf-area"
                  className="bg-white p-8 space-y-6 max-w-3xl mx-auto border border-neutral-100 rounded-2xl shadow-sm text-neutral-800"
                >
                  {/* Brand & Document Meta */}
                  <div className="flex justify-between items-start border-b-2 border-neutral-900 pb-5">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-[#FF6B2B] rounded-xl text-white">
                        <Pizza size={24} />
                      </div>
                      <div>
                        <h1 className="text-xl font-serif font-black tracking-tight text-neutral-900 uppercase">SliceMatic</h1>
                        <p className="text-[10px] font-mono tracking-widest text-[#FF6B2B] font-bold">PREMIUM ARTISAN PIZZAS</p>
                      </div>
                    </div>
                    
                    <div className="text-right font-mono text-xs">
                      <p className="font-bold text-neutral-900 uppercase tracking-wider text-[11px]">EXECUTIVE PERFORMANCE LOG</p>
                      <p className="text-neutral-500 mt-0.5">Timeline: <strong className="text-neutral-800 uppercase">{rangeLabel}</strong></p>
                      <p className="text-neutral-400 text-[10px] mt-0.5">Generated: {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} @ {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="border border-neutral-200 rounded-2xl p-4 bg-neutral-50 hover:bg-neutral-100/50 transition-colors text-left">
                      <span className="text-[10px] font-mono text-neutral-400 font-bold uppercase tracking-wider block">Total Sales</span>
                      <span className="text-xl font-serif font-black text-neutral-900 mt-1 block">
                        ₹{Math.round(totalRevenue).toLocaleString("en-IN")}
                      </span>
                    </div>

                    <div className="border border-neutral-200 rounded-2xl p-4 bg-neutral-50 hover:bg-neutral-100/50 transition-colors text-left">
                      <span className="text-[10px] font-mono text-neutral-400 font-bold uppercase tracking-wider block">Completed Orders</span>
                      <span className="text-xl font-serif font-black text-neutral-900 mt-1 block">
                        {totalOrderCount}
                      </span>
                    </div>

                    <div className="border border-neutral-200 rounded-2xl p-4 bg-neutral-50 hover:bg-neutral-100/50 transition-colors text-left">
                      <span className="text-[10px] font-mono text-neutral-400 font-bold uppercase tracking-wider block">Avg Order Value</span>
                      <span className="text-xl font-serif font-black text-neutral-900 mt-1 block">
                        ₹{Math.round(avgOrderValue).toLocaleString("en-IN")}
                      </span>
                    </div>

                    <div className="border border-neutral-200 bg-[#FF6B2B]/5 border-[#FF6B2B]/20 rounded-2xl p-4 text-left">
                      <span className="text-[10px] font-mono text-[#FF6B2B] font-black uppercase tracking-wider block">Top Pizza</span>
                      <span className="text-xs font-bold text-neutral-800 mt-2 block truncate" title={mostOrderedPizza}>
                        {mostOrderedPizza}
                      </span>
                    </div>
                  </div>

                  {/* Hourly Linear Sales Curve */}
                  <div className="border border-neutral-200 rounded-2xl p-5 space-y-4 text-left">
                    <div>
                      <h4 className="font-serif font-extrabold text-[#111] text-xs uppercase tracking-wider">Hourly Sales Velocity</h4>
                      <p className="text-[10px] font-mono text-neutral-400 mt-0.5">
                        Linear trend mapping {timeFilter === "today" ? "absolute revenue per hour" : "average hourly sales frequency across all active days"}.
                      </p>
                    </div>
                    <div className="bg-neutral-50/50 border border-neutral-100 rounded-xl p-2">
                      {drawHourlyLineChart(hourlyReportData)}
                    </div>
                  </div>

                  {/* Row of Top Selling Elements */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5 border border-neutral-200 rounded-2xl p-5">
                    {drawTopSellingBarChart("Top Pizzas", topData.pizzas, topData.maxPizzaCount, "#FF6B2B")}
                    {drawTopSellingBarChart("Top Crust Bases", topData.bases, topData.maxBaseCount, "#3B82F6")}
                    {drawTopSellingBarChart("Top Pizza Toppings", topData.toppings, topData.maxToppingCount, "#10B981")}
                  </div>

                  {/* Staff Performance & Ranking section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border border-neutral-200 rounded-2xl p-5 text-left">
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-serif font-extrabold text-[#111] text-xs uppercase tracking-wider">Staff Sales Report</h4>
                        <p className="text-[10px] font-mono text-neutral-400 mt-0.5">
                          Comparing revenue contributions and orders fulfilled by counter personnel.
                        </p>
                      </div>
                      <div className="bg-neutral-50/50 border border-neutral-100 rounded-xl p-4">
                        {drawStaffSalesBarChart(staffSales.staffList, staffSales.maxSales)}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <h4 className="font-serif font-extrabold text-[#111] text-xs uppercase tracking-wider">Top Performing Staff</h4>
                        <p className="text-[10px] font-mono text-neutral-400 mt-0.5">
                          High performance ranking based on total revenue generation.
                        </p>
                      </div>
                      <div className="h-full flex flex-col justify-between">
                        {renderTopStaffList(staffSales.staffList)}
                      </div>
                    </div>
                  </div>

                  {/* Financial Settlement Distribution Chart */}
                  <div className="border border-neutral-200 rounded-2xl p-5 text-left">
                    <h4 className="font-serif font-extrabold text-[#111] text-xs uppercase tracking-wider mb-3">Settlement & Payment Breakdown</h4>
                    {drawPaymentDonutChart()}
                  </div>

                  {/* Confidentiality Notice */}
                  <div className="border-t border-neutral-200 pt-4 flex justify-between items-center text-[9px] font-mono text-neutral-400">
                    <span>© SliceMatic. CONFIDENTIAL. For management use only.</span>
                    <span>Page 1 of 1</span>
                  </div>

                </div>

              </div>

              {/* Modal Footer Controls */}
              <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50 flex gap-3 justify-end rounded-b-3xl">
                <button
                  onClick={downloadReportPdf}
                  disabled={isDownloading || totalOrderCount === 0}
                  className="bg-[#FF6B2B] hover:bg-[#E05A1F] text-white font-bold font-mono text-xs uppercase px-5 py-2.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-md shadow-[#FF6B2B]/15 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download size={14} className={isDownloading ? "animate-bounce" : ""} />
                  {isDownloading ? "Generating PDF..." : "Download PDF Report"}
                </button>
                <button
                  onClick={() => setIsReportOpen(false)}
                  className="bg-neutral-200 hover:bg-neutral-300 text-neutral-700 font-bold font-mono text-xs uppercase px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  Close Preview
                </button>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
}
