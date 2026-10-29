/**
 * مشروع المنزل الذكي: الباب الأوتوماتيكي بتقنية RFID مع أردوينو
 * كود التفاعل والمحاكاة التعليمية - ورشة الأستاذ خليل
 */

document.addEventListener('DOMContentLoaded', () => {
  initReadingProgress();
  initAudioSystem();
  initDoorSimulation();
  initComponentFilters();
  initInteractiveWiring();
  initCodeViewer();
  initSerialMonitorMockup();
  initTestingChecklist();
  initTroubleshooting();
  initChallenges();
  initQuiz();
  initCertificateGenerator();
});

/* ==========================================================================
   1. شريط التقدم عند التمرير (READING PROGRESS BAR)
   ========================================================================== */
function initReadingProgress() {
  const progressBar = document.getElementById('readingProgress');
  if (!progressBar) return;

  window.addEventListener('scroll', () => {
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (totalHeight > 0) {
      const progress = (window.scrollY / totalHeight) * 100;
      progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    }
  });
}

/* ==========================================================================
   2. نظام المؤثرات الصوتية البسيطة عبر Web Audio API
   (يعمل محلياً بالكامل دون الحاجة لأي ملفات خارجية قد تفشل في التحميل)
   ========================================================================== */
let audioCtx = null;
let soundEnabled = true;

function initAudioSystem() {
  const soundBtn = document.getElementById('soundToggleBtn');
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      soundBtn.classList.toggle('muted', !soundEnabled);
      soundBtn.innerHTML = soundEnabled ? '🔊 الصوت: مفعل' : '🔇 الصوت: صامت';
    });
  }
}

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(freq, type = 'sine', duration = 0.15, delay = 0) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    
    setTimeout(() => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    }, delay * 1000);
  } catch (e) {
    console.warn('Audio play error:', e);
  }
}

function playScanBeep() {
  playTone(880, 'sine', 0.08); // نبضة استشعار البطاقة
}

function playAccessGrantedChime() {
  playTone(523.25, 'triangle', 0.12, 0);     // C5
  playTone(659.25, 'triangle', 0.12, 0.12);  // E5
  playTone(783.99, 'triangle', 0.25, 0.24);  // G5
  playTone(1046.50, 'sine', 0.35, 0.36);     // C6
}

function playAccessDeniedBuzzer() {
  playTone(220, 'sawtooth', 0.18, 0);
  playTone(180, 'sawtooth', 0.25, 0.18);
}

function playServoHum() {
  playTone(140, 'triangle', 0.35, 0);
}

/* ==========================================================================
   3. محاكاة الباب الذكي التفاعلية (DOOR SIMULATION)
   ========================================================================== */
const AUTHORIZED_UID = "8310632D"; // المعرف الحقيقي من صور ورشة الأستاذ خليل!

function initDoorSimulation() {
  const doorLeaf = document.getElementById('simDoorLeaf');
  const servoHorn = document.getElementById('simServoHorn');
  const rfidModule = document.getElementById('simRfidModule');
  const lcdText = document.getElementById('simLcdText');
  const serialLog = document.getElementById('simSerialLog');
  const timerBar = document.getElementById('simTimerBar');
  const timerFill = document.getElementById('simTimerFill');
  const buzzerModule = document.getElementById('simBuzzerModule');
  const ledStatusPill = document.getElementById('simLedStatusPill');
  const ledStatusMsg = document.getElementById('simLedStatusMsg');
  
  const authBtn = document.getElementById('simBtnAuth');
  const unauthBtn = document.getElementById('simBtnUnauth');
  const customInput = document.getElementById('simCustomUid');
  const customBtn = document.getElementById('simBtnCustom');
  const resetBtn = document.getElementById('simBtnReset');

  let isBusy = false;
  let countdownTimer = null;

  function updateLcd(line1, line2) {
    if (lcdText) {
      lcdText.innerHTML = `${line1}<br>${line2}`;
    }
  }

  function appendLog(text, type = 'info') {
    if (!serialLog) return;
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    entry.textContent = `[${time}] ${text}`;
    serialLog.appendChild(entry);
    serialLog.scrollTop = serialLog.scrollHeight;
  }

  function resetToIdle() {
    isBusy = false;
    if (doorLeaf) doorLeaf.classList.remove('is-open');
    if (servoHorn) servoHorn.classList.remove('is-open');
    if (rfidModule) {
      rfidModule.classList.remove('scan-success', 'scan-fail');
    }
    if (buzzerModule) buzzerModule.classList.remove('alarm-active');
    if (ledStatusPill) ledStatusPill.className = 'sim-led-status-pill';
    if (ledStatusMsg) ledStatusMsg.textContent = 'في انتظار تمرير البطاقة...';
    if (timerBar) timerBar.classList.remove('active');
    if (timerFill) timerFill.style.width = '100%';
    updateLcd('Smart Home Door', 'Scan your card...');
  }

  function processCard(uid) {
    if (isBusy) return;
    isBusy = true;

    playScanBeep();
    if (rfidModule) rfidModule.classList.remove('scan-success', 'scan-fail');

    updateLcd('Reading card...', `UID: ${uid}`);
    appendLog(`Card UID: ${uid}`);

    setTimeout(() => {
      if (uid.toUpperCase() === AUTHORIZED_UID) {
        // 🟢 بطاقة صحيحة: لا يشتغل جرس الإنذار (صامت)، ويفتح الباب
        if (rfidModule) rfidModule.classList.add('scan-success');
        if (buzzerModule) buzzerModule.classList.remove('alarm-active');
        if (ledStatusPill) ledStatusPill.className = 'sim-led-status-pill status-granted';
        if (ledStatusMsg) ledStatusMsg.textContent = '🟢 بطاقة صحيحة: الباب يفتح تلقائيًا وجرس الإنذار صامت!';

        updateLcd('Access Granted!', 'Buzzer: OFF (Silent)');
        appendLog('Access Granted! [Buzzer: SILENT]', 'granted');
        appendLog('Opening Door for 3s...', 'granted');

        // فتح الباب بمحرك السيرفو
        setTimeout(() => {
          playServoHum();
          if (doorLeaf) doorLeaf.classList.add('is-open');
          if (servoHorn) servoHorn.classList.add('is-open');
        }, 150);

        // تفعيل شريط العد التنازلي 3 ثوانٍ
        if (timerBar && timerFill) {
          timerBar.classList.add('active');
          timerFill.style.transition = 'none';
          timerFill.style.width = '100%';
          setTimeout(() => {
            timerFill.style.transition = 'width 3s linear';
            timerFill.style.width = '0%';
          }, 50);
        }

        // الانتظار 3 ثوانٍ ثم إغلاق الباب
        countdownTimer = setTimeout(() => {
          playServoHum();
          if (doorLeaf) doorLeaf.classList.remove('is-open');
          if (servoHorn) servoHorn.classList.remove('is-open');
          updateLcd('Door Closed', 'Scan your card...');
          appendLog('Door Closed.', 'info');

          setTimeout(() => {
            resetToIdle();
          }, 800);
        }, 3000);

      } else {
        // 🚨 بطاقة خاطئة: تشغيل جرس الإنذار والباب يظل مغلقاً
        playAccessDeniedBuzzer();
        if (rfidModule) rfidModule.classList.add('scan-fail');
        if (buzzerModule) buzzerModule.classList.add('alarm-active');
        if (doorLeaf) doorLeaf.classList.remove('is-open');
        if (servoHorn) servoHorn.classList.remove('is-open');
        if (ledStatusPill) ledStatusPill.className = 'sim-led-status-pill status-denied';
        if (ledStatusMsg) ledStatusMsg.textContent = '🚨 بطاقة خاطئة: جرس الإنذار يطلق صفارة تحذير والباب مغلق!';

        updateLcd('Access Denied!', 'ALARM BUZZER ON!');
        appendLog('Access Denied! [BUZZER: ALARM ON!]', 'denied');
        appendLog('Door remains closed.', 'denied');

        setTimeout(() => {
          resetToIdle();
        }, 2200);
      }
    }, 400);
  }

  if (authBtn) {
    authBtn.addEventListener('click', () => processCard(AUTHORIZED_UID));
  }

  if (unauthBtn) {
    unauthBtn.addEventListener('click', () => processCard("F4829910"));
  }

  if (customBtn && customInput) {
    customBtn.addEventListener('click', () => {
      const val = customInput.value.trim().toUpperCase() || "ABCD1234";
      processCard(val);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (countdownTimer) clearTimeout(countdownTimer);
      resetToIdle();
      appendLog('System Reset', 'info');
    });
  }

  // الضغط على القارئ نفسه في النموذج لتجربة البطاقة
  if (rfidModule) {
    rfidModule.addEventListener('click', () => {
      processCard(AUTHORIZED_UID);
    });
  }
}

/* ==========================================================================
   4. تصفية مستكشف المكونات (COMPONENT EXPLORER FILTERS)
   ========================================================================== */
function initComponentFilters() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  const cards = document.querySelectorAll('.component-card');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;
      cards.forEach(card => {
        if (filter === 'all' || card.dataset.category === filter) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

/* ==========================================================================
   5. مختبر التوصيلات التفاعلي (INTERACTIVE WIRING LAB)
   ========================================================================== */
function initInteractiveWiring() {
  const tableRows = document.querySelectorAll('.interactive-table tbody tr');
  const wirePaths = document.querySelectorAll('.wire-path');
  const infoText = document.getElementById('wiringSelectedInfo');

  function highlightConnection(pinKey, details) {
    // إلغاء التحديد السابق
    tableRows.forEach(r => r.classList.remove('active-row'));
    wirePaths.forEach(w => w.classList.remove('highlighted'));

    // تفعيل الصف المطابق
    const targetRow = document.querySelector(`tr[data-pin="${pinKey}"]`);
    if (targetRow) targetRow.classList.add('active-row');

    // تفعيل السلك المطابق في الـ SVG
    const targetWire = document.getElementById(`wire-${pinKey}`);
    if (targetWire) targetWire.classList.add('highlighted');

    // تحديث صندوق التوضيح الفوري
    if (infoText && details) {
      infoText.innerHTML = `<strong>${details.name}:</strong> ${details.desc}`;
    }
  }

  // التفاعل من خلال صفوف الجدول
  tableRows.forEach(row => {
    row.addEventListener('click', () => {
      const pinKey = row.dataset.pin;
      const name = row.cells[0]?.textContent || '';
      const target = row.cells[1]?.textContent || '';
      const desc = row.cells[2]?.textContent || '';
      highlightConnection(pinKey, { name: `${name} ➔ ${target}`, desc });
    });
  });

  // التفاعل من خلال أسلاك الـ SVG
  wirePaths.forEach(wire => {
    wire.addEventListener('click', () => {
      const pinKey = wire.id.replace('wire-', '');
      const targetRow = document.querySelector(`tr[data-pin="${pinKey}"]`);
      if (targetRow) {
        targetRow.click();
      }
    });
  });
}

/* ==========================================================================
   6. عارض الكود وتفسيرات المفاهيم (CODE VIEWER & CONCEPT CARDS)
   ========================================================================== */
function initCodeViewer() {
  const copyBtn = document.getElementById('copyCodeBtn');
  const codeElement = document.getElementById('arduinoSourceCode');
  const conceptCards = document.querySelectorAll('.code-concept-card');

  if (copyBtn && codeElement) {
    copyBtn.addEventListener('click', () => {
      const codeText = codeElement.innerText;
      navigator.clipboard.writeText(codeText).then(() => {
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '✅ تم النسخ بنجاح!';
        copyBtn.style.background = 'var(--color-success)';
        setTimeout(() => {
          copyBtn.innerHTML = originalText;
          copyBtn.style.background = '';
        }, 2500);
      }).catch(err => {
        console.error('Copy failed:', err);
      });
    });
  }

  // التفاعل مع بطاقات شرح أجزاء الكود
  conceptCards.forEach(card => {
    card.addEventListener('click', () => {
      conceptCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      const targetToken = card.dataset.target;
      if (targetToken) {
        // تمرير إلى السطر التقريبي في الكود
        const tokenElem = document.querySelector(`.token-${targetToken}`);
        if (tokenElem) {
          tokenElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
          tokenElem.style.outline = '2px solid #facc15';
          setTimeout(() => { tokenElem.style.outline = 'none'; }, 2000);
        }
      }
    });
  });
}

/* ==========================================================================
   7. محاكي Serial Monitor التفاعلي لاكتشاف UID
   ========================================================================== */
function initSerialMonitorMockup() {
  const screen = document.getElementById('serialScreen');
  const scanBtn = document.getElementById('serialScanBtn');
  const clearBtn = document.getElementById('serialClearBtn');
  const copyUidBtn = document.getElementById('serialCopyUidBtn');

  if (!screen) return;

  function appendSerial(text) {
    const line = document.createElement('div');
    line.textContent = text;
    screen.appendChild(line);
    screen.scrollTop = screen.scrollHeight;
  }

  if (scanBtn) {
    scanBtn.addEventListener('click', () => {
      playScanBeep();
      appendSerial('--- تم تقريب بطاقة جديدة ---');
      setTimeout(() => {
        appendSerial('Card UID: 31C1BA75');
        appendSerial('Access Granted!');
        appendSerial('Opening Door...');
        playAccessGrantedChime();
      }, 500);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      screen.innerHTML = '<div>Smart Home Door System</div><div>Scan your card...</div>';
    });
  }

  if (copyUidBtn) {
    copyUidBtn.addEventListener('click', () => {
      navigator.clipboard.writeText('31C1BA75').then(() => {
        const orig = copyUidBtn.textContent;
        copyUidBtn.textContent = '✅ تم نسخ UID!';
        setTimeout(() => { copyUidBtn.textContent = orig; }, 2000);
      });
    });
  }
}

/* ==========================================================================
   8. جدول اختبار الباب الذكي مع حفظ التقدم في المتصفح
   ========================================================================== */
function initTestingChecklist() {
  const rows = document.querySelectorAll('.test-row');
  const progressFill = document.getElementById('testsProgressFill');
  const progressText = document.getElementById('testsProgressText');
  const celebration = document.getElementById('testCelebrationBanner');

  let completedTests = JSON.parse(localStorage.getItem('smartDoorTests') || '[]');

  function updateTestUI() {
    rows.forEach((row, index) => {
      if (completedTests.includes(index)) {
        row.classList.add('completed');
        const box = row.querySelector('.test-checkbox');
        if (box) box.textContent = '✓';
      } else {
        row.classList.remove('completed');
        const box = row.querySelector('.test-checkbox');
        if (box) box.textContent = '';
      }
    });

    const percent = Math.round((completedTests.length / rows.length) * 100);
    if (progressFill) progressFill.style.width = `${percent}%`;
    if (progressText) progressText.textContent = `${percent}% (${completedTests.length} من ${rows.length})`;

    if (celebration) {
      if (completedTests.length === rows.length && rows.length > 0) {
        celebration.classList.add('active');
        playAccessGrantedChime();
      } else {
        celebration.classList.remove('active');
      }
    }
  }

  rows.forEach((row, index) => {
    row.addEventListener('click', () => {
      if (completedTests.includes(index)) {
        completedTests = completedTests.filter(i => i !== index);
      } else {
        completedTests.push(index);
        playTone(600, 'sine', 0.1);
      }
      localStorage.setItem('smartDoorTests', JSON.stringify(completedTests));
      updateTestUI();
    });
  });

  updateTestUI();
}

/* ==========================================================================
   9. مختبر تشخيص وحل المشكلات
   ========================================================================== */
function initTroubleshooting() {
  // تفاعل بسيط لبطاقات الأعطال لإبراز الفحص الدقيق
  const troubleCards = document.querySelectorAll('.trouble-card');
  troubleCards.forEach(card => {
    card.addEventListener('click', () => {
      troubleCards.forEach(c => c.style.borderColor = '');
      card.style.borderColor = 'var(--color-primary)';
    });
  });
}

/* ==========================================================================
   10. تحديات المهندسين الصغار
   ========================================================================== */
function initChallenges() {
  const hintToggles = document.querySelectorAll('.btn-toggle-hint');
  hintToggles.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const hintBox = btn.closest('.challenge-card').querySelector('.challenge-hint-box');
      if (hintBox) {
        const isHidden = hintBox.style.display === 'none' || !hintBox.style.display;
        hintBox.style.display = isHidden ? 'block' : 'none';
        btn.textContent = isHidden ? 'إخفاء التلميح 💡' : 'شاهد تلميح الأستاذ 💡';
      }
    });
  });
}

/* ==========================================================================
   11. اختبار المعلومات الذكي (QUIZ)
   ========================================================================== */
const quizQuestions = [
  {
    q: "ما هو المكوّن الذي يمثل «العضلات» المنفذة لحركة فتح الباب وإغلاقه؟",
    options: [
      { text: "قارئ RFID RC522", correct: false },
      { text: "محرك السيرفو SG90", correct: true },
      { text: "لوحة Arduino Uno", correct: false },
      { text: "لوحة التجارب Breadboard", correct: false }
    ],
    explanation: "محرك السيرفو SG90 هو المحرك الميكانيكي الدقيق الذي يتحول أمر البرمجة إلى حركة دورانية لفتح الباب بزاوية 90 درجة ثم إغلاقه."
  },
  {
    q: "ما هو الجهد الكهربائي الصحيح والآمن لتغذية قارئ البطاقات RC522؟",
    options: [
      { text: "5V من منفذ الأردوينو", correct: false },
      { text: "3.3V من منفذ الأردوينو", correct: true },
      { text: "9V من بطارية خارجية", correct: false },
      { text: "12V من محول الحائط", correct: false }
    ],
    explanation: "يحتاج قارئ RC522 إلى جهد 3.3V فقط. توصيله بـ 5V في منفذ الطاقة قد يؤدي إلى تلف الشريحة اللاسلكية فوراً!"
  },
  {
    q: "ما هي وظيفة التعليمة `delay(3000);` في كود فتح الباب؟",
    options: [
      { text: "إلغاء قراءة البطاقة نهائياً", correct: false },
      { text: "الانتظار لمدة 3 ثوانٍ قبل إغلاق الباب تلقائياً", correct: true },
      { text: "تسريع دوران محرك السيرفو 3 مرات", correct: false },
      { text: "تشغيل جرس الإنذار لمدة 3000 دقيقة", correct: false }
    ],
    explanation: "الدالة `delay(3000)` تجعل Arduino ينتظر 3000 ميلي ثانية (أي 3 ثوانٍ كاملة) ليبقى الباب مفتوحاً حتى يدخل الشخص، ثم يغلقه."
  },
  {
    q: "إذا قرّب شخص بطاقة غير مسجلة في البرنامج، فماذا يحدث في كود Arduino؟",
    options: [
      { text: "يحترق محرك السيرفو", correct: false },
      { text: "ينفّذ البرنامج أوامر قسم `else` ويبقى الباب مغلقاً", correct: true },
      { text: "يفتح الباب نصف فتحة", correct: false },
      { text: "يُعاد تشغيل الحاسوب تلقائياً", correct: false }
    ],
    explanation: "بما أن شرط `if (uid == AUTHORIZED_UID)` لم يتحقق، يتجه المعالج فوراً إلى قسم `else` الذي يطبع رسالة الرفض ويترك الباب في زاوية الإغلاق (0°)."
  },
  {
    q: "عند استخدام بطارية خارجية لتغذية محرك السيرفو، لماذا يجب توصيل سلك GND المشترك؟",
    options: [
      { text: "لتوفير نقطة مرجعية كهربائية مشتركة لإشارة التحكم بين Arduino والمحرك", correct: true },
      { text: "لجعل لون السيرفو أزرق ساطعاً", correct: false },
      { text: "لمضاعفة سرعة الأردوينو إلى 10 أضعاف", correct: false },
      { text: "لحماية الكرتون من الرطوبة", correct: false }
    ],
    explanation: "بدون أرضي مشترك (Common Ground)، لن يستطيع محرك السيرفو قراءة إشارة التحكم القادمة من منفذ D6 لأن فروق الجهد لا تكون متناسقة."
  }
];

function initQuiz() {
  const container = document.getElementById('quizQuestionsContainer');
  const scoreBadge = document.getElementById('quizScoreBadge');
  if (!container) return;

  let score = 0;
  let answeredCount = 0;

  quizQuestions.forEach((item, qIndex) => {
    const qBlock = document.createElement('div');
    qBlock.className = 'question-block';

    const title = document.createElement('div');
    title.className = 'question-title';
    title.textContent = `${qIndex + 1}. ${item.q}`;
    qBlock.appendChild(title);

    const optionsGrid = document.createElement('div');
    optionsGrid.className = 'options-grid';

    const feedback = document.createElement('div');
    feedback.className = 'quiz-feedback';

    item.options.forEach((opt, optIndex) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.textContent = opt.text;

      btn.addEventListener('click', () => {
        // قفل جميع خيارات هذا السؤال
        const allBtns = optionsGrid.querySelectorAll('.option-btn');
        allBtns.forEach(b => b.disabled = true);

        if (opt.correct) {
          btn.classList.add('correct');
          feedback.className = 'quiz-feedback show correct';
          feedback.innerHTML = `<strong>إجابة ممتازة وذكية! 🌟</strong> ${item.explanation}`;
          score++;
          playTone(800, 'sine', 0.15);
        } else {
          btn.classList.add('wrong');
          feedback.className = 'quiz-feedback show wrong';
          feedback.innerHTML = `<strong>إجابة غير دقيقة. 💡</strong> ${item.explanation}`;
          // إبراز الإجابة الصحيحة
          item.options.forEach((o, idx) => {
            if (o.correct) allBtns[idx].classList.add('correct');
          });
          playTone(250, 'sawtooth', 0.2);
        }

        answeredCount++;
        if (scoreBadge) {
          scoreBadge.textContent = `النتيجة: ${score} من ${quizQuestions.length}`;
        }
      });

      optionsGrid.appendChild(btn);
    });

    qBlock.appendChild(optionsGrid);
    qBlock.appendChild(feedback);
    container.appendChild(qBlock);
  });
}

/* ==========================================================================
   12. صانع شهادة التميز والاحتفال (CERTIFICATE & CELEBRATION)
   ========================================================================== */
function initCertificateGenerator() {
  const genBtn = document.getElementById('certGenBtn');
  const nameInput = document.getElementById('certStudentNameInput');
  const preview = document.getElementById('certPreview');
  const targetName = document.getElementById('certDisplayName');
  const certDate = document.getElementById('certDisplayDate');
  const printCertBtn = document.getElementById('printCertBtn');

  if (genBtn && nameInput && preview && targetName) {
    genBtn.addEventListener('click', () => {
      const name = nameInput.value.trim();
      if (!name) {
        alert('من فضلك اكتب اسمك أو اسم الطالب أولاً!');
        nameInput.focus();
        return;
      }

      targetName.textContent = name;
      if (certDate) {
        const today = new Date().toLocaleDateString('ar-EG', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        certDate.textContent = today;
      }

      preview.classList.add('visible');
      playAccessGrantedChime();

      // تشغيل مؤثر القصاصات المبهجة (Confetti)
      triggerConfetti();

      preview.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  if (printCertBtn) {
    printCertBtn.addEventListener('click', () => {
      window.print();
    });
  }
}

// مؤثر الاحتفال بالقصاصات الملونة في المتصفح
function triggerConfetti() {
  const colors = ['#0284c7', '#0d9488', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
  const confettiCount = 60;

  for (let i = 0; i < confettiCount; i++) {
    const el = document.createElement('div');
    el.style.position = 'fixed';
    el.style.zIndex = '9999';
    el.style.top = '-20px';
    el.style.left = `${Math.random() * 100}vw`;
    el.style.width = `${Math.random() * 10 + 6}px`;
    el.style.height = `${Math.random() * 14 + 8}px`;
    el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    el.style.borderRadius = '3px';
    el.style.opacity = '1';
    el.style.transform = `rotate(${Math.random() * 360}deg)`;
    el.style.transition = `top ${Math.random() * 2 + 1.5}s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 2s linear, opacity 1.5s ease-out`;

    document.body.appendChild(el);

    setTimeout(() => {
      el.style.top = '105vh';
      el.style.transform = `rotate(${Math.random() * 720}deg) translate(${Math.random() * 100 - 50}px)`;
      el.style.opacity = '0';
    }, 20);

    setTimeout(() => {
      el.remove();
    }, 3500);
  }
}
