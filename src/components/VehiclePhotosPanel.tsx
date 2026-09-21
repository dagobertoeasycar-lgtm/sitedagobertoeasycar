"use client";

import { useCallback, useRef, useState } from "react";
import { GripVertical, Video } from "lucide-react";
import { uploadAdminMedia } from "@/lib/client-media-upload";

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
  videoUrl: string;
  defaultVideoUrl: string;
  defaultVideoEnabled: boolean;
};

const SITUACOES: Record<string, string> = {
  ORIGEM: "fotos da origem",
  EM_TRATAMENTO: "em tratamento",
  TRATADA: "tratada",
};

function redirecionarParaLogin() {
  if (typeof window !== "undefined") window.location.assign("/admin/login");
}

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
  const [arrastando, setArrastando] = useState<number | null>(null);
  const arquivos = useRef<HTMLInputElement>(null);
  const arquivoVideo = useRef<HTMLInputElement>(null);
  const linkVideoRef = useRef<HTMLInputElement>(null);

  function getYouTubeId(url: string) {
    const s = url.match(/youtu\.be\/([^?&]+)/);
    const l = url.match(/[?&]v=([^?&]+)/);
    return s ? s[1] : l ? l[1] : null;
  }

  const carregar = useCallback(async () => {
    setErro("");
    setOcupado("lendo");
    try {
      const resposta = await fetch(`/api/admin/vehicles/${id}/photos`);
      if (resposta.status === 401) {
        redirecionarParaLogin();
        return;
      }
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
      if (resposta.status === 401) {
        redirecionarParaLogin();
        return;
      }
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

  /** Envia direto ao Blob; assim a foto não atravessa o limite da função web. */
  async function subir(lista: FileList | null) {
    if (!lista || !lista.length) return;
    const arquivosSelecionados = Array.from(lista);
    setErro("");
    setAviso("");

    const falhas: string[] = [];
    const enviadas: string[] = [];

    for (let i = 0; i < arquivosSelecionados.length; i++) {
      const arquivo = arquivosSelecionados[i];
      setOcupado(`subindo ${i + 1}/${arquivosSelecionados.length}`);
      try {
        const url = await uploadAdminMedia(arquivo, { kind: "image", vehicleId: id }, (percentual) => {
          setOcupado(`subindo ${i + 1}/${arquivosSelecionados.length} · ${percentual}%`);
        });
        enviadas.push(url);
      } catch (e) {
        falhas.push(`${arquivo.name}: ${e instanceof Error ? e.message : "falhou"}`);
      }
    }

    if (arquivos.current) arquivos.current.value = "";
    if (enviadas.length) {
      setOcupado("salvando fotos");
      try {
        const resposta = await fetch(`/api/admin/vehicles/${id}/photos`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ acao: "adicionar", fotos: enviadas }),
        });
        if (resposta.status === 401) {
          redirecionarParaLogin();
          return;
        }
        const corpo = await resposta.json().catch(() => ({}));
        if (!resposta.ok) throw new Error(corpo.error || `HTTP ${resposta.status}`);
        setAviso(`${enviadas.length} foto(s) enviada(s). O veículo foi travado para preservar a galeria.`);
        await carregar();
      } catch (e) {
        falhas.push(e instanceof Error ? e.message : "não foi possível salvar as fotos no anúncio");
      }
    }
    setOcupado("");
    if (falhas.length) setErro(`Não subiram: ${falhas.join("; ")}`);
  }

  async function subirVideo(file: File | undefined) {
    if (!file) return;
    setErro("");
    setAviso("");
    try {
      setOcupado("subindo vídeo");
      const url = await uploadAdminMedia(file, { kind: "video", vehicleId: id }, (percentual) => {
        setOcupado(`subindo vídeo · ${percentual}%`);
      });
      const resposta = await fetch(`/api/admin/vehicles/${id}/photos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "definir-video", url }),
      });
      if (resposta.status === 401) {
        redirecionarParaLogin();
        return;
      }
      const corpo = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(corpo.error || `HTTP ${resposta.status}`);
      setAviso("Vídeo deste anúncio salvo.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "não foi possível subir o vídeo");
    } finally {
      if (arquivoVideo.current) arquivoVideo.current.value = "";
      setOcupado("");
    }
  }

  async function salvarLinkVideo(url: string) {
    if (!url) return;
    await agir(
      "salvando vídeo",
      () =>
        fetch(`/api/admin/vehicles/${id}/photos`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ acao: "substituir-video", url }),
        }),
      "Link do vídeo atualizado com sucesso.",
    );
  }

  async function moverFoto(origem: number, destino: number) {
    if (!galeria || origem === destino || origem < 0 || destino < 0) return;
    const anterior = galeria.fotos;
    const novaOrdem = [...anterior];
    const [movida] = novaOrdem.splice(origem, 1);
    novaOrdem.splice(destino, 0, movida);
    setArrastando(null);
    setGaleria({ ...galeria, fotos: novaOrdem, travada: true });
    setErro("");
    setAviso("");
    setOcupado("salvando ordem");
    try {
      const resposta = await fetch(`/api/admin/vehicles/${id}/photos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "reordenar", fotos: novaOrdem.map((foto) => foto.url) }),
      });
      if (resposta.status === 401) {
        redirecionarParaLogin();
        return;
      }
      const corpo = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(corpo.error || `HTTP ${resposta.status}`);
      setAviso("Ordem das fotos salva. A primeira foto virou a capa do anúncio.");
      await carregar();
    } catch (e) {
      setGaleria({ ...galeria, fotos: anterior });
      setErro(e instanceof Error ? e.message : "não foi possível salvar a ordem");
    } finally {
      setOcupado("");
    }
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
  const defaultVideoAtivo = Boolean(galeria?.defaultVideoEnabled && galeria.defaultVideoUrl);
  const videoEfetivo = galeria?.videoUrl || (defaultVideoAtivo ? galeria?.defaultVideoUrl : "") || "";

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
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexGrow: 1 }}>
              <div style={{ display: "flex", gap: "6px" }}>
                <input
                  ref={linkVideoRef}
                  type="url"
                  placeholder="🔗 Cole link do YouTube (Enter salva)"
                  className="input input-small"
                  disabled={ocupado !== ""}
                  style={{ flexGrow: 1, minWidth: "200px" }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const val = e.currentTarget.value.trim();
                      if (val) {
                        void salvarLinkVideo(val);
                        e.currentTarget.value = "";
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  className="button button-small"
                  disabled={ocupado !== ""}
                  onClick={() => {
                    const val = linkVideoRef.current?.value.trim();
                    if (val) {
                      void salvarLinkVideo(val);
                      if (linkVideoRef.current) linkVideoRef.current.value = "";
                    }
                  }}
                >
                  Salvar
                </button>
              </div>
              <label className="button button-small button-outline" style={{ fontSize: "11px", color: "#d97706", borderColor: "#fcd34d", background: "#fef3c7" }}>
                <Video size={14} aria-hidden="true" />
                ⚠️ Upload MP4 (Instável)
                <input
                  ref={arquivoVideo}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  hidden
                  onChange={(evento) => void subirVideo(evento.currentTarget.files?.[0])}
                />
              </label>
            </div>
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
              <div className="veiculo-video-admin">
                <div>
                  <strong>{galeria.videoUrl ? "Vídeo deste anúncio" : defaultVideoAtivo ? "Vídeo padrão" : "Sem vídeo ativo"}</strong>
                  <span>
                    {galeria.videoUrl
                      ? "Substitui o vídeo padrão somente neste veículo."
                      : defaultVideoAtivo
                        ? "O padrão é usado automaticamente porque não há vídeo próprio."
                        : galeria.defaultVideoUrl
                          ? "O vídeo padrão está pausado no controle geral."
                          : "Envie um vídeo próprio ou configure o padrão no topo da página."}
                  </span>
                </div>
                {videoEfetivo && (
                  (() => {
                    const ytId = getYouTubeId(videoEfetivo);
                    if (ytId) {
                      return (
                        <iframe
                          src={`https://www.youtube.com/embed/${ytId}?rel=0`}
                          title="Preview do Vídeo"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          style={{ width: "240px", aspectRatio: "16/9", borderRadius: "8px", border: 0, marginTop: "12px" }}
                        />
                      );
                    } else if (/youtu\.be\/|youtube\.com\//i.test(videoEfetivo)) {
                      return (
                        <div style={{ background: "#000", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", height: "100px", borderRadius: "8px", marginTop: "12px" }}>
                          🔗 Link do YouTube Inválido
                        </div>
                      );
                    }
                    return <video src={videoEfetivo} controls preload="metadata" playsInline />;
                  })()
                )}
                {galeria.videoUrl && (
                  <button
                    type="button"
                    className="button button-small button-outline"
                    disabled={ocupado !== ""}
                    onClick={() =>
                      void agir(
                        "alterando vídeo",
                        () =>
                          fetch(`/api/admin/vehicles/${id}/photos`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ acao: "usar-video-padrao" }),
                          }),
                        defaultVideoAtivo
                          ? "O anúncio voltou a usar o vídeo padrão."
                          : "O vídeo próprio foi removido. O anúncio está sem vídeo enquanto o padrão estiver pausado.",
                      )
                    }
                  >
                    {defaultVideoAtivo ? "Usar vídeo padrão" : "Remover vídeo próprio"}
                  </button>
                )}
              </div>

              {galeria.fotos.length > 1 && (
                <p className="veiculo-fotos-arraste"><GripVertical size={15} aria-hidden="true" /> Arraste as fotos para mudar a sequência. A foto 01 é a capa.</p>
              )}
              <ul className="veiculo-fotos-grade">
                {galeria.fotos.map((foto, indice) => (
                  <li
                    key={foto.url}
                    draggable={ocupado === ""}
                    className={arrastando === indice ? "arrastando" : ""}
                    onDragStart={() => setArrastando(indice)}
                    onDragEnd={() => setArrastando(null)}
                    onDragOver={(evento) => evento.preventDefault()}
                    onDrop={(evento) => {
                      evento.preventDefault();
                      if (arrastando !== null) void moverFoto(arrastando, indice);
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={foto.url}
                      alt={`Foto ${indice + 1} de ${titulo}`}
                      loading="lazy"
                      // O CDN de alguns parceiros recusa a imagem quando vem
                      // referenciador de outro site; sem isto a miniatura fica
                      // quebrada no painel mesmo com a foto existindo.
                      referrerPolicy="no-referrer"
                      onError={(evento) => {
                        evento.currentTarget.classList.add("quebrada");
                        evento.currentTarget.alt = `Foto ${indice + 1} não carregou`;
                      }}
                    />
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
                    <GripVertical className="veiculo-fotos-arraste-icone" size={16} aria-hidden="true" />
                    <span className="veiculo-fotos-indice">{String(indice + 1).padStart(2, "0")}</span>
                  </li>
                ))}
                {!galeria.fotos.length && (
                  <li className="veiculo-fotos-vazio">
                    {galeria.artesDaLoja.length
                      ? `Só tem arte da loja parceira (${galeria.artesDaLoja.length}). Suba fotos de verdade aqui.`
                      : "Sem foto nenhuma."}
                  </li>
                )}
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
