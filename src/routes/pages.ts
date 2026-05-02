import type { FastifyInstance } from "fastify";
import { buildLocals } from "../lib/render.js";

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
}
