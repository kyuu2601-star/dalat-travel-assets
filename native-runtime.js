(function () {
    const capacitor = Boolean(window.Capacitor?.isNativePlatform?.());
    const localWebView = location.hostname === 'localhost' && ['http:', 'https:'].includes(location.protocol);
    window.TRAVELOS_NATIVE = capacitor || localWebView;
    document.documentElement.classList.toggle('native-app', window.TRAVELOS_NATIVE);
})();

