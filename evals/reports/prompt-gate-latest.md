# TravelOS prompt gate — 8 intent

- Phạm vi: bọc ngoài tám prompt, không sửa nội dung prompt.
- Pre-gate: khóa intent, kiểm tra tool hợp lệ, evidence đúng plan, ID evidence và payload thành công.
- Post-gate: kiểm tra grounding, rò rỉ quy trình nội bộ, địa điểm phải có trong evidence, chẩn đoán/kê liều và scope redirect.
- Fallback: loại bỏ output model không đạt và dùng deterministic answer hiện có.
- Chat chi tiết và Voice Mode dùng chung gate.

## Kết quả

- Prompt gate unit tests: **8/8 đạt**.
- Toàn bộ test hệ thống: **196/196 đạt**.
- Router eval: **102/120 đạt**, không thay đổi so với trước gate.
- Knowledge eval: **98/100 đạt**, không thay đổi so với trước gate.
- Live eval: **26/30 đạt**, structural score **97,5%**.

## Lỗi live không thuộc prompt gate

- L08: Geoapify trả lẫn POI không phải nhà thuốc trong nhóm pharmacy. Intent, tool và nội dung không kê thuốc đều đúng; lỗi nằm ở lọc dữ liệu provider và deterministic safety answer không đi qua prompt.
- L24–L26: các giới hạn phân loại/GPS đã tồn tại từ trước và cần thay đổi luồng mới xử lý dứt điểm.
