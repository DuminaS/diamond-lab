// Mock rewarded-ad flow. Real ad networks (e.g. AdMob) resolve a callback after the viewer watches
// a video and hand back a verified reward grant; this simulates that same contract (a promise that
// resolves true only if the full duration elapsed) so callers never need to change when a real SDK
// is swapped in here later.
import { openDialog, closeDialog } from "../ui/dialog.js";

const AD_DURATION_MS = 30000;
const TICK_MS = 200;

// This module never receives untrusted input for rewardLabel today (every call site passes a
// hardcoded string), but it reaches innerHTML the same way every other user-facing string in this
// app does, so it gets the same defensive escaping as a matter of consistency, not because a real
// exploit exists here.
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c=>({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}

export function showRewardedAd({ rewardLabel = "Bonus Reroll" } = {}) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("rewardedAdOverlay");
    if (!overlay) { resolve(false); return; }

    let remainingMs = AD_DURATION_MS;
    let settled = false;
    const label = escapeHtml(rewardLabel);

    // Wave 8 (MASTER_REMEDIATION_SPEC.md task #3): built ONCE. Before this fix, the countdown timer
    // called `overlay.innerHTML = ...` on every 200ms tick -- destroying and recreating the Skip/
    // Claim buttons (and whatever had keyboard focus on them) from scratch up to 150 times over one
    // 30-second ad. Every tick below now only updates the specific text/attribute that actually
    // changed (progress width, seconds-left text, the claim button's disabled state).
    overlay.innerHTML = `
      <div class="ad-card">
        <div class="ad-eyebrow">Sponsored Break</div>
        <h3 id="adDialogHeading">Watching ad for ${label}…</h3>
        <p class="ad-note">Placeholder ad — a real rewarded-video network plugs in here later.</p>
        <div class="ad-progress"><span class="ad-progress-fill" id="adProgressFill" style="width:0%"></span></div>
        <div class="ad-timer" id="adTimerText" aria-live="polite">${Math.ceil(AD_DURATION_MS / 1000)}s left</div>
        <div class="ad-actions">
          <button type="button" class="btn btn-ghost ad-cancel" id="adCancelBtn">Skip (no reward)</button>
          <button type="button" class="btn btn-primary ad-claim" id="adClaimBtn" disabled>Claim ${label}</button>
        </div>
      </div>`;
    const fillEl = overlay.querySelector("#adProgressFill");
    const timerEl = overlay.querySelector("#adTimerText");
    const claimBtn = overlay.querySelector("#adClaimBtn");
    const cancelBtn = overlay.querySelector("#adCancelBtn");

    function updateTick(){
      const secondsLeft = Math.ceil(remainingMs / 1000);
      const pct = 100 - (remainingMs / AD_DURATION_MS) * 100;
      const ready = remainingMs <= 0;
      fillEl.style.width = pct + "%";
      timerEl.textContent = ready ? "Reward ready!" : secondsLeft + "s left";
      claimBtn.disabled = !ready;
    }

    function finish(completed) {
      if (settled) return;
      settled = true;
      clearInterval(timerId);
      closeDialog(overlay);
      overlay.innerHTML = "";
      resolve(completed);
    }

    cancelBtn.addEventListener("click", () => finish(false));
    claimBtn.addEventListener("click", () => { if (remainingMs <= 0) finish(true); });

    const timerId = setInterval(() => {
      remainingMs = Math.max(0, remainingMs - TICK_MS);
      updateTick();
      if (remainingMs <= 0) clearInterval(timerId);
    }, TICK_MS);

    updateTick();
    // Escape defaults to a no-reward skip here (not a bare close) -- leaving via Escape is the same
    // real choice as clicking "Skip", never a silent way to dismiss without resolving the promise.
    openDialog(overlay, { labelledBy: "adDialogHeading", initialFocus: cancelBtn, onEscape: () => finish(false) });
  });
}
