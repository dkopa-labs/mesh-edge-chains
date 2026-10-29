import { extractEdgeChains } from './mesh-edge-chains.js';

// 1. An open plate: the rim is one closed chain, length = perimeter.
const plate = {
  position: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
  index: new Uint16Array([0, 1, 2, 0, 2, 3]),
};
const r1 = extractEdgeChains(plate.position, plate.index);
console.log(`plate: ${r1.groups.length} chain(s), length ${r1.groups[0].length.toFixed(3)}`);

// 2. A B-rep-style cube: each face tessellated independently (24 verts,
// duplicated corners). Face boundaries appear once per face -> deduped
// to the 12 real edges; corner junctions keep chains separate.
const cubePos = [];
const cubeIdx = [];
const faces = [
  [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], // z=0
  [[0, 0, 1], [0, 1, 1], [1, 1, 1], [1, 0, 1]], // z=1
  [[0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1]], // x=0
  [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]], // x=1
  [[0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 0, 0]], // y=0
  [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]], // y=1
];
for (const f of faces) {
  const base = cubePos.length / 3;
  f.forEach((v) => cubePos.push(...v));
  cubeIdx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}
const r2 = extractEdgeChains(new Float32Array(cubePos), new Uint16Array(cubeIdx));
console.log(`cube: ${r2.edges.length / 6} edges, ${r2.groups.length} chains`);
