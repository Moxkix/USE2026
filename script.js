  // Versión actualizada para 2026:
  //   - Muestra día y hora junto con el aula
  //   - Soporta ?codigos=A,B,C en la URL para mostrar varios resultados de una vez (QR personalizado)
  //   - Mantiene retrocompatibilidad con el formato JSON original
  //   - Renderizado seguro vía DOM API + validación de códigos: el contenido
  //     dinámico (URL y JSON) NUNCA entra al DOM como HTML, solo como texto.

  // ── Beacon a Cloudflare Worker (estadísticas agregadas anónimas) ─────
  // El Worker no almacena el body ni eventos individuales; sólo cuenta
  // scans diarios + HyperLogLog de dispositivos únicos en memoria.
  const QR_LOG_URL = "https://qr-log-tribunal.moxkix.workers.dev";

  (function enviarBeacon() {
    if (!QR_LOG_URL) return;
    try {
      fetch(QR_LOG_URL.replace(/\/$/, "") + "/scan", {
        method: "POST",
        keepalive: true,
      }).catch(() => {});
    } catch (e) { /* silencio: si falla el log no impedimos la consulta */ }
  })();

  // Formato esperado de los códigos: alfanumérico mayúscula, 2-12 caracteres.
  // Cualquier cosa fuera de este patrón (HTML, scripts, símbolos) se rechaza
  // como código no encontrado, sin tocar el DOM.
  const REGEX_CODIGO = /^[A-Z0-9]{2,12}$/;

  let CACHE_DATA = null;

  async function cargarDatos() {
    if (CACHE_DATA) return CACHE_DATA;
    const response = await fetch('asignaturas_aulas.json');
    CACHE_DATA = await response.json();
    return CACHE_DATA;
  }

  function bilingue(es, eu) {
    if (!es && !eu) return '';
    if (es === eu || !eu) return es ?? '';
    return `${es} / ${eu}`;
  }

  // Crea un <div class="linea"> con etiqueta + valor, sin inyectar HTML.
  function crearLinea(etiqueta, valor, valorEnStrong) {
    const div = document.createElement('div');
    div.className = 'linea';
    const span = document.createElement('span');
    span.className = 'et';
    span.textContent = etiqueta;
    div.appendChild(span);
    div.appendChild(document.createTextNode(' '));
    if (valorEnStrong) {
      const strong = document.createElement('strong');
      strong.textContent = valor;
      div.appendChild(strong);
    } else {
      div.appendChild(document.createTextNode(valor));
    }
    return div;
  }

  function renderResultado(codigo, entry) {
    const card = document.createElement('div');
    card.className = 'card';

    // Línea de código (estilo distinto, mantiene .codigo del CSS)
    const codDiv = document.createElement('div');
    codDiv.className = 'codigo';
    codDiv.appendChild(document.createTextNode('Código / Kodea: '));
    const codStrong = document.createElement('strong');
    codStrong.textContent = codigo;
    codDiv.appendChild(codStrong);
    card.appendChild(codDiv);

    const asig = bilingue(entry.asignatura_es, entry.asignatura_eu);
    const aula = bilingue(entry.aula_es, entry.aula_eu);
    const dia = bilingue(entry.dia_es, entry.dia_eu);
    const hora = entry.hora_inicio && entry.hora_fin
      ? `${entry.hora_inicio}–${entry.hora_fin}`
      : '';

    card.appendChild(crearLinea('Asignatura / Irakasgaia:', asig, true));
    card.appendChild(crearLinea('Aula / Gela:', aula, true));
    if (dia) card.appendChild(crearLinea('Día / Eguna:', dia, false));
    if (hora) card.appendChild(crearLinea('Hora / Ordua:', hora, false));

    return card;
  }

  async function mostrarResultados(codigos) {
    const resultDiv = document.getElementById('result');
    // Limpieza segura: removeChild en bucle (no innerHTML='')
    while (resultDiv.firstChild) resultDiv.removeChild(resultDiv.firstChild);

    if (codigos.length === 0) {
      resultDiv.textContent = 'Mesedez, sartu irakasgai baten kodea / Por favor, introduce un código de asignatura';
      return;
    }
    try {
      const data = await cargarDatos();
      const nodos = [];
      const noEncontrados = [];
      for (const codBruto of codigos) {
        const cod = String(codBruto).toUpperCase().trim();
        // Si el código no cumple el patrón, ni siquiera consultamos el JSON.
        if (!REGEX_CODIGO.test(cod)) {
          noEncontrados.push(codBruto);
          continue;
        }
        const entry = data[cod];
        if (entry) nodos.push(renderResultado(cod, entry));
        else noEncontrados.push(codBruto);
      }
      if (nodos.length === 0) {
        resultDiv.textContent = 'Irakasgaiaren kodea ez da aurkitu / Código de asignatura no encontrado';
        return;
      }
      for (const n of nodos) resultDiv.appendChild(n);

      if (noEncontrados.length > 0) {
        const aviso = document.createElement('div');
        aviso.className = 'aviso';
        // textContent escapa automáticamente; los códigos no se interpretan como HTML
        aviso.textContent =
          'Códigos no encontrados / Aurkitu gabeko kodeak: ' + noEncontrados.join(', ');
        resultDiv.appendChild(aviso);
      }
    } catch (error) {
      console.error(error);
      resultDiv.textContent = 'Errorea datuak kontsultatzerakoan / Error al consultar los datos';
    }
  }

  // Búsqueda manual desde el input
  async function findClassroom() {
    const courseCode = document.getElementById('courseCode').value;
    await mostrarResultados([courseCode]);
  }

  // Lectura inicial: si hay ?codigos=A,B,C en la URL, busca todos
  async function mostrarDesdeUrl() {
    const params = new URLSearchParams(window.location.search);
    const cod = params.get('codigos') ?? params.get('codigo'); // singular legacy
    if (!cod) return;
    const codigos = cod.split(',').map((s) => s.trim()).filter(Boolean);
    if (codigos.length === 0) return;
    await mostrarResultados(codigos);
  }

  // Counter (modo admin) — mantenido del año pasado
  async function updateCounter() {
    const counterDiv = document.getElementById('counter');
    if (!counterDiv) return;
    if (!isAdmin()) {
      counterDiv.style.display = 'none';
      return;
    }
    counterDiv.style.display = 'block';
    try {
      const response = await fetch('https://api.counterapi.dev/v1/use2025.github.io/visitas/up');
      const data = await response.json();
      counterDiv.textContent = `Visitas: ${data.Count}`;
    } catch (error) {
      console.error('Error al actualizar el contador', error);
      counterDiv.textContent = 'No se pudo actualizar el contador';
    }
  }

  function isAdmin() {
    return new URLSearchParams(window.location.search).get('admin') === '1';
  }

  document.addEventListener('DOMContentLoaded', () => {
    updateCounter();
    mostrarDesdeUrl();
    // Permite Enter en el input
    const input = document.getElementById('courseCode');
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') findClassroom();
      });
    }
  });
