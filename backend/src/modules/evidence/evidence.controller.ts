import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance, FastifyReply } from "fastify";
import { apiError } from "../../shared/http.js";
import { getProjectRoot, getScreenshotsRoot } from "../../shared/paths.js";

type ScreenshotPreviewQuery = {
  path?: string;
};

const IMAGE_CONTENT_TYPES = new Map<string, string>([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
]);

export const registerEvidenceRoutes = async (
  app: FastifyInstance,
): Promise<void> => {
  app.get<{ Querystring: ScreenshotPreviewQuery }>(
    "/api/evidence/screenshots/preview",
    async (request, reply) => {
      const resolved = resolveScreenshotPath(request.query.path);
      if (!resolved.ok) {
        return reply
          .code(400)
          .send(apiError("INVALID_SCREENSHOT_PATH", resolved.message));
      }

      try {
        const fileStat = await stat(resolved.filePath);
        if (!fileStat.isFile()) {
          return sendScreenshotNotFound(reply);
        }
      } catch {
        return sendScreenshotNotFound(reply);
      }

      return reply
        .header("Cache-Control", "no-store")
        .header("X-Content-Type-Options", "nosniff")
        .type(resolved.contentType)
        .send(createReadStream(resolved.filePath));
    },
  );
};

type ResolveScreenshotResult =
  | { ok: true; filePath: string; contentType: string }
  | { ok: false; message: string };

const resolveScreenshotPath = (
  input: string | undefined,
): ResolveScreenshotResult => {
  if (!input || input.trim().length === 0) {
    return { ok: false, message: "screenshot path is required." };
  }

  const normalizedInput = input.trim();
  if (normalizedInput.includes("\0")) {
    return { ok: false, message: "screenshot path contains invalid bytes." };
  }

  const extension = path.extname(normalizedInput).toLowerCase();
  const contentType = IMAGE_CONTENT_TYPES.get(extension);
  if (!contentType) {
    return {
      ok: false,
      message: "only png, jpg, jpeg, and webp screenshots can be previewed.",
    };
  }

  const screenshotsRoot = getScreenshotsRoot();
  const projectRoot = getProjectRoot();
  const firstSegment = normalizedInput.split(/[\\/]+/)[0];
  const candidatePath = path.isAbsolute(normalizedInput)
    ? path.resolve(normalizedInput)
    : firstSegment === "screenshots"
      ? path.resolve(projectRoot, normalizedInput)
      : path.resolve(screenshotsRoot, normalizedInput);

  const relativeToScreenshotsRoot = path.relative(screenshotsRoot, candidatePath);
  if (
    relativeToScreenshotsRoot === "" ||
    relativeToScreenshotsRoot.startsWith("..") ||
    path.isAbsolute(relativeToScreenshotsRoot)
  ) {
    return {
      ok: false,
      message: "screenshot path must stay inside the screenshots directory.",
    };
  }

  return { ok: true, filePath: candidatePath, contentType };
};

const sendScreenshotNotFound = (reply: FastifyReply) =>
  reply
    .code(404)
    .send(
      apiError(
        "SCREENSHOT_NOT_FOUND",
        "Screenshot file does not exist or cannot be accessed.",
      ),
    );
