// calc.js — ported calculation engine (EarningResult.kt / ItineraryImpl.kt logic)

/* ============================================================
   PORTED CALCULATION ENGINE — mirrors EarningResult.kt / ItineraryImpl.kt
   ============================================================ */

function PICK(fc, table){ return table[fc] !== undefined ? table[fc] : 0; }
function isAeroplanFareBasis(fb){ return fb.includes("BP00") || fb.includes("AERO"); }

function getEliteBonusMultiplier(status){
  switch(String(status)){
    case "100": return 5;
    case "75": return 4;
    case "50": return 3;
    case "35": return 2;
    case "25": return 1;
    default: return 0;
  }
}

// context helper for carrier tables that depend on origin/destination country/continent
function ctxFlags(ctx){
  const NA = new Set(["Canada","United States"]);
  return {
    domesticNA: NA.has(ctx.originCountry) && NA.has(ctx.destinationCountry),
    domesticIndia: ctx.originCountry==="India" && ctx.destinationCountry==="India",
    euEu: ctx.originContinent==="Europe" && ctx.destinationContinent==="Europe",
    domesticNZ: ctx.originCountry==="New Zealand" && ctx.destinationCountry==="New Zealand",
    oceaniaOceania: ctx.originContinent==="Oceania" && ctx.destinationContinent==="Oceania",
    domesticKorea: ctx.originCountry==="South Korea" && ctx.destinationCountry==="South Korea",
    domesticEgypt: ctx.originCountry==="Egypt" && ctx.destinationCountry==="Egypt",
    domesticSA: ctx.originCountry==="South Africa" && ctx.destinationCountry==="South Africa",
  };
}

const CARRIERS = {
  A3: {star:true, pct:(fc)=>PICK(fc,{A:125,C:125,D:125,Z:125,Y:100,B:100,G:100,W:100,H:100,L:100,M:100,V:100,Q:100,O:50,J:50,S:50,K:50,U:25,T:25,P:25,E:25})},
  AD: {star:false, pct:(fc)=>PICK(fc,{J:150,C:150,D:150,I:150,Y:100,B:100,A:100,E:100,F:100,G:100,H:100,K:100,L:100,M:100,N:100,O:100,P:75,Q:75,S:50,T:50,U:50,X:25,Z:25})},
  AI: {star:true, pct:(fc,ctx)=>{ const f=ctxFlags(ctx); return f.domesticIndia
    ? PICK(fc,{F:150,C:125,D:125,J:125,Z:125,R:110,A:110,N:110,Y:100,B:100,M:100,H:100,K:100,Q:100,V:100,W:100,G:100,L:50,U:25,T:25,S:25})
    : PICK(fc,{F:150,C:125,D:125,J:125,Z:125,R:110,A:110,N:110,Y:100,B:100,M:100,H:100,K:100,Q:100,V:100,W:100,G:100,L:50,U:50,T:50,S:50}); }},
  AV: {star:true, pct:(fc)=>PICK(fc,{C:125,J:125,D:125,F:125,Y:100,B:100,M:100,H:100,Q:100,V:100,A:100,E:100,G:100,K:100,L:100,O:100,P:100,Z:100,T:25,W:25,S:25})},
  BR: {star:true, pct:(fc)=>PICK(fc,{C:125,J:125,D:125,K:100,L:100,T:100,P:100,Y:100,B:100,M:75,H:75,Q:50,S:50})},
  CA: {star:true, pct:(fc)=>PICK(fc,{F:150,A:150,J:150,C:150,D:150,Z:125,R:110,G:110,E:90,Y:100,B:100,M:75,H:75,U:75,Q:75,V:75,W:50,T:50,S:50,L:25,K:25,P:25})},
  CM: {star:true, pct:(fc)=>PICK(fc,{C:125,J:125,D:125,R:125,Y:100,B:100,M:100,H:100,Q:100,K:100,V:100,U:100,S:100,W:100,E:100,L:100,T:100,O:100,A:100})},
  CX: {star:false, pct:(fc,ctx)=>{
      const other = ctx.origin==="HKG" ? ctx.destination : ctx.destination==="HKG" ? ctx.origin : null;
      if(!["CNX","HKT","BKK","CEB","MNL","KUL","SGN","HAN"].includes(other)) return 0;
      if(!ctx.ticketNumber.startsWith("014")) return 0;
      return PICK(fc,{F:150,A:150,J:125,C:125,D:125,P:125,I:125,W:110,R:110,E:110,Y:100,B:100,H:100,K:100,M:100,L:50,V:25});
    }},
  EK: {star:false, pct:(fc)=>PICK(fc,{F:150,A:150,C:125,J:125,I:125,O:125,H:110,W:100,E:100,R:70,Y:70,P:70,X:70,U:50,B:50,M:50,K:50,T:15,L:15,Q:15,G:0,V:0})},
  EN: {star:true, pct:(fc)=>PICK(fc,{J:150,C:150,D:125,Z:125,P:125,Y:100,B:100,M:100,U:75,H:75,Q:75,V:75,W:50,S:50,T:50,L:50,K:50})},
  ET: {star:true, pct:(fc)=>PICK(fc,{C:125,J:125,D:125,Y:100,G:100,S:100,B:100,M:75,K:75,L:75,V:75,H:50,U:50,Q:50,T:50,W:25,E:25,O:25})},
  EW: {star:true, pct:(fc)=>PICK(fc,{J:150,D:125,I:125,Y:100,B:100,M:100,H:100,Q:100,C:100,W:75,S:75,G:75,K:75,L:75,T:75,X:75,N:50,E:50,F:50,O:50,R:50,V:50})},
  EY: {star:false, pct:(fc,ctx)=>{
      if(!(ctx.ticketNumber.startsWith("014")||ctx.ticketNumber.startsWith("607"))) return 0;
      return PICK(fc,{P:400,F:250,A:250,J:150,C:150,D:150,W:125,Z:125,R:110,Y:100,B:100,H:75,K:75,M:75,Q:75,L:50,V:50,U:50,E:50,G:50,T:25});
    }},
  G3: {star:false, pct:(fc)=>PICK(fc,{C:150,L:150,F:125,D:125,Y:100,T:100,J:100,W:75,P:75,E:75,A:75,U:50,N:50,B:50})},
  GF: {star:false, pct:(fc)=>PICK(fc,{J:125,C:125,D:125,I:125,Y:100,L:50,M:50,B:50,H:50,U:25,V:25,E:25,O:25,N:25,S:25,K:25,X:25,Q:25,W:25})},
  HO: {star:true, pct:(fc)=>PICK(fc,{J:150,C:150,D:125,A:125,R:110,Y:100,B:100,M:100,U:100,H:75,Q:75,V:75,W:50})},
  LH_TABLE: null, // placeholder marker (see LH below)
  LO: {star:true, pct:(fc)=>PICK(fc,{C:125,D:125,Z:100,F:100,P:105,A:100,R:100,Y:100,B:100,M:100,E:75,H:75,K:75,Q:75,T:75,G:75,S:75,V:50,W:50,L:50,U:25,O:25})},
  MK: {star:false, pct:(fc)=>PICK(fc,{J:125,D:125,C:125,R:125,I:125,Y:100,K:100,H:75,T:75,U:50,V:50,S:50,L:50,Q:25,M:25,O:25,X:25,G:25,B:25,E:25,N:25})},
  MS: {star:true, pct:(fc,ctx)=>{ const f=ctxFlags(ctx); return f.domesticEgypt
    ? PICK(fc,{C:125,D:125,J:125,Z:125,Y:100,B:100,M:100,H:100,Q:75,K:75})
    : PICK(fc,{C:125,D:125,J:125,Z:125,Y:100,B:100,M:100,H:100,Q:75,K:75,V:50,L:50,G:25,S:25,W:25,T:25}); }},
  NH: {star:true, pct:(fc)=>PICK(fc,{F:150,A:150,J:150,C:125,D:125,Z:125,P:100,G:100,E:100,N:70,Y:100,B:100,M:100,U:70,H:70,Q:70,V:50,W:50,S:50,T:50,L:30,K:30})},
  NZ: {star:true, pct:(fc,ctx)=>{ const f=ctxFlags(ctx);
      if(f.domesticNZ) return PICK(fc,{C:125,D:125,J:125,Z:125,U:100,E:100,O:100,A:100,Y:100,B:100,M:70,H:70,Q:70,V:70});
      if(f.oceaniaOceania) return PICK(fc,{C:125,D:125,J:125,Z:125,U:100,E:100,O:100,A:100,Y:100,B:100,M:70,H:70,Q:70});
      return PICK(fc,{C:125,D:125,J:125,Z:125,U:100,E:100,O:100,A:100,Y:100,B:100,M:70,H:70,Q:70,V:70,W:70,T:70}); }},
  OA: {star:true, pct:(fc)=>PICK(fc,{A:125,C:125,D:125,Z:125,Y:100,B:100,G:100,W:100,H:100,L:100,M:100,V:100,Q:100,O:50,J:50,S:50,K:50,U:25,T:25,P:25,E:25})},
  OU: {star:true, pct:(fc)=>PICK(fc,{C:125,D:125,Z:125,Y:100,B:100,M:75,H:75,K:75,V:75,Q:75,A:75,F:75,W:50,S:50,J:50,O:50,P:50,G:50,T:25,E:25})},
  OZ: {star:true, pct:(fc,ctx)=>{ const f=ctxFlags(ctx); return f.domesticKorea
    ? PICK(fc,{C:125,U:100,Y:100,B:100,A:100,M:50,H:50,E:50,Q:50,K:50,S:50,V:25})
    : PICK(fc,{C:125,D:125,J:125,Z:125,U:100,Y:100,B:100,M:100,A:50,H:50,E:50,Q:50,K:50,S:50,V:25,W:25,G:25,T:25}); }},
  QH: {star:false, pct:(fc)=>PICK(fc,{J:125,C:125,I:125,Z:110,X:110,E:110,Y:100,W:100,S:100,B:100,H:50,K:50,L:50,M:50,N:50,Q:25,T:25,O:25,R:25})},
  SA: {star:true, pct:(fc,ctx)=>{ const f=ctxFlags(ctx); return f.domesticSA
    ? PICK(fc,{C:150,J:150,Z:125,D:100,Y:100,B:100,M:100,K:100,H:50,S:50,Q:50,T:50,V:50,L:25,W:25,G:25})
    : PICK(fc,{C:150,J:150,Z:125,D:125,P:125,Y:100,B:100,M:100,K:100,H:50,S:50,Q:50,T:50,V:50,L:25,W:25,G:25}); }},
  SN: {star:true, pct:(fc)=>PICK(fc,{J:150,C:150,D:150,Z:150,P:100,G:125,E:125,N:100,Y:125,B:125,M:100,U:100,H:100,W:50,S:50,T:50,Q:50,V:50,O:50})},
  SQ: {star:true, pct:(fc)=>PICK(fc,{A:150,F:150,Z:125,C:125,J:125,D:125,U:125,S:100,T:100,P:100,R:100,L:100,Y:100,B:100,E:100,M:75,H:75,W:75})},
  TG: {star:true, pct:(fc)=>PICK(fc,{F:150,A:150,P:150,C:125,D:125,J:125,Z:125,Y:110,B:110,M:100,H:100,Q:100,U:100,T:50,K:50,S:50})},
  TK: {star:true, pct:(fc)=>PICK(fc,{C:125,D:125,Z:125,K:125,J:110,Y:100,B:100,M:100,A:100,H:100,S:70,O:70,E:70,Q:70,T:70,L:70,V:25})},
  TP: {star:true, pct:(fc,ctx)=>{
      const special=["LIS","OPO","PXO","FNC"];
      if(special.includes(ctx.origin)&&special.includes(ctx.destination)) return PICK(fc,{C:150,D:150,Z:150,J:150,Y:100,B:100,M:100,H:100,Q:100,W:100,K:100,U:100,V:50,S:50,L:50,A:50,G:50,P:50,O:0,E:0,T:0});
      return PICK(fc,{C:150,D:150,Z:150,J:150,Y:100,B:100,M:100,H:100,Q:100,V:50,W:50,S:50,L:50,K:50,U:50,A:50,G:50,P:50,O:0,E:0,T:0});
    }},
  UA: {star:true, pct:(fc)=>PICK(fc,{J:150,C:150,D:150,Z:150,P:150,O:125,A:125,R:100,Y:125,B:125,M:100,E:100,U:100,H:100,Q:75,V:75,W:75,S:50,T:50,L:50,K:25,G:25,N:25}), sqcEligible:(fc)=>fc!=="N"},
  UK: {star:false, pct:(fc)=>PICK(fc,{C:125,J:125,D:125,Z:125,S:100,T:100,P:100,R:100,Y:100,B:100,M:100,A:50,H:50,N:50,Q:50,V:50,E:20,O:20})},
  VA: {star:false, pct:(fc)=>PICK(fc,{J:150,C:125,D:125,A:100,Y:100,B:100,W:100,H:100,K:100,L:100,R:50,E:50,O:50,N:50,V:50,P:50,Q:50,T:50,I:50,S:50,F:50,U:50,M:25,G:50})},
  VL: {star:true, pct:(fc)=>PICK(fc,{C:150,D:150,J:150,Z:150,P:50,Y:50,B:50,H:50,M:50,U:50,Q:50,V:50,W:50,S:50,L:50,T:50})},
  WY: {star:false, pct:(fc)=>PICK(fc,{F:150,A:150,J:125,C:125,D:125,I:125,P:125,Y:100,B:100,H:100,K:100,M:100,L:50,V:50,S:50,N:50,Q:50,O:50,R:50,T:50,W:25,G:25,E:10})},
  YN: {star:false, pct:(fc)=>PICK(fc,{Y:100,V:75,Q:75,B:75,E:50,H:50,L:50})},
  ZH: {star:true, pct:(fc)=>PICK(fc,{J:150,C:150,D:125,Z:125,R:125,G:100,E:90,Y:100,B:100,M:100,U:100,H:70,Q:70,V:50,W:50,S:50,T:50,L:25,P:25,A:25,K:25})},
  "3H": {star:false, pct:(fc)=>PICK(fc,{Y:100,V:100,P:100,R:100,B:85,H:75,T:25,W:25})},
  "5T": {star:false, pct:(fc)=>PICK(fc,{Y:100,C:75,P:75,H:75,M:50,O:50,B:25,A:25,T:25})},
};
const LH_PCT = (fc,ctx)=>{ const f=ctxFlags(ctx); return f.euEu
  ? PICK(fc,{J:150,C:150,D:150,Z:150,P:50,Y:50,B:50,M:50,U:50,H:50,Q:50,V:50,W:50,S:50,T:50,L:50})
  : PICK(fc,{F:150,A:150,J:150,C:150,D:150,Z:150,P:100,G:125,E:125,N:100,Y:125,B:125,M:100,U:100,H:100,Q:100,V:100,W:50,S:50,T:50,L:50}); };
CARRIERS.LH = {star:true, pct:LH_PCT};
CARRIERS.LX = {star:true, pct:LH_PCT};
CARRIERS.OS = {star:true, pct:LH_PCT};
CARRIERS["4Y"] = {star:true, pct:LH_PCT};
delete CARRIERS.LH_TABLE;

// operating-airline grouping (mirrors getCalculator's `when` + effectiveOperator remap)
const AC_GROUP = new Set(["AC","KV","L4","PB","QK","RV","ZX"]);
const LX_REMAP = new Set(["2L","BT","WK"]);
const CODESHARE_ALIAS = {CL:"LH", KA:"CX", NQ:"NH", NI:"TP"};

function resolveOperator(op){
  op = op.toUpperCase();
  if(AC_GROUP.has(op)) return "AC";
  if(LX_REMAP.has(op)) return "LX";
  return op;
}

function getAcTicketSqcMultiplier(fareClass, fareBasis, ticketNumber, originCountry, destCountry, sqcEligible){
  if(!sqcEligible) return 0;
  if(fareBasis){
    if(isAeroplanFareBasis(fareBasis) || (fareClass && ["X","I"].includes(fareClass))) return 0;
    const split = fareBasis.split("/");
    if(split.length>1 && split[1].startsWith("AE")) return 0;
    const trueBasis = split[0];
    const brand = trueBasis.slice(-2).toUpperCase();
    if(["BA","GT"].includes(brand)) return 0;
    if(brand==="TG") return 2;
    if(["FL","CO","LT"].includes(brand)) return ticketNumber.startsWith("014") ? 4 : 2;
    if(["PL","PF","EL","EF"].includes(brand)) return 4;
    const r = getSqcMultiplierFromFareClass(fareBasis, ticketNumber, originCountry, destCountry, sqcEligible);
    if(r!=null) return r;
  }
  if(fareClass){
    const r = getSqcMultiplierFromFareClass(fareClass, ticketNumber, originCountry, destCountry, sqcEligible);
    if(r!=null) return r;
    return 0;
  }
  return null;
}
function getSqcMultiplierFromFareClass(fc, ticketNumber, originCountry, destCountry, sqcEligible){
  if(!sqcEligible) return 0;
  const c = fc.charAt(0).toUpperCase();
  if(["J","C","D","Z","P","O","E","A"].includes(c)) return 4;
  if(["Y","B","M","U","H","Q","V"].includes(c)) return ticketNumber.startsWith("014") ? 4 : 2;
  if(c==="W"){
    const NA = new Set(["Canada","United States"]);
    if(NA.has(originCountry) && NA.has(destCountry)) return ticketNumber.startsWith("014") ? 4 : 2;
    return 2;
  }
  if(["S","T","L","K","G"].includes(c)) return 2;
  return null;
}

// Computes one segment's earning "shape" given full itinerary context.
// Returns a descriptor; eligibleDollars gets filled in a second pass.
function computeSegmentShape(seg, ticketNumber, effOp){
  const ctx = {
    origin: seg.orig, destination: seg.dest,
    originCountry: seg.originCountry, destinationCountry: seg.destinationCountry,
    originContinent: seg.originContinent, destinationContinent: seg.destinationContinent,
    ticketNumber,
  };
  const isAcLqmEligible = effOp === "AC";

  if(effOp === "AC"){
    // forced AC path: always dollar+brand method, always elite-bonus-eligible
    const mult = getAcTicketSqcMultiplier(seg.fareClass||null, seg.fareBrand||null, ticketNumber, seg.originCountry, seg.destinationCountry, true);
    if(mult == null) return {kind:'unknown', isAcLqmEligible};
    return {kind:'ac-dollar', sqcMultiplier:mult, isAcLqmEligible};
  }

  const carrier = CARRIERS[effOp];
  if(!carrier){
    // unrecognized / non-partner airline
    if(!seg.fareClass) return {kind:'unknown', isAcLqmEligible:false};
    if(ticketNumber.startsWith("014")) return {kind:'nonstar-ac-ticket', isAcLqmEligible:false};
    return {kind:'zero', isAcLqmEligible:false}; // nonPartnerCalculator always 0%
  }

  if(!seg.fareClass) return {kind:'unknown', isAcLqmEligible:false};

  const sqcEligible = carrier.sqcEligible ? carrier.sqcEligible(seg.fareClass) : true;
  const pct = carrier.pct(seg.fareClass, ctx);

  if(carrier.star){
    if(pct === 0) return {kind:'zero', isAcLqmEligible:false};
    if(ticketNumber.startsWith("014")){
      const mult = getAcTicketSqcMultiplier(seg.fareClass||null, seg.fareBrand||null, ticketNumber, seg.originCountry, seg.destinationCountry, sqcEligible);
      if(mult == null) return {kind:'unknown', isAcLqmEligible:false};
      return {kind:'ac-dollar', sqcMultiplier:mult, isAcLqmEligible:false};
    }
    return {kind:'star-distance', pct, isAcLqmEligible:false};
  } else {
    if(pct === 0) return {kind:'zero', isAcLqmEligible:false};
    if(ticketNumber.startsWith("014")) return {kind:'nonstar-ac-ticket', isAcLqmEligible:false};
    return {kind:'nonstar-other', pct, isAcLqmEligible:false};
  }
}

function computeLqm(seg, eliteBonusMultiplier, isAcLqmEligible){
  if(!isAcLqmEligible) return 0;
  const dist = seg.distance;
  if(dist == null) return null;
  const minimum = eliteBonusMultiplier > 0 ? 250 : 0;
  const fareBasis = seg.fareBrand || null;
  const fareClass = seg.fareClass || null;
  let multiplier;
  if(fareBasis){
    const split = fareBasis.split("/");
    const trueBasis = split[0];
    const brand = trueBasis.slice(-2).toUpperCase();
    if(["BA","GT"].includes(brand)) multiplier = 0;
    else if(isAeroplanFareBasis(fareBasis)) multiplier = 0;
    else if(fareClass && ["X","I"].includes(fareClass)) multiplier = 0;
    else if(split.length>1 && split[1].startsWith("AE")) multiplier = 0;
    else if(fareClass && ["J","C","D","Z","P"].includes(fareClass)) multiplier = 1.5;
    else if(fareClass && ["O","E","A"].includes(fareClass)) multiplier = 1.25;
    else multiplier = 1.0;
  } else if(fareClass && ["X","I"].includes(fareClass)){
    multiplier = 0;
  } else if(fareClass && ["J","C","D","Z","P"].includes(fareClass)){
    multiplier = 1.5;
  } else if(fareClass && ["O","E","A"].includes(fareClass)){
    multiplier = 1.25;
  } else {
    multiplier = 1.0;
  }
  const baseDistance = Math.max(minimum, dist);
  return Math.round(baseDistance * multiplier);
}

function computeItinerary(segments, ticketNumber, eliteStatus){
  const eliteBonusMultiplier = getEliteBonusMultiplier(eliteStatus);
  const effOps = segments.map(s => resolveOperator(s.airline || ""));
  const shapes = segments.map((s,i) => computeSegmentShape(s, ticketNumber, effOps[i]));

  const allHaveDistance = segments.every(s => s.distance != null);
  const totalDistance = segments.reduce((sum,s) => sum + (s.distance||0), 0);
  const totalFare = (parseFloat(document.getElementById('baseFare').value)||0) + (parseFloat(document.getElementById('surcharge').value)||0);

  const results = segments.map((seg, i) => {
    const shape = shapes[i];
    let eligibleDollars = null;
    if((shape.kind==='ac-dollar' || shape.kind==='nonstar-ac-ticket') && allHaveDistance && seg.distance != null && totalDistance > 0){
      eligibleDollars = Math.ceil(seg.distance * totalFare / totalDistance);
    }

    let sqc=null, basePoints=null, bonusPoints=null, totalPoints=null;

    if(shape.kind === 'ac-dollar'){
      basePoints = eligibleDollars;
      sqc = eligibleDollars != null ? eligibleDollars * shape.sqcMultiplier : null;
      bonusPoints = eligibleDollars != null ? eligibleDollars * eliteBonusMultiplier : null;
      totalPoints = (basePoints!=null && bonusPoints!=null) ? basePoints + bonusPoints : null;
    } else if(shape.kind === 'nonstar-ac-ticket'){
      basePoints = eligibleDollars;
      sqc = 0; bonusPoints = 0;
      totalPoints = basePoints;
    } else if(shape.kind === 'star-distance'){
      if(seg.distance != null){
        const minimum = eliteBonusMultiplier > 0 ? 250 : 0; // uses AC-elite-bonus as proxy for "isAcElite"
        const adjusted = Math.max(minimum, seg.distance);
        basePoints = Math.trunc(adjusted * shape.pct / 100);
        sqc = Math.trunc(basePoints / 5);
      }
      bonusPoints = 0;
      totalPoints = basePoints;
    } else if(shape.kind === 'nonstar-other'){
      if(seg.distance != null){
        basePoints = Math.trunc(seg.distance * shape.pct); // matches source: no /100 here
      }
      sqc = 0; bonusPoints = 0;
      totalPoints = basePoints;
    } else if(shape.kind === 'zero'){
      sqc = 0; basePoints = 0; bonusPoints = 0; totalPoints = 0;
    }
    // 'unknown': everything stays null

    const lqm = computeLqm(seg, eliteBonusMultiplier, shape.isAcLqmEligible);

    return {shape, eligibleDollars, sqc, basePoints, bonusPoints, totalPoints, lqm};
  });

  const sumOrNull = (key) => results.every(r=>r[key]!=null) ? results.reduce((s,r)=>s+r[key],0) : null;
  return {
    perSegment: results,
    totals: {
      sqc: sumOrNull('sqc'),
      basePoints: sumOrNull('basePoints'),
      bonusPoints: sumOrNull('bonusPoints'),
      totalPoints: sumOrNull('totalPoints'),
      lqm: sumOrNull('lqm'),
    }
  };
}
