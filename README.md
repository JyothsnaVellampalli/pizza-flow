# PizzaFlow — SliceMatic Delhi
> Production pizza ordering and analytics workspace for FDE Programme Batch C2 | New Ashok Nagar, Delhi.

PizzaFlow replaces a fragile Google Forms workflow with a highly polished, fully responsive, and durable full-stack terminal application.

---

## 🏗️ SYSTEM ARCHITECTURE & FILE LAYOUT

```
pizzaflow/
├── supabase/
│   └── migrations/
│       └── 001_schema.sql          → PostgreSQL table schemas & RLS policies
├── src/
│   ├── app/
│   │   ├── staff/
│   │   │   ├── login/page.tsx      → Staff login (Supabase Auth / Demo credentials)
│   │   │   └── order/page.tsx      → Counter ordering terminal container
│   │   ├── admin/
│   │   │   ├── login/page.tsx      → Admin login (Rajan credential access)
│   │   │   ├── dashboard/page.tsx  → Sales metrics & collapsible AI Insights Assistant
│   │   │   └── menu/page.tsx       → Tabbed menu manager & .txt bulk import parser
│   │   └── table/
│   │       └── [tableId]/page.tsx  → Reserved placeholder for customer self-ordering
│   ├── components/
│   │   └── OrderWizard.tsx         → State-driven multi-step pizza builder & invoice preview
│   ├── lib/
│   │   ├── core.ts                 → Pure business logic (Delhi validation rules & calculations)
│   │   ├── supabase.ts             → Dual Supabase connector (Real DB / Persistence Fallback)
│   │   └── openrouter.ts           → Deep analytics text model requester with Gemini backup
│   ├── App.tsx                     → Client-side SPA routing mapper (react-router-dom)
│   └── index.css                   → Global typography imports (Playfair Display + Inter)
├── server.ts                       → Express + Vite full-stack dev/production middleware
└── package.json                    → Full-stack npm configuration
```

---

## 📝 VERBATIM AI SYSTEM PROMPT
The **AI Insights Assistant** panel uses this prompt to guarantee factual analytics answers:

```
You are a retail analytics assistant for SliceMatic, a single-outlet pizza brand in Delhi.
Answer ONLY from the JSON statistics provided in this message. Never fabricate numbers.
If the data is insufficient to answer, say exactly: "Not enough data yet."
Be concise — 2-3 sentences maximum. End with one concrete, actionable recommendation.
Format currency as ₹ with Indian number formatting (e.g. ₹1,23,456).
```

---

## ⚡ INTEGRATED FALLBACK PERSISTENCE ENGINE
To prevent runtime server crashes and ensure the application remains 100% interactive and valuable during local evaluations:
- **Real Mode**: Connected to Supabase and OpenRouter using your project keys.
- **Demo Mode (Fallback)**: Actively detects if keys are unconfigured. Instead of erroring out, the system loads a localized client-side store (persistent in LocalStorage) and server-side memory database.
- **Pre-populated Seeds**: Loaded with a premium Delhi-style product matrix (Thin Crust, Cheese Burst, Kadhai Paneer, Chicken Tikka Feast, spicy jalapenos) so you can place orders, filter transactions, update statuses, and test the AI analytics engine immediately.

---

## 🤖 MODEL CHOICE RATIONALE
- **Primary Model**: `anthropic/claude-haiku-3` on OpenRouter. It provides lightning-fast response times (<1s), exceptionally cheap processing, and handles structured tabular statistics with high numerical accuracy.
- **Fail-safe Backup**: `gemini-3.5-flash` via the `@google/genai` SDK. If OpenRouter is not configured or fails, the server uses Google Gemini, which is natively pre-authenticated inside AI Studio. This ensures Rajan's Insights Assistant remains fully functional with zero configuration!

---

## 🚀 LOCAL DEVELOPMENT & PRODUCTION BOOT

### 1. Requirements & Configuration
Create a `.env` file in the root directory (matching `.env.example` format):
```env
# Optional Supabase credentials for real cloud database mapping
NEXT_PUBLIC_SUPABASE_URL="https://your-supabase-url.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Optional OpenRouter key for AI analytics
OPENROUTER_API_KEY="your-openrouter-key"
```

### 2. Boot Development Server
Installs dependencies and boots the full-stack server on port 3000:
```bash
npm run dev
```

### 3. Compile Production Server
Compiles frontend assets to `dist/` and bundles the entire backend into a single self-contained `dist/server.cjs` file using `esbuild`:
```bash
npm run build
npm start
```
