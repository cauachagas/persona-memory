import { recordCognitiveEvent } from "../mutations.js";
export async function handleRecordCognitiveEvent(vaultRoot, input) {
    return await recordCognitiveEvent(vaultRoot, input);
}
