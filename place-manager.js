(function () {
    const ADMIN_KEY_STORAGE = 'travelos_admin_key';
    let editingPlace = null;
    let searchInput = null;
    let searchResults = null;
    let modeBar = null;
    let duplicateBox = null;
    let baseOpenAddPlaceModal = window.openAddPlaceModal;
    let baseCloseAddPlaceModal = window.closeAddPlaceModal;
    let baseRenderGrid = window.renderGrid;

    const formFields = [
        'name','category','country','city','area','latitude','longitude','map_link','recommend',
        'open_time_1','open_time_2','price','ticket','move_difficulty','road_note','image_url'
    ];

    function fold(value) {
        return String(value || '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd').replace(/Đ/g, 'D')
            .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, c => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        }[c]));
    }

    function getPlaces() {
        return Array.isArray(window.fullData) ? window.fullData : [];
    }

    function placeLabel(place) {
        return [place.area, place.city, place.country].filter(Boolean).join(' · ');
    }

    function getAdminKey(forcePrompt = false) {
        let key = forcePrompt ? '' : localStorage.getItem(ADMIN_KEY_STORAGE) || '';
        if (!key) {
            key = (window.prompt('Nhập TravelOS ADMIN_KEY để cập nhật địa điểm:') || '').trim();
            if (!key) throw new Error('Chưa nhập ADMIN_KEY.');
            localStorage.setItem(ADMIN_KEY_STORAGE, key);
        }
        return key;
    }

    function apiBase() {
        if (!window.CONFIG?.D1_ENABLED || !window.CONFIG?.DATA_API_URL) throw new Error('D1 chưa được bật trong config.js');
        return String(window.CONFIG.DATA_API_URL).replace(/\/$/, '');
    }

    async function putPlace(id, payload, key) {
        const response = await fetch(`${apiBase()}/places/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${key}` },
            body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));
        return { response, data };
    }

    async function updatePlace(id, payload) {
        let key = getAdminKey(false);
        let result = await putPlace(id, payload, key);

        if (result.response.status === 401) {
            localStorage.removeItem(ADMIN_KEY_STORAGE);
            key = getAdminKey(true);
            result = await putPlace(id, payload, key);
        }

        if (!result.response.ok) {
            throw new Error(result.data?.error || `D1 update HTTP ${result.response.status}`);
        }
        return result.data;
    }

    async function refreshPlaces() {
        const oldArray = Array.isArray(window.fullData) ? window.fullData : null;
        const fresh = await window.TravelData.loadPlaces(true);

        if (oldArray) {
            oldArray.splice(0, oldArray.length, ...fresh);
            window.fullData = oldArray;
        } else {
            window.fullData = fresh;
        }

        if (typeof window.renderLocationFilters === 'function') window.renderLocationFilters();
        if (typeof window.applyFilters === 'function') window.applyFilters();
        if (typeof window.checkRadarStatus === 'function') window.checkRadarStatus();
    }

    function setFormValue(name, value) {
        const field = document.querySelector(`#add-place-form [name="${name}"]`);
        if (!field) return;
        field.value = value ?? '';
    }

    function fillForm(place) {
        formFields.forEach(name => setFormValue(name, place[name]));
    }

    function currentFormData() {
        const form = document.getElementById('add-place-form');
        const data = Object.fromEntries(new FormData(form).entries());

        ['latitude','longitude'].forEach(key => {
            data[key] = data[key] === '' ? null : Number(data[key]);
        });

        return data;
    }

    function mergedEditPayload() {
        const formData = currentFormData();
        return {
            ...editingPlace,
            ...formData,
            warning_image: editingPlace?.warning_image || '',
            warning_text: editingPlace?.warning_text || '',
            warning_latitude: editingPlace?.warning_latitude ?? null,
            warning_longitude: editingPlace?.warning_longitude ?? null
        };
    }

    function updateHeader() {
        const modal = document.getElementById('add-place-modal');
        const title = modal?.querySelector('.modal-header h2');
        const subtitle = modal?.querySelector('.modal-header p');
        const submit = document.getElementById('add-place-submit');

        if (editingPlace) {
            if (title) title.innerHTML = 'Edit <span>Place</span>';
            if (subtitle) subtitle.textContent = 'Update the selected TravelOS place.';
            if (submit) submit.textContent = 'Save Changes';
            modeBar.innerHTML = `
                <div>
                    <span class="pm-mode-label">Editing</span>
                    <strong>${escapeHtml(editingPlace.name)}</strong>
                    <small>${escapeHtml(placeLabel(editingPlace))}</small>
                </div>
                <button type="button" class="pm-cancel-edit">Cancel Edit</button>`;
            modeBar.classList.add('editing');
            modeBar.querySelector('.pm-cancel-edit')?.addEventListener('click', cancelEdit);
        } else {
            if (title) title.innerHTML = 'Add <span>Place</span>';
            if (subtitle) subtitle.textContent = 'Search existing places first, or create a new one.';
            if (submit) submit.textContent = 'Save to D1';
            modeBar.innerHTML = `
                <div>
                    <span class="pm-mode-label">New Place</span>
                    <strong>Create a new TravelOS place</strong>
                    <small>Search above first to avoid duplicates.</small>
                </div>`;
            modeBar.classList.remove('editing');
        }
    }

    function clearSearch() {
        if (searchInput) searchInput.value = '';
        if (searchResults) {
            searchResults.innerHTML = '';
            searchResults.classList.remove('open');
        }
    }

    function resetToCreateMode(resetForm = true) {
        editingPlace = null;
        if (resetForm) document.getElementById('add-place-form')?.reset();
        clearSearch();
        hideDuplicate();
        updateHeader();
    }

    function cancelEdit() {
        resetToCreateMode(true);
        baseOpenAddPlaceModal?.();
        document.getElementById('place-name')?.focus();
    }

    function beginEdit(place) {
        if (!place?.id) return;
        editingPlace = place;
        baseOpenAddPlaceModal?.();
        fillForm(place);
        clearSearch();
        hideDuplicate();
        updateHeader();
        document.getElementById('place-name')?.focus();
    }

    async function openPlaceEditor(id) {
        let place = getPlaces().find(item => String(item.id) === String(id));

        if (!place) {
            const fresh = await window.TravelData.loadPlaces(true);
            place = fresh.find(item => String(item.id) === String(id));
        }

        if (!place) {
            alert('Không tìm thấy địa điểm này trong D1.');
            return;
        }

        beginEdit(place);
    }

    function rankMatches(query) {
        const q = fold(query);
        if (!q) return [];

        return getPlaces().map(place => {
            const name = fold(place.name);
            const location = fold(placeLabel(place));
            const category = fold(place.category);
            let score = 0;

            if (name === q) score += 100;
            else if (name.startsWith(q)) score += 70;
            else if (name.includes(q)) score += 50;

            if (location.includes(q)) score += 20;
            if (category.includes(q)) score += 10;

            for (const token of q.split(/\s+/).filter(Boolean)) {
                if (name.includes(token)) score += 7;
                if (location.includes(token)) score += 2;
            }

            return { place, score };
        }).filter(item => item.score > 0)
          .sort((a,b) => b.score - a.score || String(a.place.name).localeCompare(String(b.place.name), 'vi'))
          .slice(0, 8)
          .map(item => item.place);
    }

    function renderSearchResults() {
        const query = searchInput.value.trim();
        if (!query) {
            searchResults.innerHTML = '';
            searchResults.classList.remove('open');
            return;
        }

        const matches = rankMatches(query);
        searchResults.innerHTML = matches.map(place => `
            <button type="button" class="pm-search-item" data-place-id="${escapeHtml(place.id)}">
                <strong>${escapeHtml(place.name)}</strong>
                <span>${escapeHtml(placeLabel(place) || 'No location')}</span>
                <small>${escapeHtml(place.category || 'No category')}</small>
            </button>`).join('');

        searchResults.innerHTML += `
            <button type="button" class="pm-create-new">
                <strong>+ Create New Place</strong>
                <span>Use “${escapeHtml(query)}” as a new place name.</span>
            </button>`;

        searchResults.classList.add('open');

        searchResults.querySelectorAll('.pm-search-item').forEach(button => {
            button.addEventListener('click', () => {
                const place = getPlaces().find(item => String(item.id) === String(button.dataset.placeId));
                if (place) beginEdit(place);
            });
        });

        searchResults.querySelector('.pm-create-new')?.addEventListener('click', () => {
            const name = searchInput.value.trim();
            resetToCreateMode(true);
            baseOpenAddPlaceModal?.();
            setFormValue('name', name);
            document.getElementById('place-name')?.focus();
            checkDuplicate();
        });
    }

    function duplicateCandidate() {
        const formData = currentFormData();
        const name = fold(formData.name);
        if (!name) return null;

        return getPlaces().find(place => {
            if (editingPlace && String(place.id) === String(editingPlace.id)) return false;
            if (fold(place.name) !== name) return false;

            const cityA = fold(place.city);
            const cityB = fold(formData.city);
            const countryA = fold(place.country);
            const countryB = fold(formData.country);

            const cityMatches = !cityA || !cityB || cityA === cityB;
            const countryMatches = !countryA || !countryB || countryA === countryB;
            return cityMatches && countryMatches;
        }) || null;
    }

    function showDuplicate(place) {
        duplicateBox.innerHTML = `
            <div>
                <span>Possible existing place</span>
                <strong>${escapeHtml(place.name)}</strong>
                <small>${escapeHtml(placeLabel(place))}</small>
            </div>
            <button type="button">Edit this place</button>`;
        duplicateBox.classList.add('open');
        duplicateBox.querySelector('button')?.addEventListener('click', () => beginEdit(place));
    }

    function hideDuplicate() {
        if (!duplicateBox) return;
        duplicateBox.classList.remove('open');
        duplicateBox.innerHTML = '';
    }

    function checkDuplicate() {
        const place = duplicateCandidate();
        if (place) showDuplicate(place);
        else hideDuplicate();
        return place;
    }

    async function handleEditSubmit(event) {
        if (!editingPlace) {
            const duplicate = duplicateCandidate();
            if (duplicate) {
                event.preventDefault();
                event.stopImmediatePropagation();
                showDuplicate(duplicate);
                document.getElementById('place-name')?.focus();
            }
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();

        const submit = document.getElementById('add-place-submit');
        const status = document.getElementById('add-place-status');
        submit.disabled = true;
        status.textContent = 'Updating...';

        try {
            await updatePlace(editingPlace.id, mergedEditPayload());
            await refreshPlaces();
            status.textContent = 'Updated in D1.';
            setTimeout(() => {
                resetToCreateMode(true);
                baseCloseAddPlaceModal?.();
            }, 600);
        } catch (error) {
            status.textContent = error?.message || 'Update failed.';
        } finally {
            submit.disabled = false;
        }
    }

    function closeMenus(except = null) {
        document.querySelectorAll('.pm-card-menu.open').forEach(menu => {
            if (menu !== except) menu.classList.remove('open');
        });
    }

    function attachCardMenus(items) {
        const cards = [...document.querySelectorAll('#results-grid .card-travel')];

        cards.forEach((card, index) => {
            const place = items[index];
            if (!place?.id || card.querySelector('.pm-card-actions')) return;

            const imageButton = card.querySelector('.image-button');
            const metaRow = card.querySelector('.card-meta-row');
            if (!imageButton || !metaRow) return;

            const actions = document.createElement('div');
            actions.className = 'pm-card-actions';

            const menu = document.createElement('div');
            menu.className = 'pm-card-menu';
            menu.innerHTML = `
                <button type="button" class="pm-menu-trigger" aria-label="Place actions" aria-expanded="false">•••</button>
                <div class="pm-menu-popover">
                    <button type="button" class="pm-edit-place">Edit Place</button>
                </div>`;

            imageButton.parentNode.removeChild(imageButton);
            actions.appendChild(imageButton);
            actions.appendChild(menu);
            metaRow.appendChild(actions);

            const trigger = menu.querySelector('.pm-menu-trigger');
            trigger.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                const open = !menu.classList.contains('open');
                closeMenus(menu);
                menu.classList.toggle('open', open);
                trigger.setAttribute('aria-expanded', String(open));
            });

            menu.querySelector('.pm-edit-place').addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                closeMenus();
                openPlaceEditor(place.id);
            });
        });
    }

    function installGridHook() {
        if (typeof baseRenderGrid !== 'function') return;
        window.renderGrid = function (items) {
            baseRenderGrid(items);
            attachCardMenus(items || []);
        };
    }

    function installManagerUi() {
        const form = document.getElementById('add-place-form');
        if (!form || document.getElementById('place-manager-tools')) return;

        const tools = document.createElement('section');
        tools.id = 'place-manager-tools';
        tools.className = 'pm-tools';
        tools.innerHTML = `
            <div class="pm-search-wrap">
                <label for="place-manager-search">Find existing place</label>
                <input id="place-manager-search" type="search" autocomplete="off"
                    placeholder="Search name, area, city, category...">
                <div id="place-manager-results" class="pm-search-results"></div>
            </div>
            <div id="place-manager-mode" class="pm-mode-bar"></div>`;

        form.prepend(tools);

        const nameField = document.getElementById('place-name')?.closest('.field');
        duplicateBox = document.createElement('div');
        duplicateBox.id = 'place-duplicate-warning';
        duplicateBox.className = 'pm-duplicate-warning';
        nameField?.appendChild(duplicateBox);

        searchInput = document.getElementById('place-manager-search');
        searchResults = document.getElementById('place-manager-results');
        modeBar = document.getElementById('place-manager-mode');

        searchInput.addEventListener('input', renderSearchResults);
        searchInput.addEventListener('focus', renderSearchResults);
        searchInput.addEventListener('keydown', event => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            const first = rankMatches(searchInput.value)[0];
            if (first) beginEdit(first);
        });
        document.getElementById('place-name')?.addEventListener('input', checkDuplicate);
        document.getElementById('place-city')?.addEventListener('input', checkDuplicate);
        document.getElementById('place-country')?.addEventListener('input', checkDuplicate);

        form.addEventListener('submit', handleEditSubmit, true);
        updateHeader();
    }

    window.openPlaceEditor = openPlaceEditor;

    window.openAddPlaceModal = function () {
        resetToCreateMode(true);
        baseOpenAddPlaceModal?.();
        searchInput?.focus();
    };

    window.closeAddPlaceModal = function () {
        resetToCreateMode(true);
        baseCloseAddPlaceModal?.();
    };

    installGridHook();

    document.addEventListener('click', event => {
        if (!event.target.closest('.pm-card-menu')) closeMenus();
        if (searchResults?.classList.contains('open') && !event.target.closest('.pm-search-wrap')) {
            searchResults.classList.remove('open');
        }
    });

    window.addEventListener('load', () => {
        installManagerUi();
        if (Array.isArray(window.fullData)) window.renderGrid === baseRenderGrid || window.applyFilters?.();
    });
})();