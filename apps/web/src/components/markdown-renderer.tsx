"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

type MarkdownRendererProps = {
  content: string;
  className?: string;
};

export const MarkdownRenderer = memo(function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn("prose-fusion", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
});

const components = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mt-4 mb-2 text-lg font-semibold text-foreground first:mt-0">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mt-3.5 mb-2 text-base font-semibold text-foreground first:mt-0">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mt-3 mb-1.5 text-sm font-semibold text-foreground first:mt-0">{children}</h3>
  ),
  h4: ({ children }: { children?: React.ReactNode }) => (
    <h4 className="mt-2.5 mb-1 text-sm font-medium text-foreground first:mt-0">{children}</h4>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="my-2 text-sm leading-6 text-foreground first:mt-0 last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="my-2 ml-4 list-disc space-y-1 text-sm leading-6 text-foreground">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="my-2 ml-4 list-decimal space-y-1 text-sm leading-6 text-foreground">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => <li className="pl-1">{children}</li>,
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => <em className="italic text-foreground">{children}</em>,
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground">{children}</code>
      );
    }
    return (
      <code className={cn("block font-mono text-[13px]", className)}>{children}</code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="my-3 overflow-x-auto rounded-lg border border-border bg-muted/50 p-3 text-[13px] leading-5 text-foreground">
      {children}
    </pre>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-2 border-l-2 border-primary/40 pl-3 text-sm italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:text-primary/80"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-4 border-border" />,
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="border-b border-border">{children}</thead>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-3 py-1.5 text-left font-semibold text-foreground">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border-t border-border px-3 py-1.5 text-foreground">{children}</td>
  ),
} as const;