/* RIOT viewer — multiplayer (optional, Firebase Realtime DB): presence, peer dots
   on the maps, room-wide reset. Degrades to single-player when FIREBASE_CONFIG is
   null or the SDK fails to load. Loads last; boot (index.html) calls mpInit(). */
// PEERS: other participants in this room (pid -> {color, c:[left%,top%]|null}). Their map
// dots are intentionally subordinate to the parties and your own YOU dot. Degrades to a
// no-op single-player app if firebase-config.js leaves FIREBASE_CONFIG null or the SDK
// fails to load. Positions are published as screen-% (same toPct frame), which lines up
// across clients as long as everyone is on the same data + default settings.
const PEERS = {};
let mpSelf=null, mpCtrl=null, mpPart=null, mpPid=null, mpColor=null, mpSeenReset=null;
function mpHue(seed){let h=2166136261;for(const ch of seed){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0)%360;}
function renderPeersInto(el){
  if(!el) return;
  el.querySelectorAll(".peer").forEach(n=>n.remove());
  for(const pid in PEERS){
    const p=PEERS[pid]; if(!p.c) continue;
    const d=document.createElement("div");
    d.className="peer"; d.style.left=p.c[0]+"%"; d.style.top=p.c[1]+"%";
    d.style.background=p.color||"#9aa1ad";
    el.appendChild(d);
  }
}
function renderPeers(){
  renderPeersInto(document.getElementById("map"));
  const rm=document.getElementById("resultMap"); if(rm && rm.innerHTML) renderPeersInto(rm);
}
function publishSelf(){
  if(!mpSelf) return;
  const uc=(COORD && Object.keys(answers).length>=MAP_GATE)?userCoord():null;
  mpSelf.set({color:mpColor, c:uc?toPct(uc):null, n:Object.keys(answers).length,
              ts:firebase.database.ServerValue.TIMESTAMP});
}
function localReset(){            // wipe my own session (mirrors "Start over") — used when the room resets
  for(const k in answers) delete answers[k];
  deck=shuffle(R.decisions.filter(d=>d.headline && !d.curator_drop)); idx=0;
  mapOpen=false; mapRevealed=false;
  $("#done").style.display="none";
  renderAffinity(); renderStack(); applyMapVisibility(); publishSelf();
}
function resetEveryone(){
  if(!mpCtrl) return;
  mpCtrl.child("resetAt").set(firebase.database.ServerValue.TIMESTAMP);  // signal all clients
  mpPart.remove();                                                       // clear everyone's dots
}
function mpInit(){
  if(!window.FIREBASE_CONFIG || !window.firebase){ return; }   // single-player
  try{
    firebase.initializeApp(window.FIREBASE_CONFIG);
    const db=firebase.database(), room=CFG.id;
    // per-TAB identity (sessionStorage): each window is a distinct participant, and it
    // survives a refresh within that tab. (localStorage would make every window of the
    // same browser collapse into one participant.)
    try{mpPid=sessionStorage.getItem("riot.pid.v1");}catch(e){}
    if(!mpPid){mpPid="p"+Math.random().toString(36).slice(2,9);try{sessionStorage.setItem("riot.pid.v1",mpPid);}catch(e){}}
    mpColor=`hsl(${mpHue(mpPid)} 70% 62%)`;
    mpPart=db.ref(`rooms/${room}/participants`);
    mpCtrl=db.ref(`rooms/${room}/control`);
    mpSelf=mpPart.child(mpPid);
    mpSelf.onDisconnect().remove();
    publishSelf();
    mpPart.on("value",snap=>{
      const all=snap.val()||{}; let n=0;
      for(const k in PEERS) delete PEERS[k];
      for(const k in all){ n++; if(k!==mpPid) PEERS[k]={color:all[k].color, c:all[k].c||null}; }
      const pe=$("#presence"); if(pe){pe.hidden=false; $("#presenceN").textContent=n||1;}
      renderPeers();
    });
    mpCtrl.child("resetAt").on("value",snap=>{          // someone hit "reset everyone"
      const t=snap.val()||0;
      if(mpSeenReset!=null && t>mpSeenReset) localReset();
      mpSeenReset=t;
    });
    const rb=$("#resetRoom"); if(rb) rb.hidden=false;
  }catch(e){ console.warn("multiplayer off:",e&&e.message); }
}
$("#resetRoom").addEventListener("click",()=>{
  if(!mpCtrl) return;
  if(confirm("Reset votes for EVERYONE in this room? This clears all participants' progress and dots.")) resetEveryone();
});
