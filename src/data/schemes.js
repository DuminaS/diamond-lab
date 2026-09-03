// Diamond Lab: the hitting-philosophy table -- the offensive approach the club builds its lineup
// around, chosen at the start of a career and occasionally changed by the club later. Each entry's
// `mult` scales specific tools when that season's production is computed (see schemeAdjust in
// main.js). Pure data, no logic.

  export const SCHEMES = [
    { id:"smallball", name:"Small Ball / Contact",
      blurb:"Put the ball in play, move runners, steal bases, manufacture runs an out at a time. Rewards bat control and pitch recognition over raw power.",
      mult:{TCH:1.14, SHA:1.10, MOB:1.08, DAC:0.86} },
    { id:"threetrueoutcomes", name:"Three True Outcomes",
      blurb:"Walks, strikeouts, home runs -- take your walks, sell out for power, live with the whiffs. Rewards raw power and plate discipline; contact hitting takes a back seat.",
      mult:{DAC:1.14, PKT:1.10, REL:1.06, SHA:0.85} },
    { id:"launchangle", name:"Launch Angle Revolution",
      blurb:"Get the ball in the air, hunt the pitch you can drive, trade grounders for barrels. Rewards bat speed and power over a slap-and-run approach.",
      mult:{REL:1.12, DAC:1.10, IMP:0.90, MOB:0.90} },
    { id:"situational", name:"Situational Hitting & Hit-and-Run",
      blurb:"The count, the runners, the defense -- hit it where they ain't and behind the runner. Rewards a smart, adjustable approach and elite bat control.",
      mult:{DEC:1.12, TCH:1.10, ANT:1.06, DAC:0.90} },
    { id:"moneyball", name:"Moneyball / On-Base Machine",
      blurb:"An out is the only truly scarce resource. Work the count, foul off the tough ones, take the free 90 feet. Rewards plate discipline and pitch recognition above all.",
      mult:{PKT:1.16, ANT:1.12, DEC:1.08, MOB:0.88} },
    { id:"stationtostation", name:"Station-to-Station Power",
      blurb:"Wait for a mistake and hit it 430 feet. No wasted motion on the bases, no bunting -- runs come three at a time. Rewards raw power and clutch, punishes a speed game.",
      mult:{DAC:1.15, CLU:1.06, PKT:1.05, MOB:0.82} },
    { id:"speedchaos", name:"Speed & Chaos",
      blurb:"Get on, take the extra base, force the throw, make the defense beat you. Rewards speed and baserunning instinct; the ball rarely leaves the yard.",
      mult:{MOB:1.16, IMP:1.12, SHA:1.04, DAC:0.84} },
    { id:"proapproach", name:"Balanced Pro Approach",
      blurb:"No single wrinkle -- a professional at-bat every time up, adjusting to the pitcher and the situation. Rewards a well-rounded, disciplined hitter over a one-tool specialist.",
      mult:{DEC:1.08, ANT:1.06, TCH:1.06, IMP:0.92} },
  ];
