const SIZE = 8;
const COLORS = 6;
const MOVES_MAX = 30;
let board = [];
let score = 0;
let moves = MOVES_MAX;
let selected = null;
let busy = false;

const boardEl = document.getElementById('board');
const scoreEl = document.getElementById('score');
const movesEl = document.getElementById('moves');
const nameEl = document.getElementById('playerName');
const leaderboardEl = document.getElementById('leaderboardList');

document.getElementById('newGameBtn').addEventListener('click', newGame);

function randColor() { return Math.floor(Math.random() * COLORS); }
function idx(r,c){ return r*SIZE+c; }
function rc(i){ return [Math.floor(i/SIZE), i%SIZE]; }
function inBounds(r,c){ return r>=0 && c>=0 && r<SIZE && c<SIZE; }
function adjacent(a,b){ const [ar,ac]=rc(a), [br,bc]=rc(b); return Math.abs(ar-br)+Math.abs(ac-bc)===1; }

function newGame() {
  score = 0; moves = MOVES_MAX; selected = null;
  board = Array.from({length: SIZE*SIZE}, randColor);
  // remove initial matches
  while (findMatches().size) applyGravityAndFill(clearMatches(findMatches()));
  render();
}

function render() {
  scoreEl.textContent = score;
  movesEl.textContent = moves;
  boardEl.innerHTML = '';
  board.forEach((color,i)=>{
    const d = document.createElement('button');
    d.className = `cell c${color}` + (selected===i ? ' selected':'');
    d.addEventListener('click', ()=>onCell(i));
    boardEl.appendChild(d);
  });
  renderLeaderboard();
}

function onCell(i){
  if (busy || moves<=0) return;
  if (selected===null){ selected=i; return render(); }
  if (selected===i){ selected=null; return render(); }
  if (!adjacent(selected,i)){ selected=i; return render(); }
  swap(selected,i);
  const matches = findMatches();
  if (!matches.size){ swap(selected,i); selected=null; return render(); }
  moves--; selected=null; resolveMatches(matches);
}

function swap(a,b){ [board[a],board[b]]=[board[b],board[a]]; }

function findMatches(){
  const set = new Set();
  // rows
  for (let r=0;r<SIZE;r++){
    let run=1;
    for (let c=1;c<=SIZE;c++){
      const prev=board[idx(r,c-1)], cur=(c<SIZE?board[idx(r,c)]:-1);
      if (cur===prev) run++; else {
        if (run>=3) for (let k=0;k<run;k++) set.add(idx(r,c-1-k));
        run=1;
      }
    }
  }
  // cols
  for (let c=0;c<SIZE;c++){
    let run=1;
    for (let r=1;r<=SIZE;r++){
      const prev=board[idx(r-1,c)], cur=(r<SIZE?board[idx(r,c)]:-1);
      if (cur===prev) run++; else {
        if (run>=3) for (let k=0;k<run;k++) set.add(idx(r-1-k,c));
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
  return set;
}

function applyGravityAndFill(){
  for (let c=0;c<SIZE;c++){
    let write = SIZE-1;
    for (let r=SIZE-1;r>=0;r--){
      const v = board[idx(r,c)];
      if (v!==null){ board[idx(write,c)] = v; write--; }
    }
    for (let r=write;r>=0;r--) board[idx(r,c)] = randColor();
  }
}

function resolveMatches(initial){
  busy = true;
  let m = initial;
  while (m.size){
    clearMatches(m);
    applyGravityAndFill();
    m = findMatches();
  }
  busy = false;
  if (moves<=0) finishGame();
  render();
}

function finishGame(){
  const name = (nameEl.value || 'Anonymous').trim().slice(0,20);
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

function escapeHtml(s){ return s.replace(/[&<>'"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':'&quot;'}[m])); }

newGame();
