const SIZE = 8;
const COLORS = 6;
const MOVES_MAX = 30;
let board = [];
let score = 0;
let moves = MOVES_MAX;
let selected = null;
let busy = false;
let currentPlayer = '';
let touchStart = null;
let pointerStart = null;

const boardEl = document.getElementById('board');
const scoreEl = document.getElementById('score');
const movesEl = document.getElementById('moves');
const nameEl = document.getElementById('playerName');
const playerLabelEl = document.getElementById('playerLabel');
const leaderboardEl = document.getElementById('leaderboardList');
const startScreenEl = document.getElementById('startScreen');
const gameScreenEl = document.getElementById('gameScreen');

document.getElementById('newGameBtn').addEventListener('click', ()=>newGame(currentPlayer));
document.getElementById('startBtn').addEventListener('click', startGameFlow);

boardEl.addEventListener('touchstart', onTouchStart, {passive:true});
boardEl.addEventListener('touchend', onTouchEnd, {passive:true});
boardEl.addEventListener('mousedown', onMouseDown);
window.addEventListener('mouseup', onMouseUp);

function startGameFlow(){
  const name = (nameEl.value || '').trim();
  if (!name) return alert('Please enter player name first');
  currentPlayer = name.slice(0,20);
  playerLabelEl.textContent = currentPlayer;
  startScreenEl.classList.add('hidden');
  gameScreenEl.classList.remove('hidden');
  newGame(currentPlayer);
}

function randColor() { return Math.floor(Math.random() * COLORS); }
function idx(r,c){ return r*SIZE+c; }
function rc(i){ return [Math.floor(i/SIZE), i%SIZE]; }
function adjacent(a,b){ const [ar,ac]=rc(a), [br,bc]=rc(b); return Math.abs(ar-br)+Math.abs(ac-bc)===1; }

function newGame(name) {
  if (name) currentPlayer = name;
  score = 0; moves = MOVES_MAX; selected = null;
  board = Array.from({length: SIZE*SIZE}, randColor);
  while (findMatches().size) {
    clearMatches(findMatches());
    applyGravityNoFill();
    fillInstant();
  }
  render();
}

function render() {
  scoreEl.textContent = score;
  movesEl.textContent = moves;
  boardEl.innerHTML = '';
  board.forEach((color,i)=>{
    const d = document.createElement('button');
    d.className = 'cell';
    d.dataset.index = String(i);
    if (color===null) d.classList.add('empty'); else d.classList.add(`c${color}`);
    if (selected===i) d.classList.add('selected');
    d.addEventListener('click', ()=>onCell(i));
    boardEl.appendChild(d);
  });
  renderLeaderboard();
}

async function onCell(i){
  if (busy || moves<=0) return;
  if (selected===null){ selected=i; return render(); }
  if (selected===i){ selected=null; return render(); }
  if (!adjacent(selected,i)){ selected=i; return render(); }
  await attemptSwap(selected,i);
  selected = null;
  render();
}

async function attemptSwap(a,b){
  busy = true;
  await animateSwap(a,b);
  swap(a,b);
  render();
  let matches = findMatches();
  if (!matches.size){
    await animateInvalidSwap(a,b);
    swap(a,b);
    busy = false;
    render();
    return;
  }
  moves--;
  await resolveMatches(matches);
  busy = false;
}

function swap(a,b){ [board[a],board[b]]=[board[b],board[a]]; }

function findMatches(){
  const set = new Set();
  for (let r=0;r<SIZE;r++){
    let run=1;
    for (let c=1;c<=SIZE;c++){
      const prev=board[idx(r,c-1)], cur=(c<SIZE?board[idx(r,c)]:-1);
      if (cur!==null && cur===prev) run++; else {
        if (run>=3 && prev!==null) for (let k=0;k<run;k++) set.add(idx(r,c-1-k));
        run=1;
      }
    }
  }
  for (let c=0;c<SIZE;c++){
    let run=1;
    for (let r=1;r<=SIZE;r++){
      const prev=board[idx(r-1,c)], cur=(r<SIZE?board[idx(r,c)]:-1);
      if (cur!==null && cur===prev) run++; else {
        if (run>=3 && prev!==null) for (let k=0;k<run;k++) set.add(idx(r-1-k,c));
        run=1;
      }
    }
  }
  return set;
}

function clearMatches(set){
  const bonus = set.size >= 4 ? Math.floor(set.size/2) : 0;
  score += set.size * 10 + bonus;
  set.forEach(i=> board[i] = null);
}

function applyGravityNoFill(){
  for (let c=0;c<SIZE;c++){
    let write = SIZE-1;
    for (let r=SIZE-1;r>=0;r--){
      const v = board[idx(r,c)];
      if (v!==null){ board[idx(write,c)] = v; if (write!==r) board[idx(r,c)] = null; write--; }
    }
    for (let r=write;r>=0;r--) board[idx(r,c)] = null;
  }
}

function fillInstant(){
  for (let i=0;i<board.length;i++) if (board[i]===null) board[i]=randColor();
}

async function resolveMatches(initial){
  let m = initial;
  while (m.size){
    await animateVanish(m);
    clearMatches(m);
    render(); // empty first
    await wait(140);

    applyGravityNoFill();
    render(); // dropped old gems
    await wait(120);

    await fillWithCascadeAnimation(); // new gems fall one by one
    m = findMatches();
  }
  if (moves<=0) finishGame();
}

async function fillWithCascadeAnimation(){
  const toFillByCol = Array.from({length: SIZE}, ()=>[]);
  for (let c=0;c<SIZE;c++){
    for (let r=0;r<SIZE;r++){
      const i = idx(r,c);
      if (board[i]===null) toFillByCol[c].push(i);
    }
  }

  let maxLen = 0;
  for (let c=0;c<SIZE;c++) maxLen = Math.max(maxLen, toFillByCol[c].length);

  for (let step=maxLen-1; step>=0; step--){
    let changed = false;
    for (let c=0;c<SIZE;c++){
      const col = toFillByCol[c];
      const pos = col[col.length-1-step];
      if (pos!==undefined){ board[pos]=randColor(); changed = true; }
    }
    if (changed){ render(); await wait(55); }
  }
  await wait(60);
}

async function animateSwap(a,b){
  const cells = boardEl.querySelectorAll('.cell');
  const ca = cells[a], cb = cells[b];
  if (!ca || !cb) return;
  const ra = ca.getBoundingClientRect();
  const rb = cb.getBoundingClientRect();
  const dx = rb.left - ra.left;
  const dy = rb.top - ra.top;
  ca.style.transform = `translate(${dx}px, ${dy}px)`;
  cb.style.transform = `translate(${-dx}px, ${-dy}px)`;
  await wait(170);
  ca.style.transform = '';
  cb.style.transform = '';
}

async function animateInvalidSwap(a,b){
  const cells = boardEl.querySelectorAll('.cell');
  const ca = cells[a], cb = cells[b];
  if (!ca || !cb) return;
  ca.classList.add('shake');
  cb.classList.add('shake');
  await wait(220);
  ca.classList.remove('shake');
  cb.classList.remove('shake');
  await animateSwap(a,b); // animate return
}

async function animateVanish(matchSet){
  const cells = boardEl.querySelectorAll('.cell');
  matchSet.forEach(i => cells[i]?.classList.add('vanish'));
  await wait(240);
}

function finishGame(){
  const name = (currentPlayer || 'Anonymous').trim().slice(0,20);
  const key = 'match3_leaderboard_v1';
  const list = JSON.parse(localStorage.getItem(key) || '[]');
  list.push({name, score, date: new Date().toISOString()});
  list.sort((a,b)=>b.score-a.score);
  localStorage.setItem(key, JSON.stringify(list.slice(0,10)));
  alert(`Game over, ${name}! Score: ${score}`);
}

function renderLeaderboard(){
  const list = JSON.parse(localStorage.getItem('match3_leaderboard_v1') || '[]');
  leaderboardEl.innerHTML = list.map(x=>`<li><strong>${escapeHtml(x.name)}</strong> — ${x.score}</li>`).join('') || '<li>No scores yet</li>';
}

function onTouchStart(e){
  if (busy || moves<=0) return;
  const t = e.changedTouches[0];
  const el = document.elementFromPoint(t.clientX, t.clientY)?.closest('.cell');
  if (!el) return;
  touchStart = { x:t.clientX, y:t.clientY, index:Number(el.dataset.index) };
}

async function onTouchEnd(e){
  if (!touchStart || busy || moves<=0) return;
  const t = e.changedTouches[0];
  const from = directionTarget(touchStart.index, t.clientX-touchStart.x, t.clientY-touchStart.y);
  touchStart = null;
  if (!from) return;
  await attemptSwap(from[0], from[1]);
  render();
}

function onMouseDown(e){
  if (busy || moves<=0) return;
  const el = e.target.closest('.cell');
  if (!el) return;
  pointerStart = { x:e.clientX, y:e.clientY, index:Number(el.dataset.index) };
}

async function onMouseUp(e){
  if (!pointerStart || busy || moves<=0) return;
  const move = directionTarget(pointerStart.index, e.clientX-pointerStart.x, e.clientY-pointerStart.y);
  pointerStart = null;
  if (!move) return;
  await attemptSwap(move[0], move[1]);
  render();
}

function directionTarget(startIndex, dx, dy){
  if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return null;
  const [r,c] = rc(startIndex);
  let tr=r, tc=c;
  if (Math.abs(dx) > Math.abs(dy)) tc += dx>0 ? 1 : -1;
  else tr += dy>0 ? 1 : -1;
  if (tr<0||tc<0||tr>=SIZE||tc>=SIZE) return null;
  return [startIndex, idx(tr,tc)];
}

function wait(ms){ return new Promise(r=>setTimeout(r, ms)); }
function escapeHtml(s){ return s.replace(/[&<>'"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':'&quot;'}[m])); }
