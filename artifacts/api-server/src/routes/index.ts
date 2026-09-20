import { Router, type IRouter } from "express";
import healthRouter from "./health";
import qcRouter from "./qc";
import authRouter from "./auth";
import storageRouter from "./storage";
import archiveRouter from "./archive";
import { requireAuthenticated } from "../middlewares/requireAuthenticated";
import employeesRouter from "./employees";
import complaintsRouter from "./complaints";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(requireAuthenticated);
router.use(employeesRouter);
router.use(storageRouter);
router.use(archiveRouter);
router.use(qcRouter);
router.use(complaintsRouter);

export default router;
