"use client";

import { useState, type FormEvent } from "react";
import { KeyRound, UserPlus } from "lucide-react";
import { ROLES } from "@/lib/permissions-shared";

export type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  active: boolean;
  lastLogin: string | null;
  createdAt: string;
};

/** Sugestão de senha temporária forte (a pessoa troca no primeiro acesso). */
function suggestPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("");
}

async function send(url: string, method: string, body: unknown) {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (response.status === 401) { window.location.assign("/admin/login"); return "Sessão expirada"; }
  if (!response.ok) return ((await response.json().catch(() => ({}))) as { error?: string }).error || "Não foi possível salvar.";
  return "";
}

export function UsersAdmin({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [tempPassword, setTempPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  async function update(id: string, body: Record<string, unknown>, success: string) {
    setMessage(null);
    const error = await send(`/api/admin/users/${id}`, "PATCH", body);
    if (error) { setMessage({ kind: "error", text: error }); return false; }
    setMessage({ kind: "ok", text: success });
    window.setTimeout(() => window.location.reload(), 700);
    return true;
  }

  async function resetPassword(user: UserRow) {
    const password = suggestPassword();
    if (!window.confirm(`Definir uma nova senha temporária para ${user.email}?\n\nA senha atual deixa de funcionar e a pessoa precisa trocar no próximo acesso.`)) return;
    const error = await send(`/api/admin/users/${user.id}`, "PATCH", { password });
    if (error) { setMessage({ kind: "error", text: error }); return; }
    setTempPassword(`${user.email} → ${password}`);
    setMessage({ kind: "ok", text: "Senha temporária definida. Passe para a pessoa por um canal seguro; ela não aparece de novo." });
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setMessage(null);
    const error = await send("/api/admin/users", "POST", data);
    if (error) { setMessage({ kind: "error", text: error }); return; }
    setTempPassword(`${String(data.email)} → ${String(data.password)}`);
    setMessage({ kind: "ok", text: "Usuário criado. Passe a senha temporária por um canal seguro." });
    form.reset();
    setNewPassword("");
    window.setTimeout(() => window.location.reload(), 1500);
  }

  return (
    <>
      {message && <p className={`adm-feedback${message.kind === "error" ? " error" : ""}`} aria-live="polite">{message.text}</p>}
      {tempPassword && <p className="ad-note"><KeyRound size={14} aria-hidden /> Senha temporária: <code>{tempPassword}</code></p>}

      <section className="adm-card">
        <div className="adm-card-header"><h2>Usuários</h2></div>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Situação</th><th>Último acesso</th><th>Ações</th></tr></thead>
            <tbody>
              {users.map((user) => {
                const self = user.id === currentUserId;
                return (
                  <tr key={user.id}>
                    <td>
                      <input
                        className="ad-inline-input"
                        defaultValue={user.name ?? ""}
                        placeholder="Nome"
                        aria-label={`Nome de ${user.email}`}
                        onBlur={(event) => {
                          const value = event.currentTarget.value.trim();
                          if (value !== (user.name ?? "")) void update(user.id, { name: value }, "Nome atualizado.");
                        }}
                      />
                      {self && <small> (você)</small>}
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <select
                        className="ad-inline-input"
                        value={user.role}
                        disabled={self}
                        title={self ? "Você não pode mudar o seu próprio perfil" : undefined}
                        onChange={(event) => void update(user.id, { role: event.currentTarget.value }, "Perfil atualizado.")}
                      >
                        {Object.entries(ROLES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </td>
                    <td>
                      <span className={`adm-badge ${user.active ? "published" : "paused"}`}>{user.active ? "Ativo" : "Desativado"}</span>
                    </td>
                    <td>{user.lastLogin ? new Date(user.lastLogin).toLocaleString("pt-BR") : "—"}</td>
                    <td>
                      <div className="ad-icon-actions">
                        <button type="button" className="ad-btn ghost small" onClick={() => resetPassword(user)}>Nova senha</button>
                        {!self && (
                          <button
                            type="button"
                            className={`ad-btn small ${user.active ? "danger" : "ghost"}`}
                            onClick={() => {
                              if (user.active && !window.confirm(`Desativar ${user.email}? A pessoa perde o acesso na hora.`)) return;
                              void update(user.id, { active: !user.active }, user.active ? "Usuário desativado." : "Usuário reativado.");
                            }}
                          >
                            {user.active ? "Desativar" : "Reativar"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="adm-card">
        <div className="adm-card-header"><h2>Novo usuário</h2></div>
        <form className="ad-form-grid" onSubmit={create}>
          <label className="ad-field"><span>Nome</span><input name="name" maxLength={120} /></label>
          <label className="ad-field"><span>E-mail</span><input name="email" type="email" required /></label>
          <label className="ad-field">
            <span>Perfil</span>
            <select name="role" defaultValue="comercial">
              {Object.entries(ROLES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="ad-field span-2">
            <span>Senha temporária (mín. 14 caracteres)</span>
            <div className="ad-inline-row">
              <input name="password" value={newPassword} onChange={(event) => setNewPassword(event.currentTarget.value)} minLength={14} required />
              <button type="button" className="ad-btn ghost small" onClick={() => setNewPassword(suggestPassword())}>Gerar</button>
            </div>
            <small>A pessoa troca no primeiro acesso.</small>
          </label>
          <div className="ad-editor-actions" style={{ border: 0, marginTop: 0, alignSelf: "end" }}>
            <button className="ad-btn"><UserPlus size={15} aria-hidden />Criar usuário</button>
          </div>
        </form>
      </section>
    </>
  );
}
