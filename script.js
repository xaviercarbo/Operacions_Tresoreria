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
let usuariSessio = { nom: "Convidat", punts: 0 };

const SHEET_URL =
  "https://script.google.com/macros/s/AKfycbxYWa1mnedjhynK-SgwXNyauwIZX9eC94GnLiQ8tdIZmly32P9A-qFGo-CBBvTLxn0jaQ/exec";

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

// Funció per processar la cadena de text de l'Excel
function processarDadesBalanc(cadena) {
  if (!cadena || cadena.trim() === "") return [];

  // 1. Separem per punts i coma cada element
  const elements = cadena.split(";");

  return elements
    .map((el) => {
      // 2. Separem les tres parts (Nom : Import : Categoria)
      const parts = el.split(":");

      // Verifiquem que l'element tingui el format correcte (mínim 3 parts)
      if (parts.length < 3) return null;

      const [nom, importVal, cat] = parts;

      return {
        nom: nom.trim(),
        // Substituïm la coma decimal per punt si cal abans de convertir a número
        import: parseFloat(importVal.toString().replace(",", ".")) || 0,
        // Convertim a majúscules per seguretat (evita errors "ac" vs "AC")
        categoria: cat.trim().toUpperCase(),
      };
    })
    .filter((item) => item !== null); // Eliminem elements mal formats
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

// --- GESTIÓ D'ACCÉS (VERSIÓ INTEGRADA AMB DASHBOARD) ---
async function intentarLogin() {
  // 1. Captura de valors i neteja d'espais
  const nomInput = document.getElementById("login-usuari").value.trim();
  const passInput = document.getElementById("login-pass").value.trim();

  if (!estat.dadesGlobals)
    return alert("Encara carregant dades del servidor...");

  // 2. Busquem l'usuari a les dades de l'Excel
  const user = estat.dadesGlobals.usuaris.find((u) => {
    const nomExcel = String(u.Nom || "")
      .toLowerCase()
      .trim();
    const nomLogin = nomInput.toLowerCase();
    return nomExcel === nomLogin && String(u.Contrasenya || "") === passInput;
  });

  if (user) {
    // --- MILLORA A: NETEJA DE SEGURETAT ---
    // Eliminem qualsevol rastre de punts o sessions anteriors del navegador
    localStorage.removeItem("punts_temporals");
    // Si guardaves saldos a LocalStorage, neteja'ls aquí també

    // --- MILLORA B: RECÀRREGA DE DADES FRESCA ---
    // Abans d'entrar, ens assegurem de tenir l'últim "Progress" de Google Sheets
    // per si l'alumne ha entrat des d'un altre ordinador abans.
    await carregarDades();

    // 3. ACTUALITZACIÓ DE LES VARIABLES DE SESSIÓ
    estat.usuari = user;
    usuariSessio = {
      nom: user.Nom,
      punts: parseInt(user.PuntsTotals) || 0,
    };

    // 4. CANVI DE PANTALLA
    estat.modoActual = "app";
    actualitzarInterficie();

    // 5. ACTUALITZACIÓ DELS DISPLAYS (UI)
    if (document.getElementById("nom-usuari-display")) {
      document.getElementById("nom-usuari-display").innerText = user.Nom;
    }
    if (document.getElementById("punts-total")) {
      document.getElementById("punts-total").innerText = usuariSessio.punts;
    }

    // 6. ACTUALITZACIÓ DE LA SECCIÓ DE BENVINGUDA (UI)
    const welcomeName = document.getElementById("nom-usuari-welcome");
    if (welcomeName) welcomeName.innerText = user.Nom;

    const welcomePunts = document.getElementById("punts-display-welcome");
    if (welcomePunts) welcomePunts.innerText = usuariSessio.punts;

    // Comptem l'historial des de les dades acabades de descarregar
    const welcomeCompletats = document.getElementById(
      "completats-display-welcome",
    );
    if (welcomeCompletats && estat.dadesGlobals.progres) {
      const totalFet = estat.dadesGlobals.progres.filter((p) => {
        return (
          String(p.Usuari || "")
            .toLowerCase()
            .trim() === user.Nom.toLowerCase().trim()
        );
      }).length;
      welcomeCompletats.innerText = totalFet;
    }

    // Nivell d'Usuari
    const welcomeNivell = document.getElementById("nivell-display-welcome");
    if (welcomeNivell) {
      let nivell = "Junior";
      if (usuariSessio.punts >= 100) nivell = "Sènior";
      if (usuariSessio.punts >= 300) nivell = "Expert";
      if (usuariSessio.punts >= 600) nivell = "Màster";
      welcomeNivell.innerText = nivell;
    }

    // --- MILLORA C: RECONSTRUCCIÓ DE L'ESTAT COMPTABLE ---
    // Això és vital: com que hem fet carregarDades(), ara reconstruirEstatUsuari
    // dibuixarà els llibres de caixa/banc exactament com estan al Google Sheet.
    if (typeof reconstruirEstatUsuari === "function") {
      reconstruirEstatUsuari();
    }

    // GENEREM EL MENÚ AMB ELS CHECKS VERDS
    generarMenuExercicis();

    console.log("Sessió iniciada i dades sincronitzades per a:", user.Nom);
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

// --- Torna al inici APP (Versió amb Rànquing)
function tornarIniciApp() {
  // 1. Amaguem la zona de l'exercici i el rànquing
  const zona = document.getElementById("zona-exercici");
  if (zona) zona.classList.add("hidden");

  // AFEGIM AIXÒ: Amagar el rànquing per si estava obert
  const zonaRanking = document.getElementById("zona-ranking");
  if (zonaRanking) zonaRanking.classList.add("hidden");

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
  if (!estat.dadesGlobals || !estat.dadesGlobals.operacions || !menu) return;

  const operacions = estat.dadesGlobals.operacions;
  const progresRealitzat = estat.dadesGlobals.progres || [];
  const nomUsuari = usuariSessio.nom || "";

  const llistaExercicis = [...new Set(operacions.map((op) => op.exercici))];
  menu.innerHTML = "";

  llistaExercicis.forEach((nomEx) => {
    const opsDeLExercici = operacions.filter((o) => o.exercici === nomEx);

    // 1. COMPTEM OPERACIONS FETES
    const operacionsFetes = opsDeLExercici.filter((op) =>
      progresRealitzat.some((p) => {
        if (!p || !p.id_op || !op.id_op || !p.Usuari) return false;
        return (
          p.Usuari.toString().toLowerCase() ===
            nomUsuari.toString().toLowerCase() &&
          p.id_op.toString() === op.id_op.toString()
        );
      }),
    ).length;

    const totLexerciciFet =
      operacionsFetes === opsDeLExercici.length && opsDeLExercici.length > 0;

    // Creació del contenidor del grup
    const grup = document.createElement("div");
    grup.className = "mb-4";

    const btnEx = document.createElement("button");
    const safeId = nomEx.replace(/\s+/g, "");
    const estilGrup = totLexerciciFet
      ? "bg-emerald-900/40 border border-emerald-500/30"
      : "bg-slate-800/30 hover:bg-slate-800";

    btnEx.className = `w-full flex items-center justify-between p-3 rounded-xl ${estilGrup} text-white font-bold text-sm transition-all`;
    btnEx.innerHTML = `
      <span class="flex items-center gap-2">
        ${totLexerciciFet ? "✅" : "📂"} ${nomEx}
      </span>
      <div class="flex items-center gap-2">
        <span class="text-[10px] opacity-60">${operacionsFetes}/${opsDeLExercici.length}</span>
        <svg class="w-4 h-4 transform transition-transform" id="arrow-${safeId}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M19 9l-7 7-7-7"></path>
        </svg>
      </div>
    `;

    const llistaOps = document.createElement("div");
    llistaOps.id = `list-${safeId}`;
    llistaOps.className =
      "hidden pl-4 mt-2 space-y-1 border-l-2 border-slate-800 ml-2";

    // 2. CREACIÓ DE CADA SUB-BOTÓ (OPERACIÓ)
    opsDeLExercici.forEach((op, index) => {
      const estaFeta = progresRealitzat.some((p) => {
        if (!p || !p.id_op || !op.id_op || !p.Usuari) return false;
        return (
          p.Usuari.toString().toLowerCase() ===
            nomUsuari.toString().toLowerCase() &&
          p.id_op.toString() === op.id_op.toString()
        );
      });

      const btnOp = document.createElement("button");
      const estilOp = estaFeta
        ? "text-emerald-400 bg-emerald-500/10 font-bold"
        : "text-slate-500 hover:text-orange-400 hover:bg-slate-800/50";

      btnOp.className = `w-full text-left p-2 rounded-lg text-[11px] transition-all truncate flex items-center justify-between gap-2 ${estilOp}`;
      btnOp.innerHTML = `
        <div class="flex items-center gap-2 truncate">
            <span class="opacity-40 w-4">${index + 1}.</span> 
            <span class="truncate">${op["Text Breu"] || "Operació " + (index + 1)}</span>
        </div>
        ${estaFeta ? "<span>✔</span>" : ""}
      `;

      // --- CANVI CRUCIAL AQUÍ ---
      btnOp.onclick = () => {
        // A. Definim quin és l'exercici actiu
        exerciciActual = opsDeLExercici;
        pasActual = index;

        // B. Reconstruïm els llibres basant-nos en el progrés realitzat
        // Això omplirà les taules de Caixa/Banc amb el que ja estigui validat (✔)
        if (typeof reconstruirEstatUsuari === "function") {
          reconstruirEstatUsuari();
        }

        // C. Actualitzem la interfície
        mostrarPregunta();
        netejarInputs();

        // Tanquem el menú en mòbil
        if (window.innerWidth < 768) toggleMenu();
      };

      llistaOps.appendChild(btnOp);
    });

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
  // 1. GESTIÓ DE VISIBILITAT (Neteja total de la benvinguda)
  const welcome = document.getElementById("benvinguda-app"); // ID actualitzat
  const zona = document.getElementById("zona-exercici");
  const zonaBalanc = document.getElementById("zona-balanc");

  if (welcome) {
    welcome.style.display = "none"; // Forçat per evitar superposicions
    welcome.classList.add("hidden");
  }

  // Mostrem la zona d'exercici per defecte
  if (zona) zona.classList.remove("hidden");
  if (zonaBalanc) zonaBalanc.classList.add("hidden");

  // 2. FILTRAT D'OPERACIONS
  if (!estat.dadesGlobals || !estat.dadesGlobals.operacions) return;

  exerciciActual = estat.dadesGlobals.operacions.filter(
    (op) => op.exercici === nomEx,
  );

  pasActual = 0;

  // 3. RECONSTRUCCIÓ DE L'ESTAT (Saldos i Taules)
  // En lloc de fer resetSaldos() i netejar manualment,
  // cridem a la nostra funció mestra que ja ho fa tot basant-se en Google Sheets
  reconstruirEstatUsuari();

  // 4. ACTUALITZACIÓ DE TÍTOLS
  const titolHeader = document.getElementById("titol-operacio-text");
  if (titolHeader) titolHeader.innerText = nomEx;

  // 5. CARREGAR LA PRIMERA PREGUNTA
  mostrarPregunta();

  // 6. UX: Scroll al principi
  const scrollContainer = document.querySelector(".custom-scroll");
  if (scrollContainer) scrollContainer.scrollTop = 0;

  console.log("Iniciant exercici:", nomEx);
}

// MOSTRAR PREGUNTA (Actualitzat amb bloqueig de seguretat i gestió de benvinguda)
function mostrarPregunta() {
  if (!exerciciActual || !exerciciActual[pasActual]) return;

  const op = exerciciActual[pasActual];
  const nomUsuari = usuariSessio.nom || "";

  // --- MILLORA 1: GESTIÓ DE LA PANTALLA DE BENVINGUDA ---
  const seccioBenvinguda = document.getElementById("benvinguda-app");
  if (seccioBenvinguda) {
    seccioBenvinguda.style.display = "none";
    seccioBenvinguda.classList.add("hidden");
  }

  // --- MILLORA 2: COMPROVACIÓ D'OPERACIÓ JA REALITZADA ---
  const jaFeta = estat.dadesGlobals.progres.some((p) => {
    if (!p || !p.id_op || !op.id_op || !p.Usuari) return false;
    return (
      p.Usuari.toString().toLowerCase() ===
        nomUsuari.toString().toLowerCase() &&
      p.id_op.toString() === op.id_op.toString()
    );
  });

  const tipusLlibre = (op.llibre || "").toString().toUpperCase().trim();
  const zonaExercici = document.getElementById("zona-exercici");
  const zonaBalanc = document.getElementById("zona-balanc");
  const cardPregunta = document.getElementById("card-pregunta");

  // RUTA A: BALANÇ
  if (tipusLlibre === "BALANC" || tipusLlibre === "BALANÇ") {
    if (zonaExercici) zonaExercici.classList.add("hidden");
    if (zonaBalanc) zonaBalanc.classList.remove("hidden");
    const dadesBalanc = {
      titol:
        op["Text Descripció Operació"] || "Classifica els comptes al Balanç",
      comptes: processarDadesBalanc(op.concepte),
    };
    prepararBalanc(dadesBalanc);
    return;
  }

  // RUTA B: REGISTRE
  if (zonaBalanc) zonaBalanc.classList.add("hidden");
  if (zonaExercici) zonaExercici.classList.remove("hidden");

  document.getElementById("text-pregunta").innerText =
    op["Text Descripció Operació"] || "Sense descripció";

  const indicadorPas = document.getElementById("pas-indicador");
  if (indicadorPas) {
    indicadorPas.innerText = `PAS ${pasActual + 1} / ${exerciciActual.length}`;
  }

  const btnValidar = document.querySelector("button[onclick='validarPas()']");
  const inputsFormulari = zonaExercici.querySelectorAll(
    "input, select, textarea",
  );

  // --- GESTIÓ DE DATES ACTUALITZADA ---
  const inputDataDoc = document.getElementById("input-data-doc");
  const inputDataVal = document.getElementById("input-data-valor");

  // 1. Pesquem la data bruta (ISO)
  const dataBruta = op.dataoperacio || op.data_doc || ultimaDataInformada;

  // 2. La netegem amb la teva funció per treure el format 2026-06-01T22:00...
  const dataNeta = formatarDataEuropea(dataBruta);

  // 3. L'assignem als inputs
  if (inputDataDoc) inputDataDoc.value = dataNeta;
  if (inputDataVal) inputDataVal.value = dataNeta;

  // --- BLOQUEIG O ACTIVACIÓ ---
  if (jaFeta) {
    mostrarFeedback("Operació ja registrada.", "info");
    if (btnValidar) {
      btnValidar.disabled = true;
      btnValidar.classList.add("opacity-50", "cursor-not-allowed");
      btnValidar.innerText = "JA REGISTRADA";
    }
    inputsFormulari.forEach((el) => (el.disabled = true));

    if (document.getElementById("input-llibre"))
      document.getElementById("input-llibre").value = op.llibre.toLowerCase();
    if (document.getElementById("input-import"))
      document.getElementById("input-import").value = op.import;
    if (document.getElementById("input-tipus"))
      document.getElementById("input-tipus").value = op.tipus.toLowerCase();
    if (document.getElementById("input-concepte"))
      document.getElementById("input-concepte").value = op.concepte;
    if (document.getElementById("input-n-aux"))
      document.getElementById("input-n-aux").value = op.n_aux || "";
  } else {
    if (btnValidar) {
      btnValidar.disabled = false;
      btnValidar.classList.remove("opacity-50", "cursor-not-allowed");
      btnValidar.innerText = "VALIDAR OPERACIÓ";
    }
    inputsFormulari.forEach((el) => (el.disabled = false));

    ["input-n-aux", "input-nom-aux", "input-concepte", "input-import"].forEach(
      (id) => {
        const el = document.getElementById(id);
        if (el) {
          el.value = "";
          el.classList.remove(
            "border-rose-500",
            "bg-rose-50",
            "border-orange-300",
          );
        }
      },
    );
  }

  // Lògica de Requisits Dinàmics (Visuals)
  const selectorLlibre = document.getElementById("input-llibre");
  const selectorTipus = document.getElementById("input-tipus");
  if (!selectorLlibre || !selectorTipus) return;

  const actualitzarRequisits = () => {
    const llibre = selectorLlibre.value;
    const optEntrada = selectorTipus.querySelector('option[value="entrada"]');
    const optSortida = selectorTipus.querySelector('option[value="sortida"]');

    if (llibre === "caixa") {
      if (optEntrada) optEntrada.innerText = "Entrada (Cobrament)";
      if (optSortida) optSortida.innerText = "Sortida (Pagament)";
    } else {
      if (optEntrada) optEntrada.innerText = "Deure (Entrada / Augment Actiu)";
      if (optSortida) optSortida.innerText = "Haver (Sortida / Augment Passiu)";
    }

    const cardLlibre = document.getElementById(`card-${llibre}`);
    if (cardLlibre) cardLlibre.parentElement.prepend(cardLlibre);
  };

  selectorLlibre.onchange = actualitzarRequisits;
  actualitzarRequisits();

  if (cardPregunta) cardPregunta.classList.remove("hidden");
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

// --- VALIDACIÓ I REGISTRE AMB ACTUALITZACIÓ DE MENÚ EN TEMPS REAL ---
async function validarPas() {
  if (!exerciciActual || !exerciciActual[pasActual]) return;
  const op = exerciciActual[pasActual];

  // 1. CAPTURA DE DADES
  const userLlibre = document.getElementById("input-llibre").value;
  const userImport = parseFloat(document.getElementById("input-import").value);
  const userTipus = document.getElementById("input-tipus").value;
  const idOperacioActual = op.id_op;

  // 2. VALIDACIÓ
  const llibreOK = userLlibre.toLowerCase() === op.llibre.toLowerCase();
  const importOK = Math.abs(userImport - parseFloat(op.import)) < 0.01;
  const tipusOK = userTipus.toLowerCase() === op.tipus.toLowerCase();

  if (llibreOK && importOK && tipusOK) {
    // --- L'OPERACIÓ ÉS CORRECTA ---

    // A. ACTUALITZACIÓ LOCAL DEL PROGRÉS (Només si no existeix ja)
    const jaExisteix = estat.dadesGlobals.progres.some(
      (p) => p.id_op === idOperacioActual && p.Usuari === usuariSessio.nom,
    );

    if (!jaExisteix) {
      estat.dadesGlobals.progres.push({
        Usuari: usuariSessio.nom,
        Exercici: op.exercici,
        id_op: idOperacioActual,
        Punts: 10,
        Data: new Date().toISOString(),
      });
    }

    // B. RECONSTRUCCIÓ VISUAL (Buidem i pintem amb la nova dada local)
    reconstruirEstatUsuari();

    // C. GAMIFICACIÓ
    mostrarExitGamificat("OPERACIÓ", 10);
    usuariSessio.punts += 10;
    if (document.getElementById("punts-total")) {
      document.getElementById("punts-total").innerText = usuariSessio.punts;
    }

    // D. SINCRONITZACIÓ AMB EL SERVIDOR (Google Sheets)
    // IMPORTANT: Fem servir await per esperar que es desi abans de fer res més
    try {
      await registrarProgresAritmetic(10, op.exercici, idOperacioActual);
    } catch (error) {
      console.error("Error guardant a Google Sheets:", error);
    }

    // E. AVANÇAR AL SEGÜENT PAS
    pasActual++;
    generarMenuExercicis(); // Refresquem els tics (✔) del menú lateral

    // F. NETEJA I SEGÜENT PREGUNTA
    setTimeout(() => {
      // Neteja manual dels camps de text per seguretat
      [
        "input-n-aux",
        "input-nom-aux",
        "input-concepte",
        "input-import",
      ].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });

      mostrarPregunta();
    }, 1500);
  } else {
    // Feedback d'error detallat
    let msg = "Error: ";
    if (!llibreOK) msg += "Llibre incorrecte. ";
    if (!importOK) msg += "Import incorrecte. ";
    if (!tipusOK) msg += "Moviment incorrecte. ";
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

//---- Funció de reconstruir saldos // ----
function reconstruirEstatUsuari() {
  // 1. Reiniciem saldos a l'estat inicial per evitar duplicats en sumar
  estat.saldoCaixa = 0;
  estat.saldoBanc = 0;
  estat.saldosAuxiliars = {};

  // 2. Netegem les taules visualment (buidem els <tbody>)
  const llistatLlibres = ["caixa", "banc", "clients", "proveidors"];
  llistatLlibres.forEach((id) => {
    const el = document.getElementById(`body-${id}`);
    if (el) el.innerHTML = "";
  });

  // 3. Verificacions de seguretat
  if (!estat.dadesGlobals || !estat.dadesGlobals.progres || !exerciciActual)
    return;

  // 4. Filtrem el progrés per l'usuari actual i l'exercici que té obert
  const nomExActual = exerciciActual[0]?.exercici;
  const historial = estat.dadesGlobals.progres.filter((p) => {
    return (
      p.Usuari.toString().toLowerCase() ===
        usuariSessio.nom.toString().toLowerCase() && p.Exercici === nomExActual
    );
  });

  // 5. Per cada operació trobada al "Progress", busquem els detalls a "Operacions"
  historial.forEach((fet) => {
    const opOriginal = estat.dadesGlobals.operacions.find(
      (o) => o.id_op.toString() === fet.id_op.toString(),
    );

    if (opOriginal) {
      const imp = parseFloat(opOriginal.import) || 0;
      const llibre = (opOriginal.llibre || "").toLowerCase();
      const tipus = (opOriginal.tipus || "").toLowerCase();

      // --- MILLORA: CAPTURA I FORMAT DE DATA ---
      // Agafem la columna de l'Excel (ara sense accent) i la passem per la teva funció
      const dataBruta = opOriginal.dataoperacio || opOriginal.data_doc || "---";
      const dataNeta = formatarDataEuropea(dataBruta);

      // --- Lògica Tresoreria (Caixa/Banc) ---
      if (llibre === "caixa" || llibre === "banc") {
        if (tipus === "entrada") {
          llibre === "caixa"
            ? (estat.saldoCaixa += imp)
            : (estat.saldoBanc += imp);
        } else {
          llibre === "caixa"
            ? (estat.saldoCaixa -= imp)
            : (estat.saldoBanc -= imp);
        }

        afegirFilaTresoreria(
          llibre,
          dataNeta, // <--- Ja formatejada com DD/MM/AAAA
          opOriginal.concepte || "Sense concepte",
          imp,
          tipus,
          llibre === "caixa" ? estat.saldoCaixa : estat.saldoBanc,
        );
      }

      // --- Lògica Auxiliars (Clients/Proveïdors) ---
      if (llibre === "clients" || llibre === "proveidors") {
        // 1. Capturem les dades usant els noms exactes de la teva captura de l'Excel
        // Nota: Si a l'Excel posa "nº Cli/Prov", Google Apps Script sol netejar-ho a "nCliProv" o similar.
        // Prova aquests que són els més probables segons la teva imatge:
        const codiClau =
          opOriginal["nº Cli/Prov"] || opOriginal["nCliProv"] || "S/N";
        const nomComplet =
          opOriginal["dadeclient/proveidor"] ||
          opOriginal["dadeclientproveidor"] ||
          "---";
        const efecte = opOriginal["efecte"] || "---";
        const concepteAux = opOriginal["concepte"] || "S/D";

        // 2. Càlcul de saldos (es manté igual)
        if (!estat.saldosAuxiliars[codiClau]) {
          estat.saldosAuxiliars[codiClau] = 0;
        }

        if (llibre === "clients") {
          estat.saldosAuxiliars[codiClau] += tipus === "entrada" ? imp : -imp;
        } else {
          estat.saldosAuxiliars[codiClau] += tipus === "sortida" ? imp : -imp;
        }

        // 3. Passem la informació neta a la funció de pintar
        afegirFilaAuxiliar(
          llibre,
          codiClau,
          nomComplet,
          dataNeta, // Data que ja hem netejat abans
          imp,
          efecte,
          tipus,
          estat.saldosAuxiliars[codiClau],
          concepteAux,
        );
      }
    }
  });

  // 6. Actualitzem els comptadors de la part superior
  actualitzarSaldosVisuals();

  // 7. Reordenar taules auxiliars
  if (typeof reordenarTaulaAuxiliar === "function") {
    reordenarTaulaAuxiliar("clients");
    reordenarTaulaAuxiliar("proveidors");
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
  concepte, // <--- Nou paràmetre rebut des de reconstruirEstatUsuari
) {
  const tbody = document.getElementById(`body-${llibre}`);
  if (!tbody) return;

  // 1. DETERMINAR DEURE I HAVER
  let deure = "0.00";
  let haver = "0.00";

  // Lògica segons el tipus de llibre
  if (llibre === "clients") {
    // Clients: Entrada (Deure) / Sortida (Haver)
    tipus === "entrada"
      ? (deure = importVal.toFixed(2))
      : (haver = importVal.toFixed(2));
  } else {
    // Proveïdors: Sortida (Haver) / Entrada (Deure)
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
    saldoFinal >= 0
      ? (sCreditor = saldoFinal.toFixed(2))
      : (sDeutor = Math.abs(saldoFinal).toFixed(2));
  }

  // 3. GENERAR LA FILA (Usant dataV per a les dues columnes de data per coherència)
  const row = `
    <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100" data-codi="${nAux}">
      <td class="p-4 text-slate-500 text-sm">${dataV}</td>
      <td class="p-4 text-sm ${llibre === "clients" ? "text-blue-600" : "text-purple-600"}">${dataV}</td>
      <td class="p-4 font-mono font-bold text-sm">${nAux}</td>
      <td class="p-4 text-slate-700 text-sm">${nomAux}</td>
      <td class="p-4 text-center">
        <span class="px-2 py-1 bg-slate-100 rounded text-[10px] uppercase font-bold">${efecte}</span>
      </td>
      <td class="p-4 text-slate-500 italic text-sm">${concepte || "S/D"}</td>
      <td class="p-4 text-right font-medium text-sm">${deure}</td>
      <td class="p-4 text-right font-medium text-sm text-blue-600">${haver}</td>
      <td class="p-4 text-right font-black text-sm text-slate-800">${sDeutor}</td>
      <td class="p-4 text-right font-black text-sm text-blue-800">${sCreditor}</td>
    </tr>`;

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

// --- BALANÇ Interactiu -------------------------------------------------------------BALANÇ Interactiu
// / Variable global per saber quin compte hem triat
let compteActiu = null; // Variable global per la selecció
// Variable global actualitzada
let totalsBalanc = {
  ANC: 0,
  EXISTENCIES: 0, // Abans part de AC
  REALITZABLE: 0, // Abans part de AC
  DISPONIBLE: 0, // Abans part de AC
  PN: 0,
  PNC: 0,
  PC: 0,
};

// Funció complementària per al comptador
function actualitzarComptadorBossa() {
  const restants = document.querySelectorAll("#bossa-comptes button").length;
  // Aprofitarem l'indicador de pas que ja tens al teu HTML original
  const indicador = document.getElementById("pas-indicador");
  if (indicador) {
    indicador.innerText =
      restants > 0 ? `ELEMENTS RESTANTS: ${restants}` : `BALANÇ COMPLETAT`;
  }
}

function prepararBalanc(dades) {
  // --- 0. CONTROL DE VISTES ---
  const seccioExercicis = document.getElementById("zona-exercicis");
  const seccioBalanc = document.getElementById("zona-balanc");
  const seccioCalculs = document.getElementById("zona-calculs-balanc");

  if (seccioExercicis) seccioExercicis.classList.add("hidden");
  if (seccioBalanc) seccioBalanc.classList.remove("hidden");
  if (seccioCalculs) seccioCalculs.classList.add("hidden");

  // --- 1. ACTUALITZACIÓ DE L'ACTIU CORRENT (EL COR DEL CANVI) ---
  const targetaAC = document.getElementById("targeta-AC");
  if (targetaAC) {
    // Eliminem l'onclick general de la targeta perquè ara clicarem als subgrups interns
    targetaAC.removeAttribute("onclick");
    targetaAC.classList.remove("cursor-pointer", "hover:border-blue-400");

    // Injectem els 3 subgrups mantenint el teu estil visual
    targetaAC.innerHTML = `
      <div class="flex justify-between items-center mb-3">
        <span class="text-[11px] font-bold text-blue-600 uppercase tracking-widest">ACTIU CORRENT</span>
        <span id="total-AC" class="font-black text-slate-900">0,00 €</span>
      </div>
      
      <div class="space-y-2 mt-4">
        <div onclick="intentarUbicar('EXISTENCIES')" class="p-3 rounded-xl border border-slate-100 hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer group/sub">
          <div class="flex justify-between text-[10px] font-bold text-slate-400 group-hover/sub:text-blue-500">
            <span>EXISTÈNCIES</span>
            <span id="total-EXISTENCIES">0,00 €</span>
          </div>
          <div id="llista-EXISTENCIES" class="mt-1 space-y-1"></div>
        </div>

        <div onclick="intentarUbicar('REALITZABLE')" class="p-3 rounded-xl border border-slate-100 hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer group/sub">
          <div class="flex justify-between text-[10px] font-bold text-slate-400 group-hover/sub:text-blue-500">
            <span>REALITZABLE</span>
            <span id="total-REALITZABLE">0,00 €</span>
          </div>
          <div id="llista-REALITZABLE" class="mt-1 space-y-1"></div>
        </div>

        <div onclick="intentarUbicar('DISPONIBLE')" class="p-3 rounded-xl border border-slate-100 hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer group/sub">
          <div class="flex justify-between text-[10px] font-bold text-slate-400 group-hover/sub:text-blue-500">
            <span>DISPONIBLE</span>
            <span id="total-DISPONIBLE">0,00 €</span>
          </div>
          <div id="llista-DISPONIBLE" class="mt-1 space-y-1"></div>
        </div>
      </div>
    `;
  }

  // --- 2. NETEJA DE LA RESTA DE MASSES (ANC, PN, PNC, PC) ---
  // Com que l'alumne pot venir d'un exercici anterior, buidem les llistes
  const massesRestants = ["ANC", "PN", "PNC", "PC"];
  massesRestants.forEach((m) => {
    const llista = document.getElementById(`llista-${m}`);
    const total = document.getElementById(`total-${m}`);
    if (llista) llista.innerHTML = "";
    if (total) total.innerText = "0,00 €";
  });

  // --- 3. RESET DE LA BOSSA I ESTAT ---
  const bossa = document.getElementById("bossa-comptes");
  if (bossa) bossa.innerHTML = "";
  compteActiu = null;

  totalsBalanc = {
    ANC: 0,
    EXISTENCIES: 0,
    REALITZABLE: 0,
    DISPONIBLE: 0,
    PN: 0,
    PNC: 0,
    PC: 0,
  };

  actualitzarTotalsGenerals();

  // --- 4. GENERACIÓ DE BOTONS ---
  if (dades.comptes && Array.isArray(dades.comptes)) {
    const comptesDesordenats = [...dades.comptes].sort(
      () => Math.random() - 0.5,
    );

    comptesDesordenats.forEach((c) => {
      const btn = document.createElement("button");
      btn.innerHTML = c.nom;
      btn.className =
        "px-3 py-2 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-blue-50 transition-all font-medium text-slate-700 text-[10px]";
      btn.onclick = () => seleccionarBotoBossa(c, btn);
      if (bossa) bossa.appendChild(btn);
    });
  }

  // --- 5. FINALITZACIÓ ---
  actualitzarComptadorBossa();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function seleccionarBotoBossa(compte, btn) {
  // 1. Desmarquem tots els altres botons de la bossa
  document.querySelectorAll("#bossa-comptes button").forEach((b) => {
    b.classList.remove(
      "ring-2",
      "ring-blue-500",
      "bg-blue-50",
      "border-blue-500",
    );
  });

  // 2. Marquem el botó actual com a seleccionat (blau)
  btn.classList.add("ring-2", "ring-blue-500", "bg-blue-50", "border-blue-500");

  // 3. Assignem el compte a la variable que utilitza 'intentarUbicar'
  compteActiu = compte;
}

// Funció auxiliar per no repetir codi HTML
function crearBlocSubgrup(titol, id) {
  return `
    <div onclick="intentarUbicar('${id}')" class="cursor-pointer group bg-white/50 p-2 rounded-lg border border-transparent hover:border-blue-300 transition-all">
      <div class="flex justify-between text-[9px] font-black text-blue-800 uppercase mb-1">
        <span>${titol}</span>
        <span id="total-${id}">0,00 €</span>
      </div>
      <div id="llista-${id}" class="min-h-[10px]"></div>
    </div>
  `;
}

function afegirElementABalanc(compte, massa) {
  const llista = document.getElementById(`llista-${massa}`);
  if (!llista) {
    console.error(`No s'ha trobat el contenidor: llista-${massa}`);
    return;
  }

  // 1. CREACIÓ DE LA FILA VISUAL
  const div = document.createElement("div");
  // Afegim una petita animació d'entrada (animate-in) perquè sigui més dinàmic
  div.className =
    "flex justify-between items-center py-1 border-b border-slate-50 text-[11px] animate-in fade-in slide-in-from-left-2 duration-300";

  div.innerHTML = `
    <span class="text-slate-700">${compte.nom}</span>
    <span class="font-bold text-slate-900">${compte.import.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</span>
  `;
  llista.appendChild(div);

  // 2. ACTUALITZACIÓ DELS TOTALS DE LA MASSA ESPECÍFICA
  // Si la massa és 'EXISTENCIES', sumarà a totalsBalanc.EXISTENCIES, etc.
  if (totalsBalanc.hasOwnProperty(massa)) {
    totalsBalanc[massa] += compte.import;
  } else {
    // Per si de cas arriba una massa que no hem definit a l'objecte inicial
    totalsBalanc[massa] = compte.import;
  }

  // 3. ACTUALITZACIÓ DEL TEXT DEL TOTAL DE LA MASSA
  const displayMassa = document.getElementById(`total-${massa}`);
  if (displayMassa) {
    displayMassa.innerText = `${totalsBalanc[massa].toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`;

    // Feedback visual: un petit saltet al número quan canvia
    displayMassa.classList.add("text-blue-600", "scale-110");
    setTimeout(() => {
      displayMassa.classList.remove("text-blue-600", "scale-110");
    }, 300);
  }

  // 4. RECALCULAR TOTALS GENERALS
  // Aquesta funció sumarà (ANC + EXISTENCIES + REALITZABLE + DISPONIBLE) per a l'Actiu
  actualitzarTotalsGenerals();
}

function eliminarBotoDeBossa(nomCompte) {
  const botons = document.querySelectorAll("#bossa-comptes button");
  botons.forEach((b) => {
    if (b.innerText === nomCompte) b.remove();
  });
}

function actualitzarTotalsGenerals() {
  // 1. Sumem les 3 subcategories per obtenir el total de l'Actiu Corrent
  const totalAC =
    (totalsBalanc.EXISTENCIES || 0) +
    (totalsBalanc.REALITZABLE || 0) +
    (totalsBalanc.DISPONIBLE || 0);

  const totalActiu = (totalsBalanc.ANC || 0) + totalAC;
  const totalPassiuNet =
    (totalsBalanc.PN || 0) + (totalsBalanc.PNC || 0) + (totalsBalanc.PC || 0);

  const elTotalAC = document.getElementById("total-AC"); // El títol del bloc blau
  const elTotalActiu = document.getElementById("total-actiu-final");
  const elTotalPassiu = document.getElementById("total-passiu-final");

  if (elTotalAC)
    elTotalAC.innerText = `${totalAC.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`;
  if (elTotalActiu)
    elTotalActiu.innerText = `${totalActiu.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`;
  if (elTotalPassiu)
    elTotalPassiu.innerText = `${totalPassiuNet.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`;

  // Canvi de color si quadra
  if (totalActiu > 0 && Math.abs(totalActiu - totalPassiuNet) < 0.1) {
    elTotalActiu.classList.add("text-green-600");
    elTotalPassiu.classList.add("text-green-600");
  }
}

function intentarUbicar(massaDesti) {
  // 1. Validació de selecció prèvia
  if (!compteActiu) {
    // Si la teva funció mostrarFeedback no està definida, usa alert
    alert("Primer tria un compte de la bossa!");
    return;
  }

  // NORMALITZACIÓ: Per si a l'Excel posa EXISTENCIAS i al clic enviem EXISTENCIES
  let catExcel = compteActiu.categoria.toUpperCase().trim();
  if (catExcel === "EXISTENCIAS") catExcel = "EXISTENCIES";

  // 2. Comprovació de la categoria
  if (catExcel === massaDesti) {
    // --- ACCIÓ CORRECTA ---
    afegirElementABalanc(compteActiu, massaDesti);
    eliminarBotoDeBossa(compteActiu.nom);
    actualitzarComptadorBossa();

    const restants = document.querySelectorAll("#bossa-comptes button").length;
    if (restants === 0) {
      setTimeout(() => {
        mostrarZonaCalculsFinals();
      }, 500);
    }

    compteActiu = null; // Netegem selecció
  } else {
    // --- ERROR D'UBICACIÓ ---
    // Aquest és el missatge que veies a la pantalla.
    // Si et surt "no pertany a la massa: AC", és que el botó HTML té 'AC' en el seu onclick.
    let missatgeError = `Incorrecte. El compte "${compteActiu.nom}" (que és ${catExcel}) no es col·loca a ${massaDesti}.`;

    const llistaSubgrups = [
      "EXISTENCIES",
      "EXISTENCIAS",
      "REALITZABLE",
      "DISPONIBLE",
    ];
    const esAC = llistaSubgrups.includes(catExcel);
    const destiEsAC = llistaSubgrups.includes(massaDesti);

    if (esAC && destiEsAC) {
      missatgeError +=
        "\n\n💡 Pista: És un Actiu Corrent, però recorda separar entre el que són estocs (Existències), factures pendents (Realitzable) o diners líquids (Disponible).";
    }

    alert(missatgeError);
    // NOTA: No fem compteActiu = null aquí perquè l'alumne no hagi de tornar a clicar el botó blau.
  }
}

// Ratios de tresoraría a actualitzar

function mostrarModulRatios() {
  const modul = document.getElementById("modul-ratios");
  modul.classList.remove("hidden");
  modul.scrollIntoView({ behavior: "smooth" });
}

function mostrarZonaCalculsFinals() {
  const zonaCalculs = document.getElementById("zona-calculs-balanc");
  if (!zonaCalculs) return;

  zonaCalculs.classList.remove("hidden");

  // Injectem el disseny dels 4 ràtios
  zonaCalculs.innerHTML = `
    <h3 class="text-2xl font-black mb-6 text-slate-800 border-b pb-4 italic uppercase tracking-tighter">
        Anàlisi de Solvència i Liquiditat
    </h3>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        ${crearCampRatio("Fons de Maniobra", "Actiu Corrent - Passiu Corrent", "fm")}
        ${crearCampRatio("Ràtio de Solvència", "Actiu Corrent / Passiu Corrent", "solvencia")}
        ${crearCampRatio("Ràtio de Tresoreria", "(Realitzable + Disponible) / Passiu Corrent", "tresoreria")}
        ${crearCampRatio("Ràtio de Disponibilitat", "Disponible / Passiu Corrent", "disponibilitat")}
    </div>
    <div class="mt-8 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            * Introdueix els resultats i prem validar per finalitzar l'exercici
        </p>
    </div>
  `;

  zonaCalculs.scrollIntoView({ behavior: "smooth" });
}

function crearCampRatio(titol, formula, id) {
  return `
    <div class="space-y-2 p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
        <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">${titol}</p>
        <p class="text-[9px] text-blue-500 font-medium mb-2">${formula}</p>
        <div class="flex gap-2">
            <input type="number" 
                   id="calc-${id}" 
                   step="0.01" 
                   inputmode="decimal" 
                   class="w-full p-2 rounded-lg border border-slate-200 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" 
                   placeholder="0.00">
            <button onclick="validarResultatRatio('${id}')" 
                    class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-colors">
                Validar
            </button>
        </div>
    </div>
  `;
}

async function validarResultatRatio(id) {
  const input = document.getElementById(`calc-${id}`);
  if (!input || !input.value) return;

  const valorAlumne = parseFloat(input.value);
  const op = exerciciActual[pasActual];

  // 1. CÀLCULS LOCALS (Sumant els 3 subgrups)
  const existencies = totalsBalanc.EXISTENCIES || 0;
  const realitzable = totalsBalanc.REALITZABLE || 0;
  const disponible = totalsBalanc.DISPONIBLE || 0;

  const AC = existencies + realitzable + disponible;
  const PC = totalsBalanc.PC || 0;
  const ANC = totalsBalanc.ANC || 0;
  const PNC = totalsBalanc.PNC || 0;

  let valorCorrecte = 0;
  if (id === "fm") valorCorrecte = AC - PC;
  if (id === "solvencia") valorCorrecte = AC / PC;
  if (id === "tresoreria") valorCorrecte = (realitzable + disponible) / PC;
  if (id === "disponibilitat") valorCorrecte = disponible / PC;

  // 2. VALIDACIÓ
  input.classList.remove(
    "border-green-500",
    "bg-green-50",
    "border-red-500",
    "bg-red-50",
  );

  if (Math.abs(valorAlumne - valorCorrecte) < 0.05) {
    input.classList.add("border-green-500", "bg-green-50");
    input.disabled = true;

    // COMPROVACIÓ: Som al final?
    const totsInputs = document.querySelectorAll(
      '#zona-calculs-balanc input[type="number"]',
    );
    const encertats = Array.from(totsInputs).filter(
      (inp) => inp.disabled,
    ).length;

    if (encertats === totsInputs.length) {
      // ÈXIT FINAL (Només aquí enviem dades al Sheet)
      mostrarExitGamificat("BALANÇ COMPLETAT", 50);

      // Fem el registre de forma silenciosa per no interrompre l'usuari
      registrarProgresAritmetic(50, op.exercici, op.id_op).then(() => {
        generarMenuExercicis(); // Actualitza el menú lateral (el check verd)
      });

      // Afegim missatge visual sense recarregar
      const zona = document.getElementById("zona-calculs-balanc");
      if (!document.getElementById("msg-final")) {
        const div = document.createElement("div");
        div.id = "msg-final";
        div.className =
          "mt-6 p-4 bg-green-500 text-white rounded-2xl text-center font-bold animate-bounce";
        div.innerText = "🎉 EXERCICI COMPLETAT AMB ÈXIT!";
        zona.appendChild(div);
      }
    } else {
      // Feedback ràpid sense tancar res
      mostrarFeedback(`Ràtio ${id.toUpperCase()} correcte`, "success");
    }
  } else {
    input.classList.add("border-red-500", "bg-red-50");
    mostrarFeedback("Càlcul incorrecte", "error");
  }
}

// Funció complementària per enviar les dades al teu code.gs
async function registrarProgresAritmetic(punts, nomEx, idOp) {
  // 1. Verificació de seguretat
  if (!usuariSessio.nom || usuariSessio.nom === "Convidat") return;

  const dades = {
    accio: "actualitzarProgres",
    usuari: usuariSessio.nom,
    exercici: nomEx,
    id_op: idOp,
    punts: punts,
    data: new Date().toLocaleString("ca-ES"),
  };

  try {
    // 2. Enviament al Google Sheet (Backend)
    // Nota: El mode 'no-cors' no permet llegir la resposta, però envia la dada.
    fetch(SHEET_URL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify(dades),
    });

    // --- ACTUALITZACIÓ DE MARCADORS VISUALS ---
    // (Els punts ja s'han sumat a validarPas, així que només actualitzem els textos)

    const marcadorPuntsNav = document.getElementById("punts-total");
    const marcadorPuntsWelcome = document.getElementById(
      "punts-display-welcome",
    );

    if (marcadorPuntsNav) marcadorPuntsNav.innerText = usuariSessio.punts;
    if (marcadorPuntsWelcome)
      marcadorPuntsWelcome.innerText = usuariSessio.punts;

    // Actualitzem el comptador de "Tasques Completades"
    const marcadorTasques = document.getElementById(
      "completats-display-welcome",
    );
    if (marcadorTasques && estat.dadesGlobals.progres) {
      const totalFet = estat.dadesGlobals.progres.filter(
        (p) =>
          p.Usuari.toString().toLowerCase() ===
          usuariSessio.nom.toString().toLowerCase(),
      ).length;
      marcadorTasques.innerText = totalFet;
    }

    // El generarMenuExercicis() i el reconstruirEstatUsuari()
    // ja es criden des de validarPas(), així que aquí ja no calen.
  } catch (error) {
    console.error("Error en el registre de progrés:", error);
  }
}

// Funció extra per donar feedback final
function comprovarFinalitzacioRatios() {
  const totsCorrectes = Array.from(
    document.querySelectorAll('[id^="calc-"]'),
  ).every((input) => input.classList.contains("border-green-500"));

  if (totsCorrectes) {
    alert("Felicilitats! Has completat l'Anàlisi de Solvència correctament.");
    // Aquí podries mostrar un botó de "Següent Exercici"
  }
}

// --- BALANÇ Interactiu -----

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

//------------ Ranking i Progress ---------------

async function registrarExit(nomExercici, puntsGuanyats) {
  const dades = {
    tipus: "actualitzarPunts",
    usuari: usuariLoguejat.nom, // El nom que hagi posat al login
    exercici: nomExercici,
    pas: "Finalitzat correctament",
    punts: puntsGuanyats,
  };

  // Feedback visual immediat tipus "Medalla"
  mostrarNotificacioPunts(puntsGuanyats);

  try {
    await fetch(WEB_APP_URL, {
      // La URL del teu script desplegat
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify(dades),
    });
  } catch (error) {
    console.error("Error guardant el progrés:", error);
  }
}

function mostrarNotificacioPunts(punts) {
  const div = document.createElement("div");
  div.className =
    "fixed top-10 right-10 bg-yellow-400 text-slate-900 px-6 py-4 rounded-3xl font-black shadow-2xl animate-bounce z-50 flex items-center gap-3";
  div.innerHTML = `<span>🏆</span> +${punts} PUNTS!`;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

function renderitzarTargetaProgres(titol, totalExercicis, completats) {
  const percentatge = (completats / totalExercicis) * 100;
  const isFinalitzat = percentatge === 100;

  return `
    <div class="bg-white p-6 rounded-[32px] border border-emerald-100 shadow-sm mb-4">
      <div class="flex justify-between items-center mb-2">
        <div class="flex items-center gap-2">
          <span class="text-xs font-black text-slate-700 uppercase tracking-tighter">${titol}</span>
          ${isFinalitzat ? '<span class="bg-emerald-500 text-white text-[8px] px-2 py-0.5 rounded-full font-bold">FINALITZAT</span>' : ""}
        </div>
      </div>
      <div class="flex items-baseline gap-2">
        <span class="text-4xl font-black text-slate-800">${Math.round(percentatge)}%</span>
        <span class="text-xl">🏆</span>
      </div>
      <div class="w-full bg-slate-100 h-2.5 rounded-full mt-4 overflow-hidden">
        <div class="bg-emerald-500 h-full transition-all duration-1000" style="width: ${percentatge}%"></div>
      </div>
      <p class="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-widest">${completats} / ${totalExercicis} Exercicis</p>
    </div>
  `;
}

async function enviarPuntsAlSheet(puntsGuanyats, nomEx) {
  const dades = {
    accio: "actualitzarProgres",
    usuari: nomUsuariActual, // La variable on guardis el nom de qui ha fet login
    exercici: nomEx,
    punts: puntsGuanyats,
    pas: "Ràtios Completats",
  };

  try {
    await fetch(URL_DE_LA_TEVA_WEB_APP, {
      method: "POST",
      body: JSON.stringify(dades),
    });
    console.log("Punts enviats correctament!");
  } catch (e) {
    console.error("Error en enviar punts", e);
  }
}

//---- Mostrar exit gamificat .----

function mostrarExitGamificat(titol, punts) {
  const modal = document.getElementById("modal-exit");
  if (!modal) return;

  // Personalitzem el text del modal abans de mostrar-lo
  const h3 = modal.querySelector("h3");
  const p = modal.querySelector("p");

  if (h3) h3.innerText = `${titol} CORRECTE!`;
  if (p) p.innerText = `+${punts} Punts d'Experiència`;

  modal.classList.remove("hidden");
}

// 1. La funció que tanca el modal ara és qui decideix què ve després
function tancarModalExit() {
  const modal = document.getElementById("modal-exit");
  if (modal) {
    modal.classList.add("hidden");
  }
}

//---- Mostrar Ranking .----

// --- FUNCIONS DEL HALL OF FAME (RÀNQUING) ---

// 1. Variable global per a la memòria cau
let dadesRanquingCache = null;

// 2. Funció principal (Híbrida: funciona a Google i en Local)
async function mostrarRankingGlobal(filtreGrup = "Tots") {
  // Amaguem altres seccions
  const seccions = [
    "benvinguda-app",
    "zona-exercici",
    "zona-balanc",
    "zona-calculs-balanc",
  ];
  seccions.forEach((id) =>
    document.getElementById(id)?.classList.add("hidden"),
  );

  const container = document.getElementById("zona-ranking");
  if (!container) return;
  container.classList.remove("hidden");

  // Títol del Header
  const titolHeader = document.getElementById("titol-operacio-text");
  if (titolHeader) titolHeader.innerText = "Classificació General";

  // Mostrem loader si no hi ha dades a la memòria cau
  if (!dadesRanquingCache) {
    container.innerHTML = `
            <div class="flex flex-col items-center justify-center p-20 space-y-4">
                <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                <p class="font-bold text-slate-400 uppercase text-[10px] tracking-widest text-center">Sincronitzant dades...</p>
            </div>`;
  }

  try {
    // --- OBTENCIÓ DE DADES ---
    if (!dadesRanquingCache) {
      if (typeof google !== "undefined" && google.script && google.script.run) {
        // ENTORN GOOGLE: Cridem la funció del servidor
        await new Promise((resolve) => {
          google.script.run
            .withSuccessHandler((data) => {
              // Si la resposta és l'objecte global, agafem la llista d'usuaris
              dadesRanquingCache = Array.isArray(data)
                ? data
                : data.usuaris || [];
              resolve();
            })
            .obtenirRankingAlumnes();
        });
      } else {
        // ENTORN LOCAL (Live Server): Fem servir fetch
        const res = await fetch(`${SHEET_URL}?action=obtenirRanquing`);
        const json = await res.json();
        // Ens assegurem de guardar una llista (Array)
        dadesRanquingCache = Array.isArray(json) ? json : json.usuaris || [];
      }
    }

    // --- VALIDACIÓ DE SEGURETAT ---
    // Si per algun motiu dadesRanquingCache no és una llista, la forcem a buida per evitar errors de .filter
    const llistaFinal = Array.isArray(dadesRanquingCache)
      ? dadesRanquingCache
      : [];

    // --- FILTRATGE ---
    const NOM_A_EXCLOURE = "xavier";
    let companys = llistaFinal.filter((c) => {
      if (!c || !c.nom) return false;
      const nomFila = String(c.nom).toLowerCase().trim();
      if (nomFila === NOM_A_EXCLOURE) return false;
      if (filtreGrup !== "Tots") return c.grup === filtreGrup;
      return true;
    });

    // Càlcul de medalles basat en punts únics
    const puntsUnics = [
      ...new Set(companys.map((c) => parseInt(c.punts || 0))),
    ].sort((a, b) => b - a);

    const puntsOr = puntsUnics[0] || -1;
    const puntsPlata = puntsUnics[1] || -1;
    const puntsBronze = puntsUnics[2] || -1;

    // --- RENDERITZAT ---
    const botonsHtml = `
            <div class="flex flex-col items-center mb-10 animate-in fade-in duration-500">
                <div class="flex justify-center gap-2 mb-4">
                    <button onclick="mostrarRankingGlobal('Tots')" class="px-4 py-2 rounded-xl text-[10px] font-black uppercase border ${filtreGrup === "Tots" ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"}">Tots</button>
                    <button onclick="mostrarRankingGlobal('Grup A')" class="px-4 py-2 rounded-xl text-[10px] font-black uppercase border ${filtreGrup === "Grup A" ? "bg-amber-500 text-white border-amber-500 shadow-sm" : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"}">Grup A</button>
                    <button onclick="mostrarRankingGlobal('Grup B')" class="px-4 py-2 rounded-xl text-[10px] font-black uppercase border ${filtreGrup === "Grup B" ? "bg-emerald-500 text-white border-emerald-500 shadow-sm" : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"}">Grup B</button>
                </div>
                <button onclick="refrescarDadesRanquing()" class="text-[9px] font-bold text-slate-400 hover:text-blue-600 uppercase tracking-widest transition-all">
                    🔄 Sincronitzar dades reals
                </button>
            </div>`;

    const llistaHtml =
      companys.length > 0
        ? companys
            .map((c, i) => {
              const p = parseInt(c.punts || 0);
              let medal = i + 1;
              let bgClass = "bg-white border-slate-100";
              let medalClass = "bg-slate-50 text-slate-400 w-10 h-10 text-xs";

              if (p > 0) {
                if (p === puntsOr) {
                  medal = "🥇";
                  bgClass =
                    "bg-gradient-to-r from-amber-50 to-white border-amber-200";
                  medalClass = "bg-white shadow-sm w-12 h-12 text-2xl";
                } else if (p === puntsPlata) {
                  medal = "🥈";
                  bgClass =
                    "bg-gradient-to-r from-slate-50 to-white border-slate-200";
                  medalClass = "bg-white shadow-sm w-11 h-11 text-xl";
                } else if (p === puntsBronze) {
                  medal = "🥉";
                  bgClass =
                    "bg-gradient-to-r from-orange-50 to-white border-orange-200";
                  medalClass = "bg-white shadow-sm w-11 h-11 text-xl";
                }
              }

              return `
            <div class="flex items-center justify-between p-4 rounded-2xl border-2 mb-3 transition-all hover:scale-[1.01] ${bgClass} shadow-sm">
                <div class="flex items-center gap-4">
                    <div class="flex items-center justify-center rounded-xl font-black ${medalClass}">${medal}</div>
                    <div>
                        <p class="font-black text-slate-800 uppercase text-xs tracking-tight">${c.nom}</p>
                        <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest">${c.grup}</p>
                    </div>
                </div>
                <div class="text-right">
                    <span class="text-sm font-black text-blue-700 px-3 py-1 bg-white rounded-lg border shadow-sm">${p.toLocaleString()} <span class="text-[8px] ml-0.5">PTS</span></span>
                </div>
            </div>`;
            })
            .join("")
        : `<p class="text-center text-slate-400 py-10 italic">No s'han trobat dades per a aquest grup.</p>`;

    container.innerHTML = `
            <div class="max-w-2xl mx-auto p-4">
                ${botonsHtml}
                <div class="text-center mb-8">
                    <h2 class="text-3xl font-black text-slate-800 uppercase italic tracking-tighter">Hall of Fame</h2>
                    <p class="text-[9px] font-bold text-blue-500 uppercase tracking-[0.3em]">Tresoreria 2026</p>
                </div>
                <div class="animate-in fade-in slide-in-from-bottom-4 duration-700">${llistaHtml}</div>
            </div>`;
  } catch (e) {
    console.error("Error al rànquing:", e);
    container.innerHTML = `<div class="p-10 text-center text-red-500 font-bold bg-red-50 rounded-3xl border border-red-100">
        <p>Error de sincronització</p>
        <p class="text-[10px] font-normal mt-2">${e.message}</p>
        <button onclick="refrescarDadesRanquing()" class="mt-4 text-xs underline">Torna-ho a provar</button>
    </div>`;
  }
}

async function refrescarDadesRanquing() {
  dadesRanquingCache = null;
  await mostrarRankingGlobal("Tots");
}
