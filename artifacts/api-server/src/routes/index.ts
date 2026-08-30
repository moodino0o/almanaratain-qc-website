import { Router, type IRouter } from "express";
import healthRouter from "./health";
import qcRouter from "./qc";

const router: IRouter = Router();

router.use(healthRouter);
router.use(qcRouter);

export default router;
