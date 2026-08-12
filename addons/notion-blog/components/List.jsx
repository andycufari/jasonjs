// addons/notion-blog/components/List.jsx
import Link from 'next/link';
import dynamic from 'next/dynamic';
import ServerImage from '../utils/ServerImage';
import Share from '../utils/Share';

const VoteButton = dynamic(() => import('./VoteButton'), {
  loading: () => <div className="w-20" />
});

// Export metadata for SEO
export async function generateMetadata({ jcontext, database = 'data', header = {} }) {
  const { fetch_data = {} } = jcontext;
  const posts = fetch_data[database] || [];
  const { title: headerTitle = 'Blog', coverImage = null } = header;

  return {
    title: `${headerTitle} - ${jcontext?.site?.name || 'Latest Posts'}`,
    description: `Browse ${posts.length} articles and insights from our blog`,
    openGraph: {
      title: `${headerTitle} - ${jcontext?.site?.name || 'Blog'}`,
      description: `Explore our latest articles and insights`,
      type: 'website',
      images: coverImage ? [{ url: coverImage, width: 1200, height: 630 }] : []
    },
    twitter: {
      card: 'summary_large_image',
      title: `${headerTitle} - ${jcontext?.site?.name || 'Blog'}`,
      description: `Browse ${posts.length} articles from our blog`,
      images: coverImage ? [coverImage] : []
    }
  };
}

export default function List({ jcontext, ...attributes }) {
  const { fetch_data = {}, user } = jcontext;

  // New nested API with defaults - attributes come directly from JSON page
  const {
    database = 'data',
    postUrl = '/blog',
    layout = {},
    header = {},
    display = {},
    voting = {},
    share = {},
    styles = {},
    fields = {}
  } = attributes;

  // Layout options
  const {
    type: layoutType = 'list',
    columns = 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    gap = 'gap-6'
  } = layout;

  // Header options
  const {
    title: headerTitle = 'All Posts',
    backLink = null,
    backLabel = '← Back',
    coverImage = null
  } = header;

  // Display options
  const {
    showDate = true,
    showAuthor = true,
    showDescription = true,
    showImage = true,
    showCategory = false,
    excerptLength = null,
    dateFormat = 'short',
    locale = 'en-US',
    readMoreText = 'Read more →',
    categoryField = 'Category',
    defaultImage = null
  } = display;

  // Voting options
  const {
    enabled: votingEnabled = false,
    databaseId: votingDatabaseId = null,
    minToShow: voteMinToShow = 0,
    requireAuth: voteRequireAuth = false
  } = voting;

  // Share options
  const {
    enabled: shareEnabled = false,
    networks: shareNetworks = ['twitter', 'linkedin', 'whatsapp']
  } = share;

  // Styles with defaults
  const {
    container = 'max-w-6xl mx-auto px-4 py-8',
    card = 'rounded-lg shadow-md p-6 transition-all border border-gray-800',
    cardHover = 'hover:shadow-lg hover:-translate-y-1',
    title = 'text-xl font-bold text-white hover:text-primary',
    headerTitle: headerTitleStyle = 'text-2xl font-semibold text-gray-300 mb-6',
    description = 'text-gray-400 mt-2',
    date = 'text-sm text-gray-500',
    image = 'rounded-lg object-cover w-full h-full',
    imageContainer = 'w-24 h-24 flex-shrink-0 overflow-hidden',
    coverImageStyle = 'object-cover w-full',
    readMore = 'text-primary hover:underline font-medium',
    category = 'text-xs text-gray-500 uppercase tracking-wide mb-2',
    backLinkStyle = 'text-gray-400 hover:text-primary',
    // Grid-specific styles
    gridCard = 'border-t-2 border-gray-800 pt-6',
    gridCardHover = 'hover:opacity-80',
    gridTitle = 'text-xl font-bold hover:text-gray-400 transition-colors',
    gridDescription = 'text-gray-400 text-sm mt-3',
    gridDate = 'text-xs text-gray-500 uppercase tracking-wide',
    gridReadMore = 'text-xs font-bold uppercase tracking-wider hover:text-gray-400 mt-4 inline-block'
  } = styles;

  // Field mapping - Notion default field names
  const {
    titleField = 'Title',
    slugField = 'Slug',
    descriptionField = 'Description',
    authorField = 'Author',
    imageField = 'Image',
    dateField = 'Date',        // Notion Date property, falls back to updatedAt
    tagsField = 'Tags',
    languageField = 'Language'
  } = fields;

  const posts = fetch_data[database] || [];

  // Get current URL for sharing and structured data
  const currentUrl = jcontext?.url ||
    (jcontext?.domain && jcontext?.path
      ? `https://${jcontext.domain}${jcontext.path}`
      : '');

  // Prepare CollectionPage structured data (with ItemList for GEO/AI engines)
  const validPosts = Array.isArray(posts) ? posts.filter(p => p && p[slugField]) : [];
  const collectionLanguage = jcontext?.language || 'en';
  const baseUrl = currentUrl ? currentUrl.split('?')[0].replace(/\/$/, '') : '';

  const collectionPageData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": headerTitle,
    "description": `Collection of ${validPosts.length} blog posts`,
    "url": currentUrl || undefined,
    "inLanguage": collectionLanguage,
    "mainEntity": {
      "@type": "ItemList",
      "numberOfItems": validPosts.length,
      "itemListElement": validPosts.slice(0, 50).map((post, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "url": `${baseUrl}${postUrl}/${post[slugField]}`,
        "name": post[titleField] || post.Title || 'Untitled'
      }))
    }
  };
  Object.keys(collectionPageData).forEach(key =>
    collectionPageData[key] === undefined && delete collectionPageData[key]
  );

  const showVoting = votingEnabled && votingDatabaseId;
  const isGridLayout = layoutType === 'grid';

  // Date format options
  const dateFormats = {
    short: { month: 'short', day: '2-digit', year: 'numeric' },
    long: { month: 'long', day: 'numeric', year: 'numeric' },
    full: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
  };

  const formatDate = (post) => {
    // Try Date field first (Notion), then fall back to updatedAt/createdAt
    const dateString = post[dateField] || post.Date || post.updatedAt || post.createdAt;
    if (!dateString) return '';
    const dateObj = new Date(dateString);
    return dateObj.toLocaleString(locale, dateFormats[dateFormat] || dateFormats.short);
  };

  // Get post language for lang attribute (accessibility)
  const getPostLanguage = (post) => post[languageField] || post.Language || jcontext?.language || 'en';

  const getExcerpt = (text) => {
    if (!text) return '';
    if (!excerptLength || text.length <= excerptLength) return text;
    return text.substring(0, excerptLength).trim() + '...';
  };

  // Resolve a post's image with fallback to component default.
  // Returns { url, isDefault } so callers can adjust alt text / schema accordingly.
  const resolvePostImage = (post) => {
    const own = post[imageField] || post.cover || post.Image || null;
    if (own) return { url: own, isDefault: false };
    if (defaultImage) return { url: defaultImage, isDefault: true };
    return { url: null, isDefault: false };
  };

  // Generate BlogPosting structured data for individual posts
  const generatePostStructuredData = (post) => {
    const postTitle = post[titleField] || 'Untitled';
    const postDescription = post[descriptionField] || '';
    const { url: postImage } = resolvePostImage(post);
    const postDate = post[dateField] || post.Date || post.updatedAt || post.createdAt;
    const postAuthor = post[authorField] || post.Author || '';
    const postFullUrl = `${baseUrl}${postUrl}/${post[slugField]}`;

    const structuredData = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": postTitle,
      "description": postDescription,
      "url": postFullUrl,
      "datePublished": postDate ? new Date(postDate).toISOString() : undefined,
      "dateModified": post.updatedAt ? new Date(post.updatedAt).toISOString() : undefined,
      "author": postAuthor ? {
        "@type": "Person",
        "name": postAuthor
      } : undefined,
      "image": postImage ? {
        "@type": "ImageObject",
        "url": postImage
      } : undefined,
      "publisher": {
        "@type": "Organization",
        "name": jcontext?.site?.name || "Blog"
      }
    };

    // Remove undefined properties
    Object.keys(structuredData).forEach(key =>
      structuredData[key] === undefined && delete structuredData[key]
    );

    return structuredData;
  };

  // Active styles based on layout
  const activeCard = isGridLayout ? gridCard : card;
  const activeCardHover = isGridLayout ? gridCardHover : cardHover;
  const activeTitle = isGridLayout ? gridTitle : title;
  const activeDescription = isGridLayout ? gridDescription : description;
  const activeDate = isGridLayout ? gridDate : date;
  const activeReadMore = isGridLayout ? gridReadMore : readMore;
  const activeReadMoreText = isGridLayout ? 'MORE' : readMoreText;

  return (
    <div className="min-h-screen">
      {/* CollectionPage Structured Data for SEO & AI Engines (GEO) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(collectionPageData)
        }}
      />

      {coverImage && (
        <div className="relative h-48 md:h-64 w-full mb-8">
          <ServerImage
            src={coverImage}
            alt={headerTitle}
            className={coverImageStyle}
            priority={true}
            sizes="100vw"
          />
        </div>
      )}

      <section className={container}>
        {backLink && (
          <div className="mb-8 flex justify-between items-center">
            <Link href={backLink} className={backLinkStyle}>{backLabel}</Link>
            {shareEnabled && (
              <Share
                url={currentUrl}
                title={headerTitle}
                networks={shareNetworks}
              />
            )}
          </div>
        )}

        {headerTitle && (
          <h2 className={headerTitleStyle}>{headerTitle}</h2>
        )}

        {isGridLayout ? (
          <div className={`grid ${columns} ${gap}`}>
            {validPosts.map((post, index) => {
              const formattedDate = formatDate(post);
              const excerpt = getExcerpt(post[descriptionField]);
              const postLang = getPostLanguage(post);
              const postTitle = post[titleField] || 'Untitled';
              const { url: postImage, isDefault: postImageIsDefault } = resolvePostImage(post);

              return (
                <Link
                  href={`${postUrl}/${post[slugField]}`}
                  key={post.id || index}
                  className="block group"
                >
                  <article lang={postLang} className={`${activeCard} ${activeCardHover} transition-all h-full flex flex-col overflow-hidden`}>
                    {/* BlogPosting Structured Data for each post */}
                    <script
                      type="application/ld+json"
                      dangerouslySetInnerHTML={{
                        __html: JSON.stringify(generatePostStructuredData(post))
                      }}
                    />

                    {showCategory && post[categoryField] && (
                      <div className={category}>{post[categoryField]}</div>
                    )}

                    {showImage && postImage && (
                      <div className={`relative w-full mb-4 overflow-hidden rounded-t-lg ${imageContainer}`}>
                        <ServerImage
                          src={postImage}
                          alt={postImageIsDefault
                            ? postTitle
                            : `${postTitle} - ${excerpt ? excerpt.substring(0, 60) : 'Blog post image'}`}
                          className={`object-cover group-hover:scale-105 transition-transform duration-300 ${image}`}
                          priority={index < 4}
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                      </div>
                    )}

                    <div className="flex-1 flex flex-col p-4">
                      <h3 className={`${activeTitle} mb-3 group-hover:underline`}>
                        {postTitle}
                      </h3>

                      {showDescription && excerpt && (
                        <p className={`${activeDescription} mb-4 flex-1`}>{excerpt}</p>
                      )}

                      <div className="mt-auto">
                        {showDate && (
                          <time className={activeDate} dateTime={post[dateField]}>
                            {showAuthor && post[authorField] && <span>{post[authorField]} — </span>}
                            {formattedDate}
                          </time>
                        )}

                        <div className={`${activeReadMore} mt-2 inline-block`}>
                          {activeReadMoreText}
                        </div>
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        ) : (
          <ul className="space-y-6">
            {validPosts.map((post, index) => {
              const formattedDate = formatDate(post);
              const excerpt = getExcerpt(post[descriptionField]);
              const postLang = getPostLanguage(post);
              const postTitle = post[titleField] || 'Untitled';
              const { url: postImage, isDefault: postImageIsDefault } = resolvePostImage(post);

              return (
                <li key={post.id || index} lang={postLang}>
                  <Link href={`${postUrl}/${post[slugField]}`} className="block group">
                    <article className={`${activeCard} ${activeCardHover} transition-all`}>
                      {/* BlogPosting Structured Data for each post */}
                      <script
                        type="application/ld+json"
                        dangerouslySetInnerHTML={{
                          __html: JSON.stringify(generatePostStructuredData(post))
                        }}
                      />

                      <div className="flex gap-4">
                        {showVoting && (
                          <div className="flex items-center mr-2">
                            <VoteButton
                              postId={post.id}
                              initialVotes={post.Votes || 0}
                              userVote={post.UserVote}
                              databaseId={votingDatabaseId}
                              minVotesToShow={voteMinToShow}
                              user={user}
                            />
                          </div>
                        )}

                        {showImage && postImage && (
                          <div className={`relative ${imageContainer} overflow-hidden rounded-lg flex-shrink-0`}>
                            <ServerImage
                              src={postImage}
                              alt={postImageIsDefault
                                ? postTitle
                                : `${postTitle} - ${post[authorField] ? `by ${post[authorField]}` : 'Blog post'}`}
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                              priority={index < 3}
                              sizes="(max-width: 768px) 96px, 128px"
                            />
                          </div>
                        )}

                        <div className="flex-1">
                          {showCategory && post[categoryField] && (
                            <div className={category}>{post[categoryField]}</div>
                          )}

                          <h3 className={`${activeTitle} mb-2 group-hover:underline`}>
                            {postTitle}
                          </h3>

                          {showDescription && excerpt && (
                            <p className={`${activeDescription} mb-3`}>{excerpt}</p>
                          )}

                          {(showDate || showAuthor) && (
                            <p className={`${activeDate} mb-3`}>
                              {showAuthor && post[authorField] && (
                                <span className="italic">{post[authorField]}</span>
                              )}
                              {showDate && <span className="ml-2">{formattedDate}</span>}
                            </p>
                          )}

                          <div className={`${activeReadMore} inline-block`}>
                            {activeReadMoreText}
                          </div>
                        </div>
                      </div>
                    </article>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {backLink && (
          <div className="mb-8 mt-8 flex justify-between items-center">
            <Link href={backLink} className={backLinkStyle}>{backLabel}</Link>
            {shareEnabled && (
              <Share
                url={currentUrl}
                title={headerTitle}
                networks={shareNetworks}
              />
            )}
          </div>
        )}
      </section>
    </div>
  );
}
