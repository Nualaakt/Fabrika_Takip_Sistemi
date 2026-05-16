// ══════════════════════════════════════════════════════════════
//  ollama.js  –  LLM entegrasyonu
//  Birincil : Groq API (ücretsiz, ~2sn, llama-3.3-70b)
//  Yedek    : Yerel epe-fabrika modeli (offline, Ollama)
// ══════════════════════════════════════════════════════════════

const GROQ_API_KEY   = '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';
const GROQ_URL       = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL     = 'llama-3.3-70b-versatile';
const OLLAMA_URL     = 'http://localhost:11434/api/chat';
const OLLAMA_MODEL   = 'epe-fabrika';
const TIMEOUT_MS     = 30_000;
const OLLAMA_TIMEOUT = 120_000;

const SISTEM_PROMPT = `Sen EPE (Genişletilmiş Polietilen) fabrikasının üretim asistanısın.
Fabrika hakkında bilgiler:
- İki ekstrüzyon hattı: EXT-1 (JWELL makinesi) ve EXT-2 (GWELL makinesi)
- Üç vardiya: Vardiya 1 (00:00-08:00), Vardiya 2 (08:00-16:00), Vardiya 3 (16:00-24:00)
- Üretilen ürün tipleri: EPE POE ve EPE EVA
- Vardiya amirleri: A→Barış Öztürk, B→Selçuk Özmen, C→İbrahim Özen, D→İsmail Varol
- Ölçüm birimleri: m² (metrekare), kg (kilogram), fire oranı %
- Mikser: hammadde karışımı hazırlayan birim; aktif ve bekleyen stok takibi yapılır

Görevin:
- Yalnızca sana verilen "Güncel üretim verileri" ve "Prosedür" bölümlerindeki gerçek verileri kullan
- Bu verilerde olmayan bir bilgi sorulursa: "Bu veriye şu an erişemiyorum, detaylı rapor için *rapor* yaz." de
- KESİNLİKLE veri uydurma, tahmin yapma, örnek sayı verme
- Kısa ve net yanıtlar ver, WhatsApp için uygun formatta yaz
- Türkçe konuş
- Eğer sorulan konu üretimle ilgili değilse kibarca yönlendir

WhatsApp formatı: *kalın* için yıldız, _italik_ için alt çizgi kullan.`;

// Konuşma geçmişini kullanıcı başına tut (max 10 tur)
const gecmis = {};

function gecmisAl(tel) {
  if (!gecmis[tel]) gecmis[tel] = [];
  return gecmis[tel];
}

function gecmisEkle(tel, rol, icerik) {
  const g = gecmisAl(tel);
  g.push({ role: rol, content: icerik });
  if (g.length > 20) g.splice(0, 2);
}

function gecmisSifirla(tel) {
  gecmis[tel] = [];
}

async function groqSor(mesajlar) {
  const controller = new AbortController();
  const zaman = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const yanit = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model:       GROQ_MODEL,
        messages:    mesajlar,
        max_tokens:  500,
        temperature: 0.3,
      }),
      signal: controller.signal,
    });
    if (!yanit.ok) throw new Error(`Groq HTTP ${yanit.status}`);
    const veri = await yanit.json();
    return veri.choices?.[0]?.message?.content || 'Yanıt alınamadı.';
  } finally {
    clearTimeout(zaman);
  }
}

async function ollamaSor(mesajlar) {
  const controller = new AbortController();
  const zaman = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT);
  try {
    const yanit = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:    OLLAMA_MODEL,
        messages: mesajlar,
        stream:   false,
        options:  { temperature: 0.3, num_predict: 500 },
      }),
      signal: controller.signal,
    });
    if (!yanit.ok) throw new Error(`Ollama HTTP ${yanit.status}`);
    const veri = await yanit.json();
    return veri.message?.content || 'Yanıt alınamadı.';
  } finally {
    clearTimeout(zaman);
  }
}

async function llmSor(tel, soru, baglamMetni = '') {
  const mesajlar = [
    {
      role: 'system',
      content: SISTEM_PROMPT + (baglamMetni ? `\n\nGüncel üretim verileri:\n${baglamMetni}` : ''),
    },
    ...gecmisAl(tel),
    { role: 'user', content: soru },
  ];

  let cevap;
  let kaynak;

  // Önce Groq dene
  try {
    cevap  = await groqSor(mesajlar);
    kaynak = 'groq';
  } catch (err) {
    console.log(`⚠️  Groq başarısız (${err.message}), yerel model deneniyor...`);
    // Groq çalışmazsa yerel epe-fabrika modeline düş
    try {
      cevap  = await ollamaSor(mesajlar);
      kaynak = 'ollama';
    } catch (err2) {
      if (err2.name === 'AbortError') return '⏱️ Yanıt zaman aşımına uğradı. Tekrar dene.';
      return '❌ LLM bağlantısı kurulamadı. Groq ve yerel model yanıt vermiyor.';
    }
  }

  console.log(`[LLM:${kaynak}] ${tel}: ${soru.slice(0, 50)}...`);
  gecmisEkle(tel, 'user',      soru);
  gecmisEkle(tel, 'assistant', cevap);
  return cevap;
}

module.exports = { llmSor, gecmisSifirla };
