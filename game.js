/* ===========================================
   Aventura para Esteban — versión estable 💘
   + Portada primero
   + Vidas (3 tortugas) + checkpoints / respawn
   + Montura arreglada (sin invencibilidad; salto/caída ajustados)
   =========================================== */

// ---- Navegación portada -> selección ----
function goToSelect(){
  document.getElementById('coverScreen')?.classList.add('hidden');
  document.getElementById('selectScreen')?.classList.remove('hidden');
}
window.goToSelect = goToSelect;

// ---- Canvas / contexto ----
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false; // mantiene sprites nítidos

// ---- Audio ----
const music    = document.getElementById('bgMusic');
const sfxJump  = document.getElementById('sfxJump');
const sfxMount = document.getElementById('sfxMount');
const sfxLose  = document.getElementById('sfxLose');

// ---- HUD / Overlays ----
const hud = document.getElementById('hud');
const rideHint = document.getElementById('rideHint');
const btnMute  = document.getElementById('btnMute');
const volRange = document.getElementById('volRange');
const btnReset = document.getElementById('btnReset');

const miniPoem = document.getElementById('miniPoemModal');
const btnContinue = document.getElementById('btnContinue');
const gameOver = document.getElementById('gameOver');
const btnRetry = document.getElementById('btnRetry');
const poemScreen = document.getElementById('poemScreen');
const heartsContainer = document.getElementById('heartsContainer');
const brokenHeartsContainer = document.getElementById('brokenHeartsContainer');
const praiseContainer = document.getElementById('praiseContainer');

// ---- Estado ----
let characterStyle = 'elegante'; // 'elegante' | 'casual'
let gravity = 0.6;
let ridingTurtle = false;
let gameStarted = false;
let gameEnded = false;
let paused = false;

let worldOffset = 0;
let baseSpeed = 3.0;
const keys = { left:false, right:false };

const GROUND_H = 92;

// --- Montura: brillo y salto potenciado (ajustado) ---
const GOLD = '#FFD700';
const MOUNT_SHADOW_BLUR = 22;
const MOUNT_JUMP_FORCE = 1.08;      // más bajo que antes
const MOUNT_GRAVITY_FACTOR = 1.08;  // cae un pelín más rápido

// --- Vidas (tortugas amarillas) + checkpoint ---
const MAX_LIVES = 3;
let lives = MAX_LIVES;

let checkpointX = 0;            // dónde reaparecer
let lastCheckpointSavedAt = 0;  // para checkpoint por distancia
const CHECKPOINT_EVERY = 600;   // cada ~600px
const RESPAWN_BACK = 220;       // reaparece un poco antes del checkpoint

// ---- Sprites (jugador / tortuga) ----
const PLAYER_COLS = 4, PLAYER_ROWS = 3;
let PFW = 64, PFH = 64;
const playerSprite = new Image();
playerSprite.onload = () => {
  if (playerSprite.naturalWidth) {
    PFW = Math.floor(playerSprite.naturalWidth / PLAYER_COLS);
    PFH = Math.floor(playerSprite.naturalHeight / PLAYER_ROWS);
  }
  renderPreviews();
};
playerSprite.onerror = () => buildPlayerSprite(playerSprite);
playerSprite.src = 'esteban-sprite.png';

const TURTLE_COLS = 4; let TFW = 64, TFH = 64;
const turtleSprite = new Image();
turtleSprite.onload = () => {
  if (turtleSprite.naturalWidth) {
    TFW = Math.floor(turtleSprite.naturalWidth / TURTLE_COLS);
    TFH = 64;
  }
};
turtleSprite.onerror = () => buildTurtleSprite(turtleSprite);
turtleSprite.src = 'tortuga-sprite.png';

// ---- Jugador ----
const player = { x:200, y:0, width:86, height:86, vy:0, jumping:false, frame:0 };

// ---- Entidades ----
const mushrooms = [];   // 🍄
const pipes     = [];   // tuberías
const platforms = [];   // ☁️
const flowers   = [];   // 🌸
const butterflies = []; // 🦋
const skyBubbles  = []; // ❤ / 🐢

let turtleSpawned=false, turtleX=null;

// Progreso / spawns
let lastPieceX=600, lastFlowerX=300, lastPieceType=null;
let obstaclesCleared=0, firstPoemShown=false, cloudStairsSpawned=false;

// Meta (camarón)
let shrimpSpawned=false, shrimpX=null;
const SHRIMP_W=58, SHRIMP_H=46;
const TARGET_OBSTACLES=8;

// ---- Medidas / resize ----
function resizeCanvas(){
  canvas.width = innerWidth;
  canvas.height = innerHeight;

  const groundY = canvas.height - (GROUND_H + player.height);
  const baseYMounted = canvas.height - (GROUND_H + player.height + 35);

  if(!ridingTurtle){
    player.y = groundY; player.vy=0; player.jumping=false;
  } else {
    player.y = Math.min(player.y, baseYMounted);
  }
}
resizeCanvas();
addEventListener('resize', resizeCanvas);

// ---- Portada -> Selección ya está arriba ----

// ---- Flujo de pantallas ----
function normalizeDate(s){
  if(!s) return '';
  const t=String(s).trim().replace(/[.\-]/g,'/').replace(/\s+/g,'');
  const m=t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if(!m) return '';
  return `${m[1].padStart(2,'0')}/${m[2].padStart(2,'0')}/${m[3]}`;
}
function chooseCharacter(style){
  characterStyle = (style==='elegante') ? 'elegante' : 'casual';
  document.getElementById('selectScreen').classList.add('hidden');
  document.getElementById('lockScreen').classList.remove('hidden');
}
window.chooseCharacter = chooseCharacter;

function checkPassword(){
  const pass=document.getElementById('password').value;
  if(normalizeDate(pass)==='28/01/2025'){
    document.getElementById('lockScreen').classList.add('hidden');
    document.getElementById('startScreen').classList.remove('hidden');
    startWelcomeParticles();
  } else {
    alert('Fecha incorrecta, intenta de nuevo mi amor.');
  }
}
window.checkPassword = checkPassword;

function startGame(){
  if(gameStarted) return;
  gameStarted=true; paused=false;

  stopWelcomeParticles();
  document.getElementById('startScreen').classList.add('hidden');
  canvas.classList.remove('hidden'); hud.classList.remove('hidden');

  // Reinicia vidas y checkpoints
  lives = MAX_LIVES; checkpointX = 0; lastCheckpointSavedAt = 0;

  createInitialDecor();
  ensureWorldAhead();
  seedSkyBubbles();

  // Música con reintento si el navegador lo bloquea
  try{
    const v = clampVolume(parseFloat(volRange.value));
    [music,sfxJump,sfxMount,sfxLose].forEach(a=>a.volume=v);
    music.currentTime=0;
    const p=music.play();
    if(p && p.catch){ p.catch(()=>addEventListener('pointerdown',()=>music.play().catch(()=>{}),{once:true})); }
  }catch(_){}

  requestAnimationFrame(gameLoop);
}
window.startGame = startGame;

// ---- Bienvenida (corazones/tortugas) ----
let startParticlesTimer=null;
function startWelcomeParticles(){
  stopWelcomeParticles();
  startParticlesTimer=setInterval(()=>{
    spawnFaller('❤',22); if(Math.random()<0.6) spawnFaller('🐢',26);
  },650);
}
function stopWelcomeParticles(){ if(startParticlesTimer){ clearInterval(startParticlesTimer); startParticlesTimer=null; } document.getElementById('startParticles').innerHTML=''; }
function spawnFaller(char,size){
  const el=document.createElement('div');
  el.className='fall-item'; el.textContent=char;
  el.style.left=Math.random()*100+'vw';
  el.style.fontSize=(size+Math.random()*6)+'px';
  el.style.animationDuration=(5+Math.random()*3)+'s';
  document.getElementById('startParticles').appendChild(el);
  setTimeout(()=>el.remove(),9000);
}

// ---- Sky bubbles ----
function seedSkyBubbles(){
  skyBubbles.length=0;
  const n=Math.floor(18+Math.random()*8);
  for(let i=0;i<n;i++){
    skyBubbles.push({
      x:Math.random()*canvas.width, y:Math.random()*(canvas.height*0.55),
      char:Math.random()<0.7?'❤':'🐢', size:16+Math.random()*12,
      speed:0.06+Math.random()*0.12, drift:(Math.random()<0.5?-1:1)*(0.02+Math.random()*0.04),
      parallax:0.12+Math.random()*0.28, phase:Math.random()*Math.PI*2, alpha:0.25+Math.random()*0.25
    });
  }
}
function drawSkyBubbles(dt){
  ctx.save(); ctx.globalCompositeOperation='lighter';
  skyBubbles.forEach(b=>{
    b.phase+=0.002*dt; b.y-=b.speed*(1+0.2*Math.sin(b.phase)); b.x+=b.drift;
    if(b.y<-20){ b.y=canvas.height*0.55+20; b.x=Math.random()*canvas.width; }
    const px=b.x - (worldOffset*b.parallax)%canvas.width;
    ctx.globalAlpha=b.alpha; ctx.font=`${Math.floor(b.size)}px Arial`; ctx.fillText(b.char, px, b.y); ctx.globalAlpha=1;
  });
  ctx.restore();
}

// ---- Controles ----
addEventListener('keydown', e=>{
  if(e.code==='Space'){ e.preventDefault(); jump(); return; }
  if(e.code==='ArrowLeft'||e.code==='KeyA') keys.left=true;
  if(e.code==='ArrowRight'||e.code==='KeyD') keys.right=true;
  if(e.code==='KeyE') tryMountTurtle();
});
addEventListener('keyup', e=>{
  if(e.code==='ArrowLeft'||e.code==='KeyA') keys.left=false;
  if(e.code==='ArrowRight'||e.code==='KeyD') keys.right=false;
});
canvas.addEventListener('touchstart', e=>{ e.preventDefault(); jump(); }, {passive:false});

function safePlay(a){ try{ a.currentTime=0; a.play().catch(()=>{});}catch(_){} }
function clampVolume(v){ return isNaN(v)?0.35:Math.max(0,Math.min(1,v)); }

// --- Salto (también montada) ---
function jump(){
  if(paused || gameEnded) return;
  if(!player.jumping){
    const boost = ridingTurtle ? MOUNT_JUMP_FORCE : 1;
    player.vy = -15 * boost;
    player.jumping = true;
    safePlay(sfxJump);
  }
}

function tryMountTurtle(){
  if(!turtleSpawned||ridingTurtle||paused) return;
  const sx=turtleX-worldOffset;
  if(Math.abs(sx-(player.x+player.width/2))<110){
    ridingTurtle=true; rideHint.classList.add('hidden');
    player.jumping=false; player.vy=0; safePlay(sfxMount);
  }
}

// ---- Mundo / piezas intercaladas ----
function createInitialDecor(){
  flowers.length=0;
  for(let i=0;i<8;i++) flowers.push({ x: 140 + i*140, kind: i%2 ? '🌸' : '🌼' });
}

function ensureWorldAhead(){
  const diff=1+obstaclesCleared*0.18;
  const MIN_GAP=220/diff, EXTRA=260/diff;

  // Meta
  if(!shrimpSpawned && obstaclesCleared>=TARGET_OBSTACLES){
    shrimpSpawned=true; shrimpX=lastPieceX+380;
  }

  const limit = shrimpSpawned ? (shrimpX+800) : (worldOffset + canvas.width*6);
  while(lastPieceX < limit){
    if(shrimpSpawned && lastPieceX + 240 > shrimpX) break;

    // no repetir tipo seguido
    let type = Math.random()<0.6 ? 'mushroom' : 'pipe';
    if(type===lastPieceType) type = (type==='pipe') ? 'mushroom' : 'pipe';

    if(type==='mushroom'){
      const w=44, h=44;
      mushrooms.push({x:lastPieceX, w, h, passed:false});
      lastPieceX += w + (MIN_GAP + Math.random()*EXTRA);
    }else{
      const w = 90 + Math.random()*30;
      const h = 70 + Math.random()*60;
      pipes.push({x:lastPieceX, w, h, passed:false});
      lastPieceX += w + (MIN_GAP + Math.random()*EXTRA);
    }
    lastPieceType = type;
  }

  // flores deco
  const fLimit = worldOffset + canvas.width*6;
  while(lastFlowerX < fLimit){
    flowers.push({ x:lastFlowerX, kind: Math.random()<0.5 ? '🌸' : '🌼' });
    lastFlowerX += 120 + Math.random()*160;
  }

  // mariposas
  if(Math.random()<0.010 && butterflies.length<6){
    butterflies.push({
      x: Math.random()*canvas.width, y: 70 + Math.random()*160,
      dir: Math.random()<0.5 ? 1 : -1, speed: 0.25 + Math.random()*0.35,
      amp: 10 + Math.random()*12, life: 6 + Math.random()*6, phase: Math.random()*Math.PI*2
    });
  }
}

// ---- Fondo pastel / parallax ----
function drawBackground(dt){
  const g=ctx.createLinearGradient(0,0,0,canvas.height);
  g.addColorStop(0,'#ffd1e8'); g.addColorStop(0.45,'#ffead6'); g.addColorStop(1,'#efe2cf');
  ctx.fillStyle=g; ctx.fillRect(0,0,canvas.width,canvas.height);

  const rg=ctx.createRadialGradient(canvas.width*0.5, canvas.height*0.40, 0, canvas.width*0.5, canvas.height*0.45, canvas.height*0.65);
  rg.addColorStop(0,'rgba(255,255,255,.18)'); rg.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=rg; ctx.fillRect(0,0,canvas.width,canvas.height);

  drawSkyBubbles(dt);

  drawHillsLayer(0.18, '#f7c3d7', '#f4acc7', 120);
  drawHillsLayer(0.30, '#f3d39e', '#e7c78f', 170);
  drawHillsLayer(0.46, '#cfe8b4', '#bfe09f', 210);
  drawBushLayer (0.62, '#a6d59a', 18);

  // Suelo
  const grd=ctx.createLinearGradient(0, canvas.height-GROUND_H-30, 0, canvas.height);
  grd.addColorStop(0,'#c9ffc0'); grd.addColorStop(1,'#b5efab');
  ctx.fillStyle=grd; ctx.fillRect(0, canvas.height-GROUND_H, canvas.width, GROUND_H);
  ctx.strokeStyle='#99dd88'; ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(0, canvas.height-GROUND_H); ctx.lineTo(canvas.width, canvas.height-GROUND_H); ctx.stroke();

  // Oclusión
  ctx.fillStyle='rgba(0,0,0,.10)';
  mushrooms.forEach(m=>{ const sx=m.x-worldOffset, y=canvas.height-(GROUND_H+4);
    ctx.beginPath(); ctx.ellipse(sx+m.w*0.5, y, m.w*0.55, 6, 0, 0, Math.PI*2); ctx.fill(); });
  pipes.forEach(p=>{ const sx=p.x-worldOffset+p.w/2, y=canvas.height-(GROUND_H-2);
    ctx.beginPath(); ctx.ellipse(sx, y, p.w*0.4, 5, 0, 0, Math.PI*2); ctx.fill(); });

  // Flores
  ctx.font='24px Arial';
  flowers.forEach(f=>{ const sx=f.x-worldOffset; if(sx<-80||sx>canvas.width+80) return; ctx.fillText(f.kind, sx, canvas.height-GROUND_H+6); });

  // Mariposas
  ctx.font='26px Arial';
  for(let i=butterflies.length-1;i>=0;i--){
    const b=butterflies[i]; b.x+=b.speed*b.dir; b.phase+=0.05; const yy=b.y+Math.sin(b.phase)*b.amp;
    ctx.fillText('🦋', b.x, yy); b.life -= dt/1000; if(b.life<=0||b.x<-30||b.x>canvas.width+30) butterflies.splice(i,1);
  }
}
function drawHillsLayer(parallax, body, dots, baseH){
  const step=260, off=(worldOffset*parallax)%(step*2);
  for(let i=-1;i<Math.ceil(canvas.width/step)+2;i++){
    const x=i*step-off, y=canvas.height-(GROUND_H+baseH);
    ctx.fillStyle=body; ctx.beginPath(); ctx.moveTo(x, canvas.height-GROUND_H);
    ctx.quadraticCurveTo(x+step*0.5, y-40, x+step, canvas.height-GROUND_H); ctx.closePath(); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.18)';
    ctx.beginPath(); ctx.ellipse(x+step*0.35, y+30, 26, 12, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle=dots;
    for(let d=0; d<5; d++){ ctx.beginPath(); const dx=x+40+d*40, dy=y+20+(d%2?18:0); ctx.arc(dx, dy, 12, 0, Math.PI*2); ctx.fill(); }
  }
}
function drawBushLayer(parallax,color,h){
  const step=120, off=(worldOffset*parallax)%(step*2);
  ctx.fillStyle=color; for(let i=-1;i<Math.ceil(canvas.width/step)+2;i++){
    const x=i*step-off, y=canvas.height-(GROUND_H-16);
    ctx.beginPath(); ctx.ellipse(x,y,36,h,0,0,Math.PI*2); ctx.fill();
  }
}

// ---- Hongo fallback (si emoji no se pinta) ----
function drawMushroomPixel(x, y, w, h){
  const capH = Math.floor(h * 0.55);
  const stemH = h - capH;
  const r = Math.floor(w/2);
  const capGrad = ctx.createLinearGradient(x, y, x, y+capH);
  capGrad.addColorStop(0, '#ff6b6b'); capGrad.addColorStop(1, '#c23b3b');
  ctx.fillStyle = capGrad;
  ctx.beginPath();
  ctx.moveTo(x, y+capH);
  ctx.quadraticCurveTo(x+r, y-capH*0.25, x+w, y+capH);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.beginPath(); ctx.ellipse(x + w*0.35, y + capH*0.4, w*0.12, capH*0.18, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + w*0.62, y + capH*0.28, w*0.10, capH*0.16, 0, 0, Math.PI*2); ctx.fill();
  const stemY = y + capH - 2;
  const stemW = Math.max(12, Math.floor(w*0.45));
  const stemX = x + (w - stemW)/2;
  const stemGrad = ctx.createLinearGradient(stemX, stemY, stemX, stemY+stemH);
  stemGrad.addColorStop(0, '#ffe1b3'); stemGrad.addColorStop(1, '#e8c08a');
  ctx.fillStyle = stemGrad; ctx.fillRect(stemX, stemY, stemW, stemH);
  ctx.strokeStyle = 'rgba(0,0,0,.15)';
  ctx.beginPath(); ctx.moveTo(x+4, y+capH-1); ctx.lineTo(x+w-4, y+capH-1); ctx.stroke();
}

// ---- Jugador ----
function drawPlayer(){
  const gY = canvas.height - GROUND_H;
  const dist = Math.max(0, (gY - (player.y + player.height)));
  const s = 0.9 - Math.min(0.6, dist/160);
  ctx.fillStyle='rgba(0,0,0,.20)';
  ctx.beginPath(); ctx.ellipse(player.x+player.width*0.5, gY-6, 18*s, 6*s, 0,0,Math.PI*2); ctx.fill();

  const row = ridingTurtle ? 2 : (characterStyle==='elegante' ? 0 : 1);
  ctx.drawImage(playerSprite, Math.floor(player.frame)*PFW, row*PFH, PFW, PFH, player.x, player.y, player.width, player.height);
}
function updatePlayer(dt){
  if(paused) return;

  const dts=Math.max(0.016, dt/16.6667);
  const speed=ridingTurtle? baseSpeed+1.2 : baseSpeed;

  // desplazamiento del mundo
  if(keys.left)  worldOffset=Math.max(0, worldOffset - speed*dts);
  if(keys.right) worldOffset+=speed*dts;

  // checkpoint por distancia
  if (worldOffset - lastCheckpointSavedAt >= CHECKPOINT_EVERY) {
    checkpointX = Math.max(checkpointX, worldOffset);
    lastCheckpointSavedAt = worldOffset;
  }

  // animación
  player.frame=(player.frame + (ridingTurtle ? 0.08 : 0.18))%PLAYER_COLS;

  // física vertical (ligeramente más gravedad montada)
  player.y += player.vy;
  player.vy += gravity * (ridingTurtle ? MOUNT_GRAVITY_FACTOR : 1);

  // arrastre horizontal de tortuga
  if(ridingTurtle){
    turtleX = worldOffset + player.x + 10;
  }

  // plataformas (aterrizaje suave)
  let onCloud=false;
  for(const p of platforms){
    const sx=p.x-worldOffset; if(sx+p.w<player.x||sx>player.x+player.width) continue;
    const pyB=player.y+player.height;
    if(pyB>=p.y && pyB<=p.y+20 && player.vy>=0){
      player.y=p.y-player.height; player.vy=0; player.jumping=false; onCloud=true; break;
    }
  }

  // suelo / base
  const groundY=canvas.height-(GROUND_H+player.height);
  const baseY = ridingTurtle ? (canvas.height-(GROUND_H+player.height+35)) : groundY;
  if(!onCloud && player.y>=baseY){
    player.y=baseY; player.vy=0; player.jumping=false;
  }

  // meta
  if(shrimpSpawned && !gameEnded){
    const sx=shrimpX-worldOffset, sy=canvas.height-(GROUND_H+SHRIMP_H+10);
    if(player.x+player.width>sx && player.x<sx+SHRIMP_W && player.y+player.height>sy-8){
      reachShrimpFinal();
    }
  }
}

// ---- Obstáculos / colisiones ----
function drawAndCollideObstacles(){
  const px=player.x, py=player.y, pw=player.width, ph=player.height;

  // 🍄 Hongos
  mushrooms.forEach(m=>{
    const sx=m.x-worldOffset, my=canvas.height-(GROUND_H+m.h);

    // Intentar emoji; si no se pinta, fallback
    let painted=true;
    try{
      ctx.save(); ctx.font="32px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji', system-ui, sans-serif";
      ctx.filter="drop-shadow(0 4px 6px rgba(0,0,0,.18))";
      const before = ctx.measureText('M').width;
      ctx.fillText('🍄', sx, my + m.h);
      const after = ctx.measureText('M').width; ctx.restore();
      if(before===after) painted=false;
    }catch(_){ painted=false; }
    if(!painted){ drawMushroomPixel(sx, my, m.w, m.h); }

    // superado -> checkpoint y progresión
    if(!m.passed && (worldOffset + px + pw/2) > (m.x + m.w)){
      m.passed=true; obstaclesCleared++;
      checkpointX = Math.max(checkpointX, m.x);
      if(obstaclesCleared===2 || obstaclesCleared===5) toastPraise('eso mi amor 💖');
      if(obstaclesCleared===4 && !firstPoemShown){ firstPoemShown=true; paused=true; miniPoem.classList.remove('hidden'); }
      baseSpeed=Math.min(baseSpeed+0.06, 4.2);
    }

    // colisión (seguro si cae por arriba; si no, pierde)
    const overlaps = px < sx + m.w && px + pw > sx && py < my + m.h && py + ph > my;
    if(overlaps){
      const fromTop=(py+ph)-my < 24 && player.vy>=0;
      if(fromTop){ player.y=my-ph; player.vy=0; player.jumping=false; }
      else { triggerGameOver(); }
    }
  });

  // 🟢 Tuberías
  pipes.forEach(p=>{
    const sx   = p.x - worldOffset;
    const topY = canvas.height - (GROUND_H + p.h);
    const rimH = 14;

    // Rim (verde)
    const rimGrad = ctx.createLinearGradient(sx, topY, sx, topY+rimH);
    rimGrad.addColorStop(0, '#7fff73'); rimGrad.addColorStop(0.5, '#3bd44f'); rimGrad.addColorStop(1, '#1f9b3a');
    ctx.fillStyle = rimGrad; ctx.fillRect(sx, topY, p.w, rimH);

    // Cuerpo
    const bodyGrad = ctx.createLinearGradient(sx, topY+rimH, sx, canvas.height-GROUND_H);
    bodyGrad.addColorStop(0, '#38c754'); bodyGrad.addColorStop(0.5, '#1f9b3a'); bodyGrad.addColorStop(1, '#167b2f');
    ctx.fillStyle = bodyGrad; ctx.fillRect(sx+6, topY+rimH, p.w-12, p.h - rimH);

    // Brillo
    const shineGrad = ctx.createLinearGradient(sx+10, topY, sx+20, topY+p.h);
    shineGrad.addColorStop(0, 'rgba(255,255,255,.35)'); shineGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = shineGrad; ctx.fillRect(sx+10, topY+6, 10, p.h-12);

    // si pasamos la tubería -> checkpoint
    if(!p.passed && (worldOffset + px + pw/2) > (p.x + p.w)){
      p.passed = true;
      checkpointX = Math.max(checkpointX, p.x);
    }

    // Tolerancia arriba
    const playerBottom = py + ph;
    const playerCenterX = px + pw*0.5;
    const overX = (playerCenterX > sx && playerCenterX < sx + p.w);

    const SAFE_TOP_MIN = topY - 8;
    const SAFE_TOP_MAX = topY + rimH + 6;

    // Aterrizaje seguro arriba → NO pierde
    const landing = overX && playerBottom >= SAFE_TOP_MIN && playerBottom <= SAFE_TOP_MAX && player.vy >= 0;
    if(landing){
      player.y = topY - ph; player.vy = 0; player.jumping = false;
      return;
    }

    // Cualquier contacto lateral/frontal → pierde (montada o no)
    const sideHit = px < sx + p.w && px + pw > sx && py < topY + p.h && py + ph > topY;
    if(sideHit){ triggerGameOver(); }
  });

  // meta
  if(shrimpSpawned) drawShrimp();
}

// ---- Toasts ----
function toastPraise(text){
  const el=document.createElement('div');
  el.className='praise'; el.textContent=text;
  praiseContainer.appendChild(el);
  setTimeout(()=>el.remove(),1000);
}

// ---- Tortuga (con brillo al montar) ----
function updateTurtle(){
  if(!turtleSpawned) return;
  if(ridingTurtle) turtleX=worldOffset+player.x+10;

  const sx=turtleX-worldOffset, ty=canvas.height-(GROUND_H+TFH);

  // sombra
  ctx.fillStyle='rgba(0,0,0,.15)'; ctx.beginPath();
  ctx.ellipse(sx+32, ty+TFH-6, 18,6,0,0,Math.PI*2); ctx.fill();

  // sprite (+ brillo si vas montada)
  const fr=Math.floor((performance.now()/160)%TURTLE_COLS);
  ctx.save();
  ctx.imageSmoothingEnabled=false;
  if(ridingTurtle){ ctx.shadowColor = GOLD; ctx.shadowBlur  = MOUNT_SHADOW_BLUR; }
  ctx.drawImage(turtleSprite, fr*TFW, 0, TFW, TFH, sx-10, ty+8, 78, 58);
  ctx.restore();

  // hint
  if(!ridingTurtle){
    const near=Math.abs(sx-(player.x+player.width/2))<120;
    if(near) rideHint.classList.remove('hidden'); else rideHint.classList.add('hidden');
  } else rideHint.classList.add('hidden');
}

// --- Rótulo "señor amarrillo" al montar ---
function drawMountLabel(){
  if(!ridingTurtle) return;
  ctx.save();
  ctx.font = 'bold 16px "Segoe UI", Nunito, sans-serif';
  ctx.fillStyle = GOLD;
  ctx.textAlign = 'center';
  ctx.shadowColor = GOLD;
  ctx.shadowBlur = 10;
  ctx.fillText('señor amarrillo', player.x + player.width/2, player.y - 12);
  ctx.restore();
}

// ---- Camarón / final ----
function drawShrimp(){
  const sx=shrimpX-worldOffset, sy=canvas.height-(GROUND_H+SHRIMP_H+10);
  ctx.fillStyle='rgba(0,0,0,.14)'; ctx.beginPath(); ctx.ellipse(sx+SHRIMP_W*0.5, sy+SHRIMP_H-6, 16,5,0,0,Math.PI*2); ctx.fill();
  ctx.save(); ctx.imageSmoothingEnabled=false;
  ctx.font="40px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji', system-ui, sans-serif";
  ctx.fillText('🦐', sx, sy+34); ctx.restore();
  const text='al fin llegaste mi amor', pad=12;
  ctx.save(); ctx.font='16px Nunito, system-ui, sans-serif';
  const tw=ctx.measureText(text).width, bx=sx+SHRIMP_W*0.5-(tw/2)-pad, by=sy-36;
  roundedRect(ctx,bx,by,tw+pad*2,28,12);
  ctx.fillStyle='rgba(255,255,255,.92)'; ctx.fill();
  ctx.strokeStyle='#ffd0df'; ctx.lineWidth=2; ctx.stroke();
  ctx.fillStyle='#ff5d8f'; ctx.fillText(text, bx+pad, by+19);
  ctx.restore();
}
function roundedRect(c,x,y,w,h,r){ c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); }
function reachShrimpFinal(){
  if(gameEnded) return; gameEnded=true;
  canvas.classList.add('hidden'); hud.classList.add('hidden');
  poemScreen.classList.remove('hidden'); startFinalHeartsRain();
}

// ---- HUD / Reset ----
let lastNonZeroVolume=0.35;
volRange.addEventListener('input', e=>{
  const v=clampVolume(parseFloat(e.target.value));
  [music,sfxJump,sfxMount,sfxLose].forEach(a=>a.volume=v);
  if(v>0) lastNonZeroVolume=v; btnMute.textContent=v===0?'🔇':'🔊';
});
btnMute.addEventListener('click', ()=>{
  if(music.volume>0){
    lastNonZeroVolume=music.volume; [music,sfxJump,sfxMount,sfxLose].forEach(a=>a.volume=0);
    volRange.value=0; btnMute.textContent='🔇';
  } else {
    const v=lastNonZeroVolume||0.35;
    [music,sfxJump,sfxMount,sfxLose].forEach(a=>a.volume=v);
    volRange.value=v; btnMute.textContent='🔊';
  }
});
btnReset.addEventListener('click', resetGame);
btnRetry.addEventListener('click', ()=>{ gameOver.classList.add('hidden'); clearBrokenHearts(); resetGame(); });

// Mini‑poema (botón fijo)
function onContinue(){
  miniPoem.classList.add('hidden'); paused=false;
  if(!cloudStairsSpawned){ cloudStairsSpawned=true; spawnCloudStairs(worldOffset+380); }
  if(!turtleSpawned){ turtleSpawned=true; turtleX=worldOffset+980; }
  // checkpoint al reanudar
  checkpointX = Math.max(checkpointX, worldOffset);
  lastCheckpointSavedAt = worldOffset;
}
window.onContinue = onContinue;

function spawnCloudStairs(startX){
  const stepX=140, stepY=68, baseY=canvas.height-(GROUND_H+110);
  for(let i=0;i<3;i++) platforms.push({x:startX+i*stepX, y:baseY-i*stepY, w:120, h:28, type:'cloud'});
  for(let i=0;i<3;i++) platforms.push({x:startX+(3+i)*stepX, y:baseY-(2-i)*stepY, w:120, h:28, type:'cloud'});
}

// Game Over + corazones
let brokenTimer=null, finalHeartsTimer=null;
function triggerGameOver(){
  // Si aún tienes vidas, reapareces unos pasos atrás
  if (lives > 1){
    lives--;
    safePlay(sfxLose);
    toastPraise(`perdiste una tortuguita 🐢 te quedan ${lives}`);
    respawnFromCheckpoint();
    return;
  }
  // Sin vidas -> Game Over normal
  if(gameEnded) return; gameEnded=true; safePlay(sfxLose);
  gameOver.classList.remove('hidden'); startBrokenHeartsRain();
}
function respawnFromCheckpoint(){
  gameEnded = false; paused = false;

  // Retrocede un poco desde el checkpoint guardado
  worldOffset = Math.max(0, checkpointX - RESPAWN_BACK);

  // Estado del jugador
  ridingTurtle = false; // reaparece sin montar
  player.vy = 0; player.jumping = false;
  const groundY = canvas.height - (GROUND_H + player.height);
  player.y = groundY;

  // Oculta overlay si estuviera abierto
  gameOver.classList.add('hidden');
  clearBrokenHearts();

  requestAnimationFrame(gameLoop);
}
function resetGame(){
  ridingTurtle=false; gameEnded=false; paused=false;
  worldOffset=0; baseSpeed=3.0;

  lives = MAX_LIVES; checkpointX = 0; lastCheckpointSavedAt = 0;

  lastPieceX=600; lastFlowerX=300; lastPieceType=null;
  obstaclesCleared=0; firstPoemShown=false; cloudStairsSpawned=false;
  turtleSpawned=false; turtleX=null;
  shrimpSpawned=false; shrimpX=null;

  mushrooms.length=0; pipes.length=0; platforms.length=0; flowers.length=0; butterflies.length=0; skyBubbles.length=0;
  createInitialDecor(); ensureWorldAhead(); seedSkyBubbles();
  poemScreen.classList.add('hidden'); canvas.classList.remove('hidden'); hud.classList.remove('hidden');
  requestAnimationFrame(gameLoop);
}
function startBrokenHeartsRain(){
  clearBrokenHearts();
  brokenTimer=setInterval(()=>{
    const el=document.createElement('div');
    el.className='broken-heart'; el.textContent='💔';
    el.style.left=Math.random()*100+'vw';
    el.style.fontSize=(18+Math.random()*10)+'px';
    el.style.animationDuration=(3.8+Math.random()*2.2)+'s';
    brokenHeartsContainer.appendChild(el);
    setTimeout(()=>el.remove(),7000);
  },120);
}
function clearBrokenHearts(){ if(brokenTimer){ clearInterval(brokenTimer); brokenTimer=null; } brokenHeartsContainer.innerHTML=''; }
function startFinalHeartsRain(){
  stopFinalHeartsRain();
  finalHeartsTimer=setInterval(()=>{
    const el=document.createElement('div');
    el.className='heart-fall'; el.textContent=Math.random()<0.2?'💕':'❤';
    el.style.left=Math.random()*100+'vw';
    el.style.fontSize=(16+Math.random()*12)+'px';
    el.style.animationDuration=(4.2+Math.random()*2.2)+'s';
    heartsContainer.appendChild(el);
    setTimeout(()=>el.remove(),8000);
  },160);
}
function stopFinalHeartsRain(){ if(finalHeartsTimer){ clearInterval(finalHeartsTimer); finalHeartsTimer=null; } heartsContainer.innerHTML=''; }

// ---- Previews (Elegante/Casual) ----
function renderPreviews(){
  const pe=document.getElementById('previewElegante');
  const pc=document.getElementById('previewCasual');
  if(!pe||!pc) return;
  if(playerSprite.naturalWidth===0){ setTimeout(renderPreviews,80); return; }

  const drawP=(cv,row,hue)=>{
    const c=cv.getContext('2d'); c.imageSmoothingEnabled=false;
    c.clearRect(0,0,cv.width,cv.height);
    const bg=c.createRadialGradient(cv.width/2,cv.height*0.42,10,cv.width/2,cv.height/2,80);
    bg.addColorStop(0,'#fff'); bg.addColorStop(1,hue);
    c.fillStyle=bg; c.fillRect(0,0,cv.width,cv.height);
    c.save(); c.beginPath(); c.arc(cv.width/2, cv.height/2, 60, 0, Math.PI*2); c.clip();
    c.drawImage(playerSprite, 0, row*PFH, PFW, PFH, 32, 24, 64, 64); c.restore();
  };
  drawP(pe,0,'#ffe6f1'); // elegante
  drawP(pc,1,'#fff6d6'); // casual
}

// ---- Loop ----
let lastTime=0;
function gameLoop(now){
  if(gameEnded) return;
  const dt=now-(lastTime||now); lastTime=now;

  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawBackground(dt);
  ensureWorldAhead();
  updateTurtle();
  updatePlayer(dt);
  drawAndCollideObstacles();
  drawPlatforms();
  drawPlayer();
  drawMountLabel();

  // HUD: vidas (3 tortugas amarillas)
  drawLivesHUD();

  requestAnimationFrame(gameLoop);
}
function drawPlatforms(){
  platforms.forEach(p=>{
    const sx=p.x-worldOffset; if(sx+p.w<-80||sx>canvas.width+80) return;
    ctx.save(); ctx.fillStyle='rgba(255,255,255,.96)'; ctx.strokeStyle='#ffd0df'; ctx.lineWidth=2;
    roundCloud(sx,p.y,p.w,p.h); ctx.fill(); ctx.stroke(); ctx.restore();
  });
}
function roundCloud(x,y,w,h){
  ctx.beginPath(); ctx.moveTo(x,y+h);
  ctx.quadraticCurveTo(x+w*.2, y+h-28, x+w*.35, y+h-6);
  ctx.quadraticCurveTo(x+w*.5, y-12,   x+w*.65, y+h-6);
  ctx.quadraticCurveTo(x+w*.8, y+h-24, x+w,     y+h);
  ctx.closePath();
}

/* --------- Sprites de respaldo (por si faltan PNG) --------- */
function buildPlayerSprite(target){
  const W=64*PLAYER_COLS, H=64*PLAYER_ROWS;
  const off=document.createElement('canvas'); off.width=W; off.height=H;
  const c=off.getContext('2d');
  const rr=(x,y,w,h,r)=>{ c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); };
  const hair=(cx,cy,r,col)=>{ c.fillStyle=col; c.beginPath(); c.arc(cx,cy,r,Math.PI,0); c.fill(); };
  const chibi=(x,y,{shirt,pants,mounted})=>{
    c.fillStyle='rgba(0,0,0,.10)'; c.beginPath(); c.ellipse(x+32,y+58,18,6,0,0,Math.PI*2); c.fill();
    c.fillStyle=pants; if(!mounted){ rr(x+20,y+38,10,18,3); c.fill(); rr(x+34,y+38,10,18,3); c.fill(); } else { rr(x+22,y+38,24,12,4); c.fill(); }
    c.fillStyle=shirt; rr(x+18,y+26,28,16,4); c.fill();
    c.fillStyle='#ffddb9'; c.beginPath(); c.arc(x+32,y+16,12,0,Math.PI*2); c.fill();
    hair(x+32,y+12,13,'#2b2b2b');
  };
  for(let i=0;i<4;i++) chibi(i*64, 0,              { shirt:'#8b1034', pants:'#2a2a2a', mounted:false });
  for(let i=0;i<4;i++) chibi(i*64, 64,             { shirt:'#f1c40f', pants:'#2a2a2a', mounted:false });
  for(let i=0;i<4;i++) chibi(i*64, 128+(i%2?1:-1), { shirt:'#8b1034', pants:'#2a2a2a', mounted:true  });
  target.src = off.toDataURL('image/png'); PFW=64; PFH=64; renderPreviews();
}
function buildTurtleSprite(target){
  const W=64*4, H=64;
  const off=document.createElement('canvas'); off.width=W; off.height=H;
  const c=off.getContext('2d');
  const rr=(x,y,w,h,r)=>{ c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); };
  for(let i=0;i<4;i++){
    const x=i*64;
    c.fillStyle='rgba(0,0,0,.10)'; c.beginPath(); c.ellipse(x+32,50,18,6,0,0,Math.PI*2); c.fill();
    c.fillStyle='#8fd18f'; rr(x+18,26,32,18,8); c.fill(); c.strokeStyle='#5da95d'; c.lineWidth=2; c.stroke();
    c.fillStyle='#ffe28a'; rr(x+10,32,20,14,6); c.fill(); rr(x+40,30,16,14,7); c.fill();
  }
  target.src = off.toDataURL('image/png');
}

/* -------- HUD: Vidas (3 tortugas amarillas) -------- */
const TURTLE_ICON = [
  [0,0,1,1,1,0,0],
  [0,1,1,1,1,1,0],
  [1,1,1,1,1,1,1],
  [1,1,0,1,1,0,1],
  [1,1,1,1,1,1,1],
  [0,0,1,1,1,1,0],
];
function drawPattern(x, y, u, pattern, fill, edge, alpha=1){
  ctx.save(); ctx.globalAlpha=alpha; ctx.fillStyle=edge;
  for(let r=0;r<pattern.length;r++) for(let c=0;c<pattern[r].length;c++){
    if(!pattern[r][c]) continue;
    ctx.fillRect(Math.round(x + c*u - 1), Math.round(y + r*u), u, u);
    ctx.fillRect(Math.round(x + c*u + 1), Math.round(y + r*u), u, u);
    ctx.fillRect(Math.round(x + c*u), Math.round(y + r*u - 1), u, u);
    ctx.fillRect(Math.round(x + c*u), Math.round(y + r*u + 1), u, u);
  }
  ctx.fillStyle=fill;
  for(let r=0;r<pattern.length;r++) for(let c=0;c<pattern[r].length;c++){
    if(!pattern[r][c]) continue;
    ctx.fillRect(Math.round(x + c*u), Math.round(y + r*u), u, u);
  }
  ctx.restore();
}
function drawTurtleIcon(x, y, filled=true){
  const u = 2;
  const fill = filled ? '#FFD54A' : '#FFE9A6'; // amarilla / vacía
  const edge = filled ? '#B68600' : '#CFAF5A';
  drawPattern(x, y, u, TURTLE_ICON, fill, edge, 0.96);
}
function drawLivesHUD(){
  const x0=14, y0=14, gap=26;
  for(let i=0;i<MAX_LIVES;i++){
    drawTurtleIcon(x0 + i*gap, y0, i < lives);
  }
}