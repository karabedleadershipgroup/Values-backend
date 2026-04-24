/* =============================================================
 * Values Lab — Organization Loader
 * =============================================================
 *
 * What this file does:
 * --------------------
 * This script transforms the generic Karabed Leadership Group
 * Values Lab into a customized, organization-branded experience.
 *
 * When someone visits Values Lab, they sign in with their
 * organization's username and password (the same credentials they
 * use to sign into the admin dashboard). After successful sign-in:
 *
 *   1. The organization's logo replaces the KLG logo
 *   2. The organization's brand colors replace the KLG navy/gold
 *   3. The organization's values are pre-loaded into Values Lab
 *      so staff don't have to type them in each time
 *   4. Each session saved to Supabase is tagged with the org's
 *      ID so the admin dashboard shows each org their own data
 *
 * What this file does NOT change:
 * -------------------------------
 *   - Any of the layout, animations, or features of Values Lab
 *   - Fast Mode, Detailed Mode, audio, PDF export, language toggle
 *   - The /api/analyze and /api/speak endpoints
 *
 * How it works at a technical level:
 * ----------------------------------
 *   - On page load, we replace the original KLG access-code login
 *     with a username/password login that talks to Supabase
 *   - After login, we read the org's row from the `orgs` table
 *     and apply the customization
 *   - We hook into the existing generate() function so each session
 *     is saved with the org_id
 * ============================================================= */

(function () {
  'use strict';

  // -----------------------------------------------------------
  // Configuration
  // -----------------------------------------------------------
  // We get the Supabase credentials from the same /api/config
  // endpoint that admin.html uses, so there's nothing new to set up
  // on the backend.
  const CONFIG_ENDPOINT = '/api/config';

  // Session storage keys (cleared when browser closes)
  const SS_ORG = 'vl_org_v2';

  // Local storage keys used by the existing index.html for values.
  // We will overwrite these with the org's values on login.
  const LS_VALUES = 'vl_savedValues';
  const LS_SECTOR = 'vl_savedSector';
  const LS_TONE = 'vl_savedTone';

  let sb = null;          // Supabase client
  let currentOrg = null;  // The signed-in org (object with id, name, values, logo, colors)

  // -----------------------------------------------------------
  // Boot: runs as soon as the page loads
  // -----------------------------------------------------------
  document.addEventListener('DOMContentLoaded', boot);

  async function boot() {
    try {
      // Step 1: Get Supabase credentials from the existing endpoint
      const res = await fetch(CONFIG_ENDPOINT);
      const cfg = await res.json();
      sb = supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);

      // Step 2: Replace the original access-code login with our org login.
      // We always do this regardless of whether someone is already signed in,
      // because it's safer to always use the new login UI.
      installOrgLogin();

      // Step 3: If the user is already signed in (from a previous visit
      // in the same browser session), restore that org and skip login.
      const saved = sessionStorage.getItem(SS_ORG);
      if (saved) {
        try {
          currentOrg = JSON.parse(saved);
          applyOrgToPage(currentOrg);
          hideOrgLogin();
        } catch (e) {
          // If the saved org is corrupted, just clear it and show login
          sessionStorage.removeItem(SS_ORG);
        }
      }

      // Step 4: Hook into the existing generate function so that each
      // session is saved to Supabase with the correct org_id.
      installSessionLogger();
    } catch (e) {
      console.error('Org loader failed to initialize:', e);
      // If we can't load Supabase config, fall back to the original
      // behavior so the app still works (just without org branding).
    }
  }

  // -----------------------------------------------------------
  // Login UI: replace the original access-code login
  // -----------------------------------------------------------
  function installOrgLogin() {
    // Find the original login overlay (the one asking for an access code)
    const orig = document.getElementById('login-overlay');
    if (!orig) return;

    // Replace its inner card with our new username/password card.
    // We keep the overlay container itself (with its dark navy background)
    // so the visual experience is consistent with the original.
    orig.innerHTML = `
      <div class="overlay-card" id="org-login-card">
        <div class="overlay-mark">
          <svg width="56" height="56" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="80" height="80" rx="16" fill="#1B2A4A"/>
            <rect x="12" y="12" width="56" height="56" stroke="#F7F5EF" stroke-width="1" fill="none" opacity="0.5"/>
            <rect x="31" y="12.5" width="18.33" height="55" fill="#C9A84C" opacity="0.18"/>
            <line x1="21" y1="21" x2="59" y2="59" stroke="#C9A84C" stroke-width="2.5" stroke-linecap="round"/>
            <circle cx="40" cy="40" r="4" fill="#C9A84C"/>
          </svg>
        </div>
        <div class="overlay-title">Values<em> Lab</em></div>
        <div class="overlay-sub">Organization sign in</div>

        <div class="login-field">
          <label for="org-login-username">Username</label>
          <input type="text" class="values-input" id="org-login-username"
                 placeholder="e.g. lifemoves" autocomplete="username" />
        </div>

        <div class="login-field">
          <label for="org-login-password">Password</label>
          <input type="password" class="values-input" id="org-login-password"
                 placeholder="Enter your password" autocomplete="current-password" />
        </div>

        <div class="login-error" id="org-login-error"></div>

        <button class="btn-primary" id="org-login-btn"
                style="margin-top:1rem;">Continue</button>

        <div class="overlay-footer">
          Need an account? Contact Karabed Leadership Group.
        </div>
      </div>
    `;

    // Make sure the overlay is visible (the original code might have hidden
    // it if a previous session set the old vl_authed flag — we ignore that)
    orig.style.display = 'flex';

    // Wire up the buttons and Enter key
    const btn = document.getElementById('org-login-btn');
    const userInput = document.getElementById('org-login-username');
    const passInput = document.getElementById('org-login-password');

    btn.addEventListener('click', attemptOrgLogin);
    passInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); attemptOrgLogin(); }
    });
    userInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); passInput.focus(); }
    });
  }

  function hideOrgLogin() {
    const orig = document.getElementById('login-overlay');
    if (orig) orig.style.display = 'none';
  }

  async function attemptOrgLogin() {
    const username = (document.getElementById('org-login-username').value || '').trim().toLowerCase();
    const password = (document.getElementById('org-login-password').value || '').trim();
    const errEl = document.getElementById('org-login-error');
    const btn = document.getElementById('org-login-btn');

    errEl.style.display = 'none';

    if (!username || !password) {
      showLoginError('Please enter both username and password.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Signing in...';

    try {
      // Look up the org by username + password.
      // We select all the columns we need to customize the page.
      const { data, error } = await sb
        .from('orgs')
        .select('id, name, username, values, logo_url, primary_color, accent_color')
        .eq('username', username)
        .eq('password', password)
        .single();

      if (error || !data) {
        showLoginError('Incorrect username or password. Please try again.');
        return;
      }

      currentOrg = data;
      sessionStorage.setItem(SS_ORG, JSON.stringify(data));
      applyOrgToPage(data);
      hideOrgLogin();

    } catch (e) {
      console.error('Login error:', e);
      showLoginError('Connection error. Please try again.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Continue';
    }
  }

  function showLoginError(msg) {
    const errEl = document.getElementById('org-login-error');
    if (!errEl) return;
    errEl.textContent = msg;
    errEl.style.display = 'block';
  }

  // -----------------------------------------------------------
  // Apply the org's branding to the page
  // -----------------------------------------------------------
  function applyOrgToPage(org) {
    // 1. Apply brand colors by overriding the CSS variables
    applyBrandColors(org.primary_color, org.accent_color);

    // 2. Replace the logo image at the top of the page
    applyLogo(org.logo_url, org.name);

    // 3. Pre-populate the org's values into local storage so Fast Mode
    //    skips the values-setup step. We store just the value names
    //    (which is what the existing app expects).
    if (Array.isArray(org.values) && org.values.length) {
      const valueNames = org.values.map(function (v) {
        // Each value in the database is { name, definition }
        // The existing app just wants an array of names.
        return typeof v === 'string' ? v : v.name;
      });
      localStorage.setItem(LS_VALUES, JSON.stringify(valueNames));

      // Also push the values straight into the in-memory state of the
      // existing app. This is important because Fast Mode runs its
      // "do I have saved values?" check ONCE on page load, before our
      // login completes. If we don't re-trigger it here, Fast Mode will
      // still show the one-time setup screen even though the values are
      // now in storage. So we re-render Fast Mode if it's the active mode.
      try {
        if (typeof window.orgValues !== 'undefined') {
          window.orgValues = valueNames;
        }
        if (typeof renderFastValuesBar === 'function') {
          renderFastValuesBar();
        }
        // Also pre-fill the Detailed Mode values input, in case the user
        // switches there. This matches what switchMode('detailed') does
        // when there are stored values, but applied immediately.
        const detailedValuesInput = document.getElementById('f-values');
        if (detailedValuesInput) {
          detailedValuesInput.value = valueNames.join(', ');
          detailedValuesInput.dispatchEvent(new Event('input'));
        }
      } catch (e) {
        console.warn('Could not re-render Fast Mode values bar:', e);
      }
    }

    // 4. Update the page title and any "Karabed Leadership Group"
    //    text that should reflect the current org instead.
    const orgPill = document.createElement('div');
    orgPill.id = 'org-pill';
    orgPill.style.cssText = `
      position: fixed;
      top: 14px;
      right: 14px;
      z-index: 50;
      background: rgba(255,255,255,0.92);
      color: ${org.primary_color || '#1B2A4A'};
      border: 1px solid rgba(0,0,0,0.1);
      border-radius: 999px;
      padding: 6px 14px 6px 12px;
      font-family: 'DM Sans', sans-serif;
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0.04em;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    `;
    orgPill.innerHTML = `
      <span style="opacity:0.6;font-size:10px;text-transform:uppercase;letter-spacing:0.12em;">Signed in as</span>
      <span style="font-weight:600;">${escapeHtml(org.name)}</span>
      <a href="#" id="org-signout-link"
         style="margin-left:6px;color:inherit;opacity:0.55;text-decoration:underline;font-size:11px;">
        Sign out
      </a>
    `;
    // Remove any existing pill (e.g. if applyOrgToPage runs twice)
    const existing = document.getElementById('org-pill');
    if (existing) existing.remove();
    document.body.appendChild(orgPill);

    document.getElementById('org-signout-link').addEventListener('click', function (e) {
      e.preventDefault();
      signOut();
    });

    // 5. Make the values definitions available so leadership can see
    //    them. We add a small "View values & definitions" link next
    //    to the saved-values bar in Fast Mode (if present).
    addValuesDefinitionsLink(org.values);
  }

  function applyBrandColors(primary, accent) {
    if (!primary && !accent) return;

    // Inject a style tag that overrides the brand colors site-wide.
    // We target the most visible places: hero background, primary
    // buttons, value chips, mode switcher, and accent highlights.
    const style = document.createElement('style');
    style.id = 'org-brand-overrides';

    const p = primary || '#1B2A4A';
    const a = accent || '#C9A84C';

    style.textContent = `
      /* Org brand color overrides */
      .hero { background: ${p} !important; }
      .btn-primary { background: ${p} !important; color: ${a} !important; }
      .btn-primary:hover { background: ${darken(p)} !important; }
      .mode-btn.active { background: ${p} !important; color: ${a} !important; }
      .value-chip,
      .fast-value-chip,
      .vtag {
        background: ${p} !important;
        color: ${a} !important;
      }
      .preset-pill:hover,
      .sector-pill:hover { background: ${p} !important; color: ${a} !important; border-color: ${p} !important; }
      .sector-pill.selected,
      .tone-pill.selected,
      .segment-option.selected {
        background: ${p} !important; color: ${a} !important; border-color: ${p} !important;
      }
      .qv-card.script { background: ${p} !important; }
      .qv-card.script .qv-card-label,
      .qv-card.script .qv-card-dot { color: ${a} !important; background: ${a} !important; }
      .progress-step.active .progress-num { background: ${p} !important; color: ${a} !important; border-color: ${p} !important; }
      .progress-step.complete .progress-num { background: ${a} !important; color: ${p} !important; border-color: ${a} !important; }
      .audio-player { background: ${p} !important; }
      .audio-play-btn { background: ${a} !important; color: ${p} !important; }
      .footer strong { color: ${a} !important; }
      .lab { color: ${a} !important; }
      .qv-action-banner.coach .qv-action-chip { background: ${p} !important; color: ${a} !important; }
      .lang-btn { color: ${a} !important; border-color: ${a} !important; }
      .lang-btn:hover { background: ${a}22 !important; }
      .text-size-btn.active { background: ${a} !important; color: ${p} !important; }
      .text-size-btn { color: ${a} !important; }
      .text-size-toggle { border-color: ${a} !important; }
    `;
    // Remove any existing override before adding the new one
    const existing = document.getElementById('org-brand-overrides');
    if (existing) existing.remove();
    document.head.appendChild(style);
  }

  function applyLogo(logoUrl, orgName) {
    if (!logoUrl) return;

    // Find the original SVG mark in the hero and replace it with an <img>
    const mark = document.querySelector('.hero .hero-mark');
    if (!mark) return;
    mark.innerHTML = `<img src="${escapeAttr(logoUrl)}" alt="${escapeAttr(orgName || 'Organization logo')}"
      style="max-height:72px;max-width:280px;object-fit:contain;background:white;padding:10px 16px;border-radius:8px;" />`;

    // Also swap the wordmark text "Values Lab" subtitle to mention the org
    const byline = document.querySelector('.hero .byline');
    if (byline) byline.textContent = orgName || byline.textContent;
  }

  function addValuesDefinitionsLink(values) {
    if (!Array.isArray(values) || !values.length) return;

    // We make two passes:
    //  - One immediately, in case the elements are already in the DOM
    //  - One after a short delay, to catch elements that get inserted/changed
    //    when the user navigates between modes or finishes a session
    swapEditForDefinitionsButtons(values);
    setTimeout(function () { swapEditForDefinitionsButtons(values); }, 500);
    setTimeout(function () { swapEditForDefinitionsButtons(values); }, 1500);

    // Also watch for DOM changes (like the results screen appearing) so we
    // can swap the buttons when those new elements show up.
    const observer = new MutationObserver(function () {
      swapEditForDefinitionsButtons(values);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function swapEditForDefinitionsButtons(values) {
    // ---- Saved-values bar at the top of Fast Mode ----
    // Original button calls editSavedValues() which jumps to Detailed Mode.
    // For org users, we hide it and add a "View definitions" button instead.
    const editTopBtn = document.getElementById('fast-edit-btn');
    if (editTopBtn && editTopBtn.style.display !== 'none') {
      editTopBtn.style.display = 'none';
    }
    const valuesBar = document.getElementById('fast-values-bar');
    if (valuesBar && !document.getElementById('org-defs-link-top')) {
      const link = document.createElement('button');
      link.id = 'org-defs-link-top';
      link.type = 'button';
      link.className = 'fast-edit-link';
      link.textContent = 'View definitions';
      link.addEventListener('click', function () { showDefinitionsModal(values); });
      valuesBar.appendChild(link);
    }

    // ---- Results action bar (Fast Mode results screen) ----
    // Original button is "Edit my values" with id btn-edit-values.
    // We hide it and add a "View definitions" button next to it.
    const editResultsBtn = document.getElementById('btn-edit-values');
    if (editResultsBtn && editResultsBtn.style.display !== 'none') {
      editResultsBtn.style.display = 'none';

      // Add a replacement button right where the old one was
      if (!document.getElementById('btn-view-defs-results')) {
        const btn = document.createElement('button');
        btn.id = 'btn-view-defs-results';
        btn.type = 'button';
        btn.className = 'fast-action-btn';
        btn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
          <span>View definitions</span>
        `;
        btn.addEventListener('click', function () { showDefinitionsModal(values); });
        editResultsBtn.insertAdjacentElement('afterend', btn);
      }
    }
  }


  function showDefinitionsModal(values) {
    // Simple modal showing each value with its definition
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(20,28,48,0.6);
      display: flex; align-items: center; justify-content: center;
      z-index: 99999; padding: 1.5rem;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      background: white; border-radius: 14px; max-width: 640px;
      width: 100%; max-height: 86vh; overflow-y: auto;
      padding: 2rem 2rem 1.5rem;
      font-family: 'DM Sans', sans-serif;
    `;

    let html = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.5rem;">
        <div>
          <div style="font-size:10px;font-weight:600;color:#A88835;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px;">
            ${escapeHtml(currentOrg && currentOrg.name ? currentOrg.name : 'Organization')} Values
          </div>
          <div style="font-family:'Playfair Display',serif;font-size:24px;font-weight:600;color:#1a1a17;">
            Our values, in our words
          </div>
        </div>
        <button id="defs-close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#888;line-height:1;">×</button>
      </div>
    `;

    values.forEach(function (v) {
      const name = typeof v === 'string' ? v : (v.name || '');
      const def = typeof v === 'object' ? (v.definition || '') : '';
      html += `
        <div style="padding:14px 0;border-bottom:1px solid #eee;">
          <div style="font-weight:600;color:#1a1a17;font-size:15px;margin-bottom:4px;">${escapeHtml(name)}</div>
          ${def ? `<div style="color:#4a4843;font-size:13.5px;line-height:1.6;font-weight:300;">${escapeHtml(def)}</div>` : ''}
        </div>
      `;
    });

    card.innerHTML = html;
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    function close() { overlay.remove(); }
    document.getElementById('defs-close').addEventListener('click', close);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
  }

  function signOut() {
    sessionStorage.removeItem(SS_ORG);
    // Also clear the values cache so the next user doesn't see the prior org's values
    localStorage.removeItem(LS_VALUES);
    location.reload();
  }

  // -----------------------------------------------------------
  // Session logging: tag each session with the org_id
  // -----------------------------------------------------------
  function installSessionLogger() {
    // The original index.html POSTs to /api/analyze and gets back
    // a result object. To save sessions to Supabase tagged with the
    // org_id, we wrap the global fetch so that when /api/analyze
    // returns successfully, we also write a row to the sessions table.
    const originalFetch = window.fetch;
    window.fetch = async function (input, init) {
      const response = await originalFetch.apply(this, arguments);
      try {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        if (url.includes('/api/analyze') && response.ok && currentOrg && sb) {
          // Clone the response so we can read it without consuming it
          // for the original caller.
          const cloned = response.clone();
          const data = await cloned.json();
          // Pull the situation text out of the request body
          let behavior = '';
          let pattern = '';
          try {
            if (init && init.body) {
              const body = JSON.parse(init.body);
              behavior = body.situation || '';
              pattern = body.pattern || '';
            }
          } catch (e) { /* ignore */ }

          const misaligned = (data.valuesAnalysis || [])
            .filter(function (v) { return v.status === 'Misaligned'; })
            .map(function (v) { return v.value; });
          const upheld = (data.valuesAnalysis || [])
            .filter(function (v) { return v.status === 'Upheld'; })
            .map(function (v) { return v.value; });

          // Fire and forget — we don't want to block the UI
          sb.from('sessions').insert({
            org_id: currentOrg.id,
            behavior: behavior,
            pattern: pattern,
            misaligned_values: misaligned,
            upheld_values: upheld,
            recommended_action: data.recommendedAction ? data.recommendedAction.action : null,
            result_json: data
          }).then(function (res) {
            if (res.error) console.warn('Session log failed:', res.error);
          });
        }
      } catch (e) {
        console.warn('Session logger error:', e);
      }
      return response;
    };
  }

  // -----------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function escapeAttr(str) { return escapeHtml(str); }

  // Naive color darken: drops each RGB channel by ~12 to make a hover state.
  function darken(hex) {
    if (!hex || hex[0] !== '#' || hex.length !== 7) return hex;
    const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - 18);
    const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - 18);
    const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - 18);
    return '#' + [r, g, b].map(function (n) {
      const s = n.toString(16);
      return s.length === 1 ? '0' + s : s;
    }).join('');
  }

})();
