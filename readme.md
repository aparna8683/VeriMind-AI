# VeriMind AI — Evidence-Grounded Research & Fact-Verification Platform

> **Don't just trust AI. Verify it.**  
> VeriMind AI is an evidence-aware research and investigative verification platform that cross-examines AI-generated research against live web sources, validates verbatim excerpt quotations, isolates unsupported or contradictory statements, and provides human-in-the-loop audit workflows.

## Live Deployment

- **Frontend:** https://veri-mind-ai-1buf.vercel.app/
- **Backend API:** https://verimind-ai.onrender.com/
- **Backend health check:** https://verimind-ai.onrender.com/api/health

The frontend is deployed on Vercel and the Express API is deployed on Render. The frontend reads its API origin from the `VITE_API_URL` environment variable.

### Deployment environment variables

Configure these values in the hosting dashboards (do not commit real secrets):

**Vercel — client project**
| Variable | Value |
| :--- | :--- |
| `VITE_API_URL` | `https://verimind-ai.onrender.com` |

After adding or changing a Vercel environment variable, redeploy the frontend so the new value is included in the build.

**Render — backend service**
| Variable | Value |
| :--- | :--- |
| `CLIENT_URL` | `https://veri-mind-ai-1buf.vercel.app` |
| `GROQ_API_KEY` | Your Groq API key |
| `TAVILY_API_KEY` | Your Tavily API key |

Add optional provider keys only if you use those providers. Keep all API keys in Render's environment settings; never add them to Vercel variables or source control. The backend also allows local Vite development at `http://localhost:5173`.

---

## 1. Core Architecture & Workflow

VeriMind AI follows a strict 7-stage evidence pipeline:

```
[User Question]
       │
       ▼
[1. Targeted Web Retrieval (Tavily)] ──► [Source Quality Profiling]
       │                                         │
       ▼                                         ▼
[2. Grounded Report Synthesis (Groq Llama-3.3)] ──► [Structured Editorial Markdown]
       │
       ▼
[3. Atomic Claim Extraction] ──► [Filter Opinions, Flag Compound Statements]
       │
       ▼
[4. Verbatim Cross-Examination] ──► [Supported / Partial / Contradicted / Insufficient]
       │
       ▼
[5. Claim-Level Gap-Filling] ──► [Targeted Search on Unresolved Claims within Budget]
       │
       ▼
[6. Trust Assessment & Diversity Scoring] ──► [Alignment Metrics & Disclaimers]
       │
       ▼
[7. Human-in-the-Loop Audit & Source Explorer UI]
```

---

## 2. Free-Tier First Architecture

Built for zero-additional-cost hackathon environments with strict API budget guardrails:

- **In-Memory TTL Caching:** Caches search queries and full research reports (default 30 mins) to prevent duplicate calls to Tavily and Groq.
- **Budget Tracking:** Enforces configurable limits per request and tracks session consumption.
- **Batched Verification:** Processes claims in batches (4 per prompt) to minimize round-trips and token usage.
- **Exponential Backoff:** Retries 429/503 errors gracefully while honoring `Retry-After` headers.
- **Local Storage History:** Saves past research reports entirely on the client side (`localStorage`) with zero external database dependencies.

### Configurable Budget Limits (`.env`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `MAX_SEARCHES_PER_RESEARCH` | `3` | Maximum Tavily web searches allowed per research session |
| `MAX_SOURCES_PER_SEARCH` | `5` | Maximum web sources retrieved per search |
| `MAX_CLAIMS_PER_RESEARCH` | `10` | Maximum atomic factual claims extracted from report |
| `MAX_EVIDENCE_SOURCES_PER_CLAIM`| `3` | Maximum verified citation excerpts per claim |
| `MAX_REVERIFICATION_ATTEMPTS` | `1` | Maximum targeted re-retrieval attempts per unresolved claim |
| `RESEARCH_CACHE_TTL_MINUTES` | `30` | In-memory cache time-to-live in minutes |
| `SEARCH_TIMEOUT_MS` | `15000` | Search request timeout in milliseconds |
| `LLM_TIMEOUT_MS` | `30000` | Groq inference request timeout in milliseconds |

---

## 3. Key Upgraded Features

### A. Editorial Research Workspace
- Natural-language multi-line prompt input with keyboard shortcuts (`Enter` to submit, `Shift + Enter` for newline).
- Domain-categorized curated example questions (Health, AI, Policy, Energy).
- Visual 4-step pipeline explanation strip.
- Live session usage transparency indicator pill in the header.

### B. Synthesized Research Report
- Full GitHub Flavored Markdown (headings, lists, blockquotes, tables, code).
- **Interactive In-Text Citation Badges (`[1]`, `[2]`):** Clicking any citation in the report smoothly jumps to and pulses that source card in the Source Explorer.
- Quick copy tools: Copy Executive Summary, Copy Full Markdown, Download `.md` report.
- "Re-run Fresh" button to bypass cache and query the live web.

### C. Evidence Overview & Trust Assessment
- Key metrics: Total Claims, Supported, Partially Supported, Contradicted, Insufficient Evidence, Traceability Rate (%), Sources, and Unique Domains.
- Multi-segment progress bar with color-coded legend.
- **High-Integrity Trust Classification:** Even a single contradiction automatically prevents a "strong" assessment and triggers high-visibility audit alerts.
- Transparent formula breakdown and epistemological disclaimer.

### D. "What Needs Your Verification?" (Human Review Panel)
- Automatically isolates claims flagged by audit rules:
  1. What the claim asserted
  2. Why it requires human review (contradiction, missing source, weak excerpt, compound statement)
  3. What evidence was found
  4. What evidence is missing
  5. Recommended next investigative step
- Action buttons: "Targeted Re-Search" to run live gap-filling on that claim, and "Copy Checklist" for investigation notes.

### E. Claim Verification Explorer
- Complete log of all extracted factual claims with status tags (`SUPPORTED`, `PARTIALLY SUPPORTED`, `CONTRADICTED`, `INSUFFICIENT EVIDENCE`).
- Filter toolbar: Filter by status tabs, text search across claims and evidence excerpts, expand/collapse all toggle.
- Validated verbatim quotes mapped to source IDs, titles, and links.
- Copy individual claims and evidence excerpts with one click.

### F. Source Explorer & Quality Profile
- Categorizes sources into 7 distinct institutional profiles:
  - *Government / Institutional* (`.gov`, `.europa.eu`, `who.int`, `cdc.gov`)
  - *Academic / Peer-Reviewed* (`.edu`, `arxiv.org`, `nature.com`, PubMed)
  - *Official Documentation* (`docs.*`, developer standards, W3C, RFCs)
  - *Independent Journalism* (Reuters, AP, BBC, NYT, Guardian)
  - *Industry Publication* (TechCrunch, Wired, Ars Technica)
  - *Company / Vendor Blog* (Commercial marketing, corporate blogs)
  - *General Web / Unclassified*
- Source diversity summary: total sources, unique domains, primary sources count.
- Relevance score bar with explicit clarification: *Search relevance reflects query keyword overlap, not factual credibility.*
- List of claims citing each source.

### G. Design System & Theming
- Editorial investigative journalism typography (Newsreader serif + Plus Jakarta Sans + JetBrains Mono).
- Default **Editorial Light Theme** with crisp 1px borders and warm paper background.
- Seamless **Dark Theme** toggle with user preference persisted in `localStorage`.
- Fully responsive across desktop, laptop, tablet, and mobile devices.

---

## 4. API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | API status and version metadata |
| `GET` | `/api/health` | Health check, configured budget limits, provider status, cache stats |
| `POST`| `/api/research/answer` | Primary research & verification pipeline (`{ query, bypassCache? }`) |
| `POST`| `/api/research/reverify-claim` | Targeted on-demand re-verification (`{ claimId, claimText, sources }`) |
| `POST`| `/api/research/search` | Direct Tavily search endpoint (`{ query }`) |
| `GET` | `/api/research/usage` | Free-tier session consumption statistics and cache hits |
| `POST`| `/api/research/cache/clear` | Clears in-memory research cache |

---

## 5. Getting Started

### Prerequisites
- Node.js v18+
- Groq API Key (Free tier at [console.groq.com](https://console.groq.com))
- Tavily Search API Key (Free tier at [app.tavily.com](https://app.tavily.com))

### 1. Setup Backend
```bash
cd server
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your GROQ_API_KEY and TAVILY_API_KEY

# Run automated unit and integration tests
npm test

# Start backend server
npm run dev
# Server will run at http://localhost:5000
```

### 2. Setup Frontend
```bash
cd client
npm install

# Optional: create .env.local and set VITE_API_URL to your backend origin
# VITE_API_URL=https://verimind-ai.onrender.com

# Run Oxlint
npm run lint

# Start development client
npm run dev
# Client will run at http://localhost:5173
```

---

## 6. Testing & Quality Assurance

The codebase includes deterministic, credit-safe unit and API integration tests:

```bash
cd server
npm test
```

Verifies:
1. Configuration loading and default positive limits.
2. In-memory TTL cache storage, retrieval, and case-insensitive normalization.
3. Request budget enforcement and search consumption limits.
4. Domain-based source quality categorization and diversity metrics.
5. Trust assessment scoring, contradiction downgrading, and traceability rates.
6. API endpoint status codes, 400 rejection on empty inputs, and secret leak prevention.

---

## 7. Security & Limitations

- **No Secrets Exposed:** API keys and environment variables are strictly server-side and never bundled to the client.
- **Corroboration != Absolute Truth:** Alignment indicates matching statements in retrieved web sources, which may still contain errors or bias.
- **Search Latency:** Paywalled academic papers or breaking real-time news might not be fully indexed.
- **Zero External Costs:** Operates purely on in-memory Node structures and browser `localStorage`.
