export function crc16(str: string): string {
    let crc = 0xFFFF;
    for (let i = 0; i < str.length; i++) {
        let x = ((crc >> 8) ^ str.charCodeAt(i)) & 0xFF;
        x ^= x >> 4;
        crc = ((crc << 8) ^ (x << 12) ^ (x << 5) ^ x) & 0xFFFF;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function generateDynamicQris(staticQris: string, amount: number): string {
    if (!staticQris) return '';
    
    let payload = staticQris;

    // Check if CRC is at the end (usually last 4 chars after 6304).
    let base = payload;
    let idx63 = payload.lastIndexOf('6304');
    if (idx63 !== -1 && idx63 === payload.length - 8) {
        base = payload.substring(0, idx63);
    } else {
        return staticQris; // not standard QRIS or we cannot safely parse
    }

    // Change Point of Initiation Method from Static (11) to Dynamic (12)
    base = base.replace('010211', '010212');

    // Assuming static QRIS doesn't have Tag 54. We just append tag 54 before 6304.
    const amtStr = Math.floor(amount).toString();
    const lenStr = amtStr.length.toString().padStart(2, '0');
    const tag54 = `54${lenStr}${amtStr}`;

    base = base + tag54;
    base += '6304';

    const crc = crc16(base);
    return base + crc;
}
