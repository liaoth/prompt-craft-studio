import { describe, expect, it } from "vitest";

import {
  PARAMETER_REGISTRY,
  DEFAULT_PHRASES,
  SECTION12_PHRASES,
  SECTION12_SOURCE_COUNTS,
  SECTION12_SOURCE_ROW_COUNT,
  PROMPT_TEMPLATES,
  PromptSnapshotSchema,
  PromptReferencesSchema,
  composePromptWithReferences,
  composePromptBodies,
  createPromptBlock,
  extractParametersFromPrompt,
  generateRulePrompt,
  movePromptBlock,
  negativeValues,
  parametersWithNegativeBlocks,
  reconcileNegativeBlocks,
  serializeParameters,
  stripNegativeParameter,
  validateParameters,
  validatePromptConfiguration,
  appendPromptTokenBlocks,
  splitPromptTokenInput,
  unlockPromptBlockEnglish,
  updatePromptBlockText,
} from "../lib/prompt";
describe("Prompt v2 blocks and templates", () => {
  it("reconciles legacy --no values into canonical negative blocks", () => {
    const existing = createPromptBlock(
      "negative",
      "文字",
      "text",
      "user",
      0,
      "negative-text",
    );
    const reconciled = reconcileNegativeBlocks(
      [existing],
      { model: "8.2", no: ["text", "watermark", "  WATERMARK  "] },
    );
    expect(reconciled.parameters.no).toBeUndefined();
    expect(reconciled.blocks.filter((block) => block.field === "negative")).toHaveLength(2);
    expect(parametersWithNegativeBlocks(reconciled.parameters, reconciled.blocks)).toMatchObject({
      model: "8.2",
      no: ["text", "watermark"],
    });
    expect(stripNegativeParameter({ no: ["text"], chaos: 0 })).toEqual({ chaos: 0 });
  });

  it("keeps V4 negative blocks isolated between AI-style variants", () => {
    const base = generateRulePrompt({
      idea: "雨夜人像",
      translatedIdea: "rainy night portrait",
      parameters: { model: "8.2", no: ["watermark"] },
    });
    const conciseBlocks = [
      ...base.blocks.filter((block) => block.field !== "negative"),
      createPromptBlock("negative", "雾", "fog", "ai", 0, "concise-negative"),
    ];
    const conciseBodies = composePromptBodies(conciseBlocks);
    const restored = PromptSnapshotSchema.parse({
      ...base,
      input: base.fields,
      variants: [
        base.variants[0],
        {
          id: "concise",
          label: "简洁",
          blocks: conciseBlocks,
          bodyZh: conciseBodies.bodyZh,
          bodyEn: conciseBodies.bodyEn,
          promptZh: `${conciseBodies.bodyZh} --v 8.2 --no fog`,
          promptEn: `${conciseBodies.bodyEn} --v 8.2 --no fog`,
        },
      ],
    });
    expect(
      negativeValues(
        restored.variants.find((variant) => variant.id === "detailed")!.blocks,
        "en",
      ),
    ).toEqual(["watermark"]);
    expect(
      negativeValues(
        restored.variants.find((variant) => variant.id === "concise")!.blocks,
        "en",
      ),
    ).toEqual(["fog"]);
  });

  it("ships a categorized read-only bilingual default phrase library", () => {
    expect(DEFAULT_PHRASES).toHaveLength(642);
    expect(SECTION12_SOURCE_ROW_COUNT).toBe(592);
    expect(SECTION12_SOURCE_COUNTS).toEqual({
      "12.1": 70,
      "12.2": 103,
      "12.3": 55,
      "12.4": 79,
      "12.5": 25,
      "12.6": 27,
      "12.7": 58,
      "12.8": 59,
      "12.9": 40,
      "12.10": 36,
      "12.11": 40,
    });
    expect(SECTION12_PHRASES).toHaveLength(576);
    expect(new Set(DEFAULT_PHRASES.map((item) => item.id)).size).toBe(DEFAULT_PHRASES.length);
    expect(
      new Set(DEFAULT_PHRASES.map((item) => item.content.toLocaleLowerCase())).size,
    ).toBe(DEFAULT_PHRASES.length);
    expect(
      DEFAULT_PHRASES.find((item) => item.content === "split lighting"),
    ).toMatchObject({ name: "双侧照明", targetField: "lighting" });
    expect(
      DEFAULT_PHRASES.some(
        (item) => item.content.toLocaleLowerCase() === "bisexual lighting",
      ),
    ).toBe(false);
    expect(
      DEFAULT_PHRASES.some(
        (item) => item.content.toLocaleLowerCase() === "global illuminations",
      ),
    ).toBe(false);
    expect(DEFAULT_PHRASES.some((item) => item.content === "Whopper")).toBe(true);
    expect(DEFAULT_PHRASES.every((item) => item.name && item.category && item.content)).toBe(true);
  });

  it("provides exactly ten complete bilingual templates", () => {
    expect(PROMPT_TEMPLATES).toHaveLength(10);
    expect(new Set(PROMPT_TEMPLATES.map((item) => item.id)).size).toBe(10);
    for (const template of PROMPT_TEMPLATES) {
      expect(template.blocks.length).toBeGreaterThan(2);
      expect(template.blocks.every((block) => block.textZh && block.textEn)).toBe(true);
      expect(template.parameters.model).toBeTruthy();
    }
  });

  it("moves blocks within and across groups while normalizing order", () => {
    const first = createPromptBlock("subject", "猫", "cat", "user", 0, "a");
    const second = createPromptBlock("subject", "白色", "white", "user", 1, "b");
    const light = createPromptBlock("lighting", "柔光", "soft light", "user", 0, "c");
    const moved = movePromptBlock([first, second, light], "b", "lighting", 0);
    expect(moved.find((block) => block.id === "b")).toMatchObject({
      field: "lighting",
      order: 0,
    });
    expect(moved.find((block) => block.id === "c")?.order).toBe(1);
    expect(composePromptBodies(moved).bodyEn).toBe("cat, white, soft light");
  });

  it("keeps bilingual token deletion and English protection deterministic", () => {
    const automatic = createPromptBlock("subject", "猫", "cat", "idea", 0, "auto");
    const changed = updatePromptBlockText([automatic], "auto", "zh", "白猫");
    expect(changed[0]).toMatchObject({
      textZh: "白猫",
      textEn: "",
      textEnMode: "auto",
    });

    const locked = updatePromptBlockText([automatic], "auto", "en", "a hand-edited cat");
    const protectedBlock = updatePromptBlockText(locked, "auto", "zh", "黑猫");
    expect(protectedBlock[0]).toMatchObject({
      textZh: "黑猫",
      textEn: "a hand-edited cat",
      textEnMode: "manual",
    });
    expect(unlockPromptBlockEnglish(protectedBlock, "auto")[0]).toMatchObject({
      textEn: "",
      textEnMode: "auto",
    });
    expect(updatePromptBlockText(protectedBlock, "auto", "en", "")).toEqual([]);
  });

  it("splits and appends direct bilingual token input", () => {
    expect(splitPromptTokenInput("雨夜，霓虹\n电影感")).toEqual([
      "雨夜",
      "霓虹",
      "电影感",
    ]);
    const appended = appendPromptTokenBlocks([], "en", ["cinematic", "soft light"]);
    expect(appended).toHaveLength(2);
    expect(appended[0]).toMatchObject({
      field: "custom",
      textZh: "",
      textEn: "cinematic",
      textEnMode: "manual",
    });
  });

  it("never drops a non-empty idea in rule mode", () => {
    const noSubject = generateRulePrompt({
      idea: "一只玻璃鲸鱼",
      translatedIdea: "a glass whale",
      parameters: { model: "8.2" },
    });
    expect(noSubject.blocks[0]).toMatchObject({
      field: "subject",
      textZh: "一只玻璃鲸鱼",
      textEn: "a glass whale",
    });

    const withSubject = generateRulePrompt({
      idea: "漂浮在云层上",
      translatedIdea: "floating above clouds",
      fields: { subject: "玻璃鲸鱼" },
      translatedFields: { subject: "a glass whale" },
      parameters: { model: "8.2" },
    });
    expect(withSubject.blocks.some((block) => block.field === "custom" && block.origin === "idea"))
      .toBe(true);
    expect(withSubject.promptEn).toContain("floating above clouds");
  });
});

describe("official parameter registry and normalization", () => {
  it("uses V8.2 as default and covers the full planned registry", () => {
    expect(validateParameters({}).parameters.model).toBe("8.2");
    expect(new Set(PARAMETER_REGISTRY.map((item) => item.id))).toEqual(
      expect.objectContaining({
        size: expect.any(Number),
      }),
    );
    const ids = PARAMETER_REGISTRY.map((item) => item.id);
    for (const id of [
      "model",
      "aspectRatio",
      "chaos",
      "omniWeight",
      "no",
      "profile",
      "quality",
      "repeat",
      "seed",
      "visibility",
      "raw",
      "stylize",
      "styleWeight",
      "styleVersion",
      "tile",
      "draft",
      "weird",
      "speedMode",
      "imageWeight",
      "motion",
      "loop",
      "batchSize",
      "video",
      "imageResolution",
    ]) {
      expect(ids).toContain(id);
    }
    expect(
      PARAMETER_REGISTRY.every((item) =>
        ["model", "composition", "style", "variation", "mode", "output"].includes(
          item.uiTone,
        ),
      ),
    ).toBe(true);
  });

  it("blocks V8.0 for new prompts but allows legacy restoration with a warning", () => {
    expect(validateParameters({ model: "8" }).valid).toBe(false);
    const legacy = validateParameters({ model: "8" }, { allowLegacyModel: true });
    expect(legacy.valid).toBe(true);
    expect(legacy.warnings[0]?.suggestion).toContain("8.2");
  });

  it("extracts pasted parameters, keeps the last duplicate, and serializes them at the end", () => {
    const extracted = extractParametersFromPrompt(
      "portrait --ar 1:1 with rain --aspect 16:9 --style raw --s 300",
      { model: "7" },
    );
    expect(extracted.body).toBe("portrait with rain");
    expect(extracted.parameters).toMatchObject({
      aspectRatio: "16:9",
      raw: true,
      stylize: 300,
    });
    expect(extracted.warnings.some((item) => item.code === "DUPLICATE_PARAMETER")).toBe(true);
    expect(extracted.warnings.some((item) => item.code === "DEPRECATED_PARAMETER")).toBe(true);
    expect(serializeParameters(extracted.parameters)).toBe("--v 7 --ar 16:9 --raw --s 300");
  });

  it("validates moodboard, surface, model, speed, draft and video compatibility", () => {
    const moodboard = validateParameters({
      model: "7",
      profile: ["mood-1"],
      styleWeight: 250,
      styleVersion: 6,
    });
    expect(moodboard.valid).toBe(false);
    expect(moodboard.warnings.some((item) => item.code === "PARAMETER_CONFLICT")).toBe(true);

    expect(
      validateParameters(
        { model: "7", repeat: 3 },
        { targetSurface: "web", taskType: "image" },
      ).valid,
    ).toBe(true);
    expect(
      validateParameters(
        { model: "8.2", speedMode: "turbo" },
        { targetSurface: "web", taskType: "image" },
      ).valid,
    ).toBe(false);
    expect(
      validateParameters(
        { model: "8.1", draft: true },
        { targetSurface: "discord", taskType: "image" },
      ).valid,
    ).toBe(false);
    expect(
      validateParameters(
        { motion: "high", loop: true, batchSize: 4 },
        { targetSurface: "web", taskType: "video" },
      ).valid,
    ).toBe(true);
    expect(
      validateParameters(
        { no: ["watermark"] },
        { targetSurface: "web", taskType: "video" },
      ).valid,
    ).toBe(false);
    expect(
      validateParameters(
        { raw: true, video: true },
        { targetSurface: "discord", taskType: "video" },
      ).valid,
    ).toBe(true);
  });

  it("validates image references and places URLs before text with parameters at the end", () => {
    const references = PromptReferencesSchema.parse({
      imagePrompts: [
        {
          id: "image-1",
          kind: "image_prompt",
          valueType: "url",
          value: "https://example.com/source.jpg?x=1",
          order: 0,
        },
      ],
    });
    const configuration = validatePromptConfiguration(
      { model: "7", imageWeight: 2, stylize: 100 },
      references,
      { targetSurface: "web", taskType: "image" },
    );
    expect(configuration.valid).toBe(true);
    expect(
      composePromptWithReferences("cinematic portrait", configuration.parameters, references, {
        targetSurface: "web",
        taskType: "image",
      }),
    ).toBe(
      "https://example.com/source.jpg?x=1 cinematic portrait --v 7 --s 100 --iw 2",
    );
  });

  it("restricts Omni to V7 and requires a starting frame for video", () => {
    const omni = PromptReferencesSchema.parse({
      omniReference: {
        id: "omni",
        kind: "omni_reference",
        valueType: "url",
        value: "https://example.com/subject.png",
        order: 0,
      },
    });
    expect(
      validatePromptConfiguration({ model: "8.2", omniWeight: 100 }, omni, {
        targetSurface: "web",
        taskType: "image",
      }).valid,
    ).toBe(false);
    expect(
      validatePromptConfiguration({}, PromptReferencesSchema.parse({}), {
        targetSurface: "web",
        taskType: "video",
      }).valid,
    ).toBe(false);
  });
});

describe("snapshot compatibility", () => {
  it("converts a v1 snapshot to v4 blocks without a manual migration", () => {
    const legacy = PromptSnapshotSchema.parse({
      input: {
        subject: "猫",
        action: "",
        environment: "",
        composition: "",
        camera: "",
        lighting: "",
        color: "",
        material: "",
        medium: "",
        style: "",
        mood: "",
        negative: "",
      },
      promptZh: "猫 --v 7",
      promptEn: "cat --v 7",
      fields: {
        subject: "猫",
        action: "",
        environment: "",
        composition: "",
        camera: "",
        lighting: "",
        color: "",
        material: "",
        medium: "",
        style: "",
        mood: "",
        negative: "",
      },
      translatedFields: { subject: "cat" },
      parameters: { model: "7" },
      warnings: [],
      source: "rule",
    });
    expect(legacy.schemaVersion).toBe(4);
    expect(legacy.blocks[0]).toMatchObject({
      textZh: "猫",
      textEn: "cat",
      textEnMode: "auto",
      origin: "legacy",
    });
    expect(legacy.bilingualSyncEnabled).toBe(false);
    expect(legacy.selectedVariant).toBe("detailed");
  });

  it("moves V2 reference parameters into V4 references and drops video quality", () => {
    const generated = generateRulePrompt({
      idea: "城市夜景",
      translatedIdea: "city at night",
      parameters: { model: "7" },
    });
    const v2Draft: Record<string, unknown> = { ...generated };
    delete v2Draft.references;
    delete v2Draft.bilingualSyncEnabled;
    const migrated = PromptSnapshotSchema.parse({
      ...v2Draft,
      schemaVersion: 2,
      input: generated.fields,
      taskType: "video",
      parameters: {
        styleReference: ["https://example.com/style.jpg"],
        omniReference: "https://example.com/subject.png",
        end: "https://example.com/end.webp",
        videoQuality: "hd",
      },
    });
    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.bilingualSyncEnabled).toBe(true);
    expect(migrated.references.styleReferences[0]?.value).toContain("style.jpg");
    expect(migrated.references.omniReference?.value).toContain("subject.png");
    expect(migrated.references.videoEnd?.value).toContain("end.webp");
    expect(migrated.parameters.videoQuality).toBeUndefined();
    expect(migrated.warnings.some((item) => item.code === "MIGRATED_VIDEO_QUALITY")).toBe(true);
  });

  it("upgrades V3 snapshots and infers Chinese-idea bilingual linking", () => {
    const generated = generateRulePrompt({
      idea: "雨夜人像",
      translatedIdea: "rainy night portrait",
      parameters: { model: "8.2" },
    });
    const v3: Record<string, unknown> = {
      ...generated,
      schemaVersion: 3,
      input: generated.fields,
    };
    delete v3.bilingualSyncEnabled;
    const migrated = PromptSnapshotSchema.parse(v3);
    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.bilingualSyncEnabled).toBe(true);
    expect(migrated.blocks.every((block) => block.textEnMode === "auto")).toBe(true);
  });

});
