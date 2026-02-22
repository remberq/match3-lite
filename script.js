const SIZE = 8, COLORS = 6, MOVES_MAX = 30;
const MAX_HINTS = 3;
let board = [], score = 0, moves = MOVES_MAX, selected = null, busy = false, currentPlayer = '';
let touchStart = null, pointerStart = null, dropMap = new Map(), shakePower = 0;
let currentSeriesPoints = 0, bestCombo = 0;
let hintTimer = null, hintedCellIndex = null, hintedTargetIndex = null, hintAxis = null, hintDir = null, hintsLeft = MAX_HINTS, hintPulseTimer = null;

const boardEl = document.getElementById('board');
const scoreEl = document.getElementById('score');
const movesEl = document.getElementById('moves');
const nameEl = document.getElementById('playerName');
const playerLabelEl = document.getElementById('playerLabel');
const leaderboardEl = document.getElementById('leaderboardList');
const startScreenEl = document.getElementById('startScreen');
const gameScreenEl = document.getElementById('gameScreen');
const comboOverlayEl = document.getElementById('comboOverlay');
const comboPopupEl = document.getElementById('comboPopup');
const comboLabelEl = document.getElementById('comboLabel');
const bestComboValueEl = document.getElementById('bestComboValue');
const bestComboLabelEl = document.getElementById('bestComboLabel');
const bestComboBoxEl = document.getElementById('bestComboBox');
const hintBtnEl = document.getElementById('hintBtn');
const hintsLeftEl = document.getElementById('hintsLeft');

const audioCtx = (() => { try { return new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }})();
function sfx(freq=440,dur=0.07,type='sine',gain=0.03){ if(!audioCtx) return; const o=audioCtx.createOscillator(), g=audioCtx.createGain(); o.type=type; o.frequency.value=freq; o.connect(g); g.connect(audioCtx.destination); const t=audioCtx.currentTime; g.gain.setValueAtTime(gain,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur); o.start(t); o.stop(t+dur);} 
const playMatchSfx=size=>{ sfx(420 + size*25,0.08,'triangle',0.025); setTimeout(()=>sfx(520 + size*28,0.08,'triangle',0.02),40); };
const playSwapSfx=()=>sfx(260,0.05,'square',0.015);
const playErrorSfx=()=>sfx(150,0.12,'sawtooth',0.025);

function comboMeta(points){
  const t=Math.max(0,Math.min(1,(points-100)/300));
  const hue=50-Math.round(50*t);
  const label = points >= 300 ? 'Monster Combo!' : points >= 220 ? 'Awesome!' : points >= 150 ? 'Great!' : points >= 100 ? 'Nice!' : '—';
  return {hue,label};
}
function setBestCombo(points){
  bestCombo=Math.max(bestCombo,points);
  bestComboValueEl.textContent=String(bestCombo);
  const {hue,label}=comboMeta(bestCombo);
  bestComboLabelEl.textContent=label;
  bestComboValueEl.style.color=`hsl(${hue} 95% 60%)`;
  bestComboLabelEl.style.color=`hsl(${hue} 95% 72%)`;
  bestComboBoxEl.style.boxShadow = `inset 0 0 0 1px hsla(${hue} 95% 60% / .22)`;
}
function clearMatchesNoScore(set){ set.forEach(i=>board[i]=null); }
function updateHintsUi(){ hintsLeftEl.textContent = `${hintsLeft}/${MAX_HINTS}`; }

function triggerScreenShake(intensity=6){ shakePower=Math.max(shakePower,intensity); }
function animateScreenShake(){ if(shakePower>0.2){ const x=(Math.random()-0.5)*shakePower,y=(Math.random()-0.5)*shakePower; boardEl.style.transform=`translate(${x}px,${y}px)`; shakePower*=0.82;} else {boardEl.style.transform=''; shakePower=0;} requestAnimationFrame(animateScreenShake);} requestAnimationFrame(animateScreenShake);

const startBtn = document.getElementById('startBtn');
startBtn.addEventListener('click', startGameFlow);
nameEl.addEventListener('keydown', (e)=>{ if(e.key==='Enter') startGameFlow(); });
window.addEventListener('load', ()=> nameEl.focus());

document.getElementById('newGameBtn').addEventListener('click', ()=>newGame(currentPlayer));
document.getElementById('shuffleBtn').addEventListener('click', ()=>shuffleBoard());
hintBtnEl.addEventListener('click', onHintClick);

boardEl.addEventListener('touchstart', onTouchStart, {passive:true});
boardEl.addEventListener('touchend', onTouchEnd, {passive:true});
boardEl.addEventListener('mousedown', onMouseDown); window.addEventListener('mouseup', onMouseUp);

function startGameFlow(){ const name=(nameEl.value||'').trim(); if(!name) return alert('Please enter player name first'); currentPlayer=name.slice(0,20); playerLabelEl.textContent=currentPlayer; startScreenEl.remove(); gameScreenEl.classList.remove('hidden'); if(audioCtx&&audioCtx.state==='suspended') audioCtx.resume(); newGame(currentPlayer); }

const randColor=()=>Math.floor(Math.random()*COLORS); const idx=(r,c)=>r*SIZE+c; const rc=i=>[Math.floor(i/SIZE), i%SIZE]; const adjacent=(a,b)=>{const [ar,ac]=rc(a),[br,bc]=rc(b); return Math.abs(ar-br)+Math.abs(ac-bc)===1;};

function newGame(name){ if(name) currentPlayer=name; score=0; moves=MOVES_MAX; selected=null; currentSeriesPoints=0; bestCombo=0; hintsLeft=MAX_HINTS; updateHintsUi(); setBestCombo(0); board=Array.from({length:SIZE*SIZE},randColor); while(findMatches().size){ const m=findMatches(); clearMatchesNoScore(m); applyGravityNoFill(); fillInstant(); } ensurePlayableBoard(); dropMap.clear(); render(); resetHintCycle(); }

function shuffleBoard(){ if(busy) return; score=0; selected=null; currentSeriesPoints=0; bestCombo=0; hintsLeft=MAX_HINTS; updateHintsUi(); setBestCombo(0); let arr=[...board];
 for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
 board=arr;
 while(findMatches().size){ const m=findMatches(); clearMatchesNoScore(m); applyGravityNoFill(); fillInstant(); }
 ensurePlayableBoard();
 render();
 resetHintCycle();
}

function render(){ scoreEl.textContent=score; movesEl.textContent=moves; boardEl.innerHTML=''; board.forEach((color,i)=>{ const d=document.createElement('button'); d.className='cell'; d.dataset.index=String(i); if(color===null)d.classList.add('empty'); else d.classList.add(`c${color}`); if(selected===i)d.classList.add('selected'); const dist=dropMap.get(i); if(dist&&color!==null){ d.classList.add('drop'); d.style.setProperty('--drop',String(dist)); d.style.animationDelay=`${Math.min(220,dist*22)}ms`; } d.addEventListener('click',()=>onCell(i)); boardEl.appendChild(d); }); renderLeaderboard(); }

async function onCell(i){ if(busy||moves<=0)return; userInteracted(); if(selected===null){selected=i; return render();} if(selected===i){selected=null; return render();} if(!adjacent(selected,i)){selected=i; return render();} await attemptSwap(selected,i); selected=null; render(); }
async function attemptSwap(a,b){ busy=true; currentSeriesPoints=0; playSwapSfx(); await animateSwap(a,b); swap(a,b); render(); let matches=findMatches(); if(!matches.size){ await animateInvalidSwap(a,b); swap(a,b); busy=false; render(); resetHintCycle(); return; } moves--; clearHintVisual(); await resolveMatches(matches); busy=false; ensurePlayableBoard(); render(); resetHintCycle(); }
const swap=(a,b)=>{[board[a],board[b]]=[board[b],board[a]]};

function findMatches(){ const set=new Set();
 for(let r=0;r<SIZE;r++){ let run=1; for(let c=1;c<=SIZE;c++){ const prev=board[idx(r,c-1)], cur=(c<SIZE?board[idx(r,c)]:-1); if(cur!==null&&cur===prev) run++; else { if(run>=3&&prev!==null) for(let k=0;k<run;k++) set.add(idx(r,c-1-k)); run=1; }}}
 for(let c=0;c<SIZE;c++){ let run=1; for(let r=1;r<=SIZE;r++){ const prev=board[idx(r-1,c)], cur=(r<SIZE?board[idx(r,c)]:-1); if(cur!==null&&cur===prev) run++; else { if(run>=3&&prev!==null) for(let k=0;k<run;k++) set.add(idx(r-1-k,c)); run=1; }}}
 return set; }

function clearMatches(set){ const bonus=set.size>=4?Math.floor(set.size/2):0; const points=set.size*10+bonus; score += points; set.forEach(i=>board[i]=null); return points; }
function applyGravityNoFill(){ for(let c=0;c<SIZE;c++){ let write=SIZE-1; for(let r=SIZE-1;r>=0;r--){ const from=idx(r,c),v=board[from]; if(v!==null){ const to=idx(write,c); board[to]=v; if(to!==from) board[from]=null; write--; }} for(let r=write;r>=0;r--) board[idx(r,c)]=null; }}
function fillInstant(){ for(let i=0;i<board.length;i++) if(board[i]===null) board[i]=randColor(); }

async function resolveMatches(initial){ let m=initial, comboChain=0;
 while(m.size){ comboChain++; playMatchSfx(m.size); if(m.size>=5||comboChain>=2) triggerScreenShake(Math.min(10,4+m.size*.45)); spawnParticles(m); await animateVanish(m);
 const gained=clearMatches(m); currentSeriesPoints += gained;
 if(currentSeriesPoints>=100){ setBestCombo(currentSeriesPoints); showCombo(currentSeriesPoints); }
 dropMap.clear(); render(); await wait(120); applyGravityNoFill(); dropMap.clear(); render(); await wait(80); await fillWithCascadeAnimation(); m=findMatches(); }
 if(moves<=0) finishGame(); }

function showCombo(points){ const {hue,label}=comboMeta(points);
 comboOverlayEl.classList.remove('hidden');
 comboPopupEl.textContent=String(points); comboPopupEl.style.color=`hsl(${hue} 95% 60%)`; comboPopupEl.style.textShadow=`0 0 12px hsla(${hue} 95% 60% / .55), 0 6px 20px rgba(0,0,0,.35)`;
 comboLabelEl.textContent=label; comboLabelEl.style.color=`hsl(${hue} 95% 70%)`;
 comboPopupEl.classList.remove('show'); comboLabelEl.classList.remove('show'); void comboPopupEl.offsetWidth; comboPopupEl.classList.add('show'); comboLabelEl.classList.add('show');
}

function spawnParticles(matchSet){ const rect=boardEl.getBoundingClientRect(), cells=boardEl.querySelectorAll('.cell'); matchSet.forEach(i=>{ const c=cells[i]; if(!c)return; const cr=c.getBoundingClientRect(); const cx=cr.left-rect.left+cr.width/2, cy=cr.top-rect.top+cr.height/2; const color=getComputedStyle(c).backgroundColor||'#fff'; for(let p=0;p<6;p++){ const el=document.createElement('span'); el.className='pfx'; el.style.left=`${cx}px`; el.style.top=`${cy}px`; el.style.width=`${4+Math.random()*5}px`; el.style.height=el.style.width; el.style.background=color; el.style.setProperty('--tx',`${(Math.random()-0.5)*46}px`); el.style.setProperty('--ty',`${(Math.random()-0.5)*46}px`); boardEl.appendChild(el); setTimeout(()=>el.remove(),520);} }); }

async function fillWithCascadeAnimation(){ dropMap.clear(); for(let c=0;c<SIZE;c++){ let empties=[]; for(let r=0;r<SIZE;r++) if(board[idx(r,c)]===null) empties.push(r); for(let k=0;k<empties.length;k++){ const r=empties[k], i=idx(r,c); board[i]=randColor(); dropMap.set(i,empties.length-k+1); } } render(); await wait(500); dropMap.clear(); render(); }

async function animateSwap(a,b){ const cells=boardEl.querySelectorAll('.cell'); const ca=cells[a],cb=cells[b]; if(!ca||!cb)return; const ra=ca.getBoundingClientRect(),rb=cb.getBoundingClientRect(); const dx=rb.left-ra.left,dy=rb.top-ra.top; ca.style.transform=`translate(${dx}px,${dy}px) scale(1.04)`; cb.style.transform=`translate(${-dx}px,${-dy}px) scale(1.04)`; await wait(190); ca.style.transform=''; cb.style.transform=''; }
async function animateInvalidSwap(a,b){ playErrorSfx(); const cells=boardEl.querySelectorAll('.cell'); const ca=cells[a],cb=cells[b]; if(!ca||!cb)return; ca.classList.add('shake'); cb.classList.add('shake'); await wait(280); ca.classList.remove('shake'); cb.classList.remove('shake'); await animateSwap(a,b); }
async function animateVanish(matchSet){ const cells=boardEl.querySelectorAll('.cell'); matchSet.forEach(i=>cells[i]?.classList.add('vanish')); await wait(300); }

function finishGame(){ const name=(currentPlayer||'Anonymous').trim().slice(0,20); const key='match3_leaderboard_v1'; const list=JSON.parse(localStorage.getItem(key)||'[]'); list.push({name,score,date:new Date().toISOString()}); list.sort((a,b)=>b.score-a.score); localStorage.setItem(key,JSON.stringify(list.slice(0,10))); alert(`Game over, ${name}! Score: ${score}`); }
function renderLeaderboard(){ const list=JSON.parse(localStorage.getItem('match3_leaderboard_v1')||'[]'); leaderboardEl.innerHTML=list.map(x=>`<li><strong>${escapeHtml(x.name)}</strong> — ${x.score}</li>`).join('')||'<li>No scores yet</li>'; }

function onTouchStart(e){ if(busy||moves<=0)return; userInteracted(); const t=e.changedTouches[0]; const el=document.elementFromPoint(t.clientX,t.clientY)?.closest('.cell'); if(!el)return; touchStart={x:t.clientX,y:t.clientY,index:Number(el.dataset.index)}; }
async function onTouchEnd(e){ if(!touchStart||busy||moves<=0)return; const t=e.changedTouches[0]; const move=directionTarget(touchStart.index,t.clientX-touchStart.x,t.clientY-touchStart.y); touchStart=null; if(!move)return; await attemptSwap(move[0],move[1]); render(); }
function onMouseDown(e){ if(busy||moves<=0)return; userInteracted(); const el=e.target.closest('.cell'); if(!el)return; pointerStart={x:e.clientX,y:e.clientY,index:Number(el.dataset.index)}; }
async function onMouseUp(e){ if(!pointerStart||busy||moves<=0)return; const move=directionTarget(pointerStart.index,e.clientX-pointerStart.x,e.clientY-pointerStart.y); pointerStart=null; if(!move)return; await attemptSwap(move[0],move[1]); render(); }

function directionTarget(startIndex,dx,dy){ if(Math.abs(dx)<10&&Math.abs(dy)<10)return null; const [r,c]=rc(startIndex); let tr=r,tc=c; if(Math.abs(dx)>Math.abs(dy)) tc += dx>0?1:-1; else tr += dy>0?1:-1; if(tr<0||tc<0||tr>=SIZE||tc>=SIZE)return null; return [startIndex,idx(tr,tc)]; }
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const escapeHtml=s=>s.replace(/[&<>'"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":"&#39;"}[m]));

// ---------- Playability + Hint system ----------
function findMatchesOn(arr){
  const set=new Set(); const at=(r,c)=>arr[idx(r,c)];
  for(let r=0;r<SIZE;r++){ let run=1; for(let c=1;c<=SIZE;c++){ const prev=at(r,c-1), cur=(c<SIZE?at(r,c):-1); if(cur!==null&&cur===prev) run++; else { if(run>=3&&prev!==null) for(let k=0;k<run;k++) set.add(idx(r,c-1-k)); run=1; } }}
  for(let c=0;c<SIZE;c++){ let run=1; for(let r=1;r<=SIZE;r++){ const prev=at(r-1,c), cur=(r<SIZE?at(r,c):-1); if(cur!==null&&cur===prev) run++; else { if(run>=3&&prev!==null) for(let k=0;k<run;k++) set.add(idx(r-1-k,c)); run=1; } }}
  return set;
}
function gravityFillOn(arr){
  for(let c=0;c<SIZE;c++){
    let write=SIZE-1;
    for(let r=SIZE-1;r>=0;r--){ const from=idx(r,c), v=arr[from]; if(v!==null){ arr[idx(write,c)] = v; if(write!==r) arr[from]=null; write--; } }
    for(let r=write;r>=0;r--) arr[idx(r,c)] = Math.floor(Math.random()*COLORS);
  }
}
function evaluateMove(a,b){
  const arr=[...board]; [arr[a],arr[b]]=[arr[b],arr[a]];
  let total=0, chain=0, m=findMatchesOn(arr);
  if(!m.size) return -1;
  while(m.size && chain<10){ chain++; const size=m.size, bonus=size>=4?Math.floor(size/2):0; total += size*10 + bonus + (chain>1?chain*6:0); m.forEach(i=>arr[i]=null); gravityFillOn(arr); m=findMatchesOn(arr); }
  return total;
}
function findBestMove(){
  let best=null, bestScore=-1;
  for(let i=0;i<board.length;i++){
    const [r,c]=rc(i); const candidates=[]; if(c+1<SIZE) candidates.push(idx(r,c+1)); if(r+1<SIZE) candidates.push(idx(r+1,c));
    for(const j of candidates){ const sc=evaluateMove(i,j); if(sc>bestScore){ bestScore=sc; best=[i,j]; } }
  }
  return bestScore>=0 ? best : null;
}

function ensurePlayableBoard(){
  let guard=0;
  while(!findBestMove() && guard<40){
    const arr=[...board];
    for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
    board=arr;
    while(findMatches().size){ const m=findMatches(); clearMatchesNoScore(m); applyGravityNoFill(); fillInstant(); }
    guard++;
  }
}

function clearHintVisual(){
  if(hintPulseTimer){ clearInterval(hintPulseTimer); hintPulseTimer=null; }
  if(hintedCellIndex!==null){
    const el = boardEl.querySelector(`.cell[data-index="${hintedCellIndex}"]`);
    el?.classList.remove('shake','hint-x-right','hint-x-left','hint-y-up','hint-y-down');
  }
  hintedCellIndex = null;
  hintedTargetIndex = null;
  hintAxis = null;
  hintDir = null;
}

function scheduleHintButton(){
  if(hintTimer) clearTimeout(hintTimer);
  hintBtnEl.classList.add('hidden');
  hintTimer = setTimeout(()=>{
    if(busy || moves<=0 || hintsLeft<=0) return;
    const move = findBestMove();
    if(!move) return;
    hintBtnEl.classList.remove('hidden');
    hintBtnEl.classList.remove('pop-in');
    void hintBtnEl.offsetWidth;
    hintBtnEl.classList.add('pop-in');
  }, 5000);
}

function onHintClick(){
  if(busy || moves<=0 || hintsLeft<=0) return;
  const move = findBestMove();
  hintBtnEl.classList.add('hidden');
  if(!move) return;
  hintsLeft = Math.max(0, hintsLeft - 1);
  updateHintsUi();
  clearHintVisual();
  hintedCellIndex = move[0];
  hintedTargetIndex = move[1];
  const [sr,sc] = rc(hintedCellIndex);
  const [tr,tc] = rc(hintedTargetIndex);
  hintAxis = (sr===tr) ? 'x' : 'y';
  hintDir = hintAxis==='x' ? (tc>sc ? 'right' : 'left') : (tr>sr ? 'down' : 'up');

  const pulse = () => {
    if(hintedCellIndex===null) return;
    const target = boardEl.querySelector(`.cell[data-index="${hintedCellIndex}"]`);
    if(!target) return;
    target.classList.remove('hint-x-right','hint-x-left','hint-y-up','hint-y-down');
    void target.offsetWidth;
    if(hintAxis==='x') target.classList.add(hintDir==='right' ? 'hint-x-right' : 'hint-x-left');
    else target.classList.add(hintDir==='down' ? 'hint-y-down' : 'hint-y-up');
  };
  pulse();
  hintPulseTimer = setInterval(pulse, 1000);
}

function resetHintCycle(){
  clearHintVisual();
  scheduleHintButton();
}

function userInteracted(){
  hintBtnEl.classList.add('hidden');
  // keep active hint pulse until player makes a valid match
  if(hintedCellIndex===null){
    resetHintCycle();
  }
}
