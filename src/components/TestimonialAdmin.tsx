"use client";

import { useEffect, useState } from "react";

type Testimonial = { name: string; text: string; vehicle: string };
const empty: Testimonial = { name: "", text: "", vehicle: "" };

export function TestimonialAdmin() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [message, setMessage] = useState("Carregando...");
  useEffect(() => { fetch("/api/admin/testimonials").then(response => response.json()).then(data => { setItems(Array.isArray(data) ? data : []); setMessage(""); }).catch(() => setMessage("Não foi possível carregar os depoimentos.")); }, []);
  function update(index: number, key: keyof Testimonial, value: string) { setItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item)); }
  function add() { if (items.length < 6) setItems(current => [...current, { ...empty }]); }
  async function save() { setMessage("Salvando..."); const response = await fetch("/api/admin/testimonials", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ testimonials: items }) }); setMessage(response.ok ? "Depoimentos atualizados na home." : "Não foi possível salvar."); }
  return <div className="adm-card testimonial-admin"><p>Cadastre somente avaliações autorizadas pelos clientes. Elas aparecem na home depois de salvas.</p>{items.map((item, index) => <fieldset key={index}><legend>Depoimento {index + 1}</legend><label>Nome<input value={item.name} onChange={event => update(index, "name", event.currentTarget.value)} maxLength={80} /></label><label>Texto<textarea value={item.text} onChange={event => update(index, "text", event.currentTarget.value)} maxLength={360} rows={3} /></label><label>Veículo ou contexto<input value={item.vehicle} onChange={event => update(index, "vehicle", event.currentTarget.value)} maxLength={100} placeholder="Ex.: Compra de um Corolla" /></label><button type="button" className="button button-small" onClick={() => setItems(current => current.filter((_, itemIndex) => itemIndex !== index))}>Remover</button></fieldset>)}{items.length < 6 && <button type="button" className="button button-outline" onClick={add}>Adicionar depoimento</button>}<div className="adm-actions"><button type="button" className="button" onClick={save}>Salvar depoimentos</button><span>{message}</span></div></div>;
}
