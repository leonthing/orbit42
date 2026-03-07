"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { useEffect, useCallback } from "react";
import TurndownService from "turndown";
import { marked } from "marked";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

interface TiptapEditorProps {
  content: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
}

function MenuButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors ${
        active
          ? "bg-navy-100 text-navy-700 dark:bg-navy-900 dark:text-navy-300"
          : "text-charcoal-600 hover:bg-charcoal-100 dark:text-charcoal-400 dark:hover:bg-charcoal-700"
      } disabled:opacity-30`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const addLink = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("URL을 입력하세요:");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  const addImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("이미지 URL을 입력하세요:");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-charcoal-200 px-3 py-2 dark:border-charcoal-700">
      {/* Text style */}
      <MenuButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        title="굵게"
      >
        <strong>B</strong>
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        title="기울임"
      >
        <em>I</em>
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive("strike")}
        title="취소선"
      >
        <s>S</s>
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive("code")}
        title="인라인 코드"
      >
        <span className="font-mono text-xs">&lt;/&gt;</span>
      </MenuButton>

      <div className="mx-1 h-5 w-px bg-charcoal-200 dark:bg-charcoal-700" />

      {/* Headings */}
      <MenuButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive("heading", { level: 1 })}
        title="제목 1"
      >
        <span className="text-xs font-bold">H1</span>
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
        title="제목 2"
      >
        <span className="text-xs font-bold">H2</span>
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })}
        title="제목 3"
      >
        <span className="text-xs font-bold">H3</span>
      </MenuButton>

      <div className="mx-1 h-5 w-px bg-charcoal-200 dark:bg-charcoal-700" />

      {/* Lists */}
      <MenuButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        title="목록"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
        </svg>
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        title="번호 목록"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.242 5.992h12m-12 6.003h12m-12 5.999h12M4.117 7.495v-3.75H2.99m1.125 3.75H2.99m1.125 0H5.24m-1.92 2.577a1.125 1.125 0 1 1 1.591 1.59l-1.83 1.83h2.16M2.99 15.745h1.125a1.125 1.125 0 0 1 0 2.25H3.74m0-.002h.375a1.125 1.125 0 0 1 0 2.25H2.99" />
        </svg>
      </MenuButton>

      <div className="mx-1 h-5 w-px bg-charcoal-200 dark:bg-charcoal-700" />

      {/* Block */}
      <MenuButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
        title="인용"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 0 1-3.5 3.5 3.871 3.871 0 0 1-2.748-1.179Zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 0 1-3.5 3.5 3.871 3.871 0 0 1-2.748-1.179Z" />
        </svg>
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive("codeBlock")}
        title="코드 블록"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
        </svg>
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="구분선"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5" />
        </svg>
      </MenuButton>

      <div className="mx-1 h-5 w-px bg-charcoal-200 dark:bg-charcoal-700" />

      {/* Link & Image */}
      <MenuButton
        onClick={addLink}
        active={editor.isActive("link")}
        title="링크"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
        </svg>
      </MenuButton>
      <MenuButton
        onClick={addImage}
        title="이미지"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 0 0 1.5-1.5V4.5a1.5 1.5 0 0 0-1.5-1.5H3.75a1.5 1.5 0 0 0-1.5 1.5v15a1.5 1.5 0 0 0 1.5 1.5Z" />
        </svg>
      </MenuButton>

      <div className="mx-1 h-5 w-px bg-charcoal-200 dark:bg-charcoal-700" />

      {/* Undo/Redo */}
      <MenuButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="되돌리기"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
        </svg>
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="다시 실행"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" />
        </svg>
      </MenuButton>
    </div>
  );
}

export function TiptapEditor({ content, onChange, placeholder }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-navy-600 underline dark:text-navy-400" },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          class: "rounded-lg max-w-full",
        },
      }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class:
          "prose prose-charcoal dark:prose-invert max-w-none px-4 py-3 min-h-[400px] focus:outline-none text-sm leading-relaxed",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const md = turndown.turndown(html);
      onChange(md);
    },
  });

  // Load initial markdown content
  useEffect(() => {
    if (editor && content) {
      const html = marked.parse(content, { async: false }) as string;
      editor.commands.setContent(html);
    }
  }, [editor]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!editor) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white dark:border-charcoal-600 dark:bg-charcoal-900/50">
      <Toolbar editor={editor} />
      <EditorContent
        editor={editor}
        placeholder={placeholder}
      />
    </div>
  );
}
