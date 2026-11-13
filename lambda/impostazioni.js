'use strict';
// Impostazioni facili da cambiare.

module.exports = {
    // Voce americana usata per leggere le parole e le frasi inglesi.
    // Altre voci americane possibili: 'Joanna', 'Joey', 'Kendra', 'Salli'.
    // Metti '' (vuoto) per far leggere tutto alla voce italiana di Alexa.
    VOCE_INGLESE: 'Matthew',

    // Voce cinese. Se resta '' (vuoto) Alexa legge la "pronuncia all'italiana"
    // scritta nella lista. Puoi provare 'Zhiyu': se nel simulatore funziona, tienila.
    VOCE_CINESE: '',

    // Se true, le domande cambiano ogni giorno: un giorno "traduci", il giorno dopo
    // "usala in una frase". Se false, chiede sempre di tradurre.
    ALTERNA_TRADUCI_E_FRASE: true,
};
