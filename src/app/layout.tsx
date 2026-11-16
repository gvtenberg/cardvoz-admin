import type { Metadata } from "next";
import { Inter, Nunito } from "next/font/google";
import { Painel } from "./Painel";
import "./globals.css";

// Inter no texto e nos números (boa em tamanhos pequenos); Nunito só no nome "CardVoz", como no site
const nunito = Nunito({ subsets: ["latin"], weight: ["800"], variable: "--fonte-titulo", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--fonte-texto", display: "swap" });

export const metadata: Metadata = {
  title: "CardVoz Admin",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${nunito.variable} ${inter.variable}`}>
      <body>
        <Painel>{children}</Painel>
      </body>
    </html>
  );
}
