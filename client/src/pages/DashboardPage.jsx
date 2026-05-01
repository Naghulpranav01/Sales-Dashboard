import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Database, LogOut, Menu, Mic, UploadCloud, X } from "lucide-react";
import { api, formatMoney, uploadDataset } from "../lib/api.js";

const ThreeControlRoom = lazy(() => import("../components/ThreeControlRoom.jsx"));

export default function DashboardPage({ user, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [datasets, setDatasets] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [bi, setBi] = useState(null);
  const [uploadState, setUploadState] = useState({ file: null, name: "", busy: false, error: "" });
  const [voiceMessage, setVoiceMessage] = useState("");

  useEffect(() => {
    Promise.all([api("/datasets"), api("/integrations/bi")])
      .then(([datasetPayload, biPayload]) => {
        setDatasets(datasetPayload.datasets);
        setBi(biPayload);
        if (datasetPayload.datasets[0]) {
          return api(`/datasets/${datasetPayload.datasets[0].id}/analytics`);
        }
        return null;
      })
      .then((payload) => {
        if (payload) setAnalytics(payload.analytics);
      })
      .catch((error) => setUploadState((state) => ({ ...state, error: error.message })));
  }, []);

  async function submitUpload(event) {
    event.preventDefault();
    if (!uploadState.file) return;
    setUploadState((state) => ({ ...state, busy: true, error: "" }));
    try {
      const payload = await uploadDataset({ file: uploadState.file, displayName: uploadState.name });
      setAnalytics(payload.analytics);
      const datasetPayload = await api("/datasets");
      setDatasets(datasetPayload.datasets);
      setUploadState({ file: null, name: "", busy: false, error: "" });
    } catch (error) {
      setUploadState((state) => ({ ...state, busy: false, error: error.message }));
    }
  }

  async function loadDataset(id) {
    const payload = await api(`/datasets/${id}/analytics`);
    setAnalytics(payload.analytics);
  }

  const kpis = analytics?.kpis || {};
  const dimensions = analytics?.dimensions || {};
  const proofText = useMemo(() => {
    if (!analytics) return "Upload a CSV or Excel file to build the dashboard.";
    return `${analytics.dataset.rowCount} rows, ${analytics.dataset.currentColumns.length} columns, ${analytics.dataset.removedColumns.length} removed columns`;
  }, [analytics]);

  function startVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceMessage("Voice commands are not available in this browser.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const command = event.results[0][0].transcript.toLowerCase();
      if (command.includes("forecast")) document.getElementById("forecast")?.scrollIntoView({ behavior: "smooth" });
      if (command.includes("customers")) document.getElementById("customers")?.scrollIntoView({ behavior: "smooth" });
      if (command.includes("overview")) window.scrollTo({ top: 0, behavior: "smooth" });
      setVoiceMessage(`Heard: ${command}`);
    };
    recognition.start();
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <button className="icon-button mobile-only" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <a className="brand" href="#overview">
            tapv.dashboards
          </a>
        </div>
        <nav className={menuOpen ? "app-nav open" : "app-nav"}>
          <button className="icon-button mobile-only" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <X size={20} />
          </button>
          <a href="#overview">Overview</a>
          <a href="#sales">Sales</a>
          <a href="#customers">Customers</a>
          <a href="#forecast">Forecast</a>
        </nav>
        <div className="header-actions">
          <button className="secondary-button" onClick={startVoice}>
            <Mic size={16} />
            Voice
          </button>
          <button className="secondary-button" onClick={onLogout}>
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </header>

      <section id="overview" className="dashboard-hero">
        <div className="dashboard-copy">
          <p className="eyebrow">Signed in as {user.name}</p>
          <h1>Sales command center</h1>
          <p>{proofText}</p>
          <p className="mode-pill">{bi?.failSafeMode ? "Fail-safe mode: local JSON storage" : "PostgreSQL dynamic schemas"}</p>
          {voiceMessage && <p className="voice-message">{voiceMessage}</p>}
        </div>
        <Suspense fallback={<div className="control-room loading-room">Loading 3D room...</div>}>
          <ThreeControlRoom analytics={analytics} />
        </Suspense>
      </section>

      <section className="workspace-grid">
        <motion.form className="upload-panel" onSubmit={submitUpload} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="panel-heading">
            <UploadCloud size={18} />
            <span>Upload sales data</span>
          </div>
          <input
            type="text"
            placeholder="Dataset name"
            value={uploadState.name}
            onChange={(event) => setUploadState((state) => ({ ...state, name: event.target.value }))}
          />
          <input
            type="file"
            accept=".csv,.xlsx"
            onChange={(event) => setUploadState((state) => ({ ...state, file: event.target.files[0] }))}
          />
          {uploadState.error && <p className="form-error">{uploadState.error}</p>}
          <button className="primary-button" disabled={!uploadState.file || uploadState.busy}>
            {uploadState.busy ? "Processing" : "Create dashboard"}
          </button>
        </motion.form>

        <section className="dataset-panel">
          <div className="panel-heading">
            <Database size={18} />
            <span>Datasets</span>
          </div>
          {datasets.length ? (
            datasets.map((dataset) => (
              <button key={dataset.id} className="dataset-row" onClick={() => loadDataset(dataset.id)}>
                <span>{dataset.displayName}</span>
                <small>{dataset.rowCount} rows</small>
              </button>
            ))
          ) : (
            <p>No datasets yet. Upload the sample CSV to start.</p>
          )}
        </section>
      </section>

      <section className="kpi-grid" aria-label="Executive overview">
        <Kpi label={dimensions.valueLabel || "Revenue"} value={formatMoney(kpis.totalRevenue)} />
        <Kpi label="Profit" value={formatMoney(kpis.totalProfit)} />
        <Kpi label="Margin" value={`${kpis.profitMargin || 0}%`} />
        <Kpi label="AOV" value={formatMoney(kpis.averageOrderValue)} />
        <Kpi label="MoM" value={`${kpis.momGrowth || 0}%`} />
        <Kpi label="YoY" value={`${kpis.yoyGrowth || 0}%`} />
      </section>

      <section id="sales" className="analytics-grid">
        <ChartPanel title={analytics?.monthlyTrend?.[0]?.month === "Unknown" ? `${dimensions.valueLabel || "Value"} summary` : `Monthly ${dimensions.valueLabel || "revenue"}`}>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={analytics?.monthlyTrend || []}>
              <CartesianGrid stroke="#26302d" />
              <XAxis dataKey="month" stroke="#93a39b" />
              <YAxis stroke="#93a39b" />
              <Tooltip />
              <Area type="monotone" dataKey="revenue" stroke="#14b88a" fill="#18322b" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title={`${dimensions.regionLabel || "Region"} contribution`}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={analytics?.byRegion || []}>
              <CartesianGrid stroke="#26302d" />
              <XAxis dataKey="region" stroke="#93a39b" />
              <YAxis stroke="#93a39b" />
              <Tooltip />
              <Bar dataKey="revenue" fill="#14b88a" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </section>

      <section id="customers" className="analytics-grid">
        <ChartPanel title="Category profitability">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={analytics?.byCategory || []}>
              <CartesianGrid stroke="#26302d" />
              <XAxis dataKey="category" stroke="#93a39b" />
              <YAxis stroke="#93a39b" />
              <Tooltip />
              <Bar dataKey="profit" fill="#14b88a" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title={`${dimensions.customerLabel || "Customer"} insights`}>
          <div className="table-list">
            {(analytics?.customerSegments || []).map((item) => (
              <div key={item.customer} className="table-row">
                <span>{item.customer}</span>
                <strong>{formatMoney(item.revenue)}</strong>
              </div>
            ))}
          </div>
        </ChartPanel>
      </section>

      <section id="forecast" className="bottom-grid">
        <ChartPanel title="Forecast">
          <div className="table-list">
            {(analytics?.forecast || []).map((item) => (
              <div key={item.month} className="table-row">
                <span>{item.month}</span>
                <strong>{formatMoney(item.forecastRevenue)}</strong>
              </div>
            ))}
          </div>
        </ChartPanel>
        <ChartPanel title="Insights">
          <div className="insight-list">
            {(analytics?.insights || ["Upload a dataset to generate insights."]).map((insight) => (
              <p key={insight}>{insight}</p>
            ))}
          </div>
        </ChartPanel>
        <ChartPanel title="BI embed">
          {bi?.powerBi?.configured || bi?.tableau?.configured ? (
            <iframe
              className="bi-frame"
              title="BI embed"
              src={bi.powerBi.embedUrl || bi.tableau.embedUrl}
              loading="lazy"
            />
          ) : (
            <p>Add Power BI or Tableau embed settings in `server/.env` when you have them.</p>
          )}
        </ChartPanel>
      </section>
    </main>
  );
}

function Kpi({ label, value }) {
  return (
    <article className="kpi-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ChartPanel({ title, children }) {
  return (
    <article className="chart-panel">
      <h2>{title}</h2>
      {children}
    </article>
  );
}
