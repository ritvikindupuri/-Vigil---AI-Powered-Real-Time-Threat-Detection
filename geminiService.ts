import { GoogleGenAI, Type } from "@google/genai";
import type { ImageAnalysisResult, VerbalAnalysisResult } from '../types';

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

const expressionSchema = {
    type: Type.OBJECT,
    description: "Analysis of the person's facial expression.",
    properties: {
        sentiment: {
            type: Type.STRING,
            description: "The dominant emotion conveyed by the expression.",
            enum: ['Angry', 'Disgusted', 'Fearful', 'Happy', 'Neutral', 'Sad', 'Surprised']
        },
        microExpression: {
            type: Type.STRING,
            description: "Description of any fleeting, subtle micro-expressions detected. If none, state 'No micro-expressions detected'."
        },
        macroExpression: {
            type: Type.STRING,
            description: "Description of the clear, obvious macro-expression. If none, state 'No macro-expressions detected'."
        }
    },
    required: ["sentiment", "microExpression", "macroExpression"]
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
                    expression: {
                        ...expressionSchema,
                        nullable: true,
                        description: "The person's facial expression analysis. Null if no face is clearly visible."
                    }
                },
                required: ["id", "location", "isAggressive", "aggressionAnalysis", "heldObject", "expression"],
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
        isSarcastic: {
            type: Type.BOOLEAN,
            description: "True if the text contains sarcasm."
        }
    },
    required: ["sentiment", "isBullying", "explanation", "isSarcastic"]
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

**4. FACIAL EXPRESSION ANALYSIS (NEW):**
- For each person, analyze their facial expression if it is clearly visible.
- If a face is not clear, \`expression\` MUST be \`null\`.
- \`sentiment\`: Classify the dominant emotion from the provided enum.
- \`microExpression\`: Describe any subtle, rapid facial movements (e.g., "brief lip corner pull"). If none, state "No micro-expressions detected."
- \`macroExpression\`: Describe the overt, sustained facial expression (e.g., "Eyes wide, mouth open in surprise"). If none, state "No macro-expressions detected."

Failure to adhere to these rules, especially the IGNORE policy, is a critical failure. Respond ONLY in the provided JSON format.
`
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
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
        if (error instanceof Error && error.message) {
            if (error.message.includes("RESOURCE_EXHAUSTED") || error.message.includes("429")) {
                throw new Error("API rate limit exceeded. Analysis may be delayed.");
            }
            throw new Error(error.message);
        }
        throw new Error("Failed to analyze image. The AI model could not process the request.");
    }
};


export const analyzeVerbalContent = async (text: string): Promise<VerbalAnalysisResult> => {
    if (!text.trim()) {
        throw new Error("Input text cannot be empty.");
    }
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze the following text for sentiment, signs of verbal bullying, and sarcasm: "${text}"`,
            config: {
                systemInstruction: "You are a sentiment analysis expert specializing in identifying verbal harassment, bullying, and sarcasm from short text snippets for a security system. Your primary goal is to flag potentially harmful communication, paying close attention to nuanced language like sarcasm.",
                responseMimeType: 'application/json',
                responseSchema: verbalAnalysisSchema,
            }
        });
        
        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as VerbalAnalysisResult;

    } catch (error) {
        console.error("Error analyzing verbal content:", error);
        if (error instanceof Error && error.message) {
            if (error.message.includes("RESOURCE_EXHAUSTED") || error.message.includes("429")) {
               throw new Error("API rate limit exceeded. Analysis may be delayed.");
           }
           throw new Error(error.message);
       }
        throw new Error("Failed to analyze verbal content. The AI model could not process the request.");
    }
};