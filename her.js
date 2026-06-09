/* her.js — the "Her" (2013) OS1 mark, as RIOT's AI-proxy identity.
 *
 * Faithful port of psyonline's OS1 recreation (https://codepen.io/psyonline/pen/yayYWg,
 * Three.js). The tube geometry is STATIC — a fixed 3D figure-eight/helix. The circle⇄
 * figure-eight read comes from rotating the whole group; the "finish" turns it edge-on
 * and fades in a flat ring (the clean "O"). Original was tap-to-finish; here it auto-cycles.
 *
 * window.HerOS1.mount(container, opts) -> { canvas, start, stop, dispose }
 *   opts: size, line(0xRRGGBB), coral('#hex'), holdTop, holdBottom (frames), alpha(bool)
 * HerOS1.supported is false if Three.js / WebGL is absent (callers fall back to static SVG).
 */
(function(){
  "use strict";
  var THREE = window.THREE;
  var webgl = (function(){ try{ var c=document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl")||c.getContext("experimental-webgl"))); }
    catch(e){ return false; } })();
  var supported = !!THREE && webgl;

  var PI2 = Math.PI*2, LENGTH = 30, RADIUS = 5.6, ROTATE = 0.035;
  var instances = [], raf = null;

  // verbatim from the original
  function easing(t,b,c,d){ if((t/=d/2)<1) return c/2*t*t+b; return c/2*((t-=2)*t*t+2)+b; }

  function loop(){
    raf = requestAnimationFrame(loop);
    if(document.hidden) return;
    for(var i=0;i<instances.length;i++) instances[i]._frame();
  }

  // verbatim parametric curve (the OS1 tube centreline)
  function newCurve(){
    return new (THREE.Curve.create(function(){}, function(percent){
      var x = LENGTH*Math.sin(PI2*percent),
          y = RADIUS*Math.cos(PI2*3*percent),
          z, t;
      t = percent%0.25/0.25;
      t = percent%0.25-(2*(1-t)*t* -0.0185 + t*t*0.25);
      if (Math.floor(percent/0.25) == 0 || Math.floor(percent/0.25) == 2) t *= -1;
      z = RADIUS*Math.sin(PI2*2*(percent-t));
      return new THREE.Vector3(x, y, z);
    }))();
  }

  function mount(container, opts){
    if(!supported) return null;
    opts = opts || {};
    var size  = opts.size || 500;
    var coral = opts.coral || "#d1684e";
    var line  = opts.line != null ? opts.line : 0xffffff;

    var camera = new THREE.PerspectiveCamera(65, 1, 1, 10000);
    camera.position.z = opts.dist || 150;
    var scene = new THREE.Scene();
    var group = new THREE.Group();
    scene.add(group);

    var mesh = new THREE.Mesh(
      new THREE.TubeGeometry(newCurve(), 200, 1.1, 2, true),
      new THREE.MeshBasicMaterial({ color: line })
    );
    group.add(mesh);

    var ringcover = new THREE.Mesh(new THREE.PlaneGeometry(50, 15, 1),
      new THREE.MeshBasicMaterial({ color: coral, opacity: 0, transparent: true }));
    ringcover.position.x = LENGTH+1; ringcover.rotation.y = Math.PI/2; group.add(ringcover);

    var ring = new THREE.Mesh(new THREE.RingGeometry(4.3, 5.55, 32),
      new THREE.MeshBasicMaterial({ color: line, opacity: 0, transparent: true }));
    ring.position.x = LENGTH+1.1; ring.rotation.y = Math.PI/2; group.add(ring);

    // fake shadow — stacked translucent coral planes for depth
    for(var i=0;i<10;i++){
      var plain = new THREE.Mesh(new THREE.PlaneGeometry(LENGTH*2+1, RADIUS*3, 1),
        new THREE.MeshBasicMaterial({ color: coral, transparent: true, opacity: 0.13 }));
      plain.position.z = -2.5 + i*0.5; group.add(plain);
    }

    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: !!opts.alpha });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
    renderer.setSize(size, size);
    if(!opts.alpha) renderer.setClearColor(coral);

    var inst = {
      canvas: renderer.domElement,
      running: true,
      animatestep: 0, acceleration: 0, toend: false, hold: 0,
      holdTop: opts.holdTop != null ? opts.holdTop : 12,      // frames resting as the "O"
      holdBottom: opts.holdBottom != null ? opts.holdBottom : 24 // frames resting as the spinning helix
    };

    inst._frame = function(){
      if(!inst.running) return;
      // auto-cycle: ping-pong toend with a short hold at each end (was mousedown/up)
      if(inst.toend){ if(inst.animatestep>=240 && ++inst.hold>=inst.holdTop){ inst.toend=false; inst.hold=0; } }
      else          { if(inst.animatestep<=0   && ++inst.hold>=inst.holdBottom){ inst.toend=true;  inst.hold=0; } }

      mesh.rotation.x += ROTATE + inst.acceleration;

      // render() — verbatim
      inst.animatestep = Math.max(0, Math.min(240, inst.toend ? inst.animatestep+1 : inst.animatestep-4));
      inst.acceleration = easing(inst.animatestep, 0, 1, 240);
      if(inst.acceleration > 0.35){
        var progress = (inst.acceleration-0.35)/0.65;
        group.rotation.y = -Math.PI/2 * progress;
        group.position.z = 50 * progress;
        progress = Math.max(0, (inst.acceleration-0.97)/0.03);
        mesh.material.opacity = 1-progress;
        ringcover.material.opacity = ring.material.opacity = progress;
        ring.scale.x = ring.scale.y = 0.9 + 0.1*progress;
      }
      renderer.render(scene, camera);
    };

    inst.start   = function(){ inst.running = true; };
    inst.stop    = function(){ inst.running = false; };
    inst.resize  = function(s){ renderer.setSize(s, s); };
    inst.dispose = function(){
      inst.running = false;
      var k = instances.indexOf(inst); if(k>=0) instances.splice(k,1);
      try{
        mesh.geometry.dispose(); mesh.material.dispose();
        ring.geometry.dispose(); ring.material.dispose();
        ringcover.geometry.dispose(); ringcover.material.dispose();
        if(renderer.forceContextLoss) renderer.forceContextLoss();
        renderer.dispose();
      }catch(e){}
      if(inst.canvas && inst.canvas.parentNode) inst.canvas.parentNode.removeChild(inst.canvas);
    };

    if(container) container.appendChild(inst.canvas);
    instances.push(inst);
    inst._frame();
    if(!raf) raf = requestAnimationFrame(loop);
    return inst;
  }

  window.HerOS1 = { supported: supported, mount: mount, COLORS: { coral:"#d1684e", line:0xffffff } };
})();
