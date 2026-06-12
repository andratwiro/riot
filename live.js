/* RIOT viewer — LIVE SESSION (lockstep room voting). Loads after multiplayer.js.

   The model: lobby → [card N: voting → card N: reveal] × deck → final reveal.
   Everyone is always on the same card. State lives in one moderator-written
   RTDB subtree (rooms/<city>/live); voters write exactly two things per card:
   an anonymous tally increment and a cast marker carrying their direction
   (pseudonymous by emoji — surfaced ONLY at the per-card reveal, never before).

     rooms/<city>/live/
       current: <sid>                          ← null/absent = no live session
       sessions/<sid>/
         state:    lobby|voting|paused|reveal|final|ended
         deck:     [decision ids]              ← moderator's ordered, trimmed pick
         idx:      current card
         deadline: epoch ms (server clock)     ← voting ceiling; bar renders from it
         remaining: ms (only while paused)
         cfg:      {timer, reveal, bots, ai}   ← seconds; reveal 0 = manual advance;
                                                 bots = synthetic voters, moderator-staged;
                                                 ai 1 = seat the GHOST in the reveal
         cast/<id>/<pid>: dir                  ← ballot in, WITH direction (reveal-only)
         tallies/<id>/<dir>: n                 ← anonymous atomic increments

   Doctrine (amended by Rob, 2026-06): the per-card reveal leads with the
   chamber's official stamp (the real verdict), then the room lands as emoji
   piles — each cast face on its pile, the chamber's party discs beneath them
   on the same piles (Rob, 2026-06: always on — the firewall is per-decision,
   and this card's ballot is closed by the time anything lands). Directions
   are pseudonymous (emoji, chosen in private) and surface only AFTER everyone
   on the card has cast or timed out; nothing direction-shaped ever shows
   pre-vote. Affinity/map detail still belongs to the final reveal and the
   minutes. Timeouts get no cast marker + nothing in local `answers` ⇒
   excluded from affinity automatically.

   Roles: default URL = voter (radically simple). ?role=moderator = picks the
   deck by plenary session, starts/pauses/advances/ends; their screen is the
   stage (projector) view. "Server-authoritative" = the moderator's client is
   the only writer of session state; clocks sync via .info/serverTimeOffset.

   Seats (amended by Rob, 2026-06): the voter URL is the sitting's entrance
   and nothing else — no sitting in the store ⇒ the holding-page wall
   (lvWall). Presence is taken, never ambient: every sitting (re-)shows the
   seat gate, the TAP is the join (LIVE.seat → mpJoin → the record, stamped
   with the sid), and a refresh re-seats silently only into the SAME sid
   (sessionStorage). Counts, lobby/stage faces and the reveal's crowd see
   only records seated in the current sitting — a tab left open through
   yesterday's sitting can watch the gate, but it cannot haunt the room.

   Test rig: ?simlive=N fakes a lockstep room with no backend — N sim voters
   (deadline-clustered casts, a late joiner on card 2, a disconnect/rejoin on
   card 3, a force-advance on card 4) over an in-memory store with latency, so
   the real state machine runs end-to-end headless. */

window.LIVE_ROLE = (QS.get("role")||"").toLowerCase()==="moderator" ? "mod" : "voter";
const SIMLIVE=(()=>{const v=parseInt(QS.get("simlive")||"",10);
                    return Number.isFinite(v)&&v>0?Math.min(v,40):0;})();

let lvStore=null, lvSid=null, lvS=null;     // store, session id, latest snapshot
let lvSeated=false;                         // this tab tapped the gate INTO lvSid (or refreshed back into it)
const SID_KEY="riot.sid.v1";                // per-tab: which sitting this tab confirmed into
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
  sid(){ return lvSid; },
  // the seat gate's tap (app.js gateGo): consent in, presence out. Joining a
  // sitting is a clean slate — answers from an earlier sitting in this tab
  // would otherwise block ballots and fake "in flight" casts.
  seat(){
    if(!lvSid || !lvS || lvS.state==="ended") return false;
    lvSeated=true;
    try{sessionStorage.setItem(SID_KEY,lvSid);}catch(e){}
    for(const k in answers) delete answers[k];
    lvShownIdx=-1; lvShownState=""; lvDeckSig="";
    if(typeof mpJoin==="function") mpJoin();
    onSnapshot();                    // land wherever the sitting is: lobby, card, final
    return true;
  },
  canVote(id){ return !!(lvS && lvS.state==="voting" && id===lvCurId() && !(id in answers)); },
  cast(id,vote){
    if(!lvSid) return;
    lvStore.inc(`${lvSess()}/tallies/${id}/${vote}`);
    lvStore.set(`${lvSess()}/cast/${id}/${lvPid()}`, vote);   // direction — for the reveal's piles
  },
  tally(id){
    const t=((lvS&&lvS.tallies)||{})[id]||{};
    return {for:t.for||0, against:t.against||0, abstain:t.abstain||0};
  },
  // a participant's full ballot record {decisionId: dir}, from the cast markers —
  // it places every face (synthetic voters included) on the final reveal's map.
  // Same exposure rule as the piles: rendered only on reveal surfaces, never
  // while a ballot is open (the map itself doesn't exist before the reveal).
  peerVotes(pid){
    const cast=(lvS&&lvS.cast)||null; if(!cast) return null;
    const out={}; let n=0;
    for(const id in cast){const v=cast[id]&&cast[id][pid]; if(v){out[id]=v;n++;}}
    return n?out:null;
  },
  afterCast(top){ voting=false; updateProgress(); showCastPanel(top); updateCastCounts(); },
  // the lobby's moved copy (it kept none): the blind-vote rule + the privacy
  // line surface ONCE — on the deck's first ballot, at the moment of voting.
  // app.js renders them into the .acts row; both die with the first cast.
  cardNotes(id){
    if(!lvS || lvS.state!=="voting" || lvS.idx!==0 || !lvS.deck || lvS.deck[0]!==id) return null;
    const L=CFG.lobby||{};
    if(!L.firstCardRule && !L.privacyLine) return null;
    return {rule:L.firstCardRule||"", privacy:L.privacyLine||""};
  }
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
  else { lvHold(false); if(LIVE_ROLE==="mod") modNoBackend(); return; }   // single-player: no live mode
  // the lobby CTA carries the seat metaphor — it opens the seat gate, whose
  // tap stays THE join (presence is published only from the gate's button)
  const lbCta=$("#lobbyCta");
  if(lbCta) lbCta.addEventListener("click",()=>{ if(!lvSeated) showSeatGate(); });
  if(LIVE_ROLE==="mod"){ lvHold(false); document.body.classList.add("live-mod"); }
  else {
    // every voter boot holds the paper (html.lvhold, set before first paint)
    // until the store answers: a sitting → the seat gate (or a silent
    // re-seat), none → the wall. A tab that was SEATED in the lobby still
    // re-paints the convocation document on frame one instead of waiting.
    document.body.classList.add("live-voter");
    let seated=false; try{seated=sessionStorage.getItem("riot.liveLobby")===CFG.id;}catch(e){}
    if(seated) showLobby();
    setTimeout(()=>{ if(!lvS && lvShownState!=="final") lvWall(true); },10000);  // backend never answered
  }
  let goneT=0;
  lvStore.on("current",sid=>{
    if(sid===lvSid){
      // no session in the store: give a freshly-created one a beat to land
      // (the sim rig writes it late) — then the wall. The voter URL is the
      // sitting's entrance, and there is no sitting behind it.
      if(!sid && !goneT && LIVE_ROLE!=="mod")
        goneT=setTimeout(()=>{ goneT=0; if(!lvSid && lvShownState!=="final") liveEnded(); },2500);
      return;
    }
    clearTimeout(goneT); goneT=0;
    lvSid=sid;
    if(!sid){ lvS=null; onSessionGone(); return; }
    if(LIVE_ROLE!=="mod"){
      // a refresh re-seats silently (same sitting, same consent); any other
      // sid waits at the gate — and whatever record this tab left in an
      // older sitting is withdrawn
      let stored=null; try{stored=sessionStorage.getItem(SID_KEY);}catch(e){}
      lvSeated = stored===sid;
      if(lvSeated){ if(typeof mpJoin==="function") mpJoin(); }
      else if(typeof mpLeave==="function") mpLeave();
    }
    lvStore.on(lvSess(), s=>{ if(lvSid!==sid)return; lvS=s; onSnapshot(); });
  });
  if(SIMLIVE) simLiveBoot();
  if(LIVE_ROLE==="mod") setTimeout(()=>{ if(!lvSid) renderModSetup(); },SIMLIVE?0:600);
}

/* ---- snapshot dispatch ---- */
function onSnapshot(){
  if(!lvS) return;
  if(LIVE_ROLE==="mod"){ liveSyncGhost(); $("#modSetup").hidden=true; renderStage(); modAuthority(); simOnSnapshot(); return; }
  const st=lvS.state;
  if(st==="ended"){ liveEnded(); modAuthority(); simOnSnapshot(); return; }
  if(!lvSeated){
    // the gathering is public: an un-seated tab watches the lobby fill (presence
    // is read-on-load, written only by the gate's tap) and its CTA opens the
    // seat gate. Any other state still gates immediately — the sitting is on.
    if(st==="lobby"){ lvWall(false); document.body.classList.add("live-voter"); showLobby(); }
    else { hideLobby(); showSeatGate(); }
    if(typeof renderStrip==="function") renderStrip();
    modAuthority(); simOnSnapshot(); return;
  }
  liveSyncGhost();                         // ghost mode is the session's, not the visitor's
  document.body.classList.add("live-voter");
  if(st==="lobby"){ showLobby(); }
  else if(st==="final"){ hideLobby(); renderFinal(); }
  else if(lvShownState==="lobby" && st==="voting" && lvS.idx===0){ openSitting(); lvShownState="opening"; }
  else if(lvOpening){ /* the formula holds the screen; the timeout lands the card */ }
  else { hideLobby(); syncDeck(()=>applyPhase()); }
  if(typeof renderStrip==="function") renderStrip();
  modAuthority();          // no-op unless the sim rig drives the room
  simOnSnapshot();
}
function onSessionGone(){
  if(LIVE_ROLE==="mod"){ botsRemove(); stageOff(); renderModSetup(); return; }
  liveEnded();
}
function liveEnded(){
  stopCountdown();
  document.body.classList.remove("live-paused");
  hideLobby();
  if(typeof gateHide==="function") gateHide();
  if(lvShownState!=="final"){       // never reached the payoff → the URL is no longer an entrance
    document.body.classList.remove("live-final");
    lvShownState="ended"; lvShownIdx=-1; lvDeckSig="";
    lvSeated=false; voting=false;
    if(typeof mpLeave==="function") mpLeave();
    if(showGhost){ showGhost=false; applyGhostParty(false); }   // ghost mode dies with the session
    doneVis(false);
    lvWall(true);
  }
}
/* Ghost mode (cfg.ai — the wire key predates the name): the moderator seats
   the GHOST for the whole room — every client mirrors the session flag (a
   voter on the final screen keeps it). */
function liveSyncGhost(){
  const on=!!(AI && lvS && lvS.cfg && lvS.cfg.ai);
  if(on!==showGhost){ showGhost=on; applyGhostParty(on); }
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
    const land=()=>{ idx=lvS.idx; lvAdvancing=false; doneVis(false); renderStack(); done(); };
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
  const peers=mpVisiblePids().length;       // only records seated in THIS sitting
  return LIVE_ROLE==="mod" ? peers : peers+(lvSeated?1:0);
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

/* ---- the two-beat reveal: 1) the parliament's stamp  2) the room's emoji piles ---- */
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
/* the room as emoji piles: every cast face lands on its pile, in button order
   (Against / Abstain / For). Directions come from the cast markers — they are
   pseudonymous and shown only here, after the card has closed.
   The chamber lands on the same piles (Rob, 2026-06): each party's canonical
   direction drops its logo disc beneath the faces — the room above, the
   institution under it, one glance says who voted what. Tokens absent from
   party_votes_canon (single-chamber measures, the GHOST) simply don't land. */
function renderLivePiles(el,id){
  const my=answers[id];
  const castMap=((lvS&&lvS.cast)||{})[id]||{};
  const piles={against:[],abstain:[],for:[]};
  if(my && piles[my]) piles[my].push({e:identity&&identity.emoji,nm:(identity&&identity.name)||"you",me:true});
  for(const pid of Object.keys(castMap)){
    if(pid===lvPid()) continue;                  // mine comes from `answers` (may still be in flight)
    const v=castMap[pid]; if(!piles[v]) continue;
    const p=PEERS[pid]||{};
    piles[v].push({e:p.e,nm:p.nm,me:false});
  }
  const pvc=(byId[id]&&byId[id].party_votes_canon)||{};
  const pp={against:[],abstain:[],for:[]};
  // the chamber row is the institution: the GHOST (seated via cfg.ai) is
  // neither room nor chamber — its predictions belong to the final reveal only
  for(const p of PARTIES){ if(p.ghost) continue; const v=pp[pvc[p.token]]; if(v) v.push(p); }
  const ball=piles.against.length+piles.abstain.length+piles.for.length;
  const noBallot=Math.max(voterCount()-castCount(id),0);
  let i=0;                                       // global stagger across the three piles
  const stack=f=>`<span class="pl-drop" style="animation-delay:${(i++)*70}ms">${faceHTML(f.e,f.nm,f.me)}</span>`;
  const pdisc=p=>`<span class="pl-drop" style="animation-delay:${(i++)*70}ms">${logoEl(p)}</span>`;
  const col=(k,lab)=>`<div class="pl-col${k==="abstain"?" quiet":""}${my===k?" mine":""}">
      <div class="pl-stack">${piles[k].map(stack).join("")||`<span class="pl-none">—</span>`}</div>
      ${pp[k].length?`<div class="pl-stack pl-chamber">${pp[k].map(pdisc).join("")}</div>`:""}
      <span class="pl-lab">${lab}</span>
      <span class="pl-n">${piles[k].length}</span>
    </div>`;
  el.innerHTML=`<p class="sp-k">The room · ${ball} ballot${ball===1?"":"s"}</p>
    <div class="piles">${col("against","Against")}${col("abstain","Abstain")}${col("for","For")}</div>`+
    (noBallot?`<p class="pl-to">${noBallot} didn't vote</p>`:"")+
    `<p class="lv-verdict" hidden></p>`;
}
/* ---- margins: a verdict without one is half the information ----
   Winner-first (the prevailing side's count leads), abstentions only when
   nonzero. Reus/Brussels ship one seat-count `tally`; the bicameral Congress
   deck ships `tally_house`/`tally_senate` (no single honest number exists for
   a two-chamber decision). No tally data → verdict alone, never a guess. */
function marginPair(t){
  const f=t.for||0, a=t.against||0;
  return `${Math.max(f,a)}–${Math.min(f,a)}`+(t.abstain?` · ${t.abstain} abstained`:"");
}
function chamberMargin(d){
  // unanimous actas carry no head-count (tally ships all-zero — "s'aprova per
  // unanimitat" is the whole record): say that, never print a fabricated 0–0
  if(d.tally) return (d.tally.for||d.tally.against||d.tally.abstain)
    ? marginPair(d.tally)
    : (d.decided==="unanimous"?"unanimous":"");
  // single-chamber measures (the other chamber never voted) carry only their
  // own labelled count — the label keeps it from reading as the whole Congress
  const h=d.tally_house?`house ${marginPair(d.tally_house)}`:"";
  const s=d.tally_senate?`senate ${marginPair(d.tally_senate)}`:"";
  return h&&s?`${h} · ${s}`:(h||s);
}
function stampOutcome(card,d){
  if(!d.outcome) return;
  const ok=d.outcome==="approved";
  const st=document.createElement("div");
  // st-app / st-rej, NOT "app": a bare `app` class collides with the page root
  // (.app{height:100dvh}) and inflated every APPROVED stamp to viewport height
  st.className="stamp official "+(ok?"st-app":"st-rej");
  const m=chamberMargin(d);
  st.innerHTML=`<small>${esc(CHAMBER)}</small>${ok?"APPROVED":"REJECTED"}`
    +(m?`<small class="st-m">${m}</small>`:"");
  stampRow(card).appendChild(st);   // next to the user's stamp — two imprints, one glance
}
function runRevealBeats(top,d){
  top.dataset.revealed="1";
  top.classList.add("voted");
  stampOutcome(top,d);                               // beat 1: the verdict — the chamber's imprint
  setTimeout(()=>{                                   // beat 2: the room rains in as emoji piles
    if(!top.isConnected) return;
    const slot=top.querySelector(".castp")||top.querySelector(".acts");
    if(slot){ slot.className="split"; renderLivePiles(slot,d.id); }
    const v=top.querySelector(".lv-verdict");
    if(v){ const c=verdictCopy(d); v.hidden=false; v.classList.add(c.cls); v.textContent=c.tx; }
  },900);
}

/* ---- final reveal: the personal headline first, the room's verdict closes the page ---- */
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
    (X?`<div class="rv-list">`+items.map(({d,rv})=>{
      // both sides carry the same margin format — parallel facts, one glance
      const rm=marginPair(LIVE.tally(d.id)), cm=chamberMargin(d);
      return `<div class="rv-row">
        <span class="rv-t">${esc(d.headline||d.title)}</span>
        <span class="rv-chips"><span class="badge ${rv==="approved"?"b-app":"b-rej"}">room: ${rv} ${rm}</span>
        <span class="badge ${d.outcome==="approved"?"b-app":"b-rej"}">${esc(CHAMBER.replace(/^the /,""))}: ${d.outcome}${cm?" "+cm:""}</span></span>
      </div>`;}).join("")+`</div>`:"");
}
function renderFinal(){
  if(lvShownState==="final") return;
  lvShownState="final";
  stopCountdown();
  document.body.classList.remove("live-paused");
  document.body.classList.add("live-final");       // re-opens ⚙ (minutes, import) for voters
  buildRoomVerdict();
  finish();
  const r=$("#restart"); if(r) r.style.display="none";   // the moderator owns the session
}

/* ---- lobby (voter): a seat in the sitting ----
   Every visible string comes from CFG.lobby (per-city config) — no copy
   conditionals here. The docket line's {period}/{n} are computed from the
   active deck's metadata (decision dates, deck length), never hardcoded. */
function deckPeriod(){
  let lo=Infinity, hi=-Infinity;
  for(const id of ((lvS&&lvS.deck)||[])){
    const d=byId[id], y=d&&d.date?parseInt(d.date.slice(0,4),10):NaN;
    if(Number.isFinite(y)){ lo=Math.min(lo,y); hi=Math.max(hi,y); }
  }
  if(!Number.isFinite(lo)) return "";
  return lo===hi ? String(lo) : lo+"–"+hi;
}
/* refresh hold: the sessionStorage flag lets the inline head script re-seat
   this tab in the lobby on frame one (html.lvhold) before Firebase delivers
   the first snapshot. Seated → renew; leaving → clear. Either way the CSS
   hold class retires here — body classes carry the layout from now on. */
function lvHold(on){
  document.documentElement.classList.remove("lvhold");
  try{ if(on) sessionStorage.setItem("riot.liveLobby",CFG.id);
       else   sessionStorage.removeItem("riot.liveLobby"); }catch(e){}
}
/* ---- the wall: a voter URL with no sitting behind it is not an entrance.
   Reuses the bare-URL holding page (html.hold swaps shell ↔ holding).
   Reversible: a sitting created while a tab waits here turns the wall back
   into the seat gate on the next snapshot. */
function lvWall(on){
  if(LIVE_ROLE==="mod") return;
  document.documentElement.classList.remove("lvhold");
  document.documentElement.classList.toggle("hold",on);
  const h=$("#holding"); if(h) h.hidden=!on;
  document.title=on?"RIOT":(CFG.title||"RIOT");
}
/* ---- the seat gate: a sitting exists and this tab hasn't taken a seat in
   it. Until the tap (app.js gateGo → LIVE.seat) the tab is invisible — no
   presence record, no lobby face, no place in the all-in counts. */
function showSeatGate(){
  lvWall(false);
  lvHold(false);                     // gated ≠ seated: a refresh re-asks, not re-paints
  document.body.classList.add("live-voter");
  if(typeof gateShow==="function") gateShow(true);
}
const LB_FACES=8;                  // visible lobby avatars; the rest fold into a +N chip
const lvFaceBorn=new Map();        // face key → first-seen ms: newcomers keep their pop
function lobbyPresence(){          // through presence-ping re-renders (innerHTML rebuilds
  const lb=$("#lobby"); if(!lb||lb.hidden) return;   // would otherwise cut it at frame one)
  // the gathering counts its watcher: you're in the room before you're in the
  // record (presence WRITES stay seat-gated). Without the +1 the first arrivals
  // all stare at "0 in the room" — a dead room that reads as broken multiplayer.
  $("#lobbyCount").textContent=mpVisiblePids().length+1;
  const ppl=[];
  if(lvSeated) ppl.push({k:"me",e:identity&&identity.emoji,nm:(identity&&identity.name)||"you",me:true});
  for(const pid of mpVisiblePids()) ppl.push({k:pid,e:PEERS[pid].e,nm:PEERS[pid].nm,me:false});
  const vis=ppl.slice(0,LB_FACES), more=ppl.length-vis.length, now=Date.now();
  $("#lobbyFaces").innerHTML=vis.map(p=>{
    if(!lvFaceBorn.has(p.k)) lvFaceBorn.set(p.k,now);
    const f=faceHTML(p.e,p.nm,p.me);
    return now-lvFaceBorn.get(p.k)<450 ? f.replace('class="face','class="face lb-pop') : f;
  }).join("")+(more>0?`<span class="face init lb-ovf">+${more}</span>`:"");
}
function showLobby(){
  lvShownState="lobby"; lvShownIdx=-1;
  document.body.classList.remove("live-final");
  document.body.classList.add("live-lobby");
  const lb=$("#lobby");
  if(lb.hidden){ lb.hidden=false; lvFaceBorn.clear(); }   // fresh gathering: everyone pops once
  const L=CFG.lobby||{};
  $("#lobbyChip").textContent=L.live_chip||"";
  $("#lobbyTitle").textContent=L.title||"";
  // pre-snapshot (refresh hold) there is no deck yet — leave the {count} lines
  // blank rather than printing "0 decisions"; the first snapshot fills them
  $("#lobbyOne").textContent=lvS ? (L.one_liner||"")
    .replace("{count}",(lvS.deck||[]).length).replace("{body}",L.body_name||"") : "";
  $("#lobbyCountLine").textContent=L.count_line||"";
  // the CTA is the seat metaphor: it opens the seat gate (whose tap IS the join);
  // once seated it retires — your face in the row is the confirmation
  const cta=$("#lobbyCta"); cta.textContent=L.cta||""; cta.hidden=lvSeated;
  // session metadata, folded away behind one small line
  $("#lobbyAboutLbl").textContent=L.about_label||"";
  $("#lobbyAbout").hidden=!L.about_label;
  $("#lobbyInst").textContent=L.docketInstitutionLine||"";
  $("#lobbyDocketLine").textContent=lvS ? (L.docketCountLine||"")
    .replace("{period}",deckPeriod()).replace("{n}",(lvS.deck||[]).length) : "";
  $("#lobbyDisc").textContent=L.disclosure||"";
  lobbyPresence();
  lvHold(lvSeated);                // gated ≠ seated: only a seated tab re-paints on refresh
}
/* peers arrive over presence, not session snapshots — keep the gathering live
   (both the voter lobby AND the moderator's stage: nothing writes to the session
   node while people gather, so without this the stage faces never refresh) */
(function(){
  const prev=window.renderStrip;
  window.renderStrip=function(){ if(prev)prev();
    if(lvS&&lvS.state==="lobby"){ lobbyPresence(); if(LIVE_ROLE==="mod")renderStage(); } };
})();
function hideLobby(){
  lvHold(false);
  document.body.classList.remove("live-lobby");
  const lb=$("#lobby"); if(lb) lb.hidden=true;
  lb&&lb.classList.remove("opening");
  const op=$("#lobbyOpen"); if(op) op.hidden=true;
}
/* the transition: the document falls away, one line of the minutes remains —
   the chair's formula — then the first card lands. Only plays for voters who
   witnessed the gathering (lobby → voting on card 0). */
let lvOpening=false;
function openSitting(){
  const L=CFG.lobby||{};
  if(!L.sittingOpenedFormula){ hideLobby(); syncDeck(()=>applyPhase()); return; }
  lvOpening=true;
  const lb=$("#lobby"), op=$("#lobbyOpen");
  $("#lobbyOpenK").textContent=L.live_chip||"";
  $("#lobbyFormula").textContent=L.sittingOpenedFormula;
  lb.hidden=false;                 // the formula's canvas (a tab that seated mid-open has it hidden)
  op.hidden=false;
  lb.classList.add("opening");
  setTimeout(()=>{
    lvOpening=false;
    hideLobby();
    if(lvS&&lvS.state!=="lobby"&&lvS.state!=="ended"&&lvS.state!=="final") syncDeck(()=>applyPhase());
  },1600);
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
  const out=[{code:"*",all:true,date:"",ids:list.flatMap(s=>s.ids)},...list];
  // The city's curated DEMO deck (CFG.demo_deck) pins above everything
  const demo=(CFG.demo_deck||[]).filter(id=>byId[id]&&byId[id].headline&&!byId[id].curator_drop&&byId[id].outcome);
  if(demo.length) out.unshift({code:"DEMO",demo:true,date:"",ids:demo});
  return out;
}
function renderModSetup(){
  const el=$("#modSetup"); el.hidden=false;
  const w=el.querySelector(".ms-wrap");
  if(!modSel){
    const ss=modSessions();
    w.innerHTML=`<p class="ms-k">Moderator · ${esc(CFG.name)}</p>
      <h2 class="ms-h">Pick the plenary session.</h2>
      <p class="ms-sub">One session is one deck. You can trim items next. Switch city from the header.</p>
      <div class="ms-list">`+ss.map(s=>`<button class="ms-sess${s.all||s.demo?" all":""}" type="button" data-code="${esc(s.code)}">
        <span class="ms-date">${s.demo?"DEMO":s.all?"All plenaries":esc(s.date)}</span>
        <span class="ms-code">${s.demo?"the curated showcase deck":s.all?"every decision · newest session first":esc(s.code)}</span>
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
      <label>synthetic voters <input id="msBots" type="number" inputmode="numeric" min="0" max="24" value="${modSel.bots}"> <small>fake people who vote at random</small></label>
      ${AI?`<label>GHOST <span class="switch"><input id="msGhost" type="checkbox" ${modSel.ai?"checked":""}><span class="slider"></span></span> <small>seats the ghost in the reveal</small></label>`:""}
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
      modSel={code:s.code,ids:new Set(s.ids),timer:30,reveal:0,bots:0,ai:0}; renderModSetup(); return; }
    if(e.target.closest(".ms-back")){ modSel=null; renderModSetup(); return; }
    if(e.target.closest(".ms-go")){
      modSel.timer=Math.max(10,parseInt($("#msTimer").value,10)||30);
      modSel.reveal=Math.max(0,parseInt($("#msReveal").value,10)||0);
      modSel.bots=Math.max(0,Math.min(24,parseInt($("#msBots").value,10)||0));
      modSel.ai=(AI && $("#msGhost") && $("#msGhost").checked)?1:0;
      const order=modSessions().find(x=>x.code===modSel.code).ids.filter(id=>modSel.ids.has(id));
      if(!order.length) return;
      el.hidden=true;
      startSession(order,{timer:modSel.timer,reveal:modSel.reveal,bots:modSel.bots,ai:modSel.ai});
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
  botsSync();
  const key=lvS.state+":"+lvS.idx+":"+(lvS.deadline||0);
  if(key!==lvAuthKey){
    lvAuthKey=key;
    clearTimeout(lvDeadlineT); clearTimeout(lvAutoNextT); clearTimeout(lvAllInT); lvAllInT=0;
    if(lvS.state==="voting"){
      lvDeadlineT=setTimeout(()=>{ if(lvS&&lvS.state==="voting") goReveal(); },
                             Math.max(lvS.deadline-lvStore.now(),0)+250);
      botsSchedule();
    } else if(lvS.state==="reveal" && lvS.cfg && lvS.cfg.reveal>0){
      lvAutoNextT=setTimeout(()=>{ if(lvS&&lvS.state==="reveal") modNext(); }, 2300+lvS.cfg.reveal*1000);
    }
  }
  if(lvS.state==="voting") checkAllIn();
}

/* ---- synthetic voters (cfg.bots): the moderator stages a fuller room ----
   N fake people the moderator's client seats in the room — REAL participant
   records + real tally/cast writes, so every phone renders them exactly like
   humans (lobby faces, ballots-in counts, the reveal's piles) with zero
   voter-side code. Directions are random; timing is human-ish (a spread, a
   cluster at the deadline, the odd timeout). Presence goes through PEERS in
   a sim room and through mpPart on Firebase (onDisconnect ⇒ the moderator
   leaving takes their fakes with them); casts go through lvStore either way.
   Deterministic pids ("bot<i>") let a reloaded moderator re-adopt the same
   fakes instead of orphaning them. */
let botIds=[], botJoinQ=0, botJoinT=[], botCastT=[], botSkip={}, botCardId=null;
function botsActive(){
  return LIVE_ROLE==="mod" && lvS && lvS.cfg && (lvS.cfg.bots|0)>0
      && (SIMLIVE>0 || !!(window.mpDb && typeof mpPart!=="undefined" && mpPart));
}
function botsSync(){
  if(lvS && lvS.state==="ended"){ botsRemove(); return; }
  if(!botsActive()) return;
  const n=lvS.cfg.bots|0;
  while(botJoinQ<n){                 // they trickle into the lobby like people do
    const i=botJoinQ++;
    botJoinT.push(setTimeout(()=>botJoin(i),
      lvS.state==="lobby" ? 400+i*(500+Math.random()*700) : 60+i*140));
  }
}
function botJoin(i){
  if(!lvS || lvS.state==="ended" || !botsActive()) return;
  const pid="bot"+i;
  if(botIds.indexOf(pid)<0) botIds.push(pid);
  const rec={e:SIM_FACES[i%SIM_FACES.length], nm:SIM_NAMES[i%SIM_NAMES.length],
             c:null, n:0, t:(lvS.deck||[]).length, s:lvSid};   // seated by the moderator into THIS sitting
  if(SIMLIVE){ PEERS[pid]=rec; }
  else { rec.ts=firebase.database.ServerValue.TIMESTAMP;
         const ref=mpPart.child(pid); ref.set(rec); ref.onDisconnect().remove(); }
  if(typeof renderStrip==="function") renderStrip();
  if(LIVE_ROLE==="mod") renderStage();                       // lobby faces update now
  if(lvS.state==="voting") botCastAt(pid, lvCurId());        // latecomer still votes this card
}
function botsSchedule(){              // (re)arm this card's casts — new card or resume
  if(!botsActive()) return;
  const id=lvCurId(); if(!id) return;
  for(const t of botCastT) clearTimeout(t); botCastT=[];
  if(botCardId!==id){ botCardId=id; botSkip={};
    for(const pid of botIds) if(Math.random()<0.07) botSkip[pid]=1;   // the odd timeout
  }
  const cast=(lvS.cast||{})[id]||{};
  for(const pid of botIds){ if(!botSkip[pid] && !cast[pid]) botCastAt(pid,id); }
}
function botCastAt(pid,id){
  if(botSkip[pid]) return;
  const dur=Math.max(lvS.deadline-lvStore.now(),3000);
  const late=Math.random()<0.4;       // most spread out, a cluster near the deadline
  const at=late ? Math.max(dur-(400+Math.random()*2600),600)
                : 700+Math.random()*Math.max(dur-5200,1200);
  botCastT.push(setTimeout(()=>{
    if(!lvS || lvS.state!=="voting" || lvCurId()!==id) return;
    if(((lvS.cast||{})[id]||{})[pid]) return;
    const r=Math.random(), v=r<0.42?"for":r<0.8?"against":"abstain";
    lvStore.inc(`${lvSess()}/tallies/${id}/${v}`);
    lvStore.set(`${lvSess()}/cast/${id}/${pid}`,v);          // feeds the reveal's piles
    const n=lvS.idx+1;
    if(SIMLIVE){ const p=PEERS[pid];
      if(p){ p.n=n; if(typeof activityTick==="function") activityTick(pid); } }
    else mpPart.child(pid).update({n});                      // activity tick on every phone
  },at));
}
function botsRemove(){
  for(const t of botJoinT) clearTimeout(t);
  for(const t of botCastT) clearTimeout(t);
  botJoinT=[]; botCastT=[]; botJoinQ=0; botCardId=null; botSkip={};
  for(const pid of botIds){
    if(SIMLIVE) delete PEERS[pid];
    else if(typeof mpPart!=="undefined" && mpPart){
      const ref=mpPart.child(pid); ref.onDisconnect().cancel(); ref.remove(); }
  }
  botIds=[];
  if(typeof renderStrip==="function") renderStrip();
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
/* the join code: QR drawn as inline SVG so it wears the print ink (one path,
   crisp edges); the white panel behind it comes from CSS (.sg-qr) — scanners
   want real white, not paper. Degrades to nothing if the encoder didn't load. */
function qrSVG(url){
  if(typeof qrcode!=="function") return "";
  try{
    const qr=qrcode(0,"M"); qr.addData(url); qr.make();
    const n=qr.getModuleCount(), Q=2;                      // 2 modules in-SVG + CSS padding = full quiet zone
    let d="";
    for(let r=0;r<n;r++)for(let c=0;c<n;c++) if(qr.isDark(r,c)) d+=`M${c+Q} ${r+Q}h1v1h-1z`;
    return `<svg class="sg-qr" viewBox="0 0 ${n+2*Q} ${n+2*Q}" shape-rendering="crispEdges" role="img" aria-label="Scan to join: ${esc(url)}"><path d="${d}" fill="currentColor"/></svg>`;
  }catch(e){ return ""; }
}
let sgKey="";
function renderStage(){
  const sg=$("#stage"); if(!sg) return;
  sg.hidden=false;
  const st=lvS.state, id=lvCurId(), d=id?byId[id]:null;
  // pausing must not rebuild the card skeleton (it would reset the frozen bar)
  const key=(st==="paused"?"voting":st)+":"+lvS.idx+":"+(lvS.deck||[]).join(",");
  // ALWAYS carry ?city= — a bare URL is the holding page (index.html), not the app
  const joinUrl=location.host+location.pathname.replace(/index\.html$/,"")+`?city=${CFG.id}`;
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
            ${qrSVG(location.protocol+"//"+joinUrl)}
            <h1 class="sg-join">${esc(joinUrl)}</h1>
            <p class="sg-sub">scan it — or type it · pick a face · take your seat</p>
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
    const faces=[]; for(const pid of mpVisiblePids()) faces.push(faceHTML(PEERS[pid].e,PEERS[pid].nm,false));
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
      const host=sg.querySelector(".sg-card");
      stampOutcome(host,d);                          // beat 1: the chamber's verdict
      setTimeout(()=>{ if(!rev.isConnected)return;   // beat 2: the room's piles
        rev.className="sg-revwrap split"; renderLivePiles(rev,d.id);
        const v=rev.querySelector(".lv-verdict");
        if(v){ const c=verdictCopy(d); v.hidden=false; v.classList.add(c.cls); v.textContent=c.tx; }
      },900);
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
    (X?`<div class="sg-rvlist">`+items.map(({d,rv})=>{
      const rm=marginPair(LIVE.tally(d.id)), cm=chamberMargin(d);   // same parallel margins as the voter list
      return `<div class="rv-row">
        <span class="rv-t">${esc(d.headline||d.title)}</span>
        <span class="rv-chips"><span class="badge ${rv==="approved"?"b-app":"b-rej"}">room: ${rv} ${rm}</span>
        <span class="badge ${d.outcome==="approved"?"b-app":"b-rej"}">${esc(CHAMBER.replace(/^the /,""))}: ${d.outcome}${cm?" "+cm:""}</span></span>
      </div>`;}).join("")+`</div>`:"")+
    `<p class="sg-sub">each phone now shows its own reveal — closest party, the map, the ghost.</p>`;
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
      lvStore.set(`${lvSess()}/cast/${id}/${pid}`,v);   // direction — feeds the reveal's piles
      PEERS[pid].n++;
      if(typeof activityTick==="function") activityTick(pid);
    },at);
  }
}
