import Link from "next/link";

export default function EmBreve({ title, blurb }) {
  return (
    <main className="page page-wide">
      <div className="placeholder-panel reveal">
        <p className="eyebrow">Em breve</p>
        <h1>{title}</h1>
        <p className="lead">
          {blurb ||
            "Esta área faz parte do roadmap e ainda não está disponível no MVP."}
        </p>
        <Link className="pill-cta" href="/">
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
