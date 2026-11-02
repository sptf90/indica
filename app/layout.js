import { Plus_Jakarta_Sans, Sora } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Sora({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata = {
  title: "GoIndica — Você procura. Alguém indica.",
  description:
    "Comunidade de indicações locais: peça o que precisa na sua cidade, receba respostas de gente real, construa reputação e dispute rankings com prêmios.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${display.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
