// src/app/admin/menu/page.tsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { 
  Pizza, Plus, Edit2, ToggleLeft, ToggleRight, FileText, 
  CheckCircle, RefreshCw, AlertTriangle, ArrowLeft, Archive, Grid 
} from "lucide-react";
import { 
  getMenuItems, addMenuItem, updateMenuItem, bulkUpsertMenuItems, MenuItem 
} from "../../../lib/supabase";

type TabCategory = "base" | "pizza" | "topping";

export default function AdminMenuPage() {
  const [activeTab, setActiveTab] = useState<TabCategory>("pizza");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State (for Add / Edit)
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Bulk Import State
  const [importReport, setImportReport] = useState<{
    imported: number;
    updated: number;
    skipped: number;
    report: string[];
  } | null>(null);
  const [importError, setImportError] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  // Fetch menu
  const loadMenu = async () => {
    setLoading(true);
    try {
      const items = await getMenuItems();
      setMenuItems(items);
    } catch (e) {
      console.error("Error loading menu:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMenu();
  }, []);

  // Auto suggest code on category selection or mount
  const suggestCode = (cat: TabCategory, currentItems: MenuItem[]) => {
    const prefix = cat === "base" ? "B" : cat === "pizza" ? "P" : "T";
    const filtered = currentItems.filter(item => item.category === cat);
    
    // Parse out integers from codes (e.g. B1 -> 1, P12 -> 12)
    let maxNum = 0;
    filtered.forEach(item => {
      const matches = item.code.match(/\d+/);
      if (matches) {
        const num = parseInt(matches[0], 10);
        if (num > maxNum) maxNum = num;
      }
    });

    return `${prefix}${maxNum + 1}`;
  };

  const handleTabChange = (cat: TabCategory) => {
    setActiveTab(cat);
    if (!isEditing) {
      setFormCode(suggestCode(cat, menuItems));
    }
  };

  // Populate form for editing
  const handleStartEdit = (item: MenuItem) => {
    setIsEditing(true);
    setEditingId(item.id);
    setFormCode(item.code);
    setFormName(item.name);
    setFormPrice(item.price_inr.toString());
    setFormDescription(item.description || "");
    setFormActive(item.is_active);
    setFormError("");
    setFormSuccess("");
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormCode(suggestCode(activeTab, menuItems));
    setFormName("");
    setFormPrice("");
    setFormDescription("");
    setFormActive(true);
    setFormError("");
    setFormSuccess("");
  };

  // Handle Form Submit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    const nameTrimmed = formName.trim();
    if (!nameTrimmed) {
      setFormError("Name cannot be empty.");
      return;
    }

    const priceNum = parseFloat(formPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setFormError("Price must be a valid positive number.");
      return;
    }

    // Check code uniqueness (only if inserting new or editing to a different code)
    const codeDup = menuItems.find(
      item => item.code.toUpperCase() === formCode.toUpperCase() && item.id !== editingId
    );
    if (codeDup) {
      setFormError(`Item code "${formCode}" is already in use by: ${codeDup.name}`);
      return;
    }

    try {
      if (isEditing && editingId) {
        await updateMenuItem(editingId, {
          code: formCode.toUpperCase(),
          name: nameTrimmed,
          price_inr: priceNum,
          description: formDescription,
          is_active: formActive
        });
        setFormSuccess("Menu item updated successfully!");
        handleCancelEdit();
      } else {
        await addMenuItem({
          code: formCode.toUpperCase(),
          category: activeTab,
          name: nameTrimmed,
          price_inr: priceNum,
          description: formDescription,
          is_active: formActive
        });
        setFormSuccess("Menu item created successfully!");
        setFormName("");
        setFormPrice("");
        setFormDescription("");
        setFormActive(true);
      }
      await loadMenu();
    } catch (err: any) {
      setFormError(err.message || "Failed to save item.");
    }
  };

  // Toggle active helper
  const handleToggleActive = async (item: MenuItem) => {
    try {
      await updateMenuItem(item.id, { is_active: !item.is_active });
      setMenuItems(prev => 
        prev.map(it => it.id === item.id ? { ...it, is_active: !it.is_active } : it)
      );
    } catch (err) {
      console.error("Failed to toggle status:", err);
    }
  };

  // Bulk File Upload Parsing
  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError("");
    setImportReport(null);
    setIsImporting(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      if (!text) {
        setImportError("Empty or unreadable file");
        setIsImporting(false);
        return;
      }

      const lines = text.split(/\r?\n/);
      const itemsToImport: Omit<MenuItem, "id" | "updated_at">[] = [];
      const localReport: string[] = [];
      let skippedCount = 0;

      lines.forEach((line, index) => {
        const lineNum = index + 1;
        const trimmed = line.trim();
        if (!trimmed) return; // skip completely empty lines

        // Parser splits by semicolon (e.g. CODE;Name;Price)
        const parts = trimmed.split(";");
        if (parts.length < 3) {
          skippedCount++;
          localReport.push(`Line ${lineNum}: Skipped. Format must be CODE;Name;Price (found: "${trimmed}")`);
          return;
        }

        const code = parts[0].trim().toUpperCase();
        const name = parts[1].trim();
        const priceStr = parts[2].trim();
        const price = parseFloat(priceStr);

        if (!code) {
          skippedCount++;
          localReport.push(`Line ${lineNum}: Skipped. Code is required.`);
          return;
        }

        if (!name) {
          skippedCount++;
          localReport.push(`Line ${lineNum}: Skipped. Name is required.`);
          return;
        }

        if (isNaN(price) || price <= 0) {
          skippedCount++;
          localReport.push(`Line ${lineNum}: Skipped. Price "${priceStr}" is invalid (must be positive).`);
          return;
        }

        // Determine category from code prefix
        let category: TabCategory = "pizza";
        if (code.startsWith("B")) {
          category = "base";
        } else if (code.startsWith("T")) {
          category = "topping";
        } else if (code.startsWith("P")) {
          category = "pizza";
        } else {
          skippedCount++;
          localReport.push(`Line ${lineNum}: Skipped. Code prefix must be B, P or T (e.g. B1, P1, T1).`);
          return;
        }

        itemsToImport.push({
          code,
          category,
          name,
          price_inr: price,
          description: `${category.toUpperCase()} item imported on ${new Date().toLocaleDateString()}`,
          is_active: true
        });
      });

      if (itemsToImport.length === 0) {
        setImportError("No valid lines to import.");
        setIsImporting(false);
        return;
      }

      try {
        const result = await bulkUpsertMenuItems(itemsToImport);
        setImportReport({
          imported: result.imported,
          updated: result.updated,
          skipped: result.skipped + skippedCount,
          report: [...result.report, ...localReport]
        });
        await loadMenu();
      } catch (err: any) {
        setImportError(err.message || "Failed to execute bulk insert.");
      } finally {
        setIsImporting(false);
      }
    };

    reader.onerror = () => {
      setImportError("Error reading file.");
      setIsImporting(false);
    };

    reader.readAsText(file);
    // Reset file input
    e.target.value = "";
  };

  // Sync suggestion code on load
  useEffect(() => {
    if (menuItems.length > 0 && !isEditing) {
      setFormCode(suggestCode(activeTab, menuItems));
    }
  }, [menuItems, activeTab, isEditing]);

  const filteredItems = menuItems.filter(item => item.category === activeTab);

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-[#FAFAFA] flex flex-col">
      {/* HEADER BAR */}
      <nav className="bg-[#252525] border-b border-[#333333] px-6 py-4 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/admin/dashboard" className="text-[#9E9E9E] hover:text-[#FAFAFA] p-1.5 rounded-lg hover:bg-[#333333] transition-colors mr-2">
            <ArrowLeft size={18} />
          </Link>
          <div className="bg-[#FF6B2B] p-2 rounded-xl text-white">
            <Pizza size={22} className="rotate-45" />
          </div>
          <div>
            <span className="font-serif font-extrabold text-xl tracking-tight block text-white">
              SliceMatic <span className="text-[#FF6B2B]">Admin</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm font-mono">
          <Link to="/staff/order" className="text-[#9E9E9E] hover:text-[#FF6B2B] transition-colors">
            ← Staff Terminals
          </Link>
          <span className="text-neutral-700">|</span>
          <Link to="/admin/dashboard" className="text-[#9E9E9E] hover:text-[#FF6B2B] transition-colors">
            Analytics Dashboard
          </Link>
        </div>
      </nav>

      {/* CORE LAYOUT CONTAINER */}
      <main className="flex-grow p-4 md:p-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT/MID COLUMN: ITEMS DIRECTORY (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center flex-wrap gap-4 border-b border-[#333333] pb-4">
            <div>
              <h1 className="text-3xl font-serif font-bold text-[#FAFAFA]">Recipe Menu Matrix</h1>
              <p className="text-[#9E9E9E] text-sm mt-1">Add, update, deactivate or import bulk Delhi SliceMatic products.</p>
            </div>
            
            {/* BULK FILE UPLOADER */}
            <div className="relative">
              <label 
                htmlFor="bulk-txt" 
                className={`px-4 py-2.5 rounded-xl border border-[#444444] hover:bg-[#333] text-[#FAFAFA] text-xs font-mono font-bold cursor-pointer transition-all flex items-center gap-2 ${
                  isImporting ? "opacity-50 pointer-events-none" : ""
                }`}
              >
                {isImporting ? <RefreshCw className="animate-spin" size={14} /> : <FileText size={14} />}
                Import Menu (.txt)
              </label>
              <input 
                type="file" 
                id="bulk-txt" 
                accept=".txt" 
                onChange={handleBulkImport} 
                className="hidden" 
              />
            </div>
          </div>

          {/* BULK IMPORT STATUS BOX */}
          {(importReport || importError) && (
            <div className={`p-4 rounded-xl border text-sm font-mono space-y-3 ${
              importError 
                ? "bg-[#FF3B30]/10 border-[#FF3B30]/30 text-[#FF3B30]" 
                : "bg-[#4CAF50]/10 border-[#4CAF50]/30 text-[#4CAF50]"
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-2">
                  {importError ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
                  {importError ? "Bulk Import Failed" : "Bulk Import Complete!"}
                </span>
                <button 
                  onClick={() => { setImportReport(null); setImportError(""); }} 
                  className="text-xs underline hover:text-[#FAFAFA]"
                >
                  Clear Log
                </button>
              </div>

              {importReport && (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-xs text-center border-b border-neutral-700/50 pb-2">
                    <div className="bg-[#4CAF50]/10 p-2 rounded">
                      <p className="text-lg font-bold">{importReport.imported}</p>
                      <p className="text-[#9E9E9E] scale-90">Imported</p>
                    </div>
                    <div className="bg-[#FF6B2B]/10 p-2 rounded">
                      <p className="text-lg font-bold">{importReport.updated}</p>
                      <p className="text-[#9E9E9E] scale-90">Updated</p>
                    </div>
                    <div className="bg-[#333] p-2 rounded">
                      <p className="text-lg font-bold">{importReport.skipped}</p>
                      <p className="text-[#9E9E9E] scale-90">Skipped</p>
                    </div>
                  </div>

                  <details className="text-xs bg-[#1A1A1A] p-2 rounded max-h-[150px] overflow-y-auto cursor-pointer">
                    <summary className="text-[#9E9E9E] hover:text-[#FAFAFA]">View detailed logs ({importReport.report.length} entries)</summary>
                    <ul className="list-disc pl-4 mt-1.5 space-y-1 text-[#FAFAFA]">
                      {importReport.report.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </details>
                </div>
              )}

              {importError && <p className="text-xs">{importError}</p>}
            </div>
          )}

          {/* THE THREE TABS requested by prompt */}
          <div className="flex border-b border-[#333333] gap-2">
            {[
              { id: "pizza", label: "Pizzas Recipes", count: menuItems.filter(i => i.category === "pizza").length },
              { id: "base", label: "Dough Bases", count: menuItems.filter(i => i.category === "base").length },
              { id: "topping", label: "Premium Toppings", count: menuItems.filter(i => i.category === "topping").length }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id as TabCategory)}
                className={`px-5 py-3 font-serif font-medium text-sm border-b-2 transition-all flex items-center gap-2 ${
                  activeTab === tab.id
                    ? "border-[#FF6B2B] text-[#FF6B2B] bg-[#FF6B2B]/5 font-bold"
                    : "border-transparent text-[#9E9E9E] hover:text-[#FAFAFA]"
                }`}
              >
                <span>{tab.label}</span>
                <span className="bg-[#333333] text-xs font-mono text-[#9E9E9E] px-1.5 py-0.5 rounded-full">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* MATRIX LIST TABLE */}
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#FF6B2B]"></div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="bg-[#252525] border border-dashed border-[#444444] rounded-xl p-12 text-center text-[#9E9E9E]">
              <Archive size={36} className="mx-auto mb-2 text-neutral-600" />
              <p className="font-serif">No products mapped under this tab yet.</p>
              <p className="text-xs font-mono mt-1">Use the right form panel or upload a txt file to seed.</p>
            </div>
          ) : (
            <div className="bg-[#252525] rounded-xl border border-[#333333] overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#1F1F1F] text-xs font-mono uppercase tracking-wider text-[#9E9E9E] border-b border-[#333333]">
                    <th className="px-4 py-3.5">Code</th>
                    <th className="px-4 py-3.5">Item Name</th>
                    <th className="px-4 py-3.5">Price</th>
                    <th className="px-4 py-3.5 hidden sm:table-cell">Description</th>
                    <th className="px-4 py-3.5 text-center">Active</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#333333] text-sm">
                  {filteredItems.map(item => (
                    <tr key={item.id} className="hover:bg-[#1C1C1C] transition-colors">
                      <td className="px-4 py-3.5 font-mono font-bold text-[#FF6B2B]">
                        {item.code}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-[#FAFAFA]">
                        {item.name}
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold">
                        ₹{Number(item.price_inr).toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-[#9E9E9E] max-w-[200px] truncate hidden sm:table-cell">
                        {item.description || "—"}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => handleToggleActive(item)}
                          className={`focus:outline-none transition-colors ${
                            item.is_active ? "text-[#4CAF50]" : "text-neutral-600"
                          }`}
                          title={item.is_active ? "Deactivate Item" : "Reactivate Item"}
                        >
                          {item.is_active ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => handleStartEdit(item)}
                          className="p-1.5 rounded bg-[#333] hover:bg-[#444] text-[#FAFAFA] hover:text-[#FF6B2B] transition-colors"
                          title="Edit Product Details"
                        >
                          <Edit2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: ACTION PANEL (ADD/EDIT FORM) */}
        <div className="bg-[#252525] border border-[#333333] rounded-2xl p-6 self-start space-y-6">
          <div className="border-b border-[#333333] pb-3">
            <h3 className="text-xl font-serif font-bold text-[#FAFAFA] flex items-center gap-2">
              <Grid size={18} className="text-[#FF6B2B]" />
              {isEditing ? "Modify Product" : "Publish Product"}
            </h3>
            <p className="text-[#9E9E9E] text-xs font-mono mt-1">
              {isEditing ? `Modifying code: ${formCode}` : `Mapping into: ${activeTab.toUpperCase()}`}
            </p>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-4">
            
            {/* Auto Code input */}
            <div className="space-y-1">
              <label className="text-xs font-mono text-[#9E9E9E] uppercase">Unique Suffix Code</label>
              <input
                type="text"
                required
                placeholder="e.g. B10"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value.replace(/\s/g, ""))}
                className="w-full bg-[#1A1A1A] border border-[#333333] text-[#FAFAFA] text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#FF6B2B] transition-colors uppercase font-mono"
              />
            </div>

            {/* Name */}
            <div className="space-y-1">
              <label className="text-xs font-mono text-[#9E9E9E] uppercase">Product Label / Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Garlic Herb Spread"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full bg-[#1A1A1A] border border-[#333333] text-[#FAFAFA] text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#FF6B2B] transition-colors"
              />
            </div>

            {/* Price */}
            <div className="space-y-1">
              <label className="text-xs font-mono text-[#9E9E9E] uppercase">Product Price (₹ INR)</label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                placeholder="e.g. 149"
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                className="w-full bg-[#1A1A1A] border border-[#333333] text-[#FAFAFA] text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#FF6B2B] transition-colors font-mono"
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-xs font-mono text-[#9E9E9E] uppercase">Short Description (Optional)</label>
              <textarea
                rows={2}
                placeholder="Brief recipe details..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="w-full bg-[#1A1A1A] border border-[#333333] text-[#FAFAFA] text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#FF6B2B] transition-colors leading-relaxed"
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between bg-[#1A1A1A] px-4 py-3 rounded-xl border border-[#333333]">
              <span className="text-xs font-mono text-[#9E9E9E] uppercase">Default Active Status</span>
              <button
                type="button"
                onClick={() => setFormActive(!formActive)}
                className={`focus:outline-none transition-colors ${
                  formActive ? "text-[#4CAF50]" : "text-neutral-600"
                }`}
              >
                {formActive ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
              </button>
            </div>

            {/* Status updates */}
            {formError && (
              <p className="text-[#FF3B30] text-xs font-mono bg-[#FF3B30]/10 p-2.5 rounded border border-[#FF3B30]/20 leading-relaxed">
                ⚠️ {formError}
              </p>
            )}

            {formSuccess && (
              <p className="text-[#4CAF50] text-xs font-mono bg-[#4CAF50]/10 p-2.5 rounded border border-[#4CAF50]/20 leading-relaxed">
                ✅ {formSuccess}
              </p>
            )}

            {/* Submit / Cancel Buttons */}
            <div className="flex gap-3 pt-2">
              {isEditing && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-neutral-700 text-[#FAFAFA] text-sm hover:bg-[#333] transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="flex-grow bg-[#FF6B2B] hover:bg-[#E05A1F] text-white py-2.5 px-4 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-1.5"
              >
                <Plus size={16} />
                {isEditing ? "Save Changes" : "Create Product"}
              </button>
            </div>

          </form>
        </div>

      </main>

      {/* FOOTER */}
      <footer className="bg-[#1F1F1F] border-t border-[#292929] py-4 text-center text-xs text-[#9E9E9E] font-mono mt-8">
        SliceMatic Delhi Portal &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
