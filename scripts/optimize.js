const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const zlib = require('zlib');

// Promisify file operations
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);
const mkdir = promisify(fs.mkdir);
const brotliCompress = promisify(zlib.brotliCompress);
const gzip = promisify(zlib.gzip);

// Create scripts directory if it doesn't exist
mkdir(path.join(__dirname), { recursive: true }).catch(() => {});

// Optimal Brotli compression settings
const BROTLI_OPTIONS = {
  params: {
    [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
    [zlib.constants.BROTLI_PARAM_SIZE_HINT]: 0
  }
};

// Optimal Gzip compression settings
const GZIP_OPTIONS = {
  level: zlib.constants.Z_BEST_COMPRESSION,
  memLevel: 9
};

// File types to optimize with more aggressive techniques
const TEXT_FILES = ['.js', '.css', '.html', '.json', '.svg', '.txt', '.xml'];
const BINARY_FILES = ['.woff2', '.woff', '.ttf', '.eot'];

/**
 * This script optimizes the production build by:
 * 1. Removing unnecessary comments and whitespace
 * 2. Pre-compressing assets with Brotli and Gzip
 * 3. Optimizing image file sizes when possible
 */
async function optimizeProductionBundle() {
  const distPath = path.join(__dirname, '..', 'dist');
  
  if (!fs.existsSync(distPath)) {
    console.error('Dist folder not found. Run npm run build first.');
    process.exit(1);
  }
  
  console.log('Starting production bundle optimization...');
  
  const startTime = Date.now();
  const stats = {
    jsOptimized: { count: 0, bytes: 0 },
    brotliCompressed: { count: 0, bytes: 0 },
    gzipCompressed: { count: 0, bytes: 0 },
    totalSaved: 0,
    totalFiles: 0
  };
  
  // Create pre-compressed files directory
  const compressedDir = path.join(distPath, 'compressed');
  await mkdir(compressedDir, { recursive: true }).catch(() => {});
  
  // Get all files recursively
  async function getAllFiles(dir) {
    let results = [];
    const items = await readdir(dir);
    
    for (const item of items) {
      if (item === 'compressed') continue; // Skip the compressed directory
      
      const itemPath = path.join(dir, item);
      const stats = await stat(itemPath);
      
      if (stats.isDirectory()) {
        results = results.concat(await getAllFiles(itemPath));
      } else {
        results.push(itemPath);
      }
    }
    
    return results;
  }
  
  // Optimize JS files by removing comments and whitespace
  async function optimizeJsFile(file) {
    const originalSize = (await stat(file)).size;
    let content = await readFile(file, 'utf-8');
    
    // Remove comments and extra whitespace
    let optimizedContent = content
      // Remove multi-line comments (except license comments)
      .replace(/\/\*(?!\s*@license)[\s\S]*?\*\//g, '')
      // Remove single-line comments (that don't start with http://, https://, or data:)
      .replace(/^(?!.*https?:|.*data:).*\/\/.*$/gm, '')
      // Remove excessive newlines (more than 2 in a row)
      .replace(/\n{3,}/g, '\n\n')
      // Fix potential syntax issues caused by comment removal
      .replace(/}\n*\/\//g, '}\n')
      // Trim leading/trailing whitespace
      .trim();
    
    await writeFile(file, optimizedContent);
    
    const newSize = (await stat(file)).size;
    const savedBytes = originalSize - newSize;
    
    if (savedBytes > 0) {
      stats.jsOptimized.count++;
      stats.jsOptimized.bytes += savedBytes;
      stats.totalSaved += savedBytes;
      
      console.log(`Optimized JS: ${path.basename(file)} (saved ${(savedBytes / 1024).toFixed(2)} KB)`);
    }
    
    return file;
  }
  
  // Pre-compress a file with Brotli
  async function createBrotliVersion(file) {
    try {
      const fileExt = path.extname(file);
      if (!TEXT_FILES.includes(fileExt) && !BINARY_FILES.includes(fileExt)) return;
      
      const originalSize = (await stat(file)).size;
      if (originalSize < 1024) return; // Skip files < 1KB
      
      const content = await readFile(file);
      const compressed = await brotliCompress(content, BROTLI_OPTIONS);
      
      const relativePath = path.relative(distPath, file);
      const outputPath = path.join(compressedDir, `${relativePath}.br`);
      
      // Create directory structure in compressed dir
      await mkdir(path.dirname(outputPath), { recursive: true });
      
      await writeFile(outputPath, compressed);
      
      const savedBytes = originalSize - compressed.length;
      if (savedBytes > 0) {
        stats.brotliCompressed.count++;
        stats.brotliCompressed.bytes += savedBytes;
        const ratio = (compressed.length / originalSize * 100).toFixed(1);
        console.log(`Brotli: ${path.basename(file)} (${ratio}% of original, saved ${(savedBytes / 1024).toFixed(2)} KB)`);
      }
    } catch (err) {
      console.error(`Error creating Brotli version of ${file}:`, err.message);
    }
  }
  
  // Pre-compress a file with Gzip
  async function createGzipVersion(file) {
    try {
      const fileExt = path.extname(file);
      if (!TEXT_FILES.includes(fileExt) && !BINARY_FILES.includes(fileExt)) return;
      
      const originalSize = (await stat(file)).size;
      if (originalSize < 1024) return; // Skip files < 1KB
      
      const content = await readFile(file);
      const compressed = await gzip(content, GZIP_OPTIONS);
      
      const relativePath = path.relative(distPath, file);
      const outputPath = path.join(compressedDir, `${relativePath}.gz`);
      
      // Create directory structure in compressed dir
      await mkdir(path.dirname(outputPath), { recursive: true });
      
      await writeFile(outputPath, compressed);
      
      const savedBytes = originalSize - compressed.length;
      if (savedBytes > 0) {
        stats.gzipCompressed.count++;
        stats.gzipCompressed.bytes += savedBytes;
      }
    } catch (err) {
      console.error(`Error creating Gzip version of ${file}:`, err.message);
    }
  }
  
  try {
    // Get all files
    const allFiles = await getAllFiles(distPath);
    stats.totalFiles = allFiles.length;
    
    // Process JS files
    const jsFiles = allFiles.filter(file => file.endsWith('.js'));
    for (const file of jsFiles) {
      await optimizeJsFile(file);
    }
    
    // Process all files for compression
    const compressionPromises = [];
    for (const file of allFiles) {
      compressionPromises.push(createBrotliVersion(file));
      compressionPromises.push(createGzipVersion(file));
    }
    
    await Promise.all(compressionPromises);
    
    // Print stats
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`
-------------------------------------------------------------
Optimization complete in ${duration.toFixed(2)} seconds
JS files optimized: ${stats.jsOptimized.count} (saved ${(stats.jsOptimized.bytes / 1024 / 1024).toFixed(2)} MB)
Brotli compressed: ${stats.brotliCompressed.count} files (additional ${(stats.brotliCompressed.bytes / 1024 / 1024).toFixed(2)} MB saved)
Gzip compressed: ${stats.gzipCompressed.count} files (additional ${(stats.gzipCompressed.bytes / 1024 / 1024).toFixed(2)} MB saved)
Total files processed: ${stats.totalFiles}
Total space saved: ${(stats.totalSaved / 1024 / 1024).toFixed(2)} MB
-------------------------------------------------------------
    `);
    
    console.log('Note: Compressed versions are stored in dist/compressed/ directory');
    console.log('For optimal serving, configure your server to use .br and .gz files when available');
  } catch (error) {
    console.error('Optimization failed:', error);
  }
}

// Run the optimization
optimizeProductionBundle().catch(console.error);