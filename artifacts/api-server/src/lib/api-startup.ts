type ApiStartupSteps = {
  ensureEmployeeDirectorySeed: () => Promise<void>;
  ensureReferenceData: () => Promise<void>;
  ensureDefaultStrengthStandards: () => Promise<void>;
  startServer: () => void;
};

export async function initializeApiBeforeListen({
  ensureEmployeeDirectorySeed,
  ensureReferenceData,
  ensureDefaultStrengthStandards,
  startServer,
}: ApiStartupSteps) {
  await ensureEmployeeDirectorySeed();
  await ensureReferenceData();
  await ensureDefaultStrengthStandards();
  startServer();
}
