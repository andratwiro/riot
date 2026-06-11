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
  {id:"congress",name:"Congress",logo:"assets/logos/us_capitol.svg"}
];
const CFG=window.CITY_CONFIG||{id:"reus",name:"Reus",title:"REUS",lang:"ca",logo:"assets/logos/reus_rose_color.svg"};
document.title=CFG.title||"RIOT";
document.documentElement.lang=CFG.lang||"en";
const R = window.RIOT || {decisions:[], parties:[]};
// AI proxy's blind votes (id -> {vote,confidence,rationale}); null until ai_vote.py / the proxy run has produced them.
const AI = (window.AI_VOTES && window.AI_VOTES.votes) || null;
const PARTIES = R.parties || [];
const QS = new URLSearchParams(location.search);
/* ?solo=1 — the deliberate solo entrance: the booth alone, full deck, no room,
   no live resolution, no presence (the plain voter URL stays the sitting's
   entrance and nothing else). Built for the self-experiment: vote at your own
   pace, ⧉ Copy votes to save, import to resume. &ai=1 seats Proxy IA on the
   reveal (solo only — in a sitting, AI mode belongs to the moderator's cfg). */
const SOLO = QS.get("solo")==="1";
// Add/remove the proxy as one more "party" (reveal map + compare view). Off by default; menu toggle.
function applyAiParty(on){
  if(AI){
    const has=PARTIES.some(p=>p.token==="IA");
    if(on && !has){
      PARTIES.push({token:"IA",name:"Proxy IA",color:"#d1684e",logo:null,her:true});
      for(const d of R.decisions){const rec=AI[d.id]; if(rec){(d.party_votes_canon=d.party_votes_canon||{})["IA"]=rec.vote;}}
    } else if(!on && has){
      const i=PARTIES.findIndex(p=>p.token==="IA"); if(i>=0) PARTIES.splice(i,1);
      for(const d of R.decisions){ if(d.party_votes_canon) delete d.party_votes_canon["IA"]; }
    }
  }
  rebuildMap();      // PARTIES changed → recompute the reveal-map coordinates
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
// AI mode: the moderator enables it per live session (cfg.ai); live.js flips it
// from snapshots. Solo is the one self-serve entrance: ?solo=1&ai=1.
let showAI=SOLO && !!AI && QS.get("ai")==="1";
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
  if(p.her) return `<span class="lg her"></span>`;
  return p.logo ? `<span class="lg bg-${p.token}"><img src="${p.logo}" alt="${p.name}"></span>`
                : `<span class="lg fb" style="background:${p.color}">${p.token}</span>`;
}
let iaHero=null;   // "Her" WebGL instance in the party-compare header (views.js)

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
    // The headline is an AI-reworded version of the proposal; the ✨ flag toggles back to
    // the original wording (d.title — the source's own name/text) per card.
    const showOrig = origShown.has(d.id);
    const headTxt = showOrig ? (d.title||d.headline) : d.headline;
    const head = esc(headTxt);
    // .orig = verbatim source wording → mono "minutes" face, capped height
    const h2cls = [showOrig?"orig":"", (headTxt||"").length>110?"long":""].filter(Boolean).join(" ");
    const long = h2cls ? ` class="${h2cls}"` : "";
    const main = d.source_brief ? renderBrief(d.source_brief)
               : `<div class="body">${esc(d.human_body||"")}</div>`;
    const dfacts = d.deep_facts || d.deep;   // neutral, cited (what the AI proxy reads)
    const deep = dfacts
      ? `<button class="deepmore" type="button">Full analysis ▾</button>`+
        `<div class="deep" hidden>${renderBrief(dfacts)}`+
        (d.deep_lectura?`<div class="lectura">${renderBrief(d.deep_lectura)}</div>`:"")+
        `</div>`
      : "";
    const body = main+deep;
    const acts = depth===0
      ? `<div class="acts">
          <button class="btn a" data-v="against">Against</button>
          <button class="btn ab" data-v="abstain">Abstain</button>
          <button class="btn f" data-v="for">For</button>
        </div>`
      : "";
    const hasOrig = depth===0 && d.title && d.title!==d.headline;
    const aiflag = hasOrig
      ? `<button class="aiflag${showOrig?' on':''}" type="button" data-id="${esc(d.id)}" aria-pressed="${showOrig?'true':'false'}"><span class="aifpill">${aiflagLabel(showOrig)}</span></button>`
      : "";
    const showSug = depth===0 && devMode && d.auto_suggest && !isMarked(d.id) && !isDismissed(d.id);
    const suggest = showSug
      ? `<div class="suggest"><span class="stxt">🤖 Suggested: not worth voting</span>`+
        `<button class="sugOk" type="button">Confirm</button>`+
        `<button class="sugNo" type="button">Dismiss</button></div>`
      : "";
    el.innerHTML=`<button class="closex" type="button" aria-label="Close">✕</button>
      ${aiflag}
      ${suggest}
      <span class="topic">${topic}</span>
      <h2${long}${showOrig&&CFG.srcLang?` lang="${esc(CFG.srcLang)}"`:""} title="${esc(d.title||"")}">${head}</h2>
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
  if(top && tally){
    const acts=top.querySelector(".acts");
    setTimeout(()=>{
      if(!voting)return;
      if(acts){acts.classList.remove("acts");acts.classList.add("split");renderSplitInto(acts,d.id,vote);}
      splitUpdate=()=>{if(voting&&acts)renderSplitInto(acts,d.id,vote);};
      top.addEventListener("click",proceed,{once:true});
      setTimeout(proceed,2000);              // one beat, then next card
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
  decorateHer(ex,44);
}
function renderDoneParties(ranked,a){
  const el=$("#doneParties");
  if(!ranked.length){el.innerHTML="";el.style.display="none";return;}
  el.style.display="";
  el.innerHTML=`<span class="dplabel">Every party · tap to compare your votes</span>`+
    ranked.map(p=>{const pct=a[p.token].pct;
      return `<button class="dprow" type="button" data-token="${p.token}" title="See where you and ${esc(p.name)} differ">${logoEl(p)}
        <span class="dptx"><span class="dpname">${esc(p.name)}</span>
          <span class="dptrack"><span class="dpfill" style="width:${pct||0}%;background:${p.color}"></span></span></span>
        <span class="dppct">${pct==null?'—':pct+'%'}</span><span class="dpgo">›</span></button>`;
    }).join("");
  decorateHer(el,34);
}
// mount the "Her" mark on any IA logo slots inside a container (reveal screen)
function decorateHer(container,size){
  if(AI&&window.HerOS1&&HerOS1.supported){
    container.querySelectorAll('.lg.her').forEach(slot=>{
      const m=HerOS1.mount(null,{size}); slot.appendChild(m.canvas);
    });
  }
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
function finish(){
  $("#stack").innerHTML="";
  $("#progressRow").style.display="none";
  voting=false; splitUpdate=null;
  const a=affinity();
  const ranked=PARTIES.filter(p=>a[p.token].comp).sort((x,y)=>a[y.token].pct-a[x.token].pct);
  revealCopy(ranked,a);
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
    $("#joinName").addEventListener("keydown",e=>{if(e.key==="Enter")gateGo();});
  }
  // preselect the face this tab already wears, else a random one — either way
  // a single tap on the CTA is enough
  grid.querySelectorAll(".sel").forEach(x=>x.classList.remove("sel"));
  let pre=identity&&identity.emoji ? [...grid.children].find(b=>b.dataset.e===identity.emoji) : null;
  if(!pre) pre=grid.children[Math.floor(Math.random()*grid.children.length)];
  if(pre)pre.classList.add("sel");
  if(identity&&identity.name) $("#joinName").value=identity.name;
  $("#joinGo").textContent=live?"Take your seat":"Enter the booth";
  $("#join").hidden=false;
}
function gateHide(){ $("#join").hidden=true; }
function gateGo(){
  const sel=$("#joinGrid").querySelector(".sel");
  identity={emoji:sel?sel.dataset.e:"", name:($("#joinName").value||"").trim().slice(0,14)};
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
  if(identity && (identity.emoji||identity.name)){ updateMeBadge(); return; }
  if(typeof simOn!=="undefined" && simOn) gateShow(false);
}
/* the room "account": your chosen face top-right, for your own eyes — the
   room meets you through the strip / lobby faces / reveal piles instead.
   Only called after the scripts have loaded (faceHTML lives in multiplayer.js). */
function updateMeBadge(){
  const el=$("#meBadge"); if(!el) return;
  const has=identity&&(identity.emoji||identity.name);
  el.hidden=!has;
  if(has){
    el.innerHTML=faceHTML(identity.emoji,identity.name||"you",true);
    el.setAttribute("aria-label",`You joined as ${identity.emoji||identity.name}`);
  }
}

/* ---- city selector (header logo → switch Reus / Brussels via ?city=) ---- */
(function setupCitySelector(){
  const logo=$("#cityLogo"),name=$("#cityName"),btn=$("#cityBtn"),menu=$("#cityMenu");
  if(!btn)return;
  // use the CITIES entry (lives in index.html) for the header logo so it can't desync from
  // the dropdown if a per-city config.js is stale in cache.
  const cityEntry=CITIES.find(c=>c.id===CFG.id);
  logo.src=(cityEntry&&cityEntry.logo)||CFG.logo||CITIES[0].logo; name.textContent=CFG.name||"";
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
