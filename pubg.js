/* ═══════════════════════════════════════════════════════════════
   CLUCHZONE — PUBG AIRPLANE LOBBY SCRIPT
   Layout: 25 rows × 4 seats = 100 total
   Left side: seats 1-50 (2 per row)
   Right side: seats 51-100 (2 per row)
   ═══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  const ROWS  = 25;
  const TOTAL = 100;

  /* ── CREATE TOURNAMENT BUTTON ── */
  const btnCreateTourPubg = document.getElementById('btn-create-tour-pubg');
  if (btnCreateTourPubg) {
    btnCreateTourPubg.addEventListener('click', () => {
      setTimeout(() => {
        try {
          window.location.href = 'create-tournament.html';
        } catch (e) {
          window.open('create-tournament.html', '_self');
        }
      }, 50);
    });
  }

  /* ── STATE per tournament ── */
  const tournaments = {
    1: { title: 'Erangel Survivor Cup',  seats: {} },
    2: { title: 'Miramar Desert Clash',  seats: {} },
  };

  async function syncInitialState() {
    const saved = await window.CluchAPI?.getStore('cluchzone_pubg_tournaments', null);
    if (saved && typeof saved === 'object') {
      Object.assign(tournaments, saved);
    }
  }

  function saveState() {
    window.CluchAPI?.setStore('cluchzone_pubg_tournaments', tournaments);
  }
  let activeTour  = null;
  let mySeats     = new Set(); // seats I've selected
  let timerHandle = null;
  let timeLeft    = 14 * 60 + 59;

  /* ── DOM ── */
  const lobbySection = document.getElementById('airplane-lobby-section');
  const tourTitle    = document.getElementById('current-tournament-title');
  const lobbyOcc     = document.getElementById('lobby-occupancy');
  const timerEl      = document.getElementById('pubg-timer');
  const tooltip      = document.getElementById('player-tooltip');
  const ttNick  = document.getElementById('tooltip-nick');
  const ttRank  = document.getElementById('tooltip-rank');
  const ttKd    = document.getElementById('tooltip-kd');
  const ttWins  = document.getElementById('tooltip-wins');
  const ttRep   = document.getElementById('tooltip-rep');

  /* ── MOCK DATA ── */
  const nicks = ['xDROPx','BattlePro','SniperGod','ChickenKing','DesertFox',
    'ErangelWin','GhostRider','IronSight','JuiceWRLD','KillSwitch',
    'LagSpike','MiradaX','NightOwl','OmegaFrag','ProScopeR',
    'QuickScope','RedZoneR','ShotFirst','ThermalX','UltimateG',
    'VaultKing','WarZoneR','XSniperX','YoloDropR','ZeroRecoil'];
  const ranks = ['Bronze','Silver','Gold','Platinum','Diamond','Master','Grandmaster'];
  const rnd  = arr => arr[Math.floor(Math.random() * arr.length)];
  const rndF = () => (Math.random() * 4 + 0.4).toFixed(2);
  const rndP = () => Math.floor(Math.random() * 35 + 3) + '%';

  /* ── STATUS types ── */
  // 'confirmed' = already in (blue)
  // 'pending'   = registered but not confirmed (yellow)
  // 'available' = free (gray)
  // 'mine'      = current user selected (green)

  function prefill(tid) {
    const tour = tournaments[tid];
    if (Object.keys(tour.seats).length > 0) return;

    // Randomly fill some seats as confirmed and some as pending
    const allNums = Array.from({length: TOTAL}, (_, i) => i + 1);
    shuffle(allNums);

    // ~55 confirmed, ~10 pending, rest available
    allNums.slice(0, 55).forEach(n => {
      tour.seats[n] = { status: 'confirmed', nick: rnd(nicks), rank: rnd(ranks), kd: rndF(), wins: rndP(), rep: Math.floor(Math.random()*30+70)+'%' };
    });
    allNums.slice(55, 65).forEach(n => {
      tour.seats[n] = { status: 'pending', nick: rnd(nicks), rank: rnd(ranks), kd: rndF(), wins: rndP(), rep: Math.floor(Math.random()*30+70)+'%' };
    });
    // rest = available (no entry in seats)
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  /* ── RENDER ── */
  function render() {
    const lobbyEl = document.querySelector('.plane-grid');
    if (!lobbyEl) return;
    const tour = tournaments[activeTour];
    lobbyEl.innerHTML = '';

    // Header row
    const header = document.createElement('div');
    header.className = 'plane-grid-header';
    header.innerHTML = `
      <div></div>
      <div class="col-label">← ESQUERDO (1-50)</div>
      <div class="aisle-label">CORREDOR</div>
      <div class="col-label">DIREITO (51-100) →</div>
      <div></div>
    `;
    lobbyEl.appendChild(header);

    for (let row = 1; row <= ROWS; row++) {
      // left pair: seats (row*2-1) and (row*2)
      const l1 = (row - 1) * 2 + 1;
      const l2 = (row - 1) * 2 + 2;
      // right pair: seats 50 + (row*2-1) and 50 + (row*2)
      const r1 = 50 + (row - 1) * 2 + 1;
      const r2 = 50 + (row - 1) * 2 + 2;

      const rowEl = document.createElement('div');
      rowEl.className = 'plane-row';

      rowEl.innerHTML = `
        <div class="plane-row-num">${row}</div>
        <div class="seat-pair" id="pair-left-${row}"></div>
        <div class="aisle-divider"></div>
        <div class="seat-pair" id="pair-right-${row}"></div>
        <div class="plane-row-num">${row}</div>
      `;
      lobbyEl.appendChild(rowEl);

      // render seats into pairs
      setTimeout(() => {
        const leftPair  = document.getElementById(`pair-left-${row}`);
        const rightPair = document.getElementById(`pair-right-${row}`);
        if (leftPair) {
          leftPair.appendChild(makeSeat(l1, tour));
          leftPair.appendChild(makeSeat(l2, tour));
        }
        if (rightPair) {
          rightPair.appendChild(makeSeat(r1, tour));
          rightPair.appendChild(makeSeat(r2, tour));
        }
      }, 0);
    }

    updateSummary();
  }

  function makeSeat(num, tour) {
    const el = document.createElement('div');
    el.className = 'seat';
    el.textContent = num;
    el.dataset.num = num;

    const data = tour.seats[num];
    if (mySeats.has(num)) {
      el.classList.add('mine');
      el.title = 'Seu assento';
    } else if (data) {
      el.classList.add(data.status);
      if (data.status !== 'confirmed' && data.status !== 'pending') {
        el.classList.add('available');
      }
      // tooltip on occupied seats
      if (data.nick) {
        el.classList.add('available' === data.status ? 'available' : data.status);
        el.addEventListener('mouseenter', e => showTip(e, data));
        el.addEventListener('mousemove',  e => moveTip(e));
        el.addEventListener('mouseleave', hideTip);
      }
    } else {
      el.classList.add('available');
      el.addEventListener('click', () => selectSeat(num));
    }
    return el;
  }

  function selectSeat(num) {
    const tour = tournaments[activeTour];
    // Toggle off if already selected
    if (mySeats.has(num)) {
      mySeats.delete(num);
      delete tour.seats[num];
    } else {
      mySeats.add(num);
      tour.seats[num] = { status: 'mine', nick: '✈ VOCÊ', rank: 'Seu Assento', kd:'-', wins:'-', rep:'100%' };
    }
    render();
    saveState();
    updateOccupancy();
    if (!mySeats.has(num)) {
      showToast(`Assento ${num} liberado.`, 'info');
    } else {
      showToast(`✅ Assento ${num} reservado! Boa sorte!`, 'success');
    }
  }

  function updateSummary() {
    const tour = tournaments[activeTour];
    let confirmed = 0, pending = 0;
    Object.values(tour.seats).forEach(s => {
      if (s.status === 'confirmed') confirmed++;
      else if (s.status === 'pending') pending++;
      else if (s.status === 'mine') confirmed++;
    });
    const available = TOTAL - Object.keys(tour.seats).length + mySeats.size; // free ones
    const avail = TOTAL - confirmed - pending - (mySeats.size > 0 ? 0 : 0);

    const sConfirmed = document.getElementById('summary-confirmed');
    const sPending   = document.getElementById('summary-pending');
    const sAvail     = document.getElementById('summary-avail');
    if (sConfirmed) sConfirmed.textContent = confirmed + mySeats.size;
    if (sPending)   sPending.textContent   = pending;
    if (sAvail)     sAvail.textContent     = TOTAL - confirmed - pending - mySeats.size;
    updateOccupancy();
  }

  function updateOccupancy() {
    const tour = tournaments[activeTour];
    const count = Object.keys(tour.seats).length;
    if (lobbyOcc) lobbyOcc.innerHTML = `<strong>${count}/${TOTAL}</strong>`;
  }

  /* ── OPEN LOBBY ── */
  function openLobby(tid) {
    activeTour = tid;
    mySeats = new Set();
    prefill(tid);
    if (tourTitle) tourTitle.textContent = tournaments[tid].title;
    if (lobbySection) {
      lobbySection.style.display = 'block';
      setTimeout(() => lobbySection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
    render();
    startTimer();
  }

  /* ── TIMER ── */
  function startTimer() {
    if (timerHandle) clearInterval(timerHandle);
    timeLeft = 14 * 60 + 59;
    timerHandle = setInterval(() => {
      if (timeLeft <= 0) { clearInterval(timerHandle); if (timerEl) timerEl.textContent = '00:00'; return; }
      timeLeft--;
      const m = String(Math.floor(timeLeft / 60)).padStart(2,'0');
      const s = String(timeLeft % 60).padStart(2,'0');
      if (timerEl) timerEl.textContent = `${m}:${s}`;
    }, 1000);
  }

  /* ── TOOLTIP ── */
  function showTip(e, p) {
    if (!tooltip) return;
    ttNick.textContent = p.nick; ttRank.textContent = p.rank;
    ttKd.textContent = p.kd; ttWins.textContent = p.wins; ttRep.textContent = p.rep;
    moveTip(e); tooltip.classList.add('show');
  }
  function moveTip(e) {
    if (!tooltip) return;
    let x = e.clientX + 16, y = e.clientY + 16;
    if (x + 200 > window.innerWidth)  x = e.clientX - 210;
    if (y + 120 > window.innerHeight) y = e.clientY - 130;
    tooltip.style.left = x + 'px'; tooltip.style.top = y + 'px';
  }
  function hideTip() { if (tooltip) tooltip.classList.remove('show'); }

  /* ── TOAST ── */
  function showToast(msg, type) {
    const tc = document.getElementById('toast-container');
    if (!tc) return;
    const t = document.createElement('div');
    const c = type === 'success' ? '#00e676' : '#00d4ff';
    t.style.cssText = `padding:12px 20px;border-radius:8px;font-weight:700;font-size:14px;
      margin-bottom:8px;background:rgba(0,0,0,.5);border:1px solid ${c};color:${c};
      box-shadow:0 4px 20px rgba(0,0,0,.5);`;
    t.textContent = msg;
    tc.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  /* ── BIND BUTTONS ── */
  document.querySelectorAll('.open-airplane-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await syncInitialState();
      openLobby(parseInt(btn.dataset.tourId));
    });
  });

  syncInitialState();

  /* ── CURSOR GLOW ── */
  const glow = document.getElementById('cursor-glow');
  if (glow) {
    document.addEventListener('mousemove', e => {
      glow.style.left = e.clientX + 'px';
      glow.style.top  = e.clientY + 'px';
    });
  }
});
