/**
 * demo_hero_scene.jsx — Animated photo hero scene (FREE standalone demo)
 * 照片英雄场景：边框 + 标题 + 环 + 漂浮点 + 配件，交错弹入 + 持续微动 + 3D 相机飞掠（免费 standalone demo）
 *
 * STANDALONE / 自包含: no @include, no external deps. 无 @include、无外部依赖。
 *   ASSET-OPTIONAL 资产可选: drop YOUR OWN photo (jpg/png) into ./assets/ next to this script —
 *   it auto-loads; with no photo you get a placeholder card so the demo still runs with zero assets.
 *   把你自己的图 (jpg/png) 放进脚本同目录的 ./assets/ —— 自动加载；没图则用占位卡片，无素材也能跑。
 *
 * Run / 运行 (After Effects): File > Scripts > Run Script File... > pick this file.
 *   菜单 文件 > 脚本 > 运行脚本文件，选本文件。
 *
 * Tweak / 亲手验证: drop a photo into ./assets/ (or set IMAGE_PATH), change TITLE_TEXT / palette, re-run.
 *   把图放进 ./assets/（或填 IMAGE_PATH）、改 TITLE_TEXT / 配色再跑一次，看画面随之变化。
 */

// ============================================================================
// CONFIG / 配置 —— tweak and re-run / 改这里再跑
// ============================================================================
// Photo: leave "" to auto-load the first image (jpg/png) in ./assets/ next to this script (or beside
// it); set an explicit path only to override — use forward slashes "/", e.g. "D:/photos/me.jpg" (NOT
// backslashes). The video used a Pexels photo — see assets/SOURCES.md for the download link.
// 图片：留空 = 自动用脚本同目录 ./assets/（或脚本旁）的第一张图；要覆盖才填显式路径，用正斜杠 /，别用反斜杠。
var IMAGE_PATH = "";
var TITLE_TEXT = "MEET THE STAR";             // bold title beneath the photo 图下方粗体标题

// Baked camera flythrough (one-node, Position-only Bezier). Empty array = static default camera.
// 烤好的单节点相机飞掠（仅 Position，Bezier）。空数组 = 静态默认相机。
var CAM_KEYS = [
    { t: 2.6,   pos: [0, 0, -2666.6666666], ein: 0,                eout: 2222.222222 },
    { t: 2.9,   pos: [0, 0, -2000],         ein: 2222.222222,      eout: 6280 },
    { t: 3.2,   pos: [1884, 0, -2000],      ein: 6280,             eout: 4662 },
    { t: 3.533, pos: [1884, 1554, -2000],   ein: 4662,             eout: 3103.63636363636 },
    { t: 3.9,   pos: [1884, 1554, -862],    ein: 3103.63636363636, eout: 571.604717145268 },
    { t: 4.333, pos: [2121, 1482, -862],    ein: 571.604717145268, eout: 4348.15701699518 },
    { t: 4.933, pos: [960, 540, -3000],     ein: 4348.15701699518, eout: 0 }
];
var CAM_INF = 16.666666667;

// Harmonious palette (RGB 0-1) 协调色板
var PAL = {
    bg:    [0.05, 0.06, 0.11],
    card:  [0.10, 0.11, 0.18],
    gold:  [1.00, 0.80, 0.40],
    teal:  [0.30, 0.85, 0.82],
    violet:[0.62, 0.55, 0.95],
    coral: [1.00, 0.58, 0.50],
    title: [0.96, 0.96, 0.99]
};

function smoothKeys(prop, influence) {
    var inf = influence || 70;
    for (var k = 1; k <= prop.numKeys; k++) {
        var pvt = prop.propertyValueType;
        var spatial = (pvt === PropertyValueType.TwoD_SPATIAL || pvt === PropertyValueType.ThreeD_SPATIAL);
        var dims;
        if (spatial) { dims = 1; }
        else { var kv = prop.keyValue(k); dims = (kv instanceof Array) ? kv.length : 1; }
        var ein = [], eout = [];
        for (var d = 0; d < dims; d++) { ein.push(new KeyframeEase(0, inf)); eout.push(new KeyframeEase(0, inf)); }
        prop.setTemporalEaseAtKey(k, ein, eout);
    }
}

function popIn(layer, t0, dur, targetScale) {
    var tg = layer.property("ADBE Transform Group");
    var sc = tg.property("ADBE Scale"), op = tg.property("ADBE Opacity");
    sc.setValueAtTime(t0, [0, 0]);
    sc.setValueAtTime(t0 + dur, [targetScale, targetScale]);
    op.setValueAtTime(t0, 0);
    op.setValueAtTime(t0 + dur, 100);
    smoothKeys(sc); smoothKeys(op);
}

function addGlow(layer, radius, intensity) {
    var glow = layer.property("ADBE Effect Parade").addProperty("ADBE Glo2");
    glow.property("ADBE Glo2-0002").setValue(0.0);
    glow.property("ADBE Glo2-0003").setValue(radius);
    glow.property("ADBE Glo2-0004").setValue(intensity);
}

function newShape(comp, name, pos) {
    var sl = comp.layers.addShape();
    sl.name = name; sl.threeDLayer = false;
    sl.property("ADBE Transform Group").property("ADBE Position").setValue(pos);
    return sl;
}
function grpOf(sl) {
    return sl.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
}
function addRoundRect(sl, w, h, round, fill) {
    var gc = grpOf(sl);
    var rect = gc.addProperty("ADBE Vector Shape - Rect");
    rect.property("ADBE Vector Rect Size").setValue([w, h]);
    rect.property("ADBE Vector Rect Roundness").setValue(round);
    var f = gc.addProperty("ADBE Vector Graphic - Fill");
    f.property("ADBE Vector Fill Color").setValue([fill[0], fill[1], fill[2], 1]);
}
function addRoundStroke(sl, w, h, round, col, width) {
    var gc = grpOf(sl);
    var rect = gc.addProperty("ADBE Vector Shape - Rect");
    rect.property("ADBE Vector Rect Size").setValue([w, h]);
    rect.property("ADBE Vector Rect Roundness").setValue(round);
    var s = gc.addProperty("ADBE Vector Graphic - Stroke");
    s.property("ADBE Vector Stroke Color").setValue([col[0], col[1], col[2], 1]);
    s.property("ADBE Vector Stroke Width").setValue(width);
}
function addRingStroke(sl, d, col, width) {
    var gc = grpOf(sl);
    var ell = gc.addProperty("ADBE Vector Shape - Ellipse");
    ell.property("ADBE Vector Ellipse Size").setValue([d, d]);
    var s = gc.addProperty("ADBE Vector Graphic - Stroke");
    s.property("ADBE Vector Stroke Color").setValue([col[0], col[1], col[2], 1]);
    s.property("ADBE Vector Stroke Width").setValue(width);
}
function addDot(sl, d, col) {
    var gc = grpOf(sl);
    var ell = gc.addProperty("ADBE Vector Shape - Ellipse");
    ell.property("ADBE Vector Ellipse Size").setValue([d, d]);
    var f = gc.addProperty("ADBE Vector Graphic - Fill");
    f.property("ADBE Vector Fill Color").setValue([col[0], col[1], col[2], 1]);
}

function applyCamera(comp) {
    var cam = comp.layers.addCamera("Camera 1", [comp.width / 2, comp.height / 2]); // one-node, POI null
    if (CAM_KEYS.length === 0) return cam;
    var pos = cam.property("ADBE Transform Group").property("ADBE Position");
    for (var i = 0; i < CAM_KEYS.length; i++) pos.setValueAtTime(CAM_KEYS[i].t, CAM_KEYS[i].pos);
    for (var j = 0; j < CAM_KEYS.length; j++) {
        pos.setInterpolationTypeAtKey(j + 1, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
        pos.setTemporalEaseAtKey(j + 1, [new KeyframeEase(CAM_KEYS[j].ein, CAM_INF)], [new KeyframeEase(CAM_KEYS[j].eout, CAM_INF)]);
    }
    return cam;
}

// Resolve the photo file relative to THIS script ($.fileName-derived), matching the standalone
// pack convention: explicit IMAGE_PATH wins; else first image in ./assets/, else first image
// sitting beside the script; null -> placeholder card.
// 相对本脚本解析图片（$.fileName 派生，遵循 standalone 包约定）：优先显式 IMAGE_PATH；否则取
// ./assets/ 里第一张图，再否则脚本同目录第一张图；都没有则用占位卡。
function isImage(x) { return (x instanceof File) && /\.(jpg|jpeg|png)$/i.test(x.name); }
function tryImportPhoto() {
    var f = null;
    if (IMAGE_PATH) {
        f = new File(IMAGE_PATH);
        if (!f.exists) return null;
    } else {
        var dir;
        try { dir = File($.fileName).parent; } catch (e) { return null; }
        if (!dir) return null;
        var places = [new Folder(dir.fsName + "/assets"), dir];  // ./assets/ first, then beside the script
        for (var i = 0; i < places.length && !f; i++) {
            if (!places[i].exists) continue;
            var imgs = places[i].getFiles(isImage);
            if (imgs && imgs.length) f = imgs[0];
        }
        if (!f) return null;
    }
    try { return app.project.importFile(new ImportOptions(f)); } catch (e) { return null; }
}

function main() {
    app.beginUndoGroup("Photo Hero Scene");

    var W = 1920, H = 1080, FPS = 30, DUR = 6.0;
    for (var pi = app.project.numItems; pi >= 1; pi--) {
        var it = app.project.item(pi);
        if (it instanceof CompItem && it.name === "PhotoHero") it.remove();
    }
    var comp = app.project.items.addComp("PhotoHero", W, H, 1.0, DUR, FPS);
    comp.openInViewer();
    var cx = 960, cy = 460;

    comp.layers.addSolid(PAL.bg, "bg", W, H, 1.0);

    var ringSpec = [
        { d: 980,  col: PAL.teal,   w: 3, speed: 6,  glow: 24 },
        { d: 1200, col: PAL.violet, w: 2, speed: -4, glow: 20 }
    ];
    for (var ri = 0; ri < ringSpec.length; ri++) {
        var rs = ringSpec[ri];
        var ring = newShape(comp, "ring_" + ri, [cx, cy]);
        addRingStroke(ring, rs.d, rs.col, rs.w);
        addGlow(ring, rs.glow, 1.2);
        ring.property("ADBE Transform Group").property("ADBE Opacity").setValue(45);
        ring.property("ADBE Transform Group").property("ADBE Rotate Z").expression = "time * " + rs.speed + ";";
        popIn(ring, 0.70 + ri * 0.15, 0.6, 100);
    }

    var desiredH = 720, margin = 44;
    var photo = tryImportPhoto();
    var photoAspect = photo ? (photo.width / photo.height) : (4680 / 7032);  // placeholder uses portrait ratio
    var photoW = Math.round(desiredH * photoAspect);
    var cardW = photoW + margin * 2, cardH = desiredH + margin * 2, round = 26;

    var card = newShape(comp, "card", [cx, cy]);
    addRoundRect(card, cardW, cardH, round, PAL.card);
    popIn(card, 0.15, 0.55, 100);

    // centerpiece: imported photo, or a placeholder card with a hint label
    // 中心主角：导入的照片，或带提示文字的占位卡片
    if (photo) {
        var cat = comp.layers.add(photo);
        cat.name = "photo_hero";
        cat.property("ADBE Transform Group").property("ADBE Position").setValue([cx, cy]);
        popIn(cat, 0.40, 0.55, (desiredH / photo.height) * 100);
    } else {
        var ph = newShape(comp, "photo_hero", [cx, cy]);
        addRoundRect(ph, photoW, desiredH, 16, [0.16, 0.17, 0.26]);
        popIn(ph, 0.40, 0.55, 100);
        var hint = comp.layers.addText("DROP A PHOTO\nIN ./assets/");
        var htd = hint.property("ADBE Text Properties").property("ADBE Text Document");
        var hv = htd.value;
        hv.fontSize = 40; hv.font = "Arial"; hv.fillColor = [0.7, 0.72, 0.8];
        hv.justification = ParagraphJustification.CENTER_JUSTIFY;
        htd.setValue(hv);
        hint.property("ADBE Transform Group").property("ADBE Position").setValue([cx, cy]);
        popIn(hint, 0.45, 0.55, 100);
    }

    var frame = newShape(comp, "frame", [cx, cy]);
    addRoundStroke(frame, cardW, cardH, round, PAL.gold, 5);
    addGlow(frame, 18, 1.1);
    popIn(frame, 0.55, 0.55, 100);

    var accents = [
        { p: [250, 180],  col: PAL.coral  }, { p: [1670, 180], col: PAL.teal   },
        { p: [250, 900],  col: PAL.violet }, { p: [1670, 900], col: PAL.gold   }
    ];
    for (var ai = 0; ai < accents.length; ai++) {
        var ac = accents[ai];
        var dia = newShape(comp, "accent_" + ai, ac.p);
        addRoundRect(dia, 64, 64, 12, ac.col);
        addGlow(dia, 10, 0.5);
        dia.property("ADBE Transform Group").property("ADBE Rotate Z").expression =
            "45 + 10*Math.sin(time*0.5*2*Math.PI + " + (ai * 1.3).toFixed(2) + ");";
        popIn(dia, 0.95 + ai * 0.08, 0.5, 100);
    }

    var dotPal = [PAL.teal, PAL.gold, PAL.coral, PAL.violet];
    var dots = [
        { p: [520, 80],   d: 18 }, { p: [1400, 80],  d: 18 },
        { p: [430, 200],  d: 14 }, { p: [1490, 200], d: 14 },
        { p: [380, 420],  d: 22 }, { p: [1540, 420], d: 22 },
        { p: [420, 640],  d: 16 }, { p: [1500, 640], d: 16 },
        { p: [560, 820],  d: 12 }, { p: [1360, 820], d: 12 }
    ];
    for (var di = 0; di < dots.length; di++) {
        var dt = dots[di];
        var dot = newShape(comp, "dot_" + di, dt.p);
        addDot(dot, dt.d, dotPal[di % dotPal.length]);
        addGlow(dot, 7, 0.6);
        var phs = (di * 0.8).toFixed(2);
        dot.property("ADBE Transform Group").property("ADBE Position").expression =
            "amp = 9; freq = 0.55;\n" +
            "z = (value.length > 2) ? value[2] : 0;\n" +
            "[value[0], value[1] + amp*Math.sin(time*freq*2*Math.PI + " + phs + "), z];";
        popIn(dot, 1.15 + di * 0.06, 0.5, 100);
    }

    var titleY = cy + cardH / 2 + 110;
    var tl = comp.layers.addText(TITLE_TEXT);
    var tdProp = tl.property("ADBE Text Properties").property("ADBE Text Document");
    var td = tdProp.value;
    td.fontSize = 84; td.font = "Arial-BoldMT"; td.fillColor = PAL.title;
    td.justification = ParagraphJustification.CENTER_JUSTIFY; td.tracking = 40;
    tdProp.setValue(td);
    addGlow(tl, 10, 0.8);
    var tpos = tl.property("ADBE Transform Group").property("ADBE Position");
    var top = tl.property("ADBE Transform Group").property("ADBE Opacity");
    tpos.setValueAtTime(1.55, [cx, titleY + 40]);
    tpos.setValueAtTime(2.15, [cx, titleY]);
    top.setValueAtTime(1.55, 0);
    top.setValueAtTime(2.15, 100);
    smoothKeys(tpos); smoothKeys(top);

    // content layers -> 3D so the camera can move through the scene (bg stays 2D)
    // 内容层转 3D 让相机可穿行（bg 保持 2D）
    for (var li = 1; li <= comp.numLayers; li++) {
        var L3 = comp.layer(li);
        if (L3.name !== "bg") L3.threeDLayer = true;
    }
    applyCamera(comp);

    comp.time = 2.6;   // representative frame 代表帧
    app.endUndoGroup();

    return "Built PhotoHero scene (" + (photo ? "with your photo" : "placeholder — drop a photo in ./assets/") + "), " + comp.numLayers + " layers.";
}

var result = main();
result;
