"use client";

import {
  CircleAlert,
  Languages,
  LockKeyhole,
  RefreshCw,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

import { PROMPT_FIELD_LABELS } from "@/lib/prompt/blocks";
import type { PromptBlock } from "@/lib/prompt/types";

export type BlockTranslationStatus =
  | "pending-zh-en"
  | "pending-en-zh"
  | "failed-zh-en"
  | "failed-en-zh";

interface BilingualTokenEditorProps {
  blocks: PromptBlock[];
  translationStatuses: Readonly<Record<string, BlockTranslationStatus>>;
  onUpdate: (id: string, language: "zh" | "en", value: string) => void;
  onDelete: (id: string) => void;
  onAdd: (language: "zh" | "en", rawValue: string) => void;
  onRetry: (id: string, targetLanguage: "zh" | "en") => void;
  onResyncEnglish: (id: string) => void;
}

type Language = "zh" | "en";

export function BilingualTokenEditor({
  blocks,
  translationStatuses,
  onUpdate,
  onDelete,
  onAdd,
  onRetry,
  onResyncEnglish,
}: BilingualTokenEditorProps) {
  return (
    <div className="v2-bilingual-editor">
      <TokenLanguageEditor
        language="zh"
        label="中文描述"
        blocks={blocks}
        translationStatuses={translationStatuses}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onAdd={onAdd}
        onRetry={onRetry}
        onResyncEnglish={onResyncEnglish}
      />
      <TokenLanguageEditor
        language="en"
        label="英文正文"
        blocks={blocks}
        translationStatuses={translationStatuses}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onAdd={onAdd}
        onRetry={onRetry}
        onResyncEnglish={onResyncEnglish}
      />
    </div>
  );
}

function TokenLanguageEditor({
  language,
  label,
  blocks,
  translationStatuses,
  onUpdate,
  onDelete,
  onAdd,
  onRetry,
  onResyncEnglish,
}: BilingualTokenEditorProps & { language: Language; label: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [newValue, setNewValue] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const cancelEdit = useRef(false);

  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);

  function startEditing(block: PromptBlock) {
    cancelEdit.current = false;
    setSelectedId(block.id);
    setEditingId(block.id);
    setEditingValue(language === "zh" ? block.textZh : block.textEn);
  }

  function finishEditing(block: PromptBlock) {
    const value = editingValue.trim();
    setEditingId(null);
    if (!value) {
      onDelete(block.id);
      return;
    }
    onUpdate(block.id, language, value);
  }

  function moveFocus(currentId: string, direction: -1 | 1) {
    const tokens = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>("[data-prompt-token]") ?? [],
    );
    const index = tokens.findIndex((token) => token.dataset.promptToken === currentId);
    tokens[index + direction]?.focus();
  }

  function commitNewValue() {
    const value = newValue.trim();
    if (!value) return;
    onAdd(language, value);
    setNewValue("");
  }

  function handleNewKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === "," || event.key === "，") {
      event.preventDefault();
      commitNewValue();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const value = event.clipboardData.getData("text");
    if (!/[\n\r,，]|--[a-z]|https:\/\//i.test(value)) return;
    event.preventDefault();
    onAdd(language, value);
    setNewValue("");
  }

  return (
    <section className="v2-token-language" aria-label={label}>
      <header>
        <strong>{label}</strong>
        <small><Languages size={13} />按 Enter 或逗号新增词块</small>
      </header>
      <div
        ref={listRef}
        className="v2-token-editor"
        role="listbox"
        aria-label={`${label}词块编辑器`}
      >
        {blocks.map((block) => {
          const text = language === "zh" ? block.textZh : block.textEn;
          const status = translationStatuses[block.id];
          const pending =
            status === (language === "zh" ? "pending-en-zh" : "pending-zh-en");
          const failed =
            status === (language === "zh" ? "failed-en-zh" : "failed-zh-en");
          const isEditing = editingId === block.id;
          const isSelected = selectedId === block.id;
          const manualEnglish = language === "en" && block.textEnMode === "manual";
          return (
            <div
              key={`${language}-${block.id}`}
              className={`v2-prompt-token${isSelected ? " is-selected" : ""}${isEditing ? " is-editing" : ""}${!text ? " is-missing" : ""}`}
              data-field={block.field}
              data-prompt-token={block.id}
              role="option"
              aria-selected={isSelected}
              aria-label={`${PROMPT_FIELD_LABELS[block.field]}：${text || "待翻译"}`}
              tabIndex={0}
              onClick={() => setSelectedId(block.id)}
              onDoubleClick={() => startEditing(block)}
              onKeyDown={(event) => {
                if (isEditing) return;
                if (event.key === "Enter") {
                  event.preventDefault();
                  startEditing(block);
                } else if (event.key === "Delete" || event.key === "Backspace") {
                  event.preventDefault();
                  onDelete(block.id);
                } else if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  moveFocus(block.id, -1);
                } else if (event.key === "ArrowRight") {
                  event.preventDefault();
                  moveFocus(block.id, 1);
                }
              }}
            >
              <span className="v2-token-field">{PROMPT_FIELD_LABELS[block.field]}</span>
              {isEditing ? (
                <input
                  ref={editInputRef}
                  value={editingValue}
                  aria-label={`编辑${label}词块`}
                  onChange={(event) => setEditingValue(event.target.value)}
                  onBlur={() => {
                    if (cancelEdit.current) {
                      cancelEdit.current = false;
                      return;
                    }
                    finishEditing(block);
                  }}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Enter") {
                      event.preventDefault();
                      finishEditing(block);
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      cancelEdit.current = true;
                      setEditingId(null);
                    }
                  }}
                />
              ) : (
                <span className="v2-token-text">{text || "待翻译"}</span>
              )}
              {pending && <span className="v2-token-status">翻译中…</span>}
              {failed && (
                <button
                  type="button"
                  className="v2-token-retry"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRetry(block.id, language);
                  }}
                  aria-label={`重试${label}翻译`}
                >
                  <CircleAlert size={13} />重试
                </button>
              )}
              {manualEnglish && (
                <button
                  type="button"
                  className="v2-token-lock"
                  onClick={(event) => {
                    event.stopPropagation();
                    onResyncEnglish(block.id);
                  }}
                  aria-label="英文已手动修改，点击按中文重新翻译"
                >
                  <LockKeyhole size={12} />
                  <span>按中文重译</span>
                </button>
              )}
              {!text && !pending && !failed && (
                <button
                  type="button"
                  className="v2-token-retry"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRetry(block.id, language);
                  }}
                  aria-label={`补充${label}翻译`}
                >
                  <RefreshCw size={12} />翻译
                </button>
              )}
              <button
                type="button"
                className="v2-token-delete"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(block.id);
                }}
                aria-label={`删除${PROMPT_FIELD_LABELS[block.field]}双语词块`}
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
        <input
          className="v2-token-new"
          value={newValue}
          onChange={(event) => setNewValue(event.target.value)}
          onKeyDown={handleNewKeyDown}
          onPaste={handlePaste}
          placeholder={language === "zh" ? "输入中文词语…" : "Add English phrase…"}
          aria-label={`新增${label}词块`}
        />
      </div>
    </section>
  );
}
