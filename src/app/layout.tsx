import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Planning Poker | Estimativas em equipe",
  description: "Uma sala simples para estimar tarefas em equipe.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
