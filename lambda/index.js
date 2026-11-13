'use strict';
/*
 * Skill "Parole del mattino": ogni giorno una parola inglese e una cinese.
 *
 * Regola principale: la posizione nella lista è salvata nello storage S3 dell'hosting Alexa.
 * La coppia di parole cambia SOLO dopo che hai risposto alla domanda sulla parola inglese.
 * Se chiudi la skill senza rispondere, la volta dopo ti ripropone la stessa coppia.
 */

const Alexa = require('ask-sdk-core');
const { S3PersistenceAdapter } = require('ask-sdk-s3-persistence-adapter');
const { inglese, cinese } = require('./parole');
const IMP = require('./impostazioni');
const documentoApl = require('./apl/documento.json');

// ------------------------------------------------------------------ testo e voci

function esc(testo) {
    return String(testo || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Testo inglese letto con voce americana.
function en(testo) {
    if (!IMP.VOCE_INGLESE) return esc(testo);
    return `<voice name="${IMP.VOCE_INGLESE}">${esc(testo)}</voice>`;
}

// Parola cinese: voce cinese se impostata, altrimenti la pronuncia "all'italiana".
function zhParola(voce) {
    if (IMP.VOCE_CINESE) return `<voice name="${IMP.VOCE_CINESE}">${esc(voce.hanzi)}</voice>`;
    return esc(voce.pronuncia);
}

// Toglie il punto finale (la frase viene già chiusa da un punto nel parlato).
function frase(testo) {
    return String(testo || '').trim().replace(/[.。]+$/, '');
}

function alternative(traduzione) {
    return String(traduzione).split('/').map((t) => t.trim()).filter(Boolean);
}

function elencoTraduzioni(traduzione) {
    return alternative(traduzione).join(', oppure ');
}

// ------------------------------------------------------------------ dati del giorno

function coppia(indice) {
    return {
        en: inglese[indice % inglese.length],
        zh: cinese[indice % cinese.length],
    };
}

// Tipo di domanda: un giorno si traduce l'inglese e si fa una frase in cinese, il giorno dopo il contrario.
function modi(indice) {
    if (!IMP.ALTERNA_TRADUCI_E_FRASE) return { en: 'traduci', zh: 'traduci' };
    return indice % 2 === 0 ? { en: 'traduci', zh: 'frase' } : { en: 'frase', zh: 'traduci' };
}

function domandaInglese(voce, modo) {
    if (modo === 'frase') {
        return `Prova a usare ${en(voce.parola)} in una frase in inglese. Dilla pure ad alta voce, poi ti do un esempio.`;
    }
    return `Che cosa significa ${en(voce.parola)}?`;
}

function domandaCinese(voce, modo) {
    if (modo === 'frase') {
        return `Prova a dire una frase con ${zhParola(voce)}, anche semplice, oppure ripeti la parola ad alta voce. Poi ti do un esempio.`;
    }
    return `Che cosa significa ${zhParola(voce)}?`;
}

function soluzioneInglese(voce) {
    return `${en(voce.parola)} significa: ${esc(elencoTraduzioni(voce.traduzione))}. `
        + `<break time="300ms"/> Esempio: ${en(voce.esempio)} <break time="300ms"/> Cioè: ${esc(frase(voce.traduzioneEsempio))}.`;
}

function soluzioneCinese(voce) {
    let testo = `${zhParola(voce)} significa: ${esc(elencoTraduzioni(voce.traduzione))}. `;
    if (IMP.VOCE_CINESE) {
        testo += `<break time="300ms"/> Esempio: <voice name="${IMP.VOCE_CINESE}">${esc(voce.esempio)}</voice> <break time="300ms"/> Cioè: ${esc(frase(voce.traduzioneEsempio))}.`;
    } else {
        testo += `<break time="300ms"/> Una frase di esempio, che trovi anche sullo schermo, vuol dire: ${esc(frase(voce.traduzioneEsempio))}.`;
    }
    return testo;
}

// ------------------------------------------------------------------ correzione della risposta

const PAROLE_VUOTE = new Set([
    'il', 'lo', 'la', 'i', 'gli', 'le', 'l', 'un', 'uno', 'una', 'e',
    'significa', 'vuol', 'vuole', 'dire', 'credo', 'forse', 'penso', 'cioe',
    'risposta', 'qualcosa', 'qualcuno', 'essere',
]);

function normalizza(testo) {
    return String(testo || '')
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .split(' ')
        .filter((p) => p && !PAROLE_VUOTE.has(p))
        .join(' ');
}

function radice(parola) {
    return parola.length > 5 ? parola.slice(0, parola.length - 2) : parola;
}

function eCorretta(risposta, traduzione) {
    const r = normalizza(risposta);
    if (!r) return false;
    const paroleRisposta = r.split(' ');
    return alternative(traduzione).some((alt) => {
        const a = normalizza(alt);
        if (!a) return false;
        if (r === a || ` ${r} `.includes(` ${a} `)) return true;
        if (a.includes(r) && r.length >= 4) return true;
        // Tollera piccole differenze di desinenza (es. "felici" invece di "felice").
        const paroleAlt = a.split(' ');
        return paroleAlt.every((pa) => paroleRisposta.some((pr) => radice(pr) === radice(pa)));
    });
}

const NON_LO_SO = /\b(non (lo )?so|non (me lo )?ricordo|non ricordo|passo|boh|non ne ho idea|dimmelo|dimmi la soluzione|soluzione)\b/;

function valuta(risposta, voce, modo, nonLoSo) {
    if (nonLoSo || NON_LO_SO.test(String(risposta || '').toLowerCase())) return 'Nessun problema. ';
    if (modo === 'frase') {
        return risposta ? 'Bene, ottimo esercizio! ' : 'Ok! ';
    }
    if (!risposta) return 'Non sono sicura di aver capito bene. ';
    if (eCorretta(risposta, voce.traduzione)) return 'Esatto, ottimo! ';
    return `Hai detto: ${esc(risposta)}. Non è proprio così. `;
}

// ------------------------------------------------------------------ schermo (APL)

function aggiungiSchermo(handlerInput, sessione) {
    if (!Alexa.getSupportedInterfaces(handlerInput.requestEnvelope)['Alexa.Presentation.APL']) return;
    const { en: e, zh: z } = coppia(sessione.indice);
    const nascosto = 'rispondi ad Alexa per la soluzione';
    handlerInput.responseBuilder.addDirective({
        type: 'Alexa.Presentation.APL.RenderDocument',
        token: 'paroleDelGiorno',
        document: documentoApl,
        datasources: {
            dati: {
                titolo: `Parole n. ${sessione.indice + 1}`,
                en: {
                    parola: e.parola,
                    pronuncia: e.pronuncia,
                    traduzione: sessione.rivelatoEn ? alternative(e.traduzione).join(', ') : '?',
                    esempio: sessione.rivelatoEn ? e.esempio : '',
                    traduzioneEsempio: sessione.rivelatoEn ? e.traduzioneEsempio : nascosto,
                },
                zh: {
                    hanzi: z.hanzi,
                    pinyin: z.pinyin,
                    pronuncia: z.pronuncia,
                    traduzione: sessione.rivelatoZh ? alternative(z.traduzione).join(', ') : '?',
                    esempio: sessione.rivelatoZh ? z.esempio : '',
                    esempioPinyin: sessione.rivelatoZh ? z.esempioPinyin : '',
                    traduzioneEsempio: sessione.rivelatoZh ? z.traduzioneEsempio : nascosto,
                },
            },
        },
    });
}

// Risponde, ricordando cosa ha detto (per "ripeti") e aggiornando lo schermo.
function rispondi(handlerInput, sessione, parlato, domanda, fine) {
    sessione.ultimoParlato = parlato;
    sessione.ultimaDomanda = domanda || '';
    handlerInput.attributesManager.setSessionAttributes(sessione);
    aggiungiSchermo(handlerInput, sessione);
    const rb = handlerInput.responseBuilder.speak(parlato);
    if (fine) return rb.withShouldEndSession(true).getResponse();
    return rb.reprompt(domanda || 'Allora, cosa mi rispondi?').getResponse();
}

// ------------------------------------------------------------------ handler

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    async handle(handlerInput) {
        const am = handlerInput.attributesManager;
        const salvati = (await am.getPersistentAttributes()) || {};
        const indice = Number.isInteger(salvati.indice) ? salvati.indice : 0;
        const { en: e, zh: z } = coppia(indice);
        const modo = modi(indice);

        let intro = 'Ciao! ';
        if (salvati.presentata === indice) {
            intro += 'Riprendiamo le parole dell\'ultima volta, perché non mi avevi ancora risposto. ';
        } else {
            salvati.presentata = indice;
            am.setPersistentAttributes(salvati);
            await am.savePersistentAttributes();
        }

        const sessione = {
            indice,
            fase: 'inglese',
            modoEn: modo.en,
            modoZh: modo.zh,
            rivelatoEn: false,
            rivelatoZh: false,
        };

        const domanda = domandaInglese(e, modo.en);
        const parlato = `${intro}La parola inglese di oggi è: ${en(e.parola)}. `
            + `La parola cinese è: ${zhParola(z)}. <break time="500ms"/> `
            + `Cominciamo con l'inglese. ${domanda}`;
        return rispondi(handlerInput, sessione, parlato, domanda, false);
    },
};

// Gestisce la risposta dell'utente (anche "non lo so" e frasi che Alexa non capisce).
async function gestisciRisposta(handlerInput, risposta, nonLoSo) {
    const am = handlerInput.attributesManager;
    const sessione = am.getSessionAttributes();

    if (!sessione.fase || sessione.fase === 'fine') {
        return handlerInput.responseBuilder
            .speak('Per oggi abbiamo finito. Ci sentiamo domani con le nuove parole!')
            .withShouldEndSession(true)
            .getResponse();
    }

    const { en: e, zh: z } = coppia(sessione.indice);

    if (sessione.fase === 'inglese') {
        // Hai risposto: salvo subito il passaggio alla coppia successiva.
        const salvati = (await am.getPersistentAttributes()) || {};
        salvati.indice = sessione.indice + 1;
        salvati.completate = (salvati.completate || 0) + 1;
        salvati.ultimaRisposta = new Date().toISOString();
        am.setPersistentAttributes(salvati);
        await am.savePersistentAttributes();

        sessione.fase = 'cinese';
        sessione.rivelatoEn = true;
        const domanda = domandaCinese(z, sessione.modoZh);
        const parlato = valuta(risposta, e, sessione.modoEn, nonLoSo)
            + soluzioneInglese(e)
            + ` <break time="700ms"/> Ora il cinese. ${domanda}`;
        return rispondi(handlerInput, sessione, parlato, domanda, false);
    }

    // fase cinese
    sessione.fase = 'fine';
    sessione.rivelatoZh = true;
    const parlato = valuta(risposta, z, sessione.modoZh, nonLoSo)
        + soluzioneCinese(z)
        + ' <break time="500ms"/> Per oggi è tutto. A domani!';
    return rispondi(handlerInput, sessione, parlato, '', true);
}

const RispostaIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'RispostaIntent';
    },
    handle(handlerInput) {
        const risposta = Alexa.getSlotValue(handlerInput.requestEnvelope, 'risposta') || '';
        return gestisciRisposta(handlerInput, risposta, false);
    },
};

const NonLoSoIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'NonLoSoIntent';
    },
    handle(handlerInput) {
        return gestisciRisposta(handlerInput, '', true);
    },
};

// Se Alexa non capisce la frase (es. una frase in inglese), la considero comunque una risposta.
const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        return gestisciRisposta(handlerInput, '', false);
    },
};

const RipetiIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.RepeatIntent';
    },
    handle(handlerInput) {
        const sessione = handlerInput.attributesManager.getSessionAttributes();
        if (!sessione.ultimoParlato) return LaunchRequestHandler.handle(handlerInput);
        const fine = sessione.fase === 'fine';
        return rispondi(handlerInput, sessione, sessione.ultimoParlato, sessione.ultimaDomanda, fine);
    },
};

const StatoIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'StatoIntent';
    },
    async handle(handlerInput) {
        const salvati = (await handlerInput.attributesManager.getPersistentAttributes()) || {};
        const sessione = handlerInput.attributesManager.getSessionAttributes();
        const fatte = salvati.completate || 0;
        let parlato = `Hai completato ${fatte} ${fatte === 1 ? 'coppia' : 'coppie'} di parole. `
            + `Nella lista ci sono ${inglese.length} parole inglesi e ${cinese.length} parole cinesi. `;
        if (sessione.fase && sessione.fase !== 'fine') {
            parlato += `Torniamo a noi: ${sessione.ultimaDomanda}`;
            return handlerInput.responseBuilder.speak(parlato).reprompt(sessione.ultimaDomanda).getResponse();
        }
        return handlerInput.responseBuilder.speak(`${parlato}A domani!`).withShouldEndSession(true).getResponse();
    },
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const sessione = handlerInput.attributesManager.getSessionAttributes();
        const domanda = sessione.ultimaDomanda || 'Vuoi cominciare? Dimmi: apri parole mattutine.';
        const parlato = 'Ogni giorno ti propongo una parola inglese e una cinese. '
            + 'Rispondi alla domanda, oppure di\' "non lo so", e ti dico la soluzione. '
            + 'Finché non rispondi, le parole restano le stesse. '
            + 'Puoi anche dire "ripeti" oppure "a che punto sono". '
            + domanda;
        return handlerInput.responseBuilder.speak(parlato).reprompt(domanda).getResponse();
    },
};

const StopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && ['AMAZON.StopIntent', 'AMAZON.CancelIntent', 'AMAZON.NavigateHomeIntent']
                .includes(Alexa.getIntentName(handlerInput.requestEnvelope));
    },
    handle(handlerInput) {
        const sessione = handlerInput.attributesManager.getSessionAttributes();
        const parlato = sessione.fase === 'inglese'
            ? 'Va bene. Le parole di oggi ti aspettano per la prossima volta. Ciao!'
            : 'A domani!';
        return handlerInput.responseBuilder.speak(parlato).withShouldEndSession(true).getResponse();
    },
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log('Sessione terminata:', JSON.stringify(handlerInput.requestEnvelope.request.reason));
        return handlerInput.responseBuilder.getResponse();
    },
};

// Qualsiasi altro intent mentre aspetto una risposta: lo tratto come una risposta.
const AltroIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        return gestisciRisposta(handlerInput, '', false);
    },
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log('ERRORE:', error && error.stack ? error.stack : error);
        return handlerInput.responseBuilder
            .speak('Scusa, qualcosa è andato storto. Riprova tra poco.')
            .withShouldEndSession(true)
            .getResponse();
    },
};

exports.handler = Alexa.SkillBuilders.custom()
    .withPersistenceAdapter(new S3PersistenceAdapter({ bucketName: process.env.S3_PERSISTENCE_BUCKET }))
    .addRequestHandlers(
        LaunchRequestHandler,
        RispostaIntentHandler,
        NonLoSoIntentHandler,
        RipetiIntentHandler,
        StatoIntentHandler,
        HelpIntentHandler,
        StopIntentHandler,
        FallbackIntentHandler,
        SessionEndedRequestHandler,
        AltroIntentHandler,
    )
    .addErrorHandlers(ErrorHandler)
    .withCustomUserAgent('parole-del-mattino/1.0')
    .lambda();
