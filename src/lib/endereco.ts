// Escritório comercial da Autodrive. O mesmo texto deve aparecer no Perfil da
// Empresa no Google, Facebook, Instagram e WhatsApp: o Google cruza esses
// dados, e endereço escrito igual em todo lugar ajuda a ligar o site ao perfil.
export const ENDERECO = {
  logradouro: "Av. Henrique Gonçalves Baptista, 2245",
  complemento: "Torre 5, 14º andar",
  bairro: "Jardim Belval",
  cidade: "Barueri",
  estado: "SP",
  cep: "06420-130",
  linha1: "Av. Henrique Gonçalves Baptista, 2245 – Torre 5, 14º andar",
  linha2: "Jardim Belval, Barueri/SP – CEP 06420-130",
  observacao: "Escritório comercial. Atendimento presencial mediante agendamento.",
} as const;

/** Texto corrido, usado em buscas de mapa e no schema.org. */
export const ENDERECO_BUSCA = `${ENDERECO.logradouro}, ${ENDERECO.bairro}, ${ENDERECO.cidade} - ${ENDERECO.estado}, ${ENDERECO.cep}`;

const q = encodeURIComponent(ENDERECO_BUSCA);

/** Abre a ficha do lugar no Google Maps. */
export const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${q}`;
/** Já inicia a rota no Google Maps. */
export const MAPS_ROTA_URL = `https://www.google.com/maps/dir/?api=1&destination=${q}`;
/** Já inicia a navegação no Waze (navigate=yes dispensa confirmar). */
export const WAZE_URL = `https://waze.com/ul?q=${q}&navigate=yes`;
/** Mapa embutido; não precisa de chave de API. */
export const MAPS_EMBED_URL = `https://www.google.com/maps?q=${q}&output=embed`;
