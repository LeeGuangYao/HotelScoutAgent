import path from "node:path";

export const getProjectRoot = (): string => {
  if (path.basename(process.cwd()) === "backend") {
    return path.resolve(process.cwd(), "..");
  }

  return process.cwd();
};

export const getScreenshotsRoot = (): string =>
  path.resolve(getProjectRoot(), "screenshots");
