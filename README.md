# LedgerSpace Sales Analytics

Enterprise-style sales analytics platform with secure auth, CSV/XLSX ingestion, dynamic schema creation, analytics APIs, BI hooks, and a responsive React Three Fiber dashboard.

## What Is Included

- Signup and login with bcrypt password hashing and JWT auth.
- CSV/XLSX upload with header detection, type inference, null handling, and duplicate removal.
- Dynamic Postgres schemas and tables per user dataset.
- Schema evolution with added and removed columns.
- Fail-safe mode that stores users and datasets as JSON when `DATABASE_URL` is not set.
- Revenue, profit, margin, MoM, YoY, AOV, region, category, customer, loss, trend, and forecast analytics.
- React frontend with Tailwind configured, flat visual system, real product proof section, dashboard charts, voice command hooks, and a meaningful 3D control room driven by dashboard data.
- Optional Power BI, Tableau, and OpenAI configuration points.

## Setup

```bash
npm run install:all
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
npm run dev
```

Frontend: `http://localhost:5173`

API: `http://localhost:8080/api/health`

## Fail-Safe Mode

No API keys are required. If `DATABASE_URL` is empty, the backend runs in fail-safe mode and writes local JSON files under `server/data`. This is useful for demos, recruiter walkthroughs, and laptops without Postgres.

## PostgreSQL Mode

Create a database and set:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/sales_analytics
JWT_SECRET=use-a-long-random-secret
```

On upload, the API creates a schema like `tenant_<user>` and a table like `sales_sample_sales`. CSV headers become table columns with inferred Postgres types. Each table also gets `id` and `ingested_at`.

## Optional Keys

Only add these when you need the integration:

- `POWER_BI_EMBED_URL`
- `POWER_BI_REPORT_ID`
- `TABLEAU_EMBED_URL`
- `OPENAI_API_KEY`

## Demo File

Use `samples/sample_sales.csv` after signing in. It has 18 rows and columns for date, region, category, customer, quantity, price, cost, and revenue.

## Security Notes

- Replace `JWT_SECRET` before production use.
- Put the API behind HTTPS.
- Use managed Postgres backups and least-privilege database users.
- Review BI embed token generation before exposing private reports.
- Keep fail-safe JSON mode for demos only, not production.
