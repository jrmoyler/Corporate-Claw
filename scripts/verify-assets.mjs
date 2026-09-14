import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function readGLB(path) {
  const data = readFileSync(path);
  if (data.length < 20 || data.toString('ascii', 0, 4) !== 'glTF' || data.readUInt32LE(4) !== 2 || data.readUInt32LE(8) !== data.length) {
    throw new Error(`Invalid or truncated GLB: ${path}`);
  }
  const length = data.readUInt32LE(12);
  if (data.readUInt32LE(16) !== 0x4e4f534a || 20 + length > data.length) throw new Error(`Missing GLB JSON: ${path}`);
  return JSON.parse(data.toString('utf8', 20, 20 + length));
}

export function verifyAssets(root = 'public') {
  const character = readGLB(resolve(root, 'models/character.glb'));
  const sofa = readGLB(resolve(root, 'models/lounge-sofa.glb'));
  if (!character.skins?.length || !character.meshes?.length) throw new Error('The agent rig is missing.');
  for (const name of ['Idle', 'Talk', 'Walk']) {
    if (!character.animations?.some(clip => clip.name.toLowerCase() === name.toLowerCase())) throw new Error(`Agent animation missing: ${name}`);
  }
  if (!sofa.meshes?.length) throw new Error('The lounge furniture has no geometry.');
  console.log(`Verified ${root}: rigged agents, Idle/Talk/Walk animations, ${sofa.meshes.length} furniture meshes.`);
}

if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) verifyAssets(process.argv[2]);
