// components/plugins/notion-blog/utils/Text.jsx
import { Fragment } from 'react';

const decodeHtmlEntities = (text) => {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&hellip;/g, '…');
};

export default function Text({ title }) {
  if (!title) {
    return null;
  }
  return title.map((value, i) => {
    const {
      annotations: { bold, code, color, italic, strikethrough, underline },
      text,
    } = value;

    const decodedText = decodeHtmlEntities(text.content);

    return (
      <Fragment key={i}>
        <span
          className={[
            bold ? 'font-bold' : '',
            code ? 'bg-gray-100 dark:bg-gray-800 rounded-md px-1 py-0.5 font-mono text-sm' : '',
            italic ? 'italic' : '',
            strikethrough ? 'line-through' : '',
            underline ? 'underline' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={color !== 'default' ? { color } : {}}
        >
          {text.link ? (
            <a href={text.link.url} className="text-blue-500 hover:underline">
              {decodedText}
            </a>
          ) : (
            decodedText
          )}
        </span>
      </Fragment>
    );
  });
}
