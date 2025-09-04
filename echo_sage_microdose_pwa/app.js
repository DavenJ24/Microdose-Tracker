/*
 * EchoSage Microdose Tracker
 *
 * This file handles state management, user interactions and chart updates for
 * the mobile microdosing PWA. All data are saved locally using
 * localStorage under the key `echoMicrodoseData`. The app works offline
 * thanks to the service worker registered in index.html.
 */

// Encapsulate all functionality in an IIFE to avoid leaking globals
(function () {
  'use strict';

  /* --------------------------------------------------------------------------
   * Data storage and retrieval
   * ------------------------------------------------------------------------*/
  const STORAGE_KEY = 'echoMicrodoseData';

  /**
   * Initialise a fresh data model if none exists in localStorage. The model
   * follows the schema described in the README. It's kept as simple JSON
   * without prototypes to make export/import straightforward.
   */
  function getInitialData() {
    const isoNow = new Date().toISOString();
    return {
      meta: { appVersion: '1.0.0', createdAt: isoNow, updatedAt: isoNow },
      participant: {
        initials: '',
        age: null,
        sexOrGender: '',
        handDominance: 'right',
        heightCm: null,
        weightKg: null,
        goals: [],
        protocol: { type: 'fadiman', pattern: [1, 0, 0, 1, 0, 0, 1] },
      },
      baseline: null,
      doses: [],
      daily: [],
      weekly: [],
      ftt: [],
      pvt: [],
    };
  }

  /**
   * Retrieve data from localStorage, parsing JSON. If no data is stored,
   * initialise a new structure. This method updates the internal reference
   * and returns the parsed object.
   */
  function loadData() {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    let data;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('Failed to parse stored data, resetting.', e);
      data = null;
    }
    if (!data) {
      data = getInitialData();
      saveData(data);
    }
    return data;
  }

  /**
   * Persist the provided data model back into localStorage. Also update
   * the meta.updatedAt field to now.
   */
  function saveData(data) {
    data.meta.updatedAt = new Date().toISOString();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  /**
   * Completely wipe stored data and reset to defaults. Useful when user clears
   * all data from Settings. Returns the new empty model.
   */
  function clearData() {
    window.localStorage.removeItem(STORAGE_KEY);
    const fresh = getInitialData();
    saveData(fresh);
    return fresh;
  }

  /**
   * Generate a simple unique identifier. It's not a full UUID but is
   * sufficiently unique for our needs.
   */
  function uuid() {
    return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  }

  // Local in-memory reference to the data model
  let DB = loadData();

  /* --------------------------------------------------------------------------
   * Questionnaire definitions
   * ------------------------------------------------------------------------*/
  const phq9 = [
    'Little interest or pleasure in doing things',
    'Feeling down, depressed or hopeless',
    'Trouble falling or staying asleep, or sleeping too much',
    'Feeling tired or having little energy',
    'Poor appetite or overeating',
    'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
    'Trouble concentrating on things, such as reading the newspaper or watching television',
    'Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual',
    'Thoughts that you would be better off dead, or of hurting yourself in some way',
  ];
  const gad7 = [
    'Feeling nervous, anxious or on edge',
    'Not being able to stop or control worrying',
    'Worrying too much about different things',
    'Trouble relaxing',
    'Being so restless that it is hard to sit still',
    'Becoming easily annoyed or irritable',
    'Feeling afraid as if something awful might happen',
  ];
  const pss10 = [
    'In the last month, how often have you been upset because of something that happened unexpectedly?',
    'In the last month, how often have you felt that you were unable to control the important things in your life?',
    'In the last month, how often have you felt nervous and stressed?',
    'In the last month, how often have you felt confident about your ability to handle your personal problems?',
    'In the last month, how often have you felt that things were going your way?',
    'In the last month, how often have you found that you could not cope with all the things that you had to do?',
    'In the last month, how often have you been able to control irritations in your life?',
    'In the last month, how often have you felt that you were on top of things?',
    'In the last month, how often have you been angered because of things that were outside of your control?',
    'In the last month, how often have you felt difficulties were piling up so high that you could not overcome them?',
  ];
  const who5 = [
    'I have felt cheerful and in good spirits',
    'I have felt calm and relaxed',
    'I have felt active and vigorous',
    'I woke up feeling fresh and rested',
    'My daily life has been filled with things that interest me',
  ];
  const phq9Options = [
    { value: 0, label: 'Not at all' },
    { value: 1, label: 'Several days' },
    { value: 2, label: 'More than half the days' },
    { value: 3, label: 'Nearly every day' },
  ];
  const gad7Options = phq9Options;
  const pss10Options = [
    { value: 0, label: 'Never' },
    { value: 1, label: 'Almost never' },
    { value: 2, label: 'Sometimes' },
    { value: 3, label: 'Fairly often' },
    { value: 4, label: 'Very often' },
  ];
  const who5Options = [
    { value: 0, label: 'At no time' },
    { value: 1, label: 'Some of the time' },
    { value: 2, label: 'Less than half the time' },
    { value: 3, label: 'More than half the time' },
    { value: 4, label: 'Most of the time' },
    { value: 5, label: 'All of the time' },
  ];

  /* --------------------------------------------------------------------------
   * Utility functions for scoring
   * ------------------------------------------------------------------------*/
  function phqCategory(total) {
    if (total <= 4) return 'Minimal';
    if (total <= 9) return 'Mild';
    if (total <= 14) return 'Moderate';
    if (total <= 19) return 'Moderately severe';
    return 'Severe';
  }
  function gadCategory(total) {
    if (total <= 4) return 'Minimal';
    if (total <= 9) return 'Mild';
    if (total <= 14) return 'Moderate';
    return 'Severe';
  }
  function pssCategory(total) {
    if (total <= 13) return 'Low stress';
    if (total <= 26) return 'Moderate stress';
    return 'High stress';
  }
  function whoCategory(total) {
    const score = total * 4; // convert 0–25 to 0–100
    if (score >= 51) return 'Normal well‑being';
    return 'Poor well‑being';
  }

  /**
   * Compute the sum of numeric values in an array.
   */
  function sum(arr) {
    return arr.reduce((acc, n) => acc + (parseFloat(n) || 0), 0);
  }

  /**
   * Format a date string (YYYY-MM-DD) into a nice label like Sep 1 or similar.
   */
  function formatDateLabel(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  /**
   * Extract last N items from an array. If array shorter than N, return copy.
   */
  function lastN(arr, n) {
    return arr.slice(Math.max(arr.length - n, 0));
  }

  /* --------------------------------------------------------------------------
   * Build questionnaire HTML elements
   * ------------------------------------------------------------------------*/
  /**
   * Create question elements for a scale. Each question becomes a div with
   * label and options. The created inputs will have names prefixed with
   * prefix + index (e.g. phq9q0). This helps retrieving values later.
   *
   * @param {Element} container - The element to append questions to.
   * @param {string[]} questions - List of question strings.
   * @param {{value:number,label:string}[]} options - Answer options.
   * @param {string} namePrefix - Unique prefix for radio input names.
   */
  function createScale(container, questions, options, namePrefix) {
    container.innerHTML = '';
    questions.forEach((q, idx) => {
      const qDiv = document.createElement('div');
      qDiv.className = 'question';
      const qLabel = document.createElement('label');
      qLabel.textContent = `${idx + 1}. ${q}`;
      qDiv.appendChild(qLabel);
      const optsDiv = document.createElement('div');
      optsDiv.className = 'options';
      options.forEach(opt => {
        const optLabel = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = `${namePrefix}${idx}`;
        radio.value = opt.value;
        radio.required = true;
        optLabel.appendChild(radio);
        optLabel.appendChild(document.createTextNode(opt.label));
        optsDiv.appendChild(optLabel);
      });
      qDiv.appendChild(optsDiv);
      container.appendChild(qDiv);
    });
  }

  /* --------------------------------------------------------------------------
   * Render and update functions
   * ------------------------------------------------------------------------*/
  // Chart instances
  let moodChart, anxietyChart, stressChart, sleepChart, fttChart;

  /**
   * Refresh the summary stats and update all charts. Called whenever data
   * changes. It reads the DB daily, weekly and ftt arrays to compute
   * aggregated numbers.
   */
  function updateSummary() {
    // Compute total entries
    const totalEntries = DB.daily.length;
    const statsDiv = document.getElementById('statsSummary');
    // Compute last 7 daily entries
    const last7 = lastN(DB.daily, 7);
    function avgFromEntries(arr, key) {
      if (arr.length === 0) return 0;
      const vals = arr.map(e => parseFloat(e[key]) || 0);
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    const avgMood = avgFromEntries(last7, 'mood');
    const avgAnxiety = avgFromEntries(last7, 'anxiety');
    const avgStress = avgFromEntries(last7, 'stress');
    const avgSleep = avgFromEntries(last7, 'sleepHours');
    // Compute FTT averages from last 7 sessions per hand
    const fttLast = lastN(DB.ftt, 7);
    let avgFttDom = 0;
    let avgFttNon = 0;
    if (fttLast.length) {
      const dom = fttLast.filter(r => r.hand === 'dominant');
      const nondom = fttLast.filter(r => r.hand === 'nondominant');
      const avgFor = list => {
        if (!list.length) return 0;
        return list.reduce((sum, item) => sum + (item.avg || 0), 0) / list.length;
      };
      avgFttDom = avgFor(dom);
      avgFttNon = avgFor(nondom);
    }
    // On/off schedule counts
    const doseCount = last7.filter(e => e.isDoseDay === true).length;
    const offCount = last7.filter(e => e.isDoseDay === false).length;
    // Inject summary HTML
    statsDiv.innerHTML = `
      <div><strong>Total entries:</strong> ${totalEntries}</div>
      <div><strong>7‑day average mood:</strong> ${avgMood.toFixed(1)}</div>
      <div><strong>7‑day average anxiety:</strong> ${avgAnxiety.toFixed(1)}</div>
      <div><strong>7‑day average stress:</strong> ${avgStress.toFixed(1)}</div>
      <div><strong>7‑day average sleep (h):</strong> ${avgSleep.toFixed(1)}</div>
      <div><strong>FTT average (dominant):</strong> ${avgFttDom.toFixed(1)} taps/10s</div>
      <div><strong>FTT average (non‑dominant):</strong> ${avgFttNon.toFixed(1)} taps/10s</div>
      <div><strong>Dose days vs off days (last 7):</strong> ${doseCount} vs ${offCount}</div>
    `;
    // Update charts
    updateCharts();
  }

  /**
   * Update or create the Chart.js charts. Called whenever summary updates. It
   * reads the DB.daily array and DB.ftt array to derive datasets.
   */
  function updateCharts() {
    const dailySorted = [...DB.daily].sort((a, b) => new Date(a.date) - new Date(b.date));
    const labels = dailySorted.map(entry => formatDateLabel(entry.date));
    const moods = dailySorted.map(entry => parseFloat(entry.mood) || null);
    const anxieties = dailySorted.map(entry => parseFloat(entry.anxiety) || null);
    const stresses = dailySorted.map(entry => parseFloat(entry.stress) || null);
    const sleeps = dailySorted.map(entry => parseFloat(entry.sleepHours) || null);
    // FTT chart data by date and hand
    const fttSorted = [...DB.ftt].sort((a, b) => new Date(a.date) - new Date(b.date));
    const fttDates = fttSorted.map(r => formatDateLabel(r.date + 'T00:00:00'));
    const domVals = fttSorted.map(r => (r.hand === 'dominant' ? (r.avg || null) : null));
    const nonVals = fttSorted.map(r => (r.hand === 'nondominant' ? (r.avg || null) : null));

    // Create or update mood chart
    const moodCtx = document.getElementById('chartMood').getContext('2d');
    if (moodChart) {
      moodChart.data.labels = labels;
      moodChart.data.datasets[0].data = moods;
      moodChart.update();
    } else {
      moodChart = new Chart(moodCtx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Mood (1–10)',
              data: moods,
              fill: false,
              borderColor: 'rgba(76, 175, 80, 0.8)',
              tension: 0.1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
        },
      });
    }
    // Anxiety chart
    const anxCtx = document.getElementById('chartAnxiety').getContext('2d');
    if (anxietyChart) {
      anxietyChart.data.labels = labels;
      anxietyChart.data.datasets[0].data = anxieties;
      anxietyChart.update();
    } else {
      anxietyChart = new Chart(anxCtx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Anxiety (0–10)',
              data: anxieties,
              fill: false,
              borderColor: 'rgba(244, 67, 54, 0.8)',
              tension: 0.1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
        },
      });
    }
    // Stress chart
    const stressCtx = document.getElementById('chartStress').getContext('2d');
    if (stressChart) {
      stressChart.data.labels = labels;
      stressChart.data.datasets[0].data = stresses;
      stressChart.update();
    } else {
      stressChart = new Chart(stressCtx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Stress (0–10)',
              data: stresses,
              fill: false,
              borderColor: 'rgba(255, 193, 7, 0.8)',
              tension: 0.1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
        },
      });
    }
    // Sleep chart
    const sleepCtx = document.getElementById('chartSleep').getContext('2d');
    if (sleepChart) {
      sleepChart.data.labels = labels;
      sleepChart.data.datasets[0].data = sleeps;
      sleepChart.update();
    } else {
      sleepChart = new Chart(sleepCtx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Sleep hours',
              data: sleeps,
              fill: false,
              borderColor: 'rgba(33, 150, 243, 0.8)',
              tension: 0.1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
        },
      });
    }
    // FTT chart
    const fttCtx = document.getElementById('chartFtt').getContext('2d');
    if (fttChart) {
      fttChart.data.labels = fttDates;
      fttChart.data.datasets[0].data = domVals;
      fttChart.data.datasets[1].data = nonVals;
      fttChart.update();
    } else {
      fttChart = new Chart(fttCtx, {
        type: 'line',
        data: {
          labels: fttDates,
          datasets: [
            {
              label: 'Dominant',
              data: domVals,
              fill: false,
              borderColor: 'rgba(156, 39, 176, 0.8)',
              tension: 0.1,
            },
            {
              label: 'Non‑dominant',
              data: nonVals,
              fill: false,
              borderColor: 'rgba(0, 188, 212, 0.8)',
              tension: 0.1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: true } },
        },
      });
    }
  }

  /* --------------------------------------------------------------------------
   * Rendering lists of entries
   * ------------------------------------------------------------------------*/
  function renderDoseList() {
    const container = document.getElementById('doseList');
    container.innerHTML = '';
    if (!DB.doses.length) {
      container.textContent = 'No doses recorded yet.';
      return;
    }
    DB.doses
      .sort((a, b) => new Date(b.ts) - new Date(a.ts))
      .forEach(dose => {
        const div = document.createElement('div');
        div.className = 'entry';
        div.innerHTML = `<strong>${new Date(dose.ts).toLocaleString()}</strong> — ${dose.doseAmount}${dose.doseUnit} ${dose.substance}${dose.strain ? ' (' + dose.strain + ')' : ''} (${dose.route})`;
        container.appendChild(div);
      });
  }

  function renderDailyList() {
    const container = document.getElementById('dailyList');
    container.innerHTML = '';
    if (!DB.daily.length) {
      container.textContent = 'No daily entries yet.';
      return;
    }
    DB.daily
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .forEach(entry => {
        const div = document.createElement('div');
        div.className = 'entry';
        div.innerHTML = `<strong>${entry.date}</strong> — mood ${entry.mood}, anxiety ${entry.anxiety}, stress ${entry.stress}, sleep ${entry.sleepHours}h`;
        container.appendChild(div);
      });
  }

  function renderWeeklyList() {
    const container = document.getElementById('weeklyList');
    container.innerHTML = '';
    if (!DB.weekly.length) {
      container.textContent = 'No weekly check‑ins yet.';
      return;
    }
    DB.weekly
      .sort((a, b) => new Date(b.weekStart) - new Date(a.weekStart))
      .forEach(entry => {
        const div = document.createElement('div');
        div.className = 'entry';
        div.innerHTML = `<strong>${entry.weekStart}</strong> — PHQ‑9 ${entry.phq9.total}, GAD‑7 ${entry.gad7.total}, PSS‑10 ${entry.pss10.total}, WHO‑5 ${entry.who5.total}`;
        container.appendChild(div);
      });
  }

  /* --------------------------------------------------------------------------
   * Baseline handling
   * ------------------------------------------------------------------------*/
  function handleBaselineSave() {
    const initials = document.getElementById('blInitials').value.trim();
    const age = parseInt(document.getElementById('blAge').value) || null;
    const height = parseFloat(document.getElementById('blHeight').value) || null;
    const weight = parseFloat(document.getElementById('blWeight').value) || null;
    const hand = document.getElementById('blHand').value;
    const goalsSelect = document.getElementById('blGoals');
    const goals = Array.from(goalsSelect.selectedOptions).map(opt => opt.value);
    const protocolType = document.getElementById('blProtocol').value;
    let pattern = [];
    if (protocolType === 'fadiman') {
      pattern = [1, 0, 0, 1, 0, 0, 1];
    } else if (protocolType === 'stamets') {
      pattern = [1, 1, 1, 1, 0, 0, 0];
    } else {
      // Collect custom pattern toggles from baseline custom pattern area
      pattern = Array.from(document.querySelectorAll('#patternInputs input')).map(inp => (inp.checked ? 1 : 0));
    }
    // Collect questionnaires
    function getScaleValues(prefix, count) {
      const vals = [];
      for (let i = 0; i < count; i++) {
        const radios = document.getElementsByName(`${prefix}${i}`);
        let selected = null;
        radios.forEach(r => {
          if (r.checked) selected = parseInt(r.value);
        });
        if (selected === null) {
          return null;
        }
        vals.push(selected);
      }
      return vals;
    }
    const phqVals = getScaleValues('phq9q', phq9.length);
    const gadVals = getScaleValues('gad7q', gad7.length);
    const pssVals = getScaleValues('pss10q', pss10.length);
    const whoVals = getScaleValues('who5q', who5.length);
    if (!phqVals || !gadVals || !pssVals || !whoVals) {
      alert('Please answer all questionnaire questions.');
      return;
    }
    const baselineData = {
      date: new Date().toISOString().split('T')[0],
      phq9: { items: phqVals, total: sum(phqVals) },
      gad7: { items: gadVals, total: sum(gadVals) },
      pss10: { items: pssVals, total: sum(pssVals) },
      who5: { items: whoVals, total: sum(whoVals) },
      sleepHours: null,
      sleepQuality: null,
      rested: null,
      mood: null,
      anxiety: null,
      focus: null,
      energy: null,
      pain: null,
      libido: null,
      social: null,
    };
    // Save into DB
    DB.participant.initials = initials;
    DB.participant.age = age;
    DB.participant.heightCm = height;
    DB.participant.weightKg = weight;
    DB.participant.handDominance = hand;
    DB.participant.goals = goals;
    DB.participant.protocol = { type: protocolType, pattern: pattern };
    DB.baseline = baselineData;
    saveData(DB);
    // Show baseline summary
    const summaryDiv = document.getElementById('baselineSummary');
    summaryDiv.classList.remove('hidden');
    summaryDiv.innerHTML = `
      <p><strong>Baseline saved.</strong> PHQ‑9 score: ${baselineData.phq9.total} (${phqCategory(baselineData.phq9.total)}),
      GAD‑7 score: ${baselineData.gad7.total} (${gadCategory(baselineData.gad7.total)}), PSS‑10 score: ${baselineData.pss10.total} (${pssCategory(baselineData.pss10.total)}),
      WHO‑5 total: ${baselineData.who5.total} (${whoCategory(baselineData.who5.total)}).</p>
    `;
    updateSummary();
  }

  /* --------------------------------------------------------------------------
   * Dosing log handling
   * ------------------------------------------------------------------------*/
  function handleDoseSave() {
    const ts = document.getElementById('doseDate').value;
    if (!ts) {
      alert('Please choose a date and time for this dose.');
      return;
    }
    const amount = parseFloat(document.getElementById('doseAmount').value);
    if (isNaN(amount)) {
      alert('Please enter a dose amount.');
      return;
    }
    const unit = document.getElementById('doseUnit').value;
    const substance = document.getElementById('doseSubstance').value;
    const strain = document.getElementById('doseStrain').value.trim();
    const route = document.getElementById('doseRoute').value;
    const withFood = document.getElementById('doseFood').value === 'true';
    const context = document.getElementById('doseContext').value.trim();
    const notes = document.getElementById('doseNotes').value.trim();
    const adverse = document.getElementById('doseAdverse').value === 'true';
    const adverseNotes = adverse ? document.getElementById('doseAdverseNotes').value.trim() : '';
    const doseRecord = {
      id: uuid(),
      ts: ts,
      doseAmount: amount,
      doseUnit: unit,
      substance: substance,
      form: substance, // we treat form same as substance for simplicity
      strain: strain,
      route: route,
      withFood: withFood,
      context: context,
      acuteNotes: notes,
      adverse: adverse,
      adverseNotes: adverseNotes,
    };
    DB.doses.push(doseRecord);
    saveData(DB);
    renderDoseList();
    updateSummary();
    // Reset form
    document.getElementById('doseForm').reset();
    document.getElementById('doseAdverseNotesLabel').classList.add('hidden');
  }

  /* --------------------------------------------------------------------------
   * Daily log handling
   * ------------------------------------------------------------------------*/
  function handleDailySave() {
    const date = document.getElementById('dailyDate').value;
    if (!date) {
      alert('Please pick a date.');
      return;
    }
    const isDoseDay = document.getElementById('dailyDoseDay').value === 'true';
    const sleepHours = parseFloat(document.getElementById('dailySleep').value) || 0;
    const sleepQuality = parseInt(document.getElementById('dailySleepQuality').value) || 0;
    const rested = parseInt(document.getElementById('dailyRested').value) || 0;
    const mood = parseInt(document.getElementById('dailyMood').value) || 0;
    const anxiety = parseInt(document.getElementById('dailyAnxiety').value) || 0;
    const focus = parseInt(document.getElementById('dailyFocus').value) || 0;
    const energy = parseInt(document.getElementById('dailyEnergy').value) || 0;
    const stress = parseInt(document.getElementById('dailyStress').value) || 0;
    const productivity = parseInt(document.getElementById('dailyProductivity').value) || null;
    const social = parseInt(document.getElementById('dailySocial').value) || null;
    const libido = parseInt(document.getElementById('dailyLibido').value) || null;
    const giNotes = document.getElementById('dailyGi').value.trim();
    const otherNotes = document.getElementById('dailyOther').value.trim();
    const adverse = document.getElementById('dailyAdverse').value === 'true';
    const adverseNotes = adverse ? document.getElementById('dailyAdverseNotes').value.trim() : '';
    if (!sleepHours && !mood && !anxiety && !focus && !energy && !stress) {
      alert('Please fill out at least one of the quick log fields.');
      return;
    }
    const dailyRecord = {
      id: uuid(),
      date: date,
      isDoseDay: isDoseDay,
      sleepHours: sleepHours,
      sleepQuality: sleepQuality,
      rested: rested,
      mood: mood,
      anxiety: anxiety,
      focus: focus,
      energy: energy,
      stress: stress,
      productivity: productivity,
      social: social,
      libido: libido,
      giNotes: giNotes,
      otherNotes: otherNotes,
      adverse: adverse,
      safetyNotes: adverseNotes,
    };
    // Remove any existing record for this date to avoid duplicates
    DB.daily = DB.daily.filter(e => e.date !== date);
    DB.daily.push(dailyRecord);
    saveData(DB);
    renderDailyList();
    updateSummary();
    document.getElementById('dailyForm').reset();
    document.getElementById('dailyAdverseNotesLabel').classList.add('hidden');
  }

  /* --------------------------------------------------------------------------
   * Weekly check-in handling
   * ------------------------------------------------------------------------*/
  function handleWeeklySave() {
    const weekStart = document.getElementById('weeklyDate').value;
    if (!weekStart) {
      alert('Please choose the start date of the week.');
      return;
    }
    function getWeeklyScaleValues(containerId, count) {
      const arr = [];
      for (let i = 0; i < count; i++) {
        const radios = document.getElementsByName(`${containerId}${i}`);
        let selected = null;
        radios.forEach(r => {
          if (r.checked) selected = parseInt(r.value);
        });
        if (selected === null) return null;
        arr.push(selected);
      }
      return arr;
    }
    const phqVals = getWeeklyScaleValues('weeklyPhq', phq9.length);
    const gadVals = getWeeklyScaleValues('weeklyGad', gad7.length);
    const pssVals = getWeeklyScaleValues('weeklyPss', pss10.length);
    const whoVals = getWeeklyScaleValues('weeklyWho', who5.length);
    if (!phqVals || !gadVals || !pssVals || !whoVals) {
      alert('Please answer all weekly questions.');
      return;
    }
    const notes = document.getElementById('weeklyNotes').value.trim();
    const weeklyRecord = {
      id: uuid(),
      weekStart: weekStart,
      phq9: { items: phqVals, total: sum(phqVals) },
      gad7: { items: gadVals, total: sum(gadVals) },
      pss10: { items: pssVals, total: sum(pssVals) },
      who5: { items: whoVals, total: sum(whoVals) },
      notes: notes,
    };
    // Replace if same week exists
    DB.weekly = DB.weekly.filter(e => e.weekStart !== weekStart);
    DB.weekly.push(weeklyRecord);
    saveData(DB);
    renderWeeklyList();
    updateSummary();
    document.getElementById('weeklyForm').reset();
  }

  /* --------------------------------------------------------------------------
   * FTT handling
   * ------------------------------------------------------------------------*/
  const fttState = {
    hand: 'dominant',
    trialCount: 0,
    counts: [],
    timer: null,
    running: false,
  };
  function startFttTrial() {
    if (fttState.running) return;
    fttState.hand = document.getElementById('fttHand').value;
    // If starting first trial or continuing
    const tapArea = document.getElementById('fttTapArea');
    const timerEl = document.getElementById('fttTimer');
    const resultsEl = document.getElementById('fttResults');
    fttState.count = 0;
    fttState.running = true;
    tapArea.textContent = 'Tap fast!';
    tapArea.classList.add('active');
    // Haptic start
    if (navigator.vibrate) navigator.vibrate(100);
    let secondsLeft = 10;
    timerEl.textContent = secondsLeft + ' s';
    const tick = () => {
      secondsLeft--;
      timerEl.textContent = secondsLeft > 0 ? secondsLeft + ' s' : 'Stop';
      if (secondsLeft <= 0) {
        clearInterval(fttState.timer);
        endFttTrial();
      }
    };
    // Start countdown every second
    fttState.timer = setInterval(tick, 1000);
    // Reset counts array if starting new set
    if (fttState.trialCount === 0) {
      fttState.counts = [];
    }
  }
  function handleFttTap() {
    if (!fttState.running) return;
    fttState.count++;
  }
  function endFttTrial() {
    fttState.running = false;
    const tapArea = document.getElementById('fttTapArea');
    const timerEl = document.getElementById('fttTimer');
    tapArea.textContent = 'Tap here';
    tapArea.classList.remove('active');
    // Record result
    fttState.counts.push(fttState.count);
    fttState.trialCount++;
    const resultsEl = document.getElementById('fttResults');
    resultsEl.innerHTML = `Trial ${fttState.trialCount}: ${fttState.count} taps`;
    // Haptic stop
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    if (fttState.trialCount < 3) {
      resultsEl.innerHTML += '<br/>Rest for 30–60 s then start the next trial.';
    } else {
      // Compute average and save
      const avg = fttState.counts.reduce((a, b) => a + b, 0) / fttState.counts.length;
      const dateStr = new Date().toISOString().split('T')[0];
      const fttRecord = {
        id: uuid(),
        date: dateStr,
        hand: fttState.hand,
        trialSeconds: 10,
        trial1: fttState.counts[0],
        trial2: fttState.counts[1],
        trial3: fttState.counts[2],
        avg: avg,
        device: navigator.userAgent,
        notes: '',
      };
      DB.ftt.push(fttRecord);
      saveData(DB);
      updateSummary();
      resultsEl.innerHTML += `<br/><strong>Average for ${fttState.hand} hand:</strong> ${avg.toFixed(1)} taps per 10 s.`;
      // Reset counters for next set
      fttState.trialCount = 0;
      fttState.counts = [];
    }
  }

  /* --------------------------------------------------------------------------
   * Export & Import handling
   * ------------------------------------------------------------------------*/
  function exportJson() {
    const json = JSON.stringify(DB, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'microdose-data.json';
    a.textContent = 'Download JSON';
    a.style.display = 'block';
    a.style.marginBottom = '0.5rem';
    const output = document.getElementById('exportOutput');
    output.innerHTML = '';
    output.appendChild(a);
    // Also show JSON in plain text for copy
    const pre = document.createElement('pre');
    pre.textContent = json;
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.fontSize = '0.8rem';
    output.appendChild(pre);
  }

  /**
   * Convert an array of objects into CSV string. The header row is built from
   * the union of all keys. Values are escaped to handle commas and quotes.
   */
  function arrayToCsv(arr) {
    if (!arr.length) return '';
    const keys = Array.from(new Set(arr.reduce((acc, obj) => acc.concat(Object.keys(obj)), [])));
    const lines = [];
    lines.push(keys.join(','));
    arr.forEach(obj => {
      const row = keys.map(k => {
        const val = obj[k];
        if (val === undefined || val === null) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      });
      lines.push(row.join(','));
    });
    return lines.join('\n');
  }

  function exportCsvs() {
    const files = {
      baseline: DB.baseline ? [DB.baseline] : [],
      doses: DB.doses,
      daily: DB.daily,
      weekly: DB.weekly,
      ftt: DB.ftt,
      pvt: DB.pvt,
    };
    const output = document.getElementById('exportOutput');
    output.innerHTML = '';
    Object.keys(files).forEach(name => {
      const arr = files[name];
      if (!arr.length) return;
      const csv = arrayToCsv(arr);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name}.csv`;
      a.textContent = `Download ${name}.csv`;
      a.style.display = 'block';
      output.appendChild(a);
    });
    if (!output.innerHTML) {
      output.textContent = 'No data to export.';
    }
  }

  function showRawData() {
    const output = document.getElementById('exportOutput');
    output.innerHTML = '<pre>' + JSON.stringify(DB, null, 2) + '</pre>';
  }

  function importData() {
    const text = document.getElementById('importData').value.trim();
    if (!text) {
      alert('Please paste JSON data to import.');
      return;
    }
    let obj;
    try {
      obj = JSON.parse(text);
    } catch (e) {
      alert('Invalid JSON.');
      return;
    }
    // Simple validation: check basic keys
    if (!obj.meta || !obj.participant || !obj.daily) {
      alert('Invalid data format.');
      return;
    }
    DB = obj;
    saveData(DB);
    // Refresh UI lists and summary
    renderDoseList();
    renderDailyList();
    renderWeeklyList();
    updateSummary();
    alert('Data imported successfully.');
  }

  /* --------------------------------------------------------------------------
   * Settings handling
   * ------------------------------------------------------------------------*/
  function initSettings() {
    const protocolSelect = document.getElementById('settingsProtocol');
    const patternContainer = document.getElementById('settingsPattern');
    // Load current protocol values
    protocolSelect.value = DB.participant.protocol.type || 'fadiman';
    renderPatternSelectors(patternContainer, DB.participant.protocol.pattern || []);
    // Show custom pattern area if needed
    if (protocolSelect.value === 'custom') {
      document.getElementById('settingsCustomPattern').classList.remove('hidden');
    }
    protocolSelect.addEventListener('change', () => {
      const val = protocolSelect.value;
      if (val === 'custom') {
        document.getElementById('settingsCustomPattern').classList.remove('hidden');
      } else {
        document.getElementById('settingsCustomPattern').classList.add('hidden');
      }
    });
    // Large text
    const largeToggle = document.getElementById('settingsLargeText');
    largeToggle.checked = document.body.classList.contains('large-text');
    largeToggle.addEventListener('change', () => {
      document.body.classList.toggle('large-text', largeToggle.checked);
    });
    // Theme
    const themeSelect = document.getElementById('settingsTheme');
    themeSelect.value = document.body.classList.contains('light') ? 'light' : 'dark';
    themeSelect.addEventListener('change', () => {
      if (themeSelect.value === 'light') {
        document.body.classList.add('light');
        document.body.classList.remove('dark');
      } else {
        document.body.classList.add('dark');
        document.body.classList.remove('light');
      }
    });
    // Clear data
    document.getElementById('settingsClear').addEventListener('click', () => {
      if (confirm('This will permanently delete all data. Continue?')) {
        DB = clearData();
        renderDoseList();
        renderDailyList();
        renderWeeklyList();
        updateSummary();
        alert('All data cleared.');
      }
    });
  }

  /**
   * Render toggles for a 7‑day pattern into a container. Each toggle is a
   * checkbox representing a day (Sun to Sat). If pattern array is provided,
   * precheck accordingly.
   */
  function renderPatternSelectors(container, pattern) {
    container.innerHTML = '';
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    days.forEach((day, idx) => {
      const label = document.createElement('label');
      label.style.display = 'flex';
      label.style.alignItems = 'center';
      label.style.marginRight = '0.5rem';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = pattern[idx] === 1;
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(' ' + day));
      container.appendChild(label);
    });
  }

  /* --------------------------------------------------------------------------
   * Navigation handling
   * ------------------------------------------------------------------------*/
  function initNavigation() {
    const nav = document.getElementById('bottomNav');
    nav.addEventListener('click', evt => {
      if (evt.target.tagName !== 'BUTTON') return;
      const target = evt.target.dataset.target;
      showSection(target);
    });
  }
  function showSection(id) {
    document.querySelectorAll('main section').forEach(sec => {
      if (sec.id === id) {
        sec.classList.add('active');
      } else {
        sec.classList.remove('active');
      }
    });
  }

  /* --------------------------------------------------------------------------
   * Service worker registration
   * ------------------------------------------------------------------------*/
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(err => {
        console.warn('Service worker registration failed:', err);
      });
    }
  }

  /* --------------------------------------------------------------------------
   * Initialisation on page load
   * ------------------------------------------------------------------------*/
  document.addEventListener('DOMContentLoaded', () => {
    // Populate baseline pattern selectors
    const patternContainer = document.getElementById('patternInputs');
    renderPatternSelectors(patternContainer, DB.participant.protocol.pattern);
    // Create baseline question blocks
    createScale(
      document.getElementById('phq9-questions'),
      phq9,
      phq9Options,
      'phq9q'
    );
    createScale(
      document.getElementById('gad7-questions'),
      gad7,
      gad7Options,
      'gad7q'
    );
    createScale(
      document.getElementById('pss10-questions'),
      pss10,
      pss10Options,
      'pss10q'
    );
    createScale(
      document.getElementById('who5-questions'),
      who5,
      who5Options,
      'who5q'
    );
    // Create weekly scale questions (use unique name prefixes for weekly)
    createScale(
      document.getElementById('weekly-phq9'),
      phq9,
      phq9Options,
      'weeklyPhq'
    );
    createScale(
      document.getElementById('weekly-gad7'),
      gad7,
      gad7Options,
      'weeklyGad'
    );
    createScale(
      document.getElementById('weekly-pss10'),
      pss10,
      pss10Options,
      'weeklyPss'
    );
    createScale(
      document.getElementById('weekly-who5'),
      who5,
      who5Options,
      'weeklyWho'
    );
    // Baseline protocol selection change
    document.getElementById('blProtocol').addEventListener('change', evt => {
      const val = evt.target.value;
      const customDiv = document.getElementById('customPattern');
      if (val === 'custom') {
        customDiv.classList.remove('hidden');
      } else {
        customDiv.classList.add('hidden');
      }
    });
    // Show/hide adverse note fields
    document.getElementById('doseAdverse').addEventListener('change', evt => {
      document
        .getElementById('doseAdverseNotesLabel')
        .classList.toggle('hidden', evt.target.value !== 'true');
    });
    document.getElementById('dailyAdverse').addEventListener('change', evt => {
      document
        .getElementById('dailyAdverseNotesLabel')
        .classList.toggle('hidden', evt.target.value !== 'true');
    });
    // Save buttons
    document.getElementById('saveBaseline').addEventListener('click', handleBaselineSave);
    document.getElementById('saveDose').addEventListener('click', handleDoseSave);
    document.getElementById('saveDaily').addEventListener('click', handleDailySave);
    document.getElementById('saveWeekly').addEventListener('click', handleWeeklySave);
    // FTT interactions
    document.getElementById('fttStart').addEventListener('click', startFttTrial);
    document
      .getElementById('fttTapArea')
      .addEventListener('pointerdown', handleFttTap);
    // Export/Import buttons
    document.getElementById('exportJson').addEventListener('click', exportJson);
    document.getElementById('exportCsv').addEventListener('click', exportCsvs);
    document.getElementById('showData').addEventListener('click', showRawData);
    document.getElementById('importJson').addEventListener('click', importData);
    // Initialise lists
    renderDoseList();
    renderDailyList();
    renderWeeklyList();
    // Summary and charts
    updateSummary();
    // Navigation
    initNavigation();
    // Settings
    initSettings();
    // Register service worker
    registerServiceWorker();
  });
})();