import { useState } from 'react';
import { authAPI } from '../servicos/api';

export default function Login({ aoLogar }) {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!login || !senha) {
      setErro('Preencha login e senha');
      return;
    }

    setErro('');
    setCarregando(true);

    try {
      const resultado = await authAPI.login({ login, senha });
      localStorage.setItem('pdv_token', resultado.token);
      localStorage.setItem('pdv_usuario', JSON.stringify(resultado.usuario));
      aoLogar(resultado.usuario);
    } catch (err) {
      setErro(err.message || 'Erro ao fazer login');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">⚡</div>
          <h1 className="login-titulo">PDV Open Source</h1>
          <p className="login-subtitulo">Sistema de Ponto de Venda</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          {erro && (
            <div className="login-erro">
              ❌ {erro}
            </div>
          )}

          <div className="campo">
            <label>👤 Login</label>
            <input
              type="text"
              className="input input-grande"
              placeholder="Digite seu login"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </div>

          <div className="campo">
            <label>🔒 Senha</label>
            <input
              type="password"
              className="input input-grande"
              placeholder="Digite sua senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primario btn-grande btn-bloco"
            disabled={carregando}
          >
            {carregando ? '⏳ Entrando...' : '🔓 Entrar'}
          </button>

          <div className="login-dica">
            <p>Acesso padrão:</p>
            <div className="login-credenciais">
              <span><strong>Gerente:</strong> admin / admin123</span>
              <span><strong>Operador:</strong> operador / op123</span>
            </div>
          </div>
        </form>
      </div>

      <div className="login-footer">
        PDV Open Source v2.0 — Sistema gratuito e de código aberto
      </div>
    </div>
  );
}
