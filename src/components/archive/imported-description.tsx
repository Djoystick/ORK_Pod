"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";

type ImportedDescriptionProps = {
  text: string;
};

type DescriptionBlock =
  | { kind: "paragraph"; lines: string[] }
  | { kind: "list"; items: string[] }
  | { kind: "links"; links: string[] };

const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/gi;
const URL_ONLY_PATTERN = /^https?:\/\/\S+$/i;
const LIST_LINE_PATTERN = /^(?:[-*\u2022]\s+|\d+[.)]\s+)/u;
const TIMESTAMP_LINE_PATTERN = /^(?:[-*\u2022]\s*)?(?:(?:\d{1,2}:)?\d{1,2}:\d{2})(?:\s*[-\u2013\u2014]\s*|\s+).+/u;
const SHOW_MORE_BLOCKS_THRESHOLD = 4;
const SHOW_MORE_CHAR_THRESHOLD = 900;

function normalizeIncomingDescription(raw: string) {
  let normalized = raw
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim();

  // Some older imported records have flattened line breaks.
  // We add conservative separators around URL/timestamp patterns for readable rendering.
  if (!normalized.includes("\n")) {
    normalized = normalized
      .replace(/\s*(https?:\/\/[^\s<>"'`]+)/gi, "\n$1\n")
      .replace(/\s+(?=(?:\d{1,2}:)?\d{1,2}:\d{2}\s*[-\u2013\u2014])/gu, "\n")
      .replace(/\s*[\u2022\u00b7]\s+/gu, "\n* ");
  }

  return normalized.replace(/\n{3,}/g, "\n\n").trim();
}

function toDisplayLabel(url: string) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${parsed.hostname}${path}`.slice(0, 90);
  } catch {
    return url.slice(0, 90);
  }
}

function buildDescriptionBlocks(raw: string): DescriptionBlock[] {
  const normalized = normalizeIncomingDescription(raw);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk): DescriptionBlock => {
      const lines = chunk
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length === 0) {
        return { kind: "paragraph", lines: [chunk] };
      }

      const urlOnlyCount = lines.filter((line) => URL_ONLY_PATTERN.test(line)).length;
      if (urlOnlyCount === lines.length && urlOnlyCount > 0) {
        return { kind: "links", links: lines };
      }

      const listLikeCount = lines.filter(
        (line) =>
          LIST_LINE_PATTERN.test(line) ||
          TIMESTAMP_LINE_PATTERN.test(line) ||
          URL_ONLY_PATTERN.test(line),
      ).length;
      if (lines.length > 1 && listLikeCount === lines.length) {
        return {
          kind: "list",
          items: lines.map((line) => line.replace(LIST_LINE_PATTERN, "").trim()),
        };
      }

      if (urlOnlyCount >= 2 && urlOnlyCount >= lines.length - 1) {
        return { kind: "links", links: lines.filter((line) => URL_ONLY_PATTERN.test(line)) };
      }

      return { kind: "paragraph", lines };
    });
}

function renderTextWithLinks(text: string) {
  const parts = text.split(URL_PATTERN);
  const links = text.match(URL_PATTERN) ?? [];
  const nodes: ReactNode[] = [];

  for (let index = 0; index < parts.length; index += 1) {
    if (parts[index]) {
      nodes.push(<span key={`text-${index}`}>{parts[index]}</span>);
    }

    const link = links[index];
    if (link) {
      nodes.push(
        <a
          key={`link-${index}`}
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-emerald-300 underline decoration-emerald-300/45 underline-offset-2 hover:text-emerald-200"
        >
          {link}
        </a>,
      );
    }
  }

  return nodes;
}

export function ImportedDescription({ text }: ImportedDescriptionProps) {
  const blocks = useMemo(() => buildDescriptionBlocks(text), [text]);
  const [expanded, setExpanded] = useState(false);

  if (blocks.length === 0) {
    return null;
  }

  const shouldCollapse =
    blocks.length > SHOW_MORE_BLOCKS_THRESHOLD ||
    normalizeIncomingDescription(text).length > SHOW_MORE_CHAR_THRESHOLD;
  const visibleBlocks =
    shouldCollapse && !expanded
      ? blocks.slice(0, SHOW_MORE_BLOCKS_THRESHOLD)
      : blocks;
  const hasHiddenBlocks = shouldCollapse && !expanded && visibleBlocks.length < blocks.length;
  const collapseByHeight = shouldCollapse && !expanded && !hasHiddenBlocks;

  return (
    <div className="space-y-3">
      <div className={collapseByHeight ? "relative max-h-80 overflow-hidden" : ""}>
        <div className="space-y-3">
          {visibleBlocks.map((block, blockIndex) => {
            if (block.kind === "paragraph") {
              const paragraph = block.lines.join("\n");
              return (
                <p
                  key={`paragraph-${blockIndex}`}
                  className="max-w-3xl whitespace-pre-line break-words text-zinc-300"
                >
                  {renderTextWithLinks(paragraph)}
                </p>
              );
            }

            if (block.kind === "list") {
              return (
                <ul
                  key={`list-${blockIndex}`}
                  className="max-w-3xl space-y-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-zinc-300"
                >
                  {block.items.map((item, itemIndex) => (
                    <li key={`list-item-${blockIndex}-${itemIndex}`} className="list-disc break-words">
                      {renderTextWithLinks(item)}
                    </li>
                  ))}
                </ul>
              );
            }

            return (
              <div
                key={`links-${blockIndex}`}
                className="max-w-3xl space-y-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
              >
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                  Ссылки из описания
                </p>
                <ul className="space-y-1">
                  {block.links.map((url, linkIndex) => (
                    <li key={`desc-link-${blockIndex}-${linkIndex}`}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-emerald-300 underline decoration-emerald-300/40 underline-offset-2 hover:text-emerald-200"
                      >
                        {toDisplayLabel(url)}
                      </a>
                      <p className="break-all text-xs text-zinc-500">{url}</p>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        {collapseByHeight ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#090d12] to-transparent" />
        ) : null}
      </div>

      {shouldCollapse ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="rounded-xl border border-white/20 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-emerald-300/45 hover:text-emerald-100"
        >
          {expanded ? "Свернуть описание" : "Показать полностью"}
        </button>
      ) : null}

      {hasHiddenBlocks ? (
        <p className="text-xs text-zinc-500">
          Показана сокращённая версия импортированного описания.
        </p>
      ) : null}
    </div>
  );
}
