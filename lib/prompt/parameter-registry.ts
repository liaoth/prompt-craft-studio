import type {
  MidjourneyModel,
  PromptParameters,
  TargetSurface,
  TaskType,
} from "./types";

export type ParameterValueType =
  | "boolean"
  | "number"
  | "string"
  | "string-list"
  | "select";
export type ParameterUiTone =
  | "model"
  | "composition"
  | "style"
  | "variation"
  | "mode"
  | "output";

export interface ParameterDefinition {
  id: keyof PromptParameters;
  label: string;
  flag: string;
  aliases: readonly string[];
  valueType: ParameterValueType;
  uiTone: ParameterUiTone;
  min?: number;
  max?: number;
  step?: number;
  options?: readonly (string | number)[];
  defaultValue?: unknown;
  description: string;
  examples?: readonly string[];
  rangeText?: string;
  modelNotes?: string;
  models?: readonly MidjourneyModel[];
  surfaces: readonly TargetSurface[];
  tasks: readonly TaskType[];
  conflicts?: readonly (keyof PromptParameters)[];
  deprecated?: boolean;
  replacement?: string;
  docsUrl: string;
}

const DOCS = "https://docs.midjourney.com/hc/en-us/articles/32859204029709-Parameter-List";
const IMAGE_MODELS = ["8.2", "8.1", "7", "6.1", "6", "niji-7", "niji-6"] as const;
const ALL_SURFACES = ["web", "discord"] as const;

export const PARAMETER_REGISTRY = [
  def("model", "模型版本", "--v", ["--version", "--niji"], "select", {
    uiTone: "model",
    options: ["8.2", "8.1", "7", "6.1", "6", "niji-7", "niji-6"],
    defaultValue: "8.2",
    description: "选择生成图像使用的 Midjourney 模型。不同模型支持的参数范围不同。",
    examples: ["V8.2 通用图像", "Niji 7 动漫插画"],
    tasks: ["image"],
  }),
  def("aspectRatio", "画面比例", "--ar", ["--aspect"], "string", {
    uiTone: "composition",
    defaultValue: "1:1",
    description: "控制生成画面的宽高比。HD 图像模式最大支持 4:1。",
    examples: ["1:1", "16:9", "2:3"],
    rangeText: "普通模式 1:14–14:1；HD 最大 4:1",
    tasks: ["image"],
  }),
  def("chaos", "Chaos", "--chaos", ["--c"], "number", {
    uiTone: "variation",
    min: 0,
    max: 100,
    step: 1,
    defaultValue: 0,
    description: "提高初始图像之间的差异程度，数值越高结果越不可预测。",
    tasks: ["image"],
  }),
  def("omniWeight", "Omni Weight", "--ow", [], "number", {
    uiTone: "style",
    min: 1,
    max: 1_000,
    defaultValue: 100,
    models: ["7"],
    tasks: ["image"],
    description: "控制 V7 Omni Reference 对人物、物体或生物特征的影响强度。",
    modelNotes: "仅 V7；与 Draft、Fast、Quality 4 冲突。",
  }),
  def("no", "排除内容", "--no", [], "string-list", {
    uiTone: "output",
    description: "指定不希望画面出现的对象或特征，多个值用逗号分隔。",
    examples: ["text, watermark, extra fingers"],
    tasks: ["image"],
  }),
  def("profile", "Profile / Moodboard", "--profile", ["--p"], "string-list", {
    uiTone: "style",
    conflicts: ["styleVersion", "styleWeight"],
    tasks: ["image"],
    description: "应用个性化 Profile 或 Moodboard 代码。",
    examples: ["abc123"],
  }),
  def("quality", "Quality", "--quality", ["--q"], "number", {
    uiTone: "output",
    options: [0.25, 0.5, 1, 2, 4],
    tasks: ["image"],
    description: "控制渲染时间和细节投入；可选值随模型变化。",
    rangeText: "依模型支持 0.25、0.5、1、2 或 4",
  }),
  def("repeat", "Repeat", "--repeat", ["--r"], "number", {
    uiTone: "variation",
    min: 1,
    max: 40,
    step: 1,
    tasks: ["image"],
    description: "使用同一 Prompt 连续创建多批图像，消耗会按次数增加。",
  }),
  def("seed", "Seed", "--seed", [], "number", {
    uiTone: "variation",
    min: 0,
    max: 4_294_967_295,
    step: 1,
    description: "设置随机种子，便于在相近条件下对比迭代。",
    tasks: ["image"],
  }),
  def("visibility", "公开状态", "--public", ["--stealth"], "select", {
    uiTone: "mode",
    options: ["public", "stealth"],
    description: "设置作品公开或隐身；Stealth 仅对支持该权益的订阅生效。",
    tasks: ["image"],
  }),
  def("raw", "Raw", "--raw", ["--style"], "boolean", {
    uiTone: "mode",
    description: "减少模型默认审美修饰，让文字描述对结果产生更直接的影响。",
  }),
  def("stylize", "Stylize", "--s", ["--stylize"], "number", {
    uiTone: "style",
    min: 0,
    max: 1_000,
    step: 1,
    tasks: ["image"],
    defaultValue: 100,
    description: "控制 Midjourney 默认艺术审美的应用强度。",
  }),
  def("styleWeight", "Style Weight", "--sw", [], "number", {
    uiTone: "style",
    min: 0,
    max: 1_000,
    conflicts: ["profile"],
    tasks: ["image"],
    defaultValue: 100,
    description: "控制 Style Reference 的整体影响强度，必须先添加风格参考。",
  }),
  def("styleVersion", "Style Version", "--sv", [], "number", {
    uiTone: "style",
    min: 1,
    max: 6,
    conflicts: ["profile"],
    tasks: ["image"],
    description: "选择 Style Reference 的兼容算法版本。",
  }),
  def("tile", "Tile", "--tile", [], "boolean", {
    uiTone: "mode",
    tasks: ["image"],
    description: "生成可在水平和垂直方向重复拼接的无缝纹理。",
  }),
  def("draft", "Draft", "--draft", [], "boolean", {
    uiTone: "mode",
    models: ["7"],
    tasks: ["image"],
    description: "使用更低成本快速探索构图与方向。",
  }),
  def("weird", "Weird", "--weird", ["--w"], "number", {
    uiTone: "variation",
    min: 0,
    max: 3_000,
    step: 1,
    tasks: ["image"],
    description: "提高画面的奇异和非常规程度。",
  }),
  def("speedMode", "速度模式", "--fast", ["--relax", "--turbo"], "select", {
    uiTone: "mode",
    options: ["fast", "relax", "turbo"],
    description: "选择 GPU 调度模式；实际可用性取决于订阅和模型。",
    tasks: ["image"],
  }),
  def("imageWeight", "Image Weight", "--iw", [], "number", {
    uiTone: "style",
    min: 0,
    max: 3,
    step: 0.1,
    models: ["8.1", "7", "niji-7"],
    tasks: ["image"],
    description: "控制普通图片提示相对文字 Prompt 的影响强度，必须先添加普通图片。",
    modelNotes: "Niji 7 最大 2；V8.1/V7 最大 3。",
  }),
  def("motion", "Motion", "--motion", ["--motion low", "--motion high"], "select", {
    uiTone: "composition",
    options: ["low", "high"],
    tasks: ["video"],
    description: "控制视频中的相机和主体运动幅度。",
  }),
  def("loop", "Loop", "--loop", [], "boolean", {
    uiTone: "mode",
    tasks: ["video"],
    description: "让视频结束画面回到起始帧，形成循环。",
  }),
  def("batchSize", "Batch Size", "--bs", [], "number", {
    uiTone: "output",
    options: [1, 2, 4],
    tasks: ["video"],
    description: "选择一次生成的视频数量，数量越高消耗越大。",
  }),
  def("video", "Video", "--video", [], "boolean", {
    uiTone: "mode",
    surfaces: ["discord"],
    tasks: ["video"],
    description: "在 Discord 中将起始图片作为视频任务提交。",
  }),
  def("imageResolution", "图像分辨率", "--sd", ["--hd"], "select", {
    uiTone: "output",
    options: ["sd", "hd"],
    models: ["8.2", "8.1"],
    tasks: ["image"],
    description: "选择 V8.1/V8.2 图像的标准或高清分辨率；HD 画面比例最大为 4:1。",
  }),
] as const satisfies readonly ParameterDefinition[];

export const LEGACY_MODEL: ParameterDefinition = {
  id: "model",
  label: "V8.0（旧快照）",
  flag: "--v",
  aliases: ["--version"],
  valueType: "select",
  uiTone: "model",
  options: ["8"],
  models: ["8"],
  surfaces: ALL_SURFACES,
  tasks: ["image"],
  deprecated: true,
  replacement: "8.2",
  description: "旧快照中的 V8.0 模型，仅用于兼容恢复。",
  docsUrl: DOCS,
};

export const PARAMETER_BY_ID = new Map<keyof PromptParameters, ParameterDefinition>(
  PARAMETER_REGISTRY.map((definition) => [definition.id, definition]),
);

export const PARAMETER_BY_ALIAS = new Map<string, ParameterDefinition>(
  PARAMETER_REGISTRY.flatMap((definition) =>
    [definition.flag, ...definition.aliases].map((alias) => [alias.toLowerCase(), definition] as const),
  ),
);

function def(
  id: keyof PromptParameters,
  label: string,
  flag: string,
  aliases: readonly string[],
  valueType: ParameterValueType,
  overrides: Partial<ParameterDefinition>,
): ParameterDefinition {
  return {
    id,
    label,
    flag,
    aliases,
    valueType,
    uiTone: "output",
    description: "",
    models: IMAGE_MODELS,
    surfaces: ALL_SURFACES,
    tasks: ["image", "video"],
    docsUrl: DOCS,
    ...overrides,
  };
}
