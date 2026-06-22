/**
 * Common Configuration for Premiere Pro / Premiere Pro 通用配置
 *
 * This file contains common configuration shared across all PR scripts.
 * 本文件包含所有PR脚本共享的通用配置。
 *
 * Configuration Hierarchy / 配置层次结构:
 * - .env: Environment variables (paths, ports, etc.) / 环境变量（路径、端口等）
 * - CONFIG (global): Injected from hostscript.jsx / 从hostscript.jsx注入的全局对象
 * - config.jsx (this file): Common defaults / 通用默认配置
 * - Script-level USER_CONFIG: Script-specific settings / 脚本特定设置
 *
 * @author Claude Code
 * @version 1.3.0
 */

// ====================================================================
// Standalone Mode Configuration / 独立运行模式配置
// ====================================================================
//
// For standalone execution (via run_pr_scripts.bat), edit the values below.
// In workflow mode (CEP/Bridge), this block is ignored - CONFIG is injected by hostscript.jsx.
//
// 独立运行时（通过 run_pr_scripts.bat 执行），编辑下方的值。
// 工作流模式（CEP/Bridge）下，此区域被忽略 - CONFIG 由 hostscript.jsx 注入。

var STANDALONE_CONFIG = {
  // [REQUIRED] Project file path (.prproj) - auto-opened in standalone mode
  // Set to '' to skip (if project is already open or using welcome screen)
  // TIP: Paste path from Windows Explorer, then replace \ with /
  // [必填] 项目文件路径（.prproj）- 独立模式下自动打开
  // 设为 '' 可跳过（如果项目已打开或使用欢迎界面）
  // 提示：从 Windows 资源管理器粘贴路径后，把 \ 替换成 /
  projectPath: 'D:/Demo/main.prproj',

  // [REQUIRED] AME audio export preset path (forward slashes, auto-converted at runtime)
  // Find your presets: Edit > Preferences in AME, or check:
  //   C:/Users/{username}/Documents/Adobe/Adobe Media Encoder/{version}/Presets/
  // TIP: Paste path from Windows Explorer, then replace \ with /
  // [必填] AME 音频导出预设路径（正斜杠格式，运行时自动转换）
  // 查找方法：AME > 编辑 > 首选项，或查看上述目录
  // 提示：从 Windows 资源管理器粘贴路径后，把 \ 替换成 /
  amePresetPath: 'C:/Users/doer/Documents/Adobe/Adobe Media Encoder/26.0/Presets/WAV 48 kHz 16-bit Normalized.epr',

  // [REQUIRED] Output directory for exported clips (forward slashes)
  // [必填] 导出文件的输出目录（正斜杠格式）
  outputDir: 'D:/Demo/voiceovers/',

  // [OPTIONAL] Sequence name to export clips from (default: 'processed')
  // Use lowercase + underscores, no spaces or special characters (e.g., 'processed', 'raw_audio')
  // [可选] 导出clips的源序列名称（默认：'processed'）
  // 使用小写字母+下划线，不含空格或特殊符号（如 'processed', 'raw_audio'）
  sequenceName: 'processed',

  // [OPTIONAL] Locale for messages (default: 'en')
  // [可选] 消息语言（默认：'en'）
  locale: 'en',

  // --- import_clips fields ---

  // [REQUIRED for import_clips] Audio source directory (forward slashes)
  // [import_clips 必填] 音频文件目录（正斜杠格式）
  audioSourceDir: '',  // e.g., 'D:/MyProject/voiceovers/en/'

  // [OPTIONAL] Subtitle file path for GAP markers (forward slashes)
  // Leave empty to use default gap (6 frames). Fill in to enable {GAP:n} custom spacing.
  // [可选] 字幕文件路径，用于 {GAP:n} 标记控制间隔。留空则使用默认间隔（6帧）
  subtitleFilePath: '',  // e.g., 'D:/MyProject/subtitles/en.txt'

  // --- export_video fields ---

  // [REQUIRED for export_video] AME video export preset path (H.264, forward slashes)
  // [export_video 必填] AME 视频导出预设路径（H.264，正斜杠格式）
  ameVideoPresetPath: '',  // e.g., 'C:/Users/doer/Documents/Adobe/Adobe Media Encoder/25.0/Presets/YouTube 1080p HD.epr'

  // [REQUIRED for export_video] Video output directory (forward slashes)
  // [export_video 必填] 视频输出目录（正斜杠格式）
  videoOutputDir: '',  // e.g., 'D:/MyProject/videos/en/'
};

// ====================================================================
// Standalone Mode Bootstrap / 独立模式引导
// ====================================================================
// Auto-detect: if CONFIG exists (CEP/workflow mode), skip.
// If CONFIG is undefined (standalone), build it from STANDALONE_CONFIG.
// 自动检测：如果 CONFIG 存在（CEP/工作流模式），跳过。
// 如果 CONFIG 未定义（独立模式），从 STANDALONE_CONFIG 构建。

// NOTE: Do NOT use "var CONFIG = ..." here!
// When exec-script wraps code in an IIFE, "var CONFIG" would be hoisted
// to the IIFE scope, creating a local undefined variable that shadows
// the global CONFIG from hostscript.jsx. Using assignment without var
// correctly accesses the global CONFIG in workflow mode, and creates
// an implicit global in standalone mode (expected ES3 behavior).
// 注意：此处不要使用 "var CONFIG = ..."！
// 当 exec-script 将代码包裹在 IIFE 中时，"var CONFIG" 会被提升到 IIFE 作用域，
// 创建一个局部 undefined 变量，遮蔽 hostscript.jsx 中的全局 CONFIG。
if (typeof CONFIG === 'undefined') {
  CONFIG = {
    amePresetPath: STANDALONE_CONFIG.amePresetPath,
    ameVideoPresetPath: STANDALONE_CONFIG.ameVideoPresetPath,
    locale: STANDALONE_CONFIG.locale || 'en',
    projectRoot: '',
    prProjectPath: '',
    _standalone: true,              // Internal flag: standalone mode active / 内部标志：独立模式激活
    _outputDir: STANDALONE_CONFIG.outputDir,  // Direct output path override / 直接输出路径覆盖
    _audioSourceDir: STANDALONE_CONFIG.audioSourceDir,  // Direct audio source path / 直接音频源路径
    _subtitleFilePath: STANDALONE_CONFIG.subtitleFilePath,  // Direct subtitle path / 直接字幕路径
    _videoOutputDir: STANDALONE_CONFIG.videoOutputDir,  // Direct video output path / 直接视频输出路径
    _sequenceName: STANDALONE_CONFIG.sequenceName,  // Default sequence name for export / 导出用默认序列名
  };

  // Auto-open project in standalone mode / 独立模式自动打开项目
  if (STANDALONE_CONFIG.projectPath) {
    var _projFile = new File(STANDALONE_CONFIG.projectPath);
    if (!_projFile.exists) {
      // Project file not found - stop immediately / 项目文件不存在 - 立即停止
      alert('Project file not found / 项目文件不存在:\n' + STANDALONE_CONFIG.projectPath
        + '\n\nCheck projectPath in config.jsx / 请检查 config.jsx 中的 projectPath');
      throw new Error('Project file not found: ' + STANDALONE_CONFIG.projectPath);
    }
    // Check if project is already open / 检查项目是否已打开
    var _needOpen = true;
    if (app.project && app.project.path) {
      var _currentPath = app.project.path.replace(/\\/g, '/');
      var _targetPath = STANDALONE_CONFIG.projectPath.replace(/\\/g, '/');
      if (_currentPath.toLowerCase() === _targetPath.toLowerCase()) {
        _needOpen = false;
      }
    }
    if (_needOpen) {
      app.openDocument(_projFile.fsName);
    }
  }
}

// ====================================================================
// Standalone Logging Fallback / 独立模式日志回退
// ====================================================================
// In workflow mode, logToFile() is defined in hostscript.jsx (writes to CEP log file).
// In standalone mode, fall back to ExtendScript console output.
// 工作流模式下 logToFile() 由 hostscript.jsx 定义（写入 CEP 日志文件）。
// 独立模式下回退到 ExtendScript 控制台输出。

if (typeof logToFile === 'undefined') {
  function logToFile(level, message, data) {
    var dataStr = '';
    if (data) {
      try {
        dataStr = ' | ' + (typeof JSON !== 'undefined' ? JSON.stringify(data) : String(data));
      } catch (e) {
        dataStr = ' | [data]';
      }
    }
    $.writeln('[' + level + '] ' + message + dataStr);
  }
}

// ====================================================================
// Basic PR Project Constants / 基础PR项目常量
// ====================================================================

/**
 * Premiere Pro Ticks per Second / PR每秒的ticks数
 *
 * PR uses ticks for precise time calculations.
 * PR使用ticks进行精确的时间计算。
 *
 * @constant {number}
 */
var TICKS_PER_SECOND = 254016000000;

/**
 * Default Frame Rate / 默认帧率
 *
 * Used as fallback when sequence frame rate cannot be determined.
 * 当无法确定序列帧率时用作备用值。
 *
 * @constant {number}
 */
var DEFAULT_FRAME_RATE = 30;

// ====================================================================
// Subtitle and GAP Configuration / 字幕和间隔配置
// ====================================================================

/**
 * Default Gap Frames Between Audio Clips / 音频片段之间的默认间隔帧数
 *
 * 使用前置间隔语义：间隔在音频之前（即在该clip前等待n帧）
 * Pre-gap semantics: gap is placed BEFORE the audio (wait n frames before this clip)
 *
 * Can be overridden with {GAP:n} marker in subtitle lines.
 * 可通过字幕行中的 {GAP:n} 标记覆盖。
 *
 * @constant {number}
 */
var DEFAULT_GAP_FRAMES = 6;

/**
 * GAP Marker Regular Expression / GAP标记正则表达式
 *
 * Matches format: {GAP:number} at the beginning of a line.
 * 匹配格式：行首的 {GAP:数字}。
 *
 * 前置间隔语义说明 / Pre-gap Semantics:
 * - {GAP:n} 表示该行音频之前等待n帧
 * - {GAP:n} means wait n frames BEFORE this audio line
 *
 * @example
 * // {GAP:30}同步完成 → 该行音频之前间隔30帧（约1秒@30fps）
 * // {GAP:30}Sync complete → 30 frames gap BEFORE this audio (~1s @30fps)
 * // {GAP:0}紧跟上句 → 该行音频紧跟上一行，无间隔
 * // {GAP:0}Quick follow → No gap, immediately follows previous audio
 *
 * @constant {RegExp}
 */
var GAP_MARKER_REGEX = /^\{GAP:(\d+)\}/;

// ====================================================================
// AME (Adobe Media Encoder) Configuration / AME编码配置
// ====================================================================

/**
 * AME Encoding Options / AME编码选项
 *
 * Used by app.encoder.encodeSequence() calls.
 * 由 app.encoder.encodeSequence() 调用使用。
 */
var AME_CONFIG = {
  /**
   * Encode Workarea Mode / 编码工作区模式
   *
   * 0 = ENCODE_WORKAREA (export sequence based on in/out points)
   * 1 = ENCODE_IN_TO_OUT
   * 2 = ENCODE_ENTIRE
   */
  ENCODE_WORKAREA: 0,

  /**
   * Remove on Completion / 完成后从队列移除
   *
   * 1 = Remove from AME queue after completion / 完成后从AME队列移除
   * 0 = Keep in queue / 保留在队列中
   */
  REMOVE_ON_COMPLETION: 1,
};

// ====================================================================
// File Naming Configuration / 文件命名配置
// ====================================================================

/**
 * File Naming Options / 文件命名选项
 */
var FILE_NAMING_CONFIG = {
  /**
   * Zero-pad Filename Numbers / 文件名数字补零
   *
   * true: 01, 02, ... / false: 1, 2, ...
   */
  zeroPad: true,

  /**
   * Default Audio File Extension / 默认音频文件扩展名
   */
  audioExtension: '.wav',

  /**
   * Audio File Extensions for Cleanup / 清理时识别的音频文件扩展名
   */
  audioExtensions: ['.wav', '.mp3', '.aac', '.flac', '.m4a', '.ogg'],

  /**
   * Video File Extensions / 视频文件扩展名
   */
  videoExtensions: ['.mp4', '.mov', '.avi'],
};

// ====================================================================
// Project Folder Names / 项目文件夹名称
// ====================================================================

/**
 * Standard Resource Directory Names / 标准资源目录名称
 *
 * Matches the structure used in video creation projects.
 * 匹配视频创作项目使用的结构。
 */
var RESOURCE_DIRS = {
  VOICEOVERS: 'voiceovers',
  SUBTITLES: 'subtitles',
  VIDEOS: 'videos',
  IMAGES: 'images',
  SFX: 'sfxs',
  BGM: 'bgms',
};

// ====================================================================
// Path Utility Functions / 路径工具函数
// ====================================================================

/**
 * Normalize path separators based on OS / 根据操作系统标准化路径分隔符
 *
 * @param {string} path - Path to normalize / 要标准化的路径
 * @param {boolean} [toWindows] - Force Windows format (backslash) / 强制Windows格式（反斜杠）
 * @returns {string} Normalized path / 标准化后的路径
 *
 * @example
 * normalizePath('D:/Videos/chapter', true);  // Returns: 'D:\\Videos\\chapter'
 * normalizePath('D:\\Videos\\chapter', false); // Returns: 'D:/Videos/chapter'
 */
function normalizePath(path, toWindows) {
  if (typeof toWindows === 'undefined') {
    // Auto-detect based on OS / 根据操作系统自动检测
    toWindows = $.os.indexOf('Windows') !== -1;
  }

  if (toWindows) {
    return path.replace(/\//g, '\\');
  } else {
    return path.replace(/\\/g, '/');
  }
}

/**
 * Ensure path ends with separator / 确保路径以分隔符结尾
 *
 * @param {string} path - Path to check / 要检查的路径
 * @returns {string} Path with trailing separator / 带尾部分隔符的路径
 */
function ensureTrailingSeparator(path) {
  var sep = $.os.indexOf('Windows') !== -1 ? '\\' : '/';
  var lastChar = path.charAt(path.length - 1);

  if (lastChar !== '\\' && lastChar !== '/') {
    return path + sep;
  }
  return path;
}

// NOTE: getChapter() has been removed.
// Resources are now at {projectRoot}/{resourceType}/{locale}/ directly,
// with no chapter intermediate layer.
// See MEMORY.md: "CONFIG.chapter 已移除"
// 注意：getChapter() 已移除。资源路径直接从 projectRoot 拼接，无 chapter 中间层。

/**
 * Get locale for resource paths / 获取资源路径的语言环境
 *
 * Priority: userLocale parameter > CONFIG.locale > 'zh' (default)
 * 优先级：userLocale参数 > CONFIG.locale > 'zh'（默认）
 *
 * @param {string} [userLocale] - User-specified locale override / 用户指定的语言环境覆盖
 * @returns {string} Locale code ('zh' or 'en')
 */
function getLocale(userLocale) {
  return userLocale || (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.locale) || 'zh';
}

/**
 * Build resource directory path / 构建资源目录路径
 *
 * Path structure (no chapter layer):
 * - Main: {projectRoot}/{resourceType}/{locale}/
 * - Subproject: {projectRoot}/{resourceType}/{subproject}/{locale}/
 *
 * @param {string} resourceType - Resource type from RESOURCE_DIRS / RESOURCE_DIRS中的资源类型
 * @param {string} [userLocale] - Optional locale override / 可选的语言环境覆盖
 * @param {string} [subproject] - Optional subproject name (e.g., 'hook') / 子项目名称（如 'hook'）
 * @returns {string} Full path to resource directory (Windows format)
 *
 * @example
 * getResourcePath(RESOURCE_DIRS.VOICEOVERS);
 * // Returns: 'D:\\...\\export_clips\\voiceovers\\zh\\'
 *
 * @example
 * getResourcePath(RESOURCE_DIRS.VOICEOVERS, 'zh', 'hook');
 * // Returns: 'D:\\...\\export_clips\\voiceovers\\hook\\zh\\'
 */
function getResourcePath(resourceType, userLocale, subproject) {
  if (typeof CONFIG === 'undefined' || !CONFIG || !CONFIG.projectRoot) {
    throw new Error('CONFIG.projectRoot not configured');
  }

  var normalizedRoot = normalizePath(CONFIG.projectRoot, false);
  var locale = getLocale(userLocale);

  var path;
  if (subproject) {
    // Subproject: {projectRoot}/{resourceType}/{subproject}/{locale}/
    path = normalizedRoot + '/' + resourceType + '/' + subproject + '/' + locale + '/';
  } else {
    // Main: {projectRoot}/{resourceType}/{locale}/
    path = normalizedRoot + '/' + resourceType + '/' + locale + '/';
  }

  return normalizePath(path, true);
}

/**
 * Get videos root directory path (without locale) / 获取视频根目录路径（不含locale）
 *
 * Used for fallback search when locale directory doesn't have the file.
 * 当locale目录没有文件时，用于回退搜索。
 *
 * @returns {string} Full path to videos root directory (Windows format)
 *
 * @example
 * getVideosRootPath(); // Returns: 'D:\\...\\export_clips\\videos\\'
 */
function getVideosRootPath() {
  if (typeof CONFIG === 'undefined' || !CONFIG || !CONFIG.projectRoot) {
    throw new Error('CONFIG.projectRoot not configured');
  }

  var normalizedRoot = normalizePath(CONFIG.projectRoot, false);

  var path = normalizedRoot + '/' + RESOURCE_DIRS.VIDEOS + '/';

  return normalizePath(path, true);
}

/**
 * Get subtitle file path / 获取字幕文件路径
 *
 * @param {string} [userLocale] - Optional locale override / 可选的语言环境覆盖
 * @param {string} [subproject] - Optional subproject name (e.g., 'hook') / 子项目名称（如 'hook'）
 * @returns {string} Full path to subtitle file (Windows format)
 *
 * @example
 * getSubtitlePath(); // Returns: 'D:\\...\\export_clips\\subtitles\\zh.txt'
 * getSubtitlePath('en'); // Returns: 'D:\\...\\export_clips\\subtitles\\en.txt'
 * getSubtitlePath('zh', 'hook'); // Returns: 'D:\\...\\export_clips\\subtitles\\hook\\zh.txt'
 */
function getSubtitlePath(userLocale, subproject) {
  if (typeof CONFIG === 'undefined' || !CONFIG || !CONFIG.projectRoot) {
    throw new Error('CONFIG.projectRoot not configured');
  }

  var normalizedRoot = normalizePath(CONFIG.projectRoot, false);
  var locale = getLocale(userLocale);

  var path;
  if (subproject) {
    // Subproject: {projectRoot}/subtitles/{subproject}/{locale}.txt
    path =
      normalizedRoot + '/' + RESOURCE_DIRS.SUBTITLES + '/' + subproject + '/' + locale + '.txt';
  } else {
    // Main: {projectRoot}/subtitles/{locale}.txt
    path =
      normalizedRoot + '/' + RESOURCE_DIRS.SUBTITLES + '/' + locale + '.txt';
  }

  return normalizePath(path, true);
}

/**
 * Get sequence frame rate with fallback / 获取序列帧率（带备用值）
 *
 * PR's sequence.framerate may be undefined, need to calculate from timebase.
 * PR的sequence.framerate可能为undefined，需要从timebase计算。
 *
 * @param {Sequence} sequence - PR Sequence object / PR序列对象
 * @returns {number} Frame rate / 帧率
 *
 * @example
 * var fps = getSequenceFrameRate(app.project.activeSequence);
 */
function getSequenceFrameRate(sequence) {
  if (!sequence) {
    return DEFAULT_FRAME_RATE;
  }

  var frameRate = sequence.framerate;

  if (typeof frameRate === 'undefined' || frameRate === null || isNaN(frameRate)) {
    // Calculate from timebase / 从timebase计算
    var timebase = parseInt(sequence.timebase, 10);

    if (timebase > 0) {
      frameRate = TICKS_PER_SECOND / timebase;
    } else {
      frameRate = DEFAULT_FRAME_RATE;
    }
  }

  return frameRate;
}

/**
 * Convert frames to seconds / 帧转换为秒
 *
 * @param {number} frames - Number of frames / 帧数
 * @param {number} [frameRate] - Frame rate (default: DEFAULT_FRAME_RATE) / 帧率
 * @returns {number} Time in seconds / 秒数
 */
function framesToSeconds(frames, frameRate) {
  var fps = frameRate || DEFAULT_FRAME_RATE;
  return frames / fps;
}

/**
 * Convert seconds to frames / 秒转换为帧
 *
 * @param {number} seconds - Time in seconds / 秒数
 * @param {number} [frameRate] - Frame rate (default: DEFAULT_FRAME_RATE) / 帧率
 * @returns {number} Number of frames / 帧数
 */
function secondsToFrames(seconds, frameRate) {
  var fps = frameRate || DEFAULT_FRAME_RATE;
  return Math.round(seconds * fps);
}

// ====================================================================
// Subtitle Parsing Functions / 字幕解析函数
// ====================================================================

/**
 * Parse subtitle line to extract GAP marker and text content
 * 解析字幕行，提取GAP标记和文本内容
 *
 * @param {string} line - Subtitle line (trimmed) / 字幕行（已去除首尾空白）
 * @param {number} [defaultGapFrames] - Default gap frames / 默认间隔帧数
 * @returns {{text: string, gapFrames: number, isCustomGap: boolean}} Parsed result
 *
 * @example
 * parseSubtitleLine('{GAP:10}Hello world', 6);
 * // Returns: { text: 'Hello world', gapFrames: 10, isCustomGap: true }
 *
 * parseSubtitleLine('Normal text', 6);
 * // Returns: { text: 'Normal text', gapFrames: 6, isCustomGap: false }
 */
function parseSubtitleLine(line, defaultGapFrames) {
  var defaultGap = typeof defaultGapFrames === 'number' ? defaultGapFrames : DEFAULT_GAP_FRAMES;
  var match = line.match(GAP_MARKER_REGEX);

  if (match) {
    var gapValue = parseInt(match[1], 10);
    var textContent = line.replace(GAP_MARKER_REGEX, '').replace(/^\s+/, '');

    return {
      text: textContent,
      gapFrames: gapValue,
      isCustomGap: true,
    };
  }

  return {
    text: line,
    gapFrames: defaultGap,
    isCustomGap: false,
  };
}

/**
 * Check if subtitle line should be skipped / 检查字幕行是否应该被跳过
 *
 * Skips: empty lines, time markers [0:00-0:15], director comments [Note], stage directions 【Pause】
 * 跳过：空行、时间标记、导演注释、舞台指示
 *
 * @param {string} line - Subtitle line / 字幕行
 * @returns {boolean} True if should be skipped / 如果应该跳过则返回true
 */
function shouldSkipSubtitleLine(line) {
  var trimmedLine = line.replace(/^\s+|\s+$/g, '');

  // Skip empty lines / 跳过空行
  if (trimmedLine === '') {
    return true;
  }

  // Skip all bracket markers / 跳过所有方括号标记
  if (/^\[.*\]$/.test(trimmedLine)) {
    return true;
  }

  // Skip Chinese comment markers / 跳过中文注释标记
  if (/【.*】/.test(trimmedLine)) {
    return true;
  }

  return false;
}

/**
 * Read subtitles from file / 从文件读取字幕
 *
 * @param {File} file - Subtitle file object / 字幕文件对象
 * @returns {Array<{text: string, gapFrames: number, isCustomGap: boolean}>} Subtitle objects
 */
function getSubtitles(file) {
  var subtitles = [];

  if (!file || !file.exists) {
    return subtitles;
  }

  file.open('r');
  var content = file.read();
  file.close();

  var lines = content.split('\n');

  for (var i = 0; i < lines.length; i++) {
    if (!shouldSkipSubtitleLine(lines[i])) {
      var trimmedLine = lines[i].replace(/^\s+|\s+$/g, '');
      var parsed = parseSubtitleLine(trimmedLine, DEFAULT_GAP_FRAMES);
      subtitles.push(parsed);
    }
  }

  return subtitles;
}

// ====================================================================
// Project Item Utility Functions / 项目素材工具函数
// ====================================================================

/**
 * Recursively find project item by name / 递归按名称查找项目素材
 *
 * Searches through bins and nested folders.
 * 搜索bins和嵌套文件夹。
 *
 * @param {string} itemName - Item name to find / 要查找的素材名称
 * @param {ProjectItem} [parentItem] - Parent item to search from / 从哪个父级开始搜索
 * @returns {ProjectItem|null} Found item or null / 找到的素材或null
 */
function findProjectItem(itemName, parentItem) {
  if (!parentItem) {
    parentItem = app.project.rootItem;
  }

  for (var i = 0; i < parentItem.children.numItems; i++) {
    var item = parentItem.children[i];

    if (item.name === itemName) {
      return item;
    }

    // If it's a BIN (type 2), search recursively / 如果是BIN，递归搜索
    if (item.type === 2 && item.children) {
      var found = findProjectItem(itemName, item);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

/**
 * Find sequence by name with locale path matching / 按名称查找序列（带locale路径匹配）
 *
 * When multiple sequences with the same name exist, prioritizes sequences
 * whose treePath contains the specified locale.
 * 当存在多个同名序列时，优先选择treePath包含指定locale的序列。
 *
 * @param {string} sequenceName - Sequence name to find / 要查找的序列名称
 * @param {string} [userLocale] - Optional locale for path matching / 可选的locale用于路径匹配
 * @returns {Sequence|null} Found sequence or null / 找到的序列或null
 */
function findSequenceByName(sequenceName, userLocale) {
  if (!app.project || app.project.sequences.numSequences === 0) {
    return null;
  }

  var locale = getLocale(userLocale);
  var candidateSequences = [];

  for (var s = 0; s < app.project.sequences.numSequences; s++) {
    var seq = app.project.sequences[s];

    if (seq.name === sequenceName) {
      var seqItem = seq.projectItem;
      var parentPath = '';

      if (seqItem && seqItem.treePath) {
        parentPath = seqItem.treePath;
      }

      var matchesLocale =
        parentPath.indexOf('/' + locale + '/') !== -1 ||
        parentPath.indexOf('\\' + locale + '\\') !== -1 ||
        parentPath.indexOf('/' + locale) === parentPath.length - locale.length - 1;

      candidateSequences.push({
        sequence: seq,
        index: s,
        parentPath: parentPath,
        matchesLocale: matchesLocale,
      });
    }
  }

  // Prioritize sequence matching locale / 优先选择匹配locale的序列
  for (var c = 0; c < candidateSequences.length; c++) {
    if (candidateSequences[c].matchesLocale) {
      return candidateSequences[c].sequence;
    }
  }

  // Fallback to first candidate / 回退到第一个候选
  if (candidateSequences.length > 0) {
    return candidateSequences[0].sequence;
  }

  return null;
}

// ====================================================================
// File Utility Functions / 文件工具函数
// ====================================================================

/**
 * Remove file if it exists / 删除文件（如果存在）
 *
 * @param {File} file - File to remove / 要删除的文件
 * @returns {boolean} True if removed or didn't exist / 删除成功或不存在返回true
 */
function removeFileIfExists(file) {
  if (!file || !file.exists) {
    return true;
  }

  try {
    return file.remove();
  } catch (e) {
    return false;
  }
}

/**
 * Recursively delete folder and all its contents / 递归删除文件夹及其所有内容
 *
 * @param {Folder} folder - Folder to delete / 要删除的文件夹
 * @returns {boolean} True if deleted successfully / 删除成功返回true
 */
function removeFolderRecursive(folder) {
  if (!folder || !folder.exists) {
    return true;
  }

  try {
    var items = folder.getFiles();

    for (var i = 0; i < items.length; i++) {
      var item = items[i];

      if (item instanceof Folder) {
        if (!removeFolderRecursive(item)) {
          return false;
        }
      } else if (item instanceof File) {
        if (!item.remove()) {
          return false;
        }
      }
    }

    return folder.remove();
  } catch (e) {
    return false;
  }
}

/**
 * Check if file is an audio file by extension / 通过扩展名检查文件是否为音频文件
 *
 * @param {string} fileName - File name to check / 要检查的文件名
 * @returns {boolean} True if audio file / 如果是音频文件返回true
 */
function isAudioFile(fileName) {
  var ext = '.' + fileName.toLowerCase().split('.').pop();

  for (var i = 0; i < FILE_NAMING_CONFIG.audioExtensions.length; i++) {
    if (ext === FILE_NAMING_CONFIG.audioExtensions[i]) {
      return true;
    }
  }

  return false;
}

/**
 * Zero-pad a number to specified length / 数字补零到指定长度
 *
 * @param {number} num - Number to pad / 要补零的数字
 * @param {number} [length=2] - Target length / 目标长度
 * @returns {string} Padded number string / 补零后的数字字符串
 *
 * @example
 * zeroPad(5);    // Returns: '05'
 * zeroPad(5, 3); // Returns: '005'
 * zeroPad(15);   // Returns: '15'
 */
function zeroPad(num, length) {
  var len = length || 2;
  var str = String(num);

  while (str.length < len) {
    str = '0' + str;
  }

  return str;
}

// ====================================================================
// I18N Messages / 国际化消息
// ====================================================================

/**
 * PR Script Messages / PR脚本消息
 *
 * Bilingual messages for PR scripts.
 * PR脚本的双语消息。
 */
var PR_MESSAGES = {
  // export_video.jsx messages
  'export.success': {
    zh: '成功导出序列',
    en: 'Successfully exported sequence',
  },
  'export.no_project': {
    zh: '没有打开的项目或序列',
    en: 'No project or sequence is open',
  },
  'export.sequence_not_found': {
    zh: "找不到名为 '{name}' 的序列",
    en: "Cannot find sequence named '{name}'",
  },
  'export.create_dir_failed': {
    zh: '创建输出目录失败',
    en: 'Failed to create output directory',
  },
  'export.delete_file_failed': {
    zh: '删除输出文件失败',
    en: 'Failed to delete output file',
  },
  'export.ame_failed': {
    zh: 'AME编码失败',
    en: 'AME encoding failed',
  },
  'export.failed': {
    zh: '导出失败',
    en: 'Export failed',
  },

  // import_clips.jsx messages
  'import.success': {
    zh: '成功导入音频文件',
    en: 'Successfully imported audio files',
  },
  'import.no_project': {
    zh: '没有打开的项目',
    en: 'No project is open',
  },
  'import.no_sequence': {
    zh: '没有活动序列',
    en: 'No active sequence',
  },
};

/**
 * Get localized text from PR_MESSAGES / 从PR_MESSAGES获取本地化文本
 *
 * @param {string} key - Message key / 消息键
 * @param {Object} [params] - Optional parameters for placeholder replacement / 可选的占位符替换参数
 * @returns {string} Localized message / 本地化消息
 *
 * @example
 * getLocaleText('export.success'); // Returns: 'Successfully exported sequence' (en) or '成功导出序列' (zh)
 * getLocaleText('export.sequence_not_found', {name: 'MySeq'}); // Returns: "Cannot find sequence named 'MySeq'"
 */
function getLocaleText(key, params) {
  var locale = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.locale) || 'zh';
  var message = PR_MESSAGES[key];

  if (!message) {
    return key; // Return key if message not found
  }

  var text = message[locale] || message['zh'] || key;

  // Replace placeholders like {name}
  if (params) {
    for (var p in params) {
      if (params.hasOwnProperty(p)) {
        text = text.replace(new RegExp('\\{' + p + '\\}', 'g'), params[p]);
      }
    }
  }

  return text;
}
