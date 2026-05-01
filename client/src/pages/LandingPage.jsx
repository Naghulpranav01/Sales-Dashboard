import { motion } from "framer-motion";
import AuthPanel from "../components/AuthPanel.jsx";

export default function LandingPage({ onAuthenticated }) {
  return (
    <main className="landing-page">
      <nav className="top-nav">
        <a className="brand" href="#top" aria-label="tapv.dashboards home">
          tapv.dashboards
        </a>
        <a href="#proof">Proof</a>
        <a href="#security">Security</a>
      </nav>

      <section id="top" className="landing-hero">
        <motion.div
          className="hero-copy"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <p className="eyebrow">Sales analytics that starts from a spreadsheet</p>
          <h1>Upload sales data. Get a database table and a dashboard you can use.</h1>
          <p className="hero-text">
            tapv.dashboards helps a team turn CSV or Excel files into clean tables, KPIs, trend charts,
            and a 3D dashboard. It works with Postgres in production and has a local fail-safe mode
            for demos.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#account">
              Try the app
            </a>
            <a className="secondary-button" href="#proof">
              See what is real
            </a>
          </div>
        </motion.div>

        <AuthPanel onAuthenticated={onAuthenticated} />
      </section>

      <section id="proof" className="proof-section">
        <div>
          <p className="eyebrow">Product proof</p>
          <h2>This build ships with real ingestion, not a painted dashboard.</h2>
          <p>
            The sample file in this project has 18 sales rows. When uploaded, the API infers 8
            columns, removes duplicate rows, stores the dataset, and returns revenue, profit, margin,
            monthly trends, regional contribution, customer segments, loss detection, and a simple
            forecast.
          </p>
        </div>
        <div className="proof-terminal" aria-label="Concrete upload result">
          <span>POST /api/datasets/upload</span>
          <strong>18 rows processed</strong>
          <span>8 columns inferred</span>
          <span>schema: tenant_user.sales_sample_sales</span>
          <span>mode: postgres or fail-safe JSON</span>
        </div>
      </section>

      <section id="security" className="security-section">
        <div>
          <h2>Security basics are already in place.</h2>
          <p>
            Passwords are hashed with bcrypt. Login uses JWTs. The API adds Helmet headers, rate
            limiting, file size limits, strict upload types, and per-user dataset access.
          </p>
        </div>
        <div>
          <h2>No API key is needed to run it.</h2>
          <p>
            Power BI, Tableau, and OpenAI are optional. Add those keys later only when you want live
            embeds or model-written business notes.
          </p>
        </div>
      </section>
    </main>
  );
}
