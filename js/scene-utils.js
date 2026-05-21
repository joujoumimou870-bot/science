/*
 * scene-utils.js — Hyper-realistic PBR rendering helpers.
 * MeshPhysicalMaterial throughout: clearcoat, sheen, transmission,
 * subsurface scattering simulation, advanced lighting.
 */

/* ═══════════════════════════════════════════════
   MATERIAL LIBRARY
════════════════════════════════════════════════ */

/**
 * phys(props) — Drop-in upgrade for MeshStandardMaterial.
 * Auto-injects clearcoat defaults smart enough to match the surface type.
 * Lesson files just call  phys({ color:..., roughness:... })
 */
function phys(props) {
  props = props || {};
  var rough = props.roughness !== undefined ? props.roughness : 0.5;
  var isTransp = (props.transparent || (props.opacity !== undefined && props.opacity < 1));

  // Rough organic surfaces (soil, bark, stone) → minimal sheen
  var cc     = (rough > 0.75) ? 0.08 : (rough > 0.55) ? 0.25 : 0.50;
  var ccR    = (rough > 0.75) ? 0.60 : (rough > 0.55) ? 0.40 : 0.22;

  // Transparent membranes → glossy
  if (isTransp && props.opacity !== undefined && props.opacity < 0.5) {
    cc = 0.85; ccR = 0.08;
  }

  // Honour explicit overrides
  if (props.clearcoat          !== undefined) cc  = props.clearcoat;
  if (props.clearcoatRoughness !== undefined) ccR = props.clearcoatRoughness;

  var merged = {};
  for (var k in props) merged[k] = props[k];
  merged.clearcoat          = cc;
  merged.clearcoatRoughness = ccR;
  return new THREE.MeshPhysicalMaterial(merged);
}

/* Human skin — clearcoat + warm emissive hint */
function matSkin(color) {
  return new THREE.MeshPhysicalMaterial({
    color:               color || 0xf0c8a0,
    roughness:           0.50,
    metalness:           0.0,
    clearcoat:           0.42,
    clearcoatRoughness:  0.28,
    emissive:            0x180800,
    emissiveIntensity:   0.08,
  });
}

/* Darker skin tone (joints, soles) */
function matSkinDark(color) {
  return new THREE.MeshPhysicalMaterial({
    color:               color || 0xd4a07a,
    roughness:           0.54,
    metalness:           0.0,
    clearcoat:           0.32,
    clearcoatRoughness:  0.35,
    emissive:            0x100400,
    emissiveIntensity:   0.06,
  });
}

/* Internal organ — wet, slightly specular */
function matOrgan(color, opts) {
  opts = opts || {};
  return new THREE.MeshPhysicalMaterial({
    color:               color,
    roughness:           opts.roughness !== undefined ? opts.roughness : 0.38,
    metalness:           0.0,
    clearcoat:           opts.clearcoat !== undefined ? opts.clearcoat : 0.60,
    clearcoatRoughness:  opts.ccRough   !== undefined ? opts.ccRough   : 0.16,
    emissive:            opts.emissive  !== undefined ? opts.emissive  : 0x000000,
    emissiveIntensity:   opts.ei        !== undefined ? opts.ei        : 0.0,
    transparent:         opts.opacity   !== undefined && opts.opacity < 1,
    opacity:             opts.opacity   !== undefined ? opts.opacity   : 1.0,
    side:                opts.side      !== undefined ? opts.side      : THREE.FrontSide,
  });
}

/* Blood vessel — ultra-glossy like real endothelium */
function matBlood(isArtery) {
  return new THREE.MeshPhysicalMaterial({
    color:               isArtery ? 0xdd1111 : 0x1133bb,
    roughness:           0.18,
    metalness:           0.0,
    clearcoat:           0.90,
    clearcoatRoughness:  0.08,
    emissive:            isArtery ? 0x350000 : 0x00002a,
    emissiveIntensity:   0.16,
  });
}

/* Bone — matte ivory with faint sheen */
function matBone(color) {
  return new THREE.MeshPhysicalMaterial({
    color:               color || 0xf0e8d0,
    roughness:           0.65,
    metalness:           0.0,
    clearcoat:           0.18,
    clearcoatRoughness:  0.50,
    emissive:            new THREE.Color(0x111005),
    emissiveIntensity:   0.04,
  });
}

/* Glass / membrane — transmission for real translucency (r128 compatible) */
function matGlass(color, opacity, opts) {
  opts = opts || {};
  return new THREE.MeshPhysicalMaterial({
    color:               color,
    roughness:           opts.roughness    !== undefined ? opts.roughness    : 0.06,
    metalness:           0.0,
    clearcoat:           0.90,
    clearcoatRoughness:  0.04,
    transmission:        opts.transmission !== undefined ? opts.transmission : 0.88,
    thickness:           opts.thickness    !== undefined ? opts.thickness    : 1.4,
    transparent:         true,
    opacity:             opacity           !== undefined ? opacity           : 0.35,
    side:                opts.side         !== undefined ? opts.side         : THREE.DoubleSide,
  });
}

/* Cell organelle — bright, juicy */
function matOrganelle(color, opts) {
  opts = opts || {};
  return new THREE.MeshPhysicalMaterial({
    color:               color,
    roughness:           opts.roughness !== undefined ? opts.roughness : 0.28,
    metalness:           0.0,
    clearcoat:           opts.clearcoat !== undefined ? opts.clearcoat : 0.70,
    clearcoatRoughness:  0.12,
    emissive:            color,
    emissiveIntensity:   opts.ei        !== undefined ? opts.ei        : 0.18,
    transparent:         opts.opacity   !== undefined && opts.opacity < 1,
    opacity:             opts.opacity   !== undefined ? opts.opacity   : 1.0,
  });
}

/* Backward-compatible aliases */
function matStd(color, opts) { return matOrgan(color, opts); }
function matPhong(color, opts) {
  opts = opts || {};
  if (opts.shininess !== undefined) {
    opts.roughness = Math.max(0.10, 1.0 - opts.shininess / 130.0);
    delete opts.shininess;
  }
  return matOrgan(color, opts);
}

/* ── Geometry shortcuts ───────────────────────── */
function mkSphere(r, color, opts) {
  opts = opts || {};
  return new THREE.Mesh(new THREE.SphereGeometry(r, opts.seg || 32, opts.seg || 32), matOrgan(color, opts));
}
function mkCyl(rtop, rbot, h, color, opts) {
  opts = opts || {};
  return new THREE.Mesh(new THREE.CylinderGeometry(rtop, rbot, h, opts.seg || 18), matOrgan(color, opts));
}
function mkCapsule(r, len, color, opts) {
  var g   = new THREE.Group();
  var mat = matOrgan(color, opts);
  var cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 14), mat);
  var top = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 14), mat.clone());
  top.position.y = len / 2;
  var bot = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 14), mat.clone());
  bot.position.y = -len / 2;
  g.add(cyl, top, bot);
  return g;
}
function mkTube(points, radius, color, opts) {
  opts = opts || {};
  var curve = new THREE.CatmullRomCurve3(points);
  return new THREE.Mesh(
    new THREE.TubeGeometry(curve, opts.seg || 20, radius, opts.radSeg || 10, false),
    matOrgan(color, opts)
  );
}

/* ═══════════════════════════════════════════════
   PREMIUM LIGHTING
════════════════════════════════════════════════ */
function setupSceneLighting(scene) {
  /* Warm hemisphere — sky top, auburn ground */
  scene.add(new THREE.HemisphereLight(0x2244aa, 0x5a2800, 1.2));

  /* Key spot — warm, soft-shadow */
  var key = new THREE.SpotLight(0xfff3e0, 5.5);
  key.position.set(5, 10, 8);
  key.castShadow              = true;
  key.shadow.mapSize.width    = 2048;
  key.shadow.mapSize.height   = 2048;
  key.shadow.bias             = -0.0004;
  key.shadow.camera.near      = 1;
  key.shadow.camera.far       = 38;
  key.angle                   = Math.PI / 5;
  key.penumbra                = 0.45;
  scene.add(key);

  /* Cool-blue fill from left */
  var fill = new THREE.DirectionalLight(0x4488ff, 1.6);
  fill.position.set(-8, 3, 6);
  scene.add(fill);

  /* Teal rim backlight — makes clearcoat pop */
  var rim = new THREE.PointLight(0x00e8b8, 4.5, 28);
  rim.position.set(0, 2, -10);
  scene.add(rim);

  /* Purple under-fill for depth on lower organs */
  var under = new THREE.PointLight(0x4400cc, 1.4, 20);
  under.position.set(0, -10, 4);
  scene.add(under);

  /* Soft frontal fill */
  var front = new THREE.PointLight(0xffffff, 0.7, 16);
  front.position.set(0, 2, 10);
  scene.add(front);

  /* Warm top-left point for skin warmth */
  var warm = new THREE.PointLight(0xff8844, 1.0, 22);
  warm.position.set(-4, 8, 4);
  scene.add(warm);
}

/* ── Part tagging ─────────────────────────────── */
function tagPart(mesh, nameAr, descAr) {
  mesh.userData.nameAr = nameAr;
  mesh.userData.descAr = descAr;
  return mesh;
}
function tagPartGroup(meshes, nameAr, descAr) {
  meshes.forEach(function(m) { tagPart(m, nameAr, descAr); });
}

/* ── Info-box helpers ─────────────────────────── */
function showPartInfo(nameAr, descAr) {
  var box = document.getElementById('part-info');
  var nm  = document.getElementById('part-name');
  var ds  = document.getElementById('part-desc');
  if (!box || !nm || !ds) return;
  nm.textContent = nameAr;
  ds.textContent = descAr;
  box.style.display = 'block';
}
function hidePartInfo() {
  var box = document.getElementById('part-info');
  if (box) box.style.display = 'none';
}

/* ── Click / highlight interaction ───────────────── */
function enablePartClick(renderer, camera, root, onHit, onMiss) {
  var raycaster       = new THREE.Raycaster();
  var mouse           = new THREE.Vector2();
  var lastHighlighted = [];
  var origColors      = new Map();

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
        origColors.set(obj,         obj.material.emissive ? obj.material.emissive.getHex() : 0x000000);
        origColors.set(obj + '_ei', obj.material.emissiveIntensity || 0);
      }
      obj.material.emissive.setHex(0xffcc00);
      obj.material.emissiveIntensity = 0.8;
      lastHighlighted.push(obj);
    });
  }

  renderer.domElement.addEventListener('click', function(e) {
    var rect  = renderer.domElement.getBoundingClientRect();
    mouse.x   =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    mouse.y   = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    var hits  = raycaster.intersectObject(root, true);
    var hit   = null;
    for (var i = 0; i < hits.length; i++) {
      if (hits[i].object.userData && hits[i].object.userData.nameAr) { hit = hits[i].object; break; }
    }
    if (hit) { highlightByName(hit.userData.nameAr); if (onHit) onHit(hit.userData.nameAr, hit.userData.descAr); }
    else      { clearHighlight(); if (onMiss) onMiss(); }
  });

  return { clearHighlight: clearHighlight };
}

/* ── Auto-rotate button ───────────────────────── */
function bindAutoRotate(btnId, ctx) {
  var btn = document.getElementById(btnId);
  if (!btn || !ctx) return;
  btn.addEventListener('click', function() {
    ctx.autoRotateOn = !ctx.autoRotateOn;
    btn.classList.toggle('active', ctx.autoRotateOn);
    btn.textContent = ctx.autoRotateOn ? 'إيقاف التدوير' : 'تدوير تلقائي';
  });
}

/* ── Anatomy label overlay ────────────────────── */
function createAnatomyLabels(overlayId) {
  var overlay = document.getElementById(overlayId || 'label-overlay');
  var entries = [];
  return {
    add: function(mesh, text, offset) {
      if (!overlay) return;
      var el = document.createElement('div');
      el.className  = 'anatomy-label';
      el.innerHTML  = '<span class="anatomy-label-line"></span><span class="anatomy-label-text">' + text + '</span>';
      overlay.appendChild(el);
      entries.push({ mesh: mesh, el: el, offset: offset || new THREE.Vector3(0, 0.15, 0) });
    },
    update: function(camera, canvas) {
      if (!overlay || !canvas) return;
      var rect = canvas.getBoundingClientRect();
      var v    = new THREE.Vector3();
      entries.forEach(function(entry) {
        if (!entry.mesh.parent) { entry.el.style.display = 'none'; return; }
        v.copy(entry.offset);
        entry.mesh.localToWorld(v);
        v.project(camera);
        var x = (v.x * 0.5 + 0.5) * rect.width;
        var y = (-v.y * 0.5 + 0.5) * rect.height;
        if (v.z > 1) { entry.el.style.display = 'none'; return; }
        entry.el.style.display = 'flex';
        entry.el.style.left    = x + 'px';
        entry.el.style.top     = y + 'px';
      });
    },
    clear: function() {
      entries.forEach(function(e) { if (e.el.parentNode) e.el.parentNode.removeChild(e.el); });
      entries = [];
    }
  };
}

/* ═══════════════════════════════════════════════
   ANATOMICAL BUILDERS
════════════════════════════════════════════════ */

/* ── Heart ─────────────────────────────────────── */
function buildHeart(group, opts) {
  opts = opts || {};
  var hG = new THREE.Group();

  var mat  = matOrgan(0xb82c2c, { clearcoat: 0.72, ccRough: 0.12, emissive: 0x280000, ei: 0.18 });
  var matD = matOrgan(0x8b1a1a, { clearcoat: 0.65, ccRough: 0.16, emissive: 0x1a0000, ei: 0.12 });

  var lv = new THREE.Mesh(new THREE.SphereGeometry(0.55, 44, 44), mat);
  lv.scale.set(0.88, 1.30, 0.82); lv.position.set(-0.14, -0.10, 0.05); lv.rotation.z = 0.18;
  var rv = new THREE.Mesh(new THREE.SphereGeometry(0.44, 36, 36), matD.clone());
  rv.scale.set(0.70, 1.05, 0.68); rv.position.set(0.24, -0.05, 0.14); rv.rotation.z = -0.22;
  var la = new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 32), mat.clone());
  la.scale.set(0.92, 0.82, 0.88); la.position.set(-0.24, 0.54, -0.06);
  var ra = new THREE.Mesh(new THREE.SphereGeometry(0.31, 32, 32), matD.clone());
  ra.scale.set(0.85, 0.78, 0.82); ra.position.set(0.30, 0.50, 0.02);
  hG.add(lv, rv, la, ra);

  /* Aorta */
  var aortaMat   = matBlood(true);
  var aortaCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.06, 0.70, 0.04), new THREE.Vector3(-0.04, 1.02, 0.06),
    new THREE.Vector3( 0.12, 1.22, 0.02), new THREE.Vector3( 0.38, 1.18, -0.06),
    new THREE.Vector3( 0.48, 0.88, -0.12),
  ]);
  hG.add(new THREE.Mesh(new THREE.TubeGeometry(aortaCurve, 24, 0.11, 16, false), aortaMat));

  /* Pulmonary trunk */
  var pulmMat   = matBlood(false);
  var pulmCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.18, 0.54, 0.14), new THREE.Vector3(0.26, 0.78, 0.12),
    new THREE.Vector3(0.22, 0.96, 0.04), new THREE.Vector3(-0.04, 1.06, -0.02),
  ]);
  hG.add(new THREE.Mesh(new THREE.TubeGeometry(pulmCurve, 18, 0.09, 14, false), pulmMat));

  /* SVC */
  var svc = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.52, 14), matBlood(false));
  svc.position.set(0.34, 0.88, 0.02); hG.add(svc);

  /* Coronary arteries */
  var corMat = matBlood(true);
  var rcaCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.05, 0.56, 0.32), new THREE.Vector3(0.32, 0.32, 0.44),
    new THREE.Vector3(0.44, 0.0,  0.32), new THREE.Vector3(0.32, -0.32, 0.22),
    new THREE.Vector3(0.12, -0.55, 0.18),
  ]);
  hG.add(new THREE.Mesh(new THREE.TubeGeometry(rcaCurve, 20, 0.032, 8, false), corMat));
  var ladCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.04, 0.58, 0.34), new THREE.Vector3(-0.12, 0.32, 0.42),
    new THREE.Vector3(-0.18, 0.00, 0.40), new THREE.Vector3(-0.14, -0.38, 0.30),
  ]);
  hG.add(new THREE.Mesh(new THREE.TubeGeometry(ladCurve, 16, 0.028, 8, false), corMat.clone()));

  /* Pericardium sac — glassy outer membrane */
  var peri = new THREE.Mesh(new THREE.SphereGeometry(0.90, 36, 36),
    matGlass(0xff8888, 0.12, { roughness: 0.10, transmission: 0.80, thickness: 0.6 }));
  peri.scale.set(1.0, 1.35, 0.92);
  hG.add(peri);

  var ud = { nameAr: opts.nameAr || 'القلب ❤️', descAr: opts.descAr || 'القلب عضلة مجوفة تضخّ الدم إلى جميع أنحاء الجسم. ينبض نحو 70 مرة في الدقيقة ويضخّ 5 لترات كل دقيقة!' };
  hG.children.forEach(function(c) { if (c.isMesh) tagPart(c, ud.nameAr, ud.descAr); });
  hG.userData.pulse = { min: 0.93, max: 1.07, speed: 3.6 };
  group.add(hG);
  return hG;
}

/* ── Lungs ─────────────────────────────────────── */
function buildLungs(group, opts) {
  opts = opts || {};
  var lG      = new THREE.Group();
  var lungMat = matOrgan(0xcc6878, { roughness: 0.55, clearcoat: 0.50, ccRough: 0.22, emissive: 0x1a0008, ei: 0.10 });

  var llU = new THREE.Mesh(new THREE.SphereGeometry(0.44, 36, 36), lungMat);
  llU.scale.set(0.75, 1.05, 0.65); llU.position.set(-0.98, 0.40, -0.04);
  var llL = new THREE.Mesh(new THREE.SphereGeometry(0.48, 36, 36), lungMat.clone());
  llL.scale.set(0.80, 1.15, 0.70); llL.position.set(-0.98, -0.42, 0.02);
  var rlU = new THREE.Mesh(new THREE.SphereGeometry(0.42, 36, 36), lungMat.clone());
  rlU.scale.set(0.75, 0.92, 0.65); rlU.position.set(0.98, 0.48, -0.04);
  var rlM = new THREE.Mesh(new THREE.SphereGeometry(0.32, 28, 28), lungMat.clone());
  rlM.scale.set(0.72, 0.72, 0.62); rlM.position.set(0.98, 0.06, 0.10);
  var rlL = new THREE.Mesh(new THREE.SphereGeometry(0.45, 36, 36), lungMat.clone());
  rlL.scale.set(0.80, 1.08, 0.70); rlL.position.set(0.98, -0.48, 0.02);

  var trMat = matOrgan(0xfde68a, { roughness: 0.40, clearcoat: 0.45, ccRough: 0.28 });
  var tr    = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.095, 0.85, 18), trMat);
  tr.position.y = 1.05;
  var lBr = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.068, 0.52, 14), trMat.clone());
  lBr.position.set(-0.38, 0.63, 0); lBr.rotation.z = 0.62;
  var rBr = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.072, 0.48, 14), trMat.clone());
  rBr.position.set(0.34, 0.66, 0); rBr.rotation.z = -0.55;

  /* Pleural membrane — glassy wrap */
  var plL = new THREE.Mesh(new THREE.SphereGeometry(0.50, 28, 28),
    matGlass(0xffccdd, 0.10, { roughness: 0.08, transmission: 0.82, thickness: 0.5 }));
  plL.scale.set(0.78, 2.28, 0.75); plL.position.set(-0.98, -0.01, -0.01);
  var plR = plL.clone(); plR.position.x = 0.98;
  lG.add(plL, plR);

  lG.add(llU, llL, rlU, rlM, rlL, tr, lBr, rBr);

  var ud = { nameAr: opts.nameAr || 'الرئتان 🫁', descAr: opts.descAr || 'الرئتان تمتصّان الأكسجين وتطردان ثاني أكسيد الكربون. تحتويان 300 مليون حويصلة هوائية!' };
  [llU, llL, rlU, rlM, rlL].forEach(function(m) {
    tagPart(m, ud.nameAr, ud.descAr);
    m.userData._baseScale = m.scale.clone();
  });
  tagPartGroup([tr, lBr, rBr], 'القصبة الهوائية 🌬️', 'أنبوب ينقل الهواء من الحنجرة إلى الرئتين. مدعوم بحلقات غضروفية صلبة.');

  group.add(lG);
  return { lungL: llL, lungR: rlL, group: lG };
}

/* ── Lung breathing animation ─────────────────── */
function animateLungs(lungL, lungR, t) {
  var breath = 1 + 0.13 * Math.sin(t * 1.45);
  function doAnim(m) {
    if (!m) return;
    if (m.userData && m.userData._baseScale) {
      var b = m.userData._baseScale;
      m.scale.set(b.x * breath, b.y * breath, b.z * breath);
    }
    if (m.children) m.children.forEach(doAnim);
  }
  doAnim(lungL); doAnim(lungR);
}

/* ── Stomach ───────────────────────────────────── */
function buildStomach(group, opts) {
  opts = opts || {};
  var stom = new THREE.Mesh(new THREE.SphereGeometry(0.56, 36, 36),
    matOrgan(0x6fa35a, { roughness: 0.48, clearcoat: 0.55, ccRough: 0.20, emissive: 0x091a04, ei: 0.10 }));
  stom.scale.set(1.25, 0.88, 0.78);
  stom.position.set(opts.x || 0.38, opts.y || -1.28, 0.02);
  stom.rotation.z = -0.18;
  tagPart(stom, opts.nameAr || 'المعدة 🫃', opts.descAr || 'كيس عضلي يخلط الطعام بعصارة حمضية ويهضمه خلال 2–4 ساعات.');
  group.add(stom);
  return stom;
}

/* ── Brain ─────────────────────────────────────── */
function buildBrain(group, opts) {
  opts = opts || {};
  var bG   = new THREE.Group();
  var bMat = matOrgan(0xd4a0a0, { roughness: 0.58, clearcoat: 0.45, ccRough: 0.30, emissive: 0x1a0808, ei: 0.08 });

  var lH = new THREE.Mesh(new THREE.SphereGeometry(0.55, 44, 44), bMat);
  lH.scale.set(0.90, 0.88, 1.05); lH.position.set(-0.28, 0, 0);
  var rH = new THREE.Mesh(new THREE.SphereGeometry(0.55, 44, 44), bMat.clone());
  rH.scale.set(0.90, 0.88, 1.05); rH.position.set(0.28, 0, 0);
  var cb = new THREE.Mesh(new THREE.SphereGeometry(0.30, 32, 32), bMat.clone());
  cb.scale.set(1.2, 0.7, 0.85); cb.position.set(0, -0.42, -0.52);
  var bs = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.13, 0.42, 16),
    matOrgan(0xc49090, { roughness: 0.62 }));
  bs.position.set(0, -0.68, -0.28); bs.rotation.x = 0.38;
  bG.add(lH, rH, cb, bs);

  /* Denser gyri for realism */
  var gyriPos = [
    [-0.40, 0.20, 0.40], [-0.20, 0.38, 0.36], [0, 0.44, 0.30],
    [ 0.20, 0.38, 0.36], [ 0.40, 0.20, 0.40], [-0.52, 0.0,  0.28],
    [ 0.52, 0.0,  0.28], [-0.36,-0.22, 0.42], [ 0.36,-0.22, 0.42],
    [-0.28, 0.28, 0.44], [ 0.28, 0.28, 0.44], [ 0.0,  0.10, 0.52],
  ];
  gyriPos.forEach(function(p) {
    var g = new THREE.Mesh(new THREE.SphereGeometry(0.10, 16, 16), bMat.clone());
    g.position.set(p[0], p[1], p[2]);
    bG.add(g);
    tagPart(g, opts.nameAr || 'الدماغ 🧠', opts.descAr || 'مركز التحكم في الجسم. يستقبل إشارات الحواس ويتحكّم في الحركة والتفكير والذاكرة.');
  });

  /* Dura mater — outer glassy membrane */
  var dura = new THREE.Mesh(new THREE.SphereGeometry(0.68, 36, 36),
    matGlass(0xffddcc, 0.08, { roughness: 0.12, transmission: 0.78, thickness: 0.5 }));
  bG.add(dura);

  var ud = { nameAr: opts.nameAr || 'الدماغ 🧠', descAr: opts.descAr || 'مركز التحكم في الجسم. يستقبل إشارات الحواس ويتحكّم في الحركة والتفكير والذاكرة.' };
  [lH, rH, cb, bs].forEach(function(m) { tagPart(m, ud.nameAr, ud.descAr); });

  group.add(bG);
  return bG;
}

/* ═══════════════════════════════════════════════
   initScene — main entry point
════════════════════════════════════════════════ */
function initScene(canvasId, buildScene, opts) {
  opts = opts || {};
  var canvas = document.getElementById(canvasId);
  if (!canvas) { console.warn('Canvas not found:', canvasId); return null; }

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: false, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled          = true;
  renderer.shadowMap.type             = THREE.PCFSoftShadowMap;
  /* physicallyCorrectLights deliberately OFF — clearcoat/sheen/transmission
     work without it, and enabling it would require 1000× higher light values */
  renderer.toneMapping                = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure        = 1.20;
  renderer.outputEncoding             = THREE.sRGBEncoding;

  var scene  = new THREE.Scene();
  scene.background = new THREE.Color(0x060c1a);
  scene.fog        = new THREE.FogExp2(0x060c1a, 0.016);

  var camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / (canvas.clientHeight || 1), 0.1, 200);
  camera.position.set(0, 0, opts.cameraZ !== undefined ? opts.cameraZ : 5);

  setupSceneLighting(scene);

  /* Shadow ground (invisible) */
  var ground = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ color: 0x060c1a, roughness: 1, transparent: true, opacity: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -5.5;
  ground.receiveShadow = true;
  scene.add(ground);

  var group  = new THREE.Group();
  scene.add(group);

  var labels = createAnatomyLabels(opts.labelOverlayId);
  var ctx    = {
    autoRotateOn:    false,
    autoRotateSpeed: opts.autoRotateSpeed !== undefined ? opts.autoRotateSpeed : 0.005,
    labels:          labels,
    clickApi:        null
  };

  buildScene(group, THREE, { renderer: renderer, camera: camera, scene: scene, labels: labels, ctx: ctx });

  function onResize() {
    var w = canvas.clientWidth, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  onResize();
  window.addEventListener('resize', onResize);

  /* Mouse / touch orbit */
  var dragging = false, lastX = 0, lastY = 0;
  canvas.addEventListener('mousedown', function(e) { dragging = true; lastX = e.clientX; lastY = e.clientY; });
  window.addEventListener('mouseup',   function()  { dragging = false; });
  window.addEventListener('mousemove', function(e) {
    if (!dragging) return;
    var dx = e.clientX - lastX, dy = e.clientY - lastY;
    group.rotation.y += dx * 0.011;
    group.rotation.x  = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, group.rotation.x + dy * 0.011));
    lastX = e.clientX; lastY = e.clientY;
  });
  canvas.addEventListener('touchstart', function(e) { dragging = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; }, { passive: true });
  canvas.addEventListener('touchend',   function()  { dragging = false; });
  canvas.addEventListener('touchmove',  function(e) {
    if (!dragging) return;
    var dx = e.touches[0].clientX - lastX, dy = e.touches[0].clientY - lastY;
    group.rotation.y += dx * 0.011;
    group.rotation.x  = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, group.rotation.x + dy * 0.011));
    lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
  }, { passive: true });
  canvas.addEventListener('wheel', function(e) {
    camera.position.z = Math.max(1.5, Math.min(22, camera.position.z + e.deltaY * 0.01));
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
        var o = obj.userData.orbit, a = t * o.speed + (o.phase || 0);
        obj.position.x = Math.cos(a) * o.radius;
        obj.position.y = Math.sin(a) * o.radius * (o.tilt || 1);
        obj.position.z = Math.sin(a + 0.5) * (o.z || 0.3);
      }
      if (obj.userData.rainFall) {
        obj.position.y -= obj.userData.rainSpeed * 0.016;
        if (obj.position.y < obj.userData.rainMin) obj.position.y = obj.userData.rainMax;
      }
      if (obj.userData.spinY) obj.rotation.y += obj.userData.spinY;
      if (obj.userData.wobble) {
        obj.rotation.z = Math.sin(t * obj.userData.wobble.speed) * obj.userData.wobble.amp;
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

  return { scene: scene, group: group, camera: camera, renderer: renderer, labels: labels, ctx: ctx, time: function() { return t; } };
}

function setupLessonScene() { hidePartInfo(); }

/* ── Homepage mini-scenes ─────────────────────── */
function miniScene(canvasId, buildFn, rotSpeed) {
  rotSpeed = rotSpeed || 0.008;
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping                = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure        = 1.15;
  renderer.outputEncoding             = THREE.sRGBEncoding;

  var scene  = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
  camera.position.z = 4.5;
  setupSceneLighting(scene);
  var group = new THREE.Group();
  scene.add(group);
  buildFn(group, THREE);

  function resize() {
    var w = canvas.clientWidth, h = canvas.clientHeight || 160;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  var t = 0;
  (function loop() {
    requestAnimationFrame(loop);
    t += 0.016;
    group.rotation.y += rotSpeed;
    group.traverse(function(obj) {
      if (!obj.userData) return;
      if (obj.userData.pulse) {
        var p = obj.userData.pulse, s = p.min + (p.max - p.min) * (0.5 + 0.5 * Math.sin(t * p.speed));
        obj.scale.setScalar(s);
      }
      if (obj.userData.floatY !== undefined) obj.position.y = obj.userData.floatBase + Math.sin(t * obj.userData.floatY) * obj.userData.floatAmp;
    });
    renderer.render(scene, camera);
  })();
}

/* ── Quiz binding ─────────────────────────────── */
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
