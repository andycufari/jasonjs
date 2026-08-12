import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET(request, { params }) {
  try {
    const { slug } = params;
    
    // Join slug array to create filename
    let filename = Array.isArray(slug) ? slug.join('/') : slug;
    
    // Prevent directory traversal attacks
    if (filename.includes('..')) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 400 }
      );
    }
    
    // Convert kebab-case to UPPERCASE for actual filenames
    // component-packages -> COMPONENT_PACKAGES.md
    const actualFilename = filename.replace(/-/g, '_').toUpperCase() + '.md';
    
    console.log(`Looking for docs file: ${filename} -> ${actualFilename}`);
    
    // Read the markdown file from docs directory
    const filePath = join(process.cwd(), 'docs', actualFilename);
    
    try {
      const content = readFileSync(filePath, 'utf8');
      return new NextResponse(content, {
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
        }
      });
    } catch (readError) {
      console.error(`File not found: ${filePath}`, readError.message);
      
      // Try alternative naming patterns
      const alternatives = [
        filename + '.md',
        filename.toUpperCase() + '.md',
        filename.replace(/-/g, '_') + '.md'
      ];
      
      for (const altName of alternatives) {
        try {
          const altPath = join(process.cwd(), 'docs', altName);
          const content = readFileSync(altPath, 'utf8');
          console.log(`Found alternative file: ${altName}`);
          return new NextResponse(content, {
            headers: {
              'Content-Type': 'text/plain',
              'Cache-Control': 'public, max-age=300'
            }
          });
        } catch (e) {
          // Continue to next alternative
        }
      }
      
      return NextResponse.json(
        { error: `Documentation file not found: ${filename} (tried ${actualFilename})` },
        { status: 404 }
      );
    }
    
  } catch (error) {
    console.error('Error in docs API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}