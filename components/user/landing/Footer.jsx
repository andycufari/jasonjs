// studio/components/landing/Footer.jsx
import Image from 'next/image';
import Link from 'next/link';
import Newsletter from '@/components/framework/website/Newsletter';

const Footer = ({ props }) => {
  const {
    logo,
    links,
    social,
    copyright,
    textCss = { color: '#2563eb' }, // Default to a blue color
    bgColor = 'bg-white',
    showNewsletter = false,
    newsletterTitle = "Subscribe to our newsletter",
    newsletterSubtitle = "Get the latest updates delivered to your inbox",
    newsletterPlaceholder = "Enter your email",
    newsletterDatabase = "newsletter",
    newsletterVariant = "default"
  } = props;

  const renderSocialIcon = (type) => {
    switch (type) {
      case 'facebook':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path fillRule="evenodd" clipRule="evenodd" d="M13.6348 20.7273V12.766H16.3582L16.7668 9.66246H13.6348V7.68128C13.6348 6.78301 13.8881 6.17085 15.2029 6.17085L16.877 6.17017V3.39424C16.5875 3.35733 15.5937 3.27273 14.437 3.27273C12.0216 3.27273 10.368 4.71881 10.368 7.37391V9.66246H7.63636V12.766H10.368V20.7273H13.6348Z" fill="currentColor"/>
          </svg>
        );
      case 'twitter':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path fillRule="evenodd" clipRule="evenodd" d="M21.8182 6.14597C21.1356 6.44842 20.4032 6.65355 19.6337 6.74512C20.4194 6.27461 21.0208 5.5283 21.3059 4.64176C20.5689 5.07748 19.7553 5.39388 18.8885 5.56539C18.1943 4.82488 17.207 4.36364 16.1118 4.36364C14.0108 4.36364 12.3072 6.06718 12.3072 8.16706C12.3072 8.46488 12.3408 8.75576 12.4058 9.03391C9.24436 8.87512 6.44106 7.36048 4.56485 5.05894C4.23688 5.61985 4.0503 6.27342 4.0503 6.97109C4.0503 8.29106 4.72246 9.45573 5.74227 10.1371C5.11879 10.1163 4.53239 9.94476 4.01903 9.65967V9.70718C4.01903 11.5498 5.33088 13.0876 7.07033 13.4376C6.75164 13.5234 6.41558 13.5709 6.06791 13.5709C5.82224 13.5709 5.58467 13.5465 5.35173 13.5002C5.83612 15.0125 7.2407 16.1123 8.90485 16.1424C7.60343 17.1622 5.96246 17.7683 4.18012 17.7683C3.87303 17.7683 3.57055 17.7498 3.27273 17.7162C4.95658 18.7974 6.95564 19.4278 9.10418 19.4278C16.1026 19.4278 19.9281 13.6312 19.9281 8.60397L19.9153 8.11145C20.6628 7.57833 21.3094 6.90851 21.8182 6.14597Z" fill="currentColor"/>
          </svg>
        );
      case 'linkedin':
        return (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path fillRule="evenodd" clipRule="evenodd" d="M19 3H5C4.44772 3 4 3.44772 4 4V20C4 20.5523 4.44772 21 5 21H19C19.5523 21 20 20.5523 20 20V4C20 3.44772 19.5523 3 19 3ZM8.63636 18.3636H6.09091V9.81818H8.63636V18.3636ZM7.36364 8.54545C6.48591 8.54545 5.77273 7.83227 5.77273 6.95455C5.77273 6.07682 6.48591 5.36364 7.36364 5.36364C8.24136 5.36364 8.95455 6.07682 8.95455 6.95455C8.95455 7.83227 8.24136 8.54545 7.36364 8.54545ZM18.3636 18.3636H15.8182V13.8636C15.8182 12.7136 14.9514 11.8182 13.8182 11.8182C12.685 11.8182 11.8182 12.7136 11.8182 13.8636V18.3636H9.27273V9.81818H11.8182V11.0909C12.3273 10.4155 13.1455 9.95455 14.0909 9.95455C16.0091 9.95455 17.4545 11.4218 17.4545 13.3636V18.3636H18.3636Z" fill="currentColor"/>
            </svg>
        );
     case 'instagram':
        return (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2.16204C7.54545 2.16204 3.91818 5.78931 3.91818 10.2439V13.7561C3.91818 18.2107 7.54545 21.838 12 21.838C16.4545 21.838 20.0818 18.2107 20.0818 13.7561V10.2439C20.0818 5.78931 16.4545 2.16204 12 2.16204ZM12 5.45455C14.466 5.45455 16.4545 7.44306 16.4545 9.90909C16.4545 12.3751 14.466 14.3636 12 14.3636C9.53397 14.3636 7.54545 12.3751 7.54545 9.90909C7.54545 7.44306 9.53397 5.45455 12 5.45455ZM16.9091 6.81818C17.1727 6.81818 17.4091 7.05455 17.4091 7.31818C17.4091 7.58182 17.1727 7.81818 16.9091 7.81818H16.9045C16.6409 7.81818 16.4091 7.58182 16.4091 7.31818C16.4091 7.05455 16.6409 6.81818 16.9091 6.81818Z" fill="currentColor"/>
                <circle cx="12" cy="12" r="3.63636" fill="currentColor"/>
            </svg>
        );
     case 'youtube':
        return (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path fillRule="evenodd" clipRule="evenodd" d="M21.5818 7.32727C21.3302 6.34091 20.5841 5.58568 19.5959 5.33318C17.8 4.86364 12 4.86364 12 4.86364C12 4.86364 6.2 4.86364 4.40409 5.33318C3.41591 5.58568 2.66977 6.34091 2.41818 7.32727C2 9.22727 2 12 2 12C2 12 2 14.7727 2.41818 16.6727C2.66977 17.6591 3.41591 18.4143 4.40409 18.6668C6.2 19.1364 12 19.1364 12 19.1364C12 19.1364 17.8 19.1364 19.5959 18.6668C20.5841 18.4143 21.3302 17.6591 21.5818 16.6727C22 14.7727 22 12 22 12C22 12 22 9.22727 21.5818 7.32727ZM10 15.0909V8.90909L15.1818 12L10 15.0909Z" fill="currentColor"/>
            </svg>
        );
            
      default:
        return null;
    }
  };

  return (
    <footer className={`${bgColor} py-20`}>
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center">
          { logo && logo.src && (
            <div className="mb-8">
              <Image
                src={logo.src}
                alt={logo.alt}
                width={logo.width}
                height={logo.height}
              />
            </div>
          )}

          {logo && logo.text && (
            <div className="mb-8">
              <p className="text-center text-white text-4xl font-bold">{logo.text}</p>
            </div>
          )}
          
          {links && links.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-5 lg:gap-12 mb-8">
              {links.map((link, index) => (
                <Link
                  key={index}
                  href={link.url}
                  style={textCss}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}
          
          {social && social.length > 0 && (
            <div className="flex items-center gap-8 mb-8">
              {social.map((item, index) => (
                <a
                  key={index}
                  href={item.url}
                  style={textCss}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {renderSocialIcon(item.type)}
                </a>
              ))}
            </div>
          )}

          {/* Newsletter Section */}
          {showNewsletter && (
            <div className="w-full max-w-md mb-8">
              <Newsletter
                title={newsletterTitle}
                subtitle={newsletterSubtitle}
                placeholder={newsletterPlaceholder}
                newsletterDatabase={newsletterDatabase}
                variant={newsletterVariant}
                size="default"
              />
            </div>
          )}

          {copyright && (
            <div className="text-center">
              <p
                style={textCss}
                className="text-base font-normal leading-7"
                dangerouslySetInnerHTML={{ __html: copyright }}
              />
            </div>
          )}

        </div>
      </div>
    </footer>
  );
};

export default Footer;