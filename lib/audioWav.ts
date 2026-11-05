// Convierte el audio grabado por el navegador (webm/ogg/mp4, según el navegador) a WAV mono de 16 kHz.
// WAV lo aceptan todos los servicios de transcripción (Groq, Gemini, OpenRouter) y 16 kHz basta para la voz.
// Si el navegador no puede decodificarlo, se devuelve null y se envía el audio original.
export async function aWav16k(blob: Blob): Promise<Blob | null> {
  try {
    const Ctx: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx || typeof OfflineAudioContext === 'undefined') return null;
    const ctx = new Ctx();
    const original = await ctx.decodeAudioData(await blob.arrayBuffer());
    ctx.close?.();
    const tasa = 16000;
    const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(original.duration * tasa)), tasa);
    const fuente = offline.createBufferSource();
    fuente.buffer = original;
    fuente.connect(offline.destination);
    fuente.start();
    const datos = (await offline.startRendering()).getChannelData(0);

    const buf = new ArrayBuffer(44 + datos.length * 2);
    const v = new DataView(buf);
    const txt = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    txt(0, 'RIFF'); v.setUint32(4, 36 + datos.length * 2, true); txt(8, 'WAVE');
    txt(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, tasa, true); v.setUint32(28, tasa * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    txt(36, 'data'); v.setUint32(40, datos.length * 2, true);
    for (let i = 0; i < datos.length; i++) { const x = Math.max(-1, Math.min(1, datos[i])); v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
    return new Blob([buf], { type: 'audio/wav' });
  } catch {
    return null;
  }
}
