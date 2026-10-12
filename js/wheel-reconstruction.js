/**
 * A photo-traced solid wheel, never a photo plane or a substituted spoke preset.
 * Supply the local import-map Three namespace: buildPhotoWheel(THREE, record, opts).
 *
 * record = { id, coordinateSystem: 'unit-radius-y-up',
 *   shapes: [{ outer: [[x,y], ...], holes: [[[x,y], ...], ...] }],
 *   profile: { radius: 1.032, frontZ: .33, concavity: .12,
 *     faceThickness: .06, bevel: .0025 }, source: { src, rectificationApproximate } }
 * Optional surfaceDetails: [{ id, outer, holes, height: .008,
 *   materialHint: 'metal' | 'chrome' | 'dark' }], in the same coordinates.
 * These raised polygons follow the same concavity and describe observed detail,
 * not new holes through the underlying face. Their outlines must stay on metal.
 * Coordinates describe the complete visible metal, including its original hub.
 * Depth and the rear barrel are visual estimates, not manufacturer CAD or fitment.
 * Optional opts.faceTexture is a caller-supplied source/detail texture. Its lifetime
 * follows the returned group; this module does not fetch images or invent branding.
 */

import { addOartsCap } from './wheel-brand-cap.js?v=20261011-wheel-fidelity-v1';

const EPSILON = 1e-8;
const SCULPT_FIELDS = new WeakMap();
const FINISHES = {
  gloss: [.19, .9, .12], satin: [.3, .35, .28], matte: [.56, .03, .5],
  brushed: [.34, .18, .3], chrome: [.15, .8, .12],
};

function invalid(message) {
  const error = new Error(message);
  error.name = 'InvalidWheelReconstructionError';
  error.code = 'NFW_WHEEL_RECONSTRUCTION_INVALID';
  return error;
}

function number(value, minimum, maximum, fallback) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value)) : fallback;
}

function area(points) {
  return points.reduce((sum, p, index) => {
    const next = points[(index + 1) % points.length];
    return sum + p[0] * next[1] - next[0] * p[1];
  }, 0) / 2;
}

function ring(input, clockwise, mirror, minimumArea = EPSILON) {
  if (!Array.isArray(input) || input.length < 3) throw invalid('A traced contour needs at least three points.');
  const points = [];
  for (const point of input) {
    if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)
      || Math.hypot(...point) > 1.01) throw invalid('Trace points must use finite unit-radius coordinates.');
    const p = [mirror ? -point[0] : point[0], point[1]], previous = points.at(-1);
    if (!previous || Math.hypot(p[0] - previous[0], p[1] - previous[1]) > EPSILON) points.push(p);
  }
  if (points.length > 1 && Math.hypot(points[0][0] - points.at(-1)[0], points[0][1] - points.at(-1)[1]) < EPSILON) points.pop();
  if (points.length < 3 || Math.abs(area(points)) < minimumArea) throw invalid('A traced contour has no usable area.');
  if ((area(points) < 0) !== clockwise) points.reverse();
  return points;
}

function inside(point, polygon) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > point[1]) !== (b[1] > point[1])
      && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}

function contours(record, mirror) {
  if (!record || record.coordinateSystem !== 'unit-radius-y-up'
    || !Array.isArray(record.shapes) || !record.shapes.length || record.shapes.length > 256) {
    throw invalid('A normalized photo trace is required; no generic wheel is substituted.');
  }
  let points = 0;
  return record.shapes.map(entry => {
    const outer = ring(entry.outer, true, mirror);
    if (entry.holes !== undefined && !Array.isArray(entry.holes)) throw invalid('Trace holes must be an array.');
    const holes = (entry.holes || []).map(hole => ring(hole, false, mirror));
    for (const hole of holes) if (!hole.every(p => inside(p, outer))) throw invalid('A trace hole lies outside its metal contour.');
    points += outer.length + holes.reduce((sum, hole) => sum + hole.length, 0);
    if (points > 20000) throw invalid('The photo trace needs simplification before meshing.');
    let bevelSections;
    if (entry.bevelSections) {
      const sections = entry.bevelSections;
      if (!Number.isFinite(sections.width) || sections.width < 0 || sections.width > .04
        || !Array.isArray(sections.inset) || !Array.isArray(sections.bands)) throw invalid('Invalid robust bevel sections.');
      const section = part => ({ outer: ring(part.outer, true, mirror, EPSILON * EPSILON),
        holes: (part.holes || []).map(hole => ring(hole, false, mirror, EPSILON * EPSILON)), lipRegion: part.lipRegion === true });
      bevelSections = { width: sections.width, inset: sections.inset.map(section), bands: sections.bands.map(section) };
    }
    return { outer, holes, bevelSections };
  });
}

function makeShape(THREE, contour, radius) {
  const path = (points, Type) => {
    const result = new Type();
    points.forEach((p, index) => result[index ? 'lineTo' : 'moveTo'](p[0] * radius, p[1] * radius));
    result.closePath();
    return result;
  };
  const shape = path(contour.outer, THREE.Shape);
  shape.holes.push(...contour.holes.map(hole => path(hole, THREE.Path)));
  return shape;
}

function midpoint(a, b) {
  return a.map((value, index) => (value + b[index]) / 2);
}

function edgeLengthSquared(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

// Split every long shared edge on both incident triangles. Splitting only large
// face triangles would leave T-junctions against bevels and through-hole walls.
function subdivide(triangles, edge, budget, profile) {
  const threshold = edge * edge;
  // A narrow turned shoulder needs samples across its curvature as well as
  // around its circumference. Long triangles across that shoulder otherwise
  // interpolate its analytic normals over a visibly faceted curved surface.
  const radialBands = (profile?.innerFaceEdge ? profile.radialProfile || [] : []).slice(1).flatMap((point, i) => {
    const previous = profile.radialProfile[i];
    return point[0] < .89 && point[0] - previous[0] <= .11
      && Math.abs(point[1] - previous[1]) > .006 ? [[previous[0], point[0]]] : [];
  });
  // A reviewed plain concavity has no separate shoulder samples. Honour its
  // explicit quality hint over that bend, including shared cut-wall edges.
  if (profile?.innerFaceEdge && !profile.radialProfile && profile.concavity > 0) {
    radialBands.push([profile.concavityStart, Math.min(.89, profile.concavityEnd)]);
  }
  const shoulderThreshold = ((profile?.innerFaceEdge || .075) * (profile?.radius || 1)) ** 2;
  for (let pass = 0; pass < 14; pass++) {
    let changed = false;
    const next = [];
    for (const triangle of triangles) {
      const split = [0, 1, 2].map(i => {
        const a=triangle[i],b=triangle[(i+1)%3];
        if(edgeLengthSquared(a,b)>threshold)return true;
        if(!profile || (!profile.radialProfile && !profile.lipDepth && !radialBands.length))return false;
        const outer=Math.max(Math.hypot(a[0],a[1]),Math.hypot(b[0],b[1]))/profile.radius;
        const dx=b[0]-a[0],dy=b[1]-a[1],planarLength=dx*dx+dy*dy;
        if(outer>.89 && planarLength > ((profile.outerFaceEdge || .018)*profile.radius)**2)return true;
        if(planarLength<=shoulderThreshold || !radialBands.length)return false;
        const t=Math.min(1,Math.max(0,-(a[0]*dx+a[1]*dy)/planarLength));
        const inner=Math.hypot(a[0]+t*dx,a[1]+t*dy)/profile.radius;
        return radialBands.some(([start,end])=>outer>=start && inner<=end);
      });
      const count = split.filter(Boolean).length;
      let pieces;
      if (count === 0) pieces = [triangle];
      else if (count === 3) {
        const [a, b, c] = triangle, ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
        pieces = [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]];
      } else if (count === 1) {
        const i = split.indexOf(true), a = triangle[i], b = triangle[(i + 1) % 3], c = triangle[(i + 2) % 3];
        const ab = midpoint(a, b);
        pieces = [[a, ab, c], [ab, b, c]];
      } else {
        // Rotate so the two marked edges meet at b. Avoid long sliver diagonals
        // when all three edges are marked by using the four-way split above.
        const i = split[0] && split[1] ? 0 : split[1] && split[2] ? 1 : 2;
        const a = triangle[i], b = triangle[(i + 1) % 3], c = triangle[(i + 2) % 3];
        const ab = midpoint(a, b), bc = midpoint(b, c);
        pieces = edgeLengthSquared(a,bc)<edgeLengthSquared(ab,c)
          ? [[b,bc,ab],[a,ab,bc],[a,bc,c]] : [[b,bc,ab],[a,ab,c],[ab,bc,c]];
      }
      changed ||= count > 0;
      next.push(...pieces);
      if (next.length > budget) throw invalid('The reconstructed face exceeds its geometry budget.');
    }
    triangles = next;
    if (!changed) return triangles;
  }
  throw invalid('The photo trace could not be tessellated within the geometry budget.');
}

function radialHeight(r, profile) {
  if (profile.radialProfile?.length > 1) {
    const points = profile.radialProfile;
    if (r <= points[0][0]) return points[0][1] * profile.radius;
    for (let i = 1; i < points.length; i++) if (r <= points[i][0]) {
      const t = (r - points[i-1][0]) / (points[i][0] - points[i-1][0]);
      return (points[i-1][1] + (points[i][1] - points[i-1][1]) * t*t*(3-2*t)) * profile.radius;
    }
    return points.at(-1)[1] * profile.radius;
  }
  const t = Math.min(1, Math.max(0, (r-profile.concavityStart)/(profile.concavityEnd-profile.concavityStart)));
  let height = -profile.concavity*(1-t*t*(3-2*t));
  // A stepped multipiece/beadlock lip has a recessed inner seat and a raised
  // outer flange. This profile is specified individually from the photographs.
  if (profile.lipDepth > 0) {
    const a = profile.lipInnerRadius;
    const down = Math.min(1, Math.max(0,(r-a)/.022));
    const up = Math.min(1,Math.max(0,(r-.955)/.03));
    height -= profile.lipDepth * profile.radius * down*down*(3-2*down)*(1-up*up*(3-2*up));
  }
  return height;
}

function sculptHeight(x, y, profile) {
  const map = profile.sculptMap;
  if (!map || map.encoding !== 'uint8-base64' || map.size < 8) return 0;
  let field = SCULPT_FIELDS.get(map);
  if (!field) {
    field = Uint8Array.from(atob(map.data), c=>c.charCodeAt(0));
    if (field.length !== map.size*map.size) throw invalid('Invalid sculpt field size.');
    SCULPT_FIELDS.set(map,field);
  }
  const px = Math.min(map.size-1,Math.max(0,((profile.mirror?-x:x)/profile.radius+1)/2*(map.size-1)));
  const py = Math.min(map.size-1,Math.max(0,(1-y/profile.radius)/2*(map.size-1)));
  const ix = Math.floor(px), iy = Math.floor(py), tx=px-ix,ty=py-iy;
  const sample=(a,b)=>field[Math.min(b,map.size-1)*map.size+Math.min(a,map.size-1)]/255;
  return ((1-ty)*((1-tx)*sample(ix,iy)+tx*sample(ix+1,iy))+ty*((1-tx)*sample(ix,iy+1)+tx*sample(ix+1,iy+1)))
    * map.amplitude*profile.radius;
}

function dish(x, y, profile) {
  if (profile.radialProfile || profile.sculptMap || profile.lipDepth) {
    const height=(a,b)=>radialHeight(Math.hypot(a,b)/profile.radius,profile)+sculptHeight(a,b,profile);
    const e=.0025*profile.radius;
    return [height(x,y),(height(x+e,y)-height(x-e,y))/(2*e),(height(x,y+e)-height(x,y-e))/(2*e)];
  }
  const distance = Math.hypot(x, y), r = distance / profile.radius;
  const t = Math.min(1, Math.max(0, (r - profile.concavityStart) / (profile.concavityEnd - profile.concavityStart)));
  const height = -profile.concavity * (1 - t * t * (3 - 2 * t));
  const slope = distance > EPSILON && t > 0 && t < 1
    ? profile.concavity * 6 * t * (1 - t) / ((profile.concavityEnd - profile.concavityStart) * profile.radius * distance) : 0;
  return [height, x * slope, y * slope];
}

// Validated polygon offsets are prepared from the original source metal. Three's
// unconstrained vertex bevel offsets can self-intersect across a narrow spoke;
// these caps and rounded bands never leave the original metal footprint.
function robustFaceGeometry(THREE, shape, contour, profile, quality) {
  const sections = contour.bevelSections, width = sections.width * profile.radius;
  const backZ = profile.backZ ?? profile.frontZ - profile.faceThickness - 2 * width;
  const wallDepth = profile.frontZ - backZ - 2 * width;
  const byMaterial = [[], [], []], edgeSegments = [], cells = new Map();
  const cellSize = .035 * profile.radius, margin = width + .00002 * profile.radius;
  const cellKey = (x, y) => Math.floor(x / cellSize) + ':' + Math.floor(y / cellSize);
  for (const path of [contour.outer, ...contour.holes]) {
    const vertices = path.map(point => point.map(value => value * profile.radius)), arc = [0];
    for (let i = 0; i < vertices.length; i++) {
      const a = vertices[i], b = vertices[(i + 1) % vertices.length];
      arc.push(arc.at(-1) + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    const perimeter = arc.at(-1), halfSpan = Math.min(.006 * profile.radius, perimeter / 16);
    const sample = distance => {
      distance = (distance % perimeter + perimeter) % perimeter;
      let low = 0, high = vertices.length;
      while (low + 1 < high) { const middle = (low + high) >> 1; if (arc[middle] <= distance) low = middle; else high = middle; }
      const a = vertices[low], b = vertices[(low + 1) % vertices.length], t = (distance - arc[low]) / (arc[low + 1] - arc[low]);
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    };
    const vertexNormals = vertices.map((_, i) => {
      const before = sample(arc[i] - halfSpan), after = sample(arc[i] + halfSpan);
      const dx = after[0] - before[0], dy = after[1] - before[1], length = Math.hypot(dx, dy);
      if (length > EPSILON) return [dy / length, -dx / length];
      const a = vertices[i], b = vertices[(i + 1) % vertices.length], edge = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return [(b[1] - a[1]) / edge, (a[0] - b[0]) / edge];
    });
    for (let i = 0; i < path.length; i++) {
      const a = vertices[i], b = vertices[(i + 1) % path.length];
      const dx = b[0] - a[0], dy = b[1] - a[1], lengthSquared = dx * dx + dy * dy;
      if (lengthSquared < EPSILON * EPSILON) continue;
      const segment = { x: a[0], y: a[1], dx, dy, lengthSquared,
        normalA: vertexNormals[i], normalB: vertexNormals[(i + 1) % path.length] }; edgeSegments.push(segment);
      for (let x = Math.floor((Math.min(a[0], b[0]) - margin) / cellSize); x <= Math.floor((Math.max(a[0], b[0]) + margin) / cellSize); x++) {
        for (let y = Math.floor((Math.min(a[1], b[1]) - margin) / cellSize); y <= Math.floor((Math.max(a[1], b[1]) + margin) / cellSize); y++) {
          const key = x + ':' + y; if (!cells.has(key)) cells.set(key, []); cells.get(key).push(segment);
        }
      }
    }
  }
  const boundary = (x, y) => {
    let distanceSquared = Infinity, nearest, along = 0;
    for (const segment of cells.get(cellKey(x, y)) || edgeSegments) {
      const t = Math.min(1, Math.max(0, ((x - segment.x) * segment.dx + (y - segment.y) * segment.dy) / segment.lengthSquared));
      const ax = x - segment.x - t * segment.dx, ay = y - segment.y - t * segment.dy, d = ax * ax + ay * ay;
      if (d < distanceSquared) { distanceSquared = d; nearest = segment; along = t; }
    }
    const distance = Math.sqrt(distanceSquared);
    // Both clockwise outer loops and counterclockwise apertures put the metal
    // to the right of the directed boundary. A local arc tangent shades the
    // physical cut continuously without moving its exact pixel-traced edge.
    const nx = nearest.normalA[0] * (1 - along) + nearest.normalB[0] * along;
    const ny = nearest.normalA[1] * (1 - along) + nearest.normalB[1] * along;
    const length = Math.hypot(nx, ny);
    const edgeLength = Math.sqrt(nearest.lengthSquared);
    return [distance > .000001 * profile.radius ? distance : 0,
      length > EPSILON ? nx / length : nearest.dy / edgeLength,
      length > EPSILON ? ny / length : -nearest.dx / edgeLength];
  };
  const shapeTriangles = part => {
    const geometry = new THREE.ShapeGeometry(makeShape(THREE, part, profile.radius), 1);
    try {
      const positions = geometry.attributes.position, indices = geometry.index, triangles = [];
      for (let i = 0; i < (indices?.count || positions.count); i += 3) {
        triangles.push([0, 1, 2].map(offset => {
          const v = indices ? indices.getX(i + offset) : i + offset;
          return [positions.getX(v), positions.getY(v), 0, 0, 0, 1];
        }));
      }
      return subdivide(triangles, quality.edge, quality.budget, profile);
    } finally { geometry.dispose(); }
  };
  const surfaceVertex = (vertex, front, band) => {
    const [x, y] = vertex, sign = front ? 1 : -1;
    let z = front ? profile.frontZ : backZ;
    let nx = 0, ny = 0, nz = sign;
    if (band && width > 0) {
      const [distance, ix, iy] = boundary(x, y), t = Math.min(1, Math.max(0, distance / width));
      const curve = Math.sqrt(Math.max(0, t * (2 - t)));
      const slope = Math.min(50, (1 - t) / Math.max(.00001, curve));
      z = (front ? profile.frontZ - width : backZ + width) + sign * width * curve;
      nx = -ix * slope; ny = -iy * slope;
    }
    const [height, dx, dy] = dish(x, y, profile), ax = nx - dx * nz, ay = ny - dy * nz;
    const length = Math.hypot(ax, ay, nz);
    return [Math.fround(x), Math.fround(y), Math.fround(z + height), ax / length, ay / length, nz / length];
  };
  for (const [band, parts] of [[false, sections.inset], [true, sections.bands]]) for (const part of parts) {
    let triangles = shapeTriangles(part);
    if (profile.sculptMap && !band) {
      triangles = triangles.flatMap(triangle => {
        const center = triangle[0].map((_, i) => (triangle[0][i] + triangle[1][i] + triangle[2][i]) / 3);
        const actual = dish(center[0], center[1], profile)[0];
        const linear = triangle.reduce((sum, vertex) => sum + dish(vertex[0], vertex[1], profile)[0], 0) / 3;
        return Math.abs(actual - linear) > .0005 * profile.radius
          ? [[triangle[0], triangle[1], center], [triangle[1], triangle[2], center], [triangle[2], triangle[0], center]] : [triangle];
      });
    }
    const material = part.lipRegion && quality.lipRadius ? 2 : band ? 1 : 0;
    for (const triangle of triangles) {
      byMaterial[material].push(triangle.map(vertex => surfaceVertex(vertex, true, band)));
      byMaterial[1].push([...triangle].reverse().map(vertex => surfaceVertex(vertex, false, band)));
    }
  }
  const walls = new THREE.ExtrudeGeometry(shape, { depth: wallDepth, steps: 1, bevelEnabled: false, curveSegments: 1 });
  try {
    const positions = walls.attributes.position, normals = walls.attributes.normal, triangles = [];
    for (let i = 0; i < positions.count; i += 3) {
      if ([0, 1, 2].some(offset => Math.abs(normals.getZ(i + offset)) > .01)) continue;
      triangles.push([0, 1, 2].map(offset => {
        const v = i + offset;
        return [positions.getX(v), positions.getY(v), positions.getZ(v), normals.getX(v), normals.getY(v), normals.getZ(v)];
      }));
    }
    for (const triangle of subdivide(triangles, quality.edge, quality.budget, profile)) {
      byMaterial[1].push(triangle.map(([x, y, z, nx, ny, nz]) => {
        const [, ix, iy] = boundary(x, y); nx = -ix; ny = -iy;
        const [height, dx, dy] = dish(x, y, profile), ax = nx - dx * nz, ay = ny - dy * nz;
        const length = Math.hypot(ax, ay, nz);
        return [Math.fround(x), Math.fround(y), Math.fround(z + backZ + width + height),
          ...(length > EPSILON ? [ax / length, ay / length, nz / length] : [0, 0, 0])];
      }));
    }
  } finally { walls.dispose(); }
  if (byMaterial.reduce((sum, triangles) => sum + triangles.length, 0) > quality.budget) throw invalid('The reconstructed face exceeds its geometry budget.');
  const geometry = new THREE.BufferGeometry(), positions = [], normals = [], uvs = [], indices = [], unique = new Map();
  let removedDegenerateTriangles = 0, repairedZeroNormals = 0;
  byMaterial.forEach((triangles, materialIndex) => {
    const start = indices.length;
    for (const triangle of triangles) {
      const [a, b, c] = triangle, ab = b.slice(0, 3).map((v, i) => v - a[i]), ac = c.slice(0, 3).map((v, i) => v - a[i]);
      const plane = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
      const planeLength = Math.hypot(...plane);
      if (planeLength === 0) {
        removedDegenerateTriangles++; continue;
      }
      for (const vertex of triangle) {
        if (Math.hypot(...vertex.slice(3)) < EPSILON) {
          vertex.splice(3, 3, ...plane.map(value => value / planeLength)); repairedZeroNormals++;
        }
        const key = vertex.map(value => Math.round(value * 1e6)).join(','); let index = unique.get(key);
        if (index === undefined) {
          index = unique.size; unique.set(key, index); positions.push(...vertex.slice(0, 3)); normals.push(...vertex.slice(3));
          uvs.push(.5 + (quality.mirror ? -vertex[0] : vertex[0]) / (2 * profile.radius), .5 + vertex[1] / (2 * profile.radius));
        }
        indices.push(index);
      }
    }
    if (indices.length > start) geometry.addGroup(start, indices.length - start, materialIndex);
  });
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.userData = { wheelSpoke: true, photoTraced: true, throughHoles: contour.holes.length,
    robustBevel: true, bevelWidth: width, removedDegenerateTriangles, repairedZeroNormals };
  return geometry;
}

function faceGeometry(THREE, shape, profile, quality, contour) {
  if (contour?.bevelSections) return robustFaceGeometry(THREE, shape, contour, profile, quality);
  const blank = new THREE.ExtrudeGeometry(shape, {
    depth: profile.faceThickness, steps: 1, bevelEnabled: profile.bevel > 0,
    bevelSegments: 3, bevelSize: profile.bevel, bevelThickness: profile.bevel,
    // Keep the maximum outline at the traced silhouette, not outside it.
    bevelOffset: -profile.bevel, curveSegments: 12,
  });
  try {
    const positions = blank.getAttribute('position'), normals = blank.getAttribute('normal');
    const front = [], other = [];
    for (let index = 0; index < positions.count; index += 3) {
      const triangle = [0, 1, 2].map(offset => {
        const i = index + offset;
        return [positions.getX(i), positions.getY(i), positions.getZ(i), normals.getX(i), normals.getY(i), normals.getZ(i)];
      });
      (triangle.every(v => v[5] > .999) ? front : other).push(triangle);
    }
    const tessellated = [subdivide(front, quality.edge, quality.budget,profile), subdivide(other, quality.edge, quality.budget,profile)];
    if (profile.sculptMap) {
      // Thin spokes often have only boundary vertices even after edge splitting.
      // Add an interior crown sample only where the observed cross section
      // differs materially from the linear triangle. Shared edges stay intact.
      tessellated[0] = tessellated[0].flatMap(triangle=>{
        const center=triangle[0].map((_,i)=>(triangle[0][i]+triangle[1][i]+triangle[2][i])/3);
        const actual=dish(center[0],center[1],profile)[0];
        const linear=triangle.reduce((sum,v)=>sum+dish(v[0],v[1],profile)[0],0)/3;
        return Math.abs(actual-linear)>.0005*profile.radius
          ? [[triangle[0],triangle[1],center],[triangle[1],triangle[2],center],[triangle[2],triangle[0],center]] : [triangle];
      });
    }
    if (tessellated[0].length + tessellated[1].length > quality.budget) throw invalid('The reconstructed face exceeds its geometry budget.');
    if(quality.lipRadius) {
      const inner=[],outer=[];
      for(const triangle of tessellated[0]) {
        const x=triangle.reduce((s,p)=>s+p[0],0)/3,y=triangle.reduce((s,p)=>s+p[1],0)/3;
        (Math.hypot(x,y)>quality.lipRadius?outer:inner).push(triangle);
      }
      tessellated[0]=inner;tessellated.push(outer);
    }
    const positionArray = [], normalArray = [], uvArray = [], geometry = new THREE.BufferGeometry();
    let start = 0, removedDegenerateTriangles = 0, repairedZeroNormals = 0;
    tessellated.forEach((triangles, materialIndex) => {
      for (const triangle of triangles) {
        const warped = triangle.map(([x, y, z, nx, ny, nz]) => {
          const [height, dx, dy] = dish(x, y, profile);
          // Check the same Float32 positions that will reach the renderer/GLB.
          const position = [Math.fround(x), Math.fround(y),
            Math.fround(z + profile.frontZ - profile.faceThickness - profile.bevel + height)];
          // Inverse-transpose of z' = z + dish(x,y) retains smooth front normals.
          const ax = nx - dx * nz, ay = ny - dy * nz, length = Math.hypot(ax, ay, nz);
          return { position, normal: length > EPSILON ? [ax / length, ay / length, nz / length] : null };
        });
        const [a, b, c] = warped.map(vertex => vertex.position);
        const ab = b.map((value, axis) => value - a[axis]), ac = c.map((value, axis) => value - a[axis]);
        const plane = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
        const planeLength = Math.hypot(...plane);
        if (planeLength === 0) { removedDegenerateTriangles++; continue; }
        // ExtrudeGeometry can produce zero normals at tiny bevel corners. The
        // actual warped triangle supplies their normal; healthy cap normals stay
        // analytical so the broad concave front does not acquire flat facets.
        const geometricNormal = plane.map(value => value / planeLength);
        for (const vertex of warped) {
          const [x, y] = vertex.position;
          positionArray.push(...vertex.position);
          if (!vertex.normal) repairedZeroNormals++;
          normalArray.push(...(vertex.normal || geometricNormal));
          // Reflected geometry samples the matching ORIGINAL image point.
          uvArray.push(.5 + (quality.mirror ? -x : x) / (2 * profile.radius), .5 + y / (2 * profile.radius));
        }
      }
      const count = positionArray.length / 3 - start;
      geometry.addGroup(start, count, materialIndex);
      start += count;
    });
    if(profile.sculptMap) {
      // Reuse vertices with the same position and shading normal. Material
      // groups retain index ranges, while mobile GPU buffers become much smaller.
      const unique=new Map(),positions=[],normals=[],uvs=[],indices=[];
      for(let i=0;i<positionArray.length/3;i++) {
        const values=[...positionArray.slice(i*3,i*3+3),...normalArray.slice(i*3,i*3+3)];
        const key=values.map(v=>Math.round(v*1e6)).join(',');let index=unique.get(key);
        if(index===undefined) {index=unique.size;unique.set(key,index);positions.push(...values.slice(0,3));
          normals.push(...values.slice(3));uvs.push(uvArray[i*2],uvArray[i*2+1]);}
        indices.push(index);
      }
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);
    } else {
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positionArray, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normalArray, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvArray, 2));
    }
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    geometry.userData = { wheelSpoke: true, photoTraced: true, throughHoles: shape.holes.length,
      removedDegenerateTriangles, repairedZeroNormals };
    return geometry;
  } finally { blank.dispose(); }
}

function settings(record, opts) {
  const p = record.profile || {}, radius = number(opts.radius ?? p.radius, .5, 2, 1.032);
  const diameter = number(Number(opts.diameter), 17, 24, 20), width = number(Number(opts.width), 7, 13.5, 10);
  const depth = number(opts.depth, .25, 2, width / diameter * 1.8 * radius / 1.032);
  const faceThickness = number(p.faceThickness, .012 * radius, .15 * radius, .06);
  const concavityStart = number(p.concavityStart, 0, .7, .18);
  return {
    radius, diameter, width, depth, faceThickness,
    frontZ: number(opts.frontZ ?? p.frontZ, -.5, 1, .33),
    bevel: number(p.bevel, 0, Math.min(faceThickness / 4, .012 * radius), .0025),
    concavity: number(opts.concavity ?? p.concavity, 0, Math.min(.45 * radius, depth - faceThickness - .08), .12),
    concavityStart, concavityEnd: number(p.concavityEnd, concavityStart + .05, 1, .96),
    radialProfile: p.radialProfile, sculptMap: p.sculptMap, mirror: opts.mirror === true,
    outerFaceEdge: number(opts.maxOuterFaceEdge ?? p.maxOuterFaceEdge,.012,.035,.018),
    innerFaceEdge: number(opts.maxInnerFaceEdge ?? p.maxInnerFaceEdge,.008,.035,0),
    lipInnerRadius: number(p.lipInnerRadius,.65,.99,.95), lipDepth: number(p.lipDepth,0,.2,0),
  };
}

function material(THREE, opts, colour) {
  const finish = Object.hasOwn(FINISHES, opts.finish) ? opts.finish : 'satin';
  const [roughness, clearcoat, clearcoatRoughness] = FINISHES[finish];
  const c = new THREE.Color(colour), black = c.r*.2126+c.g*.7152+c.b*.0722 < .04;
  const metallic = finish==='chrome'||finish==='brushed' ? 1 : black ? .24 : finish==='matte' ? .55 : .86;
  return new THREE.MeshPhysicalMaterial({ color: colour, metalness: metallic,
    roughness: number(opts.roughness,.035,.8,roughness),
    clearcoat, clearcoatRoughness, envMapIntensity: 1,
    anisotropy: finish === 'brushed' ? .3 : 0, anisotropyRotation: Math.PI / 2 });
}

function addMesh(THREE, group, geometry, surface, name) {
  const mesh = new THREE.Mesh(geometry, surface);
  mesh.name = name; mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function combineFasteners(THREE,group,ownedGeometries) {
  for(const type of ['washer','head','socket']) {
    const parts=group.children.filter(p=>new RegExp('^Observed_fastener_\\d+_'+type+'$').test(p.name));
    if(!parts.length)continue;
    const positions=[],normals=[],uvs=[];
    for(const part of parts) {
      part.updateMatrix();const normalMatrix=new THREE.Matrix3().getNormalMatrix(part.matrix);
      const geometry=part.geometry,p=geometry.attributes.position,n=geometry.attributes.normal;
      const count=geometry.index?.count||p.count;
      for(let i=0;i<count;i++) {
        const k=geometry.index?.array[i]??i;
        const v=new THREE.Vector3().fromBufferAttribute(p,k).applyMatrix4(part.matrix);
        const normal=new THREE.Vector3().fromBufferAttribute(n,k).applyMatrix3(normalMatrix).normalize();
        positions.push(v.x,v.y,v.z);normals.push(normal.x,normal.y,normal.z);uvs.push(0,0);
      }
      group.remove(part);geometry.dispose();
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData.observedFasteners=parts.length;
    ownedGeometries.push(geometry);
    addMesh(THREE,group,geometry,parts[0].material,`Observed_fasteners_${type}`).userData.observedFasteners=parts.length;
  }
}

/** Return an editable solid Group in the same +Z-facing frame as createWheel. */
export function buildPhotoWheel(THREE, record, opts = {}) {
  opts = {...record?.defaultOptions, ...opts};
  const traced = contours(record, opts.mirror === true), profile = settings(record, opts);
  const faceContours = record.faceShapes ? contours({ ...record, shapes: record.faceShapes }, opts.mirror === true) : traced;
  if (record.surfaceDetails !== undefined && !Array.isArray(record.surfaceDetails)) throw invalid('Surface details must be an array.');
  const details = record.surfaceDetails || [];
  const recesses = record.recessedDetails || [];
  if (!Array.isArray(recesses)) throw invalid('Blind pockets must be an array.');
  if (recesses.some(pocket => pocket.materialHint && !['metal','dark','chrome','lip'].includes(pocket.materialHint))) {
    throw invalid('Unknown blind-pocket material.');
  }
  const pocketContours = recesses.length ? contours({...record,shapes:recesses},opts.mirror===true) : [];
  const detailContours = details.length ? contours({ ...record, shapes: details }, opts.mirror === true) : [];
  for (const detail of details) {
    if (!Number.isFinite(detail.height) || detail.height <= 0 || detail.height > .12 * profile.radius) {
      throw invalid('Observed surface relief needs a positive, bounded height.');
    }
    if (detail.materialHint && !['metal', 'chrome', 'dark'].includes(detail.materialHint)) throw invalid('Unknown surface detail material.');
  }
  const group = new THREE.Group(); group.name = `NFW_photo_${record.id || 'trace'}`;
  const chosenColour = opts.color || opts.colorHex;
  const colour = /^#[\da-f]{6}$/i.test(chosenColour || '') ? chosenColour : '#b9bcc2';
  const face = material(THREE, opts, colour), cut = material(THREE, opts, colour);
  cut.color.multiplyScalar(.68); cut.roughness = Math.min(.7, cut.roughness + .14);
  // Brushing belongs to the visible face. A vertical milled edge has no
  // measured brushing direction and its front-projected UVs are singular.
  cut.anisotropy = 0;
  if (opts.faceTexture?.isTexture) {
    face.map = opts.faceTexture;
    if (opts.preserveSourceColour || !chosenColour) face.color.set('#ffffff');
  }
  const quality = { edge: number(opts.maxFaceEdge, .035, .25, .075) * profile.radius,
    budget: Math.round(number(opts.maxTriangles, 5000, 400000, 400000)), mirror: opts.mirror === true };
  const ownedGeometries = [], ownedMaterials = [face, cut];
  try {
    const lipFinish=opts.lip && opts.lip!=='same' ? opts.lip : record.profile?.lipFinish;
    const lipColour=opts.lip==='black'?'#111318':record.profile?.lipColor||
      (lipFinish==='chrome'||lipFinish==='polished'?'#d3d5d8':lipFinish==='black'?'#111318':colour);
    let faceLip=null;
    if(lipColour!==colour||lipFinish==='chrome'||lipFinish==='polished') {
      faceLip=material(THREE,{finish:lipFinish==='chrome'||lipFinish==='polished'?'chrome':opts.finish},lipColour);
      ownedMaterials.push(faceLip);quality.lipRadius=profile.lipInnerRadius*profile.radius;
    }
    faceContours.forEach((contour, index) => {
      const pockets = pocketContours.filter(p=>p.outer.every(point=>inside(point,contour.outer))
        && !contour.holes.some(h=>p.outer.some(point=>inside(point,h))));
      const shape = makeShape(THREE,record.faceShapes ? contour : {...contour,holes:[...contour.holes,...pockets.map(p=>p.outer)]},profile.radius);
      const geometry = faceGeometry(THREE, shape, profile, quality, contour);
      geometry.userData.throughHoles = traced[index]?.holes.length ?? contour.holes.length;
      geometry.userData.blindPockets = pockets.length;
      ownedGeometries.push(geometry);
      addMesh(THREE, group, geometry, faceLip?[face,cut,faceLip]:[face, cut], `Photo_traced_face_${index}`);
    });
    const detailQuality={...quality};delete detailQuality.lipRadius;
    const floorMaterials = new Map([['metal', [face,cut]]]);
    const pocketMaterials = hint => {
      if (!floorMaterials.has(hint)) {
        const top = hint === 'lip' ? faceLip || material(THREE,{finish:lipFinish==='chrome'||lipFinish==='polished'?'chrome':opts.finish},lipColour)
          : hint === 'chrome' ? material(THREE,{finish:'chrome'},'#c8c8c4')
            : material(THREE,{finish:'satin'},'#101215');
        if (top !== faceLip) ownedMaterials.push(top);
        floorMaterials.set(hint,[top,cut]);
      }
      return floorMaterials.get(hint);
    };
    recesses.forEach((pocket,index)=>{
      // A closed engraved outline leaves its central metal island at the
      // original face height. Source aperture holes in that island stay open.
      if(pocket.preservedIslands?.length) {
        const islands=contours({...record,shapes:pocket.preservedIslands},opts.mirror===true);
        for(const [islandIndex,island] of islands.entries()) {
          const geometry=faceGeometry(THREE,makeShape(THREE,island,profile.radius),profile,detailQuality,island);
          delete geometry.userData.throughHoles;geometry.userData.preservedPocketIsland=true;ownedGeometries.push(geometry);
          addMesh(THREE,group,geometry,[face,cut],`Observed_pocket_island_${index}_${islandIndex}`);
        }
      }
      const depth=Math.min(number(pocket.depth,.002,.12,.012)*profile.radius,profile.faceThickness*.72);
      const floorThickness=profile.faceThickness-depth;
      const floorProfile={...profile,frontZ:profile.frontZ-depth,faceThickness:floorThickness,
        backZ:profile.frontZ-profile.faceThickness-2*profile.bevel,
        bevel:Math.min(profile.bevel,depth/3,floorThickness/4)};
      const geometry=faceGeometry(THREE,makeShape(THREE,pocketContours[index],profile.radius),floorProfile,detailQuality,pocketContours[index]);
      delete geometry.userData.throughHoles; geometry.userData.recessedDetail=true;
      ownedGeometries.push(geometry);
      addMesh(THREE,group,geometry,pocketMaterials(pocket.materialHint||'metal'),`Observed_blind_pocket_${pocket.id||index}`);
    });
    const detailMaterials = new Map([['metal', [face, cut]]]);
    details.forEach((detail, index) => {
      const hint = detail.materialHint || 'metal';
      if (!detailMaterials.has(hint)) {
        const top = material(THREE, { finish: hint === 'chrome' ? 'chrome' : 'satin' }, hint === 'chrome' ? '#c8c8c4' : '#141619');
        if (hint === 'dark') { top.metalness = .65; top.roughness = .4; }
        const edge = top.clone(); edge.color.multiplyScalar(.68); edge.roughness = Math.min(.7, top.roughness + .14);
        ownedMaterials.push(top, edge); detailMaterials.set(hint, [top, edge]);
      }
      const reliefProfile = { ...profile, frontZ: profile.frontZ + detail.height,
        faceThickness: detail.height, bevel: Math.min(profile.bevel, detail.height / 4) };
      const geometry = faceGeometry(THREE, makeShape(THREE, detailContours[index], profile.radius), reliefProfile, detailQuality,detailContours[index]);
      // Annular holes in a raised feature do not count as through-holes in the wheel.
      delete geometry.userData.throughHoles;
      geometry.userData.surfaceDetail = true;
      ownedGeometries.push(geometry);
      const part = addMesh(THREE, group, geometry, detailMaterials.get(hint), `Observed_relief_${detail.id || index}`);
      part.userData.surfaceDetail = { id: detail.id, height: detail.height, materialHint: hint };
    });
    // Circular mounting apertures are recognized from their own source contour,
    // never from an assumed bolt count or a generic pitch-circle template.
    for (const contour of traced) for (const opening of contour.holes) {
      const x=opening.reduce((sum,p)=>sum+p[0],0)/opening.length;
      const y=opening.reduce((sum,p)=>sum+p[1],0)/opening.length;
      const holeRadius=Math.sqrt(Math.abs(area(opening))/Math.PI);
      const centerRadius=Math.hypot(x,y), distances=opening.map(p=>Math.hypot(p[0]-x,p[1]-y));
      if(centerRadius<.13||centerRadius>.34||holeRadius<.014||holeRadius>.075
        ||Math.max(...distances)/Math.min(...distances)>1.65) continue;
      const rr=Math.max(...distances)*1.012*profile.radius,z=profile.frontZ+dish(x*profile.radius,y*profile.radius,profile)[0];
      const points=[[rr,z-.004],[rr*1.18,z+.001],[rr*1.40,z+.007],[rr*1.48,z+.006],
        [rr*1.53,z+.001],[rr*1.53,z-.005],[rr,z-.004]];
      const geometry=new THREE.LatheGeometry(points.map(([a,b])=>new THREE.Vector2(a,-b)),64);
      geometry.normalizeNormals();geometry.userData.observedMountingWell=true;ownedGeometries.push(geometry);
      const well=addMesh(THREE,group,geometry,cut,'Observed_mounting_well');well.rotation.x=-Math.PI/2;
      well.position.set(x*profile.radius,y*profile.radius,0);
    }
    // Closed annular section, with a real hollow barrel, drop centre, bead seats
    // and rolled rear lip. Lathe Y becomes -Z, as in the existing showroom.
    const r = profile.radius, f = profile.frontZ, rear = f - profile.depth;
    const points = [
      [.985 * r, f - .025], [r, f - .045], [r, f - .075], [.968 * r, f - .1],
      [.955 * r, f - .15], [.941 * r, rear + .17], [.970 * r, rear + .05],
      [.985 * r, rear + .022], [.985 * r, rear], [.936 * r, rear],
      [.922 * r, rear + .075], [.918 * r, f - .15], [.936 * r, f - .065],
      [.955 * r, f - .025], [.985 * r, f - .025],
    ];
    const barrelGeometry = new THREE.LatheGeometry(points.map(([x, z]) => {
      // The turned barrel joins behind the dished face, rather than crossing
      // its recessed shelf and showing jagged intersections through the metal.
      const noseZ = z > f - .18
        ? Math.min(z, f + radialHeight(x / r, profile) - profile.faceThickness - .02) : z;
      return new THREE.Vector2(x, -noseZ);
    }), 160);
    barrelGeometry.normalizeNormals();
    ownedGeometries.push(barrelGeometry);
    const barrelMaterial=material(THREE,{...opts,finish:record.profile?.barrelFinish||opts.finish},record.profile?.barrelColor||colour);
    ownedMaterials.push(barrelMaterial);
    const barrel = addMesh(THREE, group, barrelGeometry, barrelMaterial, 'Approximate_rear_barrel');
    barrel.rotation.x = -Math.PI / 2;
    if (profile.lipInnerRadius < .94 || lipFinish && lipFinish !== 'same') {
      const polished=lipFinish==='chrome'||lipFinish==='polished'||(!lipFinish&&profile.lipInnerRadius<.87);
      const lipMaterial=material(THREE,{finish:polished?'chrome':opts.finish},lipColour);
      ownedMaterials.push(lipMaterial);
      // A continuous turned flange cannot bridge any photographed aperture or
      // recessed shelf pocket. The source-traced face models the inner seat.
      const openingExtent=Math.max(0,...traced.flatMap(c=>c.holes.flatMap(h=>h.map(p=>Math.hypot(...p)))),
        ...pocketContours.flatMap(c=>c.outer.map(p=>Math.hypot(...p))));
      const a=Math.min(.996,Math.max(.94,profile.lipInnerRadius,openingExtent+.002)), b=.997;
      const lipPoints=[];
      for(let i=0;i<=40;i++) {const t=i/40, rr=a+(b-a)*t; lipPoints.push(new THREE.Vector2(rr*r,-(f+radialHeight(rr,profile)+.0015)));}
      for(let i=40;i>=0;i--) {const rr=a+(b-a)*i/40; lipPoints.push(new THREE.Vector2(rr*r,-(f+radialHeight(rr,profile)-.005)));}
      lipPoints.push(lipPoints[0].clone());
      const geometry=new THREE.LatheGeometry(lipPoints,192); geometry.normalizeNormals(); ownedGeometries.push(geometry);
      const lip=addMesh(THREE,group,geometry,lipMaterial,'Observed_turned_front_lip');lip.rotation.x=-Math.PI/2;
    }
    const hardware = [];
    const hardwareProfile=record.profile||{};
    if (hardwareProfile.hardware?.length) {
      hardware.push(...hardwareProfile.hardware);
    } else if (hardwareProfile.hardwarePositions?.length) {
      for(const [x,y] of hardwareProfile.hardwarePositions) hardware.push({x,y,size:hardwareProfile.hardwareSize||.013,style:'socket'});
    } else {
      const rings=hardwareProfile.hardwareRings|| (hardwareProfile.hardwareCount>0 ? [{count:hardwareProfile.hardwareCount,
        radius:hardwareProfile.hardwareRadius||.88,size:hardwareProfile.hardwareSize||.014,rotation:hardwareProfile.hardwareRotation||0}] : []);
      for(const ring of rings) {
        const angles=ring.angles||Array.from({length:Math.min(80,ring.count||0)},(_,i)=>i*Math.PI*2/ring.count+(ring.rotation||0));
        for(const angle of angles) hardware.push({x:Math.cos(angle)*ring.radius,y:Math.sin(angle)*ring.radius,
          size:ring.size||.013,style:ring.style||'socket',zOffset:ring.zOffset||0});
      }
    }
    if(hardware.length) {
      const steel=material(THREE,{finish:'chrome'},hardwareProfile.hardwareColor||'#bdc0c5');
      const socket=new THREE.MeshStandardMaterial({color:'#101215',metalness:.5,roughness:.38});ownedMaterials.push(steel,socket);
      for(let i=0;i<hardware.length;i++) {
        const h=hardware[i],x=(opts.mirror?-h.x:h.x)*r,y=h.y*r,size=number(h.size,.006,.035,.013)*r;
        const z=f+dish(x,y,profile)[0]+(h.zOffset||0)*r;
        const g=new THREE.TorusGeometry(size,.0024*r,8,20);ownedGeometries.push(g);
        const washer=addMesh(THREE,group,g,steel,`Observed_fastener_${i}_washer`);washer.position.set(x,y,z+.002*r);
        const hg=new THREE.CylinderGeometry(size*.8,size*.88,.009*r,h.style==='hex'?6:20);ownedGeometries.push(hg);
        const head=addMesh(THREE,group,hg,steel,`Observed_fastener_${i}_head`);head.rotation.x=Math.PI/2;head.position.set(x,y,z+.004*r);
        const sg=new THREE.CylinderGeometry(size*.39,size*.39,.0015*r,6);ownedGeometries.push(sg);
        const inset=addMesh(THREE,group,sg,socket,`Observed_fastener_${i}_socket`);inset.rotation.x=Math.PI/2;inset.position.set(x,y,z+.009*r);
      }
      combineFasteners(THREE,group,ownedGeometries);
    }
    const capRadius = number(record.profile?.capRadius,.065,.22,.115)*r;
    let capSupportZ = f + dish(0,0,profile)[0];
    for (const part of group.children) {
      if (!part.name.startsWith('Photo_traced_face_') && !part.geometry?.userData.surfaceDetail
        && !part.geometry?.userData.preservedPocketIsland) continue;
      const positions = part.geometry.attributes.position, normals = part.geometry.attributes.normal;
      for (let i=0;i<positions.count;i++) if (normals.getZ(i) > .1
        && Math.hypot(positions.getX(i),positions.getY(i)) <= capRadius) capSupportZ = Math.max(capSupportZ,positions.getZ(i));
    }
    addOartsCap(THREE,group,{frontZ:capSupportZ+.01*r,
      radius:capRadius,cap:opts.cap||'black',color:colour,finish:opts.finish});
    if (opts.lip && opts.lip !== 'same') {
      const lipColour = opts.lip === 'black' ? '#141619' : '#c8c8c4';
      const lipMaterial = material(THREE, { finish: opts.lip === 'black' ? opts.finish : 'chrome' }, lipColour);
      ownedMaterials.push(lipMaterial);
      const lipGeometry = new THREE.TorusGeometry(.979 * r, .005 * r, 8, 160);
      ownedGeometries.push(lipGeometry);
      const lip = addMesh(THREE, group, lipGeometry, lipMaterial, 'Rear_lip_finish');
      lip.position.z = rear + .012;
    }
    group.userData = {
      options: { ...opts, design: record.id, diameter: profile.diameter, width: profile.width },
      reconstruction: { id: record.id, source: { ...record.source }, profile,
        silhouette: 'photo-traced', approximateDepth: true, approximateRear: true,
        rectificationApproximate: record.provenance?.rectificationApproximate === true
          || record.source?.rectificationApproximate === true,
        provenance: { ...record.provenance }, surfaceDetails: details.length,
        recessedDetails:recesses.length,hardwareCount:hardware.length,brand:'OARTS',
        label: '3D rekonstrukce podle obrazové předlohy; hloubka a zadní profil jsou přibližné.' },
      faceZ: profile.frontZ, rimRadius: profile.radius,
    };
    return group;
  } catch (error) {
    ownedGeometries.forEach(geometry => geometry.dispose());
    ownedMaterials.forEach(surface => surface.dispose());
    throw error;
  }
}
