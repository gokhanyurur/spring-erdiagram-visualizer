export interface Field {
  name: string;
  type: string;
}

export type RelationType = "OneToMany" | "ManyToOne" | "OneToOne" | "ManyToMany";

export interface Relation {
  type: RelationType;
  target: string;
}

export interface Entity {
  name: string;
  fields: Field[];
  relations: Relation[];
}
