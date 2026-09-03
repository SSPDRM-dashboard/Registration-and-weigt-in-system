import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON with a larger limit for images
  app.use(express.json({ limit: "10mb" }));

  // API route for extracting categories
  app.post("/api/extract-categories", async (req, res) => {
    try {
      const { imageBase64, type, eventName } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "Missing image data." });
      }
      
      const mimeType = imageBase64.substring(imageBase64.indexOf(":") + 1, imageBase64.indexOf(";"));
      const base64Data = imageBase64.split(",")[1];
      
      const prompt = type === 'ageGroups' 
        ? "Extract the age group divisions or age brackets from this image. Return a JSON array of strings, where each string is an age group name (e.g., 'Cadet (12 to 14 Years Old)', 'Junior (15 to 17 Years Old)'). Return only valid JSON array."
        : `Extract the target weight classes or competition divisions from this image${eventName ? ` for the tournament event discipline: "${eventName}"` : ''}. Return a JSON array of strings, where each string is a division name or weight bracket (e.g., 'FEATHER 41.01KG-45KG', 'FLY 33.01KG-37KG', 'POWER BREAK (FIST)', 'INDIVIDUAL RECOGNIZED', 'SPEED SPRINT 30S', 'OPEN WEIGHT'). Return only valid JSON array.`;
        
      const candidateModels = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.5-pro"];
      let lastError: any = null;
      let categories: string[] = [];
      let success = false;

      for (const model of candidateModels) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const response = await ai.models.generateContent({
              model,
              contents: {
                parts: [
                  { inlineData: { data: base64Data, mimeType } },
                  { text: prompt }
                ]
              },
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.STRING
                  },
                  description: "An array of extracted category strings."
                }
              }
            });
            
            const jsonStr = response.text?.trim() || "[]";
            categories = JSON.parse(jsonStr);
            if (Array.isArray(categories)) {
              success = true;
              break;
            }
          } catch (err: any) {
            lastError = err;
            console.warn(`Model ${model} attempt ${attempt + 1} failed: ${err?.message || err}`);
            // If 503 or 429, wait briefly before retrying
            if (attempt === 0) {
              await new Promise(r => setTimeout(r, 600));
            }
          }
        }
        if (success) break;
      }

      if (!success) {
        throw lastError || new Error("Failed to extract categories from all model attempts.");
      }
      
      res.json({ categories });
    } catch (error: any) {
      console.error("Error extracting categories:", error);
      res.status(500).json({ error: error.message || "Failed to extract categories." });
    }
  });

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
