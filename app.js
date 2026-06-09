/* RIOT viewer — core app: city config, state, affinity, card stack, done screen.
   Load order matters (plain scripts sharing top-level globals):
   app.js → map.js → views.js → multiplayer.js → inline boot in index.html. */
// Known cities for the header selector (adding one also needs a cities/<id>/ bundle).
const CITIES=[
  {id:"reus",name:"Reus",logo:"assets/logos/reus_rose_color.svg"},
  {id:"brussels",name:"Brussels",logo:"assets/logos/brussels_iris.svg"}
];
const CFG=window.CITY_CONFIG||{id:"reus",name:"Reus",title:"REUS",lang:"ca",logo:"assets/logos/reus_rose_color.svg",mapGate:5};
document.title=CFG.title||"RIOT";
document.documentElement.lang=CFG.lang||"en";
const R = window.RIOT || {decisions:[], parties:[]};
// AI proxy's blind votes (id -> {vote,confidence,rationale}); null until ai_vote.py / the proxy run has produced them.
const AI = (window.AI_VOTES && window.AI_VOTES.votes) || null;
const PARTIES = R.parties || [];
// Add/remove the proxy as one more "party" (affinity bar, opinion map, compare view). Off by default; menu toggle.
function applyAiParty(on){
  if(AI){
    const has=PARTIES.some(p=>p.token==="IA");
    if(on && !has){
      PARTIES.push({token:"IA",name:"Proxy IA",color:"#d1684e",logo:null,her:true});
      for(const d of R.decisions){const rec=AI[d.id]; if(rec){(d.party_votes_canon=d.party_votes_canon||{})["IA"]=rec.vote;}}
    } else if(!on && has){
      const i=PARTIES.findIndex(p=>p.token==="IA"); if(i>=0) PARTIES.splice(i,1);
      for(const d of R.decisions){ if(d.party_votes_canon) delete d.party_votes_canon["IA"]; }
      if(iaMark){iaMark.dispose();iaMark=null;}
    }
  }
  rebuildMap();      // PARTIES changed → recompute the opinion-map coordinates
  renderAffinity();
}
const $ = s => document.querySelector(s);
const VLAB = {for:"for", against:"against", abstain:"abstain", split:"split", absent:"absent"};
const byId = Object.fromEntries(R.decisions.map(d=>[d.id,d]));

let deck = shuffle(R.decisions.filter(d => d.headline && !d.curator_drop));
let idx = 0;
const origShown = new Set();   // card ids currently showing the original (un-reworded) title
// Opinion map unlocks after MAP_GATE votes: locked (countdown) → auto-reveals at the gate → user toggles.
let mapOpen=false, mapRevealed=false;
const answers = {};
/* curator marks + dev mode — persist across sessions in localStorage */
const MARK_KEY="riot.marks.v1", DEV_KEY="riot.dev.v1", DISMISS_KEY="riot.dismissed.v1";
function loadMarks(){try{return JSON.parse(localStorage.getItem(MARK_KEY))||[];}catch(e){return [];}}
function saveMarks(){try{localStorage.setItem(MARK_KEY,JSON.stringify(marks));}catch(e){}}
let marks=loadMarks();
// auto-suggest dismissals — curator said "no, this one IS worth voting"; stops the chip nagging
function loadDismissed(){try{return JSON.parse(localStorage.getItem(DISMISS_KEY))||[];}catch(e){return [];}}
let dismissed=loadDismissed();
const isDismissed=id=>dismissed.includes(id);
function dismissSuggest(id){if(!isDismissed(id)){dismissed.push(id);try{localStorage.setItem(DISMISS_KEY,JSON.stringify(dismissed));}catch(e){}}}
let devMode=false; try{devMode=localStorage.getItem(DEV_KEY)==="1";}catch(e){}
// show the AI proxy as a party (off by default) — persists across sessions
const AI_KEY="riot.ai.v1";
let showAI=false; try{showAI=localStorage.getItem(AI_KEY)==="1";}catch(e){}
const isMarked=id=>marks.some(m=>m.id===id);
const MAP_GATE = CFG.mapGate || 5;   // votes required before the user is placed on the map (per-city)
let COORD = null, MX = {}, mapBuilt = false;

function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function esc(s){return (s||"").replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));}

function affinity(){
  const res={};
  for(const p of PARTIES){
    let comp=0,match=0;
    for(const id in answers){
      const pv=(byId[id].party_votes_canon||{})[p.token];
      if(pv==="for"||pv==="against"||pv==="abstain"){comp++; if(pv===answers[id])match++;}
    }
    res[p.token]=comp?{pct:Math.round(100*match/comp),comp}:{pct:null,comp:0};
  }
  return res;
}
function logoEl(p){
  if(p.her) return `<span class="lg her"></span>`;
  return p.logo ? `<span class="lg bg-${p.token}"><img src="${p.logo}" alt="${p.name}"></span>`
                : `<span class="lg fb" style="background:${p.color}">${p.token}</span>`;
}
// the "Her" OS1 mark for the IA proxy — one persistent WebGL instance, re-homed after each re-render
let iaMark=null, iaHero=null;
function decorateIaMark(){
  if(!AI) return;
  const slot=document.querySelector('#affinity .lg.her');
  if(!slot) return;
  if(!window.HerOS1||!HerOS1.supported){ slot.classList.add('fallback'); return; }
  if(!iaMark) iaMark=HerOS1.mount(null,{size:48});
  if(iaMark.canvas.parentNode!==slot) slot.appendChild(iaMark.canvas);
}
function renderAffinity(){
  const a=affinity();
  const order=PARTIES.slice().sort((x,y)=>{
    const px=a[x.token].pct,py=a[y.token].pct;
    if(px===null&&py===null)return 0; if(px===null)return 1; if(py===null)return -1; return py-px;
  });
  $("#affinity").innerHTML=order.map(p=>{
    const r=a[p.token],pct=r.pct;
    const ai=p.token==="IA";
    return `<div class="pa ${r.comp?'':'muted'}" data-token="${p.token}" title="${esc(p.name)} · tap to see where ${ai?"it matches you":"you differ"}">${logoEl(p)}
      <div class="track"><div class="fill" style="width:${pct||0}%;background:${p.color}"></div></div>
    </div>`;
  }).join("");
  decorateIaMark();
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
  $("#progress").textContent=`${idx+1} of ${deck.length}`;
  stack.innerHTML="";
  for(let k=Math.min(idx+2,deck.length-1);k>=idx;k--){
    const d=deck[k],depth=k-idx;
    const el=document.createElement("div");
    el.className="card"+(depth===1?" behind1":depth===2?" behind2":"");
    const topic = esc(d.topic||"Decision");
    // The headline is an AI-reworded version of the proposal; the ✨ flag toggles back to
    // the original wording (d.title — the source's own name/text) per card.
    const showOrig = origShown.has(d.id);
    const head = showOrig ? esc(d.title||d.headline) : esc(d.headline);
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
    // ✨ AI-reword flag (front card only, when there's a distinct original to reveal)
    const hasOrig = depth===0 && d.title && d.title!==d.headline;
    const aiflag = hasOrig
      ? `<button class="aiflag${showOrig?' off':''}" type="button" data-id="${esc(d.id)}" title="${showOrig?'Showing the original wording — tap to restore the AI-reworded title':'AI-reworded for clarity — tap to read the original proposal wording'}">✨</button>`
      : "";
    // auto-discretion suggestion (curator only): proposed-drop the curator hasn't confirmed/dismissed
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
      <h2 title="${esc(d.title||"")}">${head}</h2>
      <button class="more" type="button">See more ▾</button>
      <div class="reveal" hidden>${body}</div>
      ${acts}`;
    stack.appendChild(el);
  }
  updateDevBar();
}
function react(vote){
  if(idx>=deck.length)return;
  answers[deck[idx].id]=vote;
  const top=$("#stack").lastChild;
  if(top)top.classList.add(vote==="for"?"gone-r":vote==="against"?"gone-l":"gone-d");
  renderAffinity();
  applyMapVisibility();   // updates the unlock countdown / auto-reveals at the gate
  publishSelf();          // share my new map position with the room (no-op if single-player)
  setTimeout(()=>{idx++;renderStack();},230);
}
// most / least affine party cards
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
    ? card("most","Most aligned",most)
    : card("most","Most aligned",most)+card("least","Least aligned",least);
  decorateHer(ex,44);
}
// ranked, clickable list of ALL parties (replaces the top affinity bar on the done screen)
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
// mount the "Her" mark on any IA logo slots inside a container (done screen)
function decorateHer(container,size){
  if(AI&&window.HerOS1&&HerOS1.supported){
    container.querySelectorAll('.lg.her').forEach(slot=>{
      const m=HerOS1.mount(null,{size}); slot.appendChild(m.canvas);
    });
  }
}
function finish(){
  $("#stack").innerHTML=""; $("#progress").textContent="";
  const a=affinity();
  const ranked=PARTIES.filter(p=>a[p.token].comp).sort((x,y)=>a[y.token].pct-a[x.token].pct);
  $("#doneSub").textContent=`You reacted to ${Object.keys(answers).length} decisions.`;
  renderResultMap();
  renderExtremes(ranked,a);
  renderDoneParties(ranked,a);
  $("#mapPanel").style.display="none";   // the done screen has its own (big) map
  $("#affinity").style.display="none";   // parties move into the clickable list below
  $("#done").style.display="flex";
  updateDevBar();
}

function collapseCard(card){
  card.classList.remove("expanded");
  card.style.minHeight="";
  card.style.height="";
  card.querySelector(".reveal").setAttribute("hidden","");
}
$("#stack").addEventListener("click",e=>{
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
    setTimeout(()=>{idx++;renderStack();},230); return;
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
    if(origShown.has(id)){origShown.delete(id); h2.textContent=d.headline; af.classList.remove("off");
      af.title="AI-reworded for clarity — tap to read the original proposal wording";}
    else{origShown.add(id); h2.textContent=d.title||d.headline; af.classList.add("off");
      af.title="Showing the original wording — tap to restore the AI-reworded title";}
    return;
  }
  if(e.target.closest(".closex")){collapseCard(e.target.closest(".card"));return;}
  const vb=e.target.closest(".btn[data-v]");
  if(vb)react(vb.dataset.v);
});
document.addEventListener("keydown",e=>{
  if($("#sheet").classList.contains("open")||$("#log").style.display==="block"||$("#partyView").style.display==="block"||$("#marksView").style.display==="block"||$("#importView").style.display==="block")return;
  const exp=$("#stack").querySelector(".card.expanded");
  if(exp){if(e.key==="Escape")collapseCard(exp);return;}
  if(e.key==="ArrowLeft"){e.preventDefault();react("against");}      // disagree
  else if(e.key==="ArrowRight"){e.preventDefault();react("for");}    // agree
  else if(e.key==="ArrowDown"){e.preventDefault();react("abstain");} // pass
});
$("#restart").addEventListener("click",()=>{
  deck=shuffle(R.decisions.filter(d=>d.headline && !d.curator_drop)); idx=0;
  for(const k in answers)delete answers[k];
  mapOpen=false; mapRevealed=false;     // re-lock the map for the new run
  $("#done").style.display="none";
  $("#affinity").style.display="";      // bring the parties bar back for the new run
  renderAffinity(); renderStack(); applyMapVisibility();
});
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
