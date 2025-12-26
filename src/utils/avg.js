/**
 * Calculation utility for Average Down/Up
 */

function formatIDR(num) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
}

function calculateAvg(params) {
    const {
        symbol,
        p1,
        l1,
        p2,
        targetAvg,
        l2Input,
        feeBuy = 0.0019,
        feeSell = 0.0029
    } = params;

    const modalAwal = p1 * l1 * 100;
    let result = {
        symbol,
        p1,
        l1,
        p2,
        modalAwal,
        feeBuy,
        feeSell
    };

    if (targetAvg && !l2Input) {
        // Find L2 to reach targetAvg
        // Formula: (P1*L1 + P2*X) / (L1 + X) = Pavg
        // P1*L1 + P2*X = Pavg * (L1 + X)
        // P1*L1 + P2*X = Pavg*L1 + Pavg*X
        // P2*X - Pavg*X = Pavg*L1 - P1*L1
        // X * (P2 - Pavg) = L1 * (Pavg - P1)
        // X = L1 * (Pavg - P1) / (P2 - Pavg)

        const l2 = (l1 * (targetAvg - p1)) / (p2 - targetAvg);
        result.l2 = Math.ceil(l2);
        result.targetAvg = targetAvg;
    } else {
        // Calculate Pavg from L2
        result.l2 = l2Input || 0;
    }

    const totalLot = l1 + result.l2;
    const modalTambahan = p2 * result.l2 * 100;
    const totalModal = modalAwal + modalTambahan;
    const avgBaru = Math.round(totalModal / (totalLot * 100));
    const selisihPersen = ((avgBaru - p1) / p1) * 100;

    result.totalLot = totalLot;
    result.modalTambahan = modalTambahan;
    result.totalModal = totalModal;
    result.avgBaru = avgBaru;
    result.selisihPersen = selisihPersen;

    return result;
}

function formatAvgReport(data) {
    const status = data.avgBaru < data.p1 ? "Average Down" : "Average Up";
    const arrow = data.avgBaru < data.p1 ? "📉" : "📈";

    return `
📊 *Simulasi ${status}: ${data.symbol}*

1️⃣ *Posisi Awal:*
• Harga Beli: ${data.p1.toLocaleString('id-ID')}
• Jumlah Lot: ${data.l1} lot
• Total Modal: ${formatIDR(data.modalAwal)}

2️⃣ *Rencana Pembelian:*
• Harga Baru: ${data.p2.toLocaleString('id-ID')}
${data.targetAvg ? `• Target Rata-rata: ${data.targetAvg.toLocaleString('id-ID')}\n` : ''}• **Butuh Beli: ${data.l2} lot** (${formatIDR(data.modalTambahan)})

3️⃣ *Hasil Simulasi (Dibulatkan):*
• Total Lot: ${data.totalLot} lot
• Total Modal: ${formatIDR(data.totalModal)}
• **Rata-rata Baru: ${data.avgBaru.toLocaleString('id-ID')}** ${arrow} (${data.selisihPersen.toFixed(2)}% dari awal)

> *Catatan:* Perhitungan ini adalah estimasi. Selalu pertimbangkan manajemen risiko.
`.trim();
}

module.exports = { calculateAvg, formatAvgReport };
