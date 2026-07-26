import { createPromptBlock } from "./blocks";
import type { PromptBlock, PromptParameters } from "./types";

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  blocks: PromptBlock[];
  parameters: PromptParameters;
}

function block(
  templateId: string,
  field: PromptBlock["field"],
  textZh: string,
  textEn: string,
  order = 0,
): PromptBlock {
  return createPromptBlock(
    field,
    textZh,
    textEn,
    "template",
    order,
    `template-${templateId}-${field}-${order}`,
  );
}

export const PROMPT_TEMPLATES: readonly PromptTemplate[] = [
  {
    id: "portrait",
    name: "人像摄影",
    description: "自然人物肖像与商业人像",
    blocks: [
      block("portrait", "subject", "富有表现力的人物肖像", "expressive human portrait"),
      block("portrait", "composition", "居中构图，浅景深", "centered composition, shallow depth of field"),
      block("portrait", "camera", "85mm 人像镜头，半身近景", "85mm portrait lens, medium close-up"),
      block("portrait", "lighting", "柔和窗光与轮廓光", "soft window light and subtle rim light"),
      block("portrait", "style", "高端时尚杂志摄影", "premium editorial fashion photography"),
      block("portrait", "mood", "克制、亲密、真实", "restrained, intimate, authentic"),
    ],
    parameters: { model: "8.2", aspectRatio: "4:5", stylize: 250 },
  },
  {
    id: "product-ad",
    name: "产品广告",
    description: "高端商业产品视觉",
    blocks: [
      block("product-ad", "subject", "精致的商业产品", "premium commercial product"),
      block("product-ad", "environment", "极简摄影棚布景", "minimal studio set"),
      block("product-ad", "composition", "英雄式产品构图，充足留白", "hero product composition, generous negative space"),
      block("product-ad", "lighting", "电影级边缘光与柔和反射", "cinematic edge lighting and soft reflections"),
      block("product-ad", "material", "真实材质与精确表面细节", "photoreal materials and precise surface detail"),
    ],
    parameters: { model: "8.2", aspectRatio: "16:9", stylize: 180 },
  },
  {
    id: "ecommerce",
    name: "电商主图",
    description: "清晰、规范的商品展示",
    blocks: [
      block("ecommerce", "subject", "单件商品完整展示", "single product fully visible"),
      block("ecommerce", "environment", "纯净无缝白色背景", "clean seamless white background"),
      block("ecommerce", "composition", "正面居中，边缘清晰", "front-facing centered composition, crisp edges"),
      block("ecommerce", "lighting", "均匀柔光，无杂乱阴影", "even softbox lighting, no distracting shadows"),
      block("ecommerce", "negative", "文字，水印，多余道具", "text, watermark, extra props"),
    ],
    parameters: { model: "8.2", aspectRatio: "1:1", stylize: 50 },
  },
  {
    id: "anime",
    name: "动漫角色",
    description: "角色设定与日系动画视觉",
    blocks: [
      block("anime", "subject", "辨识度鲜明的动漫角色", "distinctive anime character"),
      block("anime", "action", "动态姿态与清晰表情", "dynamic pose and readable expression"),
      block("anime", "composition", "完整角色设计展示", "full character design presentation"),
      block("anime", "color", "协调而鲜明的配色", "harmonious vivid color palette"),
      block("anime", "style", "精致日系动画设定稿", "polished Japanese anime character sheet"),
    ],
    parameters: { model: "niji-7", aspectRatio: "2:3", stylize: 400 },
  },
  {
    id: "storyboard",
    name: "电影分镜",
    description: "电影镜头与叙事画面",
    blocks: [
      block("storyboard", "environment", "具有叙事线索的电影场景", "cinematic scene with narrative clues"),
      block("storyboard", "composition", "电影分镜构图，明确视觉动线", "storyboard composition with clear visual flow"),
      block("storyboard", "camera", "35mm 镜头，宽银幕景别", "35mm lens, widescreen shot"),
      block("storyboard", "lighting", "戏剧化实景光", "dramatic motivated lighting"),
      block("storyboard", "mood", "紧张且富有故事感", "tense and story-driven"),
    ],
    parameters: { model: "8.2", aspectRatio: "21:9", stylize: 220 },
  },
  {
    id: "architecture",
    name: "建筑空间",
    description: "建筑外观与室内空间",
    blocks: [
      block("architecture", "subject", "当代建筑空间", "contemporary architectural space"),
      block("architecture", "composition", "严谨透视与尺度参照", "precise perspective and human scale cues"),
      block("architecture", "camera", "24mm 移轴建筑镜头", "24mm tilt-shift architectural lens"),
      block("architecture", "lighting", "自然日光与真实全局照明", "natural daylight and realistic global illumination"),
      block("architecture", "material", "细腻石材、木材与玻璃", "refined stone, timber, and glass"),
    ],
    parameters: { model: "8.2", aspectRatio: "16:9", stylize: 160 },
  },
  {
    id: "game-concept",
    name: "游戏概念图",
    description: "世界观、关卡与环境概念",
    blocks: [
      block("game-concept", "environment", "宏大的游戏世界环境", "epic game world environment"),
      block("game-concept", "composition", "层次分明的环境叙事构图", "layered environmental storytelling composition"),
      block("game-concept", "lighting", "体积光与大气透视", "volumetric light and atmospheric perspective"),
      block("game-concept", "medium", "高完成度数字概念绘画", "high-fidelity digital concept painting"),
      block("game-concept", "mood", "神秘、壮阔、可探索", "mysterious, monumental, explorable"),
    ],
    parameters: { model: "8.2", aspectRatio: "16:9", stylize: 500 },
  },
  {
    id: "logo",
    name: "Logo / 图标",
    description: "简洁品牌符号与应用图标",
    blocks: [
      block("logo", "subject", "独特且易识别的品牌符号", "distinctive recognizable brand symbol"),
      block("logo", "composition", "几何化居中构图", "geometric centered composition"),
      block("logo", "style", "极简矢量标志设计", "minimal vector logo design"),
      block("logo", "color", "限制色板，高对比", "limited palette, high contrast"),
      block("logo", "negative", "文字，照片质感，复杂背景", "letters, photographic texture, complex background"),
    ],
    parameters: { model: "8.2", aspectRatio: "1:1", stylize: 100 },
  },
  {
    id: "social-cover",
    name: "社交媒体封面",
    description: "醒目横幅与内容封面",
    blocks: [
      block("social-cover", "subject", "醒目的主题视觉", "bold thematic key visual"),
      block("social-cover", "composition", "横向构图，预留标题安全区", "horizontal composition with headline safe area"),
      block("social-cover", "color", "高辨识度品牌色彩", "high-recognition brand color palette"),
      block("social-cover", "style", "现代数字营销视觉", "modern digital campaign visual"),
    ],
    parameters: { model: "8.2", aspectRatio: "16:9", stylize: 300 },
  },
  {
    id: "seamless-texture",
    name: "无缝纹理",
    description: "可平铺材质与图案",
    blocks: [
      block("seamless-texture", "subject", "均匀连续的表面图案", "even continuous surface pattern"),
      block("seamless-texture", "composition", "正交顶视，无透视变形", "orthographic top view, no perspective distortion"),
      block("seamless-texture", "material", "高精度可平铺材质细节", "high-detail tileable material"),
      block("seamless-texture", "lighting", "均匀漫射光，无方向性阴影", "uniform diffuse lighting, no directional shadow"),
    ],
    parameters: { model: "8.2", aspectRatio: "1:1", tile: true, stylize: 120 },
  },
] as const;

export function getPromptTemplate(id: string): PromptTemplate | undefined {
  return PROMPT_TEMPLATES.find((template) => template.id === id);
}
