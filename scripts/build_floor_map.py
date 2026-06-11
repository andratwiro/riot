"""Build the opinion-map data for deliberate.html (the floor, demo page).

Simulates the deliberation room for the MP-pay card — 21,384 residents drawn
from four latent opinion groups, each resident a 14-dim response vector
(13 statements + the headline ballot, coded disagree/pass/agree = -1/0/+1) —
then computes a 2D PCA projection offline and ships everything the page
renders as precomputed JSON (deliberate-data.js):

  - pca mean + components (so the page can project the USER's own responses)
  - ~1,500 sampled citizen points (texture) + a density grid (the mass)
  - cluster centroids, shares and plain-language labels
  - the parties, projected through the SAME model from illustrative stance
    vectors (inferred from public positions on A-103 — demo data, labeled so)
  - the representation-gap stats (per-party distance to the nearest citizen
    mass; share of residents closer to no party than to any party)

Everything is illustrative and reproducible: fixed seed, stdlib only.
Run:  python3 scripts/build_floor_map.py   (writes deliberate-data.js)
"""
import json, math, random

random.seed(2026)

N = 21384
SAMPLE = 1500
GRID_W, GRID_H = 44, 32

SIDS = ["s1","s2","s3","s4","s5","s6","s7","s8","s9","s10","s11","s12","s13"]
DIMS = SIDS + ["ballot"]

# stance -> response probabilities (disagree, pass, agree)
P = {1: (.10,.15,.75), 0: (.25,.50,.25), -1: (.75,.15,.10)}

GROUPS = [
  dict(id="g1", share=.38,
       label="The transparency-first bloc",
       sub="Backs the cut but calls 5% theatre — wants the parliament's own spending published, line by line.",
       stmts=["s1","s2","s3"],
       st={"s1":1,"s2":1,"s3":1,"s4":1,"s5":-1,"s6":0,"s7":1,"s8":-1,"s9":0,"s10":1,"s11":0,"s12":1,"s13":0},
       ballot=(.15,.25,.60)),
  dict(id="g2", share=.30,
       label="Symbolic-cut supporters",
       sub="€7,000 a month is the argument: cut 5%, make it permanent, top-ups included.",
       stmts=["s9","s6","s7"],
       st={"s1":1,"s2":0,"s3":1,"s4":-1,"s5":-1,"s6":1,"s7":1,"s8":-1,"s9":1,"s10":0,"s11":0,"s12":1,"s13":-1},
       ballot=(.03,.02,.95)),
  dict(id="g3", share=.20,
       label="Fair-pay sceptics",
       sub="Against the cut — decent pay keeps the mandate open beyond the wealthy; align with other parliaments instead.",
       stmts=["s5","s8"],
       st={"s1":1,"s2":0,"s3":0,"s4":0,"s5":1,"s6":-1,"s7":0,"s8":1,"s9":-1,"s10":0,"s11":0,"s12":0,"s13":1},
       ballot=(.80,.10,.10)),
  dict(id="g4", share=.12,
       label="Deeper-cut radicals",
       sub="5% is nothing against a €1.6 bn deficit — halve the pay, cut the seats.",
       stmts=["s4","s11"],
       st={"s1":1,"s2":1,"s3":1,"s4":1,"s5":-1,"s6":1,"s7":1,"s8":-1,"s9":1,"s10":1,"s11":1,"s12":1,"s13":-1},
       ballot=(.01,.01,.98)),
]

# Illustrative party stances on the same dims, inferred from public positions
# in the A-103 debate (CRI 10 Jul 2025). 0 / absent = no clear stance.
PARTIES = [
 dict(id="ptb",  name="PTB",   st={"s1":1,"s3":1,"s4":1,"s5":-1,"s6":1,"s7":1,"s8":-1,"s9":1,"s10":1,"s11":1,"s12":1,"s13":-1,"ballot":1}),
 dict(id="ps",   name="PS",    st={"s4":-1,"s5":1,"s6":-1,"s8":1,"s9":-1,"s11":-1,"ballot":-1}),
 dict(id="mr",   name="MR",    st={"s2":-1,"s3":-1,"s4":-1,"s5":1,"s6":-1,"s7":-1,"s8":1,"s9":-1,"s10":-1,"s11":-1,"s12":-1,"ballot":-1}),
 dict(id="ecolo",name="Ecolo", st={"s1":1,"s3":1,"s6":1,"s7":1,"ballot":0}),
 dict(id="groen",name="Groen", st={"s1":1,"s8":1,"ballot":0}),
 dict(id="defi", name="DéFI",  st={"s1":1,"s11":1,"ballot":0}),
 dict(id="le",   name="LE",    st={"s4":-1,"s5":1,"s6":-1,"s8":1,"s9":-1,"ballot":-1}),
 dict(id="vld",  name="VLD",   st={"s2":-1,"s4":-1,"s5":1,"s6":-1,"s7":-1,"s8":1,"s9":-1,"s12":-1,"ballot":-1}),
 dict(id="nva",  name="N-VA",  st={"s4":1,"s10":1,"s11":1,"ballot":0}),
]

def draw(probs):
    r = random.random()
    return -1 if r < probs[0] else (0 if r < probs[0]+probs[1] else 1)

# ---- simulate ----
residents, group_of = [], []
for gi, g in enumerate(GROUPS):
    n = round(N * g["share"])
    for _ in range(n):
        v = [draw(P[g["st"][s]]) for s in SIDS] + [draw(g["ballot"])]
        residents.append(v); group_of.append(gi)
n_real = len(residents)

# ---- PCA: covariance + power iteration with deflation ----
D = len(DIMS)
mean = [sum(r[i] for r in residents)/n_real for i in range(D)]
C = [[0.0]*D for _ in range(D)]
for r in residents:
    c = [r[i]-mean[i] for i in range(D)]
    for i in range(D):
        for j in range(i, D):
            C[i][j] += c[i]*c[j]
for i in range(D):
    for j in range(i, D):
        C[i][j] /= n_real; C[j][i] = C[i][j]

def top_eig(M, iters=600):
    v = [random.random()-.5 for _ in range(D)]
    for _ in range(iters):
        w = [sum(M[i][j]*v[j] for j in range(D)) for i in range(D)]
        nrm = math.sqrt(sum(x*x for x in w)) or 1.0
        v = [x/nrm for x in w]
    lam = sum(v[i]*sum(M[i][j]*v[j] for j in range(D)) for i in range(D))
    return lam, v

M = [row[:] for row in C]
comps, lams = [], []
for _ in range(2):
    lam, v = top_eig(M)
    lams.append(lam); comps.append(v)
    for i in range(D):
        for j in range(D):
            M[i][j] -= lam*v[i]*v[j]

def project(vec):
    c = [vec[i]-mean[i] for i in range(D)]
    return [sum(c[i]*w[i] for i in range(D)) for w in comps]

pts = [project(r) for r in residents]

# orient: x grows with the ballot (For right), y puts the largest group up
bi = DIMS.index("ballot")
if comps[0][bi] < 0:
    comps[0] = [-w for w in comps[0]]; pts = [[-p[0], p[1]] for p in pts]
g1pts = [p for p, gi in zip(pts, group_of) if gi == 0]
g1y = sum(p[1] for p in g1pts)/len(g1pts)
ally = sum(p[1] for p in pts)/n_real
if g1y > ally:   # screen y grows downward — flip so g1 renders in the upper half
    comps[1] = [-w for w in comps[1]]; pts = [[p[0], -p[1]] for p in pts]

party_xy = [project([p["st"].get(d, 0) for d in DIMS]) for p in PARTIES]
# re-apply the orientation flips baked into comps
party_xy = [[sum((PARTIES[k]["st"].get(DIMS[i], 0)-mean[i])*comps[a][i] for i in range(D))
             for a in (0, 1)] for k in range(len(PARTIES))]

# ---- normalize everything (citizens + parties) into the unit box ----
allx = [p[0] for p in pts] + [p[0] for p in party_xy]
ally_ = [p[1] for p in pts] + [p[1] for p in party_xy]
mnx, mxx, mny, mxy = min(allx), max(allx), min(ally_), max(ally_)
MARG = .07
def norm(p):
    return [MARG + (p[0]-mnx)/(mxx-mnx)*(1-2*MARG),
            MARG + (p[1]-mny)/(mxy-mny)*(1-2*MARG)]
pts_n = [norm(p) for p in pts]
party_n = [norm(p) for p in party_xy]

# ---- clusters: centroid + share (clusters ARE the latent groups) ----
clusters = []
for gi, g in enumerate(GROUPS):
    gp = [p for p, k in zip(pts_n, group_of) if k == gi]
    cx = sum(p[0] for p in gp)/len(gp); cy = sum(p[1] for p in gp)/len(gp)
    clusters.append(dict(id=g["id"], label=g["label"], sub=g["sub"],
                         share=round(g["share"]*100), cx=round(cx,3), cy=round(cy,3),
                         stmts=g["stmts"]))

# ---- density grid over the unit box, from ALL residents ----
grid = [[0]*GRID_W for _ in range(GRID_H)]
for p in pts_n:
    i = min(GRID_W-1, int(p[0]*GRID_W)); j = min(GRID_H-1, int(p[1]*GRID_H))
    grid[j][i] += 1
gmax = max(max(row) for row in grid)
density = [[i, j, round(grid[j][i]/gmax, 2)]
           for j in range(GRID_H) for i in range(GRID_W)
           if grid[j][i]/gmax >= .02]

# ---- the representation gap ----
def dist(a, b): return math.hypot(a[0]-b[0], a[1]-b[1])
cents = [(c["cx"], c["cy"]) for c in clusters]
for k, p in enumerate(PARTIES):
    ds = [dist(party_n[k], c) for c in cents]
    near = min(range(len(ds)), key=lambda i: ds[i])
    p["x"], p["y"] = round(party_n[k][0],3), round(party_n[k][1],3)
    p["near"] = clusters[near]["label"]
    p["dist"] = round(ds[near]*100)

# share of residents closer to no party than to any party:
# nearest party farther away than their own opinion group's centre
closer_none = 0
for p, gi in zip(pts_n, group_of):
    dparty = min(dist(p, q) for q in [(pp["x"], pp["y"]) for pp in PARTIES])
    if dparty > dist(p, cents[gi]):
        closer_none += 1
gap_share = round(closer_none/n_real*100/5)*5   # round numbers only

# headline: is any party inside the largest group's mass?
big = max(range(len(clusters)), key=lambda i: clusters[i]["share"])
bigpts = [p for p, k in zip(pts_n, group_of) if k == big]
radii = sorted(dist(p, cents[big]) for p in bigpts)
r50 = radii[len(radii)//2]
inside = [p["name"] for p in PARTIES if dist((p["x"],p["y"]), cents[big]) <= r50]
headline = ("No party sits inside the room's largest opinion group."
            if not inside else
            f"Only {', '.join(inside)} sits inside the room's largest opinion group.")

# ---- sample points for rendering ----
idx = random.sample(range(n_real), SAMPLE)
sample = [[round(pts_n[i][0],3), round(pts_n[i][1],3), group_of[i]] for i in idx]

out = dict(
    note="Generated by scripts/build_floor_map.py — simulated, illustrative. "
         "Party positions inferred from public stances on A-103, demo only.",
    dims=DIMS,
    mean=[round(m,4) for m in mean],
    comps=[[round(w,4) for w in c] for c in comps],
    box=dict(mnx=round(mnx,4), mxx=round(mxx,4), mny=round(mny,4), mxy=round(mxy,4), marg=MARG),
    pts=sample,
    density=density, gw=GRID_W, gh=GRID_H,
    clusters=clusters,
    parties=[dict(id=p["id"], name=p["name"], x=p["x"], y=p["y"],
                  near=p["near"], dist=p["dist"], st=p["st"]) for p in PARTIES],
    gapShare=gap_share,
    headline=headline,
)
js = "/* GENERATED by scripts/build_floor_map.py — do not edit by hand. */\n" \
     "window.FLOOR_MAP=" + json.dumps(out, separators=(",", ":"), ensure_ascii=False) + ";\n"
with open("deliberate-data.js", "w") as f:
    f.write(js)

# ---- summary for the operator ----
print(f"residents {n_real} · sample {SAMPLE} · density cells {len(density)}")
print(f"explained λ1={lams[0]:.3f} λ2={lams[1]:.3f}")
for c in clusters:
    print(f"  {c['id']} {c['share']:>2}%  ({c['cx']:.2f},{c['cy']:.2f})  {c['label']}")
for p in PARTIES:
    print(f"  {p['name']:<6} ({p['x']:.2f},{p['y']:.2f})  d={p['dist']:>2} → {p['near']}")
print(f"gapShare {gap_share}% · headline: {headline}")
print(f"file size {len(js)/1024:.0f} KB")
