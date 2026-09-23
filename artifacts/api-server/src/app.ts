import path from "node:path";
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { authMiddleware } from "./middlewares/authMiddleware";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);

app.use("/api", router);

if (process.env.SERVE_FRONTEND === "true") {
  const frontendDirectory = path.resolve(
    process.cwd(),
    process.env.FRONTEND_DIST_DIR ?? "artifacts/al-manaratain-qc/dist/public",
  );
  const frontendEntry = path.join(frontendDirectory, "index.html");

  app.use(express.static(frontendDirectory));
  app.get("/{*splat}", (req, res, next) => {
    if (req.path === "/api" || req.path.startsWith("/api/")) {
      next();
      return;
    }

    res.sendFile(frontendEntry, (error) => {
      if (error) {
        next(error);
      }
    });
  });
}

export default app;
