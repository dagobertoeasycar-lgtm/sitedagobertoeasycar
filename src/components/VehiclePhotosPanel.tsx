"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Ações de foto e exclusão de um veículo, na linha da tabela do painel.
 *
 * Fica fechado por padrão e só busca as fotos quando alguém abre: a tela lista
 * 30 veículos, e 30 requisições de galeria no carregamento seria desperdício.
 *
 * O que dá para fazer aqui:
 *   · baixar todas as fotos em um ZIP com o nome "<PLACA> - <Parceiro>"
 *   · subir fotos novas do computador (acrescenta à galeria e trava o veículo)
 *   · apagar uma foto ou a galeria inteira
 *   · travar, destravar e voltar às fotos da origem
 *   · excluir o veículo de vez, sem ele voltar na próxima sincronização
 */

type Foto = { type: string; url: string };

type Galeria = {
  fotos: Foto[];
  artesDaLoja: Foto[];
  fotosOriginais: Foto[];
  travada: boolean;
  situacao: string;
};

const SITUACOES: Record<string, string> = {
  ORIGEM: "fotos da origem",
  EM_TRATAMENTO: "em tratamento",
  TRATADA: "tratada",
};

export function VehiclePhotosPanel({
  id,
  titulo,
  pasta,
  fotos: totalNaLista,
}: {
  id: string;
  titulo: string;
  pasta: string;
  fotos: number;
}) {
  const [aberto, setAberto] = useState(false);
  const [galeria, setGaleria] = useState<Galeria | null>(null);
  const [ocupado, setOcupado] = useState("");
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  const arquivos = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    setErro("");
    setOcupado("lendo");
    try {
      const resposta = await fetch(`/api/admin/vehicles/${id}/photos`);
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error || `HTTP ${resposta.status}`);
      setGaleria(corpo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "não foi possível ler as fotos");
    } finally {
      setOcupado("");
    }
  }, [id]);

  function alternar() {
    const novo = !aberto;
    setAberto(novo);
    if (novo && !galeria) void carregar();
  }

  /** Toda chamada que muda a galeria passa por aqui, para o estado não divergir. */
  async function agir(rotulo: string, executar: () => Promise<Response>, mensagem: string) {
    setErro("");
    setAviso("");
    setOcupado(rotulo);
    try {
      const resposta = await executar();
      const corpo = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(corpo.error || `HTTP ${resposta.status}`);
      setAviso(mensagem);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "a ação falhou");
    } finally {
      setOcupado("");
    }
  }

  async function subir(lista: FileList | null) {
    if (!lista || !lista.length) return;
    const dados = new FormData();
    for (const arquivo of Array.from(lista)) dados.append("fotos", arquivo);
    await agir(
      "subindo",
      () => fetch(`/api/admin/vehicles/${id}/photos`, { method: "POST", body: dados }),
      `${lista.length} foto(s) enviada(s). O veículo foi travado para a sincronização não desfazer.`,
    );
    if (arquivos.current) arquivos.current.value = "";
  }

  async function excluirVeiculo() {
    const motivo = window.prompt(
      `Excluir "${titulo}" de vez?\n\n` +
        "O veículo sai do site e entra na lista de bloqueio, para não voltar na próxima sincronização.\n\n" +
        "Escreva o motivo (aparece na auditoria):",
      "",
    );
    if (motivo === null) return;
    setErro("");
    setOcupado("excluindo");
    try {
      const resposta = await fetch(`/api/admin/vehicles/${id}?motivo=${encodeURIComponent(motivo)}`, {
        method: "DELETE",
      });
      const corpo = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(corpo.error || `HTTP ${resposta.status}`);
      window.location.reload();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "não foi possível excluir");
      setOcupado("");
    }
  }

  const travada = galeria?.travada ?? false;

  return (
    <div className="veiculo-fotos">
      <div className="veiculo-fotos-botoes">
        <button type="button" className="button button-small" onClick={alternar} aria-expanded={aberto}>
          {aberto ? "Fechar fotos" : `Fotos (${totalNaLista})`}
        </button>
        <a
          className="button button-small button-outline"
          href={`/api/admin/vehicles/${id}/photos/zip`}
          title={`Baixa a pasta "${pasta}" com as fotos separadas em tratadas e não tratadas`}
        >
          Baixar pasta
        </a>
        <button
          type="button"
          className="button button-small button-perigo"
          onClick={excluirVeiculo}
          disabled={ocupado !== ""}
        >
          {ocupado === "excluindo" ? "Excluindo…" : "Excluir"}
        </button>
      </div>

      {aberto && (
        <div className="veiculo-fotos-painel">
          <p className="veiculo-fotos-pasta">
            Pasta: <code>{pasta}</code>
            {galeria && (
              <>
                {" · "}
                {SITUACOES[galeria.situacao] || galeria.situacao}
                {travada ? " · travada" : ""}
              </>
            )}
          </p>

          <div className="veiculo-fotos-botoes">
            <label className="button button-small button-outline">
              Subir novas fotos
              <input
                ref={arquivos}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                multiple
                hidden
                onChange={(evento) => void subir(evento.currentTarget.files)}
              />
            </label>
            <button
              type="button"
              className="button button-small button-outline"
              disabled={ocupado !== ""}
              onClick={() =>
                void agir(
                  "travando",
                  () =>
                    fetch(`/api/admin/vehicles/${id}/photos`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ acao: travada ? "destravar" : "travar" }),
                    }),
                  travada
                    ? "Destravado: a sincronização volta a atualizar as fotos."
                    : "Travado: a sincronização não mexe mais nas fotos.",
                )
              }
            >
              {travada ? "Destravar" : "Travar"}
            </button>
            {(galeria?.fotosOriginais.length ?? 0) > 0 && (
              <button
                type="button"
                className="button button-small button-outline"
                disabled={ocupado !== ""}
                onClick={() =>
                  void agir(
                    "restaurando",
                    () =>
                      fetch(`/api/admin/vehicles/${id}/photos`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ acao: "restaurar" }),
                      }),
                    "Fotos da origem restauradas.",
                  )
                }
              >
                Voltar às da origem
              </button>
            )}
            {(galeria?.fotos.length ?? 0) > 0 && (
              <button
                type="button"
                className="button button-small button-perigo"
                disabled={ocupado !== ""}
                onClick={() => {
                  if (!window.confirm(`Apagar TODAS as fotos de "${titulo}"?`)) return;
                  void agir(
                    "apagando",
                    () => fetch(`/api/admin/vehicles/${id}/photos?todas=1`, { method: "DELETE" }),
                    "Galeria esvaziada.",
                  );
                }}
              >
                Apagar todas
              </button>
            )}
          </div>

          {ocupado && <p className="veiculo-fotos-aviso">{ocupado}…</p>}
          {aviso && <p className="veiculo-fotos-aviso">{aviso}</p>}
          {erro && <p className="veiculo-fotos-erro">{erro}</p>}

          {galeria && (
            <>
              <ul className="veiculo-fotos-grade">
                {galeria.fotos.map((foto, indice) => (
                  <li key={foto.url}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={foto.url} alt={`Foto ${indice + 1} de ${titulo}`} loading="lazy" />
                    <button
                      type="button"
                      aria-label={`Apagar foto ${indice + 1}`}
                      disabled={ocupado !== ""}
                      onClick={() =>
                        void agir(
                          "apagando",
                          () =>
                            fetch(
                              `/api/admin/vehicles/${id}/photos?url=${encodeURIComponent(foto.url)}`,
                              { method: "DELETE" },
                            ),
                          "Foto apagada.",
                        )
                      }
                    >
                      ×
                    </button>
                    <span>{String(indice + 1).padStart(2, "0")}</span>
                  </li>
                ))}
                {!galeria.fotos.length && <li className="veiculo-fotos-vazio">Sem foto nenhuma.</li>}
              </ul>

              {galeria.artesDaLoja.length > 0 && (
                <p className="veiculo-fotos-nota">
                  {galeria.artesDaLoja.length} imagem(ns) da origem foram descartadas por serem arte da
                  loja parceira (logotipo, composição com o nome da revenda). Elas não vão para o site
                  nem para tratamento.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
