export default function HomePage() {
  return (
    <div>
      <div className="hero">
        <div className="hero-inner">
          <div className="hero-tag">ARREY HOTELS</div>
          <h1>Intranet da rede</h1>
          <p>Abra um chamado de tecnologia ou manutenção em menos de um minuto — sem precisar de login.</p>
        </div>
      </div>
      <a className="btn" href="/nova-demanda">Abrir chamado</a>
      <p style={{ marginTop: 16, color: 'var(--muted)', fontSize: '.85rem', maxWidth: 480 }}>
        Gestor, diretoria ou administrador: use o link &quot;Entrar&quot; no topo da página para acessar o painel de acompanhamento.
      </p>
    </div>
  );
}
