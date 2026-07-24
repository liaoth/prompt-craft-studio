import type { PromptFieldKey, PromptFields } from "./types";
import { emptyPromptFields } from "./types";

export interface BilingualPreset {
  id: string;
  field: Exclude<PromptFieldKey, "subject" | "action" | "environment" | "negative">;
  labelZh: string;
  valueZh: string;
  valueEn: string;
}

export const BILINGUAL_PRESETS = [
  {
    id: "medium-photography",
    field: "medium",
    labelZh: "摄影",
    valueZh: "专业摄影",
    valueEn: "professional photography",
  },
  {
    id: "medium-digital-painting",
    field: "medium",
    labelZh: "数字绘画",
    valueZh: "精细数字绘画",
    valueEn: "detailed digital painting",
  },
  {
    id: "style-cinematic",
    field: "style",
    labelZh: "电影感",
    valueZh: "电影美学",
    valueEn: "cinematic aesthetic",
  },
  {
    id: "style-anime",
    field: "style",
    labelZh: "动漫",
    valueZh: "精致动漫风格",
    valueEn: "refined anime style",
  },
  {
    id: "composition-rule-of-thirds",
    field: "composition",
    labelZh: "三分构图",
    valueZh: "三分法构图",
    valueEn: "rule of thirds composition",
  },
  {
    id: "composition-centered",
    field: "composition",
    labelZh: "居中构图",
    valueZh: "对称居中构图",
    valueEn: "symmetrical centered composition",
  },
  {
    id: "camera-close-up",
    field: "camera",
    labelZh: "特写",
    valueZh: "特写镜头",
    valueEn: "close-up shot",
  },
  {
    id: "camera-wide-angle",
    field: "camera",
    labelZh: "广角",
    valueZh: "广角镜头",
    valueEn: "wide-angle lens",
  },
  {
    id: "lighting-soft",
    field: "lighting",
    labelZh: "柔光",
    valueZh: "柔和漫射光",
    valueEn: "soft diffused light",
  },
  {
    id: "lighting-volumetric",
    field: "lighting",
    labelZh: "体积光",
    valueZh: "戏剧性体积光",
    valueEn: "dramatic volumetric lighting",
  },
  {
    id: "color-pastel",
    field: "color",
    labelZh: "粉彩",
    valueZh: "柔和粉彩配色",
    valueEn: "soft pastel color palette",
  },
  {
    id: "color-neon",
    field: "color",
    labelZh: "霓虹",
    valueZh: "鲜明霓虹配色",
    valueEn: "vivid neon color palette",
  },
  {
    id: "material-metal",
    field: "material",
    labelZh: "金属",
    valueZh: "精细拉丝金属材质",
    valueEn: "finely brushed metal material",
  },
  {
    id: "mood-dreamlike",
    field: "mood",
    labelZh: "梦幻",
    valueZh: "梦幻宁静氛围",
    valueEn: "dreamlike and serene atmosphere",
  },
] as const satisfies readonly BilingualPreset[];

const presetById = new Map<string, BilingualPreset>(
  BILINGUAL_PRESETS.map((preset) => [preset.id, preset]),
);

export interface ResolvedPresetFields {
  fieldsZh: PromptFields;
  fieldsEn: PromptFields;
  unknownPresetIds: string[];
}

export function resolvePresetFields(presetIds: readonly string[]): ResolvedPresetFields {
  const fieldsZh = emptyPromptFields();
  const fieldsEn = emptyPromptFields();
  const unknownPresetIds: string[] = [];

  for (const id of presetIds) {
    const preset = presetById.get(id);
    if (!preset) {
      unknownPresetIds.push(id);
      continue;
    }

    fieldsZh[preset.field] = appendValue(fieldsZh[preset.field], preset.valueZh);
    fieldsEn[preset.field] = appendValue(fieldsEn[preset.field], preset.valueEn);
  }

  return { fieldsZh, fieldsEn, unknownPresetIds };
}

function appendValue(current: string, next: string): string {
  return current ? `${current}, ${next}` : next;
}
