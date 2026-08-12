// components/plugins/notion-blog/utils/Renderer.jsx
import { Fragment } from 'react';
import Link from 'next/link';
import ServerImage from './ServerImage';
import ServerAudio from './ServerAudio';

function decodeHtmlEntities(text) {
  if (!text) return '';

  const entities = {
    '&quot;': '"',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&nbsp;': ' ',
    '&#039;': "'",
    '&apos;': "'",
    '&#x2F;': '/',
    '&#x60;': '`',
    '&#x3D;': '=',
    '&mdash;': '—',
    '&ndash;': '–',
    '&hellip;': '…',
    '&#x2019;': "'",
    '&#x2018;': "'",
    '&#x201C;': '"',
    '&#x201D;': '"',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
    '&deg;': '°',
    '&plusmn;': '±',
    '&para;': '¶',
    '&sect;': '§',
    '&euro;': '€',
    '&pound;': '£',
    '&cent;': '¢',
    '&micro;': 'µ'
  };

  return text.replace(/&[#\w]+;/g, match => entities[match] || match);
}

export function renderRichText(richText) {
  if (!richText || !Array.isArray(richText)) {
    if (typeof richText === 'string') {
      const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      if (markdownLinkRegex.test(richText)) {
        const parts = [];
        let lastIndex = 0;
        let match;
        let i = 0;
        const tempText = richText;

        markdownLinkRegex.lastIndex = 0;

        while ((match = markdownLinkRegex.exec(tempText)) !== null) {
          if (match.index > lastIndex) {
            parts.push(
              <Fragment key={`text-${i}`}>
                {decodeHtmlEntities(tempText.substring(lastIndex, match.index))}
              </Fragment>
            );
            i++;
          }

          const linkText = match[1];
          const linkUrl = match[2];
          const isExternal = linkUrl.startsWith('http') || linkUrl.startsWith('mailto:') || linkUrl.startsWith('tel:');

          if (isExternal) {
            parts.push(
              <a
                key={`link-${i}`}
                href={linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline font-medium"
              >
                {decodeHtmlEntities(linkText)}
              </a>
            );
          } else {
            parts.push(
              <Link
                key={`link-${i}`}
                href={linkUrl}
                className="text-blue-400 hover:text-blue-300 underline font-medium"
              >
                {decodeHtmlEntities(linkText)}
              </Link>
            );
          }

          lastIndex = match.index + match[0].length;
          i++;
        }

        if (lastIndex < tempText.length) {
          parts.push(
            <Fragment key={`text-${i}`}>
              {decodeHtmlEntities(tempText.substring(lastIndex))}
            </Fragment>
          );
        }

        return parts;
      }

      return decodeHtmlEntities(richText);
    }
    return null;
  }

  return richText.map((text, index) => {
    if (!text) return null;

    if (typeof text === 'string') {
      return <Fragment key={index}>{decodeHtmlEntities(text)}</Fragment>;
    }

    let content = text.plain_text || text.content || '';
    content = decodeHtmlEntities(content);

    const annotations = text.annotations || {};
    const hasLink = text.href || text.url ||
                   (text.type === 'text' && text.text && text.text.link) ||
                   text.link ||
                   (text.type === 'mention' && text.mention);

    let styledText = <Fragment key={index}>{content}</Fragment>;

    if (annotations.bold) {
      styledText = <strong key={index} className="font-bold">{styledText}</strong>;
    }

    if (annotations.italic) {
      styledText = <em key={index} className="italic">{styledText}</em>;
    }

    if (annotations.strikethrough) {
      styledText = <s key={index} className="line-through">{styledText}</s>;
    }

    if (annotations.underline) {
      styledText = <u key={index} className="underline">{styledText}</u>;
    }

    if (annotations.code) {
      styledText = <code key={index} className="px-1 py-0.5 rounded text-sm font-mono">{styledText}</code>;
    }

    if (hasLink) {
      let href = '';

      if (text.href) {
        href = text.href;
      } else if (text.url) {
        href = text.url;
      } else if (text.type === 'text' && text.text && text.text.link) {
        href = text.text.link.url;
      } else if (text.link) {
        href = typeof text.link === 'string' ? text.link : text.link.url;
      } else if (text.type === 'mention' && text.mention) {
        if (text.mention.page) {
          href = `/page/${text.mention.page.id}`;
        } else if (text.mention.database) {
          href = `/database/${text.mention.database.id}`;
        } else if (text.mention.url) {
          href = text.mention.url;
        }
      }

      href = href || '#';

      const isExternal = href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:');

      if (isExternal) {
        return (
          <a key={index} href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline font-medium">
            {styledText}
          </a>
        );
      } else {
        return (
          <Link key={index} href={href} className="text-blue-400 hover:text-blue-300 underline font-medium">
            {styledText}
          </Link>
        );
      }
    }

    return styledText;
  });
}

export function renderBlock(block, blockClasses = null, textColor = null, isDark = null) {
  if (!block) return null;

  const { type, id } = block;

  // Use textColor if provided, otherwise default based on isDark flag
  // If neither provided, default to dark theme colors for backwards compatibility
  const baseTextColor = textColor || (isDark === false ? 'text-gray-700' : 'text-gray-300');
  const headingColor = textColor || (isDark === false ? 'text-gray-900' : 'text-white');
  const borderColor = isDark === false ? 'border-gray-300' : 'border-gray-700';
  const tableBorderColor = isDark === false ? 'border-gray-300' : 'border-gray-600';
  const tableHeaderBg = isDark === false ? 'bg-gray-100' : 'bg-gray-800';
  const tableHeaderText = isDark === false ? 'text-gray-900' : 'text-white';
  const calloutBg = isDark === false ? 'bg-gray-100' : 'bg-gray-800/30';
  const codeBg = isDark === false ? 'bg-gray-100' : 'bg-gray-800';
  const codeText = isDark === false ? 'text-gray-800' : 'text-gray-100';

  const classes = blockClasses ? blockClasses : {
    paragraph: `mb-4 ${baseTextColor}`,
    heading_1: `text-3xl font-bold mb-4 ${headingColor}`,
    heading_2: `text-2xl font-semibold mb-4 ${headingColor}`,
    heading_3: `text-xl font-medium mb-4 ${headingColor}`,
    bulleted_list_item: 'mb-2',
    numbered_list_item: 'mb-2',
    to_do: 'flex items-center mb-4',
    toggle: 'mb-4',
    child_page: 'childPage',
    image: 'mb-4',
    divider: `my-4 border-t ${borderColor}`,
    quote: `border-l-4 border-blue-500 pl-4 italic mb-4 break-words ${baseTextColor}`,
    file: 'file',
    bookmark: `${isDark === false ? 'text-blue-600' : 'text-blue-400'} underline mb-4 break-all`,
    table: `table-auto w-full border-collapse mb-4 border ${tableBorderColor}`,
    table_row: `border-b ${tableBorderColor}`,
    table_cell: `border-r ${tableBorderColor} p-3 ${baseTextColor}`,
    table_header: `border-r ${tableBorderColor} p-3 ${tableHeaderBg} font-semibold ${tableHeaderText}`,
    column_list: 'flex flex-col md:flex-row gap-4 mb-4',
    column: 'flex-1',
    unsupported: 'text-red-500',
    callout: `p-4 rounded-lg ${calloutBg} border ${borderColor} flex items-start gap-4 mb-4`,
    bulleted_list: `list-disc pl-5 mb-4 space-y-2 ${baseTextColor}`,
    numbered_list: `list-decimal pl-5 mb-4 space-y-2 ${baseTextColor}`,
    code: `${codeBg} rounded-lg p-4 mb-4 overflow-x-auto`,
    codeText: codeText,
  };

  const richText = block.text || block.rich_text || (Array.isArray(block.content) ? block.content : null);
  const content = typeof block.content === 'string' ? block.content : null;

  switch (type) {
    case 'bulleted_list':
      return (
        <ul className={`${classes.bulleted_list}`}>
          {block.children?.map((child, idx) => (
            <Fragment key={child.id || `bulleted-item-${idx}`}>
              {renderBlock(child, blockClasses, textColor, isDark)}
            </Fragment>
          ))}
        </ul>
      );

    case 'numbered_list':
      return (
        <ol className={`${classes.numbered_list}`}>
          {block.children?.map((child, idx) => (
            <Fragment key={child.id || `numbered-item-${idx}`}>
              {renderBlock(child, blockClasses, textColor, isDark)}
            </Fragment>
          ))}
        </ol>
      );

    case 'bulleted_list_item':
      return (
        <li className={`mb-2 ${baseTextColor}`}>
          <div className="flex items-start">
            <div className="flex-1">
              {richText ? renderRichText(richText) : decodeHtmlEntities(content)}
            </div>
          </div>
          {block.children?.length > 0 && (
            <ul className={`list-disc pl-5 mt-2 space-y-2 ${baseTextColor}`}>
              {block.children.map((child, idx) => (
                <Fragment key={child.id || `nested-bulleted-${idx}`}>
                  {renderBlock(child, blockClasses, textColor, isDark)}
                </Fragment>
              ))}
            </ul>
          )}
        </li>
      );

    case 'numbered_list_item':
      return (
        <li className={`mb-2 ${baseTextColor}`}>
          <div className="flex items-start">
            <div className="flex-1">
              {richText ? renderRichText(richText) : decodeHtmlEntities(content)}
            </div>
          </div>
          {block.children?.length > 0 && (
            <ol className={`list-decimal pl-5 mt-2 space-y-2 ${baseTextColor}`}>
              {block.children.map((child, idx) => (
                <Fragment key={child.id || `nested-numbered-${idx}`}>
                  {renderBlock(child, blockClasses, textColor, isDark)}
                </Fragment>
              ))}
            </ol>
          )}
        </li>
      );

    case 'paragraph':
      return (
        <p className={`${classes.paragraph}`}>
          {richText ? renderRichText(richText) : decodeHtmlEntities(content)}
        </p>
      );

    case 'heading_1':
      return (
        <h1 className={classes.heading_1}>
          {richText ? renderRichText(richText) : decodeHtmlEntities(content)}
        </h1>
      );

    case 'heading_2':
      return (
        <h2 className={classes.heading_2}>
          {richText ? renderRichText(richText) : decodeHtmlEntities(content)}
        </h2>
      );

    case 'heading_3':
      return (
        <h3 className={classes.heading_3}>
          {richText ? renderRichText(richText) : decodeHtmlEntities(content)}
        </h3>
      );

    case 'code':
      return (
        <pre className={classes.code}>
          <code className={classes.codeText}>
            {richText ? renderRichText(richText) : decodeHtmlEntities(content)}
          </code>
        </pre>
      );

    case 'to_do':
      return (
        <div className={`${classes.to_do} ${baseTextColor}`}>
          <label htmlFor={id} className="flex items-center">
            <input type="checkbox" id={id} defaultChecked={block.checked} className="mr-2 accent-blue-500" />
            {richText ? renderRichText(richText) : decodeHtmlEntities(content)}
          </label>
        </div>
      );

    case 'toggle':
      return (
        <details className={`${classes.toggle} ${baseTextColor}`}>
          <summary className="cursor-pointer font-medium">
            {richText ? renderRichText(richText) : decodeHtmlEntities(content)}
          </summary>
          <div className={`pl-4 mt-2 border-l ${borderColor}`}>
            {block.children?.map((child, idx) => (
              <Fragment key={child.id || `toggle-child-${idx}`}>
                {renderBlock(child, blockClasses, textColor, isDark)}
              </Fragment>
            ))}
          </div>
        </details>
      );

    case 'image':
      return (
        <figure className={classes.image}>
          <div className="relative w-full aspect-[16/9]">
            <ServerImage
              src={block.url || block.file?.url}
              alt={block.caption || ''}
              className="object-cover rounded-lg"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
          {block.caption && (
            <figcaption className="opacity-60 mt-2 text-sm">
              {typeof block.caption === 'string'
                ? decodeHtmlEntities(block.caption)
                : renderRichText(block.caption)}
            </figcaption>
          )}
        </figure>
      );

    case 'divider':
      return <hr className={classes.divider} key={id} />;

    case 'quote':
      return (
        <blockquote className={classes.quote} key={id}>
          {richText ? renderRichText(richText) : decodeHtmlEntities(content)}
        </blockquote>
      );

    case 'file':
      return (
        <figure className="mb-4">
          <div className={classes.file}>
            📎{' '}
            <Link href={block.url || block.file?.url} passHref className={classes.bookmark}>
              {block.name || 'File'}
            </Link>
          </div>
          {block.caption && (
            <figcaption className="opacity-60">
              {typeof block.caption === 'string'
                ? decodeHtmlEntities(block.caption)
                : renderRichText(block.caption)}
            </figcaption>
          )}
        </figure>
      );

    case 'bookmark':
      return (
        <a href={block.url} target="_blank" rel="noreferrer noopener" className={classes.bookmark}>
          {block.url}
        </a>
      );

    case 'table': {
      // Notion shape: block.table.has_column_header / has_row_header,
      // and table_row blocks live in block.children (populated by the
      // fetcher in core/databases/notion/index.js).
      // block.rows is a legacy / pre-shaped fallback we keep accepting.
      const tableHoverBg = isDark === false ? 'hover:bg-gray-50' : 'hover:bg-gray-800/30';
      const hasColumnHeader =
        block.table?.has_column_header ??
        block.has_column_header ??
        block.hasHeader ??
        false;

      // Coerce both legacy block.rows and the canonical block.children
      // (table_row blocks) into a unified [{ cells: [richText[]] }] shape.
      let rows = [];
      if (Array.isArray(block.rows) && block.rows.length > 0) {
        rows = block.rows.map((row) => ({
          cells: row.map((cell) => (typeof cell === 'string' ? cell : cell)),
        }));
      } else if (Array.isArray(block.children) && block.children.length > 0) {
        rows = block.children
          .filter((child) => child.type === 'table_row')
          .map((child) => ({ cells: child.table_row?.cells || child.cells || [] }));
      }

      if (rows.length === 0) {
        return (
          <div className="overflow-x-auto mb-6">
            <table className={classes.table}>
              <tbody>
                <tr>
                  <td className={classes.table_cell}>Empty table</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      }

      const renderCell = (cell, isHeader, key) => {
        const Element = isHeader ? 'th' : 'td';
        const cellClasses = isHeader ? classes.table_header : classes.table_cell;
        return (
          <Element key={key} className={cellClasses}>
            {Array.isArray(cell) ? renderRichText(cell) : decodeHtmlEntities(cell || '')}
          </Element>
        );
      };

      const headerRow = hasColumnHeader ? rows[0] : null;
      const bodyRows = hasColumnHeader ? rows.slice(1) : rows;

      return (
        <div className="overflow-x-auto mb-6">
          <table className={classes.table}>
            {headerRow && (
              <thead>
                <tr className={tableHeaderBg}>
                  {headerRow.cells.map((cell, ci) =>
                    renderCell(cell, true, `head-cell-${ci}`)
                  )}
                </tr>
              </thead>
            )}
            <tbody>
              {bodyRows.map((row, rIdx) => (
                <tr key={`row-${rIdx}`} className={`${classes.table_row} ${tableHoverBg}`}>
                  {row.cells.map((cell, ci) =>
                    renderCell(cell, false, `cell-${rIdx}-${ci}`)
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case 'table_row': {
      // Standalone table_row (rare — usually rendered through the parent
      // table case above). Kept for cases where the consumer renders rows
      // directly.
      const isHeaderRow = block.hasHeader || false;
      const cells = block.table_row?.cells || block.cells || [];
      const rowHoverBg = isDark === false ? 'hover:bg-gray-50' : 'hover:bg-gray-800/30';
      return (
        <tr className={`${classes.table_row} ${isHeaderRow ? tableHeaderBg : rowHoverBg}`}>
          {cells.map((cell, cellIndex) => {
            const Element = isHeaderRow ? 'th' : 'td';
            const cellClasses = isHeaderRow ? classes.table_header : classes.table_cell;
            return (
              <Element key={`cell-${cellIndex}`} className={cellClasses}>
                {Array.isArray(cell) ? renderRichText(cell) : decodeHtmlEntities(cell || '')}
              </Element>
            );
          })}
        </tr>
      );
    }

    case 'column_list':
      return (
        <div className={classes.column_list}>
          {block.children?.map((child, idx) => (
            <Fragment key={child.id || `column-${idx}`}>
              {renderBlock(child, blockClasses, textColor, isDark)}
            </Fragment>
          ))}
        </div>
      );

    case 'column':
      return (
        <div className={classes.column}>
          {block.children?.map((child, idx) => (
            <Fragment key={child.id || `column-content-${idx}`}>
              {renderBlock(child, blockClasses, textColor, isDark)}
            </Fragment>
          ))}
        </div>
      );

    case 'callout':
      return (
        <div className={`${classes.callout} ${baseTextColor}`} key={id}>
          <div className="text-2xl">{block.icon}</div>
          <div>
            {richText ? renderRichText(richText) : decodeHtmlEntities(content)}
            {block.children?.map((child, idx) => (
              <Fragment key={child.id || `callout-child-${idx}`}>
                {renderBlock(child, blockClasses, textColor, isDark)}
              </Fragment>
            ))}
          </div>
        </div>
      );

    case 'audio':
      const audioUrl = block.url || block.file?.url;
      return (
        <figure className="mb-6" key={id}>
          <ServerAudio src={audioUrl} preload="metadata" className="w-full" />
          {block.caption && (
            <figcaption className="text-sm text-center mt-2 opacity-60">
              {typeof block.caption === 'string'
                ? decodeHtmlEntities(block.caption)
                : renderRichText(block.caption)}
            </figcaption>
          )}
        </figure>
      );

    case 'video':
      const videoUrl = block.url || block.file?.url;

      if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
        const videoId = videoUrl.includes('youtu.be')
          ? videoUrl.split('youtu.be/')[1]
          : videoUrl.split('v=')[1]?.split('&')[0];

        return (
          <div className="w-full mb-4">
            <div className="relative w-full pt-[56.25%]">
              <iframe
                src={`https://www.youtube.com/embed/${videoId}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute top-0 left-0 w-full h-full rounded-lg"
              />
            </div>
          </div>
        );
      }

      return (
        <div className="w-full mb-4">
          <video controls src={videoUrl} className="w-full rounded-lg">
            Your browser does not support the video tag.
          </video>
        </div>
      );

    default:
      return (
        <div key={id} className={classes.unsupported}>
          ❌ Unsupported block ({type === 'unsupported' ? 'unsupported by Notion API' : type})
        </div>
      );
  }
}

export function renderNestedList(blocks) {
  if (!blocks) return null;
  const { type } = blocks;
  const value = blocks[type];
  if (!value) return null;

  const isNumberedList = value.children?.[0]?.type === 'numbered_list_item';

  if (isNumberedList) {
    return <ol className="list-decimal pl-5">{value.children.map((block) => renderBlock(block))}</ol>;
  }
  return <ul className="list-disc pl-5">{value.children.map((block) => renderBlock(block))}</ul>;
}
