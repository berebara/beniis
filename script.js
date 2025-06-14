// Self-invoking function to avoid polluting the global scope
(() => {
    // #region ================== CORE SETUP & HELPERS (Shared) ==================
    const storage = {
        get: (key, defaultValue) => {
            const stored = localStorage.getItem(key);
            return stored ? JSON.parse(stored) : defaultValue;
        },
        set: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
    };

    const formatDate = (dateString) => {
        if (!dateString) return '...';
        const [y, m, d] = dateString.split('-');
        return `${d}.${m}.${y}`;
    };

    const populateSemesterDropdowns = () => {
        document.querySelectorAll('.semester-select').forEach(select => {
            if (select.options.length > 0) return;
            for (let i = 1; i <= 8; i++) {
                select.add(new Option(`${i} семестр`, i));
            }
        });
    };
    // #endregion

    // #region ================== MAIN PAGE LOGIC ==================
    function initializeMainPage() {
        const applicationsContainer = document.getElementById('applications-container');
        if (!applicationsContainer) return; // Exit if we're not on the main page

        // Applications
        const applications = storage.get('applications', []);
        const appRows = applications.map(app => `
            <div class="table-row-placeholder ${app.status === 'Одобрена' ? 'approved' : 'rejected'}">
                <span>${app.status}</span><span>${formatDate(app.submissionDate)}</span>
                <span>С: ${formatDate(app.actionDateStart)}<br>По: ${formatDate(app.actionDateEnd)}</span>
                <span>Заявление по ОРВИ</span><span>${app.rejectionReason || ''}</span>
            </div>`).join('');
        applicationsContainer.innerHTML = `<div class="table-placeholder">
            <div class="table-header"><span>Статус</span><span>Дата подачи</span><span>Период действия</span><span>Тип документа</span><span>Причина отказа</span></div>
            ${appRows.length > 0 ? appRows : '<p class="no-data">Нет данных.</p>'}
        </div>`;

        // Absences
        const activeSemester = storage.get('activeAbsenceSemester', '1');
        const allAbsences = storage.get('absences', []);
        const semesterData = allAbsences.find(a => a.semester === activeSemester) || { months: {} };
        const { m1, m2, m3, m4 } = semesterData.months;
        const totalHours = [m1, m2, m3, m4].reduce((sum, h) => sum + Number(h || 0), 0);
        const isAutumn = parseInt(activeSemester) % 2 !== 0;
        const months = isAutumn ? ['Сентябрь', 'Октябрь', 'Ноябрь', 'Дек-Янв'] : ['Февраль', 'Март', 'Апрель', 'Май-Июнь'];
        document.getElementById('absences-semester-display').textContent = `Данные за ${activeSemester} семестр`;
        document.getElementById('absences-total').textContent = `Всего за семестр: ${totalHours} ч.`;
        document.getElementById('absences-container').innerHTML = `
            <span>${months[0]}</span><span>${months[1]}</span><span>${months[2]}</span><span>${months[3]}</span>
            <span>${m1 || 0} ч.</span><span>${m2 || 0} ч.</span><span>${m3 || 0} ч.</span><span>${m4 || 0} ч.</span>`;

        // References
        const referencesContainer = document.getElementById('references-container');
        const allRefs = storage.get('references', []);
        const grouped = allRefs.reduce((acc, ref) => {
            (acc[ref.semester] = acc[ref.semester] || []).push(ref);
            return acc;
        }, {});
        const sortedSemesters = Object.keys(grouped).sort((a, b) => b - a);
        let refContent = '';
        sortedSemesters.forEach(semester => {
            refContent += `<div class="semester-header-row"><span>${semester} семестр</span></div>`;
            refContent += grouped[semester].map(ref => `
                <div class="table-row-placeholder">
                    <span>${ref.type}</span><span>${formatDate(ref.startDate)}</span><span>${formatDate(ref.endDate)}</span><span></span>
                </div>`).join('');
        });
        referencesContainer.innerHTML = `<div class="table-placeholder">
            <div class="table-header"><span>Тип документа</span><span>Дата начала</span><span>Дата окончания</span><span>Примечания</span></div>
            ${refContent.length > 0 ? refContent : '<p class="no-data">Нет данных.</p>'}
        </div>`;
    }
    // #endregion

    // #region ================== PROFILE PAGE LOGIC ==================
    function initializeProfilePage() {
        const applicationsManager = document.getElementById('applications-manager');
        if (!applicationsManager) return; // Exit if we're not on the profile page

        // --- CRUD Manager ---
        const setupCrud = (formId, listId, storageKey, renderListFunc) => {
            const form = document.getElementById(formId);
            const list = document.getElementById(listId);
            const clearBtn = document.getElementById(formId.replace('-form', '-clear-btn'));

            form.addEventListener('submit', e => {
                e.preventDefault();
                const formData = new FormData(form);
                const newItem = {};
                for (let [key, value] of formData.entries()) {
                    newItem[key] = value;
                }
                if (!newItem.id) newItem.id = Date.now().toString();

                let items = storage.get(storageKey, []);
                const existingIndex = items.findIndex(item => item.id === newItem.id);
                if (existingIndex > -1) {
                    items[existingIndex] = newItem;
                } else {
                    items.push(newItem);
                }
                storage.set(storageKey, items);
                form.reset();
                form.querySelector('input[type="hidden"]').value = '';
                renderListFunc();
            });

            clearBtn.addEventListener('click', () => {
                form.reset();
                form.querySelector('input[type="hidden"]').value = '';
            });

            list.addEventListener('click', e => {
                const button = e.target.closest('button');
                if (!button) return;
                const id = button.dataset.id;
                if (button.classList.contains('delete')) {
                    if (confirm('Вы уверены?')) {
                        let items = storage.get(storageKey, []).filter(item => item.id !== id);
                        storage.set(storageKey, items);
                        renderListFunc();
                    }
                } else if (button.classList.contains('edit')) {
                    const itemToEdit = storage.get(storageKey, []).find(item => item.id === id);
                    if (itemToEdit) {
                        for (const key in itemToEdit) {
                            const input = form.querySelector(`[name="${key}"]`);
                            if (input) input.value = itemToEdit[key];
                        }
                    }
                }
            });
        };

        const renderAppList = () => document.getElementById('application-list').innerHTML = storage.get('applications', []).map(app => `<div class="management-item"><span>${app.status} | Сем: ${app.semester} | ${formatDate(app.actionDateStart)}</span><div><button class="btn-icon-action edit" data-id="${app.id}"><i class="fas fa-edit"></i></button><button class="btn-icon-action delete" data-id="${app.id}"><i class="fas fa-trash"></i></button></div></div>`).join('');
        const renderRefList = () => document.getElementById('reference-list').innerHTML = storage.get('references', []).map(ref => `<div class="management-item"><span>${ref.type} | Сем: ${ref.semester} | ${formatDate(ref.startDate)}</span><div><button class="btn-icon-action edit" data-id="${ref.id}"><i class="fas fa-edit"></i></button><button class="btn-icon-action delete" data-id="${ref.id}"><i class="fas fa-trash"></i></button></div></div>`).join('');

        setupCrud('application-form', 'application-list', 'applications', renderAppList);
        setupCrud('reference-form', 'reference-list', 'references', renderRefList);
        renderAppList();
        renderRefList();

        // --- Absences Form ---
        const absencesSemesterSelect = document.getElementById('absences-semester-edit');
        const updateAbsencesForm = (semester) => {
            const isAutumn = parseInt(semester) % 2 !== 0;
            const months = isAutumn ? ['Сентябрь', 'Октябрь', 'Ноябрь', 'Дек-Янв'] : ['Февраль', 'Март', 'Апрель', 'Май-Июнь'];
            for(let i=1; i<=4; i++) document.getElementById(`absences-month-${i}-label`).firstChild.textContent = `${months[i-1]} (часы):`;
            const semesterData = storage.get('absences', []).find(a => a.semester === semester) || { months: {} };
            for(let i=1; i<=4; i++) document.getElementById(`absences-month-${i}`).value = semesterData.months[`m${i}`] || 0;
        };
        absencesSemesterSelect.addEventListener('change', e => updateAbsencesForm(e.target.value));
        updateAbsencesForm(absencesSemesterSelect.value);

        document.getElementById('absences-form').addEventListener('submit', e => {
            e.preventDefault();
            const semester = absencesSemesterSelect.value;
            const allAbsences = storage.get('absences', []);
            let semesterData = allAbsences.find(a => a.semester === semester);
            if (!semesterData) {
                semesterData = { semester, months: {} };
                allAbsences.push(semesterData);
            }
            semesterData.months = { m1: document.getElementById('absences-month-1').value, m2: document.getElementById('absences-month-2').value, m3: document.getElementById('absences-month-3').value, m4: document.getElementById('absences-month-4').value };
            storage.set('absences', allAbsences);
            alert(`Пропуски за ${semester} семестр сохранены!`);
        });

        // --- Main Page Settings ---
        const settingsForm = document.getElementById('main-page-settings-form');
        const mainPageSemesterSelect = document.getElementById('main-page-semester-select');
        mainPageSemesterSelect.value = storage.get('activeAbsenceSemester', '1');
        settingsForm.addEventListener('submit', e => {
            e.preventDefault();
            storage.set('activeAbsenceSemester', mainPageSemesterSelect.value);
            alert(`Семестр ${mainPageSemesterSelect.value} теперь будет отображаться на главной странице.`);
        });
    }
    // #endregion

    // #region ================== INITIALIZATION ==================
    // Initial setup on first load
    document.addEventListener('DOMContentLoaded', () => {
        // Run common setup
        if (!localStorage.getItem('seeded')) {
            storage.set('seeded', true); // Ensure seeding only happens once ever
        }
        populateSemesterDropdowns();

        // Run page-specific logic
        initializeMainPage();
        initializeProfilePage();
    });

    // THE FIX: Re-run main page logic when navigating back from the bfcache
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            initializeMainPage();
        }
    });
    // #endregion

})(); // End of self-invoking function