/* ============================================================
   DISTANCE / COUNTRY / CONTINENT DATA (live-fetched)
   ============================================================ */
let airportIndex = {};       // code -> {lat, lon, country}
let distanceIndex = {};      // "ORIG-DEST" -> miles
let countryContinent = {};   // country -> continent

function haversineMiles(lat1,lon1,lat2,lon2){
  const R=3958.8;
  const toRad = d=>d*Math.PI/180;
  const dLat = toRad(lat2-lat1), dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R * 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function lookupDistance(orig, dest){
  orig=(orig||'').toUpperCase().trim(); dest=(dest||'').toUpperCase().trim();
  if(!orig||!dest) return {distance:null, source:'none'};
  const key1 = orig+'-'+dest, key2 = dest+'-'+orig;
  if(distanceIndex[key1]!=null) return {distance:distanceIndex[key1], source:'auto'};
  if(distanceIndex[key2]!=null) return {distance:distanceIndex[key2], source:'auto'};
  const a1 = airportIndex[orig], a2 = airportIndex[dest];
  if(a1 && a2 && isFinite(a1.lat) && isFinite(a2.lat)){
    return {distance: Math.round(haversineMiles(a1.lat,a1.lon,a2.lat,a2.lon)), source:'auto'};
  }
  return {distance:null, source:'none'};
}

/* ============================================================
   UI STATE + RENDER
   ============================================================ */
let state = { ticketType:'014', elite:0, segments:[] };
let segIdCounter = 0;
function makeSegment(){
  segIdCounter++;
  return { id:segIdCounter, airline:'AC', orig:'', dest:'', fareClass:'', fareBrand:'', distance:null, distSource:'none' };
}
function addSegment(){ state.segments.push(makeSegment()); render(); }
function removeSegment(id){ state.segments = state.segments.filter(s=>s.id!==id); render(); }

function fmt(n){ if(n==null || isNaN(n)) return '—'; return Math.round(n).toLocaleString(); }

function airportHint(code, country){
  code = (code||'').toUpperCase().trim();
  if(!code) return '';
  if(Object.keys(airportIndex).length === 0) return ''; // data hasn't loaded yet, don't flag prematurely
  return country
    ? `<div class="hint hint-ok">${country}</div>`
    : `<div class="hint hint-bad">Not a recognized airport code</div>`;
}

const KIND_LABEL = {
  'ac-dollar':'AC $ + brand', 'nonstar-ac-ticket':'014 · non-star $',
  'star-distance':'Partner · distance %', 'nonstar-other':'Non-star · distance',
  'zero':'Not eligible', 'unknown':'Need more info',
};

// AC's dollar+brand method falls back to fare class via getSqcMultiplierFromFareClass, not a pct table
const AC_FALLBACK_CLASSES = ['J','C','D','Z','P','O','E','A','Y','B','M','U','H','Q','V','W','S','T','L','K','G'];
function getValidFareClasses(effOp, ctx){
  if(effOp === 'AC') return AC_FALLBACK_CLASSES;
  const carrier = CARRIERS[effOp];
  if(!carrier) return [];
  return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(l => {
    try { return carrier.pct(l, ctx) > 0; } catch(e){ return false; }
  });
}

function render(){
  const segWrap = document.getElementById('segments');
  segWrap.innerHTML = '';
  const ticketNumber = state.ticketType === '014' ? '0141234567890' : '1251234567890';

  state.segments.forEach(seg=>{
    if(seg.distSource !== 'manual'){
      const dl = lookupDistance(seg.orig, seg.dest);
      if(dl.source==='auto'){ seg.distance = dl.distance; seg.distSource='auto'; }
      else { seg.distance = null; seg.distSource='none'; }
    }
    const ap1 = airportIndex[(seg.orig||'').toUpperCase()];
    const ap2 = airportIndex[(seg.dest||'').toUpperCase()];
    seg.originCountry = ap1 ? ap1.country : undefined;
    seg.destinationCountry = ap2 ? ap2.country : undefined;
    seg.originContinent = countryContinent[seg.originCountry];
    seg.destinationContinent = countryContinent[seg.destinationCountry];
  });

  const totalFare = (parseFloat(document.getElementById('baseFare').value)||0) + (parseFloat(document.getElementById('surcharge').value)||0);
  const itin = computeItinerary(state.segments, ticketNumber, state.elite, totalFare);

  state.segments.forEach((seg, idx)=>{
    const r = itin.perSegment[idx];
    const card = document.createElement('div');
    card.className='segcard';
    const badgeClass = seg.distSource==='auto' ? 'badge-auto' : seg.distSource==='manual' ? 'badge-manual' : 'badge-none';
    const badgeLabel = seg.distSource==='auto' ? 'AUTO' : seg.distSource==='manual' ? 'MANUAL' : 'NO DATA';
    const effOp = resolveOperator(seg.airline || '');
    const ctx = {
      origin: seg.orig, destination: seg.dest,
      originCountry: seg.originCountry, destinationCountry: seg.destinationCountry,
      originContinent: seg.originContinent, destinationContinent: seg.destinationContinent,
      ticketNumber,
    };
    const fareClasses = getValidFareClasses(effOp, ctx);
    const fareClassListId = `fareClassList-${seg.id}`;

    card.innerHTML = `
      <div class="segcard-head">
        <span class="segnum">SEG ${idx+1}</span>
        <span class="seg-route mono">${(seg.orig||'???').toUpperCase()} → ${(seg.dest||'???').toUpperCase()}</span>
        <button class="removeSeg" data-id="${seg.id}">✕</button>
      </div>
      <div class="row3">
        <div class="field"><label>Operating</label><input type="text" maxlength="3" class="mono segInput" data-field="airline" data-id="${seg.id}" value="${seg.airline}" placeholder="AC" list="airlineList" autocomplete="off"></div>
        <div class="field"><label>Origin</label><input type="text" maxlength="4" class="mono segInput" data-field="orig" data-id="${seg.id}" value="${seg.orig}" placeholder="YYZ">${airportHint(seg.orig, seg.originCountry)}</div>
        <div class="field"><label>Destination</label><input type="text" maxlength="4" class="mono segInput" data-field="dest" data-id="${seg.id}" value="${seg.dest}" placeholder="YVR">${airportHint(seg.dest, seg.destinationCountry)}</div>
      </div>
      <div class="row2">
        <div class="field"><label>Fare class</label><input type="text" maxlength="2" class="mono segInput" data-field="fareClass" data-id="${seg.id}" value="${seg.fareClass}" placeholder="K" list="${fareClassListId}" autocomplete="off"></div>
        <div class="field"><label>Fare brand / basis</label><input type="text" maxlength="12" class="mono segInput" data-field="fareBrand" data-id="${seg.id}" value="${seg.fareBrand}" placeholder="CO (optional)" list="fareBrandList" autocomplete="off"></div>
      </div>
      <datalist id="${fareClassListId}">${fareClasses.map(c=>`<option value="${c}">`).join('')}</datalist>
      <div class="distance-strip">
        <span>Distance: <span class="val mono">${seg.distance!=null ? seg.distance.toLocaleString()+' mi' : 'enter below'}</span></span>
        <span class="badge ${badgeClass}">${badgeLabel}</span>
      </div>
      <div class="field" style="margin-top:8px;">
        <input type="number" min="0" class="mono segInput" data-field="distanceManual" data-id="${seg.id}" placeholder="Override distance (mi)" value="${seg.distSource==='manual' ? seg.distance : ''}">
      </div>
      <div class="earn-kind"><span class="tag">${KIND_LABEL[r.shape.kind]}</span>${r.shape.sqcMultiplier!=null ? `<span>SQC ×${r.shape.sqcMultiplier}</span>`:''}${r.shape.pct!=null ? `<span>${r.shape.pct}% of distance</span>`:''}</div>
      <div class="seg-result">
        <div class="cell"><div class="n">${fmt(r.sqc)}</div><div class="l">SQC</div></div>
        <div class="cell"><div class="n">${fmt(r.totalPoints)}</div><div class="l">Points</div></div>
        <div class="cell"><div class="n">${fmt(r.lqm)}</div><div class="l">LQM</div></div>
      </div>
    `;
    segWrap.appendChild(card);
  });

  if(state.segments.length===0){
    segWrap.innerHTML = `<div class="hint" style="text-align:center; padding:18px 0;">No segments yet. Add your first flight below.</div>`;
  }

  updateTotals(itin.totals);
  wireSegmentInputs();
}

function updateTotals(totals){
  const sqcEl = document.getElementById('totalSQC');
  const ptsEl = document.getElementById('totalPoints');
  const lqmEl = document.getElementById('totalLqm');
  sqcEl.textContent = fmt(totals.sqc);
  ptsEl.textContent = fmt(totals.totalPoints);
  lqmEl.textContent = fmt(totals.lqm);
  [sqcEl,ptsEl,lqmEl].forEach(el=>{ el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); });
}

function wireSegmentInputs(){
  document.querySelectorAll('.removeSeg').forEach(btn=>{ btn.onclick = ()=> removeSegment(parseInt(btn.dataset.id)); });
  document.querySelectorAll('.segInput').forEach(inp=>{
    inp.oninput = ()=>{
      const seg = state.segments.find(s=>s.id===parseInt(inp.dataset.id));
      if(!seg) return;
      const field = inp.dataset.field;
      if(field==='distanceManual'){
        const v = parseFloat(inp.value);
        if(inp.value===''){ seg.distSource='none'; seg.distance=null; }
        else { seg.distance = Math.max(0, v); seg.distSource='manual'; }
      } else if(['airline','orig','dest','fareClass','fareBrand'].includes(field)){
        seg[field] = inp.value.toUpperCase();
      } else {
        seg[field] = inp.value;
      }
      render();
      const again = document.querySelector(`[data-id="${seg.id}"][data-field="${field}"]`);
      if(again){ again.focus(); if(again.setSelectionRange && again.value){ const p=again.value.length; try{again.setSelectionRange(p,p);}catch(e){} } }
    };
  });
}

// display names sourced from cowtool-llc/ac-sqd's getCalculator() comments
const AIRLINE_NAMES = {
  AC:'Air Canada', A3:'Aegean Airlines', AD:'Azul Airlines', AI:'Air India', AV:'Avianca',
  BR:'EVA Air', CA:'Air China', CM:'Copa Airlines', CX:'Cathay Pacific', EK:'Emirates',
  EN:'Air Dolomiti', ET:'Ethiopian Airlines', EW:'Eurowings', EY:'Etihad Airways', G3:'GOL',
  GF:'Gulf Air', HO:'Juneyao Airlines', LH:'Lufthansa', LO:'LOT Polish Airlines', LX:'Swiss',
  MK:'Air Mauritius', MS:'EgyptAir', NH:'ANA', NZ:'Air New Zealand', OA:'Olympic Air',
  OS:'Austrian Airlines', OU:'Croatia Airlines', OZ:'Asiana Airlines', QH:'Bamboo Airways',
  SA:'South African Airways', SN:'Brussels Airlines', SQ:'Singapore Airlines', TG:'Thai Airways',
  TK:'Turkish Airlines', TP:'TAP Air Portugal', UA:'United Airlines', UK:'Vistara',
  VA:'Virgin Australia', VL:'Lufthansa City Airlines', WY:'Oman Air', YN:'Air Creebec',
  ZH:'Shenzhen Airlines', '3H':'Air Inuit', '4Y':'Eurowings Discover', '5T':'Canadian North',
  CL:'Lufthansa (codeshare)', KA:'Cathay Pacific (codeshare)', NQ:'ANA (codeshare)', NI:'TAP Air Portugal (codeshare)',
};
function populateAirlineDatalist(){
  const dl = document.getElementById('airlineList');
  const codes = new Set([...Object.keys(CARRIERS), ...AC_GROUP, ...LX_REMAP]);
  dl.innerHTML = [...codes].sort().map(code => {
    const name = AIRLINE_NAMES[code] || (AC_GROUP.has(code) ? 'Air Canada (regional/codeshare)' : LX_REMAP.has(code) ? 'Swiss (codeshare)' : '');
    return `<option value="${code}"${name ? ` label="${name}"` : ''}>`;
  }).join('');
}
populateAirlineDatalist();

// mirrors the brand -> SQC multiplier rules in getAcTicketSqcMultiplier (calc.js)
const FARE_BRAND_HINTS = {
  BA:'0× SQC', GT:'0× SQC', TG:'2× SQC',
  FL:'4× SQC if 014-ticketed, else 2×', CO:'4× SQC if 014-ticketed, else 2×', LT:'4× SQC if 014-ticketed, else 2×',
  PL:'4× SQC', PF:'4× SQC', EL:'4× SQC', EF:'4× SQC',
};
function populateFareBrandDatalist(){
  const dl = document.getElementById('fareBrandList');
  dl.innerHTML = Object.keys(FARE_BRAND_HINTS).sort().map(code =>
    `<option value="${code}" label="${FARE_BRAND_HINTS[code]}">`
  ).join('');
}
populateFareBrandDatalist();

function clampNonNegative(el){ if(el.value !== '' && parseFloat(el.value) < 0) el.value = 0; }

document.getElementById('addSegBtn').onclick = addSegment;
document.getElementById('baseFare').oninput = (e)=>{ clampNonNegative(e.target); render(); };
document.getElementById('surcharge').oninput = (e)=>{ clampNonNegative(e.target); render(); };
document.getElementById('ticketType').addEventListener('click', (e)=>{
  const pill = e.target.closest('.pill'); if(!pill) return;
  [...pill.parentElement.children].forEach(c=>c.classList.remove('active'));
  pill.classList.add('active');
  state.ticketType = pill.dataset.val;
  render();
});
document.getElementById('eliteStatus').addEventListener('click', (e)=>{
  const pill = e.target.closest('.pill'); if(!pill) return;
  [...pill.parentElement.children].forEach(c=>c.classList.remove('active'));
  pill.classList.add('active');
  state.elite = parseInt(pill.dataset.val);
  render();
});

function setStatus(msg, cls){
  const el = document.getElementById('dataStatus');
  el.textContent = '● ' + msg;
  el.className = cls;
}

async function loadData(){
  setStatus('loading live distance + country data…', 'st-wait');
  try {
    const [airportsTxt, distTxt, countryTxt] = await Promise.all([
      fetch('https://raw.githubusercontent.com/cowtool-llc/ac-sqd/main/src/main/resources/airports.csv').then(r=>{ if(!r.ok) throw new Error('airports'); return r.text(); }),
      fetch('https://raw.githubusercontent.com/cowtool-llc/ac-sqd/main/src/main/resources/aeroplan_distances.csv').then(r=>{ if(!r.ok) throw new Error('distances'); return r.text(); }),
      fetch('https://raw.githubusercontent.com/cowtool-llc/ac-sqd/main/src/main/resources/country_continents.csv').then(r=>{ if(!r.ok) throw new Error('countries'); return r.text(); }),
    ]);

    const airp = Papa.parse(airportsTxt, {header:true, skipEmptyLines:true});
    const cols = airp.meta.fields || [];
    const codeCol = cols.find(c=>/^(code|iata)$/i.test(c)) || cols.find(c=>/code/i.test(c));
    const latCol = cols.find(c=>/^lat/i.test(c));
    const lonCol = cols.find(c=>/^lon|^lng/i.test(c));
    const countryCol = cols.find(c=>/country/i.test(c));
    if(codeCol){
      airp.data.forEach(row=>{
        const code = (row[codeCol]||'').toUpperCase().trim();
        if(!code) return;
        const lat = latCol ? parseFloat(row[latCol]) : NaN;
        const lon = lonCol ? parseFloat(row[lonCol]) : NaN;
        const country = countryCol ? (row[countryCol]||'').trim() : undefined;
        airportIndex[code] = {lat, lon, country};
      });
    }

    const dist = Papa.parse(distTxt, {header:true, skipEmptyLines:true});
    const dcols = dist.meta.fields || [];
    const oCol = dcols.find(c=>/orig/i.test(c));
    const dCol = dcols.find(c=>/dest/i.test(c));
    const miCol = dcols.find(c=>/dist|mile/i.test(c));
    if(oCol && dCol && miCol){
      dist.data.forEach(row=>{
        const o = (row[oCol]||'').toUpperCase().trim();
        const d = (row[dCol]||'').toUpperCase().trim();
        const m = parseFloat(row[miCol]);
        if(o && d && isFinite(m)) distanceIndex[o+'-'+d] = m;
      });
    }

    const ctry = Papa.parse(countryTxt, {header:true, skipEmptyLines:true});
    const ccols = ctry.meta.fields || [];
    const countryNameCol = ccols.find(c=>/^country/i.test(c)) || ccols.find(c=>/country/i.test(c));
    const continentCol = ccols.find(c=>/continent/i.test(c));
    if(countryNameCol && continentCol){
      ctry.data.forEach(row=>{
        const c = (row[countryNameCol]||'').trim();
        const cont = (row[continentCol]||'').trim();
        if(c) countryContinent[c] = cont;
      });
    }

    const airportCount = Object.keys(airportIndex).length;
    const distCount = Object.keys(distanceIndex).length;
    const countryCount = Object.keys(countryContinent).length;
    if(airportCount>0){
      setStatus(`live data loaded: ${airportCount.toLocaleString()} airports, ${distCount.toLocaleString()} routes, ${countryCount.toLocaleString()} countries`, 'st-ok');
    } else {
      setStatus('data fetched but columns unrecognized, use manual distance entry', 'st-bad');
    }
  } catch(err){
    setStatus('could not reach GitHub from this browser, use manual distance entry; country-dependent partner rules will be unavailable', 'st-bad');
  }
  render();
}

state.segments.push(makeSegment());
render();
loadData();
