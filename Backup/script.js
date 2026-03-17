/**
 * LÒGICA DE TRESORERIA, CLIENTS I COMPTES DE CRÈDIT
 */

let saldoCaixa = 0;
let saldoBanc = 0;
let saldoClients = 0;

// Variables per al Compte de Crèdit
let saldoDisposatCredit = 11000; // Saldo inicial disposat segons l'enunciat
const limitCredit = 20000;

let pasActual = 0;

// Format numèric: Punts per milers i comes per decimals (ex: 1.250,50 €)
const formatEuro = (num) => {
  return (
    new Intl.NumberFormat("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num) + " €"
  );
};

const exercici = [
  // --- TRESORERIA INICIAL ---
  {
    data: "2022-06-22",
    llibre: "caixa",
    import: 1000,
    tipus: "entrada",
    concepte: "Saldo Inicial",
    text: "Saldo inicial de caixa: 1.000 €",
  },
  {
    data: "2022-06-22",
    llibre: "banc",
    import: 10450,
    tipus: "entrada",
    concepte: "Saldo Anterior",
    text: "Saldo inicial Banc del Barcelonès: 10.450 €",
  },

  // --- CLIENTS (Moda la Devesa) ---
  {
    data: "2022-10-01",
    llibre: "clients",
    import: 3000,
    tipus: "entrada",
    concepte: "Fra. núm. 422",
    text: "1 d'octubre: saldo a favor de l'empresa: 3.000 € corresponents a la fra. núm. 422.",
  },
  {
    data: "2022-10-20",
    llibre: "clients",
    import: 6000,
    tipus: "entrada",
    concepte: "Fra. núm. 444",
    text: "20 d'octubre: ven mercaderies per import de 6.000 € (fra. núm. 444).",
  },
  {
    data: "2022-10-30",
    llibre: "clients",
    import: 3000,
    tipus: "sortida",
    concepte: "Cobrament fra. 422",
    text: "30 d'octubre: cobra de la fra. núm. 422 al comptat.",
  },
  {
    data: "2022-10-30",
    llibre: "clients",
    import: 2400,
    tipus: "sortida",
    concepte: "Xec cobrament fra. 444 (40%)",
    text: "30 d'octubre: cobra el 40 % de la fra. núm. 444 mitjançant un xec.",
  },
  {
    data: "2022-11-01",
    llibre: "clients",
    import: 6200,
    tipus: "entrada",
    concepte: "Fra. núm. 466",
    text: "1 de novembre: BCN Texans, SL, ven mercaderies per 6.200 € (fra. núm. 466).",
  },
  {
    data: "2022-11-30",
    llibre: "clients",
    import: 6200,
    tipus: "sortida",
    concepte: "Lletra acceptada núm. 7",
    text: "30 de novembre: BCN Texans, SL, va acceptar la lletra núm. 7 per la fra. núm. 466.",
  },
  {
    data: "2022-12-03",
    llibre: "clients",
    import: 3600,
    tipus: "sortida",
    concepte: "Xec cobrament fra. 444 (60%)",
    text: "3 de desembre: Moda la Devesa va enviar un xec pel pendent de la fra. núm. 444.",
  },

  // --- COMPTE DE CRÈDIT ---
  {
    data: "2022-10-01",
    llibre: "credit",
    import: 11000,
    tipus: "entrada",
    concepte: "Saldo disposat inicial",
    text: "Inici de l'exercici de crèdit: Saldo disposat de 11.000 € (Límit 20.000 €)",
  },
  {
    data: "2022-10-05",
    llibre: "credit",
    import: 4000,
    tipus: "entrada",
    concepte: "Pagament nòmines",
    text: "5/10: Pagament nòmina treballadors i treballadores 4.000 €.",
  },
  {
    data: "2022-10-10",
    llibre: "credit",
    import: 5000,
    tipus: "entrada",
    concepte: "Remesa efectes a pagar",
    text: "10/10: Remesa d'efectes comercials a pagar 5.000 €.",
  },
  {
    data: "2022-10-21",
    llibre: "credit",
    import: 90,
    tipus: "sortida",
    concepte: "Rebut aigua",
    text: "21/10: Pagament rebut domiciliat d'aigua 90 €.",
  },
  {
    data: "2022-10-28",
    llibre: "credit",
    import: 98,
    tipus: "sortida",
    concepte: "Rebut llum",
    text: "28/10: Pagament rebut domiciliat de llum: 98 €.",
  },
  {
    data: "2022-10-28",
    llibre: "credit",
    import: 50,
    tipus: "sortida",
    concepte: "Rebut telèfon",
    text: "28/10: Pagament rebut domiciliat de telèfon: 50 €.",
  },
  {
    data: "2022-10-31",
    llibre: "credit",
    import: 300,
    tipus: "sortida",
    concepte: "Transferència excedit",
    text: "31/10: Ordre de transferència per treure el saldo excedit 300 €.",
  },
];

function mostrarPregunta() {
  const enunciat = document.getElementById("enunciat");
  if (pasActual < exercici.length) {
    enunciat.innerText = exercici[pasActual].text;
  } else {
    enunciat.innerHTML =
      "✅ <span class='text-emerald-600 font-bold'>Tots els exercicis s'han completat amb èxit!</span>";
  }
}

function actualitzarEnfocament() {
  const llibre = document.getElementById("select-llibre").value;
  const contenidor = document.getElementById("contenidor-llibres");
  const cards = {
    caixa: document.getElementById("card-caixa"),
    banc: document.getElementById("card-banc"),
    clients: document.getElementById("card-clients"),
    credit: document.getElementById("card-credit"),
  };

  // Reordenar visualment
  if (cards[llibre]) {
    contenidor.prepend(cards[llibre]);
    cards[llibre].classList.remove("hidden");
  }

  // Estil de selecció
  Object.values(cards).forEach((c) => {
    if (c) c.classList.remove("ring-4", "ring-indigo-200");
  });
  if (cards[llibre]) cards[llibre].classList.add("ring-4", "ring-indigo-200");
}

function validarOperacio() {
  const dataUser = document.getElementById("input-data").value;
  const llibreUser = document.getElementById("select-llibre").value;
  const tipusUser = document.getElementById("select-tipus").value;
  const importUser = parseFloat(document.getElementById("input-import").value);
  const concepteUser = document.getElementById("input-concepte").value;

  const obj = exercici[pasActual];

  if (
    llibreUser === obj.llibre &&
    importUser === obj.import &&
    tipusUser === obj.tipus
  ) {
    let saldoActual = 0;

    if (llibreUser === "caixa") {
      saldoCaixa += tipusUser === "entrada" ? importUser : -importUser;
      saldoActual = saldoCaixa;
      document.getElementById("saldo-caixa").innerText = formatEuro(saldoCaixa);
    } else if (llibreUser === "banc") {
      saldoBanc += tipusUser === "entrada" ? importUser : -importUser;
      saldoActual = saldoBanc;
      document.getElementById("saldo-banc").innerText = formatEuro(saldoBanc);
    } else if (llibreUser === "clients") {
      saldoClients += tipusUser === "entrada" ? importUser : -importUser;
      saldoActual = saldoClients;
      document.getElementById("saldo-clients").innerText =
        formatEuro(saldoClients);
    } else if (llibreUser === "credit") {
      // Nota: En crèdit, el primer registre és el saldo inicial, no s'acumula sobre ell mateix
      if (pasActual > 9) {
        // Índex on comença el crèdit després del saldo inicial de crèdit
        saldoDisposatCredit +=
          tipusUser === "entrada" ? importUser : -importUser;
      }
      saldoActual = saldoDisposatCredit;
      document.getElementById("saldo-credit").innerText =
        formatEuro(saldoDisposatCredit);
    }

    afegirFila(
      llibreUser,
      dataUser,
      concepteUser,
      importUser,
      tipusUser,
      saldoActual,
    );

    pasActual++;
    feedback("Correcte!", "bg-green-100 text-green-700");
    mostrarPregunta();
    netejarInputs();
  } else {
    feedback(
      "Error: Revisa les dades de l'operació.",
      "bg-red-100 text-red-700",
    );
  }
}

function afegirFila(llibre, data, concepte, valor, tipus, saldo) {
  const tbody = document.getElementById(`body-${llibre}`);
  const row = document.createElement("tr");
  row.className = "border-b hover:bg-slate-50 transition-colors";
  const dataF = data.split("-").reverse().join("/");

  if (llibre === "clients") {
    const deure = tipus === "entrada" ? formatEuro(valor) : "-";
    const haver = tipus === "sortida" ? formatEuro(valor) : "-";
    row.innerHTML = `
      <td class="p-4">${dataF}</td><td class="p-4">${concepte}</td>
      <td class="p-4 text-right text-indigo-600 font-medium">${deure}</td>
      <td class="p-4 text-right text-orange-600 font-medium">${haver}</td>
      <td class="p-4 text-right font-bold">${saldo >= 0 ? formatEuro(saldo) : "-"}</td>
      <td class="p-4 text-right font-bold text-red-600">${saldo < 0 ? formatEuro(Math.abs(saldo)) : "-"}</td>
    `;
  } else if (llibre === "credit") {
    const noDisposat = saldo < limitCredit ? limitCredit - saldo : 0;
    const excedit = saldo > limitCredit ? saldo - limitCredit : 0;
    const deure = tipus === "entrada" ? formatEuro(valor) : "-";
    const haver = tipus === "sortida" ? formatEuro(valor) : "-";

    row.innerHTML = `
      <td class="p-3 font-mono">${dataF}</td>
      <td class="p-3">${concepte}</td>
      <td class="p-3 text-right text-slate-500">${noDisposat > 0 ? formatEuro(noDisposat) : "-"}</td>
      <td class="p-3 text-right text-red-600 font-bold">${excedit > 0 ? formatEuro(excedit) : "-"}</td>
      <td class="p-3 text-right">${deure}</td>
      <td class="p-3 text-right">${haver}</td>
      <td class="p-3 text-right font-black bg-purple-50">${formatEuro(saldo)}</td>
    `;
  } else {
    const ent = tipus === "entrada" ? formatEuro(valor) : "-";
    const sor = tipus === "sortida" ? formatEuro(valor) : "-";
    row.innerHTML = `
      <td class="p-3 font-mono">${dataF}</td><td class="p-3">${concepte}</td>
      <td class="p-3 text-right text-emerald-600 font-medium">${ent}</td>
      <td class="p-3 text-right text-red-600 font-medium">${sor}</td>
      <td class="p-3 text-right font-bold bg-slate-50">${formatEuro(saldo)}</td>
    `;
  }
  tbody.appendChild(row);
}

function feedback(m, c) {
  const f = document.getElementById("feedback");
  f.innerText = m;
  f.className = `mt-4 p-3 rounded-lg text-center font-bold ${c}`;
  f.classList.remove("hidden");
}

function netejarInputs() {
  document.getElementById("input-concepte").value = "";
  document.getElementById("input-import").value = "";
}

// Inici
mostrarPregunta();
actualitzarEnfocament();
