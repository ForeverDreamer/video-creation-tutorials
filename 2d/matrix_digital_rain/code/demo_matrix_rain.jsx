/**
 * demo_matrix_rain.jsx - Matrix digital rain, basic tier (free companion demo).
 * Matrix 数字雨 · 基础版（免费配套 demo）。
 *
 * Self-contained, zero external dependency. Run it in After Effects to get a recognizable,
 * controllable green code rain: falling monospace columns + bottom-bright fading trail + a
 * subtle glow. Tweak the CONFIG block at the top to make it yours.
 * 自包含、零外部依赖。在 After Effects 里跑一下，就得到一片可辨识、可控的绿色代码雨：
 * 等宽字符列坠落 + 底亮顶隐拖尾 + 轻微辉光。改顶部 CONFIG 即可调成你自己的。
 *
 * How to run / 怎么跑:
 *   ./adobe_cli.sh ae exec-script "<path>/demo_matrix_rain.jsx"
 *   (or paste into After Effects: File > Scripts > Run Script File)
 *
 * What you get here vs the full toolkit / 这里有什么、完整工具链还有什么:
 *   Here  : green rain, trail fade, glow, two-level brightness, one CONFIG block to tweak.
 *   这里  : 绿色雨、渐隐拖尾、辉光、两档亮度、一个 CONFIG 随手调。
 *   Toolkit: 4-level brightness with white-green leads, per-glyph flicker, a glow preset
 *            library, one-word recolor across green/amber/blue, and reusable helpers you can
 *            drop into any animation - updated every episode (see membership notes).
 *   工具链: 四档亮度+白绿领先列、逐字闪变、辉光预设库、一行词整片绿/琥珀/蓝重配色、可复用
 *            到任意动画的函数库，每集持续更新（见 membership 说明）。
 */

// ============================================================================
// CONFIG - tweak everything here / 所有可调项都在这里
// ============================================================================
var CONFIG = {
    comp: {
        name: "Matrix_Rain_Demo",
        width: 1920, height: 1080, fps: 30, duration: 10.0,
        bgColor: [0, 0, 0]                 // black canvas / 纯黑画布
    },
    rain: {
        fontFamily: "Consolas",            // monospace, no-space font name / 等宽无空格字体名
        fontSize: 32,
        colSpacing: 30,                    // px between columns / 列间距
        sideMargin: 16,
        strandMin: 14, strandMax: 34,      // glyphs per falling strand / 每条字串字符数
        speedMin: 120, speedMax: 320,      // px/sec fall speed / 坠落速度
        charset: "0123456789ABCDEF<>*+=$#@%",   // ASCII only / 纯 ASCII
        leadChance: 0.18,                  // share of brighter "lead" columns / 较亮领先列比例

        // ONE-CLICK RECOLOR: change this one word to "amber" / "blue" / "multi", then re-run.
        // "multi" = multi-color mix (each column picks a random base color).
        // 一键重配色：把这一个词改成 "amber" / "blue" / "multi"，重新运行即可。
        // （"multi" = 多色混合，每列随机取一种基色。）
        palette: "green",
        presets: {                         // three base colors; "multi" mixes them / 三种基色，"multi" 混合
            green: { lead: [0.55, 1.00, 0.65], body: [0.10, 0.85, 0.28] },  // classic Matrix / 经典 Matrix
            amber: { lead: [1.00, 0.85, 0.55], body: [0.95, 0.55, 0.10] },  // retro CRT / 复古 CRT
            blue:  { lead: [0.70, 0.88, 1.00], body: [0.20, 0.50, 1.00] }   // cyber / ice / 赛博·冰蓝
        }
    },
    glow: { enabled: true, radius: 8 }     // subtle bloom, keep glyphs sharp / 轻微泛光保锐利
};

// ============================================================================
// Helpers / 工具函数
// ============================================================================
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomFloat(min, max) { return Math.random() * (max - min) + min; }

// One vertical strand of random glyphs joined by line breaks / 一条竖向随机字串
function buildStrand(len, charset) {
    var lines = [];
    for (var i = 0; i < len; i++) { lines.push(charset.charAt(randomInt(0, charset.length - 1))); }
    return lines.join("\r");               // \r = AE text line break / AE 文字换行
}

// Looping fall expression for one column / 单列循环坠落表达式
function buildFallExpression(speed, phase, travel, startY) {
    return [
        "var x = value[0];",
        "var spd = " + speed.toFixed(2) + ";",
        "var ph = " + phase.toFixed(2) + ";",
        "var travel = " + travel.toFixed(2) + ";",
        "var y0 = " + startY.toFixed(2) + ";",
        "var y = y0 + (((time + ph) * spd) % travel);",
        "[x, y];"
    ].join("\n");
}

// Remove a prior comp of the same name so re-runs stay clean / 幂等：清同名旧合成
function removeExistingComp(name) {
    for (var i = app.project.items.length; i >= 1; i--) {
        var it = app.project.item(i);
        if (it instanceof CompItem && it.name === name) { it.remove(); }
    }
}

// Bottom-bright, top-fading trail via a text-animator opacity ramp / 底亮顶隐拖尾
function addTrailFade(layer) {
    try {
        var animator = layer.property("ADBE Text Properties")
                            .property("ADBE Text Animators").addProperty("ADBE Text Animator");
        animator.name = "trail_fade";
        animator.property("ADBE Text Animator Properties").addProperty("ADBE Text Opacity").setValue(0);
        var selector = animator.property("ADBE Text Selectors").addProperty("ADBE Text Selector");
        // Real matchName is "ADBE Text Range Shape" (NOT "Type2", which is Based On).
        // 真实属性名是 "ADBE Text Range Shape"（不是 "Type2"，那是 Based On）。
        selector.property("ADBE Text Range Advanced").property("ADBE Text Range Shape").setValue(3); // Ramp Down
        return true;
    } catch (e) { return false; }
}

function createColumn(comp, colIndex, x) {
    var r = CONFIG.rain;
    // "multi" mixes colors: each column picks a random base preset / "multi" 多色混合：每列随机取色
    var pal = (r.palette === "multi")
        ? r.presets[["green", "amber", "blue"][randomInt(0, 2)]]
        : r.presets[r.palette];
    var len = randomInt(r.strandMin, r.strandMax);
    var isLead = Math.random() < r.leadChance;
    var layer = comp.layers.addText(buildStrand(len, r.charset));
    layer.name = "rain_col_" + (colIndex < 10 ? "0" + colIndex : "" + colIndex);

    var textProp = layer.property("ADBE Text Properties").property("ADBE Text Document");
    var textDoc = textProp.value;
    textDoc.font = r.fontFamily;
    textDoc.fontSize = r.fontSize;
    textDoc.fillColor = isLead ? pal.lead : pal.body;
    textDoc.applyFill = true;
    textDoc.applyStroke = false;
    try { textDoc.justification = ParagraphJustification.LEFT_JUSTIFY; } catch (e) {}
    textProp.setValue(textDoc);

    addTrailFade(layer);

    var strandPx = len * r.fontSize * 1.18;
    var travel = CONFIG.comp.height + strandPx;
    var startY = -strandPx;
    var speed = randomFloat(r.speedMin, r.speedMax);
    var phase = randomFloat(0, travel / speed);     // desync columns / 各列错开相位

    var pos = layer.property("ADBE Transform Group").property("ADBE Position");
    pos.setValue([x, startY]);
    pos.expression = buildFallExpression(speed, phase, travel, startY);
    layer.property("ADBE Transform Group").property("ADBE Opacity").setValue(isLead ? 100 : 88);
    return layer;
}

function addGlow(comp) {
    if (!CONFIG.glow.enabled) { return false; }
    try {
        var adj = comp.layers.addSolid([0, 0, 0], "98_glow", CONFIG.comp.width, CONFIG.comp.height, 1.0);
        adj.adjustmentLayer = true;
        var glow = adj.property("ADBE Effect Parade").addProperty("ADBE Glo2");
        try { glow.property("Glow Radius").setValue(CONFIG.glow.radius); } catch (e1) {}
        return true;
    } catch (err) { return false; }   // rain still works if glow is unavailable / glow 失败不影响雨
}

// ============================================================================
// Main / 主流程
// ============================================================================
function main() {
    app.beginUndoGroup("Matrix Rain Demo");
    try {
        removeExistingComp(CONFIG.comp.name);
        var comp = app.project.items.addComp(CONFIG.comp.name, CONFIG.comp.width, CONFIG.comp.height,
                                             1.0, CONFIG.comp.duration, CONFIG.comp.fps);
        var bg = comp.layers.addSolid(CONFIG.comp.bgColor, "00_background",
                                      CONFIG.comp.width, CONFIG.comp.height, 1.0);
        bg.locked = true;

        var numCols = Math.floor((CONFIG.comp.width - 2 * CONFIG.rain.sideMargin) / CONFIG.rain.colSpacing);
        for (var c = 0; c < numCols; c++) {
            createColumn(comp, c, CONFIG.rain.sideMargin + c * CONFIG.rain.colSpacing);
        }
        var glowOk = addGlow(comp);
        comp.openInViewer();
        return { success: true, composition: CONFIG.comp.name, columns: numCols,
                 layers: comp.numLayers, glow: glowOk };
    } catch (err) {
        return { success: false, message: err.toString(), line: err.line };
    } finally {
        app.endUndoGroup();
    }
}

JSON.stringify(main(), null, 2);
