'use strict';
// Rigenera skill-package/interactionModels/custom/it-IT.json partendo dalle liste di parole.
// Uso (da computer, facoltativo): node strumenti/genera-modello.js
// Le traduzioni delle liste diventano esempi per lo slot "risposta", così Alexa capisce meglio
// le risposte. Lo slot accetta comunque anche parole che non sono nell'elenco.

const fs = require('fs');
const path = require('path');
const { inglese, cinese } = require('../lambda/parole');

const valori = new Set([
    'non sono sicuro', 'una cosa che si fa ogni giorno', 'una persona molto gentile',
    'andare al lavoro la mattina', 'oggi fa molto freddo', 'mi piace studiare le lingue',
    'I like to learn new words every day', 'she is very happy today', 'we need to make a decision',
]);
[...inglese, ...cinese].forEach((voce) => {
    voce.traduzione.split('/').map((t) => t.trim().toLowerCase()).filter(Boolean)
        .forEach((t) => valori.add(t.replace(/[^\p{L}\p{N}' ]/gu, ' ').replace(/\s+/g, ' ').trim()));
});

const modello = {
    interactionModel: {
        languageModel: {
            invocationName: 'parole mattutine',
            intents: [
                { name: 'AMAZON.CancelIntent', samples: [] },
                { name: 'AMAZON.HelpIntent', samples: [] },
                { name: 'AMAZON.StopIntent', samples: [] },
                { name: 'AMAZON.NavigateHomeIntent', samples: [] },
                { name: 'AMAZON.FallbackIntent', samples: [] },
                { name: 'AMAZON.RepeatIntent', samples: [] },
                {
                    name: 'RispostaIntent',
                    slots: [{ name: 'risposta', type: 'RISPOSTA_LIBERA' }],
                    samples: [
                        '{risposta}',
                        'significa {risposta}',
                        'vuol dire {risposta}',
                        'credo {risposta}',
                        'credo che significhi {risposta}',
                        'penso {risposta}',
                        'forse {risposta}',
                        'è {risposta}',
                        'la risposta è {risposta}',
                        'si traduce {risposta}',
                        'in italiano è {risposta}',
                        'la mia frase è {risposta}',
                        'ecco la frase {risposta}',
                    ],
                },
                {
                    name: 'NonLoSoIntent',
                    slots: [],
                    samples: [
                        'non lo so', 'non so', 'non me lo ricordo', 'non ricordo', 'passo', 'boh',
                        'non ne ho idea', 'dimmi la soluzione', 'dimmelo tu', 'dimmi la risposta',
                        'non saprei', 'mi arrendo', 'salta', 'aiutami con la risposta',
                    ],
                },
                {
                    name: 'StatoIntent',
                    slots: [],
                    samples: [
                        'a che punto sono', 'quante parole ho fatto', 'come sto andando',
                        'dimmi i miei progressi', 'quante parole ci sono',
                    ],
                },
            ],
            types: [
                {
                    name: 'RISPOSTA_LIBERA',
                    values: [...valori].filter(Boolean).sort().map((v) => ({ name: { value: v } })),
                },
            ],
        },
    },
};

const destinazione = path.join(__dirname, '..', 'skill-package', 'interactionModels', 'custom', 'it-IT.json');
fs.writeFileSync(destinazione, `${JSON.stringify(modello, null, 2)}\n`);
console.log(`Scritto ${destinazione} con ${valori.size} valori per lo slot.`);
