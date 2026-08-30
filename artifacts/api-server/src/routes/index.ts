import { Router, type IRouter } from "express";
import healthRouter from "./health";
import qcRouter from "./qc";
import authRouter from "./auth";
import storageRouter from "./storage";
import archiveRouter from "./archive";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(storageRouter);
router.use(archiveRouter);
router.use(qcRouter);

export default router;
