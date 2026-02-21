export function useDataGridInitialViewportRecovery(options) {
    const maxAttempts = Math.max(1, Math.trunc(options.maxAttempts ?? 12));
    const requestFrame = options.requestAnimationFrame ?? (callback => window.requestAnimationFrame(callback));
    const cancelFrame = options.cancelAnimationFrame ?? (handle => window.cancelAnimationFrame(handle));
    let recoveryFrame = null;
    let attempts = 0;
    function cancelRecovery() {
        if (recoveryFrame !== null) {
            cancelFrame(recoveryFrame);
            recoveryFrame = null;
        }
        attempts = 0;
    }
    function runRecoveryTick() {
        recoveryFrame = null;
        if (!options.resolveShouldRecover()) {
            attempts = 0;
            return;
        }
        options.runRecoveryStep();
        attempts += 1;
        if (attempts >= maxAttempts) {
            attempts = 0;
            return;
        }
        if (options.resolveShouldRecover()) {
            scheduleRecovery(false);
            return;
        }
        attempts = 0;
    }
    function scheduleRecovery(reset = false) {
        if (reset) {
            cancelRecovery();
        }
        if (recoveryFrame !== null) {
            return;
        }
        recoveryFrame = requestFrame(runRecoveryTick);
    }
    return {
        scheduleRecovery,
        cancelRecovery,
        isRecoveryScheduled: () => recoveryFrame !== null,
        getAttemptCount: () => attempts,
    };
}
