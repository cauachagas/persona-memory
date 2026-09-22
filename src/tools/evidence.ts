import { recordEvidence, RecordEvidenceInput, RecordEvidenceResult } from "../mutations/evidence.js";

export async function handleRecordEvidence(
  vaultRoot: string,
  input: RecordEvidenceInput
): Promise<RecordEvidenceResult> {
  return await recordEvidence(vaultRoot, input);
}
