/* RIOT viewer — the affinity map (reveal-only): everyone who voted — the
   parties, YOU, and every ballot this device knows — are rows of ONE matrix
   over the deck's decisions, flattened to 2D. The map never appears in the
   voting flow — it is the payoff of the reveal, animated into place dot by dot.

   Projections of that one matrix (chips under the map):
     · Room      — Polis-style PCA, the default. Axes = party rows + the room's
                   anonymous covariance aggregate; any ballot is scored over its
                   ANSWERED columns only and scaled by sqrt(m/answered) — the
                   Polis sparsity correction — so a partial ballot no longer
                   shrinks toward the centre.
     · Distances — metric MDS (SMACOF) over all rows: the layout that best
                   preserves everyone's true pairwise vote-distances.
     · You       — egocentric: every dot at its TRUE vote-distance from you,
                   bearings carried over from Distances.
     · CA        — correspondence analysis: abstain is its own category, not a
                   midpoint between for and against.
     · t-SNE     — offered only once the matrix has ≥30 rows (a crowd view;
                   below that it manufactures clusters).
   Every layout is Procrustes-aligned by its PARTY rows onto a fixed party-only
   MDS baseline, so switching chips shows STRUCTURE, not an arbitrary spin —
   dots morph in place. Loads after app.js. */

// Jacobi eigensolver for a symmetric matrix → {values, vectors(columns)}
function jacobi(Ain){
  const n=Ain.length;
  const a=Ain.map(r=>r.slice());
  const V=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?1:0));
  for(let sweep=0;sweep<100;sweep++){
    let off=0;
    for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)off+=a[i][j]*a[i][j];
    if(off<1e-12)break;
    for(let p=0;p<n;p++)for(let q=p+1;q<n;q++){
      if(Math.abs(a[p][q])<1e-15)continue;
      // annihilation angle for the G^T·A·G update below: tan2θ = 2a_pq/(a_qq−a_pp)
      // (the a_pp−a_qq order flips the rotation's sign and the sweep never converges)
      const theta=0.5*Math.atan2(2*a[p][q],a[q][q]-a[p][p]);
      const c=Math.cos(theta),s=Math.sin(theta);
      for(let i=0;i<n;i++){const aip=a[i][p],aiq=a[i][q];a[i][p]=c*aip-s*aiq;a[i][q]=s*aip+c*aiq;}
      for(let j=0;j<n;j++){const apj=a[p][j],aqj=a[q][j];a[p][j]=c*apj-s*aqj;a[q][j]=s*apj+c*aqj;}
      for(let i=0;i<n;i++){const vip=V[i][p],viq=V[i][q];V[i][p]=c*vip-s*viq;V[i][q]=s*vip+c*viq;}
    }
  }
  return {values:a.map((r,i)=>r[i]),vectors:V};
}
// the two leading eigen-directions, scaled by sqrt(eigenvalue) → n×2 coords
function topTwo(eig,n){
  const {values,vectors}=eig;
  const ord=values.map((_,i)=>i).sort((x,y)=>values[y]-values[x]);
  const k1=ord[0],k2=ord[1];
  const s1=Math.sqrt(Math.max(0,values[k1])),s2=Math.sqrt(Math.max(0,values[k2]));
  return Array.from({length:n},(_,i)=>[vectors[i][k1]*s1,vectors[i][k2]*s2]);
}

/* ---- the one matrix: parties + every ballot this device knows ----
   Columns are the deck's decisions in canonical order; a row is a vector of
   for=+1 / against=-1 / abstain=0 / null where there is nothing recorded. */
const voteNum=v=>v==="for"?1:v==="against"?-1:v==="abstain"?0:null;
// the deck's decisions in a canonical (device-independent) order = the columns
function jointCols(){
  let pool=R.decisions.filter(d=>d.headline && !d.curator_drop);
  if(typeof DECK_MODE!=="undefined" && DECK_MODE==="live" && typeof liveDeckIds==="function"){
    const ids=new Set(liveDeckIds()); pool=pool.filter(d=>ids.has(d.id));
  }
  return pool.map(d=>d.id);
}
function rowVec(votes,cols){ return cols.map(id=>voteNum(votes[id])); }
function partyVecs(cols){
  return PARTIES.map(p=>cols.map(id=>voteNum((byId[id].party_votes_canon||{})[p.token])));
}
// every ballot whose record exists on this device: mine, live peers' (cast
// markers), sim peers'. Real async peers never share a ballot — they publish a
// canonical position over presence instead (see publishCoord / renderPeersInto).
function knownBallots(){
  const out=[];
  if(typeof answers!=="undefined" && Object.keys(answers).length) out.push({key:"me",votes:answers});
  if(typeof PEERS!=="undefined"){
    const live=window.LIVE && LIVE.active();
    for(const pid in PEERS){
      const votes=live?LIVE.peerVotes(pid):(PEERS[pid].votes||null);
      if(votes) out.push({key:pid,votes});
    }
  }
  return out;
}
// parties first, then each known ballot that overlaps the deck; keys[i] names row nP+i
function matrixRows(){
  const cols=jointCols();
  const vecs=partyVecs(cols), keys=[];
  for(const b of knownBallots()){
    const v=rowVec(b.votes,cols);
    if(v.some(x=>x!=null)){vecs.push(v);keys.push(b.key);}
  }
  return {cols,vecs,keys};
}
// cheap change-detector: who is in the matrix and how much each has voted
function rowsFingerprint(){
  return knownBallots().map(b=>b.key+":"+Object.keys(b.votes).length).join("|");
}
// mean pairwise disagreement in [0,1] over shared answered columns
function distRows(X){
  const n=X.length, m=X[0]?X[0].length:0;
  const D=Array.from({length:n},()=>Array(n).fill(0));
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
    let s=0,c=0;
    for(let k=0;k<m;k++){const a=X[i][k],b=X[j][k]; if(a==null||b==null)continue; s+=Math.abs(a-b)/2;c++;}
    D[i][j]=D[j][i]=c?s/c:0.5;   // nothing comparable → max ambiguity
  }
  return D;
}
function pairDist(a,b){
  let s=0,c=0;
  for(let k=0;k<a.length;k++){const x=a[k],y=b[k]; if(x==null||y==null)continue; s+=Math.abs(x-y)/2;c++;}
  return c?s/c:null;
}

/* ---- the projections ---- */
function projMDS(D){             // classical MDS / PCoA — double-centred squared distances
  const n=D.length;
  const D2=D.map(r=>r.map(v=>v*v));
  const rm=Array(n).fill(0);let gm=0;
  for(let i=0;i<n;i++){for(let j=0;j<n;j++)rm[i]+=D2[i][j];rm[i]/=n;gm+=rm[i];}
  gm/=n;
  const B=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>-0.5*(D2[i][j]-rm[i]-rm[j]+gm)));
  return topTwo(jacobi(B),n);
}
function projSMACOF(D){          // metric MDS by stress majorization (Guttman transform)
  const n=D.length;
  let X=projMDS(D).map(p=>p.slice());
  for(let it=0;it<300;it++){
    const B=Array.from({length:n},()=>Array(n).fill(0));
    for(let i=0;i<n;i++)for(let j=0;j<n;j++){
      if(i===j)continue;
      const dx=X[i][0]-X[j][0],dy=X[i][1]-X[j][1];
      B[i][j]=-D[i][j]/(Math.sqrt(dx*dx+dy*dy)||1e-9);
    }
    for(let i=0;i<n;i++)for(let j=0;j<n;j++)if(j!==i)B[i][i]-=B[i][j];
    X=Array.from({length:n},(_,i)=>{
      let x=0,y=0;
      for(let j=0;j<n;j++){x+=B[i][j]*X[j][0];y+=B[i][j]*X[j][1];}
      return [x/n,y/n];
    });
  }
  return X;
}
function projCA(X){              // correspondence analysis of the for/against/abstain table
  const n=X.length, m=X[0]?X[0].length:0;
  const cols=[];                 // indicator column per (decision, direction); drop empty ones
  for(let k=0;k<m;k++)for(const v of [1,-1,0]){
    const col=X.map(row=>row[k]===v?1:0);
    if(col.some(x=>x)) cols.push(col);
  }
  const total=cols.reduce((s,col)=>s+col.reduce((a,b)=>a+b,0),0)||1;
  const r=Array(n).fill(0);
  const c=cols.map(col=>col.reduce((a,b)=>a+b,0)/total);
  for(let i=0;i<n;i++) r[i]=cols.reduce((s,col)=>s+col[i],0)/total;
  const S=Array.from({length:n},(_,i)=>cols.map((col,k)=>
    (col[i]/total - r[i]*c[k])/Math.sqrt((r[i]||1e-9)*(c[k]||1e-9))));
  const T=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>{
    let s=0; for(let k=0;k<S[0].length;k++)s+=S[i][k]*S[j][k]; return s;}));
  // row principal coordinates: D_r^-1/2 · U · sqrt(λ)
  return topTwo(jacobi(T),n).map((p,i)=>[p[0]/Math.sqrt(r[i]||1e-9),p[1]/Math.sqrt(r[i]||1e-9)]);
}
function projTSNE(D){            // t-SNE — local neighbourhoods; deterministic init from MDS
  const n=D.length, perp=Math.min(30,Math.max(2,(n-1)/3));
  const P=Array.from({length:n},()=>Array(n).fill(0));
  for(let i=0;i<n;i++){          // binary-search the bandwidth to hit the target perplexity
    let beta=1,lo=0,hi=Infinity;
    const row=Array(n).fill(0);
    for(let t=0;t<60;t++){
      let Z=0;
      for(let j=0;j<n;j++){row[j]=i===j?0:Math.exp(-D[i][j]*D[i][j]*beta);Z+=row[j];}
      if(Z<=0){hi=beta;beta=(beta+lo)/2;continue;}
      let H=0;
      for(let j=0;j<n;j++){if(!row[j])continue;const p=row[j]/Z;H-=p*Math.log(p);}
      const diff=Math.exp(H)-perp;
      if(Math.abs(diff)<.01)break;
      if(diff>0){lo=beta;beta=hi===Infinity?beta*2:(beta+hi)/2;}
      else      {hi=beta;beta=(beta+lo)/2;}
    }
    const Z=row.reduce((a,b)=>a+b,0)||1e-12;
    for(let j=0;j<n;j++)P[i][j]=i===j?0:row[j]/Z;
  }
  const Ps=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>
    Math.max((P[i][j]+P[j][i])/(2*n),1e-12)));
  const base=projMDS(D);
  const sc=Math.sqrt(base.reduce((s,p)=>s+p[0]*p[0]+p[1]*p[1],0)/n)||1;
  const Y=base.map(p=>[p[0]/sc*1e-2,p[1]/sc*1e-2]);
  const vel=Y.map(()=>[0,0]);
  for(let it=0;it<500;it++){
    const ex=it<100?4:1, mom=it<200?.5:.8, lr=Math.max(4,n);
    let Zq=0; const num=Array.from({length:n},()=>Array(n).fill(0));
    for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
      const dx=Y[i][0]-Y[j][0],dy=Y[i][1]-Y[j][1];
      const q=1/(1+dx*dx+dy*dy);
      num[i][j]=num[j][i]=q;Zq+=2*q;
    }
    Zq=Zq||1e-12;
    for(let i=0;i<n;i++){
      let gx=0,gy=0;
      for(let j=0;j<n;j++){
        if(i===j)continue;
        const co=4*(ex*Ps[i][j]-num[i][j]/Zq)*num[i][j];
        gx+=co*(Y[i][0]-Y[j][0]);gy+=co*(Y[i][1]-Y[j][1]);
      }
      vel[i][0]=mom*vel[i][0]-lr*gx;vel[i][1]=mom*vel[i][1]-lr*gy;
    }
    for(let i=0;i<n;i++){Y[i][0]+=vel[i][0];Y[i][1]+=vel[i][1];}
  }
  return Y;
}
// egocentric: YOU at the centre of the frame; every other row keeps its
// Distances bearing FROM YOU but slides to its TRUE vote-distance — the radius
// is exact (your closest dot IS your closest voter in the votes), only the
// angles are inherited approximations.
function projYou(M){
  const S=getProj("smacof");
  if(!S || !S.byKey || !S.byKey.me) return null;
  const meS=S.byKey.me, nP=PARTIES.length;
  let cx=0,cy=0; S.coords.forEach(c=>{cx+=c[0];cy+=c[1];}); cx/=nP; cy/=nP;
  const meVec=M.vecs[nP+M.keys.indexOf("me")];
  const frame=i=>i<nP?S.coords[i]:S.byKey[M.keys[i-nP]];
  return M.vecs.map((vec,i)=>{
    if(i>=nP && M.keys[i-nP]==="me") return [cx,cy];
    const c=frame(i); if(!c) return null;
    const d=pairDist(meVec,vec);
    if(d==null) return c.slice();            // nothing comparable — keep the Distances spot
    const dx=c[0]-meS[0],dy=c[1]-meS[1],L=Math.hypot(dx,dy)||1e-9;
    return [cx+d*dx/L, cy+d*dy/L];
  });
}

/* ---- Procrustes: rotate/reflect+scale B onto A so projections share an
   orientation — switching then shows structure, not an arbitrary spin.
   procrustesT returns the fitted point-set AND the transform itself, so the
   transform fitted on the PARTY rows can carry every other row along. ---- */
function procrustesT(B,A){
  const n=A.length;
  const mean=M=>{let x=0,y=0;for(const p of M){x+=p[0];y+=p[1];}return [x/n,y/n];};
  const Am=mean(A),Bm=mean(B);
  const A0=A.map(p=>[p[0]-Am[0],p[1]-Am[1]]);
  const B0=B.map(p=>[p[0]-Bm[0],p[1]-Bm[1]]);
  const nrm=M=>Math.sqrt(M.reduce((s,p)=>s+p[0]*p[0]+p[1]*p[1],0))||1;
  const k=nrm(A0)/nrm(B0);
  const fit=sgn=>{                                  // sgn=-1 tries the mirror
    let num=0,den=0;
    for(let i=0;i<n;i++){const bx=B0[i][0]*k,by=B0[i][1]*k*sgn;
      num+=bx*A0[i][1]-by*A0[i][0];den+=bx*A0[i][0]+by*A0[i][1];}
    const th=Math.atan2(num,den),c=Math.cos(th),s=Math.sin(th);
    let err=0;for(let i=0;i<n;i++){const bx=B0[i][0]*k,by=B0[i][1]*k*sgn;
      err+=(c*bx-s*by-A0[i][0])**2+(s*bx+c*by-A0[i][1])**2;}
    return {th,sgn,err};
  };
  const f=[fit(1),fit(-1)].sort((a,b)=>a.err-b.err)[0];
  const c=Math.cos(f.th),s=Math.sin(f.th);
  const apply=pt=>{const bx=(pt[0]-Bm[0])*k,by=(pt[1]-Bm[1])*k*f.sgn;
    return [c*bx-s*by+Am[0],s*bx+c*by+Am[1]];};
  return {coords:B.map(apply),apply};
}

/* ---- the Room projection: parties and participants are the SAME kind of row,
   projected onto axes the WHOLE ROOM defines (Polis lineage).

   PCA's axes are the eigenvectors of the decisions×decisions covariance, and a
   covariance is a SUM over rows — so at any scale the room contributes through
   an aggregate second-moment accumulator (JOINT_COV, atomic increments in
   multiplayer.js), never a broadcast vote. Parties are known locally and added
   as rows here. Empty room → the party rows alone → a clean party PCA; as
   people finish, their votes bend the axes, and the map becomes the room's.

   Placement is sparsity-aware, the Polis way: a ballot is scored over its
   ANSWERED columns only and scaled by sqrt(m/answered) — without that, an
   unanswered decision counts as an abstention and a partial ballot (mid-deck
   visitor, partial import) shrinks toward the centre of the map. ---- */
let JOINT_COV=null;            // {k, s:{j:Σx_j}, m2:{"j_l":Σ x_j x_l}} — room aggregate, no individuals
// my own ballot as the nonzero entries of its column vector — what gets summed in
function jointMyRow(){
  const out=[]; jointCols().forEach((id,j)=>{const v=voteNum(answers[id]); if(v)out.push({j,v});});
  return out;
}
function projJoint(){
  const cols=jointCols(), m=cols.length;
  if(m<2) return null;
  let K=0; const S=Array(m).fill(0), M2=Array.from({length:m},()=>Array(m).fill(0));
  const add=x=>{ K++; for(let j=0;j<m;j++){ if(!x[j])continue; S[j]+=x[j];
    for(let l=j;l<m;l++){ if(x[l])M2[j][l]+=x[j]*x[l]; } } };
  const partyRows=partyVecs(cols);
  partyRows.forEach(r=>add(r.map(v=>v||0)));       // parties are rows too — added locally
  const C=JOINT_COV;                               // the room's aggregate, if any
  if(C && C.k>0){
    K+=C.k;
    for(const j in C.s){ if(+j<m) S[+j]+=C.s[j]; }
    for(const key in C.m2){ const p=key.indexOf("_"), j=+key.slice(0,p), l=+key.slice(p+1);
      if(j<m && l<m) M2[j][l]+=C.m2[key]; }
  }
  if(K<2) return null;
  const mu=S.map(v=>v/K);
  const Cov=Array.from({length:m},(_,j)=>Array.from({length:m},(_,l)=>{
    const a=j<=l?M2[j][l]:M2[l][j]; return a/K-mu[j]*mu[l]; }));
  const {values,vectors}=jacobi(Cov);
  const ord=values.map((_,i)=>i).sort((a,b)=>values[b]-values[a]);
  const u1=vectors.map(r=>r[ord[0]]), u2=vectors.map(r=>r[ord[1]]);
  const score=x=>{                                 // answered columns only + Polis scaling
    let a=0,b=0,ans=0;
    for(let j=0;j<m;j++){ const v=x[j]; if(v==null)continue; ans++;
      const c=v-mu[j]; a+=c*u1[j]; b+=c*u2[j]; }
    if(!ans) return null;
    const sc=Math.sqrt(m/ans);
    return [a*sc,b*sc];
  };
  return {coords:partyRows.map(r=>score(r)||[0,0]),
          project:votes=>score(rowVec(votes,cols))};
}
// multiplayer.js (real room or sim) calls this when the room aggregate changes
function jointDataChanged(cov){
  JOINT_COV=cov;
  delete PROJ_CACHE["joint"];
  if(MAP_PROJ==="joint" && $("#resultMap") && $("#resultMap").innerHTML){
    applyProjection("joint"); repositionMap();
  }
}

/* ---- the projection registry + current selection ----
   note = the one-line explainer under the chips; cap = the map's caption
   (only shown when true for that view); min = minimum matrix rows. */
/* note copy doctrine (Rob, 2026-06): written for a 12-year-old glancing at the
   map — what you SEE and what it means for you, never how it's computed. Max
   two short sentences; each note says what makes ITS view different in plain
   words. Banned: matrix, axes, dimensions, projection, PCA, correlation,
   vectors — and anything that needs a stats course or a second read. Chip
   names are plain what-you-get words; the method's real name appears only as
   the note's trailing "(technically: …)" tag. */
const PROJECTIONS=[
  {k:"joint", n:"Room", cap:"Closer = votes more alike",
   note:"built from everyone's votes — you, the parties, the whole room. dots that sit close voted alike. (technically: PCA)"},
  {k:"smacof", n:"Gaps", cap:"Closer = votes more alike",
   note:"the gaps are the point here: the further apart two dots, the more differently they voted. (technically: metric MDS)"},
  {k:"you", n:"You", cap:"Distance from you = how differently you vote",
   note:"this one is built around you: you sit at the centre, and the closer a dot, the more it voted like you. (technically: an egocentric distance map)"},
  {k:"ca", n:"Quiet votes", cap:"Closer = votes more alike",
   note:"abstaining counts as its own kind of vote here, not half a yes. parties that abstain together pull together. (technically: correspondence analysis)"},
  {k:"tsne", n:"Camps", cap:"Groups mean something — the space between them doesn't", min:30,
   note:"this view hunts for camps: dots that vote alike pull into tight groups. the space between groups doesn't mean much. (technically: t-SNE)"},
];
let MAP_PROJ="joint";          // the room map is the default; the rest are the bench
let PROJ_CACHE={};
/* the GHOST on the map: it renders by default ONLY on the You projection (the
   egocentric view is where "predicts you" is the question); on every other
   projection it hides behind a bench chip (the existing toggle idiom). The
   toggle is session state, not persisted. */
let GHOST_ON=false;
const ghostSeated=()=>PARTIES.some(p=>p.ghost);
const ghostVisible=()=>ghostSeated() && (MAP_PROJ==="you" || GHOST_ON);
const GHOST_CAP="the dashed one is your ghost. it never saw your votes — it predicts them.";
function projDef(k){ return PROJECTIONS.find(p=>p.k===k)||PROJECTIONS[0]; }
// chips that make sense right now: You needs your ballot; t-SNE needs a crowd
function availableProjections(){
  const M=matrixRows(), rows=PARTIES.length+M.keys.length;
  return PROJECTIONS.filter(p=>
    (p.k!=="you" || M.keys.includes("me")) && (!p.min || rows>=p.min));
}
// orientation anchor: classical MDS of the party-only distances (deterministic,
// device-independent — every layout's party rows are Procrustes-fitted onto it)
function partyBaseline(){
  if(PROJ_CACHE._base) return PROJ_CACHE._base;
  return PROJ_CACHE._base=projMDS(distRows(partyVecs(jointCols())));
}
function getProj(key){
  if(PARTIES.length<3 || !R.decisions.length) return null;
  const c=PROJ_CACHE[key];
  if(c && (key==="joint" || c.fp===rowsFingerprint())) return c;   // rows changed → recompute
  const nP=PARTIES.length;
  let co=null, place=null, byKey=null, fp=null;
  if(key==="joint"){
    const J=projJoint();
    if(!J) return getProj("smacof");                 // deck too small to span 2D yet
    const T=procrustesT(J.coords,partyBaseline());
    co=T.coords;
    place=votes=>{const raw=J.project(votes); return raw?T.apply(raw):null;};
  }else{
    const M=matrixRows();
    fp=rowsFingerprint();
    let all=null, aligned=false;
    try{
      if(key==="smacof")    all=projSMACOF(distRows(M.vecs));
      else if(key==="ca")   all=projCA(M.vecs);
      else if(key==="tsne") all=projTSNE(distRows(M.vecs));
      else if(key==="you"){ all=projYou(M); aligned=!!all; }   // already in the Distances frame
    }catch(e){all=null;}
    if(!all || all.some(p=>!p||!isFinite(p[0])||!isFinite(p[1]))){
      all=projMDS(distRows(M.vecs)); aligned=false;            // never a broken map
    }
    if(!aligned){const T=procrustesT(all.slice(0,nP),partyBaseline()); all=all.map(T.apply);}
    co=all.slice(0,nP);
    byKey={}; M.keys.forEach((k,i)=>byKey[k]=all[nP+i]);
  }
  // the parties span the frame; participant dots may run past it (toPctIn clamps).
  // The You view's frame includes YOU — its whole point is you against the field
  const fr=key==="you"&&byKey&&byKey.me?co.concat([byKey.me]):co;
  const xs=fr.map(c=>c[0]),ys=fr.map(c=>c[1]);
  return PROJ_CACHE[key]={coords:co, place, byKey, fp,
    mx:{minx:Math.min(...xs),maxx:Math.max(...xs),miny:Math.min(...ys),maxy:Math.max(...ys)}};
}
function syncProj(P){ COORD=P.coords; MX=P.mx; PLACE=P.place||null; }
function applyProjection(key){
  const P=getProj(key);
  if(!P){COORD=null;MX={};PLACE=null;return;}
  MAP_PROJ=key; syncProj(P);
}
function rebuildMap(){
  PROJ_CACHE={}; COORD=null; MX={}; PLACE=null;
  if(PARTIES.length>=3 && R.decisions.length) applyProjection(MAP_PROJ);
}

/* ---- placement: a known ballot IS a row of the matrix — its spot is its row's
   coordinate, found by key ("me" or a peer's pid). The Room projection scores
   any ballot directly (linear axes), so it needs no key. getProj revalidates
   the row fingerprint, so a ballot that just arrived re-enters the solve. ---- */
function blendCoord(votes,key){
  const P=getProj(MAP_PROJ); if(!P) return null;
  syncProj(P);                       // a row-change recompute may have moved everyone
  if(P.place) return P.place(votes);
  return (key!=null && P.byKey && P.byKey[key])||null;
}
function userCoord(){ return blendCoord(answers,"me"); }
function toPctIn(c,mx,raw){
  // parties span [minx,maxx] → the inner [pad,1-pad] band; the pad margin is
  // live space for ballots that land OUTSIDE the party frame. raw=true keeps
  // the unclamped percentage — the TRUE position; layoutMap() pixel-clamps at
  // render and marks the dot, so "beyond the edge" never reads as a position.
  const pad=.17, cl=v=>raw?v:Math.max(2,Math.min(98,v));
  const nx=(c[0]-mx.minx)/((mx.maxx-mx.minx)||1);
  const ny=(c[1]-mx.miny)/((mx.maxy-mx.miny)||1);
  return [cl((pad+nx*(1-2*pad))*100),cl((pad+(1-ny)*(1-2*pad))*100)];
}
function toPct(c){ return toPctIn(c,MX,true); }
// presence publishes a CANONICAL position so a peer's dot doesn't depend on which
// projection this device is experimenting with: the Room frame — its axes are
// the parties + the shared aggregate, identical on every device.
function publishCoord(){
  const P=getProj("joint"); if(!P) return null;
  const uc=P.place?P.place(answers):(P.byKey&&P.byKey.me)||null;
  return uc?toPctIn(uc,P.mx):null;
}

/* ---- the layout pass: positions are data — never silently displace a dot ----
   Runs over the live DOM after every render/morph/peer update and on resize,
   reading each dot's TRUE position from data-tx/ty (unclamped %), in pixels:
   · parties + YOU whose discs heavily occlude fan out evenly on a tight ring
     around their shared spot. An anchor ring stays at the true point (violet
     when YOU is in the cluster — sharing YOU's coordinate is the headline
     fact, never buried) and every displaced disc keeps a 1px hairline back to
     ITS OWN true coordinate, so near-ties stay exact. Fan order is DOM order
     (parties then YOU) — deterministic, so projection morphs don't reshuffle.
   · every dot (peers too) clamps fully inside the panel (pad ≥ its radius);
     a dot whose true point lies beyond the band gets a flat bar pressed
     against that border — reads "at or beyond this edge", not a position.
   Geometry is recomputed from scratch each call: nothing accumulates. */
let _mapLayoutRetry=0;
function layoutMap(){
  const el=$("#resultMap"); if(!el||!el.innerHTML) return;
  const W=el.clientWidth, H=el.clientHeight;
  if(!W||!H){   // first paint can run before doneVis() unhides the reveal — measure next frame
    if(_mapLayoutRetry<5){_mapLayoutRetry++;requestAnimationFrame(layoutMap);}
    return;
  }
  _mapLayoutRetry=0;
  const dots=[];
  el.querySelectorAll(".mdot,.peer").forEach(d=>{
    if(d.classList.contains("hide")) return;   // ghost off this projection — out of the geometry
    const tx=parseFloat(d.dataset.tx), ty=parseFloat(d.dataset.ty);
    if(!isFinite(tx)||!isFinite(ty)) return;
    const peer=d.classList.contains("peer"), me=d.classList.contains("me");
    const ghost=d.classList.contains("ghost");
    if(ghost) d.classList.remove("split");     // recomputed from scratch each pass
    dots.push({d,me,peer,ghost,tx:tx/100*W,ty:ty/100*H,r:peer?8:me?21:ghost?10:16,fx:null,fy:null,line:null});
  });
  if(!dots.length) return;
  const geo=[];                                      // svg: hairlines, anchors, edge bars
  // union-find the party/YOU discs whose centres sit deep inside each other
  const main=dots.filter(o=>!o.peer);
  const uf=main.map((_,i)=>i), find=i=>uf[i]===i?i:(uf[i]=find(uf[i]));
  for(let i=0;i<main.length;i++)for(let j=i+1;j<main.length;j++)
    if(Math.hypot(main[i].tx-main[j].tx,main[i].ty-main[j].ty)<.6*(main[i].r+main[j].r))
      uf[find(i)]=find(j);
  const clusters={};
  main.forEach((o,i)=>{const k=find(i);(clusters[k]=clusters[k]||[]).push(o);});
  for(const k in clusters){
    const c=clusters[k]; if(c.length<2) continue;
    let ax=0,ay=0; c.forEach(o=>{ax+=o.tx;ay+=o.ty;}); ax/=c.length; ay/=c.length;
    const rmax=Math.max(...c.map(o=>o.r));
    // ring radius: a 2px gap between neighbouring discs, never hugging the anchor
    const rho=Math.max((rmax+1)/Math.sin(Math.PI/c.length), rmax+7);
    const a0=Math.atan2(H/2-ay, W/2-ax);             // first slot leans inward
    const anchors=[];                                // distinct true points (near-ties keep both)
    c.forEach((o,i)=>{
      const th=a0+i*2*Math.PI/c.length;
      o.fx=ax+rho*Math.cos(th); o.fy=ay+rho*Math.sin(th);
      o.line={t:"line",x1:o.tx,y1:o.ty};             // x2/y2 land after the clamp
      geo.push(o.line);
      // the ghost's SOLID CORE never leaves its true coordinate: the displaced
      // disc keeps only the dashed shell (.split hides its in-dot core) and the
      // core is re-inked here, at the true point — same contract as the anchors
      if(o.ghost){ o.d.classList.add("split"); geo.push({t:"gcore",x:o.tx,y:o.ty}); }
      if(!anchors.some(a=>Math.hypot(a.x-o.tx,a.y-o.ty)<2)) anchors.push({x:o.tx,y:o.ty,me:false});
      if(o.me) anchors.forEach(a=>{if(Math.hypot(a.x-o.tx,a.y-o.ty)<2)a.me=true;});
    });
    anchors.forEach(a=>geo.push({t:"anchor",...a}));
  }
  for(const o of dots){
    const lo=o.r+4;
    const x=Math.max(lo,Math.min(W-lo,o.fx??o.tx)), y=Math.max(lo,Math.min(H-lo,o.fy??o.ty));
    // edge bars mark the TRUE point overflowing, not a fan offset pushed back in
    if(o.tx<lo-1)   geo.push({t:"bar",x:0,y:y-6,w:3,h:12});
    if(o.tx>W-lo+1) geo.push({t:"bar",x:W-3,y:y-6,w:3,h:12});
    if(o.ty<lo-1)   geo.push({t:"bar",x:x-6,y:0,w:12,h:3});
    if(o.ty>H-lo+1) geo.push({t:"bar",x:x-6,y:H-3,w:12,h:3});
    o.d.classList.toggle("pin", o.tx<lo-1||o.tx>W-lo+1||o.ty<lo-1||o.ty>H-lo+1);
    o.d.classList.toggle("pinb", o.me && o.ty>H-lo+1);   // "you" tag flips above
    if(o.line){o.line.x2=x;o.line.y2=y;}
    o.d.style.left=(x/W*100)+"%"; o.d.style.top=(y/H*100)+"%";
  }
  let svg=el.querySelector(".mlay");
  if(!svg){
    svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
    svg.setAttribute("class","mlay");
    svg.style.animationDelay=(120+(PARTIES.length+1)*90+320)+"ms";  // after YOU lands
    el.insertBefore(svg, el.querySelector(".mdot"));
  }
  svg.setAttribute("viewBox",`0 0 ${W} ${H}`);
  svg.innerHTML=geo.map(g=>
    g.t==="line"  ? `<line x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}"/>`
   :g.t==="anchor"? `<circle class="anchor${g.me?" you":""}" cx="${g.x}" cy="${g.y}" r="${g.me?4.5:3.5}"/>`
   :g.t==="gcore" ? `<circle class="gcore" cx="${g.x}" cy="${g.y}" r="3"/>`
                  : `<rect class="ebar" x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="1.5"/>`
  ).join("");
}
let _mapRsz=null;
window.addEventListener("resize",()=>{clearTimeout(_mapRsz);_mapRsz=setTimeout(layoutMap,120);});

/* ---- The reveal map: parties stagger in, YOU lands last (stamp-style), peers fade in behind. ---- */
function renderResultMap(){
  const el=$("#resultMap"), picker=$("#mapProj");
  const P=getProj(MAP_PROJ);
  if(P) syncProj(P);                 // my ballot is a row now — refresh before first paint
  if(!COORD){el.style.display="none"; if(picker)picker.hidden=true; return;}
  el.style.display="";
  const dots=PARTIES.map((p,i)=>{
    const [l,t]=toPct(COORD[i]);
    // the ghost is spectral: the bare dashed-ring mark, no disc, paper through
    // the ring — it must never read as one more party. Hidden off-You unless toggled.
    if(p.ghost)
      return `<div class="mdot ghost${ghostVisible()?"":" hide"}" data-tx="${l}" data-ty="${t}" style="left:${l}%;top:${t}%;--d:${120+i*90}ms" title="GHOST">${ghostMark(16)}</div>`;
    const inner=p.logo?`<span class="mc bg-${p.token}"><img src="${p.logo}" alt="${esc(p.name)}"></span>`
                      :`<span class="mc fb" style="background:${p.color}">${p.token}</span>`;
    return `<div class="mdot" data-tx="${l}" data-ty="${t}" style="left:${l}%;top:${t}%;--d:${120+i*90}ms" title="${esc(p.name)}">${inner}</div>`;
  }).join("");
  const uc=userCoord();
  let userDot="";
  if(uc){const [l,t]=toPct(uc);
    // your join emoji wears the violet ring + a "you" tag; pre-join solo keeps the YOU disc
    const em=(identity&&identity.emoji)||"";
    const inner=em?`<span class="mc you">${esc(em)}</span><span class="mtag">you</span>`
                  :`<span class="mc fb">YOU</span>`;
    userDot=`<div class="mdot me" data-tx="${l}" data-ty="${t}" style="left:${l}%;top:${t}%;--d:${120+PARTIES.length*90+260}ms">${inner}</div>`;}
  el.innerHTML=`<span class="maptag">${esc(projDef(MAP_PROJ).cap)}</span>
    <div class="axis x"></div><div class="axis y"></div>${dots}${userDot}`;
  renderPeers();
  layoutMap();
  renderProjPicker();
}
// projection switch / row change: same dots, new coordinates — they morph, never re-enter
function repositionMap(){
  const el=$("#resultMap");
  if(!el||!el.innerHTML) return;
  const P=getProj(MAP_PROJ); if(!P) return;
  syncProj(P);
  el.querySelectorAll(".mdot:not(.me)").forEach((d,i)=>{
    if(!COORD[i])return;
    const [l,t]=toPct(COORD[i]);
    d.dataset.tx=l; d.dataset.ty=t;
    d.style.left=l+"%"; d.style.top=t+"%";
  });
  const me=el.querySelector(".mdot.me"), uc=userCoord();
  if(me&&uc){const [l,t]=toPct(uc); me.dataset.tx=l; me.dataset.ty=t; me.style.left=l+"%"; me.style.top=t+"%";}
  renderPeers();
  layoutMap();
}
// ghost visibility follow-through: the dot, its bench chip (off-You only) and
// the You caption all track ghostVisible(); the layout pass re-runs because
// a dot entering/leaving the panel changes the collision geometry.
function syncGhostUI(){
  const d=document.querySelector("#resultMap .mdot.ghost");
  if(d) d.classList.toggle("hide",!ghostVisible());
  const g=document.querySelector("#mapProj .gchip");
  if(g){ g.hidden=(MAP_PROJ==="you"); g.classList.toggle("on",GHOST_ON); g.setAttribute("aria-pressed",String(GHOST_ON)); }
  const n=document.querySelector("#mapProj .gnote");
  if(n) n.hidden=(MAP_PROJ!=="you");
  layoutMap();
}
function renderProjPicker(){
  const el=$("#mapProj"); if(!el) return;
  if(!COORD){el.hidden=true;return;}
  el.hidden=false;
  // bench = projection chips + (ghost seated) its show/hide chip, the same chip
  // idiom — hidden on You, where the ghost always renders and the caption explains it
  const gchip=ghostSeated()
    ? `<button type="button" class="mp-chip gchip${GHOST_ON?" on":""}"${MAP_PROJ==="you"?" hidden":""} data-ghost aria-pressed="${String(GHOST_ON)}">${ghostMark(14)}GHOST</button>`
    : "";
  el.innerHTML=`<div class="mp-row">`+availableProjections().map(p=>
      `<button type="button" class="mp-chip${p.k===MAP_PROJ?" on":""}" data-proj="${p.k}">${p.n}</button>`
    ).join("")+gchip+`</div>
    <p class="mp-note">${projDef(MAP_PROJ).note}</p>`+
    (ghostSeated()?`<p class="mp-note gnote"${MAP_PROJ==="you"?"":" hidden"}>${GHOST_CAP}</p>`:"");
}
(function(){
  const el=document.getElementById("mapProj"); if(!el)return;
  el.addEventListener("click",e=>{
    const g=e.target.closest("[data-ghost]");
    if(g){ GHOST_ON=!GHOST_ON; syncGhostUI(); return; }
    const b=e.target.closest("[data-proj]"); if(!b)return;
    if(b.dataset.proj===MAP_PROJ)return;
    applyProjection(b.dataset.proj);
    // update in place — rebuilding the row would reset its horizontal scroll
    el.querySelectorAll(".mp-chip[data-proj]").forEach(c=>c.classList.toggle("on",c.dataset.proj===MAP_PROJ));
    const cur=projDef(MAP_PROJ), note=el.querySelector(".mp-note:not(.gnote)");
    if(note) note.textContent=cur.note;
    const tag=document.querySelector("#resultMap .maptag");
    if(tag) tag.textContent=cur.cap;
    syncGhostUI();
    repositionMap();
  });
})();
