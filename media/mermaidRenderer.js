window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('mermaid-container');
  const diagramCode = container.getAttribute('data-diagram');

  console.log('Rendering Mermaid diagram:', diagramCode);

  mermaid.initialize({ startOnLoad: false, theme: "default" });

  try {
    mermaid.render("generatedDiagram", diagramCode, (svgCode) => {
      container.innerHTML = svgCode;
    });
  } catch (err) {
    container.innerHTML = `<pre style="color:red;">Error rendering diagram:\n${err.message}</pre>`;
  }
});