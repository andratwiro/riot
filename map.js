/* RIOT viewer — the affinity map (reveal-only): MDS of party vote-distances
   (jacobi eigensolver), user placement, the big result map. The map never
   appears in the voting flow — it is the payoff of the reveal, animated into
   place dot by dot. Loads after app.js. */
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
// classical MDS of parties from pairwise vote-disagreement distance
function partyMap(){
  const ps=PARTIES,n=ps.length;
  const num=v=>v==="for"?1:v==="against"?-1:v==="abstain"?0:null;
  const D2=Array.from({length:n},()=>Array(n).fill(0));
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
    let s=0,c=0;
    for(const d of R.decisions){
      const pv=d.party_votes_canon||{};
      const vi=num(pv[ps[i].token]),vj=num(pv[ps[j].token]);
      if(vi==null||vj==null)continue;
      s+=Math.abs(vi-vj)/2;c++;
    }
    const dist=c?s/c:0.5;
    D2[i][j]=D2[j][i]=dist*dist;
  }
  const rm=Array(n).fill(0);let gm=0;
  for(let i=0;i<n;i++){for(let j=0;j<n;j++)rm[i]+=D2[i][j];rm[i]/=n;gm+=rm[i];}
  gm/=n;
  const B=Array.from({length:n},()=>Array(n).fill(0));
  for(let i=0;i<n;i++)for(let j=0;j<n;j++)B[i][j]=-0.5*(D2[i][j]-rm[i]-rm[j]+gm);
  const {values,vectors}=jacobi(B);
  const ord=values.map((_,i)=>i).sort((x,y)=>values[y]-values[x]);
  const k1=ord[0],k2=ord[1];
  const s1=Math.sqrt(Math.max(0,values[k1])),s2=Math.sqrt(Math.max(0,values[k2]));
  return PARTIES.map((_,i)=>[vectors[i][k1]*s1,vectors[i][k2]*s2]);
}
// user position = agreement-weighted blend of party positions
function userCoord(){
  const a=affinity();
  let wx=0,wy=0,wsum=0;
  PARTIES.forEach((p,i)=>{
    const r=a[p.token];
    if(!r.comp)return;
    const w=Math.pow(r.pct/100,2);
    wx+=w*COORD[i][0];wy+=w*COORD[i][1];wsum+=w;
  });
  return wsum>1e-6?[wx/wsum,wy/wsum]:null;
}
function toPct(c){
  const pad=.17;
  const nx=(c[0]-MX.minx)/((MX.maxx-MX.minx)||1);
  const ny=(c[1]-MX.miny)/((MX.maxy-MX.miny)||1);
  return [(pad+nx*(1-2*pad))*100,(pad+(1-ny)*(1-2*pad))*100];
}
// The reveal map: parties stagger in, YOU lands last (stamp-style), peers fade in behind.
function renderResultMap(){
  const el=$("#resultMap");
  if(!COORD){el.style.display="none";return;}
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
    userDot=`<div class="mdot me" style="left:${l}%;top:${t}%;--d:${120+PARTIES.length*90+260}ms"><span class="mc fb">YOU</span></div>`;}
  el.innerHTML=`<span class="maptag">Closer = votes more alike</span>
    <div class="axis x"></div><div class="axis y"></div>${dots}${userDot}`;
  renderPeers();
}
function rebuildMap(){
  COORD=null; MX={};
  if(PARTIES.length>=3 && R.decisions.length){
    COORD=partyMap();
    const xs=COORD.map(c=>c[0]),ys=COORD.map(c=>c[1]);
    MX={minx:Math.min(...xs),maxx:Math.max(...xs),miny:Math.min(...ys),maxy:Math.max(...ys)};
  }
}
