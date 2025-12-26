/**
 * Advanced Calculation utility for Average Down/Up
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
        currentPrice,
        feeBuy = 0.0019,
        feeSell = 0.0029,
        slPercent = 3,
        tpPercent = 5
    } = params;

    const p1Val = Number(p1) || 0;
    const l1Val = Number(l1) || 0;
    const p2Val = Number(p2) || 0;
    const priceMarket = Number(currentPrice || p2Val) || 0;

    const modalAwal = p1Val * l1Val * 100;

    // 1. Current Portfolio Status
    const totalNilaiSekarang = priceMarket * l1Val * 100;
    const floatingPlIdr = totalNilaiSekarang - modalAwal;
    const floatingPlPercent = p1Val > 0 ? ((priceMarket - p1Val) / p1Val) * 100 : 0;

    let result = {
        symbol: symbol || "UNKNOWN",
        p1: p1Val,
        l1: l1Val,
        p2: p2Val,
        currentPrice: priceMarket,
        modalAwal,
        floatingPlIdr,
        floatingPlPercent,
        feeBuy,
        feeSell,
        advice: "",
        warning: false
    };

    // 2. Logic to find L2 or Pavg
    if (targetAvg && !l2Input) {
        const tAvg = Number(targetAvg);
        const pp1 = Number(p1);
        const pp2 = Number(p2);

        // Validation: Is the targetAvg physically possible?
        const minPossible = Math.min(pp1, pp2);
        const maxPossible = Math.max(pp1, pp2);

        if (tAvg < minPossible || tAvg > maxPossible) {
            result.warning = true;
            if (pp2 < pp1 && tAvg < pp2) {
                result.advice = `⚠️ Target avg <b>${tAvg.toLocaleString('id-ID')}</b> tidak mungkin tercapai karena harga beli baru Anda (P2) adalah <b>${pp2.toLocaleString('id-ID')}</b>. Rata-rata terendah yang bisa dicapai adalah mendekati ${pp2}.`;
            } else if (pp2 > pp1 && tAvg > pp2) {
                result.advice = `⚠️ Target avg <b>${tAvg.toLocaleString('id-ID')}</b> tidak mungkin tercapai karena harga beli baru Anda (P2) adalah <b>${pp2.toLocaleString('id-ID')}</b>. Rata-rata tertinggi yang bisa dicapai adalah mendekati ${pp2}.`;
            } else {
                result.advice = `⚠️ Target avg <b>${tAvg.toLocaleString('id-ID')}</b> tidak logis untuk kondisi harga saat ini.`;
            }
            result.l2 = 0;
            result.targetAvg = tAvg;
        } else {
            // Formula: X = L1 * (Pavg - P1) / (P2 - Pavg)
            const l2Match = (Number(l1) * (tAvg - pp1)) / (pp2 - tAvg);
            result.l2 = Math.ceil(l2Match);
            result.targetAvg = tAvg;

            // Re-calculate actual average based on rounded lot
            const actualTotalLot = Number(l1) + result.l2;
            const actualTotalModal = modalAwal + (pp2 * result.l2 * 100);
            const actualAvg = Math.round(actualTotalModal / (actualTotalLot * 100));

            result.advice = `✅ Untuk mencapai target avg <b>${tAvg.toLocaleString('id-ID')}</b>, Anda perlu membeli minimal <b>${result.l2} lot</b> di harga <b>${pp2.toLocaleString('id-ID')}</b>. (Rata-rata baru akan menjadi ${actualAvg.toLocaleString('id-ID')}).`;
        }
    } else {
        // Calculate Pavg from L2
        result.l2 = Number(l2Input) || 0;
        result.targetAvg = null;
    }

    // 3. Simulation Results
    const totalLot = Number(l1) + result.l2;
    const modalTambahan = Number(p2) * result.l2 * 100;
    const totalModal = modalAwal + modalTambahan;
    const avgBaru = totalLot > 0 ? Math.round(totalModal / (totalLot * 100)) : Number(p1);
    const selisihPersen = ((avgBaru - Number(p1)) / Number(p1)) * 100;

    // 4. Projections (SL/TP)
    const newSl = Math.round(avgBaru * (1 - slPercent / 100));
    const newTp = Math.round(avgBaru * (1 + tpPercent / 100));

    result.totalLot = totalLot;
    result.modalTambahan = modalTambahan;
    result.totalModal = totalModal;
    result.avgBaru = avgBaru;
    result.selisihPersen = selisihPersen;
    result.newSl = newSl;
    result.newTp = newTp;

    // 5. Profit/Loss IDR Projections
    result.slLossIdr = (newSl - avgBaru) * totalLot * 100;
    result.tpProfitIdr = (newTp - avgBaru) * totalLot * 100;

    return result;
}

function formatAvgReport(data) {
    const status = data.avgBaru < data.p1 ? "Average Down" : "Average Up";
    const arrow = data.avgBaru < data.p1 ? "📉" : "📈";
    const plSign = data.floatingPlIdr >= 0 ? "+" : "";
    const plColor = data.floatingPlIdr >= 0 ? "🟢" : "🔴";

    return `
📊 *Laporan Kalkulator Avg: ${data.symbol}*

📉 *Status Portofolio:*
• Modal Awal: ${formatIDR(data.modalAwal)}
• Harga Pasar: ${data.currentPrice.toLocaleString('id-ID')}
• **Floating P/L: ${plColor} ${plSign}${formatIDR(data.floatingPlIdr)} (${data.floatingPlPercent.toFixed(2)}%)**

🎯 *Simulasi Pembelian:*
• Harga Beli Baru: ${data.p2.toLocaleString('id-ID')}
• Jumlah Lot Baru: ${data.l2} lot
• Modal Tambahan: ${formatIDR(data.modalTambahan)}

✅ *Hasil Rerata Baru:*
• Total Lot: ${data.totalLot} lot
• Total Modal: ${formatIDR(data.totalModal)}
• **Rata-rata Baru: ${data.avgBaru.toLocaleString('id-ID')}** ${arrow} (${data.selisihPersen.toFixed(2)}% dari awal)

🛡 *Proyeksi Manajemen Risiko:*
• New Stop Loss (3%): ${data.newSl.toLocaleString('id-ID')}\n(Est: ${formatIDR(data.slLossIdr)})
• New Take Profit (5%): ${data.newTp.toLocaleString('id-ID')}\n(Est: +${formatIDR(data.tpProfitIdr)})

${data.advice ? `\n💡 *Analisa:* \n${data.advice}\n` : ''}
> *Catatan:* Perhitungan ini adalah estimasi. Selalu gunakan broker fee yang sesuai untuk akurasi maksimal.
`.trim();
}

module.exports = { calculateAvg, formatAvgReport };
