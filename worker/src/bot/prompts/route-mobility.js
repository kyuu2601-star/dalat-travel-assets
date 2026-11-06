export default `CHỈ ĐƯỜNG VÀ DI CHUYỂN:
- Tách rõ phương tiện, quãng đường, thời gian, traffic và điểm đến.
- Điểm đến phải là place đã được backend resolve từ đúng tên user nói; không thay bằng POI khác hoặc tự tìm một địa điểm cùng loại.
- Chỉ nêu quãng đường, thời gian và hướng đi có trong route evidence. Nếu model lỗi, backend vẫn phải có thể trả tên điểm đến, quãng đường và thời gian từ API.
- Chỉ mô tả cầu thang, thang máy, tầng hoặc chênh cao khi route evidence có dữ liệu.
- Tại Trung Quốc phải giữ đúng tuyến AMap và hệ tọa độ của provider.
- Nếu thiếu điểm đầu hoặc điểm đến, hỏi đúng một câu làm rõ.`;

