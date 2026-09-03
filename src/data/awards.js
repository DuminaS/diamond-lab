// Diamond Lab: pure award/badge lookup tables -- inline-SVG icon path data plus real MLB
// record-book values. No logic, no embedded functions, no reference to main.js-internal state.

export const BADGE_ICONS = {
    bolt: `<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/>`,
    target: `<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.3"/><circle cx="12" cy="12" r="1"/>`,
    shield: `<path d="M12 3l7 3v6c0 5-3.5 7.8-7 9-3.5-1.2-7-4-7-9V6l7-3Z"/>`,
    clock: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>`,
    star: `<path d="M12 3l2.6 5.8 6.2.6-4.7 4.2 1.4 6.2L12 16.9 6.5 19.8l1.4-6.2-4.7-4.2 6.2-.6L12 3Z"/>`,
    baseball: `<circle cx="12" cy="12" r="9"/><path d="M5.5 6.5c3 2 3 9 0 11M18.5 6.5c-3 2-3 9 0 11"/>`,
    football: `<circle cx="12" cy="12" r="9"/><path d="M5.5 6.5c3 2 3 9 0 11M18.5 6.5c-3 2-3 9 0 11"/>`,
    bat: `<path d="M4 20l3-3M8.5 15.5l7-7c2-2 4.5-2.5 4.5-2.5s-.5 2.5-2.5 4.5l-7 7a2.1 2.1 0 0 1-3-3Z"/>`,
    glove: `<path d="M7 21v-6M7 9V6a2 2 0 0 1 4 0M11 15V5a2 2 0 0 1 4 0v8M15 13V7a2 2 0 0 1 4 0v6a7 7 0 0 1-7 7H9a5 5 0 0 1-5-5 2 2 0 0 1 4 0"/>`,
    diamond: `<path d="M12 3l9 9-9 9-9-9 9-9Z"/>`,
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

// Real MLB record-book marks. `MLB_RECORDS` is the current name; `MODERN_NFL_RECORDS` stays as an
// alias only until every call site in main.js is migrated (Phase 3 of the baseball conversion).
export const MLB_RECORDS = {
    seasonHR:       { value: 73,   label: "Most Home Runs, Single Season", holder: "Barry Bonds, 2001" },
    seasonRBI:      { value: 191,  label: "Most RBI, Single Season", holder: "Hack Wilson, 1930" },
    seasonHits:     { value: 262,  label: "Most Hits, Single Season", holder: "Ichiro Suzuki, 2004" },
    seasonAvg:      { value: 0.406,label: "Highest Batting Average, Single Season (modern)", holder: "Ted Williams, 1941" },
    seasonOPSplus:  { value: 268,  label: "Highest OPS+, Single Season", holder: "Barry Bonds, 2002" },
    seasonSB:       { value: 130,  label: "Most Stolen Bases, Single Season (modern)", holder: "Rickey Henderson, 1982" },
    careerHR:       { value: 762,  label: "Most Career Home Runs", holder: "Barry Bonds" },
    careerHits:     { value: 4256, label: "Most Career Hits", holder: "Pete Rose" },
    careerRBI:      { value: 2297, label: "Most Career RBI", holder: "Hank Aaron" },
  };
export const MODERN_NFL_RECORDS = MLB_RECORDS;

export const TROPHY_ICONS = {
    ring: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 3h12l-1.2 6.2a4.8 4.8 0 0 1-4.8 3.9v0a4.8 4.8 0 0 1-4.8-3.9L6 3Z" fill="var(--field)" stroke="var(--field-strong)" stroke-width="1"/><path d="M10.5 13v3M13.5 13v3" stroke="var(--field-strong)" stroke-width="1.4"/><rect x="8.5" y="16" width="7" height="2" rx="0.6" fill="var(--field)"/><rect x="7" y="18" width="10" height="2.5" rx="0.8" fill="var(--field-strong)"/></svg>`,
    mvp: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.5l2.7 5.6 6.1.8-4.4 4.3 1 6.1L12 16.3l-5.4 3 1-6.1-4.4-4.3 6.1-.8L12 2.5Z" fill="var(--field)" stroke="var(--field-strong)" stroke-width="1"/></svg>`,
    allpro: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="9" r="6" fill="var(--field)" stroke="var(--field-strong)" stroke-width="1"/><path d="M9 14.5L7 21l5-2.5L17 21l-2-6.5" fill="var(--field-strong)"/></svg>`,
    probowl: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3l2.1 4.4 4.9.6-3.6 3.4.9 4.8-4.3-2.3-4.3 2.3.9-4.8-3.6-3.4 4.9-.6L12 3Z" fill="var(--good)" stroke="var(--good)" stroke-width="0.6"/></svg>`,
  };
