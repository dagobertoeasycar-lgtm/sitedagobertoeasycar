"use client";

import { useState, type FormEvent } from "react";
import { uploadAdminMedia } from "@/lib/client-media-upload";

export function AdminVehicleForm() {
  const [message, setMessage] = useState("");
  const [originType, setOriginType] = useState("OWN");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Salvando…");
    const form = event.currentTarget;
    const formData = new FormData(form);
    const imageFile = formData.get("imageFile");
    formData.delete("imageFile");
    let imageUrl = String(formData.get("imageUrl") ?? "").trim();
    if (imageFile instanceof File && imageFile.size > 0) {
      try {
        imageUrl = await uploadAdminMedia(imageFile, { kind: "image" }, (percentage) => {
          setMessage(`Enviando imagem: ${percentage}%`);
        });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Não foi possível enviar a imagem.");
        return;
      }
    }
    const payload = Object.fromEntries(formData.entries());
    payload.imageUrl = imageUrl;
    const response = await fetch("/api/admin/vehicles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) { setMessage("Não foi possível salvar. Verifique os campos."); return; }
    setMessage("Veículo cadastrado.");
    form.reset();
    window.location.reload();
  }
  return <form className="lead-form admin-vehicle-form" onSubmit={submit}><h2>Novo veículo</h2><label>Origem do veículo<select name="originType" value={originType} onChange={(event) => setOriginType(event.currentTarget.value)}><option value="OWN">Estoque Autodrive</option><option value="PARTNER">Lojista parceiro</option><option value="PRIVATE">Particular intermediado</option></select></label>{originType === "PARTNER" && <div className="form-row"><label>Nome interno do parceiro<input name="partnerName" maxLength={160} placeholder="Não aparece no site público" /></label><label>Cidade do parceiro<input name="partnerCity" maxLength={100} placeholder="Ex.: Osasco/SP" /></label></div>}{originType === "PRIVATE" && <div className="form-row"><label>Nome do proprietário<input name="ownerName" maxLength={160} placeholder="Uso interno" /></label><label>WhatsApp do proprietário<input name="ownerWhatsapp" maxLength={30} inputMode="tel" placeholder="Uso interno" /></label><label>Cidade do proprietário<input name="ownerCity" maxLength={100} placeholder="Ex.: Barueri/SP" /></label></div>}<div className="form-row"><label>Título<input name="title" required /></label><label>Slug<input name="slug" placeholder="gerado pelo título" /></label></div><div className="form-row"><label>Marca<input name="brand" required /></label><label>Modelo<input name="model" required /></label></div><label>Versão<input name="version" /></label><div className="form-row"><label>Ano fabricação<input name="yearMake" type="number" min="1950" max="2100" required /></label><label>Ano modelo<input name="yearModel" type="number" min="1950" max="2100" required /></label></div><div className="form-row"><label>Preço (R$)<input name="price" type="number" min="0" step="0.01" required /></label><label>Quilometragem<input name="mileage" type="number" min="0" required /></label></div><div className="form-row"><label>Combustível<input name="fuel" required /></label><label>Câmbio<input name="transmission" required /></label></div><div className="form-row"><label>Carroceria<input name="bodyType" /></label><label>Publicação<select name="status" defaultValue="draft"><option value="draft">Rascunho</option><option value="published">Publicado</option><option value="paused">Despublicado</option><option value="sold">Vendido e removido</option></select></label></div><label>Disponibilidade<select name="stockStatus" defaultValue="available"><option value="available">Disponível</option><option value="reserved">Reservado</option><option value="sold">Vendido</option></select></label><label>Imagem local (JPG, PNG, WebP ou AVIF; até 25 MB)<input name="imageFile" type="file" accept="image/jpeg,image/png,image/webp,image/avif" /></label><label>Ou URL da imagem<input name="imageUrl" placeholder="https://..." /></label><label>Descrição<textarea name="description" rows={4} /></label><label>Observações internas<textarea name="internalNotes" rows={3} placeholder="Comissão, valor líquido, disponibilidade e condições internas" /></label><button className="button">Cadastrar veículo</button><p aria-live="polite">{message}</p></form>;
}
