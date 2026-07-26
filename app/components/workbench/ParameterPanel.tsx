"use client";

import { PARAMETER_REGISTRY } from "@/lib/prompt/parameter-registry";
import {
  filterUnsupportedParameters,
  parameterAvailability,
  supportedParameterOptions,
} from "@/lib/prompt/parameters";
import type {
  MidjourneyModel,
  PromptParameters,
  TargetSurface,
  TaskType,
} from "@/lib/prompt/types";
import { ControlHelp } from "./ControlHelp";
import {
  AspectRatioControl,
  NumberStepper,
  ParameterTokenEditor,
} from "./ParameterControls";

interface ParameterPanelProps {
  parameters: PromptParameters;
  negativeTokens: readonly string[];
  targetSurface: TargetSurface;
  taskType: TaskType;
  onParameters: (value: PromptParameters) => void;
  onNegativeTokens: (values: string[]) => void;
  onSurface: (value: TargetSurface) => void;
  onTask: (value: TaskType) => void;
}

export function ParameterPanel({
  parameters,
  negativeTokens,
  targetSurface,
  taskType,
  onParameters,
  onNegativeTokens,
  onSurface,
  onTask,
}: ParameterPanelProps) {
  function setValue(id: keyof PromptParameters, value: unknown) {
    const next = {
      ...parameters,
      [id]: value === "" || value === null || value === undefined ? undefined : value,
    };
    onParameters(
      id === "model"
        ? filterUnsupportedParameters(next, {
            targetSurface,
            taskType,
            model: (next.model ?? "8.2") as MidjourneyModel,
          })
        : next,
    );
  }
  const model = (parameters.model ?? "8.2") as MidjourneyModel;

  function clearUnavailable() {
    onParameters(
      filterUnsupportedParameters(parameters, {
        targetSurface,
        taskType,
        model,
      }),
    );
  }

  return (
    <aside className="v2-panel v2-parameters">
      <div className="v2-panel-title">
        <div>
          <span>PARAMETERS</span>
          <h2>参数面板</h2>
        </div>
      </div>
      <div className="v2-context-grid">
        <label data-tone="model">
          <span><b className="v2-param-name">入口</b><ControlHelp label="入口">决定参数按 Midjourney Web 还是 Discord 的规则进行校验。</ControlHelp></span>
          <select
            value={targetSurface}
            onChange={(e) => {
              const surface = e.target.value as TargetSurface;
              onParameters(
                filterUnsupportedParameters(parameters, {
                  targetSurface: surface,
                  taskType,
                  model,
                }),
              );
              onSurface(surface);
            }}
          >
            <option value="web">Midjourney Web</option>
            <option value="discord">Discord</option>
          </select>
        </label>
        <label data-tone="model">
          <span><b className="v2-param-name">任务</b><ControlHelp label="任务">图像与视频支持的引用和参数不同，切换后会立即重新校验。</ControlHelp></span>
          <select
            value={taskType}
            onChange={(e) => {
              const task = e.target.value as TaskType;
              onParameters(
                filterUnsupportedParameters(parameters, {
                  targetSurface,
                  taskType: task,
                  model,
                }),
              );
              onTask(task);
            }}
          >
            <option value="image">图像</option>
            <option value="video">视频</option>
          </select>
        </label>
      </div>
      <div className="v2-param-scroll">
        {PARAMETER_REGISTRY.map((definition) => {
          const value = parameters[definition.id];
          const availability = parameterAvailability(definition, {
            model,
            targetSurface,
            taskType,
          });
          const unavailable = !availability.supported;
          const contextualOptions = supportedParameterOptions(definition, model);
          const help = (
            <ControlHelp label={definition.label}>
              <strong>{definition.label}</strong>
              <span>{definition.description}</span>
              {availability.reason && (
                <span className="v2-param-help-unavailable">
                  当前不可用：{availability.reason}
                </span>
              )}
              {definition.rangeText && <span>范围：{definition.rangeText}</span>}
              {definition.min !== undefined && definition.max !== undefined && (
                <span>范围：{definition.min}–{definition.max}{definition.step ? `，步长 ${definition.step}` : ""}</span>
              )}
              {definition.defaultValue !== undefined && <span>默认：{String(definition.defaultValue)}</span>}
              {definition.modelNotes && <span>{definition.modelNotes}</span>}
              {definition.examples?.length && <span>示例：{definition.examples.join("、")}</span>}
              <a href={definition.docsUrl} target="_blank" rel="noreferrer">查看官方说明</a>
            </ControlHelp>
          );
          const label = (
            <span>
              <b className="v2-param-name">{definition.label}</b>
              <code>{definition.flag}</code>
              {unavailable && (
                <em className="v2-param-unavailable">不可用</em>
              )}
              {help}
            </span>
          );
          if (definition.valueType === "boolean") {
            return (
              <label
                className={`v2-toggle${unavailable ? " is-unavailable" : ""}`}
                data-tone={definition.uiTone}
                key={definition.id}
              >
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  disabled={unavailable}
                  onChange={(event) => setValue(definition.id, event.target.checked)}
                />
                <span className="v2-param-name">{definition.label}</span>
                <code>{definition.flag}</code>
                {help}
              </label>
            );
          }
          if (definition.id === "aspectRatio") {
            return (
              <label
                className={unavailable ? "is-unavailable" : ""}
                data-tone={definition.uiTone}
                key={definition.id}
              >
                {label}
                <AspectRatioControl
                  value={typeof value === "string" ? value : undefined}
                  disabled={unavailable}
                  onChange={(next) => setValue("aspectRatio", next)}
                />
              </label>
            );
          }
          if (definition.id === "no") {
            return (
              <div
                className={`v2-parameter-token-field${unavailable ? " is-unavailable" : ""}`}
                data-tone={definition.uiTone}
                key={definition.id}
              >
                {label}
                <ParameterTokenEditor
                  label={definition.label}
                  values={negativeTokens}
                  tone={definition.uiTone}
                  disabled={unavailable}
                  maxItems={50}
                  maxLength={500}
                  placeholder="输入排除对象，按 Enter 或逗号新增"
                  onChange={onNegativeTokens}
                />
              </div>
            );
          }
          if (definition.id === "profile") {
            return (
              <div
                className={`v2-parameter-token-field${unavailable ? " is-unavailable" : ""}`}
                data-tone={definition.uiTone}
                key={definition.id}
              >
                {label}
                <ParameterTokenEditor
                  label={definition.label}
                  values={parameters.profile ?? []}
                  tone={definition.uiTone}
                  disabled={unavailable}
                  maxItems={20}
                  maxLength={120}
                  splitWhitespaceOnPaste
                  placeholder="输入 Profile 或 Moodboard 代码"
                  onChange={(next) => setValue("profile", next.length ? next : undefined)}
                />
              </div>
            );
          }
          if (definition.valueType === "number") {
            const placeholder =
              definition.min !== undefined && definition.max !== undefined
                ? `范围 ${definition.min}–${definition.max}${
                    definition.defaultValue !== undefined
                      ? `，默认 ${String(definition.defaultValue)}`
                      : ""
                  }`
                : definition.rangeText ?? "";
            return (
              <label
                className={unavailable ? "is-unavailable" : ""}
                data-tone={definition.uiTone}
                key={definition.id}
              >
                {label}
                <NumberStepper
                  label={definition.label}
                  value={typeof value === "number" ? value : undefined}
                  min={definition.min}
                  max={definition.max}
                  step={definition.step}
                  defaultValue={definition.defaultValue}
                  options={contextualOptions}
                  disabled={unavailable}
                  placeholder={placeholder}
                  onChange={(next) => setValue(definition.id, next)}
                />
              </label>
            );
          }
          if (definition.valueType === "select") {
            return (
              <label
                className={unavailable ? "is-unavailable" : ""}
                data-tone={definition.uiTone}
                key={definition.id}
              >
                {label}
                <select
                  value={String(value ?? definition.defaultValue ?? "")}
                  disabled={unavailable}
                  onChange={(event) => {
                    const raw = event.target.value;
                    setValue(definition.id, raw);
                  }}
                >
                  <option value="">关闭</option>
                  {contextualOptions.map((option) => (
                    <option key={String(option)} value={String(option)}>
                      {String(option)}
                    </option>
                  ))}
                </select>
              </label>
            );
          }
          return (
            <label
              className={unavailable ? "is-unavailable" : ""}
              data-tone={definition.uiTone}
              key={definition.id}
            >
              {label}
              <input
                type="text"
                value={
                  Array.isArray(value)
                    ? value.join(", ")
                    : value === undefined
                      ? ""
                      : String(value)
                }
                disabled={unavailable}
                placeholder={
                  definition.valueType === "string-list"
                    ? "多个值用逗号分隔"
                    : definition.defaultValue !== undefined
                      ? String(definition.defaultValue)
                      : ""
                }
                onChange={(event) => {
                  const raw = event.target.value;
                  if (definition.valueType === "string-list") {
                    setValue(
                      definition.id,
                      raw
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    );
                  } else {
                    setValue(definition.id, raw);
                  }
                }}
              />
            </label>
          );
        })}
      </div>
      <button type="button" className="v2-clear-unavailable" onClick={clearUnavailable}>
        清除当前模型/任务不支持的参数
      </button>
      {taskType === "video" && (
        <p className="v2-video-resolution-note">
          视频 SD/HD 分辨率在 Midjourney Web 的 More Options 中设置，不会写入 Prompt。
        </p>
      )}
    </aside>
  );
}
