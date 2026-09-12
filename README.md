# IP-SAKTI Sahayak

**IP-SAKTI Sahayak** is a comprehensive full-stack legal intelligence and decision-support platform tailored for AYUSH researchers, IPR attorneys, regulatory compliance teams, and bio-innovators in India.

The platform synthesizes Indian statutory frameworks, judicial precedents, and administrative guidelines to evaluate traditional knowledge preservation, intellectual property rights (IPR), Access and Benefit Sharing (ABS) obligations, and product manufacturing compliance.

---

## Key Modules & Capabilities

### 1. Statutory Legal Assistant (`/api/chat`, `/api/chat/stream`)
- Interactive AI-grounded legal assistant with strict retrieval-augmented generation (RAG).
- Multi-source citations across 18+ indexed statutory provisions from IP India (CGPDTM), the National Biodiversity Authority (NBA), CSIR-TKDL, FSSAI, and the Ministry of AYUSH.
- Complete support for English, Hindi (हिन्दी), and Marathi (मराठी) with verified statutory terminology.
- Integrated resilience engine providing verified statutory synthesis even when remote API credentials are absent.

### 2. Product Regulatory & IPR Intelligence (`/api/products/analyze`)
- Statutory product classification under the Drugs and Cosmetics Act, 1940 (Sections 3(a), 3(h), Rule 158-B) and FSSAI (Ayurveda Aahar Regulations, 2022).
- Automated patentability screening under Section 3(p) (Traditional Knowledge bar) and Section 3(e) (mere admixture without proven synergism).
- Schedule T Good Manufacturing Practices (GMP) compliance guidance and heavy metal / microbial testing checklists.

### 3. Traditional Knowledge & ABS Clearance (`/api/abs/analyze`, `/api/tk-abs/analyze`)
- Clear assessments under the Biological Diversity Act, 2002 and the Biological Diversity (Amendment) Act, 2023.
- Automatic routing for Form I (foreign entities / Section 3) and Form III (prior approval for IPR / Section 6).
- State Biodiversity Board (SBB) Section 7 intimation requirements and benefit-sharing percentage calculations.
- Exemption checks for registered AYUSH practitioners and certified cultivated medicinal plant varieties.

### 4. IPR Strategy Navigator (`/api/ipr/analyze`)
- Multi-layered IP roadmaps spanning Patents, Trademarks (Nice Class 5 and Class 3), Geographical Indications (GI), Industrial Designs (bottle shapes/packaging), Plant Varieties (PPV&FR Act, 2001), and Trade Secrets.
- Statutory barrier identification (Sections 3(p), 3(e), 3(d), 3(j) of the Patents Act, 1970).

### 5. Authoritative Statutory Repository (`/api/research/search`, `/api/rag/documents`)
- High-speed hybrid BM25 and semantic search across authoritative compendia, gazetted acts, notifications, and TKDL guidelines.
- Filter by topic (Patents, Biodiversity, Ayurveda Aahar, Trademarks, Designs, Plant Varieties, GMP) and governing authority.

### 6. Researcher Workspace & Telemetry (`/api/workspace/*`, `/api/rag/telemetry`)
- Local persistence of research dossiers, product analyses, and bookmarked statutory provisions.
- System telemetry monitoring retrieval latency, confidence scoring, and query analytics.

---

## Statutory & Regulatory Frameworks Covered

| Statute / Regulation | Primary Authority | Scope & Relevance |
|---|---|---|
| **The Patents Act, 1970** | IP India (CGPDTM) | Sections 3(p), 3(e), 3(d), 3(j), Form 18A expedited examination |
| **The Biological Diversity Act, 2002 & 2023 Amendment** | National Biodiversity Authority (NBA) & SBBs | Sections 3, 4, 6, 7; Form I, Form III; Benefit-sharing rules |
| **The Drugs and Cosmetics Act, 1940 & Rules, 1945** | Ministry of AYUSH & State Licensing Authorities | Section 3(a), 3(h), Rule 158-B, Schedule T GMP compliance |
| **Food Safety and Standards (Ayurveda Aahar) Regulations, 2022** | FSSAI & Ministry of AYUSH | Classical textual foods (Schedule A), logo labeling, prohibition of disease claims |
| **Traditional Knowledge Digital Library (TKDL)** | CSIR & Ministry of AYUSH | 450,000+ classical formulations as non-patentable prior art |
| **The Trade Marks Act, 1999** | Trade Marks Registry | Distinctive branding under Class 5 & Class 3; Section 9(1)(b) descriptive bars |
| **The Designs Act, 2000** | Designs Office, Kolkata | Aesthetic container geometries, blister packaging, dispensers |
| **PPV&FR Act, 2001** | Protection of Plant Varieties Authority | Novelty, Distinctiveness, Uniformity, and Stability (DUS) for medicinal plants |

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Motion (located in `/frontend`).
- **Backend**: Express.js (Node.js/TypeScript), Bundled via esbuild (`dist/server.cjs`).
- **AI & RAG Engine**: Google GenAI SDK (`@google/genai`), dual-layer legislative search engine with statutory synthesis.
- **Styling**: Tailwind CSS v4 with responsive layouts, accessible contrast, and zero layout shift.

---

## Project Structure

```
├── frontend/             # Complete client-side application
│   ├── src/              # React components, context, translations & UI logic
│   ├── public/           # Static assets, icons, and logos
│   ├── index.html        # Client HTML entry point
│   ├── package.json      # Frontend package configuration
│   ├── tsconfig.json     # Frontend TypeScript configuration
│   └── vite.config.ts    # Frontend Vite configuration
├── server/               # Backend API and RAG intelligence modules
│   ├── data/             # Authoritative statutory documents & citations
│   ├── rag/              # Hybrid retrieval & BM25 indexing
│   └── gemini.ts         # Gemini AI & statutory synthesis engine
├── server.ts             # Express server entry point & Vite middleware
├── package.json          # Root build & execution scripts
├── vite.config.ts        # Root Vite bundling configuration
├── tsconfig.json         # Root TypeScript configuration
└── metadata.json         # AI Studio platform metadata
```

---

## Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or bun

### Installation

```bash
# Clone the repository and navigate to the project root
git clone <repository-url>
cd ip-sakti-sahayak

# Install dependencies
npm install
```

### Environment Configuration (Optional)

The application is completely self-contained and functions out-of-the-box without any environment variables.

To optionally enable live Google Gemini API generation:

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Set your Gemini API key:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

*Note: If `GEMINI_API_KEY` is not provided or invalid, the platform smoothly utilizes its built-in statutory synthesis engine.*

### Running the Application

```bash
# Start development server (Node Express + Vite on port 3000)
npm run dev

# Run TypeScript type verification
npm run lint

# Build for production
npm run build

# Start production server
npm start
```

Once running, access the web interface at `http://localhost:3000`.

---

## API Endpoints Summary

- `GET /api/health` — Service health check and system timestamp
- `POST /api/chat` — Statutory legal research queries (JSON payload)
- `POST /api/chat/stream` — Real-time Server-Sent Events (SSE) streaming chat
- `POST /api/products/analyze` — Comprehensive product regulatory and IPR evaluation
- `GET /api/products` — Retrieve historical product analysis records
- `POST /api/ipr/analyze` — Generate multi-layered IPR protection strategy
- `POST /api/abs/analyze` & `POST /api/tk-abs/analyze` — Biodiversity Act and ABS clearance evaluation
- `GET /api/research/search` — Search authoritative statutory corpus and legal chunks
- `POST /api/translate` — Multilingual query and interface translation engine
- `GET /api/rag/documents` & `GET /api/rag/telemetry` — Repository metadata and retrieval telemetry
- `GET/POST /api/workspace/saved-research` — Dossier and bookmark management

---

## Legal Disclaimer

IP-SAKTI Sahayak is an informational decision-support platform designed for academic, research, and preparatory regulatory analysis. It does not constitute formal legal counsel. Formal statutory submissions, patent prosecutions, and license applications should be vetted by registered patent agents, advocates, or qualified regulatory affairs specialists.
