(function(){
  const C = window.GRADER_CONFIG || {};
  // TEMPORARY LOCAL-ONLY MODE: login/sign-up and cloud sync are paused.
  // Set this back to the original configuration check when auth is ready.
  const on = false;
  const Cloud = window.Cloud = { on, saveResult: async () => ({ error: "Cloud is not configured." }), loadResults: async () => [] };
  if (!on) return;

  const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
  const $ = id => document.getElementById(id);
  const style = document.createElement("style");
  style.textContent = '#auth{position:fixed;inset:0;z-index:50;background:var(--bg);overflow:auto;padding:24px 16px}#auth .card{max-width:420px;margin:8vh auto 0}#auth .sw{background:none;border:0;color:var(--pri);font-weight:700;text-decoration:underline;width:100%;padding:12px 0 0}#auth input{margin-bottom:10px}#auth .warn{overflow-wrap:anywhere}';
  document.head.appendChild(style);

  const box = document.createElement("div");
  box.id = "auth";
  box.hidden = true;
  box.innerHTML = `<div class="card"><h1 id="aT">Mag-login</h1><p class="mut">Mag-login para magamit ang Grader.</p>
    <div id="aS" hidden><input id="aN" placeholder="Buong pangalan" autocomplete="name"><input id="aSc" placeholder="Paaralan" autocomplete="organization"></div>
    <input id="aE" type="email" placeholder="Email" autocomplete="email">
    <input id="aP" type="password" placeholder="Password (6+ karakter)" autocomplete="current-password">
    <p id="aM" class="warn" role="status" aria-live="polite"></p>
    <button class="btn" id="aB" style="width:100%">Mag-login</button>
    <button class="sw" id="aW">Wala pang account? Mag-sign up</button></div>`;
  document.body.appendChild(box);

  let up = false, busy = false;
  function mode() {
    $("aT").textContent = up ? "Gumawa ng account" : "Mag-login";
    $("aS").hidden = !up;
    $("aP").autocomplete = up ? "new-password" : "current-password";
    $("aB").textContent = busy ? "Sandali…" : (up ? "Mag-sign up" : "Mag-login");
    $("aB").disabled = busy;
    $("aW").disabled = busy;
    $("aW").textContent = up ? "May account na? Mag-login" : "Wala pang account? Mag-sign up";
  }
  $("aW").onclick = () => { if (busy) return; up = !up; mode(); };
  function friendlyError(message) {
    const m = String(message || "");
    if (/email rate limit exceeded|over_email_send_rate_limit/i.test(m))
      return "Naabot na ang limit ng email na ipinapadala ng Supabase. Huwag ulit-ulitin ang sign-up. Maghintay muna, o kumpletuhin ang custom SMTP setup at verified sender email.";
    if (/email not confirmed/i.test(m))
      return "Hindi pa confirmed ang email account. Tingnan ang inbox/spam para sa confirmation email. Kung hindi ito dumarating, ayusin muna ang email sending limit.";
    if (/invalid login credentials/i.test(m))
      return "Hindi tugma ang email o password, o wala pang account. Suriin ang detalye o mag-sign up nang isang beses.";
    if (/user already registered/i.test(m))
      return "May account na gamit ang email na ito. Piliin ang Mag-login.";
    if (/password should be at least/i.test(m))
      return "Gumamit ng password na hindi bababa sa 6 na character.";
    if (/failed to fetch|network/i.test(m))
      return "Hindi makakonekta sa Supabase. Suriin ang internet at ang Supabase URL/key sa config.js.";
    if (/timeout/i.test(m)) return m;
    return m || "Hindi natuloy ang request. Subukan muli mamaya.";
  }
  $("aB").onclick = async () => {
    if (busy) return;
    const email = $("aE").value.trim();
    const password = $("aP").value;
    $("aM").textContent = "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      $("aM").textContent = "Maglagay ng valid na email address."; return;
    }
    if (password.length < 6) {
      $("aM").textContent = "Ilagay ang password na hindi bababa sa 6 na character."; return;
    }
    busy = true; mode();
    $("aM").textContent = "Sinusuri ang account…";
    try {
      const request = up
        ? sb.auth.signUp({ email, password, options: { data: { full_name: $("aN").value.trim(), school: $("aSc").value.trim() } } })
        : sb.auth.signInWithPassword({ email, password });
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Nag-timeout ang koneksyon sa Supabase. I-refresh ang page at subukan muli.")), 15000));
      const result = await Promise.race([request, timeout]);
      if (result.error) { $("aM").textContent = friendlyError(result.error.message); return; }
      if (up && !result.data.session) {
        up = false; mode();
        $("aM").textContent = "Nagawa ang sign-up request. Tingnan ang inbox at spam para sa confirmation email bago mag-login. Kung walang email, huwag paulit-ulit mag-sign up; kailangang ayusin ang SMTP/rate limit.";
      } else if (result.data.session) {
        $("aM").textContent = "Matagumpay ang login.";
      }
    } catch (error) {
      $("aM").textContent = friendlyError(error && error.message);
    } finally {
      busy = false; mode();
    }
  };

  async function gate(session) {
    box.hidden = !!session;
    if (session) {
      try { await sb.rpc("touch"); } catch (_) {}
    }
    window.dispatchEvent(new CustomEvent("grader-auth-ready", { detail: { signedIn: !!session } }));
  }
  sb.auth.getSession().then(({ data, error }) => {
    if (error) $("aM").textContent = friendlyError(error.message);
    gate(data && data.session);
  }).catch(error => {
    box.hidden = false;
    $("aM").textContent = friendlyError(error && error.message);
    window.dispatchEvent(new CustomEvent("grader-auth-ready", { detail: { signedIn: false } }));
  });
  sb.auth.onAuthStateChange((_event, session) => { gate(session); });

  const header = document.querySelector(".top>div");
  if (header) {
    const logout = document.createElement("button");
    logout.textContent = "Logout";
    logout.style.cssText = "margin-left:auto;background:none;border:1px solid currentColor;color:inherit;border-radius:10px;padding:6px 10px;font:inherit;font-size:13px;cursor:pointer";
    logout.onclick = async () => { logout.disabled = true; const { error } = await sb.auth.signOut(); if (error) { logout.disabled = false; alert("Hindi makapag-logout: " + error.message); } };
    header.appendChild(logout);
  }

  Cloud.saveResult = async r => {
    try {
      const payload = {
        client_id: r.client_id,
        answer_key: r.key || [],
        exam_type: r.ex || "",
        exam_title: r.ti || "",
        student_id: r.id || "",
        student_name: r.name || "",
        score: Number(r.s) || 0,
        total: Number(r.t) || 0,
        answers: r.a || []
      };
      const { data: existing, error: lookupError } = await sb.from("results")
        .select("id,client_id")
        .eq("client_id", payload.client_id)
        .maybeSingle();
      if (lookupError) return { error: lookupError.message };
      if (existing) return { data: existing, alreadySaved: true };
      const { data, error } = await sb.from("results").insert(payload)
        .select("id,client_id,answer_key,exam_type,exam_title,student_id,student_name,score,total,answers,created_at").single();
      if (error) return { error: error.message };
      return { data };
    } catch (error) {
      return { error: error && error.message ? error.message : "Cloud sync failed." };
    }
  };

  Cloud.loadResults = async () => {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return [];
    const { data, error } = await sb.from("results")
      .select("id,client_id,answer_key,exam_type,exam_title,student_id,student_name,score,total,answers,created_at")
      .order("created_at", { ascending: false }).limit(1000);
    if (error) throw error;
    return (data || []).map(row => ({
      cloud_id: row.id,
      client_id: row.client_id || undefined,
      name: row.student_name || "Estudyante",
      id: row.student_id || "",
      s: Number(row.score) || 0,
      t: Number(row.total) || 0,
      a: Array.isArray(row.answers) ? row.answers : [],
      key: Array.isArray(row.answer_key) ? row.answer_key : [],
      ex: row.exam_type || "",
      ti: row.exam_title || "",
      created_at: row.created_at
    }));
  };
})();