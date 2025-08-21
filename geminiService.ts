import { GoogleGenAI, Type } from "@google/genai";
import type { ImageAnalysisResult, VerbalAnalysisResult } from '../types';

// Standard error for API failures
class ApiError extends Error {
    constructor(message: string, public status?: number) {
        super(message);
        this.name = 'ApiError';
    }
}

// --- Model Configuration ---
// Using "latest" ensures we automatically get model updates.
// Using Pro for high-accuracy tasks, Flash for speed/cost-sensitive ones.
const GEMINI_PRO_MODEL = 'gemini-1.5-pro-latest';
const GEMINI_FLASH_MODEL = 'gemini-1.5-flash-latest';


if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const locationSchema = {
    type: Type.OBJECT,
    description: "Normalized coordinates (0.0 to 1.0) for the bounding box. Top-left is (x:0, y:0).",
    properties: {
        x: { type: Type.NUMBER },
        y: { type: Type.NUMBER },
        width: { type: Type.NUMBER },
        height: { type: Type.NUMBER },
    },
    required: ["x", "y", "width", "height"],
};

const heldObjectSchema = {
    type: Type.OBJECT,
    description: "The object a person is holding. Null if no object is held.",
    properties: {
        name: { type: Type.STRING, description: "Name of the object." },
        location: locationSchema,
        riskScore: { type: Type.INTEGER, description: "Risk score 0-100. >60 is a threat." },
        justification: { type: Type.STRING, description: "Reason for the risk score." },
        harmfulUseWarning: { type: Type.STRING, description: "Warning if a safe object is used harmfully. Omit if not applicable." }
    },
    required: ["name", "location", "riskScore", "justification"]
};

const imageAnalysisSchema = {
    type: Type.OBJECT,
    properties: {
        people: {
            type: Type.ARRAY,
            description: "An array of each person detected in the frame.",
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING, description: "A unique identifier for the person in this frame, e.g., 'person_1'." },
                    location: locationSchema,
                    isAggressive: { type: Type.BOOLEAN, description: "True if this specific person is showing physical aggression." },
                    aggressionAnalysis: { type: Type.STRING, description: "Summary of the aggressive behavior, or 'No aggression detected'." },
                    heldObject: {
                        ...heldObjectSchema,
                        nullable: true,
                    },
                },
                required: ["id", "location", "isAggressive", "aggressionAnalysis", "heldObject"],
            }
        }
    },
    required: ["people"]
};


const verbalAnalysisSchema = {
    type: Type.OBJECT,
    properties: {
        sentiment: {
            type: Type.STRING,
            description: "The overall sentiment of the text.",
            enum: ["Positive", "Neutral", "Negative"],
        },
        isBullying: {
            type: Type.BOOLEAN,
            description: "True if the text is classified as verbal bullying or harassment."
        },
        explanation: {
            type: Type.STRING,
            description: "A brief explanation for the classification."
        },
    },
    required: ["sentiment", "isBullying", "explanation"]
};


export const analyzeImageContent = async (base64Image: string, mimeType: string): Promise<ImageAnalysisResult> => {
    try {
        const imagePart = {
            inlineData: {
                mimeType: mimeType,
                data: base64Image,
            },
        };

        const textPart = {
            text: `
**SECURITY DIRECTIVE: IMMEDIATE THREAT & HELD OBJECT ANALYSIS**

Your SOLE function is to analyze this image for human threats. You MUST follow these rules precisely.

**1. PERSON ANALYSIS:**
- Identify every person.
- \`id\`: Assign a unique ID (e.g., 'person_1').
- \`location\`: Provide a tight bounding box for the person.
- \`isAggressive\`: \`true\` ONLY for overt physical aggression (punching, kicking, threatening pose). Otherwise, \`false\`.
- \`aggressionAnalysis\`: If aggressive, describe the action. Otherwise, 'No aggression detected'.

**2. HELD OBJECT ANALYSIS (CRITICAL):**
- You will ONLY identify objects ACTIVELY AND CLEARLY HELD in a person's hand.
- If a person is NOT holding an object, \`heldObject\` MUST be \`null\`. DO NOT guess.
- If an object is held, provide its \`name\`, its own \`location\` box, \`riskScore\` (0-100), and \`justification\`.

**3. STRICT IGNORE POLICY:**
- **IGNORE ALL BACKGROUND ITEMS:** Do not identify chairs, desks, monitors, wall art, windows, or any other static scenery.
- **IGNORE BODY PARTS:** Do not identify hands, fists, or clothing as objects.

Failure to adhere to these rules, especially the IGNORE policy, is a critical failure. Respond ONLY in the provided JSON format.
`
        };

        const response = await ai.models.generateContent({
            model: GEMINI_PRO_MODEL, // Use the more powerful model for accuracy
            contents: { parts: [textPart, imagePart] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: imageAnalysisSchema,
                thinkingConfig: { thinkingBudget: 0 }
            }
        });

        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText) as ImageAnalysisResult;
        // Ensure people array exists even if model fails to return it
        if (!result.people) {
            result.people = [];
        }
        return result;

    } catch (error) {
        console.error("Error analyzing image content:", error);
        if (error instanceof Error) {
            if (error.message.includes("RESOURCE_EXHAUSTED") || error.message.includes("429")) {
                throw new ApiError("API rate limit exceeded. Analysis may be delayed.", 429);
            }
             // Catch safety-related blocks
            if (error.message.includes("SAFETY")) {
                throw new ApiError("Image analysis blocked for safety reasons.", 400);
            }
            throw new ApiError(error.message);
        }
        throw new ApiError("Failed to analyze image. The AI model could not process the request.", 500);
    }
};


export const analyzeVerbalContent = async (text: string): Promise<VerbalAnalysisResult> => {
    if (!text.trim()) {
        // Return a neutral, non-bullying result for empty input
        return {
            sentiment: "Neutral",
            isBullying: false,
            explanation: "Input text was empty."
        };
    }

    // System instruction sets the persona and high-level goal for the AI.
    const systemInstruction = `
You are a highly advanced AI security analyst. Your task is to analyze transcribed audio for verbal threats, focusing on bullying, harassment, and aggression.
You must classify the input and provide a clear, concise explanation for your decision.
Your output MUST be in the specified JSON format.
Prioritize safety: if there is any ambiguity, err on the side of caution and flag the content.
`;

    // The user-facing prompt (contents) provides the specific text to analyze.
    const contents = `
**VERBAL THREAT ANALYSIS DIRECTIVE**

Analyze the following text for sentiment and signs of verbal bullying or harassment:
"${text}"

**Analysis Criteria:**
- **Sentiment**: Classify as "Positive", "Neutral", or "Negative".
- **isBullying**: Set to \`true\` if the text contains any of the following, otherwise \`false\`:
    - Personal insults or name-calling.
    - Threats of physical harm.
    - Aggressive or intimidating language.
    - Discriminatory remarks (racism, sexism, etc.).
    - Malicious gossip or social exclusion.
- **Explanation**: Briefly justify your "isBullying" classification. If \`false\`, state "No bullying detected."

Adhere strictly to the JSON schema.
`;

    try {
        const response = await ai.models.generateContent({
            model: GEMINI_PRO_MODEL, // Using Pro for better nuance detection
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: verbalAnalysisSchema,
            }
        });
        
        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as VerbalAnalysisResult;

    } catch (error) {
        console.error("Error analyzing verbal content:", error);
        if (error instanceof Error) {
            if (error.message.includes("RESOURCE_EXHAUSTED") || error.message.includes("429")) {
               throw new ApiError("API rate limit exceeded. Analysis may be delayed.", 429);
           }
            if (error.message.includes("SAFETY")) {
                throw new ApiError("Verbal analysis blocked for safety reasons.", 400);
            }
           throw new ApiError(error.message);
       }
        throw new ApiError("Failed to analyze verbal content. The AI model could not process the request.", 500);
    }
};