/**
 * نظام بوابة دخول التلاميذ وقبول الأستاذ خليل
 * Classroom Gate & Student Admission System
 * إعداد: ورشات الأستاذ خليل للأردوينو والابتكار
 */

(function () {
  'use strict';

  // الثوابت والإعدادات
  const STORAGE_KEY_STUDENT = 'khalil_approved_student';
  const STORAGE_KEY_PENDING = 'khalil_pending_request';
  const STORAGE_KEY_PIN = 'khalil_classroom_pin';
  const DEFAULT_PIN = '2026';

  const MQTT_HOST = 'broker.emqx.io';
  const MQTT_PORT = 8084;
  const MQTT_PATH = '/mqtt';
  const TOPIC_REQUESTS = 'khalil_arduino_class/requests';
  const TOPIC_APPROVALS = 'khalil_arduino_class/approvals';

  let mqttClient = null;
  let broadcastChannel = null;
  let pingInterval = null;
  let currentStudentId = null;
  let currentStudentName = '';

  // تحديد مسار الصور بناءً على مكان الصفحة
  function getAssetsBasePath() {
    const path = window.location.pathname;
    if (path.includes('/projects/')) {
      return '../../';
    }
    return '';
  }

  // نغمة صوتية ترحيبية عند القبول (Web Audio API بدون أي ملفات خارجية)
  function playSuccessChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
        gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.5);
      });
    } catch (e) {
      console.warn('Audio chime unsupported:', e);
    }
  }

  // التحقق مما إذا كان التلميذ مقبولاً بالفعل
  function getApprovedStudent() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_STUDENT);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  // حفظ التلميذ كمقبول
  function saveApprovedStudent(student) {
    localStorage.setItem(STORAGE_KEY_STUDENT, JSON.stringify(student));
    localStorage.removeItem(STORAGE_KEY_PENDING);
    if (pingInterval) clearInterval(pingInterval);
  }

  // مسح جلسة التلميذ (تسجيل خروج)
  function logoutStudent() {
    localStorage.removeItem(STORAGE_KEY_STUDENT);
    localStorage.removeItem(STORAGE_KEY_PENDING);
    window.location.reload();
  }

  // عرض شارة التلميذ في أعلى الصفحة
  function showStudentPill(student) {
    let pill = document.getElementById('studentSessionPill');
    if (!pill) {
      pill = document.createElement('div');
      pill.id = 'studentSessionPill';
      pill.className = 'student-session-pill';
      document.body.appendChild(pill);
    }

    pill.innerHTML = `
      <span class="student-dot" title="متصل بالورشة"></span>
      <span>التلميذ: <strong>${escapeHtml(student.name)}</strong></span>
      <button class="btn-logout-gate" id="btnLogoutGate" title="تسجيل الخروج أو تبديل الاسم">خروج ✕</button>
    `;

    document.getElementById('btnLogoutGate').addEventListener('click', () => {
      if (confirm(`هل تريد تسجيل خروج التلميذ «${student.name}» من الحصة؟`)) {
        logoutStudent();
      }
    });
  }

  // إنشاء واجهة البوابة المنبثقة
  function injectGatekeeperUI() {
    if (document.getElementById('classroomGateOverlay')) return;

    const base = getAssetsBasePath();
    const overlay = document.createElement('div');
    overlay.id = 'classroomGateOverlay';
    overlay.className = 'classroom-gate-overlay';

    overlay.innerHTML = `
      <div class="classroom-gate-card">
        <div class="gate-top-bar"></div>

        <!-- رأس البوابة -->
        <div class="gate-header-icon">
          <img src="${base}assets/images/teacher_khalil.jpg" alt="الأستاذ خليل">
          <span class="gate-status-dot"></span>
        </div>

        <h2 class="gate-title">ورشات الأستاذ خليل</h2>
        <p class="gate-subtitle">أكاديمية الأردوينو والابتكار للأطفال 🚀</p>

        <!-- 1. نموذج طلب الانضمام -->
        <div id="gateRegisterView">
          <p style="font-size:0.95rem; color:#334155; margin-bottom:1.25rem; font-weight:700;">
            أهلاً بك يا بطل! 👋 أدخل اسمك للانضمام إلى ورشة اليوم:
          </p>

          <form id="gateRegisterForm">
            <div class="gate-form-group">
              <label class="gate-label" for="gateStudentName">اسم التلميذ الكامل 🏷️</label>
              <input type="text" id="gateStudentName" class="gate-input" placeholder="مثال: يوسف بن علي" required autocomplete="name" autofocus>
            </div>



            <button type="submit" class="gate-submit-btn" id="btnSubmitGate">
              <span>طلب الانضمام للحصة</span> 🚀
            </button>
          </form>

          <div class="gate-pin-toggle">
            لديك رمز الحصة السريع من الأستاذ؟ 
            <button type="button" id="btnTogglePin">اضغط هنا لإدخاله 🔑</button>
            
            <div class="gate-pin-box" id="gatePinBox">
              <p style="margin:0 0 0.5rem; font-size:0.85rem; color:#475569;">أدخل رمز الحصة المكون من 4 أرقام:</p>
              <div class="gate-pin-inputs">
                <input type="text" maxlength="4" id="gateQuickPinInput" class="gate-input" style="width:130px; text-align:center; font-size:1.4rem; letter-spacing:4px; font-weight:900;" placeholder="••••">
                <button type="button" class="gate-submit-btn" id="btnVerifyQuickPin" style="margin:0; width:auto; padding:0.6rem 1rem;">دخول 🔓</button>
              </div>
              <span id="pinErrorMsg" style="color:#dc2626; font-size:0.8rem; display:none;">⚠️ رمز الحصة غير صحيح!</span>
            </div>
          </div>
        </div>

        <!-- 2. شاشة الانتظار المباشرة -->
        <div id="gateWaitingView" class="gate-waiting-view">
          <div class="gate-radar-spinner">
            <span style="font-size:2.2rem;">⏳</span>
          </div>

          <div class="gate-student-badge">
            <span>التلميذ:</span>
            <strong id="waitingStudentNameDisplay">--</strong>
          </div>

          <div class="gate-waiting-status">
            <span>🟡 تم إرسال طلبك بنجاح للأستاذ خليل</span>
          </div>

          <p style="font-size:0.92rem; color:#64748b; line-height:1.7; margin-bottom:1.5rem;">
            يرجى الانتظار لحظة... سيتم فتح المنصة لك فور أن يضغط الأستاذ خليل على زر القبول في لوحة التحكم الخاصة به 👨‍🏫✨
          </p>

          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:0.75rem; font-size:0.85rem; color:#475569;">
            📡 الاتصال المباشر بالحصة: <span style="color:#16a34a; font-weight:700;">نشط ومتصل 🟢</span>
          </div>
        </div>

        <!-- 3. شاشة النجاح والقبول -->
        <div id="gateSuccessView" class="gate-success-view">
          <div class="gate-success-icon">🎉</div>
          <h3 style="font-size:1.6rem; font-weight:900; color:#15803d; margin:0 0 0.5rem;">
            تم قبولك بنجاح!
          </h3>
          <p style="font-size:1.05rem; color:#334155; margin-bottom:1rem;">
            مرحباً بك يا <strong id="successStudentNameDisplay" style="color:var(--gate-primary);">--</strong> في ورشة الأستاذ خليل! 🌟
          </p>
          <p style="font-size:0.88rem; color:#64748b;">
            جاري فتح المنصة والدخول للمشاريع... 🚀
          </p>
        </div>

      </div>
    `;

    document.body.appendChild(overlay);

    // إضافة زر لوحة الأستاذ الخفي في أسفل الشاشة
    
    // إعداد الأحداث
    setupGateEvents();
  }

  // إضافة اختصار سري للأستاذ خليل (النقر 3 مرات على صورته الشخصية أو Ctrl+Alt+K)
  function setupSecretTeacherTrigger() {
    let clicks = 0;
    let timer = null;
    document.addEventListener('click', (e) => {
      const img = e.target.closest('img');
      if (img && (img.src.includes('teacher_khalil') || (img.alt && img.alt.includes('خليل')))) {
        clicks++;
        clearTimeout(timer);
        if (clicks >= 3) {
          clicks = 0;
          const base = getAssetsBasePath();
          window.location.href = `${base}admin.html`;
        } else {
          timer = setTimeout(() => { clicks = 0; }, 1000);
        }
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.altKey && (e.key === 'k' || e.key === 'K' || e.key === 'ع' || e.key === 'ك')) {
        const base = getAssetsBasePath();
        window.location.href = `${base}admin.html`;
      }
    });
  }

  // إعداد أحداث واجهة البوابة
  function setupGateEvents() {
    const regForm = document.getElementById('gateRegisterForm');
    const btnTogglePin = document.getElementById('btnTogglePin');
    const pinBox = document.getElementById('gatePinBox');
    const btnVerifyQuickPin = document.getElementById('btnVerifyQuickPin');
    const quickPinInput = document.getElementById('gateQuickPinInput');
    const pinErrorMsg = document.getElementById('pinErrorMsg');

    if (btnTogglePin && pinBox) {
      btnTogglePin.addEventListener('click', () => {
        pinBox.classList.toggle('gate-active');
        if (pinBox.classList.contains('gate-active') && quickPinInput) {
          quickPinInput.focus();
        }
      });
    }

    if (btnVerifyQuickPin && quickPinInput) {
      btnVerifyQuickPin.addEventListener('click', () => {
        verifyDirectPin(quickPinInput.value.trim());
      });
      quickPinInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          verifyDirectPin(quickPinInput.value.trim());
        }
      });
    }

    if (regForm) {
      regForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const nameInp = document.getElementById('gateStudentName');
        const name = nameInp ? nameInp.value.trim() : '';

        if (name.length < 2) {
          alert('يرجى إدخال اسم التلميذ بشكل صحيح!');
          return;
        }

        submitStudentRequest(name, '');
      });
    }
  }

  // التحقق من رمز الحصة المباشر
  function verifyDirectPin(pin) {
    const validPin = localStorage.getItem(STORAGE_KEY_PIN) || DEFAULT_PIN;
    const pinErrorMsg = document.getElementById('pinErrorMsg');
    const nameInp = document.getElementById('gateStudentName');
    const name = (nameInp && nameInp.value.trim()) || 'مخترع الأردوينو';

    if (pin === validPin) {
      if (pinErrorMsg) pinErrorMsg.style.display = 'none';
      approveStudentLocally(currentStudentId || ('std_' + Date.now()), name, 'دخول برمز الحصة');
    } else {
      if (pinErrorMsg) pinErrorMsg.style.display = 'block';
    }
  }

  // إرسال طلب الانضمام والتحول لغرفة الانتظار
  function submitStudentRequest(name, group) {
    currentStudentId = 'std_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    currentStudentName = name;

    const requestData = {
      id: currentStudentId,
      name: name,
      group: group || 'عام',
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    };

    // حفظ الطلب المعلق محلياً
    localStorage.setItem(STORAGE_KEY_PENDING, JSON.stringify(requestData));

    // إظهار شاشة الانتظار
    showWaitingView(name);

    // بث الطلب عبر BroadcastChannel (للتبويبات المحلية)
    broadcastLocalMessage({ type: 'student_request', student: requestData });

    // بث الطلب عبر MQTT (للأجهزة الأخرى كالهاتف والكمبيوتر)
    publishMqtt(TOPIC_REQUESTS, { type: 'student_request', student: requestData });

    // تكرار البث كل 5 ثوانٍ لضمان وصوله إذا فتح الأستاذ اللوحة بعد قليل
    if (pingInterval) clearInterval(pingInterval);
    pingInterval = setInterval(() => {
      const stillPending = localStorage.getItem(STORAGE_KEY_PENDING);
      if (stillPending) {
        publishMqtt(TOPIC_REQUESTS, { type: 'student_ping', student: requestData });
        broadcastLocalMessage({ type: 'student_ping', student: requestData });
      } else {
        clearInterval(pingInterval);
      }
    }, 5000);
  }

  // إظهار شاشة الانتظار
  function showWaitingView(name) {
    const regView = document.getElementById('gateRegisterView');
    const waitView = document.getElementById('gateWaitingView');
    const nameDisplay = document.getElementById('waitingStudentNameDisplay');

    if (regView) regView.style.display = 'none';
    if (waitView) waitView.classList.add('gate-active');
    if (nameDisplay) nameDisplay.textContent = name;
  }

  // تنفيذ القبول والترحيب بالتلميذ
  function approveStudentLocally(id, name, group) {
    const student = {
      id: id || currentStudentId,
      name: name || currentStudentName || 'التلميذ البطل',
      group: group || '',
      approvedAt: Date.now()
    };

    saveApprovedStudent(student);
    playSuccessChime();

    const waitView = document.getElementById('gateWaitingView');
    const regView = document.getElementById('gateRegisterView');
    const succView = document.getElementById('gateSuccessView');
    const succName = document.getElementById('successStudentNameDisplay');

    if (waitView) waitView.classList.remove('gate-active');
    if (regView) regView.style.display = 'none';
    if (succView) succView.classList.add('gate-active');
    if (succName) succName.textContent = student.name;

    // بعد 1.2 ثانية إخفاء النافذة وفك القفل
    setTimeout(() => {
      const overlay = document.getElementById('classroomGateOverlay');
      if (overlay) {
        overlay.classList.add('gate-hidden');
      }
      document.body.style.overflow = '';
      showStudentPill(student);
    }, 1300);
  }

  // إعداد قناة البث المحلي BroadcastChannel
  function initBroadcastChannel() {
    if ('BroadcastChannel' in window) {
      try {
        broadcastChannel = new BroadcastChannel('khalil_classroom_channel');
        broadcastChannel.onmessage = (event) => {
          handleIncomingMessage(event.data);
        };
      } catch (e) {
        console.warn('BroadcastChannel error:', e);
      }
    }

    // الاستماع أيضاً لتغيرات localStorage (يعمل في كافة المتصفحات القديمة والحديثة)
    window.addEventListener('storage', (e) => {
      if (e.key === 'khalil_last_approval' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          handleIncomingMessage(data);
        } catch (err) {}
      }
    });
  }

  function broadcastLocalMessage(data) {
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage(data);
      } catch (e) {}
    }
  }

  // معالجة الرسائل الواردة (سواء من MQTT أو من BroadcastChannel)
  function handleIncomingMessage(msg) {
    if (!msg || !msg.type) return;

    // استلام موافقة فردية
    if (msg.type === 'student_approved') {
      if (msg.studentId === currentStudentId || (currentStudentName && msg.studentName === currentStudentName)) {
        approveStudentLocally(msg.studentId, msg.studentName, msg.group);
      }
    }

    // استلام موافقة جماعية لجميع الطلاب
    if (msg.type === 'approve_all_students') {
      const pending = localStorage.getItem(STORAGE_KEY_PENDING);
      if (pending) {
        try {
          const p = JSON.parse(pending);
          approveStudentLocally(p.id, p.name, p.group);
        } catch (e) {
          approveStudentLocally(currentStudentId, currentStudentName, '');
        }
      }
    }

    // استلام أمر طرد أو إعادة قفل
    if (msg.type === 'revoke_student' && msg.studentId === currentStudentId) {
      alert('تم إنهاء جلستك من قبل الأستاذ خليل.');
      logoutStudent();
    }
  }

  // إعداد اتصال Paho MQTT السحابي المباشر فائق السرعة عبر WSS
  function initMqtt() {
    if (typeof Paho === 'undefined' || !Paho.MQTT || !Paho.MQTT.Client) {
      setTimeout(initMqtt, 500);
      return;
    }

    try {
      const clientId = 'khalil_std_' + Math.random().toString(16).substring(2, 8);
      mqttClient = new Paho.MQTT.Client(MQTT_HOST, MQTT_PORT, MQTT_PATH, clientId);

      mqttClient.onConnectionLost = (resp) => {
        console.warn('MQTT connection lost:', resp ? resp.errorMessage : '');
        setTimeout(connectMqtt, 3000);
      };

      mqttClient.onMessageArrived = (msg) => {
        try {
          const payload = JSON.parse(msg.payloadString);
          handleIncomingMessage(payload);
        } catch (e) {}
      };

      connectMqtt();
    } catch (e) {
      console.warn('MQTT Init error:', e);
    }
  }

  function connectMqtt() {
    if (!mqttClient) return;
    try {
      mqttClient.connect({
        useSSL: true,
        timeout: 5,
        keepAliveInterval: 30,
        cleanSession: true,
        onSuccess: () => {
          try {
            mqttClient.subscribe(TOPIC_APPROVALS);
            // إذا كان التلميذ بانتظار الموافقة، أعد بث طلبه فوراً
            const pendingStr = localStorage.getItem(STORAGE_KEY_PENDING);
            if (pendingStr) {
              const p = JSON.parse(pendingStr);
              currentStudentId = p.id;
              currentStudentName = p.name;
              publishMqtt(TOPIC_REQUESTS, { type: 'student_request', student: p });
            }
          } catch (e) {}
        },
        onFailure: (err) => {
          setTimeout(connectMqtt, 4000);
        }
      });
    } catch (e) {
      setTimeout(connectMqtt, 4000);
    }
  }

  function publishMqtt(topic, data) {
    if (mqttClient && mqttClient.isConnected()) {
      try {
        const msg = new Paho.MQTT.Message(JSON.stringify(data));
        msg.destinationName = topic;
        mqttClient.send(msg);
      } catch (e) {}
    }
  }

  // حماية ضد التلاعب بالـ HTML (XSS prevention)
  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  // بداية تشغيل المنظومة
  function init() {
    initBroadcastChannel();
    setupSecretTeacherTrigger();
    initMqtt();

    const approved = getApprovedStudent();

    if (approved) {
      // التلميذ مقبول مسبقاً، نظهر شارة الجلسة فقط ولا نحجب الشاشة
      showStudentPill(approved);
          } else {
      // التلميذ لم يُقبل بعد، نقفل الشاشة ونظهر نافذة البوابة
      document.body.style.overflow = 'hidden';
      injectGatekeeperUI();

      // التحقق مما إذا كان هناك طلب معلق سابق
      const pendingStr = localStorage.getItem(STORAGE_KEY_PENDING);
      if (pendingStr) {
        try {
          const p = JSON.parse(pendingStr);
          currentStudentId = p.id;
          currentStudentName = p.name;
          showWaitingView(p.name);
        } catch (e) {}
      }
    }
  }

  // تشغيل عند اكتمال تحميل الصفحة
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

