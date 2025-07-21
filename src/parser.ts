export function generateMermaidDiagram(code: string): string {
  const entities = [...code.matchAll(/@Entity\s+public class (\w+)/g)];
  let result = 'erDiagram\n';
  for (const match of entities) {
    const entity = match[1];
    result += `  ${entity} {
    string id
  }
`;
  }
  return result;
}