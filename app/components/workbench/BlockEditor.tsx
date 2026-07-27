"use client";

import { useDndContext, useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";

import {
  PROMPT_FIELD_LABELS,
  createPromptBlock,
  orderedBlocks,
} from "@/lib/prompt/blocks";
import {
  PROMPT_BLOCK_FIELD_ORDER,
  type PromptBlock,
  type PromptBlockField,
} from "@/lib/prompt/types";

interface BlockEditorProps {
  blocks: PromptBlock[];
  bilingualSyncEnabled: boolean;
  onChange: (blocks: PromptBlock[]) => void;
}

export function BlockEditor({
  blocks,
  bilingualSyncEnabled,
  onChange,
}: BlockEditorProps) {
  function add(field: PromptBlockField) {
    const order = orderedBlocks(blocks, field).length;
    onChange([...blocks, createPromptBlock(field, "", "", "user", order)]);
  }

  return (
      <div className="v2-block-groups">
        {PROMPT_BLOCK_FIELD_ORDER.map((field) => (
          <BlockGroup
            key={field}
            field={field}
            blocks={orderedBlocks(blocks, field)}
            onAdd={() => add(field)}
            onUpdate={(id, patch) =>
              onChange(blocks.map((block) => (block.id === id ? { ...block, ...patch } : block)))
            }
            bilingualSyncEnabled={bilingualSyncEnabled}
            onDelete={(id) => onChange(blocks.filter((block) => block.id !== id))}
          />
        ))}
      </div>
  );
}

interface BlockGroupProps {
  field: PromptBlockField;
  blocks: PromptBlock[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<PromptBlock>) => void;
  onDelete: (id: string) => void;
  bilingualSyncEnabled: boolean;
}

function BlockGroup({
  field,
  blocks,
  onAdd,
  onUpdate,
  onDelete,
  bilingualSyncEnabled,
}: BlockGroupProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `group-${field}`,
    data: { type: "group", field },
  });
  const { active, over } = useDndContext();
  const isPhraseOverGroup =
    active?.data.current?.type === "phrase" &&
    over?.data.current?.field === field;
  return (
    <section
      ref={setNodeRef}
      className={`v2-block-group${isOver || isPhraseOverGroup ? " is-over" : ""}`}
      data-field={field}
      aria-label={PROMPT_FIELD_LABELS[field]}
    >
      <header>
        <span className="v2-block-title">{PROMPT_FIELD_LABELS[field]}</span>
        <small className="v2-block-count">{blocks.length} 个词块</small>
        <button type="button" onClick={onAdd} aria-label={`添加${PROMPT_FIELD_LABELS[field]}词块`}>
          <Plus size={14} />
        </button>
      </header>
      <SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
        <div className="v2-block-list">
          {blocks.map((block) => (
            <SortableBlock
              key={block.id}
              block={block}
              bilingualSyncEnabled={bilingualSyncEnabled}
              onUpdate={(patch) => onUpdate(block.id, patch)}
              onDelete={() => onDelete(block.id)}
            />
          ))}
          {!blocks.length && (
            <button type="button" className="v2-empty-drop" onClick={onAdd}>
              点击新增，或将常用词/其他词块拖入此分组
            </button>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

function SortableBlock({
  block,
  bilingualSyncEnabled,
  onUpdate,
  onDelete,
}: {
  block: PromptBlock;
  bilingualSyncEnabled: boolean;
  onUpdate: (patch: Partial<PromptBlock>) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    data: { type: "block", field: block.field },
  });
  return (
    <article
      ref={setNodeRef}
      className={`v2-block${isDragging ? " is-dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        type="button"
        className="v2-drag-handle"
        aria-label={`拖动${PROMPT_FIELD_LABELS[block.field]}词块`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={15} />
      </button>
      <div className="v2-block-inputs">
        <input
          value={block.textZh}
          onChange={(event) =>
            onUpdate({
              textZh: event.target.value,
              ...(bilingualSyncEnabled && block.textEnMode === "auto"
                ? { textEn: "" }
                : {}),
            })
          }
          placeholder="中文词块"
          aria-label={`${PROMPT_FIELD_LABELS[block.field]}中文`}
        />
        <input
          value={block.textEn}
          onChange={(event) =>
            onUpdate({ textEn: event.target.value, textEnMode: "manual" })
          }
          placeholder="English block"
          aria-label={`${PROMPT_FIELD_LABELS[block.field]}英文`}
        />
      </div>
      <button type="button" className="v2-delete-block" onClick={onDelete} aria-label="删除词块">
        <Trash2 size={14} />
      </button>
    </article>
  );
}
