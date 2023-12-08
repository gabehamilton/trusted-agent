import fetch from "node-fetch";

const LLM_AGENT_URL = process.env.LLM_AGENT_URL ?? null;
console.log("LLM_AGENT_URL", LLM_AGENT_URL);
async function askAgent(question) {
    console.log("Asking Agent: ", question);
    const completion = await fetch(`${LLM_AGENT_URL}?query=${question}`);
    const text = await completion.text();

    console.log(text);

    return completion;
}

await askAgent("What is the capital of France?");