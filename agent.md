# OpenWebUI-Monitor Agent Documentation

## 1. Project Overview
**OpenWebUI-Monitor** is a comprehensive monitoring dashboard designed for [OpenWebUI](https://github.com/open-webui/open-webui). It tracks user usage, manages token balances, and provides detailed analytics. It integrates with OpenWebUI via a custom Python function (Functions in OpenWebUI) to enforce pricing models and balance deductions.

## 2. Technical Stack
- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) (based on Radix UI)
- **Database**: PostgreSQL (via Supabase or other providers)
- **ORM/Query**: 
  - **Drizzle ORM**: Configured in `drizzle.config.ts` (primary schema management).
  - **Raw SQL**: Used in `lib/db/index.ts` for table initialization and interactions.
  - **Prisma**: Present as a dependency, possibly for legacy support or specific tools.
- **Visualization**: ECharts, Recharts
- **Deployment**: Docker, Vercel

## 3. Core Architecture

### 3.1 Directory Structure
- **`app/`**: Next.js App Router structure.
  - **`api/v1/`**: REST API endpoints.
    - `inlet/`, `outlet/`: Interceptors for OpenWebUI traffic.
    - `users/`, `models/`, `panel/`: Resource management.
  - **`components/`**: React components.
    - `ui/`: Reusable shadcn/ui components.
    - `panel/`, `models/`: Feature-specific components.
  - **`lib/`**: Utility functions and database logic.
    - `db/`: Database connection and schema management.
  - **`resources/`**: Static resources and helper scripts (e.g., the Python function for OpenWebUI).

### 3.2 Database Schema
The database uses PostgreSQL and includes the following key tables (managed via `lib/db/index.ts` and `lib/db/users.ts`):
- **`model_prices`**: Stores pricing configurations for different LLM models.
  - `id` (PK), `model_name`, `input_price`, `output_price`, `per_msg_price`, `updated_at`.
- **`users`**: Manages user balances and identity.
  - Fields likely include `id`, `balance`, `name`, usage stats (inferred).

### 3.3 Integration Flow
1.  **OpenWebUI Function**: A Python script (`openwebui_monitor.py`) runs within OpenWebUI.
2.  **Inlet**: When a user sends a message, the function calls the Monitor's `inlet` API to check balance and get pricing.
3.  **Outlet**: After generation, the function calls the `outlet` API to deduct the balance based on usage.
4.  **Dashboard**: Admins use the Next.js dashboard to view analytics, set prices, and manage users.

## 4. Key Features
- **Pricing Models**: Flexible pricing per model (input/output/per-message).
- **User Management**: Balance tracking and usage limits.
- **Analytics**: Visualizations of token consumption and costs.
- **Internationalization**: Support for multiple languages (i18n).

## 5. Development & Deployment
- **Local Dev**: `npm run dev`
- **Database Setup**: `npm run db:push` or `npm run db:generate`
- **Docker**: `docker-compose up -d`
- **Environment Variables**:
  - `OPENWEBUI_DOMAIN`, `OPENWEBUI_API_KEY`: Connection to OpenWebUI.
  - `POSTGRES_URL`: Database connection.
  - `API_KEY`, `ACCESS_TOKEN`: Security tokens for API access.

## 6. Important Files
- `lib/db/index.ts`: Database initialization logic.
- `app/api/v1/...`: API route handlers.
- `lib/db/client.ts`: Database client and potential schema definitions.
- `resources/functions/openwebui_monitor.py`: The bridge script running on OpenWebUI.
