interface Entity {
  name: string;
  fields: { name: string; type: string }[];
  relations?: { type: 'OneToMany' | 'ManyToOne' | 'OneToOne' | 'ManyToMany'; target: string; }[];
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

  const relationSet = new Set<string>();

  for (const entity of entities) {
    if (!entity.relations) {
      continue;
    }

    for (const relation of entity.relations) {
      const source = entity.name.toUpperCase();
      const target = relation.target.toUpperCase();
      let relationKey: string;

      if (
        (relation.type === 'OneToOne' || relation.type === 'ManyToMany') ||
        (relation.type === 'OneToMany' || relation.type === 'ManyToOne')
      ) {
        // For all bidirectional and inverse relations, sort source and target
        const [a, b] = [source, target].sort();
        // Use a generic type for OneToMany/ManyToOne and for OneToOne/ManyToMany
        let typeKey: any = relation.type;
        if (relation.type === 'OneToMany' || relation.type === 'ManyToOne') {
          typeKey = 'OneToMany/ManyToOne';
        }
        if (relation.type === 'OneToOne' || relation.type === 'ManyToMany') {
          typeKey = relation.type;
        }
        relationKey = `${a}<->${typeKey}<->${b}`;
      } else {
        relationKey = `${source}->${relation.type}->${target}`;
      }

      if (relationSet.has(relationKey)) {
        continue;
      }

      relationSet.add(relationKey);

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

      output += `  ${source} ${arrow} ${target} : relates\n`;
    }
  }

  return output;
}
