// components/SiteNetwork.jsx
import Link from 'next/link';

export default function SiteNetwork({ startups }) {
  return (
    <div className="max-w-4xl mx-auto px-4 mt-24 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold mb-6">CM64 Startup Studio Network</h1>
      <ul className="space-y-6">
        {startups.map((startup) => (
          <li key={startup.primary_domain} className="rounded-lg shadow-md p-6 transition-all duration-200 border border-secondary hover:shadow-lg hover:-translate-y-1">
            <h2 className="text-xl font-semibold mb-2">
              <Link href={`https://${startup.primary_domain}`} className="hover:text-primary">
                {startup.name}
              </Link>
            </h2>
            <p className="text-sm text-gray-600 mb-2">{startup.primary_domain}</p>
            {startup.description && (
              <p className="text-sm text-gray-700">{startup.description}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}