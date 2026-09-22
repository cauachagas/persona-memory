export interface SourceRelation {
  id?: string;
  resource: string;
  title?: string;
}

export interface CausalRelations {
  supersedes?: string[];
  motivated_by?: string[];
  evidenced_by?: string[];
  challenged_by?: string[];
}
