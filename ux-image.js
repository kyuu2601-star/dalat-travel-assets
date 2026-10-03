(function () {
    let fullscreenViewer = null;

    function ensureFullscreenViewer() {
        if (fullscreenViewer) return fullscreenViewer;

        const viewer = document.createElement('div');
        viewer.id = 'travelos-image-fullscreen';
        viewer.className = 'image-fullscreen-viewer';
        viewer.setAttribute('aria-hidden', 'true');
        viewer.innerHTML = '<img alt="Full size preview">';

        viewer.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            closeImageFullscreen();
        });

        viewer.addEventListener('touchmove', event => event.preventDefault(), { passive: false });
        document.body.appendChild(viewer);
        fullscreenViewer = viewer;
        return viewer;
    }

    function closeImageFullscreen() {
        const viewer = fullscreenViewer || document.getElementById('travelos-image-fullscreen');
        if (!viewer) return;

        viewer.classList.remove('open');
        viewer.setAttribute('aria-hidden', 'true');
        document.documentElement.classList.remove('image-fullscreen-open');
        document.body.classList.remove('image-fullscreen-open');
    }

    function openImageFullscreen(index, event) {
        event?.preventDefault();
        event?.stopPropagation();

        const image = document.getElementById(`img-${index}`);
        if (!image?.src) return;

        const viewer = ensureFullscreenViewer();
        const fullImage = viewer.querySelector('img');
        fullImage.src = image.src;
        fullImage.alt = image.alt || 'Full size preview';

        viewer.classList.add('open');
        viewer.setAttribute('aria-hidden', 'false');
        document.documentElement.classList.add('image-fullscreen-open');
        document.body.classList.add('image-fullscreen-open');
    }

    window.selectCard = function () {};

    window.toggleImage = function (index, url, event) {
        event?.stopPropagation();
        event?.preventDefault();

        if (!url) {
            alert('Chưa có ảnh ref!');
            return;
        }

        const overlay = document.getElementById(`overlay-${index}`);
        const button = document.getElementById(`btn-${index}`);
        const image = document.getElementById(`img-${index}`);
        if (!overlay || !button || !image) return;

        const open = !overlay.classList.contains('open');
        if (open) {
            image.src = url;
            image.onclick = e => openImageFullscreen(index, e);
            image.setAttribute('role', 'button');
            image.setAttribute('aria-label', 'Mở ảnh toàn màn hình');
            image.tabIndex = 0;
            image.onkeydown = e => {
                if (e.key === 'Enter' || e.key === ' ') openImageFullscreen(index, e);
            };
        }

        overlay.classList.toggle('open', open);
        button.textContent = open ? 'Close' : 'Image';
        button.classList.toggle('close', open);
    };

    window.openImageFullscreen = openImageFullscreen;
    window.closeImageFullscreen = closeImageFullscreen;

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && fullscreenViewer?.classList.contains('open')) closeImageFullscreen();
    });
})();
