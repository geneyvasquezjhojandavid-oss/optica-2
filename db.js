// Capa de datos: usa Supabase si está configurado; si no, guarda en localStorage (modo demo).
const DB = (() => {
  const { SUPABASE_URL: url, SUPABASE_ANON_KEY: key } = window.OPTICA_CONFIG;
  const live = Boolean(url && key && !url.includes("TU-PROYECTO"));
  const sb = live && window.supabase ? window.supabase.createClient(url, key) : null;

  const leer = t => JSON.parse(localStorage.getItem("optica_" + t) || "[]");
  const guardar = (t, r) => localStorage.setItem("optica_" + t, JSON.stringify(r));
  const check = ({ data, error }) => { if (error) throw error; return data; };

  return {
    live,
    async login(email, password) {
      if (live && !sb) throw new Error("No se cargó la librería de Supabase. Revisa tu conexión a internet o desactiva el bloqueador de anuncios.");
      if (!live) { localStorage.setItem("optica_user", JSON.stringify({ email })); return { email }; }
      return check(await sb.auth.signInWithPassword({ email, password })).user;
    },
    async logout() { live ? await sb.auth.signOut() : localStorage.removeItem("optica_user"); },
    async sesion() {
      if (live && !sb) return null;
      if (!live) return JSON.parse(localStorage.getItem("optica_user") || "null");
      return (await sb.auth.getSession()).data.session?.user || null;
    },
    async rol() {
      if (!live) return "Administrador";
      const u = await this.sesion();
      const { data } = await sb.from("perfiles").select("rol").eq("id", u.id).maybeSingle();
      return data?.rol || "Vendedor";
    },
    async list(t) {
      if (!live) return leer(t).sort((a, b) => b.id - a.id);
      return check(await sb.from(t).select("*").order("id", { ascending: false }));
    },
    async insert(t, row) {
      if (!live) {
        const r = { ...row, id: Date.now() + Math.floor(Math.random() * 1000), created_at: new Date().toISOString() };
        guardar(t, [...leer(t), r]); return r;
      }
      return check(await sb.from(t).insert(row).select().single());
    },
    async update(t, id, row) {
      if (!live) { guardar(t, leer(t).map(r => r.id == id ? { ...r, ...row } : r)); return; }
      check(await sb.from(t).update(row).eq("id", id));
    },
    async remove(t, id) {
      if (!live) { guardar(t, leer(t).filter(r => r.id != id)); return; }
      check(await sb.from(t).delete().eq("id", id));
    }
  };
})();