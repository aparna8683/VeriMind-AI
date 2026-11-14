import dotenv from "dotenv";
import { verifyClaims } from "./src/agents/claim-verifier.agent.js";

dotenv.config();

const claims = [
    {
        id: "C1",
        text: "Multi-agent AI systems use multiple specialized agents to collaborate on complex tasks.",
        citedSourceIds: [1]
    },
    {
        id: "C2",
        text: "Human-in-the-loop systems allow humans to review or approve certain AI decisions before execution.",
        citedSourceIds: [2]
    }
];

const sources = [
    {
        id: 1,
        title: "Multi-agent AI systems",
        url: "https://example.com/agents",
        content: `
        Multi-agent systems consist of multiple specialized agents
        that collaborate to solve complex tasks.
        `
    },
    {
        id: 2,
        title: "Human-in-the-loop AI",
        url: "https://example.com/human-in-loop",
        content: `
        Human-in-the-loop systems allow human operators to review
        and approve AI decisions before certain actions are executed.
        `
    }
];

async function testVerifier() {
    try {
        console.log("Testing Claim Verification Agent...\n");

        const result = await verifyClaims(claims, sources);

        console.log("Verification successful!");
        console.log(JSON.stringify(result, null, 2));

    } catch (error) {
        console.error("Verification failed:");
        console.error(error.message);
    }
}

testVerifier();