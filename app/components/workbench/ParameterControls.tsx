"use client";

import { Minus, Plus, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

import type { ParameterUiTone } from "@/lib/prompt/parameter-registry";

interface AspectRatioControlProps {
  value?: string;
  disabled?: boolean;
  onChange: (value: string | undefined) => void;
}

export function AspectRatioControl({
  value,
  disabled,
  onChange,
}: AspectRatioControlProps) {
  const initial = splitRatio(value);
  const [width, setWidth] = useState(initial[0]);
  const [height, setHeight] = useState(initial[1]);
  const editing = useRef(false);

  useEffect(() => {
    if (editing.current) return;
    const next = splitRatio(value);
    setWidth(next[0]);
    setHeight(next[1]);
  }, [value]);

  function update(side: "width" | "height", raw: string) {
    const nextValue = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    const nextWidth = side === "width" ? nextValue : width;
    const nextHeight = side === "height" ? nextValue : height;
    setWidth(nextWidth);
    setHeight(nextHeight);
    if (positiveInteger(nextWidth) && positiveInteger(nextHeight)) {
      onChange(`${nextWidth}:${nextHeight}`);
    } else {
      onChange(undefined);
    }
  }

  return (
    <div
      className="v2-aspect-control"
      aria-label="画面比例，宽比高"
      onFocus={() => {
        editing.current = true;
      }}
      onBlur={(event) => {
        if (
          event.currentTarget.contains(event.relatedTarget as Node | null)
        ) return;
        editing.current = false;
      }}
    >
      <input
        type="text"
        inputMode="numeric"
        pattern="[1-9][0-9]*"
        value={width}
        disabled={disabled}
        placeholder="宽"
        aria-label="画面比例宽度"
        onChange={(event) => update("width", event.target.value)}
      />
      <span aria-hidden="true">:</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[1-9][0-9]*"
        value={height}
        disabled={disabled}
        placeholder="高"
        aria-label="画面比例高度"
        onChange={(event) => update("height", event.target.value)}
      />
    </div>
  );
}

interface NumberStepperProps {
  label: string;
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: unknown;
  options?: readonly (string | number)[];
  disabled?: boolean;
  placeholder?: string;
  onChange: (value: number | undefined) => void;
}

export function NumberStepper({
  label,
  value,
  min,
  max,
  step = 1,
  defaultValue,
  options,
  disabled,
  placeholder,
  onChange,
}: NumberStepperProps) {
  const numericOptions = (options ?? [])
    .map(Number)
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  const atMin =
    value !== undefined &&
    (numericOptions.length
      ? value <= numericOptions[0]
      : min !== undefined && value <= min);
  const atMax =
    value !== undefined &&
    (numericOptions.length
      ? value >= numericOptions[numericOptions.length - 1]
      : max !== undefined && value >= max);

  function stepValue(direction: -1 | 1) {
    if (value === undefined) {
      const fallback =
        typeof defaultValue === "number"
          ? defaultValue
          : min ?? numericOptions[0] ?? 0;
      onChange(fallback);
      return;
    }
    if (numericOptions.length) {
      const next =
        direction > 0
          ? numericOptions.find((option) => option > value)
          : [...numericOptions].reverse().find((option) => option < value);
      if (next !== undefined) onChange(next);
      return;
    }
    onChange(roundStep(value + direction * step, step));
  }

  return (
    <div className="v2-number-stepper">
      <button
        type="button"
        disabled={disabled || atMin}
        aria-label={`减少${label}`}
        onClick={() => stepValue(-1)}
      >
        <Minus size={16} />
      </button>
      <input
        type="number"
        value={value ?? ""}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={label}
        onChange={(event) => {
          const raw = event.target.value;
          onChange(raw === "" ? undefined : Number(raw));
        }}
      />
      <button
        type="button"
        disabled={disabled || atMax}
        aria-label={`增加${label}`}
        onClick={() => stepValue(1)}
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

interface ParameterTokenEditorProps {
  label: string;
  values: readonly string[];
  tone: ParameterUiTone;
  disabled?: boolean;
  placeholder: string;
  maxItems: number;
  maxLength: number;
  splitWhitespaceOnPaste?: boolean;
  onChange: (values: string[]) => void;
}

export function ParameterTokenEditor({
  label,
  values,
  tone,
  disabled,
  placeholder,
  maxItems,
  maxLength,
  splitWhitespaceOnPaste,
  onChange,
}: ParameterTokenEditorProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [newValue, setNewValue] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const cancelEdit = useRef(false);

  useEffect(() => {
    if (editingIndex !== null) editRef.current?.focus();
  }, [editingIndex]);

  function commitValues(raw: string, fromPaste = false) {
    const candidates = splitValues(raw, fromPaste && Boolean(splitWhitespaceOnPaste));
    if (!candidates.length) return;
    const merged = dedupeValues([...values, ...candidates.map((item) => item.slice(0, maxLength))])
      .slice(0, maxItems);
    onChange(merged);
    setNewValue("");
  }

  function remove(index: number) {
    onChange(values.filter((_, current) => current !== index));
    setSelectedIndex(null);
    setEditingIndex(null);
  }

  function finishEditing(index: number) {
    const value = editingValue.trim().slice(0, maxLength);
    setEditingIndex(null);
    if (!value) return remove(index);
    const next = values.map((item, current) => (current === index ? value : item));
    onChange(dedupeValues(next));
  }

  function moveFocus(index: number, direction: -1 | 1) {
    const tokens = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>("[data-parameter-token]") ?? [],
    );
    tokens[index + direction]?.focus();
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text");
    if (!/[\s,，\n\r]/.test(pasted)) return;
    event.preventDefault();
    commitValues(pasted, true);
  }

  return (
    <div
      ref={listRef}
      className="v2-parameter-token-editor"
      data-tone={tone}
      role="listbox"
      aria-label={`${label}词块编辑器`}
      aria-disabled={disabled}
    >
      {values.map((value, index) => {
        const editing = editingIndex === index;
        const selected = selectedIndex === index;
        return (
          <div
            key={`${value}-${index}`}
            className={`v2-parameter-token${selected ? " is-selected" : ""}`}
            data-parameter-token={index}
            role="option"
            aria-selected={selected}
            tabIndex={disabled ? -1 : 0}
            onClick={() => setSelectedIndex(index)}
            onDoubleClick={() => {
              if (disabled) return;
              cancelEdit.current = false;
              setEditingIndex(index);
              setEditingValue(value);
            }}
            onKeyDown={(event) => {
              if (disabled || editing) return;
              if (event.key === "Enter") {
                event.preventDefault();
                cancelEdit.current = false;
                setEditingIndex(index);
                setEditingValue(value);
              } else if (event.key === "Delete" || event.key === "Backspace") {
                event.preventDefault();
                remove(index);
              } else if (event.key === "ArrowLeft") {
                event.preventDefault();
                moveFocus(index, -1);
              } else if (event.key === "ArrowRight") {
                event.preventDefault();
                moveFocus(index, 1);
              }
            }}
          >
            {editing ? (
              <input
                ref={editRef}
                value={editingValue}
                maxLength={maxLength}
                aria-label={`编辑${label}`}
                onChange={(event) => setEditingValue(event.target.value)}
                onBlur={() => {
                  if (cancelEdit.current) {
                    cancelEdit.current = false;
                    return;
                  }
                  finishEditing(index);
                }}
                onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                  event.stopPropagation();
                  if (event.key === "Enter") {
                    event.preventDefault();
                    finishEditing(index);
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    cancelEdit.current = true;
                    setEditingIndex(null);
                  }
                }}
              />
            ) : (
              <span>{value}</span>
            )}
            <button
              type="button"
              disabled={disabled}
              aria-label={`删除${label}词块 ${value}`}
              onClick={(event) => {
                event.stopPropagation();
                remove(index);
              }}
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
      <input
        className="v2-parameter-token-new"
        value={newValue}
        disabled={disabled || values.length >= maxItems}
        maxLength={maxLength}
        placeholder={values.length >= maxItems ? `最多 ${maxItems} 项` : placeholder}
        aria-label={`新增${label}`}
        onChange={(event) => setNewValue(event.target.value)}
        onPaste={handlePaste}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "," || event.key === "，") {
            event.preventDefault();
            commitValues(newValue);
          }
        }}
        onBlur={() => commitValues(newValue)}
      />
    </div>
  );
}

function splitRatio(value?: string): [string, string] {
  const match = value?.match(/^\s*(\d+)\s*:\s*(\d+)\s*$/);
  return match ? [match[1], match[2]] : ["", ""];
}

function positiveInteger(value: string): boolean {
  return /^[1-9]\d*$/.test(value);
}

function roundStep(value: number, step: number): number {
  const decimals = String(step).split(".")[1]?.length ?? 0;
  return Number(value.toFixed(decimals));
}

function splitValues(raw: string, splitWhitespace: boolean): string[] {
  const expression = splitWhitespace ? /[\s,，]+/ : /[\n\r,，]+/;
  return raw.split(expression).map((item) => item.trim()).filter(Boolean);
}

function dedupeValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
