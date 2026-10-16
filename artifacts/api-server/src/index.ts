import app from "./app";
import { logger } from "./lib/logger";
import { ensureEmployeeDirectorySeed } from "./lib/employee-access";
import { initializeApiBeforeListen } from "./lib/api-startup";
import {
  ensureDefaultStrengthStandards,
  ensureReferenceData,
} from "./routes/qc";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

void initializeApiBeforeListen({
  ensureEmployeeDirectorySeed,
  ensureReferenceData,
  ensureDefaultStrengthStandards,
  startServer: () => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");
    });
  },
})
  .catch((err) => {
    logger.error({ err }, "Unable to initialize application data");
    process.exit(1);
  });
