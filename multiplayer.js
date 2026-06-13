/* RIOT viewer — the room (optional multiplayer, Firebase Realtime DB).
   Presence with names/emoji, anonymous per-decision tallies, room progress,
   activity ticks, room-wide reset. Degrades to single-player when
   FIREBASE_CONFIG is null or the SDK fails to load.

   Doctrine: the room broadcasts ACTIVITY, never DIRECTION. Participant records
   carry counts and timestamps, no votes. Vote directions exist in the shared
   layer ONLY as anonymous aggregate tallies (rooms/<room>/tallies/<id>/<dir>),
   written by atomic increments, rendered only after the viewer's own vote.

   Presence is SEAT-GATED (Rob, 2026-06): a participant record is written only
   when the visitor taps the seat gate (mpJoin), never on page load, and it
   carries the sitting it joined (s: sid). Every count and face filters by the
   current sid (mpVisiblePids) — a record from yesterday's sitting, or a tab
   that loaded the URL and never tapped, is structurally invisible.

   Test/demo rig: ?simroom=15 fakes a 15-person room with no backend at all —
   used by the screenshot skill and the 60fps presence-pulse check. */
const PEERS = {};                  // pid -> {e,nm,c,n,t,s}
let mpSelf=null, mpCtrl=null, mpPart=null, mpTallies=null, mpPid=null, mpSeenReset=null;
let mpJoined=false;                // this tab took a seat (the gate tap) — presence exists only then
let TALLIES = {};                  // decision id -> {for,against,abstain}
const SIM_N = (()=>{const v=parseInt(new URLSearchParams(location.search).get("simroom")||"",10);
                    return Number.isFinite(v)&&v>0?Math.min(v,40):0;})();
let simOn = SIM_N>0;

function roomActive(){ return !!(mpSelf || simOn || (window.LIVE && LIVE.simActive())); }
// the split's data source: null = no room → app.js skips the split beat entirely
function roomTally(id){
  if(window.LIVE && LIVE.active()) return LIVE.tally(id);   // live sessions tally per-session
  if(!roomActive()) return null;
  return TALLIES[id] || (TALLIES[id]={for:0,against:0,abstain:0});
}

/* ---- peer dots on the reveal map: small faded emojis (ink ring when faceless).
   The crowd is texture, never anchors — they sit below the party dots (z-index).
   Placement: in a live session EVERY participant — synthetic voters included —
   has a full ballot record in the cast markers, so each is a ROW of the same
   matrix the parties are in and sits at its row's coordinate; outside live
   sessions a peer sits at the position it published over presence (the
   canonical Room frame). Keyed by pid so a projection switch morphs the dots
   instead of re-dealing them. ---- */
/* which peers exist for THIS screen: in a live session only records seated in
   the current sitting (s === sid) — a record left by an older sitting or a
   tab that never tapped the gate is invisible everywhere. Sim rigs carry no
   sid; their records are the room by construction. */
function mpVisiblePids(){
  const pids=Object.keys(PEERS);
  if(!(window.LIVE && LIVE.active()) || LIVE.simActive()) return pids;
  return pids.filter(p=>PEERS[p].s===LIVE.sid());
}
function renderPeersInto(el){
  if(!el) return;
  const live=window.LIVE && LIVE.active();
  const seen=new Set();
  let i=0;
  for(const pid of mpVisiblePids()){
    const p=PEERS[pid];
    let c=null;
    // live peers carry a full ballot (cast markers); sim peers carry a fabricated
    // one — either way they're rows, looked up by pid. Real async peers have no
    // votes on this device, so they sit at the canonical position they published.
    const votes = live ? LIVE.peerVotes(pid) : (p.votes||null);
    const bc = votes?blendCoord(votes,pid):null;
    if(bc) c=toPct(bc);
    if(!c) c=p.c;
    i++;
    if(!c) continue;
    seen.add(pid);
    let d=el.querySelector(`.peer[data-pid="${CSS.escape(pid)}"]`);
    if(!d){
      d=document.createElement("div");
      d.dataset.pid=pid;
      d.className="peer"+(p.e?" emo":"");
      if(p.e) d.textContent=p.e;
      d.style.setProperty("--d",(60+i*40)+"ms");
      el.appendChild(d);
    }
    d.dataset.tx=c[0]; d.dataset.ty=c[1];          // TRUE pct — layoutMap pixel-clamps
    d.style.left=c[0]+"%"; d.style.top=c[1]+"%";
  }
  el.querySelectorAll(".peer").forEach(n=>{if(!seen.has(n.dataset.pid))n.remove();});
  if(typeof layoutMap==="function") layoutMap();
}
function renderPeers(){
  const rm=document.getElementById("resultMap"); if(rm && rm.innerHTML) renderPeersInto(rm);
}
// presence-driven map refresh, coalesced (see the mpPart listener)
const mapNudge=throttleTrail(()=>{
  if(typeof repositionMap==="function") repositionMap(); else renderPeers();
},300);

/* ---- the room strip: faces + activity pulse + room progress ---- */
const FACE_MAX=7;
let stripKey="";                   // membership fingerprint — rebuild faces only when it changes
// pid stamps the face with data-pid so a wave can find every copy of one
// person's avatar (strip, lobby, stage) and bounce it — see bounceFace.
function faceHTML(e,nm,me,pid){
  const pa=pid?` data-pid="${esc(pid)}"`:"";
  if(e) return `<span class="face${me?" me":""}"${pa} title="${esc(nm||"")}">${esc(e)}</span>`;
  const init=(nm||"·").slice(0,2);
  return `<span class="face init${me?" me":""}"${pa} title="${esc(nm||"")}">${esc(init)}</span>`;
}
/* the wave: a one-tap presence gesture. Every copy of a person's avatar bounces
   on every phone in the room — mine on tap (sendWave), a peer's when their wave
   counter ticks up over presence (the mpPart listener). Compositor-only.
   A short registry of who's mid-wave outlives the face re-renders: the lobby
   rebuilds #lobbyFaces' innerHTML on every presence ping, so the tapper's own
   hop (applied before the echo of their own write lands) would be wiped without
   re-applying it after each render — applyWaves() is called at the end of every
   face render (renderStrip, lobbyPresence, the stage). */
const waveState=new Map();            // pid -> {until, big, queued}: the hop in flight,
                                      // and whether the three-tap flip waits to follow it
function hopFace(pid,big,force){
  const cls=big?"wavebig":"wave", ms=big?940:780;
  document.querySelectorAll(`.face[data-pid="${CSS.escape(pid)}"]`).forEach(f=>{
    if(f.dataset.waving && !force) return;   // mid-hop & this is just a re-render — leave it
    f.classList.remove("wave","wavebig"); void f.offsetWidth; f.classList.add(cls);
    f.dataset.waving="1";
    clearTimeout(f._waveT);
    f._waveT=setTimeout(()=>{ f.classList.remove("wave","wavebig"); delete f.dataset.waving; },ms);
  });
}
function playHop(pid,big){ waveState.set(pid,{until:Date.now()+(big?940:780),big:!!big,queued:false}); hopFace(pid,!!big,true); }
/* a new wave gesture. Smoothness rule: while a hop is already playing on this
   avatar a further wave is DROPPED — never restarted, never queued — with one
   exception, the three-tap flip (big), which waits and plays once the current
   hop finishes (so a three-tap during a bounce reads as bounce-then-flip). */
// the wave button gently bobs whenever someone ELSE waves — a tiny presence
// indicator (it also idles with a slow wiggle in CSS). Not for my own waves.
function bobWaveBtn(){
  const b=document.getElementById("waveBtn"); if(!b) return;
  b.classList.remove("bob"); void b.offsetWidth; b.classList.add("bob");
  clearTimeout(b._bobT); b._bobT=setTimeout(()=>b.classList.remove("bob"),700);
}
function bounceFace(pid,big){
  if(window.RF) RF.wave(pid,big);           // the footer body gets an upward impulse too
  if(pid!=="me") bobWaveBtn();              // someone else waved → the button reacts
  const now=Date.now(), st=waveState.get(pid);
  if(st && now<st.until){                    // a hop is in progress
    if(big && !st.queued){                    // only the flip follows on
      st.queued=true;
      setTimeout(()=>{ const s=waveState.get(pid); if(s&&s.queued){ s.queued=false; playHop(pid,true); } },(st.until-now)+20);
    }
    return;                                   // a plain wave mid-hop is dropped
  }
  playHop(pid,big);
}
// re-apply an in-progress hop to a freshly rebuilt element (the lobby rebuilds its
// faces on every presence ping) — never starts or restarts, just re-attaches
function applyWaves(){
  const now=Date.now();
  for(const [pid,st] of waveState){
    if(now<st.until) hopFace(pid,st.big,false);
    else if(!st.queued) waveState.delete(pid);
  }
}
function renderStrip(){
  const strip=$("#roomstrip"); if(!strip) return;
  // multiplayer = the communal header: name only, no §/⚙/switcher (Rob,
  // 2026-06-13: settings is the solo experience). live.js carries the same
  // strip via its own body.live-* classes; this covers async/sim rooms.
  const active=roomActive();
  document.body.classList.toggle("in-room",active);
  if(!active){strip.hidden=true; return;}
  strip.hidden=false;
  const pids=mpVisiblePids();
  const key=[identity&&identity.emoji,...pids.map(p=>p+(PEERS[p].e||"")+(PEERS[p].nm||""))].join("|");
  if(key!==stripKey){
    stripKey=key;
    const faces=[faceHTML(identity&&identity.emoji,"you",true,"me")];
    for(const pid of pids.slice(0,FACE_MAX-1)) faces.push(faceHTML(PEERS[pid].e,PEERS[pid].nm,false,pid));
    if(pids.length>FACE_MAX-1) faces.push(`<span class="face more">+${pids.length-(FACE_MAX-1)}</span>`);
    $("#rsFaces").innerHTML=faces.join("");
    $("#rsFaces").dataset.pids=JSON.stringify(["me",...pids.slice(0,FACE_MAX-1)]);
    applyWaves();                    // a rebuild dropped any mid-wave hop — re-apply it
  }
  const count=pids.length+1;
  const ratios=[deck.length?Math.min(idx/deck.length,1):0];
  for(const pid of pids){const p=PEERS[pid]; if(p.t)ratios.push(Math.min((p.n||0)/p.t,1));}
  const avg=ratios.reduce((s,r)=>s+r,0)/ratios.length;
  // presence only — the faces carry the ambient signal; the "room %" average
  // proved illegible in the chip (it still drives the progress bar's violet tick)
  $("#rsLabel").textContent = count>1 ? `${count} here` : `waiting for the room`;
  setRoomProgress(count>1?avg:null);
}
// a ballot landed somewhere (mine or anyone's): one quiet ring — compositor-only
let pulseT=null;
function activityTick(pid){
  if(window.RF) RF.tick(pid);               // a quiet pop on that body in the footer crowd
  const pulse=$("#rsPulse");
  if(pulse){pulse.classList.remove("on"); void pulse.offsetWidth; pulse.classList.add("on");
    clearTimeout(pulseT); pulseT=setTimeout(()=>pulse.classList.remove("on"),750);}
  let pidList=[]; try{pidList=JSON.parse($("#rsFaces").dataset.pids||"[]");}catch(e){}
  const at=pidList.indexOf(pid);
  if(at>=0){
    const face=$("#rsFaces").children[at];
    if(face){face.classList.remove("tick"); void face.offsetWidth; face.classList.add("tick");}
  }
}

/* ---- the room aggregate (joint map): contribute my ballot's second moments once,
   read the room's running sum so the map's axes reflect everyone. No individual
   vote crosses the wire — only the summed covariance, like the anonymous tallies. */
let mpCov=null;
function mpContributeCov(){
  if(simOn || !mpCov || typeof jointMyRow!=="function") return;
  let done=false; try{done=sessionStorage.getItem("riot.cov."+CFG.id)==="1";}catch(e){}
  if(done) return;
  const row=jointMyRow(); if(!row.length) return;
  const inc=firebase.database.ServerValue.increment, upd={"k":inc(1)};
  for(const {j,v} of row) upd["s/"+j]=inc(v);
  for(let a=0;a<row.length;a++)for(let b=a;b<row.length;b++)
    upd["m2/"+row[a].j+"_"+row[b].j]=inc(row[a].v*row[b].v);
  mpCov.update(upd).catch(()=>{});
  try{sessionStorage.setItem("riot.cov."+CFG.id,"1");}catch(e){}
}
function parseCov(raw){
  const s={}, m2={};
  if(raw && raw.s) for(const j in raw.s) s[j]=raw.s[j];
  if(raw && raw.m2) for(const key in raw.m2) m2[key]=raw.m2[key];
  return {k:(raw&&raw.k)||0, s, m2};
}

/* ---- publishing: the gate tap is the join ----
   Loading the URL is NOT joining the sitting. A participant record exists only
   after mpJoin() (live.js calls it from the seat gate / a same-sid refresh),
   and it carries the sid it belongs to — so a record orphaned by a suspended
   phone can never haunt the next sitting's lobby or its all-in counts. */
function publishSelf(){
  renderStrip();
  if(!mpSelf || !mpJoined) return;
  const c=(typeof publishCoord==="function")?publishCoord():null;
  mpSelf.set({e:(identity&&identity.emoji)||"",
              c, n:Object.keys(answers).length, t:deck.length,
              s:(window.LIVE&&LIVE.sid())||null,
              ts:firebase.database.ServerValue.TIMESTAMP});
}
function mpJoin(){
  if(!mpSelf || mpJoined) return;
  mpJoined=true;
  mpSelf.onDisconnect().remove();
  publishSelf();
}
function mpLeave(){                 // the sitting moved on without this tab
  if(!mpSelf || !mpJoined) return;
  mpJoined=false;
  try{ mpSelf.onDisconnect().cancel(); }catch(e){}
  mpSelf.remove();
}
// called by app.js react(): my ballot → anonymous tally + presence. No-op single-player.
function mpVote(id,vote){
  // live session: tally + cast marker live under the session node, not the room's
  if(window.LIVE && LIVE.active()){
    LIVE.cast(id,vote);
    activityTick("me");
    renderStrip();
    // live placement comes from cast markers, never presence — per-vote presence
    // needs only the n bump (the strip's tick on other phones), not the full
    // record + a re-scored coordinate (publishSelf stays the join shape)
    if(mpSelf && mpJoined)
      mpSelf.update({n:Object.keys(answers).length, ts:firebase.database.ServerValue.TIMESTAMP});
    return;
  }
  if(simOn){ simCastRoom(id); const t=roomTally(id); t[vote]=(t[vote]||0)+1; activityTick("me"); renderStrip(); return; }
  if(!mpSelf){ return; }
  if(mpTallies) mpTallies.child(id).child(vote).transaction(v=>(v||0)+1);
  activityTick("me");
  publishSelf();
}
function localReset(){            // wipe my own session (mirrors "Start over") — used when the room resets
  try{sessionStorage.removeItem("riot.cov."+CFG.id);}catch(e){}   // re-contribute on the next run
  for(const k in answers) delete answers[k];
  deck=buildDeck(); idx=0; voting=false; splitUpdate=null;
  $("#done").style.display="none";
  renderStack(); publishSelf();
}
function resetEveryone(){
  if(!mpCtrl) return;
  mpCtrl.child("resetAt").set(firebase.database.ServerValue.TIMESTAMP);  // signal all clients
  mpPart.remove();                                                       // clear everyone's dots
  if(mpTallies) mpTallies.remove();                                      // clear the room's tallies
  if(mpCov) mpCov.remove();                                              // clear the joint-map aggregate
}
function mpInit(){
  if(simOn){ simInit(); return; }
  if(!window.FIREBASE_CONFIG || !window.firebase){ return; }   // single-player
  try{
    firebase.initializeApp(window.FIREBASE_CONFIG);
    const db=firebase.database(), room=CFG.id;
    window.mpDb=db;                       // live.js builds its store on the same handle
    // per-TAB identity (sessionStorage): each window is a distinct participant, and it
    // survives a refresh within that tab. (localStorage would make every window of the
    // same browser collapse into one participant.)
    try{mpPid=sessionStorage.getItem("riot.pid.v1");}catch(e){}
    if(!mpPid){mpPid="p"+Math.random().toString(36).slice(2,9);try{sessionStorage.setItem("riot.pid.v1",mpPid);}catch(e){}}
    mpPart=db.ref(`rooms/${room}/participants`);
    mpCtrl=db.ref(`rooms/${room}/control`);
    mpTallies=db.ref(`rooms/${room}/tallies`);
    mpCov=db.ref(`rooms/${room}/cov`);
    // the moderator observes the room but is not a voter: no participant record,
    // so ballots-in counts and "all present have cast" stay honest. Voters get
    // a ref only — nothing is WRITTEN until the seat gate's tap (mpJoin).
    if(window.LIVE_ROLE!=="mod"){
      mpSelf=mpPart.child(mpPid);
    }
    mpPart.on("value",snap=>{
      const all=snap.val()||{};
      const prev={},prevW={},prevWS={};
      for(const k in PEERS){prev[k]=PEERS[k].n; prevW[k]=PEERS[k].w||0; prevWS[k]=PEERS[k].ws||0; delete PEERS[k];}
      for(const k in all){ if(k!==mpPid) PEERS[k]={e:all[k].e||"",nm:all[k].nm||"",c:all[k].c||null,n:all[k].n||0,t:all[k].t||0,s:all[k].s||null,w:all[k].w||0,ws:all[k].ws||0}; }
      renderStrip();
      for(const k in PEERS){
        if(prev[k]!=null && PEERS[k].n>prev[k]) activityTick(k);
        if(prevWS[k]!=null && PEERS[k].ws>prevWS[k]) bounceFace(k,true);    // a three-tap super wave
        else if(prevW[k]!=null && PEERS[k].w>prevW[k]) bounceFace(k);       // a normal wave
      }
      // new known ballots are new ROWS — they can tug everyone, so reposition
      // the whole map (it renders peers too), not just the peer dots.
      // Trailing-throttled: at the final reveal every finisher's presence write
      // lands within seconds; on a non-default projection each one re-runs a
      // full SMACOF/t-SNE solve. Pre-reveal both calls no-op (no map yet).
      mapNudge();
    });
    mpTallies.on("value",snap=>{
      TALLIES=snap.val()||{};
      if(typeof splitUpdate==="function"&&splitUpdate)splitUpdate();   // live-refresh an open split
    });
    mpCov.on("value",snap=>{                            // room's running covariance → reshape the joint map
      if(typeof jointDataChanged==="function") jointDataChanged(parseCov(snap.val()));
    });
    mpCtrl.child("resetAt").on("value",snap=>{          // someone hit "reset everyone"
      const t=snap.val()||0;
      if(mpSeenReset!=null && t>mpSeenReset) localReset();
      mpSeenReset=t;
    });
    const rb=$("#resetRoom"); if(rb) rb.hidden=false;   // visible only in curator mode (CSS)
  }catch(e){ console.warn("multiplayer off:",e&&e.message); }
}

/* ---- reset everyone: curator mode only, two-step confirm ---- */
(function(){
  const rb=$("#resetRoom"); if(!rb) return;
  let armed=false, disarmT=null;
  rb.addEventListener("click",()=>{
    if(!mpCtrl && !simOn) return;
    if(!armed){
      armed=true; rb.classList.add("armed");
      $("#resetRoomTx").textContent="Tap again to reset the whole room";
      disarmT=setTimeout(()=>{armed=false;rb.classList.remove("armed");
        $("#resetRoomTx").textContent="Reset everyone's votes";},4000);
      return;
    }
    clearTimeout(disarmT); armed=false; rb.classList.remove("armed");
    $("#resetRoomTx").textContent="Reset everyone's votes";
    if(simOn){ TALLIES={}; localReset(); }
    else resetEveryone();
    closeSheet();
  });
})();

/* ---- simulated room (?simroom=N): demo & perf rig, no backend ----
   N fake participants vote their way through the deck on human-ish timers.
   Drives the same strip/tick/tally/progress paths as the real room. */
const SIM_FACES=["🦊","🦉","🐢","🐝","🦋","🐙","🌻","🌿","🍊","🌙","⚡","🔥","💧","⭐","🍀","🎈"];
const SIM_NAMES=["anna","marc","júlia","pau","laia","biel","emma","nil","carla","jan","ona","leo","mia","pol","noa","hugo"];
const SIM_SEEDED=new Set();
function simCastRoom(id){
  // lazily invent how much of the room has already voted this card (they're
  // ahead/behind in their own shuffled decks) — generated once per decision
  if(SIM_SEEDED.has(id)) return; SIM_SEEDED.add(id);
  const t=roomTally(id);
  for(const pid in PEERS){
    const reach=Math.min((PEERS[pid].n||0)/Math.max(PEERS[pid].t||deck.length,1)+0.25,1);
    if(Math.random()<reach){
      const r=Math.random();
      const v=r<0.44?"for":r<0.78?"against":"abstain";
      t[v]=(t[v]||0)+1;
    }
  }
}
function simInit(){
  // give each fake peer a real ballot over the deck — the SAME rows drive their
  // map dot and the room aggregate, so the joint map's axes bend to the crowd
  const ids=(typeof jointCols==="function")?jointCols():[];
  const num=v=>v==="for"?1:v==="against"?-1:0;
  const s={}, m2={};
  for(let i=0;i<SIM_N;i++){
    const pid="sim"+i, votes={};
    for(const id of ids){const t=Math.random(); votes[id]=t<.4?"for":t<.8?"against":"abstain";}
    ids.forEach((id,j)=>{const v=num(votes[id]); if(!v)return; s[j]=(s[j]||0)+v;
      for(let l=j;l<ids.length;l++){const w=num(votes[ids[l]]); if(w)m2[j+"_"+l]=(m2[j+"_"+l]||0)+v*w;}});
    PEERS[pid]={e:SIM_FACES[i%SIM_FACES.length], nm:SIM_NAMES[i%SIM_NAMES.length],
                c:null, votes, n:Math.floor(Math.random()*3), t:deck.length||18};
  }
  if(typeof jointDataChanged==="function" && ids.length) jointDataChanged({k:SIM_N,s,m2});
  renderStrip();
  // human-ish cadence: each peer casts a ballot every 1.2–4s until they finish
  setInterval(()=>{
    const pids=Object.keys(PEERS).filter(p=>PEERS[p].n<PEERS[p].t);
    if(!pids.length) return;
    // 0–3 ballots land per beat across the room
    const k=Math.random()<0.55?1:Math.random()<0.5?2:0;
    for(let j=0;j<k;j++){
      const pid=pids[Math.floor(Math.random()*pids.length)];
      PEERS[pid].n++;
      activityTick(pid);
    }
    if(k)renderStrip();
  },900);
  // (peer map dots come from each peer's fabricated ballot via blendCoord — no
  // need to scatter fake coordinates; the joint projection places them for real)
}
