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
  }, { auto: true }]
});
const consentiBlocchiCsp = () => { consentiti = true; return blocchiCsp; };
module.exports = { ...base, test, consentiBlocchiCsp, blocchiCsp };
