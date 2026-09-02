// Wave 9 (MASTER_REMEDIATION_SPEC.md): Stage 2 of incremental modularization -- generic, stateless
// helpers (random/format/escape/number) used throughout the app, extracted verbatim from
// src/main.js's single monolithic IIFE. Each function's BODY is byte-for-byte identical to what
// main.js already had; the explanatory comments that used to sit near several of these in main.js
// were left in place there rather than relocated here, since more than one of them (safeNum's
// NaN-fallback rationale in particular) was actually documenting the specific CALLER right next to
// it, not the utility itself -- moving the prose here would have misattributed it. See main.js's
// own call sites for that context if a rationale isn't obvious from a name alone.

export function shuffle(arr){ const a=arr.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
export function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
export function clamp(n,lo,hi){ return Math.max(lo, Math.min(hi, n)); }
export function randInt(lo,hi){ return Math.floor(lo + Math.random()*(hi-lo+1)); }
export function lerp(a,b,t){ return a+(b-a)*t; }
export function svgEscape(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
export function fmtPct(x){ return (x*100).toFixed(1)+"%"; }
export function safeNum(v, fallback){
  return (typeof v==="number" && !isNaN(v)) ? v : fallback;
}
export function fmtMoney(n){
  if(n>=1000000) return "$"+(Math.round(n/100000)/10).toFixed(1).replace(/\.0$/,"")+"M";
  return "$"+Math.round(n/1000)+"K";
}
export function fmtDelta(n){ return (n>0?"+":"") + n; }
export function recordLine(w, l, t){ return (t>0) ? `${w}-${l}-${t}` : `${w}-${l}`; }
