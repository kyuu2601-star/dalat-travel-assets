const HCMC=Object.freeze({country:'Việt Nam',city:'TP.HCM',latitude:10.7769,longitude:106.7009,source:'eval-public-coordinate'});

const expected={
  placeCurrent:{decision:'API_TOOLS',intentHint:'PLACE_DISCOVERY',requiresFreshGps:true,planIntent:'PLACE_DISCOVERY',toolsContain:['search_places'],matched:true},
  placeRemote:{decision:'API_TOOLS',intentHint:'PLACE_DISCOVERY',requiresFreshGps:false,planIntent:'PLACE_DISCOVERY',toolsContain:['search_places'],matched:true},
  routeCurrent:{decision:'API_TOOLS',intentHint:'ROUTE_MOBILITY',requiresFreshGps:true,planIntent:'ROUTE_MOBILITY',toolsContain:['resolve_place'],matched:true},
  routeTwoPoint:{decision:'API_TOOLS',intentHint:'ROUTE_MOBILITY',requiresFreshGps:false,planIntent:'ROUTE_MOBILITY',toolsContain:['resolve_place'],matched:true},
  weatherCurrent:{decision:'API_TOOLS',intentHint:'WEATHER_OUTDOOR',requiresFreshGps:true,planIntent:'WEATHER_OUTDOOR',toolsContain:['weather'],matched:true},
  weatherRemote:{decision:'API_TOOLS',intentHint:'WEATHER_OUTDOOR',requiresFreshGps:false,planIntent:'WEATHER_OUTDOOR',toolsContain:['resolve_place','weather'],matched:true},
  safety:{decision:'API_TOOLS',intentHint:'SAFETY_HEALTH',requiresFreshGps:true,planIntent:'SAFETY_HEALTH',toolsContain:['search_places'],matched:true},
  itinerary:{decision:'PLANNER_MODEL',intentHint:'ITINERARY_PLANNING',requiresFreshGps:false,planIntent:'ITINERARY_PLANNING',toolsContain:['curated_places'],matched:true},
  guided:{decision:'GUIDED_CHAT',intentHint:'LOCAL_GUIDE',requiresFreshGps:false,planIntent:'LOCAL_GUIDE',toolsExact:[],matched:true},
  utility:{decision:'MODEL_ANSWER',intentHint:'TRAVEL_UTILITY',requiresFreshGps:false,planIntent:'TRAVEL_UTILITY',toolsExact:[],matched:true}
};

const chatGroups=[
  {category:'chat-place-current',expected:expected.placeCurrent,messages:[
    'Kiếm quán bún bò gần tôi','Tìm tiệm trà sữa quanh chỗ mình','Có ATM nào quanh vị trí này?','Tìm nhà vệ sinh gần chỗ đang đứng','Quanh tui có cửa hàng tiện lợi nào?'
  ]},
  {category:'chat-place-remote',expected:expected.placeRemote,messages:[
    'Tìm quán lẩu ở Trùng Khánh','Kiếm tiệm cà phê tại Đà Lạt','Có nhà thuốc nào ở Quận 3?','Tìm siêu thị tại Thượng Hải','Nhà vệ sinh công cộng ở ga Hồng Kiều'
  ]},
  {category:'chat-route-current',expected:expected.routeCurrent,messages:[
    'Đưa tui tới Dinh Độc Lập','Tìm đường đến ga Bến Thành','Dẫn mình tới Chợ Đà Lạt','Cách đi đến Hồng Nhai Động','Cho tôi route tới sân bay Liên Khương'
  ]},
  {category:'chat-route-two-point',expected:expected.routeTwoPoint,messages:[
    'Từ Nhà thờ Đức Bà đến Chợ Bến Thành','Từ Hồ Xuân Hương tới ga Đà Lạt','Từ Hồng Nhai Động qua Giải Phóng Bi','Từ sân bay Tân Sơn Nhất đến Quận 1','Từ ga Trùng Khánh Bắc tới Nam Bình'
  ]},
  {category:'chat-weather-current',expected:expected.weatherCurrent,messages:[
    'Trời chỗ tôi có mưa không?','Nhiệt độ quanh đây bao nhiêu?','Dự báo thời tiết gần tui','Ở đây có nắng không?','Gió quanh vị trí hiện tại có mạnh không?'
  ]},
  {category:'chat-weather-remote',expected:expected.weatherRemote,messages:[
    'Thời tiết ở Thành Đô hôm nay','Tại Bắc Kinh có mưa không?','Nhiệt độ ở Quảng Châu bao nhiêu?','Dự báo thời tiết tại Phượng Hoàng Cổ Trấn','Ở Thượng Hải có lạnh không?'
  ]},
  {category:'chat-safety',expected:expected.safety,messages:[
    'Tôi chóng mặt, cần trợ giúp quanh tôi','Tôi bị dị ứng, cần y tế gần mình','Tôi bị móc túi, cần trợ giúp quanh đây','Tôi mất đồ, cần công an gần tôi','Tôi khó thở, cần nơi hỗ trợ quanh mình'
  ]},
  {category:'chat-itinerary',expected:expected.itinerary,messages:[
    'Lập lịch Đà Lạt 2 ngày','Xếp lịch ăn chơi Trùng Khánh một ngày','Plan chuyến đi Bắc Kinh 4 ngày','Itinerary Thượng Hải 3 ngày','Sắp xếp các điểm ở Quận 1 theo buổi'
  ]},
  {category:'chat-guided',expected:expected.guided,messages:[
    'Chào Pipi nha','Kể chuyện vui đi Pipi','Ở Trung Quốc có kiêng kỵ gì?','Cách ứng xử khi đi tàu điện','Cảm ơn Pipi nhiều'
  ]},
  {category:'chat-utility',expected:expected.utility,messages:[
    'Tỷ giá nhân dân tệ hôm nay','SIM du lịch Trung Quốc dùng thế nào?','Wi-Fi khi đi Trùng Khánh ra sao?','Tôi cần gửi hành lý','Hotline hỗ trợ du lịch là gì?'
  ]}
];

const additionalChatGroups=[
  {category:'chat-place-current',expected:expected.placeCurrent,messages:['Tìm quán phở bò gần đây','Có bưu điện nào gần chỗ tôi?','Kiếm trạm xăng quanh đây','Tìm tiệm giặt ủi gần vị trí hiện tại','Gần mình có chỗ đổi tiền không?']},
  {category:'chat-place-remote',expected:expected.placeRemote,messages:['Tìm quán dimsum ở Quảng Châu','Có cửa hàng bán sim tại Bắc Kinh không?','Tìm điểm ngắm cảnh ở Hàng Châu','Có nhà vệ sinh công cộng gần ga Thượng Hải không?','Kiếm quán ăn chay ở Đà Lạt']},
  {category:'chat-route-current',expected:expected.routeCurrent,messages:['Chỉ đường tới Bưu điện Trung tâm Sài Gòn','Đưa tôi đến ga Tân Sơn Nhất','Đi tới Hồ Tuyền Lâm thế nào?','Dẫn mình đến Phố đi bộ Nguyễn Huệ','Tìm đường tới sân bay Đào Viên']},
  {category:'chat-route-two-point',expected:expected.routeTwoPoint,messages:['Từ ga Đà Lạt tới Hồ Xuân Hương','Từ sân bay Đà Nẵng đến Cầu Rồng','Từ ga Hồng Kiều đến Bến Thượng Hải','Đi từ khách sạn đến sân bay Nội Bài','Từ Thiên Môn Sơn tới Phượng Hoàng Cổ Trấn']},
  {category:'chat-weather-current',expected:expected.weatherCurrent,messages:['Bây giờ quanh tôi trời bao nhiêu độ?','Chỗ mình có đang mưa không?','Thời tiết gần vị trí của tui thế nào?','Hôm nay ở đây có cần mang áo mưa không?','Ngoài trời quanh đây có gió lớn không?']},
  {category:'chat-weather-remote',expected:expected.weatherRemote,messages:['Ngày mai thời tiết ở Tô Châu thế nào?','Thời tiết hiện tại tại Hạ Môn ra sao?','Ở Côn Minh hôm nay có nắng không?','Cuối tuần này ở Nam Kinh có mưa không?','Nhiệt độ tại Tây An tối nay bao nhiêu?']},
  {category:'chat-safety',expected:expected.safety,messages:['Tôi bị đau bụng, tìm nơi hỗ trợ gần đây','Tôi bị lạc, cần đồn công an gần nhất','Bạn tìm bệnh viện gần vị trí của tôi','Tôi bị trượt ngã, có cơ sở y tế nào quanh đây?','Tôi đánh rơi ví, giúp tìm công an gần tôi']},
  {category:'chat-itinerary',expected:expected.itinerary,messages:['Lên lịch tham quan Đà Lạt trong 3 ngày','Sắp xếp chuyến đi Thượng Hải 2 ngày','Tạo lịch ăn uống ở Quận 1 một ngày','Gợi ý lịch khám phá Trùng Khánh 3 ngày','Lên kế hoạch cuối tuần ở Hội An']},
  {category:'chat-guided',expected:expected.guided,messages:['Pipi ơi, hôm nay bạn khỏe không?','Kể tui nghe một câu đố vui','Người Trung Quốc thường chào nhau thế nào?','Đi tàu điện ở Trung Quốc có cần xếp hàng không?','Cảm ơn nha, bạn dễ thương ghê']},
  {category:'chat-utility',expected:expected.utility,messages:['Có cần đổi tiền mặt trước khi đi Trung Quốc không?','Cách mua vé tàu cao tốc ở Trung Quốc?','Tôi muốn gửi vali ở nhà ga','Có thể dùng eSIM tại Trung Quốc không?','Mẹo giữ an toàn hộ chiếu khi đi du lịch?']}
];

let chatSequence=0;
const buildChatCases=groups=>groups.flatMap(group=>group.messages.map(message=>({
  id:`C${String(++chatSequence).padStart(3,'0')}`,category:group.category,userMessage:message,userLocation:HCMC,expected:group.expected
})));
export const TEXT_CHAT_EVAL_CASES=[...buildChatCases(chatGroups),...buildChatCases(additionalChatGroups)];

const viToZh=[
  ['Xin chào, nhà vệ sinh ở đâu?','你好，请问洗手间在哪里？',[['洗手间','厕所'],['哪里','哪儿']]],
  ['Chỉ đường giúp tôi đến Hồng Nhai Động.','请给我指路去洪崖洞。',[['洪崖洞'],['指路','怎么走','带我去']]],
  ['Đi bộ đến đó mất bao lâu?','走路到那里需要多长时间？',[['走路','步行'],['多久','多长时间']]],
  ['Nhà thuốc gần nhất ở đâu?','最近的药店在哪里？',[['药店','药房'],['最近','最接近']]],
  ['Tôi bị dị ứng đậu phộng.','我对花生过敏。',[['花生'],['过敏']]],
  ['Làm ơn gọi giúp tôi một chiếc taxi.','请帮我叫一辆出租车。',[['出租车','的士'],['叫','打','坐']]],
  ['Món này giá bao nhiêu?','这个多少钱？',[['多少'],['钱','价格']]],
  ['Ở đây có thể thanh toán bằng Alipay không?','这里可以用支付宝付款吗？',[['支付宝'],['付款','支付']]],
  ['Tôi muốn nhận phòng khách sạn.','我想办理酒店入住。',[['酒店'],['入住','登记']]],
  ['Chuyến tàu điện cuối cùng lúc mấy giờ?','最后一班地铁是几点？',[['最后'],['地铁'],['几点']]],
  ['Tôi không ăn cay.','我不吃辣。',[['不吃辣','不要辣']]],
  ['Cho tôi một vé đến ga Trùng Khánh Bắc.','请给我一张去重庆北站的票。',[['重庆北站'],['一张','票']]],
  ['Tôi cần có mặt lúc 8 giờ sáng.','我早上八点需要到达。',[['八点','8点'],['早上','上午']]],
  ['Tổng cộng là 120 nhân dân tệ đúng không?','一共是一百二十元，对吗？',[['一百二十','120'],['元','人民币']]],
  ['Khách sạn Yitel nằm ở đường nào?','和颐酒店在哪条路上？',[['和颐','Yitel'],['路']]],
  ['Tôi làm mất hộ chiếu.','我的护照丢了。',[['护照'],['丢','遗失','失去']]],
  ['Làm ơn đưa tôi đến đồn cảnh sát gần nhất.','请带我去最近的派出所。',[['派出所','警察局'],['最近']]],
  ['Tôi có hai vali và một ba lô.','我有两个行李箱和一个背包。',[['两个','2个'],['行李箱'],['背包']]],
  ['Xe buýt này có đến sân bay không?','这辆公交车去机场吗？',[['公交车','巴士'],['机场']]],
  ['Bảo tàng đóng cửa lúc mấy giờ?','博物馆几点关门？',[['博物馆'],['关门','闭馆'],['几点','什么时候']]],
  ['Trời đang mưa, tôi cần mua ô.','正在下雨，我需要买一把伞。',[['下雨'],['伞']]],
  ['Xin dừng ở cổng số 2.','请在二号门停车。',[['二号门','2号门'],['停车','停']]],
  ['Tôi muốn đến Giải Phóng Bi trước 7 giờ tối.','我想在晚上七点前到达解放碑。',[['解放碑'],['七点','7点'],['晚上']]],
  ['Có cửa hàng tiện lợi nào mở 24 giờ không?','有二十四小时营业的便利店吗？',[['二十四小时','24小时'],['便利店']]],
  ['Địa chỉ khách sạn là số 30 đường Lâm Giang Chi.','酒店地址是临江支路三十号。',[['临江支路'],['三十号','30号']]]
];

const zhToVi=[
  ['你好，请问洗手间在哪里？','Xin chào, cho hỏi nhà vệ sinh ở đâu?',[['nhà vệ sinh','phòng vệ sinh'],['ở đâu']]],
  ['请带我去洪崖洞。','Làm ơn đưa tôi đến Hồng Nhai Động.',[['hồng nhai động','hongya'],['đưa tôi','dẫn tôi','đến']]],
  ['走路到那里需要多长时间？','Đi bộ đến đó mất bao lâu?',[['đi bộ'],['bao lâu','mất bao nhiêu thời gian']]],
  ['最近的药店在哪里？','Nhà thuốc gần nhất ở đâu?',[['nhà thuốc','hiệu thuốc'],['gần nhất']]],
  ['我对花生过敏。','Tôi bị dị ứng đậu phộng.',[['dị ứng'],['đậu phộng','lạc']]],
  ['请帮我叫一辆出租车。','Làm ơn gọi giúp tôi một chiếc taxi.',[['taxi','xe taxi'],['gọi']]],
  ['这个多少钱？','Món này giá bao nhiêu?',[['bao nhiêu'],['giá','tiền']]],
  ['这里可以用支付宝付款吗？','Ở đây có thể thanh toán bằng Alipay không?',[['alipay','chi phó bảo'],['thanh toán']]],
  ['我想办理酒店入住。','Tôi muốn làm thủ tục nhận phòng khách sạn.',[['nhận phòng'],['khách sạn']]],
  ['最后一班地铁是几点？','Chuyến tàu điện cuối cùng lúc mấy giờ?',[['cuối cùng','chuyến cuối'],['tàu điện','metro'],['mấy giờ']]],
  ['我不吃辣。','Tôi không ăn cay.',[['không ăn cay','không cay']]],
  ['请给我一张去重庆北站的票。','Cho tôi một vé đến ga Trùng Khánh Bắc.',[['một vé','1 vé'],['ga trùng khánh bắc']]],
  ['我早上八点需要到达。','Tôi cần đến nơi lúc 8 giờ sáng.',[['8 giờ','tám giờ'],['sáng']]],
  ['一共是一百二十元，对吗？','Tổng cộng là 120 nhân dân tệ, đúng không?',[['120','một trăm hai mươi'],['nhân dân tệ','tệ']]],
  ['和颐酒店在哪条路上？','Khách sạn Yitel nằm ở đường nào?',[['yitel','khách sạn hòa di'],['đường nào']]],
  ['我的护照丢了。','Tôi làm mất hộ chiếu.',[['mất','thất lạc'],['hộ chiếu']]],
  ['请带我去最近的派出所。','Làm ơn đưa tôi đến đồn cảnh sát gần nhất.',[['đồn cảnh sát','đồn công an'],['gần nhất']]],
  ['我有两个行李箱和一个背包。','Tôi có hai vali và một ba lô.',[['hai vali','2 vali','hai va li'],['một ba lô','1 ba lô']]],
  ['这辆公交车去机场吗？','Xe buýt này có đến sân bay không?',[['xe buýt','xe bus'],['sân bay']]],
  ['博物馆几点关门？','Bảo tàng đóng cửa lúc mấy giờ?',[['bảo tàng'],['đóng cửa'],['mấy giờ']]],
  ['正在下雨，我需要买一把伞。','Trời đang mưa, tôi cần mua một chiếc ô.',[['mưa'],['mua'],['ô','dù']]],
  ['请在二号门停车。','Xin dừng ở cổng số 2.',[['cổng số 2','cổng 2','cửa số 2','cửa 2'],['dừng','đỗ xe']]],
  ['我想在晚上七点前到达解放碑。','Tôi muốn đến Giải Phóng Bi trước 7 giờ tối.',[['giải phóng bi','jiefangbei'],['7 giờ','bảy giờ'],['tối']]],
  ['有二十四小时营业的便利店吗？','Có cửa hàng tiện lợi nào mở 24 giờ không?',[['cửa hàng tiện lợi'],['24 giờ','hai mươi bốn giờ']]],
  ['酒店地址是临江支路三十号。','Địa chỉ khách sạn là số 30 đường Lâm Giang Chi.',[['khách sạn'],['30','ba mươi'],['lâm giang chi','linjiang']]]
];

const additionalViToZh=[
  ['Tôi muốn mua vé tàu đi Thành Đô.','我想买一张去成都的火车票。',[['成都'],['火车票','车票'],['买','一张']]],
  ['Cho tôi xem thực đơn bằng tiếng Việt được không?','可以给我看越南语菜单吗？',[['菜单'],['越南语','越南文']]],
  ['Tôi muốn trả phòng lúc 11 giờ.','我想在十一点退房。',[['退房'],['十一点','11点']]],
  ['Vui lòng không cho hành lá vào món ăn.','请不要在菜里放葱。',[['不要'],['葱','小葱']]],
  ['Ga tàu cao tốc ở hướng nào?','高铁站在哪个方向？',[['高铁站','火车站'],['方向','哪里']]],
  ['Tôi cần mua thuốc say xe.','我需要买晕车药。',[['晕车药'],['买','需要']]],
  ['Có thể chụp ảnh giúp chúng tôi không?','可以帮我们拍张照片吗？',[['拍照','照片'],['帮我们','帮我']]],
  ['Tôi muốn đặt bàn cho ba người.','我想预订三个人的桌位。',[['预订','订'],['三个人','三位']]],
  ['Hành lý của tôi bị thất lạc.','我的行李丢了。',[['行李'],['丢','遗失']]],
  ['Xe này có đi đến trung tâm thành phố không?','这辆车去市中心吗？',[['市中心'],['车','去']]],
  ['Tôi muốn uống nước không đá.','我想喝不加冰的水。',[['水'],['不加冰','不要冰']]],
  ['Cửa lên máy bay số mấy?','登机口是几号？',[['登机口'],['几号','多少']]],
  ['Tôi cần đổi phòng vì điều hòa không hoạt động.','空调坏了，我需要换房间。',[['空调'],['坏','不工作'],['换房间','换房']]],
  ['Hãy viết địa chỉ này ra giấy giúp tôi.','请帮我把这个地址写下来。',[['地址'],['写下来','写']]],
  ['Tôi muốn đi đến bến xe buýt gần nhất.','我想去最近的公交车站。',[['公交车站','车站'],['最近'],['去']]],
  ['Thanh toán bằng thẻ tín dụng được không?','可以用信用卡付款吗？',[['信用卡'],['付款','支付']]],
  ['Tôi bị đau đầu từ sáng nay.','我从今天早上开始头疼。',[['头疼','头痛'],['早上','今天早上']]],
  ['Vui lòng gọi cho khách sạn giúp tôi.','请帮我给酒店打电话。',[['酒店'],['打电话','电话']]],
  ['Chúng tôi muốn xuống ở trạm tiếp theo.','我们想在下一站下车。',[['下一站'],['下车']]],
  ['Cầu này đi bộ qua được không?','这座桥可以步行通过吗？',[['桥'],['步行','走路'],['可以','能']]],
  ['Tôi muốn mua một chai nước suối.','我想买一瓶矿泉水。',[['矿泉水'],['一瓶','瓶'],['买']]],
  ['Cho hỏi lối ra ở đâu?','请问出口在哪里？',[['出口'],['哪里','哪儿']]],
  ['Chuyến bay của tôi bị hoãn hai tiếng.','我的航班延误了两个小时。',[['航班','飞机'],['延误','晚点'],['两个小时','两小时']]],
  ['Tôi muốn thuê xe đạp trong một ngày.','我想租一天自行车。',[['租'],['自行车'],['一天']]],
  ['Xin hãy nói chậm hơn một chút.','请说慢一点。',[['说'],['慢一点','慢些']]]
];

const additionalZhToVi=[
  ['我想买一张去成都的火车票。','Tôi muốn mua một vé tàu đi Thành Đô.',[['mua'],['vé tàu','vé xe lửa'],['thành đô','chengdu']]],
  ['可以给我看越南语菜单吗？','Có thể cho tôi xem thực đơn tiếng Việt không?', [['thực đơn','menu'],['tiếng việt']]],
  ['我想在十一点退房。','Tôi muốn trả phòng lúc 11 giờ.',[['trả phòng'],['11 giờ','mười một giờ']]],
  ['请不要在菜里放葱。','Vui lòng đừng cho hành lá vào món ăn.',[['đừng','không'],['hành','hành lá']]],
  ['高铁站在哪个方向？','Ga tàu cao tốc nằm hướng nào?', [['ga tàu cao tốc','ga cao tốc'],['hướng nào','hướng']]],
  ['我需要买晕车药。','Tôi cần mua thuốc say xe.',[['thuốc say xe'],['mua']]],
  ['可以帮我们拍张照片吗？','Có thể chụp giúp chúng tôi một tấm ảnh không?', [['chụp'],['chúng tôi'],['ảnh','hình']]],
  ['我想预订三个人的桌位。','Tôi muốn đặt bàn cho ba người.', [['đặt bàn','đặt chỗ'],['ba người','3 người']]],
  ['我的行李丢了。','Hành lý của tôi bị thất lạc.', [['hành lý','vali'],['thất lạc','mất']]],
  ['这辆车去市中心吗？','Xe này có đi đến trung tâm thành phố không?', [['xe'],['đi'],['trung tâm thành phố','trung tâm']]],
  ['我想喝不加冰的水。','Tôi muốn uống nước không đá.', [['uống'],['nước'],['không đá','không bỏ đá']]],
  ['登机口是几号？','Cửa lên máy bay là số mấy?', [['cửa lên máy bay','cổng lên máy bay'],['số mấy','mấy']]],
  ['空调坏了，我需要换房间。','Điều hòa hỏng, tôi cần đổi phòng.', [['điều hòa','máy lạnh'],['hỏng','không hoạt động'],['đổi phòng']]],
  ['请帮我把这个地址写下来。','Làm ơn viết địa chỉ này ra giúp tôi.', [['địa chỉ'],['viết']]],
  ['我想去最近的公交车站。','Tôi muốn đến trạm xe buýt gần nhất.', [['trạm xe buýt','bến xe buýt'],['gần nhất']]],
  ['可以用信用卡付款吗？','Có thể thanh toán bằng thẻ tín dụng không?', [['thanh toán'],['thẻ tín dụng','visa']]],
  ['我从今天早上开始头疼。','Tôi bị đau đầu từ sáng nay.', [['đau đầu'],['sáng nay']]],
  ['请帮我给酒店打电话。','Làm ơn gọi điện cho khách sạn giúp tôi.', [['gọi điện','gọi'],['khách sạn']]],
  ['我们想在下一站下车。','Chúng tôi muốn xuống xe ở trạm tiếp theo.', [['xuống xe','xuống'],['trạm tiếp theo','bến tiếp theo']]],
  ['这座桥可以步行通过吗？','Có thể đi bộ qua cây cầu này không?', [['cầu'],['đi bộ'],['qua']]],
  ['我想买一瓶矿泉水。','Tôi muốn mua một chai nước suối.', [['mua'],['chai'],['nước suối','nước khoáng']]],
  ['请问出口在哪里？','Cho hỏi lối ra ở đâu?', [['lối ra','cửa ra'],['ở đâu']]],
  ['我的航班延误了两个小时。','Chuyến bay của tôi bị hoãn hai tiếng.', [['chuyến bay'],['hoãn','trễ'],['hai tiếng','2 tiếng']]],
  ['我想租一天自行车。','Tôi muốn thuê xe đạp một ngày.', [['thuê'],['xe đạp'],['một ngày','1 ngày']]],
  ['请说慢一点。','Xin hãy nói chậm hơn một chút.', [['nói'],['chậm hơn','chậm'],['một chút']]]
];

let translateSequence=0;
const translationCase=(direction,[sourceText,reference,requiredGroups])=>({
  id:`T${String(++translateSequence).padStart(3,'0')}`,category:`translate-${direction}`,direction,
  sourceLanguage:direction==='vi-zh'?'vi':'zh-Hans',targetLanguage:direction==='vi-zh'?'zh-Hans':'vi',sourceText,reference,requiredGroups
});
export const TRANSLATE_EVAL_CASES=[...viToZh.map(item=>translationCase('vi-zh',item)),...zhToVi.map(item=>translationCase('zh-vi',item)),...additionalViToZh.map(item=>translationCase('vi-zh',item)),...additionalZhToVi.map(item=>translationCase('zh-vi',item))];

if(TEXT_CHAT_EVAL_CASES.length!==100)throw new Error(`Expected 100 text chat cases, received ${TEXT_CHAT_EVAL_CASES.length}`);
if(TRANSLATE_EVAL_CASES.length!==100)throw new Error(`Expected 100 translate cases, received ${TRANSLATE_EVAL_CASES.length}`);
