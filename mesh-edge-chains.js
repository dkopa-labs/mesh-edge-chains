// Boundary-edge extraction and chain walking for triangle meshes.
//
// A triangle edge used by exactly one triangle is a boundary — between
// B-rep faces in a per-face tessellation, or the open rim of a
// non-watertight mesh. Segments are position-welded and deduped (faces
// sample shared edges independently), then walked into chains that stop
// at junction nodes (degree != 2).

function buildKey(vertexCount) {
  // Exact integer keys: doubles hold a<<32|b only while a < 2^21.
  const big = vertexCount >= 0x200000;
  return {
    key: big
      ? (a, b) => (a < b ? (BigInt(a) << 32n) | BigInt(b) : (BigInt(b) << 32n) | BigInt(a))
      : (a, b) => (a < b ? a * 4294967296 + b : b * 4294967296 + a),
    ends: big
      ? (k) => [Number(k >> 32n), Number(k & 0xffffffffn)]
      : (k) => [Math.floor(k / 4294967296), k % 4294967296],
  };
}

// position: Float32Array|Array xyz, index: Uint16/32Array|Array|null
// Returns { edges, groups, segGroup }
//   edges    Float32Array — deduped segment endpoints (pairs of xyz)
//   groups   [{ length, positions }] — one per chain; positions is a
//            Float32Array of the chain's segment endpoints in walk order
//   segGroup Uint32Array — segment index -> chain index
export function extractEdgeChains(position, index) {
  const vertexCount = position.length / 3;
  const { key, ends } = buildKey(vertexCount);

  const edgeCount = new Map();
  const triCount = index ? index.length / 3 : position.length / 9;
  for (let t = 0; t < triCount; t++) {
    const a = index ? index[t * 3] : t * 3;
    const b = index ? index[t * 3 + 1] : t * 3 + 1;
    const c = index ? index[t * 3 + 2] : t * 3 + 2;
    for (const [u, v] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      const k = key(u, v);
      edgeCount.set(k, (edgeCount.get(k) || 0) + 1);
    }
  }
  const segs = [];
  for (const [k, count] of edgeCount) {
    if (count !== 1) continue;
    segs.push(...ends(k));
  }

  // Weld endpoints by position — regions sample shared edges with their
  // own vertices, so the same edge appears once per adjacent region.
  const nodeId = new Map();
  const nodePos = [];
  const weld = (vi) => {
    const v = vi * 3;
    const nk = `${Math.round(position[v] * 1e5)},${Math.round(position[v + 1] * 1e5)},${Math.round(position[v + 2] * 1e5)}`;
    let n = nodeId.get(nk);
    if (n === undefined) {
      n = nodePos.length / 3;
      nodeId.set(nk, n);
      nodePos.push(position[v], position[v + 1], position[v + 2]);
    }
    return n;
  };
  const seen = new Set();
  const uniq = [];
  for (let s = 0; s < segs.length; s += 2) {
    const na = weld(segs[s]);
    const nb = weld(segs[s + 1]);
    if (na === nb) continue;
    const sk = na < nb ? na * 1e9 + nb : nb * 1e9 + na;
    if (seen.has(sk)) continue;
    seen.add(sk);
    uniq.push(na, nb);
  }
  const edges = new Float32Array(uniq.length * 3);
  uniq.forEach((n, i) => {
    edges[i * 3] = nodePos[n * 3];
    edges[i * 3 + 1] = nodePos[n * 3 + 1];
    edges[i * 3 + 2] = nodePos[n * 3 + 2];
  });

  // Chain segments into edges: walk adjacency, continuing only through
  // nodes of degree 2 — a junction ends the edge.
  const adj = new Map();
  for (let s = 0; s < uniq.length; s += 2) {
    for (const n of [uniq[s], uniq[s + 1]]) {
      let l = adj.get(n);
      if (!l) adj.set(n, (l = []));
      l.push(s);
    }
  }
  const used = new Set();
  const comps = [];
  for (let s = 0; s < uniq.length; s += 2) {
    if (used.has(s)) continue;
    used.add(s);
    const chain = [s];
    for (const [startNode, dir] of [
      [uniq[s + 1], 1],
      [uniq[s], -1],
    ]) {
      let node = startNode;
      while (true) {
        const next = (adj.get(node) || []).find((c) => !used.has(c));
        if (next === undefined || adj.get(node).length !== 2) break;
        used.add(next);
        if (dir === 1) chain.push(next);
        else chain.unshift(next);
        node = uniq[next] === node ? uniq[next + 1] : uniq[next];
      }
    }
    comps.push(chain);
  }

  const groups = [];
  const segGroup = new Uint32Array(uniq.length / 2);
  comps.forEach((chain, gi) => {
    const pos = new Float32Array(chain.length * 6);
    let length = 0;
    chain.forEach((si, j) => {
      pos.set(edges.subarray(si * 3, si * 3 + 6), j * 6);
      segGroup[si / 2] = gi;
      const a = uniq[si] * 3;
      const b = uniq[si + 1] * 3;
      length += Math.hypot(
        nodePos[a] - nodePos[b],
        nodePos[a + 1] - nodePos[b + 1],
        nodePos[a + 2] - nodePos[b + 2],
      );
    });
    groups.push({ length, positions: pos });
  });

  return { edges, groups, segGroup };
}
