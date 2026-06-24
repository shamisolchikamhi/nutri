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

export default router;
