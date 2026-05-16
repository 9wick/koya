export type Position = {
  readonly sourceFile: string;
  readonly line: number;
  readonly column: number;
};

const isFrameworkPath = (path: string): boolean =>
  path.includes('node_modules') || path.includes('packages/decorator-metadata/src/runtime');

const parsePositionFromStackLine = (line: string): Position | undefined => {
  const parenMatch = line.match(/\(([^)]+):(\d+):(\d+)\)/);
  if (parenMatch) {
    const [, file, lineNum, colNum] = parenMatch;
    if (file && !isFrameworkPath(file)) {
      return {
        sourceFile: file,
        line: parseInt(lineNum, 10),
        column: parseInt(colNum, 10),
      };
    }
  }

  const atMatch = line.match(/at\s+([^\s]+):(\d+):(\d+)/);
  if (atMatch) {
    const [, file, lineNum, colNum] = atMatch;
    if (file && !isFrameworkPath(file)) {
      return {
        sourceFile: file,
        line: parseInt(lineNum, 10),
        column: parseInt(colNum, 10),
      };
    }
  }

  return undefined;
};

export const getCallerPosition = (): Position | undefined => {
  const stack = new Error().stack;
  if (!stack) return undefined;

  const lines = stack.split('\n');
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const pos = parsePositionFromStackLine(line);
    if (pos) return pos;
  }

  return undefined;
};
