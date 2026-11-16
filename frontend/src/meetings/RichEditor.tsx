import { useEffect, useRef } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { Image } from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { Highlight } from "@tiptap/extension-highlight";
import {
  Bold,
  Highlighter,
  ImagePlus,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Table2,
  Underline as UnderlineIcon,
  Undo2
} from "lucide-react";

/** Reduz prints/fotos para caber no estado do workspace (JPEG, até 1600px de largura). */
async function fileToDataUrl(file: File): Promise<string> {
  const original = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  if (file.type === "image/gif" || file.type === "image/svg+xml") {
    return original;
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = original;
  });

  const maxWidth = 1600;
  const scale = Math.min(1, maxWidth / image.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext("2d");

  if (!context) {
    return original;
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

function imageFilesFrom(list: FileList | DataTransferItemList | null | undefined): File[] {
  if (!list) {
    return [];
  }

  const files: File[] = [];

  for (const entry of Array.from(list as ArrayLike<File | DataTransferItem>)) {
    const file = entry instanceof File ? entry : (entry as DataTransferItem).kind === "file" ? (entry as DataTransferItem).getAsFile() : null;

    if (file && file.type.startsWith("image/")) {
      files.push(file);
    }
  }

  return files;
}

const extensions = (placeholder?: string) => [
  StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false } }),
  TextStyle,
  Color,
  Highlight.configure({ multicolor: false }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
  Image.configure({ allowBase64: true }),
  Placeholder.configure({ placeholder: placeholder ?? "Escreva aqui..." })
];

export function RichEditor({
  value,
  onChange,
  readOnly = false,
  placeholder
}: {
  value: string;
  onChange?: (html: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}) {
  const onChangeRef = useRef(onChange);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const editor = useEditor({
    extensions: extensions(placeholder),
    content: value,
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => onChangeRef.current?.(current.getHTML()),
    editorProps: {
      attributes: { class: "mt-prose" },
      handlePaste: (view, event) => {
        const files = imageFilesFrom(event.clipboardData?.items);

        if (!files.length) {
          return false;
        }

        event.preventDefault();
        void insertImages(files);
        return true;
      },
      handleDrop: (_view, event) => {
        const files = imageFilesFrom(event.dataTransfer?.files);

        if (!files.length) {
          return false;
        }

        event.preventDefault();
        void insertImages(files);
        return true;
      }
    }
  });

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  async function insertImages(files: File[]) {
    if (!editor) {
      return;
    }

    for (const file of files) {
      const src = await fileToDataUrl(file);
      editor.chain().focus().setImage({ src, alt: file.name }).run();
    }
  }

  if (!editor) {
    return <div className="mt-editor loading" />;
  }

  return (
    <div className={`mt-editor ${readOnly ? "readonly" : ""}`}>
      {!readOnly && (
        <Toolbar editor={editor} onPickImage={() => fileInput.current?.click()} />
      )}
      <EditorContent editor={editor} />
      <input
        accept="image/*"
        hidden
        multiple
        onChange={(event) => {
          void insertImages(imageFilesFrom(event.target.files));
          event.target.value = "";
        }}
        ref={fileInput}
        type="file"
      />
    </div>
  );
}

function Toolbar({ editor, onPickImage }: { editor: Editor; onPickImage: () => void }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      underline: current.isActive("underline"),
      strike: current.isActive("strike"),
      highlight: current.isActive("highlight"),
      bullet: current.isActive("bulletList"),
      ordered: current.isActive("orderedList"),
      task: current.isActive("taskList"),
      quote: current.isActive("blockquote"),
      inTable: current.isActive("table"),
      heading: current.isActive("heading", { level: 1 })
        ? "1"
        : current.isActive("heading", { level: 2 })
          ? "2"
          : current.isActive("heading", { level: 3 })
            ? "3"
            : "0",
      canUndo: current.can().undo(),
      canRedo: current.can().redo()
    })
  });

  const btn = (active: boolean, label: string, onClick: () => void, icon: React.ReactNode, disabled = false) => (
    <button
      aria-label={label}
      aria-pressed={active}
      className={`mt-tool ${active ? "active" : ""}`}
      disabled={disabled}
      onClick={onClick}
      onMouseDown={(event) => event.preventDefault()}
      title={label}
      type="button"
    >
      {icon}
    </button>
  );

  return (
    <div className="mt-toolbar" role="toolbar" aria-label="Formatação">
      <select
        aria-label="Estilo do texto"
        className="mt-tool-select"
        onChange={(event) => {
          const level = Number(event.target.value);
          const chain = editor.chain().focus();

          if (level === 0) {
            chain.setParagraph().run();
          } else {
            chain.setHeading({ level: level as 1 | 2 | 3 }).run();
          }
        }}
        value={state.heading}
      >
        <option value="0">Texto normal</option>
        <option value="1">Título 1</option>
        <option value="2">Título 2</option>
        <option value="3">Título 3</option>
      </select>

      {btn(state.bold, "Negrito", () => editor.chain().focus().toggleBold().run(), <Bold size={16} />)}
      {btn(state.italic, "Itálico", () => editor.chain().focus().toggleItalic().run(), <Italic size={16} />)}
      {btn(state.underline, "Sublinhado", () => editor.chain().focus().toggleUnderline().run(), <UnderlineIcon size={16} />)}
      {btn(state.strike, "Tachado", () => editor.chain().focus().toggleStrike().run(), <Strikethrough size={16} />)}
      {btn(state.highlight, "Destacar", () => editor.chain().focus().toggleHighlight().run(), <Highlighter size={16} />)}
      <label className="mt-tool color" title="Cor do texto">
        <span>A</span>
        <input
          aria-label="Cor do texto"
          onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
          type="color"
        />
      </label>

      <span className="mt-tool-sep" />

      {btn(state.bullet, "Lista", () => editor.chain().focus().toggleBulletList().run(), <List size={16} />)}
      {btn(state.ordered, "Lista numerada", () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered size={16} />)}
      {btn(state.task, "Checklist", () => editor.chain().focus().toggleTaskList().run(), <ListChecks size={16} />)}
      {btn(state.quote, "Citação", () => editor.chain().focus().toggleBlockquote().run(), <Quote size={16} />)}
      {btn(false, "Linha divisória", () => editor.chain().focus().setHorizontalRule().run(), <Minus size={16} />)}

      <span className="mt-tool-sep" />

      {btn(false, "Inserir tabela", () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), <Table2 size={16} />)}
      {btn(false, "Inserir imagem ou print", onPickImage, <ImagePlus size={16} />)}

      <span className="mt-tool-sep" />

      {btn(false, "Desfazer", () => editor.chain().focus().undo().run(), <Undo2 size={16} />, !state.canUndo)}
      {btn(false, "Refazer", () => editor.chain().focus().redo().run(), <Redo2 size={16} />, !state.canRedo)}

      {state.inTable && (
        <div className="mt-table-tools">
          <button onClick={() => editor.chain().focus().addRowAfter().run()} onMouseDown={(e) => e.preventDefault()} type="button">+ Linha</button>
          <button onClick={() => editor.chain().focus().addColumnAfter().run()} onMouseDown={(e) => e.preventDefault()} type="button">+ Coluna</button>
          <button onClick={() => editor.chain().focus().deleteRow().run()} onMouseDown={(e) => e.preventDefault()} type="button">− Linha</button>
          <button onClick={() => editor.chain().focus().deleteColumn().run()} onMouseDown={(e) => e.preventDefault()} type="button">− Coluna</button>
          <button className="danger" onClick={() => editor.chain().focus().deleteTable().run()} onMouseDown={(e) => e.preventDefault()} type="button">Excluir tabela</button>
        </div>
      )}
    </div>
  );
}
