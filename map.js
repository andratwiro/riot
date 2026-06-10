/* RIOT viewer — the affinity map (reveal-only): party vote-distances flattened
   to 2D, user placement, the big result map. The map never appears in the
   voting flow — it is the payoff of the reveal, animated into place dot by dot.

   Eight projections of the same vote-distance space (classical MDS is the
   default; PCA, CA, kernel PCA, SMACOF, Sammon, spectral, t-SNE are the
   experiment bench under the map). Every projection is Procrustes-aligned to
   the MDS baseline so switching shows differences in STRUCTURE, not an
   arbitrary rotation — dots morph in place. Loads after app.js. */

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
      const theta=0.5*Math.atan2(2*a[p][q],a[p][p]-a[q][q]);
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

/* ---- shared inputs: the vote matrix and the disagreement-distance matrix ---- */
const voteNum=v=>v==="for"?1:v==="against"?-1:v==="abstain"?0:null;
function voteMatrix(){           // parties × decisions; null where no canonical vote
  return PARTIES.map(p=>R.decisions.map(d=>voteNum((d.party_votes_canon||{})[p.token])));
}
function distMatrix(){           // mean pairwise disagreement in [0,1]
  const X=voteMatrix(), n=X.length, m=X[0]?X[0].length:0;
  const D=Array.from({length:n},()=>Array(n).fill(0));
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
    let s=0,c=0;
    for(let k=0;k<m;k++){const a=X[i][k],b=X[j][k]; if(a==null||b==null)continue; s+=Math.abs(a-b)/2;c++;}
    D[i][j]=D[j][i]=c?s/c:0.5;
  }
  return D;
}
// shared gaussian bandwidth: the mean squared off-diagonal distance
function meanSq(D){
  const n=D.length; let s=0,c=0;
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){s+=D[i][j]*D[i][j];c++;}
  return (c?s/c:1)||1e-6;
}

/* ---- the projections: each takes D, returns n×2 coords ---- */
function projMDS(D){             // classical MDS / PCoA — double-centred squared distances
  const n=D.length;
  const D2=D.map(r=>r.map(v=>v*v));
  const rm=Array(n).fill(0);let gm=0;
  for(let i=0;i<n;i++){for(let j=0;j<n;j++)rm[i]+=D2[i][j];rm[i]/=n;gm+=rm[i];}
  gm/=n;
  const B=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>-0.5*(D2[i][j]-rm[i]-rm[j]+gm)));
  return topTwo(jacobi(B),n);
}
function projPCA(){              // principal components of the raw vote matrix
  const X=voteMatrix(), n=X.length, m=X[0]?X[0].length:0;
  const cols=[];                 // mean-impute gaps, centre each decision column
  for(let k=0;k<m;k++){
    let s=0,c=0; for(let i=0;i<n;i++) if(X[i][k]!=null){s+=X[i][k];c++;}
    if(!c) continue;
    const mu=s/c;
    cols.push(Array.from({length:n},(_,i)=>(X[i][k]==null?mu:X[i][k])-mu));
  }
  const G=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>{
    let s=0; for(const col of cols)s+=col[i]*col[j]; return s;}));
  return topTwo(jacobi(G),n);    // scores = U·sqrt(λ) of the Gram matrix
}
function projCA(){               // correspondence analysis of the for/against/abstain table
  const X=voteMatrix(), n=X.length, m=X[0]?X[0].length:0;
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
function projKPCA(D){            // kernel PCA — gaussian kernel over vote distances
  const n=D.length, sig2=meanSq(D);
  const K=D.map(row=>row.map(d=>Math.exp(-d*d/(2*sig2))));
  const rm=K.map(r=>r.reduce((a,b)=>a+b,0)/n);
  const gm=rm.reduce((a,b)=>a+b,0)/n;
  const Kc=K.map((row,i)=>row.map((v,j)=>v-rm[i]-rm[j]+gm));
  return topTwo(jacobi(Kc),n);
}
function projSpectral(D){        // Laplacian eigenmaps over the vote-similarity graph
  const n=D.length, sig2=meanSq(D);
  const W=D.map((row,i)=>row.map((d,j)=>i===j?0:Math.exp(-d*d/(2*sig2))));
  const deg=W.map(r=>r.reduce((a,b)=>a+b,0));
  const L=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>
    (i===j?1:0)-W[i][j]/Math.sqrt((deg[i]||1e-9)*(deg[j]||1e-9))));
  const {values,vectors}=jacobi(L);
  const ord=values.map((_,i)=>i).sort((x,y)=>values[x]-values[y]);
  const k1=ord[1],k2=ord[2];     // skip the trivial constant eigenvector
  return Array.from({length:n},(_,i)=>[vectors[i][k1],vectors[i][k2]]);
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
function projSammon(D){          // Sammon mapping — small distances weighted up (1969 update rule)
  const n=D.length, MF=0.3;
  const X=projMDS(D).map(p=>p.slice());
  for(let it=0;it<400;it++){
    for(let i=0;i<n;i++){
      const g=[0,0],h=[0,0];
      for(let j=0;j<n;j++){
        if(j===i)continue;
        const dx=[X[i][0]-X[j][0],X[i][1]-X[j][1]];
        const d=Math.sqrt(dx[0]*dx[0]+dx[1]*dx[1])||1e-9, dd=D[i][j]||1e-6;
        for(let p=0;p<2;p++){
          g[p]+=((dd-d)/(d*dd))*dx[p];
          h[p]+=(1/(dd*d))*((dd-d)-(dx[p]*dx[p]/d)*(1+(dd-d)/d));
        }
      }
      for(let p=0;p<2;p++) X[i][p]+=MF*g[p]/(Math.abs(h[p])||1e-9);
    }
  }
  return X;
}
function projTSNE(D){            // t-SNE — local neighbourhoods; deterministic init from MDS
  const n=D.length, perp=Math.min(2,Math.max(1.2,(n-1)/3));
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

/* ---- Procrustes: rotate/reflect+scale B onto A so projections share an
   orientation — switching then shows structure, not an arbitrary spin.
   procrustesT returns the fitted point-set AND the transform itself, so a point
   that wasn't in B (a participant) can be carried onto the same frame. ---- */
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
function procrustes(B,A){ return procrustesT(B,A).coords; }

/* ---- the joint room projection: parties and participants are the SAME kind of
   row, projected onto axes the WHOLE ROOM defines.

   Every entity (party or person) is a vector over the deck's decisions
   (for=+1, against=-1, abstain/blank=0). Stack them into one matrix and take its
   first two principal components — that is the map, and a party is just a labelled
   row in it, placed by the exact same formula as you: score = (row - mean)·axis.

   At scale we never need anyone's individual ballot to do this. PCA's axes are the
   eigenvectors of the decisions×decisions covariance, and a covariance is a SUM
   over rows — so the room contributes through an aggregate second-moment
   accumulator (JOINT_COV, summed via atomic increments in multiplayer.js), never a
   broadcast vote. Parties are known locally and added as rows here. Empty room →
   the 12 party rows alone → a clean party PCA; as people finish, their votes bend
   the axes, and the map becomes the room's. Oriented onto the MDS baseline so it
   doesn't spin from one recompute to the next (and matches across devices). ---- */
let JOINT_COV=null;            // {k, s:{j:Σx_j}, m2:{"j_l":Σ x_j x_l}} — room aggregate, no individuals
// the deck's decisions in a canonical (device-independent) order = the columns
function jointCols(){
  let pool=R.decisions.filter(d=>d.headline && !d.curator_drop);
  if(typeof DECK_MODE!=="undefined" && DECK_MODE==="live" && typeof liveDeckIds==="function"){
    const ids=new Set(liveDeckIds()); pool=pool.filter(d=>ids.has(d.id));
  }
  return pool.map(d=>d.id);
}
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
  const partyRows=PARTIES.map(p=>cols.map(id=>voteNum((byId[id].party_votes_canon||{})[p.token])||0));
  partyRows.forEach(add);                          // parties are rows too — added locally
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
  const score=x=>{let a=0,b=0;for(let j=0;j<m;j++){const c=x[j]-mu[j];a+=c*u1[j];b+=c*u2[j];}return [a,b];};
  return {coords:partyRows.map(score), project:votes=>score(cols.map(id=>voteNum(votes[id])||0))};
}
// multiplayer.js (real room or sim) calls this when the room aggregate changes
function jointDataChanged(cov){
  JOINT_COV=cov;
  delete PROJ_CACHE["joint"];
  if(MAP_PROJ==="joint" && $("#resultMap") && $("#resultMap").innerHTML){
    applyProjection("joint"); repositionMap();
  }
}
/* ---- the projection registry + current selection ---- */
const PROJECTIONS=[
  {k:"joint",   n:"Room",       fn:null,        note:"Everyone in the room is a row — you and the parties alike. The axes are shaped by the whole room's votes, so the more people vote, the more the map is the room's."},
  {k:"mds",     n:"MDS",        fn:projMDS,     note:"Classical MDS — pairwise vote distances, preserved globally."},
  {k:"pca",     n:"PCA",        fn:projPCA,     note:"Principal components of the raw vote matrix."},
  {k:"ca",      n:"CA",         fn:projCA,      note:"Correspondence analysis of the for / against / abstain table."},
  {k:"kpca",    n:"Kernel PCA", fn:projKPCA,    note:"Kernel PCA — gaussian kernel over vote distances."},
  {k:"smacof",  n:"SMACOF",     fn:projSMACOF,  note:"Metric MDS by stress majorization — iterative distance fit."},
  {k:"sammon",  n:"Sammon",     fn:projSammon,  note:"Sammon mapping — small distances weighted up."},
  {k:"spectral",n:"Spectral",   fn:projSpectral,note:"Laplacian eigenmaps over the vote-similarity graph."},
  {k:"tsne",    n:"t-SNE",      fn:projTSNE,    note:"t-SNE — local neighbourhoods over global shape."},
];
let MAP_PROJ="joint";          // the room map is the default; the other 8 are the bench
let PROJ_CACHE={};
function getProj(key){
  if(PROJ_CACHE[key]) return PROJ_CACHE[key];
  if(PARTIES.length<3 || !R.decisions.length) return null;
  const D=distMatrix();
  let co=null, place=null;
  if(key==="joint"){
    // parties + the room, projected together; a participant rides the same
    // MDS-aligned frame via the transform, so everyone is placed identically
    const J=projJoint();
    if(!J) return getProj("mds");                  // room too small to span 2D yet
    const ref=getProj("mds");
    const T=ref?procrustesT(J.coords,ref.coords):null;
    co=T?T.coords:J.coords;
    place=votes=>{const raw=J.project(votes); return T?T.apply(raw):raw;};
  }else{
    const def=PROJECTIONS.find(p=>p.k===key)||PROJECTIONS[1];
    try{co=def.fn(D);}catch(e){co=null;}
    if(!co || co.some(p=>!isFinite(p[0])||!isFinite(p[1]))) co=projMDS(D);   // never a broken map
    if(key!=="mds"){const ref=getProj("mds"); if(ref)co=procrustes(co,ref.coords);}
  }
  const xs=co.map(c=>c[0]),ys=co.map(c=>c[1]);
  return PROJ_CACHE[key]={coords:co, place,
    mx:{minx:Math.min(...xs),maxx:Math.max(...xs),miny:Math.min(...ys),maxy:Math.max(...ys)}};
}
function applyProjection(key){
  const P=getProj(key);
  if(!P){COORD=null;MX={};PLACE=null;return;}
  MAP_PROJ=key; COORD=P.coords; MX=P.mx; PLACE=P.place||null;
}
function rebuildMap(){
  PROJ_CACHE={}; COORD=null; MX={}; PLACE=null;
  if(PARTIES.length>=3 && R.decisions.length) applyProjection(MAP_PROJ);
}

/* ---- placement: a ballot is projected like a party — out-of-sample.

   The OLD way blended the party dots by agreement weight (the convex combination
   below). Because the weights are non-negative, the result ALWAYS lands inside the
   party hull — and since you partially agree with every party (parties share many
   votes), every party carries weight and the blend collapses toward the centroid.
   That's why a ballot sat in the middle no matter how it voted, and no projection
   could move it to a side: the parties were projected, the ballot was interpolated.

   Now a ballot is placed the way the parties were — by its real vote-distance to
   each party. We hold the party dots fixed and slide ONE point to best-fit those
   distances (single-point stress majorization / the Guttman transform — the very
   stress the map itself minimises). The weights are uniform, so the point can leave
   the hull and land right beside whichever party you actually vote with. ---- */

// a ballot's mean disagreement to each party, in the same [0,1] metric as distMatrix()
function ballotDists(votes){
  return PARTIES.map(p=>{
    let s=0,c=0;
    for(const id in votes){
      const d=byId[id]; if(!d) continue;
      const pv=voteNum((d.party_votes_canon||{})[p.token]), uv=voteNum(votes[id]);
      if(pv==null||uv==null) continue;
      s+=Math.abs(uv-pv)/2; c++;
    }
    return c?s/c:null;            // null = nothing comparable with this party
  });
}
// agreement-weighted blend of party dots — convex, so strictly inside the hull.
// kept only as the deterministic starting point for the out-of-sample solve.
function blendCoordIn(votes,coords){
  const a=affinityFor(votes);
  let wx=0,wy=0,ws=0;
  PARTIES.forEach((p,i)=>{
    const r=a[p.token]; if(!r.comp)return;
    const w=Math.pow(r.pct/100,2);
    wx+=w*coords[i][0];wy+=w*coords[i][1];ws+=w;
  });
  return ws>1e-6?[wx/ws,wy/ws]:null;
}
// out-of-sample placement: slide one point so its 2D distances to the (fixed) party
// dots match its true vote-distances — single-point SMACOF, may land outside the hull.
function projectBallotIn(votes,coords){
  const start=blendCoordIn(votes,coords);    // finite seed (inside the hull)
  if(!start) return null;
  const dd=ballotDists(votes);
  let p=start;
  for(let it=0;it<80;it++){
    let x=0,y=0,n=0;
    for(let i=0;i<PARTIES.length;i++){
      const di=dd[i]; if(di==null) continue;
      const dx=p[0]-coords[i][0], dy=p[1]-coords[i][1];
      const dist=Math.sqrt(dx*dx+dy*dy)||1e-9;
      x+=coords[i][0]+di*dx/dist; y+=coords[i][1]+di*dy/dist; n++;
    }
    if(!n) break;
    const np=[x/n,y/n];
    if(Math.abs(np[0]-p[0])+Math.abs(np[1]-p[1])<1e-6){p=np;break;}
    p=np;
  }
  return (isFinite(p[0])&&isFinite(p[1]))?p:start;
}
// any ballot → map point: the joint map projects it (PCA score, the same formula
// as a party); every other projection places it out-of-sample by vote-distance
function blendCoord(votes){
  if(!COORD) return null;
  return PLACE?PLACE(votes):projectBallotIn(votes,COORD);
}
function userCoord(){ return blendCoord(answers); }
function toPctIn(c,mx){
  // parties span [minx,maxx] → the inner [pad,1-pad] band; the pad margin is now
  // live space for ballots that project OUTSIDE the party hull. Clamp so a far
  // out-of-sample dot pins to the map edge instead of rendering off-screen.
  const pad=.17, cl=v=>Math.max(2,Math.min(98,v));
  const nx=(c[0]-mx.minx)/((mx.maxx-mx.minx)||1);
  const ny=(c[1]-mx.miny)/((mx.maxy-mx.miny)||1);
  return [cl((pad+nx*(1-2*pad))*100),cl((pad+(1-ny)*(1-2*pad))*100)];
}
function toPct(c){ return toPctIn(c,MX); }
// presence publishes a CANONICAL position so a peer's dot doesn't depend on which
// projection this device is experimenting with: the joint room frame when a room
// is active (everyone shares it), else the MDS baseline.
function publishCoord(){
  const key=(MAP_PROJ==="joint" || (typeof roomActive==="function" && roomActive()))?"joint":"mds";
  const P=getProj(key)||getProj("mds"); if(!P) return null;
  const uc=P.place?P.place(answers):projectBallotIn(answers,P.coords);
  return uc?toPctIn(uc,P.mx):null;
}

/* ---- The reveal map: parties stagger in, YOU lands last (stamp-style), peers fade in behind. ---- */
function renderResultMap(){
  const el=$("#resultMap"), picker=$("#mapProj");
  if(!COORD){el.style.display="none"; if(picker)picker.hidden=true; return;}
  el.style.display="";
  const dots=PARTIES.map((p,i)=>{
    const [l,t]=toPct(COORD[i]);
    const inner=p.her?`<span class="mc her"></span>`
              : p.logo?`<span class="mc bg-${p.token}"><img src="${p.logo}" alt="${esc(p.name)}"></span>`
                     :`<span class="mc fb" style="background:${p.color}">${p.token}</span>`;
    return `<div class="mdot" style="left:${l}%;top:${t}%;--d:${120+i*90}ms" title="${esc(p.name)}">${inner}</div>`;
  }).join("");
  const uc=userCoord();
  let userDot="";
  if(uc){const [l,t]=toPct(uc);
    // your join emoji wears the violet ring + a "you" tag; pre-join solo keeps the YOU disc
    const em=(identity&&identity.emoji)||"";
    const inner=em?`<span class="mc you">${esc(em)}</span><span class="mtag">you</span>`
                  :`<span class="mc fb">YOU</span>`;
    userDot=`<div class="mdot me" style="left:${l}%;top:${t}%;--d:${120+PARTIES.length*90+260}ms">${inner}</div>`;}
  el.innerHTML=`<span class="maptag">Closer = votes more alike</span>
    <div class="axis x"></div><div class="axis y"></div>${dots}${userDot}`;
  renderPeers();
  renderProjPicker();
}
// projection switch: same dots, new coordinates — they morph, never re-enter
function repositionMap(){
  const el=$("#resultMap");
  if(!el||!COORD) return;
  el.querySelectorAll(".mdot:not(.me)").forEach((d,i)=>{
    if(!COORD[i])return;
    const [l,t]=toPct(COORD[i]);
    d.style.left=l+"%"; d.style.top=t+"%";
  });
  const me=el.querySelector(".mdot.me"), uc=userCoord();
  if(me&&uc){const [l,t]=toPct(uc); me.style.left=l+"%"; me.style.top=t+"%";}
  renderPeers();
}
function renderProjPicker(){
  const el=$("#mapProj"); if(!el) return;
  if(!COORD){el.hidden=true;return;}
  el.hidden=false;
  const cur=PROJECTIONS.find(p=>p.k===MAP_PROJ)||PROJECTIONS[0];
  el.innerHTML=`<div class="mp-row">`+PROJECTIONS.map(p=>
      `<button type="button" class="mp-chip${p.k===MAP_PROJ?" on":""}" data-proj="${p.k}">${p.n}</button>`
    ).join("")+`</div>
    <p class="mp-note">${cur.note}</p>`;
}
(function(){
  const el=document.getElementById("mapProj"); if(!el)return;
  el.addEventListener("click",e=>{
    const b=e.target.closest("[data-proj]"); if(!b)return;
    if(b.dataset.proj===MAP_PROJ)return;
    applyProjection(b.dataset.proj);
    // update in place — rebuilding the row would reset its horizontal scroll
    el.querySelectorAll(".mp-chip").forEach(c=>c.classList.toggle("on",c.dataset.proj===MAP_PROJ));
    const cur=PROJECTIONS.find(p=>p.k===MAP_PROJ), note=el.querySelector(".mp-note");
    if(cur&&note) note.textContent=cur.note;
    repositionMap();
  });
})();
