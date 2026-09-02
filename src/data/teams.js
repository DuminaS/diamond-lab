// Wave 9 (MASTER_REMEDIATION_SPEC.md): Stage 1 of incremental modularization -- pure team,
// division-alignment, and playoff-format data extracted verbatim from src/main.js's single
// monolithic IIFE. Byte-for-byte identical to what main.js already had (moved, not rewritten); no
// logic lives here, no embedded functions, no reference to any other main.js-internal state -- see
// the spec's own "no circular dependencies" / "add imports/exports around pure functions first"
// rules for why this had to be genuinely pure before it could move.

  export const TEAMS = [{"id":"ARI","start":1960,"names":[{"from":1960,"to":1987,"name":"St. Louis Cardinals"},{"from":1988,"to":1993,"name":"Phoenix Cardinals"},{"from":1994,"to":9999,"name":"Arizona Cardinals"}]},{"id":"ATL","start":1966,"names":[{"from":1966,"to":9999,"name":"Atlanta Falcons"}]},{"id":"BAL","start":1996,"names":[{"from":1996,"to":9999,"name":"Baltimore Ravens"}]},{"id":"BUF","start":1960,"names":[{"from":1960,"to":9999,"name":"Buffalo Bills"}]},{"id":"CAR","start":1995,"names":[{"from":1995,"to":9999,"name":"Carolina Panthers"}]},{"id":"CHI","start":1960,"names":[{"from":1960,"to":9999,"name":"Chicago Bears"}]},{"id":"CIN","start":1968,"names":[{"from":1968,"to":9999,"name":"Cincinnati Bengals"}]},{"id":"CLE","start":1960,"names":[{"from":1960,"to":9999,"name":"Cleveland Browns"}]},{"id":"DAL","start":1960,"names":[{"from":1960,"to":9999,"name":"Dallas Cowboys"}]},{"id":"DEN","start":1960,"names":[{"from":1960,"to":9999,"name":"Denver Broncos"}]},{"id":"DET","start":1960,"names":[{"from":1960,"to":9999,"name":"Detroit Lions"}]},{"id":"GB","start":1960,"names":[{"from":1960,"to":9999,"name":"Green Bay Packers"}]},{"id":"HOU","start":2002,"names":[{"from":2002,"to":9999,"name":"Houston Texans"}]},{"id":"IND","start":1960,"names":[{"from":1960,"to":1983,"name":"Baltimore Colts"},{"from":1984,"to":9999,"name":"Indianapolis Colts"}]},{"id":"JAX","start":1995,"names":[{"from":1995,"to":9999,"name":"Jacksonville Jaguars"}]},{"id":"KC","start":1960,"names":[{"from":1960,"to":1962,"name":"Dallas Texans"},{"from":1963,"to":9999,"name":"Kansas City Chiefs"}]},{"id":"LV","start":1960,"names":[{"from":1960,"to":1981,"name":"Oakland Raiders"},{"from":1982,"to":1994,"name":"Los Angeles Raiders"},{"from":1995,"to":2019,"name":"Oakland Raiders"},{"from":2020,"to":9999,"name":"Las Vegas Raiders"}]},{"id":"LAC","start":1960,"names":[{"from":1960,"to":1960,"name":"Los Angeles Chargers"},{"from":1961,"to":2016,"name":"San Diego Chargers"},{"from":2017,"to":9999,"name":"Los Angeles Chargers"}]},{"id":"LAR","start":1960,"names":[{"from":1960,"to":1994,"name":"Los Angeles Rams"},{"from":1995,"to":2015,"name":"St. Louis Rams"},{"from":2016,"to":9999,"name":"Los Angeles Rams"}]},{"id":"MIA","start":1966,"names":[{"from":1966,"to":9999,"name":"Miami Dolphins"}]},{"id":"MIN","start":1961,"names":[{"from":1961,"to":9999,"name":"Minnesota Vikings"}]},{"id":"NE","start":1960,"names":[{"from":1960,"to":1970,"name":"Boston Patriots"},{"from":1971,"to":9999,"name":"New England Patriots"}]},{"id":"NO","start":1967,"names":[{"from":1967,"to":9999,"name":"New Orleans Saints"}]},{"id":"NYG","start":1960,"names":[{"from":1960,"to":9999,"name":"New York Giants"}]},{"id":"NYJ","start":1960,"names":[{"from":1960,"to":1962,"name":"New York Titans"},{"from":1963,"to":9999,"name":"New York Jets"}]},{"id":"PHI","start":1960,"names":[{"from":1960,"to":9999,"name":"Philadelphia Eagles"}]},{"id":"PIT","start":1960,"names":[{"from":1960,"to":9999,"name":"Pittsburgh Steelers"}]},{"id":"SF","start":1960,"names":[{"from":1960,"to":9999,"name":"San Francisco 49ers"}]},{"id":"SEA","start":1976,"names":[{"from":1976,"to":9999,"name":"Seattle Seahawks"}]},{"id":"TB","start":1976,"names":[{"from":1976,"to":9999,"name":"Tampa Bay Buccaneers"}]},{"id":"TEN","start":1960,"names":[{"from":1960,"to":1996,"name":"Houston Oilers"},{"from":1997,"to":1998,"name":"Tennessee Oilers"},{"from":1999,"to":9999,"name":"Tennessee Titans"}]},{"id":"WAS","start":1960,"names":[{"from":1960,"to":2019,"name":"Washington Redskins"},{"from":2020,"to":2021,"name":"Washington Football Team"},{"from":2022,"to":9999,"name":"Washington Commanders"}]}];
  /* ----- team color pairs for the draft night reveal card. Publicly-known brand colors only —
     no logos or crests are reproduced, just a stylized primary/secondary gradient + initials
     badge, to keep the visual flourish without touching trademarked artwork. ----- */
  export const TEAM_COLORS = {
    ARI:["#97233F","#000000"], ATL:["#A71930","#000000"], BAL:["#241773","#9E7C0C"], BUF:["#00338D","#C60C30"],
    CAR:["#0085CA","#101820"], CHI:["#0B162A","#C83803"], CIN:["#FB4F14","#000000"], CLE:["#311D00","#FF3C00"],
    DAL:["#041E42","#869397"], DEN:["#FB4F14","#002244"], DET:["#0076B6","#B0B7BC"], GB:["#203731","#FFB612"],
    HOU:["#03202F","#A71930"], IND:["#002C5F","#A2AAAD"], JAX:["#101820","#D7A22A"], KC:["#E31837","#FFB81C"],
    LV:["#000000","#A5ACAF"], LAC:["#0080C6","#FFC20E"], LAR:["#003594","#FFA300"], MIA:["#008E97","#F58220"],
    MIN:["#4F2683","#FFC62F"], NE:["#002244","#C60C30"], NO:["#101820","#D3BC8D"], NYG:["#0B2265","#A71930"],
    NYJ:["#125740","#000000"], PHI:["#004C54","#A5ACAF"], PIT:["#FFB612","#101820"], SF:["#AA0000","#B3995D"],
    SEA:["#002244","#69BE28"], TB:["#D50A0A","#34302B"], TEN:["#0C2340","#4B92DB"], WAS:["#5A1414","#FFB612"],
  };
  /* ----- league structure: divisional alignment and playoff format both change by YEAR, not
     just by decade, tracking real NFL history — expansion, relocation, and realignment all
     shift who's in the league and how the bracket is built.
     - 2002-present matches the real 4-division/conf map used today.
     - 1970-2001 matches the real 3-division/conf map (AFC East/Central/West, NFC East/Central/
       West) that ran from the AFL-NFL merger to the 2002 Houston Texans realignment.
     - Pre-1970 is simplified: the AFL and "NFL" are modeled as two broad conferences with one
       East/West split each, standing in for the real pre-merger structure (which itself went
       through several irregular, non-geographic division schemes — Century, Capitol, Coastal —
       in its final seasons). Baltimore, Cleveland, and Pittsburgh — all AFC teams today — were
       NFL teams before the 1970 merger, so they're modeled on the "NFL" side for the 1960s. ----- */
  export const DIVISIONS = [
    { conf:"AFC", name:"East",  teams:["BUF","MIA","NE","NYJ"] },
    { conf:"AFC", name:"North", teams:["BAL","CIN","CLE","PIT"] },
    { conf:"AFC", name:"South", teams:["HOU","IND","JAX","TEN"] },
    { conf:"AFC", name:"West",  teams:["DEN","KC","LV","LAC"] },
    { conf:"NFC", name:"East",  teams:["DAL","NYG","PHI","WAS"] },
    { conf:"NFC", name:"North", teams:["CHI","DET","GB","MIN"] },
    { conf:"NFC", name:"South", teams:["ATL","CAR","NO","TB"] },
    { conf:"NFC", name:"West",  teams:["ARI","LAR","SF","SEA"] },
  ];
  export const DIVISIONS_1970_2001 = [
    { conf:"AFC", name:"East",    teams:["BUF","MIA","NE","NYJ","IND"] },
    { conf:"AFC", name:"Central", teams:["PIT","CLE","CIN","TEN","JAX","BAL"] },
    { conf:"AFC", name:"West",    teams:["DEN","KC","LV","LAC","SEA"] },
    { conf:"NFC", name:"East",    teams:["DAL","NYG","PHI","WAS","ARI"] },
    { conf:"NFC", name:"Central", teams:["CHI","DET","GB","MIN","TB"] },
    { conf:"NFC", name:"West",    teams:["LAR","SF","ATL","NO","CAR"] },
  ];
  export const DIVISIONS_PRE_1970 = [
    { conf:"AFC", name:"East", teams:["BUF","MIA","NE","NYJ","TEN"] },
    { conf:"AFC", name:"West", teams:["DEN","KC","LV","LAC","CIN"] },
    { conf:"NFC", name:"East", teams:["CLE","DAL","NYG","PHI","PIT","ARI","WAS","ATL"] },
    { conf:"NFC", name:"West", teams:["IND","CHI","DET","GB","LAR","MIN","SF","NO"] },
  ];
  /* Playoff format by year: how many wild-card slots get added on top of the division winners,
     and how many wild-card-round GAMES are played (seedsPerConf - 2*wcGames = teams that bye
     straight through to the Divisional round). Tracks the real expansion history of the NFL
     playoff bracket, including the odd 1978-89 shape (only the two wild cards played each
     other in the "Wild Card" round; all three division winners waited for the Divisional
     round). */
  export const PLAYOFF_ERAS = [
    { from:1900, to:1969, wildcards:0, wcGames:0 },   // pre-merger: division/conference champs only, no wild cards existed
    { from:1970, to:1977, wildcards:1, wcGames:2 },   // all 4 teams play in, no byes
    { from:1978, to:1989, wildcards:2, wcGames:1 },   // the 2 wild cards play each other; 3 division winners wait
    { from:1990, to:2001, wildcards:3, wcGames:2 },   // 3rd wild card added; top 2 seeds bye
    { from:2002, to:2019, wildcards:2, wcGames:2 },   // realignment to 4 divisions/conf; top 2 seeds bye
    { from:2020, to:9999, wildcards:3, wcGames:3 },   // 7th seed added; only the #1 seed byes
  ];
