// Endereço do escritório, num lugar só: rodapé, página de contato e os
// dados estruturados do Google liam valores duplicados antes e saíram de
// sincronia na troca de marca. Mudou aqui, mudou no site inteiro.
export const ENDERECO = {
  linha1: "Av. Henrique Gonçalves Baptista, 2245",
  complemento: "Torre 5, apto 145",
  bairro: "Jardim Belval",   // grafia oficial dos Correios para o CEP 06420-130
  cidade: "Barueri",
  estado: "SP",
  cep: "06420-130",
} as const;

/** Texto corrido, usado em buscas de mapa e no schema.org. */
export const ENDERECO_BUSCA =
  `${ENDERECO.linha1}, ${ENDERECO.bairro}, ${ENDERECO.cidade} - ${ENDERECO.estado}, ${ENDERECO.cep}`;

const q = encodeURIComponent(ENDERECO_BUSCA);

/** Abre a ficha do lugar no Google Maps. */
export const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${q}`;
/** Já inicia a rota no Google Maps. */
export const MAPS_ROTA_URL = `https://www.google.com/maps/dir/?api=1&destination=${q}`;
/** Já inicia a navegação no Waze (navigate=yes dispensa confirmar). */
export const WAZE_URL = `https://waze.com/ul?q=${q}&navigate=yes`;
/** Mapa embutido; não precisa de chave de API. */
export const MAPS_EMBED_URL = `https://www.google.com/maps?q=${q}&output=embed`;
