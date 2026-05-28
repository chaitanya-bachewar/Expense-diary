'use strict';

/* ────────────────────────────────────────────────────────────
   CONSTANTS
   ──────────────────────────────────────────────────────────── */
const CATS = {
  'Food & Dining':  '#ff9500',
  'Groceries':      '#00ffe7',
  'Transport':      '#b8ff00',
  'Shopping':       '#ff2d78',
  'Utilities':      '#7b61ff',
  'Health':         '#00ff88',
  'Entertainment':  '#ffdd00',
  'Other':          '#888888',
};
const CAT_NAMES = Object.keys(CATS);

/* ────────────────────────────────────────────────────────────
   DB — in-memory, backed by file via electronAPI
   ──────────────────────────────────────────────────────────── */
let DB = { expenses: [], nextId: 1 };

async function loadDB() {
  DB = await window.electronAPI.loadData();
  if (!DB.expenses) DB.expenses = [];
  if (!DB.nextId)   DB.nextId   = 1;
}

async function saveDB() {
  const result = await window.electronAPI.saveData(DB);
  setStatus(result.ok);
}

/* ────────────────────────────────────────────────────────────
   STATUS BAR
   ──────────────────────────────────────────────────────────── */
function setStatus(ok) {
  const dot = document.getElementById('status-dot');
  const txt = document.getElementById('status-text');
  dot.className = ok ? 'status-dot' : 'status-dot fail';
  txt.textContent = ok ? 'FILE SYNCED' : 'WRITE FAILED';
}

/* ────────────────────────────────────────────────────────────
   UTILS
   ──────────────────────────────────────────────────────────── */
function fmt(n)      { return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 }); }
function fmtShort(n) { return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits:0 }); }

function toast(msg, isError) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.borderColor = isError ? 'var(--magenta)' : 'var(--cyan)';
  t.style.color       = isError ? 'var(--magenta)' : 'var(--cyan)';
  t.style.background  = isError ? 'rgba(255,45,120,0.1)' : 'rgba(0,255,231,0.1)';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

function badge(cat) {
  const c = CATS[cat] || CATS['Other'];
  return `<span class="badge" style="color:${c};border-color:${c};background:${c}18">${cat}</span>`;
}

/* ────────────────────────────────────────────────────────────
   NAVIGATION
   ──────────────────────────────────────────────────────────── */
function showTab(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  if (name === 'dashboard') refreshDashboard();
  if (name === 'log')       refreshLog();
  if (name === 'manage')    refreshManage();
}
document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => showTab(btn.dataset.tab)));

/* ────────────────────────────────────────────────────────────
   ADD ENTRY FORM
   ──────────────────────────────────────────────────────────── */
function initAddForm() {
  document.getElementById('f-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('f-cat').innerHTML = CAT_NAMES.map(c => `<option value="${c}">${c}</option>`).join('');
  ['f-qty','f-price'].forEach(id => document.getElementById(id).addEventListener('input', updateLiveTotal));
}

function updateLiveTotal() {
  const qty   = parseFloat(document.getElementById('f-qty').value)   || 0;
  const price = parseFloat(document.getElementById('f-price').value) || 0;
  document.getElementById('live-total').textContent = fmt(qty * price);
}

async function saveEntry() {
  const date  = document.getElementById('f-date').value;
  const cat   = document.getElementById('f-cat').value;
  const item  = document.getElementById('f-item').value.trim();
  const qty   = parseFloat(document.getElementById('f-qty').value);
  const price = parseFloat(document.getElementById('f-price').value);

  if (!date || !item || isNaN(qty) || qty <= 0 || isNaN(price) || price < 0) {
    toast('⚠ FILL ALL REQUIRED FIELDS', true); return;
  }

  DB.expenses.push({ id: DB.nextId++, date, cat, item, qty, price, total: qty * price });
  await saveDB();

  const btn = document.getElementById('save-btn');
  btn.textContent = '✓ ENTRY LOGGED';
  btn.classList.add('success');
  toast('ENTRY WRITTEN TO DISK');
  setTimeout(() => {
    btn.textContent = '⬛ LOG ENTRY';
    btn.classList.remove('success');
    document.getElementById('f-item').value  = '';
    document.getElementById('f-qty').value   = '1';
    document.getElementById('f-price').value = '';
    updateLiveTotal();
  }, 1400);
}

/* ────────────────────────────────────────────────────────────
   DELETE
   ──────────────────────────────────────────────────────────── */
async function deleteEntry(id) {
  if (!confirm('DELETE THIS TRANSACTION?\nThis will be removed from disk.')) return;
  DB.expenses = DB.expenses.filter(e => e.id !== id);
  await saveDB();
  refreshLog();
  toast('RECORD DELETED FROM FILE');
}

/* ────────────────────────────────────────────────────────────
   LOG SCREEN
   ──────────────────────────────────────────────────────────── */
function initLogFilters() {
  const mSel = document.getElementById('filter-month');
  const cSel = document.getElementById('filter-cat');
  const months = [...new Set(DB.expenses.map(e => e.date.slice(0,7)))].sort().reverse();
  
  const curMonth = mSel.value;
  const curCat   = cSel.value;

  mSel.innerHTML = '<option value="">ALL MONTHS</option>' + months.map(m => {
    const [y,mo] = m.split('-');
    const label  = new Date(y, mo-1).toLocaleString('en-IN', { month:'long', year:'numeric' }).toUpperCase();
    return `<option value="${m}" ${m===curMonth?'selected':''}>${label}</option>`;
  }).join('');

  cSel.innerHTML = '<option value="">ALL CATEGORIES</option>' + CAT_NAMES.map(c => 
    `<option value="${c}" ${c===curCat?'selected':''}>${c}</option>`
  ).join('');
}

function getFiltered() {
  const m = document.getElementById('filter-month').value;
  const c = document.getElementById('filter-cat').value;
  return DB.expenses
    .filter(e => (!m || e.date.startsWith(m)) && (!c || e.cat === c))
    .sort((a,b) => b.date.localeCompare(a.date));
}

function refreshLog() {
  initLogFilters();
  const rows  = getFiltered();
  const tbody = document.getElementById('log-tbody');
  const tfoot = document.getElementById('log-tfoot');
  const empty = document.getElementById('log-empty');

  if (rows.length === 0) {
    tbody.innerHTML = ''; tfoot.innerHTML = ''; empty.style.display = 'block'; return;
  }
  empty.style.display = 'none';
  tbody.innerHTML = rows.map(e => `
    <tr>
      <td>${e.date}</td>
      <td>${e.item}</td>
      <td>${badge(e.cat)}</td>
      <td>${e.qty}</td>
      <td class="amount-cell">${fmt(e.price)}</td>
      <td class="amount-cell">${fmt(e.total)}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteEntry(${e.id})">✕</button></td>
    </tr>`).join('');
  const total = rows.reduce((a,e) => a+e.total, 0);
  tfoot.innerHTML = `<tr class="total-row">
    <td colspan="5">TOTAL</td>
    <td class="amount-cell" style="color:var(--magenta);text-shadow:0 0 8px rgba(255,45,120,0.6)">${fmt(total)}</td>
    <td></td>
  </tr>`;
}

document.getElementById('filter-month').addEventListener('change', refreshLog);
document.getElementById('filter-cat').addEventListener('change', refreshLog);

/* ────────────────────────────────────────────────────────────
   DASHBOARD
   ──────────────────────────────────────────────────────────── */
let donutChart = null, barChart = null;

function getMonthExpenses(y, m) {
  const pfx = `${y}-${String(m).padStart(2,'0')}`;
  return DB.expenses.filter(e => e.date.startsWith(pfx));
}

function refreshDashboard() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth()+1;
  const prevM = m===1?12:m-1, prevY = m===1?y-1:y;
  const dayOfMonth = now.getDate();

  const thisMonth = getMonthExpenses(y,m);
  const lastMonth = getMonthExpenses(prevY,prevM);
  const thisTotal = thisMonth.reduce((a,e)=>a+e.total,0);
  const lastTotal = lastMonth.reduce((a,e)=>a+e.total,0);
  const allTotal  = DB.expenses.reduce((a,e)=>a+e.total,0);

  document.getElementById('m-month-total').textContent = fmtShort(thisTotal);
  if (lastTotal > 0) {
    const pct = ((thisTotal-lastTotal)/lastTotal*100).toFixed(1);
    const up  = thisTotal > lastTotal;
    document.getElementById('m-month-compare').innerHTML =
      `<span class="${up?'metric-up':'metric-down'}">${up?'▲':'▼'} ${Math.abs(pct)}%</span> vs last month`;
  } else {
    document.getElementById('m-month-compare').textContent = 'No prev month data';
  }
  document.getElementById('m-alltime').textContent = fmtShort(allTotal);
  document.getElementById('m-alltime-entries').textContent = DB.expenses.length + ' entries logged';
  document.getElementById('m-daily-avg').textContent = fmtShort(dayOfMonth>0 ? thisTotal/dayOfMonth : 0);
  document.getElementById('m-daily-sub').textContent = `avg of ${dayOfMonth} days`;

  const catTotals = {};
  thisMonth.forEach(e => { catTotals[e.cat] = (catTotals[e.cat]||0)+e.total; });
  const topCat = Object.entries(catTotals).sort((a,b)=>b[1]-a[1])[0];
  if (topCat) {
    const col = CATS[topCat[0]] || CATS['Other'];
    document.getElementById('m-top-cat-val').style.color = col;
    document.getElementById('m-top-cat-val').style.textShadow = `0 0 8px ${col}80`;
    document.getElementById('m-top-cat-val').textContent = fmtShort(topCat[1]);
    document.getElementById('m-top-cat-name').textContent = topCat[0];
  } else {
    document.getElementById('m-top-cat-val').textContent = '—';
    document.getElementById('m-top-cat-name').textContent = 'No data this month';
  }

  // Recent 5
  const recent = [...DB.expenses].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  const rtbody = document.getElementById('recent-tbody');
  const rempty = document.getElementById('recent-empty');
  if (recent.length===0) { rtbody.innerHTML=''; rempty.style.display='block'; }
  else {
    rempty.style.display='none';
    rtbody.innerHTML = recent.map(e=>`
      <tr>
        <td>${e.date}</td><td>${e.item}</td><td>${badge(e.cat)}</td>
        <td class="amount-cell">${fmt(e.total)}</td>
      </tr>`).join('');
  }

  // Donut
  const catColors = CAT_NAMES.map(c => CATS[c]);
  const catData   = CAT_NAMES.map(c => catTotals[c]||0);
  const hasData   = catData.some(v=>v>0);
  
  if (donutChart) {
    donutChart.data.datasets[0].data = hasData ? catData : [1];
    donutChart.data.datasets[0].backgroundColor = hasData ? catColors.map(c=>c+'cc') : ['#222'];
    donutChart.data.datasets[0].borderColor = hasData ? catColors : ['#333'];
    donutChart.update();
  } else {
    donutChart = new Chart(document.getElementById('donut-chart').getContext('2d'), {
      type:'doughnut',
      data:{ labels:CAT_NAMES, datasets:[{
        data: hasData?catData:[1],
        backgroundColor: hasData?catColors.map(c=>c+'cc'):['#222'],
        borderColor: hasData?catColors:['#333'],
        borderWidth:1, hoverOffset:8
      }]},
      options:{ responsive:true, maintainAspectRatio:false, cutout:'62%',
        plugins:{ legend:{display:false},
          tooltip:{ backgroundColor:'#0d0d14', borderColor:'#00ffe7', borderWidth:1,
            titleColor:'#00ffe7', bodyColor:'#c8d8e8',
            titleFont:{family:'Orbitron',size:10}, bodyFont:{family:'Share Tech Mono',size:12},
            callbacks:{ label:ctx=>` ${ctx.label}: ${fmt(ctx.raw)}` }
          }
        }
      }
    });
  }

  // Bar — last 6 months
  const barLabels=[], barData=[];
  for(let i=5;i>=0;i--){
    const d=new Date(y,m-1-i,1), by=d.getFullYear(), bm=d.getMonth()+1;
    barLabels.push(d.toLocaleString('en-IN',{month:'short',year:'2-digit'}).toUpperCase());
    barData.push(getMonthExpenses(by,bm).reduce((a,e)=>a+e.total,0));
  }

  if (barChart) {
    barChart.data.labels = barLabels;
    barChart.data.datasets[0].data = barData;
    barChart.data.datasets[0].backgroundColor = barData.map((_,i)=>i===5?'#00ffe7cc':'#00ffe740');
    barChart.update();
  } else {
    barChart = new Chart(document.getElementById('bar-chart').getContext('2d'), {
      type:'bar',
      data:{ labels:barLabels, datasets:[{
        data:barData,
        backgroundColor:barData.map((_,i)=>i===5?'#00ffe7cc':'#00ffe740'),
        borderColor:'#00ffe7', borderWidth:1, borderRadius:3
      }]},
      options:{ responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false},
          tooltip:{ backgroundColor:'#0d0d14', borderColor:'#00ffe7', borderWidth:1,
            titleColor:'#00ffe7', bodyColor:'#c8d8e8',
            titleFont:{family:'Orbitron',size:10}, bodyFont:{family:'Share Tech Mono',size:12},
            callbacks:{ label:ctx=>` ${fmt(ctx.raw)}` }
          }
        },
        scales:{
          x:{ grid:{color:'rgba(0,255,231,0.05)'}, ticks:{color:'#445566',font:{family:'Share Tech Mono',size:10}} },
          y:{ grid:{color:'rgba(0,255,231,0.07)'}, ticks:{color:'#445566',font:{family:'Share Tech Mono',size:10},
            callback:v=>'₹'+(v>=1000?(v/1000).toFixed(0)+'K':v) } }
        }
      }
    });
  }
}

/* ────────────────────────────────────────────────────────────
   MANAGE SCREEN
   ──────────────────────────────────────────────────────────── */
async function refreshManage() {
  const total   = DB.expenses.reduce((a,e)=>a+e.total,0);
  const months  = new Set(DB.expenses.map(e=>e.date.slice(0,7))).size;
  const sorted  = [...DB.expenses].sort((a,b)=>a.date.localeCompare(b.date));
  const dataPath= await window.electronAPI.getDataPath();
  // Estimate file size from serialised JSON
  const sizeKB  = (JSON.stringify(DB).length / 1024).toFixed(2);

  document.getElementById('stat-entries').textContent = DB.expenses.length;
  document.getElementById('stat-months').textContent  = months;
  document.getElementById('stat-spend').textContent   = fmt(total);
  document.getElementById('stat-storage').textContent = sizeKB + ' KB';
  document.getElementById('stat-path').textContent    = dataPath;
  document.getElementById('stat-path').title          = dataPath;
  document.getElementById('stat-first').textContent   = sorted[0]?.date || '—';
  document.getElementById('stat-last').textContent    = sorted[sorted.length-1]?.date || '—';
}

/* ────────────────────────────────────────────────────────────
   EXPORT CSV  (native save dialog via Electron)
   ──────────────────────────────────────────────────────────── */
async function exportCSV() {
  if (DB.expenses.length===0) { toast('NO DATA TO EXPORT', true); return; }
  const header = 'id,date,category,item,qty,price,total\n';
  const rows   = DB.expenses.map(e =>
    `${e.id},${e.date},${e.cat},"${e.item}",${e.qty},${e.price},${e.total}`
  ).join('\n');
  const result = await window.electronAPI.exportCSV(header + rows);
  if (result.ok) toast('CSV SAVED: ' + result.filePath);
  else if (!result.ok && result.error) toast('EXPORT FAILED', true);
}

/* ────────────────────────────────────────────────────────────
   IMPORT CSV
   ──────────────────────────────────────────────────────────── */
async function importCSV() {
  const raw = document.getElementById('import-csv').value.trim();
  if (!raw) { toast('PASTE CSV DATA FIRST', true); return; }
  
  let count = 0, errors = 0;
  const lines = raw.split('\n').filter(l => l.trim());

  for (const line of lines) {
    const parts = line.split(',');
    if (parts.length < 5) { errors++; continue; }

    const [dateRaw, catRaw, itemRaw, qtyRaw, priceRaw] = parts;
    const date  = dateRaw.trim();
    const item  = itemRaw.trim().replace(/^"|"$/g, '');
    const qty   = parseFloat(qtyRaw);
    const price = parseFloat(priceRaw);
    
    // Validation
    const isValidDate  = /^\d{4}-\d{2}-\d{2}$/.test(date);
    const isValidQty   = !isNaN(qty) && qty > 0;
    const isValidPrice = !isNaN(price) && price >= 0;
    const isValidItem  = item.length > 0;

    if (!isValidDate || !isValidQty || !isValidPrice || !isValidItem) {
      errors++;
      continue;
    }

    const cat = CAT_NAMES.find(c => c.toLowerCase() === catRaw.trim().toLowerCase()) || 'Other';
    
    DB.expenses.push({ 
      id: DB.nextId++, 
      date, 
      cat, 
      item, 
      qty, 
      price, 
      total: qty * price 
    });
    count++;
  }

  if (count > 0) {
    await saveDB();
    toast(`${count} ENTRIES WRITTEN TO DISK`);
  } else if (errors > 0) {
    toast(`IMPORT FAILED: ${errors} MALFORMED LINES`, true);
  }

  document.getElementById('import-result').textContent =
    `${count} ENTRIES IMPORTED` + (errors ? `, ${errors} SKIPPED` : '');
  document.getElementById('import-csv').value = '';
}

/* ────────────────────────────────────────────────────────────
   PURGE DATA
   ──────────────────────────────────────────────────────────── */
let purgeStage = 0;
async function purgeData() {
  const btn = document.getElementById('purge-btn');
  const msg = document.getElementById('purge-confirm');
  if (purgeStage===0) {
    purgeStage=1; msg.style.display='block'; btn.textContent='⚠ CONFIRM PURGE';
    setTimeout(()=>{ purgeStage=0; msg.style.display='none'; btn.textContent='⬛ PURGE ALL DATA'; }, 5000);
  } else {
    DB = { expenses:[], nextId:1 };
    await saveDB();
    purgeStage=0; msg.style.display='none'; btn.textContent='⬛ PURGE ALL DATA';
    refreshManage(); toast('ALL DATA PURGED FROM DISK');
  }
}

/* ────────────────────────────────────────────────────────────
   BOOT + INIT
   ──────────────────────────────────────────────────────────── */
async function init() {
  // Get data file path for display
  const dataPath = await window.electronAPI.getDataPath();
  document.getElementById('boot-file-line').textContent = `[ OK ] DATA FILE: ${dataPath}`;
  document.getElementById('data-path-display').textContent = dataPath;

  // Load data from disk
  await loadDB();

  // Update boot lines
  const count = DB.expenses.length;
  document.getElementById('boot-data-line').textContent = '[ OK ] EXPENSE RECORDS PARSED FROM JSON';
  document.getElementById('boot-count-line').className  = 'boot-line boot-ok';
  document.getElementById('boot-count-line').textContent =
    count > 0 ? `[ OK ] ${count} RECORDS LOADED INTO MEMORY` : '[ -- ] FRESH LEDGER — NO PRIOR RECORDS';

  // Init UI
  initAddForm();

  // Hide boot, show app
  setTimeout(() => {
    document.getElementById('boot-screen').classList.add('hidden');
    document.getElementById('app').classList.add('visible');
    refreshDashboard();
  }, 3000);
}

init();
