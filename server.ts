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
      const { imageBase64, type } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "Missing image data." });
      }
      
      const mimeType = imageBase64.substring(imageBase64.indexOf(":") + 1, imageBase64.indexOf(";"));
      const base64Data = imageBase64.split(",")[1];
      
      const prompt = type === 'ageGroups' 
        ? "Extract the age group divisions from this image. Return a JSON array of strings, where each string is an age group name (e.g., 'Cadet (12 to 14 Years Old)')."
        : "Extract the weight class divisions from this image. Return a JSON array of strings, where each string is a weight class (e.g., 'FEATHER 41.01KG-45KG').";
        
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
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
      const categories = JSON.parse(jsonStr);
      
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
