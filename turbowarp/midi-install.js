function parseMIDI(buffer) {
  const data = new DataView(buffer);
  let pos = 0;
  const readStr = (n) => {
    let s = "";
    for (let i = 0; i < n; i++) s += String.fromCharCode(data.getUint8(pos++));
    return s;
  };
  const read32 = () => { const v = data.getUint32(pos, false); pos += 4; return v; };
  const read16 = () => { const v = data.getUint16(pos, false); pos += 2; return v; };
  const readVar = () => {
    let v = 0;
    while (true) {
      const b = data.getUint8(pos++);
      v = (v << 7) | (b & 0x7f);
      if (!(b & 0x80)) break;
    }
    return v;
  };

  // --- ヘッダー ---
  if (readStr(4) !== "MThd") throw new Error("MIDIヘッダーが不正です");
  const headerLen = read32();
  const format = read16();
  const declaredTracks = read16();
  const division = read16();

  const notes = [];
  let trackCount = 0;

  // --- MTrk が見つかる限り読む ---
  while (pos < data.byteLength) {
    const id = readStr(4);
    if (id !== "MTrk") {
      // MTrkが無くなったら終了（End of Trackなど）
      break;
    }
    trackCount++;
    const trackEnd = pos + read32();
    let time = 0;
    let runningStatus = 0;

    while (pos < trackEnd && pos < data.byteLength) {
      const delta = readVar();
      time += delta;
      let status = data.getUint8(pos++);
      if (status < 0x80) {
        pos--;
        status = runningStatus;
      } else {
        runningStatus = status;
      }

      const type = status & 0xf0;
      const ch = status & 0x0f;

      if (type === 0x90) {
        const note = data.getUint8(pos++);
        const vel = data.getUint8(pos++);
        if (vel > 0) notes.push({ time, ch, note, vel });
      } else if (type === 0x80) {
        pos += 2;
      } else if (status === 0xff) {
        const metaType = data.getUint8(pos++);
        const len = readVar();
        pos += len;
      } else if (type === 0xc0 || type === 0xd0) {
        pos++;
      } else {
        pos += 2;
      }
    }
  }

  console.log(`解析完了: 宣言トラック=${declaredTracks}, 実際=${trackCount}`);
  return notes;
}
