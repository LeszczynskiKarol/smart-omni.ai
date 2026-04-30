const SR = typeof window !== "undefined"
  ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  : null;

export const sttAvailable = !!SR;
export const ttsAvailable = typeof window !== "undefined" && "speechSynthesis" in window;

function cleanForTTS(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")   // **bold** → bold
    .replace(/\*(.+?)\*/g, "$1")        // *italic* → italic
    .replace(/#{1,6}\s/g, "")           // ### heading → heading
    .replace(/\[(\d+)\]/g, "")          // [1] [2] → usunięte
    .replace(/\s{2,}/g, " ")
    .trim();
}

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
    const u = new SpeechSynthesisUtterance(cleanForTTS(text));
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
