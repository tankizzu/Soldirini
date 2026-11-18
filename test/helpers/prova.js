// v24csp: come @playwright/test, ma ogni prova fallisce se una pagina ha avuto anche un solo blocco CSP
// (punto C del compito CSP: "in tutte le prove esistenti, un blocco fa fallire la prova").
// Le prove che provocano blocchi apposta chiamano consentiBlocchiCsp() e controllano da sole cosa è stato bloccato.
'use strict';
const base = require('@playwright/test');
const { blocchiCsp } = require('./google-finto');
let consentiti = false;
const test = base.test.extend({
  controlloCsp: [async ({}, use) => {
    blocchiCsp.length = 0; consentiti = false;
    await use();
    if (!consentiti && blocchiCsp.length) throw new Error('Blocchi della politica di sicurezza (CSP): ' + JSON.stringify(blocchiCsp));
  }, { auto: true }],
  // 24.1: i "telefoni finti" (contesti del browser aperti con nuovoDispositivo) si chiudono alla fine di ogni prova.
  // Prima restavano aperti fino alla fine della suite, ciascuno con l'app in esecuzione: la memoria cresceva e verso
  // la fine una pagina poteva chiudersi da sola ("Target crashed"), nelle prove più pesanti (PDF e immagini).
  // Si chiudono solo quelli aperti durante la prova: quelli preparati in beforeAll per tutto il file restano.
  chiudiContesti: [async ({ browser }, use) => {
    const prima = new Set(browser.contexts());
    await use();
    await Promise.all(browser.contexts().filter(c => !prima.has(c)).map(c => c.close().catch(() => {})));
  }, { auto: true }]
});
const consentiBlocchiCsp = () => { consentiti = true; return blocchiCsp; };
module.exports = { ...base, test, consentiBlocchiCsp, blocchiCsp };
