import { createServer } from "node:http";

let profile = null;

const dashboard = {
  date: "2026-06-19",
  caloriesEaten: 0,
  caloriesRemaining: 2000,
  calorieTarget: 2000,
  proteinEatenG: 0,
  proteinRemainingG: 140,
  proteinTargetG: 140,
  carbsEatenG: 0,
  fatEatenG: 0,
  waterMl: 0,
  netCalorieBalance: 0,
  activeCaloriesBurned: 0,
  goalProgressPercent: 0,
  basketCost: null,
  savingsFromSpecials: 0,
  streak: 0,
  currentWeightKg: 86,
};

const goal = {
  maintenanceCalories: 2500,
  dailyCalorieTarget: 2000,
  dailyDeficit: 500,
  estimatedWeeksToGoal: 16,
  expectedWeeklyLossKg: 0.5,
  proteinTargetG: 140,
  carbsTargetG: 210,
  fatTargetG: 65,
  currentWeightKg: 86,
  targetWeightKg: 78,
  progressPercent: 0,
};

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/api/healthz") return send(res, 200, { status: "ok", service: "nutribasket-api" });
  if (req.method === "GET" && req.url === "/api/profile") return profile ? send(res, 200, profile) : send(res, 404, { error: "Profile not found" });
  if (req.method === "PUT" && req.url === "/api/profile") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      profile = { id: 1, ...JSON.parse(body) };
      send(res, 200, profile);
    });
    return;
  }
  if (req.method === "GET" && req.url === "/api/dashboard/today") return send(res, 200, dashboard);
  if (req.method === "GET" && req.url === "/api/dashboard/snack-suggestions") return send(res, 200, []);
  if (req.method === "GET" && req.url === "/api/dashboard/meal-suggestion") return send(res, 200, null);
  if (req.method === "GET" && req.url === "/api/profile/goal-summary") return send(res, 200, goal);
  return send(res, 404, { error: `No fixture for ${req.method} ${req.url}` });
});

server.listen(5999, "127.0.0.1");
process.on("SIGTERM", () => server.close());
