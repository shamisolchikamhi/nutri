import { Router, type IRouter } from "express";
import { chatWithAgent, confirmAgentAction, dismissAgentAction, undoAgentAction, updateAgentAction } from "../services/agent-service";
import { parseId } from "../lib/request";

const router: IRouter = Router();

router.post("/agent/chat", async (req, res): Promise<void> => {
  const messages = Array.isArray(req.body?.messages)
    ? req.body.messages.filter((message: unknown): message is { role: "user" | "assistant"; content: string } => {
        if (!message || typeof message !== "object") return false;
        const value = message as Record<string, unknown>;
        return (value.role === "user" || value.role === "assistant") && typeof value.content === "string" && value.content.trim().length > 0;
      }).slice(-20)
    : [];
  if (messages.length === 0) {
    res.status(400).json({ error: "At least one user message is required." });
    return;
  }
  try {
    res.json(await chatWithAgent(messages));
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : "Nutri Agent is temporarily unavailable." });
  }
});

router.post("/agent/actions/:id/confirm", async (req, res): Promise<void> => {
  try {
    res.json(await confirmAgentAction(parseId(req.params.id)));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "The action could not be confirmed." });
  }
});

router.post("/agent/actions/:id/dismiss", async (req, res): Promise<void> => {
  try {
    res.json(await dismissAgentAction(parseId(req.params.id)));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "The action could not be dismissed." });
  }
});

router.put("/agent/actions/:id", async (req, res): Promise<void> => {
  if (!req.body?.payload || typeof req.body.payload !== "object" || Array.isArray(req.body.payload)) {
    res.status(400).json({ error: "A structured action payload is required." });
    return;
  }
  try {
    res.json(await updateAgentAction(parseId(req.params.id), req.body.payload));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "The action could not be edited." });
  }
});

router.post("/agent/actions/:id/undo", async (req, res): Promise<void> => {
  try {
    res.json(await undoAgentAction(parseId(req.params.id)));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "The action could not be undone." });
  }
});

export default router;
