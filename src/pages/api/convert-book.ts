import type { APIRoute } from 'astro';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import archiver from 'archiver';

export const prerender = false;

// Progress tracking storage in memory (restarts on server restart, acceptable for this use case)
interface ConversionProgress {
  jobId: string;
  current: number;
  total: number;
  stage: string;
  done: boolean;
  error?: string;
}

const progressStore = new Map<string, ConversionProgress>();

// Project paths
const PROJECT_ROOT = process.cwd();
const XREADER_DIR = path.join(PROJECT_ROOT, 'xreader');
const XREADER_VENV_PYTHON = path.join(XREADER_DIR, 'venv/bin/python');
const BOOKS_DIR = path.join(XREADER_DIR, 'books');
const AUDIOBOOKS_DIR = path.join(XREADER_DIR, 'audiobooks');
const PUBLIC_XREADER_DIR = path.join(PROJECT_ROOT, 'public', 'xreader-audio');

// Ensure directories exist
function ensureDirExists(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
  }
}

[BOOKS_DIR, AUDIOBOOKS_DIR, PUBLIC_XREADER_DIR].forEach(ensureDirExists);

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Parse multipart form-data manually
async function parseMultipartForm(request: Request): Promise<{ file: File; fields: Record<string, string> }> {
  const contentType = request.headers.get('content-type');
  if (!contentType || !contentType.includes('multipart/form-data')) {
    throw new Error('Expected multipart/form-data');
  }

  const formData = await request.formData();
  const file = formData.get('book') as File | null;
  if (!file) {
    throw new Error('No file uploaded');
  }

  const fields: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') {
      fields[key] = value;
    }
  }

  return { file, fields };
}

// Parse progress from output
function parseProgressLine(line: string): { current: number; total: number } | null {
  // Look for patterns like: "3/10" or "30%" or "3 已完成"
  const chunkMatch = line.match(/(\d+)\s+\/\s+(\d+)/);
  if (chunkMatch) {
    return {
      current: parseInt(chunkMatch[1], 10),
      total: parseInt(chunkMatch[2], 10)
    };
  }
  // Look for "转换进度: 1/5"
  const progressMatch = line.match(/转换进度.*?(\d+).*?(\d+)/i);
  if (progressMatch) {
    return {
      current: parseInt(progressMatch[1], 10),
      total: parseInt(progressMatch[2], 10)
    };
  }
  // Look for "[3/5]"
  const bracketMatch = line.match(/\[(\d+)\/(\d+)\]/);
  if (bracketMatch) {
    return {
      current: parseInt(bracketMatch[1], 10),
      total: parseInt(bracketMatch[2], 10)
    };
  }
  return null;
}

function runPythonScriptWithProgress(jobId: string, scriptPath: string, args: string[], stage: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`Running job ${jobId}: ${XREADER_VENV_PYTHON} ${scriptPath} ${args.join(' ')}`);

    // Initialize progress
    progressStore.set(jobId, {
      jobId,
      current: 0,
      total: 1,
      stage,
      done: false
    });

    const proc = spawn(XREADER_VENV_PYTHON, [scriptPath, ...args], {
      cwd: XREADER_DIR,
      env: process.env
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      console.log(`[${jobId} python stdout] ${chunk}`);

      // Parse progress from each line
      const lines = chunk.split('\n');
      for (const line of lines) {
        const progress = parseProgressLine(line);
        if (progress) {
          const current = progressStore.get(jobId);
          if (current) {
            current.current = progress.current;
            current.total = progress.total;
            progressStore.set(jobId, current);
          }
        }
      }
    });

    proc.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      console.log(`[${jobId} python stderr] ${chunk}`);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        const current = progressStore.get(jobId);
        if (current) {
          current.done = true;
          current.current = current.total;
          progressStore.set(jobId, current);
        }
        resolve();
      } else {
        const errorMsg = `Python script exited with code ${code}\nstdout: ${stdout}\nstderr: ${stderr}`;
        const current = progressStore.get(jobId);
        if (current) {
          current.done = true;
          current.error = errorMsg;
          progressStore.set(jobId, current);
        }
        reject(new Error(errorMsg));
      }
    });

    proc.on('error', (error) => {
      const errorMsg = `Failed to start Python: ${error.message}`;
      const current = progressStore.get(jobId);
      if (current) {
        current.done = true;
        current.error = errorMsg;
        progressStore.set(jobId, current);
      }
      reject(new Error(errorMsg));
    });
  });
}

async function createZip(sourceDir: string, zipPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    output.on('close', () => {
      console.log(`ZIP created: ${archive.pointer()} total bytes`);
      resolve();
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

function findManifest(outputDir: string): any | null {
  const manifestPath = path.join(outputDir, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const content = fs.readFileSync(manifestPath, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      console.error('Failed to read manifest:', e);
      return null;
    }
  }
  return null;
}

// Store full job data
interface ConversionJob {
  jobId: string;
  fileName: string;
  safeFileName: string;
  inputPath: string;
  outputDir: string;
  zipPath: string;
  zipFilename: string;
  voice: string;
  rate: string;
  ext: string;
  done: boolean;
  success: boolean;
  manifest?: any;
  error?: string;
}

const jobStore = new Map<string, ConversionJob>();

async function runFullConversion(job: ConversionJob) {
  try {
    const jobId = job.jobId;
    let inputPath = job.inputPath;

    // Convert MOBI to TXT first if needed
    if (job.ext === 'mobi') {
      console.log(`Job ${jobId}: Converting MOBI to TXT...`);
      const mobiScript = path.join(XREADER_DIR, 'mobi_to_txt.py');
      const txtOutputPath = path.join(BOOKS_DIR, `${job.jobId}_${job.safeFileName.replace('.mobi', '.txt')}`);
      await runPythonScriptWithProgress(jobId + '-mobi', mobiScript, [inputPath, txtOutputPath], '转换 MOBI 格式');
      inputPath = txtOutputPath;
      console.log(`Job ${jobId}: MOBI converted to: ${inputPath}`);
    }

    // Update jobId progress store for main conversion
    progressStore.delete(jobId + '-mobi');

    // Run ebook to audiobook conversion
    console.log(`Job ${jobId}: Starting audiobook conversion...`);
    const converterScript = path.join(XREADER_DIR, 'ebook_to_audiobook.py');

    await runPythonScriptWithProgress(jobId, converterScript, [
      inputPath,
      '-o', AUDIOBOOKS_DIR,
      '-v', job.voice,
      '-r', job.rate
    ], '转换有声书');

    // Check output exists
    if (!fs.existsSync(job.outputDir)) {
      throw new Error(`转换完成但输出目录不存在: ${job.outputDir}`);
    }

    // Read manifest
    const manifest = findManifest(job.outputDir);
    if (!manifest) {
      throw new Error('转换完成但找不到 manifest.json');
    }
    job.manifest = manifest;

    // Update progress to packing stage
    progressStore.set(jobId, {
      jobId,
      current: 0,
      total: 1,
      stage: '打包 ZIP',
      done: false
    });

    // Create ZIP in public directory
    console.log(`Job ${jobId}: Creating ZIP...`);
    await createZip(job.outputDir, job.zipPath);

    const zipStat = fs.statSync(job.zipPath);
    console.log(`Job ${jobId}: ZIP created at ${job.zipPath}, size: ${formatBytes(zipStat.size)}`);

    // Mark as done
    progressStore.set(jobId, {
      jobId,
      current: 1,
      total: 1,
      stage: '完成',
      done: true
    });

    job.done = true;
    job.success = true;
    jobStore.set(jobId, job);
    console.log(`Job ${jobId}: Completed successfully!`);

  } catch (error) {
    console.error(`Job ${job.jobId} failed:`, error);
    job.done = true;
    job.success = false;
    job.error = formatError(error);
    const current = progressStore.get(job.jobId);
    if (current) {
      current.done = true;
      current.error = job.error;
      progressStore.set(job.jobId, current);
    }
    jobStore.set(job.jobId, job);
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Parse uploaded file
    const { file, fields } = await parseMultipartForm(request);
    const voice = fields.voice || 'xiaoxiao';
    const rate = fields.rate || '+0%';

    console.log(`Received file: ${file.name}, size: ${formatBytes(file.size)}, voice: ${voice}, rate: ${rate}`);

    // Validate file type
    const ext = getFileExtension(file.name);
    if (!['txt', 'epub', 'mobi'].includes(ext)) {
      throw new Error(`不支持的文件格式 .${ext}，仅支持 .txt .epub .mobi`);
    }

    // Check if Python venv exists
    if (!fs.existsSync(XREADER_VENV_PYTHON)) {
      throw new Error(`Python 环境未找到: ${XREADER_VENV_PYTHON}，请先安装虚拟环境`);
    }

    // Generate unique job ID
    const timestamp = Date.now();
    const safeFileName = file.name.replace(/[^\w\u4e00-\u9fa5.\-_]/g, '_');
    const jobId = `${timestamp}_${safeFileName.split('.')[0]}`;

    // Save uploaded file
    const uploadPath = path.join(BOOKS_DIR, `${jobId}_${safeFileName}`);
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(uploadPath, fileBuffer);
    console.log(`Job ${jobId}: File saved to: ${uploadPath}`);

    // Prepare job
    const outputDir = path.join(AUDIOBOOKS_DIR, jobId);
    const zipFilename = `${jobId}.zip`;
    const zipPath = path.join(PUBLIC_XREADER_DIR, zipFilename);

    const job: ConversionJob = {
      jobId,
      fileName: file.name,
      safeFileName,
      inputPath: uploadPath,
      outputDir,
      zipPath,
      zipFilename,
      voice,
      rate,
      ext,
      done: false,
      success: false
    };

    // Initialize progress
    progressStore.set(jobId, {
      jobId,
      current: 0,
      total: 1,
      stage: ext === 'mobi' ? '转换 MOBI 格式' : '初始化',
      done: false
    });

    jobStore.set(jobId, job);

    // Start conversion in background - don't wait for it to finish
    setImmediate(() => {
      runFullConversion(job);
    });

    // Return immediately with jobId for polling
    return new Response(JSON.stringify({
      success: true,
      jobId,
      fileName: safeFileName
    }), {
      status: 202, // Accepted - processing in background
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Conversion start error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: formatError(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// GET endpoint for progress polling
export const GET: APIRoute = async ({ url }) => {
  const jobId = url.searchParams.get('jobId');
  if (!jobId) {
    return new Response(JSON.stringify({ error: 'Missing jobId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const progress = progressStore.get(jobId);
  if (!progress) {
    return new Response(JSON.stringify({ error: 'Job not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const job = jobStore.get(jobId);
  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  const response: any = {
    jobId: progress.jobId,
    current: progress.current,
    total: progress.total,
    stage: progress.stage,
    percentage,
    done: progress.done,
    error: progress.error
  };

  // Add result data if done and successful
  if (progress.done && !progress.error && job && job.success && job.manifest) {
    response.success = true;
    response.fileName = job.safeFileName;
    response.totalChars = job.manifest.total_chars || 0;
    response.chunks = job.manifest.chunks || 0;
    response.zipPath = job.zipFilename;
    response.zipName = job.zipFilename;
  }

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
};
