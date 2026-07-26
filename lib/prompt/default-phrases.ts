import type { PromptBlockField } from "./types";
import { SECTION12_PHRASES } from "./default-phrases-section12";

export interface DefaultPhrase {
  id: string;
  name: string;
  category: string;
  content: string;
  targetField: PromptBlockField;
  sortOrder: number;
  sourceSection: string;
}

type PhraseTuple = readonly [name: string, content: string];

function section(
  sourceSection: string,
  category: string,
  targetField: PromptBlockField,
  entries: readonly PhraseTuple[],
): DefaultPhrase[] {
  return entries.map(([name, content], index) => ({
    id: `default-${sourceSection.replace(".", "-")}-${targetField}-${index + 1}`,
    name,
    category,
    content,
    targetField,
    sortOrder: index,
    sourceSection,
  }));
}

const environment = section("3.2", "环境与背景", "environment", [
  ["教室", "classroom"], ["卧室", "bedroom"], ["实验室", "laboratory"],
  ["室内设计空间", "interior design"], ["城市", "city"],
  ["废弃城市建筑", "deserted city buildings"], ["近未来城市", "near future city"],
  ["赛博朋克城市", "cyberpunk city"], ["森林", "forest"], ["山脉", "mountain"],
  ["河流", "river"], ["湖泊", "lake"], ["瀑布", "waterfall"], ["冰川", "glacier"],
  ["热带雨林", "rainforest"], ["沙漠", "desert"], ["峡谷", "canyon"],
  ["洞穴", "cave"], ["草原", "grassland"], ["沙丘", "dune"], ["沼泽", "marshland"],
  ["熔岩洞穴", "lava cave"], ["魔法花园", "enchanted garden"],
  ["魔法城堡", "magical castle"], ["梦境世界", "dreamland"], ["幽灵镇", "ghost town"],
  ["外星球", "alien planet"], ["赛博空间", "cyberspace"], ["水下世界", "underwater world"],
  ["未来大都会", "futuristic metropolis"], ["超现实景观", "surreal landscape"],
  ["月球地貌", "lunar landscape"], ["末日废土", "post-apocalyptic wasteland"],
] as const);

const lighting = section("3.3", "灯光", "lighting", [
  ["电影光", "cinematic light"], ["强逆光", "intense backlight"],
  ["体积光", "volumetric lighting"], ["闪烁光线", "shimmering light"],
  ["影棚光", "studio light"], ["双侧照明", "split lighting"],
  ["柔和光", "soft illumination"], ["投影效果", "projection effect"],
  ["阴影效果", "shadow effect"], ["发光效果", "glow effect"],
  ["荧光灯", "fluorescent lighting"], ["浪漫烛光", "romantic candlelight"],
  ["戏剧性对比", "dramatic contrast"], ["硬质高对比", "harsh contrast"],
  ["轮廓光", "rim lighting"], ["边缘光", "edge light"], ["顶光", "top light"],
  ["反射光", "reflection light"], ["赛博朋克光", "cyberpunk light"],
  ["黄金时段光", "golden hour light"], ["情绪照明", "mood lighting"],
  ["全局照明", "global illumination"],
] as const);

const style = section("3.4", "风格", "style", [
  ["写实", "realistic"], ["照片级写实", "photorealistic"], ["超写实", "hyperrealism"],
  ["电影感", "cinematic"], ["国家地理摄影", "National Geographic photography"],
  ["三维风格", "3D"], ["皮克斯风格", "Pixar-style"], ["迪士尼风格", "Disney-style"],
  ["梦工厂风格", "DreamWorks animation style"], ["三维渲染", "3D rendering"],
  ["动漫", "anime"], ["漫画", "manga"], ["Q版", "chibi"],
  ["儿童插画", "children's illustration"], ["图库插画", "stock illustration"],
  ["油画", "oil painting"], ["水彩", "watercolor"], ["水墨插画", "ink illustration"],
  ["水粉", "gouache"], ["粉彩", "pastel"], ["手绘", "hand-drawn"],
  ["包豪斯", "Bauhaus"], ["新艺术", "Art Nouveau"], ["波普艺术", "pop art"],
  ["概念艺术", "concept art"], ["海报设计", "poster design"],
  ["中国水墨画", "Chinese ink painting"], ["新中式", "New Chinese Style"],
  ["浮世绘", "Ukiyo-e"], ["日本漫画风格", "Japanese manga style"],
  ["电影剧照", "film still"], ["电影海报", "movie poster"],
  ["好莱坞风格", "Hollywood-style"], ["黑色电影", "film noir"],
  ["电影摄影", "cinematography"], ["魔幻现实主义", "magic realism"],
  ["超现实主义", "surrealism"], ["赛博朋克", "cyberpunk"],
  ["暗黑奇幻", "dark fantasy"], ["达芬奇风格", "in the style of Leonardo da Vinci"],
  ["梵高风格", "in the style of Vincent van Gogh"],
  ["宫崎骏动画风格", "Miyazaki-inspired animation style"],
  ["新海诚动画风格", "Makoto Shinkai-inspired animation style"],
] as const);

const composition = section("3.5", "构图", "composition", [
  ["三分法", "rule of thirds"], ["黄金分割", "golden ratio"],
  ["对称构图", "symmetrical composition"], ["非对称构图", "asymmetrical composition"],
  ["引导线", "leading lines"], ["负空间", "negative space"],
  ["孤立主体构图", "isolation composition"], ["框景构图", "framing composition"],
  ["对角线构图", "diagonal composition"], ["S形构图", "S-shaped composition"],
  ["中心构图", "centered composition"], ["动态对称", "dynamic symmetry composition"],
  ["汇聚线", "converging lines composition"], ["消失点", "vanishing point composition"],
  ["拼贴构图", "collage composition"], ["重叠构图", "overlapping composition"],
  ["饱和构图", "saturated composition"],
] as const);

const camera = section("3.6", "视角与镜头", "camera", [
  ["全景视角", "panoramic view"], ["俯视", "overhead view"], ["鸟瞰", "bird's-eye view"],
  ["航拍", "aerial view"], ["低角度仰拍", "low angle shot"], ["仰视", "upward view"],
  ["平视", "eye-level"], ["荷兰角", "Dutch angle"], ["第一人称视角", "first-person view"],
  ["广角", "wide view"], ["超广角", "ultra-wide shot"], ["近景", "close-up"],
  ["极端特写", "extreme close-up"], ["微距", "macro shot"], ["中景", "medium shot"],
  ["远景", "long shot"], ["半身像", "bust shot"], ["胸部景别", "chest shot"],
  ["全身", "full-body shot"], ["侧面", "profile view"], ["侧视", "side view"],
  ["过肩视角", "over-the-shoulder shot"], ["鱼眼镜头", "fisheye lens"],
  ["透视视角", "perspective"], ["浅景深", "shallow depth of field"],
  ["背景虚化", "bokeh"],
] as const);

const mood = section("3.7", "情绪", "mood", [
  ["平静", "calm"], ["满足", "satisfaction"], ["尴尬", "embarrassment"],
  ["感激", "gratitude"], ["遗憾", "regret"], ["紧张", "tension"], ["孤独", "loneliness"],
  ["焦虑", "anxious"], ["担忧", "worried"], ["厌恶", "disgusted"], ["惊讶", "surprised"],
  ["充满希望", "hopeful"], ["心烦", "upset"], ["憎恨", "hateful"], ["情绪化", "moody"],
  ["黑暗", "dark"], ["残酷", "brutal"], ["戏剧性对比", "dramatic contrast"],
  ["安宁", "peaceful"], ["静谧", "quiet"], ["神秘", "mysterious"], ["敬畏感", "sense of awe"],
  ["温馨舒适", "coziness"], ["冒险感", "adventure"], ["悲伤", "sadness"],
  ["兴奋", "excitement"],
] as const);

const color = section("3.8", "色彩", "color", [
  ["薄荷绿", "mint green"], ["日落渐变", "sunset gradient"], ["枫叶红", "maple red"],
  ["山峦蓝", "mountain blue"], ["马卡龙色", "macaron colors"], ["低饱和色调", "muted tones"],
  ["钛金属色", "titanium tones"], ["鲜果色", "fresh fruit colors"], ["黑白", "black and white"],
  ["极简黑白", "minimalist black and white"], ["暖棕色", "warm brown"],
  ["柔粉色", "soft pink"], ["时尚灰", "fashionable gray"], ["水晶蓝", "crystal blue"],
  ["珊瑚色", "coral"], ["薰衣草紫", "lavender"], ["祖母绿", "emerald"],
  ["玫瑰金", "rose gold"], ["天空蓝", "sky blue"], ["酒红", "burgundy"],
  ["绿松石色", "turquoise"], ["亮橙色", "bright orange"], ["象牙白", "ivory white"],
  ["自然绿", "natural green"], ["奢华金", "luxurious gold"], ["沉稳蓝", "steady blue"],
  ["经典红黑白", "classic red, black and white"], ["紫罗兰", "violet purple"],
  ["柠檬黄", "lemon yellow"], ["霓虹色调", "neon shades"], ["金银色调", "gold and silver tones"],
] as const);

const material = section("3.9", "材质", "material", [
  ["哑光", "matte"], ["珍珠", "pearl"], ["丝绸", "silk"], ["毛绒", "fluffy texture"],
  ["水波纹", "water wave texture"], ["石墨", "graphite"], ["竹材", "bamboo"],
  ["金属", "metallic"], ["石材", "stone"], ["玻璃", "glass"], ["皮革", "leather"],
  ["棉质", "cotton"], ["水晶", "crystal"], ["塑料", "plastic"], ["沙质", "sandy texture"],
  ["陶瓷", "ceramic"], ["砖石", "brick"], ["油漆质感", "paint texture"],
  ["纱网", "gauze"], ["粘土", "clay"], ["木材", "wood"], ["瓷器", "porcelain"],
  ["珐琅", "enamel"],
] as const);

const detail = section("3.9", "细节与精度", "custom", [
  ["光洁细节", "polished"], ["细微细节", "subtle"], ["纤细", "slender"], ["精巧复杂", "intricate"],
  ["柔和", "gentle"], ["优雅", "elegant"], ["精致", "delicate"], ["华美精细", "exquisite"],
  ["轮廓清晰", "well-defined"], ["纹理丰富", "textured"], ["层次丰富", "layered"],
  ["有机纹样", "organic pattern"], ["浮雕", "embossed"], ["雕刻", "carved"],
  ["史诗级细节", "epic detail"], ["光滑", "smooth"], ["清晰", "clear"], ["精细", "fine"],
  ["精准", "precise"], ["流畅", "sleek"], ["流线型", "streamlined"], ["粗糙", "rough"],
  ["不规则", "irregular"], ["厚重", "bulky"], ["锐利", "sharp"], ["多棱角", "angular"],
  ["动态细节", "dynamic"], ["多样化", "varied"], ["统一细节", "uniform"],
  ["高细节", "high detail"], ["高品质", "hyper quality"], ["高分辨率", "high resolution"],
  ["4K/8K", "4K, 8K"], ["超高清", "ultra HD"], ["超清晰", "super clarity"],
  ["超写实精度", "ultra-realistic"], ["超详细", "super detailed"],
  ["复杂细节", "intricate details"], ["最佳画质", "best picture quality"],
  ["真实感", "sense of reality"],
] as const);

const rendering = section("3.10", "渲染与3D", "medium", [
  ["虚幻引擎", "Unreal Engine"], ["虚幻引擎5", "Unreal Engine 5"],
  ["Octane渲染", "Octane render"], ["Cinema 4D", "Cinema 4D"],
  ["Corona渲染", "Corona Render"], ["V-Ray渲染", "V-Ray"],
  ["Quixel扫描材质", "Quixel Megascans"], ["三维渲染", "3D rendering"],
  ["物理渲染", "physically based rendering (PBR)"], ["环境光遮蔽", "ambient occlusion"],
  ["景深", "depth of field (DOF)"], ["抗锯齿", "anti-aliasing"],
  ["体积渲染", "volume rendering"], ["光线追踪", "ray tracing"],
  ["光线投射", "ray casting"], ["蒙特卡洛渲染", "Monte Carlo rendering"],
  ["纹理映射", "texture mapping"], ["环境映射", "environment mapping"],
  ["着色器", "shader"], ["Arnold渲染器", "Arnold Renderer"],
  ["Redshift渲染器", "Redshift Renderer"], ["Blender渲染器", "Blender Renderer"],
] as const);

const combined = [
  ...environment,
  ...lighting,
  ...style,
  ...composition,
  ...camera,
  ...mood,
  ...color,
  ...material,
  ...detail,
  ...rendering,
  ...SECTION12_PHRASES,
];

const seen = new Set<string>();
export const DEFAULT_PHRASES = Object.freeze(
  combined.filter((item) => {
    const key = item.content.trim().toLocaleLowerCase("en-US");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }),
);

export const DEFAULT_PHRASE_CATEGORIES = Object.freeze(
  [...new Set(DEFAULT_PHRASES.map((item) => item.category))],
);
