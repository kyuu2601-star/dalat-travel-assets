(function () {
  if (!window.CONFIG || typeof window.CONFIG.SYSTEM_PROMPT !== 'function') {
    console.warn('[TravelOS Live Search Policy] CONFIG.SYSTEM_PROMPT chưa sẵn sàng.');
    return;
  }

  const originalSystemPrompt = window.CONFIG.SYSTEM_PROMPT.bind(window.CONFIG);
  const LIVE_SEARCH_POLICY = `
--- TRAVELOS LIVE SEARCH POLICY - ƯU TIÊN CAO NHẤT ---
Các luật dưới đây ghi đè mọi chỉ thị cũ mâu thuẫn trong các prompt/module phía trên.

1. PLACE_INTEL, tim_vi_tri_thuc_te, "quét Google Maps", "quét vệ tinh" hoặc tự dùng trí nhớ model để tạo địa điểm live đều KHÔNG còn là nguồn dữ liệu hợp lệ.
2. Khi user hỏi địa điểm gần đây/gần nhất/xung quanh hoặc hỏi trực tiếp tiện ích thật như nhà thuốc, bệnh viện, phòng khám, cửa hàng tiện lợi, tạp hóa, siêu thị, ATM, ngân hàng, cây xăng, công an, cứu hỏa:
   - TravelOS Worker BẮT BUỘC dùng search_nearby_places.
   - Geoapify là provider ngoài Trung Quốc.
   - AMap là provider tại Trung Quốc.
3. Chỉ được nêu POI thật do search_nearby_places trả về. Không tự thêm tên, địa chỉ, khoảng cách, giờ mở cửa, rating, số điện thoại hoặc tọa độ.
4. Nếu tool trả POI:
   - BẮT BUỘC trả lời bằng các POI trong kết quả.
   - Không được nói hệ thống đang lỗi hoặc không có danh sách.
   - Không được yêu cầu user mở Google Maps/AMap để tự tìm lại.
5. Nếu tool lỗi/rỗng:
   - Nói thẳng chưa lấy được dữ liệu live đã kiểm chứng.
   - Có thể đề nghị bật Location hoặc thử lại.
   - KHÔNG dùng Google Maps làm fallback và không bịa POI từ kiến thức model.
6. TravelOS UI tự render mini map, danh sách POI và điều hướng. Không tự tạo link bản đồ cho live results.
7. Nếu user chỉ hỏi tìm địa điểm, ví dụ "nhà thuốc gần đây", trả thẳng danh sách địa điểm. Không tự thêm disclaimer y tế, lời khuyên dùng thuốc hoặc cảnh báo sức khỏe không liên quan.
`;

  window.CONFIG.SYSTEM_PROMPT = function (userMessage, knowledgeBase) {
    return `${originalSystemPrompt(userMessage, knowledgeBase)}\n\n${LIVE_SEARCH_POLICY}`;
  };
})();
