import { loadObj } from "./objLoader";

export type Vertex = { x: number; y: number; z: number };
export type Edge = { start: Vertex; end: Vertex };
export type Vector = { dx: number; dy: number; dz: number };
export type Face = { edges: [Edge, Edge, Edge]; normal: Vector };
export type Figure = { faces: Face[] };
export type Point = { x: number; y: number };

type Rotation = {
  x: number;
  y: number;
  z: number;
};

type Ctx = {
  canvasCtx: CanvasRenderingContext2D;
  canvasSize: number;
  canvasZoom: number;
};

const defaultModel: "fox" | "cat" | "car" | "cube" | "sphere" | "monkey" = "fox";

const degress2Radians = (degrees: number) => (degrees / 180) * Math.PI;
const radians2degrees = (degrees: number) => (degrees / Math.PI) * 180;

const targetCanvasSize = 400;
const zoom = devicePixelRatio;

const getDistance = (a: Vertex, b: Vertex) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);

const multiplyMatrix = (m1: number[][], m2: number[][]) => {
  const result: number[][] = [];
  for (let i = 0; i < m1.length; i++) {
    result[i] = [];
    for (let j = 0; j < m2[0].length; j++) {
      let sum = 0;
      for (let k = 0; k < m1[0].length; k++) {
        sum += m1[i][k] * m2[k][j];
      }
      result[i][j] = sum;
    }
  }
  return result;
};

const transponMatrix = (matrix: number[][]) => matrix[0].map((_, colIndex) => matrix.map((row) => row[colIndex]));

const multiplyVectors = (v1: Vector, v2: Vector) => {
  const scalar = v1.dx * v2.dx + v1.dy * v2.dy + v1.dz * v2.dz;
  const abs1 = Math.sqrt(v1.dx ** 2 + v1.dy ** 2 + v1.dz ** 2);
  const abs2 = Math.sqrt(v2.dx ** 2 + v2.dy ** 2 + v2.dz ** 2);

  return scalar / (abs1 * abs2);
};

const putPointOnCanvas = (ctx: Ctx, point: Point, color: string) => {
  ctx.canvasCtx.beginPath();
  const pointSize = 1;
  ctx.canvasCtx.fillRect(point.x * ctx.canvasZoom + ctx.canvasSize, point.y * ctx.canvasZoom + ctx.canvasSize, pointSize, pointSize);
  ctx.canvasCtx.fillStyle = color;
  ctx.canvasCtx.stroke();
};

// const getLinePoints = (start: Point, end: Point, step = 1) => {
//   const points: Point[] = [];

//   const x1 = Math.min(start.x, end.x);
//   const x2 = Math.max(start.x, end.x);
//   const y1 = Math.min(start.y, end.y);
//   const y2 = Math.max(start.y, end.y);

//   const dx = end.x - start.x;
//   const dy = end.y - start.y;

//   if (Math.abs(dx) > Math.abs(dy)) {
//     for (let x = x1; x <= x2; x += step) {
//       let progress = (x - x1) / Math.abs(dx);
//       if (dx > 0 !== dy > 0) {
//         progress = 1 - progress;
//       }
//       const y = y1 + Math.abs(dy) * progress;
//       points.push({ x: x, y: y });
//     }
//   } else {
//     for (let y = y1; y <= y2; y += step) {
//       let progress = (y - y1) / Math.abs(dy);
//       if (dx > 0 !== dy > 0) {
//         progress = 1 - progress;
//       }
//       const x = x1 + Math.abs(dx) * progress;
//       points.push({ x: x, y: y });
//     }
//   }

//   return points;
// };

const pointToHash = (point: Point, zoom: number) => `${Math.floor(point.x * zoom)}/${Math.floor(point.y * zoom)}`;

const drawFace = (ctx: Ctx, vertexes: [Point, Point, Point]) => {
  const center = { x: vertexes.reduce((sum, vertex) => sum + vertex.x, 0) / vertexes.length, y: vertexes.reduce((sum, vertex) => sum + vertex.y, 0) / vertexes.length };
  const pseudoCanvas: { [positionHash: string]: boolean } = {};

  const points = [];

  const pointsToCheckFill: Point[] = [center];
  while (pointsToCheckFill.length > 0) {
    const point = pointsToCheckFill.pop()!;
    const pointAlreadyFilled = Boolean(pseudoCanvas[pointToHash(point, ctx.canvasZoom)]);

    if (pointAlreadyFilled) {
      continue;
    }

    const pointOutOfCanvas =
      ctx.canvasSize - point.x * ctx.canvasZoom < 0 || ctx.canvasSize - point.y * ctx.canvasZoom < 0 || point.x * ctx.canvasZoom > 2 * ctx.canvasSize || point.y * ctx.canvasZoom > 2 * ctx.canvasSize;

    if (pointOutOfCanvas) {
      continue;
    }

    const heights = [
      (vertexes[0].x - point.x) * (vertexes[1].y - vertexes[0].y) - (vertexes[1].x - vertexes[0].x) * (vertexes[0].y - point.y),
      (vertexes[1].x - point.x) * (vertexes[2].y - vertexes[1].y) - (vertexes[2].x - vertexes[1].x) * (vertexes[1].y - point.y),
      (vertexes[2].x - point.x) * (vertexes[0].y - vertexes[2].y) - (vertexes[0].x - vertexes[2].x) * (vertexes[2].y - point.y),
    ];

    const outsideOfTrinangle = heights.slice(1).some((height) => (height < 0 && heights[0] > 0) || (height > 0 && heights[0] < 0));

    if (outsideOfTrinangle) {
      continue;
    }

    points.push(point);
    pseudoCanvas[pointToHash(point, ctx.canvasZoom)] = true;

    if (points.length > 200 * 1000) {
      break;
    }

    const step = 1 / ctx.canvasZoom;

    const north = { x: point.x, y: point.y - step };
    const west = { x: point.x + step, y: point.y };
    const south = { x: point.x, y: point.y + step };
    const east = { x: point.x - step, y: point.y };

    pointsToCheckFill.push(north, west, south, east);
  }

  return points;
};

const computeIsometricVertex = (vertex: Vertex) => {
  let x = (1 / Math.sqrt(6)) * (Math.sqrt(3) * vertex.x - Math.sqrt(3) * vertex.y);
  let y = (1 / Math.sqrt(6)) * (Math.sqrt(2) * vertex.x - Math.sqrt(2) * vertex.z + Math.sqrt(2) * vertex.y);

  return { x, y };
};

const rotateVertex = (vertex: Vertex, rotation: Rotation) => {
  const extendedLineMatrix = [
    [vertex.x, vertex.y, vertex.z],
    [1, 1, 1],
    [1, 1, 1],
  ];

  const xRotation = transponMatrix([
    [1, 0, 0],
    [0, Math.cos(rotation.x), -Math.sin(rotation.x)],
    [0, Math.sin(rotation.x), Math.cos(rotation.x)],
  ]);

  const yRotation = transponMatrix([
    [Math.cos(rotation.y), 0, Math.sin(rotation.y)],
    [0, 1, 0],
    [-Math.sin(rotation.y), 0, Math.cos(rotation.y)],
  ]);

  const zRotation = transponMatrix([
    [Math.cos(rotation.z), -Math.sin(rotation.z), 0],
    [Math.sin(rotation.z), Math.cos(rotation.z), 0],
    [0, 0, 1],
  ]);

  const resultMatrix = multiplyMatrix(multiplyMatrix(multiplyMatrix(extendedLineMatrix, xRotation), yRotation), zRotation);

  return {
    x: resultMatrix[0][0],
    y: resultMatrix[0][1],
    z: resultMatrix[0][2],
  };
};

const getFaceCenter = (face: Face): Vertex => {
  const allVertexes = face.edges.map(({ start, end }) => [start, end]).flat();
  const uniqueVertexes = Object.values(allVertexes.reduce((acc, vertex) => ({ ...acc, [`${vertex.x}-${vertex.y}-${vertex.z}`]: vertex }), {} as { [key: string]: Vertex }));
  const vertexes = uniqueVertexes;

  const x = vertexes.reduce((sum, vertex) => sum + vertex.x, 0) / vertexes.length;
  const y = vertexes.reduce((sum, vertex) => sum + vertex.y, 0) / vertexes.length;
  const z = vertexes.reduce((sum, vertex) => sum + vertex.z, 0) / vertexes.length;

  return { x, y, z };
};
const rotateVector = (pivot: Vertex, vector: Vector, rotation: Rotation): Vector => {
  const start = rotateVertex(pivot, rotation);
  const end = rotateVertex(
    {
      x: pivot.x + vector.dx,
      y: pivot.y + vector.dy,
      z: pivot.z + vector.dz,
    },
    rotation,
  );

  return {
    dx: end.x - start.x,
    dy: end.y - start.y,
    dz: end.z - start.z,
  };
};

const render = (model: { figure: Figure; maxCoordinate: number }, rotation: Rotation) => {
  const canvas = document.querySelector("canvas") as HTMLCanvasElement;

  canvas.width = targetCanvasSize * zoom;
  canvas.height = targetCanvasSize * zoom;
  canvas.style.transform = `scale(${1 / zoom})`;
  canvas.style.transformOrigin = `0 0`;

  const ctx: Ctx = {
    canvasCtx: canvas.getContext("2d")!,
    canvasSize: targetCanvasSize,
    canvasZoom: targetCanvasSize / Math.abs(model.maxCoordinate * 1.5),
  };

  // empirical gained from rotating the Cube model
  const cameraVector = {
    dx: Math.tan(degress2Radians(35.2)),
    dy: Math.tan(degress2Radians(35.2)),
    dz: Math.tan(degress2Radians(60)),
  };

  const cameraPosition = rotateVertex(
    {
      x: cameraVector.dx * model.maxCoordinate,
      y: cameraVector.dy * model.maxCoordinate,
      z: cameraVector.dz * model.maxCoordinate,
    },
    rotation,
  );

  const facesWithCenter = model.figure.faces.map((face) => ({ ...face, center: rotateVertex(getFaceCenter(face), rotation) }));
  const facesWithDistance = facesWithCenter.map((face) => ({ ...face, cameraDistance: getDistance(face.center, cameraPosition) }));
  const sortedFaces = facesWithDistance.sort((a, b) => b.cameraDistance - a.cameraDistance);

  const minDistance = sortedFaces[0].cameraDistance;
  const maxDistance = sortedFaces[sortedFaces.length - 1].cameraDistance;

  const pseudoCanvas: { [positionHash: string]: boolean } = {};

  const maxFaces = Infinity;
  let facesRendered = 0;
  for (let face of sortedFaces) {
    const faceCenter = getFaceCenter(face);
    const rotatedNormal = rotateVector(faceCenter, face.normal, rotation);
    const normal = multiplyVectors(rotatedNormal, cameraVector);

    if (normal < 0) {
      continue;
    }

    facesRendered++;
    if (facesRendered > maxFaces) {
      break;
    }
    const allVertexes = face.edges.map(({ start, end }) => [start, end]).flat();
    const uniqueVertexes = Object.values(allVertexes.reduce((acc, vertex) => ({ ...acc, [`${vertex.x}-${vertex.y}-${vertex.z}`]: vertex }), {} as { [key: string]: Vertex }));
    const vertexes = uniqueVertexes.map((vertex) => computeIsometricVertex(rotateVertex(vertex, rotation))) as [Point, Point, Point];

    const relativeDistance = (face.cameraDistance - minDistance) / (maxDistance - minDistance);
    const colorsRange = 10;
    const colorIntensity = Math.round(relativeDistance * colorsRange).toString(16);
    const color = `#${colorIntensity}${colorIntensity}${colorIntensity}`;

    const points = drawFace(ctx, vertexes);

    const visiblePoints = points.filter((point) => {
      const hash = pointToHash(point, ctx.canvasZoom);
      if (pseudoCanvas[hash] !== undefined) {
        return false;
      }
      pseudoCanvas[hash] = true;
      return true;
    });

    visiblePoints.forEach((point) => putPointOnCanvas(ctx, point, color));
  }
};

const defaultRotationsForModels: { [modelName: string]: Rotation } = {
  cat: { x: 0, y: 0, z: 0 },
  car: { x: Math.PI / 2, y: 0, z: 0 },
  fox: { x: Math.PI / 2, y: 0, z: 0 },
  cube: { x: 0, y: 0, z: degress2Radians(60) },
  sphere: { x: Math.PI / 2, y: 0, z: 0 },
  monkey: { x: Math.PI / 2, y: 0, z: Math.PI / 2 },
};

let modelName = defaultModel;
let model = loadObj(modelName);
let rotation = { ...defaultRotationsForModels[modelName] };
for (let axis of ["x", "y", "z"] as const) {
  (document.querySelector(`#rotation${axis.toUpperCase()}`) as HTMLInputElement).value = radians2degrees(rotation[axis]).toString();
}

for (let axis of ["x", "y", "z"] as const) {
  document.querySelector(`#rotation${axis.toUpperCase()}`)!.addEventListener("change", (event: any) => {
    rotation[axis] = degress2Radians(parseInt(event.target.value, 10));
    render(model, rotation);
  });
  document.querySelector(`#rotation${axis.toUpperCase()}Reset`)!.addEventListener("click", () => {
    const angle = defaultRotationsForModels[modelName][axis];
    (document.querySelector(`#rotation${axis.toUpperCase()}`) as HTMLInputElement).value = radians2degrees(angle).toString();
    rotation[axis] = angle;
    render(model, rotation);
  });
}
document.querySelector("#modelSelect")?.addEventListener("change", (event: any) => {
  model = loadObj(event.target.value);
  modelName = event.target.value;
  rotation = { ...defaultRotationsForModels[event.target.value] };
  for (let axis of ["x", "y", "z"] as const) {
    (document.querySelector(`#rotation${axis.toUpperCase()}`) as HTMLInputElement).value = radians2degrees(rotation[axis]).toString();
  }
  render(model, rotation);
});

render(model, rotation);
