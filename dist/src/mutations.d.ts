export interface RecordCognitiveEventInput {
    title: string;
    event_kind: string;
    summary: string;
    details: string;
    related_paths?: string[];
    proposed_state?: string;
    target?: string;
}
export interface RecordCognitiveEventResult {
    eventPath: string;
    commitHash?: string;
    status: "draft";
}
export declare function recordCognitiveEvent(vaultRoot: string, input: RecordCognitiveEventInput): Promise<RecordCognitiveEventResult>;
