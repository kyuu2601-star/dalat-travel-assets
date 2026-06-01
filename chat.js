try {
        // 🎯 Lấy GPS từ App Radar (biến userPos có sẵn trong index.html)
        let gpsInfo = "";
        if (typeof userPos !== "undefined" && userPos !== null) {
            gpsInfo = `\n[VỊ TRÍ HIỆN TẠI]: Latitude ${userPos.lat}, Longitude ${userPos.lon}.`;
        }

        const response = await fetch(CONFIG.WORKER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // ✅ Chỉ cập nhật dòng này: Inject thêm gpsInfo vào sau knowledgeBase
            body: JSON.stringify({ 
                message: CONFIG.SYSTEM_PROMPT(knowledgeBase) + gpsInfo + "\n\nKhách: " + text 
            })
        });

        const data = await response.json();
        const aiMsg = data.candidates[0].content.parts[0].text;
        const loadingElement = document.getElementById(loadingId);
        if (loadingElement) {
            loadingElement.closest('.msg').innerHTML = marked.parse(aiMsg);
            saveMessage('ai', aiMsg);
        }
    } catch (err) {
        console.error(err);
        const loadingElement = document.getElementById(loadingId);
        if (loadingElement) loadingElement.closest('.msg').innerText = "Lỗi kết nối rồi fen!";
    }
