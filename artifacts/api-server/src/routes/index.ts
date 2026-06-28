import { Router, type IRouter } from "express";
import healthRouter from "./health";
import profileRouter from "./profile";
import logsRouter from "./logs";
import recipesRouter from "./recipes";
import productsRouter from "./products";
import basketsRouter from "./baskets";
import specialsRouter from "./specials";
import dashboardRouter from "./dashboard";
import savedRouter from "./saved";
import socialRecipesRouter from "./social-recipes";
import retailerStatusRouter from "./retailer-status";
import pantryRouter from "./pantry";
import marketIntelligenceRouter from "./market-intelligence";
import agentRouter from "./agent";

const router: IRouter = Router();

router.use(healthRouter);
router.use(profileRouter);
router.use(logsRouter);
router.use(recipesRouter);
router.use(productsRouter);
router.use(basketsRouter);
router.use(specialsRouter);
router.use(dashboardRouter);
router.use(savedRouter);
router.use(socialRecipesRouter);
router.use(retailerStatusRouter);
router.use(pantryRouter);
router.use(marketIntelligenceRouter);
router.use(agentRouter);

export default router;
