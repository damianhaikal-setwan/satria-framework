/*
 * SATRIA — reusable OPD assignment form helper.
 * Muat di dalam Supabase bridge IIFE (atau script browser setelah DOM siap).
 * Katalog OPD dibaca dari #selOpd yang sudah dirender oleh aplikasi SATRIA.
 * Helper ini hanya menangani UI; persistensi harus dilakukan Edge Function.
 */
(() => {
  'use strict';

  function availableOpds() {
    const source = document.getElementById('selOpd');
    if (!(source instanceof HTMLSelectElement)) return [];
    return Array.from(source.options)
      .filter((option) => option.value && option.value !== 'all')
      .map((option) => ({ id: option.value, name: option.textContent.trim() }))
      .filter((opd) => opd.id && opd.name);
  }

  function mount(form, selectedIds = []) {
    if (!(form instanceof HTMLFormElement)) {
      throw new TypeError('Form untuk assignment OPD tidak valid.');
    }

    let fieldset = form.querySelector('[data-satria-opd-assignment]');
    if (!fieldset) {
      fieldset = document.createElement('fieldset');
      fieldset.dataset.satriaOpdAssignment = 'true';
      fieldset.className = 'satria-opd-fieldset';

      const legend = document.createElement('legend');
      legend.textContent = 'OPD yang dapat diakses';
      fieldset.appendChild(legend);

      const choices = document.createElement('div');
      choices.className = 'satria-opd-choices';
      choices.dataset.satriaOpdChoices = 'true';
      fieldset.appendChild(choices);

      const help = document.createElement('p');
      help.className = 'satria-opd-help';
      help.textContent = 'Pilih satu atau beberapa OPD. Pilihan berlaku setelah assignment disimpan dan diberlakukan oleh backend.';
      fieldset.appendChild(help);

      const actions = form.querySelector('.satria-user-actions');
      if (actions) form.insertBefore(fieldset, actions);
      else form.appendChild(fieldset);
    }

    const choices = fieldset.querySelector('[data-satria-opd-choices]');
    const selected = new Set((Array.isArray(selectedIds) ? selectedIds : []).map(String));
    choices.replaceChildren();

    const opds = availableOpds();
    if (!opds.length) {
      const empty = document.createElement('p');
      empty.className = 'satria-opd-empty';
      empty.textContent = 'Daftar OPD belum tersedia. Periksa data master OPD pada aplikasi.';
      choices.appendChild(empty);
      return fieldset;
    }

    for (const opd of opds) {
      const label = document.createElement('label');
      label.className = 'satria-opd-choice';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'opd_ids';
      checkbox.value = opd.id;
      checkbox.checked = selected.has(opd.id);
      checkbox.setAttribute('aria-label', `Izinkan akses ke ${opd.name}`);
      checkbox.addEventListener('change', () => {
        for (const input of choices.querySelectorAll('input[type="checkbox"]')) {
          input.setCustomValidity('');
        }
      });

      const text = document.createElement('span');
      text.textContent = opd.name;
      label.append(checkbox, text);
      choices.appendChild(label);
    }

    return fieldset;
  }

  function selectedIds(form) {
    if (!(form instanceof HTMLFormElement)) return [];
    return Array.from(form.querySelectorAll('[data-satria-opd-assignment] input[name="opd_ids"]:checked'))
      .map((input) => input.value);
  }

  function validate(form) {
    if (!(form instanceof HTMLFormElement)) return false;
    const inputs = Array.from(form.querySelectorAll('[data-satria-opd-assignment] input[name="opd_ids"]'));
    const hasSelection = inputs.some((input) => input.checked);
    for (const input of inputs) input.setCustomValidity('');
    if (hasSelection) return true;

    if (inputs.length) {
      inputs[0].setCustomValidity('Pilih minimal satu OPD.');
      inputs[0].reportValidity();
    } else {
      const fieldset = form.querySelector('[data-satria-opd-assignment]');
      fieldset?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return false;
  }

  if (!document.getElementById('satriaOpdAssignmentStyles')) {
    const style = document.createElement('style');
    style.id = 'satriaOpdAssignmentStyles';
    style.textContent = `
      .satria-opd-fieldset{border:1px solid #cbd5df;border-radius:10px;padding:12px;margin:14px 0 8px}
      .satria-opd-fieldset legend{font-weight:700;padding:0 5px}
      .satria-opd-choices{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:6px 12px;max-height:220px;overflow:auto;padding:4px}
      .satria-opd-choice{display:flex!important;align-items:flex-start;gap:8px;font-weight:400!important;margin:0!important;cursor:pointer}
      .satria-opd-choice input[type=checkbox]{width:auto!important;margin:3px 0 0!important;flex:0 0 auto}
      .satria-opd-help,.satria-opd-empty{font-size:12px;color:#64748b;margin:8px 2px 0}
    `;
    document.head.appendChild(style);
  }

  window.SATRIA_OPD_FORM = Object.freeze({ mount, selectedIds, validate, availableOpds });

  // The existing create-user modal opens through this button. Mounting again
  // after it opens refreshes its list and clears selections from a prior create.
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('#satriaOpenCreateUser')) return;
    window.setTimeout(() => {
      const createForm = document.getElementById('satriaCreateUserForm');
      if (createForm) mount(createForm, []);
    }, 0);
  });
})();
