import { recordCognitiveEvent, RecordCognitiveEventInput, RecordCognitiveEventResult } from "../mutations/event.js";

export async function handleRecordCognitiveEvent(
  vaultRoot: string,
  input: RecordCognitiveEventInput
): Promise<RecordCognitiveEventResult> {
  return await recordCognitiveEvent(vaultRoot, input);
}
