"use client";

/** Falha ao carregar os dados da página: a mensagem e "Tentar de novo" (que recarrega só os dados). */
export function ErroCarregar({
  titulo,
  mensagem,
  onTentar,
}: {
  /** Título da página quando o erro ocupa a tela toda (o editor); sem ele, vira um cartão na lista */
  titulo?: string;
  mensagem: string;
  onTentar: () => void;
}) {
  const conteudo = (
    <>
      <p role="alert" className="erro">
        {mensagem}
      </p>
      <div className="acoes">
        <button type="button" onClick={onTentar}>
          Tentar de novo
        </button>
      </div>
    </>
  );
  if (titulo) {
    return (
      <>
        <h1>{titulo}</h1>
        {conteudo}
      </>
    );
  }
  return <div className="cartao">{conteudo}</div>;
}
