/**
 * demo_3d_text_flythrough.jsx — 3D Text Cloud Camera Flythrough (FREE standalone demo)
 * 3D 文字云 + 多手法相机飞掠（免费 standalone demo）
 *
 * STANDALONE / 自包含: no @include, no external deps, no membership tools. 无 @include、无外部依赖、不需会员工具。
 *   Download, run, tweak CONFIG, re-run to verify it really works.
 *   下载即跑，改下面 CONFIG 再跑一次，亲手验证脚本真实有效。
 *
 * Run / 运行 (After Effects):
 *   File > Scripts > Run Script File... > pick this file. 菜单 文件 > 脚本 > 运行脚本文件，选本文件。
 *
 * What it builds / 构建什么:
 *   A dark composition with N bright 3D text layers scattered in a Z-depth volume, plus a one-node
 *   camera doing a varied-rhythm flythrough (establishing / whip / hold / dolly-in / orbit / vertigo
 *   / truck / boom / dolly-out). Pure AE 3D (Classic 3D), no plugins.
 *   深色底 + N 个提亮 3D 文字层铺成 Z 纵深体积云 + 单节点相机多手法变速飞掠。纯 AE 3D，无插件。
 *
 * Tweak / 亲手验证: change numLayers / durationSec / bgColor / zDepth below, re-run, see it change.
 *   改下面 numLayers / durationSec / bgColor / zDepth 再跑一次，看画面随之变化。
 */

// ============================================================================
// CONFIG / 配置 —— tweak and re-run / 改这里再跑
// ============================================================================
var CONFIG = {
    compName:   "Text 3D Flythrough Hook",   // composition name 合成名
    width:      1920,
    height:     1080,
    durationSec: 30,                          // also drives camera beat timing 相机 beat 时序按此缩放
    fps:        30,
    numLayers:  50,                           // text layer count 文字层数量
    bgColor:    [0.04, 0.04, 0.07],           // dark background 深色底
    zDepth:     1200,                          // text cloud Z half-range (+/-) 文字云 Z 半幅
    fontName:   "Arial",                       // no-space font name 无空格字体名
    fontMin:    22,
    fontMax:    78,
    seed:       7,                             // PRNG seed — same seed => identical cloud (reproducible) 同 seed = 同一片云可精确重渲
    forceCpuRender: true                       // bake CPU render mode (heavy-3D black-frame fix) 强制 CPU 渲染
};

// ============================================================================
// Utilities / 工具
// ============================================================================
// seeded PRNG (Park-Miller minimal standard) — same CONFIG.seed => identical cloud (reproducible render)
// 可种子化随机（Park-Miller）：同 CONFIG.seed = 同一片云 = 可精确重渲（double 安全、ES3 兼容）
var _rngSeed = (Math.abs(Math.floor(CONFIG.seed)) % 2147483646) + 1;
function rng(){ _rngSeed = (_rngSeed * 16807) % 2147483647; return _rngSeed / 2147483647; }
function randInt(a, b){ return Math.floor(rng() * (b - a + 1)) + a; }
function randFloat(a, b){ return rng() * (b - a) + a; }

// random vivid color, brightened so it stays visible on a dark backdrop
// 随机鲜亮色，提亮保证深底上可见
function brightColor(){
    var c = [rng(), rng(), rng()];
    var m = Math.max(c[0], Math.max(c[1], c[2]));
    if (m < 0.02) return [0.92, 0.92, 0.95];
    var s = 0.95 / m;
    return [Math.min(1, c[0]*s), Math.min(1, c[1]*s), Math.min(1, c[2]*s)];
}

function randomText(){
    var words = ["Modern","Creative","Design","Motion","Graphics","Video","Studio","Digital",
                 "Art","Beautiful","Dynamic","Flow","Energy","Style","Cool","Awesome","Amazing",
                 "Animation","World","Hello"];
    var n = randInt(1, 3), out = [];
    for (var i = 0; i < n; i++){ out.push(words[randInt(0, words.length - 1)]); }
    return out.join(" ");
}

// set keyframes from [timeFraction, value] pairs (fraction of duration) + uniform ease
// 用 [时间比例, 值] 对设关键帧（比例×时长）+ 缓动
function setFracKeys(prop, D, pairs, easeFn){
    while (prop.numKeys > 0) prop.removeKey(1);
    for (var i = 0; i < pairs.length; i++){ prop.setValueAtTime(pairs[i][0] * D, pairs[i][1]); }
    for (var k = 1; k <= prop.numKeys; k++){
        var inf = easeFn ? easeFn(k, prop.numKeys) : 55;
        prop.setTemporalEaseAtKey(k, [new KeyframeEase(0, inf)], [new KeyframeEase(0, inf)]);
    }
}

// ============================================================================
// Main / 主函数
// ============================================================================
function main(){
    app.beginUndoGroup("Build 3D Text Flythrough Hook");
    try {
        if (CONFIG.forceCpuRender){ try { app.project.gpuAccelType = GpuAccelType.SOFTWARE; } catch(eg){} }

        // remove a same-named comp if it exists (idempotent re-run) 幂等：清同名合成
        for (var d = app.project.numItems; d >= 1; d--){
            var it = app.project.item(d);
            if (it instanceof CompItem && it.name === CONFIG.compName) it.remove();
        }

        var W = CONFIG.width, H = CONFIG.height, D = CONFIG.durationSec, cx = W/2, cy = H/2;
        var comp = app.project.items.addComp(CONFIG.compName, W, H, 1.0, D, CONFIG.fps);

        // dark background solid (bottom) 深色底 solid 置底
        var bg = comp.layers.addSolid(CONFIG.bgColor, "_bg_dark", W, H, 1.0, D);

        // bright 3D text cloud 提亮 3D 文字云
        for (var i = 0; i < CONFIG.numLayers; i++){
            var tl = comp.layers.addText(randomText());
            tl.name = "Text " + (i + 1);
            tl.threeDLayer = true;
            var tp = tl.property("ADBE Text Properties").property("ADBE Text Document");
            var td = tp.value;
            td.fontSize = randInt(CONFIG.fontMin, CONFIG.fontMax);
            td.fillColor = brightColor();
            td.applyFill = true;
            td.font = CONFIG.fontName;
            tp.setValue(td);
            var pos = tl.property("ADBE Transform Group").property("ADBE Position");
            pos.setValue([ randFloat(120, W - 120), randFloat(120, H - 120), randFloat(-CONFIG.zDepth, CONFIG.zDepth) ]);
        }

        // one-node camera (POI = null) -> control aim via Orientation/Rotate Z, NEVER set POI
        // 单节点相机（POI=null）：用 Orientation/Rotate Z 控朝向，绝不设 POI
        var cam = comp.layers.addCamera("_hook_cam", [cx, cy]);
        cam.startTime = 0;
        var tg = cam.property("ADBE Transform Group");

        // POSITION beats: establishing / whip / hold / dolly-in / orbit / vertigo / truck / boom / dolly-out
        var fastPos = {3:1, 4:1};   // whip + hold = sharp ease
        setFracKeys(tg.property("ADBE Position"), D, [
            [0.000, [cx,      cy,     -2600]],   // 1 establishing push
            [0.100, [cx,      cy,     -1700]],
            [0.133, [cx+520,  cy-120, -1500]],   // 2 whip pan (fast)
            [0.167, [cx+500,  cy-110, -1480]],   // 3 hold (micro)
            [0.300, [cx+120,  cy+260, -400 ]],   // 4 Track/dolly-in diving DOWN into lower text
            [0.367, [cx-400,  cy+360, -1100]],   // 5 Boom-down + Arc across LOWER cloud (bottom text, pulled back for density)
            [0.433, [cx-520,  cy+160, -1150]],   //   rise back through mid
            [0.500, [cx-200,  cy,     -350 ]],   // 6 Vertigo push-in (center)
            [0.733, [cx+480,  cy-60,  -900 ]],   // 7 Truck drift across upper-middle (slow)
            [0.900, [cx+150,  cy-330, -480 ]],   // 8 Boom-UP to upper text
            [1.000, [cx,      cy-120, -2200]]    // 9 dolly-out
        ], function(k, nk){ if (k===1 || k===nk) return 85; return fastPos[k] ? 20 : 60; });

        // ROLL (dutch banking) 滚转 banking
        setFracKeys(tg.property("ADBE Rotate Z"), D, [
            [0.000,0],[0.133,-18],[0.167,-12],[0.300,8],[0.433,-10],
            [0.500,0],[0.733,6],[0.900,-8],[1.000,0]
        ], function(){ return 45; });

        // ORIENTATION Y: small swing to face center during the orbit beat 环绕时朝向中心微摆
        setFracKeys(tg.property("ADBE Orientation"), D, [
            [0.000,[0,0,0]],[0.300,[0,0,0]],[0.367,[0,14,0]],[0.433,[0,18,0]],[0.500,[0,0,0]]
        ], function(){ return 50; });

        // ZOOM: dolly punch (beat4) + VERTIGO zoom-out (beat6) 变焦推近 + 滑动变焦
        var zoomP = cam.property("ADBE Camera Options Group").property("ADBE Camera Zoom");
        var z0 = zoomP.value;
        setFracKeys(zoomP, D, [
            [0.000,z0],[0.300,z0*1.18],[0.350,z0],[0.433,z0],[0.500,z0*0.7],[0.550,z0],[1.000,z0]
        ], function(){ return 55; });

        comp.openInViewer();

        return "Built '" + CONFIG.compName + "': " + CONFIG.numLayers + " 3D text layers + flythrough camera, " + D + "s.";
    } catch (e){
        return "ERROR: " + e.toString();
    } finally {
        app.endUndoGroup();
    }
}

var result = main();
result;
