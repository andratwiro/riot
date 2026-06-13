/* RIOT viewer — THE FOOTER ROOM (live sessions only). Loads after live.js.

   The reorganisation (Rob, 2026-06-13, docs/FOOTER_ROOM.md): the room's people
   leave the top strip and the per-card piles, and live at the BOTTOM as one
   organic crowd. Two states, bound to the current card, mirroring the card body
   above:

     voting  → a loose physics cluster, everyone milling, centred.
     reveal  → the SAME bodies fan to the sides into Against / Abstain / For
               piles under the card's columns; non-voters drift up, out of the
               piles; the crowd keeps absorbing faces live as the room casts.
     advance → regroup to the centre cluster.

   Official lives up top (the card: stamp + party circles). Informal lives down
   here (these emoji). They never mix. No titles, no counts — the heap is the
   quantity; the exact figures are on the card. Your face wears the violet ring
   and the wave gives it an upward impulse.

   Scope: LIVE ONLY. async rooms and solo never switch the footer on (RF.active()
   is false), so this file is inert outside a sitting. The moderator stage keeps
   its enlarged piles (live.js renderLivePiles) untouched.

   Physics: attraction to a per-body target, neighbour repulsion with a little
   overlap tolerated (the "slightly colliding, busy" feel), gentle jitter,
   damping. Transforms and opacity only, so the 60fps presence floor holds.
   prefers-reduced-motion places bodies at their targets with no loop. */
(function(){
  const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const COLX = {against:0.16, abstain:0.5, for:0.84};   // column centres (fraction of width)
  let el=null, on=false, raf=0, W=320, H=150;
  const bodies=new Map();                                // pid -> body
  let curId=null, mode="cluster";                        // mode: cluster | piles

  function host(){ return el || (el=document.getElementById("roomfloor")); }
  // size by count, mirroring the lobby's step (diameter px) — big when few,
  // tighter as the seats fill so a full house still fits the band
  // a touch smaller than the chamber's party discs deserve the eye — the crowd
  // is the informal layer, it shouldn't fight the parties up top (Rob, 2026-06-13)
  function diam(n){ return n<=6?44 : n<=12?38 : n<=20?33 : n<=32?28 : 24; }
  // the footer is a SUBORDINATE strip under the card: pinned at the bottom, its
  // height set from how much room there is to the card and how many people are
  // here — a few sit low, a crowd lifts the towers slightly, never crowding the
  // card. (Rob, 2026-06-13: take the vertical space until the card into account.)
  function sizeFloor(){
    const h=host(); if(!h) return;
    const stack=document.getElementById("stack");
    const cardBottom = stack ? stack.getBoundingClientRect().bottom : window.innerHeight*0.4;
    const MB=74, MINGAP=18;                                  // wave clearance + a gap to the card
    const avail = window.innerHeight - cardBottom - MB - MINGAP;
    const want = 110 + (bodies.size||1)*4;                   // few stay low; more lift the towers a little
    h.style.height = Math.round(Math.max(96, Math.min(want, Math.max(96, avail)))) + "px";
  }
  function measure(){ const h=host(); if(!h) return; sizeFloor(); const r=h.getBoundingClientRect();
    W=r.width||W; H=r.height||H; }

  // the room as the footer sees it: me first (it owns the violet ring), then
  // every peer seated in this sitting — exactly the lobby's roster.
  function roster(){
    const out=[];
    if(typeof identity!=="undefined") out.push({pid:"me", e:(identity&&identity.emoji)||""});
    if(typeof mpVisiblePids==="function")
      for(const pid of mpVisiblePids()) out.push({pid, e:(PEERS[pid]&&PEERS[pid].e)||""});
    return out;
  }
  function rand(a,b){ return a+Math.random()*(b-a); }

  /* reconcile the bodies to the current roster: spawn newcomers near the centre,
     retire anyone who left, retune every radius for the new headcount. */
  function sync(){
    const h=host(); if(!h) return;
    const list=roster(), N=Math.max(list.length,1);
    const d=diam(N), seen=new Set();
    for(const {pid,e} of list){
      seen.add(pid);
      let b=bodies.get(pid);
      if(!b){
        const node=document.createElement("div");
        node.className="rf-body"+(pid==="me"?" me":"");
        node.textContent=e||"·";
        h.appendChild(node);
        b={pid, el:node, me:pid==="me",
           x:rand(W*0.3,W*0.7), y:rand(H*0.3,H*0.7), vx:0, vy:0,
           tx:W/2, ty:H/2, pop:0, delay:0, born:perfNow()};
        bodies.set(pid,b);
      } else if(b.el.textContent!==(e||"·")){ b.el.textContent=e||"·"; }
      const sz=b.me?Math.round(d*1.06):d;
      b.r=sz/2;
      b.el.style.width=sz+"px"; b.el.style.height=sz+"px";
      b.el.style.fontSize=Math.round(sz*0.52)+"px";
    }
    for(const [pid,b] of bodies){
      if(!seen.has(pid)){ b.el.remove(); bodies.delete(pid); }
    }
    setTargets();
    if(REDUCE) placeStatic();
  }

  // direction for a body on the current card: mine from `answers`, peers' from
  // the cast markers (LIVE.peerVotes). No cast = timed out / not yet in.
  function dirOf(b,id){
    if(b.me) return (typeof answers!=="undefined") ? answers[id]||null : null;
    if(window.LIVE && LIVE.peerVotes){ const v=LIVE.peerVotes(b.pid); return (v&&v[id])||null; }
    return null;
  }
  function setTargets(){
    const now=perfNow();
    if(mode==="cluster"){
      // a loose crowd resting on the FLOOR (gravity-down feel, not a centre
      // well). The live sim applies real gravity in step(); these targets are
      // only the reduced-motion / static fallback: centred rows piling up from
      // the floor, spread across the width.
      const list=[...bodies.values()];
      const d=(list[0]?list[0].r*2:38)*0.98;
      const per=Math.max(1,Math.floor((W-6)/d));
      list.forEach((b,i)=>{
        const row=Math.floor(i/per), col=i%per;
        const rowN=Math.min(per,list.length-row*per), rowW=rowN*d;
        b.tx=(W-rowW)/2+col*d+d/2; b.ty=H-b.r-row*d*0.92;
        b.delay=0; b.noVote=false;
      });
      return;
    }
    // piles: each direction is a HEAP — a wide base narrowing upward, rising
    // TALLER with more emojis (a leaf pile, not a tower). Bodies settle into
    // pyramid slots with overlapping spacing; repulsion + jitter keep it organic.
    const groups={against:[],abstain:[],for:[]}, none=[];
    const list=[...bodies.values()].sort((a,b)=>a.pid<b.pid?-1:a.pid>b.pid?1:0);
    for(const b of list){ const dir=dirOf(b,curId);
      if(dir && groups[dir]) groups[dir].push(b); else none.push(b); }
    const d=(list[0]?list[0].r*2:34), spX=d*0.66, spY=d*0.62, floorY=H-d/2-3;
    const maxBase=Math.max(2,Math.floor((W*0.32)/spX));        // keep each heap inside its third
    for(const k in groups){
      const arr=groups[k], cx=W*COLX[k], n=arr.length;
      const base=Math.min(maxBase, Math.max(1, Math.ceil((Math.sqrt(8*n+1)-1)/2)));
      const rows=[]; let rem=n, w=base;
      while(rem>0){ const c=Math.min(w,rem); rows.push(c); rem-=c; if(w>1)w--; }   // base, base-1, … then 1s
      let i=0;
      rows.forEach((cnt,r)=>{ for(let c=0;c<cnt;c++){ const b=arr[i++];
        b.tx=cx+(c-(cnt-1)/2)*spX; b.ty=floorY-r*spY;        // bottom row widest, heap upward
        b.delay=b.me?now:now+rand(80,1100); b.noVote=false; } });
    }
    // the undecided hang back at the very bottom, mostly clipped — just heads
    // peeping up below the heaps, never floating on top (Rob, 2026-06-13)
    none.forEach(b=>{ let h=0; for(let i=0;i<b.pid.length;i++) h=(h*31+b.pid.charCodeAt(i))>>>0;
      b.tx=W*(0.08+0.84*((h%1000)/1000)); b.ty=H+d*0.35; b.delay=0; b.noVote=true; });
  }

  /* ---- the loop ---- */
  function step(){
    const DAMP=0.86, MAXV=7, now=perfNow();
    const GRAV=0.30, COHX=0.005;                         // cluster: gravity to the floor + gentle horizontal cohesion
    const PILE_K=0.045, JIT=(mode==="piles"?0.035:0.06);
    for(const b of bodies.values()){
      let ax=0, ay=0;
      if(mode==="cluster"){
        ay+=GRAV;                                        // settle onto the floor — extended, never a centre well
        ax+=(W/2-b.x)*COHX;                              // weak cohesion; repulsion does the sideways spreading
      } else if(now>=b.delay){                           // piles: pull to the column once the rain-in delay elapses
        const k=b.noVote?PILE_K*0.55:PILE_K;
        ax+=(b.tx-b.x)*k; ay+=(b.ty-b.y)*k;
      }
      ax+=(Math.random()-0.5)*JIT; ay+=(Math.random()-0.5)*JIT;
      b._ax=ax; b._ay=ay;
    }
    const arr=[...bodies.values()];
    for(let i=0;i<arr.length;i++) for(let j=i+1;j<arr.length;j++){
      const a=arr[i], c=arr[j];
      let dx=c.x-a.x, dy=c.y-a.y, dist=Math.hypot(dx,dy)||0.01;
      const min=(a.r+c.r)*(mode==="piles"?0.9:1.0);      // cluster just touches; heaps keep a little overlap
      if(dist<min){ const push=(min-dist)/min*0.95, ux=dx/dist, uy=dy/dist;
        a._ax-=ux*push; a._ay-=uy*push; c._ax+=ux*push; c._ay+=uy*push; }
    }
    for(const b of arr){
      b.vx=(b.vx+b._ax)*DAMP; b.vy=(b.vy+b._ay)*DAMP;
      b.vx=Math.max(-MAXV,Math.min(MAXV,b.vx)); b.vy=Math.max(-MAXV,Math.min(MAXV,b.vy));
      b.x+=b.vx; b.y+=b.vy;
      const yhi=b.noVote?H+b.r*0.6:H-b.r;              // undecided peep from the bottom edge; voters rest on the floor
      b.x=Math.max(b.r,Math.min(W-b.r,b.x)); b.y=Math.max(b.r,Math.min(yhi,b.y));
      if(b.pop>0.01) b.pop*=0.84; else b.pop=0;
      place(b);
    }
    raf=requestAnimationFrame(step);
  }
  function place(b){ const s=1+b.pop;
    b.el.style.transform=`translate(${(b.x-b.r).toFixed(2)}px,${(b.y-b.r).toFixed(2)}px) scale(${s.toFixed(3)})`; }
  function placeStatic(){ for(const b of bodies.values()){ b.x=b.tx; b.y=b.ty; place(b); } }
  function perfNow(){ return (window.performance&&performance.now)?performance.now():0; }

  function start(){ if(on||REDUCE) return; on=true; raf=requestAnimationFrame(step); }
  function stop(){ on=false; cancelAnimationFrame(raf); raf=0; }

  /* ---- public surface (live.js + multiplayer.js call these) ---- */
  window.RF={
    active(){ return !!(host() && document.body.classList.contains("live-floor")); },
    // footer becomes visible / hidden with the deck (live.js liveFloor)
    show(v){
      if(v){ measure(); sync();
        if(REDUCE){ placeStatic(); } else start(); }
      else { stop(); }
    },
    sync(){ if(this.active()){ measure(); sync(); if(REDUCE) placeStatic(); } },
    cluster(){ if(!this.active()) return; mode="cluster"; curId=null; measure(); setTargets(); if(REDUCE) placeStatic(); },
    piles(id){ if(!this.active()) return; mode="piles"; curId=id; measure(); sync(); /* sync calls setTargets */ },
    regroup(){ this.cluster(); },
    // the wave (multiplayer.js bounceFace): an upward impulse on the matching body
    wave(pid,big){ const b=bodies.get(pid); if(!b) return; b.vy-=big?9:6.5; b.pop=big?0.34:0.26; },
    // a ballot landed (multiplayer.js activityTick): a quiet pop on that body
    tick(pid){ const b=bodies.get(pid); if(b) b.pop=Math.max(b.pop,0.16); }
  };
  window.addEventListener("resize",()=>{ if(window.RF&&RF.active()){ measure(); } });
})();
