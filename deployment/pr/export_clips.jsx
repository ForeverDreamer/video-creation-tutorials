// ============================================
// PR导出clips脚本 - PR Export Clips Script
// ============================================
//
// 功能 - Features:
// - 从指定序列导出所有clips为独立音频文件到voiceovers/{lang}/目录
// - Export all clips from specified sequence as individual audio files to voiceovers/{lang}/ directory
// - 默认从名为"processed"的序列导出，可通过SEQUENCE_NAME配置覆盖
// - Default exports from sequence named "processed", configurable via SEQUENCE_NAME
//
// [NEW] 增量导出（按原始素材序号）- Incremental Export (by Source Material Index):
// 支持按原始素材序号前缀进行增量导出，避免每次全量导出。
// Supports incremental export by source material number prefix, avoiding full export each time.
//
// 原始素材命名格式 - Source Material Naming Format:
// - 格式：数字前缀_描述.wav，如 "48_error_handling.wav" → 序号48
// - Format: number_description.wav, e.g., "48_error_handling.wav" → index 48
//
// 配置参数 - Configuration Parameters:
// - SOURCE_INDICES: [48, 52] → 导出原始素材48和52对应的所有clips
// - SOURCE_START/SOURCE_END: 45, 50 → 导出原始素材45-50对应的所有clips
// - 全部为null → 导出所有clips（默认行为）
//
// 一对多关系 - One-to-Many Relationship:
// 一个原始素材可能被切成多个clips，指定SOURCE_INDICES: [48]会自动找到并导出所有来自48号素材的clips。
// One source material may be split into multiple clips; specifying SOURCE_INDICES: [48] auto-exports all clips from source 48.
//
// [FEATURE] 序列 Locale 匹配 - Sequence Locale Matching:
// 当项目中存在多个同名序列（如 voiceovers/en/processed 和 voiceovers/zh/processed）时，
// When multiple sequences with the same name exist (e.g., voiceovers/en/processed and voiceovers/zh/processed),
// 脚本会通过 seqItem.treePath 检查序列所在文件夹路径，优先选择路径中包含 /{locale}/ 的序列。
// the script checks the sequence's folder path via seqItem.treePath and prioritizes sequences containing /{locale}/ in path.
// 这确保了即使有多个同名序列，也能根据 CONFIG.locale 选择正确的语言版本。
// This ensures the correct language version is selected based on CONFIG.locale even with multiple same-named sequences.
//
// [IMPORTANT] AME异步导出问题 - AME Asynchronous Export Issue:
// Adobe Media Encoder (AME) 是异步运行的，脚本在调用 startBatch() 后会立即返回，不会等待导出完成。
// AME runs asynchronously; the script returns immediately after calling startBatch() without waiting for completion.
//
// 问题场景 - Problem Scenario:
// 1. 运行脚本，AME开始导出（异步）- Run script, AME starts exporting (async)
// 2. 在AME完成前再次运行脚本 - Run script again before AME completes
// 3. 新脚本清理了输出目录中的旧文件 - New script cleans old files in output directory
// 4. 第一次的AME任务完成，写入文件（如 48.wav）- First AME task completes, writes file (e.g., 48.wav)
// 5. 第二次的AME任务完成，写入同名文件时发现冲突，自动重命名为 48_1.wav
//    Second AME task completes, finds conflict, auto-renames to 48_1.wav
// 6. 结果：目录中出现重复文件（48.wav 和 48_1.wav）- Result: duplicate files appear
//
// 解决方案 - Solutions:
// - 在重新运行此脚本前，确保AME队列中没有待处理的任务
//   Ensure no pending tasks in AME queue before re-running this script
// - 检查AME窗口，等待所有导出任务完成后再运行下一次导出
//   Check AME window, wait for all export tasks to complete before next export
// - 如果发现 *_1.wav 等重复文件，手动删除后重新导出
//   If *_1.wav duplicate files found, manually delete and re-export

//@include "config.jsx"

// ============================================
// 用户配置区域 - User Configuration
// ============================================
var USER_CONFIG = {
  LOCALE: '', // 输出语言目录（留空=使用CONFIG.locale，可选值: 'zh', 'en'）- Output language directory (empty = use CONFIG.locale)
  SUBPROJECT: '', // 子项目名称（如 'hook'，留空=main项目）- Subproject name (e.g., 'hook', empty = main project)
  SEQUENCE_NAME: '', // 源序列名称（留空=使用CONFIG默认值'processed'）- Source sequence name (empty = use CONFIG default 'processed')

  // ============================================
  // 场景模式配置（推荐，优先级最高）- Scene mode config (recommended, highest priority)
  // 直接指定场景编号，脚本自动从字幕文件解析对应的原始素材序号
  // Specify scene numbers directly, script auto-parses source indices from subtitle file
  // ============================================
  SCENES: null, // 离散场景列表，如 [16, 25] - Discrete scene list, e.g., [16, 25]
  SCENE_START: null, // 场景范围起点，如 10 - Scene range start, e.g., 10
  SCENE_END: null, // 场景范围终点（包含），如 16 - Scene range end (inclusive), e.g., 16

  // 使用示例 - Usage examples:
  // 示例1：导出 sc16 和 sc25 的所有 clips
  // Example 1: Export all clips for sc16 and sc25
  //   SCENES: [16, 25], SCENE_START: null, SCENE_END: null
  //
  // 示例2：导出 sc10 到 sc16 范围内的所有 clips
  // Example 2: Export all clips for sc10 to sc16
  //   SCENES: null, SCENE_START: 10, SCENE_END: 16
  //
  // 示例3：导出所有场景（场景参数全为null，回退到原始素材模式）
  // Example 3: Export all scenes (all scene params null, fallback to source mode)
  //   SCENES: null, SCENE_START: null, SCENE_END: null

  // ============================================
  // 原始素材模式配置（向后兼容，场景模式优先）- Source mode config (backward compatible, scene mode takes priority)
  // 当场景参数全为null时使用此模式
  // Used when all scene params are null
  // ============================================
  SOURCE_START: null, // 起始原始素材序号，如 48 - Start source index, e.g., 48
  SOURCE_END: null, // 结束原始素材序号（包含），如 52 - End source index (inclusive), e.g., 52
  SOURCE_INDICES: null, // 离散原始素材序号列表，如 [48, 52, 55] - Discrete source indices, e.g., [48, 52, 55]

  // ============================================
  // 仅同步映射模式 - Sync Mapping Only Mode
  // 不导出clips，仅扫描序列生成完整的 clip_mapping.json
  // Skip export, only scan sequence to generate complete clip_mapping.json
  // ============================================
  SYNC_MAPPING_ONLY: false, // 设为true仅同步映射，不导出 - Set true to sync mapping only, no export
};

// ============================================
// 自动配置 - Automatic Configuration
// CONFIG对象由hostscript.jsx从环境变量加载
// CONFIG object loaded from environment variables by hostscript.jsx
// Path helper functions are provided by config.jsx
// 路径辅助函数由 config.jsx 提供
// Note: Path and preset configuration is done inside exportClips() to handle CONFIG availability
// 注意：路径和预设配置在 exportClips() 内部进行，以处理 CONFIG 可用性
// ============================================

// 序列名称优先级：USER_CONFIG > CONFIG._sequenceName > 'processed'
// Sequence name priority: USER_CONFIG > CONFIG._sequenceName > 'processed'
var CONFIG_SEQUENCE_NAME = USER_CONFIG.SEQUENCE_NAME ||
  (typeof CONFIG !== 'undefined' && CONFIG && CONFIG._sequenceName) ||
  'processed';

// 序列索引（当CONFIG_SEQUENCE_NAME为空时使用，默认使用第一个序列）
// Sequence index (used when CONFIG_SEQUENCE_NAME is empty, default: first sequence)
var CONFIG_SEQUENCE_INDEX = 0;

// 文件命名配置 - File naming configuration (from config.jsx)
// FILE_NAMING_CONFIG.zeroPad = true (01, 02, ...)

// AME编码选项 - AME encoding options (from config.jsx)
// AME_CONFIG.ENCODE_WORKAREA = 0
// AME_CONFIG.REMOVE_ON_COMPLETION = 1

// ============================================
// 工具函数 - Utility Functions
// ============================================
// Note: removeFolderRecursive, isAudioFile, and zeroPad are now defined in config.jsx
// 注意：removeFolderRecursive, isAudioFile 和 zeroPad 现在定义在 config.jsx 中

/**
 * Check if array contains a value (ES3 compatible)
 * 检查数组是否包含指定值（ES3兼容）
 *
 * @param {Array} arr - Array to search / 要搜索的数组
 * @param {*} value - Value to find / 要查找的值
 * @returns {boolean} True if found / 找到返回true
 */
function arrayContains(arr, value) {
  if (!arr || !arr.length) return false;
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] === value) return true;
  }
  return false;
}

/**
 * Extract source material index from clip's projectItem name
 * 从clip的projectItem名称中提取原始素材序号
 *
 * Expected format: "48_description" or "48_description.wav" → 48
 * 预期格式："48_description" 或 "48_description.wav" → 48
 *
 * @param {TrackItem} clip - PR TrackItem object / PR TrackItem对象
 * @returns {number} Source index or -1 if not found / 原始素材序号，未找到返回-1
 */
function extractSourceIndex(clip) {
  if (!clip || !clip.projectItem || !clip.projectItem.name) {
    return -1;
  }

  var sourceName = clip.projectItem.name;
  // Match leading digits: "48_description.wav" → "48"
  // 匹配开头的数字
  var match = sourceName.match(/^(\d+)/);

  if (match && match[1]) {
    return parseInt(match[1], 10);
  }

  return -1;
}

/**
 * Determine if a clip should be exported based on its source material index
 * 根据原始素材序号判断clip是否应该被导出
 *
 * Priority: SOURCE_INDICES > SOURCE_START/SOURCE_END > export all
 * 优先级：SOURCE_INDICES > SOURCE_START/SOURCE_END > 全部导出
 *
 * @param {TrackItem} clip - PR TrackItem object / PR TrackItem对象
 * @returns {boolean} True if clip should be exported / 如果应该导出返回true
 */
function shouldExportClip(clip) {
  var sourceIndex = extractSourceIndex(clip);

  // If cannot extract source index, export by default (safety fallback)
  // 如果无法提取序号，默认导出（安全回退）
  if (sourceIndex === -1) {
    return true;
  }

  // Mode 1: Discrete source indices (highest priority)
  // 模式1：离散原始素材序号列表（最高优先级）
  if (USER_CONFIG.SOURCE_INDICES && USER_CONFIG.SOURCE_INDICES.length > 0) {
    return arrayContains(USER_CONFIG.SOURCE_INDICES, sourceIndex);
  }

  // Mode 2: Range mode (SOURCE_START to SOURCE_END)
  // 模式2：范围模式
  var start = USER_CONFIG.SOURCE_START;
  var end = USER_CONFIG.SOURCE_END;

  // If both null, export all
  // 如果都为null，导出全部
  if (start === null && end === null) {
    return true;
  }

  // Apply defaults: start=1, end=Infinity
  // 应用默认值：start=1, end=无穷大
  if (start === null) start = 1;
  if (end === null) end = Infinity;

  return sourceIndex >= start && sourceIndex <= end;
}

/**
 * Get export mode description for logging
 * 获取导出模式描述（用于日志）
 *
 * @returns {Object} Mode info with type and description / 模式信息
 */
function getExportModeInfo() {
  if (USER_CONFIG.SOURCE_INDICES && USER_CONFIG.SOURCE_INDICES.length > 0) {
    return {
      type: 'source_indices',
      description: 'Source indices: [' + USER_CONFIG.SOURCE_INDICES.join(', ') + ']',
      indices: USER_CONFIG.SOURCE_INDICES,
    };
  }

  var start = USER_CONFIG.SOURCE_START;
  var end = USER_CONFIG.SOURCE_END;

  if (start === null && end === null) {
    return {
      type: 'all',
      description: 'Export all clips',
    };
  }

  return {
    type: 'source_range',
    description: 'Source range: ' + (start || 1) + ' to ' + (end || 'end'),
    startIndex: start || 1,
    endIndex: end,
  };
}

// ============================================
// 场景模式解析函数 - Scene Mode Parsing Functions
// ============================================

/**
 * Get target scenes from USER_CONFIG
 * 从 USER_CONFIG 获取目标场景列表
 *
 * Priority: SCENES > SCENE_START/SCENE_END > null (use source mode)
 * 优先级：SCENES > SCENE_START/SCENE_END > null（使用原始素材模式）
 *
 * Returns: Array of scene numbers or null if scene mode not configured
 */
function getTargetScenes() {
  // Mode 1: Discrete scene list (highest priority)
  // 模式1：离散场景列表（最高优先级）
  if (USER_CONFIG.SCENES && USER_CONFIG.SCENES.length > 0) {
    return USER_CONFIG.SCENES;
  }

  // Mode 2: Scene range
  // 模式2：场景范围
  var start = USER_CONFIG.SCENE_START;
  var end = USER_CONFIG.SCENE_END;

  if (start !== null || end !== null) {
    // Apply defaults: start=1, end=999
    // 应用默认值
    if (start === null) start = 1;
    if (end === null) end = 999;

    var scenes = [];
    for (var i = start; i <= end; i++) {
      scenes.push(i);
    }
    return scenes;
  }

  // No scene mode configured, return null to use source mode
  // 未配置场景模式，返回 null 使用原始素材模式
  return null;
}

/**
 * Validate that source indices are continuous within each scene
 * 验证每个场景内的原始素材编号是否连续
 *
 * This catches common errors like:
 * - Typos in index numbers (e.g., [13] instead of [12])
 * - Missing index markers
 * - Accidental duplicate or skipped numbers
 *
 * Param sceneMapping: Object mapping scene numbers to arrays of source indices
 * Returns: Array of error messages (empty if valid)
 *
 * Example error:
 *   场景 5 / Scene 5:
 *     实际编号 / Actual: [10, 11, 13]
 *     缺失编号 / Missing: [12]
 */
function validateSceneIndexContinuity(sceneMapping) {
  var errors = [];

  for (var scene in sceneMapping) {
    if (!sceneMapping.hasOwnProperty(scene)) continue;

    var indices = sceneMapping[scene];

    // Skip validation for scenes with 0 or 1 index
    // 跳过只有0或1个编号的场景
    if (indices.length <= 1) continue;

    // Sort indices to check continuity
    // 排序编号以检查连续性
    var sorted = indices.slice().sort(function (a, b) {
      return a - b;
    });

    // Find missing indices
    // 查找缺失的编号
    var missing = [];
    for (var i = 0; i < sorted.length - 1; i++) {
      var current = sorted[i];
      var next = sorted[i + 1];

      // Check for gap
      // 检查是否有间隔
      if (next !== current + 1) {
        for (var j = current + 1; j < next; j++) {
          missing.push(j);
        }
      }
    }

    if (missing.length > 0) {
      var errorMsg =
        '场景 ' +
        scene +
        ' / Scene ' +
        scene +
        ':\n' +
        '  实际编号 / Actual: [' +
        sorted.join(', ') +
        ']\n' +
        '  缺失编号 / Missing: [' +
        missing.join(', ') +
        ']';
      errors.push(errorMsg);
    }
  }

  return errors;
}

/**
 * Parse subtitle file to extract source indices for target scenes
 * 解析字幕文件，提取目标场景对应的原始素材序号
 *
 * Subtitle format:
 *   [scXX]    - Scene marker (e.g., [sc16])
 *   [数字]    - Source material index (e.g., [33])
 *
 * Param targetScenes: Array of scene numbers to extract (e.g., [16, 25])
 * Returns: Object with sourceIndices array and sceneMapping object, or null on error
 */
function parseSubtitleForScenes(targetScenes) {
  if (!targetScenes || targetScenes.length === 0) {
    return null;
  }

  // Build subtitle file path using existing helper function (with subproject support)
  // 使用现有辅助函数构建字幕文件路径（支持子项目）
  var subtitlePath = getSubtitlePath(USER_CONFIG.LOCALE, USER_CONFIG.SUBPROJECT);

  logToFile('INFO', '解析字幕文件', {
    path: subtitlePath,
    targetScenes: targetScenes,
  });

  var file = new File(subtitlePath);
  if (!file.exists) {
    logToFile('ERROR', '字幕文件不存在', { path: subtitlePath });
    return null;
  }

  // Read file content
  // 读取文件内容
  file.encoding = 'UTF-8';
  var opened = file.open('r');
  if (!opened) {
    logToFile('ERROR', '无法打开字幕文件', { path: subtitlePath });
    return null;
  }

  var content = file.read();
  file.close();

  // Parse content
  // 解析内容
  var lines = content.split(/\r?\n/);
  var currentScene = -1;
  var sourceIndices = [];
  var sceneMapping = {}; // scene -> [source indices]

  // Regex patterns
  // 正则表达式
  var sceneRegex = /^\[sc(\d+)\]$/;
  var sourceRegex = /^\[(\d+)\]$/;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].replace(/^\s+|\s+$/g, ''); // trim

    // Check for scene marker
    // 检测场景标记
    var sceneMatch = line.match(sceneRegex);
    if (sceneMatch) {
      currentScene = parseInt(sceneMatch[1], 10);
      continue;
    }

    // Check for source index
    // 检测原始素材序号
    var sourceMatch = line.match(sourceRegex);
    if (sourceMatch && arrayContains(targetScenes, currentScene)) {
      var sourceIdx = parseInt(sourceMatch[1], 10);
      sourceIndices.push(sourceIdx);

      // Build scene mapping
      // 构建场景映射
      if (!sceneMapping[currentScene]) {
        sceneMapping[currentScene] = [];
      }
      sceneMapping[currentScene].push(sourceIdx);
    }
  }

  if (sourceIndices.length === 0) {
    logToFile('WARN', '未找到目标场景的原始素材', {
      targetScenes: targetScenes,
      subtitlePath: subtitlePath,
    });
    return null;
  }

  // Validate index continuity for each scene
  // 验证每个场景的编号连续性
  var continuityErrors = validateSceneIndexContinuity(sceneMapping);
  if (continuityErrors.length > 0) {
    var errorMsg =
      '场景编号不连续错误 / Scene index discontinuity error:\n\n' +
      continuityErrors.join('\n\n') +
      '\n\n请检查字幕文件中的 [数字] 标记。\n' +
      'Please check the [number] markers in subtitle file:\n' +
      subtitlePath;

    logToFile('ERROR', '场景编号不连续', {
      errors: continuityErrors,
      sceneMapping: sceneMapping,
    });

    throw new Error(errorMsg);
  }

  logToFile('INFO', '场景解析完成', {
    targetScenes: targetScenes,
    sourceIndices: sourceIndices,
    sceneMapping: sceneMapping,
  });

  return {
    sourceIndices: sourceIndices,
    sceneMapping: sceneMapping,
  };
}

/**
 * Check if scene mode is enabled and convert to source indices
 * 检查是否启用场景模式并转换为原始素材序号
 *
 * Returns: Object with mode info, or null if using source mode
 */
function processSceneMode() {
  var targetScenes = getTargetScenes();

  if (!targetScenes) {
    // Scene mode not configured, use source mode
    // 未配置场景模式，使用原始素材模式
    return null;
  }

  var parseResult = parseSubtitleForScenes(targetScenes);

  if (!parseResult) {
    logToFile('WARN', '场景模式解析失败，回退到原始素材模式');
    return null;
  }

  // Override USER_CONFIG.SOURCE_INDICES with parsed values
  // 使用解析结果覆盖 USER_CONFIG.SOURCE_INDICES
  USER_CONFIG.SOURCE_INDICES = parseResult.sourceIndices;

  return {
    type: 'scenes',
    scenes: targetScenes,
    sourceIndices: parseResult.sourceIndices,
    sceneMapping: parseResult.sceneMapping,
    description:
      'Scenes: [' +
      targetScenes.join(', ') +
      '] → Source indices: [' +
      parseResult.sourceIndices.join(', ') +
      ']',
  };
}

// ============================================
// 主函数 - Main Function
// ============================================

function exportClips() {
  var startTime = new Date().getTime();

  // Calculate paths and preset inside function to handle CONFIG availability
  // 在函数内部计算路径和预设以处理 CONFIG 可用性
  if (typeof CONFIG === 'undefined' || !CONFIG || !CONFIG.amePresetPath) {
    var errorResult = {
      success: false,
      message: 'CONFIG.amePresetPath not configured',
      details: {},
    };
    return JSON.stringify(errorResult);
  }

  var presetPath = CONFIG.amePresetPath;

  // Standalone mode: use direct output directory from STANDALONE_CONFIG
  // Workflow mode: derive output path from project structure
  // 独立模式：使用 STANDALONE_CONFIG 的直接输出目录
  // 工作流模式：从项目结构派生输出路径
  var outputDir;
  if (CONFIG._standalone && CONFIG._outputDir) {
    outputDir = CONFIG._outputDir;
    logToFile('INFO', 'Standalone mode: using direct output directory', { outputDir: outputDir });
  } else {
    outputDir = getResourcePath(
      RESOURCE_DIRS.VOICEOVERS,
      USER_CONFIG.LOCALE,
      USER_CONFIG.SUBPROJECT
    );
  }

  // Process scene mode: convert scenes to source indices
  // 处理场景模式：将场景转换为原始素材序号
  // Scene mode requires subtitle files, only available in workflow mode
  // 场景模式依赖字幕文件，仅在工作流模式下可用
  var sceneModeInfo = null;
  if (!CONFIG._standalone) {
    sceneModeInfo = processSceneMode();
    if (sceneModeInfo) {
      logToFile('INFO', '使用场景模式', {
        scenes: sceneModeInfo.scenes,
        sourceIndices: sceneModeInfo.sourceIndices,
        sceneMapping: sceneModeInfo.sceneMapping,
      });
    }
  }

  var result = {
    success: false,
    message: '',
    exported: 0,
    errors: [],
    details: {
      sequenceName: '',
      sequenceIndex: -1,
      trackType: '',
      trackIndex: -1,
      totalClips: 0,
      config: {
        presetPath: presetPath,
        outputDir: outputDir,
        filenameZeroPad: FILE_NAMING_CONFIG.zeroPad,
      },
      sceneMode: sceneModeInfo, // Scene mode info if enabled / 场景模式信息（如果启用）
      clips: [],
      timing: {
        startTime: startTime,
        endTime: 0,
        durationMs: 0,
      },
    },
  };

  // 用于保存和恢复序列状态的变量
  var originalInPoint = null;
  var originalOutPoint = null;
  var needsRestore = false;
  var targetSequence = null;

  // 恢复序列状态的函数
  function restoreSequenceState() {
    if (needsRestore && targetSequence) {
      try {
        targetSequence.setInPoint(originalInPoint);
        targetSequence.setOutPoint(originalOutPoint);
        logToFile('INFO', '恢复序列状态', {
          sequenceName: targetSequence.name,
          restoredInPoint: originalInPoint,
          restoredOutPoint: originalOutPoint,
        });
      } catch (restoreError) {
        logToFile('ERROR', '恢复序列状态失败', {
          error: restoreError.toString(),
        });
      }
    }
  }

  logToFile('INFO', '开始批量导出序列', {
    configSequenceName: CONFIG_SEQUENCE_NAME,
    configSequenceIndex: CONFIG_SEQUENCE_INDEX,
  });

  try {
    // 检查项目和序列
    if (!app.project || app.project.sequences.numSequences === 0) {
      result.message = '没有打开的项目或序列';
      logToFile('ERROR', '批量导出失败', { reason: result.message });
      restoreSequenceState();
      return JSON.stringify(result);
    }

    logToFile('INFO', '项目检查通过', {
      projectName: app.project.name,
      totalSequences: app.project.sequences.numSequences,
    });

    // 根据配置选择序列（优先使用名称，结合subproject和locale过滤）
    // Get locale and subproject for sequence filtering / 获取用于序列过滤的locale和subproject
    var locale = USER_CONFIG.LOCALE || (CONFIG && CONFIG.locale) || 'zh';
    var subproject = USER_CONFIG.SUBPROJECT || '';

    if (CONFIG_SEQUENCE_NAME !== '') {
      // 通过名称查找序列，优先匹配subproject+locale路径
      // Search by name, prioritizing sequences in subproject+locale path
      var candidateSequences = [];

      for (var s = 0; s < app.project.sequences.numSequences; s++) {
        var seq = app.project.sequences[s];
        if (seq.name === CONFIG_SEQUENCE_NAME) {
          // 获取序列的projectItem来检查其父文件夹路径
          // Get sequence's projectItem to check its parent folder path
          var seqItem = seq.projectItem;
          var parentPath = '';

          if (seqItem && seqItem.treePath) {
            parentPath = seqItem.treePath;
          }

          // 计算路径匹配优先级 - Calculate path match priority
          // Priority: subproject+locale > subproject only > locale only > no match
          var matchesSubproject =
            subproject &&
            (parentPath.indexOf('/' + subproject + '/') !== -1 ||
              parentPath.indexOf('\\' + subproject + '\\') !== -1);
          var matchesLocale =
            parentPath.indexOf('/' + locale + '/') !== -1 ||
            parentPath.indexOf('\\' + locale + '\\') !== -1 ||
            parentPath.indexOf('/' + locale) === parentPath.length - locale.length - 1;

          // 匹配优先级分数 - Match priority score
          // 3: subproject + locale, 2: subproject only, 1: locale only, 0: no match
          var matchScore = 0;
          if (matchesSubproject && matchesLocale) {
            matchScore = 3;
          } else if (matchesSubproject) {
            matchScore = 2;
          } else if (matchesLocale && !subproject) {
            // 只有在没有指定subproject时，locale匹配才有效
            // Locale match only valid when no subproject specified
            matchScore = 1;
          }

          candidateSequences.push({
            sequence: seq,
            index: s,
            parentPath: parentPath,
            matchesSubproject: matchesSubproject,
            matchesLocale: matchesLocale,
            matchScore: matchScore,
          });

          logToFile('INFO', '找到候选序列', {
            sequenceName: seq.name,
            sequenceIndex: s,
            parentPath: parentPath,
            subproject: subproject,
            locale: locale,
            matchesSubproject: matchesSubproject,
            matchesLocale: matchesLocale,
            matchScore: matchScore,
          });
        }
      }

      // 按匹配分数排序，选择最高分的序列
      // Sort by match score, select highest scoring sequence
      candidateSequences.sort(function (a, b) {
        return b.matchScore - a.matchScore;
      });

      // 选择匹配分数最高的序列（分数>0表示有匹配）
      // Select sequence with highest match score (score>0 means matched)
      if (candidateSequences.length > 0 && candidateSequences[0].matchScore > 0) {
        targetSequence = candidateSequences[0].sequence;
        result.details.sequenceName = targetSequence.name;
        result.details.sequenceIndex = candidateSequences[0].index;
        logToFile('INFO', '选择最佳匹配序列', {
          sequenceName: targetSequence.name,
          sequenceIndex: candidateSequences[0].index,
          parentPath: candidateSequences[0].parentPath,
          subproject: subproject,
          locale: locale,
          matchScore: candidateSequences[0].matchScore,
          searchMethod: 'byNameAndPath',
        });
      }

      // 如果没有匹配locale的，使用第一个候选
      // If no locale match, use first candidate
      if (!targetSequence && candidateSequences.length > 0) {
        targetSequence = candidateSequences[0].sequence;
        result.details.sequenceName = targetSequence.name;
        result.details.sequenceIndex = candidateSequences[0].index;
        logToFile('WARN', '未找到匹配locale的序列，使用第一个候选', {
          sequenceName: targetSequence.name,
          sequenceIndex: candidateSequences[0].index,
          parentPath: candidateSequences[0].parentPath,
          locale: locale,
          searchMethod: 'byNameFallback',
        });
      }

      if (!targetSequence) {
        result.message = "找不到名为 '" + CONFIG_SEQUENCE_NAME + "' 的序列";
        var availableSeqs = [];
        for (var s = 0; s < app.project.sequences.numSequences; s++) {
          availableSeqs.push(app.project.sequences[s].name);
        }
        logToFile('ERROR', '找不到目标序列', {
          searchName: CONFIG_SEQUENCE_NAME,
          availableSequences: availableSeqs,
        });
        restoreSequenceState();
        return JSON.stringify(result);
      }
    } else {
      // 使用索引
      if (CONFIG_SEQUENCE_INDEX >= app.project.sequences.numSequences) {
        result.message =
          '序列索引 ' +
          CONFIG_SEQUENCE_INDEX +
          ' 超出范围（共 ' +
          app.project.sequences.numSequences +
          ' 个序列）';
        logToFile('ERROR', '序列索引超出范围', {
          requestedIndex: CONFIG_SEQUENCE_INDEX,
          totalSequences: app.project.sequences.numSequences,
        });
        restoreSequenceState();
        return JSON.stringify(result);
      }
      targetSequence = app.project.sequences[CONFIG_SEQUENCE_INDEX];
      result.details.sequenceName = targetSequence.name;
      result.details.sequenceIndex = CONFIG_SEQUENCE_INDEX;
      logToFile('INFO', '找到目标序列', {
        sequenceName: targetSequence.name,
        sequenceIndex: CONFIG_SEQUENCE_INDEX,
        searchMethod: 'byIndex',
      });
    }

    // 保存原始序列状态（入点/出点），以便稍后恢复
    try {
      originalInPoint = targetSequence.getInPoint();
      originalOutPoint = targetSequence.getOutPoint();
      needsRestore = true;
      logToFile('INFO', '保存序列原始状态', {
        sequenceName: targetSequence.name,
        originalInPoint: originalInPoint,
        originalOutPoint: originalOutPoint,
      });
    } catch (saveError) {
      logToFile('WARN', '无法保存序列状态', {
        error: saveError.toString(),
      });
      needsRestore = false;
    }

    // 查找有clips的轨道（优先视频，其次音频）
    var trackType = '';
    var trackIndex = -1;
    var clips = null;

    // 先检查视频轨道
    for (var t = 0; t < targetSequence.videoTracks.numTracks; t++) {
      var track = targetSequence.videoTracks[t];
      if (track.clips.numItems > 0) {
        trackType = 'video';
        trackIndex = t;
        clips = track.clips;
        result.details.trackType = trackType;
        result.details.trackIndex = trackIndex;
        result.details.totalClips = clips.numItems;
        logToFile('INFO', '找到目标轨道', {
          trackType: 'video',
          trackIndex: t,
          totalClips: clips.numItems,
        });
        break;
      }
    }

    // 如果没有视频clips，检查音频轨道
    if (trackIndex === -1) {
      for (var t = 0; t < targetSequence.audioTracks.numTracks; t++) {
        var track = targetSequence.audioTracks[t];
        if (track.clips.numItems > 0) {
          trackType = 'audio';
          trackIndex = t;
          clips = track.clips;
          result.details.trackType = trackType;
          result.details.trackIndex = trackIndex;
          result.details.totalClips = clips.numItems;
          logToFile('INFO', '找到目标轨道', {
            trackType: 'audio',
            trackIndex: t,
            totalClips: clips.numItems,
          });
          break;
        }
      }
    }

    if (trackIndex === -1) {
      result.message = '序列中没有任何clips可以导出';
      logToFile('ERROR', '没有可导出的clips', {
        sequenceName: targetSequence.name,
        videoTracks: targetSequence.videoTracks.numTracks,
        audioTracks: targetSequence.audioTracks.numTracks,
      });
      restoreSequenceState();
      return JSON.stringify(result);
    }

    // 使用配置的路径（直接输出到voiceovers/{lang}/根目录）
    // Windows上AME需要反斜杠路径，macOS使用正斜杠
    // On Windows AME requires backslash paths, macOS uses forward slashes
    // Note: presetPath and outputDir are already defined at function start
    // 注意：presetPath 和 outputDir 已在函数开始处定义
    if ($.os.indexOf('Windows') !== -1) {
      presetPath = presetPath.replace(/\//g, '\\');
    }

    // 确保outputDir以路径分隔符结尾（Windows用反斜杠，macOS用正斜杠）
    // Ensure outputDir ends with path separator (backslash on Windows, forward slash on macOS)
    var pathSep = $.os.indexOf('Windows') !== -1 ? '\\' : '/';
    var lastChar = outputDir.charAt(outputDir.length - 1);
    if (lastChar !== '\\' && lastChar !== '/') {
      outputDir += pathSep;
    }

    // 更新result中的实际输出目录
    result.details.config.outputDir = outputDir;

    logToFile('INFO', '配置AME导出参数', {
      presetPath: presetPath,
      outputDir: outputDir,
      sequenceName: targetSequence.name,
    });

    // 确保输出目录存在
    var outFolder = new Folder(outputDir);
    if (!outFolder.exists) {
      if (!outFolder.create()) {
        result.message = '无法创建输出目录: ' + outputDir;
        logToFile('ERROR', '创建输出目录失败', {
          outputDir: outputDir,
        });
        restoreSequenceState();
        return JSON.stringify(result);
      }
      logToFile('INFO', '输出目录已创建', {
        outputDir: outputDir,
      });
    } else {
      logToFile('INFO', '输出目录已存在', {
        outputDir: outputDir,
      });
    }

    // 获取导出模式信息 - Get export mode info
    var exportModeInfo = getExportModeInfo();
    result.details.exportMode = exportModeInfo;

    logToFile('INFO', '导出模式', {
      type: exportModeInfo.type,
      description: exportModeInfo.description,
    });

    // 清理输出目录中的旧音频文件（增量模式：只删除范围内的文件）
    // Clean old audio files (incremental mode: only delete files in range)
    logToFile('INFO', '开始清理旧音频文件', {
      outputDir: outputDir,
      mode: exportModeInfo.type,
    });

    var deletedCount = 0;
    var skippedCount = 0;

    if (exportModeInfo.type === 'all') {
      // 全量模式：删除所有音频文件（保留original子目录）
      // Full mode: delete all audio files (keep original subdirectory)
      var items = outFolder.getFiles();

      for (var i = 0; i < items.length; i++) {
        var item = items[i];

        // 跳过original目录
        if (item instanceof Folder && item.name.toLowerCase() === 'original') {
          logToFile('INFO', '跳过original目录', {
            folderName: item.name,
          });
          skippedCount++;
          continue;
        }

        // 删除音频文件（使用config.jsx的isAudioFile函数）
        if (item instanceof File) {
          if (isAudioFile(item.name)) {
            if (item.remove()) {
              logToFile('INFO', '删除旧音频文件', {
                fileName: item.name,
              });
              deletedCount++;
            } else {
              logToFile('WARN', '无法删除文件', {
                fileName: item.name,
              });
            }
          } else {
            logToFile('INFO', '跳过非音频文件', {
              fileName: item.name,
            });
            skippedCount++;
          }
        }
      }
    } else {
      // 增量模式：只删除匹配原始素材的clips对应的文件
      // Incremental mode: only delete files for clips matching source material
      for (var ci = 0; ci < clips.numItems; ci++) {
        var clipIndex = ci + 1; // 1-based index，用于输出文件名 - for output filename
        var currentClip = clips[ci];
        var sourceIndex = extractSourceIndex(currentClip);

        if (shouldExportClip(currentClip)) {
          // 构建文件名并删除（文件名基于clip在序列中的位置）
          // Build filename and delete (filename based on clip position in sequence)
          var filename = FILE_NAMING_CONFIG.zeroPad ? zeroPad(clipIndex) : String(clipIndex);

          // 尝试删除所有可能的音频扩展名
          // Try to delete all possible audio extensions
          for (var ei = 0; ei < FILE_NAMING_CONFIG.audioExtensions.length; ei++) {
            var ext = FILE_NAMING_CONFIG.audioExtensions[ei];
            var targetFile = new File(outputDir + filename + ext);

            if (targetFile.exists) {
              if (targetFile.remove()) {
                logToFile('INFO', '删除匹配原始素材的音频文件', {
                  fileName: filename + ext,
                  clipIndex: clipIndex,
                  sourceIndex: sourceIndex,
                  sourceName: currentClip.projectItem ? currentClip.projectItem.name : 'unknown',
                });
                deletedCount++;
              } else {
                logToFile('WARN', '无法删除文件', {
                  fileName: filename + ext,
                });
              }
            }
          }
        } else {
          skippedCount++;
        }
      }
    }

    logToFile('INFO', '清理完成', {
      deletedCount: deletedCount,
      skippedCount: skippedCount,
      mode: exportModeInfo.type,
    });

    // 检查是否为仅同步映射模式 - Check if sync mapping only mode
    var syncMappingOnly = USER_CONFIG.SYNC_MAPPING_ONLY === true;

    if (syncMappingOnly) {
      logToFile('INFO', '仅同步映射模式 - 跳过导出，扫描所有clips生成映射', {
        totalClips: clips.numItems,
      });
    }

    // 批量导出clips（支持增量导出和仅同步映射模式）
    // Batch export clips (supports incremental export and sync mapping only mode)
    var seqsToDelete = [];
    var skippedClips = 0; // 跳过的clips计数 - Skipped clips count
    var scannedClips = 0; // 扫描的clips计数（仅同步模式）- Scanned clips count (sync only mode)

    logToFile('INFO', '开始批量处理clips', {
      totalClips: clips.numItems,
      exportMode: exportModeInfo.type,
      syncMappingOnly: syncMappingOnly,
    });

    for (var i = 0; i < clips.numItems; i++) {
      var clipIndex = i + 1; // 1-based index，用于输出文件名 - for output filename
      var clip = clips[i];
      var sourceIndex = extractSourceIndex(clip);
      var sourceName = clip.projectItem ? clip.projectItem.name : 'unknown';

      // 提取clip基本信息（所有模式通用）
      // Extract clip basic info (common for all modes)
      var name = clip.name;
      var seqInPoint = clip.start.ticks;
      var seqOutPoint = clip.end.ticks;
      var uniqueName = FILE_NAMING_CONFIG.zeroPad ? zeroPad(clipIndex) : String(clipIndex);

      // 始终记录clip信息到映射（确保clip_mapping.json完整）
      // Always record clip info to mapping (ensure clip_mapping.json is complete)
      var clipDetail = {
        index: clipIndex,
        name: name,
        sourceIndex: sourceIndex,
        sourceName: sourceName,
        seqInPoint: seqInPoint,
        seqOutPoint: seqOutPoint,
        outputFilename: uniqueName,
      };
      result.details.clips.push(clipDetail);

      // 仅同步映射模式：跳过导出，只记录映射
      // Sync mapping only mode: skip export, only record mapping
      if (syncMappingOnly) {
        scannedClips++;
        continue;
      }

      // 检查原始素材序号是否在导出范围内 - Check if source material index is in export range
      if (!shouldExportClip(clip)) {
        skippedClips++;
        logToFile('INFO', '跳过不匹配原始素材的clip', {
          clipIndex: clipIndex,
          clipName: clip.name,
          sourceIndex: sourceIndex,
          sourceName: sourceName,
          reason: 'Source material not in export range',
        });
        continue;
      }

      try {
        targetSequence.setInPoint(seqInPoint);
        targetSequence.setOutPoint(seqOutPoint);

        var subSeq = targetSequence.createSubsequence(true);

        // 为每个clip创建文件名（格式：两位数序号，基于clip在序列中的位置）
        // Create filename (format: zero-padded number, based on clip position in sequence)
        var outputPath = outputDir + uniqueName;

        app.encoder.encodeSequence(
          subSeq,
          outputPath,
          presetPath,
          AME_CONFIG.ENCODE_WORKAREA,
          AME_CONFIG.REMOVE_ON_COMPLETION
        );

        seqsToDelete.push(subSeq);
        result.exported++;

        logToFile('INFO', 'Clip导出成功', clipDetail);
      } catch (clipError) {
        var errorMsg = '处理clip失败: ' + name + ' - ' + clipError.toString();
        result.errors.push(errorMsg);
        logToFile('ERROR', 'Clip处理失败', {
          clipIndex: clipIndex,
          clipName: name,
          sourceIndex: sourceIndex,
          sourceName: sourceName,
          error: clipError.toString(),
        });
      }
    }

    // 记录跳过/扫描的clips数量 - Record skipped/scanned clips count
    result.details.skippedClips = skippedClips;
    result.details.scannedClips = scannedClips;
    result.details.syncMappingOnly = syncMappingOnly;

    // 仅同步模式跳过AME批处理和子序列清理
    // Sync mapping only mode skips AME batch and subsequence cleanup
    if (!syncMappingOnly) {
      // 启动批处理
      if (result.exported > 0) {
        logToFile('INFO', '启动AME批处理', {
          queuedClips: result.exported,
        });
        app.encoder.startBatch();
        logToFile('INFO', 'AME批处理已启动');
      }

      // 清理子序列
      for (var i = 0; i < seqsToDelete.length; i++) {
        app.project.deleteSequence(seqsToDelete[i]);
      }
      logToFile('INFO', '清理临时子序列完成', {
        deletedCount: seqsToDelete.length,
      });
    } else {
      logToFile('INFO', '仅同步映射模式 - 跳过AME批处理和子序列清理');
    }

    // 计算执行时间
    var endTime = new Date().getTime();
    result.details.timing.endTime = endTime;
    result.details.timing.durationMs = endTime - startTime;

    result.success = true;

    // 构建结果消息 - Build result message
    if (syncMappingOnly) {
      // Sync mapping only mode message / 仅同步映射模式消息
      result.message = '成功同步映射（扫描 ' + scannedClips + ' 个clips，未导出）';
    } else if (sceneModeInfo) {
      // Scene mode message / 场景模式消息
      result.message =
        '成功导出 ' +
        result.exported +
        ' 个clips（场景 [' +
        sceneModeInfo.scenes.join(', ') +
        ']，跳过 ' +
        skippedClips +
        ' 个）';
    } else if (exportModeInfo.type === 'all') {
      result.message = '成功导出 ' + result.exported + ' 个clips';
    } else {
      result.message = '成功导出 ' + result.exported + ' 个clips（跳过 ' + skippedClips + ' 个）';
    }
    if (result.errors.length > 0) {
      result.message += ' (有 ' + result.errors.length + ' 个错误)';
    }

    logToFile('INFO', syncMappingOnly ? '同步映射完成' : '批量导出完成', {
      success: true,
      exported: result.exported,
      scanned: scannedClips,
      skipped: skippedClips,
      total: clips.numItems,
      syncMappingOnly: syncMappingOnly,
      exportMode: sceneModeInfo ? 'scenes' : exportModeInfo.type,
      sceneMode: sceneModeInfo,
      errors: result.errors.length,
      durationMs: result.details.timing.durationMs,
      sequenceName: result.details.sequenceName,
      outputDir: outputDir,
    });

    // 生成 clip_mapping.json 映射文件
    // Generate clip_mapping.json mapping file
    // 格式：sourceIndex → clipIndices（原始素材编号 → clips 编号列表）
    var mappingGenerated = false;
    var mappingError = '';

    try {
      var sourceToClips = {};
      var clipToSource = {};
      var clipDurations = {}; // 新增：clip 时长映射（秒）
      var clipStartFramesPR = {}; // PR 序列中的实际位置（连续，无间隔）
      var clipStartFrames = {}; // 带 GAP 的计算位置（AE 使用，包含字幕 {GAP:n} 标记）

      // Premiere Pro 的 tick 到秒的转换率
      // Premiere Pro tick to seconds conversion rate
      var TICKS_PER_SECOND = 254016000000;

      // 获取序列帧率用于 tick 到帧的转换
      // Get sequence frame rate for tick to frame conversion
      var sequenceFrameRate = getSequenceFrameRate(targetSequence);

      for (var mi = 0; mi < result.details.clips.length; mi++) {
        var clipInfo = result.details.clips[mi];
        var srcIdx = clipInfo.sourceIndex;
        var clipIdx = clipInfo.index;

        // 计算 clip 时长（从序列时间轴位置）
        // Calculate clip duration (from sequence timeline position)
        var inTicks = parseInt(clipInfo.seqInPoint, 10);
        var outTicks = parseInt(clipInfo.seqOutPoint, 10);
        var durationSec = (outTicks - inTicks) / TICKS_PER_SECOND;
        clipDurations[clipIdx] = Math.round(durationSec * 1000) / 1000; // 保留3位小数

        // 计算 clip 起始帧（从 PR 序列时间轴位置，连续无间隔）
        // Calculate clip start frame from PR sequence timeline (continuous, no gap)
        var startSec = inTicks / TICKS_PER_SECOND;
        clipStartFramesPR[clipIdx] = Math.round(startSec * sequenceFrameRate);

        // 跳过无效的 sourceIndex
        if (srcIdx === -1 || srcIdx === undefined) {
          continue;
        }

        // sourceToClips: 一个原始素材可能对应多个 clips
        if (!sourceToClips[srcIdx]) {
          sourceToClips[srcIdx] = [];
        }
        sourceToClips[srcIdx].push(clipIdx);

        // clipToSource: 一个 clip 对应一个原始素材
        clipToSource[clipIdx] = srcIdx;
      }

      // ========== 读取字幕文件计算带 GAP 的起始帧 ==========
      // ========== Read subtitle file to calculate start frames with GAP ==========
      // Subtitle-based GAP calculation: only available in workflow mode (requires subtitle files)
      // 基于字幕的 GAP 计算：仅在工作流模式下可用（需要字幕文件）
      if (!CONFIG._standalone) {
        // 使用 getSubtitlePath() 获取正确的字幕路径（支持子项目）
        // Use getSubtitlePath() for correct subtitle path (supports subproject)
        var subtitleFilePath = getSubtitlePath(USER_CONFIG.LOCALE, USER_CONFIG.SUBPROJECT);
        var subtitleFile = new File(subtitleFilePath);
        var subtitles = getSubtitles(subtitleFile);

        // 警告：字幕文件不存在或为空时，所有clip将使用默认间隔（6帧）
        // WARNING: When subtitle file missing/empty, all clips use default gap (6 frames)
        if (!subtitleFile.exists) {
          logToFile(
            'WARNING',
            '字幕文件不存在，GAP标记将被忽略！所有clip使用默认间隔 - ' +
              'Subtitle file not found, GAP markers ignored! All clips use default gap',
            { subtitleFilePath: subtitleFilePath, defaultGap: DEFAULT_GAP_FRAMES }
          );
        } else if (subtitles.length === 0) {
          logToFile(
            'WARNING',
            '字幕文件为空，GAP标记将被忽略！所有clip使用默认间隔 - ' +
              'Subtitle file empty, GAP markers ignored! All clips use default gap',
            { subtitleFilePath: subtitleFilePath, defaultGap: DEFAULT_GAP_FRAMES }
          );
        }

        logToFile('INFO', '读取字幕文件计算 GAP - Reading subtitle file for GAP calculation', {
          subtitleFilePath: subtitleFilePath,
          subtitleCount: subtitles.length,
          totalClips: result.details.clips.length,
        });

        // 按 clip 顺序累加计算带 GAP 的起始帧
        // Calculate start frames with GAP by accumulating in clip order
        var currentFrame = 0;
        var totalClips = result.details.clips.length;

        for (var gi = 1; gi <= totalClips; gi++) {
          var subtitleIndex = gi - 1; // 字幕数组是 0-based
          var gapFrames = DEFAULT_GAP_FRAMES; // 默认 6 帧

          // 从字幕获取自定义 GAP（如果有）
          if (subtitleIndex < subtitles.length) {
            gapFrames = subtitles[subtitleIndex].gapFrames;
          }

          // 第一个 clip 不加前置间隔
          if (gi > 1) {
            currentFrame += gapFrames;
          }

          // 记录当前 clip 的起始帧（带 GAP）
          clipStartFrames[gi] = currentFrame;

          // 累加当前 clip 的 duration（帧）
          var durationFrames = Math.round(clipDurations[gi] * sequenceFrameRate);
          currentFrame += durationFrames;
        }

        logToFile('INFO', '带 GAP 的起始帧计算完成 - Start frames with GAP calculated', {
          firstClipStart: clipStartFrames[1],
          lastClipStart: clipStartFrames[totalClips],
          totalFrames: currentFrame,
        });
      } else {
        logToFile(
          'INFO',
          'Standalone mode: skipping subtitle-based GAP calculation (clipStartFrames will be empty)'
        );
      }

      // 构建映射路径（跨平台兼容）
      // Build mapping path (cross-platform compatible)
      var mappingFolder = new Folder(outputDir);
      var mappingFile = new File(mappingFolder.fsName + '/clip_mapping.json');

      mappingFile.encoding = 'UTF-8';
      var opened = mappingFile.open('w');

      if (opened) {
        // 手动构建 JSON 字符串以确保兼容性
        // Manually build JSON string for compatibility
        var jsonLines = [];
        jsonLines.push('{');

        // ExtendScript 兼容的日期格式化（toISOString 不可用）
        // ExtendScript compatible date formatting (toISOString not available)
        var now = new Date();
        var pad = function (n) {
          return n < 10 ? '0' + n : '' + n;
        };
        var dateStr =
          now.getFullYear() +
          '-' +
          pad(now.getMonth() + 1) +
          '-' +
          pad(now.getDate()) +
          'T' +
          pad(now.getHours()) +
          ':' +
          pad(now.getMinutes()) +
          ':' +
          pad(now.getSeconds());
        jsonLines.push('  "generatedAt": "' + dateStr + '",');
        jsonLines.push('  "locale": "' + locale + '",');
        jsonLines.push('  "sequenceName": "' + result.details.sequenceName + '",');
        jsonLines.push('  "totalClips": ' + clips.numItems + ',');

        // sourceToClips
        jsonLines.push('  "sourceToClips": {');
        var srcKeys = [];
        for (var sk in sourceToClips) {
          if (sourceToClips.hasOwnProperty(sk)) {
            srcKeys.push(sk);
          }
        }
        for (var si = 0; si < srcKeys.length; si++) {
          var sKey = srcKeys[si];
          var comma = si < srcKeys.length - 1 ? ',' : '';
          jsonLines.push('    "' + sKey + '": [' + sourceToClips[sKey].join(', ') + ']' + comma);
        }
        jsonLines.push('  },');

        // clipToSource
        jsonLines.push('  "clipToSource": {');
        var clipKeys = [];
        for (var ck in clipToSource) {
          if (clipToSource.hasOwnProperty(ck)) {
            clipKeys.push(ck);
          }
        }
        for (var ci = 0; ci < clipKeys.length; ci++) {
          var cKey = clipKeys[ci];
          var comma2 = ci < clipKeys.length - 1 ? ',' : '';
          jsonLines.push('    "' + cKey + '": ' + clipToSource[cKey] + comma2);
        }
        jsonLines.push('  },');

        // clipDurations - clip 时长（秒），用于 AE 端优化导入速度
        // clipDurations - clip duration in seconds, for AE import optimization
        jsonLines.push('  "clipDurations": {');
        var durKeys = [];
        for (var dk in clipDurations) {
          if (clipDurations.hasOwnProperty(dk)) {
            durKeys.push(dk);
          }
        }
        // 按数字排序
        durKeys.sort(function (a, b) {
          return parseInt(a, 10) - parseInt(b, 10);
        });
        for (var di = 0; di < durKeys.length; di++) {
          var dKey = durKeys[di];
          var comma3 = di < durKeys.length - 1 ? ',' : '';
          jsonLines.push('    "' + dKey + '": ' + clipDurations[dKey] + comma3);
        }
        jsonLines.push('  },');

        // clipStartFramesPR - PR 序列中的原始位置（连续无间隔，用于调试）
        // clipStartFramesPR - Original position in PR sequence (continuous, no gap, for debugging)
        jsonLines.push('  "clipStartFramesPR": {');
        var prKeys = [];
        for (var pk in clipStartFramesPR) {
          if (clipStartFramesPR.hasOwnProperty(pk)) {
            prKeys.push(pk);
          }
        }
        prKeys.sort(function (a, b) {
          return parseInt(a, 10) - parseInt(b, 10);
        });
        for (var pi = 0; pi < prKeys.length; pi++) {
          var pKey = prKeys[pi];
          var comma4 = pi < prKeys.length - 1 ? ',' : '';
          jsonLines.push('    "' + pKey + '": ' + clipStartFramesPR[pKey] + comma4);
        }
        jsonLines.push('  },');

        // clipStartFrames - 带 GAP 的计算位置（AE 使用，包含字幕 {GAP:n} 标记）
        // clipStartFrames - Calculated position with GAP (for AE, includes {GAP:n} markers)
        jsonLines.push('  "clipStartFrames": {');
        var startKeys = [];
        for (var sk2 in clipStartFrames) {
          if (clipStartFrames.hasOwnProperty(sk2)) {
            startKeys.push(sk2);
          }
        }
        startKeys.sort(function (a, b) {
          return parseInt(a, 10) - parseInt(b, 10);
        });
        for (var si2 = 0; si2 < startKeys.length; si2++) {
          var sKey2 = startKeys[si2];
          var comma5 = si2 < startKeys.length - 1 ? ',' : '';
          jsonLines.push('    "' + sKey2 + '": ' + clipStartFrames[sKey2] + comma5);
        }
        jsonLines.push('  }');
        jsonLines.push('}');

        mappingFile.write(jsonLines.join('\n'));
        mappingFile.close();

        result.details.mappingFile = mappingFile.fsName;
        mappingGenerated = true;

        logToFile('INFO', '生成 clip_mapping.json', {
          path: mappingFile.fsName,
          sourceCount: srcKeys.length,
          clipCount: clipKeys.length,
        });
      } else {
        mappingError = 'Cannot open file: ' + mappingFile.fsName;
        logToFile('WARN', '生成映射文件失败', { error: mappingError });
      }
    } catch (e) {
      mappingError = e.toString() + ' (line: ' + e.line + ')';
      logToFile('WARN', '生成映射文件异常', { error: mappingError });
    }

    result.details.mappingGenerated = mappingGenerated;
    if (mappingError) {
      result.details.mappingError = mappingError;
    }

    restoreSequenceState();
    return JSON.stringify(result);
  } catch (e) {
    result.message = '批量导出失败: ' + e.toString() + ' (行号: ' + e.line + ')';

    var endTime = new Date().getTime();
    result.details.timing.endTime = endTime;
    result.details.timing.durationMs = endTime - startTime;

    logToFile('ERROR', '批量导出异常', {
      error: e.toString(),
      line: e.line,
      fileName: e.fileName || 'unknown',
      durationMs: result.details.timing.durationMs,
    });

    restoreSequenceState();
    return JSON.stringify(result);
  }
}

// 执行批量导出并返回结果 - Execute batch export and return result
var exportResult = exportClips();
exportResult;
