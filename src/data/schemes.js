// Wave 9 (MASTER_REMEDIATION_SPEC.md): Stage 1 of incremental modularization -- the offensive
// scheme table (id/name/flavor blurb/attribute multipliers) extracted verbatim from src/main.js's
// single monolithic IIFE. Byte-for-byte identical to what main.js already had; no logic here, no
// embedded functions, no reference to any other main.js-internal state.

  export const SCHEMES = [
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
