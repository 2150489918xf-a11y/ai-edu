export function createQuestionKnowledgeWorker({ graphService, intervalMs = 1500 } = {}) {
  if (!graphService?.processNextPendingExtraction) {
    throw new Error('graphService.processNextPendingExtraction is required');
  }

  let activePromise = null;
  let timer = null;
  let started = false;

  function runOnce() {
    if (activePromise) return activePromise;
    activePromise = Promise.resolve()
      .then(() => graphService.processNextPendingExtraction())
      .finally(() => {
        activePromise = null;
      });
    return activePromise;
  }

  function schedule(delay = intervalMs) {
    if (!started || timer) return;
    timer = setTimeout(async () => {
      timer = null;
      try {
        await runOnce();
      } finally {
        schedule(intervalMs);
      }
    }, delay);
    timer.unref?.();
  }

  function start() {
    if (started) return;
    started = true;
    schedule(0);
  }

  async function stop() {
    started = false;
    if (timer) clearTimeout(timer);
    timer = null;
    if (activePromise) await activePromise;
  }

  return { runOnce, start, stop };
}
