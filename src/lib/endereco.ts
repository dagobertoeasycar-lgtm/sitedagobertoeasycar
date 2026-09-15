// Base pública de atendimento. Não expor endereço residencial em páginas,
// mapas ou dados estruturados.
export const ENDERECO = {
  linha1: "Barueri/SP",
  complemento: "Atendimento mediante agendamento",
  bairro: "",
  cidade: "Barueri",
  estado: "SP",
  cep: "",
} as const;

/** Texto corrido, usado em buscas de mapa e no schema.org. */
export const ENDERECO_BUSCA = `${ENDERECO.cidade} - ${ENDERECO.estado}`;

const q = encodeURIComponent(ENDERECO_BUSCA);

/** Abre a ficha do lugar no Google Maps. */
export const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${q}`;
/** Já inicia a rota no Google Maps. */
export const MAPS_ROTA_URL = `https://www.google.com/maps/dir/?api=1&destination=${q}`;
/** Já inicia a navegação no Waze (navigate=yes dispensa confirmar). */
export const WAZE_URL = `https://waze.com/ul?q=${q}&navigate=yes`;
/** Mapa embutido; não precisa de chave de API. */
export const MAPS_EMBED_URL = `https://www.google.com/maps?q=${q}&output=embed`;
