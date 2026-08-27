// Mock rewarded-ad flow. Real ad networks (e.g. AdMob) resolve a callback after the viewer watches
// a video and hand back a verified reward grant; this simulates that same contract (a promise that
// resolves true only if the full duration elapsed) so callers never need to change when a real SDK
// is swapped in here later.
const AD_DURATION_MS = 30000;
const TICK_MS = 200;

export function showRewardedAd({ rewardLabel = "Bonus Reroll" } = {}) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("rewardedAdOverlay");
    if (!overlay) { resolve(false); return; }

    let remainingMs = AD_DURATION_MS;
    let settled = false;

    function render() {
      const secondsLeft = Math.ceil(remainingMs / 1000);
      const pct = 100 - (remainingMs / AD_DURATION_MS) * 100;
      const ready = remainingMs <= 0;
      overlay.innerHTML = `
        <div class="ad-card">
          <div class="ad-eyebrow">Sponsored Break</div>
          <h3>Watching ad for ${rewardLabel}…</h3>
          <p class="ad-note">Placeholder ad — a real rewarded-video network plugs in here later.</p>
          <div class="ad-progress"><span class="ad-progress-fill" style="width:${pct}%"></span></div>
          <div class="ad-timer">${ready ? "Reward ready!" : secondsLeft + "s left"}</div>
          <div class="ad-actions">
            <button type="button" class="btn btn-ghost ad-cancel">Skip (no reward)</button>
            <button type="button" class="btn btn-primary ad-claim" ${ready ? "" : "disabled"}>Claim ${rewardLabel}</button>
          </div>
        </div>`;
      overlay.querySelector(".ad-cancel").addEventListener("click", () => finish(false));
      overlay.querySelector(".ad-claim").addEventListener("click", () => {
        if (remainingMs <= 0) finish(true);
      });
    }

    const timerId = setInterval(() => {
      remainingMs = Math.max(0, remainingMs - TICK_MS);
      render();
      if (remainingMs <= 0) clearInterval(timerId);
    }, TICK_MS);

    function finish(completed) {
      if (settled) return;
      settled = true;
      clearInterval(timerId);
      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden", "true");
      overlay.innerHTML = "";
      resolve(completed);
    }

    render();
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
  });
}
