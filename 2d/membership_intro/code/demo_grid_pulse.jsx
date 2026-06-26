/**
 * demo_grid_pulse.jsx — Pulsing glowing cell grid (FREE standalone demo)
 * 发光脉冲网格（免费 standalone demo）
 *
 * STANDALONE / 自包含: no @include, no external deps, no assets. 无 @include、无外部依赖、无素材。
 *   Download, run, tweak CONFIG, re-run to verify it really works. 下载即跑，改 CONFIG 再跑亲手验证。
 *
 * Run / 运行 (After Effects): File > Scripts > Run Script File... > pick this file.
 *   菜单 文件 > 脚本 > 运行脚本文件，选本文件。
 *
 * What it builds / 构建什么: fills the active comp (or a new one) with a diagonal-wave grid of
 *   rounded glowing cells, alive via sine expressions on Opacity + Scale. 用对角行波正弦表达式
 *   驱动一片圆角发光单元网格，整片活起来。
 *
 * Tweak / 亲手验证: change COLS / GAP / the PALETTE colors below, re-run, see it change.
 *   改下面 COLS / GAP / PALETTE 配色再跑一次，看画面随之变化。
 */

// ============================================================================
// CONFIG / 配置 —— tweak and re-run / 改这里再跑
// ============================================================================
var COLS = 12;                                 // grid columns 网格列数
var GAP  = 14;                                  // cell gap px 单元间距
var PALETTE = [                                 // cyan/teal glow palette 青绿发光色板 (RGB 0-1)
    [0.15, 0.95, 0.85],
    [0.20, 0.80, 1.00],
    [0.10, 1.00, 0.70],
    [0.35, 0.90, 1.00]
];

function main() {
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) {
        comp = app.project.items.addComp("GridGlowPulse", 1920, 1080, 1.0, 5.0, 30);
        comp.openInViewer();
    }

    app.beginUndoGroup("Grid Glow Pulse");

    comp.layers.addSolid([0.02, 0.03, 0.05], "bg", comp.width, comp.height, 1.0);

    var cols = COLS, gap = GAP;
    var cell = (comp.width - gap * (cols + 1)) / cols;
    var rows = Math.floor((comp.height - gap) / (cell + gap));
    var radius = cell * 0.18;

    var made = 0;
    for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
            var col = PALETTE[(r + c) % PALETTE.length];

            var sl = comp.layers.addShape();
            sl.name = "cell_" + r + "_" + c;
            sl.threeDLayer = false;

            var grp = sl.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
            var gc = grp.property("ADBE Vectors Group");
            var rect = gc.addProperty("ADBE Vector Shape - Rect");
            rect.property("ADBE Vector Rect Size").setValue([cell, cell]);
            rect.property("ADBE Vector Rect Roundness").setValue(radius);
            var fill = gc.addProperty("ADBE Vector Graphic - Fill");
            fill.property("ADBE Vector Fill Color").setValue([col[0], col[1], col[2], 1]);

            var x = gap + cell / 2 + c * (cell + gap);
            var y = gap + cell / 2 + r * (cell + gap);
            sl.property("ADBE Transform Group").property("ADBE Position").setValue([x, y]);

            var glow = sl.property("ADBE Effect Parade").addProperty("ADBE Glo2");
            glow.property("ADBE Glo2-0002").setValue(0.0);
            glow.property("ADBE Glo2-0003").setValue(cell * 1.4);
            glow.property("ADBE Glo2-0004").setValue(1.6);

            var phase = (r + c) * 0.55;
            sl.property("ADBE Transform Group").property("ADBE Opacity").expression =
                "freq = 1.1;\n" +
                "phase = " + phase.toFixed(3) + ";\n" +
                "base = 45; amp = 50;\n" +
                "base + amp * (0.5 + 0.5*Math.sin(time*freq*2*Math.PI + phase));";

            sl.property("ADBE Transform Group").property("ADBE Scale").expression =
                "freq = 1.1;\n" +
                "phase = " + phase.toFixed(3) + ";\n" +
                "s = 82 + 18 * (0.5 + 0.5*Math.sin(time*freq*2*Math.PI + phase));\n" +
                "[s, s];";

            made++;
        }
    }

    comp.time = 0.4;   // move CTI off frame 0 so panel shows a lit frame 播放头离 0 帧
    app.endUndoGroup();

    return "Built pulsing glow grid: " + cols + "x" + rows + " = " + made + " cells.";
}

var result = main();
result;
