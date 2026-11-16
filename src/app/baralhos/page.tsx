"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { deleteSharedDeck, formatDate, getSharedDecks, type Deck } from "@/lib/api";
import { lerAviso } from "@/lib/aviso";
import { mensagemDeErro, plural } from "@/lib/texto";
import { useConfirmar } from "../Confirmar";
import { ErroCarregar } from "../ErroCarregar";

export default function BaralhosPage() {
  const [decks, setDecks] = useState<Deck[] | null>(null);
  // Falha ao carregar (com "Tentar de novo") e falha ao excluir (só a mensagem)
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [status, setStatus] = useState("");
  // Trava durante a exclusão: um segundo toque mandaria outro DELETE (e um erro 404)
  const [busyId, setBusyId] = useState<string | null>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const [confirmar, dialogo] = useConfirmar();

  const load = useCallback(() => {
    setError("");
    getSharedDecks()
      .then(setDecks)
      .catch((e) => setError(mensagemDeErro(e, "Não foi possível carregar os baralhos.")));
  }, []);

  useEffect(() => {
    load();
    // "“Biologia” salvo." vindo do editor
    const aviso = lerAviso();
    if (aviso) setStatus(aviso);
  }, [load]);

  const remove = async (deck: Deck) => {
    if (busyId) return;
    const ok = await confirmar({
      titulo: `Excluir “${deck.title}”?`,
      mensagem: `O baralho e ${plural(deck.cardCount, "ficha", "fichas")} saem de “Baralhos prontos”. Quem já adicionou uma cópia continua com ela.`,
      confirmar: "Excluir baralho",
      perigo: true,
    });
    if (!ok) return;
    setBusyId(deck.id);
    setActionError("");
    setStatus("");
    try {
      await deleteSharedDeck(deck.id);
      setStatus(`“${deck.title}” excluído.`);
      load();
      // O cartão (e o botão que tinha o foco) sumiu: o foco volta para o título da página
      tituloRef.current?.focus();
    } catch (e) {
      setActionError(mensagemDeErro(e, "Não foi possível excluir. Tente de novo."));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main id="conteudo">
      <div className="cabecalho">
        <div>
          <h1 ref={tituloRef} tabIndex={-1}>
            Baralhos compartilhados
          </h1>
          <p className="suave">
            Aparecem em &ldquo;Baralhos prontos&rdquo; no CardVoz. Cada pessoa adiciona uma cópia; mudar ou excluir
            aqui não altera as cópias já feitas.
          </p>
        </div>
        <Link href="/baralhos/editar/" className="botao">
          Novo baralho compartilhado
        </Link>
      </div>

      <p role="status" className={status ? "sucesso" : "sr-only"}>
        {status}
      </p>
      {actionError && (
        <p role="alert" className="erro">
          {actionError}
        </p>
      )}
      {error && <ErroCarregar mensagem={error} onTentar={load} />}

      {!decks && !error && (
        <>
          <p role="status" className="sr-only">
            Carregando baralhos...
          </p>
          <div className="cartao tabela" aria-hidden="true">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="linha">
                <div className="linha-texto">
                  <span className="esqueleto" style={{ width: "35%", height: "1.125rem" }} />
                  <span className="esqueleto" style={{ width: "70%", height: "1rem" }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {decks && decks.length === 0 && (
        <div className="cartao vazio">
          <h2>Nenhum baralho compartilhado ainda</h2>
          <p className="suave">Crie o primeiro: ele aparece para todo mundo em &ldquo;Baralhos prontos&rdquo;.</p>
          <Link href="/baralhos/editar/" className="botao">
            Criar o primeiro baralho
          </Link>
        </div>
      )}

      {decks && decks.length > 0 && (
        <div className="cartao tabela tabela-baralhos">
          {/* Só visual: cada linha já diz o que é cada dado para o leitor de tela */}
          <div className="tabela-cabeca" aria-hidden="true">
            <span>Baralho</span>
            <span>Fichas</span>
            <span>Atualizado em</span>
            <span />
          </div>
          <ul className="tabela-linhas">
            {decks.map((deck) => (
              <li key={deck.id} className="linha baralho">
                <div className="linha-texto">
                  <h2 className="linha-nome">{deck.title}</h2>
                  {deck.description && <p className="linha-sub">{deck.description}</p>}
                </div>
                <p className="linha-dado">{plural(deck.cardCount, "ficha", "fichas")}</p>
                <p className="linha-dado">
                  <span className="rotulo-celular">Atualizado em </span>
                  {formatDate(deck.updatedAt || deck.createdAt)}
                </p>
                <div className="linha-acoes">
                  <Link
                    href={`/baralhos/editar/?id=${deck.id}`}
                    className="botao secundario"
                    aria-label={`Editar: ${deck.title}`}
                  >
                    Editar
                  </Link>
                  <button
                    type="button"
                    className="perigo"
                    onClick={() => remove(deck)}
                    aria-disabled={busyId === deck.id || undefined}
                    aria-label={`Excluir: ${deck.title}`}
                  >
                    {busyId === deck.id ? "Excluindo..." : "Excluir"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {dialogo}
    </main>
  );
}
