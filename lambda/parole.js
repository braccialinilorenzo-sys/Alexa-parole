'use strict';
// Legge le liste di parole dai file di testo nella cartella "parole".
// Formato: una parola per riga, campi separati da " | ", righe che iniziano con # ignorate.

const fs = require('fs');
const path = require('path');

function leggiFile(nomeFile, campi) {
    const testo = fs.readFileSync(path.join(__dirname, 'parole', nomeFile), 'utf8');
    const voci = [];
    testo.split(/\r?\n/).forEach((riga, n) => {
        const pulita = riga.trim();
        if (!pulita || pulita.startsWith('#')) return;
        const valori = pulita.split('|').map((v) => v.trim());
        if (valori.length < campi.length) {
            console.log(`Riga ${n + 1} di ${nomeFile} ignorata: servono ${campi.length} campi.`);
            return;
        }
        const voce = {};
        campi.forEach((campo, i) => { voce[campo] = valori[i]; });
        voci.push(voce);
    });
    if (voci.length === 0) throw new Error(`Nessuna parola valida in ${nomeFile}`);
    return voci;
}

const inglese = leggiFile('inglese.txt',
    ['parola', 'pronuncia', 'traduzione', 'esempio', 'traduzioneEsempio']);

const cinese = leggiFile('cinese.txt',
    ['hanzi', 'pinyin', 'pronuncia', 'traduzione', 'esempio', 'esempioPinyin', 'traduzioneEsempio']);

module.exports = { inglese, cinese };
