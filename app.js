const $ = (s, r = document) => r.querySelector(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = n => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);
const fecha = s => s ? new Date(s.length === 10 ? s + "T00:00" : s).toLocaleDateString("es-CO") : "—";
const fechaHora = s => new Date(s).toLocaleString("es-CO");
const hoy = () => new Date().toLocaleDateString("en-CA");
const manana = () => new Date(Date.now() + 864e5).toLocaleDateString("en-CA");

const ESTADOS = ["Orden creada", "Enviada al laboratorio", "En producción", "Recibida", "Control de calidad", "Lista para entrega", "Entregada"];
const PAGOS = ["Efectivo", "Tarjeta", "Transferencia"];
const ROLES = ["Administrador", "Optómetra", "Vendedor", "Auxiliar"];
const TABLAS = ["clientes", "productos", "ventas", "ordenes", "proveedores", "citas", "historias_optometricas", "formulas", "movimientos_inventario", "seguimiento_ordenes", "perfiles"];
const MENU = [["dashboard", "Resumen"], ["clientes", "Clientes"], ["historias", "Historia optométrica"], ["citas", "Citas"], ["productos", "Productos"], ["inventario", "Inventario"], ["ventas", "Ventas"], ["ordenes", "Órdenes"], ["proveedores", "Proveedores"], ["usuarios", "Usuarios"]];
const PERM = {
  Administrador: MENU.map(m => m[0]),
  "Optómetra": ["dashboard", "clientes", "historias", "citas"],
  Vendedor: ["dashboard", "clientes", "productos", "ventas"],
  Auxiliar: ["dashboard", "productos", "inventario", "ventas", "ordenes", "proveedores"]
};
const REQ = new Set(["nombre", "documento", "codigo", "fecha", "hora", "cliente_id", "producto_id", "profesional", "cantidad"]);

// Campos: [clave, etiqueta, tipo, opciones]. Tipos: text tel email textarea date time number int dec select ref
const ENT = {
  clientes: {
    titulo: "Clientes", nuevo: "Nuevo cliente", ficha: true,
    cols: ["documento", "nombre", "telefono", "correo"],
    campos: [["documento", "Documento", "text"], ["nombre", "Nombre completo", "text"], ["fecha_nacimiento", "Fecha de nacimiento", "date"], ["telefono", "Teléfono", "tel"], ["correo", "Correo", "email"], ["direccion", "Dirección", "text"], ["observaciones", "Observaciones", "textarea"]]
  },
  productos: {
    titulo: "Productos", nuevo: "Nuevo producto",
    cols: ["codigo", "nombre", "categoria", "precio", "existencias"],
    campos: [["codigo", "Código", "text"], ["nombre", "Nombre", "text"], ["categoria", "Categoría", "select", ["Montura", "Lente", "Accesorio"]], ["marca", "Marca", "text"], ["modelo", "Modelo", "text"], ["descripcion", "Descripción", "text"], ["proveedor_id", "Proveedor", "ref", "proveedores"], ["precio", "Precio", "number"], ["existencias", "Existencias", "number"], ["stock_minimo", "Stock mínimo", "number"]]
  },
  proveedores: {
    titulo: "Proveedores", nuevo: "Nuevo proveedor",
    cols: ["nombre", "nit", "contacto", "telefono", "correo"],
    campos: [["nombre", "Nombre", "text"], ["nit", "NIT", "text"], ["contacto", "Contacto", "text"], ["telefono", "Teléfono", "tel"], ["correo", "Correo", "email"], ["direccion", "Dirección", "text"]]
  },
  citas: {
    titulo: "Citas", nuevo: "Nueva cita",
    cols: ["fecha", "hora", "cliente_id", "profesional", "estado"],
    campos: [["cliente_id", "Cliente", "ref", "clientes"], ["profesional", "Profesional", "text"], ["fecha", "Fecha", "date"], ["hora", "Hora", "time"], ["motivo", "Motivo", "text"], ["estado", "Estado", "select", ["Programada", "Atendida", "Cancelada"]]],
    validar: (d, id) => cache.citas.some(c => c.id != id && c.profesional === d.profesional && c.fecha === d.fecha && (c.hora || "").slice(0, 5) === d.hora) ? "Ese profesional ya tiene una cita a esa hora." : null
  },
  historias_optometricas: {
    titulo: "Historias optométricas", nuevo: "Nueva consulta", soloAgregar: true,
    cols: ["fecha", "cliente_id", "optometra", "motivo_consulta", "tipo_lente"],
    campos: [["cliente_id", "Cliente", "ref", "clientes"], ["fecha", "Fecha", "date"], ["optometra", "Optómetra", "text"], ["motivo_consulta", "Motivo de consulta", "text"], ["antecedentes", "Antecedentes", "textarea"], ["agudeza_visual", "Agudeza visual", "text"], ["dp", "DP", "dec"], ["altura", "Altura", "dec"], ["tipo_lente", "Tipo de lente recomendado", "text"], ["observaciones", "Observaciones", "textarea"]]
  },
  formulas: {
    titulo: "Fórmulas", nuevo: "Nueva fórmula", soloAgregar: true,
    cols: ["created_at", "cliente_id", "tipo", "od_esfera", "od_cilindro", "od_eje", "oi_esfera", "oi_cilindro", "oi_eje", "adicion"],
    campos: [["cliente_id", "Cliente", "ref", "clientes"], ["tipo", "Tipo", "select", ["Lejos", "Próxima"]], ["od_esfera", "OD esfera", "dec"], ["od_cilindro", "OD cilindro", "dec"], ["od_eje", "OD eje", "int"], ["oi_esfera", "OI esfera", "dec"], ["oi_cilindro", "OI cilindro", "dec"], ["oi_eje", "OI eje", "int"], ["adicion", "Adición", "dec"]]
  },
  movimientos_inventario: {
    titulo: "Movimientos de inventario", nuevo: "Nuevo movimiento", soloAgregar: true,
    cols: ["created_at", "producto_id", "tipo", "cantidad", "motivo"],
    campos: [["producto_id", "Producto", "ref", "productos"], ["tipo", "Tipo (Ajuste fija el total)", "select", ["Entrada", "Salida", "Ajuste"]], ["cantidad", "Cantidad", "number"], ["motivo", "Motivo", "text"]],
    async aplicar(d) {
      const p = cache.productos.find(x => x.id == d.producto_id);
      const n = d.tipo === "Entrada" ? p.existencias + d.cantidad : d.tipo === "Salida" ? p.existencias - d.cantidad : d.cantidad;
      if (n < 0) throw new Error(`Solo hay ${p.existencias} unidades de ${p.nombre}.`);
      await DB.update("productos", p.id, { existencias: n });
    }
  }
};

let cache = {}, actual = "dashboard", rol = "Vendedor";

const cargar = async () => { for (const t of TABLAS) cache[t] = await DB.list(t); };
const nombre = (t, id) => cache[t].find(r => r.id == id)?.nombre ?? "—";
const etiqueta = (n, c) => ENT[n].campos.find(f => f[0] === c)?.[1] ?? "Registrado";
const corto = id => "#" + String(id).slice(-5);

function toast(msg, error) {
  const t = $("#toast"); t.textContent = msg; t.className = "toast ver" + (error ? " error" : "");
  clearTimeout(toast.id); toast.id = setTimeout(() => t.className = "toast", 3500);
}

function celda(n, r, c) {
  const f = ENT[n].campos.find(x => x[0] === c);
  if (c === "created_at") return fecha(r.created_at);
  if (f?.[2] === "ref") return esc(nombre(f[3], r[c]));
  if (f?.[2] === "date") return fecha(r[c]);
  if (c === "hora") return esc((r.hora || "").slice(0, 5));
  if (c === "precio") return money(r.precio);
  if (c === "existencias") {
    const cls = r.existencias <= 0 ? "agotado" : r.existencias <= (r.stock_minimo || 0) ? "bajo" : "";
    return `<span class="badge ${cls}">${r.existencias <= 0 ? "Agotado" : r.existencias}</span>`;
  }
  return esc(r[c]);
}

function tabla(n) {
  const e = ENT[n];
  const acc = r => (e.ficha ? `<button class="link" data-ficha="${r.id}">Ficha</button>` : "") +
    (e.soloAgregar ? "" : `<button class="link" data-edit="${n}:${r.id}">Editar</button><button class="link peligro" data-del="${n}:${r.id}">Eliminar</button>`);
  const filas = cache[n].map(r => `<tr>${e.cols.map(c => `<td>${celda(n, r, c)}</td>`).join("")}<td class="acc">${acc(r)}</td></tr>`).join("");
  return `<div class="barra"><h2>${e.titulo}</h2><button class="btn" data-nuevo="${n}">${e.nuevo}</button></div>
  <div class="tabla-wrap"><table><thead><tr>${e.cols.map(c => `<th>${etiqueta(n, c)}</th>`).join("")}<th></th></tr></thead>
  <tbody>${filas || `<tr><td class="vacio" colspan="${e.cols.length + 1}">Aún no hay registros. Usa «${e.nuevo}» para crear el primero.</td></tr>`}</tbody></table></div>`;
}

function avisos() {
  const a = [];
  cache.ordenes.filter(o => o.estado === "Lista para entrega").forEach(o => a.push(`Orden ${corto(o.id)} de ${nombre("clientes", o.cliente_id)} lista para entrega.`));
  cache.ordenes.filter(o => o.estado === "Recibida").forEach(o => a.push(`Orden ${corto(o.id)} de ${nombre("clientes", o.cliente_id)} recibida del laboratorio.`));
  cache.citas.filter(c => c.estado === "Programada" && [hoy(), manana()].includes(c.fecha)).forEach(c => a.push(`Cita ${c.fecha === hoy() ? "hoy" : "mañana"} ${(c.hora || "").slice(0, 5)}: ${nombre("clientes", c.cliente_id)} con ${c.profesional}.`));
  cache.productos.filter(p => p.existencias <= (p.stock_minimo || 0)).forEach(p => a.push(`Bajo inventario: ${p.nombre} (${p.existencias} en stock).`));
  return a;
}

const VISTAS = {
  dashboard() {
    const mes = hoy().slice(0, 7);
    const ventasMes = cache.ventas.filter(v => (v.created_at || "").startsWith(mes)).reduce((s, v) => s + Number(v.total), 0);
    const abiertas = cache.ordenes.filter(o => o.estado !== "Entregada").length;
    const bajos = cache.productos.filter(p => p.existencias <= (p.stock_minimo || 0)).length;
    const citasHoy = cache.citas.filter(c => c.fecha === hoy() && c.estado === "Programada").length;
    const av = avisos();
    return `<div class="barra"><h2>Resumen</h2></div>
    <div class="cifras">
      <div class="cifra"><b>${cache.clientes.length}</b><span>Clientes</span></div>
      <div class="cifra"><b>${money(ventasMes)}</b><span>Ventas del mes</span></div>
      <div class="cifra"><b>${abiertas}</b><span>Órdenes en proceso</span></div>
      <div class="cifra"><b>${bajos}</b><span>Productos con bajo stock</span></div>
      <div class="cifra"><b>${citasHoy}</b><span>Citas de hoy</span></div>
    </div>
    <div class="panel"><h3>Avisos</h3>${av.length ? `<ul>${av.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "<p>No hay avisos pendientes.</p>"}</div>`;
  },
  clientes: () => tabla("clientes"),
  historias: () => tabla("historias_optometricas") + `<div class="sep">${tabla("formulas")}</div>`,
  citas: () => tabla("citas"),
  productos: () => tabla("productos"),
  inventario: () => tabla("movimientos_inventario"),
  proveedores: () => tabla("proveedores"),
  ventas() {
    const opt = (arr, l) => arr.map(r => `<option value="${r.id}">${esc(r[l])}</option>`).join("");
    const filas = cache.ventas.map(v => `<tr><td>${fecha(v.created_at)}</td><td>${esc(nombre("clientes", v.cliente_id))}</td><td>${esc(nombre("productos", v.producto_id))}</td><td>${v.cantidad}</td><td>${money(v.total)}</td><td>${esc(v.forma_pago)}</td></tr>`).join("");
    return `<div class="barra"><h2>Ventas</h2></div>
    <form id="form-venta" class="form-venta panel">
      <label>Cliente <select name="cliente_id" required><option value="">Selecciona…</option>${opt(cache.clientes, "nombre")}</select></label>
      <label>Producto <select name="producto_id" required><option value="">Selecciona…</option>${opt(cache.productos.filter(p => p.existencias > 0), "nombre")}</select></label>
      <label>Cantidad <input name="cantidad" type="number" min="1" value="1" required></label>
      <label>Forma de pago <select name="forma_pago">${PAGOS.map(p => `<option>${p}</option>`).join("")}</select></label>
      <button class="btn" type="submit">Registrar venta</button>
    </form>
    <div class="tabla-wrap"><table><thead><tr><th>Fecha</th><th>Cliente</th><th>Producto</th><th>Cant.</th><th>Total</th><th>Pago</th></tr></thead>
    <tbody>${filas || `<tr><td class="vacio" colspan="6">Todavía no hay ventas registradas.</td></tr>`}</tbody></table></div>`;
  },
  ordenes() {
    const filas = cache.ordenes.map(o => `<tr><td>${corto(o.id)}</td><td>${esc(nombre("clientes", o.cliente_id))}</td><td>${fecha(o.created_at)}</td>
      <td><select data-estado="${o.id}">${ESTADOS.map(s => `<option ${s === o.estado ? "selected" : ""}>${s}</option>`).join("")}</select></td>
      <td class="acc"><button class="link" data-hist="${o.id}">Historial</button></td></tr>`).join("");
    return `<div class="barra"><h2>Órdenes de lentes</h2></div>
    <div class="tabla-wrap"><table><thead><tr><th>Orden</th><th>Cliente</th><th>Creada</th><th>Estado</th><th></th></tr></thead>
    <tbody>${filas || `<tr><td class="vacio" colspan="5">Las órdenes se crean solas al registrar una venta.</td></tr>`}</tbody></table></div>`;
  },
  usuarios() {
    if (!DB.live) return `<div class="barra"><h2>Usuarios</h2></div><p>Los usuarios y roles están disponibles al conectar Supabase.</p>`;
    const filas = cache.perfiles.map(p => `<tr><td>${esc(p.nombre)}</td><td><select data-rol="${p.id}">${ROLES.map(r => `<option ${r === p.rol ? "selected" : ""}>${r}</option>`).join("")}</select></td></tr>`).join("");
    return `<div class="barra"><h2>Usuarios</h2></div>
    <p>Crea usuarios nuevos en Supabase (Authentication → Users). Aparecen aquí con rol Vendedor para que les cambies el rol.</p><br>
    <div class="tabla-wrap"><table><thead><tr><th>Usuario</th><th>Rol</th></tr></thead><tbody>${filas}</tbody></table></div>`;
  }
};

function armarMenu() {
  const ok = PERM[rol] || PERM.Vendedor;
  $("#menu").innerHTML = MENU.filter(([k]) => ok.includes(k)).map(([k, l]) => `<button data-vista="${k}">${l}</button>`).join("");
  $("#rol").textContent = "Rol: " + rol;
  if (!ok.includes(actual)) actual = ok[0];
}

async function render() {
  await cargar();
  $("#vista").innerHTML = VISTAS[actual]();
  document.querySelectorAll("#menu button").forEach(b => b.classList.toggle("activo", b.dataset.vista === actual));
}

function abrirForm(n, id) {
  const e = ENT[n], reg = id ? cache[n].find(r => r.id == id) : {};
  const campo = ([k, l, t, o]) => {
    const v = reg[k], req = REQ.has(k) ? "required" : "";
    const h = t === "textarea" ? `<textarea name="${k}">${esc(v)}</textarea>`
      : t === "select" ? `<select name="${k}">${o.map(x => `<option ${x === v ? "selected" : ""}>${x}</option>`).join("")}</select>`
      : t === "ref" ? `<select name="${k}" ${req}><option value="">Selecciona…</option>${cache[o].map(r => `<option value="${r.id}" ${r.id == v ? "selected" : ""}>${esc(r.nombre)}</option>`).join("")}</select>`
      : `<input name="${k}" type="${t === "dec" || t === "int" ? "number" : t}" ${t === "dec" ? 'step="0.25"' : ""} value="${esc(v ?? (t === "number" ? 0 : t === "date" && REQ.has(k) ? hoy() : ""))}" ${req}>`;
    return `<label>${l}${h}</label>`;
  };
  const f = $("#dlg-form");
  f.innerHTML = `<h3>${id ? "Editar" : e.nuevo}</h3>${e.campos.map(campo).join("")}
    <div class="acciones"><button class="btn sec" type="button" id="cancelar">Cancelar</button><button class="btn">Guardar</button></div>`;
  $("#cancelar").onclick = () => $("#dlg").close();
  f.onsubmit = async ev => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    e.campos.forEach(([k, , t]) => {
      if (t === "number") d[k] = Number(d[k] || 0);
      else if (["dec", "int", "ref"].includes(t)) d[k] = d[k] === "" ? null : Number(d[k]);
      else if (d[k] === "" && (t === "date" || t === "time")) d[k] = null;
    });
    const err = e.validar?.(d, id);
    if (err) return toast(err, true);
    try { await e.aplicar?.(d); id ? await DB.update(n, id, d) : await DB.insert(n, d); $("#dlg").close(); await render(); toast("Guardado"); }
    catch (er) { toast(er.message, true); }
  };
  $("#dlg").showModal();
}

function mostrar(html) {
  $("#dlg-form").innerHTML = html + `<div class="acciones"><button class="btn sec" type="button" id="cancelar">Cerrar</button></div>`;
  $("#cancelar").onclick = () => $("#dlg").close();
  $("#dlg").showModal();
}

function ficha(id) {
  const c = cache.clientes.find(x => x.id == id);
  const lista = (t, fn) => { const a = cache[t].filter(r => r.cliente_id == id); return a.length ? `<ul>${a.map(fn).join("")}</ul>` : "<p>Sin registros.</p>"; };
  const n = v => v ?? "—";
  mostrar(`<h3>${esc(c.nombre)}</h3>
    <p>Documento ${esc(c.documento)} · Tel. ${esc(c.telefono) || "—"} · Nacimiento ${fecha(c.fecha_nacimiento)}</p>
    <p>${esc(c.direccion)} ${esc(c.observaciones)}</p>
    <h4>Historias optométricas</h4>${lista("historias_optometricas", h => `<li>${fecha(h.fecha)}: ${esc(h.motivo_consulta)} (${esc(h.optometra)})</li>`)}
    <h4>Fórmulas</h4>${lista("formulas", f => `<li>${fecha(f.created_at)} ${f.tipo}: OD ${n(f.od_esfera)} / ${n(f.od_cilindro)} × ${n(f.od_eje)} · OI ${n(f.oi_esfera)} / ${n(f.oi_cilindro)} × ${n(f.oi_eje)} · Add ${n(f.adicion)}</li>`)}
    <h4>Citas</h4>${lista("citas", x => `<li>${fecha(x.fecha)} ${(x.hora || "").slice(0, 5)} con ${esc(x.profesional)} (${x.estado})</li>`)}
    <h4>Compras</h4>${lista("ventas", v => `<li>${fecha(v.created_at)}: ${esc(nombre("productos", v.producto_id))} × ${v.cantidad}, ${money(v.total)}</li>`)}`);
}

function historial(id) {
  const h = cache.seguimiento_ordenes.filter(s => s.orden_id == id).reverse();
  mostrar(`<h3>Orden ${corto(id)}</h3>${h.length ? `<ul>${h.map(s => `<li>${fechaHora(s.created_at)}: ${esc(s.estado)}</li>`).join("")}</ul>` : "<p>Sin cambios registrados.</p>"}`);
}

async function registrarVenta(form) {
  const d = Object.fromEntries(new FormData(form));
  const p = cache.productos.find(x => x.id == d.producto_id), cant = Number(d.cantidad);
  if (cant > p.existencias) return toast(`Solo hay ${p.existencias} unidades de ${p.nombre}.`, true);
  try {
    const v = await DB.insert("ventas", { cliente_id: Number(d.cliente_id), producto_id: p.id, cantidad: cant, total: p.precio * cant, forma_pago: d.forma_pago });
    await DB.update("productos", p.id, { existencias: p.existencias - cant });
    const o = await DB.insert("ordenes", { venta_id: v.id, cliente_id: Number(d.cliente_id), estado: ESTADOS[0] });
    await DB.insert("seguimiento_ordenes", { orden_id: o.id, estado: ESTADOS[0] });
    await render(); toast("Venta registrada y orden creada");
  } catch (err) { toast(err.message, true); }
}

// Eventos
$("#menu").onclick = e => { if (e.target.dataset.vista) { actual = e.target.dataset.vista; render(); } };
$("#vista").addEventListener("click", async e => {
  const { nuevo, edit, del, ficha: fi, hist } = e.target.dataset;
  if (nuevo) abrirForm(nuevo);
  if (edit) abrirForm(...edit.split(":"));
  if (fi) ficha(fi);
  if (hist) historial(hist);
  if (del && confirm("¿Eliminar este registro? No se puede deshacer.")) {
    const [n, id] = del.split(":");
    try { await DB.remove(n, id); await render(); toast("Eliminado"); } catch (err) { toast(err.message, true); }
  }
});
$("#vista").addEventListener("submit", e => { if (e.target.id === "form-venta") { e.preventDefault(); registrarVenta(e.target); } });
$("#vista").addEventListener("change", async e => {
  const { estado, rol: r } = e.target.dataset;
  try {
    if (estado) { await DB.update("ordenes", estado, { estado: e.target.value }); await DB.insert("seguimiento_ordenes", { orden_id: Number(estado), estado: e.target.value }); toast("Estado actualizado"); }
    if (r) { await DB.update("perfiles", r, { rol: e.target.value }); toast("Rol actualizado"); }
  } catch (err) { toast(err.message, true); }
});

async function entrar() {
  $("#login").hidden = true; $("#app").hidden = false;
  try { rol = await DB.rol(); armarMenu(); await render(); }
  catch (err) {
    console.error(err);
    $("#vista").innerHTML = `<p class="error">No se pudieron cargar los datos: ${esc(err.message || err)}. Revisa que ejecutaste database/schema.sql y database/schema_fase2.sql en Supabase.</p>`;
  }
}
$("#form-login").onsubmit = async e => {
  e.preventDefault();
  const msg = $("#error-login"), btn = e.target.querySelector("button");
  msg.hidden = true; btn.disabled = true; btn.textContent = "Entrando…";
  const d = Object.fromEntries(new FormData(e.target));
  try { await DB.login(d.email.trim(), d.password); await entrar(); }
  catch (err) { console.error(err); msg.textContent = "No se pudo iniciar sesión: " + (err.message || err); msg.hidden = false; }
  finally { btn.disabled = false; btn.textContent = "Iniciar sesión"; }
};
$("#salir").onclick = async () => { await DB.logout(); location.reload(); };

$("#aviso-demo").hidden = DB.live;
DB.sesion().then(u => u && entrar());
