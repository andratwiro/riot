/* RIOT viewer — core app: city config, state, card stack (the booth), done screen
   (the reveal). Load order matters (plain scripts sharing top-level globals):
   app.js → map.js → views.js → multiplayer.js → inline boot in index.html.

   Booth doctrine: during voting the app broadcasts ACTIVITY, never DIRECTION.
   No party data, no affinity, no map in the voting flow — the parties and the
   map belong to the reveal. The room's split on a card is shown only AFTER your
   own vote on that card is cast. */
// Known cities for the header selector (adding one also needs a cities/<id>/ bundle).
const CITIES=[
  {id:"reus",name:"Reus",logo:"assets/logos/reus_rose_color.svg"},
  {id:"brussels",name:"Brussels",logo:"assets/logos/brussels_iris.svg"},
  {id:"congress",name:"Congress",logo:"assets/logos/us_capitol.svg"},
  {id:"southafrica",name:"South Africa",logo:"assets/logos/za_protea.svg"},
  {id:"tunisia",name:"Tunisia 14–18",logo:"assets/logos/tn_crescent.svg"},
  {id:"commons",name:"Commons 2019",logo:"assets/logos/uk_portcullis.svg"},
  {id:"weimar",name:"Weimar 29–33",logo:"assets/logos/de_eagle.svg"},
  {id:"bundestag",name:"Bundestag",logo:"assets/logos/de_dome.svg"}
];
const CFG=window.CITY_CONFIG||{id:"reus",name:"Reus",title:"REUS",lang:"ca",logo:"assets/logos/reus_rose_color.svg"};
document.title=CFG.title||"RIOT";
// In-city tabs wear the city's icon; the bare-URL holding page keeps the
// default GHOST soul-anchor favicon (assets/favicon.svg).
if(location.search&&CFG.logo){const fv=document.getElementById("favicon");if(fv)fv.href=CFG.logo;}
document.documentElement.lang=CFG.lang||"en";
const R = window.RIOT || {decisions:[], parties:[]};
// The GHOST's blind votes (id -> {vote,confidence,rationale}); null until ai_vote.py / the ghost run has produced them.
const AI = (window.AI_VOTES && window.AI_VOTES.votes) || null;
// The BLANK's votes — the no-soul control: same neutral inputs, same mechanics, NO
// worldview. It rides the ghost's seat switch: wherever the GHOST is seated, the
// blank seats too (it only exists to be compared against the ghost and You).
const BLANKV = (window.BLANK_VOTES && window.BLANK_VOTES.votes) || null;
const PARTIES = R.parties || [];
const QS = new URLSearchParams(location.search);
/* ?solo=1 — the deliberate solo entrance: the booth alone, full deck, no room,
   no live resolution, no presence (the plain voter URL stays the sitting's
   entrance and nothing else). Built for the self-experiment: vote at your own
   pace, ⧉ Copy votes to save, import to resume. &ai=1 seats the GHOST on the
   reveal (solo only — in a sitting, ghost mode belongs to the moderator's cfg). */
const SOLO = QS.get("solo")==="1";
// Add/remove the GHOST as one more "party" (reveal map + compare view). Off by default; moderator cfg / &ai=1.
function applyGhostParty(on){
  // the GHOST and its BLANK control seat and clear together — one switch
  const seats=[];
  if(AI)     seats.push({token:"GHOST",name:"Ghost",store:AI,    extra:{}});
  if(BLANKV) seats.push({token:"BLANK",name:"Blank",store:BLANKV,extra:{blank:true}});
  for(const s of seats){
    const has=PARTIES.some(p=>p.token===s.token);
    if(on && !has){
      PARTIES.push({token:s.token,name:s.name,color:"var(--ghost-ink)",logo:null,ghost:true,...s.extra});
      for(const d of R.decisions){const rec=s.store[d.id]; if(rec){(d.party_votes_canon=d.party_votes_canon||{})[s.token]=rec.vote;}}
    } else if(!on && has){
      const i=PARTIES.findIndex(p=>p.token===s.token); if(i>=0) PARTIES.splice(i,1);
      for(const d of R.decisions){ if(d.party_votes_canon) delete d.party_votes_canon[s.token]; }
    }
  }
  rebuildMap();      // PARTIES changed → recompute the reveal-map coordinates
}
/* ---- the GHOST mark — "soul anchor": a dashed ring (the shell) around a solid
   dot (the soul). ONE source of truth, 40×40 viewBox, inked in --ghost-ink (the
   same violet the YOU ring wears — the ghost is chromatically YOURS, never a
   party colour). No fill inside the ring: the paper shows through. The dash
   pattern re-tunes per size tier so the ring keeps readable dashes instead of
   scaling into a blur; shell and core are separate nodes (.g-shell/.g-core) so
   the map's honesty pass can displace the shell while the core holds the true
   coordinate. opts.noCore renders the shell alone. */
function ghostMark(size,opts){
  // ~8–10 visible dashes at every size (Rob: dashes LESS frequent, never a blur)
  const g = size>=32 ? {sw:2,  dash:"6.6 4.4", core:4.5}     // chip (≥32px)
          : size>=22 ? {sw:2,  dash:"7.2 5",   core:4.2}     // list / map (~28–30px)
                     : {sw:1.8,dash:"7.8 5.6", core:4};      // anything smaller
  return `<svg class="ghostmark" viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true">`+
    `<circle class="g-shell" cx="20" cy="20" r="17" fill="none" stroke="var(--ghost-ink)" stroke-width="${g.sw}" stroke-dasharray="${g.dash}" stroke-linecap="round"/>`+
    ((opts&&opts.noCore)?"":`<circle class="g-core" cx="20" cy="20" r="${g.core}" fill="var(--ghost-ink)"/>`)+
    `</svg>`;
}
const $ = s => document.querySelector(s);
const VLAB = {for:"for", against:"against", abstain:"abstain", split:"split", absent:"absent"};
const byId = Object.fromEntries(R.decisions.map(d=>[d.id,d]));

/* ---- deck ----
   Full deck for async visitors; ?deck=live = the curated room session (~15–20
   contested cards, same SET for everyone in the room; order is still per-person). */
const DECK_MODE = (QS.get("deck")||"").toLowerCase()==="live" ? "live" : "full";
const votable = d => d.headline && !d.curator_drop;
function liveDeckIds(){
  // curator's committed pick wins; fallback = most-contested heuristic (real
  // for-vs-against opposition, ranked by how evenly the chamber split).
  if(Array.isArray(CFG.live_deck)&&CFG.live_deck.length)
    return CFG.live_deck.filter(id=>byId[id]&&votable(byId[id]));
  return R.decisions.filter(votable).map(d=>{
      const vs=Object.values(d.party_votes_canon||{});
      const f=vs.filter(v=>v==="for").length, ag=vs.filter(v=>v==="against").length;
      return (f&&ag)?{id:d.id,score:Math.min(f,ag)/Math.max(f,ag)}:null;
    }).filter(Boolean).sort((a,b)=>b.score-a.score)
    .slice(0,CFG.liveDeckSize||18).map(s=>s.id);
}
function buildDeck(excludeAnswered){
  let pool=R.decisions.filter(votable);
  if(DECK_MODE==="live"){const ids=new Set(liveDeckIds()); pool=pool.filter(d=>ids.has(d.id));}
  if(excludeAnswered) pool=pool.filter(d=>!(d.id in answers));
  // Solo reads as history: oldest sitting first, agenda order within a
  // sitting (point is null on the demo decks — stable sort keeps source
  // order there). Rooms stay shuffled per person.
  if(SOLO) return pool.slice().sort((a,b)=>
    (a.date||"").localeCompare(b.date||"") ||
    ((parseFloat(a.point)||0)-(parseFloat(b.point)||0)));
  return shuffle(pool);
}

let idx = 0;
let voting = false;          // true during the stamp/split beat — blocks double votes
const origShown = new Set(); // card ids currently showing the original (un-reworded) title
// Label for the original-wording toggle pill: states what the headline IS now
// (provenance), with a swap glyph for the tap affordance. The source language
// tag (e.g. "· fr") only appears when it differs from the display language.
function aiflagLabel(showOrig){
  const src=CFG.srcLang && CFG.srcLang!==(CFG.lang||"") ? ` · ${CFG.srcLang}` : "";
  return (showOrig?`Original${src}`:"✨ AI-reworded")+'<span class="aifswap">⇄</span>';
}
// Card detail-view "View source" disclosure label (booth only; the Minutes page
// keeps aiflagLabel above). Reveals the verbatim source wording inside See more
// — the source-language tag (· fr) shows only when it differs from the display.
function sourceLabel(open){
  const src=CFG.srcLang && CFG.srcLang!==(CFG.lang||"") ? ` · ${CFG.srcLang}` : "";
  return open ? `Hide source${src} ▴` : `View source${src} ▾`;
}
const answers = {};
/* curator marks + dev mode — persist across sessions in localStorage */
const MARK_KEY="riot.marks.v1", DEV_KEY="riot.dev.v1", DISMISS_KEY="riot.dismissed.v1";
function loadMarks(){try{return JSON.parse(localStorage.getItem(MARK_KEY))||[];}catch(e){return [];}}
function saveMarks(){try{localStorage.setItem(MARK_KEY,JSON.stringify(marks));}catch(e){}}
let marks=loadMarks();
function loadDismissed(){try{return JSON.parse(localStorage.getItem(DISMISS_KEY))||[];}catch(e){return [];}}
let dismissed=loadDismissed();
const isDismissed=id=>dismissed.includes(id);
function dismissSuggest(id){if(!isDismissed(id)){dismissed.push(id);try{localStorage.setItem(DISMISS_KEY,JSON.stringify(dismissed));}catch(e){}}}
// Curator powers belong to the moderator (?role=moderator) — toggled from the
// Minutes page. A persisted dev flag never activates on a plain voter URL.
const IS_MOD=(QS.get("role")||"").toLowerCase()==="moderator";
let devMode=false; try{devMode=IS_MOD&&localStorage.getItem(DEV_KEY)==="1";}catch(e){}
// Ghost mode: the moderator enables it per live session (cfg.ai); live.js flips it
// from snapshots. Solo is the one self-serve entrance: ?solo=1&ai=1.
let showGhost=SOLO && !!AI && QS.get("ai")==="1";
try{localStorage.removeItem("riot.ai.v1");}catch(e){}   // retire the old per-visitor toggle
const isMarked=id=>marks.some(m=>m.id===id);
let COORD = null, MX = {};
// the active projection's placement fn for any ballot (set by map.js): the joint
// room map places by PCA score; the others fall back to out-of-sample distance fit
let PLACE = null;
// After-vote room split: feature-flagged (default ON), only ever rendered post-vote.
const SPLIT_ON = QS.get("split")==="0" ? false : (CFG.live_split!==false);

function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function esc(s){return (s||"").replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));}
// at most one run per `ms`, trailing edge — coalesces backend write bursts
// (the final reveal: ~room-size near-simultaneous presence/cov events) into
// a few paints instead of one map re-solve per event
function throttleTrail(fn,ms){
  let t=0,last=0;
  return ()=>{ if(t) return;
    t=setTimeout(()=>{ t=0; last=Date.now(); fn(); }, Math.max(0,ms-(Date.now()-last))); };
}

let deck = buildDeck();

// agreement with each party for ANY ballot record {decisionId: dir} — mine is
// affinity(); the map also blends peers from theirs (live cast markers)
function affinityFor(votes){
  const res={};
  for(const p of PARTIES){
    let comp=0,match=0;
    for(const id in votes){
      const d=byId[id]; if(!d) continue;
      const pv=(d.party_votes_canon||{})[p.token];
      if(pv==="for"||pv==="against"||pv==="abstain"){comp++; if(pv===votes[id])match++;}
    }
    res[p.token]=comp?{pct:Math.round(100*match/comp),comp}:{pct:null,comp:0};
  }
  return res;
}
function affinity(){ return affinityFor(answers); }
function logoEl(p){
  if(p.ghost) return `<span class="lg ghost${p.blank?" blank":""}"></span>`;   // decorateGhost() inks the mark at the right size tier (blank = shell only, no core)
  return p.logo ? `<span class="lg bg-${p.token}"><img src="${p.logo}" alt="${p.name}"></span>`
                : `<span class="lg fb" style="background:${p.color}">${p.token}</span>`;
}

/* ---- progress: my thin ink line + a small violet tick where the room is ---- */
function updateProgress(){
  // during the post-vote beat (voting=true) the current card counts as cast
  const n=Math.min(idx+(voting?1:0),deck.length);
  $("#progress").textContent = `${Math.min(idx+1,deck.length)} / ${deck.length}`;
  $("#progressFill").style.width = (deck.length?100*n/deck.length:0)+"%";
}
// called by multiplayer.js with the room's average completion (0..1) or null
function setRoomProgress(ratio){
  const t=$("#roomTick"); if(!t)return;
  if(ratio==null||idx>=deck.length){t.hidden=true;return;}
  t.hidden=false; t.style.left=`calc(${Math.round(ratio*100)}% - 1px)`;
}

// Render a rich "brief" (light markdown: blank-line paragraphs, "- " bullets, **bold**).
function renderBrief(md){
  const bold=s=>esc(s).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>");
  const html=String(md).split(/\n{2,}/).map(block=>{
    const lines=block.split("\n").map(l=>l.trim()).filter(Boolean);
    if(lines.length && lines.every(l=>l.startsWith("- ")))
      return "<ul>"+lines.map(l=>"<li>"+bold(l.slice(2))+"</li>").join("")+"</ul>";
    return "<p>"+bold(lines.join(" "))+"</p>";
  }).join("");
  return `<div class="brief">${html}</div>`;
}
function renderStack(){
  const stack=$("#stack");
  if(idx>=deck.length){finish();return;}
  $("#progressRow").style.display="";
  updateProgress();
  stack.innerHTML="";
  for(let k=Math.min(idx+2,deck.length-1);k>=idx;k--){
    const d=deck[k],depth=k-idx;
    const el=document.createElement("div");
    el.className="card"+(depth===1?" behind1":depth===2?" behind2":"");
    const topic = esc(d.topic||"Decision");
    // The booth face carries the AI-reworded headline alone (Rob, 2026-06-13):
    // the kicker and the verbatim source wording moved into the detail view.
    const head = esc(d.headline);
    const long = (d.headline||"").length>110 ? ` class="long"` : "";
    const main = d.source_brief ? renderBrief(d.source_brief)
               : `<div class="body">${esc(d.human_body||"")}</div>`;
    // verbatim source wording — the institution's own words, one tap inside See
    // more behind "View source". Amber/editorial idiom; mono "minutes" face.
    const srcText = d.title && d.title!==d.headline ? d.title : null;
    const srcBlock = srcText
      ? `<button class="srcmore" type="button" aria-expanded="false">${sourceLabel(false)}</button>`+
        `<div class="srcorig" hidden${CFG.srcLang?` lang="${esc(CFG.srcLang)}"`:""}>${esc(srcText)}</div>`
      : "";
    const dfacts = d.deep_facts || d.deep;   // neutral, cited (what the ghost reads)
    const deep = dfacts
      ? `<button class="deepmore" type="button">Full analysis ▾</button>`+
        `<div class="deep" hidden>${renderBrief(dfacts)}`+
        (d.deep_lectura?`<div class="lectura">${renderBrief(d.deep_lectura)}</div>`:"")+
        `</div>`
      : "";
    // See more carries the kicker, the brief, the verbatim source, then analysis
    const body = `<span class="topic">${topic}</span>`+main+srcBlock+deep;
    // LIVE first ballot only: the lobby's moved privacy line, in micro-type
    // under the buttons — where the hesitation happens
    const notes = depth===0 && window.LIVE && LIVE.cardNotes ? LIVE.cardNotes(d.id) : null;
    const acts = depth===0
      ? `<div class="acts">
          <button class="btn a" data-v="against">Against</button>
          <button class="btn ab" data-v="abstain">Abstain</button>
          <button class="btn f" data-v="for">For</button>
          ${notes&&notes.privacy?`<p class="acts-priv">${esc(notes.privacy)}</p>`:""}
        </div>`
      : "";
    const showSug = depth===0 && devMode && d.auto_suggest && !isMarked(d.id) && !isDismissed(d.id);
    const suggest = showSug
      ? `<div class="suggest"><span class="stxt">🤖 Suggested: not worth voting</span>`+
        `<button class="sugOk" type="button">Confirm</button>`+
        `<button class="sugNo" type="button">Dismiss</button></div>`
      : "";
    el.innerHTML=`<button class="closex" type="button" aria-label="Close">✕</button>
      ${suggest}
      <h2${long}>${head}</h2>
      <button class="more" type="button">See more ▾</button>
      <div class="reveal" hidden>${body}</div>
      ${acts}`;
    stack.appendChild(el);
  }
  updateDevBar();
}

/* ---- the vote beat: stamp → (room split) → next card ----
   The split renders ONLY after this user's vote is in the tally, so it can't
   bias them; it shows counts, never who. Tap anywhere to move on early. */
let splitUpdate=null;          // multiplayer.js calls this when the room tally changes
const STAMP_TXT={for:"FOR",against:"AGAINST",abstain:"ABSTAIN"};
// Stamps land in a right-aligned zero-height row just above the action slot and
// grow upward — overlapping the content above is part of the effect; the card
// never resizes when a stamp lands. Still in normal flow: an absolute stamp
// shrink-fits against its offsets and can wrap one-letter-per-line once real
// fonts load.
function stampRow(card){
  let row=card.querySelector(".stamprow");
  if(!row){
    row=document.createElement("div"); row.className="stamprow";
    // .sg-revwrap: the stage's reveal slot — its beat-1 stamp lands before .split exists
    const slot=card.querySelector(".acts,.castp,.split,.sg-revwrap");
    if(slot) card.insertBefore(row,slot); else card.appendChild(row);
  }
  return row;
}
function renderSplitInto(el,id,myVote){
  const t=(typeof roomTally==="function" && roomTally(id))||{};
  const rows=[["against","Against"],["abstain","Abstain"],["for","For"]];
  const total=rows.reduce((s,[k])=>s+(t[k]||0),0)||1;
  el.innerHTML=`<p class="sp-k">The room on this one · ${total} ballot${total===1?"":"s"}</p>`+
    rows.map(([k,lab])=>{
      const n=t[k]||0;
      return `<div class="sp-row${k===myVote?" mine":""}">
        <span class="sp-l">${lab}</span>
        <span class="sp-track"><span class="sp-fill" style="width:${Math.round(100*n/total)}%"></span></span>
        <span class="sp-n">${n}</span></div>`;
    }).join("")+
    `<p class="sp-hint">tap to continue</p>`;
}
/* Roomless after-vote beat (solo / async booth): the per-card reveal inherited
   from live sittings (v0.91/v0.94) — the chamber's official stamp lands beside
   mine and each party's canonical direction drops its logo disc on the
   Against/Abstain/For piles. Renders only AFTER my ballot is cast (the
   firewall is per-decision); no room, so no faces and no ballot count. The
   GHOST is neither room nor institution and never lands pre-reveal — seeing
   its prediction mid-deck would bias its keeper. */
function chamberPiles(d){
  const pvc=d.party_votes_canon||{};
  const pp={against:[],abstain:[],for:[]};
  for(const p of PARTIES){ if(p.ghost) continue; const col=pp[pvc[p.token]]; if(col) col.push(p); }
  return pp;
}
function renderChamberInto(el,pp,myVote){
  let i=0;                                       // global stagger across the three piles
  const pdisc=p=>`<span class="pl-drop" style="animation-delay:${(i++)*70}ms">${logoEl(p)}</span>`;
  const col=(k,lab)=>`<div class="pl-col${k==="abstain"?" quiet":""}${myVote===k?" mine":""}">
      <div class="pl-stack pl-chamber">${pp[k].map(pdisc).join("")||`<span class="pl-none">—</span>`}</div>
      <span class="pl-lab">${lab}</span>
    </div>`;
  el.innerHTML=`<p class="sp-k">${esc(CFG.chamber||"the chamber")} on this one</p>
    <div class="piles">${col("against","Against")}${col("abstain","Abstain")}${col("for","For")}</div>
    <p class="sp-hint">tap to continue</p>`;
}
function react(vote){
  if(voting || idx>=deck.length)return;
  const d=deck[idx];
  // live session: ballots open only during the voting phase, one per card
  if(window.LIVE && LIVE.active() && !LIVE.canVote(d.id))return;
  voting=true;
  answers[d.id]=vote;
  if(typeof mpVote==="function") mpVote(d.id,vote);   // tally + presence (no-op single-player)
  updateProgress();
  const top=$("#stack").lastChild;
  // 1) the stamp lands in the ballot's margin; the buttons recede (ballot is cast)
  if(top){
    top.classList.add("voted");
    const st=document.createElement("div");
    st.className="stamp"; st.textContent=STAMP_TXT[vote]||vote;
    stampRow(top).appendChild(st);
  }
  // live session: the stamp lands, then "ballot cast · n/m" — the card advances
  // only when the ROOM advances (lockstep), and the split waits for the reveal.
  if(window.LIVE && LIVE.active()){
    setTimeout(()=>{ if(top && top.isConnected) LIVE.afterCast(top); },430);
    return;
  }
  const proceed=()=>{
    if(!voting)return; voting=false; splitUpdate=null;
    if(top)top.classList.add(vote==="for"?"gone-r":vote==="against"?"gone-l":"gone-d");
    setTimeout(()=>{idx++;renderStack();},260);
  };
  // 2) the room's split on this card (only with a live room and the flag on)
  const tally = SPLIT_ON && typeof roomTally==="function" ? roomTally(d.id) : null;
  // no room → the chamber's per-card reveal instead (solo / async pass)
  const pp = (top && !tally) ? chamberPiles(d) : null;
  const ppN = pp ? pp.against.length+pp.abstain.length+pp.for.length : 0;
  if(top && tally){
    const acts=top.querySelector(".acts");
    setTimeout(()=>{
      if(!voting)return;
      if(acts){acts.classList.remove("acts");acts.classList.add("split");renderSplitInto(acts,d.id,vote);}
      splitUpdate=()=>{if(voting&&acts)renderSplitInto(acts,d.id,vote);};
      top.addEventListener("click",proceed,{once:true});
      setTimeout(proceed,2000);              // one beat, then next card
    },430);
  } else if(ppN){
    const acts=top.querySelector(".acts");
    setTimeout(()=>{
      if(!voting)return;
      if(typeof stampOutcome==="function") stampOutcome(top,d);   // the chamber's imprint (live.js)
      if(acts){acts.classList.remove("acts");acts.classList.add("split");renderChamberInto(acts,pp,vote);}
      top.addEventListener("click",proceed,{once:true});
      setTimeout(proceed,2600);              // a beat longer than the split — discs to read
    },430);
  } else {
    setTimeout(proceed,460);                 // stamp beat only
  }
}

/* ---- the reveal ---- */
function renderExtremes(ranked,a){
  const ex=$("#extremes");
  if(!ranked.length){ex.innerHTML="";ex.style.display="none";return;}
  ex.style.display="";
  const card=(cls,lab,p)=>`<button class="exc ${cls}" type="button" data-token="${p.token}" title="See where you and ${esc(p.name)} differ">
    <span class="exlab">${lab}</span>${logoEl(p)}
    <span class="exname" title="${esc(p.name)}">${esc(p.name)}</span>
    <span class="expct">${a[p.token].pct}%</span></button>`;
  const most=ranked[0], least=ranked[ranked.length-1];
  ex.innerHTML = ranked.length===1
    ? card("most","Closest",most)
    : card("most","Closest",most)+card("least","Furthest",least);
  decorateGhost(ex,46);
}
function renderDoneParties(ranked,a){
  const el=$("#doneParties");
  if(!ranked.length){el.innerHTML="";el.style.display="none";return;}
  el.style.display="";
  el.innerHTML=`<span class="dplabel">Every party · tap to compare your votes</span>`+
    ranked.map(p=>{const pct=a[p.token].pct;
      // the ghost's row reads like any party row ("Ghost", same face); only its
      // mark and the verb in its compare view say what it is
      return `<button class="dprow" type="button" data-token="${p.token}" title="See where you and ${esc(p.name)} differ">${logoEl(p)}
        <span class="dptx"><span class="dpname">${esc(p.name)}</span>
          <span class="dptrack"><span class="dpfill" style="width:${pct||0}%;background:${p.color}"></span></span></span>
        <span class="dppct">${pct==null?'—':pct+'%'}</span><span class="dpgo">›</span></button>`;
    }).join("");
  decorateGhost(el,34);
}
// ink the GHOST mark into any empty ghost logo slots (reveal screen) at the
// container's size tier — the slot stays a plain span so re-renders are cheap.
// The BLANK control wears the same ring with NO core: an anchor with no soul.
function decorateGhost(container,size){
  container.querySelectorAll('.lg.ghost:empty').forEach(slot=>{
    slot.innerHTML=ghostMark(size,{noCore:slot.classList.contains("blank")});
  });
}
// The finding, not a match score: even your closest list only votes like you X% of the time.
// The headline stands alone — the map and the ranked field below carry the detail.
function revealCopy(ranked,a){
  const n=Object.keys(answers).length;
  $("#doneKicker").textContent=`${n} ballot${n===1?"":"s"} cast`;
  const sub=$("#doneSub");
  if(!ranked.length){
    $("#doneHead").textContent="All done.";
    sub.hidden=false; sub.textContent="No comparable party votes on the decisions you drew.";
    return;
  }
  sub.hidden=true; sub.textContent="";
  const top=ranked[0], pct=a[top.token].pct;
  $("#doneHead").textContent =
    pct>=85 ? `${top.name} votes like you ${pct}% of the time.` :
    pct>=60 ? `Even your closest party only votes with you ${pct}% of the time.` :
    `No party votes the way you do. ${top.name} comes closest, at ${pct}%.`;
}
// the headline measures REPRESENTATION — a party verb ("votes with you"). The
// ghost measures fidelity ("predicts you") and never claims the finding.
function rankedParties(ranked){ return ranked.filter(p=>!p.ghost); }
function finish(){
  $("#stack").innerHTML="";
  $("#progressRow").style.display="none";
  voting=false; splitUpdate=null;
  const a=affinity();
  const ranked=PARTIES.filter(p=>a[p.token].comp).sort((x,y)=>a[y.token].pct-a[x.token].pct);
  revealCopy(rankedParties(ranked),a);
  if(typeof mpContributeCov==="function") mpContributeCov();   // add my ballot to the room's joint-map aggregate
  renderResultMap();            // the map's first appearance — animated into place (map.js)
  renderExtremes(ranked,a);
  renderDoneParties(ranked,a);
  doneVis(true);
  updateDevBar();
}

/* The reveal scrolls as THE PAGE: html.reveal releases the viewer's
   overflow:hidden page lock and #done leaves its absolute overlay (see
   style.css), so wheel/touch anywhere — including outside the 680px column
   on desktop — moves the results. One door for every show/hide so the page
   lock can't leak into the booth. */
function doneVis(on){
  $("#done").style.display=on?"flex":"none";
  document.documentElement.classList.toggle("reveal",on);
  if(!on) window.scrollTo(0,0);
}

function collapseCard(card){
  card.classList.remove("expanded");
  card.style.minHeight="";
  card.style.height="";
  card.querySelector(".reveal").setAttribute("hidden","");
}
$("#stack").addEventListener("click",e=>{
  if(voting)return;                          // during the stamp/split beat, taps just advance
  const more=e.target.closest(".more");
  if(more){
    const card=more.closest(".card");
    card.querySelector(".reveal").removeAttribute("hidden");
    card.classList.add("expanded");
    // Pin the card to the space left in #survey so .reveal scrolls instead of
    // overflowing off-screen (incl. when "Full analysis" adds more content).
    const survey=$("#survey");
    const avail=survey.getBoundingClientRect().bottom - card.getBoundingClientRect().top - 6;
    card.style.height=Math.max(avail,220)+"px";
    return;
  }
  if(e.target.closest(".sugOk")){            // confirm suggestion → mark + advance (not a vote)
    const d=deck[idx]; toggleMark(d);
    const top=$("#stack").lastChild; if(top)top.classList.add("gone-d");
    setTimeout(()=>{idx++;renderStack();},260); return;
  }
  if(e.target.closest(".sugNo")){            // dismiss suggestion → stays votable, stop nagging
    dismissSuggest(deck[idx].id); renderStack(); return;
  }
  const dm=e.target.closest(".deepmore");
  if(dm){
    const blk=dm.nextElementSibling;
    const open=blk.hasAttribute("hidden");
    if(open){blk.removeAttribute("hidden");dm.textContent="Hide analysis ▴";}
    else{blk.setAttribute("hidden","");dm.textContent="Full analysis ▾";}
    return;
  }
  const sm=e.target.closest(".srcmore");
  if(sm){
    const blk=sm.nextElementSibling;
    const open=blk.hasAttribute("hidden");
    if(open)blk.removeAttribute("hidden"); else blk.setAttribute("hidden","");
    sm.setAttribute("aria-expanded",String(open));
    sm.textContent=sourceLabel(open);
    return;
  }
  const af=e.target.closest(".aiflag");
  if(af){
    const id=af.dataset.id, h2=af.closest(".card").querySelector("h2"), d=byId[id];
    const show=!origShown.has(id);
    if(show)origShown.add(id); else origShown.delete(id);
    h2.textContent=show?(d.title||d.headline):d.headline;
    if(CFG.srcLang){if(show)h2.setAttribute("lang",CFG.srcLang);else h2.removeAttribute("lang");}
    af.classList.toggle("on",show);
    af.setAttribute("aria-pressed",String(show));
    const pill=af.querySelector(".aifpill"); if(pill)pill.innerHTML=aiflagLabel(show);
    h2.classList.toggle("orig",show);
    h2.classList.toggle("long",(h2.textContent||"").length>110);
    return;
  }
  if(e.target.closest(".closex")){collapseCard(e.target.closest(".card"));return;}
  const vb=e.target.closest(".btn[data-v]");
  if(vb)react(vb.dataset.v);
});
document.addEventListener("keydown",e=>{
  if(!$("#join").hidden)return;
  if($("#lobby")&&!$("#lobby").hidden)return;          // live session not started yet
  if($("#solo")&&!$("#solo").hidden)return;            // solo cover — the deck isn't dealt yet
  if($("#sheet").classList.contains("open")||$("#log").style.display==="block"||$("#partyView").style.display==="block"||$("#marksView").style.display==="block"||$("#importView").style.display==="block")return;
  const exp=$("#stack").querySelector(".card.expanded");
  if(exp){if(e.key==="Escape")collapseCard(exp);return;}
  if(e.key==="ArrowLeft"){e.preventDefault();react("against");}      // disagree
  else if(e.key==="ArrowRight"){e.preventDefault();react("for");}    // agree
  else if(e.key==="ArrowDown"){e.preventDefault();react("abstain");} // pass
});
$("#restart").addEventListener("click",()=>{
  for(const k in answers)delete answers[k];
  deck=buildDeck(); idx=0; voting=false;
  doneVis(false);
  renderStack();
  if(typeof publishSelf==="function")publishSelf();
});

/* ---- join: room onboarding (name or emoji, <30s). Single-player skips it. ---- */
/* identity is per-TAB (sessionStorage), like mpPid: a new browser session or
   window always re-prompts — the room never remembers who you were, which is
   the point of picking a face in private. The legacy localStorage copy is
   purged so identities saved by older versions die too. */
const ID_KEY="riot.identity.v1";
try{localStorage.removeItem(ID_KEY);}catch(e){}
let identity=null; try{identity=JSON.parse(sessionStorage.getItem(ID_KEY));}catch(e){}
const JOIN_EMOJI=["🦊","🦉","🐢","🐝","🦋","🐙","🌻","🌿","🍊","🌙","⚡","🔥","💧","⭐","🍀","🎈"];
/* The seat gate. One screen, one button — and the button is the JOIN: nothing
   about this tab exists for the room until it's tapped (multiplayer.js
   publishes presence only from the tap). live.js re-shows the gate for every
   new sitting; a face picked earlier in this tab comes preselected, so
   re-entry is one tap. */
function gateShow(live){
  const grid=$("#joinGrid");
  $("#joinLogo").src=(CITIES.find(c=>c.id===CFG.id)||CITIES[0]).logo;
  $("#joinKicker").textContent=`Live session · ${CFG.name}`;
  if(!grid.dataset.built){
    grid.dataset.built="1";
    grid.innerHTML=JOIN_EMOJI.map(e=>`<button type="button" data-e="${e}">${e}</button>`).join("");
    grid.addEventListener("click",e=>{
      const b=e.target.closest("[data-e]"); if(!b)return;
      grid.querySelectorAll(".sel").forEach(x=>x.classList.remove("sel"));
      b.classList.add("sel");
    });
    $("#joinGo").addEventListener("click",gateGo);
  }
  // preselect the face this tab already wears, else a random one — either way
  // a single tap on the CTA is enough
  grid.querySelectorAll(".sel").forEach(x=>x.classList.remove("sel"));
  let pre=identity&&identity.emoji ? [...grid.children].find(b=>b.dataset.e===identity.emoji) : null;
  if(!pre) pre=grid.children[Math.floor(Math.random()*grid.children.length)];
  if(pre)pre.classList.add("sel");
  // live sittings: the button label carries the seat metaphor in the city's
  // own language (CFG.lobby.cta — e.g. Reus "Ocupa el teu seient")
  $("#joinGo").textContent=live?((CFG.lobby&&CFG.lobby.cta)||"Take your seat"):"Enter the booth";
  $("#join").hidden=false;
}
function gateHide(){ $("#join").hidden=true; }
function gateGo(){
  const sel=$("#joinGrid").querySelector(".sel");
  identity={emoji:sel?sel.dataset.e:""};
  try{sessionStorage.setItem(ID_KEY,JSON.stringify(identity));}catch(e){}
  gateHide();
  updateMeBadge();
  // live sitting: the tap takes the seat (presence + counts start here)
  if(window.LIVE && typeof LIVE.seat==="function" && LIVE.seat()) return;
  if(typeof publishSelf==="function")publishSelf();   // sim room: strip only
}
function maybeShowJoin(){
  // boot-time gate: only the backendless sim room (?simroom) still gates here —
  // real rooms gate per-sitting from live.js, and a sitting may not exist yet
  if(window.LIVE_ROLE==="mod") return;       // the moderator runs the room, not a ballot
  if(identity && identity.emoji){ updateMeBadge(); return; }
  if(typeof simOn!=="undefined" && simOn) gateShow(false);
}
/* the room "account": your chosen face top-right, for your own eyes — the
   room meets you through the strip / lobby faces / reveal piles instead.
   Only called after the scripts have loaded (faceHTML lives in multiplayer.js). */
function updateMeBadge(){
  const el=$("#meBadge"); if(!el) return;
  const has=identity&&identity.emoji;
  el.hidden=!has;
  if(has){
    el.innerHTML=faceHTML(identity.emoji,"you",true);
    el.setAttribute("aria-label",`You joined as ${identity.emoji}`);
  }
}

/* ---- city selector (header logo → switch Reus / Brussels via ?city=) ---- */
(function setupCitySelector(){
  const logo=$("#cityLogo"),name=$("#cityName"),btn=$("#cityBtn"),menu=$("#cityMenu");
  if(!btn)return;
  // use the CITIES entry (lives in index.html) for the header logo so it can't desync from
  // the dropdown if a per-city config.js is stale in cache.
  const cityEntry=CITIES.find(c=>c.id===CFG.id);
  logo.src=(cityEntry&&cityEntry.logo)||CFG.logo||CITIES[0].logo;
  // Two masthead forms: the short name when §/⚙ + the switcher share the header
  // (single/async), the full institution name in live mode where the chrome is
  // stripped and the brand owns the row (CSS swaps them by body class).
  const nShort=CFG.masthead||CFG.name||"", nFull=CFG.masthead_full||nShort;
  const cnS=name.querySelector(".cn-s"), cnF=name.querySelector(".cn-f");
  if(cnS&&cnF){cnS.textContent=nShort; cnF.textContent=nFull;} else name.textContent=nShort;
  if(CFG.preview){const t=document.createElement("span");t.className="previewtag";t.textContent="preview";btn.after(t);}
  menu.innerHTML=CITIES.map(c=>`<button type="button" role="menuitem" data-city="${c.id}" class="${c.id===CFG.id?'active':''}">
    <img src="${c.logo}" alt="">${c.name}${c.id===CFG.id?'<span class="tick">✓</span>':''}</button>`).join("");
  const close=()=>{menu.classList.remove("open");btn.setAttribute("aria-expanded","false");};
  btn.addEventListener("click",e=>{e.stopPropagation();const o=menu.classList.toggle("open");btn.setAttribute("aria-expanded",o?"true":"false");});
  menu.addEventListener("click",e=>{const b=e.target.closest("[data-city]");if(!b)return;
    if(b.dataset.city===CFG.id){close();return;}
    const u=new URL(location.href); u.searchParams.set("city",b.dataset.city); location.href=u.toString();});
  document.addEventListener("click",e=>{if(!e.target.closest(".brand"))close();});
})();

/* ---- the solo cover (?solo=1) — the record's first page ----
   One screen between the URL and the booth: what this record IS, then one
   button deals the deck. Evergreen: every solo entrance opens here; the copy
   comes from CFG.solo_lobby (kicker / title / lore[] / meta / cta / note —
   all optional, {n} = deck length), and a city without one gets the plain
   cover (name + count). Historical instances put the process's story in
   lore — solo is the one entrance where the visitor came to READ. No room,
   no presence, nothing live: a static cover, never a pulsing chip. */
function soloEnter(){
  const sl=CFG.solo_lobby||{};
  const fill=s=>String(s).replace(/\{n\}/g,deck.length);
  document.body.classList.add("solo-cover");
  document.documentElement.classList.add("cover");   // the cover scrolls as THE PAGE (see style.css)
  $("#soloKicker").textContent=fill(sl.kicker||CFG.title||CFG.name||"");
  $("#soloTitle").textContent=fill(sl.title||CFG.name||"");
  const lore=$("#soloLore"), ps=Array.isArray(sl.lore)?sl.lore:[];
  lore.innerHTML=ps.map(p=>`<p>${esc(fill(p))}</p>`).join("");
  lore.hidden=!ps.length;
  // who sits here — parties carrying a `blurb` (identity in a few words, set
  // in the build scripts' party tables). Identity only, never direction: the
  // booth doctrine holds on the cover. No blurbs anywhere → no section.
  const who=PARTIES.filter(p=>!p.ghost&&p.blurb);
  const pwrap=$("#soloParties"); pwrap.hidden=!who.length;
  if(who.length){
    pwrap.innerHTML=`<p class="sl-plabel">${esc(sl.parties_label||"Who sits here")}</p>`+
      who.map(p=>`<div class="sl-prow">${logoEl(p)}<span class="sl-ptx"><b>${esc(p.name)}</b>${esc(p.blurb)}</span></div>`).join("");
  }
  // meta line above the CTA — fallback only when the key is absent; an
  // explicit "" hides it (a city can drop the docket line without the default).
  const meta=$("#soloMeta"), metaTxt=("meta" in sl)?sl.meta:"{n} decisions on the docket";
  meta.hidden=!metaTxt; if(metaTxt) meta.textContent=fill(metaTxt);
  $("#soloGo").textContent=sl.cta||"Enter the booth";
  const note=$("#soloNote"); note.hidden=!sl.note;
  if(sl.note) note.textContent=fill(sl.note);
  $("#soloGo").addEventListener("click",soloStart,{once:true});
  $("#solo").hidden=false;
}
function soloStart(){
  $("#solo").classList.add("away");                 // the cover falls away…
  setTimeout(()=>{
    $("#solo").hidden=true;
    document.body.classList.remove("solo-cover");   // …and the booth is dealt
    document.documentElement.classList.remove("cover");  // restore the booth's page lock
    window.scrollTo(0,0);
    renderStack();
  },380);
}
