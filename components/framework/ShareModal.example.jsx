/**
 * ShareModal Usage Examples
 *
 * The ShareModal is a beautiful, themable component for sharing content
 * across different platforms. It automatically uses native sharing on mobile
 * and shows a rich modal on desktop.
 */

'use client';
import { useState } from 'react';
import ShareModal from './ShareModal';
import { useShare } from '@/core/hooks/useShare';
import { Share2 } from 'lucide-react';

// Example 1: Basic usage with hook (Recommended)
// Auto-detects language from Next.js or browser
export function Example1_BasicUsage() {
  const { shareIsOpen, openShare, closeShare, shareProps } = useShare();

  return (
    <div>
      <button onClick={() => openShare({
        title: 'Check this out!',  // Shows in header
        text: 'Amazing content you should see'  // Shows in body
      })}>
        Share Current Page
      </button>

      <ShareModal
        isOpen={shareIsOpen}
        onClose={closeShare}
        {...shareProps}
      />
    </div>
  );
}

// Example 2: Share specific URL with custom content
export function Example2_CustomContent() {
  const { shareIsOpen, openShare, closeShare, shareProps } = useShare();

  return (
    <div>
      <button
        onClick={() => openShare({
          url: 'https://example.com/my-awesome-article',
          title: 'Check out this amazing article!',
          text: 'I thought you might find this interesting',
          options: {
            showSocialButtons: true,
            // Available networks: 'x', 'twitter', 'facebook', 'linkedin', 'whatsapp',
            // 'telegram', 'reddit', 'instagram', 'tiktok', 'pinterest', 'email', 'sms', 'copy'
            socialNetworks: ['x', 'linkedin', 'email']
          }
        })}
      >
        Share Article
      </button>

      <ShareModal
        isOpen={shareIsOpen}
        onClose={closeShare}
        {...shareProps}
      />
    </div>
  );
}

// Example 3: Manual state management (without hook)
export function Example3_ManualState() {
  const [showShare, setShowShare] = useState(false);

  return (
    <div>
      <button onClick={() => setShowShare(true)}>
        <Share2 className="w-4 h-4 mr-2" />
        Share
      </button>

      <ShareModal
        url="https://mysite.com/product/123"
        title="Amazing Product"
        text="Check out this product I found!"
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        options={{
          showSocialButtons: true,
          copyButtonText: 'Copy Product Link',
          copiedButtonText: 'Link Copied!'
        }}
      />
    </div>
  );
}

// Example 4: Product/Content sharing
export function Example4_ProductShare({ product }) {
  const { shareIsOpen, openShare, closeShare, shareProps } = useShare();

  return (
    <div className="product-card">
      <img src={product.image} alt={product.name} />
      <h3>{product.name}</h3>
      <p>{product.description}</p>

      <button
        onClick={() => openShare({
          url: `https://mystore.com/products/${product.slug}`,
          title: `${product.name} - Only $${product.price}`,
          text: product.description,
          options: {
            socialNetworks: ['whatsapp', 'facebook', 'x', 'pinterest', 'email']
          }
        })}
        className="share-button"
      >
        <Share2 className="w-4 h-4" />
        Share Product
      </button>

      <ShareModal isOpen={shareIsOpen} onClose={closeShare} {...shareProps} />
    </div>
  );
}

// Example 5: Blog post sharing
export function Example5_BlogShare({ post }) {
  const { shareIsOpen, openShare, closeShare, shareProps } = useShare();

  const handleShare = () => {
    openShare({
      url: `https://myblog.com/posts/${post.slug}`,
      title: post.title,
      text: post.excerpt,
      options: {
        showSocialButtons: true,
        socialNetworks: ['x', 'linkedin', 'reddit', 'facebook', 'email']
      }
    });
  };

  return (
    <article>
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />

      <div className="post-actions">
        <button onClick={handleShare} className="share-btn">
          Share this post
        </button>
      </div>

      <ShareModal isOpen={shareIsOpen} onClose={closeShare} {...shareProps} />
    </article>
  );
}

// Example 5b: All available social networks
export function Example5b_AllNetworks() {
  const { shareIsOpen, openShare, closeShare, shareProps } = useShare();

  return (
    <div>
      <button
        onClick={() => openShare({
          url: 'https://example.com',
          title: 'Amazing Content',
          text: 'Check this out!',
          options: {
            showSocialButtons: true,
            // All available networks:
            socialNetworks: [
              'x',          // X (Twitter)
              'facebook',   // Facebook
              'linkedin',   // LinkedIn
              'whatsapp',   // WhatsApp
              'telegram',   // Telegram
              'reddit',     // Reddit
              'instagram',  // Instagram (copies link)
              'tiktok',     // TikTok (copies link)
              'pinterest',  // Pinterest
              'email',      // Email
              'sms',        // SMS
              'copy'        // Copy link
            ]
          }
        })}
      >
        Share Everywhere
      </button>

      <ShareModal isOpen={shareIsOpen} onClose={closeShare} {...shareProps} />
    </div>
  );
}

// Example 5c: Custom translations (Spanish)
export function Example5c_CustomTranslations() {
  const { shareIsOpen, openShare, closeShare, shareProps } = useShare();

  return (
    <div>
      <button
        onClick={() => openShare({
          title: 'Mira esto!',
          text: 'Contenido increíble que deberías ver',
          options: {
            translations: {
              share: 'Compartir',
              copyLink: 'Copiar enlace',
              copy: 'Copiar',
              copied: '¡Copiado!',
              shareVia: 'Compartir en',
              moreOptions: 'Más opciones'
            }
          }
        })}
      >
        Compartir
      </button>

      <ShareModal isOpen={shareIsOpen} onClose={closeShare} {...shareProps} />
    </div>
  );
}

// Example 5d: Custom translations (Portuguese)
export function Example5d_Portuguese() {
  const { shareIsOpen, openShare, closeShare, shareProps } = useShare();

  return (
    <div>
      <button
        onClick={() => openShare({
          title: 'Confira isso!',
          text: 'Conteúdo incrível que você deveria ver',
          options: {
            translations: {
              share: 'Compartilhar',
              copyLink: 'Copiar link',
              copy: 'Copiar',
              copied: 'Copiado!',
              shareVia: 'Compartilhar via',
              moreOptions: 'Mais opções'
            }
          }
        })}
      >
        Compartilhar
      </button>

      <ShareModal isOpen={shareIsOpen} onClose={closeShare} {...shareProps} />
    </div>
  );
}

// Example 6: Using in JSON page configuration
export const jsonPageExample = {
  component: 'div',
  attributes: { className: 'page' },
  components: [
    {
      component: '@framework/ShareButton',
      attributes: {
        url: '{{page.url}}',
        title: '{{page.title}}',
        text: '{{page.description}}'
      }
    }
  ]
};

// Example 7: Share button component wrapper
export function ShareButton({ url, title, text, options, children, ...props }) {
  const { shareIsOpen, openShare, closeShare, shareProps } = useShare();

  return (
    <>
      <button
        {...props}
        onClick={() => openShare({ url, title, text, options })}
      >
        {children || (
          <>
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </>
        )}
      </button>

      <ShareModal isOpen={shareIsOpen} onClose={closeShare} {...shareProps} />
    </>
  );
}

// Example 8: Integration with app object (future)
/*
// This will eventually work with the framework app object:
import { useApp } from '@/core/hooks/useApp';

function MyComponent() {
  const app = useApp();

  const handleShare = async () => {
    const result = await app.ui.share({
      url: 'https://example.com',
      title: 'Check this out!',
      text: 'Amazing content here'
    });

    if (result.success) {
      app.ui.toast('Shared successfully!');
    }
  };

  return <button onClick={handleShare}>Share</button>;
}
*/