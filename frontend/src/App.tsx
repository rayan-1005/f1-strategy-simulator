import { Suspense, lazy } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { motion } from "framer-motion";
import { Footer } from "./components/Footer";

const SimulatorPage = lazy(() =>
  import("./pages/SimulatorPage").then((m) => ({ default: m.SimulatorPage })),
);
const MonteCarloPage = lazy(() =>
  import("./pages/MonteCarloPage").then((m) => ({ default: m.MonteCarloPage })),
);
const BacktestPage = lazy(() =>
  import("./pages/BacktestPage").then((m) => ({ default: m.BacktestPage })),
);

function HeroHeader() {
  return (
    <header className="hero-strip">
      <h1>
        F1 Strategy <span>Simulator</span>
      </h1>
      <p className="hero-subtitle">
        Simulate pit stop strategies, run what-if scenarios, and backtest
        against real race data.
      </p>
    </header>
  );
}

function AppNav() {
  return (
    <nav className="top-nav">
      <div className="logo" aria-label="F1 Strategy Simulator">
        <span className="logo-f1">F1</span>
        <span className="logo-slash" />
        <span className="logo-word">Strategy Simulator</span>
      </div>
      <div className="nav-links">
        <NavLink to="/simulator">Simulator</NavLink>
        <NavLink to="/monte-carlo">Monte Carlo</NavLink>
        <NavLink to="/backtest">Backtest</NavLink>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <AppNav />
      <HeroHeader />
      <motion.div
        className="content"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Suspense fallback={<div className="route-loading">Loading…</div>}>
          <Routes>
            <Route path="/" element={<Navigate to="/simulator" replace />} />
            <Route path="/simulator" element={<SimulatorPage />} />
            <Route path="/monte-carlo" element={<MonteCarloPage />} />
            <Route path="/backtest" element={<BacktestPage />} />
          </Routes>
        </Suspense>
      </motion.div>
      <Footer />
    </div>
  );
}
