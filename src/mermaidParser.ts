import { RelationType, Entity } from "./models/index.js";

export function generateMermaidFromEntities(entities: Entity[]): string {
  let output = 'erDiagram\n';

  // Entities
  for (const { name, fields } of entities) {
    output += `  ${name.toUpperCase()} {\n`;
    for (const { type, name: fieldName } of fields) {
      output += `    ${type} ${fieldName}\n`;
    }
    output += `  }\n\n`;
  }

  // Relations
  const relationSet = new Set<string>();

  for (const { name, relations } of entities) {
    if (!relations) {
      continue;
    }

    for (const { type, target } of relations) {
      const source = name.toUpperCase();
      const targetEntity = target.toUpperCase();

      // Prevent duplicate relations
      const relationKey = getRelationKey(source, targetEntity, type);
      if (relationSet.has(relationKey)) {
        continue;
      }
      relationSet.add(relationKey);

      // Mermaid arrow representation
      const arrow = getMermaidArrow(type);
      output += `  ${source} ${arrow} ${targetEntity} : ""\n`;
    }
  }

  return output;
}

// Generate a unique key for each relation to avoid duplicates
function getRelationKey(a: string, b: string, type: RelationType): string {
  const bidirectional = type === 'OneToOne' || type === 'ManyToMany' || type === 'OneToMany' || type === 'ManyToOne';

  if (bidirectional) {
    const [x, y] = [a, b].sort();
    const typeKey =
      type === 'OneToMany' || type === 'ManyToOne'
        ? 'OneToMany/ManyToOne'
        : type; // Handle bidirectional relations with a common type key
    return `${x}<->${typeKey}<->${y}`;
  }

  return `${a}->${type}->${b}`;
}

// Mermaid arrow representation based on relation type
function getMermaidArrow(type: RelationType): string {
  switch (type) {
    case 'OneToMany':
      return '||--o{';
    case 'ManyToOne':
      return '}o--||';
    case 'OneToOne':
      return '||--||';
    case 'ManyToMany':
      return '}|--|{';
  }
}
