/*
 * scene-utils.js — Plain JS helpers (no ES modules).
 * Requires THREE via classic <script> before this file.
 */

function setupSceneLighting(scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  var key = new THREE.DirectionalLight(0xfff5e0, 1.2);
  key.position.set(3, 5, 4);
  scene.add(key);
  var fill = new THREE.DirectionalLight(0xa0c4ff, 0.5);
  fill.position.set(-4, 0, -3);
  scene.add(fill);
  var rim = new THREE.PointLight(0x00c9a7, 0.8, 10);
  rim.position.set(0, -3, -3);
  scene.add(rim);
}

function matPhong(color, opts) {
  opts = opts || {};
  return new THREE.MeshPhongMaterial({
    color: color,
    shininess: opts.shininess || 60,
    transparent: !!opts.opacity,
    opacity: opts.opacity !== undefined ? opts.opacity : 1,
    emissive: opts.emissive || 0x000000,
    emissiveIntensity: opts.ei || 0
  });
}

function tagPart(mesh, nameAr, descAr) {
  mesh.userData.nameAr = nameAr;
  mesh.userData.descAr = descAr;
  return mesh;
}

function tagPartGroup(meshes, nameAr, descAr) {
  meshes.forEach(function(m) { tagPart(m, nameAr, descAr); });
}

function showPartInfo(nameAr, descAr) {
  var box = document.getElementById('part-info');
  var nm = document.getElementById('part-name');
  var ds = document.getElementById('part-desc');
  if (!box || !nm || !ds) return;
  nm.textContent = nameAr;
  ds.textContent = descAr;
  box.style.display = 'block';
}

function hidePartInfo() {
  var box = document.getElementById('part-info');
  if (box) box.style.display = 'none';
}

function enablePartClick(renderer, camera, root, onHit, onMiss) {
  var raycaster = new THREE.Raycaster();
  var mouse = new THREE.Vector2();
  var lastHighlighted = [];
  var origColors = new Map();

  function clearHighlight() {
    lastHighlighted.forEach(function(mesh) {
      if (mesh.material && mesh.material.emissive) {
        mesh.material.emissive.setHex(origColors.get(mesh) || 0x000000);
        mesh.material.emissiveIntensity = origColors.get(mesh + '_ei') || 0;
      }
    });
    lastHighlighted = [];
  }

  function highlightByName(nameAr) {
    clearHighlight();
    root.traverse(function(obj) {
      if (!obj.isMesh || !obj.userData.nameAr || obj.userData.nameAr !== nameAr) return;
      if (!origColors.has(obj)) {
        origColors.set(obj, obj.material.emissive ? obj.material.emissive.getHex() : 0x000000);
        origColors.set(obj + '_ei', obj.material.emissiveIntensity || 0);
      }
      obj.material.emissive.setHex(0xffd700);
      obj.material.emissiveIntensity = 0.6;
      lastHighlighted.push(obj);
    });
  }

  renderer.domElement.addEventListener('click', function(e) {
    var rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    var hits = raycaster.intersectObject(root, true);
    var hit = null;
    for (var i = 0; i < hits.length; i++) {
      if (hits[i].object.userData && hits[i].object.userData.nameAr) {
        hit = hits[i].object;
        break;
      }
    }

    if (hit) {
      highlightByName(hit.userData.nameAr);
      if (onHit) onHit(hit.userData.nameAr, hit.userData.descAr);
    } else {
      clearHighlight();
      if (onMiss) onMiss();
    }
  });

  return { clearHighlight: clearHighlight };
}

function bindAutoRotate(btnId, ctx) {
  var btn = document.getElementById(btnId);
  if (!btn || !ctx) return;
  btn.addEventListener('click', function() {
    ctx.autoRotateOn = !ctx.autoRotateOn;
    btn.classList.toggle('active', ctx.autoRotateOn);
    btn.textContent = ctx.autoRotateOn ? 'إيقاف التدوير' : 'تدوير تلقائي';
  });
}

function createAnatomyLabels(overlayId) {
  var overlay = document.getElementById(overlayId || 'label-overlay');
  var entries = [];

  return {
    add: function(mesh, text, offset) {
      if (!overlay) return;
      var el = document.createElement('div');
      el.className = 'anatomy-label';
      el.innerHTML = '<span class="anatomy-label-line"></span><span class="anatomy-label-text">' + text + '</span>';
      overlay.appendChild(el);
      entries.push({
        mesh: mesh,
        el: el,
        offset: offset || new THREE.Vector3(0, 0.15, 0)
      });
    },
    update: function(camera, canvas) {
      if (!overlay || !canvas) return;
      var rect = canvas.getBoundingClientRect();
      var v = new THREE.Vector3();
      entries.forEach(function(entry) {
        if (!entry.mesh.parent) { entry.el.style.display = 'none'; return; }
        v.copy(entry.offset);
        entry.mesh.localToWorld(v);
        v.project(camera);
        var x = (v.x * 0.5 + 0.5) * rect.width;
        var y = (-v.y * 0.5 + 0.5) * rect.height;
        if (v.z > 1) { entry.el.style.display = 'none'; return; }
        entry.el.style.display = 'flex';
        entry.el.style.left = x + 'px';
        entry.el.style.top = y + 'px';
      });
    },
    clear: function() {
      entries.forEach(function(e) { if (e.el.parentNode) e.el.parentNode.removeChild(e.el); });
      entries = [];
    }
  };
}

/* ── Anatomical builders ─────────────────────── */
function buildHeart(group, opts) {
  opts = opts || {};
  var heartGroup = new THREE.Group();
  var red = matPhong(0xc0392b, { shininess: 70 });
  var h1 = new THREE.Mesh(new THREE.SphereGeometry(0.5, 28, 28), red);
  h1.position.set(-0.18, 0.12, 0);
  h1.rotation.z = 0.35;
  h1.rotation.x = 0.35;
  var h2 = new THREE.Mesh(new THREE.SphereGeometry(0.5, 28, 28), red.clone());
  h2.position.set(0.18, 0.12, 0);
  h2.rotation.z = -0.35;
  h2.rotation.x = 0.35;
  var hBot = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.01, 0.55, 20), red.clone());
  hBot.position.y = -0.38;
  hBot.rotation.z = 0.1;
  var aorta = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.5, 12), matPhong(0xa93226));
  aorta.position.set(0.1, 0.62, 0);
  heartGroup.add(h1, h2, hBot, aorta);
  var ud = {
    nameAr: opts.nameAr || 'القلب ❤️',
    descAr: opts.descAr || 'القلب عضلة مجوفة تضخ الدم إلى جميع أنحاء الجسم. ينبض القلب حوالي 100,000 مرة في اليوم الواحد!'
  };
  tagPartGroup([h1, h2, hBot, aorta], ud.nameAr, ud.descAr);
  heartGroup.userData.pulse = { min: 0.92, max: 1.08, speed: 3.5 };
  group.add(heartGroup);
  return heartGroup;
}

function buildLungs(group, opts) {
  opts = opts || {};
  var lungMat = matPhong(0xe8a0b0, { shininess: 45 });
  var lungL = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 24), lungMat);
  lungL.scale.set(0.8, 1.6, 0.7);
  lungL.position.set(-1.05, 0.05, 0);
  var lungR = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 24), lungMat.clone());
  lungR.scale.set(0.8, 1.6, 0.7);
  lungR.position.set(1.05, 0.05, 0);
  var ud = {
    nameAr: opts.nameAr || 'الرئتان 🫁',
    descAr: opts.descAr || 'الرئتان عضوان إسفنجيان يمتصّان الأكسجين من الهواء ويطردان ثاني أكسيد الكربون عند كل زفير.'
  };
  tagPart(lungL, ud.nameAr, ud.descAr);
  tagPart(lungR, ud.nameAr, ud.descAr);
  lungL.userData._baseScale = lungL.scale.clone();
  lungR.userData._baseScale = lungR.scale.clone();
  group.add(lungL, lungR);
  return { lungL: lungL, lungR: lungR };
}

function buildStomach(group, opts) {
  opts = opts || {};
  var stom = new THREE.Mesh(new THREE.SphereGeometry(0.52, 24, 24), matPhong(0x7daa6e));
  stom.scale.set(1.2, 0.85, 0.75);
  stom.position.set(opts.x || 0.35, opts.y || -1.25, 0);
  tagPart(stom, opts.nameAr || 'المعدة 🫃', opts.descAr || 'المعدة كيس عضلي يخلط الطعام بعصارة حمضية ويهضمه قبل إرساله إلى الأمعاء.');
  group.add(stom);
  return stom;
}

function animateLungs(lungL, lungR, t) {
  var breath = 1 + 0.1 * Math.sin(t * 1.8);
  if (lungL && lungL.userData._baseScale) {
    var b = lungL.userData._baseScale;
    lungL.scale.set(b.x * breath, b.y * breath, b.z * breath);
  }
  if (lungR && lungR.userData._baseScale) {
    var b2 = lungR.userData._baseScale;
    lungR.scale.set(b2.x * breath, b2.y * breath, b2.z * breath);
  }
}

function mkSphere(r, color, opts) {
  opts = opts || {};
  return new THREE.Mesh(
    new THREE.SphereGeometry(r, opts.seg || 28, opts.seg || 28),
    matPhong(color, opts)
  );
}

function mkCyl(rtop, rbot, h, color, opts) {
  opts = opts || {};
  return new THREE.Mesh(
    new THREE.CylinderGeometry(rtop, rbot, h, opts.seg || 16),
    matPhong(color, opts)
  );
}

function mkCapsule(r, len, color, opts) {
  var g = new THREE.Group();
  var mat = matPhong(color, opts);
  var cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), mat);
  var top = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 12), mat.clone());
  top.position.y = len / 2;
  var bot = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 12), mat.clone());
  bot.position.y = -len / 2;
  g.add(cyl, top, bot);
  return g;
}

function initScene(canvasId, buildScene, opts) {
  opts = opts || {};
  var canvas = document.getElementById(canvasId);
  if (!canvas) { console.warn('Canvas not found:', canvasId); return null; }

  var cameraZ = opts.cameraZ !== undefined ? opts.cameraZ : 5;
  var autoRotateSpeed = opts.autoRotateSpeed !== undefined ? opts.autoRotateSpeed : 0;

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / (canvas.clientHeight || 1), 0.1, 1000);
  camera.position.set(0, 0, cameraZ);

  setupSceneLighting(scene);

  var group = new THREE.Group();
  scene.add(group);

  var labels = createAnatomyLabels(opts.labelOverlayId);
  var ctx = {
    autoRotateOn: false,
    autoRotateSpeed: opts.autoRotateSpeed !== undefined ? opts.autoRotateSpeed : 0.005,
    labels: labels,
    clickApi: null
  };

  buildScene(group, THREE, {
    renderer: renderer,
    camera: camera,
    scene: scene,
    labels: labels,
    ctx: ctx
  });

  function onResize() {
    var w = canvas.clientWidth, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  onResize();
  window.addEventListener('resize', onResize);

  var dragging = false, lastX = 0, lastY = 0;
  canvas.addEventListener('mousedown', function(e) { dragging = true; lastX = e.clientX; lastY = e.clientY; });
  window.addEventListener('mouseup', function() { dragging = false; });
  window.addEventListener('mousemove', function(e) {
    if (!dragging) return;
    var dx = e.clientX - lastX, dy = e.clientY - lastY;
    group.rotation.y += dx * 0.012;
    group.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, group.rotation.x + dy * 0.012));
    lastX = e.clientX; lastY = e.clientY;
  });
  canvas.addEventListener('touchstart', function(e) {
    dragging = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
  }, { passive: true });
  canvas.addEventListener('touchend', function() { dragging = false; });
  canvas.addEventListener('touchmove', function(e) {
    if (!dragging) return;
    var dx = e.touches[0].clientX - lastX, dy = e.touches[0].clientY - lastY;
    group.rotation.y += dx * 0.012;
    group.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, group.rotation.x + dy * 0.012));
    lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
  }, { passive: true });
  canvas.addEventListener('wheel', function(e) {
    camera.position.z = Math.max(1.5, Math.min(20, camera.position.z + e.deltaY * 0.01));
    e.preventDefault();
  }, { passive: false });

  var t = 0;
  function animate() {
    requestAnimationFrame(animate);
    t += 0.016;
    if (ctx.autoRotateOn && !dragging) group.rotation.y += ctx.autoRotateSpeed;
    group.traverse(function(obj) {
      if (!obj.userData) return;
      if (obj.userData.pulse) {
        var p = obj.userData.pulse;
        var s = p.min + (p.max - p.min) * (0.5 + 0.5 * Math.sin(t * p.speed));
        obj.scale.setScalar(s);
      }
      if (obj.userData.floatY !== undefined) {
        obj.position.y = obj.userData.floatBase + Math.sin(t * obj.userData.floatY) * obj.userData.floatAmp;
      } else if (obj.userData.floatSpeed !== undefined && obj.userData.floatBase !== undefined) {
        obj.position.y = obj.userData.floatBase + Math.sin(t * obj.userData.floatSpeed) * (obj.userData.floatAmp || 0.12);
      }
      if (obj.userData.orbit) {
        var o = obj.userData.orbit;
        var a = t * o.speed + (o.phase || 0);
        obj.position.x = Math.cos(a) * o.radius;
        obj.position.y = Math.sin(a) * o.radius * (o.tilt || 1);
        obj.position.z = Math.sin(a + 0.5) * (o.z || 0.3);
      }
      if (obj.userData.rainFall) {
        obj.position.y -= obj.userData.rainSpeed * 0.016;
        if (obj.position.y < obj.userData.rainMin) {
          obj.position.y = obj.userData.rainMax;
        }
      }
    });
    if (opts.onAnimate) opts.onAnimate(t, group, scene, camera, ctx);
    labels.update(camera, canvas);
    renderer.render(scene, camera);
  }
  animate();

  ctx.clickApi = enablePartClick(renderer, camera, group,
    function(name, desc) { showPartInfo(name, desc); },
    function() { hidePartInfo(); if (ctx.clickApi) ctx.clickApi.clearHighlight(); }
  );

  bindAutoRotate('btn-auto-rotate', ctx);

  return {
    scene: scene,
    group: group,
    camera: camera,
    renderer: renderer,
    labels: labels,
    ctx: ctx,
    time: function() { return t; }
  };
}

function setupLessonScene() {
  hidePartInfo();
}

/* ── Mini-scene for homepage cards ─────────── */
function miniScene(canvasId, buildFn, rotSpeed) {
  rotSpeed = rotSpeed || 0.008;
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.z = 4.5;
  setupSceneLighting(scene);
  var group = new THREE.Group();
  scene.add(group);
  buildFn(group, THREE);

  function resize() {
    var w = canvas.clientWidth, h = canvas.clientHeight || 160;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  var t = 0;
  function loop() {
    requestAnimationFrame(loop);
    t += 0.016;
    group.rotation.y += rotSpeed;
    group.traverse(function(obj) {
      if (obj.userData && obj.userData.pulse) {
        var p = obj.userData.pulse;
        var s = p.min + (p.max - p.min) * (0.5 + 0.5 * Math.sin(t * p.speed));
        obj.scale.setScalar(s);
      }
      if (obj.userData && obj.userData.floatY !== undefined) {
        obj.position.y = obj.userData.floatBase + Math.sin(t * obj.userData.floatY) * obj.userData.floatAmp;
      }
    });
    renderer.render(scene, camera);
  }
  loop();
}

function bindQuiz() {
  document.querySelectorAll('.quiz-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (btn.disabled) return;
      document.querySelectorAll('.quiz-btn').forEach(function(b) { b.disabled = true; });
      var fb = document.getElementById('quiz-fb');
      if (btn.dataset.correct === 'true') {
        btn.classList.add('correct');
        fb.textContent = btn.getAttribute('data-fb-ok') || 'أحسنت! ✅ إجابة صحيحة!';
        fb.style.color = '#86efac';
      } else {
        btn.classList.add('wrong');
        var ok = document.querySelector('[data-correct="true"]');
        if (ok) ok.classList.add('correct');
        fb.textContent = '❌ إجابة خاطئة. الجواب الصحيح موضّح باللون الأخضر.';
        fb.style.color = '#fca5a5';
      }
    });
  });
}
