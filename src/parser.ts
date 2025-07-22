interface Entity {
  name: string;
  fields: { name: string; type: string }[];
  relations?: { type: 'OneToMany' | 'ManyToOne' | 'OneToOne' | 'ManyToMany'; target: string; field: string }[];
}

export function generateMermaidFromEntities(entities: Entity[]): string {
  let output = 'erDiagram\n';

  for (const entity of entities) {
    output += `  ${entity.name.toUpperCase()} {\n`;
    for (const field of entity.fields) {
      output += `    ${field.type} ${field.name}\n`;
    }
    output += `  }\n\n`;
  }

  for (const entity of entities) {
    if (!entity.relations) {
      continue;
    }
    for (const relation of entity.relations) {
      const source = entity.name.toUpperCase();
      const target = relation.target.toUpperCase();
      const label = relation.field;

      let arrow = '';
      switch (relation.type) {
        case 'OneToMany':
          arrow = '||--o{';
          break;
        case 'ManyToOne':
          arrow = '}o--||';
          break;
        case 'OneToOne':
          arrow = '||--||';
          break;
        case 'ManyToMany':
          arrow = '}|--|{';
          break;
      }

      output += `  ${source} ${arrow} ${target} : ${label}\n`;
    }
  }

  return output;
}
