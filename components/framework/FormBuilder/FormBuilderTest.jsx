'use client';

import React, { useState } from 'react';
import FormBuilder from '../FormBuilder';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

/**
 * Test component for the enhanced FormBuilder
 * Tests all functionality with the directorio database schema
 */
export default function FormBuilderTest() {
  const [submittedData, setSubmittedData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Test schema for directorio (business directory)
  const directorioSchema = {
    title: {
      type: 'text',
      label: 'Nombre del Negocio',
      required: true,
      minLength: 3,
      maxLength: 100,
      placeholder: 'Ej: Panadería Don José',
      help: 'Nombre comercial de tu negocio',
      order: 1
    },
    description: {
      type: 'textarea',
      label: 'Descripción',
      required: true,
      minLength: 20,
      maxLength: 500,
      placeholder: 'Describe tu negocio, productos o servicios...',
      help: 'Describe claramente qué ofreces para atraer más clientes',
      rows: 4,
      showCounter: true,
      order: 2
    },
    phone: {
      type: 'phone',
      label: 'Número de WhatsApp',
      required: true,
      placeholder: 'Ej: 11 4567-8900',
      help: 'Número donde los clientes pueden contactarte por WhatsApp',
      validation: 'phone',
      order: 3
    },
    category: {
      type: 'relation',
      collection: 'Category',
      displayField: 'title',
      valueField: '_id',
      label: 'Categoría',
      required: true,
      help: 'Selecciona la categoría que mejor describe tu negocio',
      order: 4
    },
    // Cross-database relation example
    external_category: {
      type: 'relation',
      database: 'notion_db', // Different database
      collection: 'business_categories', // Table/collection in that database
      connector: 'notion', // Specify connector type
      displayField: 'name',
      valueField: 'id',
      label: 'Categoría Externa (Notion)',
      required: false,
      help: 'Ejemplo de categoría desde base de datos externa',
      order: 4.5
    },
    address: {
      type: 'text',
      label: 'Dirección',
      required: false,
      placeholder: 'Ej: Av. Corrientes 1234, CABA',
      help: 'Dirección física - se geocodifica automáticamente',
      location: true, // Enable automatic geocoding
      location_ref: 'location', // Link to location field
      order: 5
    },
    location: {
      type: 'geopoint',
      label: 'Ubicación',
      required: false,
      help: 'Coordenadas (actualizadas automáticamente desde dirección)',
      showCoordinates: true, // Show coordinates for testing
      order: 6
    },
    takeaway: {
      type: 'select',
      label: 'Delivery',
      required: false,
      options: [
        { value: 'Si', label: 'Sí, hago delivery' },
        { value: 'No', label: 'No hago delivery' }
      ],
      help: 'Indica si realizas entregas a domicilio',
      order: 7
    },
    // Hidden field for testing
    created_by: {
      type: 'text',
      label: 'Created By',
      hidden: true,
      default: 'system'
    }
  };

  // Test data for editing mode
  const testData = {
    id: '12345',
    title: 'Panadería La Esquina',
    description: 'Panadería artesanal con productos frescos y caseros. Especialistas en pan integral y medialunas.',
    phone: '+541142567890',
    category: 'cat_panaderia_123',
    address: 'Av. Corrientes 1234, CABA',
    location: {
      lat: -34.6037,
      lng: -58.3816,
      address: 'Av. Corrientes 1234, CABA'
    },
    takeaway: 'Si'
  };

  const handleSubmit = async (data) => {
    setIsSubmitting(true);
    console.log('FormBuilder Test - Data submitted:', data);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setSubmittedData(data);
    setIsSubmitting(false);
  };

  const handleCancel = () => {
    console.log('FormBuilder Test - Form cancelled');
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">FormBuilder Test</h1>
        <p className="text-gray-600">Testing enhanced FormBuilder with directorio schema</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Mode Test */}
        <Card>
          <CardHeader>
            <CardTitle className="text-green-700">Create Mode Test</CardTitle>
          </CardHeader>
          <CardContent>
            <FormBuilder
              schema={directorioSchema}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              config={{
                submitText: 'Crear Negocio',
                showCancel: true,
                validateOnBlur: true,
                showRequiredIndicator: true
              }}
            />
          </CardContent>
        </Card>

        {/* Edit Mode Test */}
        <Card>
          <CardHeader>
            <CardTitle className="text-blue-700">Edit Mode Test</CardTitle>
          </CardHeader>
          <CardContent>
            <FormBuilder
              schema={directorioSchema}
              initialData={testData}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              config={{
                submitText: 'Actualizar Negocio',
                showCancel: true,
                validateOnBlur: true,
                showRequiredIndicator: true
              }}
            />
          </CardContent>
        </Card>
      </div>

      {/* Field Filter Test */}
      <Card>
        <CardHeader>
          <CardTitle className="text-purple-700">Field Filter Test</CardTitle>
          <p className="text-sm text-gray-600">Only showing title, description, and phone fields</p>
        </CardHeader>
        <CardContent>
          <FormBuilder
            schema={directorioSchema}
            onSubmit={handleSubmit}
            config={{
              fields: ['title', 'description', 'phone'],
              submitText: 'Crear (Filtrado)',
              validateOnBlur: true
            }}
          />
        </CardContent>
      </Card>

      {/* Results Display */}
      {submittedData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-green-700">Submitted Data</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(submittedData, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Component Feature Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Test Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              TextInput with validation
            </label>
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              TextareaInput with counter
            </label>
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              PhoneInput international format
            </label>
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              LocationInput address search
            </label>
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              SelectInput with options
            </label>
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              RelationInput category loading
            </label>
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              Cross-database relations (external_category)
            </label>
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              Address-to-location geocoding
            </label>
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              Hidden fields excluded
            </label>
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              Field ordering works
            </label>
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              Help text displays
            </label>
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              Validation messages
            </label>
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              Required indicators
            </label>
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              Form submission works
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-800">Test Instructions</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-700">
          <ol className="list-decimal list-inside space-y-1">
            <li>Test text input validation (try short/long values)</li>
            <li>Test phone input with different country codes</li>
            <li><strong>Test address field with automatic geocoding</strong> - Type an address and see coordinates update</li>
            <li>Test original location input with manual coordinates</li>
            <li>Verify relationship field loads categories (local database)</li>
            <li><strong>Test cross-database relations</strong> - External category field (may show loading error without actual DB)</li>
            <li>Check form validation by submitting empty form</li>
            <li>Verify edit mode populates correctly</li>
            <li>Test field filtering in the third form</li>
            <li>Check that hidden fields are not shown</li>
          </ol>
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="font-medium text-yellow-800">New Features:</p>
            <ul className="list-disc list-inside mt-1 text-xs text-yellow-700">
              <li>Address field now auto-geocodes to coordinates in location field</li>
              <li>Relation fields support cross-database connections (Notion, Airtable, etc.)</li>
              <li>Schema patterns: <code>location: true</code> + <code>location_ref: "field_name"</code></li>
              <li>Cross-DB: <code>database: "db_name"</code> + <code>connector: "notion"</code></li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}