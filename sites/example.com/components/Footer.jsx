// sites/example.com/components/Footer.jsx
import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t mt-16">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-gray-600">
            © 2024 Example Site. Built with{' '}
            <a 
              href="https://github.com/your-repo/jasonjs-framework" 
              className="text-blue-600 hover:text-blue-800"
              target="_blank"
              rel="noopener noreferrer"
            >
              JasonJS Framework
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}