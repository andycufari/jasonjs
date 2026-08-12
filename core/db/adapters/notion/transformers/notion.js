// studio/core/databases/transformers/notion.js
const decodeHtmlEntities = (text) => {
  if (!text) return '';
  
  const entities = {
    '&#039;': "'",
    '&quot;': '"',
    '&lt;': '<',
    '&gt;': '>', 
    '&amp;': '&',
    '&nbsp;': ' ',
    '&#x2F;': '/',
    '&#x60;': '`',
    '&#x3D;': '=',
    '&#x2019;': "'",
    '&#x201C;': '"',
    '&#x201D;': '"',
    '&#x2018;': "'",
    '&mdash;': '—',
    '&ndash;': '–',
    '&hellip;': '…'
  };

  return text.replace(/&[#\w]+;/g, match => entities[match] || match);
};

// Function to check if a URL is from Notion's secured sources
const isNotionSecuredUrl = (url) => {
  if (!url) return false;
  return url.includes('s3.us-west-2.amazonaws.com') || 
         url.includes('prod-files-secure.s3') || 
         url.includes('s3.amazonaws.com') ||
         url.includes('notion.so') ||
         url.includes('file.notion.so');
};

// Function to convert Notion URLs to proxy URLs for client access
const convertToProxyUrl = (url, mediaType = 'image') => {
  if (!url) return '';

  // First decode any HTML entities that might be in the URL
  const decodedUrl = url.replace(/&amp;/g, '&')
                        .replace(/&quot;/g, '"')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&#x2F;/g, '/');

  // If it's a Notion secured URL, convert to proxy URL
  if (isNotionSecuredUrl(decodedUrl)) {
    const proxyEndpoint = mediaType === 'audio' ? '/api/proxy/audio' : '/api/proxy/image';
    return `${proxyEndpoint}?url=${encodeURIComponent(decodedUrl)}`;
  }

  return decodedUrl;
};

// Function to ensure URLs are properly sanitized
const sanitizeUrl = (url, mediaType = 'image') => {
  if (!url) return '';

  // First decode any HTML entities
  let cleanUrl = decodeHtmlEntities(url);

  // Handle URL encoding issues (sometimes URLs come double-encoded)
  try {
    // Check if the URL contains percent-encoded characters that need decoding
    if (cleanUrl.includes('%')) {
      const decoded = decodeURIComponent(cleanUrl);
      // Only use the decoded version if it's substantially different (avoids decoding valid % chars)
      if (decoded.length < cleanUrl.length * 0.9) {
        cleanUrl = decoded;
      }
    }
  } catch (e) {
    // If decoding fails, keep the original URL
    console.warn('Error decoding URL:', e);
  }

  // Convert Notion URLs to proxy URLs
  return convertToProxyUrl(cleanUrl, mediaType);
};

const transformRichText = (richTextArr) => {
  if (!richTextArr || !Array.isArray(richTextArr)) return '';
  return decodeHtmlEntities(richTextArr.map(text => text.plain_text || '').join(''));
};

// Function to properly preserve rich text with links
const preserveRichText = (richTextArr) => {
  if (!richTextArr || !Array.isArray(richTextArr)) return [];
  
  return richTextArr.map(text => {
    // Create a simplified version of the rich text object that contains only needed properties
    const result = {
      content: text.plain_text || '',
      annotations: text.annotations || {},
    };
    
    // Preserve link information if present
    if (text.href || (text.type === 'text' && text.text?.link)) {
      result.href = text.href || text.text?.link?.url;
    }
    
    return result;
  });
};

const transformProperty = (property) => {
  if (!property) return null;

  switch (property.type) {
    case 'title':
    case 'rich_text':
      return transformRichText(property[property.type]);
    
    case 'select':
      return property.select?.name || null;
      
    case 'multi_select':
      return property.multi_select?.map(item => item.name) || [];
      
    case 'date':
      return property.date?.start || null;
      
    case 'files':
      // If it's a single file, return the first URL
      if (!property.files || property.files.length === 0) return null;
      if (property.files.length === 1) {
        const file = property.files[0];
        const fileUrl = file.type === 'external' ? file.external?.url : file.file?.url;
        if (!fileUrl) return null;
        // Detect media type based on file extension
        const isAudio = /\.(mp3|wav|ogg|m4a)(\?|$)/i.test(fileUrl);
        return sanitizeUrl(fileUrl, isAudio ? 'audio' : 'image');
      }
      // If multiple files, return array of URLs
      return property.files.map(file => {
        const fileUrl = file.type === 'external' ? file.external?.url : file.file?.url;
        if (!fileUrl) return null;
        // Detect media type based on file extension
        const isAudio = /\.(mp3|wav|ogg|m4a)(\?|$)/i.test(fileUrl);
        return sanitizeUrl(fileUrl, isAudio ? 'audio' : 'image');
      }).filter(Boolean);
      
    case 'number':
      return property.number;
      
    case 'checkbox':
      return property.checkbox;
      
    case 'url':
      return sanitizeUrl(property.url || ''); // Use sanitizeUrl for more thorough cleaning
      
    case 'email':
      return property.email;

    case 'relation':
      return property.relation?.map(rel => rel.id) || [];

    default:
      return null;
  }
};

const transformPage = (page) => {
  if (!page) return null;

  // Start with basic fields
  const transformed = {
    id: page.id,
    createdAt: page.created_time,
    updatedAt: page.last_edited_time
  };

  // Handle cover image (proxy Notion URLs to avoid signed URL expiration)
  if (page.cover) {
    const coverUrl = page.cover.type === 'external' ?
      page.cover.external?.url :
      page.cover.file?.url;
    transformed.cover = sanitizeUrl(coverUrl, 'image');
  }

  // Handle icon (proxy Notion URLs, pass through emojis)
  if (page.icon) {
    if (page.icon.type === 'emoji') {
      transformed.icon = page.icon.emoji;
    } else {
      const iconUrl = page.icon.type === 'external' ?
        page.icon.external?.url :
        page.icon.file?.url;
      transformed.icon = sanitizeUrl(iconUrl, 'image');
    }
  }

  // Transform all properties
  if (page.properties) {
    Object.entries(page.properties).forEach(([key, value]) => {
      transformed[key] = transformProperty(value);
    });
  }

  return transformed;
};


const transformBlock = (block) => {
  if (!block) return null;

  const base = {
    id: block.id,
    type: block.type,
    has_children: block.has_children
  };

  // Process rich text to preserve formatting and links
  const processRichText = (richTextArray) => {
    if (!richTextArray || !Array.isArray(richTextArray)) return [];
    
    return richTextArray.map(item => {
      const processed = {
        plain_text: item.plain_text || '',
        annotations: item.annotations || {
          bold: false,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          color: 'default'
        },
        type: item.type || 'text'
      };
      
      // Handle links - capture all possible link formats from Notion API
      if (item.href) {
        processed.href = item.href;
      } else if (item.type === 'text' && item.text && item.text.link) {
        processed.href = item.text.link.url;
      } else if (item.link) {
        processed.href = typeof item.link === 'string' ? item.link : item.link.url;
      } else if (item.url) {
        processed.href = item.url;
      }
      
      // If this is a mention with a url (like a page or database mention)
      if (item.type === 'mention' && item.mention) {
        if (item.mention.page) {
          processed.href = `/page/${item.mention.page.id}`;
        } else if (item.mention.database) {
          processed.href = `/database/${item.mention.database.id}`;
        } else if (item.mention.url) {
          processed.href = item.mention.url;
        }
      }
      
      return processed;
    });
  };

  const getContent = (block, field) => {
    const richText = block[field]?.rich_text;
    if (!richText) return '';
    const joined = richText.map(text => text.plain_text).join('');
    const decoded = decodeHtmlEntities(joined);
    return decoded;
  };

  let result;
  switch (block.type) {
    case 'paragraph':
      return {
        ...base,
        content: getContent(block, 'paragraph'),
        text: processRichText(block.paragraph?.rich_text)
      };

    case 'heading_1':
      return {
        ...base,
        content: getContent(block, 'heading_1'),
        text: processRichText(block.heading_1?.rich_text)
      };

    case 'heading_2':
      return {
        ...base,
        content: getContent(block, 'heading_2'),
        text: processRichText(block.heading_2?.rich_text)
      };

    case 'heading_3':
      return {
        ...base,
        content: getContent(block, 'heading_3'),
        text: processRichText(block.heading_3?.rich_text)
      };

    case 'bulleted_list_item':
      return {
        ...base,
        content: getContent(block, 'bulleted_list_item'),
        text: processRichText(block.bulleted_list_item?.rich_text),
        children: block.has_children ? block.children?.map(child => transformBlock(child)) : []
      };

    case 'numbered_list_item':
      return {
        ...base,
        content: getContent(block, 'numbered_list_item'),
        text: processRichText(block.numbered_list_item?.rich_text),
        children: block.has_children ? block.children?.map(child => transformBlock(child)) : []
      };

    case 'image': {
      const imgUrl = block.image?.type === 'external' ?
        block.image.external?.url :
        block.image?.file?.url;
      return {
        ...base,
        url: sanitizeUrl(imgUrl, 'image'),
        caption: block.image?.caption ?
          decodeHtmlEntities(block.image.caption.map(text => text.plain_text).join('')) : null
      };
    }

    case 'code':
      return {
        ...base,
        content: getContent(block, 'code'),
        text: processRichText(block.code?.rich_text),
        language: block.code?.language || 'plain text'
      };

    case 'quote':
      return {
        ...base,
        content: getContent(block, 'quote'),
        text: processRichText(block.quote?.rich_text)
      };

    case 'callout':
      return {
        ...base,
        content: getContent(block, 'callout'),
        text: processRichText(block.callout?.rich_text),
        icon: block.callout?.icon?.emoji || (block.callout?.icon?.type === 'external' ? block.callout.icon.external?.url : null)
      };

    case 'toggle':
      return {
        ...base,
        content: getContent(block, 'toggle'),
        text: processRichText(block.toggle?.rich_text),
        children: block.has_children ? block.children?.map(child => transformBlock(child)) : []
      };
      
    case 'table': {
      // Notion's API does NOT return rows inline on the table block. Each row
      // arrives as a separate `table_row` child block, which the fetcher
      // (core/databases/notion/index.js) populates into block.children.
      // Build the [ [cell richText[]] ] shape the renderer expects from there,
      // and pass block.rows through for legacy pre-shaped payloads.
      const tableRows = (block.table?.rows || block.children || [])
        .filter(row => row.type === 'table_row' || Array.isArray(row.cells))
        .map(row => (row.table_row?.cells || row.cells || []).map(cell => processRichText(cell)));

      return {
        ...base,
        rows: tableRows,
        hasHeader: block.table?.has_column_header || false
      };
    }

    case 'table_row':
      return {
        ...base,
        cells: (block.table_row?.cells || block.cells || []).map(cell => processRichText(cell))
      };
      
    case 'link_preview':
      return {
        ...base,
        url: block.link_preview?.url || ''
      };
      
    case 'bookmark':
      return {
        ...base,
        url: block.bookmark?.url || '',
        caption: processRichText(block.bookmark?.caption)
      };
      
    case 'file': {
      const fileUrl = block.file?.type === 'external'
        ? block.file.external?.url
        : block.file?.file?.url;
      return {
        ...base,
        url: sanitizeUrl(fileUrl),
        name: block.file?.caption ? block.file.caption.map(text => text.plain_text).join('') : 'File'
      };
    }

    case 'video': {
      const videoUrl = block.video?.type === 'external'
        ? block.video.external?.url
        : block.video?.file?.url;
      return {
        ...base,
        url: sanitizeUrl(videoUrl),
        caption: processRichText(block.video?.caption)
      };
    }

    case 'audio':
      const audioUrl = block.audio?.type === 'external'
        ? block.audio.external.url
        : block.audio?.file?.url;
      return {
        ...base,
        url: sanitizeUrl(audioUrl, 'audio'),
        caption: processRichText(block.audio?.caption)
      };

    case 'divider':
      return base;

    default:
      console.log(`Unsupported block type: ${block.type}`);
      return base;
  }
};

export const transformNotionData = (data, type = 'query') => {
  if (!data) return null;

  switch (type) {
    case 'query':
      // If it's not an array but we're expecting query results, wrap it
      const items = Array.isArray(data) ? data : [data];
      return items.map(page => transformPage(page));

    case 'page':
      // If we're getting a single page, don't expect blocks
      if (!data.blocks) {
        return transformPage(data);
      }
      // Otherwise, return page with blocks
      return {
        ...transformPage(data.page),
        blocks: data.blocks.map(block => transformBlock(block))
      };

    case 'create':
      // Handle single page response from create operation
      return transformPage(data);

    default:
      return data;
  }
};