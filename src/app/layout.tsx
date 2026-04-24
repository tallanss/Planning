import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Planify — Générateur de planning",
  description: "Créez le planning de vos équipes en un clic.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900">
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-900 text-white text-sm font-bold">
                P
              </div>
              <span className="text-lg font-semibold tracking-tight">Planify</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <NavLink href="/">Planning</NavLink>
              <NavLink href="/employees">Employés</NavLink>
              <NavLink href="/positions">Postes</NavLink>
              <NavLink href="/templates">Modèles</NavLink>
              <NavLink href="/settings">Réglages</NavLink>
              <LogoutButton />
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
    >
      {children}
    </Link>
  );
}

function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="POST" className="inline">
      <button
        type="submit"
        className="rounded-md px-3 py-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
        title="Se déconnecter"
      >
        Quitter
      </button>
    </form>
  );
}
