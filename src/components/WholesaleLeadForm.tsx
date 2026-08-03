"use client";

import { useState, type FormEvent } from "react";
import { formatCnpj } from "@/lib/cnpj";

type FormState = "idle" | "sending" | "done" | "error";

export function WholesaleLeadForm() {
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setMessage("");
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, kind: "wholesale" }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível enviar o cadastro.");
      form.reset();
      setState("done");
      setMessage("Cadastro enviado. Nossa equipe de atacado entrará em contato.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar agora. Tente novamente.");
    }
  }

  return (
    <form className="lead-form wholesale-form" onSubmit={submit}>
      <p className="eyebrow dark">Cadastro empresarial</p>
      <h2>Quero comprar no atacado</h2>
      <p>Preencha os dados da empresa. Todos os campos abaixo são obrigatórios.</p>
      <label>
        CNPJ
        <input
          name="cnpj"
          required
          inputMode="numeric"
          autoComplete="off"
          maxLength={18}
          placeholder="00.000.000/0000-00"
          onInput={(event) => { event.currentTarget.value = formatCnpj(event.currentTarget.value); }}
        />
      </label>
      <label>
        Razão social
        <input name="companyName" required minLength={2} maxLength={160} autoComplete="organization" />
      </label>
      <div className="form-row">
        <label>
          E-mail
          <input name="email" type="email" required maxLength={254} autoComplete="email" />
        </label>
        <label>
          Telefone
          <input name="phone" type="tel" required minLength={10} maxLength={30} inputMode="tel" autoComplete="tel" />
        </label>
      </div>
      <label className="consent">
        <input name="consent" type="checkbox" value="yes" required />
        Autorizo o contato sobre esta solicitação e li a Política de Privacidade.
      </label>
      <button className="button" type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Enviando…" : "Enviar cadastro"}
      </button>
      <p className={`form-status ${state}`} role="status" aria-live="polite">{message}</p>
    </form>
  );
}
