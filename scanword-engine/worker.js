import { generateScanword } from './src/generator.js';

self.addEventListener('message', event => {
  const payload = event.data ?? {};
  try {
    const result = generateScanword(payload.entries, payload.options ?? {});
    if (!result.ok) {
      self.postMessage({
        ok: false,
        error: result.message,
        reason: result.reason,
        stats: result.stats ?? {
          seed: result.seed,
          attempts: result.attempts,
          rejectedReasons: result.rejectedReasons,
          elapsedMs: result.elapsedMs
        },
        diagnostics: result
      });
      return;
    }
    self.postMessage({
      ok: true,
      scanword: result.scanword,
      stats: result.stats
    });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error?.message ?? String(error),
      reason: 'UNHANDLED_GENERATOR_ERROR'
    });
  }
});
