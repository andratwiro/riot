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
   orientation — switching then shows structure, not an arbitrary spin ---- */
function procrustes(B,A){
  const n=A.length;
  const cen=M=>{let mx=0,my=0;for(const p of M){mx+=p[0];my+=p[1];}mx/=n;my/=n;
    return M.map(p=>[p[0]-mx,p[1]-my]);};
  const A0=cen(A),B0=cen(B);
  const nrm=M=>Math.sqrt(M.reduce((s,p)=>s+p[0]*p[0]+p[1]*p[1],0))||1;
  const k=nrm(A0)/nrm(B0);
  const fit=M=>{
    let num=0,den=0;
    for(let i=0;i<n;i++){num+=M[i][0]*A0[i][1]-M[i][1]*A0[i][0];den+=M[i][0]*A0[i][0]+M[i][1]*A0[i][1];}
    const th=Math.atan2(num,den),c=Math.cos(th),s=Math.sin(th);
    const R=M.map(p=>[c*p[0]-s*p[1],s*p[0]+c*p[1]]);
    let err=0;for(let i=0;i<n;i++)err+=(R[i][0]-A0[i][0])**2+(R[i][1]-A0[i][1])**2;
    return {R,err};
  };
  const Bs=B0.map(p=>[p[0]*k,p[1]*k]);
  const f1=fit(Bs), f2=fit(Bs.map(p=>[p[0],-p[1]]));   // try the mirror too
  return (f2.err<f1.err?f2:f1).R;
}

/* ---- the projection registry + current selection ---- */
const PROJECTIONS=[
  {k:"mds",     n:"MDS",        fn:projMDS,     note:"Classical MDS — pairwise vote distances, preserved globally."},
  {k:"pca",     n:"PCA",        fn:projPCA,     note:"Principal components of the raw vote matrix."},
  {k:"ca",      n:"CA",         fn:projCA,      note:"Correspondence analysis of the for / against / abstain table."},
  {k:"kpca",    n:"Kernel PCA", fn:projKPCA,    note:"Kernel PCA — gaussian kernel over vote distances."},
  {k:"smacof",  n:"SMACOF",     fn:projSMACOF,  note:"Metric MDS by stress majorization — iterative distance fit."},
  {k:"sammon",  n:"Sammon",     fn:projSammon,  note:"Sammon mapping — small distances weighted up."},
  {k:"spectral",n:"Spectral",   fn:projSpectral,note:"Laplacian eigenmaps over the vote-similarity graph."},
  {k:"tsne",    n:"t-SNE",      fn:projTSNE,    note:"t-SNE — local neighbourhoods over global shape."},
];
let MAP_PROJ="mds";
let PROJ_CACHE={};
function getProj(key){
  if(PROJ_CACHE[key]) return PROJ_CACHE[key];
  if(PARTIES.length<3 || !R.decisions.length) return null;
  const def=PROJECTIONS.find(p=>p.k===key)||PROJECTIONS[0];
  const D=distMatrix();
  let co=null;
  try{co=def.fn(D);}catch(e){co=null;}
  if(!co || co.some(p=>!isFinite(p[0])||!isFinite(p[1]))) co=projMDS(D);   // never a broken map
  if(def.k!=="mds"){const ref=getProj("mds"); if(ref)co=procrustes(co,ref.coords);}
  const xs=co.map(c=>c[0]),ys=co.map(c=>c[1]);
  return PROJ_CACHE[key]={coords:co,
    mx:{minx:Math.min(...xs),maxx:Math.max(...xs),miny:Math.min(...ys),maxy:Math.max(...ys)}};
}
function applyProjection(key){
  const P=getProj(key);
  if(!P){COORD=null;MX={};return;}
  MAP_PROJ=key; COORD=P.coords; MX=P.mx;
}
function rebuildMap(){
  PROJ_CACHE={}; COORD=null; MX={};
  if(PARTIES.length>=3 && R.decisions.length) applyProjection(MAP_PROJ);
}

/* ---- placement: any ballot record → agreement-weighted blend of party dots ---- */
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
function blendCoord(votes){ return COORD?blendCoordIn(votes,COORD):null; }
function userCoord(){ return blendCoord(answers); }
function toPctIn(c,mx){
  const pad=.17;
  const nx=(c[0]-mx.minx)/((mx.maxx-mx.minx)||1);
  const ny=(c[1]-mx.miny)/((mx.maxy-mx.miny)||1);
  return [(pad+nx*(1-2*pad))*100,(pad+(1-ny)*(1-2*pad))*100];
}
function toPct(c){ return toPctIn(c,MX); }
// presence publishes the CANONICAL (MDS) position — a peer's published dot must
// not depend on which projection this device is experimenting with
function publishCoord(){
  const P=getProj("mds"); if(!P) return null;
  const uc=blendCoordIn(answers,P.coords);
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
