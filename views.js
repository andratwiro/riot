/* RIOT viewer — secondary views: raw-data log, party comparison, curator mode
   (marks/suggestions), votes export/import, options sheet. Loads after map.js. */
function buildLog(){
  // "source table" ≠ "deck": the table holds every extracted decision (incl.
  // curator-dropped ones); the deck is what's votable. Label it to match.
  $("#logCount").textContent=`· ${R.decisions.length} in the source table · ${(R.sessions_in_table||[]).length} sessions`;
  const rows=R.decisions.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  $("#logList").innerHTML=rows.map(d=>{
    const out=d.votes_pending?'<span class="badge b-pend">VOTES PENDING</span>':d.outcome==="rejected"?'<span class="badge b-rej">REJECTED</span>':'<span class="badge b-app">APPROVED</span>';
    const chips=d.votes_pending?'<span class="pchip">minutes not yet published</span>':Object.entries(d.party_votes_canon||{}).map(([k,v])=>`<span class="pchip"><span class="dot d-${v}"></span>${k} ${VLAB[v]||v}</span>`).join("");
    return `<div class="lcard">
      <div class="lt">${esc(d.title||d.headline)}</div>
      <div class="lm"><span>${d.date||""}</span><span>${d.session_code} · item ${d.point??"?"}</span><span>${esc(d.organ||d.type||"")}</span>${out}</div>
      <div class="lvotes">${chips}</div>
      <details><summary>verbatim minutes text + source</summary>
        <div class="lraw">${esc(d.raw_outcome||"—")}</div>
        ${d.acta_url?`<div style="margin-top:7px"><a class="src" href="${d.acta_url}" target="_blank" rel="noopener">↗ open the minutes (PDF)</a></div>`:""}
      </details></div>`;
  }).join("");
}
function openParty(token){
  const p=PARTIES.find(x=>x.token===token); if(!p)return;
  const isAI=token==="IA";
  const rows=[];
  for(const id in answers){
    const d=byId[id]; if(!d)continue;
    const pv=(d.party_votes_canon||{})[token];
    const comparable=(pv==="for"||pv==="against"||pv==="abstain");
    rows.push({d,pv,uv:answers[id],comparable,agree:comparable&&pv===answers[id],rationale:isAI&&AI&&AI[id]?AI[id].rationale:null,conf:isAI&&AI&&AI[id]?AI[id].confidence:null});
  }
  // rank: discrepancies first, then party didn't vote comparably, then agreements
  const rankOf=r=> r.comparable ? (r.agree?2:0) : 1;
  rows.sort((a,b)=>rankOf(a)-rankOf(b));
  const comp=rows.filter(r=>r.comparable), matches=comp.filter(r=>r.agree).length;
  const pct=comp.length?Math.round(100*matches/comp.length):null, disagrees=comp.length-matches;
  const accord=isAI?"accuracy":"agreement";

  const headMark=isAI?`<span class="herHero" id="herHero"></span>`:logoEl(p);
  $("#pvHead").innerHTML=`${headMark}<div><b>${esc(p.name)}</b> <span class="pvpct">${
    pct===null?"no comparison yet":pct+"% "+accord+" · "+disagrees+(disagrees===1?" disagreement":" disagreements")}</span></div>`;
  if(iaHero){iaHero.dispose();iaHero=null;}
  if(isAI){const hero=document.getElementById("herHero");
    if(hero){ if(window.HerOS1&&HerOS1.supported) iaHero=HerOS1.mount(hero,{size:60}); else hero.classList.add("fallback"); }}
  $("#pvIntro").textContent=rows.length
    ? (isAI
        ? `Blind prediction: the proxy voted only from your profile and the neutral context of each decision — never seeing your votes, the parties' votes or the outcome. The ${rows.length} you voted, where it misses first.`
        : `The ${rows.length} decisions you voted, compared with ${p.name}. Where you differ first.`)
    : "You haven't reacted to any decision yet.";
  $("#pvList").innerHTML=rows.map(r=>{
    const badge=!r.comparable?`<span class="badge b-na">${VLAB[r.pv]||"no vote"}</span>`
      :r.agree?`<span class="badge b-agree">${isAI?"MATCH":"AGREE"}</span>`:`<span class="badge b-disagree">${isAI?"MISS":"DIFFER"}</span>`;
    const conf=isAI&&r.conf!=null?` · ${Math.round(r.conf*100)}%`:"";
    const pchip=`<span class="pchip"><span class="dot d-${r.pv||"absent"}"></span>${p.token} ${VLAB[r.pv]||"no vote"}${conf}</span>`;
    const uchip=`<span class="pchip you"><span class="dot d-${r.uv}"></span>You ${VLAB[r.uv]||r.uv}</span>`;
    const why=r.rationale?`<div class="lm" style="margin-top:6px;font-style:italic">«${esc(r.rationale)}»</div>`:"";
    return `<div class="lcard">
      <div class="lt">${esc(r.d.headline||r.d.title)}</div>
      <div class="pvrow">${pchip}${uchip}${badge}</div>${why}
    </div>`;
  }).join("");
  $("#partyView").style.display="block";
}
// reveal screen: the ranked party list + the closest/furthest cards open the same comparison view
$("#doneParties").addEventListener("click",e=>{const b=e.target.closest(".dprow");if(b)openParty(b.dataset.token);});
$("#extremes").addEventListener("click",e=>{const b=e.target.closest(".exc");if(b)openParty(b.dataset.token);});
function closePartyView(){$("#partyView").style.display="none"; if(iaHero){iaHero.dispose();iaHero=null;}}
$("#closeParty").addEventListener("click",closePartyView);

/* ---- curator mode ---- */
function setDevMode(on){
  devMode=on;
  try{localStorage.setItem(DEV_KEY,on?"1":"0");}catch(e){}
  document.body.classList.toggle("dev",on);
  updateDevBar();
}
function updateDevBar(){
  if(!devMode)return;
  const d=(idx<deck.length)?deck[idx]:null, btn=$("#markBtn");
  if(d){const on=isMarked(d.id);
    btn.disabled=false; btn.classList.toggle("on",on);
    btn.textContent=on?"✓ Flagged — tap to remove":"🚩 Not worth voting";
  }else{btn.disabled=true; btn.classList.remove("on"); btn.textContent="🚩 Not worth voting";}
  $("#markReview").textContent=`${marks.length} flagged`;
}
function toggleMark(d){
  const i=marks.findIndex(m=>m.id===d.id);
  if(i>=0)marks.splice(i,1);
  else marks.push({id:d.id,headline:d.headline||d.title||"",title:d.title||"",
    date:d.date||"",session_code:d.session_code||"",point:d.point??null});
  saveMarks(); updateDevBar();
}
$("#markBtn").addEventListener("click",()=>{
  if(idx>=deck.length)return;
  const d=deck[idx], wasMarked=isMarked(d.id);
  toggleMark(d);
  if(!wasMarked){ // mark + advance (does not count as a vote)
    const top=$("#stack").lastChild;
    if(top)top.classList.add("gone-d");
    setTimeout(()=>{idx++;renderStack();},230);
  }
});
function openMarks(){
  $("#marksCount").textContent=`· ${marks.length}`;
  $("#marksList").innerHTML=marks.length?marks.map(m=>`<div class="lcard">
    <div class="lt">${esc(m.headline||m.title||m.id)}</div>
    <div class="lm"><span>${m.date||""}</span><span>${esc(m.session_code||"")}${m.point!=null?" · item "+m.point:""}</span></div>
    <div class="pvrow"><button class="markreview" type="button" data-unmark="${m.id}">✕ Remove flag</button></div>
  </div>`).join(""):`<p class="muted">You haven't flagged any decisions yet.</p>`;
  $("#marksView").style.display="block";
}
$("#markReview").addEventListener("click",openMarks);
$("#closeMarks").addEventListener("click",()=>$("#marksView").style.display="none");
$("#copyMarks").addEventListener("click",()=>{
  const txt=JSON.stringify(dismissed.length?{marks,dismissed}:marks,null,2);
  if(navigator.clipboard)navigator.clipboard.writeText(txt).then(()=>{$("#copyMarks").textContent="✓ Copied";setTimeout(()=>$("#copyMarks").textContent="⧉ Copy JSON",1500);});
});
$("#marksList").addEventListener("click",e=>{
  const b=e.target.closest("[data-unmark]"); if(!b)return;
  const i=marks.findIndex(m=>m.id===b.dataset.unmark);
  if(i>=0){marks.splice(i,1);saveMarks();openMarks();updateDevBar();}
});
const devToggleEl=$("#devToggle"); if(devToggleEl)devToggleEl.addEventListener("change",e=>setDevMode(e.target.checked));

/* ---- export / import votes (simplified id->vote map; demo + AI comparison) ---- */
function votesJSON(){
  return JSON.stringify({v:1,exported:new Date().toISOString(),n:Object.keys(answers).length,votes:{...answers}},null,2);
}
$("#copyVotes").addEventListener("click",()=>{
  const txt=votesJSON();
  if(navigator.clipboard)navigator.clipboard.writeText(txt).then(()=>{
    $("#copyVotes").textContent="✓ Copied";setTimeout(()=>$("#copyVotes").textContent="⧉ Copy votes",1500);
  });
});
// Replace the live session with an imported set of votes, then re-render (lands on the
// next unvoted card, or the results screen if every imported decision is covered).
function applyImportedVotes(map){
  for(const k in answers)delete answers[k];
  let applied=0;
  for(const id in map){
    const v=map[id];
    if(byId[id]&&(v==="for"||v==="against"||v==="abstain")){answers[id]=v;applied++;}
  }
  deck=buildDeck(true);   // continue with the unanswered remainder of the same deck mode
  idx=0;
  $("#done").style.display="none";
  renderStack();
  if(typeof publishSelf==="function")publishSelf();
  return applied;
}
$("#importVotes").addEventListener("click",()=>{closeSheet();const st=$("#importStatus");st.textContent="";st.className="";$("#importView").style.display="block";$("#importBox").focus();});
$("#closeImport").addEventListener("click",()=>$("#importView").style.display="none");
$("#loadVotes").addEventListener("click",()=>{
  const st=$("#importStatus");st.className="";
  const raw=$("#importBox").value.trim();
  if(!raw){st.className="err";st.textContent="Paste a JSON first.";return;}
  let data; try{data=JSON.parse(raw);}catch(e){st.className="err";st.textContent="Invalid JSON: "+e.message;return;}
  const map=(data&&typeof data==="object"&&data.votes&&typeof data.votes==="object")?data.votes:data;
  if(!map||typeof map!=="object"||Array.isArray(map)){st.className="err";st.textContent="No votes found.";return;}
  const applied=applyImportedVotes(map);
  if(!applied){st.className="err";st.textContent="No valid votes (unknown ids?).";return;}
  st.className="ok";st.textContent=`✓ ${applied} votes loaded.`;
  setTimeout(()=>$("#importView").style.display="none",700);
});

function openSheet(){$("#sheet").classList.add("open");$("#sheet").setAttribute("aria-hidden","false");}
function closeSheet(){$("#sheet").classList.remove("open");$("#sheet").setAttribute("aria-hidden","true");}
function openLog(){if(!$("#logList").innerHTML)buildLog(); $("#log").style.display="block";}

$("#menuBtn").addEventListener("click",openSheet);
$("#sheetBack").addEventListener("click",closeSheet);
$("#openLog").addEventListener("click",()=>{closeSheet();openLog();});
$("#quickLog").addEventListener("click",openLog);   // the credibility answer, one tap from the booth
$("#closeLog").addEventListener("click",()=>$("#log").style.display="none");
$("#aiToggle").addEventListener("change",e=>{showAI=e.target.checked;try{localStorage.setItem(AI_KEY,showAI?"1":"0");}catch(err){}applyAiParty(showAI);});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeSheet();$("#log").style.display="none";closePartyView();$("#marksView").style.display="none";$("#importView").style.display="none";}});
