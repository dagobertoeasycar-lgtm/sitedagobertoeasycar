"use client";

import { useState, type FormEvent } from "react";

export function AdminVehicleForm() {
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Salvando…");
    const form = event.currentTarget;
    const formData = new FormData(form);
    const imageFile = formData.get("imageFile");
    formData.delete("imageFile");
    let imageUrl = String(formData.get("imageUrl") ?? "").trim();
    if (imageFile instanceof File && imageFile.size > 0) {
      setMessage("Enviando imagem…");
      const uploadData = new FormData();
      uploadData.set("file", imageFile);
      const uploadResponse = await fetch("/api/admin/uploads", { method: "POST", body: uploadData });
      if (!uploadResponse.ok) { setMessage("Não foi possível enviar a imagem."); return; }
      const upload = await uploadResponse.json() as { url: string };
      imageUrl = upload.url;
    }
    const payload = Object.fromEntries(formData.entries());
    payload.imageUrl = imageUrl;
    const response = await fetch("/api/admin/vehicles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) { setMessage("Não foi possível salvar. Verifique os campos."); return; }
    setMessage("Veículo cadastrado.");
    form.reset();
    window.location.reload();
  }
  return <form className="lead-form" onSubmit={submit}><h2>Novo veículo</h2><div className="form-row"><label>Título<input name="title" required /></label><label>Slug<input name="slug" placeholder="gerado pelo título" /></label></div><div className="form-row"><label>Marca<input name="brand" required /></label><label>Modelo<input name="model" required /></label></div><label>Versão<input name="version" /></label><div className="form-row"><label>Ano fabricação<input name="yearMake" type="number" min="1950" max="2100" required /></label><label>Ano modelo<input name="yearModel" type="number" min="1950" max="2100" required /></label></div><div className="form-row"><label>Preço (R$)<input name="price" type="number" min="0" step="0.01" required /></label><label>Quilometragem<input name="mileage" type="number" min="0" required /></label></div><div className="form-row"><label>Combustível<input name="fuel" required /></label><label>Câmbio<input name="transmission" required /></label></div><div className="form-row"><label>Carroceria<input name="bodyType" /></label><label>Status<select name="status" defaultValue="draft"><option value="draft">Rascunho</option><option value="published">Publicado</option><option value="paused">Pausado</option><option value="sold">Vendido</option></select></label></div><label>Imagem local (JPG, PNG, WebP ou AVIF; até 8 MB)<input name="imageFile" type="file" accept="image/jpeg,image/png,image/webp,image/avif" /></label><label>Ou URL da imagem<input name="imageUrl" placeholder="/api/uploads/arquivo.jpg" /></label><label>Descrição<textarea name="description" rows={4} /></label><button className="button">Cadastrar veículo</button><p aria-live="polite">{message}</p></form>;
}
