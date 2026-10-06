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
let dataState = 'loading';   // 'loading' | 'ok' | 'bad'
const segEls = new Map();    // segment id -> {li, out, inputs, chips, chipKeys}

function makeSegment(){
  segIdCounter++;
  return { id:segIdCounter, airline:'AC', orig:'', dest:'', fareClass:'', fareBrand:'', distance:null, distSource:'none', open:true, editDist:false };
}
function addSegment(focus){
  state.segments.forEach(s=>{ s.open = false; });
  const seg = makeSegment();
  state.segments.push(seg);
  const els = createSegEl(seg);
  document.getElementById('segments').appendChild(els.li);
  update();
  if(focus) els.inputs.orig.focus();
}
function removeSegment(id){
  state.segments = state.segments.filter(s=>s.id!==id);
  const els = segEls.get(id);
  if(els){ els.li.remove(); segEls.delete(id); }
  update();
  document.getElementById('addSegBtn').focus();
}

function fmt(n){ if(n==null || isNaN(n)) return '—'; return Math.round(n).toLocaleString(); }
function esc(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function setText(el, text){ if(el.textContent !== text) el.textContent = text; }

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
function airlineOptionsHtml(selected){
  const codes = new Set([...Object.keys(CARRIERS), ...AC_GROUP, ...LX_REMAP]);
  return [...codes].sort().map(code => {
    const name = AIRLINE_NAMES[code] || (AC_GROUP.has(code) ? 'Air Canada (regional/codeshare)' : LX_REMAP.has(code) ? 'Swiss (codeshare)' : '');
    const label = name ? `${code} — ${name}` : code;
    return `<option value="${code}"${code===selected ? ' selected' : ''}>${label}</option>`;
  }).join('');
}

// names per cowtool's published brand code list; GT isn't in that list but is still
// checked in the upstream calculation engine (getAcTicketSqcMultiplier), so it's kept
// functionally but without a documented display name.
const FARE_BRAND_INFO = {
  BA:{name:'Basic', mult:'0× SQC'},
  GT:{name:null, mult:'0× SQC'},
  TG:{name:'Standard', mult:'2× SQC'},
  FL:{name:'Flex', mult:'4× SQC if 014-ticketed, else 2×'},
  CO:{name:'Comfort', mult:'4× SQC if 014-ticketed, else 2×'},
  LT:{name:'Latitude', mult:'4× SQC if 014-ticketed, else 2×'},
  PL:{name:'Premium Economy (Lowest)', mult:'4× SQC'},
  PF:{name:'Premium Economy (Flexible)', mult:'4× SQC'},
  EL:{name:'Business Class (Lowest)', mult:'4× SQC'},
  EF:{name:'Business Class (Flexible)', mult:'4× SQC'},
};
const FARE_BRAND_CHIPS = Object.keys(FARE_BRAND_INFO).sort().map(c=>{
  const info = FARE_BRAND_INFO[c];
  return {value:c, title: info.name ? `${info.name}: ${info.mult}` : info.mult};
});
document.getElementById('fareBrandLegend').innerHTML = Object.keys(FARE_BRAND_INFO).sort().map(code => {
  const info = FARE_BRAND_INFO[code];
  return `<div class="legend-row"><span class="legend-code">${code}</span><span class="legend-name">${info.name || '—'}</span><span class="legend-mult">${info.mult}</span></div>`;
}).join('');

// Built once per segment; update() then patches text in place so inputs keep focus.
function createSegEl(seg){
  const li = document.createElement('li');
  li.className = 'seg';
  li.dataset.id = seg.id;
  const p = `seg${seg.id}`;
  li.innerHTML = `
    <button type="button" class="seg-row" data-act="toggle" aria-controls="${p}-body">
      <span class="seg-idx" data-out="idx"></span>
      <span class="seg-route"><span data-out="orig"></span><span class="seg-line" aria-hidden="true"></span><span data-out="dest"></span></span>
      <span class="seg-meta" data-out="meta"></span>
      <span class="seg-dist" data-out="rowDist"></span>
      <span class="seg-sqc" data-out="rowSqc"></span>
      <span class="seg-chev" aria-hidden="true"></span>
    </button>
    <div class="seg-body" id="${p}-body">
      <div class="grid3">
        <div class="field"><label for="${p}-airline">Operated by</label><select id="${p}-airline" data-field="airline">${airlineOptionsHtml(seg.airline)}</select></div>
        <div class="field"><label for="${p}-orig">From</label><input type="text" id="${p}-orig" maxlength="4" class="code-input" data-field="orig" placeholder="YYZ" autocomplete="off" autocapitalize="characters" spellcheck="false"><p class="hint" data-out="origHint"></p></div>
        <div class="field"><label for="${p}-dest">To</label><input type="text" id="${p}-dest" maxlength="4" class="code-input" data-field="dest" placeholder="YVR" autocomplete="off" autocapitalize="characters" spellcheck="false"><p class="hint" data-out="destHint"></p></div>
      </div>
      <div class="grid2 seg-fares">
        <div class="field">
          <label for="${p}-fareClass">Fare class</label>
          <input type="text" id="${p}-fareClass" maxlength="2" class="code-input" data-field="fareClass" placeholder="K" autocomplete="off" autocapitalize="characters" spellcheck="false">
          <div class="chips" data-chips="fareClass" role="group" aria-label="Fare classes that earn on this airline"></div>
        </div>
        <div class="field">
          <label for="${p}-fareBrand">Fare brand or basis <span class="opt">(optional)</span></label>
          <input type="text" id="${p}-fareBrand" maxlength="12" class="code-input" data-field="fareBrand" placeholder="CO" autocomplete="off" autocapitalize="characters" spellcheck="false">
          <div class="chips" data-chips="fareBrand" role="group" aria-label="Fare brand codes"></div>
        </div>
      </div>
      <div class="dist">
        <span>Distance <span class="dist-val" data-out="distVal"></span></span>
        <span class="dist-src" data-out="distSrc"></span>
        <button type="button" class="linkbtn" data-act="editDist" data-out="distBtn"></button>
        <div class="dist-edit" data-out="distEdit">
          <label for="${p}-distance">Distance in miles</label>
          <input type="number" id="${p}-distance" min="0" inputmode="numeric" data-field="distanceManual">
        </div>
      </div>
      <div class="seg-foot">
        <p class="rule" data-out="rule"></p>
        <dl class="seg-earn">
          <div><dd data-out="sqc"></dd><dt>SQC</dt></div>
          <div><dd data-out="points"></dd><dt>Points</dt></div>
          <div><dd data-out="lqm"></dd><dt>LQM</dt></div>
        </dl>
        <button type="button" class="linkbtn danger" data-act="remove">Remove this flight</button>
      </div>
    </div>`;
  const els = { li, out:{}, inputs:{}, chips:{}, chipKeys:{} };
  li.querySelectorAll('[data-out]').forEach(el=>{ els.out[el.dataset.out] = el; });
  li.querySelectorAll('[data-field]').forEach(el=>{ els.inputs[el.dataset.field] = el; });
  li.querySelectorAll('[data-chips]').forEach(el=>{ els.chips[el.dataset.chips] = el; });
  els.row = li.querySelector('.seg-row');
  segEls.set(seg.id, els);
  return els;
}

function patchChips(els, field, items, selected){
  const wrap = els.chips[field];
  const key = items.map(it=>it.value).join(',');
  if(els.chipKeys[field] !== key){
    els.chipKeys[field] = key;
    wrap.innerHTML = items.map(it =>
      `<button type="button" class="chip" data-chip-field="${field}" data-chip-value="${it.value}"${it.title ? ` title="${esc(it.title)}"` : ''}>${it.value}</button>`
    ).join('');
    wrap.hidden = !items.length;
  }
  wrap.querySelectorAll('.chip').forEach(chip=>{
    chip.setAttribute('aria-pressed', chip.dataset.chipValue === selected ? 'true' : 'false');
  });
}

function patchAirportHint(el, code, country){
  // only judge a code once data has loaded and it's long enough to be one
  if(code.length < 3 || dataState !== 'ok'){ setText(el, ''); el.className = 'hint'; return; }
  setText(el, country || 'Not a recognized airport code');
  el.className = country ? 'hint hint-ok' : 'hint hint-bad';
}

function ruleText(seg, r){
  const s = r.shape;
  const dollars = r.eligibleDollars != null ? `$${fmt(r.eligibleDollars)} of the fare` : null;
  const needDist = 'Every flight needs a distance before the fare can be split.';
  switch(s.kind){
    case 'ac-dollar':
      return dollars ? `Earns on dollars spent: ${dollars} at ${s.sqcMultiplier}× SQC.` : `Earns on dollars spent at ${s.sqcMultiplier}× SQC. ${needDist}`;
    case 'nonstar-ac-ticket':
      return dollars ? `Air Canada ticket on a non–Star Alliance partner: points on ${dollars}, no SQC.` : `Air Canada ticket on a non–Star Alliance partner: points on dollars spent, no SQC. ${needDist}`;
    case 'star-distance':
      return `Partner flight: points are ${s.pct}% of the distance flown, and SQC is points ÷ 5.`;
    case 'nonstar-other':
      return `Non–Star Alliance partner: points are ${s.pct}% of the distance flown, no SQC.`;
    case 'zero':
      return 'This fare does not earn SQC or points.';
    default:
      if(!seg.fareClass && !seg.fareBrand) return 'Add a fare class to see what this flight earns.';
      if(!seg.orig || !seg.dest) return 'Add both airports to see what this flight earns.';
      return 'This flight needs more detail before earnings can be worked out.';
  }
}

function patchSeg(seg, idx, r, ticketNumber){
  const els = segEls.get(seg.id);
  const o = els.out;
  els.li.classList.toggle('open', seg.open);
  els.row.setAttribute('aria-expanded', seg.open ? 'true' : 'false');

  // collapsed row
  setText(o.idx, String(idx+1));
  setText(o.orig, seg.orig || '···'); o.orig.className = seg.orig ? '' : 'blank';
  setText(o.dest, seg.dest || '···'); o.dest.className = seg.dest ? '' : 'blank';
  o.meta.innerHTML = [seg.airline, seg.fareClass, seg.fareBrand].filter(Boolean).map(v=>`<span>${esc(v)}</span>`).join('');
  setText(o.rowDist, seg.distance != null ? `${seg.distance.toLocaleString()} mi` : '');
  o.rowSqc.innerHTML = `${fmt(r.sqc)}<small>SQC</small>`;

  // editor
  patchAirportHint(o.origHint, seg.orig, seg.originCountry);
  patchAirportHint(o.destHint, seg.dest, seg.destinationCountry);
  const effOp = resolveOperator(seg.airline || '');
  const ctx = {
    origin: seg.orig, destination: seg.dest,
    originCountry: seg.originCountry, destinationCountry: seg.destinationCountry,
    originContinent: seg.originContinent, destinationContinent: seg.destinationContinent,
    ticketNumber,
  };
  patchChips(els, 'fareClass', getValidFareClasses(effOp, ctx).map(c=>({value:c})), seg.fareClass);
  patchChips(els, 'fareBrand', FARE_BRAND_CHIPS, seg.fareBrand);

  const bothCodes = seg.orig.length >= 3 && seg.dest.length >= 3;
  const manual = seg.distSource === 'manual';
  const missing = seg.distSource === 'none' && bothCodes && dataState !== 'loading';
  setText(o.distVal, seg.distance != null ? `${seg.distance.toLocaleString()} mi` : '—');
  setText(o.distSrc, manual ? 'entered by you'
    : seg.distSource === 'auto' ? 'from route data'
    : missing ? 'No distance on file for this route. Enter it below.'
    : 'appears once both airports are filled in');
  setText(o.distBtn, manual ? 'Use route data instead' : seg.editDist ? 'Cancel' : 'Enter it yourself');
  o.distBtn.hidden = missing && !manual;
  o.distEdit.hidden = !(manual || missing || seg.editDist);

  setText(o.rule, ruleText(seg, r));
  setText(o.sqc, fmt(r.sqc));
  setText(o.points, fmt(r.totalPoints));
  setText(o.lqm, fmt(r.lqm));
}

function update(){
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

  state.segments.forEach((seg, idx)=> patchSeg(seg, idx, itin.perSegment[idx], ticketNumber));
  document.getElementById('segEmpty').hidden = state.segments.length > 0;
  document.getElementById('segments').hidden = state.segments.length === 0;
  updateTally(itin);
}

function updateTally(itin){
  const totals = itin.totals;
  [['totalSQC', totals.sqc], ['totalPoints', totals.totalPoints], ['totalLqm', totals.lqm]].forEach(([id, val])=>{
    const el = document.getElementById(id);
    const text = fmt(val);
    if(el.textContent === text) return;
    el.textContent = text;
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  });

  const incomplete = state.segments.length > 0 && (totals.sqc == null || totals.totalPoints == null || totals.lqm == null);
  const note = document.getElementById('tallyNote');
  note.hidden = !incomplete;
  setText(note, incomplete ? 'Some flights are missing details, so the totals are incomplete.' : '');

  document.getElementById('breakdownBody').innerHTML = state.segments.length
    ? state.segments.map((seg, i)=>{
        const r = itin.perSegment[i];
        return `<tr><td>${esc(seg.orig || '···')}–${esc(seg.dest || '···')}</td><td>${fmt(r.sqc)}</td><td>${fmt(r.totalPoints)}</td><td>${fmt(r.lqm)}</td></tr>`;
      }).join('')
    : '<tr><td colspan="4">No flights yet</td></tr>';

  const split = document.getElementById('pointsSplit');
  const hasBonus = totals.basePoints != null && totals.bonusPoints > 0;
  split.hidden = !hasBonus;
  setText(split, hasBonus ? `Points are ${fmt(totals.basePoints)} base plus ${fmt(totals.bonusPoints)} status bonus.` : '');
}

/* ============================================================
   EVENTS
   ============================================================ */
function segFromEvent(e){
  const li = e.target.closest('.seg');
  return li ? state.segments.find(s=>s.id===parseInt(li.dataset.id)) : null;
}
const segWrap = document.getElementById('segments');
segWrap.addEventListener('input', (e)=>{
  const inp = e.target.closest('[data-field]');
  const seg = segFromEvent(e);
  if(!inp || !seg) return;
  const field = inp.dataset.field;
  if(field==='distanceManual'){
    const v = parseFloat(inp.value);
    if(inp.value==='' || isNaN(v)){ seg.distSource='none'; seg.distance=null; }
    else { seg.distance = Math.max(0, v); seg.distSource='manual'; }
    seg.editDist = true;
  } else {
    seg[field] = inp.value.toUpperCase().trim();
  }
  update();
});
segWrap.addEventListener('click', (e)=>{
  const seg = segFromEvent(e);
  if(!seg) return;
  const els = segEls.get(seg.id);
  const chip = e.target.closest('.chip');
  if(chip){
    const field = chip.dataset.chipField;
    // tapping the selected chip again clears it
    seg[field] = seg[field] === chip.dataset.chipValue ? '' : chip.dataset.chipValue;
    els.inputs[field].value = seg[field];
    update();
    return;
  }
  const act = e.target.closest('[data-act]');
  if(!act) return;
  if(act.dataset.act === 'toggle'){
    seg.open = !seg.open;
    update();
  } else if(act.dataset.act === 'remove'){
    removeSegment(seg.id);
  } else if(act.dataset.act === 'editDist'){
    if(seg.distSource === 'manual'){
      seg.distSource = 'none'; seg.distance = null; seg.editDist = false;
      els.inputs.distanceManual.value = '';
    } else {
      seg.editDist = !seg.editDist;
    }
    update();
    if(seg.editDist) els.inputs.distanceManual.focus();
  }
});

function clampNonNegative(el){ if(el.value !== '' && parseFloat(el.value) < 0) el.value = 0; }

document.getElementById('addSegBtn').onclick = ()=> addSegment(true);
document.getElementById('baseFare').oninput = (e)=>{ clampNonNegative(e.target); update(); };
document.getElementById('surcharge').oninput = (e)=>{ clampNonNegative(e.target); update(); };

function wireChoice(id, onPick){
  document.getElementById(id).addEventListener('click', (e)=>{
    const btn = e.target.closest('button'); if(!btn) return;
    [...btn.parentElement.children].forEach(c=>c.setAttribute('aria-pressed', c===btn ? 'true' : 'false'));
    onPick(btn.dataset.val);
    update();
  });
}
wireChoice('ticketType', val=>{ state.ticketType = val; });
wireChoice('eliteStatus', val=>{ state.elite = parseInt(val); });

document.getElementById('tallyToggle').addEventListener('click', (e)=>{
  const open = document.getElementById('tally').classList.toggle('open');
  e.currentTarget.setAttribute('aria-expanded', open ? 'true' : 'false');
  e.currentTarget.textContent = open ? 'Hide' : 'Per flight';
});

function getTheme(){ return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
function applyThemeIcon(){
  const btn = document.getElementById('themeToggle');
  const theme = getTheme();
  btn.textContent = theme === 'light' ? '☾' : '☀';
  btn.setAttribute('aria-label', theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
}
applyThemeIcon();
document.getElementById('themeToggle').addEventListener('click', ()=>{
  const next = getTheme() === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  try{ localStorage.setItem('theme', next); }catch(e){}
  applyThemeIcon();
});

function setStatus(kind, msg, detail){
  dataState = kind;
  const el = document.getElementById('dataStatus');
  el.textContent = msg;
  el.title = kind === 'ok' ? (detail || '') : msg;
  el.className = 'status ' + (kind === 'ok' ? 'st-ok' : kind === 'bad' ? 'st-bad' : 'st-wait');
  const notice = document.getElementById('dataNotice');
  notice.hidden = kind !== 'bad';
  notice.textContent = kind === 'bad' ? detail : '';
}

async function loadData(){
  setStatus('loading', 'Loading route data');
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
      setStatus('ok', 'Route data loaded', `${airportCount.toLocaleString()} airports, ${distCount.toLocaleString()} routes, ${countryCount.toLocaleString()} countries`);
    } else {
      setStatus('bad', 'Route data unreadable', 'Route data loaded but could not be read. Enter each distance yourself.');
    }
  } catch(err){
    setStatus('bad', 'Route data unavailable', 'Could not load route data from GitHub. Enter each distance yourself. Partner rules that depend on country will not work.');
  }
  update();
}

addSegment(false);
loadData();
