/**
 * منطق بوابة ورشات الأستاذ خليل للمشاريع الأسبوعية
 * إدارة وعرض وإضافة المشاريع الأسبوعية ديناميكياً
 */

const DEFAULT_PROJECTS = [
  {
    "id": "buzzer-wire-game",
    "week": 1,
    "title": "لعبة سلك الإنذار والتركيز مع أردوينو والجرس",
    "titleEn": "Buzz Wire Steady Hand Game with Arduino",
    "summary": "صنع لعبة تحدي التركيز الشهيرة؛ سلك معدني متعرج وحلقة يمررها الطفل بحذر، فإذا لامست السلك يطلق الأردوينو صفارة الإنذار ويومض ضوء التنبيه ويسجل لمسات الخطأ!",
    "status": "completed",
    "statusLabel": "الأسبوع الماضي (مكتمل) ✅",
    "duration": "45 دقيقة",
    "level": "مبتدئ وممتع ⭐",
    "category": "الألعاب التفاعلية والدوائر",
    "image": "assets/images/buzz_wire_infographic.jpg",
    "url": "projects/buzzer-wire-game/index.html",
    "components": ["Arduino Uno", "Buzzer (جرس طنان)", "LED أحمر وLED أخضر", "سلك نحاسي متعرج وحلقة", "مقاومات 220Ω"],
    "learningGoals": [
      "فهم مفهوم الدائرة الكهربائية المفتوحة والمغلقة",
      "استخدام خاصية المقاومة الداخلية INPUT_PULLUP",
      "برمجة الترددات الصوتية باستخدام دالة tone()",
      "حساب عدد الأخطاء وبناء لعبة تفاعلية ميكانيكية"
    ]
  },
  {
    "id": "rfid-smart-door",
    "week": 2,
    "title": "المنزل الذكي: الباب الأوتوماتيكي بتقنية RFID",
    "titleEn": "Smart Home RFID Automatic Door",
    "summary": "بناء منزل كرتوني ذكي بباب أوتوماتيكي ومحرك سيرفو يفتح بالبطاقة المبرمجة فقط مع شاشة تفاعلية وتغذية آمنة 3.3V ومحاكاة حية كاملة.",
    "status": "active",
    "statusLabel": "الأسبوع الحالي (نشط) 🟢",
    "duration": "45-60 دقيقة",
    "level": "مبتدئ متدرج ⭐⭐",
    "category": "الأنظمة الذكية والمحركات",
    "image": "assets/images/project_cardboard_house_3.jpg",
    "url": "projects/rfid-smart-door/index.html",
    "components": ["Arduino Uno", "RC522 RFID", "SG90 Servo", "Breadboard", "Cardboard"],
    "learningGoals": [
      "فهم دور المتحكم الدقيق وعضلات محرك السيرفو",
      "قراءة معرّف البطاقة اللاسلكي السري (UID)",
      "استخدام الشروط المنطقية if/else في اتخاذ القرارات",
      "بناء نموذج ميكانيكي متزن من خامات الكرتون"
    ]
  }
];

let allProjects = [];

document.addEventListener('DOMContentLoaded', () => {
  loadProjects();
  initPortalFilters();
  initTeacherModal();
});

function loadProjects() {
  const localAdded = JSON.parse(localStorage.getItem('khalilProjects') || '[]');
  
  // نعتمد المشروعين الأساسيين (الأسبوع الماضي والأسبوع الحالي) مع أي مشاريع إضافية يضيفها الأستاذ
  allProjects = [...DEFAULT_PROJECTS];
  localAdded.forEach(lp => {
    if (!allProjects.some(p => p.id === lp.id)) {
      allProjects.push(lp);
    }
  });

  // فرز المشاريع حسب رقم الأسبوع
  allProjects.sort((a, b) => a.week - b.week);

  renderProjects('all');
  updateStats();
}

function updateStats() {
  const countElem = document.getElementById('statTotalProjects');
  const activeCountElem = document.getElementById('statActiveProjects');
  if (countElem) countElem.textContent = `${allProjects.length} مشاريع`;
  if (activeCountElem) {
    const active = allProjects.filter(p => p.status === 'active' || p.status === 'completed').length;
    activeCountElem.textContent = `${active} متاحة`;
  }
}

function renderProjects(filter = 'all') {
  const grid = document.getElementById('curriculumProjectsGrid');
  if (!grid) return;

  grid.innerHTML = '';

  const filtered = allProjects.filter(p => {
    if (filter === 'all') return true;
    if (filter === 'active') return p.status === 'active';
    if (filter === 'completed') return p.status === 'completed';
    return true;
  });

  filtered.forEach(project => {
    const card = document.createElement('div');
    const isCurrent = project.status === 'active';
    card.className = `curriculum-card ${isCurrent ? 'active-card' : ''}`;
    
    const tagsHtml = (project.components || []).map(c => `<span class="comp-tag">${c}</span>`).join('');

    card.innerHTML = `
      <div class="curriculum-card-media">
        <img src="${project.image}" alt="${project.title}">
        <div class="week-badge-pill">الأسبوع ${project.week} ${project.status === 'completed' ? '✅' : '🌟'}</div>
      </div>
      <div class="curriculum-card-body">
        <div class="curriculum-meta-row">
          <span>⏱️ ${project.duration}</span>
          <span>${project.level}</span>
        </div>
        <h3 class="curriculum-card-title">${project.title}</h3>
        <span class="curriculum-card-title-en">${project.titleEn}</span>
        <p class="curriculum-card-summary">${project.summary}</p>
        
        <div class="curriculum-tags">
          ${tagsHtml}
        </div>

        <div class="curriculum-card-action">
          <a href="${project.url}" class="btn ${isCurrent ? 'btn-primary' : 'btn-secondary'}" style="width:100%;">
            <span>${isCurrent ? 'ادخل إلى ورشة هذا الأسبوع 🚀' : 'مراجعة درس الأسبوع الماضي 📖'}</span>
          </a>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });
}

function initPortalFilters() {
  const buttons = document.querySelectorAll('.btn-filter-portal');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderProjects(btn.dataset.filter);
    });
  });
}

function initTeacherModal() {
  const openBtn = document.getElementById('openAddProjectModalBtn');
  const closeBtn = document.getElementById('closeAddProjectModalBtn');
  const backdrop = document.getElementById('teacherModalBackdrop');
  const form = document.getElementById('addProjectForm');

  if (openBtn && backdrop) {
    openBtn.addEventListener('click', () => {
      backdrop.classList.add('open');
      const nextWeekInput = document.getElementById('inpWeekNum');
      if (nextWeekInput) {
        nextWeekInput.value = allProjects.length + 1;
      }
    });
  }

  if (closeBtn && backdrop) {
    closeBtn.addEventListener('click', () => {
      backdrop.classList.remove('open');
    });
  }

  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.classList.remove('open');
    });
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const weekNum = parseInt(document.getElementById('inpWeekNum').value) || (allProjects.length + 1);
      const titleAr = document.getElementById('inpTitleAr').value.trim();
      const titleEn = document.getElementById('inpTitleEn').value.trim() || 'Smart Arduino Project';
      const summary = document.getElementById('inpSummary').value.trim();
      const components = document.getElementById('inpComponents').value.split(',').map(s => s.trim()).filter(Boolean);
      const duration = document.getElementById('inpDuration').value.trim() || '60 دقيقة';
      const level = document.getElementById('inpLevel').value || 'مبتدئ وممتع ⭐';
      const status = document.getElementById('inpStatus').value || 'upcoming';

      const newId = `project-week-${weekNum}`;

      const newProj = {
        id: newId,
        week: weekNum,
        title: titleAr,
        titleEn: titleEn,
        summary: summary,
        status: status,
        statusLabel: status === 'active' ? 'الأسبوع القادم 📅' : 'قريباً ⏳',
        duration: duration,
        level: level,
        category: 'مشروع إلكتروني',
        image: 'assets/images/project_cardboard_house_3.jpg',
        url: `projects/lesson-template/index.html?project=${newId}`,
        components: components.length ? components : ['Arduino Uno', 'Sensors'],
        learningGoals: ['بناء الدائرة الإلكترونية واختبارها', 'كتابة وفهم كود التحكم البرمجي']
      };

      const localAdded = JSON.parse(localStorage.getItem('khalilProjects') || '[]');
      localAdded.push(newProj);
      localStorage.setItem('khalilProjects', JSON.stringify(localAdded));

      loadProjects();

      alert(`🎉 تم إضافة مشروع «الأسبوع ${weekNum}: ${titleAr}» بنجاح إلى جدول ورشات الأستاذ خليل!`);
      backdrop.classList.remove('open');
      form.reset();
    });
  }
}
