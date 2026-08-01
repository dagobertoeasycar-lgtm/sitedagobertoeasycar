"use client";

import { useState, useEffect } from "react";

type Banner = {
  id: number;
  title: string;
  image_url: string;
  link_url: string;
  link_target: string;
  sort_order: number;
  active: boolean;
};

export function BannerAdmin() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ title: "", image_url: "", link_url: "", sort_order: 0 });
  const [editing, setEditing] = useState<number | null>(null);
  const [intervalSeconds, setIntervalSeconds] = useState(5);
  const [settingsMsg, setSettingsMsg] = useState("");

  const load = () => {
    fetch("/api/admin/banners").then(r => r.json()).then(d => { setBanners(d); setLoading(false); });
  };
  useEffect(load, []);

  useEffect(() => {
    fetch("/api/admin/banner-settings")
      .then((response) => response.json())
      .then((data: { intervalSeconds?: number }) => {
        if (Number.isInteger(data.intervalSeconds)) setIntervalSeconds(data.intervalSeconds as number);
      })
      .catch(() => setSettingsMsg("Não foi possível carregar a configuração"));
  }, []);

  const saveSettings = async () => {
    if (!Number.isInteger(intervalSeconds) || intervalSeconds < 1 || intervalSeconds > 300) {
      setSettingsMsg("Informe um tempo entre 1 e 300 segundos");
      return;
    }
    setSettingsMsg("Salvando...");
    const response = await fetch("/api/admin/banner-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intervalSeconds }),
    });
    if (response.ok) setSettingsMsg("Tempo do carrossel atualizado!");
    else setSettingsMsg("Erro ao salvar o tempo do carrossel");
  };

  const save = async () => {
    if (!form.image_url) { setMsg("URL da imagem é obrigatória"); return; }
    setMsg("Salvando...");
    const method = editing ? "PUT" : "POST";
    const body = editing ? { ...form, id: editing } : form;
    const res = await fetch("/api/admin/banners", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      setMsg(editing ? "Banner atualizado!" : "Banner criado!");
      setForm({ title: "", image_url: "", link_url: "", sort_order: 0 });
      setEditing(null);
      load();
    } else {
      setMsg("Erro ao salvar");
    }
  };

  const toggle = async (b: Banner) => {
    await fetch("/api/admin/banners", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: b.id, active: !b.active }) });
    load();
  };

  const remove = async (id: number) => {
    if (!confirm("Excluir este banner?")) return;
    await fetch("/api/admin/banners", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  };

  const edit = (b: Banner) => {
    setEditing(b.id);
    setForm({ title: b.title, image_url: b.image_url, link_url: b.link_url, sort_order: b.sort_order });
    setMsg("");
  };

  const cancel = () => {
    setEditing(null);
    setForm({ title: "", image_url: "", link_url: "", sort_order: 0 });
    setMsg("");
  };

  return (
    <div className="banner-admin">
      <h2>Banners do Site</h2>
      <p style={{ color: "#64748b", fontSize: "0.9rem", margin: "0 0 16px" }}>
        Os banners aparecem no topo da página inicial em formato carrossel automático. Use imagens na proporção 1916x821 para exibição completa.
      </p>

      <div className="banner-settings">
        <div>
          <h3>Configuração do carrossel</h3>
          <p>Defina por quantos segundos cada banner permanece visível.</p>
        </div>
        <label>
          Tempo de troca (segundos)
          <input
            type="number"
            min="1"
            max="300"
            step="1"
            value={intervalSeconds}
            onChange={(event) => setIntervalSeconds(parseInt(event.target.value, 10) || 1)}
          />
        </label>
        <button className="button button-small" type="button" onClick={saveSettings}>Salvar tempo</button>
        {settingsMsg && <span className={settingsMsg.includes("Erro") || settingsMsg.includes("Não") ? "error" : "done"}>{settingsMsg}</span>}
      </div>

      {/* Form */}
      <div className="banner-form">
        <h3>{editing ? "Editar Banner" : "Novo Banner"}</h3>
        <div className="form-row">
          <label>
            Título (opcional)
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Promoção de Julho" />
          </label>
          <label>
            Ordem
            <input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} style={{ width: 80 }} />
          </label>
        </div>
        <label>
          URL da Imagem *
          <input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} placeholder="https://... ou /banner.jpg" />
        </label>
        <label>
          Link ao clicar (opcional)
          <input value={form.link_url} onChange={e => setForm({ ...form, link_url: e.target.value })} placeholder="/veiculos ou https://..." />
        </label>
        {form.image_url && (
          <div className="banner-preview">
            <img src={form.image_url} alt="Preview" onError={e => (e.currentTarget.style.display = "none")} />
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="button" onClick={save}>{editing ? "Atualizar" : "Adicionar"}</button>
          {editing && <button className="button button-outline" onClick={cancel}>Cancelar</button>}
        </div>
        {msg && <p style={{ marginTop: 8, fontSize: "0.9rem", color: msg.includes("Erro") ? "#dc2626" : "#16a34a" }}>{msg}</p>}
      </div>

      {/* List */}
      {loading ? <p>Carregando...</p> : banners.length === 0 ? <p>Nenhum banner cadastrado.</p> : (
        <div className="admin-table-wrap" style={{ marginTop: 20 }}>
          <table>
            <thead><tr><th>Preview</th><th>Título</th><th>Ordem</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>
              {banners.map(b => (
                <tr key={b.id}>
                  <td><img src={b.image_url} alt="" style={{ width: 120, height: 52, objectFit: "contain", background: "#0a0a14", borderRadius: 6 }} /></td>
                  <td>{b.title || <span style={{ color: "#94a3b8" }}>Sem título</span>}</td>
                  <td>{b.sort_order}</td>
                  <td>
                    <button onClick={() => toggle(b)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.85rem", fontWeight: 700, color: b.active ? "#16a34a" : "#94a3b8" }}>
                      {b.active ? "✅ Ativo" : "⏸️ Inativo"}
                    </button>
                  </td>
                  <td style={{ display: "flex", gap: 6 }}>
                    <button className="button button-small button-outline" onClick={() => edit(b)}>Editar</button>
                    <button className="button button-small" onClick={() => remove(b.id)} style={{ background: "#dc2626" }}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
