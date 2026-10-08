export function createInvalidatableInitializer(task: () => Promise<void>) {
  let generation = 0;
  let completedGeneration = -1;
  let currentRun: Promise<void> | null = null;

  return {
    invalidate() {
      generation += 1;
    },

    async ensure() {
      while (completedGeneration !== generation) {
        if (currentRun) {
          await currentRun;
          continue;
        }

        const targetGeneration = generation;
        const promise = task()
          .then(() => {
            completedGeneration = targetGeneration;
          })
          .finally(() => {
            if (currentRun === promise) currentRun = null;
          });
        currentRun = promise;
        await promise;
      }
    },
  };
}
