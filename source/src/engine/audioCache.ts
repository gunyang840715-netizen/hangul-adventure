// 압축 녹음 원본은 그대로 두고, 다시 만들 수 있는 PCM 버퍼만 최근 사용 순서로 보관.
export class AudioBufferCache {
  private entries = new Map<string, AudioBuffer>();
  private bytes = 0;
  constructor(private maxBytes = 24 * 1024 * 1024, private maxEntries = 64) {}
  get(key: string) {
    const b = this.entries.get(key);
    if (b) { this.entries.delete(key); this.entries.set(key, b); }
    return b;
  }
  set(key: string, b: AudioBuffer) {
    const size = (v: AudioBuffer) => v.length * v.numberOfChannels * 4;
    const old = this.entries.get(key);
    if (old) { this.bytes -= size(old); this.entries.delete(key); }
    if (size(b) > this.maxBytes) return;
    this.entries.set(key, b); this.bytes += size(b);
    while (this.bytes > this.maxBytes || this.entries.size > this.maxEntries) {
      const k = this.entries.keys().next().value!;
      this.bytes -= size(this.entries.get(k)!); this.entries.delete(k);
    }
  }
}
