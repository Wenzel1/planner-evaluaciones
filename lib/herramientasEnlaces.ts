// Enlaces oficiales de las herramientas que suelen aparecer en "HERRAMIENTAS:" de una evaluación.
// Se usan para agregarlas solas a los Recursos y para que en la página del estudiante cada herramienta sea un enlace.
// Solo enlaces comprobados a mano (páginas oficiales); lo que no está aquí se muestra sin enlace.

const LISTA: [RegExp, string, string][] = [
  [/\bfigma\b/i, 'Figma', 'https://www.figma.com/'],
  [/\bgithub actions\b/i, 'GitHub Actions', 'https://docs.github.com/es/actions'],
  [/\bgithub copilot\b|\bcopilot\b/i, 'GitHub Copilot', 'https://github.com/features/copilot'],
  [/\bgithub\b/i, 'GitHub', 'https://github.com/'],
  [/\bgitlab\b/i, 'GitLab', 'https://gitlab.com/'],
  [/\bgit\b(?!\s*hub|lab)/i, 'Git', 'https://git-scm.com/book/es/v2'],
  [/\bmiro\b/i, 'Miro', 'https://miro.com/'],
  [/\bdraw\.?io\b|\bdiagrams\.net\b/i, 'draw.io', 'https://app.diagrams.net/'],
  [/\blucidchart\b/i, 'Lucidchart', 'https://www.lucidchart.com/'],
  [/\bplantuml\b/i, 'PlantUML', 'https://plantuml.com/es/'],
  [/\bmermaid\b/i, 'Mermaid', 'https://mermaid.js.org/'],
  [/\bstar ?uml\b/i, 'StarUML', 'https://staruml.io/'],
  [/\bdocker compose\b/i, 'Docker Compose', 'https://docs.docker.com/compose/'],
  [/\bdocker\b/i, 'Docker', 'https://docs.docker.com/get-started/'],
  [/\bkubernetes\b|\bk8s\b/i, 'Kubernetes', 'https://kubernetes.io/es/docs/home/'],
  [/\bvercel\b/i, 'Vercel', 'https://vercel.com/docs'],
  [/\bnetlify\b/i, 'Netlify', 'https://docs.netlify.com/'],
  [/\bhostinger\b/i, 'Hostinger', 'https://www.hostinger.com/es/tutoriales'],
  [/\bsupabase\b/i, 'Supabase', 'https://supabase.com/docs'],
  [/\bfirebase\b/i, 'Firebase', 'https://firebase.google.com/docs?hl=es-419'],
  [/\bpostgre(s|sql)\b/i, 'PostgreSQL', 'https://www.postgresql.org/docs/'],
  [/\bmysql\b/i, 'MySQL', 'https://dev.mysql.com/doc/'],
  [/\bmongo ?db\b/i, 'MongoDB', 'https://www.mongodb.com/docs/'],
  [/\bpostman\b/i, 'Postman', 'https://www.postman.com/'],
  [/\bswagger\b|\bopenapi\b/i, 'Swagger / OpenAPI', 'https://swagger.io/docs/'],
  [/\bjira\b/i, 'Jira', 'https://www.atlassian.com/es/software/jira'],
  [/\btrello\b/i, 'Trello', 'https://trello.com/'],
  [/\bnotion\b/i, 'Notion', 'https://www.notion.so/'],
  [/\bclickup\b/i, 'ClickUp', 'https://clickup.com/'],
  [/\basana\b/i, 'Asana', 'https://asana.com/es'],
  [/\bvs ?code\b|\bvisual studio code\b/i, 'Visual Studio Code', 'https://code.visualstudio.com/'],
  [/\bcursor\b/i, 'Cursor', 'https://cursor.com/'],
  [/\bclaude code\b/i, 'Claude Code', 'https://docs.anthropic.com/es/docs/claude-code/overview'],
  [/\bchatgpt\b/i, 'ChatGPT', 'https://chatgpt.com/'],
  [/\bgemini\b/i, 'Gemini', 'https://gemini.google.com/'],
  [/\bn8n\b/i, 'n8n', 'https://docs.n8n.io/'],
  [/\bmake(\.com)?\b(?=.*(automatiz|escenario|integromat))|\bmake\.com\b|\bintegromat\b/i, 'Make', 'https://www.make.com/es'],
  [/\bzapier\b/i, 'Zapier', 'https://zapier.com/'],
  [/\blangchain\b/i, 'LangChain', 'https://python.langchain.com/docs/introduction/'],
  [/\bopenrouter\b/i, 'OpenRouter', 'https://openrouter.ai/docs'],
  [/\bhugging ?face\b/i, 'Hugging Face', 'https://huggingface.co/docs'],
  [/\bjunit\b/i, 'JUnit', 'https://junit.org/junit5/docs/current/user-guide/'],
  [/\bpytest\b/i, 'pytest', 'https://docs.pytest.org/'],
  [/\bjest\b/i, 'Jest', 'https://jestjs.io/es-ES/'],
  [/\bvitest\b/i, 'Vitest', 'https://vitest.dev/'],
  [/\bcypress\b/i, 'Cypress', 'https://docs.cypress.io/'],
  [/\bselenium\b/i, 'Selenium', 'https://www.selenium.dev/documentation/'],
  [/\bplaywright\b/i, 'Playwright', 'https://playwright.dev/'],
  [/\bsonarqube\b|\bsonarcloud\b/i, 'SonarQube', 'https://docs.sonarsource.com/sonarqube-server/'],
  [/\bjmeter\b/i, 'Apache JMeter', 'https://jmeter.apache.org/'],
  [/\bowasp zap\b|\bzap\b(?=.*owasp)/i, 'OWASP ZAP', 'https://www.zaproxy.org/'],
  [/\bowasp\b/i, 'OWASP Top 10', 'https://owasp.org/Top10/es/'],
  [/\breact\b/i, 'React', 'https://es.react.dev/'],
  [/\bnext\.?js\b/i, 'Next.js', 'https://nextjs.org/docs'],
  [/\bnode\.?js\b/i, 'Node.js', 'https://nodejs.org/es'],
  [/\bpython\b/i, 'Python', 'https://docs.python.org/es/3/'],
  [/\bjava\b(?!script)/i, 'Java', 'https://dev.java/learn/'],
  [/\bflutter\b/i, 'Flutter', 'https://docs.flutter.dev/'],
  [/\bandroid studio\b/i, 'Android Studio', 'https://developer.android.com/studio?hl=es-419'],
  [/\bgoogle docs\b/i, 'Google Docs', 'https://docs.google.com/'],
  [/\bgoogle forms\b/i, 'Google Forms', 'https://forms.google.com/'],
  [/\bcanva\b/i, 'Canva', 'https://www.canva.com/'],
  [/\bkahoot\b/i, 'Kahoot!', 'https://kahoot.com/'],
  [/\bpacket tracer\b/i, 'Cisco Packet Tracer', 'https://www.netacad.com/cisco-packet-tracer'],
  [/\bwireshark\b/i, 'Wireshark', 'https://www.wireshark.org/docs/'],
  [/\bvirtualbox\b/i, 'VirtualBox', 'https://www.virtualbox.org/'],
]

// Enlace oficial de UNA herramienta por su nombre ("GitHub (para el control de versiones)" → GitHub)
export function enlaceHerramienta(nombre: string): { titulo: string; url: string } | null {
  const t = String(nombre || '')
  for (const [re, titulo, url] of LISTA) if (re.test(t)) return { titulo, url }
  return null
}

// Todas las herramientas reconocidas en el texto de una descripción (sección HERRAMIENTAS si la hay)
export function enlacesDeDescripcion(descripcion: string): { titulo: string; url: string }[] {
  const t = String(descripcion || '')
  const m = /HERRAMIENTAS\s*:\s*([\s\S]*?)(?:\n\s*[A-ZÁÉÍÓÚÑ ]{6,}:|$)/.exec(t)
  const zona = m ? m[1] : ''
  if (!zona.trim()) return []
  const vistos = new Set<string>()
  const res: { titulo: string; url: string }[] = []
  for (const [re, titulo, url] of LISTA) {
    if (re.test(zona) && !vistos.has(url)) {
      // "GitHub Actions" ya incluye a GitHub: no se repite el genérico si el específico ya está
      if (titulo === 'GitHub' && res.some(r => r.titulo.startsWith('GitHub'))) continue
      vistos.add(url); res.push({ titulo: `${titulo} (herramienta)`, url })
    }
  }
  return res.slice(0, 6)
}
