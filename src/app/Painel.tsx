"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ApiError, logout, onLogoutElsewhere, restoreSession, type User } from "@/lib/api";
import { Logo } from "./Logo";

/** Pergunta antes de sair de uma página com mudanças sem salvar; true = pode sair. */
type GuardaSaida = () => Promise<boolean>;

const SessionContext = createContext<{
  user: User | null;
  setUser: (user: User) => void;
  /** A página com mudanças registra a pergunta; null quando não há o que perder. */
  registrarSaida: (guarda: GuardaSaida | null) => void;
}>({
  user: null,
  setUser: () => {},
  registrarSaida: () => {},
});

/** Admin logado (null só na tela de entrar). */
export const useSession = () => useContext(SessionContext);

// Ícones do menu: o desenho (traços de 24x24) de cada página
const LINKS = [
  {
    href: "/",
    label: "Painel",
    icone: "M4 3h5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM15 3h5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM15 12h5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zM4 16h5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z",
  },
  {
    href: "/usuarios/",
    label: "Usuários",
    icone: "M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.9c1.6.8 2.7 2.4 3 5.1",
  },
  {
    href: "/baralhos/",
    label: "Baralhos compartilhados",
    icone: "M5 8h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zM7 8V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2",
  },
];

/** Menu lateral e proteção de todas as páginas, exceto /entrar/. No celular, o menu abre pelo botão "Menu". */
export function Painel({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const isLogin = pathname.startsWith("/entrar");
  const [menuAberto, setMenuAberto] = useState(false);
  const menuBotaoRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const guardaSaida = useRef<GuardaSaida | null>(null);
  const registrarSaida = useCallback((guarda: GuardaSaida | null) => {
    guardaSaida.current = guarda;
  }, []);

  /**
   * Os links do menu passam pela pergunta da página (ex.: editor com fichas sem
   * salvar). Sem isso, tocar em "Usuários" no meio da edição perdia tudo sem aviso.
   */
  const sairPara = async (e: React.MouseEvent, depois: () => void) => {
    const guarda = guardaSaida.current;
    if (!guarda) {
      depois();
      return;
    }
    e.preventDefault();
    // Fecha o menu antes: com ele aberto, o conteúdo (e a pergunta) fica inerte
    setMenuAberto(false);
    if (await guarda()) {
      guardaSaida.current = null;
      depois();
    }
  };
  const irPara = (href: string) => (e: React.MouseEvent) => sairPara(e, () => router.push(href));

  const check = useCallback(() => {
    setError("");
    restoreSession()
      .then((restored) => (restored ? setUser(restored) : router.replace("/entrar/")))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Não foi possível conferir sua sessão."));
  }, [router]);

  useEffect(() => {
    if (!isLogin && !user) check();
  }, [isLogin, user, check]);

  // Sair numa aba sai em todas: as outras voltam para a tela de entrar
  useEffect(
    () =>
      onLogoutElsewhere(() => {
        setUser(null);
        router.replace("/entrar/");
      }),
    [router]
  );

  // Fecha ao trocar de página
  useEffect(() => {
    setMenuAberto(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuAberto) return;
    // Ao abrir, o foco vai para o primeiro link do menu
    menuRef.current?.querySelector<HTMLElement>("nav a")?.focus();
    const fecharComEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuAberto(false);
        menuBotaoRef.current?.focus();
      }
    };
    // Se a tela crescer até o menu fixo, o conteúdo não pode ficar travado pelo inert
    const largura = window.matchMedia("(min-width: 960px)");
    const fecharSeLargo = () => largura.matches && setMenuAberto(false);
    document.addEventListener("keydown", fecharComEsc);
    largura.addEventListener("change", fecharSeLargo);
    return () => {
      document.removeEventListener("keydown", fecharComEsc);
      largura.removeEventListener("change", fecharSeLargo);
    };
  }, [menuAberto]);

  const handleLogout = (e: React.MouseEvent) =>
    sairPara(e, () => {
      logout();
      setUser(null);
      router.replace("/entrar/");
    });

  let content = children;
  if (!isLogin && error) {
    content = (
      <main id="conteudo" className="estreito centro">
        <Logo tamanho={48} />
        <h1>Não foi possível abrir o painel</h1>
        <p role="alert" className="erro">
          {error}
        </p>
        <div className="acoes">
          <button type="button" onClick={check}>
            Tentar de novo
          </button>
        </div>
      </main>
    );
  } else if (!isLogin && !user) {
    content = (
      <main id="conteudo" className="estreito centro">
        <Logo tamanho={48} />
        <p role="status" className="suave">
          Verificando sua sessão...
        </p>
      </main>
    );
  }

  if (!user || isLogin) {
    return <SessionContext.Provider value={{ user, setUser, registrarSaida }}>{content}</SessionContext.Provider>;
  }

  return (
    <SessionContext.Provider value={{ user, setUser, registrarSaida }}>
      {/* Sem ele, quem usa teclado passa pela marca, pelos links e por "Sair" em toda página */}
      <a href="#conteudo" className="pular">
        Pular para o conteúdo
      </a>
      <div className="app">
        {/* Só no celular: marca e botão que abre o menu */}
        <header className="barra-topo">
          <Link href="/" className="marca" onClick={irPara("/")}>
            <Logo tamanho={28} />
            <span>CardVoz</span>
            <span className="selo selo-admin">Admin</span>
          </Link>
          <button
            ref={menuBotaoRef}
            type="button"
            className="no-menu"
            aria-expanded={menuAberto}
            aria-controls="menu-lateral"
            onClick={() => setMenuAberto(!menuAberto)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              {menuAberto ? (
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              )}
            </svg>
            {menuAberto ? "Fechar" : "Menu"}
          </button>
        </header>

        <div id="menu-lateral" ref={menuRef} className={`lateral${menuAberto ? " aberta" : ""}`}>
          <Link href="/" className="marca lateral-marca" onClick={irPara("/")}>
            <Logo tamanho={30} />
            <span>CardVoz</span>
            <span className="selo selo-admin">Admin</span>
          </Link>
          <nav aria-label="Principal">
            <ul>
              {LINKS.map(({ href, label, icone }) => {
                const current = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <li key={href}>
                    <Link href={href} aria-current={current ? "page" : undefined} onClick={irPara(href)}>
                      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d={icone} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="lateral-conta">
            <div className="lateral-quem">
              <span className="avatar" aria-hidden="true">
                {user.name.trim().charAt(0).toUpperCase() || "?"}
              </span>
              <p>
                <span className="lateral-nome">{user.name}</span>
                <span className="lateral-email">{user.email}</span>
              </p>
            </div>
            <button type="button" className="no-menu" onClick={handleLogout}>
              Sair
            </button>
          </div>
        </div>
        {menuAberto && <div className="fundo-menu" aria-hidden="true" onClick={() => setMenuAberto(false)} />}

        {/* Com o menu aberto no celular, o resto da página fica fora do alcance do teclado e do leitor de tela */}
        <div className="conteudo" inert={menuAberto || undefined}>
          {content}
        </div>
      </div>
    </SessionContext.Provider>
  );
}
