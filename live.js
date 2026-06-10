/* RIOT viewer — LIVE SESSION (lockstep room voting). Loads after multiplayer.js.

   The model: lobby → [card N: voting → card N: reveal] × deck → final reveal.
   Everyone is always on the same card. State lives in one moderator-written
   RTDB subtree (rooms/<city>/live); voters write exactly two things per card:
   an anonymous tally increment and a directionless "ballot in" cast marker.

     rooms/<city>/live/
       current: <sid>                          ← null/absent = no live session
       sessions/<sid>/
         state:    lobby|voting|paused|reveal|final|ended
         deck:     [decision ids]              ← moderator's ordered, trimmed pick
         idx:      current card
         deadline: epoch ms (server clock)     ← voting ceiling; bar renders from it
         remaining: ms (only while paused)
         cfg:      {timer, reveal}             ← seconds; reveal 0 = manual advance
         cast/<id>/<pid>: ts                   ← ballot in — ACTIVITY, no direction
         tallies/<id>/<dir>: n                 ← anonymous atomic increments

   Doctrine holds: per-card reveal shows the official OUTCOME only — party
   detail belongs to the final reveal and the minutes. Timeouts are never
   written anywhere: no cast marker + nothing in local `answers` ⇒ excluded
   from affinity automatically.

   Roles: default URL = voter (radically simple). ?role=moderator = picks the
   deck by plenary session, starts/pauses/advances/ends; their screen is the
   stage (projector) view. "Server-authoritative" = the moderator's client is
   the only writer of session state; clocks sync via .info/serverTimeOffset.

   Test rig: ?simlive=N fakes a lockstep room with no backend — N sim voters
   (deadline-clustered casts, a late joiner on card 2, a disconnect/rejoin on
   card 3, a force-advance on card 4) over an in-memory store with latency, so
   the real state machine runs end-to-end headless. */

window.LIVE_ROLE = (QS.get("role")||"").toLowerCase()==="moderator" ? "mod" : "voter";
const SIMLIVE=(()=>{const v=parseInt(QS.get("simlive")||"",10);
                    return Number.isFinite(v)&&v>0?Math.min(v,40):0;})();

let lvStore=null, lvSid=null, lvS=null;     // store, session id, latest snapshot
let lvDeckSig="", lvShownIdx=-1, lvShownState="";
let lvRaf=0, lvAuthKey="", lvDeadlineT=0, lvAllInT=0, lvAutoNextT=0;
let lvAdvancing=false;                      // card exit animation in flight
const lvPid=()=> (typeof mpPid!=="undefined"&&mpPid) || "me";
const lvCurId=()=> lvS&&lvS.deck ? lvS.deck[lvS.idx] : null;
const lvSess=()=> "sessions/"+lvSid;

/* ---- public surface (used by app.js react() and multiplayer.js) ---- */
window.LIVE={
  active(){ return !!(lvSid && lvS && lvS.state && lvS.state!=="ended"); },
  simActive(){ return SIMLIVE>0; },
  canVote(id){ return !!(lvS && lvS.state==="voting" && id===lvCurId() && !(id in answers)); },
  cast(id,vote){
    if(!lvSid) return;
    lvStore.inc(`${lvSess()}/tallies/${id}/${vote}`);
    lvStore.set(`${lvSess()}/cast/${id}/${lvPid()}`, lvStore.now());
  },
  tally(id){
    const t=((lvS&&lvS.tallies)||{})[id]||{};
    return {for:t.for||0, against:t.against||0, abstain:t.abstain||0};
  },
  afterCast(top){ voting=false; updateProgress(); showCastPanel(top); updateCastCounts(); }
};

/* ---- stores: same tiny interface over Firebase RTDB or an in-memory sim ---- */
function fbStore(){
  const db=window.mpDb;
  let off=0; db.ref(".info/serverTimeOffset").on("value",s=>{off=s.val()||0;});
  const base=`rooms/${CFG.id}/live/`;
  return {
    now:()=>Date.now()+off,
    on:(p,cb)=>db.ref(base+p).on("value",s=>cb(s.val())),
    set:(p,v)=>db.ref(base+p).set(v),
    update:(p,o)=>db.ref(base+p).update(o),
    inc:(p)=>db.ref(base+p).transaction(v=>(v||0)+1)
  };
}
function simStore(){
  const tree={}, subs=[];
  const get=p=>{let n=tree;for(const k of p.split("/")){if(n==null)return null;n=n[k];}return n==null?null:n;};
  const setAt=(p,v)=>{const ks=p.split("/");let n=tree;
    for(let i=0;i<ks.length-1;i++)n=n[ks[i]]=n[ks[i]]||{};
    if(v==null)delete n[ks[ks.length-1]];else n[ks[ks.length-1]]=v;};
  const ping=()=>setTimeout(()=>{for(const s of subs)s.cb(JSON.parse(JSON.stringify(get(s.p))));},35);
  return {
    now:()=>Date.now(),
    on:(p,cb)=>{subs.push({p,cb});setTimeout(()=>cb(JSON.parse(JSON.stringify(get(p)))),0);},
    set:(p,v)=>{setAt(p,v);ping();},
    update:(p,o)=>{for(const k in o)setAt(p+"/"+k,o[k]);ping();},
    inc:(p)=>{setAt(p,(get(p)||0)+1);ping();}
  };
}

/* ---- boot (called from index.html after mpInit) ---- */
function liveInit(){
  if(SIMLIVE){ lvStore=simStore(); }
  else if(window.mpDb){ lvStore=fbStore(); }
  else { if(LIVE_ROLE==="mod") modNoBackend(); return; }   // single-player: no live mode
  if(LIVE_ROLE==="mod"){ document.body.classList.add("live-mod"); }
  lvStore.on("current",sid=>{
    if(sid===lvSid) return;
    lvSid=sid;
    if(!sid){ lvS=null; onSessionGone(); return; }
    lvStore.on(lvSess(), s=>{ if(lvSid!==sid)return; lvS=s; onSnapshot(); });
  });
  if(SIMLIVE) simLiveBoot();
  if(LIVE_ROLE==="mod") setTimeout(()=>{ if(!lvSid) renderModSetup(); },SIMLIVE?0:600);
}

/* ---- snapshot dispatch ---- */
function onSnapshot(){
  if(!lvS) return;
  if(LIVE_ROLE==="mod"){ $("#modSetup").hidden=true; renderStage(); modAuthority(); simOnSnapshot(); return; }
  document.body.classList.add("live-voter");
  const st=lvS.state;
  if(st==="lobby"){ showLobby(); }
  else if(st==="ended"){ liveEnded(); }
  else if(st==="final"){ hideLobby(); renderFinal(); }
  else { hideLobby(); syncDeck(()=>applyPhase()); }
  if(typeof renderStrip==="function") renderStrip();
  modAuthority();          // no-op unless the sim rig drives the room
  simOnSnapshot();
}
function onSessionGone(){
  if(LIVE_ROLE==="mod"){ stageOff(); renderModSetup(); return; }
  liveEnded();
}
function liveEnded(){
  stopCountdown();
  document.body.classList.remove("live-paused");
  hideLobby();
  if(lvShownState!=="final"){       // never reached the payoff → back to the solo booth
    document.body.classList.remove("live-voter","live-final");
    lvShownState="ended"; lvShownIdx=-1; lvDeckSig="";
    deck=buildDeck(); idx=0; voting=false;
    $("#done").style.display="none";
    renderStack();
  }
}

/* ---- lockstep deck/card sync (voter) ---- */
function syncDeck(done){
  const ids=lvS.deck||[], sig=ids.join(",");
  if(sig!==lvDeckSig){
    lvDeckSig=sig;
    deck=ids.map(id=>byId[id]).filter(Boolean);
  }
  if(lvS.idx!==lvShownIdx){
    const fresh=lvShownIdx<0 || lvShownState==="lobby" || lvShownState==="ended" || lvShownState==="";
    lvShownIdx=lvS.idx; voting=false;
    const land=()=>{ idx=lvS.idx; lvAdvancing=false; $("#done").style.display="none"; renderStack(); done(); };
    const top=$("#stack").lastChild;
    if(!fresh && top && !lvAdvancing){
      lvAdvancing=true;
      top.classList.add("gone-d");
      setTimeout(land,280);
    } else if(!lvAdvancing){ land(); }
  } else if(!lvAdvancing){ done(); }
  lvShownState=lvS.state;
}
function applyPhase(){
  const st=lvS.state, id=lvCurId(), top=$("#stack").lastChild;
  document.body.classList.toggle("live-paused",st==="paused");
  if(st==="voting"){
    startCountdown();
    if(top && (id in answers) && !top.querySelector(".castp") && !top.dataset.revealed){
      top.classList.add("voted"); showCastPanel(top);
    }
    updateCastCounts();
  } else if(st==="paused"){
    freezeCountdown();
  } else if(st==="reveal"){
    stopCountdown();
    if(top && !top.dataset.revealed) runRevealBeats(top, byId[id]);
  }
}

/* ---- the countdown: one bar closing from both edges toward the centre ----
   Rendered from (deadline − serverNow); every phone's bar agrees. */
function countdownFills(){ return [ $("#liveFill"), $("#sgFill") ].filter(Boolean); }
function startCountdown(){
  const tr=$("#progressRow") && $("#progressRow").querySelector(".ptrack");
  if(tr) tr.classList.add("counting");
  const f=$("#liveFill"); if(f) f.hidden=false;
  cancelAnimationFrame(lvRaf);
  const dur=(lvS.cfg&&lvS.cfg.timer?lvS.cfg.timer:30)*1000;
  const loop=()=>{
    if(!lvS || lvS.state!=="voting") return;
    const rem=Math.max(0, Math.min(1, (lvS.deadline-lvStore.now())/dur));
    for(const el of countdownFills()){
      el.style.transform=`scaleX(${rem})`;
      el.classList.toggle("low", (lvS.deadline-lvStore.now())<5000);
    }
    const sgT=$("#sgSecs"); if(sgT) sgT.textContent=Math.max(0,Math.ceil((lvS.deadline-lvStore.now())/1000));
    if(rem>0) lvRaf=requestAnimationFrame(loop);
  };
  lvRaf=requestAnimationFrame(loop);
}
function freezeCountdown(){ cancelAnimationFrame(lvRaf); }
function stopCountdown(){
  cancelAnimationFrame(lvRaf);
  const tr=$("#progressRow") && $("#progressRow").querySelector(".ptrack");
  if(tr) tr.classList.remove("counting");
  const f=$("#liveFill"); if(f) f.hidden=true;
}

/* ---- after my ballot: cast confirmation, never the split (that's the reveal's) ---- */
function voterCount(){
  const peers=Object.keys(PEERS).length;
  return LIVE_ROLE==="mod" ? peers : peers+1;
}
function castCount(id){
  const m=((lvS&&lvS.cast)||{})[id]||{};
  let n=Object.keys(m).length;
  if(LIVE_ROLE!=="mod" && (id in answers) && !(lvPid() in m)) n++;   // mine may be in flight
  return n;
}
function showCastPanel(top){
  const slot=top.querySelector(".acts");
  if(!slot) return;
  slot.classList.remove("acts"); slot.className="castp";
  slot.innerHTML=`<p class="sp-k">Ballot cast</p>
    <div class="cp-n"><b id="cpN">–</b><span id="cpM">/ –</span></div>
    <p class="cp-w">waiting for the rest of the room…</p>`;
}
function updateCastCounts(){
  const id=lvCurId(); if(!id) return;
  const n=castCount(id), m=voterCount();
  const cn=$("#cpN"), cm=$("#cpM");
  if(cn){ cn.textContent=n; cm.textContent="/ "+m; }
  const sg=$("#sgIn"); if(sg) sg.textContent=`${n}/${m}`;
}

/* ---- the two-beat reveal: 1) the room's split  2) the parliament's stamp ---- */
function roomVerdict(id){
  const t=LIVE.tally(id);
  if(t.for>t.against) return "approved";
  if(t.against>t.for) return "rejected";
  return null;                                   // tie / all abstain
}
const CHAMBER=CFG.chamber||"the parliament";   // per-city: Reus is a council, Brussels a parliament
function verdictCopy(d){
  const rv=roomVerdict(d.id);
  if(!rv) return {cls:"tie", tx:"The room is split down the middle."};
  if(rv===d.outcome) return {cls:"agree", tx:`The room agrees with ${CHAMBER}.`};
  return {cls:"differ", tx:"The room would have decided differently."};
}
// the chamber's split, counted by political group/party (aggregate, never names)
function chamberTally(d){
  const t={for:0,against:0,abstain:0};
  for(const v of Object.values(d.party_votes_canon||{})) if(t[v]!=null) t[v]++;
  return t;
}
/* two layers per row: thick ink bar = this room (simulated), thin outlined
   bar = the chamber (real). Each layer normalised to its own total. */
function renderLiveSplit(el,id){
  const d=byId[id], t=LIVE.tally(id), c=chamberTally(d), my=answers[id];
  const rows=[["against","Against"],["abstain","Abstain"],["for","For"]];
  const ball=rows.reduce((s,[k])=>s+t[k],0), total=ball||1;
  const cTotal=rows.reduce((s,[k])=>s+c[k],0)||1;
  const unit=CFG.id==="brussels"?"group":"party";
  const noBallot=Math.max(voterCount()-castCount(id),0);
  el.innerHTML=`<p class="sp-k">The room v. ${esc(CHAMBER)} · ${ball} ballot${ball===1?"":"s"}</p>
    <p class="sp-leg">▰ this room · ▱ ${esc(CHAMBER)}, by ${unit}</p>`+
    rows.map(([k,lab])=>`<div class="sp-row dual${k===my?" mine":""}">
        <span class="sp-l">${lab}</span>
        <span class="sp-bars">
          <span class="sp-track"><span class="sp-fill" style="width:${Math.round(100*t[k]/total)}%"></span></span>
          <span class="sp-track ch"><span class="sp-fill ch" style="width:${Math.round(100*c[k]/cTotal)}%"></span></span>
        </span>
        <span class="sp-ns"><b>${t[k]}</b><i>${c[k]}</i></span></div>`).join("")+
    (noBallot?`<div class="sp-row to"><span class="sp-l">Timeout</span><span class="sp-track"></span><span class="sp-n">${noBallot}</span></div>`:"")+
    `<p class="lv-verdict" hidden></p>`;
}
function stampOutcome(card,d){
  if(!d.outcome) return;
  const ok=d.outcome==="approved";
  const st=document.createElement("div");
  // st-app / st-rej, NOT "app": a bare `app` class collides with the page root
  // (.app{height:100dvh}) and inflated every APPROVED stamp to viewport height
  st.className="stamp official "+(ok?"st-app":"st-rej");
  st.innerHTML=`<small>${esc(CHAMBER)}</small>${ok?"APPROVED":"REJECTED"}`;
  stampRow(card).appendChild(st);   // next to the user's stamp — two imprints, one glance
}
function runRevealBeats(top,d){
  top.dataset.revealed="1";
  top.classList.add("voted");
  let slot=top.querySelector(".castp")||top.querySelector(".acts");
  if(slot){ slot.className="split"; renderLiveSplit(slot,d.id); }
  setTimeout(()=>{                                   // beat 2: the official imprint
    if(!top.isConnected) return;
    stampOutcome(top,d);
    const v=top.querySelector(".lv-verdict");
    if(v){ const c=verdictCopy(d); v.hidden=false; v.classList.add(c.cls); v.textContent=c.tx; }
  },1100);
}

/* ---- final reveal: the room's headline first, the personal one after ---- */
function roomDiffersList(){
  const out=[];
  for(const id of (lvS.deck||[])){
    const d=byId[id]; if(!d||!d.outcome) continue;
    const rv=roomVerdict(id);
    if(rv && rv!==d.outcome) out.push({d,rv});
  }
  return out;
}
function buildRoomVerdict(){
  const el=$("#roomVerdict"); if(!el) return;
  const N=(lvS.deck||[]).length, items=roomDiffersList(), X=items.length;
  el.hidden=false;
  el.innerHTML=`<p class="rv-k">This room v. ${esc(CHAMBER)}</p>
    <h3 class="rv-h">${X===0
      ? `On all ${N} decisions, this room landed where ${esc(CHAMBER)} did.`
      : `On ${X} of ${N} decisions, this room would have decided differently.`}</h3>`+
    (X?`<div class="rv-list">`+items.map(({d,rv})=>`<div class="rv-row">
        <span class="rv-t">${esc(d.headline||d.title)}</span>
        <span class="rv-chips"><span class="badge ${rv==="approved"?"b-app":"b-rej"}">room: ${rv}</span>
        <span class="badge ${d.outcome==="approved"?"b-app":"b-rej"}">${esc(CHAMBER.replace(/^the /,""))}: ${d.outcome}</span></span>
      </div>`).join("")+`</div>`:"");
}
function renderFinal(){
  if(lvShownState==="final") return;
  lvShownState="final";
  stopCountdown();
  document.body.classList.remove("live-paused");
  document.body.classList.add("live-final");       // re-opens ⚙ (AI proxy toggle) for voters
  buildRoomVerdict();
  finish();
  const r=$("#restart"); if(r) r.style.display="none";   // the moderator owns the session
}

/* ---- lobby (voter) ---- */
function showLobby(){
  lvShownState="lobby"; lvShownIdx=-1;
  document.body.classList.remove("live-final");
  document.body.classList.add("live-lobby");
  const lb=$("#lobby"); lb.hidden=false;
  $("#lobbyKicker").textContent=`Live session · ${CFG.name}`;
  const n=voterCount();
  $("#lobbyCount").textContent=n;
  $("#lobbySub").textContent=n>1?"in the room — waiting for the first ballot to open":"in the room — waiting for the others";
  const faces=[faceHTML(identity&&identity.emoji,(identity&&identity.name)||"you",true)];
  for(const pid of Object.keys(PEERS)) faces.push(faceHTML(PEERS[pid].e,PEERS[pid].nm,false));
  $("#lobbyFaces").innerHTML=faces.join("");
}
function hideLobby(){
  document.body.classList.remove("live-lobby");
  const lb=$("#lobby"); if(lb) lb.hidden=true;
}

/* =====================  MODERATOR / STAGE  ===================== */
let modSel=null, lvArmedEnd=false, lvArmT=0;
function modNoBackend(){
  document.body.classList.add("live-mod");
  const el=$("#modSetup"); el.hidden=false;
  el.querySelector(".ms-wrap").innerHTML=`<p class="ms-k">Moderator</p>
    <h2 class="ms-h">Multiplayer is off.</h2>
    <p class="ms-sub">FIREBASE_CONFIG is null — a live session needs the shared room. Use ?simlive=15 to rehearse without a backend.</p>`;
}
function modSessions(){
  const by={};
  for(const d of R.decisions){
    if(!d.headline||d.curator_drop||!d.outcome) continue;   // a live card must have an outcome to stamp
    (by[d.session_code]=by[d.session_code]||{code:d.session_code,date:d.date||"",ids:[]}).ids.push(d.id);
  }
  const list=Object.values(by).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  // "All plenaries" first: one deck across every session (newest first), trimmed next
  return [{code:"*",all:true,date:"",ids:list.flatMap(s=>s.ids)},...list];
}
function renderModSetup(){
  const el=$("#modSetup"); el.hidden=false;
  const w=el.querySelector(".ms-wrap");
  if(!modSel){
    const ss=modSessions();
    w.innerHTML=`<p class="ms-k">Moderator · ${esc(CFG.name)}</p>
      <h2 class="ms-h">Pick the plenary session.</h2>
      <p class="ms-sub">One session is one deck. You can trim items next. Switch city from the header.</p>
      <div class="ms-list">`+ss.map(s=>`<button class="ms-sess${s.all?" all":""}" type="button" data-code="${esc(s.code)}">
        <span class="ms-date">${s.all?"All plenaries":esc(s.date)}</span>
        <span class="ms-code">${s.all?"every decision · newest session first":esc(s.code)}</span>
        <span class="ms-n">${s.ids.length} decision${s.ids.length===1?"":"s"}</span></button>`).join("")+`</div>`;
    return;
  }
  const s=modSessions().find(x=>x.code===modSel.code);
  w.innerHTML=`<p class="ms-k">Moderator · ${esc(CFG.name)} · ${modSel.code==="*"?"all plenaries":esc(modSel.code)}</p>
    <h2 class="ms-h">Trim the deck, set the clock.</h2>
    <div class="ms-list">`+s.ids.map(id=>{const d=byId[id];const on=modSel.ids.has(id);
      return `<label class="ms-item${on?"":" off"}"><input type="checkbox" data-id="${esc(id)}" ${on?"checked":""}>
        <span class="ms-it">${esc(d.headline||d.title)}</span></label>`;}).join("")+`</div>
    <div class="ms-cfg">
      <label>ballot ceiling <input id="msTimer" type="number" inputmode="numeric" min="10" max="180" value="${modSel.timer}"> s</label>
      <label>auto-advance after reveal <input id="msReveal" type="number" inputmode="numeric" min="0" max="60" value="${modSel.reveal}"> s <small>0 = you advance</small></label>
    </div>
    <div class="ms-acts">
      <button class="ms-back" type="button">← Sessions</button>
      <button class="ms-go" type="button">Open the room · ${modSel.ids.size} cards</button>
    </div>`;
}
function startSession(ids,cfg){
  const sid="s"+Math.random().toString(36).slice(2,8);
  lvStore.set("sessions/"+sid,{state:"lobby",deck:ids,idx:0,cfg,startedAt:lvStore.now()});
  lvStore.set("current",sid);
}
(function(){
  const el=document.getElementById("modSetup"); if(!el) return;
  el.addEventListener("click",e=>{
    const sess=e.target.closest(".ms-sess");
    if(sess){ const s=modSessions().find(x=>x.code===sess.dataset.code);
      modSel={code:s.code,ids:new Set(s.ids),timer:30,reveal:0}; renderModSetup(); return; }
    if(e.target.closest(".ms-back")){ modSel=null; renderModSetup(); return; }
    if(e.target.closest(".ms-go")){
      modSel.timer=Math.max(10,parseInt($("#msTimer").value,10)||30);
      modSel.reveal=Math.max(0,parseInt($("#msReveal").value,10)||0);
      const order=modSessions().find(x=>x.code===modSel.code).ids.filter(id=>modSel.ids.has(id));
      if(!order.length) return;
      el.hidden=true;
      startSession(order,{timer:modSel.timer,reveal:modSel.reveal});
      return;
    }
  });
  el.addEventListener("change",e=>{
    const cb=e.target.closest("input[data-id]"); if(!cb||!modSel) return;
    cb.checked?modSel.ids.add(cb.dataset.id):modSel.ids.delete(cb.dataset.id);
    cb.closest(".ms-item").classList.toggle("off",!cb.checked);
    const go=el.querySelector(".ms-go"); if(go) go.textContent=`Open the room · ${modSel.ids.size} cards`;
  });
})();

/* ---- the moderator's authority: the only writer of session state ---- */
function modAuthority(){
  if(!lvS) return;
  if(!(LIVE_ROLE==="mod" || (SIMLIVE && LIVE_ROLE!=="mod"))) return;  // sim rig drives when you're a voter
  const key=lvS.state+":"+lvS.idx+":"+(lvS.deadline||0);
  if(key!==lvAuthKey){
    lvAuthKey=key;
    clearTimeout(lvDeadlineT); clearTimeout(lvAutoNextT); clearTimeout(lvAllInT); lvAllInT=0;
    if(lvS.state==="voting"){
      lvDeadlineT=setTimeout(()=>{ if(lvS&&lvS.state==="voting") goReveal(); },
                             Math.max(lvS.deadline-lvStore.now(),0)+250);
    } else if(lvS.state==="reveal" && lvS.cfg && lvS.cfg.reveal>0){
      lvAutoNextT=setTimeout(()=>{ if(lvS&&lvS.state==="reveal") modNext(); }, 2300+lvS.cfg.reveal*1000);
    }
  }
  if(lvS.state==="voting") checkAllIn();
}
function checkAllIn(){
  const id=lvCurId(), m=voterCount();
  if(m>0 && castCount(id)>=m && !lvAllInT){
    lvAllInT=setTimeout(()=>{ lvAllInT=0;                       // 600ms grace for in-flight ballots
      if(lvS&&lvS.state==="voting" && castCount(lvCurId())>=voterCount()) goReveal();
    },600);
  }
}
function modOpen(){ lvStore.update(lvSess(),{state:"voting",idx:0,deadline:lvStore.now()+lvS.cfg.timer*1000}); }
function goReveal(){ if(lvS&&lvS.state==="voting") lvStore.update(lvSess(),{state:"reveal",revealAt:lvStore.now()}); }
function modNext(){
  if(!lvS) return;
  const i=lvS.idx+1;
  if(i<(lvS.deck||[]).length) lvStore.update(lvSess(),{idx:i,state:"voting",deadline:lvStore.now()+lvS.cfg.timer*1000});
  else lvStore.update(lvSess(),{state:"final"});
}
function modPause(){ if(lvS.state==="voting") lvStore.update(lvSess(),{state:"paused",remaining:Math.max(lvS.deadline-lvStore.now(),3000)}); }
function modResume(){ if(lvS.state==="paused") lvStore.update(lvSess(),{state:"voting",deadline:lvStore.now()+(lvS.remaining||lvS.cfg.timer*1000)}); }
function modEnd(){ lvStore.update(lvSess(),{state:"ended"}); lvStore.set("current",null); }

/* ---- the stage: current card large, ballots-in, the two-beat reveal ----
   The moderator's screen IS the projector view; phones carry everything too. */
function stageOff(){ const sg=$("#stage"); if(sg) sg.hidden=true; }
let sgKey="";
function renderStage(){
  const sg=$("#stage"); if(!sg) return;
  sg.hidden=false;
  const st=lvS.state, id=lvCurId(), d=id?byId[id]:null;
  // pausing must not rebuild the card skeleton (it would reset the frozen bar)
  const key=(st==="paused"?"voting":st)+":"+lvS.idx+":"+(lvS.deck||[]).join(",");
  const joinUrl=location.host+location.pathname.replace(/index\.html$/,"")+(CFG.id!=="reus"?`?city=${CFG.id}`:"");
  if(key!==sgKey){
    sgKey=key;
    let main="";
    if(st==="lobby"){
      // sim rooms are tab-local (no backend) — showing a join URL there would lie
      main=SIMLIVE
        ? `<div class="sg-lobby">
            <p class="sg-k">Live session · ${esc(CFG.name)} · rehearsal</p>
            <h1 class="sg-h">Sim room — ${SIMLIVE} fake voters, this tab only.</h1>
            <p class="sg-sub">phones can't join a rehearsal · drop ?simlive=${SIMLIVE} from your URL for the real room</p>
            <div class="sg-faces" id="sgFaces"></div>
            <p class="sg-inlab"><b id="sgHere">0</b> in the room</p>
          </div>`
        : `<div class="sg-lobby">
            <p class="sg-k">Live session · ${esc(CFG.name)}</p>
            <h1 class="sg-join">${esc(joinUrl)}</h1>
            <p class="sg-sub">open it on your phone · pick a face · you're in</p>
            <div class="sg-faces" id="sgFaces"></div>
            <p class="sg-inlab"><b id="sgHere">0</b> in the room</p>
          </div>`;
    } else if(st==="final"){
      main=`<div class="sg-final" id="sgFinal"></div>`;
    } else if(d){
      main=`<div class="sg-card">
        <p class="sg-k">${esc(CFG.name)} · card ${lvS.idx+1} / ${(lvS.deck||[]).length}</p>
        <p class="sg-topic">${esc(d.topic||"Decision")}</p>
        <h1 class="sg-h">${esc(d.headline||d.title)}</h1>
        <div class="sg-track"><div class="sg-fill" id="sgFill"></div></div>
        <div class="sg-meta"><span class="sg-in"><b id="sgIn">0/0</b> ballots in</span><span class="sg-secs" id="sgSecs"></span></div>
        <div class="sg-revwrap" id="sgRev"></div>
      </div>`;
    }
    sg.querySelector(".sg-main").innerHTML=main;
    if(st==="final") buildStageFinal();
  }
  // per-state details on top of the stable skeleton
  if(st==="lobby"){
    const faces=[]; for(const pid of Object.keys(PEERS)) faces.push(faceHTML(PEERS[pid].e,PEERS[pid].nm,false));
    const sf=$("#sgFaces"); if(sf) sf.innerHTML=faces.join("");
    const sh=$("#sgHere"); if(sh) sh.textContent=voterCount();
  }
  if(st==="voting") startCountdown();
  if(st==="paused"){ freezeCountdown(); const s=$("#sgSecs"); if(s) s.textContent="paused"; }
  if(st==="reveal"){
    stopCountdown();
    const rev=$("#sgRev");
    if(rev && !rev.dataset.done && d){
      rev.dataset.done="1";
      rev.className="sg-revwrap split"; renderLiveSplit(rev,d.id);
      const host=sg.querySelector(".sg-card");
      setTimeout(()=>{ if(!rev.isConnected)return;
        stampOutcome(host,d);
        const v=rev.querySelector(".lv-verdict");
        if(v){ const c=verdictCopy(d); v.hidden=false; v.classList.add(c.cls); v.textContent=c.tx; }
      },1100);
    }
  }
  updateCastCounts();
  renderStageCtl(st);
}
function buildStageFinal(){
  const N=(lvS.deck||[]).length, items=roomDiffersList(), X=items.length;
  $("#sgFinal").innerHTML=`<p class="sg-k">Live session · ${esc(CFG.name)} · the reveal</p>
    <h1 class="sg-h">${X===0
      ? `On all ${N} decisions, this room landed where ${esc(CHAMBER)} did.`
      : `On ${X} of ${N} decisions, this room would have decided differently.`}</h1>`+
    (X?`<div class="sg-rvlist">`+items.map(({d,rv})=>`<div class="rv-row">
        <span class="rv-t">${esc(d.headline||d.title)}</span>
        <span class="rv-chips"><span class="badge ${rv==="approved"?"b-app":"b-rej"}">room: ${rv}</span>
        <span class="badge ${d.outcome==="approved"?"b-app":"b-rej"}">${esc(CHAMBER.replace(/^the /,""))}: ${d.outcome}</span></span>
      </div>`).join("")+`</div>`:"")+
    `<p class="sg-sub">each phone now shows its own reveal — closest party, the map, the proxy.</p>`;
}
function renderStageCtl(st){
  const c=$("#sgCtl"); if(!c) return;
  if(LIVE_ROLE!=="mod"){ c.hidden=true; return; }
  c.hidden=false;
  const btn=(act,tx,cls)=>`<button class="sgc ${cls||""}" type="button" data-act="${act}">${tx}</button>`;
  c.innerHTML=
    (st==="lobby"  ? btn("open","Open the first ballot","pri") : "")+
    (st==="voting" ? btn("pause","⏸ Pause")+btn("reveal","Reveal now","pri") : "")+
    (st==="paused" ? btn("resume","▶ Resume","pri") : "")+
    (st==="reveal" ? btn("next",(lvS.idx+1<(lvS.deck||[]).length)?"Next card →":"The reveal →","pri") : "")+
    (st!=="final"  ? btn("end",lvArmedEnd?"Tap again to end for everyone":"End session","danger"+(lvArmedEnd?" armed":"")) :
                     btn("end",lvArmedEnd?"Tap again to close the room":"Close the room","danger"+(lvArmedEnd?" armed":"")));
}
(function(){
  const c=document.getElementById("sgCtl"); if(!c) return;
  c.addEventListener("click",e=>{
    const b=e.target.closest("[data-act]"); if(!b||!lvS) return;
    const act=b.dataset.act;
    if(act==="end"){
      if(!lvArmedEnd){ lvArmedEnd=true; renderStageCtl(lvS.state);
        clearTimeout(lvArmT); lvArmT=setTimeout(()=>{lvArmedEnd=false; if(lvS)renderStageCtl(lvS.state);},4000); return; }
      clearTimeout(lvArmT); lvArmedEnd=false; modEnd(); return;
    }
    if(act==="open") modOpen();
    else if(act==="pause") modPause();
    else if(act==="resume") modResume();
    else if(act==="reveal") goReveal();
    else if(act==="next") modNext();
  });
})();

/* =====================  SIM RIG (?simlive=N)  =====================
   The real state machine over the in-memory store: deadline-clustered casts,
   a late joiner on card 2, a disconnect/rejoin on card 3, and (when the rig
   drives) a moderator force-advance on card 4. */
let simSchedIdx=-1, simLate=false, simDropped=null;
function simLiveBoot(){
  for(let i=0;i<SIMLIVE-1;i++){          // the last sim voter is the late joiner
    PEERS["sl"+i]={e:SIM_FACES[i%SIM_FACES.length],nm:SIM_NAMES[i%SIM_NAMES.length],c:null,n:0,t:0};
  }
  if(typeof renderStrip==="function") renderStrip();
  if(LIVE_ROLE!=="mod"){                 // headless moderator drives the room
    setTimeout(()=>{ if(!lvSid){
      const ids=liveDeckIds().filter(id=>byId[id]&&byId[id].outcome).slice(0,5);
      startSession(ids,{timer:parseInt(QS.get("simtimer"),10)||12,reveal:4});
    }},1600);
    setTimeout(()=>{ if(lvS&&lvS.state==="lobby") modOpen(); },3400);
  }
}
function simOnSnapshot(){
  if(!SIMLIVE||!lvS) return;
  if(lvS.state==="voting" && lvS.idx!==simSchedIdx){ simSchedIdx=lvS.idx; simScheduleCard(); }
  if(lvS.state==="final" && simDropped){ /* nothing left to do */ }
}
function simScheduleCard(){
  const id=lvCurId(), i=lvS.idx, dur=Math.max(lvS.deadline-lvStore.now(),3000);
  for(const pid in PEERS){ PEERS[pid].t=(lvS.deck||[]).length; }
  // scenario: late joiner appears mid-card on card 2
  if(i===1 && !simLate){ simLate=true;
    setTimeout(()=>{ const k="sl"+(SIMLIVE-1);
      PEERS[k]={e:SIM_FACES[(SIMLIVE-1)%SIM_FACES.length],nm:"late-"+SIM_NAMES[(SIMLIVE-1)%SIM_NAMES.length],c:null,n:0,t:(lvS.deck||[]).length};
      if(typeof renderStrip==="function"){renderStrip();activityTick(k);}
    }, dur*0.4);
  }
  // scenario: a disconnect mid-card on card 3, rejoining on the next card
  if(i===2 && !simDropped){ simDropped=PEERS["sl1"];
    setTimeout(()=>{ delete PEERS["sl1"]; if(typeof renderStrip==="function")renderStrip(); }, dur*0.3);
  }
  if(i===3 && simDropped){ PEERS["sl1"]=simDropped; simDropped=null;
    if(typeof renderStrip==="function")renderStrip();
  }
  // scenario: moderator force-advance 5s into card 4 (rig-driven runs only)
  if(i===3 && LIVE_ROLE!=="mod"){
    setTimeout(()=>{ if(lvS&&lvS.state==="voting"&&lvS.idx===3) goReveal(); },5000);
  }
  // the room votes: most spread out, a cluster right at the deadline, a few time out
  for(const pid of Object.keys(PEERS).filter(p=>p.startsWith("sl"))){
    if(Math.random()<0.07) continue;                                  // timeout, recorded nowhere
    const late=Math.random()<0.4;
    const at=late ? Math.max(dur-(400+Math.random()*2600),600)
                  : 700+Math.random()*Math.max(dur-5200,1200);
    setTimeout(()=>{
      if(!lvS||lvS.state!=="voting"||lvCurId()!==id||!PEERS[pid]) return;
      const r=Math.random(), v=r<0.42?"for":r<0.8?"against":"abstain";
      lvStore.inc(`${lvSess()}/tallies/${id}/${v}`);
      lvStore.set(`${lvSess()}/cast/${id}/${pid}`,lvStore.now());
      PEERS[pid].n++;
      if(typeof activityTick==="function") activityTick(pid);
    },at);
  }
}
