import React, { useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Underline } from '@tiptap/extension-underline';
import { Superscript } from '@tiptap/extension-superscript';
import { Subscript } from '@tiptap/extension-subscript';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Subscript as SubscriptIcon, Superscript as SuperscriptIcon,
  Table as TableIcon, Trash2, Type
} from 'lucide-react';

// Custom FontSize Extension to preserve pasted fonts and allow exact sizing
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return { types: ['textStyle'] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: attributes => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize: fontSize => ({ chain }) => {
        return chain().setMark('textStyle', { fontSize }).run();
      },
      unsetFontSize: () => ({ chain }) => {
        return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run();
      },
    };
  },
});

interface RichTextEditorProps {
  value?: string;
  onChange: (value: string) => void;
  minHeight?: number;
  disabled?: boolean;
  className?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value = '',
  onChange,
  minHeight = 180,
  disabled = false,
  className = '',
}) => {
  const [isReady, setIsReady] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] }
      }),
      Underline,
      Superscript,
      Subscript,
      TextStyle,
      Color,
      FontSize,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onCreate: () => {
      setIsReady(true);
    }
  });

  // FOCUS-AWARE UPDATE LOOP FIX
  // Only forcibly update the editor's content from the external 'value' prop 
  // if the editor does NOT currently have focus. This prevents the cursor from 
  // jumping and formatting from resetting while the user is actively typing or clicking buttons.
  useEffect(() => {
    if (editor && editor.getHTML() !== value) {
      if (!editor.isFocused) {
        editor.commands.setContent(value, { emitUpdate: false });
      }
    }
  }, [value, editor]);

  if (!editor || !isReady) {
    return <div className="min-h-[180px] bg-slate-50 border border-slate-200 rounded-lg animate-pulse" />;
  }

  const btnClass = (isActive: boolean) =>
    `p-1.5 rounded text-slate-600 hover:bg-slate-200 transition-colors ${isActive ? 'bg-blue-100 text-blue-700 font-bold' : ''}`;

  return (
    <div className={`rich-text-editor-container bg-white border border-slate-300 rounded-lg overflow-hidden flex flex-col ${className}`}>
      <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-100 border-b border-slate-300 shadow-sm z-10">
        
        {/* Document Formatting */}
        <select
          disabled={disabled}
          className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 mx-1 cursor-pointer hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onChange={(event) => {
            const val = event.target.value;
            if (val === 'p') editor.chain().focus().setParagraph().run();
            else editor.chain().focus().toggleHeading({ level: parseInt(val) as any }).run();
            event.target.value = '';
          }}
          defaultValue=""
          title="Heading Style"
        >
          <option value="" disabled hidden>Style</option>
          <option value="p">Normal text</option>
          <option value="1">Heading 1</option>
          <option value="2">Heading 2</option>
          <option value="3">Heading 3</option>
        </select>

        {/* Font Size Dropdown */}
        <div className="relative flex items-center mx-1 bg-white border border-slate-300 rounded-md hover:border-slate-400">
          <div className="pl-2 pr-1 text-slate-400"><Type size={14} /></div>
          <select
            disabled={disabled}
            className="h-8 bg-transparent pr-2 text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none"
            onChange={(event) => {
              const val = event.target.value;
              if (val === 'default') {
                (editor.chain().focus() as any).unsetFontSize().run();
              } else {
                (editor.chain().focus() as any).setFontSize(val).run();
              }
              event.target.value = '';
            }}
            defaultValue=""
            title="Font Size"
          >
            <option value="" disabled hidden>Size</option>
            <option value="default">Default</option>
            <option value="8pt">8</option>
            <option value="9pt">9</option>
            <option value="10pt">10</option>
            <option value="11pt">11</option>
            <option value="12pt">12</option>
            <option value="14pt">14</option>
            <option value="16pt">16</option>
            <option value="18pt">18</option>
            <option value="20pt">20</option>
            <option value="24pt">24</option>
            <option value="30pt">30</option>
            <option value="36pt">36</option>
          </select>
        </div>

        <div className="w-px h-5 bg-slate-300 mx-1" />
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btnClass(editor.isActive('bold'))} title="Bold"><Bold size={16} /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btnClass(editor.isActive('italic'))} title="Italic"><Italic size={16} /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={btnClass(editor.isActive('underline'))} title="Underline"><UnderlineIcon size={16} /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={btnClass(editor.isActive('strike'))} title="Strikethrough"><Strikethrough size={16} /></button>
        
        <div className="w-px h-5 bg-slate-300 mx-1" />
        
        <button type="button" onClick={() => editor.chain().focus().setTextAlign('left').run()} className={btnClass(editor.isActive({ textAlign: 'left' }))} title="Align Left"><AlignLeft size={16} /></button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign('center').run()} className={btnClass(editor.isActive({ textAlign: 'center' }))} title="Align Center"><AlignCenter size={16} /></button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign('right').run()} className={btnClass(editor.isActive({ textAlign: 'right' }))} title="Align Right"><AlignRight size={16} /></button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign('justify').run()} className={btnClass(editor.isActive({ textAlign: 'justify' }))} title="Justify"><AlignJustify size={16} /></button>

        <div className="w-px h-5 bg-slate-300 mx-1" />

        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnClass(editor.isActive('bulletList'))} title="Bullet List"><List size={16} /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnClass(editor.isActive('orderedList'))} title="Ordered List"><ListOrdered size={16} /></button>

        <div className="w-px h-5 bg-slate-300 mx-1" />

        <button type="button" onClick={() => editor.chain().focus().toggleSubscript().run()} className={btnClass(editor.isActive('subscript'))} title="Subscript"><SubscriptIcon size={16} /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleSuperscript().run()} className={btnClass(editor.isActive('superscript'))} title="Superscript"><SuperscriptIcon size={16} /></button>

        <div className="w-px h-5 bg-slate-300 mx-1" />

        <button type="button" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} className={btnClass(false)} title="Insert Table"><TableIcon size={16} /></button>
        <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} className={btnClass(false)} title="Delete Table"><Trash2 size={16} className="text-red-500" /></button>
      </div>
      <div className="p-4 flex-grow overflow-auto" style={{ minHeight }}>
        <EditorContent editor={editor} className="prose max-w-none [&_.tiptap]:outline-none [&_.tiptap]:min-h-[150px] [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-slate-300 [&_td]:p-2 [&_th]:border [&_th]:border-slate-400 [&_th]:bg-slate-100 [&_th]:p-2 [&_th]:font-bold [&_p]:m-0 [&_ul]:pl-5 [&_ol]:pl-5 [&_li>p]:m-0" />
      </div>
    </div>
  );
};

export default RichTextEditor;
