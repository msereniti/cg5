import catRaw from "../models/cat.obj.txt";
import carRaw from "../models/car.obj.txt";
import foxRaw from "../models/fox.obj.txt";
import cubeRaw from "../models/cube.obj.txt";
import sphereRaw from "../models/sphere.obj.txt";
import monkeyRaw from "../models/monkey.obj.txt";
import { Edge, Face, Figure, Vector, Vertex } from "./main";

export const loadObj = (name: "cat" | "car" | "fox" | "cube" | "sphere" | "monkey"): { figure: Figure; maxCoordinate: number; color: string } => {
  let maxCoordinate = 0;

  const name2file = {
    cat: catRaw,
    car: carRaw,
    fox: foxRaw,
    cube: cubeRaw,
    sphere: sphereRaw,
    monkey: monkeyRaw,
  };
  const file = name2file[name];
  const lines = file.split("\n");
  const normals: Vector[] = [];
  const allVertexes: Vertex[] = [];
  const faces: Face[] = [];
  for (let line of lines) {
    if (line.startsWith("v ")) {
      const coordinates = line.replace(/v\s+/, "").split(" ").map(parseFloat);
      allVertexes.push({
        x: coordinates[0],
        y: coordinates[1],
        z: coordinates[2],
      });

      coordinates.slice(0, 3).forEach((coordinate) => {
        if (Math.abs(coordinate) > Math.abs(maxCoordinate)) maxCoordinate = coordinate;
      });
    }
    if (line.startsWith("vn ")) {
      const deltas = line.replace(/vn\s+/, "").split(" ").map(parseFloat);
      normals.push({
        dx: deltas[0],
        dy: deltas[1],
        dz: deltas[2],
      });
    }
    if (line.startsWith("f ")) {
      const vertexes = line
        .substring("f ".length, line.length - 1)
        .split(" ")
        .map((part) => allVertexes[parseInt(part.split("/")[0], 10) - 1])
        .filter(Boolean);
      if (vertexes.some((vertex) => vertex === undefined) || vertexes.length < 3) {
        console.log(vertexes);
      }
      // const edges = vertexes.slice(0, -1).map((vertex, index) => ({
      //   start: vertex,
      //   end: vertexes[index + 1],
      // }))

      const normalIndex = line
        .substring("f ".length, line.length - 1)
        .split(" ")[0]
        .split("/")[2];
      const normal = normals[parseInt(normalIndex, 10) - 1];

      faces.push({
        edges: [
          {
            start: vertexes[0],
            end: vertexes[1],
          },
          {
            start: vertexes[1],
            end: vertexes[2],
          },
          {
            start: vertexes[2],
            end: vertexes[0],
          },
        ],
        normal,
      });
      vertexes.slice(3).map((vertex, index) =>
        faces.push({
          edges: [
            {
              start: vertex,
              end: vertexes[index + 3 - 1],
            },
            {
              start: vertexes[index + 3 - 1],
              end: vertexes[0],
            },
            {
              start: vertexes[0],
              end: vertex,
            },
          ],
          normal,
        }),
      );
    }
  }

  return { figure: { faces }, maxCoordinate };
};
