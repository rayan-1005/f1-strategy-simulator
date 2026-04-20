const { spawnSync } = require("child_process");
const path = require("path");

const script = path.resolve(__dirname, "seed_races.py");
const args = process.argv.slice(2);
const pythonCmd = process.env.PYTHON || process.env.PYTHON_PATH || "python";

const result = spawnSync(pythonCmd, [script, ...args], {
  stdio: "inherit",
});

if (result.error) {
  console.error("[seed_races] failed to launch python:", result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
