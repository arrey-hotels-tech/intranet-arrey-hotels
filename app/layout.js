import './globals.css';

export const metadata = {
  title: 'Intranet Arrey Hotels',
  description: 'Central de chamados e comunicação da rede Arrey Hotels',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="topbar">
          <a className="brand" href="/">Arrey Hotels</a>
          <nav className="nav-links">
            <a href="/nova-demanda">Abrir chamado</a>
            <a href="/login">Entrar</a>
          </nav>
        </div>
        <main>{children}</main>
      </body>
    </html>
  );
}
