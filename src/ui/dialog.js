// Wave 8 (MASTER_REMEDIATION_SPEC.md): shared modal/dialog behavior for every overlay in the app --
// role="dialog", aria-modal, an accessible name, initial focus, Tab/Shift+Tab trapping, Escape-to-
// close, focus restoration to whatever had focus before the dialog opened, and `inert` on the rest
// of the app while it's open (falls back to aria-hidden on a browser without `inert` support -- the
// focus trap below still keeps keyboard focus inside the dialog either way, so background elements
// stay behaviorally unreachable by keyboard even on that fallback path).
//
// A stack, not a single open/closed flag, so one dialog can open on top of another (e.g. a QB's
// rival profile opened by clicking a name inside the team page overlay) without the inner one's
// close accidentally restoring background interactivity while the outer one is still open.
//
// Exported so both src/main.js (the rival/team/card/box-score/key-moment/admin overlays) and
// src/ads/rewardedAd.js (a separate module by design -- see that file's own header) share the exact
// same behavior instead of each hand-rolling its own, inevitably-inconsistent version.

const INERT_SUPPORTED = typeof document !== "undefined" && "inert" in document.createElement("div");
let dialogStack = [];

function backgroundEls(){
  const els = [];
  const mainEl = document.getElementById("mainEl");
  if(mainEl) els.push(mainEl);
  const header = document.querySelector("header.scoreboard");
  if(header) els.push(header);
  return els;
}

function setBackgroundInert(on){
  backgroundEls().forEach(el=>{
    if(INERT_SUPPORTED) el.inert = on;
    else el.setAttribute("aria-hidden", on ? "true" : "false");
  });
}

function focusablesIn(container){
  return Array.from(container.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter(el=> el.offsetParent!==null || el===document.activeElement);
}

// Opens `overlayEl` as a real dialog. `opts`:
//   label / labelledBy -- accessible name (labelledBy wins if both given; an element id).
//   initialFocus -- element to focus first; defaults to the first focusable child, or the dialog
//     itself if it has none (e.g. a pure-status overlay).
//   onEscape -- called instead of the default closeDialog(overlayEl) when Escape is pressed, for a
//     caller that needs to run its own cleanup (matches an existing "×" button's own handler).
export function openDialog(overlayEl, opts){
  if(!overlayEl) return;
  opts = opts || {};
  // Idempotent for an already-open dialog -- some overlays re-render their own innerHTML in place
  // while staying open (e.g. the admin panel re-calling this on every tab switch); without this
  // guard, each call would push a second stack entry that never gets popped, permanently wedging
  // dialogStack.length above 0 and leaving the background inert forever after the first close.
  const existing = dialogStack.find(d=>d.el===overlayEl);
  const opener = existing ? existing.opener : document.activeElement;
  overlayEl.setAttribute("role", opts.role || "dialog");
  overlayEl.setAttribute("aria-modal", "true");
  if(opts.labelledBy) overlayEl.setAttribute("aria-labelledby", opts.labelledBy);
  else if(opts.label) overlayEl.setAttribute("aria-label", opts.label);
  overlayEl.setAttribute("aria-hidden", "false");
  overlayEl.classList.add("open");
  if(!overlayEl.hasAttribute("tabindex")) overlayEl.setAttribute("tabindex", "-1");
  if(dialogStack.length===0) setBackgroundInert(true);
  if(!existing) dialogStack.push({ el: overlayEl, opener });

  // Re-wire fresh each call rather than stacking a duplicate listener across repeated open() calls
  // on the same already-open dialog (the innerHTML was just replaced either way, so the closure's
  // captured `opts` -- onEscape in particular -- should reflect the latest call too).
  if(overlayEl._dialogKeydown) overlayEl.removeEventListener("keydown", overlayEl._dialogKeydown);
  function onKeydown(e){
    if(e.key==="Escape"){
      e.preventDefault(); e.stopPropagation();
      if(opts.onEscape) opts.onEscape(); else closeDialog(overlayEl);
      return;
    }
    if(e.key==="Tab"){
      const f = focusablesIn(overlayEl);
      if(!f.length){ e.preventDefault(); return; }
      const first = f[0], last = f[f.length-1];
      if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
    }
  }
  overlayEl.addEventListener("keydown", onKeydown);
  overlayEl._dialogKeydown = onKeydown;

  const focusables = focusablesIn(overlayEl);
  const target = opts.initialFocus || focusables[0] || overlayEl;
  // Focus needs the node actually in the DOM/painted first -- callers always set overlayEl.innerHTML
  // before calling this, so a microtask-free direct focus() call is enough; no rAF needed.
  if(target && typeof target.focus==="function") target.focus();
}

// Closes `overlayEl`, restoring background interactivity once no dialog remains open, and
// restoring focus to whatever had it before this dialog opened (if that element still exists).
// Does NOT clear overlayEl.innerHTML -- callers that want that (most do) still do it themselves,
// same as before this wave, so this stays a pure behavior/state cleanup.
export function closeDialog(overlayEl){
  if(!overlayEl) return;
  overlayEl.classList.remove("open");
  overlayEl.setAttribute("aria-hidden", "true");
  if(overlayEl._dialogKeydown){ overlayEl.removeEventListener("keydown", overlayEl._dialogKeydown); overlayEl._dialogKeydown = null; }
  const idx = dialogStack.findIndex(d=>d.el===overlayEl);
  const entry = idx>=0 ? dialogStack[idx] : null;
  if(idx>=0) dialogStack.splice(idx,1);
  if(dialogStack.length===0) setBackgroundInert(false);
  if(entry && entry.opener && document.body.contains(entry.opener) && typeof entry.opener.focus==="function"){
    entry.opener.focus();
  }
}
