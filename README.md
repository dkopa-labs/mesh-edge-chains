# mesh-edge-chains

Boundary-edge extraction and junction-aware chain walking for triangle meshes — the code behind edge display and edge-length measurement in the [DKOPA viewer](https://dkopa.com/viewer), published standalone. Zero dependencies; works on raw `position`/`index` arrays.

```js
import { extractEdgeChains } from 'mesh-edge-chains';

const { edges, groups, segGroup } = extractEdgeChains(position, index);

// edges    Float32Array — deduped segment endpoints (pairs of xyz)
// groups   [{ length, positions }] — one per chain; arc length + polyline
// segGroup Uint32Array — segment index -> chain index (pick -> chain)
```

### How it works

1. **Count** — a triangle edge used by exactly one triangle is a boundary. On B-rep tessellations where each face is meshed independently, that's *every* real CAD edge — no angle heuristic, so no false edges on fillets.
2. **Weld & dedup** — endpoints weld on a 1e5 spatial grid; coincident segments from adjacent regions collapse to one.
3. **Chain** — adjacency walking continues only through degree-2 nodes. Junctions end the edge, so chains are real edges, not the whole connected wireframe graph (naive union-find collapses everything into one component).

Each group carries its arc `length` and segment `positions` in walk order — ready for `THREE.LineSegments` or a measurement readout. `segGroup` maps a clicked segment back to its chain for highlight-by-edge.

### Notes

- On a watertight shared-vertex mesh, every edge has count 2 — you get only the open rim. That's correct: boundaries are what's left.
- Honest length, not exact: arc length follows the tessellation polyline. A NURBS edge's true length is inside the kernel; the polyline approaches it as deflection tightens.
- Runs happily in a Web Worker — inputs/outputs are transferable typed arrays.

### Demo

```bash
node demo.js
# plate: 1 chain(s), length 4.000
# cube: 12 edges, 12 chains
```

MIT — [DKOPA](https://dkopa.com)
