const SIZE = 8, COLORS = 6, MOVES_MAX = 30;
let board = [], score = 0, moves = MOVES_MAX, selected = null, busy = false, currentPlayer = '';
let touchStart = null, pointerStart = null, dropMap = new Map(), shakePower = 0;

const boardEl = document.getElementById('board');
const scoreEl = document.getElementById('score');
const movesEl = document.getElementById('moves');
const nameEl = document.getElementById('playerName');
const playerLabelEl = document.getElementById('playerLabel');
const leaderboardEl = document.getElementById('leaderboardList');
const startScreenEl = document.getElementById('startScreen');
const gameScreenEl = document.getElementById('gameScreen');
const comboPopupEl = document.getElementById('comboPopup');
const comboLabelEl = document.getElementById('comboLabel');

const audioCtx = (() => { try { return new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }})();
function sfx(freq=440,dur=0.07,type='sine',gain=0.03){ if(!audioCtx) return; const o=audioCtx.createOscillator(), g=audioCtx.createGain(); o.type=type; o.frequency.value=freq; g.gain.value=gain; o.connect(g); g.connect(audioCtx.destination); const t=audioCtx.currentTime; g.gain.setValueAtTime(gain,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur); o.start(t); o.stop(t+dur);} 
function playMatchSfx(size){ sfx(420 + size*25, 0.08, 'triangle', 0.025); setTimeout(()=>sfx(520 + size*28, 0.08, 'triangle', 0.02), 40); }
function playSwapSfx(){ sfx(260,0.05,'square',0.015); }
function playErrorSfx(){ sfx(150,0.12,'sawtooth',0.025); }

function triggerScreenShake(intensity=6){ shakePower = Math.max(shakePower, intensity); }
function animateScreenShake(){ if(shakePower>0.2){ const x=(Math.random()-0.5)*shakePower,y=(Math.random()-0.5)*shakePower; boardEl.style.transform=`translate(${x}px,${y}px)`; shakePower*=0.82;} else {boardEl.style.transform=''; shakePower=0;} requestAnimationFrame(animateScreenShake);} requestAnimationFrame(animateScreenShake);

document.getElementById('newGameBtn').addEventListener('click', ()=>newGame(currentPlayer));
document.getElementById('startBtn').addEventListener('click', startGameFlow);
boardEl.addEventListener('touchstart', onTouchStart, {passive:true});
boardEl.addEventListener('touchend', onTouchEnd, {passive:true});
boardEl.addEventListener('mousedown', onMouseDown); window.addEventListener('mouseup', onMouseUp);

function startGameFlow(){ const name=(nameEl.value||'').trim(); if(!name) return alert('Please enter player name first'); currentPlayer=name.slice(0,20); playerLabelEl.textContent=currentPlayer; startScreenEl.classList.add('hidden'); gameScreenEl.classList.remove('hidden'); if(audioCtx&&audioCtx.state==='suspended') audioCtx.resume(); newGame(currentPlayer); }

const randColor=()=>Math.floor(Math.random()*COLORS); const idx=(r,c)=>r*SIZE+c; const rc=i=>[Math.floor(i/SIZE), i%SIZE];
const adjacent=(a,b)=>{const [ar,ac]=rc(a),[br,bc]=rc(b); return Math.abs(ar-br)+Math.abs(ac-bc)===1;};

function newGame(name){ if(name) currentPlayer=name; score=0; moves=MOVES_MAX; selected=null; board=Array.from({length:SIZE*SIZE}, randColor); while(findMatches().size){ clearMatches(findMatches()); applyGravityNoFill(); fillInstant(); } dropMap.clear(); render(); }

function render(){ scoreEl.textContent=score; movesEl.textContent=moves; boardEl.innerHTML=''; board.forEach((color,i)=>{ const d=document.createElement('button'); d.className='cell'; d.dataset.index=String(i); if(color===null)d.classList.add('empty'); else d.classList.add(`c${color}`); if(selected===i)d.classList.add('selected'); const dist=dropMap.get(i); if(dist&&color!==null){ d.classList.add('drop'); d.style.setProperty('--drop',String(dist)); d.style.animationDelay=`${Math.min(220,dist*22)}ms`; } d.addEventListener('click',()=>onCell(i)); boardEl.appendChild(d); }); renderLeaderboard(); }

async function onCell(i){ if(busy||moves<=0)return; if(selected===null){selected=i; return render();} if(selected===i){selected=null; return render();} if(!adjacent(selected,i)){selected=i; return render();} await attemptSwap(selected,i); selected=null; render(); }
async function attemptSwap(a,b){ busy=true; playSwapSfx(); await animateSwap(a,b); swap(a,b); render(); let matches=findMatches(); if(!matches.size){ await animateInvalidSwap(a,b); swap(a,b); busy=false; render(); return; } moves--; await resolveMatches(matches); busy=false; }
const swap=(a,b)=>{[board[a],board[b]]=[board[b],board[a]]};

function findMatches(){ const set=new Set();
 for(let r=0;r<SIZE;r++){ let run=1; for(let c=1;c<=SIZE;c++){ const prev=board[idx(r,c-1)], cur=(c<SIZE?board[idx(r,c)]:-1); if(cur!==null&&cur===prev) run++; else { if(run>=3&&prev!==null) for(let k=0;k<run;k++) set.add(idx(r,c-1-k)); run=1; }}}
 for(let c=0;c<SIZE;c++){ let run=1; for(let r=1;r<=SIZE;r++){ const prev=board[idx(r-1,c)], cur=(r<SIZE?board[idx(r,c)]:-1); if(cur!==null&&cur===prev) run++; else { if(run>=3&&prev!==null) for(let k=0;k<run;k++) set.add(idx(r-1-k,c)); run=1; }}}
 return set; }

function clearMatches(set){ const bonus=set.size>=4?Math.floor(set.size/2):0; const points=set.size*10+bonus; score += points; set.forEach(i=>board[i]=null); return points; }
function applyGravityNoFill(){ for(let c=0;c<SIZE;c++){ let write=SIZE-1; for(let r=SIZE-1;r>=0;r--){ const from=idx(r,c), v=board[from]; if(v!==null){ const to=idx(write,c); board[to]=v; if(to!==from) board[from]=null; write--; } } for(let r=write;r>=0;r--) board[idx(r,c)]=null; } }
function fillInstant(){ for(let i=0;i<board.length;i++) if(board[i]===null) board[i]=randColor(); }

async function resolveMatches(initial){ let m=initial, comboChain=0, seriesPoints=0;
 while(m.size){ comboChain++;
 playMatchSfx(m.size); if(m.size>=5||comboChain>=2) triggerScreenShake(Math.min(10,4+m.size*.45));
 spawnParticles(m);
 await animateVanish(m);
 const gained = clearMatches(m);
 seriesPoints += gained;
 dropMap.clear(); render(); await wait(120);
 applyGravityNoFill(); dropMap.clear(); render(); await wait(80);
 await fillWithCascadeAnimation(); m=findMatches(); }
 // show combo for whole chain from one player move (including auto-cascades)
 if(seriesPoints>=100) showCombo(seriesPoints);
 if(moves<=0) finishGame(); }

function showCombo(points){ const t=Math.max(0, Math.min(1, (points-100)/300)); // 100..400+
 const hue = 50 - Math.round(50*t); // yellow(50) -> red(0)
 const label = points >= 300 ? 'Monster Combo!' : points >= 220 ? 'Awesome!' : points >= 150 ? 'Great!' : 'Nice!';
 comboPopupEl.textContent = String(points);
 comboPopupEl.style.color = `hsl(${hue} 95% 60%)`;
 comboPopupEl.style.textShadow = `0 0 12px hsla(${hue} 95% 60% / .55), 0 6px 20px rgba(0,0,0,.35)`;
 comboPopupEl.classList.remove('hidden','show');
 comboLabelEl.textContent = label;
 comboLabelEl.style.color = `hsl(${hue} 95% 70%)`;
 comboLabelEl.classList.remove('hidden','show');
 void comboPopupEl.offsetWidth;
 comboPopupEl.classList.add('show');
 comboLabelEl.classList.add('show');
 setTimeout(()=>{ comboPopupEl.classList.remove('show'); comboLabelEl.classList.remove('show'); }, 920);
}

function spawnParticles(matchSet){ const rect = boardEl.getBoundingClientRect(); const cells=boardEl.querySelectorAll('.cell');
 matchSet.forEach(i=>{ const c=cells[i]; if(!c) return; const cr=c.getBoundingClientRect(); const cx=cr.left-rect.left+cr.width/2, cy=cr.top-rect.top+cr.height/2;
 const color = getComputedStyle(c).backgroundColor || '#fff';
 for(let p=0;p<6;p++){ const el=document.createElement('span'); el.className='pfx'; el.style.left=`${cx}px`; el.style.top=`${cy}px`; el.style.width=`${4+Math.random()*5}px`; el.style.height=el.style.width; el.style.background=color; el.style.setProperty('--tx', `${(Math.random()-0.5)*46}px`); el.style.setProperty('--ty', `${(Math.random()-0.5)*46}px`); boardEl.appendChild(el); setTimeout(()=>el.remove(), 520);} }); }

async function fillWithCascadeAnimation(){ dropMap.clear(); for(let c=0;c<SIZE;c++){ let empties=[]; for(let r=0;r<SIZE;r++) if(board[idx(r,c)]===null) empties.push(r); for(let k=0;k<empties.length;k++){ const r=empties[k], i=idx(r,c); board[i]=randColor(); dropMap.set(i, empties.length-k+1); } } render(); await wait(500); dropMap.clear(); render(); }

async function animateSwap(a,b){ const cells=boardEl.querySelectorAll('.cell'); const ca=cells[a], cb=cells[b]; if(!ca||!cb) return; const ra=ca.getBoundingClientRect(), rb=cb.getBoundingClientRect(); const dx=rb.left-ra.left, dy=rb.top-ra.top; ca.style.transform=`translate(${dx}px,${dy}px) scale(1.04)`; cb.style.transform=`translate(${-dx}px,${-dy}px) scale(1.04)`; await wait(190); ca.style.transform=''; cb.style.transform=''; }
async function animateInvalidSwap(a,b){ playErrorSfx(); const cells=boardEl.querySelectorAll('.cell'); const ca=cells[a], cb=cells[b]; if(!ca||!cb) return; ca.classList.add('shake'); cb.classList.add('shake'); await wait(280); ca.classList.remove('shake'); cb.classList.remove('shake'); await animateSwap(a,b); }
async function animateVanish(matchSet){ const cells=boardEl.querySelectorAll('.cell'); matchSet.forEach(i=>cells[i]?.classList.add('vanish')); await wait(300); }

function finishGame(){ const name=(currentPlayer||'Anonymous').trim().slice(0,20); const key='match3_leaderboard_v1'; const list=JSON.parse(localStorage.getItem(key)||'[]'); list.push({name,score,date:new Date().toISOString()}); list.sort((a,b)=>b.score-a.score); localStorage.setItem(key,JSON.stringify(list.slice(0,10))); alert(`Game over, ${name}! Score: ${score}`); }
function renderLeaderboard(){ const list=JSON.parse(localStorage.getItem('match3_leaderboard_v1')||'[]'); leaderboardEl.innerHTML=list.map(x=>`<li><strong>${escapeHtml(x.name)}</strong> — ${x.score}</li>`).join('')||'<li>No scores yet</li>'; }

function onTouchStart(e){ if(busy||moves<=0)return; const t=e.changedTouches[0]; const el=document.elementFromPoint(t.clientX,t.clientY)?.closest('.cell'); if(!el)return; touchStart={x:t.clientX,y:t.clientY,index:Number(el.dataset.index)}; }
async function onTouchEnd(e){ if(!touchStart||busy||moves<=0)return; const t=e.changedTouches[0]; const move=directionTarget(touchStart.index,t.clientX-touchStart.x,t.clientY-touchStart.y); touchStart=null; if(!move)return; await attemptSwap(move[0],move[1]); render(); }
function onMouseDown(e){ if(busy||moves<=0)return; const el=e.target.closest('.cell'); if(!el)return; pointerStart={x:e.clientX,y:e.clientY,index:Number(el.dataset.index)}; }
async function onMouseUp(e){ if(!pointerStart||busy||moves<=0)return; const move=directionTarget(pointerStart.index,e.clientX-pointerStart.x,e.clientY-pointerStart.y); pointerStart=null; if(!move)return; await attemptSwap(move[0],move[1]); render(); }

function directionTarget(startIndex,dx,dy){ if(Math.abs(dx)<10&&Math.abs(dy)<10)return null; const [r,c]=rc(startIndex); let tr=r,tc=c; if(Math.abs(dx)>Math.abs(dy)) tc += dx>0?1:-1; else tr += dy>0?1:-1; if(tr<0||tc<0||tr>=SIZE||tc>=SIZE)return null; return [startIndex, idx(tr,tc)]; }
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const escapeHtml=s=>s.replace(/[&<>'"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":"&#39;"}[m]));
