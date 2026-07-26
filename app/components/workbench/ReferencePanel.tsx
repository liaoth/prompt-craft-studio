"use client";
/* eslint-disable @next/next/no-img-element -- user-supplied HTTPS previews must not be proxied */

import {
  ArrowDown,
  ArrowUp,
  Copy,
  Image as ImageIcon,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  PromptReferencesSchema,
  type PromptReferenceAsset,
  type PromptReferences,
  type TargetSurface,
  type TaskType,
} from "@/lib/prompt/types";
import {
  createPromptReference,
  normalizePromptReferences,
} from "@/lib/prompt/references";
import { ControlHelp } from "./ControlHelp";

interface ReferencePanelProps {
  references: PromptReferences;
  targetSurface: TargetSurface;
  taskType: TaskType;
  fullPrompt: string;
  onChange: (references: PromptReferences) => void;
  onCopy: (value: string, label: string) => void;
}

type Operation = "imagine" | "describe" | "blend" | "video";

export function ReferencePanel({
  references,
  targetSurface,
  taskType,
  fullPrompt,
  onChange,
  onCopy,
}: ReferencePanelProps) {
  const [operation, setOperation] = useState<Operation>(taskType === "video" ? "video" : "imagine");
  const [error, setError] = useState("");
  const availableImages = useMemo(
    () =>
      [
        ...references.imagePrompts,
        ...references.styleReferences.filter((item) => item.valueType === "url"),
        references.omniReference,
        references.videoStart,
        references.videoEnd,
      ].filter((item): item is PromptReferenceAsset => Boolean(item)),
    [references],
  );

  function commit(next: PromptReferences) {
    const parsed = PromptReferencesSchema.safeParse(next);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "图片引用无效。");
      return false;
    }
    setError("");
    onChange(normalizePromptReferences(parsed.data));
    return true;
  }

  function addList(
    kind: "image_prompt" | "style_reference",
    value: string,
    valueType: "url" | "code",
  ) {
    const key = kind === "image_prompt" ? "imagePrompts" : "styleReferences";
    const items = references[key];
    commit({
      ...references,
      [key]: [...items, createPromptReference(kind, value, items.length, valueType)],
    });
  }

  function setSingle(kind: "omni_reference" | "video_start" | "video_end", value: string) {
    const key =
      kind === "omni_reference"
        ? "omniReference"
        : kind === "video_start"
          ? "videoStart"
          : "videoEnd";
    commit({
      ...references,
      [key]: value ? createPromptReference(kind, value) : null,
    });
  }

  function commandText(): string {
    if (operation === "describe") return "/describe";
    if (operation === "blend") return "/blend";
    return `/imagine prompt: ${fullPrompt}`.trim();
  }

  const blendCount = references.imagePrompts.length;
  const operationWarning =
    operation === "describe" && !availableImages.length
      ? "请先添加至少一张图片；Discord 中仍需手动上传附件。"
      : operation === "blend" && (blendCount < 2 || blendCount > 5)
        ? "Blend 需要选择 2–5 张普通图片，并在 Discord 中上传原文件。"
        : operation === "video" && !references.videoStart
          ? "视频操作需要一张起始帧。"
          : "";

  return (
    <section className="v2-reference-card">
      <div className="v2-section-heading">
        <div>
          <span>IMAGE REFERENCES</span>
          <h2>图片引用与指令助手</h2>
        </div>
        <small>仅管理在线 URL，不上传或代理图片</small>
      </div>

      {taskType === "image" ? (
        <div className="v2-reference-grid">
          <ReferenceList
            title="普通图片提示"
            description="影响内容、构图和色彩，URL 会放在 Prompt 开头。"
            items={references.imagePrompts}
            placeholder="https://example.com/image.jpg"
            onAdd={(value) => addList("image_prompt", value, "url")}
            onChange={(items) => commit({ ...references, imagePrompts: items })}
          />
          <ReferenceList
            title="Style Reference"
            description="输入 HTTPS 图片地址、数字代码或 random。"
            items={references.styleReferences}
            placeholder="https://example.com/style.png 或 123456"
            allowCode
            onAdd={(value, valueType) => addList("style_reference", value, valueType)}
            onChange={(items) => commit({ ...references, styleReferences: items })}
          />
          <SingleReference
            key={references.omniReference?.id ?? "empty-omni"}
            title="Omni Reference"
            description="仅 V7 支持，用于保持人物、物体或生物特征。"
            value={references.omniReference?.value ?? ""}
            placeholder="https://example.com/subject.webp"
            onSave={(value) => setSingle("omni_reference", value)}
          />
        </div>
      ) : (
        <div className="v2-reference-grid">
          <SingleReference
            key={references.videoStart?.id ?? "empty-video-start"}
            title="视频起始帧"
            description="必填；Discord Prompt 中放在最前面，Web 中作为 Starting Frame。"
            value={references.videoStart?.value ?? ""}
            placeholder="https://example.com/start.jpg"
            onSave={(value) => setSingle("video_start", value)}
          />
          <SingleReference
            key={references.videoEnd?.id ?? "empty-video-end"}
            title="视频结束帧"
            description="可选；序列化为 --end URL。与 Loop 同时使用会触发冲突提示。"
            value={references.videoEnd?.value ?? ""}
            placeholder="https://example.com/end.jpg"
            onSave={(value) => setSingle("video_end", value)}
          />
          <p className="v2-reference-note">
            视频分辨率需要在 Midjourney Web 的 More Options 中选择，不会写成 SD/HD Prompt 参数。
          </p>
        </div>
      )}

      {(error || operationWarning) && (
        <p className="v2-reference-error">{error || operationWarning}</p>
      )}

      <div className="v2-command-assistant">
        <div className="v2-command-tabs" role="tablist" aria-label="图片操作">
          {(["imagine", "describe", "blend", "video"] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={operation === item}
              className={operation === item ? "active" : ""}
              onClick={() => setOperation(item)}
            >
              {item === "imagine" ? "Imagine" : item === "describe" ? "Describe" : item === "blend" ? "Blend" : "Video"}
            </button>
          ))}
        </div>
        <div className="v2-command-output">
          <code>{commandText() || "生成 Prompt 后可复制指令。"}</code>
          <button
            type="button"
            disabled={Boolean(operationWarning) || !commandText()}
            onClick={() => onCopy(commandText(), `${operation} 指令`)}
          >
            <Copy size={15} />复制
          </button>
        </div>
        <p>
          {operation === "describe"
            ? "Describe 需要在 Discord 或 Web 中上传图片；URL 仅供你定位素材。"
            : operation === "blend"
              ? `已选择 ${blendCount} 张普通图片；Discord 使用 /blend 上传 2–5 张，Web 可使用多个无正文图片提示。`
              : operation === "video"
                ? "当前只生成可复制文本和操作指引，不代表已经向 Midjourney 创建视频任务。"
                : `${targetSurface === "web" ? "Web" : "Discord"} 完整 Prompt 会包含当前图片引用和规范化参数。`}
        </p>
      </div>
    </section>
  );
}

function ReferenceList({
  title,
  description,
  items,
  placeholder,
  allowCode = false,
  onAdd,
  onChange,
}: {
  title: string;
  description: string;
  items: PromptReferenceAsset[];
  placeholder: string;
  allowCode?: boolean;
  onAdd: (value: string, valueType: "url" | "code") => void;
  onChange: (items: PromptReferenceAsset[]) => void;
}) {
  const [value, setValue] = useState("");
  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next.map((item, order) => ({ ...item, order })));
  }
  return (
    <section className="v2-reference-group">
      <header>
        <strong>{title}</strong>
        <ControlHelp label={title}>{description}</ControlHelp>
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = value.trim();
          if (!trimmed) return;
          const valueType =
            allowCode && /^(?:random|\d{1,12})$/i.test(trimmed) ? "code" : "url";
          onAdd(trimmed, valueType);
          setValue("");
        }}
      >
        <input value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} />
        <button type="submit" aria-label={`添加${title}`}><Plus size={15} /></button>
      </form>
      <div className="v2-reference-items">
        {items.map((item, index) => (
          <article key={item.id}>
            {item.valueType === "url" ? (
              <img src={item.value} alt="" loading="lazy" referrerPolicy="no-referrer" />
            ) : (
              <ImageIcon size={20} />
            )}
            <span>{item.value}</span>
            <button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label="上移">
              <ArrowUp size={14} />
            </button>
            <button type="button" disabled={index === items.length - 1} onClick={() => move(index, 1)} aria-label="下移">
              <ArrowDown size={14} />
            </button>
            <button type="button" onClick={() => onChange(items.filter((entry) => entry.id !== item.id))} aria-label="删除">
              <Trash2 size={14} />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function SingleReference({
  title,
  description,
  value,
  placeholder,
  onSave,
}: {
  title: string;
  description: string;
  value: string;
  placeholder: string;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <section className="v2-reference-group">
      <header>
        <strong>{title}</strong>
        <ControlHelp label={title}>{description}</ControlHelp>
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft.trim());
        }}
      >
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={placeholder} />
        <button type="submit">{draft.trim() ? "应用" : "清除"}</button>
      </form>
      {value && (
        <article className="v2-single-preview">
          <img src={value} alt="" loading="lazy" referrerPolicy="no-referrer" />
          <span>{value}</span>
          <button type="button" onClick={() => { setDraft(""); onSave(""); }} aria-label="删除">
            <Trash2 size={14} />
          </button>
        </article>
      )}
    </section>
  );
}
