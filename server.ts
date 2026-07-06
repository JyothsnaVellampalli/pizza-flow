// server.ts
import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { callOpenRouter } from "./src/lib/openrouter.js";
import { bulkUpsertMenuItems, supabase } from "./src/lib/supabase-server.js";
import { GoogleGenAI } from "@google/genai";

// Load environment variables
dotenv.config({ override: true });

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parser middlewares
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // --- API ROUTE: HEALTH CHECK ---
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // --- API ROUTE: SEED MENU ---
  // POST endpoint to seed menu from .txt file content (admin only)
  app.post("/api/menu/seed", async (req, res) => {
    const { fileContent } = req.body;
    if (!fileContent) {
      return res.status(400).json({ error: "Missing fileContent in request body" });
    }

    try {
      const lines = fileContent.split(/\r?\n/);
      const itemsToImport = [];
      let skippedCount = 0;
      const localReport: string[] = [];

      lines.forEach((line: string, index: number) => {
        const lineNum = index + 1;
        const trimmed = line.trim();
        if (!trimmed) return;

        const parts = trimmed.split(";");
        if (parts.length < 3) {
          skippedCount++;
          localReport.push(`Line ${lineNum}: Skipped. Format must be CODE;Name;Price`);
          return;
        }

        const code = parts[0].trim().toUpperCase();
        const name = parts[1].trim();
        const priceStr = parts[2].trim();
        const price = parseFloat(priceStr);

        if (!code || !name || isNaN(price) || price <= 0) {
          skippedCount++;
          localReport.push(`Line ${lineNum}: Skipped. Invalid entry.`);
          return;
        }

        let category = "pizza";
        if (code.startsWith("B")) category = "base";
        else if (code.startsWith("T")) category = "topping";
        else if (code.startsWith("P")) category = "pizza";
        else {
          skippedCount++;
          localReport.push(`Line ${lineNum}: Skipped. Invalid prefix.`);
          return;
        }

        itemsToImport.push({
          code,
          category,
          name,
          price_inr: price,
          description: `${category.toUpperCase()} imported via Server Seed API`,
          is_active: true
        });
      });

      const result = await bulkUpsertMenuItems(itemsToImport);
      res.json({
        success: true,
        imported: result.imported,
        updated: result.updated,
        skipped: result.skipped + skippedCount,
        report: [...result.report, ...localReport]
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to execute server-side seed" });
    }
  });

  // --- API ROUTE: AI INSIGHTS ---
  // POST endpoint to generate insights for Rajan using statistics and OpenRouter/Gemini
  app.post("/api/ai/insights", async (req, res) => {
    const { question, statistics, history } = req.body;
    if (!question) {
      return res.status(400).json({ error: "Missing question in request body" });
    }

    // VERBATIM SYSTEM PROMPT requested in instructions
    const systemPrompt = `You are a retail analytics assistant for SliceMatic, a single-outlet pizza brand in Delhi.
Answer ONLY from the JSON statistics provided in this message. Never fabricate numbers.
You have access to a detailed "orders_list" array inside the JSON object containing individual orders (including fields: customer_name, table_number, total_payable, payment_mode, items containing name/category/price, etc.), as well as "topping_popularity" and "base_popularity" maps. Use these fields to calculate answers for specific toppings, bases, customers (such as John), table numbers, or specific transaction patterns.
If the data is insufficient to answer, say exactly: "Not enough data yet."
Be concise — 2-3 sentences maximum. End with one concrete, actionable recommendation.
Format currency as ₹ with Indian number formatting (e.g. ₹1,23,456).`;

    const statsString = JSON.stringify(statistics, null, 2);
    const userMessage = `JSON Statistics Provided:
\`\`\`json
${statsString}
\`\`\`

User Question: ${question}`;

    try {
      const result = await callOpenRouter(systemPrompt, userMessage, history || []);
      if (result.ok === true) {
        res.json({ text: result.text });
      } else {
        res.status(502).json({ error: result.error });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Internal server error analyzing statistics" });
    }
  });

  // --- API ROUTE: AI PIZZA SUGGESTIONS ---
  app.post("/api/ai/suggestions", async (req, res) => {
    const { customerName, customerPhone, menuItems } = req.body;
    if (!customerPhone) {
      return res.status(400).json({ error: "Missing customerPhone" });
    }

    try {
      // 1. Fetch previous orders from database
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select(`
          id,
          created_at,
          customer_name,
          customer_phone,
          order_lines (
            order_line_id,
            item_id,
            quantity,
            price_at_sale,
            items (
              item_id,
              code,
              category,
              name,
              cost,
              description
            )
          )
        `)
        .eq("customer_phone", customerPhone.trim())
        .order("created_at", { ascending: false });

      if (ordersError) {
        console.error("Error fetching order history for suggestions:", ordersError);
      }

      // 2. Parse past pizzas from history
      const pastPizzas: any[] = [];
      if (orders && orders.length > 0) {
        orders.forEach((o: any) => {
          const pizzasInOrder: Record<string, { base?: any, pizza?: any, toppings: any[] }> = {};
          
          if (o.order_lines) {
            o.order_lines.forEach((line: any) => {
              const dbItem = line.items;
              if (!dbItem) return;

              // Match "(Pizza #N)"
              const match = line.name ? line.name.match(/\(Pizza #(\d+)\)/) : null;
              if (match) {
                const pizzaNum = match[1];
                if (!pizzasInOrder[pizzaNum]) {
                  pizzasInOrder[pizzaNum] = { toppings: [] };
                }
                const category = dbItem.category === "toppings" ? "topping" : dbItem.category;
                if (category === "base") {
                  pizzasInOrder[pizzaNum].base = { code: dbItem.code, name: dbItem.name };
                } else if (category === "pizza") {
                  pizzasInOrder[pizzaNum].pizza = { code: dbItem.code, name: dbItem.name };
                } else if (category === "topping") {
                  const qtyMatch = line.name ? line.name.match(/\(x(\d+)\)/) : null;
                  const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
                  pizzasInOrder[pizzaNum].toppings.push({ code: dbItem.code, name: dbItem.name, quantity: qty });
                }
              }
            });
          }

          Object.values(pizzasInOrder).forEach(p => {
            if (p.base && p.pizza) {
              pastPizzas.push(p);
            }
          });
        });
      }

      // 3. Prepare AI Prompt
      const availableBases = menuItems.filter((m: any) => m.category === "base").map((m: any) => ({ code: m.code, name: m.name, desc: m.description }));
      const availablePizzas = menuItems.filter((m: any) => m.category === "pizza").map((m: any) => ({ code: m.code, name: m.name, desc: m.description }));
      const availableToppings = menuItems.filter((m: any) => m.category === "topping").map((m: any) => ({ code: m.code, name: m.name, desc: m.description }));

      let prompt = `You are an AI pizza recommendation engine for SliceMatic.
A customer is placing an order. Give 2-3 personalized pizza suggestions based on their order history, or standard recommended pairings if no history is found.

Customer Name: ${customerName || "Valued Customer"}
Customer Phone: ${customerPhone}

Available Bases:
${JSON.stringify(availableBases, null, 2)}

Available Pizza Classics (Main Recipe):
${JSON.stringify(availablePizzas, null, 2)}

Available Premium Toppings:
${JSON.stringify(availableToppings, null, 2)}

Customer's Reconstructed Order History (Previous customized pizzas):
${pastPizzas.length > 0 ? JSON.stringify(pastPizzas.slice(0, 5), null, 2) : "No previous order history found."}

Provide exactly 2 to 3 suggestions in a JSON array format.
For each suggestion, provide:
1. "title": An appealing, catchy, descriptive name for the pizza suggestion (e.g. "Your Spicy Tikka Treat", "Rajan's Cheese Classic")
2. "reason": A friendly, clear explanation of why this is suggested (e.g., "Inspired by your previous order of Kadhai Paneer with extra jalapenos!" or "Our chef's highly recommended gourmet pairing!")
3. "baseCode": A valid base code from the Available Bases (e.g., "B1", "B2")
4. "pizzaCode": A valid pizza code from the Available Pizza Classics (e.g., "P1", "P2")
5. "toppings": An array of toppings to add, each with "code" (e.g. "T1", "T2") and "quantity" (an integer from 1 to 3). Include 1-3 toppings that match the style of the suggestion nicely.

Respond ONLY with a valid JSON array matching the structure. Do not include markdown code block formatting like \`\`\`json.`;

      let suggestions = [];
      if (process.env.GEMINI_API_KEY) {
        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            }
          }
        });

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          }
        });

        if (response && response.text) {
          suggestions = JSON.parse(response.text.trim());
        }
      } else {
        suggestions = [
          {
            title: "The Ultimate Cheese Burst",
            reason: "A chef-recommended favorite featuring a Cheese Burst base with extra mozzarella and black olives.",
            baseCode: "B2",
            pizzaCode: "P1",
            toppings: [{ code: "T1", quantity: 1 }, { code: "T4", quantity: 1 }]
          },
          {
            title: "Double-Paneer Tikka Fusion",
            reason: "An indulgent spicy combination of Kadhai Paneer Pizza on a Pan Base with Extra Mozzarella.",
            baseCode: "B3",
            pizzaCode: "P3",
            toppings: [{ code: "T1", quantity: 1 }, { code: "T3", quantity: 1 }]
          }
        ];
      }

      res.json({ success: true, suggestions });
    } catch (err: any) {
      console.error("Failed to generate suggestions:", err);
      res.status(500).json({ error: err.message || "Failed to generate suggestions" });
    }
  });

  // --- VITE MIDDLEWARE SETUP FOR DEV/PROD ---
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in production mode serving compiled static assets...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SliceMatic PizzaFlow running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Critical: Failed to boot Express + Vite Server:", err);
});
