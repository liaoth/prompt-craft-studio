"use client";

import Link from "next/link";
import {
  Check,
  CircleAlert,
  CircleUserRound,
  Copy,
  Heart,
  KeyRound,
  Library,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  MIDJOURNEY_MODELS,
  emptyPromptFields,
  type PromptDraft,
  type PromptFields,
  type PromptParameters,
  type PromptSource,
  type PromptWarning,
} from "@/lib/prompt/types";
import { serializeParameters, validateParameters } from "@/lib/prompt/parameters";

type WorkbenchFieldKey = keyof PromptFields | "custom";
type DrawerTab = "phrases" | "history" | "favorites" | "submissions" | "settings";
type MobileTab = "materials" | "create" | "parameters";
type ConnectionState = "checking" | "connected" | "guest" | "offline";

type WorkbenchFields = PromptFields & { custom: string };

type PhraseSnippet = {
  id: string;
  name: string;
  category: string;
  content: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

type StoredSnapshot = {
  promptZh: string;
  promptEn: string;
  source: PromptSource;
  input?: Partial<PromptFields>;
  fields?: Partial<PromptFields>;
  translatedFields?: Partial<PromptFields>;
  parameters?: PromptParameters;
  warnings?: PromptWarning[];
};

type PromptRecord = {
  id: string;
  promptZh: string;
  promptEn: string;
  source: PromptSource;
  snapshot: StoredSnapshot;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
};

type PublicConfig = {
  id: string;
  label: string;
  provider: string;
  endpoint: string;
  model?: string;
  apiKeyMasked: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type MidjourneySubmission = {
  id: string;
  promptZh: string;
  promptEn: string;
  source: PromptSource;
  status: "pending" | "sent" | "failed";
  errorMessage?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type PhraseForm = {
  id?: string;
  name: string;
  category: string;
  content: string;
  sortOrder: number;
};

type AiConfigForm = {
  label: string;
  provider: string;
  model: string;
  endpoint: string;
  apiKey: string;
  isActive: boolean;
};

type TranslationConfigForm = {
  label: string;
  provider: string;
  endpoint: string;
  apiKey: string;
  isActive: boolean;
};

type MidjourneyConfigForm = {
  label: string;
  provider: "discord_webhook" | "custom_http";
  endpoint: string;
  apiKey: string;
  isActive: boolean;
};

type ListResponse<T> = {
  items: T[];
  total?: number;
  page?: number;
  pages?: number;
};

type GenerateResponse = {
  draft: PromptDraft;
  historyId: string;
};

type SubmissionResponse = {
  submissionId: string;
  status: "pending" | "sent" | "failed";
  details: string;
};

type Template = {
  id: string;
  title: string;
  eyebrow: string;
  accent: string;
  fields: Partial<WorkbenchFields>;
  translatedFields: Partial<PromptFields>;
};

const EMPTY_FIELDS: WorkbenchFields = { ...emptyPromptFields(), custom: "" };

const FIELD_META: ReadonlyArray<{
  key: WorkbenchFieldKey;
  label: string;
  hint: string;
  wide?: boolean;
}> = [
  { key: "subject", label: "主体", hint: "人物、物体或核心画面", wide: true },
  { key: "action", label: "动作", hint: "角色正在进行的行为描述" },
  { key: "environment", label: "环境", hint: "时间、地点、场景背景" },
  { key: "medium", label: "媒介", hint: "摄影、插画、3D 渲染" },
  { key: "style", label: "风格", hint: "视觉语言与年代感" },
  { key: "composition", label: "构图", hint: "对称、留白、黄金分割" },
  { key: "camera", label: "镜头", hint: "景别、焦段、机位" },
  { key: "lighting", label: "灯光", hint: "光源、光质、方向" },
  { key: "color", label: "色彩", hint: "配色、饱和度、色调" },
  { key: "material", label: "材质", hint: "表面、纹理、质感" },
  { key: "mood", label: "氛围", hint: "情绪和叙事感" },
  { key: "negative", label: "排除内容", hint: "不希望出现的元素" },
  {
    key: "custom",
    label: "自定义补充",
    hint: "没有输入焦点时，常用词会插入这里",
    wide: true,
  },
];

/*
const TEMPLATES: Template[] = [
  {
    id: "cinematic",
    title: "鐢靛奖鎰熶汉鍍?",
    eyebrow: "PORTRAIT",
    accent: "绱綏鍏?",
    fields: {
      subject: "涓€浣嶇┛榛戣壊椋庤。鐨勫勾杞诲コ鎬э紝绁炴儏鍧氬畾",
      action: "杩庣潃椋庡洖澶村嚌鏈涢暅澶?",
      environment: "闆ㄥ鐨勬湭鏉ラ兘甯傝閬擄紝闇撹櫣鍊掑奖",
      medium: "鐢靛奖鍓х収锛岀湡瀹炴憚褰?",
      style: "鏂伴粦鑹茬數褰憋紝鍏嬪埗鐨勮禌鍗氭湅鍏?",
      composition: "涓夊垎娉曟瀯鍥撅紝娴呮櫙娣憋紝鍓嶆櫙閬尅",
      camera: "85mm 浜哄儚闀滃ご锛屼綆鏈轰綅杩戞櫙",
      lighting: "闈掔传闇撹櫣渚у厜锛屾煍鍜岃疆寤撳厜",
      color: "娣辫摑銆佺传鑹蹭笌灏戦噺鏆栨",
      material: "娼箍娌ラ潚锛岀粏鑵荤毊鑲わ紝纾ㄧ爞甯冩枡",
      mood: "绁炵銆佸喎闈欍€佸厖婊℃晠浜嬫劅",
      negative: "鏂囧瓧锛屾按鍗帮紝澶氫綑鎵嬫寚锛岃繃搴︾（鐨?",
    },
    translatedFields: {
      subject: "a determined young woman in a black trench coat",
      action: "turning into the wind and looking back at the camera",
      environment: "a futuristic city street at night in the rain, neon reflections",
      medium: "cinematic still, photorealistic photography",
      style: "neo-noir, restrained cyberpunk",
      composition: "rule of thirds, shallow depth of field, foreground framing",
      camera: "85mm portrait lens, low-angle close shot",
      lighting: "cyan and violet neon side light, soft rim light",
      color: "deep blue, violet, subtle warm orange accents",
      material: "wet asphalt, natural skin texture, matte fabric",
      mood: "mysterious, calm, narrative",
      negative: "text, watermark, extra fingers, plastic skin",
    },
  },
  {
    id: "product",
    title: "楂樼浜у搧骞垮憡",
    eyebrow: "COMMERCIAL",
    accent: "鐢靛厜钃?",
    fields: {
      subject: "涓€鐡舵瀬绠€璁捐鐨勯€忔槑棣欐按锛屾偓娴湪鐢婚潰涓ぎ",
      environment: "鏃犵紳娣辫壊褰辨鑳屾櫙锛岃杽闆剧幆缁?",
      medium: "鍟嗕笟浜у搧鎽勫奖锛岃秴鍐欏疄",
      style: "濂緢鍝佸箍鍛婏紝鐜颁唬鏋佺畝涓讳箟",
      composition: "灞呬腑鏋勫浘锛屽ぇ闈㈢Н鐣欑櫧",
      camera: "100mm 寰窛闀滃ご锛屾闈㈣瑙?",
      lighting: "閿愬埄椤跺厜涓庤摑鑹茶竟缂樺厜锛岄珮鍏夊彈鎺?",
      color: "榛戣壊銆侀€忔槑鐜荤拑銆佺數鍏夎摑",
      material: "鍏夊鐜荤拑锛屾媺涓濋噾灞烇紝缁嗗井姘寸彔",
      mood: "绮捐嚧銆佸喎鍐姐€佹湭鏉ユ劅",
      negative: "鏂囧瓧锛屾爣蹇楋紝鏍囩鍙樺舰锛屽粔浠峰鏂欐劅",
    },
    translatedFields: {
      subject: "a minimalist transparent perfume bottle floating at the center",
      environment: "seamless dark studio background, surrounded by subtle mist",
      medium: "commercial product photography, hyperrealistic",
      style: "luxury advertising, modern minimalism",
      composition: "centered composition, generous negative space",
      camera: "100mm macro lens, straight-on view",
      lighting: "crisp top light with electric-blue rim lighting",
      color: "black, clear glass, electric blue",
      material: "optical glass, brushed metal, fine water droplets",
      mood: "refined, cool, futuristic",
      negative: "text, logo, warped label, cheap plastic texture",
    },
  },
  {
    id: "architecture",
    title: "寤虹瓚姒傚康鍦烘櫙",
    eyebrow: "ARCHITECTURE",
    accent: "钖勮嵎闈?",
    fields: {
      subject: "鎮礀杈圭殑鐜颁唬缇庢湳棣嗭紝娴佺嚎鍨嬬櫧鑹蹭綋鍧?",
      environment: "浜戞捣涔嬩笂鐨勯珮灞憋紝鏃ュ嚭鍓嶇殑钃濊皟鏃跺埢",
      medium: "寤虹瓚鍙鍖栵紝鍐欏疄 3D 娓叉煋",
      style: "鏈潵涓讳箟锛屾湁鏈虹幇浠ｅ缓绛?",
      composition: "瓒呭箍瑙掑叏鏅紝寮曞绾挎瀯鍥?",
      camera: "24mm 绉昏酱闀滃ご锛岀暐楂樿瑙?",
      lighting: "娓呮櫒婕皠鍏夛紝瀹ゅ唴鏆栧厜閫忓嚭",
      color: "鍐风伆銆侀浘钃濄€佹煍鍜岀惀鐝€鑹?",
      material: "鐧借壊娣峰嚌鍦燂紝鐜荤拑锛屾祬鑹叉湪鏉?",
      mood: "闈欒哀銆佸．闃斻€佹矇鎬?",
      negative: "浜虹墿鎷ユ尋锛屾枃瀛楋紝姣斾緥澶辩湡锛岃繃鏇?",
    },
    translatedFields: {
      subject: "a modern art museum on a cliff, flowing white architectural volumes",
      environment: "high mountains above a sea of clouds, blue hour before sunrise",
      medium: "architectural visualization, realistic 3D render",
      style: "futurist, organic modern architecture",
      composition: "ultra-wide panorama, leading-line composition",
      camera: "24mm tilt-shift lens, slightly elevated viewpoint",
      lighting: "soft dawn light with warm interior illumination",
      color: "cool gray, mist blue, soft amber",
      material: "white concrete, glass, pale timber",
      mood: "serene, monumental, contemplative",
      negative: "crowds, text, distorted scale, overexposure",
    },
  },
  {
    id: "anime",
    title: "鍔ㄦ极瑙掕壊璁捐",
    eyebrow: "CHARACTER",
    accent: "鐝婄憵绮?",
    fields: {
      subject: "鏉ヨ嚜娴┖鍩庣殑鏈烘淇′娇灏戝コ锛岄摱鑹茬煭鍙?",
      action: "鍗曟墜鎻′綇鍙戝厜淇′欢锛屽噯澶囪捣璺?",
      environment: "浜戠鍒楄溅绔欙紝宸ㄥぇ鐨勯娇杞笌椋為笩",
      medium: "绮剧粏浜岀淮鍔ㄧ敾鍘熺敾",
      style: "鏃ョ郴骞绘兂鍔ㄧ敾锛屾竻鏅扮嚎绋?",
      composition: "鍔ㄦ€佸瑙掔嚎鏋勫浘锛屽叏韬鑹茶璁?",
      camera: "35mm 骞胯锛屽钩瑙?",
      lighting: "娓呴€忓崍鍚庨槼鍏夛紝鏌斾寒鍙嶅皠鍏?",
      color: "澶╃┖钃濄€佽薄鐗欑櫧銆佺強鐟氱孩",
      material: "榛勯摐鏈烘锛屼笣缁告姭椋庯紝杞荤泩浜戦浘",
      mood: "鑷敱銆佹槑蹇€佸啋闄╁惎绋?",
      negative: "鍐欏疄鐓х墖锛屾枃瀛楋紝姘村嵃锛屾墜閮ㄩ敊璇?",
    },
    translatedFields: {
      subject: "a mechanical messenger girl from a floating city, short silver hair",
      action: "holding a glowing letter in one hand, ready to sprint",
      environment: "a station above the clouds, monumental gears and flying birds",
      medium: "high-detail 2D animation key art",
      style: "Japanese fantasy animation, clean linework",
      composition: "dynamic diagonal composition, full-body character design",
      camera: "35mm wide angle, eye level",
      lighting: "clear afternoon sunlight, soft luminous bounce light",
      color: "sky blue, ivory white, coral red",
      material: "brass machinery, silk cape, weightless cloud mist",
      mood: "free-spirited, bright, beginning an adventure",
      negative: "photorealism, text, watermark, malformed hands",
    },
  },
];
*/
const TEMPLATES: Template[] = [
  {
    id: "cinematic",
    title: "电影感人像",
    eyebrow: "PORTRAIT",
    accent: "紫罗兰",
    fields: {
      subject: "一位穿黑色风衣的年轻女性，神情坚定",
      action: "迎着风回头凝望镜头",
      environment: "雨夜的未来都市街道，霓虹倒影",
      medium: "电影剧照，真实摄影",
      style: "新黑色电影，克制的赛博朋克",
      composition: "三分法构图，浅景深，前景遮挡",
      camera: "85mm 人像镜头，低机位近景",
      lighting: "青紫霓虹侧光，柔和轮廓光",
      color: "深蓝、紫色与少量暖橙",
      material: "潮湿沥青，细腻皮肤，磨砂布料",
      mood: "神秘、冷静、充满故事感",
      negative: "文字，水印，多余手指，塑料皮肤",
    },
    translatedFields: {
      subject: "a determined young woman in a black trench coat",
      action: "turning into the wind and looking back at the camera",
      environment: "a futuristic city street at night in the rain, neon reflections",
      medium: "cinematic still, photorealistic photography",
      style: "neo-noir, restrained cyberpunk",
      composition: "rule of thirds, shallow depth of field, foreground framing",
      camera: "85mm portrait lens, low-angle close shot",
      lighting: "cyan and violet neon side light, soft rim light",
      color: "deep blue, violet, subtle warm orange accents",
      material: "wet asphalt, natural skin texture, matte fabric",
      mood: "mysterious, calm, narrative",
      negative: "text, watermark, extra fingers, plastic skin",
    },
  },
  {
    id: "product",
    title: "高端产品广告",
    eyebrow: "COMMERCIAL",
    accent: "电光蓝",
    fields: {
      subject: "一瓶极简透明香水，悬浮在画面中央",
      environment: "无缝深色影棚背景，薄雾环绕",
      medium: "商业产品摄影，超写实",
      style: "奢侈品广告，现代极简主义",
      composition: "居中构图，大面积留白",
      camera: "100mm 微距镜头，正面视角",
      lighting: "锐利顶光与蓝色边缘光",
      color: "黑色、透明玻璃、电光蓝",
      material: "光学玻璃，拉丝金属，细微水珠",
      mood: "精致、冷冽、未来感",
      negative: "文字，标志，标签变形，廉价塑料感",
    },
    translatedFields: {
      subject: "a minimalist transparent perfume bottle floating at the center",
      environment: "seamless dark studio background, surrounded by subtle mist",
      medium: "commercial product photography, hyperrealistic",
      style: "luxury advertising, modern minimalism",
      composition: "centered composition, generous negative space",
      camera: "100mm macro lens, straight-on view",
      lighting: "crisp top light with electric-blue rim lighting",
      color: "black, clear glass, electric blue",
      material: "optical glass, brushed metal, fine water droplets",
      mood: "refined, cool, futuristic",
      negative: "text, logo, warped label, cheap plastic texture",
    },
  },
  {
    id: "architecture",
    title: "建筑概念场景",
    eyebrow: "ARCHITECTURE",
    accent: "薄荷青",
    fields: {
      subject: "悬崖边的现代美术馆，流线型白色体块",
      environment: "云海之上的高山，日出前的蓝调时刻",
      medium: "建筑可视化，写实 3D 渲染",
      style: "未来主义，有机现代建筑",
      composition: "超广角全景，引导线构图",
      camera: "24mm 移轴镜头，略高视角",
      lighting: "清晨漫射光，室内暖光透出",
      color: "冷灰、雾蓝、柔和琥珀色",
      material: "白色混凝土，玻璃，浅色木材",
      mood: "静谧、壮阔、沉思",
      negative: "人物拥挤，文字，比例失真，过曝",
    },
    translatedFields: {
      subject: "a modern art museum on a cliff, flowing white architectural volumes",
      environment: "high mountains above a sea of clouds, blue hour before sunrise",
      medium: "architectural visualization, realistic 3D render",
      style: "futurist, organic modern architecture",
      composition: "ultra-wide panorama, leading-line composition",
      camera: "24mm tilt-shift lens, slightly elevated viewpoint",
      lighting: "soft dawn light with warm interior illumination",
      color: "cool gray, mist blue, soft amber",
      material: "white concrete, glass, pale timber",
      mood: "serene, monumental, contemplative",
      negative: "crowds, text, distorted scale, overexposure",
    },
  },
];

const CURATED_PHRASES: PhraseSnippet[] = [
  { id: "demo-1", name: "電影光影", category: "光影", content: "cinematic volumetric lighting", sortOrder: 0 },
  { id: "demo-2", name: "细腻质感", category: "质感", content: "intricate tactile details", sortOrder: 0 },
  { id: "demo-3", name: "設計感", category: "風格", content: "high-fashion editorial aesthetic", sortOrder: 0 },
  { id: "demo-4", name: "鏡頭構圖", category: "構圖", content: "dynamic diagonal composition", sortOrder: 0 },
  { id: "demo-5", name: "电影色彩", category: "色彩", content: "cinematic color grading", sortOrder: 0 },
  { id: "demo-6", name: "細節素材", category: "質感", content: "highly detailed, crisp micro-textures", sortOrder: 0 },
];

const DEFAULT_PARAMETERS: PromptParameters = {
  model: "7",
  aspectRatio: "16:9",
  stylize: 250,
  chaos: 8,
  weird: 0,
  quality: 1,
  raw: false,
  tile: false,
  no: [],
};

const DEFAULT_AI_FORM: AiConfigForm = {
  label: "OpenAI",
  provider: "openai",
  model: "gpt-4.1-mini",
  endpoint: "",
  apiKey: "",
  isActive: true,
};

const DEFAULT_TRANSLATION_FORM: TranslationConfigForm = {
  label: "LibreTranslate",
  provider: "libretranslate",
  endpoint: "",
  apiKey: "",
  isActive: true,
};

const DEFAULT_MIDJOURNEY_FORM: MidjourneyConfigForm = {
  label: "Discord Webhook",
  provider: "discord_webhook",
  endpoint: "",
  apiKey: "",
  isActive: true,
};

class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const value = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    code?: string;
  };
  if (!response.ok) {
  throw new ApiRequestError(
    value.error || value.message || `请求失败：${response.status}`,
    response.status,
    value.code,
  );
  }
  return value as T;
}

function mergeFields(fields?: Partial<WorkbenchFields>): WorkbenchFields {
  return { ...EMPTY_FIELDS, ...fields };
}

function toPromptFields(fields: WorkbenchFields): PromptFields {
  return {
    subject: fields.subject,
    action: fields.action,
    environment: fields.environment,
    medium: fields.medium,
    style: fields.style,
    composition: fields.composition,
    camera: fields.camera,
    lighting: fields.lighting,
    color: fields.color,
    material: fields.material,
    mood: fields.mood,
    negative: fields.negative,
  };
}

function fromStoredFields(fields?: Partial<PromptFields>): WorkbenchFields {
  return mergeFields({
    subject: String(fields?.subject ?? ""),
    action: String(fields?.action ?? ""),
    environment: String(fields?.environment ?? ""),
    medium: String(fields?.medium ?? ""),
    style: String(fields?.style ?? ""),
    composition: String(fields?.composition ?? ""),
    camera: String(fields?.camera ?? ""),
    lighting: String(fields?.lighting ?? ""),
    color: String(fields?.color ?? ""),
    material: String(fields?.material ?? ""),
    mood: String(fields?.mood ?? ""),
    negative: String(fields?.negative ?? ""),
  });
}

function sourceLabel(source: PromptSource): string {
  return source === "ai" ? "AI 生成" : "规则生成";
}

function warningText(warning: PromptWarning): string {
  return warning.field ? `${warning.field}: ${warning.message}` : warning.message;
}

function completionPercent(fields: WorkbenchFields): number {
  const meaningfulFields = FIELD_META.filter((field) => field.key !== "custom");
  const complete = meaningfulFields.filter((field) => fields[field.key].trim()).length;
  return Math.round((complete / meaningfulFields.length) * 100);
}

export function PromptWorkbench() {
  const initialTemplate = TEMPLATES[0];
  const [fields, setFields] = useState<WorkbenchFields>(() => mergeFields(initialTemplate.fields));
  const [translatedFields, setTranslatedFields] = useState<Partial<PromptFields>>(
    initialTemplate.translatedFields,
  );
  const [parameters, setParameters] = useState<PromptParameters>(DEFAULT_PARAMETERS);
  const [idea, setIdea] = useState("雨夜都市中的电影感人像，冷色霓虹与克制的情绪");
  const [mode, setMode] = useState<PromptSource>("rule");
  const [activeTemplate, setActiveTemplate] = useState(initialTemplate.id);
  const [outputZh, setOutputZh] = useState("");
  const [outputEn, setOutputEn] = useState("");
  const [currentDraft, setCurrentDraft] = useState<PromptDraft | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<"zh" | "en" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("checking");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("phrases");
  const [, setMobileTab] = useState<MobileTab>("create");

  const [phrases, setPhrases] = useState<PhraseSnippet[]>([]);
  const [phrasesLoading, setPhrasesLoading] = useState(false);
  const [phraseSearch, setPhraseSearch] = useState("");
  const [phraseCategory, setPhraseCategory] = useState("全部");
  const [phraseEditor, setPhraseEditor] = useState<PhraseForm | null>(null);
  const [phraseSaving, setPhraseSaving] = useState(false);

  const [historyItems, setHistoryItems] = useState<PromptRecord[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [favorites, setFavorites] = useState<PromptRecord[]>([]);
  const [favoritePage, setFavoritePage] = useState(1);
  const [favoriteTotal, setFavoriteTotal] = useState(0);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoriteDialog, setFavoriteDialog] = useState(false);
  const [favoriteNote, setFavoriteNote] = useState("");
  const [favoriteSaving, setFavoriteSaving] = useState(false);
  const [editingFavorite, setEditingFavorite] = useState<{ id: string; note: string } | null>(null);

  const [providerConfigs, setProviderConfigs] = useState<PublicConfig[]>([]);
  const [translationConfigs, setTranslationConfigs] = useState<PublicConfig[]>([]);
  const [midjourneyConfigs, setMidjourneyConfigs] = useState<PublicConfig[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [configAction, setConfigAction] = useState<string | null>(null);
  const [aiForm, setAiForm] = useState<AiConfigForm>(DEFAULT_AI_FORM);
  const [translationForm, setTranslationForm] =
    useState<TranslationConfigForm>(DEFAULT_TRANSLATION_FORM);
  const [midjourneyForm, setMidjourneyForm] =
    useState<MidjourneyConfigForm>(DEFAULT_MIDJOURNEY_FORM);

  const [submissions, setSubmissions] = useState<MidjourneySubmission[]>([]);
  const [submissionPage, setSubmissionPage] = useState(1);
  const [submissionTotal, setSubmissionTotal] = useState(0);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResponse | null>(null);

  const textareaRefs = useRef<Partial<Record<WorkbenchFieldKey, HTMLTextAreaElement | null>>>({});
  const lastCaret = useRef<{ key: WorkbenchFieldKey; start: number; end: number } | null>(null);
  const toastTimer = useRef<number | null>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2800);
  }, []);

const markConnection = useCallback((error?: unknown) => {
  if (error instanceof ApiRequestError && error.status === 401) {
    setConnection("guest");
  } else if (error && !(error instanceof ApiRequestError)) {
    setConnection("offline");
  } else {
    setConnection("connected");
  }
}, []);

  const showError = useCallback(
    (error: unknown, fallback: string) => {
      const message = error instanceof Error ? error.message : fallback;
      notify(message);
      markConnection(error);
    },
    [markConnection, notify],
  );

  const loadPhrases = useCallback(async () => {
    setPhrasesLoading(true);
    try {
      const response = await requestJson<ListResponse<PhraseSnippet>>("/api/phrases");
      setPhrases(response.items);
      markConnection();
    } catch (error) {
      markConnection(error);
    } finally {
      setPhrasesLoading(false);
    }
  }, [markConnection]);

  const loadHistory = useCallback(async (page = 1) => {
    setHistoryLoading(true);
    try {
      const response = await requestJson<ListResponse<PromptRecord>>(
        `/api/history?page=${page}&limit=20`,
      );
      setHistoryItems(response.items);
      setHistoryTotal(response.total ?? response.items.length);
      setHistoryPage(page);
      markConnection();
    } catch (error) {
      showError(error, "鍘嗗彶璁板綍鍔犺浇澶辫触");
    } finally {
      setHistoryLoading(false);
    }
  }, [markConnection, showError]);

  const loadFavorites = useCallback(async (page = 1) => {
    setFavoritesLoading(true);
    try {
      const response = await requestJson<ListResponse<PromptRecord>>(
        `/api/favorites?page=${page}&limit=20`,
      );
      setFavorites(response.items);
      setFavoriteTotal(response.total ?? response.items.length);
      setFavoritePage(page);
      markConnection();
    } catch (error) {
      showError(error, "鏀惰棌鍔犺浇澶辫触");
    } finally {
      setFavoritesLoading(false);
    }
  }, [markConnection, showError]);

  const loadConfigs = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const [ai, translation, midjourney] = await Promise.all([
        requestJson<ListResponse<PublicConfig>>("/api/provider-configs"),
        requestJson<ListResponse<PublicConfig>>("/api/translation-configs"),
        requestJson<ListResponse<PublicConfig>>("/api/midjourney-configs"),
      ]);
      setProviderConfigs(ai.items);
      setTranslationConfigs(translation.items);
      setMidjourneyConfigs(midjourney.items);
      markConnection();
    } catch (error) {
      markConnection(error);
      if (!(error instanceof ApiRequestError && error.status === 401)) {
        showError(error, "鏈嶅姟閰嶇疆鍔犺浇澶辫触");
      }
    } finally {
      setSettingsLoading(false);
    }
  }, [markConnection, showError]);

  const loadSubmissions = useCallback(async (page = 1) => {
    setSubmissionsLoading(true);
    try {
      const response = await requestJson<ListResponse<MidjourneySubmission>>(
        `/api/midjourney-submissions?page=${page}&limit=20`,
      );
      setSubmissions(response.items);
      setSubmissionTotal(response.total ?? response.items.length);
      setSubmissionPage(page);
      markConnection();
    } catch (error) {
      showError(error, "鎻愪氦璁板綍鍔犺浇澶辫触");
    } finally {
      setSubmissionsLoading(false);
    }
  }, [markConnection, showError]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void Promise.all([loadPhrases(), loadConfigs()]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadConfigs, loadPhrases]);

  useEffect(() => {
    if (!drawerOpen) return;
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [drawerOpen]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const allPhrases = useMemo(() => [...phrases, ...CURATED_PHRASES], [phrases]);
  const categories = useMemo(
    () => ["全部", ...Array.from(new Set(phrases.map((phrase) => phrase.category))).filter(Boolean)],
    [phrases],
  );
  const visiblePhrases = useMemo(() => {
    const query = phraseSearch.trim().toLocaleLowerCase();
    return phrases.filter((phrase) => {
      const categoryMatches = phraseCategory === "全部" || phrase.category === phraseCategory;
      const queryMatches =
        !query ||
        [phrase.name, phrase.category, phrase.content].some((value) =>
          value.toLocaleLowerCase().includes(query),
        );
      return categoryMatches && queryMatches;
    });
  }, [phraseCategory, phraseSearch, phrases]);

  const parameterValidation = useMemo(() => validateParameters(parameters), [parameters]);
  const parameterString = useMemo(() => serializeParameters(parameters), [parameters]);
  const activeMidjourneyConfig = midjourneyConfigs.find((config) => config.isActive);
  const hasOutput = Boolean(outputEn.trim() || outputZh.trim());
  const progress = completionPercent(fields);

  const selectTemplate = (template: Template) => {
    setActiveTemplate(template.id);
    setFields(mergeFields(template.fields));
    setTranslatedFields(template.translatedFields);
    setOutputZh("");
    setOutputEn("");
    setCurrentDraft(null);
    setSubmissionResult(null);
    notify(`已套用模板：${template.title}`);
  };

  const updateField = (key: WorkbenchFieldKey, value: string) => {
    setFields((current) => ({ ...current, [key]: value }));
    if (key !== "custom") {
      setTranslatedFields((current) => ({ ...current, [key]: undefined }));
    }
  };

  const rememberCaret = (key: WorkbenchFieldKey, element: HTMLTextAreaElement) => {
    lastCaret.current = {
      key,
      start: element.selectionStart ?? element.value.length,
      end: element.selectionEnd ?? element.value.length,
    };
  };

  const insertPhrase = (content: string) => {
    const caret = lastCaret.current;
    const key = caret?.key ?? "custom";
    const start = caret?.start ?? fields[key].length;
    const end = caret?.end ?? start;
    const existing = fields[key];
    const prefix = existing.slice(0, start);
    const suffix = existing.slice(end);
    const leftSeparator = prefix && !/[\s,，]$/.test(prefix) ? ", " : "";
    const rightSeparator = suffix && !/^[\s,，]/.test(suffix) ? ", " : "";
    const nextValue = `${prefix}${leftSeparator}${content}${rightSeparator}${suffix}`;
    const nextCaret = prefix.length + leftSeparator.length + content.length;
    updateField(key, nextValue);
    window.requestAnimationFrame(() => {
      const element = textareaRefs.current[key];
      element?.focus();
      element?.setSelectionRange(nextCaret, nextCaret);
      lastCaret.current = { key, start: nextCaret, end: nextCaret };
    });
    notify(`已插入：${content}`);
  };

  const openDrawer = (tab: DrawerTab) => {
    setDrawerTab(tab);
    setDrawerOpen(true);
    if (tab === "history") void loadHistory(historyPage);
    if (tab === "favorites") void loadFavorites(favoritePage);
    if (tab === "submissions") void loadSubmissions(submissionPage);
    if (tab === "settings") void loadConfigs();
  };

  const handleGenerate = async () => {
    if (!parameterValidation.valid) {
      notify(parameterValidation.warnings.find((item) => item.severity === "error")?.message ?? "参数校验失败");
      return;
    }
    if (!Object.values(fields).some((value) => value.trim()) && !idea.trim()) {
      notify("请先填写创意描述或结构化字段");
      return;
    }
    setGenerating(true);
    setSubmissionResult(null);
    try {
      const response = await requestJson<GenerateResponse>("/api/prompts/generate", {
        method: "POST",
        body: JSON.stringify({
          mode,
          idea,
          fields: toPromptFields(fields),
          custom: fields.custom,
          translatedFields,
          presetIds: [],
          parameters,
        }),
      });
      setOutputZh(response.draft.promptZh);
      setOutputEn(response.draft.promptEn);
      setCurrentDraft(response.draft);
      setTranslatedFields(response.draft.translatedFields);
      markConnection();
      notify("Prompt 已生成并自动保存到历史");
    } catch (error) {
      showError(error, "Prompt 生成失败");
    } finally {
      setGenerating(false);
    }
  };

  const handleIdeaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void handleGenerate();
    }
  };

  const copyOutput = async (language: "zh" | "en") => {
    const value = language === "zh" ? outputZh : outputEn;
    if (!value.trim()) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(language);
      window.setTimeout(() => setCopied(null), 1500);
      notify("已复制到剪贴板");
    } catch {
      notify("复制失败，请手动选择文本");
    }
  };

  const buildSnapshot = (): StoredSnapshot | null => {
    if (!hasOutput) return null;
    return {
      promptZh: outputZh,
      promptEn: outputEn,
      source: currentDraft?.source ?? mode,
      input: currentDraft?.fields ?? toPromptFields(fields),
      fields: currentDraft?.fields ?? toPromptFields(fields),
      translatedFields: currentDraft?.translatedFields ?? translatedFields,
      parameters: currentDraft?.parameters ?? parameters,
      warnings: currentDraft?.warnings ?? parameterValidation.warnings,
    };
  };

  const saveFavorite = async () => {
    const snapshot = buildSnapshot();
    if (!snapshot) return;
    setFavoriteSaving(true);
    try {
      await requestJson<{ item: PromptRecord }>("/api/favorites", {
        method: "POST",
        body: JSON.stringify({ snapshot, note: favoriteNote }),
      });
      setFavoriteDialog(false);
      setFavoriteNote("");
      notify("已收藏，备注可随时修改");
      if (drawerTab === "favorites") void loadFavorites(1);
    } catch (error) {
      showError(error, "收藏失败");
    } finally {
      setFavoriteSaving(false);
    }
  };

  const submitToMidjourney = async () => {
    const snapshot = buildSnapshot();
    if (!snapshot || !activeMidjourneyConfig) return;
    setSubmitting(true);
    setSubmissionResult(null);
    try {
      const response = await requestJson<SubmissionResponse>("/api/midjourney-submissions", {
        method: "POST",
        body: JSON.stringify({
          promptZh: outputZh,
          promptEn: outputEn,
          source: snapshot.source,
          snapshot: {
            promptZh: snapshot.promptZh,
            promptEn: snapshot.promptEn,
            source: snapshot.source,
            fields: snapshot.fields,
            parameters: snapshot.parameters,
            warnings: snapshot.warnings,
          },
        }),
      });
      setSubmissionResult(response);
      notify(`已投递到配置入口（仅推送）：${response.status}`);
      if (drawerTab === "submissions") void loadSubmissions(1);
    } catch (error) {
      showError(error, "推送失败");
    } finally {
      setSubmitting(false);
    }
  };

  const savePhrase = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!phraseEditor) return;
    setPhraseSaving(true);
    try {
      const path = phraseEditor.id ? `/api/phrases/${phraseEditor.id}` : "/api/phrases";
      await requestJson<{ item: PhraseSnippet }>(path, {
        method: phraseEditor.id ? "PATCH" : "POST",
        body: JSON.stringify({
          name: phraseEditor.name,
          category: phraseEditor.category,
          content: phraseEditor.content,
          sortOrder: phraseEditor.sortOrder,
        }),
      });
      setPhraseEditor(null);
      await loadPhrases();
      notify(phraseEditor.id ? "常用词已更新" : "常用词已保存");
    } catch (error) {
      showError(error, "常用词保存失败");
    } finally {
      setPhraseSaving(false);
    }
  };

  const deletePhrase = async (id: string) => {
    try {
      await requestJson<{ success: boolean }>(`/api/phrases/${id}`, { method: "DELETE" });
      setPhrases((items) => items.filter((item) => item.id !== id));
      notify("常用词已删除");
    } catch (error) {
      showError(error, "用户词条删除失败");
    }
  };

  const restoreRecord = (record: PromptRecord) => {
    const snapshot = record.snapshot ?? record;
    const storedFields = snapshot.input ?? snapshot.fields;
    setFields(fromStoredFields(storedFields));
    setTranslatedFields(snapshot.translatedFields ?? {});
    setParameters({ ...DEFAULT_PARAMETERS, ...(snapshot.parameters ?? {}) });
    setOutputZh(snapshot.promptZh || record.promptZh);
    setOutputEn(snapshot.promptEn || record.promptEn);
    setMode(snapshot.source || record.source);
    setCurrentDraft(null);
    setDrawerOpen(false);
    setMobileTab("create");
    setSubmissionResult(null);
    notify("提示已恢复到编辑器");
  };

  const deleteHistory = async (id: string) => {
    try {
      await requestJson<{ success: boolean }>(`/api/history/${id}`, { method: "DELETE" });
      await loadHistory(historyPage);
      notify("已删除历史记录");
    } catch (error) {
      showError(error, "鍒犻櫎鍘嗗彶璁板綍澶辫触");
    }
  };

  const clearHistory = async () => {
    try {
      await requestJson<{ success: boolean }>("/api/history", { method: "DELETE" });
      setHistoryItems([]);
      setHistoryTotal(0);
      setHistoryPage(1);
      notify("已清空历史记录");
    } catch (error) {
      showError(error, "娓呯┖鍘嗗彶璁板綍澶辫触");
    }
  };

  const deleteFavorite = async (id: string) => {
    try {
      await requestJson<{ success: boolean }>(`/api/favorites/${id}`, { method: "DELETE" });
      await loadFavorites(favoritePage);
      notify("已移除收藏");
    } catch (error) {
      showError(error, "鍙栨秷鏀惰棌澶辫触");
    }
  };

  const updateFavoriteNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingFavorite) return;
    try {
      await requestJson<{ item: PromptRecord }>(`/api/favorites/${editingFavorite.id}`, {
        method: "PATCH",
        body: JSON.stringify({ note: editingFavorite.note }),
      });
      setEditingFavorite(null);
      await loadFavorites(favoritePage);
      notify("收藏备注已更新");
    } catch (error) {
      showError(error, "澶囨敞鏇存柊澶辫触");
    }
  };

  const saveAiConfig = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setConfigAction("save-ai");
    try {
      await requestJson<{ item: PublicConfig }>("/api/provider-configs", {
        method: "POST",
        body: JSON.stringify({
          label: aiForm.label,
          provider: aiForm.provider,
          model: aiForm.model,
          ...(aiForm.endpoint ? { endpoint: aiForm.endpoint } : {}),
          apiKey: aiForm.apiKey,
          isActive: aiForm.isActive,
        }),
      });
      setAiForm(DEFAULT_AI_FORM);
      await loadConfigs();
      notify("AI 模型配置已保存");
    } catch (error) {
      showError(error, "AI 妯″瀷閰嶇疆淇濆瓨澶辫触");
    } finally {
      setConfigAction(null);
    }
  };

  const saveTranslationConfig = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setConfigAction("save-translation");
    try {
      await requestJson<{ item: PublicConfig }>("/api/translation-configs", {
        method: "POST",
        body: JSON.stringify({
          label: translationForm.label,
          provider: translationForm.provider,
          ...(translationForm.endpoint ? { endpoint: translationForm.endpoint } : {}),
          apiKey: translationForm.apiKey,
          isActive: translationForm.isActive,
        }),
      });
      setTranslationForm(DEFAULT_TRANSLATION_FORM);
      await loadConfigs();
      notify("翻译服务配置已保存");
    } catch (error) {
      showError(error, "缈昏瘧閰嶇疆淇濆瓨澶辫触");
    } finally {
      setConfigAction(null);
    }
  };

  const saveMidjourneyConfig = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setConfigAction("save-midjourney");
    try {
      await requestJson<{ item: PublicConfig }>("/api/midjourney-configs", {
        method: "POST",
        body: JSON.stringify(midjourneyForm),
      });
      setMidjourneyForm(DEFAULT_MIDJOURNEY_FORM);
      await loadConfigs();
      notify("Midjourney 推送配置已保存");
    } catch (error) {
      showError(error, "Midjourney 閰嶇疆淇濆瓨澶辫触");
    } finally {
      setConfigAction(null);
    }
  };

  const configBasePath = (kind: "ai" | "translation" | "midjourney") => {
    if (kind === "ai") return "/api/provider-configs";
    if (kind === "translation") return "/api/translation-configs";
    return "/api/midjourney-configs";
  };

  const activateConfig = async (
    kind: "ai" | "translation" | "midjourney",
    id: string,
  ) => {
    setConfigAction(`activate-${id}`);
    try {
      await requestJson<{ item: PublicConfig }>(`${configBasePath(kind)}/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: true }),
      });
      await loadConfigs();
      notify("配置已启用");
    } catch (error) {
      showError(error, "鍚敤閰嶇疆澶辫触");
    } finally {
      setConfigAction(null);
    }
  };

  const testConfig = async (
    kind: "ai" | "translation" | "midjourney",
    id: string,
  ) => {
    setConfigAction(`test-${id}`);
    try {
      await requestJson<{ success: boolean; message?: string; details?: string }>(
        `${configBasePath(kind)}/test`,
        {
          method: "POST",
          body: JSON.stringify({ id }),
        },
      );
      notify(kind === "midjourney" ? "测试消息已发送（仅推送）" : "连接测试成功");
    } catch (error) {
      showError(error, "连接测试失败");
    } finally {
      setConfigAction(null);
    }
  };

  const deleteConfig = async (
    kind: "ai" | "translation" | "midjourney",
    id: string,
  ) => {
    setConfigAction(`delete-${id}`);
    try {
      await requestJson<{ success: boolean }>(`${configBasePath(kind)}/${id}`, {
        method: "DELETE",
      });
      await loadConfigs();
      notify("配置已删除");
    } catch (error) {
      showError(error, "删除配置失败");
    } finally {
      setConfigAction(null);
    }
  };

  const renderConfigs = (
    kind: "ai" | "translation" | "midjourney",
    configs: PublicConfig[],
  ) => (
    <div className="service-config-list">
      {configs.length ? configs.map((config) => (
        <article key={config.id}>
          <span className={config.isActive ? "is-active" : ""}>
            {config.isActive ? <Check size={12} /> : <KeyRound size={12} />}
          </span>
          <div>
            <strong>{config.label}{config.isActive ? "（当前启用）" : ""}</strong>
            <small>{config.provider}{config.model ? ` · ${config.model}` : ""} · {config.apiKeyMasked || "无需密钥"}</small>
          </div>
          <div>
            {!config.isActive ? (
              <button type="button" disabled={Boolean(configAction)} onClick={() => void activateConfig(kind, config.id)}>启用</button>
            ) : null}
            <button type="button" disabled={Boolean(configAction)} onClick={() => void testConfig(kind, config.id)}>
              {configAction === `test-${config.id}` ? <LoaderCircle className="spin" size={12} /> : <RefreshCw size={12} />}
            </button>
            <button type="button" disabled={Boolean(configAction)} onClick={() => void deleteConfig(kind, config.id)}>
              <Trash2 size={12} />
            </button>
          </div>
        </article>
      )) : <p className="config-empty">尚未保存配置</p>}
    </div>
  );

  return (
    <main className="workbench-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><WandSparkles size={18} /></span>
          <span><strong>Prompt Craft</strong><small>Midjourney 创作工作台</small></span>
        </div>
        <div className="topbar-actions">
          <span className={`connection-pill is-${connection}`}>
            {connection === "connected" ? "服务已连接" : connection === "guest" ? "未登录" : connection === "offline" ? "网络不可用" : "连接检查中"}
          </span>
          {connection === "guest" ? <Link href="/signin">登录</Link> : null}
          <button type="button" onClick={() => openDrawer("phrases")}><Library size={15} /> 资料库</button>
          <button type="button" onClick={() => openDrawer("settings")}><Settings2 size={15} /> 配置</button>
        </div>
      </header>

      <section className="workspace-grid">
        <aside className="left-panel panel-scroll">
          <div className="panel-heading"><div><span className="section-kicker">TEMPLATES</span><h2>创作模板</h2></div></div>
          <div className="template-list">
            {TEMPLATES.map((template) => (
              <button className={`template-card ${activeTemplate === template.id ? "is-active" : ""}`} key={template.id} type="button" onClick={() => selectTemplate(template)}>
                <span>{template.eyebrow}</span><strong>{template.title}</strong><small>{template.accent}</small>
              </button>
            ))}
          </div>
          <div className="panel-heading"><div><span className="section-kicker">QUICK PHRASES</span><h2>常用词语</h2></div></div>
          <div className="quick-phrase-list">
            {allPhrases.slice(0, 16).map((phrase) => (
              <button key={phrase.id} type="button" onClick={() => insertPhrase(phrase.content)} title={phrase.content}>
                <Plus size={11} /> {phrase.name}
              </button>
            ))}
          </div>
          <button className="secondary-button" type="button" onClick={() => openDrawer("phrases")}>管理常用词</button>
        </aside>

        <section className="center-panel panel-scroll">
          <div className="workbench-intro">
            <div><span className="section-kicker">PROMPT WORKBENCH</span><h1>把灵感整理成可复用的 Prompt</h1></div>
            <div className="mode-switch">
              <button className={mode === "rule" ? "is-active" : ""} type="button" onClick={() => setMode("rule")}>规则模式</button>
              <button className={mode === "ai" ? "is-active" : ""} type="button" onClick={() => setMode("ai")}>AI 模式</button>
            </div>
          </div>
          <section className="idea-card">
            <label htmlFor="idea">创意描述</label>
            <textarea id="idea" value={idea} onChange={(event) => setIdea(event.target.value)} onKeyDown={handleIdeaKeyDown} maxLength={4000} placeholder="例如：雨夜都市中的电影感人像，冷色霓虹与克制的情绪" />
            <div className="idea-footer">
              <span><kbd>Ctrl</kbd> + <kbd>Enter</kbd> 快速生成</span>
              <button className="generate-button" type="button" disabled={generating} onClick={() => void handleGenerate()}>
                {generating ? <LoaderCircle className="spin" size={14} /> : <WandSparkles size={14} />}
                {generating ? "正在生成..." : mode === "ai" ? "AI 生成" : "生成 Prompt"}
              </button>
            </div>
          </section>

          <div className="editor-heading">
            <div><span className="section-kicker">STRUCTURE</span><h2>结构化编辑</h2></div>
            <span>{progress}%</span>
          </div>
          <div className="field-grid">
            {FIELD_META.map((meta) => (
              <label className={`field-card ${meta.wide ? "is-wide" : ""}`} key={meta.key}>
                <span className="field-label">{meta.label}<small>{meta.hint}</small></span>
                <textarea
                  ref={(element) => { textareaRefs.current[meta.key] = element; }}
                  value={fields[meta.key]}
                  maxLength={4000}
                  onChange={(event) => updateField(meta.key, event.target.value)}
                  onFocus={(event) => rememberCaret(meta.key, event.currentTarget)}
                  onSelect={(event) => rememberCaret(meta.key, event.currentTarget)}
                  placeholder={meta.hint}
                />
              </label>
            ))}
          </div>

          <section className="result-section">
            <div className="result-heading"><div><span className="section-kicker">OUTPUT</span><h2>生成结果</h2></div></div>
            {currentDraft?.warnings.length ? <div className="inline-notice"><CircleAlert size={14} /><span>{currentDraft.warnings.map(warningText).join("；")}</span></div> : null}
            <div className="result-grid">
              <article className="result-card">
                <header className="result-card-head"><span>中文描述 <small>ZH</small></span><button type="button" disabled={!outputZh} onClick={() => void copyOutput("zh")}>{copied === "zh" ? <Check size={11} /> : <Copy size={11} />} 复制</button></header>
                <textarea value={outputZh} maxLength={48000} onChange={(event) => setOutputZh(event.target.value)} placeholder="生成后显示中文描述" />
              </article>
              <article className="result-card is-primary">
                <header className="result-card-head"><span>English Prompt <small>MJ</small></span><button type="button" disabled={!outputEn} onClick={() => void copyOutput("en")}>{copied === "en" ? <Check size={11} /> : <Copy size={11} />} 复制</button></header>
                <textarea value={outputEn} maxLength={48000} onChange={(event) => setOutputEn(event.target.value)} placeholder="Generated English prompt appears here" />
              </article>
            </div>
            <div className="result-actions">
              <button className="secondary-button" type="button" disabled={!hasOutput} onClick={() => setFavoriteDialog(true)}><Heart size={14} /> 收藏并备注</button>
              <button className="primary-copy-button submit-midjourney-button" type="button" disabled={!hasOutput || !activeMidjourneyConfig || submitting} onClick={() => void submitToMidjourney()}>
                {submitting ? <LoaderCircle className="spin" size={14} /> : <Send size={14} />}
                {submitting ? "发送中..." : "发送到配置入口"}
              </button>
            </div>
            <p className="submission-hint">
              该功能只向 Discord Webhook 或自定义 HTTP 入口推送文本，不代表官方 Midjourney 任务已创建，也不返回图片生成进度。
            </p>
            {!activeMidjourneyConfig ? <button className="submission-hint" type="button" onClick={() => openDrawer("settings")}>请先启用一个推送配置</button> : null}
            {submissionResult ? <div className={`submission-state is-${submissionResult.status}`}><Check size={13} /><span>已投递（仅推送）：{submissionResult.status} / 记录 ID：{submissionResult.submissionId}</span></div> : null}
          </section>
        </section>

        <aside className="right-panel panel-scroll">
          <div className="parameter-header"><div><span className="section-kicker">MIDJOURNEY</span><h2>生成参数</h2></div><SlidersHorizontal size={16} /></div>
          <label className="parameter-group"><span className="field-label">模型版本</span>
            <select value={parameters.model} onChange={(event) => setParameters((current) => ({ ...current, model: event.target.value as PromptParameters["model"] }))}>
              {MIDJOURNEY_MODELS.map((model) => <option key={model} value={model}>{model}</option>)}
            </select>
          </label>
          <label className="parameter-group"><span className="field-label">画面比例</span><input value={parameters.aspectRatio ?? ""} onChange={(event) => setParameters((current) => ({ ...current, aspectRatio: event.target.value }))} placeholder="16:9" /></label>
          <label className="parameter-group"><span><span className="field-label">Stylize</span><output>{parameters.stylize ?? 0}</output></span><input type="range" min="0" max="1000" value={parameters.stylize ?? 0} onChange={(event) => setParameters((current) => ({ ...current, stylize: Number(event.target.value) }))} /></label>
          <label className="parameter-group"><span><span className="field-label">Chaos</span><output>{parameters.chaos ?? 0}</output></span><input type="range" min="0" max="100" value={parameters.chaos ?? 0} onChange={(event) => setParameters((current) => ({ ...current, chaos: Number(event.target.value) }))} /></label>
          <label className="parameter-group"><span><span className="field-label">Weird</span><output>{parameters.weird ?? 0}</output></span><input type="range" min="0" max="3000" value={parameters.weird ?? 0} onChange={(event) => setParameters((current) => ({ ...current, weird: Number(event.target.value) }))} /></label>
          <label className="parameter-group"><span className="field-label">Quality</span><select value={parameters.quality ?? 1} onChange={(event) => setParameters((current) => ({ ...current, quality: Number(event.target.value) }))}><option value="0.25">0.25</option><option value="0.5">0.5</option><option value="1">1</option><option value="2">2</option><option value="4">4</option></select></label>
          <label className="parameter-group"><span className="field-label">Seed</span><input type="number" min="0" max="4294967295" value={parameters.seed ?? ""} onChange={(event) => setParameters((current) => ({ ...current, seed: event.target.value ? Number(event.target.value) : undefined }))} /></label>
          <label className="toggle-row"><input type="checkbox" checked={Boolean(parameters.raw)} onChange={(event) => setParameters((current) => ({ ...current, raw: event.target.checked }))} /><span><strong>Raw</strong><small>减少默认风格干预</small></span></label>
          <label className="toggle-row"><input type="checkbox" checked={Boolean(parameters.tile)} onChange={(event) => setParameters((current) => ({ ...current, tile: event.target.checked }))} /><span><strong>Tile</strong><small>生成无缝平铺纹理</small></span></label>
          <label className="parameter-group"><span className="field-label">No / 额外排除</span><input value={(parameters.no ?? []).join(", ")} onChange={(event) => setParameters((current) => ({ ...current, no: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) }))} /></label>
          <div className="parameter-preview"><span>参数预览</span><code>{parameterString || "暂无参数"}</code></div>
          {parameterValidation.warnings.map((warning) => <p className={warning.severity === "error" ? "is-error" : ""} key={`${warning.code}-${warning.field ?? ""}`}>{warning.message}</p>)}
        </aside>
      </section>

      {drawerOpen ? (
        <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDrawerOpen(false); }}>
          <section className="library-drawer">
            <header><div><span className="section-kicker">PERSONAL LIBRARY</span><h2>个人创作资料库</h2></div><button type="button" onClick={() => setDrawerOpen(false)}><X size={18} /></button></header>
            <nav className="drawer-tabs">
              {(["phrases", "history", "favorites", "submissions", "settings"] as DrawerTab[]).map((tab) => (
                <button className={drawerTab === tab ? "is-active" : ""} key={tab} type="button" onClick={() => openDrawer(tab)}>
                  {tab === "phrases" ? "常用词" : tab === "history" ? "历史" : tab === "favorites" ? "收藏" : tab === "submissions" ? "推送记录" : "服务配置"}
                </button>
              ))}
            </nav>
            <div className="drawer-content">
              {connection === "guest" ? <div className="guest-gate"><CircleUserRound size={20} /><span>登录后可保存个人资料和服务配置。</span><Link href="/signin">去登录</Link></div> : null}

              {drawerTab === "phrases" ? (
                <section>
                  <div className="drawer-section-head"><div><span className="section-kicker">PHRASES</span><h3>我的常用词</h3></div><button type="button" onClick={() => setPhraseEditor({ name: "", category: "自定义", content: "", sortOrder: 0 })}><Plus size={13} /> 新建</button></div>
                  <div className="phrase-toolbar"><input value={phraseSearch} onChange={(event) => setPhraseSearch(event.target.value)} placeholder="搜索词语、分类或内容" /><select value={phraseCategory} onChange={(event) => setPhraseCategory(event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></div>
                  {phraseEditor ? (
                    <form className="inline-form" onSubmit={savePhrase}>
                      <input required maxLength={80} value={phraseEditor.name} onChange={(event) => setPhraseEditor({ ...phraseEditor, name: event.target.value })} placeholder="名称" />
                      <input required maxLength={80} value={phraseEditor.category} onChange={(event) => setPhraseEditor({ ...phraseEditor, category: event.target.value })} placeholder="分类" />
                      <textarea required maxLength={4000} value={phraseEditor.content} onChange={(event) => setPhraseEditor({ ...phraseEditor, content: event.target.value })} placeholder="词语或短语内容" />
                      <div><button type="button" onClick={() => setPhraseEditor(null)}>取消</button><button type="submit" disabled={phraseSaving}>保存</button></div>
                    </form>
                  ) : null}
                  <div className="record-list">
                    {phrasesLoading ? <p>加载中...</p> : visiblePhrases.map((phrase) => (
                      <article className="record-card" key={phrase.id}>
                        <button type="button" onClick={() => insertPhrase(phrase.content)}><strong>{phrase.name}</strong><p>{phrase.content}</p><small>{phrase.category}</small></button>
                        <div><button type="button" onClick={() => setPhraseEditor(phrase)}><Pencil size={12} /></button><button type="button" onClick={() => void deletePhrase(phrase.id)}><Trash2 size={12} /></button></div>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {drawerTab === "history" ? (
                <section><div className="drawer-section-head"><div><span className="section-kicker">HISTORY · {historyTotal}/100</span><h3>生成历史</h3></div><button type="button" onClick={() => void clearHistory()}>清空</button></div>
                  <div className="record-list">{historyLoading ? <p>加载中...</p> : historyItems.map((item) => <article className="record-card" key={item.id}><button type="button" onClick={() => restoreRecord(item)}><strong>{item.promptEn || item.promptZh}</strong><small>{sourceLabel(item.source)}</small></button><button type="button" onClick={() => void deleteHistory(item.id)}><Trash2 size={12} /></button></article>)}</div>
                </section>
              ) : null}

              {drawerTab === "favorites" ? (
                <section><div className="drawer-section-head"><div><span className="section-kicker">FAVORITES · {favoriteTotal}</span><h3>收藏与备注</h3></div></div>
                  <div className="record-list">{favoritesLoading ? <p>加载中...</p> : favorites.map((item) => <article className="record-card" key={item.id}><button type="button" onClick={() => restoreRecord(item)}><strong>{item.promptEn || item.promptZh}</strong><small>{item.note || "无备注"}</small></button><div><button type="button" onClick={() => setEditingFavorite({ id: item.id, note: item.note ?? "" })}><Pencil size={12} /></button><button type="button" onClick={() => void deleteFavorite(item.id)}><Trash2 size={12} /></button></div></article>)}</div>
                </section>
              ) : null}

              {drawerTab === "submissions" ? (
                <section><div className="drawer-section-head"><div><span className="section-kicker">PUSH RECORDS · {submissionTotal}</span><h3>配置入口推送记录</h3></div></div>
                  <p className="inline-notice">这里记录的是 HTTP 推送状态，不是 Midjourney 图片任务状态。</p>
                  <div className="record-list">{submissionsLoading ? <p>加载中...</p> : submissions.map((item) => <article className="record-card" key={item.id}><div><strong>{item.promptEn || item.promptZh}</strong><small>{item.status}{item.errorMessage ? ` · ${item.errorMessage}` : ""}</small></div></article>)}</div>
                </section>
              ) : null}

              {drawerTab === "settings" ? (
                <section className="settings-stack">
                  <div className="security-note"><ShieldCheck size={17} /><div><h3>服务与密钥</h3><p>端点和密钥由服务器使用 AES-256-GCM 加密保存，浏览器只显示脱敏信息。</p></div></div>
                  <section className="settings-card"><h3>Midjourney 推送入口</h3><p>仅转发 Prompt，不创建或跟踪官方 Midjourney 任务。</p>{renderConfigs("midjourney", midjourneyConfigs)}
                    <form className="config-form" onSubmit={saveMidjourneyConfig}>
                      <input required value={midjourneyForm.label} onChange={(event) => setMidjourneyForm({ ...midjourneyForm, label: event.target.value })} placeholder="配置名称" />
                      <select value={midjourneyForm.provider} onChange={(event) => setMidjourneyForm({ ...midjourneyForm, provider: event.target.value as MidjourneyConfigForm["provider"] })}><option value="discord_webhook">Discord Webhook</option><option value="custom_http">自定义 HTTP</option></select>
                      <input required type="url" value={midjourneyForm.endpoint} onChange={(event) => setMidjourneyForm({ ...midjourneyForm, endpoint: event.target.value })} placeholder="https://discord.com/api/webhooks/..." />
                      <input type="password" value={midjourneyForm.apiKey} onChange={(event) => setMidjourneyForm({ ...midjourneyForm, apiKey: event.target.value })} placeholder="API Key（可选）" />
                      <label><input type="checkbox" checked={midjourneyForm.isActive} onChange={(event) => setMidjourneyForm({ ...midjourneyForm, isActive: event.target.checked })} /> 保存后启用</label>
                      <button type="submit" disabled={Boolean(configAction)}>保存推送配置</button>
                    </form>
                  </section>
                  <section className="settings-card"><h3>AI 模型</h3>{renderConfigs("ai", providerConfigs)}
                    <form className="config-form" onSubmit={saveAiConfig}>
                      <input required value={aiForm.label} onChange={(event) => setAiForm({ ...aiForm, label: event.target.value })} placeholder="配置名称" />
                      <input required value={aiForm.provider} onChange={(event) => setAiForm({ ...aiForm, provider: event.target.value })} placeholder="供应商" />
                      <input required value={aiForm.model} onChange={(event) => setAiForm({ ...aiForm, model: event.target.value })} placeholder="模型名" />
                      <input type="url" value={aiForm.endpoint} onChange={(event) => setAiForm({ ...aiForm, endpoint: event.target.value })} placeholder="兼容端点（可选）" />
                      <input required type="password" value={aiForm.apiKey} onChange={(event) => setAiForm({ ...aiForm, apiKey: event.target.value })} placeholder="API Key" />
                      <label><input type="checkbox" checked={aiForm.isActive} onChange={(event) => setAiForm({ ...aiForm, isActive: event.target.checked })} /> 保存后启用</label>
                      <button type="submit" disabled={Boolean(configAction)}>保存 AI 配置</button>
                    </form>
                  </section>
                  <section className="settings-card"><h3>翻译服务</h3>{renderConfigs("translation", translationConfigs)}
                    <form className="config-form" onSubmit={saveTranslationConfig}>
                      <input required value={translationForm.label} onChange={(event) => setTranslationForm({ ...translationForm, label: event.target.value })} placeholder="配置名称" />
                      <input required value={translationForm.provider} onChange={(event) => setTranslationForm({ ...translationForm, provider: event.target.value })} placeholder="供应商" />
                      <input type="url" value={translationForm.endpoint} onChange={(event) => setTranslationForm({ ...translationForm, endpoint: event.target.value })} placeholder="端点（可选）" />
                      <input type="password" value={translationForm.apiKey} onChange={(event) => setTranslationForm({ ...translationForm, apiKey: event.target.value })} placeholder="API Key（可选）" />
                      <label><input type="checkbox" checked={translationForm.isActive} onChange={(event) => setTranslationForm({ ...translationForm, isActive: event.target.checked })} /> 保存后启用</label>
                      <button type="submit" disabled={Boolean(configAction)}>保存翻译配置</button>
                    </form>
                  </section>
                  {settingsLoading ? <p>正在加载配置...</p> : null}
                </section>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {favoriteDialog ? <div className="modal-backdrop"><section className="favorite-modal"><header><div><h3>收藏 Prompt</h3><p>收藏没有数量上限，快照不会随历史清理而删除。</p></div><button type="button" onClick={() => setFavoriteDialog(false)}><X size={17} /></button></header><textarea maxLength={1000} value={favoriteNote} onChange={(event) => setFavoriteNote(event.target.value)} placeholder="添加备注（可选）" /><footer><span>{favoriteNote.length}/1000</span><button type="button" disabled={favoriteSaving} onClick={() => void saveFavorite()}>{favoriteSaving ? "保存中..." : "确认收藏"}</button></footer></section></div> : null}
      {editingFavorite ? <div className="modal-backdrop"><form className="favorite-modal" onSubmit={updateFavoriteNote}><header><h3>修改收藏备注</h3><button type="button" onClick={() => setEditingFavorite(null)}><X size={17} /></button></header><textarea maxLength={1000} value={editingFavorite.note} onChange={(event) => setEditingFavorite({ ...editingFavorite, note: event.target.value })} /><footer><button type="submit">保存备注</button></footer></form></div> : null}
      {toast ? <div className="toast-message">{toast}</div> : null}
    </main>
  );
}

/*
  return (
    <main className="workbench-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Prompt Craft Studio 棣栭〉">
          <span className="brand-mark"><WandSparkles size={18} /></span>
          <span>
            <strong>Prompt Craft Studio</strong>
            <small>Midjourney 鍒涗綔宸ヤ綔鍙?/small>
          </span>
        </Link>
        <div className="topbar-center">
          <span className="workspace-dot" />
          涓嫳鏂?Prompt 路 鍙傛暟鏍￠獙 路 鐩存帴鎻愪氦
        </div>
        <div className="topbar-actions">
          <span className={`connection-pill is-${connection}`}>
            {connection === "checking" ? <LoaderCircle className="spin" size={13} /> : connection === "connected" ? <Check size={13} /> : <CircleAlert size={13} />}
            <span>
              {connection === "connected"
                ? "宸茶繛鎺?"
                : connection === "guest"
                  ? "鏈櫥褰?"
                  : connection === "offline"
                    ? "鏈嶅姟寮傚父"
                    : "妫€鏌ヤ腑"}
            </span>
          </span>
          <button className="secondary-button desktop-library-button" type="button" onClick={() => openDrawer("phrases")}>
            <Library size={14} /> 绱犳潗搴?          </button>
          <button className="icon-button mobile-only" type="button" aria-label="鎵撳紑绱犳潗搴?" onClick={() => openDrawer("phrases"")}>
            <Menu size={16} />
          </button>
          <Link className="avatar-button" href="/signin" aria-label="鐧诲綍璐︽埛">
            <CircleUserRound size={17} />
          </Link>
        </div>
      </header>

      <nav className="mobile-tabs" aria-label="绉诲姩绔伐浣滃彴瀵艰埅">
        <button className={mobileTab === "materials" ? "is-active" : ""} type="button" onClick={() => setMobileTab("materials")}>
          <LayoutTemplate size={14} /> 绱犳潗
        </button>
        <button className={mobileTab === "create" ? "is-active" : ""} type="button" onClick={() => setMobileTab("create")}>
          <Sparkles size={14} /> 鍒涗綔
        </button>
        <button className={mobileTab === "parameters" ? "is-active" : ""} type="button" onClick={() => setMobileTab("parameters")}>
          <SlidersHorizontal size={14} /> 鍙傛暟
        </button>
      </nav>

      <div className="workbench-grid" data-mobile-tab={mobileTab}>
        <aside className="left-panel panel-scroll">
          <section className="panel-section">
            <div className="section-heading">
              <div>
                <span className="section-kicker">TEMPLATES</span>
                <h2>鍒涗綔妯℃澘</h2>
              </div>
              <span className="count-badge">{TEMPLATES.length}</span>
            </div>
            <div className="template-list">
              {TEMPLATES.map((template) => (
                <button
                  className={`template-card ${activeTemplate === template.id ? "is-active" : ""}`}
                  key={template.id}
                  type="button"
                  onClick={() => selectTemplate(template)}
                >
                  <span className="template-glow" />
                  <LayoutTemplate size={16} />
                  <span className="template-card-copy">
                    <small>{template.eyebrow}</small>
                    <strong>{template.title}</strong>
                    <span>{template.accent}</span>
                  </span>
                  {activeTemplate === template.id && <Check size={13} />}
                </button>
              ))}
            </div>
          </section>

          <section className="panel-section">
            <div className="section-heading">
              <div>
                <span className="section-kicker">QUICK PHRASES</span>
                <h2>甯哥敤璇嶈涓庣煭璇?/h2>
              </div>
              <button className="text-button" type="button" onClick={() => openDrawer("phrases")}>
                绠＄悊
              </button>
            </div>
            <div className="phrase-cloud">
              {allPhrases.slice(0, 12).map((phrase) => (
                <button className="phrase-chip" key={phrase.id} type="button" onClick={() => insertPhrase(phrase.content)}>
                  <Plus size={11} />
                  {phrase.name}
                </button>
              ))}
            </div>
          </section>

          <section className="panel-section library-links">
            <button className="settings-link" type="button" onClick={() => openDrawer("history")}>
              <History size={14} /> 鍘嗗彶璁板綍锛堟渶澶?100 鏉★級
            </button>
            <button className="settings-link" type="button" onClick={() => openDrawer("favorites")}>
              <Bookmark size={14} /> 鏀惰棌涓庡娉?            </button>
            <button className="settings-link" type="button" onClick={() => openDrawer("submissions")}>
              <Send size={14} /> 鎻愪氦璁板綍
            </button>
            <button className="settings-link" type="button" onClick={() => openDrawer("settings")}>
              <Settings2 size={14} /> 鏈嶅姟閰嶇疆
            </button>
          </section>
        </aside>

        <section className="creation-panel panel-scroll">
          <div className="creation-inner">
            <header className="creation-header">
              <div>
                <span className="section-kicker">PROMPT WORKBENCH</span>
                <h1>鎶婄伒鎰熸暣鐞嗘垚鍙鐢ㄧ殑鐢婚潰璇█</h1>
                <p>缁撴瀯鍖栧～鍐欍€佽嚜鍔ㄧ炕璇戜笌鍙傛暟鏍￠獙锛岃姣忔鐢熸垚閮芥湁杩瑰彲寰€?/p>
              </div>
            </header>

            <section className="idea-card">
              <div className="idea-card-top">
                <label htmlFor="idea">
                  <Sparkles size={14} /> 鍒涙剰鎻忚堪
                </label>
                <div className="mode-switch" role="group" aria-label="鐢熸垚妯″紡">
                  <button className={mode === "rule" ? "is-active" : ""} type="button" onClick={() => setMode("rule")}>
                    瑙勫垯
                  </button>
                  <button className={mode === "ai" ? "is-active" : ""} type="button" onClick={() => setMode("ai")}>
                    AI
                  </button>
                </div>
              </div>
              <textarea
                id="idea"
                value={idea}
                onChange={(event) => setIdea(event.target.value)}
                onKeyDown={handleIdeaKeyDown}
                placeholder="渚嬪锛氫簯娴蜂笂鏂圭殑鏈潵缇庢湳棣嗭紝瀹侀潤鑰屽．闃斺€︹€?"
              />
              <div className="idea-footer">
                <span><kbd>Ctrl</kbd> + <kbd>Enter</kbd> 快速生成</span>
                <button className="generate-button" type="button" disabled={generating} onClick={() => void handleGenerate()}>
                  {generating ? <LoaderCircle className="spin" size={14} /> : mode === "ai" ? <Zap size={14} /> : <WandSparkles size={14} />}
                  {generating ? "姝ｅ湪鐢熸垚" : mode === "ai" ? "AI 鐢熸垚" : "鐢熸垚 Prompt"}
                </button>
              </div>
            </section>

            <div className="editor-heading">
              <div>
                <span className="section-kicker">STRUCTURE</span>
                <h2>结构化编辑</h2>
              </div>
              <span className="completion-meter" title={`瀹屾垚搴?${progress}%`}>
                <span style={{ width: `${progress}%` }} />
              </span>
            </div>

            <div className="field-grid">
              {FIELD_META.map((meta) => (
                <label className={`field-card ${meta.wide ? "is-wide" : ""}`} key={meta.key}>
                  <span className="field-label">
                    {meta.label}
                    <small>{meta.hint}</small>
                  </span>
                  <textarea
                    ref={(element) => {
                      textareaRefs.current[meta.key] = element;
                    }}
                    value={fields[meta.key]}
                    onChange={(event) => updateField(meta.key, event.target.value)}
                    onFocus={(event) => rememberCaret(meta.key, event.currentTarget)}
                    onSelect={(event) => rememberCaret(meta.key, event.currentTarget)}
                    placeholder={meta.hint}
                  />
                </label>
              ))}
            </div>

            <section className="result-section">
              <div className="result-heading">
                <div>
                  <span className="section-kicker">OUTPUT</span>
                  <h2>鐢熸垚缁撴灉</h2>
                </div>
                <span className="translation-status">
                  <Languages size={12} />
                  {currentDraft?.warnings.some((warning) => warning.code === "TRANSLATION_FALLBACK")
                    ? "閮ㄥ垎鍐呭淇濈暀鍘熸枃"
                    : "涓嫳鍙岃杈撳嚭"}
                </span>
              </div>

              {currentDraft?.warnings.length ? (
                <div className="inline-notice">
                  <CircleAlert size={14} />
                  <span>{currentDraft.warnings.map(warningText).join("；")}</span>
                </div>
              ) : null}

              <div className="result-grid">
                <article className="result-card">
                  <header className="result-card-head">
                    <span>涓枃鎻忚堪 <small>ZH</small></span>
                    <button type="button" disabled={!outputZh} onClick={() => void copyOutput("zh")}>
                      {copied === "zh" ? <Check size={11} /> : <Copy size={11} />} 澶嶅埗
                    </button>
                  </header>
                  <textarea value={outputZh} onChange={(event) => setOutputZh(event.target.value)} placeholder="生成后显示中文描述" />
                </article>
                <article className="result-card is-primary">
                  <header className="result-card-head">
                    <span>English Prompt <small>MJ</small></span>
                    <button type="button" disabled={!outputEn} onClick={() => void copyOutput("en")}>
                      {copied === "en" ? <Check size={11} /> : <Copy size={11} />} 澶嶅埗
                    </button>
                  </header>
                  <textarea value={outputEn} onChange={(event) => setOutputEn(event.target.value)} placeholder="Generated English prompt appears here" />
                </article>
              </div>

              <div className="result-actions">
                <button className="secondary-button" type="button" disabled={!hasOutput} onClick={() => setFavoriteDialog(true)}>
                  <Heart size={14} /> 收藏并备注
                </button>
                <button className="primary-copy-button submit-midjourney-button" type="button" disabled={!hasOutput || !activeMidjourneyConfig || submitting} onClick={() => void submitToMidjourney()}>
                  {submitting ? <LoaderCircle className="spin" size={14} /> : <Send size={14} />}
                  {submitting ? "发送中..." : "发送到配置入口"}
                </button>
              </div>

              {!activeMidjourneyConfig ? (
                <button className="submission-hint" type="button" onClick={() => openDrawer("settings")}>
                  <CircleAlert size={12} /> 璇峰厛鍦ㄦ湇鍔￠厤缃腑鍚敤 Midjourney 閰嶇疆绔偣
                </button>
              ) : null}
              {submissionResult ? (
                <div className={`submission-state is-${submissionResult.status}`}>
                  <Check size={13} />
                  <span>投递状态：{submissionResult.status} / 记录 ID：{submissionResult.submissionId}</span>
                </div>
              ) : null}
            </section>
          </div>
        </section>

        <aside className="right-panel panel-scroll">
          <div className="parameter-header">
            <div>
              <span className="section-kicker">MIDJOURNEY</span>
              <h2>鐢熸垚鍙傛暟</h2>
            </div>
            <SlidersHorizontal size={16} />
          </div>

          <div className="parameter-group">
            <label className="select-field">
              <span className="field-label">妯″瀷鐗堟湰</span>
              <span>
                <select
                  value={parameters.model}
                  onChange={(event) =>
                    setParameters((current) => ({
                      ...current,
                      model: event.target.value as PromptParameters["model"],
                      ...(event.target.value === "8.1" ? { quality: undefined } : {}),
                    }))
                  }
                >
                  {MIDJOURNEY_MODELS.map((model) => <option key={model} value={model}>{model}</option>)}
                </select>
              </span>
            </label>

            <div className="aspect-control">
              <span className="field-label">鐢婚潰姣斾緥</span>
              <div className="aspect-presets">
                {["1:1", "4:5", "3:2", "16:9"].map((ratio) => (
                  <button
                    className={parameters.aspectRatio === ratio ? "is-active" : ""}
                    key={ratio}
                    type="button"
                    onClick={() => setParameters((current) => ({ ...current, aspectRatio: ratio }))}
                  >
                    <span className={`aspect-shape aspect-${ratio.replace(":", "-")}`} />
                    {ratio}
                  </button>
                ))}
              </div>
              <input
                aria-label="鑷畾涔夌敾闈㈡瘮渚?"
                value={parameters.aspectRatio ?? ""}
                onChange={(event) => setParameters((current) => ({ ...current, aspectRatio: event.target.value }))}
                placeholder="渚嬪 21:9"
              />
            </div>
          </div>

          <div className="parameter-group range-group">
            <label className="range-field">
              <span><span className="field-label">Stylize</span><output>{parameters.stylize ?? 0}</output></span>
              <input
                type="range"
                min={0}
                max={1000}
                value={parameters.stylize ?? 0}
                style={rangeStyle(parameters.stylize ?? 0, 1000)}
                onChange={(event) => setParameters((current) => ({ ...current, stylize: Number(event.target.value) }))}
              />
              <small>椋庢牸鍖栧己搴?0鈥?000</small>
            </label>
            <label className="range-field">
              <span><span className="field-label">Chaos</span><output>{parameters.chaos ?? 0}</output></span>
              <input
                type="range"
                min={0}
                max={100}
                value={parameters.chaos ?? 0}
                style={rangeStyle(parameters.chaos ?? 0, 100)}
                onChange={(event) => setParameters((current) => ({ ...current, chaos: Number(event.target.value) }))}
              />
              <small>缁撴灉鍙樺寲绋嬪害 0鈥?00</small>
            </label>
            <label className="range-field">
              <span><span className="field-label">Weird</span><output>{parameters.weird ?? 0}</output></span>
              <input
                type="range"
                min={0}
                max={3000}
                step={10}
                value={parameters.weird ?? 0}
                style={rangeStyle(parameters.weird ?? 0, 3000)}
                onChange={(event) => setParameters((current) => ({ ...current, weird: Number(event.target.value) }))}
              />
              <small>瀹為獙鎬у己搴?0鈥?000</small>
            </label>
          </div>

          <div className="parameter-group compact-grid">
            <label className="text-field">
              <span className="field-label">Quality</span>
              <input
                type="number"
                step="0.25"
                disabled={parameters.model === "8.1"}
                value={parameters.quality ?? ""}
                onChange={(event) =>
                  setParameters((current) => ({
                    ...current,
                    quality: event.target.value ? Number(event.target.value) : undefined,
                  }))
                }
              />
            </label>
            <label className="text-field">
              <span className="field-label">Seed</span>
              <input
                type="number"
                min={0}
                max={4294967295}
                value={parameters.seed ?? ""}
                onChange={(event) =>
                  setParameters((current) => ({
                    ...current,
                    seed: event.target.value ? Number(event.target.value) : undefined,
                  }))
                }
                placeholder="闅忔満"
              />
            </label>
          </div>

          <div className="parameter-group">
            <label className="toggle-row">
              <span><strong>Raw</strong><small>鍑忓皯榛樿椋庢牸骞查</small></span>
              <input type="checkbox" checked={parameters.raw ?? false} onChange={(event) => setParameters((current) => ({ ...current, raw: event.target.checked }))} />
            </label>
            <label className="toggle-row">
              <span><strong>Tile</strong><small>鐢熸垚鏃犵紳骞抽摵绾圭悊</small></span>
              <input type="checkbox" checked={parameters.tile ?? false} onChange={(event) => setParameters((current) => ({ ...current, tile: event.target.checked }))} />
            </label>
          </div>

          <div className="parameter-group">
            <label className="text-field">
              <span className="field-label">No / 棰濆鎺掗櫎</span>
              <textarea
                value={(parameters.no ?? []).join(", ")}
                onChange={(event) =>
                  setParameters((current) => ({
                    ...current,
                    no: event.target.value.split(/[,锛宂/).map((item) => item.trim()).filter(Boolean),
                  }))
                }
                placeholder="text, watermark, blurry"
              />
            </label>
          </div>

          <div className="parameter-preview">
            <span>鍙傛暟棰勮</span>
            <code>{parameterString || "灏氭湭璁剧疆鍙傛暟"}</code>
          </div>
          {parameterValidation.warnings.length ? (
            <div className="parameter-warnings">
              {parameterValidation.warnings.map((warning) => (
                <p className={warning.severity === "error" ? "is-error" : ""} key={`${warning.code}-${warning.field ?? ""}`}>
                  <CircleAlert size={11} /> {warning.message}
                </p>
              ))}
            </div>
          ) : null}
        </aside>
      </div>

      {drawerOpen ? (
        <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setDrawerOpen(false);
        }}>
          <aside className="library-drawer" role="dialog" aria-modal="true" aria-label="涓汉绱犳潗涓庢湇鍔￠厤缃?">
            <header className="drawer-header">
              <div>
                <span className="section-kicker">PERSONAL LIBRARY</span>
                <h2>涓汉鍒涗綔璧勬枡搴?/h2>
              </div>
              <button className="icon-button" type="button" aria-label="鍏抽棴" onClick={() => setDrawerOpen(false)}>
                <X size={16} />
              </button>
            </header>
            <nav className="drawer-tabs drawer-tabs-five">
              <button className={drawerTab === "phrases" ? "is-active" : ""} type="button" onClick={() => setDrawerTab("phrases")}><Tags size={13} /> 甯哥敤璇?/button>
              <button className={drawerTab === "history" ? "is-active" : ""} type="button" onClick={() => { setDrawerTab("history"); void loadHistory(historyPage); }}><Clock3 size={13} /> 鍘嗗彶</button>
              <button className={drawerTab === "favorites" ? "is-active" : ""} type="button" onClick={() => { setDrawerTab("favorites"); void loadFavorites(favoritePage); }}><Heart size={13} /> 鏀惰棌</button>
              <button className={drawerTab === "submissions" ? "is-active" : ""} type="button" onClick={() => { setDrawerTab("submissions"); void loadSubmissions(submissionPage); }}><Send size={13} /> 鎻愪氦</button>
              <button className={drawerTab === "settings" ? "is-active" : ""} type="button" onClick={() => { setDrawerTab("settings"); void loadConfigs(); }}><Settings2 size={13} /> 璁剧疆</button>
            </nav>
            <div className="drawer-content">
              {connection === "guest" ? (
                <div className="inline-notice">
                  <CircleAlert size={14} />
                  <span>鐧诲綍鍚庡嵆鍙法璁惧淇濆瓨甯哥敤璇嶃€佸巻鍙层€佹敹钘忓拰鏈嶅姟閰嶇疆銆?/span>
                  <Link href="/signin">鍘荤櫥褰?/Link>
                </div>
              ) : null}
              {drawerTab === "phrases" ? (
                <PhraseManager
                  categories={categories}
                  editor={phraseEditor}
                  loading={phrasesLoading}
                  phraseCategory={phraseCategory}
                  phraseSearch={phraseSearch}
                  phrases={visiblePhrases}
                  saving={phraseSaving}
                  onRefresh={() => void loadPhrases()}
                  onCategoryChange={setPhraseCategory}
                  onDelete={(id) => void deletePhrase(id)}
                  onEdit={setPhraseEditor}
                  onEditorChange={setPhraseEditor}
                  onInsert={insertPhrase}
                  onNew={() => setPhraseEditor(DEFAULT_PHRASE_FORM)}
                  onSearchChange={setPhraseSearch}
                  onSubmit={savePhrase}
                />
              ) : null}
              {drawerTab === "history" ? (
                <HistoryManager
                  items={historyItems}
                  loading={historyLoading}
                  page={historyPage}
                  total={historyTotal}
                  onClear={() => void clearHistory()}
                  onDelete={(id) => void deleteHistory(id)}
                  onPage={(page) => void loadHistory(page)}
                  onRestore={restoreRecord}
                />
              ) : null}
              {drawerTab === "favorites" ? (
                <FavoritesManager
                  editing={editingFavorite}
                  items={favorites}
                  loading={favoritesLoading}
                  page={favoritePage}
                  total={favoriteTotal}
                  onDelete={(id) => void deleteFavorite(id)}
                  onEdit={setEditingFavorite}
                  onEditChange={setEditingFavorite}
                  onPage={(page) => void loadFavorites(page)}
                  onRestore={restoreRecord}
                  onSubmit={updateFavoriteNote}
                />
              ) : null}
              {drawerTab === "submissions" ? (
                <SubmissionManager
                  items={submissions}
                  loading={submissionsLoading}
                  page={submissionPage}
                  total={submissionTotal}
                  onPage={(page) => void loadSubmissions(page)}
                  onRestore={(item) => {
                    setOutputZh(item.promptZh);
                    setOutputEn(item.promptEn);
                    setMode(item.source);
                    setDrawerOpen(false);
                    setMobileTab("create");
                  }}
                />
              ) : null}
              {drawerTab === "settings" ? (
                <SettingsManager
                  aiForm={aiForm}
                  aiConfigs={providerConfigs}
                  busy={configAction}
                  loading={settingsLoading}
                  midjourneyForm={midjourneyForm}
                  midjourneyConfigs={midjourneyConfigs}
                  translationForm={translationForm}
                  translationConfigs={translationConfigs}
                  onActivate={(kind, id) => void activateConfig(kind, id)}
                  onAiChange={setAiForm}
                  onAiSubmit={saveAiConfig}
                  onDelete={(kind, id) => void deleteConfig(kind, id)}
                  onMidjourneyChange={setMidjourneyForm}
                  onMidjourneySubmit={saveMidjourneyConfig}
                  onTest={(kind, id) => void testConfig(kind, id)}
                  onTranslationChange={setTranslationForm}
                  onTranslationSubmit={saveTranslationConfig}
                />
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}

      {favoriteDialog ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setFavoriteDialog(false);
        }}>
          <section className="favorite-modal" role="dialog" aria-modal="true" aria-labelledby="favorite-title">
            <span className="favorite-icon"><Heart size={19} /></span>
            <div>
              <h2 id="favorite-title">鏀惰棌杩欎釜 Prompt</h2>
              <p>鏀惰棌淇濆瓨瀹屾暣蹇収涓旀病鏈夋暟閲忎笂闄愶紝澶囨敞鏈€澶?1000 瀛椼€?/p>
            </div>
            <label>
              澶囨敞 <small>鍙€?/small>
              <textarea maxLength={1000} value={favoriteNote} onChange={(event) => setFavoriteNote(event.target.value)} placeholder="璁板綍閫傜敤鍦烘櫙銆佷慨鏀规柟鍚戞垨鐏垫劅鏉ユ簮鈥︹€? /">
              <span>{favoriteNote.length}/1000</span>
            </label>
            <div className="modal-actions">
              <button type="button" onClick={() => setFavoriteDialog(false)}>鍙栨秷</button>
              <button className="small-primary-button" type="button" disabled={favoriteSaving} onClick={() => void saveFavorite()}>
                {favoriteSaving ? <LoaderCircle className="spin" size={13} /> : <Save size={13} />} 淇濆瓨鏀惰棌
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {toast ? <div className="toast"><Check size={13} /> {toast}</div> : null}
    </main>
  );
}

function LoadingState({ label }: { label: string }) {
  return <div className="loading-state"><LoaderCircle className="spin" size={15} /> {label}</div>;
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <span>{icon}</span>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function Pagination({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / 20));
  if (pages <= 1) return null;
  return (
    <div className="pagination">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>涓婁竴椤?/button>
      <span>{page} / {pages}</span>
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>涓嬩竴椤?/button>
    </div>
  );
}

function PhraseManager({
  categories,
  editor,
  loading,
  phraseCategory,
  phraseSearch,
  phrases,
  saving,
  onCategoryChange,
  onDelete,
  onEdit,
  onEditorChange,
  onInsert,
  onNew,
  onSearchChange,
  onRefresh,
}: {
  categories: string[];
  editor: PhraseForm | null;
  loading: boolean;
  phraseCategory: string;
  phraseSearch: string;
  phrases: PhraseSnippet[];
  saving: boolean;
  onCategoryChange: (value: string) => void;
  onDelete: (id: string) => void;
  onEdit: (form: PhraseForm) => void;
  onEditorChange: (form: PhraseForm | null) => void;
  onInsert: (content: string) => void;
  onNew: () => void;
  onSearchChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRefresh: () => void;
}){
    <section className="manager-section">
      <div className="manager-heading">
        <div>
          <span className="section-kicker">PHRASES</span>
          <h3>鎴戠殑甯哥敤璇?/h3>
        </div>
        <button className="small-primary-button" type="button" onClick={onNew}><Plus size={13} /> 鏂板缓</button>
      </div>
      <div className="manager-toolbar">
        <label className="search-field">
          <Search size={13} />
          <input value={phraseSearch} onChange={(event) => onSearchChange(event.target.value)} placeholder="鎼滅储鍚嶇О銆佸垎绫绘垨鍐呭" />
        </label>
        <button className="icon-button" type="button" aria-label="鍒锋柊" onClick={() => window.location.reload()}><RefreshCw size={14} /></button>
        <button className="icon-button" type="button" aria-label="刷新" onClick={onRefresh}><RefreshCw size={14} /></button>
      <div className="category-tabs">
        {categories.map((category) => (
          <button className={category === phraseCategory ? "is-active" : ""} key={category} type="button" onClick={() => onCategoryChange(category)}>
            {category}
          </button>
        ))}
      </div>

      {editor ? (
        <form className="phrase-editor" onSubmit={onSubmit}>
          <div className="editor-form-heading">
            <strong>{editor.id ? "缂栬緫甯哥敤璇? : "鏂板缓甯哥敤璇?}</strong>
            <button type="button" aria-label="鍏抽棴缂栬緫" onClick={() => onEditorChange(null)}><X size={13} /></button>
          </div>
          <div className="form-row">
            <label>
              鍚嶇О
              <input required maxLength={80} value={editor.name} onChange={(event) => onEditorChange({ ...editor, name: event.target.value })} />
            </label>
            <label>
              鍒嗙被
              <input required maxLength={50} value={editor.category} onChange={(event) => onEditorChange({ ...editor, category: event.target.value })} />
            </label>
          </div>
          <label>
            璇嶈鎴栫煭璇?            <textarea required maxLength={500} value={editor.content} onChange={(event) => onEditorChange({ ...editor, content: event.target.value })} />
          </label>
          <label>
            鎺掑簭鍊?            <input type="number" min={-100000} max={100000} value={editor.sortOrder} onChange={(event) => onEditorChange({ ...editor, sortOrder: Number(event.target.value) })} />
          </label>
          <button className="small-primary-button" type="submit" disabled={saving}>
            {saving ? <LoaderCircle className="spin" size={13} /> : <Save size={13} />} 淇濆瓨
          </button>
        </form>
      ) : null}

      {loading ? <LoadingState label="姝ｅ湪鍔犺浇甯哥敤璇?" /> : phrases.length ? ("
        <div className="manager-card-list">
          {phrases.map((phrase) => (
            <article className="phrase-manager-card" key={phrase.id}>
              <button className="phrase-main" type="button" onClick={() => onInsert(phrase.content)}>
                <span className="category-label">{phrase.category}</span>
                <strong>{phrase.name}</strong>
                <p>{phrase.content}</p>
                <small><Plus size={10} /> 鐐瑰嚮鎻掑叆鍒板綋鍓嶅厜鏍?/small>
              </button>
              <div className="card-actions">
                <button type="button" aria-label={`缂栬緫 ${phrase.name}`} onClick={() => onEdit({ id: phrase.id, name: phrase.name, category: phrase.category, content: phrase.content, sortOrder: phrase.sortOrder })}><Pencil size={13} /></button>
                <button type="button" aria-label={`鍒犻櫎 ${phrase.name}`} onClick={() => onDelete(phrase.id)}><Trash2 size={13} /></button>
              </div>
            </article>
          ))}
        </div>
      ) : <EmptyState icon={<Tags size={20} />} title="杩樻病鏈夊父鐢ㄨ瘝" description="淇濆瓨甯哥敤鐨勯鏍笺€佺伅鍏夋垨鏋勫浘鐭锛屼箣鍚庣偣鍑诲嵆鍙彃鍏?Prompt銆? /">}

      <div className="sample-phrases">
        <span>鍐呯疆绀轰緥锛堢偣鍑荤洿鎺ユ彃鍏ワ級</span>
        <div className="phrase-cloud">
          {CURATED_PHRASES.map((phrase) => <button className="phrase-chip" key={phrase.id} type="button" onClick={() => onInsert(phrase.content)}><Plus size={11} />{phrase.name}</button>)}
        </div>
      </div>
    </section>
  );
}

function HistoryManager({
  items,
  loading,
  page,
  total,
  onClear,
  onDelete,
  onPage,
  onRestore,
}: {
  items: PromptRecord[];
  loading: boolean;
  page: number;
  total: number;
  onClear: () => void;
  onDelete: (id: string) => void;
  onPage: (page: number) => void;
  onRestore: (item: PromptRecord) => void;
}) {
  return (
    <section className="manager-section">
      <div className="manager-heading">
        <div><span className="section-kicker">HISTORY 路 {total}/100</span><h3>鐢熸垚鍘嗗彶</h3></div>
        {total > 0 ? <button className="secondary-button" type="button" onClick={onClear}><Trash2 size={12} /> 娓呯┖</button> : null}
      </div>
      {loading ? <LoadingState label="姝ｅ湪鍔犺浇鍘嗗彶璁板綍" /> : items.length ? (
        <div className="manager-card-list">
          {items.map((item) => <PromptRecordCard item={item} key={item.id} onDelete={() => onDelete(item.id)} onRestore={() => onRestore(item)} />)}
        </div>
      ) : <EmptyState icon={<History size={20} />} title="杩樻病鏈夌敓鎴愯褰?" description="姣忔瑙勫垯鎴?AI 鐢熸垚鎴愬姛鍚庨兘浼氳嚜鍔ㄤ繚瀛橈紝鐩稿悓 Prompt 浼氳嚜鍔ㄥ幓閲嶃€?" />}
      <Pagination page={page} total={total} onPage={onPage} />
    </section>
  );
}

function PromptRecordCard({
  item,
  onDelete,
  onRestore,
  noteEditor,
}: {
  item: PromptRecord;
  onDelete: () => void;
  onRestore: () => void;
  noteEditor?: React.ReactNode;
}) {
  return (
    <article className="prompt-record-card">
      <div className="record-top">
        <span className="record-source"><Sparkles size={10} /> {sourceLabel(item.source)}</span>
        <time>{formatDate(item.updatedAt ?? item.createdAt)}</time>
      </div>
      <p className="record-prompt">{item.promptEn || item.promptZh}</p>
      {noteEditor}
      <div className="record-actions">
        <button className="restore-button" type="button" onClick={onRestore}><RotateCcw size={11} /> 鎭㈠鍒扮紪杈戝櫒</button>
        <button type="button" aria-label="鍒犻櫎" onClick={onDelete}><Trash2 size={13} /></button>
      </div>
    </article>
  );
}

function FavoritesManager({
  editing,
  items,
  loading,
  page,
  total,
  onDelete,
  onEdit,
  onEditChange,
  onPage,
  onRestore,
  onSubmit,
}: {
  editing: { id: string; note: string } | null;
  items: PromptRecord[];
  loading: boolean;
  page: number;
  total: number;
  onDelete: (id: string) => void;
  onEdit: (value: { id: string; note: string } | null) => void;
  onEditChange: (value: { id: string; note: string } | null) => void;
  onPage: (page: number) => void;
  onRestore: (item: PromptRecord) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="manager-section">
      <div className="manager-heading">
        <div><span className="section-kicker">FAVORITES 路 {total}</span><h3>鏀惰棌涓庡娉?/h3></div>
        <span className="count-badge">鈭?/span>
      </div>
      {loading ? <LoadingState label="姝ｅ湪鍔犺浇鏀惰棌" /> : items.length ? (
        <div className="manager-card-list">
          {items.map((item) => (
            <PromptRecordCard
              item={item}
              key={item.id}
              onDelete={() => onDelete(item.id)}
              onRestore={() => onRestore(item)}
              noteEditor={
                editing?.id === item.id ? (
                  <form className="record-note-editor" onSubmit={onSubmit}>
                    <textarea
                      maxLength={1000}
                      value={editing.note}
                      onChange={(event) => onEditChange({ ...editing, note: event.target.value })}
                    />
                    <div>
                      <button type="button" onClick={() => onEditChange(null)}>鍙栨秷</button>
                      <button type="submit">淇濆瓨澶囨敞</button>
                    </div>
                  </form>
                ) : (
                  <button className="record-note" type="button" onClick={() => onEdit({ id: item.id, note: item.note ?? "" })}>
                    <Pencil size={10} /> {item.note || "鐐瑰嚮娣诲姞澶囨敞"}
                  </button>
                )
              }
            />
          ))}
        </div>
      ) : <EmptyState icon={<Heart size={20} />} title="杩樻病鏈夋敹钘?" description="鍦ㄧ敓鎴愮粨鏋滄梺鐐瑰嚮鈥滄敹钘忓苟澶囨敞鈥濓紝鏀惰棌鏁伴噺娌℃湁涓婇檺銆?" />}
      <Pagination page={page} total={total} onPage={onPage} />
    </section>
  );
}

function SubmissionManager({
  items,
  loading,
  page,
  total,
  onPage,
  onRestore,
}: {
  items: MidjourneySubmission[];
  loading: boolean;
  page: number;
  total: number;
  onPage: (page: number) => void;
  onRestore: (item: MidjourneySubmission) => void;
}) {
  return (
    <section className="manager-section">
      <div className="manager-heading">
        <div><span className="section-kicker">DIRECT SUBMISSIONS 路 {total}</span><h3>Midjourney 鎻愪氦璁板綍</h3></div>
        <Send size={17} />
      </div>
      <div className="inline-notice">
        <ShieldCheck size={14} />
        <span>鎻愪氦璁板綍鐙珛淇濆瓨锛屼笉鍗犵敤 100 鏉?Prompt 鍘嗗彶棰濆害銆?/span>
      </div>
      {loading ? <LoadingState label="姝ｅ湪鍔犺浇鎻愪氦璁板綍" /> : items.length ? (
        <div className="manager-card-list">
          {items.map((item) => (
            <article className="prompt-record-card" key={item.id}>
              <div className="record-top">
                <span className={`submission-badge is-${item.status}`}>
                  {item.status === "sent" ? <Check size={10} /> : item.status === "failed" ? <CircleAlert size={10} /> : <LoaderCircle size={10} />}
                  {item.status}
                </span>
                <time>{formatDate(item.updatedAt ?? item.createdAt)}</time>
              </div>
              <p className="record-prompt">{item.promptEn || item.promptZh}</p>
              {item.errorMessage ? <p className="submission-error">{item.errorMessage}</p> : null}
              <div className="record-actions">
                <button className="restore-button" type="button" onClick={() => onRestore(item)}><RotateCcw size={11} /> 鎭㈠杈撳嚭</button>
                <span className="record-source">{sourceLabel(item.source)}</span>
              </div>
            </article>
          ))}
        </div>
      ) : <EmptyState icon={<Send size={20} />} title="杩樻病鏈夋彁浜よ褰?" description="閰嶇疆骞跺惎鐢?Discord Webhook 鎴栬嚜瀹氫箟 HTTP 绔偣鍚庯紝鍗冲彲浠庣粨鏋滃尯鐩存帴鎻愪氦銆?" />}
      <Pagination page={page} total={total} onPage={onPage} />
    </section>
  );
}

type ConfigKind = "ai" | "translation" | "midjourney";

function ConfigList({
  configs,
  kind,
  busy,
  onActivate,
  onDelete,
  onTest,
}: {
  configs: PublicConfig[];
  kind: ConfigKind;
  busy: string | null;
  onActivate: (kind: ConfigKind, id: string) => void;
  onDelete: (kind: ConfigKind, id: string) => void;
  onTest: (kind: ConfigKind, id: string) => void;
}) {
  if (!configs.length) return <p className="config-empty">灏氭湭淇濆瓨閰嶇疆</p>;
  return (
    <div className="service-config-list">
      {configs.map((config) => (
        <article key={config.id}>
          <span className={config.isActive ? "is-active" : ""}>{config.isActive ? <Check size={12} /> : <KeyRound size={12} />}</span>
          <div>
            <strong>{config.label}{config.isActive ? "（当前启用）" : ""}</strong>
            <small>{config.provider}{config.model ? ` 路 ${config.model}` : ""} 路 {config.apiKeyMasked || "鏃犻渶瀵嗛挜"}</small>
          </div>
          <div>
            {!config.isActive ? (
              <button type="button" disabled={Boolean(busy)} onClick={() => onActivate(kind, config.id)} title="鍚敤">鍚敤</button>
            ) : null}
            <button type="button" disabled={Boolean(busy)} onClick={() => onTest(kind, config.id)} title={kind === "midjourney" ? "测试配置入口" : "测试连接"}>
              {busy === `test-${config.id}` ? <LoaderCircle className="spin" size={12} /> : <RefreshCw size={12} />}
            </button>
            <button type="button" disabled={Boolean(busy)} onClick={() => onDelete(kind, config.id)} title="鍒犻櫎">
              {busy === `delete-${config.id}` ? <LoaderCircle className="spin" size={12} /> : <Trash2 size={12} />}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function SettingsManager({
  aiForm,
  aiConfigs,
  busy,
  loading,
  midjourneyForm,
  midjourneyConfigs,
  translationForm,
  translationConfigs,
  onActivate,
  onAiChange,
  onAiSubmit,
  onDelete,
  onMidjourneyChange,
  onMidjourneySubmit,
  onTest,
  onTranslationChange,
  onTranslationSubmit,
}: {
  aiForm: AiConfigForm;
  aiConfigs: PublicConfig[];
  busy: string | null;
  loading: boolean;
  midjourneyForm: MidjourneyConfigForm;
  midjourneyConfigs: PublicConfig[];
  translationForm: TranslationConfigForm;
  translationConfigs: PublicConfig[];
  onActivate: (kind: ConfigKind, id: string) => void;
  onAiChange: (form: AiConfigForm) => void;
  onAiSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: (kind: ConfigKind, id: string) => void;
  onMidjourneyChange: (form: MidjourneyConfigForm) => void;
  onMidjourneySubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTest: (kind: ConfigKind, id: string) => void;
  onTranslationChange: (form: TranslationConfigForm) => void;
  onTranslationSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const listProps = { busy, onActivate, onDelete, onTest };
  return (
    <section className="manager-section settings-section">
      <div className="settings-intro">
        <span><ShieldCheck size={17} /></span>
        <div>
          <h3>鏈嶅姟涓庡瘑閽?/h3>
          <p>瀵嗛挜鐢辨湇鍔″櫒浣跨敤 AES-256-GCM 鍔犲瘑淇濆瓨锛屾祻瑙堝櫒鍙細鐪嬪埌鑴辨晱缁撴灉銆傚垹闄ゅ悗鏃犳硶鎭㈠銆?/p>
        </div>
      </div>
      {loading ? <LoadingState label="姝ｅ湪鍔犺浇鏈嶅姟閰嶇疆" /> : null}

      <form className="settings-card" onSubmit={onMidjourneySubmit}>
        <div className="settings-card-heading">
          <span><Send size={15} /></span>
          <div><strong>Midjourney 鐩存帴鎻愪氦</strong><small>Discord Webhook 鎴栬嚜瀹氫箟 HTTP</small></div>
        </div>
        <ConfigList configs={midjourneyConfigs} kind="midjourney" {...listProps} />
        <div className="form-row">
          <label>
            閰嶇疆鍚嶇О
            <input required maxLength={80} value={midjourneyForm.label} onChange={(event) => onMidjourneyChange({ ...midjourneyForm, label: event.target.value })} />
          </label>
          <label>
            绫诲瀷
            <select value={midjourneyForm.provider} onChange={(event) => onMidjourneyChange({ ...midjourneyForm, provider: event.target.value as MidjourneyConfigForm["provider"] })}>
              <option value="discord_webhook">Discord Webhook</option>
              <option value="custom_http">鑷畾涔?HTTP</option>
            </select>
          </label>
        </div>
        <label>
          Endpoint
          <input required type="url" value={midjourneyForm.endpoint} onChange={(event) => onMidjourneyChange({ ...midjourneyForm, endpoint: event.target.value })} placeholder={midjourneyForm.provider === "discord_webhook" ? "https://discord.com/api/webhooks/..." : "https://example.com/api/midjourney"} />
        </label>
        <label>
          API Key <small>鍙€?/small>
          <input type="password" autoComplete="new-password" value={midjourneyForm.apiKey} onChange={(event) => onMidjourneyChange({ ...midjourneyForm, apiKey: event.target.value })} />
        </label>
        <label className="config-active-check">
          <input type="checkbox" checked={midjourneyForm.isActive} onChange={(event) => onMidjourneyChange({ ...midjourneyForm, isActive: event.target.checked })} />
          淇濆瓨鍚庣珛鍗冲惎鐢?        </label>
        <div className="settings-footer">
          <span><CircleAlert size={12} />鈥滄祴璇曗€濅細鐪熷疄鍙戦€佷竴鏉℃祴璇曟秷鎭€?/span>
          <button className="small-primary-button" type="submit" disabled={Boolean(busy)}>
            {busy === "save-midjourney" ? <LoaderCircle className="spin" size={13} /> : <Save size={13} />} 淇濆瓨鎻愪氦閰嶇疆
          </button>
        </div>
      </form>

      <form className="settings-card" onSubmit={onAiSubmit}>
        <div className="settings-card-heading">
          <span><Sparkles size={15} /></span>
          <div><strong>AI 妯″瀷</strong><small>鐢ㄤ簬缁撴瀯鍖?AI 鐢熸垚</small></div>
        </div>
        <ConfigList configs={aiConfigs} kind="ai" {...listProps} />
        <div className="form-row">
          <label>
            閰嶇疆鍚嶇О
            <input required value={aiForm.label} onChange={(event) => onAiChange({ ...aiForm, label: event.target.value })} />
          </label>
          <label>
            渚涘簲鍟?            <select value={aiForm.provider} onChange={(event) => onAiChange({ ...aiForm, provider: event.target.value })}>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Claude</option>
              <option value="gemini">Gemini</option>
              <option value="deepseek">DeepSeek</option>
              <option value="qwen">閫氫箟鍗冮棶</option>
              <option value="doubao">璞嗗寘</option>
              <option value="zhipu">鏅鸿氨</option>
              <option value="kimi">Kimi</option>
              <option value="minimax">MiniMax</option>
              <option value="custom">OpenAI 鍏煎</option>
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>
            妯″瀷鍚?            <input required value={aiForm.model} onChange={(event) => onAiChange({ ...aiForm, model: event.target.value })} />
          </label>
          <label>
            Endpoint <small>棰勮渚涘簲鍟嗗彲鐣欑┖</small>
            <input type="url" value={aiForm.endpoint} onChange={(event) => onAiChange({ ...aiForm, endpoint: event.target.value })} />
          </label>
        </div>
        <label>
          API Key
          <input required type="password" autoComplete="new-password" value={aiForm.apiKey} onChange={(event) => onAiChange({ ...aiForm, apiKey: event.target.value })} />
        </label>
        <div className="settings-footer">
          <span><ShieldCheck size={12} />瀵嗛挜涓嶄細杩斿洖鍒板墠绔€?/span>
          <button className="small-primary-button" type="submit" disabled={Boolean(busy)}>
            {busy === "save-ai" ? <LoaderCircle className="spin" size={13} /> : <Save size={13} />} 淇濆瓨 AI 閰嶇疆
          </button>
        </div>
      </form>

      <form className="settings-card" onSubmit={onTranslationSubmit}>
        <div className="settings-card-heading">
          <span><Languages size={15} /></span>
          <div><strong>缈昏瘧鏈嶅姟</strong><small>涓枃鑷敱鏂囨湰鑷姩杞嫳鏂?/small></div>
        </div>
        <ConfigList configs={translationConfigs} kind="translation" {...listProps} />
        <div className="form-row">
          <label>
            閰嶇疆鍚嶇О
            <input required value={translationForm.label} onChange={(event) => onTranslationChange({ ...translationForm, label: event.target.value })} />
          </label>
          <label>
            渚涘簲鍟?            <select value={translationForm.provider} onChange={(event) => onTranslationChange({ ...translationForm, provider: event.target.value })}>
              <option value="libretranslate">LibreTranslate</option>
              <option value="deepl">DeepL</option>
              <option value="google">Google</option>
            </select>
          </label>
        </div>
        <label>
          Endpoint <small>浣跨敤榛樿鍦板潃鍙暀绌?/small>
          <input type="url" value={translationForm.endpoint} onChange={(event) => onTranslationChange({ ...translationForm, endpoint: event.target.value })} />
        </label>
        <label>
          API Key <small>LibreTranslate 鍙€?/small>
          <input type="password" autoComplete="new-password" value={translationForm.apiKey} onChange={(event) => onTranslationChange({ ...translationForm, apiKey: event.target.value })} />
        </label>
        <div className="settings-footer">
          <span><Languages size={12} />澶辫触鏃朵細淇濈暀鍘熸枃骞舵樉绀鸿鍛娿€?/span>
          <button className="small-primary-button" type="submit" disabled={Boolean(busy)}>
            {busy === "save-translation" ? <LoaderCircle className="spin" size={13} /> : <Save size={13} />} 淇濆瓨缈昏瘧閰嶇疆
          </button>
        </div>
      </form>
    </section>
  );
}
*/
