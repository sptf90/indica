function inlineText(text) {
  return text.split(/(\*\*[^*\n]+\*\*)/g).map((part, index) =>
    index % 2 ? <strong key={index}>{part.slice(2, -2)}</strong> : part
  );
}

export default function RankingDocument({ title, text, emptyText }) {
  const lines = (text?.trim() || emptyText || "").split(/\r?\n/);
  const blocks = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (blocks.at(-1)?.type !== "break") blocks.push({ type: "break" });
      continue;
    }
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    const bullet = line.match(/^([-*+]\s+|\d+[.)]\s+)(.+)$/);
    if (heading) {
      blocks.push({ type: "heading", text: heading[1] });
    } else if (bullet) {
      const type = /^\d/.test(bullet[1]) ? "ol" : "ul";
      const last = blocks.at(-1);
      if (last?.type === type) last.items.push(bullet[2]);
      else blocks.push({ type, items: [bullet[2]], start: parseInt(bullet[1], 10) || undefined });
    } else {
      const last = blocks.at(-1);
      if (last?.type === "paragraph") last.text += "\n" + line;
      else blocks.push({ type: "paragraph", text: line });
    }
  }

  return (
    <details className="rm-regulation">
      <summary>{title}</summary>
      <div className="ranking-document">
        {blocks.map((block, index) => {
          if (block.type === "break") return null;
          if (block.type === "heading") return <h3 key={index}>{inlineText(block.text)}</h3>;
          if (block.type === "paragraph") return <p key={index}>{inlineText(block.text)}</p>;
          const List = block.type;
          return (
            <List key={index} start={block.start}>
              {block.items.map((item, position) => <li key={position}>{inlineText(item)}</li>)}
            </List>
          );
        })}
      </div>
    </details>
  );
}
