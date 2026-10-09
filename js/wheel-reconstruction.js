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

const EPSILON = 1e-8;
const FINISHES = {
  gloss: [.19, .9, .12], satin: [.3, .35, .28], matte: [.56, .03, .5],
  brushed: [.34, .18, .3], chrome: [.085, .8, .055],
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

function ring(input, clockwise, mirror) {
  if (!Array.isArray(input) || input.length < 3) throw invalid('A traced contour needs at least three points.');
  const points = [];
  for (const point of input) {
    if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)
      || Math.hypot(...point) > 1.01) throw invalid('Trace points must use finite unit-radius coordinates.');
    const p = [mirror ? -point[0] : point[0], point[1]], previous = points.at(-1);
    if (!previous || Math.hypot(p[0] - previous[0], p[1] - previous[1]) > EPSILON) points.push(p);
  }
  if (points.length > 1 && Math.hypot(points[0][0] - points.at(-1)[0], points[0][1] - points.at(-1)[1]) < EPSILON) points.pop();
  if (points.length < 3 || Math.abs(area(points)) < EPSILON) throw invalid('A traced contour has no usable area.');
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
    return { outer, holes };
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
function subdivide(triangles, edge, budget) {
  const threshold = edge * edge;
  for (let pass = 0; pass < 10; pass++) {
    let changed = false;
    const next = [];
    for (const triangle of triangles) {
      const split = [0, 1, 2].map(i => edgeLengthSquared(triangle[i], triangle[(i + 1) % 3]) > threshold);
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
        pieces = [[b, bc, ab], [a, ab, c], [ab, bc, c]];
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

function dish(x, y, profile) {
  const distance = Math.hypot(x, y), r = distance / profile.radius;
  const t = Math.min(1, Math.max(0, (r - profile.concavityStart) / (profile.concavityEnd - profile.concavityStart)));
  const height = -profile.concavity * (1 - t * t * (3 - 2 * t));
  const slope = distance > EPSILON && t > 0 && t < 1
    ? profile.concavity * 6 * t * (1 - t) / ((profile.concavityEnd - profile.concavityStart) * profile.radius * distance) : 0;
  return [height, x * slope, y * slope];
}

function faceGeometry(THREE, shape, profile, quality) {
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
    const tessellated = [subdivide(front, quality.edge, quality.budget), subdivide(other, quality.edge, quality.budget)];
    if (tessellated[0].length + tessellated[1].length > quality.budget) throw invalid('The reconstructed face exceeds its geometry budget.');
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
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positionArray, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normalArray, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvArray, 2));
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
  };
}

function material(THREE, opts, colour) {
  const finish = Object.hasOwn(FINISHES, opts.finish) ? opts.finish : 'satin';
  const [roughness, clearcoat, clearcoatRoughness] = FINISHES[finish];
  return new THREE.MeshPhysicalMaterial({ color: colour, metalness: 1, roughness,
    clearcoat, clearcoatRoughness, envMapIntensity: 1,
    anisotropy: finish === 'brushed' ? .3 : 0, anisotropyRotation: Math.PI / 2 });
}

function addMesh(THREE, group, geometry, surface, name) {
  const mesh = new THREE.Mesh(geometry, surface);
  mesh.name = name; mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

/** Return an editable solid Group in the same +Z-facing frame as createWheel. */
export function buildPhotoWheel(THREE, record, opts = {}) {
  const traced = contours(record, opts.mirror === true), profile = settings(record, opts);
  if (record.surfaceDetails !== undefined && !Array.isArray(record.surfaceDetails)) throw invalid('Surface details must be an array.');
  const details = record.surfaceDetails || [];
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
  if (opts.faceTexture?.isTexture) {
    face.map = opts.faceTexture;
    if (opts.preserveSourceColour || !chosenColour) face.color.set('#ffffff');
  }
  const quality = { edge: number(opts.maxFaceEdge, .04, .25, .1) * profile.radius,
    budget: Math.round(number(opts.maxTriangles, 5000, 200000, 160000)), mirror: opts.mirror === true };
  const ownedGeometries = [], ownedMaterials = [face, cut];
  try {
    traced.forEach((contour, index) => {
      const geometry = faceGeometry(THREE, makeShape(THREE, contour, profile.radius), profile, quality);
      ownedGeometries.push(geometry);
      addMesh(THREE, group, geometry, [face, cut], `Photo_traced_face_${index}`);
    });
    const detailMaterials = new Map([['metal', [face, cut]]]);
    details.forEach((detail, index) => {
      const hint = detail.materialHint || 'metal';
      if (!detailMaterials.has(hint)) {
        const top = material(THREE, { finish: hint === 'chrome' ? 'chrome' : 'satin' }, hint === 'chrome' ? '#c8c8c4' : '#141619');
        if (hint === 'dark') { top.metalness = .65; top.roughness = .4; }
        const edge = top.clone(); edge.color.multiplyScalar(.68); edge.roughness = Math.min(.7, top.roughness + .14);
        // An observed raised hub/rib keeps its real source artwork, including
        // supplied branding. The untextured cut edge retains the material hint.
        if (opts.faceTexture?.isTexture) {
          top.map = opts.faceTexture;
          if (opts.preserveSourceColour || !chosenColour) top.color.set('#ffffff');
        }
        ownedMaterials.push(top, edge); detailMaterials.set(hint, [top, edge]);
      }
      const reliefProfile = { ...profile, frontZ: profile.frontZ + detail.height,
        faceThickness: detail.height, bevel: Math.min(profile.bevel, detail.height / 4) };
      const geometry = faceGeometry(THREE, makeShape(THREE, detailContours[index], profile.radius), reliefProfile, quality);
      // Annular holes in a raised feature do not count as through-holes in the wheel.
      delete geometry.userData.throughHoles;
      geometry.userData.surfaceDetail = true;
      ownedGeometries.push(geometry);
      const part = addMesh(THREE, group, geometry, detailMaterials.get(hint), `Observed_relief_${detail.id || index}`);
      part.userData.surfaceDetail = { id: detail.id, height: detail.height, materialHint: hint };
    });
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
    const barrelGeometry = new THREE.LatheGeometry(points.map(([x, z]) => new THREE.Vector2(x, -z)), 160);
    barrelGeometry.normalizeNormals();
    ownedGeometries.push(barrelGeometry);
    const barrel = addMesh(THREE, group, barrelGeometry, cut, 'Approximate_rear_barrel');
    barrel.rotation.x = -Math.PI / 2;
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
