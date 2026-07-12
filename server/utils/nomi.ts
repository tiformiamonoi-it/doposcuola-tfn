// Uniforma un nome scritto tutto minuscolo o tutto MAIUSCOLO in "Nome Proprio"
// ("MARIO ROSSI" / "mario rossi" → "Mario Rossi"), mettendo la maiuscola anche
// dopo apostrofo e trattino (D'Angelo, Anna-Maria) e normalizzando gli spazi doppi.
// Nomi con maiuscole miste (MariaSole) e sigle fino a 3 lettere (TFN) si considerano
// voluti e NON vengono toccati.
export function nomeProprio(nome: string): string {
  const pulito = nome.trim().replace(/\s+/g, ' ')
  const soloLettere = pulito.replace(/[^\p{L}]/gu, '')
  const tuttoMinuscolo = soloLettere === soloLettere.toLowerCase()
  const tuttoMaiuscolo = soloLettere === soloLettere.toUpperCase()
  if (tuttoMaiuscolo && soloLettere.length <= 3) return pulito // sigla (es. TFN)
  if (!tuttoMinuscolo && !tuttoMaiuscolo) return pulito        // maiuscole miste: già volute
  return pulito.toLowerCase().replace(/(^|[\s'’-])\p{L}/gu, (m) => m.toUpperCase())
}
