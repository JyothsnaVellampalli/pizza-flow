// src/components/OrderWizard.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  Users, Phone, Hash, ChevronRight, ChevronLeft, Plus, Minus, 
  Check, Wallet, CreditCard, Landmark, CheckCircle, RefreshCw, Eye,
  Trash2, ShoppingBag, Sparkles, Printer
} from "lucide-react";
import { 
  validateName, validatePhone, validateQuantity,
  DISCOUNT_THRESHOLD 
} from "../lib/core";
import { 
  getMenuItems, createOrder, MenuItem, Order 
} from "../lib/supabase";

interface OrderWizardProps {
  source: "staff" | "customer";
  tableNumberParam?: number;
}

interface SelectedToppingConfig {
  topping: MenuItem;
  quantity: number;
}

interface CartItem {
  id: string;
  base: MenuItem;
  pizza: MenuItem;
  toppings: SelectedToppingConfig[];
  quantity: number;
}

export default function OrderWizard({ source, tableNumberParam }: OrderWizardProps) {
  const navigate = useNavigate();

  // Load menu items
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);

  // Form State
  const [step, setStep] = useState(1);
  const [tableNumber, setTableNumber] = useState<number | "">(tableNumberParam || "");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMode, setPaymentMode] = useState<"Cash" | "Card" | "UPI" | "">("");

  // Pizza Customizer state (for the pizza currently being customized)
  const [selectedBase, setSelectedBase] = useState<MenuItem | null>(null);
  const [selectedPizza, setSelectedPizza] = useState<MenuItem | null>(null);
  const [selectedToppings, setSelectedToppings] = useState<SelectedToppingConfig[]>([]);

  // Cart state (the collection of pizzas in this order)
  const [cart, setCart] = useState<CartItem[]>([]);

  // Errors State
  const [errors, setErrors] = useState<{
    name?: string;
    phone?: string;
  }>({});

  // Placed Order State (for Step 5)
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  // Warning and delete confirmation states
  const [qtyErrorId, setQtyErrorId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [cartError, setCartError] = useState<string | null>(null);

  // Fetch Menu on Mount
  useEffect(() => {
    async function load() {
      try {
        const items = await getMenuItems();
        // Only active items for ordering
        setMenuItems(items.filter(i => i.is_active));
      } catch (err) {
        console.error("Error loading menu:", err);
      } finally {
        setLoadingMenu(false);
      }
    }
    load();
  }, []);

  // Sync route params with table state if customer
  useEffect(() => {
    if (tableNumberParam) {
      setTableNumber(tableNumberParam);
    }
  }, [tableNumberParam]);

  // Validation handlers
  const handleNameBlur = () => {
    const result = validateName(customerName);
    setErrors(prev => ({ ...prev, name: result.ok ? undefined : result.error }));
  };

  const handlePhoneBlur = () => {
    const result = validatePhone(customerPhone);
    setErrors(prev => ({ ...prev, phone: result.ok ? undefined : result.error }));
  };

  // Toggle Topping Selection / Adjust individual Topping Quantity
  const handleToppingToggle = (topping: MenuItem) => {
    setSelectedToppings(prev => {
      const existing = prev.find(t => t.topping.id === topping.id);
      if (existing) {
        // Toggle off if already exists
        return prev.filter(t => t.topping.id !== topping.id);
      } else {
        // Add with default qty of 1
        return [...prev, { topping, quantity: 1 }];
      }
    });
  };

  const adjustToppingQty = (toppingId: string, delta: number) => {
    setSelectedToppings(prev => {
      return prev.map(t => {
        if (t.topping.id === toppingId) {
          const newQty = Math.max(1, Math.min(3, t.quantity + delta)); // restrict between 1 and 3
          return { ...t, quantity: newQty };
        }
        return t;
      });
    });
  };

  // Add Customized Pizza to Cart
  const handleAddPizzaToCart = () => {
    if (!selectedBase || !selectedPizza) return;

    // Calculate current total quantity in cart
    const currentTotalQty = cart.reduce((sum, item) => sum + item.quantity, 0);

    if (currentTotalQty + 1 > 10) {
      setCartError("Adding another pizza would exceed the overall limit of 10 pizzas per order.");
      return;
    }

    setCartError(null);

    const cartItem: CartItem = {
      id: `cart-${Math.random().toString(36).substr(2, 9)}`,
      base: selectedBase,
      pizza: selectedPizza,
      toppings: [...selectedToppings],
      quantity: 1
    };

    setCart(prev => [...prev, cartItem]);

    // Reset Customizer fields for next pizza (keep base/pizza as convenient starting choices)
    setSelectedBase(null);
    setSelectedPizza(null);
    setSelectedToppings([]);
  };

  // Cart operations
  const adjustCartItemQty = (id: string, delta: number) => {
    // Calculate current total quantity
    const currentTotalQty = cart.reduce((sum, item) => sum + item.quantity, 0);

    if (delta > 0 && currentTotalQty + delta > 10) {
      setCartError("Increasing quantity would exceed the overall limit of 10 pizzas per order.");
      return;
    }

    setCartError(null);

    setCart(prev => {
      return prev.map(item => {
        if (item.id === id) {
          if (item.quantity === 10 && delta > 0) {
            setQtyErrorId(id);
            return item;
          }
          if (qtyErrorId === id && delta < 0) {
            setQtyErrorId(null);
          }
          const newQty = Math.max(1, Math.min(10, item.quantity + delta));
          return { ...item, quantity: newQty };
        }
        return item;
      });
    });
  };

  const removeCartItem = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
    setCartError(null);
  };

  // Calculate pricing for a single customized pizza configuration
  const getSinglePizzaPrice = (base: MenuItem, pizza: MenuItem, toppingsList: SelectedToppingConfig[]) => {
    const baseP = Number(base.price_inr);
    const pizzaP = Number(pizza.price_inr);
    const toppingsP = toppingsList.reduce((sum, t) => sum + (Number(t.topping.price_inr) * t.quantity), 0);
    return baseP + pizzaP + toppingsP;
  };

  // Calculate overall cart pricing, tax, and discount
  const getCartTotals = () => {
    let subtotal = 0;
    let totalQuantity = 0;

    cart.forEach(item => {
      const itemUnitPrice = getSinglePizzaPrice(item.base, item.pizza, item.toppings);
      subtotal += itemUnitPrice * item.quantity;
      totalQuantity += item.quantity;
    });

    // 10% discount if 5 or more total pizzas in order
    const discount = totalQuantity >= DISCOUNT_THRESHOLD ? subtotal * 0.1 : 0;
    const taxableAmount = subtotal - discount;
    const gst = taxableAmount * 0.18;
    const totalPayable = taxableAmount + gst;

    return {
      subtotal,
      totalQuantity,
      discount,
      taxableAmount,
      gst,
      totalPayable
    };
  };

  const cartTotals = getCartTotals();

  // Navigation guards
  const isStep1Valid = 
    tableNumber !== "" && 
    customerName.trim().length >= 2 && 
    !errors.name && 
    customerPhone.trim().length === 10 && 
    !errors.phone;

  const isStep2Valid = cart.length > 0;
  const isStep4Valid = paymentMode !== "";

  // Reset wizard state
  const handleReset = () => {
    setStep(1);
    setTableNumber(tableNumberParam || "");
    setCustomerName("");
    setCustomerPhone("");
    setPaymentMode("");
    setSelectedBase(null);
    setSelectedPizza(null);
    setSelectedToppings([]);
    setCart([]);
    setErrors({});
    setPlacedOrder(null);
    setQtyErrorId(null);
    setDeleteConfirmId(null);
    setCartError(null);
  };

  // Place full multi-pizza order
  const handlePlaceOrder = async () => {
    if (!isStep4Valid || cart.length === 0) return;
    setIsPlacingOrder(true);

    // Build the final snaps for backward compatibility matching OrderSummary's parser
    const snapshots: Array<{ menu_item_id: string; category: string; name: string; unit_price_snapshot: number }> = [];

    cart.forEach((item, idx) => {
      const pizzaNum = idx + 1;

      // 1. Base Crust
      snapshots.push({
        menu_item_id: item.base.id,
        category: "base",
        name: `${item.base.name} (Pizza #${pizzaNum})`,
        unit_price_snapshot: Number(item.base.price_inr)
      });

      // 2. Main Pizza Recipe
      snapshots.push({
        menu_item_id: item.pizza.id,
        category: "pizza",
        name: `${item.pizza.name} (Pizza #${pizzaNum})`,
        unit_price_snapshot: Number(item.pizza.price_inr)
      });

      // 3. Selected Premium Toppings with quantity
      item.toppings.forEach(t => {
        snapshots.push({
          menu_item_id: t.topping.id,
          category: "topping",
          name: `${t.topping.name} (x${t.quantity}) (Pizza #${pizzaNum})`,
          unit_price_snapshot: Number(t.topping.price_inr) * t.quantity
        });
      });
    });

    const orderData = {
      table_number: Number(tableNumber),
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      quantity: cartTotals.totalQuantity,
      unit_price: cartTotals.totalQuantity > 0 ? (cartTotals.subtotal / cartTotals.totalQuantity) : 0,
      subtotal: cartTotals.subtotal,
      discount: cartTotals.discount,
      gst: cartTotals.gst,
      total_payable: cartTotals.totalPayable,
      payment_mode: paymentMode as "Cash" | "Card" | "UPI",
      order_source: source,
      status: "confirmed" as const,
    };

    try {
      const order = await createOrder(orderData, snapshots);
      // Cache rich items layout locally for instant beautiful preview in OrderSummary
      const richItems = cart.map((item, idx) => ({
        index: idx + 1,
        base: { name: item.base.name, price: Number(item.base.price_inr) },
        pizza: { name: item.pizza.name, price: Number(item.pizza.price_inr) },
        toppings: item.toppings.map(t => ({
          name: t.topping.name,
          price: Number(t.topping.price_inr),
          qty: t.quantity
        }))
      }));
      (order as any).rich_items = richItems;

      setPlacedOrder(order);
      setStep(5);
    } catch (e) {
      console.error("Order submission failed:", e);
      alert("Something went wrong placing the order. Please try again.");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const bases = menuItems.filter(item => item.category === "base");
  const pizzas = menuItems.filter(item => item.category === "pizza");
  const toppings = menuItems.filter(item => item.category === "topping");

  // Automatically select default base & pizza on first load of step 2
  useEffect(() => {
    if (step === 2 && menuItems.length > 0) {
      if (!selectedBase && bases.length > 0) setSelectedBase(bases[0]);
      if (!selectedPizza && pizzas.length > 0) setSelectedPizza(pizzas[0]);
    }
  }, [step, menuItems]);

  if (loadingMenu) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#FF6B2B] mb-4"></div>
        <p className="text-[#9E9E9E] font-medium">Stretching the dough... Loading menu...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto bg-[#252525] border border-[#333333] rounded-2xl shadow-2xl overflow-hidden">
      {/* PERSISTENT HEADER BAR */}
      <div className="bg-[#1F1F1F] px-6 py-4 border-b border-[#333333] flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-[#FF6B2B]/10 p-2 rounded-lg text-[#FF6B2B]">
            <Hash size={20} />
          </div>
          <div>
            <h2 className="text-[#FAFAFA] font-serif text-lg">New Ashok Nagar Outlet</h2>
            <p className="text-[#9E9E9E] text-xs font-mono">PizzaFlow System v1.1</p>
          </div>
        </div>

        {/* Dynamic table selection badge requested by prompt */}
        {tableNumber && (
          <div className="flex items-center gap-3">
            <span className="bg-[#FF6B2B] text-white px-3 py-1 rounded-full text-xs font-bold font-mono uppercase tracking-wider">
              Table {tableNumber}
            </span>
            {customerName && (
              <span className="text-[#FAFAFA] text-sm font-medium hidden sm:inline border-l border-neutral-700 pl-3">
                {customerName}
              </span>
            )}
          </div>
        )}

        {/* Wizard Progress Stepper */}
        {step <= 4 && (
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4].map((num) => (
              <div 
                key={num}
                className={`w-10 h-1.5 rounded-full transition-all duration-300 ${
                  step >= num 
                    ? "bg-[#FF6B2B]" 
                    : "bg-white/10"
                }`}
                title={`Step ${num}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* STEP ANIMATION CONTAINER */}
      <div className="p-6 md:p-8">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="border-b border-white/5 pb-4">
                <h3 className="text-xl font-serif text-[#FAFAFA] tracking-tight">Step 1: Table & Customer Information</h3>
                <p className="text-[#9E9E9E] text-sm">Please verify table availability and capture contact details.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Table selector */}
                <div className="space-y-2">
                  <label id="lbl-table" className="block text-sm font-medium text-[#FAFAFA] font-mono">
                    Table Number <span className="text-[#FF6B2B]">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="select-table"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value ? Number(e.target.value) : "")}
                      className="w-full bg-[#1A1A1A] border border-white/10 text-[#FAFAFA] rounded-xl px-4 py-3 appearance-none focus:outline-none focus:border-[#FF6B2B] hover:border-[#FF6B2B]/50 transition-colors"
                    >
                      <option value="">Select Table (1 - 20)</option>
                      {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => (
                        <option key={num} value={num}>Table {num}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#9E9E9E]">
                      ▼
                    </div>
                  </div>
                </div>

                {/* Customer Name */}
                <div className="space-y-2">
                  <label id="lbl-name" className="block text-sm font-medium text-[#FAFAFA] font-mono">
                    Customer Name <span className="text-[#FF6B2B]">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9E9E9E]">
                      <Users size={18} />
                    </span>
                    <input
                      id="input-customer-name"
                      type="text"
                      placeholder="e.g. Rajat Sharma"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      onBlur={handleNameBlur}
                      className={`w-full bg-[#1A1A1A] border ${errors.name ? "border-[#FF3B30]" : "border-white/10 hover:border-[#FF6B2B]/50"} text-[#FAFAFA] rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:border-[#FF6B2B] transition-colors`}
                    />
                  </div>
                  {errors.name && (
                    <p className="text-[#FF3B30] text-xs font-mono animate-pulse">{errors.name}</p>
                  )}
                </div>

                {/* Customer Phone */}
                <div className="space-y-2">
                  <label id="lbl-phone" className="block text-sm font-medium text-[#FAFAFA] font-mono">
                    Customer Phone <span className="text-[#FF6B2B]">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9E9E9E]">
                      <Phone size={18} />
                    </span>
                    <input
                      id="input-customer-phone"
                      type="tel"
                      placeholder="10-digit mobile number"
                      maxLength={10}
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ""))}
                      onBlur={handlePhoneBlur}
                      className={`w-full bg-[#1A1A1A] border ${errors.phone ? "border-[#FF3B30]" : "border-white/10 hover:border-[#FF6B2B]/50"} text-[#FAFAFA] rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:border-[#FF6B2B] transition-colors`}
                    />
                  </div>
                  {errors.phone && (
                    <p className="text-[#FF3B30] text-xs font-mono animate-pulse">{errors.phone}</p>
                  )}
                </div>
              </div>

              {/* Step Navigation bar */}
              <div className="flex justify-end pt-6 border-t border-white/5">
                <button
                  id="btn-next-1"
                  disabled={!isStep1Valid}
                  onClick={() => setStep(2)}
                  className={`px-8 py-3 rounded-lg font-bold uppercase tracking-wider transition-all text-sm flex items-center gap-2 ${
                    isStep1Valid 
                      ? "bg-[#FF6B2B] hover:bg-[#E05A1F] text-white cursor-pointer shadow-lg shadow-[#FF6B2B]/20" 
                      : "bg-[#333333] text-[#9E9E9E] cursor-not-allowed"
                  }`}
                >
                  Next: Customise Pizza <ChevronRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="border-b border-white/5 pb-4 flex justify-between items-center flex-wrap gap-2">
                <div>
                  <h3 className="text-xl font-serif text-[#FAFAFA] tracking-tight">Step 2: Build & Add Pizzas</h3>
                  <p className="text-[#9E9E9E] text-sm">Select Base, Recipe, and multiple premium toppings with quantities, then add to your cart.</p>
                </div>
                <button 
                  onClick={() => setStep(1)}
                  className="px-3 py-1.5 rounded-lg border border-white/10 text-[#FAFAFA] text-xs hover:bg-[#333333] transition-colors cursor-pointer"
                >
                  ← Edit Customer Info
                </button>
              </div>

              {/* THREE COLUMN PIZZA BUILDER GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                {/* COLUMN 1: BASES */}
                <div className="space-y-3">
                  <h4 className="font-serif text-lg text-[#FF6B2B] mb-4 border-b border-white/10 pb-2 flex justify-between items-center">
                    <span>01. Base Crust</span>
                    <span className="text-xs font-mono text-[#9E9E9E] uppercase">Select 1</span>
                  </h4>
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {bases.map((b) => (
                      <div
                        key={b.id}
                        onClick={() => setSelectedBase(b)}
                        className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                          selectedBase?.id === b.id
                            ? "bg-[#FFF3E0] border-[#FF6B2B] text-[#1A1A1A] shadow-lg shadow-[#FF6B2B]/15"
                            : "bg-[#252525] border-white/10 hover:border-[#FF6B2B]/50 text-[#FAFAFA]"
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                            selectedBase?.id === b.id ? "bg-[#FF6B2B] text-white" : "bg-[#333333] text-[#FAFAFA]"
                          }`}>
                            {b.code}
                          </span>
                          <span className={`font-bold font-mono text-sm ${selectedBase?.id === b.id ? "text-[#FF6B2B]" : "text-[#FF6B2B]"}`}>₹{Number(b.price_inr).toFixed(2)}</span>
                        </div>
                        <h5 className={`font-semibold text-sm mt-2 ${
                          selectedBase?.id === b.id ? "text-[#1A1A1A]" : "text-[#FAFAFA]"
                        }`}>{b.name}</h5>
                        {b.description && (
                          <p className={`text-xs mt-1 leading-snug ${
                            selectedBase?.id === b.id ? "text-[#1A1A1A]/85" : "text-[#9E9E9E]"
                          }`}>{b.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* COLUMN 2: PIZZAS */}
                <div className="space-y-3">
                  <h4 className="font-serif text-lg text-[#FF6B2B] mb-4 border-b border-white/10 pb-2 flex justify-between items-center">
                    <span>02. Pizza Recipe</span>
                    <span className="text-xs font-mono text-[#9E9E9E] uppercase">Select 1</span>
                  </h4>
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {pizzas.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => setSelectedPizza(p)}
                        className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                          selectedPizza?.id === p.id
                            ? "bg-[#FFF3E0] border-[#FF6B2B] text-[#1A1A1A] shadow-lg shadow-[#FF6B2B]/15"
                            : "bg-[#252525] border-white/10 hover:border-[#FF6B2B]/50 text-[#FAFAFA]"
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                            selectedPizza?.id === p.id ? "bg-[#FF6B2B] text-white" : "bg-[#333333] text-[#FAFAFA]"
                          }`}>
                            {p.code}
                          </span>
                          <span className={`font-bold font-mono text-sm ${selectedPizza?.id === p.id ? "text-[#FF6B2B]" : "text-[#FF6B2B]"}`}>₹{Number(p.price_inr).toFixed(2)}</span>
                        </div>
                        <h5 className={`font-semibold text-sm mt-2 ${
                          selectedPizza?.id === p.id ? "text-[#1A1A1A]" : "text-[#FAFAFA]"
                        }`}>{p.name}</h5>
                        {p.description && (
                          <p className={`text-xs mt-1 leading-snug ${
                            selectedPizza?.id === p.id ? "text-[#1A1A1A]/85" : "text-[#9E9E9E]"
                          }`}>{p.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* COLUMN 3: MULTIPLE TOPPINGS SELECTION */}
                <div className="space-y-3">
                  <h4 className="font-serif text-lg text-[#FF6B2B] mb-4 border-b border-white/10 pb-2 flex justify-between items-center">
                    <span>03. Toppings</span>
                    <span className="text-xs font-mono text-[#9E9E9E] uppercase">Select multiple</span>
                  </h4>
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {toppings.map((t) => {
                      const selectedConfig = selectedToppings.find(st => st.topping.id === t.id);
                      const isSelected = !!selectedConfig;
                      const toppingQty = selectedConfig?.quantity || 0;

                      return (
                        <div
                          key={t.id}
                          className={`p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between ${
                            isSelected
                              ? "bg-[#FFF3E0]/95 border-[#FF6B2B] text-[#1A1A1A]"
                              : "bg-[#252525] border-white/10 text-[#FAFAFA] hover:border-[#FF6B2B]/50"
                          }`}
                        >
                          {/* Topping Header */}
                          <div 
                            onClick={() => handleToppingToggle(t)}
                            className="flex justify-between items-start gap-2 cursor-pointer w-full"
                          >
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                                isSelected ? "bg-[#FF6B2B] text-white" : "bg-[#333333] text-[#FAFAFA]"
                              }`}>
                                {t.code}
                              </span>
                              <span className="text-xs font-bold text-emerald-600 font-mono">
                                {isSelected && `✓ Added`}
                              </span>
                            </div>
                            <span className="font-bold font-mono text-sm">₹{Number(t.price_inr).toFixed(2)}</span>
                          </div>

                          {/* Topping Title */}
                          <div 
                            onClick={() => handleToppingToggle(t)}
                            className="mt-2 cursor-pointer"
                          >
                            <h5 className={`font-semibold text-sm ${isSelected ? "text-[#1A1A1A]" : "text-[#FAFAFA]"}`}>{t.name}</h5>
                            {t.description && (
                              <p className={`text-xs mt-0.5 leading-snug ${isSelected ? "text-[#1A1A1A]/85" : "text-[#9E9E9E]"}`}>{t.description}</p>
                            )}
                          </div>

                          {/* Topping Quantity selector (Only visible if selected) */}
                          {isSelected && (
                            <div className="mt-3 pt-2.5 border-t border-black/5 flex items-center justify-between">
                              <span className="text-xs font-mono font-medium text-[#1A1A1A]/80 uppercase">Topping Multiplier</span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => adjustToppingQty(t.id, -1)}
                                  disabled={toppingQty <= 1}
                                  className="w-6 h-6 rounded bg-[#1A1A1A] text-white flex items-center justify-center font-bold text-xs disabled:opacity-30 cursor-pointer"
                                >
                                  -
                                </button>
                                <span className="font-mono text-xs font-bold bg-[#1A1A1A] text-white px-2.5 py-0.5 rounded">
                                  x{toppingQty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => adjustToppingQty(t.id, 1)}
                                  disabled={toppingQty >= 3}
                                  className="w-6 h-6 rounded bg-[#1A1A1A] text-white flex items-center justify-center font-bold text-xs disabled:opacity-30 cursor-pointer"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* CURRENT CONFIGURATION LIVE PREVIEW & ADD TO CART CTA */}
              <div className="bg-[#1F1F1F] rounded-xl p-6 border border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-mono text-[#9E9E9E] uppercase block">Recipe Preview</span>
                  <p className="text-white text-sm leading-relaxed font-serif italic">
                    {selectedBase?.name || "..."} Crust + {selectedPizza?.name || "..."}
                    {selectedToppings.length > 0 && " + Toppings: "}
                    {selectedToppings.map((st, i) => (
                      <span key={st.topping.id} className="text-[#FF6B2B] font-sans font-semibold not-italic">
                        {st.topping.name} (x{st.quantity}){i < selectedToppings.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </p>
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto shrink-0 justify-end">
                  <div className="text-right">
                    <span className="text-[#9E9E9E] text-xs font-mono uppercase block">Pizza Subtotal</span>
                    <span className="text-[#FF6B2B] font-bold font-mono text-xl">
                      ₹{selectedBase && selectedPizza ? getSinglePizzaPrice(selectedBase, selectedPizza, selectedToppings).toFixed(2) : "0.00"}
                    </span>
                  </div>
                  <button
                    onClick={handleAddPizzaToCart}
                    disabled={!selectedBase || !selectedPizza}
                    className={`px-6 py-3.5 rounded-xl font-bold uppercase tracking-wider text-xs flex items-center gap-2 transition-all ${
                      selectedBase && selectedPizza
                        ? "bg-[#FF6B2B] hover:bg-[#E05A1F] text-white cursor-pointer shadow-lg shadow-[#FF6B2B]/20"
                        : "bg-[#333333] text-[#9E9E9E] cursor-not-allowed"
                    }`}
                  >
                    <Plus size={16} /> Add Pizza to Cart
                  </button>
                </div>
              </div>

              {/* CURRENT CART SUMMARY RAIL */}
              {cart.length > 0 && (
                <div className="bg-[#1C1C1C] rounded-2xl border border-white/5 p-5 space-y-4">
                  <h4 className="text-[#FAFAFA] font-medium font-serif flex items-center gap-2">
                    <ShoppingBag size={18} className="text-[#FF6B2B]" />
                    <span>Selected Pizzas in Cart ({cart.length})</span>
                  </h4>

                  <div className="divide-y divide-white/5 font-mono text-sm">
                    {cart.map((item, idx) => {
                      const itemUnitPrice = getSinglePizzaPrice(item.base, item.pizza, item.toppings);

                      return (
                        <div key={item.id} className="py-3 flex flex-wrap justify-between items-center gap-4">
                          <div className="space-y-1 max-w-xl">
                            <div className="flex items-center gap-2">
                              <span className="text-[#FF6B2B] font-bold text-xs bg-[#FF6B2B]/10 px-2 py-0.5 rounded">Pizza #{idx + 1}</span>
                              <span className="text-white font-serif font-semibold text-sm">{item.pizza.name}</span>
                            </div>
                            <p className="text-xs text-[#9E9E9E]">
                              Base: {item.base.name} | Toppings: {item.toppings.length === 0 ? "None" : item.toppings.map(t => `${t.topping.name} (x${t.quantity})`).join(", ")}
                            </p>
                            {qtyErrorId === item.id && (
                              <div className="text-[#FF6B2B] text-xs font-mono mt-1.5 bg-[#FF6B2B]/5 border border-[#FF6B2B]/20 p-2.5 rounded-xl animate-pulse">
                                ⚠️ Maximum quantity limit reached. To ensure kitchen preparation and baking quality, each pizza configuration is capped at 10 units.
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-6">
                            {/* Quantity Adjustment */}
                            <div className="flex items-center gap-2 bg-[#252525] border border-white/10 rounded-lg p-1">
                              <button
                                type="button"
                                onClick={() => adjustCartItemQty(item.id, -1)}
                                className="w-6 h-6 rounded bg-[#1C1C1C] text-white font-bold flex items-center justify-center text-xs hover:bg-[#FF6B2B]/10 transition-colors cursor-pointer"
                              >
                                -
                              </button>
                              <span className="text-white px-2 font-bold min-w-[20px] text-center">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => adjustCartItemQty(item.id, 1)}
                                className="w-6 h-6 rounded bg-[#1C1C1C] text-white font-bold flex items-center justify-center text-xs hover:bg-[#FF6B2B]/10 transition-colors cursor-pointer"
                              >
                                +
                              </button>
                            </div>

                            <span className="text-white font-bold text-sm w-20 text-right">
                              ₹{(itemUnitPrice * item.quantity).toFixed(2)}
                            </span>

                            {deleteConfirmId === item.id ? (
                              <div className="flex items-center gap-2 bg-red-950/40 border border-red-500/30 px-3 py-1.5 rounded-xl animate-fade-in">
                                <span className="text-xs font-mono text-red-200">Delete item from cart?</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    removeCartItem(item.id);
                                    setDeleteConfirmId(null);
                                  }}
                                  className="px-2 py-0.5 bg-[#FF3B30] text-white text-xs rounded font-bold hover:bg-[#D32F2F] cursor-pointer"
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="px-2 py-0.5 bg-neutral-700 text-white text-xs rounded font-bold hover:bg-neutral-600 cursor-pointer"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(item.id)}
                                className="text-neutral-500 hover:text-red-400 p-1 transition-colors cursor-pointer"
                                title="Delete pizza"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {cartError && (
                <div className="mb-4 bg-[#FF6B2B]/10 border border-[#FF6B2B]/30 rounded-xl p-4 text-[#FF6B2B] text-sm flex items-center gap-3 font-medium font-mono animate-pulse">
                  <span>⚠️ {cartError}</span>
                </div>
              )}

              {/* Step Navigation bar */}
              <div className="flex justify-between pt-6 border-t border-white/5">
                <button
                  onClick={() => setStep(1)}
                  className="px-5 py-3 rounded-lg border border-white/10 text-[#FAFAFA] font-medium hover:bg-[#333333] transition-colors flex items-center gap-2 cursor-pointer text-sm"
                >
                  <ChevronLeft size={16} /> Customer Details
                </button>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-[#9E9E9E] hidden sm:inline">
                    Cart Total: <b className="text-white">₹{cartTotals.totalPayable.toFixed(2)}</b> ({cartTotals.totalQuantity} items)
                  </span>
                  <button
                    id="btn-next-2"
                    disabled={!isStep2Valid}
                    onClick={() => setStep(3)}
                    className={`px-8 py-3 rounded-lg font-bold uppercase tracking-wider transition-all text-sm flex items-center gap-2 ${
                      isStep2Valid 
                        ? "bg-[#FF6B2B] hover:bg-[#E05A1F] text-white cursor-pointer shadow-lg shadow-[#FF6B2B]/20" 
                        : "bg-[#333333] text-[#9E9E9E] cursor-not-allowed"
                    }`}
                  >
                    Next: Review Bill & Cart <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="border-b border-white/5 pb-4 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-serif text-[#FAFAFA] tracking-tight">Step 3: Review Bill & Applied Discounts</h3>
                  <p className="text-[#9E9E9E] text-sm">Review full list of pizzas. Bulk orders of 5 or more automatically get a flat 10% discount!</p>
                </div>
                <button 
                  onClick={() => setStep(2)}
                  className="px-3 py-1.5 rounded-lg border border-white/10 text-[#FAFAFA] text-xs hover:bg-[#333333] transition-colors cursor-pointer"
                >
                  ← Add More Pizzas
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                
                {/* List of pizzas inside Order */}
                <div className="space-y-4">
                  <h4 className="text-[#FAFAFA] font-medium font-serif border-b border-white/5 pb-2">Items to Prepare</h4>
                  
                  <div className="space-y-3">
                    {cart.map((item, idx) => {
                      const itemPrice = getSinglePizzaPrice(item.base, item.pizza, item.toppings);

                      return (
                        <div key={item.id} className="bg-[#252525] p-4 rounded-xl border border-white/10 space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-xs font-mono text-[#FF6B2B] font-bold bg-[#FF6B2B]/10 px-2 py-0.5 rounded mr-2">
                                Pizza #{idx + 1}
                              </span>
                              <span className="text-[#FAFAFA] font-serif font-semibold">{item.pizza.name}</span>
                            </div>
                            <span className="font-mono text-sm text-[#FAFAFA] font-bold">
                              ₹{(itemPrice * item.quantity).toFixed(2)}
                            </span>
                          </div>

                          <div className="pl-4 border-l border-white/10 space-y-1 text-xs font-mono text-[#9E9E9E]">
                            <div>• Crust: {item.base.name} (₹{Number(item.base.price_inr).toFixed(2)})</div>
                            <div>• Recipe: {item.pizza.name} (₹{Number(item.pizza.price_inr).toFixed(2)})</div>
                            {item.toppings.map(t => (
                              <div key={t.topping.id}>
                                • Topping: {t.topping.name} (x{t.quantity} - ₹{(Number(t.topping.price_inr) * t.quantity).toFixed(2)})
                              </div>
                            ))}
                            <div className="pt-1.5 text-xs text-[#FAFAFA] flex justify-between">
                              <span>Unit Price: ₹{itemPrice.toFixed(2)}</span>
                              <span>Quantity requested: ×{item.quantity}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {cartTotals.totalQuantity >= DISCOUNT_THRESHOLD ? (
                    <div className="bg-[#4CAF50]/10 border border-[#4CAF50]/30 rounded-xl p-4 text-[#4CAF50] text-sm flex items-center gap-3 justify-center font-medium">
                      <Sparkles size={18} />
                      <span>🎉 Flat 10% Discount applied!</span>
                    </div>
                  ) : (
                    <div className="bg-[#FF6B2B]/5 border border-[#FF6B2B]/20 rounded-xl p-4 text-[#9E9E9E] text-xs text-center leading-relaxed">
                      💡 Tip: Add <span className="text-[#FF6B2B] font-bold font-mono">{DISCOUNT_THRESHOLD - cartTotals.totalQuantity}</span> more pizzas to qualify for a <span className="text-[#FF6B2B] font-bold">10% discount</span> on your bill!
                    </div>
                  )}
                </div>

                {/* Final Bill Breakdown block */}
                <div className="bg-[#252525] p-6 rounded-xl border border-[#333333] space-y-4 shadow-xl">
                  <h4 className="text-[#FAFAFA] font-medium font-serif border-b border-white/5 pb-2 flex justify-between items-center">
                    <span>Invoice Details estimate</span>
                    <span className="text-xs font-mono text-[#9E9E9E] uppercase">GST Rate: 18%</span>
                  </h4>

                  <div className="space-y-2.5 text-sm font-mono">
                    <div className="flex justify-between text-[#9E9E9E]">
                      <span>Items Subtotal:</span>
                      <span>₹{cartTotals.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[#9E9E9E]">
                      <span>Total Pizzas in Cart:</span>
                      <span>{cartTotals.totalQuantity} Pcs</span>
                    </div>

                    {cartTotals.discount > 0 && (
                      <div className="flex justify-between text-[#4CAF50] font-medium pt-1.5 border-t border-white/5">
                        <span>Flat 10% Bulk Discount:</span>
                        <span>−₹{cartTotals.discount.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-[#FAFAFA] pt-1.5 border-t border-white/5 font-medium">
                      <span>Taxable Amount:</span>
                      <span>₹{cartTotals.taxableAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[#9E9E9E]">
                      <span>GST (18% SGST + CGST):</span>
                      <span>+₹{cartTotals.gst.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between text-[#FAFAFA] pt-3.5 border-t border-double border-white/10 text-xl font-bold">
                      <span className="font-serif">Total Payable:</span>
                      <span className="text-[#FF6B2B]">₹{cartTotals.totalPayable.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Step Navigation bar */}
              <div className="flex justify-between pt-6 border-t border-white/5">
                <button
                  onClick={() => setStep(2)}
                  className="px-5 py-3 rounded-lg border border-white/10 text-[#FAFAFA] font-medium hover:bg-[#333333] transition-colors flex items-center gap-2 cursor-pointer text-sm"
                >
                  <ChevronLeft size={16} /> Edit Pizzas
                </button>
                <button
                  id="btn-next-3"
                  onClick={() => setStep(4)}
                  className="px-8 py-3 bg-[#FF6B2B] hover:bg-[#E05A1F] text-white rounded-lg font-bold uppercase tracking-wider transition-all text-sm flex items-center gap-2 shadow-lg shadow-[#FF6B2B]/20 cursor-pointer"
                >
                  Next: Choose Payment Mode <ChevronRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="border-b border-white/5 pb-4 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-serif text-[#FAFAFA] tracking-tight">Step 4: Select Payment Method</h3>
                  <p className="text-[#9E9E9E] text-sm">Please finalize payment mode at the counter to place order.</p>
                </div>
                <button 
                  onClick={() => setStep(3)}
                  className="px-3 py-1.5 rounded-lg border border-white/10 text-[#FAFAFA] text-xs hover:bg-[#333333] transition-colors cursor-pointer"
                >
                  ← Edit Invoice Details
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* CASH */}
                <button
                  type="button"
                  id="btn-pay-cash"
                  onClick={() => setPaymentMode("Cash")}
                  className={`p-6 rounded-2xl border flex flex-col items-center justify-center gap-4 transition-all duration-300 cursor-pointer ${
                    paymentMode === "Cash"
                      ? "bg-[#FFF3E0] border-[#FF6B2B] text-[#1A1A1A] shadow-lg shadow-[#FF6B2B]/15 scale-[1.02]"
                      : "bg-[#252525] border-white/10 text-[#FAFAFA] hover:border-[#FF6B2B]/50"
                  }`}
                >
                  <span className="text-[#FF6B2B]">
                    <Wallet size={36} />
                  </span>
                  <div className="text-center">
                    <span className={`block font-bold text-base font-serif ${paymentMode === "Cash" ? "text-[#1A1A1A]" : "text-[#FAFAFA]"}`}>💵 Cash Payment</span>
                    <span className={`text-xs font-mono ${paymentMode === "Cash" ? "text-[#1A1A1A]/80" : "text-[#9E9E9E]"}`}>Collect at counter</span>
                  </div>
                </button>

                {/* CARD */}
                <button
                  type="button"
                  id="btn-pay-card"
                  onClick={() => setPaymentMode("Card")}
                  className={`p-6 rounded-2xl border flex flex-col items-center justify-center gap-4 transition-all duration-300 cursor-pointer ${
                    paymentMode === "Card"
                      ? "bg-[#FFF3E0] border-[#FF6B2B] text-[#1A1A1A] shadow-lg shadow-[#FF6B2B]/15 scale-[1.02]"
                      : "bg-[#252525] border-white/10 text-[#FAFAFA] hover:border-[#FF6B2B]/50"
                  }`}
                >
                  <span className="text-[#FF6B2B]">
                    <CreditCard size={36} />
                  </span>
                  <div className="text-center">
                    <span className={`block font-bold text-base font-serif ${paymentMode === "Card" ? "text-[#1A1A1A]" : "text-[#FAFAFA]"}`}>💳 Card Machine</span>
                    <span className={`text-xs font-mono ${paymentMode === "Card" ? "text-[#1A1A1A]/80" : "text-[#9E9E9E]"}`}>Visa, MasterCard, RuPay</span>
                  </div>
                </button>

                {/* UPI */}
                <button
                  type="button"
                  id="btn-pay-upi"
                  onClick={() => setPaymentMode("UPI")}
                  className={`p-6 rounded-2xl border flex flex-col items-center justify-center gap-4 transition-all duration-300 cursor-pointer ${
                    paymentMode === "UPI"
                      ? "bg-[#FFF3E0] border-[#FF6B2B] text-[#1A1A1A] shadow-lg shadow-[#FF6B2B]/15 scale-[1.02]"
                      : "bg-[#252525] border-white/10 text-[#FAFAFA] hover:border-[#FF6B2B]/50"
                  }`}
                >
                  <span className="text-[#FF6B2B]">
                    <Landmark size={36} />
                  </span>
                  <div className="text-center">
                    <span className={`block font-bold text-base font-serif ${paymentMode === "UPI" ? "text-[#1A1A1A]" : "text-[#FAFAFA]"}`}>📱 UPI Scan QR</span>
                    <span className={`text-xs font-mono ${paymentMode === "UPI" ? "text-[#1A1A1A]/80" : "text-[#9E9E9E]"}`}>GPay, PhonePe, Paytm</span>
                  </div>
                </button>
              </div>

              {/* Pricing Overview Row */}
              <div className="bg-[#252525] rounded-xl p-6 border border-white/10 flex justify-between items-center font-mono">
                <div>
                  <span className="text-[#9E9E9E] block text-xs uppercase">Paying For</span>
                  <span className="text-[#FAFAFA] font-medium text-sm">
                    {cartTotals.totalQuantity} Pizza(s) ({cart.length} distinct styles)
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[#9E9E9E] block text-xs uppercase">Total Payable Amount</span>
                  <span className="text-[#FF6B2B] font-bold text-xl">₹{cartTotals.totalPayable.toFixed(2)}</span>
                </div>
              </div>

              {/* Step Navigation bar */}
              <div className="flex justify-between pt-6 border-t border-white/5">
                <button
                  onClick={() => setStep(3)}
                  className="px-5 py-3 rounded-lg border border-white/10 text-[#FAFAFA] font-medium hover:bg-[#333333] transition-colors flex items-center gap-2 cursor-pointer text-sm"
                >
                  <ChevronLeft size={16} /> Edit Invoice Details
                </button>
                <button
                  id="btn-place-order"
                  disabled={!isStep4Valid || isPlacingOrder}
                  onClick={handlePlaceOrder}
                  className={`px-8 py-3.5 rounded-lg font-bold uppercase tracking-wider transition-all text-sm flex items-center gap-2.5 ${
                    isStep4Valid && !isPlacingOrder
                      ? "bg-[#4CAF50] hover:bg-[#43A047] text-white cursor-pointer shadow-lg shadow-[#4CAF50]/20"
                      : "bg-[#333333] text-[#9E9E9E] cursor-not-allowed"
                  }`}
                >
                  {isPlacingOrder ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                      Submitting Order...
                    </>
                  ) : (
                    <>
                      Place Order (₹{cartTotals.totalPayable.toFixed(2)}) <Check size={16} />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-8 py-8"
            >
              {/* Header Green Tick */}
              <div className="no-print flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-[#4CAF50]/10 border-2 border-[#4CAF50] flex items-center justify-center text-[#4CAF50] animate-bounce">
                  <CheckCircle size={36} />
                </div>
                <h3 className="text-2xl md:text-3xl font-serif font-bold text-[#FAFAFA]">Order Placed Successfully!</h3>
                <p className="text-[#9E9E9E] text-sm max-w-md mx-auto">
                  Kitchen ticket printed. Order has been sent directly to SliceMatic prep terminal.
                </p>
              </div>

              {/* Order Info Cards */}
              <div id="invoice-print-area" className="max-w-xl mx-auto bg-[#252525] rounded-2xl border border-white/10 p-6 space-y-6 text-left">
                
                {/* Meta details */}
                <div className="grid grid-cols-2 gap-4 border-b border-white/5 pb-4 font-mono text-sm">
                  <div>
                    <span className="text-[#9E9E9E] block text-xs uppercase">Order Reference</span>
                    <span className="text-[#FAFAFA] font-bold text-base">
                      #{placedOrder ? placedOrder.id.substring(placedOrder.id.length - 6).toUpperCase() : "A3F9C2"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#9E9E9E] block text-xs uppercase">Table Assigned</span>
                    <span className="text-[#FF6B2B] font-bold text-base">Table {placedOrder?.table_number || tableNumber}</span>
                  </div>
                  <div>
                    <span className="text-[#9E9E9E] block text-xs uppercase">Customer Details</span>
                    <span className="text-[#FAFAFA] font-medium">{placedOrder?.customer_name || customerName}</span>
                  </div>
                  <div>
                    <span className="text-[#9E9E9E] block text-xs uppercase">Payment Mode</span>
                    <span className="text-[#FAFAFA] font-medium">{placedOrder?.payment_mode || paymentMode}</span>
                  </div>
                </div>

                {/* Bill details */}
                <div className="space-y-4 font-mono text-xs border-b border-white/5 pb-4">
                  <h4 className="text-[#FAFAFA] font-medium uppercase text-xs tracking-wider border-b border-white/5 pb-1.5">Itemised Receipt</h4>
                  
                  <div className="space-y-3">
                    {cart.map((item, idx) => {
                      const itemPrice = getSinglePizzaPrice(item.base, item.pizza, item.toppings);

                      return (
                        <div key={item.id} className="space-y-1">
                          <div className="flex justify-between text-[#FAFAFA] font-serif font-medium text-xs">
                            <span>Pizza #{idx + 1}: {item.pizza.name} (x{item.quantity})</span>
                            <span>₹{(itemPrice * item.quantity).toFixed(2)}</span>
                          </div>
                          <div className="text-[11px] text-[#9E9E9E] pl-3 leading-relaxed">
                            Crust: {item.base.name}
                            {item.toppings.length > 0 && ` | Toppings: ${item.toppings.map(t => `${t.topping.name} (x${t.quantity})`).join(", ")}`}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-between text-[#FAFAFA] pt-2.5 border-t border-white/5 font-medium">
                    <span>Subtotal:</span>
                    <span>₹{cartTotals.subtotal.toFixed(2)}</span>
                  </div>

                  {cartTotals.discount > 0 && (
                    <div className="flex justify-between text-[#4CAF50] font-medium">
                      <span>Discount (10% Applied):</span>
                      <span>−₹{cartTotals.discount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-[#9E9E9E]">
                    <span>GST (18% Service Tax):</span>
                    <span>+₹{cartTotals.gst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[#FAFAFA] pt-2 border-t border-double border-white/10 text-base font-bold">
                    <span>Total Settled:</span>
                    <span className="text-[#FF6B2B]">₹{cartTotals.totalPayable.toFixed(2)}</span>
                  </div>
                </div>

                {/* Bottom Timestamp */}
                <div className="text-center text-[#9E9E9E] font-mono text-xs">
                  Printed: {new Date(placedOrder?.created_at || new Date()).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                </div>

              </div>

              {/* ACTIONS PANEL */}
              <div className="no-print flex flex-wrap items-center justify-center gap-4 max-w-xl mx-auto pt-4">
                <button
                  type="button"
                  id="btn-new-order"
                  onClick={handleReset}
                  className="px-6 py-3 rounded-lg font-bold uppercase tracking-wider text-sm bg-[#FF6B2B] hover:bg-[#E05A1F] text-white transition-all flex items-center gap-2 shadow-lg shadow-[#FF6B2B]/20 cursor-pointer"
                >
                  <RefreshCw size={16} /> Take New Order
                </button>
                <button
                  type="button"
                  id="btn-print-receipt"
                  onClick={() => window.print()}
                  className="px-6 py-3 rounded-lg font-bold uppercase tracking-wider text-sm border border-white/10 text-[#FAFAFA] hover:bg-white/5 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Printer size={16} /> Print Receipt
                </button>
                {source === "staff" && (
                  <button
                    type="button"
                    onClick={() => {
                      handleReset();
                      navigate("/admin/dashboard");
                    }}
                    className="px-6 py-3 rounded-lg font-bold uppercase tracking-wider text-sm border border-white/10 text-[#FAFAFA] hover:bg-[#333333] transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <Eye size={16} /> View Today's Orders (Admin)
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
