#!/usr/bin/env node
// core/services/generateDocs.js
// Utility to generate service documentation

import { serviceRegistry } from './index.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Generate comprehensive service documentation
 */
async function generateServiceDocs() {
  console.log('🚀 Generating JasonJS Framework Service Documentation...\n');
  
  const docsDir = path.join(process.cwd(), 'docs');
  
  // Ensure docs directory exists
  try {
    await fs.mkdir(docsDir, { recursive: true });
  } catch (error) {
    // Directory might already exist, ignore error
  }
  
  // Generate documentation for both component types
  const clientDocs = serviceRegistry.generateDocs('client');
  const trustedDocs = serviceRegistry.generateDocs('trusted');
  
  // Create comprehensive service overview
  const overviewDocs = `# JasonJS Framework Services

JasonJS Framework provides a comprehensive service system that gives components access to powerful APIs and utilities. Services are available to different component types based on security and trust levels.

## Component Types

### 🔓 Client Components (Non-Trusted)
- Database components with \`trust: false\` or \`undefined\`
- Run client-side only with sandboxing
- Limited but secure access to services

### 🔒 Trusted Components
- Database components with \`trust: true\`
- Cached server-side but executed client-side
- Enhanced access to all services including server-side capabilities

## Service Architecture

\`\`\`
┌─────────────────────────────────────────────────┐
│                Service Registry                  │
├─────────────────┬───────────────────────────────┤
│   Core Services │   Third-Party Services        │
├─────────────────┼───────────────────────────────┤
│ • Database      │ • Stripe Payments            │
│ • Authentication│ • Email Service              │
│ • Storage       │ • AI/ML Services             │
│ • Cache         │ • Analytics                  │
│ • Contexts      │                              │
└─────────────────┴───────────────────────────────┘
                        │
                        ▼
    ┌─────────────────────────────────────┐
    │        Component Types              │
    ├───────────────┬─────────────────────┤
    │ Client        │ Trusted             │
    │ Components    │ Components          │
    ├───────────────┼─────────────────────┤
    │ • Basic APIs  │ • Enhanced APIs     │
    │ • Client-only │ • Server access     │
    │ • Sandboxed   │ • System access     │
    └───────────────┴─────────────────────┘
\`\`\`

## Usage Examples

### Using Database Service
\`\`\`jsx
import { useDatabase } from '@/core/client/db';

function MyComponent() {
  const db = useDatabase('users');
  const [users, setUsers] = useState([]);
  
  useEffect(() => {
    // Query with fluid API
    db.query()
      .where('active', true)
      .orderBy('created_at', 'desc')
      .limit(10)
      .exec()
      .then(setUsers);
  }, []);
  
  return (
    <div>
      {users.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );
}
\`\`\`

### Using Storage Service
\`\`\`jsx
import { useStorage } from '@storage';

function FileUpload() {
  const { upload, uploads, isUploading } = useStorage();
  
  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        const result = await upload(file, {
          path: 'uploads/images',
          onProgress: (progress) => console.log(progress + '%')
        });
        console.log('Uploaded:', result);
      } catch (error) {
        console.error('Upload failed:', error);
      }
    }
  };
  
  return (
    <div>
      <input type="file" onChange={handleFileSelect} />
      {isUploading && <div>Uploading...</div>}
      {uploads.map(upload => (
        <div key={upload.id}>
          {upload.file}: {upload.progress}%
        </div>
      ))}
    </div>
  );
}
\`\`\`

### Using Authentication Service
\`\`\`jsx
import { useAuth } from '@auth';

function ProtectedContent() {
  const { user, isAuthenticated, hasRole } = useAuth();
  
  if (!isAuthenticated) {
    return <div>Please log in to continue</div>;
  }
  
  if (!hasRole('admin')) {
    return <div>Admin access required</div>;
  }
  
  return <div>Welcome, {user.name}!</div>;
}
\`\`\`

## Service Import Patterns

Services can be imported using multiple patterns for flexibility:

\`\`\`jsx
// Full path imports
import { useDatabase } from '@/core/client/db';
import { useStorage } from '@/core/services/storage';
import { useAuth } from '@/core/hooks/useAuth';

// Convenient shorthand imports  
import { useDatabase } from '@database';
import { useStorage } from '@storage';
import { useAuth } from '@auth';

// Service-specific imports
import { uploadFile, getAssetUrl } from '@storage';
import { DatabaseClient } from '@database';
\`\`\`

---

`;
  
  // Write documentation files
  await fs.writeFile(path.join(docsDir, 'SERVICES.md'), overviewDocs);
  await fs.writeFile(path.join(docsDir, 'CLIENT_SERVICES.md'), clientDocs);
  await fs.writeFile(path.join(docsDir, 'TRUSTED_SERVICES.md'), trustedDocs);
  
  // Generate service import reference
  const clientImports = serviceRegistry.getImportMap('client');
  const trustedImports = serviceRegistry.getImportMap('trusted');
  
  const importReference = `# Service Import Reference

## Client Component Imports
Available to all database components (trust: false/undefined):

\`\`\`javascript
${Object.entries(clientImports)
  .map(([path, exports]) => `'${path}' → ${JSON.stringify(exports, null, 2)}`)
  .join('\n\n')}
\`\`\`

## Trusted Component Imports  
Available to trusted database components (trust: true):

\`\`\`javascript
${Object.entries(trustedImports)
  .map(([path, exports]) => `'${path}' → ${JSON.stringify(exports, null, 2)}`)
  .join('\n\n')}
\`\`\`
`;
  
  await fs.writeFile(path.join(docsDir, 'SERVICE_IMPORTS.md'), importReference);
  
  console.log('✅ Documentation generated successfully!');
  console.log(`📁 Files created in: ${docsDir}`);
  console.log('   • SERVICES.md - Service overview');
  console.log('   • CLIENT_SERVICES.md - Client component services');
  console.log('   • TRUSTED_SERVICES.md - Trusted component services');
  console.log('   • SERVICE_IMPORTS.md - Import reference');
  console.log('\n🎉 Ready to help developers understand available services!');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateServiceDocs().catch(console.error);
}

export { generateServiceDocs };