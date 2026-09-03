// Diamond Lab (baseball conversion of Gridiron Lab): the 30 MLB franchises, league/division
// alignment by year, and postseason format by year. Pure data -- no logic, no embedded functions,
// no reference to any main.js-internal state.
//
// INTERNAL CODE NOTE: the two leagues are stored under the opaque keys "AFC" (= American League)
// and "NFC" (= National League), inherited from the Gridiron Lab skeleton. Dozens of bracket /
// standings / award lookups key off those exact literals, so they are NEVER renamed -- only
// remapped at the display layer (see leagueLabel() in main.js). Same rule for the internal
// playoff-round literals "Wild Card" / "Divisional" / "Conference Championship" / "Super Bowl",
// which display as Wild Card Series / Division Series / League Championship Series / World Series.

  export const TEAMS = [
    // ---- American League ("AFC") ----
    {"id":"BAL","start":1960,"names":[{"from":1960,"to":9999,"name":"Baltimore Orioles"}]},
    {"id":"BOS","start":1960,"names":[{"from":1960,"to":9999,"name":"Boston Red Sox"}]},
    {"id":"NYY","start":1960,"names":[{"from":1960,"to":9999,"name":"New York Yankees"}]},
    {"id":"TB","start":1998,"names":[{"from":1998,"to":2007,"name":"Tampa Bay Devil Rays"},{"from":2008,"to":9999,"name":"Tampa Bay Rays"}]},
    {"id":"TOR","start":1977,"names":[{"from":1977,"to":9999,"name":"Toronto Blue Jays"}]},
    {"id":"CWS","start":1960,"names":[{"from":1960,"to":9999,"name":"Chicago White Sox"}]},
    {"id":"CLE","start":1960,"names":[{"from":1960,"to":2021,"name":"Cleveland Indians"},{"from":2022,"to":9999,"name":"Cleveland Guardians"}]},
    {"id":"DET","start":1960,"names":[{"from":1960,"to":9999,"name":"Detroit Tigers"}]},
    {"id":"KC","start":1969,"names":[{"from":1969,"to":9999,"name":"Kansas City Royals"}]},
    {"id":"MIN","start":1960,"names":[{"from":1960,"to":1960,"name":"Washington Senators"},{"from":1961,"to":9999,"name":"Minnesota Twins"}]},
    {"id":"HOU","start":1962,"names":[{"from":1962,"to":1964,"name":"Houston Colt .45s"},{"from":1965,"to":9999,"name":"Houston Astros"}]},
    {"id":"LAA","start":1961,"names":[{"from":1961,"to":1964,"name":"Los Angeles Angels"},{"from":1965,"to":1996,"name":"California Angels"},{"from":1997,"to":2004,"name":"Anaheim Angels"},{"from":2005,"to":9999,"name":"Los Angeles Angels"}]},
    {"id":"OAK","start":1960,"names":[{"from":1960,"to":1967,"name":"Kansas City Athletics"},{"from":1968,"to":9999,"name":"Oakland Athletics"}]},
    {"id":"SEA","start":1977,"names":[{"from":1977,"to":9999,"name":"Seattle Mariners"}]},
    {"id":"TEX","start":1961,"names":[{"from":1961,"to":1971,"name":"Washington Senators"},{"from":1972,"to":9999,"name":"Texas Rangers"}]},
    // ---- National League ("NFC") ----
    {"id":"ATL","start":1960,"names":[{"from":1960,"to":1965,"name":"Milwaukee Braves"},{"from":1966,"to":9999,"name":"Atlanta Braves"}]},
    {"id":"MIA","start":1993,"names":[{"from":1993,"to":2011,"name":"Florida Marlins"},{"from":2012,"to":9999,"name":"Miami Marlins"}]},
    {"id":"NYM","start":1962,"names":[{"from":1962,"to":9999,"name":"New York Mets"}]},
    {"id":"PHI","start":1960,"names":[{"from":1960,"to":9999,"name":"Philadelphia Phillies"}]},
    {"id":"WSN","start":1969,"names":[{"from":1969,"to":2004,"name":"Montreal Expos"},{"from":2005,"to":9999,"name":"Washington Nationals"}]},
    {"id":"CHC","start":1960,"names":[{"from":1960,"to":9999,"name":"Chicago Cubs"}]},
    {"id":"CIN","start":1960,"names":[{"from":1960,"to":1989,"name":"Cincinnati Reds"},{"from":1990,"to":9999,"name":"Cincinnati Reds"}]},
    {"id":"MIL","start":1969,"names":[{"from":1969,"to":1969,"name":"Seattle Pilots"},{"from":1970,"to":9999,"name":"Milwaukee Brewers"}]},
    {"id":"PIT","start":1960,"names":[{"from":1960,"to":9999,"name":"Pittsburgh Pirates"}]},
    {"id":"STL","start":1960,"names":[{"from":1960,"to":9999,"name":"St. Louis Cardinals"}]},
    {"id":"ARI","start":1998,"names":[{"from":1998,"to":9999,"name":"Arizona Diamondbacks"}]},
    {"id":"COL","start":1993,"names":[{"from":1993,"to":9999,"name":"Colorado Rockies"}]},
    {"id":"LAD","start":1960,"names":[{"from":1960,"to":9999,"name":"Los Angeles Dodgers"}]},
    {"id":"SD","start":1969,"names":[{"from":1969,"to":9999,"name":"San Diego Padres"}]},
    {"id":"SF","start":1960,"names":[{"from":1960,"to":9999,"name":"San Francisco Giants"}]},
  ];

  /* ----- team color pairs for the draft-night reveal card. Publicly-known brand colors only --
     a stylized primary/secondary gradient + initials badge, no logos or trademarked artwork. ----- */
  export const TEAM_COLORS = {
    BAL:["#DF4601","#000000"], BOS:["#BD3039","#0C2340"], NYY:["#0C2340","#C4CED4"], TB:["#092C5C","#8FBCE6"],
    TOR:["#134A8E","#1D2D5C"], CWS:["#27251F","#C4CED4"], CLE:["#0C2340","#E31937"], DET:["#0C2340","#FA4616"],
    KC:["#004687","#BD9B60"], MIN:["#002B5C","#D31145"], HOU:["#002D62","#EB6E1F"], LAA:["#BA0021","#003263"],
    OAK:["#003831","#EFB21E"], SEA:["#0C2C56","#005C5C"], TEX:["#003278","#C0111F"],
    ATL:["#CE1141","#13274F"], MIA:["#00A3E0","#EF3340"], NYM:["#002D72","#FF5910"], PHI:["#E81828","#002D72"],
    WSN:["#AB0003","#14225A"], CHC:["#0E3386","#CC3433"], CIN:["#C6011F","#000000"], MIL:["#12284B","#FFC52F"],
    PIT:["#FDB827","#27251F"], STL:["#C41E3A","#0C2340"], ARI:["#A71930","#E3D4AD"], COL:["#333366","#C4CED4"],
    LAD:["#005A9C","#EF3E42"], SD:["#2F241D","#FFC425"], SF:["#FD5A1E","#27251F"],
  };

  /* ----- league structure by year -----
     - 2013-present: 6 divisions of 5, matches today's map (HOU in AL West, MIL in NL Central).
     - 1994-2012: 3 divisions per league, unbalanced (AL West 4, NL Central 6) -- HOU/MIL both NL.
     - 1969-1993: 2 divisions per league (East/West), no wild card.
     - pre-1969: no divisions -- one pennant race per league, modeled as a single division so the
       bracket collapses straight to a 1-vs-1 World Series. ----- */
  export const DIVISIONS = [
    { conf:"AFC", name:"East",    teams:["BAL","BOS","NYY","TB","TOR"] },
    { conf:"AFC", name:"Central", teams:["CWS","CLE","DET","KC","MIN"] },
    { conf:"AFC", name:"West",    teams:["HOU","LAA","OAK","SEA","TEX"] },
    { conf:"NFC", name:"East",    teams:["ATL","MIA","NYM","PHI","WSN"] },
    { conf:"NFC", name:"Central", teams:["CHC","CIN","MIL","PIT","STL"] },
    { conf:"NFC", name:"West",    teams:["ARI","COL","LAD","SD","SF"] },
  ];
  export const DIVISIONS_1994_2012 = [
    { conf:"AFC", name:"East",    teams:["BAL","BOS","NYY","TB","TOR"] },
    { conf:"AFC", name:"Central", teams:["CWS","CLE","DET","KC","MIN"] },
    { conf:"AFC", name:"West",    teams:["LAA","OAK","SEA","TEX"] },
    { conf:"NFC", name:"East",    teams:["ATL","MIA","NYM","PHI","WSN"] },
    { conf:"NFC", name:"Central", teams:["CHC","CIN","HOU","MIL","PIT","STL"] },
    { conf:"NFC", name:"West",    teams:["ARI","COL","LAD","SD","SF"] },
  ];
  export const DIVISIONS_1969_1993 = [
    // MIL was in the AL from 1970-1997; HOU in the NL from 1962. Filtering by availability year
    // handles the rest (COL/MIA/ARI/TB not born yet, KC/SD/WSN/SEA arrive 1969/1977).
    { conf:"AFC", name:"East", teams:["BAL","BOS","NYY","TOR","DET","CLE","MIL"] },
    { conf:"AFC", name:"West", teams:["CWS","KC","MIN","LAA","OAK","SEA","TEX"] },
    { conf:"NFC", name:"East", teams:["ATL","NYM","PHI","WSN","CHC","PIT","STL"] },
    { conf:"NFC", name:"West", teams:["CIN","HOU","LAD","SD","SF"] },
  ];
  export const DIVISIONS_PRE_1970 = [
    { conf:"AFC", name:"League", teams:["BAL","BOS","NYY","CWS","CLE","DET","MIN","OAK","LAA","TEX"] },
    { conf:"NFC", name:"League", teams:["ATL","NYM","PHI","CHC","CIN","PIT","STL","LAD","SF","HOU"] },
  ];

  /* Postseason format by year -- `wildcards` slots added on top of the division winners, and
     `wcGames` wild-card-round games played (seedsPerConf - 2*wcGames teams bye to the Division
     Series). Tracks real MLB expansion of the bracket.
     - pre-1969: pennant winners only, straight to the World Series.
     - 1969-1993: LCS then WS (2 division winners per league).
     - 1994-2011: added the Division Series + 1 wild card (4 teams, no bye, 1v4/2v3).
     - 2012-2021: 2nd wild card, the two WCs play a one-game playoff.
     - 2022-present: 3rd wild card; 12-team field, top 2 seeds per league bye. */
  export const PLAYOFF_ERAS = [
    { from:1900, to:1968, wildcards:0, wcGames:0 },
    { from:1969, to:1993, wildcards:0, wcGames:0 },
    { from:1994, to:2011, wildcards:1, wcGames:0 },
    { from:2012, to:2021, wildcards:2, wcGames:1 },
    { from:2022, to:9999, wildcards:3, wcGames:2 },
  ];
