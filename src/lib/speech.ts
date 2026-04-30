// Web Speech API — darmowy STT/TTS w przeglądarce

const SR = typeof window !== "undefined"
  ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  : null;

export const sttAvailable = !!SR;
export const ttsAvailable = typeof window !== "undefined" && "speechSynthesis" in window;

export function createRecognizer(opts: {
  onResult: (text: string) => void;
  onPartial: (text: string) => void;
  onEnd: () => void;
  onError: (err: string) => void;
}) {
  if (!SR) return null;
  const rec = new SR();
  rec.lang = "pl-PL";
  rec.interimResults = true;
  rec.continuous = false;

  rec.onresult = (e: any) => {
    let final = "";
    let interim = "";
    for (let i = 0; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) final += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (final) opts.onResult(final);
    else if (interim) opts.onPartial(interim);
  };

  rec.onend = opts.onEnd;
  rec.onerror = (e: any) => opts.onError(e.error);

  return rec;
}

export function speak(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!ttsAvailable) { resolve(); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pl-PL";
    u.rate = 1.05;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

export function stopSpeaking() {
  if (ttsAvailable) window.speechSynthesis.cancel();
}
