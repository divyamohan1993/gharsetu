import type { FastifyInstance } from "fastify";
import { createReadStream } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLocals } from "../lib/render.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SW_PATH = join(__dirname, "..", "public", "sw.js");

const REPORT_DOWNLOAD = "/static/downloads/Akshit_Thakur_Capstone_Report.docx";
const PITCH_DOWNLOAD = "/static/downloads/Akshit_Thakur_Capstone_Presentation.pptx";

export async function registerPagesRoutes(app: FastifyInstance): Promise<void> {
  app.get("/report", async (req, reply) => {
    return reply.view(
      "report",
      buildLocals(
        req,
        reply,
        {
          title: "Capstone Report — GharSetu",
          description:
            "Full B.Tech CSE (Cybersecurity) capstone report for GharSetu — read inline or download the .docx.",
        },
        { reportFragmentPath: "report-body" },
      ),
    );
  });

  app.get("/pitch", async (req, reply) => {
    return reply.view(
      "pitch",
      buildLocals(
        req,
        reply,
        {
          title: "Capstone Pitch — GharSetu",
          description:
            "Capstone defense slide deck for GharSetu — view as keyboard-navigable slides or download the .pptx.",
        },
        { pitchFragmentPath: "pitch-body" },
      ),
    );
  });

  app.get("/report.docx", async (_req, reply) => {
    return reply.code(301).redirect(REPORT_DOWNLOAD);
  });

  app.get("/pitch.pptx", async (_req, reply) => {
    return reply.code(301).redirect(PITCH_DOWNLOAD);
  });

  // Serve the service worker at the origin root so browsers allow scope='/'.
  app.get("/sw.js", async (_req, reply) => {
    reply
      .type("application/javascript; charset=utf-8")
      .header("Service-Worker-Allowed", "/")
      .header("Cache-Control", "no-cache");
    return reply.send(createReadStream(SW_PATH));
  });
}
