/**
 * SIMULADOR TRESORERIA AVANÇAT
 * Adaptat a l'estructura: llibre 1, nº Cli/Prov 1, dataoperació 1, etc.
 */

let estat = {
  modoActual: "auth",
  usuari: null,
  dadesGlobals: null,
  saldoCaixa: 0,
  saldoBanc: 0,
  saldoClients: 0,
  saldoProveidors: 0,
  saldosAuxiliars: {},
};

let exerciciActual = null;
let pasActual = 0;
let ultimaDataInformada = "";

const SHEET_URL =
  "https://script.google.com/macros/s/AKfycbxPOxnP6BF6W0fI-Iyas50GlC7MEvU5d1SMxxbRu-i-c9qWcPqzQsTlTMQnB2IhLmDIiQ/exec";

window.onload = () => {
  actualitzarInterficie();
  carregarDades();
};

async function carregarDades() {
  try {
    const resposta = await fetch(SHEET_URL, { redirect: "follow" });
    const json = await resposta.json();
    estat.dadesGlobals = json;
    generarMenuExercicis();
    console.log("Dades sincronitzades");
  } catch (e) {
    console.error("Error carregant dades:", e);
  }
}

function formatarDataEuropea(dataBruta) {
  if (!dataBruta) return "---";

  // Si la data ja té el format DD/MM/AAAA (conté barres i no la T de ISO)
  if (
    typeof dataBruta === "string" &&
    dataBruta.includes("/") &&
    !dataBruta.includes("T")
  ) {
    return dataBruta;
  }

  const d = new Date(dataBruta);
  if (isNaN(d.getTime())) return dataBruta;

  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const any = d.getFullYear();

  return `${dia}/${mes}/${any}`;
}

// --- GESTIÓ D'ACCÉS ---
async function intentarLogin() {
  const nomInput = document.getElementById("login-usuari").value.trim();
  const passInput = document.getElementById("login-pass").value;

  if (!estat.dadesGlobals) return alert("Encara carregant dades...");

  const user = estat.dadesGlobals.usuaris.find(
    (u) =>
      u.Nom.toString() === nomInput && u.Contrasenya.toString() === passInput,
  );

  if (user) {
    estat.usuari = user;
    estat.modoActual = "app";
    actualitzarInterficie();
    document.getElementById("nom-usuari-display").innerText = user.Nom;
    document.getElementById("punts-total").innerText = user.PuntsTotals || 0;
  } else {
    alert("Usuari o contrasenya incorrectes");
  }
}

// --- GESTIÓ D'ACCÉS I INTERFÍCIE ---

function canviarTab(tipus) {
  const forms = {
    entrar: document.getElementById("form-login"),
    registrar: document.getElementById("form-registrar"),
    recuperar: document.getElementById("form-recuperar"),
  };

  const tabs = {
    entrar: document.getElementById("tab-entrar"),
    registrar: document.getElementById("tab-registrar"),
  };

  // 1. Amagar tots els formularis
  Object.values(forms).forEach((f) => f?.classList.add("hidden"));

  // 2. Mostrar el seleccionat
  if (forms[tipus]) forms[tipus].classList.remove("hidden");

  // 3. Gestionar estils de les pestanyes (només si no estem en recuperar)
  if (tipus !== "recuperar") {
    Object.keys(tabs).forEach((key) => {
      if (key === tipus) {
        tabs[key].classList.add("border-orange-400", "text-orange-600");
        tabs[key].classList.remove("border-transparent", "text-slate-400");
      } else {
        tabs[key].classList.remove("border-orange-400", "text-orange-600");
        tabs[key].classList.add("border-transparent", "text-slate-400");
      }
    });
  } else {
    // Si estem recuperant, posem les dues pestanyes en gris
    Object.values(tabs).forEach((t) => {
      t.classList.remove("border-orange-400", "text-orange-600");
      t.classList.add("border-transparent", "text-slate-400");
    });
  }
}

function mostrarRecuperacio() {
  canviarTab("recuperar");
}

function verificarUsuariRecuperacio() {
  const nom = document
    .getElementById("recup-usuari")
    .value.trim()
    .toLowerCase();

  if (!nom) {
    mostrarFeedback("Escriu el teu usuari", "error");
    return;
  }

  // Busquem si l'usuari existeix a les dades globals
  const usuari = estat.dadesGlobals.usuaris.find(
    (u) => u.Nom.toLowerCase() === nom,
  );

  if (usuari) {
    // En lloc de mostrar la paraula, simplement passem al següent input
    document.getElementById("pas-1-recuperacio").classList.add("hidden");
    document.getElementById("pas-2-recuperacio").classList.remove("hidden");
    mostrarFeedback("Usuari trobat. Verifica la teva identitat.", "info");
  } else {
    mostrarFeedback("Aquest usuari no existeix", "error");
  }
}

function validarRespostaRecuperacio() {
  const nom = document
    .getElementById("recup-usuari")
    .value.trim()
    .toLowerCase();
  const respostaIntroduida = document
    .getElementById("recup-resposta")
    .value.trim()
    .toLowerCase();

  const usuari = estat.dadesGlobals.usuaris.find(
    (u) => u.Nom.toLowerCase() === nom,
  );

  // Comparem el que ha escrit l'alumne amb el que hi ha a l'Excel (ParaulaClau)
  if (
    usuari &&
    respostaIntroduida === usuari.ParaulaClau.toString().toLowerCase()
  ) {
    mostrarFeedback(`LA TEVA CLAU ÉS: ${usuari.Contrasenya}`, "success");

    // Opcional: Podem posar la contrasenya directament a l'input de login per facilitar la feina
    document.getElementById("login-usuari").value = usuari.Nom;
    document.getElementById("login-pass").value = usuari.Contrasenya;

    setTimeout(() => canviarTab("entrar"), 4000);
  } else {
    mostrarFeedback("La paraula secreta no és correcta", "error");
  }
}

function mostrarFeedback(missatge, tipus = "info") {
  const f = document.getElementById("feedback");
  if (!f) return;
  f.innerText = missatge;
  f.className = `fixed bottom-10 right-10 p-4 rounded-2xl shadow-2xl transition-all z-[200] font-bold text-white ${
    tipus === "error"
      ? "bg-red-500"
      : tipus === "success"
        ? "bg-emerald-500"
        : "bg-blue-500"
  }`;
  f.classList.remove("translate-y-32");
  setTimeout(() => f.classList.add("translate-y-32"), 4000);
}

async function executarRegistre() {
  const nom = document.getElementById("reg-usuari").value.trim();
  const pass = document.getElementById("reg-pass").value;
  const grup = document.getElementById("reg-grup").value;
  const paraula = document.getElementById("reg-paraula").value.trim();

  // Validació bàsica abans d'enviar
  if (!nom || !pass || !paraula) {
    mostrarFeedback(
      "S'han d'omplir tots els camps, inclosa la paraula de seguretat.",
      "error",
    );
    return;
  }

  mostrarFeedback("Creant compte...", "info");

  try {
    const resposta = await fetch(SHEET_URL, {
      method: "POST",
      redirect: "follow",
      body: JSON.stringify({
        accio: "registrarUsuari",
        nom: nom,
        pass: pass,
        paraula: paraula,
        grup: grup,
      }),
    });

    const resultat = await resposta.text();

    if (resultat.includes("registrat")) {
      mostrarFeedback("Compte creat correctament! Ja pots entrar.", "success");
      canviarTab("entrar"); // Et mou automàticament al login
    } else {
      mostrarFeedback(resultat, "error");
    }
  } catch (error) {
    console.error("Error en el registre:", error);
    mostrarFeedback("Error de connexió amb el servidor.", "error");
  }
}

// --- Torna al inici APP
function tornarIniciApp() {
  // 1. Amaguem la zona de l'exercici (això farà desaparèixer les taules de sota)
  const zona = document.getElementById("zona-exercici");
  if (zona) zona.classList.add("hidden");

  // 2. Mostrem el Dashboard de benvinguda
  const welcome = document.getElementById("benvinguda-app");
  if (welcome) welcome.classList.remove("hidden");

  // 3. Resetejem el títol del header
  const titolHeader = document.getElementById("titol-operacio-text");
  if (titolHeader) titolHeader.innerText = "Selecciona un exercici";

  const indicador = document.getElementById("indicador-tasques");
  if (indicador) indicador.innerText = "Tasca 0/0";

  // 4. Reset d'estat intern
  exerciciActual = null;
  pasActual = 0;

  // Actualitzem els punts al dashboard de benvinguda per si han canviat
  actualitzarSaldosVisuals();
}

// --- Actualitzar Saldos
function actualitzarSaldosVisuals() {
  const c = estat.saldoCaixa.toFixed(2) + " €";
  const b = estat.saldoBanc.toFixed(2) + " €";

  // Saldos a la vista de taules
  document.getElementById("saldo-caixa").innerText = c;
  document.getElementById("saldo-banc").innerText = b;

  // Saldos a la vista de benvinguda (Dashboard SAP)
  const scw = document.getElementById("saldo-caixa-welcome");
  const sbw = document.getElementById("saldo-banc-welcome");
  if (scw) scw.innerText = c;
  if (sbw) sbw.innerText = b;
}
// --- DINÀMICA DE L'EXERCICI ---
// --- GESTIÓ DEL MENÚ I NAVEGACIÓ ---

function toggleMenu() {
  const menu = document.getElementById("menu-lateral");
  const arrow = document.getElementById("arrow-menu");
  const content = document.getElementById("menu-content");
  const main = document.getElementById("contingut-principal");

  if (menu.classList.contains("w-80")) {
    // TANCAR
    menu.classList.remove("w-80");
    menu.classList.add("w-0");
    content.classList.add("opacity-0", "pointer-events-none");
    arrow.style.transform = "rotate(180deg)";
  } else {
    // OBRIR
    menu.classList.remove("w-0");
    menu.classList.add("w-80");
    content.classList.remove("opacity-0", "pointer-events-none");
    arrow.style.transform = "rotate(0deg)";
  }
}

function seleccionarExercici(nom) {
  // 1. Assignació de dades reals del JSON
  if (!estat.dadesGlobals || !estat.dadesGlobals[nom]) {
    console.error("No s'han trobat dades per a l'exercici:", nom);
    return;
  }

  // Guardem l'array d'operacions i reiniciem el comptador
  exerciciActual = estat.dadesGlobals[nom];
  pasActual = 0;

  // 2. GESTIÓ DE VISTES (Interfície tipus SAP)
  // Amaguem la benvinguda i mostrem la zona de treball
  const welcome = document.getElementById("benvinguda-app");
  if (welcome) welcome.classList.add("hidden");

  const zonaTreball = document.getElementById("zona-exercici");
  if (zonaTreball) zonaTreball.classList.remove("hidden");

  // Assegurem que la card de la pregunta sigui visible
  const card = document.getElementById("card-pregunta");
  if (card) card.classList.remove("hidden");

  // 3. NETEJA DE TAULES (Perquè no s'acumulin dades d'exercicis anteriors)
  const cossosTaula = [
    "body-caixa",
    "body-banc",
    "body-clients",
    "body-proveidors",
  ];
  cossosTaula.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });

  // 4. REINICI DE SALDOS (Opcional, si vols que cada exercici comenci de 0)
  estat.saldoCaixa = 0;
  estat.saldoBanc = 0;
  estat.saldosAuxiliars = {};

  // 5. CARREGAR LA PRIMERA OPERACIÓ
  // Nota: Al teu script.js la funció que pinta la pregunta es diu mostrarPregunta()
  mostrarPregunta();
  actualitzarSaldosVisuals();

  // 6. UX: Mòbils i Scroll
  if (window.innerWidth < 768 && typeof toggleMenu === "function") {
    toggleMenu();
  }

  // Fem scroll cap amunt per començar des de la part superior
  const scrollContainer = document.querySelector(".custom-scroll");
  if (scrollContainer) scrollContainer.scrollTop = 0;
}

function generarMenuExercicis() {
  const menu = document.getElementById("menu-exercicis");
  if (!estat.dadesGlobals || !menu) return;

  const llistaExercicis = [
    ...new Set(estat.dadesGlobals.operacions.map((op) => op.exercici)),
  ];
  menu.innerHTML = "";

  llistaExercicis.forEach((nomEx) => {
    const opsDeLExercici = estat.dadesGlobals.operacions.filter(
      (o) => o.exercici === nomEx,
    );

    // Contenidor del grup (Exercici)
    const grup = document.createElement("div");
    grup.className = "mb-4";

    // Botó del títol de l'exercici (per desplegar/plegar)
    const btnEx = document.createElement("button");
    const safeId = nomEx.replace(/\s+/g, ""); // ID sense espais per als selectors
    btnEx.className =
      "w-full flex items-center justify-between p-3 rounded-xl bg-slate-800/30 text-white font-bold text-sm hover:bg-slate-800 transition-all";
    btnEx.innerHTML = `
      <span class="flex items-center gap-2">📂 ${nomEx}</span>
      <svg class="w-4 h-4 transform transition-transform" id="arrow-${safeId}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"></path></svg>
    `;

    // Contenidor de la llista d'operacions (ocult per defecte)
    const llistaOps = document.createElement("div");
    llistaOps.id = `list-${safeId}`;
    llistaOps.className =
      "hidden pl-4 mt-2 space-y-1 border-l-2 border-slate-800 ml-2";

    // Creació de cada sub-botó (Operació específica)
    opsDeLExercici.forEach((op, index) => {
      const btnOp = document.createElement("button");
      btnOp.className =
        "w-full text-left p-2 rounded-lg text-[11px] text-slate-500 hover:text-orange-400 hover:bg-slate-800/50 transition-all truncate flex items-center gap-2";

      // Afegim el número de pas i el Text Breu
      btnOp.innerHTML = `<span class="opacity-40 w-4">${index + 1}.</span> <span class="truncate">${op["Text Breu"] || "Operació " + (index + 1)}</span>`;

      // ACCIÓ DE SALT: Al fer clic, carregar exercici i anar al pas concret
      btnOp.onclick = () => {
        // 1. Carreguem l'exercici (neteja saldos i taules)
        iniciarExercici(nomEx);

        // 2. Saltem al pas seleccionat
        pasActual = index;

        // 3. Actualitzem la interfície amb la pregunta del pas escollit
        mostrarPregunta();
        netejarInputs();

        // 4. Si la pantalla és petita, tanquem el menú lateral
        if (window.innerWidth < 768) toggleMenu();

        mostrarFeedback(
          `Saltat a: ${op["Text Breu"]}`,
          "bg-blue-600 text-white",
        );
      };

      llistaOps.appendChild(btnOp);
    });

    // Lògica per obrir/tancar el desplegable de l'exercici
    btnEx.onclick = () => {
      const isHidden = llistaOps.classList.contains("hidden");
      llistaOps.classList.toggle("hidden");
      document.getElementById(`arrow-${safeId}`).style.transform = isHidden
        ? "rotate(180deg)"
        : "rotate(0deg)";
    };

    grup.appendChild(btnEx);
    grup.appendChild(llistaOps);
    menu.appendChild(grup);
  });
}

function tancarSessio() {
  if (confirm("Segur que vols sortir? El progrés no guardat es perdrà.")) {
    estat.modoActual = "auth";
    estat.usuari = null;
    location.reload(); // Manera ràpida de resetear tota l'app
  }
}

function iniciarExercici(nomEx) {
  const welcome = document.getElementById("benvinguda-app");
  const zona = document.getElementById("zona-exercici");

  if (welcome) welcome.classList.add("hidden");
  if (zona) zona.classList.remove("hidden");

  // 1. Filtrem les operacions de l'exercici triat
  exerciciActual = estat.dadesGlobals.operacions.filter(
    (op) => op.exercici === nomEx,
  );
  pasActual = 0;
  resetSaldos();

  // 2. NETEJA DE TAULES (Evitem l'error de 'null')
  const llistatLlibres = ["caixa", "banc", "clients", "proveidors"];
  llistatLlibres.forEach((id) => {
    const el = document.getElementById(`body-${id}`);
    if (el) el.innerHTML = ""; // Només netegem si l'element existeix
  });

  // 4. ACTUALITZACIÓ DE TITOLS I PREGUNTA
  const titolHeader = document.getElementById("titol-operacio-text");
  if (titolHeader) titolHeader.innerText = nomEx;

  mostrarPregunta();

  // Fem scroll al principi de la zona de treball
  const scrollContainer = document.querySelector(".custom-scroll");
  if (scrollContainer) scrollContainer.scrollTop = 0;
}

// MOSTRAR PREGUNTA -----------------------------
// MOSTRAR PREGUNTA (Actualitzat amb colors i terminologia comptable) -----------------------------
function mostrarPregunta() {
  // Verifiquem que tinguem dades per treballar
  if (!exerciciActual || !exerciciActual[pasActual]) return;

  const op = exerciciActual[pasActual];

  // 1. TEXT DE L'OPERACIÓ I PROGRÉS
  document.getElementById("text-pregunta").innerText =
    op["Text Descripció Operació"] || "Sense descripció";
  document.getElementById("pas-indicador").innerText =
    `PAS ${pasActual + 1} / ${exerciciActual.length}`;

  // 2. GESTIÓ DE DATES AMB MEMÒRIA
  if (ultimaDataInformada === "") {
    const avui = new Date();
    ultimaDataInformada = `${String(avui.getDate()).padStart(2, "0")}/${String(avui.getMonth() + 1).padStart(2, "0")}/${avui.getFullYear()}`;
  }

  document.getElementById("input-data-doc").value = ultimaDataInformada;
  document.getElementById("input-data-valor").value = ultimaDataInformada;

  // 3. NETEJA TOTAL DE CAMPS
  const campsANetejar = [
    "input-n-aux",
    "input-nom-aux",
    "input-concepte",
    "input-import",
  ];
  campsANetejar.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = "";
      el.classList.remove("border-rose-500", "bg-rose-50", "border-orange-300");
    }
  });
  document.getElementById("input-efecte").value = "-";

  // 4. LÒGICA DE REORDENACIÓ, OBLIGATORIETAT I TEXTOS DINÀMICS
  const selectorLlibre = document.getElementById("input-llibre");
  const selectorTipus = document.getElementById("input-tipus");
  const labelNAux = document.querySelector("label[for='input-n-aux']");
  const inputNAux = document.getElementById("input-n-aux");

  const actualitzarRequisits = () => {
    const llibre = selectorLlibre.value;

    // --- A. TEXTOS DINÀMICS AL DESPLEGABLE (Deure / Haver) ---
    const optEntrada = selectorTipus.querySelector('option[value="entrada"]');
    const optSortida = selectorTipus.querySelector('option[value="sortida"]');

    if (llibre === "caixa") {
      optEntrada.innerText = "Entrada (Cobrament)";
      optSortida.innerText = "Sortida (Pagament)";
    } else {
      // Per a Bancs, Clients i Proveïdors usem Deure i Haver
      optEntrada.innerText = "Deure (Entrada / Augment Actiu)";
      optSortida.innerText = "Haver (Sortida / Augment Passiu)";
    }

    // --- B. REORDENACIÓ VISUAL ---
    const contenidorPare = document.getElementById("taules-operacions");
    const cardLlibre = document.getElementById(`card-${llibre}`);

    if (contenidorPare && cardLlibre) {
      contenidorPare.prepend(cardLlibre);
      cardLlibre.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    // --- C. LÒGICA DE CAMPS OBLIGATORIS ---
    if (llibre === "clients" || llibre === "proveidors") {
      if (labelNAux)
        labelNAux.innerHTML = `Nº Client/Prov <span class="text-rose-600 font-bold">*</span>`;
      inputNAux.placeholder = "DADA OBLIGATÒRIA";
      inputNAux.classList.add("border-orange-300");
    } else {
      if (labelNAux) labelNAux.innerHTML = "Nº Client/Prov";
      inputNAux.placeholder = "Opcional";
      inputNAux.classList.remove(
        "border-orange-300",
        "border-rose-500",
        "bg-rose-50",
      );
    }

    if (typeof gestionarCampsAuxiliars === "function")
      gestionarCampsAuxiliars();
  };

  // Netejar error quan s'escriu
  inputNAux.oninput = () => {
    inputNAux.classList.remove("border-rose-500", "bg-rose-50");
  };

  selectorLlibre.onchange = actualitzarRequisits;
  actualitzarRequisits();

  document.getElementById("card-pregunta").classList.remove("hidden");
}

function gestionarCampsAuxiliars() {
  const llibreTria = document.getElementById("input-llibre").value;
  // Comprovem si el llibre seleccionat és un auxiliar
  const esAuxiliar = llibreTria === "clients" || llibreTria === "proveidors";

  const campN = document.getElementById("input-n-aux");
  const campNom = document.getElementById("input-nom-aux");
  const campEfecte = document.getElementById("input-efecte");

  if (esAuxiliar) {
    // ACTIVAR: L'usuari ha triat Clients o Proveïdors
    [campN, campNom, campEfecte].forEach((el) => {
      if (el) {
        el.removeAttribute("readonly");
        el.removeAttribute("disabled");
        el.classList.remove("bg-slate-50", "text-slate-400");
        el.classList.add("bg-white", "border-blue-200");
      }
    });
  } else {
    // BLOQUEJAR: L'usuari ha tornat a Caixa o Banc
    [campN, campNom, campEfecte].forEach((el) => {
      if (el) {
        el.setAttribute("readonly", true);
        el.setAttribute("disabled", true);
        el.classList.add("bg-slate-50", "text-slate-400");
        el.classList.remove("bg-white", "border-blue-200");

        // Netejem el contingut perquè no quedi brossa d'una selecció anterior
        if (el.tagName === "SELECT") {
          el.value = "-";
        } else {
          el.value = "";
        }
      }
    });
  }
}

function netejarInputs() {
  const ids = [
    "input-import",
    "input-ref",
    "input-concepte",
    "input-efecte",
    "input-n-aux",
    "input-nom-aux",
  ];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      if (id === "input-efecte") el.value = "-";
      else el.value = "";
    }
  });
}
// --- Moure el llibre  ---

function moureLlibreAlDamunt(idLlibre) {
  // L'ID ha de ser el del contenidor de la taula (ex: "container-caixa")
  // Suposem que cada llibre està dins d'un div amb un ID específic
  const contenidorPare = document.getElementById("llistes-llibres"); // El pare de totes les taules
  const llibreSeleccionat = document.getElementById(`card-${idLlibre}`);

  if (contenidorPare && llibreSeleccionat) {
    // Moure al principi del pare
    contenidorPare.prepend(llibreSeleccionat);

    // Afegim un efecte visual per ressaltar que s'ha mogut
    llibreSeleccionat.classList.add("ring-2", "ring-blue-500", "ring-offset-2");
    setTimeout(() => {
      llibreSeleccionat.classList.remove(
        "ring-2",
        "ring-blue-500",
        "ring-offset-2",
      );
    }, 2000);
  }
}

// --- VALIDACIÓ I REGISTRE ---
function validarPas() {
  if (!exerciciActual || !exerciciActual[pasActual]) return;

  const op = exerciciActual[pasActual];

  // 1. CAPTURA DE DADES DELS INPUTS
  const inputLlibre = document.getElementById("input-llibre");
  const inputImport = document.getElementById("input-import");
  const inputNAux = document.getElementById("input-n-aux");
  const inputDataDoc = document.getElementById("input-data-doc");
  const inputDataValor = document.getElementById("input-data-valor");

  const userLlibre = inputLlibre.value;
  const userImport = parseFloat(inputImport.value);
  const userTipus = document.getElementById("input-tipus").value;
  const userNAux = inputNAux.value.trim();
  const userNomAux =
    document.getElementById("input-nom-aux").value.trim() || "---"; // Evita undefined
  const userEfecte = document.getElementById("input-efecte").value;
  const userDataDoc = inputDataDoc.value.trim();
  const userDataValor = inputDataValor.value.trim();
  const userConcepte = document.getElementById("input-concepte").value.trim();

  // 2. VALIDACIONS D'OBLIGATORIETAT
  // Netegem estils d'error previs
  [inputDataDoc, inputDataValor, inputNAux, inputImport].forEach((el) =>
    el.classList.remove("border-rose-500", "bg-rose-50", "animate-pulse"),
  );

  if (userDataDoc === "" || userDataValor === "") {
    const camp = userDataDoc === "" ? inputDataDoc : inputDataValor;
    camp.classList.add("border-rose-500", "bg-rose-50", "animate-pulse");
    mostrarFeedback("Error: Les dates són obligatòries.", "error");
    return;
  }

  if (
    (userLlibre === "clients" || userLlibre === "proveidors") &&
    userNAux === ""
  ) {
    inputNAux.classList.add("border-rose-500", "bg-rose-50", "animate-pulse");
    mostrarFeedback("Error: El Nº de Client/Prov és obligatori.", "error");
    return;
  }

  if (isNaN(userImport) || userImport <= 0) {
    inputImport.classList.add("border-rose-500", "bg-rose-50", "animate-pulse");
    mostrarFeedback("Error: Introdueix un import vàlid.", "error");
    return;
  }

  // 3. VALIDACIÓ DE L'EXERCICI (Contra les dades del Sheet)
  const llibreOK = userLlibre.toLowerCase() === op.llibre.toLowerCase();
  const importOK = Math.abs(userImport - parseFloat(op.import)) < 0.01;
  const tipusOK = userTipus.toLowerCase() === op.tipus.toLowerCase();

  if (llibreOK && importOK && tipusOK) {
    // --- L'OPERACIÓ ÉS CORRECTA ---
    ultimaDataInformada = userDataDoc; // Guardem la data per al proper pas

    // A. GESTIÓ DE TRESORERIA (Caixa i Banc)
    if (userLlibre === "caixa" || userLlibre === "banc") {
      if (userTipus === "entrada") {
        userLlibre === "caixa"
          ? (estat.saldoCaixa += userImport)
          : (estat.saldoBanc += userImport);
      } else {
        userLlibre === "caixa"
          ? (estat.saldoCaixa -= userImport)
          : (estat.saldoBanc -= userImport);
      }

      const saldoActual =
        userLlibre === "caixa" ? estat.saldoCaixa : estat.saldoBanc;

      afegirFilaTresoreria(
        userLlibre,
        userDataDoc,
        userConcepte || op.concepte,
        userImport,
        userTipus,
        saldoActual,
      );
    }

    // B. GESTIÓ D'AUXILIARS (Clients i Proveïdors)
    if (userLlibre === "clients" || userLlibre === "proveidors") {
      const codiClau = userNAux;
      if (!estat.saldosAuxiliars[codiClau]) estat.saldosAuxiliars[codiClau] = 0;

      // Lògica comptable:
      // Clients: Entrada suma saldo (Deure), Sortida resta (Haver).
      // Prov: Sortida suma saldo (Haver), Entrada resta (Deure).
      if (userLlibre === "clients") {
        estat.saldosAuxiliars[codiClau] +=
          userTipus === "entrada" ? userImport : -userImport;
      } else {
        estat.saldosAuxiliars[codiClau] +=
          userTipus === "sortida" ? userImport : -userImport;
      }

      afegirFilaAuxiliar(
        userLlibre,
        userNAux,
        userNomAux,
        userDataValor,
        userImport,
        userEfecte,
        userTipus, // Passar el tipus per saber si és Deure o Haver
        estat.saldosAuxiliars[codiClau],
      );

      reordenarTaulaAuxiliar(userLlibre);
    }

    mostrarFeedback("Assentament realitzat correctament.", "success");
    pasActual++;

    if (pasActual < exerciciActual.length) {
      mostrarPregunta();
    } else {
      finalitzarExercici();
    }
    actualitzarSaldosVisuals();
  } else {
    // Feedback d'error detallat si l'alumne s'equivoca
    let msg = "Error: ";
    if (!llibreOK) msg += "Llibre incorrecte. ";
    if (!importOK) msg += "Import incorrecte. ";
    if (!tipusOK) msg += "Moviment (Entrada/Sortida) incorrecte. ";
    mostrarFeedback(msg, "error");
  }
}

function netejarFormulari() {
  document.getElementById("input-import").value = "";
  document.getElementById("input-ref").value = "";
  document.getElementById("input-concepte").value = "";
  document.getElementById("input-efecte").value = "-";
  // El llibre i el tipus els podem deixar per defecte
}

function registrarMoviment(llibre, op, imp, data, venc) {
  const concepte =
    document.getElementById("in-concepte").value || op["concepte 1"];
  const tipus = op["tipus 1"]; // entrada o sortida

  if (llibre === "caixa" || llibre === "banc") {
    if (llibre === "caixa")
      estat.saldoCaixa += tipus === "entrada" ? imp : -imp;
    else estat.saldoBanc += tipus === "entrada" ? imp : -imp;

    afegirFilaTresoreria(
      llibre,
      data,
      concepte,
      imp,
      tipus,
      llibre === "caixa" ? estat.saldoCaixa : estat.saldoBanc,
    );
  } else {
    // Llibres auxiliars
    const esEfecte = op["efecte1"] === "SÍ" ? "🔔" : "-";
    afegirFilaAuxiliar(
      llibre,
      op["nº Cli/Prov 1"],
      op["dadeclient/proveidor1"],
      venc,
      imp,
      esEfecte,
    );
  }
}

// --- UTILS DE TAULA ---

function afegirFilaTresoreria(llibre, data, concepte, valor, tipus, saldo) {
  const tbody = document.getElementById(`body-${llibre}`);
  if (!tbody) return;

  const dataValor = document.getElementById("input-data-valor").value;
  const entrada = tipus === "entrada" ? `${valor.toFixed(2)} €` : "";
  const sortida = tipus === "sortida" ? `${valor.toFixed(2)} €` : "";

  let row = "";
  if (llibre === "caixa") {
    row = `
      <tr class="border-b border-slate-50 text-xs">
        <td class="p-4">${data}</td>
        <td class="p-4 font-medium">${concepte}</td>
        <td class="p-4 text-right text-emerald-600 font-bold">${entrada}</td>
        <td class="p-4 text-right text-rose-600 font-bold">${sortida}</td>
        <td class="p-4 text-right font-black">${saldo.toFixed(2)} €</td>
      </tr>`;
  } else {
    row = `
      <tr class="border-b border-slate-50 text-xs">
        <td class="p-4">${data}</td>
        <td class="p-4 text-blue-600 font-medium">${dataValor}</td>
        <td class="p-4 font-medium">${concepte}</td>
        <td class="p-4 text-right text-emerald-600 font-bold">${entrada}</td>
        <td class="p-4 text-right text-rose-600 font-bold">${sortida}</td>
        <td class="p-4 text-right font-black">${saldo.toFixed(2)} €</td>
      </tr>`;
  }
  tbody.innerHTML += row;
}

function afegirFilaAuxiliar(
  llibre,
  nAux,
  nomAux,
  dataV,
  importVal,
  efecte,
  tipus,
  saldoFinal,
) {
  const tbody = document.getElementById(`body-${llibre}`);
  if (!tbody) return;

  // 1. DETERMINAR DEURE I HAVER
  let deure = "0.00";
  let haver = "0.00";

  if (llibre === "clients") {
    // Clients: Deure (entrada de deute) / Haver (cobrament/sortida de deute)
    tipus === "entrada"
      ? (deure = importVal.toFixed(2))
      : (haver = importVal.toFixed(2));
  } else {
    // Proveïdors: Haver (sortida/augment deute) / Deure (pagament/entrada)
    tipus === "sortida"
      ? (haver = importVal.toFixed(2))
      : (deure = importVal.toFixed(2));
  }

  // 2. DETERMINAR SALDO DEUTOR O CREDITOR
  let sDeutor = "0.00";
  let sCreditor = "0.00";

  if (llibre === "clients") {
    saldoFinal >= 0
      ? (sDeutor = saldoFinal.toFixed(2))
      : (sCreditor = Math.abs(saldoFinal).toFixed(2));
  } else {
    // Proveïdors: El saldo habitual és Creditor
    saldoFinal >= 0
      ? (sCreditor = saldoFinal.toFixed(2))
      : (sDeutor = Math.abs(saldoFinal).toFixed(2));
  }

  // 3. GENERAR LA FILA AMB EL COLOR BLAU A L'HAVER
  const row = `
    <tr class="hover:bg-slate-50 transition-colors" data-codi="${nAux}">
      <td class="p-4 text-slate-500">${ultimaDataInformada}</td>
      <td class="p-4 ${llibre === "clients" ? "text-blue-600" : "text-purple-600"}">${dataV}</td>
      <td class="p-4 font-mono font-bold">${nAux}</td>
      <td class="p-4 text-slate-700">${nomAux}</td>
      <td class="p-4 text-center"><span class="px-2 py-1 bg-slate-100 rounded text-[10px]">${efecte}</span></td>
      <td class="p-4 text-slate-500 italic">${exerciciActual[pasActual]?.["Concepte"] || "S/D"}</td>
      <td class="p-4 text-right font-medium">${deure}</td>
      <td class="p-4 text-right font-medium text-blue-600">${haver}</td> <td class="p-4 text-right font-black text-slate-800">${sDeutor}</td>
      <td class="p-4 text-right font-black text-blue-800">${sCreditor}</td> </tr>`;

  tbody.insertAdjacentHTML("beforeend", row);
}

function reordenarTaulaAuxiliar(idLlibre) {
  const tbody = document.getElementById(`body-${idLlibre}`);
  const rows = Array.from(tbody.querySelectorAll("tr"));

  rows.sort((a, b) => {
    const codiA = a.getAttribute("data-codi");
    const codiB = b.getAttribute("data-codi");
    return codiA.localeCompare(codiB, undefined, { numeric: true });
  });

  tbody.innerHTML = "";
  rows.forEach((row) => tbody.appendChild(row));
}

// --- INTERFÍCIE ---
function actualitzarInterficie() {
  document
    .getElementById("seccio-auth")
    .classList.toggle("hidden", estat.modoActual === "app");
  document
    .getElementById("seccio-app")
    .classList.toggle("hidden", estat.modoActual === "auth");
}

function actualitzarSaldosVisuals() {
  document.getElementById("saldo-caixa").innerText =
    estat.saldoCaixa.toFixed(2) + " €";
  document.getElementById("saldo-banc").innerText =
    estat.saldoBanc.toFixed(2) + " €";
}

function resetSaldos() {
  estat.saldoCaixa = 0;
  estat.saldoBanc = 0;
  estat.saldoClients = 0;
  estat.saldoProveidors = 0;

  // Molt important: cridar a actualitzar els textos de la pantalla
  actualitzarSaldosVisuals();
}
