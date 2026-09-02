// Wave 9 (MASTER_REMEDIATION_SPEC.md): Stage 1 of incremental modularization -- pure award/badge
// lookup tables (icon path data, real NFL record book values) extracted verbatim from
// src/main.js's single monolithic IIFE. Byte-for-byte identical to what main.js already had; no
// logic here, no embedded functions, no reference to any other main.js-internal state.

export const BADGE_ICONS = {
    bolt: `<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/>`,
    target: `<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.3"/><circle cx="12" cy="12" r="1"/>`,
    shield: `<path d="M12 3l7 3v6c0 5-3.5 7.8-7 9-3.5-1.2-7-4-7-9V6l7-3Z"/>`,
    clock: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>`,
    star: `<path d="M12 3l2.6 5.8 6.2.6-4.7 4.2 1.4 6.2L12 16.9 6.5 19.8l1.4-6.2-4.7-4.2 6.2-.6L12 3Z"/>`,
    football: `<ellipse cx="12" cy="12" rx="9" ry="5.2" transform="rotate(-25 12 12)"/><path d="M7.6 10l8.8 4M8.8 8.5l1 2M15.2 15.5l-1-2M10 6.9l1 2.1M14 17.1l-1-2.1"/>`,
    gauge: `<path d="M4 15a8 8 0 1 1 16 0"/><path d="M12 15l4-5"/><circle cx="12" cy="15" r="1.1"/>`,
    wing: `<path d="M3 13c4-6 9-8 13-6-2 1-3 2-3 4 3-1 6 0 8 3-5 1-9 0-12-2 0 3-2 5-6 5 2-1 3-2 3-4-1 1-2 1-3 0Z"/>`,
    mountain: `<path d="M3 18l5-9 4 6 3-4 6 7Z"/>`,
    anchor: `<circle cx="12" cy="5" r="2"/><path d="M12 7v13M7 13H3a9 9 0 0 0 9 8 9 9 0 0 0 9-8h-4M8 10h8"/>`,
    lock: `<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>`,
    chain: `<circle cx="8.5" cy="12" r="4"/><circle cx="15.5" cy="12" r="4"/>`,
    crown: `<path d="M4 18h16l-1-8-4 3-3-6-3 6-4-3-1 8Z"/>`,
    infinity: `<path d="M7 9a4.5 4.5 0 0 0 0 9c3 0 4-2 5-4.5S14 9 17 9a4.5 4.5 0 0 1 0 9c-3 0-4-2-5-4.5S9 9 7 9Z"/>`,
    heart: `<path d="M12 20s-7-4.4-9.3-8.8C1 8 2.5 5 5.7 5c1.9 0 3.3 1 4.3 2.4C11 6 12.4 5 14.3 5c3.2 0 4.7 3 3 6.2C19 15.6 12 20 12 20Z"/>`,
    compass: `<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5 5-2Z"/>`,
    flame: `<path d="M12 2c1.2 3.8-3.6 5.2-3.6 9.6a3.6 3.6 0 1 0 7.2 0c0-1.6-.6-2.4-.6-2.4s.6 2.4-1 3.2c.8-2.6-1.6-3.6-1.6-6 0 0-.4 2.4 1.4 2.4-1.6-2.4.6-3.6-1.8-6.8Z"/>`,
    gem: `<path d="M6 3h12l3 6-9 12L3 9Z"/><path d="M3 9h18M9 3l-3 6 6 12 6-12-3-6"/>`,
    sunrise: `<path d="M12 3v3M4.2 10.2l2.1 2.1M19.8 10.2l-2.1 2.1M2 18h20M6 18a6 6 0 0 1 12 0"/>`,
    book: `<path d="M4 5c2-1 5-1 8 0v14c-3-1-6-1-8 0V5ZM20 5c-2-1-5-1-8 0v14c3-1 6-1 8 0V5Z"/>`,
    snow: `<path d="M12 2v20M4 7l16 10M20 7L4 17M2 12h20M7 4l10 16M17 4L7 20"/>`,
    trophy: `<path d="M8 3h8v3a4 4 0 0 1-8 0V3Z"/><path d="M6 4H4a3 3 0 0 0 3 5M18 4h2a3 3 0 0 1-3 5"/><path d="M12 10v4M9 20h6M9 20v-1a3 3 0 0 1 3-3 3 3 0 0 1 3 3v1"/>`,
    paw: `<ellipse cx="8" cy="8.5" rx="2" ry="2.6"/><ellipse cx="12" cy="6.2" rx="2.1" ry="2.8"/><ellipse cx="16" cy="8.5" rx="2" ry="2.6"/><ellipse cx="12" cy="15.5" rx="4.4" ry="3.5"/>`,
  };

export const MODERN_NFL_RECORDS = {
    seasonPassYards: { value: 5477, label: "Most Passing Yards, Single Season", holder: "Peyton Manning, 2013" },
    seasonPassTd:    { value: 55,   label: "Most Passing TDs, Single Season", holder: "Peyton Manning, 2013" },
    seasonRating:    { value: 122.5,label: "Highest Passer Rating, Single Season", holder: "Aaron Rodgers, 2011" },
    seasonRushYards: { value: 1206, label: "Most Rushing Yards by a QB, Single Season", holder: "Lamar Jackson, 2019" },
    careerPassYards: { value: 89214,label: "Most Career Passing Yards", holder: "Tom Brady" },
    careerPassTd:    { value: 649,  label: "Most Career Passing TDs", holder: "Tom Brady" },
  };

export const TROPHY_ICONS = {
    ring: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 3h12l-1.2 6.2a4.8 4.8 0 0 1-4.8 3.9v0a4.8 4.8 0 0 1-4.8-3.9L6 3Z" fill="var(--field)" stroke="var(--field-strong)" stroke-width="1"/><path d="M10.5 13v3M13.5 13v3" stroke="var(--field-strong)" stroke-width="1.4"/><rect x="8.5" y="16" width="7" height="2" rx="0.6" fill="var(--field)"/><rect x="7" y="18" width="10" height="2.5" rx="0.8" fill="var(--field-strong)"/></svg>`,
    mvp: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.5l2.7 5.6 6.1.8-4.4 4.3 1 6.1L12 16.3l-5.4 3 1-6.1-4.4-4.3 6.1-.8L12 2.5Z" fill="var(--field)" stroke="var(--field-strong)" stroke-width="1"/></svg>`,
    allpro: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="9" r="6" fill="var(--field)" stroke="var(--field-strong)" stroke-width="1"/><path d="M9 14.5L7 21l5-2.5L17 21l-2-6.5" fill="var(--field-strong)"/></svg>`,
    probowl: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3l2.1 4.4 4.9.6-3.6 3.4.9 4.8-4.3-2.3-4.3 2.3.9-4.8-3.6-3.4 4.9-.6L12 3Z" fill="var(--good)" stroke="var(--good)" stroke-width="0.6"/></svg>`,
  };
