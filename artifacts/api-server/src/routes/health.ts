import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  try {
    await pool.query("select 1");
    const data = HealthCheckResponse.parse({ status: "ok", service: "nutribasket-api" });
    res.json(data);
  } catch {
    res.status(503).json({ status: "unavailable", service: "nutribasket-api" });
  }
});

export default router;
