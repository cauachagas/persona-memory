import { recordCognitiveEvent, RecordCognitiveEventInput, RecordCognitiveEventResult } from "../mutations.js";

export async function handleRecordCognitiveEvent(
  vaultRoot: string,
  input: RecordCognitiveEventInput
): Promise<RecordCognitiveEventResult> {
  return await recordCognitiveEvent(vaultRoot, input);
}
