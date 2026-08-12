"use client";

import { useState } from 'react';
import QRScanner from './components/QRScanner';

/**
 * QR Scanner Example Component
 *
 * Demonstrates basic usage of the QR Scanner addon with database integration
 */
export default function QRScannerExample({ jcontext }) {
  const [isQROpen, setIsQROpen] = useState(false);
  const [scannedValue, setScannedValue] = useState('');
  const [productData, setProductData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleScan = async (value) => {
    console.log('QR Code scanned:', value);
    setScannedValue(value);
    setLoading(true);

    try {
      // Example: Query database for product with this QR code
      const db = jcontext.app.db.use('products');
      const result = await db.fetch({ qr_code: value });

      if (result && result.length > 0) {
        setProductData(result[0]);
        jcontext.app.ui.toast('Product found!', 'success');
      } else {
        setProductData(null);
        jcontext.app.ui.toast('Product not found', 'error');
      }
    } catch (error) {
      console.error('Database query error:', error);
      jcontext.app.ui.toast('Error loading product', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">QR Scanner Example</h1>

      {/* Scan Button */}
      <button
        onClick={() => setIsQROpen(true)}
        className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-lg font-medium"
      >
        📷 Scan QR Code
      </button>

      {/* QR Scanner Modal */}
      <QRScanner
        isOpen={isQROpen}
        onClose={() => setIsQROpen(false)}
        onScan={handleScan}
        title="Scan Product QR"
        successMessage="Product QR detected!"
        autoCloseDelay={1500}
      />

      {/* Results Display */}
      {loading && (
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-800">Loading product data...</p>
        </div>
      )}

      {scannedValue && !loading && (
        <div className="mt-8 space-y-4">
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Last Scanned QR Code:</p>
            <p className="text-lg font-mono font-medium">{scannedValue}</p>
          </div>

          {productData ? (
            <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="text-xl font-bold text-green-800 mb-4">Product Found</h3>
              <div className="space-y-2">
                {Object.entries(productData)
                  .filter(([key]) => !['id', 'createdAt', 'updatedAt'].includes(key))
                  .map(([key, value]) => (
                    <div key={key} className="flex">
                      <span className="font-medium text-gray-700 w-32">{key}:</span>
                      <span className="text-gray-900">{value?.toString() || '—'}</span>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800">No product found with this QR code.</p>
            </div>
          )}
        </div>
      )}

      {/* Usage Instructions */}
      <div className="mt-12 p-6 bg-gray-50 rounded-lg">
        <h2 className="text-xl font-bold mb-4">Usage Instructions</h2>
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>Click the "Scan QR Code" button</li>
          <li>Grant camera permissions when prompted</li>
          <li>Point your camera at a QR code</li>
          <li>The scanner will automatically detect and read the code</li>
          <li>Results will be displayed below</li>
        </ol>
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> This addon requires Chrome, Edge, or Samsung Internet browser.
            Safari and Firefox are not currently supported by the Barcode Detection API.
          </p>
        </div>
      </div>
    </div>
  );
}
