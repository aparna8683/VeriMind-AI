import dotenv from "dotenv";
import { extractClaims } from "./src/agents/claim-extractor.agent.js";

dotenv.config();

const sampleAnswer = `
Multi-agent AI systems use multiple specialized agents to collaborate
on complex tasks [1].

Human-in-the-loop systems allow humans to review or approve certain
AI decisions before execution [2].

Agentic AI can automate workflows across multiple business applications.
`;

const sampleSources = [
    { id: 1, title: "Multi-agent AI systems" },
    { id: 2, title: "Human-in-the-loop AI" }
];

async function testClaimExtractor() {
    try {
        console.log("Testing Claim Extraction Agent...\n");

        const result = await extractClaims(
            sampleAnswer,
            sampleSources
        );

        console.log("Claim extraction successful!");
        console.log(JSON.stringify(result, null, 2));

    } catch (error) {
        console.error("Claim extraction failed:");
        console.error(error.message);
    }
}

testClaimExtractor();