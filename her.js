/* her.js — the "Her" (2013) OS1 mark, as RIOT's AI-proxy identity.
 *
 * Faithful Three.js port of the OS1 loading animation (psyonline's recreation,
 * https://codepen.io/psyonline/pen/yayYWg): a thin cream tube whose centreline is
 * a circle at morph=0 and twists into the wide weaving figure-eight / helix at
 * morph=1, spun continuously on X so it reads as a 3D helicoid that bounces back
 * to a circle. Colours are the film's coral + cream.
 *
 * window.HerOS1.mount(container, opts) -> { canvas, setMorph, start, stop, dispose }
 * Falls back gracefully: HerOS1.supported is false if Three.js / WebGL is absent.
 */
(function(){
  "use strict";
  var THREE = window.THREE;
  var webgl = (function(){ try{ var c=document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl")||c.getContext("experimental-webgl"))); }
    catch(e){ return false; } })();
  var supported = !!THREE && webgl;

  var PI2 = Math.PI*2;
  var instances = [];
  var raf = null, last = 0, FPS = 40;

  function loop(ts){
    raf = requestAnimationFrame(loop);
    if(document.hidden) return;
    if(ts - last < 1000/FPS) return;
    last = ts;
    for(var i=0;i<instances.length;i++){ if(instances[i].running) instances[i]._tick(); }
  }

  // Parametric centreline. R = ring radius; `len` = how wide it stretches when open.
  // morph 0 -> circle (x=R sin, y=R cos, z=0);  morph 1 -> long weaving figure-eight.
  function HerCurve(h){ THREE.Curve.call(this); this.h = h; }
  HerCurve.prototype = Object.create(THREE.Curve.prototype);
  HerCurve.prototype.constructor = HerCurve;
  HerCurve.prototype.getPoint = function(p){
    var h = this.h, m = h.morph, R = h.R;
    var x = (R + (h.len - R)*m) * Math.sin(PI2*p);
    var y = R * Math.cos(PI2*(1 + 2*m)*p);            // freq 1->3 grows the second lobe
    var z = R * m * Math.sin(PI2*2*(p - h.phase));     // depth weave + travelling phase
    return new THREE.Vector3(x, y, z);
  };

  function mount(container, opts){
    opts = opts || {};
    if(!supported){ return null; }
    var size   = opts.size   || 40;
    var inst = {
      R: opts.R || 5.6,
      len: opts.len || 22,
      maxMorph: opts.maxMorph != null ? opts.maxMorph : 1,
      morph: opts.morph != null ? opts.morph : 0,
      phase: 0,
      spin: opts.spin != null ? opts.spin : 0.02,
      auto: opts.autoMorph !== false,    // breathe between circle and (maxMorph) by default
      running: true,
      _u: 0
    };

    var scene  = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(50, 1, 1, 1000);
    camera.position.set(0, 0, opts.dist || 26);
    camera.lookAt(scene.position);

    var renderer = new THREE.WebGLRenderer({ alpha:true, antialias:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
    renderer.setSize(size, size);
    inst.canvas = renderer.domElement;

    var curve = new HerCurve(inst);
    var SEG = opts.segments || 150, RAD = opts.radialSegments || 8, TUBE = opts.tube || 0.5;
    function geom(){ return new THREE.TubeGeometry(curve, SEG, TUBE, RAD, true); }
    var material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(opts.line || "#f1e5c9"),
      transparent: true, opacity: opts.opacity != null ? opts.opacity : 0.95
    });
    var mesh = new THREE.Mesh(geom(), material);
    scene.add(mesh);

    inst._tick = function(){
      if(inst.auto){ inst._u += (opts.breathe || 0.012); inst.morph = inst.maxMorph * (0.5 - 0.5*Math.cos(inst._u)); }
      inst.phase += (opts.flow || 0.004);
      mesh.geometry.dispose();
      mesh.geometry = geom();
      mesh.rotation.x += inst.spin;
      renderer.render(scene, camera);
    };
    inst.setMorph = function(m){ inst.auto = false; inst.morph = Math.max(0, Math.min(inst.maxMorph, m)); };
    inst.resize  = function(s){ renderer.setSize(s, s); };
    inst.start   = function(){ inst.running = true; };
    inst.stop    = function(){ inst.running = false; };
    inst.dispose = function(){
      inst.running = false;
      var k = instances.indexOf(inst); if(k>=0) instances.splice(k,1);
      try{ mesh.geometry.dispose(); material.dispose();
        if(renderer.forceContextLoss) renderer.forceContextLoss(); renderer.dispose(); }catch(e){}
      if(inst.canvas && inst.canvas.parentNode) inst.canvas.parentNode.removeChild(inst.canvas);
    };

    if(container) container.appendChild(inst.canvas);
    instances.push(inst);
    inst._tick();                       // paint first frame immediately
    if(!raf) raf = requestAnimationFrame(loop);
    return inst;
  }

  window.HerOS1 = { supported: supported, mount: mount, COLORS: { coral:"#c0463a", cream:"#f1e5c9" } };
})();
