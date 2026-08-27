import { showRewardedAd } from "./ads/rewardedAd.js";

(function(){
  "use strict";

  /* ================= Data ================= */
  const ATTRIBUTES = [{"key":"ARM","label":"Arm Strength","group":"physical"},{"key":"DAC","label":"Deep Ball Accuracy","group":"accuracy"},{"key":"SHA","label":"Short & Intermediate Accuracy","group":"accuracy"},{"key":"TCH","label":"Touch & Ball Placement","group":"accuracy"},{"key":"PKT","label":"Pocket Presence","group":"accuracy"},{"key":"REL","label":"Release Quickness","group":"physical"},{"key":"MOB","label":"Mobility","group":"physical"},{"key":"IMP","label":"Improvisation","group":"physical"},{"key":"ANT","label":"Anticipation","group":"mental"},{"key":"DEC","label":"Decision Making","group":"mental"},{"key":"CLU","label":"Clutch","group":"mental"},{"key":"DUR","label":"Durability","group":"mental"}];
  const DECADES = ["1960s","1970s","1980s","1990s","2000s","2010s","2020s"];
  const DECADE_BLURB = {"1960s":"Leather-tough, run-first, and barely forward-passing. Completion rates hover near 50%.","1970s":"The dead-ball era. Defenses rule, schedules run 14 games, and a 60% passer is a wizard.","1980s":"Play-action and the West Coast offense arrive. Arms get bigger, seasons hit 16 games.","1990s":"Zone blitzes, boundary rules loosen, and mobile quarterbacks start reshaping the position.","2000s":"The modern passing game takes hold — shotgun spreads, quick game, and record-book rewrites.","2010s":"Defenseless-receiver rules and RPOs turn the passer rating chart into a rocket.","2020s":"17-game slate, historic completion rates, and quarterbacks who run the whole offense pre-snap."};
  const LEAGUE = {"1960s":{"games":14,"comp":0.51,"ypa":6.9,"tdRate":0.038,"intRate":0.052,"attPerGame":27},"1970s":{"games":14,"comp":0.52,"ypa":6.6,"tdRate":0.036,"intRate":0.05,"attPerGame":27},"1980s":{"games":16,"comp":0.56,"ypa":7,"tdRate":0.042,"intRate":0.042,"attPerGame":31},"1990s":{"games":16,"comp":0.58,"ypa":6.9,"tdRate":0.041,"intRate":0.036,"attPerGame":32},"2000s":{"games":16,"comp":0.6,"ypa":7,"tdRate":0.04,"intRate":0.03,"attPerGame":33},"2010s":{"games":16,"comp":0.63,"ypa":7.2,"tdRate":0.041,"intRate":0.024,"attPerGame":35},"2020s":{"games":17,"comp":0.655,"ypa":7.3,"tdRate":0.042,"intRate":0.021,"attPerGame":34}};
  // ---- Career stat ceilings/floors (item #7) ----
  // Each decade's realistic per-attempt production range is grounded against an actual
  // record-caliber season from that decade, compared to that decade's LEAGUE average above.
  // Sources for the CEILING (best) side:
  //   1960s — Sonny Jurgensen, 1961 (3,723 yds/32 TD, ~57% comp on ~416 att) for comp/ypa/TD;
  //           Bart Starr, 1966 (3 INT all season) for the low-INT ceiling.
  //   1970s — Dan Fouts, 1979 (4,082 yds, 62.6% comp — first post-merger 4,000-yard season) for
  //           comp/ypa/INT; Fran Tarkenton, 1975 (~5.9% TD rate) for TD.
  //   1980s — Dan Marino, 1984 (5,084 yds / 48 TD / 17 INT, 64.2% comp, 564 att) — still the
  //           standard-bearer season decades later.
  //   1990s — Steve Young, 1994 (70.3% comp / 35 TD / 10 INT on 461 att) for comp/TD/INT;
  //           Warren Moon, 1991 (~4,690 yds) for ypa.
  //   2000s — Tom Brady, 2007 (4,806 yds / 50 TD / 8 INT, 68.9% comp, 117.2 rating).
  //   2010s — Peyton Manning, 2013 (5,477 yds / 55 TD / 10 INT, 659 att) for ypa/TD/INT;
  //           Drew Brees, 2018 (74.4% comp — the all-time record) for comp.
  //   2020s — Joe Burrow, 2024 (4,918 yds / 43 TD / 9 INT, 70.6% comp, 652 att) for TD/INT;
  //           Tua Tagovailoa, 2024 (72.9% comp) for comp; Patrick Mahomes, 2022 (~8.10 ypa) for ypa.
  // Every ceiling number below is that sourced record's rate scaled up another ~9% (the design
  // brief's "capped at slightly [8-10% more] above the best statistical season") so a flawless
  // 99-everywhere build, at its career-peak age, with no lucky boosts, lands AT the real record --
  // and only variance/temp boosts can push a season past it into that last 9%.
  // CEILINGS ACCUMULATE FORWARD ACROSS DECADES: a build drafted into the 2020s isn't limited to a
  // 2020s-only ceiling -- it can still reach an all-time mark set in an EARLIER decade (Marino's
  // '84 arm, Bart Starr's '66 ball security), the same way a real 2020s all-time-great could still
  // put up a Manning-2013-caliber season even though the league's own average has moved on. So
  // each decade's ceiling is the running best of every sourced record from that decade and every
  // decade before it (comp/ypa/TD: running max; INT: running min, since lower is better there) --
  // NOT reset back down just because a later decade's own record happened to be a bit lower.
  // The FLOOR (worst) side has no equivalent clean single-season source -- nobody keeps a
  // "worst starter of the decade" leaderboard -- so it's a flat, decade-independent, explicitly
  // ESTIMATED ratio against league average (0.70x comp, 0.68x ypa, 0.30x TD rate, 2.3x INT rate),
  // sanity-checked against George Blanda's real 1962 42-INT season (~10% INT rate, the actual
  // all-time record) landing comfortably inside — not past — every decade's floor, since a
  // 10-everywhere build should be able to be worse than any QB who was ever actually good enough
  // to start 16 games in the NFL. The floor is NOT cumulative -- it stays per-decade, since it was
  // never grounded in a real record to begin with.
  // Field meaning: lo/hi are the hard clamp bounds actually passed to clamp(). up/down are the
  // coefficients applied to the build's era/scheme-adjusted delta from a neutral (65-everywhere)
  // baseline -- "up" when the delta is >=0 (build better than neutral), "down" when it's negative
  // -- calibrated so a maxed or bottomed build actually reaches lo/hi instead of saturating
  // partway there. For comp/ypa/td, hi=ceiling(best)/lo=floor(worst); for int the sense flips
  // (lower is better), so lo=ceiling(fewest picks)/hi=floor(most picks) -- the formula sites
  // handle that inversion, this table just stores the two numeric bounds.
  const STAT_CAL = {
    "1960s": { comp:{lo:0.357,hi:0.6226,up:0.003609,down:0.003355}, ypa:{lo:4.692,hi:9.7773,up:0.10294,down:0.04506},
      td:{lo:0.0114,hi:0.08284,up:0.0015569,down:0.0006379}, int:{lo:0.01097,hi:0.1196,up:0.0013676,down:0.0014475} },
    "1970s": { comp:{lo:0.364,hi:0.68016,up:0.005133,down:0.003373}, ypa:{lo:4.488,hi:9.7773,up:0.1109,down:0.04346},
      td:{lo:0.0108,hi:0.08284,up:0.0016264,down:0.0006029}, int:{lo:0.01097,hi:0.115,up:0.0013551,down:0.0013978} },
    "1980s": { comp:{lo:0.392,hi:0.70196,up:0.004732,down:0.003182}, ypa:{lo:4.76,hi:9.8427,up:0.09702,down:0.04498},
      td:{lo:0.0126,hi:0.09293,up:0.0018321,down:0.0005465}, int:{lo:0.01097,hi:0.0966,up:0.0009881,down:0.0010706} },
    "1990s": { comp:{lo:0.406,hi:0.76496,up:0.006165,down:0.003295}, ypa:{lo:4.692,hi:9.8427,up:0.09601,down:0.0447},
      td:{lo:0.0123,hi:0.09293,up:0.0019974,down:0.0005218}, int:{lo:0.01097,hi:0.0828,up:0.000863,down:0.0008897} },
    "2000s": { comp:{lo:0.42,hi:0.76496,up:0.005809,down:0.003333}, ypa:{lo:4.76,hi:9.8427,up:0.09769,down:0.04595},
      td:{lo:0.012,hi:0.09418,up:0.0023054,down:0.0004904}, int:{lo:0.01097,hi:0.069,up:0.000682,down:0.0007345} },
    "2010s": { comp:{lo:0.441,hi:0.80,up:0.005986,down:0.0035}, ypa:{lo:4.896,hi:9.8427,up:0.09035,down:0.04659},
      td:{lo:0.0123,hi:0.09418,up:0.0022065,down:0.000508}, int:{lo:0.01097,hi:0.0552,up:0.0004539,down:0.0006035} },
    "2020s": { comp:{lo:0.4585,hi:0.80,up:0.004991,down:0.003656}, ypa:{lo:4.964,hi:9.8427,up:0.09033,down:0.04621},
      td:{lo:0.0126,hi:0.09418,up:0.0020787,down:0.0005231}, int:{lo:0.01097,hi:0.0483,up:0.0003482,down:0.0005301} },
  };
  // Rival QBs (simulateRivalSeasons) are driven off a single "talent" scalar instead of the
  // player's twelve-attribute build, so they get a flatter, slightly more conservative slice of
  // the same per-decade ceiling/floor -- a hand-built min-maxed player archetype can legitimately
  // reach further than a randomly-generated league talent grade. Matches the ~0.72-0.81x ratio
  // the original flat coefficients used between the two formulas.
  const RIVAL_STAT_SCALE = 0.75;
  const TEAMS = [{"id":"ARI","start":1960,"names":[{"from":1960,"to":1987,"name":"St. Louis Cardinals"},{"from":1988,"to":1993,"name":"Phoenix Cardinals"},{"from":1994,"to":9999,"name":"Arizona Cardinals"}]},{"id":"ATL","start":1966,"names":[{"from":1966,"to":9999,"name":"Atlanta Falcons"}]},{"id":"BAL","start":1996,"names":[{"from":1996,"to":9999,"name":"Baltimore Ravens"}]},{"id":"BUF","start":1960,"names":[{"from":1960,"to":9999,"name":"Buffalo Bills"}]},{"id":"CAR","start":1995,"names":[{"from":1995,"to":9999,"name":"Carolina Panthers"}]},{"id":"CHI","start":1960,"names":[{"from":1960,"to":9999,"name":"Chicago Bears"}]},{"id":"CIN","start":1968,"names":[{"from":1968,"to":9999,"name":"Cincinnati Bengals"}]},{"id":"CLE","start":1960,"names":[{"from":1960,"to":9999,"name":"Cleveland Browns"}]},{"id":"DAL","start":1960,"names":[{"from":1960,"to":9999,"name":"Dallas Cowboys"}]},{"id":"DEN","start":1960,"names":[{"from":1960,"to":9999,"name":"Denver Broncos"}]},{"id":"DET","start":1960,"names":[{"from":1960,"to":9999,"name":"Detroit Lions"}]},{"id":"GB","start":1960,"names":[{"from":1960,"to":9999,"name":"Green Bay Packers"}]},{"id":"HOU","start":2002,"names":[{"from":2002,"to":9999,"name":"Houston Texans"}]},{"id":"IND","start":1960,"names":[{"from":1960,"to":1983,"name":"Baltimore Colts"},{"from":1984,"to":9999,"name":"Indianapolis Colts"}]},{"id":"JAX","start":1995,"names":[{"from":1995,"to":9999,"name":"Jacksonville Jaguars"}]},{"id":"KC","start":1960,"names":[{"from":1960,"to":1962,"name":"Dallas Texans"},{"from":1963,"to":9999,"name":"Kansas City Chiefs"}]},{"id":"LV","start":1960,"names":[{"from":1960,"to":1981,"name":"Oakland Raiders"},{"from":1982,"to":1994,"name":"Los Angeles Raiders"},{"from":1995,"to":2019,"name":"Oakland Raiders"},{"from":2020,"to":9999,"name":"Las Vegas Raiders"}]},{"id":"LAC","start":1960,"names":[{"from":1960,"to":1960,"name":"Los Angeles Chargers"},{"from":1961,"to":2016,"name":"San Diego Chargers"},{"from":2017,"to":9999,"name":"Los Angeles Chargers"}]},{"id":"LAR","start":1960,"names":[{"from":1960,"to":1994,"name":"Los Angeles Rams"},{"from":1995,"to":2015,"name":"St. Louis Rams"},{"from":2016,"to":9999,"name":"Los Angeles Rams"}]},{"id":"MIA","start":1966,"names":[{"from":1966,"to":9999,"name":"Miami Dolphins"}]},{"id":"MIN","start":1961,"names":[{"from":1961,"to":9999,"name":"Minnesota Vikings"}]},{"id":"NE","start":1960,"names":[{"from":1960,"to":1970,"name":"Boston Patriots"},{"from":1971,"to":9999,"name":"New England Patriots"}]},{"id":"NO","start":1967,"names":[{"from":1967,"to":9999,"name":"New Orleans Saints"}]},{"id":"NYG","start":1960,"names":[{"from":1960,"to":9999,"name":"New York Giants"}]},{"id":"NYJ","start":1960,"names":[{"from":1960,"to":1962,"name":"New York Titans"},{"from":1963,"to":9999,"name":"New York Jets"}]},{"id":"PHI","start":1960,"names":[{"from":1960,"to":9999,"name":"Philadelphia Eagles"}]},{"id":"PIT","start":1960,"names":[{"from":1960,"to":9999,"name":"Pittsburgh Steelers"}]},{"id":"SF","start":1960,"names":[{"from":1960,"to":9999,"name":"San Francisco 49ers"}]},{"id":"SEA","start":1976,"names":[{"from":1976,"to":9999,"name":"Seattle Seahawks"}]},{"id":"TB","start":1976,"names":[{"from":1976,"to":9999,"name":"Tampa Bay Buccaneers"}]},{"id":"TEN","start":1960,"names":[{"from":1960,"to":1996,"name":"Houston Oilers"},{"from":1997,"to":1998,"name":"Tennessee Oilers"},{"from":1999,"to":9999,"name":"Tennessee Titans"}]},{"id":"WAS","start":1960,"names":[{"from":1960,"to":2019,"name":"Washington Redskins"},{"from":2020,"to":2021,"name":"Washington Football Team"},{"from":2022,"to":9999,"name":"Washington Commanders"}]}];
  const QBS = [{"name":"Johnny Unitas","team":"Baltimore Colts","years":"1956–1973","decade":"1960s","r":{"ARM":78,"DAC":80,"SHA":90,"TCH":88,"PKT":93,"REL":82,"MOB":45,"IMP":60,"ANT":96,"DEC":92,"CLU":95,"DUR":78}},{"name":"Bart Starr","team":"Green Bay Packers","years":"1956–1971","decade":"1960s","r":{"ARM":65,"DAC":72,"SHA":88,"TCH":85,"PKT":87,"REL":78,"MOB":40,"IMP":50,"ANT":93,"DEC":94,"CLU":93,"DUR":72}},{"name":"Len Dawson","team":"Kansas City Chiefs","years":"1957–1975","decade":"1960s","r":{"ARM":72,"DAC":76,"SHA":84,"TCH":80,"PKT":82,"REL":76,"MOB":48,"IMP":55,"ANT":88,"DEC":86,"CLU":84,"DUR":68}},{"name":"Sonny Jurgensen","team":"Washington Redskins","years":"1957–1974","decade":"1960s","r":{"ARM":84,"DAC":86,"SHA":88,"TCH":84,"PKT":78,"REL":75,"MOB":35,"IMP":48,"ANT":84,"DEC":78,"CLU":76,"DUR":60}},{"name":"Y.A. Tittle","team":"New York Giants","years":"1948–1964","decade":"1960s","r":{"ARM":74,"DAC":78,"SHA":80,"TCH":78,"PKT":80,"REL":70,"MOB":32,"IMP":42,"ANT":85,"DEC":82,"CLU":80,"DUR":62}},{"name":"George Blanda","team":"Houston Oilers","years":"1949–1975","decade":"1960s","r":{"ARM":68,"DAC":66,"SHA":70,"TCH":68,"PKT":74,"REL":65,"MOB":30,"IMP":40,"ANT":78,"DEC":72,"CLU":82,"DUR":90}},{"name":"Daryle Lamonica","team":"Oakland Raiders","years":"1963–1974","decade":"1960s","r":{"ARM":88,"DAC":80,"SHA":68,"TCH":62,"PKT":70,"REL":68,"MOB":42,"IMP":50,"ANT":68,"DEC":62,"CLU":70,"DUR":65}},{"name":"Frank Ryan","team":"Cleveland Browns","years":"1958–1970","decade":"1960s","r":{"ARM":70,"DAC":68,"SHA":74,"TCH":70,"PKT":72,"REL":66,"MOB":38,"IMP":42,"ANT":74,"DEC":72,"CLU":68,"DUR":64}},{"name":"Norm Snead","team":"Philadelphia Eagles","years":"1961–1976","decade":"1960s","r":{"ARM":74,"DAC":62,"SHA":66,"TCH":60,"PKT":62,"REL":64,"MOB":40,"IMP":40,"ANT":60,"DEC":55,"CLU":55,"DUR":66}},{"name":"Jack Kemp","team":"Buffalo Bills","years":"1957–1970","decade":"1960s","r":{"ARM":76,"DAC":68,"SHA":70,"TCH":64,"PKT":68,"REL":66,"MOB":50,"IMP":52,"ANT":70,"DEC":65,"CLU":74,"DUR":60}},{"name":"Roger Staubach","team":"Dallas Cowboys","years":"1969–1979","decade":"1970s","r":{"ARM":84,"DAC":84,"SHA":88,"TCH":84,"PKT":86,"REL":78,"MOB":78,"IMP":76,"ANT":88,"DEC":87,"CLU":95,"DUR":70}},{"name":"Terry Bradshaw","team":"Pittsburgh Steelers","years":"1970–1983","decade":"1970s","r":{"ARM":90,"DAC":78,"SHA":76,"TCH":72,"PKT":78,"REL":74,"MOB":55,"IMP":58,"ANT":68,"DEC":66,"CLU":86,"DUR":72}},{"name":"Bob Griese","team":"Miami Dolphins","years":"1967–1980","decade":"1970s","r":{"ARM":68,"DAC":74,"SHA":84,"TCH":82,"PKT":84,"REL":76,"MOB":38,"IMP":45,"ANT":88,"DEC":88,"CLU":84,"DUR":66}},{"name":"Fran Tarkenton","team":"Minnesota Vikings","years":"1961–1978","decade":"1970s","r":{"ARM":76,"DAC":74,"SHA":78,"TCH":72,"PKT":72,"REL":70,"MOB":88,"IMP":82,"ANT":84,"DEC":80,"CLU":78,"DUR":76}},{"name":"Ken Stabler","team":"Oakland Raiders","years":"1970–1984","decade":"1970s","r":{"ARM":74,"DAC":82,"SHA":84,"TCH":88,"PKT":80,"REL":74,"MOB":42,"IMP":62,"ANT":84,"DEC":78,"CLU":88,"DUR":62}},{"name":"Billy Kilmer","team":"Washington Redskins","years":"1961–1978","decade":"1970s","r":{"ARM":58,"DAC":54,"SHA":68,"TCH":62,"PKT":70,"REL":60,"MOB":35,"IMP":40,"ANT":70,"DEC":66,"CLU":74,"DUR":64}},{"name":"Craig Morton","team":"Denver Broncos","years":"1965–1982","decade":"1970s","r":{"ARM":76,"DAC":68,"SHA":70,"TCH":64,"PKT":68,"REL":64,"MOB":30,"IMP":38,"ANT":68,"DEC":60,"CLU":62,"DUR":58}},{"name":"Joe Ferguson","team":"Buffalo Bills","years":"1973–1990","decade":"1970s","r":{"ARM":72,"DAC":62,"SHA":68,"TCH":62,"PKT":64,"REL":62,"MOB":45,"IMP":42,"ANT":62,"DEC":58,"CLU":58,"DUR":68}},{"name":"Steve Grogan","team":"New England Patriots","years":"1975–1990","decade":"1970s","r":{"ARM":70,"DAC":58,"SHA":62,"TCH":56,"PKT":62,"REL":58,"MOB":62,"IMP":50,"ANT":58,"DEC":52,"CLU":66,"DUR":60}},{"name":"Jim Hart","team":"St. Louis Cardinals","years":"1966–1984","decade":"1970s","r":{"ARM":74,"DAC":66,"SHA":72,"TCH":66,"PKT":68,"REL":64,"MOB":36,"IMP":40,"ANT":66,"DEC":62,"CLU":60,"DUR":62}},{"name":"Joe Montana","team":"San Francisco 49ers","years":"1979–1994","decade":"1980s","r":{"ARM":74,"DAC":82,"SHA":95,"TCH":94,"PKT":96,"REL":84,"MOB":62,"IMP":70,"ANT":97,"DEC":96,"CLU":97,"DUR":68}},{"name":"Dan Marino","team":"Miami Dolphins","years":"1983–1999","decade":"1980s","r":{"ARM":97,"DAC":92,"SHA":92,"TCH":86,"PKT":88,"REL":96,"MOB":30,"IMP":55,"ANT":88,"DEC":82,"CLU":84,"DUR":82}},{"name":"John Elway","team":"Denver Broncos","years":"1983–1998","decade":"1980s","r":{"ARM":95,"DAC":84,"SHA":80,"TCH":78,"PKT":87,"REL":82,"MOB":76,"IMP":84,"ANT":82,"DEC":76,"CLU":92,"DUR":80}},{"name":"Jim Kelly","team":"Buffalo Bills","years":"1986–1996","decade":"1980s","r":{"ARM":84,"DAC":78,"SHA":82,"TCH":78,"PKT":82,"REL":78,"MOB":40,"IMP":52,"ANT":80,"DEC":76,"CLU":82,"DUR":66}},{"name":"Warren Moon","team":"Houston Oilers","years":"1984–2000","decade":"1980s","r":{"ARM":86,"DAC":80,"SHA":82,"TCH":78,"PKT":80,"REL":78,"MOB":52,"IMP":58,"ANT":82,"DEC":78,"CLU":78,"DUR":84}},{"name":"Boomer Esiason","team":"Cincinnati Bengals","years":"1984–1997","decade":"1980s","r":{"ARM":82,"DAC":74,"SHA":78,"TCH":72,"PKT":76,"REL":74,"MOB":44,"IMP":48,"ANT":76,"DEC":70,"CLU":74,"DUR":74}},{"name":"Phil Simms","team":"New York Giants","years":"1979–1993","decade":"1980s","r":{"ARM":76,"DAC":70,"SHA":80,"TCH":76,"PKT":82,"REL":72,"MOB":38,"IMP":44,"ANT":78,"DEC":76,"CLU":80,"DUR":62}},{"name":"Randall Cunningham","team":"Philadelphia Eagles","years":"1985–2001","decade":"1980s","r":{"ARM":88,"DAC":72,"SHA":70,"TCH":64,"PKT":66,"REL":66,"MOB":92,"IMP":88,"ANT":68,"DEC":60,"CLU":68,"DUR":60}},{"name":"Neil Lomax","team":"St. Louis Cardinals","years":"1981–1988","decade":"1980s","r":{"ARM":76,"DAC":72,"SHA":76,"TCH":70,"PKT":72,"REL":70,"MOB":40,"IMP":44,"ANT":72,"DEC":68,"CLU":64,"DUR":42}},{"name":"Dave Krieg","team":"Seattle Seahawks","years":"1980–1998","decade":"1980s","r":{"ARM":74,"DAC":66,"SHA":72,"TCH":68,"PKT":66,"REL":68,"MOB":46,"IMP":46,"ANT":66,"DEC":58,"CLU":62,"DUR":66}},{"name":"Ken O'Brien","team":"New York Jets","years":"1983–1993","decade":"1980s","r":{"ARM":62,"DAC":64,"SHA":78,"TCH":74,"PKT":70,"REL":64,"MOB":32,"IMP":34,"ANT":70,"DEC":68,"CLU":58,"DUR":58}},{"name":"Steve Young","team":"San Francisco 49ers","years":"1985–1999","decade":"1990s","r":{"ARM":84,"DAC":84,"SHA":90,"TCH":86,"PKT":84,"REL":80,"MOB":84,"IMP":78,"ANT":88,"DEC":84,"CLU":86,"DUR":66}},{"name":"Brett Favre","team":"Green Bay Packers","years":"1991–2010","decade":"1990s","r":{"ARM":92,"DAC":78,"SHA":76,"TCH":70,"PKT":80,"REL":82,"MOB":62,"IMP":74,"ANT":78,"DEC":62,"CLU":88,"DUR":97}},{"name":"Troy Aikman","team":"Dallas Cowboys","years":"1989–2000","decade":"1990s","r":{"ARM":74,"DAC":78,"SHA":88,"TCH":82,"PKT":86,"REL":76,"MOB":34,"IMP":42,"ANT":84,"DEC":82,"CLU":84,"DUR":62}},{"name":"Jim Everett","team":"Los Angeles Rams","years":"1986–1997","decade":"1990s","r":{"ARM":84,"DAC":74,"SHA":68,"TCH":62,"PKT":62,"REL":70,"MOB":30,"IMP":34,"ANT":62,"DEC":54,"CLU":50,"DUR":64}},{"name":"Vinny Testaverde","team":"New York Jets","years":"1987–2007","decade":"1990s","r":{"ARM":84,"DAC":68,"SHA":70,"TCH":64,"PKT":66,"REL":70,"MOB":38,"IMP":42,"ANT":64,"DEC":56,"CLU":60,"DUR":74}},{"name":"Jeff George","team":"Indianapolis Colts","years":"1990–2001","decade":"1990s","r":{"ARM":90,"DAC":70,"SHA":66,"TCH":58,"PKT":58,"REL":74,"MOB":36,"IMP":34,"ANT":56,"DEC":48,"CLU":46,"DUR":62}},{"name":"Drew Bledsoe","team":"New England Patriots","years":"1993–2006","decade":"1990s","r":{"ARM":86,"DAC":76,"SHA":74,"TCH":68,"PKT":72,"REL":76,"MOB":30,"IMP":36,"ANT":70,"DEC":62,"CLU":66,"DUR":74}},{"name":"Mark Brunell","team":"Jacksonville Jaguars","years":"1994–2011","decade":"1990s","r":{"ARM":76,"DAC":76,"SHA":80,"TCH":76,"PKT":72,"REL":72,"MOB":68,"IMP":60,"ANT":74,"DEC":68,"CLU":70,"DUR":60}},{"name":"Chris Chandler","team":"Atlanta Falcons","years":"1988–2004","decade":"1990s","r":{"ARM":78,"DAC":68,"SHA":72,"TCH":66,"PKT":66,"REL":68,"MOB":34,"IMP":36,"ANT":66,"DEC":60,"CLU":62,"DUR":50}},{"name":"Trent Dilfer","team":"Tampa Bay Buccaneers","years":"1994–2007","decade":"1990s","r":{"ARM":74,"DAC":58,"SHA":66,"TCH":58,"PKT":64,"REL":62,"MOB":32,"IMP":32,"ANT":58,"DEC":50,"CLU":56,"DUR":60}},{"name":"Neil O'Donnell","team":"Pittsburgh Steelers","years":"1990–2003","decade":"1990s","r":{"ARM":70,"DAC":62,"SHA":74,"TCH":68,"PKT":70,"REL":66,"MOB":28,"IMP":30,"ANT":68,"DEC":62,"CLU":58,"DUR":62}},{"name":"Tom Brady","team":"New England Patriots","years":"2000–2022","decade":"2000s","r":{"ARM":76,"DAC":88,"SHA":94,"TCH":90,"PKT":92,"REL":82,"MOB":28,"IMP":46,"ANT":96,"DEC":95,"CLU":96,"DUR":84}},{"name":"Peyton Manning","team":"Indianapolis Colts","years":"1998–2015","decade":"2000s","r":{"ARM":82,"DAC":84,"SHA":92,"TCH":86,"PKT":88,"REL":80,"MOB":22,"IMP":40,"ANT":97,"DEC":93,"CLU":88,"DUR":68}},{"name":"Drew Brees","team":"New Orleans Saints","years":"2001–2020","decade":"2000s","r":{"ARM":74,"DAC":86,"SHA":96,"TCH":90,"PKT":84,"REL":78,"MOB":30,"IMP":44,"ANT":92,"DEC":90,"CLU":86,"DUR":80}},{"name":"Ben Roethlisberger","team":"Pittsburgh Steelers","years":"2004–2021","decade":"2000s","r":{"ARM":84,"DAC":76,"SHA":78,"TCH":72,"PKT":92,"REL":68,"MOB":58,"IMP":72,"ANT":78,"DEC":72,"CLU":84,"DUR":66}},{"name":"Philip Rivers","team":"San Diego Chargers","years":"2004–2020","decade":"2000s","r":{"ARM":80,"DAC":82,"SHA":88,"TCH":82,"PKT":78,"REL":76,"MOB":24,"IMP":38,"ANT":88,"DEC":80,"CLU":76,"DUR":82}},{"name":"Eli Manning","team":"New York Giants","years":"2004–2019","decade":"2000s","r":{"ARM":76,"DAC":72,"SHA":74,"TCH":68,"PKT":76,"REL":70,"MOB":26,"IMP":40,"ANT":72,"DEC":62,"CLU":82,"DUR":88}},{"name":"Carson Palmer","team":"Cincinnati Bengals","years":"2003–2017","decade":"2000s","r":{"ARM":86,"DAC":82,"SHA":78,"TCH":74,"PKT":76,"REL":76,"MOB":30,"IMP":34,"ANT":72,"DEC":64,"CLU":62,"DUR":58}},{"name":"Matt Hasselbeck","team":"Seattle Seahawks","years":"1999–2015","decade":"2000s","r":{"ARM":74,"DAC":70,"SHA":78,"TCH":72,"PKT":72,"REL":70,"MOB":34,"IMP":38,"ANT":74,"DEC":68,"CLU":68,"DUR":58}},{"name":"Jake Delhomme","team":"Carolina Panthers","years":"1999–2011","decade":"2000s","r":{"ARM":72,"DAC":62,"SHA":68,"TCH":62,"PKT":62,"REL":62,"MOB":30,"IMP":32,"ANT":60,"DEC":54,"CLU":58,"DUR":56}},{"name":"Kerry Collins","team":"New York Giants","years":"1995–2011","decade":"2000s","r":{"ARM":82,"DAC":66,"SHA":68,"TCH":62,"PKT":68,"REL":68,"MOB":26,"IMP":28,"ANT":64,"DEC":56,"CLU":56,"DUR":66}},{"name":"Jon Kitna","team":"Detroit Lions","years":"1997–2011","decade":"2000s","r":{"ARM":68,"DAC":58,"SHA":68,"TCH":62,"PKT":62,"REL":60,"MOB":30,"IMP":30,"ANT":62,"DEC":56,"CLU":54,"DUR":62}},{"name":"Rich Gannon","team":"Oakland Raiders","years":"1987–2004","decade":"2000s","r":{"ARM":72,"DAC":68,"SHA":78,"TCH":74,"PKT":74,"REL":70,"MOB":62,"IMP":56,"ANT":82,"DEC":78,"CLU":74,"DUR":54}},{"name":"Aaron Rodgers","team":"Green Bay Packers","years":"2005–2024","decade":"2010s","r":{"ARM":90,"DAC":88,"SHA":90,"TCH":86,"PKT":84,"REL":84,"MOB":62,"IMP":82,"ANT":90,"DEC":82,"CLU":84,"DUR":70}},{"name":"Russell Wilson","team":"Seattle Seahawks","years":"2012–present","decade":"2010s","r":{"ARM":84,"DAC":86,"SHA":78,"TCH":76,"PKT":74,"REL":74,"MOB":78,"IMP":80,"ANT":76,"DEC":70,"CLU":78,"DUR":78}},{"name":"Matt Ryan","team":"Atlanta Falcons","years":"2008–2022","decade":"2010s","r":{"ARM":76,"DAC":80,"SHA":84,"TCH":78,"PKT":78,"REL":74,"MOB":24,"IMP":32,"ANT":80,"DEC":74,"CLU":66,"DUR":76}},{"name":"Matthew Stafford","team":"Detroit Lions","years":"2009–present","decade":"2010s","r":{"ARM":88,"DAC":78,"SHA":76,"TCH":70,"PKT":74,"REL":78,"MOB":30,"IMP":44,"ANT":74,"DEC":62,"CLU":72,"DUR":62}},{"name":"Andrew Luck","team":"Indianapolis Colts","years":"2012–2018","decade":"2010s","r":{"ARM":84,"DAC":78,"SHA":80,"TCH":76,"PKT":82,"REL":74,"MOB":48,"IMP":62,"ANT":84,"DEC":76,"CLU":78,"DUR":44}},{"name":"Cam Newton","team":"Carolina Panthers","years":"2011–2021","decade":"2010s","r":{"ARM":88,"DAC":68,"SHA":66,"TCH":60,"PKT":66,"REL":66,"MOB":92,"IMP":76,"ANT":66,"DEC":58,"CLU":66,"DUR":58}},{"name":"Andy Dalton","team":"Cincinnati Bengals","years":"2011–present","decade":"2010s","r":{"ARM":70,"DAC":62,"SHA":74,"TCH":68,"PKT":66,"REL":66,"MOB":28,"IMP":30,"ANT":68,"DEC":62,"CLU":54,"DUR":72}},{"name":"Kirk Cousins","team":"Washington Redskins","years":"2012–present","decade":"2010s","r":{"ARM":74,"DAC":72,"SHA":80,"TCH":74,"PKT":68,"REL":70,"MOB":24,"IMP":28,"ANT":74,"DEC":66,"CLU":52,"DUR":78}},{"name":"Ryan Tannehill","team":"Tennessee Titans","years":"2012–present","decade":"2010s","r":{"ARM":78,"DAC":68,"SHA":76,"TCH":70,"PKT":68,"REL":70,"MOB":46,"IMP":42,"ANT":68,"DEC":62,"CLU":60,"DUR":58}},{"name":"Case Keenum","team":"Minnesota Vikings","years":"2012–present","decade":"2010s","r":{"ARM":66,"DAC":58,"SHA":68,"TCH":62,"PKT":58,"REL":62,"MOB":34,"IMP":34,"ANT":60,"DEC":54,"CLU":48,"DUR":60}},{"name":"Blake Bortles","team":"Jacksonville Jaguars","years":"2014–2019","decade":"2010s","r":{"ARM":82,"DAC":56,"SHA":62,"TCH":54,"PKT":54,"REL":62,"MOB":42,"IMP":40,"ANT":52,"DEC":44,"CLU":44,"DUR":66}},{"name":"Jared Goff","team":"Los Angeles Rams","years":"2016–present","decade":"2010s","r":{"ARM":76,"DAC":74,"SHA":80,"TCH":74,"PKT":66,"REL":72,"MOB":22,"IMP":26,"ANT":70,"DEC":64,"CLU":58,"DUR":76}},{"name":"Patrick Mahomes","team":"Kansas City Chiefs","years":"2017–present","decade":"2020s","r":{"ARM":94,"DAC":88,"SHA":88,"TCH":86,"PKT":86,"REL":84,"MOB":68,"IMP":90,"ANT":88,"DEC":80,"CLU":90,"DUR":78}},{"name":"Josh Allen","team":"Buffalo Bills","years":"2018–present","decade":"2020s","r":{"ARM":96,"DAC":76,"SHA":78,"TCH":72,"PKT":74,"REL":74,"MOB":84,"IMP":78,"ANT":72,"DEC":64,"CLU":78,"DUR":80}},{"name":"Lamar Jackson","team":"Baltimore Ravens","years":"2018–present","decade":"2020s","r":{"ARM":78,"DAC":72,"SHA":74,"TCH":68,"PKT":64,"REL":70,"MOB":98,"IMP":86,"ANT":72,"DEC":66,"CLU":68,"DUR":66}},{"name":"Joe Burrow","team":"Cincinnati Bengals","years":"2020–present","decade":"2020s","r":{"ARM":80,"DAC":84,"SHA":88,"TCH":82,"PKT":80,"REL":76,"MOB":40,"IMP":56,"ANT":82,"DEC":76,"CLU":82,"DUR":56}},{"name":"Justin Herbert","team":"Los Angeles Chargers","years":"2020–present","decade":"2020s","r":{"ARM":92,"DAC":80,"SHA":82,"TCH":76,"PKT":76,"REL":78,"MOB":42,"IMP":42,"ANT":72,"DEC":66,"CLU":62,"DUR":76}},{"name":"Jalen Hurts","team":"Philadelphia Eagles","years":"2020–present","decade":"2020s","r":{"ARM":78,"DAC":70,"SHA":76,"TCH":70,"PKT":72,"REL":66,"MOB":82,"IMP":66,"ANT":74,"DEC":70,"CLU":78,"DUR":68}},{"name":"Dak Prescott","team":"Dallas Cowboys","years":"2016–present","decade":"2020s","r":{"ARM":78,"DAC":74,"SHA":82,"TCH":76,"PKT":74,"REL":74,"MOB":46,"IMP":42,"ANT":76,"DEC":70,"CLU":62,"DUR":60}},{"name":"Jordan Love","team":"Green Bay Packers","years":"2020–present","decade":"2020s","r":{"ARM":84,"DAC":74,"SHA":74,"TCH":68,"PKT":66,"REL":70,"MOB":38,"IMP":44,"ANT":66,"DEC":58,"CLU":60,"DUR":70}},{"name":"Trevor Lawrence","team":"Jacksonville Jaguars","years":"2021–present","decade":"2020s","r":{"ARM":84,"DAC":76,"SHA":76,"TCH":72,"PKT":66,"REL":72,"MOB":38,"IMP":40,"ANT":66,"DEC":58,"CLU":56,"DUR":68}},{"name":"C.J. Stroud","team":"Houston Texans","years":"2023–present","decade":"2020s","r":{"ARM":80,"DAC":82,"SHA":84,"TCH":78,"PKT":72,"REL":74,"MOB":32,"IMP":38,"ANT":76,"DEC":70,"CLU":68,"DUR":72}},{"name":"Baker Mayfield","team":"Tampa Bay Buccaneers","years":"2018–present","decade":"2020s","r":{"ARM":78,"DAC":66,"SHA":74,"TCH":66,"PKT":64,"REL":70,"MOB":36,"IMP":44,"ANT":62,"DEC":54,"CLU":58,"DUR":66}},{"name":"Geno Smith","team":"Seattle Seahawks","years":"2013–present","decade":"2020s","r":{"ARM":76,"DAC":72,"SHA":82,"TCH":76,"PKT":68,"REL":70,"MOB":40,"IMP":40,"ANT":68,"DEC":62,"CLU":58,"DUR":62}},{"name":"Sam Darnold","team":"Minnesota Vikings","years":"2018–present","decade":"2020s","r":{"ARM":80,"DAC":62,"SHA":68,"TCH":60,"PKT":58,"REL":66,"MOB":34,"IMP":36,"ANT":56,"DEC":46,"CLU":50,"DUR":64}},{"name":"Bryce Young","team":"Carolina Panthers","years":"2023–present","decade":"2020s","r":{"ARM":68,"DAC":64,"SHA":74,"TCH":68,"PKT":58,"REL":66,"MOB":40,"IMP":38,"ANT":60,"DEC":52,"CLU":48,"DUR":58}},{"name":"John Brodie","team":"San Francisco 49ers","years":"1968","decade":"1960s","r":{"ARM":71,"DAC":73,"SHA":74,"TCH":76,"PKT":67,"REL":71,"MOB":30,"IMP":49,"ANT":73,"DEC":70,"CLU":56,"DUR":92}},{"name":"Earl Morrall","team":"Baltimore Colts","years":"1968","decade":"1960s","r":{"ARM":90,"DAC":85,"SHA":74,"TCH":85,"PKT":66,"REL":78,"MOB":25,"IMP":54,"ANT":81,"DEC":78,"CLU":65,"DUR":92}},{"name":"Don Meredith","team":"Dallas Cowboys","years":"1968","decade":"1960s","r":{"ARM":78,"DAC":76,"SHA":71,"TCH":79,"PKT":75,"REL":73,"MOB":40,"IMP":58,"ANT":81,"DEC":81,"CLU":59,"DUR":88}},{"name":"Bill Nelsen","team":"Cleveland Browns","years":"1968","decade":"1960s","r":{"ARM":78,"DAC":74,"SHA":66,"TCH":75,"PKT":77,"REL":70,"MOB":20,"IMP":46,"ANT":80,"DEC":83,"CLU":59,"DUR":81}},{"name":"Roman Gabriel","team":"Los Angeles Rams","years":"1968","decade":"1960s","r":{"ARM":60,"DAC":61,"SHA":64,"TCH":69,"PKT":70,"REL":63,"MOB":35,"IMP":49,"ANT":72,"DEC":74,"CLU":57,"DUR":92}},{"name":"Bill Munson","team":"Detroit Lions","years":"1968","decade":"1960s","r":{"ARM":66,"DAC":68,"SHA":70,"TCH":71,"PKT":85,"REL":68,"MOB":25,"IMP":44,"ANT":78,"DEC":82,"CLU":59,"DUR":85}},{"name":"Dick Shiner","team":"Pittsburgh Steelers","years":"1968","decade":"1960s","r":{"ARM":56,"DAC":58,"SHA":62,"TCH":71,"PKT":62,"REL":60,"MOB":35,"IMP":49,"ANT":70,"DEC":69,"CLU":56,"DUR":81}},{"name":"Joe Kapp","team":"Minnesota Vikings","years":"1968","decade":"1960s","r":{"ARM":64,"DAC":65,"SHA":66,"TCH":66,"PKT":56,"REL":65,"MOB":55,"IMP":60,"ANT":62,"DEC":58,"CLU":52,"DUR":92}},{"name":"Bob Berry","team":"Atlanta Falcons","years":"1968","decade":"1960s","r":{"ARM":79,"DAC":74,"SHA":66,"TCH":67,"PKT":54,"REL":71,"MOB":40,"IMP":55,"ANT":61,"DEC":57,"CLU":52,"DUR":66}},{"name":"Randy Johnson","team":"Atlanta Falcons","years":"1968","decade":"1960s","r":{"ARM":58,"DAC":59,"SHA":62,"TCH":59,"PKT":60,"REL":61,"MOB":35,"IMP":45,"ANT":58,"DEC":58,"CLU":52,"DUR":66}},{"name":"Zeke Bratkowski","team":"Green Bay Packers","years":"1968","decade":"1960s","r":{"ARM":64,"DAC":65,"SHA":67,"TCH":64,"PKT":64,"REL":65,"MOB":20,"IMP":39,"ANT":63,"DEC":62,"CLU":53,"DUR":59}},{"name":"Virgil Carter","team":"Chicago Bears","years":"1968","decade":"1960s","r":{"ARM":62,"DAC":62,"SHA":62,"TCH":63,"PKT":67,"REL":63,"MOB":45,"IMP":53,"ANT":65,"DEC":67,"CLU":54,"DUR":59}},{"name":"Jack Concannon","team":"Chicago Bears","years":"1968","decade":"1960s","r":{"ARM":55,"DAC":58,"SHA":64,"TCH":64,"PKT":61,"REL":61,"MOB":50,"IMP":54,"ANT":63,"DEC":62,"CLU":53,"DUR":66}},{"name":"Ken Anderson","team":"Cincinnati Bengals","years":"1975","decade":"1970s","r":{"ARM":85,"DAC":83,"SHA":76,"TCH":78,"PKT":82,"REL":77,"MOB":25,"IMP":50,"ANT":81,"DEC":82,"CLU":70,"DUR":88}},{"name":"Bert Jones","team":"Baltimore Colts","years":"1975","decade":"1970s","r":{"ARM":72,"DAC":74,"SHA":74,"TCH":76,"PKT":86,"REL":71,"MOB":35,"IMP":52,"ANT":81,"DEC":85,"CLU":60,"DUR":92}},{"name":"Joe Namath","team":"New York Jets","years":"1975","decade":"1970s","r":{"ARM":69,"DAC":66,"SHA":60,"TCH":66,"PKT":39,"REL":65,"MOB":15,"IMP":40,"ANT":56,"DEC":49,"CLU":60,"DUR":88}},{"name":"James Harris","team":"Los Angeles Rams","years":"1975","decade":"1970s","r":{"ARM":75,"DAC":73,"SHA":69,"TCH":71,"PKT":64,"REL":70,"MOB":30,"IMP":49,"ANT":69,"DEC":67,"CLU":55,"DUR":88}},{"name":"John Hadl","team":"Green Bay Packers","years":"1975","decade":"1970s","r":{"ARM":58,"DAC":62,"SHA":68,"TCH":60,"PKT":59,"REL":63,"MOB":25,"IMP":39,"ANT":56,"DEC":54,"CLU":51,"DUR":88}},{"name":"Dan Pastorini","team":"Houston Oilers","years":"1975","decade":"1970s","r":{"ARM":58,"DAC":58,"SHA":59,"TCH":64,"PKT":66,"REL":60,"MOB":45,"IMP":53,"ANT":67,"DEC":68,"CLU":55,"DUR":92}},{"name":"Mike Phipps","team":"Cleveland Browns","years":"1975","decade":"1970s","r":{"ARM":54,"DAC":58,"SHA":65,"TCH":57,"PKT":58,"REL":60,"MOB":35,"IMP":43,"ANT":53,"DEC":52,"CLU":50,"DUR":81}},{"name":"Archie Manning","team":"New Orleans Saints","years":"1975","decade":"1970s","r":{"ARM":47,"DAC":51,"SHA":58,"TCH":56,"PKT":57,"REL":55,"MOB":55,"IMP":54,"ANT":55,"DEC":55,"CLU":51,"DUR":88}},{"name":"Steve Bartkowski","team":"Atlanta Falcons","years":"1975","decade":"1970s","r":{"ARM":64,"DAC":61,"SHA":57,"TCH":65,"PKT":58,"REL":62,"MOB":25,"IMP":44,"ANT":65,"DEC":65,"CLU":54,"DUR":81}},{"name":"Steve Ramsey","team":"Denver Broncos","years":"1975","decade":"1970s","r":{"ARM":66,"DAC":67,"SHA":68,"TCH":67,"PKT":60,"REL":67,"MOB":30,"IMP":46,"ANT":64,"DEC":61,"CLU":53,"DUR":66}},{"name":"Dan Fouts","team":"San Diego Chargers","years":"1975","decade":"1970s","r":{"ARM":69,"DAC":68,"SHA":67,"TCH":60,"PKT":65,"REL":67,"MOB":20,"IMP":39,"ANT":59,"DEC":59,"CLU":52,"DUR":73}},{"name":"Mike Livingston","team":"Kansas City Chiefs","years":"1975","decade":"1970s","r":{"ARM":68,"DAC":66,"SHA":63,"TCH":66,"PKT":71,"REL":66,"MOB":20,"IMP":42,"ANT":70,"DEC":72,"CLU":56,"DUR":66}},{"name":"Steve Spurrier","team":"San Francisco 49ers","years":"1975","decade":"1970s","r":{"ARM":57,"DAC":59,"SHA":62,"TCH":61,"PKT":72,"REL":61,"MOB":35,"IMP":46,"ANT":65,"DEC":69,"CLU":55,"DUR":62}},{"name":"Gary Huff","team":"Chicago Bears","years":"1975","decade":"1970s","r":{"ARM":55,"DAC":60,"SHA":68,"TCH":62,"PKT":69,"REL":62,"MOB":25,"IMP":39,"ANT":62,"DEC":63,"CLU":53,"DUR":73}},{"name":"Charley Johnson","team":"Denver Broncos","years":"1975","decade":"1970s","r":{"ARM":68,"DAC":65,"SHA":61,"TCH":63,"PKT":53,"REL":65,"MOB":25,"IMP":44,"ANT":59,"DEC":56,"CLU":52,"DUR":62}},{"name":"Jim Plunkett","team":"New England Patriots","years":"1975","decade":"1970s","r":{"ARM":64,"DAC":62,"SHA":60,"TCH":62,"PKT":58,"REL":62,"MOB":25,"IMP":43,"ANT":61,"DEC":60,"CLU":65,"DUR":59}},{"name":"Tommy Kramer","team":"Minnesota Vikings","years":"1985","decade":"1980s","r":{"ARM":65,"DAC":64,"SHA":63,"TCH":63,"PKT":58,"REL":64,"MOB":20,"IMP":40,"ANT":60,"DEC":59,"CLU":52,"DUR":89}},{"name":"Ron Jaworski","team":"Philadelphia Eagles","years":"1985","decade":"1980s","r":{"ARM":66,"DAC":64,"SHA":61,"TCH":60,"PKT":64,"REL":64,"MOB":30,"IMP":45,"ANT":62,"DEC":63,"CLU":53,"DUR":79}},{"name":"Danny White","team":"Dallas Cowboys","years":"1985","decade":"1980s","r":{"ARM":65,"DAC":67,"SHA":69,"TCH":69,"PKT":69,"REL":67,"MOB":30,"IMP":46,"ANT":69,"DEC":69,"CLU":55,"DUR":86}},{"name":"Eric Hipple","team":"Detroit Lions","years":"1985","decade":"1980s","r":{"ARM":68,"DAC":66,"SHA":64,"TCH":64,"PKT":63,"REL":66,"MOB":30,"IMP":46,"ANT":64,"DEC":64,"CLU":54,"DUR":89}},{"name":"Dieter Brock","team":"Los Angeles Rams","years":"1985","decade":"1980s","r":{"ARM":68,"DAC":69,"SHA":70,"TCH":68,"PKT":71,"REL":68,"MOB":25,"IMP":44,"ANT":69,"DEC":69,"CLU":55,"DUR":89}},{"name":"Marc Wilson","team":"Los Angeles Raiders","years":"1985","decade":"1980s","r":{"ARM":62,"DAC":59,"SHA":57,"TCH":60,"PKT":55,"REL":60,"MOB":25,"IMP":42,"ANT":59,"DEC":58,"CLU":52,"DUR":82}},{"name":"Bill Kenney","team":"Kansas City Chiefs","years":"1985","decade":"1980s","r":{"ARM":70,"DAC":67,"SHA":62,"TCH":66,"PKT":75,"REL":66,"MOB":20,"IMP":42,"ANT":72,"DEC":76,"CLU":57,"DUR":73}},{"name":"Steve DeBerg","team":"Tampa Bay Buccaneers","years":"1985","decade":"1980s","r":{"ARM":62,"DAC":61,"SHA":61,"TCH":66,"PKT":60,"REL":62,"MOB":20,"IMP":41,"ANT":65,"DEC":64,"CLU":54,"DUR":76}},{"name":"Mike Pagel","team":"Indianapolis Colts","years":"1985","decade":"1980s","r":{"ARM":56,"DAC":56,"SHA":58,"TCH":59,"PKT":66,"REL":58,"MOB":35,"IMP":46,"ANT":63,"DEC":65,"CLU":54,"DUR":86}},{"name":"Jim McMahon","team":"Chicago Bears","years":"1985","decade":"1980s","r":{"ARM":72,"DAC":70,"SHA":66,"TCH":68,"PKT":70,"REL":68,"MOB":55,"IMP":62,"ANT":69,"DEC":71,"CLU":65,"DUR":76}},{"name":"Lynn Dickey","team":"Green Bay Packers","years":"1985","decade":"1980s","r":{"ARM":65,"DAC":64,"SHA":63,"TCH":66,"PKT":56,"REL":64,"MOB":15,"IMP":38,"ANT":63,"DEC":60,"CLU":53,"DUR":73}},{"name":"Tony Eason","team":"New England Patriots","years":"1985","decade":"1980s","r":{"ARM":67,"DAC":67,"SHA":65,"TCH":63,"PKT":55,"REL":66,"MOB":25,"IMP":43,"ANT":59,"DEC":55,"CLU":51,"DUR":73}},{"name":"Joe Theismann","team":"Washington Redskins","years":"1985","decade":"1980s","r":{"ARM":53,"DAC":57,"SHA":64,"TCH":59,"PKT":57,"REL":60,"MOB":40,"IMP":47,"ANT":56,"DEC":54,"CLU":60,"DUR":76}},{"name":"Vince Ferragamo","team":"Buffalo Bills","years":"1985","decade":"1980s","r":{"ARM":53,"DAC":55,"SHA":60,"TCH":54,"PKT":52,"REL":58,"MOB":25,"IMP":37,"ANT":51,"DEC":49,"CLU":49,"DUR":69}},{"name":"Bernie Kosar","team":"Cleveland Browns","years":"1985","decade":"1980s","r":{"ARM":59,"DAC":58,"SHA":58,"TCH":59,"PKT":71,"REL":60,"MOB":20,"IMP":38,"ANT":65,"DEC":69,"CLU":55,"DUR":73}},{"name":"Jay Schroeder","team":"Washington Redskins","years":"1985","decade":"1980s","r":{"ARM":65,"DAC":64,"SHA":63,"TCH":59,"PKT":73,"REL":64,"MOB":25,"IMP":42,"ANT":64,"DEC":68,"CLU":54,"DUR":56}},{"name":"Mark Malone","team":"Pittsburgh Steelers","years":"1985","decade":"1980s","r":{"ARM":58,"DAC":58,"SHA":59,"TCH":65,"PKT":70,"REL":60,"MOB":40,"IMP":51,"ANT":70,"DEC":73,"CLU":57,"DUR":66}},{"name":"David Woodley","team":"Pittsburgh Steelers","years":"1985","decade":"1980s","r":{"ARM":68,"DAC":65,"SHA":61,"TCH":61,"PKT":50,"REL":65,"MOB":30,"IMP":46,"ANT":56,"DEC":52,"CLU":50,"DUR":60}},{"name":"Gary Danielson","team":"Cleveland Browns","years":"1985","decade":"1980s","r":{"ARM":70,"DAC":69,"SHA":68,"TCH":68,"PKT":68,"REL":68,"MOB":20,"IMP":42,"ANT":68,"DEC":68,"CLU":55,"DUR":60}},{"name":"Bobby Hebert","team":"New Orleans Saints","years":"1985","decade":"1980s","r":{"ARM":63,"DAC":63,"SHA":63,"TCH":61,"PKT":73,"REL":63,"MOB":25,"IMP":41,"ANT":65,"DEC":69,"CLU":55,"DUR":60}},{"name":"Todd Blackledge","team":"Kansas City Chiefs","years":"1985","decade":"1980s","r":{"ARM":64,"DAC":63,"SHA":60,"TCH":61,"PKT":48,"REL":63,"MOB":25,"IMP":42,"ANT":55,"DEC":51,"CLU":50,"DUR":60}},{"name":"Jeff Hostetler","team":"Los Angeles Raiders","years":"1994","decade":"1990s","r":{"ARM":70,"DAC":68,"SHA":65,"TCH":66,"PKT":66,"REL":67,"MOB":40,"IMP":53,"ANT":66,"DEC":66,"CLU":54,"DUR":92}},{"name":"Stan Humphries","team":"San Diego Chargers","years":"1994","decade":"1990s","r":{"ARM":67,"DAC":66,"SHA":65,"TCH":64,"PKT":72,"REL":66,"MOB":20,"IMP":40,"ANT":67,"DEC":69,"CLU":55,"DUR":89}},{"name":"Craig Erickson","team":"Tampa Bay Buccaneers","years":"1994","decade":"1990s","r":{"ARM":70,"DAC":67,"SHA":63,"TCH":64,"PKT":72,"REL":66,"MOB":20,"IMP":41,"ANT":68,"DEC":71,"CLU":55,"DUR":89}},{"name":"Dave Brown","team":"New York Giants","years":"1994","decade":"1990s","r":{"ARM":69,"DAC":67,"SHA":64,"TCH":62,"PKT":58,"REL":66,"MOB":30,"IMP":46,"ANT":59,"DEC":58,"CLU":52,"DUR":89}},{"name":"Jeff Blake","team":"Cincinnati Bengals","years":"1994","decade":"1990s","r":{"ARM":67,"DAC":62,"SHA":56,"TCH":61,"PKT":67,"REL":62,"MOB":45,"IMP":55,"ANT":67,"DEC":70,"CLU":55,"DUR":69}},{"name":"Rick Mirer","team":"Seattle Seahawks","years":"1994","decade":"1990s","r":{"ARM":51,"DAC":52,"SHA":56,"TCH":56,"PKT":75,"REL":56,"MOB":35,"IMP":44,"ANT":65,"DEC":71,"CLU":55,"DUR":82}},{"name":"Chris Miller","team":"Los Angeles Rams","years":"1994","decade":"1990s","r":{"ARM":62,"DAC":61,"SHA":60,"TCH":66,"PKT":58,"REL":62,"MOB":30,"IMP":46,"ANT":65,"DEC":63,"CLU":54,"DUR":73}},{"name":"Steve Walsh","team":"Chicago Bears","years":"1994","decade":"1990s","r":{"ARM":56,"DAC":61,"SHA":69,"TCH":63,"PKT":75,"REL":63,"MOB":15,"IMP":34,"ANT":66,"DEC":68,"CLU":54,"DUR":76}},{"name":"Heath Shuler","team":"Washington Redskins","years":"1994","decade":"1990s","r":{"ARM":59,"DAC":54,"SHA":50,"TCH":56,"PKT":56,"REL":57,"MOB":40,"IMP":49,"ANT":58,"DEC":60,"CLU":53,"DUR":66}},{"name":"Steve Beuerlein","team":"Arizona Cardinals","years":"1994","decade":"1990s","r":{"ARM":57,"DAC":56,"SHA":57,"TCH":54,"PKT":63,"REL":59,"MOB":20,"IMP":36,"ANT":57,"DEC":60,"CLU":52,"DUR":63}},{"name":"Scott Mitchell","team":"Detroit Lions","years":"1994","decade":"1990s","r":{"ARM":56,"DAC":55,"SHA":54,"TCH":59,"PKT":57,"REL":57,"MOB":20,"IMP":38,"ANT":61,"DEC":61,"CLU":53,"DUR":69}},{"name":"Jim Harbaugh","team":"Indianapolis Colts","years":"1994","decade":"1990s","r":{"ARM":67,"DAC":68,"SHA":68,"TCH":68,"PKT":69,"REL":67,"MOB":35,"IMP":49,"ANT":68,"DEC":68,"CLU":55,"DUR":69}},{"name":"David Klingler","team":"Cincinnati Bengals","years":"1994","decade":"1990s","r":{"ARM":55,"DAC":58,"SHA":64,"TCH":60,"PKT":63,"REL":61,"MOB":25,"IMP":39,"ANT":60,"DEC":60,"CLU":52,"DUR":63}},{"name":"John Friesz","team":"Washington Redskins","years":"1994","decade":"1990s","r":{"ARM":66,"DAC":66,"SHA":65,"TCH":68,"PKT":59,"REL":65,"MOB":20,"IMP":41,"ANT":65,"DEC":63,"CLU":54,"DUR":53}},{"name":"Erik Kramer","team":"Chicago Bears","years":"1994","decade":"1990s","r":{"ARM":66,"DAC":67,"SHA":68,"TCH":69,"PKT":61,"REL":67,"MOB":15,"IMP":38,"ANT":65,"DEC":62,"CLU":54,"DUR":56}},{"name":"Don Majkowski","team":"Indianapolis Colts","years":"1994","decade":"1990s","r":{"ARM":64,"DAC":63,"SHA":63,"TCH":64,"PKT":61,"REL":64,"MOB":35,"IMP":48,"ANT":63,"DEC":62,"CLU":53,"DUR":60}},{"name":"Daunte Culpepper","team":"Minnesota Vikings","years":"2004","decade":"2000s","r":{"ARM":83,"DAC":82,"SHA":77,"TCH":83,"PKT":75,"REL":77,"MOB":60,"IMP":70,"ANT":81,"DEC":80,"CLU":59,"DUR":92}},{"name":"Trent Green","team":"Kansas City Chiefs","years":"2004","decade":"2000s","r":{"ARM":79,"DAC":78,"SHA":73,"TCH":73,"PKT":67,"REL":74,"MOB":20,"IMP":44,"ANT":69,"DEC":67,"CLU":55,"DUR":92}},{"name":"Jake Plummer","team":"Denver Broncos","years":"2004","decade":"2000s","r":{"ARM":74,"DAC":70,"SHA":63,"TCH":68,"PKT":59,"REL":68,"MOB":40,"IMP":55,"ANT":66,"DEC":64,"CLU":54,"DUR":92}},{"name":"Marc Bulger","team":"St. Louis Rams","years":"2004","decade":"2000s","r":{"ARM":78,"DAC":77,"SHA":73,"TCH":71,"PKT":68,"REL":73,"MOB":15,"IMP":41,"ANT":68,"DEC":67,"CLU":55,"DUR":86}},{"name":"Donovan McNabb","team":"Philadelphia Eagles","years":"2004","decade":"2000s","r":{"ARM":79,"DAC":76,"SHA":70,"TCH":77,"PKT":75,"REL":73,"MOB":65,"IMP":71,"ANT":79,"DEC":80,"CLU":60,"DUR":89}},{"name":"Aaron Brooks","team":"New Orleans Saints","years":"2004","decade":"2000s","r":{"ARM":65,"DAC":63,"SHA":61,"TCH":62,"PKT":64,"REL":64,"MOB":45,"IMP":54,"ANT":64,"DEC":65,"CLU":54,"DUR":92}},{"name":"David Carr","team":"Houston Texans","years":"2004","decade":"2000s","r":{"ARM":71,"DAC":70,"SHA":67,"TCH":64,"PKT":65,"REL":68,"MOB":25,"IMP":44,"ANT":63,"DEC":63,"CLU":53,"DUR":92}},{"name":"Joey Harrington","team":"Detroit Lions","years":"2004","decade":"2000s","r":{"ARM":57,"DAC":57,"SHA":60,"TCH":62,"PKT":67,"REL":60,"MOB":15,"IMP":35,"ANT":65,"DEC":68,"CLU":55,"DUR":92}},{"name":"Byron Leftwich","team":"Jacksonville Jaguars","years":"2004","decade":"2000s","r":{"ARM":61,"DAC":63,"SHA":66,"TCH":63,"PKT":70,"REL":64,"MOB":20,"IMP":39,"ANT":65,"DEC":67,"CLU":54,"DUR":86}},{"name":"Chad Pennington","team":"New York Jets","years":"2004","decade":"2000s","r":{"ARM":67,"DAC":70,"SHA":72,"TCH":70,"PKT":71,"REL":69,"MOB":15,"IMP":38,"ANT":69,"DEC":69,"CLU":55,"DUR":82}},{"name":"Brian Griese","team":"Tampa Bay Buccaneers","years":"2004","decade":"2000s","r":{"ARM":74,"DAC":76,"SHA":77,"TCH":79,"PKT":64,"REL":74,"MOB":15,"IMP":42,"ANT":72,"DEC":68,"CLU":55,"DUR":73}},{"name":"Kyle Boller","team":"Baltimore Ravens","years":"2004","decade":"2000s","r":{"ARM":49,"DAC":52,"SHA":59,"TCH":58,"PKT":68,"REL":56,"MOB":25,"IMP":38,"ANT":62,"DEC":65,"CLU":53,"DUR":92}},{"name":"Josh McCown","team":"Arizona Cardinals","years":"2004","decade":"2000s","r":{"ARM":56,"DAC":57,"SHA":61,"TCH":58,"PKT":68,"REL":60,"MOB":30,"IMP":42,"ANT":61,"DEC":64,"CLU":53,"DUR":82}},{"name":"Michael Vick","team":"Atlanta Falcons","years":"2004","decade":"2000s","r":{"ARM":67,"DAC":64,"SHA":60,"TCH":64,"PKT":59,"REL":64,"MOB":97,"IMP":84,"ANT":63,"DEC":62,"CLU":55,"DUR":89}},{"name":"Kurt Warner","team":"New York Giants","years":"2004","decade":"2000s","r":{"ARM":69,"DAC":69,"SHA":68,"TCH":61,"PKT":76,"REL":68,"MOB":15,"IMP":37,"ANT":64,"DEC":68,"CLU":65,"DUR":69}},{"name":"Jeff Garcia","team":"Cleveland Browns","years":"2004","decade":"2000s","r":{"ARM":64,"DAC":63,"SHA":62,"TCH":63,"PKT":61,"REL":63,"MOB":35,"IMP":48,"ANT":63,"DEC":62,"CLU":53,"DUR":73}},{"name":"Steve McNair","team":"Tennessee Titans","years":"2004","decade":"2000s","r":{"ARM":59,"DAC":61,"SHA":65,"TCH":64,"PKT":59,"REL":63,"MOB":55,"IMP":58,"ANT":62,"DEC":60,"CLU":70,"DUR":66}},{"name":"Joe Flacco","team":"Baltimore Ravens","years":"2014","decade":"2010s","r":{"ARM":65,"DAC":64,"SHA":64,"TCH":67,"PKT":66,"REL":64,"MOB":15,"IMP":38,"ANT":68,"DEC":69,"CLU":55,"DUR":92}},{"name":"Jay Cutler","team":"Chicago Bears","years":"2014","decade":"2010s","r":{"ARM":61,"DAC":64,"SHA":69,"TCH":70,"PKT":60,"REL":65,"MOB":20,"IMP":40,"ANT":66,"DEC":63,"CLU":54,"DUR":89}},{"name":"Tony Romo","team":"Dallas Cowboys","years":"2014","decade":"2010s","r":{"ARM":79,"DAC":78,"SHA":74,"TCH":83,"PKT":70,"REL":74,"MOB":25,"IMP":51,"ANT":81,"DEC":78,"CLU":59,"DUR":89}},{"name":"Colin Kaepernick","team":"San Francisco 49ers","years":"2014","decade":"2010s","r":{"ARM":63,"DAC":62,"SHA":62,"TCH":63,"PKT":66,"REL":63,"MOB":88,"IMP":77,"ANT":65,"DEC":66,"CLU":54,"DUR":92}},{"name":"Derek Carr","team":"Oakland Raiders","years":"2014","decade":"2010s","r":{"ARM":46,"DAC":50,"SHA":58,"TCH":59,"PKT":66,"REL":55,"MOB":25,"IMP":38,"ANT":63,"DEC":65,"CLU":54,"DUR":92}},{"name":"Alex Smith","team":"Kansas City Chiefs","years":"2014","decade":"2010s","r":{"ARM":63,"DAC":65,"SHA":68,"TCH":66,"PKT":73,"REL":66,"MOB":35,"IMP":48,"ANT":68,"DEC":70,"CLU":55,"DUR":89}},{"name":"Teddy Bridgewater","team":"Minnesota Vikings","years":"2014","decade":"2010s","r":{"ARM":66,"DAC":66,"SHA":67,"TCH":64,"PKT":61,"REL":66,"MOB":30,"IMP":45,"ANT":61,"DEC":60,"CLU":52,"DUR":79}},{"name":"Ryan Fitzpatrick","team":"Houston Texans","years":"2014","decade":"2010s","r":{"ARM":73,"DAC":70,"SHA":65,"TCH":70,"PKT":64,"REL":68,"MOB":25,"IMP":47,"ANT":69,"DEC":68,"CLU":55,"DUR":79}},{"name":"Mark Sanchez","team":"Philadelphia Eagles","years":"2014","decade":"2010s","r":{"ARM":72,"DAC":70,"SHA":66,"TCH":67,"PKT":57,"REL":68,"MOB":25,"IMP":45,"ANT":63,"DEC":60,"CLU":53,"DUR":66}},{"name":"Nick Foles","team":"Philadelphia Eagles","years":"2014","decade":"2010s","r":{"ARM":62,"DAC":61,"SHA":61,"TCH":63,"PKT":58,"REL":62,"MOB":20,"IMP":40,"ANT":62,"DEC":61,"CLU":60,"DUR":66}},{"name":"Robert Griffin III","team":"Washington Redskins","years":"2014","decade":"2010s","r":{"ARM":71,"DAC":71,"SHA":70,"TCH":62,"PKT":64,"REL":69,"MOB":80,"IMP":73,"ANT":60,"DEC":59,"CLU":52,"DUR":63}},{"name":"Colt McCoy","team":"Washington Redskins","years":"2014","decade":"2010s","r":{"ARM":70,"DAC":70,"SHA":70,"TCH":66,"PKT":66,"REL":69,"MOB":35,"IMP":49,"ANT":65,"DEC":64,"CLU":54,"DUR":53}},{"name":"Tua Tagovailoa","team":"Miami Dolphins","years":"2023","decade":"2020s","r":{"ARM":75,"DAC":74,"SHA":70,"TCH":71,"PKT":64,"REL":71,"MOB":25,"IMP":47,"ANT":68,"DEC":66,"CLU":55,"DUR":92}},{"name":"Brock Purdy","team":"San Francisco 49ers","years":"2023","decade":"2020s","r":{"ARM":90,"DAC":84,"SHA":70,"TCH":77,"PKT":64,"REL":77,"MOB":25,"IMP":52,"ANT":74,"DEC":72,"CLU":57,"DUR":89}},{"name":"Justin Fields","team":"Chicago Bears","years":"2023","decade":"2020s","r":{"ARM":61,"DAC":60,"SHA":59,"TCH":62,"PKT":61,"REL":61,"MOB":85,"IMP":75,"ANT":63,"DEC":64,"CLU":54,"DUR":80}},{"name":"Kyler Murray","team":"Arizona Cardinals","years":"2023","decade":"2020s","r":{"ARM":59,"DAC":61,"SHA":65,"TCH":64,"PKT":66,"REL":63,"MOB":80,"IMP":71,"ANT":64,"DEC":65,"CLU":54,"DUR":64}},{"name":"Mac Jones","team":"New England Patriots","years":"2023","decade":"2020s","r":{"ARM":52,"DAC":57,"SHA":64,"TCH":60,"PKT":55,"REL":60,"MOB":15,"IMP":33,"ANT":56,"DEC":53,"CLU":51,"DUR":74}},{"name":"Jameis Winston","team":"New Orleans Saints","years":"2023","decade":"2020s","r":{"ARM":62,"DAC":62,"SHA":62,"TCH":64,"PKT":60,"REL":63,"MOB":25,"IMP":42,"ANT":62,"DEC":61,"CLU":53,"DUR":40}},{"name":"Jimmy Garoppolo","team":"Las Vegas Raiders","years":"2023","decade":"2020s","r":{"ARM":64,"DAC":64,"SHA":65,"TCH":65,"PKT":53,"REL":64,"MOB":15,"IMP":37,"ANT":59,"DEC":55,"CLU":51,"DUR":58}},{"name":"Deshaun Watson","team":"Cleveland Browns","years":"2023","decade":"2020s","r":{"ARM":60,"DAC":60,"SHA":62,"TCH":63,"PKT":63,"REL":62,"MOB":65,"IMP":64,"ANT":64,"DEC":64,"CLU":54,"DUR":58}},{"name":"Daniel Jones","team":"New York Giants","years":"2023","decade":"2020s","r":{"ARM":56,"DAC":60,"SHA":66,"TCH":60,"PKT":59,"REL":62,"MOB":45,"IMP":50,"ANT":57,"DEC":55,"CLU":51,"DUR":58}},{"name":"Mitchell Trubisky","team":"Pittsburgh Steelers","years":"2023","decade":"2020s","r":{"ARM":60,"DAC":61,"SHA":64,"TCH":64,"PKT":58,"REL":62,"MOB":35,"IMP":47,"ANT":61,"DEC":59,"CLU":53,"DUR":46}},{"name":"Gardner Minshew","team":"Indianapolis Colts","years":"2023","decade":"2020s","r":{"ARM":59,"DAC":59,"SHA":61,"TCH":59,"PKT":66,"REL":61,"MOB":25,"IMP":40,"ANT":61,"DEC":63,"CLU":53,"DUR":80}},{"name":"Desmond Ridder","team":"Atlanta Falcons","years":"2023","decade":"2020s","r":{"ARM":65,"DAC":64,"SHA":63,"TCH":60,"PKT":58,"REL":64,"MOB":25,"IMP":42,"ANT":58,"DEC":56,"CLU":51,"DUR":80}},{"name":"Zach Wilson","team":"New York Jets","years":"2023","decade":"2020s","r":{"ARM":53,"DAC":54,"SHA":58,"TCH":54,"PKT":65,"REL":57,"MOB":25,"IMP":38,"ANT":57,"DEC":60,"CLU":52,"DUR":74}},{"name":"Kenny Pickett","team":"Pittsburgh Steelers","years":"2023","decade":"2020s","r":{"ARM":55,"DAC":56,"SHA":60,"TCH":54,"PKT":70,"REL":59,"MOB":25,"IMP":38,"ANT":59,"DEC":62,"CLU":52,"DUR":77}},{"name":"Sam Howell","team":"Washington Commanders","years":"2023","decade":"2020s","r":{"ARM":56,"DAC":58,"SHA":62,"TCH":61,"PKT":55,"REL":60,"MOB":25,"IMP":40,"ANT":58,"DEC":55,"CLU":51,"DUR":92}},{"name":"Anthony Richardson","team":"Indianapolis Colts","years":"2023","decade":"2020s","r":{"ARM":64,"DAC":63,"SHA":63,"TCH":63,"PKT":66,"REL":64,"MOB":88,"IMP":77,"ANT":65,"DEC":66,"CLU":54,"DUR":52}}];

  const ATTR_KEYS = ATTRIBUTES.map(a=>a.key);
  const ATTR_BY_KEY = Object.fromEntries(ATTRIBUTES.map(a=>[a.key,a]));

  /* ----- Era-adjusted combine ratings -----
     The raw QBS ratings sit on one flat 0-99 scale, so an attribute a given era simply valued
     less (touch/anticipation passing in the 1960s, etc.) reads as uniformly bad next to a modern
     player's card, even for someone who was the best of his own generation at it. Combine cards
     display a value NORMALIZED against that attribute's own decade average instead of the raw
     number, so "elite for his era" always reads as elite no matter which era a round happens to
     roll. Relative ranking within a round is unaffected -- every round's 4 candidates are always
     from the same decade (see rollCandidates), so this is a decade-wide shift, not a reordering.
     The normalized value is also what gets stored into the build when picked, so an "authentic
     old-era" build doesn't get double-penalized later by ERA_ATTR_MULT during career sim on top
     of an already-deflated raw pick. */
  const ERA_ATTR_AVG = {};
  DECADES.forEach(d=>{
    const pool = QBS.filter(p=>p.decade===d);
    const avg = {};
    ATTR_KEYS.forEach(k=>{ avg[k] = pool.length ? pool.reduce((s,p)=>s+p.r[k],0)/pool.length : 65; });
    ERA_ATTR_AVG[d] = avg;
  });
  function eraNormalizedValue(player, key){
    const avg = (ERA_ATTR_AVG[player.decade]||{})[key];
    if(avg==null) return player.r[key];
    return clamp(Math.round(65 + (player.r[key]-avg)), 15, 99);
  }

  /* ================= Utilities ================= */
  function shuffle(arr){ const a=arr.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
  function clamp(n,lo,hi){ return Math.max(lo, Math.min(hi, n)); }
  function randInt(lo,hi){ return Math.floor(lo + Math.random()*(hi-lo+1)); }
  function lerp(a,b,t){ return a+(b-a)*t; }

  /* ----- reusable inline-SVG charts: no chart library, just plain SVG strings, so every
     visual works inside a single self-contained HTML file. ----- */
  function svgEscape(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  function renderRadarChartSVG(attrs, opts={}){
    const size = opts.size || 340;
    const cx = size/2, cy = size/2;
    const radius = size*0.34;
    const labelR = radius + 22;
    const n = attrs.length;
    const angleFor = i => (-90 + (360/n)*i) * Math.PI/180;
    const rings = [0.25, 0.5, 0.75, 1];
    const ringPolys = rings.map(f=>{
      const pts = attrs.map((a,i)=>{
        const ang = angleFor(i);
        return `${cx + Math.cos(ang)*radius*f},${cy + Math.sin(ang)*radius*f}`;
      }).join(" ");
      return `<polygon points="${pts}" fill="none" stroke="var(--line-strong)" stroke-width="1"/>`;
    }).join("");
    const axisLines = attrs.map((a,i)=>{
      const ang = angleFor(i);
      const x = cx + Math.cos(ang)*radius, y = cy + Math.sin(ang)*radius;
      return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--line-strong)" stroke-width="1"/>`;
    }).join("");
    const dataPts = attrs.map((a,i)=>{
      const ang = angleFor(i);
      const f = clamp(a.value,0,100)/100;
      return `${cx + Math.cos(ang)*radius*f},${cy + Math.sin(ang)*radius*f}`;
    }).join(" ");
    const dataDots = attrs.map((a,i)=>{
      const ang = angleFor(i);
      const f = clamp(a.value,0,100)/100;
      const x = cx + Math.cos(ang)*radius*f, y = cy + Math.sin(ang)*radius*f;
      return `<circle cx="${x}" cy="${y}" r="3" fill="var(--field)"/>`;
    }).join("");
    const labels = attrs.map((a,i)=>{
      const ang = angleFor(i);
      const x = cx + Math.cos(ang)*labelR, y = cy + Math.sin(ang)*labelR;
      const anchor = Math.cos(ang)>0.25 ? "start" : Math.cos(ang)<-0.25 ? "end" : "middle";
      return `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle" class="radar-axis-label">${svgEscape(a.key)}</text>
        <text x="${x}" y="${y+11}" text-anchor="${anchor}" dominant-baseline="middle" class="radar-axis-value">${Math.round(a.value)}</text>`;
    }).join("");
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Attribute radar chart">
      ${ringPolys}${axisLines}
      <polygon points="${dataPts}" fill="var(--field)" fill-opacity="0.22" stroke="var(--field)" stroke-width="2"/>
      ${dataDots}
      ${labels}
    </svg>`;
  }

  function renderSparklineSVG(values, opts={}){
    const w = opts.width || 560, h = opts.height || 90, pad = 8;
    if(!values.length) return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"></svg>`;
    const lo = Math.min(...values), hi = Math.max(...values);
    const range = (hi-lo) || 1;
    const stepX = values.length>1 ? (w-pad*2)/(values.length-1) : 0;
    const pts = values.map((v,i)=>{
      const x = pad + i*stepX;
      const y = h - pad - ((v-lo)/range)*(h-pad*2);
      return [x,y];
    });
    const line = pts.map(p=>p.join(",")).join(" ");
    const areaPath = `M${pts[0][0]},${h-pad} L` + pts.map(p=>p.join(",")).join(" L") + ` L${pts[pts.length-1][0]},${h-pad} Z`;
    const dots = pts.map((p,i)=>{
      const isLast = i===pts.length-1;
      return `<circle cx="${p[0]}" cy="${p[1]}" r="${isLast?3.5:2}" fill="${isLast?"var(--field)":"var(--good)"}"/>`;
    }).join("");
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="none" role="img" aria-label="Trend over time">
      <path d="${areaPath}" fill="var(--good)" fill-opacity="0.12" stroke="none"/>
      <polyline points="${line}" fill="none" stroke="var(--good)" stroke-width="2"/>
      ${dots}
    </svg>`;
  }

  /* ----- playoff bracket: the game only tracks the games the player's own team actually
     played (not every parallel matchup across the bracket), so this renders that path — Wild
     Card through Super Bowl — as a connected chain of round boxes rather than a fabricated
     full bracket. The user's team is always the gold-highlighted side. ----- */
  // One playoff round's box markup -- extracted so it can be appended into the DOM progressively,
  // one round at a time, exactly when the player reaches it (see animatePlayoffQuarters), instead
  // of every round the player eventually took part in being rendered up front. That distinction
  // matters: even with every SCORE hidden behind placeholders, a "Conference Championship" box
  // simply existing on the page before the Wild Card game has been simmed still tells the player
  // they won both earlier rounds -- so the DOM itself must not contain a round's box until the
  // round before it has actually been finished as a win.
  function playoffRoundBoxHtml(r, i, year){
    const isSB = r.round==="Super Bowl";
    if(isSB){
      return `
        <div class="superbowl-box" data-round-idx="${i}" data-round-state="pending">
          <div class="sb-title" id="sbTitle-${i}">${svgEscape(roundDisplayLabel(r.round, year)).toUpperCase()}</div>
          <div class="sb-final" id="sbFinal-${i}">vs. the ${svgEscape(r.opponent)}</div>
          ${r._defOverall!=null ? `<div class="sb-oppgrade">Their team overall: <b>${Math.round(r._defOverall)}</b> &nbsp;·&nbsp; Your team overall: <b>${Math.round(career.teamStrength)}</b></div>` : ""}
          ${r._oppQbName ? `<div class="sb-oppgrade">Their QB: <button type="button" class="rival-link" data-rival-id="${r._oppQbId}">${svgEscape(r._oppQbName)}</button> (${r._oppQbOverall} overall)</div>` : ""}
          ${r.oppTendency ? `<div class="pr-tendency" style="color:var(--header-muted);text-align:center;">Scouting report: <b style="color:var(--header-accent);">${svgEscape(r.oppTendency.label)}</b> — ${svgEscape(r.oppTendency.blurb)}</div>` : ""}
          <div class="sb-quarters" id="pqQuarters-${i}"></div>
          <div class="pr-controls" id="pqControls-${i}"></div>
          <div class="sb-box" id="sbBox-${i}" style="display:none;">
            <div><div class="sbx-label">Comp/Att</div><div class="sbx-value tabular">${r.box.comp}/${r.box.att}</div></div>
            <div><div class="sbx-label">Yards</div><div class="sbx-value tabular">${r.box.yards}</div></div>
            <div><div class="sbx-label">TD</div><div class="sbx-value tabular">${r.box.td}</div></div>
            <div><div class="sbx-label">INT</div><div class="sbx-value tabular">${r.box.int}</div></div>
            ${r.box.rushAtt>0?`<div><div class="sbx-label">Rush</div><div class="sbx-value tabular">${r.box.rushAtt}-${r.box.rushYards}${r.box.rushTd?" · "+r.box.rushTd+" TD":""}</div></div>`:""}
          </div>
        </div>`;
    }
    const tendencyHtml = r.oppTendency ? `<div class="pr-tendency">Scouting report: <b>${svgEscape(r.oppTendency.label)}</b> — ${svgEscape(r.oppTendency.blurb)}</div>` : "";
    return `
      <div class="playoff-round-box" data-round-idx="${i}" data-round-state="pending">
        <div class="pr-box-title" id="prTitle-${i}">${svgEscape(roundDisplayLabel(r.round, year)).toUpperCase()}</div>
        <div class="pr-box-final" id="prFinal-${i}">vs. the ${svgEscape(r.opponent)}</div>
        ${r._defOverall!=null ? `<div class="pr-oppgrade">Their team overall: <b>${Math.round(r._defOverall)}</b> &nbsp;·&nbsp; Your team overall: <b>${Math.round(career.teamStrength)}</b></div>` : ""}
        ${r._oppQbName ? `<div class="pr-oppgrade">Their QB: <button type="button" class="rival-link" data-rival-id="${r._oppQbId}">${svgEscape(r._oppQbName)}</button> (${r._oppQbOverall} overall)</div>` : ""}
        ${tendencyHtml}
        <div class="pr-quarters" id="pqQuarters-${i}"></div>
        <div class="pr-controls" id="pqControls-${i}"></div>
      </div>`;
  }
  function renderPlayoffBracketSVG(rounds, myTeamName, year){
    const boxW = 168, boxH = 60, colGap = 56, colW = boxW + colGap;
    const topPad = 26, leftPad = 10;
    const w = leftPad*2 + rounds.length*boxW + (rounds.length-1)*colGap;
    const h = topPad + boxH + 16;
    const cy = topPad + boxH/2;
    const boxes = rounds.map((r,i)=>{
      const x = leftPad + i*colW;
      const myRowY = 20, oppRowY = 40;
      const outcomeColor = r.won ? "var(--good)" : "var(--danger)";
      return `
        <g>
          <text x="${x+boxW/2}" y="${topPad-10}" text-anchor="middle" class="bracket-round-label">${svgEscape(roundDisplayLabel(r.round, year))}</text>
          <rect x="${x}" y="${topPad}" width="${boxW}" height="${boxH}" rx="5" fill="var(--surface)" stroke="${r.won?"var(--field)":"var(--line-strong)"}" stroke-width="${r.won?2:1}"/>
          <text x="${x+10}" y="${topPad+myRowY}" class="bracket-team-name me">${svgEscape(myTeamName)}</text>
          <text x="${x+boxW-10}" y="${topPad+myRowY}" text-anchor="end" class="bracket-score">${r.myScore}</text>
          <text x="${x+10}" y="${topPad+oppRowY}" class="bracket-team-name">${svgEscape(r.opponent)}</text>
          <text x="${x+boxW-10}" y="${topPad+oppRowY}" text-anchor="end" class="bracket-score">${r.oppScore}</text>
          <line x1="${x+8}" y1="${topPad+30}" x2="${x+boxW-8}" y2="${topPad+30}" stroke="var(--line)" stroke-width="1"/>
          <circle cx="${x+boxW-4}" cy="${topPad+boxH/2}" r="3" fill="${outcomeColor}"/>
        </g>`;
    }).join("");
    const connectors = rounds.slice(0,-1).map((r,i)=>{
      const x1 = leftPad + i*colW + boxW;
      const x2 = leftPad + (i+1)*colW;
      return `<line x1="${x1}" y1="${cy}" x2="${x2}" y2="${cy}" stroke="var(--line-strong)" stroke-width="2" stroke-dasharray="${rounds[i].won?"0":"3,3"}"/>`;
    }).join("");
    return `<div class="bracket-wrap"><svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Playoff path">
      ${connectors}${boxes}
    </svg></div>`;
  }
  function fmtPct(x){ return (x*100).toFixed(1)+"%"; }

  function curveVal(points, age){
    if(age<=points[0][0]) return points[0][1];
    for(let i=0;i<points.length-1;i++){
      const [a0,v0]=points[i], [a1,v1]=points[i+1];
      if(age>=a0 && age<=a1){ const t=(age-a0)/(a1-a0); return lerp(v0,v1,t); }
    }
    return points[points.length-1][1];
  }
  const CURVES = {
    physical: [[22,0.90],[24,0.95],[27,1.00],[29,1.00],[31,0.97],[33,0.90],[35,0.80],[37,0.68],[39,0.55],[41,0.45],[43,0.35]],
    accuracy: [[22,0.78],[24,0.86],[27,0.95],[29,1.00],[32,1.00],[34,0.97],[36,0.92],[38,0.85],[40,0.76],[42,0.65]],
    mental:   [[22,0.65],[24,0.75],[26,0.85],[28,0.92],[30,0.97],[32,1.00],[35,1.00],[37,0.98],[39,0.94],[41,0.88],[43,0.80]],
  };
  function ageMultiplier(group, age){ return curveVal(CURVES[group] || CURVES.mental, age); }

  // Separate from the neutral-baseline mechanic (which cancels raw age-curve noise so a
  // rookie's build doesn't read as "bad" just for being 22): this curve independently caps how
  // much of a build's talent EXPRESSES itself statistically at a given age. It's mild for young
  // players (still adjusting to the speed of the pro game) and real for older ones — even a
  // well-preserved 38-year-old throws a visibly smaller season than his 27-year-old self, on
  // top of whatever the neutral comparison already accounts for. This is what makes careers
  // regress with age instead of staying statistically flat until a hard cutoff.
  const PRIME_CURVE = [[22,0.90],[24,0.95],[26,0.99],[29,1.00],[32,1.00],[34,0.90],[36,0.78],[38,0.65],[40,0.50],[42,0.38]];
  function primeMultiplier(age){ return curveVal(PRIME_CURVE, age); }

  /* ================= Development =================
     Everything above (CURVES/ageMultiplier, PRIME_CURVE/primeMultiplier) governs how much of a
     FIXED build's talent gets EXPRESSED at a given age -- it never touches the build itself. Until
     now the actual attribute numbers were static for the whole career (aside from a rare permanent
     injury hit or a temporary event boost), so a 22-year-old rookie's true skill was, mechanically,
     exactly as good as it would ever get. This section makes the build itself grow and decline over
     a career -- real development, not just re-expression of the same fixed number.
     Driven by three things, deliberately NOT by how well a season actually went (no rich-get-richer
     snowball where a hot season accelerates growth):
       1. Age + attribute group, via DEVELOPMENT_CURVES below -- mental attributes (DEC/ANT/CLU)
          grow the longest and decline the least, matching how football IQ/experience actually age;
          accuracy/technical (SHA/DAC/TCH/PKT/REL) grows hard early on real reps and coaching, then
          erodes mildly late; physical (ARM/MOB/IMP) gets a small early bump from strength/
          conditioning gains, then declines the earliest and steepest -- arm strength and mobility
          are the most visibly age-limited parts of the position in real football.
       2. Actual reps: growth scales with gamesPlayedShare THAT season (see experienceFactor below)
          -- a QB stuck on a clipboard develops slower than one thrown into full-time starts, same
          as real player development. A season lost to injury/suspension still gives a reduced floor
          (meeting rooms and practice reps still count for something).
       3. devSpeed, a hidden per-career trait rolled once at the Combine -- some builds are simply
          faster or slower developers than others, the same real-world scouting uncertainty that
          makes "what's his ceiling" an actual question rather than a solved one. Surfaced to the
          player (not hidden as a spoiler stat) in the Stat Calculator tab's Career Development card.
     DUR is deliberately excluded, same as everywhere else it's treated specially -- see the note by
     ERA_ATTR_MULT: it's a fixed personal toughness trait, only ever moved by a permanent injury hit
     or the offseasontrain event boost, never by ordinary development. */
  const DEVELOPMENT_CURVES = {
    physical: [[22,1.6],[25,1.0],[27,0],[30,-0.4],[33,-1.2],[36,-2.2],[39,-3.2],[42,-4.0]],
    accuracy: [[22,2.2],[25,1.8],[28,0.9],[31,0],[34,-0.5],[37,-1.3],[40,-2.2]],
    mental:   [[22,2.6],[25,2.2],[28,1.4],[31,0.6],[34,0],[37,-0.2],[40,-0.5],[43,-0.8]],
  };
  // Three-uniform average instead of Math.random() alone -- a cheap, dependency-free way to get a
  // mild bell curve (centered on 1.0, "Standard Development") instead of a flat spread where
  // "Slow Burn" and "Ascending Fast" would be exactly as common as everyone in between.
  function rollDevSpeed(){
    const r = (Math.random()+Math.random()+Math.random())/3;
    return clamp(0.6 + r*0.8, 0.6, 1.4);
  }
  // Round 4: devSpeed is no longer fixed for the whole career (see developAttributes' "career-arc
  // swing" section below) -- a breakout or bust-spiral event can push it well outside its original
  // 0.6-1.4 roll range, so the tag table extends further in both directions to name those states.
  function devSpeedTag(speed){
    if(speed<0.45) return "Stalled Out";
    if(speed<0.75) return "Slow Burn";
    if(speed<0.9) return "Steady Riser";
    if(speed<1.1) return "Standard Development";
    if(speed<1.25) return "Quick Study";
    if(speed<1.45) return "Ascending Fast";
    return "Breakout Star";
  }
  // Round 4: how likely THIS player is to have a career-arc swing (breakout or bust-spiral) in a
  // given season. Deliberately keyed off the CURRENT devSpeed (not the original roll) so the
  // volatility itself travels with a player as their arc shifts -- a "Standard Development" guy who
  // breaks out into "Breakout Star" territory becomes more volatile going forward, not less, same as
  // a real boom-or-bust prospect who's already shown he can swing hard. Centered low (a "Standard"
  // player sees one only rarely) and rises the further devSpeed sits from the 1.0 center in EITHER
  // direction -- that's what makes the extreme archetypes ("Slow Burn"/"Ascending Fast" and beyond)
  // genuinely boom-or-bust instead of just faster/slower versions of the same smooth curve.
  function devVolatility(speed){
    return clamp(0.035 + Math.abs(speed-1.0)*0.18, 0.035, 0.22);
  }
  // Applies this season's development to `build` in place, based on the season just played (so a
  // season's OWN production always uses the pre-development attribute values -- growth from a
  // season's reps pays off starting next season, same as career.age++ in nextSeason()). Called at
  // the end of generateSeason, after that season's stats/awards are already locked in.
  function developAttributes(season, decade, league){
    if(!career.devSpeed) return; // guards old/replayed states with no devSpeed roll
    if(!career.devCarry) career.devCarry = {};
    if(!career.originalBuild) career.originalBuild = {...build};
    const share = league.games>0 ? season.games/league.games : 0;
    const experienceFactor = clamp(0.35 + share*0.85, 0.35, 1.2);
    // Organizational stability/turmoil (already tracked for roster-risk purposes -- see
    // waiverCheck) doubles as a development modifier here too: a stable coaching staff actually
    // helps a young player develop; a front-office shake-up disrupts it, for the one season it hits.
    const orgMult = career._orgStability ? 1.15 : career._orgTurmoil ? 0.75 : 1;
    const changed = [];
    ATTR_KEYS.forEach(k=>{
      if(k==="DUR") return;
      const group = ATTR_BY_KEY[k].group;
      const base = curveVal(DEVELOPMENT_CURVES[group] || DEVELOPMENT_CURVES.mental, career.age);
      const variance = 0.85 + Math.random()*0.3;
      let delta = base * career.devSpeed * experienceFactor * orgMult * variance;
      career.devCarry[k] = (career.devCarry[k]||0) + delta;
      const whole = Math.trunc(career.devCarry[k]);
      if(whole===0) return;
      career.devCarry[k] -= whole;
      const original = career.originalBuild[k];
      const maxGain = Math.round(14*career.devSpeed);
      const maxLoss = 22;
      const lo = clamp(original-maxLoss, 10, 99), hi = clamp(original+maxGain, 10, 99);
      const before = build[k];
      build[k] = clamp(build[k]+whole, lo, hi);
      if(build[k]!==before) changed.push({ key:k, delta: build[k]-before });
    });
    // ----- Round 4: career-arc swings (boom-or-bust development overhaul) -----
    // Replaces the old single-attribute +2/-1 breakout/regression nudge with a real, rarer,
    // multi-attribute career-defining event that also PERMANENTLY shifts career.devSpeed itself --
    // so a breakout doesn't just pop one season's numbers, it resets the player's whole trajectory
    // upward (every future season's smooth curve-based drift above uses the new, higher devSpeed),
    // and a bust-spiral resets it downward, naturally producing real plateaued/stalled careers once
    // devSpeed is dragged low enough that maxGain (Math.round(14*career.devSpeed) above) collapses
    // toward zero -- no separate "is this player a bust" flag needed, it falls out of the same dial.
    // Chance of a swing this season comes from devVolatility(current devSpeed) -- coaching
    // stability/turmoil still nudges it, same spirit as the old chances did. Direction (breakout vs
    // bust) is weighted by the CURRENT devSpeed (already-ascending players lean toward more
    // breakouts, already-declining ones lean toward more busts) but is never a sure thing either way
    // -- that unpredictability is the whole point of "boom or bust."
    const eligible = ATTR_KEYS.filter(k=>k!=="DUR" && build[k]<99);
    const swingChance = clamp(devVolatility(career.devSpeed) + (career._orgStability?0.02:0) - (career._orgTurmoil?0.015:0), 0.02, 0.28);
    if(eligible.length>=2 && Math.random()<swingChance){
      const breakoutProb = clamp(0.5 + (career.devSpeed-1.0)*0.5, 0.15, 0.85);
      const isBreakout = Math.random()<breakoutProb;
      const swingEvents = [];
      if(isBreakout && (career._breakoutCount||0)<2){
        // A real breakout: 3-5 attributes jump together, past the normal season-to-season ceiling.
        const n = clamp(3+Math.floor(Math.random()*3), 1, eligible.length);
        const picks = shuffle(eligible).slice(0,n);
        picks.forEach(k=>{
          const original = career.originalBuild[k];
          const hi = clamp(original+30, 10, 99);
          const before = build[k];
          build[k] = clamp(build[k]+ (4+Math.floor(Math.random()*6)), 10, hi);
          if(build[k]!==before){ changed.push({ key:k, delta: build[k]-before, breakout:true }); swingEvents.push(k); }
        });
        if(swingEvents.length){
          career._breakoutCount = (career._breakoutCount||0)+1;
          career.devSpeed = clamp(career.devSpeed + 0.15 + Math.random()*0.1, 0.25, 1.8);
          season.devArcEvent = { type:"breakout", keys: swingEvents.slice() };
          const labels = swingEvents.map(k=> (ATTR_BY_KEY[k]||{}).label || k);
          career.transactions.push(`${season.year}: Breakout season — ${labels.join(", ")} all took a real step forward. He looks like a different player.`);
        }
      } else if(!isBreakout){
        // A bust-spiral: 2-4 attributes drop together, past the normal season-to-season floor.
        const n = clamp(2+Math.floor(Math.random()*3), 1, eligible.length);
        const picks = shuffle(eligible).slice(0,n);
        picks.forEach(k=>{
          const original = career.originalBuild[k];
          const lo = clamp(original-30, 10, 99);
          const before = build[k];
          build[k] = clamp(build[k] - (3+Math.floor(Math.random()*5)), lo, 99);
          if(build[k]!==before){ changed.push({ key:k, delta: build[k]-before, regression:true }); swingEvents.push(k); }
        });
        if(swingEvents.length){
          career._bustCount = (career._bustCount||0)+1;
          career.devSpeed = clamp(career.devSpeed - 0.15 - Math.random()*0.1, 0.25, 1.8);
          season.devArcEvent = { type:"bust", keys: swingEvents.slice() };
          const labels = swingEvents.map(k=> (ATTR_BY_KEY[k]||{}).label || k);
          career.transactions.push(`${season.year}: A concerning stretch — ${labels.join(", ")} all slipped noticeably. Scouts are starting to ask questions.`);
        }
      }
    }
    // Stashed on the season itself so the Attributes tab can show THIS season's movement
    // specifically (see buildAttributesTabHTML's "This Season's Development" section) instead of
    // only ever showing the cumulative draft-day-to-now comparison -- `changed` was previously
    // computed and then thrown away the moment this function returned.
    season.attrChanges = changed;
  }

  function decadeForYear(year){
    const d = Math.floor(year/10)*10;
    const key = d + "s";
    return DECADES.includes(key) ? key : (year < 1960 ? "1960s" : "2020s");
  }

  /* ----- Experimental: era-themed event cards. A single wrapper (renderEraCard / eraWrap) that
     re-skins the visual chrome of an event card based on the decade currently being simulated —
     vintage newspaper, TV chyron, teletext, Web 1.0, forum post, push notification, social post.
     It never touches the inner markup (eyebrow/h3/p/choices) that each event-rendering function
     already builds, so every existing button id and class (#infAccept, .fa-accept, etc.) and its
     addEventListener wiring keeps working untouched — only the outer container and a few purely
     decorative, id-free header/footer bits change per era. ----- */
  function eraChrome(decade){
    switch(decade){
      case "1960s": return { wrapClass:"era-1960s",
        before:`<div class="era-tag">The Gridiron Gazette — Late Edition</div>` };
      case "1970s": return { wrapClass:"era-1970s",
        before:`<div class="era-scanlines"></div><div class="era-tag">◉ LIVE — GRIDIRON SPORTS DESK</div>` };
      case "1980s": return { wrapClass:"era-1980s",
        before:`<div class="era-tag">▌TELETEXT 108▐ GRIDIRON NEWS</div>` };
      case "1990s": return { wrapClass:"era-1990s",
        before:`<div class="era-tag">GridironLab.net</div>` };
      case "2000s": return { wrapClass:"era-2000s",
        before:`<div class="era-forum-head"><span class="era-forum-title">Thread: Breaking News</span><span class="era-forum-time">Posted ${randInt(1,11)}:${String(randInt(0,59)).padStart(2,"0")} ${Math.random()<0.5?"AM":"PM"}</span></div>` };
      case "2010s": return { wrapClass:"era-2010s", overlay:true, before:"" };
      case "2020s": return { wrapClass:"era-2020s",
        before:`<div class="era-social-head"><span class="era-social-avatar">🏈</span><span class="era-social-name">Gridiron Insider<span class="era-verified">✔</span></span><span class="era-social-handle">@gridironlab</span></div>`,
        after:`<div class="era-social-icons"><span>↩ Reply</span><span>⟲ Retweet</span><span>♥ Like</span></div>` };
      default: return { wrapClass:"", before:"", after:"" };
    }
  }
  function eraWrap(decade, innerHtml, opts){
    opts = opts || {};
    const toneClass = opts.tone==="bad" ? "event-card-bad" : opts.tone==="good" ? "event-card-good" : "";
    const chrome = eraChrome(decade);
    const card = `<div class="event-card ${chrome.wrapClass} ${toneClass}">${chrome.before||""}${innerHtml}${chrome.after||""}</div>`;
    return chrome.overlay ? `<div class="era-2010s-overlay">${card}</div>` : card;
  }
  function teamNameAt(teamId, year){
    const t = TEAMS.find(x=>x.id===teamId);
    if(!t) return teamId;
    for(const seg of t.names){ if(year>=seg.from && year<=seg.to) return seg.name; }
    return t.names[t.names.length-1].name;
  }
  function teamsAvailable(year){ return TEAMS.filter(t=>t.start<=year); }

  /* ----- team color pairs for the draft night reveal card. Publicly-known brand colors only —
     no logos or crests are reproduced, just a stylized primary/secondary gradient + initials
     badge, to keep the visual flourish without touching trademarked artwork. ----- */
  const TEAM_COLORS = {
    ARI:["#97233F","#000000"], ATL:["#A71930","#000000"], BAL:["#241773","#9E7C0C"], BUF:["#00338D","#C60C30"],
    CAR:["#0085CA","#101820"], CHI:["#0B162A","#C83803"], CIN:["#FB4F14","#000000"], CLE:["#311D00","#FF3C00"],
    DAL:["#041E42","#869397"], DEN:["#FB4F14","#002244"], DET:["#0076B6","#B0B7BC"], GB:["#203731","#FFB612"],
    HOU:["#03202F","#A71930"], IND:["#002C5F","#A2AAAD"], JAX:["#101820","#D7A22A"], KC:["#E31837","#FFB81C"],
    LV:["#000000","#A5ACAF"], LAC:["#0080C6","#FFC20E"], LAR:["#003594","#FFA300"], MIA:["#008E97","#F58220"],
    MIN:["#4F2683","#FFC62F"], NE:["#002244","#C60C30"], NO:["#101820","#D3BC8D"], NYG:["#0B2265","#A71930"],
    NYJ:["#125740","#000000"], PHI:["#004C54","#A5ACAF"], PIT:["#FFB612","#101820"], SF:["#AA0000","#B3995D"],
    SEA:["#002244","#69BE28"], TB:["#D50A0A","#34302B"], TEN:["#0C2340","#4B92DB"], WAS:["#5A1414","#FFB612"],
  };
  function teamColors(teamId){ return TEAM_COLORS[teamId] || ["#3a4a5c","#8a95a3"]; }
  function teamInitials(name){
    const last = name.split(" ").slice(-1)[0] || name;
    return last.slice(0,2).toUpperCase();
  }

  /* ----- player identity: name / college / hometown, all optional and randomizable ----- */
  const FIRST_NAMES = [
    "Marcus","Jalen","Trevor","Colt","Deshawn","Bryce","Kellen","Dax","Reggie","Chase",
    "Grayson","Malik","Tucker","Dominic","Cade","Jaxon","Landon","Miles","Truett","Isaiah",
    "Beau","Corey","Wyatt","Xavier","Levi","Sawyer","Damon","Elias","Reid","Zion",
    "Holden","Tyree","Nash","Barrett","Kingston","Emory","Jett","Rhett","Amir","Callahan",
  ];
  const LAST_NAMES = [
    "Kessler","Whitfield","Bramlett","Osei","McAllister","Dunbar","Villanueva","Strickland","Beaumont","Cutshall",
    "Delgado","Marchetti","Okafor","Prewitt","Sandoval","Tillery","Vance","Winslow","Yarborough","Zaleski",
    "Hargrove","Ledet","Munroe","Petrocelli","Quintero","Rutledge","Sorensen","Thibodeaux","Ulrich","Voss",
    "Broussard","Callender","Dietrich","Escamilla","Fontenot","Garrity","Hollis","Ibarra","Jorstad","Kilbride",
  ];
  // Fun easter egg: the gloriously fake football-player names from Key & Peele's "East/West
  // College Bowl" sketches (all three of them), folded into the name generator at low odds so
  // a league full of Marcus Kesslers occasionally turns up a Hingle McCringleberry. Deliberately
  // excludes the handful of names in the sketches that are actually real NFL players' names
  // (the joke there was "spot the real one among the fakes") and a few pure sound-effect/symbol
  // "names" that don't read right as a roster entry.
  const EASTER_EGG_NAMES = [
    "D'Marcus Williums","T.J. Juckson","T'Variusness King","Tyroil Smoochie-Wallace","D'Squarius Green Jr.",
    "Ibrahim Moizoos","Jackmerius Tacktheritrix","D'Isiah T. Billings-Clyde","D'Jasper Probincrux III",
    "Leoz Maxwell Jilliumz","Javaris Jamar Javarison-Lamar","Davoin Shower-Handel","Hingle McCringleberry",
    "L'Carpetron Dookmarriot","J'Dinkalage Morgoone","Xmus Jaxon Flaxon-Waxon","Saggitariutt Jefferspin",
    "D'Glester Hardunkichud","Swirvithan L'Goodling-Splatt","Quatro Quatro","Ozamataz Buckshank",
    "Beezer Twelve Washingbeard","Shakiraquan T.G.I.F. Carter","Sequester Grundelplith M.D.",
    "Scoish Velociraptor Maloish","T.J. A.J. R.J. Backslashinfourth V","Donkey Teeth","Torque Lewith",
    "Coznesster Smiff","Elipses Corter","Nyquillus Dillwad","Bismo Funyuns","Decatholac Mango",
    "Mergatroid Skittle","Quiznatodd Bidness","D'Pez Poopsie","Quackadilly Blip","Goolius Boozler",
    "Bisquiteen Trisket","Fartrell Cluggins","Blyrone Blashinton","Cartoons Plural","Jammie Jammie-Jammie",
    "Equine Ducklings","Dahistorius Lamystorius","Ewokoniad Sigourneth Juniorstein","King Prince Chambermaid",
    "Ladennifer Jadaniston","Creme De La Creme","Cosgrove Shumway","Doink Ahanahue","Legume Duprix",
    "Leger Douzable","Quisperny G'Dunzoid Sr.","Grunky Peep","Strunk Flugget","Stumptavian Roboclick",
    "Vagonius Thicket-Suede","Marmadune Shazbot","Swordless Mimetown","Faux Doadles","Myriad Profiteroles",
    "Busters Brownce","Turdine Cupcake","Rerutweeds Myth","Ishmaa'ily Kitchen","Snarf Mintz-Plasse",
    "Splendiferous Finch","Triple Parakeet-Shoes","Logjammer D'Baggagecling",
  ];
  function randomFullName(){
    if(Math.random()<0.04) return pick(EASTER_EGG_NAMES);
    return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
  }

  const COLLEGES = [
    "Alabama","Ohio State","Georgia","Clemson","Oklahoma","USC","Michigan","LSU","Texas","Florida State",
    "Penn State","Notre Dame","Oregon","Wisconsin","Auburn","Florida","Tennessee","Miami (FL)","Texas A&M","Washington",
    "Michigan State","Iowa","UCLA","Baylor","TCU","Utah","North Carolina","Louisville","Mississippi","Stanford",
    "Boise State","Cincinnati","Memphis","Toledo","Fresno State","Appalachian State","Coastal Carolina","Youngstown State",
    "North Dakota State","Eastern Washington","Delaware","Villanova","James Madison","Sam Houston State",
  ];
  function randomCollege(){ return pick(COLLEGES); }

  const HOMETOWNS = [
    ["Odessa","TX"],["Massillon","OH"],["Aliquippa","PA"],["Thibodaux","LA"],["Valdosta","GA"],
    ["Ada","OK"],["Lakeland","FL"],["Concord","NC"],["Muncie","IN"],["Everett","WA"],
    ["Chandler","AZ"],["Folsom","CA"],["Owasso","OK"],["Southlake","TX"],["Bellevue","WA"],
    ["Hoover","AL"],["Marietta","GA"],["Council Bluffs","IA"],["Butte","MT"],["Cheyenne","WY"],
    ["Biloxi","MS"],["Fargo","ND"],["Bristol","CT"],["Erie","PA"],["Duluth","MN"],
    ["Provo","UT"],["Spokane","WA"],["Chattanooga","TN"],["Waco","TX"],["Canton","OH"],
    ["Napa","CA"],["Missoula","MT"],["Huntington","WV"],["Beaumont","TX"],["Rapid City","SD"],
    ["Macon","GA"],["Flint","MI"],["Yuma","AZ"],["Bangor","ME"],["Laramie","WY"],
  ];
  function randomHometown(){ const h = pick(HOMETOWNS); return { city:h[0], state:h[1] }; }

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
  const DIVISIONS = [
    { conf:"AFC", name:"East",  teams:["BUF","MIA","NE","NYJ"] },
    { conf:"AFC", name:"North", teams:["BAL","CIN","CLE","PIT"] },
    { conf:"AFC", name:"South", teams:["HOU","IND","JAX","TEN"] },
    { conf:"AFC", name:"West",  teams:["DEN","KC","LV","LAC"] },
    { conf:"NFC", name:"East",  teams:["DAL","NYG","PHI","WAS"] },
    { conf:"NFC", name:"North", teams:["CHI","DET","GB","MIN"] },
    { conf:"NFC", name:"South", teams:["ATL","CAR","NO","TB"] },
    { conf:"NFC", name:"West",  teams:["ARI","LAR","SF","SEA"] },
  ];
  const DIVISIONS_1970_2001 = [
    { conf:"AFC", name:"East",    teams:["BUF","MIA","NE","NYJ","IND"] },
    { conf:"AFC", name:"Central", teams:["PIT","CLE","CIN","TEN","JAX","BAL"] },
    { conf:"AFC", name:"West",    teams:["DEN","KC","LV","LAC","SEA"] },
    { conf:"NFC", name:"East",    teams:["DAL","NYG","PHI","WAS","ARI"] },
    { conf:"NFC", name:"Central", teams:["CHI","DET","GB","MIN","TB"] },
    { conf:"NFC", name:"West",    teams:["LAR","SF","ATL","NO","CAR"] },
  ];
  const DIVISIONS_PRE_1970 = [
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
  const PLAYOFF_ERAS = [
    { from:1900, to:1969, wildcards:0, wcGames:0 },   // pre-merger: division/conference champs only, no wild cards existed
    { from:1970, to:1977, wildcards:1, wcGames:2 },   // all 4 teams play in, no byes
    { from:1978, to:1989, wildcards:2, wcGames:1 },   // the 2 wild cards play each other; 3 division winners wait
    { from:1990, to:2001, wildcards:3, wcGames:2 },   // 3rd wild card added; top 2 seeds bye
    { from:2002, to:2019, wildcards:2, wcGames:2 },   // realignment to 4 divisions/conf; top 2 seeds bye
    { from:2020, to:9999, wildcards:3, wcGames:3 },   // 7th seed added; only the #1 seed byes
  ];
  function divisionsForYear(year){
    const table = year>=2002 ? DIVISIONS : (year>=1970 ? DIVISIONS_1970_2001 : DIVISIONS_PRE_1970);
    const avail = new Set(teamsAvailable(year).map(t=>t.id));
    return table
      .map(d=>({ conf:d.conf, name:d.name, teams:d.teams.filter(id=>avail.has(id)) }))
      .filter(d=>d.teams.length>0);
  }
  function playoffFormatForYear(year){
    const era = PLAYOFF_ERAS.find(e=>year>=e.from && year<=e.to) || PLAYOFF_ERAS[PLAYOFF_ERAS.length-1];
    const divisionsPerConf = divisionsForYear(year).filter(d=>d.conf==="AFC").length;
    const seedsPerConf = divisionsPerConf + era.wildcards;
    return { divisionsPerConf, wildcards: era.wildcards, wcGames: Math.min(era.wcGames, Math.floor(seedsPerConf/2)), seedsPerConf };
  }
  function divisionOf(teamId, year){
    const divs = divisionsForYear(year || 2024);
    return divs.find(d=>d.teams.includes(teamId)) || divs[0];
  }
  function conferenceOf(teamId, year){ return divisionOf(teamId, year).conf; }

  /* ----- QOL: era-accurate conference/round display names -----
     Internal codes ("AFC"/"NFC") and internal round labels ("Wild Card", "Divisional",
     "Conference Championship", "Super Bowl") are used throughout for LOGIC (bracket
     dispatch, ROUND_DIFFICULTY_WEIGHTS lookups, isSB checks, etc.) and must never change --
     these are pure display-layer wrappers used only at render sites. Real history: the AFL
     and NFL were separate leagues through the 1969 season and merged into the AFC/NFC for
     1970; Super Bowl I was played after the 1966 season, so seasons 1966+ get the real
     roman-numeral Super Bowl name, while the fictional pre-1966 cross-league finale our
     bracket still simulates is relabeled as a non-canonical "NFL-AFL Championship Game". */
  function toRoman(num){
    const vals = [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];
    let n = Math.max(1, Math.round(num)), out = "";
    for(const [v,s] of vals){ while(n>=v){ out+=s; n-=v; } }
    return out;
  }
  function confLabel(conf, year){
    if(year<1970) return conf==="AFC" ? "AFL" : "NFL";
    return conf;
  }
  function superBowlDisplayName(year){
    return year>=1966 ? `Super Bowl ${toRoman(year-1965)}` : "NFL-AFL Championship Game";
  }
  function roundDisplayLabel(internalRound, year){
    if(internalRound==="Super Bowl") return superBowlDisplayName(year);
    if(internalRound==="Conference Championship" && year<1970){
      return `${confLabel(conferenceOf(career.teamId, year), year)} Championship`;
    }
    return internalRound;
  }
  function pickTeamByStrength(year, excludeId, lo, hi){
    const pool = teamsAvailable(year).filter(t=>t.id!==excludeId);
    const inRange = pool.filter(t=> (career.leagueStrength ? career.leagueStrength[t.id] : 60) >= lo && (career.leagueStrength ? career.leagueStrength[t.id] : 60) <= hi);
    return pick(inRange.length ? inRange : pool);
  }

  // ----- Supporting cast: a team's overall grade is one number, but "how good is the roster
  // around the QB specifically" is really at least two separable things -- the offensive line and
  // the skill-position weapons -- and a good team can absolutely have a bad one of either (the
  // "great team, terrible left tackle" case). Independently noisy against team strength (not just
  // a copy of it) so this is a real distinct signal, not a redundant display of the same number.
  function rollSupportingCastGrade(teamStrength){
    return clamp(Math.round(teamStrength + randInt(-18,18)), 20, 99);
  }
  function castLetterGrade(value){
    if(value>=93) return "A+"; if(value>=87) return "A"; if(value>=82) return "A-";
    if(value>=77) return "B+"; if(value>=72) return "B"; if(value>=67) return "B-";
    if(value>=62) return "C+"; if(value>=55) return "C"; if(value>=48) return "C-";
    if(value>=40) return "D+"; if(value>=32) return "D"; if(value>=24) return "D-";
    return "F";
  }

  function passerRating(comp, att, yards, td, int){
    if(att<=0) return 0;
    const a = clamp(((comp/att)-0.3)*5, 0, 2.375);
    const b = clamp(((yards/att)-3)*0.25, 0, 2.375);
    const c = clamp((td/att)*20, 0, 2.375);
    const d = clamp(2.375-((int/att)*25), 0, 2.375);
    return Math.round(((a+b+c+d)/6)*100*10)/10;
  }

  /* ================= Achievements =================
     A pure achievement system: every entry in ACHIEVEMENTS is a one-time, PERMANENT unlock tied to
     a specific, often unusual career moment or milestone -- never tiered, never re-checked once
     earned, and never equipped (no slots, no cosmetic loadout; simply "did this happen in this
     career, yes or no"). career.achievements = { unlocked: {[key]: true} } is the entire state.
     checkAchievements() is the ONLY writer, safe to call as often as convenient (idempotent -- it
     only ever flips an entry from missing/false to true) -- called from generateSeason() (so
     season-level thresholds like a big statistical year are caught the moment they happen),
     finalizePlayoffOutcome() (so this season's ring/playoff result is final before streak checks
     run), and finishCareer() (so a career-ending-only condition, like retiring loyal to one team,
     can still fire on the very last tick). The Baseball Card's back face shows every achievement
     actually earned in that career -- not a curated equip loadout -- via entry.achievements
     (see saveTrophyRoomEntry in finishCareer). */
  function maxConsecutive(list, pred){
    let max=0, cur=0;
    list.forEach(x=>{ if(pred(x)){ cur++; max=Math.max(max,cur); } else cur=0; });
    return max;
  }
  function wonTitle(s){ return !!(s.playoffs && s.playoffs.wonRing); }
  // Reached the actual title game (internal round label is always "Super Bowl", every era -- see
  // buildSuperBowlRound) and did NOT come away with the ring. Pre-1966 seasons can win their ring
  // via the Conference Championship and then lose the fictional exhibition Super Bowl afterward
  // (see finalizePlayoffOutcome) -- the wonRing check here is what keeps that case from being
  // misread as a title-game loss.
  function reachedTitleGameAndLost(s){
    if(!s.playoffs || !s.playoffs.rounds || !s.playoffs.rounds.length) return false;
    const last = s.playoffs.rounds[s.playoffs.rounds.length-1];
    return last.round==="Super Bowl" && !last.won && !wonTitle(s);
  }

  const BADGE_ICONS = {
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
  };
  function badgeIconSVG(key){
    return `<svg viewBox="0 0 24 24" class="pb-icon-svg" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${BADGE_ICONS[key]||BADGE_ICONS.star}</svg>`;
  }

  const ACHIEVEMENTS = [
    // ----- single-season statistical moments -----
    { key:"gunslinger", name:"Gunslinger", icon:"bolt",
      blurb:"A season spent daring defenses to stop the deep ball, consequences be damned.",
      hint:"Post a season with huge yardage, a big TD count, and a high INT total to match.",
      check: ()=> career.seasonLog.some(s=> s.yards>=4200 && s.td>=32 && s.int>=18) },
    { key:"fieldgeneral", name:"Field General", icon:"target",
      blurb:"A season of surgical, mistake-free precision.",
      hint:"Post a season with elite completion% and very few interceptions on heavy volume.",
      check: ()=> career.seasonLog.some(s=> s.att>=400 && (s.pct||0)>=0.685 && s.int<=7) },
    { key:"ghostinthepocket", name:"Ghost in the Pocket", icon:"wing",
      blurb:"A season where the pass rush simply couldn't find him.",
      hint:"Post a season with a very low sack rate on heavy passing volume.",
      check: ()=> career.seasonLog.some(s=> s.att>=400 && s.sacks/s.att<=0.025) },
    { key:"vault", name:"Vault", icon:"lock",
      blurb:"A season of total ball security under a heavy workload.",
      hint:"Post a high-volume season with almost no interceptions.",
      check: ()=> career.seasonLog.some(s=> s.att>=450 && s.int<=5) },
    { key:"ironarmed", name:"Iron-Armed", icon:"mountain",
      blurb:"A season of pure, league-leading workload.",
      hint:"Post a season with an enormous number of pass attempts.",
      check: ()=> career.seasonLog.some(s=> s.att>=620) },
    { key:"groundthreat", name:"Threat on the Ground", icon:"football",
      blurb:"A season defenses had to game-plan for on the ground, not just through the air.",
      hint:"Post a season with four-digit rushing yardage.",
      check: ()=> career.seasonLog.some(s=> (s.rushYards||0)>=1000) },
    { key:"perfection", name:"Perfection", icon:"gauge",
      blurb:"A passer rating so high it barely seems fair.",
      hint:"Post a season with a passer rating north of 112.",
      check: ()=> career.seasonLog.some(s=> s.rating>=112) },

    // ----- accolades, arcs, and off-the-field moments -----
    { key:"hollywoodending", name:"Hollywood Ending", icon:"heart",
      blurb:"Won it all the same year he put a ring on it, off the field too.",
      hint:"Win a championship the same season you get married.",
      check: ()=>{ const last = career.seasonLog[career.seasonLog.length-1];
        return !!(career.relationship && career.relationship.status==="married" && career.relationship.startYear===career.year && last && wonTitle(last)); } },
    { key:"againstallodds", name:"Against All Odds", icon:"compass",
      blurb:"Dragged a roster that had no business contending to the top of the mountain.",
      hint:"Win an MVP or a championship on a bottom-tier (under 45 grade) team.",
      check: ()=> career.seasonLog.some(s=> s.teamOverall<45 && ((s.awards||[]).includes("MVP") || wonTitle(s))) },
    { key:"phoenixrising", name:"Phoenix Rising", icon:"flame",
      blurb:"Written off after a bust stretch, then came back better than ever.",
      hint:"Recover from a bust development swing with a later breakout.",
      check: ()=>{ let sawBust=false;
        for(const s of career.seasonLog){
          if(s.devArcEvent && s.devArcEvent.type==="bust") sawBust=true;
          if(sawBust && s.devArcEvent && s.devArcEvent.type==="breakout") return true;
        }
        return false; } },
    { key:"ironwill", name:"Iron Will", icon:"shield",
      blurb:"Played through more pain than the roster around him ever knew.",
      hint:"Make Pro Bowl or All-Pro in a season your Wear & Tear meter is above 45.",
      check: ()=>{ const last = career.seasonLog[career.seasonLog.length-1];
        return !!(last && (career.wearAndTear||0)>45 && ((last.awards||[]).includes("Pro Bowl")||(last.awards||[]).includes("All-Pro"))); } },
    { key:"theunanimous", name:"The Unanimous", icon:"star",
      blurb:"An MVP season nobody in the league could argue with.",
      hint:"Win MVP with a passer rating of 105 or higher.",
      check: ()=>{ const last = career.seasonLog[career.seasonLog.length-1];
        return !!(last && (last.awards||[]).includes("MVP") && last.rating>=105); } },
    { key:"oldmanwinter", name:"Old Man Winter", icon:"gem",
      blurb:"Still doing it well past the age everyone said he'd be done.",
      hint:"Make Pro Bowl, All-Pro, or win a ring at age 38 or older.",
      check: ()=>{ const last = career.seasonLog[career.seasonLog.length-1];
        return !!(last && career.age>=38 && ((last.awards||[]).includes("Pro Bowl")||(last.awards||[]).includes("All-Pro")||wonTitle(last))); } },
    { key:"loyaltothedeath", name:"Loyal to the Death", icon:"anchor",
      blurb:"One team, one city, an entire career — and he walked away on his own terms.",
      hint:"Retire (not released or traded away) after 10+ seasons with a single team.",
      check: ()=> career.exitReason==="retired" && career.seasonLog.length>=10 && career.seasonLog.every(s=>s.teamId===career.teamId) },
    { key:"latebloomer", name:"Late Bloomer", icon:"sunrise",
      blurb:"Took the long way to stardom, and got there anyway.",
      hint:"Earn your first Pro Bowl or All-Pro nod at age 30 or older.",
      check: ()=>{ const first = career.seasonLog.find(s=> (s.awards||[]).includes("Pro Bowl")||(s.awards||[]).includes("All-Pro"));
        return !!(first && first.age>=30); } },
    { key:"storybook", name:"Storybook Career", icon:"book",
      blurb:"A career people will still be telling stories about decades from now.",
      hint:"Rack up 3 or more legendary career moments.",
      check: ()=> (career.lifeEventLog||[]).filter(e=>e.legendary).length>=3 },
    { key:"scartissue", name:"Scar Tissue", icon:"mountain",
      blurb:"Broken down more than once, and got back up every single time.",
      hint:"Survive 2 or more permanent wear-and-tear breakdowns.",
      check: ()=> career.seasonLog.filter(s=>s.wearBreakdown).length>=2 },

    // ----- dynasties, droughts, and history-flavored streaks -----
    { key:"wagons", name:"No One Circles the Wagons", icon:"crown",
      blurb:"Four straight championships. The league simply couldn't answer.",
      hint:"Win the championship in four consecutive seasons.",
      check: ()=> maxConsecutive(career.seasonLog, wonTitle)>=4 },
    { key:"buffalobills", name:"Quiet Like the Buffalo Bills", icon:"snow",
      blurb:"Four straight trips to the big game. Four straight times the confetti was the wrong color.",
      hint:"Reach the championship game four seasons in a row without ever winning it.",
      check: ()=> maxConsecutive(career.seasonLog, reachedTitleGameAndLost)>=4 },
    { key:"snakebitten", name:"Snake Bitten", icon:"gem",
      blurb:"So close, so many times, and never once close enough.",
      hint:"Reach the championship game 3+ times across your career without ever winning one.",
      check: ()=> career.totals.rings===0 && career.seasonLog.filter(reachedTitleGameAndLost).length>=3 },
    { key:"ringchaser", name:"Ring Chaser", icon:"chain",
      blurb:"Found a way to win it all no matter which jersey he was wearing.",
      hint:"Win a championship with two or more different teams.",
      check: ()=> new Set(career.seasonLog.filter(wonTitle).map(s=>s.teamId)).size>=2 },
    { key:"dynasty", name:"Dynasty", icon:"trophy",
      blurb:"Built something that lasted — the trophy case has one team's name all over it.",
      hint:"Win 4 or more championships with a single team.",
      check: ()=>{ const counts={}; career.seasonLog.filter(wonTitle).forEach(s=> counts[s.teamId]=(counts[s.teamId]||0)+1);
        return Object.values(counts).some(c=>c>=4); } },
    { key:"perfectseason", name:"Perfect Season", icon:"star",
      blurb:"Not one single loss, all year.",
      hint:"Finish a season with a perfect team record.",
      check: ()=> career.seasonLog.some(s=> s.teamGames>0 && s.teamLosses===0) },
    { key:"turnaround", name:"The Turnaround", icon:"sunrise",
      blurb:"Walked into a rebuild and walked out a champion.",
      hint:"Join a bottom-tier (under 45 grade) team and win a championship with them within 3 seasons.",
      check: ()=>{
        for(let i=0;i<career.seasonLog.length;i++){
          if(career.seasonLog[i].teamOverall<45){
            for(let j=i;j<Math.min(career.seasonLog.length,i+4);j++){
              if(career.seasonLog[j].teamId===career.seasonLog[i].teamId && wonTitle(career.seasonLog[j])) return true;
            }
          }
        }
        return false; } },
    { key:"wiretowire", name:"Wire to Wire", icon:"infinity",
      blurb:"The best player in the league, two years running.",
      hint:"Win MVP in back-to-back seasons.",
      check: ()=> maxConsecutive(career.seasonLog, s=>(s.awards||[]).includes("MVP"))>=2 },
    { key:"faceoftheleague", name:"Face of the League", icon:"star",
      blurb:"The league ran through him for the better part of a decade.",
      hint:"Win MVP three or more times across your career.",
      check: ()=> career.totals.mvps>=3 },
    { key:"juggernaut", name:"Juggernaut", icon:"shield",
      blurb:"Three straight years fielding one of the best rosters in football.",
      hint:"Keep your team grade at 90 or higher for three consecutive seasons.",
      check: ()=> maxConsecutive(career.seasonLog, s=>s.teamOverall>=90)>=3 },
    { key:"onemanteam", name:"One-Man Team", icon:"mountain",
      blurb:"Carried a bad roster to individual honors again and again.",
      hint:"Make Pro Bowl or All-Pro three or more times on a bottom-tier (under 45 grade) team.",
      check: ()=> career.seasonLog.filter(s=> s.teamOverall<45 && ((s.awards||[]).includes("Pro Bowl")||(s.awards||[]).includes("All-Pro"))).length>=3 },
    { key:"biggamehunter", name:"Big Game Hunter", icon:"flame",
      blurb:"Walked into the championship as the lesser team, and walked out with the trophy anyway.",
      hint:"Win the championship as the lower-graded team in the Super Bowl.",
      check: ()=> career.seasonLog.some(s=>{
        if(!wonTitle(s) || !s.playoffs.rounds.length) return false;
        const last = s.playoffs.rounds[s.playoffs.rounds.length-1];
        return last.round==="Super Bowl" && last._defOverall!=null && s.teamOverall<last._defOverall;
      }) },
    { key:"ironclad", name:"Ironclad", icon:"shield",
      blurb:"A full decade-plus in the league, and never once missed a game to injury.",
      hint:"Play 10+ seasons without ever missing a game to injury.",
      check: ()=> career.seasonLog.length>=10 && career.seasonLog.every(s=>(s.missedGamesInjury||0)===0) },
  ];

  function achievementDefFor(key){ return ACHIEVEMENTS.find(a=>a.key===key); }

  function ensureAchievementState(){
    if(!career.achievements) career.achievements = { unlocked:{} };
  }

  // The only writer of career.achievements.unlocked -- permanent, never re-checked once true.
  // Safe to call from anywhere, as often as convenient: called from generateSeason() (catches a
  // season-level statistical achievement the moment it happens), finalizePlayoffOutcome() (this
  // season's ring/awards are final by then, so streak/title-game checks are accurate), and
  // finishCareer() (so a career-ending-only condition, like retiring loyal to one team, can fire).
  function checkAchievements(){
    ensureAchievementState();
    ACHIEVEMENTS.forEach(a=>{
      if(career.achievements.unlocked[a.key]) return;
      if(a.check()) career.achievements.unlocked[a.key] = true;
    });
  }

  function achievementStatusFor(key){
    ensureAchievementState();
    const def = achievementDefFor(key);
    if(!def) return null;
    return { def, unlocked: !!career.achievements.unlocked[key] };
  }

  function achievementFrameHTML(def, unlocked){
    return `<div class="pb-frame ${unlocked?"unlocked":"locked"}">${badgeIconSVG(def.icon)}</div>`;
  }

  function safeStorage(){ try{ const k="__glab__"; localStorage.setItem(k,"1"); localStorage.removeItem(k); return window.localStorage; }catch(e){ return null; } }
  const store = safeStorage();
  // In-memory fallback, alongside localStorage: some embedded/preview contexts silently block
  // storage (safeStorage() returns null, or reads/writes quietly no-op), which used to mean
  // best.score never persisted and every single combine falsely claimed "New personal best."
  // _sessionBest mirrors the last-saved value for the life of this page load, so at minimum
  // back-to-back builds in one sitting correctly remember the real best, storage or not.
  let _sessionBest = null;
  function loadBest(){
    if(_sessionBest) return Object.assign({}, _sessionBest);
    if(!store) return {};
    try{ return JSON.parse(store.getItem("gridironlab.qb.best")||"{}"); }catch(e){ return {}; }
  }
  function saveBest(obj){
    _sessionBest = Object.assign({}, obj);
    if(!store) return;
    try{ store.setItem("gridironlab.qb.best", JSON.stringify(obj)); }catch(e){}
  }

  // ----- Trophy Room: a local leaderboard across every completed career on this browser, not just
  // the single "best" HOF tier gridironlab.qb.best already tracks -- lets a player who's run a dozen
  // builds actually compare them (most rings, highest yards, best rating, biggest paycheck), same
  // "browser-local, no real accounts" constraint as the last-build profile above. Capped at 60
  // entries, dropping the OLDEST first, so this can't grow without bound over a long play history.
  const TROPHY_ROOM_KEY = "gridironlab.trophyroom";
  const TROPHY_ROOM_CAP = 60;
  let _sessionTrophyRoom = null;
  function loadTrophyRoom(){
    if(_sessionTrophyRoom) return _sessionTrophyRoom.slice();
    if(!store) return [];
    try{ const raw = store.getItem(TROPHY_ROOM_KEY); return raw ? JSON.parse(raw) : []; }catch(e){ return []; }
  }
  function saveTrophyRoomEntry(entry){
    const list = loadTrophyRoom();
    list.push(entry);
    while(list.length>TROPHY_ROOM_CAP) list.shift();
    _sessionTrophyRoom = list;
    if(!store) return;
    try{ store.setItem(TROPHY_ROOM_KEY, JSON.stringify(list)); }catch(e){}
  }
  const TROPHY_ROOM_SORTERS = {
    recent: (a,b)=> b.completedAt-a.completedAt,
    rings: (a,b)=> b.rings-a.rings,
    yards: (a,b)=> b.yards-a.yards,
    rating: (a,b)=> b.rating-a.rating,
    earnings: (a,b)=> b.earnings-a.earnings,
    seasons: (a,b)=> b.seasons-a.seasons,
    td: (a,b)=> b.td-a.td,
  };
  function buildTrophyRoomTableHTML(sortKey){
    const list = loadTrophyRoom();
    if(!list.length){
      return `<div class="calc-refnote">No completed careers yet — retire, get released, or ride one out to the end to start building your Trophy Room.</div>`;
    }
    const sorted = list.slice().sort(TROPHY_ROOM_SORTERS[sortKey]||TROPHY_ROOM_SORTERS.recent);
    // Records are computed across the WHOLE room, independent of the current sort, so which cell
    // is gold never changes just because you're looking at a different order.
    const maxOf = key => list.reduce((m,e)=>Math.max(m,e[key]), 0);
    const maxRings = maxOf("rings"), maxYards = maxOf("yards"), maxRating = maxOf("rating"),
      maxEarnings = maxOf("earnings"), maxSeasons = maxOf("seasons"), maxTd = maxOf("td");
    const cell = (value, isMax, fmt) => `<td class="tabular${isMax && value>0 ? " tr-record" : ""}">${fmt?fmt(value):value}</td>`;
    const rows = sorted.map(e=>`<tr>
        <td>${svgEscape(e.name)} <span style="color:var(--ink-muted);">— ${svgEscape(e.decade)}</span></td>
        <td>${svgEscape(e.verdict)}</td>
        ${cell(e.seasons, e.seasons===maxSeasons)}
        ${cell(e.rings, e.rings===maxRings)}
        ${cell(e.yards, e.yards===maxYards, v=>v.toLocaleString())}
        ${cell(e.td, e.td===maxTd)}
        ${cell(e.rating, e.rating===maxRating, v=>v.toFixed(1))}
        ${cell(e.earnings, e.earnings===maxEarnings, v=>fmtMoney(v))}
        <td><button type="button" class="btn-ghost-inline" data-card-id="${e.id}">Card</button></td>
      </tr>`).join("");
    return `<div class="table-wrap">
        <table class="league-table">
          <thead><tr><th>QB</th><th>Verdict</th><th class="tabular">Seasons</th><th class="tabular">Rings</th><th class="tabular">Pass Yds</th><th class="tabular">TD</th><th class="tabular">Rating</th><th class="tabular">Earnings</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="calc-refnote" style="margin-top:0.6rem;">Gold cells mark this browser's all-time record in that column. ${list.length} career${list.length===1?"":"s"} logged (last ${TROPHY_ROOM_CAP} kept).</div>`;
  }

  /* ================= Exportable Baseball Card =================
     A flippable trading-card visual for one completed career (Trophy Room entry shape --
     see saveTrophyRoomEntry above). Built ENTIRELY as inline SVG (front and back faces, each a
     self-contained "0 0 400 560" viewBox string) rather than HTML/CSS, specifically so the exact
     same markup can be (a) dropped into the DOM for the on-screen flip view and (b) serialized
     straight into a data:image/svg+xml URI for the PNG export -- no html2canvas or any other
     library involved, same "no chart library, just plain SVG strings" convention as the radar
     chart / sparkline / bracket renderers above. Because the export path re-parses this markup
     in an isolated (non-page) SVG context, it can't resolve the app's CSS custom properties
     (var(--gold) etc.) or guarantee the Google Fonts are loaded there -- so every color below is a
     literal hex (see CARD_HEX), and font-family lists a system fallback first for the export to
     degrade gracefully; the on-screen version still looks identical since it's the same string. */
  const CARD_HEX = { gold:"#D4AF37", goldStrong:"#E8C860", ink:"#ECF2EC", inkMuted:"#8CA096",
    surface:"#1A2622", surfaceRaised:"#202F29", bg:"#12181B", leather:"#B08D2E", line:"rgba(236,242,236,0.18)" };
  const CARD_FONT_DISPLAY = "Oswald, Arial Narrow, Impact, sans-serif";
  const CARD_FONT_BODY = "Libre Franklin, -apple-system, Segoe UI, sans-serif";
  const CARD_RARITY = {
    "Out of the League": { border:"#5b564f", label:"COMMON" },
    "Camp Arm": { border:"#5b564f", label:"COMMON" },
    "Journeyman": { border:"#8a8377", label:"COMMON" },
    "Longtime Starter": { border:"#B08D2E", label:"UNCOMMON" },
    "Hall of Very Good": { border:"#c9cdd6", label:"RARE" },
    "Hall of Famer": { border:"#D4AF37", label:"LEGENDARY" },
    "First-Ballot Hall of Famer": { border:"#E8C860", label:"HOLO" },
  };
  function cardRarityFor(verdict){ return CARD_RARITY[verdict] || CARD_RARITY["Journeyman"]; }
  const CARD_EXIT_LINES = {
    waived: "Released — and the phone never rang again.",
    age: "Played until his body wouldn't let him anymore.",
    banned: "Banned from the league.",
    injury: "Forced out by injury.",
    retired: "Walked away on his own terms.",
  };
  function cardExitLine(exitReason){ return CARD_EXIT_LINES[exitReason] || "Career complete."; }

  function cardIconSVG(iconKey, x, y, size, color){
    return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${BADGE_ICONS[iconKey]||BADGE_ICONS.star}</svg>`;
  }
  // Every achievement shown on a card is, by definition, one this career actually earned -- no
  // locked state to represent here, so this is a single flat gold-medallion style, not the
  // tiered/multi-shape frame the old equip system used.
  function cardAchievementGlyphSVG(def, cx, cy){
    const r = 18;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${CARD_HEX.goldStrong}" stroke="${CARD_HEX.gold}" stroke-width="1.5"/>${cardIconSVG(def.icon, cx-11, cy-11, 22, "#1c1a17")}`;
  }

  function cardCenteredText(x, y, text, opts={}){
    const { size=16, weight=600, color=CARD_HEX.ink, font=CARD_FONT_BODY, letterSpacing=0, anchor="middle" } = opts;
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${color}"${letterSpacing?` letter-spacing="${letterSpacing}"`:""}>${svgEscape(text)}</text>`;
  }
  function cardTruncate(text, max){ return text.length>max ? text.slice(0,max-1)+"…" : text; }
  // Wraps a short label onto (at most) 2 lines, breaking at the nearest space at-or-before
  // maxPerLine rather than mid-word -- several achievement names (e.g. "No One Circles the
  // Wagons") are too long for a single line at grid-cell width, but read fine split in half.
  function cardWrapTwoLines(text, maxPerLine){
    if(text.length<=maxPerLine) return [text];
    let splitAt = -1;
    for(let i=Math.min(maxPerLine, text.length-1); i>0; i--){ if(text[i]===" "){ splitAt=i; break; } }
    if(splitAt===-1) splitAt = maxPerLine;
    const line1 = text.slice(0,splitAt).trim();
    let line2 = text.slice(splitAt).trim();
    if(line2.length>maxPerLine) line2 = line2.slice(0,maxPerLine-1)+"…";
    return [line1, line2];
  }

  function buildCardFaceSVG(entry, side){
    const rarity = cardRarityFor(entry.verdict);
    const glow = rarity.label==="HOLO" || rarity.label==="LEGENDARY";
    const nameSize = entry.name.length>18 ? 26 : entry.name.length>13 ? 30 : 34;
    const bg = `<defs>
        <linearGradient id="cardBg-${side}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${CARD_HEX.surfaceRaised}"/>
          <stop offset="100%" stop-color="${CARD_HEX.bg}"/>
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="392" height="552" rx="20" fill="url(#cardBg-${side})" stroke="${rarity.border}" stroke-width="${glow?5:3}"/>
      ${glow ? `<rect x="9" y="9" width="382" height="542" rx="16" fill="none" stroke="${rarity.border}" stroke-width="1" opacity="0.5"/>` : ""}
      <rect x="300" y="20" width="84" height="22" rx="11" fill="rgba(0,0,0,0.35)" stroke="${rarity.border}" stroke-width="1"/>
      ${cardCenteredText(342, 35, rarity.label, {size:11, weight:800, color:rarity.border, font:CARD_FONT_DISPLAY, letterSpacing:1, anchor:"middle"})}`;

    if(side==="front"){
      const teamsLine = cardTruncate(entry.teams && entry.teams.length ? entry.teams.join(" → ") : "—", 44);
      const trophyBits = [];
      if(entry.mvps) trophyBits.push(`${entry.mvps}x MVP`);
      if(entry.allPros) trophyBits.push(`${entry.allPros}x All-Pro`);
      if(entry.proBowls) trophyBits.push(`${entry.proBowls}x Pro Bowl`);
      const trophyLine = trophyBits.length ? trophyBits.join("  ·  ") : "No accolades logged";
      const statBoxes = [
        ["SEASONS", entry.seasons],
        ["RINGS", entry.rings],
        ["PASS YDS", entry.yards.toLocaleString()],
        ["PASS TD", entry.td],
        ["INT", entry.int],
        ["RATING", entry.rating.toFixed(1)],
      ];
      const gridX = 40, gridY = 366, boxW = 106, boxH = 66, gapX = 8, gapY = 8;
      const statHtml = statBoxes.map((s,i)=>{
        const col = i%3, row = Math.floor(i/3);
        const x = gridX + col*(boxW+gapX), y = gridY + row*(boxH+gapY);
        return `<rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="8" fill="rgba(255,255,255,0.04)" stroke="${CARD_HEX.line}" stroke-width="1"/>
          ${cardCenteredText(x+boxW/2, y+24, String(s[0]), {size:10, weight:700, color:CARD_HEX.inkMuted, font:CARD_FONT_DISPLAY, letterSpacing:0.5})}
          ${cardCenteredText(x+boxW/2, y+50, String(s[1]), {size:20, weight:800, color:CARD_HEX.ink, font:CARD_FONT_DISPLAY})}`;
      }).join("");
      return `<svg viewBox="0 0 400 560" xmlns="http://www.w3.org/2000/svg">
          ${bg}
          ${cardCenteredText(200, 82, cardTruncate(entry.name,22), {size:nameSize, weight:800, font:CARD_FONT_DISPLAY, letterSpacing:0.5})}
          ${cardCenteredText(200, 106, `${entry.college||"—"} · Class of ${entry.draftYear}`, {size:13, color:CARD_HEX.inkMuted})}
          ${cardCenteredText(200, 128, teamsLine, {size:12, color:CARD_HEX.goldStrong})}
          <circle cx="200" cy="210" r="58" fill="rgba(212,175,55,0.08)" stroke="${CARD_HEX.gold}" stroke-width="2.5"/>
          ${cardCenteredText(200, 202, "PEAK OVERALL", {size:10, weight:700, color:CARD_HEX.inkMuted, font:CARD_FONT_DISPLAY, letterSpacing:1})}
          ${cardCenteredText(200, 238, String(entry.peakOverall||Math.round(entry.rating)), {size:42, weight:800, color:CARD_HEX.gold, font:CARD_FONT_DISPLAY})}
          ${cardCenteredText(200, 296, entry.verdict, {size:14, weight:700, color:CARD_HEX.ink, font:CARD_FONT_DISPLAY})}
          ${cardCenteredText(200, 318, trophyLine, {size:11, color:CARD_HEX.inkMuted})}
          ${statHtml}
          ${cardCenteredText(200, 540, "GRIDIRON LAB", {size:10, weight:700, color:CARD_HEX.inkMuted, font:CARD_FONT_DISPLAY, letterSpacing:2})}
        </svg>`;
    }

    // ----- back face -----
    // entry.achievements is an array of keys (current shape); entry.equippedBadges is the older,
    // pre-rework shape (array of {key,tier} from the 3-slot equip system) -- read defensively so a
    // card saved before this round still renders instead of showing nothing.
    const earnedKeys = entry.achievements || (entry.equippedBadges||[]).map(b=>b.key) || [];
    const earnedDefs = earnedKeys.map(k=>achievementDefFor(k)).filter(Boolean);
    const GRID_COLS = 4, GRID_ROWS = 3, MAX_GRID = GRID_COLS*GRID_ROWS;
    const shown = earnedDefs.slice(0, MAX_GRID);
    const overflow = earnedDefs.length - shown.length;
    const cellW = 88, cellH = 76, startX = 68, startY = 118;
    const achHtml = shown.length ? shown.map((def,i)=>{
      const col = i%GRID_COLS, row = Math.floor(i/GRID_COLS);
      const cx = startX + col*cellW, cy = startY + row*cellH;
      const lines = cardWrapTwoLines(def.name, 15);
      const labelHtml = lines.map((line,li)=> cardCenteredText(cx, cy+30+li*11, line, {size:8, weight:700, color:CARD_HEX.ink})).join("");
      return `${cardAchievementGlyphSVG(def, cx, cy)}${labelHtml}`;
    }).join("") : cardCenteredText(200, 150, "No achievements earned this career.", {size:12, color:CARD_HEX.inkMuted});
    const overflowHtml = overflow>0 ? cardCenteredText(200, startY+GRID_ROWS*cellH-6, `+${overflow} more`, {size:10, weight:700, color:CARD_HEX.goldStrong}) : "";
    let y = 340;
    const infoLines = [];
    infoLines.push(["DRAFTED", entry.draftLine ? entry.draftLine.replace(/^\d{4}:\s*/,"") : "Undrafted"]);
    infoLines.push(["HOW IT ENDED", cardExitLine(entry.exitReason)]);
    if(entry.relationshipLine) infoLines.push(["OFF THE FIELD", entry.relationshipLine]);
    const infoHtml = infoLines.map(([label, text])=>{
      const html = `${cardCenteredText(200, y, label, {size:10, weight:700, color:CARD_HEX.goldStrong, font:CARD_FONT_DISPLAY, letterSpacing:1})}
        ${cardCenteredText(200, y+20, cardTruncate(text,52), {size:13, color:CARD_HEX.ink})}`;
      y += 56;
      return html;
    }).join("");
    return `<svg viewBox="0 0 400 560" xmlns="http://www.w3.org/2000/svg">
        ${bg}
        ${cardCenteredText(200, 60, "CAREER FILE", {size:14, weight:700, color:CARD_HEX.inkMuted, font:CARD_FONT_DISPLAY, letterSpacing:2})}
        ${cardCenteredText(200, 82, `ACHIEVEMENTS EARNED (${earnedDefs.length})`, {size:10, weight:700, color:CARD_HEX.inkMuted, font:CARD_FONT_DISPLAY, letterSpacing:1})}
        ${achHtml}
        ${overflowHtml}
        ${infoHtml}
        ${cardCenteredText(200, 540, `${entry.name} — ${entry.decade}`, {size:10, weight:700, color:CARD_HEX.inkMuted, font:CARD_FONT_DISPLAY, letterSpacing:1})}
      </svg>`;
  }

  function openBaseballCard(entry){
    const overlay = document.getElementById("baseballCardOverlay");
    if(!overlay || !entry) return;
    overlay.innerHTML = `<div class="card-scene">
        <button type="button" class="be-close card-close" id="cardCloseBtn" aria-label="Close">×</button>
        <div class="card-flip" id="cardFlip">
          <div class="card-face card-front">${buildCardFaceSVG(entry,"front")}</div>
          <div class="card-face card-back">${buildCardFaceSVG(entry,"back")}</div>
        </div>
        <div class="card-actions">
          <button type="button" class="btn btn-ghost" id="cardFlipBtn">Flip card</button>
          <button type="button" class="btn btn-leather" id="cardExportBtn">Save as image</button>
        </div>
        <div class="card-export-status" id="cardExportStatus"></div>
      </div>`;
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden","false");
    const flipEl = overlay.querySelector("#cardFlip");
    overlay.querySelector("#cardCloseBtn").addEventListener("click", closeBaseballCard);
    overlay.querySelector("#cardFlipBtn").addEventListener("click", ()=> flipEl.classList.toggle("flipped"));
    flipEl.addEventListener("click", ()=> flipEl.classList.toggle("flipped"));
    overlay.querySelector("#cardExportBtn").addEventListener("click", (e)=>{ e.stopPropagation(); exportBaseballCard(entry); });
  }
  function closeBaseballCard(){
    const overlay = document.getElementById("baseballCardOverlay");
    if(!overlay) return;
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden","true");
    overlay.innerHTML = "";
  }
  function exportBaseballCard(entry){
    const status = document.getElementById("cardExportStatus");
    const front = buildCardFaceSVG(entry,"front");
    const back = buildCardFaceSVG(entry,"back");
    const combined = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="1140" viewBox="0 0 400 1140">
        <rect width="400" height="1140" fill="${CARD_HEX.bg}"/>
        <g>${front}</g>
        <g transform="translate(0,580)">${back}</g>
      </svg>`;
    try{
      const svgDataUri = "data:image/svg+xml;charset=utf-8;base64," + btoa(unescape(encodeURIComponent(combined)));
      const img = new Image();
      img.onload = ()=>{
        const scale = 2;
        const canvas = document.createElement("canvas");
        canvas.width = 400*scale; canvas.height = 1140*scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pngUrl = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = `${entry.name.replace(/[^a-z0-9]+/gi,"_")}_card.png`;
        document.body.appendChild(a); a.click(); a.remove();
        if(status) status.textContent = "Saved.";
      };
      img.onerror = ()=>{ if(status) status.textContent = "Couldn't export an image in this browser — try a different browser."; };
      img.src = svgDataUri;
    }catch(e){
      if(status) status.textContent = "Couldn't export an image in this browser — try a different browser.";
    }
  }

  // ----- Local build profile: the practical version of "player accounts" on a platform with no
  // sign-in and no per-account server storage (the Artifact runtime only exposes a single SHARED
  // document, downloads, and MCP -- there's no viewer-identity capability to build real accounts
  // on). This remembers the player's last completed combine build on THIS browser/device only, so
  // returning to the game doesn't mean starting completely from scratch -- not a login, no
  // cross-device sync, just continuity for the one person actually sitting at this browser.
  // Same safeStorage/in-memory-fallback pattern as loadBest/saveBest above, for the same reason:
  // some embedded/preview contexts silently block real localStorage.
  let _sessionLastBuild = null;
  function loadLastBuildProfile(){
    if(_sessionLastBuild) return _sessionLastBuild;
    if(!store) return null;
    try{ const raw = store.getItem("gridironlab.lastbuild"); return raw ? JSON.parse(raw) : null; }catch(e){ return null; }
  }
  function saveLastBuildProfile(picks){
    // cs.picks holds live player object references (whole QBS entries) -- only the handful of
    // fields finishCombine()/computeCombineScore() and the roster-list/radar UI actually need get
    // serialized, not the full historical-player object graph.
    const serial = picks.map(p=>({ attr:p.attr, key:p.key, value:p.value, decade:p.decade,
      playerName:p.player.name, playerTeam:p.player.team }));
    const obj = { picks: serial, savedAt: Date.now() };
    _sessionLastBuild = obj;
    if(!store) return;
    try{ store.setItem("gridironlab.lastbuild", JSON.stringify(obj)); }catch(e){}
  }
  function relativeTimeAgo(ms){
    const diffSec = Math.max(0, Math.round((Date.now()-ms)/1000));
    if(diffSec<60) return "just now";
    const diffMin = Math.round(diffSec/60);
    if(diffMin<60) return `${diffMin} minute${diffMin===1?"":"s"} ago`;
    const diffHr = Math.round(diffMin/60);
    if(diffHr<24) return `${diffHr} hour${diffHr===1?"":"s"} ago`;
    const diffDay = Math.round(diffHr/24);
    if(diffDay<30) return `${diffDay} day${diffDay===1?"":"s"} ago`;
    const diffMonth = Math.round(diffDay/30);
    if(diffMonth<12) return `${diffMonth} month${diffMonth===1?"":"s"} ago`;
    const diffYear = Math.round(diffMonth/12);
    return `${diffYear} year${diffYear===1?"":"s"} ago`;
  }
  function renderLastBuildStrip(){
    const el = document.getElementById("lastBuildStrip");
    if(!el) return;
    const saved = loadLastBuildProfile();
    if(!saved || !saved.picks || !saved.picks.length){ el.style.display="none"; return; }
    const score = computeCombineScore(saved.picks).score;
    const g = gradeFor(score);
    el.style.display="flex";
    el.innerHTML = `Last build: <b>${score}</b> (${svgEscape(g.flavor)}) — saved ${relativeTimeAgo(saved.savedAt)} on this browser <button type="button" class="btn-ghost-inline" id="loadLastBuildBtn">Resume this build →</button>`;
    const btn = document.getElementById("loadLastBuildBtn");
    if(btn) btn.addEventListener("click", loadLastBuildIntoCombine);
  }
  function loadLastBuildIntoCombine(){
    const saved = loadLastBuildProfile();
    if(!saved || !saved.picks || !saved.picks.length) return;
    cs.picks = saved.picks.map(sp=>({
      attr: sp.attr, key: sp.key, value: sp.value, decade: sp.decade,
      player: { name: sp.playerName, team: sp.playerTeam },
    }));
    finishCombine();
  }

  // ----- In-progress career save/resume: on a native mobile shell the OS can kill a backgrounded
  // tab far more readily than a desktop browser ever would, and until now a career lived ONLY in
  // memory (`career`/`build` above) -- closing or losing the app mid-career meant starting over.
  // Checkpointed once per season (see playSeasonAndRender) rather than continuously, since that's
  // the one point in the whole career-advance chain where state is simple and stable: no mid-event
  // choice pending, no animation half-played. `build` is saved alongside `career` because it's a
  // separate top-level variable that developAttributes mutates over time -- career.originalBuild
  // is only the frozen draft-day snapshot, not the current attributes.
  function saveActiveCareer(){
    if(!store || !career) return;
    try{ store.setItem("gridironlab.activeCareer", JSON.stringify({ career, build, savedAt: Date.now() })); }catch(e){}
  }
  function loadActiveCareer(){
    if(!store) return null;
    try{ const raw = store.getItem("gridironlab.activeCareer"); return raw ? JSON.parse(raw) : null; }catch(e){ return null; }
  }
  function clearActiveCareer(){
    if(!store) return;
    try{ store.removeItem("gridironlab.activeCareer"); }catch(e){}
  }
  function renderActiveCareerStrip(){
    const el = document.getElementById("activeCareerStrip");
    if(!el) return;
    const saved = loadActiveCareer();
    if(!saved || !saved.career || !saved.career.seasonLog || !saved.career.seasonLog.length){ el.style.display="none"; return; }
    const c = saved.career;
    const lastSeason = c.seasonLog[c.seasonLog.length-1];
    el.style.display="flex";
    el.innerHTML = `In progress: <b>${svgEscape(c.name)}</b>, ${teamNameAt(c.teamId, c.year)} · Age ${c.age} · ${c.seasonLog.length} season${c.seasonLog.length===1?"":"s"} played — saved ${relativeTimeAgo(saved.savedAt)} <button type="button" class="btn-ghost-inline" id="resumeCareerBtn">Resume career →</button>`;
    const btn = document.getElementById("resumeCareerBtn");
    if(btn) btn.addEventListener("click", ()=> resumeActiveCareer(saved, lastSeason));
  }
  function resumeActiveCareer(saved, lastSeason){
    career = saved.career;
    build = saved.build;
    showScreen("career");
    updateHeaderCareerTicker();
    renderSeasonCard(lastSeason);
  }

  // Key Moment mini-game toggle: off by default (an explicit opt-in for a new, still-being-tested
  // mechanic) and persisted the same way as the sound preference, with an in-memory fallback for
  // the same storage-blocked contexts _sessionBest exists for.
  let _sessionKeyMoments = null;
  const KeyMomentSettings = {
    isEnabled(){
      if(_sessionKeyMoments!==null) return _sessionKeyMoments;
      if(!store) return false;
      try{ return store.getItem("gridironlab.keymoments")==="on"; }catch(e){ return false; }
    },
    setEnabled(v){
      _sessionKeyMoments = !!v;
      if(!store) return;
      try{ store.setItem("gridironlab.keymoments", v?"on":"off"); }catch(e){}
    },
  };

  /* ----- sound: small procedural Web Audio cues (no audio files, nothing licensed) — a rising
     horn-stab swell for the draft night reveal, and a retirement chime whose warmth and length
     scale with how the career actually graded out. Muted by default the instant the tab is
     backgrounded is unnecessary since nothing loops; a single header toggle covers it. ----- */
  const SFX = (()=>{
    let ctx = null, enabled = true;
    try{ const saved = store && store.getItem("gridironlab.sound"); if(saved==="off") enabled=false; }catch(e){}
    function getCtx(){
      if(!enabled) return null;
      if(!ctx){ try{ const AC = window.AudioContext || window.webkitAudioContext; if(AC) ctx = new AC(); }catch(e){ ctx = null; } }
      if(ctx && ctx.state==="suspended"){ ctx.resume().catch(()=>{}); }
      return ctx;
    }
    function tone(freq, startAt, dur, opts={}){
      const c = getCtx(); if(!c) return;
      const osc = c.createOscillator(); const gain = c.createGain();
      osc.type = opts.type || "triangle";
      osc.frequency.setValueAtTime(freq, c.currentTime+startAt);
      if(opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, c.currentTime+startAt+dur);
      const peak = opts.gain!=null ? opts.gain : 0.11;
      gain.gain.setValueAtTime(0.0001, c.currentTime+startAt);
      gain.gain.exponentialRampToValueAtTime(peak, c.currentTime+startAt+Math.min(0.03,dur*0.25));
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime+startAt+dur);
      osc.connect(gain); gain.connect(c.destination);
      osc.start(c.currentTime+startAt); osc.stop(c.currentTime+startAt+dur+0.02);
    }
    return {
      isEnabled(){ return enabled; },
      setEnabled(v){ enabled=v; try{ store && store.setItem("gridironlab.sound", v?"on":"off"); }catch(e){} },
      draftHorn(){
        // a quick three-note brass-ish stab, landing on the tonic — "you're drafted"
        tone(220, 0.00, 0.22, { type:"sawtooth", gain:0.09 });
        tone(277.18, 0.05, 0.22, { type:"sawtooth", gain:0.09 });
        tone(329.63, 0.11, 0.40, { type:"sawtooth", gain:0.12 });
        tone(440, 0.11, 0.40, { type:"triangle", gain:0.07 });
      },
      retirement(tier){
        // ordinal tiers, worst to best — richer/longer chime the more storied the career
        const order = ["Out of the League","Camp Arm","Journeyman","Longtime Starter","Hall of Very Good","Hall of Famer","First-Ballot Hall of Famer"];
        const idx = Math.max(0, order.indexOf(tier));
        if(idx<=1){
          // quiet, a little wistful — a short descending pair
          tone(311.13, 0.00, 0.5, { type:"sine", gain:0.07, slideTo:246.94 });
          tone(246.94, 0.35, 0.6, { type:"sine", gain:0.06 });
        } else if(idx<=3){
          // solid, workmanlike — a simple settled two-note close
          tone(293.66, 0.00, 0.4, { type:"triangle", gain:0.08 });
          tone(392.00, 0.18, 0.55, { type:"triangle", gain:0.09 });
        } else {
          // Hall of Fame-tier — a full ascending chord swell
          [261.63, 329.63, 392.00, 523.25].forEach((f,i)=> tone(f, i*0.09, 0.9, { type:"triangle", gain:0.085 }));
          tone(523.25, 0.55, 0.7, { type:"sine", gain:0.06, slideTo:659.25 });
        }
      },
    };
  })();
  function initSoundToggle(){
    const btn = document.getElementById("soundToggleBtn");
    if(!btn) return;
    const sync = ()=>{
      const on = SFX.isEnabled();
      btn.textContent = on ? "🔊" : "🔇";
      btn.classList.toggle("muted", !on);
      btn.setAttribute("aria-pressed", on ? "true":"false");
      btn.title = on ? "Sound on — click to mute" : "Sound off — click to unmute";
    };
    btn.addEventListener("click", ()=>{ SFX.setEnabled(!SFX.isEnabled()); sync(); });
    sync();
  }
  function initKeyMomentsToggle(){
    const box = document.getElementById("keyMomentsToggle");
    if(!box) return;
    box.checked = KeyMomentSettings.isEnabled();
    box.addEventListener("change", ()=> KeyMomentSettings.setEnabled(box.checked));
  }

  /* ================= Screens ================= */
  const screens = {
    menu: document.getElementById("screen-menu"),
    draft: document.getElementById("screen-draft"),
    results: document.getElementById("screen-results"),
    careerSetup: document.getElementById("screen-career-setup"),
    draftnight: document.getElementById("screen-draftnight"),
    career: document.getElementById("screen-career"),
    careerSummary: document.getElementById("screen-career-summary"),
    trophyroom: document.getElementById("screen-trophyroom"),
  };
  function showScreen(name){
    Object.values(screens).forEach(s=>s.classList.remove("active"));
    screens[name].classList.add("active");
    window.scrollTo({top:0, behavior:"auto"});
  }

  /* ================= Combine state ================= */
  const MAX_AD_RESPINS_PER_COMBINE = 3;
  let cs = {
    mode: "classic",
    order: [],
    round: 0,
    picks: [],
    currentDecade: null,
    currentCandidates: [],
    respinEraLeft: 1,
    respinPlayersLeft: 1,
    // Ad-earned respins: a shared pool spendable on EITHER respin button (see renderRound/click
    // handlers below), separate from the one free respin-of-each the combine already grants.
    bonusRespinLeft: 0,
    adWatchesUsed: 0,
  };

  const modeHelpText = {
    classic: "Classic shows every rating up front. Pick with the numbers in front of you.",
    blind: "Blind hides the ratings. Pick on name, team, and reputation — the grade reveals after you choose.",
  };
  document.querySelectorAll(".mode-toggle button").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      document.querySelectorAll(".mode-toggle button").forEach(b=>{ b.classList.remove("active"); b.setAttribute("aria-checked","false"); });
      btn.classList.add("active"); btn.setAttribute("aria-checked","true");
      cs.mode = btn.dataset.mode;
      document.getElementById("modeHelp").textContent = modeHelpText[cs.mode];
    });
  });

  function renderBestStrip(){
    const best = loadBest();
    const el = document.getElementById("bestStrip");
    if(!best.score){ el.style.display="none"; return; }
    el.style.display="flex";
    el.innerHTML = `Best combine grade <b>${best.score}</b> (${best.grade}) — best career: <b>${best.careerVerdict || "—"}</b>`;
  }

  document.getElementById("startBtn").addEventListener("click", startCombine);
  document.getElementById("brandHome").addEventListener("click", ()=>{ renderBestStrip(); renderLastBuildStrip(); renderActiveCareerStrip(); showScreen("menu"); });
  document.getElementById("playAgainBtn").addEventListener("click", startCombine);

  function startCombine(){
    cs.order = shuffle(ATTRIBUTES);
    cs.round = 0;
    cs.picks = [];
    // Respins are a scarce resource for the WHOLE combine, not a per-round freebie: one respin of
    // the round's era and one respin of its player options, total, across all 12 rounds.
    cs.respinEraLeft = 1;
    cs.respinPlayersLeft = 1;
    cs.bonusRespinLeft = 0;
    cs.adWatchesUsed = 0;
    renderYardTicks();
    showScreen("draft");
    beginRound();
  }

  function renderYardTicks(){
    const el = document.getElementById("yardTicks");
    el.innerHTML = cs.order.map((a,i)=>`<span id="tick-${i}">${a.key}</span>`).join("");
    document.getElementById("roundTotal").textContent = cs.order.length;
  }

  function decadePool(decade){ return QBS.filter(p=>p.decade===decade); }

  function beginRound(){
    cs.currentDecade = pick(DECADES);
    rollCandidates();
    renderRound();
  }
  function rollCandidates(){
    const pool = decadePool(cs.currentDecade);
    cs.currentCandidates = shuffle(pool).slice(0, Math.min(4, pool.length));
  }
  function renderRound(){
    const attr = cs.order[cs.round];
    document.getElementById("draftPosLabel").textContent = "Quarterback Combine · " + (cs.mode==="blind" ? "Blind" : "Classic");
    document.getElementById("draftAttrLabel").textContent = attr.label;
    document.getElementById("roundNum").textContent = cs.round+1;
    document.getElementById("eraPill").textContent = cs.currentDecade;

    const pct = (cs.round/cs.order.length)*100;
    document.getElementById("yardFill").style.width = pct+"%";
    cs.order.forEach((a,i)=>{ const t=document.getElementById("tick-"+i); if(t) t.classList.toggle("done", i<cs.round); });

    const eraBtn = document.getElementById("respinEraBtn");
    const playersBtn = document.getElementById("respinPlayersBtn");
    eraBtn.disabled = cs.respinEraLeft<=0 && cs.bonusRespinLeft<=0;
    playersBtn.disabled = (cs.respinPlayersLeft<=0 && cs.bonusRespinLeft<=0) || decadePool(cs.currentDecade).length<=cs.currentCandidates.length;
    document.getElementById("respinEraCount").textContent = "("+(cs.respinEraLeft+cs.bonusRespinLeft)+")";
    document.getElementById("respinPlayersCount").textContent = "("+(cs.respinPlayersLeft+cs.bonusRespinLeft)+")";
    renderWatchAdRespinBtn();

    renderCards();
  }
  function renderCards(){
    const attr = cs.order[cs.round];
    const grid = document.getElementById("cardGrid");
    grid.innerHTML = "";
    cs.currentCandidates.forEach(player=>{
      const val = eraNormalizedValue(player, attr.key);
      const card = document.createElement("button");
      card.type = "button";
      card.className = "player-card";
      const statBlock = cs.mode==="blind"
        ? `<p class="pc-blind">Rating hidden — go with your gut.</p>`
        : `<div class="pc-stat"><span class="pc-stat-label">${attr.label}</span><span class="meter"><span class="meter-fill" style="width:${val}%"></span></span><span class="pc-value tabular">${val}</span></div>`;
      card.innerHTML = `
        <div class="pc-top">
          <div><div class="pc-name">${player.name}</div><div class="pc-meta">${player.team} · ${player.years}</div></div>
          <span class="pc-era">${player.decade}</span>
        </div>
        ${statBlock}`;
      card.addEventListener("click", ()=> choosePlayer(player, val, attr));
      grid.appendChild(card);
    });
  }
  function choosePlayer(player, val, attr){
    cs.picks.push({ attr: attr.label, key: attr.key, player, value: val, decade: player.decade });
    cs.round++;
    if(cs.round >= cs.order.length) finishCombine(); else beginRound();
  }
  document.getElementById("respinEraBtn").addEventListener("click", ()=>{
    if(cs.respinEraLeft>0) cs.respinEraLeft--;
    else if(cs.bonusRespinLeft>0) cs.bonusRespinLeft--;
    else return;
    const others = DECADES.filter(d=>d!==cs.currentDecade);
    cs.currentDecade = pick(others);
    rollCandidates();
    renderRound();
  });
  document.getElementById("respinPlayersBtn").addEventListener("click", ()=>{
    if(cs.respinPlayersLeft>0) cs.respinPlayersLeft--;
    else if(cs.bonusRespinLeft>0) cs.bonusRespinLeft--;
    else return;
    rollCandidates();
    renderRound();
  });

  function renderWatchAdRespinBtn(){
    const adBtn = document.getElementById("watchAdRespinBtn");
    if(!adBtn) return;
    const label = adBtn.querySelector(".ad-respin-label");
    const badge = document.getElementById("bonusRespinBadge");
    const adsLeft = MAX_AD_RESPINS_PER_COMBINE - cs.adWatchesUsed;
    adBtn.disabled = adsLeft<=0;
    label.textContent = adsLeft>0 ? "Watch Ad for Bonus Reroll" : "No bonus rerolls left this combine";
    badge.textContent = adsLeft>0 ? `(${adsLeft} left)` : "";
  }
  document.getElementById("watchAdRespinBtn").addEventListener("click", async ()=>{
    if(cs.adWatchesUsed >= MAX_AD_RESPINS_PER_COMBINE) return;
    const adBtn = document.getElementById("watchAdRespinBtn");
    adBtn.disabled = true;
    const completed = await showRewardedAd({ rewardLabel: "Bonus Reroll" });
    if(completed){
      cs.adWatchesUsed++;
      cs.bonusRespinLeft++;
    }
    renderRound();
  });

  // A combine score sits on the exact same 0-99 raw scale as an attribute value, and every
  // attribute at a flat 65 is this game's defined "league average" (see the neutral baseline used
  // throughout computeEffOverall/neutralOverall). So these labels are calibrated AROUND 65, not
  // around the 0-98 clamp range gradeFor's inputs can technically span -- a 62 sits BELOW league
  // average and has to read that way (not "Pro Bowl"), and the marquee tiers (Pro Bowl, All-Pro,
  // Hall of Fame, GOAT) are pushed up to where they're actually rare, mirroring how few real NFL
  // starters ever sniff a Pro Bowl nod, let alone Canton. More levels than before, too, so the
  // long middle of the distribution (most builds land somewhere in C/B territory) doesn't get
  // flattened into one bucket.
  function gradeFor(score){
    if(score>=94) return {grade:"S",  flavor:"GOAT-Tier Build"};
    if(score>=89) return {grade:"A+", flavor:"Hall of Fame Build"};
    if(score>=84) return {grade:"A",  flavor:"All-Pro Build"};
    if(score>=79) return {grade:"A-", flavor:"Pro Bowl Build"};
    if(score>=74) return {grade:"B+", flavor:"Borderline Pro Bowler"};
    if(score>=69) return {grade:"B",  flavor:"Above-Average Starter"};
    if(score>=63) return {grade:"C+", flavor:"Average Starter"};
    if(score>=56) return {grade:"C",  flavor:"Below-Average Starter"};
    if(score>=48) return {grade:"D+", flavor:"Fringe Starter"};
    if(score>=40) return {grade:"D",  flavor:"Backup-Caliber"};
    if(score>=32) return {grade:"D-", flavor:"Camp Body"};
    return {grade:"F", flavor:"Cut Day"};
  }
  function computeCombineScore(picks){
    const values = picks.map(p=>p.value);
    const avg = values.reduce((a,b)=>a+b,0)/values.length;
    const variance = values.reduce((a,b)=>a+Math.pow(b-avg,2),0)/values.length;
    const std = Math.sqrt(variance);
    const balancePenalty = std*0.55;
    const floorBonus = Math.min(...values)>=85 ? 2 : 0;
    const raw = avg - balancePenalty + floorBonus;
    return { score: Math.round(clamp(raw,0,98)), avg: Math.round(avg*10)/10, std: Math.round(std*10)/10, balancePenalty: Math.round(balancePenalty*10)/10, floorBonus };
  }

  let build = null; // {key: value, ...} — the finished prospect
  let lastCombine = null;

  function finishCombine(){
    const result = computeCombineScore(cs.picks);
    const g = gradeFor(result.score);
    lastCombine = { result, grade: g };
    build = {};
    cs.picks.forEach(p=> build[p.key] = p.value);
    saveLastBuildProfile(cs.picks);

    document.getElementById("resultScore").textContent = result.score;
    document.getElementById("resultGrade").innerHTML = `<b>${g.grade}</b>`;
    document.getElementById("resultFlavor").textContent = g.flavor;
    document.getElementById("resultBreakdown").innerHTML = `
      Average <b class="tabular">${result.avg}</b><br>
      Balance penalty <b class="tabular">-${result.balancePenalty}</b><br>
      Floor bonus <b class="tabular">+${result.floorBonus}</b>`;

    const best = loadBest();
    const newBestBadge = document.getElementById("newBestBadge");
    if(!best.score || result.score > best.score){
      best.score = result.score; best.grade = g.grade;
      saveBest(best);
      newBestBadge.innerHTML = `<span class="new-best">New personal best</span>`;
    } else newBestBadge.innerHTML = "";

    const rosterList = document.getElementById("rosterList");
    rosterList.innerHTML = cs.picks.map(p=>`
      <div class="roster-row">
        <span class="roster-attr">${p.attr}</span>
        <span class="roster-player"><span class="rp-name">${p.player.name}</span><br><span class="rp-meta">${p.player.team} · ${p.decade}</span></span>
        <span class="roster-meter meter"><span class="meter-fill" style="width:${p.value}%"></span></span>
        <span class="roster-value tabular">${p.value}</span>
      </div>`).join("");

    document.getElementById("scoutingOverallLabel").textContent = result.score;
    const radarAttrs = cs.picks.map(p=>({ key:p.key, label:p.attr, value:p.value }));
    document.getElementById("scoutingRadar").innerHTML = renderRadarChartSVG(radarAttrs) +
      `<div class="radar-legend">
        <span>Best: <b>${radarAttrs.slice().sort((a,b)=>b.value-a.value)[0].label}</b></span>
        <span>Weakest: <b>${radarAttrs.slice().sort((a,b)=>a.value-b.value)[0].label}</b></span>
      </div>`;

    showScreen("results");
  }

  document.getElementById("shareBtn").addEventListener("click", ()=>{
    const lines = [
      `GRIDIRON LAB — QB build`,
      `Combine grade: ${lastCombine.result.score}/100 (${lastCombine.grade.grade} · ${lastCombine.grade.flavor})`,
      ...cs.picks.map(p=>`${p.attr}: ${p.player.name} (${p.decade}) — ${p.value}`),
      window.location.href,
    ];
    copyText(lines.join("\n"), document.getElementById("shareBtn"));
  });
  function copyText(text, btn){
    const done = ()=>{ const old=btn.textContent; btn.textContent="Copied!"; setTimeout(()=>btn.textContent=old, 1600); };
    if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(done).catch(()=>window.prompt("Copy:", text)); }
    else window.prompt("Copy:", text);
  }

  /* ================= Career setup ================= */
  let chosenDecade = null;
  let chosenDecadeWasRandom = false;
  function renderDecadeGrid(){
    const grid = document.getElementById("decadeGrid");
    grid.innerHTML = "";
    const randomCard = document.createElement("button");
    randomCard.type = "button";
    randomCard.className = "decade-card decade-card-random" + (chosenDecadeWasRandom ? " selected" : "");
    randomCard.innerHTML = `<div class="dc-label">🎲 Random Decade</div><div class="dc-blurb">Let the league office pick your era for you.</div>
      <div class="dc-facts">${chosenDecadeWasRandom ? "Landed on " + chosenDecade : "Any of the seven eras, evenly"}</div>`;
    randomCard.addEventListener("click", ()=>{
      chosenDecade = pick(DECADES); chosenDecadeWasRandom = true;
      renderDecadeGrid(); document.getElementById("enterDraftNightBtn").disabled=false;
    });
    grid.appendChild(randomCard);
    const rec = build ? recommendedDecadeInfo(build) : null;
    DECADES.forEach(d=>{
      const league = LEAGUE[d];
      const card = document.createElement("button");
      card.type="button";
      card.className = "decade-card" + (chosenDecade===d && !chosenDecadeWasRandom ? " selected":"");
      let recBadge = "";
      if(rec && rec.decades.includes(d)){
        const reasons = rec.reasonsByDecade[d];
        const title = reasons ? `Rewards your strongest attributes: ${reasons.join(", ")}` : `This build's specific attribute profile tests best in the ${d}.`;
        recBadge = `<div class="dc-recommend" title="${title.replace(/"/g,"&quot;")}">🎯 Recommended for your build</div>`;
      }
      card.innerHTML = `<div class="dc-label">${d}</div>${recBadge}<div class="dc-blurb">${DECADE_BLURB[d]}</div>
        <div class="dc-facts">${league.games}-game season · ${fmtPct(league.comp)} lg. completion</div>
        <div class="dc-era-lean" title="${(ERA_LEAN_WHY[d]||"").replace(/"/g,"&quot;")}">${eraFavorText(d)}</div>`;
      card.addEventListener("click", ()=>{ chosenDecade=d; chosenDecadeWasRandom=false; renderDecadeGrid(); document.getElementById("enterDraftNightBtn").disabled=false; });
      grid.appendChild(card);
    });
  }
  document.getElementById("goProBtn").addEventListener("click", ()=>{
    renderDecadeGrid();
    renderIdentityPanel();
    showScreen("careerSetup");
  });
  document.getElementById("backToResultsBtn").addEventListener("click", ()=> showScreen("results"));

  /* ----- identity panel: prefill with random defaults every time career setup is entered,
     but never clobber text the user already typed in this session. ----- */
  let identity = { name: "", college: "", hometown: null };
  function renderIdentityPanel(){
    const nameInput = document.getElementById("identityNameInput");
    const collegeInput = document.getElementById("identityCollegeInput");
    const hometownValue = document.getElementById("identityHometownValue");
    if(!identity.name) identity.name = randomFullName();
    if(!identity.college) identity.college = randomCollege();
    if(!identity.hometown) identity.hometown = randomHometown();
    nameInput.value = identity.name;
    collegeInput.value = identity.college;
    hometownValue.textContent = `${identity.hometown.city}, ${identity.hometown.state}`;
    const dl = document.getElementById("collegeList");
    if(!dl.childElementCount) dl.innerHTML = COLLEGES.map(c=>`<option value="${c}"></option>`).join("");
  }
  document.getElementById("identityNameInput").addEventListener("input", (e)=>{ identity.name = e.target.value; });
  document.getElementById("identityCollegeInput").addEventListener("input", (e)=>{ identity.college = e.target.value; });
  document.getElementById("identityHometownRerollBtn").addEventListener("click", ()=>{
    identity.hometown = randomHometown();
    document.getElementById("identityHometownValue").textContent = `${identity.hometown.city}, ${identity.hometown.state}`;
  });
  document.getElementById("identityRerollAllBtn").addEventListener("click", ()=>{
    identity.name = randomFullName();
    identity.college = randomCollege();
    identity.hometown = randomHometown();
    renderIdentityPanel();
  });

  /* ================= Career state ================= */
  let career = null;
  let lastFinishedCareerEntry = null; // trophy-room-entry-shaped snapshot of the career just finished, for "View Trading Card" on the HOF screen

  /* ----- contracts & money ----- */
  const CONTRACT_SCALE = {
    "1960s": { rookie:{1:42000,  2:24000,  4:14000,   6:9000,    udfa:6500},   vet:{elite:280000,    good:90000,    average:45000,   backup:22000,   minimum:12000} },
    "1970s": { rookie:{1:95000,  2:48000,  4:26000,   6:16000,   udfa:11000},  vet:{elite:500000,    good:150000,   average:80000,   backup:38000,   minimum:20000} },
    "1980s": { rookie:{1:420000, 2:190000, 4:105000,  6:62000,   udfa:42000},  vet:{elite:1800000,   good:700000,   average:350000,  backup:150000,  minimum:80000} },
    "1990s": { rookie:{1:2300000,2:950000, 4:420000,  6:210000,  udfa:150000}, vet:{elite:5500000,   good:2800000,  average:1400000, backup:600000,  minimum:300000} },
    "2000s": { rookie:{1:6200000,2:1850000,4:720000,  6:390000,  udfa:280000}, vet:{elite:13000000,  good:7000000,  average:3500000, backup:1500000, minimum:650000} },
    "2010s": { rookie:{1:4200000,2:1650000,4:780000,  6:520000,  udfa:430000}, vet:{elite:24000000,  good:15000000, average:7000000, backup:2500000, minimum:895000} },
    "2020s": { rookie:{1:8600000,2:2900000,4:1250000, 6:880000,  udfa:780000}, vet:{elite:50000000,  good:32000000, average:15000000,backup:5000000, minimum:1100000} },
  };
  function rookieAPY(decade, round){
    const t = CONTRACT_SCALE[decade].rookie;
    if(round<=0) return t.udfa;
    if(round===1) return t[1];
    if(round<=3) return t[2];
    if(round<=5) return t[4];
    return t[6];
  }
  function veteranAPY(decade, tier){ return CONTRACT_SCALE[decade].vet[tier]; }
  function performanceTier(effOverall){
    if(effOverall>=82) return "elite";
    if(effOverall>=70) return "good";
    if(effOverall>=58) return "average";
    if(effOverall>=46) return "backup";
    return "minimum";
  }
  function fmtMoney(n){
    if(n>=1000000) return "$"+(Math.round(n/100000)/10).toFixed(1).replace(/\.0$/,"")+"M";
    return "$"+Math.round(n/1000)+"K";
  }
  // Signed number for legible "Effect:" lines on event cards -- always shows the sign so a delta
  // of 0 (or a positive number without a leading "+") never reads as ambiguous.
  function fmtDelta(n){ return (n>0?"+":"") + n; }

  /* ----- era style: the same build plays differently depending on when it lands -----
     Grounded in real scheme/rule history, not a smooth gradient:
     - MOB/IMP/PKT peak in the 1960s-70s: minimal pass-protection coaching and defenses that
       teed off on the passer meant scrambling for your life was a survival skill, not a system.
       They bottom out in the 2000s "prototypical pocket passer" era (Manning/Brady/Brees), the
       peak of West Coast/Erhardt-Perkins timing offenses that had zero use for a QB who left the
       pocket, then rebound hard in the 2010s-2020s as zone-read/RPO and now full dual-threat
       schemes (Kaepernick/Wilson through Mahomes/Allen/Jackson/Hurts) make mobility a premium,
       coached, MVP-caliber trait again -- not a fallback, a weapon.
     - DUR (the attribute) is deliberately left UN-adjusted -- it's treated as a personal, timeless
       "how tough is this specific guy" trait, not something that goes up or down with the calendar.
       The era's actual danger level lives entirely in the separate "injury" multiplier below (which
       checkInjuryThenPlay() applies on top of the DUR-driven base chance): leather-era/pre-facemark
       -contact-rule brutality made every 60s/70s QB a walking injury risk, and each subsequent decade
       of player-safety legislation (roughing-the-passer, horse-collar, low hits, targeting) made the
       position steadily safer to play. Keeping these two separate matters: an earlier draft of this
       table also boosted the DUR *attribute* upward in dangerous eras, which silently fought the
       injury multiplier's own math (a higher effective DUR lowers injury chance in the formula) and
       made the 1960s come out safer than the 2020s once both factors combined -- exactly backwards.
     - TCH/ANT are almost absent in the 1960s-70s -- anticipation/timing passing as a coached
       system didn't really exist before Bill Walsh's West Coast offense took hold after the 1978
       rule changes opened up the passing game -- then climb through the 80s-2000s and hold at a
       high plateau through today, since once that coaching lineage took over the league it never
       left.
     - DEC (protecting the ball, reading coverage) trends mildly upward with better film study and
       coaching infrastructure decade over decade; PKT beyond its 60s/70s peak settles into a
       gentle climb as offensive lines got better-coached, dipping slightly in the pure pocket-passer
       2000s where elite protection let some QBs get away with average pocket feel.
     - SHA, DAC, REL, CLU are left unadjusted as timeless fundamentals -- arm talent, accuracy,
       and clutch composure aren't era-contingent the way scheme-driven traits are. */
  const ERA_ATTR_MULT = {
    "1960s": {ARM:1.15, MOB:1.20, IMP:1.05, PKT:1.10, TCH:0.70, ANT:0.75, DEC:0.95, injury:1.45},
    "1970s": {ARM:1.12, MOB:1.15, IMP:1.05, PKT:1.20, TCH:0.72, ANT:0.78, DEC:0.92, injury:1.40},
    "1980s": {ARM:1.05, MOB:1.00, IMP:0.95, PKT:1.05, TCH:1.05, ANT:1.05, DEC:1.00, injury:1.15},
    "1990s": {ARM:1.00, MOB:1.05, IMP:1.00, PKT:1.00, TCH:1.05, ANT:1.05, DEC:1.10, injury:1.05},
    "2000s": {ARM:0.98, MOB:0.85, IMP:0.90, PKT:0.95, TCH:1.10, ANT:1.10, DEC:1.08, injury:1.00},
    "2010s": {ARM:0.97, MOB:1.05, IMP:1.05, PKT:0.92, TCH:1.10, ANT:1.10, DEC:1.05, injury:0.92},
    "2020s": {ARM:0.95, MOB:1.25, IMP:1.15, PKT:0.90, TCH:1.08, ANT:1.08, DEC:1.05, injury:0.85},
  };
  function eraAdjust(eff, decade){
    const mult = ERA_ATTR_MULT[decade] || {};
    const out = {};
    ATTR_KEYS.forEach(k=> out[k] = clamp(Math.round(eff[k]*(mult[k]||1)), 10, 99));
    return out;
  }
  // Human-readable "this era favors X, hurts Y" hint for the decade picker, derived straight from
  // the same multiplier table the sim actually plays by (see ERA_ATTR_MULT above) -- so the hint
  // is never at odds with what actually happens on the field.
  function eraFavorText(decade){
    const mult = ERA_ATTR_MULT[decade] || {};
    const up = [], down = [];
    ATTR_KEYS.forEach(k=>{
      const m = mult[k]; if(m==null) return;
      const label = (ATTR_BY_KEY[k]||{}).label || k;
      if(m>=1.05) up.push(label); else if(m<=0.95) down.push(label);
    });
    if(!up.length && !down.length) return "League-average across the board — no era lean.";
    const parts = [];
    if(up.length) parts.push(`favors ${up.join(", ")}`);
    if(down.length) parts.push(`hurts ${down.join(", ")}`);
    return parts.join(" · ").replace(/^./, c=>c.toUpperCase());
  }

  /* ----- Recommended Decade (item #9): which era(s) this SPECIFIC build's attribute profile is
     rewarded by, isolated from raw overall talent. This deliberately does NOT go through
     effectiveAttr()/eraEffective() -- those read live career state (career.tempBoosts, via
     activeBoostDelta) that doesn't exist yet at the pre-draft build screen (career is still null
     there). No temp boosts pre-career means re-deriving the same age+era math directly against a
     supplied build is exactly equivalent, just without the career dependency. -----*/
  function decadeFitEdge(buildObj, decade, age){
    const eff = {}, neutral = {};
    ATTR_KEYS.forEach(k=>{
      if(k==="DUR"){ eff[k]=clamp(buildObj[k],10,99); neutral[k]=65; return; }
      const mult = ageMultiplier(ATTR_BY_KEY[k].group, age);
      eff[k] = clamp(Math.round(clamp(buildObj[k],10,99)*mult), 15, 99);
      neutral[k] = clamp(Math.round(65*mult), 15, 99);
    });
    const effEra = eraAdjust(eff, decade), neutralEra = eraAdjust(neutral, decade);
    return weighted(effEra, OVERALL_WEIGHTS) - weighted(neutralEra, OVERALL_WEIGHTS);
  }
  const DECADE_FIT_REF_AGE = 29; // "prime" age -- see PRIME_CURVE -- used purely as a consistent
  // yardstick to compare the seven eras against each other, not a claim about any specific season.
  function computeDecadeFit(buildObj){
    const scores = {};
    DECADES.forEach(d=> scores[d] = decadeFitEdge(buildObj, d, DECADE_FIT_REF_AGE));
    return scores;
  }
  // A build only gets tagged when an era's edge is both the best AND meaningfully era-driven --
  // a flat, balanced build (every attribute near 65) will show a near-zero edge everywhere and
  // correctly gets no recommendation at all, rather than an arbitrary tie-break.
  const DECADE_FIT_MIN_EDGE = 1.5;
  const DECADE_FIT_TIE_MARGIN = 1.0;
  function recommendedDecadeInfo(buildObj){
    if(!buildObj) return null;
    const scores = computeDecadeFit(buildObj);
    const ranked = DECADES.slice().sort((a,b)=> scores[b]-scores[a]);
    const topScore = scores[ranked[0]];
    if(topScore < DECADE_FIT_MIN_EDGE) return { decades: [], scores };
    const decades = ranked.filter(d=> scores[d] >= topScore-DECADE_FIT_TIE_MARGIN).slice(0,2);
    const topAttrs = ATTR_KEYS.filter(k=>k!=="DUR").slice().sort((a,b)=> buildObj[b]-buildObj[a]).slice(0,4);
    const reasonsByDecade = {};
    decades.forEach(d=>{
      const mult = ERA_ATTR_MULT[d]||{};
      const favored = topAttrs.filter(k=> (mult[k]||1)>=1.05).map(k=>ATTR_BY_KEY[k].label);
      reasonsByDecade[d] = favored.length ? favored : null;
    });
    return { decades, scores, reasonsByDecade };
  }
  // One-sentence "why" behind each decade's lean, surfaced as a hover tooltip on the decade card
  // so the hint reads as researched reasoning, not an arbitrary dial.
  const ERA_LEAN_WHY = {
    "1960s": "Minimal pass protection and defenses that teed off on the passer made scrambling a survival skill; timing/anticipation passing as a coached system didn't exist yet.",
    "1970s": "The most brutal, hit-everything era for QBs (pre-facemask-contact and roughing rules); offenses were still run-first and ad-libbed, not built around rhythm passing.",
    "1980s": "Bill Walsh's West Coast offense (post-1978 rule changes) spreads across the league, rewarding timing and anticipation for the first time; the game starts getting safer.",
    "1990s": "Timing passing is now mainstream and decision-making is coached hard; the position is safer than the 70s-80s but still well short of modern protections.",
    "2000s": "The prototypical pocket-passer golden age (Manning/Brady/Brees) — offenses are built entirely around staying in the pocket, so mobility and scrambling instinct are actively undervalued.",
    "2010s": "Kaepernick/RG3/Wilson-era zone-read and RPO schemes bring coached mobility back into style, while player-safety rules keep compounding.",
    "2020s": "The Mahomes/Allen/Jackson/Hurts dual-threat renaissance makes mobility and improvisation MVP-caliber traits, not a fallback — while targeting/roughing rules make this the safest era to play in.",
  };

  /* ----- coaching schemes: every team plays a real, named offensive system, and that system
     rewards a different build than the raw attribute grades alone would suggest — the exact same
     architecture as ERA_ATTR_MULT/eraAdjust above (a per-attribute multiplier table, applied on
     TOP of the era adjustment, DUR deliberately excluded for the same reason DUR is excluded from
     the era table: it's a personal toughness trait, not something a playbook changes). Each team
     is assigned one scheme at draft time (see the teamScheme map built alongside leagueStrength)
     and it persists until a coaching change rolls a new one (see ORG_EVENTS' coachfired/newgm
     handling). Applying the same multiplier to both the player's effective attributes AND the
     neutral/league-average baseline (see neutralEffective below) is what makes "fit" emergent
     instead of a separate bolt-on system: a scheme that discounts arm strength makes a cannon arm
     matter less AND makes a weak arm cost less, exactly like a real playbook would. */
  const SCHEMES = [
    { id:"westcoast", name:"West Coast Offense",
      blurb:"Bill Walsh's system: short, high-percentage timing routes and yards after the catch instead of the deep ball. Built around anticipation and touch, not arm strength.",
      mult:{TCH:1.14, DEC:1.08, ANT:1.10, ARM:0.88} },
    { id:"airraid", name:"Air Raid",
      blurb:"The Mumme/Leach spread-and-shred system: four or five wide, high-volume quick passing, spacing over power. Rewards accuracy and a fast release over pocket craft.",
      mult:{SHA:1.12, TCH:1.08, DAC:1.06, PKT:0.87} },
    { id:"verticalshot", name:"Vertical Shot Offense",
      blurb:"An Air Coryell-style downfield system built on timed deep shots and one-on-one matchups. Arm talent and the composure to keep taking shots matter more than a clean pocket read.",
      mult:{ARM:1.15, IMP:1.10, CLU:1.06, DEC:0.90} },
    { id:"powerrun", name:"Power/Gap Run & Play-Action",
      blurb:"An under-center, run-first system that sets up defenses for shot plays off play-action. Rewards a QB who reads the pocket and takes the play as designed, not one who has to improvise.",
      mult:{PKT:1.12, DEC:1.08, CLU:1.05, IMP:0.88} },
    { id:"rpo", name:"RPO / Spread Option",
      blurb:"The zone-read/run-pass-option system that came out of the college spread: the QB reads a defender post-snap and decides run or pass on the fly. Mobility and improvisation are the whole point.",
      mult:{MOB:1.16, IMP:1.12, ANT:1.06, PKT:0.85} },
    { id:"prostyle", name:"Pro-Style Balanced",
      blurb:"A traditional under-center mix of run and pass with no single defining wrinkle. Rewards a steady, fundamentally sound pocket passer over a scrambler.",
      mult:{PKT:1.08, DAC:1.06, DEC:1.06, MOB:0.90} },
    { id:"erhardtperkins", name:"Erhardt-Perkins",
      blurb:"The Patriots-lineage, concept-based system: the same handful of plays run from a dozen different formations, so the offense lives on the QB's recognition and processing speed.",
      mult:{ANT:1.12, DEC:1.10, TCH:1.08, ARM:0.90} },
    { id:"widezone", name:"Wide Zone & Boot-Action",
      blurb:"The Shanahan-lineage outside-zone run game paired with rollout/boot passing off it. Rewards mobility and touch on the move over standing in a clean pocket.",
      mult:{MOB:1.10, IMP:1.08, TCH:1.06, PKT:0.88} },
  ];
  function schemeAdjust(eff, schemeId){
    const scheme = SCHEMES.find(s=>s.id===schemeId);
    const mult = scheme ? scheme.mult : {};
    const out = {};
    ATTR_KEYS.forEach(k=> out[k] = clamp(Math.round(eff[k]*(mult[k]||1)), 10, 99));
    return out;
  }
  // Human-readable "this scheme favors X, hurts Y" hint, derived from the same multiplier table
  // the sim actually plays by — the same technique as eraFavorText above.
  function schemeFavorText(schemeId){
    const scheme = SCHEMES.find(s=>s.id===schemeId);
    if(!scheme) return "";
    const up = [], down = [];
    ATTR_KEYS.forEach(k=>{
      const m = scheme.mult[k]; if(m==null) return;
      const label = (ATTR_BY_KEY[k]||{}).label || k;
      if(m>=1.05) up.push(label); else if(m<=0.95) down.push(label);
    });
    const parts = [];
    if(up.length) parts.push(`favors ${up.join(", ")}`);
    if(down.length) parts.push(`hurts ${down.join(", ")}`);
    return parts.join(" · ").replace(/^./, c=>c.toUpperCase());
  }

  function draftSlotFor(score){
    if(score>=72) return { round:1, pickLo:1, pickHi:10, label:"Round 1 — Top 10" };
    if(score>=62) return { round:1, pickLo:11, pickHi:32, label:"Round 1" };
    if(score>=52) return { round:randInt(2,3), pickLo:33, pickHi:96, label:"Day 2" };
    if(score>=42) return { round:randInt(4,5), pickLo:97, pickHi:170, label:"Day 3" };
    if(score>=32) return { round:randInt(6,7), pickLo:171, pickHi:257, label:"Day 3" };
    return { round:0, pickLo:0, pickHi:0, label:"Undrafted Free Agent" };
  }

  document.getElementById("enterDraftNightBtn").addEventListener("click", ()=>{
    const decade = chosenDecade;
    const league = LEAGUE[decade];
    const decadeStart = parseInt(decade,10);
    const draftYear = randInt(decadeStart, decadeStart+9);
    const slot = draftSlotFor(lastCombine.result.score);
    const teamsPool = teamsAvailable(draftYear);
    const team = pick(teamsPool);
    const teamName = teamNameAt(team.id, draftYear);
    const pickLabel = slot.round===0 ? "Signed as an undrafted free agent" : `${slot.label}, Pick ${randInt(slot.pickLo, slot.pickHi)} overall`;
    const rookieApy = rookieAPY(decade, slot.round);

    const leagueStrength = {};
    TEAMS.forEach(t=>{ leagueStrength[t.id] = randInt(30,90); });
    const teamScheme = {};
    TEAMS.forEach(t=>{ teamScheme[t.id] = pick(SCHEMES).id; });

    // blank name/college fields mean "randomize for me" — resolve that at the moment of
    // declaring for the draft, not just at panel-render time, so a deliberately cleared field
    // still gets a real value.
    const playerName = (identity.name||"").trim() || randomFullName();
    const playerCollege = (identity.college||"").trim() || randomCollege();
    const playerHometown = identity.hometown || randomHometown();
    identity.name = playerName; identity.college = playerCollege; identity.hometown = playerHometown;

    career = {
      decade, league, draftYear, slot,
      name: playerName,
      college: playerCollege,
      hometown: playerHometown,
      teamId: team.id,
      draftTeamId: team.id,
      leagueStrength,
      teamStrength: leagueStrength[team.id],
      oline: rollSupportingCastGrade(leagueStrength[team.id]),
      weapons: rollSupportingCastGrade(leagueStrength[team.id]),
      wearAndTear: 0,
      relationship: null,
      achievements: { unlocked:{} },
      teamScheme,
      gmRelationship: 50,
      fanSupport: 50,
      leaguePopularity: 50,
      seasonsWithTeam: 0,
      age: 22,
      year: draftYear,
      seasonNumber: 1,
      seasonLog: [],
      totals: { games:0, comp:0, att:0, yards:0, td:0, int:0, sacks:0, proBowls:0, allPros:0, mvps:0, rings:0, earnings:0, rushYards:0, rushTd:0 },
      contract: { apy: rookieApy, years: 4, tier: "rookie" },
      badStreak: 0,
      forcedOut: false,
      exitReason: null,
      transactions: [ `${draftYear}: ${pickLabel} by the ${teamName}.` ],
      peakSeason: null,
      reputation: 50,
      suspensionSeasonsRemaining: 0,
      injuryLeaveSeasonsRemaining: 0,
      banned: false,
      tempBoosts: [],
      lifeEventLog: [],
      _cutShieldSeasons: 0,
      leagueRivals: [],
      leagueNewsLog: [],
      devSpeed: rollDevSpeed(),
      devCarry: {},
      originalBuild: {...build},
    };
    career.leagueRivals = generateLeagueRivals();

    showScreen("draftnight");
    document.getElementById("draftNightActions").style.visibility = "hidden";
    playDraftNightAnimation(teamName, draftYear, decade, pickLabel, slot);
  });

  function playDraftNightAnimation(teamName, draftYear, decade, pickLabel, slot){
    const card = document.getElementById("draftNightCard");
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const [c1, c2] = teamColors(career.teamId);
    card.innerHTML = `
      <div class="dn-badge cycling" id="dnBadge" style="background:linear-gradient(135deg, var(--surface-raised), var(--surface-raised));"></div>
      <div class="dn-eyebrow">${draftYear} NFL Draft · ${decade}</div>
      <div class="dn-eyebrow" style="margin-top:0.2rem;">${career.name} · ${career.college} · ${career.hometown.city}, ${career.hometown.state}</div>
      <div class="dn-team cycling" id="dnTeamText">On the clock…</div>
      <div class="dn-pick" id="dnPickText" style="visibility:hidden;">${pickLabel}</div>
      <div class="dn-flavor" id="dnFlavorText" style="visibility:hidden;">${draftNightFlavor(slot, lastCombine.grade)}</div>`;
    const teamTextEl = document.getElementById("dnTeamText");
    const badgeEl = document.getElementById("dnBadge");
    const finish = ()=>{
      teamTextEl.textContent = teamName;
      teamTextEl.classList.remove("cycling");
      teamTextEl.classList.add("landed");
      badgeEl.textContent = teamInitials(teamName);
      badgeEl.style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
      badgeEl.classList.remove("cycling");
      badgeEl.classList.add("landed");
      document.getElementById("dnPickText").style.visibility = "visible";
      document.getElementById("dnFlavorText").style.visibility = "visible";
      document.getElementById("draftNightActions").style.visibility = "visible";
      SFX.draftHorn();
    };
    if(reduced){ finish(); return; }
    const decoyPool = teamsAvailable(draftYear).map(t=>teamNameAt(t.id, draftYear)).filter(n=>n!==teamName);
    let i = 0;
    const total = 12;
    const step = ()=>{
      if(i>=total){ finish(); return; }
      teamTextEl.textContent = pick(decoyPool.length?decoyPool:[teamName]);
      badgeEl.textContent = teamInitials(teamTextEl.textContent);
      i++;
      const delay = 90 + i*14; // decelerate
      setTimeout(step, delay);
    };
    step();
  }

  function draftNightFlavor(slot, grade){
    const name = career.name, college = career.college;
    if(slot.round===1 && slot.pickLo===1) return `The cameras find ${name} in the green room. Scouts loved the ${college} tape — ${grade.flavor.toLowerCase()} — and someone just bet a franchise on it.`;
    if(slot.round===1) return `A first-round grade out of ${college}, a late slide, and a locker room that expects ${name} to start soon.`;
    if(slot.round===0) return `No call on draft weekend for the ${college} product. ${name} signs a make-good deal and a shot at a training camp roster spot.`;
    return `A solid combine out of ${college} and a mid-round investment on ${name} — the kind of pick that either starts by year three or bounces to a third team.`;
  }

  document.getElementById("startCareerBtn").addEventListener("click", ()=>{ showScreen("career"); advanceCareer(); });

  /* ----- season generation ----- */
  // temporary attribute nudges from life events (a legend's mentorship, a scheme that fits, a
  // rough offseason) — each entry {key, delta, seasonsLeft}, ticked down once per season and
  // dropped at zero. Kept separate from the permanent build so they never touch the combine card.
  function activeBoostDelta(key){
    return (career.tempBoosts||[]).filter(b=>b.key===key).reduce((sum,b)=>sum+b.delta, 0);
  }
  function tickTempBoosts(){
    if(!career.tempBoosts) return;
    career.tempBoosts.forEach(b=> b.seasonsLeft--);
    career.tempBoosts = career.tempBoosts.filter(b=>b.seasonsLeft>0);
  }
  function effectiveAttr(key, age){
    const group = ATTR_BY_KEY[key].group;
    const boosted = clamp(build[key] + activeBoostDelta(key), 10, 99);
    if(key==="DUR"){
      const mult = age<=33 ? 1 : clamp(1-(age-33)*0.03, 0.55, 1);
      return clamp(Math.round(boosted*mult), 20, 99);
    }
    const mult = ageMultiplier(group, age);
    return clamp(Math.round(boosted*mult), 15, 99);
  }
  function currentEffective(age){
    const eff = {};
    ATTR_KEYS.forEach(k=> eff[k]=effectiveAttr(k, age));
    return eff;
  }

  function weighted(eff, weights){
    let sum=0, wsum=0;
    for(const k in weights){ sum += eff[k]*weights[k]; wsum += weights[k]; }
    return sum/wsum;
  }
  const OVERALL_WEIGHTS = {SHA:0.16,TCH:0.12,DAC:0.12,PKT:0.12,ANT:0.14,DEC:0.14,CLU:0.10,ARM:0.06,REL:0.02,MOB:0.01,IMP:0.01};
  function eraEffective(age, decade){ return eraAdjust(currentEffective(age), decade); }
  // Scheme-adjusted effective attributes: era adjustment first (when/how the game is played),
  // then the current team's coaching scheme on top (what THIS playbook rewards). Used for actual
  // stat production and overall grade; deliberately NOT used for the injury-DUR, infraction-DEC,
  // or Key-Moment-CLU rolls, since those are behavioral/injury mechanics, not stat production.
  function schemeEffective(age, decade, schemeId){ return schemeAdjust(eraEffective(age, decade), schemeId); }
  function computeEffOverall(age, decade){
    const d = decade || decadeForYear(career.year);
    const schemeId = career.teamScheme ? career.teamScheme[career.teamId] : null;
    return weighted(schemeEffective(age, d, schemeId), OVERALL_WEIGHTS);
  }

  // A league-average (65 raw, every attribute) build run through the exact same age curve and
  // era reweighting as the player's actual build. Season stats are driven by the GAP between the
  // player's effective attributes and this neutral baseline, not a flat number — so a rookie's
  // real age-22 penalty (or a harsh era mismatch) doesn't read as "this build is bad," only a
  // genuinely below-average build does.
  function neutralEffective(age, decade, schemeId){
    const eff = {};
    ATTR_KEYS.forEach(k=>{
      if(k==="DUR"){ eff[k]=65; return; }
      const mult = ageMultiplier(ATTR_BY_KEY[k].group, age);
      eff[k] = clamp(Math.round(65*mult), 15, 99);
    });
    const eraAdjusted = eraAdjust(eff, decade);
    return schemeId ? schemeAdjust(eraAdjusted, schemeId) : eraAdjusted;
  }

  /* ----- playoffs & the Super Bowl ----- */
  function scoreForQuarter(off, def){
    // tracks not just points but HOW they were scored (touchdowns vs. field goals) so the box
    // score generated later can be built FROM the actual scoring plays instead of guessing a TD
    // count independently from the point total -- that independence was the root of "team kicked
    // 2 FGs but the player is credited with a TD."
    let pts=0, tds=0, fgs=0;
    const possessions = randInt(2,3);
    for(let i=0;i<possessions;i++){
      const diff = off-def;
      const scoreProb = clamp(0.32+diff*0.006, 0.10, 0.72);
      if(Math.random()<scoreProb){
        if(Math.random()<0.66){ pts+=7; tds++; } else { pts+=3; fgs++; }
      }
    }
    return { pts, tds, fgs };
  }
  function simulateGameScore(offOverall, defOverall){
    const quarters = [];
    let myTotal=0, oppTotal=0, myTds=0, myFgs=0, oppTds=0, oppFgs=0;
    for(let q=1;q<=4;q++){
      const myQ = scoreForQuarter(offOverall, defOverall);
      const oppQ = scoreForQuarter(defOverall, offOverall);
      myTotal+=myQ.pts; oppTotal+=oppQ.pts;
      myTds+=myQ.tds; myFgs+=myQ.fgs; oppTds+=oppQ.tds; oppFgs+=oppQ.fgs;
      quarters.push({ q, myQ: myQ.pts, oppQ: oppQ.pts, myTotal, oppTotal });
    }
    if(myTotal===oppTotal){
      const otTd = Math.random()<0.7;
      const otPts = otTd?6:3;
      if(Math.random() < 0.5 + (offOverall-defOverall)*0.01){ myTotal += otPts; if(otTd) myTds++; else myFgs++; }
      else { oppTotal += otPts; if(otTd) oppTds++; else oppFgs++; }
      quarters.push({ q:"OT", myQ: myTotal-quarters[3].myTotal, oppQ: oppTotal-quarters[3].oppTotal, myTotal, oppTotal });
    }
    return { quarters, myTotal, oppTotal, won: myTotal>oppTotal, myTds, myFgs, oppTds, oppFgs };
  }
  function generateGameBoxScore(season, myPts, myTds){
    const league = LEAGUE[season.decade];
    const perGameAtt = season.games>0 ? season.att/season.games : league.attPerGame;
    const att = Math.max(15, Math.round(perGameAtt * (0.85+Math.random()*0.4)));
    const basePct = season.att>0 ? season.pct : league.comp;
    const pct = clamp(basePct + (Math.random()-0.5)*0.14, 0.32, 0.86);
    const comp = Math.round(att*pct);
    const baseYpa = season.att>0 ? season.yards/season.att : league.ypa;
    const ypa = clamp(baseYpa*(0.8+Math.random()*0.5), 4, 12.5);
    const yards = Math.round(att*ypa);
    const interceptions = Math.random()<0.4 ? randInt(0,2) : 0;
    const perGameRushAtt = season.games>0 ? (season.rushAtt||0)/season.games : 0;
    const rushAtt = Math.max(0, Math.round(perGameRushAtt * (0.7+Math.random()*0.7)));
    const rushYpc = season.rushAtt>0 ? season.rushYards/season.rushAtt : 3.6;
    const rushYards = rushAtt>0 ? Math.round(rushAtt * clamp(rushYpc*(0.7+Math.random()*0.7), 1, 10)) : 0;
    // TDs are drawn from the team's ACTUAL touchdown count this game (tracked in simulateGameScore)
    // rather than re-estimated from the raw point total -- a passing/rushing TD can never be
    // recorded on a game the team won on field goals alone, and the two can never sum to more
    // touchdowns than the team actually scored.
    const teamTds = clamp(myTds||0, 0, 8);
    const rushTd = rushAtt>0 && teamTds>0 && Math.random()<0.18 ? 1 : 0;
    const td = clamp(teamTds - rushTd, 0, 6);
    const perGameSacks = season.games>0 ? (season.sacks||0)/season.games : 2.2;
    const sacks = Math.max(0, Math.round(perGameSacks * (0.4+Math.random()*1.4)));
    return { att, comp, pct: att>0?comp/att:0, yards, td, int: interceptions, sacks, rushAtt, rushYards, rushTd };
  }

  /* ----- regular season: the player's own team-quality-aware, per-game engine -----
     Previously the player's regular-season record came from a single abstracted win% roll
     (flat vs. league, no opponent identity at all) while buildScheduleResults() ran a REAL
     opponent-identity-aware simulation for every OTHER team in the league and then discarded
     its own result for the player, overwriting it with that abstracted number. That was two
     disconnected systems pretending to be one. Now the player gets a real schedule (division
     rivals home-and-home, the rest of the league filling out the slate, same shape
     buildScheduleResults already uses for everyone else), each game resolved by the same
     simulateGameScore() engine the playoffs already use against that specific opponent's real
     team grade, and a per-game stat line sampled around the season's calibrated rates so the
     box scores have real game-to-game texture instead of one deterministic season formula.
     buildScheduleResults' overwrite of the player's row now hands back this real total instead
     of a second, disconnected number. See regularSeasonOffenseGrade (Round 4) for how the
     offensive grade fed into simulateGameScore is now computed -- it blends effOverall with
     career.teamStrength instead of just nudging effOverall by a small team-quality edge. */
  // Real scheduling formulas never redraw the whole "everything else" slate at random every
  // single season -- division rivals are locked in home-and-home every year (handled below), and
  // the rest of the schedule rotates through a fixed cycle of other divisions (one from the same
  // conference, one from the other conference), the pairing changing on a multi-year wheel rather
  // than reshuffling uniformly at random every year. rotationPick is keyed purely off the year (and
  // an offset so the two wheels don't always turn in lockstep), so the same division-vs-division
  // pairing recurs in cycles -- exactly the "makes sense as a real schedule format" structure,
  // without trying to reproduce any one era's exact formula down to the game.
  function rotationPick(divs, cycleYear){
    if(!divs.length) return null;
    return divs[((cycleYear % divs.length) + divs.length) % divs.length];
  }
  function pickRegularSeasonOpponents(n){
    const year = career.year;
    const myDiv = divisionOf(career.teamId, year);
    const rivals = (myDiv ? myDiv.teams : []).filter(id=>id!==career.teamId);
    const others = teamsAvailable(year).map(t=>t.id).filter(id=> id!==career.teamId && !rivals.includes(id));
    const pool = [];
    rivals.forEach(id=>{ pool.push(id); pool.push(id); }); // home-and-home vs. every division rival, same as real scheduling

    const allDivs = myDiv ? divisionsForYear(year) : [];
    const sameConfOthers = allDivs.filter(d=> d.conf===myDiv.conf && d.name!==myDiv.name);
    const otherConfDivs = allDivs.filter(d=> d.conf!==myDiv.conf);
    const sameConfTarget = rotationPick(sameConfOthers, year);
    const otherConfTarget = rotationPick(otherConfDivs, year + Math.ceil(otherConfDivs.length/2));
    const structuredTeams = [
      ...(otherConfTarget ? otherConfTarget.teams : []),
      ...(sameConfTarget ? sameConfTarget.teams : []),
    ].filter(id=> others.includes(id));
    const remainderTeams = others.filter(id=> !structuredTeams.includes(id));

    shuffle(structuredTeams).forEach(id=>{ if(pool.length<n) pool.push(id); });
    shuffle(remainderTeams).forEach(id=>{ if(pool.length<n) pool.push(id); });
    const fillPool = others.length ? others : (rivals.length ? rivals : teamsAvailable(year).map(t=>t.id).filter(id=>id!==career.teamId));
    while(pool.length<n && fillPool.length) pool.push(pick(fillPool));
    return shuffle(pool).slice(0, n);
  }
  function simulateRegularSeasonGames({ gamesPlayed, effOverall, comp, ypa, tdRate, intRate,
      attPerGame, perfMult, effRush, sackRate, age, decade }){
    const opponents = pickRegularSeasonOpponents(gamesPlayed);
    const myOff = regularSeasonOffenseGrade(effOverall, age, decade);
    const games = [];
    let tComp=0,tAtt=0,tYards=0,tTd=0,tInt=0,tSacks=0,tRushAtt=0,tRushYards=0,tRushTd=0,wins=0;
    opponents.forEach((oppId, idx)=>{
      const oppGrade = oppId===career.teamId ? career.teamStrength : (career.leagueStrength[oppId] ?? 60);
      const oppRival = rivalForTeam(oppId);
      const oppOffense = opponentOffenseGrade(oppId, QB_INFLUENCE_REGULAR);
      const scoreSim = simulateGameScore(myOff, oppOffense);
      const won = scoreSim.won;
      if(won) wins++;

      // per-game noise ranges are all built to average to exactly 1.0x the season rate over a
      // full season, so summed game logs land on the same season totals the old single-formula
      // approach produced -- this only adds game-to-game texture, it doesn't change the mean.
      const gAtt = Math.max(4, Math.round(attPerGame*(0.72+Math.random()*0.56)));
      const gComp = clamp(Math.round(gAtt*clamp(comp+(Math.random()-0.5)*0.16, 0.15, 0.97)*perfMult), 0, gAtt);
      const gYards = Math.max(0, Math.round(gAtt*clamp(ypa*(0.7+Math.random()*0.6), 0, 20)*perfMult));
      const gTd = Math.max(0, Math.round(gAtt*clamp(tdRate*(0.3+Math.random()*1.4), 0, 1)*perfMult));
      const gInt = Math.max(0, Math.round(gAtt*clamp(intRate*(0.2+Math.random()*1.6), 0, 1)*(2-perfMult)));
      const gSacks = Math.max(0, Math.round(gAtt*clamp(sackRate*(0.3+Math.random()*1.4), 0, 1)));

      const gRushAttPerGame = clamp((effRush-45)*0.14, 0.2, 9.5);
      const gRushAtt = Math.max(0, Math.round(gRushAttPerGame*(0.5+Math.random()*1.0)));
      const gRushYpc = clamp(3.4 + (effRush-55)*0.045, 1.8, 7.8);
      const gRushYards = gRushAtt>0 ? Math.max(0, Math.round(gRushAtt*gRushYpc*(0.6+Math.random()*0.8)*perfMult)) : 0;
      const gRushTdRate = clamp(0.018 + (effRush-55)*0.0006, 0.004, 0.09);
      const gRushTd = gRushAtt>0 && Math.random()<gRushTdRate*gRushAtt ? 1 : 0;

      tComp+=gComp; tAtt+=gAtt; tYards+=gYards; tTd+=gTd; tInt+=gInt; tSacks+=gSacks;
      tRushAtt+=gRushAtt; tRushYards+=gRushYards; tRushTd+=gRushTd;

      games.push({ week: idx+1, opponentId: oppId, opponentName: teamNameAt(oppId, career.year),
        opponentGrade: Math.round(oppGrade),
        opponentQbId: oppRival ? oppRival.id : null,
        opponentQbName: oppRival ? oppRival.name : null,
        opponentQbOverall: oppRival ? rivalEffTalent(oppRival) : null,
        won, myScore: scoreSim.myTotal, oppScore: scoreSim.oppTotal,
        comp: gComp, att: gAtt, yards: gYards, td: gTd, int: gInt, sacks: gSacks,
        rushAtt: gRushAtt, rushYards: gRushYards, rushTd: gRushTd });
    });
    return { games, comp:tComp, att:tAtt, yards:tYards, td:tTd, int:tInt, sacks:tSacks,
      rushAtt:tRushAtt, rushYards:tRushYards, rushTd:tRushTd, wins, losses: gamesPlayed-wins };
  }

  /* ----- league-wide standings: EVERY team's non-player games are resolved through a shared,
     correlated schedule — division rivals play each other twice, and every other game is
     drawn once and applied to both teams at once — instead of each team rolling its own
     independent win total. That's what keeps division records internally consistent (a team
     that goes 0-16 guarantees its rivals at least 2 wins each, so a same-division 1-15 next
     to it is no longer possible). The player's own team is overwritten with its REAL record
     (starter + backup starts combined) afterward. Division winners + best-record wildcards
     seed the playoffs, so a team's seed and its "made/missed" status can never contradict
     each other, and both the bracket shape and the division map are era-accurate by year. ----- */
  function simpleWinProb(aStrength, bStrength){ return clamp(0.5 + (aStrength-bStrength)*0.012, 0.06, 0.94); }
  function simpleGameWinner(idA, sA, idB, sB){ return Math.random() < simpleWinProb(sA, sB) ? idA : idB; }

  function buildScheduleResults(season){
    const year = season.year;
    const gamesN = LEAGUE[season.decade].games;
    const divs = divisionsForYear(year);
    const allIds = divs.flatMap(d=>d.teams);
    const wins = {}, losses = {};
    allIds.forEach(id=>{ wins[id]=0; losses[id]=0; });
    const strengthOf = id => id===career.teamId ? career.teamStrength : (career.leagueStrength[id] ?? 60);
    function playGame(a,b){
      const w = simpleGameWinner(a, strengthOf(a), b, strengthOf(b));
      if(w===a){ wins[a]++; losses[b]++; } else { wins[b]++; losses[a]++; }
    }
    // division rivals: home & away, so every result is shared between two teams' ledgers
    divs.forEach(d=>{
      for(let i=0;i<d.teams.length;i++){
        for(let j=i+1;j<d.teams.length;j++){ playGame(d.teams[i], d.teams[j]); playGame(d.teams[i], d.teams[j]); }
      }
    });
    // remaining slate: random cross-matchups, each one resolved once and applied to both sides
    const remaining = {}; allIds.forEach(id=> remaining[id] = Math.max(0, gamesN - (wins[id]+losses[id])));
    let guard = 0;
    while(guard++ < 20000){
      const pool = allIds.filter(id=>remaining[id]>0);
      if(pool.length<2) break;
      const a = pick(pool);
      const cands = pool.filter(id=>id!==a);
      if(!cands.length) break;
      const b = pick(cands);
      playGame(a,b); remaining[a]--; remaining[b]--;
    }
    // odd leftover (can happen with an unpaired final slot) — resolve solo without double-booking
    allIds.forEach(id=>{
      while(remaining[id]>0){
        const opp = pick(allIds.filter(o=>o!==id));
        const w = simpleGameWinner(id, strengthOf(id), opp, strengthOf(opp));
        if(w===id) wins[id]++; else losses[id]++;
        remaining[id]--;
      }
    });
    // overwrite the player's own team with its real, already-simulated record
    wins[career.teamId] = season.teamWins; losses[career.teamId] = season.teamLosses;
    const results = {};
    allIds.forEach(id=>{ const w=wins[id], l=losses[id], t=w+l; results[id] = { id, wins:w, losses:l, winPct: t>0?w/t:0 }; });
    return results;
  }

  function simulateLeagueStandings(season){
    const results = buildScheduleResults(season);
    const format = playoffFormatForYear(season.year);
    const divs = divisionsForYear(season.year);
    const seeded = {};
    for(const c of ["AFC","NFC"]){
      const confDivs = divs.filter(d=>d.conf===c);
      const confTeamIds = confDivs.flatMap(d=>d.teams);
      const winners = confDivs.map(d=> d.teams.map(id=>results[id]).sort((a,b)=>b.winPct-a.winPct)[0]).filter(Boolean);
      const winnerIds = new Set(winners.map(w=>w.id));
      const rest = confTeamIds.filter(id=>!winnerIds.has(id)).map(id=>results[id]).sort((a,b)=>b.winPct-a.winPct);
      seeded[c] = [...winners.slice().sort((a,b)=>b.winPct-a.winPct), ...rest.slice(0, format.wildcards)];
    }
    return { results, seeded, format, divisions: divs };
  }

  // Opponent tendency tags for playoff games: lightweight flavor (and, going forward, the data
  // the Key Moment mini-game reads to build "know they're run-defense heavy" scenarios) rather
  // than a full second team-personality system. One tag is rolled per playoff opponent and
  // stamped onto that round's data so both the paced quarter reveal and the Key Moment mini-game
  // can reference the exact same read on this specific opponent.
  const OPPONENT_TENDENCIES = [
    { id:"runheavy", label:"Run-Heavy Ball Control", blurb:"They'd rather grind the clock on the ground than let this turn into a shootout." },
    { id:"blitzheavy", label:"Blitz-Happy Front", blurb:"They send extra rushers early and dare him to beat it in a hurry." },
    { id:"lockdowncorners", label:"Lockdown Perimeter Corners", blurb:"Their corners play tight, physical man coverage on the outside." },
    { id:"preventlate", label:"Prevent Shell Once Ahead", blurb:"Get a lead on them and they'll drop everyone back, conceding the underneath stuff." },
    { id:"turnoverhunting", label:"Turnover-Hunting Secondary", blurb:"Aggressive, high-risk safeties who jump routes looking for a takeaway." },
    { id:"physicalfront", label:"Physical, Wear-You-Down Front Seven", blurb:"Their front seven hits like it's already the fourth quarter on the first snap." },
    { id:"disciplinedzone", label:"Disciplined Zone Shell", blurb:"Patient zone coverage that rarely bites on a double move." },
    { id:"suddenchange", label:"Feasts on Sudden-Change Possessions", blurb:"Give them a short field off a turnover and they'll make it hurt fast." },
  ];
  function pickOpponentTendency(){ return pick(OPPONENT_TENDENCIES); }

  // General reseeding bracket: pairs the highest remaining seed against the lowest remaining
  // seed each round (real NFL reseeding rules), for however many seeds/byes/wild-card games
  // this year's format calls for — so the exact same routine reproduces the 1970s' no-bye
  // four-team field, the odd 1978-89 shape, and the modern seven-seed bracket alike.
  // Playoff-specific offensive edge, added on top of the player's base effOverall for every
  // postseason game. Two inputs, both centered so a league-average team/player sees no change:
  //  - Team quality: weighted more than twice as heavily here (0.32) as the old flat 0.15 --
  //    a talented roster mattering MORE in January, when the margin for error shrinks and the
  //    opposing defense is playoff-caliber too, is the whole point of this being bigger than the
  //    regular-season figure.
  //  - Clutch: effOverall already folds Clutch in at a flat 10% (OVERALL_WEIGHTS.CLU), same as
  //    every other attribute, all season long -- it doesn't capture that Clutch specifically is
  //    the "plays well under playoff pressure" trait. This adds a second, playoff-only bump for
  //    it on top of that base weighting, on the same logic the Key Moment mini-game already uses
  //    Clutch to gate (see keyMomentChanceFor) -- Clutch should matter more exactly when the
  //    stakes are highest, not just at a flat rate across 17 regular-season games and a Super Bowl
  //    alike.
  // ----- Round 4: team quality now BLENDS with the QB's own grade instead of just nudging it -----
  // Previously team quality was a small additive edge on top of the QB's own effOverall (out to
  // roughly +-10 points at the extremes) -- meaning an elite individual QB's own grade dominated
  // game outcomes almost entirely, and could single-handedly carry a genuinely bad team (a 40s
  // team overall) to a great record and deep playoff runs against much stronger opposition almost
  // regardless of the roster around him. Real football doesn't work that way: the O-line,
  // receivers, and defense are -- in aggregate -- at least as load-bearing on whether a team
  // actually WINS as any one QB's individual talent, however great. blendOffenseWithTeam pulls
  // the offense's effective grade toward the TEAM's overall quality instead of just adding a
  // small edge on top of the QB's own number -- a QB whose personal grade diverges sharply from
  // his team's quality gets pulled hard toward that team's level in EITHER direction: a great QB
  // on a bad team is capped hard (though never erased -- he still meaningfully outperforms what
  // the team alone would do), and a mediocre QB on a stacked team gets propped up, but not fully.
  // QB_INFLUENCE is how much of the blend is still "the QB's own play" -- playoffs weight team
  // quality even MORE than the regular season (a thinner roster and shakier O-line show up hardest
  // when the margin for error disappears in January), matching the existing "team quality matters
  // more in January" principle this system already had via the old edge's bigger playoff coefficient.
  // This does NOT touch how the QB's own passing STATS (yards/TD/rating) are generated -- those
  // still come from effOverall vs. neutralOverall alone (see generateSeason/STAT_BLEND/
  // STAT_SENSITIVITY) -- only the win/loss engine's offensive grade input changes here.
  const QB_INFLUENCE_REGULAR = 0.45;
  const QB_INFLUENCE_PLAYOFF = 0.35;
  function blendOffenseWithTeam(effOverall, teamStrength, qbInfluence){
    return teamStrength + (effOverall-teamStrength)*qbInfluence;
  }
  // A "superteam" doesn't just coast on a high grade forever -- real contenders have to keep
  // paying, replacing, and re-signing to stay one, and that's constant downward pressure a plain
  // random walk never modeled. Every team above this line takes a small pull back toward it each
  // season (see generateSeason's team-strength block), scaled by how far above it they are, so a
  // 90-grade team decays faster than a 78-grade one. The player's own team faces the exact same
  // pull -- the one thing that can outrun it is the QB actually playing at an elite level himself
  // (the existing effOverall-vs-neutral nudge), which is the "team stays great because ITS QB is
  // legitimately elite" case asked for, instead of a dynasty just being free to sit at 95 forever.
  const CONTENDER_DECLINE_THRESHOLD = 76;
  // Diagnostically tuned (see PROGRESS.md-style reasoning in commit notes): 0.05 was far too weak
  // against even a modest positive skill nudge -- ANY QB better than dead-average (even a merely
  // "good," non-elite one) rocketed straight to the 97 hard cap within 2-3 seasons and froze there
  // permanently, exactly the "superteam that never has to work for it" complaint this exists to
  // fix. At 0.22, a zero-nudge average QB's team genuinely bleeds out over a decade, a good QB's
  // team settles into real season-to-season texture in the mid-80s instead of pinning at the cap,
  // a truly elite QB's team plateaus around 90-93 (great, but still has to hold that level, not
  // just arrive at 97 and stop), and a bad team with an elite QB takes a believable ~decade to
  // build into a real contender rather than an instant jump.
  const CONTENDER_DECLINE_RATE = 0.22;
  function contenderDeclinePull(strength){
    return strength>CONTENDER_DECLINE_THRESHOLD ? (strength-CONTENDER_DECLINE_THRESHOLD)*CONTENDER_DECLINE_RATE : 0;
  }
  function regularSeasonOffenseGrade(effOverall, age, decade){
    const clu = eraEffective(age, decade).CLU;
    const clutchEdge = (clu-65)*0.03;
    return blendOffenseWithTeam(effOverall, career.teamStrength, QB_INFLUENCE_REGULAR) + clutchEdge;
  }
  function playoffOffenseGrade(effOverall, season){
    const age = season ? season.age : career.age;
    const decade = season ? season.decade : decadeForYear(career.year);
    const clu = eraEffective(age, decade).CLU;
    const clutchEdge = (clu-65)*0.09;
    return blendOffenseWithTeam(effOverall, career.teamStrength, QB_INFLUENCE_PLAYOFF) + clutchEdge;
  }

  // ----- Opponent side of the blend: every OTHER team already has its own persistent starting QB
  // (career.leagueRivals, one per team, generated at career start and simulated every season for
  // league-wide awards) -- it just never fed into the actual game-sim/win-calc before, so every
  // opponent was a single flat team-strength number with no equivalent "their QB is also great"
  // term. This is the direct fix for both "no grind even at 95 overall" (a genuinely elite rival
  // starter can now swing a game on his own, the same way the player's own QB does) and "let me
  // see the opposing QB's overall" (rivalEffTalent IS that displayed number).
  function rivalForTeam(teamId){
    if(!career.leagueRivals) return null;
    return career.leagueRivals.find(r=>r.teamId===teamId && !r.retired) || null;
  }
  // Unlike rivalForTeam, this also finds RETIRED rivals -- a profile card opened from an old
  // season's schedule/playoff log should still resolve to that season's actual starter, not
  // whoever currently holds the job (or nothing at all, if he's since retired).
  function findRivalById(id){
    if(!career.leagueRivals || !id) return null;
    return career.leagueRivals.find(r=>r.id===id) || null;
  }
  // Age-adjusted the same way a rival's own season stats already are (ageMult in
  // simulateRivalSeasons) -- an aging rival starter shouldn't blend in at his career-peak talent.
  function rivalEffTalent(rival){
    return clamp(Math.round(65 + (rival.talent-65)*primeMultiplier(rival.age)), 20, 99);
  }
  function opponentOffenseGrade(teamId, qbInfluence){
    const teamStrength = teamId===career.teamId ? career.teamStrength : (career.leagueStrength[teamId] ?? 60);
    const rival = rivalForTeam(teamId);
    if(!rival) return teamStrength;
    return blendOffenseWithTeam(rivalEffTalent(rival), teamStrength, qbInfluence);
  }
  // ----- Rival QB profile: a clickable "character page" for any opposing starter, everywhere one
  // is shown by name (Schedule tab, playoff round boxes, League tab standings). Facts are all
  // derived from data the rival already carries -- no separate hand-authored joke pool to keep in
  // sync -- except one genuine easter egg: rivals are named via the same randomFullName() the
  // player's own prospects use, which has its own small chance of landing on one of the Key &
  // Peele draft-name gags (EASTER_EGG_NAMES), and that's worth calling out when it happens.
  function rivalCareerFunFacts(rival){
    const facts = [];
    const seasonsPlayed = rival.seasons.length;
    if(rival.isRival) facts.push(`Drafted the exact same year as you (${rival.draftYear}) — a true draft classmate.`);
    if(EASTER_EGG_NAMES.includes(rival.name)) facts.push(`Yes, that's really his name.`);
    if(seasonsPlayed){
      const best = rival.seasons.reduce((a,b)=> b.rating>a.rating ? b : a, rival.seasons[0]);
      facts.push(`Best season: ${best.year} — ${best.yards.toLocaleString()} yards, ${best.td} TD, a ${best.rating.toFixed(1)} rating.`);
    }
    if(rival.totals.mvps>0) facts.push(`${rival.totals.mvps}-time MVP.`);
    if(rival.totals.allPros>0) facts.push(`${rival.totals.allPros}-time All-Pro.`);
    if(rival.totals.proBowls>0) facts.push(`${rival.totals.proBowls}-time Pro Bowler.`);
    else if(seasonsPlayed>=4) facts.push(`Still hasn't made a Pro Bowl despite ${seasonsPlayed} seasons as a starter.`);
    if(rival.succeededId) facts.push(`Took over the starting job after his predecessor retired.`);
    if(rival.retired){
      const lastYear = seasonsPlayed ? rival.seasons[seasonsPlayed-1].year : rival.draftYear;
      facts.push(`Retired after the ${lastYear} season.`);
    } else {
      facts.push(`Entering year ${seasonsPlayed+1} of his career at age ${rival.age}.`);
    }
    return facts;
  }
  function buildRivalProfileHTML(rival){
    const t = rival.totals;
    const rating = passerRating(t.comp, t.att, t.yards, t.td, t.int);
    const overall = rivalEffTalent(rival);
    const g = gradeFor(clamp(overall, 0, 98));
    const totalGames = t.wins+t.losses;
    const winPct = totalGames>0 ? (t.wins/totalGames*100).toFixed(1) : "0.0";
    const badges = [
      t.mvps ? `<span class="badge gold">${t.mvps}x MVP</span>` : "",
      t.allPros ? `<span class="badge good">${t.allPros}x All-Pro</span>` : "",
      t.proBowls ? `<span class="badge good">${t.proBowls}x Pro Bowl</span>` : "",
    ].join("");
    const facts = rivalCareerFunFacts(rival);
    return `
      <div class="rival-card">
        <div class="rival-eyebrow">${svgEscape(teamNameAt(rival.teamId, career.year))}${rival.retired?" · Retired":""}</div>
        <h3>${svgEscape(rival.name)}</h3>
        <div class="rival-meta">Age ${rival.age} · Drafted ${rival.draftYear} · Overall <b>${overall}</b> (${svgEscape(g.flavor)})</div>
        <div class="rival-stats-grid">
          <div><div class="rv-label">Career Yards</div><div class="rv-value tabular">${t.yards.toLocaleString()}</div></div>
          <div><div class="rv-label">Touchdowns</div><div class="rv-value tabular">${t.td}</div></div>
          <div><div class="rv-label">Interceptions</div><div class="rv-value tabular">${t.int}</div></div>
          <div><div class="rv-label">Rating</div><div class="rv-value tabular">${rating.toFixed(1)}</div></div>
          <div><div class="rv-label">Record</div><div class="rv-value tabular">${t.wins}-${t.losses}${totalGames?` (${winPct}%)`:""}</div></div>
          <div><div class="rv-label">Games</div><div class="rv-value tabular">${t.games}</div></div>
        </div>
        ${badges ? `<div class="rival-badges">${badges}</div>` : ""}
        <div class="rival-facts">
          <div class="rival-facts-label">Fun Facts</div>
          <ul>${facts.map(f=>`<li>${svgEscape(f)}</li>`).join("")}</ul>
        </div>
        <button type="button" class="btn btn-ghost rival-close">Close</button>
      </div>`;
  }
  function openRivalProfile(rivalId){
    const rival = findRivalById(rivalId);
    const overlay = document.getElementById("rivalProfileOverlay");
    if(!rival || !overlay) return;
    overlay.innerHTML = buildRivalProfileHTML(rival);
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    const closeBtn = overlay.querySelector(".rival-close");
    if(closeBtn) closeBtn.addEventListener("click", closeRivalProfile);
  }
  function closeRivalProfile(){
    const overlay = document.getElementById("rivalProfileOverlay");
    if(!overlay) return;
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = "";
  }

  function resolveConferenceBracket(seeds, myTeamId, myOffFn, format, season){
    const rounds = [];
    function playMatch(teamA, teamB, roundLabel){
      if(teamA.id===myTeamId || teamB.id===myTeamId){
        const player = teamA.id===myTeamId ? teamA : teamB;
        const opp = teamA.id===myTeamId ? teamB : teamA;
        const oppStrength = career.leagueStrength[opp.id] ?? 60;
        const oppRival = rivalForTeam(opp.id);
        const oppOffense = opponentOffenseGrade(opp.id, QB_INFLUENCE_PLAYOFF);
        const myOff = playoffOffenseGrade(myOffFn(), season);
        const game = simulateGameScore(myOff, oppOffense);
        rounds.push({
          round: roundLabel, opponent: teamNameAt(opp.id, career.year), mySeed: player.seed, oppSeed: opp.seed,
          myScore: game.myTotal, oppScore: game.oppTotal, won: game.won, quarters: game.quarters,
          box: season ? generateGameBoxScore(season, game.myTotal, game.myTds) : null,
          oppTendency: pickOpponentTendency(), _offOverall: myOff, _defOverall: oppStrength, _defOffense: oppOffense,
          _oppQbId: oppRival ? oppRival.id : null, _oppQbName: oppRival ? oppRival.name : null, _oppQbOverall: oppRival ? rivalEffTalent(oppRival) : null,
        });
        return game.won ? player : opp;
      }
      const sA = career.leagueStrength[teamA.id] ?? 60, sB = career.leagueStrength[teamB.id] ?? 60;
      const winnerId = simpleGameWinner(teamA.id, sA, teamB.id, sB);
      return winnerId===teamA.id ? teamA : teamB;
    }
    const s = seeds.map((t,i)=>({ seed:i+1, id:t.id }));
    const N = s.length;
    if(N<2) return { rounds, champion: s[0] };
    const wcGames = format ? format.wcGames : Math.floor((N-1)/2);
    if(wcGames<=0){
      const champ = playMatch(s[0], s[1] || s[0], "Conference Championship");
      return { rounds, champion: champ };
    }
    const byes = N - 2*wcGames;
    const firstRoundLabel = byes>0 ? "Wild Card" : "Divisional";
    const survivors = [];
    for(let i=0;i<wcGames;i++) survivors.push(playMatch(s[byes+i], s[N-1-i], firstRoundLabel));
    let field = [...s.slice(0,byes), ...survivors].sort((a,b)=>a.seed-b.seed);
    while(field.length>1){
      const roundLabel = field.length>2 ? "Divisional" : "Conference Championship";
      const next = [];
      for(let i=0;i<Math.floor(field.length/2);i++) next.push(playMatch(field[i], field[field.length-1-i], roundLabel));
      field = next.sort((a,b)=>a.seed-b.seed);
    }
    return { rounds, champion: field[0] };
  }

  /* ----- Live, stepwise postseason resolution -----
     The player's OWN playoff run is deliberately never resolved further ahead than the round
     they've actually played. This used to be one synchronous call (resolvePlayoffs simulating
     the ENTIRE bracket, Super Bowl included, before a single quarter had been revealed) -- which
     meant the season card's awards badge could show "Super Bowl Champion" while the playoff boxes
     below it were still mid-reveal, and a Key Moment mini-game later on was pure cosmetics: the
     win/loss for every round, all the way to the Lombardi Trophy, was already locked in before the
     player made a single read.
     Now resolvePlayoffs only generates the very next round the player is part of. Advancing past
     it -- deciding who plays whom next, or whether the run is over -- happens in
     confirmPlayoffRound, called only once that round (Key Moment included) has fully finished
     revealing, using the round's FINAL result. The rest of the bracket (games the player isn't
     in) is still resolved a round at a time alongside them, same as the real NFL: nobody knows the
     Conference Championship matchups until the Wild Card round is actually over. */
  function startConferenceBracket(seeds, format){
    const s = seeds.map((t,i)=>({ seed:i+1, id:t.id }));
    const N = s.length;
    const wcGames = format ? format.wcGames : Math.floor((N-1)/2);
    const byes = N - 2*wcGames;
    return { s, N, wcGames, byes, field: null, _pendingMatches: null, _pendingByeTeams: null };
  }

  function stepConferenceBracket(state, myTeamId, myOffFn, season){
    function simulateMatch(teamA, teamB, roundLabel){
      if(teamA.id===myTeamId || teamB.id===myTeamId){
        const player = teamA.id===myTeamId ? teamA : teamB;
        const opp = teamA.id===myTeamId ? teamB : teamA;
        const oppStrength = career.leagueStrength[opp.id] ?? 60;
        const oppRival = rivalForTeam(opp.id);
        const oppOffense = opponentOffenseGrade(opp.id, QB_INFLUENCE_PLAYOFF);
        const myOff = playoffOffenseGrade(myOffFn(), season);
        const game = simulateGameScore(myOff, oppOffense);
        const round = {
          round: roundLabel, opponent: teamNameAt(opp.id, career.year), mySeed: player.seed, oppSeed: opp.seed,
          myScore: game.myTotal, oppScore: game.oppTotal, won: game.won, quarters: game.quarters,
          box: season ? generateGameBoxScore(season, game.myTotal, game.myTds) : null,
          oppTendency: pickOpponentTendency(), _offOverall: myOff, _defOverall: oppStrength, _defOffense: oppOffense,
          _oppQbId: oppRival ? oppRival.id : null, _oppQbName: oppRival ? oppRival.name : null, _oppQbOverall: oppRival ? rivalEffTalent(oppRival) : null,
        };
        return { isMine:true, player, opp, round };
      }
      const sA = career.leagueStrength[teamA.id] ?? 60, sB = career.leagueStrength[teamB.id] ?? 60;
      const winnerId = simpleGameWinner(teamA.id, sA, teamB.id, sB);
      return { isMine:false, winner: winnerId===teamA.id ? teamA : teamB };
    }

    const { s, N, wcGames, byes } = state;
    if(state.field===null){
      if(N<2){ state.field = s.length ? [s[0]] : []; return { myRound:null, done:true, champion:s[0] }; }
      if(wcGames<=0){
        const m = simulateMatch(s[0], s[1] || s[0], "Conference Championship");
        state._pendingMatches = [m];
        state._pendingByeTeams = [];
        return { myRound: m.isMine ? m.round : null };
      }
      const firstRoundLabel = byes>0 ? "Wild Card" : "Divisional";
      const matches = [];
      for(let i=0;i<wcGames;i++) matches.push(simulateMatch(s[byes+i], s[N-1-i], firstRoundLabel));
      state._pendingMatches = matches;
      state._pendingByeTeams = s.slice(0, byes);
      const mine = matches.find(m=>m.isMine);
      return { myRound: mine ? mine.round : null };
    }

    const field = state.field;
    const roundLabel = field.length>2 ? "Divisional" : "Conference Championship";
    const matches = [];
    for(let i=0;i<Math.floor(field.length/2);i++) matches.push(simulateMatch(field[i], field[field.length-1-i], roundLabel));
    state._pendingMatches = matches;
    state._pendingByeTeams = [];
    const mine = matches.find(m=>m.isMine);
    return { myRound: mine ? mine.round : null };
  }

  // Commits who advances using each match's FINAL result -- for the player's own game, that's
  // round.won AFTER any Key Moment swing, never the pre-swing baseline stepConferenceBracket
  // simulated it with.
  function confirmRoundAdvancement(state){
    const matches = state._pendingMatches || [];
    const survivors = matches.map(m=> m.isMine ? (m.round.won ? m.player : m.opp) : m.winner);
    const field = [...(state._pendingByeTeams||[]), ...survivors].sort((a,b)=>a.seed-b.seed);
    state.field = field;
    state._pendingMatches = null; state._pendingByeTeams = null;
    if(field.length<=1) return { done:true, champion: field[0] };
    return { done:false };
  }

  function buildSuperBowlRound(playoffs, season){
    const otherBracket = resolveConferenceBracket(playoffs._seeded[playoffs._otherConf], "__none__", ()=>0, playoffs._format);
    const otherChampId = otherBracket.champion.id;
    const oppStrength = career.leagueStrength[otherChampId] ?? 60;
    const oppRival = rivalForTeam(otherChampId);
    const oppOffense = opponentOffenseGrade(otherChampId, QB_INFLUENCE_PLAYOFF);
    const myOff = playoffOffenseGrade(playoffs._effOverall, season);
    const game = simulateGameScore(myOff, oppOffense);
    const sbRound = {
      round:"Super Bowl", opponent: teamNameAt(otherChampId, career.year),
      myScore: game.myTotal, oppScore: game.oppTotal, won: game.won,
      quarters: game.quarters, box: generateGameBoxScore(season, game.myTotal, game.myTds),
      oppTendency: pickOpponentTendency(), _offOverall: myOff, _defOverall: oppStrength, _defOffense: oppOffense,
      _oppQbId: oppRival ? oppRival.id : null, _oppQbName: oppRival ? oppRival.name : null, _oppQbOverall: oppRival ? rivalEffTalent(oppRival) : null,
    };
    sbRound._revealedCount = 0; sbRound._keyMomentChecked = false;
    playoffs.rounds.push(sbRound);
  }

  // Advances through the bracket looking for the player's NEXT game. A round the player has a
  // bye in (the top seed(s) skip Wild Card weekend) has nothing uncertain for them -- there's no
  // reveal to wait on -- so it's confirmed immediately and the search continues into the round
  // after it. The moment a round WITH the player in it turns up, it's pushed and this stops, to
  // wait for that round's reveal (Key Moment included) before going any further.
  function advanceToNextPlayoffRound(playoffs, season){
    while(!playoffs.done){
      const step = stepConferenceBracket(playoffs._bracketState, career.teamId, ()=>playoffs._effOverall, season);
      if(step.myRound){
        step.myRound._revealedCount = 0; step.myRound._keyMomentChecked = false;
        playoffs.rounds.push(step.myRound);
        return;
      }
      if(step.done){
        // fewer than 2 teams in the whole conference -- the player was never seeded into a game.
        playoffs.done = true;
        return;
      }
      // a bye round: nothing here involved the player, so it settles on its own -- confirm it
      // and keep looking for their actual next game.
      const result = confirmRoundAdvancement(playoffs._bracketState);
      if(result.done){
        // the whole conference resolved in a round the player sat out -- only possible if that
        // "champion" IS the player (every other team was eliminated around a lone bye), in which
        // case they've won the conference without playing a snap; handle it like any other
        // Conference Championship win. Otherwise there's simply nothing left for them to play.
        if(result.champion && result.champion.id===career.teamId){ buildSuperBowlRound(playoffs, season); }
        else { playoffs.done = true; }
        return;
      }
      // else: field advanced past a bye round with the player still in it somewhere down the
      // bracket -- loop again to find their game.
    }
  }

  // Called once the round most recently pushed onto playoffs.rounds has completely finished
  // revealing (Key Moment included, round.won final). Only from here does the bracket move
  // forward -- and only now can the run actually end, in either direction.
  function confirmPlayoffRound(playoffs, season){
    const round = playoffs.rounds[playoffs.rounds.length-1];
    if(!round){ playoffs.done = true; return; }
    if(round.round==="Super Bowl"){ playoffs.wonSuperBowl = round.won; playoffs.done = true; return; }
    if(!round.won){ playoffs.done = true; return; }
    const result = confirmRoundAdvancement(playoffs._bracketState);
    if(result.done){
      if(result.champion && result.champion.id===career.teamId){ buildSuperBowlRound(playoffs, season); }
      else { playoffs.done = true; }
      return;
    }
    advanceToNextPlayoffRound(playoffs, season);
  }

  function resolvePlayoffs(effOverall, season){
    const { seeded, results, format, divisions } = simulateLeagueStandings(season);
    season.leagueStandings = { results, seeded, format, divisions };
    const year = season.year;
    const myConf = conferenceOf(career.teamId, year);
    const otherConf = myConf==="AFC" ? "NFC" : "AFC";
    const mySeeds = seeded[myConf];
    const mySeedIdx = mySeeds.findIndex(t=>t.id===career.teamId);

    const confTeamIds = divisions.filter(d=>d.conf===myConf).flatMap(d=>d.teams);
    const confRanked = confTeamIds.map(id=>results[id]).sort((a,b)=>b.winPct-a.winPct);
    const confRank = confRanked.findIndex(t=>t.id===career.teamId)+1;

    if(mySeedIdx===-1) return { made:false, confRank, confSize:confTeamIds.length };

    const seed = mySeedIdx+1;
    const playoffs = {
      made:true, seed, confRank, confSize:confTeamIds.length,
      rounds: [], wonSuperBowl:false, done:false,
      _seeded: seeded, _otherConf: otherConf, _format: format,
      _bracketState: startConferenceBracket(mySeeds, format),
      _effOverall: effOverall,
    };
    // Generates round 1's matchup only -- how far this run goes is not decided here, and won't
    // be until the player has actually played their way there.
    advanceToNextPlayoffRound(playoffs, season);
    return playoffs;
  }

  // Shared by generateSeason (the player's own season) and simulateRivalSeasons (every other
  // starting QB in the league) so award odds are computed by the exact same rules for everyone --
  // this is what makes the League tab's award-rate comparison an honest "checkbalance" instead of
  // two formulas that only look similar. (Pro Bowl/All-Pro used to be rolled straight off effOverall
  // with only a token attempts floor -- an elite-rated QB who missed 8 games and threw for 2,000
  // yards could still clear that and get selected purely on talent. The ratingEdge gate also used to
  // allow -2, letting a personally below-average season get carried in by a stacked team's win total
  // alone -- both fixed here, once, for every QB in the league at the same time.)
  function evaluateSeasonAwards({ rating, td, winPct, attempts, gamesPlayed, leagueGames, decade }){
    const awards = [];
    const leagueAvgRating = leagueAvgRatingForDecade(decade);
    const ratingEdge = rating - leagueAvgRating;
    const gamesPlayedShare = leagueGames>0 ? gamesPlayed/leagueGames : 0;

    // Pro Bowl and All-Pro are NOT independent per-QB rolls -- see resolveSeasonAllProAndProBowl
    // below, which mirrors the winner-take-all MVP fix (resolveSeasonMVP): a real Pro Bowl has a
    // fixed number of honorees selected comparatively (top scorers per conference), and a real
    // All-Pro team has exactly one First Team and one Second Team league-wide, not several dozen
    // players each independently "winning" the honor off their own coin flip. These scores are the
    // same ingredients the old rolls used -- how strong a case this season makes -- just no longer
    // fed through a probability; *Eligible gates out a barely-played season (a real Pro Bowl/All-Pro
    // case requires an actual full-ish season, not a plausible score off a tiny sample).
    const proBowlScore = ratingEdge*0.6 + Math.max(0, td-16)*0.45 + (winPct-0.5)*10;
    const proBowlEligible = attempts>200 && gamesPlayedShare>=0.65 && ratingEdge>=1;

    const allProScore = ratingEdge*0.75 + Math.max(0, td-22)*0.55 + (winPct-0.5)*18;
    const allProEligible = gamesPlayedShare>=0.8 && ratingEdge>=9;

    // MVP is likewise decided once, league-wide, by resolveSeasonMVP. mvpEligible gates out
    // someone who barely played from ever backing into the award off a tiny sample; a real MVP
    // case requires having actually played the season.
    const mvpScore = ratingEdge*0.55 + (winPct-0.5)*40 + Math.max(0, td-25)*0.6;
    const mvpEligible = attempts>150 && gamesPlayedShare>=0.5;

    return { awards, ratingEdge, leagueAvgRating, gamesPlayedShare,
      proBowlScore, proBowlEligible, allProScore, allProEligible, mvpScore, mvpEligible };
  }

  // Winner-take-all MVP: exactly one season, per year, across the WHOLE league (player + every
  // simulated rival), gets the award -- whoever's mvpScore (see evaluateSeasonAwards) is highest.
  // A genuine tie (identical score) is rare but handled honestly with a co-MVP rather than an
  // arbitrary tiebreak. If literally nobody clears the mvpEligible bar this year (a strike-shortened
  // season, a league-wide injury bug, etc.) the best score on record still wins it rather than the
  // season ending with an unexplained "nobody won MVP" gap -- real MVP voting never goes empty.
  function resolveSeasonMVP(season, year){
    const rows = [{ isMine:true, awards: season.awards, score: season.mvpScore,
      eligible: season.mvpEligible, totals: career.totals }];
    (career.leagueRivals||[]).forEach(r=>{
      const s = r.seasons.find(x=>x.year===year);
      if(!s) return;
      rows.push({ isMine:false, awards: s.awards, score: s.mvpScore, eligible: s.mvpEligible, totals: r.totals });
    });
    const pool = rows.filter(r=>r.eligible);
    const field = pool.length ? pool : rows;
    const best = Math.max(...field.map(r=>r.score));
    const winners = field.filter(r=> Math.abs(r.score-best) < 0.0001);
    winners.forEach(r=>{ r.awards.push("MVP"); r.totals.mvps++; });
    return winners.some(r=>r.isMine);
  }

  // Fixed-slot Pro Bowl / All-Pro, resolved comparatively across the whole league at season's
  // end -- same pattern as resolveSeasonMVP, but with a per-conference roster instead of a single
  // winner. Real history: the Pro Bowl selected 2 QBs per conference (4 total) through the 1980s,
  // occasionally stretching to a 3rd per conference for a clearly-deserving extra case, then grew
  // to 3 per conference (6 total) from the 1990s on; the All-Pro team has always named exactly one
  // First Team and one Second Team league-wide (not per-conference). A First/Second-Team All-Pro
  // is, in practice, always also a Pro Bowler -- if the comparative Pro Bowl vote above didn't
  // already seat them, they're added on top of their conference's count (same as a real ballot
  // occasionally runs an extra honoree in).
  function proBowlSlotsForYear(year){
    return year<1990 ? { perConf:2, maxPerConf:3 } : { perConf:3, maxPerConf:3 };
  }
  function resolveSeasonAllProAndProBowl(season, year){
    const rows = [{ isMine:true, teamId: career.teamId, conf: conferenceOf(career.teamId, year),
      awards: season.awards, proBowlScore: season.proBowlScore, proBowlEligible: season.proBowlEligible,
      allProScore: season.allProScore, allProEligible: season.allProEligible, totals: career.totals }];
    (career.leagueRivals||[]).forEach(r=>{
      const s = r.seasons.find(x=>x.year===year);
      if(!s) return;
      rows.push({ isMine:false, teamId: r.teamId, conf: conferenceOf(r.teamId, year),
        awards: s.awards, proBowlScore: s.proBowlScore, proBowlEligible: s.proBowlEligible,
        allProScore: s.allProScore, allProEligible: s.allProEligible, totals: r.totals });
    });

    const slots = proBowlSlotsForYear(year);
    const seated = new Set();
    ["AFC","NFC"].forEach(conf=>{
      const pool = rows.filter(r=>r.conf===conf);
      if(!pool.length) return;
      const ranked = pool.slice().sort((a,b)=> b.proBowlScore-a.proBowlScore);
      const selected = ranked.slice(0, slots.perConf);
      if(slots.maxPerConf>slots.perConf){
        const bonus = ranked[slots.perConf];
        if(bonus && bonus.proBowlEligible) selected.push(bonus);
      }
      selected.forEach(r=>{ r.awards.push("Pro Bowl"); r.totals.proBowls++; seated.add(r); });
    });

    const eligiblePool = rows.filter(r=>r.allProEligible);
    const field = (eligiblePool.length ? eligiblePool : rows).slice().sort((a,b)=> b.allProScore-a.allProScore);
    const firstTeam = field[0];
    const secondTeam = field.find(r=>r!==firstTeam);
    [["First-Team All-Pro", firstTeam], ["Second-Team All-Pro", secondTeam]].forEach(([label, r])=>{
      if(!r) return;
      r.awards.push(label);
      r.totals.allPros++;
      if(!seated.has(r)){ r.awards.push("Pro Bowl"); r.totals.proBowls++; seated.add(r); }
    });

    const myRow = rows[0];
    return { proBowl: myRow.awards.includes("Pro Bowl"),
      allPro: myRow.awards.includes("First-Team All-Pro") ? "First-Team" : myRow.awards.includes("Second-Team All-Pro") ? "Second-Team" : null };
  }

  /* ----- Modern-day NFL record tracking -- a Playtester request: flag it with a badge/star when
     a season or career line actually clears a real modern-NFL record, regardless of what decade
     the simulated season is set in (the point is "that's incredible for ANY era," not just this
     one). A small, well-known set of QB records -- exact figures are approximate/illustrative,
     not a certified stat-encyclopedia, which is fine for a flavor badge like this. ----- */
  const MODERN_NFL_RECORDS = {
    seasonPassYards: { value: 5477, label: "Most Passing Yards, Single Season", holder: "Peyton Manning, 2013" },
    seasonPassTd:    { value: 55,   label: "Most Passing TDs, Single Season", holder: "Peyton Manning, 2013" },
    seasonRating:    { value: 122.5,label: "Highest Passer Rating, Single Season", holder: "Aaron Rodgers, 2011" },
    seasonRushYards: { value: 1206, label: "Most Rushing Yards by a QB, Single Season", holder: "Lamar Jackson, 2019" },
    careerPassYards: { value: 89214,label: "Most Career Passing Yards", holder: "Tom Brady" },
    careerPassTd:    { value: 649,  label: "Most Career Passing TDs", holder: "Tom Brady" },
  };
  function checkSeasonRecords(season){
    const broken = [];
    if(season.yards > MODERN_NFL_RECORDS.seasonPassYards.value) broken.push({ key:"yards", ...MODERN_NFL_RECORDS.seasonPassYards });
    if(season.td > MODERN_NFL_RECORDS.seasonPassTd.value) broken.push({ key:"td", ...MODERN_NFL_RECORDS.seasonPassTd });
    if(season.rating > MODERN_NFL_RECORDS.seasonRating.value) broken.push({ key:"rating", ...MODERN_NFL_RECORDS.seasonRating });
    if(season.rushYards > MODERN_NFL_RECORDS.seasonRushYards.value) broken.push({ key:"rushYards", ...MODERN_NFL_RECORDS.seasonRushYards });
    return broken;
  }
  function checkCareerRecords(totals){
    const broken = [];
    if(totals.yards > MODERN_NFL_RECORDS.careerPassYards.value) broken.push({ key:"yards", ...MODERN_NFL_RECORDS.careerPassYards });
    if(totals.td > MODERN_NFL_RECORDS.careerPassTd.value) broken.push({ key:"td", ...MODERN_NFL_RECORDS.careerPassTd });
    return broken;
  }
  function recordBadgeHtml(rec){
    const shownVal = rec.value>=1000 ? rec.value.toLocaleString() : rec.value;
    return `<span class="record-badge" title="Modern NFL Record: ${svgEscape(rec.label)} — previously ${svgEscape(rec.holder)} (${shownVal})">★ NFL Record</span>`;
  }

  /* ----- Sim-historical-best tracking -- distinct from MODERN_NFL_RECORDS above: that one checks
     a season/career line against real-world NFL history, regardless of this playthrough's own
     league. This one checks it against the best THIS PLAYTHROUGH'S simulated league has itself
     produced so far -- the player's own past seasons plus every career.leagueRivals season ever
     logged (retired rivals' history stays in the array, see generateLeagueRivals/
     simulateRivalSeasons) -- scoped either to "best within this decade so far" or "best of
     everything up to and including this decade" (which, since seasons only ever move forward in
     time, is simply the all-time-so-far best). A season can only ever earn ONE sim-best badge per
     stat -- all-time takes priority over decade-only, since clearing the all-time bar always also
     clears the decade bar. ----- */
  function collectAllSimSeasons(){
    const all = career.seasonLog.slice();
    (career.leagueRivals||[]).forEach(r=> all.push(...r.seasons));
    return all;
  }
  const SIM_BEST_METRICS = [
    { key:"yards", label:"Passing Yards" },
    { key:"td", label:"Passing TDs" },
    { key:"rating", label:"Passer Rating" },
    { key:"rushYards", label:"Rushing Yards" },
  ];
  function checkSimHistoricalBest(season){
    const all = collectAllSimSeasons();
    // Rival season objects (see simulateRivalSeasons) never stamp a `.decade` field the way the
    // player's own season object does -- derive it from the year instead so rival seasons from
    // the same decade actually count toward the "within this decade" comparison pool, rather than
    // silently only ever comparing the player's own history against itself.
    const seasonDecade = season.decade || decadeForYear(season.year);
    const decadeSeasons = all.filter(s=> (s.decade || decadeForYear(s.year))===seasonDecade);
    const upToDecadeSeasons = all; // every sim season ever logged already happened at or before now
    const best = [];
    SIM_BEST_METRICS.forEach(m=>{
      const val = season[m.key];
      if(!(val>0)) return;
      const allTimeBest = Math.max(0, ...upToDecadeSeasons.map(s=> s[m.key]||0));
      const decadeBest = Math.max(0, ...decadeSeasons.map(s=> s[m.key]||0));
      if(val>=allTimeBest) best.push({ key:m.key, label:m.label, value:val, scope:"all-time" });
      else if(val>=decadeBest) best.push({ key:m.key, label:m.label, value:val, scope:"decade", decade:season.decade });
    });
    return best;
  }
  function simBestBadgeHtml(rec){
    const shownVal = rec.value>=1000 ? rec.value.toLocaleString() : rec.value;
    const scopeText = rec.scope==="all-time" ? "the best this league has ever produced, so far" : `the best this league has produced in the ${rec.decade}, so far`;
    return `<span class="sim-best-badge" title="${svgEscape(rec.label)}: ${shownVal} — ${svgEscape(scopeText)}">◆ ${rec.scope==="all-time"?"League Best":"Decade Best"}</span>`;
  }

  /* ================= League rivals =================
     A lightweight parallel simulation of every OTHER starting QB in the league, built to support
     the League tab's season leaderboard and, down the line, an actual head-to-head rivals mechanic
     (see the "checkbalance for awards" + "rivals" note this was requested from). Rivals don't get
     the player's full 12-attribute build -- a single `talent` scalar (same 10-99 scale) stands in
     for effOverall, seeded off that team's own leagueStrength grade (so good teams tend to roll
     good QBs, same as reality skews) and then aged with the SAME primeMultiplier curve the player's
     own attributes use, so a rival's numbers rise and fall with age the same way. One rival per
     team excluding the player's own; when a rival ages past their (randomly rolled once) retirement
     age, a fresh rookie is generated at that team so the league leaderboard never runs dry across a
     very long player career -- exactly like a real league keeps producing new starters. */
  function generateLeagueRivals(){
    const rivals = TEAMS.filter(t=>t.id!==career.teamId).map((t,i)=>{
      const teamGrade = career.leagueStrength[t.id] ?? 60;
      const age = randInt(23, 34);
      return {
        id: "riv_"+t.id+"_"+i,
        name: randomFullName(),
        teamId: t.id,
        talent: clamp(teamGrade + randInt(-15, 15), 20, 99),
        age,
        retireAge: randInt(30, 40),
        draftYear: career.year - (age-22),
        seasons: [],
        totals: { games:0, comp:0, att:0, yards:0, td:0, int:0, wins:0, losses:0, proBowls:0, allPros:0, mvps:0 },
        retired: false,
      };
    });
    // Three marked "rivals" (distinct from the other ~28 background league QBs) get their draft
    // year pinned to the SAME year the player was drafted -- a true draft classmate, the natural
    // seed for a future head-to-head rivalry mechanic (shared history, same age curve, same era).
    const classmates = rivals.slice().sort(()=>Math.random()-0.5).slice(0, Math.min(3, rivals.length));
    classmates.forEach(r=>{ r.isRival = true; r.age = 22; r.draftYear = career.year; r.retireAge = randInt(32, 42); });
    return rivals;
  }
  function simulateRivalSeasons(decade, league, year){
    if(!career.leagueRivals) return;
    career.leagueRivals.forEach(r=>{
      if(r.retired) return;
      if(r.age > r.retireAge){
        r.retired = true;
        // replace with a fresh rookie at the same team so the league doesn't thin out over a
        // 20-season player career -- the new starter takes over the same roster spot.
        const teamGrade = career.leagueStrength[r.teamId] ?? 60;
        const newTalent = clamp(teamGrade + randInt(-15,15), 20, 99);
        // A concrete, legible reason a team's grade moves: losing a known, age-adjusted starter
        // for an unproven rookie is a real transition, not neutral -- how big a deal it is depends
        // on how much the succession actually downgrades (or upgrades) the position.
        const successionNudge = Math.round((newTalent - rivalEffTalent(r)) * 0.3);
        career.leagueStrength[r.teamId] = clamp(teamGrade + successionNudge, 20, 96);
        career.leagueRivals.push({
          id: "riv_"+r.teamId+"_"+year, name: randomFullName(), teamId: r.teamId,
          talent: newTalent, age: 22, retireAge: randInt(30,40),
          draftYear: year, seasons: [], totals: { games:0, comp:0, att:0, yards:0, td:0, int:0, wins:0, losses:0, proBowls:0, allPros:0, mvps:0 },
          retired: false, succeededId: r.id,
        });
        return;
      }
      const talentEdge = r.talent - 65;
      const ageMult = primeMultiplier(r.age);
      const delta = talentEdge*ageMult;
      const cal = STAT_CAL[decade] || STAT_CAL["2000s"];
      const comp = clamp(league.comp + delta*(delta>=0?cal.comp.up:cal.comp.down)*RIVAL_STAT_SCALE, cal.comp.lo, cal.comp.hi);
      const ypa = clamp(league.ypa + delta*(delta>=0?cal.ypa.up:cal.ypa.down)*RIVAL_STAT_SCALE, cal.ypa.lo, cal.ypa.hi);
      const tdRate = clamp(league.tdRate + delta*(delta>=0?cal.td.up:cal.td.down)*RIVAL_STAT_SCALE, cal.td.lo, cal.td.hi);
      const intRate = clamp(league.intRate - delta*(delta>=0?cal.int.up:cal.int.down)*RIVAL_STAT_SCALE, cal.int.lo, cal.int.hi);
      const attPerGame = clamp(league.attPerGame + randInt(-3,3), 4, 45);
      const missedGames = Math.random()<0.18 ? randInt(1, 7) : 0;
      const gamesPlayed = clamp(league.games - missedGames, 0, league.games);
      const attempts = Math.round(attPerGame*gamesPlayed);
      const completions = Math.round(attempts*comp);
      const yards = Math.round(attempts*ypa);
      const td = Math.max(0, Math.round(attempts*tdRate));
      const interceptions = Math.max(0, Math.round(attempts*intRate));
      const rating = passerRating(completions, attempts, yards, td, interceptions);
      const teamGrade = career.leagueStrength[r.teamId] ?? 60;
      const winProb = clamp(0.5 + talentEdge*ageMult*0.009 + (teamGrade-65)*0.009, 0.08, 0.92);
      let wins = 0;
      for(let i=0;i<gamesPlayed;i++){ if(Math.random()<winProb) wins++; }
      const losses = gamesPlayed-wins;
      const winPct = gamesPlayed>0 ? wins/gamesPlayed : 0;
      const { awards, proBowlScore, proBowlEligible, allProScore, allProEligible, mvpScore, mvpEligible } = evaluateSeasonAwards({
        rating, td, winPct, attempts, gamesPlayed, leagueGames: league.games, decade,
      });
      const season = { year, age: r.age, teamId: r.teamId, games: gamesPlayed, comp: completions, att: attempts,
        pct: attempts>0?completions/attempts:0, yards, td, int: interceptions, rating, wins, losses, awards,
        proBowlScore, proBowlEligible, allProScore, allProEligible, mvpScore, mvpEligible };
      r.seasons.push(season);
      r.totals.games += gamesPlayed; r.totals.comp += completions; r.totals.att += attempts;
      r.totals.yards += yards; r.totals.td += td; r.totals.int += interceptions;
      r.totals.wins += wins; r.totals.losses += losses;
      // Pro Bowl/All-Pro/MVP totals are incremented once, league-wide, by
      // resolveSeasonAllProAndProBowl/resolveSeasonMVP after every QB's season this year is locked in.
      r.age++;
    });
  }

  function generateSeason(){
    const decade = decadeForYear(career.year);
    const league = LEAGUE[decade];
    const schemeId = career.teamScheme ? career.teamScheme[career.teamId] : null;
    const eff = schemeEffective(career.age, decade, schemeId);

    const effAcc = weighted(eff, {SHA:0.40, TCH:0.25, DAC:0.20, ANT:0.15});
    const effYpa = weighted(eff, {ARM:0.35, DAC:0.35, TCH:0.15, IMP:0.15});
    const effTd  = weighted(eff, {ANT:0.40, DEC:0.30, TCH:0.30});
    const effInt = weighted(eff, {DEC:0.50, ANT:0.30, PKT:0.20});
    const effOverall = weighted(eff, OVERALL_WEIGHTS);
    const effRush = weighted(eff, {MOB:0.60, IMP:0.30, ARM:0.10});

    const neutral = neutralEffective(career.age, decade, schemeId);
    const neutralAcc = weighted(neutral, {SHA:0.40, TCH:0.25, DAC:0.20, ANT:0.15});
    const neutralYpa = weighted(neutral, {ARM:0.35, DAC:0.35, TCH:0.15, IMP:0.15});
    const neutralTd  = weighted(neutral, {ANT:0.40, DEC:0.30, TCH:0.30});
    const neutralInt = weighted(neutral, {DEC:0.50, ANT:0.30, PKT:0.20});
    const neutralOverall = weighted(neutral, OVERALL_WEIGHTS);
    // independent age-expression cap (see primeMultiplier) — applied to the deltas below, not
    // to the neutral baseline itself, so league-average stays league-average at every age and
    // only an individual build's edge over it compresses late in a career.
    const primeMult = primeMultiplier(career.age);

    // injury/suspension check (before stats, may already be resolved via event -> flags on
    // career.injuryPenalty). These are tracked separately so the season narrative can tell a
    // suspension apart from an actual injury instead of always saying "to injury".
    const missedGamesInjury = career._injuryMissedGames || 0;
    const missedGamesSuspension = career._suspensionMissedGames || 0;
    let missedGames = missedGamesInjury + missedGamesSuspension;
    let perfPenalty = career._injuryPenalty || 0;
    const hadInjuryThisSeason = !!career._hadInjuryThisSeason;
    career._injuryMissedGames = 0; career._suspensionMissedGames = 0; career._injuryPenalty = 0; career._hadInjuryThisSeason = false;

    const gamesPlayed = clamp(league.games - missedGames, 0, league.games);

    // a reduced-role contract (backup/minimum) means fewer starts, not just worse play
    const roleShare = career.contract.tier==="minimum" ? clamp(0.15+Math.random()*0.4, 0.1, 0.6)
      : career.contract.tier==="backup" ? clamp(0.45+Math.random()*0.35, 0.3, 0.85)
      : 1;

    // Variance by design: a build well below the age/era-adjusted league-average baseline
    // throws like a bust, and one well above it throws like an all-time great — but the gap
    // between "good" (a 15ish-point delta, an 80ish overall) and "great" (a 25-30-point delta,
    // a 90+ overall) has to actually SHOW UP in the numbers, not saturate the same ~70%-completion,
    // ~5000-yard, sub-5-INT ceiling for both. These coefficients are calibrated so a delta of 0
    // (neutral/league-average) throws league-average ball, +15 throws like a good starter
    // (high-60s completion, ~25-28 TD), and +25-30 throws like a real MVP case (high-60s/low-70s
    // completion, 30+ TD, single-digit INTs) — with real separation in between. Everything is
    // measured against the NEUTRAL baseline (a 65-everywhere build through the same age curve
    // and era reweighting), so a rookie-year age penalty or a tough era doesn't read as "bad
    // build" on its own — only a genuinely below-average build does.
    // Per-decade, real-record-grounded ceilings/floors -- see the STAT_CAL constant near LEAGUE
    // for the sourced seasons and full methodology (this replaced a flat, non-decade-aware set of
    // coefficients that saturated well short of realistic decade-relative production).
    const cal = STAT_CAL[decade] || STAT_CAL["2000s"];
    const dCompRaw = (effAcc-neutralAcc)*primeMult, dYpaRaw = (effYpa-neutralYpa)*primeMult,
      dTdRaw = (effTd-neutralTd)*primeMult, dIntRaw = (effInt-neutralInt)*primeMult;
    // Blend each narrow per-stat delta with the broad effOverall delta. The per-stat formulas
    // above each pull from a small, concentrated subset of attributes (YPA only cares about
    // ARM/DAC/TCH/IMP, for instance), so a build can max out one of those subsets -- swinging
    // its stat delta close to the ~34-point ceiling STAT_CAL assumes is needed for record-book
    // numbers -- while its OVERALL rating (spread evenly across all 11 attributes via
    // OVERALL_WEIGHTS) stays merely decent. That mismatch is exactly what let 70-overall builds
    // throw for 4,000+ yards and 40+ TD: a narrow specialist reading as "average" on the card but
    // "elite" on the stat sheet. STAT_BLEND is deliberately low (mostly the BROAD/overall delta,
    // only a small taste of the narrow one) -- a first pass at 0.5 still let a ~69-overall,
    // 2-attribute specialist AVERAGE 4,600+ yards over a season (median 4,633, still hitting
    // 5,600+ on good years), which is exactly the bug this exists to fix, just less blatantly. At
    // 0.18 that same build averages solidly "mediocre" territory while a build whose narrow and
    // broad deltas already agree (a genuinely balanced build, elite or otherwise) is completely
    // unaffected by the blend ratio either way -- so raising or lowering STAT_BLEND only ever
    // changes how much a NARROW specialist can outperform their overall, never a balanced build's
    // ceiling.
    const dOverall = (effOverall-neutralOverall)*primeMult;
    const STAT_BLEND = 0.18;
    // A second, independent dial from STAT_BLEND above: even after narrow-vs-broad blending, the
    // raw delta-to-stat coefficients in STAT_CAL (calibrated assuming a ~34-point max theoretical
    // delta) were steep enough that a merely decent, perfectly BALANCED build -- no specialist
    // gaming involved at all -- still posted MVP-caliber ratings (100+) well before its displayed
    // overall left the "good starter" range. STAT_SENSITIVITY compresses every blended delta by
    // the same factor, in both directions, so the full displayed-overall range maps onto a
    // believable production curve: ~60-65 overall reads as a mediocre/fringe starter, ~75 as a
    // solid regular, ~85 as a genuine Pro Bowl-caliber year, and ~90+ as the rare, era-defining
    // season that occasionally actually clears a real modern-NFL record (see MODERN_NFL_RECORDS)
    // instead of blowing past it as a matter of course.
    // Round 4: tightened further, from 0.5 to 0.32 -- players kept posting gaudy statlines on
    // mediocre-to-average builds even after the Round 2 pass, so this squeezes the whole curve
    // again on top of that. Re-calibrated via the same flat-build diagnostic sweep methodology:
    // ~55-65 overall now tops out well shy of 90 rating even on a hot-streak season (was ~87-91
    // before this pass, itself down from routinely 100+ pre-Round-2), ~75-80 caps out high-90s,
    // and a truly maxed 99-everywhere build's ceiling comes down from ~120 to ~112 rating.
    const STAT_SENSITIVITY = 0.32;
    const dComp = (dCompRaw*STAT_BLEND + dOverall*(1-STAT_BLEND))*STAT_SENSITIVITY;
    const dYpa = (dYpaRaw*STAT_BLEND + dOverall*(1-STAT_BLEND))*STAT_SENSITIVITY;
    const dTd = (dTdRaw*STAT_BLEND + dOverall*(1-STAT_BLEND))*STAT_SENSITIVITY;
    const dInt = (dIntRaw*STAT_BLEND + dOverall*(1-STAT_BLEND))*STAT_SENSITIVITY;
    // Weapons is a small, independent nudge on top of the QB's own accuracy/arm attributes --
    // better skill-position talent means more YAC and more room for error, but it can't turn a bad
    // arm into a good one, so this stays a modest post-hoc addition rather than folded into the
    // main dComp/dYpa blend above.
    const weaponsNudge = (career.weapons-65);
    const comp = clamp(league.comp + dComp*(dComp>=0?cal.comp.up:cal.comp.down) + weaponsNudge*0.0006, cal.comp.lo, cal.comp.hi);
    const ypa = clamp(league.ypa + dYpa*(dYpa>=0?cal.ypa.up:cal.ypa.down) + weaponsNudge*0.008, cal.ypa.lo, cal.ypa.hi);
    const tdRate = clamp(league.tdRate + dTd*(dTd>=0?cal.td.up:cal.td.down), cal.td.lo, cal.td.hi);
    const intRate = clamp(league.intRate - dInt*(dInt>=0?cal.int.up:cal.int.down), cal.int.lo, cal.int.hi);
    let attPerGame = clamp((league.attPerGame - (eff.MOB-neutral.MOB)*0.05 + dOverall*0.06 + randInt(-2,2)) * roleShare, 4, 48);
    // Sack rate leans on pocket presence (individual) and the O-line grade specifically -- not
    // generic team strength, since a good team can absolutely have a bad line (see the Supporting
    // Cast system) -- a good pocket passer behind a good line gets sacked less than league-average,
    // a statue behind a bad one gets sacked a lot more.
    const sackRate = clamp(0.075 - (eff.PKT-neutral.PKT)*0.0012 - (career.oline-65)*0.0006, 0.015, 0.16);

    const perfMult = 1 - perfPenalty*0.01;
    const regSeason = simulateRegularSeasonGames({
      gamesPlayed, effOverall, comp, ypa, tdRate, intRate, attPerGame, perfMult, effRush, sackRate,
      age: career.age, decade,
    });
    const gameLog = regSeason.games, wins = regSeason.wins, losses = regSeason.losses;
    const attempts = regSeason.att, completions = regSeason.comp, yards = regSeason.yards,
      td = regSeason.td, interceptions = regSeason.int, sacks = regSeason.sacks,
      rushAtt = regSeason.rushAtt, rushYards = regSeason.rushYards, rushTd = regSeason.rushTd;
    const rating = passerRating(completions, attempts, yards, td, interceptions);
    const winPct = gamesPlayed>0 ? wins/gamesPlayed : 0;

    // the team's season doesn't stop when this QB is hurt — a backup covers the missed games,
    // playing off team quality alone (not this player's skill), so "team record" and "your
    // record as the starter" can and often do differ.
    const backupWinProb = clamp(0.5 + (career.teamStrength-65)*0.01, 0.12, 0.88);
    let backupWins=0;
    for(let i=0;i<missedGames;i++){ if(Math.random()<backupWinProb) backupWins++; }
    const backupLosses = missedGames-backupWins;

    // All three season awards are judged on what actually happened this season -- passer rating
    // relative to that year's league average, raw production, team success, and (for Pro Bowl /
    // All-Pro specifically) how much of the season was actually played -- never on the underlying
    // attribute grade. A merely-good build can win one with a career year; a great build that
    // missed half the season to injury and threw for a below-average line does NOT get voted in
    // just because the roster card says he's talented. evaluateSeasonAwards() is the single shared
    // implementation -- simulateRivalSeasons() calls the exact same function for every other
    // starting QB in the league, which is what makes the League tab's award rates an honest
    // cross-check against the player's own instead of two formulas that only look similar.
    const { awards, ratingEdge, leagueAvgRating, gamesPlayedShare, proBowlScore, proBowlEligible, allProScore, allProEligible, mvpScore, mvpEligible } = evaluateSeasonAwards({
      rating, td, winPct, attempts, gamesPlayed, leagueGames: league.games, decade,
    });

    // Team quality for THIS season is whatever it already was heading in (see the end of last
    // season's block below) -- it deliberately does NOT change mid-season, so the same team
    // grade is what both the regular season and the playoffs actually played against.

    const season = {
      year: career.year, age: career.age, teamId: career.teamId, teamName: teamNameAt(career.teamId, career.year),
      decade, games: gamesPlayed, comp: completions, att: attempts, pct: attempts>0?completions/attempts:0,
      yards, td, int: interceptions, sacks, rating, wins, losses,
      rushAtt, rushYards, rushTd, gameLog,
      teamGames: league.games, teamWins: wins+backupWins, teamLosses: losses+backupLosses, missedGames,
      missedGamesInjury, missedGamesSuspension,
      teamOverall: career.teamStrength,
      overall: Math.round(effOverall),
      awards, proBowlScore, proBowlEligible, allProScore, allProEligible, mvpScore, mvpEligible,
      contractApy: career.contract.apy, contractTier: career.contract.tier,
    };

    const playoffs = resolvePlayoffs(effOverall, season);
    season.playoffs = playoffs;
    // NOTE: no Super Bowl Champion award, no ring, here -- resolvePlayoffs has only generated
    // round 1 of the postseason (if the team made it at all). Whether this season ends in a ring
    // isn't decided yet, let alone known, so nothing referencing it can be added until the player
    // has actually played the run out -- see finalizePlayoffOutcome, called once the reveal ends.

    career.seasonLog.push(season);
    simulateRivalSeasons(decade, league, career.year);
    // Winner-take-all MVP (see resolveSeasonMVP) and fixed-slot Pro Bowl/All-Pro (see
    // resolveSeasonAllProAndProBowl): both decided once, here, after every QB in the league -- the
    // player and every simulated rival -- has this year's season locked in.
    const mvp = resolveSeasonMVP(season, career.year);
    const { proBowl, allPro } = resolveSeasonAllProAndProBowl(season, career.year);

    // ----- Team quality for NEXT season: legible causes first, small residual noise last. -----
    // Every other team's grade now moves because of something that actually happened to their own
    // rival QB this season (an award-winning year lifts them, a rough statistical season drags on
    // them -- succession/retirement is handled separately, right where it happens, in
    // simulateRivalSeasons), plus the same superteam decline pull everyone faces, plus a MUCH
    // smaller noise term than the old flat +/-8 random walk (most of a team's movement should now
    // be explainable, not just dice). rollLeagueNews layers headline-driven swings for a handful of
    // teams a season on top of this, same idea ORG_EVENTS already gives the player's own team.
    const decadeAvgRating = leagueAvgRatingForDecade(decade);
    career.leagueRivals.forEach(r=>{
      const justSeason = r.seasons.length ? r.seasons[r.seasons.length-1] : null;
      if(!justSeason || justSeason.year!==career.year) return; // retired/succeeded this same year -- handled at the point of succession instead
      const s = career.leagueStrength[r.teamId] ?? 60;
      let nudge = randInt(-2,2);
      if(justSeason.awards && justSeason.awards.length) nudge += justSeason.awards.length*1.5;
      else if(justSeason.rating < decadeAvgRating-8) nudge -= 2;
      nudge -= contenderDeclinePull(s);
      career.leagueStrength[r.teamId] = clamp(s + Math.round(nudge), 20, 96);
    });
    rollLeagueNews(career.year);
    // The player's own team faces identical decline pressure -- the counteracting force is the
    // same skill-linked nudge this always had (how far above/below neutral effOverall actually
    // played this season), unchanged from before this pass.
    const teamNoise = randInt(-2,2);
    const teamSkillNudge = Math.round((effOverall-neutralOverall)*primeMult*0.14);
    const teamDeclinePull = Math.round(contenderDeclinePull(career.teamStrength));
    career.teamStrength = clamp(career.teamStrength + teamNoise + teamSkillNudge - teamDeclinePull, 20, 97);
    career.leagueStrength[career.teamId] = career.teamStrength;
    // Supporting cast drifts on its own light noise -- most of its real movement comes from the
    // "oline"/"starleaves" ORG_EVENTS above, this just keeps it from being permanently frozen
    // between events.
    career.oline = clamp(career.oline + randInt(-2,2), 20, 99);
    career.weapons = clamp(career.weapons + randInt(-2,2), 20, 99);

    // ----- Wear and tear economy: a persistent, career-long meter (not a per-injury dice roll) --
    // see resolveInjuryChoice for the play-through-it vs. shut-it-down wear add, which is where
    // most of a career's real accumulation actually comes from. A small age/durability-scaled
    // baseline applies every season regardless (wear starts accelerating past 26, a low-DUR build
    // wears faster, a high one slower); an injury-free season recovers some of it back, tapering
    // off with age since an older body doesn't bounce back the way a 23-year-old's does. Diagnostically
    // tuned (pure-math trajectory sweep, no game code needed): "always sit out" stays near-zero
    // breakdown risk for a full career; "always gut it out" produces at least one permanent
    // breakdown in ~65-80% of careers (more for a fragile build), with a real (~25-35%) chance of
    // one specifically by age 30 -- a genuine, tangible cost to the choice, not a footnote.
    const ageWear = career.age>26 ? (career.age-26)*0.9 : 0.5;
    const durRelief = (build.DUR-65)*0.04;
    const seasonWear = clamp(ageWear - durRelief, 0.3, 7);
    career.wearAndTear = clamp((career.wearAndTear||0) + seasonWear, 0, 100);
    if(!hadInjuryThisSeason){
      const recovery = career.age<28 ? 3 : 1.2;
      career.wearAndTear = clamp(career.wearAndTear - recovery, 0, 100);
    }
    const WEAR_BREAKDOWN_THRESHOLD = 45;
    if(career.wearAndTear > WEAR_BREAKDOWN_THRESHOLD){
      const breakdownChance = clamp((career.wearAndTear-WEAR_BREAKDOWN_THRESHOLD)*0.012, 0, 0.4);
      if(Math.random() < breakdownChance){
        const physicalKeys = ["ARM","REL","MOB","IMP"].filter(k=>build[k]>18);
        if(physicalKeys.length){
          const hitKeys = shuffle(physicalKeys).slice(0, Math.min(physicalKeys.length, randInt(1,2)));
          hitKeys.forEach(k=>{ build[k] = clamp(build[k]-randInt(2,5), 15, 99); });
          career.wearAndTear = clamp(career.wearAndTear - 22, 0, 100);
          season.wearBreakdown = { keys: hitKeys.slice() };
          const keyLabels = hitKeys.map(k=>(ATTR_BY_KEY[k]||{}).label||k).join(" and ");
          career.transactions.push(`${career.year}: Years of wear catch up with him — a permanent decline in ${keyLabels}.`);
        }
      }
    }

    career.totals.games += gamesPlayed; career.totals.comp += completions; career.totals.att += attempts;
    career.totals.yards += yards; career.totals.td += td; career.totals.int += interceptions; career.totals.sacks += sacks;
    career.totals.rushYards += rushYards; career.totals.rushTd += rushTd;
    career.totals.earnings += career.contract.apy;

    // Catches any season-level statistical achievement the moment this season's stat line locks in.
    checkAchievements();

    if(!career.peakSeason || rating>career.peakSeason.rating) career.peakSeason = season;

    // reputation drifts toward how the season actually went — accolades build it, a bad year
    // (or a bad stretch) chips at it. This is what makes organizational-trust and free-agency
    // events feel earned rather than random. The Super Bowl bonus specifically is applied later,
    // in finalizePlayoffOutcome, once a ring is actually something that happened rather than
    // something the sim already knows is coming.
    career.reputation = clamp(career.reputation + (mvp?8:0) + (allPro?4:0) + (proBowl?2:0)
      + (winPct>=0.65?1:winPct<=0.3?-2:0), 0, 100);

    // GM relations, fan support, and league popularity all drift with how the season actually
    // went, on top of whatever event-driven swings already hit them this year (org events,
    // infractions, positive breaks, locker-room outcomes). A good season builds trust with the
    // front office and the fanbase alike; a bad one erodes both, and national fame specifically
    // tracks the biggest, most visible moments (MVP, a ring) rather than routine solid play. Same
    // deferral as reputation above: the ring-sized bonuses land in finalizePlayoffOutcome.
    career.gmRelationship = clamp((career.gmRelationship ?? 50) + (mvp?4:0) + (allPro?2:0)
      + (winPct>=0.65?2:winPct<=0.3?-3:0), 0, 100);
    career.fanSupport = clamp((career.fanSupport ?? 50) + (mvp?5:0) + (proBowl?2:0)
      + (winPct>=0.65?3:winPct<=0.3?-4:0), 0, 100);
    career.leaguePopularity = clamp((career.leaguePopularity ?? 50) + (mvp?7:0) + (allPro?3:0)
      + (proBowl?1:0) - (winPct<=0.2?2:0), 0, 100);

    career.seasonsWithTeam++;
    career.contract.years--;
    tickTempBoosts();
    developAttributes(season, decade, league);

    return season;
  }

  /* ================= Life events =================
     A season-by-season roll for the stuff that isn't just stat lines: infractions (suspension
     risk scales with DEC as a football-IQ/discipline proxy), rare career-altering scandals,
     positive breaks, and organizational shakeups whose odds scale with how big a deal this
     player actually is to his team (accolades, tenure, reputation). Reputation is a running
     score (0-100, starts at 50) nudged by both on-field results and these events; it feeds back
     into free agency and normal roster-cut risk, so a scandal has knock-on consequences beyond
     the event itself. */
  function playerProminence(){
    const t = career.totals;
    const accolades = t.proBowls*3 + t.allPros*5 + t.mvps*10 + t.rings*6;
    const tenure = Math.min(career.seasonsWithTeam, 10);
    return clamp(accolades + tenure*1.5 + (career.reputation-50)*0.4, 0, 100);
  }

  const INFRACTION_EVENTS = [
    { id:"dui", title:"DUI Arrest", severity:"minor", suspensionGames:[0,1], repHit:[-3,-8], mitigable:true,
      flavor:()=>"A late night, bad judgment, and a police report with his name on it. The league office is reviewing." },
    { id:"weapons", title:"Weapons Charge", severity:"minor", suspensionGames:[0,2], repHit:[-4,-10], mitigable:true,
      flavor:()=>"A legal gray area turns into a real charge. Nothing violent happened, but the headline doesn't say that." },
    { id:"conduct", title:"Conduct Complaint", severity:"minor", suspensionGames:[0,1], repHit:[-3,-9], mitigable:true,
      flavor:()=>"A shouting match, a shove, a story that leaks out of the building. The league wants an explanation." },
    { id:"substance", title:"Substance Issue", severity:"moderate", suspensionGames:[2,6], repHit:[-10,-20], mitigable:true,
      flavor:(decade)=>{
        if(decade==="1970s"||decade==="1980s") return "The party lifestyle catches up with him — a failed test, and whispers around the building about cocaine use finally become public.";
        if(decade==="2000s"||decade==="2010s") return "A dependency on the pills that were supposed to just get him through a Sunday becomes a real problem, and it shows up on a drug test.";
        return "A failed substance test becomes public, and the league's substance-abuse program is now part of his career.";
      } },
    { id:"ped", title:"PED Suspension", severity:"moderate", minYear:1990, suspensionGames:[4,6], repHit:[-8,-16], mitigable:false,
      flavor:()=>"A positive test for a banned performance-enhancer. There's no appeal that beats a lab result." },
    { id:"gambling", title:"Gambling Policy Violation", severity:"moderate", suspensionGames:[4,10], repHit:[-12,-25], mitigable:true,
      flavor:(decade)=> decade==="2020s"
        ? "Legal sports betting is everywhere now, and he crossed a line the league still takes deadly seriously — a bet placed somewhere it shouldn't have been."
        : "A gambling connection surfaces — nothing about fixing games, but enough for the league to make an example of him." },
    { id:"leaked", title:"Leaked Messages Scandal", severity:"major", minYear:2010, suspensionGames:[4,10], repHit:[-20,-35], mitigable:true,
      flavor:()=>"Years-old private messages leak to the press — ugly, offensive, and now permanently public. Sponsors are already pulling out." },
    { id:"domestic", title:"Off-field Violent Incident", severity:"major", suspensionGames:[6,14], repHit:[-25,-40], mitigable:true,
      flavor:()=>"A police report from a domestic incident becomes national news. The league has a policy for exactly this, and it isn't lenient." },
    { id:"animalring", title:"Federal Investigation", severity:"career-multi", minYear:1990, suspensionSeasons:[2,3], repHit:[-40,-55], mitigable:false,
      flavor:()=>"Federal investigators uncover his financing of an underground animal fighting operation. The evidence is overwhelming, and this is no longer a football story." },
    { id:"video", title:"Video Evidence Goes Public", severity:"career-end", minYear:2000, repHit:-60, mitigable:false,
      flavor:()=>"Surveillance footage of a violent incident becomes public, and there is no explaining it away.",
      finalFlavor:"The commissioner's statement is one line long. He will not play in this league again." },
    { id:"sideline", title:"Sideline Meltdown Goes Viral", severity:"minor", suspensionGames:[0,1], repHit:[-4,-9], mitigable:true,
      flavor:()=>"A helmet thrown, a shouting match with a coach, all of it caught on a hot mic. The clip is everywhere by Monday." },
    { id:"tabloid", title:"Tabloid Scandal", severity:"minor", suspensionGames:[0,0], repHit:[-3,-7], mitigable:true,
      flavor:()=>"A messy public breakup, or worse, splashes across the tabloids. Nothing the league can touch, but it's the only thing anyone wants to ask about." },
    { id:"business", title:"Failed Business Venture Goes Public", severity:"minor", suspensionGames:[0,1], repHit:[-3,-8], mitigable:true,
      flavor:()=>"A restaurant, a crypto play, a clothing line — whatever it was, it collapsed publicly, and now there are headlines instead of a business." },
    { id:"hotmic", title:"Hot Mic Slur Controversy", severity:"moderate", suspensionGames:[1,4], repHit:[-10,-22], mitigable:true,
      flavor:()=>"A live mic catches something ugly. The league fines and suspends, and sponsors go quiet for a while." },
    { id:"socialmedia", title:"Deleted Tweet Controversy", severity:"minor", minYear:2006, suspensionGames:[0,0], repHit:[-2,-6], mitigable:true,
      flavor:()=>"An old post resurfaces at the worst possible time. He deletes it fast — too fast for it not to already be everywhere." },
    { id:"contractholdout", title:"Public Contract Standoff Turns Ugly", severity:"minor", suspensionGames:[0,2], repHit:[-5,-12], mitigable:true,
      flavor:()=>"A quiet push for a new deal spills into the media, and both sides start saying things in public they can't really walk back." },
  ];
  function infractionEventsFor(){
    const year = career.year;
    return INFRACTION_EVENTS.filter(e=> (!e.minYear || year>=e.minYear) && (!e.maxYear || year<=e.maxYear));
  }

  // A coach getting fired for poor results the SAME offseason the team just won it all reads as
  // flatly illogical (a real reported complaint) -- excludes just that one entry right after a
  // title, rather than suppressing org news generally (a new GM, ownership sale, etc. can still
  // happen for reasons that have nothing to do with the season just played).
  function orgEventsFor(){
    const lastSeason = career.seasonLog.length ? career.seasonLog[career.seasonLog.length-1] : null;
    const justWonTitle = !!(lastSeason && lastSeason.playoffs && lastSeason.playoffs.wonRing);
    return justWonTitle ? ORG_EVENTS.filter(e=>e.id!=="coachfired") : ORG_EVENTS;
  }

  // ----- Rare "easter egg" career-altering events -----
  // Reuses the exact same data shape and render/resolve pipeline as INFRACTION_EVENTS (severity,
  // suspensionGames/suspensionSeasons, repHit, mitigable, flavor, finalFlavor) so no new engine
  // code is needed -- only a separate, much lower-odds trigger roll (see the top of
  // lifeEventCheck()). Each is a genericized, fictionalized nod to a real, infamous, "how did he
  // manage to get himself out of the league" NFL moment -- no real player names, but recognizable
  // enough to land the joke. Tagged `legendary:true` and given a stable `achievementId` now so a
  // future achievements system can hook directly off career.lifeEventLog entries without a schema
  // change later.
  const RARE_EVENTS = [
    { id:"shotself", achievementId:"own_worst_enemy", legendary:true, title:"Accidentally Shoots Himself At a Nightclub",
      severity:"major", minYear:1990, suspensionGames:[8,16], repHit:[-30,-45], mitigable:false,
      flavor:()=>"A concealed handgun he wasn't legally carrying goes off in his own waistband on a night out, and he shoots himself in the leg. The league doesn't care that the only victim was him." },
    { id:"bountyscandal", achievementId:"bounty_hunter", legendary:true, title:"Bounty Program Scandal",
      severity:"career-multi", minYear:1985, suspensionSeasons:[1,1], repHit:[-35,-50], mitigable:false,
      flavor:()=>"Investigators uncover a pay-for-injury bounty system he helped run, targeting opposing players. The commissioner makes an example of him with the harshest penalty short of a permanent ban." },
    { id:"disguiseflight", achievementId:"master_of_disguise", legendary:true, title:"Caught Skipping a Team Flight in Disguise",
      severity:"moderate", suspensionGames:[1,3], repHit:[-8,-18], mitigable:true,
      flavor:()=>"He's spotted boarding a flight in a bad wig and sunglasses to dodge team compliance staff — then gets recognized anyway, mid-disguise, by a fan with a phone camera. The video is not going away." },
    { id:"vanishseason", achievementId:"walked_away", legendary:true, title:"Walks Away Mid-Career to \"Find Himself\"",
      severity:"career-multi", suspensionSeasons:[1,1], repHit:[-15,-5], mitigable:false,
      flavor:()=>"No arrest, no scandal — he just quietly walks away from football entirely for a while, chasing something the game clearly wasn't giving him. He'll have to talk his way back onto a roster whenever he's ready." },
    { id:"shootinvolved", achievementId:"wrong_place_wrong_time", legendary:true, title:"Named in a Nightclub Shooting Investigation",
      severity:"career-multi", minYear:1990, suspensionSeasons:[1,1], repHit:[-25,-40], mitigable:false,
      flavor:()=>"He wasn't the shooter, but he was there, and his name is now permanently tied to a nightclub shooting investigation. The league suspends him for the full season while it plays out." },
    { id:"gamblingruin", achievementId:"house_always_wins", legendary:true, title:"Gambling Debts Spiral Into a Career-Ending Scandal",
      severity:"career-end", repHit:-55, mitigable:false,
      flavor:()=>"What started as friendly action on the side spirals into a full-blown gambling problem — debts, a bookie who won't be ignored, and a betting pattern the league's investigators can't unsee.",
      finalFlavor:"The commissioner's office doesn't mince words: the integrity of the game comes first. He's out, permanently." },
    { id:"furniturebalcony", achievementId:"unraveling_on_camera", legendary:true, title:"Bizarre Public Meltdown Goes Viral",
      severity:"major", minYear:1990, suspensionGames:[4,10], repHit:[-20,-35], mitigable:true,
      flavor:()=>"Security footage of an unhinged, furniture-throwing meltdown at a hotel goes viral within hours. Teammates say he hasn't been himself for a while; the league says that's not their problem." },
  ];
  function rareEventsFor(){
    const year = career.year;
    return RARE_EVENTS.filter(e=> (!e.minYear || year>=e.minYear) && (!e.maxYear || year<=e.maxYear));
  }

  const POSITIVE_EVENTS = [
    { id:"mentor", title:"A Legend Takes Him Under His Wing", repDelta:[3,8], boosts:[{key:"DEC",delta:7},{key:"ANT",delta:6}], seasons:2,
      flavor:()=>"A recently-retired great from this era starts showing up to workouts, unprompted. The extra film study shows up fast." },
    { id:"mechanics", title:"Throwing Mechanics Overhaul", repDelta:[1,4], boosts:[{key:"SHA",delta:6},{key:"TCH",delta:5}], seasons:2,
      flavor:()=>"An offseason with a throwing coach rebuilds his mechanics from the ground up. It looks different, and it plays different." },
    { id:"documentary", title:"Subject of a Hit Documentary", repDelta:[6,14], boosts:[], seasons:0,
      flavor:()=>"A behind-the-scenes documentary turns him into a cultural figure well beyond the football audience. Endorsement offers follow." },
    { id:"captain", title:"Named Team Captain", repDelta:[4,9], boosts:[{key:"CLU",delta:5}], seasons:3, cutShield:true,
      flavor:()=>"The locker room votes him a captain. It's a vote of confidence, and it visibly changes how he carries himself in big moments." },
    { id:"schemefit", title:"A Scheme Built Around Him", repDelta:[1,3], boosts:[{key:"MOB",delta:6},{key:"IMP",delta:5}], seasons:2,
      flavor:()=>"A new coordinator installs an offense that plays directly to his strengths for the first time in his career." },
    { id:"shoedeal", title:"Signature Shoe Deal", repDelta:[4,10], boosts:[], seasons:0,
      flavor:()=>"An apparel brand builds a signature line around him. It's not about the football, but it doesn't hurt his standing either." },
    { id:"campboost", title:"Offseason Throwing Camp Pays Off", repDelta:[1,3], boosts:[{key:"ARM",delta:5},{key:"REL",delta:4}], seasons:2,
      flavor:()=>"A grueling offseason at an elite private throwing program sharpens his tools in ways that show up on tape immediately." },
    { id:"filmroom", title:"Turns Into a Film-Room Rat", repDelta:[2,5], boosts:[{key:"DEC",delta:6},{key:"ANT",delta:5}], seasons:3,
      flavor:()=>"He starts showing up before the coaches do, breaking down tendencies frame by frame. It changes how fast he sees the field." },
    { id:"communityaward", title:"Wins the League's Community Award", repDelta:[8,16], boosts:[], seasons:0,
      flavor:()=>"Recognized league-wide for his work off the field. It doesn't move a single stat, but it matters at the negotiating table." },
    { id:"veteranleadership", title:"Becomes the Vocal Leader of a Turnaround", repDelta:[3,7], boosts:[{key:"CLU",delta:6}], seasons:2, cutShield:true,
      flavor:()=>"A young, struggling roster starts rallying around his voice specifically. It shows up when games are still in doubt in the fourth quarter." },
    { id:"offseasontrain", title:"Revolutionary Offseason Training Program", repDelta:[1,3], boosts:[{key:"DUR",delta:6}], seasons:3,
      flavor:()=>"A new sports-science-driven training regimen reshapes how his body holds up over the length of a full season." },
  ];

  /* ================= Lifepath: relationships & off-field flavor =================
     Two systems, both pure narrative/reputation-adjacent flavor (no attribute effects) so a
     career's PLAY never depends on its love life, but its STORY does. Every real name here is
     invented -- no actual celebrities, same safe convention RARE_EVENTS already established for
     "recognizable but fictional" NFL-moment easter eggs.

     1) A stateful relationship arc (career.relationship): single -> dating -> married, with
        breakup/divorce branches at each stage, so a partner's NAME persists across seasons and the
        story has real continuity instead of independent unconnected dice rolls -- one career's
        messy public breakup is a completely different story from another's quiet Vegas marriage.
     2) LIFEPATH_EVENTS: a large, one-off flavor pool (business ventures, hobbies, family, viral
        moments, a few fictionalized nods to real "how did that happen" pro-sports anecdotes) for
        sheer variety across a career, independent of the relationship arc. */
  const CELEBRITY_ARCHETYPES = [
    { type:"pop star", names:["Wren Delacroix","Journey Vaughn","Nova Sinclair","Bexley Storm","Lyric Monroe"] },
    { type:"movie star", names:["Vesper Kane","Rhys Callahan","Marlowe Voss","Sabine Wilder","August Reyne"] },
    { type:"supermodel", names:["Indigo March","Soleil Rousseau","Zara Winthrop","Lennox Fane","Coco Delvaux"] },
    { type:"reality TV star", names:["Brantley Kesh","Coralie Vance","Dakota Priestly","Harlow Beck","Remy Kingsley"] },
    { type:"R&B singer", names:["Amara Voss","Kingston Reyel","Selah Duvall","Osei Marchetti","Jolene Sharpe"] },
    { type:"late-night host", names:["Chip Halloway","Delancy Fox","Ronan Blackwood"] },
    { type:"tech founder", names:["Priya Kestrel","Wyatt Ashcombe","Neve Callister"] },
    { type:"country singer", names:["Waylon Cruz","Daisy Rae Holt","Tucker Lane"] },
  ];
  function pickCelebrityPartner(){
    const arche = pick(CELEBRITY_ARCHETYPES);
    return { name: pick(arche.names), type: arche.type };
  }
  const RELATIONSHIP_START_FLAVORS = [
    (n,t)=>`He's spotted front-row at a show with ${n}, the ${t}, and within a week it's confirmed — they're dating.`,
    (n,t)=>`A mutual friend sets him up with ${n}. Their first public appearance together, at an afterparty, is all anyone can talk about by morning.`,
    (n,t)=>`He slides into ${n}'s comments after she reposts one of his highlights. Three months later, they're official, and the tabloids are thrilled.`,
    (n,t)=>`They meet at a charity gala. A single blurry photo of the two of them talking is enough to spark a thousand headlines, all of which turn out to be true.`,
    (n,t)=>`A teammate's wedding, an open bar, and a seating chart that puts him next to ${n}. Neither of them saw it coming.`,
    (n,t)=>`${n} shows up to one of his games in a custom jersey, unannounced. The cameras find her by the second quarter, and the internet does the rest.`,
  ];
  const RELATIONSHIP_BREAKUP_FLAVORS = [
    (n)=>`He and ${n} announce a quiet, mutual split. Both statements use the word "amicable" — and for once, it actually seems true.`,
    (n)=>`It ends messy — a subtweet, a very-not-vague caption from ${n}, and a week of headlines neither of them wanted.`,
    (n)=>`${n} is spotted with someone else before he's even confirmed the breakup. The internet does not let him forget it.`,
    (n)=>`He and ${n} quietly stop showing up to each other's events. No statement, no drama — just over.`,
    (n)=>`A very public argument at a very public restaurant ends the relationship in front of several people with phones out.`,
  ];
  const RELATIONSHIP_MARRIAGE_FLAVORS = [
    (n,t)=>`A surprise Vegas chapel wedding with ${n} — no guests, no press release, just a photo the next morning that breaks the internet.`,
    (n,t)=>`He proposes to ${n} at midfield after a win, in front of a sold-out stadium. She says yes. The stadium loses its mind.`,
    (n,t)=>`A televised wedding to ${n}, the ${t}, becomes the offseason's biggest media event — even people who don't watch football tune in.`,
    (n,t)=>`A quiet backyard ceremony with ${n} — close friends and family only, and it somehow stays out of the tabloids for almost a full week.`,
  ];
  const RELATIONSHIP_DIVORCE_FLAVORS = [
    (n)=>`He and ${n} file for an amicable divorce after growing apart. Both release near-identical statements asking for privacy, which nobody gives them.`,
    (n)=>`The divorce from ${n} gets ugly fast — dueling statements, a leaked prenup detail, and a gossip cycle that runs for months.`,
    (n)=>`${n} files first, and the tabloids spend weeks on "sources say" details neither side confirms.`,
  ];
  const RELATIONSHIP_ASIDE_FLAVORS = [
    (n)=>`He and ${n} welcome their first child. The delivery-room announcement is, briefly, the most-liked post on the internet.`,
    (n)=>`${n} shows up to one of his games wearing a custom jersey with her own name on the back. The replica sells out by halftime.`,
    (n)=>`He and ${n} launch a joint business venture. Nobody's totally sure what it does, but the launch party is very well attended.`,
    (n)=>`${n} casts him in a two-second cameo in her new project. His one line gets more views than the trailer.`,
    (n)=>`He and ${n} renew their vows somewhere nobody can quite place on a map. The photos are, once again, everywhere.`,
  ];
  // Unified renderer for all 5 relationship-arc beats -- kind decides the flavor pool, the
  // rep/popularity math, and the next career.relationship state.
  function renderRelationshipEvent(kind){
    const content = document.getElementById("careerContent");
    let title, text, repDelta = 0, popDelta = 0;
    if(kind==="start"){
      const partner = pickCelebrityPartner();
      career.relationship = { status:"dating", partnerName:partner.name, partnerType:partner.type, startYear:career.year };
      title = `Dating ${partner.name}`;
      text = pick(RELATIONSHIP_START_FLAVORS)(partner.name, partner.type);
      repDelta = randInt(1,4); popDelta = randInt(4,10);
    } else if(kind==="breakup"){
      const partner = career.relationship;
      text = pick(RELATIONSHIP_BREAKUP_FLAVORS)(partner.partnerName);
      const messy = /messy|subtweet|spotted with someone else|public argument/i.test(text);
      title = `Split From ${partner.partnerName}`;
      repDelta = messy ? -randInt(4,9) : -randInt(0,2);
      popDelta = messy ? randInt(2,8) : randInt(-2,2); // messy breakups are, perversely, great for buzz
      career.relationship = null;
    } else if(kind==="marriage"){
      const partner = career.relationship;
      text = pick(RELATIONSHIP_MARRIAGE_FLAVORS)(partner.partnerName, partner.partnerType);
      title = `Marries ${partner.partnerName}`;
      career.relationship = { status:"married", partnerName:partner.partnerName, partnerType:partner.partnerType, startYear:career.year };
      repDelta = randInt(4,9); popDelta = randInt(6,14);
    } else if(kind==="divorce"){
      const partner = career.relationship;
      text = pick(RELATIONSHIP_DIVORCE_FLAVORS)(partner.partnerName);
      const messy = /ugly fast|files first/i.test(text);
      title = `Divorces ${partner.partnerName}`;
      repDelta = messy ? -randInt(8,16) : -randInt(2,6);
      popDelta = messy ? randInt(3,9) : randInt(-2,3);
      career.relationship = null;
    } else { // aside
      const partner = career.relationship;
      text = pick(RELATIONSHIP_ASIDE_FLAVORS)(partner.partnerName);
      title = `Life With ${partner.partnerName}`;
      repDelta = randInt(2,6); popDelta = randInt(3,8);
    }
    career.reputation = clamp(career.reputation + repDelta, 0, 100);
    career.leaguePopularity = clamp((career.leaguePopularity??50) + popDelta, 0, 100);
    career.lifeEventLog.push({ year:career.year, title, severity:"relationship" });
    career.transactions.push(`${career.year}: ${title}.`);
    content.innerHTML = eraWrap(decadeForYear(career.year), `
      <div class="ev-eyebrow">${career.year} · Personal Life</div>
      <h3>${title}</h3>
      <p>${text}</p>
      <div class="rep-note">Effect: Reputation ${fmtDelta(repDelta)} · League Popularity ${fmtDelta(popDelta)}.</div>
      <div class="event-choices"><button class="choice-btn" id="relAck"><div class="cb-title">Continue</div></button></div>
    `, {tone: repDelta>=0 ? "good" : "bad"});
    document.getElementById("relAck").addEventListener("click", secondaryLifeEventCheck);
  }
  // The relationship arc's own state machine: called independently of (and BEFORE) the usual
  // infraction/positive/org chain in lifeEventCheck, so it can't be crowded out by them. Returns
  // whether it actually rendered something, so the caller knows to stop dispatching further.
  function relationshipCheck(){
    if(Math.random()>=0.14) return false;
    const rel = career.relationship;
    if(!rel){
      if(Math.random()<0.5){ renderRelationshipEvent("start"); return true; }
      return false;
    }
    if(rel.status==="dating"){
      const roll = Math.random();
      if(roll<0.35){ renderRelationshipEvent("breakup"); return true; }
      if(roll<0.55){ renderRelationshipEvent("marriage"); return true; }
      return false;
    }
    if(rel.status==="married"){
      const roll = Math.random();
      if(roll<0.12){ renderRelationshipEvent("divorce"); return true; }
      if(roll<0.42){ renderRelationshipEvent("aside"); return true; }
      return false;
    }
    return false;
  }

  // General one-off lifepath flavor -- business ventures, hobbies, family, friendships, viral
  // moments, and a handful of fictionalized nods to real "you can't make this up" pro-sports
  // anecdotes (no real names, same convention as RARE_EVENTS). Deliberately mostly small/neutral
  // effects -- the point is variety and a laugh, not a stat lever.
  const LIFEPATH_EVENTS = [
    { id:"restaurant", title:"Opens a Restaurant", repDelta:[1,4],
      flavor:()=>"He opens a restaurant in the city he plays in. The food is, by all accounts, actually good — which surprises everyone, including the health inspector who keeps getting recognized." },
    { id:"cryptoflop", title:"Crypto Venture Quietly Dies", repDelta:[-3,0], minYear:2015,
      flavor:()=>"The token he endorsed a year ago is worth, functionally, nothing. He never brings it up, and neither does anyone in the locker room, to his face." },
    { id:"clothingline", title:"Launches a Clothing Line", repDelta:[1,5],
      flavor:()=>"A streetwear line with his logo on it sells out its first drop in nine minutes. Nobody, including him, expected that." },
    { id:"podcast", title:"Starts a Podcast", repDelta:[2,6], minYear:2004,
      flavor:()=>"A weekly podcast, mostly him and a rotating cast of teammates arguing about nothing, quietly becomes must-listen inside the league." },
    { id:"hottakes", title:"Hot Take Goes Viral", repDelta:[-4,4],
      flavor:()=>"An offhand opinion in a radio interview gets clipped, stripped of all context, and turns into a full news cycle. Reactions are, somehow, extremely mixed." },
    { id:"golfhobby", title:"Gets Seriously Into Golf", repDelta:[0,2],
      flavor:()=>"He takes up golf in the offseason and will not stop talking about his handicap. Teammates have started hiding when he brings up his short game." },
    { id:"chesshobby", title:"Becomes a Serious Chess Guy", repDelta:[1,3],
      flavor:()=>"He picks up chess to kill time on flights and, unexpectedly, gets genuinely good at it. His online rating is now a bigger point of pride than his completion percentage." },
    { id:"sixdogs", title:"Adopts Entirely Too Many Dogs", repDelta:[3,7],
      flavor:()=>"What started as one rescue dog is now, inexplicably, six. His house is reportedly chaos. His Instagram has never been better." },
    { id:"wildtattoo", title:"Gets a Very Large, Very Public Tattoo", repDelta:[-1,3],
      flavor:()=>"A new tattoo, taking up most of an arm, leaks before he's ready to show it off. Opinions on it are loud and extremely divided." },
    { id:"buyparents", title:"Buys His Parents a House", repDelta:[6,13],
      flavor:()=>"His first big veteran contract goes exactly where everyone hoped: a new house for his parents, handed over as a surprise. The video of the reaction is a permanent tearjerker." },
    { id:"siblingdrama", title:"Family Drama Goes Public", repDelta:[-6,-1],
      flavor:()=>"A sibling airs some real family business in an interview nobody asked for. He declines to comment, which somehow makes it a bigger story." },
    { id:"athletefriend", title:"Unlikely Friendship With a Star From Another Sport", repDelta:[2,6],
      flavor:()=>"He strikes up a genuine, very public friendship with a star from another sport entirely. Their courtside/rinkside appearances at each other's games become a whole thing." },
    { id:"mascotbeef", title:"Ongoing Beef With an Opposing Mascot", repDelta:[1,5],
      flavor:()=>"A pregame staredown with a division rival's mascot escalates into a running, mostly good-natured bit that the league's social team leans into every single time they play." },
    { id:"danceviral", title:"Touchdown Celebration Goes Viral", repDelta:[3,8],
      flavor:()=>"A spur-of-the-moment touchdown celebration becomes a genuine cultural moment. Kids in three different countries are doing it in their backyards by the following weekend." },
    { id:"wrongplayer", title:"Mistaken For a Completely Different Athlete", repDelta:[-1,3],
      flavor:()=>"He gets stopped in an airport by a fan absolutely convinced he's someone else, entirely different sport. He plays along for the photo. The story gets funnier every time he retells it." },
    { id:"badpressoutfit", title:"Pregame Outfit Becomes Bigger News Than the Game", repDelta:[0,5],
      flavor:()=>"His arrival outfit before a nationally televised game is, by kickoff, the single most-discussed thing about the matchup — more than either team's record." },
    { id:"micdup", title:"Mic'd Up Segment Goes Viral for the Wrong Reasons", repDelta:[-2,4],
      flavor:()=>"A mic'd-up broadcast segment catches him talking to himself, at length, in the third person. The clip is delightful. He is somewhat mortified." },
    { id:"chartererror", title:"Locked Out of the Team Facility", repDelta:[-1,2],
      flavor:()=>"He forgets his keycard, his phone is dead, and he spends twenty minutes locked out of the facility before a rookie finally lets him in. Teammates have not let it go." },
    { id:"sleepflight", title:"Caught Asleep on the Team Flight", repDelta:[-1,3],
      flavor:()=>"A photo of him asleep on the team plane, mouth wide open, makes its way around the group chat and then, inevitably, the internet." },
    { id:"charityrun", title:"Charity Foundation Takes Off", repDelta:[5,11],
      flavor:()=>"A foundation he started almost as an afterthought turns into a genuinely major operation. The league starts featuring it in broadcasts unprompted." },
    { id:"badfirstpitch", title:"Throws Out a Comically Bad First Pitch", repDelta:[-2,3],
      flavor:()=>"Invited to throw a ceremonial first pitch at a baseball game, he bounces it a full ten feet short of the plate. The clip outlives the actual game by years." },
    { id:"streamer", title:"Becomes an Unexpectedly Popular Video Game Streamer", repDelta:[1,5], minYear:2011,
      flavor:()=>"An offseason hobby streaming video games picks up a real audience — not huge, but loyal, and mostly there for the trash talk, not the gameplay." },
    { id:"conspiracy", title:"Accidentally Starts a Minor Conspiracy Theory", repDelta:[-1,4],
      flavor:()=>"An offhand, joking comment in an interview gets taken completely seriously by a corner of the internet, and now there's a real conspiracy theory with his name on it that he cannot talk his way out of." },
    { id:"babyannounce", title:"Announces He's Expecting", repDelta:[4,9],
      flavor:()=>"A pregnancy announcement, posted with zero warning, immediately becomes the most-liked thing he's ever put online — by a wide margin." },
    { id:"cameoshow", title:"Cameo on a TV Show", repDelta:[2,6],
      flavor:()=>"He plays a heightened version of himself in a two-episode arc on a network sitcom. His line delivery is, charitably, a work in progress. The internet loves it anyway." },
  ];
  function lifepathEventsFor(){
    const year = career.year;
    return LIFEPATH_EVENTS.filter(e=> !e.minYear || year>=e.minYear);
  }
  function renderLifepathEvent(ev){
    const content = document.getElementById("careerContent");
    const repDelta = randInt(ev.repDelta[0], ev.repDelta[1]);
    career.reputation = clamp(career.reputation + repDelta, 0, 100);
    career.leaguePopularity = clamp((career.leaguePopularity??50) + Math.round(repDelta*0.7), 0, 100);
    career.lifeEventLog.push({ year:career.year, title:ev.title, severity:"lifepath" });
    career.transactions.push(`${career.year}: ${ev.title}.`);
    content.innerHTML = eraWrap(decadeForYear(career.year), `
      <div class="ev-eyebrow">${career.year} · Off the Field</div>
      <h3>${ev.title}</h3>
      <p>${ev.flavor()}</p>
      <div class="rep-note">Effect: Reputation ${fmtDelta(repDelta)}.</div>
      <div class="event-choices"><button class="choice-btn" id="lifepathAck"><div class="cb-title">Continue</div></button></div>
    `, {tone: repDelta>=0 ? "good" : "bad"});
    document.getElementById("lifepathAck").addEventListener("click", secondaryLifeEventCheck);
  }
  function lifepathCheck(){
    if(Math.random()>=0.11) return false;
    const pool = lifepathEventsFor();
    if(!pool.length) return false;
    renderLifepathEvent(pick(pool));
    return true;
  }

  const ORG_EVENTS = [
    { id:"coachfired", title:"His Coach Gets Fired", repDelta:0, strengthDelta:[-10,-4], gmDelta:[-6,2], setFlag:"_orgTurmoil", schemeChangeChance:0.5,
      flavor:()=>"The coach who believed in him is out after a rough stretch. The new regime doesn't owe him anything." },
    { id:"coachextended", title:"His Coach Gets Extended", repDelta:0, strengthDelta:[3,8], gmDelta:[2,6], setFlag:"_orgStability",
      flavor:()=>"Ownership hands his coach a contract extension. Stability, for once, instead of another system change." },
    { id:"starleaves", title:"Top Weapon Walks in Free Agency", repDelta:0, strengthDelta:[-12,-5], target:"weapons", setFlag:null,
      flavor:()=>"The best receiver on the roster signs elsewhere for the money. The offense has to be rebuilt around what's left." },
    { id:"fotrust", title:"Front Office Hands Him the Keys", repDelta:[3,6], strengthDelta:[0,0], gmDelta:[6,12], setFlag:"_leverageBoost", cutShield:true,
      flavor:()=>"Management makes it official in the press: this is his team now, for better or worse. It won't hurt at the negotiating table." },
    { id:"relocation", title:"Relocation Rumors Swirl", repDelta:0, strengthDelta:[-6,6], setFlag:null,
      flavor:()=>"Ownership is publicly flirting with another city. Nothing's decided, but the locker room is distracted." },
    { id:"podcastembarrass", title:"His Girlfriend Airs Their Business on Her Podcast", repDelta:[-9,-3], strengthDelta:[0,0], setFlag:null,
      flavor:()=>"She goes viral dragging him on her show. Nothing illegal, nothing the league can touch — but it's everywhere, and none of it is flattering." },
    { id:"newgm", title:"New GM Takes Over", repDelta:0, strengthDelta:[-8,10], setFlag:null, resetGM:true, schemeChangeChance:0.35,
      flavor:()=>"A front-office shakeup. Could be a fresh voice with a real plan, could be a rebuild with no real place for him — nobody in the building knows yet either. Whatever relationship existed with the old GM doesn't carry over." },
    { id:"oline", title:"O-Line Overhaul in Free Agency", repDelta:0, strengthDelta:[4,11], target:"oline", setFlag:"_orgStability",
      flavor:()=>"The front office actually spends real money up front this offseason, and it shows up in the pocket immediately." },
    { id:"scandal_org", title:"Ownership Distracted by Off-field Controversy", repDelta:0, strengthDelta:[-9,-2], gmDelta:[-5,-1], setFlag:"_orgTurmoil",
      flavor:()=>"The owner's name is in the headlines for reasons that have nothing to do with football, and the whole building feels it." },
    { id:"viral_highlight", title:"A Highlight Goes Viral", repDelta:[3,7], strengthDelta:[0,0], setFlag:null,
      flavor:()=>"One incredible throw gets clipped and reposted everywhere. A nice ego boost, and not much else." },
    { id:"newstadium", title:"Team Opens a New Stadium", repDelta:[2,5], strengthDelta:[3,8], setFlag:null,
      flavor:()=>"A new billion-dollar stadium means new revenue, new energy, and ownership suddenly willing to spend to fill the seats." },
    { id:"ownershipsale", title:"Franchise Sold to New Ownership", repDelta:0, strengthDelta:[-8,8], setFlag:null,
      flavor:()=>"The team changes hands. Nobody in the building — including him — knows yet whether that's good news or bad." },
    { id:"gmbadblood", title:"Bad Blood With the GM", repDelta:0, strengthDelta:[0,0], gmDelta:[-18,-8], setFlag:null,
      flavor:()=>"A disagreement over usage, money, or just how a press conference got handled turns into something personal. The GM doesn't forget it." },
    { id:"gmtrust", title:"GM Publicly Backs Him", repDelta:[2,5], strengthDelta:[0,0], gmDelta:[10,18], setFlag:null,
      flavor:()=>"The general manager goes out of his way in a press conference to make it clear: this is his quarterback, full stop, no caveats." },
  ];
  // Called only for coachfired/newgm — front-office churn is the natural point a new play-caller
  // (and with him, a new offensive identity) shows up. Deliberately excludes the CURRENT scheme
  // from the reroll so "the scheme changed" always means something actually changed.
  function maybeChangeTeamScheme(){
    if(!career.teamScheme) return null;
    const others = SCHEMES.filter(s=>s.id!==career.teamScheme[career.teamId]);
    if(!others.length) return null;
    const next = pick(others);
    career.teamScheme[career.teamId] = next.id;
    return next;
  }

  /* ----- League News: the same "why did that team's grade move" narrative ORG_EVENTS gives the
     player's own team, extended league-wide to every OTHER team. Most seasons only a handful of
     teams roll a news event at all (see rollLeagueNews) -- most of the other ~25+ teams' grades
     that season just take the small residual noise/decline term below, no headline needed. Weights
     are deliberately percentile-shaped: the common entries move a team ±1-3, the two "big swing"
     entries (generational bust/breakout) are both rare (low weight) AND wider (±4-8), so a
     franchise-altering headline is a real but uncommon event, not routine season noise. ----- */
  const LEAGUE_NEWS_EVENTS = [
    { id:"draftbust", title:"Generational Draft Bust", weight:3, strengthDelta:[-8,-4],
      flavor:(team)=>`The ${team}' can't-miss rookie has looked lost through camp and the preseason — the kind of bust scouts will be dissecting for years.` },
    { id:"rookiestar", title:"Rookie Sensation Wins the Job", weight:4, strengthDelta:[3,7],
      flavor:(team)=>`A rookie nobody expected to start Week 1 has forced the ${team}' hand and taken the job outright.` },
    { id:"coachchange", title:"Coaching Change", weight:9, strengthDelta:[-5,4],
      flavor:(team)=>`The ${team} moved on from their head coach this offseason — could be a fresh system, could be a rebuild nobody's excited about yet.` },
    { id:"blockbuster", title:"Blockbuster Trade", weight:6, strengthDelta:[2,5],
      flavor:(team)=>`The ${team} sent a haul of draft capital for a proven difference-maker at a position of need.` },
    { id:"capcasualty", title:"Cap Casualties Gut the Roster", weight:7, strengthDelta:[-5,-1],
      flavor:(team)=>`A brutal cap crunch forced the ${team} to part ways with several longtime starters this offseason.` },
    { id:"freeagentwin", title:"Front Office Wins Free Agency", weight:6, strengthDelta:[2,5],
      flavor:(team)=>`The ${team} landed the best available name in free agency, and it wasn't particularly close.` },
    { id:"holdOut", title:"Star Holds Out of Camp", weight:5, strengthDelta:[-4,-1],
      flavor:(team)=>`A contract standoff kept the ${team}' best player out of camp all summer — chemistry and timing both took a hit.` },
    { id:"ownershipmeddling", title:"Ownership Meddling", weight:4, strengthDelta:[-4,-1],
      flavor:(team)=>`Report after report describes an owner overruling his own front office — the building is reportedly not a fun place to work right now.` },
    { id:"schemeclicks", title:"New Scheme Clicks Immediately", weight:5, strengthDelta:[2,4],
      flavor:(team)=>`A new coordinator's system fit the existing roster like a glove from day one of camp.` },
    { id:"injurywave", title:"Rash of Injuries in Camp", weight:5, strengthDelta:[-3,-1],
      flavor:(team)=>`An unusually bad run of camp injuries has already thinned the ${team}' depth chart before Week 1.` },
  ];
  function rollLeagueNews(year){
    const totalWeight = LEAGUE_NEWS_EVENTS.reduce((s,e)=>s+e.weight, 0);
    function pickWeighted(){
      let r = Math.random()*totalWeight;
      for(const e of LEAGUE_NEWS_EVENTS){ if(r<e.weight) return e; r -= e.weight; }
      return LEAGUE_NEWS_EVENTS[0];
    }
    // A handful of OTHER teams (never the player's own -- that's ORG_EVENTS' job) get a headline
    // this season, each independently, so most seasons feel different but no two feel alike.
    const others = TEAMS.filter(t=>t.id!==career.teamId);
    others.forEach(t=>{
      if(Math.random()>=0.1) return;
      const ev = pickWeighted();
      const delta = randInt(ev.strengthDelta[0], ev.strengthDelta[1]);
      career.leagueStrength[t.id] = clamp((career.leagueStrength[t.id]??60)+delta, 20, 96);
      career.leagueNewsLog.push({ year, teamId: t.id, title: ev.title, delta, flavor: ev.flavor(teamNameAt(t.id, year)) });
    });
  }
  function buildLeagueNewsFeedHTML(){
    const log = career.leagueNewsLog || [];
    if(!log.length) return `<div class="feed-wrap"><div class="feed-empty">No league news yet — check back after your rookie season.</div></div>`;
    const recent = log.slice(-16).reverse();
    const rows = recent.map(n=>`<div class="feed-line ${n.delta>=0?"good":"bad"}"><span class="feed-year tabular">${n.year}</span><span class="feed-text"><b>${svgEscape(teamNameAt(n.teamId, n.year))}</b> — ${svgEscape(n.title)} (${fmtDelta(n.delta)}). ${svgEscape(n.flavor)}</span></div>`).join("");
    return `<div class="feed-wrap">${rows}</div>`;
  }

  /* ----- Locker room & leadership: choice-driven interactions with teammates and coaches, not
     just stat rolls. Each event presents a genuine either/or, and the outcome — good or bad — is
     probabilistic rather than deterministic (the "right-sounding" choice usually works but can
     still backfire, and the riskier choice occasionally pays off big), so replaying the same
     event doesn't always play out the same way. The effect lands on career.teamStrength (the
     same "Team Grade" number every other system already reads and writes), matching the tester's
     own framing verbatim: "if it goes well the team rating increases, if the player chooses
     wrong it decreases." */
  const LOCKER_ROOM_EVENTS = [
    { id:"divawr", title:"The Diva Receiver",
      flavor:()=>"Your WR1 is skipping voluntary workouts, unhappy with his role and his target share. The rest of the room is starting to notice.",
      choices:[
        { id:"private", label:"Pull him aside, one-on-one", sub:"Handle it man-to-man, away from the cameras.", goodChance:0.72,
          goodText:"He shows up the next day. Not everything's fixed, but he knows you've got his back — and he plays like it.",
          badText:"He nods along in the meeting and keeps skipping practice anyway. Words without leverage don't move him.",
          goodDelta:[3,7], badDelta:[-4,-1] },
        { id:"public", label:"Call him out to the media", sub:"Make it about accountability, in public.", goodChance:0.35,
          goodText:"It works — he shows up humbled, and the rest of the room respects that you didn't let it slide.",
          badText:"He digs in, feels thrown under the bus, and now it's a real story instead of a locker-room issue.",
          goodDelta:[4,9], badDelta:[-9,-3] },
      ] },
    { id:"oline", title:"Befriending the O-Line",
      flavor:()=>"The offensive line room has its own culture — steak dinners, inside jokes, a code. Nobody said you're not welcome, but nobody's exactly invited you either.",
      choices:[
        { id:"buyin", label:"Buy the whole room dinner, no cameras", sub:"Show up, spend real money, stay off social media about it.", goodChance:0.78,
          goodText:"An old-school gesture for an old-school room, and it lands exactly right. Protection in the pocket gets a little more personal after this.",
          badText:"Appreciated, but it doesn't really move anything. A nice gesture, forgotten by Monday's film session.",
          goodDelta:[3,7], badDelta:[-2,0] },
        { id:"performative", label:"Post about it for the fans", sub:"Turn the gesture into good publicity.", goodChance:0.25,
          goodText:"Somehow it still works — the room laughs it off and appreciates the effort anyway.",
          badText:"The room clocks it immediately as a PR move, not a real one. That reads worse than doing nothing at all.",
          goodDelta:[2,5], badDelta:[-7,-2] },
      ] },
    { id:"mentorrookie", title:"Mentoring the Kid", minAge:30,
      flavor:()=>"A rookie at your position just got drafted — talented, a little lost, and clearly sizing up whether you're a threat or a resource.",
      choices:[
        { id:"teach", label:"Bring him in, teach him everything", sub:"Full playbook access, film sessions, the works.", goodChance:0.75,
          goodText:"He develops fast, the room notices the example you're setting, and it doesn't cost you a single snap.",
          badText:"He develops fast — fast enough that the front office starts openly wondering if they even need you anymore.",
          goodDelta:[4,8], badDelta:[-6,-2] },
        { id:"guard", label:"Keep him at arm's length", sub:"Protect your own job security instead.", goodChance:0.30,
          goodText:"Fair or not, it buys you time — and the front office reads it as competitive fire, not selfishness.",
          badText:"The room notices you freezing out a rookie who did nothing wrong. That's not a good look for a leader.",
          goodDelta:[1,4], badDelta:[-8,-3] },
      ] },
    { id:"rookieclass", title:"Setting the Tone for a Young Room",
      flavor:()=>"This year's draft class brought in a wave of new faces. Nobody's told them how things work here yet.",
      choices:[
        { id:"structure", label:"Run your own extra film sessions", sub:"Put in the unpaid extra hours yourself.", goodChance:0.70,
          goodText:"It becomes a standing tradition. The whole young core starts playing noticeably faster.",
          badText:"Attendance is spotty and it fizzles out after a few weeks. The effort's noticed; the results aren't.",
          goodDelta:[3,6], badDelta:[-2,0] },
        { id:"leaveit", label:"Let the coaches handle it", sub:"That's what they're paid for.", goodChance:0.40,
          goodText:"Not every leader needs to run study hall — the room respects that you trust the staff to do their job.",
          badText:"The young guys quietly notice you never showed up for them. It costs you something in the room.",
          goodDelta:[0,3], badDelta:[-5,-1] },
      ] },
    { id:"contractjealousy", title:"A Teammate Resents Your Contract",
      flavor:()=>"A respected veteran on the roster has been grumbling — not to your face, but loud enough for it to get back to you — about what you're making compared to him.",
      choices:[
        { id:"talkit", label:"Address it directly with him", sub:"Have the uncomfortable conversation.", goodChance:0.68,
          goodText:"It's awkward for about five minutes, then it's actually fine. He respects that you didn't duck it.",
          badText:"He wasn't looking for a conversation, he was looking to vent. Now it's just awkward, permanently.",
          goodDelta:[2,6], badDelta:[-5,-1] },
        { id:"ignore", label:"Let it blow over on its own", sub:"Not every fire needs to be put out personally.", goodChance:0.45,
          goodText:"It does blow over, on its own, the way most locker-room grumbling eventually does.",
          badText:"It doesn't blow over — it curdles into something the whole room can feel on a bad Sunday.",
          goodDelta:[0,3], badDelta:[-6,-2] },
      ] },
    { id:"coachfriction", title:"Friction With a Position Coach",
      flavor:()=>"You and the position coach see the offense differently, and it's starting to show in meetings — pointed questions, a little too much sarcasm.",
      choices:[
        { id:"private2", label:"Hash it out behind closed doors", sub:"Keep it between the two of you.", goodChance:0.70,
          goodText:"You find common ground, and the meetings get a lot less tense after that.",
          badText:"He hears you out and nothing really changes. At least the room didn't see it happen.",
          goodDelta:[2,6], badDelta:[-2,0] },
        { id:"pushback", label:"Push back in front of the room", sub:"Make your case where everyone can hear it.", goodChance:0.30,
          goodText:"A bold move — and it actually works. The room quietly respects that you didn't back down.",
          badText:"It reads as showing him up in front of his own players. That's a hard thing to walk back.",
          goodDelta:[3,7], badDelta:[-8,-3] },
      ] },
  ];
  function lockerRoomEventsFor(){
    return LOCKER_ROOM_EVENTS.filter(e=> !e.minAge || career.age>=e.minAge);
  }
  function renderLockerRoomEvent(ev){
    const content = document.getElementById("careerContent");
    const choicesHtml = ev.choices.map((c,i)=>
      `<button class="choice-btn" data-i="${i}" id="lockerChoice${i}"><div class="cb-title">${c.label}</div><div class="cb-sub">${c.sub}</div></button>`
    ).join("");
    content.innerHTML = eraWrap(decadeForYear(career.year), `
        <div class="ev-eyebrow">${career.year} · Locker Room</div>
        <h3>${ev.title}</h3>
        <p>${ev.flavor()}</p>
        <div class="event-choices">${choicesHtml}</div>
      `, {tone:"neutral"});
    ev.choices.forEach((c,i)=>{
      document.getElementById(`lockerChoice${i}`).addEventListener("click", ()=> resolveLockerRoomEvent(ev, c));
    });
  }
  function resolveLockerRoomEvent(ev, choice){
    const content = document.getElementById("careerContent");
    const good = Math.random() < choice.goodChance;
    const delta = good ? randInt(choice.goodDelta[0], choice.goodDelta[1]) : randInt(choice.badDelta[0], choice.badDelta[1]);
    career.teamStrength = clamp(career.teamStrength + delta, 20, 97);
    career.leagueStrength[career.teamId] = career.teamStrength;
    career.lifeEventLog.push({ year:career.year, title:ev.title, severity: good?"locker-good":"locker-bad" });
    career.transactions.push(`${career.year}: ${ev.title} — ${good?"handled it well":"handled it poorly"} (team grade ${fmtDelta(delta)}).`);
    content.innerHTML = eraWrap(decadeForYear(career.year), `
        <div class="ev-eyebrow">${career.year} · Locker Room</div>
        <h3>${ev.title}</h3>
        <p>${good ? choice.goodText : choice.badText}</p>
        <div class="rep-note">Effect: Team grade ${fmtDelta(delta)}.</div>
        <div class="event-choices"><button class="choice-btn" id="lockerAck"><div class="cb-title">Continue</div></button></div>
      `, {tone: good?"good":"bad"});
    document.getElementById("lockerAck").addEventListener("click", secondaryLifeEventCheck);
  }

  function lifeEventCheck(){
    if(career.seasonNumber<2){ waiverCheck(); return; }
    const decade = decadeForYear(career.year);
    // Relationship arc and general lifepath flavor get first priority, ahead of the rest of the
    // chain below -- they're pure narrative/reputation beats, never competing with an actual
    // infraction or org-news roll for the same season's "slot."
    if(relationshipCheck()) return;
    if(lifepathCheck()) return;
    // Very-low-odds roll for a bizarre, career-altering easter egg, checked independently and
    // ahead of the ordinary infraction roll -- roughly 1-in-165 seasons, so most careers never see
    // one and a handful of very long careers might see exactly one.
    const rarePool = rareEventsFor();
    if(rarePool.length && Math.random() < 0.006){ renderInfractionEvent(pick(rarePool)); return; }
    const dec = eraEffective(career.age, decade).DEC;
    const infractionChance = clamp(0.02 + Math.max(0,(62-dec))*0.0026, 0.01, 0.13);
    const infractionPool = infractionEventsFor();
    if(infractionPool.length && Math.random()<infractionChance){ renderInfractionEvent(pick(infractionPool)); return; }
    const lockerPool = lockerRoomEventsFor();
    if(lockerPool.length && Math.random()<0.16){ renderLockerRoomEvent(pick(lockerPool)); return; }
    const prominence = playerProminence();
    const notableChance = clamp(0.065 + prominence*0.0032, 0.045, 0.32);
    if(Math.random()<notableChance){
      if(Math.random()<0.55){ renderPositiveEvent(pick(POSITIVE_EVENTS)); return; }
      renderOrgEvent(pick(orgEventsFor()));
      return;
    }
    waiverCheck();
  }

  // A second, independent, lower-odds roll for a different life event later in the same
  // offseason -- so a season can occasionally stack an infraction/positive/org beat with one
  // more instead of always capping at exactly one, without the complexity (or piling-on) of
  // letting a second infraction/suspension land on top of the first one this same season.
  function secondaryLifeEventCheck(){
    if(lifepathCheck()) return;
    if(Math.random() < 0.12){
      const roll = Math.random();
      if(roll<0.4){ renderPositiveEvent(pick(POSITIVE_EVENTS)); return; }
      if(roll<0.6){
        const lockerPool = lockerRoomEventsFor();
        if(lockerPool.length){ renderLockerRoomEvent(pick(lockerPool)); return; }
      }
      renderOrgEvent(pick(orgEventsFor()));
      return;
    }
    waiverCheck();
  }

  function renderInfractionEvent(ev){
    const content = document.getElementById("careerContent");
    const flavor = ev.flavor(decadeForYear(career.year));
    let stakesText;
    if(ev.severity==="career-end"){
      stakesText = "At stake: banned from the league, career over.";
    } else if(ev.severity==="career-multi"){
      stakesText = `At stake: ${ev.suspensionSeasons[0]}-${ev.suspensionSeasons[1]} seasons suspended, released outright, reputation ${fmtDelta(ev.repHit[0])} to ${fmtDelta(ev.repHit[1])}.`;
    } else {
      const gLo = ev.suspensionGames ? ev.suspensionGames[0] : 0, gHi = ev.suspensionGames ? ev.suspensionGames[1] : 0;
      stakesText = `At stake: reputation ${fmtDelta(ev.repHit[0])} to ${fmtDelta(ev.repHit[1])}${gHi>0 ? ` · up to ${gHi} game${gHi===1?"":"s"} suspended` : ""}.`;
    }
    content.innerHTML = eraWrap(decadeForYear(career.year), `
        <div class="ev-eyebrow">${career.year} · Off the Field</div>
        <h3>${ev.title}</h3>
        <p>${flavor}</p>
        <div class="rep-note">${stakesText}</div>
        <div class="event-choices">
          <button class="choice-btn" id="infAccept"><div class="cb-title">${ev.severity==="career-end"?"Face the consequences":"Accept the discipline"}</div><div class="cb-sub">Take what's coming and move forward.</div></button>
          ${ev.mitigable ? `<button class="choice-btn" id="infFight"><div class="cb-title">Fight it — PR push &amp; legal team</div><div class="cb-sub">Might reduce it. Might make it worse.</div></button>` : ``}
        </div>
      `, {tone:"bad"});
    document.getElementById("infAccept").addEventListener("click", ()=> resolveInfraction(ev, false));
    const fightBtn = document.getElementById("infFight");
    if(fightBtn) fightBtn.addEventListener("click", ()=> resolveInfraction(ev, true));
  }

  function resolveInfraction(ev, fought){
    const content = document.getElementById("careerContent");
    let games = ev.suspensionGames ? randInt(ev.suspensionGames[0], ev.suspensionGames[1]) : 0;
    let repHit = Array.isArray(ev.repHit) ? randInt(ev.repHit[0], ev.repHit[1]) : ev.repHit;
    let outcomeText;
    if(fought){
      if(Math.random()<0.45){
        games = Math.round(games*0.35); repHit = Math.round(repHit*0.5);
        outcomeText = "The campaign works. The story fades faster than it should have, and the league goes easier than it could have.";
      } else {
        games = Math.round(games*1.6)+1; repHit = Math.round(repHit*1.7);
        outcomeText = "It backfires. The story won't die, the league throws the book at him, and the locker room notices.";
      }
    } else {
      outcomeText = games>0 ? "The league hands down its punishment, and that's that." : "A fine, a headline, and it blows over.";
    }
    career.reputation = clamp(career.reputation + repHit, 0, 100);
    // A scandal costs more nationally than it does with the home fanbase — the league office and
    // the rest of the country only know the headline, while the locals have years of context.
    career.fanSupport = clamp((career.fanSupport ?? 50) + Math.round(repHit*0.5), 0, 100);
    career.leaguePopularity = clamp((career.leaguePopularity ?? 50) + Math.round(repHit*0.7), 0, 100);
    career.lifeEventLog.push({ year:career.year, title:ev.title, severity:ev.severity, legendary: !!ev.legendary });

    if(ev.severity==="career-end"){
      career.transactions.push(`${career.year}: ${ev.title} — banned from the league.`);
      career.banned = true;
      // Stashed so finishCareer()/buildHofNarrative() can name the actual event that ended things,
      // instead of every forced-out career reading like a voluntary retirement (see exitReason).
      career._bannedEventTitle = ev.title;
      career._bannedEventNote = ev.finalFlavor || null;
      content.innerHTML = eraWrap(decadeForYear(career.year), `
        <div class="ev-eyebrow">${career.year} · League Discipline</div>
        <h3>Banned from the NFL.</h3>
        <p>${ev.finalFlavor}</p>
        <div class="rep-note">Effect: Reputation ${fmtDelta(repHit)} · career over.</div>
        <div class="event-choices"><button class="choice-btn" id="banAck"><div class="cb-title">See the final verdict</div></button></div>
      `, {tone:"bad"});
      document.getElementById("banAck").addEventListener("click", ()=>{ career.exitReason="banned"; finishCareer(); });
      return;
    }
    if(ev.severity==="career-multi"){
      career.suspensionSeasonsRemaining = randInt(ev.suspensionSeasons[0], ev.suspensionSeasons[1]);
      const oldTeam = teamNameAt(career.teamId, career.year);
      career.transactions.push(`${career.year}: ${ev.title} — suspended ${career.suspensionSeasonsRemaining} season(s), released by the ${oldTeam}.`);
      career.contract = { apy:0, years:0, tier:"minimum" };
      career._comebackFromSuspension = true;
      content.innerHTML = eraWrap(decadeForYear(career.year), `
        <div class="ev-eyebrow">${career.year} · League Discipline</div>
        <h3>Suspended ${career.suspensionSeasonsRemaining} season${career.suspensionSeasonsRemaining===1?"":"s"}.</h3>
        <p>${outcomeText} The ${oldTeam} cut ties immediately. Whatever comes next, he'll have to earn it back.</p>
        <div class="rep-note">Effect: Reputation ${fmtDelta(repHit)} · ${career.suspensionSeasonsRemaining} season${career.suspensionSeasonsRemaining===1?"":"s"} suspended · released, contract voided.</div>
        <div class="event-choices"><button class="choice-btn" id="suspAck"><div class="cb-title">Continue</div></button></div>
      `, {tone:"bad"});
      document.getElementById("suspAck").addEventListener("click", ()=>{ nextSeason(); });
      return;
    }
    // minor/moderate/major: reuse the missed-games/performance-penalty pipeline for the
    // suspension itself (tracked in its own bucket so the season narrative can tell it apart
    // from an actual injury), and let the reputation hit ripple into ordinary roster-cut risk
    // downstream.
    career._suspensionMissedGames = (career._suspensionMissedGames||0) + games;
    if(games>=6) career._injuryPenalty = (career._injuryPenalty||0) + 8;
    content.innerHTML = eraWrap(decadeForYear(career.year), `
      <div class="ev-eyebrow">${career.year} · Off the Field</div>
      <h3>${ev.title}${games>0?` — ${games}-game suspension`:""}</h3>
      <p>${outcomeText}</p>
      <div class="rep-note">Effect: Reputation ${fmtDelta(repHit)}${games>0?` · ${games}-game suspension`:""}${games>=6?" · lingering performance hit":""}.</div>
      <div class="event-choices"><button class="choice-btn" id="infAck"><div class="cb-title">Continue</div></button></div>
    `, {tone:"bad"});
    document.getElementById("infAck").addEventListener("click", ()=>{
      career.transactions.push(`${career.year}: ${ev.title}${games>0?` (${games}-game suspension)`:""}.`);
      secondaryLifeEventCheck();
    });
  }

  function renderPositiveEvent(ev){
    const content = document.getElementById("careerContent");
    const repDelta = randInt(ev.repDelta[0], ev.repDelta[1]);
    career.reputation = clamp(career.reputation + repDelta, 0, 100);
    career.fanSupport = clamp((career.fanSupport ?? 50) + Math.round(repDelta*0.4), 0, 100);
    career.leaguePopularity = clamp((career.leaguePopularity ?? 50) + Math.round(repDelta*0.6), 0, 100);
    if(ev.boosts && ev.boosts.length){
      career.tempBoosts = career.tempBoosts || [];
      ev.boosts.forEach(b=> career.tempBoosts.push({ key:b.key, delta:b.delta, seasonsLeft:ev.seasons }));
    }
    if(ev.cutShield) career._cutShieldSeasons = 1;
    career.lifeEventLog.push({ year:career.year, title:ev.title, severity:"positive" });
    career.transactions.push(`${career.year}: ${ev.title}.`);
    const boostsText = ev.boosts && ev.boosts.length
      ? ev.boosts.map(b=> `${(ATTR_BY_KEY[b.key]||{}).label||b.key} ${fmtDelta(b.delta)} for ${ev.seasons} season${ev.seasons===1?"":"s"}`).join(" · ")
      : "";
    content.innerHTML = eraWrap(decadeForYear(career.year), `
      <div class="ev-eyebrow">${career.year} · Off the Field</div>
      <h3>${ev.title}</h3>
      <p>${ev.flavor()}</p>
      <div class="rep-note">Effect: Reputation ${fmtDelta(repDelta)}${boostsText ? ` · ${boostsText}` : ""}.</div>
      <div class="event-choices"><button class="choice-btn" id="posAck"><div class="cb-title">Continue</div></button></div>
    `, {tone:"good"});
    document.getElementById("posAck").addEventListener("click", secondaryLifeEventCheck);
  }

  function renderOrgEvent(ev){
    const content = document.getElementById("careerContent");
    const repDelta = Array.isArray(ev.repDelta) ? randInt(ev.repDelta[0], ev.repDelta[1]) : ev.repDelta;
    if(repDelta) career.reputation = clamp(career.reputation + repDelta, 0, 100);
    let strengthDelta = 0;
    if(ev.strengthDelta && (ev.strengthDelta[0]!==0 || ev.strengthDelta[1]!==0)){
      strengthDelta = randInt(ev.strengthDelta[0], ev.strengthDelta[1]);
      // Most org events move the whole team; "oline"/"starleaves" specifically target the
      // Supporting Cast grades instead, since those are a distinct signal from overall team quality.
      if(ev.target==="oline") career.oline = clamp(career.oline + strengthDelta, 20, 99);
      else if(ev.target==="weapons") career.weapons = clamp(career.weapons + strengthDelta, 20, 99);
      else {
        career.teamStrength = clamp(career.teamStrength + strengthDelta, 20, 97);
        career.leagueStrength[career.teamId] = career.teamStrength;
      }
    }
    // GM relations: most org events either nudge the existing relationship (gmDelta) or, for a
    // literal front-office change (resetGM, i.e. "newgm"), wipe the slate — a brand-new GM has no
    // history with him one way or the other, good or bad.
    let gmDelta = 0;
    if(ev.resetGM){
      const newVal = clamp(50 + randInt(-20,20), 0, 100);
      gmDelta = newVal - (career.gmRelationship ?? 50);
      career.gmRelationship = newVal;
    } else if(ev.gmDelta){
      gmDelta = randInt(ev.gmDelta[0], ev.gmDelta[1]);
      career.gmRelationship = clamp((career.gmRelationship ?? 50) + gmDelta, 0, 100);
    }
    let schemeNote = "";
    if(ev.schemeChangeChance && Math.random()<ev.schemeChangeChance){
      const newScheme = maybeChangeTeamScheme();
      if(newScheme) schemeNote = ` The offensive playbook changes with it — the team now runs a ${newScheme.name} system.`;
    }
    if(ev.setFlag) career[ev.setFlag] = true;
    if(ev.cutShield) career._cutShieldSeasons = 1;
    career.lifeEventLog.push({ year:career.year, title:ev.title, severity:"organization" });
    career.transactions.push(`${career.year}: ${ev.title}${schemeNote?" — new offensive scheme installed":""}.`);
    // tone follows the actual rolled outcome, not just a fixed per-event label -- a swingy event
    // like "New GM Takes Over" (strengthDelta:[-8,10]) reads as good or bad card styling based on
    // which way the dice actually landed this time, not a coin-flip-blind neutral every time.
    const netGood = repDelta>0 || strengthDelta>0 || gmDelta>0 || ev.setFlag==="_orgStability" || ev.setFlag==="_leverageBoost";
    const netBad = repDelta<0 || strengthDelta<0 || gmDelta<0 || ev.setFlag==="_orgTurmoil";
    const good = netGood && !netBad;
    const effectParts = [];
    if(repDelta) effectParts.push(`Reputation ${fmtDelta(repDelta)}`);
    if(strengthDelta) effectParts.push(`${ev.target==="oline"?"O-Line grade":ev.target==="weapons"?"Weapons grade":"Team grade"} ${fmtDelta(strengthDelta)}`);
    if(gmDelta) effectParts.push(`GM relations ${fmtDelta(gmDelta)}`);
    if(!effectParts.length) effectParts.push("No direct stat change — narrative only.");
    content.innerHTML = eraWrap(decadeForYear(career.year), `
      <div class="ev-eyebrow">${career.year} · Around the Building</div>
      <h3>${ev.title}</h3>
      <p>${ev.flavor()}${schemeNote}</p>
      <div class="rep-note">Effect: ${effectParts.join(" · ")}.</div>
      <div class="event-choices"><button class="choice-btn" id="orgAck"><div class="cb-title">Continue</div></button></div>
    `, {tone: good ? "good" : (netBad ? "bad" : "neutral")});
    document.getElementById("orgAck").addEventListener("click", secondaryLifeEventCheck);
  }

  // A durable build plays longer, a fragile one wears out sooner -- DUR is the one attribute
  // deliberately left un-adjusted by era or scheme (see the ERA_ATTR_MULT note above) specifically
  // because it's meant to read as "how long can THIS guy's body hold up," so it's the natural lever
  // for how long a career can run at all, not just how often a given season gets interrupted. 41 was
  // previously a flat wall for every build regardless of DUR; now it's what an average (65) DUR
  // build gets, sliding to as low as 35 for a truly fragile build and as high as 45 for an elite-DUR
  // one who plays like he's ageless. Also feeds waiverCheck's age-related roster risk below, so a
  // high-DUR vet doesn't just play longer -- teams also don't start pushing him out the door as early.
  // Grounded in real NFL career-length data rather than an invented curve. Sourced numbers: QBs on
  // an active roster average ~5.4 years (Statista, Sept-2025 active-roster survey) -- but that pool
  // is dragged down hard by camp arms and career backups who never really start. Two better anchors
  // for "a build good enough to be drafted and handed a starting job" (this game's entire premise)
  // are the reported all-position averages for first-round picks (~9.3 years) and for players with
  // real Pro-Bowl-caliber careers (~11.7 years) (RunRepeat's NFL career-length research review) --
  // this game's mean sits between those two. There's no single published stddev for "starter career
  // length" to lift directly, so 4.5 years is a synthesized estimate consistent with the spread those
  // sources imply (a 2-3 year career for an outright bust, 20+ for a true ironman) -- documented here
  // instead of asserted as more precise than it is. DUR runs 10-99 across every build in the game
  // (the attribute-slider floor/ceiling used everywhere else, e.g. the Build Editor); 65 is the same
  // flat "neutral" value the rest of the sim already treats DUR as when it isn't being adjusted (see
  // neutralEffective). DUR=10 -- the literal floor of the scale, not just "low" -- lands ~2.5 standard
  // deviations below the mean, matching a real-world true outlier; DUR=99 lands ~2.5 above it, checked
  // against the longest QB career ever actually played (George Blanda, 26 seasons) as a sanity ceiling.
  const STARTER_CAREER_MEAN_YEARS = 9.5;
  const STARTER_CAREER_STDDEV_YEARS = 4.5;
  const DUR_NEUTRAL = 65, DUR_FLOOR = 10, DUR_CEIL = 99, DUR_EXTREME_Z = 2.5;
  function durabilityCareerYears(dur){
    const d = clamp(dur, DUR_FLOOR, DUR_CEIL);
    const z = d>=DUR_NEUTRAL
      ? ((d-DUR_NEUTRAL)/(DUR_CEIL-DUR_NEUTRAL)) * DUR_EXTREME_Z
      : ((d-DUR_NEUTRAL)/(DUR_NEUTRAL-DUR_FLOOR)) * DUR_EXTREME_Z;
    // floor of 1 (not 0) -- even the single worst-possible-durability build gets to actually play
    // his drafted rookie season before the numbers can end it; a true DUR=10 build then faces the
    // hard cap the very next offseason, which is exactly the "one and done" outcome that grade
    // implies. Ceiling of 26 matches Blanda's real record rather than inventing a fictional max.
    return clamp(STARTER_CAREER_MEAN_YEARS + z*STARTER_CAREER_STDDEV_YEARS, 1, 26);
  }
  function durabilityAgeCap(){
    const dur = build ? build.DUR : DUR_NEUTRAL;
    return clamp(Math.round(22 + durabilityCareerYears(dur)), 23, 48);
  }
  // Roster-cut "aging vet" scrutiny (waiverCheck) and career-arc flavor text (renderSeasonCard)
  // both need a THIS-BUILD-relative "starting to look old" age, but scaling it 1:1 with the hard
  // durability cap above breaks down at the extremes -- a DUR=10 build's cap sits at 23, and nobody
  // should read as a declining veteran at 23. Front offices and fans mostly react to how a guy is
  // actually playing and moving, not a durability grade nobody in-universe can see, so this damps
  // the swing to 40% of how far this build's cap sits from the neutral (DUR=65) cap of 32 -- e.g. a
  // fragile build's scrutiny starts a few years earlier than league-average, an ironman's a few
  // years later, but nothing like the full spread of the underlying durability curve.
  function agingVetThreshold(){
    const cap = durabilityAgeCap();
    return Math.round(32 + (cap-32)*0.4);
  }

  /* ----- career loop control -----
     Priority each offseason: age cap → banned? → serving a suspension? → life event → waived? →
     expansion draft? → traded? → contract expiring? → injury? → play the season.
     Each stage either renders an event and pauses (its buttons call the next stage), or falls through. */
  function advanceCareer(){
    if(career.age>=durabilityAgeCap()){ career.exitReason="age"; career.forcedOut=false; finishCareer(); return; }
    if(career.banned){ career.exitReason="banned"; finishCareer(); return; }
    if(career.suspensionSeasonsRemaining>0){ renderSuspensionYear(); return; }
    if(career.injuryLeaveSeasonsRemaining>0){ renderInjuryLeaveYear(); return; }
    lifeEventCheck();
  }

  function renderSuspensionYear(){
    const content = document.getElementById("careerContent");
    career.suspensionSeasonsRemaining--;
    const remaining = career.suspensionSeasonsRemaining;
    content.innerHTML = eraWrap(decadeForYear(career.year), `
        <div class="ev-eyebrow">${career.year} · League Suspension</div>
        <h3>Still serving the ban.</h3>
        <p>${remaining>0 ? `The league isn't budging. ${remaining} more season${remaining===1?"":"s"} before he's eligible to play again.` : `The suspension is over. Now it's a question of whether anyone still wants him.`}</p>
        <div class="event-choices"><button class="choice-btn" id="suspContinue"><div class="cb-title">${remaining>0?"Wait it out":"Test the market"}</div></button></div>
      `, {tone:"bad"});
    document.getElementById("suspContinue").addEventListener("click", nextSeason);
  }

  function renderInjuryLeaveYear(){
    const content = document.getElementById("careerContent");
    career.injuryLeaveSeasonsRemaining--;
    const remaining = career.injuryLeaveSeasonsRemaining;
    const teamName = teamNameAt(career.teamId, career.year);
    content.innerHTML = eraWrap(decadeForYear(career.year), `
        <div class="ev-eyebrow">${career.year} · Injured Reserve</div>
        <h3>Still rehabbing.</h3>
        <p>${remaining>0 ? `Another year of rehab before he's medically cleared. The ${teamName} are paying him to get better, not to play.` : `He's finally cleared. Now the real question: does the arm — and the nerve — still work like it used to?`}</p>
        <div class="event-choices"><button class="choice-btn" id="injLeaveContinue"><div class="cb-title">${remaining>0?"Keep rehabbing":"Report back to camp"}</div></button></div>
      `, {tone:"bad"});
    document.getElementById("injLeaveContinue").addEventListener("click", nextSeason);
  }

  function waiverCheck(){
    const decade = decadeForYear(career.year);
    const effOverall = computeEffOverall(career.age, decade);
    // "aging vet" scrutiny now kicks in relative to THIS build's own durability-adjusted career
    // window (see durabilityAgeCap) instead of a flat age-32/33 that treated a max-DUR and
    // min-DUR build identically -- a durable build gets treated like a reliable veteran for
    // longer, a fragile one starts looking like a decline case earlier.
    const nearEndAge = agingVetThreshold();
    const badThreshold = career.age>=nearEndAge ? 56 : 50;
    if(effOverall<badThreshold) career.badStreak = (career.badStreak||0)+1; else career.badStreak = 0;
    // real rosters get younger as a QB ages late in his window regardless of how well he's still
    // playing — succession planning, cap crunches, a coaching change — so even a still-productive
    // build faces meaningfully rising churn risk late in a career, not just a hard wall at the cap.
    const ageRisk = career.age>nearEndAge ? (career.age-nearEndAge)*0.03 : 0;
    // a battered reputation (a scandal, a bad PR fight) raises ordinary roster risk too — teams
    // are quicker to move on from a name that's become a distraction. Front-office turmoil from
    // a coaching change does the same, one-time, for the season it happens.
    const repRisk = career.reputation<35 ? (35-career.reputation)*0.012 : 0;
    const turmoilRisk = career._orgTurmoil ? 0.08 : 0;
    const stabilityRelief = career._orgStability ? 0.05 : 0;
    career._orgTurmoil = false; career._orgStability = false;
    // Relationships are supposed to matter, not just be a number on a screen: a GM who trusts you
    // and a fanbase that loves you both make the front office measurably more reluctant to cut
    // ties, the same way bad blood with the GM or a booed-out-of-town reputation makes it easier
    // for them to move on. League-wide fame gets a smaller version of the same effect (a bigger
    // name is a bigger story to cut). These used to sit on career untouched by roster-cut risk
    // entirely -- only the separate `reputation` stat fed repRisk above.
    const gmRelief = clamp(((career.gmRelationship ?? 50)-50)*0.0032, -0.14, 0.14);
    const fanRelief = clamp(((career.fanSupport ?? 50)-50)*0.0026, -0.11, 0.11);
    const popRelief = clamp(((career.leaguePopularity ?? 50)-50)*0.0014, -0.06, 0.06);
    // A one-season shield after the org just publicly anointed him (named captain, made the vocal
    // leader of a turnaround, handed the keys by the front office) so that vote of confidence and
    // a roster cut don't land in the same offseason and read as whiplash -- addresses the exact
    // "named captain, cut right after" complaint.
    const captainShield = career._cutShieldSeasons>0 ? 0.09 : 0;
    if(career._cutShieldSeasons>0) career._cutShieldSeasons--;
    const cutChance = clamp((badThreshold-effOverall)*0.025 + career.badStreak*0.06 + ageRisk + repRisk + turmoilRisk
      - stabilityRelief - gmRelief - fanRelief - popRelief - captainShield, 0.02, 0.75);
    if(career.seasonNumber>=3 && Math.random()<cutChance){ renderWaivedEvent(effOverall, decade); return; }
    expansionDraftCheck();
  }

  function renderWaivedEvent(effOverall, decade){
    const oldTeam = teamNameAt(career.teamId, career.year);
    // A well-liked, well-known name gets more benefit of the doubt on the open market -- some other
    // front office is more willing to take a flier on a guy the fanbase already loves or the league
    // already knows, even off a release.
    const marketRelief = clamp(((career.fanSupport ?? 50)-50)*0.0016 + ((career.leaguePopularity ?? 50)-50)*0.0012, -0.06, 0.10);
    const reSignChance = clamp(0.7 - (career.age-26)*0.03 - career.badStreak*0.08 + marketRelief, 0.05, 0.85);
    const canSign = Math.random()<reSignChance;
    let offerTeam=null, offerApy=0;
    if(canSign){
      // A cut is still a cut (a "prove-it" deal, not top dollar) but the destination shouldn't be
      // capped at a flat 15-60 team grade regardless of who's being cut -- a real proven starter
      // still draws interest from a genuinely good team looking for a value/prove-it flier, even
      // right after a surprising release. Range scales up with the player's own recent overall.
      const lo = clamp(15 + (effOverall-50)*0.5, 15, 55);
      const hi = clamp(60 + (effOverall-50)*0.7, 60, 92);
      offerTeam = pickTeamByStrength(career.year, career.teamId, lo, hi);
      offerApy = Math.round(veteranAPY(decade,"minimum") * (Math.random()<0.3?1.4:1));
    }
    const content = document.getElementById("careerContent");
    const choices = canSign ? `
        <button class="choice-btn" id="waSign"><div class="cb-title">Sign a prove-it deal with the ${teamNameAt(offerTeam.id, career.year)}</div><div class="cb-sub">${fmtMoney(offerApy)}/yr, no guarantees — just a shot at a backup job.</div></button>
        <button class="choice-btn" id="waRetire"><div class="cb-title">Call it a career</div><div class="cb-sub">Walk away on your own terms instead.</div></button>`
      : `<button class="choice-btn" id="waRetire"><div class="cb-title">There's nothing left.</div><div class="cb-sub">No team is calling. The league has moved on.</div></button>`;
    content.innerHTML = eraWrap(decadeForYear(career.year), `
        <div class="ev-eyebrow">Roster Cuts · ${career.year}</div>
        <h3>Released by the ${oldTeam}.</h3>
        <p>${effOverall<40 ? "The tape hasn't been good, and everyone in the building knows it." : "A numbers game, a coaching change, a cap crunch — the reasons don't matter. You're off the roster."}</p>
        <div class="event-choices">${choices}</div>
      `, {tone:"bad"});
    const signBtn = document.getElementById("waSign");
    if(signBtn) signBtn.addEventListener("click", ()=>{
      career.transactions.push(`${career.year}: Released by the ${oldTeam}, signed by the ${teamNameAt(offerTeam.id,career.year)} on a minimum deal.`);
      career.teamId = offerTeam.id; career.teamStrength = career.leagueStrength[offerTeam.id]; career.seasonsWithTeam = 0;
      career.oline = rollSupportingCastGrade(career.teamStrength); career.weapons = rollSupportingCastGrade(career.teamStrength);
      career.contract = { apy: offerApy, years: 1, tier: "minimum" };
      career.badStreak = 0;
      checkInjuryThenPlay();
    });
    document.getElementById("waRetire").addEventListener("click", ()=>{
      career.exitReason = "waived";
      career.forcedOut = true;
      career.transactions.push(`${career.year}: Released by the ${oldTeam}. Didn't play again.`);
      finishCareer();
    });
  }

  /* ----- expansion draft: fires the one season a franchise is about to join the league. His
     current team can't protect everyone — the more he actually means to the roster, the safer
     he is, but exposure alone doesn't guarantee the new team actually spends a pick on him. ----- */
  function expansionDraftCheck(){
    const nextYear = career.year+1;
    const newTeams = TEAMS.filter(t=>t.start===nextYear && t.id!==career.teamId);
    if(!newTeams.length){ tradeCheck(); return; }
    const decade = decadeForYear(career.year);
    const effOverall = computeEffOverall(career.age, decade);
    const prominence = playerProminence();
    const protectChance = clamp(0.25 + prominence*0.007 + (effOverall-60)*0.01, 0.05, 0.95);
    if(Math.random()<protectChance){ tradeCheck(); return; }
    const pickChance = clamp(0.12 + (effOverall-50)*0.006, 0.04, 0.5);
    if(Math.random()<pickChance){ renderExpansionDraftEvent(pick(newTeams)); return; }
    tradeCheck();
  }

  function renderExpansionDraftEvent(newTeam){
    const content = document.getElementById("careerContent");
    const oldTeam = teamNameAt(career.teamId, career.year);
    const newTeamName = teamNameAt(newTeam.id, career.year+1);
    content.innerHTML = eraWrap(decadeForYear(career.year), `
        <div class="ev-eyebrow">Expansion Draft · ${career.year}</div>
        <h3>Left unprotected — and the ${newTeamName} want him.</h3>
        <p>The ${oldTeam} could only protect so many names before the new franchise picked through the rest of the roster. He's the veteran they build the expansion team around instead.</p>
        <div class="event-choices"><button class="choice-btn" id="expAck"><div class="cb-title">Report to the ${newTeamName}</div></button></div>
      `);
    document.getElementById("expAck").addEventListener("click", ()=>{
      career.transactions.push(`${career.year}: Left unprotected, selected by the expansion ${newTeamName}.`);
      career.teamId = newTeam.id;
      career.teamStrength = career.leagueStrength[newTeam.id] ?? 45;
      career.leagueStrength[newTeam.id] = career.teamStrength;
      career.oline = rollSupportingCastGrade(career.teamStrength); career.weapons = rollSupportingCastGrade(career.teamStrength);
      career.seasonsWithTeam = 0;
      tradeCheck();
    });
  }

  function tradeCheck(){
    const decade = decadeForYear(career.year);
    const effOverall = computeEffOverall(career.age, decade);
    const tier = performanceTier(effOverall);
    const eligible = career.contract.years>0 && career.age>=30 && career.teamStrength<42 && (tier==="good"||tier==="average") && career.seasonsWithTeam>=1;
    // a GM who's soured on him is that much quicker to shop him around when he's already an
    // eligible trade candidate; a GM firmly in his corner sits on the asset longer instead.
    const gmRel = career.gmRelationship ?? 50;
    const gmPush = clamp((50-gmRel)*0.004, -0.10, 0.15);
    if(eligible && Math.random()<clamp(0.30+gmPush, 0.08, 0.55)){ renderTradeEvent(); return; }
    freeAgencyCheck();
  }

  function renderTradeEvent(){
    const oldTeam = teamNameAt(career.teamId, career.year);
    const team = pickTeamByStrength(career.year, career.teamId, 55, 95);
    const newTeamName = teamNameAt(team.id, career.year);
    career.transactions.push(`${career.year}: Traded from the ${oldTeam} to the ${newTeamName}.`);
    career.teamId = team.id; career.teamStrength = career.leagueStrength[team.id]; career.seasonsWithTeam = 0;
    career.oline = rollSupportingCastGrade(career.teamStrength); career.weapons = rollSupportingCastGrade(career.teamStrength);
    const content = document.getElementById("careerContent");
    content.innerHTML = eraWrap(decadeForYear(career.year), `
        <div class="ev-eyebrow">Trade · ${career.year}</div>
        <h3>Traded to the ${newTeamName}.</h3>
        <p>The ${oldTeam} are rebuilding and cashed in your trade value. A contender picked up the phone. Your contract comes with you.</p>
        <div class="event-choices"><button class="choice-btn" id="tradeAck"><div class="cb-title">Report to your new team</div><div class="cb-sub">Same deal, new locker room.</div></button></div>
      `);
    document.getElementById("tradeAck").addEventListener("click", freeAgencyCheck);
  }

  /* ----- Player-initiated trade request: a limited, risky lever the player can pull from the
     season hub instead of just waiting on the sim. Capped at 3 uses per career with a 2-season
     cooldown between asks so it can't be spammed every offseason. Three outcomes: the front
     office grants it (a real trade, same shape as the sim-driven one above), they say no (a small
     reputation ding for the awkward ask, nothing else changes), or -- if the tape has genuinely
     been bad -- they skip the trade shopping entirely and just release him instead. */
  function canRequestTrade(){
    return career.contract.apy>0 && !career.banned && career.suspensionSeasonsRemaining<=0 &&
      career.injuryLeaveSeasonsRemaining<=0 && (career._tradeRequestCooldown||0)<=0 &&
      (career._tradeRequestsUsed||0) < 3;
  }
  function requestTrade(){
    const decade = decadeForYear(career.year);
    const effOverall = computeEffOverall(career.age, decade);
    const content = document.getElementById("careerContent");
    const oldTeam = teamNameAt(career.teamId, career.year);
    career._tradeRequestsUsed = (career._tradeRequestsUsed||0) + 1;
    career._tradeRequestCooldown = 2;

    // GM relations color how this ask lands: a GM who's had bad blood with him is quicker to
    // just cut ties outright and slower to actually grant the trade; a GM in his corner is the
    // opposite — more patient with a bad season, and readier to actually work the phones.
    const gmRel = career.gmRelationship ?? 50;
    const releaseMult = clamp(1 + (50-gmRel)*0.012, 0.5, 1.7);
    const grantChance = clamp(0.45 + (gmRel-50)*0.006, 0.15, 0.75);

    if(effOverall < 45 && Math.random() < 0.35*releaseMult){
      career.reputation = clamp(career.reputation - 6, 0, 100);
      career.transactions.push(`${career.year}: Requested a trade out of the ${oldTeam} — released instead.`);
      content.innerHTML = eraWrap(decade, `
        <div class="ev-eyebrow">${career.year} · Front Office</div>
        <h3>They didn't shop him. They cut him.</h3>
        <p>Asking out with tape like this doesn't land well. The ${oldTeam} decide a trade isn't worth the effort — it's easier to just move on.</p>
        <div class="event-choices"><button class="choice-btn" id="reqTradeCutAck"><div class="cb-title">Continue</div></button></div>
      `, {tone:"bad"});
      document.getElementById("reqTradeCutAck").addEventListener("click", ()=> renderWaivedEvent(effOverall, decade));
      return;
    }

    if(Math.random() < grantChance){
      const team = pickTeamByStrength(career.year, career.teamId, 35, 92);
      const newTeamName = teamNameAt(team.id, career.year);
      career.transactions.push(`${career.year}: Requested a trade — dealt from the ${oldTeam} to the ${newTeamName}.`);
      career.teamId = team.id; career.teamStrength = career.leagueStrength[team.id]; career.seasonsWithTeam = 0;
      career.oline = rollSupportingCastGrade(career.teamStrength); career.weapons = rollSupportingCastGrade(career.teamStrength);
      content.innerHTML = eraWrap(decade, `
        <div class="ev-eyebrow">${career.year} · Trade Request</div>
        <h3>Request granted — dealt to the ${newTeamName}.</h3>
        <p>The front office honors it. The ${oldTeam} find a willing partner, and a new locker room opens up. Same contract, new colors.</p>
        <div class="event-choices"><button class="choice-btn" id="reqTradeAck"><div class="cb-title">Report to your new team</div></button></div>
      `);
      document.getElementById("reqTradeAck").addEventListener("click", nextSeason);
      return;
    }

    career.reputation = clamp(career.reputation - 2, 0, 100);
    career.transactions.push(`${career.year}: Requested a trade out of the ${oldTeam} — denied.`);
    content.innerHTML = eraWrap(decade, `
      <div class="ev-eyebrow">${career.year} · Front Office</div>
      <h3>Request denied.</h3>
      <p>They hear him out and say no. He's still part of the plan — for now — but it's an awkward conversation to have had in that building.</p>
      <div class="event-choices"><button class="choice-btn" id="reqTradeDeniedAck"><div class="cb-title">Continue</div></button></div>
    `);
    document.getElementById("reqTradeDeniedAck").addEventListener("click", nextSeason);
  }

  function freeAgencyCheck(){
    if(career.contract.years<=0){ renderFreeAgencyEvent(); return; }
    checkInjuryThenPlay();
  }

  /* ----- free agency: a real negotiation, not a pick-a-button menu. A handful of interested
     teams show up based on need (proxied off how strong/weak their roster already grades out),
     the player's last season or two, age, and reputation — a bad team wouldn't offer last
     year's near-MVP a camp-arm role, and a struggling backup won't hear from a contender. Each
     offer can be pushed on for more money; push too hard and that team walks and the offer's
     gone for good. A small independent chance of an "agent event" — a windfall like an
     unexpectedly team-friendly deal working out great, or the opposite, a lowball nobody saw
     coming — can land on any one offer regardless of how the negotiating goes. ----- */
  function tierRank(tier){ return ({minimum:0,backup:1,average:2,good:3,elite:4})[tier] ?? 0; }
  // Need used to be modeled purely off how WEAK a team's overall roster already was (100-teamStrength)
  // -- which meant an elite free agent could only ever match with rebuilding teams, since a good
  // team's high team-strength always registered as "low need," regardless of who was actually
  // playing QB there. A real report: "I'm mid-80s+, consistently good, and my only offers are from
  // 20-40 overall teams." Fixed by keying need off how replaceable the team's OWN current starter
  // is (their rivalForTeam QB's talent) instead -- a stacked team stuck with a mediocre incumbent
  // is exactly the kind of team that goes all-in on a big free-agent name in real life, and now
  // shows up as a legitimate elite-tier destination the same way a rebuilding team does.
  function teamNeedRank(teamId){
    const rival = rivalForTeam(teamId);
    const qbQuality = rival ? rivalEffTalent(rival) : 60;
    const need = clamp(100 - qbQuality + randInt(-12,12), 0, 100);
    if(need>=78) return 4; if(need>=58) return 3; if(need>=38) return 2; if(need>=18) return 1; return 0;
  }
  function buildFreeAgentOffers(decade, tier, oldTeamId){
    const rank = tierRank(tier);
    const repMult = clamp(0.82 + (career.reputation/100)*0.34, 0.75, 1.25);
    const leverage = career._leverageBoost ? 1.13 : 1;
    const comeback = career._comebackFromSuspension ? 0.55 : 1;
    career._leverageBoost = false;
    // the home team's GM relationship directly shapes the FIRST number they put on the table —
    // a GM who's had bad blood with him lowballs the re-sign offer; a GM who trusts him doesn't.
    // Only applies to the home/re-sign offer -- every other team's GM is an unknown quantity.
    const gmMult = clamp(0.82 + ((career.gmRelationship ?? 50)/100)*0.34, 0.75, 1.22);
    const candidates = shuffle(teamsAvailable(career.year).filter(t=>t.id!==oldTeamId));
    const offers = [];
    // re-sign option with the old team, unless he was just cut loose for cause (contract voided)
    if(oldTeamId && career.contract.apy>0){
      const baseApy = veteranAPY(decade, tier==="minimum"?"minimum":tier);
      offers.push({
        teamId: oldTeamId, role: "starter", isHome: true,
        apy: Math.round(baseApy*repMult*gmMult*leverage*comeback*(0.95+Math.random()*0.2)),
        years: tier==="elite"?5:tier==="good"?4:tier==="average"?2:1,
        patience: randInt(55,85), pushCount:0, withdrawn:false,
        // the home team is the CURRENT roster, not a preview -- show what he actually already plays behind.
        oline: career.oline, weapons: career.weapons,
      });
    }
    for(const t of candidates){
      if(offers.length>=4) break;
      const needRank = teamNeedRank(t.id);
      if(comeback<1 && needRank>=3) continue; // fresh off a suspension — only desperate teams call
      if(Math.abs(needRank-rank)>1) continue; // depth-chart mismatch: wouldn't happen, skip it
      const role = needRank>rank ? "starter" : needRank===rank ? "starter" : "competition";
      const tierForApy = role==="competition" ? (tier==="minimum"?"minimum":"backup") : (tier==="minimum"?"minimum":tier);
      const baseApy = veteranAPY(decade, tierForApy);
      // Rolled once here and carried on the offer object itself, not re-rolled at signing time --
      // what you see in the offer ("chase the bag, but you'd play behind a C-grade line") is
      // exactly what you get if you take it, not a surprise after the fact.
      const teamStrengthForOffer = career.leagueStrength[t.id] ?? 60;
      offers.push({
        teamId: t.id, role, isHome:false,
        apy: Math.round(baseApy*repMult*leverage*comeback*(0.88+Math.random()*0.3)),
        years: role==="competition" ? 1 : (tier==="elite"?4:tier==="good"?3:tier==="average"?2:1),
        patience: randInt(35,70) - (role==="competition"?10:0), pushCount:0, withdrawn:false,
        oline: rollSupportingCastGrade(teamStrengthForOffer), weapons: rollSupportingCastGrade(teamStrengthForOffer),
      });
    }
    // one rare agent-driven swing, independent of how negotiations go
    if(offers.length && Math.random()<0.05){
      const target = pick(offers);
      if(Math.random()<0.5){ target.apy = Math.round(target.apy*(1.25+Math.random()*0.2)); target.agentEvent = "lucky"; }
      else { target.apy = Math.round(target.apy*(0.65+Math.random()*0.15)); target.agentEvent = "bad"; }
    }
    return offers;
  }

  function renderFreeAgencyEvent(){
    const decade = decadeForYear(career.year);
    const effOverall = computeEffOverall(career.age, decade);
    const tier = performanceTier(effOverall);
    const oldTeamId = career.contract.apy>0 ? career.teamId : null;
    const oldTeamName = career.teamId ? teamNameAt(career.teamId, career.year) : null;
    const offers = buildFreeAgentOffers(decade, tier, oldTeamId);
    renderFAOffers(offers, { decade, tier, oldTeamId, oldTeamName });
  }

  function renderFAOffers(offers, meta){
    const content = document.getElementById("careerContent");
    const live = offers.filter(o=>!o.withdrawn);
    const cards = live.map((o,i)=>{
      const teamName = teamNameAt(o.teamId, career.year);
      const roleLabel = o.role==="competition" ? "Camp competition, no guarantees" : (o.isHome ? "Re-sign as the starter" : "Sign as the starter");
      const agentNote = o.agentEvent==="lucky" ? `<div class="rep-note">His agent found something special here.</div>`
        : o.agentEvent==="bad" ? `<div class="rep-note">This one feels light — the agent may have undersold him.</div>` : "";
      const canNegotiate = o.patience>0 && o.pushCount<3;
      const grade = Math.round(career.leagueStrength[o.teamId] ?? 60);
      const gradeTag = grade>=72 ? "Contender" : grade>=52 ? "Solid" : "Rebuilding";
      return `<div class="fa-offer">
        <div class="fa-offer-head"><b>${teamName}</b><span class="fa-role">${roleLabel}</span></div>
        <div class="fa-offer-terms tabular">${fmtMoney(o.apy)}/yr · ${o.years} yr${o.years===1?"":"s"}</div>
        <div class="fa-offer-grade">Team grade <b class="tabular">${grade}</b> <span class="fa-grade-tag">${gradeTag}</span></div>
        <div class="fa-offer-cast">O-Line <b>${castLetterGrade(o.oline)}</b> &nbsp;·&nbsp; Weapons <b>${castLetterGrade(o.weapons)}</b></div>
        ${agentNote}
        <div class="event-choices">
          <button class="choice-btn fa-accept" data-i="${i}"><div class="cb-title">Accept</div></button>
          ${canNegotiate ? `<button class="choice-btn fa-negotiate" data-i="${i}"><div class="cb-title">Negotiate for more</div><div class="cb-sub">Could work. Could blow up the deal.</div></button>` : `<div class="cb-sub" style="padding:0.2rem 0;">They've said their final number.</div>`}
        </div>
      </div>`;
    }).join("");
    content.innerHTML = eraWrap(decadeForYear(career.year), `
        <div class="ev-eyebrow">Free Agency · ${career.year}</div>
        <h3>${live.length ? "The market has spoken." : "Nobody's calling anymore."}</h3>
        <p>${live.length ? `${live.length} team${live.length===1?" is":"s are"} actually interested — everyone else has other plans at the position.` : `Every offer that existed is off the table now. That's still not the same as being done, though.`}</p>
        <div class="fa-offers">${cards}</div>
        <div class="event-choices" style="margin-top:${live.length?"0.4rem":"1.3rem"};">
          ${live.length===0 ? `<button class="choice-btn" id="faMinimum"><div class="cb-title">Beg for a minimum camp deal</div><div class="cb-sub">Somebody, somewhere, needs an arm.</div></button>` : ""}
          <button class="choice-btn" id="faRetire"><div class="cb-title">Retire</div><div class="cb-sub">Walk away while it's still his choice.</div></button>
        </div>
      `);

    content.querySelectorAll(".fa-accept").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const o = live[parseInt(btn.dataset.i,10)];
        signFreeAgentOffer(o, meta);
      });
    });
    content.querySelectorAll(".fa-negotiate").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const o = live[parseInt(btn.dataset.i,10)];
        negotiateOffer(o);
        renderFAOffers(offers, meta);
      });
    });
    const minBtn = document.getElementById("faMinimum");
    if(minBtn) minBtn.addEventListener("click", ()=>{
      const team = pickTeamByStrength(career.year, career.teamId, 15, 55);
      signFreeAgentOffer({ teamId: team.id, apy: veteranAPY(meta.decade,"minimum"), years:1 }, meta);
    });
    document.getElementById("faRetire").addEventListener("click", ()=>{
      career.exitReason = "retired";
      finishCareer();
    });
  }

  function negotiateOffer(o){
    // pushing the HOME team's GM specifically is easier or harder depending on the standing
    // relationship -- a GM already in his corner is more willing to bend, one with bad blood
    // digs in harder on his number.
    const gmTerm = o.isHome ? ((career.gmRelationship ?? 50)-50)*0.003 : 0;
    const successChance = clamp(0.55 + (career.reputation-50)*0.004 + gmTerm - o.pushCount*0.14, 0.1, 0.85);
    o.pushCount++;
    if(Math.random()<successChance){
      o.apy = Math.round(o.apy*(1.05+Math.random()*0.09));
      o.patience -= randInt(15,28);
    } else {
      o.patience -= randInt(25,45);
      if(o.patience<=0 || Math.random()<0.32) o.withdrawn = true;
    }
  }

  function signFreeAgentOffer(o, meta){
    const teamName = teamNameAt(o.teamId, career.year);
    if(o.isHome){
      career.transactions.push(`${career.year}: Re-signed with the ${teamName} (${fmtMoney(o.apy)}/yr).`);
      // NOT a team change -- keep his tenure streak intact so the "first season in a new uniform"
      // narrative line (gated on seasonsWithTeam===1) doesn't fire for a guy who never left.
    } else {
      career.transactions.push(`${career.year}: Signed with the ${teamName} (${fmtMoney(o.apy)}/yr).`);
      career.teamId = o.teamId;
      career.teamStrength = career.leagueStrength[o.teamId];
      career.oline = o.oline; career.weapons = o.weapons;
      career.seasonsWithTeam = 0;
    }
    const tier = o.role==="competition" ? "backup" : (meta.tier==="minimum"?"minimum":meta.tier);
    career.contract = { apy: o.apy, years: o.years, tier };
    checkInjuryThenPlay();
  }

  /* ----- injuries: typed, era-sensitive, and durability-driven. Different injuries carry
     different baseline severity and hit different parts of the game (a shoulder injury saps arm
     talent, a concussion saps processing, a knee saps mobility). Medical care is worse in earlier
     decades (reusing the same era injury multiplier the league-wide injury RATE already uses),
     so the exact same injury is more dangerous the further back you play it. Playing through one
     is a real gamble — durability drives how likely it is to get worse — but shutting it down
     isn't risk-free either, just a different one. Most injuries fully heal; a lingering effect is
     usually temporary (a season or two of reduced play, modeled the same way a mentorship or
     scheme-fit boost is, just negative), a small permanent dent is rare, and a season- or
     career-ending outcome is rare-er still and scales down the harder DUR fights it — so a
     bad break doesn't have to be a bad career (a Brees-style full recovery is the common case,
     not the exception). ----- */
  const INJURY_TYPES = [
    { id:"ankle", name:"Ankle Sprain", weight:20, sev:0.28, keys:["MOB","IMP"] },
    { id:"shoulder", name:"Shoulder Injury", weight:14, sev:0.48, keys:["ARM","REL"] },
    { id:"concussion", name:"Concussion", weight:13, sev:0.40, keys:["DEC","ANT"] },
    { id:"mcl", name:"MCL Sprain", weight:12, sev:0.42, keys:["MOB","PKT"] },
    { id:"acl", name:"Torn ACL", weight:6, sev:0.82, keys:["MOB","IMP","PKT"] },
    { id:"achilles", name:"Torn Achilles", weight:4, sev:0.85, keys:["MOB","IMP"] },
    { id:"hand", name:"Hand/Finger Injury", weight:13, sev:0.24, keys:["SHA","TCH"] },
    { id:"rib", name:"Rib/Chest Injury", weight:9, sev:0.30, keys:["ARM","DAC"] },
    { id:"back", name:"Back Injury", weight:8, sev:0.42, keys:["PKT","SHA"] },
    { id:"neck", name:"Neck/Stinger", weight:5, sev:0.36, keys:["CLU","DEC"] },
  ];
  function rollInjuryType(){
    const total = INJURY_TYPES.reduce((s,t)=>s+t.weight,0);
    let r = Math.random()*total;
    for(const t of INJURY_TYPES){ if(r<t.weight) return t; r -= t.weight; }
    return INJURY_TYPES[0];
  }

  function checkInjuryThenPlay(){
    const decade = decadeForYear(career.year);
    const league = LEAGUE[decade];
    const dur = eraEffective(career.age, decade).DUR;
    const injMult = (ERA_ATTR_MULT[decade]||{}).injury || 1;
    // A bad O-line means more hits taken, not just more sacks -- durability is still the dominant
    // term (this is a real but secondary risk factor, the "play behind a bad line" downside).
    const olineRisk = 1 - (career.oline-65)*0.003;
    const injuryChance = clamp((0.26 - (dur-60)*0.006) * injMult * olineRisk, 0.05, 0.55);
    if(!career._injuryResolved && Math.random()<injuryChance){
      // the week is rolled once, here, and threaded through to resolveInjuryChoice so the
      // "games missed" total it reports can never exceed how many games are actually left on
      // the schedule after that week -- previously the week shown in the event text and the
      // eventual missed-games count were two fully independent random rolls, so a "Week 12"
      // injury could claim "10 games missed" in a 17-game season with only ~5 left to miss.
      const week = randInt(3, Math.max(3, Math.min(13, league.games-1)));
      renderInjuryEvent(rollInjuryType(), dur, injMult, decade, week);
      return;
    }
    career._injuryResolved = false;
    playSeasonAndRender();
  }

  function playSeasonAndRender(){
    const season = generateSeason();
    renderSeasonCard(season);
    saveActiveCareer();
  }

  function renderInjuryEvent(type, dur, injMult, decade, week){
    const content = document.getElementById("careerContent");
    const sevFlavor = type.sev>=0.7 ? "a serious injury — the kind that can end a season" : type.sev>=0.42 ? "a real injury, not a tweak" : "a nagging but manageable injury";
    const wear = career.wearAndTear||0;
    const wearWarning = wear>=45
      ? ` His body's already worn (${Math.round(wear)}/100) — gutting out another one now is real risk of a permanent decline, not just a bad week.`
      : "";
    content.innerHTML = eraWrap(decade, `
        <div class="ev-eyebrow">${career.year} Season · Week ${week}</div>
        <h3>${type.name}.</h3>
        <p>Training staff calls it ${sevFlavor}. Play through it and chase the season, or shut it down and protect the long game.${wearWarning}</p>
        <div class="event-choices">
          <button class="choice-btn" id="injPlay"><div class="cb-title">Gut it out</div><div class="cb-sub">Stay on the field — but pushing through it adds real wear and tear, on top of a chance of making it worse right now.</div></button>
          <button class="choice-btn" id="injSit"><div class="cb-title">Shut it down</div><div class="cb-sub">Miss real time this year, come back closer to full strength — and barely adds to his long-term wear.</div></button>
        </div>
      `, {tone:"bad"});
    document.getElementById("injPlay").addEventListener("click", ()=> resolveInjuryChoice(type, dur, injMult, decade, true, week));
    document.getElementById("injSit").addEventListener("click", ()=> resolveInjuryChoice(type, dur, injMult, decade, false, week));
  }

  function resolveInjuryChoice(type, dur, injMult, decade, played, week){
    const content = document.getElementById("careerContent");
    const league = LEAGUE[decade];
    if(!week) week = 1; // defensive default (max games-remaining headroom) if ever called without one
    // lower durability makes every bad outcome more likely — worsening, lingering, and the rare
    // catastrophic ones alike.
    const durFactor = clamp((70-dur)/70, -0.3, 1);
    let missedGames, perfPenalty = 0, lingering=false, permanentHit=0, worsened=false;

    if(played){
      missedGames = randInt(0, Math.max(1, Math.round(2 + type.sev*3)));
      perfPenalty = randInt(8,18) + Math.round(type.sev*10);
      const worsenChance = clamp((0.16 + type.sev*0.22 + durFactor*0.18) * injMult, 0.05, 0.65);
      if(Math.random()<worsenChance){
        worsened = true;
        missedGames += randInt(3, Math.round(4+type.sev*10));
        perfPenalty += randInt(5,15);
      }
    } else {
      missedGames = randInt(Math.round(2+type.sev*4), Math.round(4+type.sev*10));
      perfPenalty = Math.round(type.sev*3);
    }
    // ----- Wear and tear: the real, cumulative version of "playing through it has a cost."
    // Gutting it out adds a real chunk to a persistent career-long meter; shutting it down adds
    // almost nothing (rest protects the body). generateSeason() adds a small age/durability-scaled
    // baseline on top every season and lets the meter recover on a clean, injury-free one -- see
    // that function for the threshold check that can turn a high meter into a genuine, permanent
    // physical decline. This is deliberately separate from (and much more common than) the rare
    // structural permanentHit below, which represents one freak injury, not accumulated damage.
    const wearAdd = played
      ? randInt(10,18) + Math.round(type.sev*16) + (worsened ? randInt(4,10) : 0)
      : randInt(0,2) + Math.round(type.sev*3);
    career.wearAndTear = clamp((career.wearAndTear||0) + wearAdd, 0, 100);
    career._hadInjuryThisSeason = true;
    // cap in-season missed games at what's actually left on the schedule after the week the
    // injury happened -- a "Week 12" injury in a 17-game season can miss at most 6 games this
    // year (weeks 12-17), never the 10-14 the raw severity roll above might otherwise produce.
    // seasonEnding is judged against that same remaining-games figure, not a flat league-wide
    // constant, so a genuinely season-ending injury is recognized as such whenever it happens,
    // not only when it happens to land on/after week ~16.
    const gamesRemaining = Math.max(1, league.games - week + 1);
    missedGames = clamp(missedGames, 0, Math.min(league.games, gamesRemaining));
    const seasonEnding = missedGames >= gamesRemaining;
    lingering = Math.random() < clamp((played ? 0.22+type.sev*0.35 : 0.10+type.sev*0.20) * (worsened?1.3:1), 0.04, 0.75);

    // rare, durability-modulated catastrophic branch: a season-ender occasionally becomes a
    // multi-season absence, or — rarest of all — a career-ender. Gutting it out and getting
    // worse raises these odds; shutting it down early lowers them.
    let multiSeasonLeave = 0, careerEnding = false;
    if(seasonEnding){
      const catastropheBase = type.sev>=0.7 ? 0.05 : type.sev>=0.42 ? 0.015 : 0.004;
      const catastropheChance = clamp(catastropheBase*injMult*(worsened?1.6:1)*(1+Math.max(0,durFactor)), 0, 0.22);
      if(Math.random()<catastropheChance){
        if(Math.random()<0.12) careerEnding = true; else multiSeasonLeave = randInt(1,2);
      }
    }
    if(!careerEnding && !multiSeasonLeave && Math.random() < clamp(0.025*injMult*type.sev, 0, 0.10)){
      permanentHit = randInt(1,4); // small, rare, permanent — not the norm
    }

    career.reputation = clamp(career.reputation + (worsened?-2:0), 0, 100);

    if(careerEnding){
      career.transactions.push(`${career.year}: ${type.name} ends his career.`);
      // Same idea as _bannedEventTitle above -- name the actual injury in the retrospective
      // instead of narrating a forced medical retirement as a career he chose to walk away from.
      career._careerEndingInjuryName = type.name;
      content.innerHTML = eraWrap(decade, `
        <div class="ev-eyebrow">${career.year} · Medical</div>
        <h3>Career-ending injury.</h3>
        <p>The ${type.name.toLowerCase()} is worse than anyone let on. The team's doctors, and then a second opinion, agree: this is the end of the line.</p>
        <div class="event-choices"><button class="choice-btn" id="injCareerAck"><div class="cb-title">See the career recap</div></button></div>
      `, {tone:"bad"});
      document.getElementById("injCareerAck").addEventListener("click", ()=>{ career.exitReason="injury"; career.forcedOut=true; finishCareer(); });
      return;
    }
    if(multiSeasonLeave){
      career.injuryLeaveSeasonsRemaining = multiSeasonLeave;
      const teamName = teamNameAt(career.teamId, career.year);
      career.transactions.push(`${career.year}: ${type.name} — out ${multiSeasonLeave} season(s) on injured reserve with the ${teamName}.`);
      content.innerHTML = eraWrap(decade, `
        <div class="ev-eyebrow">${career.year} · Medical</div>
        <h3>${multiSeasonLeave}-season injury absence.</h3>
        <p>The ${type.name.toLowerCase()} needs real time — multiple surgeries, a long rehab. The ${teamName} are keeping him on the books, but he won't play again for a while.</p>
        <div class="event-choices"><button class="choice-btn" id="injLeaveAck"><div class="cb-title">Continue</div></button></div>
      `, {tone:"bad"});
      document.getElementById("injLeaveAck").addEventListener("click", nextSeason);
      return;
    }
    if(lingering && !permanentHit){
      const seasons = randInt(1,2);
      career.tempBoosts = career.tempBoosts || [];
      type.keys.forEach(k=> career.tempBoosts.push({ key:k, delta: -randInt(4,9), seasonsLeft: seasons }));
    }
    if(permanentHit){
      type.keys.forEach(k=>{ build[k] = clamp(build[k]-permanentHit, 15, 99); });
    }
    career._injuryMissedGames = missedGames;
    career._injuryPenalty = perfPenalty;
    career._injuryResolved = true;
    const noteBits = [];
    if(worsened) noteBits.push("It got worse than it needed to.");
    if(lingering && !permanentHit) noteBits.push("Expect it to nag at him for a while yet.");
    if(permanentHit) noteBits.push("It never fully heals — a small, permanent mark on his game.");
    career.transactions.push(`${career.year}: ${type.name}${missedGames>0?` (${missedGames} games missed)`:""}.`);
    if(noteBits.length){
      content.innerHTML = eraWrap(decade, `
        <div class="ev-eyebrow">${career.year} · Medical</div>
        <h3>${type.name}${missedGames>0?` — ${missedGames} game${missedGames===1?"":"s"} missed`:""}</h3>
        <p>${noteBits.join(" ")}</p>
        <div class="event-choices"><button class="choice-btn" id="injContinueAck"><div class="cb-title">Continue</div></button></div>
      `, {tone:"bad"});
      document.getElementById("injContinueAck").addEventListener("click", playSeasonAndRender);
      return;
    }
    playSeasonAndRender();
  }

  /* ----- Season dashboard: one tabbed hub (Season / Standings / League / Trends / Scheme / Log)
     instead of a modal-plus-scroll. Season is the default tab; the others build lazily into the
     same #careerContent so switching tabs never re-simulates anything. ----- */
  function switchDashTab(name){
    const content = document.getElementById("careerContent");
    content.querySelectorAll(".dash-tab").forEach(b=> b.classList.toggle("active", b.dataset.tab===name));
    content.querySelectorAll(".dash-tabpanel").forEach(p=> p.classList.toggle("active", p.id==="tabpanel-"+name));
  }

  // Game-by-game regular season log: the player's real weekly schedule (division rivals home-and-
  // home, the rest of the league filling out the slate -- see pickRegularSeasonOpponents), each
  // game resolved against that WEEK's actual opponent team grade (see simulateRegularSeasonGames),
  // with a per-game stat line so the season totals aren't just one deterministic formula anymore.
  function buildScheduleTabHTML(season){
    const log = season.gameLog || [];
    if(!log.length){
      return `<div class="calc-refnote">No game-by-game log for this season (missed the whole year, or an older save from before per-game tracking was added).</div>`;
    }
    const rows = log.map(g=>`<tr>
        <td class="tabular">${g.week}</td>
        <td>${svgEscape(g.opponentName)} <span style="color:var(--ink-muted);">(grade ${g.opponentGrade})</span>${g.opponentQbName ? `<br><span style="color:var(--ink-muted);font-size:0.82em;">QB <button type="button" class="rival-link" data-rival-id="${g.opponentQbId}">${svgEscape(g.opponentQbName)}</button> — ${g.opponentQbOverall} overall</span>` : ""}</td>
        <td class="${g.won?"good":"bad"}"><b>${g.won?"W":"L"}</b> <span class="tabular">${g.myScore}-${g.oppScore}</span></td>
        <td class="tabular">${g.comp}/${g.att}</td>
        <td class="tabular">${g.yards}</td>
        <td class="tabular">${g.td}</td>
        <td class="tabular">${g.int}</td>
        <td class="tabular">${g.sacks}</td>
        <td class="tabular">${g.rushAtt>0 ? `${g.rushAtt}-${g.rushYards}${g.rushTd?" · "+g.rushTd+" TD":""}` : "—"}</td>
      </tr>`).join("");
    const wins = log.filter(g=>g.won).length, losses = log.length-wins;
    return `<div class="calc-refnote">Game-by-game results as the starter this season — every opponent's real team grade factors into that week's win odds (see the Win Probability card in Admin &amp; Testing's Stat Calculator for the formula). Starter record: <b>${wins}-${losses}</b>.</div>
      <div class="table-wrap">
        <table class="league-table">
          <thead><tr><th>Wk</th><th>Opponent</th><th>Result</th><th class="tabular">C/A</th><th class="tabular">Yds</th><th class="tabular">TD</th><th class="tabular">INT</th><th class="tabular">Sacks</th><th class="tabular">Rush</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function buildStandingsTabHTML(season){
    const ls = season.leagueStandings;
    if(!ls) return `<p style="color:var(--ink-muted);">Standings aren't available for this season.</p>`;
    function seedList(conf){
      return `<ol class="seed-list">` + ls.seeded[conf].map(t=>{
        const name = teamNameAt(t.id, season.year);
        const mine = t.id===career.teamId;
        return `<li class="${mine?"me":""}">${name}<span class="tabular">${t.wins}-${t.losses}</span></li>`;
      }).join("") + `</ol>`;
    }
    function divTables(conf){
      return (ls.divisions || divisionsForYear(season.year)).filter(d=>d.conf===conf).map(d=>{
        const rows = d.teams.map(id=>ls.results[id]).sort((a,b)=>b.winPct-a.winPct).map(r=>{
          const name = teamNameAt(r.id, season.year);
          const mine = r.id===career.teamId;
          return `<tr class="${mine?"me":""}"><td class="team-cell">${name}${mine?" (you)":""}</td><td>${r.wins}-${r.losses}</td></tr>`;
        }).join("");
        return `<div class="standings-div"><div class="standings-div-name">${confLabel(conf, season.year)} ${d.name}</div><table class="standings-table"><tbody>${rows}</tbody></table></div>`;
      }).join("");
    }
    return `<div class="standings-columns">
        <div><h4>${confLabel("AFC", season.year)} Playoff Seeds</h4>${seedList("AFC")}${divTables("AFC")}</div>
        <div><h4>${confLabel("NFC", season.year)} Playoff Seeds</h4>${seedList("NFC")}${divTables("NFC")}</div>
      </div>`;
  }

  // League-wide QB comparison: every other starting QB in the league (see generateLeagueRivals /
  // simulateRivalSeasons), ranked alongside the player for the season just played, judged by the
  // exact same award rules -- the "checkbalance for awards" this was built for -- plus a running
  // comparison against three draft-classmate rivals as the seed for a future head-to-head mechanic.
  // Shared by buildLeagueTabHTML and buildAwardCeremonyHTML so both work off the exact same
  // per-QB season rows (the player plus every rival with a season logged this year), sorted by
  // passer rating -- one source of truth for "who did what this season," not two formulas that
  // could quietly drift apart.
  function computeSeasonAwardRows(season){
    const year = season.year;
    const rows = [{
      name: career.name, teamId: career.teamId, age: season.age, mine:true,
      att: season.att, pct: season.pct, yards: season.yards, td: season.td, int: season.int,
      rating: season.rating, awards: season.awards,
    }];
    (career.leagueRivals||[]).forEach(r=>{
      const s = r.seasons.find(x=>x.year===year);
      if(!s) return;
      rows.push({ name:r.name, teamId:r.teamId, age:s.age, mine:false, att:s.att, pct:s.pct,
        yards:s.yards, td:s.td, int:s.int, rating:s.rating, awards:s.awards, isRival:r.isRival, id:r.id });
    });
    rows.sort((a,b)=> b.rating-a.rating);
    return rows;
  }

  // ----- End-of-season Award Ceremony: names the year's MVP, All-Pros, and Pro Bowlers. All three
  // are decided exactly once, league-wide -- MVP by resolveSeasonMVP (the single most
  // statistically impressive season wins outright, with a real tie producing genuine co-MVPs),
  // and Pro Bowl/All-Pro by resolveSeasonAllProAndProBowl (top scorers per conference for the Pro
  // Bowl roster, exactly one First Team and one Second Team All-Pro league-wide) -- never several
  // QBs independently "winning" the same honor off their own coin flip.
  function buildAwardCeremonyHTML(season){
    const year = season.year;
    const rows = computeSeasonAwardRows(season);
    const mvpCandidates = rows.filter(r=>r.awards.includes("MVP")); // already rating-sorted
    const proBowlers = rows.filter(r=>r.awards.includes("Pro Bowl"));
    const firstTeamAllPro = rows.filter(r=>r.awards.includes("First-Team All-Pro"));
    const secondTeamAllPro = rows.filter(r=>r.awards.includes("Second-Team All-Pro"));

    const statLine = r => `${r.yards.toLocaleString()} yds · ${r.td} TD · ${r.int} INT · ${r.rating.toFixed(1)} rating`;
    const rowLine = r => `${svgEscape(r.name)}${r.mine?" (you)":""} — ${svgEscape(teamNameAt(r.teamId, year))} — ${statLine(r)}`;

    const mvpHtml = mvpCandidates.length ? `
      <div class="award-hero">
        <div class="award-hero-label">${year} Most Valuable Player${mvpCandidates.length>1?"s (Co-MVP)":""}</div>
        ${mvpCandidates.map(mvpRow => `
          <div class="award-hero-name">${svgEscape(mvpRow.name)}${mvpRow.mine?" (you)":""}</div>
          <div class="award-hero-sub">QB · ${svgEscape(teamNameAt(mvpRow.teamId, year))}</div>
          <div class="award-hero-stat">${statLine(mvpRow)}</div>
        `).join(mvpCandidates.length>1 ? '<div style="height:0.6rem;"></div>' : "")}
      </div>` : `
      <div class="award-hero muted">
        <div class="award-hero-label">${year} Most Valuable Player</div>
        <div class="award-hero-name">No consensus winner</div>
        <div class="award-hero-sub">A wide-open field this year — nobody separated from the pack enough to run away with it.</div>
        ${rows[0] ? `<div class="award-hero-stat">Closest to it: ${svgEscape(rows[0].name)}${rows[0].mine?" (you)":""} — ${statLine(rows[0])}</div>` : ""}
      </div>`;

    const listSection = (title, list) => list.length ? `
      <div class="award-list-section">
        <h4>${title} <span class="award-count">${list.length}</span></h4>
        <ul class="award-list">${list.map(r=>`<li class="${r.mine?"me":""}">${rowLine(r)}</li>`).join("")}</ul>
      </div>` : `
      <div class="award-list-section empty">
        <h4>${title}</h4>
        <p>Nobody made the cut league-wide this year.</p>
      </div>`;

    return `<div class="award-ceremony">
        ${mvpHtml}
        ${listSection("First-Team All-Pro", firstTeamAllPro)}
        ${listSection("Second-Team All-Pro", secondTeamAllPro)}
        ${listSection("Pro Bowl", proBowlers)}
      </div>`;
  }

  function buildLeagueTabHTML(season){
    const year = season.year;
    const rows = computeSeasonAwardRows(season);
    const myRank = rows.findIndex(r=>r.mine)+1;
    const proBowlCount = rows.filter(r=>r.awards.includes("Pro Bowl")).length;
    const allProCount = rows.filter(r=>r.awards.some(a=>a.endsWith("All-Pro"))).length;
    const mvpCount = rows.filter(r=>r.awards.includes("MVP")).length;

    const rowsHtml = rows.map((r,i)=> `<tr class="${r.mine?"me":""}">
        <td class="tabular">${i+1}</td>
        <td>${r.mine ? svgEscape(r.name)+" (you)" : `<button type="button" class="rival-link" data-rival-id="${r.id}">${svgEscape(r.name)}</button>${r.isRival?" ★":""}`} <span style="color:var(--ink-muted);">— ${svgEscape(teamNameAt(r.teamId, year))}</span></td>
        <td class="tabular">${r.age}</td>
        <td class="tabular">${(r.pct*100).toFixed(1)}%</td>
        <td class="tabular">${r.att}</td>
        <td class="tabular">${r.yards.toLocaleString()}</td>
        <td class="tabular">${r.td}</td>
        <td class="tabular">${r.int}</td>
        <td class="tabular"><b>${r.rating.toFixed(1)}</b></td>
        <td>${r.awards.map(a=>`<span class="badge ${a==="MVP"?"gold":"good"}" style="margin-right:0.25rem;">${a}</span>`).join("")}</td>
      </tr>`).join("");

    const classmates = (career.leagueRivals||[]).filter(r=>r.isRival);
    const myCareerRating = passerRating(career.totals.comp, career.totals.att, career.totals.yards, career.totals.td, career.totals.int);
    const classmateRows = classmates.map(r=>{
      const rRating = passerRating(r.totals.comp, r.totals.att, r.totals.yards, r.totals.td, r.totals.int);
      return `<tr><td>${svgEscape(r.name)}${r.retired?" <span style=\"color:var(--ink-muted);\">(retired)</span>":""}</td><td>${svgEscape(teamNameAt(r.teamId, year))}</td>
        <td class="tabular">${r.totals.yards.toLocaleString()}</td><td class="tabular">${r.totals.td}</td>
        <td class="tabular">${rRating.toFixed(1)}</td>
        <td class="tabular">${r.totals.proBowls}</td><td class="tabular">${r.totals.allPros}</td><td class="tabular">${r.totals.mvps}</td></tr>`;
    }).join("");
    const classHtml = classmates.length ? `
      <div class="league-classmates">
        <h4>Your Draft Class</h4>
        <table class="standings-table">
          <thead><tr><th>Name</th><th>Team</th><th>Career Yds</th><th>Career TD</th><th>Rating</th><th>PB</th><th>AP</th><th>MVP</th></tr></thead>
          <tbody>
            <tr class="me"><td>${svgEscape(career.name)} (you)</td><td>${svgEscape(teamNameAt(career.teamId, year))}</td>
              <td class="tabular">${career.totals.yards.toLocaleString()}</td><td class="tabular">${career.totals.td}</td>
              <td class="tabular">${myCareerRating.toFixed(1)}</td>
              <td class="tabular">${career.totals.proBowls}</td><td class="tabular">${career.totals.allPros}</td><td class="tabular">${career.totals.mvps}</td></tr>
            ${classmateRows}
          </tbody>
        </table>
        <div class="calc-refnote">Three QBs from your own draft class — same rookie year, same age curve, tracked stat-for-stat alongside you all career long. The foundation for a future head-to-head rivals mechanic — for now, a running comparison.</div>
      </div>` : "";

    return `<div class="league-tab">
        <div class="calc-refnote">${year} passing leaderboard — every starting QB in the league this season, judged by the exact same Pro Bowl / All-Pro / MVP rules as you (see the Stat Calculator tab in Admin &amp; Testing for the formulas). You ranked <b>#${myRank}</b> of ${rows.length} in passer rating. League-wide this season: Pro Bowl ×${proBowlCount}, All-Pro ×${allProCount}, MVP ×${mvpCount}.</div>
        <div class="table-wrap">
          <table class="league-table">
            <thead><tr><th>#</th><th>QB</th><th class="tabular">Age</th><th class="tabular">Comp%</th><th class="tabular">Att</th><th class="tabular">Yds</th><th class="tabular">TD</th><th class="tabular">INT</th><th class="tabular">Rating</th><th>Awards</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
        ${classHtml}
        <div class="section-label" style="margin-top:1.5rem;">Around the League</div>
        <div class="calc-refnote">Front-office news from other teams — this is why their grades move, not just dice.</div>
        ${buildLeagueNewsFeedHTML()}
      </div>`;
  }

  const TREND_STATS = [
    { key:"rating", label:"Passer Rating", get:s=>s.rating },
    { key:"yards", label:"Pass Yards", get:s=>s.yards },
    { key:"td", label:"Touchdowns", get:s=>s.td },
    { key:"int", label:"Interceptions", get:s=>s.int },
    { key:"wins", label:"Wins", get:s=>s.wins },
    { key:"teamOverall", label:"Team Grade", get:s=>s.teamOverall },
    { key:"rushYards", label:"Rush Yards", get:s=>s.rushYards },
  ];
  let trendsStatKey = "rating";

  function renderTrendsSparkline(){
    const holder = document.getElementById("trendsSparklineHolder");
    if(!holder) return;
    const stat = TREND_STATS.find(t=>t.key===trendsStatKey) || TREND_STATS[0];
    const values = career.seasonLog.map(stat.get);
    const current = values[values.length-1] ?? 0;
    const options = TREND_STATS.map(t=>`<option value="${t.key}"${t.key===trendsStatKey?" selected":""}>${t.label}</option>`).join("");
    holder.innerHTML = `<div class="sparkline-head">
        <select class="spk-select" id="trendsStatSelect">${options}</select>
        <span class="spk-current tabular">${current.toLocaleString()}</span>
      </div>
      ${renderSparklineSVG(values)}`;
    document.getElementById("trendsStatSelect").addEventListener("change", (e)=>{
      trendsStatKey = e.target.value;
      renderTrendsSparkline();
    });
  }

  function buildTrendsTabHTML(){
    const log = career.seasonLog;
    const rows = log.slice().reverse().map(s=>`
        <tr><td>${s.year}</td><td class="team-cell">${s.teamName}</td><td>${s.rating}</td><td>${s.yards.toLocaleString()}</td>
        <td>${s.td}</td><td>${s.wins}-${s.losses}</td><td>${s.awards.join(", ")||"—"}</td></tr>`).join("");
    return `
      <div class="sparkline-wrap">
        <div id="trendsSparklineHolder"></div>
      </div>
      <div class="trend-table-wrap table-wrap">
        <table class="career-table">
          <thead><tr><th>Year</th><th>Team</th><th>Rating</th><th>Yards</th><th>TD</th><th>Record</th><th>Awards</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // ----- Coaching Scheme tab: shows the CURRENT team's real, named scheme and exactly which
  // attributes it favors or hurts, using the same SCHEMES multiplier table schemeEffective()
  // actually plays by -- so what the player sees here can never contradict what's happening to
  // their stat production. -----
  function schemeAttrRows(schemeId){
    const scheme = SCHEMES.find(s=>s.id===schemeId);
    if(!scheme) return "";
    return ATTR_KEYS.filter(k=>k!=="DUR").map(k=>{
      const m = scheme.mult[k];
      const label = ATTR_BY_KEY[k].label;
      let cls = "neutral", tagText = "Neutral fit";
      if(m>=1.05){ cls="good"; tagText="Favored"; } else if(m<=0.95){ cls="bad"; tagText="Hurt"; }
      const pct = m!=null ? Math.round((m-1)*100) : 0;
      const pctText = m!=null ? (pct>0?"+":"")+pct+"%" : "—";
      return `<tr class="scheme-row-${cls}"><td>${label}</td><td class="tabular">${pctText}</td><td>${tagText}</td></tr>`;
    }).join("");
  }
  function buildSchemeTabHTML(){
    const schemeId = career.teamScheme ? career.teamScheme[career.teamId] : null;
    const scheme = SCHEMES.find(s=>s.id===schemeId);
    if(!scheme) return `<p style="color:var(--ink-muted);">No scheme data for this team.</p>`;
    return `
      <div class="scheme-head">
        <h4>${scheme.name}</h4>
        <p class="scheme-blurb">${scheme.blurb}</p>
      </div>
      <div class="table-wrap">
        <table class="career-table scheme-table">
          <thead><tr><th>Attribute</th><th>Scheme Impact</th><th>Fit</th></tr></thead>
          <tbody>${schemeAttrRows(schemeId)}</tbody>
        </table>
      </div>
      <p class="scheme-footnote">This is applied directly to on-field production, not flavor text — a favored attribute counts for more and a hurt one counts for less, exactly as shown above. Front-office shakeups (a fired coach, a new GM) can bring in a new coordinator and change the scheme entirely.</p>
    `;
  }

  // ----- Attributes tab (item #10): a player-facing view of the twelve ratings mid-career --
  // draft-day value, current (development-adjusted) value, and what's actually driving THIS
  // season's production once age, era, and scheme are all applied. Reuses the same
  // schemeEffective()/weighted() pipeline generateSeason() itself plays by, so nothing shown here
  // can contradict the season card's actual numbers. -----
  const ATTR_GROUP_LABEL = { physical:"Physical", accuracy:"Accuracy", mental:"Mental & Intangibles" };
  const ATTR_GROUP_ORDER = ["physical","accuracy","mental"];
  // The per-season "This Season's Development" strip at the top of the Attributes tab -- built
  // from season.attrChanges (stashed by developAttributes() the moment it computes them) rather
  // than re-deriving anything, so this can never disagree with the transaction-log breakout/
  // regression line or the cumulative draft-day table below it.
  function buildSeasonProgressHTML(season){
    if(!season || !season.attrChanges) return "";
    // Round 4: a career-arc swing (breakout or bust-spiral) gets its own headline banner above the
    // normal per-attribute list, since it's a career-defining moment (and a devSpeed shift), not
    // just a bigger version of the ordinary drift below it.
    const arc = season.devArcEvent;
    const arcBannerHtml = arc ? `<div class="season-arc-banner ${arc.type}">
        <div class="season-arc-icon">${arc.type==="breakout" ? "🔥" : "📉"}</div>
        <div class="season-arc-text">
          <div class="season-arc-title">${arc.type==="breakout" ? "Breakout Season" : "Development Stalled"}</div>
          <div class="season-arc-sub">${arc.type==="breakout"
            ? "Something clicked — this player's development trajectory just shifted upward."
            : "A real setback — this player's development trajectory just shifted downward."}</div>
        </div>
      </div>` : "";
    const changes = season.attrChanges.filter(c=>c.delta!==0);
    if(!changes.length){
      return `<div class="season-progress">
          ${arcBannerHtml}
          <div class="season-progress-head">This Season's Development</div>
          <div class="season-progress-empty">No meaningful movement this season — steady as she goes.</div>
        </div>`;
    }
    changes.sort((a,b)=> Math.abs(b.delta)-Math.abs(a.delta));
    const items = changes.map(c=>{
      const label = (ATTR_BY_KEY[c.key]||{}).label || c.key;
      const cls = c.delta>0 ? "up" : "down";
      const tag = c.breakout ? " · breakout" : c.regression ? " · regression" : "";
      return `<div class="season-progress-item ${cls}${c.breakout?" notable":""}${c.regression?" notable":""}">
          <span class="spi-label">${svgEscape(label)}</span>
          <span class="spi-delta">${c.delta>0?"+":""}${c.delta}</span>${tag?`<span class="spi-tag">${tag}</span>`:""}
        </div>`;
    }).join("");
    return `<div class="season-progress">
        ${arcBannerHtml}
        <div class="season-progress-head">This Season's Development <span class="award-count">${changes.length}</span></div>
        <div class="season-progress-list">${items}</div>
      </div>`;
  }
  function buildAttributesTabHTML(season){
    const decade = decadeForYear(career.year);
    const schemeId = career.teamScheme ? career.teamScheme[career.teamId] : null;
    const scheme = SCHEMES.find(s=>s.id===schemeId);
    const eff = schemeEffective(career.age, decade, schemeId);
    const original = career.originalBuild || build;
    const devSpeed = career.devSpeed || 1;
    const overallNow = Math.round(weighted(eff, OVERALL_WEIGHTS));
    const totalDelta = ATTR_KEYS.filter(k=>k!=="DUR").reduce((s,k)=> s+(build[k]-(original[k] ?? build[k])), 0);
    const seasonProgressHtml = buildSeasonProgressHTML(season);

    const blocks = ATTR_GROUP_ORDER.map(g=>{
      const keys = ATTR_KEYS.filter(k=> ATTR_BY_KEY[k].group===g);
      const rows = keys.map(k=>{
        const label = ATTR_BY_KEY[k].label;
        const draftVal = original[k] ?? build[k];
        const nowVal = build[k];
        const delta = nowVal-draftVal;
        const cls = delta>0 ? "good" : delta<0 ? "bad" : "";
        const deltaText = delta!==0 ? ` <span class="${cls}">(${delta>0?"+":""}${delta})</span>` : "";
        return `<tr><td>${svgEscape(label)}</td><td class="tabular">${draftVal}</td><td class="tabular">${nowVal}${deltaText}</td><td class="tabular">${eff[k]}</td></tr>`;
      }).join("");
      return `<div class="calc-group">
          <div class="calc-group-head">${ATTR_GROUP_LABEL[g]}</div>
          <div class="admin-table-wrap"><table class="calc-ref-table">
            <thead><tr><th>Attribute</th><th>Draft Day</th><th>Now</th><th>Effective</th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>
        </div>`;
    }).join("");

    return `
      ${seasonProgressHtml}
      <div class="calc-metric">
        <div class="calc-metric-head"><span class="calc-metric-name">Overall (right now)</span><span class="calc-metric-result">${overallNow}</span></div>
        <div class="calc-refnote">Development trait: <b>${svgEscape(devSpeedTag(devSpeed))}</b> — every attribute except Durability drifts a little each season based on age, how much you've actually played, and this hidden trait. It isn't fixed forever: a breakout or bust-spiral season can shift it for the rest of your career. Net change since draft day: <b>${totalDelta>0?"+":""}${totalDelta}</b> across all eleven developable attributes. "Effective" is what's actually driving this season's production: your current raw rating aged for ${career.age}, reweighted for the ${decade}${scheme?` under a ${svgEscape(scheme.name)} scheme`:""}.</div>
      </div>
      ${blocks}
    `;
  }

  // ----- Front Office & Fanbase widget: a compact read on GM relations, fan support, and league
  // popularity -- the three relationship stats that drive contract leverage, trade/release risk,
  // and reputation-adjacent narrative, but (unlike Team Grade) aren't broadcast anywhere else in
  // the season card. -----
  function fanMeterRow(label, value, sub){
    return `<div class="fo-row">
        <div class="fo-row-head"><span class="fo-row-label">${label}</span><span class="fo-row-value tabular">${Math.round(value)}</span></div>
        <span class="meter"><span class="meter-fill" style="width:${clamp(value,0,100)}%;"></span></span>
        ${sub?`<div class="fo-row-sub">${sub}</div>`:""}
      </div>`;
  }
  function buildFrontOfficeWidgetHTML(){
    const schemeId = career.teamScheme ? career.teamScheme[career.teamId] : null;
    const scheme = SCHEMES.find(s=>s.id===schemeId);
    const gmTag = career.gmRelationship>=70 ? "Trusts you" : career.gmRelationship>=40 ? "Neutral" : "Bad blood";
    const fanTag = career.fanSupport>=70 ? "Beloved" : career.fanSupport>=40 ? "Mixed" : "Booed";
    const popTag = career.leaguePopularity>=70 ? "National name" : career.leaguePopularity>=40 ? "Known" : "Under the radar";
    const ageCap = durabilityAgeCap();
    const yearsLeft = Math.max(0, ageCap-career.age);
    const durTag = build.DUR>=80 ? "Iron man" : build.DUR>=55 ? "Average wear" : "Fragile";
    const wear = career.wearAndTear||0;
    const wearTag = wear>=85 ? "Running on Fumes" : wear>=65 ? "Breaking Down" : wear>=45 ? "Battle-Tested" : wear>=25 ? "Some Mileage" : "Fresh";
    const wearSub = wear>=45
      ? `Playing through injuries instead of resting them is what built this up — above 45, every season carries a real chance of a permanent physical decline.`
      : `Stays low by resting injuries instead of playing through them. Keep it that way to protect his physical attributes long-term.`;
    return `<div class="front-office-widget">
        ${fanMeterRow("GM Relations", career.gmRelationship, gmTag)}
        ${fanMeterRow("Fan Support", career.fanSupport, fanTag)}
        ${fanMeterRow("League Popularity", career.leaguePopularity, popTag)}
        ${fanMeterRow("Wear & Tear", wear, `${wearTag} — ${wearSub}`)}
        <div class="fo-row">
          <div class="fo-row-head"><span class="fo-row-label">Career Outlook</span><span class="fo-row-value tabular">${durTag}</span></div>
          <div class="fo-row-sub">Durability ${build.DUR} — the body should hold up through roughly age ${ageCap}${yearsLeft>0 ? ` (about ${yearsLeft} more season${yearsLeft===1?"":"s"} at current age, injuries permitting)` : " — this could be the last one"}.</div>
        </div>
        <div class="fo-row">
          <div class="fo-row-head"><span class="fo-row-label">Supporting Cast</span><span class="fo-row-value tabular">O-Line ${castLetterGrade(career.oline)} · Weapons ${castLetterGrade(career.weapons)}</span></div>
          <div class="fo-row-sub">${career.oline<48 ? "A shaky line means more hits taken and a real bump to injury risk. " : career.oline>=82 ? "One of the best lines in the league — extra time in the pocket every week. " : ""}${career.weapons<48 ? "Thin at the skill positions — every rep gets a little harder to complete." : career.weapons>=82 ? "A genuinely stacked group of targets makes every throw a little easier." : ""}</div>
        </div>
        ${scheme ? `<div class="fo-scheme-line">Running <b>${scheme.name}</b> — ${schemeFavorText(schemeId) || "no strong lean"}. <span class="fo-scheme-link" data-goto-scheme="1">See details →</span></div>` : ""}
        ${career.relationship ? `<div class="fo-scheme-line">${career.relationship.status==="married"?"Married to":"Dating"} <b>${svgEscape(career.relationship.partnerName)}</b>, the ${svgEscape(career.relationship.partnerType)}, since ${career.relationship.startYear}.</div>` : ""}
        ${career.achievements ? `<div class="fo-row">
          <div class="fo-row-head"><span class="fo-row-label">Achievements</span><span class="fo-row-value tabular">${Object.values(career.achievements.unlocked).filter(Boolean).length} / ${ACHIEVEMENTS.length}</span></div>
        </div>` : ""}
      </div>`;
  }

  /* Achievements tab: the full 30-achievement roster, earned ones shown gold with their blurb,
     locked ones greyed out with a vague hint instead of the exact threshold. No interaction, no
     equip -- just a trophy case of everything this career has actually done. */
  function buildAchievementsTabHTML(){
    ensureAchievementState();
    const earnedCount = Object.values(career.achievements.unlocked).filter(Boolean).length;
    const cards = ACHIEVEMENTS.map(def=>{
      const unlocked = !!career.achievements.unlocked[def.key];
      return `<div class="pb-card${unlocked?"":" is-locked"}">
          <div class="pb-slot" style="cursor:default;">${achievementFrameHTML(def, unlocked)}</div>
          <div class="pb-card-name">${svgEscape(def.name)}</div>
          <div class="pb-card-tier">${unlocked?"Earned":"Locked"}</div>
          <div class="pb-card-hint">${unlocked ? svgEscape(def.blurb) : svgEscape(def.hint)}</div>
        </div>`;
    }).join("");
    return `<div class="calc-refnote">${earnedCount} of ${ACHIEVEMENTS.length} achievements earned this career. Every one is permanent once earned — no equipping, just a record of what actually happened.</div>
      <div class="pb-grid" style="margin-top:1rem;">${cards}</div>`;
  }

  function buildEventLogFeedHTML(){
    const lines = (career.transactions||[]).slice().reverse();
    if(!lines.length) return `<div class="feed-wrap"><div class="feed-empty">No transactions logged yet.</div></div>`;
    const rows = lines.map(line=>{
      const m = line.match(/^(\d{4}):\s*(.*)$/);
      const year = m ? m[1] : "";
      const text = m ? m[2] : line;
      let cls = "";
      if(/suspend|bann|released|waived|cut|injur|out \d+ season|federal investigation/i.test(text)) cls = "bad";
      else if(/sign|drafted|re-signed|mvp|champion|pro bowl|all-pro|extended|captain/i.test(text)) cls = "good";
      else if(/traded|draft/i.test(text)) cls = "gold";
      return `<div class="feed-line ${cls}"><span class="feed-year tabular">${year}</span><span class="feed-text">${text}</span></div>`;
    }).join("");
    return `<div class="feed-wrap">${rows}<div class="feed-line"><span class="feed-year"></span><span class="feed-text" style="color:var(--ink-muted);">— present day<span class="feed-cursor"></span></span></div></div>`;
  }

  function renderSeasonCard(season){
    const content = document.getElementById("careerContent");
    const badges = season.awards.map(a=>`<span class="badge ${/Champion$/.test(a)||a==="MVP"?"gold":"good"}">${a}</span>`).join("");
    const brokenRecords = checkSeasonRecords(season);
    const recBy = {}; brokenRecords.forEach(r=> recBy[r.key]=r);
    const simBests = checkSimHistoricalBest(season);
    const simBy = {}; simBests.forEach(r=> simBy[r.key]=r);
    const narratives = [];
    if(season.missedGamesInjury>0 && season.missedGamesSuspension>0){
      narratives.push(`Missed ${season.missedGamesInjury} game${season.missedGamesInjury===1?"":"s"} to injury and ${season.missedGamesSuspension} to suspension.`);
    } else if(season.missedGamesSuspension>0){
      narratives.push(`Missed ${season.missedGamesSuspension} game${season.missedGamesSuspension===1?"":"s"} to suspension.`);
    } else if(season.missedGamesInjury>0){
      narratives.push(`Missed ${season.missedGamesInjury} game${season.missedGamesInjury===1?"":"s"} to injury.`);
    }
    if(career.seasonsWithTeam===1 && career.seasonNumber>1) narratives.push(`First season in a new uniform with the ${season.teamName}.`);
    if(season.contractTier==="minimum") narratives.push(`A minimum-deal roster spot — every snap has to be earned.`);
    else if(season.contractTier==="backup") narratives.push(`A backup-caliber deal — the job isn't guaranteed week to week.`);
    if(season.wins/Math.max(1,season.games) >= 0.75) narratives.push(`One of the best rooms in the league all year.`);
    if(season.wins/Math.max(1,season.games) <= 0.25 && season.games>4) narratives.push(`A rough year up front — the offense never found its footing.`);
    if(career.age>=agingVetThreshold()) narratives.push(`Father Time is undefeated — with a durability grade like this, every season from here is borrowed time.`);
    if(season.wearBreakdown){
      const keyLabels = season.wearBreakdown.keys.map(k=>(ATTR_BY_KEY[k]||{}).label||k).join(" and ");
      narratives.push(`⚠ The wear finally caught up with him this year — a permanent decline in ${keyLabels}. Playing through pain has a real cost.`);
    }

    const p = season.playoffs;
    const standingsLine = p.made
      ? `<span class="badge good">Made the playoffs</span> — <b>#${p.seed} seed</b>, ${season.teamWins}-${season.teamLosses}, #${p.confRank} of ${p.confSize} in the conference.`
      : `Missed the playoffs — ${season.teamWins}-${season.teamLosses}, #${p.confRank} of ${p.confSize} in the conference.`;
    const recordDiffers = (season.wins!==season.teamWins) || (season.losses!==season.teamLosses);
    const recordNote = recordDiffers
      ? `<div class="record-note">As the starter you went <b>${season.wins}-${season.losses}</b>; the backup went ${season.teamWins-season.wins}-${season.teamLosses-season.losses} in relief.</div>`
      : "";

    let bracketHtml = "";
    let playoffRoundsHtml = "";
    if(p.made && p.rounds.length){
      // The bracket graphic used to be drawn immediately, in full, from the already-simulated
      // final results -- which gave away the win/loss AND exactly how far the run went before a
      // single quarter had actually been simmed out, defeating the whole point of the paced
      // reveal below it. It's now just an empty placeholder here; animatePlayoffQuarters fills it
      // in (from the CURRENT, possibly Key-Moment-swung scores) only once every round the player
      // took part in has actually finished revealing.
      bracketHtml = `<div id="playoffBracketHolder"></div>`;
      // Every playoff round the player actually took part in (not just the Super Bowl) gets its
      // own paced, quarter-by-quarter reveal plus a read on the opponent's tendency -- the Super
      // Bowl keeps the extra gold "championship" treatment and full box score, every other round
      // gets a lighter version of the same box so a deep playoff run genuinely feels like a series
      // of distinct, developing games instead of one bracket graphic.
      // Nothing renders up front here at all beyond an empty holder -- not even round 1's box.
      // animatePlayoffQuarters appends each round's box (via playoffRoundBoxHtml) into it one at a
      // time, only once the player has actually won their way into that round, so the DOM itself
      // never gives away how far a run went before it's been played out.
      playoffRoundsHtml = `<div id="playoffRoundsHolder"></div>`;
    }

    const rushMini = season.rushAtt>0
      ? `<span>Rush <b class="tabular">${season.rushAtt}-${season.rushYards.toLocaleString()}${season.rushTd?" · "+season.rushTd+" TD":""}</b>${recBy.rushYards?recordBadgeHtml(recBy.rushYards):""}${simBy.rushYards?simBestBadgeHtml(simBy.rushYards):""}</span>` : "";
    const sacksMini = `<span>Sacks Taken <b class="tabular">${season.sacks}</b></span>`;

    // Overall delta badge: compares this season's grade against the PREVIOUS season's, the same
    // "roster update" convention sports games use -- so it reads as "what changed since last time,"
    // not a comparison against the draft-day scouting grade (a different, unrelated number). No
    // badge on a debut season since there's nothing yet to compare against.
    const prevSeason = career.seasonLog.length>=2 ? career.seasonLog[career.seasonLog.length-2] : null;
    const overallDelta = prevSeason ? season.overall-prevSeason.overall : null;
    const overallDeltaBadge = (overallDelta!==null && overallDelta!==0)
      ? `<span class="sb-delta ${overallDelta>0?"up":"down"}">${overallDelta>0?"+":""}${overallDelta}</span>` : "";

    content.innerHTML = `
      <div class="season-card">
        <div class="summary-bar">
          <div class="sb-left">
            <div class="sb-name">${career.name}</div>
            <div class="sb-year">${season.year}</div>
            <div class="sb-sub">Age ${season.age} · ${season.decade}</div>
          </div>
          <div class="sb-mid">
            <div class="sb-stat"><div class="sb-stat-label">Team</div><div class="sb-stat-value" style="font-size:1rem;">${season.teamName}</div></div>
            <div class="sb-stat"><div class="sb-stat-label">Contract</div><div class="sb-stat-value tabular">${fmtMoney(season.contractApy)}<span style="font-size:0.6rem;color:var(--header-muted);text-transform:uppercase;"> /yr ${season.contractTier}</span></div></div>
            <div class="sb-stat grade"><div class="sb-stat-label">Team Grade</div><div class="sb-stat-value tabular">${season.teamOverall}</div></div>
            <div class="sb-stat overall">
              <div class="sb-stat-label">Overall</div>
              <div class="sb-stat-value tabular">${season.overall}</div>
              ${overallDeltaBadge}
            </div>
          </div>
          <div class="sb-right">
            <div class="sb-record"><span>Your Record</span>${season.wins}-${season.losses}</div>
          </div>
        </div>

        <div class="season-body">
          <div class="dash-tabs">
            <button type="button" class="dash-tab-arrow" id="dashTabPrev" aria-label="Previous tab">‹</button>
            <div class="dash-tabs-track">
              <button type="button" class="dash-tab active" data-tab="season">Season</button>
              <button type="button" class="dash-tab" data-tab="schedule">Schedule</button>
              <button type="button" class="dash-tab" data-tab="standings">Standings</button>
              <button type="button" class="dash-tab" data-tab="league">League</button>
              <button type="button" class="dash-tab" data-tab="awards">Awards</button>
              <button type="button" class="dash-tab" data-tab="trends">Career Trends</button>
              <button type="button" class="dash-tab" data-tab="attributes">Attributes</button>
              <button type="button" class="dash-tab" data-tab="scheme">Scheme</button>
              <button type="button" class="dash-tab" data-tab="badges">Achievements</button>
              <button type="button" class="dash-tab" data-tab="log">Log</button>
            </div>
            <button type="button" class="dash-tab-arrow" id="dashTabNext" aria-label="Next tab">›</button>
          </div>

          <div class="dash-tabpanel active" id="tabpanel-season">
            <div class="widget-grid">
              <div class="stat-widget"><span class="sw-label">Pass Yards</span><span class="sw-value tabular">${season.yards.toLocaleString()}${recBy.yards?recordBadgeHtml(recBy.yards):""}${simBy.yards?simBestBadgeHtml(simBy.yards):""}</span><span class="sw-sub">${season.comp}/${season.att} · ${(season.pct*100).toFixed(1)}%</span></div>
              <div class="stat-widget"><span class="sw-label">Touchdowns</span><span class="sw-value good tabular">${season.td}${recBy.td?recordBadgeHtml(recBy.td):""}${simBy.td?simBestBadgeHtml(simBy.td):""}</span><span class="sw-sub">${season.games} games played</span></div>
              <div class="stat-widget${season.int>=15?" neg":""}"><span class="sw-label">Interceptions</span><span class="sw-value${season.int>=15?" bad":""} tabular">${season.int}</span><span class="sw-sub">&nbsp;</span></div>
              <div class="stat-widget"><span class="sw-label">Passer Rating</span><span class="sw-value tabular">${season.rating}${recBy.rating?recordBadgeHtml(recBy.rating):""}${simBy.rating?simBestBadgeHtml(simBy.rating):""}</span><span class="sw-sub">&nbsp;</span></div>
            </div>
            <div class="mini-stat-row">
              <span>Games <b class="tabular">${season.games}</b></span>
              ${rushMini}
              ${sacksMini}
            </div>
            <div class="badge-row" id="badgeRow">${badges}</div>
            ${narratives.map(n=>`<div class="narrative">${n}</div>`).join("")}
            <div class="standings-block">
              <div class="standings-line">${standingsLine}</div>
              ${recordNote}
              ${bracketHtml}
              ${playoffRoundsHtml}
            </div>
            ${buildFrontOfficeWidgetHTML()}
          </div>

          <div class="dash-tabpanel" id="tabpanel-schedule">${buildScheduleTabHTML(season)}</div>
          <div class="dash-tabpanel" id="tabpanel-standings">${buildStandingsTabHTML(season)}</div>
          <div class="dash-tabpanel" id="tabpanel-league">${buildLeagueTabHTML(season)}</div>
          <div class="dash-tabpanel" id="tabpanel-awards">${buildAwardCeremonyHTML(season)}</div>
          <div class="dash-tabpanel" id="tabpanel-trends">${buildTrendsTabHTML()}</div>
          <div class="dash-tabpanel" id="tabpanel-attributes">${buildAttributesTabHTML(season)}</div>
          <div class="dash-tabpanel" id="tabpanel-scheme">${buildSchemeTabHTML()}</div>
          <div class="dash-tabpanel" id="tabpanel-badges">${buildAchievementsTabHTML()}</div>
          <div class="dash-tabpanel" id="tabpanel-log">${buildEventLogFeedHTML()}</div>
        </div>
        <div class="season-actions" id="seasonActions"></div>
      </div>`;

    renderTrendsSparkline();
    content.querySelectorAll(".dash-tab").forEach(btn=>{
      btn.addEventListener("click", ()=> switchDashTab(btn.dataset.tab));
    });
    // Left/right arrow tab switcher: steps to the previous/next tab in DOM order instead of a
    // horizontally-scrolling row of buttons. The individual .dash-tab buttons stay in the DOM
    // (only the active one is shown, see CSS) so switchDashTab/deep-links/tests all keep working
    // unchanged -- this only changes how a tab gets selected.
    const dashTabKeys = Array.from(content.querySelectorAll(".dash-tab")).map(b=>b.dataset.tab);
    function stepDashTab(dir){
      const activeBtn = content.querySelector(".dash-tab.active");
      const curIdx = Math.max(0, dashTabKeys.indexOf(activeBtn ? activeBtn.dataset.tab : dashTabKeys[0]));
      const nextIdx = (curIdx+dir+dashTabKeys.length)%dashTabKeys.length;
      switchDashTab(dashTabKeys[nextIdx]);
    }
    const dashPrevBtn = document.getElementById("dashTabPrev");
    const dashNextBtn = document.getElementById("dashTabNext");
    if(dashPrevBtn) dashPrevBtn.addEventListener("click", ()=> stepDashTab(-1));
    if(dashNextBtn) dashNextBtn.addEventListener("click", ()=> stepDashTab(1));
    const schemeLink = content.querySelector("[data-goto-scheme]");
    if(schemeLink) schemeLink.addEventListener("click", ()=> switchDashTab("scheme"));

    const actions = document.getElementById("seasonActions");
    const tradeBtnHtml = canRequestTrade()
      ? `<button class="btn btn-ghost" id="reqTradeBtn">Request a trade <span class="tabular" style="opacity:0.6;">(${3-(career._tradeRequestsUsed||0)} left)</span></button>` : "";
    if(career.age+1>=29){
      actions.innerHTML = `
        <button class="btn btn-primary" id="playOnBtn">Play another season</button>
        ${tradeBtnHtml}
        <button class="btn btn-ghost" id="retireBtn">Retire</button>`;
      document.getElementById("playOnBtn").addEventListener("click", nextSeason);
      document.getElementById("retireBtn").addEventListener("click", ()=>{ career.exitReason="retired"; finishCareer(); });
    } else {
      actions.innerHTML = `<button class="btn btn-primary" id="continueBtn">Continue career</button>${tradeBtnHtml}`;
      document.getElementById("continueBtn").addEventListener("click", nextSeason);
    }
    const reqTradeBtn = document.getElementById("reqTradeBtn");
    if(reqTradeBtn) reqTradeBtn.addEventListener("click", requestTrade);
    // the playoff reveal is now player-paced (sim quarter/half/end-of-game buttons) rather than
    // automatic, so advancing to next season is held until every round the player took part in
    // has actually been simmed out -- built AFTER the action buttons above exist, so it can
    // actually disable them.
    if(season.playoffs.made && season.playoffs.rounds.length){
      actions.classList.add("pending-reveal");
      actions.querySelectorAll("button").forEach(b=> b.disabled = true);
    }
    animatePlayoffQuarters(season);
    updateHeaderCareerTicker();
  }

  /* ================= Key Moment mini-game ================= */
  // A play-call archetype that directly counters one opponent tendency each -- one clean 1:1
  // mapping keeps "was that the right read?" unambiguous, while still requiring the player to
  // actually recognize which of 8 tendencies they're facing from the clue given.
  const PLAY_CALLS = [
    { id:"spreadthrow", label:"Spread them out and throw", countersTendencyId:"runheavy",
      why:"A run-committed front leaves light coverage behind it — make them defend the whole field through the air." },
    { id:"quickgame", label:"Quick game — get the ball out fast", countersTendencyId:"blitzheavy",
      why:"Beat extra rushers before they arrive with a fast, pre-determined read." },
    { id:"attackmiddle", label:"Attack the middle of the field", countersTendencyId:"lockdowncorners",
      why:"Their corners are the strength — work the throws that never go near them." },
    { id:"controlclock", label:"Keep it on the ground, control the clock", countersTendencyId:"preventlate",
      why:"Against a shell that's conceding everything underneath, don't force a shot you don't need." },
    { id:"checkdowns", label:"Play it safe — check downs only", countersTendencyId:"turnoverhunting",
      why:"Ball-hawking safeties feed on risk — take what's guaranteed and live for the next down." },
    { id:"playaction", label:"Play-action to slow the rush", countersTendencyId:"physicalfront",
      why:"A run fake buys a beat of hesitation from a front that's pinning its ears back." },
    { id:"horizontalstretch", label:"Stretch them horizontally with quick outs", countersTendencyId:"disciplinedzone",
      why:"A patient zone won't bite on a double move — make it defend sideline to sideline instead." },
    { id:"protectball", label:"Play conservative, protect the ball", countersTendencyId:"suddenchange",
      why:"Give this defense a short field off a turnover and they'll make it count — don't hand it to them." },
  ];
  // "Hard" difficulty deliberately withholds the tendency's own label/blurb and gives only an
  // indirect, observational clue instead -- genuine deduction rather than just re-reading the
  // scouting-report line already shown on the round card.
  const TENDENCY_SUBTLE_CLUES = {
    runheavy: "Their front seven has stayed in base personnel on nearly every snap tonight.",
    blitzheavy: "The pocket has collapsed unusually fast on early downs all game.",
    lockdowncorners: "Nothing has connected outside the numbers all night.",
    preventlate: "Every completion in the fourth quarter has come up short of the sticks.",
    turnoverhunting: "Their safeties keep creeping toward the ball right before the snap.",
    physicalfront: "Every hit has landed a beat after the whistle should've saved him.",
    disciplinedzone: "Nobody's beaten a double move on them all game.",
    suddenchange: "The one short field they got all game turned into seven points in under a minute.",
  };
  // Situational flavor is independent of the tendency clue -- varying down/distance/score/clock
  // context across ~18 entries in three difficulty tiers gives "many scenarios," while the clue
  // directness (see TENDENCY_SUBTLE_CLUES / keyMomentClue below) is the actual difficulty lever.
  // Every situation below explicitly reads as the fourth quarter, on purpose: the mini-game is
  // ALWAYS resolved at the checkpoint right after Q3 (see revealOneQuarter's
  // `r._revealedCount===3` check), deciding what happens entering the fourth -- never any other
  // quarter. Two entries used to break that (km_m3 read as a pre-halftime two-minute drill,
  // km_h2 read as if overtime were already happening) even though the moment can only ever be
  // entering the fourth when it fires; both were rewritten below to match what's actually
  // happening on the field.
  const KEY_MOMENT_SITUATIONS = [
    { id:"km_e1", difficulty:"easy", text:"1st-and-10 to open the fourth quarter. Plenty of clock left to find something that works." },
    { id:"km_e2", difficulty:"easy", text:"2nd-and-6 early in the fourth, comfortably up two scores. No need to force anything — just keep the chains moving." },
    { id:"km_e3", difficulty:"easy", text:"3rd-and-4 in your own territory, midway through the fourth. A conversion here keeps the drive breathing." },
    { id:"km_e4", difficulty:"easy", text:"1st-and-10 after a big return on the kickoff to open the fourth sets you up in plus territory." },
    { id:"km_e5", difficulty:"easy", text:"2nd-and-3 near midfield early in the fourth, game still very much in reach either way." },
    { id:"km_e6", difficulty:"easy", text:"3rd-and-2, a short-yardage look, fourth quarter." },
    { id:"km_m1", difficulty:"medium", text:"3rd-and-7 in the fourth, the game within a possession, under six minutes left." },
    { id:"km_m2", difficulty:"medium", text:"2nd-and-11 early in the fourth after a negative play, needing to answer before the defense pins its ears back." },
    { id:"km_m3", difficulty:"medium", text:"1st-and-10 starting a two-minute drill to force overtime, trailing late in the fourth." },
    { id:"km_m4", difficulty:"medium", text:"3rd-and-5 in the red zone, fourth quarter — a field goal isn't enough here." },
    { id:"km_m5", difficulty:"medium", text:"2nd-and-8 in the fourth, on a drive that has to end in points to stay alive." },
    { id:"km_m6", difficulty:"medium", text:"3rd-and-3 in the fourth with a delay-of-game penalty already burning a timeout." },
    { id:"km_h1", difficulty:"hard", text:"4th-and-3 from your own 40 in the fourth, under two minutes left, trailing by three." },
    { id:"km_h2", difficulty:"hard", text:"3rd-and-11 late in the fourth, no tomorrow if this drive stalls out." },
    { id:"km_h3", difficulty:"hard", text:"4th-and-goal from the 4, down four, final minute of the fourth." },
    { id:"km_h4", difficulty:"hard", text:"2nd-and-19 in the fourth after back-to-back penalties, no timeouts left, trailing late." },
    { id:"km_h5", difficulty:"hard", text:"3rd-and-1 at your own goal line in the fourth, protecting a one-point lead with 90 seconds on the clock." },
    { id:"km_h6", difficulty:"hard", text:"4th-and-1 to seal it in the fourth, up three, under a minute to go." },
  ];
  // Higher-stakes rounds skew the situation pool toward the harder tiers -- the deeper the run,
  // the less hand-holding the mini-game gives.
  const ROUND_DIFFICULTY_WEIGHTS = {
    "Wild Card": {easy:0.55, medium:0.35, hard:0.10},
    "Divisional": {easy:0.35, medium:0.45, hard:0.20},
    "Conference Championship": {easy:0.15, medium:0.45, hard:0.40},
    "Super Bowl": {easy:0.05, medium:0.35, hard:0.60},
  };
  function pickKeyMomentSituation(roundLabel){
    const weights = ROUND_DIFFICULTY_WEIGHTS[roundLabel] || {easy:0.34, medium:0.33, hard:0.33};
    const r = Math.random();
    const difficulty = r < weights.easy ? "easy" : (r < weights.easy+weights.medium ? "medium" : "hard");
    const pool = KEY_MOMENT_SITUATIONS.filter(s=>s.difficulty===difficulty);
    return pick(pool.length ? pool : KEY_MOMENT_SITUATIONS);
  }
  // The clue's directness IS the difficulty lever: easy names the tendency outright, medium
  // describes it without naming it, hard gives only an indirect observational detail.
  function keyMomentClue(tendency, difficulty){
    if(difficulty==="easy") return `Your coordinator has seen it clearly all game: <b>${svgEscape(tendency.label)}</b> — ${svgEscape(tendency.blurb)}`;
    if(difficulty==="medium") return `The scouting report keeps coming back to the same read: ${svgEscape(tendency.blurb)}`;
    return `Nobody in the box is certain yet, but the tape from earlier tonight hinted at it: ${svgEscape(TENDENCY_SUBTLE_CLUES[tendency.id] || tendency.blurb)}`;
  }
  // Trigger odds scale with the build's era-effective Clutch rating -- a low-Clutch build almost
  // never sees one, an elite-Clutch build sees one close to half the time, per eligible round.
  function keyMomentChanceFor(clu){ return clamp(0.15 + (clu-50)*0.006, 0.05, 0.55); }
  // Four options, three distinct outcome tiers: the actual counter-call (Good — full swing in the
  // player's favor), one other call tagged Meh (a defensible-but-not-optimal read — a much smaller,
  // capped swing against the player, sometimes none at all), and two tagged Bad (the wrong read,
  // full swing to the opponent). Every option carries its tier so applyKeyMomentSwing/resolve()
  // downstream never has to re-derive it. This used to be a flat "1 right, 3 identically wrong"
  // choice -- which meant three of the four options were mechanically indistinguishable and picking
  // wrong always cost the maximum.
  function keyMomentOptionsFor(correctCall){
    const others = PLAY_CALLS.filter(c=>c.id!==correctCall.id).sort(()=>Math.random()-0.5).slice(0,3);
    const mehIdx = Math.floor(Math.random()*others.length);
    const tagged = [
      { ...correctCall, quality:"good" },
      ...others.map((c,i)=> ({ ...c, quality: i===mehIdx ? "meh" : "bad" })),
    ];
    return tagged.sort(()=>Math.random()-0.5);
  }
  // Real score swing: a correct read always scores FOR the player, a wrong read always scores
  // for the opponent -- full stop, no safety net. This CAN and regularly will flip who actually
  // wins the round: a correct read in the closing minutes of a game the player was trailing can
  // erase the deficit and win it, and a blown read while protecting a lead can cough it right back
  // up. That's the whole point of a "this possession decides it" moment -- if it can't change who
  // wins, it isn't actually a key moment. (An older version of this function capped the swing so
  // it could never pass the leader; that made every Key Moment cosmetic and has been removed.)
  // If the swing happens to land the score on an exact tie, one more possession -- a coin flip
  // very slightly tilted by who's already carrying momentum -- decides it immediately, same as a
  // real sudden-death possession would.
  // The point value is drawn from actual single-play NFL scoring increments (a field goal, a
  // touchdown with/without the extra point or with a two-point try, a safety) instead of a raw
  // randInt(3,7) -- the old range silently included 4 and 5, deltas no single play can produce,
  // which is exactly what read as "messes with the scoring." When the swing lands in the
  // player's favor via a touchdown-type score, the round's own box score gets that touchdown
  // credited too, so the box stats never drift out of sync with the score they're supposed to
  // describe. round.won is recomputed from the final score once the swing (and any tie-break) has
  // been applied -- it is the single source of truth for who won this round from this point on,
  // and everything downstream (bracket advancement, the Super Bowl, awards) reads it, never the
  // pre-swing baseline.
  const KEY_MOMENT_SCORE_TYPES = [
    { pts:7, type:"touchdown", w:0.40 },
    { pts:3, type:"field goal", w:0.35 },
    { pts:6, type:"touchdown", w:0.13 },
    { pts:8, type:"touchdown", w:0.09 },
    { pts:2, type:"safety", w:0.03 },
  ];
  // Meh's pool: a defensible-but-not-sharp read still lets the defense win the down, but it's
  // never a touchdown-class breakdown -- worst case a field goal, and better than even odds the
  // drive just stalls for nothing at all. This is what actually separates Meh from Bad: Bad always
  // costs a real score, Meh usually costs nothing and never costs more than a field goal.
  const KEY_MOMENT_MEH_SCORE_TYPES = [
    { pts:0, type:"stalled drive", w:0.45 },
    { pts:3, type:"field goal", w:0.40 },
    { pts:2, type:"safety", w:0.15 },
  ];
  function pickKeyMomentScoreType(){
    const r = Math.random();
    let acc = 0;
    for(const s of KEY_MOMENT_SCORE_TYPES){ acc += s.w; if(r<acc) return s; }
    return KEY_MOMENT_SCORE_TYPES[0];
  }
  function pickKeyMomentMehScoreType(){
    const r = Math.random();
    let acc = 0;
    for(const s of KEY_MOMENT_MEH_SCORE_TYPES){ acc += s.w; if(r<acc) return s; }
    return KEY_MOMENT_MEH_SCORE_TYPES[0];
  }
  function applyKeyMomentSwing(round, quality){
    // The Key Moment always fires right after Q3 -- i.e. it's always deciding what happens
    // ENTERING the fourth quarter -- so the swing only ever lands on Q4 itself (index 3). What
    // used to happen next was the actual bug behind "won 16-13 but the game still said sim to
    // OT, then lost in OT": simulateGameScore() decides, back when the round is first generated
    // (long before the player ever sees a single quarter), whether regulation ends tied and an
    // OT segment gets baked into round.quarters. The old swing code then added its points to
    // EVERY quarter from Q4 onward, OT included, without ever asking whether that OT segment
    // still made any sense given the new Q4 total -- so a read that turned a tied Q4 into a
    // clean regulation win still dragged the box score through a leftover, already-decided
    // phantom OT possession (and the reverse: a read that tied up a Q4 that used to be decisive
    // had no OT segment at all to actually settle it). Whether the game reaches overtime is now
    // re-derived FRESH from the swung Q4 total, every time, instead of ever being inherited from
    // the old pre-swing simulation.
    const good = quality==="good";
    const picked = good || quality==="bad" ? pickKeyMomentScoreType() : pickKeyMomentMehScoreType();
    const scoreType = picked.type;
    const dMy = good ? picked.pts : 0;
    const dOpp = good ? 0 : picked.pts;

    const q4 = round.quarters[3];
    q4.myTotal += dMy; q4.oppTotal += dOpp;
    q4.myQ = (q4.myQ||0) + dMy; q4.oppQ = (q4.oppQ||0) + dOpp;
    round.myScore += dMy; round.oppScore += dOpp;

    const hadOT = round.quarters.length > 4;
    const stillTied = q4.myTotal === q4.oppTotal;
    let otNote = "";

    if(hadOT && !stillTied){
      // Regulation used to need overtime; this read just decided it before OT ever had to
      // happen. The leftover OT segment (and whatever points it had already tacked on) never
      // actually happened -- drop it and re-sync the score off Q4 alone.
      round.quarters.length = 4;
      round.myScore = q4.myTotal; round.oppScore = q4.oppTotal;
      otNote = "That decided it in regulation — no overtime needed after all.";
    } else if(!hadOT && stillTied){
      // Regulation used to be decisive; this read just tied it back up. Roll a brand new
      // overtime possession off the same team strengths the round was generated with -- a
      // correct read that only manages to tie the game sends it to a fair extra possession,
      // same as it would in a real game; a blown/lesser read that ties it up hands that extra
      // possession to the defense, same fairness rule the old tiebreak used (a good read should
      // never come out net-negative from a moment it otherwise won).
      const otTd = Math.random()<0.7;
      const otPts = otTd?6:3;
      let otMy=0, otOpp=0;
      if(good) otMy = otPts;
      else if(Math.random() < 0.5 + ((round._offOverall??65)-(round._defOffense??round._defOverall??65))*0.01) otMy = otPts;
      else otOpp = otPts;
      round.quarters.push({ q:"OT", myQ: otMy, oppQ: otOpp, myTotal: q4.myTotal+otMy, oppTotal: q4.oppTotal+otOpp });
      round.myScore = q4.myTotal+otMy; round.oppScore = q4.oppTotal+otOpp;
      otNote = good ? "Tied it up, then took it in overtime." : "Tied it up, but the defense finished it in overtime.";
    } else if(hadOT && stillTied){
      // Still tied after the swing (only possible on a true no-op, e.g. a stalled-drive Meh
      // outcome with zero points) -- the existing OT segment's own scoring is untouched.
      round.myScore = round.quarters[round.quarters.length-1].myTotal;
      round.oppScore = round.quarters[round.quarters.length-1].oppTotal;
    }

    // keep the box score's touchdown count consistent with a touchdown-type swing in the
    // player's own favor -- attributed to the QB as a passing score, capped the same way
    // generateGameBoxScore caps it.
    if(dMy>0 && scoreType==="touchdown" && round.box) round.box.td = clamp((round.box.td||0)+1, 0, 6);
    round.won = round.myScore > round.oppScore;
    return { dMy, dOpp, scoreType, otNote };
  }
  function triggerKeyMoment(season, round, roundIdx, onResolved, stillCurrent){
    // stillCurrent (optional) guards against a reveal that was superseded by a new season's
    // render between the moment this was scheduled and the moment it actually fires -- without
    // this, a fast-clicking player could see a stale Key Moment pop up over a later season.
    if(stillCurrent && !stillCurrent()) return;
    const situation = pickKeyMomentSituation(round.round);
    const tendency = round.oppTendency;
    const correctCall = PLAY_CALLS.find(c=>c.countersTendencyId===tendency.id) || PLAY_CALLS[0];
    const options = keyMomentOptionsFor(correctCall);
    const overlay = document.getElementById("keyMomentOverlay");
    if(!overlay){ onResolved(); return; }
    function renderCard(){
      overlay.innerHTML = `
        <div class="km-card">
          <div class="km-eyebrow">${roundDisplayLabel(round.round, season.year)} · Key Moment <span class="km-difficulty">${situation.difficulty}</span></div>
          <h3>Fourth quarter. This possession decides it.</h3>
          <div class="km-situation">${svgEscape(situation.text)}</div>
          <div class="km-clue">${keyMomentClue(tendency, situation.difficulty)}</div>
          <div class="km-options">${options.map(o=>`<button type="button" class="km-option" data-call="${o.id}">${svgEscape(o.label)}</button>`).join("")}</div>
        </div>`;
      overlay.querySelectorAll(".km-option").forEach(btn=>{
        btn.addEventListener("click", ()=> resolve(btn.dataset.call));
      });
    }
    function resolve(chosenId){
      const chosenOption = options.find(o=>o.id===chosenId) || {};
      const quality = chosenOption.quality || (chosenId===correctCall.id ? "good" : "bad");
      const wonBeforeSwing = round.won;
      const swing = applyKeyMomentSwing(round, quality);
      const flippedResult = round.won !== wonBeforeSwing;
      const repDelta = quality==="good" ? randInt(2,5) : quality==="meh" ? randInt(-2,1) : -randInt(2,5);
      career.reputation = clamp(career.reputation + repDelta, 0, 100);
      const verbPhrase = quality==="good" ? "Delivered" : quality==="meh" ? "Settled for a lesser read" : "Came up short";
      career.transactions.push(`${season.year}: ${verbPhrase} in a key moment vs. the ${round.opponent} (${roundDisplayLabel(round.round, season.year)}).`);
      overlay.querySelectorAll(".km-option").forEach(btn=>{
        btn.disabled = true;
        if(btn.dataset.call===correctCall.id) btn.classList.add("correct");
        else if(btn.dataset.call===chosenId && quality==="meh") btn.classList.add("meh");
        else if(btn.dataset.call===chosenId) btn.classList.add("wrong");
      });
      const outcomeEl = document.createElement("div");
      outcomeEl.className = "km-outcome " + (quality==="good" ? "good" : quality==="meh" ? "meh" : "bad");
      outcomeEl.innerHTML = quality==="good"
        ? `Right read. The play works exactly as drawn up.`
        : quality==="meh"
        ? `Not the sharpest read — it doesn't blow up on you, but it doesn't answer the defense either.`
        : `Wrong read. The defense was sitting on it.`;
      const whyEl = document.createElement("div");
      whyEl.className = "km-why";
      whyEl.textContent = correctCall.why;
      const effectEl = document.createElement("div");
      effectEl.className = "km-effect";
      const scoreBit = swing.dMy ? `Your score ${fmtDelta(swing.dMy)}${swing.scoreType?` (${swing.scoreType})`:""}` : (swing.dOpp ? `Their score ${fmtDelta(swing.dOpp)}${swing.scoreType?` (${swing.scoreType})`:""}` : "No score change — the margin was already too tight to move.");
      effectEl.textContent = `Effect: ${scoreBit} · Reputation ${fmtDelta(repDelta)}.`;
      let flipEl = null;
      if(flippedResult){
        flipEl = document.createElement("div");
        flipEl.className = "km-effect km-flip " + (round.won ? "good" : "bad");
        flipEl.textContent = round.won
          ? "That's the whole game. The read just won it."
          : "That's the whole game. The read just lost it.";
      }
      const continueBtn = document.createElement("button");
      continueBtn.type = "button";
      continueBtn.className = "btn btn-primary km-continue";
      continueBtn.textContent = "Continue";
      continueBtn.addEventListener("click", ()=>{
        overlay.classList.remove("open");
        overlay.setAttribute("aria-hidden","true");
        overlay.innerHTML = "";
        // refresh the final-score line and the just-revealed quarter cards so the swing is
        // visible immediately, not just once the round finishes revealing.
        const finalEl = document.querySelector(`[data-round-idx="${roundIdx}"] .pr-box-final b, [data-round-idx="${roundIdx}"] .sb-final b`);
        if(finalEl) finalEl.textContent = `${round.myScore}-${round.oppScore}`;
        onResolved();
      });
      const card = overlay.querySelector(".km-card");
      card.appendChild(outcomeEl); card.appendChild(whyEl); card.appendChild(effectEl);
      if(flipEl) card.appendChild(flipEl);
      card.appendChild(continueBtn);
    }
    renderCard();
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden","false");
  }

  // Player-paced quarter-by-quarter reveal for EVERY playoff round the player took part in, not
  // just the Super Bowl. This used to be fully automatic (either a CSS-timed cascade with Key
  // Moments off, or a setTimeout-sequenced cascade with them on) -- now every quarter only
  // reveals on an explicit click of one of that round's "Sim Quarter / Sim to Half / Sim to End
  // of Game" buttons, and a Key Moment (when one fires) genuinely pauses the sequence: no further
  // quarters reveal, and "Sim to End of Game" won't finish the game, until the mini-game is
  // resolved. Rounds are gone through in order -- the next round's controls only appear once the
  // current one has fully played out -- and "Play another season"/"Continue" stays disabled on
  // the season card until every round the player took part in has finished revealing.
  //
  // A Key Moment is only even rolled for when the score AT THAT POINT IN THE GAME (the running
  // total through the 3rd quarter, not the eventual final -- the player hasn't seen the final
  // yet at this point in the reveal) is still plausibly in play. A 40-0 laugher heading into the
  // 4th never rolls one; a one-score or two-score game always can; a long-shot double-digit
  // comeback can, just less often.
  //
  // Cancellation token: rendering a new season card (the player finished a previous season's
  // reveal, or the whole state got reset) must invalidate every pending callback from the OLD
  // reveal -- otherwise a stale Key Moment for a season the player has already left behind could
  // pop up on top of a completely different screen. Every step below re-checks this token before
  // touching the DOM or opening the overlay.
  let _playoffRevealToken = 0;
  function keyMomentScoreEligibility(round){
    const checkpoint = round.quarters[2] || round.quarters[round.quarters.length-1];
    const diff = Math.abs(checkpoint.myTotal - checkpoint.oppTotal);
    if(diff<=8) return 1;      // one-score game -- always live
    if(diff<=16) return 0.7;   // two-score game -- still very much in reach
    if(diff<=24) return 0.35;  // a real long-shot, but not impossible
    return 0;                  // out of reach either way -- no point running the mini-game
  }
  function animatePlayoffQuarters(season){
    _playoffRevealToken++;
    const myToken = _playoffRevealToken;
    // defensively close any Key Moment overlay left open by a now-superseded reveal
    const staleOverlay = document.getElementById("keyMomentOverlay");
    if(staleOverlay && staleOverlay.classList.contains("open")){
      staleOverlay.classList.remove("open");
      staleOverlay.setAttribute("aria-hidden","true");
      staleOverlay.innerHTML = "";
    }
    if(!season.playoffs.made || !season.playoffs.rounds.length) return;
    const actions = document.getElementById("seasonActions");
    const rounds = season.playoffs.rounds;
    rounds.forEach(r=>{ r._revealedCount = 0; r._keyMomentChecked = false; });
    const clu = eraEffective(season.age, season.decade).CLU;
    const baseChance = keyMomentChanceFor(clu);
    function stillCurrent(){ return myToken === _playoffRevealToken; }

    function quarterLabel(q){ return typeof q.q==="number" ? "Q"+q.q : q.q; }

    function finalizeRound(roundIdx){
      if(!stillCurrent()) return;
      const r = rounds[roundIdx];
      const isSB = r.round==="Super Bowl";
      const wrap = document.querySelector(`[data-round-idx="${roundIdx}"]`);
      if(wrap){ wrap.dataset.roundState = "done"; if(!isSB) wrap.classList.add(r.won?"win":"loss"); }
      const titleEl = document.getElementById((isSB?"sbTitle-":"prTitle-")+roundIdx);
      if(titleEl) titleEl.textContent = isSB ? (`${roundDisplayLabel(r.round, season.year).toUpperCase()}${r.won?" — CHAMPIONS":""}`) : (`${svgEscape(roundDisplayLabel(r.round, season.year)).toUpperCase()}${r.won?" — WIN":" — SEASON OVER"}`);
      const finalEl = document.getElementById((isSB?"sbFinal-":"prFinal-")+roundIdx);
      if(finalEl) finalEl.innerHTML = `vs. the ${svgEscape(r.opponent)} — <b>${r.myScore}-${r.oppScore}</b>`;
      if(isSB){
        const boxEl = document.getElementById("sbBox-"+roundIdx);
        if(boxEl) boxEl.style.display = "";
      }
      const controls = document.getElementById("pqControls-"+roundIdx);
      if(controls) controls.innerHTML = "";
      // Only NOW -- with r.won at its final, possibly Key-Moment-flipped value -- does the
      // bracket actually move forward. This is what generates the next round (or the Super Bowl)
      // for the very first time; nothing about how far this run goes existed before this call.
      confirmPlayoffRound(season.playoffs, season);
      if(roundIdx+1 < rounds.length){ appendRoundBox(roundIdx+1); renderControlsFor(roundIdx+1); }
      else {
        // whole run is done -- draw the bracket now, from the live (possibly Key-Moment-swung)
        // scores, so it can never show a different number than the round boxes above it.
        const bracketHolder = document.getElementById("playoffBracketHolder");
        if(bracketHolder) bracketHolder.innerHTML = renderPlayoffBracketSVG(rounds, season.teamName, season.year);
        if(actions){ actions.classList.remove("pending-reveal"); actions.querySelectorAll("button").forEach(b=> b.disabled=false); }
        // The run has truly ended (won it all or got eliminated) -- only now do the Super Bowl
        // Champion award, the ring, and the reputation/GM/fan/popularity bumps that come with a
        // title actually land, since only now is any of that a real, played-out fact.
        finalizePlayoffOutcome(season);
      }
    }

    function revealOneQuarter(roundIdx, onDone){
      if(!stillCurrent()) return;
      const r = rounds[roundIdx];
      if(r._revealedCount>=r.quarters.length){ onDone(); return; }
      const q = r.quarters[r._revealedCount];
      const isSB = r.round==="Super Bowl";
      const holder = document.getElementById("pqQuarters-"+roundIdx);
      if(holder){
        const el = document.createElement("div");
        el.className = isSB ? "sb-q" : "pr-q";
        el.innerHTML = isSB
          ? `<div class="sb-q-label">${quarterLabel(q)}</div><div class="sb-q-score tabular">${q.myTotal}-${q.oppTotal}</div>`
          : `<div class="pr-q-label">${quarterLabel(q)}</div><div class="pr-q-score tabular">${q.myTotal}-${q.oppTotal}</div>`;
        holder.appendChild(el);
      }
      r._revealedCount++;
      if(r._revealedCount===3 && !r._keyMomentChecked && r.oppTendency && KeyMomentSettings.isEnabled()){
        r._keyMomentChecked = true;
        const elig = keyMomentScoreEligibility(r);
        if(elig>0 && Math.random() < baseChance*elig){
          triggerKeyMoment(season, r, roundIdx, ()=>{ if(stillCurrent()) onDone(); }, stillCurrent);
          return;
        }
      }
      onDone();
    }
    function simQuarter(roundIdx){
      revealOneQuarter(roundIdx, ()=>{
        if(!stillCurrent()) return;
        const r = rounds[roundIdx];
        if(r._revealedCount>=r.quarters.length) finalizeRound(roundIdx);
        else renderControlsFor(roundIdx);
      });
    }
    function simToHalf(roundIdx){
      const r = rounds[roundIdx];
      const target = Math.min(2, r.quarters.length);
      function step(){
        if(!stillCurrent()) return;
        if(r._revealedCount>=r.quarters.length){ finalizeRound(roundIdx); return; }
        if(r._revealedCount>=target){ renderControlsFor(roundIdx); return; }
        revealOneQuarter(roundIdx, step);
      }
      step();
    }
    function simToEnd(roundIdx){
      const r = rounds[roundIdx];
      function step(){
        if(!stillCurrent()) return;
        if(r._revealedCount>=r.quarters.length){ finalizeRound(roundIdx); return; }
        revealOneQuarter(roundIdx, step);
      }
      step();
    }
    function renderControlsFor(roundIdx){
      if(!stillCurrent()) return;
      const r = rounds[roundIdx];
      const wrap = document.querySelector(`[data-round-idx="${roundIdx}"]`);
      if(wrap) wrap.dataset.roundState = "active";
      const controls = document.getElementById("pqControls-"+roundIdx);
      if(!controls) return;
      const nextQ = r.quarters[r._revealedCount];
      const qBtnLabel = nextQ ? `Sim to ${quarterLabel(nextQ)}` : "Sim Quarter";
      controls.innerHTML = `
        <button type="button" class="btn btn-ghost pq-btn" id="pqSimQ-${roundIdx}">${qBtnLabel}</button>
        ${r._revealedCount<2 ? `<button type="button" class="btn btn-ghost pq-btn" id="pqSimHalf-${roundIdx}">Sim to Half</button>` : ``}
        <button type="button" class="btn btn-primary pq-btn" id="pqSimEnd-${roundIdx}">Sim to End of Game</button>`;
      document.getElementById("pqSimQ-"+roundIdx).addEventListener("click", ()=> simQuarter(roundIdx));
      const halfBtn = document.getElementById("pqSimHalf-"+roundIdx);
      if(halfBtn) halfBtn.addEventListener("click", ()=> simToHalf(roundIdx));
      document.getElementById("pqSimEnd-"+roundIdx).addEventListener("click", ()=> simToEnd(roundIdx));
    }

    function appendRoundBox(roundIdx){
      const holder = document.getElementById("playoffRoundsHolder");
      if(holder) holder.insertAdjacentHTML("beforeend", playoffRoundBoxHtml(rounds[roundIdx], roundIdx, season.year));
    }

    appendRoundBox(0);
    renderControlsFor(0);
  }

  // Only called once the player's entire postseason run has actually finished playing out --
  // won the Super Bowl, or been eliminated at any round along the way. Before this point
  // season.awards could never have contained "Super Bowl Champion" and none of the ring-sized
  // reputation/GM/fan/popularity bumps had landed, no matter how the sim's internals had already
  // resolved things; this is where that becomes real, and where the DOM (badge row, front-office
  // widget, career trends/log tabs, header ticker) gets patched to finally reflect it.
  function finalizePlayoffOutcome(season){
    const playoffs = season.playoffs;
    // Pre-merger seasons (before Super Bowl I, played after the 1966 season) had no unified
    // championship game in real life -- the AFL and NFL each crowned their own champion via
    // their own Conference Championship round, full stop. Our bracket still simulates a
    // fictional cross-league finale for those years (relabeled "NFL-AFL Championship Game" --
    // see roundDisplayLabel/superBowlDisplayName) purely so a full playoff run always exists to
    // play through, but per the real history it grants no trophy: for year<1966 the actual
    // league title -- and the only thing that counts as a ring here -- is won by taking that
    // season's Conference Championship round, regardless of how the fictional finale afterward
    // turns out. From 1966 on, only an actual (correctly-numbered) Super Bowl win counts, same
    // as before.
    const preSBEra = season.year < 1966;
    const wonConfChamp = preSBEra && playoffs.rounds.some(r=> r.round==="Conference Championship" && r.won);
    const wonRing = preSBEra ? wonConfChamp : playoffs.wonSuperBowl;
    playoffs.wonRing = wonRing;
    if(wonRing){
      const ringLabel = preSBEra
        ? `${confLabel(conferenceOf(career.teamId, season.year), season.year)} Champion`
        : "Super Bowl Champion";
      playoffs.ringLabel = ringLabel;
      season.awards.push(ringLabel);
      career.totals.rings++;
      career.reputation = clamp(career.reputation + 6, 0, 100);
      career.gmRelationship = clamp((career.gmRelationship ?? 50) + 3, 0, 100);
      career.fanSupport = clamp((career.fanSupport ?? 50) + 8, 0, 100);
      career.leaguePopularity = clamp((career.leaguePopularity ?? 50) + 10, 0, 100);
      career.transactions.push(`${season.year}: Won the ${preSBEra ? ringLabel : "Super Bowl"} with the ${season.teamName}.`);
      // Fixes "won the Super Bowl, got cut" reports: waiverCheck()'s cut chance always has a
      // 2% floor, with no exception for having just won a championship. Reuse the same
      // _cutShieldSeasons mechanic that already protects a newly-named captain (captainShield),
      // but grant it for 2 seasons instead of 1 -- a ring is a bigger deal than a captaincy, and
      // this keeps a cut technically still possible (age/performance can still overwhelm the
      // shield) rather than making champions flatly uncuttable, which would be its own kind of
      // unrealistic.
      career._cutShieldSeasons = Math.max(career._cutShieldSeasons||0, 2);
    }
    checkAchievements();
    const badgesPanel = document.getElementById("tabpanel-badges");
    if(badgesPanel) badgesPanel.innerHTML = buildAchievementsTabHTML();
    const badgeRow = document.getElementById("badgeRow");
    if(badgeRow) badgeRow.innerHTML = season.awards.map(a=>`<span class="badge ${/Champion$/.test(a)||a==="MVP"?"gold":"good"}">${a}</span>`).join("");
    const foWidget = document.querySelector(".front-office-widget");
    if(foWidget){
      foWidget.outerHTML = buildFrontOfficeWidgetHTML();
      // outerHTML replaced the node itself -- re-wire the "See details" link to the Scheme tab,
      // same as the one built into the initial season-card render.
      const content = document.getElementById("careerContent");
      const schemeLink = content && content.querySelector("[data-goto-scheme]");
      if(schemeLink) schemeLink.addEventListener("click", ()=> switchDashTab("scheme"));
    }
    const trendsPanel = document.getElementById("tabpanel-trends");
    if(trendsPanel){ trendsPanel.innerHTML = buildTrendsTabHTML(); renderTrendsSparkline(); }
    const logPanel = document.getElementById("tabpanel-log");
    if(logPanel) logPanel.innerHTML = buildEventLogFeedHTML();
    updateHeaderCareerTicker();
  }

  function nextSeason(){
    career.age++; career.year++; career.seasonNumber++;
    if(career._tradeRequestCooldown>0) career._tradeRequestCooldown--;
    advanceCareer();
  }

  function updateHeaderCareerTicker(){
    const el = document.getElementById("headerRight");
    if(!career){ el.textContent = "No builds logged yet"; return; }
    el.innerHTML = `<div class="career-ticker">
        <span><b>${career.name}</b></span>
        <span>Age <b>${career.age}</b></span>
        <span class="tk-team">${teamNameAt(career.teamId, career.year)}</span>
        <span>Earned <b>${fmtMoney(career.totals.earnings)}</b></span>
        <span>Rings <b>${career.totals.rings}</b></span>
      </div>`;
  }

  function leagueAvgRatingForDecade(decade){
    const l = LEAGUE[decade];
    const att = 500;
    return passerRating(Math.round(att*l.comp), att, Math.round(att*l.ypa), Math.round(att*l.tdRate), Math.round(att*l.intRate));
  }

  function hofVerdict(){
    const t = career.totals;
    const seasons = career.seasonLog.length;
    // Quality first: career rate (passer rating), then accolades, then a HARD-CAPPED nod to volume.
    // Sheer longevity piling up garbage-time yardage should never outrank real accolades and efficiency —
    // a 20-season .500 game manager is a "Longtime Starter", not a Hall of Famer, no matter the counting stats.
    // The bar itself is era-relative: 3,000 yards and a 78 rating meant something very different in the
    // dead-ball 1970s than in the 2020s, so "average for the era" is computed per-season and attempt-weighted
    // across the whole career, not a flat modern number applied to every decade.
    const careerRating = passerRating(t.comp, t.att, t.yards, t.td, t.int);
    let baseWeighted = 0, baseAtt = 0;
    career.seasonLog.forEach(s=>{ baseWeighted += leagueAvgRatingForDecade(s.decade)*s.att; baseAtt += s.att; });
    const eraBaseline = baseAtt>0 ? baseWeighted/baseAtt : 75;
    const qualityScore = (careerRating-eraBaseline-8)*4;
    const accoladeScore = t.rings*40 + t.mvps*36 + t.allPros*16 + t.proBowls*6;
    const longevityScore = Math.min(seasons,15)*1.5;
    const volumeScore = clamp(t.yards/1200 + t.td*0.1, 0, 35);
    const score = qualityScore + accoladeScore + longevityScore + volumeScore;

    if(career.exitReason==="waived" && score<60) return {tier:"Out of the League", note:`Released after ${seasons} season${seasons===1?"":"s"} that never quite came together. The phone stopped ringing.`};

    // Top tiers also gate on a minimum sample size — real Hall of Fame cases are built on sustained
    // excellence, not one hot short stretch. Tiers are checked highest-first; a gated tier that fails
    // the season requirement simply falls through to the next one down.
    const TIERS = [
      // minRingsRoute is a second, independent way into First-Ballot: winner-take-all Pro Bowl
      // slots mean an elite player can genuinely lose out on selections to other elite QBs the
      // very seasons he wins it all, so a 3-Pro-Bowl floor alone can wrongly demote a multi-ring
      // champion (a real reported case: 4 rings in 11 seasons, only Hall of Famer). Real-life
      // multi-ring starters are essentially never a First-Ballot snub over a Pro Bowl technicality.
      { min:150, seasons:10, minProBowls:3, minRingsRoute:3, tier:"First-Ballot Hall of Famer", note:"The bronze bust is a formality at this point." },
      { min:100, seasons:8,  minProBowls:1, tier:"Hall of Famer", note:"A career the voters won't be able to leave off the ballot." },
      { min:65,  seasons:0,  minProBowls:0, tier:"Hall of Very Good", note:"A borderline case — the kind that sparks arguments for a decade." },
      { min:35,  seasons:0,  minProBowls:0, tier:"Longtime Starter", note:"Not a legend, but a team could win with this for a long time." },
      { min:12,  seasons:0,  minProBowls:0, tier:"Journeyman", note:"A real NFL career, bouncing between rosters and backup jobs." },
      { min:-Infinity, seasons:0, minProBowls:0, tier:"Camp Arm", note:"The jersey barely got game-worn, but you were on an NFL roster." },
    ];
    for(const tier of TIERS){
      const accoladeGateMet = t.proBowls>=(tier.minProBowls||0) || (tier.minRingsRoute && t.rings>=tier.minRingsRoute);
      if(score>=tier.min && seasons>=tier.seasons && accoladeGateMet){
        // "Hall of Famer" only requires ONE Pro Bowl to gate into -- a career can clear the 100-point
        // bar mostly on longevity/volume score with barely any real accolades to show for it. That's
        // exactly the "hall of fame while being not great" case: the tier is real (the math says so),
        // but calling it a lock ("voters won't be able to leave off the ballot") oversells a résumé
        // that would actually be argued about for years. First-Ballot is unaffected -- its 3-Pro-Bowl
        // floor already screens out the thin cases this is checking for.
        if(tier.tier==="Hall of Famer" && t.proBowls<=2 && t.allPros===0 && t.mvps===0 && t.rings===0){
          return { tier: tier.tier, note:"A compiler's case more than a slam dunk — a long, steady résumé without a signature peak or a stacked trophy case. The kind of induction that's still getting argued about after the bust goes up." };
        }
        return tier;
      }
    }
    return TIERS[TIERS.length-1];
  }

  /* ----- the Hall of Fame retrospective: how history remembers this player ----- */
  function buildHofNarrative(verdict){
    const t = career.totals;
    const seasons = career.seasonLog.length;
    const first = career.seasonLog[0];
    const peak = career.peakSeason || first;
    const last = career.seasonLog[seasons-1];
    const paras = [];

    const originLine = career.slot.round===0
      ? `Nobody called ${career.name}'s name on draft weekend in ${career.draftYear}. Out of ${career.college}, he signed with the ${teamNameAt(career.draftTeamId, career.draftYear)} as an undrafted free agent and had to fight for a locker.`
      : career.slot.round===1
        ? `The ${teamNameAt(career.draftTeamId, career.draftYear)} spent a first-round pick on ${career.name} in the ${career.draftYear} draft, betting a franchise on the arm scouts had raved about since ${career.college}.`
        : `A ${career.slot.label.toLowerCase()} selection in ${career.draftYear} out of ${career.college}, ${career.name} arrived in the league with modest expectations and a chip on his shoulder.`;
    paras.push(originLine);

    const peakLine = `The tape people still cite is <b>${peak.year}</b>: ${peak.td} touchdowns, a ${peak.rating} passer rating, and a ${peak.wins}-${peak.losses} record with the ${peak.teamName}${peak.awards.length?` that earned him ${peak.awards.join(" and ")}`:""}. It's the year that told the league who he really was.`;
    paras.push(peakLine);

    if(t.rings>0){
      const sbSeason = career.seasonLog.find(s=> s.playoffs && s.playoffs.wonRing);
      paras.push(`The ring — the one that ends every "yeah, but" argument — came in <b>${sbSeason?sbSeason.year:peak.year}</b>. Highlight reels still open with that fourth quarter.`);
    } else if(t.mvps>0){
      paras.push(`An MVP season without a Lombardi Trophy to match it — the kind of résumé line that fuels sports-radio arguments every offseason.`);
    } else if(career.transactions.length>3){
      paras.push(`It wasn't a straight line: ${career.transactions.length-1} transactions moved him from locker room to locker room, a journeyman's path more than a franchise cornerstone's.`);
    }

    // A legendary/major life event the player SURVIVED (as opposed to one that outright ended the
    // career, which the exit-reason block below already covers on its own) gets its own line --
    // "here's a Hall of Famer with an MVP season" reads very differently from "here's a Hall of
    // Famer with an MVP season AND a federal animal-fighting investigation on his permanent
    // record," and the retrospective should say so instead of quietly omitting it. Legendary rare
    // events are preferred over ordinary infractions when both exist, since they're the ones
    // actually worth a whole extra sentence of history.
    if(career.lifeEventLog && career.lifeEventLog.length){
      const survivedEvents = career.lifeEventLog.filter(e=>
        (e.severity==="career-multi" || e.severity==="major" || e.legendary) &&
        !(career.exitReason==="banned" && career._bannedEventTitle===e.title));
      if(survivedEvents.length){
        const notable = survivedEvents.find(e=>e.legendary) || survivedEvents[survivedEvents.length-1];
        paras.push(`No retrospective is complete without <b>${notable.year}</b>: ${notable.title.toLowerCase()}. It follows him everywhere his stats do — the first line of every "wait, didn't he also..." conversation about this career.`);
      }
    }

    // Every branch here has to be an ACTUAL reason the career stopped -- career.exitReason is set
    // at several very different trigger points (waived, aged out, banned by the league, a
    // career-ending injury, or a genuine voluntary retirement), and narrating a forced exit as if
    // it were a choice ("walked away on his own terms") is exactly backwards. This used to only
    // special-case "waived" and "age" and silently folded banned/injury exits into the same
    // voluntary-retirement line as an actual retirement -- fixed by giving each its own line, and
    // naming the actual event/injury where the game already tracked one (see _bannedEventTitle /
    // _careerEndingInjuryName, stashed at the moment each one happens).
    let exitLine;
    if(career.exitReason==="waived") exitLine = `The ending wasn't a farewell tour. The ${last.teamName} released him after the ${last.year} season, and no other team called. ${seasons} seasons, no fanfare.`;
    else if(career.exitReason==="age") exitLine = `He played until the league physically wouldn't let him play anymore — a ${seasons}-season marathon that outlasted three generations of teammates.`;
    else if(career.exitReason==="banned"){
      const title = career._bannedEventTitle;
      exitLine = title
        ? `There was no farewell tour to cut short — ${title.toLowerCase()} ended it. The league banned him outright in ${career.year}, and whatever he had left in the tank never got to show up on a stat sheet.`
        : `There was no farewell tour to cut short. The league banned him outright in ${career.year}, and whatever he had left in the tank never got to show up on a stat sheet.`;
    }
    else if(career.exitReason==="injury"){
      const injName = career._careerEndingInjuryName;
      exitLine = injName
        ? `The body made the call a front office never had to: a ${injName.toLowerCase()} that doctors agreed he wasn't coming back from. ${seasons} seasons, ended by a diagnosis instead of a decision.`
        : `The body made the call instead of a front office or a calendar — an injury he never came back from, ${seasons} seasons in.`;
    }
    else {
      // A genuine voluntary retirement still reads two different ways depending on how the last
      // season actually went -- walking away while still playing well above league average is a
      // much rarer, more deliberate exit than walking away after a visible decline, so it gets its
      // own line instead of one flat sentence covering both.
      const lastEdge = last.rating - leagueAvgRatingForDecade(last.decade);
      exitLine = lastEdge >= 6
        ? `He walked away at the top of his game after the ${last.year} season — ${career.age} years old and still grading out well above league average. No decline to point to, no team pushing him out. He just decided he was done.`
        : `He walked away on his own terms after the ${last.year} season, ${career.age} years old, leaving the game before the game could leave him.`;
    }
    paras.push(exitLine);

    paras.push(`<span>Around the league now, the verdict is settled: <b>${verdict.tier}</b>. ${verdict.note}</span>`);
    paras[paras.length-1] = paras[paras.length-1]; // legacy paragraph gets special styling via class below

    return paras;
  }

  /* ----- trophy case: a visual read on the totals-grid numbers, one item per ring/MVP season
     (rare enough to name the year) and one grouped badge each for All-Pro/Pro Bowl counts (too
     numerous in a long career to list individually). ----- */
  const TROPHY_ICONS = {
    ring: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 3h12l-1.2 6.2a4.8 4.8 0 0 1-4.8 3.9v0a4.8 4.8 0 0 1-4.8-3.9L6 3Z" fill="var(--field)" stroke="var(--field-strong)" stroke-width="1"/><path d="M10.5 13v3M13.5 13v3" stroke="var(--field-strong)" stroke-width="1.4"/><rect x="8.5" y="16" width="7" height="2" rx="0.6" fill="var(--field)"/><rect x="7" y="18" width="10" height="2.5" rx="0.8" fill="var(--field-strong)"/></svg>`,
    mvp: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.5l2.7 5.6 6.1.8-4.4 4.3 1 6.1L12 16.3l-5.4 3 1-6.1-4.4-4.3 6.1-.8L12 2.5Z" fill="var(--field)" stroke="var(--field-strong)" stroke-width="1"/></svg>`,
    allpro: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="9" r="6" fill="var(--field)" stroke="var(--field-strong)" stroke-width="1"/><path d="M9 14.5L7 21l5-2.5L17 21l-2-6.5" fill="var(--field-strong)"/></svg>`,
    probowl: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3l2.1 4.4 4.9.6-3.6 3.4.9 4.8-4.3-2.3-4.3 2.3.9-4.8-3.6-3.4 4.9-.6L12 3Z" fill="var(--good)" stroke="var(--good)" stroke-width="0.6"/></svg>`,
  };
  function buildTrophyCaseHTML(){
    const t = career.totals;
    if(t.rings===0 && t.mvps===0 && t.allPros===0 && t.proBowls===0){
      return `<p class="trophy-empty">No hardware — that's alright, not every career needs a trophy case.</p>`;
    }
    const items = [];
    career.seasonLog.forEach(s=>{
      if(s.playoffs && s.playoffs.wonRing){
        const label = (s.playoffs.ringLabel || "Super Bowl Champion").replace(/\s(?=\S+$)/, "<br>");
        items.push(`<div class="trophy-item"><div>${TROPHY_ICONS.ring}</div><div class="trophy-year">${s.year}</div><div class="trophy-label">${label}</div></div>`);
      }
      if(s.awards.includes("MVP")){
        items.push(`<div class="trophy-item"><div>${TROPHY_ICONS.mvp}</div><div class="trophy-year">${s.year}</div><div class="trophy-label">MVP</div></div>`);
      }
    });
    if(t.allPros>0) items.push(`<div class="trophy-item badge-count"><div>${TROPHY_ICONS.allpro}</div><div class="trophy-year">${t.allPros}×</div><div class="trophy-label">All-Pro</div></div>`);
    if(t.proBowls>0) items.push(`<div class="trophy-item badge-count"><div>${TROPHY_ICONS.probowl}</div><div class="trophy-year">${t.proBowls}×</div><div class="trophy-label">Pro Bowl</div></div>`);
    return `<div class="trophy-case">${items.join("")}</div>`;
  }

  function finishCareer(){
    clearActiveCareer();
    checkAchievements(); // catches career-ending-only conditions (e.g. Loyal to the Death) now that exitReason is set
    const verdict = hofVerdict();
    SFX.retirement(verdict.tier);
    const best = loadBest();
    if(!best.careerScoreValue || verdict.tier !== best.careerVerdict){
      // keep the most prestigious verdict seen (rough ordinal by tier order)
      const order = ["Out of the League","Camp Arm","Journeyman","Longtime Starter","Hall of Very Good","Hall of Famer","First-Ballot Hall of Famer"];
      const prevIdx = order.indexOf(best.careerVerdict);
      const curIdx = order.indexOf(verdict.tier);
      if(curIdx>prevIdx){ best.careerVerdict = verdict.tier; saveBest(best); }
    }

    const hero = document.getElementById("hofHero");
    // Same fix as buildHofNarrative's exitLine below: banned/injury are forced exits, not a
    // retirement, and used to silently collapse into "retired on his own terms" here too.
    const EXIT_TAGS = { waived:"released, not retired", age:"played it out to the end",
      banned:"banned from the league", injury:"career-ending injury", retired:"retired on his own terms" };
    const exitTag = EXIT_TAGS[career.exitReason] || "retired on his own terms";
    hero.innerHTML = `
      <div class="hh-eyebrow">${career.name} · out of ${career.college} · ${career.hometown.city}, ${career.hometown.state}</div>
      <div class="hh-verdict">${verdict.tier}</div>
      <div class="hh-sub">${career.seasonLog.length}-season career · ${career.draftYear}–${career.year} · ${exitTag}<br>${verdict.note}</div>`;

    const narrative = career.seasonLog.length ? buildHofNarrative(verdict) : [];
    document.getElementById("hofNarrative").innerHTML = narrative.map((p,i)=> `<p${i===narrative.length-1?' class="legacy"':''}>${p}</p>`).join("");

    const t = career.totals;
    const cardTeams = [];
    career.seasonLog.forEach(s=>{ if(cardTeams[cardTeams.length-1]!==s.teamName) cardTeams.push(s.teamName); });
    const trophyEntry = {
      id: `${Date.now()}_${Math.round(Math.random()*1e6)}`,
      name: career.name, college: career.college,
      hometownCity: career.hometown.city, hometownState: career.hometown.state,
      decade: career.decade, draftYear: career.draftYear, finalYear: career.year,
      verdict: verdict.tier, seasons: career.seasonLog.length, exitReason: career.exitReason,
      games: t.games, yards: t.yards, td: t.td, int: t.int, sacks: t.sacks,
      rushYards: t.rushYards, rushTd: t.rushTd, proBowls: t.proBowls, allPros: t.allPros,
      mvps: t.mvps, rings: t.rings, earnings: t.earnings,
      rating: passerRating(t.comp, t.att, t.yards, t.td, t.int),
      peakOverall: Math.max(0, ...career.seasonLog.map(s=>s.overall||0)),
      teams: cardTeams,
      achievements: (career.achievements ? Object.keys(career.achievements.unlocked).filter(k=>career.achievements.unlocked[k]) : []),
      draftLine: career.transactions[0] || null,
      relationshipLine: career.relationship
        ? `${career.relationship.status==="married"?"Married to":"Dating"} ${career.relationship.partnerName}, the ${career.relationship.partnerType}.`
        : null,
      completedAt: Date.now(),
    };
    saveTrophyRoomEntry(trophyEntry);
    lastFinishedCareerEntry = trophyEntry;
    const careerRecBy = {}; checkCareerRecords(t).forEach(r=> careerRecBy[r.key]=r);
    document.getElementById("totalsGrid").innerHTML = [
      ["Seasons", career.seasonLog.length],
      ["Career Earnings", fmtMoney(t.earnings)],
      ["Pass Yards", t.yards.toLocaleString(), careerRecBy.yards],
      ["Touchdowns", t.td, careerRecBy.td],
      ["Interceptions", t.int],
      ["Sacks Taken", t.sacks],
      ["Rush Yards", t.rushYards.toLocaleString()],
      ["Rush TDs", t.rushTd],
      ["Pro Bowls", t.proBowls],
      ["All-Pros", t.allPros],
      ["MVPs", t.mvps],
      ["Rings", t.rings],
    ].map(([label,val,rec])=>`<div class="totals-tile"><div class="tt-label">${label}</div><div class="tt-value tabular">${val}</div>${rec?recordBadgeHtml(rec):""}</div>`).join("");

    document.getElementById("trophyCase").innerHTML = buildTrophyCaseHTML();

    const table = document.getElementById("careerTable");
    table.innerHTML = `<thead><tr><th>Year</th><th>Age</th><th>Team</th><th>G</th><th>Comp/Att</th><th>Pct</th><th>Yds</th><th>TD</th><th>INT</th><th>Rating</th><th>Rush</th><th>Record</th><th>Team Rec</th><th>Playoffs</th><th>Pay</th><th>Awards</th></tr></thead>
      <tbody>${career.seasonLog.map(s=>`<tr>
        <td>${s.year}</td><td>${s.age}</td><td class="team-cell">${s.teamName}</td><td>${s.games}</td>
        <td>${s.comp}/${s.att}</td><td>${(s.pct*100).toFixed(1)}%</td><td>${s.yards.toLocaleString()}</td>
        <td>${s.td}</td><td>${s.int}</td><td>${s.rating}</td>
        <td>${s.rushAtt>0 ? s.rushYards.toLocaleString()+" / "+s.rushTd+"TD" : "—"}</td>
        <td>${s.wins}-${s.losses}</td><td>${s.teamWins}-${s.teamLosses}</td>
        <td>${s.playoffs.made ? "Seed #"+s.playoffs.seed+(s.playoffs.wonRing?" — Champs":"") : "Missed"}</td>
        <td>${fmtMoney(s.contractApy)}</td><td>${s.awards.join(", ")||"—"}</td>
      </tr>`).join("")}</tbody>`;

    showScreen("careerSummary");
  }

  document.getElementById("viewCardBtn").addEventListener("click", ()=>{
    if(lastFinishedCareerEntry) openBaseballCard(lastFinishedCareerEntry);
  });

  document.getElementById("shareCareerBtn").addEventListener("click", ()=>{
    const verdict = hofVerdict();
    const t = career.totals;
    const lines = [
      `GRIDIRON LAB — Career Recap`,
      `${career.seasonLog.length} seasons (${career.draftYear}–${career.year}), starting decade ${career.decade}`,
      `Verdict: ${verdict.tier}`,
      `${t.yards.toLocaleString()} yds, ${t.td} TD, ${t.int} INT, ${t.proBowls} Pro Bowls, ${t.allPros} All-Pros, ${t.mvps} MVP, ${t.rings} ring(s)`,
      `Career earnings: ${fmtMoney(t.earnings)}`,
      window.location.href,
    ];
    copyText(lines.join("\n"), document.getElementById("shareCareerBtn"));
  });
  document.getElementById("newCareerBtn").addEventListener("click", ()=>{ chosenDecade=null; chosenDecadeWasRandom=false; renderDecadeGrid(); renderIdentityPanel(); showScreen("careerSetup"); });
  document.getElementById("careerMenuBtn").addEventListener("click", ()=>{ renderBestStrip(); renderLastBuildStrip(); renderActiveCareerStrip(); updateHeaderCareerTicker(); showScreen("menu"); });

  /* ================= Admin / testing panel (V10.1) =================
     A visible, always-on debug panel for browsing the full player and event data and for firing
     any event on demand against the live career, instead of waiting on random rolls to see it.
     Deliberately reuses the exact production render/resolve functions (renderInfractionEvent,
     renderPositiveEvent, renderOrgEvent, resolveInfraction via its own buttons, triggerKeyMoment)
     rather than a separate mock path, so what you see here is exactly what a real playthrough
     would produce -- this is a window into the live game state, not a simulation of it. */
  const ADMIN_EVENT_POOLS = {
    infraction: { label:"Infractions", list: INFRACTION_EVENTS, kind:"infraction" },
    rare: { label:"Rare Easter Eggs", list: RARE_EVENTS, kind:"infraction" },
    positive: { label:"Positive", list: POSITIVE_EVENTS, kind:"positive" },
    org: { label:"Organization", list: ORG_EVENTS, kind:"org" },
    locker: { label:"Locker Room", list: LOCKER_ROOM_EVENTS, kind:"locker" },
  };
  const ADMIN_PLAYER_COLUMNS = [
    { key:"name", label:"Name" }, { key:"team", label:"Team" }, { key:"years", label:"Years" }, { key:"decade", label:"Decade" },
    ...ATTR_KEYS.map(k=>({ key:k, label:k })),
  ];
  const adminState = { tab:"players", search:"", decadeFilter:"all", sortKey:"name", sortDir:"asc", buildSnapshot:null };

  function adminEventRangeText(ev, kind){
    if(kind==="infraction"){
      const parts = [];
      parts.push(`sev: ${ev.severity}`);
      if(Array.isArray(ev.repHit)) parts.push(`rep ${fmtDelta(ev.repHit[0])}..${fmtDelta(ev.repHit[1])}`);
      else if(typeof ev.repHit==="number") parts.push(`rep ${fmtDelta(ev.repHit)}`);
      if(ev.suspensionGames) parts.push(`${ev.suspensionGames[0]}-${ev.suspensionGames[1]} games`);
      if(ev.suspensionSeasons) parts.push(`${ev.suspensionSeasons[0]}-${ev.suspensionSeasons[1]} seasons`);
      if(ev.mitigable) parts.push("mitigable");
      if(ev.minYear) parts.push(`since ${ev.minYear}`);
      if(ev.legendary) parts.push("★ rare");
      return parts.join(" · ");
    }
    if(kind==="positive"){
      const parts = [`rep +${ev.repDelta[0]}..+${ev.repDelta[1]}`];
      if(ev.boosts && ev.boosts.length) parts.push(ev.boosts.map(b=>`${b.key} +${b.delta} (${ev.seasons}s)`).join(", "));
      return parts.join(" · ");
    }
    if(kind==="locker"){
      const parts = [`${ev.choices.length} choices`];
      if(ev.minAge) parts.push(`age ${ev.minAge}+`);
      ev.choices.forEach(c=> parts.push(`"${c.label}": good ${fmtDelta(c.goodDelta[0])}..${fmtDelta(c.goodDelta[1])} (${Math.round(c.goodChance*100)}%) / bad ${fmtDelta(c.badDelta[0])}..${fmtDelta(c.badDelta[1])}`));
      return parts.join(" · ");
    }
    // org
    const parts = [];
    if(Array.isArray(ev.repDelta)) parts.push(`rep ${fmtDelta(ev.repDelta[0])}..${fmtDelta(ev.repDelta[1])}`);
    else if(ev.repDelta) parts.push(`rep ${fmtDelta(ev.repDelta)}`);
    if(ev.strengthDelta && (ev.strengthDelta[0]!==0 || ev.strengthDelta[1]!==0)) parts.push(`grade ${fmtDelta(ev.strengthDelta[0])}..${fmtDelta(ev.strengthDelta[1])}`);
    if(ev.gmDelta) parts.push(`gm ${fmtDelta(ev.gmDelta[0])}..${fmtDelta(ev.gmDelta[1])}`);
    if(ev.resetGM) parts.push("gm: reset");
    if(ev.schemeChangeChance) parts.push(`${Math.round(ev.schemeChangeChance*100)}% new scheme`);
    if(ev.setFlag) parts.push(`flag: ${ev.setFlag}`);
    return parts.join(" · ") || "narrative only";
  }
  function adminFireEvent(poolKey, id){
    const pool = ADMIN_EVENT_POOLS[poolKey];
    const ev = pool.list.find(e=>e.id===id);
    if(!ev || !career) return;
    closeAdminOverlay();
    showScreen("career");
    if(pool.kind==="infraction") renderInfractionEvent(ev);
    else if(pool.kind==="positive") renderPositiveEvent(ev);
    else if(pool.kind==="locker") renderLockerRoomEvent(ev);
    else renderOrgEvent(ev);
  }
  function renderAdminPlayersTab(){
    const search = adminState.search.trim().toLowerCase();
    let rows = QBS.filter(p=>{
      if(adminState.decadeFilter!=="all" && p.decade!==adminState.decadeFilter) return false;
      if(search && !p.name.toLowerCase().includes(search) && !p.team.toLowerCase().includes(search)) return false;
      return true;
    });
    rows = rows.slice().sort((a,b)=>{
      const k = adminState.sortKey;
      let av, bv;
      if(ATTR_KEYS.includes(k)){ av=a.r[k]; bv=b.r[k]; }
      else { av=a[k]; bv=b[k]; }
      if(typeof av==="string") return adminState.sortDir==="asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return adminState.sortDir==="asc" ? av-bv : bv-av;
    });
    const headerHtml = ADMIN_PLAYER_COLUMNS.map(c=>
      `<th data-sort="${c.key}" class="${adminState.sortKey===c.key?"sorted":""}">${svgEscape(c.label)}${adminState.sortKey===c.key?(adminState.sortDir==="asc"?" ▲":" ▼"):""}</th>`
    ).join("");
    const bodyHtml = rows.map(p=>`<tr>
      <td>${svgEscape(p.name)}</td><td>${svgEscape(p.team)}</td><td>${svgEscape(p.years)}</td><td>${svgEscape(p.decade)}</td>
      ${ATTR_KEYS.map(k=>`<td>${p.r[k]}</td>`).join("")}
    </tr>`).join("");
    return `
      <div class="admin-controls">
        <input type="text" id="adminPlayerSearch" placeholder="Search name or team…" value="${svgEscape(adminState.search)}">
        <select id="adminDecadeFilter">
          <option value="all">All decades</option>
          ${DECADES.map(d=>`<option value="${d}" ${adminState.decadeFilter===d?"selected":""}>${d}</option>`).join("")}
        </select>
        <span class="admin-count">${rows.length} of ${QBS.length} players · click a column to sort</span>
      </div>
      <div class="admin-table-wrap"><table class="admin-table"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml || `<tr><td colspan="${ADMIN_PLAYER_COLUMNS.length}" class="admin-empty">No players match.</td></tr>`}</tbody></table></div>`;
  }
  function renderAdminEventsTab(){
    const disabledAttr = career ? "" : "disabled";
    const sections = Object.entries(ADMIN_EVENT_POOLS).map(([poolKey, pool])=>`
      <div class="admin-event-section">
        <h3>${svgEscape(pool.label)} <span class="admin-count">(${pool.list.length})</span></h3>
        ${pool.list.map(ev=>{
          let flavor = "";
          try{ flavor = typeof ev.flavor==="function" ? ev.flavor("2020s") : ""; }catch(e){ flavor = "(flavor text needs live career context)"; }
          return `
          <div class="admin-event-row">
            <div class="ae-main">
              <div class="ae-title">${svgEscape(ev.title)} <span class="admin-count">#${svgEscape(ev.id)}</span></div>
              <div class="ae-meta">${adminEventRangeText(ev, pool.kind)}</div>
              <div class="ae-flavor">${svgEscape(flavor)}</div>
            </div>
            <button type="button" class="admin-fire-btn" data-pool="${poolKey}" data-id="${ev.id}" ${disabledAttr}>Force fire</button>
          </div>`;
        }).join("")}
      </div>`).join("");
    return `${career ? "" : `<div class="admin-note">Start a career to force-fire events — they render exactly like a real roll, right on the live career screen.</div>`}${sections}`;
  }
  function renderAdminLiveTab(){
    if(!career) return `<div class="admin-empty">No active career. Start one from the menu, then reopen this tab.</div>`;
    const c = career;
    const schemeId = c.teamScheme ? c.teamScheme[c.teamId] : null;
    const scheme = SCHEMES.find(s=>s.id===schemeId);
    const stats = [
      ["Name", c.name], ["Age", c.age], ["Year", c.year], ["Decade", decadeForYear(c.year)],
      ["Team", teamNameAt(c.teamId, c.year)], ["Reputation", c.reputation], ["Team Grade", c.teamStrength],
      ["GM Relations", c.gmRelationship], ["Fan Support", c.fanSupport], ["League Popularity", c.leaguePopularity],
      ["Scheme", scheme ? scheme.name : "—"],
      ["Contract", `${fmtMoney(c.contract.apy)}/yr (${c.contract.tier}, ${c.contract.years}y)`],
      ["Seasons w/ team", c.seasonsWithTeam], ["Trade requests used", c._tradeRequestsUsed||0],
      ["Banned", c.banned ? "yes" : "no"], ["Suspension seasons left", c.suspensionSeasonsRemaining||0],
    ];
    const statsHtml = stats.map(([label,val])=>`<div class="admin-live-stat"><div class="als-label">${svgEscape(label)}</div><div class="als-value">${svgEscape(String(val))}</div></div>`).join("");
    let jsonText = "";
    try{ jsonText = JSON.stringify(career, null, 2); }catch(e){ jsonText = "(could not serialize career state)"; }
    return `
      <div class="admin-live-grid">${statsHtml}</div>
      <div class="admin-nudge-row">
        <button type="button" class="admin-nudge-btn" id="adminRepUp">Reputation +10</button>
        <button type="button" class="admin-nudge-btn" id="adminRepDown">Reputation −10</button>
        <button type="button" class="admin-nudge-btn" id="adminGradeUp">Team Grade +10</button>
        <button type="button" class="admin-nudge-btn" id="adminGradeDown">Team Grade −10</button>
        <button type="button" class="admin-nudge-btn" id="adminGmUp">GM Relations +10</button>
        <button type="button" class="admin-nudge-btn" id="adminGmDown">GM Relations −10</button>
        <button type="button" class="admin-nudge-btn" id="adminFanUp">Fan Support +10</button>
        <button type="button" class="admin-nudge-btn" id="adminFanDown">Fan Support −10</button>
        <button type="button" class="admin-nudge-btn" id="adminPopUp">Popularity +10</button>
        <button type="button" class="admin-nudge-btn" id="adminPopDown">Popularity −10</button>
        <button type="button" class="admin-nudge-btn" id="adminSchemeReroll">Reroll Team Scheme</button>
        <button type="button" class="admin-nudge-btn" id="adminPreviewKeyMoment">Preview a Key Moment</button>
      </div>
      <div class="admin-note">Reputation/grade nudges and the career snapshot below update live; reopen this tab (or click a tab again) to refresh after using a nudge.</div>
      <div class="section-label">Career state (live)</div>
      <div class="admin-json">${svgEscape(jsonText)}</div>`;
  }
  /* ----- Stat Calculator tab: renders the ACTUAL formulas generateSeason() runs, with the
     current build/career's real numbers substituted in, so every metric on the season card can
     be traced back to exactly how it was produced. This is a READ-ONLY preview -- it never calls
     generateSeason() and never touches career/build -- so opening it mid-career can't affect the
     season in progress. It shows the EXPECTED-VALUE shape of the formula: a full healthy season
     (no missed games) and the midpoint of any contract-tier role-share range, since the real sim
     also rolls per-season randomness (role-share jitter, a ±2 attempts/game noise term, and the
     game-by-game win/loss coin flips) on top of this that a static preview can't show. Awards use
     the exact odds formulas generateSeason() uses, gated the same way (see the Pro Bowl/All-Pro/
     MVP section) -- these are genuinely live odds, not flavor text.
     NOTE for future edits: this intentionally mirrors generateSeason()'s math rather than calling
     into it (that function is full of side effects -- it advances career state, rolls RNG, pushes
     to season logs). If generateSeason()'s formulas change, these need to change to match. */
  function computeMetricBreakdown(){
    if(!career || !build) return null;
    const decade = decadeForYear(career.year);
    const league = LEAGUE[decade];
    const schemeId = career.teamScheme ? career.teamScheme[career.teamId] : null;
    const scheme = SCHEMES.find(s=>s.id===schemeId);
    const eff = schemeEffective(career.age, decade, schemeId);
    const neutral = neutralEffective(career.age, decade, schemeId);
    const primeMult = primeMultiplier(career.age);

    const W = {
      acc: {SHA:0.40, TCH:0.25, DAC:0.20, ANT:0.15},
      ypa: {ARM:0.35, DAC:0.35, TCH:0.15, IMP:0.15},
      td:  {ANT:0.40, DEC:0.30, TCH:0.30},
      int: {DEC:0.50, ANT:0.30, PKT:0.20},
      rush:{MOB:0.60, IMP:0.30, ARM:0.10},
    };
    const effAcc = weighted(eff, W.acc), neutralAcc = weighted(neutral, W.acc);
    const effYpa = weighted(eff, W.ypa), neutralYpa = weighted(neutral, W.ypa);
    const effTd  = weighted(eff, W.td),  neutralTd  = weighted(neutral, W.td);
    const effInt = weighted(eff, W.int), neutralInt = weighted(neutral, W.int);
    const effOverall = weighted(eff, OVERALL_WEIGHTS), neutralOverall = weighted(neutral, OVERALL_WEIGHTS);
    const effRush = weighted(eff, W.rush);

    // Per-decade, real-record-grounded ceilings/floors -- see the STAT_CAL constant near LEAGUE
    // for the sourced seasons and full methodology (this replaced a flat, non-decade-aware set of
    // coefficients that saturated well short of realistic decade-relative production).
    const cal = STAT_CAL[decade] || STAT_CAL["2000s"];
    // Mirrors the STAT_BLEND fix in generateSeason -- see that function for the full rationale.
    // Kept in sync here so this preview never drifts from what a real season actually rolls.
    const dOverall = (effOverall-neutralOverall)*primeMult;
    const STAT_BLEND = 0.18;
    const STAT_SENSITIVITY = 0.32;
    const dComp = (((effAcc-neutralAcc)*primeMult)*STAT_BLEND + dOverall*(1-STAT_BLEND))*STAT_SENSITIVITY;
    const dYpa = (((effYpa-neutralYpa)*primeMult)*STAT_BLEND + dOverall*(1-STAT_BLEND))*STAT_SENSITIVITY;
    const dTd = (((effTd-neutralTd)*primeMult)*STAT_BLEND + dOverall*(1-STAT_BLEND))*STAT_SENSITIVITY;
    const dInt = (((effInt-neutralInt)*primeMult)*STAT_BLEND + dOverall*(1-STAT_BLEND))*STAT_SENSITIVITY;
    const weaponsNudge = (career.weapons-65);
    const comp = clamp(league.comp + dComp*(dComp>=0?cal.comp.up:cal.comp.down) + weaponsNudge*0.0006, cal.comp.lo, cal.comp.hi);
    const ypa = clamp(league.ypa + dYpa*(dYpa>=0?cal.ypa.up:cal.ypa.down) + weaponsNudge*0.008, cal.ypa.lo, cal.ypa.hi);
    const tdRate = clamp(league.tdRate + dTd*(dTd>=0?cal.td.up:cal.td.down), cal.td.lo, cal.td.hi);
    const intRate = clamp(league.intRate - dInt*(dInt>=0?cal.int.up:cal.int.down), cal.int.lo, cal.int.hi);
    const sackRate = clamp(0.075 - (eff.PKT-neutral.PKT)*0.0012 - (career.oline-65)*0.0006, 0.015, 0.16);

    const roleShareRange = career.contract.tier==="minimum" ? [0.1,0.6] : career.contract.tier==="backup" ? [0.3,0.85] : [1,1];
    const roleShare = (roleShareRange[0]+roleShareRange[1])/2;
    const attPerGameBase = league.attPerGame - (eff.MOB-neutral.MOB)*0.05 + dOverall*0.06;
    const attPerGame = clamp(attPerGameBase*roleShare, 4, 48);

    const expGames = league.games;
    const expAttempts = Math.round(attPerGame*expGames);
    const expComp = Math.round(expAttempts*comp);
    const expYards = Math.round(expAttempts*ypa);
    const expTd = Math.max(0, Math.round(expAttempts*tdRate));
    const expInt = Math.max(0, Math.round(expAttempts*intRate));
    const expRating = passerRating(expComp, expAttempts, expYards, expTd, expInt);

    const rushAttPerGame = clamp((effRush-45)*0.14, 0.2, 9.5);
    const rushYpc = clamp(3.4 + (effRush-55)*0.045, 1.8, 7.8);
    const rushTdRate = clamp(0.018 + (effRush-55)*0.0006, 0.004, 0.09);
    const expRushAtt = Math.round(rushAttPerGame*expGames);
    const expRushYards = Math.max(0, Math.round(expRushAtt*rushYpc));
    const expRushTd = Math.max(0, Math.round(expRushAtt*rushTdRate));
    const expSacks = Math.max(0, Math.round(expAttempts*sackRate));

    // Same engine every real game now uses (simulateGameScore vs. an opponent's team grade, see
    // regularSeasonOffenseGrade) -- this preview shows the per-game win odds against a
    // LEAGUE-AVERAGE (grade 65) opponent specifically, since a real season's actual opponents
    // vary week to week. Note the offensive grade below is BLENDED with team quality (Round 4),
    // not just effOverall plus a small edge -- a bad team meaningfully caps this number even for
    // an elite individual build.
    const myOff = regularSeasonOffenseGrade(effOverall, career.age, decade);
    const winProb = simpleWinProb(myOff, 65);

    const leagueAvgRating = leagueAvgRatingForDecade(decade);
    const ratingEdge = expRating - leagueAvgRating;
    const gamesPlayedShare = 1; // this preview assumes a full healthy season
    const proBowlScore = ratingEdge*0.6 + Math.max(0, expTd-16)*0.45 + (winProb-0.5)*10;
    const proBowlGateOk = expAttempts>200 && gamesPlayedShare>=0.65 && ratingEdge>=1;
    const proBowlOdds = proBowlGateOk ? clamp(proBowlScore*0.017, 0, 0.85) : 0;
    const allProScore = ratingEdge*0.75 + Math.max(0, expTd-22)*0.55 + (winProb-0.5)*18;
    const allProGateOk = proBowlGateOk && gamesPlayedShare>=0.8 && ratingEdge>=9;
    const allProOdds = allProGateOk ? clamp(allProScore*0.013, 0, 0.55) : 0;
    const mvpScore = ratingEdge*0.55 + (winProb-0.5)*40 + Math.max(0, expTd-25)*0.6;
    const mvpEligible = expAttempts>150 && gamesPlayedShare>=0.5;

    return {
      decade, league, schemeId, scheme, eff, neutral, primeMult, W, cal,
      effAcc, neutralAcc, effYpa, neutralYpa, effTd, neutralTd, effInt, neutralInt,
      effOverall, neutralOverall, effRush,
      comp, ypa, tdRate, intRate, sackRate, expSacks, roleShare, roleShareRange, attPerGame,
      expGames, expAttempts, expComp, expYards, expTd, expInt, expRating,
      rushAttPerGame, rushYpc, rushTdRate, expRushAtt, expRushYards, expRushTd,
      winProb, myOff, leagueAvgRating, ratingEdge,
      proBowlScore, proBowlGateOk, proBowlOdds,
      allProScore, allProGateOk, allProOdds,
      mvpScore, mvpEligible,
    };
  }

  function renderAdminCalcTab(){
    const d = computeMetricBreakdown();
    function weightedLine(effObj, weights, label){
      const parts = Object.entries(weights).map(([k,w])=> `${ATTR_BY_KEY[k].label}(${effObj[k].toFixed(0)})×${w.toFixed(2)}`);
      return `${label} = ${parts.join(" + ")} = ${weighted(effObj, weights).toFixed(1)}`;
    }
    function card(name, resultText, lines, gate){
      return `<div class="calc-metric">
          <div class="calc-metric-head"><span class="calc-metric-name">${svgEscape(name)}</span><span class="calc-metric-result">${resultText}</span></div>
          <div class="calc-formula">${svgEscape(lines.join("\n"))}</div>
          ${gate||""}
        </div>`;
    }
    const leagueRefRows = DECADES.map(dk=>{
      const l = LEAGUE[dk];
      const cur = d && d.decade===dk;
      return `<tr class="${cur?"calc-ref-current":""}"><td>${dk}${cur?" ← current":""}</td><td>${l.games}</td><td>${fmtPct(l.comp)}</td><td>${l.ypa.toFixed(1)}</td><td>${(l.tdRate*100).toFixed(2)}%</td><td>${(l.intRate*100).toFixed(2)}%</td><td>${l.attPerGame}</td></tr>`;
    }).join("");
    const refTable = `
      <div class="calc-refnote">Every season starts from this decade's league-wide baseline rate, then shifts up or down based on how far the build's effective attributes sit above or below a flat, hypothetical "65-everywhere" neutral build run through that same age/era/scheme adjustment. That's why a rookie-year age penalty or a run-first 1970s era doesn't read as "bad build" on its own -- only a genuinely below-average build does.</div>
      <div class="admin-table-wrap"><table class="calc-ref-table"><thead><tr><th>Decade</th><th>Games</th><th>Comp%</th><th>Y/A</th><th>TD%</th><th>INT%</th><th>Att/G</th></tr></thead><tbody>${leagueRefRows}</tbody></table></div>`;

    if(!d){
      return `<div class="admin-note">Start a career to see every formula below worked out with real, substituted numbers. The league reference table is always available.</div>
        <div class="calc-group"><div class="calc-group-head">League Baseline by Decade</div>${refTable}</div>`;
    }

    // "Restore Original Build" needs the TRUE draft-day numbers -- career.originalBuild, snapshotted
    // once at the Combine, before either natural development (see developAttributes) or anything
    // typed into this editor has had a chance to move it. The lazy same-session snapshot is only a
    // fallback for states without one (e.g. mid-development saves from before this existed).
    if(!adminState.buildSnapshot) adminState.buildSnapshot = career.originalBuild ? {...career.originalBuild} : {...build};
    const groupOrder = [["accuracy","Accuracy"], ["physical","Physical"], ["mental","Mental"]];
    const buildEditorHtml = `
      <div class="cbe-wrap">
        <div class="cbe-head">
          <span class="cbe-title">Build Editor — override every attribute</span>
          <span class="cbe-overall">effOverall right now: <b>${d.effOverall.toFixed(1)}</b> (neutral baseline is ${d.neutralOverall.toFixed(1)})</span>
        </div>
        <div class="cbe-presets">
          <button type="button" class="admin-nudge-btn" id="cbeMax99">Max Every Attribute (99)</button>
          <button type="button" class="admin-nudge-btn" id="cbeMin10">Min Every Attribute (10)</button>
          <button type="button" class="admin-nudge-btn" id="cbeNeutral65">League-Average (65 flat)</button>
          <button type="button" class="admin-nudge-btn" id="cbeRestoreOriginal">Restore Original Build</button>
        </div>
        <div class="cbe-groups">
          ${groupOrder.map(([groupKey, groupLabel])=>`
            <div class="cbe-group">
              <div class="cbe-group-label">${svgEscape(groupLabel)}</div>
              ${ATTRIBUTES.filter(a=>a.group===groupKey).map(a=>`
                <div class="cbe-field">
                  <label for="cbeInput-${a.key}">${svgEscape(a.label)}</label>
                  <input type="range" id="cbeRange-${a.key}" data-key="${a.key}" min="10" max="99" step="1" value="${build[a.key]}">
                  <input type="number" id="cbeInput-${a.key}" data-key="${a.key}" min="10" max="99" step="1" value="${build[a.key]}">
                </div>`).join("")}
            </div>`).join("")}
        </div>
        <button type="button" class="btn btn-primary" id="cbeApply" style="font-size:0.82rem;padding:0.5rem 1rem;">Apply Build — recompute everything below</button>
        <div class="cbe-note">This overwrites <b>${svgEscape(career.name)}</b>'s actual build in place -- the next season generated (and every formula below) will use whatever you set here. Nothing here is reversible except by clicking "Restore Original Build" above, so use presets freely to test extremes, then restore before continuing the real career.</div>
      </div>`;

    // Career Development: development is invisible without this -- every season quietly nudges
    // build[] in place (see developAttributes), and this is the one place that shows the drift
    // since draft day, attribute by attribute, plus the hidden devSpeed roll that's been scaling
    // it the whole time.
    const devSpeed = career.devSpeed || 1;
    const original = career.originalBuild || build;
    const devRows = ATTRIBUTES.map(a=>{
      const delta = build[a.key]-(original[a.key] ?? build[a.key]);
      const cls = delta>0 ? "good" : delta<0 ? "bad" : "";
      return `<tr><td>${svgEscape(a.label)}</td><td class="tabular">${original[a.key] ?? build[a.key]}</td><td class="tabular">${build[a.key]}</td><td class="tabular ${cls}">${delta>0?"+":""}${delta}</td></tr>`;
    }).join("");
    const totalDelta = ATTR_KEYS.filter(k=>k!=="DUR").reduce((s,k)=> s+(build[k]-(original[k] ?? build[k])), 0);
    const devCard = `<div class="calc-group">
        <div class="calc-group-head">Career Development</div>
        <div class="calc-refnote">Development trait: <b>${svgEscape(devSpeedTag(devSpeed))}</b> (devSpeed ×${devSpeed.toFixed(2)}, rolled once at the Combine — hidden from you at the time, revealed here — but not locked in: a breakout or bust-spiral season shifts it for the rest of your career, so this number and its tag can move over time). Every attribute except Durability drifts a little each season based on age, how much this build actually played that year, and this trait — mental attributes (Anticipation, Decision Making, Clutch) grow the longest and hold up best late; physical attributes (Arm, Mobility, Improvisation) peak early and fade the soonest, same as real QB aging. Net change since draft day: <b>${totalDelta>0?"+":""}${totalDelta}</b> points across all eleven developable attributes.</div>
        <div class="admin-table-wrap"><table class="calc-ref-table"><thead><tr><th>Attribute</th><th>Draft Day</th><th>Now</th><th>Δ</th></tr></thead><tbody>${devRows}</tbody></table></div>
      </div>`;

    const primeCard = `<div class="calc-metric">
        <div class="calc-metric-head"><span class="calc-metric-name">Prime Multiplier (age ${career.age})</span><span class="calc-metric-result">×${d.primeMult.toFixed(2)}</span></div>
        <div class="calc-formula">${svgEscape(`Looked up from the age curve: [22→0.90, 24→0.95, 26→0.99, 29→1.00, 32→1.00, 34→0.90, 36→0.78, 38→0.65, 40→0.50, 42→0.38], interpolated between points.
Scales how much of the build's edge OVER neutral actually shows up this season -- 100% in the prime years (29-32), tapering both before and after. It does NOT touch the neutral baseline itself, only the delta.`)}</div>
      </div>`;

    const rateCard = (name, resultText, fmt, base, baseLabel, effVal, neutralVal, calEntry, sign, weights, effObj, neutralObj)=>{
      const rawDelta = (effVal-neutralVal)*d.primeMult;
      const coef = rawDelta>=0 ? calEntry.up : calEntry.down;
      const coefLabel = rawDelta>=0 ? `${calEntry.up} (build ≥ neutral)` : `${calEntry.down} (build < neutral)`;
      const lines = [
        weightedLine(effObj, weights, "eff (you, this season)"),
        weightedLine(neutralObj, weights, "neutral (flat-65 baseline)"),
        "",
        `${name} = clamp(${baseLabel} ${sign} (eff − neutral) × primeMult × coef, ${fmt(calEntry.lo)}, ${fmt(calEntry.hi)})  — ${d.decade} bounds, sourced record`,
        `${" ".repeat(name.length)} = clamp(${fmt(base)} ${sign} (${effVal.toFixed(1)} − ${neutralVal.toFixed(1)}) × ${d.primeMult.toFixed(2)} × ${coefLabel}, ...) = ${resultText}`,
      ];
      return card(name, resultText, lines);
    };
    const asPct1 = x=>fmtPct(x), asPct2 = x=>(x*100).toFixed(2)+"%", asNum1 = x=>x.toFixed(1);

    const compCard = rateCard("Completion %", fmtPct(d.comp), asPct1, d.league.comp, "leagueComp", d.effAcc, d.neutralAcc, d.cal.comp, "+", d.W.acc, d.eff, d.neutral);
    const ypaCard = rateCard("Yards / Attempt", d.ypa.toFixed(2), asNum1, d.league.ypa, "leagueY/A", d.effYpa, d.neutralYpa, d.cal.ypa, "+", d.W.ypa, d.eff, d.neutral);
    const tdRateCard = rateCard("TD Rate (per attempt)", (d.tdRate*100).toFixed(2)+"%", asPct2, d.league.tdRate, "leagueTdRate", d.effTd, d.neutralTd, d.cal.td, "+", d.W.td, d.eff, d.neutral);
    const intRateCard = rateCard("INT Rate (per attempt)", (d.intRate*100).toFixed(2)+"%", asPct2, d.league.intRate, "leagueIntRate", d.effInt, d.neutralInt, d.cal.int, "−", d.W.int, d.eff, d.neutral);

    const attCard = card("Attempts / Game", d.attPerGame.toFixed(1),
      [
        weightedLine(d.eff, OVERALL_WEIGHTS, "effOverall (you, this season)"),
        weightedLine(d.neutral, OVERALL_WEIGHTS, "neutralOverall (flat-65 baseline)"),
        "",
        `Att/Game = clamp((leagueAtt/G − ΔMOB×0.05 + (effOverall−neutralOverall)×primeMult×0.06 ± noise) × roleShare, 4, 48)`,
        `         = clamp((${d.league.attPerGame} − (${d.eff.MOB.toFixed(0)}−${d.neutral.MOB.toFixed(0)})×0.05 + (${d.effOverall.toFixed(1)}−${d.neutralOverall.toFixed(1)})×${d.primeMult.toFixed(2)}×0.06 ± up to 2) × ${d.roleShare.toFixed(2)}, 4, 48)`,
        `         = ${d.attPerGame.toFixed(1)} (shown here without the ±2 per-season noise the real sim adds)`,
        "",
        (career.contract.tier!=="minimum" && career.contract.tier!=="backup")
          ? `Role share: full starter (contract tier "${career.contract.tier}") = 1.00`
          : `Role share: contract tier "${career.contract.tier}" rolls a FRESH random value in [${d.roleShareRange[0].toFixed(2)}, ${d.roleShareRange[1].toFixed(2)}] every season -- ${d.roleShare.toFixed(2)} shown here is just that range's midpoint.`,
      ]);

    const ratingCard = card("Passer Rating (expected, full season)", d.expRating.toFixed(1),
      [
        `Over an expected ${d.expGames}-game healthy season at the rates above:`,
        `  Attempts ≈ ${d.expAttempts}, Completions ≈ ${d.expComp}, Yards ≈ ${d.expYards.toLocaleString()}, TD ≈ ${d.expTd}, INT ≈ ${d.expInt}`,
        "",
        "Standard NFL formula, each of 4 components clamped to [0, 2.375]:",
        `  a = clamp((comp/att − 0.3) × 5)       = ${clamp(((d.expComp/d.expAttempts)-0.3)*5,0,2.375).toFixed(3)}`,
        `  b = clamp((yards/att − 3) × 0.25)     = ${clamp(((d.expYards/d.expAttempts)-3)*0.25,0,2.375).toFixed(3)}`,
        `  c = clamp((td/att) × 20)              = ${clamp((d.expTd/d.expAttempts)*20,0,2.375).toFixed(3)}`,
        `  d = clamp(2.375 − (int/att) × 25)     = ${clamp(2.375-((d.expInt/d.expAttempts)*25),0,2.375).toFixed(3)}`,
        `  Rating = (a+b+c+d)/6 × 100             = ${d.expRating.toFixed(1)}`,
      ]);

    const rushCard = card("Rushing (Att/Game, Yds/Carry, TD Rate)",
      `${d.rushAttPerGame.toFixed(1)} att · ${d.rushYpc.toFixed(2)} ypc · ${(d.rushTdRate*100).toFixed(2)}% TD`,
      [
        weightedLine(d.eff, d.W.rush, "effRush"),
        "",
        `Rush Att/Game = clamp((effRush − 45) × 0.14, 0.2, 9.5)          = ${d.rushAttPerGame.toFixed(2)}`,
        `Rush Yds/Carry = clamp(3.4 + (effRush − 55) × 0.045, 1.8, 7.8)   = ${d.rushYpc.toFixed(2)}`,
        `Rush TD Rate = clamp(0.018 + (effRush − 55) × 0.0006, ...)      = ${(d.rushTdRate*100).toFixed(2)}%`,
        `Over ${d.expGames} games ≈ ${d.expRushAtt} carries, ${d.expRushYards.toLocaleString()} yards, ${d.expRushTd} TD`,
      ]);

    const sackCard = card("Sacks Taken", `${d.expSacks} / season`,
      [
        `SackRate = clamp(0.075 − (PKT−neutralPKT)×0.0012 − (teamGrade−65)×0.0004, 1.5%, 16%)`,
        `         = ${(d.sackRate*100).toFixed(2)}% per dropback`,
        `Over ${d.expGames} games and ${d.expAttempts} attempts ≈ ${d.expSacks} sacks taken`,
        `Driven by pocket presence (individually) and team quality (o-line) -- a good pocket passer on a good team gets sacked well below league-average; a statue on a bad line gets sacked a lot more.`,
      ]);

    const winCard = card("Win Probability (per game)", fmtPct(d.winProb),
      [
        `Each game is now simulated individually against that WEEK'S actual opponent grade (simulateGameScore, the same engine the playoffs use) instead of one flat season-long roll -- so a soft schedule and a brutal one produce visibly different records for the same build.`,
        `Offensive grade is now BLENDED with team quality, not just nudged by it: myOff = teamGrade + (effOverall−teamGrade)×${QB_INFLUENCE_REGULAR} + (Clutch−65)×0.03 = ${d.myOff.toFixed(2)} -- a QB whose personal grade diverges sharply from the team around him gets pulled hard toward that team's level, in EITHER direction.`,
        `Shown here vs. a league-average (grade 65) opponent: WinProb ≈ clamp(0.5 + (myOff−oppGrade)×0.012, 6%, 94%)`,
        `        = clamp(0.5 + (${d.myOff.toFixed(1)}−65)×0.012, ...) = ${fmtPct(d.winProb)} vs. an average opponent this season`,
        `A genuinely better opponent (higher grade) meaningfully lowers this game's odds, and vice versa -- see the Season tab for the real week-by-week schedule and results.`,
      ]);

    function gateLine(ok, text){ return `<div class="calc-gate ${ok?"pass":"fail"}">${ok?"✓":"✗"} ${svgEscape(text)}</div>`; }

    const awardsIntro = `<div class="calc-refnote">All three season awards are judged on what actually happened -- passer rating vs. that year's league average (ratingEdge), raw TD production, team win rate, and (for Pro Bowl/All-Pro) how much of the season was actually played -- never on the underlying attribute grade. This preview assumes a full healthy season, so the games-played gates always read ✓ here; a real season that misses a big chunk of games fails them and the award becomes unreachable no matter how good the per-game numbers were.</div>`;

    const pbCard = card("Pro Bowl Score", d.proBowlScore.toFixed(2),
      [
        `ratingEdge = expectedRating − leagueAvgRating = ${d.expRating.toFixed(1)} − ${d.leagueAvgRating.toFixed(1)} = ${d.ratingEdge.toFixed(1)}`,
        `score = ratingEdge×0.6 + max(0, TD−16)×0.45 + (winProb−0.5)×10`,
        `      = ${d.ratingEdge.toFixed(1)}×0.6 + max(0, ${d.expTd}−16)×0.45 + (${d.winProb.toFixed(2)}−0.5)×10 = ${d.proBowlScore.toFixed(2)}`,
        `Pro Bowl is no longer an independent per-QB roll -- the top scorers in each conference make it (2/conf through the 1980s, 3/conf from the 1990s on, with an extra qualifying 3rd spot possible pre-1990), decided once every other league QB's season is locked in.`,
      ],
      gateLine(d.expAttempts>200, `attempts > 200 (${d.expAttempts})`) +
      gateLine(true, `played ≥ 65% of games (this preview assumes a full healthy season)`) +
      gateLine(d.ratingEdge>=1, `ratingEdge ≥ 1 — must grade out above league average himself (${d.ratingEdge.toFixed(1)})`));

    const apCard = card("All-Pro Score", d.allProScore.toFixed(2),
      [
        `score = ratingEdge×0.75 + max(0, TD−22)×0.55 + (winProb−0.5)×18`,
        `      = ${d.ratingEdge.toFixed(1)}×0.75 + max(0, ${d.expTd}−22)×0.55 + (${d.winProb.toFixed(2)}−0.5)×18 = ${d.allProScore.toFixed(2)}`,
        `All-Pro is no longer an independent per-QB roll -- exactly 1 First-Team and 1 Second-Team All-Pro are named league-wide, the two highest scores across the player and every simulated rival this season.`,
      ],
      gateLine(d.proBowlGateOk, `must clear the Pro Bowl gate first`) +
      gateLine(true, `played ≥ 80% of games (this preview assumes a full healthy season)`) +
      gateLine(d.ratingEdge>=9, `ratingEdge ≥ 9 (${d.ratingEdge.toFixed(1)})`));

    const mvpCard = card("MVP Score", d.mvpScore.toFixed(1),
      [
        `score = ratingEdge×0.55 + (winProb−0.5)×40 + max(0, TD−25)×0.6`,
        `      = ${d.ratingEdge.toFixed(1)}×0.55 + (${d.winProb.toFixed(2)}−0.5)×40 + max(0, ${d.expTd}−25)×0.6 = ${d.mvpScore.toFixed(2)}`,
        `MVP is no longer an independent per-QB roll -- this score is compared against every other starting QB in the league at season's end, and whoever's highest wins it outright (a genuine tie produces co-MVPs).`,
      ],
      gateLine(d.expAttempts>150, `attempts > 150 (${d.expAttempts})`) +
      gateLine(true, `played ≥ 50% of games (this preview assumes a full healthy season)`));

    return `
      <div class="admin-note">Live numbers for <b>${svgEscape(career.name)}</b> — age ${career.age}, ${d.decade}${d.scheme?`, running the ${svgEscape(d.scheme.name)}`:""}, as if the upcoming season is played in full health. Actual results still vary: the sim also rolls role-share/attempts-per-game noise and a game-by-game win/loss coin flip on top of everything shown here.</div>
      ${buildEditorHtml}
      ${devCard}
      <div class="calc-group"><div class="calc-group-head">League Baseline by Decade</div>${refTable}</div>
      <div class="calc-group"><div class="calc-group-head">Age & Scheme</div>${primeCard}</div>
      <div class="calc-group"><div class="calc-group-head">Passing Rates</div>${compCard}${ypaCard}${tdRateCard}${intRateCard}${attCard}</div>
      <div class="calc-group"><div class="calc-group-head">Passer Rating</div>${ratingCard}</div>
      <div class="calc-group"><div class="calc-group-head">Rushing</div>${rushCard}</div>
      <div class="calc-group"><div class="calc-group-head">Sacks</div>${sackCard}</div>
      <div class="calc-group"><div class="calc-group-head">Team Success</div>${winCard}</div>
      <div class="calc-group"><div class="calc-group-head">Season Awards</div>${awardsIntro}${pbCard}${apCard}${mvpCard}</div>`;
  }

  function renderAdminTabContent(){
    const body = document.getElementById("adminTabBody");
    if(!body) return;
    if(adminState.tab==="players") body.innerHTML = renderAdminPlayersTab();
    else if(adminState.tab==="events") body.innerHTML = renderAdminEventsTab();
    else if(adminState.tab==="calc") body.innerHTML = renderAdminCalcTab();
    else body.innerHTML = renderAdminLiveTab();
    wireAdminTabContent();
  }
  function wireAdminTabContent(){
    if(adminState.tab==="players"){
      const search = document.getElementById("adminPlayerSearch");
      if(search) search.addEventListener("input", ()=>{ adminState.search = search.value; renderAdminTabContent(); document.getElementById("adminPlayerSearch").focus(); document.getElementById("adminPlayerSearch").selectionStart = document.getElementById("adminPlayerSearch").value.length; });
      const decadeSel = document.getElementById("adminDecadeFilter");
      if(decadeSel) decadeSel.addEventListener("change", ()=>{ adminState.decadeFilter = decadeSel.value; renderAdminTabContent(); });
      document.querySelectorAll("table.admin-table th[data-sort]").forEach(th=>{
        th.addEventListener("click", ()=>{
          const key = th.dataset.sort;
          if(adminState.sortKey===key) adminState.sortDir = adminState.sortDir==="asc" ? "desc" : "asc";
          else { adminState.sortKey = key; adminState.sortDir = ATTR_KEYS.includes(key) ? "desc" : "asc"; }
          renderAdminTabContent();
        });
      });
    } else if(adminState.tab==="events"){
      document.querySelectorAll(".admin-fire-btn").forEach(btn=>{
        btn.addEventListener("click", ()=> adminFireEvent(btn.dataset.pool, btn.dataset.id));
      });
    } else if(adminState.tab==="live" && career){
      const repUp = document.getElementById("adminRepUp"), repDown = document.getElementById("adminRepDown");
      const gradeUp = document.getElementById("adminGradeUp"), gradeDown = document.getElementById("adminGradeDown");
      const previewKm = document.getElementById("adminPreviewKeyMoment");
      if(repUp) repUp.addEventListener("click", ()=>{ career.reputation = clamp(career.reputation+10,0,100); renderAdminTabContent(); });
      if(repDown) repDown.addEventListener("click", ()=>{ career.reputation = clamp(career.reputation-10,0,100); renderAdminTabContent(); });
      if(gradeUp) gradeUp.addEventListener("click", ()=>{ career.teamStrength = clamp(career.teamStrength+10,20,97); career.leagueStrength[career.teamId]=career.teamStrength; renderAdminTabContent(); });
      if(gradeDown) gradeDown.addEventListener("click", ()=>{ career.teamStrength = clamp(career.teamStrength-10,20,97); career.leagueStrength[career.teamId]=career.teamStrength; renderAdminTabContent(); });
      const gmUp = document.getElementById("adminGmUp"), gmDown = document.getElementById("adminGmDown");
      const fanUp = document.getElementById("adminFanUp"), fanDown = document.getElementById("adminFanDown");
      const popUp = document.getElementById("adminPopUp"), popDown = document.getElementById("adminPopDown");
      const schemeReroll = document.getElementById("adminSchemeReroll");
      if(gmUp) gmUp.addEventListener("click", ()=>{ career.gmRelationship = clamp(career.gmRelationship+10,0,100); renderAdminTabContent(); });
      if(gmDown) gmDown.addEventListener("click", ()=>{ career.gmRelationship = clamp(career.gmRelationship-10,0,100); renderAdminTabContent(); });
      if(fanUp) fanUp.addEventListener("click", ()=>{ career.fanSupport = clamp(career.fanSupport+10,0,100); renderAdminTabContent(); });
      if(fanDown) fanDown.addEventListener("click", ()=>{ career.fanSupport = clamp(career.fanSupport-10,0,100); renderAdminTabContent(); });
      if(popUp) popUp.addEventListener("click", ()=>{ career.leaguePopularity = clamp(career.leaguePopularity+10,0,100); renderAdminTabContent(); });
      if(popDown) popDown.addEventListener("click", ()=>{ career.leaguePopularity = clamp(career.leaguePopularity-10,0,100); renderAdminTabContent(); });
      if(schemeReroll) schemeReroll.addEventListener("click", ()=>{ maybeChangeTeamScheme(); renderAdminTabContent(); });
      if(previewKm) previewKm.addEventListener("click", ()=>{
        const fakeRound = { round:"Divisional", opponent:"Sample Opponent", myScore:24, oppScore:20, won:true,
          quarters:[{q:1,myTotal:7,oppTotal:3},{q:2,myTotal:14,oppTotal:10},{q:3,myTotal:17,oppTotal:17},{q:4,myTotal:24,oppTotal:20}],
          oppTendency: pickOpponentTendency() };
        closeAdminOverlay();
        triggerKeyMoment(career, fakeRound, -1, ()=>{}, ()=>true);
      });
    } else if(adminState.tab==="calc" && career && build){
      // range/number pairs stay in sync as you drag or type, but nothing touches the actual
      // build until Apply (or a preset) is clicked -- so dragging a slider doesn't trigger a
      // full tab re-render (and lose focus) on every tick.
      ATTR_KEYS.forEach(k=>{
        const range = document.getElementById("cbeRange-"+k), num = document.getElementById("cbeInput-"+k);
        if(!range || !num) return;
        range.addEventListener("input", ()=>{ num.value = range.value; });
        num.addEventListener("input", ()=>{
          const v = clamp(parseInt(num.value,10)||10, 10, 99);
          range.value = v;
        });
      });
      function setAllAttributes(value){
        ATTR_KEYS.forEach(k=> build[k]=value);
        renderAdminTabContent();
      }
      const max99 = document.getElementById("cbeMax99"), min10 = document.getElementById("cbeMin10");
      const neutral65 = document.getElementById("cbeNeutral65"), restoreOrig = document.getElementById("cbeRestoreOriginal");
      const apply = document.getElementById("cbeApply");
      if(max99) max99.addEventListener("click", ()=> setAllAttributes(99));
      if(min10) min10.addEventListener("click", ()=> setAllAttributes(10));
      if(neutral65) neutral65.addEventListener("click", ()=> setAllAttributes(65));
      if(restoreOrig) restoreOrig.addEventListener("click", ()=>{
        if(adminState.buildSnapshot) ATTR_KEYS.forEach(k=> build[k]=adminState.buildSnapshot[k]);
        renderAdminTabContent();
      });
      if(apply) apply.addEventListener("click", ()=>{
        ATTR_KEYS.forEach(k=>{
          const num = document.getElementById("cbeInput-"+k);
          if(num) build[k] = clamp(parseInt(num.value,10)||10, 10, 99);
        });
        renderAdminTabContent();
      });
    }
  }
  function openAdminOverlay(){
    const overlay = document.getElementById("adminOverlay");
    if(!overlay) return;
    overlay.innerHTML = `
      <div class="admin-panel">
        <div class="admin-head">
          <div>
            <h2>Admin &amp; Testing Tools</h2>
            <div class="admin-sub">v10.1 · browse data, force-fire events, inspect live state</div>
          </div>
          <button type="button" class="admin-close" id="adminCloseBtn" aria-label="Close admin panel">✕</button>
        </div>
        <div class="admin-tabs">
          <button type="button" class="admin-tab" data-tab="players">Players (${QBS.length})</button>
          <button type="button" class="admin-tab" data-tab="events">Events</button>
          <button type="button" class="admin-tab" data-tab="live">Live Career</button>
          <button type="button" class="admin-tab" data-tab="calc">Stat Calculator</button>
        </div>
        <div class="admin-body" id="adminTabBody"></div>
      </div>`;
    document.querySelectorAll(".admin-tab").forEach(tabBtn=>{
      tabBtn.classList.toggle("active", tabBtn.dataset.tab===adminState.tab);
      tabBtn.addEventListener("click", ()=>{ adminState.tab = tabBtn.dataset.tab; openAdminOverlay(); });
    });
    document.getElementById("adminCloseBtn").addEventListener("click", closeAdminOverlay);
    if(!overlay._backdropWired){
      overlay._backdropWired = true;
      overlay.addEventListener("click", (e)=>{ if(e.target===overlay) closeAdminOverlay(); });
    }
    renderAdminTabContent();
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden","false");
  }
  function closeAdminOverlay(){
    const overlay = document.getElementById("adminOverlay");
    if(!overlay) return;
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden","true");
    overlay.innerHTML = "";
  }
  function initAdminPanel(){
    const btn = document.getElementById("adminToggleBtn");
    if(!btn) return;
    btn.addEventListener("click", openAdminOverlay);
  }

  /* ================= Init ================= */
  document.getElementById("statQbCount").textContent = QBS.length;
  document.getElementById("howscoreQbCount").textContent = QBS.length;
  renderBestStrip();
  renderLastBuildStrip();
  renderActiveCareerStrip();
  initSoundToggle();
  initKeyMomentsToggle();
  initAdminPanel();
  // One delegated listener, attached once (NOT inside renderSeasonCard -- #careerContent itself is
  // never recreated between seasons, only its innerHTML, so attaching there on every render would
  // stack up a duplicate listener per season). Covers every rival-name link on the card in any tab
  // panel (Schedule, League, playoff boxes) -- panels all stay in the DOM at once (switchDashTab
  // only toggles visibility), so this needs no re-wiring on tab switches or season re-renders.
  document.getElementById("careerContent").addEventListener("click", (e)=>{
    const link = e.target.closest("[data-rival-id]");
    if(link) openRivalProfile(link.dataset.rivalId);
  });

  // Trophy Room: static screen (never recreated), so all wiring happens once, here.
  let trophyRoomSortKey = "recent";
  function renderTrophyRoomScreen(){
    document.getElementById("trophyRoomTable").innerHTML = buildTrophyRoomTableHTML(trophyRoomSortKey);
  }
  document.getElementById("trophyRoomBtn").addEventListener("click", ()=>{
    trophyRoomSortKey = "recent";
    document.querySelectorAll("#trophyRoomSortRow .tr-sort-btn").forEach(b=> b.classList.toggle("active", b.dataset.sort==="recent"));
    renderTrophyRoomScreen();
    showScreen("trophyroom");
  });
  document.getElementById("trophyRoomBackBtn").addEventListener("click", ()=> showScreen("menu"));
  document.querySelectorAll("#trophyRoomSortRow .tr-sort-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      trophyRoomSortKey = btn.dataset.sort;
      document.querySelectorAll("#trophyRoomSortRow .tr-sort-btn").forEach(b=> b.classList.toggle("active", b===btn));
      renderTrophyRoomScreen();
    });
  });
  // #trophyRoomTable itself is never recreated (only its innerHTML, on every sort click), so one
  // delegated listener here -- not inside buildTrophyRoomTableHTML -- is enough for every row ever
  // rendered into it, same pattern as the careerContent listener above.
  document.getElementById("trophyRoomTable").addEventListener("click", (e)=>{
    const btn = e.target.closest("[data-card-id]");
    if(!btn) return;
    const entry = loadTrophyRoom().find(x=>x.id===btn.dataset.cardId);
    if(entry) openBaseballCard(entry);
  });
})();
