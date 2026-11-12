"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, getSharedDeck, saveSharedDeck, type CardInput } from "@/lib/api";
import { guardarAviso } from "@/lib/aviso";
import { colarFichas } from "@/lib/colarFichas.mjs";
import { mensagemDeErro, plural } from "@/lib/texto";
import { ErroCarregar } from "../../ErroCarregar";
import { useConfirmar } from "../../Confirmar";
import { useSession } from "../../Painel";

const EMPTY: CardInput = { question: "", answer: "" };

function Voltar({ onClick }: { onClick?: (e: React.MouseEvent) => void }) {
  return (
    <Link href="/baralhos/" className="voltar" onClick={onClick}>
      <span aria-hidden="true">←</span> Baralhos compartilhados
    </Link>
  );
}

// Mesmo esqueleto no Suspense e enquanto o baralho carrega
function EditarLoading({ onVoltar }: { onVoltar?: (e: React.MouseEvent) => void }) {
  return (
    <main id="conteudo">
      <Voltar onClick={onVoltar} />
      <p role="status" className="sr-only">
        Carregando baralho...
      </p>
      <div aria-hidden="true" className="cartao">
        <span className="esqueleto" style={{ width: "50%", height: "2rem" }} />
        <span className="esqueleto" style={{ width: "100%", height: "3rem" }} />
        <span className="esqueleto" style={{ width: "100%", height: "5rem" }} />
      </div>
    </main>
  );
}

/** Erro mostrado junto do campo, que também recebe o foco. */
interface Problema {
  campo: string;
  mensagem: string;
}

/** Mesma lista do site (src/lib/languages.ts); "" = português, o padrão */
const IDIOMAS = [
  { value: "", label: "Português" },
  { value: "en", label: "Inglês" },
  { value: "es", label: "Espanhol" },
  { value: "fr", label: "Francês" },
  { value: "it", label: "Italiano" },
  { value: "de", label: "Alemão" },
];

function EditarContent() {
  const router = useRouter();
  const id = useSearchParams().get("id");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // Idioma das fichas: o leitor de tela de quem copiar o baralho pronuncia nesse idioma ("" = português)
  const [questionLanguage, setQuestionLanguage] = useState("");
  const [answerLanguage, setAnswerLanguage] = useState("");
  const [cards, setCards] = useState<CardInput[]>([{ ...EMPTY }]);
  const [loading, setLoading] = useState(Boolean(id));
  const [loadError, setLoadError] = useState("");
  // 404: o baralho foi excluído ou o link é antigo (tentar de novo não resolve)
  const [notFound, setNotFound] = useState(false);
  const { registrarSaida } = useSession();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [problema, setProblema] = useState<Problema | null>(null);
  const [status, setStatus] = useState("");
  const [colado, setColado] = useState("");
  const colarRef = useRef<HTMLDialogElement>(null);
  const [confirmar, dialogo] = useConfirmar();
  // Campo que recebe o foco depois que a lista de fichas mudar (adicionar, remover, colar)
  const focusAfterRender = useRef<string | null>(null);
  // Conteúdo salvo, para saber se há mudanças sem salvar
  const salvo = useRef(
    JSON.stringify({ title: "", description: "", questionLanguage: "", answerLanguage: "", cards: [EMPTY] })
  );

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setLoadError("");
    setNotFound(false);
    getSharedDeck(id)
      .then((deck) => {
        const loaded = {
          title: deck.title,
          description: deck.description ?? "",
          questionLanguage: deck.questionLanguage ?? "",
          answerLanguage: deck.answerLanguage ?? "",
          cards: deck.cards.map(({ question, answer }) => ({ question, answer })),
        };
        salvo.current = JSON.stringify(loaded);
        setTitle(loaded.title);
        setDescription(loaded.description);
        setQuestionLanguage(loaded.questionLanguage);
        setAnswerLanguage(loaded.answerLanguage);
        setCards(loaded.cards);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setLoadError(mensagemDeErro(e, "Não foi possível carregar o baralho."));
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  useEffect(() => {
    if (focusAfterRender.current) {
      document.getElementById(focusAfterRender.current)?.focus();
      focusAfterRender.current = null;
    }
  }, [cards]);

  const dirty = !loading && JSON.stringify({ title, description, questionLanguage, answerLanguage, cards }) !== salvo.current;

  // Fechar a aba ou recarregar com mudanças: o navegador pergunta antes
  useEffect(() => {
    if (!dirty) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [dirty]);

  const podeSair = useCallback(
    async () =>
      !dirty ||
      confirmar({
        titulo: "Sair sem salvar?",
        mensagem: "As mudanças neste baralho serão perdidas.",
        confirmar: "Sair sem salvar",
        cancelar: "Continuar editando",
        perigo: true,
      }),
    [dirty, confirmar]
  );

  // O menu lateral também pergunta antes de sair com mudanças
  useEffect(() => {
    registrarSaida(dirty ? podeSair : null);
    return () => registrarSaida(null);
  }, [dirty, podeSair, registrarSaida]);

  const sair = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (await podeSair()) router.push("/baralhos/");
  };

  const updateCard = (index: number, field: keyof CardInput, value: string) => {
    if (problema) setProblema(null);
    setCards((current) => current.map((card, i) => (i === index ? { ...card, [field]: value } : card)));
  };

  const addCard = () => {
    focusAfterRender.current = `ficha-${cards.length}-pergunta`;
    setCards((current) => [...current, { ...EMPTY }]);
  };

  // O botão some junto com a ficha: o foco vai para a ficha que ficou no lugar (ou a anterior)
  const removeCard = (index: number) => {
    setProblema(null);
    focusAfterRender.current = `ficha-${Math.min(index, cards.length - 2)}-pergunta`;
    setCards((current) => current.filter((_, i) => i !== index));
  };

  const lidas = colarFichas(colado);

  const adicionarColadas = () => {
    if (lidas.fichas.length === 0) return;
    // Só uma ficha vazia (baralho novo): as coladas entram no lugar dela
    const base = cards.length === 1 && !cards[0].question.trim() && !cards[0].answer.trim() ? [] : cards;
    focusAfterRender.current = `ficha-${base.length}-pergunta`;
    setCards([...base, ...lidas.fichas]);
    setStatus(`${plural(lidas.fichas.length, "ficha adicionada", "fichas adicionadas")}.`);
    setColado("");
    colarRef.current?.close();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError("");
    // Fichas totalmente vazias são ignoradas; meio preenchidas são erro
    const filled = cards.filter((c) => c.question.trim() || c.answer.trim());
    const incomplete = cards.findIndex(
      (c) => (c.question.trim() || c.answer.trim()) && !(c.question.trim() && c.answer.trim())
    );
    let found: Problema | null = null;
    if (!title.trim()) found = { campo: "titulo", mensagem: "Escreva um título para o baralho." };
    else if (filled.length === 0)
      found = { campo: "ficha-0-pergunta", mensagem: "Escreva pelo menos uma ficha, com pergunta e resposta." };
    else if (incomplete >= 0) {
      const falta = cards[incomplete].question.trim() ? "resposta" : "pergunta";
      found = { campo: `ficha-${incomplete}-${falta}`, mensagem: `Escreva a ${falta} da ficha ${incomplete + 1}.` };
    }
    if (found) {
      setProblema(found);
      document.getElementById(found.campo)?.focus();
      return;
    }

    setProblema(null);
    setSaving(true);
    try {
      await saveSharedDeck(id, {
        title: title.trim(),
        description: description.trim(),
        questionLanguage,
        answerLanguage,
        cards: filled,
      });
      salvo.current = JSON.stringify({ title, description, questionLanguage, answerLanguage, cards });
      guardarAviso(`“${title.trim()}” salvo, com ${plural(filled.length, "ficha", "fichas")}.`);
      router.push("/baralhos/");
    } catch (err) {
      setError(mensagemDeErro(err, "Não foi possível salvar. Tente de novo."));
      setSaving(false);
    }
  };

  // Atributos de um campo que pode estar com erro
  const erroDe = (campo: string) =>
    problema?.campo === campo ? { "aria-invalid": true, "aria-describedby": `${campo}-erro` } : {};
  const mensagemDe = (campo: string) =>
    problema?.campo === campo && (
      <span id={`${campo}-erro`} className="mensagem-campo">
        {problema.mensagem}
      </span>
    );

  const voltar = <Voltar onClick={sair} />;

  if (loading) return <EditarLoading onVoltar={sair} />;

  if (notFound) {
    return (
      <main id="conteudo">
        <Voltar />
        <h1>Baralho não encontrado</h1>
        <p>Ele pode ter sido excluído, ou o link está incompleto.</p>
        <div className="acoes">
          <Link href="/baralhos/" className="botao">
            Voltar aos baralhos compartilhados
          </Link>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main id="conteudo">
        <Voltar />
        <ErroCarregar titulo="O baralho não carregou" mensagem={loadError} onTentar={load} />
      </main>
    );
  }

  const preenchidas = cards.filter((c) => c.question.trim() && c.answer.trim()).length;

  return (
    <main id="conteudo">
      {voltar}
      <div className="cabecalho">
        <div>
          <h1>{id ? "Editar baralho compartilhado" : "Novo baralho compartilhado"}</h1>
          <p className="suave">
            {id
              ? "Salvar substitui o título e as fichas. As cópias que as pessoas já fizeram não mudam."
              : "Depois de salvo, ele aparece para todo mundo em “Baralhos prontos”."}
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="erro">
          {error}
        </p>
      )}
      <p role="status" className={status ? "sucesso" : "sr-only"}>
        {status}
      </p>

      <form onSubmit={handleSubmit} noValidate className="pilha">
        <section className="cartao" aria-labelledby="info-titulo">
          <h2 id="info-titulo">Informações</h2>
          <label className="campo">
            Título
            <input
              id="titulo"
              value={title}
              maxLength={200}
              onChange={(e) => {
                setTitle(e.target.value);
                if (problema?.campo === "titulo") setProblema(null);
              }}
              {...erroDe("titulo")}
            />
            {mensagemDe("titulo")}
          </label>
          <label className="campo">
            <span>
              Descrição <span className="dica">(opcional)</span>
            </span>
            <textarea
              rows={2}
              value={description}
              maxLength={1000}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="campo">
            Idioma das perguntas
            <select value={questionLanguage} onChange={(e) => setQuestionLanguage(e.target.value)}>
              {IDIOMAS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            Idioma das respostas
            <select value={answerLanguage} onChange={(e) => setAnswerLanguage(e.target.value)}>
              {IDIOMAS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section aria-labelledby="fichas-titulo" className="pilha">
          <div className="cabecalho">
            <h2 id="fichas-titulo">Fichas ({cards.length})</h2>
            <div className="acoes">
              <button type="button" className="secundario" onClick={() => colarRef.current?.showModal()}>
                Colar várias fichas
              </button>
              <button type="button" className="secundario" onClick={addCard}>
                Adicionar ficha
              </button>
            </div>
          </div>

          <ol className="fichas">
            {cards.map((card, i) => (
              <li key={i} className="cartao">
                <div className="ficha-topo">
                  <h3 id={`ficha-${i}-titulo`} className="ficha-numero">
                    Ficha {i + 1}
                  </h3>
                  {cards.length > 1 && (
                    <button type="button" className="texto perigo-texto" onClick={() => removeCard(i)}>
                      Remover ficha {i + 1}
                    </button>
                  )}
                </div>
                <div role="group" aria-labelledby={`ficha-${i}-titulo`} className="ficha-campos">
                  <label className="campo">
                    Pergunta
                    <textarea
                      id={`ficha-${i}-pergunta`}
                      rows={2}
                      value={card.question}
                      onChange={(e) => updateCard(i, "question", e.target.value)}
                      {...erroDe(`ficha-${i}-pergunta`)}
                    />
                    {mensagemDe(`ficha-${i}-pergunta`)}
                  </label>
                  <label className="campo">
                    Resposta
                    <textarea
                      id={`ficha-${i}-resposta`}
                      rows={2}
                      value={card.answer}
                      onChange={(e) => updateCard(i, "answer", e.target.value)}
                      {...erroDe(`ficha-${i}-resposta`)}
                    />
                    {mensagemDe(`ficha-${i}-resposta`)}
                  </label>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <div className="barra-salvar">
          <span className="suave">{plural(preenchidas, "ficha pronta", "fichas prontas")}</span>
          <div className="acoes">
            <button type="button" className="secundario" onClick={() => sair()}>
              Cancelar
            </button>
            <button type="submit" aria-disabled={saving || undefined}>
              {saving ? "Salvando..." : "Salvar baralho"}
            </button>
          </div>
        </div>
      </form>

      <dialog ref={colarRef} aria-labelledby="colar-titulo" onClose={() => setColado("")}>
        <div className="dialogo-conteudo">
          <h2 id="colar-titulo">Colar várias fichas</h2>
          <label className="campo">
            Lista de fichas
            <span className="dica" id="colar-dica">
              Uma ficha por linha: pergunta; resposta. Duas colunas copiadas de uma planilha também funcionam.
            </span>
            <textarea
              rows={8}
              value={colado}
              aria-describedby="colar-dica colar-contagem"
              onChange={(e) => setColado(e.target.value)}
            />
          </label>
          <p id="colar-contagem" className="suave" aria-live="polite">
            {colado.trim()
              ? `${plural(lidas.fichas.length, "ficha encontrada", "fichas encontradas")}` +
                (lidas.ignoradas ? `; ${plural(lidas.ignoradas, "linha ignorada", "linhas ignoradas")} por não ter pergunta e resposta.` : ".")
              : "Nenhuma ficha ainda."}
          </p>
          <div className="dialogo-acoes">
            <button type="button" className="secundario" onClick={() => colarRef.current?.close()}>
              Cancelar
            </button>
            <button type="button" onClick={adicionarColadas} aria-disabled={lidas.fichas.length === 0 || undefined}>
              {lidas.fichas.length > 0 ? `Adicionar ${plural(lidas.fichas.length, "ficha", "fichas")}` : "Adicionar"}
            </button>
          </div>
        </div>
      </dialog>
      {dialogo}
    </main>
  );
}

// useSearchParams exige Suspense no site estático
export default function EditarPage() {
  return (
    <Suspense fallback={<EditarLoading />}>
      <EditarContent />
    </Suspense>
  );
}
