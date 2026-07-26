"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  Check,
  ChevronRight,
  CircleAlert,
  Copy,
  Download,
  ExternalLink,
  FolderPlus,
  Heart,
  History,
  Library,
  Laptop,
  LoaderCircle,
  Menu,
  Plus,
  RefreshCw,
  Save,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {
  providersForKind,
  serviceConfigHelp,
  type ServiceConfigKind,
  type ServiceConfigHelp,
} from "@/lib/service-config-help";
import {
  blocksToFields,
  composePromptBodies,
  createPromptBlock,
  movePromptBlock,
  negativeValues,
  normalizeBlockOrder,
  orderedBlocks,
  parametersWithNegativeBlocks,
  PROMPT_FIELD_LABELS,
  reconcileNegativeBlocks,
  stripNegativeParameter,
} from "@/lib/prompt/blocks";
import {
  extractParametersFromPrompt,
  filterUnsupportedParameters,
} from "@/lib/prompt/parameters";
import {
  composePromptWithReferences,
  EMPTY_PROMPT_REFERENCES,
  extractReferencesFromPrompt,
  validatePromptConfiguration,
} from "@/lib/prompt/references";
import {
  DEFAULT_PHRASES,
  DEFAULT_PHRASE_CATEGORIES,
  type DefaultPhrase,
} from "@/lib/prompt/default-phrases";
import { PROMPT_TEMPLATES, type PromptTemplate } from "@/lib/prompt/templates";
import {
  PromptSnapshotSchema,
  PromptSnapshotV4Schema,
  type PromptBlock,
  type PromptDraft,
  type PromptParameters,
  type PromptReferences,
  type PromptSnapshot,
  type PromptSource,
  type PromptVariant,
  type PromptVariantKind,
  type PromptWarning,
  type TargetSurface,
  type TaskType,
} from "@/lib/prompt/types";
import {
  appendPromptTokenBlocks,
  splitPromptTokenInput,
  unlockPromptBlockEnglish,
  updatePromptBlockText,
} from "@/lib/prompt/token-editor";
import {
  BilingualTokenEditor,
  type BlockTranslationStatus,
} from "./workbench/BilingualTokenEditor";
import { BlockEditor } from "./workbench/BlockEditor";
import { ControlHelp } from "./workbench/ControlHelp";
import { ParameterPanel } from "./workbench/ParameterPanel";
import { ReferencePanel } from "./workbench/ReferencePanel";

type DrawerTab = "phrases" | "history" | "library" | "submissions" | "settings";
type MobileTab = "materials" | "create" | "parameters";

type PhraseSnippet = {
  id: string;
  name: string;
  category: string;
  content: string;
  sortOrder: number;
};
type PhraseLibraryItem = {
  id: string;
  name: string;
  category: string;
  content: string;
  targetField: PromptBlock["field"];
  textZh: string;
  textEn: string;
  source: "default" | "personal";
};
type ActiveDragItem =
  | { type: "phrase"; phrase: PhraseLibraryItem }
  | { type: "block"; block: PromptBlock };
type TranslationTarget = {
  block: PromptBlock;
  sourceLanguage: "zh" | "en";
  targetLanguage: "zh" | "en";
  direction: "zh-en" | "en-zh";
  source: string;
};
type BlockUpdater = PromptBlock[] | ((blocks: PromptBlock[]) => PromptBlock[]);
type PromptRecord = {
  id: string;
  promptZh: string;
  promptEn: string;
  source: PromptSource;
  snapshot: unknown;
  createdAt?: string;
  updatedAt?: string;
};
type FavoriteRecord = PromptRecord & {
  title: string;
  note: string;
  folderId: string | null;
  revisionCount: number;
};
type FolderRecord = {
  id: string;
  name: string;
  sortOrder: number;
  itemCount: number;
};
type RevisionRecord = {
  id: string;
  revisionNo: number;
  snapshot: unknown;
  createdAt: string;
};
type PublicConfig = {
  id: string;
  label: string;
  provider: string;
  endpoint: string;
  model?: string;
  apiKeyMasked: string;
  isActive: boolean;
};
type SubmissionRecord = {
  id: string;
  status: "pending" | "sent" | "failed";
  promptEn: string;
  errorMessage?: string | null;
  updatedAt?: string;
};
type ListResponse<T> = { items: T[]; total?: number };
type ApiFailure = { error?: string; message?: string; code?: string };

const VARIANT_LABELS: Record<PromptVariantKind, string> = {
  concise: "简洁",
  detailed: "详细",
  experimental: "实验性",
};

const WORKBENCH_COLLISION_DETECTION: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions.length ? pointerCollisions : closestCenter(args);
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
  const body = (await response.json().catch(() => ({}))) as ApiFailure;
  if (!response.ok) {
    throw new ApiRequestError(
      body.error || body.message || `请求失败：${response.status}`,
      response.status,
      body.code,
    );
  }
  return body as T;
}

function cloneTemplateBlocks(template: PromptTemplate): PromptBlock[] {
  return template.blocks.map((block, index) => ({
    ...block,
    id: globalThis.crypto?.randomUUID?.() ?? `${template.id}-${Date.now()}-${index}`,
  }));
}

function cleanBlocks(blocks: PromptBlock[]): PromptBlock[] {
  return normalizeBlockOrder(
    blocks.filter((block) => block.textZh.trim() || block.textEn.trim()),
  );
}

function defaultPhraseItem(phrase: DefaultPhrase): PhraseLibraryItem {
  return {
    ...phrase,
    textZh: phrase.name,
    textEn: phrase.content,
    source: "default",
  };
}

function personalPhraseItem(phrase: PhraseSnippet): PhraseLibraryItem {
  const chinese = /[\u3400-\u9fff]/.test(phrase.content);
  return {
    ...phrase,
    targetField: "custom",
    textZh: chinese ? phrase.content : phrase.name,
    textEn: chinese ? "" : phrase.content,
    source: "personal",
  };
}

function insertPhraseBlock(
  blocks: PromptBlock[],
  phrase: PhraseLibraryItem,
  field: PromptBlock["field"],
  index?: number,
): PromptBlock[] {
  const target = orderedBlocks(blocks, field);
  const block = createPromptBlock(
    field,
    phrase.textZh,
    phrase.textEn,
    "phrase",
    target.length,
  );
  target.splice(Math.min(Math.max(index ?? target.length, 0), target.length), 0, block);
  return normalizeBlockOrder([
    ...blocks.filter((item) => item.field !== field),
    ...target,
  ]);
}

function fieldLabel(field: PromptBlock["field"]): string {
  return PROMPT_FIELD_LABELS[field] ?? "自定义";
}

function bodyWithNegative(
  body: string,
  blocks: PromptBlock[],
  language: "zh" | "en",
): string {
  const negative = negativeValues(blocks, language).join(", ");
  if (!negative) return body;
  return `${body}, ${language === "zh" ? "排除" : "exclude"}: ${negative}`;
}

function snapshotVariant(
  variant: PromptVariant,
  baseParameters: PromptParameters,
  references: PromptReferences,
  targetSurface: TargetSurface,
  taskType: TaskType,
): PromptVariant {
  const blocks = cleanBlocks(
    reconcileNegativeBlocks(variant.blocks, baseParameters).blocks,
  );
  const bodies = composePromptBodies(blocks);
  const parameters = parametersWithNegativeBlocks(baseParameters, blocks);
  const bodyZh = bodies.bodyZh || bodies.bodyEn;
  const bodyEn = bodies.bodyEn || bodies.bodyZh;
  return {
    ...variant,
    blocks,
    bodyZh,
    bodyEn,
    promptZh: composePromptWithReferences(bodyZh, parameters, references, {
      targetSurface,
      taskType,
    }),
    promptEn: composePromptWithReferences(bodyEn, parameters, references, {
      targetSurface,
      taskType,
    }),
  };
}

export function PromptWorkbench() {
  const initialTemplate = PROMPT_TEMPLATES[0];
  const [blocks, setBlocks] = useState<PromptBlock[]>(() => cloneTemplateBlocks(initialTemplate));
  const blocksRef = useRef(blocks);
  const [parameters, setParameters] = useState<PromptParameters>(() =>
    stripNegativeParameter(initialTemplate.parameters),
  );
  const [references, setReferences] = useState<PromptReferences>(EMPTY_PROMPT_REFERENCES);
  const [targetSurface, setTargetSurface] = useState<TargetSurface>("web");
  const [taskType, setTaskType] = useState<TaskType>("image");
  const [idea, setIdea] = useState("雨夜都市中的电影感人像，冷色霓虹与克制情绪");
  const [mode, setMode] = useState<PromptSource>("rule");
  const [draft, setDraft] = useState<PromptDraft | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<PromptVariantKind>("detailed");
  const [translationStatuses, setTranslationStatuses] = useState<
    Record<string, BlockTranslationStatus>
  >({});
  const [translationRetryTick, setTranslationRetryTick] = useState(0);
  const translationFailures = useRef(new Set<string>());
  const [parserWarnings, setParserWarnings] = useState<PromptWarning[]>([]);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("create");
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("library");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [templateChoice, setTemplateChoice] = useState<PromptTemplate | null>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);

  const [phrases, setPhrases] = useState<PhraseSnippet[]>([]);
  const [phraseTab, setPhraseTab] = useState<"default" | "personal">("default");
  const [phraseQuery, setPhraseQuery] = useState("");
  const [phraseCategory, setPhraseCategory] = useState("");
  const [phraseLimit, setPhraseLimit] = useState(120);
  const [activeDrag, setActiveDrag] = useState<ActiveDragItem | null>(null);
  const [historyItems, setHistoryItems] = useState<PromptRecord[]>([]);
  const [favorites, setFavorites] = useState<FavoriteRecord[]>([]);
  const [folders, setFolders] = useState<FolderRecord[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [favoriteSearch, setFavoriteSearch] = useState("");
  const [folderFilter, setFolderFilter] = useState("");
  const [favoriteDialog, setFavoriteDialog] = useState(false);
  const [favoriteTitle, setFavoriteTitle] = useState("");
  const [favoriteNote, setFavoriteNote] = useState("");
  const [favoriteFolder, setFavoriteFolder] = useState("");
  const [revisionTarget, setRevisionTarget] = useState<FavoriteRecord | null>(null);
  const [revisions, setRevisions] = useState<RevisionRecord[]>([]);
  const [privateLoading, setPrivateLoading] = useState(false);

  const [aiConfigs, setAiConfigs] = useState<PublicConfig[]>([]);
  const [translationConfigs, setTranslationConfigs] = useState<PublicConfig[]>([]);
  const [pushConfigs, setPushConfigs] = useState<PublicConfig[]>([]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 3200);
  }, []);

  const commitBlocks = useCallback((value: BlockUpdater) => {
    const next =
      typeof value === "function" ? value(blocksRef.current) : value;
    blocksRef.current = next;
    setBlocks(next);
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        blocks: next,
        variants: current.variants.map((variant) =>
          variant.id === selectedVariant
            ? { ...variant, blocks: next }
            : variant
        ),
      };
    });
  }, [selectedVariant]);

  const normalizedBlocks = useMemo(() => cleanBlocks(blocks), [blocks]);
  const composed = useMemo(() => composePromptBodies(normalizedBlocks), [normalizedBlocks]);
  const bodyZh = composed.bodyZh || composed.bodyEn;
  const bodyEn = composed.bodyEn || composed.bodyZh;
  const readableBodyZh = bodyWithNegative(bodyZh, normalizedBlocks, "zh");
  const effectiveParameters = useMemo(
    () =>
      filterUnsupportedParameters(
        parametersWithNegativeBlocks(parameters, normalizedBlocks),
        {
          targetSurface,
          taskType,
        },
      ),
    [normalizedBlocks, parameters, targetSurface, taskType],
  );
  const validation = useMemo(
    () =>
      validatePromptConfiguration(effectiveParameters, references, {
        targetSurface,
        taskType,
      }),
    [effectiveParameters, references, targetSurface, taskType],
  );
  const fullZh = useMemo(
    () =>
      composePromptWithReferences(bodyZh, effectiveParameters, references, {
        targetSurface,
        taskType,
      }),
    [bodyZh, effectiveParameters, references, targetSurface, taskType],
  );
  const fullEn = useMemo(
    () =>
      composePromptWithReferences(bodyEn, effectiveParameters, references, {
        targetSurface,
        taskType,
      }),
    [bodyEn, effectiveParameters, references, targetSurface, taskType],
  );
  const warnings = [...validation.warnings, ...parserWarnings, ...(draft?.warnings ?? [])];
  const activePushConfig = pushConfigs.find((item) => item.isActive);
  const phraseItems = useMemo(
    () =>
      phraseTab === "default"
        ? DEFAULT_PHRASES.map(defaultPhraseItem)
        : phrases.map(personalPhraseItem),
    [phraseTab, phrases],
  );
  const phraseCategories = useMemo(
    () =>
      phraseTab === "default"
        ? [...DEFAULT_PHRASE_CATEGORIES]
        : [...new Set(phrases.map((item) => item.category))],
    [phraseTab, phrases],
  );
  const visiblePhrases = useMemo(() => {
    const query = phraseQuery.trim().toLocaleLowerCase();
    return phraseItems.filter(
      (item) =>
        (!phraseCategory || item.category === phraseCategory) &&
        (!query ||
          `${item.name} ${item.category} ${item.content}`.toLocaleLowerCase().includes(query)),
    );
  }, [phraseCategory, phraseItems, phraseQuery]);
  const displayedPhrases = visiblePhrases.slice(0, phraseLimit);

  const loadPrivateData = useCallback(async (options?: { throwOnError?: boolean }) => {
    setPrivateLoading(true);
    try {
      const [phraseData, folderData, configA, configT, configM] =
        await Promise.all([
        requestJson<ListResponse<PhraseSnippet>>("/api/phrases"),
        requestJson<{ items: FolderRecord[] }>("/api/folders"),
        requestJson<ListResponse<PublicConfig>>("/api/provider-configs"),
        requestJson<ListResponse<PublicConfig>>("/api/translation-configs"),
        requestJson<ListResponse<PublicConfig>>("/api/midjourney-configs"),
      ]);
      setPhrases(phraseData.items);
      setFolders(folderData.items);
      setAiConfigs(configA.items);
      setTranslationConfigs(configT.items);
      setPushConfigs(configM.items);
    } catch (error) {
      notify(error instanceof Error ? error.message : "本地数据加载失败。");
      if (options?.throwOnError) throw error;
    } finally {
      setPrivateLoading(false);
    }
  }, [notify]);

  const reloadPrivateData = useCallback(async () => {
    await loadPrivateData({ throwOnError: true });
  }, [loadPrivateData]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPrivateData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadPrivateData]);

  useEffect(() => {
    const targets = blocks.reduce<TranslationTarget[]>((items, block) => {
      if (
        block.textZh.trim() &&
        !block.textEn.trim() &&
        block.textEnMode === "auto"
      ) {
        items.push({
          block,
          sourceLanguage: "zh",
          targetLanguage: "en",
          direction: "zh-en",
          source: block.textZh,
        });
      } else if (!block.textZh.trim() && block.textEn.trim()) {
        items.push({
          block,
          sourceLanguage: "en",
          targetLanguage: "zh",
          direction: "en-zh",
          source: block.textEn,
        });
      }
      return items;
    }, []).filter((target) => {
      const failureKey = `${target.block.id}:${target.direction}:${target.source}`;
      return !translationFailures.current.has(failureKey);
    });
    if (!targets.length) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setTranslationStatuses((current) => {
        const next = { ...current };
        for (const target of targets) {
          next[target.block.id] = `pending-${target.direction}`;
        }
        return next;
      });
      const translated = await Promise.all(
        targets.map(async (target) => {
          try {
            const result = await requestJson<{ text: string; translated: boolean; warning?: string }>(
              "/api/translate",
              {
                method: "POST",
                signal: controller.signal,
                body: JSON.stringify({
                  text: target.source,
                  sourceLanguage: target.sourceLanguage,
                  targetLanguage: target.targetLanguage,
                }),
              },
            );
            return { ...target, ...result };
          } catch {
            return { ...target, text: "", translated: false };
          }
        }),
      );
      if (controller.signal.aborted) return;
      commitBlocks((current) => current.map((block) => {
        const result = translated.find((item) => item.block.id === block.id);
        if (!result?.translated) return block;
        if (
          result.direction === "zh-en" &&
          block.textZh === result.source &&
          !block.textEn &&
          block.textEnMode === "auto"
        ) {
          return { ...block, textEn: result.text, textEnMode: "auto" };
        }
        if (
          result.direction === "en-zh" &&
          block.textEn === result.source &&
          !block.textZh
        ) {
          return { ...block, textZh: result.text };
        }
        return block;
      }));
      setTranslationStatuses((current) => {
        const next = { ...current };
        for (const result of translated) {
          if (result.translated) {
            delete next[result.block.id];
          } else {
            next[result.block.id] = `failed-${result.direction}`;
            translationFailures.current.add(
              `${result.block.id}:${result.direction}:${result.source}`,
            );
          }
        }
        return next;
      });
    }, 750);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [blocks, commitBlocks, translationRetryTick]);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  async function generate() {
    if (!idea.trim() && !normalizedBlocks.length) {
      notify("请输入创意或添加词块。");
      return;
    }
    if (!validation.valid) {
      notify(validation.warnings.find((item) => item.severity === "error")?.message ?? "参数无效。");
      return;
    }
    setGenerating(true);
    try {
      const result = await requestJson<{ draft: PromptDraft; historyId: string }>(
        "/api/prompts/generate",
        {
          method: "POST",
          body: JSON.stringify({
            mode,
            idea,
            blocks: normalizedBlocks,
            fields: blocksToFields(normalizedBlocks, "zh"),
            translatedFields: blocksToFields(normalizedBlocks, "en"),
            parameters: effectiveParameters,
            references,
            targetSurface,
            taskType,
          }),
        },
      );
      setDraft(result.draft);
      chooseVariant("detailed", result.draft);
      notify(mode === "ai" ? "三个专业版本已生成并写入一条历史。" : "Prompt 已生成并保存历史。");
    } catch (error) {
      notify(error instanceof Error ? error.message : "生成失败。");
    } finally {
      setGenerating(false);
    }
  }

  function chooseVariant(id: PromptVariantKind, sourceDraft = draft) {
    const variant = sourceDraft?.variants.find((item) => item.id === id);
    if (!variant) return;
    const reconciled = reconcileNegativeBlocks(
      variant.blocks,
      stripNegativeParameter(sourceDraft?.parameters ?? parameters),
    );
    setSelectedVariant(id);
    blocksRef.current = reconciled.blocks;
    setBlocks(reconciled.blocks);
    setParameters(reconciled.parameters);
    translationFailures.current.clear();
    setTranslationStatuses({});
    setParserWarnings([]);
  }

  function clearBlockTranslationState(id: string) {
    for (const key of translationFailures.current) {
      if (key.startsWith(`${id}:`)) translationFailures.current.delete(key);
    }
    setTranslationStatuses((current) => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function updateToken(id: string, language: "zh" | "en", value: string) {
    clearBlockTranslationState(id);
    commitBlocks((current) => {
      if (language === "zh" && !draft?.bilingualSyncEnabled) {
        const text = value.trim();
        return text
          ? current.map((block) =>
              block.id === id ? { ...block, textZh: text } : block
            )
          : current.filter((block) => block.id !== id);
      }
      return updatePromptBlockText(current, id, language, value);
    });
  }

  function deleteToken(id: string) {
    clearBlockTranslationState(id);
    commitBlocks((current) => current.filter((block) => block.id !== id));
  }

  function addToken(language: "zh" | "en", rawValue: string) {
    const referenceResult = extractReferencesFromPrompt(rawValue, references, taskType);
    const result = extractParametersFromPrompt(referenceResult.body, effectiveParameters, {
      targetSurface,
      taskType,
    });
    const reconciled = reconcileNegativeBlocks(blocksRef.current, result.parameters);
    commitBlocks(reconciled.blocks);
    setParameters(reconciled.parameters);
    setReferences(referenceResult.references);
    setParserWarnings([...referenceResult.warnings, ...result.warnings]);
    const values = splitPromptTokenInput(result.body);
    if (!values.length) {
      if (
        referenceResult.references !== references ||
        result.parameters !== effectiveParameters
      ) {
        notify("图片引用或参数已加入对应面板。");
      }
      return;
    }
    commitBlocks((current) => appendPromptTokenBlocks(current, language, values));
    notify(`已新增 ${values.length} 个${language === "zh" ? "中文" : "英文"}词块。`);
  }

  function retryTokenTranslation(id: string, targetLanguage: "zh" | "en") {
    const direction = targetLanguage === "en" ? "zh-en" : "en-zh";
    for (const key of translationFailures.current) {
      if (key.startsWith(`${id}:${direction}:`)) {
        translationFailures.current.delete(key);
      }
    }
    setTranslationStatuses((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setTranslationRetryTick((current) => current + 1);
  }

  function resyncEnglish(id: string) {
    clearBlockTranslationState(id);
    commitBlocks((current) => unlockPromptBlockEnglish(current, id));
    setTranslationRetryTick((current) => current + 1);
  }

  function replaceNegativeTokens(values: string[]) {
    const seenValues = new Set<string>();
    const normalizedValues = values
      .map((value) => value.trim().replace(/\s+/g, " "))
      .filter((value) => {
        const key = value.toLocaleLowerCase();
        if (!key || seenValues.has(key)) return false;
        seenValues.add(key);
        return true;
      });
    const existing = orderedBlocks(blocksRef.current, "negative");
    const available = new Set(existing.map((block) => block.id));
    const nextNegative = normalizedValues.map((value, order) => {
      const exact = existing.find(
        (block) =>
          available.has(block.id) &&
          (block.textEn || block.textZh).trim() === value,
      );
      if (exact) {
        available.delete(exact.id);
        return { ...exact, order };
      }
      const positional = existing.find((block) => available.has(block.id));
      if (positional) available.delete(positional.id);
      const chinese = /[\u3400-\u9fff]/.test(value);
      if (positional) {
        clearBlockTranslationState(positional.id);
        return chinese
          ? {
              ...positional,
              order,
              textZh: value,
              textEn: "",
              textEnMode: "auto" as const,
            }
          : {
              ...positional,
              order,
              textZh: "",
              textEn: value,
              textEnMode: "manual" as const,
            };
      }
      return createPromptBlock(
        "negative",
        chinese ? value : "",
        chinese ? "" : value,
        "user",
        order,
      );
    });
    commitBlocks(
      normalizeBlockOrder([
        ...blocksRef.current.filter((block) => block.field !== "negative"),
        ...nextNegative,
      ]),
    );
  }

  function applyTemplate(template: PromptTemplate, strategy: "merge" | "replace") {
    const incoming = cloneTemplateBlocks(template);
    const templateBlocks =
      strategy === "replace"
        ? incoming
        : normalizeBlockOrder([...blocksRef.current, ...incoming]);
    const templateParameters =
      strategy === "replace"
        ? template.parameters
        : { ...parameters, ...template.parameters };
    const reconciled = reconcileNegativeBlocks(
      templateBlocks,
      templateParameters,
    );
    commitBlocks(reconciled.blocks);
    setParameters(reconciled.parameters);
    setDraft(null);
    translationFailures.current.clear();
    setTranslationStatuses({});
    setTemplateChoice(null);
    notify(`${template.name}已${strategy === "replace" ? "覆盖" : "合并"}到编辑器。`);
  }

  function addPhrase(phrase: PhraseLibraryItem, field = phrase.targetField, index?: number) {
    commitBlocks((current) => [
      ...insertPhraseBlock(current, phrase, field, index),
    ]);
    notify(`“${phrase.name}”已加入${fieldLabel(field)}词块。`);
  }

  function startDrag(event: DragStartEvent) {
    const data = event.active.data.current;
    if (data?.type === "phrase") {
      setActiveDrag({ type: "phrase", phrase: data.phrase as PhraseLibraryItem });
      return;
    }
    if (data?.type === "block") {
      const block = blocks.find((item) => item.id === String(event.active.id));
      if (block) setActiveDrag({ type: "block", block });
    }
  }

  function finishDrag(event: DragEndEvent) {
    setActiveDrag(null);
    if (!event.over) return;
    const activeData = event.active.data.current;
    const overData = event.over.data.current;
    const overId = String(event.over.id);
    const targetField =
      (overData?.field as PromptBlock["field"] | undefined) ??
      (overId.startsWith("group-")
        ? (overId.slice(6) as PromptBlock["field"])
        : undefined);
    if (!targetField) return;

    const overBlock = blocks.find((block) => block.id === overId);

    if (activeData?.type === "phrase") {
      const targetIndex = overBlock
        ? orderedBlocks(blocks, targetField).findIndex((block) => block.id === overBlock.id)
        : orderedBlocks(blocks, targetField).length;
      addPhrase(activeData.phrase as PhraseLibraryItem, targetField, Math.max(0, targetIndex));
      return;
    }
    if (activeData?.type === "block") {
      const activeId = String(event.active.id);
      if (activeId === overId) return;
      const remaining = blocks.filter((block) => block.id !== activeId);
      const targetIndex = overBlock
        ? orderedBlocks(remaining, targetField).findIndex((block) => block.id === overBlock.id)
        : orderedBlocks(remaining, targetField).length;
      commitBlocks(
        movePromptBlock(
          blocksRef.current,
          activeId,
          targetField,
          Math.max(0, targetIndex),
        ),
      );
    }
  }

  function currentSnapshot(): PromptSnapshot | null {
    if (!fullEn.trim() && !fullZh.trim()) return null;
    const currentVariant: PromptVariant = {
      id: selectedVariant,
      label: VARIANT_LABELS[selectedVariant],
      blocks: normalizedBlocks,
      bodyZh,
      bodyEn,
      promptZh: fullZh,
      promptEn: fullEn,
    };
    const variants = draft?.variants?.length
      ? draft.variants.map((variant) =>
          variant.id === selectedVariant
            ? currentVariant
            : snapshotVariant(variant, parameters, references, targetSurface, taskType),
        )
      : [currentVariant];
    return PromptSnapshotV4Schema.parse({
      schemaVersion: 4,
      input: blocksToFields(normalizedBlocks, "zh"),
      variants,
      selectedVariant,
      blocks: normalizedBlocks,
      targetSurface,
      taskType,
      bodyZh,
      bodyEn,
      promptZh: fullZh,
      promptEn: fullEn,
      fields: blocksToFields(normalizedBlocks, "zh"),
      translatedFields: blocksToFields(normalizedBlocks, "en"),
      parameters: effectiveParameters,
      references,
      warnings,
      source: draft?.source ?? mode,
      bilingualSyncEnabled: draft?.bilingualSyncEnabled ?? false,
      createdAt: new Date().toISOString(),
    });
  }

  function restoreSnapshot(value: unknown) {
    const parsed = PromptSnapshotSchema.safeParse(value);
    if (!parsed.success) {
      notify("该记录无法解析，可能已损坏。");
      return;
    }
    const snapshot = parsed.data;
    const reconciled = reconcileNegativeBlocks(snapshot.blocks, snapshot.parameters);
    const restoredVariants = snapshot.variants.map((variant) => ({
      ...variant,
      blocks: reconcileNegativeBlocks(variant.blocks, {}).blocks,
    }));
    blocksRef.current = reconciled.blocks;
    setBlocks(reconciled.blocks);
    setParameters(reconciled.parameters);
    setReferences(snapshot.references);
    setTargetSurface(snapshot.targetSurface);
    setTaskType(snapshot.taskType);
    setSelectedVariant(snapshot.selectedVariant);
    setMode(snapshot.source);
    setDraft({
      schemaVersion: 4,
      variants: restoredVariants,
      selectedVariant: snapshot.selectedVariant,
      blocks: reconciled.blocks,
      bilingualSyncEnabled: snapshot.bilingualSyncEnabled,
      targetSurface: snapshot.targetSurface,
      taskType: snapshot.taskType,
      bodyZh: snapshot.bodyZh,
      bodyEn: snapshot.bodyEn,
      promptZh: snapshot.promptZh,
      promptEn: snapshot.promptEn,
      fields: snapshot.fields,
      translatedFields: snapshot.translatedFields,
      parameters: reconciled.parameters,
      references: snapshot.references,
      warnings: snapshot.warnings,
      source: snapshot.source,
    });
    translationFailures.current.clear();
    setTranslationStatuses({});
    setDrawerOpen(false);
    notify("已恢复到编辑器；旧修订本身未被修改。");
  }

  async function copy(value: string, label: string) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    notify(`${label}已复制。`);
  }

  async function saveFavorite() {
    const snapshot = currentSnapshot();
    if (!snapshot) return notify("当前没有可收藏的 Prompt。");
    try {
      await requestJson("/api/favorites", {
        method: "POST",
        body: JSON.stringify({
          snapshot,
          title: favoriteTitle || undefined,
          note: favoriteNote,
          folderId: favoriteFolder || null,
        }),
      });
      setFavoriteDialog(false);
      notify("作品已收藏，并创建 revision 1。");
      await loadLibrary();
    } catch (error) {
      notify(error instanceof Error ? error.message : "收藏失败。");
    }
  }

  async function saveRevision(favorite: FavoriteRecord) {
    const snapshot = currentSnapshot();
    if (!snapshot) return notify("当前没有可保存的 Prompt。");
    try {
      await requestJson(`/api/favorites/${favorite.id}/revisions`, {
        method: "POST",
        body: JSON.stringify({ snapshot }),
      });
      notify(`已为“${favorite.title}”保存新修订。`);
      await loadLibrary();
      await loadRevisions(favorite);
    } catch (error) {
      notify(error instanceof Error ? error.message : "修订保存失败。");
    }
  }

  async function loadHistory() {
    try {
      const result = await requestJson<ListResponse<PromptRecord>>("/api/history?limit=100");
      setHistoryItems(result.items);
    } catch (error) {
      notify(error instanceof Error ? error.message : "历史加载失败。");
    }
  }

  const loadLibrary = useCallback(async () => {
    try {
      const query = new URLSearchParams({ limit: "100" });
      if (favoriteSearch) query.set("search", favoriteSearch);
      if (folderFilter) query.set("folder", folderFilter);
      const [favoriteData, folderData] = await Promise.all([
        requestJson<ListResponse<FavoriteRecord>>(`/api/favorites?${query}`),
        requestJson<{ items: FolderRecord[] }>("/api/folders"),
      ]);
      setFavorites(favoriteData.items);
      setFolders(folderData.items);
    } catch (error) {
      notify(error instanceof Error ? error.message : "作品库加载失败。");
    }
  }, [favoriteSearch, folderFilter, notify]);

  async function loadSubmissions() {
    try {
      const result = await requestJson<ListResponse<SubmissionRecord>>(
        "/api/midjourney-submissions?limit=50",
      );
      setSubmissions(result.items);
    } catch (error) {
      notify(error instanceof Error ? error.message : "推送记录加载失败。");
    }
  }

  async function loadRevisions(favorite: FavoriteRecord) {
    try {
      const result = await requestJson<{ revisions: RevisionRecord[] }>(
        `/api/favorites/${favorite.id}/revisions`,
      );
      setRevisionTarget(favorite);
      setRevisions(result.revisions);
    } catch (error) {
      notify(error instanceof Error ? error.message : "修订加载失败。");
    }
  }

  function openDrawer(tab: DrawerTab) {
    setDrawerTab(tab);
    setDrawerOpen(true);
    if (tab === "history") void loadHistory();
    if (tab === "library") void loadLibrary();
    if (tab === "submissions") void loadSubmissions();
  }

  async function pushPrompt() {
    const snapshot = currentSnapshot();
    if (!snapshot) return notify("请先生成 Prompt。");
    if (!activePushConfig) return notify("请先在设置中启用一个推送入口。");
    setSubmitting(true);
    try {
      const result = await requestJson<{ submissionId: string; status: string; details: string }>(
        "/api/midjourney-submissions",
        {
          method: "POST",
          body: JSON.stringify({
            promptZh: snapshot.promptZh,
            promptEn: snapshot.promptEn,
            source: snapshot.source,
            snapshot,
          }),
        },
      );
      notify(`已投递（仅文本推送）：${result.details}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "推送失败。");
    } finally {
      setSubmitting(false);
    }
  }

  async function exportItems(
    format: "txt" | "markdown" | "json",
    payload: Record<string, unknown>,
  ) {
    const response = await fetch("/api/exports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format, ...payload }),
    });
    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as ApiFailure;
      notify(error.error ?? "导出失败。");
      return;
    }
    const disposition = response.headers.get("content-disposition") ?? "";
    const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `prompts.${format}`;
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("导出文件已生成。");
  }

  return (
    <main className="v2-shell">
      <header className="v2-topbar">
        <button className="v2-brand" type="button" onClick={() => setMobileTab("create")}>
          <span><WandSparkles size={19} /></span>
          <div><strong>Prompt Craft</strong><small>Midjourney 工作台 · V8.2</small></div>
        </button>
        <div className="v2-top-status">
          <i className="online" />
          本地工作区
        </div>
        <nav className="v2-top-actions">
          <button type="button" onClick={() => openDrawer("history")}><History size={16} />历史</button>
          <button type="button" onClick={() => openDrawer("library")}><Library size={16} />作品库</button>
          <button type="button" onClick={() => openDrawer("settings")}><Settings2 size={16} />设置</button>
        </nav>
      </header>

      <DndContext
        id="prompt-workbench-dnd"
        sensors={sensors}
        collisionDetection={WORKBENCH_COLLISION_DETECTION}
        autoScroll={false}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={startDrag}
        onDragEnd={finishDrag}
        onDragCancel={() => setActiveDrag(null)}
      >
      <div className="v2-grid" data-mobile-tab={mobileTab}>
        <aside className="v2-panel v2-materials">
          <div className="v2-panel-title v2-phrases-title">
            <div><span>PHRASES</span><h2>常用词</h2></div>
            <button type="button" aria-label="管理常用词" onClick={() => openDrawer("phrases")}>
              <Plus size={14} />
            </button>
          </div>
          <div className="v2-phrase-tabs" role="tablist" aria-label="常用词来源">
            <button
              type="button"
              role="tab"
              className={phraseTab === "default" ? "active" : ""}
              aria-selected={phraseTab === "default"}
              onClick={() => {
                setPhraseTab("default");
                setPhraseCategory("");
                setPhraseLimit(120);
              }}
            >
              默认词库
            </button>
            <button
              type="button"
              role="tab"
              className={phraseTab === "personal" ? "active" : ""}
              aria-selected={phraseTab === "personal"}
              onClick={() => {
                setPhraseTab("personal");
                setPhraseCategory("");
                setPhraseLimit(120);
              }}
            >
              我的常用词
            </button>
          </div>
          <div className="v2-phrase-filters">
            <input
              value={phraseQuery}
              onChange={(event) => {
                setPhraseQuery(event.target.value);
                setPhraseLimit(120);
              }}
              placeholder="搜索中文名称或英文词语"
              aria-label="搜索常用词"
            />
            <select
              value={phraseCategory}
              onChange={(event) => {
                setPhraseCategory(event.target.value);
                setPhraseLimit(120);
              }}
              aria-label="常用词分类"
            >
              <option value="">全部分类</option>
              {phraseCategories.map((category) => <option key={category}>{category}</option>)}
            </select>
          </div>
          <div className="v2-quick-phrases">
            {displayedPhrases.map((phrase) => (
              <DraggablePhrase key={`${phrase.source}-${phrase.id}`} phrase={phrase} onUse={addPhrase} />
            ))}
            {!visiblePhrases.length && (
              <p>
                {phraseTab === "personal"
                  ? "还没有匹配的个人常用词，可点击右上角加号创建。"
                  : "没有匹配的默认词条。"}
              </p>
            )}
            {displayedPhrases.length < visiblePhrases.length && (
              <button
                type="button"
                className="v2-load-more-phrases"
                onClick={() => setPhraseLimit((current) => current + 120)}
              >
                显示更多（剩余 {visiblePhrases.length - displayedPhrases.length} 条）
              </button>
            )}
          </div>
          <div className="v2-materials-divider" />
          <div className="v2-panel-title v2-templates-title">
            <div><span>TEMPLATES</span><h2>场景模板</h2></div>
            <small>{PROMPT_TEMPLATES.length} 类</small>
          </div>
          <div className="v2-template-list">
            {PROMPT_TEMPLATES.map((template, index) => (
              <button key={template.id} type="button" onClick={() => setTemplateChoice(template)}>
                <b>{String(index + 1).padStart(2, "0")}</b>
                <span><strong>{template.name}</strong><small>{template.description}</small></span>
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
        </aside>

        <section className="v2-creation">
          <div className="v2-prompt-card" aria-label="Prompt 创作与双语编辑">
            <div className="v2-prompt-toolbar">
              <div className="v2-mode-switch" role="group" aria-label="生成模式">
                <button className={mode === "rule" ? "active" : ""} onClick={() => setMode("rule")} type="button">
                  结构规则
                </button>
                <button className={mode === "ai" ? "active" : ""} onClick={() => setMode("ai")} type="button">
                  <Sparkles size={14} />AI 三版本
                </button>
              </div>
              {draft && draft.variants.length > 1 ? (
                <div className="v2-variants" role="tablist" aria-label="Prompt 版本">
                  {draft.variants.map((variant) => (
                    <button
                      key={variant.id}
                      role="tab"
                      aria-selected={selectedVariant === variant.id}
                      className={selectedVariant === variant.id ? "active" : ""}
                      onClick={() => chooseVariant(variant.id)}
                      type="button"
                    >
                      {variant.label}
                    </button>
                  ))}
                </div>
              ) : <span className="v2-variant-placeholder" aria-hidden="true" />}
              <button type="button" className="v2-primary" disabled={generating} onClick={() => void generate()}>
                {generating ? <LoaderCircle className="spin" size={17} /> : <WandSparkles size={17} />}
                {generating ? "生成中…" : "生成 Prompt"}
              </button>
            </div>
            <label className="v2-idea-input">
              <span>中文创意</span>
              <textarea
                value={idea}
                onChange={(event) => setIdea(event.target.value)}
                maxLength={4000}
                placeholder="例如：一位在雨夜霓虹街道回头的女性，电影感、克制而神秘"
              />
            </label>
            <BilingualTokenEditor
              blocks={normalizedBlocks}
              translationStatuses={translationStatuses}
              onUpdate={updateToken}
              onDelete={deleteToken}
              onAdd={addToken}
              onRetry={retryTokenTranslation}
              onResyncEnglish={resyncEnglish}
            />
            <div className="v2-full-prompt">
              <div className="v2-full-prompt-heading">
                <span>完整 Prompt</span>
                <small>参数由系统维护并始终位于末尾</small>
              </div>
              <code>{fullEn || "词块与参数会在这里组合为完整 Prompt。"}</code>
            </div>
            {!!warnings.length && (
              <div className="v2-warnings">
                {warnings.slice(0, 8).map((warning, index) => (
                  <p key={`${warning.code}-${index}`} className={warning.severity}>
                    <CircleAlert size={14} />{warning.message}
                    {warning.suggestion && <span>{warning.suggestion}</span>}
                  </p>
                ))}
              </div>
            )}
            <div className="v2-output-actions">
              <button type="button" onClick={() => void copy(fullEn, "完整 Prompt")}><Copy size={15} />复制完整 Prompt</button>
              <button type="button" onClick={() => void copy(bodyEn, "英文正文")}><Copy size={15} />只复制英文正文</button>
              <button type="button" onClick={() => void copy(readableBodyZh, "中文描述")}><Copy size={15} />复制中文描述</button>
              <button type="button" onClick={() => setFavoriteDialog(true)} disabled={!fullEn}>
                <Heart size={15} />收藏作品
              </button>
              <span className="v2-push-action">
                <button type="button" onClick={() => void pushPrompt()} disabled={submitting || !activePushConfig || !fullEn}>
                  {submitting ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />}
                  发送到配置入口
                </button>
                <ControlHelp label="发送到配置入口">
                  仅把 Prompt 文本转发到 Discord Webhook 或自定义 HTTP，不会执行 Midjourney `/imagine`，也不返回图片任务状态。
                </ControlHelp>
              </span>
              <div className="v2-export-menu">
                <Download size={15} />
                {(["txt", "markdown", "json"] as const).map((format) => (
                  <button
                    key={format}
                    type="button"
                    disabled={!fullEn}
                    onClick={() => {
                      const snapshot = currentSnapshot();
                      if (snapshot) void exportItems(format, { scope: "current", snapshot });
                    }}
                  >
                    {format === "markdown" ? "MD" : format.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="v2-editor-card">
            <div className="v2-section-heading">
              <div><span>BLOCK EDITOR</span><h2>结构化词块</h2></div>
              <small>拖动排序 · 跨组移动 · 双语可编辑</small>
            </div>
            <BlockEditor
              blocks={blocks}
              bilingualSyncEnabled={draft?.bilingualSyncEnabled ?? false}
              onChange={commitBlocks}
            />
          </div>

          <ReferencePanel
            references={references}
            targetSurface={targetSurface}
            taskType={taskType}
            fullPrompt={fullEn}
            onChange={setReferences}
            onCopy={(value, label) => void copy(value, label)}
          />
        </section>

        <ParameterPanel
          parameters={parameters}
          negativeTokens={negativeValues(normalizedBlocks, "en")}
          targetSurface={targetSurface}
          taskType={taskType}
          onParameters={(value) => setParameters(stripNegativeParameter(value))}
          onNegativeTokens={replaceNegativeTokens}
          onSurface={setTargetSurface}
          onTask={setTaskType}
        />
      </div>

      <nav className="v2-mobile-nav">
        <button className={mobileTab === "materials" ? "active" : ""} onClick={() => setMobileTab("materials")}><Menu size={17} />素材</button>
        <button className={mobileTab === "create" ? "active" : ""} onClick={() => setMobileTab("create")}><WandSparkles size={17} />创作</button>
        <button className={mobileTab === "parameters" ? "active" : ""} onClick={() => setMobileTab("parameters")}><Settings2 size={17} />参数</button>
      </nav>

      {drawerOpen && (
        <>
          <button className="v2-drawer-backdrop" aria-label="关闭抽屉" onClick={() => setDrawerOpen(false)} />
          <aside className="v2-drawer">
            <header>
              <div><span>WORKSPACE</span><h2>{drawerTitle(drawerTab)}</h2></div>
              <button type="button" aria-label="关闭抽屉" onClick={() => setDrawerOpen(false)}><X size={18} /></button>
            </header>
            <nav>
              {(["phrases", "history", "library", "submissions", "settings"] as DrawerTab[]).map((tab) => (
                <button
                  key={tab}
                  className={drawerTab === tab ? "active" : ""}
                  onClick={() => openDrawer(tab)}
                  type="button"
                >
                  {drawerTitle(tab)}
                </button>
              ))}
            </nav>
            <div className="v2-drawer-body">
              {drawerTab === "phrases" ? (
                <PhraseManager phrases={phrases} onReload={loadPrivateData} notify={notify} onUse={addPhrase} />
              ) : drawerTab === "history" ? (
                <RecordList
                  records={historyItems}
                  empty="还没有生成历史。"
                  onRestore={(record) => restoreSnapshot(record.snapshot)}
                  onReload={loadHistory}
                  notify={notify}
                />
              ) : drawerTab === "library" ? (
                <LibraryManager
                  favorites={favorites}
                  folders={folders}
                  search={favoriteSearch}
                  folderFilter={folderFilter}
                  revisionTarget={revisionTarget}
                  revisions={revisions}
                  onSearch={setFavoriteSearch}
                  onFolderFilter={setFolderFilter}
                  onReload={loadLibrary}
                  onRestore={restoreSnapshot}
                  onRevisions={loadRevisions}
                  onSaveRevision={saveRevision}
                  onExport={(format, payload) => void exportItems(format, payload)}
                  onDeleted={(ids) => {
                    if (revisionTarget && ids.includes(revisionTarget.id)) {
                      setRevisionTarget(null);
                      setRevisions([]);
                    }
                  }}
                  notify={notify}
                />
              ) : drawerTab === "submissions" ? (
                <SubmissionList items={submissions} />
              ) : (
                <SettingsManager
                  ai={aiConfigs}
                  translation={translationConfigs}
                  push={pushConfigs}
                  onReload={reloadPrivateData}
                  onDeleted={(kind, id) => {
                    if (kind === "ai") {
                      setAiConfigs((current) => current.filter((item) => item.id !== id));
                    } else if (kind === "translation") {
                      setTranslationConfigs((current) => current.filter((item) => item.id !== id));
                    } else {
                      setPushConfigs((current) => current.filter((item) => item.id !== id));
                    }
                  }}
                  notify={notify}
                />
              )}
            </div>
          </aside>
        </>
      )}

      <DragOverlay adjustScale={false} dropAnimation={null}>
        {activeDrag && <DragPreview item={activeDrag} />}
      </DragOverlay>
      </DndContext>

      {templateChoice && (
        <div className="v2-modal-backdrop" role="presentation">
          <section className="v2-modal" role="dialog" aria-modal="true" aria-labelledby="template-title">
            <h2 id="template-title">套用“{templateChoice.name}”</h2>
            <p>默认合并会保留当前词块；覆盖会清空当前词块并应用模板。</p>
            <div>
              <button type="button" onClick={() => setTemplateChoice(null)}>取消</button>
              <button type="button" onClick={() => applyTemplate(templateChoice, "replace")}>覆盖当前</button>
              <button type="button" className="v2-primary" onClick={() => applyTemplate(templateChoice, "merge")}>合并（默认）</button>
            </div>
          </section>
        </div>
      )}

      {favoriteDialog && (
        <div className="v2-modal-backdrop">
          <section className="v2-modal" role="dialog" aria-modal="true" aria-labelledby="favorite-title">
            <h2 id="favorite-title">收藏为作品</h2>
            <label>标题<input value={favoriteTitle} onChange={(e) => setFavoriteTitle(e.target.value)} placeholder="留空则自动生成" /></label>
            <label>文件夹
              <select value={favoriteFolder} onChange={(e) => setFavoriteFolder(e.target.value)}>
                <option value="">未分类</option>
                {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
              </select>
            </label>
            <label>备注<textarea value={favoriteNote} onChange={(e) => setFavoriteNote(e.target.value)} maxLength={1000} /></label>
            <div>
              <button type="button" onClick={() => setFavoriteDialog(false)}>取消</button>
              <button type="button" className="v2-primary" onClick={() => void saveFavorite()}><Heart size={15} />收藏</button>
            </div>
          </section>
        </div>
      )}

      {privateLoading && <div className="v2-loading"><LoaderCircle className="spin" size={17} />同步工作区…</div>}
      {toast && <div className="v2-toast" role="status"><Check size={16} />{toast}</div>}
    </main>
  );
}

function drawerTitle(tab: DrawerTab): string {
  return {
    phrases: "常用词",
    history: "历史",
    library: "作品库",
    submissions: "推送记录",
    settings: "服务配置",
  }[tab];
}

function DragPreview({ item }: { item: ActiveDragItem }) {
  if (item.type === "phrase") {
    return (
      <div className="v2-drag-overlay" data-kind="phrase">
        <small>{item.phrase.category}</small>
        <strong>{item.phrase.name}</strong>
        <span>{item.phrase.content}</span>
      </div>
    );
  }
  return (
    <div className="v2-drag-overlay" data-kind="block">
      <small>{fieldLabel(item.block.field)}词块</small>
      <strong>{item.block.textZh || "未填写中文"}</strong>
      <span>{item.block.textEn || "No English text"}</span>
    </div>
  );
}

function DraggablePhrase({
  phrase,
  onUse,
  compact = false,
}: {
  phrase: PhraseLibraryItem;
  onUse: (phrase: PhraseLibraryItem) => void;
  compact?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `phrase-${phrase.source}-${phrase.id}`,
    data: { type: "phrase", phrase },
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`v2-draggable-phrase${compact ? " compact" : ""}${isDragging ? " is-dragging" : ""}`}
      onClick={() => onUse(phrase)}
      {...attributes}
      {...listeners}
    >
      <small>{phrase.category}</small>
      <strong>{phrase.name}</strong>
      {!compact && <span>{phrase.content}</span>}
    </button>
  );
}

function RecordList({
  records,
  empty,
  onRestore,
  onReload,
  notify,
}: {
  records: PromptRecord[];
  empty: string;
  onRestore: (record: PromptRecord) => void;
  onReload: () => Promise<void>;
  notify: (message: string) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const currentIds = records.map((record) => record.id);
  const effectiveSelected = selectedIds.filter((id) => currentIds.includes(id));
  const allSelected = records.length > 0 && effectiveSelected.length === records.length;

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function deleteRecords(ids: string[]) {
    if (!ids.length) return;
    const confirmed = window.confirm(
      ids.length === 1
        ? "确定删除这条生成历史吗？删除后无法恢复。"
        : `确定批量删除已选择的 ${ids.length} 条历史吗？删除后无法恢复。`,
    );
    if (!confirmed) return;
    try {
      if (ids.length === 1) {
        await requestJson(`/api/history/${ids[0]}`, { method: "DELETE" });
      } else {
        await requestJson("/api/history/batch", {
          method: "DELETE",
          body: JSON.stringify({ ids }),
        });
      }
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      await onReload();
      notify(ids.length === 1 ? "历史记录已删除。" : `已删除 ${ids.length} 条历史记录。`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "历史删除失败。");
    }
  }

  if (!records.length) return <p className="v2-empty">{empty}</p>;
  return (
    <div className="v2-delete-manager">
      <div className="v2-selection-toolbar">
        <label>
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => setSelectedIds(allSelected ? [] : currentIds)}
          />
          选择当前全部 {records.length} 条
        </label>
        <span>已选择 {effectiveSelected.length} 条</span>
        <button
          className="danger"
          type="button"
          disabled={!effectiveSelected.length}
          onClick={() => void deleteRecords(effectiveSelected)}
        >
          <Trash2 size={14} />批量删除
        </button>
      </div>
      <div className="v2-record-list">
        {records.map((record) => (
          <article key={record.id} className={effectiveSelected.includes(record.id) ? "is-selected" : ""}>
            <header>
              <label className="v2-select-work">
                <input
                  type="checkbox"
                  checked={effectiveSelected.includes(record.id)}
                  onChange={() => toggleSelected(record.id)}
                  aria-label={`选择 ${formatDate(record.updatedAt)} 的历史记录`}
                />
                <span>{record.source === "ai" ? "AI 三版本" : "规则生成"}</span>
              </label>
              <time>{formatDate(record.updatedAt)}</time>
            </header>
            <p>{record.promptEn}</p>
            <div className="v2-inline-actions">
              <button type="button" onClick={() => onRestore(record)}>
                <RefreshCw size={14} />恢复到编辑器
              </button>
              <button className="danger" type="button" onClick={() => void deleteRecords([record.id])}>
                <Trash2 size={14} />删除
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function PhraseManager({
  phrases,
  onReload,
  notify,
  onUse,
}: {
  phrases: PhraseSnippet[];
  onReload: () => Promise<void>;
  notify: (message: string) => void;
  onUse: (phrase: PhraseLibraryItem) => void;
}) {
  const [editing, setEditing] = useState<PhraseSnippet | null>(null);
  const [query, setQuery] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      name: String(data.get("name")),
      category: String(data.get("category") || "未分类"),
      content: String(data.get("content")),
      sortOrder: Number(data.get("sortOrder") || 0),
    };
    try {
      await requestJson(editing ? `/api/phrases/${editing.id}` : "/api/phrases", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      setEditing(null);
      form.reset();
      await onReload();
      notify("常用词已保存。");
    } catch (error) {
      notify(error instanceof Error ? error.message : "保存失败。");
    }
  }
  const visible = phrases.filter((item) =>
    `${item.name} ${item.category} ${item.content}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="v2-manager">
      <form onSubmit={submit} key={editing?.id ?? "new"}>
        <input name="name" defaultValue={editing?.name} placeholder="名称" required maxLength={80} />
        <input name="category" defaultValue={editing?.category ?? "未分类"} placeholder="分类" required />
        <input name="content" defaultValue={editing?.content} placeholder="词语或短语内容" required maxLength={500} />
        <label className="v2-sort-field">
          <span>排序</span>
          <input
            name="sortOrder"
            type="number"
            min={0}
            step={1}
            defaultValue={Math.max(0, editing?.sortOrder ?? 0)}
            placeholder="最小为 0"
          />
          <small>数字越小越靠前，最小为 0</small>
        </label>
        <button className="v2-primary" type="submit"><Save size={14} />{editing ? "更新" : "保存"}</button>
      </form>
      <input className="v2-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索名称、分类或内容" />
      <div className="v2-phrase-list">
        {visible.map((phrase) => (
          <article key={phrase.id}>
            <div><small>{phrase.category}</small><strong>{phrase.name}</strong><p>{phrase.content}</p></div>
            <DraggablePhrase phrase={personalPhraseItem(phrase)} onUse={onUse} compact />
            <button type="button" onClick={() => setEditing(phrase)}>编辑</button>
            <button
              type="button"
              onClick={async () => {
                await requestJson(`/api/phrases/${phrase.id}`, { method: "DELETE" });
                await onReload();
              }}
            ><Trash2 size={14} /></button>
          </article>
        ))}
      </div>
    </div>
  );
}

function LibraryManager({
  favorites,
  folders,
  search,
  folderFilter,
  revisionTarget,
  revisions,
  onSearch,
  onFolderFilter,
  onReload,
  onRestore,
  onRevisions,
  onSaveRevision,
  onExport,
  onDeleted,
  notify,
}: {
  favorites: FavoriteRecord[];
  folders: FolderRecord[];
  search: string;
  folderFilter: string;
  revisionTarget: FavoriteRecord | null;
  revisions: RevisionRecord[];
  onSearch: (value: string) => void;
  onFolderFilter: (value: string) => void;
  onReload: () => Promise<void>;
  onRestore: (snapshot: unknown) => void;
  onRevisions: (favorite: FavoriteRecord) => Promise<void>;
  onSaveRevision: (favorite: FavoriteRecord) => Promise<void>;
  onExport: (format: "txt" | "markdown" | "json", payload: Record<string, unknown>) => void;
  onDeleted: (ids: string[]) => void;
  notify: (message: string) => void;
}) {
  const [folderName, setFolderName] = useState("");
  const [renamingFolder, setRenamingFolder] = useState(false);
  const [folderRename, setFolderRename] = useState("");
  const [editingFavorite, setEditingFavorite] = useState<FavoriteRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectedFolder = folders.find((folder) => folder.id === folderFilter);
  const currentIds = favorites.map((favorite) => favorite.id);
  const effectiveSelected = selectedIds.filter((id) => currentIds.includes(id));
  const allSelected = favorites.length > 0 && effectiveSelected.length === favorites.length;

  async function updateFavorite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingFavorite) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await requestJson(`/api/favorites/${editingFavorite.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: String(data.get("title")),
          note: String(data.get("note") ?? ""),
          folderId: String(data.get("folderId") ?? "") || null,
        }),
      });
      setEditingFavorite(null);
      await onReload();
      notify("作品信息已更新。");
    } catch (error) {
      notify(error instanceof Error ? error.message : "作品信息更新失败。");
    }
  }

  async function renameFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFolder) return;
    try {
      await requestJson(`/api/folders/${selectedFolder.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: folderRename }),
      });
      setRenamingFolder(false);
      await onReload();
      notify("文件夹已重命名。");
    } catch (error) {
      notify(error instanceof Error ? error.message : "文件夹重命名失败。");
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function deleteFavorites(ids: string[]) {
    if (!ids.length) return;
    const favorite = ids.length === 1 ? favorites.find((item) => item.id === ids[0]) : null;
    const confirmed = window.confirm(
      ids.length === 1
        ? `确定删除作品“${favorite?.title ?? "未命名作品"}”吗？它的全部修订也会永久删除。`
        : `确定批量删除已选择的 ${ids.length} 个作品吗？这些作品的全部修订也会永久删除。`,
    );
    if (!confirmed) return;
    try {
      if (ids.length === 1) {
        await requestJson(`/api/favorites/${ids[0]}`, { method: "DELETE" });
      } else {
        await requestJson("/api/favorites/batch", {
          method: "DELETE",
          body: JSON.stringify({ ids }),
        });
      }
      if (editingFavorite && ids.includes(editingFavorite.id)) setEditingFavorite(null);
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      onDeleted(ids);
      await onReload();
      notify(ids.length === 1 ? "作品已删除。" : `已删除 ${ids.length} 个作品。`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "作品删除失败。");
    }
  }

  return (
    <div className="v2-manager">
      <div className="v2-library-tools">
        <input
          value={search}
          onChange={(event) => {
            setSelectedIds([]);
            onSearch(event.target.value);
          }}
          placeholder="按标题搜索"
        />
        <select
          value={folderFilter}
          onChange={(event) => {
            setSelectedIds([]);
            onFolderFilter(event.target.value);
          }}
        >
          <option value="">全部文件夹</option>
          <option value="unfiled">未分类</option>
          {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name} ({folder.itemCount})</option>)}
        </select>
        <button type="button" onClick={() => void onReload()}><RefreshCw size={14} />筛选</button>
      </div>
      <form
        className="v2-folder-form"
        onSubmit={async (event) => {
          event.preventDefault();
          await requestJson("/api/folders", {
            method: "POST",
            body: JSON.stringify({ name: folderName }),
          });
          setFolderName("");
          await onReload();
          notify("文件夹已创建。");
        }}
      >
        <input value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="新文件夹名称" required />
        <button type="submit"><FolderPlus size={14} />新建</button>
      </form>
      {!!folderFilter && folderFilter !== "unfiled" && (
        <div className="v2-folder-actions">
          <button type="button" onClick={() => onExport("json", { scope: "folder", folderId: folderFilter })}><Download size={14} />导出文件夹 JSON</button>
          <button
            type="button"
            onClick={() => {
              setFolderRename(selectedFolder?.name ?? "");
              setRenamingFolder(true);
            }}
          >
            重命名文件夹
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!window.confirm("删除文件夹？其中作品会移到未分类，不会被删除。")) return;
              await requestJson(`/api/folders/${folderFilter}`, { method: "DELETE" });
              onFolderFilter("");
              await onReload();
            }}
          ><Trash2 size={14} />删除文件夹</button>
        </div>
      )}
      {renamingFolder && selectedFolder && (
        <form className="v2-folder-form" onSubmit={renameFolder}>
          <input
            value={folderRename}
            onChange={(event) => setFolderRename(event.target.value)}
            maxLength={120}
            required
            aria-label="新的文件夹名称"
          />
          <button type="submit">保存名称</button>
          <button type="button" onClick={() => setRenamingFolder(false)}>取消</button>
        </form>
      )}
      {!!favorites.length && (
        <div className="v2-selection-toolbar">
          <label>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelectedIds(allSelected ? [] : currentIds)}
            />
            选择当前全部 {favorites.length} 个作品
          </label>
          <span>已选择 {effectiveSelected.length} 个</span>
          <button
            className="danger"
            type="button"
            disabled={!effectiveSelected.length}
            onClick={() => void deleteFavorites(effectiveSelected)}
          >
            <Trash2 size={14} />批量删除
          </button>
        </div>
      )}
      {!!effectiveSelected.length && (
        <div className="v2-selected-export">
          <span>已选择 {effectiveSelected.length} 个作品</span>
          {(["txt", "markdown", "json"] as const).map((format) => (
            <button
              key={format}
              type="button"
              onClick={() => onExport(format, { scope: "selected", favoriteIds: effectiveSelected })}
            >
              导出 {format === "markdown" ? "MD" : format.toUpperCase()}
            </button>
          ))}
          <button type="button" onClick={() => setSelectedIds([])}>清除选择</button>
        </div>
      )}
      <div className="v2-record-list">
        {favorites.map((favorite) => (
          <article key={favorite.id}>
            <header>
              <label className="v2-select-work">
                <input
                  type="checkbox"
                  checked={effectiveSelected.includes(favorite.id)}
                  onChange={() => toggleSelected(favorite.id)}
                  aria-label={`选择作品 ${favorite.title}`}
                />
                <strong>{favorite.title}</strong>
              </label>
              <span>revision {favorite.revisionCount}</span>
            </header>
            <p>{favorite.promptEn}</p>
            {favorite.note && <small>{favorite.note}</small>}
            <div className="v2-inline-actions">
              <button type="button" onClick={() => onRestore(favorite.snapshot)}>恢复</button>
              <button type="button" onClick={() => setEditingFavorite(favorite)}>编辑信息 / 移动</button>
              <button type="button" onClick={() => void onSaveRevision(favorite)}>当前内容另存修订</button>
              <button type="button" onClick={() => void onRevisions(favorite)}>时间线</button>
              <button type="button" onClick={() => onExport("markdown", { scope: "favorite", favoriteId: favorite.id })}>导出 MD</button>
              <button className="danger" type="button" onClick={() => void deleteFavorites([favorite.id])}>
                <Trash2 size={14} />删除作品
              </button>
            </div>
          </article>
        ))}
        {!favorites.length && <p className="v2-empty">没有匹配的收藏作品。</p>}
      </div>
      {editingFavorite && (
        <form className="v2-favorite-edit" onSubmit={updateFavorite}>
          <h3>编辑“{editingFavorite.title}”</h3>
          <label>
            标题
            <input name="title" defaultValue={editingFavorite.title} required maxLength={160} />
          </label>
          <label>
            备注
            <textarea name="note" defaultValue={editingFavorite.note} maxLength={1000} />
          </label>
          <label>
            文件夹
            <select name="folderId" defaultValue={editingFavorite.folderId ?? ""}>
              <option value="">未分类</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>{folder.name}</option>
              ))}
            </select>
          </label>
          <div className="v2-inline-actions">
            <button type="submit">保存信息</button>
            <button type="button" onClick={() => setEditingFavorite(null)}>取消</button>
          </div>
        </form>
      )}
      {revisionTarget && (
        <section className="v2-revisions">
          <h3>“{revisionTarget.title}”修订时间线</h3>
          {revisions.map((revision) => (
            <button key={revision.id} type="button" onClick={() => onRestore(revision.snapshot)}>
              <span>revision {revision.revisionNo}</span>
              <time>{formatDate(revision.createdAt)}</time>
              <small>查看 / 恢复</small>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}

function SubmissionList({ items }: { items: SubmissionRecord[] }) {
  if (!items.length) return <p className="v2-empty">还没有文本推送记录。</p>;
  return (
    <div className="v2-record-list">
      {items.map((item) => (
        <article key={item.id}>
          <header><span className={`v2-status ${item.status}`}>{item.status}</span><time>{formatDate(item.updatedAt)}</time></header>
          <p>{item.promptEn}</p>
          {item.errorMessage && <small>{item.errorMessage}</small>}
        </article>
      ))}
    </div>
  );
}

function SettingsManager({
  ai,
  translation,
  push,
  onReload,
  onDeleted,
  notify,
}: {
  ai: PublicConfig[];
  translation: PublicConfig[];
  push: PublicConfig[];
  onReload: () => Promise<void>;
  onDeleted: (kind: ServiceConfigKind, id: string) => void;
  notify: (message: string) => void;
}) {
  return (
    <div className="v2-settings">
      <ConfigSection
        title="AI 配置"
        description="配置云端模型或本机 Ollama，用于生成三个结构化 Prompt 版本。"
        kind="ai"
        items={ai}
        onReload={onReload}
        onDeleted={(id) => onDeleted("ai", id)}
        notify={notify}
      />
      <ConfigSection
        title="翻译配置"
        description="配置 LibreTranslate、DeepL 或 Google；未配置时保留原文。"
        kind="translation"
        items={translation}
        onReload={onReload}
        onDeleted={(id) => onDeleted("translation", id)}
        notify={notify}
      />
      <ConfigSection
        title="文本推送入口"
        description="Discord Webhook 或自定义 HTTP，仅推送文本，不是官方 Midjourney 下单。"
        kind="push"
        items={push}
        onReload={onReload}
        onDeleted={(id) => onDeleted("push", id)}
        notify={notify}
      />
    </div>
  );
}

function ConfigSection({
  title,
  description,
  kind,
  items,
  onReload,
  onDeleted,
  notify,
}: {
  title: string;
  description: string;
  kind: ServiceConfigKind;
  items: PublicConfig[];
  onReload: () => Promise<void>;
  onDeleted: (id: string) => void;
  notify: (message: string) => void;
}) {
  const defaults =
    kind === "ai"
      ? { label: "OpenAI", provider: "openai", model: "gpt-4.1-mini", endpoint: "", apiKey: "" }
      : kind === "translation"
        ? { label: "LibreTranslate", provider: "libretranslate", model: "", endpoint: "", apiKey: "" }
        : { label: "Discord Webhook", provider: "discord_webhook", model: "", endpoint: "", apiKey: "" };
  const base = kind === "ai" ? "/api/provider-configs" : kind === "translation" ? "/api/translation-configs" : "/api/midjourney-configs";
  const [selectedProvider, setSelectedProvider] = useState(defaults.provider);
  const [modelValue, setModelValue] = useState(defaults.model);
  const [labelValue, setLabelValue] = useState(defaults.label);
  const [endpointValue, setEndpointValue] = useState(defaults.endpoint);
  const [apiKeyValue, setApiKeyValue] = useState(defaults.apiKey);
  const [expandedHelpId, setExpandedHelpId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [deletingSnapshot, setDeletingSnapshot] = useState<{
    item: PublicConfig;
    index: number;
  } | null>(null);
  const pendingActionRef = useRef(false);
  const createDetailsRef = useRef<HTMLDetailsElement>(null);
  const selectedHelp = serviceConfigHelp(selectedProvider);
  const providerOptions = providersForKind(kind);
  const busy = pendingAction !== null;
  const visibleItems = useMemo(() => {
    if (
      !deletingSnapshot ||
      items.some((item) => item.id === deletingSnapshot.item.id)
    ) {
      return items;
    }
    const next = [...items];
    next.splice(
      Math.min(deletingSnapshot.index, next.length),
      0,
      deletingSnapshot.item,
    );
    return next;
  }, [deletingSnapshot, items]);

  function selectProvider(provider: string) {
    setSelectedProvider(provider);
    setLabelValue(providerLabel(provider));
    if (kind === "ai") setModelValue(defaultModelForProvider(provider));
    setEndpointValue(defaultEndpointForProvider(provider));
    setApiKeyValue("");
  }

  function openCreateForm(provider = defaults.provider) {
    selectProvider(provider);
    requestAnimationFrame(() => {
      if (createDetailsRef.current) createDetailsRef.current.open = true;
    });
  }

  async function runConfigAction(
    actionKey: string,
    action: () => Promise<void>,
    successMessage?: string,
    onSettled?: () => void,
  ) {
    if (pendingActionRef.current) return;
    pendingActionRef.current = true;
    setPendingAction(actionKey);
    try {
      await action();
      if (successMessage) notify(successMessage);
    } catch (error) {
      notify(error instanceof Error ? error.message : "配置操作失败。");
    } finally {
      pendingActionRef.current = false;
      onSettled?.();
      setPendingAction(null);
    }
  }

  return (
    <section className="v2-config-section" aria-busy={busy}>
      <header className="v2-config-heading">
        <div><h3>{title}</h3><p>{description}</p></div>
        <span>{visibleItems.length} 个</span>
      </header>
      {pendingAction?.startsWith("delete:") && deletingSnapshot && (
        <div className="v2-config-progress" role="status" aria-live="polite">
          <LoaderCircle className="spin" size={15} />
          <span>
            正在删除“{deletingSnapshot.item.label}”，删除完成后将立即恢复操作。
          </span>
        </div>
      )}
      {!visibleItems.length && (
        <p className="v2-config-empty">暂无配置，可按需添加。</p>
      )}
      {visibleItems.map((item, index) => {
        const deleting = pendingAction === `delete:${item.id}`;
        return (
          <div
            className={`v2-config-item${deleting ? " is-deleting" : ""}`}
            key={item.id}
          >
            <article>
              <div>
                <strong>{item.label}</strong>
                <small>
                  {[providerLabel(item.provider), item.model, item.endpoint, item.apiKeyMasked || "无密钥"]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
              </div>
              {item.isActive && <span>已启用</span>}
              <button
                type="button"
                disabled={busy}
                aria-expanded={expandedHelpId === item.id}
                onClick={() => setExpandedHelpId((current) => current === item.id ? null : item.id)}
              >
                <CircleAlert size={13} />配置说明
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runConfigAction(
                  `toggle:${item.id}`,
                  async () => {
                    await requestJson(`${base}/${item.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({ isActive: !item.isActive }),
                    });
                    await onReload();
                  },
                  item.isActive ? "配置已停用。" : "配置已启用。",
                )}
              >
                {pendingAction === `toggle:${item.id}` && (
                  <LoaderCircle className="spin" size={13} />
                )}
                {item.isActive ? "停用" : "启用"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runConfigAction(
                  `test:${item.id}`,
                  async () => {
                    await requestJson(`${base}/test`, {
                      method: "POST",
                      body: JSON.stringify({ id: item.id }),
                    });
                  },
                  "连接测试成功。",
                )}
              >
                {pendingAction === `test:${item.id}` && (
                  <LoaderCircle className="spin" size={13} />
                )}
                测试
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (pendingActionRef.current) return;
                  if (!window.confirm(`确定删除配置“${item.label}”吗？`)) return;
                  setDeletingSnapshot({ item, index });
                  void runConfigAction(
                    `delete:${item.id}`,
                    async () => {
                      await requestJson(`${base}/${item.id}`, { method: "DELETE" });
                      onDeleted(item.id);
                    },
                    "配置已删除。",
                    () => setDeletingSnapshot(null),
                  );
                }}
                aria-label={`删除配置 ${item.label}`}
              >
                {deleting
                  ? <LoaderCircle className="spin" size={13} />
                  : <Trash2 size={13} />}
              </button>
            </article>
            {expandedHelpId === item.id && (
              <ProviderSetupHelpPanel help={serviceConfigHelp(item.provider)} compact />
            )}
          </div>
        );
      })}
      {kind === "ai" && (
        <button
          className="v2-config-local-entry"
          type="button"
          disabled={busy}
          onClick={() => openCreateForm("ollama")}
        >
          <Laptop size={15} />
          添加本地 Ollama
          <small>127.0.0.1:11434</small>
        </button>
      )}
      <details className="v2-config-create" ref={createDetailsRef}>
        <summary
          aria-disabled={busy}
          onClick={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <Plus size={14} />添加{kind === "ai" ? "个人模型" : kind === "translation" ? "个人翻译" : "推送入口"}
        </summary>
        <ProviderSetupHelpPanel help={selectedHelp} />
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (pendingAction) return;
            const formElement = event.currentTarget;
            const form = new FormData(formElement);
            const payload: Record<string, unknown> = {
              label: String(form.get("label")),
              provider: String(form.get("provider")),
              endpoint: String(form.get("endpoint") || "") || undefined,
              apiKey: String(form.get("apiKey") || ""),
              isActive: true,
            };
            if (kind === "ai") payload.model = String(form.get("model"));
            void runConfigAction(
              "create",
              async () => {
                await requestJson(base, {
                  method: "POST",
                  body: JSON.stringify(payload),
                });
                setSelectedProvider(defaults.provider);
                setLabelValue(defaults.label);
                setModelValue(defaults.model);
                setEndpointValue(defaults.endpoint);
                setApiKeyValue(defaults.apiKey);
                await onReload();
              },
              "配置已加密保存。",
            );
          }}
        >
          <label>配置名称
            <input
              name="label"
              value={labelValue}
              onChange={(event) => setLabelValue(event.target.value)}
              placeholder={`例如：我的 ${providerLabel(selectedProvider)}`}
              disabled={busy}
              required
            />
          </label>
          <label>服务类型
            <select
              name="provider"
              value={selectedProvider}
              onChange={(event) => selectProvider(event.target.value)}
              disabled={busy}
            >
              {providerOptions.map((item) => (
                <option key={item} value={item}>{providerLabel(item)}</option>
              ))}
            </select>
          </label>
          {kind === "ai" && (
            <label>模型名称
              <input
                name="model"
                value={modelValue}
                onChange={(event) => setModelValue(event.target.value)}
                placeholder={selectedHelp.modelPlaceholder}
                disabled={busy}
                required
              />
            </label>
          )}
          <label className="wide">接口地址
            <input
              name="endpoint"
              value={endpointValue}
              onChange={(event) => setEndpointValue(event.target.value)}
              type="url"
              placeholder={selectedHelp.endpointPlaceholder}
              disabled={busy}
              required={kind === "push" || selectedProvider === "custom"}
            />
          </label>
          <label className="wide">API Key
            <input
              name="apiKey"
              value={apiKeyValue}
              onChange={(event) => setApiKeyValue(event.target.value)}
              type="password"
              placeholder={selectedHelp.apiKeyPlaceholder}
              disabled={busy}
              required={
                (kind === "ai" && selectedProvider !== "ollama") ||
                selectedProvider === "deepl" ||
                selectedProvider === "google"
              }
            />
          </label>
          <button
            className="v2-primary"
            type="submit"
            disabled={pendingAction !== null}
          >
            {pendingAction === "create"
              ? <LoaderCircle className="spin" size={14} />
              : <Plus size={14} />}
            保存并启用
          </button>
        </form>
      </details>
    </section>
  );
}

function ProviderSetupHelpPanel({
  help,
  compact = false,
}: {
  help: ServiceConfigHelp;
  compact?: boolean;
}) {
  return (
    <section className={`v2-provider-setup-help${compact ? " compact" : ""}`}>
      <header>
        <div>
          <small>开通与填写帮助</small>
          <strong>{help.title}</strong>
        </div>
        <span>保存 → 测试 → 启用</span>
      </header>
      <p>{help.summary}</p>
      <ol>
        {help.steps.map((step) => <li key={step}>{step}</li>)}
      </ol>
      <dl>
        {help.model && <div><dt>模型名称</dt><dd>{help.model}</dd></div>}
        <div><dt>接口地址</dt><dd>{help.endpoint}</dd></div>
        <div><dt>API Key</dt><dd>{help.apiKey}</dd></div>
      </dl>
      {help.caution && <p className="v2-provider-caution"><CircleAlert size={14} />{help.caution}</p>}
      {(help.keyUrl || help.docsUrl) && (
        <nav aria-label={`${help.title} 官方帮助链接`}>
          {help.keyUrl && (
            <a href={help.keyUrl} target="_blank" rel="noreferrer">
              获取 API Key <ExternalLink size={13} />
            </a>
          )}
          {help.docsUrl && (
            <a href={help.docsUrl} target="_blank" rel="noreferrer">
              查看官方文档 <ExternalLink size={13} />
            </a>
          )}
        </nav>
      )}
    </section>
  );
}

function providerLabel(provider: string): string {
  return {
    openai: "OpenAI",
    anthropic: "Anthropic Claude",
    gemini: "Google Gemini",
    deepseek: "DeepSeek",
    qwen: "通义千问",
    doubao: "豆包",
    zhipu: "智谱",
    kimi: "Kimi",
    minimax: "MiniMax",
    ollama: "本地 Ollama",
    custom: "OpenAI 兼容",
    libretranslate: "LibreTranslate",
    deepl: "DeepL",
    google: "Google Translate",
    discord_webhook: "Discord Webhook",
    custom_http: "自定义 HTTP",
  }[provider] ?? provider;
}

function defaultModelForProvider(provider: string): string {
  return {
    openai: "gpt-4.1-mini",
    anthropic: "claude-sonnet-4-5",
    gemini: "gemini-2.5-flash",
    deepseek: "deepseek-v4-flash",
    qwen: "qwen-plus",
    doubao: "doubao-seed-2-0-lite-260215",
    zhipu: "glm-4-flash",
    kimi: "moonshot-v1-8k",
    minimax: "MiniMax-M2.1",
    ollama: "qwen2.5:3b",
    custom: "",
  }[provider] ?? "";
}

function defaultEndpointForProvider(provider: string): string {
  return provider === "ollama"
    ? "http://127.0.0.1:11434/v1/chat/completions"
    : "";
}

function formatDate(value?: string): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
