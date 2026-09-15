import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import validator from 'gltf-validator';

/** Validate binary data as well as JSON, including strided/sparse accessors and skin indices. */
export async function validateGLB(data, name = 'GLB') {
  const report = await validator.validateBytes(data, { uri: name, maxIssues: 0 });
  if (report.issues.numErrors) {
    const errors = report.issues.messages.filter(issue => issue.severity === 0);
    throw new Error(`Invalid ${name}: ${errors.slice(0, 8).map(issue => `${issue.code} ${issue.pointer ?? ''}: ${issue.message}`).join('\n')}`);
  }
}

export function readGLB(path) {
  const data = readFileSync(path);
  if (data.length < 20 || data.toString('ascii', 0, 4) !== 'glTF' || data.readUInt32LE(4) !== 2 || data.readUInt32LE(8) !== data.length) {
    throw new Error(`Invalid or truncated GLB: ${path}`);
  }
  const length = data.readUInt32LE(12);
  if (data.readUInt32LE(16) !== 0x4e4f534a || 20 + length > data.length) throw new Error(`Missing GLB JSON: ${path}`);
  return JSON.parse(data.toString('utf8', 20, 20 + length));
}

export async function verifyAssets(root = 'public') {
  const files = readdirSync(root, { recursive: true }).filter(file => /\.glb$/i.test(file));
  for (const file of files) await validateGLB(readFileSync(resolve(root, file)), file);
  const sofa = readGLB(resolve(root, 'models/lounge-sofa.glb'));
  if (!sofa.meshes?.length) throw new Error('The lounge furniture has no geometry.');
  console.log(`Verified ${root}: ${files.length} GLBs with binary validation, ${sofa.meshes.length} furniture meshes.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await verifyAssets(process.argv[2]);
