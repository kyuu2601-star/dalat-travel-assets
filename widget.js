(function() {
    const widgetContainer = document.createElement('div');
    widgetContainer.innerHTML = `
        <div id="chat-widget-overlay"></div>
        <button id="chat-widget-button" type="button" aria-label="Mở Thổ Địa">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
        </button>
        <section id="chat-widget-window" aria-hidden="true">
            <div class="widget-header">
                <h2>Thổ Địa</h2>
                <button id="close-widget" type="button" aria-label="Đóng">×</button>
            </div>
            <div id="chat-box"></div>
            <div class="widget-input-area">
                <input type="text" id="userInput" placeholder="Hỏi đường, quán xá..." aria-label="Nhập câu hỏi cho Thổ Địa">
                <button class="mic-btn" id="mic-btn" type="button" aria-label="Voice input">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                        <line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line>
                    </svg>
                </button>
                <button class="send-btn" id="send-btn" type="button" aria-label="Send">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                </button>
            </div>
        </section>`;
    document.body.appendChild(widgetContainer);

    const btn = document.getElementById('chat-widget-button');
    const win = document.getElementById('chat-widget-window');
    const close = document.getElementById('close-widget');
    const overlay = document.getElementById('chat-widget-overlay');

    function scrollBottom() {
        const chatBox = document.getElementById('chat-box');
        if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
    }

    function setOpen(open) {
        win.classList.toggle('open', open);
        overlay.classList.toggle('open', open);
        win.setAttribute('aria-hidden', String(!open));
        document.documentElement.classList.toggle('chat-open', open);
        document.body.classList.toggle('chat-open', open);
        if (open) {
            setTimeout(() => {
                scrollBottom();
                document.getElementById('userInput')?.focus();
            }, 250);
        }
    }

    btn.onclick = () => {
        if (!window.isSystemLive) return;
        setOpen(!win.classList.contains('open'));
    };
    close.onclick = event => { event.stopPropagation(); setOpen(false); };
    overlay.onclick = () => setOpen(false);

    document.getElementById('userInput').addEventListener('keydown', event => {
        if (event.key === 'Enter') handleChat();
    });
    document.getElementById('send-btn').onclick = () => handleChat();

    const micBtn = document.getElementById('mic-btn');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'vi-VN';
        recognition.continuous = false;
        recognition.interimResults = false;
        let isRecording = false;

        micBtn.onclick = () => {
            if (!isRecording) {
                recognition.start();
                isRecording = true;
                micBtn.classList.add('recording');
            } else {
                recognition.stop();
            }
        };
        recognition.onresult = event => {
            document.getElementById('userInput').value = event.results[0][0].transcript;
            isRecording = false;
            micBtn.classList.remove('recording');
            handleChat();
        };
        recognition.onerror = recognition.onend = () => {
            isRecording = false;
            micBtn.classList.remove('recording');
        };
    } else {
        micBtn.hidden = true;
    }
})();
