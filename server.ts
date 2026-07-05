// server.ts
import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { callOpenRouter } from "./src/lib/openrouter.js";
import { bulkUpsertMenuItems } from "./src/lib/supabase-server.js";

// Load environment variables
dotenv.config();

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
